// Sau `neu build --release --embed-resources`: gom file exe Windows vào release/ với tên có version.
import fs from 'node:fs';
import path from 'node:path';
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const src = path.join('dist', 'T17_runtracker', 'T17_runtracker-win_x64.exe');
if (!fs.existsSync(src)) { console.error('Không thấy ' + src + ' — hãy chạy neu build trước.'); process.exit(1); }
fs.mkdirSync('release', { recursive: true });
const out = path.join('release', `T17_runtracker-v${pkg.version}-win_x64.exe`);
fs.copyFileSync(src, out);
fs.copyFileSync('dist/web/T17_runtracker.html', path.join('release', `T17_runtracker-v${pkg.version}-web.html`));
console.log('✔', out, (fs.statSync(out).size / 1048576).toFixed(1) + ' MB');
