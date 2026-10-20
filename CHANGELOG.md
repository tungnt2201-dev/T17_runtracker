# Changelog

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
