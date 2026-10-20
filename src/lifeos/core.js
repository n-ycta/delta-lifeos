const $=s=>document.querySelector(s),g=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid=()=>globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2,9),p2=n=>String(n).padStart(2,'0');
const ymd=d=>{d=d||new Date();return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())},pd=s=>{const[a,b,c]=s.split('-');return new Date(a,b-1,c)},addD=(s,n)=>{const d=pd(s);d.setDate(d.getDate()+n);return ymd(d)},today=()=>window.DeltaLifeOS.date();
const P={book:'notebook',check:'check-square',repeat:'repeat',diamond:'sketch-logo',user:'user-circle',tree:'tree-structure',cal:'calendar-blank',chart:'chart-bar',clock:'clock',trash:'trash',x:'x',dl:'download-simple',ul:'upload-simple',l:'caret-left',r:'caret-right',edit:'pencil-simple',mv:'arrow-right',cfg:'sliders-horizontal'};
const ic=(n,w)=>`<svg class="i" width="22" height="22" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><use href="#ph-${P[n]||n}"/></svg>`;
const KEY='delta.lifeos.cache';let S;
const def=()=>({name:'Я',fields:[],tpls:[],entries:{},items:[],ledger:[],log:[],skip:[],cats:[],offCats:[],skills:[],rules:{task:{on:0,late:0,miss:0,move:0,en:1,grace:1},habit:{on:0,late:0,miss:0,move:0,en:1,grace:0},skill:{on:0,en:1}},blocks:{week:[],dow:{},ex:{}}});

function toast(t){const e=$('#toast');e.textContent=t;e.style.display='block';clearTimeout(toast.t);toast.t=setTimeout(()=>e.style.display='none',3000)}
const lg=t=>{S.log.unshift({t:new Date().toISOString(),x:t});S.log.length=Math.min(S.log.length,300)};

function download(n,t){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([t],{type:'text/markdown'}));a.download=n;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),999)}

const dumpMd=(fm,b)=>'---\n'+Object.entries(fm).filter(([k,v])=>v!==''&&v!=null).map(([k,v])=>k+': '+JSON.stringify(v)).join('\n')+'\n---\n'+b;

const dm=n=>(n>0?'+':'')+n,bal=L=>L.reduce((a,l)=>a+l.amt,0);
const items=k=>S.items.filter(i=>i.kind===k),sched=(i,d)=>Schedules.isDue(i,d);

