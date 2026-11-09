/* T17 RunTracker — giao diện CALO TRONG NGÀY (v2.5). Tính toán ở core/energy.js (T17Energy).
 *   - dòng kcal nhỏ ở đầu mỗi cột ngày (bấm → chi tiết ngày, sửa nền của ngày đó tại chỗ)
 *   - thẻ “Calo ngày” trong cột Tổng quan tuần (nền + tập = tổng, mỗi ngày một dòng)
 *   - phần Năng lượng trong Hồ sơ (công thức, PAL, số cố định, ghi đè, xem trước)
 *   - biểu đồ cột chồng trong Analytics › Tập luyện
 * CHỈ HIỂN THỊ: không bao giờ ghi số ước tính vào actual.calories. Mọi thay đổi chỉ nằm trong db.profile.energy.
 */
(function (root) {
'use strict';
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const E = () => root.T17Energy, C = () => root.T17Core;
const fmtK = v => v == null || !Number.isFinite(v) ? '—' : String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const DOW = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const dLabel = s => `${DOW[C().parseYmdLocal(s).getDay()]} ${s.slice(8, 10)}/${s.slice(5, 7)}`;
const DISCLAIMER = 'Ước tính theo công thức, sai số thường ±10–15%. Không phải tư vấn dinh dưỡng hay y tế.';
const COL = { base: '#9fb9da', ex: '#eb6834', plan: '#f6c3a9', avg: '#52606f' };
const srcTag = src => `<i class="en-src ${src}">${esc(E().SOURCE_LABEL[src] || src)}</i>`;
const todayYmd = () => C().ymd(new Date());

/* ---------- lịch: dòng kcal mỗi ngày ---------- */
function dayLine(date) {
  if (!date || typeof db === 'undefined') return '';
  let d; try { d = E().day(db, date); } catch (e) { return ''; }
  const future = date > todayYmd();
  if (!d.ok) return `<button type="button" class="day-kcal missing" data-energy-date="${esc(date)}" title="Chưa tính được calo: thiếu ${esc(d.missing.join(', '))}">kcal ?</button>`;
  const ex = d.exerciseKcal, plan = d.plannedKcal;
  const title = `Nền ${fmtK(d.baseline.kcal)} (${E().SOURCE_LABEL[d.baseline.source]}) + tập ${fmtK(ex)} = ${fmtK(d.total)} kcal${plan ? ` · dự kiến thêm ${fmtK(plan)}` : ''} — ước tính`;
  return `<button type="button" class="day-kcal${d.baseline.source !== 'auto' ? ' edited' : ''}${future ? ' future' : ''}" data-energy-date="${esc(date)}" title="${esc(title)}">🔥 <b>${fmtK(d.total)}</b>${plan && !ex ? `<small>(+${fmtK(plan)})</small>` : ''}</button>`;
}

/* ---------- thẻ Calo ngày trong Tổng quan tuần ---------- */
function renderWeek(w) {
  const host = $('energyWeek'); if (!host || !w || typeof db === 'undefined') return;
  const dates = (w.days || []).map(d => d.date).filter(Boolean).sort(); const all = dates.length ? E().days(db, dates[0], dates.at(-1)) : []; const list = all.filter(d => dates.includes(d.date));
  const ok = list.filter(d => d.ok);
  if (!ok.length) {
    const miss = [...new Set(list.flatMap(d => d.missing))];
    host.innerHTML = `<div class="en-empty">Chưa tính được: thiếu ${esc(miss.join(', ') || 'dữ liệu')}.<button type="button" data-en-profile>Cập nhật hồ sơ</button></div>`;
  } else {
    const hi = Math.max(...ok.map(d => d.total + d.plannedKcal), 1), today = todayYmd();
    const past = ok.filter(d => d.date <= today), avg = past.length ? past.reduce((a, d) => a + d.total, 0) / past.length : null;
    host.innerHTML = list.map(d => {
      if (!d.ok) return `<button type="button" class="en-row" data-energy-date="${d.date}"><span class="en-d">${dLabel(d.date)}</span><span class="en-miss">thiếu ${esc(d.missing.join(', '))}</span></button>`;
      const b = d.baseline.kcal, pctB = b / hi * 100, pctE = d.exerciseKcal / hi * 100, pctP = d.plannedKcal / hi * 100;
      return `<button type="button" class="en-row${d.date === today ? ' today' : ''}" data-energy-date="${d.date}" title="${esc(E().SOURCE_LABEL[d.baseline.source])}">
        <span class="en-d">${dLabel(d.date)}</span>
        <span class="en-bar"><i style="width:${pctB}%;background:${COL.base}"></i><i style="width:${pctE}%;background:${COL.ex}"></i>${pctP ? `<i class="pl" style="width:${pctP}%;background:${COL.plan}"></i>` : ''}</span>
        <span class="en-v"><b>${fmtK(d.total)}</b><small>${fmtK(b)}${d.exerciseKcal ? ` + ${fmtK(d.exerciseKcal)}` : ''}${d.plannedKcal ? ` · dự kiến +${fmtK(d.plannedKcal)}` : ''}</small></span>
        ${d.baseline.source !== 'auto' ? srcTag(d.baseline.source) : ''}</button>`;
    }).join('') + `<div class="en-foot"><span><i style="background:${COL.base}"></i>nền</span><span><i style="background:${COL.ex}"></i>tập</span><span><i style="background:${COL.plan}"></i>dự kiến</span>${avg != null ? `<b>TB ${fmtK(avg)} kcal/ngày</b>` : ''}</div>`;
  }
  host.insertAdjacentHTML('beforeend', `<div class="en-disc">${esc(DISCLAIMER)} Bấm một ngày để xem chi tiết / sửa nền.</div>`);
  host.querySelectorAll('[data-en-profile]').forEach(b => b.onclick = () => root.T17Profile.open());
}

/* ---------- chi tiết ngày ---------- */
function ensureDayModal() {
  if ($('energyDayModal')) return;
  document.body.insertAdjacentHTML('beforeend', `<div class="modal" id="energyDayModal"><div class="sheet en-sheet"><div class="sheet-head"><h2 id="enDayTitle">Calo ngày</h2><div class="meta">${esc(DISCLAIMER)}</div></div><div class="sheet-body" id="enDayBody"></div></div></div>`);
  $('energyDayModal').addEventListener('mousedown', e => { if (e.target === $('energyDayModal')) closeDay(); });
}
function closeDay() { const m = $('energyDayModal'); if (m) m.classList.remove('show'); }
function bmrText(b) {
  const i = b.inputs || {};
  if (!b.ok) return `<span class="en-bad">Chưa tính được — thiếu ${esc(b.missing.join(', '))}</span>`;
  const parts = [i.weightKg != null ? `${i.weightKg} kg (${esc(i.weightFrom)})` : '', b.method === 'katch' ? `${i.bodyFatPct}% mỡ` : '', b.method === 'mifflin' ? `${i.heightCm} cm · ${i.age} tuổi · ${i.sex === 'female' ? 'nữ' : 'nam'}` : ''].filter(Boolean);
  return `<b>${fmtK(b.kcal)}</b> kcal · ${esc(E().METHOD_LABEL[b.method])}${parts.length ? ` <small>(${parts.join(' · ')})</small>` : ''}`;
}
function openDay(date) {
  ensureDayModal();
  const d = E().day(db, date), s = E().settingsOf(db.profile), base = d.baseline;
  $('enDayTitle').textContent = `Calo ngày ${dLabel(date)}/${date.slice(0, 4)}`;
  const rows = d.sessions.map(x => `<tr class="${x.planned ? 'planned' : ''}"><td>${x.fitness ? '🏋' : '🏃'} ${esc(x.name)}</td><td>${x.skipped ? 'bỏ buổi' : x.planned ? 'dự kiến' : 'đã tập'}</td><td>${x.kcal == null ? `<span class="en-bad">thiếu ${esc((x.missing || []).join(', '))}</span>` : `${x.planned ? '~' : ''}${fmtK(x.kcal)}`}</td><td><small>${esc(E().METHOD_LABEL[x.method] || '')}${x.gross ? ` · tổng ${fmtK(x.gross)} − phần nghỉ` : ''}${x.met ? ` · MET ${String(x.met).replace('.', ',')}` : ''}</small></td></tr>`).join('');
  const autoBase = E().baseline({ ...db.profile, energy: { ...s, overrides: {} } }, db.bodyMetrics || [], date);
  $('enDayBody').innerHTML = `
    <div class="en-total"><div><span>Nền (hoạt động bình thường)</span><b>${base.ok ? fmtK(base.kcal) : '—'}</b>${base.ok ? srcTag(base.source) : ''}</div><div class="op">+</div><div><span>Tập (ròng)</span><b>${fmtK(d.exerciseKcal)}</b></div><div class="op">=</div><div class="sum"><span>Tổng ước tính</span><b>${d.total == null ? '—' : fmtK(d.total)}</b></div></div>
    ${d.plannedKcal ? `<div class="en-note">Bài kế hoạch chưa tập: dự kiến thêm ~${fmtK(d.plannedKcal)} kcal — <b>không</b> cộng vào tổng thực.</div>` : ''}
    <table class="an-table en-table"><tbody>
      <tr><td>BMR</td><td colspan="3">${bmrText(base.bmr)}</td></tr>
      <tr><td>Nền</td><td colspan="3">${base.source === 'auto' ? (base.ok ? `BMR × PAL ${String(base.pal).replace('.', ',')} = <b>${fmtK(base.kcal)}</b>` : '—') : base.source === 'manual' ? `Số cố định trong hồ sơ: <b>${fmtK(base.kcal)}</b>` : `Ghi đè cho ngày này: <b>${fmtK(base.kcal)}</b>`}${base.source !== 'auto' && autoBase.ok ? ` <small>(tự tính: ${fmtK(autoBase.kcal)})</small>` : ''}</td></tr>
    </tbody></table>
    <h3 class="pf-h">Buổi tập trong ngày</h3>
    ${rows ? `<table class="an-table en-table"><thead><tr><th>Bài</th><th>Trạng thái</th><th>kcal ròng</th><th>Cách tính</th></tr></thead><tbody>${rows}</tbody></table>` : '<div class="an-empty">Không có buổi tập.</div>'}
    <div class="en-note">Calo ròng = phần tăng thêm so với lúc nghỉ (đã trừ BMR theo thời gian tập) để không tính trùng với nền. Thứ tự ưu tiên: calo nhập tay → calo trong FIT → chạy 1,0 kcal/kg/km → fitness MET theo RPE. Số này chỉ hiển thị, không ghi vào kết quả buổi tập.</div>
    <h3 class="pf-h">Sửa nền của ngày này</h3>
    <div class="en-edit"><div class="field"><label>Calo nền ngày ${dLabel(date)} (kcal)</label><input id="enDayInput" type="text" inputmode="numeric" placeholder="${base.ok ? Math.round(base.kcal) : 'vd. 2200'}" value="${s.overrides[date] ?? ''}" /></div>
      <button type="button" class="primary" id="enDaySave">Lưu cho ngày này</button><button type="button" id="enDayReset" ${s.overrides[date] == null ? 'disabled' : ''}>Về giá trị tự tính</button></div>
    ${s.mode === 'manual' ? '<div class="en-note">Hồ sơ đang dùng số kcal cố định; bỏ ghi đè sẽ trở về số đó. Đổi trong Hồ sơ › Năng lượng.</div>' : ''}
    <div class="sheetactions"><button type="button" id="enDayProfile">Cài đặt năng lượng…</button><button type="button" id="enDayClose">Đóng</button></div>`;
  const apply = v => {
    try { db.profile = E().setOverride(db.profile, date, v); } catch (e) { $('enDayInput').classList.add('input-error'); return alert(e.message); }
    saveDb(); render({ preserveScroll: true }); refreshViews(); openDay(date); toast(v === '' || v == null ? 'Đã trở về giá trị tự tính' : 'Đã lưu calo nền cho ngày ' + dLabel(date));
  };
  $('enDaySave').onclick = () => { const v = $('enDayInput').value.trim(); if (!v) return apply(''); apply(v); };
  $('enDayReset').onclick = () => apply('');
  $('enDayInput').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); $('enDaySave').click(); } };
  $('enDayClose').onclick = closeDay;
  $('enDayProfile').onclick = () => { closeDay(); root.T17Profile.open(); setTimeout(() => $('pfEnSection')?.scrollIntoView({ block: 'start' }), 30); };
  $('energyDayModal').classList.add('show');
}

