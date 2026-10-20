'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/core/utils.js');

test('parseDurationInput: mọi cách gõ thời gian', () => {
  assert.equal(C.parseDurationInput('66:30').minutes, 66.5);
  assert.equal(C.parseDurationInput('1:06:30').minutes, 66.5);
  assert.equal(C.parseDurationInput("66'30\"").minutes, 66.5);
  assert.equal(C.parseDurationInput("1h06'30\"").minutes, 66.5);
  assert.equal(C.parseDurationInput('45').minutes, 45);
  assert.equal(C.parseDurationInput('45,5').minutes, 45.5);
  assert.equal(C.parseDurationInput('').minutes, '');
  assert.equal(C.parseDurationInput('1:75:00').ok, false);
  assert.equal(C.parseDurationInput('abc').ok, false);
});

test('pace / paceToSec / secToPace / formatDurationClock', () => {
  assert.equal(C.pace(10, 50), '5:00/km');
  assert.equal(C.pace(0, 50), '');
  assert.equal(C.paceToSec('5:30'), 330);
  assert.equal(C.paceToSec('5,5'), 330);
  assert.equal(C.secToPace(330), '5:30');
  assert.equal(C.formatDurationClock(66.5), '1:06:30');
  assert.equal(C.formatDurationClock(0.08 * 6), '0:29');
});

test('ngày: thứ Hai đầu tuần, cộng ngày, Excel serial', () => {
  assert.equal(C.mondayYmd('2026-10-20'), '2026-10-19');
  assert.equal(C.mondayYmd('2026-10-25'), '2026-10-19');
  assert.equal(C.addDaysYmd('2026-12-31', 1), '2027-01-01');
  assert.equal(C.excelYmd(46315), '2026-10-20');
  assert.equal(C.excelYmd('20/10/2026'), '2026-10-20');
});

test('totalsOf: cự ly 0,08 km không bị làm tròn', () => {
  const st = { warmup: null, groups: [{ repeats: 10, steps: [{ activity: 'run', mode: 'distance', value: 0.08, paceFrom: '4:00', paceTo: '4:00' }] }], cooldown: null };
  const t = C.totalsOf(st);
  assert.ok(Math.abs(t.km - 0.8) < 1e-9);
  assert.ok(Math.abs(t.minutes - 3.2) < 1e-9);
});

test('segmentHeight: sửa lỗi chia đôi HR khi chỉ có HR min (bug v1.8.9)', () => {
  const onlyMin = C.segmentHeight({ activity: 'run', intensity: 'easy', hrFrom: 160, hrTo: '' });
  const both = C.segmentHeight({ activity: 'run', intensity: 'easy', hrFrom: 160, hrTo: 160 });
  assert.equal(onlyMin, both);
  assert.ok(onlyMin > 60);
});
