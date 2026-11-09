'use strict';
/* Lượt 6 — giao diện Calo trong ngày (jsdom, bản đã build): dòng kcal mỗi ngày, thẻ Calo ngày, chi tiết ngày + ghi đè tại chỗ,
 * phần Năng lượng trong hồ sơ, biểu đồ Analytics, không ghi vào actual.calories, hai người dùng khác số. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const C = require('../src/core/utils.js');
const ROOT = path.join(__dirname, '..');
const wait = ms => new Promise(r => setTimeout(r, ms));
const TODAY = C.ymd(new Date()), MON = C.mondayYmd(TODAY);
const AGE35 = `${new Date().getFullYear() - 35}-01-01`; // 35 tuổi (sinh ngày 1/1)
const PROFILE = { sex: 'male', heightCm: '175', birthDate: AGE35, weightKg: 80 };
const weekOf = (mon, byDate) => ({ label: 'T', days: Array.from({ length: 7 }, (_, i) => { const date = C.addDaysYmd(mon, i); return { dow: C.DAYS[i], date, workouts: byDate[date] || [] }; }) });
const RUN = { id: 'run1', workoutName: 'Easy 10K', planKm: 10, planMinutes: 60, description: '', actual: { status: 'done', km: 10, minutes: 60, fatigue: '', calories: '', note: '', segments: [] } };

function open(data) {
  const errors = [];
  const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message)); vc.on('error', e => errors.push(String(e)));
  const html = fs.readFileSync(path.join(ROOT, 'dist/web/T17_runtracker.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/', virtualConsole: vc, pretendToBeVisual: true, beforeParse(w) {
    w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.DecompressionStream = DecompressionStream;
    w.alert = m => errors.push('alert: ' + m); w.confirm = () => true; w.prompt = () => ''; w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {};
    if (data) w.localStorage.setItem('runplan-tracker-v1', JSON.stringify(data));
  } });
  return { w: dom.window, doc: dom.window.document, errors };
}
const json = (w, e) => JSON.parse(w.eval(`JSON.stringify(${e})`));
const setVal = (w, el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
const stored = w => JSON.parse(w.localStorage.getItem('runplan-tracker-v1'));

test('lịch + thẻ Calo ngày: nền 2.241 + chạy 800 = 3.041; chi tiết ngày; ghi đè tại chỗ rồi về tự tính', async () => {
  const { w, doc, errors } = open({ weeks: [weekOf(MON, { [TODAY]: [RUN] })], profile: PROFILE }); await wait(300);
  const chip = doc.querySelector(`.day-kcal[data-energy-date="${TODAY}"]`); assert.ok(chip, 'có dòng kcal trong ngày');
  assert.match(chip.textContent, /3\.041/);
  const card = doc.getElementById('energyWeek').textContent;
  assert.match(card, /3\.041/); assert.match(card, /2\.241 \+ 800/); assert.match(card, /không phải tư vấn dinh dưỡng/i);
  assert.equal(doc.querySelectorAll('#energyWeek .en-row').length, 7);

  chip.click(); await wait(20);
  const m = doc.getElementById('energyDayModal'); assert.ok(m.classList.contains('show'));
  const body = doc.getElementById('enDayBody').textContent;
  assert.match(body, /Mifflin–St Jeor/); assert.match(body, /1\.724/); assert.match(body, /tự tính/); assert.match(body, /1,0 kcal\/kg\/km/); assert.match(body, /3\.041/);
  assert.ok(doc.getElementById('enDayReset').disabled);

  setVal(w, doc.getElementById('enDayInput'), '2500'); doc.getElementById('enDaySave').click(); await wait(30);
  assert.equal(stored(w).profile.energy.overrides[TODAY], 2500);
  assert.match(doc.getElementById('enDayBody').textContent, /ghi đè ngày/); assert.match(doc.getElementById('enDayBody').textContent, /3\.300/);
  assert.match(doc.querySelector(`.day-kcal[data-energy-date="${TODAY}"]`).textContent, /3\.300/);
  assert.ok(doc.querySelector(`.day-kcal[data-energy-date="${TODAY}"]`).classList.contains('edited'));
  assert.match(doc.getElementById('energyWeek').textContent, /ghi đè ngày/);

  doc.getElementById('enDayReset').click(); await wait(30);
  assert.deepEqual(stored(w).profile.energy.overrides, {});
  assert.match(doc.querySelector(`.day-kcal[data-energy-date="${TODAY}"]`).textContent, /3\.041/);
  // không bao giờ ghi vào actual.calories
  assert.equal(stored(w).weeks.flatMap(x => x.days).flatMap(d => d.workouts).find(x => x.id === 'run1').actual.calories, '');
  assert.deepEqual(errors, []);
});

test('thiếu dữ liệu: nhắc ô còn thiếu, không đoán; người dùng chưa thiết lập → lưu hồ sơ không thêm energy', async () => {
  const { w, doc, errors } = open({ weeks: [weekOf(MON, {})], profile: { weightKg: 70 } }); await wait(300);
  assert.match(doc.getElementById('energyWeek').textContent, /thiếu chiều cao, ngày sinh \(tuổi\), giới tính/);
  assert.match(doc.querySelector(`.day-kcal[data-energy-date="${TODAY}"]`).textContent, /kcal \?/);
  w.T17Profile.open(); await wait(10);
  doc.getElementById('profileForm').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true })); await wait(20);
  assert.equal(stored(w).profile.energy, undefined);
  assert.ok(!stored(w).features || !stored(w).features.energy);
  assert.deepEqual(errors, []);
});

test('Hồ sơ › Năng lượng: xem trước BMR/nền, PAL tự nhập, số cố định, ghi đè liệt kê, “Về giá trị tự tính”', async () => {
  const { w, doc, errors } = open({ weeks: [weekOf(MON, {})], profile: { ...PROFILE, energy: { overrides: { '2026-01-02': 2400 } } } }); await wait(300);
  w.T17Profile.open(); await wait(10);
  const pv = () => doc.getElementById('pfEnPreview').textContent;
  assert.match(pv(), /1\.724/); assert.match(pv(), /2\.241/); assert.match(pv(), /tự tính/);
  assert.match(doc.getElementById('pfEnOverrides').textContent, /2\.400/);
  setVal(w, doc.getElementById('pfEnPalSel'), 'custom'); setVal(w, doc.getElementById('pfEnPal'), '1,5');
  assert.match(pv(), /2\.586/); // 1723,75 × 1,5
  setVal(w, doc.getElementById('pfEnPal'), '2,4'); assert.match(pv(), /1,1–2,0/);
  doc.getElementById('profileForm').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true })); await wait(20);
  assert.ok(errors.some(e => /1,1–2,0/.test(e)), 'chặn PAL ngoài khoảng'); errors.length = 0;
  setVal(w, doc.getElementById('pfEnPal'), '1,5');
  setVal(w, doc.getElementById('pfEnMode'), 'manual'); setVal(w, doc.getElementById('pfEnManual'), '2150');
  assert.match(pv(), /2\.150/); assert.match(pv(), /bạn đã sửa/);
  doc.getElementById('profileForm').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true })); await wait(20);
  let e = stored(w).profile.energy; assert.equal(e.mode, 'manual'); assert.equal(e.baselineKcalManual, 2150); assert.equal(e.pal, 1.5); assert.equal(e.overrides['2026-01-02'], 2400);
  assert.equal(stored(w).features.energy, 1);
  assert.match(doc.getElementById('energyWeek').textContent, /2\.150/); assert.match(doc.getElementById('energyWeek').textContent, /bạn đã sửa/);
  w.T17Profile.open(); await wait(10);
  doc.getElementById('pfEnReset').click(); assert.match(pv(), /2\.241/);
  doc.getElementById('profileForm').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true })); await wait(20);
  e = stored(w).profile.energy; assert.equal(e.mode, 'auto'); assert.equal(e.baselineKcalManual, null); assert.equal(e.pal, 1.3); assert.deepEqual(e.overrides, {});
  assert.deepEqual(errors, []);
});

test('Analytics: biểu đồ cột chồng nền + tập kèm trung bình (cả khi chưa có buổi chạy nào)', async () => {
  const { w, doc, errors } = open({ weeks: [weekOf(MON, { [TODAY]: [RUN] })], profile: PROFILE }); await wait(300);
  doc.getElementById('tabAnalytics').click(); await wait(40);
  const card = doc.getElementById('anEnergy'); assert.ok(card, 'có thẻ calo');
  assert.match(card.textContent, /Calo mỗi ngày/); assert.match(card.textContent, /TB/); assert.match(card.textContent, /không phải tư vấn/i);
  assert.ok(card.querySelectorAll('svg rect[fill="#eb6834"]').length >= 1, 'có cột tập');
  assert.ok(card.querySelectorAll('svg rect[fill="#9fb9da"]').length >= 7, 'có cột nền');
  doc.querySelector('#anRange [data-weeks="52"]').click(); await wait(30);
  assert.match(doc.getElementById('anEnergy').textContent, /trung bình mỗi ngày của tuần/);
  const empty = open({ weeks: [weekOf(MON, {})], profile: PROFILE }); await wait(300);
  empty.doc.getElementById('tabAnalytics').click(); await wait(40);
  assert.ok(empty.doc.getElementById('anEnergy')); assert.match(empty.doc.getElementById('anEnergy').textContent, /2\.241/);
  assert.deepEqual(errors, []); assert.deepEqual(empty.errors, []);
});

test('hai người dùng: số calo khác nhau, ghi đè không lẫn', async () => {
  const { w, doc, errors } = open({ weeks: [weekOf(MON, { [TODAY]: [RUN] })], profile: PROFILE }); await wait(300);
  const u = await w.T17Platform.createUser('Lan'); await w.T17UserUI.switchTo(u.id); await wait(50);
  w.eval(`db.profile = { sex: 'female', heightCm: '165', birthDate: '${new Date().getFullYear() - 30}-01-01', weightKg: 60 }; db.weeks = [${JSON.stringify(weekOf(MON, { [TODAY]: [RUN] }))}]; saveDb(); render();`); await wait(30);
  assert.match(doc.querySelector(`.day-kcal[data-energy-date="${TODAY}"]`).textContent, /2\.316/); // 1320,25 × 1,3 + 600
  doc.querySelector(`.day-kcal[data-energy-date="${TODAY}"]`).click(); await wait(10);
  setVal(w, doc.getElementById('enDayInput'), '1900'); doc.getElementById('enDaySave').click(); await wait(30);
  w.T17EnergyUI.closeDay();
  await w.T17UserUI.switchTo('main'); await wait(50);
  assert.match(doc.querySelector(`.day-kcal[data-energy-date="${TODAY}"]`).textContent, /3\.041/);
  assert.equal(w.eval('db.profile.energy === undefined'), true);
  assert.deepEqual(errors, []);
});
