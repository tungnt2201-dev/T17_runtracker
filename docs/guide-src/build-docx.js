'use strict';
const fs = require('fs');
const path = require('path');
const { imageSize } = (() => { try { return require('image-size'); } catch (e) { return { imageSize: null }; } })();
const D = require('docx');
const {
  Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType, Table, TableRow, TableCell,
  WidthType, ShadingType, BorderStyle, LevelFormat, PageBreak, TableOfContents, Header, Footer, PageNumber,
  TabStopType, VerticalAlign,
} = D;

const IMG = path.join(__dirname, 'img');
const OUT = process.argv[2] || path.join(__dirname, 'Huong_dan_su_dung_T17_RunTracker.docx');
const FONT = 'Arial';
const NAVY = '0B2A5B', BLUE = '2A78D6', MUTED = '5B6676', LINE = 'D6DEE8';
const CONTENT_W = 9638; // A4, lề 2 cm (DXA)
const CONTENT_PX = 640; // ~6.67 in @96dpi

/* ---------- PNG size ---------- */
function pngSize(file) { const b = fs.readFileSync(file); return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; }

/* ---------- inline markup: **đậm**, `mã` ---------- */
function runs(text, base = {}) {
  const out = []; const re = /(\*\*[^*]+\*\*|`[^`]+`)/g; let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    const t = m[0];
    if (t.startsWith('**')) out.push(new TextRun({ text: t.slice(2, -2), bold: true, ...base }));
    else out.push(new TextRun({ text: t.slice(1, -1), font: 'Consolas', color: '1C4F8F', ...base }));
    last = m.index + t.length;
  }
  if (last < text.length) out.push(new TextRun({ text: text.slice(last), ...base }));
  return out;
}
const P = (text, opts = {}) => new Paragraph({ children: runs(text, opts.run || {}), spacing: { after: 120, line: 300 }, alignment: opts.align, ...opts.p });
const H1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)], pageBreakBefore: true });
const H2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const H3 = t => new Paragraph({ heading: HeadingLevel.HEADING_3, children: [new TextRun(t)] });
const bullet = (t, lvl = 0) => new Paragraph({ numbering: { reference: 'bullets', level: lvl }, children: runs(t), spacing: { after: 70, line: 290 } });
let stepInstance = 0;
const steps = list => { stepInstance++; return list.map(t => new Paragraph({ numbering: { reference: 'steps', level: 0, instance: stepInstance }, children: runs(t), spacing: { after: 80, line: 290 } })); };

let figNo = 0;
function fig(file, caption, opts = {}) {
  const f = path.join(IMG, file + '.png'); const s = pngSize(f);
  let w = opts.width || CONTENT_PX; let h = Math.round(s.h * w / s.w);
  const maxH = opts.maxH || 820; if (h > maxH) { h = maxH; w = Math.round(s.w * h / s.h); }
  figNo++;
  return [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120, after: 60 }, keepNext: true, children: [new ImageRun({ type: 'png', data: fs.readFileSync(f), transformation: { width: w, height: h }, altText: { title: caption, description: caption, name: file } })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: `Hình ${figNo}. `, bold: true, size: 18, color: MUTED }), new TextRun({ text: caption, italics: true, size: 18, color: MUTED })] }),
  ];
}
/** Nhiều ảnh nhỏ cạnh nhau (thẻ bài). items: [{file, caption}] */
function figRow(items, height = 360) {
  const colW = Math.floor(CONTENT_W / items.length);
  const cells = items.map(it => {
    const f = path.join(IMG, it.file + '.png'); const s = pngSize(f);
    let h = height, w = Math.round(s.w * h / s.h); const maxW = Math.floor(CONTENT_PX / items.length) - 12; if (w > maxW) { w = maxW; h = Math.round(s.h * w / s.w); }
    figNo++;
    return new TableCell({ width: { size: colW, type: WidthType.DXA }, borders: noBorders(), verticalAlign: VerticalAlign.TOP, children: [
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'png', data: fs.readFileSync(f), transformation: { width: w, height: h }, altText: { title: it.caption, description: it.caption, name: it.file } })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 60, after: 120 }, children: [new TextRun({ text: `Hình ${figNo}. `, bold: true, size: 17, color: MUTED }), new TextRun({ text: it.caption, italics: true, size: 17, color: MUTED })] }),
    ] });
  });
  return [new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: items.map(() => colW), borders: noBorders(true), rows: [new TableRow({ children: cells })] }), new Paragraph({ spacing: { after: 80 }, children: [] })];
}
function noBorders(table) { const n = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }; const b = { top: n, bottom: n, left: n, right: n }; if (table) { b.insideHorizontal = n; b.insideVertical = n; } return b; }

/** Hộp ghi chú: kind = 'tip' | 'warn' | 'info' */
function note(kind, title, lines) {
  const c = { tip: ['EAF6E5', '3C8D2F'], warn: ['FFF6E0', 'C98500'], info: ['EDF4FF', BLUE] }[kind];
  const border = { style: BorderStyle.SINGLE, size: 24, color: c[1] }; const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const body = (Array.isArray(lines) ? lines : [lines]).map(l => new Paragraph({ children: runs(l, { size: 20 }), spacing: { after: 60, line: 280 } }));
  return [new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [CONTENT_W], rows: [new TableRow({ cantSplit: true, children: [new TableCell({
    width: { size: CONTENT_W, type: WidthType.DXA }, shading: { type: ShadingType.CLEAR, fill: c[0], color: 'auto' },
    borders: { left: border, top: none, bottom: none, right: none }, margins: { top: 100, bottom: 80, left: 200, right: 160 },
    children: [new Paragraph({ spacing: { after: 60 }, keepNext: true, children: [new TextRun({ text: title, bold: true, color: c[1], size: 20 })] }), ...body],
  })] })] }), new Paragraph({ spacing: { after: 100 }, children: [] })];
}

/** Bảng dữ liệu. widths theo tỉ lệ. */
function table(header, rows, ratios) {
  const total = ratios.reduce((a, b) => a + b, 0); const widths = ratios.map(r => Math.floor(CONTENT_W * r / total)); widths[widths.length - 1] += CONTENT_W - widths.reduce((a, b) => a + b, 0);
  const border = { style: BorderStyle.SINGLE, size: 4, color: LINE }; const borders = { top: border, bottom: border, left: border, right: border };
  const cell = (t, i, head, fill) => new TableCell({ width: { size: widths[i], type: WidthType.DXA }, borders, margins: { top: 70, bottom: 70, left: 110, right: 110 },
    shading: head ? { type: ShadingType.CLEAR, fill: NAVY, color: 'auto' } : (fill ? { type: ShadingType.CLEAR, fill, color: 'auto' } : undefined),
    children: String(t).split('\n').map(line => new Paragraph({ spacing: { after: 20, line: 260 }, children: head ? [new TextRun({ text: line, bold: true, color: 'FFFFFF', size: 19 })] : runs(line, { size: 19 }) })) });
  return [new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: widths, rows: [
    new TableRow({ tableHeader: true, children: header.map((h, i) => cell(h, i, true)) }),
    ...rows.map((r, ri) => new TableRow({ cantSplit: true, children: r.map((t, i) => cell(t, i, false, ri % 2 ? 'F6F8FB' : undefined)) })),
  ] }), new Paragraph({ spacing: { after: 120 }, children: [] })];
}
/** Ô màu nhỏ trong bảng chú giải */
function swatchTable(rows) {
  const w = [700, 2900, CONTENT_W - 3600]; const border = { style: BorderStyle.SINGLE, size: 4, color: LINE }; const borders = { top: border, bottom: border, left: border, right: border };
  return [new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: w, rows: [
    new TableRow({ tableHeader: true, children: ['Màu', 'Ý nghĩa', 'Khi nào xuất hiện'].map((h, i) => new TableCell({ width: { size: w[i], type: WidthType.DXA }, borders, shading: { type: ShadingType.CLEAR, fill: NAVY, color: 'auto' }, margins: { top: 70, bottom: 70, left: 110, right: 110 }, children: [new Paragraph({ children: [new TextRun({ text: h, bold: true, color: 'FFFFFF', size: 19 })] })] })) }),
    ...rows.map(([color, a, b]) => new TableRow({ cantSplit: true, children: [
      new TableCell({ width: { size: w[0], type: WidthType.DXA }, borders, shading: { type: ShadingType.CLEAR, fill: color, color: 'auto' }, children: [new Paragraph('')] }),
      new TableCell({ width: { size: w[1], type: WidthType.DXA }, borders, margins: { top: 70, bottom: 70, left: 110, right: 110 }, children: [new Paragraph({ children: runs(a, { size: 19, bold: true }) })] }),
      new TableCell({ width: { size: w[2], type: WidthType.DXA }, borders, margins: { top: 70, bottom: 70, left: 110, right: 110 }, children: [new Paragraph({ children: runs(b, { size: 19 }) })] }),
    ] })),
  ] }), new Paragraph({ spacing: { after: 120 }, children: [] })];
}

/* =====================================================================
 * NỘI DUNG
 * ===================================================================== */
const C = [];
const add = (...xs) => { for (const x of xs) Array.isArray(x) ? C.push(...x) : C.push(x); };

/* ---------- Trang bìa ---------- */
const cover = [
  new Paragraph({ spacing: { before: 1800 }, alignment: AlignmentType.CENTER, children: [new ImageRun({ type: 'png', data: fs.readFileSync(path.join(IMG, 'logo.png')), transformation: { width: 120, height: 120 }, altText: { title: 'Logo', description: 'Logo T17 RunTracker', name: 'logo' } })] }),
  new Paragraph({ spacing: { before: 400 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'T17 RUNTRACKER', bold: true, size: 56, color: NAVY })] }),
  new Paragraph({ spacing: { before: 120 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Lập kế hoạch & theo dõi chạy bộ', size: 30, color: MUTED })] }),
  new Paragraph({ spacing: { before: 700 }, alignment: AlignmentType.CENTER, border: { top: { style: BorderStyle.SINGLE, size: 12, color: BLUE, space: 12 } }, children: [new TextRun({ text: 'HƯỚNG DẪN SỬ DỤNG', bold: true, size: 40, color: BLUE })] }),
  new Paragraph({ spacing: { before: 200 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Phiên bản phần mềm 2.5 · Bản Windows portable và bản web', size: 24, color: MUTED })] }),
  new Paragraph({ spacing: { before: 2400 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Tháng 11/2026', size: 22, color: MUTED })] }),
  new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'github.com/tungnt2201-dev/T17_runtracker', size: 20, color: BLUE })] }),
];

/* ---------- Mục lục ---------- */
add(new Paragraph({ children: [new TextRun({ text: 'MỤC LỤC', bold: true, size: 32, color: NAVY })], spacing: { after: 200 } }));
add(new TableOfContents('Mục lục', { hyperlink: true, headingStyleRange: '1-2' }));
add(P('Nếu mục lục chưa hiện số trang: trong Word bấm chuột phải vào mục lục → **Update Field** → **Update entire table**.', { run: { italics: true, color: MUTED, size: 18 } }));

/* ---------- 1. Giới thiệu ---------- */
add(H1('1. Giới thiệu'));
add(P('**T17 RunTracker** là ứng dụng lập kế hoạch và theo dõi tập chạy bộ, chạy hoàn toàn trên máy của bạn: không cần tài khoản, không gửi dữ liệu lên Internet. Ứng dụng được phát triển tiếp từ RunPlan Tracker (file HTML) và giữ nguyên toàn bộ tính năng cũ.'));
add(P('Những việc bạn làm được với T17 RunTracker:'));
add(bullet('Lập lịch tập nhiều tuần; tạo bài có cấu trúc **Warm-up → các block lặp → Cool-down**, mỗi đoạn có thời gian hoặc cự ly, pace và nhịp tim mục tiêu.'));
add(bullet('Lưu bài hay dùng vào **Thư viện mẫu**, copy bài sang nhiều ngày.'));
add(bullet('Nhập kết quả bằng tay, hoặc **đọc file Garmin FIT** (một hay nhiều file, cả file ZIP) và tự ghép vào đúng bài kế hoạch.'));
add(bullet('So sánh kế hoạch và thực tế theo từng đoạn (section); tô màu mức độ hoàn thành.'));
add(bullet('Tính **điểm tải** từng buổi, theo dõi **Thể lực / Mệt mỏi / Độ tươi** trong tab Analytics.'));
add(bullet('Xuất bài có cấu trúc thành file **.fit** để đồng hồ Garmin hướng dẫn bạn chạy.'));
add(bullet('Nhập/xuất Excel, chia sẻ giáo án bằng JSON, sao lưu và khôi phục toàn bộ dữ liệu.'));
add(bullet('**Nhiều người dùng** trên một máy, mỗi người một lịch và hồ sơ riêng (chương 7).'));
add(bullet('**Fitness**: thư viện bài tập, giao buổi tập vào lịch, nhập kết quả và nhập từ app mobile T17 Run Training (chương 8).'));
add(bullet('**Chỉ số cơ thể**: nhập cân nặng, % mỡ, số đo; so sánh theo mốc; biểu đồ theo thời gian (chương 9).'));
add(bullet('**Calo trong ngày**: ước tính calo nền và calo tập, sửa được (chương 10).'));
add(H2('1.1. Hai cách chạy ứng dụng'));
add(table(['Bản', 'File', 'Dữ liệu lưu ở đâu', 'Dùng khi'], [
  ['Windows portable', '`T17_runtracker.exe`\n(~2,7 MB, một file)', 'Thư mục `data\\` nằm ngay cạnh file exe', 'Dùng hằng ngày trên máy tính Windows. Khuyến nghị.'],
  ['Web (một file HTML)', '`T17_runtracker_web.html`', 'Bộ nhớ trình duyệt (localStorage, giới hạn khoảng 5 MB)', 'Máy không chạy được exe, hoặc muốn mở nhanh bằng Chrome/Edge.'],
], [2, 2.4, 2.8, 3]));
add(H2('1.2. Các khái niệm cần biết'));
add(table(['Thuật ngữ', 'Ý nghĩa'], [
  ['Bài kế hoạch (KH)', 'Bài tập bạn dự định chạy vào một ngày: tên, loại bài, cấu trúc, khối lượng.'],
  ['Kết quả thực tế (TT)', 'Những gì bạn thực sự chạy: km, thời gian, pace, nhịp tim, RPE… nhập tay hoặc lấy từ FIT.'],
  ['Section (đoạn)', 'Một phần của bài: Warm-up, mỗi lần chạy nhanh, mỗi lần nghỉ, Cool-down. Kết quả có thể ghi riêng cho từng section.'],
  ['File FIT', 'File hoạt động do đồng hồ Garmin (và nhiều hãng khác) ghi lại, đuôi `.fit`.'],
  ['Thẻ FIT tím', 'Hoạt động FIT chưa được ghép vào bài kế hoạch nào. Có thể kéo thả để ghép sau.'],
  ['RPE', 'Mức mệt cảm nhận, thang 1–10.'],
  ['Điểm tải (TSS)', 'Mức nặng của buổi tập. 100 điểm = chạy 60 phút đúng ngưỡng.'],
  ['CTL / ATL / TSB', 'Thể lực (tải trung bình 42 ngày) / Mệt mỏi (7 ngày) / Độ tươi = CTL − ATL.'],
  ['LTHR, pace ngưỡng', 'Nhịp tim và pace bạn giữ được khoảng 1 giờ chạy hết sức. Dùng để chia vùng tập.'],
  ['Người dùng', 'Một bộ dữ liệu riêng (lịch, kết quả, hồ sơ, số đo). Chuyển bằng nút tròn ở góc phải thanh trên.'],
  ['Buổi fitness', 'Buổi tập sức mạnh / bổ trợ gồm danh sách bài, mỗi bài có các dòng set · rep · kg. Thẻ có biểu tượng 🏋.'],
  ['Chỉ số cơ thể', 'Số đo theo thời điểm: cân nặng, % mỡ, khối cơ, vòng eo, nhịp tim nghỉ…'],
  ['BMR / PAL / Nền', 'BMR: calo cơ thể cần khi nghỉ. PAL: hệ số hoạt động ngoài giờ tập. Nền = BMR × PAL.'],
], [2.2, 7]));

/* ---------- 2. Cài đặt ---------- */
add(H1('2. Cài đặt và khởi động'));
add(H2('2.1. Tải về'));
add(steps([
  'Mở trang **Releases** của dự án: `github.com/tungnt2201-dev/T17_runtracker/releases`.',
  'Tải file nén mới nhất. Tên file có dạng `yymmdd_T17_runtracker_vX.Y.Z.zip`, ví dụ `261109_T17_runtracker_v2.5.2.zip` (yymmdd là ngày phát hành, vX.Y.Z là số phiên bản).',
  'Giải nén vào một thư mục riêng, ví dụ `D:\\T17\\`. Trong file nén có: `T17_runtracker.exe`, `T17_runtracker_web.html`, `HUONG_DAN.txt`, `CHANGELOG.md` và file Word hướng dẫn này.',
]));
add(note('warn', 'Không đặt trong C:\\Program Files', ['Thư mục `C:\\Program Files` không cho phần mềm ghi file. Nếu đặt exe ở đó, ứng dụng sẽ tự chuyển dữ liệu sang `%APPDATA%\\T17_runtracker` và báo đường dẫn ở cột phải. Nên đặt ở ổ D:, thư mục Documents hoặc USB.']));
add(H2('2.2. Chạy lần đầu'));
add(steps([
  'Nhấp đúp `T17_runtracker.exe`.',
  'Nếu Windows SmartScreen cảnh báo "Windows protected your PC" (vì file chưa được ký số): bấm **More info** → **Run anyway**.',
  'Cửa sổ ứng dụng mở ra với lịch tuần hiện tại (Hình 1). Ứng dụng tự tạo thư mục `data\\` cạnh file exe và 5 bài mẫu trong Thư viện.',
]));
add(fig('01_man_hinh_dau', 'Màn hình khi mở ứng dụng lần đầu: lịch tuần hiện tại, chưa có bài tập'));
add(note('info', 'Yêu cầu hệ thống', ['Windows 10 hoặc 11, 64-bit, có **Microsoft Edge WebView2 Runtime** (Windows 11 có sẵn; Windows 10 cập nhật đầy đủ thường cũng có). Nếu nhấp đúp exe mà không thấy cửa sổ, hãy tải "WebView2 Runtime" từ trang của Microsoft rồi cài.']));
add(H2('2.3. Thư mục dữ liệu'));
add(P('Mọi thứ bạn nhập được lưu trong thư mục `data\\` cạnh file exe:'));
add(table(['Đường dẫn', 'Nội dung'], [
  ['`data\\t17-runtracker.json`', 'Toàn bộ kế hoạch, kết quả, thư viện mẫu, hồ sơ VĐV.'],
  ['`data\\backups\\t17-runtracker-YYYY-MM-DD.json`', 'Bản sao lưu tự động, mỗi ngày một bản, giữ 14 bản gần nhất.'],
  ['`data\\users.json`, `data\\users\\<mã>.json`', 'Danh sách người dùng và dữ liệu của từng người thêm sau (chương 7).'],
  ['`data\\backups\\…-truoc-…-YYYYMMDD-HHMMSS.json`', 'Bản tự sao lưu ngay trước khi nhập file fitness hoặc khôi phục (giữ 10 bản gần nhất mỗi loại).'],
], [4.5, 5]));
add(bullet('**Chuyển sang máy khác:** copy cả thư mục (gồm exe và `data\\`).'));
add(bullet('**Nâng cấp phiên bản:** giải nén file zip mới **đè lên** thư mục cũ. File exe được thay, thư mục `data\\` giữ nguyên.'));
add(bullet('**Mở thư mục dữ liệu:** menu **Dữ liệu ▾** → **📂 Mở thư mục dữ liệu** (chỉ có ở bản exe).'));
add(H2('2.4. Dùng bản web'));
add(P('Mở `T17_runtracker_web.html` bằng Chrome hoặc Edge. Dữ liệu lưu trong trình duyệt, dùng chung chỗ lưu với RunPlan Tracker cũ: nếu trước đây bạn dùng RunPlan bằng cùng trình duyệt, dữ liệu cũ sẽ hiện ra ngay. Bản web có giới hạn dung lượng nên cần **Sao lưu toàn bộ (JSON)** định kỳ.'));

/* ---------- 3. Giao diện ---------- */
add(H1('3. Giao diện tổng quan'));
add(fig('04_lich_tuan', 'Màn hình chính (tab Calendar) khi đã có kế hoạch'));
add(P('Màn hình chính gồm 5 vùng:'));
add(table(['Vùng', 'Vị trí', 'Chức năng'], [
  ['Thanh trên cùng', 'Trên cùng, nền xanh đậm', 'Tên và phiên bản ứng dụng; 3 tab **Calendar**, **Analytics**, **Training Log**; chỗ lưu dữ liệu hiện tại; nút người dùng ở góc phải (chương 7).'],
  ['Thanh điều khiển', 'Dưới thanh trên cùng', 'Chuyển tuần (‹ Hôm nay ›), **＋ Tạo bài tập**, **📚 Thư viện**, **⇧ Import FIT (nhiều)**, menu **Dữ liệu ▾**.'],
  ['Thanh bên trái', 'Cạnh trái', 'Lối tắt: lịch tuần, tạo bài, thư viện, dữ liệu, **♥ Hồ sơ VĐV**, **📏 Chỉ số cơ thể**, xoá dữ liệu.'],
  ['Lịch', 'Giữa', 'Mỗi hàng là một tuần (Thứ Hai → Chủ nhật), mỗi cột là một ngày. Kéo xuống để tải thêm 4 tuần kế tiếp.'],
  ['Cột tổng hợp', 'Bên phải', 'Tỷ lệ hoàn thành tuần, tổng quan km / phút / HR / RPE / tải, thẻ **Calo ngày** (chương 10), bảng chú giải màu, nút sao lưu.'],
], [2, 2.3, 5.5]));
add(figRow([{ file: '05_thanh_ben_trai', caption: 'Thanh bên trái' }, { file: '06_tong_quan_tuan', caption: 'Cột tổng hợp tuần' }], 430));
add(P('Cột tổng hợp hiển thị số liệu của **tuần đang chọn**. Bấm nút **Xem tổng quan** trên thanh tiêu đề của một tuần bất kỳ để xem số liệu tuần đó.'));
add(table(['Chỉ số', 'Ý nghĩa'], [
  ['Km KH / Km thực tế', 'Tổng cự ly kế hoạch và thực tế của tuần.'],
  ['Phút KH / Phút thực tế', 'Tổng thời gian kế hoạch và thực tế.'],
  ['HR TB, RPE TB', 'Nhịp tim và mức mệt trung bình các buổi đã nhập.'],
  ['Lệch KH, Không tập, Quá hạn', 'Số buổi lệch nhiều so với kế hoạch, số buổi bỏ, số buổi đã qua mà chưa nhập kết quả.'],
  ['Pace TT', 'Pace trung bình thực tế cả tuần.'],
  ['Tải TT / Tải KH', 'Tổng điểm tải thực tế và dự kiến của tuần (xem mục 11.5).'],
], [3, 6.5]));

/* ---------- 4. Lập kế hoạch ---------- */
add(H1('4. Lập kế hoạch bài tập'));
add(H2('4.1. Tạo bài mới'));
add(P('Có 4 cách mở cửa sổ tạo bài:'));
add(bullet('Nút **＋ Tạo bài tập** trên thanh điều khiển (ngày mặc định là hôm nay).'));
add(bullet('Nút **＋ Tạo bài** trong một ngày đang trống, hoặc **＋ Tạo thêm** dưới thẻ bài (ngày đã có bài).'));
add(bullet('Nút **＋** ở thanh bên trái.'));
add(bullet('Trong Thư viện: **＋ Tạo bài mới**.'));
add(fig('03_builder_trong', 'Cửa sổ "Thêm bài tập mới" (Workout Builder)', { maxH: 600 }));
add(steps([
  'Chọn **Ngày tập**, nhập **Tên bài tập**, chọn **Loại bài** (Easy, Recovery, Long run, Tempo, Threshold, Interval, VO2max, Custom). Loại bài dùng để lọc và để ước tính điểm tải khi thiếu số liệu.',
  'Nhập **Ghi chú kế hoạch** nếu cần, ví dụ "Giữ form khi mệt".',
  'Khai báo cấu trúc bài ở 3 phần **Warm-up**, **Các block chính / lặp lại**, **Cool-down** (mục 4.2).',
  'Kiểm tra 4 ô tổng hợp: **Tổng thời gian ước tính**, **Tổng quãng đường ước tính**, **Pace mục tiêu toàn bài**, **Nhịp tim mục tiêu**.',
  'Bấm **Lưu bài tập**. Thẻ bài xuất hiện trong lịch.',
]));
add(H2('4.2. Khai báo cấu trúc bài'));
add(fig('09_builder_interval', 'Ví dụ bài Interval 6×800 m: Warm-up 15 phút, block lặp 6 lần (chạy nhanh 800 m + đi bộ 2 phút), Cool-down 10 phút', { maxH: 860 }));
add(P('Mỗi dòng là một **đoạn**, gồm các cột:'));
add(table(['Cột', 'Cách nhập'], [
  ['Tên đoạn', 'Tên hiển thị, ví dụ "Fast 800m", "Recovery".'],
  ['Hoạt động', '**Chạy**, **Đi bộ** hoặc **Nghỉ**.'],
  ['Đơn vị', '**Phút** (đoạn theo thời gian) hoặc **Km** (đoạn theo cự ly).'],
  ['Thời gian/km', 'Số phút hoặc số km. Cự ly nhỏ nhập được: `0,08` (80 m), `0,05` (50 m), dùng dấu phẩy hoặc dấu chấm.'],
  ['Pace nhanh / Pace chậm', 'Khoảng pace mục tiêu, dạng `mm:ss`, ví dụ `5:20` và `5:45`. Pace nhỏ hơn là nhanh hơn.'],
  ['HR min / HR max', 'Khoảng nhịp tim mục tiêu (bpm), không bắt buộc.'],
], [2.4, 7]));
add(bullet('**＋ Thêm block**: thêm một nhóm lặp mới. Ô số bên cạnh tên block là **số lần lặp**.'));
add(bullet('**＋ Đoạn**: thêm đoạn vào block. **✖**: xoá đoạn. **Xóa block**: xoá cả nhóm.'));
add(bullet('**Bỏ warm-up / Bỏ cool-down**: nếu bài không cần khởi động / thả lỏng.'));
add(P('Phần **Mô tả sẽ lưu vào kế hoạch** ở cuối cửa sổ tự sinh từ cấu trúc, giúp bạn kiểm tra lại trước khi lưu. Ứng dụng dùng pace mục tiêu để quy đổi qua lại giữa thời gian và cự ly.'));
add(note('tip', 'Các nút ở cuối cửa sổ', [
  '**Lưu làm mẫu**: lưu bài vào Thư viện để dùng lại (sẽ hỏi tên mẫu).',
  '**⌚ Xuất cho Garmin**: tạo file .fit cho đồng hồ (mục 12).',
  '**Xóa bài tập này**: chỉ hiện khi đang sửa bài đã có.',
]));
add(H2('4.3. Thư viện bài tập mẫu'));
add(P('Bấm **📚 Thư viện** (thanh điều khiển hoặc thanh trái), hoặc **📚 Thư viện / Từ thư viện** trong một ngày để thêm thẳng vào ngày đó.'));
add(fig('11_thu_vien', 'Thư viện bài tập mẫu', { maxH: 640 }));
add(steps([
  'Tìm mẫu bằng ô **Tìm mẫu** hoặc lọc theo **Loại bài**.',
  'Chọn **Ngày thêm vào lịch** ở góc phải.',
  'Trên thẻ mẫu, bấm **＋ Thêm vào lịch** để thêm ngay, hoặc **✎ Chỉnh trước khi dùng** để mở Workout Builder với cấu trúc mẫu rồi sửa trước khi lưu.',
  '**Đổi tên** / **Xóa** để quản lý mẫu.',
]));
add(P('Ứng dụng có sẵn 5 mẫu: Easy 40 phút, Long run 90 phút, Tempo 20 phút, Interval 6×800 m, Recovery 25 phút.'));
add(H2('4.4. Copy và di chuyển bài'));
add(P('**Copy sang nhiều ngày:** bấm biểu tượng **⧉** trên thẻ bài. Hộp thoại cho chọn nhiều ngày; nút **+1 tuần**, **+2 tuần** thêm nhanh ngày cách ngày cuối 7 hoặc 14 ngày. Chỉ copy kế hoạch, không copy kết quả.'));
add(fig('22_copy_bai', 'Copy bài Recovery sang hai ngày của các tuần sau', { width: 420 }));
add(bullet('**Di chuyển bài:** kéo thẻ bài thả sang ngày khác.'));
add(bullet('**Copy bằng kéo thả:** giữ phím **Ctrl** trong khi kéo thả.'));
add(H2('4.5. Đọc thẻ bài trong lịch'));
add(figRow([{ file: '08_the_bai_ke_hoach', caption: 'Bài kế hoạch (chưa đến ngày)' }, { file: '07_the_bai_da_tap', caption: 'Bài đã nhập kết quả, đạt kế hoạch' }], 400));
add(table(['Thành phần trên thẻ', 'Ý nghĩa'], [
  ['Thanh màu trên đỉnh thẻ', 'Mức độ hoàn thành (bảng ở mục 5.3).'],
  ['Ô DAILY METRICS', 'PLAN: km và phút kế hoạch. ACTUAL: RPE, HR trung bình, calo thực tế.'],
  ['Dòng trạng thái', 'Ví dụ "KẾ HOẠCH", "ĐẠT KẾ HOẠCH · ±10%", "QUÁ HẠN · CHƯA NHẬP".'],
  ['Số lớn', 'Thời gian và cự ly (KH khi chưa tập, TT khi đã tập), pace.'],
  ['Pace chạy / Pace đi bộ', 'Khoảng pace mục tiêu của cả bài.'],
  ['Nhãn Tải', '"Tải KH ~ 19": điểm tải dự kiến. "Tải 65 nhịp tim TB": điểm tải thực tế và cách tính.'],
  ['Các khối WU / 1× / CD', 'Cấu trúc bài: khởi động, block lặp, thả lỏng.'],
  ['Biểu đồ cột cuối thẻ', 'Hình dạng bài: chiều cao là cường độ (pace/HR), chiều rộng là thời lượng.'],
], [3, 6.5]));
add(figRow([{ file: '30_nut_tren_the', caption: 'Hàng nút công cụ trên thẻ' }], 230));
add(table(['Nút', 'Chức năng'], [
  ['✎', 'Sửa bài (mở Workout Builder).'],
  ['⧉', 'Copy bài sang ngày khác.'],
  ['⌚', 'Xuất bài cho đồng hồ Garmin (chỉ có với bài có cấu trúc).'],
  ['⌫', 'Xoá bài (có hỏi xác nhận).'],
  ['⋮', 'Nhập / sửa kết quả. Bấm vào bất kỳ chỗ trống nào trên thẻ cũng mở cửa sổ này.'],
], [1.2, 8]));

/* ---------- 5. Nhập kết quả ---------- */
add(H1('5. Nhập kết quả buổi chạy'));
add(H2('5.1. Nhập bằng tay'));
add(P('Bấm vào thẻ bài (hoặc nút **⋮**). Cửa sổ **Nhập kết quả chạy** mở ra; dòng dưới tiêu đề nhắc lại ngày, tên bài và khối lượng kế hoạch.'));
add(fig('12a_nhap_tay', 'Cửa sổ Nhập kết quả chạy: phần tổng quát và bảng section', { maxH: 640 }));
add(steps([
  'Chọn **Trạng thái**: **Hoàn thành** hoặc **Bỏ buổi / không hoàn thành**.',
  'Nhập **Km thực tế** và **Thời gian thực tế**. **Pace thực tế** tự tính.',
  'Nhập thêm **Mức mệt mỏi (RPE 1–10)**, **Calo**, **Nhịp tim TB**, **Ghi chú** nếu có. RPE và nhịp tim giúp tính điểm tải chính xác hơn.',
  'Bấm **Lưu kết quả**.',
]));
add(P('Ô thời gian nhận nhiều cách gõ. Trên bàn phím khó gõ ký hiệu, dùng hàng nút **Chèn** ngay dưới ô (`:`, `\'`, `"`, `h`, `66:30`, `1:06:30`).'));
add(table(['Bạn gõ', 'Ứng dụng hiểu là'], [
  ['`45`', '45 phút'], ['`66:30`', '66 phút 30 giây'], ['`1:06:30`', '1 giờ 6 phút 30 giây'], ['`66\'30"`', '66 phút 30 giây'], ['`1h06\'30"`', '1 giờ 6 phút 30 giây'],
], [3, 6.5]));
add(H2('5.2. Kết quả theo từng section'));
add(P('Bảng **Chi tiết kết quả theo từng section** lặp lại đúng cấu trúc bài kế hoạch. Với mỗi section chỉ cần nhập **1 trong 3 giá trị** (thời gian, km hoặc pace); ứng dụng lấy phần còn thiếu từ kế hoạch của chính section đó.'));
add(bullet('Ví dụ đoạn 200 m: nhập `2:00` → tự điền 0,20 km và tính pace.'));
add(bullet('Nhập pace `5:30` → tự điền 0,20 km và tính thời gian.'));
add(bullet('Khi đã có dữ liệu section, Km/Thời gian tổng phía trên bị khoá và được tính lại từ các section.'));
add(fig('12b_section', 'Biểu đồ "So sánh kế hoạch ↔ thực tế theo section" và các nút cuối cửa sổ', { maxH: 420 }));
add(P('Biểu đồ so sánh chồng hai lớp: **vạch đỏ đứt** là kế hoạch, **lớp trong suốt** là thực tế. Chiều cao là tốc độ (cao hơn = nhanh hơn), chiều rộng là khối lượng. Lớp thực tế được tô màu theo mức lệch.'));
add(table(['Nút cuối cửa sổ', 'Chức năng'], [
  ['⇧ Lấy từ FIT', 'Chọn file FIT để lấy kết quả cho chính bài này (mục 6).'],
  ['⇱ Tách kết quả khỏi bài tập', 'Chuyển kết quả hiện tại thành thẻ FIT tím riêng, bài kế hoạch trở về chưa có kết quả.'],
  ['Xóa kết quả', 'Xoá kết quả, giữ bài kế hoạch.'],
  ['Đóng / Lưu kết quả', 'Đóng không lưu / lưu thay đổi.'],
], [3.2, 6.3]));
add(H2('5.3. Màu mức độ hoàn thành'));
add(P('Màu của thẻ bài được tính từ mức lệch lớn hơn giữa cự ly và thời gian so với kế hoạch:'));
add(swatchTable([
  ['65B84A', 'Đạt', 'Lệch ≤ 10%.'],
  ['E5B53A', 'Lệch nhẹ', 'Lệch trên 10% đến 30%.'],
  ['F0A33C', 'Lệch vừa', 'Lệch trên 30% đến 50%.'],
  ['E67A39', 'Lệch lớn', 'Lệch trên 50% đến 80%.'],
  ['D64545', 'Lệch rất lớn', 'Lệch trên 80%.'],
  ['8A94A3', 'Không tập / bỏ buổi', 'Trạng thái "Bỏ buổi".'],
  ['2F72DF', 'Chưa đến / đang kế hoạch', 'Ngày tương lai hoặc hôm nay chưa nhập.'],
  ['E85C5C', 'Quá hạn, chưa nhập kết quả', 'Ngày đã qua mà chưa có kết quả.'],
  ['8B7FD6', 'Thẻ FIT tím', 'Hoạt động FIT chưa ghép vào bài kế hoạch.'],
]));

