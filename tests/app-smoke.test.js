'use strict';
/* Chạy thử bản build hoàn chỉnh trong jsdom:
 *  - bản web đọc localStorage cũ của RunPlan v1.x
 *  - bản desktop (Neutralino giả lập) lưu file cạnh exe, flush khi đóng cửa sổ, tự phục hồi từ backup
 * Cần `npm run build` trước (script `npm test` đã làm việc đó). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const LEGACY = fs.readFileSync(path.join(__dirname, 'fixtures', 'runplan-v1-legacy-day-fields.json'), 'utf8');
const wait = ms => new Promise(r => setTimeout(r, ms));

function open(file, setup) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(e.message)); vc.on('error', e => errors.push(String(e)));
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8').replace('<script src="js/neutralino.js"></script>', '');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/', virtualConsole: vc, pretendToBeVisual: true, beforeParse(w) {
    w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder;
    w.alert = m => errors.push('alert: ' + m); w.confirm = () => true; w.prompt = () => '';
    w.HTMLElement.prototype.scrollIntoView = () => {};
    setup && setup(w);
  } });
  return { dom, w: dom.window, doc: dom.window.document, errors };
}

function fakeNeutralino(files, handlers) {
  const nf = p => Object.assign(new Error('NE_FS_NOPATHE ' + p), { code: 'NE_FS_NOPATHE' });
  return {
    init: async () => {}, events: { on: (n, f) => { handlers[n] = f; } }, app: { exit: async () => { handlers.exited = true; } },
    os: { getPath: async () => 'C:/Users/u/AppData/Roaming', showSaveDialog: async () => '', open: async () => {}, execCommand: async () => {} },
    filesystem: {
      getStats: async p => { if ([...files.keys()].some(k => k === p || k.startsWith(p + '/')) || files.dirs.has(p)) return {}; throw nf(p); },
      createDirectory: async p => { files.dirs.add(p); }, writeFile: async (p, d) => { files.set(p, d); },
      readFile: async p => { if (!files.has(p)) throw nf(p); return files.get(p); }, remove: async p => { files.delete(p); },
      copy: async (a, b) => { files.set(b, files.get(a)); }, writeBinaryFile: async () => {},
      readDirectory: async d => [...files.keys()].filter(k => k.startsWith(d + '/')).map(k => ({ entry: k.slice(d.length + 1), type: 'FILE' })),
    },
  };
}

test('bản web: đọc dữ liệu localStorage của RunPlan v1.x và nâng cấp lên schema 2', async () => {
  const { w, doc, errors } = open('dist/web/T17_runtracker.html', w => w.localStorage.setItem('runplan-tracker-v1', LEGACY));
  await wait(300);
  assert.deepEqual(errors, []);
  const saved = JSON.parse(w.localStorage.getItem('runplan-tracker-v1'));
  assert.equal(saved.schemaVersion, 2);
  doc.getElementById('tabLog').click();
  assert.equal(doc.querySelectorAll('#logRows .log-row').length, 5);
});

test('bản desktop: lưu file data/ cạnh exe, sao lưu theo ngày, flush khi đóng, phục hồi khi file hỏng', async () => {
  const files = new Map(); files.dirs = new Set(); const handlers = {};
  const setup = (legacy) => w => { w.NL_PORT = 1; w.NL_PATH = 'C:/Apps/T17'; w.NL_OS = 'Windows'; w.Neutralino = fakeNeutralino(files, handlers); if (legacy) w.localStorage.setItem('runplan-tracker-v1', legacy); };
  let app = open('resources/index.html', setup(LEGACY));
  await wait(800);
  assert.deepEqual(app.errors, []);
  const main = 'C:/Apps/T17/data/t17-runtracker.json';
  assert.ok(files.has(main), 'phải tạo file dữ liệu cạnh exe');
  assert.ok([...files.keys()].some(k => /data\/backups\/t17-runtracker-\d{4}-\d{2}-\d{2}\.json$/.test(k)));
  assert.equal(JSON.parse(files.get(main)).schemaVersion, 2);
  app.w.eval("db.weeks[0].days[0].workouts.push({id:'zz',workoutName:'Mới thêm',planKm:3,planMinutes:20,actual:null});saveDb()");
  await handlers.windowClose();
  assert.ok(handlers.exited);
  assert.match(files.get(main), /Mới thêm/);
  files.set(main, '{hỏng');
  app = open('resources/index.html', setup(null));
  await wait(800);
  assert.ok(app.w.eval('db.weeks.some(w=>w.days.some(d=>d.workouts.length))'), 'phải nạp lại từ bản sao lưu');
  assert.match(app.doc.getElementById('supportBox').textContent, /bị lỗi/);
});

test('Analytics + Hồ sơ VĐV + xuất Garmin chạy không lỗi', async () => {
  const days = [];
  for (let i = 0; i < 40; i++) { const d = new Date(Date.UTC(2026, 7, 1 + i)).toISOString().slice(0, 10); days.push({ date: d, workouts: i % 2 ? [] : [{ id: 'a' + i, workoutName: 'Easy', workoutType: 'Easy', planKm: 8, planMinutes: 48, workoutStructure: { warmup: null, cooldown: null, groups: [{ repeats: 1, steps: [{ activity: 'run', mode: 'time', value: 48, paceFrom: '6:00', paceTo: '6:10' }] }] }, actual: { status: 'done', km: 8, minutes: 48, avgHr: 148 } }] }); }
  const blobs = [];
  const { w, doc, errors } = open('dist/web/T17_runtracker.html', w => { w.localStorage.setItem('runplan-tracker-v1', JSON.stringify({ weeks: [{ label: '1', days }] })); w.URL.createObjectURL = b => { blobs.push(b); return 'blob:x'; }; w.URL.revokeObjectURL = () => {}; w.HTMLAnchorElement.prototype.click = function () {}; });
  await wait(300);
  doc.getElementById('tabAnalytics').click(); await wait(30);
  doc.querySelector('#anRange [data-weeks="0"]').click(); await wait(30);
  assert.equal(doc.querySelectorAll('#anBody .an-kpi').length, 6);
  assert.ok(doc.querySelector('#anPmc'));
  assert.match(doc.querySelector('#anBody .an-alert').textContent, /Hồ sơ VĐV chưa đủ/);
  doc.getElementById('anProfileBtn').click();
  for (const [id, v] of [['pfHrRest', '50'], ['pfHrMax', '190'], ['pfLthr', '170'], ['pfPace', '5:15']]) doc.getElementById(id).value = v;
  doc.getElementById('profileForm').dispatchEvent(new w.Event('submit', { cancelable: true })); await wait(30);
  assert.equal(w.eval('db.profile.lthr'), 170);
  assert.ok(![...doc.querySelectorAll('#anBody .an-alert')].some(a => /Hồ sơ VĐV chưa đủ/.test(a.textContent)));
  doc.getElementById('tabCalendar').click();
  w.eval('exportGarminWorkout("Easy", db.weeks[0].days.find(d=>d.workouts.length).workouts[0].workoutStructure)'); await wait(50);
  assert.equal(blobs.length, 1);
  assert.deepEqual(errors, []);
});
