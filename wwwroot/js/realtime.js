window.AMSRealtime = {
  phase:0,
  elapsed:1114,
  mode:"mock",
  liveRows:[],
  polling:false,
  nextCloudPoll:0,
  liveCloudAvailable:true,

  set(id,value){
    const e=document.getElementById(id);
    if(e) e.textContent=value;
  },

  applySample(row){
    const p=row?.sample||{};
    const num=(...keys)=>{
      for(const k of keys){
        const v=Number(p[k]);
        if(Number.isFinite(v)) return v;
      }
      return null;
    };

    const speed=num("speed","speedKph","speed_kph");
    const rpm=num("rpm");
    const gear=num("gear");
    const delta=num("delta","lapDelta","lap_delta");
    const fuel=num("fuel","fuelLitres","fuel_l");
    const throttle=num("throttle");
    const brake=num("brake");
    const steer=num("steer","steering","steeringAngle","steering_angle");
    const latG=num("latG","lat_g","lateralG","lateral_g");
    const longG=num("longG","long_g","longitudinalG","longitudinal_g");
    const trackPos=AMSSupabase.samplePosition(p);
    const bestLap=num("bestLap","best_lap","bestLapTime","best_lap_time");
    const lastLap=num("lastLap","last_lap","lastLapTime","last_lap_time");
    const position=num("position","overallPosition","overall_position");
    const classPosition=num("classPosition","class_position");

    const lapText=v=>{
      if(v===null) return null;
      if(v>10000){
        const m=Math.floor(v/60000);
        return m+":"+((v-m*60000)/1000).toFixed(3).padStart(6,"0");
      }
      if(v>60){
        const m=Math.floor(v/60);
        return m+":"+(v-m*60).toFixed(3).padStart(6,"0");
      }
      return v.toFixed(3);
    };

    if(bestLap!==null) this.set("bestLap",lapText(bestLap));
    if(lastLap!==null) this.set("lastLap",lapText(lastLap));
    if(position!==null) this.set("position","P"+Math.round(position));
    if(classPosition!==null) this.set("classPosition","P"+Math.round(classPosition));
    if(speed!==null) this.set("speed",Math.round(speed));
    if(rpm!==null) this.set("rpm",Math.round(rpm));
    if(gear!==null) this.set("gear",Math.round(gear));
    if(delta!==null) this.set("delta",(delta>=0?"+":"")+delta.toFixed(3));
    if(fuel!==null){ this.set("fuel",fuel.toFixed(1)+" L"); this.set("fuelLaps",(fuel/2.37).toFixed(1)); }
    if(throttle!==null){ this.set("throttlePct",Math.round(throttle)+"%"); const e=document.getElementById("throttleBar"); if(e)e.style.width=Math.max(0,Math.min(100,throttle))+"%"; }
    if(brake!==null){ this.set("brakePct",Math.round(brake)+"%"); const e=document.getElementById("brakeBar"); if(e)e.style.width=Math.max(0,Math.min(100,brake))+"%"; }
    if(steer!==null){ this.set("steerDeg",(steer>=0?"+":"")+steer.toFixed(0)+"°"); const e=document.getElementById("steerBar"); if(e)e.style.width=Math.max(0,Math.min(100,50+steer*2))+"%"; }
    if(latG!==null) this.set("latG",(latG>=0?"+":"")+latG.toFixed(2));
    if(longG!==null) this.set("longG",(longG>=0?"+":"")+longG.toFixed(2));

    const d=document.getElementById("delta");
    if(d && delta!==null){
      d.classList.toggle("green",delta<=0);
      d.classList.toggle("red",delta>0);
    }

    if(trackPos!==null){
      AMSTrack.progress=trackPos;
      AMSTrack.setPosition(trackPos);
    }

    if(row?.circuit && document.getElementById("trackName")?.textContent!==row.circuit){
      this.set("trackName",row.circuit);
    }
    if(row?.car) this.set("carName",row.car);
    if(row?.simulator) this.set("simName",row.simulator);
  },

  renderCloudTiming(rows){
    const body=document.getElementById("timingBody");
    if(!body || !Array.isArray(rows) || !rows.length) return;

    const get=(p,...keys)=>{
      for(const k of keys){
        const v=p?.[k];
        if(v!==undefined && v!==null && v!=="") return v;
      }
      return null;
    };

    const lapText=v=>{
      const n=Number(v);
      if(!Number.isFinite(n)) return v ?? "—";
      if(n>10000){
        const m=Math.floor(n/60000);
        return m+":"+((n-m*60000)/1000).toFixed(3).padStart(6,"0");
      }
      if(n>60){
        const m=Math.floor(n/60);
        return m+":"+(n-m*60).toFixed(3).padStart(6,"0");
      }
      return n.toFixed(3);
    };

    const mapped=rows.map((row,i)=>{
      const p=row.sample||{};
      return {
        row,p,
        pos:Number(get(p,"position","overallPosition","overall_position")) || i+1,
        cls:Number(get(p,"classPosition","class_position")) || null,
        name:get(p,"driverName","driver_name","name") || (row.pilot_id===AMSAuth.user?.id?"Tu":"AMS Pilot"),
        number:get(p,"carNumber","car_number","number") || "",
        lap:get(p,"lap","lapNumber","lap_number") ?? "—",
        last:get(p,"lastLap","last_lap","lastLapTime","last_lap_time"),
        best:get(p,"bestLap","best_lap","bestLapTime","best_lap_time"),
        delta:get(p,"delta","lapDelta","lap_delta"),
        gap:get(p,"gap","gapToLeader","gap_to_leader"),
        fuel:get(p,"fuel","fuelLitres","fuel_l"),
        stint:get(p,"stint","stintLap","stint_lap")
      };
    }).sort((a,b)=>a.pos-b.pos);

    body.innerHTML="";
    for(const d of mapped){
      const tr=document.createElement("tr");
      if(d.row.pilot_id===AMSAuth.user?.id) tr.classList.add("focus-row");
      const deltaNum=Number(d.delta);
      const deltaText=d.delta===null||d.delta===undefined?"—":(Number.isFinite(deltaNum)?((deltaNum>=0?"+":"")+deltaNum.toFixed(3)):String(d.delta));
      tr.innerHTML=`<td><strong>${d.pos}</strong></td><td>${d.cls?"P"+d.cls:"—"}</td><td><strong>${d.name}</strong><br><small>${d.number?("#"+String(d.number).replace("#","")):""}</small></td><td>${d.row.car||"—"}</td><td>${d.lap}</td><td>${d.last!=null?lapText(d.last):"—"}</td><td>${d.best!=null?lapText(d.best):"—"}</td><td class="${Number.isFinite(deltaNum)?(deltaNum<=0?"green":"red"):""}">${deltaText}</td><td>${d.gap??"—"}</td><td>${d.fuel!=null?Number(d.fuel).toFixed(1)+" L":"—"}</td><td>${d.stint??"—"}</td>`;
      body.appendChild(tr);
    }
  },

  clearRealData(message="SEM LIVE CLOUD"){
    const ids=["bestLap","lastLap","position","classPosition","speed","rpm","gear","delta","fuel","fuelLaps","throttlePct","brakePct","steerDeg","latG","longG","tireFL","tireFR","tireRL","tireRR"];
    ids.forEach(id=>this.set(id,"—"));
    for(const id of ["throttleBar","brakeBar","steerBar"]){
      const e=document.getElementById(id);
      if(e)e.style.width="0%";
    }
    const c=document.getElementById("connectionText");
    if(c)c.textContent=message;
  },

  async pollCloud(){
    if(this.polling || !AMSAuth.user?.id || !this.liveCloudAvailable) return;
    this.polling=true;
    try{
      const token=await AMSAuth.token();
      if(!token) return;

      const rows=await AMSSupabase.getLiveSessions(token,AMSAuth.user.id);
      const fresh=(rows||[]).filter(r=>AMSSupabase.fresh(r));

      if(fresh.length){
        this.mode="cloud";
        this.liveRows=fresh;
        const own=fresh.find(r=>r.pilot_id===AMSAuth.user.id)||fresh[0];
        this.applySample(own);
        AMSTrack.renderCars(fresh,AMSAuth.user.id);
        this.renderCloudTiming(fresh);

        const c=document.getElementById("connectionText");
        if(c) c.textContent="SUPABASE LIVE";

        const top=document.querySelector(".live-badge");
        if(top) top.title="Dados cloud AMS Telemetry";
      }else{
        this.mode="offline";
        this.liveRows=[];
        this.clearRealData("SEM LIVE CLOUD");
      }
    }catch(err){
      this.mode="offline";
      this.liveRows=[];
      const msg=String(err?.message||err||"Erro Supabase");
      if(msg.includes("ams_live_sessions") && /not find|does not exist|relation/i.test(msg)){
        this.liveCloudAvailable=false;
        this.clearRealData("LIVE CLOUD NÃO CONFIGURADO");
      }else{
        this.clearRealData("CLOUD: "+msg.slice(0,48));
      }
      const c=document.getElementById("connectionText");
      if(c)c.title=msg;
      console.warn("AMS Supabase live:",err);
    }finally{
      this.polling=false;
    }
  },

  mockTick(){
    this.phase+=.16;
    this.elapsed+=.25;

    const speed=Math.round(232+Math.sin(this.phase)*38);
    const rpm=Math.round(7050+Math.sin(this.phase*1.27)*1150);
    const gear=Math.max(2,Math.min(6,Math.round(speed/48)));
    const delta=-.18+Math.sin(this.phase*.34)*.15;
    const fuel=Math.max(0,31.8-this.phase*.012);
    const throttle=Math.max(0,Math.min(100,Math.round(62+Math.sin(this.phase*.9)*38)));
    const brake=Math.max(0,Math.round((Math.max(0,Math.sin(this.phase*.63-1.4))**5)*100));
    const steer=Math.round(Math.sin(this.phase*.72)*18);
    const latG=Math.sin(this.phase*.68)*1.65;
    const longG=(throttle/100)*.8-(brake/100)*1.8;

    this.set("speed",speed); this.set("rpm",rpm); this.set("gear",gear);
    this.set("delta",(delta>=0?"+":"")+delta.toFixed(3));
    this.set("fuel",fuel.toFixed(1)+" L"); this.set("fuelLaps",(fuel/2.37).toFixed(1));
    this.set("throttlePct",throttle+"%"); this.set("brakePct",brake+"%");
    this.set("steerDeg",(steer>=0?"+":"")+steer+"°");
    this.set("latG",(latG>=0?"+":"")+latG.toFixed(2));
    this.set("longG",(longG>=0?"+":"")+longG.toFixed(2));
    this.set("tireFL",Math.round(86+Math.sin(this.phase*.18)*3)+"°");
    this.set("tireFR",Math.round(88+Math.sin(this.phase*.21)*3)+"°");
    this.set("tireRL",Math.round(82+Math.sin(this.phase*.17)*2)+"°");
    this.set("tireRR",Math.round(84+Math.sin(this.phase*.19)*2)+"°");

    const fmt=t=>{const h=Math.floor(t/3600),m=Math.floor((t%3600)/60),s=Math.floor(t%60);return [h,m,s].map(x=>String(x).padStart(2,"0")).join(":")};
    this.set("sessionTime",fmt(this.elapsed)); this.set("liveRaceTime",fmt(this.elapsed).slice(3));

    const d=document.getElementById("delta");
    if(d){d.classList.toggle("green",delta<=0);d.classList.toggle("red",delta>0)}
    const throttleBar=document.getElementById("throttleBar"); if(throttleBar) throttleBar.style.width=throttle+"%";
    const brakeBar=document.getElementById("brakeBar"); if(brakeBar) brakeBar.style.width=brake+"%";
    const steerBar=document.getElementById("steerBar"); if(steerBar) steerBar.style.width=(50+steer*2)+"%";
    AMSTrack.tick();
  },

  start(){
    setInterval(()=>{
      const now=Date.now();
      if(now>=this.nextCloudPoll){
        this.nextCloudPoll=now+AMS_CONFIG.livePollMs;
        this.pollCloud();
      }

      if(this.mode==="mock" && !AMSAuth.user?.id) this.mockTick();
      else if(this.mode==="cloud"){
        this.elapsed+=.25;
        const fmt=t=>{const h=Math.floor(t/3600),m=Math.floor((t%3600)/60),s=Math.floor(t%60);return [h,m,s].map(x=>String(x).padStart(2,"0")).join(":")};
        this.set("sessionTime",fmt(this.elapsed)); this.set("liveRaceTime",fmt(this.elapsed).slice(3));
      }

      if(Math.round(this.phase*10)%4===0) AMSCharts.drawAll(this.phase);
    },250);
  }
};
