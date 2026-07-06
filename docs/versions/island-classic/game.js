/* =====================================================
   ISLAND — 1v1 half-court duel · one thumb
   Plain HTML + Three.js (r128). No frameworks.
   ===================================================== */
'use strict';

if (!window.THREE) {
  document.getElementById('fatal').style.display = 'flex';
  throw new Error('three.js failed to load');
}

/* ---------- helpers ---------- */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const dampN = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));
const rand = (a, b) => (b === undefined) ? Math.random() * a : a + Math.random() * (b - a);
const hyp = (x, z) => Math.sqrt(x * x + z * z);
const sgn = v => v < 0 ? -1 : 1;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const UPV = new THREE.Vector3(0, 1, 0);
const _segDir = new THREE.Vector3();
const _sayV = new THREE.Vector3();

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function seg(m, ax, ay, az, bx, by, bz) {
  _segDir.set(bx - ax, by - ay, bz - az);
  const l = Math.max(0.001, _segDir.length());
  m.position.set((ax + bx) * 0.5, (ay + by) * 0.5, (az + bz) * 0.5);
  m.scale.set(1, l, 1);
  _segDir.multiplyScalar(1 / l);
  m.quaternion.setFromUnitVectors(UPV, _segDir);
}

function ik(ax, ay, az, bx, by, bz, l1, l2, hx, hy, hz, out) {
  let dx = bx - ax, dy = by - ay, dz = bz - az;
  let d = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const maxd = l1 + l2 - 0.005;
  if (d > maxd) { const s = maxd / d; dx *= s; dy *= s; dz *= s; bx = ax + dx; by = ay + dy; bz = az + dz; d = maxd; }
  d = Math.max(d, 0.02);
  const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0.0004, l1 * l1 - a * a));
  const ux = dx / d, uy = dy / d, uz = dz / d;
  const dot = hx * ux + hy * uy + hz * uz;
  let qx = hx - dot * ux, qy = hy - dot * uy, qz = hz - dot * uz;
  let ql = Math.sqrt(qx * qx + qy * qy + qz * qz);
  if (ql < 0.001) { qx = -uz; qy = 0; qz = ux; ql = Math.sqrt(qx * qx + qz * qz) || 1; }
  qx /= ql; qy /= ql; qz /= ql;
  out.kx = ax + ux * a + qx * h; out.ky = ay + uy * a + qy * h; out.kz = az + uz * a + qz * h;
  out.ex = bx; out.ey = by; out.ez = bz;
}
const IKO = { kx: 0, ky: 0, kz: 0, ex: 0, ey: 0, ez: 0 };

/* ---------- dom ---------- */
const stage = document.getElementById('stage');
const $ = id => document.getElementById(id);
const ui = {
  sy: $('sy'), sd: $('sd'), clock: $('clock'), modeTag: $('modeTag'), hud: $('hud'),
  banner: $('banner'), bMain: $('bMain'), bSub: $('bSub'), chips: $('chips'),
  checkPrompt: $('checkPrompt'), hint: $('hint'), cue: $('cue'), say: $('say'),
  menu: $('menu'), end: $('end'), endTitle: $('endTitle'), endSub: $('endSub'),
  btnFree: $('btnFree'), btnMatch: $('btnMatch'), btnDaily: $('btnDaily'),
  btnRematch: $('btnRematch'), btnMenu2: $('btnMenu2'), btnBack: $('btnBack'),
  btnDiff: $('btnDiff'), btnShare: $('btnShare'), dailyName: $('dailyName'),
  replayTag: $('replayTag'), barTop: $('barTop'), barBot: $('barBot'),
  scores: $('scores'), heatDots: $('heatDots')
};

/* ---------- constants ---------- */
const RIM = { x: 0, y: 3.05, z: 0 };
const ARC_R = 6.75;
const BOUNDS = { x: 6.25, zmin: 0.55, zmax: 12.3 };
const BALL_R = 0.121;
const GRAV = -9.6;

const DIFFS = {
  EASY: { react: 0.30, maxs: 4.2, acc: 15, commit: 2.8, biteHesi: 0.80, biteFake: 0.85, shade: 0.45, strip: 0.07, jump: 0.70 },
  MED:  { react: 0.20, maxs: 4.9, acc: 19, commit: 2.2, biteHesi: 0.55, biteFake: 0.60, shade: 0.80, strip: 0.15, jump: 0.85 },
  HARD: { react: 0.13, maxs: 5.4, acc: 23, commit: 1.6, biteHesi: 0.30, biteFake: 0.33, shade: 1.00, strip: 0.24, jump: 0.95 }
};
const DIFF_NAMES = { EASY: 'THE CONE', MED: 'THE FENCE', HARD: 'THE CLAMP' };
let DIFF = DIFFS.MED, diffKey = 'MED';

/* daily defender, seeded by the date */
const DAILY = (function () {
  const now = new Date();
  const seed = now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate();
  const r = mulberry32(seed);
  const first = ['BIG', 'SILKY', 'GLASS', 'MIDNIGHT', 'POCKET', 'STATIC', 'CANYON', 'VELVET', 'MARBLE', 'WIRE'];
  const last = ['LOCK', 'WALL', 'SHADOW', 'GLOVE', 'FENCE', 'ANCHOR', 'HAWK', 'CURTAIN', 'GATE', 'STORM'];
  return {
    name: first[Math.floor(r() * first.length)] + ' ' + last[Math.floor(r() * last.length)],
    date: now.getFullYear() + '.' + String(now.getMonth() + 1).padStart(2, '0') + '.' + String(now.getDate()).padStart(2, '0'),
    stats: {
      react: 0.12 + r() * 0.16, maxs: 4.5 + r() * 1.0, acc: 17 + r() * 7,
      commit: 1.5 + r() * 1.3, biteHesi: 0.25 + r() * 0.5, biteFake: 0.30 + r() * 0.5,
      shade: 0.5 + r() * 0.5, strip: 0.07 + r() * 0.17, jump: 0.70 + r() * 0.28
    }
  };
})();

/* ---------- renderer / scene ---------- */
const renderer = new THREE.WebGLRenderer({ canvas: $('c'), antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b0a0d);
scene.fog = new THREE.FogExp2(0x0b0a0d, 0.030);
const camera = new THREE.PerspectiveCamera(56, 1, 0.1, 90);
let SW = 1, SH = 1;
function resize() {
  const r = stage.getBoundingClientRect();
  SW = Math.max(1, r.width); SH = Math.max(1, r.height);
  renderer.setSize(SW, SH, false);
  camera.aspect = SW / SH; camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 250));

scene.add(new THREE.AmbientLight(0x7c7d90, 0.62));
const key = new THREE.SpotLight(0xffe3bd, 1.05, 70, 0.95, 0.6, 1.1);
key.position.set(2.5, 15, 7); key.target.position.set(0, 0, 3.5);
scene.add(key); scene.add(key.target);
const fill = new THREE.DirectionalLight(0x8fb0ff, 0.30);
fill.position.set(-7, 9, -7); scene.add(fill);

/* ---------- textures ---------- */
function floorTex() {
  const c = document.createElement('canvas'); c.width = c.height = 1024;
  const g = c.getContext('2d');
  g.fillStyle = '#141318'; g.fillRect(0, 0, 1024, 1024);
  const rg = g.createRadialGradient(512, 470, 60, 512, 470, 640);
  rg.addColorStop(0, '#3a3025'); rg.addColorStop(0.45, '#241f1e'); rg.addColorStop(1, '#111014');
  g.fillStyle = rg; g.fillRect(0, 0, 1024, 1024);
  g.globalAlpha = 0.05;
  for (let i = 0; i < 5200; i++) {
    g.fillStyle = Math.random() > 0.5 ? '#000' : '#fff';
    g.fillRect(Math.random() * 1024, Math.random() * 1024, 1.5, 1.5);
  }
  g.globalAlpha = 1;
  return new THREE.CanvasTexture(c);
}
function blobTex() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  rg.addColorStop(0, 'rgba(0,0,0,0.85)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = rg; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
function wordTex(word, col) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 128;
  const g = c.getContext('2d');
  g.font = 'italic 900 92px Arial Black, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillStyle = col; g.fillText(word, 256, 70);
  return new THREE.CanvasTexture(c);
}
const BLOB = blobTex();

/* ---------- court ---------- */
(function buildCourt() {
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(36, 36),
    new THREE.MeshLambertMaterial({ map: floorTex() }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0, 5.2);
  scene.add(floor);

  const lineMat = new THREE.MeshBasicMaterial({ color: 0xf2ecdf, transparent: true, opacity: 0.85, side: THREE.DoubleSide });
  const dimLine = new THREE.MeshBasicMaterial({ color: 0xf2ecdf, transparent: true, opacity: 0.35, side: THREE.DoubleSide });
  const heatMat = new THREE.MeshBasicMaterial({ color: 0xff5a26, transparent: true, opacity: 0.30, side: THREE.DoubleSide });

  function strip(cx, cz, w, d, mat) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), mat || lineMat);
    m.rotation.x = -Math.PI / 2; m.position.set(cx, 0.012, cz);
    scene.add(m); return m;
  }
  function arc(r, a0, a1, mat, w) {
    const m = new THREE.Mesh(new THREE.RingGeometry(r - (w || 0.035), r + (w || 0.035), 72, 1, a0, a1 - a0), mat || lineMat);
    m.rotation.x = Math.PI / 2; m.position.set(0, 0.012, 0);
    scene.add(m); return m;
  }
  const LW = 0.06;
  strip(0, -1.2, 13.4, LW);
  strip(-6.7, 5.55, LW, 13.6); strip(6.7, 5.55, LW, 13.6);
  strip(0, 12.35, 13.4, LW);
  strip(-2.45, 1.68, LW, 5.85); strip(2.45, 1.68, LW, 5.85);
  strip(0, 4.6, 4.96, LW);
  const ftc = arc(1.8, 0, Math.PI * 2, dimLine); ftc.position.z = 4.6;
  arc(1.25, 0, Math.PI, dimLine);
  const t0 = Math.acos(6.2 / ARC_R);
  arc(ARC_R, t0, Math.PI - t0, lineMat);
  const zCorner = Math.sqrt(ARC_R * ARC_R - 6.2 * 6.2);
  strip(-6.2, (zCorner - 1.2) / 2, LW, zCorner + 1.2);
  strip(6.2, (zCorner - 1.2) / 2, LW, zCorner + 1.2);
  strip(-6.78, 5.55, 0.05, 13.6, heatMat); strip(6.78, 5.55, 0.05, 13.6, heatMat);
  strip(0, -1.28, 13.5, 0.05, heatMat);
  const w = new THREE.Mesh(new THREE.PlaneGeometry(4.6, 1.15),
    new THREE.MeshBasicMaterial({ map: wordTex('ISLAND', 'rgba(242,236,223,0.16)'), transparent: true }));
  w.rotation.x = -Math.PI / 2; w.rotation.z = Math.PI; w.position.set(0, 0.013, 9.4);
  scene.add(w);
})();

/* ---------- hoop ---------- */
(function buildHoop() {
  const steel = new THREE.MeshLambertMaterial({ color: 0x191920 });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 3.9, 10), steel);
  pole.position.set(0, 1.95, -1.55); scene.add(pole);
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.15), steel);
  arm.position.set(0, 3.72, -0.95); scene.add(arm);
  const glass = new THREE.Mesh(new THREE.BoxGeometry(1.83, 1.07, 0.035),
    new THREE.MeshLambertMaterial({ color: 0xcfd9e6, transparent: true, opacity: 0.16 }));
  glass.position.set(0, 3.45, -0.38); scene.add(glass);
  const frameMat = new THREE.MeshBasicMaterial({ color: 0xe8e3d6 });
  function bar(w, h, x, y) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), frameMat);
    b.position.set(x, y, -0.36); scene.add(b);
  }
  bar(1.83, 0.04, 0, 3.985); bar(1.83, 0.04, 0, 2.915);
  bar(0.04, 1.07, -0.915, 3.45); bar(0.04, 1.07, 0.915, 3.45);
  bar(0.59, 0.03, 0, 3.5); bar(0.59, 0.03, 0, 3.06);
  bar(0.03, 0.45, -0.295, 3.275); bar(0.03, 0.45, 0.295, 3.275);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.225, 0.021, 9, 26),
    new THREE.MeshLambertMaterial({ color: 0xff6a2a }));
  rim.rotation.x = Math.PI / 2; rim.position.set(RIM.x, RIM.y, RIM.z);
  scene.add(rim);
})();

