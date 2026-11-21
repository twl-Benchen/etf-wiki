
/* ================= chat-driven city ================= */
const HIST = {}; for (const k of ETF_KEYS) if (CITY.monthly && CITY.monthly[k]) HIST[k] = { m: CITY.monthly[k], last: CITY.last[k] };
const demoTag = () => scenarioKey === 'real' ? '' : ' (示意行情)';
const dailySrc = () => scenarioKey === 'real' ? `資料：${CITY.daily.source || '證交所每日行情'} (${CITY.daily.date})` : '資料：今日漲跌為示意行情，不是真實報價';
const esc = t => String(t).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
const $ = id => document.getElementById(id);
const DESK = () => innerWidth > 760;
const r1 = v => Math.round(v * 10) / 10;
const r2 = v => Math.round(v * 100) / 100;
const money = v => Math.round(v).toLocaleString('en-US');
const ymText = s => { const [y, m, d] = s.split('-'); return d ? `${y}/${+m}/${+d}` : `${y}/${m}`; };
const cls = v => v > 0 ? 'up' : v < 0 ? 'down' : '';
const cn = n => '零一兩三四五六七八九十'[n] ?? String(n);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const RULES = { crash_below: -3, boom_above: 3, rain_below: -1.2 };

let scenarioKey = REAL ? 'real' : 'mixed', timeH = 14.5, idxNow = 0;
const weather = { rain: false, haze: 0 };
const labelSet = new Map();
let allLabels = false, focusLines = null, mine = null, replay = null, ctx = null;

/* ---------- city state ---------- */
function paintCrown(b, c) {
  b.crown.emissive.set(c >= 0.3 ? 0xff2d2d : c <= -0.3 ? 0x20e070 : 0xffffff);
  b.crown.emissiveIntensity = Math.abs(c) < 0.3 ? 0.6 : 1.8;
}
function applyScenario(key) {
  scenarioKey = key; scenarioNow = key; chg = genChanges(key);
  for (const b of Object.values(B)) {
    const c = chg[b.c.name], st = stateOf(c);
    applyFacades(b, LIT[st], st === 'crash');
    paintCrown(b, c);
    b.fx.clear();
    if (st === 'crash') { const [w, d] = b.c.kind === 'air' ? [2.4, 2.4] : b.c.fp; b.fx.add(scaffold(b, w, d, Math.min(b.c.H * 0.45, 9))); }
    b.boom = st === 'boom'; b.nextBurst = Math.random() * 1.5;
  }
  idxNow = indexEst();
  weather.rain = idxNow <= RULES.rain_below; weather.haze = clamp(Math.abs(idxNow) / 4, 0, 1);
  rain.visible = weather.rain;
  document.querySelectorAll('[data-scn]').forEach(x => x.setAttribute('aria-pressed', String(x.dataset.scn === key)));
  applyTime(timeH);
  refreshLabels();
}
const SKY = { night: ['#08101e', '#1a2a46'], dusk: ['#36477a', '#f1a066'], day: ['#5ea6e2', '#d4e9f6'], storm: ['#4a5361', '#8f99a4'] };
function mixHex(a, b, t) { return '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString(); }
const hhmm = h => { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; };
function applyTime(h) {
  timeH = h;
  $('time').value = String(h); $('timeOut').textContent = hhmm(h);
  const live = h >= 9 && h < 13.5, st = $('status');
  st.classList.toggle('live', live);
  st.innerHTML = `<i></i><span>${live ? '盤中' : h < 9 ? '盤前' : '收盤'}</span><span class="${cls(idxNow)}">大盤 ${fmtPct(idxNow)}</span>`;
  const day = clamp(1 - Math.abs(h - 12.5) / 7.4, 0, 1), dl = day * day * (3 - 2 * day);
  let top, bot;
  if (dl < 0.35) { top = mixHex(SKY.night[0], SKY.dusk[0], dl / 0.35); bot = mixHex(SKY.night[1], SKY.dusk[1], dl / 0.35); }
  else { top = mixHex(SKY.dusk[0], SKY.day[0], (dl - 0.35) / 0.65); bot = mixHex(SKY.dusk[1], SKY.day[1], (dl - 0.35) / 0.65); }
  if (weather.rain) { top = mixHex(top, SKY.storm[0], 0.4 * dl + 0.15); bot = mixHex(bot, SKY.storm[1], 0.4 * dl + 0.15); }
  $('sky').style.background = `linear-gradient(180deg, ${top} 0%, ${bot} 100%)`;
  scene.fog.color.set(bot);
  scene.fog.near = weather.rain ? 105 : 125 - weather.haze * 15; scene.fog.far = weather.rain ? 300 : 380;
  const az = (h - 6) / 12 * Math.PI;
  sun.position.set(Math.cos(az) * 90, Math.max(8, Math.sin(az) * 100), 55); sun.target.position.set(0, 0, 0);
  const warm = 1 - clamp((dl - 0.15) / 0.5, 0, 1);
  sun.color.set(mixHex('#ffffff', '#ffb070', warm));
  sun.intensity = (0.15 + 2.5 * dl) * (weather.rain ? 0.55 : 1);
  hemi.intensity = 0.22 + 0.75 * dl; hemi.color.set(mixHex('#7d93c9', '#dfeeff', dl));
  const night = 1 - dl;
  for (const m of windowMats) m.emissiveIntensity = (0.06 + 1.5 * Math.pow(night, 1.4)) * (m.userData.dim || 1);
  M.lampOff.emissiveIntensity = night > 0.45 ? 2.2 : 0;
  for (const car of cars) car.userData.hl.emissiveIntensity = night > 0.45 ? 2.5 : 0;
  renderer.toneMappingExposure = 1.0 + 0.15 * night;
}

/* ---------- labels ---------- */
const lightOf = hex => shade(hex, 0.2);
function labelLinesFor(b, mode) {
  const n = b.c.name, c = chg[n], L = [{ text: n, size: 22 }];
  if (mode === 'chg') L.push({ text: fmtPct(c), size: 20, color: c > 0 ? '#ff7b7b' : c < 0 ? '#5fe0a0' : '#e8e8e8' });
  else if (mode.startsWith('w:')) { for (const k of mode.slice(2).split(',')) if (ETFS[k].w[n] != null) L.push({ text: `${k}  ${ETFS[k].w[n].toFixed(2)}%`, size: 18, color: lightOf(ETFS[k].color) }); }
  else if (mode === 'mine' && mine) L.push({ text: `你持有 ${(mine._share[n] * 100).toFixed(1)}%`, size: 19, color: '#ffd45c' });
  return L;
}
function drawLabel(b, mode) {
  const ls = labelLinesFor(b, mode), h = 22 + ls.length * 24;
  if (b.label.userData.h !== h) {
    b.group.remove(b.label); b.label.material.map.dispose(); b.label.material.dispose();
    const sp = textSprite(ls, { w: 190, h, depthTest: false }); sp.userData.h = h; b.group.add(sp); b.label = sp;
  } else b.label.userData.draw(ls);
}
function refreshLabels() {
  for (const b of Object.values(B)) {
    const mode = labelSet.get(b.c.name) || (allLabels ? 'chg' : null);
    b.label.visible = !!mode;
    if (mode) drawLabel(b, mode);
  }
}
function setLabels(pairs) { labelSet.clear(); for (const [n, m] of pairs.slice(0, DESK() ? 8 : 4)) labelSet.set(n, m); refreshLabels(); }
function defaultLabels() {
  return Object.keys(chg).sort((a, b) => Math.abs(chg[b]) - Math.abs(chg[a])).slice(0, 5).map(n => [n, 'chg']);
}

/* ---------- lines, rings, gold ---------- */
function setFocus(set) {
  focusLines = set && set.size ? set : null;
  for (const [k, L] of Object.entries(LINES)) {
    const on = !focusLines || focusLines.has(k);
    L.mat.opacity = on ? 0.95 : 0.12; L.ribbon.userData.ghost.material.opacity = on ? 0.42 : 0.03;
    L.pulses.forEach(p => { p.visible = on; p.renderOrder = 6; });
  }
  buildStations(focusLines || new Set(Object.keys(ETFS)));
}
const ringG = new THREE.Group(); scene.add(ringG);
function ringAt(p, r, color = 0xffffff) { return { p, r, color }; }
function ringForCo(n, color) { const c = CO[n]; const r = c.kind === 'fab' ? 6 : c.kind === 'air' ? 3 : c.kind === 'fin' ? Math.max(...c.fp) / 2 + 2 : Math.max(...c.fp) / 2 + 1.3; return ringAt(c.pos, r, color); }
function ringForSt(n, color) { const p = ST[n].p; return ringAt([p.x, p.z], 1.7, color); }
function setRings(items) {
  for (const m of [...ringG.children]) { ringG.remove(m); m.geometry.dispose(); m.material.dispose(); }
  items.forEach((it, i) => {
    for (let j = 0; j < 2; j++) {
      const m = new THREE.Mesh(new THREE.RingGeometry(it.r, it.r + (j ? 0.16 : 0.34), 56), new THREE.MeshBasicMaterial({ color: it.color, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }));
      m.rotation.x = -Math.PI / 2; m.position.set(it.p[0], 0.5 + j * 0.01, it.p[1]); m.userData = { pulse: j === 1, ph: i * 0.23 }; m.renderOrder = 4;
      ringG.add(m);
    }
  });
}
function setMine(m) {
  mine = m;
  const maxS = mine ? Math.max(...Object.values(mine._share)) : 1;
  for (const b of Object.values(B)) {
    if (b.gold) { b.group.remove(b.gold); b.gold.traverse(o => { if (o.geometry) o.geometry.dispose(); }); b.gold = null; }
    const s = mine && mine._share[b.c.name];
    if (!s) continue;
    const [w, d] = b.c.kind === 'air' ? [2.4, 2.4] : b.c.fp, base = b.c.kind === 'fin' ? 1.6 : 0;
    const h = Math.max(0.8, b.c.H * (b.c.kind === 'fin' ? 0.68 : 0.62) * (s / maxS));
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(w + 0.18, h, d + 0.18), new THREE.MeshBasicMaterial({ color: 0xffc83d, transparent: true, opacity: 0.4, depthWrite: false }));
    box.position.y = base + h / 2; g.add(box);
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(box.geometry), new THREE.LineBasicMaterial({ color: 0xffd45c }));
    edges.position.copy(box.position); g.add(edges);
    b.group.add(g); b.gold = g;
  }
}
function resetCity() { setFocus(null); setRings([]); setMine(null); setLabels(defaultLabels()); }

