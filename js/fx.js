'use strict';

// Partículas desenhadas num canvas por cima de tudo (coordenadas de tela).
const FX = (() => {
  let canvas, ctx, dpr = 1;
  const parts = [];

  function init() {
    canvas = document.getElementById('fx');
    ctx = canvas.getContext('2d');
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
  }

  function burst(x, y, color, n = 10, speed = 200) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.35 + Math.random());
      const life = 0.4 + Math.random() * 0.35;
      parts.push({ kind: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life, max: life, color, size: 2 + Math.random() * 3 });
    }
  }

  // Bola de energia que voa em curva de (x1,y1) até (x2,y2).
  function orb(x1, y1, x2, y2, color, delay = 0, size = 6) {
    parts.push({
      kind: 'orb', x1, y1, x2, y2, color, size,
      cx: (x1 + x2) / 2 + (Math.random() - 0.5) * 160,
      cy: Math.min(y1, y2) - 40 - Math.random() * 80,
      t: -delay / 0.45, trail: [],
    });
  }

  function ring(x, y, color, maxR = 140, life = 0.6) {
    parts.push({ kind: 'ring', x, y, maxR, life, max: life, color });
  }

  // Arco de corte de arma branca sobre o alvo.
  function slash(x, y, color = '#fff', r = 60) {
    const rot = -0.6 + Math.random() * 1.2;
    parts.push({ kind: 'slash', x, y, r, rot, life: 0.28, max: 0.28, color });
  }

  function update(dt) {
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    ctx.globalCompositeOperation = 'lighter';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      if (p.kind === 'spark') {
        p.life -= dt;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        p.vy += 500 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const a = p.life / p.max;
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (0.5 + a), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'orb') {
        p.t += dt / 0.45;
        if (p.t < 0) continue;
        if (p.t >= 1) { burst(p.x2, p.y2, p.color, 5, 140); parts.splice(i, 1); continue; }
        const t = p.t, u = 1 - t;
        const x = u * u * p.x1 + 2 * u * t * p.cx + t * t * p.x2;
        const y = u * u * p.y1 + 2 * u * t * p.cy + t * t * p.y2;
        p.trail.push([x, y]);
        if (p.trail.length > 10) p.trail.shift();
        p.trail.forEach(([tx, ty], j) => {
          const a = (j + 1) / p.trail.length;
          ctx.globalAlpha = a * 0.5;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(tx, ty, p.size * a, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(x, y, p.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.kind === 'slash') {
        p.life -= dt;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        const a = p.life / p.max;
        const sweep = (1 - a) * 2.4; // o arco "cresce" enquanto some
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineCap = 'round';
        ctx.lineWidth = 10 * a + 2;
        ctx.beginPath();
        ctx.arc(0, 0, p.r, -1.2, -1.2 + sweep);
        ctx.stroke();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3 * a + 1;
        ctx.stroke();
        ctx.restore();
      } else if (p.kind === 'ring') {
        p.life -= dt;
        if (p.life <= 0) { parts.splice(i, 1); continue; }
        const a = p.life / p.max;
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 6 * a + 1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.maxR * (1 - a) + 8, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  return { init, burst, orb, ring, slash, update };
})();

// Efeitos sonoros sintetizados com WebAudio (sem arquivos de áudio).
const SFX = (() => {
  let ac = null;
  let muted = false;

  function init() {
    if (!ac) {
      try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch { ac = null; }
    }
    if (ac && ac.state === 'suspended') ac.resume();
  }

  function tone(freq, dur = 0.12, type = 'sine', vol = 0.15, slideTo = 0, when = 0) {
    if (!ac || muted) return;
    const t = ac.currentTime + when;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ac.destination);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  function noise(dur = 0.3, vol = 0.2, freq = 800, when = 0) {
    if (!ac || muted) return;
    const t = ac.currentTime + when;
    const len = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const f = ac.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f).connect(g).connect(ac.destination);
    src.start(t);
  }

  const semis = (base, s) => base * Math.pow(2, s / 12);

  return {
    init,
    get muted() { return muted; },
    set muted(v) { muted = v; },
    swap() { tone(700, 0.06, 'square', 0.035, 900); },
    bad() { tone(200, 0.12, 'square', 0.05, 140); },
    match(combo) {
      const f = semis(523, Math.min(combo - 1, 8) * 2);
      tone(f, 0.16, 'triangle', 0.16);
      tone(f * 1.5, 0.16, 'triangle', 0.08, 0, 0.06);
    },
    boom() { noise(0.45, 0.35, 500); tone(120, 0.4, 'sine', 0.3, 40); },
    hit() { noise(0.1, 0.18, 2200); },
    hurt() { tone(220, 0.25, 'sawtooth', 0.12, 80); noise(0.2, 0.2, 600); },
    roar() { tone(150, 0.9, 'sawtooth', 0.16, 55); noise(0.9, 0.25, 420); },
    fire() { noise(0.55, 0.25, 1300); },
    heal() { [0, 4, 7, 12].forEach((s, i) => tone(semis(523, s), 0.16, 'sine', 0.12, 0, i * 0.07)); },
    special() { tone(300, 0.5, 'sawtooth', 0.1, 900); noise(0.4, 0.15, 3000, 0.1); },
    win() { [0, 4, 7, 12, 16].forEach((s, i) => tone(semis(392, s), 0.28, 'triangle', 0.18, 0, i * 0.12)); },
    fail() { [0, -3, -7].forEach((s, i) => tone(semis(330, s), 0.35, 'triangle', 0.18, 0, i * 0.2)); },
  };
})();
