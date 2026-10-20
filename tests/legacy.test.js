'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const L = require('../src/core/legacy.js');

const fx = name => fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8');
const allWorkouts = db => db.weeks.flatMap(w => w.days.flatMap(d => d.workouts.map(it => ({ date: d.date, ...it }))));

test('nhận diện đúng mọi loại file JSON', () => {
  assert.equal(L.detectKind(L.parseJsonText(fx('runplan-v1-legacy-day-fields.json'))), 'backup');
  assert.equal(L.detectKind(L.parseJsonText(fx('runplan-v189-backup.json'))), 'backup');
  assert.equal(L.detectKind(L.parseJsonText(fx('runplan-plan-export.json'))), 'plan');
  assert.equal(L.detectKind(L.parseJsonText(fx('runplan-log-export.json'))), 'log');
  assert.equal(L.detectKind([{ label: '1', days: [] }]), 'weeks');
  assert.equal(L.detectKind({ app: 'x', data: { weeks: [] } }), 'backup-wrapped');
  assert.equal(L.detectKind({ foo: 1 }), 'unknown');
});

test('đọc được chuỗi localStorage bị stringify 2 lần + BOM', () => {
  const data = L.parseJsonText(fx('localstorage-dump-double-encoded.json'));
  assert.equal(L.detectKind(data), 'backup');
  const { db } = L.normalizeDb(data);
  assert.equal(allWorkouts(db)[0].workoutName, 'Easy');
});

test('RunPlan đời đầu: field nằm trên day → chuyển thành workouts[], ngày dd/mm/yyyy, số có dấu phẩy, thời gian mm:ss', () => {
  const { db, report } = L.normalizeDb(L.parseJsonText(fx('runplan-v1-legacy-day-fields.json')));
  const all = allWorkouts(db);
  const easy = all.find(w => w.workoutName === 'Easy 5km');
  assert.equal(easy.date, '2025-01-15');
  assert.equal(easy.planKm, 5);
  assert.equal(easy.actual.km, 5.2);
  assert.equal(easy.actual.minutes, 36.5);
  assert.equal(easy.actual.status, 'done');
  assert.ok(easy.id);
  // mô tả bị lặp "Warm-up: Warm-up:" được làm sạch
  assert.match(all.find(w => w.workoutName === 'Interval').description, /^Warm-up: 10 phút/m);
  // actual không có status → coi là hoàn thành; status missed giữ nguyên
  assert.equal(all.find(w => w.workoutName === 'Interval').actual.status, 'done');
  assert.equal(all.find(w => w.workoutName === 'Long run').actual.status, 'missed');
  // ngày trống không sinh bài rác
  assert.equal(all.filter(w => w.date === '2025-01-16').length, 0);
  assert.equal(report.legacyDaysConverted, 6); // kể cả ngày đặt tên "Nghỉ" (giống v1.8.9)
  // bài thiếu ngày không bị mất
  assert.equal(db.orphans.length, 1);
  assert.equal(db.orphans[0].workouts[0].workoutName, 'Bài không có ngày');
  // template cũ không có id → được cấp id, số được chuẩn hoá
  assert.ok(db.templates[0].id);
  assert.equal(db.templates[0].planKm, 6.5);
  assert.equal(db.templatesSeeded, false);
});

test('tuần Excel bắt đầu giữa tuần → căn lại về thứ Hai, đủ 7 ngày, giữ nhãn tuần', () => {
  const { db, report } = L.normalizeDb(L.parseJsonText(fx('runplan-v1-legacy-day-fields.json')));
  assert.ok(report.weeksRealigned >= 1);
  for (const w of db.weeks) {
    assert.equal(w.days.length, 7);
    assert.equal(new Date(w.days[0].date + 'T00:00:00').getDay(), 1, 'ngày đầu tuần phải là thứ Hai');
    assert.deepEqual(w.days.map(d => d.dow), ['Hai', 'Ba', 'Tư', 'Năm', 'Sáu', 'Bảy', 'CN']);
  }
  // 15/01/2025 là thứ Tư → tuần bắt đầu 13/01; nhãn "1" được giữ (đa số ngày thuộc tuần 1)
  assert.equal(db.weeks[0].days[0].date, '2025-01-13');
  assert.equal(db.weeks[0].label, '1');
  // tuần sau 2025-01-20 (thứ Hai) chứa cả Long run (từ tuần 1) lẫn Recovery (từ tuần 2)
  const w2 = db.weeks.find(w => w.days[0].date === '2025-01-20');
  assert.ok(w2.days.some(d => d.workouts.some(x => x.workoutName === 'Recovery')));
  assert.ok(w2.days.some(d => d.workouts.some(x => x.workoutName === 'Long run')));
});

