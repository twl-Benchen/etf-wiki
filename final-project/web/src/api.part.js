/* ================= 後端連線：連上時問答交給後端的 LLM Agent，畫面動作由這裡執行 ================= */
let online = false, API = '', apiCtx = null, apiInfo = null;
const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k); } catch (e) {} } };
async function fetchJson(url, opt = {}, ms = 45000) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
  try {
    const r = await fetch(url, { ...opt, signal: ctl.signal });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}
function setMode() {
  const sub = $('modeTxt');
  if (sub) sub.textContent = online ? `已連線後端｜${apiInfo && apiInfo.llm === 'groq' ? 'LLM Agent' : '規則版 Agent (後端未設定金鑰)'}` : '離線示範｜瀏覽器內的規則版 Agent';
  const st = $('apiState'); if (st) st.textContent = online ? `已連線：${API}` : API ? `連不上：${API}` : '未設定，使用離線示範模式';
  const pb = $('pfParse'); if (pb) pb.disabled = !online;
}
async function connectApi(url) {
  API = (url || '').trim().replace(/\/+$/, ''); online = false; apiInfo = null;
  if (API && !/^https?:\/\//.test(API)) API = 'https://' + API;
  if (API) {
    try { apiInfo = await fetchJson(API + '/api/health', {}, 6000); online = !!apiInfo.ok; } catch (e) { online = false; }
  }
  LS.set('etfcity.api', API); setMode(); return online;
}
function initApi() {
  const qs = new URLSearchParams(location.search).get('api');
  const url = qs ?? LS.get('etfcity.api') ?? (CITY.api_default || '');
  if ($('apiUrl')) $('apiUrl').value = url;
  setMode();
  if (url) connectApi(url);
}

/* ---------- 後端回答的呈現 ---------- */
function roleTuple(r) {
  const o = r.role || {};
  return [o.name || '城市導覽員', o.icon || '導', o.color || (o.etf && ETFS[o.etf] ? ETFS[o.etf].color : '#435369')];
}
function highlightFacts(answer, r) {
  let h = esc(answer);
  for (const id of (r.check && r.check.used) || []) {
    const f = r.facts[id]; if (!f) continue;
    const t = esc(f.text), i = h.indexOf(t); if (i < 0 || h.slice(Math.max(0, i - 3), i).includes('<b')) continue;
    const c = f.unit === 'pct_signed' ? cls(f.value) : '';
    h = h.slice(0, i) + `<b class="${c}" title="${esc(f.label)}｜來源：${esc(f.source || '')}">${t}</b>` + h.slice(i + t.length);
  }
  return h;
}
function apiTrace(r) {
  const d = document.createElement('details'); d.className = 'trace';
  d.innerHTML = '<summary>Agent 執行過程</summary>';
  const step = (title, body, html) => { const s = document.createElement('div'); s.className = 'step'; s.innerHTML = `<b>${title}</b>`; if (body != null) { const p = document.createElement('pre'); p.textContent = body; s.appendChild(p); } if (html) s.insertAdjacentHTML('beforeend', html); d.appendChild(s); };
  const p = r.trace && r.trace.planner || {}, w = r.trace && r.trace.writer || {};
  step('① 規劃 Planner', JSON.stringify(r.plan, null, 1), `<div>${p.fallback ? '由規則版 Planner 規劃' + (p.attempts ? ' (LLM 的計畫沒有通過驗證)' : '') : `由 ${esc(p.by || 'LLM')} 規劃，已通過 Pydantic 驗證`}${p.guard ? '；規則守門判定為拒答' : ''}</div>`);
  step('② 執行工具', r.tool_results.length ? r.tool_results.map(t => `${t.name}(${JSON.stringify(t.args)})${t.ok ? '' : '\n  錯誤：' + t.error}${t.note ? '\n  註：' + t.note : ''}`).join('\n') : '(這題不需要資料工具)');
  const facts = Object.entries(r.facts || {});
  step('③ 有編號的數字', facts.length ? facts.map(([k, f]) => `{${k}} = ${f.text}  ← ${f.label}`).join('\n') : '(沒有)');
  step('④ Writer 草稿', (w.attempts || []).map((a, i) => `【第 ${i + 1} 版｜${a.by}】${a.ok ? '通過' : '未通過：' + (a.message || a.error || '')}\n${a.draft || ''}`).join('\n\n') || '(無)');
  const c = r.check || {};
  step('⑤ 數字填入與檢查', null, c.ok ? `<div><span class="ok">通過</span> 用了 ${(c.used || []).length} 個編號，沒有不明來源的數字。最後採用：${w.final === 'llm' ? 'LLM 撰寫' : '模板'}</div>` : `<div>未通過：${esc([...(c.unknown || []), ...(c.stray || [])].join('、'))}</div>`);
  step('⑥ 畫面動作', (r.scene || []).map(a => a.name + '(' + JSON.stringify(a.args, (k, v) => k === 'series' ? `[${v.length} 個月]` : k === 'shares' ? '{…}' : v) + ')').join('\n') || '(無)');
  return d;
}
function renderApi(r, label) {
  const src = (r.sources || []).map(esc).join('；') + (r.notes && r.notes.length ? `<br>註：${r.notes.map(esc).join('；')}` : '');
  const html = highlightFacts(r.answer, r), rp = (r.scene || []).find(a => a.name === 'replay');
  const msg = addBot(roleTuple(r), rp ? '<span class="note">回放中，看城市怎麼走過這幾年…</span>' : html, rp ? '' : src);
  msg.appendChild(apiTrace(r));
  if (rp) msg._final = { html, src, follow: r.followups || [] };
  runScene(r.scene || [], msg);
  apiCtx = r.context || null;
  if (!rp) setChips(r.followups || []);
  scrollLog();
}
async function askApi(q, typing) {
  try {
    const r = await fetchJson(API + '/api/ask', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ question: q, context: apiCtx }) });
    typing.remove(); renderApi(r); return true;
  } catch (e) {
    online = false; setMode();
    addBot(ROLE.guide, '後端暫時連不上 (免費的伺服器閒置後會休眠，可能要等一下)，這題先用離線模式回答。', '');
    return false;
  }
}