/* ---------- 6. FIT ---------- */
add(H1('6. Nhập dữ liệu từ đồng hồ Garmin (FIT)'));
add(P('Ứng dụng đọc file FIT ngay trên máy, không cần tài khoản Garmin hay kết nối mạng. Từ file FIT, ứng dụng lấy thời gian chạy (đã loại khoảng dừng đồng hồ), cự ly, nhịp tim, cadence, độ cao, các lap, và tự chia kết quả theo section của bài kế hoạch.'));
add(H2('6.1. Lấy file FIT'));
add(table(['Cách', 'Thao tác'], [
  ['Từ Garmin Connect (web)', 'Mở hoạt động → biểu tượng bánh răng (⚙) → **Export Original** (Xuất bản gốc). Được file ZIP chứa file .fit; ứng dụng đọc thẳng file ZIP này.'],
  ['Từ đồng hồ qua cáp USB', 'Cắm đồng hồ vào máy tính, mở ổ đĩa của đồng hồ → thư mục `GARMIN\\Activity`. Mỗi buổi chạy là một file `.fit`.'],
], [2.6, 7]));
add(H2('6.2. Nhập một file FIT'));
add(steps([
  'Bấm **⇧ Import FIT (nhiều)** trên thanh điều khiển (hoặc **⇧ Lấy từ FIT** trong cửa sổ kết quả của một bài) và chọn một file.',
  'Cửa sổ **Nhập kết quả Garmin FIT** hiện bản xem trước (Hình dưới). Chưa có gì được lưu ở bước này.',
  'Kiểm tra **Ngày chạy** (lấy theo giờ trong file, sửa được nếu cần).',
  'Ở ô **Ghép kết quả vào bài tập**, chọn bài kế hoạch của ngày đó; hoặc chọn **＋ Đưa FIT vào lịch đúng ngày (thẻ riêng)** để ghép sau.',
  'Chọn cách chia **Dữ liệu theo section** (giải thích bên dưới) và xem bảng section.',
  'Bấm **Áp dụng dữ liệu FIT**.',
]));
add(fig('14a_fit_tong_quan', 'Xem trước file FIT: tổng quan, chọn bài để ghép, cách chia section và bảng section', { maxH: 700 }));
add(table(['Cách chia section', 'Khi nào dùng'], [
  ['Ghép tuần tự (thời gian/cự ly đúng kế hoạch)', 'Mặc định. Đoạn theo phút lấy đúng số phút, đoạn theo km lấy đúng số km, nối tiếp từ đầu bản ghi. Phù hợp khi bạn chạy đúng thứ tự bài.'],
  ['Theo lap của đồng hồ', 'Dùng khi bạn bấm Lap đúng ranh giới từng đoạn, hoặc chạy bài đã xuất sang đồng hồ (mục 12) để đồng hồ tự chia lap.'],
], [3.5, 6]));
add(note('warn', 'Ghép tuần tự là ước tính', ['Nếu bạn dừng sớm, chạy thêm, hoặc đổi thứ tự đoạn, ranh giới section sẽ lệch. Hãy xem bảng section và các ghi chú màu vàng trước khi áp dụng.']));
add(P('Kéo xuống trong cửa sổ để xem phân tích chi tiết: biểu đồ Pace, Heart Rate, Cadence, Stride length, Elevation theo thời gian hoặc theo quãng đường; bảng Laps; thời gian trong các vùng nhịp tim.'));
add(fig('14b_fit_bieu_do', 'Biểu đồ Pace và Heart Rate theo thời gian vận động (đã loại khoảng dừng)', { maxH: 520 }));
add(fig('14c_fit_laps_zones', 'Bảng Laps, Time in Heart Rate Zones và nút Áp dụng dữ liệu FIT', { maxH: 420 }));
add(note('info', 'Đã có kết quả thì sao?', ['Nếu bài đã có kết quả, ứng dụng không tự ghi đè. Tick **Cho phép ghi đè kết quả hiện có** ở cuối cửa sổ nếu bạn muốn thay. File FIT đã nhập rồi sẽ được nhận ra và không nhập trùng.']));
add(H2('6.3. Xem lại kết quả đã có FIT'));
add(P('Sau khi áp dụng, thẻ bài chuyển màu theo mức độ hoàn thành, có dòng "14/14 section đã có kết quả chi tiết" và biểu đồ nhỏ so sánh KH ↔ TT.'));
add(figRow([{ file: '17_the_bai_sau_fit', caption: 'Thẻ bài Interval sau khi ghép FIT' }, { file: '21b_the_long_run_fit', caption: 'Long run ghép FIT, lệch nhẹ 10–30%' }], 480));
add(P('Bấm vào thẻ để mở cửa sổ kết quả: phía trên có dải **Đã có dữ liệu Garmin FIT** với hai nút **↻ Ghép section từ FIT** (chia lại section) và **Xem toàn bộ biểu đồ · Laps · Zones**.'));
add(fig('19a_ket_qua_fit_form', 'Cửa sổ kết quả của bài đã ghép FIT: số liệu tự điền, bảng section và biểu đồ so sánh', { maxH: 860 }));
add(fig('19b_ket_qua_fit_zones', 'Cuối phần phân tích FIT đã lưu: thời gian trong các vùng nhịp tim', { maxH: 380 }));
add(note('tip', 'Vùng nhịp tim', ['Khi chưa có Hồ sơ VĐV, vùng tim được ước tính theo % nhịp tim tối đa trong chính file FIT. Sau khi nhập Hồ sơ VĐV (mục 7.6), vùng tim tính theo LTHR của bạn.']));
add(H2('6.4. Nhập nhiều file FIT cùng lúc'));
add(steps([
  'Bấm **⇧ Import FIT (nhiều)** và chọn nhiều file `.fit` hoặc `.zip` một lúc.',
  'Ứng dụng đọc từng file, xác định ngày chạy, tự ghép vào bài kế hoạch **chưa có kết quả** của ngày đó, rồi hiện bảng kết quả xử lý.',
  'Bấm **Đóng và xem lịch**.',
]));
add(fig('20_fit_nhieu_file', 'Kết quả nhập nhiều FIT: 1 file đã ghép vào Long run, 1 file thành thẻ FIT riêng', { maxH: 430 }));
add(table(['Kết quả xử lý', 'Ý nghĩa'], [
  ['Đã ghép', 'Đã gắn vào bài kế hoạch của ngày đó, có chia section.'],
  ['Thẻ FIT riêng', 'Ngày đó không có bài trống, hoặc không xác định chắc bài đích → tạo thẻ FIT tím.'],
  ['Trùng / bỏ qua', 'File đã có trong ứng dụng hoặc bị chọn hai lần.'],
  ['Lỗi', 'File hỏng hoặc không phải FIT chạy bộ; có ghi lý do.'],
], [2.5, 7]));
add(H2('6.5. Ghép thẻ FIT tím vào bài kế hoạch'));
add(figRow([{ file: '21_the_fit_tim', caption: 'Thẻ FIT tím: kết quả chưa ghép' }], 420));
add(P('Có hai cách ghép:'));
add(bullet('**Kéo thả** thẻ tím lên thẻ bài kế hoạch (cùng ngày hoặc ngày khác). Nếu ngày đích có nhiều bài, ứng dụng hỏi bạn chọn bài nào.'));
add(bullet('Bấm nút **→ Ghép kết quả vào bài kế hoạch** trên thẻ tím (tiện khi dùng màn hình cảm ứng).'));
add(P('Muốn tách ra lại: mở cửa sổ kết quả của bài → **⇱ Tách kết quả khỏi bài tập**.'));

