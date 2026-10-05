window.AMSCharts = {
  telemetry: [],
  compareA: [],
  compareB: [],
  setTelemetry(samples){ this.telemetry = Array.isArray(samples) ? samples : []; this.drawAll(); },
  setCompare(a,b){ this.compareA = Array.isArray(a) ? a : []; this.compareB = Array.isArray(b) ? b : []; this.drawAll(); },
  valuesFor(type, source){
    const data = source || this.telemetry;
    const key = ({speed:"speed",throttle:"throttle",brake:"brake",steering:"steer"})[type] || type;
    const out=[];
    for(const s of data||[]){ const v=Number(s&&s[key]); if(Number.isFinite(v)) out.push(v); }
    return out;
  },
  drawSeries(ctx,w,h,values,stroke,alpha){
    if(!values.length) return;
    let min=Math.min.apply(null,values), max=Math.max.apply(null,values);
    if(min===max){ min-=1; max+=1; }
    ctx.save(); ctx.strokeStyle=stroke; ctx.globalAlpha=alpha==null?1:alpha; ctx.lineWidth=2; ctx.beginPath();
    const last=Math.max(1,values.length-1);
    values.forEach((v,i)=>{ const x=i/last*w, y=h-(v-min)/(max-min)*h; i?ctx.lineTo(x,y):ctx.moveTo(x,y); });
    ctx.stroke(); ctx.restore();
  },
  draw(canvas,type){
    if(!canvas) return;
    type=type||"speed";
    const dpr=window.devicePixelRatio||1, w=canvas.clientWidth||600, h=canvas.clientHeight||240;
    canvas.width=Math.round(w*dpr); canvas.height=Math.round(h*dpr);
    const ctx=canvas.getContext("2d"); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
    ctx.strokeStyle="#202731"; ctx.lineWidth=1;
    for(let y=0;y<h;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();}
    for(let x=0;x<w;x+=80){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();}
    if(type==="compare"){
      this.drawSeries(ctx,w,h,this.valuesFor("speed",this.compareA),"#ef1824",1);
      this.drawSeries(ctx,w,h,this.valuesFor("speed",this.compareB),"#22a8ff",.9);
      return;
    }
    const colors={speed:"#ef1824",throttle:"#31d878",brake:"#ffd329",steering:"#22a8ff"};
    const vals=this.valuesFor(type);
    if(vals.length) this.drawSeries(ctx,w,h,vals,colors[type]||"#ef1824",1);
    else { ctx.fillStyle="#66717e"; ctx.font="11px Segoe UI"; ctx.textAlign="center"; ctx.fillText("Sem dados para este canal",w/2,h/2); }
  },
  drawAll(){
    document.querySelectorAll("canvas.trace").forEach(c=>this.draw(c,c.dataset.trace||"speed"));
    this.draw(document.getElementById("dashboardChart"),"speed");
  }
};