/* ---------- 畫面動作：後端只說「要看什麼」，這裡決定城市怎麼呈現 ---------- */
function runScene(actions, msg) {
  const names = xs => (xs || []).filter(n => CO[n]);
  if (!actions.some(a => a.name === 'show_portfolio')) setMine(null);
  if (!actions.some(a => a.name === 'mark_companies')) setRings([]);
  for (const a of actions) {
    const g = a.args || {};
    if (a.name === 'reset') resetCity();
    else if (a.name === 'focus_etfs') setFocus(g.etfs && g.etfs.length ? new Set(g.etfs.filter(k => ETFS[k])) : null);
    else if (a.name === 'mark_companies') {
      const mode = g.label === 'weights' ? 'w:' + (g.etfs || []).filter(k => ETFS[k]).join(',') : g.label === 'portfolio' ? 'mine' : 'chg';
      setLabels(names(g.companies).map(n => [n, mode === 'w:' ? 'chg' : mode]));
      setRings(names(g.ring).map(n => ringForCo(n, 0xffffff)));
    } else if (a.name === 'fly_to') { const ns = names(g.companies); g.overview || !ns.length ? overview() : fitNames(ns, { maxZoom: ns.length === 1 ? 1.9 : 1.4 }); }
    else if (a.name === 'show_portfolio') setMine({ _share: Object.fromEntries(Object.entries(g.shares || {}).filter(([n]) => CO[n])) });
    else if (a.name === 'set_time') applyTime(clamp(+g.hour || 14.5, 8, 22));
    else if (a.name === 'replay' && ETFS[g.etf] && msg) {
      const S = (g.series || []).map(s => ({ ...s, ch: s.ch == null ? null : s.ch / 100 }));
      startReplay({ etf: g.etf, monthly: g.monthly, _series: S }, msg);
    }
  }
}

