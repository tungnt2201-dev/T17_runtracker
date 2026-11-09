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
