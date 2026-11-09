'use strict';
/* Lượt 7 — FUZZ NHẸ cho mọi đường nhập (lõi thuần). Dữ liệu sinh ngẫu nhiên có hạt giống cố định (lặp lại được):
 * file hỏng / cắt cụt, thiếu trường, số dạng chữ, ngày sai, phần tử null, ảnh base64 hỏng, chuỗi rất dài.
 * Yêu cầu: không văng lỗi lạ (chỉ Error có thông báo), kết quả luôn đúng hình dạng, và KHÔNG làm mất dữ liệu tốt đang có. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const C = require('../src/core/utils.js');
const F = require('../src/core/fitness.js');
const B = require('../src/core/body.js');
const E = require('../src/core/energy.js');
const L = require('../src/core/legacy.js');
const FI = require('../src/core/fitness-import.js');
const XP = require('../src/core/excel-plan.js');
const LD = require('../src/core/load.js');
const XLSX = require('../src/lib/xlsx.js');
const FX = path.join(__dirname, 'fixtures');
const rd = f => fs.readFileSync(path.join(FX, f), 'utf8');
const N = Number(process.env.FUZZ_N || 150);

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const NASTY = [null, undefined, '', 'abc', '12,5', '1.2.3', -1, 0, 1e308, -0.0001, '2026-13-45', '31/02/2026', '0000-00-00', 'NaN', 'Infinity', true, [], {}, [null], { x: null },
  'data:image/png;base64,@@@không-phải-base64', 'data:image/jpeg;base64,' + 'A'.repeat(200000), 'x'.repeat(100000), '<img src=x onerror=alert(1)>', '__proto__', { __proto__: { polluted: 1 } }];
/** Đột biến sâu: mỗi nút có xác suất p bị thay bằng giá trị xấu hoặc bị xoá. */
function mutate(x, r, p = 0.08, depth = 0) {
  if (r() < p) return NASTY[Math.floor(r() * NASTY.length)];
  if (depth > 12) return x;
  if (Array.isArray(x)) { const out = x.map(v => mutate(v, r, p, depth + 1)).filter(() => r() > p / 2); if (r() < p / 2) out.push(null); return out; }
  if (x && typeof x === 'object') { const o = {}; for (const [k, v] of Object.entries(x)) { if (r() < p / 2) continue; o[k] = mutate(v, r, p, depth + 1); } return o; }
  return x;
}
/** Chỉ cho phép lỗi có kiểu Error và thông báo (tiếng Việt) — không TypeError/RangeError bất ngờ. */
function safe(fn, where) {
  try { return { ok: true, value: fn() }; } catch (e) {
    assert.ok(e instanceof Error && !(e instanceof TypeError) && !(e instanceof RangeError) && !(e instanceof ReferenceError), `${where}: lỗi lạ ${e && e.constructor && e.constructor.name}: ${e && e.message}\n${e && e.stack}`);
    assert.ok(String(e.message || '').length > 0, `${where}: lỗi không có thông báo`); return { ok: false, error: e };
  }
}
function shapeOk(db, where) {
  assert.ok(db && Array.isArray(db.weeks), `${where}: thiếu weeks`);
  for (const w of db.weeks) { assert.ok(Array.isArray(w.days), `${where}: tuần thiếu days`); for (const d of w.days) { assert.ok(Array.isArray(d.workouts), `${where}: ngày thiếu workouts`); for (const it of d.workouts) assert.ok(it && typeof it === 'object' && it.id, `${where}: bài không hợp lệ`); } }
  assert.equal({}.polluted, undefined, 'prototype bị nhiễm');
}
const JSON_FIX = ['runplan-v189-backup.json', 'runplan-v1-legacy-day-fields.json', 'runplan-plan-export.json', 'runplan-log-export.json', 'localstorage-dump-double-encoded.json', 't17-fitness-backup.json', 't17-v25-full.json', 't17-v22-multiuser/t17-runtracker.json'];

test('JSON sao lưu / kế hoạch / log đời cũ bị đột biến → normalizeDb không sập, luôn ra lịch hợp lệ', () => {
  for (const f of JSON_FIX) {
    const base = L.parseJsonText(rd(f));
    for (let i = 0; i < N; i++) {
      const r = rng(i * 7919 + f.length); const x = mutate(base, r);
      const res = safe(() => L.normalizeDb(x), `${f}#${i}`);
      if (res.ok) { shapeOk(res.value.db, `${f}#${i}`); safe(() => L.toBackup(res.value.db, 'fuzz'), `${f}#${i} toBackup`); safe(() => LD.collect(res.value.db, res.value.db.profile || {}), `${f}#${i} load`); }
      // tính calo của một ngày bất kỳ cũng không được sập
      if (res.ok) safe(() => E.day(res.value.db, '2026-10-12'), `${f}#${i} energy`);
    }
  }
});