function inp(f,v){const id='f_'+f.id;switch(f.type){
case'number':return`<input id="${id}" type="number" step="any" value="${esc(v)}">`;
case'date':return`<input id="${id}" type="date" value="${esc(v)}">`;
case'range':v=v||['',''];return`<span class="row"><input id="${id}_0" type="date" value="${esc(v[0])}"><input id="${id}_1" type="date" value="${esc(v[1])}"></span>`;
case'check':return`<input id="${id}" type="checkbox" ${v?'checked':''}>`;
case'select':return`<select id="${id}"><option></option>${(f.opts||[]).map(o=>`<option ${o==v?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
case'multi':return`<span class="chips" id="${id}">${(f.opts||[]).map(o=>`<label><input type="checkbox" value="${esc(o)}" ${(v||[]).includes(o)?'checked':''}> ${esc(o)}</label>`).join('')}</span>`;
case'list':return`<input id="${id}" value="${esc((v||[]).join(', '))}" placeholder="через запятую">`;
case'rating':{const mx=f.max||5;return`<span class="rt"><input type="hidden" id="${id}" value="${v||0}">${Array.from({length:mx},(_,k)=>`<button type="button" data-a="rate" data-x="${k+1}" class="${k<v?'on':''}">${k+1}</button>`).join('')}</span>`}
default:return`<input id="${id}" value="${esc(v)}">`}}
function rd(f){const id='f_'+f.id;switch(f.type){case'number':{const v=g(id).value;return v===''?'':+v}case'check':return g(id).checked;case'range':return[g(id+'_0').value,g(id+'_1').value];case'multi':return[...g(id).querySelectorAll('input:checked')].map(i=>i.value);case'list':return g(id).value.split(',').map(s=>s.trim()).filter(Boolean);case'rating':return+g(id).value||'';default:return g(id).value}}

const TY={text:'Текст',number:'Число',date:'Дата',range:'Диапазон дат',list:'Список',select:'Выбор одного',multi:'Множественный выбор',check:'Чекбокс',rating:'Оценка'};
let view='diary',D=today(),cm=today().slice(0,7),scope='date',extra=[],tf='',sf={from:'',to:'',cat:'',fld:''};

const V={};

const pt=(m,r)=>{const a=m/1440*2*Math.PI-Math.PI/2;return[(160+r*Math.cos(a)).toFixed(1),(160+r*Math.sin(a)).toFixed(1)]};
const arc=(a,b,r1,r2)=>{if(b<=a)b+=1440;const l=b-a>720?1:0,[x1,y1]=pt(a,r2),[x2,y2]=pt(b-.01,r2),[x3,y3]=pt(b-.01,r1),[x4,y4]=pt(a,r1);return`M${x1} ${y1}A${r2} ${r2} 0 ${l} 1 ${x2} ${y2}L${x3} ${y3}A${r1} ${r1} 0 ${l} 0 ${x4} ${y4}Z`};
const tm=m=>p2(m/60|0)+':'+p2(m%60),mt=s=>{const[a,b]=s.split(':');return+a*60+ +b};
const getB=d=>S.blocks.ex[d]||S.blocks.dow[pd(d).getDay()]||S.blocks.week,cl=o=>JSON.parse(JSON.stringify(o));

const kids=p=>S.skills.filter(n=>(n.p||null)===p);

const PRE=[{name:'Сон, ч',type:'number'},{name:'Настроение',type:'rating',max:5},{name:'Самочувствие',type:'select',opts:['плохо','нормально','хорошо']}];
function closeDD(){document.querySelectorAll('.dm').forEach(m=>m.remove())}

const catChips=v=>S.cats.map(c=>`<button type="button" class="${c==v?'on':''}" data-a="pickC" data-x="${esc(c)}">${esc(c)}</button>`).join('')+`<button type="button" class="ad" data-a="newCat">${ic('plus')} Категория</button>`;
const catPick=(id,v)=>`<div class="chips2 pk" id="${id}" data-v="${esc(v||'')}">${catChips(v)}</div>`;

const A={},C={};

A.pickC=(x,el)=>{const p=el.parentNode,on=p.dataset.v===x;p.dataset.v=on?'':x;p.querySelectorAll('button:not(.ad)').forEach(b=>b.classList.toggle('on',!on&&b.dataset.x===x))};
A.newCat=()=>modal('Новая категория','<div class="fr"><label>Название</label><input id="m_cn"></div>',()=>{const n=g('m_cn').value.trim();if(!n)throw Error('Введите название');if(!S.cats.includes(n))S.cats.push(n);save();const pk=[...document.querySelectorAll('.pk')];pk.forEach(p=>p.innerHTML=catChips(p.dataset.v));const l=pk.at(-1);if(l){l.dataset.v=n;l.innerHTML=catChips(n)}});
A.fieldsM=()=>fieldsM();A.rulesM=()=>rulesM();A.newF=()=>fieldM();A.editF=x=>fieldM(x);
A.addToE=x=>{saveE(1);extra.push(x);render();fieldsM()};
A.saveE=()=>saveE();A.dlE=()=>{saveE(1);download(D+'.md',S.entries[D]||dumpMd({date:D},''))};
A.newI=x=>itemM(x);A.editI=x=>itemM(S.items.find(i=>i.id===x).kind,x);A.delI=x=>{if(confirm('Удалить? Начисленная история баланса сохранится.')){S.items=S.items.filter(i=>i.id!==x);lg('Удалена задача или привычка');save();render()}};
A.newB=()=>blockM(null);A.editB=x=>blockM(+x);
A.cmv=x=>{const[y,m]=cm.split('-').map(Number),d=new Date(y,m-1+ +x,1);cm=d.getFullYear()+'-'+p2(d.getMonth()+1);render()};
A.goDiary=()=>go('diary');A.goPlan=()=>go('plan');A.addS=x=>skillM(null,x);A.editS=x=>skillM(x);
A.impB=()=>g('imp').click();
C.tf=v=>{tf=v;render()};C.scope=v=>{scope=v;render()};C.sf=(v,e)=>{sf[e.dataset.k]=v;render()};C.name=v=>{S.name=v;lg('Обновлён профиль');save()};C.imp=(v,e)=>{importFiles([...e.files]);e.value=''};
document.addEventListener('click',e=>{const nav=e.target.closest('#nav [data-v],[data-nav]');if(nav){e.preventDefault();try{go(nav.dataset.v||nav.dataset.nav)}catch(err){toast(err.message)}return}const el=e.target.closest('[data-a]');if(el)try{const result=A[el.dataset.a]?.(el.dataset.x,el);if(result?.catch)result.catch(err=>toast(err.message))}catch(err){toast(err.message);console.error(err)}});
document.addEventListener('change',e=>{const c=e.target.closest('[data-c]');if(c)try{const result=C[c.dataset.c]?.(c.value,c);if(result?.catch)result.catch(err=>toast(err.message))}catch(err){toast(err.message)}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){const o=[...document.querySelectorAll('.ov')].pop();if(o)o.close?.();else document.body.classList.remove('nav-open')}});
const NAV=[['diary','book','Дневник'],['tasks','check','Задачи'],['habits','repeat','Привычки'],['plan','clock','Планировщик'],['cal','cal','Календарь'],['skills','tree','Навыки'],['rewards','diamond','Награды'],['stats','chart','Статистика'],['profile','user','Профиль']];