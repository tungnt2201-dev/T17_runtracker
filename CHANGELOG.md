# Changelog

## 2.3.0 — 2026-11-09 (Fitness)

Gói: `261109_T17_runtracker_v2.3.0.zip`. Dữ liệu cũ (RunPlan, T17 2.0–2.2, nhiều người dùng) mở được nguyên vẹn; file của bản 2.3 vẫn mở được bằng bản 2.2.0 (có test so với mã nguyên văn của 2.2.0).

### Nhập buổi tập từ app mobile *T17 Run Training* (lượt 3)
- **Tự nhận diện** file của app fitness ở mọi nút nhập sẵn có: *Nhập bài tập / Training Log* (nay chọn được nhiều file, cả ZIP và Excel), *Import FIT*, *Import Excel*, *Khôi phục*. Nhận JSON v1 / v2 / v3, Excel 4 sheet (`Session`, `Workout Log`, `Guide`, `Library`) và ZIP chứa chúng. Excel kế hoạch của T17 vẫn đi luồng cũ, không nhầm.
- **Hộp xem trước** trước khi ghi: tên người dùng đang chọn; từng buổi (ngày, tên, số bài / số bài xong, phút, RPE, kcal, tên file); trạng thái *Gắn vào buổi đã giao* / *Buổi mới* / *Đã có* / *Đã có — nội dung khác*; chọn gắn / tạo mới / bỏ qua / ghi đè; file lỗi được liệt kê riêng.
- **Gắn kết quả vào buổi đã giao** cùng ngày: theo mã buổi (file đi khứ hồi T17 → app mobile → T17), rồi theo mẫu buổi, rồi theo tên. Hai buổi cùng ngày ở hai file thành hai buổi. Buổi được giao ngày khác → cảnh báo, kết quả thành buổi mới vào ngày tập.
- **Nhận diện bài tập**: trùng `libraryId` → trùng tên đã chuẩn hoá (bỏ dấu, chữ thường, bỏ ký tự lạ) → giống ≥ 85% thì **gợi ý** để bạn chọn → còn lại thêm vào thư viện, đánh dấu **Chưa xác nhận** (có nút *Xác nhận* trong Thư viện → Fitness).
- **Chống trùng**: nhập lại cùng file chỉ báo “đã có”, không nhân đôi; JSON và Excel của cùng một buổi trong một lần nhập chỉ tính một lần.
- **Tự sao lưu trước khi gộp**: bản exe ghi `data\backups\<người dùng>-truoc-nhap-fitness-YYYYMMDD-HHMMSS.json` (giữ 10 bản); bản web giữ một bản trong trình duyệt.
- **Ngày theo giờ địa phương**: thời điểm có múi giờ (vd. `2026-11-07T17:30Z`) được đổi sang giờ máy, không lệch một ngày. Calo, RPE, thời lượng trong file vào kết quả buổi.

### Lượt 2 — thư viện, giao bài, nhập kết quả

- **Thư viện → tab Fitness**: 15 bài dựng sẵn + 2 mẫu buổi (từ app mobile *T17 Run Training*); tìm kiếm; tạo / sửa / nhân bản / xoá bài tự tạo (tên, nhóm cơ, prescription, cách tập, chú ý, dòng mẫu set·rep·thời gian·kg, MET tuỳ chọn). Mỗi bài 1 ảnh, **tự thu nhỏ và nén ≤ 60 KB** (báo rõ nếu không nén được). Bài dựng sẵn không xoá/sửa nội dung, chỉ gắn ảnh/MET hoặc nhân bản.
- **Mẫu buổi** của người dùng (danh sách bài, thời lượng, ghi chú, RPE dự kiến) lưu trong `templates` cùng chỗ với mẫu bài chạy; tab Bài chạy không hiện mẫu fitness.
- **Giao bài**: chọn mẫu → lặp theo thứ trong tuần trong N tuần, hoặc chọn từng ngày. Tạo buổi kế hoạch mới, không ghi đè; ngày đã có buổi chưa tập của cùng mẫu thì bỏ qua.
- **Thẻ Fitness trên lịch** (🏋): số bài, thời lượng, số set/kg, chấm màu tải dự kiến, danh sách bài (✓ / gạch bỏ khi đã nhập kết quả). Nút ✎ sửa danh sách bài **của riêng buổi đó** (thêm, bớt, đổi thứ tự, đổi set/rep/kg); ⋮ hoặc bấm thẻ để nhập kết quả.
- **Nhập kết quả tay**: tick xong từng bài, sửa dòng thực tế, thời lượng, calo, RPE, ghi chú; xoá kết quả. Màu thẻ theo tỉ lệ bài xong / tổng bài, cùng thang màu với bài chạy (≥ 90% đạt · 70–90% · 50–70% · 20–50% · < 20%).
- **Điểm tải fitness = RPE × phút ÷ 4,8** (session-RPE của Foster quy về thang TSS: RPE 8 trong 60 phút = 100, ngang 60 phút chạy đúng ngưỡng). Thiếu RPE → RPE mặc định 5 (hoặc RPE dự kiến của mẫu). Bài chạy bộ không đổi cách tính.
- **Xuất cho app mobile** (nút 📱): một buổi → file JSON v3 của app; nhiều buổi trong khoảng ngày → ZIP, mỗi buổi `YYYY-MM-DD_tên-buổi.json`. Mã buổi T17 được gửi trong `instanceId` của từng bài (`<mã buổi>:<k>`) — chỗ duy nhất app mobile giữ nguyên khi nạp và xuất lại.
- **Excel**: lưới tuần có thêm hàng *Mã buổi fitness* và cuối sheet có khối *FITNESS — CHI TIẾT BÀI TẬP* (mỗi bài × mỗi dòng set một hàng, cả KH và TT). Nhập lại đọc đủ bài; bản cũ bỏ qua hai phần này.
- FIT chạy bộ không còn bị tự ghép nhầm vào buổi fitness.

