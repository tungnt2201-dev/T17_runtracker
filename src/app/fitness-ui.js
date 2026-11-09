/* T17 RunTracker — giao diện FITNESS (v2.3, lượt 2).
 *  - Tab "Fitness" trong hộp Thư viện: bài tập (xem / tìm / tạo / sửa / nhân bản / ảnh ≤ 60 KB / MET) và mẫu buổi.
 *  - Giao bài: chọn mẫu → chọn nhiều ngày hoặc lặp theo thứ trong N tuần → tạo buổi Fitness kế hoạch (không ghi đè).
 *  - Sửa danh sách bài của riêng một buổi; nhập kết quả tay (done từng bài, set/rep/kg, phút, calo, RPE, ghi chú).
 *  - Thẻ trên lịch; xuất buổi cho app mobile "T17 Run Training" (JSON v3, nhiều ngày → ZIP).
 * Logic thuần nằm ở core/fitness.js; file này chỉ DOM. Dùng các biến/hàm toàn cục của app.js (db, saveDb, render…).
 */
(function (root) {
'use strict';
const F = root.T17Fitness;
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const UI = () => root.T17UI;
const clone = x => JSON.parse(JSON.stringify(x));
const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const ROW_COLS = [['set', 'Set', 46], ['group', 'Rep / nhóm', 90], ['reps', 'Số rep', 60], ['time', 'Thời gian / quãng đường', 110], ['weight', 'Kg', 56], ['note', 'Ghi chú', 0]];

/* ---------------- dữ liệu ---------------- */
function library() { return F.normalizeLibrary(db.fitnessLibrary || []); }
function ensureLibrary() { db.fitnessLibrary = F.normalizeLibrary(db.fitnessLibrary || []); return db.fitnessLibrary; }
function userTemplates() { return (db.templates || []).filter(t => t && t.workoutType === F.FITNESS_TYPE); }
function templateEntries() {
  return [
    ...F.BUILTIN_TEMPLATES.map(t => ({ key: 'b:' + t.id, builtin: true, name: t.name, tpl: t, count: t.items.length, minutes: t.duration || '' })),
    ...userTemplates().map(t => ({ key: 'u:' + t.id, builtin: false, name: t.name, tpl: t, count: (t.fitness?.exercises || []).length, minutes: t.planMinutes ?? '' })),
  ];
}
const entryByKey = key => templateEntries().find(e => e.key === key) || null;
function itemAt(ref) { return db.weeks[ref?.wi]?.days?.[ref?.di]?.workouts?.[ref?.ii] || null; }
function freshRef(ref) { const r = resolveRef({ ...ref, id: ref.id || itemAt(ref)?.id }); return r; }

/* ---------------- dòng set / rep ---------------- */
function rowsTableHtml(rows, path, opts = {}) {
  const head = ROW_COLS.map(([, label, w]) => `<th${w ? ` style="width:${w}px"` : ''}>${label}</th>`).join('');
  const body = (rows || []).map((r, ri) => `<tr>${ROW_COLS.map(([k]) => `<td><input data-row="${path}" data-ri="${ri}" data-k="${k}" value="${esc(r[k])}"${opts.readonly ? ' disabled' : ''} /></td>`).join('')}${opts.readonly ? '' : `<td><button type="button" class="fx-icon" data-row-del="${path}" data-ri="${ri}" title="Xoá dòng">×</button></td>`}</tr>`).join('');
  return `<table class="fx-rows"><thead><tr>${head}${opts.readonly ? '' : '<th></th>'}</tr></thead><tbody>${body || `<tr><td colspan="${ROW_COLS.length + 1}" class="ui-muted">Chưa có dòng nào.</td></tr>`}</tbody></table>${opts.readonly ? '' : `<button type="button" class="fx-add-row" data-row-add="${path}">＋ Thêm dòng</button>`}`;
}
function nextRow(rows) { const last = rows[rows.length - 1]; const n = (Number(last?.set) || rows.length) + 1; return { set: String(n), group: last?.group || '', reps: last?.reps || '', time: last?.time || '', weight: last?.weight || '', note: '' }; }

/* ---------------- ảnh: thu nhỏ + nén ≤ 60 KB ---------------- */
function readDataUrl(file) { return new Promise((res, rej) => { if (file && file.size > 30 * 1048576) return rej(new Error('Ảnh quá lớn (trên 30 MB).')); const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(new Error('Không đọc được ảnh.')); fr.readAsDataURL(file); }); }
function loadImage(url) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('File không phải ảnh hợp lệ.')); im.src = url; }); }
async function compressImage(file) {
  if (!/^image\//.test(file.type || '')) throw new Error('Hãy chọn file ảnh (JPG, PNG, WEBP…).');
  const src = await readDataUrl(file);
  if (F.dataUrlBytes(src) <= F.IMAGE_MAX_BYTES && /^data:image\/(jpeg|png|webp|gif)/.test(src)) return { data: src, bytes: F.dataUrlBytes(src), note: 'giữ nguyên ảnh gốc' };
  const img = await loadImage(src);
  const canvas = document.createElement('canvas'); const ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) throw new Error('Trình duyệt không hỗ trợ nén ảnh. Hãy chọn ảnh nhỏ hơn 60 KB.');
  let maxDim = 900;
  for (let round = 0; round < 8 && maxDim >= 160; round++, maxDim = Math.round(maxDim * 0.78)) {
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
    canvas.width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale)); canvas.height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const q of [0.82, 0.7, 0.58, 0.46]) { const data = canvas.toDataURL('image/jpeg', q); const bytes = F.dataUrlBytes(data); if (bytes <= F.IMAGE_MAX_BYTES) return { data, bytes, note: `${canvas.width}×${canvas.height}px, chất lượng ${Math.round(q * 100)}%` }; }
  }
  throw new Error('Ảnh quá chi tiết, không nén được xuống dưới 60 KB. Hãy cắt bớt hoặc chọn ảnh khác.');
}
const kb = n => Math.round(n / 102.4) / 10 + ' KB';

