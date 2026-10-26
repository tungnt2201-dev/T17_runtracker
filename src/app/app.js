'use strict';
/* T17 RunTracker — app chính (tách từ RunPlan Tracker v1.8.9). */
const APP_VERSION='2.1.1';
const {parseWorkbookRows}=T17ExcelPlan;
const {DAYS,cleanDescription,genId,hasWorkoutContent,norm,ymd,excelYmd,pace,parseDurationInput,formatDurationClock,samePlanRecord,numVN,paceToSec,secToPace,clamp,stepEstimate,flattenStructuredSegments,segmentHeight,parseYmdLocal,addDaysYmd,mondayYmd,isoWeekNumber,blankDay,deepClone,stepTargetsText,stepText,smartNum,descriptionOf,totalsOf}=T17Core;
const $=id=>document.getElementById(id);
const actualKm=$('actualKm'),actualMinutes=$('actualMinutes'),fatigue=$('fatigue'),calories=$('calories'),avgHr=$('avgHr'),actualNote=$('actualNote'),paceOut=$('paceOut'),workoutStatus=$('workoutStatus'),modal=$('modal'),actualForm=$('actualForm'),cancelModal=$('cancelModal'),deleteActual=$('deleteActual'),prevWeek=$('prevWeek'),nextWeek=$('nextWeek'),todayBtn=$('todayBtn'),importBtn=$('importBtn'),importFile=$('importFile'),exportBtn=$('exportBtn'),clearBtn=$('clearBtn'),backupBtn=$('backupBtn'),restoreBtn=$('restoreBtn'),restoreFile=$('restoreFile'),supportBox=$('supportBox'),newWorkoutBtn=$('newWorkoutBtn'),railNewWorkout=$('railNewWorkout'),builderModal=$('builderModal'),builderForm=$('builderForm'),builderDate=$('builderDate'),builderName=$('builderName'),builderType=$('builderType'),builderNote=$('builderNote'),builderContent=$('builderContent'),builderPreview=$('builderPreview'),deletePlan=$('deletePlan'),cancelBuilder=$('cancelBuilder'),saveAsTemplateBtn=$('saveAsTemplateBtn'),libraryBtn=$('libraryBtn'),railLibrary=$('railLibrary'),railData=$('railData'),railClear=$('railClear'),exportPlanBtn=$('exportPlanBtn'),importPlanBtn=$('importPlanBtn'),importPlanFile=$('importPlanFile'),tabCalendar=$('tabCalendar'),tabLog=$('tabLog'),shellEl=$('days')?.closest('.shell')||document.querySelector('.shell'),logView=$('logView'),logFrom=$('logFrom'),logTo=$('logTo'),logType=$('logType'),logStatus=$('logStatus'),logSearch=$('logSearch'),logResetBtn=$('logResetBtn'),logExportExcel=$('logExportExcel'),logExportJson=$('logExportJson'),logSummary=$('logSummary'),logRows=$('logRows'),logEmpty=$('logEmpty');
let db={weeks:[],templates:[],templatesSeeded:true},currentWeek=0,editingKey=null,builderEditing=null,builderState=null,visibleWeekCount=6,loadingMore=false,logViewActive=false,sectionTotalsActive=false,manualTopKmSnapshot='',manualTopMinutesSnapshot='';
const librarySearch=$('librarySearch'),libraryType=$('libraryType'),libraryDate=$('libraryDate'),libraryCount=$('libraryCount'),libraryCreateBtn=$('libraryCreateBtn');
function defaultTemplates(){
 const paced=(activity,label,mode,value,paceFrom,paceTo)=>({...defaultStep(activity,label,mode,value),paceFrom,paceTo});
 const mk=(name,type,structure)=>{const t=totalsOf(structure);return{id:genId('tpl'),name,workoutType:type,workoutStructure:structure,planKm:t.km?Math.round(t.km*1000)/1000:'',planMinutes:t.minutes?Math.round(t.minutes*10000)/10000:'',description:descriptionOf(structure),planNote:'',savedAt:new Date().toISOString()}};
 // Thang pace tham khảo (nhanh dần): Đi bộ hồi phục > Jog dễ/khởi động > Easy > Long run steady > Tempo > Interval
 return[
  mk('Easy 40 phút','Easy',{version:1,warmup:null,groups:[{label:'Easy pace',repeats:1,steps:[paced('run','Easy run','time',40,'6:15','6:45')]}],cooldown:null}),
  mk('Long run 90 phút','Long run',{version:1,warmup:paced('run','Warm-up','time',10,'7:00','7:30'),groups:[{label:'Steady',repeats:1,steps:[paced('run','Long steady','time',70,'6:25','6:55')]}],cooldown:paced('run','Cool-down','time',10,'7:00','7:30')}),
  mk('Tempo 20 phút','Tempo',{version:1,warmup:paced('run','Warm-up','time',15,'7:00','7:30'),groups:[{label:'Tempo',repeats:1,steps:[paced('run','Tempo','time',20,'5:45','6:05')]}],cooldown:paced('run','Cool-down','time',10,'7:00','7:30')}),
  mk('Interval 6x800m','Interval',{version:1,warmup:paced('run','Warm-up','time',15,'7:00','7:30'),groups:[{label:'6x800m',repeats:6,steps:[paced('run','Fast 800m','distance',0.8,'5:20','5:45'),paced('walk','Recovery','time',2,'11:30','13:00')]}],cooldown:paced('run','Cool-down','time',10,'7:00','7:30')}),
  mk('Recovery 25 phút','Recovery',{version:1,warmup:null,groups:[{label:'Recovery',repeats:1,steps:[paced('run','Recovery jog','time',25,'7:00','7:30')]}],cooldown:null})
 ];
}
/** Chuẩn hoá dữ liệu nạp từ file/localStorage (mọi phiên bản cũ) rồi gieo thư viện mẫu mặc định nếu chưa có. */
function loadDbFrom(raw){const {db:out,report}=T17Legacy.normalizeDb(raw||{weeks:[]});if(!out.templatesSeeded){const have=new Set((out.templates||[]).map(t=>norm(t.name)));out.templates=(out.templates||[]).concat(defaultTemplates().filter(t=>!have.has(norm(t.name))));out.templatesSeeded=true}return{db:out,report}}
function saveDb(){return T17Platform.save(db)}
/** Tìm lại vị trí bài theo id (chỉ số wi/di/ii có thể lệch sau khi lịch được sắp xếp lại). */
function resolveRef(ref){if(!ref)return null;const cur=db.weeks[ref.wi]?.days?.[ref.di]?.workouts?.[ref.ii];if(cur&&(!ref.id||cur.id===ref.id))return ref;if(!ref.id)return null;for(let wi=0;wi<db.weeks.length;wi++)for(let di=0;di<db.weeks[wi].days.length;di++){const ii=(db.weeks[wi].days[di].workouts||[]).findIndex(x=>x.id===ref.id);if(ii>=0)return{wi,di,ii,id:ref.id}}return null}
function toast(t){const x=$('toast');x.textContent=t;x.classList.add('show');clearTimeout(toast._t);toast._t=setTimeout(()=>x.classList.remove('show'),2400)}
function showSupport(kind,text){supportBox.className='support show '+kind;supportBox.textContent=text}
function fmtDate(s,short=false){if(!s)return'';const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d).toLocaleDateString('vi-VN',short?{day:'2-digit',month:'2-digit'}:{day:'2-digit',month:'2-digit',year:'numeric'})}
function dayNum(s){return s?String(+s.slice(8,10)):''}
function actualDurationLabel(minutes){const x=formatDurationClock(minutes);return x||'—'}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function readFileArrayBuffer(file){return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=()=>reject(fr.error||new Error('Không đọc được file.'));fr.readAsArrayBuffer(file)})}
function readFileText(file){return new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=()=>reject(fr.error||new Error('Không đọc được file.'));fr.readAsText(file,'utf-8')})}
function addWorkoutFromRecord(dst,src){dst.workouts=dst.workouts||[];dst.workouts.push({id:genId(),workoutName:src.workoutName||'',workoutType:src.workoutType||'',planKm:src.planKm??'',planMinutes:src.planMinutes??'',description:src.description||'',planNote:src.planNote||'',workoutStructure:src.workoutStructure?deepClone(src.workoutStructure):null,actual:null})}
async function importExcel(file){
 if(!file)return;if(!/\.xlsx$/i.test(file.name))throw new Error('Bản này hỗ trợ file .xlsx. Nếu đang dùng .xls, hãy Save As thành .xlsx trước.');if(!window.RunPlanXLSX)throw new Error('Bộ đọc Excel nội bộ chưa tải được.');
 const data=await readFileArrayBuffer(file);const rows=await RunPlanXLSX.readFirstSheet(data);const imported=parseWorkbookRows(rows);
 let added=0,duplicates=0,invalid=0;
 for(const w of imported){for(const src of w.days){if(!src.date){invalid++;continue}if(!hasWorkoutContent(src))continue;const target=ensureDate(src.date),dst=target.d;const dup=(dst.workouts||[]).some(it=>samePlanRecord(it,src));if(dup){duplicates++;continue}addWorkoutFromRecord(dst,src);added++}}
 db.weeks.sort((a,b)=>String(a.days?.[0]?.date||'').localeCompare(String(b.days?.[0]?.date||'')));saveDb();currentWeek=findCurrentWeek();visibleWeekCount=Math.max(6,visibleWeekCount);render();
 toast(`Đã thêm ${added} bài mới${duplicates?` · ${duplicates} bài trùng được bỏ qua`:''}${invalid?` · ${invalid} dòng thiếu ngày`:''}`);
}
function findCurrentWeek(){const today=ymd(new Date());let idx=db.weeks.findIndex(w=>w.days.some(d=>d.date===today));if(idx>=0)return idx;idx=db.weeks.findIndex(w=>w.days.some(d=>d.date>=today));return idx>=0?idx:Math.max(0,db.weeks.length-1)}
function hasPlan(d){return Array.isArray(d.workouts)&&d.workouts.length>0}
function primaryWorkout(d){return(d.workouts&&d.workouts[0])||null}
function valueEntered(v){return v!==''&&v!=null&&Number.isFinite(+v)}
function completionVariance(d){
 const a=d.actual;if(!a||a.status==='missed')return null;
 const metrics=[];const pkm=+d.planKm||0,pmin=+d.planMinutes||0;
 if(pkm>0&&valueEntered(a.km)){const signed=((+a.km)-pkm)/pkm;metrics.push({key:'km',label:'Cự ly',signed,abs:Math.abs(signed),actual:+a.km,plan:pkm,unit:'km'})}
 if(pmin>0&&valueEntered(a.minutes)){const signed=((+a.minutes)-pmin)/pmin;metrics.push({key:'time',label:'Thời gian',signed,abs:Math.abs(signed),actual:+a.minutes,plan:pmin,unit:'phút'})}
 if(!metrics.length)return{level:'done',className:'done',maxDeviation:0,metrics:[],message:'Không đủ dữ liệu KH/TT để tính sai lệch.'};
 const worst=metrics.reduce((a,b)=>b.abs>a.abs?b:a,metrics[0]);const x=worst.abs;
 let level='done',className='done',label='Đạt kế hoạch';
 if(x>0.80){level='over80';className='varianceOver';label='Lệch rất lớn >80%'}
 else if(x>0.50){level='50to80';className='variance80';label='Lệch lớn 50–80%'}
 else if(x>0.30){level='30to50';className='variance50';label='Lệch vừa 30–50%'}
 else if(x>0.10){level='10to30';className='variance30';label='Lệch nhẹ 10–30%'}
 const bits=metrics.map(m=>`${m.label} ${m.signed>=0?'+':''}${Math.round(m.signed*100)}%`).join(' · ');
 return{level,className,label,maxDeviation:x,metrics,worst,message:bits};
}
function varianceNotice(d){const v=completionVariance(d);if(!v||v.className==='done')return'';return `<div class="variance-notice ${v.className}">⚠ <b>${escapeHtml(v.label)}:</b> ${escapeHtml(v.message)} · lấy mức lệch lớn hơn giữa cự ly và thời gian.</div>`}
function getStatus(item,date){
 if(item.actual?.status==='missed')return['Không tập','skipped'];
 if(item.actual){const v=completionVariance(item);if(!v||v.className==='done')return['Đạt kế hoạch · ±10%','done'];return[v.label,v.className]}
 const today=ymd(new Date());if(date&&date<today)return['Quá hạn · chưa nhập','overdue'];return['Kế hoạch','planned'];
}
function average(arr){const v=arr.filter(x=>Number.isFinite(+x)&&+x>0).map(Number);return v.length?v.reduce((a,b)=>a+b,0)/v.length:0}
function workoutIntensity(name,desc){const n=norm((name||'')+' '+(desc||''));if(/interval|tempo|threshold|vo2|max|nhanh|speed/.test(n))return'hard';if(/recovery|phuc hoi|walk|di bo/.test(n))return'walk';if(/long|dai/.test(n))return'work';return'easy'}
function workoutSegments(d){
 if(d.workoutStructure){const structured=flattenStructuredSegments(d.workoutStructure);if(structured.length)return structured.map(s=>({duration:s.duration,intensity:s.activity==='walk'?'walk':s.activity==='rest'?'rest':s.role==='warm'?'warm':s.role==='cool'?'cool':workoutIntensity(d.workoutName,s.label||''),label:s.label||s.activity||'RUN',activity:s.activity||'run',paceSec:s.paceSec||0,hrFrom:+s.hrFrom||0,hrTo:+s.hrTo||0,paceFrom:s.paceFrom||'',paceTo:s.paceTo||''}))}
 const text=String(d.description||'').replace(/\r/g,'');const segs=[];const add=(duration,intensity,label)=>{duration=+duration;if(duration>0)segs.push({duration,intensity,label,activity:intensity==='walk'?'walk':'run',paceSec:0})};
 for(const raw of text.split('\n')){const line=norm(raw);let m;
   if((m=line.match(/(?:khoi dong|warm\s*up|wu)\D*(\d+(?:[\.,]\d+)?)\s*phut/)))add(numVN(m[1]),'warm','WU');
   if((m=line.match(/(?:cool\s*down|tha long|cd)\D*(\d+(?:[\.,]\d+)?)\s*phut/)))add(numVN(m[1]),'cool','CD');
   const rep=line.match(/(?:lap lai\s*)?(\d+)\s*lan/);const run=line.match(/chay\D*(\d+(?:[\.,]\d+)?)\s*phut/);const walk=line.match(/(?:di bo|nghi|phuc hoi)\D*(\d+(?:[\.,]\d+)?)\s*phut/);
   if(run){const times=rep?Math.min(12,+rep[1]):1;for(let i=0;i<times;i++){add(numVN(run[1]),workoutIntensity(d.workoutName,raw),'RUN');if(walk)add(numVN(walk[1]),'walk','REC')}}
 }
 if(!segs.length&&+d.planMinutes>0)add(+d.planMinutes,workoutIntensity(d.workoutName,d.description),'RUN');return segs.slice(0,36)
}
function segmentTooltip(s){const parts=[s.label||'Đoạn',`${Math.round(s.duration*10)/10} phút`];if(s.paceFrom||s.paceTo)parts.push(`Pace ${s.paceFrom||'—'}–${s.paceTo||'—'}/km`);if(s.hrFrom||s.hrTo)parts.push(`HR ${s.hrFrom||'—'}–${s.hrTo||'—'} bpm`);return parts.join(' · ')}
function chartHtml(d){const segs=workoutSegments(d);if(!segs.length)return'<div class="chart-empty">Workout profile</div>';const total=segs.reduce((s,x)=>s+x.duration,0)||1;return segs.map(s=>`<div class="seg ${s.intensity}" title="${escapeHtml(segmentTooltip(s))}" style="flex:${Math.max(.35,s.duration/total*100)} 1 0;height:${segmentHeight(s)}%"></div>`).join('')}
function structureTargetSummary(d){if(!d.workoutStructure)return'';const segs=flattenStructuredSegments(d.workoutStructure);const p=[];const h=[];const wp=[];for(const s of segs){if(s.activity==='run'){const a=paceToSec(s.paceFrom),b=paceToSec(s.paceTo);if(a)p.push(a);if(b)p.push(b)}else if(s.activity==='walk'){const a=paceToSec(s.paceFrom),b=paceToSec(s.paceTo);if(a)wp.push(a);if(b)wp.push(b)}if(+s.hrFrom)h.push(+s.hrFrom);if(+s.hrTo)h.push(+s.hrTo)}const parts=[];if(p.length)parts.push(`<b>Pace chạy:</b> ${secToPace(Math.min(...p))}–${secToPace(Math.max(...p))}/km`);if(h.length)parts.push(`<b>HR:</b> ${Math.min(...h)}–${Math.max(...h)} bpm`);if(wp.length)parts.push(`<b>Pace đi bộ:</b> ${secToPace(Math.min(...wp))}–${secToPace(Math.max(...wp))}/km`);return parts.length?`<div class="target-summary">${parts.join(' · ')}</div>`:''}
function deltas(d){const a=d.actual;if(!a||a.status==='missed')return'';const dk=(+a.km||0)-(+d.planKm||0),dm=(+a.minutes||0)-(+d.planMinutes||0);const kClass=Math.abs(dk)<=Math.max(.5,(+d.planKm||0)*.1)?'delta-good':'delta-warn';const mClass=Math.abs(dm)<=Math.max(5,(+d.planMinutes||0)*.1)?'delta-good':'delta-warn';return `<div class="actual-compare"><span>TT <b>${a.km??'—'} km</b></span><span><b>${actualDurationLabel(a.minutes)}</b></span><span class="${kClass}">${dk>=0?'+':''}${dk.toFixed(2)} km</span><span class="${mClass}">${dm>=0?'+':''}${Math.round(dm)}′</span></div>`}
function locateDate(date){return T17Legacy.locateDateIn(db,date)}
function ensureDate(date){return T17Legacy.ensureDateIn(db,date)}
function defaultStep(activity='run',label='Chạy',mode='time',value=10){return{label,activity,mode,value,paceFrom:'',paceTo:'',hrFrom:'',hrTo:''}}
function newBuilderState(){return{version:1,warmup:defaultStep('run','Warm-up','time',10),groups:[{label:'Main set',repeats:1,steps:[defaultStep('run','Easy run','time',30)]}],cooldown:defaultStep('run','Cool-down','time',10)}}
function richStepHtml(s,role='main'){
 if(!s)return'';
 const activity=s.activity==='walk'?'walk':s.activity==='rest'?'rest':role==='warm'?'warm':role==='cool'?'cool':'run';
 const kind=activity==='walk'?'WALK':activity==='rest'?'REST':activity==='warm'?'WU':activity==='cool'?'CD':'RUN';
 const unit=s.mode==='distance'?'km':'phút';
 const paceTxt=(s.paceFrom||s.paceTo)?`${s.paceFrom||'—'}–${s.paceTo||'—'}/km`:'';
 const hrTxt=(s.hrFrom||s.hrTo)?`${s.hrFrom||'—'}–${s.hrTo||'—'} bpm`:'';
 return `<div class="rich-step ${activity}"><span class="rich-step-kind">${kind}</span><span class="rich-step-name">${escapeHtml(s.label||kind)}</span><span class="rich-step-metrics"><span class="rich-chip"><strong>${smartNum(s.value)}</strong> ${unit}</span>${paceTxt?`<span class="rich-chip">Pace <strong>${escapeHtml(paceTxt)}</strong></span>`:''}${hrTxt?`<span class="rich-chip">HR <strong>${escapeHtml(hrTxt)}</strong></span>`:''}</span></div>`;
}
function richStructureHtml(structure){
 if(!structure)return'';const parts=[];
 if(structure.warmup)parts.push(`<div class="rich-section warm"><div class="rich-section-title"><span class="rich-tag">WU</span> Khởi động</div>${richStepHtml(structure.warmup,'warm')}</div>`);
 for(const g of structure.groups||[]){const reps=Math.max(1,+g.repeats||1);parts.push(`<div class="rich-section main"><div class="rich-section-title"><span class="rich-tag">${reps}×</span> ${escapeHtml(g.label||'Main set')}</div>${(g.steps||[]).map(s=>richStepHtml(s,'main')).join('')}</div>`)}
 if(structure.cooldown)parts.push(`<div class="rich-section cool"><div class="rich-section-title"><span class="rich-tag">CD</span> Thả lỏng</div>${richStepHtml(structure.cooldown,'cool')}</div>`);
 return parts.length?`<div class="rich-workout-detail">${parts.join('')}</div>`:'';
}
function richWorkoutDescriptionHtml(item){
 if(item?.workoutStructure){const h=richStructureHtml(item.workoutStructure);if(h)return h}
 const lines=String(item?.description||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean).slice(0,4);
 return lines.length?`<div class="rich-workout-detail">${lines.map(x=>`<div class="rich-plain-row">${escapeHtml(x)}</div>`).join('')}</div>`:'';
}