/* ---------- Hồ sơ › Năng lượng ---------- */
let pfDirty = false, pfOverrides = {};
function fillProfile(p) {
  const s = E().settingsOf(p); pfDirty = false; pfOverrides = { ...s.overrides };
  $('pfEnMode').value = s.mode; $('pfEnFormula').value = s.formula;
  const inTable = E().PAL_TABLE.some(x => x.pal === s.pal);
  $('pfEnPalSel').value = inTable ? String(s.pal) : 'custom'; $('pfEnPal').value = String(s.pal).replace('.', ','); $('pfEnPal').hidden = inTable;
  $('pfEnManual').value = s.baselineKcalManual ?? '';
}
function readSettings(base) {
  const sel = $('pfEnPalSel').value, pal = sel === 'custom' ? Number(String($('pfEnPal').value).replace(',', '.')) : Number(sel);
  const man = $('pfEnManual').value.trim();
  return { ...(base || {}), mode: $('pfEnMode').value, formula: $('pfEnFormula').value, pal, baselineKcalManual: man === '' ? null : Number(man.replace(',', '.')), overrides: { ...pfOverrides } };
}
function validate() {
  const sel = $('pfEnPalSel').value, pal = Number(String($('pfEnPal').value).replace(',', '.'));
  const palBad = sel === 'custom' && !(pal >= E().PAL_MIN && pal <= E().PAL_MAX);
  const man = $('pfEnManual').value.trim(), mv = Number(man.replace(',', '.'));
  const manBad = $('pfEnMode').value === 'manual' ? !(mv >= 500 && mv <= 8000) : (man !== '' && !(mv >= 500 && mv <= 8000));
  $('pfEnPal').classList.toggle('input-error', palBad); $('pfEnManual').classList.toggle('input-error', manBad);
  return palBad ? 'PAL tuỳ chỉnh phải trong khoảng 1,1–2,0.' : manBad ? 'Số kcal nền cố định phải trong khoảng 500–8000.' : '';
}
/** Xem trước BMR và nền HÔM NAY theo bản nháp hồ sơ (draft = hồ sơ đang nhập). */
function profilePreview(draft) {
  const host = $('pfEnPreview'); if (!host) return;
  $('pfEnPal').hidden = $('pfEnPalSel').value !== 'custom';
  $('pfEnManualField').classList.toggle('dim', $('pfEnMode').value !== 'manual');
  const err = validate(); const today = todayYmd();
  const prof = { ...draft, energy: E().normalizeSettings(readSettings()) };
  const b = E().baseline({ ...prof, energy: { ...prof.energy, overrides: {} } }, db.bodyMetrics || [], today);
  const auto = E().baseline({ ...prof, energy: { ...prof.energy, mode: 'auto', overrides: {} } }, db.bodyMetrics || [], today);
  host.innerHTML = `${err ? `<div class="en-bad">${esc(err)}</div>` : ''}
    <div>BMR hôm nay: ${bmrText(b.bmr)}</div>
    <div>Nền hôm nay: ${b.ok ? `<b>${fmtK(b.kcal)}</b> kcal ${srcTag(b.source)}${b.source === 'manual' && auto.ok ? ` <small>(tự tính: ${fmtK(auto.kcal)})</small>` : b.source === 'auto' ? ` <small>= BMR × ${String(b.pal).replace('.', ',')}</small>` : ''}` : `<span class="en-bad">thiếu ${esc(b.missing.join(', '))}</span>`}</div>`;
  const ov = Object.entries(pfOverrides).sort((a, b2) => b2[0].localeCompare(a[0]));
  $('pfEnOverrides').innerHTML = ov.length ? `<div class="en-ov-h">Ngày đã ghi đè (${ov.length})</div>${ov.slice(0, 30).map(([d, v]) => `<span class="en-ov">${dLabel(d)}/${d.slice(2, 4)}: <b>${fmtK(v)}</b><button type="button" data-en-ov="${d}" title="Bỏ ghi đè ngày này">✕</button></span>`).join('')}${ov.length > 30 ? `<small> … và ${ov.length - 30} ngày nữa</small>` : ''}` : '';
  $('pfEnOverrides').querySelectorAll('[data-en-ov]').forEach(x => x.onclick = () => { delete pfOverrides[x.dataset.enOv]; pfDirty = true; profilePreview(draft); });
}
/** Giá trị profile.energy để lưu; undefined = để nguyên (người dùng chưa từng thiết lập và không đụng tới). */
function readProfile(oldProfile) {
  if (!pfDirty && !(oldProfile && oldProfile.energy)) return undefined;
  return E().normalizeSettings(readSettings(oldProfile?.energy));
}
function initProfile(onChange) {
  const sel = $('pfEnPalSel'); if (!sel) return;
  sel.innerHTML = E().PAL_TABLE.map(x => `<option value="${x.pal}">${String(x.pal).replace('.', ',')} — ${esc(x.label)}</option>`).join('') + '<option value="custom">Tự nhập PAL (1,1–2,0)…</option>';
  ['pfEnMode', 'pfEnFormula', 'pfEnPalSel', 'pfEnPal', 'pfEnManual'].forEach(id => $(id).addEventListener('input', () => { pfDirty = true; onChange(); }));
  $('pfEnReset').onclick = () => { pfDirty = true; $('pfEnMode').value = 'auto'; $('pfEnFormula').value = 'auto'; $('pfEnPalSel').value = String(E().DEFAULT_PAL); $('pfEnPal').value = '1,3'; $('pfEnManual').value = ''; pfOverrides = {}; onChange(); };
}