/* ---------------- sửa bài tập trong thư viện ---------------- */
async function editExercise(id, opts = {}) {
  const lib = library(); const src = id ? lib.find(x => x.id === id) : null;
  const copy = !!opts.duplicate; const builtin = !!src?.builtin && !copy;
  const draft = src ? clone(src) : { id: '', builtin: false, name: '', category: '', plan: '', cue: '', caution: '', imageData: '', imageName: '', defaultRows: [{ set: '1', group: '', reps: '', time: '', weight: '', note: '' }] };
  if (copy) { draft.id = ''; draft.builtin = false; draft.name = (src?.name || 'Bài tập') + ' (bản sao)'; }
  const dis = builtin ? ' disabled' : '';
  const title = builtin ? `Bài dựng sẵn: ${draft.name}` : copy ? 'Nhân bản bài tập' : src ? 'Sửa bài tập' : 'Bài tập mới';
  const body = `${builtin ? '<div class="pf-note">Bài dựng sẵn (trích từ app mobile) không sửa nội dung được — bạn có thể gắn ảnh, MET, hoặc bấm “Nhân bản” ở thư viện để tạo bản sửa được.</div>' : ''}
    <div class="grid"><div class="field"><label>Tên bài *</label><input name="name" value="${esc(draft.name)}"${dis} /></div><div class="field"><label>Nhóm cơ</label><input name="category" value="${esc(draft.category)}" placeholder="Knee / Glute / Core…"${dis} /></div></div>
    <div class="grid"><div class="field"><label>Prescription / mô tả ngắn</label><input name="plan" value="${esc(draft.plan)}" placeholder="3 x 12 mỗi chân"${dis} /></div><div class="field"><label>MET (tuỳ chọn, tính calo)</label><input name="met" type="number" min="1" max="15" step="0.5" value="${esc(draft.met ?? '')}" placeholder="vd. 5" /></div></div>
    <div class="field"><label>Cách tập</label><textarea name="cue" rows="3"${dis}>${esc(draft.cue)}</textarea></div>
    <div class="field"><label>Chú ý</label><textarea name="caution" rows="2"${dis}>${esc(draft.caution)}</textarea></div>
    <div class="fx-image"><div class="fx-image-preview" data-img></div><div><input type="file" accept="image/*" data-img-file hidden /><button type="button" data-img-pick>🖼 Chọn ảnh (tự nén ≤ 60 KB)</button> <button type="button" data-img-del>Xoá ảnh</button><div class="ui-muted" data-img-note></div></div></div>
    <div class="fx-label">Dòng mẫu khi đưa bài vào buổi</div><div data-rows></div>`;
  return UI().uiForm({ title, body, okLabel: 'Lưu bài tập', cls: 'xwide',
    onReady: f => {
      const drawImg = () => { f.querySelector('[data-img]').innerHTML = draft.imageData ? `<img src="${esc(root.T17Fitness.safeImageData(draft.imageData))}" alt="">` : '<span class="ui-muted">Chưa có ảnh</span>'; f.querySelector('[data-img-del]').hidden = !draft.imageData; };
      const drawRows = () => { f.querySelector('[data-rows]').innerHTML = rowsTableHtml(draft.defaultRows, 'd', { readonly: builtin }); };
      drawImg(); drawRows();
      f.querySelector('[data-img-pick]').onclick = () => f.querySelector('[data-img-file]').click();
      f.querySelector('[data-img-del]').onclick = () => { draft.imageData = ''; draft.imageName = ''; f.querySelector('[data-img-note]').textContent = ''; drawImg(); };
      f.querySelector('[data-img-file]').onchange = async e => { const file = e.target.files && e.target.files[0]; e.target.value = ''; if (!file) return; const note = f.querySelector('[data-img-note]'); note.textContent = 'Đang nén ảnh…';
        try { const r = await compressImage(file); draft.imageData = r.data; draft.imageName = file.name; note.textContent = `Đã lưu ${kb(r.bytes)} (${r.note}).`; drawImg(); } catch (err) { note.textContent = '⚠ ' + (err.message || err); } };
      f.addEventListener('input', e => { const t = e.target; if (t.dataset.row) draft.defaultRows[+t.dataset.ri][t.dataset.k] = t.value; });
      f.addEventListener('click', e => { const a = e.target.closest('[data-row-add]'), d = e.target.closest('[data-row-del]');
        if (a) { draft.defaultRows.push(nextRow(draft.defaultRows)); drawRows(); } if (d) { draft.defaultRows.splice(+d.dataset.ri, 1); drawRows(); } });
    },
    collect: f => {
      const v = n => f.querySelector(`[name="${n}"]`).value.trim();
      const metRaw = v('met'), met = metRaw === '' ? null : Number(metRaw.replace(',', '.'));
      if (met != null && !(met >= 1 && met <= 15)) throw new Error('MET phải trong khoảng 1–15 (để trống nếu không dùng).');
      if (!builtin) { if (!v('name')) throw new Error('Chưa nhập tên bài.'); Object.assign(draft, { name: v('name'), category: v('category'), plan: v('plan'), cue: v('cue'), caution: v('caution') }); }
      if (met == null) delete draft.met; else draft.met = met;
      delete draft.unconfirmed; // đã xem và lưu = xác nhận
      return draft;
    } }).then(res => {
    if (!res) return null;
    const list = ensureLibrary();
    if (!res.id) { res.id = 'custom-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); list.push(res); }
    else { const i = list.findIndex(x => x.id === res.id); if (i >= 0) { list[i] = { ...list[i], ...res }; if (!res.unconfirmed) delete list[i].unconfirmed; } }
    db.fitnessLibrary = F.normalizeLibrary(list); saveDb(); renderPane(); toast('Đã lưu bài tập'); return res.id;
  });
}
function deleteExercise(id) {
  const x = library().find(e => e.id === id); if (!x || x.builtin) return;
  const used = userTemplates().filter(t => (t.fitness?.exercises || []).some(e => e.libraryId === id)).length;
  if (!confirm(`Xoá bài “${x.name}” khỏi thư viện?${used ? `\n\n${used} mẫu buổi đang dùng bài này — các mẫu vẫn giữ tên bài, chỉ mất ảnh/hướng dẫn.` : ''}\nCác buổi đã giao không bị ảnh hưởng.`)) return;
  db.fitnessLibrary = ensureLibrary().filter(e => e.id !== id); saveDb(); renderPane(); toast('Đã xoá bài tập');
}

/* ---------------- trình sửa buổi (mẫu / kế hoạch / kết quả) ---------------- */
/** mode: 'template' | 'plan' | 'result'. Trả về state đã sửa, null khi huỷ, {delete:true} khi xoá kết quả. */
function editSession({ title, message = '', mode, state }) {
  const st = clone(state); st.exercises = st.exercises || [];
  const result = mode === 'result';
  const lib = library();
  const libOptions = lib.map(x => `<option value="${esc(x.id)}">${esc(x.name)}${x.category ? ' · ' + esc(x.category) : ''}${x.builtin ? '' : ' (của bạn)'}</option>`).join('');
  const head = result
    ? `<div class="grid fx-grid4"><div class="field"><label>Trạng thái</label><select name="status"><option value="done">Đã tập</option><option value="missed">Không tập</option></select></div><div class="field"><label>Thời lượng (phút)</label><input name="minutes" type="number" min="0" step="1" /></div><div class="field"><label>Calo (kcal)</label><input name="calories" type="number" min="0" step="1" /></div><div class="field"><label>RPE (1–10)</label><input name="rpe" type="number" min="1" max="10" step="1" /></div></div><div class="field"><label>Ghi chú buổi</label><input name="note" placeholder="Cảm giác, đau mỏi…" /></div><div class="fx-progress" data-progress></div>`
    : `<div class="grid fx-grid3"><div class="field"><label>Tên buổi *</label><input name="workoutName" /></div><div class="field"><label>Thời lượng dự kiến (phút)</label><input name="duration" type="number" min="0" step="1" /></div><div class="field"><label>RPE dự kiến (tuỳ chọn)</label><input name="plannedRpe" type="number" min="1" max="10" step="1" placeholder="mặc định ${F.DEFAULT_RPE}" /></div></div><div class="field"><label>Ghi chú giáo án</label><input name="workoutNote" /></div>`;
  const body = `${head}<div class="fx-label">Danh sách bài</div><div data-ex></div><div class="fx-add-ex"><select data-pick>${libOptions}</select><button type="button" data-add-ex>＋ Thêm bài vào buổi</button></div>${result ? '<div class="sheetactions fx-left"><button type="button" class="danger" data-del-result>Xoá kết quả</button></div>' : ''}`;
  return UI().uiForm({ title, message, body, okLabel: result ? 'Lưu kết quả' : 'Lưu', cls: 'xwide',
    onReady: (f, done) => {
      const set = (n, v) => { const el = f.querySelector(`[name="${n}"]`); if (el) el.value = v ?? ''; };
      if (result) { set('status', st.status === 'missed' ? 'missed' : 'done'); set('minutes', st.minutes); set('calories', st.calories); set('rpe', st.rpe); set('note', st.note); }
      else { set('workoutName', st.workoutName); set('duration', st.duration); set('workoutNote', st.workoutNote); set('plannedRpe', st.plannedRpe); }
      const progress = () => { const p = f.querySelector('[data-progress]'); if (!p) return; const n = st.exercises.filter(e => e.done).length, t = st.exercises.length; p.innerHTML = `<b>${n}/${t}</b> bài hoàn thành <span class="fx-bar"><i style="width:${t ? Math.round(100 * n / t) : 0}%"></i></span> <button type="button" data-all>Tick tất cả</button>`; };
      const draw = () => {
        f.querySelector('[data-ex]').innerHTML = st.exercises.length ? st.exercises.map((e, i) => `<div class="fx-ex${result && e.done ? ' done' : ''}"><div class="fx-ex-head">${result ? `<label class="fx-done"><input type="checkbox" data-done="${i}"${e.done ? ' checked' : ''} /> Xong</label>` : ''}<b>${i + 1}. ${esc(e.name)}</b><span class="ui-muted">${esc([e.category, e.plan].filter(Boolean).join(' · '))}</span><span class="push"></span><button type="button" class="fx-icon" data-up="${i}" title="Lên"${i ? '' : ' disabled'}>↑</button><button type="button" class="fx-icon" data-down="${i}" title="Xuống"${i < st.exercises.length - 1 ? '' : ' disabled'}>↓</button><button type="button" class="fx-icon" data-rm="${i}" title="Bỏ bài khỏi buổi">✕</button></div>${rowsTableHtml(e.rows, 'e' + i)}</div>`).join('') : '<div class="lib-empty">Chưa có bài nào — chọn bài ở dưới rồi bấm “Thêm bài vào buổi”.</div>';
        progress();
      };
      draw();
      f.addEventListener('input', e => { const t = e.target; if (t.dataset.row) { const i = +t.dataset.row.slice(1); st.exercises[i].rows[+t.dataset.ri][t.dataset.k] = t.value; } });
      f.addEventListener('change', e => { const t = e.target; if (t.dataset.done != null) { st.exercises[+t.dataset.done].done = t.checked; t.closest('.fx-ex').classList.toggle('done', t.checked); progress(); } });
      f.addEventListener('click', e => {
        const b = e.target.closest('button'); if (!b) return;
        const ds = b.dataset; const mv = (i, j) => { const x = st.exercises.splice(i, 1)[0]; st.exercises.splice(j, 0, x); draw(); };
        if (ds.up != null) mv(+ds.up, +ds.up - 1);
        else if (ds.down != null) mv(+ds.down, +ds.down + 1);
        else if (ds.rm != null) { st.exercises.splice(+ds.rm, 1); draw(); }
        else if (ds.rowAdd) { const ex = st.exercises[+ds.rowAdd.slice(1)]; ex.rows.push(nextRow(ex.rows)); draw(); }
        else if (ds.rowDel) { st.exercises[+ds.rowDel.slice(1)].rows.splice(+ds.ri, 1); draw(); }
        else if (ds.addEx != null) { const x = lib.find(l => l.id === f.querySelector('[data-pick]').value); if (x) { st.exercises.push({ instanceId: '', libraryId: x.id, name: x.name, category: x.category, plan: x.plan, rows: clone(x.defaultRows), ...(result ? { done: true } : {}) }); draw(); } }
        else if (ds.all != null) { st.exercises.forEach(x => { x.done = true; }); draw(); }
        else if (ds.delResult != null) { if (confirm('Xoá kết quả của buổi này? (Kế hoạch vẫn giữ.)')) done({ delete: true }); }
      });
    },
    collect: f => {
      const v = n => (f.querySelector(`[name="${n}"]`)?.value ?? '').trim();
      const num = (n, lo, hi, label) => { const s = v(n); if (s === '') return ''; const x = Number(s.replace(',', '.')); if (!(x >= lo && x <= hi)) throw new Error(`${label} phải trong khoảng ${lo}–${hi}.`); return x; };
      if (result) return { ...st, status: v('status'), minutes: num('minutes', 0, 1000, 'Thời lượng'), calories: num('calories', 0, 10000, 'Calo'), rpe: num('rpe', 1, 10, 'RPE'), note: v('note') };
      if (!v('workoutName')) throw new Error('Chưa nhập tên buổi.');
      if (!st.exercises.length) throw new Error('Buổi cần ít nhất một bài.');
      return { ...st, workoutName: v('workoutName'), duration: num('duration', 0, 1000, 'Thời lượng'), workoutNote: v('workoutNote'), plannedRpe: num('plannedRpe', 1, 10, 'RPE dự kiến') };
    } });
}

/* ---------------- mẫu buổi ---------------- */
async function editTemplate(key, opts = {}) {
  const ent = key ? entryByKey(key) : null;
  const base = ent ? F.templateToSession(ent.tpl, db.fitnessLibrary) : { workoutName: '', duration: 45, workoutNote: '', exercises: [] };
  if (opts.duplicate) base.workoutName = (base.workoutName || 'Buổi') + ' (bản sao)';
  const plannedRpe = ent && !ent.builtin ? ent.tpl.fitness?.plannedRpe ?? '' : '';
  const st = await editSession({ title: ent && !opts.duplicate ? `Sửa mẫu buổi “${ent.name}”` : 'Mẫu buổi mới', mode: 'template', state: { ...base, plannedRpe } });
  if (!st) return;
  const rec = F.templateFromSession({ ...st, templateId: '' });
  if (st.plannedRpe !== '') rec.fitness.plannedRpe = st.plannedRpe;
  db.templates = db.templates || [];
  if (ent && !ent.builtin && !opts.duplicate) { const t = ent.tpl; const keep = { id: t.id }; Object.keys(t).forEach(k => delete t[k]); Object.assign(t, keep, rec, { savedAt: new Date().toISOString() }); }
  else db.templates.push({ id: genId('tpl'), ...rec, savedAt: new Date().toISOString() });
  saveDb(); renderPane(); toast('Đã lưu mẫu buổi');
}
function deleteTemplate(key) {
  const ent = entryByKey(key); if (!ent || ent.builtin) return;
  if (!confirm(`Xoá mẫu buổi “${ent.name}”? Các buổi đã giao không bị ảnh hưởng.`)) return;
  db.templates = db.templates.filter(t => t !== ent.tpl); saveDb(); renderPane(); toast('Đã xoá mẫu buổi');
}

/* ---------------- giao bài ---------------- */
async function assignDialog(presetKey = '') {
  const ents = templateEntries();
  const today = ymd(new Date()); const start = $('libraryDate')?.value || today;
  const body = `<div class="field"><label>Mẫu buổi</label><select name="tpl">${ents.map(e => `<option value="${esc(e.key)}"${e.key === presetKey ? ' selected' : ''}>${esc(e.name)} — ${e.count} bài${e.minutes ? ' · ' + e.minutes + ' phút' : ''}${e.builtin ? ' (dựng sẵn)' : ''}</option>`).join('')}</select></div>
    <div class="fx-modes"><label><input type="radio" name="mode" value="repeat" checked /> Lặp theo thứ trong tuần</label><label><input type="radio" name="mode" value="dates" /> Chọn từng ngày…</label></div>
    <div data-repeat><div class="fx-weekdays">${WEEKDAYS.map((d, i) => `<label><input type="checkbox" name="wd" value="${i}"${i === 1 || i === 4 ? ' checked' : ''} />${d}</label>`).join('')}</div>
    <div class="grid"><div class="field"><label>Bắt đầu từ ngày</label><input type="date" name="start" value="${esc(start)}" /></div><div class="field"><label>Số tuần</label><input type="number" name="weeks" min="1" max="52" value="4" /></div></div><div class="ui-muted" data-preview></div></div>`;
  const pick = await UI().uiForm({ title: 'Giao bài fitness vào lịch', message: 'Mỗi ngày được chọn có thêm một buổi kế hoạch. Buổi sẵn có không bị ghi đè; ngày đã có buổi chưa tập của cùng mẫu sẽ được bỏ qua.', body, okLabel: 'Tiếp tục', wide: true,
    onReady: f => {
      const upd = () => { const mode = f.querySelector('[name="mode"]:checked').value; f.querySelector('[data-repeat]').hidden = mode !== 'repeat';
        const ds = F.repeatDates(f.querySelector('[name="start"]').value, [...f.querySelectorAll('[name="wd"]:checked')].map(x => +x.value), f.querySelector('[name="weeks"]').value);
        f.querySelector('[data-preview]').textContent = ds.length ? `${ds.length} buổi: ${ds.slice(0, 6).map(d => fmtDate(d, true)).join(', ')}${ds.length > 6 ? '…' : ''}` : 'Chưa có ngày nào.'; };
      f.addEventListener('input', upd); f.addEventListener('change', upd); upd();
    },
    collect: f => { const mode = f.querySelector('[name="mode"]:checked').value; const key = f.querySelector('[name="tpl"]').value;
      if (mode === 'dates') return { key, mode };
      const dates = F.repeatDates(f.querySelector('[name="start"]').value, [...f.querySelectorAll('[name="wd"]:checked')].map(x => +x.value), f.querySelector('[name="weeks"]').value);
      if (!dates.length) throw new Error('Hãy chọn ít nhất một thứ trong tuần, ngày bắt đầu và số tuần.');
      return { key, mode, dates }; } });
  if (!pick) return null;
  let dates = pick.dates;
  if (pick.mode === 'dates') { dates = await UI().uiDates({ title: 'Chọn các ngày giao bài', message: entryByKey(pick.key)?.name || '', suggestions: [start], okLabel: 'Giao bài' }); if (!dates) return null; }
  return assign(pick.key, dates);
}
/** Giao mẫu `key` vào các ngày. Trả {added, skipped}. Không ghi đè; bỏ qua ngày đã có buổi chưa tập cùng mẫu. */
function assign(key, dates) {
  const ent = entryByKey(key); if (!ent) throw new Error('Không tìm thấy mẫu buổi.');
  const tplId = ent.tpl.id;
  let added = 0, skipped = 0;
  for (const date of [...new Set(dates)].sort()) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { skipped++; continue; }
    const loc = ensureDate(date); loc.d.workouts = loc.d.workouts || [];
    if (loc.d.workouts.some(w => w.fitness && w.fitness.templateId === tplId && !w.actual)) { skipped++; continue; }
    const rec = { id: genId(), ...F.planFromTemplate(ent.tpl, db.fitnessLibrary) };
    if (!ent.builtin && ent.tpl.fitness?.plannedRpe) rec.fitness.plannedRpe = ent.tpl.fitness.plannedRpe;
    loc.d.workouts.push(rec); added++;
  }
  if (added) { db.weeks.sort((a, b) => String(a.days?.[0]?.date || '').localeCompare(String(b.days?.[0]?.date || ''))); saveDb(); const loc = locateDate([...dates].sort()[0]); if (loc) currentWeek = loc.wi; render(); refreshViews(); }
  toast(`Đã giao ${added} buổi “${ent.name}”${skipped ? ` · bỏ qua ${skipped} ngày đã có` : ''}`);
  return { added, skipped };
}

