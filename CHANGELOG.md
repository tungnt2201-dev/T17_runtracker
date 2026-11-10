# Changelog

## 2.6.1 — 2026-11-10 (Ghép hoạt động đã tập vào buổi fitness kế hoạch)

Gói: `261110_T17_runtracker_v2.6.1.zip`. Định dạng dữ liệu không đổi (dùng lại `actual` + `actual.fitness` + `actual.fitImport` sẵn có).

- Sửa: kéo **thẻ FIT đã tập chưa ghép** (thẻ tím) vào **thẻ buổi fitness kế hoạch** trước đây không được (chỉ ghép được vào bài chạy). Nay thẻ fitness được tô viền khi kéo qua và nhận ghép: giữ số liệu đo (phút, calo, HR, dữ liệu FIT), bài trong buổi lấy theo kế hoạch và đánh dấu đã tập hết — bấm thẻ để bỏ tick bài chưa tập. Buổi đã có kết quả sẽ hỏi trước khi ghi đè.
- Nút “Ghép vào bài KH” trên thẻ FIT và hộp chọn khi thả vào khung ngày cũng liệt kê buổi fitness (có biểu tượng 🏋).
- Nhập FIT hàng loạt vẫn KHÔNG tự ghép vào buổi fitness (tránh ghép nhầm buổi chạy vào buổi gym) — ghép bằng kéo thả.
- Lõi: `T17Fitness.actualFromActivity()`. Test: +1 lõi, +1 giao diện; đã thử kéo thả thật bằng Chromium.

## 2.6.0 — 2026-11-10 (Thêm bài fitness ngay ở khung ngày + kéo thả bài tự do)

Gói: `261110_T17_runtracker_v2.6.0.zip`. **Định dạng dữ liệu KHÔNG đổi** (không thêm field; chỉ dùng lại khối `fitness` hiện có) — file mới vẫn nạp được bằng v2.2.0.

- Khung ngày có nút **🏋 Fitness** (cả ngày trống lẫn dưới các thẻ có sẵn, cạnh “＋ Tạo thêm” / “📚 Từ thư viện”): chọn **Buổi trống** (mở trình sửa để thêm bài) hoặc một **mẫu buổi** (dựng sẵn / của bạn) → giao đúng ngày đó.
- **Kéo thả bài tự do**: Thư viện → tab Fitness → kéo một thẻ bài tập thả vào (a) thẻ buổi fitness chưa tập → thêm bài vào cuối buổi; (b) khung ngày → 1 buổi chưa tập thì thêm vào đó, nhiều buổi thì hỏi chọn, chưa có buổi thì tự tạo buổi mới chứa bài đó. Buổi đã có kết quả không nhận thêm bài (báo rõ). Cửa sổ Thư viện tự mờ/xuyên thấu khi đang kéo để thả được xuống lịch phía sau.
- Lõi: `T17Fitness.blankPlan()`, `T17Fitness.addExerciseToPlan()` (giữ `sessionId`, đánh lại `instanceId` dạng `<sessionId>:<k>`). Test: +3 lõi, +4 giao diện (jsdom). Đã thử kéo thả thật bằng Chromium.
- **Chưa làm**: ảnh/chương 8 trong Hướng dẫn Word chưa chụp lại cho nút mới; chưa thử trên Windows thật.

## 2.5.2 — 2026-11-09 (Hướng dẫn sử dụng cho bản mới — lượt 8)

Gói: `261109_T17_runtracker_v2.5.2.zip`. **Không đổi mã ứng dụng, không đổi định dạng dữ liệu** — chỉ cập nhật tài liệu đi kèm gói.

