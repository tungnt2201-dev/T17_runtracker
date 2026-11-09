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
