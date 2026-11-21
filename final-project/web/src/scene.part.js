
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

try { await Promise.race([Promise.all([document.fonts.load('700 22px "Noto Sans TC"'), document.fonts.load('900 64px "Noto Serif TC"')]), new Promise(r => setTimeout(r, 2500))]); } catch (e) {}

__DATA_PART__
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

/* ---------------- scenario ---------------- */
const SCN = {
  mixed: { bias: { semi: -3.4, tech: -0.8, fin: 0.7, port: 4.6 }, sd: 0.9, fix: { 台積電: -4.15, 長榮: 7.82, 陽明: 6.35, 長榮航: 3.4, 華南金: 1.1 } },
  up:    { bias: { semi: 2.7, tech: 2.2, fin: 1.1, port: 1.7 }, sd: 1.0, fix: { 台積電: 3.6, 聯發科: 4.2 } },
  flat:  { bias: { semi: 0.1, tech: -0.1, fin: 0.15, port: 0 }, sd: 0.5, fix: { 台積電: 0.2 } },
  down:  { bias: { semi: -3.0, tech: -2.7, fin: -1.5, port: -2.3 }, sd: 0.9, fix: { 台積電: -3.9 } },
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
function indexEst() { // weighted by 0050 top-10 weights
  if (scenarioNow === 'real' && CITY.daily.index && CITY.daily.index.pct != null) return CITY.daily.index.pct;
  const w = (ETFS['0050'] || ETFS[ETF_KEYS[0]]).w; let a = 0, b = 0;
  for (const [n, x] of Object.entries(w)) { a += x * chg[n]; b += x; }
  return a / b;
}
const stateOf = c => c >= 3 ? 'boom' : c >= 0.3 ? 'up' : c > -0.3 ? 'flat' : c > -3 ? 'down' : 'crash';
const LIT = { boom: 0.95, up: 0.8, flat: 0.55, down: 0.3, crash: 0.12 };

/* ---------------- renderer / scene ---------------- */
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
stage.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x9fb4c8, 120, 340);
const VIEW = 78;
const aspect0 = innerWidth / innerHeight;
const camera = new THREE.OrthographicCamera(-VIEW * aspect0 / 2, VIEW * aspect0 / 2, VIEW / 2, -VIEW / 2, 1, 600);
camera.position.set(78, 66, 86);
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(-9, 13, -2);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.screenSpacePanning = false;
controls.minZoom = 0.7; controls.maxZoom = 5;
controls.minPolarAngle = 0.35; controls.maxPolarAngle = 1.25;
controls.zoomSpeed = 0.9;
camera.zoom = innerWidth < 760 ? 0.66 : 0.84;
camera.updateProjectionMatrix();
controls.update();

const hemi = new THREE.HemisphereLight(0xdfeeff, 0x4a4436, 0.8);
scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 2.4);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 300 });
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
scene.add(sun, sun.target);

