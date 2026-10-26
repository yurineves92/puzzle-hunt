'use strict';

// Arte do jogo, toda em pixel art: personagens recortados da arte original (assets/pixel/),
// peças e ícones gerados em js/pixel.js e cenários pixelizados a partir de um SVG simples.

// ---- Personagens --------------------------------------------------------------
// Personagens da arte original que olham para a direita e precisam ser espelhados para
// encarar o caçador.
const PIXEL_FACES_RIGHT = ['jagras', 'kulu', 'pukei', 'anjanath'];

function monsterHTML(id) {
  const flip = PIXEL_FACES_RIGHT.includes(id) ? ' flip' : '';
  return `<img class="pixel-sprite art-sprite${flip}" src="assets/pixel/${id}.png" alt="">`;
}

// Caçador com a arma equipada nas costas (o ícone da arma fica atrás do corpo).
function hunterHTML(weapon) {
  return `<div class="hunter"><span class="hunter-weapon">${uiIcon(weapon)}</span><img class="pixel-sprite" src="${pixelHunter()}" alt=""></div>`;
}

// ---- Peças e ícones -------------------------------------------------------------
// Peças com `bonus` devolvem jogadas quando combinadas (o "+1" do Wedding Escape).
const tileHTML = (tile) => `<img class="pixel-tile" src="${pixelTile(tile)}" alt="">`
  + (tile.bonus ? `<span class="tile-bonus">+${tile.bonus}</span>` : '');
const uiIcon = (id) => `<img class="pixel-icon" src="${pixelIcon(id)}" alt="">`;

function materialSVG(color) {
  return `<svg viewBox="0 0 32 32"><path d="M16 3 28 12 24 28H8L4 12z" fill="${color}" stroke="#000" stroke-opacity=".5" stroke-width="2"/>
    <path d="M16 3 16 28M4 12 28 12" stroke="#fff" stroke-opacity=".35" stroke-width="1.5"/></svg>`;
}

