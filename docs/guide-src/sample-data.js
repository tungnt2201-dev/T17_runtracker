// Bộ dữ liệu mẫu: 10 tuần đã tập + 3 tuần kế hoạch tới, quanh ngày "hôm nay".
'use strict';
const C = require('/home/claude/T17_runtracker/src/core/utils.js');
const step = (activity, label, mode, value, paceFrom = '', paceTo = '', hrFrom = '', hrTo = '') => ({ label, activity, mode, value, paceFrom, paceTo, hrFrom, hrTo });
const S = {
  easy: (min) => ({ version: 1, warmup: null, groups: [{ label: 'Easy pace', repeats: 1, steps: [step('run', 'Easy run', 'time', min, '6:15', '6:45')] }], cooldown: null }),
  long: (min) => ({ version: 1, warmup: step('run', 'Warm-up', 'time', 10, '7:00', '7:30'), groups: [{ label: 'Steady', repeats: 1, steps: [step('run', 'Long steady', 'time', min - 20, '6:25', '6:55')] }], cooldown: step('run', 'Cool-down', 'time', 10, '7:00', '7:30') }),
  tempo: () => ({ version: 1, warmup: step('run', 'Warm-up', 'time', 15, '7:00', '7:30'), groups: [{ label: 'Tempo', repeats: 1, steps: [step('run', 'Tempo', 'time', 20, '5:45', '6:05')] }], cooldown: step('run', 'Cool-down', 'time', 10, '7:00', '7:30') }),
  interval: () => ({ version: 1, warmup: step('run', 'Warm-up', 'time', 15, '7:00', '7:30'), groups: [{ label: '6x800m', repeats: 6, steps: [step('run', 'Fast 800m', 'distance', 0.8, '5:20', '5:45'), step('walk', 'Recovery', 'time', 2, '11:30', '13:00')] }], cooldown: step('run', 'Cool-down', 'time', 10, '7:00', '7:30') }),
  recovery: () => ({ version: 1, warmup: null, groups: [{ label: 'Recovery', repeats: 1, steps: [step('run', 'Recovery jog', 'time', 30, '7:00', '7:30')] }], cooldown: null }),
};
let n = 0;
function workout(name, type, structure, note = '') {
  const t = C.totalsOf(structure);
  return { id: 'demo' + (n++), workoutName: name, workoutType: type, planKm: Math.round(t.km * 100) / 100, planMinutes: Math.round(t.minutes * 10) / 10, description: C.descriptionOf(structure), planNote: note, workoutStructure: structure, actual: null };
}
function make(today) {
  const thisMon = C.mondayYmd(today);
  const start = C.addDaysYmd(thisMon, -9 * 7);
  const weeks = [];
  for (let w = 0; w < 13; w++) {
    const mon = C.addDaysYmd(start, w * 7);
    const build = w % 4 === 3 ? 0.8 : 1 + (w % 4) * 0.07;
    const plan = [
      null,
      workout('Easy ' + Math.round(40 * build) + ' phút', 'Easy', S.easy(Math.round(40 * build))),
      w % 2 ? workout('Interval 6x800m', 'Interval', S.interval(), 'Giữ form khi mệt') : workout('Tempo 20 phút', 'Tempo', S.tempo()),
      null,
      workout('Recovery 30 phút', 'Recovery', S.recovery()),
      null,
      workout('Long run ' + Math.round(80 * build) + ' phút', 'Long run', S.long(Math.round(80 * build))),
    ];
    const days = plan.map((p, i) => ({ dow: C.DAYS[i], date: C.addDaysYmd(mon, i), workouts: p ? [p] : [] }));
    weeks.push({ label: String(C.isoWeekNumber(mon)), days });
  }
  // hôm nay: đặt bài Interval để minh hoạ Import FIT
  for (const w of weeks) for (const d of w.days) {
    if (d.date === today) d.workouts = [workout('Interval 6x800m', 'Interval', S.interval(), 'Giữ form khi mệt')];
    if (d.date === C.addDaysYmd(today, -1)) d.workouts = [];
  }
  // kết quả quá khứ
  let k = 0;
  for (const w of weeks) for (const d of w.days) for (const it of d.workouts) {
    if (d.date >= C.addDaysYmd(today, -1)) continue;
    k++;
    if (k % 13 === 5) { it.actual = { status: 'missed', km: '', minutes: '', note: 'Đi công tác', segments: [] }; continue; }
    const f = 0.93 + ((k * 37) % 17) / 100;
    const km = Math.round(it.planKm * f * 100) / 100, min = Math.round(it.planMinutes * (0.97 + ((k * 13) % 7) / 100) * 10) / 10;
    const hr = { Easy: 146, Recovery: 138, 'Long run': 150, Tempo: 163, Interval: 158 }[it.workoutType];
    it.actual = { status: 'done', km, minutes: min, fatigue: { Easy: 4, Recovery: 3, 'Long run': 6, Tempo: 7, Interval: 8 }[it.workoutType], calories: Math.round(min * 11), avgHr: hr + ((k * 7) % 5), note: '', segments: [], savedAt: new Date().toISOString() };
  }
  return { weeks, templates: [], templatesSeeded: false };
}
module.exports = { make };