/* ---------- 7. Hồ sơ VĐV ---------- */
/* ---------- 7. Nhiều người dùng và hồ sơ cá nhân ---------- */
add(H1('7. Nhiều người dùng và hồ sơ cá nhân'));
add(P('Từ phiên bản 2.2, một máy có thể dùng cho nhiều người (gia đình, huấn luyện viên và học viên, hai người chạy chung máy). Mỗi người có **lịch tập, kết quả, thư viện Fitness, chỉ số cơ thể và hồ sơ riêng**; dữ liệu của người này không lẫn vào người kia. Ngay lần đầu mở, ứng dụng chỉ có một người dùng (tên "Tôi") và hoạt động đúng như trước.'));
add(H2('7.1. Nút chuyển người dùng'));
add(P('Nút tròn có tên viết tắt nằm ở **góc phải thanh trên cùng**. Bấm vào để mở menu.'));
add(figRow([{ file: '40b_menu_nguoi_dung', caption: 'Menu người dùng khi mới có một người' }, { file: '43b_menu_hai_nguoi', caption: 'Khi có hai người: bấm tên để chuyển' }], 360));
add(table(['Mục trong menu', 'Chức năng'], [
  ['Danh sách tên (dấu ✓ là người đang dùng)', 'Bấm một tên để chuyển sang người đó. Ứng dụng lưu dữ liệu người cũ trước khi chuyển.'],
  ['＋ Thêm người dùng', 'Tạo người mới (mục 7.2).'],
  ['♥ Hồ sơ của người dùng này', 'Mở hồ sơ cá nhân của người đang chọn (mục 7.4).'],
  ['📏 Chỉ số cơ thể', 'Mở bảng chỉ số cơ thể của người đang chọn (chương 9).'],
  ['⌫ Xoá người dùng này…', 'Chỉ hiện khi có từ hai người trở lên (mục 7.3).'],
], [3.4, 6]));
add(H2('7.2. Thêm người dùng'));
add(steps([
  'Bấm nút người dùng → **＋ Thêm người dùng**.',
  'Gõ tên (hiện trên nút chuyển người dùng, có thể đổi sau trong hồ sơ) rồi bấm **Lưu**.',
  'Ứng dụng chuyển sang người mới với **lịch trống** và tự mở hồ sơ để bạn nhập dần các thông tin còn lại.',
]));
add(fig('41_them_nguoi_dung', 'Hộp thoại thêm người dùng (dữ liệu mẫu)', { width: 420 }));
add(P('Tối đa **20 người** trên một máy. Người dùng đầu tiên vẫn giữ nguyên file dữ liệu cũ, nên nâng cấp từ bản trước không cần làm gì thêm.'));
add(H2('7.3. Chuyển và xoá người dùng'));
add(bullet('**Chuyển:** chọn tên trong menu. Mọi màn hình (lịch, Analytics, Training Log, chỉ số cơ thể, calo) lập tức hiện dữ liệu của người vừa chọn.'));
add(bullet('**Xoá:** menu → **Xoá người dùng này…** → chọn người cần xoá → gõ lại **đúng tên** để xác nhận. Không xoá được người đang dùng. Việc xoá không hoàn tác được, hãy **Sao lưu toàn bộ (JSON)** trước (mục 14.1).'));
add(note('info', 'Sao lưu, Excel và xuất file áp dụng cho từng người', ['Các nút **Sao lưu**, **Khôi phục**, **Export Excel**, **Xuất bài tập**… luôn tác động lên **người đang được chọn**. Muốn sao lưu cả hai người, hãy chuyển sang từng người rồi sao lưu. Hộp xem trước khi nhập file luôn ghi rõ tên người sẽ nhận dữ liệu.']));
add(H2('7.4. Hồ sơ cá nhân'));
add(P('Mở hồ sơ bằng nút **♥** ở thanh bên trái, hoặc menu người dùng, hoặc nút **♥ Hồ sơ · vùng tập** trong tab Analytics. **Mọi ô đều tuỳ chọn** — bạn nhập dần khi cần; thanh tiến độ phía trên cho biết đã nhập bao nhiêu mục chính.'));
add(fig('pf_ca_nhan', 'Phần Thông tin cá nhân của hồ sơ (dữ liệu mẫu)', { maxH: 520 }));
add(table(['Ô nhập', 'Dùng để làm gì'], [
  ['Họ và tên, Tên gọi / biệt danh', 'Tên gọi hiện trên nút chuyển người dùng; chữ cái đầu làm ảnh đại diện.'],
  ['Ngày sinh', 'Tính tuổi (để ước tính nhịp tim tối đa và calo nền).'],
  ['Giới tính', 'Hệ số điểm tải theo nhịp tim (TRIMP) và công thức BMR.'],
  ['Chiều cao, Cân nặng', 'Tính BMI và calo nền. Cân nặng tự cập nhật theo số đo cơ thể mới nhất nếu bạn đồng ý (mục 9.2).'],
  ['Cân nặng mục tiêu', 'Vạch đứt trên biểu đồ cân nặng và màu "tốt / xấu" khi so sánh cân nặng.'],
  ['Email, điện thoại, nơi ở, CLB, liên hệ khẩn cấp', 'Chỉ để bạn ghi nhớ, không gửi đi đâu.'],
  ['Mục tiêu, Ghi chú', 'Ví dụ "Sub-2:00 half marathon 03/2027"; chấn thương cũ, loại giày…'],
], [3.2, 6.2]));
add(note('tip', 'Muốn xem calo trong ngày thì cần gì?', ['Cần đủ **chiều cao, ngày sinh, giới tính** và một số **cân nặng** (trong hồ sơ hoặc ở số đo cơ thể). Thiếu ô nào, ứng dụng nói rõ thiếu ô nào (chương 10).']));
add(P('Dữ liệu hồ sơ chỉ nằm trên máy của bạn, riêng cho từng người dùng.'));
add(H2('7.5. Nơi lưu dữ liệu của từng người'));
add(table(['Người dùng', 'Bản exe (thư mục `data\\`)', 'Bản web (trình duyệt)'], [
  ['Người đầu tiên (giữ file cũ)', '`t17-runtracker.json`', 'Khoá `runplan-tracker-v1`'],
  ['Người thêm sau', '`users\\<mã>.json`', 'Khoá `runplan-tracker-v1:<mã>`'],
  ['Danh sách người dùng', '`users.json`', 'Khoá `t17-users-v1`'],
  ['Bản sao lưu tự động', '`backups\\<tiền tố>-YYYY-MM-DD.json`, mỗi người một dãy riêng', '(không có)'],
], [2.8, 3.8, 2.8]));

