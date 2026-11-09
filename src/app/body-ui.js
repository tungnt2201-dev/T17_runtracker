/* T17 RunTracker — giao diện CHỈ SỐ CƠ THỂ (v2.4, lượt 4).
 *  - Nút 📏 ở thanh trái và trong menu người dùng → hộp "Chỉ số cơ thể": thẻ tóm tắt (mới nhất + so với lần trước / 30 ngày / lần đầu),
 *    xu hướng cân nặng, bảng lịch sử (sửa / xoá, lọc khoảng ngày), nhập / xuất CSV.
 *  - Hộp nhập số đo tại một thời điểm: mọi ô tuỳ chọn, hiện "so với lần trước" ngay khi gõ, cảnh báo (không chặn).
 *  - Sau khi lưu cân nặng mới nhất: hỏi cập nhật cân nặng trong hồ sơ (nhớ lựa chọn).
 * Logic thuần ở core/body.js. Dữ liệu: db.bodyMetrics của NGƯỜI DÙNG ĐANG CHỌN.
 */
(function (root) {
'use strict';
const B = root.T17Body;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const UI = () => root.T17UI;
const GROUPS = [['body', 'Cân & thành phần cơ thể'], ['tape', 'Số đo vòng (thước dây)'], ['other', 'Khác']];
const SUMMARY_KEYS = ['weightKg', 'bodyFatPct', 'muscleKg', 'waistCm', 'bmi', 'ffmKg', 'whr', 'visceralFat', 'waterPct', 'hipCm', 'hrRest'];
const REFS = [['prev', { kind: 'prev' }, 'lần trước'], ['d30', { kind: 'days', days: 30 }, '30 ngày'], ['first', { kind: 'first' }, 'lần đầu']];

function list() { return B.normalizeList(db.bodyMetrics || []); }
function profile() { return db.profile || {}; }
const fmtNum = (v, dec) => v == null || v === '' ? '—' : (Math.round(v * 10 ** dec) / 10 ** dec).toLocaleString('vi-VN', { maximumFractionDigits: dec });
const fmtDay = d => d ? d.split('-').reverse().join('/') : '';
function deltaHtml(c, dec) {
  if (!c) return '<span class="bd-d neutral">—</span>';
  const arrow = c.delta > 0 ? '▲' : c.delta < 0 ? '▼' : '＝'; const sign = c.delta > 0 ? '+' : '';
  const far = c.near === false ? ` <i title="Không có số đo trong ±${B.NEAR_DAYS} ngày quanh ${fmtDay(c.target)}; dùng bản ${fmtDay(c.refDate)} (lệch ${Math.abs(c.offsetDays)} ngày)">~${Math.abs(c.offsetDays)}n</i>` : '';
  return `<span class="bd-d ${c.assess}" title="So với ${fmtDay(c.refDate)}${c.refTime ? ' ' + c.refTime : ''}: ${fmtNum(c.from, dec)}">${arrow} ${sign}${fmtNum(c.delta, dec)}${c.unit && c.unit !== 'mức' ? ' ' + esc(c.unit) : ''}${c.pct != null && c.delta ? ` <small>(${sign}${fmtNum(c.pct, 1)}%)</small>` : ''}${far}</span>`;
}

/* ---------------- hộp chính ---------------- */
function renderSummary() {
  const l = list(); const p = profile(); const last = B.latestByField(l, p);
  const cards = SUMMARY_KEYS.filter(k => last.has(k)).map(k => {
    const f = B.FIELD_BY_KEY.get(k); const r = last.get(k); const v = B.valueOf(r, k, p);
    const rows = REFS.map(([id, ref, label]) => { const c = B.compare(l, r, ref, p).find(x => x.key === k); return `<div class="bd-ref"><span>${label}</span>${deltaHtml(c, f.dec)}</div>`; }).join('');
    return `<div class="bd-card" data-key="${k}"><div class="bd-card-head"><span>${esc(f.label)}</span><small>${fmtDay(r.date)}${r.time ? ' ' + r.time : ''}</small></div><div class="bd-val">${fmtNum(v, f.dec)} <small>${esc(f.unit)}</small></div>${rows}</div>`;
  });
  $('bdSummary').innerHTML = cards.length ? cards.join('') : '<div class="lib-empty">Chưa có số đo nào. Bấm “＋ Nhập số đo” — chỉ cần cân nặng cũng được — hoặc nhập CSV từ cân thông minh.</div>';
  const t = B.trend(l, 'weightKg');
  const goal = Number(String(p.weightGoalKg ?? '').replace(',', '.'));
  $('bdTrend').innerHTML = t.points.length ? `Cân nặng: trung bình 7 ngày <b>${fmtNum(t.lastMa7, 1)} kg</b>${t.slopePerWeek != null ? ` · xu hướng <b>${t.slopePerWeek > 0 ? '+' : ''}${fmtNum(t.slopePerWeek, 2)} kg/tuần</b> (28 ngày gần nhất)` : ''}${goal > 0 ? ` · mục tiêu ${fmtNum(goal, 1)} kg` : ' · đặt “Cân nặng mục tiêu” trong Hồ sơ để tô màu so sánh cân nặng'}` : '';
}
function renderTable() {
  const from = $('bdFrom').value, to = $('bdTo').value; const p = profile();
  const rows = list().filter(r => (!from || r.date >= from) && (!to || r.date <= to)).reverse();
  const cols = B.FIELDS.filter(f => rows.some(r => typeof r[f.key] === 'number'));
  const showBmi = rows.some(r => B.derived(r, p).bmi != null);
  $('bdTable').innerHTML = rows.length ? `<thead><tr><th>Ngày</th><th>Giờ</th>${cols.map(f => `<th>${esc(f.label)}<small> ${esc(f.unit)}</small></th>`).join('')}${showBmi ? '<th>BMI</th>' : ''}<th>Ghi chú</th><th></th></tr></thead><tbody>${rows.map(r => `<tr><td>${fmtDay(r.date)}</td><td>${r.time || ''}</td>${cols.map(f => `<td>${typeof r[f.key] === 'number' ? fmtNum(r[f.key], f.dec) : ''}</td>`).join('')}${showBmi ? `<td>${fmtNum(B.derived(r, p).bmi, 1)}</td>` : ''}<td class="bd-note">${esc(r.note || '')}</td><td class="bd-act"><button type="button" class="fx-icon" data-bd-edit="${esc(r.id)}" title="Sửa">✎</button><button type="button" class="fx-icon" data-bd-del="${esc(r.id)}" title="Xoá">⌫</button></td></tr>`).join('')}</tbody>`
    : `<tbody><tr><td class="ui-muted">${list().length ? 'Không có số đo trong khoảng ngày đã chọn.' : ''}</td></tr></tbody>`;
}
function renderAll() { if (!$('bodyModal').classList.contains('show')) return; $('bdTitle').textContent = `Chỉ số cơ thể — ${T17Platform.activeUser().name}`; renderSummary(); renderTable(); }
function open() { $('bodyModal').classList.add('show'); renderAll(); }
function close() { $('bodyModal').classList.remove('show'); }

/* ---------------- hộp nhập số đo ---------------- */
function editRecord(id) {
  const all = list(); const src = id ? all.find(r => r.id === id) : null; const now = B.nowLocal();
  const draft = src ? { ...src } : { date: now.date, time: now.time };
  const field = f => `<div class="field bd-field"><label>${esc(f.label)} <small>${esc(f.unit)}</small></label><input name="${f.key}" inputmode="decimal" autocomplete="off" value="${typeof draft[f.key] === 'number' ? String(draft[f.key]).replace('.', ',') : ''}" /><small class="bd-cmp" data-cmp="${f.key}"></small></div>`;
  const body = `<div class="grid bd-when"><div class="field"><label>Ngày đo</label><input type="date" name="date" value="${esc(draft.date)}" /></div><div class="field"><label>Giờ (tuỳ chọn)</label><input type="time" name="time" value="${esc(draft.time || '')}" /></div></div>
    ${GROUPS.map(([g, title]) => `<div class="fx-label">${title}</div><div class="bd-grid">${B.FIELDS.filter(f => f.group === g).map(field).join('')}</div>`).join('')}
    <div class="field"><label>Ghi chú</label><input name="note" value="${esc(draft.note || '')}" placeholder="vd. sau khi ngủ dậy, trước ăn sáng" /></div>
    <div class="bd-derived" data-derived></div><div class="bd-warn" data-warn></div>`;
  return UI().uiForm({ title: src ? 'Sửa số đo' : 'Nhập số đo cơ thể', message: 'Mọi ô đều tuỳ chọn — nhập mỗi cân nặng cũng được. Số thập phân dùng dấu phẩy hoặc chấm.', body, okLabel: 'Lưu số đo', cls: 'xwide',
    onReady: f => {
      const read = () => { const r = { id: src?.id || '', date: f.querySelector('[name=date]').value, time: f.querySelector('[name=time]').value, note: f.querySelector('[name=note]').value.trim() }; for (const x of B.FIELDS) { const v = f.querySelector(`[name="${x.key}"]`).value; if (v.trim() !== '') r[x.key] = B.num(v, x.key); } return r; };
      const live = () => {
        const r = read(); const p = profile();
        const cmp = r.date ? B.compare(all.filter(x => x.id !== src?.id), { ...r, id: r.id || '__draft' }, { kind: 'prev' }, p) : [];
        f.querySelectorAll('[data-cmp]').forEach(el => { const c = cmp.find(x => x.key === el.dataset.cmp); el.innerHTML = c ? `so với ${fmtDay(c.refDate)}: ${deltaHtml(c, B.FIELD_BY_KEY.get(c.key).dec)}` : ''; });
        const d = B.derived(r, p);
        f.querySelector('[data-derived]').innerHTML = [d.bmi != null ? `BMI <b>${fmtNum(d.bmi, 1)}</b>` : (r.weightKg != null && !p.heightCm ? 'Nhập chiều cao trong Hồ sơ để tính BMI' : ''), d.ffmKg != null ? `Khối nạc (FFM) <b>${fmtNum(d.ffmKg, 1)} kg</b>` : '', d.whr != null ? `Eo/hông <b>${fmtNum(d.whr, 2)}</b>` : ''].filter(Boolean).join(' · ');
        f.querySelector('[data-warn]').innerHTML = B.warnings(r).map(w => `<div>⚠ ${esc(w.message)}</div>`).join('');
      };
      f.addEventListener('input', live); f.addEventListener('change', live); live();
    },
    collect: f => {
      const r = { id: src?.id, date: f.querySelector('[name=date]').value, time: f.querySelector('[name=time]').value, note: f.querySelector('[name=note]').value.trim(), source: src?.source || 'manual' };
      for (const x of B.FIELDS) { const raw = f.querySelector(`[name="${x.key}"]`).value.trim(); if (!raw) continue; const n = B.num(raw, x.key); if (n === '') throw new Error(`${x.label}: “${raw}” không phải số.`); r[x.key] = n; }
      if (!r.date) throw new Error('Chưa chọn ngày đo.');
      const rec = B.normalizeRecord({ ...src, ...Object.fromEntries(B.KEYS.map(k => [k, undefined])), ...r }); if (!rec) throw new Error('Chưa nhập số đo nào.');
      for (const k of B.KEYS) if (rec[k] === undefined) delete rec[k];
      return rec;
    } }).then(async rec => {
    if (!rec) return null;
    const cur = list(); const i = cur.findIndex(x => x.id === rec.id);
    if (i >= 0) cur[i] = rec; else cur.push(rec);
    db.bodyMetrics = B.normalizeList(cur); saveDb(); renderAll();
    toast(src ? 'Đã sửa số đo' : 'Đã lưu số đo');
    await maybeSyncWeight(rec);
    return rec;
  });
}
/** Hỏi cập nhật cân nặng trong hồ sơ khi bản ghi là cân nặng MỚI NHẤT. Nhớ lựa chọn "luôn" / "không bao giờ" (db.profile.bodyWeightSync). */
async function maybeSyncWeight(rec) {
  if (typeof rec.weightKg !== 'number') return;
  const latest = B.latestByField(list(), profile()).get('weightKg'); if (!latest || latest.id !== rec.id) return;
  const p = db.profile = db.profile || {}; if (Number(p.weightKg) === rec.weightKg) return;
  let ans = p.bodyWeightSync === 'always' ? 'yes' : p.bodyWeightSync === 'never' ? 'no' : null;
  if (!ans) {
    ans = await UI().uiChoose({ title: 'Cập nhật cân nặng trong hồ sơ?', message: `Hồ sơ đang ghi ${p.weightKg ? p.weightKg + ' kg' : 'chưa có cân nặng'}; số đo mới nhất là ${String(rec.weightKg).replace('.', ',')} kg (dùng cho hồ sơ VĐV và tính calo).`,
      options: [{ label: 'Cập nhật', value: 'yes' }, { label: 'Không', value: 'no' }, { label: 'Luôn tự cập nhật, không hỏi lại', value: 'always' }, { label: 'Không cập nhật, không hỏi lại', value: 'never' }] });
    if (!ans) return;
    if (ans === 'always' || ans === 'never') { p.bodyWeightSync = ans; ans = ans === 'always' ? 'yes' : 'no'; }
  }
  if (ans === 'yes') { p.weightKg = rec.weightKg; p.updatedAt = new Date().toISOString(); toast(`Đã cập nhật cân nặng hồ sơ: ${String(rec.weightKg).replace('.', ',')} kg`); }
  saveDb(); refreshViews();
}
function deleteRecord(id) {
  const r = list().find(x => x.id === id); if (!r) return;
  if (!confirm(`Xoá số đo ngày ${fmtDay(r.date)}${r.time ? ' ' + r.time : ''}?`)) return;
  db.bodyMetrics = list().filter(x => x.id !== id); saveDb(); renderAll(); toast('Đã xoá số đo');
}

/* ---------------- CSV ---------------- */
async function importCsvText(text, name = 'file') {
  const res = B.parseCsv(text);
  if (!res.records.length) { alert(`Không đọc được số đo nào trong “${name}”.\n\n` + res.errors.slice(0, 6).map(e => `• ${e.row ? 'Dòng ' + e.row + ': ' : ''}${e.message}`).join('\n')); return null; }
  const errs = res.errors.length ? `\nBỏ qua ${res.errors.length} dòng lỗi (dòng ${res.errors.slice(0, 5).map(e => e.row).join(', ')}${res.errors.length > 5 ? '…' : ''}).` : '';
  const unk = res.unknownColumns.length ? `\nCột không dùng: ${res.unknownColumns.slice(0, 6).join(', ')}.` : '';
  if (!confirm(`“${name}”: đọc được ${res.records.length} lần đo (${res.records[0].date.split('-').reverse().join('/')} → ${res.records[res.records.length - 1].date.split('-').reverse().join('/')}).${errs}${unk}\n\nGộp vào số đo của “${T17Platform.activeUser().name}”? Lần đo trùng ngày + giờ không bị nhân đôi.`)) return null;
  const m = B.merge(db.bodyMetrics || [], res.records);
  db.bodyMetrics = m.list; saveDb(); renderAll();
  toast([`thêm ${m.added}`, m.merged && `bổ sung ${m.merged}`, m.duplicates && `trùng ${m.duplicates}`, m.conflicts && `${m.conflicts} khác giá trị (giữ bản đang có)`].filter(Boolean).join(' · '));
  const latest = B.latestByField(m.list, profile()).get('weightKg'); if (latest && m.added) await maybeSyncWeight(latest);
  return m;
}
function exportCsv() {
  const l = list(); if (!l.length) return toast('Chưa có số đo để xuất');
  const name = `T17_ChiSoCoThe_${T17Platform.activeUserId() === 'main' ? '' : T17Users.slug(T17Platform.activeUser().name) + '_'}${ymd(new Date())}.csv`;
  saveBlob(new Blob([B.toCsv(l)], { type: 'text/csv;charset=utf-8' }), name);
}

function init() {
  const openBtn = () => { const m = $('userMenu'); if (m) m.hidden = true; open(); };
  $('railBody').onclick = openBtn; $('userBodyBtn').onclick = openBtn;
  $('bdClose').onclick = close; $('bodyModal').addEventListener('mousedown', e => { if (e.target === $('bodyModal')) close(); });
  $('bdAdd').onclick = () => editRecord('');
  $('bdExportCsv').onclick = exportCsv;
  $('bdImportCsv').onclick = () => { $('bdCsvFile').value = ''; $('bdCsvFile').click(); };
  $('bdCsvFile').addEventListener('change', async e => { const f = e.target.files && e.target.files[0]; if (!f) return; try { await importCsvText(await readFileText(f), f.name); } catch (err) { alert('Nhập CSV lỗi: ' + (err.message || err)); } finally { e.target.value = ''; } });
  $('bdFrom').addEventListener('change', renderTable); $('bdTo').addEventListener('change', renderTable);
  $('bdClearFilter').onclick = () => { $('bdFrom').value = ''; $('bdTo').value = ''; renderTable(); };
  $('bdTable').addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.bdEdit) editRecord(b.dataset.bdEdit); else if (b.dataset.bdDel) deleteRecord(b.dataset.bdDel); });
}
root.T17BodyUI = { init, open, close, editRecord, importCsvText, exportCsv, renderAll, maybeSyncWeight };
})(typeof globalThis !== 'undefined' ? globalThis : this);