/* ---------- verlet net ---------- */
const net = (function () {
  const COLS = 10, ROWS = 5, L = 0.44;
  const parts = [], rest = [];
  for (let r = 0; r < ROWS; r++) {
    const t = r / (ROWS - 1);
    const rad = lerp(0.215, 0.125, t);
    const y = RIM.y - 0.015 - t * L;
    for (let c = 0; c < COLS; c++) {
      const a = (c / COLS) * Math.PI * 2 + (r % 2) * (Math.PI / COLS) * 0.6;
      const x = Math.sin(a) * rad, z = Math.cos(a) * rad;
      parts.push({ x, y, z, px: x, py: y, pz: z, pin: r === 0 });
      rest.push({ x, y, z });
    }
  }
  const cons = [];
  function addCon(i, j) {
    const dx = parts[i].x - parts[j].x, dy = parts[i].y - parts[j].y, dz = parts[i].z - parts[j].z;
    cons.push({ i, j, r: Math.sqrt(dx * dx + dy * dy + dz * dz) });
  }
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      addCon(i, r * COLS + (c + 1) % COLS);
      if (r < ROWS - 1) addCon(i, (r + 1) * COLS + c);
    }
  const segsN = cons.length;
  const posArr = new Float32Array(segsN * 2 * 3);
  const geo = new THREE.BufferGeometry();
  const attr = new THREE.BufferAttribute(posArr, 3);
  attr.setUsage(THREE.DynamicDrawUsage);
  geo.setAttribute('position', attr);
  scene.add(new THREE.LineSegments(geo,
    new THREE.LineBasicMaterial({ color: 0xf5f1e6, transparent: true, opacity: 0.9 })));

  function update(dt) {
    const h = Math.min(dt, 1 / 40);
    if (h > 0) {
      for (const p of parts) {
        if (p.pin) continue;
        const vx = (p.x - p.px) * 0.96, vy = (p.y - p.py) * 0.96, vz = (p.z - p.pz) * 0.96;
        p.px = p.x; p.py = p.y; p.pz = p.z;
        p.x += vx; p.y += vy + GRAV * 0.35 * h * h; p.z += vz;
      }
      // shape memory
      const k = Math.min(1, 5.5 * h);
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i]; if (p.pin) continue;
        p.x += (rest[i].x - p.x) * k; p.y += (rest[i].y - p.y) * k; p.z += (rest[i].z - p.z) * k;
      }
      // ball collision
      const bx = ball.x, by = ball.y, bz = ball.z;
      if (Math.abs(by - (RIM.y - L / 2)) < L && hyp(bx - RIM.x, bz - RIM.z) < 0.55) {
        const rr = BALL_R + 0.025;
        for (const p of parts) {
          if (p.pin) continue;
          const dx = p.x - bx, dy = p.y - by, dz = p.z - bz;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d < rr && d > 0.0001) {
            const push = (rr - d) / d;
            p.x += dx * push; p.y += dy * push * 0.7; p.z += dz * push;
          }
        }
      }
      // constraints
      for (let it = 0; it < 3; it++) {
        for (const cn of cons) {
          const a = parts[cn.i], b = parts[cn.j];
          let dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
          const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 0.0001;
          const diff = (d - cn.r) / d * 0.5;
          const wa = a.pin ? 0 : 1, wb = b.pin ? 0 : 1;
          const tw = wa + wb || 1;
          a.x += dx * diff * 2 * wa / tw; a.y += dy * diff * 2 * wa / tw; a.z += dz * diff * 2 * wa / tw;
          b.x -= dx * diff * 2 * wb / tw; b.y -= dy * diff * 2 * wb / tw; b.z -= dz * diff * 2 * wb / tw;
        }
      }
    }
    let o = 0;
    for (const cn of cons) {
      const a = parts[cn.i], b = parts[cn.j];
      posArr[o++] = a.x; posArr[o++] = a.y; posArr[o++] = a.z;
      posArr[o++] = b.x; posArr[o++] = b.y; posArr[o++] = b.z;
    }
    attr.needsUpdate = true;
  }
  function snap(power) {
    const h = 1 / 60;
    for (let r = 1; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const p = parts[r * COLS + c];
        const t = r / (ROWS - 1);
        p.py = p.y + (1.4 * power * t) * h * 8;   // downward velocity
        const rl = hyp(p.x, p.z) || 1;
        p.px = p.x - (p.x / rl) * 0.4 * power * t * h * 8;
        p.pz = p.z - (p.z / rl) * 0.4 * power * t * h * 8;
      }
  }
  return { update, snap };
})();

/* ---------- audio ---------- */
const AC = { ctx: null, master: null, ambG: null, crowdG: null, crowdV: 0, noiseBuf: null, lastSq: 0 };
function audioInit() {
  if (AC.ctx) { if (AC.ctx.state === 'suspended') AC.ctx.resume(); return; }
  const C = window.AudioContext || window.webkitAudioContext; if (!C) return;
  AC.ctx = new C();
  AC.master = AC.ctx.createGain(); AC.master.gain.value = 0.9;
  AC.master.connect(AC.ctx.destination);
  const len = Math.floor(AC.ctx.sampleRate * 1.2);
  const buf = AC.ctx.createBuffer(1, len, AC.ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  AC.noiseBuf = buf;
  const mkLoop = (freq, gain) => {
    const src = AC.ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const lp = AC.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = freq;
    const g = AC.ctx.createGain(); g.gain.value = gain;
    src.connect(lp); lp.connect(g); g.connect(AC.master); src.start();
    return g;
  };
  AC.ambG = mkLoop(240, 0.028);
  AC.crowdG = mkLoop(560, 0.0);
}
function nz(o) {
  if (!AC.ctx) return;
  const t = AC.ctx.currentTime + (o.when || 0);
  const src = AC.ctx.createBufferSource(); src.buffer = AC.noiseBuf;
  src.playbackRate.value = o.rate || 1;
  let node = src;
  if (o.bp) {
    const f = AC.ctx.createBiquadFilter(); f.type = 'bandpass';
    f.frequency.setValueAtTime(o.bp, t);
    if (o.slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(40, o.slideTo), t + (o.slideT || o.dur));
    f.Q.value = o.q || 1; node.connect(f); node = f;
  }
  if (o.hp) { const f = AC.ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = o.hp; node.connect(f); node = f; }
  if (o.lp) { const f = AC.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = o.lp; node.connect(f); node = f; }
  const g = AC.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(o.g || 0.3, t + (o.att || 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  node.connect(g); g.connect(AC.master);
  src.start(t); src.stop(t + o.dur + 0.05);
}
function tone(o) {
  if (!AC.ctx) return;
  const t = AC.ctx.currentTime + (o.when || 0);
  const osc = AC.ctx.createOscillator(); osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(o.f, t);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + o.dur);
  const g = AC.ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(o.g || 0.3, t + (o.att || 0.003));
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(g); g.connect(AC.master);
  osc.start(t); osc.stop(t + o.dur + 0.05);
}
function buzzKit() { if (navigator.vibrate) { try { navigator.vibrate(6); } catch (e) {} } }
const SND = {
  bounce(v) { tone({ f: 104, f2: 52, dur: 0.09, g: 0.26 * v }); nz({ dur: 0.045, lp: 520, g: 0.11 * v }); buzzKit(); },
  squeak(v) {
    if (!AC.ctx || AC.ctx.currentTime - AC.lastSq < 0.09) return;
    AC.lastSq = AC.ctx.currentTime;
    nz({ dur: 0.05 + rand(0.05), bp: 2100 + rand(1700), q: 9, g: 0.09 * (v || 1), hp: 1300 });
  },
  thud() { tone({ f: 82, f2: 44, dur: 0.13, g: 0.4 }); nz({ dur: 0.08, lp: 320, g: 0.2 }); if (navigator.vibrate) { try { navigator.vibrate(18); } catch (e) {} } },
  rim(hard) {
    tone({ f: 486, type: 'triangle', dur: 0.16, g: 0.20 * hard });
    tone({ f: 737, type: 'triangle', dur: 0.11, g: 0.13 * hard });
    tone({ f: 1230, type: 'sine', dur: 0.07, g: 0.07 * hard });
    nz({ dur: 0.03, hp: 2600, g: 0.15 * hard });
  },
  board() { nz({ dur: 0.09, lp: 640, g: 0.32 }); tone({ f: 128, f2: 66, dur: 0.11, g: 0.28 }); },
  tick() { tone({ f: 1250, dur: 0.03, g: 0.07 }); },
  blip() { tone({ f: 840, dur: 0.05, g: 0.13 }); },
  whoosh() { nz({ dur: 0.16, bp: 750, slideTo: 1900, slideT: 0.14, q: 1.2, g: 0.08 }); },
  swish(vol, pure) {
    nz({ dur: 0.22, bp: pure ? 4100 : 2700, slideTo: 850, slideT: 0.17, q: 1.1, g: 0.5 * vol, att: 0.004 });
    nz({ dur: 0.06, hp: 3400, g: 0.26 * vol, when: 0.028 });
    tone({ f: 150, f2: 88, dur: 0.08, g: 0.16 * vol, when: 0.018 });
  },
  crowd(big) {
    nz({ dur: 0.5, lp: 750, g: 0.30, att: 0.35, when: 0.05 });
    nz({ dur: 1.25, lp: 2800, g: (big ? 0.7 : 0.55), att: 0.02, when: 0.42 });
    tone({ f: 155, f2: 46, dur: 0.6, g: 0.42, when: 0.40 });
    nz({ dur: 0.14, hp: 900, g: 0.22, when: 0.45 });
  },
  buzz() { tone({ f: 196, type: 'square', dur: 0.7, g: 0.20 }); tone({ f: 199, type: 'square', dur: 0.7, g: 0.14 }); },
  duck(hold) {
    if (!AC.ctx) return;
    const t = AC.ctx.currentTime;
    AC.ambG.gain.cancelScheduledValues(t);
    AC.ambG.gain.setValueAtTime(AC.ambG.gain.value, t);
    AC.ambG.gain.linearRampToValueAtTime(0.003, t + 0.12);
    AC.ambG.gain.linearRampToValueAtTime(0.028, t + hold);
  }
};

/* ---------- stick figure ---------- */
const P = {
  HIP: 0.99, SH: 1.55, HEADY: 1.77, HEADR: 0.115, SHW: 0.45, HIPW: 0.27,
  A1: 0.31, A2: 0.30, L1: 0.47, L2: 0.46, STANCE: 0.37
};
const STYLE = { DRIB: 0, GUARD: 1, GATH: 2, RISE: 3, FOLLOW: 4, DEF: 5, CONTEST: 6, STUMBLE: 7, REACH: 8, HELD: 9 };

function makeFigure(bodyCol, accentCol, isDef) {
  const mat = new THREE.MeshLambertMaterial({ color: bodyCol });
  const grp = new THREE.Group(); scene.add(grp);
  const mk = m => { grp.add(m); return m; };
  const cyl = r => mk(new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.82, 1, 7), mat));
  const F = {
    head: mk(new THREE.Mesh(new THREE.SphereGeometry(P.HEADR, 12, 9), mat)),
    t1: cyl(0.108), t2: cyl(0.100), shBar: cyl(0.055), hipBar: cyl(0.05),
    aU: [cyl(0.046), cyl(0.046)], aF: [cyl(0.04), cyl(0.04)],
    hand: [mk(new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 6), mat)),
           mk(new THREE.Mesh(new THREE.SphereGeometry(0.052, 8, 6), mat))],
    lU: [cyl(0.056), cyl(0.056)], lF: [cyl(0.05), cyl(0.05)],
    foot: [mk(new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.075, 0.28), mat)),
           mk(new THREE.Mesh(new THREE.BoxGeometry(0.105, 0.075, 0.28), mat))]
  };
  const shadow = mk(new THREE.Mesh(new THREE.PlaneGeometry(1.05, 1.05),
    new THREE.MeshBasicMaterial({ map: BLOB, transparent: true, opacity: 0.4, depthWrite: false })));
  shadow.rotation.x = -Math.PI / 2;
  let ring = null, pivotRing = null, band = null;
  if (!isDef) {
    ring = mk(new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.011, 6, 16),
      new THREE.MeshBasicMaterial({ color: accentCol })));
    pivotRing = mk(new THREE.Mesh(new THREE.RingGeometry(0.13, 0.18, 20),
      new THREE.MeshBasicMaterial({ color: accentCol, transparent: true, opacity: 0.85, side: THREE.DoubleSide })));
    pivotRing.rotation.x = -Math.PI / 2; pivotRing.visible = false;
  } else {
    band = mk(new THREE.Mesh(new THREE.TorusGeometry(P.HEADR + 0.012, 0.02, 6, 14),
      new THREE.MeshBasicMaterial({ color: accentCol })));
  }
  const feet = [
    { x: 0, z: 0, y: 0, fx: 0, fz: 0, tx: 0, tz: 0, t: 1, dur: 0.2 },
    { x: 0, z: 0, y: 0, fx: 0, fz: 0, tx: 0, tz: 0, t: 1, dur: 0.2 }
  ];
  const hands = [{ x: 0, y: 1, z: 0 }, { x: 0, y: 1, z: 0 }];
  let wasAir = false;

  function snapTo(x, z, yaw) {
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    const rx = -fz, rz = fx;
    for (let s = 0; s < 2; s++) {
      const side = s === 0 ? -1 : 1;
      feet[s].x = x + rx * side * P.STANCE / 2; feet[s].z = z + rz * side * P.STANCE / 2;
      feet[s].t = 1; feet[s].y = 0;
      hands[s].x = x + rx * side * 0.35; hands[s].y = 1.0; hands[s].z = z;
    }
    wasAir = false;
  }

  function pose(p, dt) {
    const { x, z, yaw, crouch, lift } = p;
    const vx = p.vx || 0, vz = p.vz || 0;
    const spd = hyp(vx, vz);
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    let rx = -fz, rz = fx;
    // shoulder twist toward lateral velocity (momentum in the upper body)
    const latV = vx * rx + vz * rz;
    const tw = clamp(latV * 0.07, -0.35, 0.35);
    const cT = Math.cos(tw), sT = Math.sin(tw);
    const rtx = rx * cT + rz * sT, rtz = -rx * sT + rz * cT;

    const rootY = P.HIP * (1 - crouch * 0.34) + lift;
    const leanX = clamp(vx * 0.055, -0.32, 0.32) + fx * crouch * 0.10;
    const leanZ = clamp(vz * 0.055, -0.32, 0.32) + fz * crouch * 0.10;
    // weight shift: hips counter the lean slightly
    const hipX = x - leanX * 0.28, hipZ = z - leanZ * 0.28;
    const shX = x + leanX, shZ = z + leanZ;
    const shY = rootY + (P.SH - P.HIP) * (1 - crouch * 0.10);
    // spine curve midpoint
    const midX = lerp(hipX, shX, 0.5) + leanX * 0.35;
    const midZ = lerp(hipZ, shZ, 0.5) + leanZ * 0.35;
    const midY = lerp(rootY, shY, 0.52);
    const hdX = shX + leanX * 0.4, hdZ = shZ + leanZ * 0.4;
    const hdY = shY + (P.HEADY - P.SH);

    /* feet */
    const air = lift > 0.07;
    for (let s = 0; s < 2; s++) {
      const foot = feet[s], side = s === 0 ? -1 : 1;
      if (air) {
        const tx = x + rx * side * 0.14 - fx * 0.05, tz = z + rz * side * 0.14 - fz * 0.05;
        foot.x = dampN(foot.x, tx, 14, dt); foot.z = dampN(foot.z, tz, 14, dt);
        foot.y = Math.max(0.05, rootY - 0.80);
        foot.t = 1;
        continue;
      }
      if (wasAir) { foot.t = 1; foot.y = 0; foot.x = x + rx * side * P.STANCE / 2; foot.z = z + rz * side * P.STANCE / 2; }
      const lead = clamp((vx * fx + vz * fz) * 0.11, -0.22, 0.30);
      const hx = x + rx * side * (P.STANCE / 2 + crouch * 0.08) + fx * lead + vx * 0.05;
      const hz = z + rz * side * (P.STANCE / 2 + crouch * 0.08) + fz * lead + vz * 0.05;
      if (foot.t < 1) {
        foot.t = Math.min(1, foot.t + dt / foot.dur);
        const e = 1 - (1 - foot.t) * (1 - foot.t);
        foot.x = lerp(foot.fx, foot.tx, e); foot.z = lerp(foot.fz, foot.tz, e);
        foot.y = Math.sin(Math.PI * foot.t) * (0.05 + Math.min(0.09, spd * 0.02));
      } else {
        foot.y = 0;
        const pivotHold = (p.pivot === s);
        const err = hyp(hx - foot.x, hz - foot.z);
        const other = feet[1 - s];
        const trig = p.plant ? 0.06 : 0.17 + spd * 0.105;
        if (!pivotHold && err > trig && other.t > 0.55) {
          foot.fx = foot.x; foot.fz = foot.z;
          foot.tx = hx; foot.tz = hz;
          foot.dur = clamp(0.26 - spd * 0.022, 0.12, 0.26);
          foot.t = 0;
        }
      }
    }
    wasAir = air;

    for (let s = 0; s < 2; s++) {
      const side = s === 0 ? -1 : 1;
      const hjx = hipX + rx * side * P.HIPW / 2, hjz = hipZ + rz * side * P.HIPW / 2;
      ik(hjx, rootY, hjz, feet[s].x, feet[s].y + 0.05, feet[s].z,
        P.L1, P.L2, fx + rx * side * 0.3, 0.05, fz + rz * side * 0.3, IKO);
      seg(F.lU[s], hjx, rootY, hjz, IKO.kx, IKO.ky, IKO.kz);
      seg(F.lF[s], IKO.kx, IKO.ky, IKO.kz, IKO.ex, IKO.ey, IKO.ez);
      F.foot[s].position.set(feet[s].x + fx * 0.06, feet[s].y + 0.045, feet[s].z + fz * 0.06);
      F.foot[s].rotation.set(0, yaw, 0);
    }

    /* curved spine */
    seg(F.t1, hipX, rootY, hipZ, midX, midY, midZ);
    seg(F.t2, midX, midY, midZ, shX, shY, shZ);
    seg(F.shBar, shX - rtx * P.SHW / 2, shY, shZ - rtz * P.SHW / 2, shX + rtx * P.SHW / 2, shY, shZ + rtz * P.SHW / 2);
    seg(F.hipBar, hipX - rx * P.HIPW / 2, rootY, hipZ - rz * P.HIPW / 2, hipX + rx * P.HIPW / 2, rootY, hipZ + rz * P.HIPW / 2);
    F.head.position.set(hdX, hdY, hdZ);
    if (band) { band.position.set(hdX, hdY + 0.02, hdZ); band.rotation.set(Math.PI / 2 - 0.25, yaw, 0); }

    /* arms */
    const style = p.style, hand = p.hand || 1;
    const ballIdx = hand > 0 ? 1 : 0;
    const tgt = [[0, 0, 0], [0, 0, 0]];
    const T = G.t;
    function setT(i, tx, ty, tz) { tgt[i][0] = tx; tgt[i][1] = ty; tgt[i][2] = tz; }
    const bx = p.bx, by = p.by, bz = p.bz;
    if (style === STYLE.DRIB) {
      setT(ballIdx, bx, by, bz);
      const o = 1 - ballIdx, os = o === 0 ? -1 : 1;
      setT(o, x + fx * 0.26 + rx * os * 0.32, rootY + 0.30, z + fz * 0.26 + rz * os * 0.32);
    } else if (style === STYLE.HELD || style === STYLE.GATH || style === STYLE.RISE) {
      setT(0, bx - rtx * 0.09, by, bz - rtz * 0.09);
      setT(1, bx + rtx * 0.09, by, bz + rtz * 0.09);
    } else if (style === STYLE.FOLLOW) {
      setT(ballIdx, shX + fx * 0.32, shY + 0.52, shZ + fz * 0.32);
      const o = 1 - ballIdx, os = o === 0 ? -1 : 1;
      setT(o, shX + rx * os * 0.3 + fx * 0.1, shY - 0.05, shZ + rz * os * 0.3 + fz * 0.1);
    } else if (style === STYLE.DEF) {
      setT(0, shX - rtx * 0.52 + fx * 0.16, rootY + 0.14, shZ - rtz * 0.52 + fz * 0.16);
      setT(1, shX + rtx * 0.52 + fx * 0.16, rootY + 0.14, shZ + rtz * 0.52 + fz * 0.16);
    } else if (style === STYLE.CONTEST) {
      setT(1, shX + fx * 0.20 + rx * 0.10, shY + 0.86, shZ + fz * 0.20 + rz * 0.10);
      setT(0, shX - rx * 0.30 + fx * 0.08, shY + 0.05, shZ - rz * 0.30 + fz * 0.08);
    } else if (style === STYLE.REACH) {
      setT(1, bx, by, bz);
      setT(0, shX - rx * 0.45 + fx * 0.1, rootY + 0.1, shZ - rz * 0.45 + fz * 0.1);
    } else if (style === STYLE.STUMBLE) {
      setT(0, shX - rx * 0.46 - fx * 0.18, shY + 0.22 + Math.sin(T * 13) * 0.14, shZ - rz * 0.46 - fz * 0.18);
      setT(1, shX + rx * 0.5 + fx * 0.14, rootY + 0.12 + Math.cos(T * 11) * 0.1, shZ + rz * 0.5 + fz * 0.14);
    } else {
      setT(0, x + fx * 0.24 - rx * 0.24, rootY + 0.32, z + fz * 0.24 - rz * 0.24);
      setT(1, x + fx * 0.24 + rx * 0.24, rootY + 0.32, z + fz * 0.24 + rz * 0.24);
    }
    for (let s = 0; s < 2; s++) {
      const side = s === 0 ? -1 : 1;
      const rate = (style === STYLE.DRIB && s === ballIdx) ? 34 : 17;
      hands[s].x = dampN(hands[s].x, tgt[s][0], rate, dt);
      hands[s].y = dampN(hands[s].y, tgt[s][1], rate, dt);
      hands[s].z = dampN(hands[s].z, tgt[s][2], rate, dt);
      const sjx = shX + rtx * side * P.SHW / 2, sjz = shZ + rtz * side * P.SHW / 2;
      let hxv, hyv, hzv;
      if (style === STYLE.RISE || style === STYLE.FOLLOW) { hxv = -fx * 0.8; hyv = -0.25; hzv = -fz * 0.8; }
      else { hxv = rx * side * 0.8 - fx * 0.25; hyv = -0.55; hzv = rz * side * 0.8 - fz * 0.25; }
      ik(sjx, shY, sjz, hands[s].x, hands[s].y, hands[s].z, P.A1, P.A2, hxv, hyv, hzv, IKO);
      seg(F.aU[s], sjx, shY, sjz, IKO.kx, IKO.ky, IKO.kz);
      seg(F.aF[s], IKO.kx, IKO.ky, IKO.kz, IKO.ex, IKO.ey, IKO.ez);
      F.hand[s].position.set(IKO.ex, IKO.ey, IKO.ez);
    }
    if (ring) {
      ring.visible = (style === STYLE.DRIB || style === STYLE.HELD || style === STYLE.GATH);
      const h = F.hand[ballIdx].position;
      ring.position.copy(h); ring.rotation.set(G.t * 2, yaw, 0);
    }
    if (pivotRing) {
      const pv = p.pivot;
      pivotRing.visible = (pv === 0 || pv === 1);
      if (pivotRing.visible) pivotRing.position.set(feet[pv].x, 0.015, feet[pv].z);
    }
    shadow.position.set(x, 0.011 + (isDef ? 0.001 : 0), z);
    const ss = 1 - clamp(lift, 0, 0.6) * 0.7;
    shadow.scale.set(ss, ss, ss);
    shadow.material.opacity = 0.4 * ss;
  }
  return { pose, snapTo };
}

