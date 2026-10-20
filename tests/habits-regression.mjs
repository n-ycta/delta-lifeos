import{chromium}from'playwright';import{createServer}from'vite';import assert from'node:assert/strict';import{mkdtemp,rm,mkdir}from'node:fs/promises';import{tmpdir}from'node:os';import{join,resolve}from'node:path';import{createLifeOS}from'../server/lifeos.mjs';import{filePersistence}from'../server/persistence.mjs';import{capabilities}from'../server/contract.mjs';
const dir=await mkdtemp(join(tmpdir(),'delta-lifeos-browser-')),output=process.env.QA_DIR||'/data/delta-lifeos-qa';await mkdir(output,{recursive:true});let h=await createLifeOS({persistence:filePersistence(dir)});const owner={kind:'token',name:'fixture-owner',scopes:['admin']};const call=(op,args={})=>h['lifeos.'+op](args,owner);await call('task_create',{data:{title:'Задача из Vector'},requestId:'fixture'});await call('project_create',{data:{title:'Проект из Vector'},requestId:'project'});
const pluginServer=await createServer({configFile:'vite.config.ts',server:{port:5231,strictPort:true,host:'127.0.0.1'}});await pluginServer.listen();
const hostServer=await createServer({configFile:'vite.config.ts',resolve:{alias:{react:resolve('../delta-ui/node_modules/react'),'react-dom':resolve('../delta-ui/node_modules/react-dom')}},server:{port:5232,strictPort:true,host:'127.0.0.1'},plugins:[{name:'lifeos-test-service',configureServer(server){server.middlewares.use('/test-api',async(req,res)=>{try{let body='';for await(const c of req)body+=c;const a=JSON.parse(body);if(!capabilities.includes(a.capability)||a.node)throw Error('forbidden');const result=await h[a.capability](a.args||{},owner);res.setHeader('content-type','application/json');res.end(JSON.stringify({result}))}catch(e){res.statusCode=400;res.end(JSON.stringify({error:e.code||'operation_failed'}))}})}}]});await hostServer.listen();
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/local/bin/chromium',args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
await page.addInitScript(()=>{Object.defineProperty(crypto,'randomUUID',{value:undefined,configurable:true});Object.defineProperty(crypto,'subtle',{value:undefined,configurable:true});});
const open=async(q={})=>{await page.goto('http://127.0.0.1:5232/tests/host.html?'+new URLSearchParams({plugin:'http://127.0.0.1:5231',skin:'mocha',...q}));const f=page.frameLocator('iframe').first();await f.locator('html[data-lifeos-connected=true]').waitFor({timeout:15000});return f};
const saved=async f=>{await page.waitForTimeout(1000);await f.locator('.save-state').filter({hasText:'Сохранено в Delta'}).waitFor();await page.waitForTimeout(250)};
try{let f=await open();await f.locator('#nav [data-v=habits]').click();
for(const [name,category] of [['Зубы утро','Жизнь'],['Зубы вечер','Здоровье']]){
 await f.locator('[data-a=newI]').first().click();await f.locator('#m_t').fill(name);
 await f.locator('.ov').last().locator('[data-a=newCat]').click();await f.locator('#m_cn').fill(category);await f.locator('.ov').last().locator('#mok').click();
 assert.equal(await f.locator('#m_c').getAttribute('data-v'),category);
 await f.locator('#m_c .delta-select-trigger').click();await f.getByRole('option',{name:'Без категории',exact:true}).click();
 assert.equal(await f.locator('#m_c').getAttribute('data-v'),'');
 await f.locator('#m_c .delta-select-trigger').click();await f.getByRole('option',{name:category,exact:true}).click();
 assert.equal(await f.locator('#m_c').getAttribute('data-v'),category);
 await f.locator('.ov').last().locator('#mok').click();await saved(f);
}
assert.equal(await f.locator('.card .habit-row').count(),2,'Both habits must remain inside their card');
// Existing habit category changes must survive a reload, not just look selected in the modal.
await f.locator('.habit-row [data-a=editI]').first().click();
await f.locator('#m_c .delta-select-trigger').click();await f.getByRole('option',{name:'Здоровье',exact:true}).click();
await f.locator('.ov').last().locator('#mok').click();await saved(f);
f=await open();await f.locator('#nav [data-v=habits]').click();
assert.equal(await f.locator('.card .habit-row').count(),2);
assert.match(await f.locator('.habit-row').first().innerText(),/Здоровье/);
for(const width of [1440,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(200);await page.screenshot({path:join(output,`habits-filled-${width}.png`),fullPage:true});}
assert.deepEqual(errors,[]);console.log('PASS: two habits contained in card; create/select/edit categories and durable save');
}finally{await browser.close();await hostServer.close();await pluginServer.close();await rm(dir,{recursive:true,force:true})}
