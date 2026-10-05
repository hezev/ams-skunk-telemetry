(()=>{
  const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
  const state={laps:[],pilots:[],selectedId:null,selectedDetail:null,cache:new Map(),isCoach:false,replayTimer:null};

  async function coachFlag(token){
    try{
      const rows=await AMSSupabase.request("/rest/v1/rpc/ams_is_coach",{token,method:"POST",body:{}});
      return rows===true || rows==="true";
    }catch{return false;}
  }

  async function visiblePilots(token,isCoach){
    try{
      if(isCoach){
        return await AMSSupabase.request("/rest/v1/rpc/ams_coach_pilots",{token,method:"POST",body:{}})||[];
      }
      const qs=new URLSearchParams({select:"id,pilot_name,team,created_at",id:"eq."+AMSAuth.user.id,limit:"1"});
      return await AMSSupabase.request("/rest/v1/ams_pilots?"+qs,{token})||[];
    }catch{return [];}
  }

  async function visibleLaps(token,isCoach){
    if(isCoach){
      return await AMSSupabase.request("/rest/v1/rpc/ams_coach_laps",{token,method:"POST",body:{}})||[];
    }
    return await AMSSupabase.getLaps(token,AMSAuth.user.id)||[];
  }

  const fmtLap=ms=>{
    if(ms===null || ms===undefined || ms==="") return "—";
    const n=Number(ms); if(!Number.isFinite(n) || n<=0) return "—";
    const m=Math.floor(n/60000), s=(n-m*60000)/1000;
    return m+":"+s.toFixed(3).padStart(6,"0");
  };

  function switchView(id){
    qa(".view").forEach(v=>v.classList.toggle("active",v.id===id));
    qa("#mainNav button").forEach(b=>b.classList.toggle("active",b.dataset.view===id));
    requestAnimationFrame(()=>AMSCharts.drawAll());
  }

  qa("#mainNav button").forEach(btn=>btn.addEventListener("click",()=>switchView(btn.dataset.view)));

  function setText(id,value){const e=document.getElementById(id); if(e)e.textContent=value;}

  function groupSessions(laps){
    const m=new Map();
    for(const l of laps){
      const k=l.session_id||[l.pilot_id,l.simulator,l.circuit,l.car,l.completed_at?.slice(0,10)].join("|");
      if(!m.has(k))m.set(k,{id:k,sim:l.simulator,track:l.circuit,car:l.car,pilot_id:l.pilot_id,laps:[],last:null,best:null});
      const s=m.get(k); s.laps.push(l);
      if(Number.isFinite(Number(l.lap_time_ms))&&(s.best===null||Number(l.lap_time_ms)<s.best))s.best=Number(l.lap_time_ms);
      const d=l.completed_at?new Date(l.completed_at):null; if(d&&(!s.last||d>s.last))s.last=d;
    }
    return [...m.values()].sort((a,b)=>(b.last?.getTime()||0)-(a.last?.getTime()||0));
  }

  function pilotName(id){
    return state.pilots.find(p=>p.id===id)?.pilot_name || (id===AMSAuth.user?.id ? (AMSAuth.user?.user_metadata?.pilot_name||"Tu") : "Piloto AMS");
  }

  function renderLaps(){
    const body=q("#lapsBody"); if(!body)return; body.innerHTML="";
    if(!state.laps.length){body.innerHTML='<tr><td colspan="7" class="empty-cloud">Nenhuma volta encontrada.</td></tr>';return;}
    for(const l of state.laps){
      const tr=document.createElement("tr"); tr.dataset.lapId=l.id; tr.className="cloud-lap-row"+(l.id===state.selectedId?" focus-row":"");
      tr.innerHTML=`<td><strong>${l.lap_number??"—"}</strong></td><td><strong>${fmtLap(l.lap_time_ms)}</strong></td><td>${l.circuit||"—"}</td><td>${l.car||"—"}</td><td><small>${l.session_id||"—"}</small></td><td>${l.completed_at?new Date(l.completed_at).toLocaleString("pt-PT"):"—"}</td><td>${l.verified?"VERIFIED":"RECORDED"}</td>`;
      tr.addEventListener("click",()=>selectLap(l.id,true));
      body.appendChild(tr);
    }
  }

  function renderSessions(){
    const body=q("#sessionsBody"); if(!body)return; body.innerHTML="";
    const sessions=groupSessions(state.laps);
    if(!sessions.length){body.innerHTML='<tr><td colspan="7" class="empty-cloud">Sem sessões gravadas.</td></tr>';return;}
    for(const s of sessions){
      const tr=document.createElement("tr");
      tr.innerHTML=`<td>${s.last?s.last.toLocaleDateString("pt-PT"):"—"}</td><td>${s.sim||"—"}</td><td>${s.track||"—"}</td><td>${s.car||"—"}</td><td>${s.laps.length}</td><td><strong>${fmtLap(s.best)}</strong></td><td><span class="status done">Complete</span></td>`;
      tr.addEventListener("click",()=>{const best=[...s.laps].sort((a,b)=>a.lap_time_ms-b.lap_time_ms)[0]; if(best)selectLap(best.id,true);});
      body.appendChild(tr);
    }
  }

  function renderRecords(){
    const body=q("#recordsBody"); if(!body)return; body.innerHTML="";
    const best=new Map();
    for(const l of state.laps){
      const k=[l.pilot_id,l.simulator,l.circuit,l.car].join("|");
      if(!best.has(k)||l.lap_time_ms<best.get(k).lap_time_ms)best.set(k,l);
    }
    const rows=[...best.values()].sort((a,b)=>a.lap_time_ms-b.lap_time_ms);
    if(!rows.length){body.innerHTML='<tr><td colspan="5" class="empty-cloud">Sem registos disponíveis.</td></tr>';return;}
    rows.forEach((r,i)=>{const tr=document.createElement("tr");tr.innerHTML=`<td><strong>${i+1}</strong></td><td>${pilotName(r.pilot_id)}</td><td>${r.car||"—"}</td><td>${r.circuit||"—"}</td><td><strong>${fmtLap(r.lap_time_ms)}</strong></td>`;body.appendChild(tr);});
  }

  function renderDriver(){
    const own=state.laps.filter(l=>l.pilot_id===AMSAuth.user?.id);
    const sessions=groupSessions(own).length;
    const tracks=new Set(own.map(l=>l.circuit).filter(Boolean)).size;
    const ordered=[...own].sort((a,b)=>new Date(a.completed_at)-new Date(b.completed_at));
    const best=new Map(); let improvements=0;
    for(const l of ordered){
      const k=[l.simulator,l.circuit,l.car].join("|"), t=Number(l.lap_time_ms);
      if(!best.has(k)){best.set(k,t); improvements++;}
      else if(t<best.get(k)){best.set(k,t); improvements++; }
    }
    setText("driverSessions",sessions); setText("driverLaps",own.length); setText("driverTracks",tracks); setText("driverPBs",improvements);
  }

  function renderTeam(){
    const body=q("#teamBody"); if(!body)return; body.innerHTML="";
    const groups=new Map();
    for(const l of state.laps){
      if(!groups.has(l.pilot_id))groups.set(l.pilot_id,[]);
      groups.get(l.pilot_id).push(l);
    }
    const ids=new Set([...groups.keys()]);
    if(!ids.size){body.innerHTML='<tr><td colspan="5" class="empty-cloud">Sem pilotos com telemetria gravada.</td></tr>';return;}
    for(const id of ids){
      const laps=groups.get(id)||[], profile=state.pilots.find(p=>p.id===id);
      const sessions=groupSessions(laps).length, best=laps.length?Math.min(...laps.map(x=>Number(x.lap_time_ms)).filter(Number.isFinite)):null;
      const tr=document.createElement("tr");
      tr.innerHTML=`<td><strong>${profile?.pilot_name||pilotName(id)}</strong></td><td>${profile?.team||"—"}</td><td>${laps.length}</td><td>${sessions}</td><td>${fmtLap(best)}</td>`;
      body.appendChild(tr);
    }
    setText("teamSubtitle",state.isCoach?"Modo treinador · acesso aos pilotos autorizado por RLS":"Modo piloto · apenas os teus dados privados e referências partilhadas");
  }

  function fillSelectors(){
    const options=state.laps.map(l=>`<option value="${l.id}">#${l.lap_number??"—"} · ${fmtLap(l.lap_time_ms)} · ${l.circuit||""} · ${l.car||""}</option>`).join("");
    for(const id of ["telemetryLapSelect","compareLapA","compareLapB"]){const e=document.getElementById(id);if(e)e.innerHTML=options;}
    if(state.selectedId){const t=q("#telemetryLapSelect");if(t)t.value=state.selectedId;}
    const a=q("#compareLapA"),b=q("#compareLapB");
    if(a&&state.laps[0])a.value=state.laps[0].id;
    if(b&&state.laps[1])b.value=state.laps[1].id;
  }

  async function detail(id){
    if(!id)return null;
    if(state.cache.has(id))return state.cache.get(id);
    const token=await AMSAuth.token(); if(!token)return null;
    let d=null;
    if(state.isCoach){
      const rows=await AMSSupabase.request("/rest/v1/rpc/ams_coach_lap_detail",{token,method:"POST",body:{target_id:id}});
      d=rows?.[0]||null;
    }else{
      d=await AMSSupabase.getLapTelemetry(token,id);
    }
    if(d)state.cache.set(id,d);
    return d;
  }

  function updateWorkspace(){
    const d=state.selectedDetail, samples=d?.telemetry||[];
    setText("workspaceTrack",d?`${d.circuit} · ${d.car}`:"Sem volta selecionada");
    setText("workspaceTiming",d?`Volta #${d.lap_number??"—"} · ${fmtLap(d.lap_time_ms)}`:"Sem volta selecionada");
    setText("workspaceTelemetry",d?`${samples.length.toLocaleString("pt-PT")} amostras · ${samples.length?Object.keys(samples[0]).length:0} canais`:"Sem volta selecionada");
  }

  function updateReplayDerived(d){
    const s=d?.telemetry||[];
    if(!s.length)return;
    const first=s[0], last=s[s.length-1];
    const fuelUsed=Number(first.fuel)-Number(last.fuel);
    if(Number.isFinite(fuelUsed)&&fuelUsed>=0)setText("fuelAverage",fuelUsed.toFixed(2)+" L/lap");
    setText("fuelWindow","N/D");
    setText("trackChip",d.circuit||"—");
    setText("dashboardSubtitle",`Replay disponível · volta #${d.lap_number??"—"} · ${fmtLap(d.lap_time_ms)}`);
  }

  async function selectLap(id,goTelemetry=false){
    const d=await detail(id); if(!d)return;
    state.selectedId=id; state.selectedDetail=d; renderLaps();
    AMSCharts.setTelemetry(d.telemetry||[]);
    setText("telemetryStatus",`${(d.telemetry||[]).length} amostras`);
    const sel=q("#telemetryLapSelect"); if(sel)sel.value=id;
    setText("simName",d.simulator||"—"); setText("trackName",d.circuit||"—"); setText("carName",d.car||"—");
    AMSTrack.load(d.circuit||"");
    updateWorkspace(); updateReplayDerived(d);
    if(goTelemetry)switchView("telemetry");
  }

  function renderReplayTiming(d,sample){
    const body=q("#timingBody"); if(!body)return;
    const pos=sample?.positionOverall??sample?.position??"—", cls=sample?.positionClass??"—";
    body.innerHTML=`<tr class="focus-row"><td><strong>${pos}</strong></td><td>${cls==="—"?"—":"P"+cls}</td><td><strong>${pilotName(d.pilot_id)}</strong><br><small>REPLAY</small></td><td>${d.car||"—"}</td><td>${d.lap_number??"—"}</td><td>${fmtLap(d.lap_time_ms)}</td><td>${fmtLap(sample?.bestLapTime*1000)}</td><td>${Number.isFinite(Number(sample?.delta))?Number(sample.delta).toFixed(3):"—"}</td><td>—</td><td>${Number.isFinite(Number(sample?.fuel))?Number(sample.fuel).toFixed(1)+" L":"—"}</td><td>—</td></tr>`;
  }

  async function startReplay(){
    if(!state.selectedDetail&&state.laps[0])await selectLap(state.laps[0].id);
    const d=state.selectedDetail, samples=d?.telemetry||[]; if(!samples.length)return;
    if(state.replayTimer){clearInterval(state.replayTimer);state.replayTimer=null;}
    AMSRealtime.mode="replay";
    const btn=q("#replayBtn"); if(btn)btn.textContent="■ Parar replay";
    const liveBtn=q("#simulateLiveBtn"); if(liveBtn)liveBtn.textContent="■ Parar simulação";
    setText("connectionText","REPLAY SUPABASE"); setText("liveBadgeText","REPLAY");
    setText("liveTrack",d.circuit||"—"); setText("liveCars","1"); setText("liveGap","—");
    let i=0; const duration=Math.max(1,Number(d.lap_time_ms)/1000), step=Math.max(1,Math.round(samples.length/(duration*20)));
    state.replayTimer=setInterval(()=>{
      const s=samples[i]; if(!s){stopReplay();return;}
      AMSRealtime.applySample({sample:s,circuit:d.circuit,car:d.car,simulator:d.simulator});
      const t=Number(s.t); if(Number.isFinite(t))setText("sessionTime",t.toFixed(1)+"s");
      setText("liveRaceTime",Number.isFinite(t)?t.toFixed(1)+"s":"—");
      setText("liveFlag",s.flagText||"—"); setText("lapStateChip","REPLAY");
      renderReplayTiming(d,s); i+=step;
    },50);
  }

  function stopReplay(){
    if(state.replayTimer)clearInterval(state.replayTimer); state.replayTimer=null;
    AMSRealtime.mode="offline";
    const btn=q("#replayBtn"); if(btn)btn.textContent="▶ Replay volta";
    const liveBtn=q("#simulateLiveBtn"); if(liveBtn)liveBtn.textContent="▶ Simular com volta gravada";
    setText("connectionText","SUPABASE ACCOUNT"); setText("liveBadgeText","OFFLINE"); setText("lapStateChip","SEM LIVE");
  }

  async function compare(){
    const aId=q("#compareLapA")?.value,bId=q("#compareLapB")?.value;
    const [a,b]=await Promise.all([detail(aId),detail(bId)]); if(!a||!b)return;
    setText("compareTimeA",fmtLap(a.lap_time_ms)); setText("compareTimeB",fmtLap(b.lap_time_ms));
    const diff=Number(b.lap_time_ms)-Number(a.lap_time_ms); setText("compareDiff",(diff>=0?"+":"")+(diff/1000).toFixed(3)+"s");
    const compatible=a.simulator===b.simulator&&a.circuit===b.circuit&&a.car===b.car;
    setText("compareCompatibility",compatible?"MATCH":"DIFFERENT");
    setText("compareNote",compatible?"Mesma combinação":"Pista/carro/simulador diferentes");
    AMSCharts.setCompare(a.telemetry||[],b.telemetry||[]);
  }

  function initWorkspace(){
    let saved={}; try{saved=JSON.parse(localStorage.getItem("ams_workspace")||"{}");}catch{}
    qa("[data-widget]").forEach(cb=>{
      if(saved[cb.dataset.widget]===false)cb.checked=false;
      const apply=()=>{const w=q('[data-workspace-widget="'+cb.dataset.widget+'"]');if(w)w.hidden=!cb.checked;saved[cb.dataset.widget]=cb.checked;localStorage.setItem("ams_workspace",JSON.stringify(saved));};
      cb.addEventListener("change",apply);apply();
    });
  }

  async function loadCloud(){
    if(!AMSAuth.user?.id)return;
    const token=await AMSAuth.token(); if(!token)return;
    try{
      state.isCoach=await coachFlag(token);
      state.laps=await visibleLaps(token,state.isCoach);
      state.pilots=await visiblePilots(token,state.isCoach);
      renderLaps();renderSessions();renderRecords();renderDriver();renderTeam();fillSelectors();
      if(state.laps.length)await selectLap(state.laps[0].id);
      setText("connectionText",state.isCoach?"COACH · SUPABASE":"SUPABASE ACCOUNT"); setText("liveBadgeText","OFFLINE");
    }catch(err){
      console.warn("AMS portal data:",err); setText("connectionText","SUPABASE ERROR");
      const body=q("#lapsBody");if(body)body.innerHTML='<tr><td colspan="7" class="error-cloud">Erro: '+String(err.message||err)+'</td></tr>';
    }
  }

  q("#telemetryLapSelect")?.addEventListener("change",e=>selectLap(e.target.value));
  q("#compareBtn")?.addEventListener("click",compare);
  q("#replayBtn")?.addEventListener("click",()=>state.replayTimer?stopReplay():startReplay());
  q("#simulateLiveBtn")?.addEventListener("click",()=>{switchView("live");state.replayTimer?stopReplay():startReplay();});

  window.addEventListener("resize",()=>{AMSCharts.drawAll();AMSTrack.setPosition(AMSTrack.progress);});
  document.addEventListener("ams-auth-changed",e=>{if(e.detail?.user)loadCloud();else stopReplay();});

  initWorkspace();
  AMSAuth.init();
  const probe=setInterval(()=>{if(AMSAuth.user?.id){clearInterval(probe);loadCloud();}},250);
  setTimeout(()=>clearInterval(probe),5000);
  AMSRealtime.start();
})();