test('RunPlan v1.8.9: giữ nguyên FIT, segments, thẻ tím, field lạ; gộp ngày trùng, sửa id trùng', () => {
  const src = L.parseJsonText(fx('runplan-v189-backup.json'));
  const { db, report } = L.normalizeDb(src);
  const all = allWorkouts(db);
  assert.equal(all.length, 4);
  const ids = all.map(w => w.id);
  assert.equal(new Set(ids).size, ids.length, 'id phải duy nhất');
  assert.equal(report.idsFixed, 1);
  const fit = all.find(w => w.fitStandalone);
  assert.equal(fit.actual.fitImport.id, 'abc-123');
  assert.equal(fit.actual.fitImport.insights.stats.movingSec, 3495);
  const tempo = all.find(w => w.workoutName === 'Tempo 20 phút');
  assert.equal(tempo.actual.segments[0].actualPace, '7:08');
  assert.equal(tempo.workoutStructure.groups[0].steps[0].paceFrom, '5:45');
  // bài nằm ở "tuần 43" nhưng cùng ngày 2026-10-12 được gộp vào đúng ngày
  assert.equal(db.weeks.length, 1, 'tuần 43 trùng ngày được gộp, không sinh tuần thừa');
  assert.equal(all.filter(w => w.date === '2026-10-12').length, 3);
  assert.deepEqual(db.futureField, { keep: 'me' });
  assert.equal(db.schemaVersion, L.SCHEMA_VERSION);
  assert.equal(db.app, 'T17_runtracker');
});

test('chuẩn hoá là idempotent (chạy 2 lần cho cùng kết quả)', () => {
  const once = L.normalizeDb(L.parseJsonText(fx('runplan-v189-backup.json'))).db;
  const twice = L.normalizeDb(JSON.parse(JSON.stringify(once))).db;
  assert.deepEqual(twice, once);
});

test('file sao lưu v2 vẫn có weeks[] ở cấp cao nhất → RunPlan v1.8.x cũ khôi phục được', () => {
  const { db } = L.normalizeDb(L.parseJsonText(fx('runplan-v189-backup.json')));
  const b = L.toBackup(db, '2.0.0');
  assert.ok(Array.isArray(b.weeks));
  assert.ok(b.weeks.every(w => w.days.every(d => Array.isArray(d.workouts))));
  assert.equal(b.schemaVersion, 2);
  assert.ok(b.exportedAt);
});

test('gộp file "Xuất bài tập" (plan): bỏ bài rỗng, bỏ bài thiếu ngày, không trùng khi nhập 2 lần', () => {
  const { db } = L.normalizeDb({ weeks: [] });
  const plan = L.parseJsonText(fx('runplan-plan-export.json'));
  const r1 = L.mergeDays(db, L.exportToDays(plan));
  assert.equal(r1.added, 2);
  assert.equal(r1.invalid, 2);
  const r2 = L.mergeDays(db, L.exportToDays(plan));
  assert.equal(r2.added, 0);
  assert.equal(r2.duplicates, 2);
  assert.ok(allWorkouts(db).every(w => w.actual === null));
});

test('gộp Training Log (log): giữ kết quả, gắn kết quả vào bài kế hoạch trùng chưa có kết quả', () => {
  const { db } = L.normalizeDb(L.parseJsonText(fx('runplan-v189-backup.json')));
  // tạo bài kế hoạch ngày 19/10 chưa có kết quả, trùng với dòng log
  L.mergeDays(db, [{ date: '2026-10-19', workouts: [{ workoutName: 'Easy 40 phút', workoutType: 'Easy', planKm: 6.15, planMinutes: 40, description: 'Easy' }] }]);
  const res = L.mergeDays(db, L.exportToDays(L.parseJsonText(fx('runplan-log-export.json'))), { withActual: true });
  assert.equal(res.actualsAttached, 1);   // 19/10 được gắn kết quả
  assert.equal(res.duplicates, 1);        // Tempo 12/10 đã có kết quả
  assert.equal(res.added, 1);             // Recovery 20/10
  const easy = allWorkouts(db).find(w => w.date === '2026-10-19');
  assert.equal(easy.actual.km, 6.3);
});
