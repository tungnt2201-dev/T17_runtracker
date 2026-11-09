'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const F = require('../src/core/fitness.js');

const FX = path.join(__dirname, 'fixtures');
const readJson = f => JSON.parse(fs.readFileSync(path.join(FX, f), 'utf8'));
const V3 = readJson('fitness-mobile-v3.json');
const V1 = readJson('fitness-mobile-v1-legacy.json');

test('thư viện dựng sẵn trích NGUYÊN VĂN từ app mobile (15 bài, 2 mẫu buổi)', () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'legacy', 'T17_Run_Training_Mobile.html'), 'utf8');
  const src = html.slice(html.indexOf('const row=('), html.indexOf('function cloneRows'));
  const app = new Function(src + '; return {BUILTIN_LIBRARY, TEMPLATES};')();
  assert.equal(F.BUILTIN_LIBRARY.length, 15);
  assert.equal(F.BUILTIN_TEMPLATES.length, 2);
  assert.deepEqual(F.BUILTIN_LIBRARY.map(x => [x.id, x.name, x.category, x.plan, x.cue, x.caution]), app.BUILTIN_LIBRARY.map(x => [x.id, x.name, x.category, x.plan, x.cue, x.caution]));
  assert.deepEqual(F.BUILTIN_LIBRARY.map(x => x.defaultRows), app.BUILTIN_LIBRARY.map(x => x.defaultRows));
  assert.deepEqual(F.BUILTIN_TEMPLATES.map(t => [t.id, t.name, t.items]), app.TEMPLATES.map(t => [t.id, t.name, t.items]));
});

test('fromMobile: file JSON v3 xuất từ app mobile', () => {
  const r = F.fromMobile(V3);
  assert.equal(r.kind, 'v3');
  const s = r.session;
  assert.equal(s.date, '2026-11-07'); assert.equal(s.workoutName, 'Run Basic 1'); assert.equal(s.templateId, 'run-basic-1');
  assert.equal(s.calories, 260); assert.equal(s.duration, 48); assert.equal(s.rpe, 7);
  assert.equal(s.exercises.length, 7); assert.equal(s.exercises.filter(e => e.done).length, 6);
  assert.deepEqual(r.customLibrary.map(x => x.id), ['custom-banded-walk']);
  // hướng dẫn/ảnh không chép vào từng buổi
  assert.ok(s.exercises.every(e => !('cue' in e) && !('imageData' in e)));
  // session trần (chỉ object session) cũng đọc được
  assert.equal(F.fromMobile(V3.session).kind, 'session');
});

test('fromMobile: dữ liệu đời cũ T17_RUN_BASIC_1_V1 giống hệt cách app mobile tự chuyển đổi', () => {
  const r = F.fromMobile(V1);
  assert.equal(r.kind, 'v1');
  const s = r.session;
  assert.equal(s.date, '2026-10-30'); assert.equal(s.calories, 210); assert.equal(s.duration, 45); assert.equal(s.rpe, 6);
  assert.equal(s.templateId, 'run-basic-1'); assert.equal(s.exercises.length, 6);
  assert.deepEqual(s.exercises.filter(e => e.done).map(e => e.libraryId), ['good-morning', 'reverse-lunge']);
  assert.deepEqual(s.exercises[0].rows.map(x => [x.reps, x.weight]), [['12', '15'], ['10', '20']]);
  assert.equal(s.exercises.find(e => e.libraryId === 'single-calf-raise').rows[0].note, 'bỏ vì mỏi');
});

test('mobileKind: không nhận nhầm file chạy bộ / rác', () => {
  for (const f of ['runplan-v189-backup.json', 'runplan-plan-export.json', 'runplan-log-export.json', 'runplan-v1-legacy-day-fields.json']) assert.equal(F.mobileKind(readJson(f)), '', f);
  for (const x of [null, 1, 'x', [], {}, { exercises: [] }]) assert.equal(F.mobileKind(x), '');
  assert.throws(() => F.fromMobile({ weeks: [] }), /Không nhận ra/);
});

