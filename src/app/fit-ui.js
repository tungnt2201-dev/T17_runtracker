/* RunPlan FIT importer UI, local-only, no Garmin/Strava account needed. */
(function(){
'use strict';
const fitInput=$('fitImportFile'),fitModal=$('fitImportModal'),fitTarget=$('fitTargetWorkout'),fitDate=$('fitImportDate'),fitMode=$('fitSectionMode');
const fitResult=$('fitPreviewSummary'),fitWarning=$('fitImportWarning'),fitSectionsPreview=$('fitSectionsPreview'),fitOverwrite=$('fitAllowOverwrite'),fitCommit=$('fitApplyBtn');
let fitPending=null,fitPreferred=null;
function fitRound(x,d=2){return Math.round((+x||0)*10**d)/10**d}
function fitClock(sec){const n=Math.round(sec||0);return n>=3600?`${Math.floor(n/3600)}:${String(Math.floor((n%3600)/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`:`${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`}
function fitPace(seconds,metres){return seconds>0&&metres>0?secToPace(seconds*1000/metres):'—'}
function fitLocalDate(fit){if(!fit.startTime)return ymd(new Date());const d=new Date(fit.startTime);if(Number.isFinite(fit.zoneOffsetSeconds)){return new Date(d.getTime()+fit.zoneOffsetSeconds*1000).toISOString().slice(0,10)}return ymd(d)}
function fitDateTime(fit){if(!fit.startTime)return 'Không rõ';const d=new Date(fit.startTime);if(Number.isFinite(fit.zoneOffsetSeconds)){const local=new Date(d.getTime()+fit.zoneOffsetSeconds*1000).toISOString();const off=fit.zoneOffsetSeconds/3600;return `${local.slice(8,10)}/${local.slice(5,7)}/${local.slice(0,4)} ${local.slice(11,16)} (UTC${off>=0?'+':''}${off})`}return d.toLocaleString('vi-VN')+' (giờ máy)'}
function fitAllWorkouts(){const out=[];for(const w of db.weeks||[])for(const d of w.days||[])for(const item of d.workouts||[])out.push({date:d.date,item});return out}
function fitNum(v){return typeof v==='number'&&Number.isFinite(v)?v:null}
function fitAvg(arr){let s=0,n=0;for(const v of arr){if(fitNum(v)!=null){s+=v;n++}}return n?s/n:null}
function fitMax(arr){let m=null;for(const v of arr){if(fitNum(v)!=null&&(m==null||v>m))m=v}return m}
function fitMin(arr){let m=null;for(const v of arr){if(fitNum(v)!=null&&(m==null||v<m))m=v}return m}
function fitDownsample(arr,max=160){if(!Array.isArray(arr)||arr.length<=max)return arr||[];const out=[],step=(arr.length-1)/(max-1);for(let i=0;i<max;i++)out.push(arr[Math.min(arr.length-1,Math.round(i*step))]);return out}
function fitDurationLabel(sec){return sec==null?'—':fitClock(sec)}
function fitBuildDashboard(f){if(f._dashboard)return f._dashboard;const recs=Array.isArray(f.records)?f.records:[];const hrVals=recs.map(r=>fitNum(r.hr)).filter(v=>v!=null),cadVals=recs.map(r=>fitNum(r.c)).filter(v=>v!=null),powerVals=recs.map(r=>fitNum(r.p)).filter(v=>v!=null),altVals=recs.map(r=>fitNum(r.a)).filter(v=>v!=null);const pacePoints=[],hrPoints=[],cadPoints=[],powerPoints=[],stridePoints=[],altPoints=[];let ascent=0,descent=0,lastAlt=null,lastMotion=null;for(const r of recs){const t=fitNum(r.m)??fitNum(r.t);if(t==null)continue;let speed=fitNum(r.s);if(speed==null&&lastMotion&&fitNum(r.d)!=null&&r.t>lastMotion.t){const deltaD=r.d-lastMotion.d,deltaT=r.t-lastMotion.t;if(deltaD>0&&deltaT>0)speed=deltaD/deltaT}if(fitNum(r.d)!=null)lastMotion={t:r.t,d:r.d};const cadRaw=fitNum(r.c),cad=(f.sport===1&&cadRaw>0&&cadRaw<130)?cadRaw*2:cadRaw;if(speed!=null&&speed>0)pacePoints.push({t,v:1000/speed,d:fitNum(r.d)});if(fitNum(r.hr)!=null)hrPoints.push({t,v:r.hr,d:fitNum(r.d)});if(cad!=null)cadPoints.push({t,v:cad,d:fitNum(r.d)});if(fitNum(r.p)!=null)powerPoints.push({t,v:r.p,d:fitNum(r.d)});if(speed!=null&&speed>0&&cad!=null&&cad>0)stridePoints.push({t,v:speed*60/cad,d:fitNum(r.d)});if(fitNum(r.a)!=null){altPoints.push({t,v:r.a,d:fitNum(r.d)});if(lastAlt!=null){const diff=r.a-lastAlt;if(diff>0.4)ascent+=diff;else if(diff<-0.4)descent+=Math.abs(diff)}lastAlt=r.a}}
 const avgPaceSec=f.distanceM>0&&f.durationSec>0?f.durationSec*1000/f.distanceM:fitAvg(pacePoints.map(x=>x.v));
 const avgCad=fitAvg(cadPoints.map(x=>x.v)),maxCad=fitMax(cadPoints.map(x=>x.v)),avgPower=fitAvg(powerVals),maxPower=fitMax(powerVals),avgStride=fitAvg(stridePoints.map(x=>x.v)),avgAlt=fitAvg(altVals);
 const stats={movingSec:fitNum(f.durationSec),elapsedSec:fitNum(f.elapsedSec),idleSec:(fitNum(f.elapsedSec)!=null&&fitNum(f.durationSec)!=null)?Math.max(0,f.elapsedSec-f.durationSec):null,distanceKm:fitNum(f.distanceM)!=null?f.distanceM/1000:null,avgPaceSec,maxHr:fitMax(hrVals)||fitNum(f.maxHr),avgHr:fitAvg(hrVals)||fitNum(f.avgHr),avgCad,maxCad,avgPower,maxPower,avgStride,totalAscent:ascent||null,totalDescent:descent||null,recordCount:fitNum(f.recordCount)||recs.length,lapCount:(f.laps||[]).length};
 const charts={pace:{title:'Pace',avg:avgPaceSec,avgLabel:avgPaceSec?`${secToPace(avgPaceSec)}/km`:'—',points:fitDownsample(pacePoints),color:'#4c94e6',invert:true},hr:{title:'Heart Rate',avg:stats.avgHr,avgLabel:stats.avgHr?`${Math.round(stats.avgHr)} bpm`:'—',points:fitDownsample(hrPoints),color:'#e25858'},cadence:{title:'Cadence',avg:avgCad,avgLabel:avgCad?`${Math.round(avgCad)} spm`:'—',points:fitDownsample(cadPoints),color:'#d44545'},stride:{title:'Stride Length',avg:avgStride,avgLabel:avgStride?`${fitRound(avgStride,2)} m`:'—',points:fitDownsample(stridePoints),color:'#2d7fd0'},power:{title:'Power',avg:avgPower,avgLabel:avgPower?`${Math.round(avgPower)} W`:'—',points:fitDownsample(powerPoints),color:'#f0a93b'},elevation:{title:'Elevation',avg:avgAlt,avgLabel:avgAlt!=null?`${Math.round(avgAlt)} m`:'—',points:fitDownsample(altPoints),color:'#48a978'}};
 const laps=(f.laps||[]).map((l,i)=>({index:i+1,time:fitDurationLabel(l.durationSec),dist:l.distanceM!=null?fitRound(l.distanceM/1000,2):null,pace:(l.durationSec>0&&l.distanceM>0)?secToPace(l.durationSec*1000/l.distanceM):null,hr:l.avgHr??null,cad:l.avgCad??null,power:l.avgPower??null,asc:l.totalAscent??null}));
 const zoneSourceHrMax=stats.maxHr||fitMax(hrVals); let zones=[]; if(hrPoints.length&&zoneSourceHrMax){const cuts=[0,.6,.7,.8,.9,1.01].map(x=>zoneSourceHrMax*x);const buckets=[0,0,0,0,0];for(let i=0;i<hrPoints.length;i++){const curr=hrPoints[i],next=hrPoints[i+1];let dt=next?Math.max(1,next.t-curr.t):1;let z=0;while(z<5&&curr.v>=cuts[z+1])z++;buckets[Math.min(4,z)]+=dt}zones=buckets.map((sec,i)=>{const from=Math.round(cuts[i]),to=i<4?Math.round(cuts[i+1]-1):Math.round(zoneSourceHrMax);const pct=stats.movingSec?sec/stats.movingSec*100:0;return {name:'Zone '+(i+1),range:i<4?`${from}–${to} bpm`:`≥ ${from} bpm`,sec,pct,cls:'z'+(i+1)}})}
 return f._dashboard={stats,charts,laps,zones,zoneSourceHrMax};}
function fitChartDuration(sec){const n=Math.max(0,Math.round(sec||0));if(n>=3600)return `${Math.floor(n/3600)}:${String(Math.floor(n%3600/60)).padStart(2,'0')}:${String(n%60).padStart(2,'0')}`;return `${Math.floor(n/60)}:${String(n%60).padStart(2,'0')}`}
function fitChartYLabel(chart,v){if(chart.title==='Pace')return secToPace(Math.max(0,v));if(chart.title==='Stride Length')return fitRound(v,2)+' m';if(chart.title==='Elevation')return Math.round(v)+' m';return Math.round(v)+' '+({"Heart Rate":"bpm","Cadence":"spm","Power":"W"}[chart.title]||'')}
function fitSvgChart(chart,axis='time'){
 const all=(chart?.points||[]).filter(p=>fitNum(p.v)!=null&&fitNum(axis==='distance'?p.d:p.t)!=null);
 if(all.length<2)return '<div class="fit-chart-empty">Không đủ dữ liệu để vẽ theo trục này. Với FIT cũ, hãy import lại tệp để bổ sung mốc quãng đường.</div>';
 const width=860,height=220,left=84,right=19,top=20,bottom=37;
 const vals=all.map(p=>p.v).filter(Number.isFinite);let lo=Math.min(...vals),hi=Math.max(...vals);
 // Exclude very large pace outliers from vertical scaling while retaining the plotted points within the domain.
 if(chart.title==='Pace'&&vals.length>30){const sorted=[...vals].sort((a,b)=>a-b);hi=Math.min(hi,sorted[Math.floor(sorted.length*.96)]*1.15)}
 let pad=(hi-lo)*.09;if(!(pad>0))pad=Math.max(1,Math.abs(lo)*.04);
 lo=Math.max(0,lo-pad);hi+=pad;
 const rawX=all.map(p=>axis==='distance'?p.d:p.t),x0=rawX[0],x1=rawX[rawX.length-1];
 if(!(x1>x0))return '<div class="fit-chart-empty">Không đủ biến thiên trên trục đã chọn.</div>';
 const X=z=>left+(z-x0)/(x1-x0)*(width-left-right),Y=v=>top+((chart.invert?(v-lo)/(hi-lo):1-(v-lo)/(hi-lo)))*(height-top-bottom);
 const pts=all.map(p=>({x:X(axis==='distance'?p.d:p.t),y:Y(Math.max(lo,Math.min(hi,p.v)))}));
 const path=pts.map((p,i)=>`${i?'L':'M'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
 const area=path+` L ${pts[pts.length-1].x.toFixed(1)},${height-bottom} L ${pts[0].x.toFixed(1)},${height-bottom} Z`;
 let grid='',xlabels='',ylabels='';
 for(let i=0;i<=4;i++){
   const v=lo+(hi-lo)*i/4,yy=Y(v);grid+=`<line x1="${left}" y1="${yy.toFixed(1)}" x2="${width-right}" y2="${yy.toFixed(1)}" class="fit-chart-grid"/>`;
   ylabels+=`<text x="${left-10}" y="${(yy+4).toFixed(1)}" text-anchor="end" class="fit-axis-value">${fitChartYLabel(chart,v)}</text>`;
   const xv=x0+(x1-x0)*i/4,xx=X(xv),lbl=axis==='distance'?`${fitRound((xv-x0)/1000,2)} km`:fitChartDuration(xv-x0);
   grid+=`<line x1="${xx.toFixed(1)}" y1="${top}" x2="${xx.toFixed(1)}" y2="${height-bottom}" stroke="#eaf0f6" stroke-dasharray="3 4"/>`;
   xlabels+=`<text x="${xx.toFixed(1)}" y="${height-bottom+16}" text-anchor="middle" class="fit-axis-value">${lbl}</text>`;
 }
 const avg=fitNum(chart.avg)!=null&&chart.avg>=lo&&chart.avg<=hi?`<line x1="${left}" y1="${Y(chart.avg).toFixed(1)}" x2="${width-right}" y2="${Y(chart.avg).toFixed(1)}" stroke="#425876" stroke-dasharray="6 4" stroke-width="1.4"/>`:'';
 return `<svg class="fit-chart-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Biểu đồ ${escapeHtml(chart.title)} theo ${axis==='distance'?'quãng đường':'thời gian'}, có trục ngang và trục dọc">${grid}${ylabels}${xlabels}<line class="fit-chart-border" x1="${left}" x2="${width-right}" y1="${height-bottom}" y2="${height-bottom}"/>${avg}<path d="${area}" fill="${chart.color}" opacity=".17"/><path d="${path}" stroke="${chart.color}" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/><text x="${width/2}" y="${height-4}" class="fit-axis-title" text-anchor="middle">${axis==='distance'?'Quãng đường (km)':'Thời gian vận động, không tính dừng (hh:mm:ss)'}</text></svg>`;
}
function fitRenderChartHost(host,dash){
 if(!host)return;
 const order=['pace','hr','cadence','stride','power','elevation'];const charts=order.map(key=>dash.charts[key]).filter(c=>c?.points?.length>1);
 if(!charts.length){host.innerHTML='<div class="fit-chart-empty">File FIT này không có đủ chuỗi thời gian để vẽ biểu đồ.</div>';return}
 const hasDist=charts.some(c=>c.points.filter(p=>fitNum(p.d)!=null).length>2);
 const axis=host.dataset.axis==='distance'&&hasDist?'distance':'time';host.dataset.axis=axis;
 host.innerHTML=`<div class="fit-chart-controlbar"><strong>Trục ngang</strong><button type="button" class="fit-chart-axis-btn ${axis==='time'?'active':''}" data-fit-axis="time">Theo thời gian</button><button type="button" class="fit-chart-axis-btn ${axis==='distance'?'active':''}" data-fit-axis="distance" ${hasDist?'':'disabled title="Cần import lại tệp FIT để lưu mốc quãng đường"'}>Theo quãng đường</button><span class="fit-chart-axis-hint">${hasDist?'Trục thời gian là Timer Time; đã loại khoảng dừng đồng hồ theo sự kiện FIT.':'Dữ liệu đã lưu từ phiên bản cũ chưa có tọa độ quãng đường theo thời gian; có thể nhập lại FIT để bổ sung.'}</span></div>`+
 charts.map(ch=>`<div class="fit-chart-card"><div class="fit-chart-top"><strong>${escapeHtml(ch.title)}</strong><span>Trung bình ${escapeHtml(ch.avgLabel||'—')}</span></div>${fitSvgChart(ch,axis)}<div class="fit-chart-legend">Đường ngang đứt nét: trung bình · Trục dọc: ${escapeHtml(ch.title)} · Trục ngang: ${axis==='time'?'thời gian':'quãng đường'}.</div></div>`).join('');
 host.querySelectorAll('[data-fit-axis]').forEach(btn=>btn.addEventListener('click',()=>{host.dataset.axis=btn.dataset.fitAxis;fitRenderChartHost(host,dash)}));
}
function fitRenderRichPreview(f,mount=null){const dash=fitBuildDashboard(f),stats=dash.stats;const pick=(key,id)=>mount?mount.querySelector('[data-fit-panel="'+key+'"]'):$(id);const extra=pick('summary','fitExtraSummary'),charts=pick('charts','fitDetailCharts'),laps=pick('laps','fitLapTable'),zones=pick('zones','fitZones'),lapMeta=pick('lap-meta','fitLapMeta');if(extra)extra.innerHTML=`<div class="fit-mini-stats"><div class="fit-mini-stat"><span>Moving time</span><strong>${fitDurationLabel(stats.movingSec)}</strong><small>Elapsed ${fitDurationLabel(stats.elapsedSec)}${stats.idleSec!=null?` · Idle ${fitDurationLabel(stats.idleSec)}`:''}</small></div><div class="fit-mini-stat"><span>Avg pace</span><strong>${stats.avgPaceSec?secToPace(stats.avgPaceSec):'—'}/km</strong><small>Distance ${stats.distanceKm!=null?fitRound(stats.distanceKm,3):'—'} km</small></div><div class="fit-mini-stat"><span>Heart rate</span><strong>${stats.avgHr?Math.round(stats.avgHr):'—'} bpm</strong><small>Max ${stats.maxHr?Math.round(stats.maxHr):'—'} bpm</small></div><div class="fit-mini-stat"><span>Cadence</span><strong>${stats.avgCad?Math.round(stats.avgCad):'—'} spm</strong><small>Max ${stats.maxCad?Math.round(stats.maxCad):'—'} spm</small></div><div class="fit-mini-stat"><span>Power</span><strong>${stats.avgPower?Math.round(stats.avgPower):'—'} W</strong><small>Max ${stats.maxPower?Math.round(stats.maxPower):'—'} W</small></div><div class="fit-mini-stat"><span>Stride length</span><strong>${stats.avgStride?fitRound(stats.avgStride,2):'—'} m</strong><small>Ascent ${stats.totalAscent?Math.round(stats.totalAscent):'—'} m · Descent ${stats.totalDescent?Math.round(stats.totalDescent):'—'} m</small></div></div><div class="fit-insight-warning">Các chỉ số như cadence, power, stride length, HR zones và biểu đồ bên dưới chỉ hiện khi file FIT thực sự có dữ liệu tương ứng.</div>`;
 if(charts)fitRenderChartHost(charts,dash);
 if(laps){lapMeta.textContent=`${dash.laps.length} lap${dash.laps.length!==1?'s':''}`;laps.innerHTML=dash.laps.length?`<div class="fit-lap-note">Mỗi lap được Garmin ghi nhận theo đồng hồ. Có thể dùng để ghép 1:1 với section nếu số lượng trùng nhau.</div><div class="fit-table-wrap"><table><thead><tr><th>#</th><th>Time</th><th>Distance</th><th>Avg Pace</th><th>Avg HR</th><th>Cadence</th><th>Power</th><th>Ascent</th></tr></thead><tbody>${dash.laps.map(l=>`<tr><td>${l.index}</td><td>${escapeHtml(l.time)}</td><td>${l.dist!=null?escapeHtml(String(l.dist)):'—'}</td><td>${l.pace?escapeHtml(l.pace)+'/km':'—'}</td><td>${l.hr??'—'}</td><td>${l.cad??'—'}</td><td>${l.power??'—'}</td><td>${l.asc??'—'}</td></tr>`).join('')}</tbody></table></div>`:'<div class="fit-chart-empty">Không có dữ liệu lap trong file FIT.</div>'}
 if(zones){zones.innerHTML=dash.zones.length?`<div class="fit-zone-list">${dash.zones.map(z=>`<div class="fit-zone-row"><div class="label"><strong>${escapeHtml(z.name)}</strong> · ${escapeHtml(z.range)}</div><div class="fit-zone-bar"><div class="fit-zone-fill ${z.cls}" style="width:${Math.max(0,Math.min(100,z.pct)).toFixed(1)}%"></div></div><div class="pct">${fitClock(z.sec)} · ${Math.round(z.pct)}%</div></div>`).join('')}</div><div class="fit-muted" style="margin-top:8px">HR zones ước tính theo tỷ lệ % của nhịp tim tối đa trong chính file FIT này.</div>`:'<div class="fit-chart-empty">Không có đủ dữ liệu nhịp tim để tính time in zones.</div>'}
}
function fitCompactInsights(f){const dash=fitBuildDashboard(f);const chartKeys=['pace','hr','cadence','stride','power','elevation'];const charts={};for(const k of chartKeys){const ch=dash.charts[k];if(ch&&ch.points&&ch.points.length>1)charts[k]={title:ch.title,avg:ch.avg,avgLabel:ch.avgLabel,points:fitDownsample(ch.points,120),color:ch.color,unit:'',invert:!!ch.invert}}return {stats:dash.stats,laps:dash.laps,zones:dash.zones,charts}}
/* Rehydrate dashboard already stored in actual.fitImport.insights.
   v1.8.5 and v1.8.5 saved the series and laps, but did not render them on revisit. */
function fitNormalizeSavedInsights(ins){
 const stats=ins.stats||{},raw=ins.charts||{},charts={};
 const fallback={pace:stats.avgPaceSec,hr:stats.avgHr,cadence:stats.avgCad,stride:stats.avgStride,power:stats.avgPower,elevation:null};
 for(const [key,ch] of Object.entries(raw)){
   const values=Array.isArray(ch.points)?ch.points:[];
   charts[key]={...ch,avg:fitNum(ch.avg)??fitNum(fallback[key])??fitAvg(values.map(v=>v.v))};
 }
 return {stats,charts,laps:Array.isArray(ins.laps)?ins.laps:[],zones:Array.isArray(ins.zones)?ins.zones:[]};
}
function fitShowSavedDashboard(item){
 const info=item?.actual?.fitImport,exists=!!info,ins=info?.insights,details=$('fitSavedDetails'),banner=$('fitSavedBanner'),warn=$('fitSavedLegacyWarning'),content=$('fitSavedRichGrid');
 if(!details||!banner)return;
 details.hidden=!exists;banner.hidden=!exists;details.open=!!(exists&&ins);
 modal.querySelector('.actual-sheet')?.classList.toggle('with-fit-data',exists);
 if(!exists)return;
 const txt=[info.filename,info.startTime?new Date(info.startTime).toLocaleString('vi-VN'):'',info.lapCount!=null?info.lapCount+' laps':'',info.recordCount!=null?info.recordCount+' records':''].filter(Boolean).join(' · ');
 const sectionPlans=actualSectionPlan(item),sectionFilled=(item.actual?.segments||[]).filter(x=>+x.actualMinutes>0||+x.actualKm>0).length;
 $('fitSavedBannerMeta').textContent=(txt||'Đã nhập kết quả FIT')+(sectionPlans.length&&!sectionFilled?' · Chưa ghép section: nhấn ↻ Ghép section từ FIT để bổ sung.':'');$('fitSavedMeta').textContent='Nguồn Garmin FIT · '+(txt||'Không rõ tên tệp')+' · Màn hình này đọc dữ liệu đã lưu trong RunPlan, không yêu cầu import lại.';
 if(!ins){warn.hidden=false;warn.textContent='Hoạt động đã được nhập từ FIT bằng phiên bản cũ nhưng chưa lưu biểu đồ nâng cao. Kết quả tổng vẫn còn; muốn có đầy đủ biểu đồ cho buổi này cần bổ sung lại từ tệp FIT gốc.';content.hidden=true;return}
 warn.hidden=true;content.hidden=false;const data=fitNormalizeSavedInsights(ins);fitRenderRichPreview({_dashboard:data},details);
}
$('fitSavedOpenNow').addEventListener('click',()=>{const details=$('fitSavedDetails');if(!details||details.hidden)return;details.open=true;details.scrollIntoView({behavior:'smooth',block:'start'});});
$('fitSavedRemap').addEventListener('click',()=>$('fitImportInActual').click());
window.RunPlanSavedFIT={show:fitShowSavedDashboard};
function fitDuplicate(f){return fitAllWorkouts().find(x=>x.item.actual?.fitImport?.id===f.id)||null}
function fitListForDate(date){const found=locateDate(date);return found?.d?.workouts||[]}
function fitPlanScore(w,f){const pmin=+w.planMinutes||0,pkm=+w.planKm||0;let s=0;if(w.actual)s+=15;if(pmin&&f.durationSec)s+=Math.abs(pmin-f.durationSec/60)/(pmin||1)*25;if(pkm&&f.distanceM)s+=Math.abs(pkm-f.distanceM/1000)/(pkm||1)*25;return s}
function fitRefreshTarget(){if(!fitPending)return;const options=fitListForDate(fitDate.value);
 fitTarget.innerHTML='<option value="__new__">＋ Đưa FIT vào lịch đúng ngày (thẻ riêng, kéo để ghép)</option>'+options.map(w=>`<option value="${escapeHtml(w.id)}">${escapeHtml(w.workoutName||'Bài chạy')}${w.actual?' · ĐÃ CÓ KẾT QUẢ':''}${w.planKm?' · '+escapeHtml(w.planKm)+'km':''}</option>`).join('');
 let matched=null;
 if(fitPreferred&&fitDate.value===fitPreferred.date)matched=options.find(w=>w.id===fitPreferred.id);
 // By default do not overwrite or guess which planned workout owns a FIT file.
 // The user can link from the imported FIT card by drag/drop or by selection.
 fitTarget.value=matched?.id||'__new__';fitRefreshMode();
}
function fitSelectedWorkout(){return fitListForDate(fitDate.value).find(w=>w.id===fitTarget.value)||null}
function fitFindAt(arr,axis,v){if(!arr.length)return null;let l=0,h=arr.length-1;const get=x=>axis==='t'?x.t:x.d;if(v<get(arr[0])-0.00001||v>get(arr[h])+0.00001)return null;while(l<h){const mid=(l+h)>>1;if(get(arr[mid])<v)l=mid+1;else h=mid}const b=arr[l];if(l===0)return {...b};const a=arr[l-1];const diff=get(b)-get(a);const q=diff>0?Math.max(0,Math.min(1,(v-get(a))/diff)):0;return {t:a.t+(b.t-a.t)*q,d:a.d+(b.d-a.d)*q}}
function fitCalcFromRecords(f,plans){const arr=f.series||[];if(arr.length<3)return [];
 let cursor={...arr[0]},out=[];
 for(const p of plans){let end=null;if(p.mode==='distance'&&p.value>0)end=fitFindAt(arr,'d',cursor.d+p.value*1000);else if(p.value>0)end=fitFindAt(arr,'t',cursor.t+p.value*60);
   if(!end)break;const sec=Math.max(0,end.t-cursor.t),dist=Math.max(0,end.d-cursor.d);
   if(sec<=0&&dist<=0)break;out.push({sec,metres:dist});cursor=end;
 }return out}
/* Align FIT samples sequentially to each planned section using its declared time or distance.
   Boundaries are inferred from the plan; they are not confirmed workout transitions. */
function fitCalcAutoSections(f,plans){
 // Sequential mixed-basis matching: TIME step uses exactly N minutes of Garmin timer,
 // DISTANCE step uses exactly N metres after the previous step. Never scale by plan proportions.
 const arr=(f.series||[]).filter(x=>Number.isFinite(x.m)&&Number.isFinite(x.d));
 if(arr.length<3||!plans.length||!(f.durationSec>0))return [];
 let cursor={m:arr[0].m,d:arr[0].d},out=[];
 const last={m:Math.min(f.durationSec,arr[arr.length-1].m),d:Math.min(f.distanceM||Infinity,arr[arr.length-1].d)};
 // Interpolate by moving timer or cumulative distance; event pauses are already excluded from m.
 function at(axis,target){if(target<=arr[0][axis])return {...arr[0]};if(target>=arr[arr.length-1][axis])return {...arr[arr.length-1]};let l=0,h=arr.length-1;while(l<h){const mid=Math.floor((l+h)/2);if(arr[mid][axis]<target)l=mid+1;else h=mid}if(l===0)return {...arr[0]};const a=arr[l-1],b=arr[l],span=b[axis]-a[axis],q=span>0?Math.max(0,Math.min(1,(target-a[axis])/span)):0;return {m:a.m+(b.m-a.m)*q,d:a.d+(b.d-a.d)*q}}
 for(let i=0;i<plans.length;i++){
   const p=plans[i],basis=p.mode==='distance'?'distance':'time',quantity=Number(p.value)||0;
   if(!(quantity>0)||cursor.m>=last.m-.05||cursor.d>=last.d-.05)break;
   const field=basis==='distance'?'d':'m',goal=cursor[field]+(basis==='distance'?quantity*1000:quantity*60),limit=last[field];
   const partial=goal>limit+.05,end=at(field,Math.min(goal,limit));
   let sec=Math.max(0,end.m-cursor.m),metres=Math.max(0,end.d-cursor.d);
   if(!(sec>.01||metres>.05))break;
   const rec=(f.records||[]).filter(r=>Number.isFinite(r.m)&&Number.isFinite(r.hr)&&r.m>=cursor.m&&r.m<=end.m);
   const avgHr=rec.length?Math.round(rec.reduce((sum,r)=>sum+r.hr,0)/rec.length):null;
   out.push({sec,metres,avgHr,estimated:true,partial,axis:basis});
   cursor=end;
   if(partial)break;
 }
 return out;
}
function fitMappedSections(f,w,mode){if(!w||mode==='none')return [];
 const plans=actualSectionPlan(w);if(!plans.length)return [];
 let samples=[];
 if(mode==='laps'&&f.laps.length===plans.length){samples=f.laps.map(l=>({sec:l.durationSec,metres:l.distanceM,avgHr:l.avgHr}))}
 else if(mode==='estimate'||mode==='auto'){samples=fitCalcAutoSections(f,plans)}
 return plans.map((p,i)=>{const s=samples[i]||{};const t=s.sec>0?s.sec/60:'',km=s.metres>0?s.metres/1000:'',pc=t!==''&&km!==''?secToPace(s.sec/(s.metres/1000)):'';
 return {key:p.key,label:p.label,activity:p.activity,role:p.role,context:p.context,planMinutes:p.planMinutes?fitRound(p.planMinutes,3):'',planKm:p.planKm?fitRound(p.planKm,3):'',targetPaceFrom:p.paceFrom||'',targetPaceTo:p.paceTo||'',targetHrFrom:p.hrFrom||'',targetHrTo:p.hrTo||'',actualMinutes:t!==''?fitRound(t,6):'',actualKm:km!==''?fitRound(km,3):'',actualPace:pc,avgHr:s.avgHr||'',estimated:!!s.estimated,partial:!!s.partial,sourceMethod:mode};});
}
function fitRefreshMode(){if(!fitPending)return;const f=fitPending.fit,w=fitSelectedWorkout(),plans=w?actualSectionPlan(w):[];const canLap=plans.length&&f.laps.length===plans.length&&f.sessionCount===1&&f.laps.every(l=>l.durationSec>0||l.distanceM>0),canEstimate=plans.length&&f.series?.length>=3&&f.sessionCount===1;
 fitMode.innerHTML='<option value="none">Chỉ nhập tổng kết quả FIT (không ghép section)</option>'+(canEstimate?'<option value="auto">Ghép tuần tự: thời gian đúng phút / cự ly đúng km (ước tính ranh giới)</option>':'')+(canLap?'<option value="laps">Ghép 1 lap FIT ↔ 1 section KH (khi thực sự trùng)</option>':'')+(canEstimate?'<option value="estimate">Theo đúng mốc từng section, dừng ở cuối FIT</option>':'');
 fitMode.value=canEstimate?'auto':canLap?'laps':'none';fitUpdatePreview();
}
function fitUpdatePreview(){if(!fitPending)return;const f=fitPending.fit,w=fitSelectedWorkout(),old=w?.actual;
 fitResult.innerHTML=`<div class="fit-stat"><span>Thời gian chạy</span><strong>${fitClock(f.durationSec)}</strong><small>Timer Time · đã loại ${fitClock(f.pauseSeconds||0)} tạm dừng</small></div><div class="fit-stat"><span>Quãng đường</span><strong>${f.distanceM!=null?fitRound(f.distanceM/1000,3)+' km':'—'}</strong><small>Pace ${fitPace(f.durationSec,f.distanceM)}/km</small></div><div class="fit-stat"><span>HR trung bình</span><strong>${f.avgHr??'—'} bpm</strong><small>Max ${f.maxHr??'—'} bpm</small></div><div class="fit-stat"><span>Calories</span><strong>${f.calories??'—'} kcal</strong><small>${f.laps.length} laps · ${f.recordCount} records</small></div>`;
 const segments=fitMappedSections(f,w,fitMode.value);const available=segments.filter(x=>+x.actualMinutes>0||+x.actualKm>0);
 let notes=[];
 if(f.sessionCount>1)notes.push(`Tệp FIT có ${f.sessionCount} session. Bản thử nghiệm chỉ nhập session đầu tiên; không tự ghép section.`);
 if(f.sport!=null&&f.sport!==1)notes.push('Môn thể thao trong FIT không phải Running. Hãy kiểm tra trước khi nhập.');
 if(!f.fileCRCValid)notes.push('CRC tệp FIT không khớp. Có thể file bị thay đổi hoặc lỗi; hãy kiểm tra lại dữ liệu trước khi lưu.');
 if(f.zoneOffsetSeconds==null)notes.push('FIT không cung cấp UTC offset; ngày mặc định tính theo múi giờ trên thiết bị đang mở RunPlan. Có thể chỉnh lại ngày ở trên.');
 if(old)notes.push('Bài đã có kết quả. Bạn phải chủ động tích vào ô cho phép ghi đè để thay kết quả cũ.');
 if(fitPending.reimport)notes.push('File FIT này đã từng nhập. Bạn có thể tái nhập vào ĐÚNG bài trước đó và tích cho phép ghi đè để bổ sung dữ liệu section và trục quãng đường.');
 if(w&&fitMode.value==='none'&&actualSectionPlan(w).length)notes.push('Chế độ chỉ nhập tổng: không tự sinh kết quả từng section.');
 if(fitMode.value==='estimate')notes.push('Các mốc được nội suy theo thời gian chạy và quãng đường; số liệu mỗi đoạn chỉ có nghĩa nếu bạn đã thực sự thực hiện đúng thứ tự cấu trúc bài.');
 if(fitMode.value==='auto'||fitMode.value==='estimate')notes.push('GHÉP TUẦN TỰ: đoạn theo phút giữ nguyên thời lượng mục tiêu; đoạn theo km giữ nguyên quãng đường mục tiêu, nội suy chỉ số còn lại từ bản ghi FIT theo thời gian chạy không tính tạm dừng. Nếu kết thúc sớm, chỉ điền đoạn đang chạy dở và giữ trống đoạn chưa bắt đầu. Đây là phép cắt tuần tự, KHÔNG chứng minh bạn đã bấm đúng ranh giới section trên đồng hồ.');
 if(['auto','estimate'].includes(fitMode.value)&&w&&segments.length&&available.length<actualSectionPlan(w).length)notes.push(`FIT chỉ đủ dữ liệu cho ${available.length}/${actualSectionPlan(w).length} section (đoạn cuối có thể đang dở); các section còn lại để trống, không bịa dữ liệu.`);
 if(fitMode.value==='laps')notes.push('Mỗi lap Garmin được gán theo đúng thứ tự một section kế hoạch. Hãy kiểm tra ranh giới lap có trùng section không.');
 if(f.laps.length&&w&&f.laps.length!==actualSectionPlan(w).length)notes.push(`FIT có ${f.laps.length} laps, trong khi bài KH có ${actualSectionPlan(w).length} sections, nên không tự ghép 1:1.`);
 fitWarning.innerHTML=notes.map(x=>`<div>• ${escapeHtml(x)}</div>`).join('');fitWarning.style.display=notes.length?'block':'none';$('fitSectionEstimateHelp').hidden=!['auto','estimate'].includes(fitMode.value);$('fitSectionEstimateHelp').textContent=['auto','estimate'].includes(fitMode.value)?'Ghép tuần tự đúng đơn vị: 15 phút thì lấy 15 phút Timer Time; 800 m thì lấy 800 m tiếp theo từ FIT. Các đoạn chưa tới lượt không tự sinh số liệu. Ngắt đồng hồ được loại khỏi trục thời gian. Nếu chuyển bài thực tế khác kế hoạch, cần chỉnh lại các mốc.':'';
 fitOverwrite.disabled=false;
 if(!old)fitOverwrite.checked=false;
 $('fitOverwriteState').textContent=old?'Bài đã có kết quả: phải tích ô trên mới được ghi đè.':'Bài chưa có kết quả: không cần tích ghi đè. Bạn vẫn có thể tích hoặc bỏ tích, việc lưu mới không bị ảnh hưởng.';
 fitCommit.disabled=!!old&&!fitOverwrite.checked;
 const head=`<div class="fit-preview-head">${w?escapeHtml(w.workoutName||'Bài chạy'):'Buổi chạy độc lập'} · ${available.length}/${segments.length} section có dữ liệu</div>`;
 if(!segments.length){fitSectionsPreview.innerHTML=head+'<div class="fit-preview-empty">Không có dữ liệu section được ghép. Vẫn có thể nhập tổng kết quả chính xác từ FIT.</div>';fitRenderRichPreview(f);return}
 fitSectionsPreview.innerHTML=head+`<div class="fit-table-wrap"><table><thead><tr><th>#</th><th>Section KH</th><th>Thời gian TT</th><th>Km TT</th><th>Pace TT</th></tr></thead><tbody>${segments.map((x,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(x.label)} <small>${escapeHtml(x.context||'')}</small></td><td>${x.actualMinutes!==''?fitClock(x.actualMinutes*60):'—'}</td><td>${x.actualKm!==''?x.actualKm:'—'}</td><td>${x.actualPace||'—'}${x.partial?' <span class="fit-estimate-chip">đoạn dở</span>':x.estimated?' <span class="fit-estimate-chip">theo KH</span>':''}</td></tr>`).join('')}</tbody></table></div>`;
 fitRenderRichPreview(f);
}
function fitRenderModal(){if(!fitPending)return;const f=fitPending.fit;
 $('fitImportTitle').textContent=fitPending.filename;
 $('fitImportMeta').textContent=`Bắt đầu ${fitDateTime(f)} · ${fitPending.innerName?'Trong ZIP: '+fitPending.innerName+' · ':''}Mã ${f.id}`;
 fitDate.value=fitPending.reimport&&fitPreferred?.date?fitPreferred.date:fitLocalDate(f);fitOverwrite.checked=false;
 fitRefreshTarget();fitModal.classList.add('show');
}
async function fitReadUpload(file){if(!file)return;let bytes=new Uint8Array(await readFileArrayBuffer(file)),innerName='';if(bytes.length>45*1024*1024)throw Error('File quá lớn. Hãy chọn tệp FIT/ZIP dưới 45 MB.');
 if(/\.zip$/i.test(file.name)||String.fromCharCode(...bytes.slice(0,2))==='PK'){
   if(!window.RunPlanXLSX?.unzip)throw Error('Không có chức năng mở ZIP.');const archive=await RunPlanXLSX.unzip(bytes);const fits=[...archive.entries()].filter(([n,b])=>/\.fit$/i.test(n)&&b.length<=80*1024*1024);
   if(!fits.length)throw Error('Không tìm thấy file .fit trong ZIP.');if(fits.length>1)throw Error('ZIP có nhiều FIT. Hãy giải nén rồi chọn từng file FIT để tránh nhập nhầm.');
   innerName=fits[0][0];bytes=fits[0][1];
 }
 const fit=RunPlanFIT.decode(bytes);
 const existing=fitDuplicate(fit);
 fitPending={fit,filename:file.name,innerName,reimport:!!existing};if(existing)fitPreferred={date:existing.date,id:existing.item.id};fitRenderModal();
}
function fitImportOpen(ref=null){fitPreferred=null;if(ref){const d=db.weeks[ref.wi]?.days?.[ref.di],item=d?.workouts?.[ref.ii];if(d&&item)fitPreferred={date:d.date,id:item.id}}
 fitInput.value='';fitInput.click();}
function fitCloseModal(){fitModal.classList.remove('show');fitPending=null;fitPreferred=null}
function fitCommitResult(){if(!fitPending)return;const {fit:f,filename,innerName}=fitPending;
 const duplicate=fitDuplicate(f);
 const date=fitDate.value;if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return alert('Chưa chọn ngày tập hợp lệ.');
 let item=fitSelectedWorkout();if(duplicate&&duplicate.item!==item)return alert('Tệp FIT này đã được nhập vào bài khác. Hãy chọn lại đúng bài đã nhập để bổ sung section, không thể dùng cho một bài khác.');if(item?.actual&&!fitOverwrite.checked)return alert('Bài tập này đã có kết quả. Tích ô cho phép ghi đè trước khi nhập.');
 const segments=fitMappedSections(f,item,fitMode.value);
 if(!item){const loc=ensureDate(date);item={id:genId(),fitStandalone:true,workoutName:'Garmin FIT · '+(innerName||filename).split(/[\\/]/).pop().replace(/\.fit$/i,'').replace(/\.zip$/i,''),workoutType:'Custom',planKm:'',planMinutes:'',description:'Hoạt động thực tế được nhập từ Garmin FIT; chưa liên kết với bài kế hoạch.',planNote:'',workoutStructure:null,actual:null};loc.d.workouts.push(item)}
 const fitImport={id:f.id,source:'Garmin FIT',filename,innerName,startTime:f.startTime,importedAt:new Date().toISOString(),elapsedMinutes:f.elapsedSec?fitRound(f.elapsedSec/60,3):'',lapCount:f.laps.length,recordCount:f.recordCount,sectionMode:fitMode.value,crcValid:f.fileCRCValid,pauseSeconds:f.pauseSeconds??null,timerEventCount:f.timerEventCount??0,insights:fitCompactInsights(f),sectionSource:{
 durationSec:f.durationSec,distanceM:f.distanceM,
 points:(f.series||[]).filter(x=>Number.isFinite(x.m)&&Number.isFinite(x.d)).map(x=>[Math.round(x.m*100)/100,Math.round(x.d*100)/100]),
 hr:(f.records||[]).filter(x=>Number.isFinite(x.m)&&Number.isFinite(x.hr)).filter((_,i)=>i%3===0).map(x=>[Math.round(x.m*10)/10,x.hr])
 }};
 const old=item.actual||{},km=f.distanceM==null?'':fitRound(f.distanceM/1000,3),mins=f.durationSec==null?'':fitRound(f.durationSec/60,6);
 item.actual={...old,status:'done',km,minutes:mins,fatigue:old.fatigue??'',calories:f.calories??'',avgHr:f.avgHr??'',maxHr:f.maxHr??'',note:old.note||'',segments,fitImport,savedAt:new Date().toISOString()};
 if(!saveDb())return;
 const dst=locateDate(date);if(dst)currentWeek=dst.wi;
 fitCloseModal();if(modal.classList.contains('show'))closeModal();render();if(logViewActive)renderLog();$('calendarWrap').scrollTop=0;toast(`Đã nhập FIT: ${km||'—'} km · ${fitClock(f.durationSec)}${segments.some(x=>x.actualMinutes!==''||x.actualKm!=='')?' · có dữ liệu section':''}`);
}
/* Attach a saved standalone FIT activity to the chosen structured plan, without FIT re-upload. */
window.RunPlanFITLinkStandalone=function(sourceRef,targetId,targetDate){
 const sourceDay=db.weeks[sourceRef.wi]?.days?.[sourceRef.di];
 const activity=sourceDay?.workouts?.[sourceRef.ii];
 const dest=locateDate(targetDate)?.d;
 const target=dest?.workouts?.find(x=>x.id===targetId);
 if(!activity?.fitStandalone||!activity?.actual||!target||target===activity||target.fitStandalone)return false;
 if(target.actual&&!confirm(`Bài “${target.workoutName}” đã có kết quả. Thay thế kết quả cũ bằng hoạt động “${activity.workoutName}”?`))return false;
 const srcInfo=activity.actual.fitImport||null;
 const src=srcInfo?.sectionSource;
 let segments=[];
 if(src?.points?.length>=3){
   const virtual={series:src.points.map(p=>({m:p[0],d:p[1]})),records:(src.hr||[]).map(p=>({m:p[0],hr:p[1]})),durationSec:src.durationSec,distanceM:src.distanceM,laps:[]};
   segments=fitMappedSections(virtual,target,'auto');
 }else if(srcInfo&&actualSectionPlan(target).length){
   if(!confirm('FIT này được nhập bằng phiên bản cũ, chưa lưu bản ghi cần thiết để ghép section. Vẫn ghép kết quả TỔNG vào bài kế hoạch? Muốn có section thì nhập lại FIT gốc sau khi ghép.'))return false;
 }
 const previous=target.actual;
 const srcIndex=sourceDay.workouts.indexOf(activity);
 const attached=deepClone(activity.actual);
 attached.segments=segments;
 if(srcInfo)attached.fitImport={...attached.fitImport,linkedToPlanAt:new Date().toISOString(),linkedFromDate:sourceDay.date,sectionMode:segments.length?'auto':'none'};
 target.actual=attached;
 sourceDay.workouts.splice(srcIndex,1);
 if(!saveDb()){sourceDay.workouts.splice(srcIndex,0,activity);target.actual=previous;return false;}
 const loc=locateDate(targetDate);if(loc)currentWeek=loc.wi;
 render();if(logViewActive)renderLog();
 $('calendarWrap').scrollTop=0;
 toast(segments.filter(s=>s.actualMinutes!==''||s.actualKm!=='').length?`Đã ghép FIT vào “${target.workoutName}” và cập nhật section`:(srcInfo?'Đã ghép kết quả FIT tổng vào bài kế hoạch':'Đã ghép kết quả nhập tay vào bài kế hoạch'));
 return true;
};

/* v1.8.8: batch import from several FIT files (or FIT files within ZIP archives). */
const fitBatchModal=$('fitBatchModal'),fitBatchRows=$('fitBatchRows'),fitBatchStats=$('fitBatchStats'),fitBatchProgress=$('fitBatchProgress'),fitBatchTitle=$('fitBatchTitle'),fitBatchClose=$('fitBatchCloseBtn');
let fitBatchBusy=false,fitBatchFirstDay=null;
function fitBatchEsc(x){return escapeHtml(String(x??''))}
function fitBatchStatsRender(rows){
 const linked=rows.filter(x=>x.kind==='linked').length,standalone=rows.filter(x=>x.kind==='unlinked').length,skipped=rows.filter(x=>x.kind==='skipped').length,errors=rows.filter(x=>x.kind==='error').length;
 fitBatchStats.innerHTML=[['Ghép kế hoạch',linked],['Thẻ FIT riêng',standalone],['Trùng / bỏ qua',skipped],['Lỗi',errors]].map(([k,v])=>`<div class="fit-batch-stat"><span>${k}</span><strong>${v}</strong></div>`).join('');
 fitBatchRows.innerHTML=rows.map(r=>`<tr><td><span class="filename">${fitBatchEsc(r.name)}</span><small>${fitBatchEsc(r.innerName||'')}</small></td><td>${fitBatchEsc(r.date||'—')}</td><td>${r.fit?`${fitRound((r.fit.distanceM||0)/1000,3)} km · ${fitClock(r.fit.durationSec)}`:'—'}</td><td><span class="status ${fitBatchEsc(r.kind||'skipped')}">${fitBatchEsc(({linked:'Đã ghép',unlinked:'Thẻ FIT riêng',skipped:'Bỏ qua',error:'Lỗi'})[r.kind]||'Đang đọc')}</span><small>${fitBatchEsc(r.message||'')}</small></td></tr>`).join('');
}
async function fitDecodeEntries(files){
 const good=[],bad=[];
 for(const file of files){
  try{
   const bytes=new Uint8Array(await readFileArrayBuffer(file));
   if(bytes.length>45*1024*1024)throw Error('Tệp vượt 45 MB, không xử lý.');
   const zip=/\.zip$/i.test(file.name)||(bytes.length>2&&bytes[0]===80&&bytes[1]===75);
   if(zip){
    const archive=await RunPlanXLSX.unzip(bytes),entries=[...archive.entries()].filter(([name])=>/\.fit$/i.test(name));
    if(!entries.length)throw Error('Không tìm thấy FIT trong ZIP.');
    for(const [innerName,content] of entries){
     if(good.length+bad.length>=100)throw Error('Giới hạn 100 FIT mỗi lần.');
     try{if(content.length>45*1024*1024)throw Error('FIT bên trong ZIP quá 45 MB.');const fit=RunPlanFIT.decode(content);good.push({name:file.name,innerName,fit,date:fitLocalDate(fit)});}catch(err){bad.push({name:file.name,innerName,kind:'error',message:err.message||String(err)})}
    }
   }else{
    if(good.length+bad.length>=100)throw Error('Giới hạn 100 FIT mỗi lần.');
    if(!/\.fit$/i.test(file.name))throw Error('Định dạng không phải .fit hoặc .zip.');
    const fit=RunPlanFIT.decode(bytes);good.push({name:file.name,innerName:'',fit,date:fitLocalDate(fit)});
   }
  }catch(err){bad.push({name:file.name,kind:'error',message:err.message||String(err)})}
 }
 return {good,bad};
}
function fitBatchScore(w,f){
 if(f.sport!=null&&f.sport!==1)return Infinity;
 const metrics=[];const mins=Number(w.planMinutes)||0,km=Number(w.planKm)||0;
 if(mins>0&&f.durationSec>0)metrics.push(Math.abs(f.durationSec/60-mins)/mins);
 if(km>0&&f.distanceM>0)metrics.push(Math.abs(f.distanceM/1000-km)/km);
 return metrics.length?metrics.reduce((a,b)=>a+b,0)/metrics.length:Infinity;
}
function fitBatchMatch(group,available){
 // Assignment candidates remain untouched until a non-ambiguous pair is selected.
 const matches=new Map(),used=new Set();
 if(group.length===1&&available.length===1){const g=group[0];if(g.fit.sport==null||g.fit.sport===1)matches.set(g,available[0]);return matches}
 const edges=[];
 for(const g of group)for(const w of available){const score=fitBatchScore(w,g.fit);if(Number.isFinite(score)&&score<=.5)edges.push({g,w,score})}
 edges.sort((a,b)=>a.score-b.score);
 for(const e of edges){
   if(matches.has(e.g)||used.has(e.w))continue;
   const alternative=edges.filter(x=>x.g===e.g&&x.w!==e.w&&!used.has(x.w)).sort((a,b)=>a.score-b.score)[0];
   const rival=edges.filter(x=>x.w===e.w&&x.g!==e.g&&!matches.has(x.g)).sort((a,b)=>a.score-b.score)[0];
   // Avoid guessing if two workouts or two FITs are almost equally plausible.
   if(alternative&&alternative.score-e.score<.07)continue;
   if(rival&&rival.score-e.score<.07)continue;
   matches.set(e.g,e.w);used.add(e.w);
 }
 return matches;
}
function fitBatchMakeActual(entry,item){
 const {fit:f,name,innerName}=entry,plans=item?actualSectionPlan(item):[];
 const mode=plans.length&&f.series?.length>=3&&f.sessionCount===1?'auto':'none';
 const segments=mode==='auto'?fitMappedSections(f,item,mode):[];
 const fitImport={id:f.id,source:'Garmin FIT',filename:name,innerName,startTime:f.startTime,importedAt:new Date().toISOString(),elapsedMinutes:f.elapsedSec?fitRound(f.elapsedSec/60,3):'',lapCount:f.laps.length,recordCount:f.recordCount,sectionMode:mode,crcValid:f.fileCRCValid,pauseSeconds:f.pauseSeconds??null,timerEventCount:f.timerEventCount??0,insights:fitCompactInsights(f),sectionSource:{durationSec:f.durationSec,distanceM:f.distanceM,points:(f.series||[]).filter(x=>Number.isFinite(x.m)&&Number.isFinite(x.d)).map(x=>[Math.round(x.m*100)/100,Math.round(x.d*100)/100]),hr:(f.records||[]).filter(x=>Number.isFinite(x.m)&&Number.isFinite(x.hr)).filter((_,i)=>i%3===0).map(x=>[Math.round(x.m*10)/10,x.hr])}};
 return {status:'done',km:f.distanceM==null?'':fitRound(f.distanceM/1000,3),minutes:f.durationSec==null?'':fitRound(f.durationSec/60,6),fatigue:'',calories:f.calories??'',avgHr:f.avgHr??'',maxHr:f.maxHr??'',note:'',segments,fitImport,savedAt:new Date().toISOString()};
}
function fitBatchMakeStandalone(entry){
 const display=(entry.innerName||entry.name).split(/[\\/]/).pop().replace(/\.(fit|zip)$/i,'');
 return {id:genId(),fitStandalone:true,workoutName:'Garmin FIT · '+display,workoutType:'Custom',planKm:'',planMinutes:'',description:'Hoạt động Garmin FIT nhập riêng; có thể kéo hoặc bấm nút ghép vào bài kế hoạch.',planNote:'',workoutStructure:null,actual:fitBatchMakeActual(entry,null)};
}
async function fitImportBatch(entries,bad=[]){
 if(fitBatchBusy)return;fitBatchBusy=true;fitBatchFirstDay=null;fitBatchClose.disabled=true;fitBatchProgress.style.width='10%';fitBatchModal.classList.add('show');
 const rows=[...bad],sameBatch=new Set(),accepted=[];
 const sorted=[...entries].sort((a,b)=>a.date.localeCompare(b.date)||String(a.fit.startTime||'').localeCompare(String(b.fit.startTime||'')));
 for(const entry of sorted){
  const already=fitDuplicate(entry.fit);
  if(already||sameBatch.has(entry.fit.id)){rows.push({...entry,kind:'skipped',message:already?'Đã có hoạt động này trong RunPlan.':'Tệp trùng trong lần nhập này.'});continue}
  sameBatch.add(entry.fit.id);accepted.push(entry);
 }
 fitBatchStatsRender(rows);fitBatchTitle.textContent=`Đã đọc ${entries.length+bad.length} FIT · đang ghép theo ngày…`;
 const groups=new Map();for(const entry of accepted){if(!groups.has(entry.date))groups.set(entry.date,[]);groups.get(entry.date).push(entry)}
 let count=0;
 const original=JSON.stringify(db);
 try{
  for(const [date,group] of groups){
   const loc=ensureDate(date),available=(loc.d.workouts||[]).filter(w=>!w.fitStandalone&&!w.actual);
   const assignment=fitBatchMatch(group,available);
   for(const entry of group){
    const target=assignment.get(entry);
    if(target){
      target.actual=fitBatchMakeActual(entry,target);
      rows.push({...entry,kind:'linked',message:'Ghép vào '+(target.workoutName||'Bài tập')+(target.actual.segments?.some(x=>+x.actualMinutes>0||+x.actualKm>0)?' · có section':'')});
    }else{
      loc.d.workouts.push(fitBatchMakeStandalone(entry));
      rows.push({...entry,kind:'unlinked',message:available.length?'Chưa xác định chắc bài phù hợp hoặc bài đã có kết quả; kéo thẻ để ghép.':'Ngày này chưa có bài trống; giữ thành thẻ FIT riêng.'});
    }
    if(!fitBatchFirstDay)fitBatchFirstDay=date;
    count++;
    fitBatchProgress.style.width=`${10+85*count/Math.max(1,accepted.length)}%`;
   }
  }
  if(count&&!saveDb())throw Error('Bộ nhớ trình duyệt không đủ để lưu tất cả FIT. Hãy sao lưu hoặc nhập ít file hơn.');
 }catch(err){
  db=JSON.parse(original);
  // Keep previously persisted data unchanged if this batch fails.
  fitBatchFirstDay=null;
  for(const r of rows)if(r.kind==='linked'||r.kind==='unlinked'){r.kind='error';r.message='Đã hoàn tác lần nhập: '+(err.message||err)}
  rows.push({name:'Lỗi lưu dữ liệu',kind:'error',message:err.message||String(err)});
 }
 fitBatchBusy=false;fitBatchProgress.style.width='100%';fitBatchClose.disabled=false;fitBatchStatsRender(rows);fitBatchTitle.textContent=`Đã xử lý ${entries.length+bad.length} tệp FIT`;
 if(fitBatchFirstDay){const loc=locateDate(fitBatchFirstDay);if(loc)currentWeek=loc.wi;render();if(logViewActive)renderLog();$('calendarWrap').scrollTop=0}
}
function fitBatchCloseModal(){if(fitBatchBusy)return;fitBatchModal.classList.remove('show');fitBatchFirstDay=null}
fitBatchClose.addEventListener('click',fitBatchCloseModal);
fitBatchModal.addEventListener('click',e=>{if(e.target===fitBatchModal)fitBatchCloseModal()});
async function fitHandleSelection(files){
 if(!files?.length)return;
 // Preserve the existing inspect / choose / overwrite flow for a single FIT.
 // When a ZIP contains multiple FIT entries, switch to automatic batch mode.
 const list=Array.from(files);
 if(list.length===1&&!/\.zip$/i.test(list[0].name))return fitReadUpload(list[0]);
 const {good,bad}=await fitDecodeEntries(list);
 if(list.length===1&&good.length===1&&!bad.length&&/\.zip$/i.test(list[0].name))return fitReadUpload(list[0]);
 if(!good.length&&!bad.length)throw Error('Không tìm thấy file FIT hợp lệ.');
 return fitImportBatch(good,bad);
}

$('fitImportBtn').addEventListener('click',()=>fitImportOpen());$('fitImportTopBtn').addEventListener('click',()=>fitImportOpen());$('fitImportInActual').addEventListener('click',()=>{if(!editingKey)return fitImportOpen();if(!confirm('Chọn FIT sẽ mở màn hình xem trước. Thay đổi chưa lưu trong cửa sổ hiện tại sẽ không được giữ. Tiếp tục?'))return;fitImportOpen(editingKey)});
fitInput.addEventListener('change',async e=>{const files=Array.from(e.target.files||[]);if(!files.length)return;const btn=$('fitImportTopBtn'),before=btn.textContent;btn.disabled=true;btn.textContent='Đang xử lý FIT…';try{await fitHandleSelection(files)}catch(error){console.error(error);alert('Không thể nhập Garmin FIT:\n'+(error.message||error))}finally{btn.disabled=false;btn.textContent=before;e.target.value=''}});
fitDate.addEventListener('change',fitRefreshTarget);fitTarget.addEventListener('change',fitRefreshMode);fitMode.addEventListener('change',fitUpdatePreview);fitOverwrite.addEventListener('change',()=>{fitCommit.disabled=!!fitSelectedWorkout()?.actual&&!fitOverwrite.checked});
fitCommit.addEventListener('click',fitCommitResult);$('fitCancelBtn').addEventListener('click',fitCloseModal);fitModal.addEventListener('click',e=>{if(e.target===fitModal)fitCloseModal()});
})();
