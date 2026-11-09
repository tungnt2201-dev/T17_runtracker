// Calo trong ngày (v2.5): BMR, nền, calo ròng buổi tập — đúng bộ số trong bảng kiểm thử của tài liệu khung.
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/core/energy.js');
const L = require('../src/core/legacy.js');

const near = (a, b, eps = 0.01) => assert.ok(Math.abs(a - b) <= eps, `${a} ≠ ${b}`);
// 35 tuổi vào 2026-11-09
const MAN = { sex: 'male', heightCm: '175', birthDate: '1991-01-15', weightKg: 80 };
const WOMAN = { sex: 'female', heightCm: '165', birthDate: '1996-02-01', weightKg: 60 };
const D = '2026-11-09';
const wk = (days) => ({ weeks: [{ label: 'T', days: days.map(([date, workouts]) => ({ dow: 'Mon', date, workouts })) }] });

test('Mifflin–St Jeor: nam 80 kg/175 cm/35 tuổi = 1723,75; nữ 60/165/30 = 1320,25', () => {
  const m = E.bmr(MAN, [], D); assert.equal(m.ok, true); assert.equal(m.method, 'mifflin'); near(m.kcal, 1723.75);
  const f = E.bmr(WOMAN, [], D); assert.equal(f.method, 'mifflin'); near(f.kcal, 1320.25);
});

test('Katch–McArdle khi có % mỡ: 80 kg, 20% = 1752,4; BMR đo thật được ưu tiên trước', () => {
  near(E.bmr(MAN, [{ date: '2026-11-01', weightKg: 80, bodyFatPct: 20 }], D).kcal, 1752.4);
  assert.equal(E.bmr(MAN, [{ date: '2026-11-01', weightKg: 80, bodyFatPct: 20 }], D).method, 'katch');
  const r = E.bmr(MAN, [{ date: '2026-11-01', weightKg: 80, bodyFatPct: 20, bmrKcal: 1690 }], D);
  assert.equal(r.method, 'measured'); assert.equal(r.kcal, 1690);
  // ép công thức Mifflin
  near(E.bmr({ ...MAN, energy: { formula: 'mifflin' } }, [{ date: '2026-11-01', weightKg: 80, bodyFatPct: 20, bmrKcal: 1690 }], D).kcal, 1723.75);
});

test('Nền = BMR × PAL 1,3 = 2240,875; chạy 10 km không FIT = 800 ròng; tổng ngày ≈ 3041', () => {
  const b = E.baseline(MAN, [], D); assert.equal(b.source, 'auto'); near(b.kcal, 2240.875);
  const db = { profile: MAN, bodyMetrics: [], ...wk([[D, [{ id: 'r1', workoutName: 'Easy', planKm: 10, actual: { status: 'done', km: 10, minutes: 60 } }]]]) };
  const d = E.day(db, D); near(d.exerciseKcal, 800); assert.equal(d.sessions[0].method, 'run-km'); assert.equal(Math.round(d.total), 3041);
});

test('Fitness 60 phút, 70 kg, MET 5 (RPE 5–6 hoặc thiếu) = 280 ròng; MET theo RPE', () => {
  const it = { id: 'f1', workoutType: 'Fitness', planMinutes: 60, fitness: { schema: 1, exercises: [] }, actual: { status: 'done', minutes: 60, fatigue: '' } };
  near(E.sessionNet(it, { weightKg: 70 }).kcal, 280);
  near(E.sessionNet({ ...it, actual: { ...it.actual, fatigue: 3 } }, { weightKg: 70 }).kcal, 2.5 * 70);
  near(E.sessionNet({ ...it, actual: { ...it.actual, fatigue: 8 } }, { weightKg: 70 }).kcal, 5 * 70);
});

