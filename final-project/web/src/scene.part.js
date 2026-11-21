
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

/* ---------------- helpers ---------------- */
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (const ch of s) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const fmtPct = v => (v > 0 ? '+' : '') + v.toFixed(2) + '%';
const FONT = '"Noto Sans TC", "PingFang TC", "Microsoft JhengHei", sans-serif';
const css = getComputedStyle(document.documentElement);
const tok = n => css.getPropertyValue(n).trim();
const UP = '#e5484d', DOWN = '#20a464';
const pick = (arr, h) => arr[h % arr.length];
const isDesk = () => innerWidth > 760;
const TOUCH = matchMedia('(pointer: coarse)').matches;
function shade(hex, amt) { const c = new THREE.Color(hex); return '#' + c.lerp(new THREE.Color(amt > 0 ? '#ffffff' : '#000000'), Math.abs(amt)).getHexString(); }

try { await Promise.race([Promise.all([document.fonts.load('700 22px "Noto Sans TC"'), document.fonts.load('900 64px "Noto Serif TC"')]), new Promise(r => setTimeout(r, 2500))]); } catch (e) {}

__DATA_PART__
/* ---------------- 今日行情 (真實或示意) ---------------- */
const SCN = {
  mixed: { bias: { semi: -3.4, tech: -0.8, fin: 0.7, port: 4.6, life: 0.3 }, sd: 1.0, fix: { 台積電: -4.15, 長榮: 7.82, 陽明: 6.35, 長榮航: 3.4, 華南金: 1.1 } },
  up:    { bias: { semi: 2.7, tech: 2.2, fin: 1.1, port: 1.7, life: 1.2 }, sd: 1.0, fix: { 台積電: 3.6, 聯發科: 4.2 } },
  flat:  { bias: { semi: 0.1, tech: -0.1, fin: 0.15, port: 0, life: 0.05 }, sd: 0.5, fix: { 台積電: 0.2 } },
  down:  { bias: { semi: -3.0, tech: -2.7, fin: -1.5, port: -2.3, life: -1.6 }, sd: 0.9, fix: { 台積電: -3.9 } },
};
let chg = {}, scenarioNow = 'mixed';
function genChanges(key) {
  const out = {};
  if (key === 'real') { for (const n of Object.keys(CO)) out[n] = CITY.daily.stocks[CO[n].code]?.pct ?? 0; return out; }
  const s = SCN[key], r = rng(hashStr(key));
  for (const n of Object.keys(CO)) {
    const g = Math.sqrt(-2 * Math.log(r() + 1e-9)) * Math.cos(2 * Math.PI * r());
    out[n] = s.fix[n] ?? Math.round(clamp((s.bias[CO[n].d] ?? 0) + g * s.sd, -9.9, 9.9) * 100) / 100;
  }
  return out;
}
function indexEst() {   // 真實行情用加權指數；示意行情用市值加權估算
  if (scenarioNow === 'real' && CITY.daily.index && CITY.daily.index.pct != null) return CITY.daily.index.pct;
  let a = 0, b = 0; for (const c of Object.values(CO)) if (c.share != null && chg[c.name] != null) { a += c.share * chg[c.name]; b += c.share; }
  return b ? a / b : 0;
}
const stateOf = c => c >= 3 ? 'boom' : c >= 0.3 ? 'up' : c > -0.3 ? 'flat' : c > -3 ? 'down' : 'crash';
const LIT = { boom: 1, up: 0.8, flat: 0.6, down: 0.32, crash: 0.12 };

/* ---------------- renderer / camera / lights ---------------- */
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, isDesk() ? 2 : 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = isDesk();
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xc4d6e4, 70, 330);
const camera = new THREE.PerspectiveCamera(66, innerWidth / innerHeight, 0.1, 900);
const hemi = new THREE.HemisphereLight(0xdfeeff, 0x5a5446, 0.9);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.2);
sun.castShadow = renderer.shadowMap.enabled;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 300 });
sun.shadow.bias = -0.0005; sun.shadow.normalBias = 0.05;
scene.add(sun, sun.target);
const city = new THREE.Group(); scene.add(city);

/* ---------------- textures (全部用 canvas 畫，不用外部圖檔) ---------------- */
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function canvasTex(c, { rep = false, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(c); if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (rep) t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; return t;
}
function speckle(g, w, h, n, cols, seed, size = 2) { const r = rng(seed); for (let i = 0; i < n; i++) { g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(r() * w, r() * h, size, size); } }
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const TX = {};
{ const c = mkCanvas(128, 128), g = c.getContext('2d'); g.fillStyle = '#4b4e53'; g.fillRect(0, 0, 128, 128); speckle(g, 128, 128, 1400, ['#56595f', '#42454a', '#5f6268', '#3d4044'], 1); TX.asphalt = canvasTex(c, { rep: true }); }
{ // 紅磚人行道
  const c = mkCanvas(128, 128), g = c.getContext('2d'); g.fillStyle = '#7d5446'; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 8; y++) for (let x = -1; x < 5; x++) { g.fillStyle = ['#a9624e', '#b26c55', '#9d5948', '#b87459', '#a35e4b'][(x * 7 + y * 3 + 20) % 5]; g.fillRect(x * 32 + (y % 2) * 16 + 1, y * 16 + 1, 30, 14); }
  TX.brick = canvasTex(c, { rep: true });
}
{ // 騎樓地磚
  const c = mkCanvas(128, 128), g = c.getContext('2d'); g.fillStyle = '#9c9a94'; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) { g.fillStyle = (x + y) % 2 ? '#c9c5bb' : '#d4d0c6'; g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30); }
  TX.tile = canvasTex(c, { rep: true });
}
{ // 廣場石板
  const c = mkCanvas(128, 128), g = c.getContext('2d'); g.fillStyle = '#b8b1a4'; g.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 2; y++) for (let x = 0; x < 2; x++) { g.fillStyle = (x + y) % 2 ? '#d9d2c3' : '#cfc7b6'; g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60); }
  g.strokeStyle = 'rgba(120,110,95,.35)'; g.lineWidth = 2; g.strokeRect(20, 20, 88, 88); TX.plaza = canvasTex(c, { rep: true });
}
{ // 馬路標線：中間雙黃線、兩側白虛線
  const c = mkCanvas(32, 128), g = c.getContext('2d'); g.clearRect(0, 0, 32, 128); g.fillStyle = '#f0f0ea'; g.fillRect(12, 0, 8, 64); TX.dash = canvasTex(c, { rep: true });
}
{ // 地上導引線的箭頭 (往 u 的方向流動)
  const c = mkCanvas(64, 32), g = c.getContext('2d'); g.fillStyle = 'rgba(255,255,255,.62)'; g.fillRect(0, 0, 64, 32);
  g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(14, 4); g.lineTo(34, 16); g.lineTo(14, 28); g.lineTo(25, 28); g.lineTo(45, 16); g.lineTo(25, 4); g.closePath(); g.fill();
  TX.chev = canvasTex(c, { rep: true });
}
{ // 鐵捲門
  const c = mkCanvas(64, 64), g = c.getContext('2d'); g.fillStyle = '#a7abad'; g.fillRect(0, 0, 64, 64);
  for (let y = 0; y < 64; y += 6) { g.fillStyle = '#8d9193'; g.fillRect(0, y, 64, 2); g.fillStyle = '#c3c6c7'; g.fillRect(0, y + 2, 64, 1); }
  TX.shutter = canvasTex(c, { rep: true });
}
{ // 店面玻璃 (一格 4 公尺寬、3.6 公尺高)
  const c = mkCanvas(256, 128), g = c.getContext('2d'), e = mkCanvas(256, 128), ge = e.getContext('2d');
  g.fillStyle = '#2d3339'; g.fillRect(0, 0, 256, 128); ge.fillStyle = '#000'; ge.fillRect(0, 0, 256, 128);
  g.fillStyle = '#e9e3d6'; g.fillRect(0, 0, 256, 13);
  for (const x of [8, 132]) {
    const gr = g.createLinearGradient(0, 18, 0, 124); gr.addColorStop(0, '#cdd9df'); gr.addColorStop(1, '#91a5b0'); g.fillStyle = gr; g.fillRect(x, 18, 116, 106);
    g.fillStyle = 'rgba(80,66,52,.38)'; for (let y = 52; y < 120; y += 22) g.fillRect(x + 8, y, 100, 4);
    g.fillStyle = 'rgba(255,255,255,.32)'; g.fillRect(x + 10, 22, 9, 98);
    ge.fillStyle = '#ffd99a'; ge.fillRect(x, 18, 116, 106); ge.fillStyle = '#6b5530'; for (let y = 52; y < 120; y += 22) ge.fillRect(x + 8, y, 100, 4);
  }
  TX.shop = canvasTex(c, { rep: true }); TX.shopE = canvasTex(e, { rep: true });
}
// 建築立面：一格 = 一個開間 (4 公尺) × 一層樓 (3.2 公尺)；最上面 8px 是樓板帶，也拿來當屋頂顏色
function facadeStyle(style) {
  const S = 128, c = mkCanvas(S, S), e = mkCanvas(S, S), g = c.getContext('2d'), ge = e.getContext('2d'), r = rng(hashStr(style));
  ge.fillStyle = '#000'; ge.fillRect(0, 0, S, S);
  const lit = (x, y, w, h) => { if (r() < 0.75) { ge.fillStyle = r() < 0.5 ? '#ffe0a0' : '#fff0cc'; ge.fillRect(x, y, w, h); } };
  if (style === 'glass') {
    g.fillStyle = '#e6edf2'; g.fillRect(0, 0, S, S);
    for (const x of [5, 66]) { const gr = g.createLinearGradient(0, 12, 0, 126); gr.addColorStop(0, '#a6bfd2'); gr.addColorStop(1, '#6d8ca6'); g.fillStyle = gr; g.fillRect(x, 12, 57, 114); g.fillStyle = 'rgba(255,255,255,.22)'; g.fillRect(x + 5, 16, 9, 104); lit(x, 12, 57, 114); }
  } else if (style === 'office') {
    g.fillStyle = '#e6e3dc'; g.fillRect(0, 0, S, S);
    g.fillStyle = '#5b7387'; g.fillRect(0, 38, S, 58); g.fillStyle = '#cfccc3'; for (const x of [0, 42, 85]) g.fillRect(x, 38, 3, 58);
    for (const x of [3, 45, 88]) lit(x, 38, 39, 58);
  } else if (style === 'stone') {
    g.fillStyle = '#eee6d6'; g.fillRect(0, 0, S, S); speckle(g, S, S, 320, ['#e2d8c5', '#f4eddf', '#ddd2bd'], 3, 3);
    for (const x of [16, 72]) { g.fillStyle = '#7d8a92'; g.fillRect(x - 4, 20, 46, 96); g.fillStyle = '#3d5466'; g.fillRect(x, 24, 38, 88); lit(x, 24, 38, 88); }
  } else if (style === 'metal') {
    g.fillStyle = '#dfe3e5'; g.fillRect(0, 0, S, S); g.fillStyle = '#c6ccd0'; for (let x = 0; x < S; x += 8) g.fillRect(x, 8, 3, S);
    g.fillStyle = '#4b6171'; g.fillRect(16, 46, 40, 30); g.fillRect(74, 46, 40, 30); lit(16, 46, 40, 30); lit(74, 46, 40, 30);
  } else {   // 台灣常見的磁磚公寓：鐵窗、冷氣機
    g.fillStyle = '#f2ece1'; g.fillRect(0, 0, S, S);
    g.strokeStyle = 'rgba(150,140,125,.28)'; g.lineWidth = 1;
    for (let y = 8; y < S; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(S, y); g.stroke(); }
    for (let x = 0; x < S; x += 16) { g.beginPath(); g.moveTo(x, 8); g.lineTo(x, S); g.stroke(); }
    g.fillStyle = '#4a5866'; g.fillRect(14, 30, 70, 64); lit(14, 30, 70, 64);
    g.strokeStyle = '#d5d7d4'; g.lineWidth = 3; g.strokeRect(10, 26, 78, 72);
    for (let x = 10; x <= 88; x += 13) { g.beginPath(); g.moveTo(x, 26); g.lineTo(x, 98); g.stroke(); }
    g.fillStyle = '#f8f8f5'; g.fillRect(96, 58, 24, 18); g.fillStyle = '#c3c5c1'; for (let y = 60; y < 74; y += 3) g.fillRect(98, y, 20, 1);
  }
  g.fillStyle = style === 'glass' ? '#b7c2ca' : style === 'tile' ? '#c8bfb0' : '#b9b5ad'; g.fillRect(0, 0, S, 8);
  return { map: canvasTex(c, { rep: true }), emi: canvasTex(e, { rep: true }) };
}
const FAC = Object.fromEntries(['glass', 'office', 'stone', 'metal', 'tile'].map(s => [s, facadeStyle(s)]));

