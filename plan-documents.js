(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FieldDocuments=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const LIMIT=20*1024*1024,MAX=600;
 const norm=x=>String(x??'').replace(/[\s·ㆍ_\-()（）\n\r:：/]/g,'').toLowerCase();
 const num=x=>{if(x==null||String(x).trim()===''||/미산정|미제공|미정|해당없음|—/.test(String(x)))return null;const n=Number(String(x).replace(/,/g,'').replace(/^WD\s*/i,''));return Number.isFinite(n)?n:null;};
 const day=x=>{const n=num(x);return Number.isInteger(n)&&n>=1&&n<=120?n:null;};
 const unit=x=>({'톤':'t','ton':'t','TON':'t','KG':'kg','킬로그램':'kg','EA':'개','ea':'개'}[String(x).trim()]||String(x??'').trim());
 const xmlText=x=>String(x??'').replace(/<[^>]*>/g,'').replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,v)=>v[0]==='#'?String.fromCodePoint(v[1].toLowerCase()==='x'?parseInt(v.slice(2),16):Number(v.slice(1))):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"}[v.toLowerCase()]));
 const attrs=x=>Object.fromEntries([...x.matchAll(/([\w:.-]+)\s*=\s*["']([^"']*)["']/g)].map(m=>[m[1],xmlText(m[2])]));
 const tag=(x,name)=>{const m=x.match(new RegExp('<(?:\\w+:)?'+name+'(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?'+name+'>'));return m?xmlText(m[1]):null;};
 const column=s=>[...s.toUpperCase()].reduce((a,c)=>a*26+c.charCodeAt(0)-64,0)-1;
 function csv(text){const rows=[];let row=[],s='',quote=false;for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quote&&text[i+1]==='"'){s+='"';i++;}else quote=!quote;}else if(c===','&&!quote){row.push(s);s='';}else if(/[\r\n]/.test(c)&&!quote){if(c==='\r'&&text[i+1]==='\n')i++;row.push(s);if(row.some(x=>x.trim()))rows.push(row);row=[];s='';}else s+=c;}if(quote)throw Error('CSV 따옴표가 닫히지 않았습니다.');row.push(s);if(row.some(x=>x.trim()))rows.push(row);return rows;}
 async function unzip(data){
  const a=new Uint8Array(data),v=new DataView(a.buffer,a.byteOffset,a.byteLength);let e=-1;
  for(let p=a.length-22;p>=Math.max(0,a.length-65557);p--)if(v.getUint32(p,true)===0x06054b50){e=p;break;}
  if(e<0)throw Error('올바른 XLSX 파일이 아닙니다. XLS 형식은 XLSX로 저장해 주세요.');
  const n=v.getUint16(e+10,true),start=v.getUint32(e+16,true);if(n>2000)throw Error('엑셀 내부 파일이 너무 많습니다. 필요한 시트만 별도 저장해 주세요.');
  const entries=new Map();let p=start,total=0;
  for(let i=0;i<n;i++){
   if(p+46>a.length||v.getUint32(p,true)!==0x02014b50)throw Error('엑셀 압축 정보를 읽을 수 없습니다.');
   const flags=v.getUint16(p+8,true),method=v.getUint16(p+10,true),size=v.getUint32(p+20,true),raw=v.getUint32(p+24,true),nl=v.getUint16(p+28,true),el=v.getUint16(p+30,true),cl=v.getUint16(p+32,true),offset=v.getUint32(p+42,true);
   const name=new TextDecoder().decode(a.subarray(p+46,p+46+nl));total+=raw;
   if(flags&1)throw Error('암호가 설정된 엑셀은 암호를 해제한 사본을 추가해 주세요.');
   if(raw>40*1024*1024||total>100*1024*1024)throw Error('압축 해제 크기가 너무 큽니다. 필요한 시트만 저장해 주세요.');
   entries.set(name,{method,size,raw,offset});p+=46+nl+el+cl;
  }
  return async name=>{
   const e=entries.get(name);if(!e)return '';
   const q=e.offset;if(q+30>a.length||v.getUint32(q,true)!==0x04034b50)throw Error('엑셀 내부 파일을 읽을 수 없습니다.');
   const pos=q+30+v.getUint16(q+26,true)+v.getUint16(q+28,true);if(pos+e.size>a.length)throw Error('엑셀 파일이 손상되었습니다.');
   let bytes=a.slice(pos,pos+e.size);
   if(e.method===8){try{bytes=new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());}catch(_){throw Error('엑셀 압축 해제에 실패했습니다. 최신 브라우저에서 열거나 CSV로 저장해 주세요.');}}
   else if(e.method!==0)throw Error('지원하지 않는 엑셀 압축 방식입니다.');
   if(bytes.length!==e.raw)throw Error('엑셀 데이터 크기가 올바르지 않습니다.');
   return new TextDecoder().decode(bytes).replace(/(<\/?)[A-Za-z_][\w.-]*:/g,'$1');
  };
 }
 async function xlsx(buffer){
  const read=await unzip(buffer),workbook=await read('xl/workbook.xml'),rels=await read('xl/_rels/workbook.xml.rels'),ss=await read('xl/sharedStrings.xml');
  const shared=[...ss.matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(m=>[...m[1].matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(x=>xmlText(x[1])).join(''));
  const links=new Map([...rels.matchAll(/<Relationship\b([^>]*?)\/?\s*>/g)].map(m=>{const a=attrs(m[1]);return [a.Id,a];}));
  const sheets=[];
  for(const sm of workbook.matchAll(/<sheet\b([^>]*?)\/?\s*>/g)){
   const a=attrs(sm[1]),r=links.get(a['r:id']);if(!r||r.TargetMode==='External')continue;
   const path=r.Target.startsWith('/')?r.Target.slice(1):'xl/'+r.Target.replace(/^\.\//,'');if(path.includes('..'))continue;
   const xml=await read(path),rows=[];
   for(const rm of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>/g)){
    const rn=Number(attrs(rm[1]).r);if(!rn||rn>4000)continue;const row=[];
    for(const cm of rm[2].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){
     const ca=attrs(cm[1]),ci=column((ca.r||'').replace(/\d/g,''));if(ci<0||ci>80)continue;const body=cm[2]||'',vv=tag(body,'v');let value;
     if(ca.t==='s')value=shared[Number(vv)]??'';
     else if(ca.t==='inlineStr')value=[...body.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m=>xmlText(m[1])).join('');
     else if(ca.t==='str'||ca.t==='e')value=vv;
     else value=vv==null?null:(Number.isFinite(Number(vv))?Number(vv):vv);
     row[ci]=value;
    }rows[rn-1]=row;
   }
   const merges=[...xml.matchAll(/<mergeCell\b[^>]*ref="([A-Z]+)(\d+):([A-Z]+)(\d+)"/g)].map(m=>({c1:column(m[1]),r1:Number(m[2])-1,c2:column(m[3]),r2:Number(m[4])-1}));
   const filled=rows.map(r=>(r||[]).slice());for(const m of merges){if(m.r2>=4000||m.c2>80||(m.r2-m.r1+1)*(m.c2-m.c1+1)>20000)continue;const vv=filled[m.r1]?.[m.c1];for(let r=m.r1;r<=m.r2;r++){filled[r]||=[];for(let c=m.c1;c<=m.c2;c++)filled[r][c]??=vv;}}
   sheets.push({name:a.name,rows:filled,originalRows:rows});
  }if(!sheets.length)throw Error('읽을 수 있는 엑셀 시트가 없습니다.');return sheets;
 }
 const aliases={building:['동','건물','대상동','사용동','사용동·공정','지도구역','zone','building'],phase:['공정','공정명','작업','작업명','사용공정','사용동·공정','name','phase'],start:['착수WD','사용착수WD','세부사용시작WD','사용시작WD','시작WD','day','startWD','start'],end:['완료WD','사용완료WD','종료WD','endDay','endWD','end'],arrival:['반입WD','반입일예정WD','반입일','입고일','arrivalWD','deliveryWD','arrivalDay'],quantity:['반영수량','사용계획량','투입량','반입량계획','반입량','수량','수요개수','quantity','qty'],item:['등록품목','품목','품명','원자료품목','item','itemId'],spec:['등록규격','규격','계획규격','원자료규격','spec'],unit:['단위','unit'],length:['철근길이mm','길이mm','길이','lengthMm'],returnDay:['회수WD','회수일','returnDay'],status:['대조결과','물량반영','상태','status'],weight:['단위중량kg','unitWeightKg'],totalWeight:['자재중량kg','총중량kg']};
 function mapping(row){const values=(row||[]).map(norm),m={};for(const [k,list] of Object.entries(aliases)){for(const a of list){const j=values.indexOf(norm(a));if(j>=0){m[k]=j;break;}}}return m;}
 function get(row,m,key){return m[key]==null?null:row[m[key]];}
 function bldg(value){const s=String(value??'');return (s.match(/(?:B-)?(10[1-9]|11[0-3])(?:동)?/)||[])[1]||'';}
 function resolve(itemText,specText,code,MC){
  const all=String(itemText??'')+' '+String(specText??'')+' '+String(code??''),nn=norm(all),sp=norm(specText).replace(/,/g,'').replace(/×|\*/g,'x').replace(/mm/g,'');
  let item=MC.items.find(i=>norm(itemText)===norm(i.name)||itemText===i.id)||MC.items.filter(i=>nn.includes(norm(i.name))).sort((a,b)=>b.name.length-a.name.length)[0];
  if(!item&&/\bD(?:10|13|16|19|22|25|29|32|35|38|41|43|51|57)\b/i.test(all))item=MC.get('rebar');
  const generic=/U헤드|U.?HEAD/i.test(all)?'동바리 상부자키':/베이스.?잭|BASE.?JACK/i.test(all)?'동바리 하부자키':/연결.?카[플프]링/.test(all)?'카플링(소켓)':null;
  if(!item&&generic)item=MC.get('shoring');if(!item)return null;
  let spec=item.specs.find(s=>norm(s).replace(/,/g,'')===sp);
  if(item.id==='rebar')spec=(all.match(/\b(D(?:10|13|16|19|22|25|29|32|35|38|41|43|51|57))\b/i)||[])[1]?.toUpperCase();
  if(!spec&&generic&&item.id==='shoring')spec=generic;
  if(!spec){const lines=String(specText??'').split(/[\n\r]+/).map(s=>norm(s).replace(/,/g,'').replace(/×|\*/g,'x').replace(/mm/g,''));spec=item.specs.find(s=>lines.includes(norm(s).replace(/,/g,'')));}
  if(!spec&&item.id==='euroform'){const pairs=[...String(specText??'').replace(/,/g,'').matchAll(/(\d+)\s*[×x*]\s*(\d+)/gi)].map(m=>m[1]+'x'+m[2]);spec=item.specs.find(s=>pairs.includes(s));}
  if(!spec||!item.specs.includes(spec))return null;return {material:item.type,itemId:item.id,spec};
 }
 function normalizeRow(row,m,context,MC){
  const specText=get(row,m,'spec'),itemText=get(row,m,'item')||context.item||'',building=bldg(get(row,m,'building'))||bldg(get(row,m,'phase'))||context.building||'';
  const selected=resolve(itemText,specText,row.join(' '),MC),phaseRaw=String(get(row,m,'phase')||context.phase||'').replace(/\n/g,' ').trim();
  const phase=phaseRaw.replace(/^(?:B-)?\d{3}동?\s*\/\s*/,'').replace(/(?:반입 예정|작업장 불출 예정)$/,'').trim();
  const quantity=num(get(row,m,'quantity')),u=unit(get(row,m,'unit'));
  const totalWeight=num(get(row,m,'totalWeight')),unitWeightKg=num(get(row,m,'weight'))??(quantity>0&&totalWeight>0?totalWeight/quantity:null);
  const status=String(get(row,m,'status')||'');
  return {id:'',zone:building?'B-'+building:'',building,phase,name:phase||String(itemText||'자재'),...selected,material:selected?.material||'rebar',itemId:selected?.itemId||'',spec:selected?.spec||String(specText||''),unit:u,quantity,day:day(get(row,m,'start')),endDay:day(get(row,m,'end')),arrivalDay:day(get(row,m,'arrival')),returnDay:day(get(row,m,'returnDay')),lengthMm:num(get(row,m,'length')),unitWeightKg,originalSpec:String(specText||''),source:context.source,
   included:!!selected&&quantity!=null&&!/미산정|미등록|제외/.test(status),issue:!selected?'등록 품목·규격 불일치':quantity==null?'수량 미산정':!u?'단위 확인 필요':null};
 }
 function tables(sheet){
  const out=[];for(let i=0;i<sheet.rows.length;i++){const m=mapping(sheet.rows[i]);if(Object.keys(m).length>=3&&(m.phase!=null||m.spec!=null)&&((m.start!=null)||(m.arrival!=null))){out.push({row:i,m});}}
  return out;
 }
 function scan(sheet,kind,MC){
  const phases=[],usage=[],arrivals=[],issues=[];let recognized=0;
  for(const t of tables(sheet)){
   const m=t.m,isLedger=m.arrival!=null&&norm(sheet.rows[t.row]?.[m.arrival]).includes('예정wd'),next=tables(sheet).find(x=>x.row>t.row)?.row??sheet.rows.length;
   const meta=sheet.rows.slice(Math.max(0,t.row-5),t.row).flat().filter(x=>x!=null).join(' '),item=(meta.match(/품명\s*[:：]\s*(.+?)(?=\s*\/|\s*단위|$)/)||[])[1]||'';
   for(let i=t.row+1;i<next;i++){
    const row=sheet.rows[i]||[],raw=sheet.originalRows?.[i]||row;
    if(!row.some(v=>v!=null&&String(v).trim())||row.some((v,c)=>c<4&&/합계|총계|등록 규격 반영/.test(String(v))))continue;
    if(isLedger&&num(raw[m.quantity])==null)continue;
    const start=day(get(row,m,'start')),end=day(get(row,m,'end'))??start,phase=String(get(row,m,'phase')||'').trim(),building=bldg(get(row,m,'building'))||bldg(phase);
    if(kind==='schedule'&&phase&&start!=null&&m.quantity==null&&m.spec==null){phases.push({id:'P-'+phases.length,zone:building?'B-'+building:'',name:phase,day:start,endDay:end,source:`${sheet.name}!${i+1}`});recognized++;continue;}
    if(m.quantity==null||m.spec==null)continue;
    const r=normalizeRow(row,m,{item,source:`${sheet.name}!${i+1}`},MC);
    if(kind==='schedule'&&m.start!=null&&phase){usage.push(r);recognized++;}
    if(kind==='delivery'&&m.arrival!=null){if(r.arrivalDay==null&&r.quantity==null)continue;arrivals.push({...r,day:r.arrivalDay,kind:'arrival'});recognized++;}
    if(r.issue)issues.push(`${r.source}: ${r.issue}${r.originalSpec?' ('+r.originalSpec+')':''}`);
   }
  }
  return {phases,usage,arrivals,issues,recognized};
 }
 function parseBook(sheets,kind,MC,selectedSheet){
  const scans=sheets.filter(s=>!selectedSheet||s.name===selectedSheet).map(s=>({sheet:s,...scan(s,kind,MC)}));
  const best=(field)=>scans.slice().sort((a,b)=>{const score=x=>x[field].length*2+(/원자료|마스터|요약|총괄|산출/.test(x.sheet.name)?-100:0)+(/자재수불부|공정별자재사용|공정별자재/.test(x.sheet.name)?40:0);return score(b)-score(a);})[0];
  let phases=[],usage=[],arrivals=[],issues=[];
  if(kind==='schedule'){
   const p=best('phases'),u=best('usage');phases=p?.phases||[];usage=u?.usage||[];issues=u?.issues||[];
   if(!phases.length){const seen=new Set();for(const r of usage){const key=r.zone+'|'+r.phase+'|'+r.day+'|'+r.endDay;if(!seen.has(key)&&r.day!=null){seen.add(key);phases.push({id:'P-'+phases.length,zone:r.zone,name:r.phase,day:r.day,endDay:r.endDay??r.day,source:r.source});}}}
  }else{const a=best('arrivals');arrivals=a?.arrivals||[];issues=a?.issues||[];}
  if(!selectedSheet&&sheets.every(s=>/^PDF /.test(s.name))){phases=scans.flatMap(s=>s.phases);usage=scans.flatMap(s=>s.usage);arrivals=scans.flatMap(s=>s.arrivals);issues=scans.flatMap(s=>s.issues);for(const s of scans)if(!s.recognized&&s.sheet.rows.some(r=>r?.length))issues.push(s.sheet.name+': 표 열을 확인하지 못했습니다. VLM으로 전체 문서를 읽을 수 있습니다.');}
  if(phases.length>200||usage.length>MAX||arrivals.length>MAX)throw Error('공정은 200개, 규격별 자재 행은 600개까지 추가할 수 있습니다.');
  phases.forEach((r,i)=>r.id='FP-'+(i+1));usage.forEach((r,i)=>r.id='FU-'+(i+1));arrivals.forEach((r,i)=>r.id='FD-'+(i+1));
  return {kind,phases,usage,arrivals,issues:[...new Set(issues)],sheets:sheets.map(s=>s.name),parsedSheets:scans.filter(s=>s.recognized).map(s=>s.sheet.name)};
 }
 function parseMapped(sheet,headerRow,m,kind,MC){
  const phases=[],usage=[],arrivals=[],issues=[];for(let i=headerRow;i<sheet.rows.length;i++){
   const row=sheet.rows[i]||[];if(!row.some(x=>x!=null&&String(x).trim()))continue;
   const r=normalizeRow(row,m,{source:`${sheet.name}!${i+1}`},MC);
   if(kind==='schedule'&&m.quantity==null&&r.day!=null){phases.push({id:'FP-'+phases.length,zone:r.zone,name:r.phase,day:r.day,endDay:r.endDay??r.day,source:r.source});continue;}
   if(kind==='schedule')usage.push({...r,id:'FU-'+(usage.length+1)});else arrivals.push({...r,id:'FD-'+(arrivals.length+1),day:r.arrivalDay});if(r.issue)issues.push(r.source+': '+r.issue);
  }
  if(!phases.length)for(const r of usage)if(!phases.some(p=>p.zone===r.zone&&p.name===r.phase))phases.push({id:'FP-'+phases.length,zone:r.zone,name:r.phase,day:r.day,endDay:r.endDay??r.day,source:r.source});
  return {kind,phases,usage,arrivals,issues,sheets:[sheet.name],parsedSheets:[sheet.name]};
 }
 async function read(file){
  if(!file||file.size>LIMIT)throw Error('파일은 최대 20MB입니다.');const ext=file.name.split('.').pop().toLowerCase();
  if(ext==='xlsx')return {sheets:await xlsx(await file.arrayBuffer()),format:'xlsx'};
  if(ext==='csv')return {sheets:[{name:'CSV',rows:csv((await file.text()).replace(/^\uFEFF/,''))}],format:'csv'};
  if(ext==='pdf')return readPdf(file);throw Error('XLSX·PDF·CSV 파일을 선택해 주세요.');
 }
 async function readPdf(file){
  const pdfjs=await import('./pdf-reader.js');pdfjs.GlobalWorkerOptions.workerSrc=new URL('./pdf-reader-worker.js',location.href).href;
  const pdf=await pdfjs.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,useSystemFonts:true}).promise;
  if(pdf.numPages>30){await pdf.destroy();throw Error('PDF는 30쪽까지 읽을 수 있습니다. 필요한 쪽만 별도로 저장해 주세요.');}
  const sheets=[],pages=[];let text='';
  for(let p=1;p<=pdf.numPages;p++){
   const page=await pdf.getPage(p),tc=await page.getTextContent(),lines=[];
   for(const item of tc.items.filter(x=>x.str?.trim())){const y=item.transform[5],x=item.transform[4];let line=lines.find(l=>Math.abs(l.y-y)<3);if(!line){line={y,items:[]};lines.push(line);}line.items.push({x,text:item.str,width:item.width});}
   lines.sort((a,b)=>b.y-a.y);const sorted=lines.map(l=>l.items.sort((a,b)=>a.x-b.x));
   let anchors=[];for(const line of sorted){if(Object.keys(mapping(line.map(i=>i.text))).length>=3){anchors=line.map(i=>i.x);break;}}
   const rows=sorted.map(line=>{if(!anchors.length)return line.map(i=>i.text);const row=[];for(const it of line){let idx=0;for(let c=1;c<anchors.length;c++)if(Math.abs(anchors[c]-it.x)<Math.abs(anchors[idx]-it.x))idx=c;row[idx]=(row[idx]?row[idx]+' ':'')+it.text;}return row;});
   sheets.push({name:'PDF '+p+'쪽',rows});text+=`\n[${p}쪽]\n`+sorted.map(l=>l.map(i=>i.text).join(' | ')).join('\n');pages.push(page);
  }
  return {sheets,format:'pdf',text,pdf,pages,async images(){if(pages.length>8)throw Error('VLM으로 읽을 스캔 PDF는 8쪽 이하로 나누어 추가해 주세요.');const images=[];for(const page of pages){const initial=page.getViewport({scale:1}),viewport=page.getViewport({scale:Math.min(2,1500/initial.width)}),canvas=document.createElement('canvas');canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);await page.render({canvasContext:canvas.getContext('2d'),viewport}).promise;images.push(canvas.toDataURL('image/jpeg',.85));canvas.width=canvas.height=0;}return images;}};
 }
 const key=r=>[r.itemId,r.spec,r.lengthMm||'',r.widthMm||'',r.heightMm||'',unit(r.unit)].join('|');
 function normalizeAI(result,kind,MC){
  const phases=(result.phases||[]).map((p,i)=>({id:'FP-'+(i+1),zone:p.zone||'',name:p.name,day:day(p.day),endDay:day(p.endDay),source:'PDF VLM'}));
  const cv=(r,i,prefix)=>{const sel=resolve(r.itemId,r.spec,'',MC);return {...r,...sel,id:prefix+(i+1),unit:unit(r.unit),day:day(r.day),endDay:day(r.endDay),quantity:num(r.quantity),lengthMm:num(r.lengthMm),returnDay:day(r.returnDay),included:!!sel&&num(r.quantity)!=null,source:'PDF VLM',issue:sel?null:'등록 규격 불일치'};};
  return {kind,phases,usage:(result.usage||[]).map((r,i)=>cv(r,i,'FU-')),arrivals:(result.arrivals||[]).map((r,i)=>cv(r,i,'FD-')),issues:result.warnings||[],sheets:['PDF VLM'],parsedSheets:['PDF VLM']};
 }
 function sync(state){
  const f=state.filePlanning;if(!f?.enabled)return;
  const doc=f.schedule,delivery=f.delivery;
  const rows=doc?.usage?.length?doc.usage:[];
  state.tasks=rows.filter(r=>r.included!==false&&r.itemId&&r.spec&&r.quantity!=null&&r.quantity>0).map(r=>({...r,phaseId:doc.phases.find(p=>p.zone===r.zone&&p.name===r.phase)?.id,material:r.material,day:r.day,endDay:r.endDay??r.day,returnDay:r.material==='rebar'?null:r.returnDay}));
  state.deliveries=(delivery?.arrivals||[]).filter(r=>r.included!==false&&r.itemId&&r.spec&&r.quantity!=null&&r.quantity>0).map(r=>({...r,material:r.material,fixedDay:true}));
  state.deliveryAuto=false;state.supplyMode='start';
  const max=Math.max(3,...(doc?.phases||[]).flatMap(r=>[r.day||0,r.endDay||0]),...state.tasks.flatMap(r=>[r.day||0,r.endDay||0,r.returnDay||0]),...state.deliveries.map(r=>r.day||0));
  if(max>state.horizon){const old=state.horizon;state.horizon=Math.min(120,max);state.zones.forEach(z=>{if(z.end===old)z.end=state.horizon;});}
 }
 function compile(state,E){
  sync(state);const f=state.filePlanning,errors=[],warnings=[];
  if(!f?.schedule)errors.push('공정표를 추가해 주세요.');if(!f?.delivery)errors.push('자재반입표를 추가해 주세요.');
  if(!state.tasks.length)errors.push('공정표에서 읽은 자재 사용 수량이 없습니다. 미산정 행의 수량·규격을 확인해 주세요.');
  const p={...state,materials:{},tasks:[],deliveries:[],lots:[],fileModel:true,deliveryAuto:false,supplyMode:'start'},resources=new Map();
  const rows=[...state.tasks,...state.deliveries];
  const groupNames={rebar:'철근',formwork:'거푸집',shoring:'동바리'};
  for(const r of rows){
   if(!['113','112','104','105'].includes(String(r.zone).replace('B-',''))&&state.scheduleScope?.id==='piloti4')errors.push(r.name+': 113·112·104·105동 중 작업 구역을 선택해 주세요.');
   if(!['kg','t','본','장','개','묶음','세트'].includes(unit(r.unit)))errors.push(r.name+': 수량 단위를 확인해 주세요.');
   const k=key(r);if(resources.has(k))continue;const id='SKU-'+(resources.size+1);resources.set(k,id);
   const group=r.material,ref=state.lots.filter(l=>l.type===group&&l.state==='stored'&&l.quantity>0&&E.validPolygon(l.polygon));
   const oldUnit=state.materials[group]?.unit,weight=r.unitWeightKg>0?r.unitWeightKg:(r.unit==='kg'?1:r.unit==='t'?1000:group==='rebar'?(state.quantityBasis?.rebar_bundle_kg||1000):group==='formwork'?25:15);
   const oldWeight=oldUnit==='kg'?1:oldUnit==='t'?1000:group==='rebar'?(state.quantityBasis?.rebar_bundle_kg||1000):group==='formwork'?25:15;
   let density=ref.length?ref.reduce((s,l)=>s+E.area(l.polygon),0)/ref.reduce((s,l)=>s+l.quantity,0)*(oldUnit===r.unit?1:weight/oldWeight):null;
   if(!(density>0)){const slots=E.slotsFor(state.zones.map(z=>({...z,confirmed:true})));const smallest=slots.length?Math.min(...slots.map(s=>E.area(s.polygon))):100;const largest=Math.max(1,...rows.filter(x=>key(x)===k).map(x=>x.quantity));density=smallest*.35/largest;}
   const b=ref.length?E.bbox(ref[0].polygon):{w:1,h:1};
   p.materials[id]={name:(r.itemId==='rebar'?'철근':r.itemId==='euroform'?'유로폼':groupNames[group])+' '+r.spec,quantity:0,unit:r.unit,group,itemId:r.itemId,spec:r.spec,lengthMm:r.lengthMm,density,aspect:b.w/b.h,unitWeightKg:weight};
  }
  const resourceFor=r=>resources.get(key(r));
  for(const r of state.tasks){const resource=resourceFor(r);p.tasks.push({...r,material:resource});}
  for(const r of state.deliveries){const resource=resourceFor(r);p.deliveries.push({...r,material:resource});p.materials[resource].quantity+=r.quantity;}
  for(const l of state.lots.filter(l=>l.state==='stored'&&l.quantity>0)){
   const originalUnit=l.unit||state.materials[l.type]?.unit,resource=resources.get(key({...l,unit:originalUnit}));
   if(!resource)continue;p.lots.push({...l,type:resource,unit:originalUnit});p.materials[resource].quantity+=l.quantity;
  }
  for(const [id,m] of Object.entries(p.materials)){
   const needs=p.tasks.filter(t=>t.material===id),dels=p.deliveries.filter(d=>d.material===id);
   const dates=[...new Set(needs.map(t=>t.day))].sort((a,b)=>a-b);for(const d of dates){if(!Number.isInteger(d))continue;const needed=needs.filter(t=>t.day<=d).reduce((s,t)=>s+t.quantity,0),arrived=dels.filter(t=>Number.isInteger(t.day)&&t.day<=d).reduce((s,t)=>s+t.quantity,0)+p.lots.filter(l=>l.type===id).reduce((s,l)=>s+l.quantity,0)+needs.filter(t=>t.returnDay!=null&&t.returnDay<=d).reduce((s,t)=>s+t.quantity,0);if(needed>arrived+1e-6){errors.push(`${m.name}: WD ${d}까지 ${Number((needed-arrived).toFixed(3))}${m.unit} 반입 부족`);break;}}
  }
  const excluded=[...(f.schedule?.usage||[]),...(f.delivery?.arrivals||[])].filter(r=>r.included===false).length;if(excluded)warnings.push('미산정·제외 '+excluded+'행을 제외한 부분 계획입니다.');
  warnings.push('품목·규격·길이·단위별 재고를 구분합니다. 적치 면적은 관측 밀도 또는 슬롯 비율 가정이며 실측 면적이 아닙니다. 반입일은 첨부 계획대로 고정합니다.');
  return {state:p,errors:[...new Set(errors)],warnings,resources};
 }
 function audit(state,E,confirmed){if(!state.filePlanning?.enabled)return E.audit(state,confirmed);const c=compile(state,E),a=E.audit(c.state,confirmed);return {errors:[...new Set([...c.errors,...a.errors])],warnings:[...c.warnings,...a.warnings]};}
 function calculate(state,E,options){
  if(!state.filePlanning?.enabled)return E.calculate(state,320);const c=compile(state,E);if(c.errors.length)return {error:c.errors.join('\n'),warnings:c.warnings};
  const result=E.calculateMO(c.state,options);if(result.error)return {...result,warnings:[...c.warnings,...(result.warnings||[])]};
  function display(r){if(!r)return r;const meta=id=>c.state.materials[id];return {...r,skuMoves:Object.entries(r.moves).map(([id,quantity])=>({...meta(id),quantity})),moves:{rebar:0,formwork:0,shoring:0},events:r.events.map(e=>({...e,resource:e.material,material:meta(e.material).group,unit:meta(e.material).unit})),snapshots:r.snapshots.map(s=>({...s,lots:s.lots.map(l=>({...l,resource:l.type,type:meta(l.type).group,unit:meta(l.type).unit}))}))};}
  return {...result,baseline:display(result.baseline),front:result.front.map(display),representatives:result.representatives.map(display),warnings:[...c.warnings,...result.warnings],documentRevision:state.filePlanning.revision};
 }
 let calculationJob=null;
 function cancelCalculation(){if(!calculationJob)return;const job=calculationJob;calculationJob=null;clearTimeout(job.timer);job.worker.terminate();job.reject(Object.assign(Error('입력이 변경되어 이전 계산을 중단했습니다.'),{cancelled:true}));}
 function calculateAsync(state,E){
  if(!state.filePlanning?.enabled||typeof Worker==='undefined')return Promise.resolve(calculate(state,E));
  cancelCalculation();return new Promise((resolve,reject)=>{const worker=new Worker('./planning-worker.js');const finish=(error,value)=>{clearTimeout(job.timer);worker.terminate();if(calculationJob===job)calculationJob=null;error?reject(error):resolve(value);};const job={worker,reject,timer:setTimeout(()=>finish(Error('대안 계산 시간이 초과했습니다. 입력 행 또는 반입 단위를 확인해 주세요.')),120000)};calculationJob=job;worker.onmessage=e=>e.data.error?finish(Error(e.data.error)):finish(null,e.data.result);worker.onerror=()=>finish(Error('배치 계산을 시작하지 못했습니다. 새로고침 후 다시 계산해 주세요.'));worker.postMessage({state:{...state,image:'',results:null}});});
 }
 return {norm,num,day,unit,csv,xlsx,read,parseBook,parseMapped,mapping,resolve,normalizeAI,key,sync,compile,audit,calculate,calculateAsync,cancelCalculation};
});