function builderDescription(){return builderState?descriptionOf(builderState):''}
function builderTotals(){return builderState?totalsOf(builderState):{minutes:0,km:0,p:[],h:[]}}
function stepEditorHtml(s,scope,gi=-1,si=-1){const data=`data-scope="${scope}" data-group="${gi}" data-step="${si}"`;return `<div class="step-row"><div><label>Tên đoạn</label><input ${data} data-key="label" value="${escapeHtml(s.label||'')}" placeholder="Easy / Fast / Recovery" /></div><div><label>Hoạt động</label><select ${data} data-key="activity"><option value="run" ${s.activity==='run'?'selected':''}>Chạy</option><option value="walk" ${s.activity==='walk'?'selected':''}>Đi bộ</option><option value="rest" ${s.activity==='rest'?'selected':''}>Nghỉ</option></select></div><div><label>Đơn vị</label><select ${data} data-key="mode"><option value="time" ${s.mode!=='distance'?'selected':''}>Phút</option><option value="distance" ${s.mode==='distance'?'selected':''}>Km</option></select></div><div><label>Thời gian/Km</label><input ${data} data-key="value" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" placeholder="${s.mode==='distance'?'0,08':'1,5'}" title="Nhập phút hoặc km, hỗ trợ dấu phẩy và dấu chấm (ví dụ 0,08 km = 80 m)" value="${escapeHtml(String(s.value||'').replace('.',','))}" /></div><div><label>Pace nhanh</label><input ${data} data-key="paceFrom" value="${escapeHtml(s.paceFrom||'')}" placeholder="05:20" /></div><div><label>Pace chậm</label><input ${data} data-key="paceTo" value="${escapeHtml(s.paceTo||'')}" placeholder="05:45" /></div><div><label>HR min</label><input ${data} data-key="hrFrom" type="number" min="0" value="${escapeHtml(s.hrFrom||'')}" /></div><div><label>HR max</label><input ${data} data-key="hrTo" type="number" min="0" value="${escapeHtml(s.hrTo||'')}" /></div><button class="remove-step" type="button" data-action="remove-step" ${data} title="Xóa đoạn">×</button></div>`}
function renderBuilder(){if(!builderState)return;let html=`<div class="builder-section"><div class="builder-section-head"><strong>Warm-up</strong><small>Khởi động trước phần chính</small><span class="push"></span>${builderState.warmup?'<button type="button" data-action="remove-warmup">Bỏ warm-up</button>':'<button type="button" data-action="add-warmup">＋ Thêm warm-up</button>'}</div>${builderState.warmup?stepEditorHtml(builderState.warmup,'warmup'):'<div class="builder-empty">Không có warm-up.</div>'}</div>`;
 html+=`<div class="builder-section"><div class="builder-section-head"><strong>Các block chính / lặp lại</strong><small>Mỗi block có thể lặp nhiều lần; bên trong gồm nhiều tốc độ / HR khác nhau.</small><span class="push"></span><button type="button" data-action="add-group">＋ Thêm block</button></div>`;
 if(!(builderState.groups||[]).length)html+='<div class="builder-empty">Chưa có block chính.</div>';else builderState.groups.forEach((g,gi)=>{html+=`<div class="repeat-card"><div class="repeat-card-head"><input data-group-label="${gi}" value="${escapeHtml(g.label||'Main set')}" placeholder="Tên block"/><input class="repeat-count" data-group-repeats="${gi}" type="number" min="1" max="30" value="${Math.max(1,+g.repeats||1)}" title="Số lần lặp"/><button class="builder-inline-btn" type="button" data-action="add-step" data-group="${gi}">＋ Đoạn</button><button class="builder-inline-btn danger" type="button" data-action="remove-group" data-group="${gi}">Xóa block</button></div>${(g.steps||[]).map((s,si)=>stepEditorHtml(s,'group',gi,si)).join('')||'<div class="builder-empty">Block chưa có đoạn.</div>'}</div>`});html+='</div>';
 html+=`<div class="builder-section"><div class="builder-section-head"><strong>Cool-down</strong><small>Thả lỏng cuối bài</small><span class="push"></span>${builderState.cooldown?'<button type="button" data-action="remove-cooldown">Bỏ cool-down</button>':'<button type="button" data-action="add-cooldown">＋ Thêm cool-down</button>'}</div>${builderState.cooldown?stepEditorHtml(builderState.cooldown,'cooldown'):'<div class="builder-empty">Không có cool-down.</div>'}</div>`;
 builderContent.innerHTML=html;updateBuilderSummary()}