/* ---------- camera ---------- */
function layoutView() {
  const W = innerWidth, H = innerHeight, a = W / H;
  Object.assign(camera, { left: -VIEW * a / 2, right: VIEW * a / 2, top: VIEW / 2, bottom: -VIEW / 2 });
  camera.setViewOffset(W, H, DESK() ? 208 : 0, DESK() ? 0 : Math.round(H * 0.23 - 36), W, H);
  camera.updateProjectionMatrix(); renderer.setSize(W, H);
}
let fly = null;
function flyTo(target, zoom, dur = 1.15) {
  fly = { t: reduce ? dur : 0, dur, fromT: controls.target.clone(), toT: target, fromZ: camera.zoom, toZ: zoom, off: camera.position.clone().sub(controls.target) };
}
controls.addEventListener('start', () => { fly = null; });
function fitNames(names, { maxZoom = 2.1, pad = 1.12 } = {}) {
  // project each building's bounding box onto the camera's screen axes, then pick target + zoom so it fills the free area
  const off = fly ? fly.off : camera.position.clone().sub(controls.target);
  const fwd = off.clone().negate().normalize();
  const Rv = new THREE.Vector3().crossVectors(fwd, camera.up).normalize(), Uv = new THREE.Vector3().crossVectors(Rv, fwd).normalize();
  let r0 = Infinity, r1 = -Infinity, u0 = Infinity, u1 = -Infinity; const ctr = new THREE.Vector3(), p = new THREE.Vector3();
  for (const n of names) {
    const c = CO[n], rr = Math.max(...c.fp) / 2 + (c.kind === 'fab' ? 5 : c.kind === 'ship' ? 3 : 1), top = B[n].topY + 1;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0, top]) {
      p.set(c.pos[0] + sx * rr, y, c.pos[1] + sz * rr);
      const a = p.dot(Rv), b = p.dot(Uv); r0 = Math.min(r0, a); r1 = Math.max(r1, a); u0 = Math.min(u0, b); u1 = Math.max(u1, b);
    }
    ctr.add(p.set(c.pos[0], top / 2, c.pos[1]));
  }
  ctr.divideScalar(names.length);
  const fw = (DESK() ? innerWidth - 416 : innerWidth) - 40, fh = DESK() ? innerHeight - 70 : innerHeight * 0.54 - 110;
  const zfit = (hu) => clamp(Math.min(fw * VIEW / innerHeight / ((r1 - r0) * pad), fh * VIEW / innerHeight / (hu * pad)), 0.3, maxZoom);
  const z0 = zfit(u1 - u0);
  u1 += 80 * VIEW / (innerHeight * z0); // room for the floating labels above the tallest roof
  const zoom = zfit(u1 - u0);
  const T = ctr.clone().addScaledVector(Rv, (r0 + r1) / 2 - ctr.dot(Rv)).addScaledVector(Uv, (u0 + u1) / 2 - ctr.dot(Uv));
  flyTo(T, zoom);
}
const ALL = Object.keys(CO);
const overview = () => fitNames(ALL, { maxZoom: 0.95 });

/* ================= agent: tools ================= */
const reEsc = t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const KB = (CITY.kb || []).map(d => ({ ...d, keys: new RegExp([d.title, ...(d.aliases || [])].filter(Boolean).map(reEsc).join('|'), 'i'), lines: ETF_KEYS.filter(k => d.text.includes(k)).slice(0, 3) }));
const KB_KEYS = /成本|交易成本|代號|代碼|第六碼|什麼是|是什麼|什麼意思|怎麼算|如何計算|收益平準金|折價|溢價|淨值|除息|填息|配息|內扣|費用|經理費|手續費|證交稅|稅|市值型|高股息型|高股息(跟|和|與|還是)|成分股調整|換股|追蹤誤差|申購|買回|槓桿|反向|債券|殖利率|零股|下市|清算|風險|主動式|被動式/;
function firstSection(md, limit = 420) {
  const out = []; let n = 0;
  for (let ln of md.split('\n')) {
    ln = ln.trim();
    if (!ln || ln.startsWith('#') || ln.startsWith('|')) { if (n > 120 && ln.startsWith('#')) break; continue; }
    ln = ln.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\s*\(來源[:：][^)]*\)/g, '').replace(/^[-*]\s*/, '').replace(/\*\*/g, '');
    out.push(/[。！？]$/.test(ln) ? ln : ln + '。'); n += ln.length; if (n > limit) break;
  }
  return esc(out.join(''));
}
function bigrams(s) { s = s.replace(/[\s，。、()（）？?！!「」:：]/g, ''); const m = new Map(); for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); } return m; }
function cosine(a, b) { let d = 0, na = 0, nb = 0; for (const [k, v] of a) { na += v * v; if (b.has(k)) d += v * b.get(k); } for (const v of b.values()) nb += v * v; return na && nb ? d / Math.sqrt(na * nb) : 0; }

