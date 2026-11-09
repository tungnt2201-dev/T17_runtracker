/* ---------- 10. Calo trong ngày ---------- */
add(H1('10. Calo trong ngày: công thức và cách sửa'));
add(P('Ứng dụng ước tính **số calo bạn tiêu hao mỗi ngày** để bạn so với lượng ăn vào và theo dõi tải tập. Con số gồm hai phần cộng lại, tính riêng cho từng người dùng:'));
add(table(['Phần', 'Là gì', 'Tính từ'], [
  ['**Nền** (hoạt động bình thường)', 'Calo cơ thể dùng cả ngày khi **chưa tính giờ tập**: nghỉ ngơi, đi lại, làm việc.', 'BMR × mức hoạt động (PAL), hoặc số bạn tự nhập.'],
  ['**Tập (ròng)**', 'Phần calo **tăng thêm** do các buổi tập trong ngày (chạy và fitness).', 'Từng buổi tập (mục 10.3).'],
  ['**Tổng ước tính**', 'Nền + Tập.', 'Cộng hai phần trên.'],
], [2.8, 4, 2.6]));
add(note('warn', 'Đây là ước tính', ['Số calo được tính theo công thức, **sai số thường khoảng ±10–15%** so với thực tế. Đây **không phải tư vấn dinh dưỡng hay y tế**. Dùng để so sánh các ngày với nhau và theo dõi xu hướng, đừng coi là con số tuyệt đối. Dòng nhắc này luôn hiện ở mọi nơi có con số calo.']));
add(H2('10.1. Xem calo ở đâu'));
add(figRow([{ file: '70_calo_tren_lich', caption: 'Dòng 🔥 kcal ở đầu mỗi ngày trong lịch' }, { file: '72_the_calo_tuan', caption: 'Thẻ Calo ngày ở cột tổng hợp tuần' }], 470));
add(bullet('**Lịch:** đầu mỗi ngày có nút **🔥 2.020 (+632)**: số lớn là calo **nền**, số trong ngoặc là calo tập (ngày chưa tập hiện là *dự kiến*). Ngày chưa tính được hiện **kcal ?** — bấm vào để biết thiếu gì.'));
add(bullet('**Cột tổng hợp tuần:** thẻ **Calo ngày** mỗi ngày một dòng: thanh xanh là nền, cam là calo tập, cam nhạt là phần dự kiến; cuối thẻ là trung bình kcal/ngày của tuần.'));
add(bullet('**Analytics › Tập luyện:** biểu đồ cột chồng calo từng ngày (8 tuần) hoặc trung bình mỗi ngày theo tuần (khoảng dài hơn), kèm đường trung bình (mục 11.7).'));
add(P('Bấm vào dòng 🔥 của một ngày (hoặc một dòng trong thẻ Calo ngày) để mở **chi tiết ngày**:'));
add(fig('71_chi_tiet_ngay', 'Chi tiết calo một ngày: BMR, nền, từng buổi tập và cách tính', { width: 520 }));
add(H2('10.2. Calo nền được tính thế nào'));
add(P('**Nền = BMR × PAL.** BMR là calo cơ thể cần khi nằm nghỉ; PAL là hệ số hoạt động ngoài giờ tập.'));
add(table(['Công thức BMR (ưu tiên từ trên xuống)', 'Khi nào dùng'], [
  ['BMR **đo bằng cân** (ô BMR trong số đo cơ thể)', 'Lần đo gần nhất có ghi BMR.'],
  ['**Katch–McArdle**', 'Có cân nặng và **% mỡ**: BMR = 370 + 21,6 × khối nạc (kg).'],
  ['**Mifflin–St Jeor**', 'Có cân nặng, chiều cao, tuổi, giới tính: nam = 10×kg + 6,25×cm − 5×tuổi + 5; nữ = … − 161.'],
], [4.2, 5.2]));
add(table(['PAL', 'Mô tả'], [
  ['1,2', 'Ít vận động — ngồi gần như cả ngày'],
  ['**1,3** (mặc định)', 'Nhẹ — việc văn phòng, đi lại ít'],
  ['1,4', 'Vừa — đứng / đi nhiều trong ngày'],
  ['1,5', 'Năng động — công việc di chuyển liên tục'],
  ['1,6', 'Lao động nặng — lao động tay chân'],
], [2.2, 7.2]));
add(P('Bạn cũng có thể gõ PAL tuỳ ý trong khoảng **1,1 đến 2,0**. PAL **không tính giờ tập**, vì calo tập được cộng riêng.'));
add(note('info', 'Ví dụ', ['Nam, 80 kg, 175 cm, 35 tuổi: BMR (Mifflin–St Jeor) = 10×80 + 6,25×175 − 5×35 + 5 = **1.723,75 kcal**. Nền = 1.723,75 × 1,3 = **2.240,9 kcal**. Chạy 10 km (không có file FIT) = 10 km × 80 kg × 1,0 = **800 kcal** ròng. Tổng ngày ≈ **3.041 kcal**.']));
add(P('Cân nặng và % mỡ lấy từ **lần đo gần nhất vào hoặc trước ngày đó** (không dùng số đo của tương lai); chưa có số đo nào thì dùng cân nặng trong hồ sơ. Tuổi tính tại ngày đó từ ngày sinh. Thiếu dữ liệu, ứng dụng **liệt kê ô còn thiếu** (chiều cao, ngày sinh, giới tính, cân nặng) thay vì đoán.'));
add(H2('10.3. Calo tập ròng của từng buổi'));
add(P('"Ròng" nghĩa là chỉ tính phần **tăng thêm** so với lúc nghỉ (đã trừ BMR theo thời gian tập) để không tính trùng với nền. Mỗi buổi dùng nguồn dữ liệu tốt nhất có được, theo thứ tự:'));
add(table(['Thứ tự', 'Nguồn', 'Ghi chú'], [
  ['1', 'Calo bạn **nhập tay** ở ô Calo của buổi', 'Trừ phần nghỉ trong thời gian tập.'],
  ['2', 'Calo trong **file FIT** của đồng hồ', 'Trừ phần nghỉ như trên.'],
  ['3', 'Buổi chạy: **1,0 kcal/kg/km**', 'Cần cân nặng và số km.'],
  ['4', 'Buổi fitness: **MET theo RPE**: (MET − 1) × cân nặng × giờ', 'RPE ≤ 4: MET 3,5 · RPE 5–6 hoặc để trống: 5 · RPE ≥ 7: 6.'],
], [1.4, 4.4, 3.6]));
add(bullet('Một ngày nhiều buổi thì **cộng lại**.'));
add(bullet('Buổi **kế hoạch chưa tập** chỉ là "dự kiến" (nhãn cam nhạt), **không** cộng vào tổng thực; buổi **bỏ** tính 0.'));
add(bullet('Số ước tính **chỉ để hiển thị** — ứng dụng **không bao giờ ghi** nó vào ô Calo của buổi tập. Ô Calo chỉ chứa số bạn nhập hoặc số từ file FIT.'));
add(H2('10.4. Cách sửa số calo'));
add(P('Có **ba mức sửa**, ưu tiên từ trên xuống: **ghi đè riêng một ngày** → **số kcal nền cố định** → **công thức tự tính**. Mỗi con số nền có nhãn nguồn: *tự tính*, *bạn đã sửa* hoặc *ghi đè ngày*.'));
add(H3('Mức 1. Sửa nền của một ngày'));
add(steps([
  'Bấm dòng 🔥 của ngày đó trong lịch.',
  'Ở mục **Sửa nền của ngày này** gõ số kcal nền (300–8.000) rồi bấm **Lưu cho ngày này**.',
  'Muốn quay lại: bấm **Về giá trị tự tính**. Ngày đã sửa được đánh dấu khác màu trên lịch và có viền xanh trên biểu đồ.',
]));
add(fig('71b_sua_nen_ngay', 'Gõ số kcal nền riêng cho ngày này (các nút Lưu và Về giá trị tự tính nằm ngay bên dưới)', { width: 520 }));
add(H3('Mức 2. Đổi cách tính nền cho mọi ngày (Hồ sơ › Năng lượng)'));
add(steps([
  'Mở **♥ Hồ sơ** và kéo xuống mục **Năng lượng — calo trong ngày**.',
  'Chọn **Cách tính calo nền**: **Tự tính: BMR × mức hoạt động (PAL)** hoặc **Số kcal cố định do tôi nhập** (rồi gõ số vào ô **Kcal nền cố định / ngày**).',
  'Với cách tự tính, có thể đổi **Công thức BMR** (tự chọn hoặc ép dùng Mifflin–St Jeor / Katch–McArdle) và **PAL**.',
  'Xem dòng **BMR hôm nay / Nền hôm nay** để kiểm tra trước khi bấm **Lưu hồ sơ**. Danh sách **Ngày đã ghi đè** cho phép bỏ từng ngày; nút **Về giá trị tự tính** xoá cài đặt mức 2.',
]));
add(fig('pf_nang_luong', 'Mục Năng lượng trong Hồ sơ: cách tính nền, công thức BMR, PAL và phần xem trước', { maxH: 480 }));
add(H3('Mức 3. Sửa số liệu đầu vào'));
add(P('Cách chính xác hơn là làm cho đầu vào đúng: nhập **số đo cơ thể** mới (cân nặng, % mỡ, BMR từ cân thông minh — chương 9), nhập **calo thực tế** của buổi tập (hoặc nhập file FIT), cập nhật **chiều cao, ngày sinh, giới tính** trong hồ sơ.'));
add(H2('10.5. Lưu ý khi dùng'));
add(bullet('Sai số calo thường **±10–15%**; calo nhập tay hoặc từ FIT cũng phụ thuộc thiết bị đo.'));
add(bullet('Nếu **ăn theo số calo** để giảm hoặc tăng cân, hãy dùng số này như một mốc tham khảo; theo dõi **xu hướng cân nặng** (chương 9) để điều chỉnh.'));
add(bullet('Mỗi người dùng có cài đặt calo **riêng**; hai người cùng chạy 10 km sẽ ra hai con số khác nhau vì cân nặng khác nhau.'));
add(bullet('Cài đặt calo được lưu trong file sao lưu; bản 2.2.0 trở xuống mở file vẫn **giữ nguyên** cài đặt này.'));