/* ---------------- shared materials & geometry helpers ---------------- */
const MAT = {
  ground: new THREE.MeshLambertMaterial({ color: 0x8e8d86 }),
  road: new THREE.MeshLambertMaterial({ map: TX.asphalt }),
  brick: new THREE.MeshLambertMaterial({ map: TX.brick }),
  tile: new THREE.MeshLambertMaterial({ map: TX.tile }),
  plaza: new THREE.MeshLambertMaterial({ map: TX.plaza }),
  curb: new THREE.MeshLambertMaterial({ color: 0xc3beb3 }),
  dash: new THREE.MeshBasicMaterial({ map: TX.dash, transparent: true, depthWrite: false }),
  yellow: new THREE.MeshBasicMaterial({ color: 0xe8b830 }),
  white: new THREE.MeshLambertMaterial({ color: 0xf2f2ee }),
  pillar: new THREE.MeshLambertMaterial({ color: 0xdcd5c7 }),
  dark: new THREE.MeshLambertMaterial({ color: 0x3b4148 }),
  metal: new THREE.MeshLambertMaterial({ color: 0x8c9399 }),
  tank: new THREE.MeshLambertMaterial({ color: 0xd6d9db }),
  shutter: new THREE.MeshLambertMaterial({ map: TX.shutter }),
  trunk: new THREE.MeshLambertMaterial({ color: 0x6b4f37 }),
  leaf: new THREE.MeshLambertMaterial({ color: 0x4f8a4a }),
  lampHead: new THREE.MeshLambertMaterial({ color: 0xf4f1e6, emissive: 0xffe2a0, emissiveIntensity: 0 }),
  water: new THREE.MeshLambertMaterial({ color: 0x3b7aa6, transparent: true, opacity: 0.92 }),
  quay: new THREE.MeshLambertMaterial({ color: 0xa6a59e }),
  apt: new THREE.MeshLambertMaterial({ map: FAC.tile.map, emissiveMap: FAC.tile.emi, emissive: 0xffe0a0, emissiveIntensity: 0, vertexColors: true }),
};
// 立方體，四個側面的貼圖依實際尺寸重複 (窗戶不會被拉長)，頂面與底面取樓板帶的顏色
function facadeBox(w, h, d) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    if (f === 2 || f === 3) { uv.setXY(i, 0.5, 0.97); continue; }
    const fw = f < 2 ? d : w; uv.setXY(i, uv.getX(i) * fw / 4, uv.getY(i) * h / 3.2);
  }
  return g;
}
function planeUV(w, h, ru, rv) { const g = new THREE.PlaneGeometry(w, h), uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ru, uv.getY(i) * rv); return g; }
function flatRect(x0, z0, x1, z1, y, mat, ru = 1, rv = 1) {
  const m = new THREE.Mesh(planeUV(x1 - x0, z1 - z0, ru, rv), mat); m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); m.receiveShadow = true; city.add(m); return m;
}
// 店的局部座標 (lx：沿著立面，lz：往馬路為正) → 世界座標
function worldOf(c, lx, lz) { return [c.front[0] + c.fz * lx + c.fx * lz, c.front[1] - c.fx * lx + c.fz * lz]; }
const COLL = [], COLLB = [];   // 撞牆用：店面 (一樓) 與整棟建築
function addColl(list, pts) { const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]); list.push({ x0: Math.min(...xs), x1: Math.max(...xs), z0: Math.min(...zs), z1: Math.max(...zs) }); }
const INST = { pillar: [], ac: [], tank: [], lamp: [], tree: [], scooter: [] };
function instPush(list, x, y, z, ry = 0, s = [1, 1, 1]) { list.push({ x, y, z, ry, s }); }
function buildInstanced(geo, mat, list, shadow = false) {
  if (!list.length) return null;
  const m = new THREE.InstancedMesh(geo, mat, list.length), M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3();
  list.forEach((o, i) => { Q.setFromEuler(E.set(0, o.ry, 0)); M4.compose(V.set(o.x, o.y, o.z), Q, S.set(...o.s)); m.setMatrixAt(i, M4); });
  m.castShadow = shadow; m.receiveShadow = true; city.add(m); return m;
}

