/* Map above charts; all other engineering panels remain below charts. */
(()=>{
'use strict';
const view=document.getElementById('telemetry'),slot=document.getElementById('telemetryMapFirst');
if(!view||!slot)return;
const map=document.querySelector('#engineeringAnalysisMount .trajectory-compare-card');
if(map){
  const current=map.querySelector('.trajectory-coach-current');
  const table=map.querySelector('.trajectory-coach-table-wrap');
  if(current||table){
    const panel=document.createElement('article');
    panel.className='card ams-trajectory-coach-panel';
    const head=document.createElement('div');head.className='card-head';
    const title=document.createElement('div');title.className='card-title';title.textContent='Trajectory Coach';
    head.append(title);panel.append(head);
    if(current)panel.append(current);
    if(table)panel.append(table);
    const overview=document.querySelector('#engineeringAnalysisMount .engineering-overview');
    if(overview)overview.before(panel);else document.getElementById('engineeringAnalysisMount').prepend(panel);
  }
  slot.append(map);map.classList.add('ams-telemetry-map-card');
}
const grid=view.querySelector('.telemetry-grid');
if(!grid)return;
const redraw=()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{try{window.AMSCharts?.drawAll?.();}catch(e){console.warn('Chart redraw:',e);}}));
const panels=[...grid.querySelectorAll(':scope > .card')];
const setExpanded=(card,expanded)=>{
  card.classList.toggle('ams-chart-expanded',expanded);
  const b=card.querySelector('.ams-chart-size-button');
  if(b){b.textContent=expanded?'Reduzir':'Ampliar';b.setAttribute('aria-expanded',String(expanded));}
  redraw();
};
for(const card of panels){
  const head=card.querySelector('.card-title');
  if(!head)continue;
  const button=document.createElement('button');
  button.type='button';button.className='ams-chart-size-button';button.textContent='Ampliar';
  button.setAttribute('aria-expanded','false');button.setAttribute('aria-label','Ampliar gráfico '+head.textContent);
  const header=document.createElement('div');header.className='ams-chart-inline-heading';
  head.replaceWith(header);header.append(head,button);
  button.addEventListener('click',()=>setExpanded(card,!card.classList.contains('ams-chart-expanded')));
  const wrap=card.querySelector('.chart-wrap');
  if(wrap){wrap.tabIndex=0;wrap.setAttribute('role','button');wrap.setAttribute('aria-label','Ampliar ou reduzir gráfico '+head.textContent);
    wrap.addEventListener('click',()=>setExpanded(card,!card.classList.contains('ams-chart-expanded')));
    wrap.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();setExpanded(card,!card.classList.contains('ams-chart-expanded'));}});
  }
}
})();