function updateBuilderSummary(){if(!builderState)return;const t=builderTotals();$('builderTotalMin').textContent=t.minutes?`${Math.round(t.minutes*100)/100} phút`:'—';$('builderTotalKm').textContent=t.km?`${Math.round(t.km*100)/100} km`:'—';$('builderPaceRange').textContent=t.p.length?`${secToPace(Math.min(...t.p))}–${secToPace(Math.max(...t.p))}/km`:'—';$('builderHrRange').textContent=t.h.length?`${Math.min(...t.h)}–${Math.max(...t.h)} bpm`:'—';builderPreview.innerHTML=richStructureHtml(builderState)||'<div class="rich-plain-row">Chưa có cấu trúc bài tập.</div>'}
function resolveBuilderStep(el){const scope=el.dataset.scope,gi=+el.dataset.group,si=+el.dataset.step;if(scope==='warmup')return builderState.warmup;if(scope==='cooldown')return builderState.cooldown;if(scope==='group')return builderState.groups?.[gi]?.steps?.[si];return null}
function parseBuilderNumber(raw){
 const str=String(raw??'').trim().replace(/\s/g,'').replace(',','.');
 if(!str)return{ok:true,value:0};
 if(!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(str))return{ok:false};
 const value=Number(str);
 return Number.isFinite(value)&&value>=0?{ok:true,value}:{ok:false};
}
function builderChange(e){
 const el=e.target;
 if(el.dataset.groupLabel!=null){builderState.groups[+el.dataset.groupLabel].label=el.value;updateBuilderSummary();return}
 if(el.dataset.groupRepeats!=null){builderState.groups[+el.dataset.groupRepeats].repeats=clamp(+el.value||1,1,30);updateBuilderSummary();return}
 if(!el.dataset.key)return;
 const step=resolveBuilderStep(el);if(!step)return;
 if(el.dataset.key==='value'){
   const parsed=parseBuilderNumber(el.value);
   el.classList.toggle('input-error',!parsed.ok);
   if(!parsed.ok)return;
   step.value=parsed.value;
 }else{
   step[el.dataset.key]=el.value;
   if(el.dataset.key==='mode'){
     const valueInput=el.closest('.step-row')?.querySelector('[data-key="value"]');
     if(valueInput)valueInput.placeholder=el.value==='distance'?'0,08':'1,5';
   }
 }
 updateBuilderSummary();
}
builderContent.addEventListener('input',builderChange);builderContent.addEventListener('change',builderChange);
builderContent.addEventListener('click',e=>{const b=e.target.closest('[data-action]');if(!b)return;const a=b.dataset.action,gi=+b.dataset.group,si=+b.dataset.step;if(a==='add-warmup')builderState.warmup=defaultStep('run','Warm-up','time',10);if(a==='remove-warmup')builderState.warmup=null;if(a==='add-cooldown')builderState.cooldown=defaultStep('run','Cool-down','time',10);if(a==='remove-cooldown')builderState.cooldown=null;if(a==='add-group')builderState.groups.push({label:'Main set',repeats:2,steps:[defaultStep('run','Fast','time',5),defaultStep('walk','Recovery','time',1.5)]});if(a==='remove-group')builderState.groups.splice(gi,1);if(a==='add-step')builderState.groups[gi].steps.push(defaultStep('run','Run','time',5));if(a==='remove-step'){if(b.dataset.scope==='warmup')builderState.warmup=null;else if(b.dataset.scope==='cooldown')builderState.cooldown=null;else if(b.dataset.scope==='group')builderState.groups[gi].steps.splice(si,1)}renderBuilder()});
function openBuilder(date='',editRef=null,preset=null){
 date=date||ymd(new Date());
 builderEditing=editRef?{...editRef,id:db.weeks[editRef.wi]?.days?.[editRef.di]?.workouts?.[editRef.ii]?.id}:null;
 let item=null;
 if(editRef){const day=db.weeks[editRef.wi]?.days?.[editRef.di];item=day?.workouts?.[editRef.ii]||null;if(day)date=day.date}
 const src=item||preset||null;
 builderState=src?.workoutStructure?deepClone(src.workoutStructure):newBuilderState();
 builderDate.value=date;
 builderName.value=item?.workoutName||preset?.name||'';
 builderType.value=['Easy','Recovery','Long run','Tempo','Threshold','Interval','VO2max','Custom'].includes(src?.workoutType)?src.workoutType:'Custom';
 if(!src?.workoutType&&src?.workoutName){const n=norm(src.workoutName);builderType.value=/recovery|phuc hoi/.test(n)?'Recovery':/long|dai/.test(n)?'Long run':/tempo/.test(n)?'Tempo':/threshold/.test(n)?'Threshold':/interval/.test(n)?'Interval':/vo2/.test(n)?'VO2max':/easy/.test(n)?'Easy':'Custom'}
 builderNote.value=src?.planNote||'';
 $('builderTitle').textContent=editRef?'Sửa bài tập':'Thêm bài tập mới';
 $('builderMeta').textContent=`${fmtDate(date)} · Warm-up / block lặp / Cool-down · pace & HR mục tiêu`;
 deletePlan.style.display=editRef?'inline-block':'none';
 renderBuilder();
 builderModal.classList.add('show');
}
function closeBuilder(){builderModal.classList.remove('show');builderEditing=null;builderState=null}
function validateBuilder(){if(builderContent.querySelector('input[data-key="value"].input-error'))return 'Cự ly/thời gian có ký tự không hợp lệ. Hãy dùng số, ví dụ: 0,08 hoặc 0.08.';if(!builderDate.value)return'Chưa chọn ngày tập.';if(!builderName.value.trim())return'Chưa nhập tên bài tập.';const segs=flattenStructuredSegments(builderState);if(!segs.length)return'Bài tập cần có ít nhất một đoạn có thời gian hoặc quãng đường.';for(const s of segs){if((s.paceFrom&&!paceToSec(s.paceFrom))||(s.paceTo&&!paceToSec(s.paceTo)))return`Pace của đoạn “${s.label||'không tên'}” chưa đúng dạng mm:ss.`;if(paceToSec(s.paceFrom)&&paceToSec(s.paceTo)&&paceToSec(s.paceFrom)>paceToSec(s.paceTo))return`Ở đoạn “${s.label||'không tên'}”, Pace nhanh phải nhỏ hơn hoặc bằng Pace chậm.`}return''}
builderForm.onsubmit=e=>{
 e.preventDefault();
 const err=validateBuilder();if(err)return alert(err);
 const date=builderDate.value;
 const t=builderTotals();
 const fields={workoutName:builderName.value.trim(),workoutType:builderType.value,workoutStructure:deepClone(builderState),planMinutes:t.minutes?Math.round(t.minutes*10000)/10000:'',planKm:t.km?Math.round(t.km*1000)/1000:'',description:cleanDescription(builderDescription()),planNote:builderNote.value.trim()};
 if(builderEditing)builderEditing=resolveRef(builderEditing)||{wi:-1,di:-1,ii:-1};
 if(builderEditing){
   const oldDay=db.weeks[builderEditing.wi]?.days?.[builderEditing.di];
   const oldItem=oldDay?.workouts?.[builderEditing.ii];
   if(!oldDay||!oldItem){toast('Bài tập không còn tồn tại, có thể đã bị xóa.');closeBuilder();render();return}
   if(oldDay.date!==date){
     oldDay.workouts.splice(builderEditing.ii,1);
     const target=ensureDate(date);
     target.d.workouts=target.d.workouts||[];
     target.d.workouts.push({...oldItem,...fields});
     currentWeek=target.wi;
   }else{
     Object.assign(oldItem,fields);
     currentWeek=builderEditing.wi;
   }
 }else{
   const target=ensureDate(date);
   target.d.workouts=target.d.workouts||[];
   target.d.workouts.push({id:genId(),...fields,actual:null});
   currentWeek=target.wi;
 }
 saveDb();closeBuilder();render();refreshViews();toast('Đã lưu bài tập');
};
function deletePlanByRef(ref,closeAfter=false){
 ref=resolveRef(ref);
 if(!ref){if(closeAfter)closeBuilder();return}
 const day=db.weeks[ref.wi]?.days?.[ref.di];const item=day?.workouts?.[ref.ii];
 if(!day||!item){if(closeAfter)closeBuilder();return}
 if(!confirm(`Xóa bài "${item.workoutName||'bài tập'}" ngày ${fmtDate(day.date)}?${item.actual?'\nKết quả thực tế của bài này sẽ bị xóa theo.':''}`))return;
 day.workouts.splice(ref.ii,1);saveDb();currentWeek=ref.wi;if(closeAfter)closeBuilder();render();refreshViews();toast('Đã xóa bài tập');
}
function moveWorkoutToDate(ref,newDate){
 const day=db.weeks[ref.wi]?.days?.[ref.di];const item=day?.workouts?.[ref.ii];
 if(!day||!item||!newDate)return false;
 if(day.date===newDate)return true;
 day.workouts.splice(ref.ii,1);
 const target=ensureDate(newDate);
 target.d.workouts=target.d.workouts||[];
 target.d.workouts.push(item);
 currentWeek=target.wi;
 saveDb();
 return true;
}
function copyWorkoutToDate(item,newDate){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(newDate))return null;
 const target=ensureDate(newDate);
 target.d.workouts=target.d.workouts||[];
 target.d.workouts.push({...deepClone(item),id:genId(),actual:null});
 return target.wi;
}
function copyWorkoutToDates(item,dates){
 let wi=null,count=0;
 for(const dt of dates){const r=copyWorkoutToDate(item,dt);if(r!=null){wi=r;count++}}
 if(count){saveDb();if(wi!=null)currentWeek=wi}
 return count;
}
cancelBuilder.onclick=closeBuilder;builderModal.onclick=e=>{if(e.target===builderModal)closeBuilder()};deletePlan.onclick=()=>deletePlanByRef(builderEditing,true);
saveAsTemplateBtn.onclick=async()=>{
 const err=validateBuilder();if(err)return alert(err);
 const name=(await T17UI.uiPrompt({title:'Lưu làm mẫu',message:'Mẫu được lưu vào Thư viện bài tập',value:builderName.value.trim()||'Mẫu bài tập'})||'').trim();
 if(!name)return;
 const t=builderTotals();
 db.templates=db.templates||[];
 const tpl={name,workoutType:builderType.value,workoutStructure:deepClone(builderState),planKm:t.km?Math.round(t.km*1000)/1000:'',planMinutes:t.minutes?Math.round(t.minutes*10000)/10000:'',description:cleanDescription(builderDescription()),planNote:builderNote.value.trim(),savedAt:new Date().toISOString()};
 const exists=db.templates.findIndex(x=>norm(x.name)===norm(name));
 if(exists>=0){if(!confirm(`Thư viện đã có mẫu “${name}”. Cập nhật mẫu hiện có bằng cấu trúc đang mở?`))return;db.templates[exists]={...db.templates[exists],...tpl,id:db.templates[exists].id||genId('tpl')};saveDb();toast(`Đã cập nhật mẫu "${name}"`);return}
 db.templates.push({id:genId('tpl'),...tpl});
 saveDb();toast(`Đã lưu mẫu "${name}"`);
};
newWorkoutBtn.onclick=()=>openBuilder();railNewWorkout.onclick=()=>openBuilder();

function templateSummary(t){const parts=[];if(t.planKm)parts.push(`${t.planKm} km`);if(t.planMinutes)parts.push(`${t.planMinutes} phút`);return parts.join(' · ')||'—'}
function templateToPlan(t){return{workoutName:t.name||'Running workout',workoutType:t.workoutType||'Custom',planKm:t.planKm??'',planMinutes:t.planMinutes??'',description:t.description||'',planNote:t.planNote||'',workoutStructure:t.workoutStructure?deepClone(t.workoutStructure):null,actual:null}}
function addTemplateToDate(t,date){
 if(!date||!/^\d{4}-\d{2}-\d{2}$/.test(date)){alert('Hãy chọn ngày muốn thêm bài tập.');return false}
 const target=ensureDate(date),rec=templateToPlan(t),dst=target.d;dst.workouts=dst.workouts||[];
 const dup=dst.workouts.some(it=>samePlanRecord(it,rec));
 if(dup&&!confirm(`Ngày ${fmtDate(date)} đã có một bài giống mẫu “${t.name}”. Vẫn thêm thêm một bản nữa?`))return false;
 addWorkoutFromRecord(dst,rec);saveDb();currentWeek=target.wi;render();refreshViews();toast(`Đã thêm “${t.name}” vào ${fmtDate(date,true)}`);return true;
}
function renderLibrary(){
 const list=$('libraryList');const templates=db.templates||[];const q=norm(librarySearch?.value||'');const type=libraryType?.value||'';
 const rows=templates.map((t,ti)=>({t,ti})).filter(({t})=>{if(type&&(t.workoutType||'Custom')!==type)return false;if(q){const hay=norm((t.name||'')+' '+(t.workoutType||'')+' '+(t.description||'')+' '+(t.planNote||''));if(!hay.includes(q))return false}return true});
 if(libraryCount)libraryCount.textContent=`${rows.length} / ${templates.length} mẫu`;
 if(!rows.length){list.innerHTML=`<div class="lib-empty" style="grid-column:1/-1">${templates.length?'Không có mẫu nào khớp bộ lọc.':'Chưa có mẫu bài tập nào. Tạo bài tập rồi bấm “💾 Lưu làm mẫu” để thêm vào đây.'}</div>`;return}
 list.innerHTML=rows.map(({t,ti})=>{const plan=templateToPlan(t);return `<div class="lib-card"><div class="lib-card-head"><div class="lib-card-title">${escapeHtml(t.name)}</div><span class="lib-type-badge">${escapeHtml(t.workoutType||'Custom')}</span></div><div class="lib-meta2">${escapeHtml(templateSummary(t))}${t.savedAt?` · lưu ${escapeHtml(fmtDate(String(t.savedAt).slice(0,10),true))}`:''}</div><div class="lib-profile">${chartHtml(plan)}</div><div class="lib-preview">${richWorkoutDescriptionHtml(plan)}</div><div class="lib-actions2"><button type="button" class="primary" data-add-tpl="${ti}">＋ Thêm vào lịch</button><button type="button" data-use-tpl="${ti}">✎ Chỉnh trước khi dùng</button><button type="button" data-rename-tpl="${ti}">Đổi tên</button><button type="button" class="danger" data-del-tpl="${ti}">Xóa</button></div></div>`}).join('');
 list.querySelectorAll('[data-add-tpl]').forEach(x=>x.onclick=()=>{const t=templates[+x.dataset.addTpl];if(t)addTemplateToDate(t,libraryDate?.value||ymd(new Date()))});
 list.querySelectorAll('[data-use-tpl]').forEach(x=>x.onclick=()=>{const t=templates[+x.dataset.useTpl];if(!t)return;const dt=libraryDate?.value||ymd(new Date());closeLibraryModal();openBuilder(dt,null,t)});
 list.querySelectorAll('[data-rename-tpl]').forEach(x=>x.onclick=async()=>{const idx=+x.dataset.renameTpl,t=templates[idx];if(!t)return;const name=(await T17UI.uiPrompt({title:'Đổi tên mẫu',value:t.name})||'').trim();if(!name||name===t.name)return;const dup=templates.some((z,zi)=>zi!==idx&&norm(z.name)===norm(name));if(dup)return alert('Đã có mẫu khác cùng tên. Hãy dùng tên khác.');t.name=name;t.savedAt=new Date().toISOString();saveDb();renderLibrary();toast('Đã đổi tên mẫu')});
 list.querySelectorAll('[data-del-tpl]').forEach(x=>x.onclick=()=>{const idx=+x.dataset.delTpl,t=templates[idx];if(!t)return;if(!confirm(`Xóa mẫu "${t.name}" khỏi thư viện?`))return;db.templates.splice(idx,1);saveDb();renderLibrary();toast('Đã xóa mẫu')});
}
function openLibraryModal(date=''){if(libraryDate)libraryDate.value=date||libraryDate.value||ymd(new Date());renderLibrary();$('libraryModal').classList.add('show')}
function closeLibraryModal(){$('libraryModal').classList.remove('show')}
$('closeLibrary').onclick=closeLibraryModal;$('libraryModal').onclick=e=>{if(e.target===$('libraryModal'))closeLibraryModal()};
libraryBtn.onclick=()=>openLibraryModal();railLibrary.onclick=()=>openLibraryModal();
if(librarySearch)librarySearch.addEventListener('input',renderLibrary);if(libraryType)libraryType.addEventListener('change',renderLibrary);if(libraryDate)libraryDate.addEventListener('change',()=>{});if(libraryCreateBtn)libraryCreateBtn.onclick=()=>{const dt=libraryDate?.value||ymd(new Date());closeLibraryModal();openBuilder(dt)};

