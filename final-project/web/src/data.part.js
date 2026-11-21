/* ---------------- data (全部來自 city.json，不寫死在程式裡) ---------------- */
let CITY = __CITY__;
try {   // 放在網站上時，讀同目錄下較新的資料檔
  const ctl = new AbortController(); setTimeout(() => ctl.abort(), 1500);
  const r = await fetch('data/city.json', { cache: 'no-store', signal: ctl.signal });
  if (r.ok) { const j = await r.json(); if (j && j.etfs && j.holdings) CITY = j; }
} catch (e) {}
const ETF_KEYS = Object.keys(CITY.etfs);
const ETFS = {};
ETF_KEYS.forEach((k, i) => {
  const e = CITY.etfs[k], n = ETF_KEYS.length;
  ETFS[k] = { name: e.name, type: e.type, color: e.color, off: n > 1 ? -1.5 + 3 * i / (n - 1) : 0, w: Object.fromEntries(CITY.holdings[k].map(t => [t.name, t.weight])), info: e };
});
const DIST = {
  semi: { c: [-15.5, -12], s: [25, 20], ground: '#cfd6df' },
  tech: { c: [15, -12],   s: [24, 20], ground: '#d6d3cb' },
  fin:  { c: [-15.5, 14],  s: [25, 20], ground: '#ddd5c6' },
  port: { c: [15, 14],     s: [24, 20], ground: '#c9cfd2' },
  life: { c: [-46, 14],    s: [25, 20], ground: '#d3d8c9' },
};
for (const k of Object.keys(DIST)) DIST[k].name = CITY.districts[k] || k;
// 幾家公司有手調的外觀；沒列到的公司依產業自動決定
const STYLE = {
  台積電: { kind: 'fab', crane: true }, 聯發科: { tint: '#3b6f8f' }, 聯電: { tint: '#5a7f96' }, 聯詠: { tint: '#2f7c80' }, 瑞昱: { tint: '#46698f' }, 日月光投控: { tint: '#4f7a72' }, 世界: { tint: '#5b6f8c' },
  群聯: { tint: '#3f6a9a' }, 力成: { tint: '#55748a' },
  鴻海: { accent: '#c8302c' }, 台達電: { accent: '#2d6db5', crane: true }, 廣達: { accent: '#3a6ea8', crane: true }, 華碩: { accent: '#1c2a3a' }, 瑞儀: { accent: '#7a4fa3' },
  中華電: { kind: 'telecom', sign: '中華電信' }, 台灣大: { kind: 'telecom', sign: '台灣大哥大' }, 遠傳: { kind: 'telecom', sign: '遠傳電信' },
  富邦金: { stone: '#c9b99a' }, 國泰金: { stone: '#b9b2a3' }, 中信金: { stone: '#a9b3b8' }, 華南金: { stone: '#cdbfa6' }, 元大金: { stone: '#b7a58a' }, 上海商銀: { stone: '#c4b8a6' },
  長榮: { kind: 'ship', accent: '#2e7d4f', yard: ['#2e7d4f', '#3c9a62', '#c0392b', '#2c5aa0', '#d6a21e'] }, 陽明: { kind: 'ship', accent: '#d7a41c' }, 萬海: { kind: 'ship', accent: '#1f5fae' },
  長榮航: { kind: 'air', accent: '#2e7d4f', sign: '長榮航空' }, 華航: { kind: 'air', accent: '#b0355a', sign: '中華航空' },
};
const PAL = { tint: ['#3b6f8f', '#5a7f96', '#2f7c80', '#46698f', '#4f7a72', '#5b6f8c'], accent: ['#c8302c', '#2d6db5', '#3a6ea8', '#1c2a3a', '#2e7d4f', '#8a5a2b'], stone: ['#c9b99a', '#b9b2a3', '#a9b3b8', '#cdbfa6', '#b7a58a', '#c4b8a6'] };
const CO = {};
for (const [n, c] of Object.entries(CITY.companies)) {
  const st = STYLE[n] || {}, h = hashStr(n);
  const etfs = ETF_KEYS.filter(k => ETFS[k].w[n] != null); if (!etfs.length) continue;
  const maxW = Math.max(...etfs.map(k => ETFS[k].w[n]));
  const kind = st.kind || (c.district === 'fin' ? 'fin' : c.district === 'semi' ? 'glass' : c.industry === '通信網路業' ? 'telecom' : c.industry === '航運業' ? (/航$|航空/.test(n) ? 'air' : 'ship') : 'tech');
  CO[n] = { name: n, code: c.code, d: c.district, ind: c.industry, kind, etfs, maxW, H: 4 + 5.2 * Math.sqrt(maxW), sign: st.sign || n, crane: !!st.crane,
    tint: st.tint || PAL.tint[h % 6], accent: st.accent || PAL.accent[h % 6], stone: st.stone || PAL.stone[h % 6], yard: st.yard || ['#d7a41c', '#e3b93a', '#2c5aa0', '#b03a2e', '#5f6b75'] };
}
// 自動配置：每個行政區依公司數量排成格子；晶圓廠、貨櫃場、機場占地較大，另外處理
function layoutDistrict(dk) {
  const list = Object.values(CO).filter(c => c.d === dk).sort((a, b) => b.maxW - a.maxW); if (!list.length) return;
  const [W, D] = DIST[dk].s, put = (c, x, z, f) => { c.lot = [x, z]; c.fp = [f, f]; };
  let rest = list, slots = [];
  const fab = list.find(c => c.kind === 'fab');
  if (fab) {
    put(fab, -3.5, -3.5, 7); rest = list.filter(c => c !== fab);
    slots = [[5.4, -6.6, 4.4], [10.4, -6.6, 4.2], [5.4, 0, 4.2], [10.4, 0, 4], [5.4, 6.6, 4], [10.4, 6.6, 4], [-10.6, -7.2, 3.6], [-10.6, -1.6, 3.4]];
  } else if (dk === 'port') {
    const ships = list.filter(c => c.kind === 'ship'), airs = list.filter(c => c.kind === 'air');
    const zs = ships.length <= 2 ? [-5, 4.5] : [-6.6, 0, 6.6];
    ships.slice(0, 3).forEach((c, i) => put(c, -8, zs[i], 4.5));
    airs.slice(0, 1).forEach(c => put(c, 6, ships.length > 2 ? -4 : 0, 4));
    rest = list.filter(c => !c.lot); rest.forEach(c => { c.kind = 'tech'; });
    slots = [[8.5, -7, 3.6], [8.5, 7, 3.6], [3, -7.2, 3.4], [-1, 7.4, 3.4]];
  }
  if (!slots.length) {
    const n = rest.length, cols = n <= 4 ? 2 : n <= 9 ? 3 : 4, rows = Math.ceil(n / cols), cw = (W - 2) / cols, cd = (D - 2) / rows;
    for (let r = 0; r < rows; r++) for (let q = 0; q < cols; q++) slots.push([-(W - 2) / 2 + cw * (q + 0.5), -(D - 2) / 2 + cd * (r + 0.5) - 0.6, Math.min(cw - 2.6, cd - 4.2, 6)]);
  }
  rest.forEach((c, i) => { const s = slots[i % slots.length]; const f = Math.max(3.2, Math.min(s[2], 3.4 + 0.55 * Math.sqrt(c.maxW))); put(c, s[0], s[1], c.kind === 'telecom' ? Math.min(f, 4) : f); });
}
Object.keys(DIST).forEach(layoutDistrict);
for (const k of Object.keys(DIST)) if (!Object.values(CO).some(c => c.d === k) && k === 'life') delete DIST[k];
for (const c of Object.values(CO)) c.pos = [DIST[c.d].c[0] + c.lot[0], DIST[c.d].c[1] + c.lot[1]];
const REAL = !!(CITY.daily && !CITY.daily.demo && CITY.daily.stocks);
const inDist = (x, z) => Object.values(DIST).some(d => Math.abs(x - d.c[0]) < d.s[0] / 2 + 2 && Math.abs(z - d.c[1]) < d.s[1] / 2 + 2);

