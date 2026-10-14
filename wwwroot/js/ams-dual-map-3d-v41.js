/* AMS Dual Maps v41 — optional planar 3D rendering.
 * 2D DOM/SVG mapping is intentionally never changed; 3D uses exactly the
 * pre-existing AMSTrack.centerline and independently reconstructed trajectories.
 * Plane is VISUAL ONLY: no measured track elevation, camber or banking.
 */
const THREE_URL='https://cdn.jsdelivr.net/npm/three@0.166.1/build/three.module.js';
const track=window.AMSTrack;
if(track){
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const validPts=arr=>Array.isArray(arr)&&arr.length>=8&&arr.every(p=>finite(p?.x)&&finite(p?.y));
let threePromise=null;
const loadThree=()=>threePromise??(threePromise=import(THREE_URL).catch(err=>{threePromise=null;throw err;}));
const viewers={};
function createView(id,stage,header){
 if(!stage||!header)return null;
 const shell=document.createElement('div');shell.className='ams-map3d-toggle';shell.setAttribute('role','group');shell.setAttribute('aria-label','Modo de mapa');
 const btn2=document.createElement('button'),btn3=document.createElement('button');
 for(const [b,name] of [[btn2,'2D'],[btn3,'3D']]){
  b.type='button';b.textContent=name;b.dataset.mapMode=name.toLowerCase();b.setAttribute('aria-pressed',String(name==='2D'));shell.append(b);
 }
 header.append(shell);
 const overlay=document.createElement('div');overlay.className='ams-map3d-overlay';overlay.hidden=true;
 const status=document.createElement('div');status.className='ams-map3d-status';status.setAttribute('role','status');status.textContent='Seleciona uma volta com traçado validado.';
 const controls=document.createElement('div');controls.className='ams-map3d-controls';
 const reset=document.createElement('button');reset.type='button';reset.textContent='Repor câmara';reset.title='Voltar ao ângulo de visualização inicial';
 controls.append(reset);
 let channel=null,channelSelect=null;
 if(id==='telemetry'){
  const label=document.createElement('label');label.textContent='Camada ';
  channelSelect=document.createElement('select');channelSelect.setAttribute('aria-label','Camada de análise 3D');
  for(const [value,text] of [['track','Trajetória'],['speed','Velocidade'],['brake','Travagem'],['throttle','Acelerador']]){
   const opt=document.createElement('option');opt.value=value;opt.textContent=text;channelSelect.append(opt);
  }
  label.append(channelSelect);controls.prepend(label);channel='track';
 }
 const hint=document.createElement('div');hint.className='ams-map3d-hint';hint.textContent='Arrastar: rodar · Roda: zoom · relevo não disponível';
 overlay.append(status,controls,hint);
 stage.append(overlay);
 const view={id,stage,overlay,status,btn2,btn3,reset,channel,channelSelect,active:false,engine:null,token:0,raf:0,sceneKey:'',currentLap:null};
 viewers[id]=view;
 const setActive=async enabled=>{
  if(!enabled){
   view.token++;view.active=false;view.stage.classList.remove('ams-map3d-active');
   overlay.hidden=true;btn2.setAttribute('aria-pressed','true');btn3.setAttribute('aria-pressed','false');
   if(view.raf)cancelAnimationFrame(view.raf);view.raf=0;
   return;
  }
  if(view.active)return;
  view.active=true;view.stage.classList.add('ams-map3d-active');overlay.hidden=false;
  btn2.setAttribute('aria-pressed','false');btn3.setAttribute('aria-pressed','true');status.textContent='A iniciar visualização 3D…';
  const request=++view.token;
  try{
   const THREE=await loadThree();
   if(request!==view.token||!view.active)return;
   if(!view.engine)view.engine=new Engine(THREE,view);
   view.engine.rebuild();
   view.engine.resize();
   const frame=()=>{
    if(!view.active)return;
    view.raf=requestAnimationFrame(frame);
    if(!view.stage.closest('.view.active')||document.hidden)return;
    view.engine.resize();view.engine.moveCars();view.engine.render();
   };
   frame();
  }catch(error){
   status.textContent='3D indisponível neste navegador. A vista 2D continua funcional.';
   console.warn('AMS map 3D fallback:',error);
   // Give users the error message, but always restore their original 2D map.
   view.active=false;view.stage.classList.remove('ams-map3d-active');overlay.hidden=true;btn2.setAttribute('aria-pressed','true');btn3.setAttribute('aria-pressed','false');
   if(view.raf)cancelAnimationFrame(view.raf);view.raf=0;
  }
 };
 btn2.addEventListener('click',()=>setActive(false));
 btn3.addEventListener('click',()=>setActive(true));
 reset.addEventListener('click',()=>view.engine?.resetCamera());
 channelSelect?.addEventListener('change',()=>{view.channel=channelSelect.value;if(view.active)view.engine?.rebuild();});
 return view;
}
const tStage=document.querySelector('#telemetryMapFirst .trajectory-stage');
const tHeader=document.querySelector('#telemetryMapFirst .trajectory-compare-card .card-head')||document.querySelector('#telemetryMapFirst .card-head');
const cStage=document.getElementById('compareFocusStage');
const cHeader=document.querySelector('#compare .compare-focus-card .card-head');
createView('telemetry',tStage,tHeader);createView('compare',cStage,cHeader);
class Engine{
 constructor(T,view){
  this.T=T;this.view=view;this.width=0;this.height=0;this.distance=170;this.polar=.89;this.azimuth=.65;
  this.scene=new T.Scene();this.scene.background=new T.Color(0x07111a);
  this.camera=new T.PerspectiveCamera(45,1,.05,3000);
  this.root=new T.Group();this.scene.add(this.root);
  this.renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'default'});
  this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
  this.renderer.domElement.className='ams-map3d-canvas';
  view.overlay.insertBefore(this.renderer.domElement,view.status);
  this.scene.add(new T.HemisphereLight(0xcce5ff,0x304459,2));
  const sun=new T.DirectionalLight(0xffffff,1.5);sun.position.set(-100,140,65);this.scene.add(sun);
  this.grid=new T.GridHelper(160,20,0x2e526b,0x183041);this.grid.position.y=-1.15;this.scene.add(this.grid);
  this.model=null;this.markers={};this.drag=null;this.canvas=this.renderer.domElement;
  const canvas=this.canvas;
  canvas.addEventListener('pointerdown',e=>{
   if(e.button!==0&&e.pointerType==='mouse')return;
   this.drag={x:e.clientX,y:e.clientY,azi:this.azimuth,pol:this.polar};
   canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove',e=>{
   if(!this.drag)return;
   this.azimuth=this.drag.azi-(e.clientX-this.drag.x)*.007;
   this.polar=clamp(this.drag.pol+(e.clientY-this.drag.y)*.006,.2,1.48);
   this.updateCamera();
  });
  for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,()=>{this.drag=null});
  canvas.addEventListener('wheel',e=>{
   e.preventDefault();this.distance=clamp(this.distance*Math.exp(e.deltaY*.0012),50,440);this.updateCamera();
  },{passive:false});
  this.resetCamera();
 }
 resetCamera(){
  this.azimuth=.65;this.polar=.85;this.distance=180;this.updateCamera();
 }
 updateCamera(){
  const r=this.distance,p=this.polar,a=this.azimuth;
  this.camera.position.set(r*Math.sin(p)*Math.cos(a),r*Math.cos(p),r*Math.sin(p)*Math.sin(a));
  this.camera.lookAt(0,0,0);this.camera.updateProjectionMatrix();
 }
 resize(){
  const rect=this.view.overlay.getBoundingClientRect();
  const w=Math.floor(rect.width),h=Math.floor(rect.height);
  if(w<20||h<20||w===this.width&&h===this.height)return;
  this.width=w;this.height=h;this.camera.aspect=w/h;this.camera.updateProjectionMatrix();
  this.renderer.setSize(w,h,false);
 }
 empty(message){
  this.view.status.textContent=message;
 }
 clear(){
  while(this.root.children.length){
   const obj=this.root.children[0];this.root.remove(obj);
   obj.traverse(node=>{
    node.geometry?.dispose?.();
    if(Array.isArray(node.material))node.material.forEach(m=>m.dispose?.());
    else node.material?.dispose?.();
   });
  }
  this.model=null;this.markers={};
 }
 geometryContext(){
  const raw=track.centerline;
  if(!validPts(raw)||!track.reference)return null;
  const xs=raw.map(p=>p.x),ys=raw.map(p=>p.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const span=Math.max(maxX-minX,maxY-minY,1);
  if(!Number.isFinite(span)||span<1e-5)return null;
  const scale=120/span,cx=(minX+maxX)/2,cy=(minY+maxY)/2;
  return {pts:raw,scale,cx,cy,span,toWorld:(p,y=0)=>new this.T.Vector3((p.x-cx)*scale,y,(p.y-cy)*scale)};
 }
 makeRibbon(points,width,height,color,close=false,colors=null){
  const T=this.T;
  if(points.length<2)return null;
  const vertices=[],colorArray=[],triangles=[];
  let count=0;
  for(let i=0;i<points.length;i++){
   const p=points[i],prev=points[Math.max(0,i-1)],next=points[Math.min(points.length-1,i+1)];
   const tx=next.x-prev.x,tz=next.z-prev.z,den=Math.hypot(tx,tz)||1;
   const nx=-tz/den,nz=tx/den;
   vertices.push(p.x+nx*width/2,height,p.z+nz*width/2,p.x-nx*width/2,height,p.z-nz*width/2);
   const c=colors?.[i]||color;
   colorArray.push(c.r,c.g,c.b,c.r,c.g,c.b);
   if(i>0){
    const len=Math.hypot(p.x-prev.x,p.z-prev.z);
    // Do not draw fictitious joins over a large missing-telemetry gap.
    if(len>Math.max(10,width*18)&&!close)continue;
    const j=2*i;
    triangles.push(j-2,j-1,j,j-1,j+1,j);
   }
   count++;
  }
  if(close&&points.length>2){
   const i=2*(points.length-1);triangles.push(i,i+1,0,i+1,1,0);
  }
  if(!triangles.length)return null;
  const g=new T.BufferGeometry();
  g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  g.setAttribute('color',new T.Float32BufferAttribute(colorArray,3));
  g.setIndex(triangles);
  g.computeVertexNormals();
  const mat=new T.MeshBasicMaterial({side:T.DoubleSide,vertexColors:true,depthWrite:true});
  const mesh=new T.Mesh(g,mat);this.root.add(mesh);return mesh;
 }
 showTrajectory(fit,solid,lap){
  const pts=fit?.points;
  if(!validPts(pts)||!this.model)return;
  const T=this.T,ctx=this.model,c=ctx.toWorld;
  // Respect original (x,y,p) from the calibrated trajectory: no lateral nudge.
  const items=pts.filter((x,i)=>i%Math.max(1,Math.ceil(pts.length/1300))===0);
  const path=items.map(p=>c(p));
  const channel=this.view.id==='telemetry'?this.view.channel:'track';
  let colors=null;
  if(channel!=='track'&&lap?.samples?.length){
   const values=items.map(p=>window.AMSAnalysis?.interpolate?.(lap,p.p,channel));
   const observed=values.filter(finite);
   if(observed.length>=10){
    const lo=channel==='speed'?Math.min(...observed):0;
    const hi=channel==='speed'?Math.max(...observed):100;
    const den=Math.max(1,hi-lo);
    colors=values.map(v=>{
     if(!finite(v))return new T.Color(solid);
     const a=clamp((v-lo)/den,0,1);
     if(channel==='brake')return new T.Color().setHSL(.35-a*.35,.92,.51);
     if(channel==='throttle')return new T.Color().setHSL(.07+a*.29,.9,.52);
     return new T.Color().setHSL(.65-a*.65,.9,.52);
    });
    this.empty(channel==='speed'?'VELOCIDADE · escala relativa aos valores reais da volta':channel==='brake'?'TRAVAGEM · canal real':'ACELERADOR · canal real');
   }else this.empty('Canal selecionado sem amostras suficientes · trajetória normal');
  }
  this.makeRibbon(path,.52,1.03,new T.Color(solid),false,colors);
 }
 marker(name,color,radius){
  const T=this.T;
  const geo=new T.SphereGeometry(radius,14,12);
  const m=new T.Mesh(geo,new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:.35,metalness:.05,roughness:.25}));
  m.visible=false;this.root.add(m);this.markers[name]=m;return m;
 }
 rebuild(){
  this.clear();
  const data=this.geometryContext();
  if(!data){
   this.empty('SEM PISTA VALIDADA · a vista 2D mantém-se disponível.');
   return;
  }
  this.model=data;
  const ctx=data,to=ctx.toWorld,T=this.T;
  const pts=ctx.pts.filter((_,i)=>i%Math.max(1,Math.floor(ctx.pts.length/1600))===0).map(p=>to(p));
  const meterRatio=track.viewUnitsToMeters?.();
  // Width is illustrative when only a centerline is available.
  const roadW=finite(meterRatio)&&meterRatio>0?clamp(13/meterRatio*ctx.scale,1.7,5):3;
  const roadColor=new T.Color(0x465563),edgeColor=new T.Color(0x99b8c6);
  this.makeRibbon(pts,roadW+1.4,-.18,edgeColor,true);
  this.makeRibbon(pts,roadW,.03,roadColor,true);
  const first=pts[0],next=pts[6]||pts[1];
  if(first&&next){
   const ang=Math.atan2(next.z-first.z,next.x-first.x);
   const startMesh=new T.Mesh(new T.BoxGeometry(roadW+1.6,.1,.6),new T.MeshBasicMaterial({color:0xf1f8ff}));
   startMesh.position.copy(first);startMesh.position.y=.15;startMesh.rotation.y=-ang+Math.PI/2;this.root.add(startMesh);
  }
  const obj=this.view.id==='telemetry'?track.trajectoryCompare:track.focusedCompare;
  if(this.view.id==='telemetry'){
   this.showTrajectory(obj?.ref,0x3494df,viewers.telemetry.currentLap?.ref);
   this.showTrajectory(obj?.a,0xf33c56,viewers.telemetry.currentLap?.lap);
   if(obj?.a?.points?.length)this.marker('a',0xff4259,1.65);
   if(obj?.ref?.points?.length)this.marker('ref',0x3baaff,1.4);
  }else{
   this.showTrajectory(obj?.ref,0x399df7,obj?.lapRef);
   this.showTrajectory(obj?.a,0xf3435b,obj?.lapA);
   if(obj?.a?.points?.length)this.marker('a',0xff4259,1.65);
   if(obj?.ref?.points?.length)this.marker('ref',0x3baaff,1.4);
  }
  const source=String(track.reference?.source||'referência validada');
  if(this.view.channel==='track'||this.view.id==='compare')this.empty(
   'PISTA PLANA 3D · '+source+' · largura ilustrativa · sem dados de elevação');
  this.resize();this.moveCars();this.render();
 }
 moveCars(){
  if(!this.model)return;
  const obj=this.view.id==='telemetry'?track.trajectoryCompare:track.focusedCompare;
  const pA=this.view.id==='telemetry'?track.progress:obj?.progressA??obj?.progress??0;
  const pRef=this.view.id==='telemetry'?track.progress:obj?.progressRef??obj?.progress??0;
  for(const [name,fit,p] of [['a',obj?.a,pA],['ref',obj?.ref,pRef]]){
   const marker=this.markers[name];if(!marker)continue;
   const point=track.trajectoryPoint(fit?.points,finite(p)?p:0);
   if(!point){marker.visible=false;continue;}
   marker.visible=true;marker.position.copy(this.model.toWorld(point,2.1));
  }
 }
 render(){this.renderer.render(this.scene,this.camera);}
}
document.addEventListener('ams-3d-telemetry-data',e=>{
 if(!viewers.telemetry)return;
 viewers.telemetry.currentLap={lap:e.detail?.lap||null,ref:e.detail?.ref||null};
 if(viewers.telemetry.active)viewers.telemetry.engine?.rebuild();
});
document.addEventListener('ams-compare-data',()=>{
 if(viewers.compare?.active)viewers.compare.engine?.rebuild();
});
document.addEventListener('ams-auth-changed',e=>{
 if(e.detail?.user)return;
 for(const view of Object.values(viewers)){view.currentLap=null;if(view.active)view.engine?.clear();}
});
}