const TOOLS = {
  market_summary() {
    const avg = {};
    for (const d of Object.keys(DIST)) { const ns = Object.values(CO).filter(c => c.d === d).map(c => chg[c.name]); avg[d] = r2(ns.reduce((a, b) => a + b, 0) / ns.length); }
    const ks = Object.keys(avg).sort((a, b) => avg[a] - avg[b]);
    const pick = f => Object.keys(chg).filter(f).map(n => ({ name: n, change: chg[n] }));
    return {
      index_est: r2(idxNow), district_avg: Object.fromEntries(ks.map(d => [DIST[d].name, avg[d]])),
      worst: DIST[ks[0]].name, best: DIST[ks.at(-1)].name,
      crash: pick(n => chg[n] <= RULES.crash_below).sort((a, b) => a.change - b.change),
      boom: pick(n => chg[n] >= RULES.boom_above).sort((a, b) => b.change - a.change),
      rain: weather.rain, rules: RULES, note: scenarioKey === 'real' ? '' : '示意行情',
      _wk: ks[0], _bk: ks.at(-1),
    };
  },
  district_detail({ district }) {
    const k = Object.keys(DIST).find(x => DIST[x].name === district);
    const list = Object.values(CO).filter(c => c.d === k).map(c => ({ name: c.name, change: chg[c.name] })).sort((a, b) => b.change - a.change);
    return { district, avg: r2(list.reduce((a, b) => a + b.change, 0) / list.length), companies: list, rules: RULES, note: scenarioKey === 'real' ? '' : '示意行情', _k: k };
  },
  get_stock_today({ name }) { const c = CO[name]; return { name, code: c.code, industry: c.ind, district: DIST[c.d].name, change: chg[name], state: stateOf(chg[name]), rules: RULES, note: scenarioKey === 'real' ? '' : '示意行情' }; },
  etfs_holding({ name }) {
    return { name, etfs: Object.keys(ETFS).filter(k => ETFS[k].w[name] != null).map(k => ({ etf: k, weight: ETFS[k].w[name], rank: Object.entries(ETFS[k].w).sort((a, b) => b[1] - a[1]).findIndex(([n]) => n === name) + 1 })) };
  },
  get_holdings({ etf }) {
    const e = ETFS[etf], top = Object.entries(e.w).sort((a, b) => b[1] - a[1]), byD = {};
    for (const [n, w] of top) { const dn = DIST[CO[n].d].name; byD[dn] = r2((byD[dn] || 0) + w); }
    return { etf, name: e.name, type: e.type, top10: top.map(([name, w]) => ({ name, w })), top10_sum: r2(top.reduce((a, [, w]) => a + w, 0)), by_district: byD };
  },
  holdings_overlap({ a, b }) {
    const A = ETFS[a].w, Bw = ETFS[b].w;
    const shared = Object.keys(A).filter(n => Bw[n] != null).sort((x, y) => Math.min(A[y], Bw[y]) - Math.min(A[x], Bw[x])).map(n => ({ name: n, [a]: A[n], [b]: Bw[n] }));
    return { a, b, count: shared.length, overlap: r2(shared.reduce((s, x) => s + Math.min(x[a], x[b]), 0)), shared, method: '共同持股取較小權重相加' };
  },
  get_return({ etf, period = '1y' }) {
    const R = (CITY.returns[etf] || {})[period] || (CITY.returns[etf] || {})['max'];
    return { etf, period, from: R.from, to: R.to, ret: R.ret, basis: '價格報酬，未含息' };
  },
  simulate_dca({ etf, monthly, start }) {
    const H = HIST[etf]; let rows = H.m.filter(([ym]) => ym >= start); if (!rows.length) rows = H.m.slice(-12);
    let sh = 0, inv = 0, worst = { d: rows[0][0], pnl: Infinity };
    const series = rows.map(([d, p], i) => {
      sh += monthly / p; inv += monthly; const val = sh * p, pnl = (val / inv - 1) * 100;
      if (pnl < worst.pnl) worst = { d, pnl: r2(pnl) };
      const nxt = i + 1 < rows.length ? rows[i + 1][1] : H.last[1];
      return { d, p, inv, val, ch: nxt / p - 1 };
    });
    const val = sh * H.last[1];
    series.push({ d: H.last[0], p: H.last[1], inv, val, ch: null });
    const chs = series.filter(s => s.ch != null);
    const mn = chs.reduce((a, b) => b.ch < a.ch ? b : a), mx = chs.reduce((a, b) => b.ch > a.ch ? b : a);
    return { etf, monthly, start: rows[0][0], end: H.last[0], n: rows.length, invested: inv, value: Math.round(val), ret: r2((val / inv - 1) * 100),
      worst, max_drop: { d: mn.d, ch: r2(mn.ch * 100) }, max_gain: { d: mx.d, ch: r2(mx.ch * 100) }, effects: { rain_below: -4, fireworks_above: 5 },
      basis: '每月第一個交易日收盤價買進，可買零股，價格報酬未含息與手續費', _series: series };
  },
  lookthrough({ amounts }) {
    const ex = {}, from = {}; let total = 0, covered = 0;
    for (const [k, a] of Object.entries(amounts)) { total += a; for (const [n, w] of Object.entries(ETFS[k].w)) { const v = a * w / 100; ex[n] = (ex[n] || 0) + v; (from[n] ||= {})[k] = Math.round(v); covered += v; } }
    const share = {}; for (const n in ex) share[n] = ex[n] / total;
    const top = Object.keys(ex).sort((x, y) => ex[y] - ex[x]).slice(0, 6).map(n => ({ name: n, share_pct: r1(share[n] * 100), from: from[n] }));
    const cp = r1(covered / total * 100);
    return { total, top, covered_pct: cp, rest_pct: r1(100 - cp), note: '只計各檔前十大成分股', _share: share };
  },
  search_knowledge({ query }) {
    // 和後端 rag.py 相同的規則：內容相似度，加上標題或別名出現在問題裡的加分 (太短或太常見的詞不加分)
    const strip = query.replace(/什麼是|是什麼|什麼意思|為什麼|怎麼|如何|請問|可以|嗎|呢|多少|哪些|？|\?/g, ' ').trim() || query;
    const qa = bigrams(strip), low = query.toLowerCase(), qs = strip.toLowerCase().replace(/\s/g, '');
    const sc = KB.map(d => {
      const all = [d.title.replace('什麼是 ', ''), ...(d.aliases || [])].filter(Boolean);
      const names = all.filter(x => x.length >= 2 && !/^etfs?$/i.test(x));
      const hit = names.filter(x => low.includes(x.toLowerCase()));
      let bonus = hit.length ? Math.min(0.4, 0.1 + 0.05 * Math.max(...hit.map(x => x.length))) : 0;
      if (all.some(x => x.toLowerCase().replace(/\s/g, '') === qs)) bonus += 0.25;
      return { d, s: cosine(qa, bigrams(d.title + d.title + d.summary + d.text)) + bonus };
    }).sort((a, b) => b.s - a.s);
    const top = sc[0];
    if (!top || top.s < 0.2) return { hit: false, score: top ? r2(top.s) : 0 };
    return { hit: true, title: top.d.title, score: r2(Math.min(0.99, top.s)), _text: firstSection(top.d.text), _raw: top.d.text, _doc: top.d, second: sc[1] ? sc[1].d.title : null };
  },
};

/* ================= agent: planner (rule-based stand-in for the LLM planner) ================= */
const ETF_RE = () => new RegExp('(?<!\\d)(' + [...ETF_KEYS].sort((a, b) => b.length - a.length).join('|') + ')(?!\\d)', 'g');
const ETF_ALIAS = [...ETF_KEYS.map(k => [ETFS[k].name, k]), ['群益高息', '00919'], ['群益精選高息', '00919'], ['元大台灣50', '0050'], ['台灣50', '0050'], ['台灣五十', '0050'], ['富邦台50', '006208'], ['元大高股息', '0056'], ['國泰永續高股息', '00878'], ['國泰永續', '00878']];
const CO_ALIAS = [...Object.keys(CO).map(n => [n, n]), ['台積', '台積電'], ['TSMC', '台積電'], ['發哥', '聯發科'], ['中華電信', '中華電'], ['日月光', '日月光投控'], ['長榮海運', '長榮'], ['長榮航空', '長榮航'], ['陽明海運', '陽明'], ['華南', '華南金'], ['國泰金控', '國泰金'], ['富邦金控', '富邦金'], ['中信', '中信金'], ['元大金控', '元大金']]
  .sort((a, b) => b[0].length - a[0].length);
