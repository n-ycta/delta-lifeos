import {DeltaError} from './delta-sdk.mjs';
/** Register before Storage provisioning. Never replace unavailable server data with defaults. */
export function resilientService(names,initialize,{retryMs=2000}={}){
 let current,closed=false,timer,error;
 const start=async()=>{try{current=await initialize();error=null}catch(e){error=e.code||'unavailable';if(!closed){timer=setTimeout(()=>void start(),retryMs);timer.unref()}}};
 const initial=start();
 const handlers=Object.fromEntries(names.map(name=>[name,async(a,c)=>{await Promise.race([initial,new Promise(r=>setTimeout(r,100))]);if(current)return current[name](a,c);if(name==='lifeos.status')return {storage:'connecting',ready:false,error,notices:[{id:'lifeos.storage',severity:'warn',message:'Storage unavailable. LifeOS will reconnect; no data has been replaced.',localizations:{ru:'Хранилище недоступно. LifeOS подключится автоматически; данные не заменены.'}}]};throw new DeltaError('unavailable','LifeOS is waiting for Delta Storage. Retry after Storage is ready.')} ]));
 return {handlers,close(){closed=true;clearTimeout(timer)}};
}
