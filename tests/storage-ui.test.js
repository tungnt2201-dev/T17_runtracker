'use strict';
/* Lượt 7 — bản web gần đầy localStorage: cảnh báo ≈4/5 MB (gợi ý exe / ảnh), kho đầy thì tự bỏ bản dự phòng để lưu được. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = path.join(__dirname, '..');
const wait = ms => new Promise(r => setTimeout(r, ms));
const GOOD = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/t17-v25-full.json'), 'utf8'));
const img = n => 'data:image/jpeg;base64,' + 'A'.repeat(n);
function open(seed, quota = 5_242_880) {
  const errors = []; const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'dist/web/T17_runtracker.html'), 'utf8'), { runScripts: 'dangerously', url: 'http://localhost/', virtualConsole: vc, pretendToBeVisual: true, storageQuota: quota, beforeParse(w) {
    w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.DecompressionStream = DecompressionStream; w.alert = m => errors.push('alert: ' + m); w.confirm = () => true; w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {};
    for (const [k, v] of Object.entries(seed)) w.localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
  } });
  return { w: dom.window, errors };
}
test('gần 4 MB: hiện cảnh báo, gợi ý bản exe và nén ảnh; dưới ngưỡng thì không', async () => {
  const small = open({ 'runplan-tracker-v1': GOOD }); await wait(500);
  assert.ok(!small.w.document.getElementById('supportBox').classList.contains('show'));
  const big = { ...GOOD, fitnessLibrary: GOOD.fitnessLibrary.map(x => ({ ...x, imageData: img(270_000) })) };
  const app = open({ 'runplan-tracker-v1': big }); await wait(500);
  const box = app.w.document.getElementById('supportBox');
  assert.ok(box.classList.contains('show') && box.classList.contains('warn'), 'không cảnh báo');
  assert.match(box.textContent, /sắp đầy: đã dùng 4,\d \/ 5,0 MB/); assert.match(box.textContent, /\.exe/); assert.match(box.textContent, /ảnh bài tập.*4,1 MB/);
  assert.deepEqual(app.errors, []);
});
test('kho đầy khi lưu: tự bỏ bản dự phòng tự động rồi lưu được; không có gì để bỏ thì báo rõ “CHƯA được lưu”', async () => {
  const base = { ...GOOD, fitnessLibrary: GOOD.fitnessLibrary.map(x => ({ ...x, imageData: img(170_000) })) }; // ≈2,7 MB
  const app = open({ 'runplan-tracker-v1': base, 'runplan-tracker-v1:truoc-nhap-fitness': 'x'.repeat(1_900_000) }); await wait(500);
  app.w.eval(`db.fitnessLibrary[0] = { ...db.fitnessLibrary[0], imageData: ${JSON.stringify(img(900_000))} }; saveDb();`);
  const snap = app.w.localStorage.getItem('runplan-tracker-v1:truoc-nhap-fitness'); assert.equal(snap, null, 'bản dự phòng chưa được bỏ (' + (snap || '').length + ')');
  assert.equal(JSON.parse(app.w.localStorage.getItem('runplan-tracker-v1')).fitnessLibrary[0].imageData.length, img(900_000).length, 'chưa lưu được');
  app.w.eval(`db.fitnessLibrary[1] = { ...db.fitnessLibrary[1], imageData: ${JSON.stringify(img(2_500_000))} }; saveDb();`); await wait(50);
  const box = app.w.document.getElementById('supportBox'); assert.ok(box.classList.contains('bad')); assert.match(box.textContent, /CHƯA được lưu/);
  assert.deepEqual(app.errors, []);
});