test('FIT 750 kcal / 60 phút, BMR 1724 → ≈ 678 ròng; calo nhập tay cũng trừ phần nghỉ', () => {
  const it = { id: 'r', actual: { status: 'done', km: 10, minutes: 60, calories: 750, fitImport: { id: 'x' } } };
  const r = E.sessionNet(it, { weightKg: 80, bmrKcal: 1724 }); assert.equal(r.method, 'fit'); assert.equal(Math.round(r.kcal), 678);
  const m = E.sessionNet({ id: 'r', actual: { status: 'done', km: 10, minutes: 60, calories: 750 } }, { weightKg: 80, bmrKcal: 1724 }); assert.equal(m.method, 'manual'); assert.equal(Math.round(m.kcal), 678);
});

test('Nhiều buổi trong ngày cộng lại; bài kế hoạch là “dự kiến”, không vào tổng thực; bài bỏ = 0', () => {
  const db = { profile: MAN, ...wk([[D, [
    { id: 'a', actual: { status: 'done', km: 5, minutes: 30 } },
    { id: 'b', workoutType: 'Fitness', planMinutes: 30, fitness: { schema: 1, exercises: [] }, actual: { status: 'done', minutes: 30, fatigue: 6 } },
    { id: 'c', planKm: 8 },
    { id: 'd', planKm: 6, actual: { status: 'missed' } },
  ]]]) };
  const d = E.day(db, D);
  near(d.exerciseKcal, 400 + 4 * 80 * 0.5); near(d.plannedKcal, 640);
  assert.equal(d.sessions.find(s => s.id === 'c').planned, true);
  assert.equal(d.sessions.find(s => s.id === 'd').kcal, 0);
});

test('Thiếu chiều cao / tuổi / giới tính → liệt kê ô thiếu, không đoán', () => {
  const r = E.bmr({ weightKg: 70 }, [], D); assert.equal(r.ok, false);
  assert.deepEqual(r.missing, ['chiều cao', 'ngày sinh (tuổi)', 'giới tính']);
  const b = E.baseline({ weightKg: 70 }, [], D); assert.equal(b.ok, false); assert.equal(b.kcal, null);
  const d = E.day({ profile: {}, weeks: [] }, D); assert.equal(d.total, null); assert.ok(d.missing.includes('cân nặng'));
  // vẫn có % mỡ + cân → Katch không cần chiều cao/tuổi
  assert.equal(E.bmr({}, [{ date: '2026-01-01', weightKg: 70, bodyFatPct: 18 }], D).method, 'katch');
});

test('Cân nặng lấy bản ghi gần nhất vào/trước ngày, không dùng số đo tương lai; tuổi tính tại ngày', () => {
  const body = [{ date: '2026-10-01', weightKg: 82 }, { date: '2026-11-05', weightKg: 79 }, { date: '2026-12-01', weightKg: 75 }];
  assert.equal(E.inputsAt(MAN, body, '2026-11-04').weightKg, 82);
  assert.equal(E.inputsAt(MAN, body, '2026-11-09').weightKg, 79);
  assert.equal(E.inputsAt(MAN, body, '2026-09-01').weightKg, 80); // trước mọi số đo → cân trong hồ sơ
  assert.equal(E.inputsAt(MAN, [], '2026-01-14').age, 34); assert.equal(E.inputsAt(MAN, [], '2026-01-15').age, 35);
});

test('Ưu tiên nền: ghi đè ngày → số cố định (manual) → công thức; PAL tuỳ ý 1,1–2,0', () => {
  const p = { ...MAN, energy: { mode: 'manual', baselineKcalManual: 2100, pal: 1.5, overrides: { [D]: 2500 } } };
  assert.deepEqual([E.baseline(p, [], D).kcal, E.baseline(p, [], D).source], [2500, 'override']);
  assert.deepEqual([E.baseline(p, [], '2026-11-10').kcal, E.baseline(p, [], '2026-11-10').source], [2100, 'manual']);
  near(E.baseline({ ...MAN, energy: { pal: 1.75 } }, [], D).kcal, 1723.75 * 1.75);
  assert.equal(E.normalizeSettings({ pal: 2.5 }).pal, 1.3); // ngoài khoảng → mặc định
  const q = E.setOverride(MAN, D, '2333'); assert.equal(q.energy.overrides[D], 2333); assert.equal(MAN.energy, undefined);
  assert.equal(E.baseline(q, [], D).source, 'override');
  assert.deepEqual(E.setOverride(q, D, '').energy.overrides, {});
  assert.throws(() => E.setOverride(MAN, D, 50), /300–8000/);
  const r = E.resetAuto(p); assert.equal(r.energy.mode, 'auto'); assert.equal(r.energy.baselineKcalManual, null); assert.equal(r.energy.overrides[D], 2500);
});

