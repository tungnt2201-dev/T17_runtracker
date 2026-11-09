// npm run perf — đo hiệu năng với dữ liệu 3 năm (lượt 7).
//   node scripts/perf.mjs                 → sinh dữ liệu, đo trong jsdom, in bảng
//   node scripts/perf.mjs --write <file>  → chỉ ghi file dữ liệu 3 năm (dùng cho Chromium / exe)
// Dữ liệu (hạt giống cố định): ~780 buổi chạy + ~235 buổi fitness trong 156 tuần, 70% buổi chạy đã tập có FIT
// (chuỗi điểm như Garmin ghi “smart recording” ≈ 1 điểm / 3 giây), 500 lần đo chỉ số cơ thể, 100 ảnh bài tập ~25 KB.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const C = require(path.join(ROOT, 'src/core/utils.js'));
const F = require(path.join(ROOT, 'src/core/fitness.js'));

function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
export function makeThreeYears({ today = C.ymd(new Date()), seed = 2026, images = 100, imageKB = 25, fitShare = 0.7 } = {}) {
  const r = rng(seed); const pick = a => a[Math.floor(r() * a.length)];
  const startMon = C.addDaysYmd(C.mondayYmd(today), -7 * 155); const weeks = [];
  const lib = F.normalizeLibrary([]).slice(0, 15);
  for (let i = 0; i < images; i++) { const bytes = Buffer.alloc(Math.round(imageKB * 1024 * (0.6 + r() * 0.8))); for (let k = 0; k < bytes.length; k++) bytes[k] = (r() * 256) | 0; const item = i < lib.length ? lib[i] : { id: 'custom-perf-' + i, builtin: false, name: 'Bài tự tạo ' + i, category: pick(['Chân', 'Core', 'Hông']), plan: '3 × 12', cue: '', caution: '', defaultRows: [{ set: '1', reps: '12' }] }; item.imageData = 'data:image/jpeg;base64,' + bytes.toString('base64'); item.imageName = `anh-${i}.jpg`; if (i >= lib.length) lib.push(item); }
  let nRun = 0, nFit = 0, nFitness = 0;
  for (let wi = 0; wi < 156; wi++) {
    const mon = C.addDaysYmd(startMon, wi * 7); const days = [];
    for (let di = 0; di < 7; di++) {
      const date = C.addDaysYmd(mon, di); const workouts = []; const past = date < today;
      if ([0, 1, 3, 5, 6].includes(di)) {
        const long = di === 6, km = long ? 14 + Math.round(r() * 12) : 6 + Math.round(r() * 6), min = Math.round(km * (5.5 + r()));
        const it = { id: `perf-r${wi}-${di}`, workoutName: long ? 'Long run' : pick(['Easy', 'Tempo', 'Interval 6×800m', 'Recovery']), workoutType: long ? 'Long Run' : pick(['Easy', 'Tempo', 'Interval']), planKm: km, planMinutes: min, description: 'Warm-up: Chạy 10 phút', planNote: '', workoutStructure: wi % 3 === 0 ? { version: 1, warmup: { label: 'Warm-up', activity: 'run', mode: 'time', value: 10, paceFrom: '7:00', paceTo: '7:30' }, groups: [{ label: 'Chính', repeats: 6, steps: [{ label: 'Nhanh', activity: 'run', mode: 'distance', value: 0.8, paceFrom: '4:40', paceTo: '4:55' }, { label: 'Hồi', activity: 'walk', mode: 'time', value: 2 }] }], cooldown: { label: 'Cool-down', activity: 'run', mode: 'time', value: 10 } } : null, actual: null };
        if (past && r() < 0.92) {
          const akm = Math.round(km * (0.9 + r() * 0.2) * 100) / 100, amin = Math.round(min * (0.9 + r() * 0.2) * 10) / 10;
          it.actual = { status: 'done', km: akm, minutes: amin, fatigue: 3 + Math.round(r() * 5), calories: '', avgHr: 140 + Math.round(r() * 25), note: '', segments: [], savedAt: date + 'T08:00:00Z' };
          if (r() < fitShare) { // FIT: chuỗi điểm (phút, mét) mỗi ~3 giây + HR mỗi điểm thứ 3 — giống fit-ui lưu
            const n = Math.round(amin * 20), points = [], hr = [];
            for (let k = 0; k < n; k++) { const m = Math.round(k * amin / n * 100) / 100; points.push([m, Math.round(akm * 1000 * k / n * 100) / 100]); if (k % 3 === 0) hr.push([Math.round(m * 10) / 10, 130 + Math.round(r() * 40)]); }
            it.actual.calories = Math.round(akm * 70); it.actual.maxHr = 175;
            it.actual.fitImport = { id: 'fit' + wi + di, source: 'Garmin FIT', filename: `${date}.fit`, startTime: date + 'T06:00:00Z', importedAt: date + 'T09:00:00Z', lapCount: Math.ceil(akm), recordCount: n * 3, sectionMode: 'auto',
              insights: { stats: { maxHr: 175 }, laps: Array.from({ length: Math.ceil(akm) }, (_, k) => ({ i: k + 1, km: 1, sec: 330 + Math.round(r() * 30), hr: 150 })), charts: { hr: { title: 'HR', points: Array.from({ length: 120 }, (_, k) => [k, 140 + Math.round(r() * 30)]) }, pace: { title: 'Pace', points: Array.from({ length: 120 }, (_, k) => [k, 330 + Math.round(r() * 40)]) } } },
              sectionSource: { durationSec: amin * 60, distanceM: akm * 1000, points, hr } };
            nFit++;
          }
        } else if (past) it.actual = { status: 'missed', km: '', minutes: '', note: '', segments: [] };
        workouts.push(it); nRun++;
      }
      if ((di === 2 || (di === 4 && wi % 2 === 0))) {
        const tpl = F.BUILTIN_TEMPLATES[nFitness % F.BUILTIN_TEMPLATES.length];
        const w = F.planFromTemplate ? F.planFromTemplate(tpl) : null;
        if (w) { w.id = `perf-f${wi}-${di}`; if (past) w.actual = F.buildActual(null, { status: 'done', minutes: 45, rpe: 6, calories: '', note: '' }, w); workouts.push(w); nFitness++; }
      }
      days.push({ dow: C.DAYS[di], date, workouts });
    }
    weeks.push({ label: String(C.isoWeekNumber(mon)), days });
  }
  const bodyMetrics = []; let wkg = 74;
  for (let i = 0; i < 500; i++) { const d = C.addDaysYmd(startMon, Math.round(i * 1090 / 500)); if (d > today) break; wkg += (r() - 0.53) * 0.4; bodyMetrics.push({ id: 'bm-perf-' + i, date: d, time: '06:30', weightKg: Math.round(wkg * 10) / 10, ...(i % 3 === 0 ? { bodyFatPct: Math.round((19 + r() * 2) * 10) / 10, muscleKg: 31 + Math.round(r() * 10) / 10 } : {}), ...(i % 10 === 0 ? { waistCm: 82 + Math.round(r() * 30) / 10, hrRest: 48 + Math.round(r() * 6) } : {}), source: 'csv' }); }
  const db = { app: 'T17_runtracker', schemaVersion: 2, weeks, templates: [], templatesSeeded: true, fitnessLibrary: lib, bodyMetrics,
    profile: { sex: 'male', birthDate: '1988-05-20', heightCm: '172', weightKg: 70, hrRest: 50, hrMax: 186, lthr: 168, thresholdPace: '5:05', energy: { mode: 'auto', formula: 'auto', pal: 1.3, baselineKcalManual: null, overrides: {} } } };
  return { db, stats: { runs: nRun, fit: nFit, fitness: nFitness, body: bodyMetrics.length, images } };
}