/* ---------------- 招牌 ---------------- */
const SIGN_BG = {
  semi: ['#0d3f70', '#14508a', '#0f5c6e', '#1f437a', '#23356b'],
  tech: ['#c62828', '#1565c0', '#2e7d32', '#e65100', '#6a1b9a', '#00838f', '#ad1457'],
  fin: ['#7a1f1f', '#1f3a5f', '#2f4f3f', '#5a3e1b', '#3e2f5b'],
  port: ['#0d47a1', '#1b5e20', '#004d61'],
  life: ['#d84315', '#c69200', '#2e7d32', '#1565c0', '#c62828', '#6d4c41'],
  fill: ['#f2efe6', '#ffd54f', '#ffffff', '#e0f2f1', '#fff3e0'],
};
const TINTS = {
  glass: ['#7aa4c4', '#6b97b7', '#86aecb', '#5d8fa6', '#7895b8'], office: ['#e3e1dc', '#d6dbe0', '#e8e1d6', '#cfd6dc', '#ddd9cf'],
  stone: ['#f0e2c4', '#e6d8bb', '#ddd3c1', '#efdfc6', '#d9cdb9'], metal: ['#b9c7ce', '#a9bcc7', '#c7d0d4'], tile: ['#f3eadb', '#e8e1d4', '#fbf2e2', '#e6d6c2', '#dfe4e6', '#f1e1cf'],
};
const STYLE_OF = { semi: 'glass', tech: 'office', fin: 'stone', port: 'metal', life: 'tile' };
const shortName = n => n.replace(/-KY$/, '');
function fasciaTex(c, bg) {
  const pw = c.w - 0.5, H = 72, W = clamp(Math.round(H * pw / 0.95), 128, 2048), cv = mkCanvas(W, H), g = cv.getContext('2d');
  const fg = c.filler ? (bg === '#ffffff' || bg === '#f2efe6' ? '#c62828' : '#3a2a1a') : '#ffffff';
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 0, W, 6); g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(0, H - 6, W, 6);
  g.fillStyle = fg; g.textBaseline = 'middle';
  const sz = Math.min(48, (W - (c.code ? 120 : 30)) / Math.max(2, c.name.length) * 1.05);
  g.font = `900 ${sz}px ${FONT}`; g.textAlign = 'center'; g.fillText(c.name, c.code ? (W - 90) / 2 : W / 2, H / 2 + 2);
  if (c.code) { g.font = `700 22px ${FONT}`; g.textAlign = 'right'; g.globalAlpha = 0.85; g.fillText(c.code, W - 16, H / 2 + 2); }
  return canvasTex(cv);
}
function vsignTex(text, bg, hS) {
  const W = 64, H = clamp(Math.round(W * hS / 1.3), 96, 512), cv = mkCanvas(W, H), g = cv.getContext('2d'), ch = [...shortName(text)];
  g.fillStyle = bg; g.fillRect(0, 0, W, H); g.strokeStyle = 'rgba(255,255,255,.75)'; g.lineWidth = 4; g.strokeRect(5, 5, W - 10, H - 10);
  const sz = Math.min(44, (H - 24) / ch.length * 0.92); g.font = `900 ${sz}px ${FONT}`; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const step = (H - 20) / ch.length; ch.forEach((t, i) => g.fillText(t, W / 2, 10 + step * (i + 0.5)));
  return canvasTex(cv);
}
function stickerTex(c) {
  const ks = c.etfs, cv = mkCanvas(128 * ks.length, 48), g = cv.getContext('2d');
  ks.forEach((k, i) => {
    const x = i * 128; g.fillStyle = ETFS[k].color; roundRect(g, x + 4, 4, 120, 40, 9); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
    g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.font = `900 20px ${FONT}`; g.textAlign = 'left'; g.fillText(k, x + 12, 25);
    g.font = `700 17px ${FONT}`; g.textAlign = 'right'; g.fillText(ETFS[k].w[c.name].toFixed(1) + '%', x + 116, 25);
  });
  return canvasTex(cv);
}
function roofSignTex(c, bg) {
  const cv = mkCanvas(512, 112), g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 512, 112); g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(6, 6, 500, 100);
  g.fillStyle = '#fff'; g.font = `900 ${Math.min(76, 470 / c.name.length)}px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(c.name, 256, 60);
  return canvasTex(cv);
}
// 跑馬燈：整段文字畫一次，靠貼圖位移捲動
function marqueeDraw(m, text, color) {
  const g = m.cv.getContext('2d'); g.font = `700 22px ${FONT}`; const tw = Math.ceil(g.measureText(text).width + 40);
  if (m.cv.width !== tw) { m.cv.width = tw; m.tex.dispose(); m.tex = canvasTex(m.cv, { rep: true }); m.tex.wrapT = THREE.ClampToEdgeWrapping; m.mesh.material.map = m.tex; m.mesh.material.needsUpdate = true; }
  g.fillStyle = '#0b0d10'; g.fillRect(0, 0, tw, 32); g.font = `700 22px ${FONT}`; g.fillStyle = color; g.textBaseline = 'middle'; g.shadowColor = color; g.shadowBlur = 6; g.fillText(text, 20, 17); g.shadowBlur = 0;
  m.tex.needsUpdate = true; m.tex.repeat.set(m.pw / (tw / 32 * 0.34), 1);
}

/* ---------------- 街道：地面、馬路、人行道、騎樓 ---------------- */
const SEA_SIDE = (() => { const ss = Object.values(CO).filter(c => c.d === 'port' && c.front).map(c => c.side); if (!ss.length) return 2; const cnt = [0, 0, 0, 0]; ss.forEach(s => cnt[s]++); return cnt.indexOf(Math.max(...cnt)); })();
const SEA_O = L.front + L.dep + 16;   // 海岸線離中心線的距離
{
  const R = RR, E = R + 70, gb = [-E, -E, E, E];
  if (SEA_SIDE === 0) gb[3] = R + SEA_O; else if (SEA_SIDE === 1) gb[2] = R + SEA_O; else if (SEA_SIDE === 2) gb[1] = -R - SEA_O; else gb[0] = -R - SEA_O;
  flatRect(gb[0], gb[1], gb[2], gb[3], -0.02, MAT.ground);
  // 車道 (含十字路口)
  for (let i = 0; i < 4; i++) {
    const p = ringPt(i * LAY.side + R), long = 2 * R + 2 * L.road;
    const w = p.dx ? long : 2 * L.road, d = p.dx ? 2 * L.road : long;
    flatRect(p.x - w / 2, p.z - d / 2, p.x + w / 2, p.z + d / 2, 0, MAT.road, w / 8, d / 8);
  }
  // 人行道與騎樓 (外側與內側)
  for (const sg of [1, -1]) {
    for (let i = 0; i < 4; i++) {
      const p = ringPt(i * LAY.side + R);
      const full = p.dx !== 0;   // 轉角只鋪一次，避免重疊閃爍
      const seg = (o0, o1, mat, rep, y) => {
        const len = sg > 0 ? 2 * (R + (full ? o1 : o0)) : 2 * (R - (full ? o0 : o1)), cx = p.x + p.nx * sg * (o0 + o1) / 2, cz = p.z + p.nz * sg * (o0 + o1) / 2, wd = o1 - o0;
        const w = p.dx ? len : wd, d = p.dx ? wd : len;
        flatRect(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, y, mat, w / rep, d / rep);
      };
      seg(L.road, L.front, MAT.brick, 2, 0.04);
      seg(L.front, L.shop + 0.2, MAT.tile, 1.2, 0.035);
      seg(L.road, L.road + 0.25, MAT.curb, 1, 0.06);
    }
  }
  // 標線：中央雙黃線 (轉角留空)
  for (let i = 0; i < 4; i++) {
    const p = ringPt(i * LAY.side + R), len = 2 * R - 2 * L.road - 2;
    for (const o of [-0.12, 0.12]) { const m = new THREE.Mesh(new THREE.PlaneGeometry(p.dx ? len : 0.1, p.dx ? 0.1 : len), MAT.yellow); m.rotation.x = -Math.PI / 2; m.position.set(p.x + p.nx * o, 0.02, p.z + p.nz * o); city.add(m); }
  }
}
// 斑馬線 (轉角與廣場前)
function zebra(cx, cz, alongX, len) {
  for (let k = -Math.floor(len / 1.2) / 2; k <= Math.floor(len / 1.2) / 2; k++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(alongX ? 0.55 : 2 * L.road - 0.6, alongX ? 2 * L.road - 0.6 : 0.55), MAT.white);
    m.rotation.x = -Math.PI / 2; m.position.set(cx + (alongX ? k * 1.2 : 0), 0.025, cz + (alongX ? 0 : k * 1.2)); city.add(m);
  }
}
zebra(0, RR, true, 10);

/* ---------------- 店 ---------------- */
const B = {}, BF = [];   // 公司的店 (名稱 → 執行期資料)、一般小店
const shopkeepers = [];
function buildStore(c) {
  const g = new THREE.Group(); g.position.set(c.front[0], 0, c.front[1]); g.rotation.y = c.rotY; city.add(g);
  const det = new THREE.Group(); g.add(det);   // 招牌等細節：離太遠時隱藏
  const w = c.w, H = 3.6 + (c.fl - 1) * 3.2, h0 = hashStr(c.name);
  const style = c.filler ? 'tile' : c.tier === 'xl' ? 'glass' : STYLE_OF[c.d] || 'tile';
  const tint = new THREE.Color(pick(TINTS[style], h0 >> 3));
  const fac = new THREE.MeshLambertMaterial({ map: FAC[style].map, emissiveMap: FAC[style].emi, emissive: 0xffe0a0, emissiveIntensity: 0, color: tint.clone() });
  const body = new THREE.Mesh(facadeBox(w - 0.12, H - 3.6, L.dep), fac); body.position.set(0, 3.6 + (H - 3.6) / 2, -L.dep / 2); body.castShadow = true; body.receiveShadow = true; g.add(body);  
  const glass = new THREE.MeshLambertMaterial({ map: TX.shop, emissiveMap: TX.shopE, emissive: 0xfff1d0, emissiveIntensity: 0.4 });
  const gp = new THREE.Mesh(planeUV(w - 0.12, 3.6, (w - 0.12) / 4, 1), glass); gp.position.set(0, 1.8, -L.arc); det.add(gp);
  const bg = c.filler ? pick(SIGN_BG.fill, h0) : pick(SIGN_BG[c.d] || SIGN_BG.life, h0);
  const ft = fasciaTex(c, bg), fasM = new THREE.MeshLambertMaterial({ map: ft, emissiveMap: ft, emissive: 0xffffff, emissiveIntensity: 0.2 });
  const fas = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.5, 0.95), fasM); fas.position.set(0, 4.15, 0.07); det.add(fas);
  const pick3 = [body, gp, fas];
  let vs = null;
  const hS = Math.min(H - 5.6, 8.5);
  if (!c.filler && hS >= 2.4) {   // 直式招牌 (垂直於立面，走在街上遠遠就看得到)
    const vt = vsignTex(c.name, bg, hS), vm = new THREE.MeshLambertMaterial({ map: vt, emissiveMap: vt, emissive: 0xffffff, emissiveIntensity: 0.2 });
    const geo = new THREE.BoxGeometry(0.22, hS, 1.3), uv = geo.attributes.uv;
    for (let i = 8; i < 24; i++) uv.setXY(i, 0.03, 0.5);
    vs = new THREE.Mesh(geo, vm); vs.position.set((w / 2 - 0.6) * (h0 % 2 ? 1 : -1), 4.9 + hS / 2, 0.72); det.add(vs); pick3.push(vs);
  }
  let roof = null;
  if (!c.filler && (c.tier === 'xl' || c.tier === 'l')) {   // 大店的屋頂招牌
    const rt = roofSignTex(c, bg), pw = Math.min(w * 0.8, 16), ph = pw * 112 / 512;
    roof = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshLambertMaterial({ map: rt, emissiveMap: rt, emissive: 0xffffff, emissiveIntensity: 0.3, side: THREE.DoubleSide }));
    roof.position.set(0, H + 0.7 + ph / 2, -1.6); det.add(roof); pick3.push(roof);
    for (const sx of [-pw * 0.35, pw * 0.35]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.9, 0.18), MAT.metal); p.position.set(sx, H + 0.45, -1.7); det.add(p); }
  }
  // 跑馬燈
  let mq = null;
  if (!c.filler) {
    const pw = Math.min(w * 0.72, 9), cv = mkCanvas(256, 32), tex = canvasTex(cv, { rep: true });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(pw, 0.34), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
    mesh.position.set(0, 3.36, 0.05); det.add(mesh); mq = { cv, tex, mesh, pw };
  }
  // ETF 櫥窗貼紙
  if (c.etfs && c.etfs.length) {
    const st = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(1.25 * c.etfs.length, w - 0.8), Math.min(1.25 * c.etfs.length, w - 0.8) / c.etfs.length * 0.375), new THREE.MeshBasicMaterial({ map: stickerTex(c), transparent: true, toneMapped: false }));
    st.position.set(0, 1.45, -L.arc + 0.04); det.add(st);
  }
  // 鐵捲門 (大跌時拉下一半) 與彩帶氣球 (大漲時)
  const shut = new THREE.Mesh(planeUV(w - 0.3, 1.75, (w - 0.3) / 1.2, 1.75 / 1.2), MAT.shutter); shut.position.set(0, 2.72, -L.arc + 0.06); shut.visible = false; det.add(shut);
  const fx = new THREE.Group(); fx.visible = false; det.add(fx);
  if (!c.filler) {
    const n = Math.max(4, Math.floor((w - 0.6) / 0.62)), pos = [], col = [], cols = ['#e53935', '#fdd835', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa'].map(h => new THREE.Color(h));
    for (let i = 0; i < n; i++) {
      const x0 = -w / 2 + 0.3 + i * (w - 0.6) / n, x1 = x0 + (w - 0.6) / n * 0.82, sag = t => -0.25 * Math.sin(Math.PI * t);
      const t0 = i / n, t1 = (i + 0.82) / n, y0 = 3.0 + sag(t0), y1 = 3.0 + sag(t1);
      pos.push(x0, y0, 0.2, x1, y1, 0.2, (x0 + x1) / 2, (y0 + y1) / 2 - 0.42, 0.2); const cc = cols[i % cols.length]; for (let k = 0; k < 3; k++) col.push(cc.r, cc.g, cc.b);
    }
    const bgeo = new THREE.BufferGeometry(); bgeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bgeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    fx.add(new THREE.Mesh(bgeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    for (const [sx, hex] of [[-w / 2 + 0.4, 0xe53935], [w / 2 - 0.4, 0xfdd835], [-w / 2 + 0.9, 0x1e88e5]]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 10), new THREE.MeshLambertMaterial({ color: hex, emissive: hex, emissiveIntensity: 0.25 })); b.position.set(sx, 2.5 + (sx > 0 ? 0.2 : 0), 0.15); b.scale.y = 1.15; fx.add(b);
    }
  }
  // 騎樓柱子、屋頂水塔與冷氣、門口店長
  const np = Math.max(2, Math.ceil(w / 4.3) + 1);
  for (let i = 0; i < np; i++) { const [x, z] = worldOf(c, -w / 2 + 0.3 + i * (w - 0.6) / (np - 1), -0.28); instPush(INST.pillar, x, 1.8, z, c.rotY); }
  const r = rng(h0);
  if (r() < 0.75) { const [x, z] = worldOf(c, (r() - 0.5) * (w - 3), -L.dep * (0.45 + r() * 0.3)); instPush(INST.tank, x, H + 1.1, z); }
  for (let i = 0, n = 1 + Math.floor(r() * 3); i < n; i++) { const [x, z] = worldOf(c, (r() - 0.5) * (w - 2), -2 - r() * (L.dep - 4)); instPush(INST.ac, x, H + 0.35, z, c.rotY); }
  if (!c.filler) { const side = h0 % 2 ? -1 : 1, [x, z] = worldOf(c, side * Math.min(w / 2 - 1.1, 2.4), -L.arc + 0.8); shopkeepers.push({ x, z, ry: c.rotY, h: h0 }); }
  // 撞牆
  addColl(COLL, [worldOf(c, -w / 2, -L.arc + 0.05), worldOf(c, w / 2, -L.dep)]);
  addColl(COLLB, [worldOf(c, -w / 2, 0), worldOf(c, w / 2, -L.dep)]);
  const rec = { pick: pick3, det, c, g, fac, glass, fasM, vs, roof, mq, shut, fx, H, tint, h0, label: null, beacon: null, bag: null, state: 'flat', dim: false, flick: 0, nextBurst: Math.random() * 2 };
  for (const m of pick3) m.userData.store = c.filler ? null : c.name;
  if (c.filler) BF.push(rec); else B[c.name] = rec;
  return rec;
}
STORES.forEach(buildStore);
const PICK = Object.values(B).flatMap(b => b.pick);

/* ---------------- 轉角、內圈與外圈的背景建築、港口 ---------------- */
{
  const R = RR, geos = [], r = rng(99), col = new THREE.Color();
  const box = (x0, z0, x1, z1, h, coll = true, tint) => {
    if (x1 - x0 < 2 || z1 - z0 < 2) return;
    const geo = facadeBox(x1 - x0, h, z1 - z0); geo.translate((x0 + x1) / 2, h / 2, (z0 + z1) / 2);
    col.set(tint || pick(TINTS.tile, Math.floor(r() * 100))); const n = geo.attributes.position.count, ca = new Float32Array(n * 3); for (let i = 0; i < n; i++) { ca[i * 3] = col.r; ca[i * 3 + 1] = col.g; ca[i * 3 + 2] = col.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(ca, 3)); geos.push(geo);
    if (coll) { COLL.push({ x0, x1, z0, z1 }); COLLB.push({ x0, x1, z0, z1 }); }
  };
  // 轉角
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const q = (a0, b0, a1, b1, h) => box(Math.min(sx * a0, sx * a1), Math.min(sz * b0, sz * b1), Math.max(sx * a0, sx * a1), Math.max(sz * b0, sz * b1), h);
    q(R - L.cIn, R - L.cIn, R - L.shop, R - L.shop, 13 + r() * 8);
    q(R - L.cOut, R + L.shop, R + L.shop + L.dep - 3, R + L.shop + L.dep - 3, 16 + r() * 10);
    q(R + L.shop, R - L.cOut, R + L.shop + L.dep - 3, R + L.shop - 0.01, 16 + r() * 10);
  }
  // 內圈：店後面的街廓 (避開廣場)
  const A = R - L.front - L.dep - 1.5;
  for (let x = -A; x < A - 4; ) {
    const w = 12 + r() * 10, x1 = Math.min(A, x + w);
    for (let z = -A; z < A - 4; ) {
      const d = 12 + r() * 10, z1 = Math.min(A, z + d);
      const hitPlaza = x1 > PL.x0 - 2 && x < PL.x1 + 2 && z1 > PL.z0 - 2;
      if (!hitPlaza) box(x + 0.8, z + 0.8, x1 - 0.8, z1 - 0.8, 10 + r() * 26, false);
      z = z1;
    }
    x = x1;
  }
  // 外圈：店後面的高樓 (海邊那一側改成碼頭)
  const O0 = R + L.front + L.dep + 1.5, O1 = R + 46;
  for (let i = 0; i < 4; i++) {
    if (i === SEA_SIDE) continue;
    const tm = i % 2 === 0 ? R + 46 : R + L.front + L.dep;
    for (let t = -tm; t < tm - 4; ) {
      const w = 12 + r() * 12, t1 = Math.min(tm, t + w), dd = 10 + r() * 14;
      const P = [[[t, O0], [t1, O0 + dd]], [[O0, -t1], [O0 + dd, -t]], [[-t1, -O0 - dd], [-t, -O0]], [[-O0 - dd, t], [-O0, t1]]][i];
      box(Math.min(P[0][0], P[1][0]) + 0.6, Math.min(P[0][1], P[1][1]) + 0.6, Math.max(P[0][0], P[1][0]) - 0.6, Math.max(P[0][1], P[1][1]) - 0.6, 18 + r() * 34, false);
      t = t1;
    }
  }
  const merged = mergeGeometries(geos); const apt = new THREE.Mesh(merged, MAT.apt); apt.castShadow = true; apt.receiveShadow = true; city.add(apt);
  // 港口：碼頭、海、貨櫃船、橋式起重機
  const sq = (o0, o1, y, mat) => { const p = ringPt(SEA_SIDE * LAY.side + R), len = 2 * (R + 120); const cx = p.x + p.nx * (o0 + o1) / 2, cz = p.z + p.nz * (o0 + o1) / 2, wd = o1 - o0; const w = p.dx ? len : wd, d = p.dx ? wd : len; return flatRect(cx - w / 2, cz - d / 2, cx + w / 2, cz + d / 2, y, mat); };
  sq(L.front + L.dep + 1, SEA_O, 0.01, MAT.quay);
  const sea = sq(SEA_O, 240, -0.25, MAT.water); sea.receiveShadow = false;
  const p = ringPt(SEA_SIDE * LAY.side + R), along = (a, o, y) => new THREE.Vector3(p.x + p.dx * a + p.nx * o, y, p.z + p.dz * a + p.nz * o);
  const ship = new THREE.Group(), hull = new THREE.Mesh(new THREE.BoxGeometry(70, 6, 13), new THREE.MeshLambertMaterial({ color: 0x23395b })); hull.position.y = 1.5; ship.add(hull);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(6, 8, 11), MAT.white); bridge.position.set(-30, 8, 0); ship.add(bridge);
  const cc = [0xc0392b, 0x2e7d4f, 0x2c5aa0, 0xd6a21e, 0x8e44ad, 0xe67e22];
  for (let i = 0; i < 18; i++) for (let j = 0; j < 3; j++) { const k = new THREE.Mesh(new THREE.BoxGeometry(3.2, 2.5, 3.6), new THREE.MeshLambertMaterial({ color: cc[(i * 3 + j * 5) % cc.length] })); k.position.set(-22 + i * 3.4, 5.8 + (j % 2) * 2.5, -4 + j * 4); ship.add(k); }
  const sp = along(10, L.front + L.dep + 26, 0); ship.position.copy(sp); ship.rotation.y = Math.atan2(p.dx, p.dz) + Math.PI / 2; city.add(ship);
  for (const a of [-30, 25]) {
    const cr = new THREE.Group(), red = new THREE.MeshLambertMaterial({ color: 0xc8402c });
    for (const o of [-4, 4]) for (const s of [-5, 5]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(0.8, 26, 0.8), red); leg.position.set(s, 13, o); cr.add(leg); }
    const top = new THREE.Mesh(new THREE.BoxGeometry(12, 1.6, 34), red); top.position.set(0, 26, 10); cr.add(top);
    cr.position.copy(along(a, L.front + L.dep + 9, 0)); cr.rotation.y = Math.atan2(p.nx, p.nz); city.add(cr);
  }
}

/* ---------------- ETF 廣場：大螢幕、ETF 站牌、噴水池、牌樓 ---------------- */
const plazaG = new THREE.Group(); city.add(plazaG);
flatRect(PL.x0, PL.z0, PL.x1, PL.z1 + 0.2, 0.03, MAT.plaza, (PL.x1 - PL.x0) / 3, (PL.z1 - PL.z0) / 3);
const SCREEN = { cv: mkCanvas(1024, 576) };
{
  SCREEN.tex = canvasTex(SCREEN.cv);
  const z = PL.z0 + 2, frame = new THREE.Mesh(new THREE.BoxGeometry(17.4, 10.2, 0.8), MAT.dark); frame.position.set(0, 9, z); frame.castShadow = true; plazaG.add(frame);
  const scr = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshBasicMaterial({ map: SCREEN.tex, toneMapped: false })); scr.position.set(0, 9, z + 0.42); plazaG.add(scr);
  for (const x of [-6, 6]) { const leg = new THREE.Mesh(new THREE.BoxGeometry(1, 4, 1), MAT.dark); leg.position.set(x, 2, z); plazaG.add(leg); }
  COLL.push({ x0: -8.7, x1: 8.7, z0: z - 0.6, z1: z + 0.6 });
}
const STOPS = {};
ETF_KEYS.forEach((k, i) => {
  const n = ETF_KEYS.length, x = n > 1 ? -6 + 12 * i / (n - 1) : 0, z = PL.z0 + 7.5;
  const cv = mkCanvas(256, 300), g = cv.getContext('2d'), e = ETFS[k];
  g.fillStyle = '#fbfbf8'; g.fillRect(0, 0, 256, 300); g.fillStyle = e.color; g.fillRect(0, 0, 256, 96);
  g.fillStyle = '#fff'; g.font = `900 64px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(k, 128, 50);
  g.fillStyle = '#1d2733'; g.font = `700 ${Math.min(34, 220 / e.name.length * 1.1)}px ${FONT}`; g.fillText(e.name, 128, 136);
  g.font = `500 24px ${FONT}`; g.fillStyle = '#56616e'; g.fillText(e.type + ' ETF', 128, 182); g.fillText('跟著地上的線走', 128, 222);
  g.fillStyle = e.color; g.fillRect(40, 252, 176, 14);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.2, 8), MAT.metal); pole.position.set(x, 1.6, z); plazaG.add(pole);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.76), new THREE.MeshLambertMaterial({ map: canvasTex(cv), side: THREE.DoubleSide, emissive: 0xffffff, emissiveIntensity: 0.15, emissiveMap: canvasTex(cv) }));
  sign.position.set(x, 2.35, z + 0.08); plazaG.add(sign); sign.userData.etf = k;
  STOPS[k] = { x, z, sign };
  COLL.push({ x0: x - 0.12, x1: x + 0.12, z0: z - 0.12, z1: z + 0.12 });
});
{ // 噴水池、樹、長椅
  const fx = -11.6, fz = PL.z1 - 9;
  const basin = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.6, 0.6, 28), MAT.curb); basin.position.set(fx, 0.3, fz); plazaG.add(basin);
  const wat = new THREE.Mesh(new THREE.CircleGeometry(2.15, 28), new THREE.MeshLambertMaterial({ color: 0x5aa6d6, emissive: 0x1a4a6a, emissiveIntensity: 0.3 })); wat.rotation.x = -Math.PI / 2; wat.position.set(fx, 0.58, fz); plazaG.add(wat);
  const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.4, 1.8, 10), MAT.curb); sp.position.set(fx, 1.2, fz); plazaG.add(sp);
  COLL.push({ x0: fx - 2.5, x1: fx + 2.5, z0: fz - 2.5, z1: fz + 2.5 });
  for (const [x, z] of [[11, PL.z0 + 9], [11, PL.z0 + 17], [-11.5, PL.z0 + 9], [12.5, PL.z1 - 5]]) instPush(INST.tree, x, 0, z, 0, [1.2, 1.2, 1.2]);
  for (const x of [9, 12.5]) { const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.45, 0.6), MAT.trunk); b.position.set(x, 0.45, PL.z0 + 13); plazaG.add(b); }
}
// 牌樓 (跨過馬路或廣場入口的大招牌)
function arch(cx, cz, ax, az, span, textA, textB, color = '#b3261e') {
  const g = new THREE.Group(); g.position.set(cx, 0, cz); g.rotation.y = Math.atan2(ax, az) + Math.PI / 2; city.add(g);
  const red = new THREE.MeshLambertMaterial({ color });
  const top = span > 20 ? 9.5 : 6.6;
  for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, top, 0.5), red); p.position.set(s * span / 2, top / 2, 0); g.add(p); COLL.push({ x0: cx + ax * s * span / 2 - 0.3, x1: cx + ax * s * span / 2 + 0.3, z0: cz + az * s * span / 2 - 0.3, z1: cz + az * s * span / 2 + 0.3 }); }
  const beam = new THREE.Mesh(new THREE.BoxGeometry(span + 1.2, 0.4, 0.5), red); beam.position.y = top + 0.15; g.add(beam);
  const mk = (t) => { const cv = mkCanvas(512, 96), x = cv.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, 512, 96); x.strokeStyle = '#f6d36b'; x.lineWidth = 6; x.strokeRect(6, 6, 500, 84); x.fillStyle = '#ffe9a8'; x.font = `900 58px ${FONT}`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, 256, 51); return canvasTex(cv); };
  const sw = Math.min(span * 0.7, top > 7 ? 6 : 8);
  [[textA, 0.32, 0], [textB, -0.32, Math.PI]].forEach(([t, z, ry]) => { const tx = mk(t); const m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw * 96 / 512), new THREE.MeshLambertMaterial({ map: tx, emissiveMap: tx, emissive: 0xffffff, emissiveIntensity: 0.2 })); m.position.set(0, top - 0.55, z); m.rotation.y = ry; g.add(m); });
  return g;
}
// ax/az 是牌樓橫跨的方向
arch(0, RR - L.front - 0.6, 1, 0, 2 * L.plazaHalf - 1.5, 'ETF 廣場', 'ETF 廣場', '#1f4e8c');
LAY.dists.forEach((d, i) => {
  const prev = LAY.dists[(i + LAY.dists.length - 1) % LAY.dists.length], s = d.s0 - L.dGap / 2, q = ringPt(s);
  // 牌樓的 A 面朝 +s：從 d 往回走的人看到 prev 的名稱；從 prev 走過來的人看到 d 的名稱
  arch(q.x, q.z, q.nx, q.nz, 2 * L.road + 1.6, DIST[prev.k].name, DIST[d.k].name);
});