add(H2('7.6. Thông số tập luyện và vùng tập'));
add(P('Hồ sơ VĐV dùng để chia vùng nhịp tim, vùng pace và tính điểm tải. Mở bằng nút **♥** ở thanh bên trái, hoặc nút **♥ Hồ sơ VĐV · vùng tập** trong tab Analytics.'));
add(fig('pf_tap_luyen', 'Phần Thông số tập luyện của hồ sơ: nhịp tim, pace ngưỡng và bảng vùng xem trước', { maxH: 520 }));
add(table(['Ô nhập', 'Cách xác định'], [
  ['Giới tính', 'Dùng cho hệ số công thức TRIMP.'],
  ['Nhịp tim nghỉ', 'Đo buổi sáng ngay khi thức dậy, hoặc lấy số "Resting HR" trên đồng hồ.'],
  ['Nhịp tim tối đa', 'Số cao nhất bạn từng đạt khi chạy hết sức. Nút **Dùng HR cao nhất từ FIT** điền sẵn số cao nhất trong các file FIT đã nhập.'],
  ['Nhịp tim ngưỡng (LTHR)', 'Chạy hết sức đều 30 phút; lấy nhịp tim trung bình của 20 phút cuối. Hoặc dùng số "Lactate Threshold" trên đồng hồ Garmin.'],
  ['Pace ngưỡng', 'Pace bạn giữ được khoảng 1 giờ (gần pace giải 10K–Half Marathon), dạng `mm:ss`, ví dụ `5:20`.'],
  ['Cân nặng', 'Không bắt buộc.'],
], [2.6, 7]));
add(P('Bảng **Vùng nhịp tim** và **Vùng pace** cập nhật ngay khi bạn gõ. Bấm **Lưu hồ sơ**: điểm tải của mọi buổi được tính lại.'));
add(table(['Vùng', 'Nhịp tim (% LTHR)', 'Pace (so với pace ngưỡng)', 'Dùng cho'], [
  ['Z1 · Hồi phục', '< 85%', 'chậm hơn 129%', 'Chạy hồi phục, khởi động'],
  ['Z2 · Aerobic', '85–89%', '114–129%', 'Easy, Long run'],
  ['Z3 · Tempo', '90–94%', '106–114%', 'Tempo'],
  ['Z4 · Ngưỡng', '95–99%', '99–106%', 'Threshold'],
  ['Z5 · VO2max+', '≥ 100%', 'nhanh hơn 99%', 'Interval ngắn, VO2max'],
], [2.2, 2.2, 2.8, 2.6]));
add(note('info', 'Chưa nhập hồ sơ thì sao?', ['Ứng dụng vẫn chạy, dùng giá trị ước tính (HR nghỉ 60, HR tối đa 190, LTHR suy từ hai số trên). Tab Analytics sẽ hiện dải nhắc màu vàng cho đến khi bạn nhập số đo thật.']));