const figO = makeFigure(0xf1ebdd, 0xffcf4d, false);
const figD = makeFigure(0xd8482c, 0x14141a, true);

/* ---------- ball ---------- */
const ball = (function () {
  const mat = new THREE.MeshLambertMaterial({ color: 0xff9a3d });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(BALL_R, 14, 11), mat);
  const seamM = new THREE.MeshBasicMaterial({ color: 0x63370f });
  const s1 = new THREE.Mesh(new THREE.TorusGeometry(BALL_R, 0.0045, 4, 22), seamM);
  const s2 = s1.clone(); s2.rotation.y = Math.PI / 2;
  mesh.add(s1); mesh.add(s2);
  scene.add(mesh);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5),
    new THREE.MeshBasicMaterial({ map: BLOB, transparent: true, opacity: 0.35, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; scene.add(shadow);

  const B = {
    mesh, x: 0, y: 1, z: 7, vx: 0, vy: 0, vz: 0,
    st: 'held', t: 0, T: 0, meta: null, prevPhase: 0,
    latCur: 1, rt: 0, ang0: 0, deadT: 0, netHit: false, ducked: false, slowed: false, spin: 0
  };
  B.update = function (dt) {
    if (B.st === 'dribble') {
      const hang = O.hang > 0;
      if (!hang) O.dribPhase += dt / O.dribDur;
      const ph = O.dribPhase % 1;
      if (B.prevPhase < 0.5 && ph >= 0.5) { SND.bounce(clamp(0.4 + O.spd * 0.14, 0.4, 1)); O.dribbles++; }
      B.prevPhase = ph;
      const fxv = Math.sin(O.yaw), fzv = Math.cos(O.yaw);
      const rxv = -fzv, rzv = fxv;
      B.latCur = dampN(B.latCur, O.latTgt, 16, dt);
      const hx = O.x + rxv * B.latCur * 0.40 + fxv * O.fwdOff;
      const hz = O.z + rzv * B.latCur * 0.40 + fzv * O.fwdOff;
      const hH = (O.lowT > 0 ? 0.58 : (hang ? 1.16 : 1.02)) - O.crouch * 0.18;
      const yv = BALL_R + (hH - BALL_R) * Math.pow(Math.abs(Math.cos(Math.PI * ph)), 1.22);
      B.x = dampN(B.x, hx, 22, dt); B.z = dampN(B.z, hz, 22, dt);
      B.y = hang ? hH : yv;
      B.spin += dt * (2 + O.spd);
    } else if (B.st === 'held') {
      const fxv = Math.sin(O.yaw), fzv = Math.cos(O.yaw);
      const rxv = -fzv, rzv = fxv;
      const rootY = P.HIP * (1 - O.crouch * 0.34) + O.lift;
      B.x = dampN(B.x, O.x + rxv * O.hand * 0.30 + fxv * 0.12, 18, dt);
      B.z = dampN(B.z, O.z + rzv * O.hand * 0.30 + fzv * 0.12, 18, dt);
      B.y = dampN(B.y, rootY + 0.08, 18, dt);
    } else if (B.st === 'carry') {
      /* controller-driven */
    } else if (B.st === 'flight') {
      B.t += dt;
      B.x += B.vx * dt; B.z += B.vz * dt;
      B.vy += GRAV * dt; B.y += B.vy * dt;
      B.spin -= dt * 10;
      if (B.meta) {
        if (!B.ducked && B.meta.pure && B.t > B.T - 0.30) { B.ducked = true; SND.duck(1.8); }
        if (!B.slowed && B.meta.pure && B.t > B.T - 0.22) {
          B.slowed = true;
          G.setSlow(0.35, B.meta.cooked ? 0.8 : 0.55);
        }
      }
      if (B.t >= B.T) arrive();
    } else if (B.st === 'in') {
      B.x += B.vx * dt; B.z += B.vz * dt;
      B.vy += GRAV * dt; B.y += B.vy * dt;
      if (!B.netHit && B.y < RIM.y - 0.06) {
        B.netHit = true;
        net.snap(B.meta.pure ? 1 : 0.65);
        B.vx *= 0.25; B.vz *= 0.25; B.vy *= 0.55;
        G.onNet();
      }
      if (B.y < BALL_R + 0.02) { B.st = 'loose'; B.vy = Math.abs(B.vy) * 0.35; B.deadT = 0; }
    } else if (B.st === 'rattle') {
      B.rt += dt / 0.55;
      const a = B.ang0 + B.rt * 6.8;
      const r = lerp(0.15, 0.045, Math.min(1, B.rt));
      B.x = RIM.x + Math.sin(a) * r; B.z = RIM.z + Math.cos(a) * r;
      B.y = RIM.y + 0.05 - B.rt * 0.22;
      if (B.rt > 0.5 && B.rt - dt / 0.55 <= 0.5) SND.rim(0.5);
      if (B.rt >= 1) {
        B.st = 'in'; B.vx = 0; B.vz = 0; B.vy = -1.4;
        B.x = RIM.x; B.z = RIM.z;
      }
    } else if (B.st === 'loose') {
      B.x += B.vx * dt; B.z += B.vz * dt;
      B.vy += GRAV * dt; B.y += B.vy * dt;
      if (B.y < BALL_R) {
        B.y = BALL_R;
        if (Math.abs(B.vy) > 0.8) SND.bounce(clamp(Math.abs(B.vy) * 0.14, 0.15, 0.8));
        B.vy = Math.abs(B.vy) * 0.52; B.vx *= 0.72; B.vz *= 0.72;
      }
      B.deadT += dt;
      if (B.deadT > 1.15 || (Math.abs(B.vy) < 0.4 && B.y <= BALL_R + 0.01 && hyp(B.vx, B.vz) < 0.4)) {
        B.st = 'rest'; G.onBallDead();
      }
    }
    mesh.position.set(B.x, B.y, B.z);
    mesh.rotation.x = B.spin;
    shadow.position.set(B.x, 0.013, B.z);
    const ss = clamp(1 - (B.y - BALL_R) * 0.16, 0.3, 1);
    shadow.scale.set(ss, ss, ss);
    shadow.material.opacity = 0.35 * ss;
  };
  function arrive() {
    const m = B.meta;
    if (m.kind === 'in') {
      B.st = 'in';
      if (!m.pure) { SND.tick(); SND.rim(0.22); }
    } else if (m.kind === 'rattle') {
      B.st = 'rattle'; B.rt = 0;
      B.ang0 = Math.atan2(B.x - RIM.x, B.z - RIM.z);
      SND.rim(0.85);
    } else {
      if (m.board) SND.board(); else SND.rim(1);
      const nx0 = B.x - RIM.x, nz0 = B.z - RIM.z;
      const nl = hyp(nx0, nz0) || 1;
      B.vx = (nx0 / nl) * rand(1.6, 2.6) + rand(-0.7, 0.7);
      B.vz = (nz0 / nl) * rand(1.6, 2.6) + rand(-0.4, 0.9);
      B.vy = rand(2.2, 3.6);
      B.st = 'loose'; B.deadT = 0;
      G.onRimOut();
    }
  }
  B.launch = function (fx, fy, fz, tx, ty, tz, T, meta) {
    B.st = 'flight'; B.t = 0; B.T = T; B.meta = meta;
    B.netHit = false; B.ducked = false; B.slowed = false; B.deadT = 0;
    B.x = fx; B.y = fy; B.z = fz;
    B.vx = (tx - fx) / T;
    B.vz = (tz - fz) / T;
    B.vy = (ty - fy - 0.5 * GRAV * T * T) / T;
  };
  B.setPos = function (x, y, z) { B.x = x; B.y = y; B.z = z; };
  return B;
})();

