/* T17 RunTracker — mã hoá bài tập có cấu trúc thành file Workout FIT cho đồng hồ Garmin.
 *
 * Cách dùng trên đồng hồ: cắm USB, copy file .fit vào thư mục  GARMIN\NewFiles\  rồi rút cáp;
 * bài xuất hiện trong Training → Workouts. (Hoặc import trong Garmin Connect bản web.)
 *
 * Messages (theo FIT Profile): file_id(0) · workout(26) · workout_step(27)
 *   duration_type: 0 time(ms) · 1 distance(cm) · 5 open · 6 repeat_until_steps_cmplt
 *   target_type  : 0 speed (m/s ×1000, low=chậm, high=nhanh) · 1 heart_rate (bpm + 100) · 2 open
 *   intensity    : 0 active · 1 rest · 2 warmup · 3 cooldown · 4 recovery
 */
(function (root) {
'use strict';
const C = root.T17Core || (typeof require === 'function' ? require('./utils.js') : null);
const { paceToSec } = C;

const FIT_EPOCH = Date.UTC(1989, 11, 31) / 1000;
const BT = { enum: 0x00, uint8: 0x02, uint16: 0x84, uint32: 0x86, string: 0x07, uint32z: 0x8c };
const BT_SIZE = { 0x00: 1, 0x02: 1, 0x84: 2, 0x86: 4, 0x8c: 4 };
const MAX_STEPS = 100;

function crc16(bytes) {
  const t = [0, 0xcc01, 0xd801, 0x1400, 0xf001, 0x3c00, 0x2800, 0xe401, 0xa001, 0x6c00, 0x7800, 0xb401, 0x5000, 0x9c01, 0x8801, 0x4400];
  let crc = 0;
  for (const b of bytes) { let x = t[crc & 15]; crc = ((crc >> 4) & 0x0fff) ^ x ^ t[b & 15]; x = t[crc & 15]; crc = ((crc >> 4) & 0x0fff) ^ x ^ t[(b >> 4) & 15]; }
  return crc & 0xffff;
}
function utf8(s) { return new TextEncoder().encode(String(s ?? '')); }
/** Cắt chuỗi UTF-8 vừa `max` byte (kể cả byte 0 kết thúc), không cắt giữa ký tự. */
function fitString(s, max) { let b = utf8(s); if (b.length > max - 1) { let cut = max - 1; while (cut > 0 && (b[cut] & 0xc0) === 0x80) cut--; b = b.slice(0, cut); } const out = new Uint8Array(max); out.set(b); return out; }

/** Chuyển cấu trúc builder → danh sách bước FIT (đã xử lý lặp). */
function structureToSteps(structure, opts = {}) {
  const steps = [];
  const stepOf = (s, role) => {
    const value = Number(s.value) || 0;
    const st = { name: s.label || '', intensity: role === 'warm' ? 2 : role === 'cool' ? 3 : s.activity === 'rest' ? 1 : s.activity === 'walk' ? 4 : 0, durationType: 5, durationValue: 0, targetType: 2, targetValue: 0, low: 0, high: 0 };
    if (s.mode === 'distance' && value > 0) { st.durationType = 1; st.durationValue = Math.round(value * 1000 * 100); }
    else if (value > 0) { st.durationType = 0; st.durationValue = Math.round(value * 60 * 1000); }
    const fast = paceToSec(s.paceFrom), slow = paceToSec(s.paceTo);
    const hrLo = Number(s.hrFrom) || 0, hrHi = Number(s.hrTo) || 0;
    const usePace = (fast || slow) && opts.prefer !== 'hr';
    if (usePace) {
      const f = fast || slow, sl = slow || fast;
      st.targetType = 0; st.low = Math.round(1000 / Math.max(f, sl) * 1000); st.high = Math.round(1000 / Math.min(f, sl) * 1000);
    } else if (hrLo || hrHi) {
      st.targetType = 1; st.low = (hrLo || hrHi) + 100; st.high = (hrHi || hrLo) + 100;
    }
    return st;
  };
  if (structure?.warmup) steps.push(stepOf(structure.warmup, 'warm'));
  for (const g of structure?.groups || []) {
    const inner = (g.steps || []).filter(s => Number(s.value) > 0);
    if (!inner.length) continue;
    const reps = Math.max(1, Math.min(99, Number(g.repeats) || 1));
    const first = steps.length;
    for (const s of inner) steps.push(stepOf(s, 'main'));
    if (reps > 1) steps.push({ name: g.label || '', intensity: 0, durationType: 6, durationValue: first, targetType: 2, targetValue: reps, low: 0, high: 0, repeat: true });
  }
  if (structure?.cooldown) steps.push(stepOf(structure.cooldown, 'cool'));
  if (!steps.length) throw new Error('Bài tập chưa có đoạn nào có thời gian hoặc quãng đường.');
  if (steps.length > MAX_STEPS) throw new Error(`Bài có ${steps.length} bước, vượt giới hạn ${MAX_STEPS} bước của file FIT workout.`);
  return steps;
}

/** Trả về Uint8Array file .fit hoàn chỉnh. */
function encodeWorkout({ name, structure, created = new Date(), prefer = 'pace' }) {
  const steps = structureToSteps(structure, { prefer });
  const body = [];
  const push = (type, v) => { const n = BT_SIZE[type]; for (let i = 0; i < n; i++) body.push((v >>> (8 * i)) & 255); };
  const defs = {};
  const define = (local, global, fields) => { defs[local] = fields; body.push(0x40 | local, 0, 0, global & 255, (global >> 8) & 255, fields.length); for (const [num, type, size] of fields) body.push(num, size ?? BT_SIZE[type], type); };
  const write = (local, values) => { body.push(local); defs[local].forEach(([, type, size], i) => { if (type === BT.string) body.push(...fitString(values[i], size)); else push(type, values[i] >>> 0); }); };

  const ts = Math.max(0, Math.floor(created.getTime() / 1000 - FIT_EPOCH));
  // file_id: type=5 (workout), manufacturer=255 (development), product=0, serial, time_created
  define(0, 0, [[0, BT.enum], [1, BT.uint16], [2, BT.uint16], [3, BT.uint32z], [4, BT.uint32]]);
  write(0, [5, 255, 0, (ts ^ 0x5a17) >>> 0 || 1, ts]);
  // workout: sport=1 running, sub_sport=0, num_valid_steps, wkt_name
  define(1, 26, [[4, BT.enum], [11, BT.enum], [6, BT.uint16], [8, BT.string, 32]]);
  write(1, [1, 0, steps.length, name || 'T17 Workout']);
  // workout_step
  define(2, 27, [[254, BT.uint16], [0, BT.string, 24], [1, BT.enum], [2, BT.uint32], [3, BT.enum], [4, BT.uint32], [5, BT.uint32], [6, BT.uint32], [7, BT.enum]]);
  steps.forEach((s, i) => write(2, [i, s.name, s.durationType, s.durationValue, s.targetType, s.targetValue, s.low, s.high, s.intensity]));

  const header = new Uint8Array(14); const hv = new DataView(header.buffer);
  header[0] = 14; header[1] = 0x20; hv.setUint16(2, 2195, true); hv.setUint32(4, body.length, true); header.set([46, 70, 73, 84], 8);
  hv.setUint16(12, crc16(header.subarray(0, 12)), true);
  const out = new Uint8Array(14 + body.length + 2); out.set(header); out.set(body, 14);
  const crc = crc16(out.subarray(0, 14 + body.length)); out[out.length - 2] = crc & 255; out[out.length - 1] = crc >> 8;
  return out;
}

function safeFileName(s) { return String(s || 'T17_workout').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'T17_workout'; }

const api = { encodeWorkout, structureToSteps, crc16, safeFileName, MAX_STEPS };
root.T17FitWorkout = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
