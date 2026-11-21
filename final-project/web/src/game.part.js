
/* ================= 遊戲：路人聊新聞、ETF 集章卡、今日任務 =================
   聊天內容：新聞標題 (FinMind，只用標題、來源與連結) 與知識庫名詞；數字都來自資料，不預測、不建議 */
var GAME_ON = false;
const NEWS = (CITY.news && CITY.news.items) || {};
const NEWS_NOTE = `新聞標題整理自 FinMind${CITY.news && CITY.news.date ? ' (' + CITY.news.date + ')' : ''}，版權屬各家媒體；只是聊天話題，不代表本系統看法，也不是投資建議。`;
function newsHtml(it) {
  const d = (it.date || '').slice(5, 10).replace('-', '/');
  return `<q>${esc(it.title)}</q> <span class="nsrc">${esc(it.source)}${d ? '｜' + d : ''}</span>${it.link && /^https?:\/\//.test(it.link) ? ` <a href="${esc(it.link)}" target="_blank" rel="noopener noreferrer">看原文</a>` : ''}`;
}

/* ---------- 進度 (存在這台瀏覽器) ---------- */
const SAVE_KEY = 'etfcity.game.v1';
const GS = (() => { let s = null; try { s = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) {} return Object.assign({ visited: {}, chats: 0, asks: 0, ride: 0, done: {}, track: null, today: null, todayHit: [] }, s || {}); })();
const saveGame = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(GS)); } catch (e) {} };
const TODAY_KEY = REAL ? CITY.daily.date : 'demo';
if (GS.today !== TODAY_KEY) { GS.today = TODAY_KEY; GS.todayHit = []; delete GS.done.today; }
const ETF_TOP = Object.fromEntries(ETF_KEYS.map(k => [k, Object.keys(ETFS[k].w).filter(n => CO[n] && CO[n].front).sort((a, b) => ETFS[k].w[b] - ETFS[k].w[a])]));
const TODAY = (() => { const ns = Object.keys(chg).filter(n => CO[n] && CO[n].front); ns.sort((a, b) => chg[b] - chg[a]); return { up: ns[0], down: ns.at(-1) }; })();
const RIDE_GOAL = Math.round(LAY.P);
function quests() {
  const qs = ETF_KEYS.map(k => ({ id: 'etf:' + k, etf: k, title: `${k} 集章卡`, sub: `走到 ${ETFS[k].name}前十大的 ${ETF_TOP[k].length} 家店門口蓋章`, color: ETFS[k].color, n: ETF_TOP[k].length, have: (GS.visited[k] || []).filter(n => ETF_TOP[k].includes(n)).length, targets: ETF_TOP[k].filter(n => !(GS.visited[k] || []).includes(n)) }));
  qs.push({ id: 'today', title: '今日任務', sub: `去看今天漲跌幅最高的${TODAY.up}和最低的${TODAY.down}`, color: '#b88407', n: 2, have: GS.todayHit.length, targets: [TODAY.up, TODAY.down].filter(n => !GS.todayHit.includes(n)) });
  qs.push({ id: 'chat', title: '街頭記者', sub: '和 5 位路人聊天，聽他們聊最近的新聞', color: '#2e6b5e', n: 5, have: Math.min(5, GS.chats) });
  qs.push({ id: 'ask', title: '好奇寶寶', sub: '問城市導覽員 3 個問題', color: '#435369', n: 3, have: Math.min(3, GS.asks) });
  qs.push({ id: 'ride', title: '滑板車環城', sub: `騎滑板車繞商店街一圈 (${RIDE_GOAL} 公尺)`, color: '#18b3a0', n: RIDE_GOAL, have: Math.min(RIDE_GOAL, Math.round(GS.ride)), unit: ' 公尺' });
  return qs;
}

/* ---------- 提示訊息 ---------- */
let toastT = null;
function toast(html, ms = 2600) {
  const el = $('toast'); el.innerHTML = html; el.hidden = false; el.classList.remove('out');
  clearTimeout(toastT); toastT = setTimeout(() => { el.classList.add('out'); setTimeout(() => { el.hidden = true; }, 400); }, ms);
}

