import {readFile,writeFile,mkdir}from'node:fs/promises';
const dir=new URL('../src/lifeos/',import.meta.url),parts=['core','storage','ui','diary','tasks','skills','planner','insights','vault'];
const icons=JSON.parse(await readFile(new URL('icons.json',dir),'utf8'));
const sprite='<svg style="position:absolute;width:0;height:0;overflow:hidden" aria-hidden="true"><defs>'+Object.entries(icons).map(([k,v])=>`<symbol id="ph-${k}" viewBox="0 0 256 256">${v}</symbol>`).join('')+'</defs></svg>';
let js='';for(const p of parts)js+=await readFile(new URL(p+'.js',dir),'utf8')+'\n';
js=js.replace(/\nboot\(\);\s*$/,'\n');js+=await readFile(new URL('delta-adapter.js',dir),'utf8');
const libs=await readFile(new URL('yaml.min.js',dir),'utf8')+'\n'+await readFile(new URL('fflate.min.js',dir),'utf8');
await mkdir(new URL('../public/lifeos/',import.meta.url),{recursive:true});
await writeFile(new URL('../public/lifeos/runtime.js',import.meta.url),libs+'\n(()=>{document.getElementById("lifeos-shell").insertAdjacentHTML("afterbegin",'+JSON.stringify(sprite)+');\n'+js+'\n})();');