/* ---------- 8. Fitness ---------- */
add(H1('8. Fitness: thư viện, giao bài, nhập từ app mobile'));
add(P('Ngoài buổi chạy, T17 RunTracker quản lý **buổi tập fitness** (tập sức mạnh, bổ trợ, mobility). Một buổi fitness là danh sách bài tập, mỗi bài có các dòng set · số rep · thời gian · kg. Buổi fitness có thẻ riêng trong lịch (biểu tượng 🏋) và tính vào tải tập tuần. Dữ liệu trao đổi qua lại được với app mobile **T17 Run Training**.'));
add(note('info', 'Buổi fitness không ảnh hưởng dữ liệu chạy bộ', ['Số km, pace, điểm tải của các buổi chạy giữ nguyên như trước. File FIT của đồng hồ chạy bộ không bao giờ bị ghép nhầm vào buổi fitness.']));
add(H2('8.1. Thư viện Fitness'));
add(P('Bấm **📚 Thư viện** → tab **🏋 Fitness**. Thư viện gồm hai phần: **Mẫu buổi** (một buổi hoàn chỉnh, ví dụ "Run Basic 1": 6 bài, 45 phút) và **Bài tập** (từng bài riêng lẻ, 15 bài dựng sẵn lấy từ app mobile).'));
add(fig('50_thu_vien_fitness', 'Thư viện, tab Fitness: các mẫu buổi và danh sách bài tập', { maxH: 640 }));
add(table(['Nút', 'Chức năng'], [
  ['Ô **Tìm bài / mẫu buổi**', 'Lọc theo tên bài, nhóm cơ hoặc prescription.'],
  ['📅 **Giao bài…**', 'Đưa một mẫu buổi vào lịch nhiều ngày (mục 8.4).'],
  ['＋ **Mẫu buổi mới**', 'Tự soạn một buổi: tên, thời lượng, ghi chú, RPE dự kiến và danh sách bài.'],
  ['＋ **Bài tập mới**', 'Thêm một bài vào thư viện (mục 8.2).'],
  ['**Nhân bản**', 'Sao chép bài hoặc mẫu dựng sẵn để sửa theo ý bạn.'],
  ['**Ảnh / MET**', 'Gắn ảnh minh hoạ và hệ số MET cho bài dựng sẵn (nội dung gốc của bài dựng sẵn không sửa được).'],
], [3.2, 6.2]));
add(H2('8.2. Tạo và sửa bài tập'));
add(steps([
  'Bấm **＋ Bài tập mới** (hoặc **Nhân bản** một bài có sẵn).',
  'Nhập **Tên bài** (bắt buộc), **Nhóm cơ**, **Prescription** (mô tả ngắn, ví dụ "3 x 12 mỗi chân"), **Cách tập**, **Chú ý**.',
  'Tuỳ chọn: **MET** (1–15) để ước tính calo; **Chọn ảnh** — ứng dụng tự thu nhỏ và nén ảnh xuống khoảng 60 KB hoặc ít hơn.',
  'Sửa **dòng mẫu** (set, số rep, thời gian, kg) sẽ được điền sẵn khi đưa bài vào buổi, rồi bấm **Lưu bài tập**.',
]));
add(fig('51_sua_bai_tap', 'Hộp thoại tạo bài tập mới', { maxH: 560 }));
add(note('tip', 'Về ảnh', ['Ảnh được lưu ngay trong file dữ liệu. Nhiều ảnh làm file nặng lên; bản web chỉ có khoảng 5 MB bộ nhớ nên hãy để ảnh nhỏ, hoặc dùng bản exe (mục 14.7).']));
add(H2('8.3. Mẫu buổi'));
add(P('Mẫu buổi là "công thức" cho một buổi tập: danh sách bài kèm số set/rep, thời lượng dự kiến, ghi chú và **RPE dự kiến**. Bấm **＋ Mẫu buổi mới** hoặc **Nhân bản** một mẫu dựng sẵn, thêm bài bằng ô chọn ở cuối danh sách, kéo thứ tự bằng nút ↑ ↓ rồi **Lưu**. Mẫu của bạn nằm cùng danh sách với mẫu dựng sẵn (nhãn "Của bạn").'));
add(H2('8.4. Giao bài vào lịch'));
add(P('**Giao bài** tạo các buổi fitness *kế hoạch* vào những ngày bạn chọn.'));
add(steps([
  'Trong tab Fitness bấm **📅 Giao bài…** (hoặc **Giao bài** ngay trên thẻ mẫu).',
  'Chọn **Mẫu buổi**.',
  'Chọn cách đặt ngày: **Lặp theo thứ trong tuần** (tick các thứ, chọn ngày bắt đầu và số tuần) hoặc **Chọn từng ngày…** (chọn ngày trực tiếp trên lịch).',
  'Dòng gợi ý dưới ô ngày cho biết sẽ tạo bao nhiêu buổi (ví dụ "8 buổi: 10-11, 13-11…"). Bấm **Tiếp tục**.',
]));
add(fig('52_giao_bai', 'Giao mẫu "Run Basic 1" vào Thứ Ba và Thứ Sáu trong 4 tuần', { width: 480 }));
add(P('Buổi đang có sẵn không bị ghi đè; ngày đã có buổi cùng mẫu mà chưa tập sẽ được bỏ qua. Ứng dụng báo "Đã giao N buổi…" kèm số ngày bị bỏ qua.'));
add(H2('8.5. Thẻ fitness trong lịch'));
add(figRow([{ file: '53_the_fitness_ke_hoach', caption: 'Buổi đã giao nhưng chưa nhập kết quả' }, { file: '53b_the_fitness_da_tap', caption: 'Buổi đã tập: số bài xong, RPE, kcal' }], 430));
add(table(['Thành phần / nút', 'Ý nghĩa'], [
  ['Dải trên cùng thẻ', 'Số bài và thời lượng kế hoạch; chấm màu là **tải dự kiến** (xanh lá thấp, vàng vừa, đỏ cao).'],
  ['Danh sách bài (tối đa 6 dòng)', 'Tên bài và prescription. Khi đã tập, bài đã xong được đánh dấu ✓, bài bỏ qua đánh dấu ✗.'],
  ['✎', 'Sửa **riêng buổi này** (không đổi mẫu): đổi tên, thời lượng, thêm / bớt bài, đổi số set.'],
  ['⧉ · ⌫', 'Copy sang ngày khác · xoá buổi.'],
  ['📱', 'Xuất buổi cho app mobile (mục 8.8).'],
  ['Bấm vào thẻ', 'Mở hộp nhập kết quả (mục 8.6).'],
], [3, 6.4]));
add(P('Thẻ fitness cũng được kéo thả và copy giống thẻ bài chạy (giữ **Ctrl** để copy).'));
add(H2('8.6. Nhập kết quả buổi fitness'));
add(fig('54a_nhap_ket_qua_fitness', 'Hộp Kết quả buổi fitness (cắt phần đầu; các bài còn lại nằm bên dưới)', { maxH: 600 }));
add(steps([
  'Bấm vào thẻ fitness (hoặc ✎ để sửa kế hoạch buổi).',
  'Chọn **Trạng thái**: **Đã tập** hoặc **Không tập**.',
  'Tick ô **Xong** cho từng bài đã tập; nút **Tick tất cả** đánh dấu cả buổi. Sửa số set / rep / kg thực tế nếu khác kế hoạch, thêm bài bằng ô chọn ở cuối, đổi thứ tự bằng nút ↑ ↓.',
  'Nhập **Thời lượng (phút)**, **RPE (1–10)**, **Calo** và **Ghi chú buổi** nếu có.',
  'Bấm **Lưu kết quả**. Nút **Xoá kết quả** đưa buổi về trạng thái chưa tập.',
]));
add(note('info', 'Điểm tải của buổi fitness', ['Tải = **RPE × phút ÷ 4,8** (RPE 8 trong 60 phút ≈ 100 điểm, ngang 60 phút chạy đúng ngưỡng). Chưa nhập RPE thì dùng RPE mặc định 5. Buổi fitness cộng vào tải tuần và biểu đồ Thể lực · Mệt mỏi.']));
add(H2('8.7. Nhập buổi tập từ app mobile'));
add(P('App mobile **T17 Run Training** xuất buổi tập thành file JSON, ZIP hoặc Excel. Bạn không cần chọn nút riêng: **mọi nút nhập file** của ứng dụng đều tự nhận ra file của app fitness — **Nhập bài tập / Training Log**, **Import FIT**, **Import Excel**, **Khôi phục**.'));
add(steps([
  'Chép file từ điện thoại sang máy tính (cáp, Zalo, email…).',
  'Bấm **Dữ liệu ▾ → ⇧ Nhập bài tập / Training Log** và chọn file (cũng nhận file `.zip` và file Excel 4 sheet `Session`, `Workout Log`, `Guide`, `Library`).',
  'Hộp **Nhập buổi tập từ app fitness** hiện bản xem trước; chưa có gì được ghi.',
  'Kiểm tra từng buổi, chọn cách xử lý ở ô thả xuống, rồi bấm **Nhập vào lịch**.',
]));
add(fig('55_import_mobile_xem_truoc', 'Xem trước khi nhập: buổi được gắn vào buổi đã giao theo mã buổi', { maxH: 420 }));
add(table(['Trạng thái', 'Ý nghĩa và các lựa chọn'], [
  ['Gắn vào buổi đã giao', 'Cùng ngày đã có buổi kế hoạch khớp (theo mã buổi, rồi mẫu buổi, rồi tên): kết quả được điền vào buổi đó.'],
  ['Buổi mới', 'Không có buổi kế hoạch khớp: tạo thêm buổi mới vào ngày tập.'],
  ['Đã có / Đã có — nội dung khác', 'File đã nhập trước đó. Nhập lại cùng file không nhân đôi; nếu nội dung khác thì bạn chọn bỏ qua hoặc ghi đè.'],
], [3.4, 6]));
add(bullet('**Người nhận:** dòng đầu hộp ghi rõ tên người dùng sẽ nhận dữ liệu; chỉ lịch của người này bị thay đổi.'));
add(bullet('**Nhận diện bài tập:** bài trùng mã hoặc trùng tên trong thư viện được nối vào; bài giống nhau từ 85% trở lên được **gợi ý** để bạn chọn; bài hoàn toàn mới được thêm vào thư viện và gắn nhãn **Chưa xác nhận** (bấm **Xác nhận** trong Thư viện › Fitness khi đã kiểm tra).'));
add(bullet('**Ngày:** thời điểm có múi giờ trong file được đổi sang giờ của máy, không lệch một ngày.'));
add(bullet('**Tự sao lưu:** bản exe lưu `data\\backups\\<người dùng>-truoc-nhap-fitness-<ngày giờ>.json` trước khi gộp (giữ 10 bản gần nhất); bản web giữ một bản trong trình duyệt.'));
add(bullet('File không đọc được được liệt kê riêng với lý do; các file còn lại vẫn nhập bình thường.'));
add(H2('8.8. Xuất buổi cho app mobile'));
add(P('Bấm nút **📱** trên thẻ fitness.'));
add(fig('56_xuat_mobile', 'Chọn xuất một buổi hoặc nhiều buổi', { width: 440 }));
add(bullet('**Chỉ buổi này:** một file `.json`.'));
add(bullet('**Nhiều buổi trong khoảng ngày…:** một file `.zip`, mỗi buổi một file `YYYY-MM-DD_tên-buổi.json`.'));
add(P('Trên điện thoại: mở app → **Nhập file** → chọn file. Buổi sau khi tập xong trên điện thoại có thể xuất ngược lại và nhập vào T17 như mục 8.7; mã buổi được giữ nguyên nên kết quả gắn đúng buổi đã giao.'));
add(note('warn', 'Thư viện bài trên điện thoại sẽ bị thay', ['App mobile thay thư viện bài của nó bằng thư viện nằm trong file bạn nhập. Nếu trên điện thoại bạn có bài tự thêm mà trong T17 chưa có, hãy xuất và nhập chúng sang T17 trước.']));
add(H2('8.9. Excel, sao lưu và bản cũ'));
add(bullet('Buổi fitness được xuất trong **Export Excel** và đọc lại bằng **Import Excel** cùng với lịch chạy.'));
add(bullet('File sao lưu và file xuất của bản mới **vẫn mở được bằng bản 2.2.0 và các bản cũ hơn**; dữ liệu chạy bộ không đổi. Bản cũ thấy buổi fitness như một bài thường (tên, thời lượng, mô tả tóm tắt) và không có ảnh / hướng dẫn chi tiết của bài. Các bản này không làm mất dữ liệu fitness khi bạn sao lưu rồi mở lại bằng bản mới.'));

/* ---------- 9. Chỉ số cơ thể ---------- */
add(H1('9. Chỉ số cơ thể: nhập, so sánh, biểu đồ'));
add(P('Theo dõi cân nặng, thành phần cơ thể và số đo vòng theo thời gian, riêng cho từng người dùng. Mọi chỉ số đều **tuỳ chọn** — chỉ cần cân nặng cũng dùng được. Số đo được lưu trong file sao lưu của người dùng và dùng lại để tính calo nền (chương 10).'));
add(H2('9.1. Mở bảng Chỉ số cơ thể'));
add(P('Bấm nút **📏** ở thanh bên trái, hoặc **📏 Chỉ số cơ thể** trong menu người dùng. Phía trên là thẻ tóm tắt từng chỉ số đang có dữ liệu; phía dưới là bảng lịch sử.'));
add(fig('60_chi_so_co_the', 'Bảng Chỉ số cơ thể với dữ liệu mẫu: thẻ tóm tắt, xu hướng cân nặng, lịch sử', { maxH: 860 }));
add(table(['Thành phần', 'Ý nghĩa'], [
  ['Thẻ chỉ số', 'Giá trị **mới nhất** và ngày đo; ba dòng so sánh: **lần trước**, **30 ngày**, **lần đầu** (mũi tên, số tuyệt đối và %).'],
  ['Màu số thay đổi', 'Màu theo **ý nghĩa**, không theo hướng lên/xuống: **xanh** là tốt, **đỏ** là xấu, **xám** là trung tính. Ví dụ: % mỡ, vòng eo, mỡ nội tạng, nhịp tim nghỉ giảm là tốt; khối cơ, khối nạc, % nước tăng là tốt; cân nặng tốt khi tiến gần **cân nặng mục tiêu** trong hồ sơ.'],
  ['Dòng xu hướng cân nặng', 'Cân nặng trung bình 7 ngày và độ dốc **kg/tuần** (tính trên 28 ngày gần nhất), kèm cân nặng mục tiêu.'],
  ['Bảng lịch sử', 'Mới nhất ở trên; lọc theo khoảng ngày (**Từ / Đến**, **Tất cả**); ✎ sửa, ⌫ xoá từng lần đo.'],
], [2.8, 6.6]));
add(note('info', 'So sánh theo từng chỉ số', ['Cân thông minh và thước dây thường đo ở những ngày khác nhau, nên mốc so sánh của mỗi chỉ số là **lần gần nhất có đúng chỉ số đó**. Mốc "30 ngày" lấy lần đo trong khoảng ±3 ngày; nếu không có, ứng dụng dùng lần gần nhất và ghi rõ lệch bao nhiêu ngày (ví dụ "~5n").']));
add(H2('9.2. Nhập số đo'));
add(steps([
  'Bấm **＋ Nhập số đo**.',
  'Ngày và giờ mặc định là **bây giờ**; sửa nếu bạn nhập bù số đo cũ. Đo nhiều lần trong một ngày được.',
  'Điền các ô bạn có: **Cân & thành phần cơ thể** (cân nặng, % mỡ, khối cơ, % nước, mỡ nội tạng, khối xương, BMR), **Số đo vòng** (eo, hông, ngực, đùi, bắp tay), **Khác** (nhịp tim nghỉ), **Ghi chú**. Số thập phân dùng dấu phẩy hoặc chấm.',
  'Trong lúc gõ, bên cạnh mỗi ô hiện "so với ngày … " và hiệu số so với lần đo trước; BMI và khối nạc tự tính; số bất thường được cảnh báo (không chặn bạn lưu).',
  'Bấm **Lưu số đo**.',
]));
add(fig('61_nhap_so_do', 'Hộp Nhập số đo cơ thể (cắt phần đầu)', { maxH: 560 }));
add(P('Khi cân nặng mới là **mới nhất** và khác cân nặng trong hồ sơ, ứng dụng hỏi có cập nhật cân nặng hồ sơ không (**Cập nhật** / **Không** / **Luôn tự cập nhật** / **Không cập nhật, không hỏi lại**). Hồ sơ cập nhật giúp tính calo nền đúng hơn.'));
add(H2('9.3. Nhập và xuất CSV từ cân thông minh'));
add(bullet('**⇧ Nhập CSV (cân thông minh):** chọn file CSV xuất từ cân hoặc ứng dụng của cân. Tên cột tiếng Anh hoặc tiếng Việt đều được nhận; số `1,5` và `1.5` đều đọc được; ngày dạng `dd/mm/yyyy` hoặc `yyyy-mm-dd`, có giờ hoặc không.'));
add(bullet('Ứng dụng báo trước số lần đo đọc được, số dòng lỗi bị bỏ qua và các cột không dùng, rồi hỏi xác nhận. Nhập lại cùng file **không tạo bản trùng**; nếu một lần đo đã có nhưng thiếu ô, ô thiếu được điền thêm, giá trị đang có được giữ nguyên.'));
add(bullet('**⇩ Xuất CSV:** file mở được bằng Excel tiếng Việt (tên `T17_ChiSoCoThe_<ngày>.csv`).'));
add(H2('9.4. Biểu đồ trong Analytics › Cơ thể'));
add(P('Vào tab **Analytics**, bấm nút **Cơ thể** (cạnh nút **Tập luyện**). Khoảng hiển thị chọn như tab Tập luyện (8 tuần … Tất cả).'));
add(fig('62_analytics_co_the', 'Analytics › Cơ thể: ô tóm tắt, biểu đồ cân nặng kèm tải tập tuần, biểu đồ % mỡ và khối cơ', { maxH: 700 }));
add(bullet('**Trục thời gian theo ngày thật** — số đo không đều ngày nên các điểm cách nhau đúng khoảng thời gian.'));
add(bullet('**Điểm** là trung bình các lần đo trong ngày; **đường liền** là trung bình 7 ngày; **vạch đứt xanh** là cân nặng mục tiêu; **vòng cam** là lần đo có ghi chú. Rê chuột để xem giá trị, số lần đo và ghi chú.'));
add(bullet('**Tiêu đề là câu kết luận có số**, ví dụ "Giảm 2,3 kg trong 10 tuần", kèm chấm màu theo ý nghĩa.'));
add(bullet('**Tải tập theo tuần (chạy + fitness)** vẽ ngay dưới biểu đồ cân nặng, cùng trục thời gian, để bạn thấy cân nặng thay đổi ra sao khi tải tăng giảm.'));
add(bullet('Chưa đủ 2 lần đo thì hiện hướng dẫn và nút nhập số đo thay vì biểu đồ trống.'));
add(H2('9.5. So sánh hai mốc A → B'));
add(P('Ở cuối trang Analytics › Cơ thể, chọn hai ngày để so sánh cạnh nhau: bảng cho thấy mỗi chỉ số ở mốc A, mốc B và thay đổi (có màu theo ý nghĩa). Các phím tắt **Lần đầu ↔ mới nhất** và **30 ngày trước ↔ mới nhất** chọn nhanh hai mốc thường dùng. Mỗi chỉ số lấy lần đo gần ngày chọn nhất và ghi rõ ngày đo thực tế nếu khác ngày chọn.'));
add(fig('63_so_sanh_hai_moc', 'Phần dưới của Analytics › Cơ thể: biểu đồ vòng eo, nhịp tim nghỉ và so sánh hai mốc', { maxH: 700 }));
add(H2('9.6. Excel'));
add(P('**Export Excel** thêm một sheet phụ tên `Body` chứa số đo cơ thể; **sheet đầu vẫn là lưới tuần** nên bản cũ đọc Excel như trước. **Import Excel** đọc lại sheet `Body`; file Excel cũ không có sheet này vẫn nạp bình thường.'));