const CN_D = { 零: 0, 〇: 0, 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
function parseCN(s) {
  let total = 0, sec = 0, num = 0, last = '';
  for (const ch of s) {
    if (ch in CN_D) num = CN_D[ch];
    else { const u = { 十: 10, 百: 100, 千: 1000 }[ch]; if (u) { sec += (num || 1) * u; num = 0; last = ch; } else if (ch === '萬') { total += (sec + num) * 10000; sec = 0; num = 0; last = ch; } }
  }
  if (num && last === '萬') return total + num * 1000;
  if (num && last === '千') return total + sec + num * 100;
  return total + sec + num;
}
function extract(q) {
  let s = q;
  for (const [a, k] of ETF_ALIAS) if (ETFS[k]) s = s.split(a).join(` ${k} `);
  const cos = []; let sc = s;
  for (const [a, n] of CO_ALIAS) { const i = sc.indexOf(a); if (i >= 0) { if (!cos.some(x => x.n === n)) cos.push({ n, i }); sc = sc.split(a).join('＃'.repeat(a.length)); } }
  cos.sort((a, b) => a.i - b.i);
  const tok = [];
  for (const m of sc.matchAll(ETF_RE())) tok.push({ t: 'etf', v: m[1], i: m.index });
  const yr = sc.match(/(?<!\d)(20[12]\d)(?!\d)/);
  let hour = null; const hm = sc.match(/(?<!\d)(\d{1,2})\s*點/);
  if (hm) { hour = +hm[1]; if (/晚上|下午|傍晚/.test(sc) && hour < 12) hour += 12; }
  const mask = m => '§'.repeat(m.length);
  const qa = sc.replace(ETF_RE(), mask).replace(/(?<!\d)20[12]\d(?!\d)\s*年?/g, mask).replace(/(?<!\d)\d{1,2}\s*點/g, mask);
  for (const m of qa.matchAll(/(\d+(?:\.\d+)?)\s*(萬|千|k|K)?|([一二兩三四五六七八九十百千萬]*[十百千萬][一二兩三四五六七八九十百千萬]*)/g)) {
    const v = m[1] ? parseFloat(m[1]) * (m[2] === '萬' ? 10000 : m[2] ? 1000 : 1) : parseCN(m[3]);
    if (v >= 100) tok.push({ t: 'amt', v: Math.round(v), i: m.index });
  }
  tok.sort((a, b) => a.i - b.i);
  const pairs = {}; let lastEtf = null, pend = null;
  for (const t of tok) {
    if (t.t === 'etf') { lastEtf = t.v; if (pend != null && pairs[t.v] == null) { pairs[t.v] = pend; pend = null; } }
    else if (lastEtf && pairs[lastEtf] == null) pairs[lastEtf] = t.v; else pend = t.v;
  }
  return { etfs: [...new Set(tok.filter(t => t.t === 'etf').map(t => t.v))], cos: cos.map(x => x.n), amounts: tok.filter(t => t.t === 'amt').map(t => t.v), pairs, year: yr ? +yr[1] : null, hour };
}
function districtIn(q) { return /半導體|園區/.test(q) ? 'semi' : /電子|科技區/.test(q) ? 'tech' : /金融區/.test(q) ? 'fin' : /航運|港/.test(q) ? 'port' : /民生|工業區/.test(q) && DIST.life ? 'life' : null; }
function planner(q0) {
  const q = q0.replace(/(\d),(?=\d{3})/g, '$1').trim(), E = extract(q), has = re => re.test(q);
  const followUp = /^(那|換成|改成|如果是|那如果|換)|呢[？?]?$/.test(q);
  let intent;
  if (has(/(明天|下週|下周|明年|未來|之後|接下來).{0,8}(漲|跌|走勢|表現)|會(漲|跌)嗎|會不會(漲|跌|賺|賠)|該不該|要不要買|可以買嗎|值得買|推薦|明牌|保證|梭哈|all ?in|借錢|目標價|預測|穩賺/i)) intent = 'refuse';
  else if (!has(/什麼是|是什麼/) && (has(/定期定額|每月|每個月|存股|回放|重播/) || (has(/如果|假設/) && has(/買|存|投入/) && E.amounts.length))) intent = 'replay';
  else if (Object.keys(E.pairs).length && has(/我(有|買|持有|手上|的)|持股|改成|換成|配置/)) intent = 'mine';
  else if (has(/我的城市|我的持股|看穿/)) intent = 'mine';
  else if (followUp && E.etfs.length === 1 && ctx && ['replay', 'etf', 'refuse'].includes(ctx.intent)) intent = ctx.intent;
  else if (E.etfs.length >= 2) intent = 'compare';
  else if (KB_KEYS.test(q)) intent = 'kb';
  else if (E.cos.length && has(/站|轉乘|經過/)) intent = 'station';
  else if (E.cos.length) intent = 'company';
  else if (has(/大跌|崩盤|股災|大漲|平盤|震盪/)) intent = 'scenario';
  else if (has(/晚上|夜景|夜晚|天黑|白天|早上|中午|下午|傍晚/) || E.hour != null) intent = 'time';
  else if (E.etfs.length === 1) intent = 'etf';
  else if (has(/總覽|全部|回到|重置|重來|整個城市|全城|看全部/)) intent = 'overview';
  else if (has(/今天|今日|大盤|市場|怎麼了|發生|新聞|日報|為什麼|下雨|煙火|港區|園區|金融區|科技區|行情/)) intent = 'market';
  else if (has(/什麼是|是什麼|意思|差在哪|差別/)) intent = 'kb';
  else intent = TOOLS.search_knowledge({ query: q }).hit ? 'kb' : 'help';
  return { intent, E, q };
}

/* ================= agent: handlers (tools to call, city actions, writer) ================= */
const ROLE = { guide: ['城市導覽員', '導', '#435369'], archive: ['城市檔案室', '檔', '#7a5c2e'] };
function marketText(m) {
  const da = m.district_avg, wv = da[m.worst], bv = da[m.best];
  let h = `今天${demoTag()} 大盤${scenarioKey === 'real' ? '' : '估算'} <b class="${cls(m.index_est)}">${fmtPct(m.index_est)}</b>${m.rain ? '，城市在下雨' : ''}。`;
  const parts = [];
  if (wv < -0.5) parts.push(`${m.worst}最弱，平均 <b class="down">${fmtPct(wv)}</b>`);
  if (bv > 0.5) parts.push(`${m.best}最強，平均 <b class="up">${fmtPct(bv)}</b>`);
  h += parts.length ? parts.join('；') + '。' : '各區變動都不大，燈光照常。';
  const li = xs => xs.map(x => `${x.name} <b class="${cls(x.change)}">${fmtPct(x.change)}</b>`).join('、');
  const ev = [];
  if (m.crash.length) ev.push(`跌超過 ${Math.abs(m.rules.crash_below)}% 的有${li(m.crash.slice(0, 2))}，外牆龜裂、搭起鷹架`);
  if (m.boom.length) ev.push(`漲超過 ${m.rules.boom_above}% 的有${li(m.boom.slice(0, 2))}，頂樓在放煙火`);
  if (ev.length) h += ev.join('；') + '。';
  return h + '點任何一棟大樓，可以直接問它的管理員。';
}
function marketAct(m) {
  setFocus(null); setMine(null);
  const hot = [...m.crash.slice(0, 3), ...m.boom.slice(0, 3)].map(x => x.name);
  const names = hot.length ? hot : defaultLabels().map(x => x[0]);
  setLabels(names.map(n => [n, 'chg']));
  setRings([...m.crash.slice(0, 1).map(x => ringForCo(x.name, 0x20e070)), ...m.boom.slice(0, 1).map(x => ringForCo(x.name, 0xff4d4d))]);
  overview();
}
const HANDLERS = {
  market({ q }) {
    const dk = districtIn(q);
    if (dk) return {
      role: ROLE.guide, tools: [['district_detail', { district: DIST[dk].name }]],
      scene: [['fly_to', { district: DIST[dk].name }], ['label', { names: '區內所有大樓', mode: '漲跌' }]],
      act([d]) { setFocus(null); setMine(null); const ns = d.companies.map(c => c.name); setLabels(ns.map(n => [n, 'chg'])); setRings([]); fitNames(ns, { maxZoom: 1.8 }); },
      write([d]) {
        const up = d.companies.filter(c => c.change > 0), dn = d.companies.filter(c => c.change < 0);
        let h = `${d.district}今天${demoTag()} 平均 <b class="${cls(d.avg)}">${fmtPct(d.avg)}</b>。`;
        if (up.length) h += `上漲的有${up.slice(0, 3).map(c => `${c.name} <b class="up">${fmtPct(c.change)}</b>`).join('、')}。`;
        if (dn.length) h += `下跌的有${dn.slice(-3).reverse().map(c => `${c.name} <b class="down">${fmtPct(c.change)}</b>`).join('、')}。`;
        const boom = d.companies.filter(c => c.change >= d.rules.boom_above), crash = d.companies.filter(c => c.change <= d.rules.crash_below);
        if (boom.length) h += `漲超過 ${d.rules.boom_above}% 的${boom.map(c => c.name).join('、')}頂樓在放煙火。`;
        if (crash.length) h += `跌超過 ${Math.abs(d.rules.crash_below)}% 的${crash.map(c => c.name).join('、')}外牆龜裂、搭起鷹架。`;
        return h;
      },
      src: dailySrc,
      follow: d => [`${d.companies[0].name}今天怎麼了？`, '今天城市怎麼了？', '回到全城'],
    };
    return {
      role: ROLE.guide, tools: [['market_summary', {}]],
      scene: [['fly_to', { overview: true }], ['label', { names: '漲跌最大的大樓', mode: '漲跌' }], ['ring', { names: '最弱與最強各一棟' }]],
      act([m]) { marketAct(m); }, write([m]) { return marketText(m); },
      src: dailySrc,
      follow: m => [`${(m.crash[0] || m.boom[0] || { name: '台積電' }).name}今天怎麼了？`, '0050 跟 00878 差在哪？', '晚上的城市長怎樣？'],
    };
  },
  scenario({ q }) {
    const key = /大跌|崩盤|股災/.test(q) ? 'down' : /大漲/.test(q) ? 'up' : /平盤/.test(q) ? 'flat' : 'mixed';
    const name = { down: '大跌', up: '大漲', flat: '平盤', mixed: '震盪' }[key];
    return {
      role: ROLE.guide, pre() { applyScenario(key); }, tools: [['market_summary', {}]],
      scene: [['set_market', { scenario: name }], ['fly_to', { overview: true }]],
      act([m]) { marketAct(m); }, write([m]) { return `換成「${name}」的示意行情。` + marketText(m); },
      src: '資料：示意行情，用來看城市在不同市況下的樣子',
      follow: () => [key !== 'down' ? '如果今天大跌呢？' : '如果今天大漲呢？', key !== 'mixed' ? '回到震盪行情' : '如果今天大漲呢？', '晚上的城市長怎樣？'],
    };
  },
  company({ E }) {
    const n = E.cos[0];
    return {
      role: [`${n}大樓管理員`, '管', '#5b4a8a'], tools: [['get_stock_today', { name: n }], ['etfs_holding', { name: n }]],
      scene: [['fly_to', { names: [n] }], ['focus_lines', { lines: '經過這棟樓的線' }], ['ring', { names: [n] }], ['label', { names: [n], mode: '漲跌' }]],
      act([s, eh]) { setMine(null); setFocus(new Set(eh.etfs.map(x => x.etf))); setRings([ringForCo(n, 0xffffff)]); setLabels([[n, 'chg']]); fitNames([n], { maxZoom: 1.9 }); },
      write([s, eh]) {
        const look = { boom: `漲超過 ${s.rules.boom_above}%，頂樓放起煙火，窗戶幾乎全亮`, up: '小漲，窗戶比平常亮', flat: '變動不大，燈光照常', down: '下跌，窗戶暗了一些', crash: `跌超過 ${Math.abs(s.rules.crash_below)}%，外牆出現裂痕、搭起鷹架，窗戶暗了一大半` }[s.state];
        const L = eh.etfs;
        let h = `${n} (${s.code}) 今天 <b class="${cls(s.change)}">${fmtPct(s.change)}</b>${demoTag()}，${look}。`;
        h += `經過這棟樓的捷運線有${cn(L.length)}條：${L.map(x => `${x.etf} (權重 <b>${x.weight.toFixed(2)}%</b>，第 ${x.rank} 大)`).join('、')}。`;
        const big = L.find(x => x.weight >= 50);
        if (big) h += `${big.etf} 有超過一半的錢在這棟樓，它今天的漲跌，幾乎就決定了 ${big.etf} 今天的表現。`;
        else if (L.length >= 3) h += `這是城裡的大轉乘站，${cn(L.length)}條線都會停，所以它一動，好幾檔 ETF 會一起受影響。`;
        else if (L.length === 2) h += `兩條線都停這裡，所以它是 ${L[0].etf} 和 ${L[1].etf} 的轉乘站。`;
        else h += `只有 ${L[0].etf} 這條線會停這站。`;
        return h;
      },
      src: () => '資料：前十大成分股權重；' + dailySrc().replace('資料：', ''),
      follow: (s, eh) => [`${n}站有哪些線經過？`, `${eh.etfs[0].etf} 前十大是哪些？`, '今天城市怎麼了？'],
    };
  },
  station({ E }) {
    const n = E.cos[0];
    return {
      role: [`${n}站站務員`, '站', '#2e6b5e'], tools: [['etfs_holding', { name: n }]],
      scene: [['focus_lines', { lines: '停靠這站的線' }], ['ring', { station: n }], ['label', { names: [n], mode: '各線權重' }], ['fly_to', { names: [n] }]],
      act([eh]) { const ks = eh.etfs.map(x => x.etf); setMine(null); setFocus(new Set(ks)); setRings([ringForSt(n, 0xffffff)]); setLabels([[n, 'w:' + ks.join(',')]]); fitNames([n], { maxZoom: 1.9 }); },
      write([eh]) {
        const L = eh.etfs;
        if (L.length === 1) return `${n}站只有 ${L[0].etf} 經過，權重 <b>${L[0].weight.toFixed(2)}%</b>，是它的第 ${L[0].rank} 大持股。`;
        return `${n}站是${cn(L.length)}條線的轉乘站：${L.map(x => `${x.etf} <b>${x.weight.toFixed(2)}%</b>`).join('、')}。這${cn(L.length)}檔的前十大都有${n}，同時買的話，等於在這站重複買了好幾次。`;
      },
      src: '資料：前十大成分股權重',
      follow: (eh) => eh.etfs.length >= 2 ? [`${eh.etfs[0].etf} 跟 ${eh.etfs[eh.etfs.length - 1].etf} 差在哪？`, `${n}今天怎麼了？`] : [`${eh.etfs[0].etf} 前十大是哪些？`, `${n}今天怎麼了？`],
    };
  },
  compare({ E }) {
    const [a, b] = E.etfs;
    return {
      role: ROLE.guide,
      tools: [['holdings_overlap', { a, b }], ['get_holdings', { etf: a }], ['get_holdings', { etf: b }], ['get_return', { etf: a, period: '1y' }], ['get_return', { etf: b, period: '1y' }]],
      scene: [['focus_lines', { lines: [a, b] }], ['ring', { stations: '共同車站' }], ['label', { names: '共同車站與各自最大站', mode: '兩檔權重' }], ['fly_to', { names: '共同車站' }]],
      act([ov, ha, hb]) {
        setMine(null); setFocus(new Set([a, b]));
        const sh = ov.shared.slice(0, 4).map(x => x.name), tops = [ha.top10[0].name, hb.top10[0].name];
        const names = [...new Set([...tops, ...sh])];
        setRings(ov.shared.map(x => ringForSt(x.name, 0xffffff)));
        setLabels(names.map(n => [n, `w:${a},${b}`]));
        fitNames(names, { maxZoom: 1.5 });
      },
      write([ov, ha, hb, ra, rb]) {
        const ta = ha.top10[0], tb = hb.top10[0];
        let h = `${a} (${ha.type}) 和 ${b} (${hb.type}) 兩條線，`;
        if (!ov.count) h += '前十大沒有共同車站，完全不重疊。';
        else if (ov.count === 10 || ov.overlap > 60) h += `前十大${cn(ov.count)}站全部相同，重疊權重 <b>${ov.overlap.toFixed(2)}%</b>，幾乎是同一條線，同時持有兩檔，分散的效果很有限。`;
        else h += `前十大${ov.count <= 3 ? '只在' : '有'}${cn(ov.count)}站轉乘：${ov.shared.map(s => s.name).join('、')}，重疊權重 <b>${ov.overlap.toFixed(2)}%</b>。`;
        if (ta.name !== tb.name) h += `最大的差別在第一站：${a} 最大是${ta.name} <b>${ta.w.toFixed(2)}%</b>，${b} 最大是${tb.name} <b>${tb.w.toFixed(2)}%</b>${Math.max(ta.w, tb.w) > 30 ? `，${ta.w > tb.w ? b : a} 分散很多` : ''}。`;
        h += `過去一年 (${ymText(ra.from)} 到 ${ymText(ra.to)}) 價格報酬：${a} <b class="${cls(ra.ret)}">${fmtPct(ra.ret)}</b>，${b} <b class="${cls(rb.ret)}">${fmtPct(rb.ret)}</b>。`;
        h += ha.type === '高股息' || hb.type === '高股息' ? '這只算股價，配息沒有加回來；高股息 ETF 配息比較多，加回去之後差距會縮小。' : '這只算股價，配息沒有加回來。';
        return h;
      },
      src: '資料：前十大成分股權重、ETF 歷史收盤價',
      follow: () => [`每月 5000 買 ${b}，從 2020 到現在會怎樣？`, `我有 ${a} 30萬、${b} 20萬`, '什麼是收益平準金？'],
    };
  },
  etf({ E }) {
    const k = E.etfs[0];
    return {
      role: [`${k} 線站長`, '線', ETFS[k].color], tools: [['get_holdings', { etf: k }], ['get_return', { etf: k, period: '1y' }]],
      scene: [['focus_lines', { lines: [k] }], ['label', { names: '前五大', mode: '權重' }], ['fly_to', { line: k }]],
      act([h1]) { setMine(null); setFocus(new Set([k])); setRings([]); setLabels(h1.top10.slice(0, 5).map(x => [x.name, 'w:' + k])); fitNames(h1.top10.map(x => x.name), { maxZoom: 1.3 }); },
      write([h1, r]) {
        const t = h1.top10[0], bd = Object.entries(h1.by_district).sort((x, y) => y[1] - x[1])[0];
        return `${k} ${h1.name}是一條${h1.type}線，前十大經過${cn(h1.top10.length)}站，最大站是${t.name} <b>${t.w.toFixed(2)}%</b>，前十大合計 <b>${h1.top10_sum.toFixed(2)}%</b>，其餘分散在其他公司，沒有畫進城市。這條線在${bd[0]}停最多，合計 <b>${bd[1].toFixed(2)}%</b>。過去一年價格報酬 <b class="${cls(r.ret)}">${fmtPct(r.ret)}</b> (${ymText(r.from)} 到 ${ymText(r.to)}，未含息)。`;
      },
      src: '資料：前十大成分股權重、ETF 歷史收盤價',
      follow: (h1) => [`每月 5000 買 ${k}，從 2020 到現在會怎樣？`, `${k} 跟 ${k === '00878' ? '0056' : '00878'} 差在哪？`, `${h1.top10[0].name}今天怎麼了？`],
    };
  },
  replay({ E }) {
    const k = E.etfs[0] || ctx?.etf || '0050';
    const monthly = clamp(E.amounts[0] ?? (ctx?.intent === 'replay' ? ctx.monthly : 5000), 100, 10000000);
    const first = HIST[k].m[0][0], y = E.year ?? (ctx?.intent === 'replay' ? +ctx.start.slice(0, 4) : 2020);
    const start = clamp(y, 2020, 2025) + '-01' < first ? first : clamp(y, 2020, 2025) + '-01';
    return {
      role: ROLE.archive, tools: [['simulate_dca', { etf: k, monthly, start }]],
      scene: [['focus_lines', { lines: [k] }], ['replay', { etf: k, speed: '每月 0.11 秒' }], ['weather', { rain: '單月跌超過 4%', fireworks: '單月漲超過 5%' }]],
      replay: true,
      act([s], msg) { setMine(null); setFocus(new Set([k])); setRings([]); const top = ETFS[k]; setLabels(Object.entries(top.w).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => [n, 'w:' + k])); fitNames(Object.keys(top.w), { maxZoom: 1.3 }); startReplay(s, msg); },
      write([s]) {
        let h = '';
        const late = s.start !== `${clamp(y, 2020, 2025)}-01`;
        h += y < 2020 || late ? `${late ? k + ' ' : ''}資料從 ${ymText(s.start)} 才開始，所以從那個月起算：` : `從 ${ymText(s.start)} 開始，`;
        h += `每月第一個交易日買 <b>${money(s.monthly)} 元</b>的 ${k}，共買 ${s.n} 次，總共投入 <b>${money(s.invested)} 元</b>。到 ${ymText(s.end)}，市值約 <b>${money(s.value)} 元</b>，價格報酬 <b class="${cls(s.ret)}">${fmtPct(s.ret)}</b> (未含息)。`;
        h += s.worst.pnl < 0 ? `最難熬的是 ${ymText(s.worst.d)}，帳面 <b class="down">${fmtPct(s.worst.pnl)}</b>。` : '整段期間，每個月初的帳面都沒有虧損。';
        h += `單月跌最多是 ${ymText(s.max_drop.d)} (<b class="down">${fmtPct(s.max_drop.ch)}</b>)${s.max_drop.ch <= s.effects.rain_below ? '，回放到那個月時城市下了一場大雨' : ''}；`;
        h += `漲最多是 ${ymText(s.max_gain.d)} (<b class="up">${fmtPct(s.max_gain.ch)}</b>)${s.max_gain.ch >= s.effects.fireworks_above ? '，那個月頂樓放了煙火' : ''}。`;
        return h;
      },
      src: '資料：ETF 歷史收盤價，每月第一個交易日買進，可買零股，未含息與手續費',
      follow: () => [k === '0050' ? '換成 00878 呢？' : '換成 0050 呢？', `${k} 前十大是哪些？`, '回到全城'],
      ctx: { etf: k, monthly, start: `${clamp(y, 2000, 2030)}-01` },
    };
  },
  mine({ E }) {
    let amounts = Object.fromEntries(Object.entries(E.pairs).filter(([, v]) => v > 0));
    const demo = !Object.keys(amounts).length;
    if (demo) amounts = { '0050': 300000, '0056': 100000, '00878': 200000 };
    return {
      role: ROLE.guide, tools: [['lookthrough', { amounts }]],
      scene: [['show_my_city', { amounts }], ['focus_lines', { lines: Object.keys(amounts) }], ['label', { names: '你持有最多的 6 家', mode: '持有比例' }], ['fly_to', { names: '你持有最多的公司' }]],
      act([L]) { setMine(L); setFocus(new Set(Object.keys(amounts))); setRings([]); setLabels(L.top.map(x => [x.name, 'mine'])); fitNames(L.top.map(x => x.name), { maxZoom: 1.2 }); },
      write([L]) {
        const t0 = L.top[0], f0 = Object.keys(t0.from);
        let h = demo ? '你沒有給金額，我先用示範配置。' : '';
        h += `你一共投入 <b>${money(L.total)} 元</b>。把${cn(Object.keys(amounts).length)}檔 ETF 拆開來看，你實際持有最多的是${t0.name}，占 <b>${t0.share_pct.toFixed(1)}%</b>，${f0.length === 1 ? `全部來自 ${f0[0]}` : `來自 ${f0.join('、')}`}。`;
        const multi = L.top.slice(1).find(x => Object.keys(x.from).length >= 3) || L.top.slice(1).find(x => Object.keys(x.from).length >= 2);
        if (multi) { const fs = Object.keys(multi.from); h += `${multi.name} <b>${multi.share_pct.toFixed(1)}%</b> 比較特別，${fs.join('、')} ${cn(fs.length)}條線都經過它，等於${fs.length >= 3 ? '重複買了好幾次' : '買了兩次'}。`; }
        h += `前十大成分股只涵蓋你 <b>${L.covered_pct.toFixed(1)}%</b> 的錢，其餘 <b>${L.rest_pct.toFixed(1)}%</b> 分散在其他公司，沒有畫進城市。金色框越高，代表你在那棟樓持有越多。`;
        return h;
      },
      src: '資料：前十大成分股權重，結果為估計值。也可以按右上角「我的持股」輸入金額或上傳截圖。',
      follow: () => ['改成 0050 20萬、00878 40萬', '聯發科站有哪些線經過？', '回到全城'],
    };
  },
  kb({ q }) {
    return {
      role: ROLE.guide, tools: [['search_knowledge', { query: q }]],
      scene: [['focus_lines', { lines: '依文件決定' }]],
      act([k]) { setMine(null); setRings([]); const ls = k.hit && k._doc.lines.length && k._doc.lines; setFocus(ls ? new Set(ls) : null); if (ls) { const ns = [...new Set(ls.flatMap(x => Object.keys(ETFS[x].w)))]; setLabels([]); fitNames(ns, { maxZoom: 1.1 }); } },
      write([k]) {
        if (!k.hit) return '知識庫裡找不到相關的資料，所以我不亂回答。可以換個說法，或問收益平準金、折溢價、除息填息、內扣費用、市值型和高股息型的差別。';
        return k._text;
      },
      src: k => k.hit ? `來源：知識庫《${k.title}》${k._doc.source || ''}` : '來源：知識庫 (沒有命中)',
      follow: k => k.hit && k._doc.id === 'income-equalization' ? ['什麼是除息和填息？', '0056 跟 00878 差在哪？'] : ['什麼是收益平準金？', '市值型跟高股息差在哪？', '今天城市怎麼了？'],
    };
  },
  refuse({ E }) {
    const k = E.etfs[0];
    return {
      role: ROLE.guide, guard: '拒答：預測漲跌或個人投資建議', tools: k ? [['get_return', { etf: k, period: '1y' }]] : [],
      scene: k ? [['focus_lines', { lines: [k] }]] : [],
      act() { if (k) { setMine(null); setRings([]); setFocus(new Set([k])); } },
      write([r]) {
        let h = '我不會預測漲跌，也不會告訴你該不該買，這是這個系統刻意設下的規則。';
        if (r) h += `我能給你的是過去的資料：${k} 過去一年價格報酬 <b class="${cls(r.ret)}">${fmtPct(r.ret)}</b> (${ymText(r.from)} 到 ${ymText(r.to)}，未含息)，過去的表現不代表未來。`;
        return h + '想知道長期持有是什麼感覺，可以用回放，看城市怎麼走過每一次下跌。';
      },
      src: '規則：不預測、不推薦，只說明資料',
      follow: () => [`每月 5000 買 ${k || '0056'}，從 2020 到現在會怎樣？`, '什麼是除息和填息？'],
      ctx: { etf: k },
    };
  },
  time({ E, q }) {
    let h = E.hour ?? (/晚上|夜景|夜晚|天黑/.test(q) ? 20.5 : /傍晚/.test(q) ? 18 : /早上/.test(q) ? 9.5 : /中午/.test(q) ? 12.5 : 14.5);
    h = clamp(h, 8, 22);
    const night = h >= 18.5;
    return {
      role: ROLE.guide, tools: [], scene: [['set_time', { hour: hhmm(h) }]],
      act() { applyTime(h); if (night) { setLabels(defaultLabels()); } },
      write() { return night ? `切到晚上 ${hhmm(h)}。晚上最容易看出今天的行情：漲越多的大樓窗戶亮越多，跌很多的大樓會整片暗掉；路燈和車燈也都亮起來了。` : `切到 ${hhmm(h)}。白天看外觀：漲的大樓頂樓燈框是紅色，跌的是綠色，大跌的大樓搭著鷹架。`; },
      src: '城市動作：調整時間',
      follow: () => night ? ['切回白天', '今天城市怎麼了？'] : ['晚上的城市長怎樣？', '今天城市怎麼了？'],
    };
  },
  overview() {
    return {
      role: ROLE.guide, tools: [], scene: [['reset', {}], ['fly_to', { overview: true }]],
      act() { resetCity(); overview(); },
      write() { return '回到全城視角。每條彩色的線是一檔 ETF，白點是行駛中的列車；轉乘站代表兩檔以上的 ETF 都持有這家公司。'; },
      src: '城市動作：重置視角', follow: () => START_CHIPS.slice(0, 3),
    };
  },
  help({ q }) {
    const hi = /^(嗨|哈囉|你好|您好|hi|hello|hey)/i.test(q);
    return {
      role: ROLE.guide, tools: [], scene: [],
      act() {},
      write() { return (hi ? '嗨，我是城市導覽員。' : '這個問題我還聽不懂。') + '我現在會回答：今天的行情、某家公司 (例如台積電)、兩檔 ETF 比較、每月定期定額的回放、你的持股 (例如「我有 0050 30萬」)、ETF 名詞 (例如收益平準金)。也可以直接點城市裡的大樓或車站。'; },
      src: '', follow: () => START_CHIPS,
    };
  },
};

