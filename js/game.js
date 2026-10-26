'use strict';

// ---- Balanceamento -----------------------------------------------------------
const ROWS = 8;
const COLS = 7;
const BASE_DMG = 6;           // dano por peça destruída
const WEAK_POINT_BONUS = 40;  // dano extra ao detonar um ponto fraco (combinação de 5+)
const LINE_BONUS = 15;        // dano extra ao detonar uma lâmina (combinação de 4)
const HUNTER_MAX_HP = 100;
const MAX_CARTS = 3;
const POISON_PER_MOVE = 6;    // dano do veneno a cada jogada
const RAGE_DMG = 1.25;
const POTION_HEAL = 50;
const TRAP_MOVES = 3;         // jogadas extras da Armadilha
const BONUS_CHANCE = 0.03;    // chance de uma peça nova vir com "+1 jogada"
const DRAGON_CHARGE = 30;     // peças de Dragão para encher o especial (dividido pelo gaugePerTile da arma)
const HINT_AFTER = 6;         // segundos parado até mostrar uma dica

// ---- Utilidades ----------------------------------------------------------------
const $ = (id) => document.getElementById(id);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (n) => Math.floor(Math.random() * n);
const randKey = () => rand(ELEMENTS.length);
const inBounds = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
let uid = 0;
const newTile = (key, extra = {}) => ({ id: ++uid, key, special: null, burn: false, fall: 0, ...extra });
const isRock = (t) => t.key < 0;
const swappable = (t) => t && !isRock(t) && !t.burn;

function centerOf(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function restartAnim(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth; // força reflow para a animação recomeçar
  el.classList.add(cls);
}

// ---- Progresso salvo -------------------------------------------------------------
const SAVE_KEY = 'puzzle-hunt-v2';
function loadSave() {
  const base = { stars: {}, mats: {}, kills: {}, weapons: [...STARTER_WEAPONS], equipped: 'gs', muted: false };
  let save;
  try { save = { ...base, ...JSON.parse(localStorage.getItem(SAVE_KEY)) }; } catch { save = base; }
  for (const id of STARTER_WEAPONS) if (!save.weapons.includes(id)) save.weapons.push(id);
  if (!WEAPONS[save.equipped]) save.equipped = 'gs';
  return save;
}
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(SAVE)); } catch { /* sem storage: segue sem salvar */ }
  syncCloud();
}

// ---- Perfil na nuvem (opcional: só com login Google, veja js/cloud.js) --------------------
// Nome e foto vêm da conta Google: escapados antes de entrar no HTML.
const esc = (t) => String(t).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
const totalKills = () => Object.values(SAVE.kills).reduce((a, b) => a + b, 0);

// Envia o progresso para o perfil, agrupando várias mudanças seguidas num envio só.
let syncTimer = 0;
function syncCloud() {
  if (!window.Cloud || !Cloud.user()) return;
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    const { stars, mats, kills, weapons, equipped } = SAVE;
    Cloud.save({ stars, mats, kills, weapons, equipped, totalKills: totalKills() })
      .catch((e) => console.warn('Não foi possível salvar o perfil:', e));
  }, 800);
}

// Ao entrar, junta o que já existe no aparelho com o perfil da nuvem (fica o maior de cada um).
function mergeProfile(cloud) {
  if (!cloud) return;
  const maxOf = (a = {}, b = {}) => {
    const out = { ...a };
    for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] || 0, v);
    return out;
  };
  SAVE.stars = maxOf(SAVE.stars, cloud.stars);
  SAVE.kills = maxOf(SAVE.kills, cloud.kills);
  SAVE.mats = maxOf(SAVE.mats, cloud.mats);
  SAVE.weapons = [...new Set([...SAVE.weapons, ...(cloud.weapons || [])])].filter((id) => WEAPONS[id]);
  if (cloud.equipped && SAVE.weapons.includes(cloud.equipped)) SAVE.equipped = cloud.equipped;
}
const SAVE = loadSave();

// ---- Estado da caçada ------------------------------------------------------------
let S = null;
let cellEls = [];

function startQuest(qi) {
  const q = QUESTS[qi];
  S = {
    qi, q, weapon: WEAPONS[SAVE.equipped],
    board: makeBoard(),
    monsterHp: q.hp, hunterHp: HUNTER_MAX_HP, carts: 0, moves: q.moves, movesUsed: 0,
    patternIdx: 0, stunned: false, poisonTurns: 0, roarT: 0, roarPenalty: 0, buffMoves: 0, buffMult: 1,
    idleT: 0, special: 0, charge: POWERS.map((pw) => pw.goal), armed: null, selected: null, drag: null,
    busy: false, paused: false, over: false, started: false, raged: false,
    stats: { maxCombo: 0, weakPoints: 0, dmg: 0 },
  };
  showScreen('game');
  for (const id of ['result', 'pause']) $(id).classList.add('hidden');
  $('quest-title').textContent = q.place;
  $('habitat').innerHTML = habitatHTML(q.habitat, true);
  $('ambient').innerHTML = ambientHTML(q.habitat);
  $('monster-sprite').innerHTML = monsterHTML(q.id);
  $('monster-sprite').className = 'has-img';
  $('hunter-sprite').innerHTML = hunterHTML(SAVE.equipped);
  $('hunter-sprite').className = '';
  $('monster-name').textContent = q.monster;
  const icon = (k) => `<img class="chip-icon" src="${pixelTile({ key: k, special: null })}" alt="">`;
  const chips = (list) => list.map((k) => `<span class="chip" style="--c:${ELEMENTS[k].mid}">${icon(k)}${ELEMENTS[k].name}</span>`).join('');
  $('weak').innerHTML = `<span>Fraco</span>${chips(q.weak)}${q.resist.length ? `<span>Resiste</span>${chips(q.resist)}` : ''}`;
  $('special-icon').innerHTML = uiIcon(SAVE.equipped);
  renderCounters();
  render();
  updateHud();
  showIntro();
}