/* ---------------- textures ---------------- */
function canvasTex(cv, srgb = true) {
  const t = new THREE.CanvasTexture(cv);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
// facade: returns {map, emi}
function facade(o) {
  const cols = Math.max(2, o.cols), rows = Math.max(2, o.rows);
  const cw = 18, rh = 22;
  const W = Math.min(512, cols * cw), H = Math.min(1024, rows * rh);
  const sx = W / cols, sy = H / rows;
  const a = document.createElement('canvas'); a.width = W; a.height = H;
  const e = document.createElement('canvas'); e.width = W; e.height = H;
  const g = a.getContext('2d'), ge = e.getContext('2d');
  const r = rng(o.seed || 7);
  ge.fillStyle = '#000'; ge.fillRect(0, 0, W, H);
  if (o.style === 'glass') {
    const grad = g.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, o.base); grad.addColorStop(1, shade(o.base, -0.25));
    g.fillStyle = grad; g.fillRect(0, 0, W, H);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      g.fillStyle = `rgba(255,255,255,${0.04 + r() * 0.09})`;
      g.fillRect(x * sx + 1, y * sy + 1, sx - 2, sy - 2);
      if (r() < o.lit) { ge.fillStyle = r() < 0.7 ? '#cfe6ff' : '#ffe2a8'; ge.globalAlpha = 0.55 + r() * 0.45; ge.fillRect(x * sx + 1.5, y * sy + 2, sx - 3, sy - 4); }
    }
    g.fillStyle = 'rgba(220,235,245,.55)';
    for (let x = 0; x <= cols; x++) g.fillRect(x * sx - 0.5, 0, 1.2, H);
    g.fillStyle = 'rgba(30,40,55,.45)';
    for (let y = 0; y <= rows; y++) g.fillRect(0, y * sy - 1, W, 2);
  } else if (o.style === 'stone') {
    g.fillStyle = o.base; g.fillRect(0, 0, W, H);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const wx = x * sx + sx * 0.28, wy = y * sy + sy * 0.18, ww = sx * 0.44, wh = sy * 0.64;
      g.fillStyle = '#26303a'; g.fillRect(wx, wy, ww, wh);
      g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(wx, wy, ww, 2);
      if (r() < o.lit) { ge.fillStyle = '#ffd590'; ge.globalAlpha = 0.6 + r() * 0.4; ge.fillRect(wx + 1, wy + 1, ww - 2, wh - 2); }
    }
    g.fillStyle = 'rgba(0,0,0,.12)';
    for (let x = 0; x <= cols; x++) g.fillRect(x * sx - 1, 0, 2, H);
  } else if (o.style === 'band') {
    g.fillStyle = o.base; g.fillRect(0, 0, W, H);
    for (let y = 0; y < rows; y++) {
      const by = y * sy + sy * 0.32, bh = sy * 0.48;
      g.fillStyle = '#2a3746'; g.fillRect(0, by, W, bh);
      g.fillStyle = 'rgba(160,200,230,.18)'; g.fillRect(0, by, W, bh * 0.4);
      for (let x = 0; x < cols; x++) {
        g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(x * sx, by, 1.5, bh);
        if (r() < o.lit) { ge.fillStyle = r() < 0.5 ? '#fff1cc' : '#d8ecff'; ge.globalAlpha = 0.55 + r() * 0.45; ge.fillRect(x * sx + 1.5, by + 1, sx - 2, bh - 2); }
      }
    }
    if (o.accent) { g.fillStyle = o.accent; g.fillRect(0, H - sy * 0.5, W, sy * 0.5); g.fillRect(0, 0, W, sy * 0.18); }
  } else if (o.style === 'fab') {
    g.fillStyle = '#eef1f4'; g.fillRect(0, 0, W, H);
    g.fillStyle = 'rgba(0,0,0,.08)'; for (let x = 0; x < W; x += 12) g.fillRect(x, 0, 1, H);
    g.fillStyle = '#1f5fbf'; g.fillRect(0, H * 0.18, W, H * 0.12);
    g.fillStyle = '#9fc2e8'; g.fillRect(0, H * 0.3, W, H * 0.04);
    for (let x = 0; x < cols; x++) {
      g.fillStyle = '#3a4a5a'; g.fillRect(x * sx + 3, H * 0.55, sx - 6, H * 0.12);
      if (r() < o.lit) { ge.fillStyle = '#e6f2ff'; ge.globalAlpha = 0.8; ge.fillRect(x * sx + 3, H * 0.55, sx - 6, H * 0.12); }
    }
  } else { // office
    g.fillStyle = o.base; g.fillRect(0, 0, W, H);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const wx = x * sx + 2, wy = y * sy + 4, ww = sx - 4, wh = sy - 8;
      g.fillStyle = '#3b4652'; g.fillRect(wx, wy, ww, wh);
      if (r() < o.lit) { ge.fillStyle = r() < 0.6 ? '#ffe0a0' : '#dbe9ff'; ge.globalAlpha = 0.5 + r() * 0.5; ge.fillRect(wx, wy, ww, wh); }
    }
  }
  ge.globalAlpha = 1;
  if (o.crack) drawCracks(g, ge, W, H, r);
  return { map: canvasTex(a), emi: canvasTex(e) };
}
function drawCracks(g, ge, W, H, r) {
  for (let k = 0; k < 4; k++) {
    let x = W * (0.15 + r() * 0.7), y = H * (0.25 + r() * 0.35);
    const pts = [[x, y]];
    for (let i = 0; i < 9; i++) { x += (r() - 0.5) * W * 0.18; y += H * (0.03 + r() * 0.05); pts.push([x, y]); }
    for (const [ctx, col, lw] of [[g, 'rgba(15,12,10,.85)', 3.2], [ge, '#000', 6]]) {
      ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineJoin = 'miter'; ctx.beginPath();
      pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.stroke();
      ctx.lineWidth = lw * 0.5; ctx.beginPath(); const m = pts[3];
      ctx.moveTo(m[0], m[1]); ctx.lineTo(m[0] + (r() - 0.5) * 40, m[1] + 30 + r() * 30); ctx.stroke();
    }
  }
  // blackout patch
  ge.fillStyle = 'rgba(0,0,0,.85)'; ge.fillRect(0, H * (0.3 + r() * 0.3), W, H * 0.22);
}
function shade(hex, amt) {
  const c = new THREE.Color(hex); const hsl = {}; c.getHSL(hsl);
  c.setHSL(hsl.h, hsl.s, clamp(hsl.l + amt, 0, 1)); return '#' + c.getHexString();
}
function textSprite(lines, opt = {}) {
  const cv = document.createElement('canvas'); const s = 2;
  const W = (opt.w || 240) * s, Hh = (opt.h || 70) * s; cv.width = W; cv.height = Hh;
  const t = canvasTex(cv);
  const mat = new THREE.SpriteMaterial({ map: t, depthTest: opt.depthTest ?? true, transparent: true });
  const sp = new THREE.Sprite(mat);
  sp.userData.draw = (ls) => {
    const g = cv.getContext('2d'); g.clearRect(0, 0, W, Hh);
    const lh = Hh / ls.length;
    const bw = Math.min(W, Math.max(...ls.map(l => { g.font = `${l.weight || 700} ${l.size * s}px ${FONT}`; return g.measureText(l.text).width; })) + 24 * s);
    g.fillStyle = opt.bg || 'rgba(14,20,30,.78)';
    roundRect(g, (W - bw) / 2, 2 * s, bw, Hh - 4 * s, 10 * s); g.fill();
    ls.forEach((l, i) => {
      g.font = `${l.weight || 700} ${l.size * s}px ${FONT}`; g.fillStyle = l.color || '#fff';
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(l.text, W / 2, lh * i + lh / 2 + 1 * s);
    });
    t.needsUpdate = true;
  };
  sp.userData.draw(lines);
  sp.scale.set((opt.w || 240) / 34, (opt.h || 70) / 34, 1);
  sp.renderOrder = 10;
  return sp;
}
function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

/* ---------------- materials ---------------- */
const M = {
  roof: new THREE.MeshStandardMaterial({ color: 0x8d949b, roughness: 0.9 }),
  roofDark: new THREE.MeshStandardMaterial({ color: 0x5d646c, roughness: 0.8 }),
  metal: new THREE.MeshStandardMaterial({ color: 0xb8c0c8, roughness: 0.35, metalness: 0.7 }),
  white: new THREE.MeshStandardMaterial({ color: 0xf2f4f6, roughness: 0.6 }),
  concrete: new THREE.MeshStandardMaterial({ color: 0xc7c3ba, roughness: 0.95 }),
  asphalt: new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.95 }),
  sidewalk: new THREE.MeshStandardMaterial({ color: 0xb9b7b0, roughness: 0.95 }),
  grass: new THREE.MeshStandardMaterial({ color: 0x7fa36b, roughness: 1 }),
  tree: new THREE.MeshStandardMaterial({ color: 0x4f8a4c, roughness: 0.9 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x6b5139, roughness: 0.9 }),
  yellow: new THREE.MeshStandardMaterial({ color: 0xf2b705, roughness: 0.6 }),
  scaffold: new THREE.MeshStandardMaterial({ color: 0xd9822b, roughness: 0.7 }),
  glassDark: new THREE.MeshStandardMaterial({ color: 0x223040, roughness: 0.2, metalness: 0.6 }),
  lampOff: new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0xffd48a, emissiveIntensity: 0 }),
};
const windowMats = []; // materials whose emissive follows time

