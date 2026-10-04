window.AMSRealtime = {
  phase:0,
  start(){
    setInterval(()=>{
      this.phase+=.16;
      const speed=Math.round(232+Math.sin(this.phase)*38);
      const rpm=Math.round(7050+Math.sin(this.phase*1.27)*1150);
      const gear=Math.max(2,Math.min(6,Math.round(speed/48)));
      const delta=(-.18+Math.sin(this.phase*.34)*.15).toFixed(3);
      const fuel=(31.8-this.phase*.012).toFixed(1);

      const set=(id,value)=>{const e=document.getElementById(id);if(e)e.textContent=value};
      set("speed",speed); set("rpm",rpm); set("gear",gear); set("delta",delta); set("fuel",fuel+" L");

      const d=document.getElementById("delta");
      if(d){d.classList.toggle("green",Number(delta)<=0);d.classList.toggle("red",Number(delta)>0)}

      AMSTrack.tick();
      if(Math.round(this.phase*10)%4===0) AMSCharts.drawAll(this.phase);
    },250);
  }
};
