// npm run compat — MA TRẬN TƯƠNG THÍCH giữa các phiên bản (lượt 7).
//
// Mỗi phiên bản (RunPlan v1.8.9, T17 v2.0.0, v2.1.1, v2.2.0 và bản hiện tại) được dựng từ git worktree (.compat/<tên>),
// rồi CHẠY THẬT bản web một file trong jsdom:
//   1. GHI : nạp bộ dữ liệu điển hình của phiên bản đó → bấm “Sao lưu” → lấy file JSON mà chính phiên bản đó xuất ra.
//   2. ĐỌC : đặt file đó vào kho của phiên bản đọc → khởi động → so `db` với cách bản ghi tự đọc file của mình.
//   3. GHI LẠI : phiên bản đọc sao lưu lại → so trường (đường dẫn JSON) với file gốc → “mất trường nào”.
//   4. KHỨ HỒI : bản hiện tại đọc lại file vừa ghi lại → so toàn bộ với bản hiện tại đọc file gốc.
// Tiêu chí (không sửa tiêu chí, ô nào trượt thì sửa mã):
//   - bản cũ đọc file mới: không lỗi, KHÔNG mất dữ liệu chạy bộ (v2.2.0: không mất trường nào).
//   - bản mới đọc file cũ: dữ liệu chạy bộ bằng đúng cách bản cũ tự đọc.
// Kết quả: bảng in ra màn hình + .compat/report.md ; mã thoát 1 nếu có ô không đạt.
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { JSDOM, VirtualConsole } = require('jsdom');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WT = path.join(ROOT, '.compat');
const FX = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/fixtures', f), 'utf8'));
const wait = ms => new Promise(r => setTimeout(r, ms));
const sh = (cmd, cwd = ROOT) => execSync(cmd, { cwd, stdio: ['ignore', 'pipe', 'pipe'] }).toString();

/* ---------- các phiên bản ---------- */
// v2.0.0 không có tag trên GitHub → dùng commit phát hành 717ba8f.
const VERSIONS = [
  { name: 'v1.8.9', html: () => path.join(ROOT, 'legacy/runplan_tracker_v1_8_9.html'), data: () => FX('runplan-v189-backup.json') },
  { name: 'v2.0.0', ref: '717ba8f', data: () => FX('runplan-v189-backup.json') },
  { name: 'v2.1.1', ref: 'v2.1.1', data: () => ({ ...FX('runplan-v189-backup.json'), profile: { sex: 'male', hrRest: 50, hrMax: 186, lthr: 168, thresholdPace: '5:05', weightKg: 68 } }) },
  { name: 'v2.2.0', ref: 'v2.2.0', data: () => FX('t17-v22-multiuser/t17-runtracker.json') },
  { name: 'hiện tại', ref: null, data: () => FX('t17-v25-full.json') },
];
function prepare(v) {
  if (v.html) return v.html();
  let dir = ROOT;
  if (v.ref) {
    dir = path.join(WT, v.name);
    if (!fs.existsSync(dir)) { fs.mkdirSync(WT, { recursive: true }); sh(`git worktree add --detach "${dir}" ${v.ref}`); }
  }
  sh('node scripts/build.mjs', dir);
  return path.join(dir, 'dist/web/T17_runtracker.html');
}

