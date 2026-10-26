# Định dạng dữ liệu & tương thích ngược

Toàn bộ logic nằm ở `src/core/legacy.js` và được kiểm thử bằng các file mẫu trong `tests/fixtures/`.

## Schema hiện tại (v2)

```jsonc
{
  "app": "T17_runtracker",
  "schemaVersion": 2,
  "weeks": [                       // luôn bắt đầu thứ Hai, đủ 7 ngày, sắp theo ngày
    { "label": "42",
      "days": [ { "dow": "Hai", "date": "2026-10-12",
                  "workouts": [ { "id": "w…", "workoutName": "", "workoutType": "Tempo",
                                  "planKm": 7.2, "planMinutes": 45, "description": "", "planNote": "",
                                  "workoutStructure": { "warmup": {}, "groups": [], "cooldown": {} },
                                  "fitStandalone": true,          // chỉ có ở thẻ FIT tím chưa ghép
                                  "actual": { "status": "done|missed", "km": 7.3, "minutes": 44.5,
                                              "fatigue": 6, "calories": 480, "avgHr": 158, "note": "",
                                              "segments": [], "fitImport": { } } } ] } ] } ],
  "templates": [ { "id": "tpl…", "name": "…" } ],
  "templatesSeeded": true,
  "profile": { "sex": "male", "hrRest": 50, "hrMax": 190, "lthr": 170,   // v2.1 — hồ sơ VĐV (tuỳ chọn)
               "thresholdPace": "5:15", "weightKg": "", "updatedAt": "…",
               // v2.2 — thông tin cá nhân (tất cả tuỳ chọn, chuỗi): fullName, nickname, birthDate "YYYY-MM-DD",
               // heightCm, email, phone, city, club, goal, emergencyName, emergencyPhone, notes
             },
  "orphans": [ ]                   // bài trong file cũ không có ngày hợp lệ: giữ lại, không xoá
}
```

Khác với v1.8.9 chỉ ở chỗ **thêm** `app`, `schemaVersion`, `orphans`, `profile` (v2.1). Mọi field cũ giữ nguyên tên và ý nghĩa,
nên RunPlan v1.8.x đọc được file sao lưu của T17.

## Các định dạng đầu vào được nhận

| Loại | Nhận diện | Xử lý |
|---|---|---|
| Sao lưu RunPlan v1.x / T17 | có mảng `weeks` | Chuẩn hoá toàn bộ, **ghi đè** (có hỏi lại, kèm thống kê nội dung file) |
| RunPlan đời đầu | `day` có `workoutName/planKm/actual` trực tiếp, không có `workouts[]` | Chuyển thành `workouts[0]` |
| Xuất bài tập | `format: "runplan-plan"` | Gộp thêm, không lấy kết quả, bỏ qua bài trùng |
| Training Log | `format: "runplan-log"` | Gộp thêm **kèm kết quả**; nếu đã có bài kế hoạch trùng mà chưa có kết quả thì gắn kết quả vào |
| Mảng tuần trần | `[ {label, days} ]` | Như sao lưu |
| Bọc trong `data` | `{ data: { weeks } }` | Như sao lưu |
| localStorage dump | chuỗi JSON bị stringify 2 lần, có BOM | Tự gỡ |

## Chuẩn hoá khi đọc

- Ngày `dd/mm/yyyy`, `yyyy/m/d` hoặc số serial Excel → `yyyy-mm-dd`.
- Số dạng `"10,5"` → `10.5`; thời gian `"66:30"`, `"1:06:30"`, `66'30"` → phút.
- Tuần nhập từ Excel bắt đầu giữa tuần → căn lại theo thứ Hai. Nhãn tuần lấy theo nhãn chiếm đa số ngày.
- Cùng một ngày xuất hiện ở hai tuần → gộp bài, không mất.
- `id` thiếu hoặc trùng → cấp `id` mới (ghép FIT và sửa bài dựa vào `id`).
- `actual` thiếu `status` → coi là `done` (giống v1.8.9).
- Mô tả bị lặp `Warm-up: Warm-up:` → làm sạch.
- Field lạ ở cấp cao nhất được giữ nguyên, để không làm mất dữ liệu của phiên bản mới hơn.

Chuẩn hoá có tính **idempotent**: chạy nhiều lần cho cùng một kết quả (có test).

## Excel

Xuất Excel giờ ghi **đủ mọi bài trong ngày**: bài thứ 2 trở đi nằm trong khối `Tuần N - bài k`.
Import Excel (cả RunPlan cũ lẫn T17) đọc lại được các khối này.

## Nhiều người dùng (v2.2)

Mỗi người dùng có **một file dữ liệu riêng** đúng định dạng ở trên. Danh sách người dùng nằm ở file chỉ mục:

```jsonc
// data/users.json  (web: localStorage "t17-users-v1")
{ "app": "T17 RunTracker", "usersVersion": 1, "activeUserId": "main",
  "users": [ { "id": "main", "name": "Tôi", "createdAt": "…" }, { "id": "umvokt5ubf98", "name": "Lan", "createdAt": "…" } ] }
```

| Người dùng | File (exe) | Khoá (web) | Sao lưu tự động |
|---|---|---|---|
| `main` (dữ liệu đời cũ) | `data/t17-runtracker.json` | `runplan-tracker-v1` | `data/backups/t17-runtracker-YYYY-MM-DD.json` |
| khác | `data/users/<id>.json` | `runplan-tracker-v1:<id>` | `data/backups/<id>-YYYY-MM-DD.json` |

Xoá người dùng (exe) chuyển file vào `data/deleted/<id>-<thời gian>.json`. Sao lưu / khôi phục / Excel / JSON chia sẻ luôn thao tác trên người dùng đang chọn.
