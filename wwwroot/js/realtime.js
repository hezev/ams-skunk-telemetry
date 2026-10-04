window.AMSRealtime = {
  phase:0,
  elapsed:1114,
  start(){
    setInterval(()=>{
      this.phase+=.16;
      this.elapsed+=.25;

      const speed=Math.round(232+Math.sin(this.phase)*38);
      const rpm=Math.round(7050+Math.sin(this.phase*1.27)*1150);
      const gear=Math.max(2,Math.min(6,Math.round(speed/48)));
      const delta=(-.18+Math.sin(this.phase*.34)*.15).toFixed(3);
      const fuel=Math.max(0,31.8-this.phase*.012);
      const throttle=Math.max(0,Math.min(100,Math.round(62+Math.sin(this.phase*.9)*38)));
      const brake=Math.max(0,Math.round((Math.max(0,Math.sin(this.phase*.63-1.4))**5)*100));
      const steer=Math.round(Math.sin(this.phase*.72)*18);
      const latG=(Math.sin(this.phase*.68)*1.65).toFixed(2);
      const longG=((throttle/100)*.8-(brake/100)*1.8).toFixed(2);

      const set=(id,value)=>{const e=document.getElementById(id);if(e)e.textContent=value};
      set("speed",speed); set("rpm",rpm); set("gear",gear); set("delta",delta); set("fuel",fuel.toFixed(1)+" L");
      set("fuelLaps",(fuel/2.37).toFixed(1));
      set("throttlePct",throttle+"%"); set("brakePct",brake+"%"); set("steerDeg",(steer>=0?"+":"")+steer+"°");
      set("latG",(Number(latG)>=0?"+":"")+latG); set("longG",(Number(longG)>=0?"+":"")+longG);
      set("tireFL",Math.round(86+Math.sin(this.phase*.18)*3)+"°");
      set("tireFR",Math.round(88+Math.sin(this.phase*.21)*3)+"°");
      set("tireRL",Math.round(82+Math.sin(this.phase*.17)*2)+"°");
      set("tireRR",Math.round(84+Math.sin(this.phase*.19)*2)+"°");

      const fmt=t=>{const h=Math.floor(t/3600),m=Math.floor((t%3600)/60),s=Math.floor(t%60);return [h,m,s].map(x=>String(x).padStart(2,"0")).join(":")};
      set("sessionTime",fmt(this.elapsed)); set("liveRaceTime",fmt(this.elapsed).slice(3));

      const d=document.getElementById("delta");
      if(d){d.classList.toggle("green",Number(delta)<=0);d.classList.toggle("red",Number(delta)>0)}

      const throttleBar=document.getElementById("throttleBar"); if(throttleBar) throttleBar.style.width=throttle+"%";
      const brakeBar=document.getElementById("brakeBar"); if(brakeBar) brakeBar.style.width=brake+"%";
      const steerBar=document.getElementById("steerBar"); if(steerBar) steerBar.style.width=(50+steer*2)+"%";

      AMSTrack.tick();
      if(Math.round(this.phase*10)%4===0) AMSCharts.drawAll(this.phase);
    },250);
  }
};
