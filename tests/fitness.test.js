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
