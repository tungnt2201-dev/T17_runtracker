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