test('normalizeLibrary: đủ bài dựng sẵn, nội dung theo mã, giữ ảnh/MET, giữ bài tự tạo và field lạ', () => {
  const lib = F.normalizeLibrary([
    { id: 'good-morning', builtin: true, name: 'SỬA TAY', imageData: 'data:image/jpeg;base64,AAA', imageName: 'gm.jpg', met: '5,5' },
    { id: 'c1', name: ' Plank ', category: 'Core', defaultRows: [{ set: 1, time: '60 giây' }], futureField: { a: 1 } },
    { id: 'c1', name: 'trùng id' }, { name: 'không id' }, null, 'x',
  ]);
  assert.equal(lib.length, 16);
  const gm = lib.find(x => x.id === 'good-morning');
  assert.equal(gm.name, 'Good Morning with Barbell'); assert.equal(gm.imageName, 'gm.jpg'); assert.equal(gm.met, 5.5);
  const c1 = lib.find(x => x.id === 'c1');
  assert.equal(c1.name, 'Plank'); assert.equal(c1.builtin, false); assert.deepEqual(c1.futureField, { a: 1 });
  assert.deepEqual(c1.defaultRows, [{ set: '1', group: '', reps: '', time: '60 giây', weight: '', note: '' }]);
  assert.equal(F.normalizeLibrary(undefined).length, 15);
});

test('sessionVolume và summaryText', () => {
  const s = F.fromMobile(V3).session;
  assert.deepEqual(F.sessionVolume(s), { exercises: 7, done: 6, sets: 13, reps: 151, kg: 2366 });
  const txt = F.summaryText(s).split('\n');
  assert.equal(txt[0], 'Fitness · 7 bài (6 xong) · 13 set · 2366 kg tổng');
  assert.equal(txt[1], '• ✓ Good Morning with Barbell — 2 set × 10–12 · 20–30 kg');
  assert.match(txt[5], /^• ✗ Single Leg Squat/);
  // khối kế hoạch (không có done) → không có dấu ✓/✗
  const plan = F.toWorkout(s, { status: 'plan' });
  assert.ok(!/[✓✗]/.test(plan.description));
  assert.equal(F.summaryText({ exercises: [] }), '');
  // dòng theo thời gian
  assert.match(F.summaryText([{ name: 'Đi lùi', rows: [{ set: '1', time: '10 phút' }] }]), /Đi lùi — 1 set × 10 phút/);
});

test('contentHash: không phụ thuộc instanceId/sessionId, đổi khi nội dung/ngày đổi', () => {
  const s = F.fromMobile(V3).session;
  const h = F.contentHash(s);
  assert.match(h, /^[0-9a-f]{8}$/);
  const renamed = { ...s, sessionId: 'khác', exercises: s.exercises.map((e, i) => ({ ...e, instanceId: 'new-' + i })) };
  assert.equal(F.contentHash(renamed), h);
  const changed = JSON.parse(JSON.stringify(s)); changed.exercises[0].rows[0].reps = '11';
  assert.notEqual(F.contentHash(changed), h);
  assert.notEqual(F.contentHash({ ...s, date: '2026-11-08' }), h);
});

test('toWorkout: buổi đã tập và buổi kế hoạch', () => {
  const s = F.fromMobile(V3).session;
  const w = F.toWorkout(s);
  assert.equal(w.workoutType, 'Fitness'); assert.equal(w.planMinutes, 48); assert.equal(w.planKm, '');
  assert.equal(w.description, F.summaryText(s));
  assert.equal(w.fitness.schema, 1); assert.match(w.fitness.sessionId, /^fs-/);
  assert.ok(w.fitness.exercises.every(e => !('done' in e)));
  assert.equal(w.actual.status, 'done'); assert.equal(w.actual.minutes, 48); assert.equal(w.actual.fatigue, 7); assert.equal(w.actual.calories, 260);
  assert.equal(w.actual.fitness.sessionId, w.fitness.sessionId);
  assert.equal(w.actual.fitness.contentHash, F.contentHash(s));
  assert.equal(w.actual.fitness.exercises.filter(e => e.done).length, 6);
  assert.equal(F.toWorkout(s, { status: 'plan' }).actual, null);
  assert.ok(F.isFitnessWorkout(w) && F.hasFitnessContent(w));
  assert.ok(!F.isFitnessWorkout({ workoutName: 'Easy', workoutType: 'Easy' }));
});