/* ---------------- ground, roads, sea ---------------- */
const city = new THREE.Group(); scene.add(city);
function addBox(w, h, d, mat, x, y, z, parent = city, cast = true) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z); m.castShadow = cast; m.receiveShadow = true; parent.add(m); return m;
}
{
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(420, 420), new THREE.MeshStandardMaterial({ color: 0x9aa38f, roughness: 1 }));
  ground.rotation.x = -Math.PI / 2; ground.position.set(-180 + 29, -0.02, 0); ground.scale.set(1, 1, 1);
  ground.geometry.translate(0, 0, 0); ground.receiveShadow = true;
  // land only west of coast: shift so its east edge sits at x=29.5
  ground.position.x = 29.5 - 210; city.add(ground);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(260, 420), new THREE.MeshStandardMaterial({ color: 0x2f6f8f, roughness: 0.25, metalness: 0.3 }));
  sea.rotation.x = -Math.PI / 2; sea.position.set(29.5 + 130, -0.35, 0); sea.receiveShadow = true; city.add(sea);
  addBox(1.2, 1.1, 420, M.concrete, 29.9, -0.1, 0, city, false); // seawall
  // urban base slab (light concrete) for the whole metro area
  addBox(150, 0.04, 170, new THREE.MeshStandardMaterial({ color: 0xb4b1a8, roughness: 1 }), -45, 0.0, 0, city, false);
  // avenues
  const roadTex = (() => { const cv = document.createElement('canvas'); cv.width = 64; cv.height = 256; const g = cv.getContext('2d'); g.fillStyle = '#3a3f46'; g.fillRect(0, 0, 64, 256); g.fillStyle = '#e8e2c8'; for (let y = 0; y < 256; y += 64) g.fillRect(30, y, 4, 34); g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(3, 0, 2, 256); g.fillRect(59, 0, 2, 256); const t = canvasTex(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; })();
  const road = (len, w, x, z, rotY) => {
    const t = roadTex.clone(); t.needsUpdate = true; t.repeat.set(1, len / 8);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, len), new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
    m.rotation.x = -Math.PI / 2; m.rotation.z = rotY; m.position.set(x, 0.05, z); m.receiveShadow = true; city.add(m);
  };
  road(170, 4, 0, 0, 0);                 // N-S avenue
  road(150, 4, -45.5 + 20, 1, Math.PI / 2); // E-W avenue (x from -100 to 29)
  road(170, 3, -31, 0, 0);               // west ring
  road(150, 3, -45.5 + 20, -25, Math.PI / 2); // north ring
  road(150, 3, -45.5 + 20, 27, Math.PI / 2);  // south ring
  road(170, 2.6, 28.2, 0, 0);            // coast road
  // district plates
  for (const [k, d] of Object.entries(DIST)) {
    const p = addBox(d.s[0], 0.3, d.s[1], new THREE.MeshStandardMaterial({ color: d.ground, roughness: 0.95 }), d.c[0], 0.15, d.c[1], city, false);
    p.receiveShadow = true;
    // painted district name on the plate
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128; const g = cv.getContext('2d');
    g.font = `900 64px "Noto Serif TC", serif`; g.fillStyle = 'rgba(40,46,56,.42)'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(d.name, 256, 66);
    const lab = new THREE.Mesh(new THREE.PlaneGeometry(10, 2.5), new THREE.MeshBasicMaterial({ map: canvasTex(cv), transparent: true, depthWrite: false }));
    lab.rotation.x = -Math.PI / 2; lab.position.set(d.c[0] - d.s[0] / 2 + 5.6, 0.32, d.c[1] + d.s[1] / 2 - 1.6); city.add(lab);
  }
  // trees + lamps along avenues
  const treeGeo = mergeGeometries([new THREE.ConeGeometry(0.75, 1.9, 7).translate(0, 2.0, 0)]);
  const trunkGeo = new THREE.CylinderGeometry(0.1, 0.13, 1.1, 6).translate(0, 0.55, 0);
  const treePos = [], lampPos = [];
  for (let z = -60; z <= 60; z += 3.2) { if (Math.abs(z - 1) < 3.5) continue; treePos.push([-2.6, z], [2.6, z]); if (Math.round(z / 3.2) % 2 === 0) lampPos.push([-2.4, z + 1.6], [2.4, z + 1.6]); }
  for (let x = -80; x <= 26; x += 3.2) { if (Math.abs(x) < 3.5) continue; treePos.push([x, -1.6], [x, 3.6]); if (Math.round(x / 3.2) % 2 === 0) lampPos.push([x + 1.6, -1.4], [x + 1.6, 3.4]); }
  const tI = new THREE.InstancedMesh(treeGeo, M.tree, treePos.length), trI = new THREE.InstancedMesh(trunkGeo, M.trunk, treePos.length);
  const mtx = new THREE.Matrix4(), rT = rng(11);
  treePos.forEach(([x, z], i) => { const s = 0.8 + rT() * 0.45; mtx.makeScale(s, s, s).setPosition(x, 0.3, z); tI.setMatrixAt(i, mtx); trI.setMatrixAt(i, mtx); });
  tI.castShadow = true; city.add(tI, trI);
  const poleGeo = new THREE.CylinderGeometry(0.05, 0.06, 2.6, 5).translate(0, 1.3, 0);
  const bulbGeo = new THREE.SphereGeometry(0.16, 8, 6).translate(0, 2.65, 0);
  const pI = new THREE.InstancedMesh(poleGeo, M.roofDark, lampPos.length), bI = new THREE.InstancedMesh(bulbGeo, M.lampOff, lampPos.length);
  lampPos.forEach(([x, z], i) => { mtx.makeTranslation(x, 0.3, z); pI.setMatrixAt(i, mtx); bI.setMatrixAt(i, mtx); });
  city.add(pI, bI);
}

