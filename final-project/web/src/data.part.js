/* ---------------- data (全部來自 city.json，不寫死在程式裡) ---------------- */
let CITY = __CITY__;
try {   // 放在網站上時，讀同目錄下較新的資料檔
  const ctl = new AbortController(); setTimeout(() => ctl.abort(), 1500);
  const r = await fetch('data/city.json', { cache: 'no-store', signal: ctl.signal });
  if (r.ok) { const j = await r.json(); if (j && j.etfs && j.holdings) CITY = j; }
} catch (e) {}
const ETF_KEYS = Object.keys(CITY.etfs);
const ETFS = {};
ETF_KEYS.forEach(k => { const e = CITY.etfs[k]; ETFS[k] = { name: e.name, type: e.type, color: e.color, w: Object.fromEntries(CITY.holdings[k].map(t => [t.name, t.weight])), info: e }; });
const DIST = {};
for (const [k, n] of Object.entries(CITY.districts)) DIST[k] = { name: n };
const REAL = !!(CITY.daily && !CITY.daily.demo && CITY.daily.stocks);
const MCAP = CITY.market_cap || {};

/* 店面大小依市值排行：第 1 名是旗艦店，2 到 10 名大店，11 到 40 名中店，其餘小店 (寬度單位：公尺) */
const TIER = { xl: { w: 26, fl: 11, name: '旗艦店' }, l: { w: 14, fl: 6, name: '大店' }, m: { w: 10, fl: 4, name: '中店' }, s: { w: 7.5, fl: 3, name: '小店' } };
// 同一條街裡，相近的產業排在一起
const SUB = {
  tech: ['電子零組件業', '電腦及週邊設備業', '通信網路業', '光電業', '電子通路業', '其他電子業', '資訊服務業', '數位雲端'],
  life: ['塑膠工業', '油電燃氣業', '鋼鐵工業', '水泥工業', '玻璃陶瓷', '電機機械', '電器電纜', '汽車工業', '紡織纖維', '食品工業', '貿易百貨', '生技醫療業'],
};
const CO = {};
for (const [n, c] of Object.entries(CITY.companies)) {
  const etfs = ETF_KEYS.filter(k => ETFS[k].w[n] != null), rank = c.mcap_rank || 999;
  CO[n] = { name: n, code: c.code, d: DIST[c.district] ? c.district : Object.keys(DIST).at(-1), ind: c.industry, rank, share: c.mcap_share ?? null, etfs,
    maxW: etfs.length ? Math.max(...etfs.map(k => ETFS[k].w[n])) : 0, tier: rank === 1 ? 'xl' : rank <= 10 ? 'l' : rank <= 40 ? 'm' : 's' };
}

/* ---------------- 回字型商店街：一圈道路，兩側都是店；南邊中間是 ETF 廣場 ----------------
   以道路中心線為準：車道 road、人行道 walk、騎樓 arc，騎樓外緣 (front) 是招牌所在的立面，再往內 arc 是店面玻璃 */
const L = { road: 4, walk: 2.5, arc: 3, dep: 12, cOut: 10.5, cIn: 20, plazaHalf: 15, plazaDepth: 26, gap: 0.25, dGap: 6 };
L.front = L.road + L.walk; L.shop = L.front + L.arc; L.band = L.shop - 0.35;
const D_ORDER = ['semi', 'tech', 'port', 'fin', 'life'].filter(k => DIST[k]).concat(Object.keys(DIST).filter(k => !['semi', 'tech', 'port', 'fin', 'life'].includes(k)));
function sortedIn(dk) {
  const sub = SUB[dk] || [], ix = c => { const i = sub.indexOf(c.ind); return i < 0 ? 99 : i; };
  return Object.values(CO).filter(c => c.d === dk).sort((a, b) => ix(a) - ix(b) || a.rank - b.rank);
}
function layoutRing(R) {
  const side = 2 * R, P = 4 * side, res = { outer: [], inner: [] };
  for (let i = 0; i <= 4; i++) { res.outer.push([i * side - L.cOut, i * side + L.cOut]); res.inner.push([i * side - L.cIn, i * side + L.cIn]); }
  for (const o of [0, P]) res.inner.push([R - L.plazaHalf + o, R + L.plazaHalf + o]);
  const lim = { outer: [R - TIER.xl.w / 2, R - TIER.xl.w / 2 + P], inner: [R + L.plazaHalf, R - L.plazaHalf + P] };
  const cur = { outer: lim.outer[0], inner: lim.inner[0] };
  const fit = (row, w, from) => { let a = from; for (let k = 0; k < 20; k++) { const hit = res[row].find(([x, y]) => a < y && a + w > x); if (!hit) break; a = hit[1]; } return a; };
  const out = [], dists = []; let first = true;
  for (const dk of D_ORDER) {
    const list = sortedIn(dk); if (!list.length) continue;
    if (!first) { const s = Math.max(cur.outer, cur.inner) + L.dGap; cur.outer = cur.inner = s; }
    const d0 = first ? cur.outer : cur.outer; first = false;
    for (const c of list) {
      const w = TIER[c.tier].w + L.gap;
      const cand = ['outer', 'inner'].filter(r => c.tier !== 'xl' || r === 'outer').map(r => { const a = fit(r, w, cur[r]); return { r, a, e: a + w }; }).sort((x, y) => x.e - y.e)[0];
      if (cand.e > lim[cand.r][1]) return null;
      out.push({ c, row: cand.r, s0: cand.a, s1: cand.e - L.gap }); cur[cand.r] = cand.e;
    }
    dists.push({ k: dk, s0: d0, s1: Math.max(cur.outer, cur.inner) });
  }
  return { R, side, P, res, lim, out, dists };
}
let LAY = null;
for (let R = 50; R < 240 && !LAY; R += 2) LAY = layoutRing(R);
const RR = LAY.R, PL = { x0: -L.plazaHalf, x1: L.plazaHalf, z0: RR - L.front - L.plazaDepth, z1: RR - L.front };   // 廣場範圍