/* ---------- 任務面板與追蹤 ---------- */
function toggleQuests(open) {
  const el = $('questDlg'); const show = open ?? el.hidden; el.hidden = !show; if (show) renderQuests();
}
function renderQuests() {
  const el = $('questList'); if (!el) return;
  const qs = quests(), stamps = Object.values(GS.visited).reduce((a, v) => a + v.length, 0);
  $('questSum').textContent = `已蓋 ${stamps} 個章，完成 ${Object.keys(GS.done).length} 個任務`;
  el.innerHTML = qs.map(q => {
    const done = q.have >= q.n, pct = Math.round(q.have / q.n * 100), tr = GS.track === q.id;
    return `<div class="q${done ? ' done' : ''}" style="--c:${q.color}"><div class="qh"><b>${q.title}</b><span>${done ? '完成' : `${q.have} / ${q.n}${q.unit || ''}`}</span></div>
      <div class="note">${q.sub}</div><div class="bar"><i style="width:${pct}%"></i></div>
      ${q.targets && !done ? `<button type="button" class="icon-btn" data-track="${q.id}" aria-pressed="${tr}">${tr ? '追蹤中' : '追蹤'}</button>` : ''}</div>`;
  }).join('');
  el.querySelectorAll('[data-track]').forEach(b => b.onclick = () => { setTrack(GS.track === b.dataset.track ? null : b.dataset.track); renderQuests(); });
}
function trackedQuest() { return GS.track ? quests().find(q => q.id === GS.track) : null; }
function setTrack(id) {
  GS.track = id; saveGame();
  const q = trackedQuest();
  setQuestMarks(new Set(q && q.targets ? q.targets : []));
  if (q && q.etf) setFocus(new Set([q.etf]));
  else if (!q && focusLines && focusLines.size === 1) setFocus(null);
  renderTracker();
}
function renderTracker() {
  const el = $('tracker'), q = trackedQuest();
  if (!q || !q.targets || !q.targets.length) { el.hidden = true; return; }
  let best = null, bd = 1e9; for (const n of q.targets) { const c = CO[n]; const d = Math.hypot(c.door[0] - ME.x, c.door[1] - ME.z); if (d < bd) { bd = d; best = n; } }
  el.innerHTML = `<span class="dot" style="background:${q.color}"></span><b>${q.title}</b> ${q.have}/${q.n}<span class="sep">｜</span>下一家：<b>${best}</b> ${Math.round(bd)} 公尺<span class="go">${TOUCH ? '點我帶路' : '點我帶路'}</span>`;
  el.hidden = false; el.dataset.target = best;
}