/* ---------------- filler buildings (outer city) ---------------- */
{
  const r = rng(99);
  const pal = ['#bcb7ad', '#a9adb3', '#c9c2b3', '#9ea7ae', '#b3a99a', '#d0ccc4', '#8f979f'];
  const mats = pal.map((c, i) => {
    const f = facade({ style: 'office', cols: 7, rows: 9, base: c, lit: 0.3, seed: 200 + i });
    const m = new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.emi, emissive: 0xffffff, emissiveIntensity: 0.1, roughness: 0.95 });
    m.userData.dim = 0.45; windowMats.push(m); return m;
  });
  const geo = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
  const buckets = mats.map(() => []);
  for (let x = -86; x <= 24; x += 5) for (let z = -80; z <= 80; z += 5) {
    const inCore = x > -34 && x < 29 && z > -28 && z < 30;
    const onAve = Math.abs(x) < 4.5 || Math.abs(z - 1) < 4.5 || Math.abs(x + 31) < 3 || Math.abs(z + 25) < 3 || Math.abs(z - 27) < 3;
    if (inCore || onAve || inDist(x, z) || r() < 0.12) continue;
    const dist = Math.hypot(x + 4, z) / 60;
    let h = (1.2 + r() * 4.2) * clamp(1.3 - dist * 0.5, 0.5, 1.3);
    if (z > 29) h = Math.min(h, 1.2 + r() * 1.2);
    const w = 2.6 + r() * 1.6, d = 2.6 + r() * 1.6;
    buckets[Math.floor(r() * mats.length)].push([x + (r() - 0.5), z + (r() - 0.5), w, h, d]);
  }
  const mtx = new THREE.Matrix4();
  buckets.forEach((list, i) => {
    const im = new THREE.InstancedMesh(geo, mats[i], list.length);
    list.forEach(([x, z, w, h, d], j) => { mtx.makeScale(w, h, d).setPosition(x, 0.05, z); im.setMatrixAt(j, mtx); });
    im.castShadow = true; im.receiveShadow = true; city.add(im);
  });
}

/* ---------------- company buildings ---------------- */
const B = {}; // per company runtime
const pickables = [];
function makeFacadeMats(spec, lit, crack) {
  const f = facade({ ...spec, lit, crack });
  const m = new THREE.MeshStandardMaterial({ map: f.map, emissiveMap: f.emi, emissive: 0xffffff, emissiveIntensity: 0.2,
    roughness: spec.style === 'glass' ? 0.22 : 0.85, metalness: spec.style === 'glass' ? 0.45 : 0.05 });
  windowMats.push(m); return m;
}
function segment(b, w, h, d, y, spec) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), [null, null, M.roof, M.roof, null, null]);
  mesh.position.set(0, y + h / 2, 0); mesh.castShadow = mesh.receiveShadow = true;
  b.group.add(mesh); b.segs.push({ mesh, spec: { ...spec, cols: Math.round(Math.max(w, d) / 0.9), rows: Math.round(h / (spec.floor || 1.05)) } });
  mesh.userData.company = b.c.name; pickables.push(mesh);
  return mesh;
}
function applyFacades(b, lit, crack) {
  for (const s of b.segs) {
    const mat = makeFacadeMats(s.spec, lit, crack);
    const old = s.mesh.material[0];
    if (old) { old.map.dispose(); old.emissiveMap.dispose(); old.dispose(); const i = windowMats.indexOf(old); if (i >= 0) windowMats.splice(i, 1); }
    s.mesh.material = [mat, mat, s.mesh.material[2], s.mesh.material[3], mat, mat];
  }
}
function roofClutter(b, w, d, y, seed) {
  const r = rng(seed), geos = [];
  for (let i = 0; i < 3; i++) geos.push(new THREE.BoxGeometry(0.6 + r() * 0.8, 0.4 + r() * 0.5, 0.6 + r() * 0.8).translate((r() - 0.5) * (w - 1.4), y + 0.3, (r() - 0.5) * (d - 1.4)));
  geos.push(new THREE.CylinderGeometry(0.35, 0.35, 0.7, 10).translate((r() - 0.5) * (w - 1.2), y + 0.35, (r() - 0.5) * (d - 1.2)));
  const m = new THREE.Mesh(mergeGeometries(geos), M.metal); m.castShadow = true; b.group.add(m);
}
function crownLight(b, w, d, y) {
  const mat = new THREE.MeshStandardMaterial({ color: 0x222222, emissive: 0xff3333, emissiveIntensity: 1.5 });
  const geo = mergeGeometries([
    new THREE.BoxGeometry(w + 0.08, 0.16, 0.16).translate(0, y, d / 2), new THREE.BoxGeometry(w + 0.08, 0.16, 0.16).translate(0, y, -d / 2),
    new THREE.BoxGeometry(0.16, 0.16, d + 0.08).translate(w / 2, y, 0), new THREE.BoxGeometry(0.16, 0.16, d + 0.08).translate(-w / 2, y, 0)]);
  const m = new THREE.Mesh(geo, mat); b.group.add(m); b.crown = mat;
}
function sign(b, text, w, y, d, color = '#ffffff', bg = 'rgba(20,28,40,.9)') {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, 256, 64); g.font = `700 40px ${FONT}`; g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 34);
  const mat = new THREE.MeshStandardMaterial({ map: canvasTex(cv), emissive: 0xffffff, emissiveMap: canvasTex(cv), emissiveIntensity: 0.4 });
  windowMats.push(mat);
  const sw = Math.min(w * 0.8, 3.6);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(sw, sw / 4), mat);
  m.position.set(0, y, d / 2 + 0.03); b.group.add(m);
  const m2 = m.clone(); m2.rotation.y = Math.PI / 2; m2.position.set(d / 2 + 0.03, y, 0); m2.scale.setScalar(Math.min(1, d / w)); b.group.add(m2);
}
function scaffold(b, w, d, h) {
  const geos = [], t = 0.07, step = 1.1;
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1], [0, 1], [0, -1], [1, 0], [-1, 0]]) geos.push(new THREE.BoxGeometry(t, h, t).translate(sx * (w / 2 + 0.35), h / 2, sz * (d / 2 + 0.35)));
  for (let y = step; y < h; y += step) {
    geos.push(new THREE.BoxGeometry(w + 0.7, t, t).translate(0, y, d / 2 + 0.35), new THREE.BoxGeometry(w + 0.7, t, t).translate(0, y, -d / 2 - 0.35));
    geos.push(new THREE.BoxGeometry(t, t, d + 0.7).translate(w / 2 + 0.35, y, 0), new THREE.BoxGeometry(t, t, d + 0.7).translate(-w / 2 - 0.35, y, 0));
    geos.push(new THREE.BoxGeometry(w + 0.7, 0.04, 0.5).translate(0, y - 0.02, d / 2 + 0.6));
  }
  const m = new THREE.Mesh(mergeGeometries(geos), M.scaffold); m.castShadow = true; return m;
}
function towerCrane(h) {
  const g = new THREE.Group(), geos = [];
  geos.push(new THREE.BoxGeometry(0.5, h, 0.5).translate(0, h / 2, 0));
  geos.push(new THREE.BoxGeometry(9, 0.35, 0.4).translate(2.5, h + 0.2, 0));
  geos.push(new THREE.BoxGeometry(1.2, 0.8, 1).translate(-1.8, h - 0.2, 0));
  geos.push(new THREE.ConeGeometry(0.4, 1.4, 4).translate(0, h + 1, 0));
  const m = new THREE.Mesh(mergeGeometries(geos), M.yellow); m.castShadow = true; g.add(m);
  const cab = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.6, 0.7), M.glassDark); cab.position.set(0.6, h - 0.4, 0); g.add(cab);
  const cable = new THREE.Mesh(new THREE.BoxGeometry(0.03, 3, 0.03), M.roofDark); cable.position.set(5.5, h - 1.3, 0); g.add(cable);
  const load = new THREE.Mesh(new THREE.BoxGeometry(1, 0.4, 0.6), M.scaffold); load.position.set(5.5, h - 2.9, 0); g.add(load);
  return g;
}