function showIntro() {
  const q = S.q;
  const first = S.qi === 0;
  $('intro-art').innerHTML = monsterHTML(q.id);
  $('intro-title').textContent = q.monster;
  $('intro-place').textContent = `${q.place} · ${q.moves} jogadas por ataque`;
  $('intro-tips').innerHTML = first
    ? `<li>Arraste uma peça para o lado para <b>trocar</b> com a vizinha e alinhar 3 iguais.</li>
       <li>Cada combinação gasta uma <b>jogada</b>; quando acabam, o monstro <b>ataca</b>. Peças com <b>+1</b> devolvem jogadas.</li>
       <li>Use o elemento da <b>fraqueza</b> do monstro: dano dobrado.</li>
       <li>Cada elemento carrega um <b>poder</b> nos contadores; Dragão carrega o <b>especial</b> da arma.</li>`
    : `<li>Fraco a <b>${q.weak.map((k) => ELEMENTS[k].name).join(' e ')}</b>${q.resist.length ? `, resiste a <b>${q.resist.map((k) => ELEMENTS[k].name).join(', ')}</b>` : ''}.</li>
       <li>Ataques: ${[...new Set(q.pattern)].map((a) => ATTACKS[a].name).join(', ')}.</li>`;
  $('intro').classList.remove('hidden');
}

function makeBoard() {
  const b = [];
  for (let r = 0; r < ROWS; r++) {
    b.push([]);
    for (let c = 0; c < COLS; c++) {
      let key;
      do {
        key = randKey();
      } while (
        (c >= 2 && b[r][c - 1].key === key && b[r][c - 2].key === key) ||
        (r >= 2 && b[r - 1][c].key === key && b[r - 2][c].key === key)
      );
      b[r].push(newTile(key));
    }
  }
  return b;
}

// ---- Regras do tabuleiro -----------------------------------------------------------
function findGroups(b) {
  const mark = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const same = (r1, c1, r2, c2) => b[r1][c1] && b[r2][c2] && b[r1][c1].key >= 0 && b[r1][c1].key === b[r2][c2].key;

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS;) {
      let e = c + 1;
      while (e < COLS && same(r, c, r, e)) e++;
      if (e - c >= 3) for (let k = c; k < e; k++) mark[r][k] = true;
      c = e;
    }
  }
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS;) {
      let e = r + 1;
      while (e < ROWS && same(r, c, e, c)) e++;
      if (e - r >= 3) for (let k = r; k < e; k++) mark[k][c] = true;
      r = e;
    }
  }

  // Junta peças marcadas vizinhas do mesmo elemento (L e T contam como um grupo só).
  const seen = Array.from({ length: ROWS }, () => Array(COLS).fill(false));
  const groups = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!mark[r][c] || seen[r][c]) continue;
      const key = b[r][c].key;
      const cells = [];
      const stack = [[r, c]];
      seen[r][c] = true;
      while (stack.length) {
        const [cr, cc] = stack.pop();
        cells.push([cr, cc]);
        for (const [dr, dc] of DIRS) {
          const nr = cr + dr, nc = cc + dc;
          if (inBounds(nr, nc) && mark[nr][nc] && !seen[nr][nc] && b[nr][nc].key === key) {
            seen[nr][nc] = true;
            stack.push([nr, nc]);
          }
        }
      }
      const horizontal = cells.every(([cr]) => cr === cells[0][0]);
      const vertical = cells.every(([, cc]) => cc === cells[0][1]);
      groups.push({ key, cells, horizontal, vertical });
    }
  }
  return groups;
}

function swapData(a, b) {
  const t = S.board[a[0]][a[1]];
  S.board[a[0]][a[1]] = S.board[b[0]][b[1]];
  S.board[b[0]][b[1]] = t;
}

// Procura uma troca que forme combinação (para dicas e para detectar tabuleiro travado).
function findValidMove() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const a = [r, c], b = [r + dr, c + dc];
        if (!inBounds(b[0], b[1])) continue;
        if (!swappable(S.board[r][c]) || !swappable(S.board[b[0]][b[1]])) continue;
        swapData(a, b);
        const ok = findGroups(S.board).length > 0;
        swapData(a, b);
        if (ok) return [a, b];
      }
    }
  }
  return null;
}

async function reshuffleIfStuck() {
  if (findValidMove()) return;
  toast('Sem jogadas! Embaralhando...');
  await sleep(500);
  for (let tries = 0; ; tries++) {
    // Com pedras e peças queimadas demais pode não existir arranjo jogável: depois de algumas
    // tentativas elas também são desfeitas, para o embaralhamento sempre terminar.
    const freeAll = tries >= 20;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = S.board[r][c];
      if (freeAll && isRock(t)) S.board[r][c] = newTile(randKey());
      else if (!isRock(t) && !t.special) t.key = randKey();
      if (freeAll) S.board[r][c].burn = false;
    }
    if (!findGroups(S.board).length && findValidMove()) break;
  }
  render();
}

function elemMult(key) {
  if (S.q.weak.includes(key)) return S.weapon.weakMult;
  if (S.q.resist.includes(key)) return 0.5;
  return 1;
}