/** Nhãn điểm tải trên thẻ bài: TT (kèm cách tính) hoặc KH dự kiến. */
function loadChipHtml(item,date){
 const prof=db.profile||{};
 if(item.actual&&item.actual.status!=='missed'){const r=T17Load.actualLoad(item,prof);if(!r.load)return'';return `<div class="load-chip" title="Điểm tải (TSS): 100 = 60 phút đúng ngưỡng · tính theo ${escapeHtml(T17Load.METHOD_LABEL[r.method]||'')}">Tải <b>${Math.round(r.load)}</b> <span>${escapeHtml(T17Load.METHOD_LABEL[r.method]||'')}</span></div>`}
 if(item.fitStandalone||item.actual)return'';
 const pl=T17Load.plannedLoad(item,prof);return pl?`<div class="load-chip plan" title="Điểm tải dự kiến theo kế hoạch">Tải KH ~<b>${Math.round(pl)}</b></div>`:'';
}
/** Xuất bài có cấu trúc thành Workout FIT để copy vào GARMIN\NewFiles. */
async function exportGarminWorkout(name,structure){
 if(!structure)return alert('Bài này chưa có cấu trúc (warm-up / block / cool-down). Hãy sửa bài bằng Workout Builder trước.');
 let bytes;try{bytes=T17FitWorkout.encodeWorkout({name:name||'T17 Workout',structure})}catch(e){return alert('Không xuất được: '+(e.message||e))}
 const file=T17FitWorkout.safeFileName(name)+'.fit';
 const p=await saveBlob(new Blob([bytes],{type:'application/octet-stream'}),file);
 if(p)toast('Đã xuất '+file+' — cắm đồng hồ qua USB, copy file vào thư mục GARMIN\\NewFiles');
}
function workoutCardHtml(item,date,wi,di,ii){
 const [baseStatus,cls]=getStatus(item,date),a=item.actual;
 const st=item.fitStandalone&&a?'KẾT QUẢ CHƯA GHÉP — KÉO VÀO BÀI KH':baseStatus;
 const metric=a&&a.status!=='missed'
   ?`<div class="metric-strip"><div class="metric-strip-title"><span>Daily metrics</span><span>Actual</span></div><div class="metric-mini"><div><span>RPE</span><b>${a.fatigue||'—'}</b></div><div><span>HR avg</span><b>${a.avgHr||'—'}</b></div><div><span>kcal</span><b>${a.calories||'—'}</b></div></div></div>`
   :`<div class="metric-strip"><div class="metric-strip-title"><span>Daily metrics</span><span>${cls==='missed'?'No data':'Plan'}</span></div><div class="metric-placeholder">${item.planKm||'—'} km · ${item.planMinutes||'—'} phút</div></div>`;
 const isFitStandalone=!!item.fitStandalone&&!!item.actual;
 const detailHtml=isFitStandalone?'':richWorkoutDescriptionHtml(item);
 const fitAttachBox=isFitStandalone?`<div class="fit-file-hint">📥 Kết quả đang nằm trong ngày chạy · Kéo thả thẻ tím lên bài kế hoạch cần ghép. Trên điện thoại sử dụng nút bên dưới.</div><button type="button" class="fit-attach-card-btn" data-fit-attach-wi="${wi}" data-fit-attach-di="${di}" data-fit-attach-ii="${ii}">⇢ Ghép kết quả vào bài kế hoạch</button>`:'';
 const aPace=pace(a?.km,a?.minutes),pPace=pace(item.planKm,item.planMinutes);
 return `<article class="workout-card ${cls}${isFitStandalone?' fit-standalone':''}" data-fit-standalone="${isFitStandalone?'1':'0'}" draggable="true" data-open-wi="${wi}" data-open-di="${di}" data-open-ii="${ii}"><div class="statusbar"></div><div class="card-inner">${metric}<div class="workout-top"><div class="sport-icon">🏃</div><div class="workout-title">${escapeHtml(item.workoutName||'Running workout')}</div><div class="workout-tools"><button class="workout-edit" type="button" data-edit-wi="${wi}" data-edit-di="${di}" data-edit-ii="${ii}" title="Sửa bài tập">✎</button><button class="workout-copy" type="button" data-copy-wi="${wi}" data-copy-di="${di}" data-copy-ii="${ii}" title="Copy bài tập sang ngày khác">⧉</button>${item.workoutStructure&&!isFitStandalone?`<button class="workout-garmin" type="button" data-garmin-wi="${wi}" data-garmin-di="${di}" data-garmin-ii="${ii}" title="Xuất bài cho đồng hồ Garmin (.fit)">⌚</button>`:''}<button class="workout-delete" type="button" data-del-wi="${wi}" data-del-di="${di}" data-del-ii="${ii}" title="Xóa bài tập">⌫</button><button class="workout-menu" type="button" data-menu-wi="${wi}" data-menu-di="${di}" data-menu-ii="${ii}" title="Nhập / sửa kết quả">⋮</button></div></div><div class="status-label">${st}</div><div class="key-line"><strong>${a&&a.status!=='missed'?actualDurationLabel(a.minutes):(item.planMinutes||'—')}${a&&a.status!=='missed'?'':' phút'}</strong><span>${a&&a.status!=='missed'?'TT':'KH'}</span><strong>${a&&a.status!=='missed'?(a.km||'—'):(item.planKm||'—')} km</strong><span>${aPace||pPace||''}</span></div>${structureTargetSummary(item)}${loadChipHtml(item,date)}${fitAttachBox}${detailHtml}${item.planNote?`<div class="plan-note-small">${escapeHtml(item.planNote)}</div>`:''}${isFitStandalone?'':sectionActualSummaryHtml(item)}${isFitStandalone?'':sectionComparisonSavedHtml(item)}${isFitStandalone?'':deltas(item)}${isFitStandalone?'':varianceNotice(item)}<div class="workout-chart">${chartHtml(item)}</div></div></article>`;
}
function renderDayCard(d,wi,di){
 const today=ymd(new Date()),isToday=d.date===today,isWeekend=di>=5;
 const items=d.workouts||[];
 const cardsHtml=items.length?items.map((it,ii)=>workoutCardHtml(it,d.date,wi,di,ii)).join(''):`<div class="workout-card rest"><div class="statusbar"></div><div class="rest-card"><span class="rest-symbol">—</span>Ngày nghỉ<div class="rest-actions"><button class="rest-create" type="button" data-create-date="${escapeHtml(d.date)}">＋ Tạo bài</button><button class="add-library-btn" type="button" data-library-date="${escapeHtml(d.date)}">📚 Thư viện</button></div></div></div>`;
 const moreBtn=items.length?`<div class="add-more-row"><button class="add-more-btn" type="button" data-create-date="${escapeHtml(d.date)}">＋ Tạo thêm</button><button class="add-library-btn" type="button" data-library-date="${escapeHtml(d.date)}">📚 Từ thư viện</button></div>`:'';
 return `<section class="day-col ${isToday?'today ':''}${isWeekend?'weekend':''}" data-daycol-date="${escapeHtml(d.date)}"><div class="cell-datebar ${isToday?'today':''}"><div class="cell-date"><b>${dayNum(d.date)||'—'}</b><span>${fmtDate(d.date,true)}</span></div>${isToday?'<span class="today-pill">Hôm nay</span>':''}</div>${cardsHtml}${moreBtn}</section>`;
}
function ensureWeekByMonday(mon){let week=db.weeks.find(w=>w.days?.[0]?.date===mon);if(!week){week={label:String(isoWeekNumber(mon)),days:Array.from({length:7},(_,i)=>blankDay(addDaysYmd(mon,i),i))};db.weeks.push(week);db.weeks.sort((a,b)=>String(a.days?.[0]?.date||'').localeCompare(String(b.days?.[0]?.date||'')))}return db.weeks.findIndex(w=>w.days?.[0]?.date===mon)}
function ensureVisibleWeeks(){if(!db.weeks.length){const mon=mondayYmd(ymd(new Date()));ensureWeekByMonday(mon);currentWeek=0}currentWeek=Math.max(0,Math.min(currentWeek,db.weeks.length-1));let lastMon=db.weeks[currentWeek]?.days?.[0]?.date||mondayYmd(ymd(new Date()));for(let i=1;i<visibleWeekCount;i++){const mon=addDaysYmd(lastMon,i*7);ensureWeekByMonday(mon)}currentWeek=db.weeks.findIndex(w=>w.days?.[0]?.date===lastMon);if(currentWeek<0)currentWeek=0}
function updateWeekSummary(w){
 const m=$('metrics');m.innerHTML='';
 const dates=w.days.filter(d=>d.date);
 $('weekTitle').textContent=`Tuần ${w.label}`;
 $('weekRange').textContent=dates.length?`${fmtDate(dates[0].date)} – ${fmtDate(dates[dates.length-1].date)} · kéo xuống để xem tuần kế tiếp`:'';
 const allItems=[];for(const d of w.days)for(const it of (d.workouts||[]))allItems.push(Object.assign({__date:d.date},it));
 const pkm=allItems.reduce((s,it)=>s+(+it.planKm||0),0);
 const akm=allItems.reduce((s,it)=>s+(+(it.actual?.km)||0),0);
 const pmin=allItems.reduce((s,it)=>s+(+it.planMinutes||0),0);
 const amin=allItems.reduce((s,it)=>s+(+(it.actual?.minutes)||0),0);
 const plannedItems=allItems.filter(it=>!it.fitStandalone);
 const planned=plannedItems.length;
 const done=plannedItems.filter(it=>it.actual&&it.actual.status!=='missed').length;
 const varianceClasses=['variance30','variance50','variance80','varianceOver'];
 const warnings=allItems.filter(it=>varianceClasses.includes(getStatus(it,it.__date)[1])).length;
 const skipped=allItems.filter(it=>getStatus(it,it.__date)[1]==='skipped').length;
 const overdue=allItems.filter(it=>getStatus(it,it.__date)[1]==='overdue').length;
 const hr=average(allItems.map(it=>it.actual?.avgHr));
 const rpe=average(allItems.map(it=>it.actual?.fatigue));
 const pct=planned?Math.round(done/planned*100):0;
 $('completionPct').textContent=pct+'%';$('completionText').textContent=`${done} / ${planned}`;$('completionRing').style.background=`conic-gradient(var(--green) ${pct*3.6}deg,#e8ecf1 0deg)`;
 [['Km KH',pkm.toFixed(2)],['Km thực tế',akm.toFixed(2)],['Phút KH',Math.round(pmin)],['Phút thực tế',Math.round(amin)],['HR TB',hr?Math.round(hr):'—'],['RPE TB',rpe?rpe.toFixed(1):'—'],['Lệch KH',warnings],['Không tập',skipped],['Quá hạn',overdue],['Pace TT',pace(akm,amin)||'—'],['Tải TT',Math.round(allItems.reduce((s,it)=>s+T17Load.actualLoad(it,db.profile).load,0))||'—'],['Tải KH',Math.round(allItems.filter(it=>!it.fitStandalone).reduce((s,it)=>s+T17Load.plannedLoad(it,db.profile),0))||'—']].forEach(([a,b])=>m.insertAdjacentHTML('beforeend',`<div class="sum-item"><span>${a}</span><b>${b}</b></div>`));
}
function render(opts={}){const cal=$('calendarWrap'),oldScroll=opts.preserveScroll?cal.scrollTop:0;ensureVisibleWeeks();const box=$('days'),heads=$('dayHeads');box.innerHTML='';heads.innerHTML=DAYS.map(x=>`<div class="day-head"><div><span class="dow">${x}</span></div></div>`).join('');currentWeek=Math.max(0,Math.min(currentWeek,db.weeks.length-1));updateWeekSummary(db.weeks[currentWeek]);const end=Math.min(db.weeks.length,currentWeek+visibleWeekCount);for(let wi=currentWeek;wi<end;wi++){const w=db.weeks[wi],dates=w.days.filter(d=>d.date);const block=document.createElement('div');block.className='week-block';block.dataset.weekIndex=wi;block.innerHTML=`<div class="week-bar ${wi===currentWeek?'selected':''}"><strong>Tuần ${escapeHtml(w.label)}</strong><span class="week-range">${dates.length?`${fmtDate(dates[0].date)} – ${fmtDate(dates[dates.length-1].date)}`:''}</span><button type="button" data-select-week="${wi}">${wi===currentWeek?'Đang tổng hợp':'Xem tổng quan'}</button></div><div class="week-row">${w.days.map((d,di)=>renderDayCard(d,wi,di)).join('')}</div>`;box.appendChild(block)}box.insertAdjacentHTML('beforeend','<div class="load-sentinel">Kéo xuống để tải thêm <b>4 tuần kế tiếp</b></div>');
 box.querySelectorAll('[data-open-wi]').forEach(x=>x.addEventListener('click',e=>{if(e.target.closest('[data-menu-wi]')||e.target.closest('[data-edit-wi]')||e.target.closest('[data-del-wi]')||e.target.closest('[data-copy-wi]')||e.target.closest('[data-garmin-wi]')||e.target.closest('[data-fit-attach-wi]'))return;openModal(+x.dataset.openWi,+x.dataset.openDi,+x.dataset.openIi)}));
 box.querySelectorAll('[data-menu-wi]').forEach(x=>x.onclick=e=>{e.stopPropagation();openModal(+x.dataset.menuWi,+x.dataset.menuDi,+x.dataset.menuIi)});
 box.querySelectorAll('[data-edit-wi]').forEach(x=>x.onclick=e=>{e.stopPropagation();const wi=+x.dataset.editWi,di=+x.dataset.editDi,ii=+x.dataset.editIi;const day=db.weeks[wi]?.days?.[di];if(day)openBuilder(day.date,{wi,di,ii})});
 box.querySelectorAll('[data-del-wi]').forEach(x=>x.onclick=e=>{e.stopPropagation();deletePlanByRef({wi:+x.dataset.delWi,di:+x.dataset.delDi,ii:+x.dataset.delIi})});
 box.querySelectorAll('[data-copy-wi]').forEach(x=>x.onclick=async e=>{e.stopPropagation();const wi=+x.dataset.copyWi,di=+x.dataset.copyDi,ii=+x.dataset.copyIi;const day=db.weeks[wi]?.days?.[di];const item=day?.workouts?.[ii];if(!day||!item)return;const dates=await T17UI.uiDates({title:`Copy “${item.workoutName||'bài tập'}”`,message:`Từ ngày ${fmtDate(day.date)} sang các ngày được chọn (chỉ copy kế hoạch, không copy kết quả)`,suggestions:[addDaysYmd(day.date,7)]});if(!dates)return;const count=copyWorkoutToDates(item,dates);if(count){render();refreshViews();toast(`Đã copy sang ${count} ngày`)}else toast('Không có ngày hợp lệ (định dạng YYYY-MM-DD)')});
 box.querySelectorAll('[data-fit-attach-wi]').forEach(b=>b.onclick=async e=>{e.stopPropagation();const wi=+b.dataset.fitAttachWi,di=+b.dataset.fitAttachDi,ii=+b.dataset.fitAttachIi;const src=db.weeks[wi]?.days?.[di]?.workouts?.[ii],date=db.weeks[wi]?.days?.[di]?.date;if(!src||!date)return;const candidates=(db.weeks[wi].days[di].workouts||[]).filter(x=>x!==src&&!x.fitStandalone);if(!candidates.length)return alert('Ngày này chưa có bài kế hoạch. Hãy tạo hoặc nhập bài kế hoạch trước khi ghép FIT.');const dst=await chooseFitTarget(candidates,date);if(!dst)return;window.RunPlanFITLinkStandalone?.({wi,di,ii},dst.id,date)});
 box.querySelectorAll('[data-garmin-wi]').forEach(x=>x.onclick=e=>{e.stopPropagation();const it=db.weeks[+x.dataset.garminWi]?.days?.[+x.dataset.garminDi]?.workouts?.[+x.dataset.garminIi];if(it)exportGarminWorkout(it.workoutName,it.workoutStructure)});
 box.querySelectorAll('[data-create-date]').forEach(x=>x.onclick=e=>{e.stopPropagation();openBuilder(x.dataset.createDate)});
 box.querySelectorAll('[data-library-date]').forEach(x=>x.onclick=e=>{e.stopPropagation();openLibraryModal(x.dataset.libraryDate)});
 box.querySelectorAll('[data-select-week]').forEach(x=>x.onclick=()=>{const wi=+x.dataset.selectWeek;if(Number.isFinite(wi)){currentWeek=wi;visibleWeekCount=Math.max(6,visibleWeekCount);render()}});
 if(opts.preserveScroll)requestAnimationFrame(()=>{cal.scrollTop=oldScroll})}