/* ================= writer check (reflection: numbers must come from tools) ================= */
function numberCheck(html, results) {
  const txt = html.replace(/<[^>]+>/g, '').replace(/「[^」]*」/g, '');
  const found = [...txt.matchAll(/([+-]?\d[\d,]*(?:\.\d+)?)\s*(%|元(?!大)|萬)/g)];
  const vals = [];
  const walk = o => { if (typeof o === 'number') vals.push(o); else if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) if (!k.startsWith('_')) walk(v); };
  results.forEach(r => { walk(r.result); walk(r.args); });
  const docText = results.map(r => (r.result && r.result._raw) || '').join(' ').replace(/,/g, '');
  const bad = [];
  for (const m of found) {
    const s = m[1].replace(/[+,]/g, ''), d = m[2] === '萬' ? 0 : (s.split('.')[1] || '').length;
    const x = (Math.abs(parseFloat(s)) * (m[2] === '萬' ? 10000 : 1)).toFixed(d);
    if (!vals.some(v => Math.abs(v).toFixed(d) === x || Math.abs(v * 100).toFixed(d) === x) && !docText.includes(s.replace(/^-/, ''))) bad.push(m[0]);
  }
  return { n: found.length, bad };
}

/* ================= chat UI ================= */
const logEl = $('log'), chipsEl = $('chips');
const START_CHIPS = ['今天城市怎麼了？', '0050 跟 00878 差在哪？', '每月 5000 買 0050，從 2020 到現在會怎樣？', '我有 0050 30萬、0056 10萬、00878 20萬', '什麼是收益平準金？', '0056 明天會漲嗎？'];
function scrollLog() { logEl.scrollTop = logEl.scrollHeight; }
function setChips(list) {
  chipsEl.innerHTML = '';
  for (const t of list) { const b = document.createElement('button'); b.type = 'button'; b.className = 'chipq'; b.textContent = t; b.addEventListener('click', () => ask(t)); chipsEl.appendChild(b); }
}
function addUser(text) {
  const d = document.createElement('div'); d.className = 'msg user';
  const b = document.createElement('div'); b.className = 'body'; b.textContent = text; d.appendChild(b);
  logEl.appendChild(d); scrollLog();
}
function addBot(role, html, src) {
  const d = document.createElement('div'); d.className = 'msg bot';
  d.innerHTML = `<div class="who"><i style="background:${role[2]}">${role[1]}</i>${role[0]}</div><div class="body"></div>`;
  d.querySelector('.body').innerHTML = html + (src ? `<div class="src">${src}</div>` : '');
  logEl.appendChild(d); scrollLog(); return d;
}
function addTyping() { const d = document.createElement('div'); d.className = 'msg bot'; d.innerHTML = '<div class="body typing" aria-label="思考中"><i></i><i></i><i></i></div>'; logEl.appendChild(d); scrollLog(); return d; }
function slim(o, depth = 0) {
  if (Array.isArray(o)) { const a = o.slice(0, depth ? 4 : 6).map(x => slim(x, depth + 1)); if (o.length > a.length) a.push(`…共 ${o.length} 筆`); return a; }
  if (o && typeof o === 'object') { const r = {}; for (const [k, v] of Object.entries(o)) if (!k.startsWith('_')) r[k] = slim(v, depth + 1); return r; }
  if (typeof o === 'string' && o.length > 48) return o.slice(0, 48) + '…';
  return o;
}
function traceEl(planJson, results, scene, role, check) {
  const d = document.createElement('details'); d.className = 'trace';
  const sum = document.createElement('summary'); sum.textContent = 'Agent 執行過程'; d.appendChild(sum);
  const step = (title, body, html) => { const s = document.createElement('div'); s.className = 'step'; s.innerHTML = `<b>${title}</b>`; if (body != null) { const p = document.createElement('pre'); p.textContent = body; s.appendChild(p); } if (html) s.insertAdjacentHTML('beforeend', html); d.appendChild(s); };
  step('離線示範模式', null, '<div>沒有連上後端，這題由瀏覽器裡的規則版 Agent 回答；連上後端後改由 LLM 規劃與撰寫，數字一樣由程式計算。</div>');
  step('① 規劃 Planner', '{\n' + Object.entries(planJson).map(([k, v]) => ` "${k}": ${JSON.stringify(v)}`).join(',\n') + '\n}');
  step('② 執行工具', results.length ? results.map(r => `${r.name}(${JSON.stringify(r.args)})\n→ ${JSON.stringify(slim(r.result))}`).join('\n\n') : '(這題不需要資料工具)');
  step('③ 城市動作', scene.length ? scene.map(([n, a]) => `${n}(${JSON.stringify(a)})`).join('\n') : '(無)');
  step('④ 撰寫 Writer', null, `<div>角色：${role[0]}。只能使用上面的工具結果。</div>`);
  step('⑤ 數字檢查', null, check.n ? (check.bad.length ? `<div>未通過：${check.bad.join('、')} 找不到來源，正式版會退回重寫。</div>` : `<div><span class="ok">通過</span> 答案裡 ${check.n} 個金額或百分比，都能在工具結果找到。</div>`) : '<div>答案沒有金額或百分比，略過。</div>');
  return d;
}
let busy = false;
async function ask(q) {
  q = (q || '').trim(); if (!q || busy) return;
  if (replay) finishReplay(true);
  $('hud').hidden = true;
  busy = true; $('send').disabled = true; $('q').value = '';
  addUser(q); setChips([]);
  const typing = addTyping();
  if (online && await askApi(q, typing)) { busy = false; $('send').disabled = false; return; }
  const P = planner(q), Hd = HANDLERS[P.intent](P);
  await sleep(reduce ? 60 : 650);
  typing.remove();
  if (Hd.pre) Hd.pre();
  const results = Hd.tools.map(([name, args]) => ({ name, args, result: TOOLS[name](args) }));
  const R = results.map(r => r.result);
  const html = Hd.write(R), check = numberCheck(html, results);
  const planJson = { intent: P.intent, entities: Object.fromEntries(Object.entries({ etfs: P.E.etfs, companies: P.E.cos, amounts: P.E.amounts, year: P.E.year, hour: P.E.hour }).filter(([, v]) => v != null && (!Array.isArray(v) || v.length))), ...(Hd.guard ? { guardrail: Hd.guard } : {}), tools: Hd.tools.map(([name, args]) => ({ name, args })), scene: Hd.scene.map(([n]) => n) };
  const src = typeof Hd.src === 'function' ? Hd.src(...R) : Hd.src;
  const msg = addBot(Hd.role, Hd.replay ? `<span class="note">回放中，看城市怎麼走過這幾年…</span>` : html, Hd.replay ? '' : src);
  msg.appendChild(traceEl(planJson, results, Hd.scene, Hd.role, check));
  const follow = Hd.follow(...R);
  if (Hd.replay) msg._final = { html, src, follow };
  Hd.act(R, msg);
  ctx = { intent: P.intent, ...(Hd.ctx || {}) };
  if (!Hd.replay) setChips(follow);
  scrollLog();
  busy = false; $('send').disabled = false;
}
$('ask').addEventListener('submit', e => { e.preventDefault(); ask($('q').value); });

