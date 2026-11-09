'use strict';
/* Lượt 5 — Analytics › Cơ thể (jsdom, bản đã build): số điểm, số đường, tiêu đề kết luận, đường mục tiêu, ghi chú,
 * tải tuần cùng trục, so sánh A/B + phím tắt, trạng thái trống, hai người dùng có biểu đồ khác nhau. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = path.join(__dirname, '..');
const wait = ms => new Promise(r => setTimeout(r, ms));
const ymd = d => d.toISOString().slice(0, 10);
const daysAgo = n => ymd(new Date(Date.now() - n * 86400000));

function open(data) {
  const errors = [];
  const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message)); vc.on('error', e => errors.push(String(e)));
  const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'dist/web/T17_runtracker.html'), 'utf8'), { runScripts: 'dangerously', url: 'http://localhost/', virtualConsole: vc, pretendToBeVisual: true, beforeParse(w) {
    w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.alert = m => errors.push('alert: ' + m); w.confirm = () => true; w.HTMLElement.prototype.scrollIntoView = () => {};
    if (data) w.localStorage.setItem('runplan-tracker-v1', JSON.stringify(data));
  } });
  return { w: dom.window, doc: dom.window.document, errors };
}
function bodyData() {
  // 10 tuần: cân nặng giảm dần (sáng + một vài buổi tối), % mỡ, khối cơ 3 lần, vòng eo 2 lần, HR nghỉ 1 lần (→ trống)
  const bm = [];
  for (let i = 70; i >= 0; i -= 7) { bm.push({ date: daysAgo(i), time: '06:30', weightKg: Math.round((70 + i * 0.03) * 10) / 10, bodyFatPct: Math.round((18 + i * 0.02) * 10) / 10 }); }
  bm.push({ date: daysAgo(14), time: '21:00', weightKg: 70.9, note: 'sau tiệc cưới' });
  bm.push({ date: daysAgo(60), muscleKg: 31 }, { date: daysAgo(30), muscleKg: 31.3 }, { date: daysAgo(2), muscleKg: 31.6 });
  bm.push({ date: daysAgo(50), waistCm: 86 }, { date: daysAgo(5), waistCm: 83.5 });
  bm.push({ date: daysAgo(3), hrRest: 51 });
  const runs = [21, 14, 7].map((n, k) => ({ date: daysAgo(n), workouts: [{ id: 'r' + k, workoutName: 'Easy', workoutType: 'Easy', planKm: 8, planMinutes: 50, actual: { status: 'done', km: 8, minutes: 50, fatigue: 5 } }] }));
  return { weeks: [{ label: '1', days: runs }], bodyMetrics: bm, profile: { heightCm: '175', weightGoalKg: '68' } };
}
const openBodyTab = async (w, doc) => { doc.getElementById('tabAnalytics').click(); await wait(20); doc.querySelector('#anSub [data-sub="body"]').click(); await wait(30); };

test('tab Cơ thể: biểu đồ, số điểm, đường TB 7 ngày, mục tiêu, ghi chú, tiêu đề kết luận, tải tuần cùng trục', async () => {
  const { w, doc, errors } = open(bodyData()); await wait(300);
  await openBodyTab(w, doc);
  doc.querySelector('#anRange [data-weeks="12"]').click(); await wait(20);
  const host = doc.getElementById('anBody');
  const wsvg = host.querySelector('svg[data-key="weightKg"]');
  assert.equal(wsvg.getAttribute('data-points'), '11'); // 11 ngày có cân (2 lần trong một ngày gộp thành 1 điểm)
  assert.equal(wsvg.querySelectorAll('.bc-pt').length, 11); assert.equal(wsvg.querySelectorAll('.bc-ma').length, 1); assert.equal(wsvg.querySelectorAll('.bc-goal').length, 1);
  assert.equal(wsvg.querySelectorAll('.bc-note').length, 1, 'đánh dấu lần đo có ghi chú');
  assert.match(host.querySelector('.bc-title[data-key="weightKg"]').textContent, /^Giảm 2,\d kg trong 10 tuần$/);
  assert.ok(host.querySelector('.bc-card[data-key="weightKg"] small .bd-d.good'), 'giảm về mục tiêu 68 kg → màu tốt');
  assert.equal(host.querySelector('svg[data-key="bodyFatPct"]').getAttribute('data-points'), '11');
  assert.match(host.querySelector('.bc-title[data-key="bodyFatPct"]').textContent, /^% mỡ: giảm 1,\d điểm % trong 10 tuần$/);
  assert.equal(host.querySelector('svg[data-key="muscleKg"]').getAttribute('data-points'), '3');
  assert.equal(host.querySelector('svg[data-key="waistCm"]').getAttribute('data-points'), '2');
  assert.ok(!host.querySelector('svg[data-key="hrRest"]') && host.querySelector('.bc-card[data-key="hrRest"] .bc-empty'), 'nhịp tim nghỉ mới 1 lần đo → hướng dẫn thay vì biểu đồ trống');
  assert.equal(host.querySelectorAll('svg.bc-svg').length, 5, '4 biểu đồ đường + 1 biểu đồ tải');
  assert.equal(host.querySelector('.bc-loadsvg').getAttribute('data-bars'), '3');
  // 8 tuần: ít điểm hơn
  doc.querySelector('#anRange [data-weeks="8"]').click(); await wait(20);
  assert.ok(+host.querySelector('svg[data-key="weightKg"]').getAttribute('data-points') < 11);
  // co giãn: viewBox theo bề rộng khung
  assert.match(host.querySelector('svg[data-key="weightKg"]').getAttribute('viewBox'), /^0 0 \d+ 230$/);
  assert.deepEqual(errors, []);
});

test('so sánh hai mốc A/B: bảng cạnh nhau, cột thay đổi có màu theo ý nghĩa, phím tắt', async () => {
  const { w, doc, errors } = open(bodyData()); await wait(300);
  await openBodyTab(w, doc);
  const host = doc.getElementById('anBody');
  let rows = [...host.querySelectorAll('.bc-ab-table tbody tr')];
  assert.ok(rows.length >= 5);
  const wRow = host.querySelector('.bc-ab-table tr[data-key="weightKg"]');
  assert.match(wRow.cells[3].textContent, /▼ -2,\d/); assert.ok(wRow.querySelector('.bd-d.good'));
  assert.ok(host.querySelector('.bc-ab-table tr[data-key="muscleKg"] .bd-d.good'), 'cơ tăng = tốt');
  host.querySelector('[data-ab-preset="d30"]').click(); await wait(20);
  const a = host.querySelector('[data-ab="a"]').value, b = host.querySelector('[data-ab="b"]').value;
  assert.equal(b, daysAgo(0)); assert.equal(a, daysAgo(30));
  const inp = host.querySelector('[data-ab="a"]'); inp.value = daysAgo(49); inp.dispatchEvent(new w.Event('change'));
  await wait(20);
  const waist = doc.querySelector('.bc-ab-table tr[data-key="waistCm"]');
  assert.match(waist.cells[1].textContent, /86/); assert.ok(waist.querySelector('.bd-d.good'));
  doc.querySelector('[data-ab-preset="first"]').click(); await wait(20);
  assert.equal(doc.querySelector('[data-ab="a"]').value, daysAgo(70));
  assert.deepEqual(errors, []);
});

test('trạng thái trống: chưa có / mới 1 lần đo → hướng dẫn nhập; nút mở hộp nhập', async () => {
  const { w, doc, errors } = open({ weeks: [] }); await wait(300);
  await openBodyTab(w, doc);
  const host = doc.getElementById('anBody');
  assert.match(host.textContent, /Chưa có số đo cơ thể nào/); assert.equal(host.querySelectorAll('svg').length, 0);
  host.querySelector('[data-bc-add]').click(); await wait(20);
  const d = [...doc.querySelectorAll('.ui-dialog')].pop(); assert.match(d.textContent, /Nhập số đo cơ thể/);
  d.querySelector('[name="weightKg"]').value = '70'; d.querySelector('form').dispatchEvent(new w.Event('submit', { cancelable: true }));
  await wait(40); [...doc.querySelectorAll('.ui-dialog')].forEach(x => x.querySelector('[data-ui-cancel]')?.click()); await wait(20);
  assert.match(doc.getElementById('anBody').textContent, /Mới có 1 lần đo/, 'Analytics tự vẽ lại sau khi lưu');
  assert.deepEqual(errors, []);
});

test('hai người dùng có biểu đồ khác nhau', async () => {
  const { w, doc, errors } = open(bodyData()); await wait(300);
  await openBodyTab(w, doc);
  const before = doc.querySelector('svg[data-key="weightKg"]').getAttribute('data-points');
  const u = await w.T17Platform.createUser('Lan'); await w.T17UserUI.switchTo(u.id); await wait(30);
  w.eval(`db.bodyMetrics=[{date:'${daysAgo(20)}',weightKg:52},{date:'${daysAgo(10)}',weightKg:52.4},{date:'${daysAgo(1)}',weightKg:52.6}];saveDb()`);
  await openBodyTab(w, doc);
  assert.equal(doc.querySelector('svg[data-key="weightKg"]').getAttribute('data-points'), '3');
  assert.match(doc.querySelector('.bc-title[data-key="weightKg"]').textContent, /^Tăng 0,\d kg trong 3 tuần$|^Ổn định/);
  assert.ok(!doc.querySelector('.bc-goal'), 'Lan chưa đặt mục tiêu');
  await w.T17UserUI.switchTo('main'); await wait(30); await openBodyTab(w, doc);
  assert.equal(doc.querySelector('svg[data-key="weightKg"]').getAttribute('data-points'), before);
  assert.deepEqual(errors, []);
});