test('normalizeFitnessBlock: giữ field lạ, chuẩn hoá dòng, bài dựng sẵn lấy tên theo thư viện', () => {
  const b = F.normalizeFitnessBlock({ futureKey: 9, exercises: [{ libraryId: 'tib-raise', name: 'sai tên', cue: 'x', imageData: 'y', done: true, rows: [{ set: 1, reps: 20 }, null] }, 'rác', { name: 'Tự tạo', rows: 'không phải mảng' }] });
  assert.equal(b.schema, 1); assert.equal(b.futureKey, 9); assert.equal(b.sessionId, '');
  assert.equal(b.exercises.length, 2);
  assert.equal(b.exercises[0].name, 'Tib Raise'); assert.ok(!('done' in b.exercises[0])); assert.ok(!('cue' in b.exercises[0]));
  assert.deepEqual(b.exercises[0].rows, [{ set: '1', group: '', reps: '20', time: '', weight: '', note: '' }]);
  assert.deepEqual(b.exercises[1].rows, []);
  assert.equal(F.normalizeFitnessBlock({ exercises: [{ done: 1 }] }, { withDone: true }).exercises[0].done, true);
  assert.equal(F.normalizeFitnessBlock(null), null);
});

test('fixture Excel của app mobile: đủ 4 sheet đúng tên và cột (dùng cho lượt nhập Excel)', async () => {
  const X = require('../src/lib/xlsx.js');
  const files = await X.unzip(new Uint8Array(fs.readFileSync(path.join(FX, 'fitness-mobile-v3.xlsx'))));
  const get = name => files.has(name) ? new TextDecoder().decode(files.get(name)) : '';
  const wb = get('xl/workbook.xml');
  assert.deepEqual([...wb.matchAll(/<sheet [^>]*name="([^"]+)"/g)].map(m => m[1]), ['Session', 'Workout Log', 'Guide', 'Library']);
  const shared = X.parseSharedStrings(get('xl/sharedStrings.xml'));
  const log = X.parseSheet(get('xl/worksheets/sheet2.xml'), shared);
  assert.deepEqual(log[0].slice(0, 4), ['Thứ tự', 'Instance ID', 'Library ID', 'Bài']);
  assert.equal(log.filter(r => r.some(c => c !== '' && c != null)).length - 1, 13); // 13 dòng log = tổng số dòng của 7 bài
});

/* ===================== Lượt 2: giao bài, kết quả, tải, xuất cho app mobile, Excel ===================== */
const L = require('../src/core/legacy.js');
const Load = require('../src/core/load.js');
const X = require('../src/core/excel-plan.js');

/** Hàm normalizeData / defaultData NGUYÊN VĂN của app mobile (cắt từ legacy/T17_Run_Training_Mobile.html). */
function mobileApp() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'legacy', 'T17_Run_Training_Mobile.html'), 'utf8');
  const src = html.slice(html.indexOf("const STORAGE_KEY="), html.indexOf('function loadData(){'));
  return new Function('localStorage', src + '; return { normalizeData, defaultData };')({ getItem: () => null });
}

