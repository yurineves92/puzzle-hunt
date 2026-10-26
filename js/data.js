'use strict';

// Elementos das peças. `shape` muda o formato para não depender só da cor.
const FIRE = 0, ICE = 1, THUNDER = 2, WATER = 3, DRAGON = 4;
const ELEMENTS = [
  { shape: 'coin', name: 'Fogo', light: '#ffd08a', mid: '#ff5a2e', dark: '#8f1a0a', glow: '#ff7a3d' },
  { shape: 'coin', name: 'Gelo', light: '#f2fdff', mid: '#6fd3f2', dark: '#1b6f96', glow: '#9feaff' },
  { shape: 'gem', name: 'Raio', light: '#fff7c2', mid: '#ffcc2e', dark: '#9a6200', glow: '#ffe066' },
  { shape: 'gem', name: 'Água', light: '#b8dcff', mid: '#3d8bff', dark: '#123a94', glow: '#6aaeff' },
  { shape: 'hex', name: 'Dragão', light: '#ead2ff', mid: '#9b4dff', dark: '#3d1470', glow: '#b27aff' },
];

// Ataques dos monstros. `dmg` multiplica o dano base do monstro.
// Ataques dos monstros, usados quando as jogadas do caçador acabam.
// `dmg` multiplica o dano base do monstro; `turns` = duração em jogadas.
const ATTACKS = {
  bite:     { name: 'Mordida', icon: '🦷', kind: 'hit', dmg: 1.0 },
  charge:   { name: 'Investida', icon: '💨', kind: 'hit', dmg: 1.3 },
  tail:     { name: 'Rabada', icon: '🌀', kind: 'hit', dmg: 1.1 },
  rock:     { name: 'Arremesso de Pedra', icon: '🪨', kind: 'rock', dmg: 0.6, count: 3 },
  poison:   { name: 'Cauda Venenosa', icon: '☠️', kind: 'poison', dmg: 0.5, turns: 3 },
  fireball: { name: 'Bola de Fogo', icon: '☄️', kind: 'burn', dmg: 0.8, count: 5 },
  roar:     { name: 'Rugido', icon: '📢', kind: 'roar', dmg: 0 },
};

const MATERIALS = {
  'Escama de Jagras': '#7f6fc4',
  'Couro de Jagras': '#e0a640',
  'Pena de Kulu': '#e8b49a',
  'Bico de Kulu': '#f2c94c',
  'Escama de Pukei': '#6fbf55',
  'Saco de Veneno': '#b45fd0',
  'Pelo de Anjanath': '#ece4d2',
  'Presa de Anjanath': '#d9c9a8',
  'Escama de Rathalos': '#d23a22',
  'Rubi Celeste': '#ff3f6a',
};

// `moves` = jogadas do caçador entre um ataque e outro do monstro (como os MOVES do
// Wedding Escape); `hp` = vida que falta, mostrada na placa da faixa de caçada.
const QUESTS = [
  {
    id: 'jagras', monster: 'Grande Jagras', place: 'Floresta Antiga', habitat: 'forest',
    hp: 2400, weak: [FIRE], resist: [], moves: 6, dmg: 20,
    pattern: ['bite', 'charge', 'bite', 'tail'],
    drops: [['Escama de Jagras', 5], ['Couro de Jagras', 4]],
  },
  {
    id: 'kulu', monster: 'Kulu-Ya-Ku', place: 'Ermo Ancestral', habitat: 'desert',
    hp: 3000, weak: [WATER], resist: [], moves: 6, dmg: 28,
    pattern: ['bite', 'rock', 'charge', 'rock'],
    drops: [['Pena de Kulu', 5], ['Bico de Kulu', 3]],
  },
  {
    id: 'pukei', monster: 'Pukei-Pukei', place: 'Planalto de Coral', habitat: 'coral',
    hp: 3500, weak: [THUNDER], resist: [WATER], moves: 5, dmg: 26,
    pattern: ['poison', 'bite', 'tail', 'poison', 'roar'],
    drops: [['Escama de Pukei', 5], ['Saco de Veneno', 3]],
  },
  {
    id: 'anjanath', monster: 'Anjanath', place: 'Floresta ao Entardecer', habitat: 'dusk',
    hp: 4000, weak: [WATER], resist: [FIRE], moves: 5, dmg: 40,
    pattern: ['roar', 'bite', 'fireball', 'charge', 'fireball'],
    drops: [['Pelo de Anjanath', 5], ['Presa de Anjanath', 3]],
  },
  {
    id: 'rathalos', monster: 'Rathalos', place: 'Vale Rubro', habitat: 'volcano',
    hp: 4800, weak: [DRAGON, THUNDER], resist: [FIRE], moves: 4, dmg: 48,
    pattern: ['roar', 'fireball', 'tail', 'fireball', 'charge', 'fireball'],
    drops: [['Escama de Rathalos', 6], ['Rubi Celeste', 1]],
  },
];

