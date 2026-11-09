'use strict';
/* Tương thích hai chiều với T17 v2.2.0 (lõi nguyên văn trong tests/compat/v2.2.0, nạp trong vm riêng):
 *  (a) file cũ → bản mới nạp ra KẾT QUẢ GIỐNG HỆT bản v2.2.0 (chạy bộ không đổi hành vi)
 *  (b) file mới (có fitness) → bản v2.2.0 nạp/lưu/gộp không mất trường nào
 *  (c) bản mới: xuất → nạp lại → bằng nhau; nhập lại cùng file không nhân đôi */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const L = require('../src/core/legacy.js');
const F = require('../src/core/fitness.js');

const FX = path.join(__dirname, 'fixtures');
const readJson = f => JSON.parse(fs.readFileSync(path.join(FX, f), 'utf8'));
const clone = x => JSON.parse(JSON.stringify(x));

// ---- lõi v2.2.0 trong context riêng (không lẫn globalThis.T17Core/T17Legacy của bản mới) ----
const ctx = vm.createContext({ console });
for (const f of ['utils.js', 'legacy.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, 'compat', 'v2.2.0', f), 'utf8'), ctx, { filename: 'v2.2.0/' + f });
const OLD = ctx.T17Legacy;
assert.ok(OLD && OLD.normalizeDb && OLD.SCHEMA_VERSION === 2, 'nạp được lõi v2.2.0');

/** Chạy fn với Math.random / Date.now xác định (genId sinh id giống nhau ở cả hai bản). */
function seeded(realmMath, realmDate, fn) {
  const r0 = realmMath.random, n0 = realmDate.now; let s = 12345, t = 1767225600000;
  realmMath.random = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  realmDate.now = () => ++t;
  try { return fn(); } finally { realmMath.random = r0; realmDate.now = n0; }
}
const runOld = fn => seeded(vm.runInContext('Math', ctx), vm.runInContext('Date', ctx), () => JSON.parse(JSON.stringify(fn(OLD))));
const runNew = fn => seeded(Math, Date, () => JSON.parse(JSON.stringify(fn(L))));
const stripVolatile = db => { const o = clone(db); delete o.exportedAt; delete o.appVersion; return o; };

const OLD_FIXTURES = ['runplan-v1-legacy-day-fields.json', 'runplan-v189-backup.json', 'runplan-plan-export.json', 'runplan-log-export.json', 'localstorage-dump-double-encoded.json',
  't17-v22-multiuser/t17-runtracker.json', 't17-v22-multiuser/users/umw8y78ljgs3.json'];
const rawOf = f => L.parseJsonText(fs.readFileSync(path.join(FX, f), 'utf8'));

test('(a) mọi file đời cũ: bản mới chuẩn hoá ra kết quả giống hệt bản v2.2.0', () => {
  for (const f of OLD_FIXTURES) {
    const raw = rawOf(f);
    const o = runOld(M => M.normalizeDb(clone(raw)));
    const n = runNew(M => M.normalizeDb(clone(raw)));
    assert.deepEqual(n.db, o.db, f + ': db');
    const { fitnessSessions, ...rep } = n.report; assert.equal(fitnessSessions, 0, f); assert.deepEqual(rep, o.report, f + ': report');
    assert.ok(!('features' in n.db) && !('fitnessLibrary' in n.db), f + ': file chạy bộ không bị thêm field mới');
  }
});

test('(a) gộp file Xuất bài tập / Training Log đời cũ: kết quả giống hệt v2.2.0', () => {
  for (const f of ['runplan-plan-export.json', 'runplan-log-export.json']) {
    const raw = rawOf(f); const withActual = f.includes('log');
    const base = rawOf('runplan-v189-backup.json');
    const o = runOld(M => { const db = M.normalizeDb(clone(base)).db; const res = M.mergeDays(db, M.exportToDays(clone(raw)), { withActual }); const res2 = M.mergeDays(db, M.exportToDays(clone(raw)), { withActual }); return { db, res, res2 }; });
    const n = runNew(M => { const db = M.normalizeDb(clone(base)).db; const res = M.mergeDays(db, M.exportToDays(clone(raw)), { withActual }); const res2 = M.mergeDays(db, M.exportToDays(clone(raw)), { withActual }); return { db, res, res2 }; });
    assert.deepEqual(n, o, f);
  }
});

test('(a) bộ dữ liệu 2 người dùng do chính bản v2.2.0 ghi: chỉ mục + từng người nạp đúng', () => {
  const Users = require('../src/core/users.js');
  const idx = Users.normalizeIndex(readJson('t17-v22-multiuser/users.json'));
  assert.deepEqual(idx.users.map(u => u.name), ['Tôi', 'Lan']);
  const lan = L.normalizeDb(readJson(`t17-v22-multiuser/users/${idx.users[1].id}.json`)).db;
  assert.equal(lan.profile.fullName, 'Trần Thị Lan'); assert.equal(lan.weeks.flatMap(w => w.days).flatMap(d => d.workouts).length, 2);
  const main = L.normalizeDb(readJson('t17-v22-multiuser/t17-runtracker.json')).db;
  assert.equal(main.profile.city, 'Hà Nội');
});

const GOLDEN = readJson('t17-fitness-backup.json');
const fitnessOf = db => db.weeks.flatMap(w => w.days.flatMap(d => d.workouts.filter(F.isFitnessWorkout).map(x => ({ date: d.date, id: x.id, workoutType: x.workoutType, description: x.description, fitness: x.fitness, actualFitness: x.actual?.fitness ?? null }))));

test('(b) file mới có fitness: bản v2.2.0 nạp → sao lưu → không mất trường nào, chạy bộ y nguyên', () => {
  const nNew = runNew(M => M.normalizeDb(clone(GOLDEN)).db);
  const viaOld = runOld(M => JSON.parse(JSON.stringify(M.toBackup(M.normalizeDb(clone(GOLDEN)).db, '2.2.0'))));
  assert.equal(fitnessOf(nNew).length, 2);
  assert.deepEqual(fitnessOf(viaOld), fitnessOf(nNew));
  assert.deepEqual(viaOld.fitnessLibrary, nNew.fitnessLibrary);
  assert.deepEqual(viaOld.features, { fitness: 1 });
  assert.equal(viaOld.schemaVersion, 2);
  assert.deepEqual(viaOld.profile, nNew.profile);
  // toàn bộ db (kể cả bài chạy) giống hệt
  assert.deepEqual(stripVolatile(viaOld), stripVolatile(nNew));
  // và bản mới đọc lại file đã qua tay v2.2.0 vẫn ra đúng như cũ
  assert.deepEqual(stripVolatile(runNew(M => M.normalizeDb(clone(viaOld)).db)), stripVolatile(nNew));
});

test('(b) Xuất bài tập / Training Log có fitness → bản v2.2.0 nhập vẫn giữ khối fitness', () => {
  const db = L.normalizeDb(clone(GOLDEN)).db;
  const days = []; for (const w of db.weeks) for (const d of w.days) if (d.workouts.length) days.push({ date: d.date, dow: d.dow, workouts: d.workouts.map(L.planRecord) });
  const plan = { format: 'runplan-plan', version: 1, days };
  const entries = db.weeks.flatMap(w => w.days.flatMap(d => d.workouts.map(it => ({ date: d.date, dow: d.dow, workoutName: it.workoutName, workoutType: it.workoutType, planKm: it.planKm, planMinutes: it.planMinutes, description: it.description, planNote: it.planNote, ...(it.fitness ? { fitness: clone(it.fitness) } : {}), actual: it.actual || null }))));
  const log = { format: 'runplan-log', version: 1, entries };
  const oldDb = runOld(M => { const x = M.normalizeDb({ weeks: [] }).db; M.mergeDays(x, M.exportToDays(clone(plan)), { withActual: false }); M.mergeDays(x, M.exportToDays(clone(log)), { withActual: true }); return x; });
  const got = oldDb.weeks.flatMap(w => w.days.flatMap(d => d.workouts.filter(x => x.fitness)));
  assert.ok(got.length >= 2);
  const want = fitnessOf(db);
  for (const wnt of want) assert.ok(got.some(g => JSON.stringify(g.fitness) === JSON.stringify(wnt.fitness)), 'giữ workout.fitness ' + wnt.id);
  const done = want.find(x => x.actualFitness);
  assert.ok(got.some(g => g.actual && JSON.stringify(g.actual.fitness) === JSON.stringify(done.actualFitness)), 'giữ actual.fitness');
});

test('(c) bản mới: sao lưu → nạp lại bằng nhau', () => {
  const db = L.normalizeDb(clone(GOLDEN)).db;
  const again = L.normalizeDb(JSON.parse(JSON.stringify(L.toBackup(db, '2.3.0')))).db;
  assert.deepEqual(stripVolatile(again), stripVolatile(db));
  assert.deepEqual(L.normalizeDb(clone(again)).db, again, 'normalizeDb idempotent');
});

test('(c) bản mới: Xuất bài tập → nhập vào kho trống bằng nhau; nhập lần 2 không nhân đôi', () => {
  const db = L.normalizeDb(clone(GOLDEN)).db;
  const days = []; for (const w of db.weeks) for (const d of w.days) if (d.workouts.length) days.push({ date: d.date, workouts: d.workouts.map(L.planRecord) });
  const total = days.reduce((n, d) => n + d.workouts.length, 0);
  const x = L.normalizeDb({ weeks: [] }).db;
  const r1 = L.mergeDays(x, L.exportToDays({ format: 'runplan-plan', days: clone(days) }));
  assert.equal(r1.added, total); assert.equal(r1.invalid, 0);
  const plans = db.weeks.flatMap(w => w.days.flatMap(d => d.workouts.map(it => [d.date, L.planRecord(it)])));
  const got = x.weeks.flatMap(w => w.days.flatMap(d => d.workouts.map(it => [d.date, L.planRecord(it)])));
  assert.deepEqual(got, plans);
  const r2 = L.mergeDays(x, L.exportToDays({ format: 'runplan-plan', days: clone(days) }));
  assert.equal(r2.added, 0); assert.equal(r2.duplicates, total);
});

test('(c) Training Log: hai buổi fitness cùng ngày, cùng thời lượng, khác nội dung → giữ đủ cả hai; nhập lại không nhân đôi', () => {
  const s = F.fromMobile(readJson('fitness-mobile-v3.json')).session;
  const s2 = clone(s); s2.workoutName = 'Run Basic 1'; s2.exercises[0].rows[0].reps = '8'; // cùng tên, cùng 48 phút, khác 1 dòng
  const mk = ss => { const w = F.toWorkout(ss); return { date: ss.date, ...w }; };
  const log = { format: 'runplan-log', entries: [mk(s), mk(s2)] };
  const x = L.normalizeDb({ weeks: [] }).db;
  const r1 = L.mergeDays(x, L.exportToDays(clone(log)), { withActual: true });
  assert.equal(r1.added, 2, JSON.stringify(r1));
  const r2 = L.mergeDays(x, L.exportToDays(clone(log)), { withActual: true });
  assert.equal(r2.added, 0); assert.equal(r2.duplicates, 2);
});

test('features: chỉ xuất hiện khi có dữ liệu fitness; giữ khoá lạ của phiên bản sau', () => {
  assert.equal(L.featuresOf({ weeks: [] }), null);
  assert.deepEqual(L.featuresOf({ weeks: [], fitnessLibrary: [] }), { fitness: 1 });
  assert.deepEqual(L.normalizeDb({ weeks: [], features: { body: 1 } }).db.features, { body: 1 });
  assert.deepEqual(L.normalizeDb({ weeks: [], features: { fitness: 7 }, fitnessLibrary: [] }).db.features, { fitness: 7 });
  assert.ok(!('features' in L.normalizeDb({ weeks: [], features: {} }).db));
  const lib = L.normalizeDb({ weeks: [], fitnessLibrary: 'hỏng' }).db.fitnessLibrary; assert.equal(lib.length, 15);
});

test('normalizeWorkout: khối fitness hỏng không làm mất bài; buổi chỉ có bài tập (không tên) vẫn được giữ', () => {
  const rep = { workouts: 0, actuals: 0, fitActivities: 0, fitnessSessions: 0, idsFixed: 0 };
  const a = L.normalizeWorkout({ workoutName: 'X', fitness: 'hỏng', actual: { status: 'done', fitness: 5 } }, new Set(), rep);
  assert.ok(!('fitness' in a)); assert.ok(!('fitness' in a.actual));
  const b = L.normalizeWorkout({ fitness: { exercises: [{ libraryId: 'tib-raise', rows: [] }] } }, new Set(), rep);
  assert.ok(b && b.fitness.exercises.length === 1);
  assert.equal(L.normalizeWorkout({ fitness: { exercises: [] } }, new Set(), rep), null);
});
