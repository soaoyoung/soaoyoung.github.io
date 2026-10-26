
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FieldEngine=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const TYPES=['rebar','formwork','shoring'];
  const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
  const clone=x=>JSON.parse(JSON.stringify(x));
  function area(p){return Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-b[0]*a[1];},0))/2;}
  function bbox(p){const xs=p.map(a=>a[0]),ys=p.map(a=>a[1]);return {x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};}
  function center(p){const b=bbox(p);return [b.x+b.w/2,b.y+b.h/2];}
  function onSegment(p,a,b){const cross=(p[0]-a[0])*(b[1]-a[1])-(p[1]-a[1])*(b[0]-a[0]);return Math.abs(cross)<1e-7&&p[0]>=Math.min(a[0],b[0])-1e-7&&p[0]<=Math.max(a[0],b[0])+1e-7&&p[1]>=Math.min(a[1],b[1])-1e-7&&p[1]<=Math.max(a[1],b[1])+1e-7;}
  function inside(p,poly,boundary=true){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if(onSegment(p,a,b))return boundary;if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;}
  function cross(a,b,c){return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
  function properIntersect(a,b,c,d){return cross(a,b,c)*cross(a,b,d)<-1e-8&&cross(c,d,a)*cross(c,d,b)<-1e-8;}
  function overlaps(a,b){if(a.some(p=>inside(p,b,false))||b.some(p=>inside(p,a,false)))return true;for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)if(properIntersect(a[i],a[(i+1)%a.length],b[j],b[(j+1)%b.length]))return true;const ca=center(a),cb=center(b);return (inside(ca,a,false)&&inside(ca,b,false))||(inside(cb,b,false)&&inside(cb,a,false));}
  function contained(a,b){if(!a.every(p=>inside(p,b)))return false;for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)if(properIntersect(a[i],a[(i+1)%a.length],b[j],b[(j+1)%b.length]))return false;return true;}
  function validPolygon(p){if(!(Array.isArray(p)&&p.length>=3&&p.length<=100&&p.every(q=>Array.isArray(q)&&q.length===2&&q.every(v=>Number.isFinite(v)&&v>=0&&v<=1000))&&area(p)>1))return false;for(let i=0;i<p.length;i++){if(p[i][0]===p[(i+1)%p.length][0]&&p[i][1]===p[(i+1)%p.length][1])return false;for(let j=i+1;j<p.length;j++){if(j===i+1||(i===0&&j===p.length-1))continue;if(properIntersect(p[i],p[(i+1)%p.length],p[j],p[(j+1)%p.length]))return false;}}return true;}
  function slotsFor(zones){
    const slots=[];
    for(const z of zones.filter(z=>z.type==='storage'&&z.confirmed)){
      const b=bbox(z.polygon),front=z.front||'south',cols=z.slotColumns||3,depths=z.slotDepths||2;
      for(let col=0;col<cols;col++)for(let depth=0;depth<depths;depth++){
        let x,y,w,h;
        if(front==='west'||front==='east'){w=b.w/depths;h=b.h/cols;x=b.x+(front==='west'?depth:depths-1-depth)*w;y=b.y+col*h;}
        else{w=b.w/cols;h=b.h/depths;x=b.x+col*w;y=b.y+(front==='north'?depth:depths-1-depth)*h;}
        let poly=rect(x+1,y+1,w-2,h-2);
        if(!contained(poly,z.polygon)){
          const c=[x+w/2,y+h/2];if(!inside(c,z.polygon,false))continue;
          let scale=.9;
          while(scale>.08){const sw=(w-2)*scale,sh=(h-2)*scale;poly=rect(c[0]-sw/2,c[1]-sh/2,sw,sh);if(contained(poly,z.polygon))break;scale*=.85;}
        }
        if(validPolygon(poly)&&contained(poly,z.polygon))slots.push({id:z.id+':'+col+':'+depth,zone:z.id,col,depth,polygon:poly,b:bbox(poly)});
      }
    }return slots;
  }
  function fit(lot,slot){const b=lot._b||bbox(lot.polygon);return b.w<=slot.b.w+.01&&b.h<=slot.b.h+.01;}
  function pose(lot,slot,ratio=1){const b=bbox(lot.polygon),r=Math.sqrt(Math.max(0,ratio));return rect(slot.b.x+(slot.b.w-b.w*r)/2,slot.b.y+(slot.b.h-b.h*r)/2,b.w*r,b.h*r);}
  function zoneOf(poly,zones){const c=center(poly);return zones.find(z=>z.type==='storage'&&contained(poly,z.polygon))?.id||zones.find(z=>z.type==='storage'&&inside(c,z.polygon))?.id||'';}
  function demo(){const zones=[
    {id:'SITE',name:'현장 경계',type:'site',polygon:[[288,128],[513,158],[746,322],[766,460],[691,688],[550,847],[306,911],[251,858],[253,339]]},
    {id:'B-01',name:'공사 영역 01',type:'building',polygon:rect(273,570,182,257)},
    {id:'B-02',name:'공사 영역 02',type:'building',polygon:[[531,502],[630,502],[744,305],[728,461],[653,651],[534,647]]},
    {id:'B-03',name:'공사 영역 03',type:'building',polygon:rect(303,299,165,58)},
    {id:'R-01',name:'중앙 차량로',type:'vehicle_route',polygon:rect(474,322,36,513)},
    {id:'R-02',name:'진입 연결로',type:'vehicle_route',polygon:rect(254,455,220,37)},
    {id:'W-01',name:'보행로 후보',type:'walkway',polygon:rect(462,510,10,300)},
    {id:'G-01',name:'출입구 후보',type:'gate',polygon:rect(249,458,15,28)},
    {id:'S-01',name:'북측 야적 후보',type:'storage',polygon:rect(280,215,120,77),front:'south'},
    {id:'S-02',name:'서측 야적 후보',type:'storage',polygon:rect(303,378,130,66),front:'south'},
    {id:'S-03',name:'남측 야적 후보',type:'storage',polygon:rect(525,705,75,78),front:'south'}
  ].map(z=>({...z,confirmed:false,start:0,end:14,note:'기능 체험용 수작업 예시. 실제 현장 검토 필요.'}));
    const materials={rebar:{name:'철근',quantity:240,unit:'묶음'},formwork:{name:'거푸집',quantity:180,unit:'장'},shoring:{name:'동바리',quantity:120,unit:'개'}};
    const ss=slotsFor(zones.map(z=>({...z,confirmed:true})));const lots=[];
    [['rebar','S-01',100,80,33,27],['formwork','S-02',70,60,32,25],['shoring','S-03',50,40,19,31]].forEach(([type,z,q1,q2,w,h])=>{[q1,q2].forEach((q,j)=>{const s=ss.find(s=>s.zone===z&&s.col===0&&s.depth===1-j);lots.push({id:'M-'+(lots.length+1).toString().padStart(2,'0'),name:materials[type].name+' '+(j+1),type,quantity:q,polygon:rect(s.b.x+(s.b.w-w)/2,s.b.y+(s.b.h-h)/2,w,h),state:'stored',confirmed:false,note:'예시 적치 영역',zone:z});});});
    const tasks=[
      {id:'T-01',name:'벽체·기둥 철근',zone:'B-01',material:'rebar',day:3,quantity:120,returnDay:null},
      {id:'T-02',name:'거푸집 설치 01',zone:'B-01',material:'formwork',day:4,quantity:90,returnDay:8},
      {id:'T-03',name:'동바리 설치 01',zone:'B-01',material:'shoring',day:5,quantity:60,returnDay:9},
      {id:'T-04',name:'벽체·기둥 철근 02',zone:'B-02',material:'rebar',day:9,quantity:120,returnDay:null},
      {id:'T-05',name:'거푸집 설치 02',zone:'B-02',material:'formwork',day:10,quantity:90,returnDay:14},
      {id:'T-06',name:'동바리 설치 02',zone:'B-02',material:'shoring',day:11,quantity:60,returnDay:14}
    ];return {version:1,demo:true,image:'assets/site-topview.jpg',imageName:'제공된 현장 탑뷰',imageWidth:4032,imageHeight:2268,zones,lots,materials,tasks,startDate:'2026-10-07',horizon:14,model:'gpt-6-sol',results:null};
  }
  function audit(state,requireConfirmed=true){const TYPES=Object.keys(state?.materials||{});const errors=[],warnings=[];if(!state||!state.materials)return {errors:['프로젝트 형식이 잘못되었습니다.'],warnings};
    if((state.calendar!=='working'||state.startDate)&&(!/^\d{4}-\d{2}-\d{2}$/.test(state.startDate)||!Number.isFinite(new Date(state.startDate+'T12:00:00').getTime())))errors.push('프로젝트 시작일을 확인하세요.');
    if(!Number.isInteger(state.horizon)||state.horizon<3||state.horizon>120)errors.push('계획기간은 3~120의 정수여야 합니다.');
    const zones=state.zones||[],lots=state.lots||[],tasks=state.tasks||[];const ids=[...zones,...lots].map(a=>a.id);if(new Set(ids).size!==ids.length)errors.push('영역 ID가 중복되었습니다.');
    zones.forEach(z=>{if(!validPolygon(z.polygon))errors.push(z.name+': 구역 다각형이 잘못되었습니다.');if(!Number.isInteger(z.start)||!Number.isInteger(z.end)||z.start<0||z.end<z.start||z.end>state.horizon)errors.push(z.name+': 사용 가능 기간을 확인하세요.');});
    const storage=zones.filter(z=>z.type==='storage');if(!storage.length)errors.push('야적 구역을 하나 이상 지정하세요.');if(!zones.some(z=>z.type==='gate'))errors.push('출입구를 지정하세요.');if(!zones.some(z=>z.type==='vehicle_route'))errors.push('차량 운반로를 지정하세요.');
    if(requireConfirmed&&zones.some(z=>!z.confirmed))errors.push('모든 구역을 검토·확정하세요. 미확인 영역은 수정하거나 삭제하세요.');
    if(requireConfirmed&&zones.some(z=>z.type==='unknown'))errors.push('미확인 구역의 용도를 확정하세요.');
    const obstacles=zones.filter(z=>['building','vehicle_route','walkway','gate','unknown'].includes(z.type));
    storage.forEach(z=>{const site=zones.find(x=>x.type==='site');if(site&&!contained(z.polygon,site.polygon))errors.push(z.name+': 현장 경계 밖의 야적 영역이 있습니다.');for(const o of obstacles)if(overlaps(z.polygon,o.polygon))errors.push(z.name+'이 '+o.name+'과 겹칩니다. 야적 경계를 수정하세요.');});
    for(let i=0;i<storage.length;i++)for(let j=i+1;j<storage.length;j++)if(overlaps(storage[i].polygon,storage[j].polygon))errors.push('야적 구역끼리 겹칩니다.');
    for(const type of TYPES){const m=state.materials[type];if(!m||!Number.isFinite(m.quantity)||m.quantity<0||!m.unit)errors.push((m?.name||type)+': 총수량과 단위를 확인하세요.');const observed=lots.filter(l=>l.type===type&&l.state==='stored').reduce((s,l)=>s+l.quantity,0);if(observed>m?.quantity)errors.push(m.name+': 관측 영역 수량이 입력 총수량을 초과합니다.');if((m?.quantity||0)>0&&!(state.fileModel&&m.density>0)&&!lots.some(l=>l.type===type&&l.state==='stored'&&l.quantity>0))errors.push(m.name+': 점유 크기를 참고할 야적 자재 영역과 수량이 필요합니다.');}
    lots.forEach(l=>{if(!TYPES.includes(l.type))errors.push(l.name+': 자재 종류를 확인하세요.');if(!validPolygon(l.polygon)||!Number.isFinite(l.quantity)||l.quantity<0)errors.push(l.name+': 영역과 수량을 확인하세요.');if(l.state==='stored'&&l.quantity>0){const z=storage.find(z=>contained(l.polygon,z.polygon));if(!z)errors.push(l.name+': 적치 영역이 야적 구역 안에 완전히 들어가야 합니다.');if(requireConfirmed&&!l.confirmed)errors.push(l.name+': 자재 상태·영역·수량을 검토·확정하세요.');}});
    const active=lots.filter(l=>l.state==='stored'&&l.quantity>0);for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++)if(overlaps(active[i].polygon,active[j].polygon))errors.push(active[i].name+'과 '+active[j].name+'의 적치 영역이 겹칩니다.');
    if(!tasks.length)errors.push('공정별 자재 사용 계획을 하나 이상 입력하세요.');tasks.forEach(t=>{if(!zones.some(z=>z.id===t.zone&&z.type==='building'))errors.push(t.name+': 공급할 건물 구역을 연결하세요.');if(!TYPES.includes(t.material)||!Number.isFinite(t.quantity)||t.quantity<=0||!Number.isInteger(t.day)||t.day<1||t.day>state.horizon)errors.push(t.name+': 자재·수량·사용일을 확인하세요.');if(t.returnDay!=null&&(!Number.isInteger(t.returnDay)||t.returnDay<=t.day||t.returnDay>state.horizon||(state.materials[t.material]?.group||t.material)==='rebar'))errors.push(t.name+': 회수일은 사용일 이후 계획기간 안으로 지정하세요. 철근은 회수하지 않습니다.');});
    tasks.forEach(t=>{if(t.endDay!=null&&(!Number.isInteger(t.endDay)||t.endDay<t.day||t.endDay>state.horizon))errors.push(t.name+': 작업 종료일은 시작일 이후 계획기간 안으로 입력하세요.');if(t.endDay!=null&&t.returnDay!=null&&t.returnDay<=t.endDay)errors.push(t.name+': 회수일은 작업 종료일 이후로 입력하세요.');});
    if(state.demo)warnings.push('수작업 예시 구역·재고·공정으로 계산한 결과입니다.');if(state.referenceProfile)warnings.push('기준 공정에 사용자가 입력한 수요 개수·재고·회수일·확정 구역을 연결한 계산입니다. 작업 수요는 시작일에 일괄 공급합니다.');if(state.calendar==='working')warnings.push('WD는 상대 작업일입니다. 실제 휴일 달력·절대 날짜를 계산하지 않습니다.');warnings.push('영상 상대 면적과 3열×2깊이 적치 슬롯 모델입니다. 실제 치수·운반 거리·장비·하중 조건은 평가하지 않습니다.');return {errors:[...new Set(errors)],warnings};
  }
  function legacyProblem(state){const TYPES=Object.keys(state?.materials||{});const slots=slotsFor(state.demo?state.zones.map(z=>({...z,confirmed:true})):state.zones),lots=clone(state.lots.filter(l=>l.state==='stored'&&l.quantity>0));lots.forEach(l=>{l.current=true;l.initialQuantity=l.quantity;l.zone=zoneOf(l.polygon,state.zones);const near=slots.filter(s=>s.zone===l.zone&&fit(l,s)).sort((a,b)=>Math.hypot(...center(l.polygon).map((v,i)=>v-center(a.polygon)[i]))-Math.hypot(...center(l.polygon).map((v,i)=>v-center(b.polygon)[i])));l.originalSlot=near[0]?.id;});
    for(const type of TYPES){const assigned=lots.filter(l=>l.type===type).reduce((s,l)=>s+l.quantity,0),q=state.materials[type].quantity-assigned;const dels=(state.deliveries||[]).filter(d=>d.material===type);if(dels.length){const refs=lots.filter(l=>l.type===type);const dens=refs.reduce((s,l)=>s+area(l.polygon),0)/Math.max(assigned,1);const rb=bbox(refs[0].polygon);for(const d of dels){const w=Math.sqrt(dens*d.quantity*rb.w/rb.h),h=dens*d.quantity/w;lots.push({id:d.id,name:d.name,type,quantity:d.quantity,initialQuantity:d.quantity,polygon:rect(0,0,w,h),current:false,originalSlot:null,target:d.zone,needDay:d.day});}continue;}if(q>0){const references=lots.filter(l=>l.type===type);const density=references.reduce((s,l)=>s+area(l.polygon),0)/assigned;const b=bbox(references[0].polygon);/* 분할 반입: 반입 예정량이 슬롯 하나에 들어가지 않으면 들어갈 때까지 나눠 여러 회차로 반입 */const du=(state.quantityBasis&&state.quantityBasis.delivery_unit||{})[type];let k=1;const fits=n=>{const qq=Math.ceil(q/n),w=Math.sqrt(density*qq*b.w/b.h),h=density*qq/w;return slots.some(s=>w<=s.b.w+.01&&h<=s.b.h+.01);};if(du)k=Math.max(1,Math.ceil(q/du));else while(k<8&&!fits(k))k++;for(let i=0;i<k;i++){const unit=du?du:Math.ceil(q/k),qq=i<k-1?unit:q-unit*(k-1);if(qq<=0)continue;const w=Math.sqrt(density*qq*b.w/b.h),h=density*qq/w;lots.push({id:'IN-'+type+(k>1?'-'+(i+1):''),name:state.materials[type].name+' 반입 예정'+(k>1?' '+(i+1)+'/'+k+'회차':''),type,quantity:qq,initialQuantity:qq,polygon:rect(0,0,w,h),current:false,originalSlot:null});}}}
    return {slots,lots};
  }
  function problem(state){
    if(!state.fileModel)return legacyProblem(state);
    const TYPES=Object.keys(state.materials||{}),slots=slotsFor(state.demo?state.zones.map(z=>({...z,confirmed:true})):state.zones),lots=clone(state.lots.filter(l=>l.state==='stored'&&l.quantity>0));
    lots.forEach(l=>{l.current=true;l.initialQuantity=l.quantity;l.zone=zoneOf(l.polygon,state.zones);const near=slots.filter(s=>s.zone===l.zone&&fit(l,s)).sort((a,b)=>Math.hypot(...center(l.polygon).map((v,i)=>v-center(a.polygon)[i]))-Math.hypot(...center(l.polygon).map((v,i)=>v-center(b.polygon)[i])));l.originalSlot=near[0]?.id;});
    for(const type of TYPES){
      const m=state.materials[type],refs=lots.filter(l=>l.type===type),assigned=refs.reduce((s,l)=>s+l.quantity,0),density=m.density||(assigned?refs.reduce((s,l)=>s+area(l.polygon),0)/assigned:0),aspect=m.aspect||(refs.length?bbox(refs[0].polygon).w/bbox(refs[0].polygon).h:1);
      const dels=(state.deliveries||[]).filter(d=>d.material===type),q=m.quantity-assigned;
      const cap=slots.length&&density>0?Math.max(...slots.map(s=>Math.min(s.b.w*s.b.w/(density*aspect),s.b.h*s.b.h*aspect/density))):0;
      const push=(d,i)=>{if(!(density>0&&d.quantity>0))return;const n=Math.max(1,Math.ceil(d.quantity/Math.max(cap*.95,.001)));if(n>1000)throw Error(m.name+': 추정 적치 면적이 너무 큽니다. 관측 자재 영역·수량을 확인하세요.');for(let k=0;k<n;k++){const qq=d.quantity/n,w=Math.sqrt(density*qq*aspect),hh=density*qq/w;lots.push({id:d.id+(n>1?'-'+(k+1):''),name:d.name,type,quantity:qq,initialQuantity:qq,polygon:rect(0,0,w,hh),current:false,originalSlot:null,target:d.zone,needDay:d.day,arrivalDay:d.day,fixedDay:!!d.fixedDay});}};
      if(dels.length){dels.forEach(push);continue;}
      if(q>0)push({id:'IN-'+type,name:m.name+' 반입 예정',quantity:q,day:1},0);
    }return {slots,lots};
  }
  function simulate(state,p,allocation,arrivals){const TYPES=Object.keys(state?.materials||{});const {lots,slots}=p;const slotMap=p._slotMap||(p._slotMap=Object.fromEntries(slots.map(s=>[s.id,s])));const SZ=state.zones.filter(z=>z.type==='storage'),ZA=Object.fromEntries(SZ.map(z=>[z.id,area(z.polygon)])),ZM=Object.fromEntries(state.zones.map(z=>[z.id,z])),LA=Object.fromEntries(lots.map(l=>[l.id,area(l.polygon)]));lots.forEach(l=>{if(!l._b)l._b=bbox(l.polygon);});const q=Object.fromEntries(lots.map(l=>[l.id,0]));const positions={...allocation},events=[],snapshots=[],moves=Object.fromEntries(TYPES.map(t=>[t,0]));let y=0,peak=0;const returns=[];
    const fail=message=>({feasible:false,message});
    for(const l of lots)if(!slotMap[positions[l.id]]||!fit(l,slotMap[positions[l.id]]))return fail(l.name+': 적치 슬롯에 들어가지 않습니다.');
    const occ={};function setPQ(l,slot,qty){if(q[l.id]>0)occ[positions[l.id]]--;positions[l.id]=slot;q[l.id]=qty;if(qty>0)occ[slot]=(occ[slot]||0)+1;}
    function occupied(slot,except){return (occ[slot]||0)-((except!=null&&positions[except]===slot&&q[except]>0)?1:0)>0;}
    function available(l,s,day){const z=ZM[s.zone];return day>=z.start&&day<=z.end&&!occupied(s.id,l.id)&&fit(l,s);}
    function free(l,day,excluded=[]){return slots.filter(s=>!excluded.includes(s.id)&&available(l,s,day)).sort((a,b)=>a.depth-b.depth||a.id.localeCompare(b.id))[0];}
    function occupancy(){const usage={};for(const z of SZ)usage[z.id]=0;for(const l of lots){if(q[l.id]>0){const zid=slotMap[positions[l.id]].zone;if(zid in usage)usage[zid]+=LA[l.id]*q[l.id]/l.initialQuantity;}}for(const z of SZ){usage[z.id]/=ZA[z.id];if(usage[z.id]>peak)peak=usage[z.id];}return usage;}
    function event(day,kind,l,qty,from,to,note){if(!(p.light&&kind!=='arrival'&&kind!=='supply'&&kind!=='return'&&kind!=='move'))events.push({day,kind,material:l.type,lot:l.id,name:l.name,quantity:qty,from:from||'',to:to||'',note:note||''});if(kind!=='supply')occupancy();}
    function relocate(l,day,note){const src=positions[l.id],dst=free(l,day,[src]);if(!dst)return false;setPQ(l,dst.id,q[l.id]);moves[l.type]+=q[l.id];event(day,'move',l,q[l.id],src,dst.id,note);return true;}
    for(let day=0;day<=state.horizon;day++){
      for(const r of returns.filter(r=>r.day===day)){const l=lots.find(l=>l.id===r.lot);let s=slotMap[positions[l.id]];if(!available(l,s,day)){s=free(l,day);if(!s)return fail(day+'일: 회수 자재를 놓을 공간이 없습니다.');setPQ(l,s.id,q[l.id]);}setPQ(l,positions[l.id],q[l.id]+r.qty);event(day,'return',l,r.qty,r.zone,s.id,r.task+' 회수');}
      for(const l of lots){if((l.current&&day===0)||(!l.current&&arrivals[l.id]===day)){let s=slotMap[positions[l.id]];if(!available(l,s,day)){if(!p.flexible)return fail(day+'일: '+l.name+' 반입 위치가 사용 불가하거나 다른 자재와 겹칩니다.');const SC=p._sc||(p._sc=Object.fromEntries(slots.map(x=>[x.id,center(x.polygon)])));const c0=SC[s.id];let alt=null,bd=Infinity;for(const x of slots){if(!available(l,x,day))continue;const dd=Math.hypot(SC[x.id][0]-c0[0],SC[x.id][1]-c0[1]);if(dd<bd){bd=dd;alt=x;}}if(!alt)return fail(day+'일: '+l.name+'을 놓을 빈 적치 공간이 없습니다.');setPQ(l,alt.id,q[l.id]);s=alt;}setPQ(l,positions[l.id],l.quantity);event(day,l.current?'initial':'arrival',l,l.quantity,l.current?l.zone:'현장 외부',s.id,l.current?'현재 재고 배치':'반입');if(l.current&&s.id!==l.originalSlot){moves[l.type]+=l.quantity;event(day,'move',l,l.quantity,l.originalSlot||l.zone,s.id,'시작 배치 변경');}}}
      for(const l of lots.filter(l=>q[l.id]>0)){const z=ZM[slotMap[positions[l.id]].zone];if(day<z.start||day>z.end){if(!relocate(l,day,'야적 구역 사용 기간 종료'))return fail(day+'일: 야적 구역 폐쇄 후 재이동 공간이 없습니다.');}}
      /* daily 모드: 작업 기간(day~endDay) 동안 수량을 나눠 매일 공급 */
      const todays=state.supplyMode==='daily'?state.tasks.filter(t=>day>=t.day&&day<=(t.endDay??t.day)).map(t=>{const n=(t.endDay??t.day)-t.day+1,k=day-t.day;return {task:t,qty:Math.floor(t.quantity*(k+1)/n)-Math.floor(t.quantity*k/n)};}).filter(x=>x.qty>0):state.tasks.filter(t=>t.day===day).map(t=>({task:t,qty:t.quantity}));
      for(const {task,qty} of todays){
        let needed=qty;let stock=lots.filter(l=>l.type===task.material&&q[l.id]>0);if(p.flexible){const zc=(p._zc||(p._zc={}))[task.zone]||(p._zc[task.zone]=center(ZM[task.zone].polygon));const SC=p._sc||(p._sc=Object.fromEntries(slots.map(x=>[x.id,center(x.polygon)])));const dist=l=>{const c=SC[positions[l.id]];return Math.hypot(c[0]-zc[0],c[1]-zc[1]);};stock=stock.map(l=>[l,(l.target&&l.target!==task.zone?1e6:0)+dist(l)]).sort((a,b)=>a[1]-b[1]).map(x=>x[0]);}for(const l of stock){if(needed<=0)break;const s=slotMap[positions[l.id]];if(s.depth===1){const blockers=lots.filter(o=>o.id!==l.id&&q[o.id]>0&&slotMap[positions[o.id]].zone===s.zone&&slotMap[positions[o.id]].col===s.col&&slotMap[positions[o.id]].depth===0);if(blockers.length)y++;for(const b of blockers)if(!relocate(b,day,task.name+' 출고 접근 확보'))return fail(day+'일: 출고 방해 자재의 재이동 공간이 없습니다.');}
          const used=Math.min(needed,q[l.id]);setPQ(l,positions[l.id],q[l.id]-used);needed-=used;event(day,'supply',l,used,positions[l.id],task.zone,task.name);if(task.returnDay!=null)returns.push({day:task.returnDay,lot:l.id,qty:used,zone:task.zone,task:task.name});}
        if(needed>1e-8)return fail(day+'일: '+task.name+'의 '+state.materials[task.material].name+' '+needed+state.materials[task.material].unit+' 부족');
      }
      const usage=occupancy();
      if(peak>1+1e-8)return fail('야적 구역의 점유율이 100%를 초과합니다.');
      snapshots.push({day,usage,lots:p.light?[]:lots.filter(l=>q[l.id]>0).map(l=>({id:l.id,name:l.name,type:l.type,quantity:q[l.id],slot:positions[l.id],zone:slotMap[positions[l.id]].zone,polygon:pose(l,slotMap[positions[l.id]],q[l.id]/l.initialQuantity)}))});
    }
    const nonzero=TYPES.filter(t=>state.materials[t].quantity>0);const z=nonzero.reduce((s,t)=>s+moves[t]/state.materials[t].quantity,0)/Math.max(nonzero.length,1);
    return {feasible:true,x:peak*100,y,z:z*100,moves,events,snapshots,allocation,arrivals};
  }
  function dominates(a,b){return a.x<=b.x+1e-8&&a.y<=b.y&&a.z<=b.z+1e-8&&(a.x<b.x-1e-8||a.y<b.y||a.z<b.z-1e-8);}
  function calculate(state,count=320){const TYPES=Object.keys(state?.materials||{});const check=audit(state,!state.demo);if(check.errors.length)return {error:check.errors.join('\n'),warnings:check.warnings};const p=problem(state);if(!p.slots.length)return {error:'야적 구역에 적치 슬롯을 만들 수 없습니다. 경계나 크기를 수정하세요.'};
    const baselineAllocation={},used=new Set();for(const l of p.lots){const s=p.slots.find(s=>s.id===l.originalSlot&&!used.has(s.id)&&fit(l,s))||p.slots.find(s=>!used.has(s.id)&&fit(l,s));if(!s)return {error:l.name+': 상대 점유 크기에 맞는 빈 슬롯이 없습니다. 수량 배분 또는 야적 구역을 수정하세요.'};baselineAllocation[l.id]=s.id;used.add(s.id);}
    const baseArrival=Object.fromEntries(p.lots.filter(l=>!l.current).map(l=>[l.id,1]));const baseline=simulate(state,p,baselineAllocation,baseArrival);baseline.id='BASE';baseline.name='기준안';
    let seed=20261007;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
    const all=[];if(baseline.feasible)all.push(baseline);const failures={};for(let n=0;n<count;n++){const alloc={...baselineAllocation},arrivals={...baseArrival};const mutations=1+Math.floor(random()*Math.min(7,p.lots.length));for(let j=0;j<mutations;j++){const l=p.lots[Math.floor(random()*p.lots.length)],s=p.slots[Math.floor(random()*p.slots.length)];if(!fit(l,s))continue;const other=p.lots.find(o=>o.id!==l.id&&alloc[o.id]===s.id);if(other&&!fit(other,p.slots.find(z=>z.id===alloc[l.id])))continue;if(other)alloc[other.id]=alloc[l.id];alloc[l.id]=s.id;}
      for(const l of p.lots.filter(l=>!l.current)){const relevant=state.tasks.filter(t=>t.material===l.type);const last=Math.max(1,...relevant.map(t=>t.day));arrivals[l.id]=1+Math.floor(random()*last);}
      const r=simulate(state,p,alloc,arrivals);if(r.feasible){r.id='P-'+(n+1);all.push(r);}else failures[r.message]=(failures[r.message]||0)+1;}
    if(!all.length)return {error:'계획을 만족하는 후보가 없습니다. '+(baseline.message||Object.keys(failures)[0]||''),warnings:check.warnings,total:count+1,feasible:0};
    const unique=[];const seen=new Set();for(const r of all){const k=[r.x.toFixed(5),r.y,r.z.toFixed(5)].join('|');if(!seen.has(k)){seen.add(k);unique.push(r);}}
    const front=unique.filter(r=>!unique.some(o=>o!==r&&dominates(o,r)));const min=key=>front.reduce((a,b)=>b[key]<a[key]?b:a);const spans={};for(const key of ['x','y','z']){const vals=front.map(r=>r[key]);spans[key]=[Math.min(...vals),Math.max(...vals)];}const balanced=front.reduce((a,b)=>{const score=r=>['x','y','z'].reduce((s,k)=>s+(r[k]-spans[k][0])/(spans[k][1]-spans[k][0]||1),0)/3;return score(b)<score(a)?b:a;});
    const representatives=[];for(const [r,label]of [[min('x'),'과밀 최소형'],[min('y'),'접근 우선형'],[min('z'),'재이동 최소형'],[balanced,'균형형']]){const existing=representatives.find(x=>x.id===r.id);if(existing)existing.labels.push(label);else representatives.push({...r,labels:[label]});}
    return {baseline:baseline.feasible?baseline:null,baselineError:baseline.feasible?null:baseline.message,front,representatives,total:count+1,feasible:all.length,unique:unique.length,warnings:check.warnings,computedAt:new Date().toISOString(),slots:p.slots};
  }
  /* ===================================================================
   * 다목적 엔진 (v3, 성성용) — 기존 simulate()로 실행 가능성·이벤트를 계산하고,
   * 탐색은 NSGA-II 방식, 목적은 서로 충돌하도록 다시 정의.
   *   x 운반 부담 (t·m)  : 반입(가까운 출입구→슬롯)·공급(슬롯→작업 동)·회수·재이동의 직선거리 × 중량
   *   y 평균 최대 점유율 (%): 날마다 가장 붐비는 야적 구역 점유율의 기간 평균
   *   z 재이동 부담 (%)  : 기존 정의 (재이동 수량 / 총수량, 자재별 평균)
   * 기존 y(접근 방해 건수)는 metrics.blocked 로 보고만 함.
   * =================================================================== */
  const AXES_MO={
    x:{label:'운반 부담',short:'운반',unit:'t·m',dunit:'t·m',axis:'운반 부담 (t·m)',fmt:v=>Math.round(v).toLocaleString('ko-KR')},
    y:{label:'평균 최대 점유율',short:'점유',unit:'%',dunit:'%p',axis:'평균 최대 점유율 (%)',fmt:v=>v.toFixed(1)},
    z:{label:'재이동 부담',short:'재이동',unit:'%',dunit:'%p',axis:'재이동 부담 (%)',fmt:v=>v.toFixed(1)}
  };
  const DEFAULT_TON={rebar:1.0,formwork:0.025,shoring:0.015};
  function scorer(state,p){
    const b=state.quantityBasis||{},mpp=b.m_per_px||0.5,W=state.imageWidth||1000,H=state.imageHeight||1000;
    const sx=W/1000*mpp,sy=H/1000*mpp;
    const fallback={rebar:(b.rebar_bundle_kg||1000)/1000,formwork:b.panel_ton||DEFAULT_TON.formwork,shoring:b.support_ton||DEFAULT_TON.shoring},ton=Object.fromEntries(Object.entries(state.materials).map(([id,m])=>[id,m.unitWeightKg>0?m.unitWeightKg/1000:fallback[m.group||id]]));
    const slotC=Object.fromEntries(p.slots.map(s=>[s.id,center(s.polygon)]));
    const zoneC=Object.fromEntries(state.zones.map(z=>[z.id,center(z.polygon)]));
    const gates=state.zones.filter(z=>z.type==='gate').map(z=>center(z.polygon));
    const d=(a,c)=>Math.hypot((a[0]-c[0])*sx,(a[1]-c[1])*sy);
    const pt=k=>slotC[k]||zoneC[k];
    /* 크레인: 동마다 담당 크레인이 있으면 반경·정격하중을 반영 */
    const cranes=state.cranes||[];const craneOf={};for(const c of cranes)for(const z of c.serves)craneOf[z]=c;
    const K_OUT=(b.out_of_reach_factor||2);
    const allowT=(c,r)=>{if(r>c.radius_m+1e-9)return 0;const row=c.chart.find(q=>r<=q.radius_upper_m+1e-9)||c.chart[c.chart.length-1];return (row.rated_kg*(c.management_ratio||.8)-(c.rigging_kg||64))/1000;};
    const unitT=Object.fromEntries(Object.entries(state.materials).map(([id,m])=>[id,(m.group==='rebar'&&m.unit==='kg'?1000:(m.group||id)==='formwork'?(b.formwork_lift_unit||40):(m.group||id)==='shoring'?(b.shoring_lift_unit||50):1)*ton[id]]));
    function lift(e,slotPt,zoneId){const c=craneOf[zoneId];if(!c)return null;const cp=c.pos;const r=d(cp,slotPt),rz=d(cp,zoneC[zoneId]);const w=e.quantity*(ton[e.material]||0);
      if(r>c.radius_m)return {out:true,w,over:r-c.radius_m,crane:c.id};const a=Math.min(allowT(c,Math.max(r,rz)),unitT[e.material]*2);const per=Math.max(unitT[e.material],a>0?Math.floor(a/unitT[e.material])*unitT[e.material]:unitT[e.material]);
      return {out:false,w,lifts:Math.ceil(w/per),crane:c.id};}
    return r=>{
      let tm=0,lifts=0,outT=0,outN=0;
      for(const e of r.events){const w=e.quantity*(ton[e.material]||0);
        if(e.kind==='arrival'){const s=slotC[e.to];tm+=w*Math.min(...gates.map(g=>d(g,s)));}
        else if(e.kind==='supply'||e.kind==='return'){const slotId=e.kind==='supply'?e.from:e.to,zoneId=e.kind==='supply'?e.to:e.from;const a=pt(e.from),c=pt(e.to);if(!a||!c)continue;
          tm+=w*d(a,c);const L=cranes.length?lift(e,slotC[slotId],zoneId):null;
          if(L){if(L.out){tm+=w*L.over*K_OUT;outT+=w;outN++;}else lifts+=L.lifts;}}
        else if(e.kind==='move'){const a=pt(e.from),c=pt(e.to);if(a&&c)tm+=w*d(a,c);}}
      const days=r.snapshots.map(s=>Math.max(0,...Object.values(s.usage||{})));
      const yMean=100*days.reduce((s,v)=>s+v,0)/Math.max(days.length,1);
      return {x:tm,y:yMean,z:r.z,blocked:r.y,peak:r.x,lifts,outT,outN};
    };
  }
  function calculateMO(state,opts={}){const TYPES=Object.keys(state?.materials||{});
    const check=audit(state,!state.demo);if(check.errors.length)return {error:check.errors.join('\n'),warnings:check.warnings};
    const p=problem(state);if(!p.slots.length)return {error:'야적 구역에 적치 슬롯을 만들 수 없습니다. 경계나 크기를 수정하세요.'};
    const score=scorer(state,p);p.flexible=true;p.light=true;
    const incoming=p.lots.filter(l=>!l.current&&!l.fixedDay);
    /* 기준안 반입일: 필요 시점 2일 전 (JIT). 반입 예정 묶음은 공급 순서대로 소진된다고 보고 필요일을 계산 */
    const lastDay={},baseArr={},LEAD=2;
    for(const type of TYPES){
      const own=p.lots.filter(l=>l.type===type);let avail=own.filter(l=>l.current).reduce((s,l)=>s+l.quantity,0);
      const net=[];for(let d=0;d<=state.horizon;d++){const sup=state.tasks.filter(t=>t.material===type&&t.day===d).reduce((s,t)=>s+t.quantity,0);const ret=state.tasks.filter(t=>t.material===type&&t.returnDay===d).reduce((s,t)=>s+t.quantity,0);net.push((net[d-1]||0)+sup-ret);}
      for(const l of own.filter(l=>!l.current)){if(l.fixedDay){lastDay[l.id]=l.needDay;baseArr[l.id]=l.arrivalDay;continue;}if(l.needDay!=null){lastDay[l.id]=Math.max(1,l.needDay);baseArr[l.id]=Math.max(1,l.needDay-LEAD);continue;}let need=net.findIndex(v=>v>avail);if(need<0)need=Math.max(1,...state.tasks.filter(t=>t.material===type).map(t=>t.day));need=Math.max(1,need);lastDay[l.id]=need;baseArr[l.id]=Math.max(1,need-LEAD);avail+=l.quantity;}
    }
    /* 기준안 위치(현장 관행): 원래 슬롯 → 출입구에 가까운 빈 칸 → (모자라면) 같은 칸을 시간차로 공유 */
    const baseAlloc={},count={};
    for(const l of p.lots){const fits=p.slots.filter(s=>fit(l,s));if(!fits.length)return {error:l.name+': 크기에 맞는 적치 슬롯이 없습니다. 야적 구역을 넓히거나 반입 단위를 줄이세요.'};
      const gd=x=>{const c=center(x.polygon);return Math.min(...state.zones.filter(z=>z.type==='gate').map(z=>{const g=center(z.polygon);return Math.hypot(c[0]-g[0],c[1]-g[1]);}));};const s=fits.find(s=>s.id===l.originalSlot&&!count[s.id])||fits.slice().sort((a,b)=>(count[a.id]||0)-(count[b.id]||0)||gd(a)-gd(b)||a.depth-b.depth)[0];baseAlloc[l.id]=s.id;count[s.id]=(count[s.id]||0)+1;}
    let seed=opts.seed||20261012;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    const pick=a=>a[Math.floor(rnd()*a.length)];
    const fitSlots=Object.fromEntries(p.lots.map(l=>[l.id,p.slots.filter(s=>fit(l,s)).map(s=>s.id)]));const SCm=Object.fromEntries(p.slots.map(x=>[x.id,center(x.polygon)]));const ZCm=Object.fromEntries(state.zones.map(z=>[z.id,center(z.polygon)]));const crPt={};for(const c of (state.cranes||[]))for(const z of c.serves)crPt[z]=c.pos;const near=Object.fromEntries(p.lots.map(l=>{const tp=l.target?(crPt[l.target]||ZCm[l.target]):null;return [l.id,tp?fitSlots[l.id].slice().sort((a,b)=>Math.hypot(SCm[a][0]-tp[0],SCm[a][1]-tp[1])-Math.hypot(SCm[b][0]-tp[0],SCm[b][1]-tp[1])).slice(0,6):fitSlots[l.id]];}));
    let evals=0;const archive=new Map(),failures={};
    function evaluate(g){evals++;const key=JSON.stringify(g);if(archive.has(key))return archive.get(key);
      const r=simulate(state,p,g.alloc,g.arr);let ind;
      if(r.feasible){ind={...r,...score(r),g,ok:true};}else{failures[r.message]=(failures[r.message]||0)+1;ind={g,ok:false,x:Infinity,y:Infinity,z:Infinity};}
      archive.set(key,ind);return ind;}
    function mutate(g,n){const a={...g.alloc},arr={...g.arr};
      for(let k=0;k<n;k++){if(incoming.length&&rnd()<.35){const l=pick(incoming);arr[l.id]=Math.max(1,Math.min(lastDay[l.id],arr[l.id]+(rnd()<.5?-1:1)*(1+Math.floor(rnd()*6))));continue;}
        const l=pick(p.lots),s=pick(rnd()<.5?near[l.id]:fitSlots[l.id]);if(!s)continue;const other=rnd()<.5?p.lots.find(o=>o.id!==l.id&&a[o.id]===s):null;
        if(other){if(!fitSlots[other.id].includes(a[l.id]))continue;a[other.id]=a[l.id];}a[l.id]=s;}
      return {alloc:a,arr};}
    function cross(g1,g2){const a={...g1.alloc},arr={...g1.arr};
      for(const l of p.lots){if(rnd()<.5){const s=g2.alloc[l.id];const other=p.lots.find(o=>o.id!==l.id&&a[o.id]===s);if(other){if(!fitSlots[other.id].includes(a[l.id]))continue;a[other.id]=a[l.id];}a[l.id]=s;}}
      for(const l of incoming)if(rnd()<.5)arr[l.id]=g2.arr[l.id];return {alloc:a,arr};}
    const dom=(a,b)=>{if(a.ok!==b.ok)return a.ok;if(!a.ok)return false;return a.x<=b.x&&a.y<=b.y+1e-9&&a.z<=b.z+1e-9&&(a.x<b.x||a.y<b.y-1e-9||a.z<b.z-1e-9);};
    function rankPop(P){const n=P.length,S=P.map(()=>[]),c=P.map(()=>0),F=[[]];
      for(let i=0;i<n;i++)for(let j=0;j<n;j++){if(i===j)continue;if(dom(P[i],P[j]))S[i].push(j);else if(dom(P[j],P[i]))c[i]++;}
      P.forEach((q,i)=>{if(!c[i]){q.rank=0;F[0].push(i);}});
      for(let k=0;F[k].length;k++){const nx=[];for(const i of F[k])for(const j of S[i])if(!--c[j]){P[j].rank=k+1;nx.push(j);}F.push(nx);}
      for(const f of F){f.forEach(i=>P[i].crowd=0);for(const m of ['x','y','z']){const s=f.filter(i=>P[i].ok).sort((a,b)=>P[a][m]-P[b][m]);if(s.length<3){s.forEach(i=>P[i].crowd=Infinity);continue;}const span=(P[s[s.length-1]][m]-P[s[0]][m])||1;P[s[0]].crowd=P[s[s.length-1]].crowd=Infinity;for(let k=1;k<s.length-1;k++)P[s[k]].crowd+=(P[s[k+1]][m]-P[s[k-1]][m])/span;}}
      return F;}
    const better=(a,b)=>(a.rank<b.rank||(a.rank===b.rank&&a.crowd>b.crowd))?a:b;
    const big=p.lots.length>30;const POP=opts.pop||(big?40:48),GEN=opts.gens||(big?40:60);
    const base={alloc:baseAlloc,arr:baseArr};const baseInd=evaluate(base);
    let pop=[baseInd];let guard=0;const greedy={alloc:{...baseAlloc},arr:{...baseArr}};for(const l of p.lots)if(l.target&&near[l.id].length)greedy.alloc[l.id]=near[l.id][0];const gInd=evaluate(greedy);if(gInd.ok)pop.push(gInd);for(let k=0;k<6;k++){const g=evaluate(mutate(greedy,1+Math.floor(rnd()*3)));if(g.ok)pop.push(g);}
    while(pop.length<POP&&guard++<POP*20){const ind=evaluate(mutate(base,1+Math.floor(rnd()*6)));if(ind.ok||rnd()<.2)pop.push(ind);}
    rankPop(pop);
    for(let gen=0;gen<GEN;gen++){const kids=[];
      while(kids.length<POP){const a=better(pick(pop),pick(pop)),b=better(pick(pop),pick(pop));kids.push(evaluate(mutate(cross(a.g,b.g),1+Math.floor(rnd()*3))));}
      const all=pop.concat(kids),F=rankPop(all),next=[];
      for(const f of F){if(next.length+f.length<=POP)f.forEach(i=>next.push(all[i]));else{f.slice().sort((i,j)=>all[j].crowd-all[i].crowd).slice(0,POP-next.length).forEach(i=>next.push(all[i]));break;}}
      pop=next;}
    const feas=[...archive.values()].filter(r=>r.ok);
    if(!feas.length)return {error:'계획을 만족하는 후보가 없습니다. '+(Object.keys(failures)[0]||''),warnings:check.warnings,total:evals,feasible:0};
    const seen=new Set(),uniq=[];for(const r of feas){const k=[Math.round(r.x),r.y.toFixed(2),r.z.toFixed(2)].join('|');if(!seen.has(k)){seen.add(k);uniq.push(r);}}
    const baseKey=JSON.stringify(base);
    let front=uniq.filter(r=>!uniq.some(o=>o!==r&&dom(o,r)));
    front=front.filter(r=>JSON.stringify(r.g)!==baseKey).sort((a,b)=>a.x-b.x).map((r,i)=>({...r,id:'P-'+(i+1)}));
    if(!front.length)front=[{...baseInd,id:'P-1'}];
    const span=k=>{const v=front.map(r=>r[k]);return [Math.min(...v),(Math.max(...v)-Math.min(...v))||1];};const sp={x:span('x'),y:span('y'),z:span('z')};
    const bal=r=>['x','y','z'].reduce((s,k)=>s+(r[k]-sp[k][0])/sp[k][1],0);
    const order={'운반 최소형':(a,b)=>a.x-b.x||a.z-b.z||a.y-b.y,'과밀 최소형':(a,b)=>a.y-b.y||a.x-b.x,'재이동 최소형':(a,b)=>a.z-b.z||a.y-b.y||a.x-b.x,'균형형':(a,b)=>bal(a)-bal(b)};
    /* 대표 대안끼리 사실상 같은 안(정규화 거리 8% 미만)이면 다른 안을 고르고, 그런 안이 없으면 한 카드에 이름을 합침 */
    const nd=(a,b)=>['x','y','z'].reduce((s,k)=>s+Math.abs(a[k]-b[k])/sp[k][1],0);
    const reps=[];for(const label of Object.keys(order)){const sorted=front.slice().sort(order[label]);const best=sorted[0];const lim=label==='균형형'?Infinity:.15;const c=sorted.find(r=>!reps.some(x=>x.id===r.id||nd(x,r)<.08)&&nd(r,best)<=lim);if(c)reps.push({...c,labels:[label]});else{const ex=reps.slice().sort((p,q)=>nd(p,best)-nd(q,best))[0];if(ex)ex.labels.push(label);else reps.push({...best,labels:[label]});}}
    p.light=false;const full=r=>{const f=simulate(state,p,r.g.alloc,r.g.arr);return f.feasible?{...r,events:f.events,snapshots:f.snapshots,moves:f.moves}:r;};
    front=front.map(full);for(const r of reps){const f=front.find(x=>x.id===r.id);if(f){r.events=f.events;r.snapshots=f.snapshots;}}
    const baseFull=baseInd.ok?full(baseInd):baseInd;
    const clean=r=>{const {g,ok,rank,crowd,...rest}=r;rest.metrics={blocked:r.blocked,peak:r.peak,lifts:r.lifts,outT:r.outT,outN:r.outN,cranes:(state.cranes||[]).length};return rest;};
    const warnings=check.warnings.filter(w=>!w.startsWith('영상 상대 면적')).concat(['운반 부담은 직선거리×중량 대리지표입니다(축척·단위중량 가정). 실제 비용·시간 절감률이 아닙니다.','다목적 탐색(NSGA-II 방식, '+POP+'개체×'+GEN+'세대). 3열×2깊이 적치 슬롯 모델.'+((state.cranes||[]).length?' 동별 크레인 반경 밖 적치는 소운반 벌점(반경 초과 거리×중량×'+((state.quantityBasis||{}).out_of_reach_factor||2)+'), 반경별 정격하중×관리한도로 인양 횟수 산정 (가정 크레인 '+state.cranes.length+'대).':' 크레인 하중은 평가하지 않습니다.')]);
    return {engine:'mo',baseline:baseInd.ok?{...clean(baseFull),id:'BASE',name:'기준안'}:null,baselineError:baseInd.ok?null:baseInd.message,front:front.map(clean),representatives:reps.map(clean),total:evals,feasible:feas.length,unique:uniq.length,warnings,computedAt:new Date().toISOString(),slots:p.slots};
  }

  const AXES_LEGACY={x:{label:'최대 공간 점유율',short:'점유',unit:'%',dunit:'%p',axis:'점유율 (%)',fmt:v=>v.toFixed(1)},y:{label:'출고 접근 방해',short:'방해',unit:'건',dunit:'건',axis:'접근 방해 (건)',fmt:v=>String(v)},z:{label:'재이동 부담',short:'재이동',unit:'%',dunit:'%p',axis:'재이동 부담 (%)',fmt:v=>v.toFixed(1)}};

  /* 동별 반입 회차 자동 재생성 (tools/build_cluster.py 와 같은 규칙)
     - 작업 기간 동안 매일 나눠 쓰는 양을 계산하고, 현장 재고·회수 자재를 먼저 쓴 뒤 모자란 만큼만 트럭 단위로 그날 반입 */
  function regenerateDeliveries(state){const TYPES=Object.keys(state?.materials||{});
    if(!state||!state.deliveryAuto)return state;
    const unitOf=(state.quantityBasis&&state.quantityBasis.delivery_unit)||{rebar:25,formwork:1500,shoring:1000};
    const code={rebar:'RE',formwork:'FO',shoring:'SH'},kname={rebar:'철근',formwork:'거푸집',shoring:'동바리'};
    const portion=(t,d)=>{const n=(t.endDay??t.day)-t.day+1,k=d-t.day;return k>=0&&k<n?Math.floor(t.quantity*(k+1)/n)-Math.floor(t.quantity*k/n):0;};
    const out=[];
    for(const m of TYPES){
      const tasks=state.tasks.filter(t=>t.material===m&&Number.isInteger(t.quantity)&&t.quantity>0&&Number.isInteger(t.day));
      let pool=(state.lots||[]).filter(l=>l.type===m&&l.state==='stored').reduce((s,l)=>s+(l.quantity||0),0);
      const unit=Math.max(1,unitOf[m]||1),credit={},covered={};let n=0;
      for(let d=0;d<=state.horizon;d++){
        pool+=tasks.filter(t=>t.returnDay===d).reduce((s,t)=>s+t.quantity,0);
        for(const t of tasks){let need=portion(t,d);if(!need)continue;
          const use=Math.min(pool,need);pool-=use;need-=use;covered[t.id]=(covered[t.id]||0)+use;let c=credit[t.id]||0;
          while(need>c){const q=Math.min(unit,t.quantity-covered[t.id]);if(q<=0)break;covered[t.id]+=q;n++;
            out.push({id:'D-'+code[m]+'-'+String(n).padStart(2,'0'),name:t.zone.replace('B-','')+'동 '+kname[m]+' 반입 ('+t.name.split(' ').slice(1).join(' ')+')',material:m,quantity:q,zone:t.zone,day:d,for_task:t.id});c+=q;}
          credit[t.id]=c-need;}
      }
    }
    state.deliveries=out;
    for(const m of TYPES){if(!state.materials[m])continue;state.materials[m].quantity=(state.lots||[]).filter(l=>l.type===m&&l.state==='stored').reduce((s,l)=>s+(l.quantity||0),0)+out.filter(d=>d.material===m).reduce((s,d)=>s+d.quantity,0);}
    return state;
  }
  function calculateAuto(state,count){if(state&&state.deliveryAuto)regenerateDeliveries(state);return state&&state.engine==='legacy'?calculate(state,count):calculateMO(state);}
  return {TYPES,rect,clone,area,bbox,center,inside,overlaps,contained,validPolygon,slotsFor,pose,fit,zoneOf,demo,audit,problem,simulate,dominates,calculate:calculateAuto,calculateLegacy:calculate,calculateMO,regenerateDeliveries,AXES_MO,AXES_LEGACY};
});