function buildCompany(c) {
  const b = { c, group: new THREE.Group(), segs: [], fx: new THREE.Group() };
  const [w, d] = c.fp, H = c.H;
  b.group.position.set(c.pos[0], 0.3, c.pos[1]);
  const seed = hashStr(c.name);
  if (c.kind === 'fab') {
    // HQ tower with setbacks + fab hall + exhaust stacks
    const spec = { style: 'glass', base: '#4a86b8', seed };
    segment(b, w, H * 0.62, d, 0, spec);
    segment(b, w * 0.8, H * 0.26, d * 0.8, H * 0.62, { ...spec, seed: seed + 1 });
    segment(b, w * 0.58, H * 0.12, d * 0.58, H * 0.88, { ...spec, seed: seed + 2 });
    crownLight(b, w * 0.58, d * 0.58, H + 0.05);
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.2, 5, 6), M.metal); sp.position.y = H + 2.5; b.group.add(sp);
    roofClutter(b, w * 0.58, d * 0.58, H, seed);
    const fab = new THREE.Group(); fab.position.set(-1.5, 0, 8.6); b.group.add(fab);
    const fs = { style: 'fab', seed: seed + 9, floor: 3.6 };
    const hall = new THREE.Mesh(new THREE.BoxGeometry(13, 3.6, 6.5), [null, null, M.white, M.white, null, null]);
    hall.position.y = 1.8; hall.castShadow = hall.receiveShadow = true; fab.add(hall); hall.userData.company = c.name; pickables.push(hall);
    b.segs.push({ mesh: hall, spec: { ...fs, cols: 12, rows: 1 } });
    const stacks = []; for (let i = 0; i < 5; i++) stacks.push(new THREE.CylinderGeometry(0.32, 0.38, 2.6, 12).translate(-5 + i * 2.5, 4.6, -1.6));
    for (let i = 0; i < 4; i++) stacks.push(new THREE.BoxGeometry(1.6, 0.7, 1.2).translate(-4 + i * 2.7, 3.95, 1.4));
    const st = new THREE.Mesh(mergeGeometries(stacks), M.metal); st.castShadow = true; fab.add(st);
    sign(b, c.sign, w, H * 0.62 - 1.2, d);
  } else if (c.kind === 'glass') {
    const spec = { style: 'glass', base: c.tint, seed };
    const r = rng(seed);
    const s1 = 0.7 + r() * 0.12;
    segment(b, w, H * s1, d, 0, spec);
    segment(b, w * 0.78, H * (1 - s1), d * 0.78, H * s1, { ...spec, seed: seed + 1 });
    // slanted glass cap
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.01, w * 0.55, 1.4, 4, 1), M.glassDark); cap.rotation.y = Math.PI / 4; cap.position.y = H + 0.7; cap.scale.set(1, 1, d / w); cap.castShadow = true; b.group.add(cap);
    crownLight(b, w * 0.78, d * 0.78, H + 0.04);
    sign(b, c.name, w, H * s1 - 0.9, d);
  } else if (c.kind === 'tech') {
    const spec = { style: 'band', base: '#e4e6e8', accent: c.accent, seed, floor: 1.2 };
    segment(b, w, H * 0.78, d, 0, spec);
    segment(b, w * 0.7, H * 0.22, d * 0.85, H * 0.78, { ...spec, seed: seed + 1 });
    crownLight(b, w * 0.7, d * 0.85, H + 0.04);
    roofClutter(b, w * 0.7, d * 0.85, H, seed);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, 3, 5), M.metal); ant.position.set(w * 0.2, H + 1.5, 0); b.group.add(ant);
    sign(b, c.name, w, H * 0.78 - 0.9, d, '#fff', c.accent);
  } else if (c.kind === 'fin') {
    const spec = { style: 'stone', base: c.stone, seed, floor: 1.15 };
    // podium with columns
    const pod = new THREE.Mesh(new THREE.BoxGeometry(w + 1.6, 1.6, d + 1.6), M.concrete); pod.position.y = 0.8; pod.castShadow = pod.receiveShadow = true; b.group.add(pod); pod.userData.company = c.name; pickables.push(pod);
    const cols = []; for (let i = 0; i < 6; i++) cols.push(new THREE.CylinderGeometry(0.16, 0.16, 1.5, 10).translate(-(w + 1.2) / 2 + i * (w + 1.2) / 5, 0.8, (d + 1.6) / 2 + 0.25));
    const cm = new THREE.Mesh(mergeGeometries(cols), M.white); cm.castShadow = true; b.group.add(cm);
    segment(b, w, H * 0.68, d, 1.6, spec);
    segment(b, w * 0.78, H * 0.2, d * 0.78, 1.6 + H * 0.68, { ...spec, seed: seed + 1 });
    const top = 1.6 + H * 0.88;
    const pyr = new THREE.Mesh(new THREE.ConeGeometry(w * 0.55, 2.4, 4), new THREE.MeshStandardMaterial({ color: 0x6f7c74, roughness: 0.4, metalness: 0.6 }));
    pyr.rotation.y = Math.PI / 4; pyr.position.y = top + 1.2; pyr.scale.set(1, 1, d / w); pyr.castShadow = true; b.group.add(pyr);
    crownLight(b, w * 0.78, d * 0.78, top + 0.04);
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.1, 2, 6), M.metal); sp.position.y = top + 3.2; b.group.add(sp);
    sign(b, c.name, w, 1.6 + H * 0.68 - 0.9, d, '#f4e7c8', 'rgba(40,34,26,.92)');
    b.topY = top + 4;
  } else if (c.kind === 'telecom') {
    const spec = { style: 'office', base: '#d9dde0', seed };
    segment(b, w, H * 0.75, d, 0, spec);
    crownLight(b, w, d, H * 0.75 + 0.04);
    const mast = [];
    mast.push(new THREE.CylinderGeometry(0.12, 0.45, H * 0.9, 4).translate(0, H * 0.75 + H * 0.45, 0));
    for (let i = 1; i < 6; i++) mast.push(new THREE.BoxGeometry(0.9 - i * 0.1, 0.06, 0.9 - i * 0.1).translate(0, H * 0.75 + i * H * 0.14, 0));
    const mm = new THREE.Mesh(mergeGeometries(mast), new THREE.MeshStandardMaterial({ color: 0xc9483b, roughness: 0.6 })); mm.castShadow = true; b.group.add(mm);
    for (let i = 0; i < 3; i++) { const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.2, 0.25, 14), M.white); dish.rotation.z = Math.PI / 2; dish.rotation.y = i * 2.1; dish.position.set(Math.cos(i * 2.1) * 0.4, H * 0.75 + H * 0.55, -Math.sin(i * 2.1) * 0.4); b.group.add(dish); }
    sign(b, c.sign, w, H * 0.75 - 0.9, d, '#fff', '#1f5fae');
    b.topY = H * 0.75 + H * 0.9 + 1.5;
  } else if (c.kind === 'ship') {
    const spec = { style: 'band', base: '#e9ecee', accent: c.accent, seed, floor: 1.2 };
    segment(b, w, H * 0.8, d, 0, spec);
    crownLight(b, w, d, H * 0.8 + 0.04);
    roofClutter(b, w, d, H * 0.8, seed);
    sign(b, c.name, w, H * 0.8 - 0.9, d, '#fff', c.accent);
    // container yard
    const yard = new THREE.Group(); yard.position.set(7.5, 0, 0); b.group.add(yard);
    const r = rng(seed + 5), cols = c.yard;
    const boxGeo = new THREE.BoxGeometry(1.9, 0.75, 0.8);
    const n = 6 * 4 * 3; const im = new THREE.InstancedMesh(boxGeo, new THREE.MeshStandardMaterial({ roughness: 0.7 }), n);
    let k = 0; const mtx = new THREE.Matrix4(), col = new THREE.Color();
    for (let i = 0; i < 6; i++) for (let j = 0; j < 4; j++) { const hgt = 1 + Math.floor(r() * 3); for (let l = 0; l < 3; l++) { if (l >= hgt) { mtx.makeScale(0, 0, 0); } else mtx.makeTranslation(-4 + i * 2.05, 0.38 + l * 0.76, -2 + j * 0.9 + (j > 1 ? 0.6 : 0)); im.setMatrixAt(k, mtx); im.setColorAt(k, col.set(cols[Math.floor(r() * cols.length)])); k++; } }
    im.castShadow = true; im.receiveShadow = true; yard.add(im);
    // gantry crane
    const gg = [new THREE.BoxGeometry(0.3, 6, 0.3).translate(-1, 3, -2.8), new THREE.BoxGeometry(0.3, 6, 0.3).translate(-1, 3, 2.8), new THREE.BoxGeometry(0.3, 6, 0.3).translate(1.2, 3, -2.8), new THREE.BoxGeometry(0.3, 6, 0.3).translate(1.2, 3, 2.8),
      new THREE.BoxGeometry(2.6, 0.5, 6.2).translate(0.1, 6.1, 0), new THREE.BoxGeometry(9, 0.35, 0.6).translate(4.5, 6.6, 0)];
    const gm = new THREE.Mesh(mergeGeometries(gg), new THREE.MeshStandardMaterial({ color: c.accent, roughness: 0.6 })); gm.position.set(4.6, 0, 0); gm.castShadow = true; yard.add(gm);
    b.topY = H * 0.8 + 2.2;
  } else if (c.kind === 'air') {
    const spec = { style: 'band', base: '#eef0f1', accent: c.accent, seed, floor: 1.2 };
    // control tower
    segment(b, 2.4, H * 0.75, 2.4, 0, { ...spec, cols: 3 });
    const cab = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.5, 1.6, 8), M.glassDark); cab.position.y = H * 0.75 + 0.8; cab.castShadow = true; b.group.add(cab);
    const capm = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.3, 8), M.white); capm.position.y = H * 0.75 + 1.75; b.group.add(capm);
    crownLight(b, 2.4, 2.4, H * 0.75 - 0.3);
    // hangar
    const hg = new THREE.Mesh(new THREE.CylinderGeometry(4, 4, 9, 20, 1, false, 0, Math.PI), M.metal); hg.rotation.z = Math.PI / 2; hg.rotation.y = Math.PI / 2; hg.position.set(0, 0, 7.2); hg.castShadow = true; b.group.add(hg);
    hg.userData.company = c.name; pickables.push(hg);
    // airplane
    const plane = new THREE.Group(); plane.position.set(-4.6, 1.1, 2.5); plane.rotation.y = 0.5;
    const pm = new THREE.MeshStandardMaterial({ color: 0xf4f6f7, roughness: 0.5 });
    const fus = new THREE.Mesh(new THREE.CapsuleGeometry(0.45, 5, 6, 12), pm); fus.rotation.z = Math.PI / 2; plane.add(fus);
    const wing = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 6), pm); plane.add(wing);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.3, 0.1), new THREE.MeshStandardMaterial({ color: c.accent })); tail.position.set(-2.5, 0.7, 0); plane.add(tail);
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.08, 2.2), pm); st.position.set(-2.6, 0.2, 0); plane.add(st);
    plane.traverse(o => { if (o.isMesh) o.castShadow = true; }); b.group.add(plane);
    sign(b, c.sign, 2.4, H * 0.75 - 0.9, 2.4, '#fff', c.accent);
    b.topY = H * 0.75 + 2.6;
  }
  b.topY = b.topY || H + 1.6;
  if (c.crane) { const cr = towerCrane(Math.max(b.topY - 1, 9)); cr.position.set(c.kind === 'fab' ? -w / 2 - 1.4 : w / 2 + 1, 0, -d / 2 - 0.8); cr.rotation.y = c.kind === 'fab' ? 0.9 : -0.6; b.group.add(cr); b.crane = cr; }
  b.label = textSprite([{ text: c.name, size: 22 }, { text: '', size: 20 }], { w: 170, h: 66 });
  b.label.userData.k = 1.45;
  b.label.position.set(0, b.topY + 2.2, 0); b.group.add(b.label);
  b.group.add(b.fx);
  city.add(b.group);
  B[c.name] = b;
}
Object.values(CO).forEach(buildCompany);

