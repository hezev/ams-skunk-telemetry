/* Engineer v33: real track geometry only; no synthetic data or mapping changes. */
(()=>{'use strict';
const svg=document.getElementById('engineerTrackSvg'),empty=document.getElementById('engineerMapEmpty'),status=document.getElementById('engineerMapStatus');
if(!svg||!empty||!status)return;
const ns='http://www.w3.org/2000/svg';
const node=(tag,attrs,parent=svg)=>{const el=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,String(v)));parent.append(el);return el;};
let signature='';
function render(){
 const track=window.AMSTrack;
 const points=Array.isArray(track?.centerline)?track.centerline:[];
 const ref=track?.reference;
 const count=points.length,first=points[0],last=points[count-1];
 const key=[count,ref?.name||'',ref?.source||'',first?.x,first?.y,last?.x,last?.y,track?.officialCorners?.length||0].join('|');
 if(key===signature)return;
 signature=key;svg.replaceChildren();
 if(count<50||!ref){empty.hidden=false;status.textContent='SEM TRAÇADO';return;}
 const view=track.analysisViewBox?.();
 if(view)svg.setAttribute('viewBox',view);
 const coords=points.filter((_,i)=>i%3===0).map(p=>p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
 node('polyline',{points:coords,class:'engineer-under'});
 node('polyline',{points:coords,class:'engineer-line'});
 const turns=track.detectCorners?.()||[];
 if(turns.length&&turns.every(c=>c.official)){
  for(const c of turns){
   const p=track.localPoint?.(c.p);
   if(!p)continue;
   node('circle',{cx:p.x,cy:p.y,r:16,class:'engineer-turn'});
   node('text',{x:p.x,y:p.y,class:'engineer-turn-num'}).textContent=String(c.index);
  }
 }
 empty.hidden=true;
 status.textContent=(ref.name||'Traçado')+(turns.every(c=>c.official)&&turns.length?' · '+turns.length+' curvas':' · GEO');
}
const observer=new MutationObserver(()=>{if(document.getElementById('engineer')?.classList.contains('active'))requestAnimationFrame(render);});
observer.observe(document.getElementById('engineer'),{attributes:true,attributeFilter:['class']});
document.getElementById('engineerAnalyzeBtn')?.addEventListener('click',()=>requestAnimationFrame(render));
document.getElementById('engineerSessionSelect')?.addEventListener('change',()=>requestAnimationFrame(render));
render();
})();
