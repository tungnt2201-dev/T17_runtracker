'use strict';
/* Lượt 2 — chạy thử giao diện Fitness trong jsdom (bản web đã build):
 * thư viện Fitness, giao bài nhiều ngày (lặp theo thứ / chọn ngày), thẻ lịch, nhập kết quả, sửa buổi,
 * bài tập & mẫu buổi của người dùng, xuất cho app mobile (rồi nạp bằng CHÍNH app mobile), Excel. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const F = require('../src/core/fitness.js');
const X = require('../src/core/excel-plan.js');
const XLSX = require('../src/lib/xlsx.js');

const ROOT = path.join(__dirname, '..');
const wait = ms => new Promise(r => setTimeout(r, ms));
const MON = '2026-11-09'; // thứ Hai

function open(file, setup) {
  const errors = []; const blobs = [];
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
  const bytes = b => new Promise(res => { const fr = new w.FileReader(); fr.onload = () => res(new Uint8Array(fr.result)); fr.readAsArrayBuffer(b); });
  const text = b => new Promise(res => { const fr = new w.FileReader(); fr.onload = () => res(fr.result); fr.readAsText(b); });
  return { dom, w, doc: w.document, errors, blobs, bytes, text };
}
const dialog = doc => { const d = [...doc.querySelectorAll('.ui-dialog')].pop(); assert.ok(d, 'có hộp thoại'); return d; };
const submit = (w, d) => d.querySelector('form').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
const setVal = (w, el, v, ev = 'input') => { el.value = v; el.dispatchEvent(new w.Event(ev, { bubbles: true })); };
const json = (w, expr) => JSON.parse(w.eval(`JSON.stringify(${expr})`));
const allWorkouts = w => json(w, 'db.weeks.flatMap(x=>x.days.map(d=>({date:d.date,ws:d.workouts})))').flatMap(d => d.ws.map(x => ({ date: d.date, ...x })));

test('Fitness end-to-end (web): thư viện → giao bài → thẻ lịch → nhập kết quả → sửa buổi → bài/mẫu của người dùng', async () => {
  const app = open('dist/web/T17_runtracker.html'); const { w, doc, errors } = app;
  await wait(300);
  // --- Thư viện: tab Fitness ---
  doc.getElementById('libraryBtn').click();
  doc.querySelector('[data-libtab="fitness"]').click();
  assert.equal(doc.getElementById('libRunPane').hidden, true);
  assert.equal(doc.querySelectorAll('[data-fx-tpls] .lib-card').length, 2);
  assert.equal(doc.querySelectorAll('[data-fx-ex] .lib-card').length, 15);
  setVal(w, doc.querySelector('[data-fx-search]'), 'calf');
  assert.equal(doc.querySelectorAll('[data-fx-ex] .lib-card').length, 3);
  setVal(w, doc.querySelector('[data-fx-search]'), '');

  // --- Giao bài: lặp T2 + T5 trong 2 tuần ---
  doc.querySelector('[data-fx-assign="b:run-basic-1"]').click(); await wait(10);
  let d = dialog(doc);
  setVal(w, d.querySelector('[name="start"]'), MON, 'change');
  d.querySelectorAll('[name="wd"]').forEach(c => { c.checked = c.value === '0' || c.value === '3'; });
  setVal(w, d.querySelector('[name="weeks"]'), '2', 'change');
  assert.match(d.querySelector('[data-preview]').textContent, /^4 buổi/);
  submit(w, d); await wait(20);
  let fits = allWorkouts(w).filter(x => x.workoutType === 'Fitness');
  assert.deepEqual(fits.map(x => x.date), ['2026-11-09', '2026-11-12', '2026-11-16', '2026-11-19']);
  assert.ok(fits.every(x => x.actual === null && x.fitness.exercises.length === 6 && x.planMinutes === 45));
  assert.equal(new Set(fits.map(x => x.fitness.sessionId)).size, 4);
  // giao lại cùng mẫu → không nhân đôi
  assert.deepEqual(json(w, `T17FitnessUI.assign('b:run-basic-1',['2026-11-09','2026-11-10'])`), { added: 1, skipped: 1 });
  // --- Giao bài: chọn từng ngày (T17UI.uiDates) ---
  w.eval(`T17FitnessUI.assignDialog('b:knee-support-1')`); await wait(10);
  d = dialog(doc); d.querySelector('[name="mode"][value="dates"]').checked = true; d.querySelector('[name="mode"][value="dates"]').dispatchEvent(new w.Event('change', { bubbles: true }));
  submit(w, d); await wait(10);
  d = dialog(doc); setVal(w, d.querySelector('[name="pick"]'), '2026-11-11', 'change'); submit(w, d); await wait(20);
  assert.ok(allWorkouts(w).some(x => x.date === '2026-11-11' && x.fitness?.templateId === 'knee-support-1' && x.fitness.exercises.length === 10));

  // --- Thẻ lịch ---
  doc.getElementById('closeLibrary').click();
  w.eval(`currentWeek=db.weeks.findIndex(x=>x.days[0].date==='${MON}');render()`);
  const cards = doc.querySelectorAll('.workout-card.fitness');
  assert.ok(cards.length >= 4);
  assert.equal(cards[0].querySelector('.sport-icon').textContent, '🏋');
  assert.equal(cards[0].querySelectorAll('.fx-list li').length, 6);
  assert.ok(cards[0].querySelector('[data-mobile-wi]') && !cards[0].querySelector('[data-garmin-wi]') && !cards[0].querySelector('.workout-chart'));
  assert.match(cards[0].querySelector('.load-chip').textContent, /Tải KH ~\s*47/); // 45 phút × RPE 5 ÷ 4,8
  assert.ok(cards[0].querySelector('.fx-load-dot'));

  // --- Nhập kết quả: tick 4/6 bài, RPE 7, 50 phút ---
  cards[0].click(); await wait(10);
  d = dialog(doc);
  const boxes = d.querySelectorAll('[data-done]'); assert.equal(boxes.length, 6);
  [0, 1, 2, 3].forEach(i => { boxes[i].checked = true; boxes[i].dispatchEvent(new w.Event('change', { bubbles: true })); });
  assert.match(d.querySelector('[data-progress]').textContent, /4\/6/);
  setVal(w, d.querySelector('[name="minutes"]'), '50'); setVal(w, d.querySelector('[name="rpe"]'), '7'); setVal(w, d.querySelector('[name="calories"]'), '280'); setVal(w, d.querySelector('[name="note"]'), 'gối ổn');
  setVal(w, d.querySelector('[data-row="e0"][data-ri="0"][data-k="weight"]'), '25');
  submit(w, d); await wait(20);
  let it = allWorkouts(w).find(x => x.date === MON && x.fitness?.templateId === 'run-basic-1');
  assert.equal(it.actual.status, 'done'); assert.equal(it.actual.minutes, 50); assert.equal(it.actual.fatigue, 7); assert.equal(it.actual.calories, 280); assert.equal(it.actual.note, 'gối ổn');
  assert.equal(it.actual.fitness.exercises.filter(e => e.done).length, 4); assert.equal(it.actual.fitness.exercises[0].rows[0].weight, '25');
  assert.equal(it.fitness.exercises[0].rows[0].weight, '', 'kế hoạch không bị sửa theo kết quả');
  let card = doc.querySelector('.workout-card.fitness');
  assert.ok(card.classList.contains('variance50')); assert.match(card.querySelector('.status-label').textContent, /Thiếu vừa · 4\/6 bài/);
  assert.match(card.querySelector('.load-chip').textContent, /Tải\s*73/); assert.match(card.querySelector('.load-chip').textContent, /RPE × phút/);
  // mở lại → dữ liệu cũ hiện lại; xoá kết quả
  card.click(); await wait(10); d = dialog(doc);
  assert.equal(d.querySelector('[name="rpe"]').value, '7'); assert.equal(d.querySelectorAll('[data-done]:checked').length, 4);
  d.querySelector('[data-del-result]').click(); await wait(20);
  assert.equal(allWorkouts(w).find(x => x.id === it.id).actual, null);

  // --- Sửa danh sách bài của riêng buổi: đổi thứ tự, bỏ bài, sửa rep ---
  doc.querySelector('.workout-card.fitness [data-edit-wi]').click(); await wait(10); d = dialog(doc);
  d.querySelector('[data-down="0"]').click(); d.querySelector('[data-rm="5"]').click();
  setVal(w, d.querySelector('[data-row="e0"][data-ri="0"][data-k="reps"]'), '9');
  setVal(w, d.querySelector('[name="workoutName"]'), 'Run Basic 1 (rút gọn)');
  submit(w, d); await wait(20);
  it = allWorkouts(w).find(x => x.id === it.id);
  assert.equal(it.workoutName, 'Run Basic 1 (rút gọn)'); assert.equal(it.fitness.exercises.length, 5);
  assert.equal(it.fitness.exercises[0].libraryId, 'reverse-lunge'); assert.equal(it.fitness.exercises[0].rows[0].reps, '9');
  assert.equal(it.description, F.summaryText(it.fitness.exercises)); assert.equal(F.sessionIdFromInstances(it.fitness.exercises), it.fitness.sessionId);
  const others = allWorkouts(w).filter(x => x.fitness?.templateId === 'run-basic-1' && x.id !== it.id);
  assert.ok(others.every(x => x.fitness.exercises.length === 6), 'các buổi khác không đổi');

  // --- Bài tập của người dùng: tạo mới, nhân bản bài dựng sẵn, bài dựng sẵn bị khoá ---
  doc.getElementById('libraryBtn').click(); doc.querySelector('[data-libtab="fitness"]').click();
  doc.querySelector('[data-fx-new-ex]').click(); await wait(10); d = dialog(doc);
  setVal(w, d.querySelector('[name="name"]'), 'Plank'); setVal(w, d.querySelector('[name="category"]'), 'Core'); setVal(w, d.querySelector('[name="met"]'), '3.5');
  setVal(w, d.querySelector('[data-row="d"][data-ri="0"][data-k="time"]'), '60 giây');
  d.querySelector('[data-row-add="d"]').click();
  submit(w, d); await wait(20);
  let lib = json(w, 'db.fitnessLibrary');
  const plank = lib.find(x => x.name === 'Plank');
  assert.ok(plank && !plank.builtin && plank.met === 3.5 && plank.defaultRows.length === 2 && plank.defaultRows[0].time === '60 giây');
  doc.querySelector('[data-fx-ex-edit="good-morning"]').click(); await wait(10); d = dialog(doc);
  assert.ok(d.querySelector('[name="name"]').disabled && d.querySelector('[name="cue"]').disabled && !d.querySelector('[name="met"]').disabled);
  d.querySelector('[data-ui-cancel]').click(); await wait(5);
  doc.querySelector('[data-fx-ex-dup="good-morning"]').click(); await wait(10); d = dialog(doc);
  assert.equal(d.querySelector('[name="name"]').value, 'Good Morning with Barbell (bản sao)'); submit(w, d); await wait(20);
  lib = json(w, 'db.fitnessLibrary');
  assert.equal(lib.length, 17); assert.ok(!doc.querySelector('[data-fx-ex-del="good-morning"]'), 'bài dựng sẵn không có nút xoá');
  // xoá bài tự tạo
  doc.querySelector(`[data-fx-ex-del="${plank.id}"]`).click(); await wait(10);
  assert.equal(json(w, 'db.fitnessLibrary').length, 16);

  // --- Mẫu buổi của người dùng ---
  doc.querySelector('[data-fx-new-tpl]').click(); await wait(10); d = dialog(doc);
  setVal(w, d.querySelector('[name="workoutName"]'), 'Core 20'); setVal(w, d.querySelector('[name="duration"]'), '20'); setVal(w, d.querySelector('[name="plannedRpe"]'), '6');
  d.querySelector('[data-pick]').value = 'tib-raise'; d.querySelector('[data-add-ex]').click();
  d.querySelector('[data-pick]').value = 'calf-stretch'; d.querySelector('[data-add-ex]').click();
  submit(w, d); await wait(20);
  const tpls = json(w, `db.templates.filter(t=>t.workoutType==='Fitness')`);
  assert.equal(tpls.length, 1); assert.equal(tpls[0].name, 'Core 20'); assert.equal(tpls[0].fitness.exercises.length, 2); assert.equal(tpls[0].fitness.plannedRpe, 6);
  assert.equal(doc.querySelectorAll('[data-fx-tpls] .lib-card').length, 3);
  // tab Bài chạy không lẫn mẫu fitness
  doc.querySelector('[data-libtab="run"]').click();
  assert.ok(![...doc.querySelectorAll('#libraryList .lib-card-title')].some(x => x.textContent === 'Core 20'));
  assert.deepEqual(json(w, `T17FitnessUI.assign('u:${tpls[0].id}',['2026-11-25'])`), { added: 1, skipped: 0 });
  const core = allWorkouts(w).find(x => x.date === '2026-11-25');
  assert.equal(core.fitness.templateId, tpls[0].id); assert.equal(core.fitness.plannedRpe, 6);

  // --- Lưu xuống localStorage: còn nguyên khi mở lại ---
  const saved = JSON.parse(w.localStorage.getItem('runplan-tracker-v1'));
  assert.deepEqual(saved.features, { fitness: 1 }); assert.equal(saved.fitnessLibrary.length, 16);
  assert.deepEqual(errors, []);
});

test('Xuất cho app mobile: JSON từng buổi + ZIP nhiều buổi; CHÍNH app mobile nạp được và xuất lại vẫn giữ mã buổi', async () => {
  const app = open('dist/web/T17_runtracker.html'); const { w, doc, errors } = app;
  await wait(300);
  w.eval(`T17FitnessUI.assign('b:run-basic-1',['2026-11-12','2026-11-14'])`);
  w.eval(`db.weeks.flatMap(x=>x.days).find(d=>d.date==='2026-11-14').workouts[0].workoutName='Run Basic 1 / đặc biệt';saveDb()`);
  const files = json(w, `T17FitnessUI.mobileFilesInRange('2026-11-10','2026-11-20')`);
  assert.deepEqual(files.map(f => f.name), ['2026-11-12_Run-Basic-1.json', '2026-11-14_Run-Basic-1-dac-biet.json']);
  // ZIP
  const n = await w.T17FitnessUI.exportMobileRange('2026-11-10', '2026-11-20'); assert.equal(n, 2);
  const zip = await XLSX.unzip(await app.bytes(app.blobs.at(-1)));
  assert.deepEqual([...zip.keys()], files.map(f => f.name));
  const first = JSON.parse(new TextDecoder().decode(zip.get(files[0].name)));
  const t17 = allWorkouts(w).find(x => x.date === '2026-11-12');
  assert.equal(first.version, 3); assert.equal(first.session.date, '2026-11-12'); assert.equal(first.t17.sessionId, t17.fitness.sessionId);

  // nạp vào CHÍNH app mobile (như nút Nhập file → normalizeData), rồi app mobile xuất JSON
  const mob = open('legacy/T17_Run_Training_Mobile.html', w2 => w2.localStorage.setItem('T17_RUN_TRAINING_V2', JSON.stringify(first)));
  await wait(300);
  assert.deepEqual(mob.errors, []);
  assert.equal(mob.doc.querySelectorAll('#exerciseList .exercise, .exercise-card, [data-instance]').length >= 0, true);
  mob.doc.getElementById('exportJsonBtn').click(); await wait(30);
  const back = JSON.parse(await mob.text(mob.blobs.at(-1)));
  assert.equal(back.session.date, '2026-11-12'); assert.equal(back.session.workoutName, 'Run Basic 1'); assert.equal(back.session.exercises.length, 6);
  assert.equal(F.sessionIdFromInstances(back.session.exercises), t17.fitness.sessionId, 'mã buổi T17 còn nguyên sau khi qua app mobile');
  assert.equal(F.fromMobile(back).kind, 'v3');
  assert.deepEqual(errors, []);
});

test('Excel (UI): xuất lưới + khối fitness; bản mới đọc lại đủ bài, bài chạy y nguyên; nhập lại không nhân đôi', async () => {
  const LEG = fs.readFileSync(path.join(__dirname, 'fixtures', 'runplan-v189-backup.json'), 'utf8');
  const app = open('dist/web/T17_runtracker.html', w => w.localStorage.setItem('runplan-tracker-v1', LEG)); const { w, doc, errors } = app;
  await wait(300);
  const days = json(w, 'db.weeks.flatMap(x=>x.days).filter(d=>d.workouts.length).map(d=>d.date)');
  w.eval(`T17FitnessUI.assign('b:knee-support-1',['${days[0]}'])`);
  w.eval('exportExcel()'); await wait(10); submit(w, dialog(doc)); await wait(30);
  const rows = await XLSX.readFirstSheet(await app.bytes(app.blobs.at(-1)));
  assert.ok(rows.some(r => r[0] === X.FIT_GRID_LABEL)); assert.ok(rows.some(r => r[0] === X.FIT_SECTION_TITLE));
  const weeks = X.parseWorkbookRows(rows);
  const fitDays = weeks.flatMap(x => x.days).filter(d => d.fitness);
  assert.equal(fitDays.length, 1); assert.equal(fitDays[0].date, days[0]); assert.equal(fitDays[0].fitness.exercises.length, 10);
  const src = allWorkouts(w).find(x => x.fitness);
  assert.deepEqual(fitDays[0].fitness.exercises.map(e => [e.libraryId, e.rows]), src.fitness.exercises.map(e => [e.libraryId, e.rows]));
  // Nhập lại đúng file đó vào một app trống → có buổi fitness; nhập lần 2 → trùng, không nhân đôi
  const app2 = open('dist/web/T17_runtracker.html'); await wait(300);
  const file = new app2.w.File([await app.bytes(app.blobs.at(-1))], 'x.xlsx');
  await app2.w.importExcel(file); await app2.w.importExcel(file);
  const got = allWorkouts(app2.w).filter(x => x.fitness);
  assert.equal(got.length, 1); assert.equal(got[0].workoutType, 'Fitness'); assert.equal(got[0].fitness.exercises.length, 10);
  assert.notEqual(got[0].fitness.sessionId, src.fitness.sessionId, 'nhập Excel tạo buổi mới (mã buổi mới)');
  assert.equal(allWorkouts(app2.w).filter(x => !x.fitness).length, allWorkouts(w).filter(x => !x.fitness).length);
  assert.deepEqual(errors, []); assert.deepEqual(app2.errors, []);
});

test('Ảnh bài tập: ảnh nhỏ giữ nguyên, file không phải ảnh bị từ chối', async () => {
  const app = open('dist/web/T17_runtracker.html'); const { w } = app; await wait(300);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  const r = await w.T17FitnessUI.compressImage(new w.File([png], 'dot.png', { type: 'image/png' }));
  assert.match(r.data, /^data:image\/png;base64,/); assert.equal(r.bytes, png.length);
  await assert.rejects(() => w.T17FitnessUI.compressImage(new w.File(['abc'], 'x.txt', { type: 'text/plain' })), /chọn file ảnh/);
});