/* ---------------- metro: stations + lines ---------------- */
const metro = new THREE.Group(); city.add(metro);
const ST = {};
for (const c of Object.values(CO)) {
  const toward = new THREE.Vector2(0 - c.pos[0], 1 - c.pos[1]).normalize();
  const reach = Math.max(c.fp[0], c.fp[1]) / 2 + 1.5;
  const p = new THREE.Vector3(c.pos[0] + toward.x * reach, 0.42, c.pos[1] + toward.y * reach);
  if (c.kind === 'fab') p.set(c.pos[0] + 5.2, 0.42, c.pos[1] + 1.5);
  if (c.kind === 'ship') p.set(c.pos[0] + 2.3, 0.42, c.pos[1] + (c.lot[1] <= 0 ? 3.4 : -3.4));
  ST[c.name] = { p, lines: c.etfs.slice(), group: new THREE.Group() };
}
function buildStations(visible) {
  for (let i = pickables.length - 1; i >= 0; i--) if (pickables[i].userData.station) pickables.splice(i, 1);
  for (const [n, s] of Object.entries(ST)) {
    metro.remove(s.group); s.group = new THREE.Group(); s.group.position.copy(s.p);
    const ls = s.lines.filter(l => visible.has(l));
    if (!ls.length) continue;
    const transfer = ls.length > 1;
    const R = transfer ? 1.05 : 0.7;
    ls.forEach((l, i) => {
      const a0 = (i / ls.length) * Math.PI * 2, a1 = ((i + 1) / ls.length) * Math.PI * 2;
      const ring = new THREE.Mesh(new THREE.RingGeometry(R * 0.62, R, 32, 1, a0, a1 - a0), new THREE.MeshBasicMaterial({ color: ETFS[l].color, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.03; s.group.add(ring);
    });
    const disc = new THREE.Mesh(new THREE.CircleGeometry(R * 0.62, 24), new THREE.MeshBasicMaterial({ color: 0xffffff })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.035; s.group.add(disc);
    // entrance kiosk
    const k = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(transfer ? 1.1 : 0.8, 0.9, 0.7), M.glassDark); body.position.y = 0.45; k.add(body);
    ls.forEach((l, i) => { const band = new THREE.Mesh(new THREE.BoxGeometry((transfer ? 1.3 : 1) , 0.12, 0.9), new THREE.MeshStandardMaterial({ color: ETFS[l].color, emissive: ETFS[l].color, emissiveIntensity: 0.35 })); band.position.y = 0.96 + i * 0.13; k.add(band); });
    k.traverse(o => { if (o.isMesh) { o.castShadow = true; o.userData.station = n; pickables.push(o); } });
    s.group.add(k);
    // pin
    const pin = textSprite([{ text: transfer ? '轉乘' : 'M', size: 20 }], { w: transfer ? 64 : 44, h: 34, bg: transfer ? 'rgba(255,255,255,.95)' : ETFS[ls[0]].color });
    if (transfer) pin.userData.draw([{ text: '轉乘', size: 18, color: '#1b2533' }]);
    pin.position.y = 2.6; pin.scale.multiplyScalar(1.25); s.group.add(pin);
    metro.add(s.group);
  }
}
const LINES = {};
function orderStations(names) {
  const rest = names.slice(); rest.sort((a, b) => ST[a].p.x - ST[b].p.x);
  const out = [rest.shift()];
  while (rest.length) { const last = ST[out[out.length - 1]].p; let bi = 0, bd = 1e9; rest.forEach((n, i) => { const d = last.distanceTo(ST[n].p); if (d < bd) { bd = d; bi = i; } }); out.push(rest.splice(bi, 1)[0]); }
  return out;
}
for (const [k, e] of Object.entries(ETFS)) {
  const order = orderStations(Object.keys(e.w));
  const pts = order.map(n => ST[n].p.clone().setY(0.44));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal', 0.5);
  const N = 320, wdt = 0.8, pos = [], idx = [];
  const sample = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, p = curve.getPoint(t), tg = curve.getTangent(t);
    const nrm = new THREE.Vector3(-tg.z, 0, tg.x).normalize();
    const c = p.clone().addScaledVector(nrm, e.off);
    sample.push(c);
    pos.push(c.x + nrm.x * wdt / 2, 0.45 + Object.keys(ETFS).indexOf(k) * 0.004, c.z + nrm.z * wdt / 2, c.x - nrm.x * wdt / 2, 0.45 + Object.keys(ETFS).indexOf(k) * 0.004, c.z - nrm.z * wdt / 2);
    if (i < N) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
  const mat = new THREE.MeshBasicMaterial({ color: e.color, side: THREE.DoubleSide, transparent: true, opacity: 0.95 });
  const ribbon = new THREE.Mesh(g, mat); metro.add(ribbon);
  const ghostMat = new THREE.MeshBasicMaterial({ color: e.color, side: THREE.DoubleSide, transparent: true, opacity: 0.42, depthTest: false, depthWrite: false });
  const ghost = new THREE.Mesh(g, ghostMat); ghost.renderOrder = 5; metro.add(ghost); ribbon.userData.ghost = ghost;
  const pulses = [];
  for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true })); s.userData.t = i / 3; metro.add(s); pulses.push(s); }
  LINES[k] = { ribbon, mat, pulses, sample, order };
}

