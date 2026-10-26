/* T17 RunTracker — người dùng (v2.2).
 * Mỗi người dùng có kho dữ liệu RIÊNG (kế hoạch, kết quả, mẫu bài, hồ sơ) — cùng định dạng với file cũ.
 * Danh sách người dùng (chỉ id + tên hiển thị) nằm trong "chỉ mục":
 *   { app, usersVersion: 1, activeUserId, users: [ { id, name, createdAt } ] }
 * Người dùng 'main' là chủ của dữ liệu đời cũ (file data/t17-runtracker.json, khoá localStorage cũ),
 * nên nâng cấp từ v2.0/v2.1 không phải di chuyển gì cả.
 * Pure — dùng trong app (globalThis.T17Users) và Node test.
 */
(function (root) {
'use strict';
const MAIN_ID = 'main';
const USERS_VERSION = 1;
const MAX_USERS = 20;
const ID_RE = /^[a-z0-9][a-z0-9_-]{0,39}$/;
const PALETTE = ['#2f6fda', '#0f9d8a', '#d9822b', '#8e5fd0', '#d14b6a', '#4c8f2f', '#c2a21d', '#3a7ca5'];

function newUserId(existing = [], rnd = Math.random, now = Date.now) {
  const taken = new Set(existing);
  for (let i = 0; i < 50; i++) { const id = 'u' + now().toString(36) + Math.floor(rnd() * 46656).toString(36).padStart(3, '0'); if (!taken.has(id)) return id; }
  throw new Error('Không tạo được mã người dùng.');
}
const cleanName = s => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 40);

function emptyIndex(name = 'Tôi', now = new Date()) {
  return { app: 'T17 RunTracker', usersVersion: USERS_VERSION, activeUserId: MAIN_ID, users: [{ id: MAIN_ID, name: cleanName(name) || 'Tôi', createdAt: now.toISOString() }] };
}

/** Chuẩn hoá chỉ mục đọc từ file/localStorage (có thể hỏng hoặc thiếu). Luôn trả chỉ mục hợp lệ, ≥ 1 người dùng. */
function normalizeIndex(x, now = new Date()) {
  const seen = new Set(); const users = [];
  for (const u of Array.isArray(x?.users) ? x.users : []) {
    const id = String(u?.id ?? '');
    if (!ID_RE.test(id) || seen.has(id)) continue;
    seen.add(id);
    users.push({ id, name: cleanName(u.name) || (id === MAIN_ID ? 'Tôi' : 'Người dùng'), createdAt: typeof u.createdAt === 'string' ? u.createdAt : now.toISOString() });
  }
  if (!users.length) return emptyIndex('Tôi', now);
  const active = users.some(u => u.id === x?.activeUserId) ? x.activeUserId : users[0].id;
  return { app: 'T17 RunTracker', usersVersion: USERS_VERSION, activeUserId: active, users };
}

function addUser(index, name, now = new Date(), rnd = Math.random) {
  if (index.users.length >= MAX_USERS) throw new Error(`Tối đa ${MAX_USERS} người dùng.`);
  const nm = cleanName(name); if (!nm) throw new Error('Chưa nhập tên người dùng.');
  const id = newUserId(index.users.map(u => u.id), rnd, () => now.getTime());
  const user = { id, name: nm, createdAt: now.toISOString() };
  return { index: { ...index, users: [...index.users, user] }, user };
}
function renameUser(index, id, name) {
  const nm = cleanName(name); if (!nm) return index;
  return { ...index, users: index.users.map(u => u.id === id ? { ...u, name: nm } : u) };
}
function removeUser(index, id) {
  if (index.users.length <= 1) throw new Error('Phải còn ít nhất một người dùng.');
  const users = index.users.filter(u => u.id !== id);
  return { ...index, users, activeUserId: index.activeUserId === id ? users[0].id : index.activeUserId };
}
function setActive(index, id) {
  if (!index.users.some(u => u.id === id)) throw new Error('Không có người dùng này.');
  return { ...index, activeUserId: id };
}

// ---- Vị trí lưu trữ ----
const fileNameFor = id => id === MAIN_ID ? 't17-runtracker.json' : `users/${id}.json`;
const backupPrefixFor = id => id === MAIN_ID ? 't17-runtracker' : id;
const lsKeyFor = (id, base = 'runplan-tracker-v1') => id === MAIN_ID ? base : `${base}:${id}`;

// ---- Hồ sơ cá nhân ----
const PERSONAL_FIELDS = ['fullName', 'nickname', 'birthDate', 'heightCm', 'email', 'phone', 'city', 'club', 'goal', 'emergencyName', 'emergencyPhone', 'notes'];
const MAX_LEN = { fullName: 80, nickname: 30, email: 120, phone: 30, city: 80, club: 80, goal: 300, emergencyName: 80, emergencyPhone: 30, notes: 1000 };

function validBirthDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s; }
function ageFromBirth(iso, now = new Date()) {
  if (!validBirthDate(iso)) return 0;
  const b = new Date(iso + 'T00:00:00Z'); let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth(); if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age--;
  return age >= 0 && age < 120 ? age : 0;
}
function bmi(heightCm, weightKg) {
  const h = Number(heightCm) / 100, w = Number(weightKg);
  if (!(h > 0.5 && h < 2.5 && w > 20 && w < 300)) return 0;
  return Math.round((w / (h * h)) * 10) / 10;
}
/** Công thức Tanaka: HRmax ≈ 208 − 0,7 × tuổi (chỉ để gợi ý khi chưa đo thật). */
function suggestHrMaxByAge(age) { return age >= 10 && age <= 90 ? Math.round(208 - 0.7 * age) : 0; }

