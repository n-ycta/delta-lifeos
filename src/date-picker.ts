import {icon} from '@delta/ui/sdk/icons';
import './date-picker.css';
/** Shared app/native-workspace date control. The backing ISO input retains form/change semantics. */
export function datePickers(){
 const known=new WeakSet<HTMLInputElement>();let dismiss=()=>{};let active:HTMLInputElement|null=null;
 const iso=(d:Date)=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
 const parse=(s:string)=>{const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d,12)};
 const enhance=(input:HTMLInputElement)=>{if(known.has(input))return;known.add(input);
  const wrap=document.createElement('span');wrap.className='delta-date';input.before(wrap);wrap.append(input);input.classList.add('delta-date-native');input.tabIndex=-1;input.setAttribute('aria-hidden','true');
  const trigger=document.createElement('button');trigger.type='button';trigger.className='delta-date-trigger';trigger.setAttribute('aria-haspopup','dialog');trigger.setAttribute('aria-expanded','false');wrap.append(trigger);
  const update=()=>{trigger.innerHTML=`${icon('calendar-blank')}<span>${input.value?parse(input.value).toLocaleDateString('ru-RU',{day:'numeric',month:'short',year:'numeric'}):'Выбрать дату'}</span>`;trigger.setAttribute('aria-label',input.getAttribute('aria-label')||input.closest('label')?.textContent?.trim()||'Выбрать дату');trigger.disabled=input.disabled;};update();input.addEventListener('change',update);input.addEventListener('focus',()=>trigger.focus());
  trigger.onclick=()=>{if(active===input){dismiss();return}dismiss();active=input;
   let month=input.value?parse(input.value):new Date(),focus=input.value?parse(input.value):new Date();month.setDate(1);
   const panel=document.createElement('div');panel.className='delta-date-popup';panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Выбор даты');panel.tabIndex=-1;
   (input.closest('dialog[open]')||document.body).append(panel);
   const allowed=(s:string)=>(!input.min||s>=input.min)&&(!input.max||s<=input.max);
   const choose=(s:string)=>{if(s&&!allowed(s))return;input.value=s;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));update();dismiss();if(trigger.isConnected)trigger.focus()};
   const place=()=>{const r=trigger.getBoundingClientRect(),w=Math.min(innerWidth<=800?352:336,innerWidth-24);panel.style.width=w+'px';panel.style.left=Math.max(12,Math.min(r.left,innerWidth-w-12))+'px';const height=panel.offsetHeight;panel.style.top=Math.max(12,r.bottom+height+8<innerHeight?r.bottom+8:r.top-height-8)+'px'};
   const draw=()=>{const y=month.getFullYear(),m=month.getMonth(),offset=(new Date(y,m,1).getDay()+6)%7,count=new Date(y,m+1,0).getDate();
    panel.innerHTML=`<header><button type="button" data-month="-1" aria-label="Предыдущий месяц">${icon('arrow-left')}</button><strong>${month.toLocaleDateString('ru-RU',{month:'long'})}</strong><input aria-label="Год" type="number" min="1900" max="2100" value="${y}"><button type="button" data-month="1" aria-label="Следующий месяц">${icon('arrow-right')}</button></header><div class="date-week">${['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d=>`<span>${d}</span>`).join('')}</div><div class="date-days">${'<span></span>'.repeat(offset)}${Array.from({length:count},(_,i)=>{const s=iso(new Date(y,m,i+1,12));return `<button type="button" data-date="${s}" ${allowed(s)?'':'disabled'} aria-label="${s}" aria-pressed="${input.value===s}" class="${iso(new Date())===s?'date-today':''}" tabindex="${iso(focus)===s?0:-1}">${i+1}</button>`}).join('')}</div><footer><button type="button" data-today>Сегодня</button><button type="button" data-clear>Очистить</button></footer>`;
    panel.querySelectorAll<HTMLButtonElement>('[data-month]').forEach(b=>b.onclick=()=>{month=new Date(y,m+Number(b.dataset.month),1,12);draw()});
    panel.querySelector<HTMLInputElement>('input')!.onchange=e=>{const value=Number((e.target as HTMLInputElement).value);if(value>=1900&&value<=2100){month.setFullYear(value);draw()}};
    panel.querySelectorAll<HTMLButtonElement>('[data-date]').forEach(b=>b.onclick=()=>choose(b.dataset.date!));panel.querySelector<HTMLButtonElement>('[data-today]')!.onclick=()=>choose(iso(new Date()));panel.querySelector<HTMLButtonElement>('[data-clear]')!.onclick=()=>choose('');place();
   };
   const outside=(e:PointerEvent)=>{if(!panel.contains(e.target as Node)&&!trigger.contains(e.target as Node))dismiss()};
   dismiss=()=>{panel.remove();active=null;trigger.setAttribute('aria-expanded','false');document.removeEventListener('pointerdown',outside);window.removeEventListener('resize',place);dismiss=()=>{}};
   panel.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();dismiss();trigger.focus()}else if((e.target as HTMLElement).matches('[data-date]')&&['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)){e.preventDefault();focus=parse((e.target as HTMLElement).dataset.date!);focus.setDate(focus.getDate()+({ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7,Home:-((focus.getDay()+6)%7),End:6-(focus.getDay()+6)%7}[e.key]||0));month=new Date(focus.getFullYear(),focus.getMonth(),1,12);draw();panel.querySelector<HTMLButtonElement>(`[data-date="${iso(focus)}"]`)?.focus()}};
   draw();trigger.setAttribute('aria-expanded','true');(panel.querySelector<HTMLButtonElement>(`[data-date="${iso(focus)}"]`)||panel).focus();document.addEventListener('pointerdown',outside);window.addEventListener('resize',place);
  };
 };
 const scan=()=>{if(active&&!active.isConnected)dismiss();document.querySelectorAll<HTMLInputElement>('input[type=date]').forEach(enhance)};new MutationObserver(scan).observe(document.body,{childList:true,subtree:true});scan();window.addEventListener('pagehide',()=>dismiss());
}