/* ---------- 10. Calo trong ngày ---------- */
add(H1('10. Calo trong ngày: công thức và cách sửa'));
add(P('Ứng dụng ước tính **số calo bạn tiêu hao mỗi ngày** để bạn so với lượng ăn vào và theo dõi tải tập. Con số gồm hai phần cộng lại, tính riêng cho từng người dùng:'));
add(table(['Phần', 'Là gì', 'Tính từ'], [
  ['**Nền** (hoạt động bình thường)', 'Calo cơ thể dùng cả ngày khi **chưa tính giờ tập**: nghỉ ngơi, đi lại, làm việc.', 'BMR × mức hoạt động (PAL), hoặc số bạn tự nhập.'],
  ['**Tập (ròng)**', 'Phần calo **tăng thêm** do các buổi tập trong ngày (chạy và fitness).', 'Từng buổi tập (mục 10.3).'],
  ['**Tổng ước tính**', 'Nền + Tập.', 'Cộng hai phần trên.'],
], [2.8, 4, 2.6]));
add(note('warn', 'Đây là ước tính', ['Số calo được tính theo công thức, **sai số thường khoảng ±10–15%** so với thực tế. Đây **không phải tư vấn dinh dưỡng hay y tế**. Dùng để so sánh các ngày với nhau và theo dõi xu hướng, đừng coi là con số tuyệt đối. Dòng nhắc này luôn hiện ở mọi nơi có con số calo.']));
add(H2('10.1. Xem calo ở đâu'));
add(figRow([{ file: '70_calo_tren_lich', caption: 'Dòng 🔥 kcal ở đầu mỗi ngày trong lịch' }, { file: '72_the_calo_tuan', caption: 'Thẻ Calo ngày ở cột tổng hợp tuần' }], 470));
add(bullet('**Lịch:** đầu mỗi ngày có nút **🔥 2.020 (+632)**: số lớn là calo **nền**, số trong ngoặc là calo tập (ngày chưa tập hiện là *dự kiến*). Ngày chưa tính được hiện **kcal ?** — bấm vào để biết thiếu gì.'));
add(bullet('**Cột tổng hợp tuần:** thẻ **Calo ngày** mỗi ngày một dòng: thanh xanh là nền, cam là calo tập, cam nhạt là phần dự kiến; cuối thẻ là trung bình kcal/ngày của tuần.'));
add(bullet('**Analytics › Tập luyện:** biểu đồ cột chồng calo từng ngày (8 tuần) hoặc trung bình mỗi ngày theo tuần (khoảng dài hơn), kèm đường trung bình (mục 11.7).'));
add(P('Bấm vào dòng 🔥 của một ngày (hoặc một dòng trong thẻ Calo ngày) để mở **chi tiết ngày**:'));
add(fig('71_chi_tiet_ngay', 'Chi tiết calo một ngày: BMR, nền, từng buổi tập và cách tính', { width: 520 }));
add(H2('10.2. Calo nền được tính thế nào'));
add(P('**Nền = BMR × PAL.** BMR là calo cơ thể cần khi nằm nghỉ; PAL là hệ số hoạt động ngoài giờ tập.'));
add(table(['Công thức BMR (ưu tiên từ trên xuống)', 'Khi nào dùng'], [
  ['BMR **đo bằng cân** (ô BMR trong số đo cơ thể)', 'Lần đo gần nhất có ghi BMR.'],
  ['**Katch–McArdle**', 'Có cân nặng và **% mỡ**: BMR = 370 + 21,6 × khối nạc (kg).'],
  ['**Mifflin–St Jeor**', 'Có cân nặng, chiều cao, tuổi, giới tính: nam = 10×kg + 6,25×cm − 5×tuổi + 5; nữ = … − 161.'],
], [4.2, 5.2]));
add(table(['PAL', 'Mô tả'], [
  ['1,2', 'Ít vận động — ngồi gần như cả ngày'],
  ['**1,3** (mặc định)', 'Nhẹ — việc văn phòng, đi lại ít'],
  ['1,4', 'Vừa — đứng / đi nhiều trong ngày'],
  ['1,5', 'Năng động — công việc di chuyển liên tục'],
  ['1,6', 'Lao động nặng — lao động tay chân'],
], [2.2, 7.2]));
add(P('Bạn cũng có thể gõ PAL tuỳ ý trong khoảng **1,1 đến 2,0**. PAL **không tính giờ tập**, vì calo tập được cộng riêng.'));
add(note('info', 'Ví dụ', ['Nam, 80 kg, 175 cm, 35 tuổi: BMR (Mifflin–St Jeor) = 10×80 + 6,25×175 − 5×35 + 5 = **1.723,75 kcal**. Nền = 1.723,75 × 1,3 = **2.240,9 kcal**. Chạy 10 km (không có file FIT) = 10 km × 80 kg × 1,0 = **800 kcal** ròng. Tổng ngày ≈ **3.041 kcal**.']));
add(P('Cân nặng và % mỡ lấy từ **lần đo gần nhất vào hoặc trước ngày đó** (không dùng số đo của tương lai); chưa có số đo nào thì dùng cân nặng trong hồ sơ. Tuổi tính tại ngày đó từ ngày sinh. Thiếu dữ liệu, ứng dụng **liệt kê ô còn thiếu** (chiều cao, ngày sinh, giới tính, cân nặng) thay vì đoán.'));
add(H2('10.3. Calo tập ròng của từng buổi'));
add(P('"Ròng" nghĩa là chỉ tính phần **tăng thêm** so với lúc nghỉ (đã trừ BMR theo thời gian tập) để không tính trùng với nền. Mỗi buổi dùng nguồn dữ liệu tốt nhất có được, theo thứ tự:'));
add(table(['Thứ tự', 'Nguồn', 'Ghi chú'], [
  ['1', 'Calo bạn **nhập tay** ở ô Calo của buổi', 'Trừ phần nghỉ trong thời gian tập.'],
  ['2', 'Calo trong **file FIT** của đồng hồ', 'Trừ phần nghỉ như trên.'],
  ['3', 'Buổi chạy: **1,0 kcal/kg/km**', 'Cần cân nặng và số km.'],
  ['4', 'Buổi fitness: **MET theo RPE**: (MET − 1) × cân nặng × giờ', 'RPE ≤ 4: MET 3,5 · RPE 5–6 hoặc để trống: 5 · RPE ≥ 7: 6.'],
], [1.4, 4.4, 3.6]));
add(bullet('Một ngày nhiều buổi thì **cộng lại**.'));
add(bullet('Buổi **kế hoạch chưa tập** chỉ là "dự kiến" (nhãn cam nhạt), **không** cộng vào tổng thực; buổi **bỏ** tính 0.'));
add(bullet('Số ước tính **chỉ để hiển thị** — ứng dụng **không bao giờ ghi** nó vào ô Calo của buổi tập. Ô Calo chỉ chứa số bạn nhập hoặc số từ file FIT.'));
add(H2('10.4. Cách sửa số calo'));
add(P('Có **ba mức sửa**, ưu tiên từ trên xuống: **ghi đè riêng một ngày** → **số kcal nền cố định** → **công thức tự tính**. Mỗi con số nền có nhãn nguồn: *tự tính*, *bạn đã sửa* hoặc *ghi đè ngày*.'));
add(H3('Mức 1. Sửa nền của một ngày'));
add(steps([
  'Bấm dòng 🔥 của ngày đó trong lịch.',
  'Ở mục **Sửa nền của ngày này** gõ số kcal nền (300–8.000) rồi bấm **Lưu cho ngày này**.',
  'Muốn quay lại: bấm **Về giá trị tự tính**. Ngày đã sửa được đánh dấu khác màu trên lịch và có viền xanh trên biểu đồ.',
]));
add(fig('71b_sua_nen_ngay', 'Gõ số kcal nền riêng cho ngày này (các nút Lưu và Về giá trị tự tính nằm ngay bên dưới)', { width: 520 }));
add(H3('Mức 2. Đổi cách tính nền cho mọi ngày (Hồ sơ › Năng lượng)'));
add(steps([
  'Mở **♥ Hồ sơ** và kéo xuống mục **Năng lượng — calo trong ngày**.',
  'Chọn **Cách tính calo nền**: **Tự tính: BMR × mức hoạt động (PAL)** hoặc **Số kcal cố định do tôi nhập** (rồi gõ số vào ô **Kcal nền cố định / ngày**).',
  'Với cách tự tính, có thể đổi **Công thức BMR** (tự chọn hoặc ép dùng Mifflin–St Jeor / Katch–McArdle) và **PAL**.',
  'Xem dòng **BMR hôm nay / Nền hôm nay** để kiểm tra trước khi bấm **Lưu hồ sơ**. Danh sách **Ngày đã ghi đè** cho phép bỏ từng ngày; nút **Về giá trị tự tính** xoá cài đặt mức 2.',
]));
add(fig('pf_nang_luong', 'Mục Năng lượng trong Hồ sơ: cách tính nền, công thức BMR, PAL và phần xem trước', { maxH: 480 }));
add(H3('Mức 3. Sửa số liệu đầu vào'));
add(P('Cách chính xác hơn là làm cho đầu vào đúng: nhập **số đo cơ thể** mới (cân nặng, % mỡ, BMR từ cân thông minh — chương 9), nhập **calo thực tế** của buổi tập (hoặc nhập file FIT), cập nhật **chiều cao, ngày sinh, giới tính** trong hồ sơ.'));
add(H2('10.5. Lưu ý khi dùng'));
add(bullet('Sai số calo thường **±10–15%**; calo nhập tay hoặc từ FIT cũng phụ thuộc thiết bị đo.'));
add(bullet('Nếu **ăn theo số calo** để giảm hoặc tăng cân, hãy dùng số này như một mốc tham khảo; theo dõi **xu hướng cân nặng** (chương 9) để điều chỉnh.'));
add(bullet('Mỗi người dùng có cài đặt calo **riêng**; hai người cùng chạy 10 km sẽ ra hai con số khác nhau vì cân nặng khác nhau.'));
add(bullet('Cài đặt calo được lưu trong file sao lưu; bản 2.2.0 trở xuống mở file vẫn **giữ nguyên** cài đặt này.'));

