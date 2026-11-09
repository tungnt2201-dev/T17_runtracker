// Bộ dữ liệu mẫu đầy đủ cho các chương mới: hồ sơ, fitness, chỉ số cơ thể. Dữ liệu hư cấu, không phải dữ liệu thật.
'use strict';
const C = require('/home/claude/T17_runtracker/src/core/utils.js');
const F = require('/home/claude/T17_runtracker/src/core/fitness.js');
const { make } = require('./sample-data.js');
function make2(today) {
  const data = make(today);
  const tpls = F.BUILTIN_TEMPLATES;
  let n = 0;
  const fit = (tpl, date, done) => {
    const rec = { id: 'fx' + (n++), ...F.planFromTemplate(tpl, null) };
    if (done) {
      const ex = rec.fitness.exercises.map((e, i) => ({ ...e, done: i !== 3 }));
      rec.actual = F.buildActual(null, { status: 'done', minutes: rec.planMinutes || 45, rpe: 6 + (n % 2), calories: '', note: '', exercises: ex, date }, rec);
    }
    return rec;
  };
  // Thứ Hai & Thứ Năm hằng tuần (ngày còn trống) có buổi fitness; đã tập nếu ở quá khứ.
  for (const w of data.weeks) for (const d of w.days) {
    const dow = d.dow;
    if ((dow === 'Hai' || dow === 'Năm') && d.date !== C.addDaysYmd(today, -1) && !d.workouts.length) {
      const tpl = tpls[(n) % tpls.length];
      d.workouts.push(fit(tpl, d.date, d.date < today));
    }
  }
  // Buổi fitness đã giao hôm qua, chưa có kết quả → dùng cho "nhập từ app mobile".
  const y = C.addDaysYmd(today, -1);
  for (const w of data.weeks) for (const d of w.days) if (d.date === y) { d.workouts = [fit(tpls[0], y, false)]; }
  // Hồ sơ
  data.profile = { fullName: 'Minh Anh', nickname: 'Minh Anh', sex: 'male', heightCm: 172, birthDate: '1990-05-12', weightKg: 68.2, weightGoalKg: 65, city: 'Hà Nội', club: 'CLB chạy mẫu', goal: 'Sub-2:00 half marathon, 03/2027', hrRest: 50, hrMax: 186, lthr: 168, thresholdPace: '5:20' };
  // Chỉ số cơ thể: 70 ngày, ~16 lần đo
  const body = [];
  for (let i = 0; i < 16; i++) {
    const back = 70 - Math.round(i * 4.5);
    const date = C.addDaysYmd(today, -back);
    const t = i / 15, wob = [0.2, -0.3, 0.1, 0.35, -0.2, 0.15][i % 6];
    const r = { id: 'bm' + i, date, time: '06:45', weightKg: Math.round((70.6 - 2.4 * t + wob) * 10) / 10, source: 'manual' };
    if (i % 2 === 0 || i > 11) { r.bodyFatPct = Math.round((21.8 - 1.9 * t + wob / 4) * 10) / 10; r.muscleKg = Math.round((31.2 + 0.7 * t) * 10) / 10; }
    if (i % 3 === 0 || i === 15) r.waistCm = Math.round((84.5 - 2.5 * t) * 10) / 10;
    if (i % 3 !== 1) r.hrRest = Math.round(54 - 4 * t);
    if (i === 6) r.note = 'Sau chuyến công tác, ăn mặn';
    body.push(r);
  }
  data.bodyMetrics = body;
  return data;
}
// File "app mobile" mẫu: một buổi đã giao (đã tập xong trên điện thoại) và một buổi mới.
function mobileFiles(data, today) {
  const y = C.addDaysYmd(today, -1), y2 = C.addDaysYmd(today, -2);
  let planned; for (const w of data.weeks) for (const d of w.days) if (d.date === y) planned = d.workouts[0];
  const lib = F.normalizeLibrary([]);
  const a = F.toMobileData(planned, y, lib);
  a.session.rpe = 7; a.session.calories = 310; a.session.duration = 48;
  a.session.exercises.forEach((e, i) => { e.done = i < 4; });
  const rec2 = { id: 'm2', ...F.planFromTemplate(F.BUILTIN_TEMPLATES[1], null) };
  const b = F.toMobileData(rec2, y2, lib);
  b.t17.sessionId = 'mobile-' + Date.now().toString(36); b.session.rpe = 6; b.session.duration = 35; b.session.exercises.forEach(e => { e.done = true; });
  return [['a.json', a], ['b.json', b]];
}
module.exports = { make2, mobileFiles };