/* ---------- input ---------- */
const Input = {
  active: false, id: -1, ax: 0, ay: 0, cx: 0, cy: 0,
  downT: 0, lastFlick: -9, samples: [], flicks: [],
  released: null, pressed: false, checkPress: false,
  mag: 0, mwx: 0, mwz: 0, neutralT: 0, rect: null, flickWorld: null
};
function ptXY(e) {
  const r = Input.rect || stage.getBoundingClientRect();
  return { x: e.clientX - r.left, y: e.clientY - r.top };
}
stage.addEventListener('pointerdown', e => {
  if (e.target.closest('button') || e.target.closest('.panel')) return;
  audioInit();
  if (G.phase === 'menu' || G.phase === 'over') return;
  if (Replay.on) { Replay.skip = true; return; }
  Input.rect = stage.getBoundingClientRect();
  const p = ptXY(e);
  if (G.phase === 'check') { G.beginLive(); Input.checkPress = true; }
  else if (p.y < SH * 0.34 && G.phase === 'live') return;
  else Input.checkPress = false;
  Input.active = true; Input.id = e.pointerId;
  Input.ax = p.x; Input.ay = p.y; Input.cx = p.x; Input.cy = p.y;
  Input.downT = G.t; Input.samples.length = 0;
  Input.samples.push({ t: G.t, x: p.x, y: p.y });
  Input.pressed = true;
  Input.neutralT = 0;
  try { stage.setPointerCapture(e.pointerId); } catch (err) {}
}, { passive: true });
stage.addEventListener('pointermove', e => {
  if (!Input.active || e.pointerId !== Input.id) return;
  const p = ptXY(e);
  Input.cx = p.x; Input.cy = p.y;
  Input.samples.push({ t: G.t, x: p.x, y: p.y });
  while (Input.samples.length > 2 && G.t - Input.samples[0].t > 0.13) Input.samples.shift();
  let dx = Input.cx - Input.ax, dy = Input.cy - Input.ay;
  const maxR = SW * 0.17, dl = hyp(dx, dy);
  if (dl > maxR) { const ex = (dl - maxR) / dl; Input.ax += dx * ex; Input.ay += dy * ex; }
  if (G.t - Input.lastFlick > 0.13 && Input.samples.length >= 2) {
    const s0 = Input.samples[0], s1 = Input.samples[Input.samples.length - 1];
    const ddt = Math.max(0.001, s1.t - s0.t);
    const fdx = s1.x - s0.x, fdy = s1.y - s0.y;
    const dist = hyp(fdx, fdy);
    if (dist / ddt > SW * 2.4 && dist > SW * 0.05) {
      Input.flicks.push({ sx: fdx / dist, sy: fdy / dist });
      Input.lastFlick = G.t;
      Input.ax = Input.cx; Input.ay = Input.cy;
      Input.samples.length = 0;
    }
  }
}, { passive: true });
function pointerEnd(e) {
  if (!Input.active || e.pointerId !== Input.id) return;
  Input.active = false;
  Input.released = { quick: (G.t - Input.downT) < 0.14, check: Input.checkPress };
  Input.checkPress = false;
  Input.mag = 0; Input.mwx = 0; Input.mwz = 0;
}
stage.addEventListener('pointerup', pointerEnd, { passive: true });
stage.addEventListener('pointercancel', pointerEnd, { passive: true });
stage.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
document.addEventListener('gesturestart', e => e.preventDefault());

Input.update = function (dt) {
  Input.flickWorld = null;
  if (Input.flicks.length) {
    const f = Input.flicks.shift();
    Input.flickWorld = {
      x: Cam.rightX * f.sx + Cam.fwdX * (-f.sy),
      z: Cam.rightZ * f.sx + Cam.fwdZ * (-f.sy)
    };
  }
  if (Input.active) {
    const dx = Input.cx - Input.ax, dy = Input.cy - Input.ay;
    const dl = hyp(dx, dy), maxR = SW * 0.17;
    const m = clamp(dl / maxR, 0, 1);
    Input.mag = m;
    if (m > 0.04) {
      const nx = dx / dl, ny = dy / dl;
      Input.mwx = (Cam.rightX * nx + Cam.fwdX * (-ny)) * m;
      Input.mwz = (Cam.rightZ * nx + Cam.fwdZ * (-ny)) * m;
    } else { Input.mwx = 0; Input.mwz = 0; }
    if (m < 0.12) Input.neutralT += dt; else Input.neutralT = 0;
  } else { Input.neutralT = 0; }
};

/* ---------- defender soul (memory + voice) ---------- */
const SOUL = {
  name: 'THE FENCE', memLat: 0, fakesSeen: 0, hesisSeen: 0, stepsSeen: 0,
  lastSay: -9,
  checkLines: ['check.', "you're not scoring here", "island's mine", 'run it', 'show me something'],
  learnedR: ["I know you're going right", 'that right hand again?'],
  learnedL: ['left again? I see you', 'going left. called it.'],
  stopLines: ['get that outta here', 'clamped.', 'too small', 'not tonight', 'read it all day'],
  panicLines: ['?!', 'wait—', 'oh no', 'my ankles—'],
  saltLines: ['...', 'lucky.', 'do that again. bet.', 'aight.'],
  reset(name) {
    SOUL.name = name; SOUL.memLat = 0; SOUL.fakesSeen = 0;
    SOUL.hesisSeen = 0; SOUL.stepsSeen = 0; SOUL.lastSay = -9;
  }
};
let sayUntil = -1;
function say(txt, dur, force) {
  if (!force && G.t - SOUL.lastSay < 1.1) return;
  SOUL.lastSay = G.t;
  ui.say.textContent = txt;
  sayUntil = G.t + (dur || 1.4);
}
function updateSay() {
  if (sayUntil < G.t || G.phase === 'menu' || Replay.on) { ui.say.classList.remove('show'); return; }
  const headY = 1.95 - D.crouch * 0.3 + D.lift;
  _sayV.set(D.x, headY + 0.32, D.z).project(camera);
  if (_sayV.z > 1) { ui.say.classList.remove('show'); return; }
  const sx = clamp((_sayV.x * 0.5 + 0.5) * SW, 50, SW - 50);
  const sy = clamp((-_sayV.y * 0.5 + 0.5) * SH, 30, SH - 30);
  ui.say.style.left = sx + 'px';
  ui.say.style.top = sy + 'px';
  ui.say.classList.add('show');
}

/* ---------- offense ---------- */
const O = {
  x: 0, z: 7.9, vx: 0, vz: 0, yaw: Math.PI, crouch: 0.34, lift: 0, spd: 0, spdMem: 0,
  st: 'idle', hand: 1, latTgt: 1, lowT: 0, hang: 0,
  dribPhase: 0.2, dribDur: 0.5, fwdOff: 0.14,
  move: null, windowT: 0, windowType: '', chain: 0, chainT: 0,
  dribbles: 0, pickedUp: false, pivot: -1, burstT: 0, hesiArmed: true,
  gT: 0, gDur: 0.2, riseT: 0, riseDur: 0.3, fallT: 0, jumpH: 0.5,
  shotType: 'set', speedAtGather: 0, midMoveAtG: false, crowdedAtG: false, rhythmAtG: 0,
  relX: 0, relY: 0, relZ: 0, followT: 0, contactCd: 0, pivotShown: false,
  gFromX: 0, gFromY: 0, gFromZ: 0, fakeT: 0
};
function oReset(x, z) {
  O.x = x; O.z = z; O.vx = 0; O.vz = 0; O.yaw = Math.PI;
  O.st = 'idle'; O.hand = 1; O.latTgt = 1; O.lowT = 0; O.hang = 0;
  O.dribPhase = 0.2; O.move = null; O.windowT = 0; O.chain = 0;
  O.dribbles = 0; O.pickedUp = false; O.pivot = -1; O.burstT = 0;
  O.lift = 0; O.followT = 0; O.crouch = 0.34; O.contactCd = 0; O.spdMem = 0;
}
function chainUp(n) {
  O.chain = Math.min(3, O.chain + (n || 1)); O.chainT = 1.2;
  G.heat = clamp(G.heat + 0.13 * (n || 1), 0, 1);
}
function impulse(ax, az) { O.vx += ax; O.vz += az; }