const mb = n => (n / 1048576).toFixed(2) + ' MB';
async function measureJsdom(db) {
  const { JSDOM, VirtualConsole } = require('jsdom');
  const html = fs.readFileSync(path.join(ROOT, 'dist/web/T17_runtracker.html'), 'utf8');
  const errors = []; const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
  const json = JSON.stringify(db); const t0 = performance.now(); let tBoot = 0;
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/', virtualConsole: vc, pretendToBeVisual: true, storageQuota: 200e6, beforeParse(w) { // quota lớn để đo được (trình duyệt thật chỉ ~5 MB)
    w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.alert = m => errors.push('alert: ' + m); w.confirm = () => true; w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {};
    w.localStorage.setItem('runplan-tracker-v1', json);
  } });
  const w = dom.window; for (let i = 0; i < 400 && !w.document.querySelector('.week-block'); i++) await new Promise(r => setTimeout(r, 10)); tBoot = performance.now() - t0;
  const time = fn => { const t = performance.now(); fn(); return performance.now() - t; };
  const out = { 'Khởi động (nạp + chuẩn hoá + vẽ lịch)': tBoot };
  out['Vẽ lại lịch (render)'] = time(() => w.eval('render()'));
  out['Lưu (saveDb)'] = time(() => w.eval('saveDb()'));
  w.document.getElementById('tabAnalytics').click(); await new Promise(r => setTimeout(r, 30));
  out['Analytics › Tập luyện (12 tuần)'] = time(() => w.T17Analytics.render());
  w.document.querySelector('#anRange [data-weeks="0"]').click(); out['Analytics › Tập luyện (tất cả)'] = time(() => w.T17Analytics.render());
  w.document.querySelector('#anSub [data-sub="body"]').click(); out['Analytics › Cơ thể (tất cả)'] = time(() => w.T17Analytics.render());
  const tab = w.document.getElementById('tabLog'); if (tab) { out['Training Log'] = time(() => tab.click()); }
  const adv = w.eval('JSON.stringify(T17Core.storageAdvice(T17Platform.storageUsage(db)))');
  w.close(); return { out, errors, advice: JSON.parse(adv) };
}

