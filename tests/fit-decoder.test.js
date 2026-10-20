'use strict';
/* Tạo file FIT tổng hợp (không cần file thật) rồi giải mã bằng bộ đọc của app. */
const test = require('node:test');
const assert = require('node:assert/strict');
const FIT = require('../src/lib/fit-decoder.js');

const T = { enum: 0x00, u8: 0x02, u16: 0x84, u32: 0x86 };
const SIZE = { 0x00: 1, 0x02: 1, 0x84: 2, 0x86: 4 };

function buildFit({ pauseFrom = 300, pauseTo = 360, totalSec = 660, speed = 10 / 3 } = {}) {
  const bytes = [];
  const push = (type, v) => { const n = SIZE[type]; for (let i = 0; i < n; i++) bytes.push((v >>> (8 * i)) & 255); };
  const defs = {};
  const define = (local, global, fields) => { defs[local] = fields; bytes.push(0x40 | local, 0, 0, global & 255, global >> 8, fields.length); for (const [num, type] of fields) bytes.push(num, SIZE[type], type); };
  const msg = (local, values) => { bytes.push(local); defs[local].forEach(([, type], i) => push(type, values[i])); };
  const t0 = 1100000000; // giây kể từ 1989-12-31
  define(0, 0, [[0, T.enum], [4, T.u32]]); msg(0, [4, t0]);
  define(1, 21, [[253, T.u32], [0, T.enum], [1, T.enum]]);
  define(2, 20, [[253, T.u32], [5, T.u32], [3, T.u8], [6, T.u16]]);
  msg(1, [t0, 0, 0]);
  let dist = 0;
  for (let s = 0; s <= totalSec; s++) {
    if (s > pauseFrom && s < pauseTo) continue;
    if (s === pauseFrom) { msg(2, [t0 + s, Math.round(dist * 100), 150, Math.round(speed * 1000)]); msg(1, [t0 + s, 0, 4]); continue; }
    if (s === pauseTo) msg(1, [t0 + s, 0, 0]);
    if (s > 0 && s !== pauseTo) dist += speed;
    msg(2, [t0 + s, Math.round(dist * 100), 140 + (s % 20), Math.round(speed * 1000)]);
  }
  msg(1, [t0 + totalSec, 0, 4]);
  const timer = totalSec - (pauseTo - pauseFrom);
  define(3, 19, [[253, T.u32], [2, T.u32], [7, T.u32], [8, T.u32], [9, T.u32], [15, T.u8]]);
  msg(3, [t0 + totalSec, t0, totalSec * 1000, timer * 1000, Math.round(dist * 100), 148]);
  define(4, 18, [[253, T.u32], [2, T.u32], [5, T.enum], [7, T.u32], [8, T.u32], [9, T.u32], [11, T.u16], [16, T.u8], [17, T.u8]]);
  msg(4, [t0 + totalSec, t0, 1, totalSec * 1000, timer * 1000, Math.round(dist * 100), 120, 148, 159]);
  define(5, 34, [[253, T.u32], [5, T.u32]]); msg(5, [t0 + totalSec, t0 + totalSec + 7 * 3600]);
  const data = Uint8Array.from(bytes);
  const header = new Uint8Array(14); const hv = new DataView(header.buffer);
  header[0] = 14; header[1] = 0x20; hv.setUint16(2, 2195, true); hv.setUint32(4, data.length, true); header.set([46, 70, 73, 84], 8);
  const body = new Uint8Array(14 + data.length + 2); body.set(header); body.set(data, 14);
  new DataView(body.buffer).setUint16(14 + data.length, FIT.crc16(body, 0, 14 + data.length), true);
  return { file: body, dist, timer };
}

test('giải mã FIT: thời gian, quãng đường, nhịp tim, CRC, múi giờ', () => {
  const { file, dist } = buildFit();
  const f = FIT.decode(file);
  assert.equal(f.fileCRCValid, true);
  assert.equal(f.durationSec, 600);
  assert.equal(f.elapsedSec, 660);
  assert.ok(Math.abs(f.distanceM - dist) < 0.5);
  assert.equal(f.avgHr, 148);
  assert.equal(f.maxHr, 159);
  assert.equal(f.calories, 120);
  assert.equal(f.sport, 1);
  assert.equal(f.zoneOffsetSeconds, 7 * 3600);
  assert.equal(f.laps.length, 1);
});

test('loại khoảng dừng đồng hồ khỏi trục thời gian (timer event)', () => {
  const f = FIT.decode(buildFit().file);
  assert.equal(f.pauseSeconds, 60);
  const last = f.series[f.series.length - 1];
  assert.ok(Math.abs(last.m - 600) < 1, `moving time cuối = ${last.m}`);
  const atResume = f.series.find(p => p.t - f.series[0].t === 360);
  assert.ok(Math.abs(atResume.m - 300) < 1, 'sau khi bấm tiếp, đồng hồ chạy lại từ 300 s');
});

test('từ chối file không phải FIT / bị cắt', () => {
  assert.throws(() => FIT.decode(new Uint8Array(10)), /quá ngắn/);
  const { file } = buildFit();
  assert.throws(() => FIT.decode(file.slice(0, 200)), /thiếu dữ liệu|cắt/);
  const bad = file.slice(); bad[9] = 0; assert.throws(() => FIT.decode(bad), /\.FIT/);
});

test('CRC sai vẫn đọc được nhưng được đánh dấu', () => {
  const { file } = buildFit(); const bad = file.slice(); bad[bad.length - 1] ^= 0xff;
  assert.equal(FIT.decode(bad).fileCRCValid, false);
});