### Lượt 1 — lớp dữ liệu


- `src/core/fitness.js`: thư viện 15 bài + 2 mẫu buổi trích nguyên văn từ app mobile *T17 Run Training*; đọc file JSON v3 và JSON đời cũ (`T17_RUN_BASIC_1_V1`) của app mobile; tóm tắt chữ, tổng khối lượng (set/rep/kg), mã băm nội dung chống trùng.
- Mô hình dữ liệu: `workoutType: "Fitness"`, `workout.fitness` (kế hoạch), `actual.fitness` (thực tế), `db.fitnessLibrary`, `db.features` — đều cộng thêm, tuỳ chọn. Giữ `schemaVersion: 2` (lý do trong `docs/DATA_FORMAT.md`).
- Xuất bài tập JSON, Training Log JSON, thêm bài từ mẫu/Excel, copy bài mang theo khối fitness; copy hoặc thêm từ mẫu cấp `sessionId` mới. Bài chạy bộ xuất ra **đúng bộ trường như cũ**.
- Gộp file: hai buổi fitness cùng ngày, cùng thời lượng nhưng khác nội dung không còn bị coi là trùng.
- Test tương thích hai chiều với lõi nguyên văn của v2.2.0 (`tests/compat/`), fixture từ app mobile (JSON v3, JSON đời cũ, Excel) và bộ dữ liệu 2 người dùng do chính v2.2.0 ghi ra.

## 2.2.0 — 2026-10-26

