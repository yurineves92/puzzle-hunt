'use strict';

// Simulador de balanceamento. Carregue no console do jogo (http://localhost:5173/):
//   const s = document.createElement('script'); s.src = 'dev/sim.js'; document.body.appendChild(s);
// e depois: await simSum(0, 'gs', 8)  →  vitórias, jogadas médias e desmaios de 8 caçadas.
// O bot "atento" escolhe a troca que mais acerta a fraqueza; o "casual" (simSum(0, 'gs', 8, false))
// faz a primeira troca que achar. Os dois usam os poderes assim que ficam prontos.
// Não salva progresso e acelera as animações (recarregue a página para voltar ao normal).

window.persist = () => {};
SFX.muted = true;
window.setTimeout = (f) => (Promise.resolve().then(f), 0);

const simYield = () => new Promise((r) => { const c = new MessageChannel(); c.port1.onmessage = () => r(); c.port2.postMessage(0); });
// Sempre devolve a vez ao navegador ao menos uma vez, para a página não travar.
async function simIdle() {
  await simYield();
  for (let g = 0; S.busy && g < 5000; g++) await simYield();
  S.roarT = 0;
}

function simBestMove() {
  let best = null, score = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) for (const [dr, dc] of [[0, 1], [1, 0]]) {
    const a = [r, c], b = [r + dr, c + dc];
    if (!inBounds(b[0], b[1]) || !swappable(S.board[r][c]) || !swappable(S.board[b[0]][b[1]])) continue;
    swapData(a, b);
    const s = findGroups(S.board).reduce((t, g) => t + g.cells.length * elemMult(g.key) + (g.cells.length >= 4 ? 3 : 0), 0);
    swapData(a, b);
    if (s > score) { score = s; best = [a, b]; }
  }
  return best;
}

async function simPowers() {
  if (S.charge[0] === 0) { await usePower(0); await applyTarget(4, 3); await simIdle(); }
  if (S.charge[2] === 0) {
    let pos = [3, 3];
    const weak = S.q.weak[0];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (S.board[r][c].key === weak) pos = [r, c];
    await usePower(2);
    await applyTarget(pos[0], pos[1]);
    await simIdle();
  }
  if (S.charge[1] === 0 && S.moves <= 1) await usePower(1);
  if (S.charge[3] === 0 && S.hunterHp < 50) await usePower(3);
  if (S.special >= 100) {
    if (S.weapon.specialTarget) { S.armed = 'special'; await applyTarget(4, 3); } else await useSpecial();
    await simIdle();
  }
}

// `smart` = true escolhe a melhor troca; false faz a primeira que achar (jogador casual).
async function simQuest(qi, weapon, smart) {
  SAVE.equipped = weapon;
  startQuest(qi);
  S.started = true;
  for (let n = 0; !S.over && n < 300; n++) {
    await simIdle();
    await simPowers();
    if (S.over) break;
    const mv = smart ? simBestMove() : findValidMove();
    if (!mv) { await afterAction(); continue; }
    await trySwap(mv[0], mv[1]);
    await simIdle();
  }
  return { win: S.monsterHp <= 0, moves: S.movesUsed, carts: S.carts };
}

window.simSum = async (qi, weapon = 'gs', n = 8, smart = true) => {
  const rs = [];
  for (let i = 0; i < n; i++) rs.push(await simQuest(qi, weapon, smart));
  const wins = rs.filter((r) => r.win);
  const avg = (list, f) => (list.reduce((s, r) => s + f(r), 0) / Math.max(1, list.length)).toFixed(1);
  return `${QUESTS[qi].id.padEnd(9)} ${weapon} ${smart ? 'atento' : 'casual'}: vitória ${Math.round((100 * wins.length) / n)}% · ${avg(wins, (r) => r.moves)} jogadas · desmaios ${avg(rs, (r) => r.carts)}`;
};