test('văn bản JSON hỏng: cắt cụt, BOM, rác, rỗng → Error tiếng Việt, không sập', () => {
  const txt = rd('t17-v25-full.json');
  const bad = ['', ' ', '﻿', 'null', '42', '"chuỗi"', '[]', '{}', '[null]', '{"weeks":null}', '{"weeks":"abc"}', '{"weeks":[null,1,"x",{"days":null}]}', txt.slice(0, 1000), txt.slice(0, txt.length - 3), txt.replace(/"weeks"/, '"week"'), '\u0000\u0001\u0002', '{'.repeat(5000)];
  for (const [i, s] of bad.entries()) {
    const p = safe(() => L.parseJsonText(s), 'parse#' + i);
    if (p.ok) { const n = safe(() => L.normalizeDb(p.value), 'norm#' + i); if (n.ok) shapeOk(n.value.db, 'norm#' + i); }
  }
});

test('file app fitness (JSON v1/v2/v3) bị đột biến → lỗi theo từng file, nhập không làm mất bài đang có', () => {
  const good = L.normalizeDb(L.parseJsonText(rd('t17-v25-full.json'))).db; const before = JSON.stringify(good.weeks.flatMap(w => w.days).flatMap(d => d.workouts).map(w => [w.id, w.workoutName, w.planKm, w.actual?.km ?? null]));
  for (const f of ['fitness-mobile-v1-legacy.json', 'fitness-mobile-v2.json', 'fitness-mobile-v3.json', 'fitness-mobile-midnight.json', 'fitness-mobile-unknown-exercises.json']) {
    const base = JSON.parse(rd(f));
    for (let i = 0; i < N; i++) {
      const x = mutate(base, rng(i * 31 + f.length * 101), 0.1);
      const parsed = FI.parseSources([{ name: f, data: x }]);
      assert.equal(parsed.sessions.length + parsed.errors.length, 1, `${f}#${i}: phải ra 1 buổi hoặc 1 lỗi`);
      for (const e of parsed.errors) assert.ok(e.message && !/undefined|null|cannot read/i.test(e.message), `${f}#${i}: thông báo lỗi khó hiểu: ${e.message}`);
      if (!parsed.sessions.length) continue;
      const db = C.deepClone(good);
      const plan = safe(() => FI.planImport(db, parsed), `${f}#${i} plan`); if (!plan.ok) continue;
      const out = safe(() => FI.applyImport(db, parsed, plan.value, FI.defaultChoices(plan.value)), `${f}#${i} apply`); if (!out.ok) continue;
      const after = db; shapeOk(after, `${f}#${i}`);
      const kept = after.weeks.flatMap(w => w.days).flatMap(d => d.workouts).map(w => [w.id, w.workoutName, w.planKm, w.actual?.km ?? null]);
      for (const g of JSON.parse(before)) assert.ok(kept.some(k => JSON.stringify(k) === JSON.stringify(g)) || g[0] && kept.some(k => k[0] === g[0]), `${f}#${i}: mất/ghi đè bài đang có ${g[0]}`);
    }
  }
});

test('ảnh bài tập base64 hỏng / quá lớn → thư viện chuẩn hoá được, ảnh hỏng bị bỏ hoặc giữ nguyên chuỗi, không sập', () => {
  const lib = L.parseJsonText(rd('t17-v25-full.json')).fitnessLibrary;
  const imgs = ['x" onerror="alert(1)', 'data:image/png;base64,AAAA" onerror="alert(1)', 'data:image/png;base64,@@@', 'data:image/png;base64,', 'data:,', 'data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+', 'javascript:alert(1)', 'http://x/y.png', 'data:image/jpeg;base64,' + 'A'.repeat(3_000_000), 123, null, {}, []];
  for (const [i, img] of imgs.entries()) {
    const out = safe(() => F.normalizeLibrary(lib.map((e, k) => k === 0 ? { ...e, imageData: img, imageName: img } : e)), 'img#' + i);
    assert.ok(out.ok && Array.isArray(out.value) && out.value.length === lib.length, 'img#' + i + ': thư viện bị mất bài');
    const im = out.value[0].imageData; assert.ok(im == null || im === '' || typeof im === 'string', 'img#' + i + ': ảnh không phải chuỗi');
    if (typeof im === 'string' && im) assert.ok(/^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/]+=*$/.test(im), 'img#' + i + ': ảnh lạ lọt qua: ' + im.slice(0, 40));
    safe(() => F.dataUrlBytes(img), 'bytes#' + i);
  }
});

