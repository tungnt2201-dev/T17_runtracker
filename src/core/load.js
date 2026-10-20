/* T17 RunTracker — điểm tải tập (Training Load) và mô hình thể lực / mệt mỏi.
 *
 * Điểm tải của một buổi theo thang "TSS": 100 = chạy 60 phút đúng ngưỡng.
 * Thứ tự ưu tiên phương pháp (lấy phương pháp chính xác nhất có dữ liệu):
 *   1. hr-stream : TRIMP Banister tích phân trên chuỗi nhịp tim FIT, quy đổi sao cho 60' tại LTHR = 100
 *   2. hr-avg    : TRIMP theo nhịp tim trung bình của cả buổi
 *   3. pace      : rTSS = giờ × IF² × 100, IF = pace ngưỡng / pace thực tế (không hiệu chỉnh dốc)
 *   4. rpe       : IF suy từ cảm nhận RPE 1–10
 *   5. type      : IF mặc định theo loại bài (ước tính thô)
 * CTL (thể lực) = EWMA 42 ngày, ATL (mệt mỏi) = EWMA 7 ngày, TSB (độ tươi) = CTL − ATL của hôm trước.
 */
(function (root) {
'use strict';
const C = root.T17Core || (typeof require === 'function' ? require('./utils.js') : null);
const A = root.T17Athlete || (typeof require === 'function' ? require('./athlete.js') : null);
const { paceToSec, flattenStructuredSegments, stepEstimate, addDaysYmd, mondayYmd } = C;

const TYPE_IF = { Easy: 0.70, Recovery: 0.62, 'Long run': 0.74, Tempo: 0.86, Threshold: 0.92, Interval: 0.88, VO2max: 0.90, Custom: 0.72, '': 0.72 };
const RPE_IF = [0, 0.50, 0.55, 0.60, 0.66, 0.72, 0.78, 0.84, 0.90, 0.97, 1.05];
const METHOD_LABEL = { 'hr-stream': 'nhịp tim FIT', 'hr-avg': 'nhịp tim TB', pace: 'pace', rpe: 'RPE', type: 'ước tính theo loại bài', plan: 'kế hoạch' };

function trimpCoeff(sex) { return sex === 'female' ? 1.67 : 1.92; }
function trimpRate(hr, P) { const hrr = Math.max(0, Math.min(1.1, (hr - P.hrRest) / (P.hrMax - P.hrRest))); return hrr * 0.64 * Math.exp(trimpCoeff(P.sex) * hrr); }
function trimpPerHourAtLthr(P) { return 60 * trimpRate(P.lthr, P); }

/** Tải từ chuỗi [phút, hr] (moving time). Khoảng trống >1 phút không tính (đồng hồ dừng). */
function loadFromHrStream(points, P) {
  if (!Array.isArray(points) || points.length < 10) return 0;
  let trimp = 0;
  for (let i = 1; i < points.length; i++) {
    const [m0, h0] = points[i - 1], [m1, h1] = points[i];
    const dtMin = (m1 - m0) / 60;
    if (!(dtMin > 0) || dtMin > 1) continue;
    trimp += dtMin * trimpRate((h0 + h1) / 2, P);
  }
  return trimp / trimpPerHourAtLthr(P) * 100;
}
function loadFromIF(minutes, IF) { return minutes / 60 * IF * IF * 100; }

function isDone(item) { return !!item?.actual && item.actual.status !== 'missed'; }

/** Điểm tải thực tế của một bài đã hoàn thành. */
function actualLoad(item, profile) {
  const a = item?.actual; if (!isDone(item)) return { load: 0, method: null };
  const P = A.resolveProfile(profile);
  const minutes = Number(a.minutes) || 0, km = Number(a.km) || 0;
  const stream = a.fitImport?.sectionSource?.hr;
  if (Array.isArray(stream) && stream.length >= 10) {
    const l = loadFromHrStream(stream, P);
    // chuỗi HR lấy mẫu thưa có thể thiếu đầu/cuối: bù theo tỉ lệ thời lượng
    const covered = (stream[stream.length - 1][0] - stream[0][0]) / 60;
    const scale = minutes > 0 && covered > 0 ? Math.min(1.3, Math.max(1, minutes / covered)) : 1;
    if (l > 0) return { load: l * scale, method: 'hr-stream' };
  }
  const avgHr = Number(a.avgHr) || 0;
  if (avgHr > P.hrRest && minutes > 0) return { load: minutes * trimpRate(avgHr, P) / trimpPerHourAtLthr(P) * 100, method: 'hr-avg' };
  if (P.thresholdPaceSec && minutes > 0 && km > 0) { const IF = Math.min(1.25, P.thresholdPaceSec / (minutes * 60 / km)); return { load: loadFromIF(minutes, IF), method: 'pace' }; }
  const rpe = Math.round(Number(a.fatigue) || 0);
  if (rpe >= 1 && rpe <= 10 && minutes > 0) return { load: loadFromIF(minutes, RPE_IF[rpe]), method: 'rpe' };
  if (minutes > 0) return { load: loadFromIF(minutes, TYPE_IF[item.workoutType] ?? TYPE_IF.Custom), method: 'type' };
  return { load: 0, method: null };
}

/** Điểm tải dự kiến của bài kế hoạch, theo pace/HR mục tiêu từng đoạn nếu có. */
function plannedLoad(item, profile) {
  const P = A.resolveProfile(profile);
  const segs = flattenStructuredSegments(item?.workoutStructure);
  let load = 0;
  if (segs.length) {
    for (const s of segs) {
      const e = stepEstimate(s); const min = e.minutes || s.duration || 0; if (!(min > 0)) continue;
      let IF = s.activity === 'walk' || s.activity === 'rest' ? 0.45 : TYPE_IF[item.workoutType] ?? TYPE_IF.Custom;
      if (s.activity === 'run') {
        if (P.thresholdPaceSec && e.paceSec) IF = Math.min(1.25, P.thresholdPaceSec / e.paceSec);
        else if (+s.hrFrom || +s.hrTo) { const hr = (+s.hrFrom && +s.hrTo) ? (+s.hrFrom + +s.hrTo) / 2 : (+s.hrFrom || +s.hrTo); load += min * trimpRate(hr, P) / trimpPerHourAtLthr(P) * 100; continue; }
      }
      load += loadFromIF(min, IF);
    }
    if (load > 0) return load;
  }
  const minutes = Number(item?.planMinutes) || 0;
  return minutes > 0 ? loadFromIF(minutes, TYPE_IF[item.workoutType] ?? TYPE_IF.Custom) : 0;
}

/** Thời gian (phút) trong từng vùng HR. Ưu tiên chuỗi HR FIT; nếu chỉ có HR TB → dồn cả buổi vào 1 vùng. */
function hrZoneMinutes(item, profile) {
  const out = [0, 0, 0, 0, 0]; if (!isDone(item)) return { zones: out, source: null };
  const a = item.actual; const stream = a.fitImport?.sectionSource?.hr;
  if (Array.isArray(stream) && stream.length >= 10) {
    for (let i = 1; i < stream.length; i++) { const dt = (stream[i][0] - stream[i - 1][0]) / 60; if (!(dt > 0) || dt > 1) continue; out[A.hrZoneOf((stream[i][1] + stream[i - 1][1]) / 2, profile) - 1] += dt; }
    return { zones: out, source: 'stream' };
  }
  const avg = Number(a.avgHr) || 0, min = Number(a.minutes) || 0;
  if (avg > 0 && min > 0) { out[A.hrZoneOf(avg, profile) - 1] += min; return { zones: out, source: 'avg' }; }
  return { zones: out, source: null };
}

/** Duyệt mọi bài trong db → danh sách phẳng có kèm điểm tải. */
function collect(db, profile) {
  const rows = [];
  for (const w of db?.weeks || []) for (const d of w.days || []) for (const it of d.workouts || []) {
    if (!d.date) continue;
    const done = isDone(it); const al = done ? actualLoad(it, profile) : { load: 0, method: null };
    rows.push({ date: d.date, item: it, done, missed: it.actual?.status === 'missed', standalone: !!it.fitStandalone, actualLoad: al.load, method: al.method, plannedLoad: it.fitStandalone ? 0 : plannedLoad(it, profile) });
  }
  rows.sort((a, b) => a.date.localeCompare(b.date));
  return rows;
}

/** Chuỗi PMC theo ngày từ `from` tới `to`. Ngày > today chưa có kết quả dùng tải kế hoạch (dự báo). */
function pmcSeries(rows, opts = {}) {
  const today = opts.today; const daily = new Map();
  for (const r of rows) {
    let v = 0, projected = false;
    if (r.done) v = r.actualLoad;
    else if (!r.missed && !r.standalone && today && r.date > today) { v = r.plannedLoad; projected = true; }
    if (!v) continue;
    const cur = daily.get(r.date) || { load: 0, projected: 0 };
    if (projected) cur.projected += v; else cur.load += v;
    daily.set(r.date, cur);
  }
  const dates = [...daily.keys()].sort();
  if (!dates.length) return [];
  const start = opts.seedFrom && opts.seedFrom < dates[0] ? opts.seedFrom : dates[0];
  const end = opts.to || dates[dates.length - 1];
  const out = []; let ctl = Number(opts.ctl0) || 0, atl = Number(opts.atl0) || 0;
  for (let d = start; d <= end; d = addDaysYmd(d, 1)) {
    const v = daily.get(d) || { load: 0, projected: 0 };
    const tsb = ctl - atl; const total = v.load + v.projected;
    ctl += (total - ctl) / 42; atl += (total - atl) / 7;
    out.push({ date: d, load: v.load, projected: v.projected, ctl, atl, tsb, isFuture: !!(today && d > today) });
  }
  return out;
}

/** Tổng hợp theo tuần (thứ Hai). */
function weeklySummary(rows) {
  const map = new Map();
  for (const r of rows) {
    const mon = mondayYmd(r.date); if (!map.has(mon)) map.set(mon, { week: mon, planKm: 0, actualKm: 0, planMin: 0, actualMin: 0, planned: 0, done: 0, missed: 0, load: 0, plannedLoad: 0 });
    const s = map.get(mon), it = r.item;
    if (!r.standalone) { s.planKm += Number(it.planKm) || 0; s.planMin += Number(it.planMinutes) || 0; s.planned++; s.plannedLoad += r.plannedLoad; }
    if (r.done) { s.actualKm += Number(it.actual.km) || 0; s.actualMin += Number(it.actual.minutes) || 0; if (!r.standalone) s.done++; s.load += r.actualLoad; }
    if (r.missed) s.missed++;
  }
  return [...map.values()].sort((a, b) => a.week.localeCompare(b.week));
}

function rampWarning(ctlPerWeek) { if (ctlPerWeek > 8) return 'Tăng tải quá nhanh (>8 CTL/tuần) — nguy cơ chấn thương'; if (ctlPerWeek > 5) return 'Tăng tải khá nhanh'; if (ctlPerWeek < -5) return 'Đang giảm tải / nghỉ'; return ''; }
function tsbLabel(tsb) { if (tsb > 25) return 'Quá nghỉ — thể lực có thể giảm'; if (tsb > 5) return 'Tươi — hợp thi đấu'; if (tsb >= -10) return 'Cân bằng'; if (tsb >= -30) return 'Đang tích luỹ tải (tối ưu)'; return 'Quá tải — cần hồi phục'; }

const api = { TYPE_IF, RPE_IF, METHOD_LABEL, trimpRate, loadFromHrStream, actualLoad, plannedLoad, hrZoneMinutes, collect, pmcSeries, weeklySummary, rampWarning, tsbLabel };
root.T17Load = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
