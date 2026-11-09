/* T17 RunTracker — CHỈ SỐ CƠ THỂ (v2.4, lượt 4). Pure, không DOM.
 *
 * db.bodyMetrics = [ { id, date "YYYY-MM-DD", time "HH:MM" | "", weightKg, bodyFatPct, muscleKg, waterPct, visceralFat, boneKg,
 *                      bmrKcal, waistCm, hipCm, chestCm, thighCm, armCm, hrRest, note, source } ]   — mọi số đo đều tuỳ chọn.
 * Khoảng hợp lý chỉ để CẢNH BÁO, không chặn. Ngày giờ theo giờ địa phương.
 * So sánh theo TỪNG TRƯỜNG: với mỗi chỉ số, mốc là bản ghi gần nhất CÓ chỉ số đó (cân thông minh và thước dây
 * thường đo vào những lần khác nhau). Chỉ so sánh trường cả hai cùng có.
 */
(function (root) {
'use strict';
const C = root.T17Core || (typeof require === 'function' ? require('./utils.js') : null);
const { norm, isYmd, excelYmd, addDaysYmd } = C;

/** good: 'down' (giảm là tốt) | 'up' (tăng là tốt) | 'neutral'. */
const FIELDS = [
  { key: 'weightKg', label: 'Cân nặng', unit: 'kg', min: 30, max: 250, dec: 1, good: 'goal', group: 'body' },
  { key: 'bodyFatPct', label: '% mỡ', unit: '%', min: 3, max: 60, dec: 1, good: 'down', group: 'body' },
  { key: 'muscleKg', label: 'Khối cơ', unit: 'kg', min: 10, max: 120, dec: 1, good: 'up', group: 'body' },
  { key: 'waterPct', label: '% nước', unit: '%', min: 30, max: 80, dec: 1, good: 'up', group: 'body' },
  { key: 'visceralFat', label: 'Mỡ nội tạng', unit: 'mức', min: 1, max: 60, dec: 0, good: 'down', group: 'body' },
  { key: 'boneKg', label: 'Khối xương', unit: 'kg', min: 0.5, max: 10, dec: 1, good: 'neutral', group: 'body' },
  { key: 'bmrKcal', label: 'BMR (cân đo)', unit: 'kcal', min: 500, max: 5000, dec: 0, good: 'neutral', group: 'body' },
  { key: 'waistCm', label: 'Vòng eo', unit: 'cm', min: 40, max: 200, dec: 1, good: 'down', group: 'tape' },
  { key: 'hipCm', label: 'Vòng hông', unit: 'cm', min: 50, max: 200, dec: 1, good: 'neutral', group: 'tape' },
  { key: 'chestCm', label: 'Vòng ngực', unit: 'cm', min: 50, max: 200, dec: 1, good: 'neutral', group: 'tape' },
  { key: 'thighCm', label: 'Vòng đùi', unit: 'cm', min: 20, max: 120, dec: 1, good: 'neutral', group: 'tape' },
  { key: 'armCm', label: 'Vòng bắp tay', unit: 'cm', min: 15, max: 80, dec: 1, good: 'neutral', group: 'tape' },
  { key: 'hrRest', label: 'Nhịp tim nghỉ', unit: 'bpm', min: 25, max: 120, dec: 0, good: 'down', group: 'other' },
];
const DERIVED = [
  { key: 'bmi', label: 'BMI', unit: '', dec: 1, good: 'neutral' },
  { key: 'ffmKg', label: 'Khối nạc (FFM)', unit: 'kg', dec: 1, good: 'up' },
  { key: 'whr', label: 'Eo / hông', unit: '', dec: 2, good: 'down' },
];
const FIELD_BY_KEY = new Map([...FIELDS, ...DERIVED].map(f => [f.key, f]));
const KEYS = FIELDS.map(f => f.key);
const NEAR_DAYS = 3;
const str = v => v == null ? '' : String(v);
const pad = n => String(n).padStart(2, '0');
const round = (v, d) => { const p = 10 ** d; return Math.round(v * p) / p; };

/* ---------- số, ngày, giờ ---------- */
/** "1,5" / "1.5" / 1.5 / "1.234,5" → số; "", "-", "—" → ''. bmr "1.650" (dấu chấm ngăn nghìn kiểu VN) → 1650. */
function num(v, key) {
  if (v == null) return '';
  if (typeof v === 'number') return Number.isFinite(v) ? v : '';
  let s = str(v).trim().replace(/\s+/g, '').replace(/[^\d.,-]/g, '');
  if (!s || s === '-' || /^-+$/.test(s)) return '';
  if (s.includes('.') && s.includes(',')) s = s.lastIndexOf(',') > s.lastIndexOf('.') ? s.replace(/\./g, '').replace(',', '.') : s.replace(/,/g, '');
  else if (key === 'bmrKcal' && /^\d{1,2}[.,]\d{3}$/.test(s)) s = s.replace(/[.,]/, '');
  else s = s.replace(',', '.');
  const n = Number(s); return Number.isFinite(n) ? n : '';
}
function nowLocal(d = new Date()) { return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` }; }
/** Ngày + giờ từ một chuỗi (ngày trần, dd/mm/yyyy, "yyyy-mm-dd HH:MM", ISO có múi giờ → giờ địa phương) hoặc serial Excel. */
function parseDateTime(v, tzOffsetMin) {
  if (v == null || v === '') return { date: '', time: '' };
  if (typeof v === 'number') { const date = excelYmd(v); const frac = v - Math.floor(v); const mins = Math.round(frac * 1440) % 1440; return { date: isYmd(date) ? date : '', time: frac > 0 ? `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}` : '' }; }
  const s = str(v).trim();
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})$/i.test(s)) {
    const ms = Date.parse(s); if (!Number.isFinite(ms)) return { date: '', time: '' };
    const off = tzOffsetMin == null ? new Date(ms).getTimezoneOffset() : tzOffsetMin; const d = new Date(ms - off * 60000);
    return { date: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`, time: `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` };
  }
  const date = excelYmd(s); const m = s.match(/[ T](\d{1,2}):(\d{2})/);
  return { date: isYmd(date) ? date : '', time: m && +m[1] < 24 && +m[2] < 60 ? `${pad(m[1])}:${m[2]}` : '' };
}
function normTime(t) { const m = str(t).trim().match(/^(\d{1,2}):(\d{2})/); return m && +m[1] < 24 && +m[2] < 60 ? `${pad(m[1])}:${m[2]}` : ''; }
const stamp = r => `${r.date} ${r.time || ''}`;

