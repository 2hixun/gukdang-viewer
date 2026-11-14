(function(){
'use strict';
/* 처음 열 때 읽을 TEI 파일. 다른 파일을 기본으로 쓰려면 이 경로만 바꾼다. */
const DATA_URL='data/gukdang_baeeo_1-20.tei.xml';
const T='http://www.tei-c.org/ns/1.0';
const XMLNS='http://www.w3.org/XML/1998/namespace';
const STEMS='甲乙丙丁戊己庚辛壬癸', BRANCHES='子丑寅卯辰巳午未申酉戌亥';
const GZ_RE=/[甲乙丙丁戊己庚辛壬癸][子丑寅卯辰巳午未申酉戌亥]/;
const DATE_TYPES={
  reign:{label:'왕대',desc:'묘호나 「朝」로 나타낸 왕대입니다. 값은 재위 기간입니다.'},
  era:{label:'연호+간지',desc:'연호와 간지를 함께 쓴 기년입니다.'},
  ganzhi:{label:'간지',desc:'간지만 쓴 기년으로, 문맥으로 서기를 비정했습니다.'},
  event:{label:'사건',desc:'사건 이름으로 나타낸 시점입니다.'},
  relative:{label:'상대 표현',desc:'앞에 나온 시점에 기대는 상대 표현입니다.'},
  period:{label:'시기',desc:'왕대 밖의 시기 표현입니다.'},
  present:{label:'서술자 현재',desc:'서술자의 현재입니다. 규칙에 따라 값을 매기지 않습니다.'}
};
const ROLES={
  main:{label:'주요 행위자',sample:'朴淳'},
  sub:{label:'등장·관여 인물',sample:'姜燦'},
  ref:{label:'언급 인물',sample:'朱子',desc:'언급만 되는 고대·전설 인물로, 서사 시간 판단에서 뺍니다.'}
};
const DATE_SAMPLES={reign:'宣廟朝',era:'萬曆辛卯',ganzhi:'癸巳',event:'壬辰之變',relative:'明年',period:'高麗末',present:'至今'};
const CERT={high:'확실',medium:'추정',low:'불확실'};

const $=s=>document.querySelector(s);
function h(tag,attrs,...kids){
  const el=document.createElement(tag);
  if(attrs) for(const [k,v] of Object.entries(attrs)){
    if(v==null||v===false) continue;
    if(k==='class') el.className=v; else if(k==='text') el.textContent=v; else el.setAttribute(k,v);
  }
  for(const k of kids){ if(k==null||k===false) continue; el.append(k instanceof Node?k:String(k)); }
  return el;
}
const fmtY=y=>y<0?`기원전 ${-y}`:String(y);
function ganzhi(y){ const i=((y-4)%60+60)%60; return STEMS[i%10]+BRANCHES[i%12]; }

/* ───────── TEI 읽기 ───────── */
function parseTEI(text){
  const doc=new DOMParser().parseFromString(text.replace(/^﻿/,'').trim(),'application/xml');
  const pe=doc.getElementsByTagName('parsererror')[0];
  if(pe) throw new Error('XML 구문 오류: '+pe.textContent.trim().split('\n')[0]);
  const issues=[];
  const all=(ctx,n)=>Array.from(ctx.getElementsByTagNameNS(T,n));
  const first=(ctx,n)=>ctx?ctx.getElementsByTagNameNS(T,n)[0]||null:null;
  const kids=(el,n)=>Array.from(el.children).filter(c=>c.namespaceURI===T&&c.localName===n);
  const txt=el=>el?el.textContent.replace(/\s+/g,' ').trim():'';

  function year(raw,where,s){
    if(raw==null||raw.trim()==='') return null;
    const v=raw.trim(), m=/^(-?)(\d{1,4})/.exec(v);
    if(!m){ issues.push({s,where,msg:`연도 값 "${v}"을 읽을 수 없습니다.`}); return null; }
    if(!/^-?\d{1,4}$/.test(v)) issues.push({s,where,msg:`연도 값 "${v}"에 숫자가 아닌 문자가 있습니다. ${m[1]}${m[2]}로 읽었습니다.`});
    return (m[1]?-1:1)*parseInt(m[2],10);
  }

  const meta={
    title:txt(first(doc,'title')),
    author:txt(first(doc,'author')),
    source:txt(first(first(doc,'sourceDesc'),'p')),
    rules:(()=>{ const ed=first(doc,'editorialDecl'); return ed?all(ed,'item').map(txt):[]; })()
  };

  /* 인물 목록 */
  const persons=new Map();
  const lp=first(doc,'listPerson');
  let prev=null;
  if(lp) for(const ch of lp.children){
    if(ch.namespaceURI!==T) continue;
    if(ch.localName==='person'){
      const id=ch.getAttributeNS(XMLNS,'id')||ch.getAttribute('xml:id')||'';
      const life=tag=>{ const e=kids(ch,tag)[0]; if(!e) return null; const raw=e.getAttribute('when');
        return {y:year(raw,`#${id} <${tag}>`),raw,cert:e.getAttribute('cert')}; };
      const p={id,name:txt(kids(ch,'persName')[0])||id,birth:life('birth'),death:life('death'),notes:kids(ch,'note').map(txt)};
      persons.set(id,p); prev=p;
    } else if(ch.localName==='note'&&prev){
      /* <person> 바깥에 놓인 <note>는 바로 앞 인물의 주석으로 붙인다 */
      prev.notes.push(txt(ch));
      issues.push({where:`#${prev.id}`,msg:`${prev.name} 다음의 <note>가 <person> 밖에 있습니다. 이 인물의 주석으로 붙여 보여 줍니다.`});
    }
  }

  /* 이야기 */
  const stories=[];
  for(const div of all(doc,'div')){
    if(div.getAttribute('type')!=='story') continue;
    const s={n:div.getAttribute('n')||String(stories.length+1),ents:[],node:h('div'),plain:'',parallels:[]};
    let memo=null;
    const walk=(src,dst,parent)=>{
      for(const node of src.childNodes){
        if(node.nodeType===3){ dst.append(document.createTextNode(node.nodeValue)); }
        else if(node.nodeType===8){ memo=node.nodeValue.trim(); }
        else if(node.nodeType===1){
          if(node.namespaceURI===T&&(node.localName==='date'||node.localName==='persName')){
            const e=makeEntity(node,s,parent,memo); memo=null;
            const span=h('span',{class:'m '+e.kind,tabindex:'0','data-eid':e.eid,'data-key':e.key,
              'data-role':e.role,'data-type':e.type,'aria-describedby':'tip'});
            e.span=span; walk(node,span,e.eid); dst.append(span);
          } else walk(node,dst,parent);
        }
      }
    };
    const makeEntity=(el,s,parent,memo)=>{
      const text=txt(el), where=`${s.n}화 「${text}」`;
      let e;
      if(el.localName==='persName'){
        let role=el.getAttribute('role');
        if(!ROLES[role]){ issues.push({s:s.n,where,msg:`@role 값 "${role??''}"이 규칙에 없습니다. 등장·관여 인물로 표시합니다.`}); role='sub'; }
        const ref=(el.getAttribute('ref')||'').replace(/^#/,'');
        const person=persons.get(ref)||null;
        if(!ref) issues.push({s:s.n,where,msg:'@ref가 없습니다.'});
        else if(!person) issues.push({s:s.n,where,msg:`@ref="#${ref}"에 해당하는 <person>이 없습니다.`});
        e={kind:'pers',key:'pers-'+role,role,ref,person,text};
      } else {
        let type=el.getAttribute('type');
        if(!DATE_TYPES[type]){ issues.push({s:s.n,where,msg:`@type 값 "${type??''}"이 규칙에 없습니다. 상대 표현으로 표시합니다.`}); type='relative'; }
        const v={};
        for(const a of ['when','from','to','notBefore','notAfter']){ const r=el.getAttribute(a); if(r!=null) v[a]=year(r,`${where} @${a}`,s.n); }
        let range=null;
        if(v.when!=null) range={lo:v.when,hi:v.when};
        else if(v.from!=null||v.to!=null) range={lo:v.from??null,hi:v.to??null};
        else if(v.notBefore!=null||v.notAfter!=null) range={lo:v.notBefore??null,hi:v.notAfter??null};
        const cert=el.getAttribute('cert');
        let gz=null; const mm=text.match(GZ_RE);
        if(mm&&v.when!=null){
          const c=ganzhi(v.when); gz={text:mm[0],calc:c,ok:c===mm[0]};
          if(!gz.ok) issues.push({s:s.n,where,msg:`원문 간지 ${mm[0]}와 서기 ${v.when}년(${c})이 맞지 않습니다.`});
        }
        if(type==='present'&&range) issues.push({s:s.n,where,msg:'서술자 현재(present)에 값이 매겨져 있습니다.'});
        if(type!=='present'&&!range) issues.push({s:s.n,where,info:true,msg:'정규화 값이 없어 연표에 놓지 않았습니다.'});
        e={kind:'date',key:'date-'+type,type,v,cert,range,gz,text};
      }
      e.eid=s.ents.length; e.parent=parent; e.memo=memo; s.ents.push(e);
      return e;
    };
    kids(div,'p').forEach((p,i)=>{ if(i) s.node.append(h('br')); walk(p,s.node,null); });
    s.plain=s.node.textContent.trim();
    s.parallels=kids(div,'note').map(n=>({type:n.getAttribute('type'),text:txt(n)}));
    /* 이 화의 기년 범위: 서술자 현재 제외 */
    const ys=[]; s.ents.forEach(e=>{ if(e.kind==='date'&&e.range){ if(e.range.lo!=null) ys.push(e.range.lo); if(e.range.hi!=null) ys.push(e.range.hi);} });
    s.span=ys.length?{lo:Math.min(...ys),hi:Math.max(...ys)}:null;
    stories.push(s);
  }
  if(!stories.length) throw new Error('<div type="story">를 찾지 못했습니다.');
  return {meta,persons,stories,issues};
}

/* ───────── 표시 문자열 ───────── */
function fmtVal(e){
  const v=e.v;
  if(v.when!=null) return `${fmtY(v.when)}년`;
  if(v.from!=null||v.to!=null) return `${v.from!=null?fmtY(v.from):'?'}–${v.to!=null?fmtY(v.to):'?'}`;
  if(v.notBefore!=null&&v.notAfter!=null) return `${fmtY(v.notBefore)}–${fmtY(v.notAfter)} 사이`;
  if(v.notBefore!=null) return `${fmtY(v.notBefore)}년 이후`;
  if(v.notAfter!=null) return `${fmtY(v.notAfter)}년 이전`;
  return e.type==='present'?'서술자 현재':'값 없음';
}
function fmtLife(p){
  if(!p||(!p.birth&&!p.death)) return '생몰년 미상';
  const one=x=>x&&x.y!=null?fmtY(x.y)+(x.cert&&x.cert!=='high'?'?':''):'?';
  return `${one(p.birth)} – ${one(p.death)}`;
}
const fmtSpan=sp=>!sp?'기년 표지 없음':(sp.lo===sp.hi?`${fmtY(sp.lo)}`:`${fmtY(sp.lo)}–${fmtY(sp.hi)}`);

/* ───────── 상태 ───────── */
let DATA=null, cur=null;
const off=new Set();
const KEYS=[...Object.keys(ROLES).map(k=>'pers-'+k),...Object.keys(DATE_TYPES).map(k=>'date-'+k)];

function load(text,label){
  const d=parseTEI(text);
  DATA=d; hideTip(true);
  renderChrome();
  route();
  $('#load-status').textContent=label||'';
  $('#load-status').className='';
}

function renderChrome(){
  const {meta,stories,issues}=DATA;
  const m=/^(\S+)/.exec(meta.title||'');
  $('#brand-title').textContent=m?m[1]:'菊堂排語';
  $('#brand-sub').textContent=`국당배어 · ${stories[0].n}–${stories[stories.length-1].n}화 열람 파일럿`;
  $('#source-desc').textContent=[meta.author&&`저자 ${meta.author}`,meta.source].filter(Boolean).join(' · ');
  const list=$('#story-list'); list.replaceChildren();
  for(const s of stories){
    list.append(h('li',null,h('a',{href:'#s'+s.n,'data-n':s.n},
      h('span',{class:'no',text:s.n}),
      h('span',{class:'inc',lang:'lzh',text:s.plain.slice(0,16)}),
      h('span',{class:'yr',text:fmtSpan(s.span)}))));
  }
  const rules=$('#rules'); rules.replaceChildren(...meta.rules.map(r=>h('li',{text:r})));
  const ul=$('#issues'); ul.replaceChildren();
  const warn=issues.filter(i=>!i.info).length;
  $('#issues-summary').textContent=`데이터 점검 · 확인 ${warn}건, 참고 ${issues.length-warn}건`;
  for(const i of [...issues].sort((a,b)=>(a.info?1:0)-(b.info?1:0))){
    const w=i.s?h('button',{type:'button',class:'where',text:i.where}):h('span',{class:'where static',text:i.where});
    if(i.s) w.addEventListener('click',()=>{ location.hash='#s'+i.s; });
    ul.append(h('li',{class:i.info?'info':null},w,h('span',{text:i.msg})));
  }
  buildLegend();
}

/* ───────── 범례 ───────── */
function buildLegend(){
  const box=$('#legend'); box.replaceChildren();
  const group=(title,entries)=>{
    const g=h('div',{class:'legend-group'},h('h3',{text:title}));
    for(const [key,label,sample] of entries){
      const btn=h('button',{type:'button',class:'lg','data-key':key,'aria-pressed':String(!off.has(key))},
        sample,h('span',{class:'lg-label',text:label}),h('span',{class:'lg-count','data-count':key}));
      btn.addEventListener('click',()=>{ off.has(key)?off.delete(key):off.add(key); applyOff(); });
      g.append(btn);
    }
    box.append(g);
  };
  group('인물 persName @role',Object.entries(ROLES).map(([k,r])=>['pers-'+k,r.label,
    h('span',{class:'m pers sample','data-role':k,lang:'lzh',text:r.sample})]));
  group('시간 date @type',Object.entries(DATE_TYPES).map(([k,t])=>['date-'+k,t.label,
    h('span',{class:'m date sample','data-type':k,lang:'lzh',text:DATE_SAMPLES[k]})]));
}
function updateCounts(){
  for(const el of document.querySelectorAll('[data-count]')){
    const n=cur.ents.filter(e=>e.key===el.dataset.count).length;
    el.textContent=n; el.classList.toggle('zero',n===0);
  }
}
function applyOff(){
  if(!DATA) return;
  for(const s of DATA.stories) for(const e of s.ents) e.span.classList.toggle('off',off.has(e.key));
  for(const b of document.querySelectorAll('.lg')) b.setAttribute('aria-pressed',String(!off.has(b.dataset.key)));
  hideTip(true);
}
$('#all-on').addEventListener('click',()=>{ off.clear(); applyOff(); });
$('#all-off').addEventListener('click',()=>{ KEYS.forEach(k=>off.add(k)); applyOff(); });

/* ───────── 화 보기 ───────── */
function route(){
  const m=/^#s(\d+)$/.exec(location.hash);
  const s=(m&&DATA.stories.find(x=>x.n===m[1]))||DATA.stories[0];
  show(s);
}
window.addEventListener('hashchange',()=>{ if(DATA) route(); });

function show(s){
  cur=s; hideTip(true);
  const idx=DATA.stories.indexOf(s), total=DATA.stories.length;
  $('#eyebrow').textContent=`${$('#brand-title').textContent} · ${idx+1} / ${total}`;
  $('#story-title').textContent=`제${s.n}화`;
  const nP=new Set(s.ents.filter(e=>e.kind==='pers').map(e=>e.ref||e.text)).size;
  const nD=s.ents.filter(e=>e.kind==='date').length;
  $('#story-meta').replaceChildren(
    h('span',null,'기년 ',h('b',{text:s.span?fmtSpan(s.span):'없음'})),
    h('span',null,'인물 ',h('b',{text:nP+'명'})),
    h('span',null,'시간 표지 ',h('b',{text:nD+'곳'})));
  $('#text').replaceChildren(s.node);
  const par=$('#parallels');
  par.replaceChildren();
  if(s.parallels.length){ par.append(h('span',{text:'병행 자료'})); s.parallels.forEach(p=>par.append(h('span',{class:'chip',text:p.text}))); }
  for(const a of document.querySelectorAll('#story-list a')){
    const on=a.dataset.n===s.n; a.setAttribute('aria-current',on?'true':'false');
    if(on) a.scrollIntoView({block:'nearest',inline:'nearest'});
  }
  $('#prev').disabled=idx===0; $('#next').disabled=idx===total-1;
  updateCounts(); buildTimeline(s);
  window.scrollTo({top:0});
}
const go=d=>{ if(!DATA) return; const i=DATA.stories.indexOf(cur)+d; if(i>=0&&i<DATA.stories.length) location.hash='#s'+DATA.stories[i].n; };
$('#prev').addEventListener('click',()=>go(-1));
$('#next').addEventListener('click',()=>go(1));
document.addEventListener('keydown',ev=>{
  if(ev.key==='Escape'){ hideTip(true); return; }
  if(ev.altKey||ev.ctrlKey||ev.metaKey) return;
  const tag=(ev.target.tagName||'').toLowerCase(); if(tag==='input'||tag==='textarea') return;
  if(ev.key==='ArrowLeft') go(-1); else if(ev.key==='ArrowRight') go(1);
});

/* ───────── 화별 연표 ───────── */
function buildTimeline(s){
  const box=$('#timeline'); box.replaceChildren();
  const rows=[];
  for(const e of s.ents) if(e.kind==='date'&&e.type!=='present')
    rows.push({kind:'date',ents:[e],src:e.text,val:`${DATE_TYPES[e.type].label} · ${fmtVal(e)}${e.cert&&e.cert!=='high'?` (${CERT[e.cert]||e.cert})`:''}`,
      lo:e.range?.lo??null,hi:e.range?.hi??null,has:!!e.range,unc:!!e.cert&&e.cert!=='high'});
  const byRef=new Map(), refs=new Map();
  for(const e of s.ents) if(e.kind==='pers'){
    const k=e.ref||e.text, target=e.role==='ref'?refs:byRef;
    if(!target.has(k)) target.set(k,{ents:[],e});
    target.get(k).ents.push(e);
  }
  for(const [k,g] of refs) if(byRef.has(k)){ byRef.get(k).ents.push(...g.ents); refs.delete(k); }
  for(const g of byRef.values()){
    const p=g.e.person, role=g.ents.some(x=>x.role==='main')?'main':'sub';
    const unc=!!p&&[p.birth,p.death].some(x=>x&&x.cert&&x.cert!=='high');
    rows.push({kind:'pers',ents:g.ents,src:p?p.name:g.e.text,val:`${ROLES[role].label} · ${fmtLife(p)}`,
      lo:p?.birth?.y??null,hi:p?.death?.y??null,has:!!(p&&(p.birth?.y!=null||p.death?.y!=null)),unc});
  }
  const ys=[]; rows.forEach(r=>{ if(r.lo!=null) ys.push(r.lo); if(r.hi!=null) ys.push(r.hi); });
  if(!rows.length){ box.append(h('p',{class:'sec-note',text:'이 화에는 연표에 놓을 시간 표지나 인물이 없습니다.'})); }
  else {
    let d0,d1;
    if(ys.length){ const a=Math.min(...ys), b=Math.max(...ys); const pad=a===b?10:Math.max(3,(b-a)*.05); d0=a-pad; d1=b+pad; }
    else { d0=0; d1=1; }
    const x=y=>((y-d0)/(d1-d0)*100).toFixed(2)+'%';
    const steps=[1,2,5,10,20,25,50,100,200,500,1000];
    const step=steps.find(st=>(d1-d0)/st<=6)||1000;
    const ticks=[]; for(let t=Math.ceil(d0/step)*step;t<=d1;t+=step) ticks.push(t);
    const grid=h('div',{class:'tl'});
    if(ys.length){
      const ax=h('div',{class:'axis','aria-hidden':'true'}); ticks.forEach(t=>ax.append(h('span',{style:`left:${x(t)}`,text:fmtY(t)})));
      grid.append(h('div'),ax);
    }
    for(const r of rows){
      const lab=h('button',{type:'button',class:'tl-lab '+r.kind},h('span',{class:'src',lang:'lzh',text:r.src}),h('span',{class:'val',text:r.val}));
      const tr=h('div',{class:'track','aria-hidden':'true'});
      if(ys.length) ticks.forEach(t=>tr.append(h('span',{class:'tick',style:`left:${x(t)}`})));
      if(!r.has||!ys.length) tr.append(h('span',{class:'novalue',text:'값 없음'}));
      else if(r.lo!=null&&r.hi!=null&&r.lo===r.hi&&r.kind==='date') tr.append(h('span',{class:'pt'+(r.unc?' uncertain':''),style:`left:${x(r.lo)}`}));
      else {
        const L=r.lo!=null?x(r.lo):'0%', R=r.hi!=null?`calc(100% - ${x(r.hi)})`:'0%';
        const cls=['bar',r.kind==='pers'?'pers':'',r.lo==null?'open-l':'',r.hi==null?'open-r':'',r.unc?'uncertain':''].join(' ');
        tr.append(h('span',{class:cls,style:`left:${L};right:${R};min-width:4px`}));
      }
      const spans=()=>r.ents.map(e=>e.span);
      lab.addEventListener('pointerenter',()=>spans().forEach(sp=>sp.classList.add('hl')));
      lab.addEventListener('pointerleave',()=>spans().forEach(sp=>sp.classList.remove('hl')));
      lab.addEventListener('focus',()=>spans().forEach(sp=>sp.classList.add('hl')));
      lab.addEventListener('blur',()=>spans().forEach(sp=>sp.classList.remove('hl')));
      lab.addEventListener('click',()=>{
        const sp=spans(); sp[0].scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
        sp.forEach(el=>{ el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); });
      });
      grid.append(lab,tr);
    }
    box.append(grid);
  }
  const extra=h('div',{class:'tl-extra'});
  const pres=s.ents.filter(e=>e.kind==='date'&&e.type==='present');
  if(pres.length) extra.append(h('div',null,'서술자 현재(값 없음): ',h('span',{class:'serif',lang:'lzh',text:pres.map(e=>e.text).join(' · ')})));
  if(refs.size) extra.append(h('div',null,'언급 인물(연표에서 제외): ',h('span',{class:'serif',lang:'lzh',
    text:[...refs.values()].map(g=>g.e.person?`${g.e.person.name} ${fmtLife(g.e.person)}`:g.e.text).join(' · ')})));
  if(extra.childNodes.length) box.append(extra);
}

/* ───────── 툴팁 ───────── */
const tip=$('#tip'), textEl=$('#text');
let tipEl=null, pinned=false;

function section(e){
  const sec=h('div',{class:'tip-sec'});
  const dl=h('dl',{class:'tip-dl'});
  const row=(k,v,serif)=>dl.append(h('dt',{text:k}),h('dd',{class:serif?'serif':null,text:v}));
  if(e.kind==='pers'){
    const p=e.person, r=ROLES[e.role];
    sec.append(h('div',{class:'tip-kind pers',text:`인물 · ${r.label}`}),h('div',{class:'tip-title',text:p?p.name:e.text}));
    row('원문',e.text,true);
    row('생몰',fmtLife(p));
    if(p){
      for(const [k,x] of [['생년',p.birth],['몰년',p.death]]){
        if(x&&x.cert&&x.cert!=='high') row(`${k} 확실성`,`${CERT[x.cert]||x.cert} (${x.cert})`);
      }
      if(p.birth&&p.death&&p.birth.y!=null&&p.death.y!=null&&p.birth.y>0) row('향년',`${p.death.y-p.birth.y+1}세 (세는나이)`);
    }
    sec.append(dl);
    if(r.desc) sec.append(h('p',{class:'tip-note',text:r.desc}));
    if(p){
      p.notes.forEach(n=>sec.append(h('p',{class:'tip-note',text:n})));
      for(const x of [p.birth,p.death]) if(x&&x.raw&&!/^-?\d{1,4}$/.test(x.raw.trim())) sec.append(h('p',{class:'tip-warn',text:`원 데이터의 연도 값 "${x.raw}"은 숫자 형식이 아닙니다.`}));
      sec.append(h('div',{class:'tip-id',text:'#'+p.id}));
    } else sec.append(h('p',{class:'tip-warn',text:e.ref?`#${e.ref}에 해당하는 인물 정보가 없습니다.`:'@ref가 없습니다.'}));
  } else {
    const t=DATE_TYPES[e.type];
    sec.append(h('div',{class:'tip-kind date',text:`시간 · ${t.label}`}),h('div',{class:'tip-title',text:fmtVal(e)}));
    row('원문',e.text,true);
    if(e.gz) row('간지 대조',e.gz.ok?`${e.gz.text} = 서기 ${e.v.when}년 ✓`:`원문 ${e.gz.text} ≠ ${e.v.when}년(${e.gz.calc})`);
    else if(e.v.when!=null&&e.v.when>0&&e.type!=='present') row('그해 간지',ganzhi(e.v.when),true);
    if(/萬曆/.test(e.text)&&e.v.when!=null) row('연호 연차',`萬曆 ${e.v.when-1572}년`);
    if(e.type!=='present') row('확실성',e.cert?`${CERT[e.cert]||e.cert} (${e.cert})`:'확실 (생략 시 high)');
    sec.append(dl,h('p',{class:'tip-note',text:t.desc}));
    if(e.gz&&!e.gz.ok) sec.append(h('p',{class:'tip-warn',text:'원문 간지와 서기 값이 맞지 않습니다.'}));
    if(e.memo) sec.append(h('p',{class:'tip-note',text:`편집 메모: ${e.memo}`}));
  }
  return sec;
}
function chain(el){
  const out=[]; let n=el;
  while(n&&n!==textEl){ if(n.classList&&n.classList.contains('m')&&!n.classList.contains('off')) out.push(n); n=n.parentElement; }
  return out;
}
function showTip(el,cx,cy){
  const els=chain(el); if(!els.length) return;
  if(tipEl) tipEl.classList.remove('active');
  tipEl=els[0]; tipEl.classList.add('active');
  tip.replaceChildren(...els.map(x=>section(cur.ents[+x.dataset.eid])));
  tip.hidden=false; tip.style.left='0px'; tip.style.top='0px';
  const rects=[...tipEl.getClientRects()];
  let r=rects[0]; if(cy!=null) r=rects.find(q=>cy>=q.top-2&&cy<=q.bottom+2)||r;
  const tw=tip.offsetWidth, th=tip.offsetHeight, vw=document.documentElement.clientWidth, vh=window.innerHeight;
  const anchor=cx!=null&&r.width>tw?cx:r.left+r.width/2;
  let left=Math.max(8,Math.min(anchor-tw/2,vw-tw-8));
  let top=r.bottom+8; if(top+th>vh-8) top=r.top-th-8; if(top<8) top=8;
  tip.style.left=left+'px'; tip.style.top=top+'px';
}
function hideTip(force){
  if(pinned&&!force) return;
  pinned=false; tip.hidden=true;
  if(tipEl){ tipEl.classList.remove('active'); tipEl=null; }
}
const markOf=t=>t&&t.closest?t.closest('.m:not(.off)'):null;
textEl.addEventListener('pointerover',ev=>{
  if(ev.pointerType==='touch'||pinned) return;
  const m=markOf(ev.target); if(m&&m!==tipEl) showTip(m,ev.clientX,ev.clientY);
});
textEl.addEventListener('pointerout',ev=>{
  if(ev.pointerType==='touch'||pinned) return;
  if(!markOf(ev.relatedTarget)) hideTip();
});
textEl.addEventListener('click',ev=>{
  const m=markOf(ev.target);
  if(!m){ hideTip(true); return; }
  if(pinned&&tipEl===m){ hideTip(true); return; }
  pinned=false; showTip(m,ev.clientX,ev.clientY); pinned=true;
});
textEl.addEventListener('focusin',ev=>{ const m=markOf(ev.target); if(m&&!pinned) showTip(m); });
textEl.addEventListener('focusout',()=>hideTip());
textEl.addEventListener('keydown',ev=>{
  if(ev.key==='Enter'||ev.key===' '){ const m=markOf(ev.target); if(m){ ev.preventDefault(); pinned=false; showTip(m); pinned=true; } }
});
document.addEventListener('click',ev=>{ if(pinned&&!textEl.contains(ev.target)&&!tip.contains(ev.target)) hideTip(true); });
window.addEventListener('scroll',()=>hideTip(true),{passive:true});
window.addEventListener('resize',()=>hideTip(true));

/* ───────── 파일 열기 ───────── */
$('#file').addEventListener('change',ev=>{
  const f=ev.target.files&&ev.target.files[0]; if(!f) return;
  const rd=new FileReader();
  rd.onload=()=>{
    try{ load(String(rd.result),`지금 보는 파일: ${f.name}`); location.hash='#s'+DATA.stories[0].n; }
    catch(err){ const st=$('#load-status'); st.textContent=`${f.name}을 읽지 못했습니다. ${err.message}`; st.className='err'; }
  };
  rd.onerror=()=>{ const st=$('#load-status'); st.textContent='파일을 읽지 못했습니다. 다시 시도해 주세요.'; st.className='err'; };
  rd.readAsText(f,'utf-8');
  ev.target.value='';
});

/* ───────── 시작 ───────── */
/* data/ 폴더의 XML을 읽어 온다. 브라우저는 file:// 로 연 페이지에서 fetch를 막으므로
   로컬 웹 서버(README 참고)로 열어야 한다. 서버 없이 열었을 때는 안내문을 띄우고,
   오른쪽의 「XML 파일 열기」 버튼으로는 계속 읽을 수 있다. */
fetch(DATA_URL)
  .then(res=>{ if(!res.ok) throw new Error(`${DATA_URL} 응답 ${res.status}`); return res.text(); })
  .then(text=>load(text,''))
  .catch(err=>{
    const msg=location.protocol==='file:'
      ? '이 페이지를 파일로 직접 열어서 data 폴더의 XML을 읽지 못했습니다. README에 적힌 대로 로컬 서버를 켜고 http://localhost:8000 으로 열어 주세요. 지금 바로 보려면 오른쪽의 「XML 파일 열기」로 data 폴더의 XML을 골라도 됩니다.'
      : `TEI 데이터를 읽지 못했습니다. ${err.message}`;
    $('#text').textContent=msg;
  });
})();
