# Nguồn dựng Hướng dẫn sử dụng (Word)

Kết quả: `docs/Huong_dan_su_dung_T17_RunTracker.docx` (đi kèm gói zip). Thư mục này chỉ giữ **mã nguồn dựng** để lần sau cập nhật; không chạy trong CI.

- `shoot.js`, `shoot2.js` — chụp màn hình bản web bằng puppeteer-core + @sparticuz/chromium (`python3 -m http.server 8765 --directory dist/web`) từ **dữ liệu mẫu hư cấu** `sample-data*.js`. Ảnh ra thư mục `img/` (không đưa vào repo).
- `build-docx.js` — dựng .docx bằng thư viện `docx` (Node). `parts/` là bản nháp nội dung các chương 7–10, 14.6–15 đã được ghép vào `build-docx.js`.
- `toc_update.py` (LibreOffice cập nhật mục lục, xuất PDF) → `inject_toc.py` (chép số trang vào mục lục của file .docx).
- Các đường dẫn trong script là của máy dựng ban đầu (thư mục tạm của phiên làm việc, `/home/claude/T17_runtracker`); sửa lại cho khớp máy bạn trước khi chạy.
- Khi đổi giao diện: chụp lại ảnh, sửa nội dung, nâng số phiên bản và ngày trên bìa, dựng lại và chép file vào `docs/`.
