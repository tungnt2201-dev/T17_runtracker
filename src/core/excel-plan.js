/* T17 RunTracker — đọc sheet Excel kế hoạch (định dạng RunPlan: khối "Tuần" × 7 cột ngày).
 * Pure: nhận mảng hàng (aoa) từ RunPlanXLSX.readFirstSheet. Dùng trong app (T17ExcelPlan) và Node test.
 * Hỗ trợ khối phụ "Tuần N - bài k" (T17 v2 xuất nhiều bài/ngày) — tự gộp khi import.
 * v2.3 Fitness: trong lưới tuần có thêm hàng "Mã buổi fitness" (chỉ khi có buổi fitness), và cuối sheet có khối riêng
 *   "FITNESS — CHI TIẾT BÀI TẬP": mỗi bài × mỗi dòng set một hàng. Bản cũ bỏ qua cả hai (nhãn lạ), chỉ thấy tên / mô tả / phút.
 */
(function (root) {
'use strict';
const C = root.T17Core || (typeof require === 'function' ? require('./utils.js') : null);
const F = root.T17Fitness || (typeof require === 'function' ? require('./fitness.js') : null);
const { DAYS, norm, cleanDescription, excelYmd, pace } = C;
const FIT_GRID_LABEL = 'Mã buổi fitness';
const FIT_SECTION_TITLE = 'FITNESS — CHI TIẾT BÀI TẬP';
const FIT_HEADER = ['Fitness · mã buổi', 'Ngày', 'Buổi', 'KH/TT', 'Thứ tự', 'Library ID', 'Bài', 'Nhóm', 'Prescription', 'Set', 'Rep / nhóm', 'Số rep', 'Thời gian / quãng đường', 'Trọng lượng (kg)', 'Ghi chú', 'Hoàn tất'];

/** Mã nối hàng lưới tuần với khối chi tiết fitness. */
function fitnessKeyOf(item) { return item?.fitness?.sessionId || item?.actual?.fitness?.sessionId || item?.id || ''; }
/** Khối dòng chi tiết fitness cho Excel. entries: [{date (dd/mm/yyyy hoặc yyyy-mm-dd), item}] */
function fitnessSectionAoa(entries) {
  const list = (entries || []).filter(e => e && e.item && F.isFitnessWorkout(e.item));
  if (!list.length) return [];
  const out = [[FIT_SECTION_TITLE], FIT_HEADER.slice()];
  const push = (sid, date, name, kind, exercises, withDone) => exercises.forEach((ex, i) => {
    const rows = (ex.rows || []).length ? ex.rows : [{}];
    for (const r of rows) out.push([sid, date, name, kind, i + 1, ex.libraryId || '', ex.name || '', ex.category || '', ex.plan || '', r.set ?? '', r.group ?? '', r.reps ?? '', r.time ?? '', r.weight ?? '', r.note ?? '', withDone ? (ex.done ? 'Có' : 'Không') : '']);
  });
  for (const { date, item } of list) {
    const sid = fitnessKeyOf(item);
    push(sid, date, item.workoutName || '', 'KH', item.fitness?.exercises || [], false);
    if (item.actual?.fitness && item.actual.status !== 'missed') push(sid, date, item.workoutName || '', 'TT', item.actual.fitness.exercises || [], true);
  }
  return out;
}
/** Đọc khối chi tiết fitness → Map(mã buổi → {plan:[exercise], actual:[exercise]}). */
function parseFitnessSection(rows) {
  const out = new Map();
  const h = (rows || []).findIndex(r => norm(r?.[0]) === norm(FIT_HEADER[0]) && norm(r?.[1]) === 'ngay');
  if (h < 0) return out;
  const col = {}; (rows[h] || []).forEach((v, i) => { col[norm(v)] = i; });
  const g = (r, name) => { const i = col[norm(name)]; const v = i == null ? '' : r[i]; return v == null ? '' : String(v); };
  for (let r = h + 1; r < rows.length; r++) {
    const row = rows[r] || []; const sid = String(row[0] ?? '').trim(); if (!sid) break;
    if (!out.has(sid)) out.set(sid, { plan: [], actual: [] });
    const kind = norm(g(row, 'KH/TT')) === 'tt' ? 'actual' : 'plan'; const list = out.get(sid)[kind];
    const order = Number(g(row, 'Thứ tự')) || list.length + 1;
    let ex = list.find(e => e._order === order);
    if (!ex) { ex = { _order: order, instanceId: '', libraryId: g(row, 'Library ID'), name: g(row, 'Bài'), category: g(row, 'Nhóm'), plan: g(row, 'Prescription'), rows: [] }; if (kind === 'actual') ex.done = norm(g(row, 'Hoàn tất')).startsWith('c'); list.push(ex); }
    const rr = { set: g(row, 'Set'), group: g(row, 'Rep / nhóm'), reps: g(row, 'Số rep'), time: g(row, 'Thời gian / quãng đường'), weight: g(row, 'Trọng lượng (kg)'), note: g(row, 'Ghi chú') };
    if (Object.values(rr).some(v => v !== '')) ex.rows.push(rr);
  }
  for (const v of out.values()) for (const k of ['plan', 'actual']) v[k] = v[k].sort((a, b) => a._order - b._order).map(({ _order, ...e }) => e);
  return out;
}
function simpleImportedStructure(name,planKm,planMinutes,description){
 const km=+planKm||0,min=+planMinutes||0;if(String(description||'').trim()||!(km>0||min>0))return null;
 const p=km>0&&min>0?pace(km,min).replace('/km',''):'';
 return{version:1,source:'excel-simple',warmup:null,groups:[{label:'Main set',repeats:1,steps:[{label:String(name||'Running').trim()||'Running',activity:'run',mode:km>0?'distance':'time',value:km>0?km:min,paceFrom:p,paceTo:p,hrFrom:'',hrTo:''}]}],cooldown:null};
}
function parseWorkbookRows(rows){const weeks=[];
 for(let i=0;i<rows.length;i++){const first=rows[i]?.[0];if(first==null||first==='')continue;const n=norm(first);const isWeek=(typeof first==='number'||/^tuan\s*\d+/.test(n)||/^\d+$/.test(String(first).trim()))&&rows[i+1]&&norm(rows[i+1][0])==='ngay';if(!isWeek)continue;
   const w={label:String(first).replace(/^Tuần\s*/i,''),days:[]};let end=rows.length;const dateRow=i+1;
   for(let r=i+2;r<rows.length;r++){const f=rows[r]?.[0],nn=norm(f);if((typeof f==='number'||/^tuan\s*\d+/.test(nn)||/^\d+$/.test(String(f??'').trim()))&&rows[r+1]&&norm(rows[r+1][0])==='ngay'){end=r;break}}
   const labels={};for(let r=dateRow;r<end;r++){const key=norm(rows[r]?.[0]);if(key)labels[key]=r}
   const fitR=labels[norm(FIT_GRID_LABEL)];const descR=labels['mo ta bai tap'];const kmR=labels['so km du kien']??labels['so km'];const minR=labels['so phut du kien']??labels['so phut'];const noteR=labels['ghi chu ke hoach']??labels['ghi chu'];const structR=labels['cau truc bai tap json'];
   for(let c=1;c<=7;c++){let structure=null;if(structR!=null&&rows[structR]?.[c]){try{structure=JSON.parse(String(rows[structR][c]))}catch(e){structure=null}}const workoutName=rows[i]?.[c]??'',planKm=kmR!=null?rows[kmR]?.[c]??'':'',planMinutes=minR!=null?rows[minR]?.[c]??'':'',description=cleanDescription(descR!=null?rows[descR]?.[c]??'':'');if(!structure)structure=simpleImportedStructure(workoutName,planKm,planMinutes,description);const day={dow:DAYS[c-1],date:excelYmd(rows[dateRow]?.[c]),workoutName,planKm,planMinutes,description,planNote:noteR!=null?rows[noteR]?.[c]??'':'',workoutStructure:structure,actual:null};const fsid=fitR!=null?String(rows[fitR]?.[c]??'').trim():'';if(fsid)day.fitnessSessionId=fsid;w.days.push(day)}
   weeks.push(w);i=end-1;
 }
 if(!weeks.length)throw new Error('Không nhận ra cấu trúc tuần/ngày trong file Excel.');
 const fit=parseFitnessSection(rows);
 for(const w of weeks)for(const d of w.days){const sid=d.fitnessSessionId;delete d.fitnessSessionId;if(!sid)continue;const sec=fit.get(sid);if(!sec)continue;
   d.workoutType=F.FITNESS_TYPE;d.workoutStructure=null;d.fitness=F.normalizeFitnessBlock({schema:F.FITNESS_SCHEMA,sessionId:sid,exercises:sec.plan});}
 return weeks;
}
const api = { parseWorkbookRows, simpleImportedStructure, fitnessKeyOf, fitnessSectionAoa, parseFitnessSection, FIT_GRID_LABEL, FIT_SECTION_TITLE, FIT_HEADER };
root.T17ExcelPlan = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
