import { mkdir, readFile, writeFile, rename, copyFile } from "node:fs/promises";
import { join } from "node:path";
export function filePersistence(dir) {
  const read = async name => { try { return JSON.parse(await readFile(join(dir,name),"utf8")); } catch(e) {if(e.code==='ENOENT') return null; throw e;} };
  return {
    async load() {const state=await read('lifeos.json');if(state)return state;const old=await read('vector.json');if(old){await mkdir(dir,{recursive:true,mode:0o700});await copyFile(join(dir,'vector.json'),join(dir,'vector.pre-lifeos.json'));await this.save(old);}return old;},
    async save(value) {await mkdir(dir,{recursive:true,mode:0o700});const tmp=join(dir,'lifeos.json.tmp');await writeFile(tmp,JSON.stringify(value),{mode:0o600});await rename(tmp,join(dir,'lifeos.json'));}
  };
}
export function storagePersistence(client,{component="storage",node}={}) {
 const get=namespace=>client.call(component+'.document_get',{namespace,key:'state'},node);
 const put=(namespace,value)=>client.call(component+'.document_put',{namespace,key:'state',value},node);
 return {async load(){const state=await get('delta_lifeos');if(state)return state;const legacy=await get('delta_vector');if(legacy){await put('delta_lifeos_backup',legacy);await put('delta_lifeos',legacy);}return legacy;},save:value=>put('delta_lifeos',value)};
}
