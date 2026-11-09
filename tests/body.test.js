'use strict';
/* Lượt 4 — chỉ số cơ thể: chuẩn hoá, cảnh báo, chỉ số suy ra, so sánh theo mốc, xu hướng, CSV/Excel, gộp, tương thích. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const B = require('../src/core/body.js');
const L = require('../src/core/legacy.js');
const FX = path.join(__dirname, 'fixtures');
const VN = -420;
const rec = (date, time, o) => B.normalizeRecord({ date, time, ...o });

test('chuẩn hoá: số "1,5"/"1.5", giờ, bỏ bản ghi rỗng, giữ field lạ; cảnh báo không chặn', () => {
  const r = B.normalizeRecord({ date: '2026-11-09', time: '6:5', weightKg: '68,4', bodyFatPct: '17.2', waistCm: '', future: { a: 1 } });
  assert.equal(r.time, ''); assert.equal(r.weightKg, 68.4); assert.equal(r.bodyFatPct, 17.2); assert.ok(!('waistCm' in r)); assert.deepEqual(r.future, { a: 1 }); assert.match(r.id, /^bm-/);
  assert.equal(B.normalizeRecord({ date: '2026-11-09', time: '06:05', weightKg: 68 }).time, '06:05');
  assert.equal(B.normalizeRecord({ date: '2026-11-09' }), null); assert.equal(B.normalizeRecord({ weightKg: 70 }), null);
  assert.ok(B.normalizeRecord({ date: '2026-11-09', note: 'chỉ ghi chú' }));
  assert.equal(B.normalizeRecord({ date: '09/11/2026', weightKg: 70 }).date, '2026-11-09');
  const iso = B.normalizeRecord({ date: '2026-11-08T23:30:00Z', weightKg: 70 }, { tzOffsetMin: VN });
  assert.deepEqual([iso.date, iso.time], ['2026-11-09', '06:30']); // giờ VN
  const odd = B.normalizeRecord({ date: '2026-11-09', weightKg: 300, bodyFatPct: 2, muscleKg: 310 });
  assert.equal(odd.weightKg, 300, 'không chặn');
  assert.deepEqual(B.warnings(odd, { today: '2026-11-09' }).map(w => w.key), ['weightKg', 'bodyFatPct', 'muscleKg', 'muscleKg']);
  assert.deepEqual(B.warnings(rec('2026-12-01', '', { weightKg: 70 }), { today: '2026-11-09' }).map(w => w.key), ['date']);
  assert.equal(B.num('1.650', 'bmrKcal'), 1650); assert.equal(B.num('1.234,5'), 1234.5); assert.equal(B.num('—'), ''); assert.equal(B.num('70 kg'), 70);
  const list = B.normalizeList([{ id: 'x', date: '2026-11-02', weightKg: 70 }, { id: 'x', date: '2026-11-01', time: '07:00', weightKg: 71 }, null, { date: 'sai' }]);
  assert.deepEqual(list.map(r => r.date), ['2026-11-01', '2026-11-02']); assert.notEqual(list[0].id, list[1].id);
});

test('chỉ số suy ra: BMI theo chiều cao hồ sơ, khối nạc FFM, eo/hông', () => {
  const r = rec('2026-11-09', '', { weightKg: 70, bodyFatPct: 20, waistCm: 80, hipCm: 96 });
  assert.deepEqual(B.derived(r, { heightCm: '175' }), { bmi: 22.9, ffmKg: 56, whr: 0.83 });
  assert.deepEqual(B.derived(r, {}), { ffmKg: 56, whr: 0.83 });
  assert.deepEqual(B.derived(rec('2026-11-09', '', { waistCm: 80 }), { heightCm: 175 }), {});
});

test('so sánh theo từng trường: lần trước / 7 / 30 / 90 ngày / lần đầu / ngày chọn; chỉ trường cả hai cùng có; ±3 ngày', () => {
  const list = B.normalizeList([
    { id: 'a', date: '2026-08-01', weightKg: 74, bodyFatPct: 22 },
    { id: 'b', date: '2026-10-08', weightKg: 71.5, waistCm: 86 },
    { id: 'c', date: '2026-10-30', weightKg: 70.4, bodyFatPct: 19.5 },
    { id: 'd', date: '2026-11-09', time: '06:30', weightKg: 70 },
    { id: 'e', date: '2026-11-09', time: '21:00', weightKg: 70.6, bodyFatPct: 19.2, waistCm: 84 },
  ]);
  const e = list.find(r => r.id === 'e');
  const prev = B.compare(list, e, { kind: 'prev' }, { heightCm: 175 });
  const by = k => prev.find(x => x.key === k);
  assert.deepEqual([by('weightKg').from, by('weightKg').refTime, by('weightKg').delta], [70, '06:30', 0.6], 'nhiều lần/ngày: lần trước là sáng cùng ngày');
  assert.deepEqual([by('bodyFatPct').from, by('bodyFatPct').refDate, by('bodyFatPct').delta, by('bodyFatPct').pct], [19.5, '2026-10-30', -0.3, -1.5]);
  assert.equal(by('waistCm').refDate, '2026-10-08'); assert.equal(by('waistCm').assess, 'good');
  assert.ok(by('ffmKg') && by('bmi')); assert.ok(!prev.some(x => x.key === 'muscleKg'), 'không so trường bản ghi không có');
  // 30 ngày: mục tiêu 10/10 → bản 08/10 (lệch 2 ngày, trong ±3)
  const d30 = B.compare(list, e, { kind: 'days', days: 30 }).find(x => x.key === 'weightKg');
  assert.deepEqual([d30.target, d30.refDate, d30.offsetDays, d30.near], ['2026-10-10', '2026-10-08', -2, true]);
  // 90 ngày: mục tiêu 11/08 → không có trong ±3 → lấy bản gần nhất (01/08), ghi lệch 10 ngày
  const d90 = B.compare(list, e, { kind: 'days', days: 90 }).find(x => x.key === 'weightKg');
  assert.deepEqual([d90.refDate, d90.offsetDays, d90.near], ['2026-08-01', -10, false]);
  const first = B.compare(list, e, { kind: 'first' }).find(x => x.key === 'weightKg'); assert.equal(first.refDate, '2026-08-01'); assert.equal(first.delta, -3.4);
  const pick = B.compare(list, e, { kind: 'date', date: '2026-10-31' }).find(x => x.key === 'bodyFatPct'); assert.equal(pick.refDate, '2026-10-30');
  assert.deepEqual(B.compare(list, list[0], { kind: 'prev' }), [], 'bản đầu tiên không có gì để so');
  // bản nháp chưa lưu (chưa có id) cũng so được
  assert.equal(B.compare(list, { date: '2026-11-10', time: '', weightKg: 69.9 }, { kind: 'prev' })[0].from, 70.6);
});

test('màu theo ý nghĩa: % mỡ giảm tốt, cơ tăng tốt, cân nặng trung tính trừ khi có mục tiêu', () => {
  assert.equal(B.assess('bodyFatPct', 20, 19), 'good'); assert.equal(B.assess('bodyFatPct', 19, 20), 'bad');
  assert.equal(B.assess('muscleKg', 30, 31), 'good'); assert.equal(B.assess('hipCm', 95, 96), 'neutral');
  assert.equal(B.assess('weightKg', 72, 71), 'neutral');
  assert.equal(B.assess('weightKg', 72, 71, { weightGoalKg: '68' }), 'good'); assert.equal(B.assess('weightKg', 60, 59, { weightGoalKg: 65 }), 'bad');
  assert.equal(B.assess('weightKg', 72, 72, { weightGoalKg: 68 }), 'neutral');
});

test('xu hướng: trung bình trượt 7 ngày (nhiều lần/ngày gộp theo ngày) và độ dốc kg/tuần', () => {
  const list = B.normalizeList([['2026-10-01', 70], ['2026-10-01', 71], ['2026-10-04', 70], ['2026-10-08', 69.5], ['2026-10-15', 69], ['2026-10-22', 68.5]].map(([date, w], i) => ({ date, time: `0${i}:00`, weightKg: w })));
  const t = B.trend(list, 'weightKg');
  assert.deepEqual(t.points.map(p => [p.date, p.value]), [['2026-10-01', 70.5], ['2026-10-04', 70], ['2026-10-08', 69.5], ['2026-10-15', 69], ['2026-10-22', 68.5]]);
  assert.equal(t.points[1].ma7, 70.25); assert.equal(t.points[2].ma7, 69.75); // 08/10: cửa sổ 02–08/10 → 70 và 69,5
  assert.ok(Math.abs(t.slopePerWeek - (-0.64)) < 0.01, String(t.slopePerWeek)); // hồi quy tuyến tính trên 5 ngày có số đo
  assert.equal(B.trend([], 'weightKg').slopePerWeek, null);
});

test('CSV cân thông minh (tiếng Anh, dấu phẩy, số chấm, ngày giờ) và CSV tay (tiếng Việt, chấm phẩy, số phẩy, dd/mm/yyyy)', () => {
  const en = B.parseCsv(fs.readFileSync(path.join(FX, 'body-scale-en.csv'), 'utf8'));
  assert.equal(en.delimiter, ','); assert.equal(en.records.length, 5); assert.deepEqual(en.errors.map(e => e.row), [7]);
  assert.deepEqual(en.records[0], { ...en.records[0], date: '2026-10-01', time: '06:45', weightKg: 70.4, bodyFatPct: 19.8, muscleKg: 31.2, waterPct: 55.1, visceralFat: 8, boneKg: 3, bmrKcal: 1612 });
  assert.equal(en.records[4].note, 'cân lỗi'); assert.ok(!('weightKg' in en.records[4]));
  const vi = B.parseCsv(fs.readFileSync(path.join(FX, 'body-manual-vi.csv'), 'utf8'));
  assert.equal(vi.delimiter, ';'); assert.deepEqual(vi.errors, []);
  assert.deepEqual(vi.records.map(r => [r.date, r.time, r.weightKg, r.bodyFatPct ?? null, r.waistCm ?? null]), [['2026-11-05', '06:30', 69.3, 18.7, 82.5], ['2026-11-05', '21:10', 70.1, null, null], ['2026-11-12', '', 69, 18.4, 81]]);
  assert.equal(vi.records[0].note, 'sáng; trước khi chạy'); assert.equal(vi.records[0].hipCm, 96);
  assert.match(B.parseCsv('foo,bar\n1,2').errors[0].message, /cột ngày/);
  assert.match(B.parseCsv('Ngày,Ghi chú\n01/11/2026,x').errors[0].message, /số đo/);
  assert.equal(B.headerKey('Cân nặng (kg)'), 'weightKg'); assert.equal(B.headerKey('BODY FAT %'), 'bodyFatPct'); assert.equal(B.headerKey('Vòng mông'), 'hipCm'); assert.equal(B.headerKey('xyz'), '');
});

test('vòng xuất → nhập: CSV và bảng Excel ra đúng như cũ; gộp không nhân đôi (khoá ngày + giờ)', () => {
  const list = B.normalizeList([...B.parseCsv(fs.readFileSync(path.join(FX, 'body-scale-en.csv'), 'utf8')).records, ...B.parseCsv(fs.readFileSync(path.join(FX, 'body-manual-vi.csv'), 'utf8')).records]);
  const strip = l => l.map(({ id, source, ...r }) => r);
  assert.deepEqual(strip(B.parseCsv(B.toCsv(list)).records), strip(list));
  assert.deepEqual(strip(B.fromAoa(B.toAoa(list)).records), strip(list));
  const m1 = B.merge([], list); assert.equal(m1.added, 8);
  const m2 = B.merge(m1.list, list); assert.deepEqual([m2.added, m2.duplicates, m2.merged, m2.conflicts], [0, 8, 0, 0]); assert.equal(m2.list.length, 8);
  // cùng ngày giờ: điền trường còn thiếu, không ghi đè giá trị đang có
  const m3 = B.merge(m2.list, [{ date: '2026-11-05', time: '21:10', weightKg: 99, waistCm: 83 }]);
  assert.deepEqual([m3.added, m3.merged, m3.conflicts], [0, 1, 1]);
  const r = m3.list.find(x => x.date === '2026-11-05' && x.time === '21:10'); assert.equal(r.weightKg, 70.1); assert.equal(r.waistCm, 83);
});

test('legacy: bodyMetrics được chuẩn hoá + features.body; file chỉ chạy bộ không đổi; bản v2.2.0 giữ nguyên bodyMetrics', () => {
  const raw = { weeks: [], bodyMetrics: [{ id: 'b1', date: '2026-11-09', time: '06:30', weightKg: '68,4', future: 1 }, { date: 'sai', weightKg: 1 }] };
  const db = L.normalizeDb(raw).db;
  assert.deepEqual(db.bodyMetrics.map(r => [r.id, r.weightKg, r.future]), [['b1', 68.4, 1]]); assert.deepEqual(db.features, { body: 1 });
  assert.ok(!('features' in L.normalizeDb({ weeks: [] }).db)); assert.ok(!('bodyMetrics' in L.normalizeDb({ weeks: [] }).db));
  assert.ok(!('features' in L.normalizeDb({ weeks: [], bodyMetrics: [] }).db));
  const ctx = vm.createContext({});
  for (const f of ['utils.js', 'legacy.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, 'compat', 'v2.2.0', f), 'utf8'), ctx);
  const backup = L.toBackup(db, '2.4.0-dev');
  const old = JSON.parse(JSON.stringify(ctx.T17Legacy.toBackup(ctx.T17Legacy.normalizeDb(JSON.parse(JSON.stringify(backup))).db, '2.2.0')));
  assert.deepEqual(old.bodyMetrics, db.bodyMetrics); assert.deepEqual(old.features, { body: 1 });
  assert.deepEqual(L.normalizeDb(old).db.bodyMetrics, db.bodyMetrics, 'đi qua bản cũ rồi về bản mới vẫn nguyên');
});