/* 路中心線上第 s 公尺的位置；off 往外 (+) 或往內 (-) 偏移 */
function ringPt(s, off = 0) {
  const { R, side, P } = LAY; s = ((s % P) + P) % P;
  const i = Math.min(3, Math.floor(s / side)), t = s - i * side - R;
  const C = [[t, R], [R, -t], [-t, -R], [-R, t]][i], N = [[0, 1], [1, 0], [0, -1], [-1, 0]][i], Dv = [[1, 0], [0, -1], [-1, 0], [0, 1]][i];
  return { x: C[0] + N[0] * off, z: C[1] + N[1] * off, nx: N[0], nz: N[1], dx: Dv[0], dz: Dv[1], i, t };
}
/* 反過來：某個位置最接近中心線的哪裡 (s) 和偏移量 (off，往外為正) */
function ringS(x, z) {
  const { R, side } = LAY; let best = null;
  [[x, z - R], [-z, x - R], [-x, -z - R], [z, -x - R]].forEach(([t, off], i) => {
    const tc = clamp(t, -R, R), d = Math.hypot(t - tc, off);
    if (!best || d < best.d) best = { d, s: i * side + R + tc, off, i };
  });
  return best;
}
// 每家店的位置：front 立面中心、door 店門口 (人行道上)、pos 建築中心、rotY 面向馬路
function placeStore(c, s0, s1, row) {
  const sm = (s0 + s1) / 2, sg = row === 'outer' ? 1 : -1, q = ringPt(sm);
  Object.assign(c, { row, s: sm, w: s1 - s0, sg, side: q.i, fx: -q.nx * sg, fz: -q.nz * sg,
    front: [q.x + q.nx * sg * L.front, q.z + q.nz * sg * L.front], door: [q.x + q.nx * sg * (L.road + 1.4), q.z + q.nz * sg * (L.road + 1.4)],
    pos: [q.x + q.nx * sg * (L.front + L.dep / 2), q.z + q.nz * sg * (L.front + L.dep / 2)], fl: TIER[c.tier] ? TIER[c.tier].fl : 3 });
  c.rotY = Math.atan2(c.fx, c.fz);
  // 平面上的四個角 (導覽圖、撞牆判定用)
  const ax = q.dx, az = q.dz, hw = c.w / 2, f0 = L.front, f1 = L.front + L.dep;
  c.poly = [[-hw, f0], [hw, f0], [hw, f1], [-hw, f1]].map(([a, o]) => [q.x + ax * a + q.nx * sg * o, q.z + az * a + q.nz * sg * o]);
}
for (const p of LAY.out) placeStore(p.c, p.s0, p.s1, p.row);
// 店與店之間的空位補上一般小店 (不是公司，不能互動)
const FILL_NAMES = ['早餐店', '飲料店', '機車行', '藥局', '文具店', '自助餐', '麵店', '水果行', '洗衣店', '眼鏡行', '書局', '花店', '五金行', '鞋店', '咖啡店', '便當店', '豆花', '鹹酥雞'];
const FILLERS = [];
{
  const r0 = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; })();
  for (const row of ['outer', 'inner']) {
    const occ = [...LAY.res[row], ...LAY.out.filter(p => p.row === row).map(p => [p.s0 - L.gap / 2, p.s1 + L.gap / 2])].sort((a, b) => a[0] - b[0]);
    const [a0, a1] = LAY.lim[row]; let cur = a0;
    const gaps = [];
    for (const [x, y] of occ) { if (y <= cur) continue; if (x > cur) gaps.push([cur, Math.min(x, a1)]); cur = Math.max(cur, y); if (cur >= a1) break; }
    if (cur < a1) gaps.push([cur, a1]);
    for (const [g0, g1] of gaps) {
      let s = g0 + 0.1;
      while (g1 - s >= 4) {
        let w = 6 + Math.floor(r0() * 4); if (g1 - s - w < 4) w = g1 - s - 0.1;
        const f = { name: FILL_NAMES[FILLERS.length % FILL_NAMES.length], filler: true, tier: 's', d: null, rank: 999, etfs: [] };
        placeStore(f, s, s + w, row); f.fl = 2 + Math.floor(r0() * 3); FILLERS.push(f); s += w + L.gap;
      }
    }
  }
}
const STORES = [...Object.values(CO).filter(c => c.front), ...FILLERS];
for (const d of LAY.dists) Object.assign(DIST[d.k], { s0: d.s0, s1: d.s1 });