/* ---------------- 路燈、行道樹、機車、柱子、屋頂雜物 (instanced) ---------------- */
for (let s = 4; s < LAY.P; s += 17) for (const sg of [1, -1]) {
  const q = ringPt(s), lt = s - Math.floor(s / LAY.side) * LAY.side; if (lt < 14 || lt > LAY.side - 14) continue;
  const p = ringPt(s, sg * (L.road + 0.55));
  if (sg < 0 && Math.abs(p.x) < L.plazaHalf + 1 && p.z > 0 && q.i === 0) continue;
  instPush(INST.lamp, p.x, 0, p.z, Math.atan2(-q.nx * sg, -q.nz * sg));
  for (let k = 0; k < 3; k++) if ((hashStr('m' + s + sg) >> k) % 3 === 0) { const mp = ringPt(s + 3 + k * 0.9, sg * (L.road + 1.6)); instPush(INST.scooter, mp.x, 0, mp.z, Math.atan2(q.nx * sg, q.nz * sg)); }
}
{
  buildInstanced(new THREE.BoxGeometry(0.46, 3.6, 0.46), MAT.pillar, INST.pillar, true);
  buildInstanced(new THREE.CylinderGeometry(0.75, 0.75, 1.5, 12), MAT.tank, INST.tank, true);
  buildInstanced(new THREE.BoxGeometry(0.9, 0.7, 0.6), MAT.white, INST.ac, false);
  const pole = new THREE.CylinderGeometry(0.07, 0.09, 6, 6); pole.translate(0, 3, 0);
  buildInstanced(pole, MAT.metal, INST.lamp, false);
  const head = new THREE.BoxGeometry(0.4, 0.16, 1.1); head.translate(0, 6, 0.45);
  buildInstanced(head, MAT.lampHead, INST.lamp, false);
  const trunk = new THREE.CylinderGeometry(0.12, 0.16, 2.4, 6); trunk.translate(0, 1.2, 0);
  buildInstanced(trunk, MAT.trunk, INST.tree, false);
  const crown = new THREE.IcosahedronGeometry(1.3, 0); crown.translate(0, 3.1, 0);
  buildInstanced(crown, MAT.leaf, INST.tree, true);
  const sc = mergeGeometries([new THREE.BoxGeometry(0.34, 0.5, 1.5).translate(0, 0.45, 0), new THREE.BoxGeometry(0.3, 0.25, 0.6).translate(0, 0.82, -0.25), new THREE.BoxGeometry(0.06, 0.6, 0.06).translate(0, 0.95, 0.6)]);
  buildInstanced(sc, new THREE.MeshLambertMaterial({ color: 0x9aa7b4 }), INST.scooter, false);
}

/* ---------------- 人物：路人與店長 (instanced) ---------------- */
function personGeo() {   // 衣服 (可換色) 與其他部分分開
  const shirt = mergeGeometries([new THREE.BoxGeometry(0.44, 0.58, 0.26).translate(0, 1.12, 0), new THREE.BoxGeometry(0.12, 0.56, 0.13).translate(0.29, 1.1, 0), new THREE.BoxGeometry(0.12, 0.56, 0.13).translate(-0.29, 1.1, 0)]);
  const rest = [new THREE.BoxGeometry(0.28, 0.3, 0.28).translate(0, 1.58, 0), new THREE.BoxGeometry(0.3, 0.1, 0.3).translate(0, 1.76, -0.01), new THREE.BoxGeometry(0.15, 0.82, 0.17).translate(0.1, 0.41, 0), new THREE.BoxGeometry(0.15, 0.82, 0.17).translate(-0.1, 0.41, 0)];
  const cols = ['#f0c8a8', '#2b211c', '#2c3542', '#2c3542'];
  rest.forEach((g, i) => { const c = new THREE.Color(cols[i]), n = g.attributes.position.count, a = new Float32Array(n * 3); for (let k = 0; k < n; k++) { a[k * 3] = c.r; a[k * 3 + 1] = c.g; a[k * 3 + 2] = c.b; } g.setAttribute('color', new THREE.BufferAttribute(a, 3)); });
  return { shirt, rest: mergeGeometries(rest) };
}
const PG = personGeo(), SHIRTS = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa', '#fb8c00', '#00897b', '#f5f5f5', '#5d4037', '#3949ab'].map(h => new THREE.Color(h));
function people(n) {
  const a = new THREE.InstancedMesh(PG.shirt, new THREE.MeshLambertMaterial({ color: 0xffffff }), n), b = new THREE.InstancedMesh(PG.rest, new THREE.MeshLambertMaterial({ vertexColors: true }), n);
  for (let i = 0; i < n; i++) a.setColorAt(i, SHIRTS[(i * 7) % SHIRTS.length]);
  a.castShadow = b.castShadow = true; city.add(a, b); return [a, b];
}
const KEEP = people(shopkeepers.length);
{
  const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1);
  shopkeepers.forEach((k, i) => { Q.setFromEuler(E.set(0, k.ry, 0)); M4.compose(V.set(k.x, 0.04, k.z), Q, S); KEEP[0].setMatrixAt(i, M4); KEEP[1].setMatrixAt(i, M4); KEEP[0].setColorAt(i, SHIRTS[k.h % SHIRTS.length]); });
}
const WALKERS = [];
{ const r = rng(5); for (let i = 0; i < 40; i++) WALKERS.push({ s: r() * LAY.P, off: (r() < 0.5 ? 1 : -1) * (r() < 0.6 ? L.road + 1.25 + r() * 0.6 : L.front + 1.1 + r() * 1.2), dir: r() < 0.5 ? 1 : -1, v: 1 + r() * 0.6, ph: r() * 6 }); }
const WALK_MESH = people(WALKERS.length);

