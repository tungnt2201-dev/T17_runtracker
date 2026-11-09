# T17 RunTracker

Ứng dụng lập kế hoạch và theo dõi chạy bộ, phát triển tiếp từ **RunPlan Tracker v1.8.9** (file HTML đơn).
Chạy được theo hai cách:

| Bản | File | Dữ liệu lưu ở đâu |
|---|---|---|
| **Windows portable** | `T17_runtracker.exe` (~2,6 MB, một file duy nhất) | Thư mục `data\` **ngay cạnh file exe** |
| **Web (một file HTML)** | `T17_runtracker_web.html` | localStorage của trình duyệt (dùng chung khoá với RunPlan cũ) |

Mỗi phiên bản phát hành là một file nén **`yymmdd_T17_runtracker_vX.Y.Z.zip`** (ví dụ `261020_T17_runtracker_v2.1.0.zip`)
chứa cả hai bản trên, `HUONG_DAN.txt`, `CHANGELOG.md` và **Hướng dẫn sử dụng** (Word, có ảnh minh hoạ từng bước — cũng có tại [`docs/Huong_dan_su_dung_T17_RunTracker.docx`](docs/Huong_dan_su_dung_T17_RunTracker.docx)).

**Nhiều người dùng** (từ v2.2): mỗi người có lịch tập, kết quả và hồ sơ cá nhân riêng; chuyển qua lại bằng nút ở góc phải thanh trên.
**Fitness** (từ v2.3): thư viện bài tập (kèm ảnh) và mẫu buổi, giao bài vào lịch, nhập kết quả, điểm tải RPE × phút; trao đổi file hai chiều với app điện thoại *T17 Run Training* (gửi buổi đã giao sang điện thoại, nhập buổi đã tập về — tự nhận diện, có xem trước, không nhân đôi).
**Chỉ số cơ thể** (từ v2.4): nhập cân nặng, % mỡ, vòng eo… tại từng thời điểm, so với lần trước / 30 ngày / lần đầu, nhập CSV từ cân thông minh; Analytics › *Cơ thể*: biểu đồ có tiêu đề kết luận, tải tập theo tuần cùng trục thời gian, so sánh hai mốc.
**Calo trong ngày** (từ v2.5): nền (BMR × mức hoạt động) + calo tập ròng cho từng ngày, sửa được (công thức, PAL, số cố định, ghi đè từng ngày); hiện trên lịch, Tổng quan tuần và Analytics. Chỉ là ước tính (±10–15%), không phải tư vấn dinh dưỡng hay y tế.
Không cần tài khoản, không gửi dữ liệu đi đâu. File Garmin FIT được đọc ngay trên máy.

## Tải về & chạy

1. Vào **Releases** của repo, tải file `yymmdd_T17_runtracker_vX.Y.Z.zip` mới nhất.
2. Giải nén vào một thư mục riêng, ví dụ `D:\T17\`, rồi chạy `T17_runtracker.exe`.
3. Lần đầu chạy, app tạo `D:\T17\data\t17-runtracker.json` (người dùng đầu tiên; người dùng thêm sau nằm ở `data\users\`). Muốn chuyển máy: **copy cả thư mục**.
4. Nâng cấp: giải nén bản mới **đè lên** thư mục cũ — thư mục `data\` không bị động tới.

Yêu cầu: Windows 10/11 có **Microsoft Edge WebView2 Runtime** (Windows 11 có sẵn; Windows 10 cập nhật đầy đủ thường cũng có).
Nếu Windows SmartScreen cảnh báo vì exe chưa ký số: chọn *More info → Run anyway*.

> Không đặt exe trong `C:\Program Files` — thư mục đó không cho ghi. Nếu không ghi được cạnh exe, app tự lưu vào `%APPDATA%\T17_runtracker` và hiển thị đường dẫn ở cột phải.

## Chuyển dữ liệu từ RunPlan cũ

Mọi file JSON đời cũ đều đọc được (chi tiết: [docs/DATA_FORMAT.md](docs/DATA_FORMAT.md)):

- **Sao lưu toàn bộ** của RunPlan v1.x (kể cả bản rất cũ, khi mỗi ngày chỉ có 1 bài) → *Dữ liệu ▾ → Khôi phục toàn bộ*.
- **Xuất bài tập (JSON)** (`format: runplan-plan`) → *Dữ liệu ▾ → Nhập bài tập / Training Log*: gộp thêm, bỏ qua bài trùng.
- **Training Log → Xuất JSON** (`format: runplan-log`) → cùng nút trên: gộp cả **kết quả thực tế**.
- File Excel `.xlsx` theo mẫu cũ → *Import Excel*.
- File JSON / Excel / ZIP xuất từ app điện thoại *T17 Run Training* → bất kỳ nút nhập nào (*Nhập bài tập*, *Import FIT*, *Import Excel*) — app tự nhận ra và mở hộp xem trước.

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
npm test              # build + 126 test (FIT decoder, dữ liệu cũ, Excel, chạy thử app trong jsdom)
npm run build         # dist/web/T17_runtracker.html + resources/ cho Neutralino
npm run dev           # chạy cửa sổ desktop (neu run) để thử
npm run exe           # tải Neutralino 6.10 + đóng gói release/yymmdd_T17_runtracker_vX.Y.Z.zip
```

Cấu trúc:

```
src/
  core/        utils.js (thời gian, pace, cấu trúc bài) · legacy.js (đọc mọi định dạng JSON cũ) · users.js (nhiều người dùng, hồ sơ cá nhân) · fitness.js (dữ liệu fitness) · fitness-import.js (nhập file app mobile) · body.js (chỉ số cơ thể) · excel-plan.js
               athlete.js (hồ sơ VĐV, vùng HR/pace) · load.js (điểm tải, CTL/ATL/TSB) · fit-workout.js (xuất Workout FIT)
  lib/         xlsx.js (đọc/ghi .xlsx không cần thư viện) · fit-decoder.js (Garmin FIT)
  platform/    platform.js (lưu file cạnh exe / localStorage, Save As, sao lưu tự động)
  app/         app.js (lịch, builder, thư viện, nhập kết quả, log) · fit-ui.js (nhập FIT)
               analytics.js (tab Analytics) · profile.js (hồ sơ) · users-ui.js (chuyển người dùng) · fitness-ui.js (thư viện, giao bài, kết quả fitness) · fitness-import-ui.js (hộp nhập file app mobile) · body-ui.js (chỉ số cơ thể) · body-charts.js (Analytics › Cơ thể) · dialogs.js (hộp thoại trong app)
  styles/      app.css
  body.html, index.template.html
scripts/       build.mjs · check-syntax.mjs · package-win.mjs
tests/         *.test.js + fixtures/ (file mẫu các đời RunPlan/T17, app mobile) + compat/ (lõi v2.2.0 để test tương thích)
legacy/        runplan_tracker_v1_8_9.html · T17_Run_Training_Mobile.html (bản gốc để đối chiếu)
docs/          DATA_FORMAT.md · ROADMAP.md
```

Mọi module là *classic script* thuần, được nhúng theo thứ tự vào một file HTML khi build: không cần bundler, exe giữ nhỏ gọn.
GitHub Actions (`.github/workflows/build.yml`) chạy test và đóng gói zip cho mỗi lần đẩy code.
Khi `version` trong `package.json` đổi và được đẩy lên `main`, workflow tự tạo tag `vX.Y.Z` + Release kèm file zip.

Lộ trình: [docs/ROADMAP.md](docs/ROADMAP.md) · Thay đổi: [CHANGELOG.md](CHANGELOG.md)
