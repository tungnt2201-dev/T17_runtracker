'use strict';
/* Thêm buổi / bài fitness ngay ở khung ngày + kéo thả bài tự do từ Thư viện (jsdom, bản web đã build). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');

const ROOT = path.join(__dirname, '..');
const wait = ms => new Promise(r => setTimeout(r, ms));
function open() {
  const errors = [];
  const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message)); vc.on('error', e => errors.push(String(e)));
  const html = fs.readFileSync(path.join(ROOT, 'dist/web/T17_runtracker.html'), 'utf8').replace('<script src="js/neutralino.js"></script>', '').replace(/<script src="https:\/\/cdnjs[^"]+"><\/script>/, '');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/', virtualConsole: vc, pretendToBeVisual: true, beforeParse(w) {
    w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.DecompressionStream = DecompressionStream;
    w.alert = m => errors.push('alert: ' + m); w.confirm = () => true; w.prompt = () => ''; w.scrollTo = () => {};
    w.HTMLElement.prototype.scrollIntoView = () => {};
  } });
  return { w: dom.window, doc: dom.window.document, errors };
}
const dialog = doc => { const d = [...doc.querySelectorAll('.ui-dialog')].pop(); assert.ok(d, 'có hộp thoại'); return d; };
const json = (w, expr) => JSON.parse(w.eval(`JSON.stringify(${expr})`));
const fitItems = w => json(w, 'db.weeks.flatMap(x=>x.days.flatMap(d=>d.workouts.filter(k=>k.workoutType==="Fitness").map(k=>({date:d.date,...k}))))');
function drag(w, el, type, dt) { const e = new w.Event(type, { bubbles: true, cancelable: true }); e.dataTransfer = dt; el.dispatchEvent(e); return e; }
const DT = () => ({ data: {}, effectAllowed: '', dropEffect: '', setData(k, v) { this.data[k] = v; }, getData(k) { return this.data[k]; } });

test('khung ngày có nút 🏋 Fitness; chọn mẫu → giao đúng ngày đó', async () => {
  const { w, doc, errors } = open(); await wait(300);
  const btn = doc.querySelector('[data-fitness-date]'); assert.ok(btn, 'có nút Fitness trong khung ngày');
  const date = btn.dataset.fitnessDate;
  btn.click(); await wait(20);
  const d = dialog(doc);
  assert.ok(d.querySelectorAll('[data-choice]').length >= 3, 'buổi trống + 2 mẫu dựng sẵn');
  d.querySelectorAll('[data-choice]')[1].click(); await wait(30);
  const items = fitItems(w); assert.equal(items.length, 1); assert.equal(items[0].date, date);
  assert.ok(items[0].fitness.exercises.length > 0); assert.equal(items[0].actual, null);
  assert.deepEqual(errors, []);
});

test('buổi trống từ khung ngày: tạo buổi, mở trình sửa; kéo bài từ Thư viện thả vào thẻ → thêm bài', async () => {
  const { w, doc, errors } = open(); await wait(300);
  const date = doc.querySelector('[data-fitness-date]').dataset.fitnessDate;
  w.eval(`T17FitnessUI.addToDay(${JSON.stringify(date)})`); await wait(20);
  dialog(doc).querySelector('[data-choice="0"]').click(); await wait(40); // buổi trống
  let items = fitItems(w); assert.equal(items.length, 1); assert.equal(items[0].fitness.exercises.length, 0);
  // đóng trình sửa (Huỷ)
  const ed = dialog(doc); const cancel = [...ed.querySelectorAll('button')].find(b => /Huỷ|Hủy|Đóng/.test(b.textContent)); cancel && cancel.click(); await wait(20);

  doc.getElementById('libraryBtn').click(); doc.querySelector('[data-libtab="fitness"]').click();
  const exc = doc.querySelector('[data-fx-ex] .fx-exc'); assert.equal(exc.getAttribute('draggable'), 'true');
  const exId = exc.dataset.fxExid; const dt = DT();
  drag(w, exc, 'dragstart', dt); assert.equal(dt.data['text/plain'], 'fx:' + exId);
  const card = doc.querySelector('.workout-card.fitness'); assert.ok(card);
  const over = drag(w, card, 'dragover', dt); assert.equal(over.defaultPrevented, true);
  assert.ok(doc.querySelector('.workout-card.fitness.fit-drop-target'));
  drag(w, card, 'drop', dt); await wait(20);
  items = fitItems(w); assert.equal(items[0].fitness.exercises.length, 1); assert.equal(items[0].fitness.exercises[0].libraryId, exId);
  assert.match(items[0].fitness.exercises[0].instanceId, new RegExp('^' + items[0].fitness.sessionId + ':1$'));
  assert.equal(doc.querySelector('.fit-drop-target'), null);
  drag(w, exc, 'dragend', dt);
  assert.deepEqual(errors, []);
});

test('thả bài vào ngày chưa có buổi → tạo buổi mới; ngày có 1 buổi chưa tập → thêm vào buổi đó; buổi đã tập → từ chối', async () => {
  const { w, doc, errors } = open(); await wait(300);
  doc.getElementById('libraryBtn').click(); doc.querySelector('[data-libtab="fitness"]').click();
  const exs = [...doc.querySelectorAll('[data-fx-ex] .fx-exc')];
  const col = doc.querySelector('.day-col'); const date = col.dataset.daycolDate;
  const dt = DT();
  drag(w, exs[0], 'dragstart', dt); drag(w, col, 'dragover', dt);
  assert.ok(col.classList.contains('fit-day-drop'));
  drag(w, col, 'drop', dt); await wait(30);
  let items = fitItems(w).filter(x => x.date === date); assert.equal(items.length, 1); assert.equal(items[0].fitness.exercises.length, 1);
  const sid = items[0].fitness.sessionId;
  const col2 = doc.querySelector(`.day-col[data-daycol-date="${date}"]`);
  drag(w, exs[1], 'dragstart', dt); drag(w, col2, 'drop', dt); await wait(30);
  items = fitItems(w).filter(x => x.date === date); assert.equal(items.length, 1);
  assert.equal(items[0].fitness.exercises.length, 2); assert.equal(items[0].fitness.sessionId, sid);
  // buổi đã có kết quả thì không thêm
  w.eval(`(function(){const l=locateDate(${JSON.stringify(date)});l.d.workouts[0].actual={status:'done'};saveDb();render();})()`);
  const ok = w.eval(`T17FitnessUI.addExerciseTo({wi:locateDate(${JSON.stringify(date)}).wi,di:locateDate(${JSON.stringify(date)}).di,ii:0},${JSON.stringify(exs[2].dataset.fxExid)})`);
  assert.equal(ok, false);
  assert.equal(fitItems(w).find(x => x.date === date).fitness.exercises.length, 2);
  assert.deepEqual(errors, []);
});

test('kéo bài chạy (dragRef) không bị ảnh hưởng: thả không có exDrag thì bỏ qua', async () => {
  const { w, doc, errors } = open(); await wait(300);
  const col = doc.querySelector('.day-col'); const dt = DT();
  const over = drag(w, col, 'dragover', dt);
  assert.equal(over.defaultPrevented, false);
  drag(w, col, 'drop', dt); await wait(10);
  assert.equal(fitItems(w).length, 0); assert.deepEqual(errors, []);
});

test('kéo thẻ FIT đã tập (chưa ghép) vào thẻ buổi fitness kế hoạch → ghép kết quả, xoá thẻ FIT', async () => {
  const { w, doc, errors } = open(); await wait(300);
  const date = doc.querySelector('.day-col').dataset.daycolDate;
  w.eval(`(function(){const l=ensureDate(${JSON.stringify(date)});l.d.workouts=l.d.workouts||[];
    l.d.workouts.push({id:genId(),...T17Fitness.addExerciseToPlan(T17Fitness.blankPlan('Gym chân'),T17Fitness.BUILTIN_LIBRARY[0])});
    l.d.workouts.push({id:genId(),workoutName:'Easy run',workoutType:'Easy',planKm:5,planMinutes:'',description:'',actual:null});
    l.d.workouts.push({id:genId(),fitStandalone:true,workoutName:'Garmin FIT · Strength',workoutType:'Custom',planKm:'',planMinutes:'',description:'',actual:{status:'done',km:'',minutes:45,calories:280,avgHr:121,segments:[]}});
    saveDb();render();})()`);
  const fitCard = doc.querySelector('.workout-card[data-fit-standalone="1"]'); assert.ok(fitCard, 'có thẻ FIT riêng');
  const plan = doc.querySelector('.workout-card.fitness'); assert.ok(plan);
  const dt = DT();
  drag(w, fitCard, 'dragstart', dt);
  const over = drag(w, plan, 'dragover', dt); assert.equal(over.defaultPrevented, true);
  assert.ok(plan.classList.contains('fit-drop-target'), 'thẻ fitness được tô viền khi kéo qua');
  drag(w, plan, 'drop', dt); await wait(40);
  const ws = json(w, `locateDate(${JSON.stringify(date)}).d.workouts`);
  assert.equal(ws.length, 2, 'thẻ FIT đã gộp vào buổi');
  const fit = ws.find(x => x.workoutType === 'Fitness');
  assert.equal(fit.actual.status, 'done'); assert.equal(fit.actual.minutes, 45); assert.equal(fit.actual.avgHr, 121);
  assert.equal(fit.actual.fitness.exercises.length, 1); assert.equal(fit.actual.fitness.exercises[0].done, true);
  assert.equal(ws.find(x => x.workoutType === 'Easy').actual, null, 'bài chạy không bị đụng');
  assert.deepEqual(errors, []);
});
