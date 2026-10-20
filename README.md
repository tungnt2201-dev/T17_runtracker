# T17 RunTracker

Ứng dụng lập kế hoạch và theo dõi chạy bộ, phát triển tiếp từ **RunPlan Tracker v1.8.9** (file HTML đơn).
Chạy được theo hai cách:

| Bản | File | Dữ liệu lưu ở đâu |
|---|---|---|
| **Windows portable** | `T17_runtracker-vX.Y.Z-win_x64.exe` (~2,6 MB, một file duy nhất) | Thư mục `data\` **ngay cạnh file exe** |
| **Web (một file HTML)** | `T17_runtracker-vX.Y.Z-web.html` | localStorage của trình duyệt (dùng chung khoá với RunPlan cũ) |

Không cần tài khoản, không gửi dữ liệu đi đâu. File Garmin FIT được đọc ngay trên máy.

## Tải về & chạy

1. Vào tab **Actions** (mỗi lần đẩy code) hoặc **Releases** (khi gắn tag `v*`) của repo, tải file `.exe`.
2. Tạo một thư mục riêng, ví dụ `D:\T17\`, đặt file exe vào đó rồi chạy.
3. Lần đầu chạy, app tạo `D:\T17\data\t17-runtracker.json`. Muốn chuyển máy: **copy cả thư mục**.

Yêu cầu: Windows 10/11 có **Microsoft Edge WebView2 Runtime** (Windows 11 có sẵn; Windows 10 cập nhật đầy đủ thường cũng có).
Nếu Windows SmartScreen cảnh báo vì exe chưa ký số: chọn *More info → Run anyway*.

> Không đặt exe trong `C:\Program Files` — thư mục đó không cho ghi. Nếu không ghi được cạnh exe, app tự lưu vào `%APPDATA%\T17_runtracker` và hiển thị đường dẫn ở cột phải.

## Chuyển dữ liệu từ RunPlan cũ

Mọi file JSON đời cũ đều đọc được (chi tiết: [docs/DATA_FORMAT.md](docs/DATA_FORMAT.md)):

- **Sao lưu toàn bộ** của RunPlan v1.x (kể cả bản rất cũ, khi mỗi ngày chỉ có 1 bài) → *Dữ liệu ▾ → Khôi phục toàn bộ*.
- **Xuất bài tập (JSON)** (`format: runplan-plan`) → *Dữ liệu ▾ → Nhập bài tập / Training Log*: gộp thêm, bỏ qua bài trùng.
- **Training Log → Xuất JSON** (`format: runplan-log`) → cùng nút trên: gộp cả **kết quả thực tế**.
- File Excel `.xlsx` theo mẫu cũ → *Import Excel*.

Cách nhanh nhất: mở RunPlan v1.8.9 cũ → *Sao lưu toàn bộ (JSON)* → mở T17 RunTracker → *Khôi phục toàn bộ* chọn file đó.
Bản sao lưu của T17 vẫn giữ mảng `weeks` ở cấp cao nhất nên **RunPlan cũ cũng khôi phục được** (đi ngược phiên bản không mất dữ liệu).

## An toàn dữ liệu (bản exe)

- Ghi vào file tạm trước, rồi mới thay file chính.
- Mỗi ngày tự sao một bản vào `data\backups\` (giữ 14 bản gần nhất).
- Nếu file chính hỏng, app tự nạp file tạm hoặc bản sao lưu mới nhất và báo ở cột phải.
- Đóng cửa sổ sẽ chờ ghi xong rồi mới thoát.

## Phát triển

```bash
npm install
npm test              # build + 22 test (FIT decoder, dữ liệu cũ, Excel, chạy thử app trong jsdom)
npm run build         # dist/web/T17_runtracker.html + resources/ cho Neutralino
npm run dev           # chạy cửa sổ desktop (neu run) để thử
npm run exe           # tải Neutralino 6.10 + đóng gói exe một file vào release/
```

Cấu trúc:

```
src/
  core/        utils.js (thời gian, pace, cấu trúc bài) · legacy.js (đọc mọi định dạng JSON cũ) · excel-plan.js
  lib/         xlsx.js (đọc/ghi .xlsx không cần thư viện) · fit-decoder.js (Garmin FIT)
  platform/    platform.js (lưu file cạnh exe / localStorage, Save As, sao lưu tự động)
  app/         app.js (lịch, builder, thư viện, nhập kết quả, log) · fit-ui.js (nhập FIT)
  styles/      app.css
  body.html, index.template.html
scripts/       build.mjs · check-syntax.mjs · package-win.mjs
tests/         *.test.js + fixtures/ (file JSON mẫu của các đời RunPlan)
legacy/        runplan_tracker_v1_8_9.html (bản gốc để đối chiếu)
docs/          DATA_FORMAT.md · ROADMAP.md
```

Mọi module là *classic script* thuần, được nhúng theo thứ tự vào một file HTML khi build: không cần bundler, exe giữ nhỏ gọn.
GitHub Actions (`.github/workflows/build.yml`) chạy test và đóng gói exe cho mỗi lần đẩy code; gắn tag `v2.0.1` để tạo Release.

Lộ trình: [docs/ROADMAP.md](docs/ROADMAP.md) · Thay đổi: [CHANGELOG.md](CHANGELOG.md)
