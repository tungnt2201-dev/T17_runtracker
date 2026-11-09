'use strict';
/* Lượt 3 — nhập file app fitness: nhận diện, khớp bài, gắn / tạo buổi, chống trùng, ngày theo giờ địa phương. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const F = require('../src/core/fitness.js');
const L = require('../src/core/legacy.js');
const I = require('../src/core/fitness-import.js');
const XLSX = require('../src/lib/xlsx.js');

const FX = path.join(__dirname, 'fixtures');
const readJson = f => JSON.parse(fs.readFileSync(path.join(FX, f), 'utf8'));
const clone = x => JSON.parse(JSON.stringify(x));
const VN = -420; // UTC+7, như Date#getTimezoneOffset
const emptyDb = () => L.normalizeDb({ weeks: [] }).db;
const workouts = db => db.weeks.flatMap(w => w.days.flatMap(d => d.workouts.map(x => ({ date: d.date, ...x }))));
const src = (name, data) => ({ name, data });
function mobileApp() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'legacy', 'T17_Run_Training_Mobile.html'), 'utf8');
  return new Function('localStorage', html.slice(html.indexOf('const STORAGE_KEY='), html.indexOf('function loadData(){')) + '; return { normalizeData };')({ getItem: () => null });
}
async function mobileXlsxSource() { const wb = await XLSX.readSheets(fs.readFileSync(path.join(FX, 'fitness-mobile-v3.xlsx'))); return { name: 'fitness-mobile-v3.xlsx', data: { sheets: wb.sheets }, names: wb.names }; }
function run(db, sources, choices) { const parsed = I.parseSources(sources, { tzOffsetMin: VN }); const plan = I.planImport(db, parsed, { user: 'Tôi' }); const res = I.applyImport(db, parsed, plan, choices ? choices(plan) : I.defaultChoices(plan)); return { parsed, plan, res }; }

test('nhận diện file: JSON v1/v2/v3 của app mobile là fitness-session; file chạy bộ không đổi', async () => {
  for (const f of ['fitness-mobile-v1-legacy.json', 'fitness-mobile-v2.json', 'fitness-mobile-v3.json', 'fitness-mobile-midnight.json', 'fitness-mobile-unknown-exercises.json']) assert.equal(L.detectKind(readJson(f)), 'fitness-session', f);
  assert.equal(L.detectKind(readJson('fitness-mobile-v3.json').session), 'fitness-session');
  for (const [f, k] of [['runplan-v189-backup.json', 'backup'], ['runplan-plan-export.json', 'plan'], ['runplan-log-export.json', 'log'], ['t17-fitness-backup.json', 'backup']]) assert.equal(L.detectKind(readJson(f)), k, f);
  // Excel: workbook app mobile ≠ Excel kế hoạch của T17
  const x = await mobileXlsxSource();
  assert.deepEqual(x.names, ['Session', 'Workout Log', 'Guide', 'Library']); assert.ok(I.isMobileWorkbook(x.names));
  assert.ok(!I.isMobileWorkbook(['Run tracker'])); assert.ok(!I.isMobileWorkbook(['Session'])); assert.ok(!I.isMobileWorkbook([]));
});

test('Excel của app mobile đọc ra đúng buổi như file JSON (cùng mã băm nội dung)', async () => {
  const x = await mobileXlsxSource();
  const { sessions, errors } = I.parseSources([x, src('a.json', readJson('fitness-mobile-v3.json'))], { tzOffsetMin: VN });
  assert.deepEqual(errors, []); assert.equal(sessions[0].kind, 'xlsx');
  assert.equal(F.contentHash(sessions[0].session), F.contentHash(sessions[1].session));
  assert.equal(sessions[0].session.calories, 260); assert.equal(sessions[0].session.rpe, 7); assert.equal(sessions[0].session.duration, 48);
  assert.deepEqual(sessions[0].customLibrary.map(l => l.id), ['custom-banded-walk']);
  assert.throws(() => I.parseMobileWorkbook({ 'Run tracker': [] }), /Session/);
});

test('ngày theo giờ địa phương: không lệch 1 ngày vì UTC', () => {
  assert.equal(I.localYmd('2026-11-07T17:30:00.000Z', VN), '2026-11-08'); // 00:30 ngày 8 ở VN
  assert.equal(I.localYmd('2026-11-07T16:59:59Z', VN), '2026-11-07');     // 23:59:59 ngày 7 ở VN
  assert.equal(I.localYmd('2026-11-08T00:30:00+07:00', VN), '2026-11-08');
  assert.equal(I.localYmd('2026-11-07T17:30:00.000Z', 0), '2026-11-07');   // máy đặt UTC
  assert.equal(I.localYmd('2026-11-08'), '2026-11-08'); assert.equal(I.localYmd('2026-11-08T23:50'), '2026-11-08'); // không múi giờ = giờ địa phương
  assert.equal(I.localYmd('08/11/2026'), '2026-11-08'); assert.equal(I.localYmd(46334), '2026-11-08'); assert.equal(I.localYmd('sai'), ''); assert.equal(I.localYmd(''), '');
  const { sessions } = I.parseSources([src('m.json', readJson('fitness-mobile-midnight.json'))], { tzOffsetMin: VN });
  assert.equal(sessions[0].session.date, '2026-11-08');
});

test('đọc v1 / v2 / file hỏng / file không phải app fitness', () => {
  const broken = (() => { try { return L.parseJsonText(fs.readFileSync(path.join(FX, 'fitness-mobile-broken.json'), 'utf8')); } catch (e) { return { error: e.message }; } })();
  const { sessions, errors } = I.parseSources([src('v1.json', readJson('fitness-mobile-v1-legacy.json')), src('v2.json', readJson('fitness-mobile-v2.json')), { name: 'hong.json', ...(broken.error ? { error: broken.error } : { data: broken }) }, src('plan.json', readJson('runplan-plan-export.json')), src('nodate.json', { ...readJson('fitness-mobile-v3.json'), session: { ...readJson('fitness-mobile-v3.json').session, date: '' } })], { tzOffsetMin: VN });
  assert.deepEqual(sessions.map(s => [s.file, s.kind, s.session.date]), [['v1.json', 'v1', '2026-10-30'], ['v2.json', 'v2', '2026-11-03']]);
  assert.deepEqual(errors.map(e => e.file), ['hong.json', 'plan.json', 'nodate.json']);
  assert.match(errors[0].message, /JSON/); assert.match(errors[1].message, /Không phải file của app fitness/); assert.match(errors[2].message, /ngày/);
  assert.equal(sessions[1].session.exercises[0].rows[0].time, '', 'dòng v2 thiếu cột thời gian vẫn đọc được');
});

test('khớp bài: id → tên chuẩn hoá → gợi ý ≥ 0,85 → bài mới', () => {
  const lib = F.normalizeLibrary([]);
  assert.equal(I.matchExercise({ libraryId: 'tib-raise', name: 'gì cũng được' }, lib).kind, 'id');
  assert.equal(I.matchExercise({ name: 'calf  STRETCH!' }, lib).kind, 'name');
  assert.equal(I.matchExercise({ name: 'Đi lùi' }, lib).kind, 'name');
  const s = I.matchExercise({ name: 'Revers Lunge with Dumbbells' }, lib);
  assert.equal(s.kind, 'suggest'); assert.equal(s.item.id, 'reverse-lunge'); assert.ok(s.score >= 0.85 && s.score < 1);
  const n = I.matchExercise({ name: 'Good Morning Barbell' }, lib); // 0,84 < 0,85 → không tự gợi ý
  assert.equal(n.kind, 'new'); assert.equal(n.closest, 'Good Morning with Barbell');
  assert.equal(I.matchExercise({ name: 'Plank' }, lib).kind, 'new');
  assert.equal(I.similarity('abc', 'abc'), 1); assert.equal(I.similarity('', 'x'), 0); assert.equal(I.normName(' Hip-Thrust (Barbell) '), 'hip thrust barbell');
});

test('nhập lần đầu → buổi mới đã tập; nhập lại → “đã có”, không nhân đôi', () => {
  const db = emptyDb();
  const a = run(db, [src('v3.json', readJson('fitness-mobile-v3.json'))]);
  assert.equal(a.plan.items[0].status, 'new'); assert.deepEqual(a.res, { attached: 0, created: 1, overwritten: 0, skipped: 0, newExercises: 1 });
  const w = workouts(db)[0];
  assert.equal(w.date, '2026-11-07'); assert.equal(w.workoutType, 'Fitness'); assert.equal(w.actual.status, 'done');
  assert.equal(w.actual.minutes, 48); assert.equal(w.actual.fatigue, 7); assert.equal(w.actual.calories, 260); assert.equal(w.actual.note, 'Ổn, gối trái hơi mỏi ở lunge');
  assert.equal(w.actual.fitness.exercises.filter(e => e.done).length, 6); assert.match(w.actual.fitness.importKey, /^h:2026-11-07\|run basic 1\|/);
  const banded = db.fitnessLibrary.find(x => x.id === 'custom-banded-walk');
  assert.ok(banded.unconfirmed); assert.equal(banded.cue, 'Dây quanh gối, đi ngang.');
  const b = run(db, [src('v3-lan-2.json', readJson('fitness-mobile-v3.json'))]);
  assert.equal(b.plan.items[0].status, 'duplicate'); assert.equal(b.res.skipped, 1); assert.equal(workouts(db).length, 1);
  assert.equal(db.fitnessLibrary.filter(x => x.id === 'custom-banded-walk').length, 1);
});

test('gắn kết quả vào buổi đã giao: theo mã buổi (đi khứ hồi qua CHÍNH app mobile) và theo mẫu buổi', () => {
  const db = emptyDb(); const M = mobileApp();
  const planned = { id: 'p1', ...F.planFromTemplate(F.BUILTIN_TEMPLATES[0], []) };
  L.ensureDateIn(db, '2026-11-12').d.workouts.push(planned);
  // T17 → file cho app mobile → app mobile nạp, người dùng tập và ghi → app mobile xuất lại
  const sent = JSON.parse(JSON.stringify(F.toMobileData(planned, '2026-11-12', [])));
  const inApp = M.normalizeData(sent);
  inApp.session.exercises.forEach((e, i) => { e.done = i < 5; }); inApp.session.rpe = '8'; inApp.session.calories = '310'; inApp.session.duration = '52';
  const back = JSON.parse(JSON.stringify({ ...M.normalizeData(inApp), exportedAt: 'x' }));
  const r = run(db, [src('mobile.json', back)]);
  assert.equal(r.plan.items[0].status, 'attach'); assert.equal(r.plan.items[0].target.by, 'mã buổi');
  assert.equal(r.res.attached, 1); assert.equal(workouts(db).length, 1, 'không tạo buổi mới');
  const w = workouts(db)[0];
  assert.equal(w.id, 'p1'); assert.equal(w.actual.fatigue, 8); assert.equal(w.actual.minutes, 52); assert.equal(w.actual.calories, 310);
  assert.equal(w.actual.fitness.sessionId, planned.fitness.sessionId); assert.equal(F.completion(w).done, 5);
  assert.equal(w.fitness.exercises.length, 6, 'kế hoạch giữ nguyên');
  // nhập lại cùng file → đã có
  assert.equal(run(db, [src('mobile.json', back)]).plan.items[0].status, 'duplicate');
  // sửa trong app rồi xuất lại (cùng mã buổi, nội dung khác) → "đã có — nội dung khác", mặc định giữ; chọn ghi đè thì thay
  const back2 = clone(back); back2.session.exercises[5].done = true;
  const c = run(db, [src('mobile-2.json', back2)]);
  assert.equal(c.plan.items[0].status, 'changed'); assert.equal(c.res.skipped, 1); assert.equal(F.completion(workouts(db)[0]).done, 5);
  const d = run(db, [src('mobile-2.json', back2)], p => [{ action: 'overwrite', exercises: p.items[0].exercises.map(() => 'use') }]);
  assert.equal(d.res.overwritten, 1); assert.equal(F.completion(workouts(db)[0]).done, 6); assert.equal(workouts(db).length, 1);

  // theo mẫu buổi (file v1 không có mã buổi, templateId run-basic-1)
  const db2 = emptyDb(); L.ensureDateIn(db2, '2026-10-30').d.workouts.push({ id: 'p2', ...F.planFromTemplate(F.BUILTIN_TEMPLATES[0], []) });
  const e = run(db2, [src('v1.json', readJson('fitness-mobile-v1-legacy.json'))]);
  assert.equal(e.plan.items[0].status, 'attach'); assert.equal(e.plan.items[0].target.by, 'mẫu buổi'); assert.equal(workouts(db2)[0].actual.calories, 210);
});

test('hai buổi cùng ngày ở hai file → hai buổi; JSON + Excel của cùng buổi trong một lần nhập → chỉ một', async () => {
  const db = emptyDb(); L.ensureDateIn(db, '2026-11-07').d.workouts.push({ id: 'p1', ...F.planFromTemplate(F.BUILTIN_TEMPLATES[0], []) });
  const v3 = readJson('fitness-mobile-v3.json'); const other = clone(v3); other.session.exercises[0].rows[0].reps = '8'; other.session.sessionNote = 'buổi chiều';
  const x = await mobileXlsxSource();
  const r = run(db, [src('sang.json', v3), x, src('chieu.json', other)]);
  assert.deepEqual(r.plan.items.map(i => i.status), ['attach', 'duplicate', 'new']);
  assert.match(r.plan.items[1].warnings[0], /Trùng với “sang.json”/);
  assert.deepEqual(r.res, { attached: 1, created: 1, overwritten: 0, skipped: 1, newExercises: 1 });
  const day = workouts(db).filter(w => w.date === '2026-11-07');
  assert.equal(day.length, 2); assert.ok(day.every(w => w.actual)); assert.deepEqual(day.map(w => w.actual.note).sort(), ['buổi chiều', 'Ổn, gối trái hơi mỏi ở lunge']);
});

test('bài lạ: gợi ý dùng bài thư viện hoặc thêm mới “chưa xác nhận”', () => {
  const db = emptyDb();
  const parsed = I.parseSources([src('u.json', readJson('fitness-mobile-unknown-exercises.json'))]);
  const plan = I.planImport(db, parsed);
  assert.deepEqual(plan.items[0].exercises.map(e => e.match.kind), ['suggest', 'new', 'name']);
  assert.match(plan.items[0].warnings.join(' '), /1 bài chưa có trong thư viện/);
  // mặc định: dùng gợi ý
  const db1 = clone(db); I.applyImport(db1, parsed, plan, I.defaultChoices(plan));
  const ex1 = workouts(db1)[0].actual.fitness.exercises;
  assert.deepEqual(ex1.map(e => e.libraryId), ['reverse-lunge', 'c-plank', 'calf-stretch']);
  assert.equal(ex1[0].name, 'Reverse Lunge with Dumbbells');
  const plank = db1.fitnessLibrary.find(x => x.id === 'c-plank'); assert.ok(plank.unconfirmed); assert.equal(plank.cue, 'Giữ thân thẳng.'); assert.equal(plank.importedFrom, 'u.json');
  // chọn "Thêm bài mới" cho gợi ý
  const db2 = clone(db); const res = I.applyImport(db2, parsed, plan, [{ action: 'new', exercises: ['new', 'new', 'use'] }]);
  assert.equal(res.newExercises, 2); assert.ok(db2.fitnessLibrary.some(x => x.name === 'Revers Lunge with Dumbbells' && x.unconfirmed));
  // dữ liệu sau khi nhập: bản v2.2.0 vẫn đọc đủ trường
  const ctx = vm.createContext({});
  for (const f of ['utils.js', 'legacy.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, 'compat', 'v2.2.0', f), 'utf8'), ctx);
  const old = JSON.parse(JSON.stringify(ctx.T17Legacy.normalizeDb(clone(db1)).db));
  assert.deepEqual(old.weeks.flatMap(w => w.days.flatMap(d => d.workouts)).map(w => w.actual.fitness), workouts(db1).map(w => w.actual.fitness));
  assert.deepEqual(old.fitnessLibrary, db1.fitnessLibrary);
});

test('buổi được giao ngày khác (cùng mã buổi) → cảnh báo, tạo buổi mới vào ngày tập với mã mới', () => {
  const db = emptyDb(); const planned = { id: 'p1', ...F.planFromTemplate(F.BUILTIN_TEMPLATES[0], []) };
  L.ensureDateIn(db, '2026-11-10').d.workouts.push(planned);
  const file = JSON.parse(JSON.stringify(F.toMobileData(planned, '2026-11-11', []))); file.session.exercises.forEach(e => { e.done = true; });
  const r = run(db, [src('lech-ngay.json', file)]);
  assert.equal(r.plan.items[0].status, 'new'); assert.match(r.plan.items[0].warnings.join(' '), /được giao ngày 10\/11\/2026/);
  const created = workouts(db).find(w => w.date === '2026-11-11');
  assert.ok(created.actual); assert.notEqual(created.fitness.sessionId, planned.fitness.sessionId);
  assert.equal(workouts(db).find(w => w.id === 'p1').actual, null);
});