/* ---------------- sửa buổi đã giao & nhập kết quả ---------------- */
async function openPlanEditor(ref) {
  const r = freshRef(ref); if (!r) return; const item = itemAt(r); const date = db.weeks[r.wi].days[r.di].date;
  const st = await editSession({ title: `Sửa buổi “${item.workoutName || 'Fitness'}”`, message: `${fmtDate(date)} · chỉ thay đổi buổi này, không đổi mẫu`, mode: 'plan',
    state: { workoutName: item.workoutName || '', duration: item.planMinutes ?? '', workoutNote: item.fitness?.workoutNote ?? item.planNote ?? '', plannedRpe: item.fitness?.plannedRpe ?? '', exercises: clone(item.fitness?.exercises || []) } });
  if (!st) return;
  const r2 = freshRef(r); if (!r2) return toast('Buổi tập không còn tồn tại.');
  const it = itemAt(r2); const sid = it.fitness?.sessionId || F.newSessionId();
  const exercises = F.prefixInstances(st.exercises.map(e => { const o = F.normalizeExercise(e); return o; }), sid);
  it.workoutName = st.workoutName; it.workoutType = F.FITNESS_TYPE; it.planMinutes = st.duration; it.planNote = st.workoutNote; it.workoutStructure = null;
  it.fitness = { ...(it.fitness || {}), schema: F.FITNESS_SCHEMA, sessionId: sid, workoutNote: st.workoutNote, exercises };
  if (st.plannedRpe !== '') it.fitness.plannedRpe = st.plannedRpe; else delete it.fitness.plannedRpe;
  it.description = F.summaryText(exercises);
  saveDb(); render({ preserveScroll: true }); refreshViews(); toast('Đã lưu buổi tập');
}
async function openResult(ref) {
  const r = freshRef(ref); if (!r) return; const item = itemAt(r); const date = db.weeks[r.wi].days[r.di].date; const a = item.actual;
  const planEx = item.fitness?.exercises || [];
  const exercises = a?.fitness?.exercises?.length ? clone(a.fitness.exercises) : planEx.map(e => ({ ...clone(e), done: false }));
  const res = await editSession({ title: `Kết quả: ${item.workoutName || 'Fitness'}`, message: `${fmtDate(date)} · tick bài đã tập, sửa set / rep / kg thực tế`, mode: 'result',
    state: { status: a?.status === 'missed' ? 'missed' : 'done', minutes: a ? a.minutes : (item.planMinutes ?? ''), calories: a?.calories ?? '', rpe: a?.fatigue ?? '', note: a?.note ?? '', exercises } });
  if (!res) return;
  const r2 = freshRef(r); if (!r2) return toast('Buổi tập không còn tồn tại.');
  const it = itemAt(r2);
  if (res.delete) { it.actual = null; saveDb(); render({ preserveScroll: true }); refreshViews(); return toast('Đã xoá kết quả'); }
  it.actual = F.buildActual(it.actual, { ...res, date }, it);
  saveDb(); render({ preserveScroll: true }); refreshViews();
  const c = F.completion(it); toast(res.status === 'missed' ? 'Đã ghi: không tập' : `Đã lưu kết quả · ${c ? `${c.done}/${c.total} bài` : ''}`);
}

