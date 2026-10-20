# Lộ trình T17 RunTracker

## P0 — Nền móng (v2.0.0) ✅
- Tách file HTML 2.000+ dòng thành module, build ra 1 file HTML + exe Neutralino một file (~2,6 MB).
- Lưu dữ liệu thành file cạnh exe (portable), ghi an toàn, sao lưu tự động theo ngày, tự phục hồi.
- Đọc mọi định dạng JSON đời cũ; sao lưu mới vẫn tương thích ngược với RunPlan v1.8.x.
- Sửa lỗi: chia đôi HR sai trong `segmentHeight`; ghi DB mỗi lần render; Excel chỉ xuất bài đầu tiên của ngày;
  sửa/xoá nhầm bài khi lịch bị sắp xếp lại (nay tra theo `id`).
- Test tự động (FIT decoder, dữ liệu cũ, Excel, chạy thử app) + GitHub Actions đóng gói exe.

## P1 — Phân tích tải tập (v2.1.0) ✅
- ✅ Hồ sơ VĐV: HRmax, HR nghỉ, LTHR, pace ngưỡng, zones (HR và pace) — thay cho zones tính theo HR max trong từng file.
- ✅ Điểm tải mỗi buổi (hrTSS/rTSS hoặc TRIMP), biểu đồ CTL / ATL / TSB (Performance Management).
- ✅ Bật tab Analytics: km/giờ theo tuần và tháng, phân bố cường độ, tỷ lệ tuân thủ kế hoạch.
- ✅ Xuất bài tập có cấu trúc thành **Workout FIT** để copy vào `GARMIN\NewFiles` trên đồng hồ.
- ✅ Thay `prompt()` bằng hộp thoại trong app (còn lại: `confirm()` cho thao tác xoá/ghi đè — dùng hộp thoại hệ thống).

## P2 — Thành tích & thiết bị
- Tự phát hiện best efforts / PR (1 km, 5 km, 10 km, HM, FM) từ bản ghi FIT.
- Theo dõi số km của từng đôi giày.
- "Đạt kế hoạch" xét cả cường độ (pace/HR theo section), không chỉ khối lượng.
- Wellness hằng ngày: giấc ngủ, HR nghỉ, HRV, độ đau mỏi.
- Loại bài Gym / Bổ trợ: set × rep × kg, mẫu bài sức mạnh cho runner, cộng vào tải tuần.

## P3 — Giáo án & dinh dưỡng
- Sinh giáo án theo giải đích (bảng pace VDOT), tự điều chỉnh khi bỏ buổi.
- Nhật ký ăn uống đơn giản kèm danh sách món Việt; nhu cầu carb theo ngày tập.
- Kế hoạch tiếp năng lượng cho giải (g carb/giờ, nước, điện giải), tính lượng mồ hôi mất.
