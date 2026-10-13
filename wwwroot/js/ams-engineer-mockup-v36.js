/* Engineer v36: approved mockup readouts, anomalies and real lap comparison.
   Derived only from AMSEngineer report; no fabricated traffic, inputs or gains. */
(()=>{
'use strict';
const view=document.getElementById('engineer');if(!view)return;
const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const fmtSec=n=>finite(n)?(n>=0?'+':'')+n.toFixed(3)+'s':'—';
const fmtLap=n=>finite(n)&&n>0?Math.floor(n/60)+':'+(n%60).toFixed(3).padStart(6,'0'):'—';
const emptyKpi=()=>{
 for(const id of ['engineerBiggestGain','engineerMainLoss','engineerBrakingConsistency','engineerThrottleConfidence','engineerTrafficEffect','engineerRecommendedFocus'])set(id,'—');
 set('engineerBiggestGainDetail','Potencial de melhoria por zona');
 set('engineerMainLossDetail','Maior perda mediana por zona');
 set('engineerBrakingDetail','Zonas com travagem repetível');
 set('engineerThrottleDetail','Zonas com throttle repetível');
 set('engineerTrafficDetail','Sem dados de tráfego validados');
 set('engineerFocusDetail','À espera de análise');
 const anomalies=document.getElementById('engineerAnomalies');
 if(anomalies)anomalies.textContent='Analisa uma sessão para verificar variações invulgares.';
 for(const id of ['engineerCompareSpeed','engineerCompareThrottle'])document.getElementById(id)?.replaceChildren();
 set('engineerComparisonStatus','Última volta válida vs melhor volta · dados reais');
 set('engineerComparisonDelta','—');
 const no=document.getElementById('engineerComparisonEmpty');if(no)no.hidden=false;
};
const make=(tag,cls,content)=>{
 const n=document.createElement(tag);if(cls)n.className=cls;if(content!=null)n.textContent=String(content);return n;
};
function anomaliesFrom(zones){
 const found=[];
 for(const z of zones){
  if(!finite(z.start)||!finite(z.end))continue;
  const notes=[];
  if(finite(z.timeSd)&&finite(z.medianSeg)&&z.timeSd>Math.max(.14,z.medianSeg*.035))notes.push('variação de tempo σ '+z.timeSd.toFixed(3)+'s');
  if(z.brakeSamples>=3&&finite(z.brakeStdP)&&z.brakeStdP>.003)notes.push('travagem variável');
  if(z.throttleSamples>=3&&finite(z.throttleStdP)&&z.throttleStdP>.004)notes.push('throttle variável');
  if(notes.length)found.push({label:z.label||'Zona',note:notes.join(' · '),severity:finite(z.timeSd)?z.timeSd:0});
 }
 return found.sort((a,b)=>b.severity-a.severity).slice(0,3);
}
const svgNs='http://www.w3.org/2000/svg';
const svgEl=(root,tag,attrs)=>{
 const x=document.createElementNS(svgNs,tag);for(const [k,v] of Object.entries(attrs))x.setAttribute(k,String(v));root.appendChild(x);return x;
};
function trace(svgId,current,best,label){
 const svg=document.getElementById(svgId);if(!svg)return 0;
 svg.replaceChildren();
 const a=Array.isArray(current)?current:[],b=Array.isArray(best)?best:[];
 const values=[...a,...b].filter(finite);
 if(values.length<8)return 0;
 const lo=Math.min(...values),hi=Math.max(...values),span=Math.max(.001,hi-lo);
 const parent=svg.parentElement;
 const legend=parent?.querySelector('span');
 if(legend)legend.textContent=label+' · '+lo.toFixed(0)+'–'+hi.toFixed(0)+(label==='Speed'?' km/h':'');
 for(let i=0;i<=4;i++){const y=9+19*i;svgEl(svg,'line',{x1:20,y1:y,x2:552,y2:y,stroke:'#253848','stroke-width':.7});}
 for(let i=0;i<=4;i++){const x=20+133*i;svgEl(svg,'line',{x1:x,y1:9,x2:x,y2:85,stroke:'#253848','stroke-width':.6});}
 function draw(series,color){
  let path='',active=false,seen=0;
  const n=series.length;
  for(let i=0;i<n;i++){
   const v=series[i];if(!finite(v)){active=false;continue;}
   const x=20+(i/Math.max(1,n-1))*532;
   const y=83-(v-lo)/span*72;
   path+=(active?' L':' M')+x.toFixed(1)+','+y.toFixed(1);
   active=true;seen++;
  }
  if(seen>2)svgEl(svg,'path',{d:path,fill:'none',stroke:color,'stroke-width':2.1,'stroke-linejoin':'round','stroke-linecap':'round'});
 }
 draw(b,'#ed4152');draw(a,'#349fed');
 return values.length;
}
function render(report){
 if(!report?.ok){emptyKpi();return;}
 const zones=Array.isArray(report.zones)?report.zones:[];
 const ranked=zones.filter(z=>finite(z.avgLoss)).sort((a,b)=>b.avgLoss-a.avgLoss);
 const top=ranked[0];
 if(top&&top.avgLoss>.001){
  set('engineerBiggestGain',fmtSec(top.avgLoss));
  set('engineerBiggestGainDetail',(top.label||'Zona')+' · margem vs melhor segmento');
  set('engineerMainLoss',top.label||'Zona');
  set('engineerMainLossDetail','+'+top.avgLoss.toFixed(3)+'s mediana vs melhor');
 }
 const stable=(name,n,threshold,metric,detail)=>{
  const sample=zones.filter(z=>z[name]>=3&&finite(z[n]));
  if(!sample.length){set(metric,'—');set(detail,'Sem eventos suficientes');return;}
  const count=sample.filter(z=>z[n]<=threshold).length;
  set(metric,Math.round(100*count/sample.length)+'%');
  set(detail,count+' de '+sample.length+' zonas estáveis');
 };
 stable('brakeSamples','brakeStdP',.0014,'engineerBrakingConsistency','engineerBrakingDetail');
 stable('throttleSamples','throttleStdP',.0022,'engineerThrottleConfidence','engineerThrottleDetail');
 set('engineerTrafficEffect','—');
 set('engineerTrafficDetail','Canal de tráfego não disponível na análise');
 const focus=Array.isArray(report.priorities)?report.priorities[0]:null;
 set('engineerRecommendedFocus',focus?.label||'—');
 set('engineerFocusDetail',focus?(focus.diagnosis+' · confiança '+focus.confidence+'%'):'Sem prioridade confirmada');
 const host=document.getElementById('engineerAnomalies');
 if(host){
  host.replaceChildren();
  const found=anomaliesFrom(zones);
  if(!found.length){host.textContent='Sem anomalias confirmadas pelas variações de tempo e inputs analisados.';}
  for(const e of found){const line=make('div','engineer-finding-row');line.append(make('strong','',e.label),make('span','',e.note));host.append(line);}
 }
 const cmp=report.lapComparison;
 let plotted=0;
 if(cmp){plotted+=trace('engineerCompareSpeed',cmp.speedCurrent,cmp.speedBest,'Speed');
  plotted+=trace('engineerCompareThrottle',cmp.throttleCurrent,cmp.throttleBest,'Throttle');
  set('engineerComparisonStatus','Última '+fmtLap(cmp.latestTime)+' · Melhor '+fmtLap(cmp.bestTime));
  const diff=(finite(cmp.latestTime)&&finite(cmp.bestTime))?cmp.latestTime-cmp.bestTime:null;
  set('engineerComparisonDelta',diff===null?'—':fmtSec(diff));
 }
 const no=document.getElementById('engineerComparisonEmpty');
 if(no)no.hidden=plotted>0;
 const tiles=view.querySelectorAll('.engineer-scorecard>div');
 if(tiles[0])tiles[0].style.setProperty('--engineer-score-fill',(finite(report.consistency)?Math.max(0,Math.min(100,report.consistency)):0)+'%');
 if(tiles[2])tiles[2].style.setProperty('--engineer-score-fill',(finite(report.driverShare)?Math.max(0,Math.min(100,report.driverShare*100)):0)+'%');
}
window.addEventListener('ams-engineer-analysis',e=>render(e.detail?.report));
view.querySelectorAll('[data-engineer-prompt]').forEach(btn=>btn.addEventListener('click',()=>{
 const input=document.getElementById('engineerQuestion');
 if(!input)return;
 input.value=btn.dataset.engineerPrompt||'';
 input.focus();
 document.getElementById('engineerAskBtn')?.click();
}));
// Dynamic v2 summary remains available in the expandable additional information,
// rather than creating a tall duplicate row before the three-column workstation.
const enhancement=view.querySelector('.ams-enhancement-grid');
const secondary=view.querySelector('.engineer-secondary-details');
if(enhancement&&secondary)secondary.append(enhancement);
emptyKpi();
})();