/* ---------------- ships, cars ---------------- */
{
  const ship = new THREE.Group(); ship.position.set(40, -0.2, 9); ship.rotation.y = -0.15;
  const hull = new THREE.Mesh(new THREE.BoxGeometry(18, 2.2, 4.4), new THREE.MeshStandardMaterial({ color: 0x23303d, roughness: 0.6 })); hull.position.y = 0.9; ship.add(hull);
  const red = new THREE.Mesh(new THREE.BoxGeometry(18.05, 0.5, 4.45), new THREE.MeshStandardMaterial({ color: 0xa8322b })); red.position.y = 0.05; ship.add(red);
  const r = rng(5), cols = ['#2e7d4f', '#3c9a62', '#c0392b', '#2c5aa0', '#d6a21e'];
  const im = new THREE.InstancedMesh(new THREE.BoxGeometry(1.9, 0.75, 0.9), new THREE.MeshStandardMaterial({ roughness: 0.7 }), 7 * 4 * 2);
  let k = 0; const mtx = new THREE.Matrix4(), col = new THREE.Color();
  for (let i = 0; i < 7; i++) for (let j = 0; j < 4; j++) for (let l = 0; l < 2; l++) { mtx.makeTranslation(-7.5 + i * 2.05, 2.4 + l * 0.76, -1.4 + j * 0.95); im.setMatrixAt(k, mtx); im.setColorAt(k++, col.set(cols[Math.floor(r() * 5)])); }
  ship.add(im);
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 4), M.white); bridge.position.set(7.6, 3.4, 0); ship.add(bridge);
  ship.traverse(o => { if (o.isMesh) o.castShadow = true; }); city.add(ship);
}
const cars = [];
{
  const r = rng(77), palette = [0xd9d9d9, 0x2c3e50, 0xc0392b, 0x1f6fd6, 0xf1c40f, 0x7f8c8d];
  for (let i = 0; i < 26; i++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.45, 0.6), new THREE.MeshStandardMaterial({ color: palette[i % palette.length], roughness: 0.4, metalness: 0.3 }));
    body.position.y = 0.3; const top = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.3, 0.55), M.glassDark); top.position.set(-0.05, 0.65, 0);
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.12, 0.5), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2c4, emissiveIntensity: 0 })); hl.position.set(0.62, 0.32, 0);
    g.add(body, top, hl); body.castShadow = true;
    const ns = i % 2 === 0; const dir = r() < 0.5 ? 1 : -1;
    g.userData = { ns, dir, t: r() * 140 - 70, speed: 4 + r() * 3, lane: dir * 0.9, hl: hl.material };
    if (ns) g.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2; else g.rotation.y = dir > 0 ? 0 : Math.PI;
    city.add(g); cars.push(g);
  }
}

/* ---------------- weather + fireworks ---------------- */
const RAIN_N = 1800;
const rainGeo = new THREE.BufferGeometry();
const rainPos = new Float32Array(RAIN_N * 6);
const rr = rng(3);
for (let i = 0; i < RAIN_N; i++) { const x = rr() * 90 - 55, y = rr() * 70, z = rr() * 80 - 38; rainPos.set([x, y, z, x - 0.15, y - 1.3, z - 0.1], i * 6); }
rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: 0xbfd3e6, transparent: true, opacity: 0.55 }));
rain.visible = false; scene.add(rain);
const bursts = [];
function spawnBurst(x, y, z) {
  const n = 70, pos = new Float32Array(n * 3), vel = [];
  const col = new THREE.Color().setHSL([0.0, 0.02, 0.08, 0.12, 0.95][Math.floor(Math.random() * 5)], 0.95, 0.62);
  for (let i = 0; i < n; i++) { pos.set([x, y, z], i * 3); const v = new THREE.Vector3().randomDirection().multiplyScalar(4 + Math.random() * 3); vel.push(v); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const p = new THREE.Points(g, new THREE.PointsMaterial({ color: col, size: 0.45, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(p); bursts.push({ p, vel, life: 0 });
}

