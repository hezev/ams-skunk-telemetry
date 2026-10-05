window.AMSTrack = {
  phase:0,
  progress:0,
  index:null,
  activeEntry:null,
  activePath:null,
  centerline:[],
  startOffset:0,

  normalize(value){
    return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/&/g," and ").replace(/[^a-z0-9]+/g," ").trim();
  },

  encodePath(path){ return String(path).split("/").map(encodeURIComponent).join("/"); },

  collectStrings(obj){
    return Object.values(obj||{}).filter(v=>typeof v==="string"&&v.length<500).map(v=>v.trim()).filter(Boolean);
  },

  buildIndex(data){
    const found=[],seen=new Set(),categories=["Road","Oval","Dirt Road","Dirt Oval"];
    const walk=(node,parents=[])=>{
      if(Array.isArray(node)){node.forEach(v=>walk(v,parents));return;}
      if(!node||typeof node!=="object")return;
      const direct=this.collectStrings(node),context=[...parents,...direct].slice(-24);
      let localPath=null,cdnBase=null;
      for(const s of direct){
        const clean=s.replace(/\\/g,"/");
        const category=categories.find(c=>clean.startsWith(c+"/"));
        if(category&&clean.split("/").length>=3)localPath=clean.split("/").slice(0,3).join("/");
        if(clean.includes("members-assets.iracing.com/public/track-maps/")){
          const ix=clean.indexOf("https://");
          if(ix>=0)cdnBase=clean.slice(ix).split(/[?#]/)[0].replace(/\/(active|background|inactive|pitroad|start-finish|turns)\.svg$/i,"").replace(/\/$/,"");
        }
      }
      if(localPath||cdnBase){
        const key=localPath||cdnBase;
        if(!seen.has(key)){
          seen.add(key);
          const parts=localPath?localPath.split("/"):[];
          found.push({localPath,cdnBase,category:parts[0]||"",family:parts[1]||"",config:parts[2]||"",search:this.normalize(context.join(" "))});
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

  async getIndex(){
    if(this.index)return this.index;
    const cached=sessionStorage.getItem("ams_track_index_v1");
    if(cached){try{this.index=JSON.parse(cached);return this.index;}catch{}}
    const res=await fetch(AMS_CONFIG.trackMetadataUrl,{cache:"force-cache"});
    if(!res.ok)throw new Error("Não foi possível carregar o catálogo de pistas.");
    this.index=this.buildIndex(await res.json());
    try{sessionStorage.setItem("ams_track_index_v1",JSON.stringify(this.index));}catch{}
    return this.index;
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
      score+=hint.split(" ").filter(x=>x.length>2&&entry.search.includes(x)).length*8;
    }
    if(/grand.?prix|gp\b/i.test(entry.config))score+=2;
    return score;
  },

  async resolve(trackName,configHint=""){
    const index=await this.getIndex();
    return index.map(entry=>({entry,score:this.score(entry,trackName,configHint)})).sort((a,b)=>b.score-a.score)[0]?.entry||null;
  },

  baseUrl(entry){
    if(entry.cdnBase)return entry.cdnBase;
    if(entry.localPath)return AMS_CONFIG.trackRawBase+"/"+this.encodePath(entry.localPath);
    return "";
  },

  async load(trackName,configHint=""){
    const status=document.getElementById("trackSource");
    try{
      if(status)status.textContent="A localizar traçado…";
      const entry=await this.resolve(trackName,configHint);
      if(!entry)throw new Error("Traçado não encontrado.");
      this.activeEntry=entry;
      const base=this.baseUrl(entry),stack=document.getElementById("trackVectorStack");
      if(!stack)return;
      stack.querySelectorAll("img.track-layer").forEach(img=>img.remove());
      const layers=[["background","background.svg"],["inactive","inactive.svg"],["active","active.svg"],["pitroad","pitroad.svg"],["startfinish","start-finish.svg"],["turns","turns.svg"]];
      for(const [cls,file] of layers){
        const img=document.createElement("img");
        img.className="track-layer track-"+cls;img.alt="";img.src=base+"/"+file;img.onerror=()=>img.remove();stack.appendChild(img);
      }
      await this.prepareCenterline(base+"/active.svg",base+"/start-finish.svg");
      if(status)status.textContent=[entry.family,entry.config].filter(Boolean).join(" · ")||trackName;
      return entry;
    }catch(err){
      this.centerline=[];if(status)status.textContent="Mapa indisponível";console.warn("AMS track map:",err);return null;
    }
  },

  distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y);},

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
      const d=this.distance(points[i-1],points[i]);distances.push(d);
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

  resampleClosed(points,count=2400){
    if(points.length<2)return points;
    const seg=[],cum=[0];
    let total=0;
    for(let i=0;i<points.length;i++){
      const d=this.distance(points[i],points[(i+1)%points.length]);
      seg.push(d);total+=d;cum.push(total);
    }
    if(total<=0)return points;

    const out=[];
    let segment=0;
    for(let k=0;k<count;k++){
      const target=total*k/count;
      while(segment<seg.length-1 && cum[segment+1]<target)segment++;
      const a=points[segment],b=points[(segment+1)%points.length];
      const len=seg[segment]||1;
      const t=Math.max(0,Math.min(1,(target-cum[segment])/len));
      out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});
    }
    return out;
  },

  buildCenterline(a,b,count=2000){
    if(!a.length)return [];
    if(!b.length)return this.resampleClosed(a,count);

    // Find the matching point on the opposite edge and its direction.
    let start=0,best=Infinity;
    for(let i=0;i<b.length;i++){
      const d=this.distance(a[0],b[i]);
      if(d<best){best=d;start=i;}
    }

    const aForward=a[Math.min(8,a.length-1)];
    const bPlus=b[(start+8)%b.length];
    const bMinus=b[(start-8+b.length)%b.length];
    const dir=this.distance(aForward,bPlus)<=this.distance(aForward,bMinus)?1:-1;

    // Pair both edges locally instead of by equal percentage. This prevents
    // cumulative scale drift and avoids pairing with a nearby but unrelated
    // section of circuit.
    const raw=[];
    let current=start;
    const strideA=Math.max(1,Math.floor(a.length/count));
    const localWindow=Math.max(18,Math.floor(b.length*.018));

    for(let k=0;k<count;k++){
      const ai=Math.min(a.length-1,Math.floor(k*a.length/count));
      const p1=a[ai];
      const predicted=((start+dir*Math.floor(k*b.length/count))%b.length+b.length)%b.length;
      const expected=Math.round(current*.65+predicted*.35);
      current=this.nearestIndex(b,p1,expected,localWindow);
      const p2=b[current];
      raw.push({x:(p1.x+p2.x)/2,y:(p1.y+p2.y)/2});
    }

    // LapDistPct/position represents distance along the circuit, not array
    // index. Re-sample by actual centreline arc length so 25/50/75% line up.
    return this.resampleClosed(this.smoothClosed(raw,5),2400);
  },

  async startFinishPoint(url,host){
    try{
      const res=await fetch(url,{cache:"force-cache"});if(!res.ok)return null;
      const doc=new DOMParser().parseFromString(await res.text(),"image/svg+xml");
      const g=document.createElementNS("http://www.w3.org/2000/svg","g");
      g.setAttribute("visibility","hidden");
      [...doc.documentElement.children].forEach(node=>g.appendChild(document.importNode(node,true)));
      host.appendChild(g);
      const paths=[...g.querySelectorAll("path")];
      let candidate=null,bestArea=Infinity;
      for(const p of paths){
        try{
          const b=p.getBBox(),area=Math.max(.001,b.width*b.height);
          if(area<bestArea&&Math.max(b.width,b.height)>5){bestArea=area;candidate=b;}
        }catch{}
      }
      g.remove();
      return candidate?{x:candidate.x+candidate.width/2,y:candidate.y+candidate.height/2}:null;
    }catch{return null;}
  },

  rotateToStart(points,start){
    if(!points.length||!start)return points;
    let nearest=0,best=Infinity;
    for(let i=0;i<points.length;i++){
      const d=this.distance(points[i],start);
      if(d<best){best=d;nearest=i;}
    }
    return [...points.slice(nearest),...points.slice(0,nearest)];
  },

  async prepareCenterline(activeUrl,startFinishUrl){
    this.activePath=null;this.centerline=[];
    const host=document.getElementById("trackMotionSvg");if(!host)return;

    const res=await fetch(activeUrl,{cache:"force-cache"});if(!res.ok)return;
    const text=await res.text(),doc=new DOMParser().parseFromString(text,"image/svg+xml"),src=doc.documentElement;
    const viewBox=src.getAttribute("viewBox");if(viewBox)host.setAttribute("viewBox",viewBox);
    const par=src.getAttribute("preserveAspectRatio");if(par)host.setAttribute("preserveAspectRatio",par);
    host.innerHTML=src.innerHTML;

    const paths=[...host.querySelectorAll("path")];
    let best=null,bestLen=0;
    for(const p of paths){try{const len=p.getTotalLength();if(len>bestLen){best=p;bestLen=len;}}catch{}}
    if(!best)return;
    this.activePath=best;

    const compound=this.sampleCompoundPath(best,5000);
    const contours=this.splitContours(compound).sort((x,y)=>y.length-x.length);
    let center=this.buildCenterline(contours[0]||[],contours[1]||[]);
    const sf=await this.startFinishPoint(startFinishUrl,host);
    center=this.rotateToStart(center,sf);
    this.centerline=center;

    requestAnimationFrame(()=>this.setPosition(this.progress));
  },

  localPoint(progress){
    const pts=this.centerline;
    if(!pts.length)return null;
    const p=((Number(progress)%1)+1)%1;
    const x=p*pts.length,i=Math.floor(x)%pts.length,j=(i+1)%pts.length,t=x-Math.floor(x);
    return {x:pts[i].x+(pts[j].x-pts[i].x)*t,y:pts[i].y+(pts[j].y-pts[i].y)*t};
  },

  positionElement(el,progress){
    const svg=document.getElementById("trackMotionSvg"),point=this.localPoint(progress);
    if(!el||!svg||!point)return;
    const matrix=svg.getScreenCTM();if(!matrix)return;
    const screen=new DOMPoint(point.x,point.y).matrixTransform(matrix);
    const stage=document.querySelector(".track-stage")?.getBoundingClientRect();if(!stage)return;
    el.style.left=(screen.x-stage.left)+"px";el.style.top=(screen.y-stage.top)+"px";
  },

  setPosition(progress){
    this.progress=((Number(progress)%1)+1)%1;
    this.positionElement(document.getElementById("carDot"),this.progress);
  },

  renderCars(rows=[],ownPilotId=null){
    const stage=document.querySelector(".track-stage");if(!stage||!this.centerline.length)return;
    stage.querySelectorAll(".map-car-dot").forEach(el=>el.remove());
    for(const row of rows){
      const pos=AMSSupabase.samplePosition(row?.sample);if(pos===null)continue;
      const isOwn=ownPilotId&&row.pilot_id===ownPilotId;
      if(isOwn){this.setPosition(pos);continue;}
      const el=document.createElement("div");el.className="map-car-dot";
      const number=row?.sample?.carNumber??row?.sample?.car_number??row?.sample?.number??"";
      const driver=row?.sample?.driverName??row?.sample?.driver_name??row?.sample?.name??"";
      el.title=[number?("#"+String(number).replace("#","")):"",driver].filter(Boolean).join(" ");
      if(number)el.dataset.label=String(number).replace("#","");
      stage.appendChild(el);this.positionElement(el,pos);
    }
  },

  tick(trackPosition=null){
    this.phase+=.04;
    const next=Number.isFinite(Number(trackPosition))?Number(trackPosition):(this.progress+.0018)%1;
    this.setPosition(next);
  }
};