// Remove peças, calcula o dano e aplica a gravidade. `creates` vira peça especial no lugar.
// `charges` = false para peças destruídas por poderes/especiais: só combinações enchem os contadores.
async function clearCells(cells, cascade, creates = [], flat = 0, charges = true) {
  const idx = (r, c) => r * COLS + c;
  const set = new Map();
  const add = (r, c) => {
    if (!inBounds(r, c) || set.has(idx(r, c))) return false;
    set.set(idx(r, c), [r, c]);
    return true;
  };
  cells.forEach(([r, c]) => add(r, c));

  // Peças especiais atingidas detonam (e podem encadear outras).
  const queue = [...set.values()];
  let weakPoints = 0, lines = 0;
  while (queue.length) {
    const [r, c] = queue.pop();
    const t = S.board[r][c];
    if (!t || !t.special || t.fired) continue;
    t.fired = true;
    const area = [];
    if (t.special === 'line-h') { lines++; for (let cc = 0; cc < COLS; cc++) area.push([r, cc]); }
    else if (t.special === 'line-v') { lines++; for (let rr = 0; rr < ROWS; rr++) area.push([rr, c]); }
    else { weakPoints++; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) area.push([r + dr, c + dc]); }
    for (const [ar, ac] of area) if (add(ar, ac)) queue.push([ar, ac]);
  }
  // Pedras vizinhas de qualquer peça destruída racham junto.
  for (const [r, c] of [...set.values()]) {
    for (const [dr, dc] of DIRS) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc) && isRock(S.board[nr][nc])) add(nr, nc);
    }
  }

  const w = S.weapon;
  let raw = 0, tiles = 0, weakHit = false, resistHit = false, color = '#fff';
  for (const [r, c] of set.values()) {
    const t = S.board[r][c];
    if (isRock(t)) continue;
    const m = elemMult(t.key);
    if (m > 1) { weakHit = true; color = ELEMENTS[t.key].glow; }
    if (m < 1) resistHit = true;
    raw += BASE_DMG * m;
    tiles++;
  }
  let dmg = raw * w.dmgMult * (1 + w.comboStep * (cascade - 1))
    + weakPoints * WEAK_POINT_BONUS * w.weakPointMult + lines * LINE_BONUS * w.lineMult + flat;
  if (S.buffMoves > 0) dmg *= S.buffMult;
  dmg = Math.round(dmg);
  S.stats.weakPoints += weakPoints;
  // Contadores por elemento (poderes), especial pelas peças de Dragão e jogadas das peças "+1".
  let bonus = 0;
  for (const [r, c] of set.values()) {
    const t = S.board[r][c];
    if (isRock(t)) continue;
    const pi = POWERS.findIndex((pw) => pw.key === t.key);
    if (charges && pi >= 0) S.charge[pi] = Math.max(0, S.charge[pi] - 1);
    if (charges && t.key === DRAGON) S.special = Math.min(100, S.special + (100 * w.gaugePerTile) / DRAGON_CHARGE);
    bonus += t.bonus || 0;
  }
  if (bonus) {
    S.moves += bonus;
    floatText(`+${bonus} jogada${bonus > 1 ? 's' : ''}`, 'heal', $('hunter-sprite'));
  }
  if (w.healPerTile && tiles) S.hunterHp = Math.min(HUNTER_MAX_HP, S.hunterHp + tiles * w.healPerTile);
  if (cascade === 1 && tiles) hunterStrike();

  // Efeitos: cada peça solta faíscas e manda uma bola de energia no monstro.
  const target = centerOf($('monster-sprite'));
  let orbs = 0;
  for (const [r, c] of set.values()) {
    const t = S.board[r][c];
    const p = centerOf(cellEls[r][c]);
    const col = isRock(t) ? '#a8a29a' : ELEMENTS[t.key].glow;
    FX.burst(p.x, p.y, col, 7, 160);
    if (!isRock(t) && orbs < 14) FX.orb(p.x, p.y, target.x, target.y, col, orbs++ * 0.025);
    tileEl(r, c).classList.add('clearing');
  }
  SFX.match(cascade);
  if (weakPoints || lines || flat) SFX.boom();
  if (cascade > 1) showCombo(cascade);
  await sleep(240);

  for (const [r, c] of set.values()) S.board[r][c] = null;
  for (const cr of creates) S.board[cr.r][cr.c] = newTile(cr.key, { special: cr.special });

  const tags = [];
  if (weakPoints) tags.push('PONTO FRACO!');
  if (weakHit) tags.push('Fraqueza!');
  else if (resistHit) tags.push('Resistiu...');
  if (dmg > 0) hitMonster(dmg, tags.join(' '), color);

  gravity();
  render();
  await sleep(260);
}

async function resolveCascades(preferred = []) {
  let cascade = 0;
  for (;;) {
    const groups = findGroups(S.board);
    if (!groups.length) break;
    cascade++;
    const cells = [];
    const creates = [];
    for (const g of groups) {
      cells.push(...g.cells);
      let special = null;
      if (g.cells.length >= 5) special = 'weak';
      else if (g.cells.length === 4) special = g.horizontal ? 'line-h' : 'line-v';
      if (special) {
        const p = g.cells.find(([r, c]) => preferred.some(([pr, pc]) => pr === r && pc === c))
          || g.cells[Math.floor(g.cells.length / 2)];
        creates.push({ r: p[0], c: p[1], key: g.key, special });
      }
    }
    await clearCells(cells, cascade, creates);
    preferred = [];
    if (S.monsterHp <= 0) break;
  }
  S.stats.maxCombo = Math.max(S.stats.maxCombo, cascade);
}

function gravity() {
  for (let c = 0; c < COLS; c++) {
    let write = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      const t = S.board[r][c];
      if (!t) continue;
      if (r !== write) {
        S.board[write][c] = t;
        S.board[r][c] = null;
        t.fall = write - r;
      }
      write--;
    }
    const spawned = write + 1;
    for (let r = write; r >= 0; r--) {
      S.board[r][c] = newTile(randKey(), Math.random() < BONUS_CHANCE ? { bonus: 1 } : {});
      S.board[r][c].fall = spawned;
    }
  }
}

// ---- Ações do jogador ----------------------------------------------------------------
const canAct = () => S && S.started && !S.busy && !S.over && !S.paused && S.roarT <= 0;

async function animateSwap(a, b) {
  const ea = tileEl(a[0], a[1]), eb = tileEl(b[0], b[1]);
  const dx = b[1] - a[1], dy = b[0] - a[0];
  const move = (x, y) => `translate(calc(${x} * (100% + var(--gap))), calc(${y} * (100% + var(--gap))))`;
  for (const el of [ea, eb]) el.style.transition = 'transform .15s ease-in-out';
  ea.style.transform = move(dx, dy);
  eb.style.transform = move(-dx, -dy);
  ea.style.zIndex = 2;
  await sleep(160);
  for (const el of [ea, eb]) {
    el.style.transition = 'none';
    el.style.transform = '';
    el.style.zIndex = '';
  }
}

async function trySwap(a, b) {
  if (!swappable(S.board[a[0]][a[1]]) || !swappable(S.board[b[0]][b[1]])) {
    SFX.bad();
    restartAnim(tileEl(a[0], a[1]), 'nope');
    toast('Peça presa! Destrua o que está ao lado.');
    return;
  }
  S.busy = true;
  setSelected(null);
  clearHint();
  SFX.swap();
  await animateSwap(a, b);
  swapData(a, b);
  render();
  if (findGroups(S.board).length) {
    await resolveCascades([b, a]);
    await endTurn();
  } else {
    SFX.bad();
    await animateSwap(a, b);
    swapData(a, b);
    render();
  }
  S.busy = false;
  await afterAction();
}

