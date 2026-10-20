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
const DATA_FILE = 't17-runtracker.json';
const BACKUP_KEEP = 14;
const LS_KEY = (root.T17Legacy && root.T17Legacy.LEGACY_STORAGE_KEY) || 'runplan-tracker-v1';
const isDesktop = typeof root.Neutralino !== 'undefined' && typeof root.NL_PORT !== 'undefined';

let dataDir = '', dataPath = '', backupDir = '';
let pendingJson = null, writing = null, timer = null, lastBackupDay = '';
let onError = msg => console.error(msg);
const status = { mode: isDesktop ? 'desktop' : 'web', dataDir: '', lastSavedAt: null, lastError: '', loadedFrom: '' };

const join = (...p) => p.join('/').replace(/\\/g, '/').replace(/\/+/g, '/');
async function exists(p) { try { await Neutralino.filesystem.getStats(p); return true; } catch (e) { return false; } }
async function ensureDir(p) { if (!(await exists(p))) await Neutralino.filesystem.createDirectory(p); }
function today() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

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

async function init(opts = {}) {
  if (opts.onError) onError = opts.onError;
  if (!isDesktop) {
    status.loadedFrom = 'localStorage';
    let raw = null; try { raw = root.localStorage.getItem(LS_KEY); } catch (e) { status.lastError = 'localStorage bị chặn'; }
    return raw ? root.T17Legacy.parseJsonText(raw) : null;
  }
  await Neutralino.init();
  dataDir = await pickDataDir(); dataPath = join(dataDir, DATA_FILE); backupDir = join(dataDir, 'backups');
  status.dataDir = dataDir;
  Neutralino.events.on('windowClose', async () => { try { await flush(); } finally { Neutralino.app.exit(); } });
  for (const [p, label] of [[dataPath, 'file'], [dataPath + '.tmp', 'tmp']]) {
    if (await exists(p)) { try { const { data } = await readJsonFile(p); status.loadedFrom = label; return data; } catch (e) { onError(`File ${p} bị lỗi (${e.message}). Đang thử bản dự phòng…`); } }
  }
  try {
    if (await exists(backupDir)) {
      const files = (await Neutralino.filesystem.readDirectory(backupDir)).filter(f => f.type === 'FILE' && /\.json$/.test(f.entry)).map(f => f.entry).sort().reverse();
      for (const f of files) { try { const { data } = await readJsonFile(join(backupDir, f)); status.loadedFrom = 'backup:' + f; onError('Đã nạp lại từ bản sao lưu tự động ' + f + '.'); return data; } catch (e) { /* next */ } }
    }
  } catch (e) { /* ignore */ }
  // Lần đầu chạy exe: thử lấy dữ liệu localStorage cũ của WebView (nếu có).
  try { const raw = root.localStorage.getItem(LS_KEY); if (raw) { status.loadedFrom = 'webview-localStorage'; return root.T17Legacy.parseJsonText(raw); } } catch (e) { /* ignore */ }
  status.loadedFrom = 'new';
  return null;
}

async function rotateBackups(json) {
  const day = today(); if (lastBackupDay === day) return;
  await ensureDir(backupDir);
  const target = join(backupDir, `t17-runtracker-${day}.json`);
  if (!(await exists(target))) await Neutralino.filesystem.writeFile(target, json);
  lastBackupDay = day;
  const files = (await Neutralino.filesystem.readDirectory(backupDir)).filter(f => f.type === 'FILE' && /^t17-runtracker-\d{4}-\d{2}-\d{2}\.json$/.test(f.entry)).map(f => f.entry).sort();
  for (const f of files.slice(0, Math.max(0, files.length - BACKUP_KEEP))) { try { await Neutralino.filesystem.remove(join(backupDir, f)); } catch (e) { /* ignore */ } }
}

async function writeNow() {
  if (pendingJson == null) return;
  const json = pendingJson; pendingJson = null;
  const tmp = dataPath + '.tmp';
  await Neutralino.filesystem.writeFile(tmp, json);
  await Neutralino.filesystem.copy(tmp, dataPath, { overwrite: true, recursive: false, skip: false });
  await Neutralino.filesystem.remove(tmp);
  try { await rotateBackups(json); } catch (e) { console.warn('backup rotate', e); }
  status.lastSavedAt = new Date().toISOString(); status.lastError = '';
}
function drain() {
  if (writing) return writing;
  writing = (async () => { try { while (pendingJson != null) await writeNow(); } catch (e) { status.lastError = e.message || String(e); onError('Không ghi được file dữ liệu: ' + status.lastError); } finally { writing = null; } })();
  return writing;
}

/** Lưu DB. Trả true nếu đã nhận lệnh lưu (desktop ghi bất đồng bộ, gộp các lần lưu liên tiếp). */
function save(db) {
  const json = JSON.stringify(db);
  if (!isDesktop) {
    try { root.localStorage.setItem(LS_KEY, json); status.lastSavedAt = new Date().toISOString(); return true; }
    catch (e) { status.lastError = 'localStorage đầy hoặc bị chặn'; onError('Trình duyệt không lưu được dữ liệu (localStorage đầy hoặc bị chặn). Hãy Sao lưu JSON ngay, hoặc dùng bản .exe để lưu ra file.'); return false; }
  }
  pendingJson = json; clearTimeout(timer); timer = setTimeout(drain, 300); return true;
}
async function flush() { clearTimeout(timer); await drain(); }

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

root.T17Platform = { isDesktop, init, save, flush, saveFile, openDataFolder, status, DATA_FILE };
})(typeof globalThis !== 'undefined' ? globalThis : this);
