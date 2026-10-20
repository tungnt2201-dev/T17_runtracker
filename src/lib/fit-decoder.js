/* RunPlan FIT offline decoder - native fields for activity / session / lap / record.
 * FIT protocol basics: https://developer.garmin.com/fit/protocol/
 * Does not transmit, store, or parse GPS coordinates.
 */
(function (root) {
 'use strict';
 const EPOCH = Date.UTC(1989,11,31);
 const TB=[0,0xcc01,0xd801,0x1400,0xf001,0x3c00,0x2800,0xe401,0xa001,0x6c00,0x7800,0xb401,0x5000,0x9c01,0x8801,0x4400];
 function crc16(bytes,start=0,end=bytes.length){let crc=0;for(let i=start;i<end;i++){let tmp=TB[crc&15];crc=((crc>>4)&0x0fff)^tmp^TB[bytes[i]&15];tmp=TB[crc&15];crc=((crc>>4)&0x0fff)^tmp^TB[(bytes[i]>>4)&15]}return crc&65535}
 function hash(bytes){let h=2166136261>>>0;for(let i=0;i<bytes.length;i++)h=Math.imul(h^bytes[i],16777619)>>>0;return `${bytes.length.toString(16)}-${h.toString(16).padStart(8,'0')}`}
 const baseSize={0:1,1:1,2:1,3:2,4:2,5:4,6:4,7:1,8:4,9:8,10:1,11:2,12:4,13:1,14:8,15:8,16:8};
 function readField(dv,pos,size,type,little){
   const k=type&31,unit=baseSize[k];if(!unit||size<=0)return null;
   if(k===7){const b=new Uint8Array(dv.buffer,dv.byteOffset+pos,size);let end=b.indexOf(0);if(end<0)end=b.length;return new TextDecoder().decode(b.slice(0,end))}
   if(k===13)return null;
   function one(p){let v;
     switch(k){case 0:case 2:case 10:v=dv.getUint8(p);break;case 1:v=dv.getInt8(p);break;case 3:v=dv.getInt16(p,little);break;case 4:case 11:v=dv.getUint16(p,little);break;case 5:v=dv.getInt32(p,little);break;case 6:case 12:v=dv.getUint32(p,little);break;case 8:v=dv.getFloat32(p,little);break;case 9:v=dv.getFloat64(p,little);break;case 14:v=dv.getBigInt64(p,little);break;case 15:case 16:v=dv.getBigUint64(p,little);break;default:return null}
     const invalid={0:255,1:127,2:255,3:32767,4:65535,5:2147483647,6:4294967295,10:0,11:0,12:0,14:9223372036854775807n,15:0n,16:0n};
     if((k===8||k===9)&&!Number.isFinite(v))return null;
     if(invalid[k]!==undefined&&v===invalid[k])return null;
     return typeof v==='bigint'?(v>BigInt(Number.MAX_SAFE_INTEGER)?null:Number(v)):v;
   }
   if(size===unit)return one(pos);if(size%unit)return null;
   const out=[];for(let j=0;j<size;j+=unit)out.push(one(pos+j));return out;
 }
 const asNum=x=>typeof x==='number'&&Number.isFinite(x)?x:null;
 const secs=x=>asNum(x)==null?null:x/1000;
 const metres=x=>asNum(x)==null?null:x/100;
 const iso=x=>asNum(x)==null?null:new Date(EPOCH+x*1000).toISOString();
 const round=(x,d=3)=>x==null?null:Math.round(x*10**d)/10**d;
 function decode(input){
   const b=input instanceof Uint8Array?input:new Uint8Array(input),dv=new DataView(b.buffer,b.byteOffset,b.byteLength);
   if(b.length<14)throw Error('Tệp FIT quá ngắn hoặc không hợp lệ.');
   const hs=b[0];if(hs!==12&&hs!==14&&hs!==16)throw Error('FIT header không được hỗ trợ (độ dài '+hs+').');
   if(String.fromCharCode(...b.slice(8,12))!=='.FIT')throw Error('Không phải tệp .FIT hợp lệ.');
   const size=dv.getUint32(4,true),end=hs+size;if(end+2>b.length)throw Error('File FIT bị thiếu dữ liệu hoặc chưa tải xong.');
   if(size>80*1024*1024)throw Error('Bài tập FIT vượt dung lượng đọc giới hạn (80 MB).');
   const crcExpected=dv.getUint16(end,true),crcCalculated=crc16(b,0,end);
   // FIT export can have a zeroed/incorrect header CRC; only warn about file CRC, do not block correct readable content.
   const crcOk=crcExpected===crcCalculated;
   const def=new Array(16),sessions=[],laps=[],records=[],events=[];let activity=null,fileId=null,timestamp=null,offset=hs,n=0;
   while(offset<end){if(++n>450000)throw Error('File FIT chứa quá nhiều bản ghi.');const head=b[offset++],compressed=(head&0x80)!==0;
     const local=compressed?(head>>5)&3:head&15;
     if(!compressed&&(head&0x40)){
       if(offset+5>end)throw Error('FIT definition bị cắt.');
       const little=b[offset+1]!==1,global=little?dv.getUint16(offset+2,true):dv.getUint16(offset+2,false),num=b[offset+4];offset+=5;
       if(num>255||offset+3*num>end)throw Error('FIT definition field không hợp lệ.');
       const fields=[];for(let i=0;i<num;i++){fields.push([b[offset],b[offset+1],b[offset+2]]);offset+=3}
       const dev=[];if(head&0x20){if(offset>=end)throw Error('FIT developer field bị cắt.');const k=b[offset++];if(offset+3*k>end)throw Error('FIT developer field không hợp lệ.');for(let i=0;i<k;i++){dev.push([b[offset],b[offset+1],b[offset+2]]);offset+=3}}
       def[local]={little,global,fields,dev};continue;
     }
     const d=def[local];if(!d)throw Error('FIT thiếu định nghĩa cho local message '+local+'.');
     const values={};for(const [idx,count,type] of d.fields){if(offset+count>end)throw Error('Bản ghi FIT bị cắt ở offset '+offset+'.');if([0,18,19,20,21,34].includes(d.global))values[idx]=readField(dv,offset,count,type,d.little);offset+=count}
     for(const [,count] of d.dev){if(offset+count>end)throw Error('FIT developer data bị cắt.');offset+=count}
     if(compressed){if(timestamp!=null){let t=(timestamp&~31)+(head&31);if(t<timestamp)t+=32;timestamp=t;if(values[253]==null)values[253]=t}}
     else if(asNum(values[253])!=null)timestamp=values[253];
     if(d.global===18)sessions.push(values);
     else if(d.global===19)laps.push(values);
     else if(d.global===20){const t=asNum(values[253]);const dist=metres(values[5]);const speed=asNum(values[73])!=null?values[73]/1000:(asNum(values[6])!=null?values[6]/1000:null);const cad=asNum(values[4]);const power=asNum(values[7]);const altRaw=asNum(values[78])!=null?values[78]:(asNum(values[2])!=null?values[2]:null);const alt=altRaw!=null?altRaw/5-500:null;if(t!=null)records.push({t,dist,hr:asNum(values[3]),speed,cad,power,alt});}
     else if(d.global===21)events.push(values);
     else if(d.global===34)activity=values;
     else if(d.global===0)fileId=values;
   }
   if(fileId&&asNum(fileId[0])!=null&&fileId[0]!==4)throw Error('File FIT này không phải Activity (có thể là file Workout/Course).');
   if(!sessions.length&&records.length===0)throw Error('File FIT không có session hoặc dữ liệu chạy để nhập.');
   sessions.sort((a,b)=>(a[2]??a[253]??0)-(b[2]??b[253]??0));
   const session=sessions[0]||{};
   // FIT can contain multisport sessions; show first session and flag it to user.
   const firstRec=records[0],lastRec=records[records.length-1];
   const start=asNum(session[2])??firstRec?.t??asNum(fileId?.[4])??asNum(session[253]);
   const fallbackDist=firstRec?.dist!=null&&lastRec?.dist!=null?Math.max(0,lastRec.dist-firstRec.dist):null;
   const timer=secs(session[8])??secs(activity?.[0])??(firstRec&&lastRec?Math.max(0,lastRec.t-firstRec.t):null);
   const elapsed=secs(session[7])??(firstRec&&lastRec?Math.max(0,lastRec.t-firstRec.t):null);
   const distance=metres(session[9])??fallbackDist;
   if(!(timer>0||distance>0))throw Error('FIT không chứa thời gian hoặc quãng đường hợp lệ.');
   const zoneOffset=(asNum(activity?.[5])!=null&&asNum(activity?.[253])!=null)?activity[5]-activity[253]:null;
   const outputLaps=laps.map((l,i)=>({index:i+1,start:iso(l[2]),durationSec:secs(l[8])??secs(l[7]),elapsedSec:secs(l[7]),distanceM:metres(l[9]),avgHr:asNum(l[15]),avgCad:asNum(l[17]),avgPower:asNum(l[19]),totalAscent:asNum(l[21]),totalDescent:asNum(l[22])})).filter(l=>(l.durationSec??0)>0||(l.distanceM??0)>0);
   records.sort((a,b)=>a.t-b.t);
   const fromTs=records[0]?.t??start,toTs=records[records.length-1]?.t??fromTs;
   // FIT event=timer(0), event_type=start(0)/stop(1)/stop_all(4): exact pause intervals.
   const timerEvents=events.filter(e=>e[0]===0&&asNum(e[253])!=null&&[0,1,4,8,9].includes(e[1])).sort((a,b)=>a[253]-b[253]);
   const intervals=[];let activeStart=null;
   for(const e of timerEvents){const t=e[253],typ=e[1];if(typ===0){if(activeStart===null)activeStart=t;}else if(activeStart!==null){if(t>activeStart)intervals.push([activeStart,t]);activeStart=null;}}
   if(activeStart!==null&&toTs>activeStart)intervals.push([activeStart,toTs]);
   // A file without timer events uses recorded timestamps. Never silently synthesize pause durations.
   if(!intervals.length&&toTs>fromTs)intervals.push([fromTs,toTs]);
   const timerSeconds=intervals.reduce((sum,[a,c])=>sum+c-a,0);
   const timeScale=timer>0&&timerSeconds>0?timer/timerSeconds:1;
   function movingAt(t){let sec=0;for(const [a,c] of intervals){if(t<=a)break;sec+=Math.max(0,Math.min(t,c)-a);if(t<c)break;}return Math.max(0,sec*timeScale)}
   let recordFirstDistance=records.find(x=>x.dist!=null)?.dist??0;
   // 'm' is cumulative workout Timer Time (pause removed), 't' is raw FIT timestamp.
   const normalized=[];for(const r of records){if(r.dist==null)continue;const last=normalized[normalized.length-1];const dist=Math.max(0,r.dist-recordFirstDistance);if(last&&r.t<=last.t)continue;normalized.push({t:r.t,m:round(movingAt(r.t),4),d:Math.max(last?.d??0,dist)})}
   const compactRecords=records.map(r=>({t:r.t,m:round(movingAt(r.t),4),d:r.dist!=null?round(Math.max(0,r.dist-recordFirstDistance),2):null,hr:r.hr??null,s:r.speed!=null?round(r.speed,3):null,c:r.cad??null,p:r.power??null,a:r.alt!=null?round(r.alt,1):null}));
   return {source:'garmin-fit',id:hash(b),fileCRCValid:crcOk,fileBytes:b.length,startTime:iso(start),zoneOffsetSeconds:zoneOffset,sessionCount:sessions.length,sport:asNum(session[5]),subSport:asNum(session[6]),durationSec:round(timer,2),elapsedSec:round(elapsed,2),distanceM:round(distance,2),calories:asNum(session[11]),avgHr:asNum(session[16]),maxHr:asNum(session[17]),recordCount:records.length,laps:outputLaps,series:normalized,records:compactRecords,timerEvents:timerEvents.map(e=>({t:e[253],type:e[1]})),pauseSeconds:round(Math.max(0,(elapsed??(toTs-fromTs))-(timer??timerSeconds)),2),timerEventCount:timerEvents.length};
 }
 root.RunPlanFIT={decode,crc16,hash};
 if(typeof module!=='undefined'&&module.exports)module.exports=root.RunPlanFIT;
})(typeof globalThis!=='undefined'?globalThis:this);