const args = process.argv.slice(2);
if (process.env.PERF_NO_MAIN) { /* chỉ dùng makeThreeYears */ } else {
const { db, stats } = makeThreeYears();
if (args[0] === '--write') { fs.writeFileSync(args[1], JSON.stringify(db)); console.log('Đã ghi', args[1], mb(fs.statSync(args[1]).size), stats); process.exit(0); }
const L = require(path.join(ROOT, 'src/core/legacy.js'));
const json = JSON.stringify(db);
const parts = { 'FIT (sectionSource + insights)': 0, 'Ảnh bài tập': 0 };
for (const wk of db.weeks) for (const d of wk.days) for (const it of d.workouts) if (it.actual?.fitImport) parts['FIT (sectionSource + insights)'] += JSON.stringify(it.actual.fitImport).length;
for (const x of db.fitnessLibrary) parts['Ảnh bài tập'] += (x.imageData || '').length;
console.log(`Dữ liệu 3 năm: ${stats.runs} buổi chạy (${stats.fit} có FIT), ${stats.fitness} buổi fitness, ${stats.body} lần đo cơ thể, ${stats.images} ảnh — JSON ${mb(json.length)} (${json.length.toLocaleString('vi-VN')} ký tự)`);
for (const [k, v] of Object.entries(parts)) console.log(`  · ${k}: ${mb(v)} (${Math.round(v / json.length * 100)}%)`);
let t = performance.now(); const n = L.normalizeDb(JSON.parse(json)); console.log(`Lõi: JSON.parse + normalizeDb ${Math.round(performance.now() - t)} ms (${n.report.workouts} bài)`);
const res = await measureJsdom(db);
console.log('\nGiao diện (jsdom — không có bố cục thật; Chromium thường nhanh hơn):');
for (const [k, v] of Object.entries(res.out)) console.log(`  ${k.padEnd(42)} ${Math.round(v)} ms`);
console.log('\nCảnh báo bộ nhớ bản web:', res.advice ? `[${res.advice.level}] ${res.advice.text}` : '(không)');
if (res.errors.length) { console.log('Lỗi:', res.errors); process.exit(1); }
}
