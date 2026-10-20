'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test('tên gói phát hành: yymmdd_T17_runtracker_vX.Y.Z theo giờ Việt Nam', async () => {
  const m = await import(pathToFileURL(path.join(__dirname, '..', 'scripts', 'package-win.mjs')).href);
  // 2026-10-20 18:30 UTC = 2026-10-21 01:30 giờ VN → 261021
  assert.equal(m.buildDateVN(new Date('2026-10-20T18:30:00Z')), '261021');
  assert.equal(m.releaseBaseName('2.1.3', '261020'), '261020_T17_runtracker_v2.1.3');
});

test('zip tự tạo giải nén được và đúng CRC', async () => {
  const m = await import(pathToFileURL(path.join(__dirname, '..', 'scripts', 'package-win.mjs')).href);
  const data = Buffer.from('Xin chào T17 '.repeat(200));
  const zip = m.makeZip([{ name: 'HUONG_DAN.txt', data }]);
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  const nameLen = zip.readUInt16LE(26), compSize = zip.readUInt32LE(18);
  const out = zlib.inflateRawSync(zip.subarray(30 + nameLen, 30 + nameLen + compSize));
  assert.deepEqual(out, data);
  assert.equal(zip.subarray(30, 30 + nameLen).toString(), 'HUONG_DAN.txt');
  assert.equal(zip.readUInt32LE(zip.length - 22), 0x06054b50);
});
