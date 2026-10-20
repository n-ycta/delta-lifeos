/** Real root FrameHost; Media is an inert SDK fixture, LifeOS uses the actual backend. */
import {createRoot} from 'react-dom/client';import React,{useState}from'react';
import{FrameHost,AppSlot}from'../../delta-ui/src/shell/frames';
import{installHostBridge}from'../../delta-ui/src/host/contract';
import'../../delta-ui/src/ui/controls.css';
installHostBridge({info:async()=>({kind:'web',version:'test',uiVersion:'test',bridgeVersion:'1.0.0',features:['portable-apps']}),call:async r=>{if(r.capability==='host.apps_launch')return{url:'http://127.0.0.1:5231/'+(r.args?.id==='dev.delta.media'?'tests/media-fixture.html':'')};const response=await fetch('/test-api',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(r)});const d=await response.json();if(!response.ok)throw Object.assign(Error(d.error),{code:d.error});return d.result;}});
function Host(){const[id,set]=useState('dev.delta.lifeos');return <FrameHost><nav style={{position:'fixed',zIndex:100,top:0,height:48,background:'#242436',width:'100%'}}><button onClick={()=>set('dev.delta.lifeos')}>LifeOS tab</button><button onClick={()=>set('dev.delta.media')}>Media tab</button></nav><div style={{position:'fixed',inset:'48px 0 0'}}><AppSlot id={id} className="test-slot"/></div></FrameHost>}
createRoot(document.getElementById('root')!).render(<Host/>);
