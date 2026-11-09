/* T17 RunTracker — NHẬP file của app mobile "T17 Run Training" vào lịch (v2.3, lượt 3). Pure, không DOM.
 *
 * Luồng: nguồn (JSON v1/v2/v3, Excel 4 sheet) → parseSources() → các buổi chuẩn
 *        → planImport(db, buổi) → bản xem trước (mỗi buổi: gắn vào buổi đã giao / tạo mới / đã có / có thay đổi)
 *        → người dùng chọn → applyImport(db, plan, choices) → ghi vào db (người dùng đang chọn).
 *
 * Nhận diện bài tập (hai ngưỡng): libraryId trùng → tên chuẩn hoá trùng → giống ≥ 0,85 (Dice trên cặp ký tự) thì GỢI Ý
 * để người dùng xác nhận → còn lại thêm vào fitnessLibrary làm bài mới, `unconfirmed: true`.
 * Chống trùng: khoá = "sid:<mã buổi T17>" nếu file mang mã buổi (instanceId "<mã>:<k>"), không thì
 * "h:<ngày>|<tên>|<băm nội dung>". Khoá + băm nội dung gốc lưu ở actual.fitness.importKey / importHash.
 */
(function (root) {
'use strict';
const C = root.T17Core || (typeof require === 'function' ? require('./utils.js') : null);
const F = root.T17Fitness || (typeof require === 'function' ? require('./fitness.js') : null);
const L = root.T17Legacy || (typeof require === 'function' ? require('./legacy.js') : null);
const { norm, isYmd, excelYmd, genId } = C;

const SUGGEST_THRESHOLD = 0.85;
const MOBILE_SHEETS = ['Session', 'Workout Log'];
const str = v => v == null ? '' : String(v);
const pad = n => String(n).padStart(2, '0');

/* ---------- ngày theo giờ địa phương ---------- */
/** Ngày "YYYY-MM-DD" theo giờ địa phương. Chuỗi ISO có múi giờ (Z, +07:00) được đổi sang giờ địa phương —
 *  23:30Z ngày 7 là 06:30 ngày 8 ở Việt Nam. Chuỗi ngày trần / số serial Excel giữ nguyên ngày ghi trên lịch.
 *  tzOffsetMin: như Date#getTimezoneOffset (Việt Nam = −420); bỏ trống = múi giờ của máy. */
/** Ngày có thật trên lịch (loại 2026-13-45, 2026-02-30). */
function realYmd(s) { if (!isYmd(s)) return false; const [y, m, d] = s.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d)); return y >= 1900 && y <= 2200 && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; }
function localYmd(v, tzOffsetMin) {
  if (v == null || v === '') return '';
  if (typeof v === 'number') { const s = excelYmd(v); return isYmd(s) ? s : ''; }
  const s = str(v).trim();
  if (isYmd(s)) return realYmd(s) ? s : '';
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    const ms = Date.parse(s); if (!Number.isFinite(ms)) return '';
    const off = tzOffsetMin == null ? new Date(ms).getTimezoneOffset() : tzOffsetMin;
    const d = new Date(ms - off * 60000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  if (/^\d{4}-\d{2}-\d{2}[T ]/.test(s)) return isYmd(s.slice(0, 10)) ? s.slice(0, 10) : ''; // giờ địa phương, không múi giờ
  const e = excelYmd(s); return isYmd(e) ? e : '';
}

/* ---------- Excel của app mobile ---------- */
function isMobileWorkbook(names) { const set = new Set((names || []).map(String)); return MOBILE_SHEETS.every(n => set.has(n)); }
function rowsToObjects(aoa) {
  const rows = Array.isArray(aoa) ? aoa : []; const head = (Array.isArray(rows[0]) ? rows[0] : []).map(str);
  return rows.slice(1).filter(r => Array.isArray(r) && r.some(c => c !== '' && c != null)).map(r => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ''])));
}
/** Workbook (Map/Object tên sheet → mảng hàng) → object dạng JSON v3, giống importWorkbook() của app mobile. */
function parseMobileWorkbook(sheets) {
  const get = n => sheets instanceof Map ? sheets.get(n) : sheets[n];
  if (!isMobileWorkbook(sheets instanceof Map ? [...sheets.keys()] : Object.keys(sheets))) throw new Error('Workbook không có sheet Session + Workout Log của app fitness.');
  const rowsOf = n => { const x = get(n); return Array.isArray(x) ? x : []; };
  const o = {}; for (const r of rowsOf('Session')) if (Array.isArray(r) && r[0] !== '' && r[0] != null) o[str(r[0])] = r[1];
  const library = rowsToObjects(rowsOf('Library')).filter(r => !norm(r['Builtin']).startsWith('c')).map(r => {
    let dr = []; try { const p = JSON.parse(str(r['Default rows JSON']) || '[]'); if (Array.isArray(p)) dr = p; } catch (e) { /* bỏ qua */ }
    return { id: str(r['Library ID']), builtin: false, name: str(r['Tên bài']), category: str(r['Nhóm']), plan: str(r['Prescription']), cue: str(r['Cách tập']), caution: str(r['Chú ý']), imageData: '', imageName: str(r['Tên ảnh']), defaultRows: dr };
  }).filter(x => x.id);
  const guide = rowsToObjects(rowsOf('Guide'));
  const map = new Map();
  for (const r of rowsToObjects(rowsOf('Workout Log'))) {
    const inst = str(r['Instance ID']) || `excel-${str(r['Thứ tự'])}-${str(r['Bài'])}`;
    if (!map.has(inst)) { const g = guide.find(x => str(x['Bài']) === str(r['Bài'])) || {}; map.set(inst, { instanceId: inst, libraryId: str(r['Library ID']), name: str(r['Bài']) || 'Bài tập', category: str(r['Nhóm']), plan: str(r['Prescription']), cue: str(g['Cách tập']), caution: str(g['Chú ý']), done: norm(r['Hoàn tất']).startsWith('c'), rows: [] }); }
    map.get(inst).rows.push({ set: str(r['Set']), group: str(r['Rep / nhóm']), reps: str(r['Số rep']), time: str(r['Thời gian / quãng đường']), weight: str(r['Trọng lượng (kg)']), note: str(r['Ghi chú']) });
  }
  return { version: 3, library, session: { workoutName: str(o['Workout']), templateId: str(o['Template ID']), date: o['Ngày tập'] ?? '', calories: str(o['Calories (kcal)'] ?? ''), duration: str(o['Thời lượng (phút)'] ?? ''), rpe: str(o['RPE'] ?? ''), sessionNote: str(o['Ghi chú chung'] ?? ''), workoutNote: str(o['Ghi chú giáo án'] ?? ''), exercises: [...map.values()] } };
}

