'use strict';

// Pixel art gerada em código para as peças do tabuleiro e os ícones. Cada sprite é desenhado
// com formas simples numa grade pequena; o contorno escuro e as faixas de luz e sombra são
// aplicados automaticamente. Os personagens usam a arte original em assets/pixel/.

const PX_INK = '#1f1418';

class PixelGrid {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.px = new Array(w * h).fill(null);
  }

  set(x, y, c) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c;
  }

  get(x, y) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.px[y * this.w + x] : null;
  }

  // Pinta todo pixel cujo centro passa no teste.
  fill(test, c) {
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) if (test(x + 0.5, y + 0.5)) this.set(x, y, c);
    }
  }

  // `ol` desenha antes um contorno de 1px, o que separa a peça das que estão atrás.
  ellipse(cx, cy, rx, ry, c, ol = true) {
    const inE = (x, y, ax, ay) => ((x - cx) / ax) ** 2 + ((y - cy) / ay) ** 2 <= 1;
    if (ol) this.fill((x, y) => inE(x, y, rx + 1, ry + 1), 'k');
    this.fill((x, y) => inE(x, y, rx, ry), c);
  }

  poly(pts, c, ol = true) {
    const inside = (x, y) => {
      let r = false;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) r = !r;
      }
      return r;
    };
    if (ol) this.fill((x, y) => inside(x, y) || inside(x - 1, y) || inside(x + 1, y) || inside(x, y - 1) || inside(x, y + 1), 'k');
    this.fill(inside, c);
  }

  rect(x, y, w, h, c) {
    for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) this.set(xx, yy, c);
  }

  line(x0, y0, x1, y1, c, width = 1) {
    const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.rect(Math.round(x0 + (x1 - x0) * t - (width - 1) / 2), Math.round(y0 + (y1 - y0) * t - (width - 1) / 2), width, width, c);
    }
  }

  dot(x, y, c) { this.set(x, y, c); }

  // Desenha um bitmap de texto: cada caractere é uma chave de cor ('.' = nada).
  bitmap(x, y, rows) {
    rows.forEach((row, dy) => [...row].forEach((ch, dx) => { if (ch !== '.') this.set(x + dx, y + dy, ch); }));
  }

  // Converte as letras em cores: contorno externo, sombra embaixo e luz em cima de cada região.
  render(palette) {
    const out = new Array(this.w * this.h).fill(null);
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        const key = this.get(x, y);
        if (key === null) {
          const touches = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => this.get(x + dx, y + dy) !== null);
          if (touches) out[y * this.w + x] = PX_INK;
          continue;
        }
        if (key === 'k') { out[y * this.w + x] = PX_INK; continue; }
        const pal = palette[key];
        if (!Array.isArray(pal)) { out[y * this.w + x] = pal; continue; }
        const same = (dx, dy) => this.get(x + dx, y + dy) === key;
        const dark = !same(0, 1) || (!same(1, 1) && !same(0, 2));
        const light = !dark && (!same(0, -1) || (!same(-1, 0) && !same(0, -2)));
        out[y * this.w + x] = dark ? pal[2] : light ? pal[1] : pal[0];
      }
    }
    return out;
  }
}

function gridToDataURL(grid, palette) {
  const colors = grid.render(palette);
  const canvas = document.createElement('canvas');
  canvas.width = grid.w;
  canvas.height = grid.h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(grid.w, grid.h);
  colors.forEach((hex, i) => {
    if (!hex) return;
    const n = parseInt(hex.slice(1), 16);
    img.data.set([(n >> 16) & 255, (n >> 8) & 255, n & 255, 255], i * 4);
  });
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL('image/png');
}

