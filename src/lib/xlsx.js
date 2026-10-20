(function(root){
'use strict';
const TE = new TextEncoder();
const TD = new TextDecoder('utf-8');

function u16(dv,o){return dv.getUint16(o,true)}
function u32(dv,o){return dv.getUint32(o,true)}
function concat(parts){
  const total=parts.reduce((s,p)=>s+p.length,0); const out=new Uint8Array(total); let o=0;
  for(const p of parts){out.set(p,o);o+=p.length} return out;
}
function le16(n){const b=new Uint8Array(2);new DataView(b.buffer).setUint16(0,n,true);return b}
function le32(n){const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,n>>>0,true);return b}
function xmlDecode(s){return String(s??'').replace(/&#x([0-9a-f]+);/gi,(_,h)=>String.fromCodePoint(parseInt(h,16))).replace(/&#(\d+);/g,(_,d)=>String.fromCodePoint(parseInt(d,10))).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&')}
function xmlEscape(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;')}
function attr(tag,name){const safe=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const m=tag.match(new RegExp('(?:^|\\s)'+safe+'="([^"]*)"'));return m?xmlDecode(m[1]):''}
function resolvePath(base,target){
  if(target.startsWith('/'))return target.slice(1); const stack=base.split('/');stack.pop();
  for(const p of target.split('/')){if(!p||p==='.')continue;if(p==='..')stack.pop();else stack.push(p)}return stack.join('/');
}
async function inflateRaw(bytes){
  if(typeof DecompressionStream==='undefined')throw new Error('Trình duyệt chưa hỗ trợ giải nén XLSX trực tiếp. Trên iPhone, hãy dùng iOS/Safari 16.4 trở lên.');
  const ds=new DecompressionStream('deflate-raw');
  const stream=new Blob([bytes]).stream().pipeThrough(ds);
  return new Uint8Array(await new Response(stream).arrayBuffer());
}
async function unzip(buffer){
  const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer); const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let eocd=-1; const min=Math.max(0,bytes.length-65557);
  for(let i=bytes.length-22;i>=min;i--){if(u32(dv,i)===0x06054b50){eocd=i;break}}
  if(eocd<0)throw new Error('File không phải XLSX hợp lệ (không tìm thấy ZIP directory).');
  const entries=u16(dv,eocd+10), cdOffset=u32(dv,eocd+16); let p=cdOffset; const out=new Map();
  for(let n=0;n<entries;n++){
    if(u32(dv,p)!==0x02014b50)throw new Error('XLSX ZIP directory bị lỗi.');
    const flags=u16(dv,p+8), method=u16(dv,p+10), compSize=u32(dv,p+20), nameLen=u16(dv,p+28), extraLen=u16(dv,p+30), commentLen=u16(dv,p+32), localOffset=u32(dv,p+42);
    const nameBytes=bytes.slice(p+46,p+46+nameLen); const name=(flags&0x800)?TD.decode(nameBytes):TD.decode(nameBytes);
    if(u32(dv,localOffset)!==0x04034b50)throw new Error('XLSX ZIP local header bị lỗi.');
    const ln=u16(dv,localOffset+26), le=u16(dv,localOffset+28), dataStart=localOffset+30+ln+le; const comp=bytes.slice(dataStart,dataStart+compSize);
    let data;if(method===0)data=comp;else if(method===8)data=await inflateRaw(comp);else throw new Error('XLSX dùng kiểu nén chưa được hỗ trợ: '+method);
    out.set(name,data); p+=46+nameLen+extraLen+commentLen;
  }
  return out;
}
function textOf(map,name){const b=map.get(name);return b?TD.decode(b):''}
function parseSharedStrings(xml){
  const out=[];const re=/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g;let m;
  while((m=re.exec(xml))){let s='';const tr=/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;let tm;while((tm=tr.exec(m[1])))s+=xmlDecode(tm[1]);out.push(s)}return out;
}
function colIndex(ref){const m=String(ref).match(/^([A-Z]+)/i);if(!m)return 0;let n=0;for(const ch of m[1].toUpperCase())n=n*26+(ch.charCodeAt(0)-64);return n-1}
function parseSheet(xml,shared){
  const rows=[];const rr=/<row\b[^>]*>([\s\S]*?)<\/row>/g;let rm;
  while((rm=rr.exec(xml))){const row=[];const cr=/<c\b([^>]*)\/>|<c\b([^>]*)>([\s\S]*?)<\/c>/g;let cm;
    while((cm=cr.exec(rm[1]))){const a=cm[1]??cm[2]??'';const body=cm[3]??'';const ref=attr(a,'r');const idx=colIndex(ref);const t=attr(a,'t');let val=null;
      if(t==='inlineStr'){let s='';const tr=/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g;let tm;while((tm=tr.exec(body)))s+=xmlDecode(tm[1]);val=s}
      else{const vm=body.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/);const raw=vm?xmlDecode(vm[1]):'';if(vm){if(t==='s')val=shared[parseInt(raw,10)]??'';else if(t==='str')val=raw;else if(t==='b')val=raw==='1';else {const num=Number(raw);val=Number.isFinite(num)?num:raw}}}
      row[idx]=val;
    }
    rows.push(row);
  }
  return rows;
}
async function readFirstSheet(arrayBuffer){
  const zip=await unzip(arrayBuffer);let sheetPath='xl/worksheets/sheet1.xml';
  const wb=textOf(zip,'xl/workbook.xml'), rels=textOf(zip,'xl/_rels/workbook.xml.rels');
  if(wb&&rels){const sm=wb.match(/<sheet\b[^>]*>/);if(sm){const rid=attr(sm[0],'r:id');if(rid){const relRe=/<Relationship\b[^>]*>/g;let x;while((x=relRe.exec(rels))){if(attr(x[0],'Id')===rid){sheetPath=resolvePath('xl/workbook.xml',attr(x[0],'Target'));break}}}}}
  const sheet=textOf(zip,sheetPath);if(!sheet)throw new Error('Không tìm thấy worksheet đầu tiên trong XLSX.');
  const shared=parseSharedStrings(textOf(zip,'xl/sharedStrings.xml'));
  return parseSheet(sheet,shared);
}

const CRC_TABLE=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0}return t})();
function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=CRC_TABLE[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0}
function dosDateTime(d=new Date()){let y=Math.max(1980,d.getFullYear());const date=((y-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate();const time=(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1);return{date,time}}
function zipStore(files){
  const locals=[],centrals=[];let offset=0;const dt=dosDateTime();
  for(const f of files){const name=TE.encode(f.name);const data=typeof f.data==='string'?TE.encode(f.data):f.data;const crc=crc32(data);const local=concat([le32(0x04034b50),le16(20),le16(0x0800),le16(0),le16(dt.time),le16(dt.date),le32(crc),le32(data.length),le32(data.length),le16(name.length),le16(0),name,data]);locals.push(local);
    const central=concat([le32(0x02014b50),le16(20),le16(20),le16(0x0800),le16(0),le16(dt.time),le16(dt.date),le32(crc),le32(data.length),le32(data.length),le16(name.length),le16(0),le16(0),le16(0),le16(0),le32(0),le32(offset),name]);centrals.push(central);offset+=local.length;
  }
  const cd=concat(centrals), localAll=concat(locals);const eocd=concat([le32(0x06054b50),le16(0),le16(0),le16(files.length),le16(files.length),le32(cd.length),le32(localAll.length),le16(0)]);return concat([localAll,cd,eocd]);
}
function colName(n){let s='';n++;while(n){const r=(n-1)%26;s=String.fromCharCode(65+r)+s;n=Math.floor((n-1)/26)}return s}
function cellXml(v,r,c,style=''){
  if(v===null||v===undefined||v==='')return'';const ref=colName(c)+(r+1);const st=style?` s="${style}"`:'';
  if(typeof v==='number'&&Number.isFinite(v))return `<c r="${ref}"${st}><v>${v}</v></c>`;
  if(typeof v==='boolean')return `<c r="${ref}" t="b"${st}><v>${v?1:0}</v></c>`;
  return `<c r="${ref}" t="inlineStr"${st}><is><t xml:space="preserve">${xmlEscape(v)}</t></is></c>`;
}
function buildSheetXml(aoa){
  const rows=[];for(let r=0;r<aoa.length;r++){const vals=aoa[r]||[];let cells='';for(let c=0;c<vals.length;c++){let st='';if(r===0)st='1';else if(c===0)st='3';const v=vals[c];cells+=cellXml(v,r,c,st)}rows.push(`<row r="${r+1}">${cells}</row>`)}
  const maxCols=Math.max(1,...aoa.map(r=>r?.length||0));const dim=`A1:${colName(maxCols-1)}${Math.max(1,aoa.length)}`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="${dim}"/><cols><col min="1" max="1" width="24" customWidth="1"/><col min="2" max="${maxCols}" width="20" customWidth="1"/></cols><sheetData>${rows.join('')}</sheetData><pageMargins left="0.7" right="0.7" top="0.75" bottom="0.75" header="0.3" footer="0.3"/></worksheet>`;
}
function buildXlsxBlob(aoa,sheetName='Run tracker'){
  const files=[
    {name:'[Content_Types].xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`},
    {name:'_rels/.rels',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`},
    {name:'xl/workbook.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${xmlEscape(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`},
    {name:'xl/_rels/workbook.xml.rels',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`},
    {name:'xl/styles.xml',data:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFDDEBF7"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="4"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`},
    {name:'xl/worksheets/sheet1.xml',data:buildSheetXml(aoa)}
  ];
  return new Blob([zipStore(files)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
root.RunPlanXLSX={readFirstSheet,buildXlsxBlob,unzip,parseSheet,parseSharedStrings};
if(typeof module!=='undefined'&&module.exports)module.exports=root.RunPlanXLSX;
})(typeof globalThis!=='undefined'?globalThis:this);