/* ---------- nhận diện bài tập ---------- */
function normName(s) { return norm(s).replace(/[^a-z0-9]+/g, ' ').trim(); }
/** Độ giống 0..1 (hệ số Dice trên cặp ký tự liền nhau, sau khi chuẩn hoá và bỏ khoảng trắng). */
function similarity(a, b) {
  const x = normName(a).replace(/ /g, ''), y = normName(b).replace(/ /g, '');
  if (!x || !y) return 0; if (x === y) return 1; if (x.length < 2 || y.length < 2) return 0;
  const bag = new Map(); for (let i = 0; i < x.length - 1; i++) { const k = x.slice(i, i + 2); bag.set(k, (bag.get(k) || 0) + 1); }
  let common = 0; for (let i = 0; i < y.length - 1; i++) { const k = y.slice(i, i + 2); const n = bag.get(k) || 0; if (n > 0) { common++; bag.set(k, n - 1); } }
  return (2 * common) / (x.length - 1 + y.length - 1);
}
/** → { kind: 'id' | 'name' | 'suggest' | 'new', item?, score } */
function matchExercise(ex, library) {
  const lib = Array.isArray(library) ? library : [];
  const byId = lib.find(x => x.id && x.id === ex.libraryId); if (byId) return { kind: 'id', item: byId, score: 1 };
  const n = normName(ex.name);
  const byName = n && lib.find(x => normName(x.name) === n); if (byName) return { kind: 'name', item: byName, score: 1 };
  let best = null, score = 0; for (const x of lib) { const s = similarity(ex.name, x.name); if (s > score) { score = s; best = x; } }
  if (best && score >= SUGGEST_THRESHOLD) return { kind: 'suggest', item: best, score: Math.round(score * 100) / 100 };
  return { kind: 'new', score: Math.round(score * 100) / 100, closest: best ? best.name : '' };
}