- **Hướng dẫn sử dụng (Word)** `docs/Huong_dan_su_dung_T17_RunTracker.docx` viết lại cho bản 2.5, 59 trang, 52 hình chụp từ **dữ liệu mẫu hư cấu** (không dùng dữ liệu thật); mục lục cập nhật.
- Chương mới: **7. Nhiều người dùng và hồ sơ cá nhân**; **8. Fitness** (thư viện, giao bài, nhập kết quả, nhập / xuất app mobile); **9. Chỉ số cơ thể** (nhập, CSV, so sánh, biểu đồ); **10. Calo trong ngày** (công thức, cách sửa); **15. Giới hạn và điều cần lưu ý**.
- Cập nhật chương cũ: giới thiệu, thư mục dữ liệu, giao diện, Analytics (tab Cơ thể, biểu đồ calo), quản lý dữ liệu (bản dự phòng, cảnh báo dung lượng bản web), câu hỏi thường gặp, thuật ngữ. Toàn bộ ảnh cũ chụp lại trên bản 2.5.
- Ghi rõ giới hạn: calo ước tính sai số khoảng ±10–15%; các tính năng mới **chưa được chạy thử trên Windows thật** (chỉ trên exe Linux); bản web ~5 MB.

## 2.5.1 — 2026-11-09 (Rà soát tương thích, hiệu năng, chất lượng — lượt 7)

Gói: `261109_T17_runtracker_v2.5.1.zip`. Không thêm tính năng; dữ liệu và kết quả chạy bộ không đổi.

**Kiểm chứng mới** (chạy lại được):
- `npm run compat` — ma trận tương thích thật giữa RunPlan v1.8.9, T17 v2.0.0, v2.1.1, v2.2.0 và bản hiện tại (git worktree, chạy bản web trong jsdom): sao lưu JSON, Xuất bài tập JSON, Excel. 75/75 ô đạt — xem `docs/COMPAT_MATRIX.md`.
- `tests/fuzz.test.js`, `tests/fuzz-ui.test.js` — fuzz các đường nhập (file hỏng, thiếu trường, số dạng chữ, ngày sai, phần tử null, ảnh base64 hỏng, file rất lớn).
- `npm run perf` — dữ liệu 3 năm (~1.000 buổi, 500 lần đo cơ thể, 100 ảnh); `npm run e2e:exe` — chạy thật bản Neutralino (Linux) với kịch bản chuyển người dùng, nhập fitness, nhập chỉ số cơ thể, sao lưu, khôi phục.

**Sửa lỗi**
- **Bảo mật**: ảnh bài tập (`imageData`) trong file sao lưu / file app mobile được chèn thẳng vào thuộc tính `src` → một file có chủ đích xấu có thể chạy mã trong app. Nay chỉ nhận ảnh data URL png/jpeg/gif/webp base64 hợp lệ (ở lớp chuẩn hoá) và luôn escape khi hiển thị.
- Lịch / điểm tải / Analytics / xuất FIT không còn văng lỗi khi cấu trúc bài (`workoutStructure`) có phần tử null hoặc sai kiểu.
- Nhập file app mobile: ngày không có thật (vd. 2026-13-45, 30/02) bị bỏ qua thay vì làm hỏng lịch; sheet Excel thiếu / sai dạng không còn văng lỗi.
- Calo: số đo cơ thể ngoài khoảng hợp lý (cân 20–300 kg, % mỡ 2–70, BMR 500–5.000) bị bỏ qua thay vì ra kết quả vô hạn.
- Khôi phục sao lưu: cảnh báo rõ khi file không có bài nào trong khi lịch đang có dữ liệu; luôn giữ một bản dự phòng (`…-truoc-khoi-phuc-…`) trước khi ghi đè.
- File nhập trên 60 MB (ảnh trên 30 MB) bị chặn trước khi đọc, có thông báo — tránh treo.
- Bản web: khi bộ nhớ trình duyệt đầy, tự bỏ các bản dự phòng tự động trong trình duyệt rồi lưu lại; nếu vẫn không lưu được thì báo rõ “thay đổi CHƯA được lưu”.

**Hiệu năng / bộ nhớ**
- Calo nhiều ngày dùng chỉ mục (ngày → bài, số đo đã sắp xếp): Analytics › Tất cả với dữ liệu 3 năm từ ~2,5 s xuống ~0,7 s (jsdom) / 0,3 s (exe).
- Bản web cảnh báo khi localStorage dùng từ 4 / 5 MB (Chromium, Edge, WebView2 cho mỗi trang ~5,24 triệu ký tự), nêu phần chiếm chỗ (ảnh bài tập, dữ liệu chi tiết FIT, bản dự phòng) và gợi ý dùng bản exe hoặc nén / xoá ảnh.