/* ---------- replay ---------- */
function startReplay(sim, msg) {
  const S = sim._series, k = sim.etf;
  replay = { k, sim, S, i: 0, acc: 0.3, step: reduce ? 0.02 : 0.11, msg, maxV: Math.max(...S.map(s => Math.max(s.val, s.inv))), top: Object.entries(ETFS[k].w).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n) };
  for (const b of Object.values(B)) b.fx.visible = false;
  $('hudTitle').textContent = `每月 ${money(sim.monthly)} 元買 ${k}`;
  $('hud').hidden = false; drawHud(-1);
}
function drawHud(upto) {
  const R = replay, cv = $('hudChart'), g = cv.getContext('2d'), W = cv.width, Hh = cv.height, S = R.S;
  g.clearRect(0, 0, W, Hh);
  const x = i => i / (S.length - 1) * (W - 4) + 2, y = v => Hh - 6 - v / R.maxV * (Hh - 14);
  const line = (key, col, dash) => { g.setLineDash(dash); g.strokeStyle = col; g.lineWidth = 4; g.beginPath(); for (let i = 0; i <= upto; i++) { i ? g.lineTo(x(i), y(S[i][key])) : g.moveTo(x(i), y(S[i][key])); } g.stroke(); };
  if (upto < 0) return;
  const s = S[upto], c = s.val >= s.inv ? tok('--up') : tok('--down');
  line('inv', tok('--muted'), [8, 6]); line('val', c, []);
  g.setLineDash([]); g.fillStyle = c; g.beginPath(); g.arc(x(upto), y(s.val), 6, 0, Math.PI * 2); g.fill();
  $('hudLeg').style.color = c;
}
function replayStep() {
  const R = replay, s = R.S[R.i];
  $('hudDate').textContent = ymText(s.d);
  $('hudIn').textContent = money(s.inv) + ' 元';
  const v = $('hudVal'); v.textContent = `${money(s.val)} 元 (${fmtPct((s.val / s.inv - 1) * 100)})`; v.className = 'val ' + cls(s.val - s.inv);
  drawHud(R.i);
  if (s.ch != null) {
    const pct = s.ch * 100;
    for (const n of Object.keys(ETFS[R.k].w)) paintCrown(B[n], pct);
    const wet = pct <= -4;
    if (wet !== weather.rain) { weather.rain = wet; rain.visible = wet; applyTime(timeH); }
    if (pct >= 5 && !reduce) for (const n of R.top) { const b = B[n], p = b.group.position; spawnBurst(p.x, p.y + b.topY + 5, p.z); spawnBurst(p.x + 1.5, p.y + b.topY + 7, p.z - 1); }
  }
  R.i++;
  if (R.i >= R.S.length) finishReplay(false);
}
function finishReplay(skipped) {
  const R = replay; if (!R) return; replay = null;
  if (skipped) { const s = R.S.at(-1); $('hudDate').textContent = ymText(s.d); }
  for (const b of Object.values(B)) { b.fx.visible = true; paintCrown(b, chg[b.c.name]); }
  weather.rain = idxNow <= RULES.rain_below; rain.visible = weather.rain; applyTime(timeH);
  const f = R.msg._final, body = R.msg.querySelector('.body');
  body.innerHTML = f.html + `<div class="src">${f.src}</div>`;
  if (!skipped) setChips(f.follow);
  scrollLog();
}