test('Hai người dùng cho số khác nhau', () => {
  const run = { id: 'r', actual: { status: 'done', km: 10, minutes: 60 } };
  const a = E.day({ profile: MAN, ...wk([[D, [run]]]) }, D), b = E.day({ profile: WOMAN, ...wk([[D, [run]]]) }, D);
  assert.notEqual(Math.round(a.total), Math.round(b.total)); near(b.exerciseKcal, 600); near(b.baseline.kcal, 1320.25 * 1.3);
});

test('Gộp tuần: trung bình mỗi ngày của nền và tập', () => {
  const list = E.days({ profile: MAN, ...wk([[D, [{ id: 'r', actual: { status: 'done', km: 10, minutes: 60 } }]]]) }, '2026-11-09', '2026-11-15');
  assert.equal(list.length, 7); const w = E.weekly(list); assert.equal(w.length, 1); assert.equal(w[0].week, '2026-11-09');
  near(w[0].avgExercise, 800 / 7); near(w[0].avgBaseline, 2240.875);
});

test('Tương thích: file cũ không có energy nạp không lỗi, không thêm field; energy được chuẩn hoá + features.energy', () => {
  const old = L.normalizeDb({ weeks: [], profile: { sex: 'male', weightKg: 70 } }).db;
  assert.equal(old.profile.energy, undefined); assert.ok(!old.features || !old.features.energy);
  const n = L.normalizeDb({ weeks: [], profile: { ...MAN, energy: { pal: '1,4', overrides: { [D]: '2400', 'xấu': 9 }, future: 'giữ' } } }).db;
  assert.equal(n.profile.energy.pal, 1.4); assert.deepEqual(n.profile.energy.overrides, { [D]: 2400 }); assert.equal(n.profile.energy.future, 'giữ');
  assert.equal(n.features.energy, 1);
});

test('Không bao giờ ghi số ước tính vào actual.calories', () => {
  const it = { id: 'r', actual: { status: 'done', km: 10, minutes: 60 } }; const db = { profile: MAN, ...wk([[D, [it]]]) };
  const before = JSON.stringify(db); E.day(db, D); E.days(db, D, '2026-11-12'); assert.equal(JSON.stringify(db), before);
});

test('days() dùng chỉ mục cho kết quả y hệt day() từng ngày (kể cả nhiều lần đo cùng ngày, số đo sai khoảng)', () => {
  const body = [{ date: '2026-11-03', time: '20:00', weightKg: 78 }, { date: '2026-11-03', time: '06:00', weightKg: 80, bodyFatPct: 21 }, { date: '2026-11-05', weightKg: 1e9 }, { date: '2026-11-06', time: '', weightKg: 79, bmrKcal: 1650 }, { date: 'x', weightKg: 70 }, null];
  const db = { profile: MAN, bodyMetrics: body, ...wk([['2026-11-04', [{ id: 'r', actual: { status: 'done', km: 8, minutes: 50 } }]], ['2026-11-07', [{ id: 'f', workoutType: 'Fitness', planMinutes: 40, fitness: { schema: 1, exercises: [] } }]]]) };
  const fast = E.days(db, '2026-11-01', '2026-11-08'); const slow = fast.map(d => E.day(db, d.date));
  assert.deepEqual(fast, slow); assert.equal(fast[3].baseline.bmr.inputs.weightKg, 78); assert.equal(fast[5].baseline.bmr.method, 'measured');
  assert.deepEqual(E.days(db, 'sai', '2026-11-08'), []);
});