## 2.5.0 — 2026-11-09 (Calo trong ngày)

Gói: `261109_T17_runtracker_v2.5.0.zip`. Dữ liệu cũ nạp nguyên vẹn, kết quả chạy bộ không đổi. File của 2.5 vẫn mở được bằng 2.2.0 – 2.4.0 (cài đặt calo `profile.energy` được giữ nguyên, có test với mã nguyên văn của 2.2.0).

Tất cả là **ước tính theo công thức, sai số thường ±10–15%, không phải tư vấn dinh dưỡng hay y tế** (ghi rõ ở mọi chỗ hiển thị).

- **Calo ngày = nền (hoạt động bình thường) + calo tập (ròng)**, tính riêng cho từng người dùng.
- **BMR**: BMR đo bằng cân (chỉ số cơ thể) → Katch–McArdle (khi có % mỡ) → Mifflin–St Jeor (cân nặng, chiều cao, tuổi từ ngày sinh, giới tính). Cân nặng / % mỡ lấy lần đo gần nhất **vào hoặc trước** ngày đó, không dùng số đo về sau; chưa có số đo thì dùng cân nặng trong Hồ sơ. Thiếu dữ liệu thì báo ô còn thiếu, không đoán.
- **Nền = BMR × PAL** (bảng 1,2–1,6, mặc định 1,3, hoặc tự nhập 1,1–2,0). Ba mức sửa, ưu tiên từ trên xuống: **ghi đè từng ngày** → **số kcal cố định** → công thức. Mỗi con số có nhãn nguồn *tự tính / bạn đã sửa / ghi đè ngày*; nút **Về giá trị tự tính**.
- **Calo tập ròng** mỗi buổi (chạy bộ và fitness, nhiều buổi trong ngày thì cộng): calo nhập tay → calo trong file FIT → chạy 1,0 kcal/kg/km → fitness theo MET từ RPE (≤4: 3,5 · 5–6 hoặc trống: 5 · ≥7: 6). Calo nhập tay / FIT được trừ phần nghỉ (BMR theo thời gian tập) để không tính trùng với nền. Bài kế hoạch chưa tập chỉ hiện **dự kiến**, không cộng vào tổng thực; bài bỏ = 0.
- **Lịch**: dòng 🔥 kcal ở đầu mỗi ngày; bấm vào để xem **chi tiết ngày** (BMR, nền, từng buổi và cách tính) và **sửa nền của ngày đó tại chỗ**.
- **Tổng quan tuần**: thẻ *Calo ngày* — mỗi ngày một dòng nền + tập = tổng, thanh cột chồng, trung bình mỗi ngày.
- **Hồ sơ › Năng lượng**: cách tính nền, công thức BMR, PAL, số cố định, danh sách ngày đã ghi đè (bỏ từng ngày), xem trước BMR và nền hôm nay.
- **Analytics › Tập luyện**: biểu đồ cột chồng calo (nền dưới, tập trên) kèm đường trung bình; 8 tuần vẽ theo ngày (bấm cột mở chi tiết ngày), dài hơn vẽ trung bình mỗi ngày theo tuần. Hiện cả khi chưa có buổi chạy nào.
- Số ước tính **không bao giờ** được ghi vào `actual.calories` (số đo thật giữ sạch). Người dùng chưa thiết lập: tự tính nếu đủ dữ liệu, file không thêm trường nào cho tới khi lưu cài đặt.

## 2.4.0 — 2026-11-09 (Chỉ số cơ thể)

Gói: `261109_T17_runtracker_v2.4.0.zip`. Không đổi định dạng dữ liệu so với lượt 4; file của 2.4 vẫn mở được bằng 2.2.0 / 2.3.0 (số đo cơ thể được giữ nguyên).

