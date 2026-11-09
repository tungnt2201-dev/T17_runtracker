/* T17 RunTracker — CALO TRONG NGÀY (v2.5, lượt 6). Pure, không DOM. ƯỚC TÍNH theo công thức, sai số thường ±10–15%.
 *
 *   Calo ngày = NỀN (hoạt động bình thường, KHÔNG tính giờ tập) + Σ calo RÒNG của các buổi tập đã làm trong ngày.
 *   BMR, theo thứ tự ưu tiên:  BMR đo thật (bodyMetrics.bmrKcal) → Katch–McArdle (cần % mỡ) → Mifflin–St Jeor.
 *     Mifflin nam = 10W + 6,25H − 5A + 5 ; nữ = 10W + 6,25H − 5A − 161 ;  Katch = 370 + 21,6 × W × (1 − %mỡ/100)
 *   Nền: ghi đè theo ngày (profile.energy.overrides[ngày]) → số cố định (mode 'manual') → BMR × PAL (mặc định 1,3).
 *   Calo ròng một buổi (đã trừ phần nghỉ BMR/1440 × phút để không tính trùng với nền):
 *     1. calo nhập tay   2. calo trong file FIT   (cả hai là tổng → trừ phần nghỉ)
 *     3. chạy bộ: 1,0 kcal × kg × km (vốn là chi phí RÒNG của chạy, không trừ thêm)
 *     4. fitness: (MET − 1) × kg × giờ, MET theo RPE: ≤ 4 → 3,5 ; 5–6 → 5,0 ; ≥ 7 → 6,0 (thiếu RPE → 5,0)
 *   Cân nặng / % mỡ / BMR đo: bản ghi chỉ số cơ thể gần nhất VÀO HOẶC TRƯỚC ngày đó (không dùng số đo tương lai),
 *   không có thì dùng cân nặng trong hồ sơ. Thiếu dữ liệu → trả danh sách ô còn thiếu, không đoán.
 *
 * profile.energy = { mode: 'auto'|'manual', formula: 'auto'|'mifflin'|'katch', pal: 1.3, baselineKcalManual: null|number,
 *                    overrides: { 'YYYY-MM-DD': kcal } }   — tuỳ chọn; thiếu → tự tính nếu đủ dữ liệu.
 */
