'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/core/utils.js');
const XLSX = require('../src/lib/xlsx.js');
const { parseWorkbookRows } = require('../src/core/excel-plan.js');

const DAYS = ['Hai', 'Ba', 'Tư', 'Năm', 'Sáu', 'Bảy', 'CN'];
function block(label, names, kms) {
  return [
    [label, ...names],
    ['ngày', '19/10/2026', '20/10/2026', '21/10/2026', '22/10/2026', '23/10/2026', '24/10/2026', '25/10/2026'],
    ['Mô tả bài tập', '', '', '', '', '', '', ''],
    ['Số km dự kiến', ...kms],
    ['Số phút dự kiến', '', '', '', '', '', '', ''],
  ];
}

test('Excel ghi ra rồi đọc lại: khối phụ "Tuần N - bài 2" (nhiều bài/ngày) được nhận', async () => {
  const aoa = [['Tuần \\ Thứ', ...DAYS],
    ...block('43', ['Easy', '', 'Tempo', '', '', 'Long', ''], [6, '', 8, '', '', 16, '']), [],
    ...block('Tuần 43 - bài 2', ['Core', '', '', '', '', '', ''], ['', '', '', '', '', '', ''])];
  const blob = XLSX.buildXlsxBlob(aoa, 'Run tracker');
  const rows = await XLSX.readFirstSheet(new Uint8Array(await blob.arrayBuffer()));
  const weeks = parseWorkbookRows(rows);
  assert.equal(weeks.length, 2);
  const monday = weeks.flatMap(w => w.days).filter(d => d.date === '2026-10-19' && d.workoutName);
  assert.deepEqual(monday.map(d => d.workoutName), ['Easy', 'Core']);
  // bài đơn giản (không mô tả) được sinh cấu trúc 1 đoạn theo km
  const easy = monday[0];
  assert.equal(easy.workoutStructure.groups[0].steps[0].mode, 'distance');
  assert.equal(easy.workoutStructure.groups[0].steps[0].value, 6);
});

test('Excel không đúng cấu trúc → báo lỗi rõ ràng', () => {
  assert.throws(() => parseWorkbookRows([['abc'], ['def']]), /Không nhận ra/);
});