test('CSV chỉ số cơ thể bị đột biến (số chữ, ngày sai, cột lệch, dòng rất dài) → không sập, bản ghi tốt không bị ghi đè', () => {
  const good = B.normalizeList([{ id: 'g1', date: '2026-10-01', time: '06:00', weightKg: 70, bodyFatPct: 18 }]);
  for (const f of ['body-scale-en.csv', 'body-manual-vi.csv']) {
    const base = rd(f); const r = rng(f.length);
    for (let i = 0; i < N; i++) {
      let t = base.split(''); for (let k = 0; k < 1 + Math.floor(r() * 12); k++) { const pos = Math.floor(r() * t.length); const op = r(); if (op < 0.3) t.splice(pos, 1); else if (op < 0.6) t.splice(pos, 0, [';', ',', '\n', '"', 'x', '-', '\t'][Math.floor(r() * 7)]); else t[pos] = String.fromCharCode(32 + Math.floor(r() * 200)); }
      if (i % 25 === 0) t = t.concat('\n' + '9'.repeat(50000));
      const res = safe(() => B.parseCsv(t.join('')), `${f}#${i}`); if (!res.ok) continue;
      for (const rec of res.value.records || []) { assert.ok(C.isYmd(rec.date), `${f}#${i}: ngày sai lọt qua: ${rec.date}`); for (const k of B.FIELDS.map(x => x.key)) if (rec[k] != null) assert.ok(Number.isFinite(rec[k]), `${f}#${i}: ${k} không phải số`); }
      const m = safe(() => B.merge(good, res.value.records || []), `${f}#${i} merge`);
      if (m.ok) { const g = (m.value.list || m.value).find(x => x.date === '2026-10-01' && x.time === '06:00'); assert.ok(g && g.weightKg === 70 && g.bodyFatPct === 18, `${f}#${i}: số đo tốt bị ghi đè`); }
    }
  }
});

test('bảng Excel (lưới tuần + khối fitness + sheet Body) bị đột biến → không sập', () => {
  const rows = [['Tuần \\ Thứ', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ nhật'], ['46', 'Easy', '', 'Tempo', '', '', '', 'Long'], ['ngày', '2026-11-09', '2026-11-10', '2026-11-11', '', '', '', '2026-11-15'],
    ['Mô tả bài tập', 'chạy nhẹ', '', 'Warm-up: 10 phút', '', '', '', ''], ['Số km dự kiến', 8, '', '10', '', '', '', 'abc'], ['Thời gian dự kiến', 45, '', '1:00:00', '', '', '', null]];
  for (let i = 0; i < N * 2; i++) {
    const x = mutate(rows, rng(i * 977), 0.12); const res = safe(() => XP.parseWorkbookRows(Array.isArray(x) ? x : []), 'xp#' + i);
    if (res.ok) assert.ok(Array.isArray(res.value), 'xp#' + i + ': không ra mảng tuần');
    safe(() => B.fromAoa(Array.isArray(x) ? x : []), 'bodyAoa#' + i);
    safe(() => FI.parseMobileWorkbook({ Session: x, 'Workout Log': x }), 'mobileWb#' + i);
  }
});

test('file .xlsx hỏng (byte rác, zip cắt cụt) → từ chối có thông báo, không treo', async () => {
  const good = fs.readFileSync(path.join(FX, 'fitness-mobile-v3.xlsx'));
  const r = rng(99);
  const cases = [Buffer.alloc(0), Buffer.from('PK'), Buffer.from('không phải zip'), good.subarray(0, 200), good.subarray(0, good.length / 2), Buffer.from(good.map(b => (r() < 0.01 ? (b ^ 0xff) : b)))];
  for (const [i, b] of cases.entries()) {
    const ab = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    const out = await Promise.race([XLSX.readSheets(ab).then(v => ({ v }), e => ({ e })), new Promise(res => setTimeout(() => res({ timeout: true }), 3000))]);
    assert.ok(!out.timeout, 'xlsx#' + i + ': treo');
    if (out.e) assert.ok(out.e instanceof Error && out.e.message, 'xlsx#' + i + ': lỗi không có thông báo');
  }
});

test('cài đặt calo / hồ sơ bị đột biến → normalizeSettings, bmr, baseline không sập, không ra NaN', () => {
  const base = { sex: 'male', heightCm: '175', birthDate: '1991-01-15', weightKg: 80, energy: { mode: 'manual', formula: 'katch', pal: 1.4, baselineKcalManual: 2100, overrides: { '2026-11-09': 2500 } } };
  const body = [{ date: '2026-11-01', weightKg: 79, bodyFatPct: 20, bmrKcal: 1700 }];
  for (let i = 0; i < N * 2; i++) {
    const p = mutate(base, rng(i * 13), 0.2), bm = mutate(body, rng(i * 17), 0.2);
    const res = safe(() => E.baseline(p, Array.isArray(bm) ? bm : [], '2026-11-09'), 'en#' + i);
    if (res.ok && res.value.ok) assert.ok(Number.isFinite(res.value.kcal) && res.value.kcal > 0, 'en#' + i + ': kcal không hợp lệ ' + res.value.kcal);
  }
});