/* ---------------- 車流：機車與汽車 (靠右行駛，遇到人會停) ---------------- */
const CARS = [];
function vehicle(kind, color) {
  const g = new THREE.Group(), m = new THREE.MeshLambertMaterial({ color });
  if (kind === 'car') {
    const b = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.7, 4.1), m); b.position.y = 0.6; g.add(b);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.6, 2.1), new THREE.MeshLambertMaterial({ color: 0x2c3a47 })); cab.position.set(0, 1.2, -0.2); g.add(cab);
  } else {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.5, 1.5), m); b.position.y = 0.45; g.add(b);
    const rider = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.62, 0.3), new THREE.MeshLambertMaterial({ color: SHIRTS[Math.floor(Math.random() * SHIRTS.length)] })); rider.position.set(0, 1.18, -0.15); g.add(rider);
    const helm = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), new THREE.MeshLambertMaterial({ color: 0xfafafa })); helm.position.set(0, 1.62, -0.12); g.add(helm);
  }
  const hl = new THREE.Mesh(new THREE.BoxGeometry(kind === 'car' ? 1.4 : 0.2, 0.12, 0.05), new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0xfff4c0, emissiveIntensity: 0 }));
  hl.position.set(0, kind === 'car' ? 0.68 : 0.7, kind === 'car' ? 2.06 : 0.78); g.add(hl); g.userData.hl = hl.material;
  g.traverse(o => { if (o.isMesh) o.castShadow = true; }); city.add(g); return g;
}
{
  const r = rng(11), cols = [0xd94a3a, 0xf2f2f2, 0x3a6ea8, 0x2b2b2b, 0xe0b23a, 0x6f8f5a, 0x9aa7b4];
  for (let i = 0; i < 22; i++) { const kind = i % 3 === 0 ? 'car' : 'scooter', dir = i % 2 ? 1 : -1; CARS.push({ g: vehicle(kind, cols[i % cols.length]), kind, dir, s: (i / 22) * LAY.P + r() * 10, off: dir * (kind === 'car' ? 2.1 : 2.9), vmax: kind === 'car' ? 9 : 10.5, v: 8 }); }
}

/* ---------------- ETF 導引線：從廣場的站牌出發，沿著馬路經過它的前十大 ---------------- */
const LINES = {};
function ribbon(paths, width, y) {
  const pos = [], uv = [], idx = []; let base = 0;
  for (const pts of paths) {
    let u = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[Math.min(i + 1, pts.length - 1)], o = pts[Math.max(i - 1, 0)];
      let dx = q[0] - o[0], dz = q[1] - o[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      if (i) u += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) / 1.6;
      pos.push(p[0] - dz * width / 2, y, p[1] + dx * width / 2, p[0] + dz * width / 2, y, p[1] - dx * width / 2); uv.push(u, 0, u, 1);
      if (i) idx.push(base + (i - 1) * 2, base + i * 2, base + (i - 1) * 2 + 1, base + (i - 1) * 2 + 1, base + i * 2, base + i * 2 + 1);
    }
    base += pts.length * 2;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); return g;
}
const modP = v => ((v % LAY.P) + LAY.P) % LAY.P;
ETF_KEYS.forEach((k, i) => {
  const st = STOPS[k], n = ETF_KEYS.length, lane = (i - (n - 1) / 2) * 0.62;
  const names = Object.keys(ETFS[k].w).filter(nm => CO[nm] && CO[nm].front), ss = names.map(nm => CO[nm].s);
  const s0 = RR + st.x, fwd = Math.max(...ss.map(s => modP(s - s0))), back = Math.max(...ss.map(s => modP(s0 - s)));
  const dir = fwd <= back ? 1 : -1, len = Math.min(fwd, back) + 3;
  const main = [[st.x, st.z + 0.4], [st.x, RR - L.road - 0.4]];
  for (let d = 0; d <= len; d += 1.5) { const p = ringPt(s0 + dir * d, lane); main.push([p.x, p.z]); }
  const stubs = names.map(nm => { const c = CO[nm], p = ringPt(c.s, lane), q = ringPt(c.s, c.sg * (L.road + 0.6)); return [[p.x, p.z], [q.x, q.z]]; });
  const mat = new THREE.MeshBasicMaterial({ map: TX.chev, color: ETFS[k].color, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 - i, toneMapped: false });
  const mesh = new THREE.Mesh(ribbon([main, ...stubs], 0.36, 0.045 + i * 0.004), mat); mesh.renderOrder = 2; city.add(mesh);
  LINES[k] = { mesh, mat, dir, names, path: main };
});

/* ---------------- 天氣：雨 (跟著鏡頭) 與煙火 ---------------- */
const RAIN_N = 1600, rainGeo = new THREE.BufferGeometry(), rainPos = new Float32Array(RAIN_N * 6);
{ const r = rng(3); for (let i = 0; i < RAIN_N; i++) { const x = (r() - 0.5) * 70, y = r() * 34, z = (r() - 0.5) * 70; rainPos.set([x, y, z, x, y - 0.9, z], i * 6); } }
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xbfd3e6, transparent: true, opacity: 0.5 })); rain.visible = false; rain.frustumCulled = false; scene.add(rain);
const bursts = [];
function spawnBurst(x, y, z) {
  const n = 70, g = new THREE.BufferGeometry(), pos = new Float32Array(n * 3), vel = [], col = new THREE.Color().setHSL(Math.random(), 0.9, 0.62);
  for (let i = 0; i < n; i++) { pos.set([x, y, z], i * 3); const v = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.4, Math.random() - 0.5).normalize().multiplyScalar(5 + Math.random() * 3); vel.push(v); }
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: col, size: 0.5, transparent: true, depthWrite: false, toneMapped: false })); scene.add(p); bursts.push({ p, vel, life: 0 });
}

/* ---------------- 角色 (看得到背部的第三人稱，或眼睛視角) ---------------- */
function makeAvatar() {
  const g = new THREE.Group(), M_ = c => new THREE.MeshLambertMaterial({ color: c, emissive: c, emissiveIntensity: 0.12 });
  const hoodie = M_(0x2f6fd6), pants = M_(0x27303b), skin = M_(0xf1c7a5), hair = M_(0x2a211c), shoe = M_(0xf2f2f2), bag = M_(0xf0a830);
  const add = (geo, mat, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  add(new THREE.BoxGeometry(0.46, 0.6, 0.27), hoodie, 0, 1.12, 0);
  add(new THREE.BoxGeometry(0.42, 0.2, 0.25), pants, 0, 0.84, 0);
  const head = add(new THREE.BoxGeometry(0.3, 0.32, 0.3), skin, 0, 1.6, 0);
  add(new THREE.BoxGeometry(0.32, 0.12, 0.32), hair, 0, 1.79, -0.01); add(new THREE.BoxGeometry(0.32, 0.2, 0.08), hair, 0, 1.66, -0.13);
  add(new THREE.BoxGeometry(0.36, 0.44, 0.17), bag, 0, 1.16, -0.22); add(new THREE.BoxGeometry(0.3, 0.12, 0.05), M_(0xd18f1f), 0, 1.0, -0.32);
  const limb = (x, y, gw, gh, mat, foot) => { const p = new THREE.Group(); p.position.set(x, y, 0); g.add(p); add(new THREE.BoxGeometry(gw, gh, gw + 0.02), mat, 0, -gh / 2, 0, p); if (foot) add(new THREE.BoxGeometry(gw + 0.03, 0.08, 0.27), shoe, 0, -gh - 0.02, 0.04, p); else add(new THREE.BoxGeometry(gw - 0.01, 0.1, gw - 0.01), skin, 0, -gh - 0.05, 0, p); return p; };
  const legs = [limb(0.11, 0.8, 0.16, 0.74, pants, true), limb(-0.11, 0.8, 0.16, 0.74, pants, true)];
  const arms = [limb(0.31, 1.38, 0.13, 0.56, hoodie, false), limb(-0.31, 1.38, 0.13, 0.56, hoodie, false)];
  scene.add(g); return { g, legs, arms, head };
}
const AV = makeAvatar();
const START = { x: 0, z: RR - L.front - 7.5, yaw: 0 };
const ME = { x: START.x, z: START.z, y: 0, vy: 0, yaw: 0, pitch: 0.16, face: 0, speed: 0, phase: 0, view: 'tp', dist: isDesk() ? 5.2 : 6.4, blend: 1, lastDrag: -10, auto: null };
const keys = new Set(), JOY = { x: 0, y: 0, on: false };

function inPlaza(x, z) { return x > PL.x0 + 0.4 && x < PL.x1 - 0.4 && z > PL.z0 + 0.5 && z < PL.z1 + 1; }
function walkable(x, z) { const q = ringS(x, z); return q.d <= L.band || inPlaza(x, z); }
function hitColl(x, z, r = 0.32) { for (const b of COLL) if (x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r) return true; return false; }
const blocked = (x, z) => hitColl(x, z) || !walkable(x, z);
function moveBy(dx, dz) {
  if (!blocked(ME.x + dx, ME.z + dz)) { ME.x += dx; ME.z += dz; return true; }
  let ok = false;
  if (!blocked(ME.x + dx, ME.z)) { ME.x += dx; ok = true; }
  if (!blocked(ME.x, ME.z + dz)) { ME.z += dz; ok = true; }
  return ok;
}

/* ---------------- 自動走路 (點店家、點地面，或 Agent 的 fly_to) ---------------- */
function planPath(x1, z1) {
  const a = ringS(ME.x, ME.z), b = ringS(x1, z1), pts = [];
  const la = clamp(a.off, -3, 3), lb = clamp(b.off, -3, 3);
  let ds = modP(b.s - a.s), dir = 1; if (ds > LAY.P / 2) { ds = LAY.P - ds; dir = -1; }
  if (inPlaza(ME.x, ME.z) && ME.z < PL.z1 - 3) pts.push([ME.x < 0 ? -2.25 : 2.25, PL.z1 - 4.5], [ME.x < 0 ? -2.25 : 2.25, PL.z1 + 0.5]);
  if (ds > 4 || a.d > 4 || b.d > 4) { const n = Math.max(1, Math.ceil(ds / 5)); for (let k = 0; k <= n; k++) { const p = ringPt(a.s + dir * ds * k / n, lerp(la, lb, k / n)); pts.push([p.x, p.z]); } }
  if (inPlaza(x1, z1) && z1 < PL.z1 - 3) pts.push([x1 < 0 ? -2.25 : 2.25, PL.z1 + 0.5], [x1 < 0 ? -2.25 : 2.25, PL.z1 - 4.5]);
  pts.push([x1, z1]);
  let D = 0, px = ME.x, pz = ME.z; for (const [x, z] of pts) { D += Math.hypot(x - px, z - pz); px = x; pz = z; }
  return { pts, D };
}
let onArrive = null;
function walkToPoint(x, z, { face = null, label = '', then = null, fast = false } = {}) {
  const { pts, D } = planPath(x, z), dur = clamp(D / (fast ? 22 : 10), 0.5, fast ? 2.6 : 4);
  ME.auto = { pts, i: 0, v: Math.max(5, D / dur), face, stuck: 0, last: [ME.x, ME.z], label };
  onArrive = then; showWalkChip(label);
}
function storeFace(c) { return Math.atan2(-c.fx, -c.fz); }
function doorOf(c) { const q = ringPt(c.s, c.sg * 2.2); return [q.x, q.z]; }
function walkToStore(name, { card = false, fast = true } = {}) {
  const c = CO[name]; if (!c || !c.front) return;
  const [x, z] = doorOf(c);
  walkToPoint(x, z, { face: storeFace(c), label: name, fast, then: () => { if (card) openCard(name); } });
}
function teleport(x, z, yaw) {
  ME.x = x; ME.z = z; ME.y = 0; ME.vy = 0; if (yaw != null) { ME.yaw = yaw; ME.face = yaw; } ME.auto = null; onArrive = null; showWalkChip(null);
}
function teleportStore(name, card = true) { const c = CO[name]; if (!c || !c.front) return; const [x, z] = doorOf(c); teleport(x, z, storeFace(c)); ME.pitch = ME.view === 'fp' ? 0.28 : 0.12; if (card) openCard(name); }
function goPlaza() { teleport(START.x, START.z, START.yaw); ME.pitch = 0.16; }
function cancelAuto() { ME.auto = null; onArrive = null; showWalkChip(null); }
function finishAuto(skip) {
  const A = ME.auto; if (!A) return;
  if (skip) { const [x, z] = A.pts.at(-1); ME.x = x; ME.z = z; }
  if (A.face != null) { ME.face = A.face; ME.yaw = A.face; ME.pitch = ME.view === 'fp' ? 0.28 : 0.12; }
  ME.auto = null; showWalkChip(null); const f = onArrive; onArrive = null; if (f) f();
}

/* ---------------- 店家狀態：今天的漲跌 → 燈光、跑馬燈、鐵捲門、彩帶 ---------------- */
let NIGHT = 0;
function storeColor(c) { return c >= 0.3 ? '#ff4b4b' : c <= -0.3 ? '#2bff8a' : '#ffc94a'; }
function paintStore(name, pct, full = true) {
  const b = B[name]; if (!b) return;
  const st = stateOf(pct); b.state = st; b.pct = pct;
  b.shut.visible = st === 'crash'; b.fx.visible = st === 'boom';
  if (b.mq && full) marqueeDraw(b.mq, `${b.c.name} ${b.c.code}   ${pct > 0 ? '▲' : pct < 0 ? '▼' : '－'} ${fmtPct(pct)}      `, storeColor(pct));
  lightStore(b);
}
function lightStore(b) {
  const L_ = b.c.filler ? 0.6 : LIT[b.state], dim = b.dim ? 0.35 : 1;
  b.fac.emissiveIntensity = (0.04 + 1.4 * Math.pow(NIGHT, 1.3)) * L_ * dim;
  b.glass.emissiveIntensity = (0.25 + 0.95 * NIGHT) * L_ * dim;
  b.fasM.emissiveIntensity = (0.32 + 0.75 * NIGHT) * (b.state === 'crash' ? 0.7 : 1) * dim;
  if (b.vs) b.vs.material.emissiveIntensity = (0.3 + 0.75 * NIGHT) * dim;
  if (b.roof) b.roof.material.emissiveIntensity = (0.2 + 1.0 * NIGHT) * dim;
  b.fac.color.copy(b.tint).multiplyScalar(b.dim ? 0.62 : 1);
}
function applyStates() { for (const n of Object.keys(B)) paintStore(n, chg[n] ?? 0); for (const b of BF) lightStore(b); }

/* ---------------- 標示：光柱、浮動標籤、我的持股購物袋 ---------------- */
function labelSprite(lines) {
  const cv = mkCanvas(256, 40 + lines.length * 34), g = cv.getContext('2d');
  roundRect(g, 4, 4, 248, cv.height - 8, 14); g.fillStyle = 'rgba(16,22,32,.86)'; g.fill(); g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.stroke();
  g.textAlign = 'center'; g.textBaseline = 'middle';
  lines.forEach((l, i) => { g.font = `${i ? 700 : 900} ${l.size || 26}px ${FONT}`; g.fillStyle = l.color || '#fff'; g.fillText(l.text, 128, 24 + i * 34 + 6); });
  const t = canvasTex(cv), sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, toneMapped: false }));
  sp.userData.aspect = cv.height / 256; sp.renderOrder = 20; return sp;
}
function setFloatLabel(name, lines) {
  const b = B[name]; if (!b) return;
  if (b.label) { scene.remove(b.label); b.label.material.map.dispose(); b.label.material.dispose(); b.label = null; }
  if (!lines) return;
  const sp = labelSprite(lines), [x, z] = worldOf(b.c, 0, 0.5); sp.position.set(x, b.H + (b.roof ? 4.8 : 2.4), z); sp.userData.base = sp.position.clone(); scene.add(sp); b.label = sp;
}
const beaconGeo = new THREE.CylinderGeometry(0.75, 0.75, 70, 18, 1, true); beaconGeo.translate(0, 35, 0);
function setBeacon(name, color) {
  const b = B[name]; if (!b) return;
  if (b.beacon) { scene.remove(b.beacon); b.beacon.material.dispose(); b.beacon = null; }
  if (color == null) return;
  const m = new THREE.Mesh(beaconGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false }));
  const [x, z] = worldOf(b.c, 0, 1.2); m.position.set(x, 0, z); scene.add(m); b.beacon = m;
}
const bagGeo = (() => { const body = new THREE.BoxGeometry(0.8, 0.95, 0.36).translate(0, 0.48, 0), h = new THREE.TorusGeometry(0.24, 0.04, 6, 16, Math.PI).translate(0, 0.95, 0); return mergeGeometries([body, h]); })();
const bagMat = new THREE.MeshLambertMaterial({ color: 0xf2b630, emissive: 0x8a5a00, emissiveIntensity: 0.35 });
function setBag(name, scale) {
  const b = B[name]; if (!b) return;
  if (b.bag) { scene.remove(b.bag); b.bag = null; }
  if (!scale) return;
  const m = new THREE.Mesh(bagGeo, bagMat), [x, z] = worldOf(b.c, b.h0 % 2 ? 1.6 : -1.6, -0.9); m.position.set(x, 0.05, z); m.rotation.y = b.c.rotY; m.scale.setScalar(0.7 + 1.6 * scale); m.castShadow = true; scene.add(m); b.bag = m;
}
let FOCUS = null;
function focusEtfs(set) {
  FOCUS = set && set.size ? set : null;
  for (const [k, Ln] of Object.entries(LINES)) { const on = !FOCUS || FOCUS.has(k); Ln.mat.opacity = FOCUS ? (on ? 1 : 0.1) : 0.85; }
  for (const b of Object.values(B)) { b.dim = !!FOCUS && !b.c.etfs.some(k => FOCUS.has(k)); lightStore(b); }
  for (const b of BF) { b.dim = !!FOCUS; lightStore(b); }
  drawMinimap(true);
}