(function (root) {
'use strict';
const C = root.T17Core || (typeof require === 'function' ? require('./utils.js') : null);
const F = root.T17Fitness || (typeof require === 'function' ? require('./fitness.js') : null);
const { isYmd } = C;

const PAL_TABLE = [
  { pal: 1.2, label: 'Ít vận động — ngồi gần như cả ngày' },
  { pal: 1.3, label: 'Nhẹ — việc văn phòng, đi lại ít (mặc định)' },
  { pal: 1.4, label: 'Vừa — đứng / đi nhiều trong ngày' },
  { pal: 1.5, label: 'Năng động — công việc di chuyển liên tục' },
  { pal: 1.6, label: 'Lao động nặng — lao động tay chân' },
];
const DEFAULT_PAL = 1.3, PAL_MIN = 1.1, PAL_MAX = 2.0;
const RUN_KCAL_PER_KG_KM = 1.0;
const SOURCE_LABEL = { override: 'ghi đè ngày', manual: 'bạn đã sửa', auto: 'tự tính' };
const METHOD_LABEL = { measured: 'BMR đo (cân)', katch: 'Katch–McArdle', mifflin: 'Mifflin–St Jeor', manual: 'nhập tay', fit: 'file FIT', 'run-km': '1,0 kcal/kg/km', 'fitness-met': 'MET theo RPE' };
const num = v => { if (v === '' || v == null) return null; const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };

/* ---------- cài đặt ---------- */
/** Chuẩn hoá profile.energy (giữ field lạ). null nếu không phải object. */
function normalizeSettings(e) {
  if (!e || typeof e !== 'object' || Array.isArray(e)) return null;
  const o = { ...e };
  o.mode = e.mode === 'manual' ? 'manual' : 'auto';
  o.formula = ['mifflin', 'katch'].includes(e.formula) ? e.formula : 'auto';
  const pal = num(e.pal); o.pal = pal != null && pal >= PAL_MIN && pal <= PAL_MAX ? pal : DEFAULT_PAL;
  const man = num(e.baselineKcalManual); o.baselineKcalManual = man != null && man >= 500 && man <= 8000 ? Math.round(man) : null;
  const ov = {}; if (e.overrides && typeof e.overrides === 'object') for (const [d, v] of Object.entries(e.overrides)) { const n = num(v); if (isYmd(d) && n != null && n >= 300 && n <= 8000) ov[d] = Math.round(n); }
  o.overrides = ov;
  return o;
}
const settingsOf = profile => normalizeSettings(profile?.energy) || normalizeSettings({});

/* ---------- đầu vào tại một ngày ---------- */
/** Bản ghi chỉ số cơ thể gần nhất VÀO HOẶC TRƯỚC `date` có trường `key`. */
function bodyAt(list, date, key) {
  let best = null;
  for (const r of Array.isArray(list) ? list : []) { const v = num(r?.[key]); if (v == null || !r.date || r.date > date) continue; if (!best || `${r.date} ${r.time || ''}` > `${best.date} ${best.time || ''}`) best = { ...r, [key]: v }; }
  return best ? { value: best[key], date: best.date } : null;
}
function ageAt(birth, date) {
  if (!isYmd(birth) || !isYmd(date)) return null;
  const [by, bm, bd] = birth.split('-').map(Number), [y, m, d] = date.split('-').map(Number);
  let a = y - by; if (m < bm || (m === bm && d < bd)) a--; return a >= 0 && a < 120 ? a : null;
}
/** Đầu vào công thức tại ngày: cân nặng, % mỡ, BMR đo, chiều cao, tuổi, giới tính (kèm nguồn). */
function inputsAt(profile, bodyMetrics, date) {
  const p = profile || {};
  const w = bodyAt(bodyMetrics, date, 'weightKg'); const wp = num(p.weightKg);
  const h = num(p.heightCm);
  return {
    weightKg: w ? w.value : (wp && wp > 20 ? wp : null), weightFrom: w ? `số đo ${w.date}` : (wp ? 'hồ sơ' : ''),
    bodyFatPct: bodyAt(bodyMetrics, date, 'bodyFatPct')?.value ?? null,
    bmrMeasured: bodyAt(bodyMetrics, date, 'bmrKcal')?.value ?? null,
    heightCm: h && h >= 100 && h <= 250 ? h : null,
    age: ageAt(p.birthDate, date),
    sex: p.sex === 'female' || p.sex === 'male' ? p.sex : null,
  };
}

/* ---------- BMR ---------- */
function mifflin(i) { return 10 * i.weightKg + 6.25 * i.heightCm - 5 * i.age + (i.sex === 'female' ? -161 : 5); }
function katch(i) { return 370 + 21.6 * i.weightKg * (1 - i.bodyFatPct / 100); }
/** → { ok, kcal, method, inputs, missing: ['chiều cao', …] } */
function bmr(profile, bodyMetrics, date) {
  const i = inputsAt(profile, bodyMetrics, date); const formula = settingsOf(profile).formula;
  if (formula === 'auto' && i.bmrMeasured != null && i.bmrMeasured >= 500) return { ok: true, kcal: i.bmrMeasured, method: 'measured', inputs: i, missing: [] };
  if ((formula === 'auto' || formula === 'katch') && i.weightKg != null && i.bodyFatPct != null && i.bodyFatPct > 2 && i.bodyFatPct < 70) return { ok: true, kcal: katch(i), method: 'katch', inputs: i, missing: [] };
  if (formula === 'katch') return { ok: false, kcal: null, method: 'katch', inputs: i, missing: [i.weightKg == null && 'cân nặng', i.bodyFatPct == null && '% mỡ'].filter(Boolean) };
  const missing = [i.weightKg == null && 'cân nặng', i.heightCm == null && 'chiều cao', i.age == null && 'ngày sinh (tuổi)', i.sex == null && 'giới tính'].filter(Boolean);
  return missing.length ? { ok: false, kcal: null, method: 'mifflin', inputs: i, missing } : { ok: true, kcal: mifflin(i), method: 'mifflin', inputs: i, missing: [] };
}

/* ---------- nền (hoạt động bình thường) ---------- */
/** → { ok, kcal, source: 'override'|'manual'|'auto', pal, bmr, missing } */
function baseline(profile, bodyMetrics, date) {
  const s = settingsOf(profile); const b = bmr(profile, bodyMetrics, date);
  if (s.overrides[date] != null) return { ok: true, kcal: s.overrides[date], source: 'override', pal: s.pal, bmr: b, missing: [] };
  if (s.mode === 'manual' && s.baselineKcalManual != null) return { ok: true, kcal: s.baselineKcalManual, source: 'manual', pal: s.pal, bmr: b, missing: [] };
  if (!b.ok) return { ok: false, kcal: null, source: 'auto', pal: s.pal, bmr: b, missing: b.missing };
  return { ok: true, kcal: b.kcal * s.pal, source: 'auto', pal: s.pal, bmr: b, missing: [] };
}

/* ---------- calo ròng của buổi tập ---------- */
function metForRpe(rpe) { const r = num(rpe); if (r == null || r <= 0) return 5.0; return r <= 4 ? 3.5 : r <= 6 ? 5.0 : 6.0; }
/** Calo ròng của một bài. ctx = { weightKg, bmrKcal }. Bài đã tập → { kcal, method, planned:false }; bài kế hoạch → planned:true (dự kiến).
 *  { kcal: null, missing:[…] } nếu không đủ dữ liệu. Không bao giờ ghi vào actual. */
function sessionNet(item, ctx = {}) {
  const fit = F && F.isFitnessWorkout(item); const a = item?.actual;
  const done = !!a && a.status !== 'missed';
  const restPerMin = ctx.bmrKcal > 0 ? ctx.bmrKcal / 1440 : (ctx.weightKg > 0 ? ctx.weightKg / 60 : null); // MET 1 ≈ 1 kcal/kg/giờ
  const w = ctx.weightKg > 0 ? ctx.weightKg : null;
  if (a && a.status === 'missed') return { kcal: 0, method: null, planned: false, skipped: true };
  if (done) {
    const min = num(a.minutes) ?? 0, gross = num(a.calories);
    if (gross != null && gross > 0) {
      if (min > 0 && restPerMin == null) return { kcal: null, method: a.fitImport ? 'fit' : 'manual', planned: false, missing: ['cân nặng'] };
      return { kcal: Math.max(0, gross - (restPerMin || 0) * min), method: a.fitImport ? 'fit' : 'manual', planned: false, gross };
    }
    if (!w) return { kcal: null, method: fit ? 'fitness-met' : 'run-km', planned: false, missing: ['cân nặng'] };
    if (fit) { const m = min || num(item.planMinutes) || 0; if (!m) return { kcal: null, method: 'fitness-met', planned: false, missing: ['thời lượng buổi tập'] }; return { kcal: (metForRpe(a.fatigue) - 1) * w * m / 60, method: 'fitness-met', planned: false, met: metForRpe(a.fatigue) }; }
    const km = num(a.km); if (km > 0) return { kcal: RUN_KCAL_PER_KG_KM * w * km, method: 'run-km', planned: false };
    return { kcal: null, method: 'run-km', planned: false, missing: ['quãng đường (km) hoặc calo'] };
  }
  // kế hoạch (chưa tập)
  if (!w) return { kcal: null, planned: true, missing: ['cân nặng'] };
  if (fit) { const m = num(item.planMinutes) || 0; const met = metForRpe(item.fitness?.plannedRpe); return m ? { kcal: (met - 1) * w * m / 60, method: 'fitness-met', planned: true, met } : { kcal: null, planned: true, missing: ['thời lượng dự kiến'] }; }
  const km = num(item?.planKm); return km > 0 ? { kcal: RUN_KCAL_PER_KG_KM * w * km, method: 'run-km', planned: true } : { kcal: null, planned: true, missing: ['km dự kiến'] };
}

/* ---------- một ngày / nhiều ngày ---------- */
function workoutsOn(db, date) { for (const w of db?.weeks || []) for (const d of w.days || []) if (d.date === date) return d.workouts || []; return []; }
/** → { date, baseline, sessions:[{ id, name, fitness, kcal, method, planned, missing }], exerciseKcal, plannedKcal, total, ok, missing } */
function day(db, date, opts = {}) {
  const profile = opts.profile || db?.profile || {}; const body = db?.bodyMetrics || [];
  const base = baseline(profile, body, date);
  const inp = base.bmr.inputs; const ctx = { weightKg: inp.weightKg, bmrKcal: base.bmr.ok ? base.bmr.kcal : null };
  const sessions = workoutsOn(db, date).map(it => ({ id: it.id, name: it.workoutName || (F.isFitnessWorkout(it) ? 'Fitness' : 'Buổi chạy'), fitness: F.isFitnessWorkout(it), ...sessionNet(it, ctx) }));
  const exerciseKcal = sessions.filter(s => !s.planned && s.kcal != null).reduce((a, s) => a + s.kcal, 0);
  const plannedKcal = sessions.filter(s => s.planned && s.kcal != null).reduce((a, s) => a + s.kcal, 0);
  const missing = [...new Set([...base.missing, ...sessions.filter(s => !s.planned && s.kcal == null).flatMap(s => s.missing || [])])];
  return { date, baseline: base, sessions, exerciseKcal, plannedKcal, total: base.ok ? base.kcal + exerciseKcal : null, ok: base.ok, missing };
}
function days(db, from, to, opts = {}) {
  const out = []; for (let d = from; d <= to; d = C.addDaysYmd(d, 1)) out.push(day(db, d, opts)); return out;
}
/** Gộp theo tuần (thứ Hai): trung bình mỗi ngày của nền và tập, chỉ tính ngày có nền. */
function weekly(dayList) {
  const map = new Map();
  for (const d of dayList) { const wk = C.mondayYmd(d.date); const o = map.get(wk) || { week: wk, days: 0, baseline: 0, exercise: 0 }; if (d.ok) { o.days++; o.baseline += d.baseline.kcal; o.exercise += d.exerciseKcal; } map.set(wk, o); }
  return [...map.values()].map(o => ({ ...o, avgBaseline: o.days ? o.baseline / o.days : 0, avgExercise: o.days ? o.exercise / o.days : 0, avgTotal: o.days ? (o.baseline + o.exercise) / o.days : 0 })).sort((a, b) => a.week.localeCompare(b.week));
}

/* ---------- sửa cài đặt (thuần, trả profile mới) ---------- */
function setOverride(profile, date, kcal) {
  const e = settingsOf(profile); const ov = { ...e.overrides };
  if (kcal == null || kcal === '') delete ov[date]; else { const n = num(kcal); if (n == null || n < 300 || n > 8000) throw new Error('Calo nền của ngày phải trong khoảng 300–8000 kcal.'); ov[date] = Math.round(n); }
  return { ...(profile || {}), energy: { ...e, overrides: ov } };
}
function resetAuto(profile) { const e = settingsOf(profile); return { ...(profile || {}), energy: { ...e, mode: 'auto', formula: 'auto', pal: DEFAULT_PAL, baselineKcalManual: null } }; }

const api = { PAL_TABLE, DEFAULT_PAL, PAL_MIN, PAL_MAX, RUN_KCAL_PER_KG_KM, SOURCE_LABEL, METHOD_LABEL, normalizeSettings, settingsOf, bodyAt, ageAt, inputsAt, mifflin, katch, bmr, baseline, metForRpe, sessionNet, day, days, weekly, setOverride, resetAuto };
root.T17Energy = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