function actualSectionPlan(item){
 const st=item?.workoutStructure;if(!st)return[];const rows=[];let order=0;
 const add=(step,role,key,context='')=>{if(!step)return;const e=stepEstimate(step);if(!(e.minutes>0||e.km>0))return;rows.push({key,order:++order,role,context,label:step.label||({walk:'Đi bộ',rest:'Nghỉ'}[step.activity]||'Chạy'),activity:step.activity||'run',mode:step.mode||'time',value:+step.value||0,planMinutes:e.minutes||0,planKm:e.km||0,paceFrom:step.paceFrom||'',paceTo:step.paceTo||'',hrFrom:step.hrFrom||'',hrTo:step.hrTo||''})};
 add(st.warmup,'warm','warmup','Khởi động');
 (st.groups||[]).forEach((g,gi)=>{const reps=clamp(+g.repeats||1,1,30);for(let r=0;r<reps;r++)for(let si=0;si<(g.steps||[]).length;si++)add(g.steps[si],'main',`g${gi}-r${r}-s${si}`,reps>1?`${g.label||'Block'} · lần ${r+1}/${reps}`:(g.label||'Main set'))});
 add(st.cooldown,'cool','cooldown','Thả lỏng');return rows;
}
function secRoleBadge(row){const cls=row.activity==='walk'?'walk':row.activity==='rest'?'rest':row.role==='warm'?'warm':row.role==='cool'?'cool':'';const txt=row.activity==='walk'?'WALK':row.activity==='rest'?'REST':row.role==='warm'?'WU':row.role==='cool'?'CD':'RUN';return `<span class="sec-badge ${cls}">${txt}</span>`}
function secPlanText(row){const primary=row.mode==='distance'?`${row.value} km`:`${row.value} phút`;const est=[];if(row.mode==='distance'&&row.planMinutes>0)est.push(`≈ ${formatDurationClock(row.planMinutes)}`);if(row.mode!=='distance'&&row.planKm>0)est.push(`≈ ${Math.round(row.planKm*100)/100} km`);return `${primary}${est.length?`<span class="sec-sub">${est.join(' · ')}</span>`:''}`}
function secTargetText(row){const p=(row.paceFrom||row.paceTo)?`<b>${escapeHtml(row.paceFrom||'—')}–${escapeHtml(row.paceTo||'—')}/km</b>`:'';const h=(row.hrFrom||row.hrTo)?`<span class="sec-sub">HR ${escapeHtml(row.hrFrom||'—')}–${escapeHtml(row.hrTo||'—')} bpm</span>`:'';return p||h?`${p}${h}`:'—'}
function savedSectionMap(actual){const m=new Map();for(const s of actual?.segments||[])if(s?.key)m.set(s.key,s);return m}
function sectionPlanByTr(tr){const host=$('actualSectionsBody'),rows=host?host._planRows:null;const i=+tr.dataset.secIndex;return Array.isArray(rows)?rows[i]||null:null}
function sectionPlanPaceSec(row){if(!row)return 0;const a=paceToSec(row.paceFrom),b=paceToSec(row.paceTo);if(a&&b)return Math.round((a+b)/2);if(a||b)return a||b;if(+row.planKm>0&&+row.planMinutes>0)return Math.round(+row.planMinutes*60/+row.planKm);return 0}
function sectionInputMap(tr){return{time:tr.querySelector('.sec-time'),km:tr.querySelector('.sec-km'),pace:tr.querySelector('.sec-pace')}}
function setSectionAuto(input,value){if(!input)return;input.value=value==null?'':String(value);input.dataset.auto='1';input.classList.add('auto-filled');input.classList.remove('user-filled')}
function markSectionUser(input){if(!input)return;delete input.dataset.auto;input.classList.remove('auto-filled');input.classList.add('user-filled')}
function clearSectionRow(tr){const m=sectionInputMap(tr);for(const el of Object.values(m)){el.value='';delete el.dataset.auto;el.classList.remove('auto-filled','user-filled','input-error')}tr._manualOrder=[];tr.classList.remove('section-active')}
function sectionCurrentValues(tr){const m=sectionInputMap(tr),t=parseDurationInput(m.time.value),km=m.km.value===''?0:+m.km.value,psec=paceToSec(m.pace.value);m.time.classList.toggle('input-error',!t.ok);return{ok:t.ok,minutes:t.ok&&t.minutes!==''?+t.minutes:0,km:Number.isFinite(km)&&km>0?km:0,paceSec:psec||0,pace:psec?secToPace(psec):''}}
function rememberSectionManual(tr,source){const m=sectionInputMap(tr),el=m[source];tr._manualOrder=Array.isArray(tr._manualOrder)?tr._manualOrder:[];const has=el&&String(el.value||'').trim()!=='';tr._manualOrder=tr._manualOrder.filter(x=>x!==source);if(has){tr._manualOrder.push(source);if(tr._manualOrder.length>2)tr._manualOrder=tr._manualOrder.slice(-2);markSectionUser(el)}else{el?.classList.remove('user-filled');delete el?.dataset.auto}return tr._manualOrder}
function reconcileSectionRow(tr,source='',userEvent=false){const plan=sectionPlanByTr(tr),m=sectionInputMap(tr);if(!plan)return sectionCurrentValues(tr);const order=userEvent?rememberSectionManual(tr,source):(Array.isArray(tr._manualOrder)?tr._manualOrder:[]);
 if(userEvent&&order.length===0){clearSectionRow(tr);return{ok:true,minutes:0,km:0,paceSec:0,pace:''}}
 if(!order.length){const v=sectionCurrentValues(tr);tr.classList.toggle('section-active',v.minutes>0||v.km>0||v.paceSec>0);return v}
 const manual=new Set(order),raw=sectionCurrentValues(tr);let minutes=manual.has('time')?raw.minutes:0,dist=manual.has('km')?raw.km:0,ps=manual.has('pace')?raw.paceSec:0;const planPace=sectionPlanPaceSec(plan);const planDist=plan.mode==='distance'?(+plan.value||+plan.planKm||0):(+plan.planKm||0);const planTime=plan.mode!=='distance'?(+plan.value||+plan.planMinutes||0):(+plan.planMinutes||0);
 const hasT=manual.has('time')&&minutes>0,hasK=manual.has('km')&&dist>0,hasP=manual.has('pace')&&ps>0;const manualCount=[hasT,hasK,hasP].filter(Boolean).length;
 if(manualCount>=2){
   if(hasT&&hasK){ps=Math.round(minutes*60/dist)}
   else if(hasT&&hasP){dist=minutes*60/ps}
   else if(hasK&&hasP){minutes=dist*ps/60}
 }else if(hasT){
   if(plan.mode==='distance'&&planDist>0){dist=planDist;ps=Math.round(minutes*60/dist)}
   else if(planPace>0){ps=planPace;dist=minutes*60/ps}
   else if(planDist>0){dist=planDist;ps=Math.round(minutes*60/dist)}
 }else if(hasK){
   if(plan.mode!=='distance'&&planTime>0){minutes=planTime;ps=Math.round(minutes*60/dist)}
   else if(planPace>0){ps=planPace;minutes=dist*ps/60}
   else if(planTime>0){minutes=planTime;ps=Math.round(minutes*60/dist)}
 }else if(hasP){
   if(plan.mode==='distance'&&planDist>0){dist=planDist;minutes=dist*ps/60}
   else if(planTime>0){minutes=planTime;dist=minutes*60/ps}
   else if(planDist>0){dist=planDist;minutes=dist*ps/60}
 }
 if(!manual.has('time'))setSectionAuto(m.time,minutes>0?formatDurationClock(minutes):'');
 if(!manual.has('km'))setSectionAuto(m.km,dist>0?Math.round(dist*1000)/1000:'');
 if(!manual.has('pace'))setSectionAuto(m.pace,ps>0?secToPace(ps):'');
 if(manual.has('pace')&&ps>0)m.pace.value=secToPace(ps);
 tr.classList.add('section-active');return sectionCurrentValues(tr)}