/* ---------- 11. Analytics ---------- */
add(H1('11. Phân tích tải tập (Analytics)'));
add(P('Bấm tab **Analytics** trên thanh trên cùng. Chọn khoảng hiển thị **8 tuần, 12 tuần, 6 tháng, 12 tháng** hoặc **Tất cả**. Các chỉ số thể lực luôn tính trên toàn bộ lịch sử, chỉ phần hiển thị thay đổi.'));
add(fig('27_analytics_tren', 'Tab Analytics: 6 ô chỉ số, biểu đồ Thể lực · Mệt mỏi · Tải hằng ngày và biểu đồ Độ tươi'));
add(H2('11.1. Sáu ô chỉ số'));
add(table(['Ô', 'Ý nghĩa'], [
  ['Thể lực (CTL)', 'Trung bình tải 42 ngày, có trọng số. Tăng dần khi bạn tập đều. Dòng nhỏ so sánh với 7 ngày trước.'],
  ['Mệt mỏi (ATL)', 'Trung bình tải 7 ngày. Tăng nhanh sau tuần nặng, giảm nhanh khi nghỉ.'],
  ['Độ tươi (TSB)', 'CTL − ATL của hôm trước. Âm: đang mệt vì tích luỹ tải. Dương: đã hồi phục.'],
  ['Quãng đường', 'Tổng km trong khoảng đã chọn và trung bình mỗi tuần.'],
  ['Thời gian chạy', 'Tổng thời gian và số buổi.'],
  ['Tuân thủ kế hoạch', 'Số bài kế hoạch đã hoàn thành / tổng số bài kế hoạch đã đến ngày.'],
], [2.4, 7]));
add(H2('11.2. Biểu đồ Thể lực · Mệt mỏi · Tải hằng ngày'));
add(P('Đường **xanh** là CTL, đường **cam** là ATL, **cột xám** là tải từng ngày. Phần bên phải vạch "Hôm nay" là **dự báo** (nét đứt, cột viền) nếu bạn tập đúng kế hoạch đã lên, tối đa 4 tuần tới. Rê chuột lên biểu đồ để xem số liệu từng ngày.'));
add(fig('28_analytics_tooltip', 'Rê chuột để xem tải, CTL, ATL, TSB của từng ngày', { maxH: 300 }));
add(H2('11.3. Biểu đồ Độ tươi (TSB)'));
add(table(['Vùng TSB', 'Diễn giải'], [
  ['Trên +25', 'Nghỉ quá lâu, thể lực có thể giảm.'],
  ['+5 đến +25 (dải xanh nhạt "Tươi")', 'Đã hồi phục, phù hợp thi đấu.'],
  ['−10 đến +5', 'Cân bằng.'],
  ['−30 đến −10 (dải xanh lá "Tối ưu")', 'Đang tích luỹ tải hiệu quả.'],
  ['Dưới −30 (dải đỏ "Quá tải")', 'Quá tải, cần giảm khối lượng và hồi phục.'],
], [3.8, 5.7]));
add(P('Khi CTL tăng hơn **5 điểm/tuần**, ứng dụng hiện cảnh báo "Tăng tải khá nhanh"; trên **8 điểm/tuần** là "Tăng tải quá nhanh — nguy cơ chấn thương".'));
add(H2('11.4. Km theo tuần, vùng nhịp tim, loại bài'));
add(fig('29_analytics_duoi', 'Phần dưới tab Analytics: km theo tuần, thời gian trong vùng nhịp tim, tổng hợp theo loại bài và theo tuần'));
add(bullet('**Km theo tuần**: cột xám là kế hoạch, cột xanh là thực tế. Rê chuột để xem số buổi và tải tuần.'));
add(bullet('**Thời gian trong các vùng nhịp tim**: tính theo chuỗi nhịp tim trong file FIT; buổi nhập tay chỉ có HR trung bình thì cả buổi được tính vào một vùng. Dòng cuối cho tỷ lệ dễ (Z1–Z2) : trung bình (Z3) : khó (Z4–Z5); mô hình phân cực thường khuyến nghị khoảng 80 : 0–5 : 15–20.'));
add(bullet('**Theo loại bài**: số buổi, km, thời gian, tải trung bình của từng loại.'));
add(bullet('**Tuần gần đây**: km KH/TT, số buổi, tải tuần và CTL cuối tuần.'));
add(H2('11.5. Điểm tải được tính thế nào'));
add(P('Điểm tải dùng thang TSS: **100 = chạy 60 phút đúng ngưỡng**. Ứng dụng dùng nguồn dữ liệu tốt nhất có được cho từng buổi; nhãn trên thẻ bài cho biết cách tính đã dùng:'));
add(table(['Thứ tự', 'Nguồn dữ liệu', 'Nhãn trên thẻ'], [
  ['1', 'Chuỗi nhịp tim từng giây trong file FIT (TRIMP)', 'nhịp tim FIT'],
  ['2', 'Nhịp tim trung bình cả buổi', 'nhịp tim TB'],
  ['3', 'Pace so với pace ngưỡng (rTSS, chưa tính độ dốc)', 'pace'],
  ['4', 'Mức mệt RPE', 'RPE'],
  ['5', 'Loại bài và thời gian (ước tính thô)', 'ước tính theo loại bài'],
], [1.2, 5.6, 2.7]));
add(P('Bài kế hoạch hiện **Tải KH ~ …**, tính từ pace hoặc nhịp tim mục tiêu của từng đoạn.'));

add(H2('11.6. Tab con Cơ thể'));
add(P('Nút **Cơ thể** cạnh nút **Tập luyện** (dưới thanh chọn khoảng) chuyển sang biểu đồ cân nặng, % mỡ, khối cơ, vòng eo, nhịp tim nghỉ theo thời gian, cùng biểu đồ tải tập tuần và so sánh hai mốc. Xem mục 9.4 và 9.5.'));
add(H2('11.7. Biểu đồ calo mỗi ngày'));
add(P('Trong tab **Tập luyện** có thêm biểu đồ **Calo mỗi ngày (ước tính)**: cột chồng với **nền** (xanh) ở dưới và **calo tập ròng** (cam) ở trên, đường nét đứt là trung bình. Khoảng 8 tuần vẽ từng ngày (bấm một cột để mở chi tiết ngày); khoảng dài hơn vẽ trung bình mỗi ngày theo tuần. Cột có viền xanh là ngày bạn đã sửa nền. Chỉ tính các ngày đến hôm nay; buổi kế hoạch chưa tập không được cộng.'));
add(fig('74_analytics_calo', 'Biểu đồ calo mỗi ngày (ước tính) với dữ liệu mẫu', { maxH: 300 }));

/* ---------- 12. Garmin export ---------- */
add(H1('12. Xuất bài tập sang đồng hồ Garmin'));
add(P('Bài có cấu trúc (Warm-up, block lặp, Cool-down) xuất được thành file Workout `.fit`. Đồng hồ sẽ báo từng bước, đếm số lần lặp và cảnh báo khi pace hoặc nhịp tim ra ngoài khoảng mục tiêu.'));
add(steps([
  'Bấm nút **⌚** trên thẻ bài, hoặc **⌚ Xuất cho Garmin** trong Workout Builder.',
  'Bản exe: chọn nơi lưu trong hộp thoại Save As. Bản web: file được tải về thư mục Downloads. Tên file theo tên bài, ví dụ `Interval_6x800m.fit`.',
  'Cắm đồng hồ vào máy tính bằng cáp USB, mở ổ đĩa của đồng hồ.',
  'Copy file `.fit` vào thư mục `GARMIN\\NewFiles`.',
  'Rút cáp. Trên đồng hồ, bài xuất hiện trong **Training → Workouts** (tên menu có thể khác tuỳ dòng đồng hồ).',
]));
add(fig('31_thong_bao_garmin', 'Thông báo sau khi xuất file', { width: 460 }));
add(table(['Trong ứng dụng', 'Trên đồng hồ'], [
  ['Warm-up / Cool-down', 'Bước Warm up / Cool down'],
  ['Đoạn chạy', 'Bước Run (theo thời gian hoặc cự ly)'],
  ['Đoạn đi bộ', 'Bước Recover; đoạn Nghỉ là bước Rest'],
  ['Block lặp N lần', 'Bước Repeat N lần'],
  ['Pace nhanh / chậm', 'Target pace (ưu tiên nếu có cả pace và HR)'],
  ['HR min / max', 'Target heart rate (khi đoạn không có pace)'],
], [4, 5.5]));
add(note('warn', 'Lưu ý', ['Một số đồng hồ chỉ nhận file qua Garmin Connect hoặc ứng dụng Garmin Express. Bài tối đa 100 bước. Tên bài trên đồng hồ dài tối đa khoảng 30 ký tự; nên đặt tên không dấu cho dễ đọc.']));

/* ---------- 10. Training Log ---------- */
add(H1('13. Nhật ký tập (Training Log)'));
add(P('Tab **Training Log** liệt kê mọi bài dạng bảng, mới nhất ở trên, để tra cứu và xuất dữ liệu.'));
add(fig('25_training_log', 'Tab Training Log'));
add(table(['Bộ lọc / nút', 'Chức năng'], [
  ['Từ ngày / Đến ngày', 'Giới hạn khoảng thời gian.'],
  ['Loại bài', 'Easy, Tempo, Interval…'],
  ['Trạng thái', 'Hoàn thành, bỏ buổi, kế hoạch, quá hạn…'],
  ['Tìm kiếm', 'Theo tên bài hoặc ghi chú.'],
  ['Xóa lọc', 'Về trạng thái hiển thị tất cả.'],
  ['⇩ Xuất Excel / ⇩ Xuất JSON', 'Xuất đúng các dòng đang hiển thị. File JSON gồm cả kết quả, dùng để chia sẻ hoặc gộp sang máy khác (mục 14.3).'],
  ['✎ ở cuối dòng', 'Mở cửa sổ kết quả của bài đó.'],
], [3, 6.5]));

/* ---------- 11. Dữ liệu ---------- */
add(H1('14. Quản lý dữ liệu'));
add(P('Mọi thao tác nhập/xuất nằm trong menu **Dữ liệu ▾** ở góc phải thanh điều khiển (hoặc nút **⇅** ở thanh bên trái).'));
add(figRow([{ file: '23_menu_du_lieu', caption: 'Menu Dữ liệu' }], 340));
add(H2('14.1. Sao lưu và khôi phục'));
add(bullet('**Sao lưu toàn bộ (JSON)**: lưu một file chứa toàn bộ kế hoạch, kết quả, thư viện và hồ sơ VĐV. Nên làm định kỳ, nhất là với bản web.'));
add(bullet('**Khôi phục toàn bộ (ghi đè)**: chọn file sao lưu. Ứng dụng cho biết file chứa bao nhiêu tuần, bài, kết quả, hoạt động FIT và hỏi lại trước khi **ghi đè** dữ liệu hiện tại.'));
add(bullet('Bản exe còn tự sao lưu mỗi ngày vào `data\\backups\\`. Nếu file dữ liệu chính bị hỏng, ứng dụng tự nạp bản dự phòng mới nhất và báo ở cột phải.'));
add(bullet('**Khôi phục có bản dự phòng:** trước khi ghi đè, ứng dụng luôn lưu một bản `…-truoc-khoi-phuc-…`. Nếu file bạn chọn **không có bài nào** trong khi lịch hiện tại đang có dữ liệu, ứng dụng cảnh báo riêng để tránh xoá nhầm.'));
add(bullet('Sao lưu và khôi phục luôn áp dụng cho **người đang được chọn** (mục 7.3).'));
add(H2('14.2. Chuyển dữ liệu từ RunPlan Tracker cũ'));
add(steps([
  'Mở RunPlan Tracker cũ (file HTML) bằng trình duyệt bạn vẫn dùng.',
  'Bấm **Sao lưu toàn bộ (JSON)** để lưu file.',
  'Mở T17 RunTracker → **Dữ liệu ▾** → **Khôi phục toàn bộ (ghi đè)** → chọn file vừa lưu.',
]));
add(P('Ứng dụng đọc được mọi định dạng file JSON đời cũ của RunPlan: kể cả bản rất cũ khi mỗi ngày chỉ có 1 bài, ngày dạng dd/mm/yyyy, số có dấu phẩy. Ngược lại, file sao lưu của T17 vẫn khôi phục được bằng RunPlan cũ.'));
add(H2('14.3. Chia sẻ giáo án và gộp dữ liệu'));
add(table(['Chức năng', 'Dùng để', 'Ghi đè dữ liệu?'], [
  ['⇩ Xuất bài tập (JSON)', 'Gửi giáo án cho người khác (chỉ kế hoạch, không kèm kết quả).', 'Không'],
  ['⇧ Nhập bài tập / Training Log (JSON)', 'Gộp thêm giáo án người khác gửi, hoặc file Training Log (kèm kết quả). Bài trùng được bỏ qua.', 'Không, chỉ thêm'],
  ['Khôi phục toàn bộ', 'Thay toàn bộ dữ liệu bằng file sao lưu.', 'Có'],
], [3.3, 4.7, 1.5]));
add(P('Khi xuất, ứng dụng hỏi khoảng ngày. Để trống cả hai ô là xuất tất cả; các nút **Nhanh** chọn sẵn 4 tuần, 3 tháng, 12 tháng hoặc từ hôm nay.'));
add(fig('24_chon_khoang_ngay', 'Chọn khoảng ngày khi xuất file', { width: 400 }));
add(H2('14.4. Excel'));
add(bullet('**⇩ Export Excel**: xuất lịch dạng bảng, mỗi tuần một khối 7 cột (Thứ Hai → Chủ nhật), gồm kế hoạch và kết quả. Ngày có nhiều bài sẽ có thêm khối "Tuần N - bài 2", "bài 3"…'));
add(bullet('**⇧ Import Excel**: nhập kế hoạch từ file .xlsx đúng mẫu. Cột A là tên hàng, cột B–H là 7 ngày.'));
add(bullet('Excel còn mang theo **buổi fitness** (mục 8.9) và sheet phụ **Body** chứa chỉ số cơ thể (mục 9.6). Sheet đầu luôn là lưới tuần nên bản cũ vẫn đọc được.'));
add(table(['Hàng (cột A)', 'Nội dung từng ngày (cột B–H)'], [
  ['Số tuần, ví dụ `43` hoặc `Tuần 43`', 'Tên bài'],
  ['`ngày`', 'Ngày tập (dd/mm/yyyy hoặc kiểu ngày của Excel)'],
  ['`Mô tả bài tập`', 'Mô tả tự do'],
  ['`Số km dự kiến`, `Số phút dự kiến`', 'Khối lượng kế hoạch'],
  ['`Ghi chú kế hoạch`', 'Ghi chú'],
  ['`Cấu trúc bài tập JSON`', 'Không bắt buộc; do ứng dụng tự ghi khi Export, giữ nguyên cấu trúc bài khi nhập lại'],
], [4, 5.5]));
add(note('tip', 'Mẹo', ['Cách nhanh nhất để có file Excel mẫu: tạo vài bài trong ứng dụng → **Export Excel** → sửa trong Excel → **Import Excel**.']));
add(H2('14.5. Xoá dữ liệu'));
add(P('**Xóa toàn bộ dữ liệu** (menu Dữ liệu, cột phải hoặc nút ⌫ cuối thanh trái) xoá mọi kế hoạch và kết quả, giữ lại Thư viện mẫu. Ứng dụng hỏi xác nhận trước khi xoá. Hãy sao lưu trước.'));

