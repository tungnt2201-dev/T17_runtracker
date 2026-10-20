'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/core/utils.js');
const W = require('../src/core/fit-workout.js');
const FIT = require('../src/lib/fit-decoder.js');

/** Bộ đọc FIT tổng quát tối giản (chỉ để test): trả về [{global, fields:{num:value}}]. */
function parseFit(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  assert.equal(String.fromCharCode(...b.slice(8, 12)), '.FIT');
  const size = dv.getUint32(4, true); const end = b[0] + size;
  assert.equal(dv.getUint16(end, true), FIT.crc16(b, 0, end), 'CRC file');
  assert.equal(dv.getUint16(12, true), FIT.crc16(b, 0, 12), 'CRC header');
  const defs = {}; const msgs = []; let o = b[0];
  while (o < end) {
    const h = b[o++]; const local = h & 15;
    if (h & 0x40) { const global = dv.getUint16(o + 2, true); const n = b[o + 4]; o += 5; const f = []; for (let i = 0; i < n; i++) { f.push([b[o], b[o + 1], b[o + 2]]); o += 3; } defs[local] = { global, f }; continue; }
    const d = defs[local]; const fields = {};
    for (const [num, sz, type] of d.f) {
      let v; if (type === 0x07) { const s = b.slice(o, o + sz); v = new TextDecoder().decode(s.slice(0, s.indexOf(0) < 0 ? sz : s.indexOf(0))); }
      else if (sz === 1) v = b[o]; else if (sz === 2) v = dv.getUint16(o, true); else v = dv.getUint32(o, true);
      fields[num] = v; o += sz;
    }
    msgs.push({ global: d.global, fields });
  }
  return msgs;
}

const STRUCT = {
  warmup: { label: 'Khởi động', activity: 'run', mode: 'time', value: 15, paceFrom: '7:00', paceTo: '7:30' },
  groups: [{ label: '6x800m', repeats: 6, steps: [
    { label: 'Nhanh 800m', activity: 'run', mode: 'distance', value: 0.8, paceFrom: '5:20', paceTo: '5:45' },
    { label: 'Đi bộ', activity: 'walk', mode: 'time', value: 2, paceFrom: '', paceTo: '', hrFrom: 100, hrTo: 125 },
  ] }],
  cooldown: { label: 'Thả lỏng', activity: 'run', mode: 'time', value: 10 },
};

test('Workout FIT: file_id / workout / workout_step đúng chuẩn, có vòng lặp', () => {
  const file = W.encodeWorkout({ name: 'Interval 6x800m', structure: STRUCT, created: new Date('2026-10-20T00:00:00Z') });
  const msgs = parseFit(file);
  const fid = msgs.find(m => m.global === 0).fields;
  assert.equal(fid[0], 5, 'file type = workout');
  const wk = msgs.find(m => m.global === 26).fields;
  assert.equal(wk[4], 1, 'sport running'); assert.equal(wk[8], 'Interval 6x800m');
  const steps = msgs.filter(m => m.global === 27).map(m => m.fields);
  assert.equal(wk[6], steps.length); assert.equal(steps.length, 5);
  // 0 warm-up 15'
  assert.equal(steps[0][1], 0); assert.equal(steps[0][2], 15 * 60 * 1000); assert.equal(steps[0][7], 2); assert.equal(steps[0][0], 'Khởi động');
  assert.equal(steps[0][3], 0); assert.equal(steps[0][5], Math.round(1000 / 450 * 1000)); assert.equal(steps[0][6], Math.round(1000 / 420 * 1000));
  // 1 800 m theo cự ly (cm), pace target
  assert.equal(steps[1][1], 1); assert.equal(steps[1][2], 80000); assert.equal(steps[1][7], 0);
  // 2 đi bộ 2' theo HR (bpm + 100), intensity recovery
  assert.equal(steps[2][3], 1); assert.equal(steps[2][5], 200); assert.equal(steps[2][6], 225); assert.equal(steps[2][7], 4);
  // 3 lặp lại từ bước 1, 6 lần
  assert.equal(steps[3][1], 6); assert.equal(steps[3][2], 1); assert.equal(steps[3][4], 6);
  // 4 cool-down, không target
  assert.equal(steps[4][7], 3); assert.equal(steps[4][3], 2);
  assert.deepEqual(steps.map(s => s[254]), [0, 1, 2, 3, 4]);
});

test('tên dài/tiếng Việt được cắt an toàn theo byte UTF-8', () => {
  const file = W.encodeWorkout({ name: 'Bài chạy dài cuối tuần ở Hồ Tây có đổi nhịp liên tục', structure: STRUCT });
  const wk = parseFit(file).find(m => m.global === 26).fields;
  assert.ok(new TextEncoder().encode(wk[8]).length <= 31);
  assert.ok(!wk[8].includes('�'));
  assert.equal(W.safeFileName('Interval 6x800m – Hồ Tây'), 'Interval_6x800m_Ho_Tay');
});

test('báo lỗi khi bài rỗng', () => {
  assert.throws(() => W.encodeWorkout({ name: 'x', structure: { groups: [] } }), /chưa có đoạn/);
});
