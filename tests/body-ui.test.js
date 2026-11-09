'use strict';
/* Lượt 4 — giao diện Chỉ số cơ thể (jsdom, bản đã build): nhập tại một thời điểm, so sánh khi gõ, thẻ tóm tắt + màu,
 * đồng bộ cân nặng hồ sơ (nhớ lựa chọn), lịch sử sửa/xoá/lọc, CSV, Excel sheet Body, nhiều người dùng không lẫn số đo. */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM, VirtualConsole } = require('jsdom');
const B = require('../src/core/body.js');
const XLSX = require('../src/lib/xlsx.js');
const ROOT = path.join(__dirname, '..'), FX = path.join(__dirname, 'fixtures');
const wait = ms => new Promise(r => setTimeout(r, ms));

function open(setup) {
  const errors = [], blobs = [];
  const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message)); vc.on('error', e => errors.push(String(e)));
  const html = fs.readFileSync(path.join(ROOT, 'dist/web/T17_runtracker.html'), 'utf8');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'http://localhost/', virtualConsole: vc, pretendToBeVisual: true, beforeParse(w) {
    w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.DecompressionStream = DecompressionStream;
    w.alert = m => errors.push('alert: ' + m); w.confirm = () => true; w.prompt = () => ''; w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {};
    w.URL.createObjectURL = b => { blobs.push(b); return 'blob:x'; }; w.URL.revokeObjectURL = () => {}; w.HTMLAnchorElement.prototype.click = function () {};
    setup && setup(w);
  } });
  const w = dom.window;
  const text = b => new Promise(res => { const fr = new w.FileReader(); fr.onload = () => res(fr.result); fr.readAsText(b); });
  const bytes = b => new Promise(res => { const fr = new w.FileReader(); fr.onload = () => res(new Uint8Array(fr.result)); fr.readAsArrayBuffer(b); });
  return { w, doc: w.document, errors, blobs, text, bytes };
}
const dialog = doc => [...doc.querySelectorAll('.ui-dialog')].pop();
async function waitDialog(doc) { for (let t = 0; t < 2000; t += 20) { const d = dialog(doc); if (d) return d; await wait(20); } throw new Error('Không thấy hộp thoại'); }
const submit = (w, d) => d.querySelector('form').dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true }));
const setVal = (w, el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); };
const json = (w, e) => JSON.parse(w.eval(`JSON.stringify(${e})`));
async function addRecord(w, doc, vals, opts = {}) {
  doc.getElementById('bdAdd').click(); const d = await waitDialog(doc);
  for (const [k, v] of Object.entries(vals)) setVal(w, d.querySelector(`[name="${k}"]`), v);
  if (opts.before) opts.before(d);
  submit(w, d); await wait(40); return d;
}

