# Ma trận tương thích (2026-11-09 14:24)

Hàng = phiên bản GHI file sao lưu, cột = phiên bản ĐỌC. ✓ đạt · ✓* đạt, có ghi chú · ✗ không đạt.

| ghi \ đọc | v1.8.9 | v2.0.0 | v2.1.1 | v2.2.0 | hiện tại |
|---|:-:|:-:|:-:|:-:|:-:|
| **v1.8.9** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **v2.0.0** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **v2.1.1** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **v2.2.0** | ✓ | ✓ | ✓ | ✓ | ✓ |
| **hiện tại** | ✓ | ✓ | ✓ | ✓ | ✓ |

### Xuất bài tập (JSON) → nhập vào kho trống

| xuất \ nhập | v1.8.9 | v2.0.0 | v2.1.1 | v2.2.0 | hiện tại |
|---|:-:|:-:|:-:|:-:|:-:|
| **v1.8.9** | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 |
| **v2.0.0** | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 |
| **v2.1.1** | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 |
| **v2.2.0** | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 |
| **hiện tại** | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 | ✓ 6 |

### Excel → nhập vào kho trống

| xuất \ nhập | v1.8.9 | v2.0.0 | v2.1.1 | v2.2.0 | hiện tại |
|---|:-:|:-:|:-:|:-:|:-:|
| **v1.8.9** | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 | ✓ 3 |
| **v2.0.0** | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 |
| **v2.1.1** | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 |
| **v2.2.0** | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 | ✓ 4 |
| **hiện tại** | ✓* 6 | ✓* 6 | ✓* 6 | ✓* 6 | ✓ 6 |

Số trong ô = số bài nhập được. So sánh với chính phiên bản xuất nhập lại file của mình.

## Ghi chú từng ô

- **xlsx: hiện tại → v1.8.9** ✓*: bài fitness nhập thành bài thường (định dạng đời cũ không có loại bài); dữ liệu chạy bộ khớp
- **xlsx: hiện tại → v2.0.0** ✓*: bài fitness nhập thành bài thường (định dạng đời cũ không có loại bài); dữ liệu chạy bộ khớp
- **xlsx: hiện tại → v2.1.1** ✓*: bài fitness nhập thành bài thường (định dạng đời cũ không có loại bài); dữ liệu chạy bộ khớp
- **xlsx: hiện tại → v2.2.0** ✓*: bài fitness nhập thành bài thường (định dạng đời cũ không có loại bài); dữ liệu chạy bộ khớp

Dữ liệu ghi: v1.8.9/v2.0.0 = `runplan-v189-backup.json`; v2.1.1 = như trên + hồ sơ VĐV; v2.2.0 = `t17-v22-multiuser`; hiện tại = `t17-v25-full.json` (chạy bộ + fitness + thư viện ảnh + chỉ số cơ thể + cài đặt calo).

> v2.0.0 không có tag trên GitHub → dùng commit phát hành `717ba8f`. Tiêu chí: bản cũ đọc file mới không lỗi, không mất dữ liệu chạy bộ (v2.2.0: không mất trường nào, kể cả khứ hồi về bản hiện tại); bản mới đọc file cũ cho dữ liệu chạy bộ bằng đúng cách bản cũ tự đọc. Riêng Excel: định dạng Excel đời cũ không có hàng “loại bài” nên bản < v2.3 thấy bài fitness như bài thường (tên, thời lượng, mô tả vẫn đủ).

## Hiệu năng — dữ liệu 3 năm (`npm run perf`, `npm run e2e:exe perf`)

Bộ dữ liệu: 780 buổi chạy (≈500 có FIT), 234 buổi fitness, 498 lần đo cơ thể, 100 ảnh bài tập ≈25 KB. JSON 18,6 MB, trong đó dữ liệu chi tiết FIT ≈ 77%, ảnh ≈ 18%.

| Thao tác | exe Neutralino (Linux, WebKitGTK) | jsdom |
|---|--:|--:|
| Khởi động tới khi vẽ xong lịch | 1,5 s | 3,5 s |
| Vẽ lại lịch | 28 ms | 0,26 s |
| Lưu (ghi file 18,6 MB ra đĩa) | 1,4 s (chạy nền, không khoá giao diện trừ ~0,15 s tạo JSON) | 0,36 s |
| Analytics › Tập luyện 12 tuần / tất cả | 66 ms / 0,30 s | 0,10 / 0,70 s |
| Analytics › Cơ thể (tất cả) | 0,26 s | 0,16 s |

Bản web (Chromium) với dữ liệu vừa localStorage (không có FIT, 100 ảnh, 4,6 triệu ký tự): khởi động 0,75 s, vẽ lịch 0,19 s, Analytics ≤ 0,18 s; cảnh báo “Bộ nhớ trình duyệt sắp đầy: 4,6 / 5,0 MB … ảnh bài tập chiếm 3,4 MB” hiện đúng. Dữ liệu 3 năm có FIT (18,6 MB) **không thể** nằm trong localStorage (~5 MB) → cần bản exe.

## E2E bản exe (`npm run e2e:exe`)

Dữ liệu v2.2.0 hai người dùng → mở đúng người đang chọn → tạo + chuyển người dùng mới → nhập buổi fitness (file app mobile v3, qua hộp xem trước) → nhập 5 lần đo cơ thể (CSV) → tính calo → file riêng của người dùng trên đĩa → sao lưu JSON → về người dùng chính (không lẫn dữ liệu) → khôi phục (có bản dự phòng `…-truoc-khoi-phuc-…`) → file trên đĩa đúng → chuyển qua lại. 12/12 bước đạt (Linux x64 + WebKitGTK 2.52 dưới Xvfb; hộp thoại Lưu của hệ điều hành được thay bằng đường dẫn cố định).