__API_PART__
/* ---------- settings ---------- */
const setBtn = $('setBtn'), setPanel = $('settings');
function toggleSettings(open) { setPanel.hidden = !open; setBtn.setAttribute('aria-expanded', String(open)); }
setBtn.addEventListener('click', () => toggleSettings(setPanel.hidden));
addEventListener('keydown', e => { if (e.key === 'Escape') toggleSettings(false); });
if (!REAL) $('scn-real').hidden = true;
document.querySelectorAll('[data-scn]').forEach(bt => bt.addEventListener('click', () => { applyScenario(bt.dataset.scn); if (!labelSet.size || [...labelSet.values()].every(m => m === 'chg')) setLabels(defaultLabels()); }));
$('time').addEventListener('input', e => applyTime(Number(e.target.value)));
$('allLabels').addEventListener('change', e => { allLabels = e.target.checked; refreshLabels(); });

/* ---------- picking ---------- */
const ray = new THREE.Raycaster(), ptr = new THREE.Vector2();
let downAt = null;
renderer.domElement.addEventListener('pointerdown', e => { downAt = [e.clientX, e.clientY]; if (!setPanel.hidden) toggleSettings(false); });
renderer.domElement.addEventListener('pointerup', e => {
  if (!downAt || Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) > 6) return;
  ptr.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  const hit = ray.intersectObjects(pickables, false)[0];
  if (!hit) return;
  if (hit.object.userData.station) ask(`${hit.object.userData.station}站有哪些線經過？`);
  else ask(`${hit.object.userData.company}今天怎麼了？`);
});
renderer.domElement.addEventListener('pointermove', e => {
  if (e.buttons) return;
  ptr.set(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ptr, camera);
  renderer.domElement.style.cursor = ray.intersectObjects(pickables, false).length ? 'pointer' : 'grab';
});