// Cada combinação gasta uma jogada; quando elas acabam, o monstro ataca e as jogadas recomeçam.
async function endTurn() {
  S.moves--;
  S.movesUsed++;
  if (S.buffMoves > 0) S.buffMoves--;
  if (S.monsterHp <= 0) return; // a vitória vale antes do veneno desta jogada
  if (S.poisonTurns > 0) {
    S.poisonTurns--;
    hurtHunter(POISON_PER_MOVE);
  }
  if (S.over || S.monsterHp <= 0) return;
  if (S.moves <= 0) {
    await monsterAttack();
    S.moves = Math.max(2, baseMoves() - S.roarPenalty);
    S.roarPenalty = 0;
    S.stunned = false;
  }
  updateHud();
}

async function afterAction() {
  S.idleT = 0;
  if (S.monsterHp <= 0 && !S.over) return finish(true);
  if (!S.over) {
    S.busy = true;
    await reshuffleIfStuck();
    S.busy = false;
  }
  updateHud();
}

const resetPower = (id) => {
  const i = POWERS.findIndex((pw) => pw.id === id);
  S.charge[i] = POWERS[i].goal;
};

// Poderes carregados pelos contadores de elemento. Usar um poder não gasta jogada.
async function usePower(i) {
  const pw = POWERS[i];
  if (!canAct() || S.charge[i] > 0) return;
  if (pw.target) {
    S.armed = S.armed === pw.id ? null : pw.id;
    if (S.armed) toast(pw.tip);
    updateHud();
    return;
  }
  resetPower(pw.id);
  if (pw.id === 'trap') {
    const ms = centerOf($('monster-sprite'));
    S.moves += TRAP_MOVES;
    S.stunned = true;
    SFX.special();
    FX.burst(ms.x, ms.y, '#ffe066', 30, 260);
    FX.ring(ms.x, ms.y, '#ffe066');
    toast(`${S.q.monster} caiu na armadilha! +${TRAP_MOVES} jogadas`);
  } else if (pw.id === 'potion') {
    heal(POTION_HEAL * S.weapon.potionMult);
  }
  updateHud();
}

function heal(amount) {
  S.hunterHp = Math.min(HUNTER_MAX_HP, S.hunterHp + amount);
  S.poisonTurns = 0;
  SFX.heal();
  const hp = centerOf($('hunter-sprite'));
  FX.burst(hp.x, hp.y, '#3fd17a', 24, 180);
  floatText(`+${amount}`, 'heal', $('hunter-sprite'));
}

// Bônus de dano que dura algumas jogadas.
function buff(moves, mult) {
  S.buffMoves = moves;
  S.buffMult = mult;
}

// Animação do caçador atacando: corte para armas brancas, tiro para as de longa distância.
function hunterStrike() {
  const sprite = $('hunter-sprite');
  const from = centerOf(sprite);
  const to = centerOf($('monster-sprite'));
  if (S.weapon.ranged) {
    restartAnim(sprite, 'shoot');
    FX.orb(from.x + 10, from.y - 10, to.x, to.y, '#fff3c4', 0, 5);
  } else {
    restartAnim(sprite, 'strike');
    FX.slash(to.x - 10, to.y, '#ffe9a8', 50 + Math.random() * 20);
  }
}

// Casas atingidas pelo especial de cada arma com alvo (r, c = peça tocada).
function specialArea(id, r, c) {
  const cells = [];
  const all = (fn) => { for (let rr = 0; rr < ROWS; rr++) for (let cc = 0; cc < COLS; cc++) if (fn(rr, cc)) cells.push([rr, cc]); };
  const key = S.board[r][c].key;
  switch (id) {
    case 'gs': all((rr) => rr === r || rr === r + 1); break;
    case 'sns': all((rr, cc) => rr === r || cc === c); break;
    case 'ls': all((rr, cc) => cc === c); break;
    case 'hammer': all((rr, cc) => Math.abs(rr - r) <= 1 && Math.abs(cc - c) <= 1); break;
    case 'lance': all((rr) => rr === r); break;
    case 'ig': all((rr, cc) => Math.max(Math.abs(rr - r), Math.abs(cc - c)) === 2 || (rr === r && cc === c)); break;
    case 'sa': all((rr, cc) => Math.abs(rr - r) === Math.abs(cc - c)); break;
    case 'gl': all((rr, cc) => Math.abs(rr - r) + Math.abs(cc - c) <= 2); break;
    case 'cb': all((rr, cc) => S.board[rr][cc].key === key && key >= 0); break;
    case 'hbg': all((rr, cc) => Math.abs(cc - c) <= 1); break;
  }
  return cells;
}

// Efeitos extras do especial (além de destruir as casas).
const SPECIAL_FLAT = { gs: 40, sns: 30, ls: 30, hammer: 40, lance: 30, ig: 40, sa: 60, gl: 80, cb: 40, hbg: 30 };
function specialExtras(id) {
  if (id === 'sns') heal(30);
  if (id === 'ls') buff(3, 1.3);
  if (id === 'hammer') { S.moves += 2; S.stunned = true; }
  if (id === 'lance') S.moves = Math.max(S.moves, baseMoves());
}

async function useSpecial() {
  if (!canAct() || S.special < 100) return;
  const w = S.weapon;
  if (w.specialTarget) {
    S.armed = S.armed === 'special' ? null : 'special';
    if (S.armed) toast(w.specialTip);
    updateHud();
    return;
  }
  S.busy = true;
  S.special = 0;
  SFX.special();
  showCombo(w.special, true);
  if (w.id === 'db') {
    buff(4, 2);
  } else if (w.id === 'hh') {
    heal(40);
    buff(3, 1.5);
    const hp = centerOf($('hunter-sprite'));
    FX.ring(hp.x, hp.y, '#9feaff', 200, 0.8);
  } else if (w.id === 'lbg') {
    const pool = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) pool.push([r, c]);
    const shots = [];
    for (let i = 0; i < 12; i++) shots.push(pool.splice(rand(pool.length), 1)[0]);
    const hp = centerOf($('hunter-sprite'));
    shots.forEach(([r, c], i) => {
      const p = centerOf(cellEls[r][c]);
      FX.orb(hp.x, hp.y, p.x, p.y, '#fff3c4', i * 0.03, 4);
    });
    await sleep(400);
    await clearCells(shots, 1, [], 30, false);
    if (S.monsterHp > 0) await resolveCascades();
  } else if (w.id === 'bow') {
    // As flechas caem em trios horizontais (em 3 linhas diferentes) do elemento fraco,
    // então sempre geram combinações na hora.
    const key = S.q.weak[0];
    const hp = centerOf($('hunter-sprite'));
    const ms = centerOf($('monster-sprite'));
    const rows = [...Array(ROWS).keys()].sort(() => Math.random() - 0.5).slice(0, 3);
    let i = 0;
    for (const r of rows) {
      const c0 = rand(COLS - 2);
      for (let c = c0; c < c0 + 3; c++) {
        const t = S.board[r][c];
        if (isRock(t)) continue;
        t.key = key;
        const p = centerOf(cellEls[r][c]);
        FX.orb(hp.x, hp.y, p.x, p.y, ELEMENTS[key].glow, i * 0.04);
        FX.orb(hp.x, hp.y, ms.x, ms.y, ELEMENTS[key].glow, i++ * 0.04, 4);
      }
    }
    await sleep(450);
    hitMonster(Math.round(BASE_DMG * 10 * w.weakMult), 'Chuva de Flechas!', ELEMENTS[key].glow);
    render();
    await sleep(150);
    await resolveCascades();
  }
  S.busy = false;
  await afterAction();
}