test('planFromTemplate: mẫu dựng sẵn và mẫu người dùng; mỗi lần là buổi mới, instanceId mang mã buổi', () => {
  const a = F.planFromTemplate(F.BUILTIN_TEMPLATES[0], []), b = F.planFromTemplate(F.BUILTIN_TEMPLATES[0], []);
  assert.equal(a.workoutType, 'Fitness'); assert.equal(a.workoutName, 'Run Basic 1'); assert.equal(a.planMinutes, 45); assert.equal(a.actual, null);
  assert.equal(a.fitness.templateId, 'run-basic-1'); assert.equal(a.fitness.exercises.length, 6);
  assert.notEqual(a.fitness.sessionId, b.fitness.sessionId);
  assert.deepEqual(a.fitness.exercises.map(e => e.instanceId), [1, 2, 3, 4, 5, 6].map(k => `${a.fitness.sessionId}:${k}`));
  assert.equal(F.sessionIdFromInstances(a.fitness.exercises), a.fitness.sessionId);
  assert.equal(a.description, F.summaryText(a.fitness.exercises));
  // dòng mẫu lấy theo thư viện (dựng sẵn)
  assert.deepEqual(a.fitness.exercises[0].rows, F.normalizeRows(F.BUILTIN_LIBRARY[0].defaultRows));
  // mẫu người dùng
  const tpl = { id: 'tplX', ...F.templateFromSession({ workoutName: 'Core 20', duration: 20, workoutNote: 'nhẹ', exercises: [{ libraryId: 'tib-raise', rows: [{ set: '1', reps: '20' }] }, { libraryId: 'c1', name: 'Plank', rows: [{ set: '1', time: '60 giây' }] }] }) };
  assert.equal(tpl.workoutType, 'Fitness'); assert.ok(tpl.fitness.exercises.every(e => e.instanceId === ''));
  const c = F.planFromTemplate(tpl, []);
  assert.equal(c.workoutName, 'Core 20'); assert.equal(c.planMinutes, 20); assert.equal(c.fitness.templateId, 'tplX'); assert.equal(c.planNote, 'nhẹ');
  assert.deepEqual(c.fitness.exercises.map(e => e.name), ['Tib Raise', 'Plank']);
  // withNewSessionId: bản sao độc lập
  const d = F.withNewSessionId(c.fitness);
  assert.notEqual(d.sessionId, c.fitness.sessionId); assert.equal(F.sessionIdFromInstances(d.exercises), d.sessionId);
  d.exercises[0].rows[0].reps = '99'; assert.equal(c.fitness.exercises[0].rows[0].reps, '20');
  assert.equal(F.sessionIdFromInstances([{ instanceId: 'ex-abc' }, { instanceId: 'fs-x-y:1' }, { instanceId: 'ex-2' }]), '');
});

test('repeatDates: lặp theo thứ trong tuần', () => {
  assert.deepEqual(F.repeatDates('2026-11-09', [0, 3], 2), ['2026-11-09', '2026-11-12', '2026-11-16', '2026-11-19']); // 09/11/2026 là thứ Hai
  assert.deepEqual(F.repeatDates('2026-11-11', [6], 1), ['2026-11-15']);
  assert.deepEqual(F.repeatDates('2026-11-11', [0], 1), ['2026-11-16']); // 1 tuần = 7 ngày kể từ ngày bắt đầu
  assert.deepEqual(F.repeatDates('sai', [0], 4), []); assert.deepEqual(F.repeatDates('2026-11-09', [], 4), []); assert.equal(F.repeatDates('2026-11-09', [0], 999).length, 52);
});

test('buildActual + completion: kết quả tay, giữ field lạ, mã băm', () => {
  const w = { id: 'w1', ...F.planFromTemplate(F.BUILTIN_TEMPLATES[0], []) };
  const ex = w.fitness.exercises.map((e, i) => ({ ...e, done: i < 4 }));
  w.actual = F.buildActual({ fitImport: { keep: 1 } }, { status: 'done', minutes: 50, rpe: 7, calories: 300, note: 'ok', exercises: ex, date: '2026-11-10' }, w);
  assert.equal(w.actual.minutes, 50); assert.equal(w.actual.fatigue, 7); assert.equal(w.actual.km, ''); assert.deepEqual(w.actual.fitImport, { keep: 1 });
  assert.equal(w.actual.fitness.sessionId, w.fitness.sessionId); assert.match(w.actual.fitness.contentHash, /^[0-9a-f]{8}$/);
  assert.deepEqual(F.completion(w), { done: 4, total: 6, ratio: 4 / 6 });
  assert.equal(F.completion({ actual: { status: 'missed', fitness: { exercises: [] } } }), null);
  assert.equal(F.completion({ workoutName: 'Easy', actual: { status: 'done' } }), null);
  // qua normalizeDb vẫn nguyên
  const db = L.normalizeDb({ weeks: [{ days: [{ date: '2026-11-10', workouts: [w] }] }] }).db;
  assert.deepEqual(db.weeks[0].days[1].workouts[0].actual.fitness, w.actual.fitness);
});

