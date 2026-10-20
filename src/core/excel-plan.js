/* T17 RunTracker — đọc sheet Excel kế hoạch (định dạng RunPlan: khối "Tuần" × 7 cột ngày).
 * Pure: nhận mảng hàng (aoa) từ RunPlanXLSX.readFirstSheet. Dùng trong app (T17ExcelPlan) và Node test.
 * Hỗ trợ khối phụ "Tuần N - bài k" (T17 v2 xuất nhiều bài/ngày) — tự gộp khi import.
 */
(function (root) {
'use strict';
const C = root.T17Core || (typeof require === 'function' ? require('./utils.js') : null);
const { DAYS, norm, cleanDescription, excelYmd, pace } = C;
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
   const descR=labels['mo ta bai tap'];const kmR=labels['so km du kien']??labels['so km'];const minR=labels['so phut du kien']??labels['so phut'];const noteR=labels['ghi chu ke hoach']??labels['ghi chu'];const structR=labels['cau truc bai tap json'];
   for(let c=1;c<=7;c++){let structure=null;if(structR!=null&&rows[structR]?.[c]){try{structure=JSON.parse(String(rows[structR][c]))}catch(e){structure=null}}const workoutName=rows[i]?.[c]??'',planKm=kmR!=null?rows[kmR]?.[c]??'':'',planMinutes=minR!=null?rows[minR]?.[c]??'':'',description=cleanDescription(descR!=null?rows[descR]?.[c]??'':'');if(!structure)structure=simpleImportedStructure(workoutName,planKm,planMinutes,description);w.days.push({dow:DAYS[c-1],date:excelYmd(rows[dateRow]?.[c]),workoutName,planKm,planMinutes,description,planNote:noteR!=null?rows[noteR]?.[c]??'':'',workoutStructure:structure,actual:null})}
   weeks.push(w);i=end-1;
 }
 if(!weeks.length)throw new Error('Không nhận ra cấu trúc tuần/ngày trong file Excel.');return weeks;
}
const api = { parseWorkbookRows, simpleImportedStructure };
root.T17ExcelPlan = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