async function applyTarget(r, c) {
  const kind = S.armed;
  if (kind === 'flash' && S.board[r][c].key < 0) {
    toast('Toque numa peça de elemento, não numa pedra.');
    return; // o poder continua armado
  }
  S.armed = null;
  S.busy = true;
  updateHud();
  const p = centerOf(cellEls[r][c]);
  let cells = [];
  let flat = 0;
  if (kind === 'bomb') {
    resetPower('bomb');
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) cells.push([r + dr, c + dc]);
    flat = 50;
    FX.burst(p.x, p.y, '#ffb03a', 40, 320);
    FX.ring(p.x, p.y, '#ff7a1a', 120);
    restartAnim($('app'), 'shake-l');
  } else if (kind === 'flash') {
    resetPower('flash');
    const key = S.board[r][c].key;
    for (let rr = 0; rr < ROWS; rr++) for (let cc = 0; cc < COLS; cc++) if (key >= 0 && S.board[rr][cc].key === key) cells.push([rr, cc]);
    SFX.special();
    FX.ring(p.x, p.y, '#fff7b0', 220, 0.7);
    restartAnim($('vignette'), 'flash');
  } else if (kind === 'special') {
    const id = S.weapon.id;
    S.special = 0;
    SFX.special();
    showCombo(S.weapon.special, true);
    cells = specialArea(id, r, c);
    flat = SPECIAL_FLAT[id] || 0;
    specialExtras(id);
    hunterStrike();
    FX.ring(p.x, p.y, '#fff', 160);
    restartAnim($('app'), 'shake-l');
  }
  cells = cells.filter(([cr, cc]) => inBounds(cr, cc));
  await clearCells(cells, 1, [], flat, false);
  if (S.monsterHp > 0) await resolveCascades();
  S.busy = false;
  await afterAction();
}

// ---- Monstro -----------------------------------------------------------------------------
const isEnraged = () => S.monsterHp <= S.q.hp / 2;
// Enfurecido, o monstro ataca uma jogada mais cedo.
const baseMoves = () => S.q.moves - (isEnraged() ? 1 : 0);
const nextAttack = () => ATTACKS[S.q.pattern[S.patternIdx % S.q.pattern.length]];

function hitMonster(dmg, tag, color) {
  S.monsterHp = Math.max(0, S.monsterHp - dmg);
  S.stats.dmg += dmg;
  restartAnim($('monster-sprite'), 'hit');
  SFX.hit();
  floatText(`${dmg}`, dmg >= 150 ? 'dmg big' : 'dmg', $('monster-sprite'), color);
  if (tag) floatText(tag, 'tag', $('monster-sprite'));
  if (dmg >= 150) restartAnim($('app'), 'shake-s');
  if (!S.raged && isEnraged() && S.monsterHp > 0) {
    S.raged = true;
    SFX.roar();
    toast(`${S.q.monster} ficou enfurecido!`);
  }
  updateHud();
}

async function monsterAttack() {
  S.busy = true;
  setSelected(null);
  clearHint();
  const atk = nextAttack();
  S.patternIdx++;
  const sprite = $('monster-sprite');
  const ms = centerOf(sprite);
  toast(`${atk.icon} ${atk.name}!`);
  restartAnim(sprite, atk.kind === 'roar' ? 'roaring' : 'lunge');
  await sleep(300);

  if (atk.kind === 'roar') {
    SFX.roar();
    FX.ring(ms.x, ms.y, '#fff', 260, 0.8);
    FX.ring(ms.x, ms.y, '#fff', 200, 0.6);
    restartAnim($('app'), 'shake-l');
    S.roarT = 1.2;
    S.roarPenalty = 1;
    toast('Rugido! Uma jogada a menos na próxima rodada.');
  } else if (atk.kind === 'burn' || atk.kind === 'rock') {
    const pool = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const t = S.board[r][c];
      if (!isRock(t) && !t.special && !t.burn) pool.push([r, c]);
    }
    const hits = [];
    for (let i = 0; i < atk.count && pool.length; i++) hits.push(pool.splice(rand(pool.length), 1)[0]);
    const col = atk.kind === 'burn' ? '#ff7a1a' : '#a8a29a';
    hits.forEach(([r, c], i) => {
      const p = centerOf(cellEls[r][c]);
      FX.orb(ms.x, ms.y, p.x, p.y, col, i * 0.05, 9);
    });
    if (atk.kind === 'burn') SFX.fire();
    await sleep(500);
    for (const [r, c] of hits) {
      if (atk.kind === 'burn') S.board[r][c].burn = true;
      else S.board[r][c] = newTile(-1);
    }
    render();
  } else if (atk.kind === 'poison') {
    S.poisonTurns = atk.turns;
    const hp = centerOf($('hunter-sprite'));
    FX.orb(ms.x, ms.y, hp.x, hp.y, '#b45fd0', 0, 10);
    FX.burst(hp.x, hp.y, '#b45fd0', 20, 120);
  }

  const dmg = Math.round(S.q.dmg * atk.dmg * (isEnraged() ? RAGE_DMG : 1) * (1 - S.weapon.guard));
  if (dmg > 0) {
    SFX.hurt();
    restartAnim($('hunter-sprite'), 'knock');
    restartAnim($('vignette'), 'flash');
    restartAnim($('app'), 'shake-s');
    hurtHunter(dmg);
  }
  await sleep(350);
  S.busy = false;
  if (!S.over) await afterAction();
}

