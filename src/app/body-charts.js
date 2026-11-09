/* T17 RunTracker — Analytics › tab con "Cơ thể" (v2.4, lượt 5).
 * Biểu đồ đường theo TRỤC THỜI GIAN thật (số đo không đều ngày): điểm = trung bình trong ngày, đường = trung bình 7 ngày,
 * vạch đứt = cân nặng mục tiêu, vòng cam = lần đo có ghi chú. Dưới đường cân nặng là tải tập theo tuần (chạy + fitness)
 * cùng trục thời gian. Bảng so sánh hai mốc A/B. SVG tự vẽ như analytics.js, không thư viện ngoài.
 * Dữ liệu tính ở core/body.js (chartSeries, headline, compareAB); file này chỉ vẽ.
 */
(function (root) {
'use strict';
const B = root.T17Body;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const COLORS = { weightKg: '#2a78d6', bodyFatPct: '#eb6834', muscleKg: '#2fa36b', waistCm: '#8e5fd0', hrRest: '#d14b6a', load: '#b9c3d0', goal: '#1f8a52', note: '#e3a63b' };
const CHARTS = [['weightKg', 'Cân nặng'], ['bodyFatPct', '% mỡ'], ['muscleKg', 'Khối cơ'], ['waistCm', 'Vòng eo'], ['hrRest', 'Nhịp tim nghỉ']];
let ab = null; // { a, b } — mốc so sánh đang chọn

const fmtD = s => s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : '';
const fmtDay = s => s ? s.split('-').reverse().join('/') : '';
const fmtNum = (v, dec) => v == null ? '—' : (Math.round(v * 10 ** dec) / 10 ** dec).toLocaleString('vi-VN', { maximumFractionDigits: dec });
function niceStep(range) { if (!(range > 0)) return 1; const raw = range / 4, p = Math.pow(10, Math.floor(Math.log10(raw))); for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= raw) return k * p; return 10 * p; }
function tipEl() { let t = document.getElementById('anTip'); if (!t) { t = document.createElement('div'); t.id = 'anTip'; t.className = 'an-tip'; t.hidden = true; document.body.appendChild(t); } return t; }
function showTip(html, x, y) { const t = tipEl(); t.innerHTML = html; t.hidden = false; const w = t.offsetWidth, h = t.offsetHeight; t.style.left = Math.min(window.innerWidth - w - 8, x + 14) + 'px'; t.style.top = Math.max(8, y - h - 10) + 'px'; }
function hideTip() { tipEl().hidden = true; }

/** Trục x dùng chung cho mọi biểu đồ trong tab (để đường cân nặng và cột tải thẳng hàng). */
function axis(start, end, W) { const L = 46, R = 14, span = Math.max(1, B.daysBetween(start, end)); return { L, R, W, start, end, X: d => L + B.daysBetween(start, d) / span * (W - L - R) }; }
function xTicks(ax, H, B0) {
  let g = ''; const span = B.daysBetween(ax.start, ax.end); const n = Math.max(2, Math.min(8, Math.floor(ax.W / 110)));
  for (let k = 0; k <= n; k++) { const d = new Date(Date.parse(ax.start + 'T00:00:00Z') + Math.round(span * k / n) * 86400000).toISOString().slice(0, 10); g += `<text x="${ax.X(d)}" y="${H - 8}" text-anchor="middle" class="an-axis">${fmtD(d)}</text>`; }
  return g;
}
/** Biểu đồ đường theo ngày cho một chỉ số. */
function timeChart({ id, key, pts, ax, H = 210, goal, unit, dec, color }) {
  const T = 12, Bm = 26, { L, R, W, X } = ax;
  const vals = pts.flatMap(p => [p.value, p.ma7]).concat(goal ? [goal] : []);
  let lo = Math.min(...vals), hi = Math.max(...vals); const padv = Math.max((hi - lo) * 0.12, key === 'weightKg' ? 0.5 : 0.3); lo -= padv; hi += padv;
  const st = niceStep(hi - lo); lo = Math.floor(lo / st) * st; hi = Math.ceil(hi / st) * st;
  const Y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - Bm);
  let g = '';
  for (let v = lo; v <= hi + st / 2; v += st) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="an-grid"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" class="an-axis">${fmtNum(v, st < 1 ? 1 : 0)}</text>`;
  g += xTicks(ax, H, Bm);
  if (goal) g += `<line class="bc-goal" x1="${L}" x2="${W - R}" y1="${Y(goal)}" y2="${Y(goal)}" stroke="${COLORS.goal}" stroke-width="1.5" stroke-dasharray="6 4"/><text x="${W - R - 4}" y="${Y(goal) - 4}" text-anchor="end" class="an-band-label" fill="${COLORS.goal}">Mục tiêu ${fmtNum(goal, 1)} ${esc(unit)}</text>`;
  if (pts.length > 1) g += `<path class="bc-ma" d="${pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.date).toFixed(1)},${Y(p.ma7).toFixed(1)}`).join('')}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
  for (const p of pts) {
    g += `<circle class="bc-pt" cx="${X(p.date).toFixed(1)}" cy="${Y(p.value).toFixed(1)}" r="3.2" fill="#fff" stroke="${color}" stroke-width="1.6"/>`;
    if (p.notes.length) g += `<circle class="bc-note" cx="${X(p.date).toFixed(1)}" cy="${Y(p.value).toFixed(1)}" r="6.5" fill="none" stroke="${COLORS.note}" stroke-width="1.8"/>`;
  }
  g += `<line class="an-cross" x1="0" x2="0" y1="${T}" y2="${H - Bm}" visibility="hidden"/><rect class="an-hit" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - Bm}" fill="transparent"/>`;
  setTimeout(() => {
    const svg = document.getElementById(id); if (!svg) return;
    const hit = svg.querySelector('.an-hit'), cross = svg.querySelector('.an-cross');
    hit.addEventListener('mousemove', e => { const r = svg.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * W; let best = pts[0]; for (const p of pts) if (Math.abs(X(p.date) - x) < Math.abs(X(best.date) - x)) best = p;
      cross.setAttribute('x1', X(best.date)); cross.setAttribute('x2', X(best.date)); cross.setAttribute('visibility', 'visible');
      showTip(`<b>${fmtDay(best.date)}</b><br>${fmtNum(best.value, dec)} ${esc(unit)}${best.count > 1 ? ` (TB ${best.count} lần đo)` : ''}<br>TB 7 ngày ${fmtNum(best.ma7, dec)} ${esc(unit)}${best.notes.length ? `<br>📝 ${best.notes.map(esc).join(' · ')}` : ''}`, e.clientX, e.clientY); });
    hit.addEventListener('mouseleave', () => { cross.setAttribute('visibility', 'hidden'); hideTip(); });
  }, 0);
  return `<svg id="${id}" class="an-svg bc-svg" data-key="${key}" data-points="${pts.length}" viewBox="0 0 ${W} ${H}" role="img">${g}</svg>`;
}
/** Tải tập theo tuần, cùng trục thời gian với cân nặng. */
function loadBars({ id, weeks, ax, H = 120 }) {
  const T = 8, Bm = 24, { L, R, W, X } = ax; const max = Math.max(1, ...weeks.map(w => w.load));
  const st = niceStep(max), hi = Math.ceil(max / st) * st; const Y = v => T + (1 - v / hi) * (H - T - Bm);
  let g = '';
  for (let v = 0; v <= hi + st / 2; v += st) g += `<line x1="${L}" x2="${W - R}" y1="${Y(v)}" y2="${Y(v)}" class="an-grid"/><text x="${L - 6}" y="${Y(v) + 4}" text-anchor="end" class="an-axis">${Math.round(v)}</text>`;
  g += xTicks(ax, H, Bm);
  weeks.forEach((w, i) => {
    const x1 = Math.max(L, X(w.week)), x2 = Math.min(W - R, X(T17Core.addDaysYmd(w.week, 7)));
    if (!(x2 > x1) || !(w.load > 0)) return;
    g += `<rect class="bc-load" data-i="${i}" x="${(x1 + 1).toFixed(1)}" y="${Y(w.load).toFixed(1)}" width="${Math.max(1, x2 - x1 - 2).toFixed(1)}" height="${(Y(0) - Y(w.load)).toFixed(1)}" rx="2" fill="${COLORS.load}"/>`;
  });
  setTimeout(() => { const svg = document.getElementById(id); if (!svg) return; svg.querySelectorAll('.bc-load').forEach(r => { r.addEventListener('mousemove', e => { const w = weeks[+r.dataset.i]; showTip(`<b>Tuần ${fmtD(w.week)}</b><br>Tải ${Math.round(w.load)} (chạy ${Math.round(w.run)} · fitness ${Math.round(w.fitness)})<br>${w.done} buổi đã tập`, e.clientX, e.clientY); }); r.addEventListener('mouseleave', hideTip); }); }, 0);
  return `<svg id="${id}" class="an-svg bc-svg bc-loadsvg" data-bars="${weeks.filter(w => w.load > 0).length}" viewBox="0 0 ${W} ${H}" role="img">${g}</svg>`;
}
/** Tải theo tuần: chạy + fitness (T17Load.collect), chỉ buổi đã tập. */
function weeklyLoad(start, end) {
  const rows = T17Load.collect(db, db.profile || {}).filter(r => r.done && r.date >= start && r.date <= end);
  const map = new Map();
  for (const r of rows) { const wk = T17Core.mondayYmd(r.date); const o = map.get(wk) || { week: wk, load: 0, run: 0, fitness: 0, done: 0 }; const fit = T17Fitness.isFitnessWorkout(r.item); o.load += r.actualLoad; o[fit ? 'fitness' : 'run'] += r.actualLoad; o.done++; map.set(wk, o); }
  return [...map.values()].sort((a, b) => a.week.localeCompare(b.week));
}

