'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const U = require('../src/core/users.js');

test('chỉ mục: mặc định có người dùng main, chuẩn hoá dữ liệu hỏng', () => {
  const i = U.emptyIndex('Tung'); assert.equal(i.activeUserId, 'main'); assert.equal(i.users[0].name, 'Tung');
  assert.equal(U.normalizeIndex(null).users.length, 1);
  assert.equal(U.normalizeIndex({ users: [{ id: '../x' }, { id: 'a' }, { id: 'a' }, { id: 'b', name: ' B  B ' }], activeUserId: 'zzz' }).users.length, 2);
  const n = U.normalizeIndex({ users: [{ id: 'a' }, { id: 'b', name: ' B  B ' }], activeUserId: 'zzz' });
  assert.equal(n.activeUserId, 'a'); assert.equal(n.users[1].name, 'B B');
});
test('thêm / đổi tên / xoá / chọn người dùng', () => {
  let i = U.emptyIndex();
  const r = U.addUser(i, '  Lan  '); i = r.index; assert.equal(r.user.name, 'Lan'); assert.match(r.user.id, /^[a-z0-9_-]+$/);
  assert.throws(() => U.addUser(i, '   '), /tên/);
  i = U.setActive(i, r.user.id); assert.throws(() => U.setActive(i, 'nope'));
  i = U.renameUser(i, r.user.id, 'Lan Anh'); assert.equal(i.users[1].name, 'Lan Anh');
  i = U.removeUser(i, r.user.id); assert.equal(i.activeUserId, 'main'); assert.throws(() => U.removeUser(i, 'main'), /ít nhất/);
  let big = U.emptyIndex(); for (let k = 1; k < U.MAX_USERS; k++) big = U.addUser(big, 'u' + k, new Date(1e12 + k)).index;
  assert.throws(() => U.addUser(big, 'x'), /Tối đa/);
});
test('vị trí lưu: main giữ file / khoá cũ', () => {
  assert.equal(U.fileNameFor('main'), 't17-runtracker.json'); assert.equal(U.fileNameFor('u1'), 'users/u1.json');
  assert.equal(U.lsKeyFor('main'), 'runplan-tracker-v1'); assert.equal(U.lsKeyFor('u1'), 'runplan-tracker-v1:u1');
  assert.equal(U.backupPrefixFor('main'), 't17-runtracker');
});
test('hồ sơ cá nhân: tuổi, BMI, gộp trường, tên hiển thị', () => {
  assert.equal(U.ageFromBirth('1990-06-15', new Date('2026-06-14T00:00:00Z')), 35);
  assert.equal(U.ageFromBirth('1990-06-15', new Date('2026-06-15T00:00:00Z')), 36);
  assert.equal(U.ageFromBirth('2026-13-45'), 0); assert.equal(U.ageFromBirth(''), 0);
  assert.equal(U.bmi(170, 65), 22.5); assert.equal(U.bmi('', 65), 0);
  assert.equal(U.suggestHrMaxByAge(40), 180); assert.equal(U.suggestHrMaxByAge(0), 0);
  const p = U.mergePersonal({ hrMax: 190, lthr: 170 }, { fullName: ' Nguyễn Văn A ', heightCm: '172,5', birthDate: 'bậy', phone: '0901' });
  assert.equal(p.hrMax, 190); assert.equal(p.fullName, 'Nguyễn Văn A'); assert.equal(p.heightCm, '172.5'); assert.equal(p.birthDate, ''); assert.equal(p.phone, '0901');
  assert.equal(U.mergePersonal({}, { heightCm: '5' }).heightCm, '');
  assert.equal(U.displayName({ nickname: 'Tí', fullName: 'A B' }, 'x'), 'Tí'); assert.equal(U.displayName({}, 'Lan'), 'Lan');
  assert.equal(U.initials('Nguyễn Văn An'), 'NA'); assert.equal(U.initials('lan'), 'L'); assert.equal(U.initials(''), '?');
  assert.equal(U.slug('Nguyễn Đức Tùng'), 'Nguyen_Duc_Tung');
  const c = U.completeness({ fullName: 'A', hrMax: 190 }); assert.equal(c.filled, 2); assert.ok(c.missing.includes('email'));
});