/* ---------- 蓋章 ---------- */
function stamp(name) {
  const c = CO[name], got = [];
  for (const k of c.etfs) { const v = GS.visited[k] || (GS.visited[k] = []); if (!v.includes(name)) { v.push(name); got.push(k); } }
  let today = false; if ((name === TODAY.up || name === TODAY.down) && !GS.todayHit.includes(name)) { GS.todayHit.push(name); today = true; }
  if (!got.length && !today) return;
  saveGame();
  const [x, z] = worldOf(c, 0, -1); if (!reduce) { spawnBurst(x, B[name].H + 4, z); spawnBurst(x + 1.5, B[name].H + 6, z); }
  let msg = `<b>蓋章！</b>${name}`;
  if (got.length) msg += `：${got.join('、')} 集章卡`;
  if (today) msg += `${got.length ? '，' : '：'}今日任務 +1`;
  if (got.length >= 2) msg += `<div class="note">同一家店蓋了 ${got.length} 張卡，代表這 ${got.length} 檔 ETF 的前十大都有它 (重疊持股)。</div>`;
  toast(msg, got.length >= 2 ? 4200 : 2600);
  for (const k of got) if (GS.visited[k].filter(n => ETF_TOP[k].includes(n)).length >= ETF_TOP[k].length && !GS.done['etf:' + k]) completeCard(k);
  if (today && GS.todayHit.length >= 2 && !GS.done.today) completeQuest('today', `今日任務完成！今天漲跌幅最高的是${TODAY.up} (<b class="${cls(chg[TODAY.up])}">${fmtPct(chg[TODAY.up])}</b>)，最低的是${TODAY.down} (<b class="${cls(chg[TODAY.down])}">${fmtPct(chg[TODAY.down])}</b>)${scenarioKey === 'real' ? '' : ' (示意行情)'}。一天的漲跌不代表公司好壞，只是當天的價格變化。`);
  if (GS.track) setTrack(GS.track);
  if (!$('questDlg').hidden) renderQuests();
}
function completeCard(k) {
  GS.done['etf:' + k] = Date.now(); saveGame();
  const names = ETF_TOP[k], w = ETFS[k].w, sum = names.reduce((a, n) => a + w[n], 0), top = names[0];
  const streets = [...new Set(names.map(n => DIST[CO[n].d].name))], shared = names.filter(n => CO[n].etfs.length >= 2);
  const html = `集章卡完成！你走完了 ${k} ${ETFS[k].name}前十大的 ${names.length} 家店。這 ${names.length} 家合計占 ${k} 的 <b>${sum.toFixed(2)}%</b>，其中${top}一家就占 <b>${w[top].toFixed(2)}%</b>。這些店分布在${streets.join('、')}。` +
    (shared.length ? `其中 ${shared.length} 家也在別檔 ETF 的前十大 (櫥窗不只一張貼紙)，同時買這幾檔就會重複持有。` : '') + `前十大以外的 <b>${(100 - sum).toFixed(2)}%</b> 分散在其他公司。`;
  addBot([`${k} 導覽員`, '線', ETFS[k].color], html, '資料：前十大成分股權重' + (CITY.holdings_meta && CITY.holdings_meta.as_of ? ` (${CITY.holdings_meta.as_of})` : ''));
  toast(`<b>${k} 集章卡完成！</b>看右邊的總結`, 3500);
  if (GS.track === 'etf:' + k) setTrack(null);
}
function completeQuest(id, html) {
  GS.done[id] = Date.now(); saveGame(); addBot(ROLE.guide, html, '');
  toast(`<b>任務完成！</b>${quests().find(q => q.id === id).title}`, 3000);
  if (GS.track === id) setTrack(null);
}
function gameOnAsk() {
  GS.asks++; saveGame();
  if (GS.asks >= 3 && !GS.done.ask) completeQuest('ask', '「好奇寶寶」完成！你已經問了 3 個問題。每個回答底下的「Agent 執行過程」可以看到 Agent 怎麼規劃、用了哪些資料工具，以及數字檢查的結果。');
}