function startMove(type, dir, wx, wz) {
  const toX = RIM.x - O.x, toZ = RIM.z - O.z;
  const tl = hyp(toX, toZ) || 1;
  const fx = toX / tl, fz = toZ / tl;
  const rx = -fz, rz = fx;
  const M = { type, t: 0, dur: 0.26, dir };
  switch (type) {
    case 'cross':
      M.dur = 0.26; O.hand = -O.hand; O.latTgt = O.hand; O.lowT = 0.18;
      impulse(rx * dir * 2.9, rz * dir * 2.9);
      D.event('lat', dir); SOUL.memLat = SOUL.memLat * 0.8 + dir * 0.2;
      SND.squeak(0.6); chainUp();
      break;
    case 'inout':
      M.dur = 0.34; M.fakeDir = dir;
      D.event('lat', dir, 0.7); SOUL.memLat = SOUL.memLat * 0.85 + dir * 0.15;
      SND.squeak(0.4); chainUp();
      break;
    case 'hesi':
      M.dur = 0.30; O.hang = 0.24;
      D.event('hesi', 0); SOUL.hesisSeen++;
      chainUp();
      break;
    case 'snatch':
      M.dur = 0.32; O.lowT = 0.1; O.fwdOff = -0.28; O.latTgt = O.hand * 0.25;
      impulse(-fx * 3.5, -fz * 3.5);
      O.windowT = 0.55; O.windowType = 'snatch';
      D.event('snatch', 0); SND.squeak(0.8); chainUp(2);
      break;
    case 'stepback':
      M.dur = 0.36; O.lowT = 0.12;
      impulse(-fx * 2.7 + rx * dir * 2.1, -fz * 2.7 + rz * dir * 2.1);
      O.windowT = 0.62; O.windowType = 'step';
      D.event('step', dir); SOUL.stepsSeen++;
      SND.squeak(0.9); chainUp(2);
      break;
    case 'burst':
      M.dur = 0.2; O.burstT = 0.4;
      impulse(wx * 2.4, wz * 2.4);
      D.event('drive', dir); SND.squeak(0.7);
      break;
    case 'stepthrough':
      M.dur = 0.34;
      impulse(fx * 3.4, fz * 3.4);
      SND.squeak(0.9); chainUp(2);
      break;
  }
  O.move = M;
}
function interpretFlick(f) {
  const toX = RIM.x - O.x, toZ = RIM.z - O.z;
  const tl = hyp(toX, toZ) || 1;
  const fx = toX / tl, fz = toZ / tl;
  const rx = -fz, rz = fx;
  const fw = f.x * fx + f.z * fz;
  const lt = f.x * rx + f.z * rz;
  const dDist = hyp(D.x - O.x, D.z - O.z);
  const dLat = (D.x - (O.x + fx * dDist)) * rx + (D.z - (O.z + fz * dDist)) * rz;

  if (O.pickedUp) {
    if (fw > 0.5 && (D.airT > 0 || D.beatenT > 0)) startMove('stepthrough', 0, f.x, f.z);
    return;
  }
  if (fw > 0.6 && Math.abs(lt) < 0.55) { startMove('burst', sgn(lt || rand(-1, 1)), f.x, f.z); return; }
  if (fw < -0.4 && Math.abs(lt) > 0.42) { startMove('stepback', sgn(lt)); return; }
  if (fw < -0.55) {
    if (O.vx * fx + O.vz * fz > 1.5) startMove('snatch', 0);
    else { impulse(-fx * 1.6, -fz * 1.6); SND.squeak(0.3); }
    return;
  }
  if (Math.abs(lt) >= 0.5) {
    const dir = sgn(lt);
    if (dLat * dir > 0.28) startMove('inout', dir);
    else startMove('cross', dir);
    return;
  }
  startMove('cross', sgn(lt || 1));
}
function tryShoot() {
  if (!(O.st === 'idle' || O.st === 'dribble' || O.st === 'stopped' || O.st === 'fake')) return;
  if (G.phase !== 'live') return;
  O.st = 'gather';
  O.gT = 0;
  O.speedAtGather = O.spd;
  O.gDur = 0.20 + (O.spd > 3 ? 0.05 : 0);
  O.midMoveAtG = !!O.move && O.move.type !== 'burst';
  O.crowdedAtG = hyp(D.x - O.x, D.z - O.z) < 0.95;
  const ph = O.dribPhase % 1;
  O.rhythmAtG = Math.abs(Math.cos(Math.PI * ph)) > 0.62 ? 1 : 0;
  O.gFromX = ball.x; O.gFromY = ball.y; O.gFromZ = ball.z;
  ball.st = 'carry';
  D.event('gather', 0);
}
function startFake() {
  O.st = 'fake'; O.fakeT = 0;
  SOUL.fakesSeen++;
  D.reactFake();
  SND.whoosh();
}
function beginRise() {
  const toDist = hyp(RIM.x - O.x, RIM.z - O.z);
  const toX = (RIM.x - O.x), toZ = (RIM.z - O.z);
  const tl = toDist || 1;
  const fwdV = (O.vx * toX + O.vz * toZ) / tl;
  if (O.windowT > 0 && O.windowType === 'step') O.shotType = 'fade';
  else if (fwdV < -1.0) O.shotType = 'fade';
  else if (fwdV > 1.4 && toDist > 2.4) O.shotType = 'pullup';
  else if (toDist <= 2.4) O.shotType = 'drive';
  else O.shotType = 'set';
  O.jumpH = { set: 0.52, pullup: 0.47, fade: 0.42, drive: 0.44 }[O.shotType];
  O.riseT = 0; O.riseDur = 0.3;
  O.st = 'rise';
  if (O.shotType === 'pullup') { O.vx *= 0.35; O.vz *= 0.35; }
  else if (O.shotType === 'fade') { O.vx = -toX / tl * 1.1; O.vz = -toZ / tl * 1.1; }
  else if (O.shotType === 'drive') { O.vx *= 0.5; O.vz *= 0.5; }
  else { O.vx = 0; O.vz = 0; }
}

function offenseUpdate(dt) {
  const inp = Input;
  const toX = RIM.x - O.x, toZ = RIM.z - O.z;
  const toD = hyp(toX, toZ) || 1;
  const fx = toX / toD, fz = toZ / toD;

  if (inp.released) {
    const r = inp.released; inp.released = null;
    if (!r.check) {
      if (O.st === 'gather' || O.st === 'rise' || O.st === 'fall') { /* in flight already */ }
      else tryShoot();
    }
  }
  if (inp.pressed) {
    inp.pressed = false;
    if (O.st === 'gather' && O.gT < O.gDur * 0.95) startFake();
  }

  if (O.st === 'gather') {
    O.gT += dt;
    const t = clamp(O.gT / O.gDur, 0, 1);
    O.crouch = dampN(O.crouch, 0.55, 16, dt);
    const rootY = P.HIP * (1 - O.crouch * 0.34);
    const cx = O.x + fx * 0.24, cy = rootY + 0.42, cz = O.z + fz * 0.24;
    ball.setPos(lerp(O.gFromX, cx, t), lerp(O.gFromY, cy, t), lerp(O.gFromZ, cz, t));
    if (t >= 1) beginRise();
  } else if (O.st === 'rise') {
    O.riseT += dt;
    const t = clamp(O.riseT / O.riseDur, 0, 1);
    O.lift = O.jumpH * Math.sin(t * Math.PI / 2);
    O.crouch = dampN(O.crouch, 0.12, 14, dt);
    O.x += O.vx * dt; O.z += O.vz * dt;
    const rootY = P.HIP * (1 - O.crouch * 0.34) + O.lift;
    const cy0 = rootY + 0.42, cy1 = rootY + 0.92;
    ball.setPos(O.x + fx * lerp(0.24, 0.16, t), lerp(cy0, cy1, t), O.z + fz * lerp(0.24, 0.16, t));
    if (t >= 1) releaseBall();
  } else if (O.st === 'fall') {
    O.fallT += dt;
    const t = clamp(O.fallT / 0.3, 0, 1);
    O.lift = O.jumpH * Math.cos(t * Math.PI / 2);
    O.x += O.vx * dt * 0.6; O.z += O.vz * dt * 0.6;
    O.followT += dt;
    if (t >= 1) { O.lift = 0; O.st = 'recover'; SND.squeak(0.3); }
  } else if (O.st === 'fake') {
    O.fakeT += dt;
    const t = clamp(O.fakeT / 0.30, 0, 1);
    const rootY = P.HIP * (1 - O.crouch * 0.34);
    const up = Math.sin(t * Math.PI);
    ball.setPos(O.x + fx * 0.24, rootY + 0.42 + up * 0.42, O.z + fz * 0.24);
    O.crouch = dampN(O.crouch, 0.3 + (1 - up) * 0.2, 12, dt);
    if (t >= 1) {
      if (O.pickedUp) { O.st = 'stopped'; ball.st = 'held'; }
      else { O.st = 'dribble'; ball.st = 'dribble'; O.dribPhase = 0.15; }
      O.windowT = Math.max(O.windowT, 0.4);
      if (!O.windowType) O.windowType = 'fake';
    }
  } else if (O.st === 'recover') {
    O.vx = dampN(O.vx, 0, 6, dt); O.vz = dampN(O.vz, 0, 6, dt);
    O.x += O.vx * dt; O.z += O.vz * dt;
    O.crouch = dampN(O.crouch, 0.3, 6, dt);
  } else {
    /* grounded ball-handling */
    let tvx = 0, tvz = 0;
    const maxs = 4.45 + (O.burstT > 0 ? 1.25 : 0);
    if (!O.pickedUp) {
      if (inp.active && inp.mag > 0.04) {
        const curve = Math.pow(inp.mag, 1.35);
        tvx = inp.mwx / (inp.mag || 1) * curve * maxs;
        tvz = inp.mwz / (inp.mag || 1) * curve * maxs;
        if (O.st === 'idle') { O.st = 'dribble'; ball.st = 'dribble'; }
      }
      if (inp.active && O.spdMem > 1.6 && inp.neutralT > 0.12 && O.hesiArmed && !O.move) {
        O.hesiArmed = false; startMove('hesi', 0);
      }
      if (!inp.active || inp.mag > 0.3) O.hesiArmed = true;
      if (inp.flickWorld && !O.move) interpretFlick(inp.flickWorld);
      else if (inp.flickWorld && O.move && O.move.t > O.move.dur * 0.55) { O.move = null; interpretFlick(inp.flickWorld); }
    } else {
      if (inp.flickWorld) interpretFlick(inp.flickWorld);
      if (inp.active && !O.move) {
        const latIn = inp.mwx * (-fz) + inp.mwz * fx;
        O.yaw += clamp(latIn, -1, 1) * dt * 2.3;
      }
    }
    const accel = O.burstT > 0 ? 22 : 13;
    O.vx = dampN(O.vx, tvx, accel, dt);
    O.vz = dampN(O.vz, tvz, accel, dt);
    if (O.pickedUp && O.st === 'stopped' && !O.move) { O.vx = 0; O.vz = 0; }
    O.x += O.vx * dt; O.z += O.vz * dt;

    if (O.move) {
      const M = O.move; M.t += dt;
      if (M.type === 'inout') {
        const t = M.t / M.dur;
        O.latTgt = t < 0.45 ? lerp(O.hand, -O.hand * 0.55, t / 0.45) : lerp(-O.hand * 0.55, O.hand, (t - 0.45) / 0.55);
        if (t < 0.4) O.lowT = 0.05;
      }
      if (M.type === 'hesi') O.crouch = dampN(O.crouch, 0.12, 14, dt);
      if (M.type === 'stepthrough' && M.t >= M.dur) { O.move = null; tryShoot(); }
      else if (M.t >= M.dur) {
        if (M.type === 'snatch') O.fwdOff = 0.14;
        if (M.type !== 'inout') O.latTgt = O.hand;
        O.move = null;
      }
    } else {
      O.latTgt = dampN(O.latTgt, O.hand * (O.spd < 0.6 && toD > ARC_R - 1 ? 0.92 : 1), 8, dt);
      O.fwdOff = dampN(O.fwdOff, (O.vx * fx + O.vz * fz) < -0.8 ? -0.2 : 0.14, 8, dt);
    }
    const base = O.pickedUp ? 0.42 : (inp.active && inp.mag < 0.12 && O.spd < 0.8 ? 0.46 : 0.32 + Math.min(0.14, O.spd * 0.03));
    if (!O.move || O.move.type !== 'hesi') O.crouch = dampN(O.crouch, base, 8, dt);
    let wantYaw = Math.atan2(fx, fz);
    if (O.spd > 2.6) {
      const vy = Math.atan2(O.vx / O.spd, O.vz / O.spd);
      let dyaw = vy - wantYaw;
      while (dyaw > Math.PI) dyaw -= Math.PI * 2;
      while (dyaw < -Math.PI) dyaw += Math.PI * 2;
      wantYaw += clamp(dyaw, -0.7, 0.7) * 0.5;
    }
    let dy2 = wantYaw - O.yaw;
    while (dy2 > Math.PI) dy2 -= Math.PI * 2;
    while (dy2 < -Math.PI) dy2 += Math.PI * 2;
    O.yaw += dy2 * Math.min(1, 10 * dt);
  }

  O.burstT = Math.max(0, O.burstT - dt);
  O.hang = Math.max(0, O.hang - dt);
  O.lowT = Math.max(0, O.lowT - dt);
  O.windowT = Math.max(0, O.windowT - dt);
  O.chainT -= dt; if (O.chainT <= 0) { O.chain = Math.max(0, O.chain - 1); O.chainT = 0.9; }
  O.contactCd = Math.max(0, O.contactCd - dt);
  O.dribDur = lerp(0.52, 0.34, clamp(O.spd / 5, 0, 1));
  O.spd = hyp(O.vx, O.vz);
  O.spdMem = Math.max(O.spd, O.spdMem * Math.exp(-2.2 * dt));

  O.x = clamp(O.x, -BOUNDS.x, BOUNDS.x);
  O.z = clamp(O.z, BOUNDS.zmin, BOUNDS.zmax);

  const dx = O.x - D.x, dz = O.z - D.z;
  const dd = hyp(dx, dz);
  if (dd < 0.62 && dd > 0.001) {
    const nx = dx / dd, nzv = dz / dd, push = (0.62 - dd);
    const closing = -(O.vx * nx + O.vz * nzv);
    if (!O.pickedUp && O.contactCd <= 0 && closing > 2.1 && O.spd > 2.2 &&
        (O.st === 'dribble') && !O.move) {
      O.vx *= 0.12; O.vz *= 0.12;
      O.pickedUp = true; O.st = 'stopped'; ball.st = 'held';
      O.pivot = O.hand > 0 ? 0 : 1;
      O.windowT = 0.85; O.windowType = 'bump';
      D.vx -= nx * 1.4; D.vz -= nzv * 1.4; D.staggerT = 0.25;
      SND.thud(); SND.squeak(1); chainUp();
      O.contactCd = 0.8;
      if (!O.pivotShown) { showCue('bump stop — release to shoot · tap again to fake'); O.pivotShown = true; }
    }
    O.x += nx * push * 0.7; O.z += nzv * push * 0.7;
    D.x -= nx * push * 0.5; D.z -= nzv * push * 0.5;
  }
}