/* ---------------- xuất cho app mobile ---------------- */
function mobileJson(item, date) { return JSON.stringify(F.toMobileData(item, date, db.fitnessLibrary), null, 2); }
async function exportMobile(ref) {
  const r = freshRef(ref); if (!r) return; const item = itemAt(r); const date = db.weeks[r.wi].days[r.di].date;
  const how = await UI().uiChoose({ title: 'Xuất cho app mobile “T17 Run Training”', message: 'Trên điện thoại: mở app → Nhập file → chọn file JSON. Lưu ý: app mobile thay thư viện bài của nó bằng thư viện trong file (thư viện T17 của bạn).',
    options: [{ label: `Chỉ buổi này (${fmtDate(date, true)})`, sub: 'Một file .json', value: 'one' }, { label: 'Nhiều buổi trong khoảng ngày…', sub: 'File .zip, mỗi buổi một file YYYY-MM-DD_tên-buổi.json', value: 'many' }] });
  if (!how) return;
  if (how === 'one') { const p = await saveBlob(new Blob([mobileJson(item, date)], { type: 'application/json' }), F.mobileFileName(date, item.workoutName)); if (p && !T17Platform.isDesktop) toast('Đã tạo file cho app mobile'); return; }
  const range = await UI().uiDateRange({ title: 'Xuất các buổi fitness', from: date, okLabel: 'Xuất ZIP' }); if (!range) return;
  return exportMobileRange(range.from, range.to);
}
function mobileFilesInRange(from, to) {
  const files = [], used = new Set();
  for (const w of db.weeks) for (const d of w.days) {
    if (!d.date || (from && d.date < from) || (to && d.date > to)) continue;
    for (const it of d.workouts || []) {
      if (!F.isFitnessWorkout(it) || it.fitStandalone) continue;
      let name = F.mobileFileName(d.date, it.workoutName); for (let k = 2; used.has(name); k++) name = F.mobileFileName(d.date, `${it.workoutName}-${k}`);
      used.add(name); files.push({ name, data: mobileJson(it, d.date) });
    }
  }
  return files;
}
async function exportMobileRange(from, to) {
  const files = mobileFilesInRange(from, to);
  if (!files.length) return toast('Không có buổi fitness nào trong khoảng ngày đã chọn');
  const zip = RunPlanXLSX.zipStore(files);
  await saveBlob(new Blob([zip], { type: 'application/zip' }), `T17_fitness_${from || 'dau'}_${to || 'cuoi'}.zip`);
  toast(`Đã xuất ${files.length} buổi (ZIP)`);
  return files.length;
}