test('nhập số đo, so sánh khi gõ, thẻ tóm tắt + màu, đồng bộ cân nặng hồ sơ, lịch sử sửa / xoá / lọc', async () => {
  const app = open(w => w.localStorage.setItem('runplan-tracker-v1', JSON.stringify({ weeks: [], profile: { heightCm: '175' } }))); const { w, doc } = app; await wait(300);
  doc.getElementById('railBody').click();
  assert.ok(doc.getElementById('bodyModal').classList.contains('show'));
  assert.match(doc.getElementById('bdSummary').textContent, /Chưa có số đo nào/);
  // chỉ cân nặng → hỏi đồng bộ hồ sơ → "Luôn tự cập nhật"
  await addRecord(w, doc, { date: '2026-11-01', time: '07:00', weightKg: '70,4' });
  let d = await waitDialog(doc); assert.match(d.textContent, /Cập nhật cân nặng trong hồ sơ/);
  d.querySelectorAll('[data-choice]')[2].click(); await wait(30);
  assert.equal(json(w, 'db.profile.weightKg'), 70.4); assert.equal(json(w, 'db.profile.bodyWeightSync'), 'always');
  // lần hai: thấy "so với lần trước" ngay khi gõ; không hỏi lại
  await addRecord(w, doc, { date: '2026-11-09', time: '06:30', weightKg: '69.8', bodyFatPct: '19', waistCm: '84' }, { before: dd => {
    assert.match(dd.querySelector('[data-cmp="weightKg"]').textContent, /so với 01\/11\/2026: ▼ -0,6 kg/);
    assert.match(dd.querySelector('[data-derived]').textContent, /BMI 22,8/); assert.match(dd.querySelector('[data-derived]').textContent, /Khối nạc \(FFM\) 56,5 kg/);
  } });
  assert.equal(doc.querySelectorAll('.ui-dialog').length, 0, 'không hỏi lại'); assert.equal(json(w, 'db.profile.weightKg'), 69.8);
  // nhiều lần / ngày
  await addRecord(w, doc, { date: '2026-11-09', time: '21:00', weightKg: '70,2' });
  assert.equal(json(w, 'db.bodyMetrics.length'), 3);
  const card = doc.querySelector('.bd-card[data-key="weightKg"]');
  assert.match(card.querySelector('.bd-val').textContent, /70,2/);
  assert.match(card.querySelector('.bd-ref .bd-d').textContent, /▲ \+0,4 kg/); assert.ok(card.querySelector('.bd-ref .bd-d').classList.contains('neutral'), 'cân nặng trung tính khi chưa có mục tiêu');
  assert.ok(doc.querySelector('.bd-card[data-key="bmi"]') && doc.querySelector('.bd-card[data-key="waistCm"]'));
  // đặt mục tiêu 65 kg → tăng là xấu
  w.eval(`db.profile.weightGoalKg='65';T17BodyUI.renderAll()`);
  assert.ok(doc.querySelector('.bd-card[data-key="weightKg"] .bd-ref .bd-d').classList.contains('bad'));
  assert.match(doc.getElementById('bdTrend').textContent, /trung bình 7 ngày/);
  // cảnh báo không chặn; bản ghi rỗng bị chặn
  await addRecord(w, doc, { date: '2026-11-10', weightKg: '400' }, { before: dd => assert.match(dd.querySelector('[data-warn]').textContent, /ngoài khoảng/) });
  assert.equal(doc.querySelectorAll('.ui-dialog').length, 0, 'đã chọn "luôn cập nhật" nên không hỏi'); assert.equal(json(w, 'db.profile.weightKg'), 400);
  assert.equal(json(w, 'db.bodyMetrics.length'), 4);
  doc.getElementById('bdAdd').click(); d = await waitDialog(doc); submit(w, d); await wait(20);
  assert.match(d.querySelector('.ui-dialog-error').textContent, /Chưa nhập số đo nào/); d.querySelector('[data-ui-cancel]').click();
  // sửa (đổi 400 → 69,5) và xoá
  const odd = json(w, 'db.bodyMetrics').find(r => r.weightKg === 400);
  doc.querySelector(`[data-bd-edit="${odd.id}"]`).click(); d = await waitDialog(doc); setVal(w, d.querySelector('[name="weightKg"]'), '69,5'); submit(w, d); await wait(40);
  assert.equal(json(w, 'db.bodyMetrics').find(r => r.id === odd.id).weightKg, 69.5);
  doc.querySelector(`[data-bd-del="${odd.id}"]`).click(); await wait(20);
  assert.equal(json(w, 'db.bodyMetrics.length'), 3);
  // lọc khoảng ngày
  const from = doc.getElementById('bdFrom'); from.value = '2026-11-05'; from.dispatchEvent(new w.Event('change'));
  assert.equal(doc.querySelectorAll('#bdTable tbody tr').length, 2);
  doc.getElementById('bdClearFilter').click(); assert.equal(doc.querySelectorAll('#bdTable tbody tr').length, 3);
  // có trong file sao lưu
  assert.equal(json(w, 'T17Legacy.toBackup(db,"x").bodyMetrics.length'), 3); assert.deepEqual(json(w, 'T17Legacy.toBackup(db,"x").features'), { body: 1 });
  assert.deepEqual(app.errors, []);
});