// ---- Peças do tabuleiro (24x24) ----------------------------------------------------
// Cada peça segue o ícone de elemento de Monster Hunter: chama em espiral, cristal hexagonal,
// raio com ponta de flecha, gota com sorriso e o "U" do dragão com pontas vermelhas.
// 'a' = cor do elemento (luz e sombra automáticas), 'q' = detalhe interno, 'x' = brilho, 'r' = pontas.
const TILE_COLORS = [
  { a: ['#f2551c', '#ff9a4a', '#a8260a'], q: '#9a1c06' },
  { a: ['#b4d8ff', '#ecf6ff', '#6a98d8'], q: '#4a78c0' },
  { a: ['#fff030', '#ffffb4', '#c09c00'], q: '#c09c00' },
  { a: ['#2c9cf0', '#8ad4ff', '#15589c'], q: '#0e3e78' },
  { a: ['#6a6abc', '#9c9ce4', '#3c3c80'], q: '#3c3c80', r: ['#e2486a', '#ff90a8', '#a01e40'] },
];

const TILE_ART = [
  // Fogo: chama enrolada (formato de "6")
  (g) => {
    const tip = [[4, 13], [7, 7], [12, 3], [18, 1], [16, 6], [18, 10], [19, 15]];
    g.poly(tip, 'a', false);
    g.fill((x, y) => Math.hypot(x - 11.5, y - 15) <= 7.5, 'a');
    g.fill((x, y) => {
      const d = Math.hypot(x - 12, y - 15.5), ang = Math.atan2(y - 15.5, x - 12);
      return d >= 2.2 && d <= 3.6 && !(ang > -1.6 && ang < -0.2);
    }, 'q');
    g.line(13, 12, 16, 8, 'q');
    g.dot(8, 11, 'x');
  },
  // Gelo: cristal hexagonal com um "0" dentro e um cristalzinho ao lado
  (g) => {
    g.poly([[18, 12], [22, 17], [18, 22], [14, 17]], 'a');
    g.poly([[9, 1], [16, 5], [16, 14], [9, 18], [2, 14], [2, 5]], 'a');
    g.fill((x, y) => { const d = ((x - 9) / 2.6) ** 2 + ((y - 9.5) / 4.4) ** 2; return d >= 0.45 && d <= 1; }, 'q');
    g.dot(5, 6, 'x');
  },
  // Raio: zigue-zague terminando em ponta de flecha para cima e à direita
  (g) => {
    g.poly([[1, 22], [9, 12], [5, 12], [12, 5], [9, 5], [22, 1], [19, 13], [17, 9], [11, 16], [15, 16]], 'a');
    g.line(12, 7, 18, 4, 'x');
  },
  // Água: gota com uma curva sorridente dentro
  (g) => {
    g.fill((x, y) => Math.hypot(x - 12, y - 15) <= 7 || (y >= 2 && y <= 15 && Math.abs(x - 12) <= ((y - 2) * 7) / 13), 'a');
    g.fill((x, y) => {
      const d = Math.hypot(x - 12, y - 14.5), ang = Math.atan2(y - 14.5, x - 12);
      return d >= 3.2 && d <= 4.4 && ang > 0.35 && ang < 2.8;
    }, 'q');
    g.dot(9, 9, 'x');
  },
  // Dragão: "U" roxo sobre uma haste, com as pontas vermelhas
  (g) => {
    g.fill((x, y) => {
      const outer = x >= 2.5 && x <= 21.5 && y >= 2 && y <= 15 && Math.hypot(Math.max(0, Math.abs(x - 12) - 4.5), Math.max(0, y - 11)) <= 5;
      const inner = x >= 8 && x <= 16 && y <= 10.5;
      return (outer && !inner) || (x >= 9 && x <= 15 && y >= 14 && y <= 19) || (x >= 6 && x <= 18 && y >= 18.5 && y <= 22);
    }, 'a');
    g.rect(3, 2, 5, 4, 'r');
    g.rect(17, 2, 5, 4, 'r');
    g.line(3, 6, 7, 6, 'k');
    g.line(17, 6, 21, 6, 'k');
    g.dot(5, 8, 'x');
  },
];