/* ---------- đọc nguồn ---------- */
/** sources: [{ name, data }] — data: object JSON đã parse, { sheets } của Excel, hoặc { error } nếu đọc lỗi.
 *  → { sessions: [{ file, kind, session, customLibrary, sid }], errors: [{ file, message }] } */
function parseSources(sources, opts = {}) {
  const sessions = [], errors = [];
  for (const src of sources || []) {
    const file = str(src?.name) || 'file';
    try {
      if (src?.error) throw new Error(src.error);
      let x = src.data; const fromXlsx = !!(x && x.sheets);
      if (fromXlsx) x = parseMobileWorkbook(x.sheets);
      const kind = F.mobileKind(x); if (!kind) throw new Error('Không phải file của app fitness (T17 Run Training).');
      const rawDate = kind === 'v3' ? x.session?.date : x.date;
      const r = F.fromMobile(x);
      r.session.date = localYmd(rawDate, opts.tzOffsetMin);
      if (!r.session.date) throw new Error('Buổi tập không có ngày hợp lệ.');
      if (!r.session.exercises.length) throw new Error('Buổi tập không có bài nào.');
      const sid = F.sessionIdFromInstances(r.session.exercises) || str(x.t17?.sessionId || x.session?.t17?.sessionId);
      sessions.push({ file, kind: fromXlsx ? 'xlsx' : (kind === 'v3' && Number(x.version) && Number(x.version) !== 3 ? 'v' + Number(x.version) : kind), session: r.session, customLibrary: r.customLibrary, sid });
    } catch (e) { errors.push({ file, message: e.message || String(e) }); }
  }
  return { sessions, errors };
}

/* ---------- lập kế hoạch nhập ---------- */
function importKeyOf(s) { return s.sid ? `sid:${s.sid}` : `h:${s.session.date}|${normName(s.session.workoutName)}|${F.contentHash(s.session)}`; }
function eachWorkout(db, fn) { (db.weeks || []).forEach((w, wi) => (w.days || []).forEach((d, di) => (d.workouts || []).forEach((it, ii) => fn(it, d, { wi, di, ii })))); }

/** → { user, items: [...], errors } — mỗi item:
 *  { idx, file, kind, date, name, sid, key, hash, status: 'attach'|'new'|'duplicate'|'changed', target?, existing?, exercises:[{name, match}], warnings:[] } */
