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
  focusedCompare:null,
  focusedCompareZoom:4,
  gpsProjection:null,

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

  estimateLapLength(telemetry){
    const samples=Array.isArray(telemetry)?telemetry:[];
    if(samples.length<2)return null;
    let total=0,valid=0;
    for(let i=1;i<samples.length;i++){
      const a=samples[i-1],b=samples[i];
      const ta=Number(a?.t),tb=Number(b?.t);
      const sa=Number(a?.speed),sb=Number(b?.speed);
      if(![ta,tb,sa,sb].every(Number.isFinite))continue;
      const dt=tb-ta;
      if(dt<=0||dt>.25)continue;
      total+=(((sa+sb)/2)/3.6)*dt;
      valid++;
    }
    return valid>20&&total>100?total:null;
  },

  lengthMatchScore(referenceLength,estimatedLength){
    const ref=Number(referenceLength),est=Number(estimatedLength);
    if(!Number.isFinite(ref)||ref<=0||!Number.isFinite(est)||est<=0)return 0;
    const rel=Math.abs(ref-est)/ref;
    if(rel<=.025)return 360;
    if(rel<=.05)return 300;
    if(rel<=.10)return 220;
    if(rel<=.16)return 120;
    if(rel<=.25)return 20;
    if(rel>=.45)return -360;
    return -120;
  },

  async resolveRaceStudio(trackName,entry,estimatedLength=null){
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
        .map(x=>({
          data:x.data,
          score:x.baseScore
            +this.referenceScore(x.data,trackName,entry)
            +this.lengthMatchScore(x.data?.track_length_m,estimatedLength)
        }))
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

  makeGpsProjection(gps){
    const valid=(gps||[])
      .map(p=>({lat:Number(p?.lat),lon:Number(p?.lon)}))
      .filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon));
    if(valid.length<3)return null;

    const lat0=valid.reduce((a,p)=>a+p.lat,0)/valid.length;
    const lon0=valid.reduce((a,p)=>a+p.lon,0)/valid.length;
    const cos=Math.cos(lat0*Math.PI/180);
    const raw=valid.map(p=>({x:(p.lon-lon0)*cos,y:-(p.lat-lat0)}));

    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    raw.forEach(p=>{minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);});
    const width=Math.max(1e-9,maxX-minX),height=Math.max(1e-9,maxY-minY);
    const viewW=1000,viewH=600,pad=55;
    const scale=Math.min((viewW-pad*2)/width,(viewH-pad*2)/height);
    const usedW=width*scale,usedH=height*scale;
    const ox=(viewW-usedW)/2,oy=(viewH-usedH)/2;

    return {
      lat0,lon0,cos,minX,minY,scale,ox,oy,
      project:(lat,lon)=>{
        const x=(Number(lon)-lon0)*cos;
        const y=-(Number(lat)-lat0);
        return {x:ox+(x-minX)*scale,y:oy+(y-minY)*scale};
      }
    };
  },

  projectGps(gps){
    const projection=this.makeGpsProjection(gps);
    if(!projection)return [];
    return (gps||[])
      .map(p=>({lat:Number(p?.lat),lon:Number(p?.lon)}))
      .filter(p=>Number.isFinite(p.lat)&&Number.isFinite(p.lon))
      .map(p=>projection.project(p.lat,p.lon));
  },

  drawGpsReference(data){
    const host=document.getElementById("trackMotionSvg");
    const stack=document.getElementById("trackVectorStack");
    if(!host||!stack)return false;

    this.gpsProjection=this.makeGpsProjection(data?.gps_points);
    const projected=this.gpsProjection
      ?(data?.gps_points||[]).map(p=>this.gpsProjection.project(Number(p?.lat),Number(p?.lon))).filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y))
      :[];
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

  async load(trackName,configHint="",telemetry=null){
    const status=document.getElementById("trackSource");
    try{
      if(status)status.textContent="A localizar referência…";
      const entry=await this.resolve(trackName,configHint);
      this.activeEntry=entry;
      const estimatedLength=this.estimateLapLength(telemetry);

      // Prefer a GPS reference made for telemetry analysis. Its first GPS
      // point is the start/finish reference and its ordered points form the
      // driving centreline, so LapDistPct maps directly by arc length.
      const reference=await this.resolveRaceStudio(trackName,entry,estimatedLength);
      if(reference&&this.drawGpsReference(reference)){
        const label=reference?.contact?.Nmg||reference?.short_name||reference?.full_name||trackName;
        if(status){
          const len=Number(reference?.track_length_m);
          const match=Number.isFinite(estimatedLength)&&Number.isFinite(len)
            ?" · "+Math.round(estimatedLength)+"m / "+Math.round(len)+"m"
            :"";
          status.textContent="GPS REFERENCE · "+label+match;
        }
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

  gpsSampleLatLon(sample){
    const lat=Number(sample?.lat ?? sample?.Lat ?? sample?.latitude ?? sample?.Latitude);
    const lon=Number(sample?.lon ?? sample?.Lon ?? sample?.longitude ?? sample?.Longitude);
    return Number.isFinite(lat)&&Number.isFinite(lon)?{lat,lon}:null;
  },

  hasRealGps(lap){
    const samples=lap?.samples||[];
    if(!samples.length||!this.gpsProjection)return false;
    let count=0;
    for(const s of samples){
      if(this.gpsSampleLatLon(s)&&++count>=20)return true;
    }
    return false;
  },

  nearestCenterlineStation(point,expectedP=0){
    if(!point||!this.centerline.length)return null;
    const n=this.centerline.length;
    const expected=Math.max(0,Math.min(n-1,Math.round(expectedP*n)));
    const radius=Math.max(80,Math.round(n*.04));
    let bestIndex=expected,best=Infinity;
    for(let d=-radius;d<=radius;d++){
      let i=(expected+d)%n;if(i<0)i+=n;
      const q=this.centerline[i];
      const dist=(q.x-point.x)**2+(q.y-point.y)**2;
      if(dist<best){best=dist;bestIndex=i;}
    }
    return {index:bestIndex,q:bestIndex/n,distance:Math.sqrt(best)};
  },

  reconstructGpsTrajectory(lap){
    if(!this.gpsProjection||!this.centerline.length)return null;
    const samples=(lap?.samples||[]).filter(s=>Number.isFinite(Number(s?._p))&&this.gpsSampleLatLon(s));
    if(samples.length<20)return null;

    const metersPerUnit=this.viewUnitsToMeters();
    const maxPoints=1400,step=Math.max(1,Math.floor(samples.length/maxPoints));
    const points=[];

    for(let i=0;i<samples.length;i+=step){
      const s=samples[i],geo=this.gpsSampleLatLon(s);
      const pt=this.gpsProjection.project(geo.lat,geo.lon);
      const nearest=this.nearestCenterlineStation(pt,Number(s._p));
      const station=nearest?.q??Number(s._p);
      const center=this.localPoint(station),tan=this.centerTangent(station,.0012);
      let lateralM=null;
      if(center&&tan&&Number.isFinite(metersPerUnit)){
        const nx=-tan.y,ny=tan.x;
        lateralM=((pt.x-center.x)*nx+(pt.y-center.y)*ny)*metersPerUnit;
      }
      points.push({p:Number(s._p),q:station,x:pt.x,y:pt.y,lateralM});
    }

    const last=samples[samples.length-1];
    if(points[points.length-1]?.p<Number(last._p)-.0001){
      const geo=this.gpsSampleLatLon(last),pt=this.gpsProjection.project(geo.lat,geo.lon);
      const nearest=this.nearestCenterlineStation(pt,Number(last._p));
      points.push({p:Number(last._p),q:nearest?.q??Number(last._p),x:pt.x,y:pt.y,lateralM:null});
    }

    return {
      points,
      sync:points.map(p=>({p:p.p,q:p.q})),
      rmse:0,
      headingRmsDeg:0,
      maxLateralM:Math.max(0,...points.map(p=>Math.abs(Number(p.lateralM)||0))),
      source:"GPS REAL · iRacing Lat/Lon",
      realGps:true
    };
  },

  wrapAngle(angle){
    let a=Number(angle)||0;
    while(a>Math.PI)a-=Math.PI*2;
    while(a<-Math.PI)a+=Math.PI*2;
    return a;
  },

  trackYawAt(progress){
    const t=this.centerTangent(progress,.0012);
    if(!t)return null;
    // yawNorth convention: 0 = north/up, +PI/2 = east/right.
    return Math.atan2(t.x,-t.y);
  },

  buildTrackSync(lap){
    const samples=(lap?.samples||[]).filter(s=>
      Number.isFinite(Number(s?._p))&&Number.isFinite(Number(s?.yawNorth))
    );
    if(samples.length<20||!this.centerline.length)return null;

    const stride=Math.max(1,Math.floor(samples.length/450));
    const control=[];
    let prevQ=0;

    for(let i=0;i<samples.length;i+=stride){
      const s=samples[i],p=Math.max(0,Math.min(1,Number(s._p)));
      const window=.010;
      const lo=Math.max(i?prevQ+.000001:0,p-window,0);
      const hi=Math.min(1,p+window);
      let bestQ=Math.max(lo,Math.min(hi,p)),best=Infinity;

      for(let k=0;k<=48;k++){
        const q=lo+(hi-lo)*k/48;
        const ty=this.trackYawAt(q);
        if(!Number.isFinite(ty))continue;
        const err=this.wrapAngle(Number(s.yawNorth)-ty);
        const cost=err*err+50*(q-p)*(q-p);
        if(cost<best){best=cost;bestQ=q;}
      }
      prevQ=bestQ;
      control.push({p,q:bestQ});
    }

    const lastSample=samples[samples.length-1];
    if(control[control.length-1]?.p<Number(lastSample._p)-.001){
      control.push({p:Number(lastSample._p),q:Math.max(prevQ,Math.min(1,Number(lastSample._p)))});
    }

    const endQ=control[control.length-1]?.q||1;
    control.forEach(x=>{
      x.q=Math.max(0,Math.min(1,x.q+x.p*(1-endQ)));
    });

    // Light smoothing of the p->q warp while preserving monotonicity.
    const smoothed=control.map((x,i)=>{
      let sum=0,w=0;
      for(let d=-2;d<=2;d++){
        const j=Math.max(0,Math.min(control.length-1,i+d));
        const ww=3-Math.abs(d);
        sum+=control[j].q*ww;w+=ww;
      }
      return {...x,q:sum/w};
    });
    for(let i=1;i<smoothed.length;i++){
      smoothed[i].q=Math.max(smoothed[i].q,smoothed[i-1].q+.000001);
    }
    const end=smoothed[smoothed.length-1]?.q||1;
    smoothed.forEach(x=>x.q=Math.max(0,Math.min(1,x.q+x.p*(1-end))));
    return smoothed;
  },

  mappedProgress(sync,p){
    if(!sync?.length)return Math.max(0,Math.min(1,Number(p)||0));
    const x=Math.max(0,Math.min(1,Number(p)||0));
    if(x<=sync[0].p)return sync[0].q;
    if(x>=sync[sync.length-1].p)return sync[sync.length-1].q;
    let lo=0,hi=sync.length-1;
    while(hi-lo>1){
      const m=(lo+hi)>>1;
      if(sync[m].p<=x)lo=m;else hi=m;
    }
    const a=sync[lo],b=sync[hi],span=b.p-a.p||1,t=(x-a.p)/span;
    return a.q+(b.q-a.q)*t;
  },

  smoothCircularValues(values,radius){
    if(!values.length)return [];
    return values.map((_,i)=>{
      let sum=0,w=0;
      for(let d=-radius;d<=radius;d++){
        let j=i+d;
        while(j<0)j+=values.length;
        while(j>=values.length)j-=values.length;
        const ww=radius+1-Math.abs(d);
        sum+=values[j]*ww;w+=ww;
      }
      return sum/w;
    });
  },

  reconstructRelativeTrajectory(lap,sync){
    const samples=(lap?.samples||[]).filter(s=>
      Number.isFinite(Number(s?._p))&&
      Number.isFinite(Number(s?.yawNorth))
    );
    if(samples.length<20||!sync?.length||!Number.isFinite(Number(this.reference?.lengthM)))return null;

    const lengthM=Number(this.reference.lengthM);
    const rows=samples.map(s=>{
      const p=Math.max(0,Math.min(1,Number(s._p)));
      const q=this.mappedProgress(sync,p);
      const ty=this.trackYawAt(q);
      const err=Number.isFinite(ty)?this.wrapAngle(Number(s.yawNorth)-ty):0;
      return {p,q,err};
    });

    let lateral=0;
    const raw=[0];
    for(let i=1;i<rows.length;i++){
      const a=rows[i-1],b=rows[i];
      const ds=Math.max(0,(b.q-a.q)*lengthM);
      const e=(a.err+b.err)/2;
      lateral+=Math.tan(Math.max(-.32,Math.min(.32,e)))*ds;
      raw.push(lateral);
    }

    // Close the lap, then remove only the low-frequency integration drift.
    const end=raw[raw.length-1]||0;
    const closed=raw.map((v,i)=>v-end*rows[i].p);
    const radius=Math.max(6,Math.round(rows.length*.05));
    const trend=this.smoothCircularValues(closed,radius);
    const lateralM=closed.map((v,i)=>Math.max(-4.2,Math.min(4.2,v-trend[i])));

    const metersPerUnit=this.viewUnitsToMeters();
    if(!Number.isFinite(metersPerUnit)||metersPerUnit<=0)return null;

    const points=rows.map((r,i)=>{
      const center=this.localPoint(r.q),tan=this.centerTangent(r.q,.0012);
      if(!center||!tan)return null;
      const nx=-tan.y,ny=tan.x;
      const offset=lateralM[i]/metersPerUnit;
      return {p:r.p,q:r.q,x:center.x+nx*offset,y:center.y+ny*offset,lateralM:lateralM[i]};
    }).filter(Boolean);

    const headingRms=Math.sqrt(rows.reduce((sum,r)=>sum+r.err*r.err,0)/rows.length)*180/Math.PI;
    return {
      points,
      sync,
      rmse:headingRms,
      headingRmsDeg:headingRms,
      maxLateralM:Math.max(...lateralM.map(Math.abs)),
      source:"LapDistPct + yawNorth + GPS centerline"
    };
  },

  // Compatibility wrapper retained for diagnostics/smoke tests.
  integrateTrajectory(lap){
    const sync=this.buildTrackSync(lap);
    const reconstructed=sync?this.reconstructRelativeTrajectory(lap,sync):null;
    return reconstructed?.points||[];
  },

  reconstructTrajectory(lap,sharedSync=null){
    if(!lap||!this.centerline.length)return null;

    // Exact mode for new recordings: use the car's real geographic position.
    if(this.hasRealGps(lap)){
      return this.reconstructGpsTrajectory(lap);
    }

    // Fallback for legacy laps without Lat/Lon. This can reconstruct changes
    // in lateral line, but absolute left/right track position is unknowable.
    if(Number.isFinite(Number(this.reference?.lengthM))){
      const sync=sharedSync?.sync||sharedSync||this.buildTrackSync(lap);
      const fit=sync?this.reconstructRelativeTrajectory(lap,sync):null;
      if(fit)fit.source="ESTIMATED · LapDistPct + yawNorth";
      return fit;
    }

    return null;
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
    const a=this.reconstructTrajectory(lapA,ref?.sync||null);
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
      const real=Boolean(a.realGps&&(!ref||ref.realGps));
      status.textContent=(ref?"A + REF":"A")+" · "+(real?"GPS REAL":"ESTIMATED")+" · "+(real?"LAT/LON":"LAPDIST + YAW")+" · RMS "+quality.toFixed(1)+"°";
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

  centerTangent(progress,eps=.0025){
    const p0=this.localPoint(Math.max(0,progress-eps));
    const p1=this.localPoint(Math.min(.999999,progress+eps));
    if(!p0||!p1)return null;
    const dx=p1.x-p0.x,dy=p1.y-p0.y,n=Math.hypot(dx,dy)||1;
    return {x:dx/n,y:dy/n};
  },

  cornerMetric(progress){
    const e=.006;
    const a=this.centerTangent(Math.max(.001,progress-e),.002);
    const b=this.centerTangent(Math.min(.999,progress+e),.002);
    if(!a||!b)return {angle:0,sign:0};
    const cross=a.x*b.y-a.y*b.x;
    const dot=Math.max(-1,Math.min(1,a.x*b.x+a.y*b.y));
    const angle=Math.atan2(cross,dot);
    return {angle,sign:Math.sign(angle)};
  },

  detectCorners(){
    if(this.centerline.length<50)return [];
    const candidates=[];
    const count=320;
    for(let i=8;i<count-8;i++){
      const p=i/count,m=this.cornerMetric(p);
      const mag=Math.abs(m.angle);
      if(mag<.012)continue;
      candidates.push({p,mag,sign:m.sign});
    }
    const local=candidates.filter((c,i,a)=>{
      const prev=a[i-1]?.mag??-Infinity,next=a[i+1]?.mag??-Infinity;
      return c.mag>=prev&&c.mag>=next;
    }).sort((a,b)=>b.mag-a.mag);

    const selected=[];
    const circularDistance=(a,b)=>{const d=Math.abs(a-b);return Math.min(d,1-d);};
    for(const c of local){
      if(selected.every(x=>circularDistance(x.p,c.p)>.027)){
        selected.push(c);
        if(selected.length>=18)break;
      }
    }
    return selected.sort((a,b)=>a.p-b.p).map((x,i)=>({
      index:i+1,p:x.p,sign:x.sign,direction:x.sign>0?"Direita":"Esquerda",
      entry:Math.max(0,x.p-.016),exit:Math.min(1,x.p+.016)
    }));
  },

  trajectoryLateralOffset(fit,progress){
    if(!fit)return null;
    const point=this.trajectoryPoint(fit.points,progress);
    const station=fit.sync?this.mappedProgress(fit.sync,progress):progress;
    const center=this.localPoint(station),t=this.centerTangent(station);
    if(!point||!center||!t)return null;
    const nx=-t.y,ny=t.x;
    return (point.x-center.x)*nx+(point.y-center.y)*ny;
  },

  trajectoryInsideOffset(fit,progress,turnSign){
    const lateral=this.trajectoryLateralOffset(fit,progress);
    if(!Number.isFinite(lateral))return null;
    return -turnSign*lateral;
  },

  trajectoryApex(fit,corner){
    if(!fit)return null;
    let best=null;
    const start=Math.max(0,corner.p-.022),end=Math.min(1,corner.p+.022);
    for(let i=0;i<=44;i++){
      const p=start+(end-start)*i/44;
      const inside=this.trajectoryInsideOffset(fit,p,corner.sign);
      if(!Number.isFinite(inside))continue;
      if(!best||inside>best.inside)best={p,inside};
    }
    return best;
  },

  trajectoryCoachRows(lapA,lapRef,dataOverride=null){
    const data=dataOverride||this.trajectoryCompare;
    if(!data?.a||!data?.ref||!lapA||!lapRef)return [];
    const mpu=this.viewUnitsToMeters();
    const lengthM=Number(this.reference?.lengthM);
    const corners=this.detectCorners();

    return corners.map(corner=>{
      const entryA=this.trajectoryInsideOffset(data.a,corner.entry,corner.sign);
      const entryR=this.trajectoryInsideOffset(data.ref,corner.entry,corner.sign);
      const exitA=this.trajectoryInsideOffset(data.a,corner.exit,corner.sign);
      const exitR=this.trajectoryInsideOffset(data.ref,corner.exit,corner.sign);
      const apexA=this.trajectoryApex(data.a,corner);
      const apexR=this.trajectoryApex(data.ref,corner);

      const entryDiff=Number.isFinite(entryA)&&Number.isFinite(entryR)&&Number.isFinite(mpu)?(entryA-entryR)*mpu:null;
      const exitDiff=Number.isFinite(exitA)&&Number.isFinite(exitR)&&Number.isFinite(mpu)?(exitA-exitR)*mpu:null;
      const apexShift=apexA&&apexR&&Number.isFinite(lengthM)?(apexA.p-apexR.p)*lengthM:null;

      const speedA=apexA?AMSAnalysis.interpolate(lapA,apexA.p,"speed"):null;
      const speedR=apexR?AMSAnalysis.interpolate(lapRef,apexR.p,"speed"):null;
      const tAe=AMSAnalysis.timeAt(lapA,corner.entry),tAx=AMSAnalysis.timeAt(lapA,corner.exit);
      const tRe=AMSAnalysis.timeAt(lapRef,corner.entry),tRx=AMSAnalysis.timeAt(lapRef,corner.exit);
      const zoneDelta=[tAe,tAx,tRe,tRx].every(Number.isFinite)?(tAx-tAe)-(tRx-tRe):null;

      return {
        ...corner,
        apexA:apexA?.p??corner.p,apexR:apexR?.p??corner.p,
        entryDiff,exitDiff,apexShift,
        speedA,speedR,
        speedDelta:Number.isFinite(speedA)&&Number.isFinite(speedR)?speedA-speedR:null,
        zoneDelta
      };
    });
  },

  trajectoryLineText(value,phase){
    if(!Number.isFinite(value)||Math.abs(value)<.25)return phase+" semelhante à referência";
    return phase+" "+Math.abs(value).toFixed(1)+" m mais "+(value>0?"interior":"exterior");
  },

  trajectoryApexText(value){
    if(!Number.isFinite(value)||Math.abs(value)<2)return "apex semelhante";
    return "apex "+Math.abs(value).toFixed(0)+" m "+(value>0?"mais tardio":"antecipado");
  },

  trajectoryCoachMessage(row){
    if(!row)return "Fora de uma zona de curva analisada.";
    const parts=[
      "Curva "+row.index+" "+row.direction.toLowerCase(),
      this.trajectoryLineText(row.entryDiff,"entrada"),
      this.trajectoryApexText(row.apexShift),
      this.trajectoryLineText(row.exitDiff,"saída")
    ];
    if(Number.isFinite(row.speedDelta))parts.push("apex "+(row.speedDelta>=0?"+":"")+row.speedDelta.toFixed(1)+" km/h");
    if(Number.isFinite(row.zoneDelta))parts.push("Δ zona "+(row.zoneDelta>=0?"+":"")+row.zoneDelta.toFixed(3)+"s");
    return parts.join(" · ");
  },

  renderTrajectoryCoaching(lapA,lapRef){
    const body=document.getElementById("trajectoryCoachBody");
    const current=document.getElementById("trajectoryCoachCurrent");
    if(!body)return;

    if(!lapRef||!this.trajectoryCompare?.ref){
      this.trajectoryCoaching=[];
      body.innerHTML='<tr><td colspan="7">Seleciona uma volta de referência compatível.</td></tr>';
      if(current)current.textContent="Seleciona uma volta de referência para comparar entrada, apex e saída.";
      return;
    }

    const rows=this.trajectoryCoachRows(lapA,lapRef);
    this.trajectoryCoaching=rows;
    body.innerHTML="";
    const fmtLine=v=>Number.isFinite(v)?((v>=0?"+":"")+v.toFixed(1)+" m"):"—";
    const fmtApex=v=>Number.isFinite(v)?((v>=0?"+":"")+v.toFixed(0)+" m"):"—";
    const fmtSpeed=(a,r)=>Number.isFinite(a)&&Number.isFinite(r)?a.toFixed(1)+" / "+r.toFixed(1):"—";
    const fmtDelta=v=>Number.isFinite(v)?((v>=0?"+":"")+v.toFixed(3)+"s"):"—";

    for(const row of rows){
      const tr=document.createElement("tr");
      tr.className="trajectory-coach-row";
      tr.dataset.corner=String(row.index);
      tr.innerHTML='<td><strong>C'+row.index+'</strong></td>'+
        '<td>'+row.direction+'</td>'+
        '<td class="'+(Math.abs(row.entryDiff||0)>.7?"trajectory-diff":"")+'">'+fmtLine(row.entryDiff)+'</td>'+
        '<td>'+fmtApex(row.apexShift)+'</td>'+
        '<td class="'+(Math.abs(row.exitDiff||0)>.7?"trajectory-diff":"")+'">'+fmtLine(row.exitDiff)+'</td>'+
        '<td>'+fmtSpeed(row.speedA,row.speedR)+' km/h</td>'+
        '<td class="'+(Number(row.zoneDelta)>0?"loss-cell":"gain-cell")+'">'+fmtDelta(row.zoneDelta)+'</td>';
      tr.title=this.trajectoryCoachMessage(row);
      tr.addEventListener("click",()=>{
        this.setTrajectoryPosition(row.apexA);
        this.setTrajectoryCoachingPosition(row.apexA);
        document.dispatchEvent(new CustomEvent("ams-trajectory-seek",{detail:{progress:row.apexA}}));
      });
      body.appendChild(tr);
    }
    if(!rows.length)body.innerHTML='<tr><td colspan="7">Não foi possível detetar zonas de curva.</td></tr>';
    this.setTrajectoryCoachingPosition(this.progress);
  },

  setTrajectoryCoachingPosition(progress){
    const rows=this.trajectoryCoaching||[];
    const p=Math.max(0,Math.min(1,Number(progress)||0));
    let active=null,best=Infinity;
    for(const row of rows){
      const d=Math.abs(row.p-p);
      if(d<best){best=d;active=row;}
    }
    if(best>.045)active=null;

    document.querySelectorAll(".trajectory-coach-row").forEach(el=>{
      el.classList.toggle("active",active&&Number(el.dataset.corner)===active.index);
    });
    const current=document.getElementById("trajectoryCoachCurrent");
    if(current)current.textContent=active?this.trajectoryCoachMessage(active):"Replay fora de uma zona de curva analisada.";
  },

  parseViewBox(){
    const parts=this.analysisViewBox().trim().split(/\s+/).map(Number);
    if(parts.length===4&&parts.every(Number.isFinite))return {x:parts[0],y:parts[1],w:parts[2],h:parts[3]};
    return {x:0,y:0,w:1000,h:600};
  },

  constrainTrajectoryToTrack(fit,halfWidthM=6.5){
    if(!fit?.points?.length)return fit;
    const metersPerUnit=this.viewUnitsToMeters();
    if(!Number.isFinite(metersPerUnit)||metersPerUnit<=0)return fit;
    const halfUnits=halfWidthM/metersPerUnit;
    const points=fit.points.map(pt=>{
      const station=Number.isFinite(Number(pt.q))?Number(pt.q):pt.p;
      const center=this.localPoint(station),tan=this.centerTangent(station);
      if(!center||!tan)return pt;
      const nx=-tan.y,ny=tan.x;
      const lateral=(pt.x-center.x)*nx+(pt.y-center.y)*ny;
      const clipped=Math.max(-halfUnits,Math.min(halfUnits,lateral));
      return {p:pt.p,x:center.x+nx*clipped,y:center.y+ny*clipped};
    });
    return {...fit,points};
  },

  focusedStrokeWidths(){
    const metersPerUnit=this.viewUnitsToMeters();
    if(!Number.isFinite(metersPerUnit)||metersPerUnit<=0){
      return {edge:18,road:13,line:2.4,marker:4};
    }
    const unitsPerMeter=1/metersPerUnit;
    return {
      edge:Math.max(6,Math.min(18,9.5*unitsPerMeter)),
      road:Math.max(4.5,Math.min(14,7.5*unitsPerMeter)),
      line:Math.max(.9,Math.min(2.2,.42*unitsPerMeter)),
      marker:Math.max(1.8,Math.min(4.2,1.0*unitsPerMeter))
    };
  },

  renderFocusedCompare(lapA,lapRef){
    const svg=document.getElementById("compareFocusSvg");
    const mini=document.getElementById("compareMiniMapSvg");
    const status=document.getElementById("compareFocusStatus");
    if(!svg||!mini||!this.centerline.length||!lapA||!lapRef){
      this.focusedCompare=null;
      if(status)status.textContent="SEM COMPARAÇÃO";
      return false;
    }

    const refRaw=this.reconstructTrajectory(lapRef);
    const aRaw=this.reconstructTrajectory(lapA,refRaw?.sync||null);
    if(!aRaw||!refRaw){
      this.focusedCompare=null;
      if(status)status.textContent="DADOS INSUFICIENTES";
      return false;
    }

    // Keep the reconstructed driving lines inside a realistic track corridor.
    // This prevents inertial-integration drift from visually jumping across
    // nearby sections of circuit while preserving lateral A/REF differences.
    const ref=this.constrainTrajectoryToTrack(refRaw,4.2);
    const a=this.constrainTrajectoryToTrack(aRaw,4.2);
    const data={
      a,ref,lapA,lapRef,
      coaching:this.trajectoryCoachRows(lapA,lapRef,{a,ref}),
      progress:0
    };
    this.focusedCompare=data;

    const full=this.parseViewBox();
    const base=this.centerline.filter((_,i)=>i%2===0).map(p=>p.x.toFixed(2)+","+p.y.toFixed(2)).join(" ");
    const pathA=this.svgPath(a.points),pathR=this.svgPath(ref.points);
    const sw=this.focusedStrokeWidths();

    svg.setAttribute("preserveAspectRatio","xMidYMid meet");
    svg.innerHTML=
      '<polyline class="compare-focus-track-edge" style="stroke-width:'+sw.edge.toFixed(2)+'" points="'+base+'"></polyline>'+
      '<polyline class="compare-focus-track-road" style="stroke-width:'+sw.road.toFixed(2)+'" points="'+base+'"></polyline>'+
      '<path class="compare-focus-line trajectory-a ghost" style="stroke-width:'+Math.max(1,sw.line*.72).toFixed(2)+'" d="'+pathA+'"></path>'+
      '<path class="compare-focus-line trajectory-ref ghost" style="stroke-width:'+Math.max(1,sw.line*.72).toFixed(2)+'" d="'+pathR+'"></path>'+
      '<path id="compareFocusProgressA" class="compare-focus-line trajectory-a progress" style="stroke-width:'+sw.line.toFixed(2)+'" d="'+pathA+'"></path>'+
      '<path id="compareFocusProgressRef" class="compare-focus-line trajectory-ref progress" style="stroke-width:'+sw.line.toFixed(2)+'" d="'+pathR+'"></path>'+
      '<circle id="compareFocusMarkerA" class="compare-focus-marker marker-a" r="'+sw.marker.toFixed(2)+'"></circle>'+
      '<circle id="compareFocusMarkerRef" class="compare-focus-marker marker-ref" r="'+sw.marker.toFixed(2)+'"></circle>';

    mini.setAttribute("viewBox",full.x+" "+full.y+" "+full.w+" "+full.h);
    mini.setAttribute("preserveAspectRatio","xMidYMid meet");
    mini.innerHTML=
      '<polyline class="compare-mini-track" points="'+base+'"></polyline>'+
      '<path class="compare-mini-line trajectory-a" d="'+pathA+'"></path>'+
      '<path class="compare-mini-line trajectory-ref" d="'+pathR+'"></path>'+
      '<circle id="compareMiniMarkerA" class="compare-mini-marker marker-a" r="9"></circle>'+
      '<circle id="compareMiniMarkerRef" class="compare-mini-marker marker-ref" r="9"></circle>';

    requestAnimationFrame(()=>{
      for(const id of ["compareFocusProgressA","compareFocusProgressRef"]){
        const path=document.getElementById(id);if(!path)continue;
        const len=path.getTotalLength?.()||0;
        path.dataset.pathLength=String(len);
        path.style.strokeDasharray=len+" "+len;
        path.style.strokeDashoffset=String(len);
      }
      this.setFocusedComparePosition(0);
    });

    if(status){
      const real=Boolean(a.realGps&&ref.realGps);
      status.textContent=(real?"GPS REAL":"ESTIMATED")+" · FOLLOW · A vs REF";
    }
    return true;
  },

  setFocusedCompareZoom(value){
    const z=Number(value);
    if(Number.isFinite(z)&&z>=1.5&&z<=12)this.focusedCompareZoom=z;
    if(this.focusedCompare)this.setFocusedComparePosition(this.focusedCompare.progress||0);
  },

  nearestFocusedCoach(progress){
    const rows=this.focusedCompare?.coaching||[];
    let best=null,distance=Infinity;
    for(const row of rows){
      const d=Math.abs(Number(row.p)-progress);
      if(d<distance){distance=d;best=row;}
    }
    return distance<=.055?best:null;
  },

  setFocusedComparePosition(progress){
    const data=this.focusedCompare,svg=document.getElementById("compareFocusSvg");
    if(!data||!svg)return;

    const p=Math.max(0,Math.min(1,Number(progress)||0));
    data.progress=p;
    const pa=this.trajectoryPoint(data.a.points,p);
    const pr=this.trajectoryPoint(data.ref.points,p);
    const center=pa&&pr?{x:(pa.x+pr.x)/2,y:(pa.y+pr.y)/2}:pa||pr||this.localPoint(p);
    if(!center)return;

    const full=this.parseViewBox();
    const zoom=this.focusedCompareZoom||4;
    const vw=full.w/zoom,vh=full.h/zoom;
    svg.setAttribute("viewBox",(center.x-vw/2)+" "+(center.y-vh/2)+" "+vw+" "+vh);

    const update=(markerId,pathId,miniId,pt)=>{
      if(!pt)return;
      const marker=document.getElementById(markerId);
      const mini=document.getElementById(miniId);
      if(marker){marker.setAttribute("cx",pt.x.toFixed(2));marker.setAttribute("cy",pt.y.toFixed(2));}
      if(mini){mini.setAttribute("cx",pt.x.toFixed(2));mini.setAttribute("cy",pt.y.toFixed(2));}
      const path=document.getElementById(pathId);
      if(path){
        const len=Number(path.dataset.pathLength)||path.getTotalLength?.()||0;
        path.style.strokeDasharray=len+" "+len;
        path.style.strokeDashoffset=String(len*(1-p));
      }
    };

    update("compareFocusMarkerA","compareFocusProgressA","compareMiniMarkerA",pa);
    update("compareFocusMarkerRef","compareFocusProgressRef","compareMiniMarkerRef",pr);

    const metersPerUnit=this.viewUnitsToMeters();
    const separation=pa&&pr&&Number.isFinite(metersPerUnit)?this.distance(pa,pr)*metersPerUnit:null;
    const ta=AMSAnalysis.timeAt(data.lapA,p),tr=AMSAnalysis.timeAt(data.lapRef,p);
    const delta=Number.isFinite(ta)&&Number.isFinite(tr)?ta-tr:null;

    const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
    set("compareFocusPosition",(p*100).toFixed(1)+"%");
    set("compareReplayPosition",(p*100).toFixed(1)+"%");
    set("compareFocusSeparation",Number.isFinite(separation)?separation.toFixed(2)+" m":"—");
    set("compareFocusDelta",Number.isFinite(delta)?((delta>=0?"+":"")+delta.toFixed(3)+"s"):"—");

    const seek=document.getElementById("compareReplaySeek");
    if(seek)seek.value=String(Math.round(p*1000));

    const coach=this.nearestFocusedCoach(p);
    const coachEl=document.getElementById("compareFocusCoach");
    if(coachEl){
      coachEl.classList.toggle("active",Boolean(coach));
      coachEl.textContent=coach?this.trajectoryCoachMessage(coach):"Zona de reta · trajectórias sincronizadas";
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