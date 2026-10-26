/* T17 RunTracker — lớp nền tảng (platform).
 *
 * Hai chế độ chạy:
 *   - desktop : bản .exe (Neutralino). Dữ liệu lưu thành FILE trong thư mục `data/` cạnh file exe
 *               → copy cả thư mục là mang được sang máy khác (portable thật sự).
 *   - web     : mở file HTML bằng trình duyệt. Dữ liệu lưu localStorage, dùng CHUNG khoá với
 *               RunPlan v1.8.x nên mở bản mới ở cùng chỗ là thấy lại dữ liệu cũ.
 *
 * Ghi file desktop: ghi .tmp → copy đè file chính → xoá .tmp; mỗi ngày giữ 1 bản sao lưu tự động
 * trong data/backups (giữ 14 bản gần nhất). Khi đọc: file chính → .tmp → bản sao lưu mới nhất.
 */
(function (root) {
'use strict';
const USERS_FILE = 'users.json';
const BACKUP_KEEP = 14;
const LS_BASE = (root.T17Legacy && root.T17Legacy.LEGACY_STORAGE_KEY) || 'runplan-tracker-v1';
const LS_USERS = 't17-users-v1';
const U = root.T17Users;
const isDesktop = typeof root.Neutralino !== 'undefined' && typeof root.NL_PORT !== 'undefined';

let dataDir = '', backupDir = '', usersDir = '';
let pendingJson = null, pendingId = null, writing = null, timer = null; const lastBackupDay = {};
let index = U.emptyIndex();
let onError = msg => console.error(msg);
const status = { mode: isDesktop ? 'desktop' : 'web', dataDir: '', lastSavedAt: null, lastError: '', loadedFrom: '' };

const join = (...p) => p.join('/').replace(/\\/g, '/').replace(/\/+/g, '/');
async function exists(p) { try { await Neutralino.filesystem.getStats(p); return true; } catch (e) { return false; } }
async function ensureDir(p) { if (!(await exists(p))) await Neutralino.filesystem.createDirectory(p); }
function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
const pathOf = id => join(dataDir, U.fileNameFor(id));

async function pickDataDir() {
  // 1) cạnh exe (portable). 2) nếu thư mục exe không ghi được (vd. Program Files) → AppData.
  const base = (!root.NL_PATH || root.NL_PATH === '.') && root.NL_CWD ? root.NL_CWD : (root.NL_PATH || '.');
  const candidates = [join(base, 'data')];
  try { candidates.push(join(await Neutralino.os.getPath('data'), 'T17_runtracker')); } catch (e) { /* ignore */ }
  for (const dir of candidates) {
    try { await ensureDir(dir); const probe = join(dir, '.write-test'); await Neutralino.filesystem.writeFile(probe, 'ok'); await Neutralino.filesystem.remove(probe); return dir; } catch (e) { /* try next */ }
  }
  throw new Error('Không tìm được thư mục ghi dữ liệu.');
}

async function readJsonFile(p) { const txt = await Neutralino.filesystem.readFile(p); return { txt, data: root.T17Legacy.parseJsonText(txt) }; }

// ---- Chỉ mục người dùng ----
async function loadIndex() {
  if (!isDesktop) {
    try { const raw = root.localStorage.getItem(LS_USERS); if (raw) return U.normalizeIndex(JSON.parse(raw)); } catch (e) { /* tạo mới */ }
    return U.emptyIndex();
  }
  const p = join(dataDir, USERS_FILE);
  if (await exists(p)) { try { return U.normalizeIndex(JSON.parse((await Neutralino.filesystem.readFile(p)).replace(/^﻿/, ''))); } catch (e) { onError('File users.json bị lỗi — đang dò lại các hồ sơ người dùng trong thư mục data.'); } }
  const idx = U.emptyIndex();
  try { // khôi phục: mỗi file data/users/<id>.json là một người dùng
    if (await exists(usersDir)) for (const f of await Neutralino.filesystem.readDirectory(usersDir)) {
      const m = f.type === 'FILE' && /^([a-z0-9][a-z0-9_-]{0,39})\.json$/.exec(f.entry); if (!m || idx.users.some(u => u.id === m[1])) continue;
      let name = m[1]; try { const { data } = await readJsonFile(join(usersDir, f.entry)); name = U.displayName(data && data.profile, name); } catch (e) { /* giữ id */ }
      idx.users.push({ id: m[1], name, createdAt: new Date().toISOString() });
    }
  } catch (e) { /* ignore */ }
  return idx;
}
async function saveIndex() {
  const json = JSON.stringify(index, null, 2);
  if (!isDesktop) { try { root.localStorage.setItem(LS_USERS, json); } catch (e) { onError('Không lưu được danh sách người dùng.'); } return; }
  try { const p = join(dataDir, USERS_FILE); await Neutralino.filesystem.writeFile(p + '.tmp', json); await Neutralino.filesystem.copy(p + '.tmp', p, { overwrite: true, recursive: false, skip: false }); await Neutralino.filesystem.remove(p + '.tmp'); }
  catch (e) { onError('Không ghi được users.json: ' + (e.message || e)); }
}

/** Đọc dữ liệu của một người dùng. Trả về object JSON thô hoặc null nếu chưa có. */
async function loadUserData(id) {
  if (!isDesktop) {
    status.loadedFrom = 'localStorage';
    let raw = null; try { raw = root.localStorage.getItem(U.lsKeyFor(id, LS_BASE)); } catch (e) { status.lastError = 'localStorage bị chặn'; }
    return raw ? root.T17Legacy.parseJsonText(raw) : null;
  }
  const main = pathOf(id);
  for (const [p, label] of [[main, 'file'], [main + '.tmp', 'tmp']]) {
    if (await exists(p)) { try { const { data } = await readJsonFile(p); status.loadedFrom = label; return data; } catch (e) { onError(`File ${p} bị lỗi (${e.message}). Đang thử bản dự phòng…`); } }
  }
  try {
    if (await exists(backupDir)) {
      const re = new RegExp('^' + U.backupPrefixFor(id).replace(/[^a-z0-9_-]/gi, '') + '-\\d{4}-\\d{2}-\\d{2}\\.json$');
      const files = (await Neutralino.filesystem.readDirectory(backupDir)).filter(f => f.type === 'FILE' && re.test(f.entry)).map(f => f.entry).sort().reverse();
      for (const f of files) { try { const { data } = await readJsonFile(join(backupDir, f)); status.loadedFrom = 'backup:' + f; onError('Đã nạp lại từ bản sao lưu tự động ' + f + '.'); return data; } catch (e) { /* next */ } }
    }
  } catch (e) { /* ignore */ }
  if (id === U.MAIN_ID) { // lần đầu chạy exe: thử lấy dữ liệu localStorage cũ của WebView (nếu có)
    try { const raw = root.localStorage.getItem(LS_BASE); if (raw) { status.loadedFrom = 'webview-localStorage'; return root.T17Legacy.parseJsonText(raw); } } catch (e) { /* ignore */ }
  }
  status.loadedFrom = 'new';
  return null;
}

async function init(opts = {}) {
  if (opts.onError) onError = opts.onError;
  if (isDesktop) {
    await Neutralino.init();
    dataDir = await pickDataDir(); backupDir = join(dataDir, 'backups'); usersDir = join(dataDir, 'users');
    status.dataDir = dataDir;
    Neutralino.events.on('windowClose', async () => { try { await flush(); } finally { Neutralino.app.exit(); } });
  }
  index = await loadIndex();
  return loadUserData(index.activeUserId);
}

async function rotateBackups(json, id) {
  const day = today(); if (lastBackupDay[id] === day) return;
  await ensureDir(backupDir);
  const prefix = U.backupPrefixFor(id);
  const target = join(backupDir, `${prefix}-${day}.json`);
  if (!(await exists(target))) await Neutralino.filesystem.writeFile(target, json);
  lastBackupDay[id] = day;
  const re = new RegExp('^' + prefix.replace(/[^a-z0-9_-]/gi, '') + '-\\d{4}-\\d{2}-\\d{2}\\.json$');
  const files = (await Neutralino.filesystem.readDirectory(backupDir)).filter(f => f.type === 'FILE' && re.test(f.entry)).map(f => f.entry).sort();
  for (const f of files.slice(0, Math.max(0, files.length - BACKUP_KEEP))) { try { await Neutralino.filesystem.remove(join(backupDir, f)); } catch (e) { /* ignore */ } }
}

async function writeNow() {
  if (pendingJson == null) return;
  const json = pendingJson, id = pendingId; pendingJson = null;
  const dataPath = pathOf(id), tmp = dataPath + '.tmp';
  if (id !== U.MAIN_ID) await ensureDir(usersDir);
  await Neutralino.filesystem.writeFile(tmp, json);
  await Neutralino.filesystem.copy(tmp, dataPath, { overwrite: true, recursive: false, skip: false });
  await Neutralino.filesystem.remove(tmp);
  try { await rotateBackups(json, id); } catch (e) { console.warn('backup rotate', e); }
  status.lastSavedAt = new Date().toISOString(); status.lastError = '';
}
function drain() {
  if (writing) return writing;
  if (pendingJson == null) return Promise.resolve(); // không có gì để ghi (tránh kẹt `writing` khi vòng lặp kết thúc đồng bộ)
  writing = (async () => { try { while (pendingJson != null) await writeNow(); } catch (e) { status.lastError = e.message || String(e); onError('Không ghi được file dữ liệu: ' + status.lastError); } finally { writing = null; } })();
  return writing;
}

/** Lưu DB của người dùng đang chọn. Trả true nếu đã nhận lệnh lưu (desktop ghi bất đồng bộ, gộp các lần lưu liên tiếp). */
function save(db) {
  const json = JSON.stringify(db), id = index.activeUserId;
  if (!isDesktop) {
    try { root.localStorage.setItem(U.lsKeyFor(id, LS_BASE), json); status.lastSavedAt = new Date().toISOString(); return true; }
    catch (e) { status.lastError = 'localStorage đầy hoặc bị chặn'; onError('Trình duyệt không lưu được dữ liệu (localStorage đầy hoặc bị chặn). Hãy Sao lưu JSON ngay, hoặc dùng bản .exe để lưu ra file.'); return false; }
  }
  pendingJson = json; pendingId = id; clearTimeout(timer); timer = setTimeout(drain, 300); return true;
}
async function flush() { clearTimeout(timer); await drain(); }

// ---- Quản lý người dùng ----
const listUsers = () => index.users.map(u => ({ ...u }));
const activeUserId = () => index.activeUserId;
const activeUser = () => ({ ...index.users.find(u => u.id === index.activeUserId) });
/** Chuyển sang người dùng khác: ghi nốt dữ liệu đang chờ, rồi nạp dữ liệu của người đó. */
async function switchUser(id) {
  if (id === index.activeUserId) return undefined;
  await flush();
  const next = U.setActive(index, id); const raw = await loadUserData(id);
  index = next; await saveIndex(); return raw === undefined ? null : raw;
}
/** Thêm người dùng mới (chưa chuyển sang). Trả về {id,name}. */
async function createUser(name) { const r = U.addUser(index, name); index = r.index; await saveIndex(); return { ...r.user }; }
async function renameUser(id, name) { const next = U.renameUser(index, id, name); if (next === index) return; index = next; await saveIndex(); }
/** Xoá người dùng (không được xoá người đang dùng). Desktop: chuyển file vào data/deleted/ thay vì xoá hẳn. */
async function removeUser(id) {
  if (id === index.activeUserId) throw new Error('Hãy chuyển sang người dùng khác trước khi xoá.');
  const next = U.removeUser(index, id); await flush();
  if (isDesktop) {
    const p = pathOf(id);
    if (await exists(p)) { const del = join(dataDir, 'deleted'); await ensureDir(del); await Neutralino.filesystem.copy(p, join(del, `${id}-${Date.now()}.json`), { overwrite: true, recursive: false, skip: false }); await Neutralino.filesystem.remove(p); }
  } else { try { root.localStorage.removeItem(U.lsKeyFor(id, LS_BASE)); } catch (e) { /* ignore */ } }
  index = next; await saveIndex();
}

/** Lưu Blob ra file. Desktop: hộp thoại Save As; web: tải xuống. Trả về đường dẫn (desktop) hoặc tên file. */
async function saveFile(blob, name) {
  if (isDesktop) {
    const ext = (name.match(/\.([a-z0-9]+)$/i) || [])[1] || '*';
    const p = await Neutralino.os.showSaveDialog('Lưu file', { defaultPath: name, filters: [{ name: ext.toUpperCase(), extensions: [ext] }, { name: 'Tất cả', extensions: ['*'] }] });
    if (!p) return '';
    await Neutralino.filesystem.writeBinaryFile(p, await blob.arrayBuffer());
    return p;
  }
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 5000);
  return name;
}
async function openDataFolder() {
  if (!isDesktop || !dataDir) return;
  if (root.NL_OS === 'Windows') await Neutralino.os.execCommand(`explorer "${dataDir.replace(/\//g, '\\')}"`, { background: true });
  else await Neutralino.os.open('file://' + dataDir);
}

root.T17Platform = { isDesktop, init, save, flush, saveFile, openDataFolder, status, listUsers, activeUserId, activeUser, switchUser, createUser, renameUser, removeUser };
})(typeof globalThis !== 'undefined' ? globalThis : this);