function pixelTile(tile) {
  const id = tile.key < 0 ? 'rock' : `${tile.key}-${tile.special || ''}`;
  const cacheId = `tile:${id}`;
  if (pixelCache[cacheId]) return pixelCache[cacheId];
  const g = new PixelGrid(24, 24);
  const palette = { x: '#ffffff', y: '#ffe08a', t: '#ff2d2d', o: ['#ffb02e', '#ffe08a', '#c06a10'] };
  if (tile.key < 0) {
    palette.a = ['#8f887e', '#bab3a8', '#5a544c'];
    g.poly([[2, 16], [4, 7], [10, 2], [17, 4], [21, 11], [20, 19], [12, 22], [5, 21]], 'a');
    g.line(10, 5, 12, 11, 'k');
    g.line(12, 11, 18, 14, 'k');
    g.line(12, 11, 7, 17, 'k');
  } else {
    Object.assign(palette, TILE_COLORS[tile.key]);
    TILE_ART[tile.key](g);
    // Marcas das peças especiais por cima, com contorno para aparecer sobre qualquer cor.
    if (tile.special === 'line-h' || tile.special === 'line-v') {
      const h = tile.special === 'line-h';
      const P = (a, b) => (h ? [a, b] : [b, a]);
      g.line(...P(4, 12), ...P(19, 12), 'k', 4);
      g.line(...P(4, 12), ...P(19, 12), 'x', 2);
      g.poly([P(1, 12), P(6, 7), P(6, 17)], 'x');
      g.poly([P(22, 12), P(17, 7), P(17, 17)], 'x');
    }
    if (tile.special === 'weak') {
      g.fill((x, y) => { const d = Math.hypot(x - 12, y - 12); return d >= 8.6 && d <= 11.4; }, 'k');
      g.fill((x, y) => { const d = Math.hypot(x - 12, y - 12); return d >= 9.4 && d <= 10.6; }, 'x');
      g.ellipse(12, 12, 2.4, 2.4, 't');
    }
  }
  pixelCache[cacheId] = gridToDataURL(g, palette);
  return pixelCache[cacheId];
}

// ---- Ícones de armas e itens (20x20) -------------------------------------------------
const ICON_PALETTE = {
  m: ['#c8d0dc', '#f4f8fc', '#7a8494'],   // metal
  s: ['#8a929e', '#b4bcc8', '#4e5662'],   // aço escuro
  w: ['#8a5a32', '#b07a48', '#5a3a1e'],   // madeira
  g: ['#e0b040', '#fadc7c', '#9a7420'],   // ouro
  r: ['#d8402e', '#f26c4c', '#9a2418'],   // vermelho
  b: ['#4ab0d9', '#8ad8f4', '#1d6a8a'],   // frasco azul
  n: ['#efe0b8', '#fffaea', '#bba878'],   // osso
  o: ['#f8a040', '#ffd080', '#c0681c'],   // laranja
  v: ['#3fd17a', '#8af0b0', '#1f8a48'],   // verde (poção)
  q: ['#2e3440', '#4a5260', '#181c24'],   // cano escuro
  y: ['#ffe066', '#fff4b0', '#c09a20'],   // raio
  x: '#ffffff',
};

