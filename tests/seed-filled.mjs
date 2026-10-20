import {defaults} from '../server/workspace.mjs';import {createHash,randomUUID} from 'node:crypto';
export async function seed(call){
const date=new Date().toISOString().slice(0,10),prev=new Date(Date.now()-86400000).toISOString().slice(0,10),w=defaults();w.name='Тестовый профиль';w.cats=['Жизнь','Здоровье','Развитие'];
w.fields=[{id:'sleep',name:'Сон, ч',type:'number',when:'daily'},{id:'mood',name:'Настроение',type:'rating',max:5,when:'daily'}];
for(const [d,s,m] of [[date,7.5,4],[prev,8,5]])w.entries[d]=`---\ndate: "${d}"\nsleep: ${s}\nmood: ${m}\n_fields: ["sleep","mood"]\n---\n# Итоги дня\nЗавершил подготовку проекта. Сегодня — прогулка и английский.`;
w.items=[{id:'qa-task',kind:'task',title:'Подготовить презентацию проекта',cat:'Развитие',created:date,due:date,prio:3,rep:{t:'none',n:1},done:{},exceptions:[]}];
w.skills=[['qa-english','Английский',null,[0]],['qa-speaking','Разговорная практика','qa-english',[]]].map(([id,name,p,ok])=>({id,name,p,ok,desc:'Рабочее общение',crit:[{id:'a',v:1,t:'Короткий диалог'},{id:'b',v:50,t:'Рабочая встреча'},{id:'c',v:100,t:'Доклад'}],hist:[],proofs:{},agg:'manual',icon:'plant',noRw:true}));
w.ledger=[{id:'reward-a',date,amt:12,why:'Завершён проект',cat:'Развитие',k:'on'},{id:'reward-b',date:prev,amt:-2,why:'Перенос задачи',cat:'Развитие',k:'move'}];
w.log=[{t:new Date().toISOString(),x:'Подготовлена презентация проекта'},{t:new Date().toISOString(),x:'Подтверждён уровень английского'}];
w.blocks.week=[{id:'block-a',name:'Работа над проектом',s:540,e:660,color:'#a787ff',cat:'Развитие',tasks:['qa-task']},{id:'block-b',name:'Прогулка',s:780,e:825,color:'#68bfa4',cat:'Здоровье',tasks:[]}];
const text=JSON.stringify(w),rev=(await call('workspace_read')).revision,up=await call('workspace_begin',{revision:rev,parts:1,sha256:createHash('sha256').update(text).digest('hex')});
await call('workspace_chunk',{uploadId:up.uploadId,index:0,data:text});await call('workspace_commit',{uploadId:up.uploadId,revision:rev,requestId:randomUUID()});
for(const [type,data] of [['project',{title:'Обновление портфолио',description:'Подготовить три проекта',nextStep:'Выбрать работы'}],['practice',{title:'Чтение',unit:'страниц',target:20}],['direction',{title:'Профессиональный рост',description:'Развитие самостоятельных проектов'}],['experiment',{title:'Утренний фокус',hypothesis:'Без уведомлений легче сосредоточиться',from:date,to:date}]])await call(type+'_create',{data,requestId:randomUUID()});
}