/* ---------------- thẻ trên lịch ---------------- */
function loadDot(item) {
  const l = T17Load.plannedLoad(item, db.profile || {}); if (!l) return '';
  const lvl = l < 25 ? 'low' : l < 55 ? 'mid' : 'high';
  return `<span class="fx-load-dot ${lvl}" title="Tải dự kiến ~${Math.round(l)} (RPE × phút)"></span>`;
}
function cardHtml(item, date, wi, di, ii) {
  const [st, cls] = getStatus(item, date); const a = item.actual; const done = a && a.status !== 'missed';
  const plan = item.fitness?.exercises || []; const c = F.completion(item);
  const shown = done && a.fitness?.exercises?.length ? a.fitness.exercises : plan;
  const list = shown.slice(0, 6).map(e => `<li class="${done ? (e.done ? 'ok' : 'no') : ''}">${esc(e.name)}<span>${esc(F.exerciseBrief(e))}</span></li>`).join('') + (shown.length > 6 ? `<li class="more">+${shown.length - 6} bài</li>` : '');
  const metric = done
    ? `<div class="metric-strip"><div class="metric-strip-title"><span>Fitness</span><span>Actual</span></div><div class="metric-mini"><div><span>Bài</span><b>${c ? `${c.done}/${c.total}` : '—'}</b></div><div><span>RPE</span><b>${a.fatigue || '—'}</b></div><div><span>kcal</span><b>${a.calories || '—'}</b></div></div></div>`
    : `<div class="metric-strip"><div class="metric-strip-title"><span>Fitness</span><span>${a?.status === 'missed' ? 'No data' : 'Plan'}</span></div><div class="metric-placeholder">${plan.length} bài · ${item.planMinutes || '—'} phút ${loadDot(item)}</div></div>`;
  const vol = F.sessionVolume(done ? (a.fitness?.exercises || []) : plan);
  return `<article class="workout-card fitness ${cls}" draggable="true" data-open-wi="${wi}" data-open-di="${di}" data-open-ii="${ii}"><div class="statusbar"></div><div class="card-inner">${metric}<div class="workout-top"><div class="sport-icon">🏋</div><div class="workout-title">${esc(item.workoutName || 'Fitness')}</div><div class="workout-tools"><button class="workout-edit" type="button" data-edit-wi="${wi}" data-edit-di="${di}" data-edit-ii="${ii}" title="Sửa danh sách bài của buổi này">✎</button><button class="workout-copy" type="button" data-copy-wi="${wi}" data-copy-di="${di}" data-copy-ii="${ii}" title="Copy buổi sang ngày khác">⧉</button><button class="workout-mobile" type="button" data-mobile-wi="${wi}" data-mobile-di="${di}" data-mobile-ii="${ii}" title="Xuất cho app mobile (JSON / ZIP)">📱</button><button class="workout-delete" type="button" data-del-wi="${wi}" data-del-di="${di}" data-del-ii="${ii}" title="Xóa buổi">⌫</button><button class="workout-menu" type="button" data-menu-wi="${wi}" data-menu-di="${di}" data-menu-ii="${ii}" title="Nhập / sửa kết quả">⋮</button></div></div><div class="status-label">${esc(st)}</div><div class="key-line"><strong>${done ? (a.minutes ? actualDurationLabel(a.minutes) : '—') : (item.planMinutes || '—') + ' phút'}</strong><span>${done ? 'TT' : 'KH'}</span><strong>${plan.length} bài</strong><span>${vol.sets ? vol.sets + ' set' : ''}${vol.kg ? ' · ' + vol.kg + ' kg' : ''}</span></div>${loadChipHtml(item, date)}<ul class="fx-list">${list}</ul>${item.planNote ? `<div class="plan-note-small">${esc(item.planNote)}</div>` : ''}${done && a.note ? `<div class="plan-note-small">📝 ${esc(a.note)}</div>` : ''}</div></article>`;
}

