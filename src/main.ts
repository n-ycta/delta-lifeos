import {datePickers} from './date-picker';
import {randomId} from '@delta/ui/sdk/random';
import {sha256} from '@noble/hashes/sha256';
import {bytesToHex} from '@noble/hashes/utils';
import {connectPlugin,applyThemeTokens,type AppContext} from '@delta/ui/sdk/client';
import '@delta/ui/sdk/styles.css';
import {openLegacy} from './vector';
import './lifeos/layout.css';
import './delta-theme.css';
const params=new URLSearchParams(location.search);
type Host=Awaited<ReturnType<typeof connectPlugin>>;
declare global {interface Window {DeltaLifeOS:{host:Host;id:()=>string;hash:(bytes:Uint8Array)=>string;date:()=>string;legacy:(view:string)=>Promise<void>;surface:string;context:AppContext;parentOrigin:string;flush?:()=>Promise<void>}}}
const shell=document.getElementById('lifeos-shell')!,legacy=document.getElementById('vector-app')!,main=document.getElementById('main')!;
const surface=params.get('surface')||'';
const nativeSurfaces=new Set(['today','capture','practices','projects','review']);
const escape=(x:string)=>x.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
let loaded=false;datePickers();
async function start(){if(parent===window||!params.get('parentOrigin')){main.innerHTML='<section class="card"><h2>Delta LifeOS</h2><p>Откройте приложение через Delta.</p></section>';return}
 const host=await connectPlugin(params.get('parentOrigin')!);
 const settings=await host.call('lifeos.settings_get',{}) as {timezone:string};
 const date=()=>new Intl.DateTimeFormat('en-CA',{timeZone:settings.timezone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const present=(c:AppContext)=>{applyThemeTokens(c.tokens);document.documentElement.dataset.theme=c.theme;document.documentElement.lang=c.language;};present(host.context);host.onPresentation(present);
 const showLegacy=async(view:string)=>{if(window.DeltaLifeOS.flush)await window.DeltaLifeOS.flush();if(surface){shell.hidden=true;legacy.hidden=false}else{shell.hidden=false;window.dispatchEvent(new CustomEvent('delta-lifeos-native',{detail:view}));document.getElementById('native-mount')!.append(legacy);legacy.hidden=false}await openLegacy(host,view);};
 window.DeltaLifeOS={host,id:randomId,hash:bytes=>bytesToHex(sha256(bytes)),date,legacy:showLegacy,surface,context:host.context,parentOrigin:new URL(params.get('parentOrigin')!).origin};
 if(surface)document.body.dataset.surface=surface;
 const runtime=document.createElement('script');runtime.src=new URL('lifeos/runtime.js',location.href.split('?')[0]).href;runtime.onload=()=>{loaded=true;if(nativeSurfaces.has(surface))void showLegacy(surface).catch(error)};runtime.onerror=()=>error(Error('UI assets unavailable'));document.body.append(runtime);
 window.addEventListener('delta-lifeos-home',()=>{legacy.hidden=true;shell.hidden=false;window.dispatchEvent(new CustomEvent('delta-lifeos-refresh'))});
 document.addEventListener('click',e=>{const target=e.target as HTMLElement;if(target.closest('[data-return-lifeos]')){window.dispatchEvent(new CustomEvent('delta-lifeos-home'));return}const el=target.closest<HTMLElement>('[data-legacy]');if(el){e.preventDefault();void showLegacy(el.dataset.legacy!).catch(error)}});
}
function error(e:unknown){if(loaded)window.dispatchEvent(new CustomEvent('delta-lifeos-error',{detail:e}));else main.innerHTML='<section class="card" role="alert"><h2>Delta LifeOS</h2><p>'+escape(e instanceof Error?e.message:'Подключение недоступно')+'</p><button onclick="location.reload()">Повторить</button></section>';}
void start().catch(error);
