/* T17 RunTracker — đọc và chuẩn hoá MỌI định dạng dữ liệu JSON (cũ và mới).
 *
 * Các định dạng được nhận diện (xem docs/DATA_FORMAT.md):
 *   - backup  : { weeks:[...], templates?, templatesSeeded? }        (RunPlan v1.x "Sao lưu toàn bộ")
 *               { app:'T17_runtracker', schemaVersion:2, weeks:[...] } (T17 v2 — vẫn đọc được bằng RunPlan cũ)
 *               ngày kiểu cũ (trước khi có nhiều bài/ngày): field workoutName/planKm/actual nằm thẳng trên day
 *   - plan    : { format:'runplan-plan', days:[{date, workouts:[...]}] } ("Xuất bài tập (JSON)")
 *   - log     : { format:'runplan-log', entries:[{date, ..., actual}] } (Training Log → "Xuất JSON")
 *   - weeks   : [ {label, days:[...]} ]                               (mảng tuần trần)
 *   - chuỗi JSON lồng (localStorage dump bị stringify 2 lần), có BOM, ...
 *
 * Pure: không đụng DOM/localStorage. Dùng được trong app (globalThis.T17Legacy) và Node test.
 */
(function (root) {
'use strict';
const C = root.T17Core || (typeof require === 'function' ? require('./utils.js') : null);
const { DAYS, cleanDescription, genId, hasWorkoutContent, isYmd, excelYmd, parseDurationInput, mondayYmd, addDaysYmd, isoWeekNumber, blankDay, samePlanRecord, deepClone } = C;

const APP_ID = 'T17_runtracker';
const SCHEMA_VERSION = 2;
const LEGACY_STORAGE_KEY = 'runplan-tracker-v1';
const DAY_LEVEL_FIELDS = ['workoutName', 'workoutType', 'planKm', 'planMinutes', 'description', 'planNote', 'workoutStructure', 'actual'];

/* ---------- parsing ---------- */
function parseJsonText(text) {
  let s = String(text ?? '').replace(/^﻿/, '').trim();
  if (!s) throw new Error('File JSON rỗng.');
  let data;
  try { data = JSON.parse(s); } catch (e) { throw new Error('File không phải JSON hợp lệ: ' + e.message); }
  // localStorage dump bị stringify thêm một lần: "\"{\\\"weeks\\\":...}\""
  for (let i = 0; i < 2 && typeof data === 'string'; i++) { try { data = JSON.parse(data); } catch (e) { break; } }
  return data;
}

function detectKind(x) {
  if (Array.isArray(x)) return x.some(w => w && Array.isArray(w.days)) ? 'weeks' : 'unknown';
  if (!x || typeof x !== 'object') return 'unknown';
  if (x.format === 'runplan-plan' && Array.isArray(x.days)) return 'plan';
  if (x.format === 'runplan-log' && Array.isArray(x.entries)) return 'log';
  if (Array.isArray(x.weeks)) return 'backup';
  if (x.data && typeof x.data === 'object' && Array.isArray(x.data.weeks)) return 'backup-wrapped';
  if (Array.isArray(x.days) && x.days.some(d => d && (d.workouts || d.workoutName))) return 'plan';
  if (Array.isArray(x.entries)) return 'log';
  return 'unknown';
}

/* ---------- value normalisation ---------- */
function toNum(v) {
  if (v === '' || v == null) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? v : '';
  const n = Number(String(v).trim().replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : '';
}
function toMinutes(v) {
  if (v === '' || v == null) return '';
  if (typeof v === 'number') return Number.isFinite(v) && v >= 0 ? v : '';
  const p = parseDurationInput(v);
  return p.ok ? p.minutes : '';
}
function toDate(v) { if (isYmd(v)) return v; const s = excelYmd(v); return isYmd(s) ? s : ''; }

function normalizeActual(a) {
  if (!a || typeof a !== 'object') return null;
  const out = { ...a };
  out.status = a.status === 'missed' ? 'missed' : 'done';
  out.km = toNum(a.km);
  out.minutes = toMinutes(a.minutes);
  for (const k of ['fatigue', 'calories', 'avgHr', 'maxHr']) if (k in a) out[k] = toNum(a[k]);
  out.note = a.note == null ? '' : String(a.note);
  out.segments = Array.isArray(a.segments) ? a.segments.filter(s => s && typeof s === 'object') : [];
  return out;
}

function normalizeWorkout(w, seenIds, report) {
  if (!w || typeof w !== 'object') return null;
  const out = { ...w };
  if (!out.id || seenIds.has(out.id)) { if (out.id) report.idsFixed++; out.id = genId(); }
  seenIds.add(out.id);
  out.workoutName = w.workoutName == null ? '' : String(w.workoutName);
  out.workoutType = w.workoutType == null ? '' : String(w.workoutType);
  out.planKm = toNum(w.planKm);
  out.planMinutes = toNum(w.planMinutes);
  out.description = cleanDescription(w.description || '');
  out.planNote = w.planNote == null ? '' : String(w.planNote);
  out.workoutStructure = w.workoutStructure && typeof w.workoutStructure === 'object' ? w.workoutStructure : null;
  if (typeof w.workoutStructure === 'string') { try { out.workoutStructure = JSON.parse(w.workoutStructure); } catch (e) { out.workoutStructure = null; } }
  out.actual = normalizeActual(w.actual);
  if (w.fitStandalone) out.fitStandalone = true; else delete out.fitStandalone;
  if (out.fitStandalone && !out.actual) delete out.fitStandalone; // thẻ FIT không có kết quả là vô nghĩa
  if (!hasWorkoutContent(out) && !out.actual) return null;
  if (out.actual) report.actuals++;
  if (out.actual?.fitImport) report.fitActivities++;
  report.workouts++;
  return out;
}

/** Trả về danh sách workouts của một "day" bất kể là định dạng mới hay cũ. */
function dayWorkouts(d, report) {
  if (Array.isArray(d.workouts)) return d.workouts;
  const hasLegacy = DAY_LEVEL_FIELDS.some(k => d[k] != null && d[k] !== '');
  if (!hasLegacy) return [];
  const legacy = {};
  for (const k of DAY_LEVEL_FIELDS) legacy[k] = d[k];
  if (hasWorkoutContent(legacy) || legacy.actual) { report.legacyDaysConverted++; return [legacy]; }
  return [];
}

function emptyReport(kind) { return { sourceKind: kind, weeks: 0, workouts: 0, actuals: 0, fitActivities: 0, legacyDaysConverted: 0, idsFixed: 0, datesFixed: 0, weeksRealigned: 0, orphans: 0, templates: 0 }; }

/* ---------- full database ---------- */
/** Chuẩn hoá một DB (backup hoặc dữ liệu localStorage) về schema v2.
 *  - tuần luôn bắt đầu thứ Hai, đủ 7 ngày (Excel cũ có thể tạo tuần bắt đầu giữa tuần → gộp lại)
 *  - ngày trùng giữa nhiều tuần được gộp, không mất bài
 *  - id trùng/thiếu được cấp lại; số dạng "10,5" → 10.5; thời gian "66:30" → phút
 *  - field lạ ở cấp cao nhất được giữ nguyên (tương thích với phiên bản tương lai) */
function normalizeDb(input, opts = {}) {
  let x = input;
  let kind = detectKind(x);
  if (kind === 'backup-wrapped') x = { ...x.data };
  if (kind === 'weeks') x = { weeks: x };
  if (kind === 'unknown' && x && typeof x === 'object' && !Array.isArray(x)) x = { ...x, weeks: [] };
  if (!x || typeof x !== 'object') x = { weeks: [] };
  const report = emptyReport(kind);
  const { weeks: srcWeeks, templates: srcTemplates, orphans: srcOrphans, ...rest } = x;

  const byDate = new Map();       // date -> workouts[]
  const labelVotes = new Map();   // monday -> Map(label -> count)
  const orphans = Array.isArray(srcOrphans) ? srcOrphans.slice() : [];
  const seenIds = new Set();

  for (const w of Array.isArray(srcWeeks) ? srcWeeks : []) {
    if (!w || typeof w !== 'object') continue;
    const days = Array.isArray(w.days) ? w.days : [];
    const firstDate = days.map(d => toDate(d?.date)).find(Boolean);
    if (firstDate && mondayYmd(firstDate) !== firstDate) report.weeksRealigned++;
    for (const d of days) {
      if (!d || typeof d !== 'object') continue;
      const date = toDate(d.date);
      if (date && date !== d.date) report.datesFixed++;
      const items = dayWorkouts(d, report).map(it => normalizeWorkout(it, seenIds, report)).filter(Boolean);
      if (!date) { if (items.length) { orphans.push({ week: w.label ?? '', dow: d.dow ?? '', workouts: items }); report.orphans += items.length; } continue; }
      if (!byDate.has(date)) byDate.set(date, []);
      byDate.get(date).push(...items);
      if (w.label != null && w.label !== '') {
        const mon = mondayYmd(date);
        if (!labelVotes.has(mon)) labelVotes.set(mon, new Map());
        const votes = labelVotes.get(mon);
        votes.set(String(w.label), (votes.get(String(w.label)) || 0) + 1);
      }
    }
  }

  const mondays = new Set();
  for (const [date, items] of byDate) if (items.length) mondays.add(mondayYmd(date));
  const weeks = [...mondays].sort().map(mon => {
    const votes = labelVotes.get(mon);
    let label = String(isoWeekNumber(mon));
    if (votes && votes.size) label = [...votes.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return { label, days: Array.from({ length: 7 }, (_, i) => { const date = addDaysYmd(mon, i); const day = blankDay(date, i); day.workouts = byDate.get(date) || []; return day; }) };
  });
  report.weeks = weeks.length;

  const tplSeen = new Set();
  const templates = (Array.isArray(srcTemplates) ? srcTemplates : []).filter(t => t && typeof t === 'object' && String(t.name || '').trim()).map(t => {
    const o = { ...t, name: String(t.name).trim() };
    if (!o.id || tplSeen.has(o.id)) o.id = genId('tpl');
    tplSeen.add(o.id);
    o.planKm = toNum(t.planKm); o.planMinutes = toNum(t.planMinutes); o.description = cleanDescription(t.description || '');
    return o;
  });
  report.templates = templates.length;

  const db = { ...rest, app: APP_ID, schemaVersion: SCHEMA_VERSION, weeks, templates, templatesSeeded: !!x.templatesSeeded };
  if (orphans.length) db.orphans = orphans;
  delete db.exportedAt;
  return { db, report };
}

/* ---------- merging plan / log exports into an existing DB ---------- */
function locateDateIn(db, date) {
  for (let wi = 0; wi < db.weeks.length; wi++) { const di = db.weeks[wi].days.findIndex(d => d.date === date); if (di >= 0) return { wi, di, d: db.weeks[wi].days[di] }; }
  return null;
}
function ensureDateIn(db, date) {
  let found = locateDateIn(db, date); if (found) return found;
  const mon = mondayYmd(date);
  if (!db.weeks.find(w => w.days?.[0]?.date === mon)) {
    db.weeks.push({ label: String(isoWeekNumber(date)), days: Array.from({ length: 7 }, (_, i) => blankDay(addDaysYmd(mon, i), i)) });
    db.weeks.sort((a, b) => String(a.days?.[0]?.date || '').localeCompare(String(b.days?.[0]?.date || '')));
  }
  return locateDateIn(db, date);
}
function sameActual(a, b) { if (!a || !b) return false; return String(a.km ?? '') === String(b.km ?? '') && String(a.minutes ?? '') === String(b.minutes ?? '') && (a.status || 'done') === (b.status || 'done') && (a.fitImport?.id || '') === (b.fitImport?.id || ''); }

/** Chuyển plan/log export → danh sách {date, workouts}. */
function exportToDays(x) {
  const kind = detectKind(x);
  if (kind === 'plan') return x.days.map(d => ({ date: d?.date, workouts: d ? (Array.isArray(d.workouts) ? d.workouts : dayWorkouts(d, emptyReport())) : [] }));
  if (kind === 'log') return x.entries.map(e => { const { date, dow, ...w } = e || {}; return { date, workouts: [w] }; });
  return [];
}

/** Gộp thêm (không xoá) các bài từ plan/log export vào db. withActual=true giữ cả kết quả (log). */
function mergeDays(db, days, opts = {}) {
  const withActual = !!opts.withActual;
  const res = { added: 0, duplicates: 0, invalid: 0, actualsAttached: 0 };
  const seen = new Set(); for (const w of db.weeks) for (const d of w.days) for (const it of d.workouts || []) seen.add(it.id);
  const dummy = emptyReport();
  for (const rec of days || []) {
    const date = toDate(rec?.date);
    if (!date) { res.invalid++; continue; }
    for (const src0 of rec.workouts || []) {
      const src = normalizeWorkout({ ...deepClone(src0 || {}), id: undefined }, seen, dummy);
      if (!src) { res.invalid++; continue; }
      if (!withActual) { src.actual = null; delete src.fitStandalone; }
      if (!hasWorkoutContent(src) && !src.actual) { res.invalid++; continue; }
      const dst = ensureDateIn(db, date).d; dst.workouts = dst.workouts || [];
      const same = dst.workouts.find(it => samePlanRecord(it, src));
      if (same) {
        if (withActual && src.actual && !same.actual) { same.actual = src.actual; res.actualsAttached++; }
        else res.duplicates++;
        continue;
      }
      if (withActual && src.actual && dst.workouts.some(it => sameActual(it.actual, src.actual))) { res.duplicates++; continue; }
      dst.workouts.push(src); res.added++;
    }
  }
  return res;
}

/** Bản sao lưu: vẫn có mảng weeks ở cấp cao nhất nên RunPlan v1.8.x cũ cũng khôi phục được. */
function toBackup(db, appVersion) {
  return { ...db, app: APP_ID, schemaVersion: SCHEMA_VERSION, appVersion: appVersion || '', exportedAt: new Date().toISOString() };
}

function describeReport(r) {
  const parts = [`${r.weeks} tuần`, `${r.workouts} bài`, `${r.actuals} kết quả`];
  if (r.fitActivities) parts.push(`${r.fitActivities} hoạt động FIT`);
  if (r.legacyDaysConverted) parts.push(`${r.legacyDaysConverted} ngày định dạng cũ đã chuyển đổi`);
  if (r.weeksRealigned) parts.push(`${r.weeksRealigned} tuần được căn lại về thứ Hai`);
  if (r.orphans) parts.push(`${r.orphans} bài thiếu ngày được giữ riêng`);
  return parts.join(' · ');
}

const api = { APP_ID, SCHEMA_VERSION, LEGACY_STORAGE_KEY, parseJsonText, detectKind, normalizeDb, normalizeWorkout, normalizeActual, exportToDays, mergeDays, locateDateIn, ensureDateIn, toBackup, describeReport, toNum, toMinutes };
root.T17Legacy = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