function planImport(db, parsed, opts = {}) {
  const library = F.normalizeLibrary(db.fitnessLibrary || []);
  const used = new Set(); const seenKeys = new Map();
  const items = parsed.sessions.map((s, idx) => {
    const key = importKeyOf(s), hash = F.contentHash(s.session);
    const item = { idx, file: s.file, kind: s.kind, date: s.session.date, name: s.session.workoutName, sid: s.sid, key, hash, minutes: s.session.duration, rpe: s.session.rpe, calories: s.session.calories,
      exercises: s.session.exercises.map(e => ({ name: e.name, done: !!e.done, sets: (e.rows || []).length, match: matchExercise(e, library) })), warnings: [], status: 'new' };
    // trùng trong cùng lần nhập (ví dụ JSON và Excel của cùng một buổi)
    if (seenKeys.has(key) && seenKeys.get(key).hash === hash) { item.status = 'duplicate'; item.warnings.push(`Trùng với “${seenKeys.get(key).file}” trong lần nhập này.`); return item; }
    seenKeys.set(key, { hash, file: s.file });
    // đã có trong lịch?
    let existing = null;
    eachWorkout(db, (it, d, ref) => {
      const af = it.actual?.fitness; if (!af || existing) return;
      if (af.importKey === key || (s.sid && af.sessionId === s.sid)) existing = { ref: { ...ref, id: it.id }, date: d.date, name: it.workoutName, sameContent: af.importHash === hash, manual: !af.importKey };
      else if (!s.sid && d.date === s.session.date && af.contentHash && af.contentHash === F.contentHash({ ...s.session, workoutName: it.workoutName })) existing = { ref: { ...ref, id: it.id }, date: d.date, name: it.workoutName, sameContent: true, manual: !af.importKey };
    });
    if (existing) { item.existing = existing; item.status = existing.sameContent ? 'duplicate' : 'changed'; if (!existing.sameContent) item.warnings.push(existing.manual ? 'Buổi này đã có kết quả nhập tay trong T17; nội dung khác file.' : 'Đã nhập buổi này trước đây nhưng nội dung đã thay đổi.'); return item; }
    // buổi đã giao để gắn kết quả
    const cands = []; let elsewhere = null;
    eachWorkout(db, (it, d, ref) => {
      if (!F.isFitnessWorkout(it) || it.fitStandalone || it.actual || used.has(it.id)) return;
      const bySid = s.sid && it.fitness?.sessionId === s.sid;
      if (d.date !== s.session.date) { if (bySid) elsewhere = { date: d.date, name: it.workoutName }; return; }
      const score = bySid ? 3 : (s.session.templateId && it.fitness?.templateId === s.session.templateId) ? 2 : normName(it.workoutName) === normName(s.session.workoutName) ? 1 : 0;
      if (score) cands.push({ score, ref: { ...ref, id: it.id }, name: it.workoutName, by: score === 3 ? 'mã buổi' : score === 2 ? 'mẫu buổi' : 'tên buổi' });
    });
    cands.sort((a, b) => b.score - a.score);
    if (cands.length) { item.status = 'attach'; item.target = cands[0]; used.add(cands[0].ref.id); }
    else if (elsewhere) item.warnings.push(`Buổi này được giao ngày ${elsewhere.date.split('-').reverse().join('/')}; kết quả sẽ thành buổi mới vào ngày tập.`);
    const unknown = item.exercises.filter(e => e.match.kind === 'new').length; if (unknown) item.warnings.push(`${unknown} bài chưa có trong thư viện — sẽ thêm mới, đánh dấu “chưa xác nhận”.`);
    if (!s.session.duration) item.warnings.push('File không có thời lượng — điểm tải dùng thời lượng kế hoạch nếu có.');
    return item;
  });
  return { user: opts.user || '', items, errors: parsed.errors.slice() };
}
/** Lựa chọn mặc định: gắn / tạo mới / bỏ qua (đã có, có thay đổi); gợi ý bài → dùng bài gợi ý. */
function defaultChoices(plan) {
  return plan.items.map(it => ({ action: it.status === 'attach' ? 'attach' : it.status === 'new' ? 'new' : 'skip', exercises: it.exercises.map(e => e.match.kind === 'suggest' ? 'use' : e.match.kind === 'new' ? 'new' : 'use') }));
}

