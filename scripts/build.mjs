#!/usr/bin/env node
/* Build T17 RunTracker.
 *   node scripts/build.mjs          → dist/web/T17_runtracker.html (1 file, chạy bằng trình duyệt)
 *                                   → resources/ (cho Neutralino: index.html + js/neutralino.js + icons)
 * Không cần bundler: các module là classic script, được nhúng (inline) theo đúng thứ tự.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const rd = p => fs.readFileSync(path.join(ROOT, p), 'utf8');
const pkg = JSON.parse(rd('package.json'));
const VERSION = pkg.version;

// Thứ tự nạp: core (thuần) → thư viện I/O → platform → app → FIT UI
const MODULES = [
  'src/core/utils.js',
  'src/core/legacy.js',
  'src/core/excel-plan.js',
  'src/core/athlete.js',
  'src/core/load.js',
  'src/core/fit-workout.js',
  'src/lib/xlsx.js',
  'src/lib/fit-decoder.js',
  'src/platform/platform.js',
  'src/app/dialogs.js',
  'src/app/app.js',
  'src/app/fit-ui.js',
  'src/app/analytics.js',
  'src/app/profile.js',
];

function inlineScript(file) {
  const code = rd(file);
  if (/<\/script/i.test(code)) throw new Error(`${file} chứa chuỗi </script>, không thể nhúng inline.`);
  return `<script data-module="${file}">\n${code}</script>`;
}

function render(target) {
  const iconB64 = fs.readFileSync(path.join(ROOT, 'assets/appIcon.png')).toString('base64');
  const scripts = [];
  if (target === 'desktop') scripts.push('<script src="js/neutralino.js"></script>');
  scripts.push(...MODULES.map(inlineScript));
  let body = rd('src/body.html').replace(/id="appVersionLabel">v[0-9.]+</, `id="appVersionLabel">v${VERSION}<`);
  let app = rd('src/index.template.html');
  const map = { VERSION, TARGET: target, ICON: `data:image/png;base64,${iconB64}`, CSS: rd('src/styles/app.css').trim(), BODY: body.trim(), SCRIPTS: scripts.join('\n') };
  app = app.replace(/\{\{(\w+)\}\}/g, (_, k) => { if (!(k in map)) throw new Error('Thiếu placeholder ' + k); return map[k]; });
  // Đồng bộ APP_VERSION trong app.js với package.json
  app = app.replace(/const APP_VERSION='[^']*';/, `const APP_VERSION='${VERSION}';`);
  return app;
}

function write(rel, content) { const p = path.join(ROOT, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); return p; }

const web = render('web');
write('dist/web/T17_runtracker.html', web);
write('resources/index.html', render('desktop'));

// Neutralino client library (lấy từ npm, khỏi cần `neu update` cho phần này)
const libCandidates = ['node_modules/@neutralinojs/lib/dist/neutralino.js'];
const lib = libCandidates.map(p => path.join(ROOT, p)).find(p => fs.existsSync(p));
if (lib) { fs.mkdirSync(path.join(ROOT, 'resources/js'), { recursive: true }); fs.copyFileSync(lib, path.join(ROOT, 'resources/js/neutralino.js')); }
else console.warn('! Chưa có @neutralinojs/lib — chạy `npm install` trước khi build exe.');
fs.mkdirSync(path.join(ROOT, 'resources/icons'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'assets/appIcon.png'), path.join(ROOT, 'resources/icons/appIcon.png'));

// Giữ neutralino.config.json cùng version
const cfgPath = path.join(ROOT, 'neutralino.config.json');
const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
if (cfg.version !== VERSION) { cfg.version = VERSION; fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + '\n'); }

console.log(`✔ T17 RunTracker v${VERSION}`);
console.log(`  web     : dist/web/T17_runtracker.html (${(web.length / 1024).toFixed(0)} KB)`);
console.log(`  desktop : resources/index.html${lib ? ' + js/neutralino.js' : ''}`);
