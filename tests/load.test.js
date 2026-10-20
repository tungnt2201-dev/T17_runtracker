'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/core/utils.js');
const A = require('../src/core/athlete.js');
const L = require('../src/core/load.js');

const PROFILE = { sex: 'male', hrMax: 190, hrRest: 50, lthr: 170, thresholdPace: '5:00' };
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} ≈ ${b} ±${tol}`);

test('hồ sơ: điền ước tính khi thiếu và đánh dấu', () => {
  const p = A.resolveProfile({});
  assert.deepEqual(p.estimated.sort(), ['hrMax', 'hrRest', 'lthr']);
  assert.equal(p.complete, false);
  assert.equal(A.resolveProfile(PROFILE).complete, true);
});

test('vùng HR theo % LTHR và vùng pace theo pace ngưỡng', () => {
  assert.equal(A.hrZoneOf(130, PROFILE), 1);   // 76% LTHR
  assert.equal(A.hrZoneOf(148, PROFILE), 2);   // 87%
  assert.equal(A.hrZoneOf(158, PROFILE), 3);   // 93%
  assert.equal(A.hrZoneOf(166, PROFILE), 4);   // 97.6%
  assert.equal(A.hrZoneOf(175, PROFILE), 5);
  const t = A.hrZoneTable(PROFILE);
  assert.equal(t.length, 5); assert.equal(t[4].to, 190);
  assert.equal(A.paceZoneOf(7 * 60, PROFILE), 1);  // 7:00 chậm hơn 129% của 5:00
  assert.equal(A.paceZoneOf(5 * 60 + 50, PROFILE), 2);
  assert.equal(A.paceZoneOf(5 * 60 + 25, PROFILE), 3);  // 108% thời gian ngưỡng
  assert.equal(A.paceZoneOf(5 * 60, PROFILE), 4);
  assert.equal(A.paceZoneOf(4 * 60 + 40, PROFILE), 5);
  assert.equal(A.paceZoneTable(PROFILE).length, 5);
});

test('60 phút đúng LTHR = 100 điểm (chuỗi HR FIT, nhịp TB, và pace)', () => {
  const stream = []; for (let s = 0; s <= 3600; s += 3) stream.push([s, 170]);
  const fit = { workoutType: 'Threshold', actual: { status: 'done', minutes: 60, km: 12, avgHr: 170, fitImport: { sectionSource: { hr: stream } } } };
  const r1 = L.actualLoad(fit, PROFILE); assert.equal(r1.method, 'hr-stream'); near(r1.load, 100, 0.5);
  const r2 = L.actualLoad({ actual: { status: 'done', minutes: 60, km: 12, avgHr: 170 } }, PROFILE); assert.equal(r2.method, 'hr-avg'); near(r2.load, 100, 0.01);
  const r3 = L.actualLoad({ actual: { status: 'done', minutes: 60, km: 12 } }, PROFILE); assert.equal(r3.method, 'pace'); near(r3.load, 100, 0.01);
});

test('chuỗi HR có khoảng dừng >1 phút không bị tính', () => {
  const stream = []; for (let s = 0; s <= 1800; s += 3) stream.push([s, 170]); for (let s = 3600; s <= 5400; s += 3) stream.push([s, 170]);
  const r = L.actualLoad({ actual: { status: 'done', minutes: 60, fitImport: { sectionSource: { hr: stream } } } }, PROFILE);
  near(r.load, 100, 1);
});

test('phương án dự phòng: RPE → loại bài; bỏ buổi = 0', () => {
  assert.equal(L.actualLoad({ actual: { status: 'done', minutes: 60, fatigue: 9 } }, {}).method, 'rpe');
  const t = L.actualLoad({ workoutType: 'Easy', actual: { status: 'done', minutes: 60 } }, {});
  assert.equal(t.method, 'type'); near(t.load, 49, 0.1);
  assert.equal(L.actualLoad({ actual: { status: 'missed' } }, PROFILE).load, 0);
});

test('tải kế hoạch theo pace mục tiêu từng đoạn', () => {
  const item = { workoutType: 'Tempo', workoutStructure: { warmup: null, cooldown: null, groups: [{ repeats: 1, steps: [{ activity: 'run', mode: 'time', value: 60, paceFrom: '5:00', paceTo: '5:00' }] }] } };
  near(L.plannedLoad(item, PROFILE), 100, 0.01);
  near(L.plannedLoad({ workoutType: 'Easy', planMinutes: 60 }, PROFILE), 49, 0.1);
});

test('CTL/ATL/TSB: hằng số thời gian 42/7 ngày, TSB = CTL − ATL hôm trước, có dự báo tương lai', () => {
  const rows = [];
  for (let i = 0; i < 100; i++) { const d = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10); rows.push({ date: d, done: true, actualLoad: 50, plannedLoad: 0, item: {} }); }
  const s = L.pmcSeries(rows, { today: '2026-12-31' });
  assert.equal(s.length, 100);
  near(s[0].ctl, 50 / 42, 1e-9); near(s[0].atl, 50 / 7, 1e-9); assert.equal(s[0].tsb, 0);
  near(s[99].atl, 50, 0.1); assert.ok(s[99].ctl > 45 && s[99].ctl < 50);
  near(s[1].tsb, s[0].ctl - s[0].atl, 1e-9);
  const fut = L.pmcSeries([{ date: '2026-02-01', done: false, missed: false, standalone: false, plannedLoad: 80, actualLoad: 0, item: {} }], { today: '2026-01-15', seedFrom: '2026-01-20' });
  assert.ok(fut.at(-1).isFuture); assert.equal(fut.at(-1).projected, 80);
});

test('tổng hợp theo tuần: thẻ FIT tím không tính là bài kế hoạch', () => {
  const rows = L.collect({ weeks: [{ days: [
    { date: '2026-10-19', workouts: [{ workoutName: 'Easy', planKm: 8, planMinutes: 50, actual: { status: 'done', km: 8.2, minutes: 51 } }] },
    { date: '2026-10-21', workouts: [{ fitStandalone: true, actual: { status: 'done', km: 5, minutes: 30 } }, { workoutName: 'Tempo', planKm: 10, planMinutes: 55, actual: { status: 'missed' } }] },
  ] }] }, PROFILE);
  const w = L.weeklySummary(rows);
  assert.equal(w.length, 1);
  assert.equal(w[0].planned, 2); assert.equal(w[0].done, 1); assert.equal(w[0].missed, 1);
  near(w[0].actualKm, 13.2, 1e-9); near(w[0].planKm, 18, 1e-9);
});