/* ---------------- 時間與天氣 ---------------- */
const SKYC = { night: ['#08101e', '#1a2a46'], dusk: ['#36477a', '#f1a066'], day: ['#5ea6e2', '#d4e9f6'], storm: ['#4a5361', '#8f99a4'] };
function mixHex(a, b, t) { return '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString(); }
function setDayTime(h, wet) {
  const day = clamp(1 - Math.abs(h - 12.5) / 7.4, 0, 1), dl = day * day * (3 - 2 * day);
  let top, bot;
  if (dl < 0.35) { top = mixHex(SKYC.night[0], SKYC.dusk[0], dl / 0.35); bot = mixHex(SKYC.night[1], SKYC.dusk[1], dl / 0.35); }
  else { top = mixHex(SKYC.dusk[0], SKYC.day[0], (dl - 0.35) / 0.65); bot = mixHex(SKYC.dusk[1], SKYC.day[1], (dl - 0.35) / 0.65); }
  if (wet) { top = mixHex(top, SKYC.storm[0], 0.4 * dl + 0.15); bot = mixHex(bot, SKYC.storm[1], 0.4 * dl + 0.15); }
  document.getElementById('sky').style.background = `linear-gradient(180deg, ${top} 0%, ${bot} 100%)`;
  scene.fog.color.set(bot); scene.fog.near = wet ? 45 : 70; scene.fog.far = wet ? 230 : 330;
  const az = (h - 6) / 12 * Math.PI; SUNDIR.set(Math.cos(az) * 0.8, Math.max(0.12, Math.sin(az)), 0.55).normalize();
  sun.color.set(mixHex('#ffffff', '#ffb070', 1 - clamp((dl - 0.15) / 0.5, 0, 1)));
  sun.intensity = (0.12 + 2.3 * dl) * (wet ? 0.55 : 1);
  hemi.intensity = 0.25 + 0.75 * dl; hemi.color.set(mixHex('#7d93c9', '#dfeeff', dl));
  NIGHT = 1 - dl;
  MAT.apt.emissiveIntensity = 0.03 + 1.2 * Math.pow(NIGHT, 1.4);
  MAT.lampHead.emissiveIntensity = NIGHT > 0.45 ? 2.4 : 0;
  for (const v of CARS) v.g.userData.hl.emissiveIntensity = NIGHT > 0.45 ? 2.5 : 0;
  renderer.toneMappingExposure = 1.0 + 0.18 * NIGHT;
  for (const b of Object.values(B)) lightStore(b); for (const b of BF) lightStore(b);
}
const SUNDIR = new THREE.Vector3(0.5, 0.8, 0.4);

/* ---------------- 廣場大螢幕 ---------------- */
function screenIdle(lines) {
  const g = SCREEN.cv.getContext('2d'), W = 1024, H = 576;
  const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#0e1a2c'); gr.addColorStop(1, '#13263f'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  g.fillStyle = '#ffd45c'; g.font = `900 92px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('ETF 都會', W / 2, 120);
  lines.forEach((l, i) => { g.font = `700 ${l.size || 48}px ${FONT}`; g.fillStyle = l.color || '#e8eef6'; g.fillText(l.text, W / 2, 250 + i * 78); });
  SCREEN.tex.needsUpdate = true;
}
function screenChart(title, S, upto, maxV, up, down, muted) {
  const g = SCREEN.cv.getContext('2d'), W = 1024, H = 576;
  g.fillStyle = '#0e1a2c'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#ffd45c'; g.font = `900 52px ${FONT}`; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(title, 40, 60);
  const x = i => 40 + i / (S.length - 1) * (W - 80), y = v => H - 50 - v / maxV * (H - 190);
  const line = (key, col, dash) => { g.setLineDash(dash); g.strokeStyle = col; g.lineWidth = 7; g.beginPath(); for (let i = 0; i <= upto; i++) i ? g.lineTo(x(i), y(S[i][key])) : g.moveTo(x(i), y(S[i][key])); g.stroke(); };
  if (upto >= 0) {
    const s = S[upto], c = s.val >= s.inv ? up : down;
    line('inv', muted, [16, 12]); line('val', c, []); g.setLineDash([]);
    g.fillStyle = c; g.beginPath(); g.arc(x(upto), y(s.val), 12, 0, Math.PI * 2); g.fill();
    g.font = `700 44px ${FONT}`; g.textAlign = 'right'; g.fillText(s.d.slice(0, 7).replace('-', '/'), W - 40, 60);
  }
  SCREEN.tex.needsUpdate = true;
}

/* ---------------- 鏡頭 ---------------- */
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3();
function camBlocked(x, y, z) {
  for (const b of COLL) if (x > b.x0 - 0.15 && x < b.x1 + 0.15 && z > b.z0 - 0.15 && z < b.z1 + 0.15) return true;
  if (y > 3.3) for (const b of COLLB) if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1) return true;
  return false;
}
function updateCamera(dt) {
  const look = [Math.sin(ME.yaw), Math.cos(ME.yaw)], right = [-Math.cos(ME.yaw), Math.sin(ME.yaw)];
  const eye = _a.set(ME.x, ME.y + 1.62, ME.z);
  // 眼睛視角
  const fpPos = eye.clone(), cp = Math.cos(ME.pitch), fpLook = _b.set(ME.x + look[0] * cp * 10, ME.y + 1.62 + Math.sin(ME.pitch) * 10, ME.z + look[1] * cp * 10).clone();
  // 背後視角：鏡頭在角色後上方、偏右肩，撞到牆會拉近
  const elev = clamp(0.24 - ME.pitch * 0.9, -0.25, 1.05), d = ME.dist;
  const T = new THREE.Vector3(ME.x + right[0] * 0.5, ME.y + 1.55, ME.z + right[1] * 0.5);
  const want = new THREE.Vector3(T.x - look[0] * Math.cos(elev) * d, T.y + Math.sin(elev) * d + 0.25, T.z - look[1] * Math.cos(elev) * d);
  let f = 1; for (let s = 0.08; s <= 1.0001; s += 0.06) { const px = lerp(T.x, want.x, s), py = lerp(T.y, want.y, s), pz = lerp(T.z, want.z, s); if (camBlocked(px, py, pz)) { f = Math.max(0.12, s - 0.1); break; } }
  const tpPos = T.clone().lerp(want, f); tpPos.y = Math.max(0.4, tpPos.y);
  const tpLook = new THREE.Vector3(T.x + look[0] * 3, T.y + 0.15 + Math.sin(ME.pitch) * 3, T.z + look[1] * 3);
  const goal = ME.view === 'tp' ? 1 : 0; ME.blend += (goal - ME.blend) * Math.min(1, dt * 7);
  if (Math.abs(ME.blend - goal) < 0.002) ME.blend = goal;
  camera.position.copy(fpPos).lerp(tpPos, ME.blend);
  camera.lookAt(fpLook.lerp(tpLook, ME.blend));
  AV.g.visible = ME.blend > 0.35;
}
function layoutView() {
  const W = innerWidth, H = innerHeight, chat = document.getElementById('chat');
  const mini = chat && chat.classList.contains('mini');
  camera.aspect = W / H;
  camera.setViewOffset(W, H, isDesk() ? 196 : 0, isDesk() ? 0 : Math.round(H * (mini ? 0.05 : 0.2)), W, H);
  camera.updateProjectionMatrix(); renderer.setSize(W, H);
}