// Poderes carregados por elemento (como os contadores do Wedding Escape): cada peça combinada
// daquele elemento desconta 1 de `goal`; ao chegar a zero o poder fica pronto para usar.
// As peças de Dragão carregam o especial da arma.
const POWERS = [
  { key: FIRE, id: 'bomb', name: 'Barril', tip: 'Toque numa peça: explode 3x3', target: true, goal: 14 },
  { key: ICE, id: 'trap', name: 'Armadilha', tip: 'Prende o monstro: +3 jogadas', target: false, goal: 18 },
  { key: THUNDER, id: 'flash', name: 'Bomba Luz', tip: 'Toque numa peça: destrói todas daquele elemento', target: true, goal: 16 },
  { key: WATER, id: 'potion', name: 'Poção', tip: 'Recupera 50 de vida e cura veneno', target: false, goal: 20 },
];

// As 14 armas. Campos omitidos usam WEAPON_DEFAULTS.
// `gaugePerTile` enche a barra do especial a cada peça destruída; `guard` reduz o dano recebido;
// `healPerTile` cura a cada peça destruída; `lineMult` multiplica o bônus das lâminas (4 em linha).
const WEAPON_DEFAULTS = {
  ranged: false, dmgMult: 1, comboStep: 0.25, weakMult: 2, weakPointMult: 1, lineMult: 1,
  gaugePerTile: 2, guard: 0, healPerTile: 0, potionMult: 1, cost: null,
};