/* ---------- bản ghi ---------- */
function newId() { return 'bm-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
/** Chuẩn hoá một bản ghi; null nếu không có ngày hoặc không có số đo / ghi chú nào. Field lạ giữ nguyên. */
function normalizeRecord(r, opts = {}) {
  if (!r || typeof r !== 'object') return null;
  const o = { ...r };
  let date = isYmd(r.date) ? r.date : '', time = normTime(r.time);
  if (!date) { const p = parseDateTime(r.date ?? r.datetime, opts.tzOffsetMin); date = p.date; if (!time) time = p.time; }
  if (!date) return null;
  o.date = date; o.time = time; o.id = str(r.id) || newId();
  for (const k of KEYS) { if (!(k in r)) continue; const n = num(r[k], k); if (n === '' || n < 0) delete o[k]; else o[k] = n; }
  o.note = str(r.note).slice(0, 500); if (!o.note) delete o.note;
  if (!KEYS.some(k => typeof o[k] === 'number') && !o.note) return null;
  return o;
}
/** Danh sách đã chuẩn hoá, sắp theo ngày giờ, id không trùng. */
function normalizeList(list, opts = {}) {
  const seen = new Set(); const out = [];
  for (const r of Array.isArray(list) ? list : []) { const o = normalizeRecord(r, opts); if (!o) continue; if (seen.has(o.id)) o.id = newId(); seen.add(o.id); out.push(o); }
  return out.sort((a, b) => stamp(a).localeCompare(stamp(b)));
}
/** Cảnh báo (không chặn): ngoài khoảng hợp lý, ngày trong tương lai. */
function warnings(r, opts = {}) {
  const out = [];
  for (const f of FIELDS) { const v = r?.[f.key]; if (typeof v !== 'number') continue; if (v < f.min || v > f.max) out.push({ key: f.key, message: `${f.label} ${v} ${f.unit} nằm ngoài khoảng thường gặp (${f.min}–${f.max} ${f.unit}). Kiểm tra lại nếu gõ nhầm.` }); }
  if (typeof r?.muscleKg === 'number' && typeof r?.weightKg === 'number' && r.muscleKg > r.weightKg) out.push({ key: 'muscleKg', message: 'Khối cơ lớn hơn cân nặng — kiểm tra lại.' });
  const today = opts.today || nowLocal().date; if (r?.date && r.date > today) out.push({ key: 'date', message: 'Ngày đo ở tương lai.' });
  return out;
}
/** Chỉ số suy ra: BMI (cần chiều cao hồ sơ), khối nạc FFM = cân × (1 − %mỡ), eo/hông. */
function derived(r, profile) {
  const out = {}; const h = Number(str(profile?.heightCm).replace(',', '.')) / 100, w = r?.weightKg;
  if (typeof w === 'number' && h > 0.5 && h < 2.5) out.bmi = round(w / (h * h), 1);
  if (typeof w === 'number' && typeof r?.bodyFatPct === 'number') out.ffmKg = round(w * (1 - r.bodyFatPct / 100), 1);
  if (typeof r?.waistCm === 'number' && typeof r?.hipCm === 'number' && r.hipCm > 0) out.whr = round(r.waistCm / r.hipCm, 2);
  return out;
}
const valueOf = (r, key, profile) => typeof r?.[key] === 'number' ? r[key] : derived(r, profile)[key];

/* ---------- so sánh ---------- */
const daysBetween = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
/** Bản ghi mốc CÓ trường `key` theo kiểu mốc. ref: {kind:'prev'} | {kind:'days', days:N} | {kind:'first'} | {kind:'date', date}.
 *  'days'/'date': lấy bản gần ngày mục tiêu nhất trong ±3 ngày; không có thì lấy bản gần nhất (offsetDays cho biết lệch). */
function findRef(list, record, key, ref, profile) {
  const before = (list || []).filter(x => x !== record && x.id !== record.id && stamp(x) < stamp(record) && valueOf(x, key, profile) != null);
  if (!before.length) return null;
  if (ref.kind === 'prev') return { record: before[before.length - 1], target: '', offsetDays: 0 };
  if (ref.kind === 'first') return { record: before[0], target: '', offsetDays: 0 };
  const target = ref.kind === 'days' ? addDaysYmd(record.date, -Math.abs(ref.days || 0)) : ref.date;
  if (!isYmd(target)) return null;
  let best = null, bestD = Infinity;
  for (const x of before) { const d = Math.abs(daysBetween(target, x.date)); if (d < bestD || (d === bestD && stamp(x) > stamp(best))) { best = x; bestD = d; } }
  return { record: best, target, offsetDays: daysBetween(target, best.date), near: bestD <= NEAR_DAYS };
}
/** So sánh bản ghi với mốc, từng trường (kể cả BMI / FFM / eo-hông). → [{ key, label, unit, from, to, delta, pct, refDate, offsetDays, near, assess }] */
function compare(list, record, ref, profile) {
  const out = [];
  for (const f of [...FIELDS, ...DERIVED]) {
    const to = valueOf(record, f.key, profile); if (to == null) continue;
    const r = findRef(list, record, f.key, ref, profile); if (!r) continue;
    const from = valueOf(r.record, f.key, profile); const delta = round(to - from, f.dec + 1);
    out.push({ key: f.key, label: f.label, unit: f.unit, from, to, delta, pct: from ? round((to - from) / from * 100, 1) : null, refDate: r.record.date, refTime: r.record.time || '', target: r.target, offsetDays: r.offsetDays, near: r.near !== false, assess: assess(f.key, from, to, profile) });
  }
  return out;
}
/** 'good' | 'bad' | 'neutral' theo Ý NGHĨA của chỉ số. Cân nặng: trung tính, trừ khi hồ sơ có cân nặng mục tiêu. */
function assess(key, from, to, profile) {
  const f = FIELD_BY_KEY.get(key); if (!f || from == null || to == null || to === from) return 'neutral';
  if (f.good === 'goal') { const g = Number(str(profile?.weightGoalKg).replace(',', '.')); if (!(g > 0)) return 'neutral'; const a = Math.abs(from - g), b = Math.abs(to - g); return b < a ? 'good' : b > a ? 'bad' : 'neutral'; }
  if (f.good === 'down') return to < from ? 'good' : 'bad';
  if (f.good === 'up') return to > from ? 'good' : 'bad';
  return 'neutral';
}
/** Bản mới nhất có từng trường (thẻ tóm tắt dùng). → Map(key → record) */
function latestByField(list, profile) { const m = new Map(); for (const r of list || []) for (const f of [...FIELDS, ...DERIVED]) if (valueOf(r, f.key, profile) != null) m.set(f.key, r); return m; }

/* ---------- xu hướng ---------- */
/** Giá trị theo ngày (nhiều lần/ngày → trung bình trong ngày), trung bình trượt 7 ngày lịch, độ dốc (đơn vị/tuần, hồi quy tuyến tính
 *  trên `windowDays` ngày gần nhất có dữ liệu, mặc định 28). */
function trend(list, key = 'weightKg', opts = {}) {
  const byDay = new Map();
  for (const r of list || []) { const v = valueOf(r, key, opts.profile); if (v == null) continue; const a = byDay.get(r.date) || []; a.push(v); byDay.set(r.date, a); }
  const days = [...byDay.keys()].sort();
  const points = days.map(d => { const vals = byDay.get(d); return { date: d, value: vals.reduce((a, b) => a + b, 0) / vals.length, count: vals.length }; });
  for (const p of points) { const win = points.filter(q => q.date <= p.date && daysBetween(q.date, p.date) < 7); p.ma7 = win.reduce((a, b) => a + b.value, 0) / win.length; }
  let slopePerWeek = null; const windowDays = opts.windowDays || 28;
  if (points.length >= 2) {
    const last = points[points.length - 1].date; const pts = points.filter(p => daysBetween(p.date, last) < windowDays);
    if (pts.length >= 2) { const xs = pts.map(p => daysBetween(pts[0].date, p.date)), ys = pts.map(p => p.value); const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
      const sxx = xs.reduce((a, x) => a + (x - mx) ** 2, 0); if (sxx > 0) slopePerWeek = xs.reduce((a, x, i) => a + (x - mx) * (ys[i] - my), 0) / sxx * 7; }
  }
  return { key, points, slopePerWeek, lastMa7: points.length ? points[points.length - 1].ma7 : null };
}

/* ---------- gộp ---------- */
/** Gộp bản ghi mới vào danh sách, KHÔNG nhân đôi: khoá = ngày + giờ. Trùng khoá: điền thêm trường còn thiếu,
 *  giá trị khác nhau thì GIỮ bản đang có (đếm vào conflicts). → { list, added, merged, duplicates, conflicts } */
function merge(list, incoming) {
  const out = normalizeList(list); const byKey = new Map(out.map(r => [stamp(r), r]));
  const res = { added: 0, merged: 0, duplicates: 0, conflicts: 0 };
  for (const r0 of incoming || []) {
    const r = normalizeRecord({ ...r0, id: undefined }); if (!r) continue;
    const cur = byKey.get(stamp(r));
    if (!cur) { out.push(r); byKey.set(stamp(r), r); res.added++; continue; }
    let filled = 0, conflict = 0;
    for (const k of [...KEYS, 'note']) { if (r[k] == null || r[k] === '') continue; if (cur[k] == null || cur[k] === '') { cur[k] = r[k]; filled++; } else if (cur[k] !== r[k]) conflict++; }
    if (filled) res.merged++; else if (!conflict) res.duplicates++; if (conflict) res.conflicts++;
  }
  return { ...res, list: out.sort((a, b) => stamp(a).localeCompare(stamp(b))) };
}

/* ---------- CSV / Excel ---------- */
const HEADER_ALIASES = {
  date: ['date', 'ngay', 'ngay do', 'datetime', 'date time', 'thoi gian', 'time stamp', 'timestamp', 'measure time', 'ngay gio'],
  time: ['time', 'gio', 'gio do'],
  weightKg: ['weight', 'weight kg', 'can nang', 'can nang kg', 'can', 'body weight', 'kg'],
  bodyFatPct: ['body fat', 'body fat %', 'fat', 'fat %', 'bodyfat', 'body fat rate', 'mo', '% mo', 'ti le mo', 'ty le mo', 'mo co the', 'body fat percentage'],
  muscleKg: ['muscle', 'muscle mass', 'muscle kg', 'skeletal muscle', 'khoi co', 'co', 'khoi luong co'],
  waterPct: ['water', 'body water', 'water %', 'nuoc', '% nuoc', 'ti le nuoc', 'ty le nuoc'],
  visceralFat: ['visceral fat', 'visceral', 'mo noi tang'],
  boneKg: ['bone', 'bone mass', 'khoi xuong', 'xuong'],
  bmrKcal: ['bmr', 'basal metabolism', 'bmr kcal', 'trao doi chat', 'trao doi chat co ban'],
  waistCm: ['waist', 'waist cm', 'eo', 'vong eo'],
  hipCm: ['hip', 'hips', 'hip cm', 'hong', 'vong hong', 'vong mong', 'mong'],
  chestCm: ['chest', 'nguc', 'vong nguc'],
  thighCm: ['thigh', 'dui', 'vong dui'],
  armCm: ['arm', 'bicep', 'biceps', 'bap tay', 'vong bap tay', 'vong tay'],
  hrRest: ['resting hr', 'resting heart rate', 'rhr', 'nhip tim nghi', 'hr nghi'],
  note: ['note', 'notes', 'ghi chu', 'comment', 'comments', 'remark', 'remarks'],
};
const ALIAS = new Map(); for (const [k, list] of Object.entries(HEADER_ALIASES)) for (const a of list) ALIAS.set(a, k);
/** Tên cột → khoá ('' nếu không nhận ra). Bỏ dấu, bỏ đơn vị trong ngoặc. */
function headerKey(h) { const n = norm(str(h).replace(/\([^)]*\)|\[[^\]]*\]/g, ' ')).replace(/[^a-z0-9%]+/g, ' ').trim(); return ALIAS.get(n) || ALIAS.get(n.replace(/%/g, '').trim()) || (KEYS.includes(str(h).trim()) ? str(h).trim() : ''); }
/** Mảng hàng (hàng đầu là tiêu đề) → { records, errors:[{row, message}], columns:{key:header}, unknownColumns } */
function fromAoa(aoa, opts = {}) {
  const rows = (aoa || []).filter(r => Array.isArray(r) && r.some(c => str(c).trim() !== ''));
  if (!rows.length) return { records: [], errors: [{ row: 0, message: 'File không có dữ liệu.' }], columns: {}, unknownColumns: [] };
  const head = rows[0].map(str); const map = head.map(headerKey); const columns = {}; const unknownColumns = [];
  head.forEach((h, i) => { if (map[i]) columns[map[i]] = h; else if (h.trim()) unknownColumns.push(h); });
  if (!map.includes('date')) return { records: [], errors: [{ row: 1, message: 'Không tìm thấy cột ngày (Date / Ngày).' }], columns, unknownColumns };
  if (!map.some(k => KEYS.includes(k))) return { records: [], errors: [{ row: 1, message: 'Không có cột số đo nào nhận ra được (cân nặng, % mỡ, vòng eo…).' }], columns, unknownColumns };
  const records = [], errors = [];
  rows.slice(1).forEach((r, i) => {
    const o = { source: opts.source || 'csv' }; let dt = { date: '', time: '' };
    map.forEach((k, c) => { if (!k) return; const v = r[c]; if (k === 'date') dt = parseDateTime(v, opts.tzOffsetMin); else if (k === 'time') { const t = normTime(v); if (t) o.time = t; } else if (k === 'note') o.note = str(v); else o[k] = num(v, k); });
    o.date = dt.date; if (!o.time) o.time = dt.time;
    const rec = normalizeRecord(o, opts);
    if (!rec) errors.push({ row: i + 2, message: o.date ? 'Dòng không có số đo nào.' : `Ngày không đọc được: “${str(r[map.indexOf('date')])}”.` });
    else records.push(rec);
  });
  return { records, errors, columns, unknownColumns };
}
/** Tách CSV (tự nhận dấu phân cách ; , tab theo dòng tiêu đề; hỗ trợ ngoặc kép). */
function parseCsvRows(text) {
  const s = str(text).replace(/^﻿/, ''); const first = s.split(/\r?\n/)[0] || '';
  const delim = [';', '\t', ','].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) { if (ch === '"') { if (s[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
    if (ch === '"') q = true; else if (ch === delim) { row.push(cell); cell = ''; } else if (ch === '\n' || ch === '\r') { if (ch === '\r' && s[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; } else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return { rows, delimiter: delim };
}
function parseCsv(text, opts = {}) { const { rows, delimiter } = parseCsvRows(text); return { ...fromAoa(rows, opts), delimiter }; }
/** Tiêu đề xuất (tiếng Việt kèm đơn vị) — đọc lại được bằng fromAoa. */
function exportHeader() { return ['Ngày', 'Giờ', ...FIELDS.map(f => `${f.label} (${f.unit})`), 'Ghi chú']; }
/** Bảng (Excel) — ngày yyyy-mm-dd, số là số. */
function toAoa(list) { return [exportHeader(), ...normalizeList(list).map(r => [r.date, r.time || '', ...FIELDS.map(f => typeof r[f.key] === 'number' ? r[f.key] : ''), r.note || ''])]; }
/** CSV cho Excel tiếng Việt: dấu ; phân cách, dấu phẩy thập phân, ngày dd/mm/yyyy, có BOM UTF-8. */
function toCsv(list) {
  const cell = v => { const t = typeof v === 'number' ? String(v).replace('.', ',') : str(v); return /[;"\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  const rows = toAoa(list).map((r, i) => i === 0 ? r : [r[0].split('-').reverse().join('/'), ...r.slice(1)]);
  return '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n') + '\r\n';
}

const api = { FIELDS, DERIVED, KEYS, NEAR_DAYS, FIELD_BY_KEY, num, nowLocal, parseDateTime, normTime, normalizeRecord, normalizeList, warnings, derived, valueOf, findRef, compare, assess, latestByField, trend, merge, headerKey, fromAoa, parseCsvRows, parseCsv, toAoa, toCsv, exportHeader, newId };
root.T17Body = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