/** Gộp phần thông tin cá nhân vào hồ sơ hiện có, giữ nguyên các thông số tập luyện. */
function mergePersonal(profile, personal) {
  const out = { ...(profile || {}) };
  for (const k of PERSONAL_FIELDS) {
    if (!(k in (personal || {}))) continue;
    let v = String(personal[k] ?? '').trim();
    if (k === 'birthDate' && v && !validBirthDate(v)) v = '';
    if (k === 'heightCm') { const n = Number(v.replace(',', '.')); v = n >= 100 && n <= 250 ? String(Math.round(n * 10) / 10) : ''; }
    if (MAX_LEN[k]) v = v.slice(0, MAX_LEN[k]);
    out[k] = v;
  }
  return out;
}
/** Tên hiển thị: biệt danh → họ tên → tên người dùng. */
function displayName(profile, fallback = '') { return String(profile?.nickname || profile?.fullName || fallback || 'Người dùng').trim(); }
function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  const pick = s => Array.from(s)[0].toUpperCase();
  return parts.length === 1 ? pick(parts[0]) : pick(parts[0]) + pick(parts[parts.length - 1]);
}
function colorFor(id) { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return PALETTE[h % PALETTE.length]; }
function slug(name) {
  return String(name || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24);
}
/** Mức độ đầy đủ của hồ sơ (để gợi ý nhập bổ sung dần). */
function completeness(profile) {
  const p = profile || {};
  const keys = ['fullName', 'birthDate', 'sex', 'heightCm', 'weightKg', 'hrMax', 'hrRest', 'lthr', 'thresholdPace', 'email', 'phone', 'city', 'goal'];
  const filled = keys.filter(k => String(p[k] ?? '').trim() !== '');
  return { filled: filled.length, total: keys.length, missing: keys.filter(k => !filled.includes(k)) };
}

const api = { MAIN_ID, MAX_USERS, PERSONAL_FIELDS, newUserId, cleanName, emptyIndex, normalizeIndex, addUser, renameUser, removeUser, setActive, fileNameFor, backupPrefixFor, lsKeyFor, validBirthDate, ageFromBirth, bmi, suggestHrMaxByAge, mergePersonal, displayName, initials, colorFor, slug, completeness };
root.T17Users = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