/* ---------------- tab Fitness trong Thư viện ---------------- */
let paneQuery = '';
function renderPane() {
  const host = $('libFitPane'); if (!host || host.hidden) return;
  const q = norm(paneQuery); const lib = library();
  const ex = lib.filter(x => !q || norm([x.name, x.category, x.plan].join(' ')).includes(q));
  const tpls = templateEntries().filter(e => !q || norm(e.name).includes(q));
  host.querySelector('[data-fx-tpls]').innerHTML = tpls.map(e => {
    const sess = F.templateToSession(e.tpl, db.fitnessLibrary);
    return `<div class="lib-card fx-tpl"><div class="lib-card-head"><div class="lib-card-title">${esc(e.name)}</div><span class="lib-type-badge">${e.builtin ? 'Dựng sẵn' : 'Của bạn'}</span></div><div class="lib-meta2">${e.count} bài${e.minutes ? ' · ' + esc(e.minutes) + ' phút' : ''}</div><ol class="fx-mini">${sess.exercises.slice(0, 6).map(x => `<li>${esc(x.name)}</li>`).join('')}${sess.exercises.length > 6 ? `<li class="more">+${sess.exercises.length - 6} bài</li>` : ''}</ol><div class="lib-actions2"><button type="button" class="primary" data-fx-assign="${esc(e.key)}">📅 Giao bài</button>${e.builtin ? '' : `<button type="button" data-fx-tpl-edit="${esc(e.key)}">✎ Sửa</button>`}<button type="button" data-fx-tpl-dup="${esc(e.key)}">⧉ Nhân bản</button>${e.builtin ? '' : `<button type="button" class="danger" data-fx-tpl-del="${esc(e.key)}">Xóa</button>`}</div></div>`;
  }).join('') || '<div class="lib-empty">Không có mẫu buổi nào khớp.</div>';
  host.querySelector('[data-fx-count]').textContent = `${ex.length} / ${lib.length} bài`;
  host.querySelector('[data-fx-ex]').innerHTML = ex.map(x => `<div class="lib-card fx-exc">${x.imageData ? `<img class="fx-thumb" src="${esc(root.T17Fitness.safeImageData(x.imageData))}" alt="">` : ''}<div class="lib-card-head"><div class="lib-card-title">${esc(x.name)}</div><span class="lib-type-badge">${x.builtin ? 'Dựng sẵn' : 'Của bạn'}</span>${x.unconfirmed ? '<span class="lib-type-badge fx-unconf" title="Bài được thêm khi nhập file app fitness — kiểm tra rồi bấm Xác nhận">Chưa xác nhận</span>' : ''}</div><div class="lib-meta2">${esc(x.category || 'Chưa phân nhóm')} · ${esc(x.plan || '—')}${x.met ? ` · MET ${x.met}` : ''}</div>${x.cue ? `<div class="fx-cue">${esc(x.cue)}</div>` : ''}<div class="lib-actions2"><button type="button" data-fx-ex-edit="${esc(x.id)}">${x.builtin ? '🖼 Ảnh / MET' : '✎ Sửa'}</button>${x.unconfirmed ? `<button type="button" class="primary" data-fx-ex-ok="${esc(x.id)}">✓ Xác nhận</button>` : ''}<button type="button" data-fx-ex-dup="${esc(x.id)}">⧉ Nhân bản</button>${x.builtin ? '' : `<button type="button" class="danger" data-fx-ex-del="${esc(x.id)}">Xóa</button>`}</div></div>`).join('') || '<div class="lib-empty">Không có bài nào khớp.</div>';
}
function setLibraryTab(tab) {
  const fit = tab === 'fitness';
  $('libRunPane').hidden = fit; $('libFitPane').hidden = !fit;
  document.querySelectorAll('[data-libtab]').forEach(b => b.classList.toggle('active', b.dataset.libtab === tab));
  const runOnly = ['libraryCreateBtn']; runOnly.forEach(id => { const el = $(id); if (el) el.hidden = fit; });
  if (fit) renderPane();
}

