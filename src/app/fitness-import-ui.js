/* T17 RunTracker — giao diện NHẬP file app fitness (v2.3, lượt 3).
 * Gắn vào các nút sẵn có: "Nhập bài tập / Training Log", "Import FIT", "Import Excel", "Khôi phục".
 * classify(files) tách file của app fitness (JSON v1/v2/v3, Excel Session + Workout Log, ZIP chứa chúng) khỏi phần còn lại;
 * importSources() mở hộp xem trước rồi ghi vào lịch của NGƯỜI DÙNG ĐANG CHỌN (tự sao lưu trước khi gộp).
 * Logic thuần ở core/fitness-import.js.
 */
(function (root) {
'use strict';
const I = root.T17FitnessImport, F = root.T17Fitness, L = root.T17Legacy;
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const TD = new TextDecoder();
const isJson = n => /\.json$/i.test(n), isXlsx = n => /\.xlsx$/i.test(n), isZip = n => /\.zip$/i.test(n), isFit = n => /\.fit$/i.test(n);
const MAX_BYTES = 45 * 1024 * 1024;

async function bytesOf(file) { const b = new Uint8Array(await readFileArrayBuffer(file)); if (b.length > MAX_BYTES) throw new Error('Tệp vượt 45 MB.'); return b; }
async function classifyEntry(name, bytes, sources) {
  if (isJson(name)) {
    let data; try { data = L.parseJsonText(TD.decode(bytes)); } catch (e) { sources.push({ name, error: 'File JSON bị hỏng: ' + (e.message || e) }); return 'fitness'; }
    if (F.mobileKind(data)) { sources.push({ name, data }); return 'fitness'; }
    return 'other';
  }
  if (isXlsx(name)) {
    let wb; try { wb = await RunPlanXLSX.readSheets(bytes); } catch (e) { return 'other'; }
    if (I.isMobileWorkbook(wb.names)) { sources.push({ name, data: { sheets: wb.sheets } }); return 'fitness'; }
    return 'other';
  }
  return isFit(name) ? 'fit' : 'ignore';
}
/** → { sources: [{name, data}|{name, error}], rest: [File] } — rest giữ nguyên cho luồng nhập cũ (FIT, Excel kế hoạch, JSON bài tập…). */
async function classify(files) {
  const sources = [], rest = [];
  for (const file of Array.from(files || [])) {
    try {
      const bytes = await bytesOf(file);
      const zip = isZip(file.name) || (bytes.length > 2 && bytes[0] === 80 && bytes[1] === 75 && !isXlsx(file.name));
      if (zip) {
        const archive = await RunPlanXLSX.unzip(bytes); let fitness = 0, other = 0;
        for (const [inner, b] of archive) { const k = await classifyEntry(`${file.name} › ${inner.split('/').pop()}`, b, sources); if (k === 'fitness') fitness++; else if (k === 'fit' || k === 'other') other++; }
        if (other || !fitness) rest.push(file);
        continue;
      }
      const k = await classifyEntry(file.name, bytes, sources);
      if (k !== 'fitness') rest.push(file);
    } catch (e) { rest.push(file); }
  }
  return { sources, rest };
}

const fmt = d => d ? d.split('-').reverse().join('/') : '—';
const STATUS = { attach: ['Gắn vào buổi đã giao', 'attach'], new: ['Buổi mới', 'new'], duplicate: ['Đã có', 'dup'], changed: ['Đã có — nội dung khác', 'changed'] };
function actionOptions(it) {
  const o = [];
  if (it.status === 'attach') o.push(['attach', `Gắn kết quả vào “${it.target.name}” (khớp ${it.target.by})`], ['new', 'Tạo buổi mới'], ['skip', 'Bỏ qua']);
  else if (it.status === 'new') o.push(['new', 'Tạo buổi mới (đã tập)'], ['skip', 'Bỏ qua']);
  else if (it.status === 'duplicate') o.push(['skip', 'Đã có — bỏ qua'], ['new', 'Vẫn tạo thêm một buổi']);
  else o.push(['skip', 'Giữ kết quả đang có'], ['overwrite', 'Ghi đè bằng kết quả trong file'], ['new', 'Tạo buổi mới']);
  return o;
}
function matchHtml(e, i, k) {
  const m = e.match;
  if (m.kind === 'id' || m.kind === 'name') return `<span class="fi-ok">✓ thư viện${m.kind === 'name' ? ' (khớp tên)' : ''}</span>`;
  if (m.kind === 'suggest') return `<select name="ex-${i}-${k}"><option value="use">Dùng “${esc(m.item.name)}” (giống ${Math.round(m.score * 100)}%)</option><option value="new">Thêm bài mới</option></select>`;
  return '<span class="fi-new">＋ bài mới · chưa xác nhận</span>';
}
function previewHtml(plan) {
  const items = plan.items.map((it, i) => {
    const [label, cls] = STATUS[it.status];
    return `<div class="fi-item ${cls}"><div class="fi-head"><b>${fmt(it.date)}</b><span class="fi-name">${esc(it.name)}</span><span class="fi-badge ${cls}">${label}</span><span class="push"></span><span class="ui-muted">${esc(it.file)}</span></div>
      <div class="fi-meta">${it.exercises.length} bài · ${it.exercises.filter(e => e.done).length} xong${it.minutes !== '' ? ` · ${it.minutes} phút` : ''}${it.rpe !== '' ? ` · RPE ${it.rpe}` : ''}${it.calories !== '' ? ` · ${it.calories} kcal` : ''}</div>
      <div class="field"><select name="act-${i}">${actionOptions(it).map(([v, t]) => `<option value="${v}">${esc(t)}</option>`).join('')}</select></div>
      <ul class="fi-ex">${it.exercises.map((e, k) => `<li><span class="${e.done ? 'fi-done' : 'fi-notdone'}">${e.done ? '✓' : '✗'}</span> ${esc(e.name)} <span class="ui-muted">${e.sets} dòng</span> ${matchHtml(e, i, k)}</li>`).join('')}</ul>
      ${it.warnings.length ? `<ul class="fi-warn">${it.warnings.map(w => `<li>⚠ ${esc(w)}</li>`).join('')}</ul>` : ''}</div>`;
  }).join('');
  const errs = plan.errors.length ? `<div class="fi-errors"><b>Không đọc được ${plan.errors.length} file:</b><ul>${plan.errors.map(e => `<li>${esc(e.file)} — ${esc(e.message)}</li>`).join('')}</ul></div>` : '';
  return `<div class="fi-user">Người dùng: <b>${esc(plan.user)}</b> · ${plan.items.length} buổi${plan.errors.length ? ` · ${plan.errors.length} file lỗi` : ''}. Chỉ lịch của người dùng này bị thay đổi; dữ liệu hiện tại được sao lưu trước khi gộp.</div>${errs}<div class="fi-list">${items}</div>`;
}
function previewDialog(plan) {
  const def = I.defaultChoices(plan);
  return root.T17UI.uiForm({ title: 'Nhập buổi tập từ app fitness', message: 'Kiểm tra từng buổi trước khi ghi vào lịch.', body: previewHtml(plan), okLabel: 'Nhập vào lịch', cls: 'xwide',
    onReady: f => plan.items.forEach((it, i) => { const s = f.querySelector(`[name="act-${i}"]`); if (s) s.value = def[i].action; }),
    collect: f => plan.items.map((it, i) => ({ action: f.querySelector(`[name="act-${i}"]`)?.value || def[i].action, exercises: it.exercises.map((e, k) => f.querySelector(`[name="ex-${i}-${k}"]`)?.value || def[i].exercises[k]) })) });
}

/** Mở hộp xem trước và ghi. Trả kết quả applyImport, hoặc null nếu huỷ / không có gì để nhập. */
async function importSources(sources) {
  const parsed = I.parseSources(sources);
  if (!parsed.sessions.length) { if (parsed.errors.length) alert('Không nhập được file của app fitness:\n\n' + parsed.errors.map(e => `• ${e.file}: ${e.message}`).join('\n')); return null; }
  const plan = I.planImport(db, parsed, { user: T17Platform.activeUser().name });
  const choices = await previewDialog(plan); if (!choices) return null;
  if (choices.every(c => c.action === 'skip')) { toast(plan.items.every(it => it.status === 'duplicate') ? 'Tất cả buổi trong file đã có — không thay đổi gì' : 'Không nhập buổi nào'); return { attached: 0, created: 0, overwritten: 0, skipped: plan.items.length, newExercises: 0 }; }
  let snap = ''; try { snap = await T17Platform.snapshot(db, 'nhap-fitness'); } catch (e) { console.warn('snapshot', e); }
  const res = I.applyImport(db, parsed, plan, choices);
  saveDb();
  const first = plan.items.map((it, i) => choices[i].action !== 'skip' ? it.date : '').filter(Boolean).sort()[0];
  if (first) { const loc = locateDate(first); if (loc) currentWeek = loc.wi; }
  render(); refreshViews();
  const parts = [res.attached && `gắn ${res.attached} kết quả vào buổi đã giao`, res.created && `tạo ${res.created} buổi mới`, res.overwritten && `ghi đè ${res.overwritten}`, res.skipped && `bỏ qua ${res.skipped}`, res.newExercises && `thêm ${res.newExercises} bài mới (chưa xác nhận)`].filter(Boolean);
  toast('Đã nhập: ' + parts.join(' · ') + (snap && T17Platform.isDesktop ? ' · đã sao lưu trước khi gộp' : ''));
  return res;
}
/** Tiện ích cho các nút nhập: tách file fitness, nhập chúng, trả phần còn lại cho luồng cũ. */
async function takeFitnessFiles(files) {
  const { sources, rest } = await classify(files);
  if (sources.length) await importSources(sources);
  return rest;
}

root.T17FitnessImportUI = { classify, importSources, takeFitnessFiles, previewDialog };
})(typeof globalThis !== 'undefined' ? globalThis : this);