function emptyHtml(msg, big) { return `<div class="an-empty${big ? ' big' : ''} bc-empty">${msg}<div class="bc-empty-actions"><button type="button" class="toolbar-btn primary" data-bc-add>＋ Nhập số đo</button><button type="button" class="toolbar-btn" data-bc-open>📏 Mở Chỉ số cơ thể (nhập CSV)</button></div></div>`; }
function chartCard(key, label, list, ax, opts) {
  const f = B.FIELD_BY_KEY.get(key); const pts = B.chartSeries(list, key, { from: ax.start, to: ax.end, profile: db.profile });
  const hl = B.headline(key, pts, db.profile || {});
  const goal = key === 'weightKg' ? Number(String(db.profile?.weightGoalKg ?? '').replace(',', '.')) || null : null;
  const head = `<div class="an-card-head"><h3 class="bc-title" data-key="${key}">${hl ? esc(hl.text) : esc(label)}</h3><small>${esc(label)}${f.unit ? ' (' + esc(f.unit) + ')' : ''}${hl ? ` <span class="bd-d ${hl.assess}">●</span>` : ''}</small></div>`;
  if (pts.length < 2) return `<section class="an-card bc-card" data-key="${key}">${head}${emptyHtml(pts.length ? `Mới có 1 lần đo ${esc(label.toLowerCase())} trong khoảng này — cần ít nhất 2 lần để vẽ.` : `Chưa có số đo ${esc(label.toLowerCase())} trong khoảng này.`)}</section>`;
  const legend = `<div class="an-legend"><span><i style="background:#fff;border:1.6px solid ${COLORS[key]};border-radius:50%"></i>Trung bình ngày</span><span><i style="background:${COLORS[key]}"></i>Trung bình 7 ngày</span>${goal ? `<span><i style="background:repeating-linear-gradient(90deg,${COLORS.goal} 0 5px,transparent 5px 8px)"></i>Mục tiêu</span>` : ''}${pts.some(p => p.notes.length) ? `<span><i style="background:#fff;border:1.8px solid ${COLORS.note};border-radius:50%"></i>Có ghi chú</span>` : ''}</div>`;
  return `<section class="an-card bc-card" data-key="${key}">${head}${legend}${timeChart({ id: 'bc-' + key, key, pts, ax, goal, unit: f.unit, dec: f.dec, color: COLORS[key], H: opts?.H })}${opts?.extra || ''}</section>`;
}