/* ---------- chạy một phiên bản trong jsdom ---------- */
async function boot(htmlFile, stored) {
  const errors = [], blobs = [];
  const vc = new VirtualConsole(); vc.on('jsdomError', e => errors.push(e.message));
  const dom = new JSDOM(fs.readFileSync(htmlFile, 'utf8'), { runScripts: 'dangerously', url: 'http://localhost/', virtualConsole: vc, pretendToBeVisual: true, beforeParse(w) {
    w.TextEncoder = TextEncoder; w.TextDecoder = TextDecoder; w.DecompressionStream = DecompressionStream;
    w.alert = m => errors.push('alert: ' + m); w.confirm = () => true; w.prompt = () => ''; w.scrollTo = () => {}; w.HTMLElement.prototype.scrollIntoView = () => {};
    w.URL.createObjectURL = b => { blobs.push(b); return 'blob:x'; }; w.URL.revokeObjectURL = () => {}; w.HTMLAnchorElement.prototype.click = function () {};
    if (stored != null) w.localStorage.setItem('runplan-tracker-v1', typeof stored === 'string' ? stored : JSON.stringify(stored));
  } });
  const w = dom.window; await wait(400);
  let db = null; try { db = JSON.parse(w.eval('JSON.stringify(db)')); } catch (e) { errors.push('không đọc được db: ' + e.message); }
  const backup = async () => {
    const n = blobs.length; const btn = w.document.getElementById('backupBtn'); if (!btn) { errors.push('không có nút Sao lưu'); return null; }
    btn.click(); for (let t = 0; t < 40 && blobs.length === n; t++) await wait(25);
    if (blobs.length === n) { errors.push('Sao lưu không tạo file'); return null; }
    const b = blobs.at(-1); const txt = await new Promise(res => { const fr = new w.FileReader(); fr.onload = () => res(fr.result); fr.readAsText(b); }); return JSON.parse(txt);
  };
  // Tự xác nhận mọi hộp thoại trong app (chọn khoảng ngày để trống = tất cả, nút mặc định).
  const auto = w.setInterval(() => { for (const d of w.document.querySelectorAll('.ui-dialog')) { const f = d.querySelector('form'); if (f && !f.dataset.auto) { f.dataset.auto = '1'; f.dispatchEvent(new w.Event('submit', { cancelable: true, bubbles: true })); } } }, 20);
  const exportVia = async btnId => {
    const n = blobs.length; w.document.getElementById(btnId).click(); for (let t = 0; t < 80 && blobs.length === n; t++) await wait(25);
    if (blobs.length === n) { errors.push(`${btnId} không tạo file`); return null; }
    const b = blobs.at(-1); return new Promise(res => { const fr = new w.FileReader(); fr.onload = () => res(new Uint8Array(fr.result)); fr.readAsArrayBuffer(b); });
  };
  const importVia = async (inputId, bytes, name) => {
    const input = w.document.getElementById(inputId); const f = new w.File([bytes], name);
    Object.defineProperty(input, 'files', { value: [f], configurable: true }); input.dispatchEvent(new w.Event('change', { bubbles: true }));
    await wait(700); try { return JSON.parse(w.eval('JSON.stringify(db)')); } catch (e) { errors.push('không đọc được db: ' + e.message); return null; }
  };
  return { w, db, errors, backup, exportVia, importVia, close: () => { w.clearInterval(auto); w.close(); } };
}

/* ---------- so sánh ---------- */
const s = v => v == null ? '' : String(v);
const workoutsOf = db => (db?.weeks || []).flatMap(wk => (wk.days || []).flatMap(d => (d.workouts || []).map(it => ({ date: d.date, it }))));
/** Dữ liệu CHẠY BỘ chuẩn hoá (bỏ id, bỏ field mở rộng), sắp xếp để so như tập hợp. */
function running(db, opt = {}) {
  return workoutsOf(db).map(({ date, it }) => {
    if (opt.fitnessAsPlain && it.workoutType === 'Fitness') it = { ...it, workoutType: '' };
    const a = it.actual;
    return JSON.stringify([date, s(it.workoutName), s(it.workoutType), s(it.planKm), s(it.planMinutes), s(it.description).trim(), s(it.planNote), JSON.stringify(it.workoutStructure || null),
      a ? [a.status || 'done', s(a.km), s(a.minutes), s(a.fatigue), s(a.calories), s(a.avgHr), s(a.maxHr), s(a.note), (a.segments || []).length, a.fitImport?.id || ''] : null]);
  }).sort();
}
function diffRunning(a, b, opt) {
  const A = running(a, opt), B = running(b, opt); if (JSON.stringify(A) === JSON.stringify(B)) return '';
  const missing = A.filter(x => !B.includes(x)).length, extra = B.filter(x => !A.includes(x)).length;
  if (process.env.COMPAT_DEBUG) console.log('  thiếu:', A.filter(x => !B.includes(x)), '\n  lạ:', B.filter(x => !A.includes(x)));
  return `chạy bộ khác: ${A.length}→${B.length} bài, ${missing} bài không khớp${extra ? `, ${extra} bài lạ` : ''}`;
}
const VOLATILE = new Set(['exportedAt', 'appVersion', 'schemaVersion', 'app', 'savedAt', 'updatedAt']);
/** Tập đường dẫn lá (chỉ số mảng → []), bỏ field thay đổi theo thời điểm. */
function paths(o, p = '', out = new Set()) {
  if (Array.isArray(o)) { if (!o.length) out.add(p + '[]'); o.forEach(x => paths(x, p + '[]', out)); }
  else if (o && typeof o === 'object') { const ks = Object.keys(o); if (!ks.length) out.add(p + '{}'); for (const k of ks) if (!VOLATILE.has(k)) paths(o[k], p ? `${p}.${k}` : k, out); }
  else out.add(p);
  return out;
}
function lostFields(src, dst) {
  const D = paths(dst); const lost = [...paths(src)].filter(x => !D.has(x));
  // gộp theo nhánh gốc để bảng dễ đọc
  const roots = new Map(); for (const x of lost) { const r = x.replace(/^weeks\[\]\.days\[\]\.workouts\[\]\./, 'workout.').split('.').slice(0, 2).join('.').replace(/\[\]$/, ''); roots.set(r, (roots.get(r) || 0) + 1); }
  return [...roots.keys()];
}
// Trường mở rộng (không phải chạy bộ) — bản cũ hơn bản giới thiệu chúng được phép bỏ qua, nhưng phải báo.
const isRunningField = f => /^(weeks|workout\.(actual|workoutName|workoutType|planKm|planMinutes|description|planNote|workoutStructure|id))/.test(f) && !/fitness/.test(f);