/* ---------- shot resolution ---------- */
function releaseBall() {
  const dx = RIM.x - O.x, dz = RIM.z - O.z;
  const dist = hyp(dx, dz);
  const relY = P.HIP * (1 - O.crouch * 0.34) + O.lift + 0.92;
  O.relX = O.x + (dx / (dist || 1)) * 0.16;
  O.relZ = O.z + (dz / (dist || 1)) * 0.16;
  O.relY = relY;

  const sep = hyp(D.x - O.x, D.z - O.z);
  const beaten = (D.beatenT > 0) || (D.airT > 0 && D.airKind === 'fake') || D.freezeT > 0;
  const sepEff = sep + (beaten ? 0.7 : 0);
  const sepS = clamp((sepEff - 0.5) / 1.6, 0, 1);

  let balance = clamp(1 - O.speedAtGather / 5.2, 0, 1);
  if (O.windowT > 0 && (O.windowType === 'step' || O.windowType === 'snatch')) balance = Math.max(balance, 0.88);
  if (O.shotType === 'fade' && !(O.windowType === 'step' && O.windowT > 0)) balance *= 0.72;
  if (O.midMoveAtG) balance *= 0.7;

  let gatherQ = 0.45 + O.rhythmAtG * 0.35 + (O.crowdedAtG ? 0 : 0.2);
  gatherQ = clamp(gatherQ, 0, 1);
  const rhythm = clamp(0.25 + O.chain * 0.18, 0, 1);

  const cd = hyp(D.x - O.x, D.z - O.z);
  let contest = clamp(1 - (cd - 0.35) / 1.25, 0, 1);
  let cTag;
  const armUp = D.airT > 0 && D.airKind === 'contest';
  if (D.beatenT > 0 || D.freezeT > 0) { contest *= 0.18; cTag = 'NONE'; }
  else if (D.airKind === 'fake' && D.airT > 0) { contest *= 0.1; cTag = 'NONE'; }
  else if (!armUp) { contest *= 0.5; cTag = contest > 0.15 ? 'LATE' : 'NONE'; }
  else cTag = contest > 0.6 ? 'HEAVY' : contest > 0.3 ? 'CLOSE' : 'LATE';

  const fatigue = clamp((G.t - G.possStart - 8) / 12, 0, 0.28) + clamp((O.dribbles - 9) * 0.015, 0, 0.12);
  const clockRush = (G.mode !== 'free') ? (G.clock < 1.2 ? 0.18 : G.clock < 2.5 ? 0.08 : 0) : 0;
  const distF = dist <= 2.6 ? 1.04 : clamp(1 - (dist - 3) / 15, 0.55, 1);

  const Q = distF * clamp(
    0.20 + 0.34 * sepS + 0.21 * balance + 0.16 * gatherQ + 0.10 * rhythm + 0.04 * G.heat
    - 0.44 * contest - fatigue - clockRush, 0, 1);

  const green = Q > 0.85 && contest < 0.15;
  const make = Math.random() < clamp(Q * 1.25 - 0.02, 0.04, 0.97);
  const beatenRecent = (G.t - D.beatenStamp) < 2.2;
  let outcome, meta;
  if (make) {
    if (contest < 0.14 && Q > 0.68) {
      const cooked = beatenRecent && sepS > 0.66;
      outcome = cooked ? 'cooked' : 'pure';
      meta = { kind: 'in', pure: true, cooked };
    } else if (Q > 0.5) { outcome = 'clean'; meta = { kind: 'in', pure: false }; }
    else { outcome = 'rimmake'; meta = { kind: 'rattle', pure: false }; }
  } else {
    outcome = 'miss';
    meta = { kind: 'out' };
  }

  let ox = 0, oz = 0;
  const sx = (O.x - RIM.x) / (dist || 1), sz = (O.z - RIM.z) / (dist || 1);
  if (outcome === 'pure' || outcome === 'cooked') { const a = rand(Math.PI * 2), r = rand(0.03); ox = Math.sin(a) * r; oz = Math.cos(a) * r; }
  else if (outcome === 'clean') { const a = rand(Math.PI * 2); ox = Math.sin(a) * 0.07; oz = Math.cos(a) * 0.07; }
  else if (outcome === 'rimmake') { const a = rand(Math.PI * 2); ox = Math.sin(a) * 0.16; oz = Math.cos(a) * 0.16; }
  else {
    let cause = 'off';
    if (contest > 0.45) cause = 'contest';
    else if (clockRush > 0.1 || balance < 0.4) cause = 'rushed';
    meta.cause = cause;
    const r = rand(0.25, 0.32);
    if (cause === 'contest') { ox = sx * r; oz = sz * r; }
    else if (cause === 'rushed') { ox = -sx * r; oz = -sz * r; meta.board = Math.abs(O.x) < 1.5 && Math.random() < 0.5; }
    else { const pS = sgn(rand(-1, 1)); ox = -sz * pS * r; oz = sx * pS * r; }
  }
  const T = clamp(0.62 + dist * 0.075, 0.8, 1.5);
  ball.launch(O.relX, O.relY, O.relZ, RIM.x + ox, RIM.y + 0.02, RIM.z + oz, T, meta);
  SND.whoosh();

  G.pending = {
    outcome, green, Q,
    pts: dist > ARC_R - 0.03 ? 2 : 1,
    grades: {
      sep: sepEff < 0.55 ? 'NONE' : sepEff < 1.05 ? 'TIGHT' : sepEff < 1.75 ? 'GOOD' : 'EXCELLENT',
      bal: balance < 0.45 ? 'RUSHED' : balance < 0.75 ? 'OK' : 'CLEAN',
      rel: (gatherQ * 0.6 + rhythm * 0.4) < 0.45 ? 'LATE' : (gatherQ * 0.6 + rhythm * 0.4) < 0.7 ? 'OK' : 'RHYTHM',
      con: cTag
    },
    cause: meta.cause || null, dist
  };
  G.clockRun = false;
  G.rec.relT = G.t;
  O.st = 'fall'; O.fallT = 0; O.followT = 0;
}

/* ---------- defender ---------- */
const D = {
  x: 0, z: 6.4, vx: 0, vz: 0, yaw: 0, crouch: 0.52, lift: 0,
  evts: [], lastCommit: null, mx: 0, mz: 0,
  beatenT: 0, freezeT: 0, airT: 0, airDur: 0.5, airKind: '',
  tend: 0, fakesBit: 0, crowdT: 0, reachT: 0, reachCd: 0,
  staggerT: 0, beatenStamp: -99, contestArm: 0, noSellT: 0
};
function dReset(x, z) {
  D.x = x; D.z = z; D.vx = 0; D.vz = 0; D.yaw = 0;
  D.evts.length = 0; D.lastCommit = null; D.mx = 0; D.mz = 0;
  D.beatenT = 0; D.freezeT = 0; D.airT = 0; D.crowdT = 0;
  D.reachT = 0; D.staggerT = 0; D.lift = 0; D.contestArm = 0; D.noSellT = 0;
  D.fakesBit = 0;
}
D.event = function (kind, dir, w) { D.evts.push({ at: G.t, kind, dir, w: w || 1 }); };
D.onCooked = function () {
  say(pick(SOUL.panicLines), 0.9, true);
};
D.reactFake = function () {
  const dd = hyp(D.x - O.x, D.z - O.z);
  if (dd > 1.5 || D.airT > 0 || D.beatenT > 0) return;
  const p = DIFF.biteFake * Math.pow(0.60, D.fakesBit + SOUL.fakesSeen * 0.4);
  if (Math.random() < p) {
    D.airT = D.airDur = 0.55; D.airKind = 'fake'; D.fakesBit++;
    const nx = (O.x - D.x) / (dd || 1), nzv = (O.z - D.z) / (dd || 1);
    D.vx += nx * 0.8; D.vz += nzv * 0.8;
    SND.squeak(0.8);
  } else { D.noSellT = 0.3; }
};
function defenderUpdate(dt) {
  for (let i = D.evts.length - 1; i >= 0; i--) {
    const e = D.evts[i];
    if (G.t - e.at < DIFF.react) continue;
    D.evts.splice(i, 1);
    if (D.beatenT > 0 || D.airT > 0) continue;
    const toX = RIM.x - O.x, toZ = RIM.z - O.z;
    const tl = hyp(toX, toZ) || 1;
    const rx = -toZ / tl, rz = toX / tl;
    if (e.kind === 'lat' || e.kind === 'step' || e.kind === 'drive') {
      if (D.lastCommit && e.dir === -D.lastCommit.dir && (G.t - D.lastCommit.t) < 0.5) {
        D.beatenT = rand(0.5, 0.75); D.beatenStamp = G.t;
        D.vx += rx * D.lastCommit.dir * 2.4; D.vz += rz * D.lastCommit.dir * 2.4;
        D.lastCommit = null;
        SND.squeak(1); Cam.shake = Math.max(Cam.shake, 0.35);
        D.onCooked();
      } else {
        const c = DIFF.commit * (e.w || 1) * (e.kind === 'drive' ? 0.6 : 1);
        D.mx += rx * e.dir * c; D.mz += rz * e.dir * c;
        D.lastCommit = { dir: e.dir, t: G.t };
        D.tend = D.tend * 0.6 + e.dir * 0.4;
      }
    } else if (e.kind === 'hesi') {
      const dd = hyp(D.x - O.x, D.z - O.z);
      const p = Math.max(0.12, DIFF.biteHesi - SOUL.hesisSeen * 0.07);
      if (dd < 2.4 && Math.random() < p) {
        D.freezeT = 0.34;
        const nx = (O.x - D.x) / (dd || 1), nzv = (O.z - D.z) / (dd || 1);
        D.vx += nx * 1.1; D.vz += nzv * 1.1;
      }
    } else if (e.kind === 'snatch') {
      const nx = O.x - D.x, nzv = O.z - D.z, nd = hyp(nx, nzv) || 1;
      const closing = (D.vx * nx + D.vz * nzv) / nd;
      if (closing > 1.2) { D.mx += (nx / nd) * 1.6; D.mz += (nzv / nd) * 1.6; }
    } else if (e.kind === 'gather') {
      if (D.contestArm === 0) D.contestArm = 0.001;
    }
  }
  D.mx *= Math.exp(-3.4 * dt); D.mz *= Math.exp(-3.4 * dt);

  const dd = hyp(D.x - O.x, D.z - O.z);
  const shooting = (O.st === 'gather' || O.st === 'rise');

  if (D.contestArm > 0 && shooting) {
    D.contestArm += dt;
    if (D.contestArm > 0.02 && D.airT <= 0 && D.beatenT <= 0 && D.freezeT <= 0 && dd < 1.8) {
      if (Math.random() < DIFF.jump) {
        D.airT = D.airDur = 0.5; D.airKind = 'contest';
        const nx = (O.x - D.x) / (dd || 1), nzv = (O.z - D.z) / (dd || 1);
        D.vx += nx * 1.7; D.vz += nzv * 1.7;
        SND.squeak(0.7);
      }
      D.contestArm = -1; // decided, don't re-roll
    }
  } else if (!shooting) D.contestArm = 0;

  if (D.airT > 0) {
    D.airT -= dt;
    const prog = 1 - Math.max(0, D.airT) / D.airDur;
    D.lift = 0.5 * Math.sin(prog * Math.PI);
    if (D.airT <= 0) { D.lift = 0; D.airKind = ''; SND.squeak(0.4); }
  }
  D.beatenT = Math.max(0, D.beatenT - dt);
  D.freezeT = Math.max(0, D.freezeT - dt);
  D.staggerT = Math.max(0, D.staggerT - dt);
  D.reachT = Math.max(0, D.reachT - dt);
  D.reachCd = Math.max(0, D.reachCd - dt);
  D.noSellT = Math.max(0, D.noSellT - dt);

  let tx, tz, cap = DIFF.maxs;
  const pdx = RIM.x - O.x, pdz = RIM.z - O.z;
  const pl = hyp(pdx, pdz) || 1;
  const nx = pdx / pl, nzv = pdz / pl;
  if (D.beatenT > 0) { tx = D.x; tz = D.z; cap = 0.6; }
  else if (D.freezeT > 0) { tx = D.x; tz = D.z; cap = 0.5; }
  else {
    let gd = 1.2;
    const oFwd = O.vx * nx + O.vz * nzv;
    if (O.spd > 3.1 && oFwd > 2.1) gd = 1.85;
    else if (O.spd < 0.8 && pl > ARC_R - 0.4) gd = 1.0;
    const blown = (O.z < D.z - 0.25 && Math.abs(O.x - D.x) < 1.15 && O.spd > 2.4);
    if (blown && D.beatenStamp < G.t - 0.6) { D.beatenStamp = G.t; if (Math.random() < 0.3) D.onCooked(); }
    tx = O.x + nx * gd; tz = O.z + nzv * gd;
    const learn = clamp(D.tend * 0.7 + SOUL.memLat * 0.6, -1, 1);
    const sh = learn * 0.34 * DIFF.shade;
    tx += -nzv * sh; tz += nx * sh;
  }
  const dvx = clamp((tx - D.x) * 5, -cap, cap) + D.mx;
  const dvz = clamp((tz - D.z) * 5, -cap, cap) + D.mz;
  D.vx = dampN(D.vx, dvx, DIFF.acc * 0.6, dt);
  D.vz = dampN(D.vz, dvz, DIFF.acc * 0.6, dt);
  const dspd = hyp(D.vx, D.vz);
  if (dspd > cap + 1.6) { D.vx *= (cap + 1.6) / dspd; D.vz *= (cap + 1.6) / dspd; }
  D.x += D.vx * dt; D.z += D.vz * dt;
  D.x = clamp(D.x, -BOUNDS.x, BOUNDS.x);
  D.z = clamp(D.z, BOUNDS.zmin - 0.2, BOUNDS.zmax);

  if (!O.pickedUp && O.spd < 1.2 && dd < 0.95 && (O.st === 'dribble' || O.st === 'idle')) {
    D.crowdT += dt;
    if (D.crowdT > 0.8 && D.reachCd <= 0) {
      D.reachT = 0.32; D.reachCd = 0.6;
      const exposed = O.hang > 0 ? 2 : 1;
      if (Math.random() < DIFF.strip * exposed * 0.5) G.turnover('STRIPPED');
    }
  } else D.crowdT = Math.max(0, D.crowdT - dt * 2);

  const wy = Math.atan2(O.x - D.x, O.z - D.z);
  let dy = wy - D.yaw;
  while (dy > Math.PI) dy -= Math.PI * 2;
  while (dy < -Math.PI) dy += Math.PI * 2;
  D.yaw += dy * Math.min(1, (D.beatenT > 0 ? 3 : 11) * dt);
  D.crouch = dampN(D.crouch, D.beatenT > 0 ? 0.25 : (dd < 1.1 ? 0.6 : 0.5) + (D.noSellT > 0 ? 0.1 : 0), 8, dt);
}