/* ---------- label layout: keep labels from covering each other ---------- */
const _v = new THREE.Vector3();
function placeLabels(ls) {
  const wpp = VIEW / (innerHeight * camera.zoom), items = [];
  for (const b of Object.values(B)) if (b.label.visible) {
    const h = b.label.userData.h || 66, sy = h / 34 * ls, y0 = b.topY + 0.6 + sy / 2;
    b.label.scale.set(190 / 34 * ls, sy, 1);
    _v.set(b.group.position.x, b.group.position.y + y0, b.group.position.z).project(camera);
    items.push({ b, y0, px: (_v.x + 1) / 2 * innerWidth, py: (1 - _v.y) / 2 * innerHeight, w: 190 / 34 * ls / wpp, hh: sy / wpp });
  }
  items.sort((a, b) => b.py - a.py);
  const placed = [];
  for (const it of items) {
    let py = it.py;
    for (let pass = 0; pass < 3; pass++) for (const o of placed) if (Math.abs(it.px - o.px) < (it.w + o.w) / 2 - 6 && Math.abs(py - o.py) < (it.hh + o.hh) / 2 + 2) py = o.py - (it.hh + o.hh) / 2 - 2;
    const lift = (it.py - py) * wpp / 0.92;
    it.b.label.position.set(0, it.y0 + lift, 0); it.py = py; placed.push(it);
  }
}

/* ---------- loop ---------- */
const clock = new THREE.Clock();
function tick() {
  const dt = Math.min(clock.getDelta(), 0.05), T = clock.elapsedTime;
  if (fly) {
    fly.t += dt; const u = clamp(fly.t / fly.dur, 0, 1), k = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
    controls.target.lerpVectors(fly.fromT, fly.toT, k); camera.position.copy(controls.target).add(fly.off);
    camera.zoom = lerp(fly.fromZ, fly.toZ, k); camera.updateProjectionMatrix();
    if (u >= 1) fly = null;
  }
  controls.update();
  const ls = (DESK() ? 135 : 96) * VIEW / (190 / 34 * innerHeight * camera.zoom);
  placeLabels(ls);
  for (const m of ringG.children) if (m.userData.pulse) { const f = ((T * 0.6 + m.userData.ph) % 1); m.scale.set(1 + f * 0.7, 1 + f * 0.7, 1); m.material.opacity = 0.85 * (1 - f); }
  if (replay) { replay.acc += dt; while (replay && replay.acc >= replay.step) { replay.acc -= replay.step; replayStep(); } }
  if (!reduce) {
    for (const L of Object.values(LINES)) for (const p of L.pulses) {
      p.userData.t = (p.userData.t + dt * 0.035) % 1;
      const f = p.userData.t * (L.sample.length - 1), i = Math.floor(f);
      p.position.copy(L.sample[i]).lerp(L.sample[Math.min(i + 1, L.sample.length - 1)], f - i).setY(0.62);
    }
    for (const car of cars) {
      const u = car.userData; u.t += u.dir * u.speed * dt; if (u.t > 75) u.t = -75; if (u.t < -75) u.t = 75;
      if (u.ns) car.position.set(u.lane, 0.08, u.t); else car.position.set(Math.min(u.t, 26) - 30, 0.08, 1 + u.lane);
    }
    if (rain.visible) {
      const a = rain.geometry.attributes.position.array;
      for (let i = 0; i < RAIN_N; i++) { const o = i * 6; let y = a[o + 1] - 55 * dt; if (y < 0) y += 70; a[o + 1] = y; a[o + 4] = y - 1.3; }
      rain.geometry.attributes.position.needsUpdate = true;
    }
    if (!replay) for (const b of Object.values(B)) if (b.boom) {
      b.nextBurst -= dt;
      if (b.nextBurst <= 0) { const p = b.group.position; spawnBurst(p.x + (Math.random() - 0.5) * 3, p.y + b.topY + 5 + Math.random() * 4, p.z + (Math.random() - 0.5) * 3); b.nextBurst = 0.9 + Math.random() * 1.4; }
    }
    for (let i = bursts.length - 1; i >= 0; i--) {
      const bu = bursts[i]; bu.life += dt;
      const a = bu.p.geometry.attributes.position.array;
      bu.vel.forEach((v, j) => { v.y -= 4.5 * dt; v.multiplyScalar(0.985); a[j * 3] += v.x * dt; a[j * 3 + 1] += v.y * dt; a[j * 3 + 2] += v.z * dt; });
      bu.p.geometry.attributes.position.needsUpdate = true;
      bu.p.material.opacity = Math.max(0, 1 - bu.life / 1.6);
      if (bu.life > 1.6) { scene.remove(bu.p); bu.p.geometry.dispose(); bu.p.material.dispose(); bursts.splice(i, 1); }
    }
    for (const b of Object.values(B)) if (b.crane) b.crane.rotation.y += dt * 0.08;
  }
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
addEventListener('resize', layoutView);

/* ---------- boot ---------- */
controls.minZoom = 0.35; controls.maxZoom = 4;
layoutView();
applyScenario(REAL ? 'real' : 'mixed');
resetCity();
{ overview(); fly.t = fly.dur; }
addBot(ROLE.guide, '歡迎來到 ETF 都會。這座城市把 ETF 畫成捷運：每條彩色路線是一檔 ETF，車站是它的前十大成分股，兩條線都停的站就是<b>轉乘站</b> (重疊持股)。大樓越高，代表在 ETF 裡的權重越大；今天的漲跌決定大樓的樣子，漲越多燈越亮，大跌會龜裂、搭鷹架。直接問我，城市會跟著你的問題移動。' +
  `<div class="lg">${Object.entries(ETFS).map(([k, e]) => `<span style="--c:${e.color}">${k} ${e.name}</span>`).join('')}</div>`,
  '本系統只說明資料，不提供投資建議，也不預測漲跌。報酬是價格報酬 (未含息)，持股只計前十大。');
setChips(START_CHIPS);
$('dataNote').textContent = `成分股為前十大 (${CITY.holdings_meta && CITY.holdings_meta.as_of ? '資料日 ' + CITY.holdings_meta.as_of : '初始資料'})；ETF 價格到 ${Object.values(CITY.prices_as_of || {})[0] || ''}，報酬為價格報酬 (未含息)。` + (REAL ? `個股漲跌為 ${CITY.daily.date} 收盤行情。` : '個股今日漲跌目前是示意行情。');
initApi();
window.__ready = true;
window.__city = { get online() { return online; }, connectApi, runScene, ask, planner, extract, TOOLS, numberCheck, get busy() { return busy; }, get replaying() { return !!replay; }, fastReplay() { if (replay) replay.step = 0.001; }, screenOf(n, y = 6) { const c = CO[n]; _v.set(c.pos[0], y, c.pos[1]).project(camera); return [(_v.x + 1) / 2 * innerWidth, (1 - _v.y) / 2 * innerHeight]; } };
tick();