function setSectionTotalsMode(active){if(active&&!sectionTotalsActive){manualTopKmSnapshot=actualKm.value;manualTopMinutesSnapshot=actualMinutes.value}if(!active&&sectionTotalsActive){actualKm.value=manualTopKmSnapshot;actualMinutes.value=manualTopMinutesSnapshot;calcPace()}sectionTotalsActive=active;for(const el of [actualKm,actualMinutes]){el.readOnly=active;el.classList.toggle('section-total-locked',active);if(active)el.title='Giá trị này đang được tính tự động từ các section chi tiết.';else el.removeAttribute('title')}}
function comparisonClassFromDeviation(pct){pct=Math.abs(+pct||0);if(pct<=10)return'good';if(pct<=30)return'v30';if(pct<=50)return'v50';if(pct<=80)return'v80';return'vover'}
function paceDeviationPct(planRow,actualPaceSec){if(!planRow||!(actualPaceSec>0))return null;const a=paceToSec(planRow.paceFrom),b=paceToSec(planRow.paceTo);let fast=0,slow=0;if(a&&b){fast=Math.min(a,b);slow=Math.max(a,b)}else if(a||b){fast=slow=a||b}else{const mid=sectionPlanPaceSec(planRow);fast=slow=mid}if(!(fast>0))return null;if(actualPaceSec>=fast&&actualPaceSec<=slow)return 0;const edge=actualPaceSec<fast?fast:slow;return Math.abs(actualPaceSec-edge)/edge*100}
function volumeComparison(planRow,actual){if(!planRow)return{label:'Khối lượng',plan:0,actual:0,ratio:null};if(planRow.mode==='distance'){const p=+planRow.value||+planRow.planKm||0,a=+actual.km||0;return{label:'Km',plan:p,actual:a,ratio:p>0&&a>0?a/p:null}}const p=+planRow.value||+planRow.planMinutes||0,a=+actual.minutes||0;return{label:'Phút',plan:p,actual:a,ratio:p>0&&a>0?a/p:null}}
function compareBarHeight(activity,paceSec){if(!(paceSec>0))return 0;return segmentHeight({activity:activity||'run',intensity:activity==='walk'?'walk':activity==='rest'?'rest':'easy',paceSec})}
function formatCompareVolume(v,label){if(!(v>0))return'—';if(label==='Km')return`${Math.round(v*1000)/1000}`;return formatDurationClock(v)}
/* Độ rộng cơ sở dùng một trục quy đổi gần với thời gian: section theo phút dùng trực tiếp phút; section theo km dùng km × pace mục tiêu. */
function sectionVisualSpan(planRow){if(!planRow)return 1;const psec=sectionPlanPaceSec(planRow);if(planRow.mode==='distance'){const km=+planRow.value||+planRow.planKm||0;if(km>0&&psec>0)return Math.max(.25,km*psec/60);if(km>0)return Math.max(.25,km*6.5)}const min=+planRow.value||+planRow.planMinutes||0;if(min>0)return Math.max(.25,min);const km=+planRow.planKm||0;if(km>0&&psec>0)return Math.max(.25,km*psec/60);return 1}
function compareSectionBaseWidth(planRow,compact=false){const span=sectionVisualSpan(planRow);return compact?clamp(2.5+span*.55,4,22):clamp(30+span*5.5,36,260)}
function compareOverlayGeometry(planRow,actual){const vol=volumeComparison(planRow,actual);const ratio=vol.ratio!=null?Math.max(.03,vol.ratio):null;const extent=ratio!=null?clamp(Math.max(1,ratio),1,1.8):1;return{vol,ratio,extent,planWidthPct:100/extent,actualWidthPct:ratio!=null?Math.min(ratio,1.8)/extent*100:0,containerScale:extent}}
function compareDeviationInfo(planRow,actualPace,volRatio,hasAny){const pd=paceDeviationPct(planRow,actualPace),vd=volRatio!=null?Math.abs((volRatio-1)*100):null,all=[];if(pd!=null)all.push(pd);if(vd!=null)all.push(vd);const dev=all.length?Math.max(...all):null;return{paceDev:pd,volumeDev:vd,overallDev:dev,cls:dev==null?'empty':comparisonClassFromDeviation(dev),hasAny}}
function renderSectionComparisonFromInputs(){const host=$('actualSectionsBody'),chart=$('actualSectionCompareChart'),sum=$('actualSectionCompareSummary');if(!host||!chart||!sum)return;const plans=host._planRows,trs=[...host.querySelectorAll('tr[data-sec-index]')];if(!Array.isArray(plans)||!plans.length||!trs.length){chart.innerHTML='<div class="section-compare-empty">Bài này chưa có cấu trúc section để so sánh.</div>';sum.innerHTML='<span>Không có section.</span>';return}let filled=0,inTarget=0,paceComparable=0,volumeComparable=0,volNear=0;const cols=trs.map((tr,i)=>{const p=plans[i],v=sectionRowValues(tr),hasAny=v.minutes>0||v.km>0||v.paceSec>0;if(hasAny)filled++;const planPace=sectionPlanPaceSec(p),actualPace=v.paceSec||((v.minutes>0&&v.km>0)?Math.round(v.minutes*60/v.km):0);const geo=compareOverlayGeometry(p,v),cmp=compareDeviationInfo(p,actualPace,geo.ratio,hasAny);if(cmp.paceDev!=null&&actualPace>0){paceComparable++;if(cmp.paceDev===0)inTarget++}if(geo.ratio!=null){volumeComparable++;if(Math.abs((geo.ratio-1)*100)<=10)volNear++}const pb=compareBarHeight(p.activity,planPace),ab=compareBarHeight(p.activity,actualPace);const baseW=compareSectionBaseWidth(p,false),colW=Math.round(baseW*geo.containerScale);const planPaceText=planPace?secToPace(planPace):'—',actualPaceText=actualPace?secToPace(actualPace):'—';let deltaText='Chưa nhập';if(cmp.overallDev!=null){deltaText=cmp.overallDev<=10?'Khớp tốt':`Lệch ${Math.round(cmp.overallDev)}%`}else if(hasAny)deltaText='Thiếu dữ liệu đối chiếu';const ratioPct=geo.ratio!=null?Math.round(geo.ratio*100):null;const title=`Section ${i+1}: ${p.label||''} | Pace KH ${planPaceText}/km | TT ${actualPaceText}/km${cmp.paceDev!=null?` | pace lệch ${Math.round(cmp.paceDev)}%`:''}${ratioPct!=null?` | khối lượng ${ratioPct}%`:''}`;const actualShape=hasAny&&actualPace>0?`<div class="compare-shape actual ${cmp.cls}" style="height:${ab||4}%;width:${geo.actualWidthPct}%"></div>`:(hasAny?`<div class="compare-shape actual empty" style="height:5%;width:${geo.actualWidthPct||8}%"></div>`:'');return `<div class="compare-col" style="width:${colW}px" title="${escapeHtml(title)}"><div class="compare-overlay"><div class="compare-shape plan" style="height:${pb||4}%;width:${geo.planWidthPct}%"></div>${actualShape}</div><div class="compare-index">S${i+1} · ${escapeHtml(String(p.activity||'run').toUpperCase())}</div><div class="compare-name">${escapeHtml(p.label||'Section')}</div><div class="compare-pace"><span>KH ${escapeHtml(planPaceText)}/km</span><b>TT ${escapeHtml(actualPaceText)}/km</b></div><div class="compare-delta ${cmp.cls}">${escapeHtml(deltaText)}</div><div class="compare-volume"><div class="compare-volume-label"><span>${geo.vol.label}</span><strong>${ratioPct!=null?ratioPct+'%':'—'}</strong></div><div class="compare-volume-label"><span>KH ${escapeHtml(formatCompareVolume(geo.vol.plan,geo.vol.label))}</span><span>TT ${escapeHtml(formatCompareVolume(geo.vol.actual,geo.vol.label))}</span></div><div class="compare-span-note">Độ rộng ≈ ${Math.round(sectionVisualSpan(p)*10)/10} phút quy đổi</div></div></div>`}).join('');chart.innerHTML=cols;const paceMatch=paceComparable?Math.round(inTarget/paceComparable*100):0,volMatch=volumeComparable?Math.round(volNear/volumeComparable*100):0;sum.innerHTML=`<span>Đã có dữ liệu <b>${filled}/${plans.length}</b> section</span><span>Pace trong target: <b class="${paceMatch>=80?'good':paceMatch>=50?'warn':''}">${paceComparable?`${inTarget}/${paceComparable} (${paceMatch}%)`:'—'}</b></span><span>Khối lượng ±10%: <b class="${volMatch>=80?'good':volMatch>=50?'warn':''}">${volumeComparable?`${volNear}/${volumeComparable} (${volMatch}%)`:'—'}</b></span>`}
function sectionComparisonSavedHtml(item){const segs=item?.actual?.segments;if(!Array.isArray(segs)||!segs.some(x=>+x.actualMinutes>0||+x.actualKm>0||x.actualPace))return'';const plans=actualSectionPlan(item);if(!plans.length)return'';const saved=new Map(segs.map((x,i)=>[x.key||`__${i}`,x]));const parts=plans.map((p,i)=>{const x=saved.get(p.key)||segs[i]||{};const actual={minutes:+x.actualMinutes||0,km:+x.actualKm||0},pp=sectionPlanPaceSec(p),ap=paceToSec(x.actualPace)||(actual.km>0&&actual.minutes>0?Math.round(actual.minutes*60/actual.km):0),hasAny=actual.minutes>0||actual.km>0||ap>0,geo=compareOverlayGeometry(p,actual),cmp=compareDeviationInfo(p,ap,geo.ratio,hasAny),ph=compareBarHeight(p.activity,pp),ah=compareBarHeight(p.activity,ap),baseW=compareSectionBaseWidth(p,true),w=Math.round(baseW*geo.containerScale);if(!hasAny&&!(pp>0))return'';return `<span class="card-compare-pair" style="width:${w}px" title="${escapeHtml(`S${i+1} ${p.label||''}: KH ${pp?secToPace(pp):'—'} / TT ${ap?secToPace(ap):'—'}${geo.ratio!=null?` · KL ${Math.round(geo.ratio*100)}%`:''}`)}"><i class="plan" style="height:${Math.max(2,ph*.23)}px;width:${geo.planWidthPct}%"></i>${hasAny?`<i class="actual ${cmp.cls}" style="height:${Math.max(2,ah*.23)}px;width:${geo.actualWidthPct}%"></i>`:''}</span>`}).join('');return parts?`<div class="card-section-compare"><span class="card-compare-label">KH↔TT</span>${parts}</div>`:''}
function renderActualSections(item){
 const host=$('actualSectionsBody'),count=$('actualSectionCount'),summary=$('actualSectionSummary');if(!host||!count||!summary)return;
 const rows=actualSectionPlan(item);count.textContent=`${rows.length} section`;
 if(!rows.length){host.innerHTML='<div class="section-empty">Bài này chưa có cấu trúc section. Bạn vẫn có thể nhập kết quả tổng ở phía trên.</div>';summary.innerHTML='<span>Không có section để nhập.</span>';setSectionTotalsMode(false);const cc=$('actualSectionCompareChart'),cs=$('actualSectionCompareSummary');if(cc)cc.innerHTML='<div class="section-compare-empty">Bài này chưa có cấu trúc section để so sánh.</div>';if(cs)cs.innerHTML='<span>Không có section.</span>';return}
 const saved=savedSectionMap(item.actual);
 host.innerHTML=`<table class="actual-section-table"><thead><tr><th>#</th><th>Section</th><th>Kế hoạch</th><th>Pace / HR mục tiêu</th><th>Thời gian TT</th><th>Km TT</th><th>Pace TT</th></tr></thead><tbody>${rows.map((r,i)=>{const s=saved.get(r.key)||{};const t=s.actualMinutes===''||s.actualMinutes==null?'':formatDurationClock(s.actualMinutes);const km=s.actualKm===''||s.actualKm==null?'':s.actualKm;const pc=s.actualPace||((+km>0&&+s.actualMinutes>0)?pace(km,s.actualMinutes).replace('/km',''):'');return `<tr class="section-${escapeHtml(r.activity)}" data-sec-index="${i}" data-sec-key="${escapeHtml(r.key)}"><td class="sec-order">${i+1}</td><td class="sec-name">${secRoleBadge(r)}<b>${escapeHtml(r.label)}</b><span class="sec-sub">${escapeHtml(r.context||'')}</span></td><td class="sec-plan">${secPlanText(r)}</td><td class="sec-target">${secTargetText(r)}</td><td><input class="sec-time" type="text" autocomplete="off" placeholder="10:05" value="${escapeHtml(t)}"><div class="sec-derived">mm:ss / h:mm:ss</div></td><td><input class="sec-km" type="number" min="0" step="0.001" inputmode="decimal" placeholder="km" value="${escapeHtml(km)}"><div class="sec-derived">Tự lấy KH nếu thiếu</div></td><td><input class="sec-pace" type="text" autocomplete="off" placeholder="6:00" value="${escapeHtml(pc)}"><div class="sec-derived">min/km · tự tính nếu thiếu</div></td></tr>`}).join('')}</tbody></table>`;
 host._planRows=rows;
 host.querySelectorAll('tr[data-sec-index]').forEach(tr=>{tr._manualOrder=[];const ti=tr.querySelector('.sec-time'),ki=tr.querySelector('.sec-km'),pi=tr.querySelector('.sec-pace');ti.addEventListener('input',()=>sectionRowChanged(tr,'time'));ki.addEventListener('input',()=>sectionRowChanged(tr,'km'));pi.addEventListener('input',()=>sectionRowChanged(tr,'pace'));ti.addEventListener('change',()=>sectionRowChanged(tr,'time'));ki.addEventListener('change',()=>sectionRowChanged(tr,'km'));pi.addEventListener('change',()=>sectionRowChanged(tr,'pace'));const v=sectionCurrentValues(tr);tr.classList.toggle('section-active',v.minutes>0||v.km>0||v.paceSec>0)});
 updateSectionSummary(true);
 renderSectionComparisonFromInputs();
}
function normalizePaceInput(v){const sec=paceToSec(String(v||'').replace(/\/km/ig,'').trim());return sec>0?secToPace(sec):''}
function sectionRowValues(tr){return sectionCurrentValues(tr)}
function sectionRowChanged(tr,source){reconcileSectionRow(tr,source,true);updateSectionSummary(true);renderSectionComparisonFromInputs()}
function updateSectionSummary(syncTop=true){const host=$('actualSectionsBody'),summary=$('actualSectionSummary');if(!host||!summary)return;const trs=[...host.querySelectorAll('tr[data-sec-index]')];if(!trs.length){summary.innerHTML='<span>Không có dữ liệu section.</span>';if(syncTop)setSectionTotalsMode(false);return}let tm=0,tk=0,hasT=false,hasK=false,filled=0;for(const tr of trs){const v=sectionRowValues(tr),hasAny=v.minutes>0||v.km>0||v.paceSec>0;if(!hasAny)continue;filled++;tr.classList.add('section-active');if(v.minutes>0){tm+=v.minutes;hasT=true}if(v.km>0){tk+=v.km;hasK=true}}const active=filled>0;summary.innerHTML=`<span>Đã nhập <b>${filled}/${trs.length}</b> section</span><span>Tổng thời gian: <b>${hasT?formatDurationClock(tm):'—'}</b></span><span>Tổng cự ly: <b>${hasK?(Math.round(tk*1000)/1000)+' km':'—'}</b></span><span>Pace tổng: <b>${hasT&&hasK?(pace(tk,tm)||'—'):'—'}</b></span>${active?'<span class="section-source">↳ Tổng được tính từ section</span>':''}`;if(syncTop){setSectionTotalsMode(active);if(active){actualMinutes.value=hasT?formatDurationClock(tm):'';actualKm.value=hasK?Math.round(tk*1000)/1000:'';calcPace()}}}
function collectActualSections(item){const host=$('actualSectionsBody'),plans=host?host._planRows:null;if(!host||!Array.isArray(plans)||!plans.length)return[];const out=[];host.querySelectorAll('tr[data-sec-index]').forEach(tr=>{const i=+tr.dataset.secIndex,p=plans[i];if(!p)return;const v=sectionRowValues(tr),hasAny=v.minutes>0||v.km>0||v.paceSec>0;out.push({key:p.key,label:p.label,activity:p.activity,role:p.role,context:p.context,planMinutes:p.planMinutes?Math.round(p.planMinutes*1000)/1000:'',planKm:p.planKm?Math.round(p.planKm*1000)/1000:'',targetPaceFrom:p.paceFrom||'',targetPaceTo:p.paceTo||'',targetHrFrom:p.hrFrom||'',targetHrTo:p.hrTo||'',actualMinutes:hasAny&&v.minutes>0?Math.round(v.minutes*1000000)/1000000:'',actualKm:hasAny&&v.km>0?Math.round(v.km*1000)/1000:'',actualPace:hasAny&&v.pace?v.pace:''})});return out}
function sectionActualSummaryHtml(item){const s=item?.actual?.segments;if(!Array.isArray(s)||!s.length)return'';const filled=s.filter(x=>+x.actualMinutes>0||+x.actualKm>0||x.actualPace).length;if(!filled)return'';return `<div class="section-actual-note">▦ <b>${filled}/${s.length} section</b> đã có kết quả chi tiết</div>`}

function openModal(wi,di,ii){editingKey={wi,di,ii,id:db.weeks[wi]?.days?.[di]?.workouts?.[ii]?.id};sectionTotalsActive=false;const d=db.weeks[wi].days[di],item=d.workouts[ii],a=item.actual||{};$('modalMeta').textContent=`${d.dow}, ${fmtDate(d.date)}${item.workoutName?' • '+item.workoutName:''} • KH ${item.planKm||'—'} km / ${item.planMinutes||'—'} phút`;actualKm.value=a.km??'';actualMinutes.value=(a.minutes===''||a.minutes==null)?'':formatDurationClock(a.minutes);manualTopKmSnapshot=actualKm.value;manualTopMinutesSnapshot=actualMinutes.value;fatigue.value=a.fatigue??'';calories.value=a.calories??'';avgHr.value=a.avgHr??'';actualNote.value=a.note??'';workoutStatus.value=a.status==='missed'?'missed':'done';actualKm.readOnly=false;actualMinutes.readOnly=false;actualKm.classList.remove('section-total-locked');actualMinutes.classList.remove('section-total-locked');actualMinutes.classList.remove('input-error','input-ok');actualMinutes.removeAttribute('title');renderActualSections(item);calcPace();$('detachActual').hidden=!item.actual||!!item.fitStandalone;modal.classList.add('show');if(window.RunPlanSavedFIT)window.RunPlanSavedFIT.show(item)}
function closeModal(){modal.classList.remove('show');editingKey=null;modal.querySelector('.actual-sheet')?.classList.remove('with-fit-data')}
function calcPace(){const parsed=parseDurationInput(actualMinutes.value);actualMinutes.classList.toggle('input-error',!parsed.ok);actualMinutes.classList.toggle('input-ok',parsed.ok&&actualMinutes.value.trim()!=='');if(!parsed.ok){actualMinutes.title=parsed.error||'Thời gian không hợp lệ';paceOut.value='Sai định dạng';return}actualMinutes.removeAttribute('title');paceOut.value=pace(actualKm.value,parsed.minutes)}actualKm.oninput=actualMinutes.oninput=calcPace;
function insertTimeToken(token){
 const el=actualMinutes;if(!el)return;el.focus();
 const start=Number.isFinite(el.selectionStart)?el.selectionStart:el.value.length;
 const end=Number.isFinite(el.selectionEnd)?el.selectionEnd:start;
 el.value=el.value.slice(0,start)+token+el.value.slice(end);
 const pos=start+token.length;try{el.setSelectionRange(pos,pos)}catch(e){}
 el.dispatchEvent(new Event('input',{bubbles:true}));
}
const timeQuickBar=$('timeQuickBar');
if(timeQuickBar){
 timeQuickBar.querySelectorAll('[data-time-token]').forEach(btn=>btn.addEventListener('click',()=>insertTimeToken(btn.dataset.timeToken||'')));
 timeQuickBar.querySelectorAll('[data-time-example]').forEach(btn=>btn.addEventListener('click',()=>{actualMinutes.value=btn.dataset.timeExample||'';actualMinutes.focus();actualMinutes.dispatchEvent(new Event('input',{bubbles:true}))}));
}

actualForm.onsubmit=e=>{e.preventDefault();editingKey=resolveRef(editingKey);if(!editingKey)return;const item=db.weeks[editingKey.wi].days[editingKey.di].workouts[editingKey.ii];if(!item)return;const segments=collectActualSections(item);const detailed=segments.filter(x=>+x.actualMinutes>0||+x.actualKm>0||x.actualPace);let finalKm='',finalMinutes='';if(detailed.length){const sm=detailed.reduce((a,x)=>a+(+x.actualMinutes||0),0),sk=detailed.reduce((a,x)=>a+(+x.actualKm||0),0);finalMinutes=sm>0?sm:'';finalKm=sk>0?Math.round(sk*1000)/1000:''}else{const parsedDuration=parseDurationInput(actualMinutes.value);if(!parsedDuration.ok){actualMinutes.classList.add('input-error');actualMinutes.focus();return alert('Thời gian thực tế chưa đúng định dạng.\n\nHãy nhập ví dụ: 66:30, 1:06:30, 66\'30" hoặc 1h06\'30".')}finalMinutes=parsedDuration.minutes===''?'':parsedDuration.minutes;finalKm=actualKm.value===''?'':+actualKm.value}item.actual={...(item.actual||{}),status:workoutStatus.value,km:finalKm,minutes:finalMinutes,fatigue:fatigue.value===''?'':+fatigue.value,calories:calories.value===''?'':+calories.value,avgHr:avgHr.value===''?'':+avgHr.value,note:actualNote.value.trim(),segments,savedAt:new Date().toISOString()};saveDb();closeModal();render();refreshViews();toast(workoutStatus.value==='missed'?'Đã đánh dấu không hoàn thành':detailed.length?'Đã lưu · tổng kết quả được tính từ section':'Đã lưu kết quả')};
cancelModal.onclick=closeModal;modal.onclick=e=>{if(e.target===modal)closeModal()};deleteActual.onclick=()=>{editingKey=resolveRef(editingKey);if(!editingKey)return;const item=db.weeks[editingKey.wi]?.days?.[editingKey.di]?.workouts?.[editingKey.ii];if(!item)return;item.actual=null;saveDb();closeModal();render();refreshViews();toast('Đã xóa kết quả')};

/* The actual result and its Garmin FIT metadata belong together. Unpairing preserves
 * raw FIT chart data but removes sections aligned to the OLD workout structure. */
