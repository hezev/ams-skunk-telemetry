window.AMSCharts = {
  telemetry: [],
  compareA: [],
  compareB: [],
  cursorRatio: null,

  specs: {
    speed: {title:"Speed",unit:"km/h",series:[["speed","Speed","#ef1824"]]},
    throttle: {title:"Throttle",unit:"%",fixed:[0,100],series:[["throttle","Throttle","#31d878"]]},
    brake: {title:"Brake",unit:"%",fixed:[0,100],series:[["brake","Brake","#ef1824"]]},
    rpm: {title:"RPM",unit:"rpm",series:[["rpm","RPM","#ffd329"],["shiftRpm","Shift","#ef1824"]]},
    gear: {title:"Gear",unit:"",fixed:[-1,8],series:[["gear","Gear","#22a8ff"]]},
    steering: {title:"Steering",unit:"°",series:[["steer","Steering","#22a8ff"]]},
    steeringTorque: {title:"Steering Torque",unit:"Nm",series:[["steeringTorque","Torque","#a884ff"]]},
    delta: {title:"Delta",unit:"s",series:[["delta","Delta","#ef1824"]]},
    gforce: {title:"G Forces",unit:"g",series:[["gLat","Lat G","#22a8ff"],["gLong","Long G","#ef1824"]]},
    fuel: {title:"Fuel",unit:"L",series:[["fuel","Fuel","#ffd329"]]},
    fuelUse: {title:"Fuel Use",unit:"L/h",series:[["fuelUsePerHour","Fuel/h","#ff9f43"]]},
    tyres: {title:"Tyre Temperatures",unit:"°C",series:[["tyreFL","FL","#ef1824"],["tyreFR","FR","#22a8ff"],["tyreRL","RL","#31d878"],["tyreRR","RR","#ffd329"]]},
    temps: {title:"Temperatures",unit:"°C",series:[["waterTemp","Water","#22a8ff"],["oilTemp","Oil","#ffd329"],["trackTemp","Track","#ef1824"],["airTemp","Air","#31d878"]]},
    attitude: {title:"Body Rates",unit:"°/s",series:[["yawRate","Yaw","#ef1824"],["pitchRate","Pitch","#22a8ff"],["rollRate","Roll","#31d878"]]},
    systems: {title:"Driver Aids / Clutch",unit:"%",series:[["clutch","Clutch","#ffd329"],["tc","TC","#31d878"],["abs","ABS","#ef1824"]]},
    brakeBias: {title:"Brake Bias",unit:"%",series:[["brakeBias","Bias","#ff9f43"]]},
    environment: {title:"Environment",unit:"",series:[["humidity","Humidity %","#22a8ff"],["windSpeed","Wind","#31d878"]]},
    pressure: {title:"Oil / Electrical",unit:"",series:[["oilPressure","Oil Pressure","#ffd329"],["voltage","Voltage","#22a8ff"]]}
  },

  setTelemetry(samples){
    this.telemetry = Array.isArray(samples) ? samples : [];
    this.drawAll();
  },

  setCompare(a,b){
    this.compareA = Array.isArray(a) ? a : [];
    this.compareB = Array.isArray(b) ? b : [];
    this.drawAll();
  },

  xRatio(sample,index,total){
    const p=Number(sample?.position);
    if(Number.isFinite(p) && p>=0 && p<=100) return p/100;
    return total>1 ? index/(total-1) : 0;
  },

  numeric(source,key){
    const out=[];
    (source||[]).forEach((s,i)=>{
      const v=Number(s?.[key]);
      if(Number.isFinite(v)) out.push({v,x:this.xRatio(s,i,source.length),sample:s,index:i});
    });
    return out;
  },

  extent(spec,source){
    if(spec.fixed) return spec.fixed;
    const vals=[];
    for(const [key] of spec.series){
      for(const p of this.numeric(source,key)) vals.push(p.v);
    }
    if(!vals.length) return [0,1];
    let lo=Math.min(...vals), hi=Math.max(...vals);
    if(lo===hi){lo-=1;hi+=1;}
    const pad=(hi-lo)*.08;
    return [lo-pad,hi+pad];
  },

  fmt(v,unit){
    if(!Number.isFinite(Number(v))) return "—";
    const n=Number(v);
    if(unit==="rpm") return Math.round(n).toLocaleString("pt-PT");
    if(unit==="km/h" || unit==="%" || unit==="°C") return n.toFixed(Math.abs(n)>=100?0:1);
    if(unit==="g" || unit==="s" || unit==="Nm") return n.toFixed(3);
    return Math.abs(n)>=100 ? n.toFixed(0) : n.toFixed(2);
  },

  nearest(source,ratio){
    if(!source?.length) return null;
    let best=source[0],bestD=Infinity;
    for(let i=0;i<source.length;i++){
      const d=Math.abs(this.xRatio(source[i],i,source.length)-ratio);
      if(d<bestD){bestD=d;best=source[i];}
    }
    return best;
  },

  setupCanvas(canvas){
    const dpr=window.devicePixelRatio||1;
    const w=canvas.clientWidth||600,h=canvas.clientHeight||240;
    canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);
    const ctx=canvas.getContext("2d");ctx.setTransform(dpr,0,0,dpr,0,0);
    return {ctx,w,h};
  },

  drawGrid(ctx,w,h,plot){
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle="#090c10";ctx.fillRect(0,0,w,h);
    ctx.strokeStyle="#202731";ctx.lineWidth=1;
    for(let i=0;i<=4;i++){
      const y=plot.top+(plot.h*i/4);
      ctx.beginPath();ctx.moveTo(plot.left,y);ctx.lineTo(plot.left+plot.w,y);ctx.stroke();
    }
    for(let i=0;i<=4;i++){
      const x=plot.left+(plot.w*i/4);
      ctx.beginPath();ctx.moveTo(x,plot.top);ctx.lineTo(x,plot.top+plot.h);ctx.stroke();
    }
  },

  drawSeries(ctx,plot,points,lo,hi,color){
    if(points.length<2)return;
    ctx.strokeStyle=color;ctx.lineWidth=1.8;ctx.beginPath();
    points.forEach((p,i)=>{
      const x=plot.left+p.x*plot.w;
      const y=plot.top+plot.h-((p.v-lo)/(hi-lo))*plot.h;
      i?ctx.lineTo(x,y):ctx.moveTo(x,y);
    });
    ctx.stroke();
  },

  drawAxes(ctx,plot,lo,hi,spec){
    ctx.fillStyle="#77818d";ctx.font="10px Segoe UI";ctx.textAlign="right";
    for(let i=0;i<=4;i++){
      const v=hi-(hi-lo)*i/4;
      const y=plot.top+plot.h*i/4+3;
      ctx.fillText(this.fmt(v,spec.unit),plot.left-7,y);
    }
    ctx.textAlign="center";
    for(let i=0;i<=4;i++){
      const x=plot.left+plot.w*i/4;
      ctx.fillText((i*25)+"%",x,plot.top+plot.h+18);
    }
    ctx.textAlign="left";ctx.fillStyle="#9aa4b0";
    ctx.fillText(spec.unit?("Y · "+spec.unit):"Y",plot.left,13);
    ctx.textAlign="right";ctx.fillText("TRACK POSITION",plot.left+plot.w,13);
  },

  drawLegend(ctx,plot,spec){
    let x=plot.left;
    const y=plot.top+14;
    ctx.font="10px Segoe UI";ctx.textAlign="left";
    for(const [,label,color] of spec.series){
      ctx.fillStyle=color;ctx.fillRect(x,y-8,12,2);
      ctx.fillStyle="#b8c0ca";ctx.fillText(label,x+16,y-4);
      x+=ctx.measureText(label).width+42;
    }
  },

  drawCursor(ctx,plot,source,spec){
    if(this.cursorRatio===null || !source?.length)return;
    const x=plot.left+this.cursorRatio*plot.w;
    ctx.strokeStyle="#e9eef5";ctx.globalAlpha=.45;ctx.setLineDash([4,4]);
    ctx.beginPath();ctx.moveTo(x,plot.top);ctx.lineTo(x,plot.top+plot.h);ctx.stroke();
    ctx.setLineDash([]);ctx.globalAlpha=1;

    const s=this.nearest(source,this.cursorRatio);
    if(!s)return;
    const values=[];
    for(const [key,label] of spec.series){
      const v=Number(s[key]); if(Number.isFinite(v))values.push(label+" "+this.fmt(v,spec.unit));
    }
    const pos=Number(s.position);
    const t=Number(s.t);
    const header=[Number.isFinite(pos)?pos.toFixed(1)+"%":null,Number.isFinite(t)?t.toFixed(2)+"s":null].filter(Boolean).join(" · ");
    const text=[header,...values].filter(Boolean).join("   ");
    ctx.font="10px Segoe UI";
    const tw=ctx.measureText(text).width+14;
    let bx=x+8;if(bx+tw>plot.left+plot.w)bx=x-tw-8;
    ctx.fillStyle="rgba(5,8,12,.92)";ctx.fillRect(bx,plot.top+25,tw,22);
    ctx.fillStyle="#fff";ctx.textAlign="left";ctx.fillText(text,bx+7,plot.top+40);
  },

  drawTelemetry(canvas,type){
    const spec=this.specs[type]||this.specs.speed;
    const {ctx,w,h}=this.setupCanvas(canvas);
    const plot={left:58,top:25,w:Math.max(40,w-72),h:Math.max(40,h-55)};
    this.drawGrid(ctx,w,h,plot);
    const source=this.telemetry;
    const [lo,hi]=this.extent(spec,source);
    this.drawAxes(ctx,plot,lo,hi,spec);
    this.drawLegend(ctx,plot,spec);

    let has=false;
    for(const [key,,color] of spec.series){
      const pts=this.numeric(source,key);if(pts.length){has=true;this.drawSeries(ctx,plot,pts,lo,hi,color);}
    }
    if(!has){
      ctx.fillStyle="#687381";ctx.font="12px Segoe UI";ctx.textAlign="center";
      ctx.fillText("Canal não disponível nesta volta",plot.left+plot.w/2,plot.top+plot.h/2);
    }
    this.drawCursor(ctx,plot,source,spec);
  },

  drawCompare(canvas){
    const {ctx,w,h}=this.setupCanvas(canvas);
    const plot={left:58,top:25,w:Math.max(40,w-72),h:Math.max(40,h-55)};
    this.drawGrid(ctx,w,h,plot);
    const spec={unit:"km/h"};
    const vals=[...this.numeric(this.compareA,"speed").map(p=>p.v),...this.numeric(this.compareB,"speed").map(p=>p.v)];
    let lo=vals.length?Math.min(...vals):0,hi=vals.length?Math.max(...vals):1;
    if(lo===hi){lo-=1;hi+=1;}const pad=(hi-lo)*.08;lo-=pad;hi+=pad;
    this.drawAxes(ctx,plot,lo,hi,spec);
    this.drawSeries(ctx,plot,this.numeric(this.compareA,"speed"),lo,hi,"#ef1824");
    this.drawSeries(ctx,plot,this.numeric(this.compareB,"speed"),lo,hi,"#22a8ff");
    ctx.font="10px Segoe UI";ctx.textAlign="left";
    ctx.fillStyle="#ef1824";ctx.fillText("LAP A",plot.left,plot.top+12);
    ctx.fillStyle="#22a8ff";ctx.fillText("LAP B",plot.left+55,plot.top+12);
  },

  attach(canvas){
    if(canvas.dataset.amsBound)return;
    canvas.dataset.amsBound="1";
    canvas.addEventListener("mousemove",e=>{
      const r=canvas.getBoundingClientRect();
      const left=58,right=14;
      this.cursorRatio=Math.max(0,Math.min(1,(e.clientX-r.left-left)/(r.width-left-right)));
      this.drawAll();
    });
    canvas.addEventListener("mouseleave",()=>{this.cursorRatio=null;this.drawAll();});
  },

  draw(canvas,type){
    if(!canvas)return;
    this.attach(canvas);
    if(type==="compare")this.drawCompare(canvas);
    else this.drawTelemetry(canvas,type||"speed");
  },

  drawAll(){
    document.querySelectorAll("canvas.trace").forEach(c=>this.draw(c,c.dataset.trace||"speed"));
    this.draw(document.getElementById("dashboardChart"),"speed");
  }
};