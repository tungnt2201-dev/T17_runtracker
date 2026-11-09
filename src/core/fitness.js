/* T17 RunTracker — dữ liệu FITNESS (v2.3, lượt 1: chỉ lớp dữ liệu, chưa có giao diện).
 *
 * Một buổi fitness là một workout bình thường trong weeks[].days[].workouts[], có thêm:
 *   workoutType : 'Fitness'
 *   description : bản tóm tắt chữ (summaryText) → RunPlan/T17 đời cũ vẫn hiển thị được nội dung buổi
 *   fitness     : { schema, sessionId, templateId, workoutNote, sessionNote,
 *                   exercises:[{ instanceId, libraryId, name, category, plan, rows:[{set,group,reps,time,weight,note}] }] }   ← KẾ HOẠCH
 *   actual.fitness : { schema, sessionId, contentHash, exercises:[{ instanceId, libraryId, name, category, plan, done, rows }] } ← THỰC TẾ
 * Thư viện bài tập của từng người dùng: db.fitnessLibrary (chỉ xuất hiện khi người dùng đã có dữ liệu fitness).
 *
 * Định dạng của app mobile "T17 Run Training — Mobile" (legacy/T17_Run_Training_Mobile.html) được đọc bằng fromMobile():
 *   - v3  : { version:3, library:[...], session:{ workoutName, templateId, date, calories, duration, rpe, sessionNote, workoutNote, exercises:[...] } }
 *   - v1  : key localStorage T17_RUN_BASIC_1_V1 = { date, calories, duration, rpe, sessionNote, exercises:[{ id, done, rows }] }
 *   - session trần (chỉ object session của v3)
 * Thư viện dựng sẵn và 2 mẫu buổi bên dưới được trích NGUYÊN VĂN từ mã app mobile để id/tên khớp khi nhập file.
 *
 * Pure — dùng trong app (globalThis.T17Fitness) và Node test. Không đụng DOM.
 */
