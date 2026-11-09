'use strict';
/* Lượt 7 — FUZZ đường nhập trên GIAO DIỆN (jsdom, bản đã build): file hỏng / sai loại / rất lớn đưa vào mọi nút nhập.
 * Yêu cầu: app không sập (không lỗi JS chưa bắt), dữ liệu tốt đang có không bị ghi đè. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = path.join(__dirname, '..'), FX = path.join(__dirname, 'fixtures');
const wait = ms => new Promise(r => setTimeout(r, ms));
const GOOD = JSON.parse(fs.readFileSync(path.join(FX, 't17-v25-full.json'), 'utf8'));
const KEY = 'runplan-tracker-v1';

function open() {
  const errors = [], alerts = [], confirms = [];
  const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(fs.readFileSync(path.join(ROOT, 'dist/web/T17_runtracker.html'), 'utf8'), { runScripts: 'dangerously', url: 'http://localhost/', virtualConsole: vc, pretendToBeVisual: true, beforeParse(w) {
    w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.DecompressionStream = DecompressionStream;
    w.alert = m => alerts.push(String(m)); w.confirm = m => { confirms.push(String(m)); return w.__confirm ?? true; }; w.prompt = () => ''; w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {};
    w.URL.createObjectURL = () => 'blob:x'; w.URL.revokeObjectURL = () => {}; w.HTMLAnchorElement.prototype.click = function () {};
    w.localStorage.setItem(KEY, JSON.stringify(GOOD));
  } });
  return { w: dom.window, doc: dom.window.document, errors, alerts, confirms };
}
const snapshotOf = w => { const d = JSON.parse(w.localStorage.getItem(KEY)); return JSON.stringify({ weeks: d.weeks.flatMap(x => x.days).flatMap(x => x.workouts).map(x => [x.id, x.workoutName, x.planKm, x.actual?.km ?? null, x.actual?.status ?? null]).sort(), body: d.bodyMetrics, energy: d.profile?.energy, lib: (d.fitnessLibrary || []).length }); };
async function pick(w, id, name, content, size) {
  const f = new w.File([content], name); if (size) Object.defineProperty(f, 'size', { value: size });
  const input = w.document.getElementById(id); Object.defineProperty(input, 'files', { value: [f], configurable: true }); input.dispatchEvent(new w.Event('change', { bubbles: true }));
  await wait(250);
  // đóng mọi hộp thoại xem trước còn mở (chọn Huỷ)
  for (const d of w.document.querySelectorAll('.ui-dialog [data-ui-cancel]')) d.click();
  await wait(30);
}
const goodTxt = JSON.stringify(GOOD), v3 = fs.readFileSync(path.join(FX, 'fitness-mobile-v3.json'), 'utf8'), xlsx = fs.readFileSync(path.join(FX, 'fitness-mobile-v3.xlsx'));
const BAD = [
  ['cut.json', goodTxt.slice(0, 5000)], ['empty.json', ''], ['null.json', 'null'], ['weeks-str.json', '{"weeks":"abc"}'], ['weeks-null-items.json', '{"weeks":[null,1,{"days":[null,{"date":"2026-13-45","workouts":[null,{"planKm":"abc"}]}]}]}'],
  ['plan-bad.json', '{"format":"runplan-plan","days":[null,{"date":"xx","workouts":"abc"},{"date":"2026-11-10","workouts":[null,{"workoutName":null,"planKm":"năm"}]}]}'],
  ['log-bad.json', '{"format":"runplan-log","entries":[null,{"date":"2026-02-30","actual":{"km":"x"}}]}'],
  ['fit-v3-bad.json', v3.replace(/"date":\s*"[^"]*"/, '"date":"2026-99-99"')], ['fit-v3-null.json', v3.replace(/"exercises":\s*\[/, '"exercises":[null,')],
  ['fit-img.json', JSON.stringify({ ...JSON.parse(v3), library: [{ id: 'x1', name: 'XSS', imageData: 'x" onerror="window.__pwned=1' }] })],
  ['rac.xlsx', Buffer.from('PK\u0003\u0004 rác rác')], ['cut.xlsx', xlsx.subarray(0, xlsx.length / 2)], ['bin.json', Buffer.from([0, 255, 254, 1, 2, 3])],
];

test('mọi nút nhập + file hỏng → không sập, không mất dữ liệu đang có', async () => {
  const app = open(); const { w, errors } = app; await wait(400);
  const before = snapshotOf(w);
  for (const id of ['restoreFile', 'importPlanFile', 'importFile', 'fitImportFile', 'bdCsvFile']) {
    for (const [name, content] of BAD) {
      w.__confirm = false; // người dùng bấm Huỷ khi được hỏi ghi đè
      await pick(w, id, name, content);
      assert.deepEqual(errors, [], `${id} ← ${name}: lỗi JS`);
      assert.equal(snapshotOf(w), before, `${id} ← ${name}: dữ liệu đang có bị đổi`);
    }
  }
  assert.equal(w.__pwned, undefined, 'ảnh bài tập chạy được mã');
  assert.ok(app.alerts.length > 10, 'file hỏng phải được báo');
});

test('file rất lớn bị chặn trước khi đọc, có thông báo', async () => {
  const app = open(); const { w, errors } = app; await wait(400); const before = snapshotOf(w);
  for (const id of ['restoreFile', 'importPlanFile', 'importFile', 'bdCsvFile']) { app.alerts.length = 0; await pick(w, id, id === 'importFile' ? 'to.xlsx' : id === 'bdCsvFile' ? 'to.csv' : 'to.json', '{}', 200 * 1048576); assert.ok(app.alerts.some(a => /quá lớn/.test(a)), id + ': không báo file quá lớn: ' + app.alerts.join(' | ')); }
  assert.deepEqual(errors, []); assert.equal(snapshotOf(w), before);
});

test('khôi phục file sao lưu rỗng: cảnh báo rõ, và nếu vẫn đồng ý thì giữ một bản dự phòng', async () => {
  const app = open(); const { w, errors } = app; await wait(400);
  w.__confirm = true; await pick(w, 'restoreFile', 'rong.json', '{"weeks":[]}');
  assert.ok(app.confirms.some(c => /KHÔNG CÓ BÀI TẬP NÀO/.test(c)), 'không cảnh báo file rỗng');
  const backupKey = Object.keys(w.localStorage).find(k => k.endsWith(':truoc-khoi-phuc')); assert.ok(backupKey, 'không giữ bản dự phòng');
  assert.ok(JSON.parse(w.localStorage.getItem(backupKey)).weeks.length > 0);
  assert.deepEqual(errors, []);
});