// ---- Habitats -----------------------------------------------------------------
// Desenho-base de cada cenário; o jogo só o usa pixelizado (veja habitatHTML).
function habitatSVG(kind) {
  const P = {
    forest:  { sky: ['#a8e0cf', '#4f8f72'], far: '#6aa58a', mid: '#2f6148', near: '#1d4030', ground: ['#4d6b2e', '#2b3f1a'] },
    desert:  { sky: ['#ffd9a0', '#e37b4a'], far: '#d99a6a', mid: '#b0573a', near: '#7e3a26', ground: ['#e0a96a', '#a8703e'] },
    coral:   { sky: ['#ffd1ea', '#7a5bb0'], far: '#c9a0dc', mid: '#e0709e', near: '#3e8a8f', ground: ['#e8d4e8', '#9f86b8'] },
    dusk:    { sky: ['#ffb070', '#5a2a5e'], far: '#9a5a70', mid: '#3f2448', near: '#22152a', ground: ['#4a3a2e', '#24190f'] },
    volcano: { sky: ['#8a3a1c', '#2a0a06'], far: '#4a1810', mid: '#2e0d08', near: '#170403', ground: ['#4a2a1c', '#1c0c06'] },
  }[kind];

  let far = '', mid = '', extra = '';
  const cloud = (x, y, s, o) => `<g transform="translate(${x} ${y}) scale(${s})" fill="#fff" opacity="${o}">
    <ellipse cx="0" cy="0" rx="26" ry="8"/><ellipse cx="-12" cy="-5" rx="12" ry="9"/><ellipse cx="8" cy="-8" rx="14" ry="11"/></g>`;
  const clouds = kind === 'volcano'
    ? '<ellipse cx="120" cy="30" rx="90" ry="14" fill="#1a0604" opacity=".5"/><ellipse cx="300" cy="50" rx="70" ry="10" fill="#1a0604" opacity=".4"/>'
    : cloud(60, 40, 1, 0.5) + cloud(250, 25, 1.4, 0.4) + cloud(360, 62, 0.8, 0.45);
  if (kind === 'forest' || kind === 'dusk') {
    far = `<path d="M0 120 40 90 80 110 130 70 180 100 230 80 280 105 330 75 400 100V200H0z" fill="${P.far}"/>`;
    const tree = (x, s, c) => `<g transform="translate(${x} 150) scale(${s})" fill="${c}">
      <rect x="-5" y="-40" width="10" height="45"/><circle cx="0" cy="-60" r="28"/><circle cx="-20" cy="-45" r="20"/><circle cx="20" cy="-45" r="20"/><circle cx="0" cy="-85" r="20"/></g>`;
    mid = [20, 95, 300, 370].map((x, i) => tree(x, 1 + (i % 2) * 0.3, P.mid)).join('');
    extra = tree(-10, 1.8, P.near) + tree(410, 1.9, P.near)
      + (kind === 'forest' ? '<path d="M150 0h30l-60 160h-20zM230 0h18l-40 160h-14z" fill="#fff" opacity=".08"/>' : '');
  } else if (kind === 'desert') {
    far = `<path d="M0 130h40v-30h50v30h60v-50h70v50h80v-35h60v35h40V200H0z" fill="${P.far}"/>`;
    mid = `<path d="M-10 150h60v-55l10-5h40l8 5v55h120v-30h70v30h120V200H-10z" fill="${P.mid}"/>`;
    extra = `<circle cx="320" cy="50" r="22" fill="#fff3c0" opacity=".9"/>`;
  } else if (kind === 'coral') {
    far = `<path d="M0 125q50-30 100 0t100 0 100 0 100 0V200H0z" fill="${P.far}"/>`;
    const coral = (x, c) => `<g transform="translate(${x} 160)" stroke="${c}" stroke-width="8" stroke-linecap="round" fill="none">
      <path d="M0 0v-50M0-25l-18-18M0-35l16-20M-18-43v-14M16-55l6-10"/></g>`;
    mid = [30, 90, 290, 360].map((x, i) => coral(x, i % 2 ? P.mid : P.near)).join('');
    extra = [60, 140, 250, 330].map((x, i) => `<circle cx="${x}" cy="${40 + (i * 23) % 50}" r="${3 + i % 3}" fill="#fff" opacity=".5"/>`).join('');
  } else if (kind === 'volcano') {
    far = `<path d="M60 160 170 40h40l120 120z" fill="${P.far}"/><path d="M170 40h40l-6 10h-28z" fill="#ff7a1a"/>
      <path d="M186 48q-8 40 6 70t-10 40M196 50q10 30 0 60" stroke="#ff5a1a" stroke-width="4" fill="none" opacity=".8"/>
      <ellipse cx="190" cy="40" rx="40" ry="14" fill="#ff7a1a" opacity=".25"/>`;
    mid = `<path d="M0 150l40-40 30 20 40-30 30 50zM280 150l40-50 30 30 50-40v60z" fill="${P.mid}"/>`;
    extra = '<path d="M60 182q40-6 80 2t90-4 110 6" stroke="#ff6a1a" stroke-width="3" fill="none" opacity=".7"/>';
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200" viewBox="0 0 400 200" preserveAspectRatio="xMidYMax slice">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.sky[0]}"/><stop offset="1" stop-color="${P.sky[1]}"/></linearGradient>
      <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${P.ground[0]}"/><stop offset="1" stop-color="${P.ground[1]}"/></linearGradient></defs>
    <rect width="400" height="200" fill="url(#sky)"/>
    ${clouds}${far}${mid}
    <path d="M0 160q100-12 200 0t200 0V200H0z" fill="url(#ground)"/>
    ${extra}
  </svg>`;
}

// Cenário em pixel: o SVG é desenhado num canvas pequeno e exibido ampliado sem suavização.
// A conversão é assíncrona; enquanto não fica pronta, a imagem começa vazia e é atualizada depois.
const habitatPixels = {};
function pixelHabitat(kind) {
  if (habitatPixels[kind]) return habitatPixels[kind];
  habitatPixels[kind] = 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = 160;
    c.height = 80;
    c.getContext('2d').drawImage(img, 0, 0, 160, 80);
    habitatPixels[kind] = c.toDataURL('image/png');
    document.querySelectorAll(`img[data-hab="${kind}"]`).forEach((el) => { el.src = habitatPixels[kind]; });
  };
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(habitatSVG(kind))}`;
  return habitatPixels[kind];
}

// `run` monta a faixa de corrida: o cenário rola em loop, com cópias alternadas espelhadas
// para emendar sem costura.
function habitatHTML(kind, run = false) {
  const img = (mirror) => `<img class="pixel-habitat${mirror ? ' mirror' : ''}" data-hab="${kind}" src="${pixelHabitat(kind)}" alt="">`;
  if (!run) return img(false);
  return `<div class="run-strip">${[0, 1, 2, 3, 4, 5].map((i) => img(i % 2)).join('')}</div>`;
}

// Partículas de ambiente por habitat (puro CSS): esporos, poeira, bolhas, vagalumes, brasas.
function ambientHTML(kind) {
  const n = { forest: 14, desert: 12, coral: 14, dusk: 12, volcano: 18 }[kind] || 10;
  let out = '<div class="fog"></div>';
  for (let i = 0; i < n; i++) {
    const size = 2 + Math.random() * (kind === 'coral' ? 6 : 3);
    out += `<span class="amb amb-${kind}" style="left:${(Math.random() * 100).toFixed(1)}%;top:${(20 + Math.random() * 75).toFixed(1)}%;`
      + `width:${size.toFixed(1)}px;height:${size.toFixed(1)}px;animation-delay:-${(Math.random() * 8).toFixed(2)}s;`
      + `animation-duration:${(5 + Math.random() * 6).toFixed(2)}s"></span>`;
  }
  return out;
}