(function (root) {
'use strict';
const C = root.T17Core || (typeof require === 'function' ? require('./utils.js') : null);
const { norm, isYmd, excelYmd } = C;

const FITNESS_SCHEMA = 1;
const FITNESS_TYPE = 'Fitness';
const ROW_KEYS = ['set', 'group', 'reps', 'time', 'weight', 'note'];

// ---- Trích nguyên văn từ legacy/T17_Run_Training_Mobile.html (BUILTIN_LIBRARY, TEMPLATES) ----
const BUILTIN_LIBRARY = [
  {"id":"good-morning","name":"Good Morning with Barbell","category":"Posterior chain","plan":"Set 1: 10–12 nhẹ · Set 2: 8–10 nặng hơn","cue":"Đặt barbell chắc trên phần cơ thang/upper back, đứng vững và gối hơi chùng. Đẩy hông ra sau như hip hinge, giữ cột sống trung tính rồi siết mông để trở về tư thế đứng.","caution":"Giữ thanh tạ ổn định trên lưng trên; không đặt tạ lên cổ, không cúi bằng lưng và không cố hạ quá sâu khi lưng bắt đầu cong.","defaultRows":[{"set":"1","group":"1-12","reps":"12","time":"","weight":"","note":""},{"set":"2","group":"1-10","reps":"10","time":"","weight":"","note":""}]},
  {"id":"reverse-lunge","name":"Reverse Lunge with Dumbbells","category":"Knee / Hip","plan":"Set 1: 10–12 nhẹ · Set 2: 8–10 nặng hơn","cue":"Cầm tạ hai bên, bước một chân ra sau và hạ người có kiểm soát. Gối chân trước đi theo hướng bàn chân. Đạp chân trước xuống sàn để trở lại.","caution":"Tránh bước quá hẹp, gối đổ vào trong hoặc dùng chân sau đẩy mạnh để đứng lên.","defaultRows":[{"set":"1","group":"mỗi chân","reps":"12","time":"","weight":"","note":""},{"set":"2","group":"mỗi chân","reps":"10","time":"","weight":"","note":""}]},
  {"id":"one-leg-deadlift","name":"One-Leg Deadlift with Dumbbells","category":"Hamstring / Balance","plan":"Set 1: 10–12 nhẹ · Set 2: 8–10 nặng hơn","cue":"Đứng trên một chân, gối hơi chùng, đẩy hông ra sau và nghiêng thân về trước. Giữ hai bên hông tương đối cân, chân còn lại duỗi ra sau.","caution":"Không xoay mở hông, không kéo tạ bằng lưng và không hy sinh thăng bằng để cố xuống sâu.","defaultRows":[{"set":"1","group":"mỗi chân","reps":"12","time":"","weight":"","note":""},{"set":"2","group":"mỗi chân","reps":"10","time":"","weight":"","note":""}]},
  {"id":"glute-bridge","name":"Hip Thrust with Barbell","category":"Glute","plan":"Set 1: 10–12 nhẹ · Set 2: 8–10 nặng hơn","cue":"Tựa phần lưng trên vào ghế chắc chắn, bàn chân đặt vững, barbell nằm ngang vùng hông có đệm. Đẩy hông lên đến khi thân và đùi gần thành một đường thẳng, siết mông rồi hạ có kiểm soát.","caution":"Giữ ghế ổn định, cằm hơi thu, không ưỡn thắt lưng ở đỉnh và luôn kiểm soát thanh tạ trên hông.","defaultRows":[{"set":"1","group":"","reps":"12","time":"","weight":"","note":""},{"set":"2","group":"","reps":"10","time":"","weight":"","note":""}]},
  {"id":"single-leg-squat","name":"Single Leg Squat / Single Leg Press","category":"Knee / Quad","plan":"Set 1: 10–12 nhẹ · Set 2: 8–10 nặng hơn","cue":"Chọn biến thể phù hợp. Hạ người hoặc đạp máy có kiểm soát, gối đi cùng hướng mũi chân và duy trì lực đều qua bàn chân.","caution":"Không để gối sụp vào trong. Giảm độ sâu hoặc tải nếu mất kiểm soát; với leg press không khóa cứng gối.","defaultRows":[{"set":"1","group":"mỗi chân","reps":"12","time":"","weight":"","note":""},{"set":"2","group":"mỗi chân","reps":"10","time":"","weight":"","note":""}]},
  {"id":"single-calf-raise","name":"Single Calf Raise with Dumbbells","category":"Calf","plan":"Set 1: 10–12 nhẹ · Set 2: 8–10 nặng hơn","cue":"Đứng một chân, nâng gót hết biên độ có kiểm soát, dừng ngắn ở đỉnh rồi hạ chậm. Có thể vịn nhẹ để giữ thăng bằng.","caution":"Không bật nảy, không lăn cổ chân ra ngoài/trong và không rút ngắn biên độ chỉ để tăng tạ.","defaultRows":[{"set":"1","group":"mỗi chân","reps":"12","time":"","weight":"","note":""},{"set":"2","group":"mỗi chân","reps":"10","time":"","weight":"","note":""}]},
  {"id":"backward-walk","name":"Đi lùi","category":"Knee basic","plan":"10 phút","cue":"Đi lùi trên bề mặt phẳng và thông thoáng, bước ngắn, thân người thẳng, tiếp đất nhẹ và giữ nhịp đều.","caution":"Ưu tiên nơi an toàn, không có vật cản. Giảm tốc hoặc dừng nếu đau nhói ở gối, cổ chân hay bàn chân.","defaultRows":[{"set":"1","group":"","reps":"","time":"10 phút","weight":"","note":""}]},
  {"id":"banded-knee-extension","name":"Banded Knee Extension","category":"Knee basic","plan":"2 phút","cue":"Cố định dây kháng lực phía sau gối. Từ tư thế gối hơi chùng, duỗi gối có kiểm soát đến gần thẳng rồi quay lại, giữ bàn chân ổn định.","caution":"Không giật dây hoặc khóa gối mạnh ở cuối biên độ; dùng lực vừa đủ để chuyển động trơn tru.","defaultRows":[{"set":"1","group":"","reps":"","time":"2 phút","weight":"","note":""}]},
  {"id":"tib-raise","name":"Tib Raise","category":"Shin / Ankle","plan":"1 x 20","cue":"Giữ gót chân trên sàn, nâng mũi bàn chân lên bằng cơ mặt trước cẳng chân rồi hạ chậm xuống.","caution":"Không nhấc gót, không giật nhanh; giữ biên độ trong khả năng kiểm soát.","defaultRows":[{"set":"1","group":"","reps":"20","time":"","weight":"","note":""}]},
  {"id":"fhl-calf-raise","name":"FHL Calf Raise","category":"Calf / Foot","plan":"1 x 20","cue":"Ở tư thế calf raise có điểm tựa, hơi nghiêng người theo biến thể đã chọn. Nâng gót chậm, đẩy qua vùng ngón cái và hạ có kiểm soát.","caution":"Không để cổ chân đổ mạnh vào trong/ngoài; giảm biên độ nếu xuất hiện khó chịu ở gân Achilles hoặc bàn chân.","defaultRows":[{"set":"1","group":"","reps":"20","time":"","weight":"","note":""}]},
  {"id":"step-ups","name":"Step Ups","category":"Knee / Quad","plan":"3 x 10 mỗi chân","cue":"Đứng trên bục chắc chắn. Giữ một chân làm chân trụ, hạ chân còn lại xuống có kiểm soát rồi dùng chân trụ đưa cơ thể trở lại.","caution":"Giữ gối chân trụ theo hướng ngón chân, không để hông rơi sang một bên. Chọn độ cao bục phù hợp.","defaultRows":[{"set":"1","group":"mỗi chân","reps":"10","time":"","weight":"","note":""},{"set":"2","group":"mỗi chân","reps":"10","time":"","weight":"","note":""},{"set":"3","group":"mỗi chân","reps":"10","time":"","weight":"","note":""}]},
  {"id":"standing-hip-flexion","name":"Standing Hip Flexion","category":"Hip flexor","plan":"2 x 25 mỗi chân","cue":"Đứng thẳng, giữ thân ổn định và nâng gối lên bằng cơ gấp hông. Hạ xuống chậm, tránh ngả người ra sau.","caution":"Không dùng quán tính hoặc ưỡn lưng để nâng gối; có thể vịn nhẹ nếu cần thăng bằng.","defaultRows":[{"set":"1","group":"mỗi chân","reps":"25","time":"","weight":"","note":""},{"set":"2","group":"mỗi chân","reps":"25","time":"","weight":"","note":""}]},
  {"id":"isometric-glute-bridge","name":"Isometric Glute Bridge","category":"Glute / Isometric","plan":"1 x 45 giây","cue":"Vào tư thế cầu mông theo biến thể một chân, nâng hông và giữ vị trí ổn định trong thời gian mục tiêu.","caution":"Giữ xương chậu cân, không ưỡn thắt lưng. Nếu một chân quá khó, giảm thời gian hoặc dùng hai chân.","defaultRows":[{"set":"1","group":"","reps":"","time":"45 giây","weight":"","note":""}]},
  {"id":"elephant-walk","name":"Elephant Walk","category":"Hamstring mobility","plan":"2 x 30 lần","cue":"Cúi người, tay chạm sàn hoặc điểm tựa phù hợp. Luân phiên co một gối và duỗi chân còn lại để tạo cảm giác kéo giãn gân kheo.","caution":"Không ép đầu gối khóa cứng hoặc cố chạm sàn bằng mọi giá; giữ nhịp nhẹ và kiểm soát.","defaultRows":[{"set":"1","group":"","reps":"30","time":"","weight":"","note":""},{"set":"2","group":"","reps":"30","time":"","weight":"","note":""}]},
  {"id":"calf-stretch","name":"Calf Stretch","category":"Calf mobility","plan":"60 giây","cue":"Đặt chân trên bục nghiêng hoặc vị trí kéo giãn phù hợp, giữ gót ổn định và duy trì cảm giác căng vừa phải ở bắp chân.","caution":"Không nhún bật và không kéo đến mức đau nhói; giữ hơi thở tự nhiên.","defaultRows":[{"set":"1","group":"","reps":"","time":"60 giây","weight":"","note":""}]}
];
const BUILTIN_TEMPLATES = [
  {"id":"run-basic-1","name":"Run Basic 1","duration":"45","note":"Set 1: 10–12 rep với tạ nhẹ hoặc không tạ. Set 2: 8–10 rep với mức tạ tương đối nặng nhưng vẫn giữ đúng kỹ thuật. Nghỉ khoảng 60–90 giây; set nặng có thể nghỉ lâu hơn nếu cần.","items":["good-morning","reverse-lunge","one-leg-deadlift","glute-bridge","single-leg-squat","single-calf-raise"]},
  {"id":"knee-support-1","name":"Bổ trợ khớp gối 1","duration":"","note":"Thực hiện chậm và ưu tiên biên độ không đau. Đây là buổi bổ trợ, không phải bài kiểm tra sức mạnh tối đa. Với động tác theo thời gian, dùng ô “Thời gian / quãng đường”; với động tác theo rep, dùng ô “Số rep”.","items":["backward-walk","banded-knee-extension","tib-raise","fhl-calf-raise","tib-raise","step-ups","standing-hip-flexion","isometric-glute-bridge","elephant-walk","calf-stretch"]}
];
const BUILTIN_BY_ID = new Map(BUILTIN_LIBRARY.map(x => [x.id, x]));

/* ---------- tiện ích ---------- */
const str = v => v == null ? '' : String(v);
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
function rand36(n) { let s = ''; while (s.length < n) s += Math.random().toString(36).slice(2); return s.slice(0, n); }
function newSessionId() { return 'fs-' + Date.now().toString(36) + '-' + rand36(6); }
function newInstanceId() { return 'ex-' + Date.now().toString(36) + '-' + rand36(6); }
/** Số dạng "10,5" / "10.5" / 10 → number; còn lại ('', '10 phút', 'mỗi chân') → NaN. */
function numOf(v) { if (typeof v === 'number') return v; const s = str(v).trim().replace(',', '.'); return s && /^-?\d+(\.\d+)?$/.test(s) ? Number(s) : NaN; }
function toNumOrEmpty(v) { const n = numOf(v); return Number.isFinite(n) ? n : ''; }
function toDate(v) { if (isYmd(v)) return v; const s0 = str(v).trim().slice(0, 10); if (isYmd(s0)) return s0; const s = excelYmd(v); return isYmd(s) ? s : ''; }

function row(r) { const o = {}; for (const k of ROW_KEYS) o[k] = str(r && r[k]); return o; }
const rowHasContent = r => ROW_KEYS.some(k => k !== 'set' && str(r[k]).trim() !== '');
function normalizeRows(rows) { return (Array.isArray(rows) ? rows : []).filter(isObj).map(row); }

/* ---------- thư viện ---------- */
function builtinItem(x) { return { id: x.id, builtin: true, name: x.name, category: x.category, plan: x.plan, cue: x.cue, caution: x.caution, imageData: '', imageName: '', defaultRows: normalizeRows(x.defaultRows) }; }
/** Chuẩn hoá thư viện: luôn đủ 15 bài dựng sẵn (nội dung lấy theo mã, chỉ giữ ảnh/MET người dùng gắn thêm)
 *  + bài tự tạo (không trùng id). Field lạ của bài tự tạo được giữ nguyên. */
function normalizeLibrary(list) {
  const src = (Array.isArray(list) ? list : []).filter(x => isObj(x) && str(x.id).trim());
  const saved = new Map(src.map(x => [str(x.id), x]));
  const out = BUILTIN_LIBRARY.map(b => {
    const s = saved.get(b.id) || {}; const o = builtinItem(b);
    o.imageData = str(s.imageData); o.imageName = str(s.imageName);
    if (Number.isFinite(numOf(s.met)) && numOf(s.met) > 0) o.met = numOf(s.met);
    return o;
  });
  const seen = new Set(out.map(x => x.id));
  for (const x of src) {
    const id = str(x.id); if (seen.has(id) || BUILTIN_BY_ID.has(id)) continue; seen.add(id);
    const o = { ...x, id, builtin: false, name: str(x.name).trim() || 'Bài tập', category: str(x.category), plan: str(x.plan), cue: str(x.cue), caution: str(x.caution), imageData: str(x.imageData), imageName: str(x.imageName) };
    const dr = normalizeRows(x.defaultRows); o.defaultRows = dr.length ? dr : [row({ set: '1' })];
    if ('met' in x) { const m = numOf(x.met); if (Number.isFinite(m) && m > 0) o.met = m; else delete o.met; }
    out.push(o);
  }
  return out;
}
/** Chỉ các bài tự tạo (để gộp vào thư viện người dùng khi nhập file). */
function customItems(list) { return normalizeLibrary(list).filter(x => !x.builtin); }

/* ---------- bài trong buổi & khối fitness ---------- */
function normalizeExercise(e, opts = {}) {
  if (!isObj(e)) return null;
  const lib = BUILTIN_BY_ID.get(str(e.libraryId));
  const o = { ...e };
  o.instanceId = str(e.instanceId).trim() || newInstanceId();
  o.libraryId = str(e.libraryId);
  // Bài dựng sẵn: tên/nhóm/prescription lấy theo thư viện (giống app mobile); bài tự tạo giữ nguyên.
  o.name = lib ? lib.name : (str(e.name).trim() || 'Bài tập');
  o.category = lib ? lib.category : str(e.category);
  o.plan = lib ? lib.plan : str(e.plan);
  o.rows = normalizeRows(e.rows);
  if (opts.withDone) o.done = !!e.done; else delete o.done;
  // Hướng dẫn và ảnh nằm trong thư viện, không chép vào từng buổi (giữ file nhỏ).
  delete o.cue; delete o.caution; delete o.imageData; delete o.imageName;
  return o;
}
/** Chuẩn hoá workout.fitness (kế hoạch, withDone=false) hoặc actual.fitness (thực tế, withDone=true).
 *  Field lạ được giữ nguyên (tương thích phiên bản sau). */
function normalizeFitnessBlock(f, opts = {}) {
  if (!isObj(f)) return null;
  const o = { ...f };
  o.schema = Number.isFinite(numOf(f.schema)) && numOf(f.schema) > 0 ? numOf(f.schema) : FITNESS_SCHEMA;
  o.sessionId = str(f.sessionId);
  if ('templateId' in f) o.templateId = str(f.templateId);
  for (const k of ['workoutNote', 'sessionNote']) if (k in f) o[k] = str(f[k]);
  o.exercises = (Array.isArray(f.exercises) ? f.exercises : []).map(e => normalizeExercise(e, opts)).filter(Boolean);
  return o;
}
function isFitnessWorkout(w) { return !!w && (w.workoutType === FITNESS_TYPE || isObj(w.fitness) || isObj(w.actual?.fitness)); }
function hasFitnessContent(w) { return !!(w && ((w.fitness?.exercises || []).length || (w.actual?.fitness?.exercises || []).length)); }

/* ---------- số liệu & tóm tắt ---------- */
function exercisesOf(x) {
  if (Array.isArray(x)) return x;
  if (!isObj(x)) return [];
  if (Array.isArray(x.exercises)) return x.exercises;
  if (x.actual?.fitness?.exercises?.length) return x.actual.fitness.exercises;
  return x.fitness?.exercises || [];
}
/** Tổng khối lượng: số bài, số bài done, số set (dòng có nội dung), tổng rep (số), tonnage kg (rep × kg). */
function sessionVolume(x) {
  const ex = exercisesOf(x); const v = { exercises: ex.length, done: 0, sets: 0, reps: 0, kg: 0 };
  for (const e of ex) {
    if (e.done) v.done++;
    for (const r of e.rows || []) {
      if (!rowHasContent(r)) continue; v.sets++;
      const reps = numOf(r.reps), kg = numOf(r.weight);
      if (Number.isFinite(reps)) { v.reps += reps; if (Number.isFinite(kg)) v.kg += reps * kg; }
    }
  }
  v.kg = Math.round(v.kg * 10) / 10;
  return v;
}
function rangeText(values) {
  const u = [...new Set(values.map(s => str(s).trim()).filter(Boolean))];
  if (!u.length) return '';
  const nums = u.map(numOf);
  if (u.length > 1 && nums.every(Number.isFinite)) { const a = Math.min(...nums), b = Math.max(...nums); return a === b ? String(a) : `${a}–${b}`; }
  return u.join('/');
}
function exerciseLine(e) {
  const rows = (e.rows || []).filter(rowHasContent); const parts = [];
  if (rows.length) {
    const reps = rangeText(rows.map(r => r.reps)), time = rangeText(rows.map(r => r.time)), kg = rangeText(rows.map(r => r.weight)), grp = rangeText(rows.map(r => r.group));
    let s = `${rows.length} set`; if (reps) s += ` × ${reps}`; if (time) s += ` × ${time}`; if (grp) s += ` (${grp})`;
    parts.push(s); if (kg) parts.push(`${kg} kg`);
  } else if (e.plan) parts.push(e.plan);
  const mark = e.done === true ? '✓ ' : e.done === false ? '✗ ' : '';
  return `• ${mark}${e.name || 'Bài tập'}${parts.length ? ' — ' + parts.join(' · ') : ''}`;
}
/** Bản tóm tắt chữ cho trường description (workout, khối fitness hoặc mảng bài). */
function summaryText(x) {
  const ex = exercisesOf(x); if (!ex.length) return '';
  const v = sessionVolume(ex);
  const head = `Fitness · ${v.exercises} bài${v.done ? ` (${v.done} xong)` : ''}${v.sets ? ` · ${v.sets} set` : ''}${v.kg ? ` · ${v.kg} kg tổng` : ''}`;
  return [head, ...ex.map(exerciseLine)].join('\n');
}

/** Mã băm nội dung buổi (FNV-1a 32 bit, hex) — KHÔNG phụ thuộc instanceId/sessionId để nhận ra cùng một buổi
 *  dù app mobile cấp id mới. Gồm: ngày, tên buổi, danh sách bài (libraryId hoặc tên), done, các dòng. */
function contentHash(s, extra = {}) {
  const ex = exercisesOf(s);
  const payload = JSON.stringify([toDate(extra.date ?? s?.date), norm(extra.workoutName ?? s?.workoutName ?? ''),
    ex.map(e => [e.libraryId || norm(e.name), e.done ? 1 : 0, (e.rows || []).map(r => ROW_KEYS.map(k => str(r[k]).trim()))])]);
  let h = 0x811c9dc5;
  for (let i = 0; i < payload.length; i++) { h ^= payload.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
  return h.toString(16).padStart(8, '0');
}

/* ---------- đọc file app mobile ---------- */
/** 'v3' | 'v1' | 'session' | '' */
function mobileKind(x) {
  if (!isObj(x)) return '';
  if (isObj(x.session) && Array.isArray(x.session.exercises) && (Array.isArray(x.library) || x.version != null)) return 'v3';
  if (Array.isArray(x.exercises) && x.exercises.length && x.exercises.every(e => isObj(e) && 'id' in e && !('libraryId' in e) && !('instanceId' in e))) return 'v1';
  if (Array.isArray(x.exercises) && ('workoutName' in x || 'templateId' in x) && x.exercises.every(e => isObj(e) && ('libraryId' in e || 'instanceId' in e))) return 'session';
  return '';
}
function templateSession(id) {
  const t = BUILTIN_TEMPLATES.find(x => x.id === id) || BUILTIN_TEMPLATES[0];
  return { workoutName: t.name, templateId: t.id, duration: t.duration, workoutNote: t.note,
    exercises: t.items.map((lid, i) => { const b = BUILTIN_BY_ID.get(lid); return { instanceId: `ex-${t.id}-${i + 1}`, libraryId: lid, name: b.name, category: b.category, plan: b.plan, done: false, rows: normalizeRows(b.defaultRows) }; }) };
}
/** Đọc một file/đối tượng của app mobile → { kind, session (chuẩn), customLibrary }.
 *  session = { schema, sessionId, templateId, workoutName, date, duration, calories, rpe, sessionNote, workoutNote, exercises[{instanceId, libraryId, name, category, plan, done, rows}] } */
function fromMobile(x) {
  const kind = mobileKind(x);
  if (!kind) throw new Error('Không nhận ra định dạng file của app fitness (T17 Run Training).');
  let s, lib = [];
  if (kind === 'v1') {
    // Giống migrateOld() của app: buổi Run Basic 1 dựng sẵn, phủ done/rows theo id bài cũ.
    const base = templateSession('run-basic-1');
    for (const oe of x.exercises) { const d = base.exercises.find(e => e.libraryId === oe.id); if (d) { d.done = !!oe.done; d.rows = normalizeRows(oe.rows); } }
    s = { ...base, date: x.date, calories: x.calories, duration: x.duration ?? '45', rpe: x.rpe, sessionNote: x.sessionNote };
  } else {
    s = kind === 'v3' ? x.session : x;
    lib = Array.isArray(x.library) ? customItems(x.library) : [];
  }
  const session = {
    schema: FITNESS_SCHEMA, sessionId: str(s.sessionId), templateId: str(s.templateId), workoutName: str(s.workoutName).trim() || 'Fitness',
    date: toDate(s.date), duration: toNumOrEmpty(s.duration), calories: toNumOrEmpty(s.calories), rpe: toNumOrEmpty(s.rpe),
    sessionNote: str(s.sessionNote), workoutNote: str(s.workoutNote),
    exercises: (s.exercises || []).map(e => normalizeExercise(e, { withDone: true })).filter(Boolean),
  };
  return { kind, session, customLibrary: lib };
}

/** Buổi (chuẩn) → workout T17. status 'done' → có actual; 'plan' → chỉ kế hoạch. Không gán id (nơi gọi gán). */
function toWorkout(session, opts = {}) {
  const done = (opts.status || 'done') === 'done';
  const sessionId = session.sessionId || newSessionId();
  const planEx = session.exercises.map(e => { const o = { ...e }; delete o.done; return o; });
  const w = { workoutName: session.workoutName || 'Fitness', workoutType: FITNESS_TYPE, planKm: '', planMinutes: toNumOrEmpty(session.duration),
    description: summaryText(done ? session.exercises : planEx), planNote: session.workoutNote || '', workoutStructure: null,
    fitness: { schema: FITNESS_SCHEMA, sessionId, templateId: session.templateId || '', workoutNote: session.workoutNote || '', exercises: planEx },
    actual: null };
  if (done) w.actual = { status: 'done', km: '', minutes: toNumOrEmpty(session.duration), fatigue: toNumOrEmpty(session.rpe), calories: toNumOrEmpty(session.calories),
    note: session.sessionNote || '', segments: [], source: 'fitness-mobile',
    fitness: { schema: FITNESS_SCHEMA, sessionId, contentHash: contentHash(session), exercises: session.exercises.map(e => ({ ...e, done: !!e.done })) } };
  return w;
}

const api = { FITNESS_SCHEMA, FITNESS_TYPE, ROW_KEYS, BUILTIN_LIBRARY, BUILTIN_TEMPLATES, newSessionId, newInstanceId, normalizeRows, normalizeLibrary, customItems, normalizeExercise, normalizeFitnessBlock, isFitnessWorkout, hasFitnessContent, sessionVolume, summaryText, contentHash, mobileKind, templateSession, fromMobile, toWorkout };
root.T17Fitness = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
