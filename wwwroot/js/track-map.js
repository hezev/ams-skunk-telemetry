window.AMSTrack = {
  phase:0,
  progress:0,
  index:null,
  raceStudioManifest:null,
  activeEntry:null,
  activePath:null,
  centerline:[],
  reference:null,
  trajectoryCompare:null,

  normalize(value){
    return String(value||"")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g,"")
      .toLowerCase()
      .replace(/&/g," and ")
      .replace(/[^a-z0-9]+/g," ")
      .trim();
  },

  encodePath(path){
    return String(path).split("/").map(encodeURIComponent).join("/");
  },

  collectStrings(obj){
    return Object.values(obj||{})
      .filter(v=>typeof v==="string"&&v.length<500)
      .map(v=>v.trim()).filter(Boolean);
  },

  buildIndex(data){
    const found=[],seen=new Set(),categories=["Road","Oval","Dirt Road","Dirt Oval"];
    const walk=(node,parents=[])=>{
      if(Array.isArray(node)){node.forEach(v=>walk(v,parents));return;}
      if(!node||typeof node!=="object")return;

      const direct=this.collectStrings(node);
      const context=[...parents,...direct].slice(-24);
      let localPath=null,cdnBase=null;

      for(const s of direct){
        const clean=s.replace(/\\/g,"/");
        const category=categories.find(c=>clean.startsWith(c+"/"));
        if(category&&clean.split("/").length>=3){
          localPath=clean.split("/").slice(0,3).join("/");
        }
        if(clean.includes("members-assets.iracing.com/public/track-maps/")){
          const ix=clean.indexOf("https://");
          if(ix>=0){
            cdnBase=clean.slice(ix).split(/[?#]/)[0]
              .replace(/\/(active|background|inactive|pitroad|start-finish|turns)\.svg$/i,"")
              .replace(/\/$/,"");
          }
        }
      }

      if(localPath||cdnBase){
        const key=localPath||cdnBase;
        if(!seen.has(key)){
          seen.add(key);
          const parts=localPath?localPath.split("/"):[];
          found.push({
            localPath,cdnBase,
            category:parts[0]||"",
            family:parts[1]||"",
            config:parts[2]||"",
            search:this.normalize(context.join(" "))
          });
        }
      }

      const parentContext=context.filter(s=>s.length<120);
      Object.values(node).forEach(v=>{if(v&&typeof v==="object")walk(v,parentContext);});
    };
    walk(data);
    return found;
  },

  aliases(target){
    const n=this.normalize(target),extra=[];
    if(n.includes("algarve")||n.includes("portimao"))extra.push("portimao","algarve");
    if(n.includes("spa"))extra.push("spa francorchamps","spa");
    if(n.includes("nurburgring")||n.includes("nuerburgring"))extra.push("nurburgring","nuerburgring");
    if(n.includes("le mans"))extra.push("lemans");
    return [n,...extra];
  },

  significantWords(value){
    const stop=new Set(["circuit","racing","raceway","track","international","autodromo","autodrome","motor","motorsport","speedway"]);
    return this.normalize(value).split(" ").filter(w=>w.length>2&&!stop.has(w));
  },

  async getIndex(){
    if(this.index)return this.index;
    const cached=sessionStorage.getItem("ams_track_index_v1");
    if(cached){
      try{this.index=JSON.parse(cached);return this.index;}catch{}
    }
    const res=await fetch(AMS_CONFIG.trackMetadataUrl,{cache:"force-cache"});
    if(!res.ok)throw new Error("Não foi possível carregar o catálogo iRacing.");
    this.index=this.buildIndex(await res.json());
    try{sessionStorage.setItem("ams_track_index_v1",JSON.stringify(this.index));}catch{}
    return this.index;
  },

  async getRaceStudioManifest(){
    if(this.raceStudioManifest)return this.raceStudioManifest;
    const cached=sessionStorage.getItem("ams_racestudio_manifest_v1");
    if(cached){
      try{this.raceStudioManifest=JSON.parse(cached);return this.raceStudioManifest;}catch{}
    }
    const res=await fetch(AMS_CONFIG.raceStudioManifestUrl,{cache:"force-cache"});
    if(!res.ok)throw new Error("Não foi possível carregar as referências GPS.");
    this.raceStudioManifest=await res.json();
    try{sessionStorage.setItem("ams_racestudio_manifest_v1",JSON.stringify(this.raceStudioManifest));}catch{}
    return this.raceStudioManifest;
  },

  score(entry,trackName,configHint=""){
    const targets=this.aliases(trackName),hint=this.normalize(configHint);let score=0;
    for(const target of targets){
      if(!target)continue;
      if(entry.search.includes(target))score=Math.max(score,120);
      const words=target.split(" ").filter(x=>x.length>2);
      if(words.length&&words.every(w=>entry.search.includes(w)))score=Math.max(score,90);
      score+=words.filter(w=>entry.search.includes(w)).length*6;
    }
    if(hint){
      if(entry.search.includes(hint))score+=80;
      const words=hint.split(" ").filter(x=>x.length>2);
      score+=words.filter(w=>entry.search.includes(w)).length*8;
    }
    if(/grand.?prix|gp\b/i.test(entry.config))score+=2;
    return score;
  },

  async resolve(trackName,configHint=""){
    const index=await this.getIndex();
    if(!index.length)return null;
    return index
      .map(entry=>({entry,score:this.score(entry,trackName,configHint)}))
      .sort((a,b)=>b.score-a.score)[0]?.entry||null;
  },

  baseUrl(entry){
    if(entry?.cdnBase)return entry.cdnBase;
    if(entry?.localPath)return AMS_CONFIG.trackRawBase+"/"+this.encodePath(entry.localPath);
    return "";
  },

  configHint(entry){
    if(!entry)return "";
    const raw=this.normalize(entry.config||"");
    const parts=raw.split(" ").filter(Boolean);
    if(parts.length&&/^\d+$/.test(parts[0]))parts.shift();
    return parts.join(" ");
  },

  raceStudioCandidateScore(name,trackName){
    const n=this.normalize(name),words=this.significantWords(trackName);
    if(!words.length)return 0;
    let score=0;
    for(const w of words)if(n.includes(w))score+=25;
    if(words.every(w=>n.includes(w)))score+=100;
    return score;
  },

  async fetchRaceStudioJson(fullName){
    const url=AMS_CONFIG.raceStudioRawBase+"/"+encodeURIComponent(fullName)+".json";
    const res=await fetch(url,{cache:"force-cache"});
    if(!res.ok)return null;
    try{return await res.json();}catch{return null;}
  },

  referenceScore(data,trackName,entry){
    const hay=this.normalize([
      data?.full_name,data?.name,data?.short_name,
      data?.contact?.Nmg,data?.contact?.city
    ].filter(Boolean).join(" "));
    const words=this.significantWords(trackName);
    let score=words.filter(w=>hay.includes(w)).length*35;
    if(words.length&&words.every(w=>hay.includes(w)))score+=100;

    const hint=this.configHint(entry);
    const hintParts=hint.split(" ").filter(Boolean);
    for(const p of hintParts){
      if(hay.includes(p))score+=/^\d+$/.test(p)?130:20;
    }

    // Prefer a proper closed driving reference with known start/finish.
    if(Array.isArray(data?.gps_points)&&data.gps_points.length>20)score+=80;
    if(data?.start_finish)score+=20;
    if(Number(data?.track_length_m)>0)score+=10;
    return score;
  },

  async resolveRaceStudio(trackName,entry){
    try{
      const manifest=await this.getRaceStudioManifest();
      const ranked=(manifest||[])
        .map(row=>({name:row?.[0]||"",score:this.raceStudioCandidateScore(row?.[0]||"",trackName)}))
        .filter(x=>x.score>0)
        .sort((a,b)=>b.score-a.score)
        .slice(0,10);

      if(!ranked.length)return null;

      const loaded=await Promise.all(ranked.map(async r=>({
        data:await this.fetchRaceStudioJson(r.name),
        baseScore:r.score
      })));

      const winner=loaded
        .filter(x=>x.data)
        .map(x=>({data:x.data,score:x.baseScore+this.referenceScore(x.data,trackName,entry)}))
        .sort((a,b)=>b.score-a.score)[0];

      return winner?.score>=160?winner.data:null;
    }catch(err){
      console.warn("AMS RaceStudio reference:",err);
      return null;
    }
  },

  distance(a,b){
    return Math.hypot(a.x-b.x,a.y-b.y);
  },

  resampleClosed(points,count=2400){
    if(points.length<2)return points;
    const cleaned=[...points];
    if(cleaned.length>2&&this.distance(cleaned[0],cleaned[cleaned.length-1])<.000001)cleaned.pop();

    const seg=[],cum=[0];let total=0;
    for(let i=0;i<cleaned.length;i++){
      const d=this.distance(cleaned[i],cleaned[(i+1)%cleaned.length]);
      seg.push(d);total+=d;cum.push(total);
    }
    if(total<=0)return cleaned;

    const out=[];let segment=0;
    for(let k=0;k<count;k++){
      const target=total*k/count;
      while(segment<seg.length-1&&cum[segment+1]<target)segment++;
      const a=cleaned[segment],b=cleaned[(segment+1)%cleaned.length],len=seg[segment]||1;
      const t=Math.max(0,Math.min(1,(target-cum[segment])/len));
      out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
    }
    return out;
  },

  projectGps(gps){
    const valid=(gps||[])
      .map(p=>({lat:Number(p?.lat),lon:Number(p?.lon)}))
      .filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));
    if(valid.length<3)return [];

    const lat0=valid.reduce((a,p)=>a+p.lat,0)/valid.length;
    const lon0=valid.reduce((a,p)=>a+p.lon,0)/valid.length;
    const cos=Math.cos(lat0*Math.PI/180);

    const raw=valid.map(p=>({
      x:(p.lon-lon0)*cos,
      y:-(p.lat-lat0)
    }));

    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    raw.forEach(p=>{minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);});
    const width=Math.max(1e-9,maxX-minX),height=Math.max(1e-9,maxY-minY);
    const viewW=1000,viewH=600,pad=55;
    const scale=Math.min((viewW-pad*2)/width,(viewH-pad*2)/height);
    const usedW=width*scale,usedH=height*scale;
    const ox=(viewW-usedW)/2,oy=(viewH-usedH)/2;

    return raw.map(p=>({
      x:ox+(p.x-minX)*scale,
      y:oy+(p.y-minY)*scale
    }));
  },

  drawGpsReference(data){
    const host=document.getElementById("trackMotionSvg");
    const stack=document.getElementById("trackVectorStack");
    if(!host||!stack)return false;

    const projected=this.projectGps(data?.gps_points);
    if(projected.length<3)return false;

    this.centerline=this.resampleClosed(projected,2400);
    this.activePath=null;
    this.reference={
      source:"RaceStudio 3 GPS",
      name:data?.full_name||data?.name||"",
      lengthM:Number(data?.track_length_m)||null
    };

    stack.querySelectorAll("img.track-layer").forEach(img=>img.remove());
    host.classList.add("gps-reference");
    host.setAttribute("viewBox","0 0 1000 600");
    host.setAttribute("preserveAspectRatio","xMidYMid meet");

    const display=this.centerline.filter((_,i)=>i%3===0);
    const points=display.map(p=>p.x.toFixed(2)+","+p.y.toFixed(2)).join(" ");
    const p0=this.centerline[0],p1=this.centerline[8]||this.centerline[1];
    const dx=p1.x-p0.x,dy=p1.y-p0.y,len=Math.hypot(dx,dy)||1;
    const nx=-dy/len,ny=dx/len,half=13;
    const x1=p0.x+nx*half,y1=p0.y+ny*half,x2=p0.x-nx*half,y2=p0.y-ny*half;

    host.innerHTML=
      '<polyline class="gps-track-shadow" points="'+points+'"></polyline>'+
      '<polyline class="gps-track-line" points="'+points+'"></polyline>'+
      '<line class="gps-start-line" x1="'+x1+'" y1="'+y1+'" x2="'+x2+'" y2="'+y2+'"></line>';

    requestAnimationFrame(()=>this.setPosition(this.progress));
    return true;
  },

  async load(trackName,configHint=""){
    const status=document.getElementById("trackSource");
    try{
      if(status)status.textContent="A localizar referência…";
      const entry=await this.resolve(trackName,configHint);
      this.activeEntry=entry;

      // Prefer a GPS reference made for telemetry analysis. Its first GPS
      // point is the start/finish reference and its ordered points form the
      // driving centreline, so LapDistPct maps directly by arc length.
      const reference=await this.resolveRaceStudio(trackName,entry);
      if(reference&&this.drawGpsReference(reference)){
        const label=reference?.contact?.Nmg||reference?.short_name||reference?.full_name||trackName;
        if(status)status.textContent="GPS REFERENCE · "+label;
        return {entry,reference};
      }

      // Fallback: use the iRacing artwork when a GPS reference is unavailable.
      const base=this.baseUrl(entry);
      if(!base)throw new Error("Traçado não encontrado.");
      const stack=document.getElementById("trackVectorStack");
      const host=document.getElementById("trackMotionSvg");
      if(!stack||!host)return null;

      host.classList.remove("gps-reference");
      stack.querySelectorAll("img.track-layer").forEach(img=>img.remove());
      const layers=[
        ["background","background.svg"],
        ["inactive","inactive.svg"],
        ["active","active.svg"],
        ["pitroad","pitroad.svg"],
        ["startfinish","start-finish.svg"],
        ["turns","turns.svg"]
      ];
      for(const [cls,file] of layers){
        const img=document.createElement("img");
        img.className="track-layer track-"+cls;
        img.alt="";
        img.src=base+"/"+file;
        img.onerror=()=>img.remove();
        stack.appendChild(img);
      }
      await this.prepareArtworkFallback(base+"/active.svg");
      this.reference={source:"iRacing artwork",name:[entry?.family,entry?.config].filter(Boolean).join(" · ")};
      if(status)status.textContent=this.reference.name||trackName;
      return {entry,reference:null};
    }catch(err){
      this.centerline=[];
      if(status)status.textContent="Mapa indisponível";
      console.warn("AMS track map:",err);
      return null;
    }
  },

  sampleCompoundPath(path,count=5000){
    const total=path.getTotalLength(),points=[];
    for(let i=0;i<count;i++){
      const p=path.getPointAtLength(total*i/(count-1));
      points.push({x:p.x,y:p.y});
    }
    return points;
  },

  splitContours(points){
    if(points.length<20)return [];
    let jumpIndex=-1,jumpDistance=-1;
    const distances=[];
    for(let i=1;i<points.length;i++){
      const d=this.distance(points[i-1],points[i]);
      distances.push(d);
      if(d>jumpDistance){jumpDistance=d;jumpIndex=i;}
    }
    const sorted=[...distances].sort((a,b)=>a-b);
    const typical=sorted[Math.floor(sorted.length*.75)]||1;
    if(jumpDistance<typical*8)return [points];
    return [points.slice(0,jumpIndex),points.slice(jumpIndex)];
  },

  pointAtSequence(seq,fraction){
    if(!seq.length)return {x:0,y:0};
    const n=seq.length;
    const x=((fraction%1)+1)%1*(n-1);
    const i=Math.floor(x),j=(i+1)%n,t=x-i;
    return {x:seq[i].x+(seq[j].x-seq[i].x)*t,y:seq[i].y+(seq[j].y-seq[i].y)*t};
  },

  nearestIndex(seq,target,expected,windowSize){
    const n=seq.length;
    let bestIndex=((expected%n)+n)%n,best=Infinity;
    for(let d=-windowSize;d<=windowSize;d++){
      const i=((expected+d)%n+n)%n;
      const dist=this.distance(seq[i],target);
      if(dist<best){best=dist;bestIndex=i;}
    }
    return bestIndex;
  },

  smoothClosed(points,radius=4){
    if(points.length<radius*2+1)return points;
    return points.map((_,i)=>{
      let x=0,y=0,w=0;
      for(let d=-radius;d<=radius;d++){
        const p=points[(i+d+points.length)%points.length];
        const weight=radius+1-Math.abs(d);
        x+=p.x*weight;y+=p.y*weight;w+=weight;
      }
      return {x:x/w,y:y/w};
    });
  },

  buildArtworkCenterline(a,b,count=2000){
    if(!a.length)return [];
    if(!b.length)return this.resampleClosed(a,count);

    let start=0,best=Infinity;
    for(let i=0;i<b.length;i++){
      const d=this.distance(a[0],b[i]);
      if(d<best){best=d;start=i;}
    }

    const aForward=a[Math.min(8,a.length-1)];
    const bPlus=b[(start+8)%b.length],bMinus=b[(start-8+b.length)%b.length];
    const dir=this.distance(aForward,bPlus)<=this.distance(aForward,bMinus)?1:-1;
    const raw=[],localWindow=Math.max(18,Math.floor(b.length*.018));

    for(let k=0;k<count;k++){
      const ai=Math.min(a.length-1,Math.floor(k*a.length/count));
      const p1=a[ai];
      const predicted=((start+dir*Math.floor(k*b.length/count))%b.length+b.length)%b.length;
      const bi=this.nearestIndex(b,p1,predicted,localWindow);
      const p2=b[bi];
      raw.push({x:(p1.x+p2.x)/2,y:(p1.y+p2.y)/2});
    }

    return this.resampleClosed(this.smoothClosed(raw,5),2400);
  },

  async prepareArtworkFallback(activeUrl){
    this.activePath=null;
    this.centerline=[];
    const host=document.getElementById("trackMotionSvg");
    if(!host)return;

    const res=await fetch(activeUrl,{cache:"force-cache"});
    if(!res.ok)return;
    const doc=new DOMParser().parseFromString(await res.text(),"image/svg+xml");
    const src=doc.documentElement;
    const viewBox=src.getAttribute("viewBox");
    if(viewBox)host.setAttribute("viewBox",viewBox);
    const par=src.getAttribute("preserveAspectRatio");
    if(par)host.setAttribute("preserveAspectRatio",par);
    host.innerHTML=src.innerHTML;

    const paths=[...host.querySelectorAll("path")];
    let best=null,bestLen=0;
    for(const p of paths){
      try{
        const len=p.getTotalLength();
        if(len>bestLen){best=p;bestLen=len;}
      }catch{}
    }
    if(!best)return;
    this.activePath=best;
    const contours=this.splitContours(this.sampleCompoundPath(best,5000)).sort((x,y)=>y.length-x.length);
    this.centerline=this.buildArtworkCenterline(contours[0]||[],contours[1]||[]);
    requestAnimationFrame(()=>this.setPosition(this.progress));
  },

  localPoint(progress){
    const pts=this.centerline;
    if(!pts.length)return null;
    const p=((Number(progress)%1)+1)%1;
    const x=p*pts.length,i=Math.floor(x)%pts.length,j=(i+1)%pts.length,t=x-Math.floor(x);
    return {x:pts[i].x+(pts[j].x-pts[i].x)*t,y:pts[i].y+(pts[j].y-pts[i].y)*t};
  },

  analysisViewBox(){
    const host=document.getElementById("trackMotionSvg");
    return host?.getAttribute("viewBox")||"0 0 1000 600";
  },

  slicePoints(start,end,steps=80){
    const out=[];
    for(let i=0;i<=steps;i++){
      const p=start+(end-start)*i/steps;
      const pt=this.localPoint(p);
      if(pt)out.push(pt);
    }
    return out;
  },

  renderAnalysisMap(segments=[],events=[]){
    const svg=document.getElementById("analysisTrackSvg");
    if(!svg||!this.centerline.length)return;
    svg.setAttribute("viewBox",this.analysisViewBox());
    svg.setAttribute("preserveAspectRatio","xMidYMid meet");

    const full=this.centerline.filter((_,i)=>i%3===0).map(p=>p.x.toFixed(2)+","+p.y.toFixed(2)).join(" ");
    let html='<polyline class="analysis-track-base" points="'+full+'"></polyline>';

    for(const s of segments||[]){
      const pts=this.slicePoints(Number(s.start)||0,Number(s.end)||0,50);
      if(pts.length<2)continue;
      const cls=!Number.isFinite(Number(s.delta))?"neutral":Number(s.delta)>0.003?"loss":Number(s.delta)<-0.003?"gain":"neutral";
      const pp=pts.map(p=>p.x.toFixed(2)+","+p.y.toFixed(2)).join(" ");
      html+='<polyline class="analysis-track-segment '+cls+'" points="'+pp+'"><title>MS'+(s.index||"")+' · '+(Number.isFinite(Number(s.delta))?((s.delta>=0?"+":"")+Number(s.delta).toFixed(3)+"s"):"—")+'</title></polyline>';
    }

    for(const e of events||[]){
      const pt=this.localPoint(Number(e.position)||0);if(!pt)continue;
      const cls=e.type==="brake"?"brake-event":"throttle-event";
      html+='<circle class="analysis-event '+cls+'" cx="'+pt.x.toFixed(2)+'" cy="'+pt.y.toFixed(2)+'" r="7"><title>'+(e.type==="brake"?"Brake":"Throttle")+' · '+((Number(e.position)||0)*100).toFixed(1)+'%</title></circle>';
    }

    const cursor=this.localPoint(this.progress)||this.centerline[0];
    html+='<circle id="analysisTrackCursor" class="analysis-track-cursor" cx="'+cursor.x.toFixed(2)+'" cy="'+cursor.y.toFixed(2)+'" r="10"></circle>';
    svg.innerHTML=html;
  },

  setAnalysisPosition(progress){
    const p=Number(progress);
    if(!Number.isFinite(p))return;
    const cursor=document.getElementById("analysisTrackCursor"),pt=this.localPoint(p);
    if(!cursor||!pt)return;
    cursor.setAttribute("cx",pt.x.toFixed(2));
    cursor.setAttribute("cy",pt.y.toFixed(2));
  },

  integrateTrajectory(lap){
    const samples=(lap?.samples||[]).filter(s=>
      Number.isFinite(Number(s?._p)) &&
      Number.isFinite(Number(s?.speed)) &&
      Number.isFinite(Number(s?.yawNorth))
    );
    if(samples.length<20)return [];

    const out=[{p:samples[0]._p,x:0,y:0}];
    let x=0,y=0;

    for(let i=1;i<samples.length;i++){
      const a=samples[i-1],b=samples[i];
      const ta=Number.isFinite(Number(a._rawTime))?Number(a._rawTime):Number(a._time);
      const tb=Number.isFinite(Number(b._rawTime))?Number(b._rawTime):Number(b._time);
      let dt=tb-ta;
      if(!Number.isFinite(dt)||dt<=0||dt>.25)dt=1/60;

      const speed=((Number(a.speed)+Number(b.speed))/2)/3.6;
      const ya=Number(a.yawNorth),yb=Number(b.yawNorth);
      let vx=Math.sin(ya)+Math.sin(yb);
      let vy=-Math.cos(ya)-Math.cos(yb);
      const n=Math.hypot(vx,vy)||1;
      vx/=n;vy/=n;

      const ds=Math.max(0,speed*dt);
      x+=vx*ds;y+=vy*ds;
      out.push({p:b._p,x,y});
    }

    // Remove accumulated inertial integration drift so the lap closes at S/F.
    const end=out[out.length-1];
    return out.map(pt=>({
      p:pt.p,
      x:pt.x-end.x*pt.p,
      y:pt.y-end.y*pt.p
    }));
  },

  fitTrajectory(points,reflectY=false){
    if(!points.length||!this.centerline.length)return null;
    const src=[],dst=[];
    const stride=Math.max(1,Math.floor(points.length/700));

    for(let i=0;i<points.length;i+=stride){
      const p=points[i],r=this.localPoint(p.p);
      if(!r)continue;
      src.push({x:p.x,y:reflectY?-p.y:p.y});
      dst.push(r);
    }
    if(src.length<10)return null;

    const cs=src.reduce((a,p)=>({x:a.x+p.x,y:a.y+p.y}),{x:0,y:0});
    const cd=dst.reduce((a,p)=>({x:a.x+p.x,y:a.y+p.y}),{x:0,y:0});
    cs.x/=src.length;cs.y/=src.length;cd.x/=dst.length;cd.y/=dst.length;

    let denom=0,sumA=0,sumB=0;
    for(let i=0;i<src.length;i++){
      const x=src[i].x-cs.x,y=src[i].y-cs.y;
      const X=dst[i].x-cd.x,Y=dst[i].y-cd.y;
      denom+=x*x+y*y;
      sumA+=x*X+y*Y;
      sumB+=x*Y-y*X;
    }
    if(denom<=0)return null;

    const a=sumA/denom,b=sumB/denom;
    const tx=cd.x-a*cs.x+b*cs.y;
    const ty=cd.y-b*cs.x-a*cs.y;
    const transform=p=>{
      const yy=reflectY?-p.y:p.y;
      return {p:p.p,x:a*p.x-b*yy+tx,y:b*p.x+a*yy+ty};
    };

    let err=0;
    for(let i=0;i<src.length;i++){
      const raw=points[Math.min(points.length-1,i*stride)];
      const q=transform(raw),r=this.localPoint(raw.p);
      err+=r?(q.x-r.x)**2+(q.y-r.y)**2:0;
    }
    return {
      points:points.map(transform),
      rmse:Math.sqrt(err/src.length),
      scale:Math.hypot(a,b),
      reflected:reflectY,
      a,b,tx,ty
    };
  },

  applyTrajectoryFit(raw,fit){
    if(!raw?.length||!fit)return null;
    const transformed=raw.map(p=>{
      const yy=fit.reflected?-p.y:p.y;
      return {p:p.p,x:fit.a*p.x-fit.b*yy+fit.tx,y:fit.b*p.x+fit.a*yy+fit.ty};
    });
    let err=0,count=0;
    for(let i=0;i<transformed.length;i+=Math.max(1,Math.floor(transformed.length/700))){
      const q=transformed[i],r=this.localPoint(q.p);
      if(!r)continue;
      err+=(q.x-r.x)**2+(q.y-r.y)**2;count++;
    }
    return {...fit,points:transformed,rmse:count?Math.sqrt(err/count):fit.rmse};
  },

  reconstructTrajectory(lap,sharedFit=null){
    const raw=this.integrateTrajectory(lap);
    if(raw.length<20)return null;
    let fit;
    if(sharedFit){
      fit=this.applyTrajectoryFit(raw,sharedFit);
    }else{
      const normal=this.fitTrajectory(raw,false);
      const reflected=this.fitTrajectory(raw,true);
      fit=!normal?reflected:!reflected?normal:(normal.rmse<=reflected.rmse?normal:reflected);
    }
    if(!fit)return null;

    const maxPoints=950;
    const step=Math.max(1,Math.floor(fit.points.length/maxPoints));
    const points=fit.points.filter((_,i)=>i%step===0);
    const last=fit.points[fit.points.length-1];
    if(points[points.length-1]!==last)points.push(last);
    return {...fit,points};
  },

  trajectoryPoint(points,progress){
    if(!points?.length)return null;
    const p=Math.max(0,Math.min(1,Number(progress)||0));
    if(p<=points[0].p)return points[0];
    if(p>=points[points.length-1].p)return points[points.length-1];

    let lo=0,hi=points.length-1;
    while(hi-lo>1){
      const m=(lo+hi)>>1;
      if(points[m].p<=p)lo=m;else hi=m;
    }
    const a=points[lo],b=points[hi],span=b.p-a.p||1,t=(p-a.p)/span;
    return {p,x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};
  },

  svgPath(points){
    if(!points?.length)return "";
    return points.map((p,i)=>(i?"L":"M")+p.x.toFixed(2)+" "+p.y.toFixed(2)).join(" ");
  },

  viewUnitsToMeters(){
    if(!this.centerline.length||!Number.isFinite(Number(this.reference?.lengthM)))return null;
    let len=0;
    for(let i=1;i<this.centerline.length;i++)len+=this.distance(this.centerline[i-1],this.centerline[i]);
    len+=this.distance(this.centerline[this.centerline.length-1],this.centerline[0]);
    return len>0?Number(this.reference.lengthM)/len:null;
  },

  renderTrajectoryCompare(lapA,lapRef=null){
    const svg=document.getElementById("trajectoryCompareSvg");
    const status=document.getElementById("trajectoryCompareStatus");
    if(!svg||!this.centerline.length||!lapA){
      this.trajectoryCompare=null;
      if(status)status.textContent="SEM TRAJECTÓRIA";
      return;
    }

    // Fit the reference once and apply exactly the same transform to Lap A.
    // This preserves genuine lateral trajectory differences between laps.
    const ref=lapRef?this.reconstructTrajectory(lapRef):null;
    const a=this.reconstructTrajectory(lapA,ref||null);
    if(!a){
      this.trajectoryCompare=null;
      if(status)status.textContent="DADOS INSUFICIENTES";
      return;
    }

    this.trajectoryCompare={a,ref};
    svg.setAttribute("viewBox",this.analysisViewBox());
    svg.setAttribute("preserveAspectRatio","xMidYMid meet");

    const base=this.centerline.filter((_,i)=>i%3===0).map(p=>p.x.toFixed(2)+","+p.y.toFixed(2)).join(" ");
    const pathA=this.svgPath(a.points);
    const pathR=ref?this.svgPath(ref.points):"";
    const start=this.localPoint(0)||this.centerline[0];

    let html='<polyline class="trajectory-track-base" points="'+base+'"></polyline>';
    html+='<path class="trajectory-line trajectory-a ghost" d="'+pathA+'"></path>';
    html+='<path id="trajectoryProgressA" class="trajectory-line trajectory-a progress" d="'+pathA+'"></path>';
    if(ref){
      html+='<path class="trajectory-line trajectory-ref ghost" d="'+pathR+'"></path>';
      html+='<path id="trajectoryProgressRef" class="trajectory-line trajectory-ref progress" d="'+pathR+'"></path>';
    }
    html+='<circle id="trajectoryMarkerA" class="trajectory-marker marker-a" cx="'+start.x+'" cy="'+start.y+'" r="9"></circle>';
    if(ref)html+='<circle id="trajectoryMarkerRef" class="trajectory-marker marker-ref" cx="'+start.x+'" cy="'+start.y+'" r="9"></circle>';
    svg.innerHTML=html;

    requestAnimationFrame(()=>{
      for(const id of ["trajectoryProgressA","trajectoryProgressRef"]){
        const p=document.getElementById(id);if(!p)continue;
        const len=p.getTotalLength?.()||0;
        p.dataset.pathLength=String(len);
        p.style.strokeDasharray=len+" "+len;
        p.style.strokeDashoffset=String(len);
      }
      this.setTrajectoryPosition(this.progress);
    });

    if(status){
      const quality=Math.max(a.rmse,ref?.rmse||0);
      status.textContent=(ref?"A + REF":"A")+" · RECONSTRUÍDA YAW/SPEED · FIT "+quality.toFixed(1);
    }
  },

  setTrajectoryPosition(progress){
    const data=this.trajectoryCompare;
    if(!data)return;
    const p=Math.max(0,Math.min(1,Number(progress)||0));

    const update=(name,fit)=>{
      if(!fit)return;
      const marker=document.getElementById("trajectoryMarker"+name);
      const path=document.getElementById("trajectoryProgress"+(name==="Ref"?"Ref":"A"));
      const pt=this.trajectoryPoint(fit.points,p);
      if(marker&&pt){marker.setAttribute("cx",pt.x.toFixed(2));marker.setAttribute("cy",pt.y.toFixed(2));}
      if(path){
        const len=Number(path.dataset.pathLength)||path.getTotalLength?.()||0;
        path.style.strokeDasharray=len+" "+len;
        path.style.strokeDashoffset=String(len*(1-p));
      }
      return pt;
    };

    const pa=update("A",data.a),pr=update("Ref",data.ref);
    const progressText=document.getElementById("trajectoryProgressText");
    if(progressText)progressText.textContent=(p*100).toFixed(1)+"%";

    const sep=document.getElementById("trajectorySeparation");
    if(sep){
      const metersPerUnit=this.viewUnitsToMeters();
      const d=pa&&pr?this.distance(pa,pr):null;
      sep.textContent=Number.isFinite(d)&&Number.isFinite(metersPerUnit)?(d*metersPerUnit).toFixed(2)+" m":"—";
    }
  },

  positionElement(el,progress){
    const svg=document.getElementById("trackMotionSvg"),point=this.localPoint(progress);
    if(!el||!svg||!point)return;
    const matrix=svg.getScreenCTM();
    if(!matrix)return;
    const screen=new DOMPoint(point.x,point.y).matrixTransform(matrix);
    const stage=document.querySelector(".track-stage")?.getBoundingClientRect();
    if(!stage)return;
    el.style.left=(screen.x-stage.left)+"px";
    el.style.top=(screen.y-stage.top)+"px";
  },

  setPosition(progress){
    this.progress=((Number(progress)%1)+1)%1;
    this.positionElement(document.getElementById("carDot"),this.progress);
  },

  renderCars(rows=[],ownPilotId=null){
    const stage=document.querySelector(".track-stage");
    if(!stage||!this.centerline.length)return;
    stage.querySelectorAll(".map-car-dot").forEach(el=>el.remove());

    for(const row of rows){
      const pos=AMSSupabase.samplePosition(row?.sample);
      if(pos===null)continue;
      const isOwn=ownPilotId&&row.pilot_id===ownPilotId;
      if(isOwn){this.setPosition(pos);continue;}

      const el=document.createElement("div");
      el.className="map-car-dot";
      const number=row?.sample?.carNumber??row?.sample?.car_number??row?.sample?.number??"";
      const driver=row?.sample?.driverName??row?.sample?.driver_name??row?.sample?.name??"";
      el.title=[number?("#"+String(number).replace("#","")):"",driver].filter(Boolean).join(" ");
      if(number)el.dataset.label=String(number).replace("#","");
      stage.appendChild(el);
      this.positionElement(el,pos);
    }
  },

  tick(trackPosition=null){
    this.phase+=.04;
    const next=Number.isFinite(Number(trackPosition))?Number(trackPosition):(this.progress+.0018)%1;
    this.setPosition(next);
  }
};