/* ---------- chạy ma trận ---------- */
const order = VERSIONS.map(v => v.name), idx = n => order.indexOf(n);
const rows = []; let fail = 0;
const htmls = {}; for (const v of VERSIONS) { process.stdout.write(`Dựng ${v.name}… `); htmls[v.name] = prepare(v); console.log('xong'); }
const files = {}, self = {};
for (const v of VERSIONS) {
  const app = await boot(htmls[v.name], v.data()); const f = await app.backup(); app.close();
  if (!f || app.errors.length) { console.error(`✗ ${v.name} không ghi được file:`, app.errors); process.exit(1); }
  files[v.name] = f;
  const me = await boot(htmls[v.name], f); self[v.name] = me.db; me.close();
}
const current = VERSIONS.at(-1).name;
for (const W of VERSIONS) for (const R of VERSIONS) {
  const file = files[W.name];
  const app = await boot(htmls[R.name], file); const re = app.db ? await app.backup() : null; const errs = app.errors.slice(); app.close();
  const cell = { writer: W.name, reader: R.name, ok: true, notes: [] };
  if (errs.length || !app.db) { cell.ok = false; cell.notes.push('LỖI: ' + errs.join(' | ')); }
  else {
    const dr = diffRunning(self[W.name], app.db); if (dr) { cell.ok = false; cell.notes.push(dr); }
    const lost = re ? lostFields(file, re) : ['(không sao lưu được)'];
    const lostRun = lost.filter(isRunningField);
    if (lostRun.length) { cell.ok = false; cell.notes.push('mất trường chạy bộ: ' + lostRun.join(', ')); }
    if (R.name === 'v2.2.0' && lost.length) { cell.ok = false; cell.notes.push('v2.2.0 mất: ' + lost.join(', ')); }
    else if (lost.length) cell.notes.push('bỏ qua phần mở rộng: ' + lost.join(', '));
    // khứ hồi: bản hiện tại đọc lại file mà R vừa ghi
    if (re && idx(R.name) < idx(W.name)) {
      const back = await boot(htmls[current], re), direct = await boot(htmls[current], file);
      const d2 = diffRunning(direct.db, back.db); if (d2) { cell.ok = false; cell.notes.push('khứ hồi: ' + d2); }
      if (R.name === 'v2.2.0') { const l2 = lostFields(direct.db, back.db); if (l2.length) { cell.ok = false; cell.notes.push('khứ hồi mất: ' + l2.join(', ')); } }
      if (back.errors.length) { cell.ok = false; cell.notes.push('khứ hồi lỗi: ' + back.errors.join(' | ')); }
      back.close(); direct.close();
    }
  }
  if (!cell.ok) fail++;
  rows.push(cell);
}