test('điểm tải fitness = RPE × phút ÷ 4,8; thiếu RPE → mặc định 5; bài chạy không đổi', () => {
  const fit = (min, rpe) => ({ workoutType: 'Fitness', planMinutes: 45, fitness: { exercises: [] }, actual: { status: 'done', minutes: min, fatigue: rpe, avgHr: 150 } });
  assert.deepEqual(Load.actualLoad(fit(60, 8), {}), { load: 100, method: 'srpe' });
  assert.equal(Load.actualLoad(fit(48, ''), {}).load, 50); assert.equal(Load.actualLoad(fit(48, ''), {}).method, 'srpe-default');
  assert.equal(Load.actualLoad(fit('', 6), {}).load, 6 * 45 / 4.8); // thiếu phút thực tế → dùng phút kế hoạch
  assert.equal(Load.plannedLoad({ workoutType: 'Fitness', planMinutes: 48, fitness: { exercises: [] } }, {}), 50);
  assert.equal(Load.plannedLoad({ workoutType: 'Fitness', planMinutes: 60, fitness: { plannedRpe: 8, exercises: [] } }, {}), 100);
  // bài chạy: cùng dữ liệu nhưng không phải fitness → vẫn tính theo nhịp tim như trước
  const run = { workoutType: 'Easy', actual: { status: 'done', minutes: 60, fatigue: 8, avgHr: 150 } };
  assert.equal(Load.actualLoad(run, { hrRest: 50, hrMax: 190, lthr: 170 }).method, 'hr-avg');
});

test('toMobileData → hàm normalizeData NGUYÊN VĂN của app mobile: giữ đủ buổi, giữ mã buổi trong instanceId', () => {
  const M = mobileApp();
  const lib = F.normalizeLibrary([{ id: 'c1', name: 'Plank', category: 'Core', imageData: 'data:image/jpeg;base64,AAAA', defaultRows: [{ set: 1, time: '60 giây' }] }]);
  const tpl = { id: 'tplX', ...F.templateFromSession({ workoutName: 'Core 20', duration: 20, workoutNote: 'nhẹ', exercises: [{ libraryId: 'tib-raise', rows: [{ set: '1', reps: '20' }, { set: '2', reps: '20' }] }, { libraryId: 'c1', name: 'Plank', category: 'Core', rows: [{ set: '1', time: '60 giây' }] }] }) };
  const w = { id: 'w9', ...F.planFromTemplate(tpl, lib) };
  const out = JSON.parse(JSON.stringify(F.toMobileData(w, '2026-11-12', lib, { now: '2026-11-09T00:00:00Z' })));
  assert.equal(out.version, 3); assert.equal(out.session.date, '2026-11-12'); assert.equal(out.session.duration, '20'); assert.equal(out.session.workoutNote, 'nhẹ');
  const got = M.normalizeData(out);
  assert.equal(got.session.workoutName, 'Core 20'); assert.equal(got.session.templateId, 'tplX'); assert.equal(got.session.date, '2026-11-12'); assert.equal(got.session.duration, '20');
  assert.deepEqual(got.session.exercises.map(e => [e.libraryId, e.name, e.done, e.rows.length]), [['tib-raise', 'Tib Raise', false, 2], ['c1', 'Plank', false, 1]]);
  assert.equal(got.session.exercises[0].rows[1].reps, '20');
  assert.equal(F.sessionIdFromInstances(got.session.exercises), w.fitness.sessionId, 'mã buổi T17 đi khứ hồi qua app mobile');
  assert.ok(got.library.some(x => x.id === 'c1' && x.imageData), 'bài tự tạo + ảnh sang được app mobile');
  // app mobile xuất lại → T17 đọc được (lượt 3 dùng)
  const back = F.fromMobile({ ...got, exportedAt: 'x' });
  assert.equal(back.kind, 'v3'); assert.equal(F.sessionIdFromInstances(back.session.exercises), w.fitness.sessionId);
  assert.throws(() => F.toMobileData({ workoutName: 'Easy', workoutType: 'Easy' }, '2026-11-12', []), /không phải buổi fitness/);
  assert.equal(F.mobileFileName('2026-11-12', 'Bổ trợ khớp gối 1 / đặc biệt'), '2026-11-12_Bo-tro-khop-goi-1-dac-biet.json');
});