function abHtml(list) {
  if (!ab) ab = B.abPreset(list, 'first');
  const rows = B.compareAB(list, ab.a, ab.b, db.profile || {});
  const cell = (x, dec, date) => `${fmtNum(x.value, dec)}${x.date !== date ? ` <small title="Không có số đo đúng ngày; dùng lần đo gần nhất">(${fmtD(x.date)})</small>` : ''}`;
  return `<section class="an-card bc-ab"><div class="an-card-head"><h3>So sánh hai mốc</h3><small>Mỗi chỉ số lấy lần đo gần ngày chọn nhất; ngày trong ngoặc là ngày đo thực tế.</small></div>
    <div class="bc-ab-bar"><label>Mốc A <input type="date" data-ab="a" value="${esc(ab.a)}"></label><span>→</span><label>Mốc B <input type="date" data-ab="b" value="${esc(ab.b)}"></label><button type="button" class="toolbar-btn" data-ab-preset="first">Lần đầu ↔ mới nhất</button><button type="button" class="toolbar-btn" data-ab-preset="d30">30 ngày trước ↔ mới nhất</button></div>
    ${rows.length ? `<table class="an-table bc-ab-table"><thead><tr><th>Chỉ số</th><th>A · ${fmtDay(ab.a)}</th><th>B · ${fmtDay(ab.b)}</th><th>Thay đổi</th></tr></thead><tbody>${rows.map(r => `<tr data-key="${r.key}"><td>${esc(r.label)}${r.unit && r.unit !== 'mức' ? ` <small>${esc(r.unit)}</small>` : ''}</td><td>${cell(r.a, r.dec, ab.a)}</td><td>${cell(r.b, r.dec, ab.b)}</td><td>${r.same ? '<span class="bd-d neutral" title="Cùng một lần đo">—</span>' : `<span class="bd-d ${r.assess}">${r.delta > 0 ? '▲ +' : r.delta < 0 ? '▼ ' : '＝ '}${fmtNum(r.delta, (r.dec || 0) + 1)}${r.pct != null && r.delta ? ` <small>(${r.pct > 0 ? '+' : ''}${fmtNum(r.pct, 1)}%)</small>` : ''}</span>`}</td></tr>`).join('')}</tbody></table>` : '<div class="an-empty">Không có chỉ số nào đo ở cả hai mốc.</div>'}</section>`;
}