function detachActualFromPlan(ref){
 const loc=db.weeks[ref?.wi]?.days?.[ref?.di],plan=loc?.workouts?.[ref?.ii];
 if(!loc||!plan||plan.fitStandalone||!plan.actual)return false;
 const a=plan.actual,source=a.fitImport?'Garmin FIT':'kết quả nhập tay';
 if(!confirm(`Tách ${source} khỏi bài “${plan.workoutName||'Bài chạy'}”?\n\n• Bài kế hoạch sẽ trở về trạng thái chưa có kết quả.\n• Kết quả được giữ thành thẻ tím riêng trong cùng ngày.\n• Các section đã ghép với bài cũ sẽ được xóa để tránh sai lệch; thông số tổng và dữ liệu FIT gốc vẫn còn.\n• Các thay đổi chưa bấm Lưu trong cửa sổ hiện tại sẽ không được giữ.`))return false;
 const original=JSON.stringify(db),unpaired=deepClone(a);
 unpaired.segments=[];
 if(unpaired.fitImport){
   unpaired.fitImport={...unpaired.fitImport,sectionMode:'none',unlinkedAt:new Date().toISOString(),unlinkedFromWorkoutId:plan.id,unlinkedFromWorkoutName:plan.workoutName||''};
 }
 const fileName=unpaired.fitImport?.innerName||unpaired.fitImport?.filename||'';
 const plainName=fileName.split(/[\\/]/).pop().replace(/\.(fit|zip)$/i,'');
 const card={id:genId(),fitStandalone:true,
   workoutName:unpaired.fitImport?'Garmin FIT · '+(plainName||'Hoạt động'):'Kết quả chưa ghép · '+(plan.workoutName||'Buổi chạy'),
   workoutType:'Custom',planKm:'',planMinutes:'',
   description:'Kết quả chưa ghép. Có thể kéo lên bài tập kế hoạch hoặc chọn nút Ghép kết quả vào bài kế hoạch.',
   planNote:'',workoutStructure:null,actual:unpaired};
 plan.actual=null;
 loc.workouts.splice(ref.ii+1,0,card);
 if(!saveDb()){db=JSON.parse(original);return false;}
 closeModal();render();refreshViews();toast('Đã tách kết quả thành thẻ tím; bài kế hoạch chưa có kết quả');
 return true;
}
$('detachActual').addEventListener('click',()=>{const r=resolveRef(editingKey);if(r)detachActualFromPlan({...r})});
prevWeek.onclick=()=>{if(!db.weeks.length)ensureVisibleWeeks();if(currentWeek<=0){const mon=addDaysYmd(db.weeks[0].days[0].date,-7);currentWeek=ensureWeekByMonday(mon)}else currentWeek--;visibleWeekCount=6;render()};nextWeek.onclick=()=>{if(!db.weeks.length)ensureVisibleWeeks();if(currentWeek>=db.weeks.length-1){const mon=addDaysYmd(db.weeks[currentWeek].days[0].date,7);ensureWeekByMonday(mon)}currentWeek++;visibleWeekCount=6;render()};todayBtn.onclick=()=>{const mon=mondayYmd(ymd(new Date()));currentWeek=ensureWeekByMonday(mon);visibleWeekCount=6;render();$('calendarWrap').scrollTop=0};
function triggerImport(){try{importFile.value='';importFile.click()}catch(e){alert('Không mở được trình chọn file.') }}importBtn.onclick=triggerImport;
importFile.addEventListener('change',async e=>{const file=e.target.files&&e.target.files[0];if(!file)return;const old=importBtn.textContent;importBtn.disabled=true;importBtn.textContent='Đang đọc…';try{await importExcel(file)}catch(err){console.error(err);alert('Import Excel lỗi: '+(err.message||err))}finally{importBtn.disabled=false;importBtn.textContent=old;e.target.value=''}});
function dateForExcel(s){if(!s)return'';const [y,m,d]=s.split('-');return `${d}/${m}/${y}`}
async function exportExcel(){const EXPORT_TITLE='Xuất Excel';
 if(!db.weeks.length)return toast('Chưa có dữ liệu');
 const range=await T17UI.uiDateRange({title:EXPORT_TITLE});if(!range)return;const {from,to}=range;
 const inRange=d=>d.date&&(!from||d.date>=from)&&(!to||d.date<=to);
 const weeks=db.weeks.filter(w=>w.days.some(d=>inRange(d)&&(d.workouts||[]).length>0));
 if(!weeks.length)return toast('Không có dữ liệu trong khoảng ngày đã chọn');
 const aoa=[['Tuần \\ Thứ',...DAYS]];
 const blocks=[];
 // v2.0: ngày có nhiều bài → thêm khối "Tuần N - bài k". Import Excel đọc lại được đủ các bài.
 for(const w of weeks){const maxN=Math.max(1,...w.days.map(d=>inRange(d)?(d.workouts||[]).length:0));for(let k=0;k<maxN;k++)blocks.push({w,k})}
 blocks.forEach(({w,k},bi)=>{
   const v=d=>inRange(d)&&!!(d.workouts||[])[k];
   const pw=d=>(d.workouts||[])[k]||{};
   aoa.push([k===0?w.label:`Tuần ${w.label} - bài ${k+1}`,...w.days.map(d=>v(d)?(pw(d).workoutName||''):'')]);
   aoa.push(['ngày',...w.days.map(d=>inRange(d)?dateForExcel(d.date):'')]);
   aoa.push(['Mô tả bài tập',...w.days.map(d=>v(d)?(pw(d).description||''):'')]);
   aoa.push(['Số km dự kiến',...w.days.map(d=>v(d)?(pw(d).planKm??''):'')]);
   aoa.push(['Số phút dự kiến',...w.days.map(d=>v(d)?(pw(d).planMinutes??''):'')]);
   aoa.push(['Ghi chú kế hoạch',...w.days.map(d=>v(d)?(pw(d).planNote||''):'')]);
   aoa.push(['Cấu trúc bài tập JSON',...w.days.map(d=>v(d)&&pw(d).workoutStructure?JSON.stringify(pw(d).workoutStructure):'')]);
   aoa.push(['Số bài trong ngày',...w.days.map(d=>inRange(d)&&k===0?String((d.workouts||[]).length||''):'')]);
   aoa.push(['Trạng thái thực tế',...w.days.map(d=>v(d)?(pw(d).actual?.status==='missed'?'Không hoàn thành':pw(d).actual?'Hoàn thành':''):'')]);
   aoa.push(['Số km thực tế',...w.days.map(d=>v(d)?(pw(d).actual?.km??''):'')]);
   aoa.push(['Số phút thực tế',...w.days.map(d=>v(d)?(pw(d).actual?.minutes??''):'')]);
   aoa.push(['Mệt mỏi RPE (1-10)',...w.days.map(d=>v(d)?(pw(d).actual?.fatigue??''):'')]);
   aoa.push(['Calo (kcal)',...w.days.map(d=>v(d)?(pw(d).actual?.calories??''):'')]);
   aoa.push(['Nhịp tim TB (bpm)',...w.days.map(d=>v(d)?(pw(d).actual?.avgHr??''):'')]);
   aoa.push(['Ghi chú thực tế',...w.days.map(d=>v(d)?(pw(d).actual?.note??''):'')]);
   aoa.push(['Pace thực tế',...w.days.map(d=>v(d)?pace(pw(d).actual?.km,pw(d).actual?.minutes):'')]);
   if(bi<blocks.length-1)aoa.push([]);
 });
 const blob=RunPlanXLSX.buildXlsxBlob(aoa,'Run tracker');
 saveBlob(blob,`T17_RunTracker_${from||'start'}_${to||'end'}.xlsx`);
 if(!T17Platform.isDesktop)toast('Đã tạo file Excel (đủ mọi bài trong ngày)');
}
exportBtn.onclick=exportExcel;
function clearData(){if(confirm('Xóa toàn bộ kế hoạch và kết quả của người dùng “'+T17Platform.activeUser().name+'”? (Người dùng khác không bị ảnh hưởng.) (Mẫu bài tập trong thư viện sẽ được giữ lại.)')){db={weeks:[],templates:db.templates||[],templatesSeeded:true};saveDb();render();toast('Đã xóa dữ liệu')}}clearBtn.onclick=clearData;$('clearSide').onclick=clearData;railClear.onclick=clearData;
function saveBlob(blob,name){return T17Platform.saveFile(blob,name).then(p=>{if(p&&T17Platform.isDesktop)toast('Đã lưu: '+p);return p}).catch(e=>{alert('Không lưu được file: '+(e.message||e));return''})}
function backup(){saveBlob(new Blob([JSON.stringify(T17Legacy.toBackup(db,APP_VERSION),null,2)],{type:'application/json'}),`T17_RunTracker_backup_${T17Platform.activeUserId()==='main'?'':T17Users.slug(T17Platform.activeUser().name)+'_'}${ymd(new Date())}.json`)}backupBtn.onclick=backup;$('backupSide').onclick=backup;
function triggerRestore(){try{restoreFile.value='';restoreFile.click()}catch(e){alert('Không mở được trình chọn file.')}}restoreBtn.onclick=triggerRestore;$('restoreSide').onclick=triggerRestore;
/** Khôi phục toàn bộ: nhận mọi định dạng sao lưu (RunPlan v1.x, T17 v2, localStorage dump, mảng tuần). */
function restoreFromData(data,sourceName=''){
 const kind=T17Legacy.detectKind(data);
 if(kind==='plan'||kind==='log')return mergeExportData(data,kind);
 if(!['backup','backup-wrapped','weeks'].includes(kind))throw new Error('File JSON không đúng định dạng sao lưu RunPlan / T17 RunTracker.');
 const {db:next,report}=loadDbFrom(data);
 if(!confirm(`Khôi phục toàn bộ dữ liệu từ ${sourceName||'file'}?\n\nFile chứa: ${T17Legacy.describeReport(report)}.\n\nDữ liệu hiện tại của người dùng “${T17Platform.activeUser().name}” sẽ bị GHI ĐÈ (người dùng khác không bị ảnh hưởng). Nên bấm "Sao lưu toàn bộ" trước nếu chưa chắc.`))return false;
 db=next;saveDb();currentWeek=findCurrentWeek();render();refreshViews();toast('Đã khôi phục: '+T17Legacy.describeReport(report));return true;
}
/** Gộp thêm file "Xuất bài tập" (plan) hoặc "Training Log" (log, có kèm kết quả). Không xoá dữ liệu cũ. */
function mergeExportData(data,kind){
 const days=T17Legacy.exportToDays(data);
 const res=T17Legacy.mergeDays(db,days,{withActual:kind==='log'});
 saveDb();currentWeek=findCurrentWeek();visibleWeekCount=Math.max(6,visibleWeekCount);render();refreshViews();
 toast(`Đã thêm ${res.added} bài${res.actualsAttached?` · gắn ${res.actualsAttached} kết quả`:''}${res.duplicates?` · ${res.duplicates} bài trùng được bỏ qua`:''}${res.invalid?` · ${res.invalid} mục không hợp lệ`:''}`);
 return true;
}
restoreFile.addEventListener('change',async e=>{try{const f=e.target.files&&e.target.files[0];if(!f)return;restoreFromData(T17Legacy.parseJsonText(await readFileText(f)),f.name)}catch(err){alert(err.message||err)}finally{e.target.value=''}});

function planExportRecord(item){return{workoutName:item.workoutName||'',workoutType:item.workoutType||'',planKm:item.planKm??'',planMinutes:item.planMinutes??'',description:item.description||'',planNote:item.planNote||'',workoutStructure:item.workoutStructure?deepClone(item.workoutStructure):null}}
async function exportPlanJson(){const EXPORT_TITLE='Xuất bài tập (JSON) để chia sẻ';
 if(!db.weeks.length)return toast('Chưa có dữ liệu');
 const range=await T17UI.uiDateRange({title:EXPORT_TITLE});if(!range)return;const {from,to}=range;
 const inRange=dt=>dt&&(!from||dt>=from)&&(!to||dt<=to);
 const days=[];
 for(const w of db.weeks)for(const d of w.days)if(inRange(d.date)&&(d.workouts||[]).length)days.push({date:d.date,dow:d.dow,workouts:d.workouts.map(planExportRecord)});
 if(!days.length)return toast('Không có bài tập trong khoảng ngày đã chọn');
 days.sort((a,b)=>a.date.localeCompare(b.date));
 const payload={format:'runplan-plan',version:1,exportedAt:new Date().toISOString(),days};
 saveBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),`RunPlan_KeHoach_${from||'start'}_${to||'end'}.json`);
 toast('Đã xuất file bài tập JSON — gửi file này cho người khác để họ Nhập vào và tập theo');
}
async function importPlanJson(file){
 if(!file)return;
 const data=T17Legacy.parseJsonText(await readFileText(file));
 const kind=T17Legacy.detectKind(data);
 if(kind==='plan'||kind==='log')return mergeExportData(data,kind);
 if(kind==='backup'||kind==='backup-wrapped'||kind==='weeks'){
   if(!confirm('Đây là file SAO LƯU TOÀN BỘ (khôi phục sẽ GHI ĐÈ dữ liệu hiện tại), không phải file bài tập để gộp thêm.\n\nTiếp tục khôi phục toàn bộ?'))return;
   return restoreFromData(data,file.name);
 }
 throw new Error('File JSON không đúng định dạng bài tập / Training Log / sao lưu của RunPlan.');
}
exportPlanBtn.onclick=exportPlanJson;
function triggerImportPlan(){try{importPlanFile.value='';importPlanFile.click()}catch(e){alert('Không mở được trình chọn file.')}}
importPlanBtn.onclick=triggerImportPlan;
importPlanFile.addEventListener('change',async e=>{const file=e.target.files&&e.target.files[0];if(!file)return;const old=importPlanBtn.textContent;importPlanBtn.disabled=true;importPlanBtn.textContent='Đang đọc…';try{await importPlanJson(file)}catch(err){console.error(err);alert('Nhập bài tập lỗi: '+(err.message||err))}finally{importPlanBtn.disabled=false;importPlanBtn.textContent=old;e.target.value=''}});

railData.onclick=()=>{const dm=$('dataMenu');dm.open=!dm.open};
document.addEventListener('click',e=>{const dm=$('dataMenu');if(!dm||!dm.open)return;if(dm.contains(e.target))return;if(e.target.closest('#railData'))return;dm.open=false});
$('dataMenu').querySelectorAll('.menu-panel button').forEach(b=>b.addEventListener('click',()=>{$('dataMenu').open=false}));