/* ---------- camera ---------- */
const Cam = {
  x: 0, y: 2.1, z: 12, lx: 0, ly: 1.4, lz: 4, fov: 56,
  fwdX: 0, fwdZ: -1, rightX: 1, rightZ: 0, shake: 0, beatT: 0, punch: 0
};
function camUpdate(dt) {
  let px, py, pz, lx, ly, lz, fov = 56;
  if (Replay.on) {
    const mx = (O.x + D.x) / 2, mz = (O.z + D.z) / 2;
    const dx = mx - RIM.x, dz = mz - RIM.z;
    const dl = hyp(dx, dz) || 1;
    px = mx + (-dz / dl) * 5.0; pz = mz + (dx / dl) * 5.0; py = 1.75;
    lx = mx; ly = 1.35; lz = mz - 0.5;
    fov = 50;
  } else {
    const fx0 = lerp(O.x, D.x, 0.42), fz0 = lerp(O.z, D.z, 0.42);
    const bx = O.x - RIM.x, bz = O.z - RIM.z;
    const bl = hyp(bx, bz) || 1;
    let back = 4.0, h = 2.12;
    if (G.phase === 'check') { back = 3.2; h = 1.9; }
    if (O.burstT > 0 || O.spd > 3.4) { back += 0.7; fov += 5; }
    if (O.st === 'gather' || O.st === 'rise') { back -= 0.55; fov -= 2; }
    if (ball.st === 'flight' || ball.st === 'in' || ball.st === 'rattle') {
      lx = lerp(fx0, ball.x, 0.55); ly = lerp(1.4, ball.y * 0.6 + 0.9, 0.6); lz = lerp(fz0 - 2.5, ball.z, 0.55);
    } else {
      lx = fx0 + (RIM.x - fx0) * 0.3; ly = 1.38; lz = fz0 + (RIM.z - fz0) * 0.3;
    }
    px = fx0 + (bx / bl) * back;
    pz = fz0 + (bz / bl) * back;
    py = h;
  }
  const l = Cam.beatT > 0 ? 2.4 : 6.5;
  Cam.x = dampN(Cam.x, px, l, dt); Cam.y = dampN(Cam.y, py, l, dt); Cam.z = dampN(Cam.z, pz, l, dt);
  Cam.lx = dampN(Cam.lx, lx, 8, dt); Cam.ly = dampN(Cam.ly, ly, 8, dt); Cam.lz = dampN(Cam.lz, lz, 8, dt);
  Cam.fov = dampN(Cam.fov, fov, 4, dt);
  Cam.shake = Math.max(0, Cam.shake - dt * 1.6);
  Cam.beatT = Math.max(0, Cam.beatT - dt);
  Cam.punch = dampN(Cam.punch, 0, 7, dt);
  const shx = (Math.random() - 0.5) * Cam.shake * 0.14;
  const shy = (Math.random() - 0.5) * Cam.shake * 0.1;
  camera.position.set(Cam.x + shx, Cam.y + shy, Cam.z);
  camera.lookAt(Cam.lx, Cam.ly, Cam.lz);
  const fovNow = Cam.fov - Cam.punch * 4.5;
  if (Math.abs(camera.fov - fovNow) > 0.05) { camera.fov = fovNow; camera.updateProjectionMatrix(); }
  let cfx = Cam.lx - Cam.x, cfz = Cam.lz - Cam.z;
  const cfl = hyp(cfx, cfz) || 1;
  Cam.fwdX = cfx / cfl; Cam.fwdZ = cfz / cfl;
  Cam.rightX = -Cam.fwdZ; Cam.rightZ = Cam.fwdX;
}

/* ---------- replay ---------- */
const Replay = { on: false, t: 0, t0: 0, t1: 0, skip: false, swished: false };

/* ---------- game flow ---------- */
const G = {
  t: 0, mode: 'match', daily: false, phase: 'menu', clock: 12, clockRun: false,
  sy: 0, sd: 0, possStart: 0, pending: null, resolved: false,
  queue: [], hintT: 0, heat: 0, cookedN: 0,
  timeScale: 1, slowReal: 0, slowScale: 1,
  rec: { frames: [], relT: 0, netT: 0 }
};
G.after = (s, fn) => G.queue.push({ t: G.t + s, fn });
G.setSlow = function (scale, realDur) { G.timeScale = scale; G.slowScale = scale; G.slowReal = realDur; };
function processQueue() {
  for (let i = G.queue.length - 1; i >= 0; i--) {
    if (G.t >= G.queue[i].t) { const f = G.queue[i].fn; G.queue.splice(i, 1); f(); }
  }
}
let bannerSeq = 0;
function showBanner(main, sub, cls, hold) {
  const id = ++bannerSeq;
  ui.bMain.textContent = main;
  ui.bSub.textContent = sub || '';
  ui.banner.className = 'show ' + (cls || '');
  G.after(hold || 1.3, () => { if (id === bannerSeq) ui.banner.className = ''; });
}
function showChips(g, extra) {
  ui.chips.innerHTML = '';
  const items = [['SEP', g.sep], ['BAL', g.bal], ['REL', g.rel], ['CONTEST', g.con]];
  if (extra) items.push(['', extra]);
  for (const [k, v] of items) {
    const d = document.createElement('div'); d.className = 'chip';
    d.textContent = (k ? k + ' · ' : '') + v;
    ui.chips.appendChild(d);
  }
  ui.chips.classList.add('show');
  G.after(2.6, () => ui.chips.classList.remove('show'));
}
let cueTimer = 0;
function showCue(txt) {
  ui.cue.textContent = txt; ui.cue.classList.add('show');
  cueTimer = G.t;
  G.after(2.2, () => { if (G.t - cueTimer >= 2.1) ui.cue.classList.remove('show'); });
}
function hudUpdate() {
  ui.sy.textContent = G.sy; ui.sd.textContent = G.sd;
  if (G.mode !== 'free' && (G.phase === 'live' || G.phase === 'check' || G.phase === 'resolve')) {
    ui.clock.style.display = 'flex';
    const c = Math.max(0, Math.ceil(G.clock));
    if (ui.clock.textContent !== String(c)) ui.clock.textContent = c;
    ui.clock.classList.toggle('hot', G.clock <= 4 && G.clockRun);
  } else ui.clock.style.display = 'none';
  const dots = ui.heatDots.children;
  for (let i = 0; i < dots.length; i++) {
    dots[i].classList.toggle('on', G.heat > (i + 0.5) / dots.length);
    dots[i].classList.toggle('max', G.heat > 0.92);
  }
}
G.startGame = function (mode) {
  G.mode = mode === 'daily' ? 'match' : mode;
  G.daily = mode === 'daily';
  if (G.daily) { DIFF = DAILY.stats; SOUL.reset(DAILY.name); }
  else { DIFF = DIFFS[diffKey]; SOUL.reset(DIFF_NAMES[diffKey]); }
  G.sy = 0; G.sd = 0; G.heat = 0; G.cookedN = 0;
  ui.menu.style.display = 'none'; ui.end.style.display = 'none';
  ui.hud.style.display = 'flex';
  ui.modeTag.textContent = G.daily ? 'DAILY · ' + DAILY.name
    : (mode === 'match' ? 'FIRST TO 7 · ' + diffKey : 'FREE PLAY · ' + diffKey);
  ui.btnBack.style.display = 'block';
  ui.btnDiff.style.display = mode === 'free' ? 'block' : 'none';
  ui.scores.style.visibility = mode === 'free' ? 'hidden' : 'visible';
  G.hintT = 0;
  G.startCheck();
};
G.startCheck = function () {
  G.phase = 'check';
  G.resolved = false; G.pending = null;
  G.timeScale = 1; G.slowReal = 0;
  oReset(0, 7.9); dReset(0, 6.35);
  figO.snapTo(O.x, O.z, O.yaw); figD.snapTo(D.x, D.z, D.yaw);
  ball.st = 'held'; ball.setPos(O.x + 0.3, 1.0, O.z);
  ball.vx = ball.vy = ball.vz = 0;
  G.clock = 12; G.clockRun = false;
  G.rec.frames.length = 0; G.rec.netT = 0; G.rec.relT = 0;
  ui.checkPrompt.classList.add('show');
  if (Math.random() < 0.4) {
    const l = Math.abs(SOUL.memLat) > 0.55
      ? pick(SOUL.memLat > 0 ? SOUL.learnedR : SOUL.learnedL)
      : pick(SOUL.checkLines);
    G.after(0.5, () => { if (G.phase === 'check') say(l, 1.6); });
  }
};
G.beginLive = function () {
  if (G.phase !== 'check') return;
  G.phase = 'live';
  G.possStart = G.t;
  G.clockRun = (G.mode !== 'free');
  ui.checkPrompt.classList.remove('show');
  SND.blip();
  if (G.hintT === 0) {
    ui.hint.classList.add('show');
    G.after(7, () => ui.hint.classList.remove('show'));
    G.hintT = 1;
  }
};
G.onNet = function () {
  if (!G.pending || G.resolved) return;
  const p = G.pending;
  G.rec.netT = G.t;
  const pure = p.outcome === 'pure' || p.outcome === 'cooked';
  Cam.punch = pure ? 1 : 0.4;
  if (p.outcome === 'cooked') {
    SND.swish(1.25, true); SND.crowd(true);
    Cam.shake = 0.5; Cam.beatT = 0.9;
    if (navigator.vibrate) { try { navigator.vibrate([12, 40, 70]); } catch (e) {} }
  } else if (pure) {
    SND.swish(1, true);
    if (G.heat > 0.85) SND.crowd(false);
    Cam.beatT = 0.85;
    if (navigator.vibrate) { try { navigator.vibrate(24); } catch (e) {} }
  } else SND.swish(0.55, false);
  G.score(p);
};
G.onRimOut = function () {
  if (!G.pending || G.resolved) return;
  const p = G.pending;
  let why = 'just short';
  if (p.cause === 'contest') why = 'well contested';
  else if (p.cause === 'rushed') why = 'rushed · off rhythm';
  else why = 'off balance';
  showBanner('MISS', why, 'miss', 1.2);
  G.resolve(false, 0);
};
G.onBallDead = function () {
  if (!G.resolved && G.phase !== 'menu' && G.phase !== 'check' && G.phase !== 'over') G.resolve(false, 0);
};
G.score = function (p) {
  const label = { pure: 'PURE SWISH', cooked: 'COOKED SWISH', clean: 'CLEAN', rimmake: 'BUCKET' }[p.outcome];
  const cls = (p.outcome === 'pure' || p.outcome === 'cooked') ? 'gold' : 'make';
  const sub = '+' + p.pts + (p.green ? ' · PERFECT' : '');
  showBanner(label, sub, cls + (p.outcome === 'cooked' ? ' shake' : ''), p.outcome === 'rimmake' ? 1.2 : 1.7);
  if (p.outcome === 'pure' || p.outcome === 'cooked' || p.green) showChips(p.grades, p.outcome === 'cooked' ? 'COOKED' : null);
  if (G.mode !== 'free') G.sy += p.pts;
  G.heat = clamp(G.heat + (p.outcome === 'pure' || p.outcome === 'cooked' ? 0.3 : 0.15), 0, 1);
  if (p.outcome === 'cooked') G.cookedN++;
  if ((p.outcome === 'pure' || p.outcome === 'cooked') && Math.random() < 0.4)
    G.after(1.0, () => say(pick(SOUL.saltLines), 1.2));
  G.resolve(true, p.outcome === 'cooked' ? 1 : 0);
};
G.turnover = function (label) {
  if (G.phase !== 'live' || G.resolved) return;
  ball.st = 'loose';
  const nx = D.x - O.x, nzv = D.z - O.z, nl = hyp(nx, nzv) || 1;
  ball.vx = nx / nl * 2.4 + rand(-0.5, 0.5); ball.vz = nzv / nl * 2.4; ball.vy = 1.4;
  ball.deadT = 0;
  showBanner(label, G.mode !== 'free' ? 'stop · DEF +1' : 'stop', 'miss', 1.3);
  G.clockRun = false;
  O.st = 'recover'; O.move = null;
  G.resolve(false, 0);
};
G.resolve = function (scored, replayFlag) {
  if (G.resolved) return;
  G.resolved = true;
  G.phase = 'resolve';
  G.clockRun = false;
  if (!scored) {
    G.heat *= 0.4;
    if (G.mode !== 'free') G.sd += 1;
    if (Math.random() < 0.5) G.after(0.5, () => say(pick(SOUL.stopLines), 1.4));
  }
  const delay = replayFlag ? 1.5 : (scored ? 1.4 : 1.15);
  G.after(delay, () => {
    if (replayFlag && G.rec.frames.length > 10) startReplay();
    else G.nextPossession();
  });
};
G.nextPossession = function () {
  if (G.mode !== 'free' && (G.sy >= 7 || G.sd >= 7)) {
    G.phase = 'over';
    ui.end.style.display = 'flex';
    const won = G.sy >= 7;
    ui.endTitle.textContent = won ? 'YOU WIN' : 'CLAMPED';
    ui.endTitle.className = 'disp big ' + (won ? 'goldT' : 'heatT');
    ui.endSub.textContent = (G.daily ? 'vs ' + DAILY.name + ' · ' : '') + 'final ' + G.sy + ' — ' + G.sd +
      (G.cookedN ? ' · ' + G.cookedN + ' cooked' : '') + (won ? ' · pure.' : ' · run it back.');
    ui.btnShare.textContent = 'SHARE RUN';
    ui.checkPrompt.classList.remove('show');
    return;
  }
  G.startCheck();
};
function shareRun() {
  const won = G.sy >= 7;
  const txt = G.daily
    ? 'ISLAND — DAILY DUEL ' + DAILY.date + ' vs ' + DAILY.name + '\n' +
      G.sy + '–' + G.sd + ' ' + (won ? 'W' : 'L') + ' · ' + G.cookedN + ' cooked swish' + (G.cookedN === 1 ? '' : 'es')
    : 'ISLAND 1v1 vs ' + SOUL.name + ' — ' + G.sy + '–' + G.sd + ' ' + (won ? 'W' : 'L') +
      (G.cookedN ? ' · ' + G.cookedN + ' cooked' : '');
  if (navigator.share) navigator.share({ text: txt }).catch(() => {});
  else if (navigator.clipboard) {
    navigator.clipboard.writeText(txt).then(() => { ui.btnShare.textContent = 'COPIED'; }).catch(() => {});
  }
}