function hurtHunter(amount, silent = false) {
  if (S.over) return;
  S.hunterHp -= amount;
  if (!silent) floatText(`-${Math.round(amount)}`, 'hurt', $('hunter-sprite'));
  if (S.hunterHp <= 0) {
    S.carts++;
    S.poisonTurns = 0;
    if (S.carts >= MAX_CARTS) {
      finish(false, `Você desmaiou ${MAX_CARTS} vezes.`);
      return;
    }
    S.hunterHp = HUNTER_MAX_HP;
    toast('Você desmaiou! Os Felynes te levaram de volta.', 2200);
  }
  updateHud();
}

function rollDrops(q, stars) {
  const total = q.drops.reduce((s, [, w]) => s + w, 0);
  const got = {};
  for (let i = 0; i < 1 + stars; i++) {
    let roll = Math.random() * total;
    const [name] = q.drops.find(([, w]) => (roll -= w) < 0);
    got[name] = (got[name] || 0) + 1;
  }
  return got;
}

function finish(win, reason = '') {
  S.over = true;
  S.armed = null;
  updateHud();
  const stars = win ? MAX_CARTS - S.carts : 0;
  let drops = {};
  if (win) {
    SFX.win();
    restartAnim($('monster-sprite'), 'dying');
    drops = rollDrops(S.q, stars);
    SAVE.stars[S.q.id] = Math.max(SAVE.stars[S.q.id] || 0, stars);
    SAVE.kills[S.q.id] = (SAVE.kills[S.q.id] || 0) + 1;
    for (const [m, n] of Object.entries(drops)) SAVE.mats[m] = (SAVE.mats[m] || 0) + n;
    persist();
  } else {
    SFX.fail();
  }
  setTimeout(() => {
    $('result-title').textContent = win ? 'Missão concluída!' : 'Missão falhou';
    $('result-stars').innerHTML = [0, 1, 2].map((i) => `<span class="${i < stars ? 'on' : ''}">★</span>`).join('');
    $('result-text').textContent = win
      ? `${S.q.monster} abatido em ${S.movesUsed} jogadas · maior combo x${S.stats.maxCombo} · ${S.stats.weakPoints} pontos fracos`
      : reason;
    $('result-drops').innerHTML = Object.entries(drops).map(([m, n]) =>
      `<div class="drop">${materialSVG(MATERIALS[m])}<span>${m}</span><b>x${n}</b></div>`).join('');
    $('btn-next').classList.toggle('hidden', !win || S.qi >= QUESTS.length - 1);
    $('result').classList.remove('hidden');
  }, win ? 1300 : 700);
}

// ---- Laço de animação (efeitos, fim do rugido e dicas) -------------------------------------
let lastT = 0;
function frame(now) {
  const dt = Math.min(0.05, (now - lastT) / 1000 || 0);
  lastT = now;
  if (S && S.started && !S.over && !S.paused) tick(dt);
  FX.update(dt);
  requestAnimationFrame(frame);
}

function tick(dt) {
  if (S.roarT > 0) {
    S.roarT -= dt;
    if (S.roarT <= 0) updateHud();
  }
  if (S.busy) return;
  S.idleT += dt;
  if (S.idleT >= HINT_AFTER && !document.querySelector('.tile.hint')) showHint();
}

// ---- Renderização -------------------------------------------------------------------------
function buildBoard() {
  const board = $('board');
  board.innerHTML = '';
  cellEls = [];
  for (let r = 0; r < ROWS; r++) {
    cellEls.push([]);
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.r = r;
      cell.dataset.c = c;
      const tile = document.createElement('div');
      tile.className = 'tile';
      cell.appendChild(tile);
      board.appendChild(cell);
      cellEls[r].push(cell);
    }
  }
}

const tileEl = (r, c) => cellEls[r][c].firstChild;

function render() {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const t = S.board[r][c];
      const el = tileEl(r, c);
      const sig = `${t.key}|${t.special}|${t.bonus || 0}`;
      if (el.dataset.sig !== sig) {
        el.innerHTML = tileHTML(t);
        el.dataset.sig = sig;
      }
      el.className = 'tile' + (t.burn ? ' burn' : '') + (t.special ? ` sp-${t.special}` : '') + (isRock(t) ? ' rock' : '');
      if (t.fall) {
        el.style.setProperty('--fall', t.fall);
        restartAnim(el, 'drop');
        t.fall = 0;
      }
    }
  }
  if (S.selected) cellEls[S.selected[0]][S.selected[1]].classList.add('selected');
}

let hudCache = {};
function setText(id, text) {
  if (hudCache[id] !== text) { $(id).textContent = text; hudCache[id] = text; }
}

function updateHud() {
  $('monster-hp').style.width = `${(S.monsterHp / S.q.hp) * 100}%`;
  $('monster-hp-lag').style.width = `${(S.monsterHp / S.q.hp) * 100}%`;
  setText('hp-left', `${Math.max(0, Math.ceil(S.monsterHp))}`);
  $('hunter-hp').style.width = `${Math.max(0, S.hunterHp / HUNTER_MAX_HP) * 100}%`;
  setText('hunter-hp-text', `${Math.max(0, Math.ceil(S.hunterHp))}`);
  $('carts').innerHTML = [0, 1, 2].map((i) => `<i class="${i < S.carts ? 'down' : ''}">♥</i>`).join('');
  $('hunter-hud').classList.toggle('poisoned', S.poisonTurns > 0);

  const enraged = isEnraged() && S.monsterHp > 0;
  const danger = S.moves <= 1 && !S.stunned;
  $('rage').classList.toggle('hidden', !enraged);
  $('stun').classList.toggle('hidden', !S.stunned);
  $('monster-sprite').classList.toggle('enraged', enraged);
  $('monster-sprite').classList.toggle('stunned', S.stunned);
  $('monster-sprite').classList.toggle('windup', danger);

  const atk = nextAttack();
  setText('next-attack', S.stunned ? '💫 Preso!' : `Próximo: ${atk.icon} ${atk.name}`);
  $('telegraph').classList.toggle('danger', danger);
  setText('moves', String(S.moves));
  $('moves-box').classList.toggle('low', danger);

  POWERS.forEach((pw, i) => {
    const el = $(`counter-${i}`);
    setText(`counter-n-${i}`, S.charge[i] > 0 ? String(S.charge[i]) : 'PRONTO!');
    el.classList.toggle('ready', S.charge[i] === 0);
    el.classList.toggle('armed', S.armed === pw.id);
  });

  $('board').classList.toggle('locked', S.roarT > 0);
  $('board').classList.toggle('armed', !!S.armed);
  $('board-wrap').classList.toggle('buffed', S.buffMoves > 0);

  const sp = $('btn-special');
  sp.style.setProperty('--fill', `${S.special}%`);
  sp.classList.toggle('ready', S.special >= 100);
  sp.classList.toggle('armed', S.armed === 'special');
}

