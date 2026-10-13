/* Compact Compare chart controls; view-only, preserves chart canvas and telemetry processing. */
(()=>{
'use strict';
const root=document.getElementById('compare');if(!root)return;
const grid=root.querySelector('.compare-telemetry-grid');if(!grid)return;
const panels=[...grid.querySelectorAll(':scope > .card')];
const labels=['THROTTLE','BRAKE','SPEED'];
const key='ams_compare_chart_visibility_v1';
let stored={};try{stored=JSON.parse(localStorage.getItem(key)||'{}')||{}}catch{}
const toolbar=document.createElement('div');toolbar.className='ams-chart-toolbar';
const title=document.createElement('strong');title.textContent='TELEMETRY CHANNELS';
const buttons=document.createElement('div');buttons.className='ams-chart-toolbar-actions';
toolbar.append(title,buttons);grid.before(toolbar);
const update=(i,enabled)=>{
 const panel=panels[i];if(!panel)return;
 panel.hidden=!enabled;
 panel.classList.toggle('ams-channel-hidden',!enabled);
 const button=buttons.children[i];if(button){button.setAttribute('aria-pressed',String(enabled));button.classList.toggle('selected',enabled);}
 stored[labels[i]]=enabled;
 try{localStorage.setItem(key,JSON.stringify(stored))}catch{}
};
panels.forEach((panel,i)=>{
 const name=labels[i]||'CHANNEL '+(i+1);
 const button=document.createElement('button');button.type='button';button.className='ams-channel-toggle';button.textContent=name;
 button.setAttribute('aria-label','Mostrar ou ocultar gráfico '+name);
 button.addEventListener('click',()=>update(i,panel.hidden));
 buttons.append(button);update(i,stored[name]!==false);
});
const all=document.createElement('button');all.type='button';all.className='ams-channel-reset';all.textContent='TODOS';
all.addEventListener('click',()=>panels.forEach((_,i)=>update(i,true)));
buttons.append(all);
})();