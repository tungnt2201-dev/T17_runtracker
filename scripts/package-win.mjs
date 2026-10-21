// Sau `neu build --release --embed-resources`: tạo gói phát hành
//   release/yymmdd_T17_runtracker_vX.Y.Z.zip
//     ├─ T17_runtracker.exe        (tên cố định → giải nén đè bản cũ, thư mục data\ giữ nguyên)
//     ├─ T17_runtracker_web.html   (bản chạy bằng trình duyệt)
//     ├─ HUONG_DAN.txt
//     ├─ CHANGELOG.md
//     └─ Huong_dan_su_dung_T17_RunTracker.docx
// yymmdd = ngày build theo giờ Việt Nam. Ghi đè bằng biến môi trường BUILD_DATE=yymmdd nếu cần.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

export function buildDateVN(d = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', year: '2-digit', month: '2-digit', day: '2-digit' }).formatToParts(d).map(p => [p.type, p.value]));
  return `${parts.year}${parts.month}${parts.day}`;
}
export function releaseBaseName(version, date = process.env.BUILD_DATE || buildDateVN()) { return `${date}_T17_runtracker_v${version}`; }

const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function dosTime(d) { return { time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() }; }

/** ZIP deflate tối giản (không cần thư viện). entries: [{name, data:Buffer}] */
export function makeZip(entries, when = new Date()) {
  const { time, date } = dosTime(when); const locals = []; const centrals = []; let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name, 'utf8'); const raw = Buffer.isBuffer(e.data) ? e.data : Buffer.from(e.data);
    const comp = zlib.deflateRawSync(raw, { level: 9 }); const crc = crc32(raw);
    const h = Buffer.alloc(30); h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8); h.writeUInt16LE(time, 10); h.writeUInt16LE(date, 12); h.writeUInt32LE(crc, 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(raw.length, 22); h.writeUInt16LE(name.length, 26); h.writeUInt16LE(0, 28);
    locals.push(h, name, comp);
    const c = Buffer.alloc(46); c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10); c.writeUInt16LE(time, 12); c.writeUInt16LE(date, 14); c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(raw.length, 24); c.writeUInt16LE(name.length, 28); c.writeUInt32LE(offset, 42);
    centrals.push(c, name);
    offset += 30 + name.length + comp.length;
  }
  const cd = Buffer.concat(centrals); const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

const GUIDE = v => [
  `T17 RunTracker v${v}`,
  '',
  'CÀI ĐẶT / NÂNG CẤP',
  '1. Giải nén vào một thư mục riêng, ví dụ D:\\T17\\ (KHÔNG đặt trong C:\\Program Files).',
  '2. Chạy T17_runtracker.exe. Dữ liệu được lưu trong thư mục data\\ ngay cạnh file exe.',
  '3. Nâng cấp: giải nén bản mới ĐÈ LÊN thư mục cũ. Thư mục data\\ được giữ nguyên.',
  '4. Chuyển máy: copy cả thư mục (gồm data\\).',
  '',
  'Yêu cầu: Windows 10/11 có Microsoft Edge WebView2 Runtime (Windows 11 có sẵn).',
  'Nếu SmartScreen cảnh báo (exe chưa ký số): More info -> Run anyway.',
  '',
  'Dữ liệu từ RunPlan Tracker cũ: mở bản cũ -> Sao lưu toàn bộ (JSON) -> mở T17 -> Dữ liệu -> Khôi phục toàn bộ.',
  'Bản web (T17_runtracker_web.html) chạy bằng Chrome/Edge, dữ liệu lưu trong trình duyệt.',
  '',
].join('\r\n');

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('package-win.mjs')) {
  const exe = path.join('dist', 'T17_runtracker', 'T17_runtracker-win_x64.exe');
  if (!fs.existsSync(exe)) { console.error('Không thấy ' + exe + ' — hãy chạy neu build trước.'); process.exit(1); }
  fs.rmSync('release', { recursive: true, force: true }); fs.mkdirSync('release', { recursive: true });
  const base = releaseBaseName(pkg.version);
  const zip = makeZip([
    { name: 'T17_runtracker.exe', data: fs.readFileSync(exe) },
    { name: 'T17_runtracker_web.html', data: fs.readFileSync('dist/web/T17_runtracker.html') },
    { name: 'HUONG_DAN.txt', data: Buffer.from('\ufeff' + GUIDE(pkg.version), 'utf8') },
    { name: 'CHANGELOG.md', data: fs.readFileSync('CHANGELOG.md') },
    ...(fs.existsSync('docs/Huong_dan_su_dung_T17_RunTracker.docx') ? [{ name: 'Huong_dan_su_dung_T17_RunTracker.docx', data: fs.readFileSync('docs/Huong_dan_su_dung_T17_RunTracker.docx') }] : []),
  ]);
  const out = path.join('release', base + '.zip');
  fs.writeFileSync(out, zip);
  fs.writeFileSync(path.join('release', 'RELEASE_NAME.txt'), base);
  console.log('✔', out, (zip.length / 1048576).toFixed(2) + ' MB');
}
