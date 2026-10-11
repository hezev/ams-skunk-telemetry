(()=>{
  const TAU=Math.PI*2;
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const wrap=a=>{
    let x=Number(a)||0;
    while(x>Math.PI)x-=TAU;
    while(x<-Math.PI)x+=TAU;
    return x;
  };
  const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);

  function progressOf(sample,index,total){
    const keys=["lapDistPct","LapDistPct","lap_dist_pct","trackPosition","track_position","lapPct","lap_pct"];
    for(const k of keys){
      const v=Number(sample?.[k]);
      if(Number.isFinite(v))return clamp(v>1&&v<=100?v/100:v);
    }
    const percentKeys=["position","trackPositionPct","track_position_pct"];
    for(const k of percentKeys){
      const v=Number(sample?.[k]);
      if(Number.isFinite(v))return clamp(v/100);
    }
    return total>1?index/(total-1):0;
  }

  function latLon(sample){
    const lat=Number(sample?.lat ?? sample?.Lat ?? sample?.latitude ?? sample?.Latitude);
    const lon=Number(sample?.lon ?? sample?.Lon ?? sample?.longitude ?? sample?.Longitude);
    return Number.isFinite(lat)&&Number.isFinite(lon)?{lat,lon}:null;
  }

  function projectGps(rows){
    if(rows.length<3)return [];
    const lat0=rows.reduce((s,p)=>s+p.lat,0)/rows.length;
    const lon0=rows.reduce((s,p)=>s+p.lon,0)/rows.length;
    const metersLat=111320;
    const metersLon=111320*Math.cos(lat0*Math.PI/180);
    return rows.map(p=>({
      x:(p.lon-lon0)*metersLon,
      y:-(p.lat-lat0)*metersLat,
      p:p.p
    }));
  }

  function resampleClosed(points,count=192){
    const clean=(points||[]).filter(p=>Number.isFinite(p?.x)&&Number.isFinite(p?.y));
    if(clean.length<3)return clean;
    const pts=[...clean];
    if(dist(pts[0],pts[pts.length-1])<1e-9)pts.pop();
    if(pts.length<3)return pts;

    const seg=[],cum=[0];
    let total=0;
    for(let i=0;i<pts.length;i++){
      const d=dist(pts[i],pts[(i+1)%pts.length]);
      seg.push(d); total+=d; cum.push(total);
    }
    if(!(total>0))return pts;

    const out=[];
    let si=0;
    for(let k=0;k<count;k++){
      const target=total*k/count;
      while(si<seg.length-1&&cum[si+1]<target)si++;
      const a=pts[si],b=pts[(si+1)%pts.length],len=seg[si]||1;
      const t=clamp((target-cum[si])/len);
      out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
    }
    return out;
  }

  function normalizePoints(points){
    const pts=resampleClosed(points,192);
    if(pts.length<16)return [];
    const cx=pts.reduce((s,p)=>s+p.x,0)/pts.length;
    const cy=pts.reduce((s,p)=>s+p.y,0)/pts.length;
    const centered=pts.map(p=>({x:p.x-cx,y:p.y-cy}));
    const rms=Math.sqrt(centered.reduce((s,p)=>s+p.x*p.x+p.y*p.y,0)/centered.length)||1;
    return centered.map(p=>({x:p.x/rms,y:p.y/rms}));
  }

  function headings(points){
    const n=points.length;
    if(n<3)return [];
    const out=[];
    for(let i=0;i<n;i++){
      const a=points[(i-1+n)%n],b=points[(i+1)%n];
      out.push(Math.atan2(b.y-a.y,b.x-a.x));
    }
    return out;
  }

  function smoothAngles(values,radius=2){
    const n=values.length;
    if(n<3)return values;
    return values.map((_,i)=>{
      let sx=0,sy=0,w=0;
      for(let d=-radius;d<=radius;d++){
        const a=values[(i+d+n)%n];
        const ww=radius+1-Math.abs(d);
        sx+=Math.cos(a)*ww; sy+=Math.sin(a)*ww; w+=ww;
      }
      return Math.atan2(sy/w,sx/w);
    });
  }

  function signatureFromPoints(points){
    const normalized=normalizePoints(points);
    if(normalized.length<16)return null;
    return {
      points:normalized,
      headings:smoothAngles(headings(normalized),2)
    };
  }

  function circularInterpolate(rows,count=192){
    if(rows.length<8)return [];
    const sorted=[...rows].sort((a,b)=>a.p-b.p);
    const uniq=[];
    for(const row of sorted){
      const prev=uniq[uniq.length-1];
      if(prev&&Math.abs(row.p-prev.p)<.0002)uniq[uniq.length-1]=row;
      else uniq.push(row);
    }
    if(uniq.length<8)return [];

    const out=[];
    let j=0;
    for(let i=0;i<count;i++){
      const p=i/count;
      while(j<uniq.length-2&&uniq[j+1].p<p)j++;
      let a=uniq[j],b=uniq[Math.min(j+1,uniq.length-1)];
      if(p<a.p){
        a={p:uniq[uniq.length-1].p-1,yaw:uniq[uniq.length-1].yaw};
        b=uniq[0];
      }else if(p>b.p&&j===uniq.length-2){
        a=uniq[uniq.length-1];
        b={p:uniq[0].p+1,yaw:uniq[0].yaw};
      }
      const span=Math.max(1e-6,b.p-a.p);
      const t=clamp((p-a.p)/span);
      const d=wrap(b.yaw-a.yaw);
      out.push(wrap(a.yaw+d*t));
    }
    return smoothAngles(out,2);
  }

  function telemetryFingerprint(telemetry){
    const samples=Array.isArray(telemetry)?telemetry:[];
    if(samples.length<20)return null;

    const gps=[];
    for(let i=0;i<samples.length;i++){
      const ll=latLon(samples[i]);
      if(!ll)continue;
      gps.push({...ll,p:progressOf(samples[i],i,samples.length)});
    }
    if(gps.length>=24){
      const pts=projectGps(gps);
      const sig=signatureFromPoints(pts);
      if(sig){
        return {
          source:"GPS",
          points:sig.points,
          headings:sig.headings,
          sampleCount:gps.length,
          cacheKey:hashSignature(sig.headings,"gps")
        };
      }
    }

    const headingRows=[];
    for(let i=0;i<samples.length;i++){
      const yaw=Number(samples[i]?.yawNorth);
      if(!Number.isFinite(yaw))continue;
      headingRows.push({p:progressOf(samples[i],i,samples.length),yaw:wrap(yaw)});
    }
    const hs=circularInterpolate(headingRows,192);
    if(hs.length>=32){
      return {
        source:"HEADING",
        points:null,
        headings:hs,
        sampleCount:headingRows.length,
        cacheKey:hashSignature(hs,"heading")
      };
    }
    return null;
  }

  function hashSignature(values,prefix="fp"){
    let h=2166136261>>>0;
    const step=Math.max(1,Math.floor((values?.length||0)/48));
    for(let i=0;i<(values?.length||0);i+=step){
      const q=Math.round(wrap(values[i])*1000);
      h^=(q&255); h=Math.imul(h,16777619)>>>0;
      h^=((q>>8)&255); h=Math.imul(h,16777619)>>>0;
    }
    return prefix+"-"+h.toString(16);
  }

  function headingFit(a,b,shift){
    const n=Math.min(a.length,b.length);
    let sx=0,sy=0;
    for(let i=0;i<n;i++){
      const d=wrap(a[i]-b[(i+shift)%n]);
      sx+=Math.cos(d); sy+=Math.sin(d);
    }
    const offset=Math.atan2(sy,sx);
    let err=0;
    for(let i=0;i<n;i++)err+=Math.abs(wrap(a[i]-b[(i+shift)%n]-offset));
    err/=Math.max(1,n);
    return {error:err,offset,score:Math.exp(-4.2*err)};
  }

  function procrustesFit(a,b,shift){
    const n=Math.min(a.length,b.length);
    let dot=0,cross=0;
    for(let i=0;i<n;i++){
      const p=a[i],q=b[(i+shift)%n];
      dot+=p.x*q.x+p.y*q.y;
      cross+=p.y*q.x-p.x*q.y;
    }
    const angle=Math.atan2(cross,dot);
    const c=Math.cos(angle),s=Math.sin(angle);
    let e=0;
    for(let i=0;i<n;i++){
      const p=a[i],q=b[(i+shift)%n];
      const x=q.x*c-q.y*s,y=q.x*s+q.y*c;
      const dx=p.x-x,dy=p.y-y;
      e+=dx*dx+dy*dy;
    }
    const rms=Math.sqrt(e/Math.max(1,n));
    return {rms,angle,score:Math.exp(-2.6*rms)};
  }

  function reverseSignature(sig){
    const points=sig.points?[...sig.points].reverse():null;
    return {
      points,
      headings:points?smoothAngles(headings(points),2):[...sig.headings].reverse().map(a=>wrap(a+Math.PI))
    };
  }

  function compareOne(fingerprint,candidate){
    const n=Math.min(fingerprint.headings.length,candidate.headings.length);
    if(n<32)return null;
    let best=null;
    for(let shift=0;shift<n;shift++){
      const hf=headingFit(fingerprint.headings,candidate.headings,shift);
      if(best&&hf.score<best.headingScore-.03)continue;
      let shapeScore=null,rms=null;
      if(fingerprint.points&&candidate.points){
        const pf=procrustesFit(fingerprint.points,candidate.points,shift);
        shapeScore=pf.score; rms=pf.rms;
      }
      const score=shapeScore===null?hf.score:(shapeScore*.72+hf.score*.28);
      if(!best||score>best.score){
        best={score,headingScore:hf.score,shapeScore,rms,shift};
      }
    }
    return best;
  }

  function compare(fingerprint,candidatePoints){
    if(!fingerprint)return null;
    const sig=signatureFromPoints(candidatePoints);
    if(!sig)return null;

    const forward=compareOne(fingerprint,sig);
    const reverse=compareOne(fingerprint,reverseSignature(sig));
    const best=!reverse||((forward?.score??-1)>=reverse.score)?forward:{...reverse,reversed:true};
    if(!best)return null;
    return {
      ...best,
      reversed:Boolean(best.reversed),
      source:fingerprint.source,
      score:clamp(best.score),
      confidence:Math.round(clamp(best.score)*100)
    };
  }

  window.AMSTrackFingerprint={
    telemetryFingerprint,
    signatureFromPoints,
    compare,
    normalizePoints,
    resampleClosed,
    hashSignature
  };
})();