### Analytics › tab con “Cơ thể” (lượt 5)
- Nút **Tập luyện / Cơ thể** cạnh bộ chọn khoảng (8 tuần / 12 tuần / 6 tháng / 12 tháng / tất cả).
- Biểu đồ đường theo **trục thời gian thật** (số đo không đều ngày): cân nặng, % mỡ, khối cơ, vòng eo, nhịp tim nghỉ. Điểm = trung bình các lần đo trong ngày, đường = trung bình 7 ngày, vạch đứt = cân nặng mục tiêu, vòng cam = lần đo có ghi chú. Rê chuột xem giá trị, số lần đo và ghi chú.
- **Tiêu đề là kết luận có số**, ví dụ “Giảm 1,8 kg trong 8 tuần”, “% mỡ: giảm 1,2 điểm % trong 10 tuần”, “Vòng eo: ổn định quanh 82,3 cm…”, kèm chấm màu theo ý nghĩa.
- **Tải tập theo tuần (chạy + fitness)** vẽ ngay dưới cân nặng, cùng trục thời gian.
- **So sánh hai mốc A → B**: chọn hai ngày; bảng cạnh nhau, cột thay đổi có màu theo ý nghĩa; phím tắt *Lần đầu ↔ mới nhất*, *30 ngày trước ↔ mới nhất*. Mỗi chỉ số lấy lần đo gần ngày chọn nhất và ghi rõ ngày đo thực tế nếu khác.
- Dưới 2 lần đo: hiện hướng dẫn và nút nhập số đo thay vì biểu đồ trống. Biểu đồ co giãn theo khung; cửa sổ ≤ 1200 px chuyển một cột mà chữ không bị phóng to.

### Lượt 4 — dữ liệu, nhập, so sánh

- **Nút 📏 Chỉ số cơ thể** (thanh trái và menu người dùng): thẻ tóm tắt cho từng chỉ số có dữ liệu — giá trị mới nhất, so với **lần trước / 30 ngày / lần đầu** (mũi tên, số tuyệt đối và %). Màu theo **ý nghĩa**: % mỡ, vòng eo, mỡ nội tạng, nhịp tim nghỉ giảm là tốt; khối cơ, khối nạc, % nước tăng là tốt; cân nặng trung tính, trừ khi đặt **Cân nặng mục tiêu** trong Hồ sơ (gần mục tiêu hơn là tốt).
- **Nhập tại một thời điểm**: ngày giờ mặc định là bây giờ, mọi ô tuỳ chọn (cân nặng, % mỡ, khối cơ, % nước, mỡ nội tạng, khối xương, BMR, vòng eo / hông / ngực / đùi / bắp tay, nhịp tim nghỉ, ghi chú); số thập phân dùng dấu phẩy hoặc chấm; đo nhiều lần trong ngày được. Đang gõ đã thấy “so với lần trước” và BMI (theo chiều cao trong Hồ sơ), khối nạc FFM, tỉ lệ eo/hông. Số ngoài khoảng thường gặp chỉ cảnh báo, không chặn.
- So sánh **theo từng chỉ số**: mốc là lần gần nhất có đúng chỉ số đó (cân thông minh và thước dây thường đo khác ngày). Mốc 30 ngày lấy lần đo trong ±3 ngày; không có thì dùng lần gần nhất và ghi rõ lệch bao nhiêu ngày. Xu hướng cân nặng: trung bình 7 ngày và độ dốc kg/tuần (28 ngày gần nhất).
- **Bảng lịch sử**: sửa, xoá, lọc theo khoảng ngày.
- **Đồng bộ cân nặng**: lưu cân nặng mới nhất thì hỏi có cập nhật cân nặng trong Hồ sơ không; chọn “luôn” hoặc “không bao giờ” thì app nhớ.
- **CSV**: nhập từ cân thông minh — cột tiếng Anh hoặc tiếng Việt tự nhận, số `1,5` và `1.5`, ngày `dd/mm/yyyy`, `yyyy-mm-dd`, có giờ hoặc không; xuất CSV cho Excel tiếng Việt. Gộp không nhân đôi (khoá ngày + giờ; trùng khoá thì chỉ điền ô còn thiếu, giữ giá trị đang có).
- **Excel**: xuất có thêm sheet `Body` (sheet đầu vẫn là lịch, bản cũ đọc như trước); *Import Excel* đọc lại sheet này; Excel cũ không có sheet `Body` nạp bình thường.
- Số đo nằm trong file sao lưu (`bodyMetrics`) và riêng cho từng người dùng.

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