const WEAPON_LIST = [
  {
    id: 'gs', name: 'Espada Grande', passive: '+20% de dano em todos os ataques',
    special: 'Corte Carregado', specialTip: 'Toque numa linha: corta ela e a de baixo inteiras', specialTarget: true,
    dmgMult: 1.2, gaugePerTile: 1.6,
  },
  {
    id: 'sns', name: 'Espada e Escudo', passive: 'Bloqueia 20% do dano e poções curam o dobro',
    special: 'Golpe Perfeito', specialTip: 'Toque numa peça: corta linha e coluna e recupera 30 de vida', specialTarget: true,
    guard: 0.2, potionMult: 2, gaugePerTile: 2.2,
  },
  {
    id: 'ls', name: 'Espada Longa', passive: 'Cascatas valem +40% por combo',
    special: 'Corte Espiritual', specialTip: 'Toque numa coluna: corta ela inteira e dá +30% de dano por 3 jogadas', specialTarget: true,
    dmgMult: 1.05, comboStep: 0.4, gaugePerTile: 2.4,
    cost: { 'Escama de Jagras': 3, 'Couro de Jagras': 2 },
  },
  {
    id: 'db', name: 'Lâminas Duplas', passive: 'Cascatas valem o dobro (+50% por combo)',
    special: 'Modo Demônio', specialTip: '4 jogadas com dano x2', specialTarget: false,
    dmgMult: 1.05, comboStep: 0.5, gaugePerTile: 3.4,
    cost: { 'Escama de Jagras': 3, 'Pena de Kulu': 2 },
  },
  {
    id: 'hammer', name: 'Martelo', passive: 'Pontos fracos causam dano dobrado',
    special: 'Golpe Giratório', specialTip: 'Toque numa peça: esmaga 3x3 e nocauteia (+2 jogadas)', specialTarget: true,
    weakPointMult: 2,
    cost: { 'Couro de Jagras': 2, 'Bico de Kulu': 2, 'Escama de Pukei': 1 },
  },
  {
    id: 'lance', name: 'Lança', passive: 'Bloqueia 40% do dano recebido',
    special: 'Investida', specialTip: 'Toque numa linha: corta ela inteira e empurra o monstro (jogadas cheias)', specialTarget: true,
    guard: 0.4, dmgMult: 0.95, gaugePerTile: 2.4,
    cost: { 'Couro de Jagras': 3, 'Bico de Kulu': 1 },
  },
  {
    id: 'hh', name: 'Berrante', passive: 'Cada peça destruída cura um pouco',
    special: 'Recital', specialTip: 'Cura 40, remove veneno e dá +50% de dano por 3 jogadas', specialTarget: false,
    healPerTile: 0.25, dmgMult: 0.95,
    cost: { 'Pena de Kulu': 3, 'Escama de Pukei': 2 },
  },
  {
    id: 'ig', name: 'Glaive Inseto', passive: 'Fraqueza elemental causa x2,2',
    special: 'Mergulho Aéreo', specialTip: 'Toque numa peça: limpa um anel 5x5 em volta dela', specialTarget: true,
    weakMult: 2.2, dmgMult: 1.05,
    cost: { 'Pena de Kulu': 2, 'Saco de Veneno': 2 },
  },
  {
    id: 'lbg', name: 'Fuzil Leve', passive: 'Barra do especial enche muito rápido',
    special: 'Rajada', specialTip: 'Dispara em 12 peças aleatórias', specialTarget: false, ranged: true,
    dmgMult: 0.95, gaugePerTile: 3.4,
    cost: { 'Bico de Kulu': 2, 'Escama de Pukei': 2 },
  },
  {
    id: 'bow', name: 'Arco', passive: 'Fraqueza elemental causa x2,8 (em vez de x2)',
    special: 'Chuva de Flechas', specialTip: 'Flechas causam dano e criam 3 trios do elemento fraco do monstro', specialTarget: false, ranged: true,
    weakMult: 2.8, gaugePerTile: 2.6,
    cost: { 'Pena de Kulu': 2, 'Saco de Veneno': 2, 'Presa de Anjanath': 1 },
  },
  {
    id: 'sa', name: 'Machado Alternado', passive: '+10% de dano e lâminas valem o dobro',
    special: 'Descarga Elemental', specialTip: 'Toque numa peça: explode as duas diagonais dela', specialTarget: true,
    dmgMult: 1.1, lineMult: 2,
    cost: { 'Escama de Pukei': 3, 'Pelo de Anjanath': 2 },
  },
  {
    id: 'gl', name: 'Lançarma', passive: 'Pontos fracos x1,5 e bloqueia 20% do dano',
    special: 'Fogo de Wyvern', specialTip: 'Toque numa peça: explosão em losango de raio 2', specialTarget: true,
    weakPointMult: 1.5, guard: 0.2, gaugePerTile: 1.8,
    cost: { 'Pelo de Anjanath': 2, 'Presa de Anjanath': 2 },
  },
  {
    id: 'cb', name: 'Lâmina Carregada', passive: 'Barra do especial enche mais rápido',
    special: 'Descarga Ampliada', specialTip: 'Toque numa peça: destrói todas as peças daquele elemento', specialTarget: true,
    gaugePerTile: 2.4, dmgMult: 1.05,
    cost: { 'Presa de Anjanath': 2, 'Escama de Rathalos': 2 },
  },
  {
    id: 'hbg', name: 'Fuzil Pesado', passive: '+25% de dano, mas o especial carrega devagar',
    special: 'Tiro de Wyvern', specialTip: 'Toque numa coluna: destrói ela e as duas vizinhas', specialTarget: true, ranged: true,
    dmgMult: 1.25, gaugePerTile: 1.4,
    cost: { 'Escama de Rathalos': 3, 'Rubi Celeste': 1 },
  },
];

const WEAPONS = Object.fromEntries(WEAPON_LIST.map((w) => [w.id, { ...WEAPON_DEFAULTS, ...w }]));
const STARTER_WEAPONS = ['gs', 'sns'];
