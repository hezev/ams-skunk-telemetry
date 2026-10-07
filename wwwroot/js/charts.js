window.AMSCharts = {
  telemetry: [],
  reference: [],
  compareA: [],
  compareB: [],
  comparisonProfile: [],
  cursorPos: null,
  compareCursorA: null,
  compareCursorB: null,
  zoomStart: 0,
  zoomEnd: 1,
  redrawFrame: null,
  cursorCallback: null,
  compareCursorCallback: null,

  specs: {
    speed: {unit:"km/h",series:[["speed","Speed","#ef1824"]]},
    throttle: {unit:"%",fixed:[0,100],series:[["throttle","Throttle","#31d878"]]},
    brake: {unit:"%",fixed:[0,100],series:[["brake","Brake","#ef1824"]]},
    rpm: {unit:"rpm",series:[["rpm","RPM","#ffd329"],["shiftRpm","Shift","#ef1824"]]},
    gear: {unit:"",fixed:[-1,8],discreteGear:true,series:[["gear","Gear","#22a8ff"]]},
    steering: {unit:"°",series:[["steer","Steering","#22a8ff"]]},
    steeringTorque: {unit:"Nm",series:[["steeringTorque","Torque","#a884ff"]]},
    delta: {unit:"s",series:[["delta","Delta","#ef1824"]]},
    gforce: {unit:"g",series:[["gLat","Lat G","#22a8ff"],["gLong","Long G","#ef1824"]]},
    fuel: {unit:"L",series:[["fuel","Fuel","#ffd329"]]},
    fuelUse: {unit:"L/h",series:[["fuelUsePerHour","Fuel/h","#ff9f43"]]},
    tyres: {unit:"°C",series:[["tyreFL","FL","#ef1824"],["tyreFR","FR","#22a8ff"],["tyreRL","RL","#31d878"],["tyreRR","RR","#ffd329"]]},
    temps: {unit:"°C",series:[["waterTemp","Water","#22a8ff"],["oilTemp","Oil","#ffd329"],["trackTemp","Track","#ef1824"],["airTemp","Air","#31d878"]]},
    attitude: {unit:"°/s",series:[["yawRate","Yaw","#ef1824"],["pitchRate","Pitch","#22a8ff"],["rollRate","Roll","#31d878"]]},
    systems: {unit:"level",fixed:[0,2],series:[["tc","TC","#31d878"],["abs","ABS","#ef1824"]]},
    clutch: {unit:"%",fixed:[0,100],series:[["clutch","Clutch","#ffd329"]]},
    brakeBias: {unit:"%",series:[["brakeBias","Bias","#ff9f43"]]},
    environment: {unit:"",series:[["humidity","Humidity %","#22a8ff"],["windSpeed","Wind","#31d878"]]},
    pressure: {unit:"",series:[["oilPressure","Oil Pressure","#ffd329"],["voltage","Voltage","#22a8ff"]]}
  },

  pos(sample,index,total){
    const p=Number(sample?._p);
    if(Number.isFinite(p)) return Math.max(0,Math.min(1,p));
    const raw=Number(sample?.position);
    if(Number.isFinite(raw)) return Math.max(0,Math.min(1,raw/100));
    return total>1?index/(total-1):0;
  },

  setTelemetry(samples){ this.telemetry=Array.isArray(samples)?samples:[]; this.drawAll(); },
  setReference(samples,profile=[]){
    this.reference=Array.isArray(samples)?samples:[];
    this.comparisonProfile=Array.isArray(profile)?profile:[];
    this.drawAll();
  },
  setCompare(a,b){ this.compareA=Array.isArray(a)?a:[]; this.compareB=Array.isArray(b)?b:[]; this.drawAll(); },
  setZoom(start,end){
    let a=Math.max(0,Math.min(1,Number(start))),b=Math.max(0,Math.min(1,Number(end)));
    if(!Number.isFinite(a))a=0;if(!Number.isFinite(b))b=1;
    if(b-a<.01){b=Math.min(1,a+.01);a=Math.max(0,b-.01);}
    this.zoomStart=Math.min(a,b);this.zoomEnd=Math.max(a,b);
    this.drawAll();
  },
  setCursorCallback(fn){ this.cursorCallback=typeof fn==="function"?fn:null; },
  setCompareCursorCallback(fn){ this.compareCursorCallback=typeof fn==="function"?fn:null; },
  setExternalCursor(pos){
    const p=Number(pos);this.cursorPos=Number.isFinite(p)?Math.max(0,Math.min(1,p)):null;this.scheduleDraw();
  },
  setCompareExternalCursors(a,b){
    const pa=Number(a),pb=Number(b);
    this.compareCursorA=Number.isFinite(pa)?Math.max(0,Math.min(1,pa)):null;
    this.compareCursorB=Number.isFinite(pb)?Math.max(0,Math.min(1,pb)):null;
    if(this.compareCursorA!==null||this.compareCursorB!==null)this.cursorPos=null;
    this.scheduleDraw();
  },
  clearCursor(){this.cursorPos=null;this.compareCursorA=null;this.compareCursorB=null;this.scheduleDraw();},
  scheduleDraw(){
    if(this.redrawFrame)return;
    this.redrawFrame=requestAnimationFrame(()=>{this.redrawFrame=null;this.drawAll();});
  },

  numeric(source,key){
    const out=[],data=source||[];
    const step=Math.max(1,Math.floor(data.length/1600));
    for(let i=0;i<data.length;i+=step){
      const s=data[i],v=Number(s?.[key]),p=this.pos(s,i,data.length);
      if(Number.isFinite(v)&&p>=this.zoomStart&&p<=this.zoomEnd)out.push({v,p,s,index:i});
    }
    const last=data.length-1;
    if(last>=0&&last%step!==0){
      const s=data[last],v=Number(s?.[key]),p=this.pos(s,last,data.length);
      if(Number.isFinite(v)&&p>=this.zoomStart&&p<=this.zoomEnd)out.push({v,p,s,index:last});
    }
    return out;
  },

  mapX(p,plot){ return plot.left+((p-this.zoomStart)/(this.zoomEnd-this.zoomStart))*plot.w; },

  extent(spec){
    if(spec.fixed)return spec.fixed;
    const vals=[];
    for(const [key] of spec.series){
      for(const p of this.numeric(this.telemetry,key))vals.push(p.v);
      for(const p of this.numeric(this.reference,key))vals.push(p.v);
    }
    if(!vals.length)return [0,1];
    let lo=Math.min(...vals),hi=Math.max(...vals);
    if(lo===hi){lo-=1;hi+=1;}
    const pad=(hi-lo)*.08;
    return [lo-pad,hi+pad];
  },

  fmt(v,unit){
    if(!Number.isFinite(Number(v)))return "—";
    const n=Number(v);
    if(unit==="rpm")return Math.round(n).toLocaleString("pt-PT");
    if(unit==="km/h"||unit==="%"||unit==="°C")return n.toFixed(Math.abs(n)>=100?0:1);
    if(unit==="g"||unit==="s"||unit==="Nm")return n.toFixed(3);
    return Math.abs(n)>=100?n.toFixed(0):n.toFixed(2);
  },

  nearest(source,pos){
    const data=source||[];if(!data.length)return null;
    let best=null,dist=Infinity;
    data.forEach((s,i)=>{
      const p=this.pos(s,i,data.length),d=Math.abs(p-pos);
      if(d<dist){dist=d;best=s;}
    });
    return best;
  },

  setupCanvas(canvas){
    const dpr=window.devicePixelRatio||1,w=canvas.clientWidth||600,h=canvas.clientHeight||240;
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    const ctx=canvas.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);
    return {ctx,w,h};
  },

  drawGrid(ctx,w,h,plot){
    ctx.clearRect(0,0,w,h);ctx.fillStyle="#090c10";ctx.fillRect(0,0,w,h);
    ctx.strokeStyle="#202731";ctx.lineWidth=1;
    for(let i=0;i<=4;i++){
      const y=plot.top+plot.h*i/4;ctx.beginPath();ctx.moveTo(plot.left,y);ctx.lineTo(plot.left+plot.w,y);ctx.stroke();
    }
    for(let i=0;i<=5;i++){
      const x=plot.left+plot.w*i/5;ctx.beginPath();ctx.moveTo(x,plot.top);ctx.lineTo(x,plot.top+plot.h);ctx.stroke();
    }
  },

  gearLabel(v){
    const n=Math.round(Number(v));
    if(n===-1)return "R";
    if(n===0)return "N";
    return n>=1&&n<=8?String(n):"—";
  },

  drawGearGrid(ctx,w,h,plot){
    ctx.clearRect(0,0,w,h);ctx.fillStyle="#090c10";ctx.fillRect(0,0,w,h);
    ctx.strokeStyle="#202731";ctx.lineWidth=1;
    for(let gear=-1;gear<=8;gear++){
      const y=plot.top+plot.h-((gear+1)/9)*plot.h;
      ctx.beginPath();ctx.moveTo(plot.left,y);ctx.lineTo(plot.left+plot.w,y);ctx.stroke();
    }
    for(let i=0;i<=5;i++){
      const x=plot.left+plot.w*i/5;
      ctx.beginPath();ctx.moveTo(x,plot.top);ctx.lineTo(x,plot.top+plot.h);ctx.stroke();
    }
  },

  drawSeries(ctx,plot,points,lo,hi,color,dashed=false,width=1.8,stepped=false){
    if(points.length<2)return;
    ctx.save();ctx.strokeStyle=color;ctx.lineWidth=width;ctx.globalAlpha=dashed?.72:1;ctx.setLineDash(dashed?[6,4]:[]);
    ctx.beginPath();
    points.forEach((p,i)=>{
      const x=this.mapX(p.p,plot),y=plot.top+plot.h-((p.v-lo)/(hi-lo))*plot.h;
      if(!i){ctx.moveTo(x,y);return;}
      if(stepped){
        const prev=points[i-1];
        const prevY=plot.top+plot.h-((prev.v-lo)/(hi-lo))*plot.h;
        ctx.lineTo(x,prevY);
        ctx.lineTo(x,y);
      }else{
        ctx.lineTo(x,y);
      }
    });
    ctx.stroke();ctx.restore();
  },

  drawAxes(ctx,plot,lo,hi,spec){
    ctx.fillStyle="#77818d";ctx.font="10px Segoe UI";ctx.textAlign="right";
    if(spec.discreteGear){
      for(let gear=-1;gear<=8;gear++){
        const y=plot.top+plot.h-((gear-lo)/(hi-lo))*plot.h+3;
        ctx.fillText(this.gearLabel(gear),plot.left-7,y);
      }
    }else{
      for(let i=0;i<=4;i++){
        const v=hi-(hi-lo)*i/4,y=plot.top+plot.h*i/4+3;
        ctx.fillText(this.fmt(v,spec.unit),plot.left-7,y);
      }
    }
    ctx.textAlign="center";
    for(let i=0;i<=5;i++){
      const ratio=i/5,pct=(this.zoomStart+(this.zoomEnd-this.zoomStart)*ratio)*100;
      ctx.fillText(pct.toFixed(pct%1?1:0)+"%",plot.left+plot.w*ratio,plot.top+plot.h+18);
    }
    ctx.textAlign="left";ctx.fillStyle="#9aa4b0";ctx.fillText(spec.unit?("Y · "+spec.unit):"Y",plot.left,13);
    ctx.textAlign="right";ctx.fillText("TRACK POSITION",plot.left+plot.w,13);
  },

  drawLegend(ctx,plot,spec){
    let x=plot.left;const y=plot.top+14;ctx.font="10px Segoe UI";ctx.textAlign="left";
    for(const [,label,color] of spec.series){
      ctx.fillStyle=color;ctx.fillRect(x,y-8,12,2);ctx.fillStyle="#b8c0ca";ctx.fillText(label,x+16,y-4);
      x+=ctx.measureText(label).width+42;
    }
    if(this.reference.length){
      ctx.strokeStyle="#dbe2ea";ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(x,y-7);ctx.lineTo(x+16,y-7);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle="#9aa4b0";ctx.fillText("REF",x+21,y-4);
    }
  },

  drawCursor(ctx,plot,spec){
    if(this.cursorPos===null)return;
    if(this.cursorPos<this.zoomStart||this.cursorPos>this.zoomEnd)return;
    const x=this.mapX(this.cursorPos,plot);
    ctx.strokeStyle="#f4f7fb";ctx.globalAlpha=.5;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x,plot.top);ctx.lineTo(x,plot.top+plot.h);ctx.stroke();
    ctx.setLineDash([]);ctx.globalAlpha=1;

    const a=this.nearest(this.telemetry,this.cursorPos),b=this.nearest(this.reference,this.cursorPos);
    const text=[(this.cursorPos*100).toFixed(1)+"%"];
    for(const [key,label] of spec.series.slice(0,2)){
      const av=Number(a?.[key]),bv=Number(b?.[key]);
      if(Number.isFinite(av))text.push("A "+label+" "+(spec.discreteGear?this.gearLabel(av):this.fmt(av,spec.unit)));
      if(Number.isFinite(bv))text.push("R "+label+" "+(spec.discreteGear?this.gearLabel(bv):this.fmt(bv,spec.unit)));
    }
    const label=text.join("   ");ctx.font="10px Segoe UI";const tw=Math.min(plot.w-10,ctx.measureText(label).width+14);
    let bx=x+8;if(bx+tw>plot.left+plot.w)bx=x-tw-8;
    ctx.fillStyle="rgba(5,8,12,.94)";ctx.fillRect(bx,plot.top+24,tw,22);
    ctx.fillStyle="#fff";ctx.textAlign="left";ctx.fillText(label,bx+7,plot.top+39);
  },

  drawTelemetry(canvas,type){
    const spec=this.specs[type]||this.specs.speed,{ctx,w,h}=this.setupCanvas(canvas);
    const plot={left:58,top:25,w:Math.max(40,w-72),h:Math.max(40,h-55)};
    if(spec.discreteGear)this.drawGearGrid(ctx,w,h,plot);
    else this.drawGrid(ctx,w,h,plot);
    const [lo,hi]=this.extent(spec);
    this.drawAxes(ctx,plot,lo,hi,spec);this.drawLegend(ctx,plot,spec);
    let has=false;
    for(const [key,,color] of spec.series){
      const a=this.numeric(this.telemetry,key),b=this.numeric(this.reference,key);
      if(a.length){has=true;this.drawSeries(ctx,plot,a,lo,hi,color,false,1.9,Boolean(spec.discreteGear));}
      if(b.length){has=true;this.drawSeries(ctx,plot,b,lo,hi,color,true,1.35,Boolean(spec.discreteGear));}
    }
    if(!has){ctx.fillStyle="#687381";ctx.font="12px Segoe UI";ctx.textAlign="center";ctx.fillText("Canal não disponível nesta volta",plot.left+plot.w/2,plot.top+plot.h/2);}
    this.drawCursor(ctx,plot,spec);
  },

  drawTimeDelta(canvas){
    const {ctx,w,h}=this.setupCanvas(canvas),plot={left:58,top:25,w:Math.max(40,w-72),h:Math.max(40,h-55)};
    this.drawGrid(ctx,w,h,plot);
    const pts=(this.comparisonProfile||[]).map(x=>({p:Number(x.position)/100,v:Number(x.delta)}))
      .filter(x=>Number.isFinite(x.p)&&Number.isFinite(x.v)&&x.p>=this.zoomStart&&x.p<=this.zoomEnd);
    let maxAbs=pts.length?Math.max(...pts.map(x=>Math.abs(x.v))):1;if(maxAbs<.05)maxAbs=.05;
    const lo=-maxAbs*1.08,hi=maxAbs*1.08,spec={unit:"s"};
    this.drawAxes(ctx,plot,lo,hi,spec);
    const y0=plot.top+plot.h-(0-lo)/(hi-lo)*plot.h;
    ctx.strokeStyle="#a6afba";ctx.globalAlpha=.55;ctx.beginPath();ctx.moveTo(plot.left,y0);ctx.lineTo(plot.left+plot.w,y0);ctx.stroke();ctx.globalAlpha=1;
    for(let i=1;i<pts.length;i++){
      const prev=pts[i-1],cur=pts[i],color=cur.v>0?"#ef1824":"#31d878";
      this.drawSeries(ctx,plot,[prev,cur],lo,hi,color,false,2.4);
    }
    ctx.fillStyle="#31d878";ctx.font="10px Segoe UI";ctx.textAlign="left";ctx.fillText("GAIN",plot.left,plot.top+13);
    ctx.fillStyle="#ef1824";ctx.textAlign="right";ctx.fillText("LOSS",plot.left+plot.w,plot.top+13);
    if(this.cursorPos!==null&&this.cursorPos>=this.zoomStart&&this.cursorPos<=this.zoomEnd){
      const x=this.mapX(this.cursorPos,plot);
      ctx.strokeStyle="#f4f7fb";ctx.globalAlpha=.5;ctx.setLineDash([4,4]);ctx.beginPath();ctx.moveTo(x,plot.top);ctx.lineTo(x,plot.top+plot.h);ctx.stroke();
      ctx.setLineDash([]);ctx.globalAlpha=1;
      let nearest=null,dist=Infinity;
      for(const p of this.comparisonProfile||[]){
        const pp=Number(p.position)/100,d=Math.abs(pp-this.cursorPos);
        if(d<dist){dist=d;nearest=p;}
      }
      const dv=Number(nearest?.delta);
      const label=(this.cursorPos*100).toFixed(1)+"% · Δ "+(Number.isFinite(dv)?((dv>=0?"+":"")+dv.toFixed(3)+"s"):"—");
      ctx.font="10px Segoe UI";const tw=ctx.measureText(label).width+14;
      let bx=x+8;if(bx+tw>plot.left+plot.w)bx=x-tw-8;
      ctx.fillStyle="rgba(5,8,12,.94)";ctx.fillRect(bx,plot.top+24,tw,22);
      ctx.fillStyle="#fff";ctx.textAlign="left";ctx.fillText(label,bx+7,plot.top+39);
    }
  },

  drawCompareChannel(canvas,key="speed"){
    const specs={
      speed:{unit:"km/h",fixed:null},
      throttle:{unit:"%",fixed:[0,100]},
      brake:{unit:"%",fixed:[0,100]}
    };
    const spec=specs[key]||specs.speed;
    const {ctx,w,h}=this.setupCanvas(canvas),plot={left:58,top:25,w:Math.max(40,w-72),h:Math.max(40,h-55)};
    this.drawGrid(ctx,w,h,plot);
    const a=this.numeric(this.compareA,key),b=this.numeric(this.compareB,key);
    const vals=[...a.map(p=>p.v),...b.map(p=>p.v)];
    let lo,hi;
    if(spec.fixed){[lo,hi]=spec.fixed;}
    else{
      lo=vals.length?Math.min(...vals):0;hi=vals.length?Math.max(...vals):1;
      if(lo===hi){lo-=1;hi+=1;}
      const pad=(hi-lo)*.08;lo-=pad;hi+=pad;
    }
    this.drawAxes(ctx,plot,lo,hi,{unit:spec.unit});
    this.drawSeries(ctx,plot,a,lo,hi,"#ff8a00",false,2.1);
    this.drawSeries(ctx,plot,b,lo,hi,"#2f7fd2",false,2.1);

    if(this.compareCursorA!==null||this.compareCursorB!==null){
      const drawReplayCursor=(p,color)=>{
        if(p===null||p<this.zoomStart||p>this.zoomEnd)return;
        const x=this.mapX(p,plot);
        ctx.save();ctx.strokeStyle=color;ctx.globalAlpha=.9;ctx.lineWidth=1.4;
        ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(x,plot.top);ctx.lineTo(x,plot.top+plot.h);ctx.stroke();ctx.restore();
      };
      drawReplayCursor(this.compareCursorA,"#ff8a00");
      drawReplayCursor(this.compareCursorB,"#2f7fd2");

      const pa=this.compareCursorA,pb=this.compareCursorB;
      const anchor=pa!==null?pa:pb;
      if(anchor!==null&&anchor>=this.zoomStart&&anchor<=this.zoomEnd){
        const av=pa===null?NaN:Number(this.nearest(this.compareA,pa)?.[key]);
        const bv=pb===null?NaN:Number(this.nearest(this.compareB,pb)?.[key]);
        const label="A "+(pa===null?"—":(pa*100).toFixed(1)+"%")+" · "+this.fmt(av,spec.unit)+
          "   REF "+(pb===null?"—":(pb*100).toFixed(1)+"%")+" · "+this.fmt(bv,spec.unit);
        ctx.font="10px Segoe UI";const tw=Math.min(plot.w-10,ctx.measureText(label).width+14);
        const x=this.mapX(anchor,plot);
        let bx=x+8;if(bx+tw>plot.left+plot.w)bx=x-tw-8;
        ctx.fillStyle="rgba(5,8,12,.94)";ctx.fillRect(bx,plot.top+24,tw,22);
        ctx.fillStyle="#fff";ctx.textAlign="left";ctx.fillText(label,bx+7,plot.top+39);
      }
    }else if(this.cursorPos!==null&&this.cursorPos>=this.zoomStart&&this.cursorPos<=this.zoomEnd){
      const x=this.mapX(this.cursorPos,plot);
      ctx.save();ctx.strokeStyle="#fff";ctx.globalAlpha=.55;ctx.setLineDash([5,5]);
      ctx.beginPath();ctx.moveTo(x,plot.top);ctx.lineTo(x,plot.top+plot.h);ctx.stroke();ctx.restore();
      const av=Number(this.nearest(this.compareA,this.cursorPos)?.[key]);
      const bv=Number(this.nearest(this.compareB,this.cursorPos)?.[key]);
      const label=(this.cursorPos*100).toFixed(1)+"% · A "+this.fmt(av,spec.unit)+" · REF "+this.fmt(bv,spec.unit);
      ctx.font="10px Segoe UI";const tw=ctx.measureText(label).width+14;
      let bx=x+8;if(bx+tw>plot.left+plot.w)bx=x-tw-8;
      ctx.fillStyle="rgba(5,8,12,.94)";ctx.fillRect(bx,plot.top+24,tw,22);
      ctx.fillStyle="#fff";ctx.textAlign="left";ctx.fillText(label,bx+7,plot.top+39);
    }
  },

  drawCompare(canvas){ this.drawCompareChannel(canvas,"speed"); },

  attach(canvas){
    if(canvas.dataset.amsBound)return;canvas.dataset.amsBound="1";
    canvas.addEventListener("mousemove",e=>{
      const r=canvas.getBoundingClientRect(),left=58,right=14;
      const local=Math.max(0,Math.min(1,(e.clientX-r.left-left)/(r.width-left-right)));
      this.cursorPos=this.zoomStart+local*(this.zoomEnd-this.zoomStart);
      const isCompare=String(canvas.dataset.trace||"").startsWith("compare");
      if(isCompare){this.compareCursorA=null;this.compareCursorB=null;}
      if(isCompare&&this.compareCursorCallback)this.compareCursorCallback(this.cursorPos);
      else if(this.cursorCallback)this.cursorCallback(this.cursorPos);
      this.scheduleDraw();
    });
    canvas.addEventListener("mouseleave",()=>{
      const isCompare=String(canvas.dataset.trace||"").startsWith("compare");
      if(isCompare&&this.compareCursorCallback)this.compareCursorCallback(null);
      else if(this.cursorCallback)this.cursorCallback(null);
      this.scheduleDraw();
    });
  },

  draw(canvas,type){
    if(!canvas)return;this.attach(canvas);
    if(type==="compare")this.drawCompareChannel(canvas,"speed");
    else if(type==="compareThrottle")this.drawCompareChannel(canvas,"throttle");
    else if(type==="compareBrake")this.drawCompareChannel(canvas,"brake");
    else if(type==="timeDelta")this.drawTimeDelta(canvas);
    else this.drawTelemetry(canvas,type||"speed");
  },

  drawAll(){
    document.querySelectorAll("canvas.trace").forEach(c=>this.draw(c,c.dataset.trace||"speed"));
    this.draw(document.getElementById("dashboardChart"),"speed");
  }
};