/* ---------------- 操作：鍵盤、滑鼠拖曳轉頭、點擊走路、手機搖桿 ---------------- */
const typing = e => { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); };
addEventListener('keydown', e => {
  if (typing(e) || document.querySelector('dialog[open]')) return;
  const k = e.key.toLowerCase();
  if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift', ' '].includes(k)) { keys.add(k); if (k === ' ' || k.startsWith('arrow')) e.preventDefault(); }
  if (k === ' ' && ME.y <= 0.001) ME.vy = 4.6;
  if (k === 'v') setView(ME.view === 'tp' ? 'fp' : 'tp');
  if (k === 'm') toggleMap();
  if ((k === 'e' || k === 'enter') && NEAR) openCard(NEAR);
});
addEventListener('keyup', e => keys.delete(e.key.toLowerCase()));
addEventListener('blur', () => keys.clear());
const PTR = new Map(); let dragMoved = 0;
const cvs = renderer.domElement;
cvs.addEventListener('pointerdown', e => { cvs.setPointerCapture(e.pointerId); PTR.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now() }); dragMoved = 0; });
cvs.addEventListener('pointermove', e => {
  const p = PTR.get(e.pointerId);
  if (!p) { hoverPick(e); return; }
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY; dragMoved += Math.abs(dx) + Math.abs(dy);
  if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) > 6) {
    const k = e.pointerType === 'touch' ? 0.007 : 0.0052;
    ME.yaw -= dx * k; ME.pitch = clamp(ME.pitch - dy * k, -1.1, 1.0); ME.lastDrag = performance.now() / 1000;
  }
});
cvs.addEventListener('pointerup', e => {
  const p = PTR.get(e.pointerId); PTR.delete(e.pointerId); if (!p) return;
  if (Math.hypot(e.clientX - p.x0, e.clientY - p.y0) < 7 && performance.now() - p.t < 450) clickAt(e.clientX, e.clientY);
});
cvs.addEventListener('pointercancel', e => PTR.delete(e.pointerId));
cvs.addEventListener('wheel', e => { e.preventDefault(); ME.dist = clamp(ME.dist + e.deltaY * 0.006, 2.4, 11); }, { passive: false });
const ray = new THREE.Raycaster(), ptrV = new THREE.Vector2(), GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
function rayAt(x, y) { ptrV.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ptrV, camera); }
function clickAt(x, y) {
  rayAt(x, y);
  const stops = Object.values(STOPS).map(s => s.sign);
  const hit = ray.intersectObjects([...PICK, ...stops], false)[0];
  if (hit && hit.object.userData.store) { walkToStore(hit.object.userData.store, { card: true, fast: false }); return; }
  if (hit && hit.object.userData.etf) { const k = hit.object.userData.etf; if (typeof ask === 'function') ask(`${k} 前十大是哪些？`); return; }
  const p = new THREE.Vector3(); if (!ray.ray.intersectPlane(GROUND, p)) return;
  if (hit && hit.distance < camera.position.distanceTo(p) - 0.5) return;
  if (walkable(p.x, p.z) && !hitColl(p.x, p.z)) walkToPoint(p.x, p.z, { label: '' });
}
let hoverT = 0;
function hoverPick(e) {
  if (TOUCH || performance.now() - hoverT < 80) return; hoverT = performance.now();
  rayAt(e.clientX, e.clientY); const hit = ray.intersectObjects(PICK, false)[0];
  cvs.style.cursor = hit && hit.object.userData.store ? 'pointer' : 'default';
}
// 手機搖桿
{
  const joy = document.getElementById('joy'), knob = joy && joy.querySelector('i');
  if (joy) {
    let id = null, cx = 0, cy = 0;
    const set = (x, y) => { const R = 44, dx = x - cx, dy = y - cy, l = Math.hypot(dx, dy), k = l > R ? R / l : 1; JOY.x = dx * k / R; JOY.y = dy * k / R; knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`; };
    joy.addEventListener('pointerdown', e => { id = e.pointerId; joy.setPointerCapture(id); const r = joy.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; JOY.on = true; set(e.clientX, e.clientY); e.preventDefault(); });
    joy.addEventListener('pointermove', e => { if (e.pointerId === id) set(e.clientX, e.clientY); });
    const end = e => { if (e.pointerId !== id) return; id = null; JOY.on = false; JOY.x = JOY.y = 0; knob.style.transform = ''; };
    joy.addEventListener('pointerup', end); joy.addEventListener('pointercancel', end);
  }
}
function setView(v) {
  ME.view = v; const b = document.getElementById('viewBtn');
  if (b) { b.textContent = v === 'tp' ? '眼睛視角' : '背後視角'; b.setAttribute('aria-label', `切換到${b.textContent} (V)`); }
}

/* ---------------- 附近的店：提示、店家卡片 ---------------- */
let NEAR = null, CARD = null;
function nearestStore() {
  let best = null, bd = 1e9;
  for (const b of Object.values(B)) {
    const c = b.c, dx = ME.x - c.front[0], dz = ME.z - c.front[1], lx = dx * c.fz - dz * c.fx, lz = dx * c.fx + dz * c.fz;
    if (Math.abs(lx) < c.w / 2 + 0.3 && lz > -L.arc - 0.2 && lz < 4.8) { const d = Math.abs(lx) / c.w + Math.abs(lz - 1) * 0.05; if (d < bd) { bd = d; best = c.name; } }
  }
  return best;
}
function showNear(name) {
  if (name === NEAR) return; NEAR = name; const el = document.getElementById('near'); if (!el) return;
  if (!name || CARD === name) { el.hidden = true; return; }
  const c = CO[name], v = chg[name] ?? 0;
  el.innerHTML = `<b>${c.name}</b> <span class="${v > 0 ? 'up' : v < 0 ? 'down' : ''}">${fmtPct(v)}</span><span class="k">${TOUCH ? '點這裡看店家' : '按 E 看店家'}</span>`;
  el.hidden = false;
}
const STATE_LOOK = { boom: '大漲，門口掛起彩帶、燈全亮', up: '小漲，店裡燈比平常亮', flat: '變動不大，照常營業', down: '下跌，店裡燈暗了一些', crash: '大跌，鐵捲門拉下一半' };
function openCard(name) {
  const c = CO[name], el = document.getElementById('card'); if (!c || !el) return;
  CARD = name; showNear(null); NEAR = null;
  const v = chg[name] ?? 0, st = stateOf(v), demo = scenarioNow === 'real' ? '' : ' (示意行情)';
  const etfs = c.etfs.map(k => ({ k, w: ETFS[k].w[name], rank: Object.entries(ETFS[k].w).sort((a, b) => b[1] - a[1]).findIndex(([n]) => n === name) + 1 }));
  el.innerHTML = `<div class="card-h"><div><b>${c.name}</b> <span class="note">${c.code}｜${c.ind}｜${DIST[c.d].name}</span></div><button type="button" class="icon-btn" id="cardX" aria-label="關閉">關閉</button></div>
    <div class="card-row"><span class="big ${v > 0 ? 'up' : v < 0 ? 'down' : ''}">${fmtPct(v)}</span><span class="note">今天的漲跌${demo}<br>${STATE_LOOK[st]} (只代表今天)</span></div>
    ${c.share != null ? `<div class="note">市值占大盤 <b>${c.share.toFixed(2)}%</b>，上市公司第 ${c.rank} 大 (${TIER[c.tier].name})</div>` : ''}
    <div class="stk">${etfs.length ? etfs.map(x => `<span style="--c:${ETFS[x.k].color}">${x.k} <b>${x.w.toFixed(2)}%</b> 第 ${x.rank} 大</span>`).join('') : '<span class="none">不在城市裡這幾檔 ETF 的前十大，櫥窗沒有貼紙</span>'}</div>
    <div class="card-a"><button type="button" class="primary" id="cardAsk">問店長</button>${etfs.length ? '<button type="button" class="icon-btn" id="cardEtf">哪些 ETF 持有？</button>' : ''}</div>
    <div class="note src">資料：${scenarioNow === 'real' ? `證交所每日行情 (${CITY.daily.date})` : '示意行情'}；前十大成分股${CITY.holdings_meta && CITY.holdings_meta.as_of ? ' (' + CITY.holdings_meta.as_of + ')' : ''}${c.share != null ? '；市值排行 (' + (MCAP.provided || '') + ' 提供)' : ''}</div>`;
  el.hidden = false;
  el.querySelector('#cardX').onclick = closeCard;
  el.querySelector('#cardAsk').onclick = () => { closeCard(); ask(`${name}今天怎麼了？`); };
  const ce = el.querySelector('#cardEtf'); if (ce) ce.onclick = () => { closeCard(); ask(`哪些 ETF 持有${name}？`); };
}
function closeCard() { CARD = null; const el = document.getElementById('card'); if (el) el.hidden = true; }

/* ---------------- 自動走路提示 ---------------- */
function showWalkChip(label) {
  const el = document.getElementById('walkChip'); if (!el) return;
  if (label == null || !ME.auto) { el.hidden = true; return; }
  el.querySelector('span').textContent = label ? `走向 ${label}…` : '走過去…'; el.hidden = false;
}

/* ---------------- 導覽圖 (小地圖與全圖) ---------------- */
const MAPCOL = v => { const t = clamp(Math.abs(v) / 6, 0.15, 1); return v >= 0.3 ? mixHex('#f4d6d6', '#d13a3a', t) : v <= -0.3 ? mixHex('#d3eedd', '#0f8a55', t) : '#e9e2c9'; };
let MAPSEL = new Set(), mapHover = null;
function mapTf(W, H, pad = 8) { const E = RR + 26, s = (Math.min(W, H) - pad * 2) / (2 * E); return { s, ox: W / 2, oy: H / 2, f: (x, z) => [W / 2 + x * s, H / 2 + z * s] }; }
function drawMap(cv, full) {
  const g = cv.getContext('2d'), W = cv.width, H = cv.height, T = mapTf(W, H, full ? 18 : 6), f = T.f, dk = matchMedia('(prefers-color-scheme: dark)').matches;
  g.clearRect(0, 0, W, H); g.fillStyle = dk ? '#1b2430' : '#eef1f4'; g.fillRect(0, 0, W, H);
  { const E = RR + 60, o = RR + SEA_O, r = [[-E, o, E, E], [o, -E, E, E], [-E, -E, E, -o], [-E, -E, -o, E]][SEA_SIDE], [x0, y0] = f(r[0], r[1]), [x1, y1] = f(r[2], r[3]); g.fillStyle = dk ? '#1d3a55' : '#bcd8ec'; g.fillRect(x0, y0, x1 - x0, y1 - y0); }
  g.strokeStyle = dk ? '#4a5563' : '#9aa3ad'; g.lineWidth = 2 * L.road * T.s; const [a0, a1] = f(-RR, -RR); g.strokeRect(a0, a1, 2 * RR * T.s, 2 * RR * T.s);
  g.fillStyle = dk ? '#3d4a5a' : '#d8cfbd'; { const [x0, y0] = f(PL.x0, PL.z0), [x1, y1] = f(PL.x1, PL.z1); g.fillRect(x0, y0, x1 - x0, y1 - y0); }
  const poly = (pts, fill, stroke, lw) => { g.beginPath(); pts.forEach((p, i) => { const [x, y] = f(p[0], p[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.closePath(); if (fill) { g.fillStyle = fill; g.fill(); } if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw; g.stroke(); } };
  for (const c of FILLERS) poly(c.poly, dk ? '#2a3442' : '#d5d8dc');
  for (const b of Object.values(B)) {
    const c = b.c, v = chg[c.name] ?? 0, sel = MAPSEL.has(c.name), dim = FOCUS && !c.etfs.some(k => FOCUS.has(k));
    poly(c.poly, dim ? (dk ? '#2b333d' : '#e4e6e8') : MAPCOL(v), sel ? (dk ? '#ffffff' : '#111') : (dk ? '#0f151e' : '#ffffff'), sel ? 2.4 : 0.6);
  }
  if (FOCUS) for (const k of FOCUS) { const Ln = LINES[k]; if (!Ln) continue; g.strokeStyle = ETFS[k].color; g.lineWidth = full ? 3 : 2; g.beginPath(); Ln.path.forEach((p, i) => { const [x, y] = f(p[0], p[1]); i ? g.lineTo(x, y) : g.moveTo(x, y); }); g.stroke(); }
  if (full) {
    g.font = `700 13px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const d of LAY.dists) { const q = ringPt((d.s0 + d.s1) / 2), [x, y] = f(q.x, q.z); g.fillStyle = dk ? '#cfd8e3' : '#33404f'; g.fillText(DIST[d.k].name, x, y); }
    const names = new Set([...MAPSEL, ...(mapHover ? [mapHover] : [])]);
    g.font = `700 12px ${FONT}`;
    for (const n of names) { const c = CO[n]; if (!c || !c.front) continue; const [x, y] = f(c.pos[0], c.pos[1]); const t = `${n} ${fmtPct(chg[n] ?? 0)}`, tw = g.measureText(t).width + 10; g.fillStyle = 'rgba(16,22,32,.85)'; g.fillRect(x - tw / 2, y - 22, tw, 18); g.fillStyle = '#fff'; g.fillText(t, x, y - 13); }
    { const [x, y] = f(0, (PL.z0 + PL.z1) / 2); g.fillStyle = dk ? '#fff' : '#1f4e8c'; g.font = `900 13px ${FONT}`; g.fillText('ETF 廣場', x, y); }
  }
  // 你的位置
  const [px, py] = f(ME.x, ME.z), a = Math.atan2(Math.sin(ME.face), Math.cos(ME.face));
  g.save(); g.translate(px, py); g.rotate(-a); g.fillStyle = '#1f6fd6'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath(); const r = full ? 9 : 7; g.moveTo(0, r * 1.3); g.lineTo(r * 0.8, -r * 0.8); g.lineTo(0, -r * 0.3); g.lineTo(-r * 0.8, -r * 0.8); g.closePath(); g.fill(); g.stroke(); g.restore();
}
let miniT = 0;
function drawMinimap(force) { const cv = document.getElementById('miniCv'); if (!cv || (!force && performance.now() - miniT < 120)) return; miniT = performance.now(); drawMap(cv, false); const big = document.getElementById('mapDlg'); if (big && !big.hidden) drawMap(document.getElementById('mapCv'), true); }
function storeAtMap(cv, ex, ey) {
  const r = cv.getBoundingClientRect(), x = (ex - r.left) * cv.width / r.width, y = (ey - r.top) * cv.height / r.height, T = mapTf(cv.width, cv.height, 18);
  const wx = (x - T.ox) / T.s, wz = (y - T.oy) / T.s;
  for (const b of Object.values(B)) { const xs = b.c.poly.map(p => p[0]), zs = b.c.poly.map(p => p[1]); if (wx >= Math.min(...xs) && wx <= Math.max(...xs) && wz >= Math.min(...zs) && wz <= Math.max(...zs)) return b.c.name; }
  return null;
}
function toggleMap(open) {
  const el = document.getElementById('mapDlg'); if (!el) return;
  const show = open ?? el.hidden; el.hidden = !show;
  if (show) { const cv = document.getElementById('mapCv'), r = cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2); cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr); drawMap(cv, true); renderMapEtfs(); }
}
function renderMapEtfs() {
  const box = document.getElementById('mapEtfs'); if (!box) return;
  box.innerHTML = ETF_KEYS.map(k => `<button type="button" class="chipq etfc" aria-pressed="${!!(FOCUS && FOCUS.has(k))}" style="--c:${ETFS[k].color}" data-k="${k}">${k}</button>`).join('');
  box.querySelectorAll('button').forEach(bt => bt.onclick = () => { const s = new Set(FOCUS || []); s.has(bt.dataset.k) ? s.delete(bt.dataset.k) : s.add(bt.dataset.k); focusEtfs(s); const both = [...Object.values(B)].filter(b => s.size >= 2 && [...s].every(k => b.c.etfs.includes(k))).map(b => b.c.name); MAPSEL = new Set(both); renderMapEtfs(); drawMinimap(true); });
}
{
  const mini = document.getElementById('miniCv'); if (mini) mini.addEventListener('click', () => toggleMap(true));
  const cv = document.getElementById('mapCv');
  if (cv) {
    cv.addEventListener('pointermove', e => { const n = storeAtMap(cv, e.clientX, e.clientY); if (n !== mapHover) { mapHover = n; cv.style.cursor = n ? 'pointer' : 'default'; drawMap(cv, true); } });
    cv.addEventListener('click', e => { const n = storeAtMap(cv, e.clientX, e.clientY); if (n) { toggleMap(false); teleportStore(n, true); } });
  }
}

