# Changelog

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