// Monta os contadores de elemento da linha de poderes (uma vez por caçada).
function renderCounters() {
  hudCache = {};
  POWERS.forEach((pw, i) => {
    const el = $(`counter-${i}`);
    el.title = pw.tip;
    el.innerHTML = `<span class="cnt-top"><img class="chip-icon" src="${pixelTile({ key: pw.key, special: null })}" alt=""><b id="counter-n-${i}"></b></span>
      <span class="cnt-power">${uiIcon(pw.id)}<small>${pw.name}</small></span>`;
  });
}

function floatText(text, cls, anchor, color) {
  const stage = $('stage');
  const a = anchor.getBoundingClientRect();
  const s = stage.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = `float ${cls}`;
  el.textContent = text;
  el.style.left = `${a.left - s.left + a.width / 2 + (Math.random() - 0.5) * 40}px`;
  el.style.top = `${a.top - s.top + a.height * (cls === 'tag' ? 0.15 : 0.35)}px`;
  if (color) el.style.color = color;
  stage.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}

function showCombo(n, isName = false) {
  const el = $('combo-text');
  el.textContent = isName ? n : `COMBO x${n}`;
  restartAnim(el, 'show');
}

let toastTimer = 0;
function toast(text, ms = 1500) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

function setSelected(pos) {
  if (S.selected) cellEls[S.selected[0]][S.selected[1]].classList.remove('selected');
  S.selected = pos;
  if (pos) cellEls[pos[0]][pos[1]].classList.add('selected');
}

function showHint() {
  const mv = findValidMove();
  if (mv) for (const [r, c] of mv) tileEl(r, c).classList.add('hint');
}
function clearHint() {
  document.querySelectorAll('.tile.hint').forEach((el) => el.classList.remove('hint'));
}

// ---- Telas: quadro de missões e forja ------------------------------------------------------
function showScreen(name) {
  $('hub').classList.toggle('hidden', name !== 'hub');
  $('game').classList.toggle('hidden', name !== 'game');
  if (name === 'hub') renderHub();
}

function renderHub() {
  const w = WEAPONS[SAVE.equipped];
  $('equip-card').innerHTML = `<div class="eq-icon">${uiIcon(w.id)}</div>
    <div><div class="eq-name">${w.name}</div><div class="eq-desc">${w.passive}<br>Especial: <b>${w.special}</b></div></div>`;
  $('btn-mute').textContent = SAVE.muted ? '🔇' : '🔊';
  const u = window.Cloud && Cloud.user();
  $('btn-profile').innerHTML = u
    ? `${u.photoURL ? `<img class="avatar" src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer">` : '👤'}<span>${esc((u.displayName || 'Perfil').split(' ')[0])}</span>`
    : '👤 <span>Perfil</span>';

  const list = $('quest-list');
  list.innerHTML = '';
  QUESTS.forEach((q, i) => {
    const stars = SAVE.stars[q.id] || 0;
    const unlocked = i === 0 || (SAVE.stars[QUESTS[i - 1].id] || 0) > 0;
    const li = document.createElement('li');
    li.innerHTML = `<button class="quest${unlocked ? '' : ' locked'}" ${unlocked ? '' : 'disabled'}>
      <span class="q-thumb">${habitatHTML(q.habitat)}<span class="q-mon">${monsterHTML(q.id)}</span></span>
      <span class="q-body">
        <span class="q-rank">Missão ${i + 1}</span>
        <span class="q-name">${unlocked ? q.monster : '???'}</span>
        <span class="q-meta">${q.place}${SAVE.kills[q.id] ? ` · derrotado ${SAVE.kills[q.id]}x` : ''}</span>
        <span class="q-stars">${[0, 1, 2].map((s) => `<i class="${s < stars ? 'on' : ''}">★</i>`).join('')}</span>
      </span></button>`;
    li.firstChild.addEventListener('click', () => { SFX.init(); startQuest(i); });
    list.appendChild(li);
  });

  const bag = Object.entries(SAVE.mats).filter(([, n]) => n > 0);
  $('bag').innerHTML = bag.length
    ? bag.map(([m, n]) => `<div class="drop">${materialSVG(MATERIALS[m])}<span>${m}</span><b>x${n}</b></div>`).join('')
    : '<p class="muted">Sua bolsa está vazia. Cace monstros para conseguir materiais.</p>';

  const forge = $('forge-list');
  forge.innerHTML = '';
  for (const wp of Object.values(WEAPONS)) {
    const owned = SAVE.weapons.includes(wp.id);
    const cost = wp.cost || {};
    const canForge = !owned && Object.entries(cost).every(([m, n]) => (SAVE.mats[m] || 0) >= n);
    const li = document.createElement('li');
    li.className = 'forge-item';
    li.innerHTML = `<div class="eq-icon">${uiIcon(wp.id)}</div>
      <div class="f-body"><div class="eq-name">${wp.name}</div>
        <div class="eq-desc">${wp.passive}<br>Especial: <b>${wp.special}</b>: ${wp.specialTip}</div>
        ${owned ? '' : `<div class="f-cost">${Object.entries(cost).map(([m, n]) =>
          `<span class="${(SAVE.mats[m] || 0) >= n ? 'ok' : ''}">${materialSVG(MATERIALS[m])}${m} ${SAVE.mats[m] || 0}/${n}</span>`).join('')}</div>`}
      </div>
      <button class="f-btn">${SAVE.equipped === wp.id ? 'Equipada' : owned ? 'Equipar' : 'Forjar'}</button>`;
    const btn = li.querySelector('.f-btn');
    btn.disabled = SAVE.equipped === wp.id || (!owned && !canForge);
    btn.addEventListener('click', () => {
      if (!owned) {
        for (const [m, n] of Object.entries(cost)) SAVE.mats[m] -= n;
        SAVE.weapons.push(wp.id);
        SFX.init();
        SFX.win();
      }
      SAVE.equipped = wp.id;
      persist();
      renderHub();
    });
    forge.appendChild(li);
  }
}

