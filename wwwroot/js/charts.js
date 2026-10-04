window.AMSCharts = {
  draw(canvas, type="speed", phase=0){
    if(!canvas) return;
    const dpr=window.devicePixelRatio||1;
    const w=canvas.clientWidth||600, h=canvas.clientHeight||240;
    canvas.width=Math.round(w*dpr); canvas.height=Math.round(h*dpr);
    const ctx=canvas.getContext("2d"); ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.clearRect(0,0,w,h);

    ctx.strokeStyle="#202731"; ctx.lineWidth=1;
    for(let y=0;y<h;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke()}
    for(let x=0;x<w;x+=80){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke()}

    const palette={speed:"#ef1824",throttle:"#31d878",brake:"#ffd329",steering:"#22a8ff",compare:"#ef1824"};
    ctx.strokeStyle=palette[type]||"#ef1824"; ctx.lineWidth=2; ctx.beginPath();

    for(let x=0;x<w;x++){
      let y;
      if(type==="throttle") y=h*.72-Math.abs(Math.sin((x+phase*25)*.022))*h*.52;
      else if(type==="brake") y=h*.82-(Math.max(0,Math.sin((x+phase*20)*.031))**5)*h*.68;
      else if(type==="steering") y=h*.5+Math.sin((x+phase*18)*.024)*h*.27+Math.sin(x*.008)*h*.1;
      else y=h*.55+Math.sin((x+phase*20)*.018)*h*.2+Math.sin(x*.043)*h*.08;
      x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
    }
    ctx.stroke();

    if(type==="compare"){
      ctx.strokeStyle="#22a8ff";ctx.globalAlpha=.8;ctx.beginPath();
      for(let x=0;x<w;x++){
        const y=h*.54+Math.sin((x+16)*.018)*h*.2+Math.sin((x+10)*.043)*h*.08;
        x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);
      }
      ctx.stroke();ctx.globalAlpha=1;
    }
  },
  drawAll(phase=0){
    document.querySelectorAll("canvas.trace").forEach(c=>this.draw(c,c.dataset.trace||"speed",phase));
    this.draw(document.getElementById("dashboardChart"),"speed",phase);
  }
};
