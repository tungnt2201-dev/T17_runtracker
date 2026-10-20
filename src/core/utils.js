/* T17 RunTracker — core utilities.
 * Pure functions only (no DOM, no storage). Loaded as a classic <script> in the app
 * (exposes globalThis.T17Core) and via require() in Node tests.
 */
(function (root) {
'use strict';
const DAYS = ['Hai', 'Ba', 'Tư', 'Năm', 'Sáu', 'Bảy', 'CN'];

function cleanDescription(text) { return String(text ?? '').replace(/^Warm-up:\s*Warm-up:\s*/gim, 'Warm-up: ').replace(/^Cool-down:\s*Cool-down:\s*/gim, 'Cool-down: '); }
function genId(prefix = 'w') { return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function hasWorkoutContent(rec) { return +rec?.planKm > 0 || +rec?.planMinutes > 0 || !!String(rec?.description || '').trim() || !!String(rec?.workoutName || '').trim(); }
function norm(s) { return String(s ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd'); }
function ymd(d) { if (!d) return ''; return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function isYmd(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }
function excelYmd(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number' && Number.isFinite(v)) { const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v * 86400000)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`; }
  const s = String(v).trim(); let m;
  if ((m = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})/))) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  if ((m = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})/))) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
}
function pace(km, min) { km = +km; min = +min; if (!(km > 0 && min > 0)) return ''; const sec = Math.round(min * 60 / km); return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}/km`; }
function parseDurationInput(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return { ok: true, minutes: '', seconds: 0 };
  const s = raw.toLowerCase().replace(/[’′]/g, "'").replace(/[”″]/g, '"').replace(/\s+/g, '');
  // Tương thích dữ liệu cũ: một số thuần túy vẫn được hiểu là số phút.
  if (/^\d+(?:[.,]\d+)?$/.test(s)) { const min = Number(s.replace(',', '.')); return Number.isFinite(min) && min >= 0 ? { ok: true, minutes: min, seconds: Math.round(min * 60) } : { ok: false, error: 'Thời gian không hợp lệ.' }; }
  if (s.includes(':')) {
    const parts = s.split(':');
    if (parts.length === 2 || parts.length === 3) {
      if (!parts.every(p => /^\d+$/.test(p))) return { ok: false, error: 'Dùng mm:ss hoặc h:mm:ss.' };
      let h = 0, m = 0, sec = 0;
      if (parts.length === 2) { m = +parts[0]; sec = +parts[1]; } else { h = +parts[0]; m = +parts[1]; sec = +parts[2]; if (m >= 60) return { ok: false, error: 'Ở dạng h:mm:ss, phần phút phải nhỏ hơn 60.' }; }
      if (sec >= 60) return { ok: false, error: 'Phần giây phải nhỏ hơn 60.' };
      const total = h * 3600 + m * 60 + sec; return { ok: true, minutes: total / 60, seconds: total };
    }
    return { ok: false, error: 'Dùng mm:ss hoặc h:mm:ss.' };
  }
  const m = s.match(/^(?:(\d+)h)?(?:(\d+)')?(?:(\d+(?:[.,]\d+)?)")?$/);
  if (m && (m[1] != null || m[2] != null || m[3] != null)) {
    const h = +(m[1] || 0), min = +(m[2] || 0), sec = Number(String(m[3] || 0).replace(',', '.'));
    if (h > 0 && min >= 60) return { ok: false, error: 'Sau h, phần phút phải nhỏ hơn 60.' };
    if (sec >= 60) return { ok: false, error: 'Phần giây phải nhỏ hơn 60.' };
    const total = h * 3600 + min * 60 + sec; return { ok: true, minutes: total / 60, seconds: total };
  }
  return { ok: false, error: 'Ví dụ hợp lệ: 66:30, 1:06:30, 66\'30", 1h06\'30".' };
}
function formatDurationClock(minutes) {
  if (minutes === '' || minutes == null || !Number.isFinite(+minutes) || +minutes < 0) return '';
  let total = Math.round(+minutes * 60); const h = Math.floor(total / 3600); total -= h * 3600; const m = Math.floor(total / 60), sec = total % 60;
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}
function samePlanRecord(a, b) { return String(a?.planKm ?? '') === String(b?.planKm ?? '') && String(a?.planMinutes ?? '') === String(b?.planMinutes ?? '') && String(a?.description ?? '').trim() === String(b?.description ?? '').trim() && String(a?.workoutName ?? '').trim() === String(b?.workoutName ?? '').trim() && JSON.stringify(a?.workoutStructure || null) === JSON.stringify(b?.workoutStructure || null); }
function numVN(s) { return parseFloat(String(s).replace(',', '.')); }
function paceToSec(v) { const s = String(v ?? '').trim(); if (!s) return 0; const m = s.match(/^(\d{1,2}):([0-5]\d)$/); if (m) return +m[1] * 60 + (+m[2]); const n = Number(s.replace(',', '.')); return Number.isFinite(n) && n > 0 ? Math.round(n * 60) : 0; }
function secToPace(sec) { sec = Math.round(+sec || 0); if (sec <= 0) return ''; return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function stepEstimate(step) { if (!step) return { minutes: 0, km: 0, paceSec: 0 }; const value = +step.value || 0; const p1 = paceToSec(step.paceFrom), p2 = paceToSec(step.paceTo); const p = p1 && p2 ? (p1 + p2) / 2 : (p1 || p2 || 0); let minutes = 0, km = 0; if (step.mode === 'distance') { km = value; if (p) minutes = km * p / 60; } else { minutes = value; if (p) km = minutes / (p / 60); } return { minutes, km, paceSec: p }; }
function flattenStructuredSegments(structure) { if (!structure) return []; const out = []; const push = (step, role) => { if (!step) return; const e = stepEstimate(step); if (!(e.minutes > 0 || e.km > 0)) return; out.push({ ...step, role, duration: e.minutes || Math.max(0.2, e.km * (e.paceSec || 600) / 60), paceSec: e.paceSec }); }; push(structure.warmup, 'warm'); for (const g of structure.groups || []) { const reps = clamp(+g.repeats || 1, 1, 30); for (let r = 0; r < reps; r++) for (const s of g.steps || []) push(s, 'main'); } push(structure.cooldown, 'cool'); return out.slice(0, 90); }
/* v2.0 fix: HR trung bình chỉ chia 2 khi có ĐỦ cả HR min và HR max
 * (bản v1.8.9 sai thứ tự toán tử nên chia 2 cả khi chỉ có một giá trị). */
function segmentHeight(s) {
  if (s.activity === 'rest' || s.intensity === 'rest') return 12;
  if (s.activity === 'walk' || s.intensity === 'walk') return s.paceSec ? clamp(15 + (720 - s.paceSec) / 18, 14, 28) : 20;
  if (s.paceSec) return clamp(34 + (720 - s.paceSec) / (720 - 180) * 62, 34, 96);
  const a = +s.hrFrom || 0, b = +s.hrTo || 0;
  const hr = a && b ? (a + b) / 2 : (a || b);
  if (hr > 0) return clamp(35 + (hr - 100) / (190 - 100) * 58, 34, 94);
  return ({ warm: 42, cool: 36, easy: 52, work: 68, hard: 88 }[s.intensity] || 52);
}
function parseYmdLocal(s) { const m = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(); }
function addDaysYmd(s, n) { const d = parseYmdLocal(s); d.setDate(d.getDate() + n); return ymd(d); }
function mondayYmd(s) { const d = parseYmdLocal(s); const dow = (d.getDay() + 6) % 7; d.setDate(d.getDate() - dow); return ymd(d); }
function isoWeekNumber(s) { const d = parseYmdLocal(s); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)); const w1 = new Date(d.getFullYear(), 0, 4); return 1 + Math.round(((d - w1) / 86400000 - 3 + ((w1.getDay() + 6) % 7)) / 7); }
function blankDay(date, di) { return { dow: DAYS[di], date, workouts: [] }; }
function deepClone(x) { return JSON.parse(JSON.stringify(x)); }
function stepTargetsText(s) { const parts = []; if (s.paceFrom || s.paceTo) parts.push(`Pace ${s.paceFrom || '—'}–${s.paceTo || '—'}/km`); if (s.hrFrom || s.hrTo) parts.push(`HR ${s.hrFrom || '—'}–${s.hrTo || '—'} bpm`); return parts.join(' · '); }
function stepText(s, showLabel = true) { const activity = s.activity === 'walk' ? 'Đi bộ' : s.activity === 'rest' ? 'Nghỉ' : 'Chạy'; const unit = s.mode === 'distance' ? 'km' : 'phút'; const prefix = showLabel ? `${s.label || activity}: ` : ''; return `${prefix}${activity} ${+s.value || 0} ${unit}${stepTargetsText(s) ? ' · ' + stepTargetsText(s) : ''}`; }
function smartNum(v) { const n = +v || 0; return Number.isInteger(n) ? String(n) : String(Math.round((n + Number.EPSILON) * 1000) / 1000).replace('.', ','); }
function descriptionOf(structure) { if (!structure) return ''; const lines = []; if (structure.warmup) lines.push('Warm-up: ' + stepText(structure.warmup, false)); for (const g of structure.groups || []) { lines.push(`Lặp ${Math.max(1, +g.repeats || 1)} lần${g.label ? ' – ' + g.label : ''}:`); for (const s of g.steps || []) lines.push('• ' + stepText(s, true)); } if (structure.cooldown) lines.push('Cool-down: ' + stepText(structure.cooldown, false)); return cleanDescription(lines.join('\n')); }
function totalsOf(structure) { const segs = flattenStructuredSegments(structure); let minutes = 0, km = 0; const p = [], h = []; for (const s of segs) { const e = stepEstimate(s); minutes += e.minutes || 0; km += e.km || 0; if (s.activity === 'run') { const a = paceToSec(s.paceFrom), b = paceToSec(s.paceTo); if (a) p.push(a); if (b) p.push(b); } if (+s.hrFrom) h.push(+s.hrFrom); if (+s.hrTo) h.push(+s.hrTo); } return { minutes, km, p, h }; }

const api = { DAYS, cleanDescription, genId, hasWorkoutContent, norm, ymd, isYmd, excelYmd, pace, parseDurationInput, formatDurationClock, samePlanRecord, numVN, paceToSec, secToPace, clamp, stepEstimate, flattenStructuredSegments, segmentHeight, parseYmdLocal, addDaysYmd, mondayYmd, isoWeekNumber, blankDay, deepClone, stepTargetsText, stepText, smartNum, descriptionOf, totalsOf };
root.T17Core = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