test('CSV: nhập từ cân thông minh (không nhân đôi khi nhập lại), xuất CSV đọc lại được; Excel có sheet Body, nhập lại được', async () => {
  const app = open(); const { w, doc } = app; await wait(300);
  w.eval(`db.profile={bodyWeightSync:'never'}`);
  doc.getElementById('railBody').click();
  const m1 = await w.T17BodyUI.importCsvText(fs.readFileSync(path.join(FX, 'body-scale-en.csv'), 'utf8'), 'scale.csv');
  assert.equal(m1.added, 5);
  const m2 = await w.T17BodyUI.importCsvText(fs.readFileSync(path.join(FX, 'body-manual-vi.csv'), 'utf8'), 'tay.csv'); assert.equal(m2.added, 3);
  const m3 = await w.T17BodyUI.importCsvText(fs.readFileSync(path.join(FX, 'body-scale-en.csv'), 'utf8'), 'scale.csv'); assert.deepEqual([m3.added, m3.duplicates], [0, 5]);
  assert.equal(json(w, 'db.bodyMetrics.length'), 8); assert.equal(json(w, 'db.profile.weightKg ?? null'), null, '"không hỏi lại" được nhớ');
  doc.getElementById('bdExportCsv').click(); await wait(30);
  const csv = await app.text(app.blobs.at(-1));
  const strip = l => l.map(({ id, source, ...r }) => r);
  assert.deepEqual(strip(B.parseCsv(csv).records), strip(B.normalizeList(json(w, 'db.bodyMetrics'))));
  // Excel: lưới chạy bộ + sheet Body
  w.eval(`T17FitnessUI.assign('b:run-basic-1',['2026-11-12'])`);
  w.eval('exportExcel()'); submit(w, await waitDialog(doc)); await wait(50);
  const xbytes = await app.bytes(app.blobs.at(-1));
  const wb = await XLSX.readSheets(xbytes); assert.deepEqual(wb.names, ['Run tracker', 'Body']);
  assert.equal(B.fromAoa(wb.sheets.get('Body')).records.length, 8);
  const app2 = open(); await wait(300);
  await app2.w.importExcel(new app2.w.File([xbytes], 'x.xlsx'));
  assert.equal(json(app2.w, 'db.bodyMetrics.length'), 8); assert.equal(json(app2.w, 'db.weeks.flatMap(x=>x.days).flatMap(d=>d.workouts).length'), 1);
  await app2.w.importExcel(new app2.w.File([xbytes], 'x.xlsx'));
  assert.equal(json(app2.w, 'db.bodyMetrics.length'), 8, 'nhập lại Excel không nhân đôi số đo');
  assert.deepEqual(app.errors, []); assert.deepEqual(app2.errors, []);
});

test('nhiều người dùng: số đo không lẫn khi chuyển người dùng', async () => {
  const app = open(); const { w, doc } = app; await wait(300);
  w.eval(`db.profile={bodyWeightSync:'never'}`);
  doc.getElementById('railBody').click();
  await addRecord(w, doc, { date: '2026-11-01', weightKg: '70' });
  const u = await w.T17Platform.createUser('Lan'); await w.T17UserUI.switchTo(u.id); await wait(50);
  assert.ok(!doc.getElementById('bodyModal').classList.contains('show'), 'đóng hộp khi chuyển người dùng');
  assert.equal(json(w, '(db.bodyMetrics||[]).length'), 0);
  w.eval(`db.profile={...db.profile,bodyWeightSync:'never'}`);
  doc.getElementById('userBodyBtn').click(); assert.match(doc.getElementById('bdTitle').textContent, /Lan/);
  await addRecord(w, doc, { date: '2026-11-02', weightKg: '52', bodyFatPct: '24' });
  await w.T17UserUI.switchTo('main'); await wait(50);
  assert.deepEqual(json(w, 'db.bodyMetrics').map(r => r.weightKg), [70]);
  assert.deepEqual(JSON.parse(w.localStorage.getItem('runplan-tracker-v1:' + u.id)).bodyMetrics.map(r => r.weightKg), [52]);
  assert.deepEqual(app.errors, []);
});