/* ---------- 我的持股：手動輸入，或上傳截圖 (先在畫面上塗掉個資) ---------- */
const pf = $('pf'); let pfImg = null, pfBoxes = [], pfDrag = null;
function pfRow(code = ETF_KEYS[0], amt = '') {
  const tr = document.createElement('tr');
  tr.innerHTML = `<td><select aria-label="ETF">${ETF_KEYS.map(k => `<option value="${k}"${k === code ? ' selected' : ''}>${k} ${esc(ETFS[k].name)}</option>`).join('')}</select></td><td><input type="number" min="0" step="1000" inputmode="numeric" aria-label="金額" placeholder="金額 (元)" value="${amt}"></td><td><button type="button" class="icon-btn" aria-label="刪除這列">刪除</button></td>`;
  tr.querySelector('button').onclick = () => tr.remove();
  $('pfRows').appendChild(tr);
}
function pfPositions() {
  const pos = {};
  for (const tr of $('pfRows').children) { const k = tr.querySelector('select').value, v = +tr.querySelector('input').value; if (v > 0) pos[k] = (pos[k] || 0) + v; }
  return pos;
}
function pfDraw() {
  const cv = $('pfCanvas'), g = cv.getContext('2d');
  if (!pfImg) { cv.hidden = true; return; }
  cv.hidden = false; g.drawImage(pfImg, 0, 0, cv.width, cv.height); g.fillStyle = '#000';
  for (const b of [...pfBoxes, ...(pfDrag ? [pfDrag] : [])]) g.fillRect(Math.min(b.x0, b.x1), Math.min(b.y0, b.y1), Math.abs(b.x1 - b.x0), Math.abs(b.y1 - b.y0));
}
function pfPoint(e) { const cv = $('pfCanvas'), r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * cv.width / r.width, (e.clientY - r.top) * cv.height / r.height]; }
if (pf) {
  $('pfBtn').onclick = () => { if (!$('pfRows').children.length) { pfRow('0050', 300000); pfRow('0056', 100000); pfRow('00878', 200000); } setMode(); pf.showModal(); };
  $('pfClose').onclick = () => pf.close();
  $('pfAdd').onclick = () => pfRow();
  $('pfFile').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const img = new Image(); img.onload = () => { const cv = $('pfCanvas'), s = Math.min(1, 900 / img.width); cv.width = Math.round(img.width * s); cv.height = Math.round(img.height * s); pfImg = img; pfBoxes = []; pfDraw(); $('pfMaskHint').hidden = false; URL.revokeObjectURL(img.src); };
    img.src = URL.createObjectURL(f);
  };
  const cv = $('pfCanvas');
  cv.addEventListener('pointerdown', e => { const [x, y] = pfPoint(e); pfDrag = { x0: x, y0: y, x1: x, y1: y }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => { if (!pfDrag) return; [pfDrag.x1, pfDrag.y1] = pfPoint(e); pfDraw(); });
  cv.addEventListener('pointerup', () => { if (pfDrag && Math.abs(pfDrag.x1 - pfDrag.x0) > 4) pfBoxes.push(pfDrag); pfDrag = null; pfDraw(); });
  $('pfUndo').onclick = () => { pfBoxes.pop(); pfDraw(); };
  $('pfParse').onclick = async () => {
    if (!pfImg || !online) return;
    const note = $('pfNote'); note.textContent = '辨識中…';
    const blob = await new Promise(r => $('pfCanvas').toBlob(r, 'image/png'));   // 送出的是塗黑後的畫面，不是原圖
    const fd = new FormData(); fd.append('file', blob, 'holdings.png');
    try {
      const r = await fetchJson(API + '/api/portfolio/parse', { method: 'POST', body: fd }, 60000);
      if (!r.ok) { note.textContent = r.error || '辨識失敗'; return; }
      $('pfRows').innerHTML = '';
      for (const row of r.rows.filter(x => x.in_city && x.amount)) pfRow(row.code, Math.round(row.amount));
      note.textContent = `讀到 ${r.rows.length} 筆，${Object.keys(r.positions).length} 筆在城市裡。${r.skipped.length ? '不在城市裡的：' + r.skipped.join('、') + '。' : ''}請確認金額後再計算。`;
    } catch (e) { note.textContent = '辨識失敗：' + e.message; }
  };
  $('pfGo').onclick = async () => {
    const pos = pfPositions(); if (!Object.keys(pos).length) { $('pfNote').textContent = '請至少輸入一筆金額。'; return; }
    pf.close();
    const q = '我有 ' + Object.entries(pos).map(([k, v]) => `${k} ${v} 元`).join('、');
    if (!online) { ask(q); return; }
    if (replay) finishReplay(true);
    addUser(q + ' (已確認)'); setChips([]); const typing = addTyping();
    try { const r = await fetchJson(API + '/api/portfolio/lookthrough', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ positions: pos }) }); typing.remove(); renderApi(r); }
    catch (e) { typing.remove(); online = false; setMode(); ask(q); }
  };
}
$('apiGo') && ($('apiGo').onclick = async () => { $('apiState').textContent = '連線中…'; await connectApi($('apiUrl').value); });