/* ---------- định dạng chia sẻ: Xuất bài tập (JSON) và Excel → nhập vào kho TRỐNG ---------- */
const FORMATS = [{ key: 'plan', label: 'Xuất bài tập (JSON)', exp: 'exportPlanBtn', imp: 'importPlanFile', name: 'ke-hoach.json' }, { key: 'xlsx', label: 'Excel', exp: 'exportBtn', imp: 'importFile', name: 'lich.xlsx' }];
const EMPTY = { weeks: [], templates: [], templatesSeeded: true };
const fmtRows = [];
for (const F of FORMATS) {
  const out = {}, selfImp = {};
  for (const W of VERSIONS) { const app = await boot(htmls[W.name], files[W.name]); out[W.name] = await app.exportVia(F.exp); const e = app.errors.slice(); app.close(); if (!out[W.name]) { console.error(`✗ ${W.name} không xuất được ${F.label}:`, e); process.exit(1); } }
  for (const W of VERSIONS) { const app = await boot(htmls[W.name], EMPTY); selfImp[W.name] = await app.importVia(F.imp, out[W.name], F.name); app.close(); }
  for (const W of VERSIONS) for (const R of VERSIONS) {
    const app = await boot(htmls[R.name], EMPTY); const got = await app.importVia(F.imp, out[W.name], F.name); const errs = app.errors.filter(x => !/^alert: (Đã|Nhập|Import)/.test(x)); app.close();
    const cell = { format: F.key, writer: W.name, reader: R.name, ok: true, notes: [] };
    if (errs.length || !got) { cell.ok = false; cell.notes.push('LỖI: ' + errs.join(' | ')); }
    else { const n = workoutsOf(got).length; let dr = diffRunning(selfImp[W.name], got);
      // Bản đọc ra đời TRƯỚC fitness (< v2.3): Excel/kế hoạch đời cũ không có chỗ cho loại bài → bài fitness thành bài thường.
      // Chỉ chấp nhận khi phần còn lại (dữ liệu chạy bộ, tên, thời lượng, mô tả) khớp hoàn toàn.
      if (dr && idx(R.name) < idx('hiện tại') && !diffRunning(selfImp[W.name], got, { fitnessAsPlain: true })) { dr = ''; cell.notes.push('bài fitness nhập thành bài thường (định dạng đời cũ không có loại bài); dữ liệu chạy bộ khớp'); }
      if (dr) { cell.ok = false; cell.notes.push(dr); } if (!n) { cell.ok = false; cell.notes.push('không nhập được bài nào'); } cell.n = n; }
    if (!cell.ok) fail++;
    fmtRows.push(cell);
  }
}

/* ---------- in bảng ---------- */
const mark = c => (c.ok ? (c.notes.length ? '✓*' : '✓') : '✗');
let md = `# Ma trận tương thích (${new Date().toISOString().slice(0, 16).replace('T', ' ')})\n\nHàng = phiên bản GHI file sao lưu, cột = phiên bản ĐỌC. ✓ đạt · ✓* đạt, có ghi chú · ✗ không đạt.\n\n| ghi \\ đọc | ${order.join(' | ')} |\n|---|${order.map(() => ':-:').join('|')}|\n`;
for (const W of order) md += `| **${W}** | ${order.map(R => mark(rows.find(c => c.writer === W && c.reader === R))).join(' | ')} |\n`;
for (const F of FORMATS) {
  md += `\n### ${F.label} → nhập vào kho trống\n\n| xuất \\ nhập | ${order.join(' | ')} |\n|---|${order.map(() => ':-:').join('|')}|\n`;
  for (const W of order) md += `| **${W}** | ${order.map(R => { const c = fmtRows.find(x => x.format === F.key && x.writer === W && x.reader === R); return `${mark(c)} ${c.n ?? ''}`; }).join(' | ')} |\n`;
}
md += '\nSố trong ô = số bài nhập được. So sánh với chính phiên bản xuất nhập lại file của mình.\n';
md += '\n## Ghi chú từng ô\n\n';
for (const c of fmtRows) if (c.notes.length) md += `- **${c.format}: ${c.writer} → ${c.reader}** ${mark(c)}: ${c.notes.join('; ')}\n`;
for (const c of rows) if (c.notes.length) md += `- **${c.writer} → ${c.reader}** ${mark(c)}: ${c.notes.join('; ')}\n`;
md += `\nDữ liệu ghi: v1.8.9/v2.0.0 = \`runplan-v189-backup.json\`; v2.1.1 = như trên + hồ sơ VĐV; v2.2.0 = \`t17-v22-multiuser\`; hiện tại = \`t17-v25-full.json\` (chạy bộ + fitness + thư viện ảnh + chỉ số cơ thể + cài đặt calo).\n`;
fs.mkdirSync(WT, { recursive: true }); fs.writeFileSync(path.join(WT, 'report.md'), md);
console.log('\n' + md);
console.log(fail ? `✗ ${fail} ô không đạt` : '✓ Mọi ô đạt tiêu chí');
process.exit(fail ? 1 : 0);