const PIXEL_ICONS = {
  gs(g) { g.line(15, 3, 7, 11, 'm', 4); g.poly([[13, 1], [18, 1], [18, 6]], 'm'); g.line(3, 9, 9, 15, 'g', 2); g.line(5, 13, 2, 16, 'w', 2); g.dot(1, 17, 'g'); },
  ls(g) { g.line(17, 2, 6, 13, 'm', 2); g.line(4, 11, 8, 15, 'g', 2); g.line(5, 14, 2, 17, 'q', 2); },
  sns(g) { g.line(17, 2, 9, 10, 'm', 2); g.line(7, 8, 11, 12, 'g'); g.line(8, 11, 6, 13, 'w', 2); g.ellipse(6, 13, 5, 5, 's'); g.ellipse(6, 13, 1.5, 1.5, 'g', false); },
  db(g) { g.line(15, 2, 7, 10, 'm', 2); g.line(4, 2, 12, 10, 'm', 2); g.line(7, 11, 3, 15, 'r', 2); g.line(12, 11, 16, 15, 'r', 2); },
  hammer(g) { g.line(13, 7, 3, 17, 'w', 2); g.poly([[9, 1], [18, 5], [15, 11], [6, 7]], 's'); g.line(8, 5, 16, 8, 'g'); },
  hh(g) { g.poly([[2, 17], [4, 8], [10, 3], [17, 1], [18, 5], [12, 7], [8, 11], [6, 18]], 'n'); g.line(5, 12, 12, 5, 'g'); g.ellipse(17, 3, 2, 2, 'g'); g.bitmap(12, 10, ['..bb', '..b.', '..b.', 'bbb.', 'bb..']); },
  lance(g) { g.line(17, 2, 7, 12, 'm', 3); g.poly([[16, 0], [19, 0], [19, 3]], 'm'); g.line(7, 12, 3, 16, 'w', 2); g.poly([[1, 6], [9, 6], [9, 13], [5, 17], [1, 13]], 's'); g.line(5, 7, 5, 15, 'g'); g.line(2, 10, 8, 10, 'g'); },
  gl(g) { g.line(17, 2, 7, 12, 'q', 3); g.line(16, 4, 10, 10, 'm'); g.dot(18, 1, 'o'); g.line(7, 12, 3, 16, 'w', 2); g.poly([[1, 6], [9, 6], [9, 13], [5, 17], [1, 13]], 's'); g.ellipse(5, 11, 1.6, 1.6, 'r', false); },
  sa(g) { g.line(13, 7, 3, 17, 'w', 2); g.poly([[11, 1], [18, 4], [17, 12], [12, 8]], 'm'); g.rect(9, 8, 3, 3, 'b'); },
  cb(g) { g.line(18, 1, 10, 9, 'm', 2); g.line(8, 7, 12, 11, 'g'); g.rect(1, 8, 9, 11, 's'); g.rect(2, 10, 2, 6, 'r'); g.rect(5, 10, 2, 6, 'r'); g.rect(8, 10, 1, 6, 'y'); },
  ig(g) { g.line(16, 3, 3, 16, 'w'); g.poly([[15, 0], [19, 1], [18, 5], [14, 4]], 'm'); g.poly([[2, 15], [1, 19], [5, 18]], 'm'); g.ellipse(6, 5, 3, 2, 'o'); g.dot(4, 3, 'b'); g.dot(8, 3, 'b'); },
  lbg(g) { g.rect(3, 8, 12, 4, 's'); g.rect(15, 9, 4, 2, 'q'); g.poly([[3, 11], [1, 16], [5, 16], [7, 12]], 'w'); g.rect(7, 6, 5, 2, 'q'); g.dot(10, 10, 'y'); },
  hbg(g) { g.rect(2, 6, 14, 7, 's'); g.rect(16, 7, 3, 5, 'q'); g.dot(19, 9, 'o'); g.poly([[3, 12], [1, 18], [6, 18], [7, 13]], 'w'); g.rect(6, 4, 6, 2, 'q'); g.rect(9, 13, 5, 4, 's'); },
  bow(g) {
    for (let t = 0; t <= 1; t += 0.02) { const x = 5 + 18 * t * (1 - t) * 1.6, y = 1 + 18 * t; g.rect(Math.round(x), Math.round(y), 2, 1, 'w'); }
    g.line(5, 1, 5, 19, 'x'); g.line(2, 10, 17, 10, 'm'); g.poly([[16, 8], [19, 10], [16, 12]], 'm'); g.line(1, 9, 3, 11, 'r');
  },
  bomb(g) { g.ellipse(10, 12, 6, 7, 'r'); g.rect(4, 8, 13, 2, 'w'); g.rect(4, 15, 13, 2, 'w'); g.line(10, 4, 13, 1, 'm'); g.dot(14, 0, 'o'); g.poly([[8, 11], [12, 11], [10, 14]], 'y'); },
  trap(g) { g.ellipse(10, 15, 8, 3.5, 's'); g.ellipse(10, 14, 5, 1.5, 'q', false); g.poly([[11, 1], [6, 9], [10, 9], [8, 15], [14, 6], [10, 6]], 'y'); },
  flash(g) {
    const pts = [];
    for (let i = 0; i < 16; i++) {
      const a = (i * Math.PI) / 8 - Math.PI / 2, r = i % 2 ? 4 : 9;
      pts.push([10 + Math.cos(a) * r, 10 + Math.sin(a) * r]);
    }
    g.poly(pts, 'y');
    g.ellipse(10, 10, 3, 3, 'x', false);
  },
  potion(g) { g.rect(8, 1, 4, 3, 'w'); g.poly([[7, 4], [13, 4], [13, 7], [17, 12], [17, 18], [3, 18], [3, 12], [7, 7]], 'n'); g.poly([[4, 12], [16, 12], [16, 17], [4, 17]], 'v', false); g.dot(6, 13, 'x'); },
};