async function chooseFitTarget(candidates,date){
 if(!candidates.length)return null;
 if(candidates.length===1)return candidates[0];
 return T17UI.uiChoose({title:'Ghép kết quả vào bài nào?',message:'Ngày '+fmtDate(date)+' có '+candidates.length+' bài kế hoạch',options:candidates.map(x=>({label:x.workoutName||'Bài chạy',sub:[x.planKm?x.planKm+' km':'',x.planMinutes?x.planMinutes+' phút':'',x.actual?'đã có kết quả — sẽ hỏi ghi đè':''].filter(Boolean).join(' · '),value:x}))});
}
let dragRef=null;
const daysBox=$('days');
daysBox.addEventListener('dragstart',e=>{
 const card=e.target.closest('.workout-card[draggable="true"]');
 if(!card)return;
 dragRef={wi:+card.dataset.openWi,di:+card.dataset.openDi,ii:+card.dataset.openIi};
 card.classList.add('dragging');
 if(e.dataTransfer){try{e.dataTransfer.effectAllowed='copyMove';e.dataTransfer.setData('text/plain',JSON.stringify(dragRef))}catch(err){}}
});
daysBox.addEventListener('dragend',e=>{
 const card=e.target.closest('.workout-card');
 if(card)card.classList.remove('dragging');
 daysBox.querySelectorAll('.day-col.drag-over,.day-col.fit-day-drop').forEach(x=>x.classList.remove('drag-over','fit-day-drop'));
 daysBox.querySelectorAll('.workout-card.fit-drop-target').forEach(x=>x.classList.remove('fit-drop-target'));
 dragRef=null;
});
daysBox.addEventListener('dragover',e=>{
 const col=e.target.closest('.day-col');if(!col||!dragRef)return;
 e.preventDefault();
 const src=db.weeks[dragRef.wi]?.days?.[dragRef.di]?.workouts?.[dragRef.ii];
 const standalone=!!src?.fitStandalone&&!!src?.actual;
 if(e.dataTransfer)try{e.dataTransfer.dropEffect=standalone?'move':((e.ctrlKey||e.metaKey)?'copy':'move')}catch(err){}
 daysBox.querySelectorAll('.fit-drop-target').forEach(x=>x.classList.remove('fit-drop-target'));
 daysBox.querySelectorAll('.fit-day-drop').forEach(x=>x.classList.remove('fit-day-drop'));
 if(standalone){const planCard=e.target.closest('.workout-card[data-fit-standalone="0"]');if(planCard)planCard.classList.add('fit-drop-target');else col.classList.add('fit-day-drop')}
 else col.classList.add('drag-over');
});
daysBox.addEventListener('dragleave',e=>{
 const col=e.target.closest('.day-col');
 if(col&&!col.contains(e.relatedTarget))col.classList.remove('drag-over','fit-day-drop');
 daysBox.querySelectorAll('.fit-drop-target').forEach(x=>x.classList.remove('fit-drop-target'));
});
daysBox.addEventListener('drop',async e=>{
 const col=e.target.closest('.day-col');
 if(!col||!dragRef){return}
 e.preventDefault();
 col.classList.remove('drag-over');
 const newDate=col.dataset.daycolDate;
 const dropCard=e.target.closest('.workout-card[data-fit-standalone="0"]');
 const ref=dragRef;dragRef=null;
 daysBox.querySelectorAll('.fit-drop-target').forEach(x=>x.classList.remove('fit-drop-target'));
 daysBox.querySelectorAll('.fit-day-drop').forEach(x=>x.classList.remove('fit-day-drop'));
 if(!newDate)return;
 const day=db.weeks[ref.wi]?.days?.[ref.di];const item=day?.workouts?.[ref.ii];
 if(!day||!item)return;
 if(item.fitStandalone&&item.actual){
    const candidates=(fitDate=>locateDate(fitDate)?.d?.workouts||[])(newDate).filter(x=>x!==item&&!x.fitStandalone);
    let target=null;
    if(dropCard){const twi=+dropCard.dataset.openWi,tdi=+dropCard.dataset.openDi,tii=+dropCard.dataset.openIi;target=db.weeks[twi]?.days?.[tdi]?.workouts?.[tii];}
    if(!target&&candidates.length)target=await chooseFitTarget(candidates,newDate);
    if(target){window.RunPlanFITLinkStandalone?.(ref,target.id,newDate);return}
    if(candidates.length)return; // cancelled selection: keep imported FIT card intact
    if(day.date===newDate)return;
    if(!confirm('Ngày đích chưa có bài kế hoạch. Chuyển thẻ FIT sang ngày '+fmtDate(newDate)+'? Ngày trong file FIT sẽ không thay đổi.'))return;
    if(moveWorkoutToDate(ref,newDate)){render();toast('Đã chuyển thẻ FIT sang '+fmtDate(newDate,true))}
    return;
 }
 if(e.ctrlKey||e.metaKey){
   const count=copyWorkoutToDates(item,[newDate]);
   if(count){render();refreshViews();toast('Đã copy bài tập sang '+fmtDate(newDate,true))}
 }else{
   if(day.date===newDate)return;
   const ok=moveWorkoutToDate(ref,newDate);
   if(ok){render();refreshViews();toast('Đã chuyển bài tập sang '+fmtDate(newDate,true))}
 }
});

$('calendarWrap').addEventListener('scroll',()=>{const el=$('calendarWrap');if(loadingMore)return;if(el.scrollTop+el.clientHeight>=el.scrollHeight-420){loadingMore=true;const old=el.scrollTop;visibleWeekCount+=4;render({preserveScroll:true});requestAnimationFrame(()=>{el.scrollTop=old;setTimeout(()=>loadingMore=false,180)})}});

function initEnvironment(){if(!window.FileReader){showSupport('bad','Trình duyệt không hỗ trợ FileReader.');return}if(!window.RunPlanXLSX){showSupport('bad','Bộ đọc XLSX nội bộ không tải được.');return}if(typeof DecompressionStream==='undefined'){showSupport('bad','Trình duyệt quá cũ để đọc XLSX offline.');return}const st=T17Platform.status;if(T17Platform.isDesktop){showSupport('ok','Dữ liệu lưu thành file tại: '+st.dataDir+' (tự sao lưu mỗi ngày trong thư mục backups).')}else if(location.protocol==='file:')showSupport('warn','Bản web: dữ liệu lưu trong trình duyệt (localStorage, giới hạn ~5 MB). Dùng bản .exe để lưu ra file, hoặc Sao lưu JSON định kỳ.');else if(location.protocol==='https:')showSupport('ok','Đang chạy qua HTTPS. Dữ liệu được lưu cục bộ trên trình duyệt này.')}
let analyticsViewActive=false;
function switchView(view){
 logViewActive=view==='log';analyticsViewActive=view==='analytics';
 shellEl.style.display=view==='calendar'?'':'none';
 logView.style.display=logViewActive?'flex':'none';
 $('analyticsView').style.display=analyticsViewActive?'flex':'none';
 tabCalendar.classList.toggle('active',view==='calendar');tabLog.classList.toggle('active',logViewActive);$('tabAnalytics').classList.toggle('active',analyticsViewActive);
 refreshViews();
 if(analyticsViewActive)T17Analytics.render();
}
tabCalendar.onclick=()=>switchView('calendar');
tabLog.onclick=()=>switchView('log');
$('tabAnalytics').onclick=()=>switchView('analytics');
/** Gọi sau mọi thay đổi dữ liệu: vẽ lại view đang mở. */
function refreshViews(){if(logViewActive)renderLog();if(analyticsViewActive)T17Analytics.render()}

function flattenAllWorkouts(){
 const out=[];
 for(let wi=0;wi<db.weeks.length;wi++){const w=db.weeks[wi];for(let di=0;di<w.days.length;di++){const d=w.days[di];(d.workouts||[]).forEach((it,ii)=>{out.push({wi,di,ii,date:d.date,dow:d.dow,item:it})})}}
 return out;
}
function logTypeLabel(t){return t&&t.trim()?t:'Custom'}
function renderLogRow(row){
 const {wi,di,ii,date,dow,item}=row;const [st,cls]=getStatus(item,date);const a=item.actual;
 const planTxt=`${item.planKm||'—'} km · ${item.planMinutes||'—'}′`;
 const actualTxt=a&&a.status!=='missed'?`${a.km??'—'} km · ${actualDurationLabel(a.minutes)}`:'—';
 const paceTxt=a&&a.status!=='missed'?(pace(a.km,a.minutes)||'—'):'—';
 const noteBits=[item.description,item.planNote].map(x=>String(x||'').split(/\r?\n/)[0]).filter(Boolean);
 return `<div class="log-row" data-log-wi="${wi}" data-log-di="${di}" data-log-ii="${ii}"><div>${fmtDate(date,true)}<br><small style="color:#9099a7">${dow||''}</small></div><div class="log-name">${escapeHtml(item.workoutName||'Running workout')}${noteBits.length?`<small>${escapeHtml(noteBits[0])}</small>`:''}</div><div>${escapeHtml(logTypeLabel(item.workoutType))}</div><div><span class="log-badge ${cls}">${escapeHtml(st)}</span></div><div>${planTxt}</div><div>${actualTxt}</div><div>${paceTxt}</div><div class="log-actions"><button type="button" data-log-edit title="Sửa bài tập">✎</button><button type="button" data-log-del title="Xóa bài tập">⌫</button></div></div>`;
}
function renderLog(){
 if(!logView)return;
 const all=flattenAllWorkouts();
 const from=logFrom.value,to=logTo.value,type=logType.value,status=logStatus.value,q=norm(logSearch.value);
 let filtered=all.filter(row=>{
   if(from&&row.date<from)return false;
   if(to&&row.date>to)return false;
   if(type&&(row.item.workoutType||'Custom')!==type)return false;
   if(status){const cls=getStatus(row.item,row.date)[1];if(cls!==status)return false}
   if(q){const hay=norm((row.item.workoutName||'')+' '+(row.item.description||'')+' '+(row.item.planNote||''));if(!hay.includes(q))return false}
   return true;
 });
 filtered.sort((a,b)=>b.date.localeCompare(a.date)||a.wi-b.wi);
 logSummary.textContent=`${filtered.length} mục${filtered.length!==all.length?` (trên tổng ${all.length})`:''}`;
 logRows.innerHTML=filtered.map(renderLogRow).join('');
 logEmpty.style.display=filtered.length?'none':'block';
 logRows.querySelectorAll('[data-log-wi]').forEach(rowEl=>{
   const wi=+rowEl.dataset.logWi,di=+rowEl.dataset.logDi,ii=+rowEl.dataset.logIi;
   rowEl.addEventListener('click',e=>{if(e.target.closest('[data-log-edit]')||e.target.closest('[data-log-del]'))return;openModal(wi,di,ii)});
   rowEl.querySelector('[data-log-edit]').onclick=e=>{e.stopPropagation();const day=db.weeks[wi]?.days?.[di];if(day)openBuilder(day.date,{wi,di,ii})};
   rowEl.querySelector('[data-log-del]').onclick=e=>{e.stopPropagation();deletePlanByRef({wi,di,ii})};
 });
 logView._lastFiltered=filtered;
}
[logFrom,logTo,logType,logStatus].forEach(el=>el.addEventListener('change',renderLog));
logSearch.addEventListener('input',renderLog);
logResetBtn.onclick=()=>{logFrom.value='';logTo.value='';logType.value='';logStatus.value='';logSearch.value='';renderLog()};

function exportLogExcel(){
 const rows=logView._lastFiltered||[];
 if(!rows.length)return toast('Không có mục nào để xuất');
 const aoa=[['Ngày','Thứ','Tên bài','Loại','Trạng thái','Km KH','Phút KH','Km TT','Phút TT','Pace TT','RPE','Ghi chú kế hoạch','Ghi chú thực tế']];
 rows.forEach(({date,dow,item})=>{const a=item.actual;const st=getStatus(item,date)[0];aoa.push([dateForExcel(date),dow||'',item.workoutName||'',logTypeLabel(item.workoutType),st,item.planKm??'',item.planMinutes??'',a&&a.status!=='missed'?(a.km??''):'',a&&a.status!=='missed'?(a.minutes??''):'',a&&a.status!=='missed'?pace(a.km,a.minutes):'',a?.fatigue??'',item.planNote||'',a?.note||''])});
 const blob=RunPlanXLSX.buildXlsxBlob(aoa,'Training Log');
 saveBlob(blob,`RunPlan_TrainingLog_${logFrom.value||'start'}_${logTo.value||'end'}.xlsx`);
 toast('Đã xuất Training Log ra Excel');
}
function exportLogJson(){
 const rows=logView._lastFiltered||[];
 if(!rows.length)return toast('Không có mục nào để xuất');
 const entries=rows.map(({date,dow,item})=>({date,dow,workoutName:item.workoutName||'',workoutType:item.workoutType||'',planKm:item.planKm??'',planMinutes:item.planMinutes??'',description:item.description||'',planNote:item.planNote||'',actual:item.actual||null}));
 const payload={format:'runplan-log',version:1,exportedAt:new Date().toISOString(),entries};
 saveBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),`RunPlan_TrainingLog_${logFrom.value||'start'}_${logTo.value||'end'}.json`);
 toast('Đã xuất Training Log ra JSON');
}
logExportExcel.onclick=exportLogExcel;
logExportJson.onclick=exportLogJson;

async function boot(){
 let raw=null,loadError='';const warnings=[];let booted=false;
 try{raw=await T17Platform.init({onError:msg=>{if(booted)showSupport('bad',msg);else warnings.push(msg)}})}catch(e){loadError=e.message||String(e);console.error(e)}
 const {db:loaded,report}=loadDbFrom(raw);db=loaded;
 // Lần đầu (hoặc dữ liệu được nâng cấp từ định dạng cũ) → ghi lại theo schema mới.
 if(raw&&(!raw.schemaVersion||raw.schemaVersion<T17Legacy.SCHEMA_VERSION||report.legacyDaysConverted||report.weeksRealigned||report.idsFixed))saveDb();
 else if(!raw)saveDb();
 T17Analytics.init();T17Profile.init();T17UserUI.init();T17UserUI.syncName();
 currentWeek=findCurrentWeek();render();initEnvironment();
 booted=true;if(warnings.length)showSupport('warn',warnings.join(' '));
 if(loadError)showSupport('bad','Không mở được kho dữ liệu: '+loadError+'. Dữ liệu tạm thời chỉ nằm trong phiên này — hãy Sao lưu JSON.');
 if(raw&&T17Platform.status.loadedFrom==='webview-localStorage')toast('Đã chuyển dữ liệu cũ sang file: '+T17Legacy.describeReport(report));
 const ml=$('storageModeLabel');if(ml)ml.textContent=T17Platform.isDesktop?'Dữ liệu lưu thành file cạnh exe':'Dữ liệu lưu trong trình duyệt';const of=$('openDataFolderBtn');if(of){of.hidden=!T17Platform.isDesktop;of.onclick=()=>T17Platform.openDataFolder()}
}
// Chờ mọi script (analytics, profile, FIT UI…) nạp xong rồi mới khởi động.
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else setTimeout(boot,0);
$('builderGarminBtn').onclick=()=>{const err=validateBuilder();if(err)return alert(err);exportGarminWorkout(builderName.value.trim(),deepClone(builderState))};
