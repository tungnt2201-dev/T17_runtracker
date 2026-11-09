// npm run e2e:exe — chạy THẬT bản Neutralino (Linux, WebKitGTK, dưới Xvfb) với bộ điều khiển scripts/e2e-driver.js (lượt 7).
//   node scripts/e2e-exe.mjs          → kịch bản chức năng: dữ liệu v2.2.0 nhiều người dùng, tạo/chuyển người dùng, nhập fitness,
//                                       nhập chỉ số cơ thể, sao lưu, khôi phục (có bản dự phòng), dữ liệu trên đĩa.
//   node scripts/e2e-exe.mjs perf     → dữ liệu 3 năm (scripts/perf.mjs): thời gian khởi động, vẽ, lưu ra đĩa, Analytics.
// Cần: bin/neutralino-linux_x64 (npx neu update), xvfb-run. Bản Windows dùng WebView2 — chưa chạy được ở đây.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = process.argv[2] === 'perf' ? 'perf' : 'func';
const DIR = path.join(ROOT, '.e2e', mode);
const cp = (a, b) => { fs.mkdirSync(path.dirname(b), { recursive: true }); fs.copyFileSync(a, b); };
fs.rmSync(DIR, { recursive: true, force: true }); fs.mkdirSync(DIR, { recursive: true });
execFileSync('node', ['scripts/build.mjs'], { cwd: ROOT, stdio: 'ignore' });
// tài nguyên: bản build + bộ điều khiển chèn cuối trang
const html = fs.readFileSync(path.join(ROOT, 'resources/index.html'), 'utf8').replace('</body>', `<script>${fs.readFileSync(path.join(ROOT, 'scripts/e2e-driver.js'), 'utf8')}</script></body>`);
fs.mkdirSync(path.join(DIR, 'resources/js'), { recursive: true }); fs.writeFileSync(path.join(DIR, 'resources/index.html'), html);
cp(path.join(ROOT, 'resources/js/neutralino.js'), path.join(DIR, 'resources/js/neutralino.js'));
fs.cpSync(path.join(ROOT, 'resources/icons'), path.join(DIR, 'resources/icons'), { recursive: true });
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'neutralino.config.json'), 'utf8')); cfg.modes.window.useSavedState = false;
fs.writeFileSync(path.join(DIR, 'neutralino.config.json'), JSON.stringify(cfg, null, 2));
const BIN = path.join(DIR, 'T17_runtracker-linux_x64'); cp(path.join(ROOT, 'bin/neutralino-linux_x64'), BIN); fs.chmodSync(BIN, 0o755);
// dữ liệu có sẵn
const FX = path.join(ROOT, 'tests/fixtures');
let expectMainWorkouts;
if (mode === 'perf') {
  process.env.PERF_NO_MAIN = '1'; const { makeThreeYears } = await import('./perf.mjs');
  const { db } = makeThreeYears(); fs.mkdirSync(path.join(DIR, 'data'), { recursive: true }); fs.writeFileSync(path.join(DIR, 'data/t17-runtracker.json'), JSON.stringify(db));
  expectMainWorkouts = db.weeks.flatMap(w => w.days).flatMap(d => d.workouts).length;
} else {
  fs.cpSync(path.join(FX, 't17-v22-multiuser'), path.join(DIR, 'data'), { recursive: true });
  const main = JSON.parse(fs.readFileSync(path.join(FX, 't17-v22-multiuser/t17-runtracker.json'), 'utf8'));
  expectMainWorkouts = main.weeks.flatMap(w => w.days).flatMap(d => d.workouts || []).length;
  // users.json của v2.2.0 đang chọn người dùng khác “main” → exe phải mở đúng người đó
  const idx = JSON.parse(fs.readFileSync(path.join(FX, 't17-v22-multiuser/users.json'), 'utf8'));
  const act = JSON.parse(fs.readFileSync(path.join(FX, 't17-v22-multiuser', idx.activeUserId === 'main' ? 't17-runtracker.json' : `users/${idx.activeUserId}.json`), 'utf8'));
  var expectBoot = act.weeks.flatMap(w => w.days).flatMap(d => d.workouts || []).length, expectBootUser = idx.activeUserId;
  cp(path.join(FX, 'fitness-mobile-v3.json'), path.join(DIR, 'e2e-fitness-v3.json')); cp(path.join(FX, 'body-scale-en.csv'), path.join(DIR, 'e2e-body.csv'));
}
fs.writeFileSync(path.join(DIR, 'e2e-config.json'), JSON.stringify({ mode, expectMainWorkouts, expectBoot: typeof expectBoot === 'number' ? expectBoot : expectMainWorkouts, expectBootUser: typeof expectBootUser === 'string' ? expectBootUser : 'main' }));
const t0 = Date.now();
try { execFileSync('xvfb-run', ['-a', '-s', '-screen 0 1600x1000x24', BIN, '--load-dir-res', `--path=${DIR}`], { cwd: DIR, timeout: 240000, stdio: ['ignore', 'pipe', 'pipe'] }); }
catch (e) { console.error('exe thoát lỗi / quá giờ:', e.message.split('\n')[0]); }
const resFile = path.join(DIR, 'e2e-result.json');
if (!fs.existsSync(resFile)) { console.error('✗ Không có e2e-result.json — app không chạy tới cuối.'); process.exit(1); }
const R = JSON.parse(fs.readFileSync(resFile, 'utf8'));
console.log(`E2E exe (${mode}) — ${Math.round((Date.now() - t0) / 1000)} s, dữ liệu ở ${R.dataDir}`);
for (const s of R.steps) console.log(`  ${s.name === 'alert' ? 'ℹ' : s.ok ? '✓' : '✗'} ${s.name}${s.info ? ' — ' + s.info : ''}`);
console.log(R.ok ? '✓ Đạt' : '✗ Có bước không đạt'); process.exit(R.ok ? 0 : 1);