/* ---------- Analytics: cột chồng nền + tập ---------- */
function chartCard({ weeksShown, chartW, tip }) {
  if (typeof db === 'undefined') return '';
  const today = todayYmd(), Cc = C();
  let first = today; for (const w of db.weeks || []) for (const d of w.days || []) if (d.date && (d.workouts || []).length && d.date < first) first = d.date;
  const start = weeksShown ? Cc.addDaysYmd(Cc.mondayYmd(today), -7 * (weeksShown - 1)) : Cc.mondayYmd(first < today ? first : Cc.addDaysYmd(today, -83));
  const list = E().days(db, start, today); const ok = list.filter(d => d.ok);
  const head = `<div class="an-card-head"><h3>Calo mỗi ngày (ước tính)</h3><div class="an-legend"><span><i style="background:${COL.base}"></i>Nền – hoạt động bình thường</span><span><i style="background:${COL.ex}"></i>Tập (ròng)</span><span><i style="background:${COL.avg}"></i>Trung bình</span></div></div>`;
  if (!ok.length) { const miss = [...new Set(list.flatMap(d => d.missing))]; return `<section class="an-card" id="anEnergy">${head}<div class="an-empty">Chưa tính được calo: thiếu ${esc(miss.join(', ') || 'dữ liệu')}. <button type="button" data-open-profile>Cập nhật hồ sơ</button></div></section>`; }
  const weekly = list.length > 56;
  const pts = weekly ? E().weekly(list).filter(w => w.days).map(w => ({ key: w.week, label: `Tuần ${Cc.mondayYmd(w.week).slice(8, 10)}/${w.week.slice(5, 7)}`, base: w.avgBaseline, ex: w.avgExercise, days: w.days }))
    : list.map(d => ({ key: d.date, label: dLabel(d.date), base: d.ok ? d.baseline.kcal : 0, ex: d.ok ? d.exerciseKcal : 0, src: d.ok ? d.baseline.source : '', miss: !d.ok }));
  const avg = ok.reduce((a, d) => a + d.total, 0) / ok.length, avgB = ok.reduce((a, d) => a + d.baseline.kcal, 0) / ok.length, avgE = ok.reduce((a, d) => a + d.exerciseKcal, 0) / ok.length;
  const W = chartW.full, H = 230, L = 48, R = 10, T = 12, B = 26, n = pts.length;
  const top = Math.max(...pts.map(p => p.base + p.ex), avg) * 1.08; const st = top > 4000 ? 1000 : 500; const hi = Math.ceil(top / st) * st;
  const Y = v => T + (1 - v / hi) * (H - T - B), slot = (W - L - R) / n, bw = Math.max(2, Math.min(26, slot * 0.7));
  let g = '';
  for (let v = 0; v <= hi; v += st) { const y = Y(v); g += `<line x1="${L}" x2="${W - R}" y1="${y}" y2="${y}" class="an-grid"/><text x="${L - 6}" y="${y + 4}" text-anchor="end" class="an-axis">${fmtK(v)}</text>`; }
  const every = Math.max(1, Math.ceil(n / Math.max(4, Math.floor(W / 70))));
  pts.forEach((p, i) => {
    const cx = L + slot * (i + 0.5);
    if (p.base > 0) g += `<rect x="${cx - bw / 2}" y="${Y(p.base)}" width="${bw}" height="${Y(0) - Y(p.base)}" fill="${COL.base}"${p.src && p.src !== 'auto' ? ' stroke="#356fca" stroke-width="1"' : ''}/>`;
    if (p.ex > 0) g += `<rect x="${cx - bw / 2}" y="${Y(p.base + p.ex)}" width="${bw}" height="${Y(p.base) - Y(p.base + p.ex)}" fill="${COL.ex}"/>`;
    if (i % every === 0) g += `<text x="${cx}" y="${H - 8}" text-anchor="middle" class="an-axis">${esc(weekly ? p.key.slice(8, 10) + '/' + p.key.slice(5, 7) : p.key.slice(8, 10) + '/' + p.key.slice(5, 7))}</text>`;
    g += `<rect class="en-hit" data-i="${i}" x="${L + slot * i}" y="${T}" width="${slot}" height="${H - T - B}" fill="transparent"/>`;
  });
  g += `<line x1="${L}" x2="${W - R}" y1="${Y(avg)}" y2="${Y(avg)}" stroke="${COL.avg}" stroke-width="1.5" stroke-dasharray="5 4"/><text x="${W - R}" y="${Y(avg) - 5}" text-anchor="end" class="an-axis" style="fill:${COL.avg};font-weight:800">TB ${fmtK(avg)}</text>`;
  setTimeout(() => {
    const svg = $('anEnergySvg'); if (!svg || !tip) return;
    svg.querySelectorAll('.en-hit').forEach(r => { const p = pts[+r.dataset.i];
      r.addEventListener('mousemove', e => tip.show(p.miss ? `<b>${esc(p.label)}</b><br>Chưa đủ dữ liệu` : `<b>${esc(p.label)}</b>${weekly ? ` · TB/ngày (${p.days} ngày)` : ''}<br><span style="color:${COL.base}">■</span> Nền ${fmtK(p.base)}${p.src && p.src !== 'auto' ? ` (${esc(E().SOURCE_LABEL[p.src])})` : ''}<br><span style="color:${COL.ex}">■</span> Tập ${fmtK(p.ex)}<br><b>Tổng ${fmtK(p.base + p.ex)} kcal</b>`, e.clientX, e.clientY));
      r.addEventListener('mouseleave', tip.hide);
      if (!weekly) r.addEventListener('click', () => openDay(p.key)); });
  }, 0);
  return `<section class="an-card" id="anEnergy">${head}
    <div class="en-kpis"><span>TB <b>${fmtK(avg)}</b> kcal/ngày</span><span>nền <b>${fmtK(avgB)}</b></span><span>tập <b>${fmtK(avgE)}</b></span><span>${ok.length}/${list.length} ngày tính được${weekly ? ' · mỗi cột = trung bình mỗi ngày của tuần' : ' · bấm cột để xem/sửa ngày'}</span></div>
    <svg id="anEnergySvg" class="an-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Calo mỗi ngày: nền và tập">${g}</svg>
    <div class="an-note">${esc(DISCLAIMER)} Viền xanh: ngày có nền do bạn sửa. Chỉ tính các ngày đến hôm nay; bài kế hoạch chưa tập không được cộng.</div></section>`;
}

function init() {
  document.addEventListener('click', e => { const b = e.target.closest('[data-energy-date]'); if (!b) return; e.stopPropagation(); openDay(b.dataset.energyDate); }, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDay(); });
}
root.T17EnergyUI = { validateProfile: () => document.getElementById('pfEnPalSel') ? validate() : '', dayLine, renderWeek, openDay, closeDay, fillProfile, profilePreview, readProfile, initProfile, chartCard, init, DISCLAIMER };
})(typeof globalThis !== 'undefined' ? globalThis : this);
