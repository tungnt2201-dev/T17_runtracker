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

## Phần mở rộng Fitness (từ v2.3, lượt 1 — chỉ lớp dữ liệu)

Mọi trường dưới đây **cộng thêm và tuỳ chọn**. File chỉ có chạy bộ **không** bị thêm trường nào (có test).
Logic: `src/core/fitness.js` (`T17Fitness`), chuẩn hoá trong `src/core/legacy.js`.

```jsonc
{
  "features": { "fitness": 1 },        // chỉ có khi dữ liệu có fitness; giữ nguyên khoá lạ của phiên bản sau
  "fitnessLibrary": [                  // thư viện bài của NGƯỜI DÙNG NÀY (chỉ có khi đã dùng fitness)
    { "id": "good-morning", "builtin": true, "name": "…", "category": "…", "plan": "…", "cue": "…", "caution": "…",
      "imageData": "", "imageName": "", "defaultRows": [ { "set": "1", "group": "", "reps": "10", "time": "", "weight": "", "note": "" } ],
      "met": 5.0 }                     // met: tuỳ chọn
  ],
  "weeks": [ { "days": [ { "workouts": [ {
    "id": "w…", "workoutName": "Run Basic 1", "workoutType": "Fitness", "planKm": "", "planMinutes": 48,
    "description": "Fitness · 7 bài (6 xong) · 13 set · 2366 kg tổng\n• ✓ Good Morning with Barbell — 2 set × 10–12 · 20–30 kg\n…",
    "planNote": "…", "workoutStructure": null,
    "fitness": {                       // KẾ HOẠCH của buổi (không có done)
      "schema": 1, "sessionId": "fs-…", "templateId": "run-basic-1", "workoutNote": "…",
      "exercises": [ { "instanceId": "ex-…", "libraryId": "good-morning", "name": "…", "category": "…", "plan": "…",
                       "rows": [ { "set": "1", "group": "", "reps": "12", "time": "", "weight": "20", "note": "" } ] } ] },
    "actual": { "status": "done", "km": "", "minutes": 48, "fatigue": 7, "calories": 260, "note": "…", "segments": [],
      "source": "fitness-mobile",
      "fitness": {                     // THỰC TẾ: như trên + done từng bài + contentHash
        "schema": 1, "sessionId": "fs-…", "contentHash": "f651cea0",
        "exercises": [ { "instanceId": "ex-…", "libraryId": "…", "name": "…", "done": true, "rows": [ ] } ] } }
  } ] } ] } ]
}
```

- `description` luôn là **bản tóm tắt chữ** (`summaryText`) để RunPlan v1.8.9 / T17 v2.0–2.2 hiển thị được nội dung buổi.
- Hướng dẫn (`cue`, `caution`) và ảnh chỉ nằm trong `fitnessLibrary`; buổi tập tham chiếu bằng `libraryId` để file nhỏ.
- Bài dựng sẵn (15 bài, 2 mẫu buổi `run-basic-1`, `knee-support-1`) trích nguyên văn từ app mobile; nội dung lấy theo mã,
  chỉ giữ ảnh/MET người dùng gắn thêm. Bài tự tạo giữ nguyên cả field lạ.
- `sessionId` sinh mới khi copy bài sang ngày khác hoặc thêm từ mẫu; giữ nguyên khi xuất/nhập (dùng ghép kết quả ở lượt 3).
- `contentHash` (FNV-1a 32 bit) tính từ ngày, tên buổi, bài (`libraryId`/tên), `done`, các dòng — **không** phụ thuộc
  `instanceId`/`sessionId`, dùng chống trùng khi nhập lại file của app mobile (file đó không có mã buổi).
- Gộp Xuất bài tập / Training Log: bài fitness chỉ coi là trùng khi cả tóm tắt lẫn danh sách bài trùng; hai buổi fitness
  cùng ngày, cùng thời lượng nhưng khác nội dung **không** bị bỏ (trước đây so km/phút sẽ gộp nhầm).

### Vì sao giữ `schemaVersion = 2` và thêm `features`

Đã thử bằng `git worktree` của tag `v2.2.0` (chạy cả lõi lẫn app hoàn chỉnh trong jsdom) và RunPlan v1.8.9:

| Phiên bản đọc file mới | `schemaVersion: 3` | `schemaVersion: 2` + `features` |
|---|---|---|
| T17 v2.2.0 — `normalizeDb`, mở app rồi lưu, sao lưu | đọc được, **ghi đè thành 2** khi lưu | đọc được, giữ nguyên `features` |
| RunPlan v1.8.9 — mở rồi lưu | giữ 3 | giữ nguyên `features` |
| `fitness`, `actual.fitness`, `fitnessLibrary`, `description` | giữ đủ | giữ đủ |

Vì bản cũ tự đổi số phiên bản về 2, `schemaVersion` không còn cho biết file có phần mở rộng hay không. `features` thì
được mọi bản cũ giữ nguyên, nên dùng nó làm tín hiệu. `SCHEMA_VERSION` chỉ tăng khi có thay đổi **không** cộng thêm.

**Giới hạn đã biết:** mở một buổi fitness bằng *Workout Builder* của bản v2.2.0 rồi bấm Lưu sẽ đổi `workoutType` thành
`Custom` và ghi đè `description`/`workoutStructure` bằng bài chạy mặc định; khối `fitness` vẫn còn nguyên. Bản cũ chỉ nên xem,
không sửa buổi fitness.

### File của app mobile "T17 Run Training — Mobile" (`legacy/T17_Run_Training_Mobile.html`)

`T17Fitness.fromMobile()` đọc được (giao diện nhập file làm ở lượt 3):

| Loại | Nhận diện (`mobileKind`) | Ghi chú |
|---|---|---|
| JSON v3 | `{ version:3, library, session }` | `localStorage` key `T17_RUN_TRAINING_V2` |
| JSON đời cũ | `{ date, calories, duration, rpe, sessionNote, exercises:[{id,done,rows}] }` | key `T17_RUN_BASIC_1_V1`; chuyển như `migrateOld()` của app: buổi Run Basic 1, phủ done/rows theo `id` |
| Session trần | object `session` của v3 | |
| Excel | 4 sheet `Session`, `Workout Log`, `Guide`, `Library` | fixture có sẵn; đọc ở lượt 3 |

App mobile chỉ giữ **một buổi hiện tại** và file xuất **không có mã buổi** — T17 lo phần lịch sử và chống trùng.

### Test tương thích (`tests/compat.test.js`)

Lõi nguyên văn của v2.2.0 nằm ở `tests/compat/v2.2.0/`, nạp trong `vm` riêng:
(a) mọi fixture đời cũ → bản mới cho kết quả **giống hệt** v2.2.0 (cả báo cáo và gộp plan/log);
(b) file mới có fitness (`tests/fixtures/t17-fitness-backup.json`) → v2.2.0 nạp, sao lưu, gộp vẫn đủ mọi trường;
(c) xuất → nạp lại bằng nhau, nhập lại không nhân đôi.
Fixture app mobile (`fitness-mobile-v3.json`, `fitness-mobile-v3.xlsx`, `fitness-mobile-v1-legacy.json`) được sinh bằng chính
mã app mobile (+ SheetJS 0.18.5 như app dùng); `t17-v22-multiuser/` do chính bản v2.2.0 ghi ra (2 người dùng).

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