/* ---------- 路人聊天 ---------- */
let TALK = null; const talked = new Set();
const GREET = ['嗨！', '欸，', '哈囉，', '你好！', '同學，'];
function topicsFor(i) {
  const w = WALKERS[i], p = w.p || ringPt(w.s, w.off), has = Object.keys(NEWS).filter(n => CO[n] && CO[n].front);
  const near = has.map(n => ({ n, d: Math.hypot(CO[n].door[0] - p.x, CO[n].door[1] - p.z) })).sort((a, b) => a.d - b.d).slice(0, 4).map(o => o.n);
  const hot = has.slice().sort((a, b) => Math.abs(chg[b] ?? 0) - Math.abs(chg[a] ?? 0)).slice(0, 3);
  const news = [...new Set([...near, ...hot])].flatMap(n => NEWS[n].slice(0, 2).map(it => ({ type: 'news', n, it })));
  const kb = (CITY.kb || []).filter(d => d.summary).map(d => ({ type: 'kb', d }));
  const out = []; let a = 0, b = hashStr(w.name) % Math.max(1, kb.length);
  while (a < news.length || (out.length < 6 && kb.length)) { if (a < news.length) out.push(news[a++]); if (a < news.length) out.push(news[a++]); if (kb.length) out.push(kb[b++ % kb.length]); if (out.length > 14) break; }
  return out.length ? out : [{ type: 'kb', d: { title: 'ETF', summary: '一籃子股票打包成一檔基金，在交易所像股票一樣買賣。' } }];
}
function openTalk(i) {
  closeCard(); CHAT = { walker: i }; TALK = { i, topics: topicsFor(i), k: 0 };
  if (!talked.has(i)) { talked.add(i); GS.chats++; saveGame(); if (GS.chats >= 5 && !GS.done.chat) completeQuest('chat', '「街頭記者」完成！你和 5 位路人聊過了。新聞標題只是話題，想知道某家公司的資料，可以直接問店長或城市導覽員。'); }
  $('near').hidden = true; renderTalk();
}
function closeTalk() { TALK = null; CHAT = null; const el = $('talk'); if (el) el.hidden = true; }
function renderTalk() {
  const el = $('talk'), w = WALKERS[TALK.i], t = TALK.topics[TALK.k % TALK.topics.length], g = GREET[(TALK.i + TALK.k) % GREET.length];
  let body = '', acts = [];
  if (t.type === 'news') {
    const c = CO[t.n], v = chg[t.n] ?? 0, d = Math.round(Math.hypot(c.door[0] - ME.x, c.door[1] - ME.z));
    body = `${g}你有看到這則新聞嗎？<div class="nq">${newsHtml(t.it)}</div>這是<b>${c.name}</b>的新聞，它的店在${DIST[c.d].name}，${d < 25 ? '就在附近' : `離這裡大約 ${d} 公尺`}，今天 <b class="${cls(v)}">${fmtPct(v)}</b>${scenarioKey === 'real' ? '' : ' (示意行情)'}。` + (c.etfs.length ? `它在 ${c.etfs.join('、')} 的前十大裡。` : '');
    acts = [['帶我去', () => { closeTalk(); walkToStore(t.n, { card: true, fast: d > 60 }); }], ['問店長', () => { closeTalk(); ask(`${t.n}今天怎麼了？`); }]];
  } else {
    body = `${g}你知道「${esc(t.d.title.replace(/^什麼是\s*/, ''))}」是什麼嗎？${esc(t.d.summary)}`;
    acts = [['再多說一點', () => { closeTalk(); ask(`什麼是${t.d.title.replace(/^什麼是\s*/, '')}？`); }]];
  }
  acts.push(['換一則', () => { TALK.k++; renderTalk(); }], ['掰掰', closeTalk]);
  el.innerHTML = `<div class="th"><span class="av" style="background:#${SHIRTS[TALK.i % SHIRTS.length].getHexString()}"></span><b>${w.name}</b><span class="note">路人</span></div><div class="tb">${body}</div>
    <div class="ta">${acts.map((a, j) => `<button type="button" class="${j === 0 ? 'primary' : 'icon-btn'}" data-a="${j}">${a[0]}</button>`).join('')}</div>
    <div class="note">${t.type === 'news' ? NEWS_NOTE : '名詞解釋來自 ETF 入門知識庫。'}</div>`;
  el.hidden = false;
  el.querySelectorAll('[data-a]').forEach(b => b.onclick = () => acts[+b.dataset.a][1]());
}

/* ---------- 每一格的遊戲更新 (由 worldUpdate 呼叫) ---------- */
let gT = 0, lastPos = [ME.x, ME.z];
function gameUpdate(dt) {
  if (ME.ride) { GS.ride += Math.hypot(ME.x - lastPos[0], ME.z - lastPos[1]); if (GS.ride >= RIDE_GOAL && !GS.done.ride) completeQuest('ride', `「滑板車環城」完成！商店街一圈 ${RIDE_GOAL} 公尺，沿路經過 ${Object.values(CO).filter(c => c.front).length} 家公司的店。`); }
  lastPos = [ME.x, ME.z];
  if (TALK) { const w = WALKERS[TALK.i]; if (!w.p || Math.hypot(w.p.x - ME.x, w.p.z - ME.z) > 6) closeTalk(); }
  const now = performance.now(); if (now - gT < 300) return; gT = now;   // 用真實時間計時，畫面卡頓時也會照常檢查
  const st = nearestStore();
  if (st && !ME.auto) { const c = CO[st]; if (Math.hypot(ME.x - c.door[0], ME.z - c.door[1]) < 7.5) stamp(st); }
  if (GS.track) renderTracker();
  if (Math.random() < 0.05) saveGame();
}

/* ---------- 介面 ---------- */
$('questBtn').onclick = () => toggleQuests();
$('questClose').onclick = () => toggleQuests(false);
$('tracker').onclick = () => { const n = $('tracker').dataset.target; if (n) walkToStore(n, { card: true, fast: true }); };
if (GS.track) setTrack(GS.track);
GAME_ON = true;
// 測試用
Object.assign(window.__city, { game: () => JSON.parse(JSON.stringify(GS)), walker: i => { const w = WALKERS[i]; return w.p ? { x: w.p.x, z: w.p.z, yaw: w.yaw, name: w.name } : null; }, talk: i => openTalk(i), quests: o => toggleQuests(o), track: id => setTrack(id), today: () => TODAY, resetGame: () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} } });
