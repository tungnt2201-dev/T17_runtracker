'use strict';
/* Lượt 3 — nhập file app fitness qua giao diện (jsdom, bản đã build): các nút nhập sẵn có, nhiều file + ZIP,
 * hộp xem trước, gắn vào buổi đã giao, nhập lại không nhân đôi, Excel không nhầm, nhiều người dùng + sao lưu trước khi gộp. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const F = require('../src/core/fitness.js');
const XLSX = require('../src/lib/xlsx.js');

const ROOT = path.join(__dirname, '..'), FX = path.join(__dirname, 'fixtures');
const wait = ms => new Promise(r => setTimeout(r, ms));
const fx = f => fs.readFileSync(path.join(FX, f));

function open(file, setup) {
  const errors = [], blobs = [];
  const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message)); vc.on('error', e => errors.push(String(e)));
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8').replace('<script src="js/neutralino.js"></script>', '').replace(/<script src="https:\/\/cdnjs[^"]+"><\/script>/, '');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/', virtualConsole: vc, pretendToBeVisual: true, beforeParse(w) {
    w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.DecompressionStream = DecompressionStream;
    w.alert = m => errors.push('alert: ' + m); w.confirm = () => true; w.prompt = () => ''; w.scrollTo = () => {};
    w.HTMLElement.prototype.scrollIntoView = () => {};
    w.URL.createObjectURL = b => { blobs.push(b); return 'blob:x'; }; w.URL.revokeObjectURL = () => {}; w.HTMLAnchorElement.prototype.click = function () {};
    setup && setup(w);
  } });
  const w = dom.window;
  const text = b => new Promise(res => { const fr = new w.FileReader(); fr.onload = () => res(fr.result); fr.readAsText(b); });
  const bytes = b => new Promise(res => { const fr = new w.FileReader(); fr.onload = () => res(new Uint8Array(fr.result)); fr.readAsArrayBuffer(b); });
  return { w, doc: w.document, errors, blobs, text, bytes };
}
const file = (w, name, data) => new w.File([data], name);
async function pick(w, inputId, files) { const input = w.document.getElementById(inputId); Object.defineProperty(input, 'files', { value: files, configurable: true }); input.dispatchEvent(new w.Event('change')); }
async function waitDialog(doc, ms = 3000) { for (let t = 0; t < ms; t += 20) { const d = [...doc.querySelectorAll('.ui-dialog')].pop(); if (d) return d; await wait(20); } throw new Error('Không thấy hộp thoại'); }
const submit = (w, d) => d.querySelector('form').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
const all = w => JSON.parse(w.eval('JSON.stringify(db.weeks.flatMap(x=>x.days.flatMap(d=>d.workouts.map(it=>({date:d.date,...it})))))'));

test('nút “Nhập bài tập”: nhiều file + ZIP + file hỏng + file bài tập thường → hộp xem trước; nhập lại chỉ báo “đã có”', async () => {
  const app = open('dist/web/T17_runtracker.html'); const { w, doc } = app; await wait(300);
  const zip = XLSX.zipStore([{ name: 'buoi-v2.json', data: fx('fitness-mobile-v2.json').toString('utf8') }, { name: 'ghi-chu.txt', data: 'bỏ qua' }]);
  const files = () => [file(w, 'v3.json', fx('fitness-mobile-v3.json')), file(w, 'v1.json', fx('fitness-mobile-v1-legacy.json')), file(w, 'hong.json', fx('fitness-mobile-broken.json')),
    file(w, 'v3.xlsx', fx('fitness-mobile-v3.xlsx')), file(w, 'tu-app.zip', zip), file(w, 'ke-hoach.json', fx('runplan-plan-export.json'))];
  await pick(w, 'importPlanFile', files());
  let d = await waitDialog(doc);
  assert.match(d.querySelector('.fi-user').textContent, /Người dùng: Tôi · 4 buổi · 1 file lỗi/);
  assert.match(d.querySelector('.fi-errors').textContent, /hong\.json — File JSON bị hỏng/);
  const badges = [...d.querySelectorAll('.fi-badge')].map(b => b.textContent);
  assert.deepEqual(badges, ['Buổi mới', 'Buổi mới', 'Đã có', 'Buổi mới']); // v3, v1, xlsx (trùng v3), v2 trong ZIP
  assert.match(d.textContent, /tu-app\.zip › buoi-v2\.json/);
  submit(w, d); await wait(150);
  let ws = all(w);
  const fit = ws.filter(x => x.workoutType === 'Fitness');
  assert.deepEqual(fit.map(x => x.date).sort(), ['2026-10-30', '2026-11-03', '2026-11-07']);
  assert.ok(fit.every(x => x.actual && x.actual.source === 'fitness-mobile'));
  assert.ok(ws.some(x => x.workoutType !== 'Fitness'), 'file bài tập thường vẫn được gộp như cũ');
  const before = ws.length;
  // nhập lại đúng các file đó
  await pick(w, 'importPlanFile', files().filter(f => f.name !== 'ke-hoach.json'));
  d = await waitDialog(doc);
  assert.ok([...d.querySelectorAll('.fi-badge')].every(b => b.textContent === 'Đã có'));
  submit(w, d); await wait(100);
  assert.equal(all(w).length, before, 'không nhân đôi');
  assert.match(doc.getElementById('toast').textContent, /đã có/);
  assert.deepEqual(app.errors, []);
});

test('nút “Import FIT”: file từ app mobile gắn kết quả vào buổi đã giao (đi khứ hồi qua CHÍNH app mobile)', async () => {
  const app = open('dist/web/T17_runtracker.html'); const { w, doc } = app; await wait(300);
  w.eval(`T17FitnessUI.assign('b:run-basic-1',['2026-11-12'])`);
  const sent = JSON.parse(w.eval(`JSON.stringify(T17FitnessUI.mobileFilesInRange('2026-11-12','2026-11-12'))`))[0];
  const mob = open('legacy/T17_Run_Training_Mobile.html', w2 => { const d = JSON.parse(sent.data); d.session.exercises.forEach((e, i) => { e.done = i !== 2; }); d.session.rpe = '7'; d.session.duration = '50'; w2.localStorage.setItem('T17_RUN_TRAINING_V2', JSON.stringify(d)); });
  await wait(300); mob.doc.getElementById('exportJsonBtn').click(); await wait(30);
  const back = await mob.text(mob.blobs.at(-1));
  await pick(w, 'fitImportFile', [file(w, 'T17_Run_Training_2026-11-12.json', back)]);
  const d = await waitDialog(doc);
  assert.match(d.querySelector('[name="act-0"] option').textContent, /Gắn kết quả vào “Run Basic 1” \(khớp mã buổi\)/);
  submit(w, d); await wait(150);
  const ws = all(w).filter(x => x.date === '2026-11-12');
  assert.equal(ws.length, 1); assert.equal(ws[0].actual.fatigue, 7); assert.equal(ws[0].actual.minutes, 50); assert.deepEqual(F.completion(ws[0]), { done: 5, total: 6, ratio: 5 / 6 });
  assert.deepEqual(app.errors, []); assert.deepEqual(mob.errors, []);
});

test('nút “Import Excel”: Excel của app mobile → nhập fitness; Excel kế hoạch của T17 → luồng cũ, không nhầm', async () => {
  const LEG = fs.readFileSync(path.join(FX, 'runplan-v189-backup.json'), 'utf8');
  const src = open('dist/web/T17_runtracker.html', w => w.localStorage.setItem('runplan-tracker-v1', LEG)); await wait(300);
  src.w.eval('exportExcel()'); submit(src.w, await waitDialog(src.doc)); await wait(50);
  const t17xlsx = await src.bytes(src.blobs.at(-1));
  const app = open('dist/web/T17_runtracker.html'); const { w, doc } = app; await wait(300);
  await pick(w, 'importFile', [file(w, 'T17_RunTracker.xlsx', t17xlsx)]); await wait(300);
  assert.equal(doc.querySelectorAll('.ui-dialog').length, 0, 'Excel kế hoạch không mở hộp nhập fitness');
  const runs = all(w); assert.ok(runs.length > 0 && runs.every(x => x.workoutType !== 'Fitness'));
  await pick(w, 'importFile', [file(w, 'T17_Run_Training_2026-11-07.xlsx', fx('fitness-mobile-v3.xlsx'))]);
  const d = await waitDialog(doc); assert.equal(d.querySelectorAll('.fi-item').length, 1); submit(w, d); await wait(150);
  assert.equal(all(w).filter(x => x.workoutType === 'Fitness').length, 1);
  // nút Khôi phục với file app fitness → gộp (có xem trước), KHÔNG ghi đè toàn bộ
  await pick(w, 'restoreFile', [file(w, 'v1.json', fx('fitness-mobile-v1-legacy.json'))]);
  const d2 = await waitDialog(doc); submit(w, d2); await wait(150);
  assert.equal(all(w).filter(x => x.workoutType === 'Fitness').length, 2); assert.ok(all(w).length > 2, 'dữ liệu cũ còn nguyên');
  assert.deepEqual(app.errors, []);
});

test('nhiều người dùng (exe): chỉ người đang chọn bị đổi; tự sao lưu trước khi gộp vào data/backups', async () => {
  const files = new Map(); files.dirs = new Set(); const handlers = {};
  const nf = p => Object.assign(new Error('NE_FS_NOPATHE ' + p), { code: 'NE_FS_NOPATHE' });
  const N = { init: async () => {}, events: { on: (n, f) => { handlers[n] = f; } }, app: { exit: async () => {} },
    os: { getPath: async () => 'C:/x', showSaveDialog: async () => '', open: async () => {}, execCommand: async () => {} },
    filesystem: { getStats: async p => { if ([...files.keys()].some(k => k === p || k.startsWith(p + '/')) || files.dirs.has(p)) return {}; throw nf(p); },
      createDirectory: async p => { files.dirs.add(p); }, writeFile: async (p, d) => { files.set(p, d); }, readFile: async p => { if (!files.has(p)) throw nf(p); return files.get(p); },
      remove: async p => { files.delete(p); }, copy: async (a, b) => { files.set(b, files.get(a)); }, writeBinaryFile: async () => {},
      readDirectory: async d => [...files.keys()].filter(k => k.startsWith(d + '/')).map(k => ({ entry: k.slice(d.length + 1), type: 'FILE' })) } };
  const FXD = path.join(FX, 't17-v22-multiuser'); const idx = JSON.parse(fs.readFileSync(path.join(FXD, 'users.json'), 'utf8')); const lan = idx.users[1].id;
  for (const rel of ['users.json', 't17-runtracker.json', `users/${lan}.json`]) files.set('C:/T17/data/' + rel, fs.readFileSync(path.join(FXD, rel), 'utf8'));
  const mainBefore = files.get('C:/T17/data/t17-runtracker.json');
  const app = open('resources/index.html', w => { w.NL_PORT = 1; w.NL_PATH = 'C:/T17'; w.NL_OS = 'Windows'; w.Neutralino = N; }); const { w, doc } = app;
  await wait(800);
  assert.equal(w.eval('T17Platform.activeUserId()'), lan);
  await pick(w, 'importPlanFile', [file(w, 'v3.json', fx('fitness-mobile-v3.json'))]);
  const d = await waitDialog(doc); assert.match(d.querySelector('.fi-user').textContent, /Người dùng: Trần Thị Lan/);
  submit(w, d); await wait(200); await w.T17Platform.flush();
  const snaps = [...files.keys()].filter(k => k.startsWith(`C:/T17/data/backups/${lan}-truoc-nhap-fitness-`));
  assert.equal(snaps.length, 1, 'có bản sao trước khi gộp');
  assert.ok(!files.get(snaps[0]).includes('Run Basic 1'), 'bản sao là dữ liệu TRƯỚC khi nhập');
  assert.match(files.get(`C:/T17/data/users/${lan}.json`), /Run Basic 1/);
  assert.equal(files.get('C:/T17/data/t17-runtracker.json'), mainBefore, 'người dùng khác không bị đụng tới');
  // bản sao lưu theo ngày vẫn chạy đúng (không lẫn với bản sao trước khi gộp)
  assert.ok([...files.keys()].some(k => new RegExp(`backups/${lan}-\\d{4}-\\d{2}-\\d{2}\\.json$`).test(k)));
  assert.deepEqual(app.errors, []);
});