/* ---------- phần bổ sung cho chương 14 (Quản lý dữ liệu) + chương 15 ---------- */
add(H2('14.6. Nhập file từ app fitness'));
add(P('Các nút nhập (**Nhập bài tập / Training Log**, **Import FIT**, **Import Excel**, **Khôi phục**) tự nhận diện file của app mobile **T17 Run Training**: JSON, Excel 4 sheet hoặc ZIP chứa chúng, chọn được nhiều file một lần. Chi tiết và cách ghép vào buổi đã giao ở mục 8.7.'));
add(H2('14.7. Dung lượng và cảnh báo của bản web'));
add(P('Bản web lưu trong bộ nhớ trình duyệt, giới hạn khoảng **5 MB** cho mỗi trang (Chrome, Edge). Ứng dụng đo dung lượng đang dùng và:'));
add(bullet('**Từ mức khoảng 4 / 5 MB** hiện cảnh báo "sắp đầy" ở cột phải, nêu phần nào chiếm nhiều chỗ (ảnh bài tập, dữ liệu chi tiết từ file FIT, bản dự phòng trong trình duyệt) và gợi ý **chuyển sang bản exe** hoặc **nén / xoá bớt ảnh bài tập**.'));
add(bullet('**Khi đầy:** ứng dụng tự bỏ các bản dự phòng tự động trong trình duyệt rồi lưu lại. Nếu vẫn không lưu được, ứng dụng báo rõ "thay đổi vừa rồi **CHƯA được lưu**" — hãy **Sao lưu toàn bộ (JSON)** ngay và chuyển sang bản exe.'));
add(bullet('**Bản exe không bị giới hạn này.** Với ba năm dữ liệu (khoảng 1.000 buổi, 500 lần đo cơ thể, 100 ảnh bài tập) file dữ liệu có thể lên khoảng 18 MB, phần lớn là dữ liệu chi tiết của file FIT; bản exe mở file này trong khoảng 1,5 giây.'));
add(bullet('**File nhập quá lớn** (trên 60 MB, riêng ảnh trên 30 MB) bị chặn trước khi đọc, kèm thông báo.'));
add(H2('14.8. Các lớp bảo vệ khi nhập và khôi phục'));
add(bullet('Trước khi gộp file fitness hoặc **ghi đè** bằng khôi phục, ứng dụng tự lưu một bản sao (`…-truoc-nhap-fitness-…`, `…-truoc-khoi-phuc-…`) để bạn quay lại được.'));
add(bullet('File hỏng hoặc thiếu trường không làm ứng dụng sập và **không ghi đè dữ liệu đang có**: dòng, ngày hoặc ảnh không hợp lệ bị bỏ qua và được báo lại.'));
add(bullet('Ảnh bài tập chỉ nhận định dạng PNG, JPEG, GIF, WebP hợp lệ.'));

/* ---------- 15. Giới hạn ---------- */
add(H1('15. Giới hạn và điều cần lưu ý'));
add(table(['Hạng mục', 'Giới hạn', 'Nên làm'], [
  ['Calo trong ngày', 'Là **ước tính theo công thức, sai số khoảng ±10–15%**; không phải tư vấn dinh dưỡng hay y tế. Calo từ đồng hồ hoặc nhập tay cũng phụ thuộc thiết bị.', 'Dùng để so sánh các ngày và theo dõi xu hướng; sửa nền hoặc PAL nếu thấy lệch (chương 10).'],
  ['Chưa kiểm trên Windows thật', 'Các tính năng mới của bản này (nhiều người dùng, Fitness, chỉ số cơ thể, calo) đã được kiểm thử tự động và chạy thử trên bản exe **Linux**. **Chưa được chạy thử trên máy Windows thật** (Windows dùng WebView2). Hộp thoại Lưu của hệ điều hành chưa thử tay.', 'Sao lưu JSON trước khi nâng cấp; nếu gặp lỗi trên Windows, báo lại kèm thao tác.'],
  ['Ảnh trong tài liệu', 'Chụp từ **dữ liệu mẫu** trên bản web, trình duyệt tiếng Anh nên ô ngày hiện mm/dd/yyyy. Giao diện bản exe có thể khác nhẹ về phông chữ và cỡ chữ.', 'Ô ngày theo cài đặt ngôn ngữ của Windows.'],
  ['Bản web', 'Bộ nhớ trình duyệt khoảng 5 MB (mục 14.7).', 'Dùng bản exe cho dữ liệu nhiều năm hoặc có nhiều ảnh, file FIT.'],
  ['Dữ liệu FIT chi tiết', 'Mỗi buổi nhập FIT lưu kèm chuỗi điểm chi tiết (khoảng 20–70 KB), chiếm phần lớn dung lượng file nhiều năm. Mỗi lần lưu, bản exe ghi lại cả file (khoảng 1–2 giây với dữ liệu 3 năm, chạy nền).', 'Sao lưu định kỳ; chưa có tuỳ chọn thu gọn dữ liệu FIT.'],
  ['Cân thông minh', 'Chỉ nhập số đo qua **CSV** hoặc nhập tay; chưa kết nối trực tiếp với cân.', 'Xuất CSV từ ứng dụng của cân rồi nhập (mục 9.3).'],
  ['App mobile', 'Khi nhập file vào app mobile, thư viện bài của app bị thay bằng thư viện trong file.', 'Xem cảnh báo ở mục 8.8.'],
  ['Excel của bản cũ', 'Bản trước 2.3 đọc buổi fitness như bài thường (tên, thời lượng, mô tả); dữ liệu chạy bộ không đổi.', 'Dùng bản mới để xem đầy đủ buổi fitness.'],
  ['Garmin', 'Chỉ buổi **chạy có cấu trúc** xuất được thành file Workout .fit; buổi fitness chỉ trao đổi với app mobile.', 'Xem chương 12.'],
], [2.2, 4.8, 2.6]));

/* ---------- 16. FAQ ---------- */
add(H1('16. Câu hỏi thường gặp và xử lý sự cố'));
const faq = [
  ['Nhấp đúp exe nhưng không thấy cửa sổ.', 'Máy thiếu Microsoft Edge WebView2 Runtime. Tải và cài "WebView2 Runtime (Evergreen)" từ trang của Microsoft, rồi chạy lại.'],
  ['Windows báo "Windows protected your PC".', 'File exe chưa được ký số nên SmartScreen cảnh báo. Bấm **More info** → **Run anyway**.'],
  ['Cột phải báo dữ liệu lưu ở %APPDATA% thay vì cạnh exe.', 'Thư mục chứa exe không cho ghi (ví dụ Program Files hoặc ổ chỉ đọc). Chuyển cả thư mục sang ổ D: hoặc Documents.'],
  ['Nâng cấp phiên bản có mất dữ liệu không?', 'Không. Giải nén bản mới đè lên thư mục cũ; thư mục `data\\` không bị thay. Có thể Sao lưu toàn bộ trước cho chắc.'],
  ['Import FIT báo "Đã có hoạt động này".', 'File đã được nhập trước đó. Muốn nhập lại vào bài khác: mở bài cũ → Tách kết quả hoặc Xóa kết quả, rồi nhập lại.'],
  ['FIT ghép sai bài hoặc sai ngày.', 'Mở cửa sổ kết quả → **⇱ Tách kết quả khỏi bài tập** để thành thẻ tím, rồi kéo thả vào đúng bài.'],
  ['Section sau khi ghép FIT bị lệch.', 'Trong cửa sổ kết quả bấm **↻ Ghép section từ FIT** và chọn cách chia khác (theo lap), hoặc sửa tay từng section.'],
  ['Điểm tải có vẻ quá cao hoặc quá thấp.', 'Kiểm tra Hồ sơ VĐV (đặc biệt LTHR và HR nghỉ). Nhãn trên thẻ cho biết cách tính; "ước tính theo loại bài" là kém chính xác nhất.'],
  ['Ô ngày hiện mm/dd/yyyy thay vì dd/mm/yyyy.', 'Định dạng ô ngày theo cài đặt ngôn ngữ của Windows/trình duyệt. Ảnh trong tài liệu chụp ở chế độ tiếng Anh.'],
  ['Bản web báo không lưu được dữ liệu.', 'Bộ nhớ trình duyệt đã đầy. Sao lưu toàn bộ (JSON) ngay, rồi chuyển sang dùng bản exe và Khôi phục từ file đó.'],
];
faq.push(
  ['Máy dùng chung — dữ liệu của hai người có lẫn nhau không?', 'Không. Mỗi người dùng có file dữ liệu riêng; chỉ khi chuyển người bằng nút góc phải thì lịch mới đổi (chương 7). Hộp xem trước khi nhập file luôn ghi tên người sẽ nhận dữ liệu.'],
  ['Nhập file app mobile nhưng buổi thành "Buổi mới" thay vì gắn vào buổi đã giao.', 'Buổi chỉ được gắn khi cùng ngày và khớp mã buổi, mẫu hoặc tên. Kiểm tra ngày của buổi đã giao và ngày trong file; ở hộp xem trước bạn chọn được cách xử lý cho từng buổi (mục 8.7).'],
  ['Dòng calo hiện "kcal ?".', 'Còn thiếu thông tin để tính. Bấm vào để xem thiếu gì — thường là chiều cao, ngày sinh, giới tính hoặc cân nặng — rồi bổ sung trong Hồ sơ hoặc Chỉ số cơ thể (chương 10).'],
  ['Calo ngày lệch nhiều so với đồng hồ hoặc ứng dụng khác.', 'Mỗi nơi tính theo công thức riêng, sai số ±10–15% là bình thường. Nếu nền khác nhiều so với cảm nhận, sửa PAL hoặc ghi đè nền của ngày (mục 10.4).'],
  ['Nhập CSV cân thông minh không đọc được.', 'Ứng dụng báo số dòng lỗi và cột không dùng. Kiểm tra dòng đầu có tên cột (ngày, cân nặng…) và ngày dạng dd/mm/yyyy hoặc yyyy-mm-dd; số dùng dấu phẩy hoặc chấm đều được (mục 9.3).'],
  ['Bản web báo "sắp đầy" hoặc "CHƯA được lưu".', 'Bộ nhớ trình duyệt khoảng 5 MB sắp hết. Sao lưu toàn bộ (JSON) ngay và chuyển sang bản exe (mục 14.7).'],
);
for (const [q, a] of faq) { add(H3(q)); add(P(a)); }

/* ---------- Phụ lục ---------- */
add(H1('Phụ lục. Thuật ngữ'));
add(table(['Thuật ngữ', 'Giải thích'], [
  ['ATL (Acute Training Load)', 'Mệt mỏi: trung bình tải có trọng số 7 ngày.'],
  ['BMR', 'Basal metabolic rate: calo cơ thể cần khi nghỉ hoàn toàn.'],
  ['Cadence', 'Số bước chân mỗi phút (spm).'],
  ['CTL (Chronic Training Load)', 'Thể lực: trung bình tải có trọng số 42 ngày.'],
  ['FFM', 'Khối nạc (fat-free mass) = cân nặng trừ khối mỡ.'],
  ['FIT', 'Flexible and Interoperable Data Transfer: định dạng file của Garmin cho hoạt động và bài tập.'],
  ['HR', 'Heart rate: nhịp tim, đơn vị bpm (nhịp/phút).'],
  ['Lap', 'Một đoạn đồng hồ ghi riêng, do bạn bấm nút Lap hoặc do bài tập trên đồng hồ tự chia.'],
  ['LTHR', 'Lactate threshold heart rate: nhịp tim ngưỡng.'],
  ['MET', 'Hệ số cường độ: 1 MET là lúc nghỉ. Dùng để ước tính calo buổi fitness.'],
  ['PAL', 'Physical activity level: hệ số hoạt động ngoài giờ tập; Nền = BMR × PAL.'],
  ['Pace', 'Thời gian chạy 1 km, dạng phút:giây/km.'],
  ['RPE', 'Rating of perceived exertion: mức mệt cảm nhận 1–10.'],
  ['Set / Rep', 'Set: một hiệp tập. Rep: số lần lặp trong một hiệp.'],
  ['rTSS', 'Điểm tải tính theo pace so với pace ngưỡng.'],
  ['Stride length', 'Độ dài sải chân (m).'],
  ['TRIMP', 'Training impulse: điểm tải tính theo nhịp tim và thời gian (Banister).'],
  ['TSB (Training Stress Balance)', 'Độ tươi = CTL − ATL của hôm trước.'],
  ['TSS', 'Training Stress Score: thang điểm tải, 100 = 60 phút đúng ngưỡng.'],
], [3, 6.5]));

/* =====================================================================
 * DOCUMENT
 * ===================================================================== */
const doc = new Document({
  creator: 'T17 RunTracker', title: 'Hướng dẫn sử dụng T17 RunTracker v2.5', description: 'Hướng dẫn sử dụng T17 RunTracker',
  styles: {
    default: { document: { run: { font: FONT, size: 21, color: '1F2937' } } },
    paragraphStyles: [
      { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 34, bold: true, color: NAVY }, paragraph: { spacing: { before: 120, after: 220 }, outlineLevel: 0, border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: BLUE, space: 6 } } } },
      { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 26, bold: true, color: BLUE }, paragraph: { spacing: { before: 280, after: 120 }, outlineLevel: 1, keepNext: true } },
      { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: FONT, size: 22, bold: true, color: NAVY }, paragraph: { spacing: { before: 200, after: 60 }, outlineLevel: 2, keepNext: true } },
    ],
  },
  numbering: { config: [
    { reference: 'bullets', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }, { level: 1, format: LevelFormat.BULLET, text: '–', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 1000, hanging: 270 } } } }] },
    { reference: 'steps', levels: [{ level: 0, format: LevelFormat.DECIMAL, text: 'Bước %1.', alignment: AlignmentType.LEFT, style: { run: { bold: true, color: BLUE }, paragraph: { indent: { left: 900, hanging: 900 } } } }] },
  ] },
  features: { updateFields: true },
  sections: [
    { properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134 } } }, children: cover },
    {
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, bottom: 1134, left: 1134, right: 1134, header: 567, footer: 567 } } },
      headers: { default: new Header({ children: [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: LINE, space: 4 } }, tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }], children: [new TextRun({ text: 'T17 RunTracker', bold: true, color: NAVY, size: 17 }), new TextRun({ text: '\tHướng dẫn sử dụng · v2.5', color: MUTED, size: 17 })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Trang ', color: MUTED, size: 17 }), new TextRun({ children: [PageNumber.CURRENT], color: MUTED, size: 17 }), new TextRun({ text: ' / ', color: MUTED, size: 17 }), new TextRun({ children: [PageNumber.TOTAL_PAGES], color: MUTED, size: 17 })] })] }) },
      children: C,
    },
  ],
});
Packer.toBuffer(doc).then(b => { fs.writeFileSync(OUT, b); console.log('✔', OUT, (b.length / 1048576).toFixed(1) + ' MB', '·', figNo, 'hình'); });