function init() {
  document.querySelectorAll('[data-libtab]').forEach(b => b.onclick = () => setLibraryTab(b.dataset.libtab));
  const pane = $('libFitPane'); if (!pane) return;
  pane.querySelector('[data-fx-search]').addEventListener('input', e => { paneQuery = e.target.value; renderPane(); });
  pane.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return; const ds = b.dataset;
    if (ds.fxAssign) assignDialog(ds.fxAssign);
    else if (ds.fxTplEdit) editTemplate(ds.fxTplEdit);
    else if (ds.fxTplDup) editTemplate(ds.fxTplDup, { duplicate: true });
    else if (ds.fxTplDel) deleteTemplate(ds.fxTplDel);
    else if (ds.fxExEdit) editExercise(ds.fxExEdit);
    else if (ds.fxExDup) editExercise(ds.fxExDup, { duplicate: true });
    else if (ds.fxExDel) deleteExercise(ds.fxExDel);
    else if (ds.fxExOk) { const x = ensureLibrary().find(e => e.id === ds.fxExOk); if (x) { delete x.unconfirmed; saveDb(); renderPane(); toast('Đã xác nhận bài tập'); } }
    else if (ds.fxNewEx != null) editExercise('');
    else if (ds.fxNewTpl != null) editTemplate('');
    else if (ds.fxAssignAny != null) assignDialog('');
  });
  // Nút 📱 trên thẻ: lịch được vẽ lại liên tục nên bắt sự kiện ở khung chứa.
  $('days').addEventListener('click', e => { const b = e.target.closest('[data-mobile-wi]'); if (!b) return; e.stopPropagation(); exportMobile({ wi: +b.dataset.mobileWi, di: +b.dataset.mobileDi, ii: +b.dataset.mobileIi }); });
}

root.T17FitnessUI = { init, cardHtml, openPlanEditor, openResult, assign, assignDialog, editTemplate, editExercise, exportMobile, exportMobileRange, mobileFilesInRange, setLibraryTab, renderPane, compressImage };
})(typeof globalThis !== 'undefined' ? globalThis : this);
