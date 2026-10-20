/* T17 RunTracker — tab Analytics: thể lực/mệt mỏi (CTL/ATL/TSB), khối lượng theo tuần,
 * phân bố vùng nhịp tim, tổng hợp theo loại bài. Dùng `db` (app.js) + T17Load/T17Athlete.
 * Biểu đồ SVG tự vẽ, không thư viện ngoài. Màu theo bảng tham chiếu (slot 1 xanh, slot 2 cam). */
(function (root) {
'use strict';
const COLORS = { ctl: '#2a78d6', atl: '#eb6834', load: '#b9c3d0', plan: '#c9d0da', actual: '#2a78d6', zones: ['#86b6ef', '#5598e7', '#2a78d6', '#1c5cab', '#104281'] };
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r0 = v => Math.round(v), r1 = v => Math.round(v * 10) / 10;
let weeksShown = 12;

function fmtD(s) { return s ? `${s.slice(8, 10)}/${s.slice(5, 7)}` : ''; }
function fmtDur(min) { min = Math.round(min || 0); const h = Math.floor(min / 60), m = min % 60; return h ? `${h}h${String(m).padStart(2, '0')}` : `${m}′`; }
/** Thang trục "đẹp": bước 1/2/2.5/5×10^k, ~4 vạch. */
function niceStep(range) { if (!(range > 0)) return 2.5; const raw = range / 4, p = Math.pow(10, Math.floor(Math.log10(raw))); for (const k of [1, 2, 2.5, 5, 10]) if (k * p >= raw) return k * p; return 10 * p; }
function niceMax(v) { const st = niceStep(v); return Math.max(st, Math.ceil(v / st) * st); }
let chartW = { full: 960, half: 470 };

/* ---------- tooltip dùng chung ---------- */
function tipEl() { let t = document.getElementById('anTip'); if (!t) { t = document.createElement('div'); t.id = 'anTip'; t.className = 'an-tip'; t.hidden = true; document.body.appendChild(t); } return t; }
function showTip(html, x, y) { const t = tipEl(); t.innerHTML = html; t.hidden = false; const w = t.offsetWidth, h = t.offsetHeight; t.style.left = Math.min(window.innerWidth - w - 8, x + 14) + 'px'; t.style.top = Math.max(8, y - h - 10) + 'px'; }
function hideTip() { tipEl().hidden = true; }

/* ---------- biểu đồ đường theo ngày (một trục y) ---------- */
function lineChart({ id, series, points, height = 230, yMin, yMax, bands = [], bars, zeroLine = false, tooltip }) {
  const W = chartW.full, H = height, L = 46, R = 14, T = 12, B = 26;
  const n = points.length; if (n < 2) return '<div class="an-empty">Chưa đủ dữ liệu để vẽ biểu đồ.</div>';
  let lo = yMin ?? Math.min(0, ...series.flatMap(s => points.map(p => p[s.key]))), hi = yMax ?? Math.max(...series.flatMap(s => points.map(p => p[s.key])), ...(bars ? points.map(p => p[bars.key] || 0) : [0]));
  const st = niceStep(hi - Math.min(0, lo)); hi = Math.max(st, Math.ceil(hi / st) * st); lo = lo < 0 ? Math.floor(lo / st) * st : 0;
  const ticks = Math.round((hi - lo) / st);
  const X = i => L + i / (n - 1) * (W - L - R), Y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  let g = '';
  for (const b of bands) { const y1 = Y(Math.min(hi, b.to)), y2 = Y(Math.max(lo, b.from)); if (y2 > y1) g += `<rect x="${L}" y="${y1}" width="${W - L - R}" height="${y2 - y1}" fill="${b.fill}"/><text x="${W - R - 4}" y="${y1 + 11}" text-anchor="end" class="an-band-label">${esc(b.label)}</text>`; }
  for (let k = 0; k <= ticks; k++) { const v = lo + st * k, y = Y(v); g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="an-grid"/><text x="${L - 6}" y="${y + 4}" text-anchor="end" class="an-axis">${r0(v)}</text>`; }
  if (zeroLine && lo < 0) g += `<line x1="${L}" x2="${W - R}" y1="${Y(0)}" y2="${Y(0)}" class="an-zero"/>`;
  const step = Math.max(1, Math.ceil(n / Math.max(4, Math.floor(W / 110))));
  for (let i = 0; i < n; i += step) g += `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" class="an-axis">${fmtD(points[i].date)}</text>`;
  if (bars) { const bw = Math.max(1, (W - L - R) / n - 2); points.forEach((p, i) => { const v = p[bars.key] || 0; if (v > 0) g += `<rect x="${X(i) - bw / 2}" y="${Y(v)}" width="${bw}" height="${Y(0) - Y(v)}" rx="1" fill="${p.isFuture ? 'none' : bars.color}" ${p.isFuture ? `stroke="${bars.color}" stroke-dasharray="2 2"` : ''}/>`; }); }
  const todayIdx = points.findIndex(p => p.isFuture);
  for (const s of series) {
    const seg = (from, to, dashed) => { if (to - from < 1) return ''; let d = ''; for (let i = from; i <= to; i++) d += `${i === from ? 'M' : 'L'}${X(i).toFixed(1)},${Y(points[i][s.key]).toFixed(1)}`; return `<path d="${d}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"${dashed ? ' stroke-dasharray="5 4"' : ''}/>`; };
    if (todayIdx > 0) g += seg(0, todayIdx - 1, false) + seg(todayIdx - 1, n - 1, true); else g += seg(0, n - 1, false);
    const last = todayIdx > 0 ? todayIdx - 1 : n - 1;
    g += `<circle cx="${X(last)}" cy="${Y(points[last][s.key])}" r="4" fill="${s.color}" stroke="#fff" stroke-width="2"/>`;
  }
  if (todayIdx > 0) g += `<line x1="${X(todayIdx - 1)}" x2="${X(todayIdx - 1)}" y1="${T}" y2="${H - B}" class="an-today"/><text x="${X(todayIdx - 1) + 4}" y="${T + 10}" class="an-axis">Hôm nay · dự báo theo kế hoạch →</text>`;
  g += `<line class="an-cross" x1="0" x2="0" y1="${T}" y2="${H - B}" visibility="hidden"/><rect class="an-hit" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="transparent"/>`;
  setTimeout(() => {
    const svg = document.getElementById(id); if (!svg) return;
    const hit = svg.querySelector('.an-hit'), cross = svg.querySelector('.an-cross');
    hit.addEventListener('mousemove', e => { const r = svg.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width * W; const i = Math.max(0, Math.min(n - 1, Math.round((x - L) / (W - L - R) * (n - 1)))); cross.setAttribute('x1', X(i)); cross.setAttribute('x2', X(i)); cross.setAttribute('visibility', 'visible'); showTip(tooltip(points[i]), e.clientX, e.clientY); });
    hit.addEventListener('mouseleave', () => { cross.setAttribute('visibility', 'hidden'); hideTip(); });
  }, 0);
  return `<svg id="${id}" class="an-svg" viewBox="0 0 ${W} ${H}" role="img">${g}</svg>`;
}

/* ---------- biểu đồ cột theo tuần: KH (viền xám) và TT (xanh) ---------- */
function weeklyBars(id, weeks) {
  if (!weeks.length) return '<div class="an-empty">Chưa có dữ liệu.</div>';
  const W = chartW.half, H = 220, L = 40, R = 8, T = 12, B = 26, n = weeks.length;
  const st = niceStep(Math.max(...weeks.map(w => Math.max(w.planKm, w.actualKm)))), hi = Math.max(st, Math.ceil(Math.max(...weeks.map(w => Math.max(w.planKm, w.actualKm))) / st) * st);
  const Y = v => T + (1 - v / hi) * (H - T - B), slot = (W - L - R) / n, bw = Math.max(3, Math.min(22, slot / 2 - 3));
  let g = '';
  for (let k = 0; k <= Math.round(hi / st); k++) { const v = st * k, y = Y(v); g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="an-grid"/><text x="${L - 6}" y="${y + 4}" text-anchor="end" class="an-axis">${r0(v)}</text>`; }
  const every = Math.max(1, Math.ceil(n / Math.max(4, Math.floor(W / 70))));
  weeks.forEach((w, i) => {
    const cx = L + slot * (i + 0.5);
    if (w.planKm > 0) g += `<rect x="${cx - bw - 1}" y="${Y(w.planKm)}" width="${bw}" height="${Y(0) - Y(w.planKm)}" rx="2" fill="${COLORS.plan}"/>`;
    if (w.actualKm > 0) g += `<rect x="${cx + 1}" y="${Y(w.actualKm)}" width="${bw}" height="${Y(0) - Y(w.actualKm)}" rx="2" fill="${COLORS.actual}"/>`;
    if (i % every === 0) g += `<text x="${cx}" y="${H - 8}" text-anchor="middle" class="an-axis">${fmtD(w.week)}</text>`;
    g += `<rect class="an-wk" data-i="${i}" x="${L + slot * i}" y="${T}" width="${slot}" height="${H - T - B}" fill="transparent"/>`;
  });
  setTimeout(() => {
    const svg = document.getElementById(id); if (!svg) return;
    svg.querySelectorAll('.an-wk').forEach(r => { r.addEventListener('mousemove', e => { const w = weeks[+r.dataset.i]; showTip(`<b>Tuần ${fmtD(w.week)}</b><br>KH ${r1(w.planKm)} km · TT ${r1(w.actualKm)} km<br>Thời gian TT ${fmtDur(w.actualMin)}<br>Buổi: ${w.done}/${w.planned}${w.missed ? ` · bỏ ${w.missed}` : ''}<br>Tải tuần ${r0(w.load)}`, e.clientX, e.clientY); }); r.addEventListener('mouseleave', hideTip); });
  }, 0);
  return `<svg id="${id}" class="an-svg" viewBox="0 0 ${W} ${H}" role="img">${g}</svg>`;
}

function kpi(label, value, sub = '') { return `<div class="an-kpi"><span>${esc(label)}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ''}</div>`; }
function legend(items) { return `<div class="an-legend">${items.map(i => `<span><i style="background:${i.color}${i.dashed ? ';background:repeating-linear-gradient(90deg,' + i.color + ' 0 5px,transparent 5px 8px)' : ''}"></i>${esc(i.label)}</span>`).join('')}</div>`; }

function render() {
  const host = document.getElementById('anBody'); if (!host) return;
  const full = Math.max(480, (host.clientWidth || 990) - 30 - 2); chartW = { full, half: Math.max(360, Math.floor((full - 12) / 2) - 2) };
  const C = root.T17Core, LD = root.T17Load, A = root.T17Athlete;
  const prof = db.profile || {}, P = A.resolveProfile(prof);
  const today = C.ymd(new Date());
  const rows = LD.collect(db, prof);
  document.querySelectorAll('#anRange [data-weeks]').forEach(b => b.classList.toggle('active', +b.dataset.weeks === weeksShown));
  if (!rows.some(r => r.done)) { host.innerHTML = `<div class="an-empty big">Chưa có buổi chạy nào có kết quả. Hãy nhập kết quả hoặc Import FIT để xem phân tích.</div>`; return; }

  const firstDate = rows[0].date;
  const start = weeksShown ? C.addDaysYmd(C.mondayYmd(today), -7 * (weeksShown - 1)) : C.mondayYmd(firstDate);
  const futurePlans = rows.filter(r => r.date > today && !r.done && !r.missed && !r.standalone);
  const projEnd = futurePlans.length ? [futurePlans.at(-1).date, C.addDaysYmd(today, 28)].sort()[0] : today;
  const pmcAll = LD.pmcSeries(rows, { today, to: projEnd > today ? projEnd : today });
  const pmc = pmcAll.filter(p => p.date >= start).map(p => ({ ...p, barLoad: p.load + p.projected }));
  const nowIdx = pmcAll.findIndex(p => p.date === today);
  const now = pmcAll[nowIdx >= 0 ? nowIdx : pmcAll.length - 1] || { ctl: 0, atl: 0, tsb: 0 };
  const weekAgo = pmcAll[Math.max(0, (nowIdx >= 0 ? nowIdx : pmcAll.length - 1) - 7)] || now;
  const ramp = now.ctl - weekAgo.ctl;

  const inRange = rows.filter(r => r.date >= start && r.date <= today);
  const done = inRange.filter(r => r.done), planned = inRange.filter(r => !r.standalone);
  const km = done.reduce((s, r) => s + (+r.item.actual.km || 0), 0), min = done.reduce((s, r) => s + (+r.item.actual.minutes || 0), 0);
  const plannedDone = planned.filter(r => r.done).length;
  const nWeeks = Math.max(1, Math.round((C.parseYmdLocal(today) - C.parseYmdLocal(start)) / 604800000) + 1);
  const weeks = LD.weeklySummary(rows.filter(r => r.date >= start && r.date <= (projEnd > today ? projEnd : today)));

  // vùng nhịp tim
  const zoneMin = [0, 0, 0, 0, 0]; const zsrc = { stream: 0, avg: 0, none: 0 };
  for (const r of done) { const z = LD.hrZoneMinutes(r.item, prof); z.zones.forEach((v, i) => zoneMin[i] += v); zsrc[z.source || 'none']++; }
  const zoneTotal = zoneMin.reduce((a, b) => a + b, 0);
  const zt = A.hrZoneTable(prof);
  // theo loại bài + phương pháp tính tải
  const byType = new Map(); const methods = {};
  for (const r of done) { const t = r.standalone ? 'FIT chưa ghép' : (r.item.workoutType || 'Custom'); const o = byType.get(t) || { n: 0, km: 0, min: 0, load: 0 }; o.n++; o.km += +r.item.actual.km || 0; o.min += +r.item.actual.minutes || 0; o.load += r.actualLoad; byType.set(t, o); methods[r.method] = (methods[r.method] || 0) + 1; }

  const warnProfile = P.estimated.length || !P.thresholdPaceSec;
  host.innerHTML = `
  ${warnProfile ? `<div class="an-alert">Hồ sơ VĐV chưa đủ (${[...P.estimated.map(k => ({ hrMax: 'HR tối đa', hrRest: 'HR nghỉ', lthr: 'LTHR' })[k]), !P.thresholdPaceSec ? 'pace ngưỡng' : ''].filter(Boolean).join(', ')}) — điểm tải và vùng tim đang dùng giá trị ước tính. <button type="button" data-open-profile>Cập nhật hồ sơ</button></div>` : ''}
  <div class="an-kpis">
    ${kpi('Thể lực (CTL)', r0(now.ctl), `${ramp >= 0 ? '+' : ''}${r1(ramp)} so với 7 ngày trước`)}
    ${kpi('Mệt mỏi (ATL)', r0(now.atl), 'trung bình tải 7 ngày')}
    ${kpi('Độ tươi (TSB)', `${now.tsb >= 0 ? '+' : ''}${r0(now.tsb)}`, esc(LD.tsbLabel(now.tsb)))}
    ${kpi('Quãng đường', `${r1(km)} km`, `TB ${r1(km / nWeeks)} km/tuần`)}
    ${kpi('Thời gian chạy', fmtDur(min), `${done.length} buổi`)}
    ${kpi('Tuân thủ kế hoạch', planned.length ? `${Math.round(plannedDone / planned.length * 100)}%` : '—', `${plannedDone}/${planned.length} bài đã hoàn thành`)}
  </div>
  ${LD.rampWarning(ramp) ? `<div class="an-alert ${ramp > 8 ? 'bad' : ''}">⚠ ${esc(LD.rampWarning(ramp))} (CTL ${ramp >= 0 ? '+' : ''}${r1(ramp)}/tuần).</div>` : ''}
  <section class="an-card"><div class="an-card-head"><h3>Thể lực · Mệt mỏi · Tải hằng ngày</h3>${legend([{ label: 'CTL – thể lực (42 ngày)', color: COLORS.ctl }, { label: 'ATL – mệt mỏi (7 ngày)', color: COLORS.atl }, { label: 'Tải trong ngày', color: COLORS.load }, { label: 'Dự báo theo kế hoạch', color: '#7d8796', dashed: true }])}</div>
    ${lineChart({ id: 'anPmc', points: pmc, series: [{ key: 'ctl', color: COLORS.ctl }, { key: 'atl', color: COLORS.atl }], bars: { key: 'barLoad', color: COLORS.load }, tooltip: p => `<b>${fmtD(p.date)}${p.isFuture ? ' · dự báo' : ''}</b><br>Tải ngày ${r0(p.load + p.projected)}<br><span style="color:${COLORS.ctl}">●</span> CTL ${r1(p.ctl)} · <span style="color:${COLORS.atl}">●</span> ATL ${r1(p.atl)}<br>TSB ${r1(p.tsb)}` })}
  </section>
  <section class="an-card"><div class="an-card-head"><h3>Độ tươi (TSB = CTL − ATL hôm trước)</h3><small>Vùng xanh: tích luỹ tải hiệu quả · vùng nhạt phía trên: tươi, hợp thi đấu</small></div>
    ${lineChart({ id: 'anTsb', points: pmc, height: 170, series: [{ key: 'tsb', color: '#52606f' }], zeroLine: true, yMin: Math.min(-40, ...pmc.map(p => p.tsb)), yMax: Math.max(30, ...pmc.map(p => p.tsb)), bands: [{ from: -30, to: -10, fill: '#eaf6e5', label: 'Tối ưu' }, { from: 5, to: 25, fill: '#edf4ff', label: 'Tươi' }, { from: -999, to: -30, fill: '#fdeeee', label: 'Quá tải' }], tooltip: p => `<b>${fmtD(p.date)}</b><br>TSB ${r1(p.tsb)}<br>${esc(LD.tsbLabel(p.tsb))}` })}
  </section>
  <div class="an-two">
    <section class="an-card"><div class="an-card-head"><h3>Km theo tuần</h3>${legend([{ label: 'Kế hoạch', color: COLORS.plan }, { label: 'Thực tế', color: COLORS.actual }])}</div>${weeklyBars('anWeeks', weeks)}</section>
    <section class="an-card"><div class="an-card-head"><h3>Thời gian trong các vùng nhịp tim</h3><small>${zsrc.stream} buổi theo chuỗi HR FIT · ${zsrc.avg} buổi theo HR TB · ${zsrc.none} buổi không có HR</small></div>
      ${zoneTotal > 0 ? `<div class="an-zonebar">${zoneMin.map((v, i) => v > 0 ? `<i style="flex:${v};background:${COLORS.zones[i]}" title="${esc(zt[i].name)}: ${fmtDur(v)}"></i>` : '').join('')}</div>
      <table class="an-table"><thead><tr><th>Vùng</th><th>Nhịp tim</th><th>Thời gian</th><th>%</th></tr></thead><tbody>${zt.map((z, i) => `<tr><td><i class="an-sw" style="background:${COLORS.zones[i]}"></i>${esc(z.name)}</td><td>${z.from}–${z.to}</td><td>${fmtDur(zoneMin[i])}</td><td>${zoneTotal ? Math.round(zoneMin[i] / zoneTotal * 100) : 0}%</td></tr>`).join('')}</tbody></table>
      <div class="an-note">Tỷ lệ dễ (Z1–Z2) : trung bình (Z3) : khó (Z4–Z5) = <b>${Math.round((zoneMin[0] + zoneMin[1]) / zoneTotal * 100)} : ${Math.round(zoneMin[2] / zoneTotal * 100)} : ${Math.round((zoneMin[3] + zoneMin[4]) / zoneTotal * 100)}</b>. Mô hình phân cực khuyến nghị khoảng 80 : 0–5 : 15–20.</div>`
      : '<div class="an-empty">Chưa có dữ liệu nhịp tim trong khoảng này.</div>'}
    </section>
  </div>
  <div class="an-two">
    <section class="an-card"><div class="an-card-head"><h3>Theo loại bài</h3></div>
      <table class="an-table"><thead><tr><th>Loại</th><th>Buổi</th><th>Km</th><th>Thời gian</th><th>Tải TB</th></tr></thead><tbody>${[...byType.entries()].sort((a, b) => b[1].min - a[1].min).map(([t, o]) => `<tr><td>${esc(t)}</td><td>${o.n}</td><td>${r1(o.km)}</td><td>${fmtDur(o.min)}</td><td>${r0(o.load / o.n)}</td></tr>`).join('')}</tbody></table></section>
    <section class="an-card"><div class="an-card-head"><h3>Tuần gần đây</h3></div>
      <table class="an-table"><thead><tr><th>Tuần</th><th>Km KH / TT</th><th>Buổi</th><th>Tải</th><th>CTL cuối tuần</th></tr></thead><tbody>${weeks.filter(w => w.week <= today).slice(-8).reverse().map(w => { const end = pmcAll.find(p => p.date === C.addDaysYmd(w.week, 6)) || pmcAll.filter(p => p.date <= C.addDaysYmd(w.week, 6)).at(-1); return `<tr><td>${fmtD(w.week)}</td><td>${r1(w.planKm)} / <b>${r1(w.actualKm)}</b></td><td>${w.done}/${w.planned}</td><td>${r0(w.load)}</td><td>${end ? r0(end.ctl) : '—'}</td></tr>`; }).join('')}</tbody></table></section>
  </div>
  <div class="an-note">Điểm tải 100 = chạy 60 phút đúng ngưỡng. Cách tính trong khoảng này: ${Object.entries(methods).map(([m, c]) => `${esc(LD.METHOD_LABEL[m] || m)} ${c} buổi`).join(' · ')}. Pace chưa hiệu chỉnh độ dốc. Biểu đồ thể lực tính trên toàn bộ lịch sử, chỉ hiển thị khoảng đã chọn.</div>`;
  host.querySelectorAll('[data-open-profile]').forEach(b => b.onclick = () => root.T17Profile.open());
}

let resizeT = null;
function init() {
  window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { const v = document.getElementById('analyticsView'); if (v && v.style.display !== 'none') render(); }, 150); });
  document.querySelectorAll('#anRange [data-weeks]').forEach(b => b.onclick = () => { weeksShown = +b.dataset.weeks; render(); });
  const pb = document.getElementById('anProfileBtn'); if (pb) pb.onclick = () => root.T17Profile.open();
}
root.T17Analytics = { render, init };
})(typeof globalThis !== 'undefined' ? globalThis : this);