function pixelIcon(id) {
  const cacheId = `icon:${id}`;
  if (!pixelCache[cacheId]) {
    const g = new PixelGrid(20, 20);
    PIXEL_ICONS[id](g);
    pixelCache[cacheId] = gridToDataURL(g, ICON_PALETTE);
  }
  return pixelCache[cacheId];
}

// ---- Caçador (32x44, olhando para a direita) ----------------------------------------
// Armadura de couro com ombreiras e capacete de metal, cachecol vermelho. A arma equipada
// é desenhada à parte (ícone nas costas), então o sprite serve para todas as armas.
const HUNTER_PALETTE = {
  s: ['#f2c9a0', '#ffe2c4', '#c8946a'],   // pele
  h: ['#6a4022', '#8a5a32', '#42260f'],   // cabelo
  m: ['#b4bcc8', '#e8ecf4', '#6e7684'],   // metal
  l: ['#8a5a32', '#ac7c4c', '#5a3a1e'],   // couro
  p: ['#4a4a5e', '#66667c', '#2e2e3c'],   // calça
  b: ['#4a3020', '#6a4630', '#2e1c12'],   // botas
  r: ['#c8344a', '#ec5a6e', '#861d30'],   // cachecol e pluma
  w: '#3a2a1e', g: '#f8c838', e: '#1a1018', x: '#ffffff',
};

function drawHunter(g) {
  // pluma do capacete (atrás)
  g.poly([[11, 4], [5, 1], [3, 5], [8, 7]], 'r');
  // pernas e botas
  g.rect(10, 32, 5, 8, 'p');
  g.rect(18, 32, 5, 8, 'p');
  g.rect(9, 38, 7, 5, 'b');
  g.rect(17, 38, 8, 5, 'b');
  // braço de trás
  g.ellipse(9, 27, 2.5, 4, 'l');
  g.ellipse(9, 31, 2, 2, 's');
  // tronco: couro, peitoral de metal e cinto
  g.ellipse(16, 26, 8, 8, 'l');
  g.ellipse(18, 25, 4.5, 4.5, 'm');
  g.rect(8, 30, 17, 3, 'w');
  g.rect(16, 30, 3, 3, 'g');
  // braço da frente
  g.ellipse(24, 27, 2.5, 4, 'l');
  g.ellipse(24, 31, 2, 2, 's');
  // ombreiras e cachecol
  g.ellipse(9, 21, 4, 3, 'm');
  g.ellipse(24, 21, 4, 3, 'm');
  g.ellipse(17, 19, 6.5, 2.2, 'r');
  g.poly([[11, 19], [8, 25], [12, 23]], 'r');
  // cabeça: rosto, cabelo saindo do capacete e capacete com viseira levantada
  g.ellipse(17, 12, 8, 7.5, 's');
  g.poly([[9, 10], [10, 15], [13, 13], [12, 9]], 'h');
  g.ellipse(17, 7, 8.5, 5, 'm');
  g.rect(9, 9, 17, 2, 'm');
  g.dot(13, 5, 'x');
  // olhos e boca (virado para a direita)
  g.rect(19, 12, 2, 3, 'e');
  g.rect(23, 12, 2, 3, 'e');
  g.dot(19, 12, 'x');
  g.dot(23, 12, 'x');
  g.line(21, 17, 23, 17, 'k');
}

function pixelHunter() {
  if (!pixelCache.hunter) {
    const g = new PixelGrid(32, 44);
    drawHunter(g);
    pixelCache.hunter = gridToDataURL(g, HUNTER_PALETTE);
  }
  return pixelCache.hunter;
}

const pixelCache = {};