/** Vẽ tab con Cơ thể vào host. opts: { weeksShown, chartW: { full, half } } */
function render(host, opts = {}) {
  const list = B.normalizeList(db.bodyMetrics || []);
  const today = T17Core.ymd(new Date());
  if (list.length < 2) { host.innerHTML = emptyHtml(list.length ? 'Mới có 1 lần đo. Nhập thêm ít nhất một lần nữa để xem biểu đồ và so sánh.' : 'Chưa có số đo cơ thể nào. Nhập cân nặng, % mỡ, vòng eo… tại từng thời điểm (mọi ô tuỳ chọn) hoặc nhập CSV từ cân thông minh.', true); bind(host); return; }
  const end = [today, list[list.length - 1].date].sort().pop();
  const start = B.rangeStart(today, opts.weeksShown || 0, list[0].date);
  // ≤ 1200 px: .an-two thành một cột (CSS) → biểu đồ "nửa khung" vẽ đủ bề rộng, không bị phóng to chữ.
  const oneCol = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 1200px)').matches;
  const fullW = opts.chartW?.full || 960;
  const full = axis(start, end, fullW), half = axis(start, end, oneCol ? fullW : (opts.chartW?.half || 470));
  const weeks = weeklyLoad(start, end);
  const loadExtra = `<div class="bc-sub">Tải tập theo tuần (chạy + fitness) — cùng trục thời gian${weeks.length ? '' : ': chưa có buổi tập nào có kết quả trong khoảng này'}</div>${weeks.length ? loadBars({ id: 'bc-load', weeks, ax: full }) : ''}`;
  const latest = B.latestByField(list, db.profile || {});
  host.innerHTML = `<div class="an-kpis bc-kpis">${[['weightKg', 1], ['bodyFatPct', 1], ['muscleKg', 1], ['waistCm', 1], ['bmi', 1], ['hrRest', 0]].filter(([k]) => latest.has(k)).map(([k, dec]) => { const f = B.FIELD_BY_KEY.get(k), r = latest.get(k); return `<div class="an-kpi"><span>${esc(f.label)}</span><b>${fmtNum(B.valueOf(r, k, db.profile), dec)} ${esc(f.unit)}</b><small>đo ${fmtDay(r.date)}</small></div>`; }).join('')}</div>
    ${chartCard('weightKg', 'Cân nặng', list, full, { H: 230, extra: loadExtra })}
    <div class="an-two">${chartCard('bodyFatPct', '% mỡ', list, half)}${chartCard('muscleKg', 'Khối cơ', list, half)}</div>
    <div class="an-two">${chartCard('waistCm', 'Vòng eo', list, half)}${chartCard('hrRest', 'Nhịp tim nghỉ', list, half)}</div>
    ${abHtml(list)}
    <div class="an-note">Điểm = trung bình các lần đo trong ngày; đường = trung bình 7 ngày (tính trên toàn bộ lịch sử). Màu ● cạnh tiêu đề theo ý nghĩa: xanh là tốt, đỏ là xấu, xám là trung tính (cân nặng xám nếu chưa đặt mục tiêu trong Hồ sơ).</div>`;
  bind(host, opts);
}
function bind(host, opts) {
  host.querySelectorAll('[data-bc-add]').forEach(b => b.onclick = () => root.T17BodyUI.editRecord(''));
  host.querySelectorAll('[data-bc-open]').forEach(b => b.onclick = () => root.T17BodyUI.open());
  host.querySelectorAll('[data-ab]').forEach(i => i.onchange = () => { if (!i.value) return; ab = { ...ab, [i.dataset.ab]: i.value }; render(host, opts); });
  host.querySelectorAll('[data-ab-preset]').forEach(b => b.onclick = () => { ab = B.abPreset(B.normalizeList(db.bodyMetrics || []), b.dataset.abPreset); render(host, opts); });
}
/** Gọi khi đổi người dùng: bỏ mốc A/B cũ. */
function reset() { ab = null; }
root.T17BodyCharts = { render, reset, CHARTS };
})(typeof globalThis !== 'undefined' ? globalThis : this);
