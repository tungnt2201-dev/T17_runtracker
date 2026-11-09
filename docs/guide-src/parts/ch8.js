/* ---------- 8. Fitness ---------- */
add(H1('8. Fitness: thư viện, giao bài, nhập từ app mobile'));
add(P('Ngoài buổi chạy, T17 RunTracker quản lý **buổi tập fitness** (tập sức mạnh, bổ trợ, mobility). Một buổi fitness là danh sách bài tập, mỗi bài có các dòng set · số rep · thời gian · kg. Buổi fitness có thẻ riêng trong lịch (biểu tượng 🏋) và tính vào tải tập tuần. Dữ liệu trao đổi qua lại được với app mobile **T17 Run Training**.'));
add(note('info', 'Buổi fitness không ảnh hưởng dữ liệu chạy bộ', ['Số km, pace, điểm tải của các buổi chạy giữ nguyên như trước. File FIT của đồng hồ chạy bộ không bao giờ bị ghép nhầm vào buổi fitness.']));
add(H2('8.1. Thư viện Fitness'));
add(P('Bấm **📚 Thư viện** → tab **🏋 Fitness**. Thư viện gồm hai phần: **Mẫu buổi** (một buổi hoàn chỉnh, ví dụ "Run Basic 1": 6 bài, 45 phút) và **Bài tập** (từng bài riêng lẻ, 15 bài dựng sẵn lấy từ app mobile).'));
add(fig('50_thu_vien_fitness', 'Thư viện, tab Fitness: các mẫu buổi và danh sách bài tập', { maxH: 640 }));
add(table(['Nút', 'Chức năng'], [
  ['Ô **Tìm bài / mẫu buổi**', 'Lọc theo tên bài, nhóm cơ hoặc prescription.'],
  ['📅 **Giao bài…**', 'Đưa một mẫu buổi vào lịch nhiều ngày (mục 8.4).'],
  ['＋ **Mẫu buổi mới**', 'Tự soạn một buổi: tên, thời lượng, ghi chú, RPE dự kiến và danh sách bài.'],
  ['＋ **Bài tập mới**', 'Thêm một bài vào thư viện (mục 8.2).'],
  ['**Nhân bản**', 'Sao chép bài hoặc mẫu dựng sẵn để sửa theo ý bạn.'],
  ['**Ảnh / MET**', 'Gắn ảnh minh hoạ và hệ số MET cho bài dựng sẵn (nội dung gốc của bài dựng sẵn không sửa được).'],
], [3.2, 6.2]));
add(H2('8.2. Tạo và sửa bài tập'));
add(steps([
  'Bấm **＋ Bài tập mới** (hoặc **Nhân bản** một bài có sẵn).',
  'Nhập **Tên bài** (bắt buộc), **Nhóm cơ**, **Prescription** (mô tả ngắn, ví dụ "3 x 12 mỗi chân"), **Cách tập**, **Chú ý**.',
  'Tuỳ chọn: **MET** (1–15) để ước tính calo; **Chọn ảnh** — ứng dụng tự thu nhỏ và nén ảnh xuống khoảng 60 KB hoặc ít hơn.',
  'Sửa **dòng mẫu** (set, số rep, thời gian, kg) sẽ được điền sẵn khi đưa bài vào buổi, rồi bấm **Lưu bài tập**.',
]));
add(fig('51_sua_bai_tap', 'Hộp thoại tạo bài tập mới', { maxH: 560 }));
add(note('tip', 'Về ảnh', ['Ảnh được lưu ngay trong file dữ liệu. Nhiều ảnh làm file nặng lên; bản web chỉ có khoảng 5 MB bộ nhớ nên hãy để ảnh nhỏ, hoặc dùng bản exe (mục 14.7).']));
add(H2('8.3. Mẫu buổi'));
add(P('Mẫu buổi là "công thức" cho một buổi tập: danh sách bài kèm số set/rep, thời lượng dự kiến, ghi chú và **RPE dự kiến**. Bấm **＋ Mẫu buổi mới** hoặc **Nhân bản** một mẫu dựng sẵn, thêm bài bằng ô chọn ở cuối danh sách, kéo thứ tự bằng nút ↑ ↓ rồi **Lưu**. Mẫu của bạn nằm cùng danh sách với mẫu dựng sẵn (nhãn "Của bạn").'));
add(H2('8.4. Giao bài vào lịch'));
add(P('**Giao bài** tạo các buổi fitness *kế hoạch* vào những ngày bạn chọn.'));
add(steps([
  'Trong tab Fitness bấm **📅 Giao bài…** (hoặc **Giao bài** ngay trên thẻ mẫu).',
  'Chọn **Mẫu buổi**.',
  'Chọn cách đặt ngày: **Lặp theo thứ trong tuần** (tick các thứ, chọn ngày bắt đầu và số tuần) hoặc **Chọn từng ngày…** (chọn ngày trực tiếp trên lịch).',
  'Dòng gợi ý dưới ô ngày cho biết sẽ tạo bao nhiêu buổi (ví dụ "8 buổi: 10-11, 13-11…"). Bấm **Tiếp tục**.',
]));
add(fig('52_giao_bai', 'Giao mẫu "Run Basic 1" vào Thứ Ba và Thứ Sáu trong 4 tuần', { width: 480 }));
add(P('Buổi đang có sẵn không bị ghi đè; ngày đã có buổi cùng mẫu mà chưa tập sẽ được bỏ qua. Ứng dụng báo "Đã giao N buổi…" kèm số ngày bị bỏ qua.'));
add(H2('8.5. Thẻ fitness trong lịch'));
add(figRow([{ file: '53_the_fitness_ke_hoach', caption: 'Buổi đã giao nhưng chưa nhập kết quả' }, { file: '53b_the_fitness_da_tap', caption: 'Buổi đã tập: số bài xong, RPE, kcal' }], 430));
add(table(['Thành phần / nút', 'Ý nghĩa'], [
  ['Dải trên cùng thẻ', 'Số bài và thời lượng kế hoạch; chấm màu là **tải dự kiến** (xanh lá thấp, vàng vừa, đỏ cao).'],
  ['Danh sách bài (tối đa 6 dòng)', 'Tên bài và prescription. Khi đã tập, bài đã xong được đánh dấu ✓, bài bỏ qua đánh dấu ✗.'],
  ['✎', 'Sửa **riêng buổi này** (không đổi mẫu): đổi tên, thời lượng, thêm / bớt bài, đổi số set.'],
  ['⧉ · ⌫', 'Copy sang ngày khác · xoá buổi.'],
  ['📱', 'Xuất buổi cho app mobile (mục 8.8).'],
  ['Bấm vào thẻ', 'Mở hộp nhập kết quả (mục 8.6).'],
], [3, 6.4]));
add(P('Thẻ fitness cũng được kéo thả và copy giống thẻ bài chạy (giữ **Ctrl** để copy).'));
add(H2('8.6. Nhập kết quả buổi fitness'));
add(fig('54a_nhap_ket_qua_fitness', 'Hộp Kết quả buổi fitness (cắt phần đầu; các bài còn lại nằm bên dưới)', { maxH: 600 }));
add(steps([
  'Bấm vào thẻ fitness (hoặc ✎ để sửa kế hoạch buổi).',
  'Chọn **Trạng thái**: **Đã tập** hoặc **Không tập**.',
  'Tick ô **Xong** cho từng bài đã tập; nút **Tick tất cả** đánh dấu cả buổi. Sửa số set / rep / kg thực tế nếu khác kế hoạch, thêm bài bằng ô chọn ở cuối, đổi thứ tự bằng nút ↑ ↓.',
  'Nhập **Thời lượng (phút)**, **RPE (1–10)**, **Calo** và **Ghi chú buổi** nếu có.',
  'Bấm **Lưu kết quả**. Nút **Xoá kết quả** đưa buổi về trạng thái chưa tập.',
]));
add(note('info', 'Điểm tải của buổi fitness', ['Tải = **RPE × phút ÷ 4,8** (RPE 8 trong 60 phút ≈ 100 điểm, ngang 60 phút chạy đúng ngưỡng). Chưa nhập RPE thì dùng RPE mặc định 5. Buổi fitness cộng vào tải tuần và biểu đồ Thể lực · Mệt mỏi.']));
add(H2('8.7. Nhập buổi tập từ app mobile'));
add(P('App mobile **T17 Run Training** xuất buổi tập thành file JSON, ZIP hoặc Excel. Bạn không cần chọn nút riêng: **mọi nút nhập file** của ứng dụng đều tự nhận ra file của app fitness — **Nhập bài tập / Training Log**, **Import FIT**, **Import Excel**, **Khôi phục**.'));
add(steps([
  'Chép file từ điện thoại sang máy tính (cáp, Zalo, email…).',
  'Bấm **Dữ liệu ▾ → ⇧ Nhập bài tập / Training Log** và chọn file (cũng nhận file `.zip` và file Excel 4 sheet `Session`, `Workout Log`, `Guide`, `Library`).',
  'Hộp **Nhập buổi tập từ app fitness** hiện bản xem trước; chưa có gì được ghi.',
  'Kiểm tra từng buổi, chọn cách xử lý ở ô thả xuống, rồi bấm **Nhập vào lịch**.',
]));
add(fig('55_import_mobile_xem_truoc', 'Xem trước khi nhập: buổi được gắn vào buổi đã giao theo mã buổi', { maxH: 420 }));
add(table(['Trạng thái', 'Ý nghĩa và các lựa chọn'], [
  ['Gắn vào buổi đã giao', 'Cùng ngày đã có buổi kế hoạch khớp (theo mã buổi, rồi mẫu buổi, rồi tên): kết quả được điền vào buổi đó.'],
  ['Buổi mới', 'Không có buổi kế hoạch khớp: tạo thêm buổi mới vào ngày tập.'],
  ['Đã có / Đã có — nội dung khác', 'File đã nhập trước đó. Nhập lại cùng file không nhân đôi; nếu nội dung khác thì bạn chọn bỏ qua hoặc ghi đè.'],
], [3.4, 6]));
add(bullet('**Người nhận:** dòng đầu hộp ghi rõ tên người dùng sẽ nhận dữ liệu; chỉ lịch của người này bị thay đổi.'));
add(bullet('**Nhận diện bài tập:** bài trùng mã hoặc trùng tên trong thư viện được nối vào; bài giống nhau từ 85% trở lên được **gợi ý** để bạn chọn; bài hoàn toàn mới được thêm vào thư viện và gắn nhãn **Chưa xác nhận** (bấm **Xác nhận** trong Thư viện › Fitness khi đã kiểm tra).'));
add(bullet('**Ngày:** thời điểm có múi giờ trong file được đổi sang giờ của máy, không lệch một ngày.'));
add(bullet('**Tự sao lưu:** bản exe lưu `data\\backups\\<người dùng>-truoc-nhap-fitness-<ngày giờ>.json` trước khi gộp (giữ 10 bản gần nhất); bản web giữ một bản trong trình duyệt.'));
add(bullet('File không đọc được được liệt kê riêng với lý do; các file còn lại vẫn nhập bình thường.'));
add(H2('8.8. Xuất buổi cho app mobile'));
add(P('Bấm nút **📱** trên thẻ fitness.'));
add(fig('56_xuat_mobile', 'Chọn xuất một buổi hoặc nhiều buổi', { width: 440 }));
add(bullet('**Chỉ buổi này:** một file `.json`.'));
add(bullet('**Nhiều buổi trong khoảng ngày…:** một file `.zip`, mỗi buổi một file `YYYY-MM-DD_tên-buổi.json`.'));
add(P('Trên điện thoại: mở app → **Nhập file** → chọn file. Buổi sau khi tập xong trên điện thoại có thể xuất ngược lại và nhập vào T17 như mục 8.7; mã buổi được giữ nguyên nên kết quả gắn đúng buổi đã giao.'));
add(note('warn', 'Thư viện bài trên điện thoại sẽ bị thay', ['App mobile thay thư viện bài của nó bằng thư viện nằm trong file bạn nhập. Nếu trên điện thoại bạn có bài tự thêm mà trong T17 chưa có, hãy xuất và nhập chúng sang T17 trước.']));
add(H2('8.9. Excel, sao lưu và bản cũ'));
add(bullet('Buổi fitness được xuất trong **Export Excel** và đọc lại bằng **Import Excel** cùng với lịch chạy.'));
add(bullet('File sao lưu và file xuất của bản mới **vẫn mở được bằng bản 2.2.0 và các bản cũ hơn**; dữ liệu chạy bộ không đổi. Bản cũ thấy buổi fitness như một bài thường (tên, thời lượng, mô tả tóm tắt) và không có ảnh / hướng dẫn chi tiết của bài. Các bản này không làm mất dữ liệu fitness khi bạn sao lưu rồi mở lại bằng bản mới.'));