test('dataUrlBytes: tính đúng kích thước ảnh base64', () => {
  const buf = Buffer.alloc(61 * 1024, 7); const url = 'data:image/jpeg;base64,' + buf.toString('base64');
  assert.equal(F.dataUrlBytes(url), 61 * 1024); assert.ok(F.dataUrlBytes(url) > F.IMAGE_MAX_BYTES);
  assert.equal(F.dataUrlBytes('data:image/png;base64,' + Buffer.from('ab').toString('base64')), 2); assert.equal(F.dataUrlBytes('rác'), 0);
});

test('Excel: khối chi tiết fitness — bản mới đọc lại đủ bài; bản v2.2.0 vẫn đọc lưới, bài chạy không đổi', () => {
  const w = { id: 'w1', ...F.planFromTemplate(F.BUILTIN_TEMPLATES[0], []) };
  const run = { id: 'r1', workoutName: 'Easy 8K', workoutType: 'Easy', planKm: 8, planMinutes: 50, description: '', planNote: 'nhẹ', workoutStructure: null, actual: null };
  const sid = X.fitnessKeyOf(w);
  const days = ['12/10/2026', '13/10/2026', '14/10/2026', '15/10/2026', '16/10/2026', '17/10/2026', '18/10/2026'];
  const aoa = [['Tuần \\ Thứ', 'Hai', 'Ba', 'Tư', 'Năm', 'Sáu', 'Bảy', 'CN'], ['42', run.workoutName, w.workoutName, '', '', '', '', ''], ['ngày', ...days],
    ['Mô tả bài tập', '', w.description, '', '', '', '', ''], ['Số km dự kiến', 8, '', '', '', '', '', ''], ['Số phút dự kiến', 50, 45, '', '', '', '', ''], ['Ghi chú kế hoạch', 'nhẹ', w.planNote, '', '', '', '', ''],
    ['Cấu trúc bài tập JSON', '', '', '', '', '', '', ''], [X.FIT_GRID_LABEL, '', sid, '', '', '', '', ''], [], ...X.fitnessSectionAoa([{ date: days[1], item: w }])];
  const weeks = X.parseWorkbookRows(aoa);
  const d2 = weeks[0].days[1];
  assert.equal(d2.workoutType, 'Fitness'); assert.equal(d2.workoutStructure, null);
  assert.deepEqual(d2.fitness.exercises.map(e => [e.libraryId, e.rows]), w.fitness.exercises.map(e => [e.libraryId, e.rows]));
  // bản v2.2.0
  const vm = require('node:vm'); const ctx = vm.createContext({});
  for (const f of ['utils.js', 'excel-plan.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, 'compat', 'v2.2.0', f), 'utf8'), ctx);
  const old = JSON.parse(JSON.stringify(ctx.T17ExcelPlan.parseWorkbookRows(aoa)));
  assert.equal(old.length, 1);
  assert.deepEqual(old[0].days[0], JSON.parse(JSON.stringify(weeks[0].days[0])), 'bài chạy: bản cũ và bản mới đọc giống hệt');
  assert.equal(old[0].days[1].workoutName, 'Run Basic 1'); assert.equal(old[0].days[1].description, w.description); assert.equal(old[0].days[1].planMinutes, 45);
  // Excel chỉ có chạy bộ: không có hàng/khối fitness
  assert.deepEqual(X.fitnessSectionAoa([{ date: days[0], item: run }]), []);
});