/* ---------------- 每一格畫面的更新 ---------------- */
const _fw = new THREE.Vector3();
function worldUpdate(dt, T) {
  // 移動
  let fi = 0, si = 0;
  if (keys.has('w') || keys.has('arrowup')) fi += 1; if (keys.has('s') || keys.has('arrowdown')) fi -= 1;
  if (keys.has('d') || keys.has('arrowright')) si += 1; if (keys.has('a') || keys.has('arrowleft')) si -= 1;
  if (JOY.on) { fi += -JOY.y; si += JOY.x; }
  const inputLen = Math.hypot(fi, si);
  if (inputLen > 0.05 && ME.auto) cancelAuto();
  const look = [Math.sin(ME.yaw), Math.cos(ME.yaw)], right = [-Math.cos(ME.yaw), Math.sin(ME.yaw)];
  let vx = 0, vz = 0, spd = 0;
  if (ME.auto) {
    const A = ME.auto, [tx, tz] = A.pts[A.i], dx = tx - ME.x, dz = tz - ME.z, dist = Math.hypot(dx, dz);
    if (dist < Math.max(0.6, A.v * dt * 1.2)) { A.i++; if (A.i >= A.pts.length) finishAuto(false); }
    else { vx = dx / dist; vz = dz / dist; spd = A.v; }
    if (ME.auto) { A.stuck += dt; if (A.stuck > 0.6) { if (Math.hypot(ME.x - A.last[0], ME.z - A.last[1]) < 0.3) finishAuto(true); else { A.stuck = 0; A.last = [ME.x, ME.z]; } } }
  } else if (inputLen > 0.05) {
    const n = Math.min(1, inputLen); vx = (look[0] * fi + right[0] * si) / inputLen; vz = (look[1] * fi + right[1] * si) / inputLen;
    spd = (keys.has('shift') || (JOY.on && inputLen > 0.92) ? 9 : 4.4) * n;
  }
  if (spd > 0) {
    moveBy(vx * spd * dt, vz * spd * dt);
    const fa = Math.atan2(vx, vz); let df = fa - ME.face; df = Math.atan2(Math.sin(df), Math.cos(df)); ME.face += df * Math.min(1, dt * 12);
    // 背後視角：一陣子沒拖曳時，鏡頭慢慢轉到角色背後
    if (ME.view === 'tp' && T - ME.lastDrag > 1.5 && (ME.auto || fi > 0.1)) { let dy = ME.face - ME.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); ME.yaw += dy * Math.min(1, dt * (ME.auto ? 4 : 1.6)); }
  }
  if (ME.view === 'fp' && !ME.auto) ME.face = ME.yaw;
  ME.speed += (spd - ME.speed) * Math.min(1, dt * 10);
  ME.vy -= 13 * dt; ME.y = Math.max(0, ME.y + ME.vy * dt); if (ME.y === 0) ME.vy = Math.max(0, ME.vy);
  // 角色動畫
  ME.phase += dt * (2 + ME.speed * 1.5);
  const sw = Math.min(1, ME.speed / 4) * (ME.speed > 6 ? 0.9 : 0.6), sn = Math.sin(ME.phase);
  AV.legs[0].rotation.x = sn * sw; AV.legs[1].rotation.x = -sn * sw; AV.arms[0].rotation.x = -sn * sw * 0.9; AV.arms[1].rotation.x = sn * sw * 0.9;
  AV.g.position.set(ME.x, ME.y + Math.abs(Math.cos(ME.phase)) * 0.05 * Math.min(1, ME.speed / 3), ME.z); AV.g.rotation.y = ME.face;
  updateCamera(dt);
  // 影子跟著角色
  sun.position.set(ME.x + SUNDIR.x * 120, SUNDIR.y * 120, ME.z + SUNDIR.z * 120); sun.target.position.set(ME.x, 0, ME.z);
  // 附近的店
  showNear(ME.auto ? null : nearestStore());
  if (CARD) { const c = CO[CARD]; if (Math.hypot(ME.x - c.door[0], ME.z - c.door[1]) > 16) closeCard(); }
  if (reduceMotion) { lodT -= dt; if (lodT <= 0) { lodT = 0.25; for (const b of ALLB) b.det.visible = Math.hypot(b.c.front[0] - camera.position.x, b.c.front[1] - camera.position.z) < 95; } drawMinimap(); return; }
  // 導引線流動、跑馬燈
  TX.chev.offset.x -= dt * 0.9;
  for (const b of Object.values(B)) if (b.mq) b.mq.tex.offset.x += dt * 0.12;
  // 大跌的店招牌閃爍；大漲的店偶爾放煙火
  for (const b of Object.values(B)) {
    if (b.state === 'crash') { b.flick -= dt; if (b.flick <= 0) { b.flick = 0.05 + Math.random() * 0.6; b.fasM.emissiveIntensity = Math.random() < 0.3 ? 0.02 : (0.32 + 0.75 * NIGHT) * 0.7; } }
    else if (b.state === 'boom' && !replayingNow()) { b.nextBurst -= dt; if (b.nextBurst <= 0) { b.nextBurst = 1.4 + Math.random() * 2; const [x, z] = worldOf(b.c, 0, -2); if (Math.hypot(x - ME.x, z - ME.z) < 90) spawnBurst(x + (Math.random() - 0.5) * 3, b.H + 7 + Math.random() * 4, z); } }
  }
  // 光柱與標籤
  for (const b of Object.values(B)) {
    if (b.beacon) b.beacon.material.opacity = 0.22 + 0.12 * Math.sin(T * 3 + b.h0);
    if (b.label) { const d = camera.position.distanceTo(b.label.position), s = clamp(d * 0.12, 3.2, 22); b.label.scale.set(s, s * b.label.userData.aspect, 1); }
  }
  // 車流
  const me = ringS(ME.x, ME.z);
  for (const v of CARS) {
    let want = v.vmax;
    if (me.d < L.road + 1 && Math.abs(me.off - v.off) < 1.5) { const ahead = modP((me.s - v.s) * v.dir); if (ahead < 7 && ahead > 0) want = 0; }
    for (const o of CARS) if (o !== v && o.dir === v.dir && Math.abs(o.off - v.off) < 1.2) { const ahead = modP((o.s - v.s) * v.dir); if (ahead < 6.5) want = Math.min(want, ahead < 4.5 ? 0 : o.v); }
    v.v += (want - v.v) * Math.min(1, dt * (want < v.v ? 5 : 1.2)); v.s = modP(v.s + v.dir * v.v * dt);
    const p = ringPt(v.s, v.off), ahead = ringPt(v.s + v.dir * 2, v.off); v.g.position.set(p.x, 0, p.z); v.g.rotation.y = Math.atan2(ahead.x - p.x, ahead.z - p.z);
  }
  // 路人
  {
    const M4 = new THREE.Matrix4(), Q = new THREE.Quaternion(), E = new THREE.Euler(), V = new THREE.Vector3(), S = new THREE.Vector3(1, 1, 1);
    WALKERS.forEach((w, i) => {
      const p0 = ringPt(w.s, w.off); const near = Math.hypot(p0.x - ME.x, p0.z - ME.z) < 1.1;
      if (!near) w.s = modP(w.s + w.dir * w.v * dt);
      const p = ringPt(w.s, w.off), a = ringPt(w.s + w.dir, w.off); w.ph += dt * (near ? 0 : 7);
      Q.setFromEuler(E.set(0, Math.atan2(a.x - p.x, a.z - p.z), Math.sin(w.ph) * 0.04)); M4.compose(V.set(p.x, 0.04 + Math.abs(Math.sin(w.ph)) * 0.04, p.z), Q, S);
      WALK_MESH[0].setMatrixAt(i, M4); WALK_MESH[1].setMatrixAt(i, M4);
    });
    WALK_MESH[0].instanceMatrix.needsUpdate = true; WALK_MESH[1].instanceMatrix.needsUpdate = true;
  }
  // 雨
  if (rain.visible) {
    rain.position.set(camera.position.x, 0, camera.position.z);
    const a = rain.geometry.attributes.position.array;
    for (let i = 0; i < RAIN_N; i++) { const o = i * 6; let y = a[o + 1] - 32 * dt; if (y < 0) y += 34; a[o + 1] = y; a[o + 4] = y - 0.9; }
    rain.geometry.attributes.position.needsUpdate = true;
  }
  // 煙火
  for (let i = bursts.length - 1; i >= 0; i--) {
    const bu = bursts[i]; bu.life += dt; const a = bu.p.geometry.attributes.position.array;
    bu.vel.forEach((v, j) => { v.y -= 4.5 * dt; v.multiplyScalar(0.985); a[j * 3] += v.x * dt; a[j * 3 + 1] += v.y * dt; a[j * 3 + 2] += v.z * dt; });
    bu.p.geometry.attributes.position.needsUpdate = true; bu.p.material.opacity = Math.max(0, 1 - bu.life / 1.6);
    if (bu.life > 1.6) { scene.remove(bu.p); bu.p.geometry.dispose(); bu.p.material.dispose(); bursts.splice(i, 1); }
  }
  // 遠處的店只畫建築本體
  lodT -= dt; if (lodT <= 0) { lodT = 0.25; const cx = camera.position.x, cz = camera.position.z; for (const b of ALLB) { const v = Math.hypot(b.c.front[0] - cx, b.c.front[1] - cz) < 95; if (b.det.visible !== v) b.det.visible = v; } }
  drawMinimap();
}
let lodT = 0;
const ALLB = [...Object.values(B), ...BF];
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let replayingNow = () => false;