/* recording / replay */
function record() {
  if (Replay.on) return;
  if (!(G.phase === 'live' || G.phase === 'resolve')) return;
  const f = G.rec.frames;
  f.push([G.t, O.x, O.z, O.yaw, O.crouch, O.lift, poseStyleO(), O.hand,
    D.x, D.z, D.yaw, D.crouch, D.lift, poseStyleD(),
    ball.x, ball.y, ball.z]);
  if (f.length > 300) f.shift();
}
function startReplay() {
  const f = G.rec.frames;
  Replay.t0 = Math.max(f[0][0], G.rec.relT - 1.7);
  Replay.t1 = (G.rec.netT || G.rec.relT + 1.2) + 0.35;
  Replay.t = Replay.t0;
  Replay.on = true; Replay.skip = false; Replay.swished = false;
  ui.replayTag.style.display = 'block';
  ui.barTop.classList.add('show'); ui.barBot.classList.add('show');
}
function endReplay() {
  Replay.on = false;
  ui.replayTag.style.display = 'none';
  ui.barTop.classList.remove('show'); ui.barBot.classList.remove('show');
  G.nextPossession();
}
function replayUpdate(dt) {
  Replay.t += dt * 0.8;
  if (Replay.skip || Replay.t >= Replay.t1) { endReplay(); return; }
  const f = G.rec.frames;
  let i = 0;
  while (i < f.length - 2 && f[i + 1][0] < Replay.t) i++;
  const a = f[i], b = f[Math.min(f.length - 1, i + 1)];
  const span = Math.max(0.001, b[0] - a[0]);
  const t = clamp((Replay.t - a[0]) / span, 0, 1);
  const L = j => lerp(a[j], b[j], t);
  const ovx = (b[1] - a[1]) / span, ovz = (b[2] - a[2]) / span;
  const dvx = (b[8] - a[8]) / span, dvz = (b[9] - a[9]) / span;
  O.x = L(1); O.z = L(2); D.x = L(8); D.z = L(9);
  figO.pose({
    x: L(1), z: L(2), yaw: L(3), crouch: L(4), lift: L(5),
    vx: ovx, vz: ovz, style: a[6], hand: a[7],
    bx: L(14), by: L(15), bz: L(16), pivot: -1
  }, dt);
  figD.pose({
    x: L(8), z: L(9), yaw: L(10), crouch: L(11), lift: L(12),
    vx: dvx, vz: dvz, style: a[13], hand: 1,
    bx: L(14), by: L(15), bz: L(16), pivot: -1
  }, dt);
  ball.setPos(L(14), L(15), L(16));
  ball.mesh.position.set(ball.x, ball.y, ball.z);
  ball.mesh.rotation.x -= dt * 6;
  if (!Replay.swished && G.rec.netT && Replay.t >= G.rec.netT) {
    Replay.swished = true; net.snap(1); SND.swish(0.7, true);
  }
  net.update(dt);
  camUpdate(dt);
  renderer.render(scene, camera);
}

function poseStyleO() {
  if (O.st === 'gather') return STYLE.GATH;
  if (O.st === 'rise') return STYLE.RISE;
  if (O.st === 'fall' || O.st === 'recover') return STYLE.FOLLOW;
  if (O.st === 'fake') return STYLE.GATH;
  if (O.pickedUp) return STYLE.HELD;
  if (O.st === 'dribble') return STYLE.DRIB;
  return STYLE.HELD;
}
function poseStyleD() {
  if (D.beatenT > 0 || D.staggerT > 0) return STYLE.STUMBLE;
  if (D.airT > 0) return STYLE.CONTEST;
  if (D.reachT > 0) return STYLE.REACH;
  return STYLE.DEF;
}
function poseFigures(dt) {
  figO.pose({
    x: O.x, z: O.z, yaw: O.yaw, crouch: O.crouch, lift: O.lift,
    vx: O.vx, vz: O.vz, style: poseStyleO(), hand: O.hand,
    bx: ball.x, by: ball.y, bz: ball.z,
    pivot: (O.pickedUp && O.st === 'stopped') ? O.pivot : -1,
    plant: O.windowT > 0 && (O.windowType === 'step' || O.windowType === 'bump')
  }, dt);
  figD.pose({
    x: D.x, z: D.z, yaw: D.yaw, crouch: D.crouch, lift: D.lift,
    vx: D.vx, vz: D.vz, style: poseStyleD(), hand: 1,
    bx: ball.x, by: ball.y, bz: ball.z, pivot: -1
  }, dt);
}
function checkIdle() {
  O.crouch = 0.34 + Math.sin(G.t * 2.2) * 0.03;
  D.crouch = 0.52 + Math.sin(G.t * 2.6 + 1) * 0.03;
  D.yaw = Math.atan2(O.x - D.x, O.z - D.z);
}
function defenderIdleDuringResolve(dt) {
  D.beatenT = Math.max(0, D.beatenT - dt);
  D.staggerT = Math.max(0, D.staggerT - dt);
  if (D.airT > 0) {
    D.airT -= dt;
    const prog = 1 - Math.max(0, D.airT) / D.airDur;
    D.lift = 0.5 * Math.sin(prog * Math.PI);
    if (D.airT <= 0) { D.lift = 0; D.airKind = ''; }
  }
  D.vx = dampN(D.vx, 0, 5, dt); D.vz = dampN(D.vz, 0, 5, dt);
  D.x += D.vx * dt; D.z += D.vz * dt;
}

/* ---------- UI wiring ---------- */
function setDiff(k) {
  diffKey = k;
  if (!G.daily) DIFF = DIFFS[k];
  document.querySelectorAll('.seg').forEach(b => b.classList.toggle('on', b.dataset.d === k));
  ui.btnDiff.textContent = k;
  if (G.phase !== 'menu' && !G.daily)
    ui.modeTag.textContent = (G.mode === 'match' ? 'FIRST TO 7 · ' : 'FREE PLAY · ') + k;
}
document.querySelectorAll('.seg').forEach(b => {
  b.addEventListener('click', () => { audioInit(); SND.tick(); setDiff(b.dataset.d); });
});
ui.btnFree.addEventListener('click', () => { audioInit(); SND.blip(); G.startGame('free'); });
ui.btnMatch.addEventListener('click', () => { audioInit(); SND.blip(); G.startGame('match'); });
ui.btnDaily.addEventListener('click', () => { audioInit(); SND.blip(); G.startGame('daily'); });
ui.btnRematch.addEventListener('click', () => { audioInit(); SND.blip(); G.startGame(G.daily ? 'daily' : 'match'); });
ui.btnShare.addEventListener('click', () => { audioInit(); shareRun(); });
ui.btnMenu2.addEventListener('click', showMenu);
ui.btnBack.addEventListener('click', showMenu);
ui.btnDiff.addEventListener('click', () => {
  audioInit(); SND.tick();
  const order = ['EASY', 'MED', 'HARD'];
  setDiff(order[(order.indexOf(diffKey) + 1) % 3]);
});
function showMenu() {
  G.phase = 'menu';
  G.timeScale = 1; G.slowReal = 0;
  ui.menu.style.display = 'flex'; ui.end.style.display = 'none';
  ui.hud.style.display = 'none'; ui.btnBack.style.display = 'none';
  ui.btnDiff.style.display = 'none';
  ui.checkPrompt.classList.remove('show');
  ui.banner.className = ''; ui.chips.classList.remove('show');
  Replay.on = false;
  ui.replayTag.style.display = 'none';
  ui.barTop.classList.remove('show'); ui.barBot.classList.remove('show');
  oReset(0, 7.9); dReset(0, 6.35);
  ball.st = 'held'; ball.setPos(0.3, 1, 7.9);
}
ui.dailyName.textContent = DAILY.name + ' · ' + DAILY.date;

/* ---------- main loop ---------- */
let lastT = performance.now();
function frame(now) {
  requestAnimationFrame(frame);
  const rawDt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (G.slowReal > 0) {
    G.slowReal -= rawDt;
    G.timeScale = G.slowReal > 0 ? G.slowScale : 1;
  }
  const dt = rawDt * G.timeScale;
  G.t += dt;

  if (AC.ctx && AC.crowdG) {
    AC.crowdV = dampN(AC.crowdV, 0.002 + G.heat * 0.055, 1.5, rawDt);
    AC.crowdG.gain.value = AC.crowdV;
  }
  G.heat = Math.max(0, G.heat - rawDt * 0.045);

  if (Replay.on) { replayUpdate(rawDt); hudUpdate(); updateSay(); return; }

  Input.update(dt);

  if (G.phase === 'live') {
    offenseUpdate(dt);
    defenderUpdate(dt);
    if (G.clockRun) {
      const prev = Math.ceil(G.clock);
      G.clock -= dt;
      const cur = Math.ceil(G.clock);
      if (cur !== prev && cur <= 3 && cur >= 1) SND.tick();
      if (G.clock <= 0 && !(O.st === 'gather' || O.st === 'rise' || O.st === 'fall')) {
        SND.buzz();
        showBanner('SHOT CLOCK', 'stop · DEF +1', 'miss', 1.3);
        O.st = 'recover'; O.move = null; G.clockRun = false;
        if (ball.st === 'dribble' || ball.st === 'held') { ball.st = 'loose'; ball.vy = 0.5; ball.deadT = 0; }
        G.resolve(false, 0);
      }
    }
  } else if (G.phase === 'check') {
    checkIdle();
  } else if (G.phase === 'resolve') {
    O.vx = dampN(O.vx, 0, 5, dt); O.vz = dampN(O.vz, 0, 5, dt);
    if (O.st === 'fall') {
      O.fallT += dt;
      const t = clamp(O.fallT / 0.3, 0, 1);
      O.lift = O.jumpH * Math.cos(t * Math.PI / 2);
      if (t >= 1) { O.lift = 0; O.st = 'recover'; }
    }
    defenderIdleDuringResolve(dt);
  }

  ball.update(dt);
  processQueue();
  camUpdate(dt);
  poseFigures(dt);
  net.update(dt);
  record();
  hudUpdate();
  updateSay();
  renderer.render(scene, camera);
}

/* boot */
resize();
showMenu();
figO.snapTo(O.x, O.z, O.yaw);
figD.snapTo(D.x, D.z, D.yaw);
poseFigures(1 / 60);
requestAnimationFrame(frame);