### Mới: nhiều người dùng
- Nút người dùng ở góc phải thanh trên: danh sách, **chuyển người dùng** một cú bấm, **thêm người dùng**, mở hồ sơ, xoá người dùng (gõ tên để xác nhận).
- Mỗi người dùng có kho dữ liệu **riêng hoàn toàn**: lịch tập, kết quả, FIT, mẫu bài và hồ sơ. Sao lưu / khôi phục / xoá dữ liệu chỉ tác động tới người đang chọn.
- **Hồ sơ cá nhân đầy đủ, nhập bổ sung dần** (mọi ô tuỳ chọn): họ tên, biệt danh, ngày sinh (tự tính tuổi), giới tính, chiều cao, cân nặng (tự tính BMI), email, điện thoại, nơi ở, CLB, liên hệ khẩn cấp, mục tiêu, ghi chú — cùng với thông số tập luyện sẵn có. Thanh tiến độ cho biết đã nhập bao nhiêu mục; gợi ý HR tối đa theo tuổi.
- Bản .exe: người dùng cũ giữ nguyên file `data\t17-runtracker.json`; người mới nằm ở `data\users\<mã>.json`, danh sách ở `data\users.json`. Mỗi người có bản sao lưu tự động hằng ngày riêng. Xoá người dùng chỉ chuyển file vào `data\deleted\`. Nếu `users.json` hỏng, app tự dò lại từ thư mục `users\`.
- Bản web: người dùng cũ giữ khoá localStorage cũ; người mới dùng khoá `runplan-tracker-v1:<mã>`.
- App mở lại đúng người dùng đã dùng lần trước.

### Sửa lỗi
- Ghi file: gọi flush khi không có gì chờ ghi có thể làm kẹt các lần lưu sau trong cùng phiên.

### Tương thích dữ liệu
- Không đổi schema file dữ liệu; thêm các trường cá nhân vào `profile`. Nâng cấp từ 2.0 / 2.1 không cần làm gì — dữ liệu cũ tự thành người dùng đầu tiên (“Tôi”). File sao lưu của mỗi người dùng vẫn đọc được bằng bản cũ.

## 2.1.1 — 2026-10-21

- **Hướng dẫn sử dụng** dạng Word (`docs/Huong_dan_su_dung_T17_RunTracker.docx`, 34 trang, 30 hình), có trong gói zip phát hành.
- Sửa: trên cột ngày hẹp, hàng nút công cụ (✎ ⧉ ⌚ ⌫ ⋮) đè lên tên bài — nay tự xuống dòng.

## 2.1.0 — 2026-10-20 (P1)

Gói phát hành từ bản này: **`yymmdd_T17_runtracker_vX.Y.Z.zip`** (exe + bản web + hướng dẫn). Giải nén đè lên thư mục cũ, dữ liệu trong `data\` được giữ nguyên.

### Mới
- **Hồ sơ VĐV** (nút ♥ ở thanh trái hoặc trong Analytics): HR nghỉ, HR tối đa, LTHR, pace ngưỡng; xem trước 5 vùng nhịp tim và 5 vùng pace. Có nút lấy HR tối đa từ các file FIT đã nhập.
- **Điểm tải từng buổi** (thang TSS: 100 = 60 phút đúng ngưỡng), hiện trên thẻ bài: ưu tiên chuỗi nhịp tim FIT → nhịp tim TB → pace → RPE → loại bài. Bài kế hoạch hiện tải dự kiến.
- **Tab Analytics**: Thể lực (CTL) · Mệt mỏi (ATL) · Độ tươi (TSB) kèm dự báo theo kế hoạch tới 4 tuần; cảnh báo tăng tải quá nhanh; km theo tuần KH/TT; thời gian trong các vùng nhịp tim (tỷ lệ dễ : trung bình : khó); tổng hợp theo loại bài và theo tuần. Chọn 8 tuần / 12 tuần / 6 tháng / 12 tháng / tất cả, rê chuột để xem số liệu.
- **Xuất bài cho đồng hồ Garmin** (nút ⌚ trên thẻ bài và trong Workout Builder): file Workout `.fit` có warm-up, vòng lặp, cool-down, target pace hoặc nhịp tim. Copy vào `GARMIN\NewFiles` qua USB.
- Vùng nhịp tim trong màn hình phân tích FIT dùng hồ sơ VĐV (nếu đã nhập) thay cho % HR max của từng file.
- Tổng quan tuần (cột phải) có thêm Tải TT / Tải KH.
- Hộp thoại trong app thay cho `prompt()`: chọn khoảng ngày khi xuất (có nút nhanh 4 tuần / 3 tháng / 12 tháng), chọn nhiều ngày khi copy bài, chọn bài khi ghép FIT, đặt tên mẫu.

### Đóng gói
- GitHub Actions tự tạo **Release vX.Y.Z** kèm file zip mỗi khi version mới được đẩy lên `main`.

### Tương thích dữ liệu
- Thêm trường `profile` ở cấp cao nhất (không đổi schema các trường cũ). RunPlan v1.8.x và T17 v2.0 vẫn đọc được file sao lưu mới.

## 2.0.0 — 2026-10-20 (P0)

Bản đầu tiên của **T17 RunTracker**, tách từ RunPlan Tracker v1.8.9. Toàn bộ tính năng cũ được giữ nguyên.

### Mới
- Bản Windows portable: một file `.exe` (Neutralino 6.10), dữ liệu trong `data\` cạnh exe.
- Ghi file an toàn (file tạm → file chính), sao lưu tự động mỗi ngày (giữ 14 bản), tự phục hồi khi file hỏng.
- Lưu/xuất file qua hộp thoại *Save As* của Windows; nút *Mở thư mục dữ liệu*.
- Lần đầu chạy exe tự chuyển dữ liệu localStorage cũ (nếu có) sang file.
- Đọc mọi định dạng JSON đời cũ (xem `docs/DATA_FORMAT.md`); *Nhập bài tập* nhận cả Training Log (kèm kết quả).
- Hộp thoại khôi phục hiện thống kê nội dung file trước khi ghi đè.
- Xuất Excel đủ mọi bài trong ngày (khối `Tuần N - bài k`), import đọc lại được.

### Sửa lỗi
- Biểu đồ bài tập: cột HR bị thấp sai khi chỉ nhập HR min (lỗi thứ tự toán tử).
- Không còn ghi lại toàn bộ dữ liệu sau mỗi lần vẽ lịch.
- Lưu kết quả, sửa hoặc xoá bài giờ tra theo `id`, không nhầm bài khi lịch được sắp xếp lại trong lúc đang mở hộp thoại.
- Tuần nhập từ Excel bắt đầu giữa tuần được căn lại về thứ Hai, không còn tuần chồng ngày.