/* ---------- ghi vào db ---------- */
function findRef(db, ref) {
  const cur = db.weeks?.[ref.wi]?.days?.[ref.di]?.workouts?.[ref.ii]; if (cur && cur.id === ref.id) return cur;
  let hit = null; eachWorkout(db, it => { if (!hit && it.id === ref.id) hit = it; }); return hit;
}
/** Ghi kết quả. Trả { attached, created, overwritten, skipped, newExercises }. db bị sửa tại chỗ. */
function applyImport(db, parsed, plan, choices, opts = {}) {
  const res = { attached: 0, created: 0, overwritten: 0, skipped: 0, newExercises: 0 };
  const lib = F.normalizeLibrary(db.fitnessLibrary || []); let libChanged = false;
  const newByName = new Map(); const now = opts.now || new Date().toISOString();
  const libFor = (s, e, m, choice) => {
    if (choice === 'use' && m.item) return m.item;
    const n = normName(e.name); if (newByName.has(n)) return newByName.get(n);
    const meta = (s.customLibrary || []).find(x => x.id && x.id === e.libraryId) || {};
    let id = e.libraryId && !lib.some(x => x.id === e.libraryId) ? e.libraryId : 'custom-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    if (!/^[\w-]{1,80}$/.test(id)) id = 'custom-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    const item = { id, builtin: false, name: e.name || 'Bài tập', category: e.category || meta.category || '', plan: e.plan || meta.plan || '', cue: meta.cue || '', caution: meta.caution || '', imageData: meta.imageData || '', imageName: meta.imageName || '',
      defaultRows: (meta.defaultRows && meta.defaultRows.length ? meta.defaultRows : e.rows || []).map(r => ({ ...r })), unconfirmed: true, importedAt: now, importedFrom: s.file || '' };
    lib.push(item); newByName.set(n, item); libChanged = true; res.newExercises++; return item;
  };
  plan.items.forEach((it, i) => {
    const ch = choices?.[i] || defaultChoices(plan)[i]; const s = parsed.sessions[it.idx];
    if (!s || ch.action === 'skip' || (it.status === 'duplicate' && ch.action !== 'new')) { res.skipped++; return; }
    const exercises = s.session.exercises.map((e, k) => { const m = it.exercises[k].match; const li = libFor(s, e, m, ch.exercises?.[k] || 'use');
      return { instanceId: e.instanceId, libraryId: li.id, name: li.builtin ? li.name : (li.name || e.name), category: li.category || e.category || '', plan: li.plan || e.plan || '', done: !!e.done, rows: (e.rows || []).map(r => ({ ...r })) }; });
    const date = s.session.date;
    const makeActual = (sid, name) => ({ status: 'done', km: '', minutes: s.session.duration, fatigue: s.session.rpe, calories: s.session.calories, note: s.session.sessionNote || '', segments: [], source: 'fitness-mobile',
      fitness: { schema: F.FITNESS_SCHEMA, sessionId: sid, contentHash: F.contentHash({ date, workoutName: name, exercises }), exercises, importKey: it.key, importHash: it.hash, importedAt: now, sourceFile: s.file } });
    if ((ch.action === 'attach' && it.target) || (ch.action === 'overwrite' && it.existing)) {
      const ref = ch.action === 'attach' ? it.target.ref : it.existing.ref; const w = findRef(db, ref);
      if (w) { const sid = w.fitness?.sessionId || s.sid || F.newSessionId(); w.actual = makeActual(sid, w.workoutName); if (ch.action === 'attach') res.attached++; else res.overwritten++; return; }
    }
    let sidUsed = false; if (s.sid) eachWorkout(db, w0 => { if (w0.fitness?.sessionId === s.sid || w0.actual?.fitness?.sessionId === s.sid) sidUsed = true; });
    const sid = s.sid && !sidUsed ? s.sid : F.newSessionId(); // mã buổi đã có trong lịch → buổi mới cần mã mới
    const planEx = exercises.map(({ done, ...e }) => ({ ...e, rows: e.rows.map(r => ({ ...r })) }));
    const w = { id: genId(), workoutName: s.session.workoutName || 'Fitness', workoutType: F.FITNESS_TYPE, planKm: '', planMinutes: s.session.duration, description: F.summaryText(exercises), planNote: s.session.workoutNote || '', workoutStructure: null,
      fitness: { schema: F.FITNESS_SCHEMA, sessionId: sid, templateId: s.session.templateId || '', workoutNote: s.session.workoutNote || '', exercises: planEx }, actual: null };
    w.actual = makeActual(sid, w.workoutName);
    const loc = realYmd(date) ? L.ensureDateIn(db, date) : null; if (!loc) { res.skipped++; return; } loc.d.workouts = loc.d.workouts || []; loc.d.workouts.push(w); res.created++;
  });
  if (libChanged || res.attached || res.created || res.overwritten) db.fitnessLibrary = F.normalizeLibrary(lib);
  db.weeks.sort((a, b) => str(a.days?.[0]?.date).localeCompare(str(b.days?.[0]?.date)));
  return res;
}

const api = { SUGGEST_THRESHOLD, localYmd, isMobileWorkbook, parseMobileWorkbook, normName, similarity, matchExercise, parseSources, importKeyOf, planImport, defaultChoices, applyImport };
root.T17FitnessImport = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