// Tela de perfil: login e monstros derrotados (total e por monstro).
function renderProfile() {
  const u = window.Cloud && Cloud.user();
  let account;
  if (u) {
    account = `<div class="pf-user">${u.photoURL ? `<img class="avatar big" src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer">` : ''}
        <div><b>${esc(u.displayName || 'Caçador')}</b><small>Progresso salvo na nuvem</small></div></div>
      <button id="btn-logout" class="btn">Sair</button>`;
  } else if (window.Cloud && Cloud.available) {
    account = `<p class="muted">Entre com sua conta Google para salvar o progresso e continuar em qualquer aparelho.</p>
      <button id="btn-login" class="btn primary">Entrar com Google</button>`;
  } else {
    account = '<p class="muted">Jogando como convidado: o progresso fica salvo só neste aparelho.</p>';
  }
  const stars = Object.values(SAVE.stars).reduce((a, b) => a + b, 0);
  const rows = QUESTS.map((q) => `<li><span class="pf-mon">${monsterHTML(q.id)}</span><span>${q.monster}</span><b>${SAVE.kills[q.id] || 0}</b></li>`).join('');
  $('profile-body').innerHTML = `${account}<p id="profile-msg" class="muted"></p>
    <div class="pf-stats"><div><b>${totalKills()}</b><small>monstros derrotados</small></div>
      <div><b>${stars}</b><small>estrelas</small></div><div><b>${SAVE.weapons.length}/${WEAPON_LIST.length}</b><small>armas</small></div></div>
    <ul class="pf-list">${rows}</ul>`;
}

// ---- Entrada --------------------------------------------------------------------------------
function cellAt(x, y) {
  const el = document.elementFromPoint(x, y);
  const cell = el && el.closest('.cell');
  return cell ? [Number(cell.dataset.r), Number(cell.dataset.c)] : null;
}

function setupInput() {
  const board = $('board');

  board.addEventListener('pointerdown', (e) => {
    if (!canAct()) return;
    const pos = cellAt(e.clientX, e.clientY);
    if (!pos) return;
    e.preventDefault();
    if (S.armed) {
      applyTarget(pos[0], pos[1]);
      return;
    }
    board.setPointerCapture(e.pointerId);
    S.drag = { pos, x: e.clientX, y: e.clientY };
  });

  board.addEventListener('pointermove', (e) => {
    if (!S || !S.drag || !canAct()) return;
    const dx = e.clientX - S.drag.x, dy = e.clientY - S.drag.y;
    const threshold = cellEls[0][0].getBoundingClientRect().width * 0.35;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;
    const [r, c] = S.drag.pos;
    const to = Math.abs(dx) > Math.abs(dy) ? [r, c + Math.sign(dx)] : [r + Math.sign(dy), c];
    S.drag = null;
    if (inBounds(to[0], to[1])) trySwap([r, c], to);
  });

  board.addEventListener('pointerup', () => {
    if (!S || !S.drag) return;
    const pos = S.drag.pos;
    S.drag = null;
    if (!canAct()) return;
    // Toque simples: seleciona; tocar numa vizinha da selecionada faz a troca.
    const sel = S.selected;
    if (sel && Math.abs(sel[0] - pos[0]) + Math.abs(sel[1] - pos[1]) === 1) trySwap(sel, pos);
    else setSelected(sel && sel[0] === pos[0] && sel[1] === pos[1] ? null : pos);
  });
  board.addEventListener('pointercancel', () => { if (S) S.drag = null; });

  $('btn-special').addEventListener('click', useSpecial);
  POWERS.forEach((_, i) => $(`counter-${i}`).addEventListener('click', () => usePower(i)));
  $('btn-pause').addEventListener('click', () => {
    if (!S || S.over || !S.started) return;
    S.paused = true;
    $('pause').classList.remove('hidden');
  });
  $('btn-resume').addEventListener('click', () => {
    S.paused = false;
    $('pause').classList.add('hidden');
  });
  $('btn-quit').addEventListener('click', () => {
    $('pause').classList.add('hidden');
    S.over = true;
    showScreen('hub');
// O módulo de nuvem carrega depois dos scripts do jogo e avisa quando está pronto.
window.addEventListener('cloud-ready', () => {
  Cloud.onChange(async (u) => {
    if (u) {
      try {
        mergeProfile(await Cloud.load());
        persist();
      } catch (e) {
        console.warn('Não foi possível carregar o perfil:', e);
      }
    }
    if (!$('hub').classList.contains('hidden')) renderHub();
    if (!$('profile').classList.contains('hidden')) renderProfile();
  });
  renderHub();
});
  });
  $('btn-go').addEventListener('click', () => {
    SFX.init();
    $('intro').classList.add('hidden');
    S.started = true;
  });
  $('btn-retry').addEventListener('click', () => startQuest(S.qi));
  $('btn-next').addEventListener('click', () => startQuest(S.qi + 1));
  $('btn-hub').addEventListener('click', () => {
    $('result').classList.add('hidden');
    showScreen('hub');
  });
  $('btn-profile').addEventListener('click', () => {
    renderProfile();
    $('profile').classList.remove('hidden');
  });
  $('btn-profile-close').addEventListener('click', () => $('profile').classList.add('hidden'));
  $('profile').addEventListener('click', async (e) => {
    if (e.target.id === 'btn-login') {
      try { await Cloud.signIn(); } catch (err) { $('profile-msg').textContent = `Não foi possível entrar: ${err.code || err.message}`; }
    } else if (e.target.id === 'btn-logout') {
      await Cloud.signOut();
    }
  });
  $('btn-mute').addEventListener('click', () => {
    SAVE.muted = !SAVE.muted;
    SFX.muted = SAVE.muted;
    persist();
    renderHub();
  });
  document.querySelectorAll('.tabs button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll('.tabs button').forEach((x) => x.classList.toggle('active', x === b));
    $('tab-quests').classList.toggle('hidden', b.dataset.tab !== 'quests');
    $('tab-forge').classList.toggle('hidden', b.dataset.tab !== 'forge');
  }));
  // Pausa sozinho quando o app vai para segundo plano.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && S && S.started && !S.over && !S.paused) $('btn-pause').click();
  });
}

SFX.muted = SAVE.muted;
FX.init();
buildBoard();
setupInput();
showScreen('hub');
requestAnimationFrame(frame);
