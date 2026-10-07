(()=>{
  const q=s=>document.querySelector(s), qa=s=>[...document.querySelectorAll(s)];
  const state={laps:[],pilots:[],selectedId:null,selectedDetail:null,cache:new Map(),isCoach:false,replayTimer:null,replayCursor:0,replaySpeed:1,analysisLap:null,analysisRef:null,analysisResult:null,miniCount:20,compareTimer:null,compareProgress:0,compareReplayTime:0,compareSpeed:1,compareDetailA:null,compareDetailB:null,compareLapA:null,compareLapB:null,engineerReport:null};

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

  function fillReferenceSelector(){
    const e=q("#telemetryReferenceSelect");if(!e)return;
    const current=state.laps.find(l=>l.id===state.selectedId)||state.selectedDetail;
    const compatible=state.laps
      .filter(l=>current&&l.id!==state.selectedId&&l.simulator===current.simulator&&l.circuit===current.circuit&&l.car===current.car)
      .sort((a,b)=>Number(a.lap_time_ms)-Number(b.lap_time_ms));
    e.innerHTML='<option value="">Sem referência</option>'+compatible.map(l=>`<option value="${l.id}">#${l.lap_number??"—"} · ${fmtLap(l.lap_time_ms)} · ${pilotName(l.pilot_id)}</option>`).join("");
    if(compatible.length)e.value=compatible[0].id;
  }

  function fillEngineerSessionSelector(){
    const e=q("#engineerSessionSelect");if(!e)return;
    const sessions=groupSessions(state.laps).filter(s=>s.laps.length>=2);
    const current=e.value;
    e.innerHTML=sessions.map(s=>`<option value="${s.id}">${s.last?s.last.toLocaleDateString("pt-PT"):"—"} · ${s.track||"—"} · ${s.car||"—"} · ${s.laps.length} laps</option>`).join("");
    if(current&&sessions.some(s=>String(s.id)===String(current)))e.value=current;
    else if(sessions[0])e.value=sessions[0].id;
    setText("engineerStatus",sessions.length?"Pronto para analisar":"São necessárias pelo menos duas voltas na mesma sessão");
  }

  function fillSelectors(){
    const options=state.laps.map(l=>`<option value="${l.id}">#${l.lap_number??"—"} · ${fmtLap(l.lap_time_ms)} · ${l.circuit||""} · ${l.car||""}</option>`).join("");
    for(const id of ["telemetryLapSelect","compareLapA","compareLapB"]){const e=document.getElementById(id);if(e)e.innerHTML=options;}
    if(state.selectedId){const t=q("#telemetryLapSelect");if(t)t.value=state.selectedId;}
    const a=q("#compareLapA"),b=q("#compareLapB");
    if(a&&state.laps[0])a.value=state.laps[0].id;
    if(b&&state.laps[1])b.value=state.laps[1].id;
    fillReferenceSelector();
    fillEngineerSessionSelector();
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

  async function analyzeEngineerSession(){
    const select=q("#engineerSessionSelect");
    const session=groupSessions(state.laps).find(s=>String(s.id)===String(select?.value));
    if(!session){setText("engineerStatus","Sessão não encontrada");return;}

    const btn=q("#engineerAnalyzeBtn");
    if(btn){btn.disabled=true;btn.textContent="A ANALISAR…";}
    setText("engineerStatus","A carregar voltas e evidência…");

    try{
      const candidates=[...session.laps]
        .filter(l=>Number.isFinite(Number(l.lap_time_ms))&&Number(l.lap_time_ms)>0)
        .sort((a,b)=>new Date(a.completed_at||0)-new Date(b.completed_at||0))
        .slice(-20);
      const details=(await Promise.all(candidates.map(l=>detail(l.id)))).filter(Boolean);
      if(details.length<2){
        AMSEngineer.render({ok:false,reason:"São necessárias pelo menos duas voltas completas com telemetria."});
        return;
      }

      await AMSTrack.load(session.track||"","",details[0]?.telemetry||[]);
      const report=AMSEngineer.analyze(details,{
        minisectors:20,
        trackLengthM:Number(AMSTrack.reference?.lengthM)||null,
        session
      });
      state.engineerReport=report;
      AMSEngineer.render(report);
      setText("simName",session.sim||"—");
      setText("trackName",session.track||"—");
      setText("carName",session.car||"—");
    }catch(err){
      console.warn("AMS engineer:",err);
      AMSEngineer.render({ok:false,reason:"Erro na análise: "+String(err.message||err)});
    }finally{
      if(btn){btn.disabled=false;btn.textContent="Analyse Session";}
    }
  }

  function updateWorkspace(){
    const d=state.selectedDetail, samples=d?.telemetry||[];
    setText("workspaceTrack",d?`${d.circuit} · ${d.car}`:"Sem volta selecionada");
    setText("workspaceTiming",d?`Volta #${d.lap_number??"—"} · ${fmtLap(d.lap_time_ms)}`:"Sem volta selecionada");
    setText("workspaceTelemetry",d?`${samples.length.toLocaleString("pt-PT")} amostras · ${samples.length?Object.keys(samples[0]).length:0} canais`:"Sem volta selecionada");
  }

  function maxFinite(samples,key,absolute=false){
    const vals=(samples||[]).map(s=>Number(s?.[key])).filter(Number.isFinite);
    if(!vals.length)return null;
    return absolute?Math.max(...vals.map(Math.abs)):Math.max(...vals);
  }

  function updateTelemetrySummary(d){
    const s=d?.telemetry||[];
    const first=s[0],last=s[s.length-1];
    const fuelUsed=Number(first?.fuel)-Number(last?.fuel);
    setText("telemetryLapTime",fmtLap(d?.lap_time_ms));
    const maxSpeed=maxFinite(s,"speed");
    setText("telemetryMaxSpeed",maxSpeed===null?"—":maxSpeed.toFixed(1)+" km/h");
    const maxRpm=maxFinite(s,"rpm");
    setText("telemetryMaxRpm",maxRpm===null?"—":Math.round(maxRpm).toLocaleString("pt-PT"));
    setText("telemetryFuelUsed",Number.isFinite(fuelUsed)&&fuelUsed>=0?fuelUsed.toFixed(2)+" L":"—");
    const lat=maxFinite(s,"gLat",true),lng=maxFinite(s,"gLong",true);
    setText("telemetryPeakLatG",lat===null?"—":lat.toFixed(2)+" g");
    setText("telemetryPeakLongG",lng===null?"—":lng.toFixed(2)+" g");
  }

  function updateReplayDerived(d){
    const s=d?.telemetry||[];
    if(!s.length)return;
    const first=s[0], last=s[s.length-1];
    const fuelUsed=Number(first.fuel)-Number(last.fuel);
    if(Number.isFinite(fuelUsed)&&fuelUsed>=0){
      setText("fuelAverage",fuelUsed.toFixed(2)+" L/lap");
      AMSRealtime.fuelPerLap=fuelUsed>0?fuelUsed:null;
    }
    setText("fuelWindow","N/D");
    setText("trackChip",d.circuit||"—");
    setText("dashboardSubtitle",`Replay disponível · volta #${d.lap_number??"—"} · ${fmtLap(d.lap_time_ms)}`);
    updateTelemetrySummary(d);
  }

  const fmtSec=v=>Number.isFinite(Number(v))?Number(v).toFixed(3)+"s":"—";
  const fmtDelta=v=>{
    if(!Number.isFinite(Number(v)))return "—";
    const n=Number(v);return (n>=0?"+":"")+n.toFixed(3)+"s";
  };
  const fmtNum=(v,d=1,suffix="")=>Number.isFinite(Number(v))?Number(v).toFixed(d)+suffix:"—";
  const fmtPair=(a,b,d=1,suffix="")=>{
    const av=Number.isFinite(Number(a))?Number(a).toFixed(d):"—";
    const bv=Number.isFinite(Number(b))?Number(b).toFixed(d):"—";
    return av+" / "+bv+(suffix?" "+suffix:"");
  };

  function renderAnalysisCursor(progress){
    if(progress===null||progress===undefined||!state.analysisLap){
      for(const id of ["cursorPosition","cursorTimeA","cursorTimeB","cursorTimeDelta","cursorSpeed","cursorBrake","cursorThrottle","cursorGear"])setText(id,"—");
      return;
    }
    const v=AMSAnalysis.cursorValues(state.analysisLap,state.analysisRef,progress);
    setText("cursorPosition",(v.p*100).toFixed(1)+"%");
    setText("cursorTimeA",fmtSec(v.ta));
    setText("cursorTimeB",fmtSec(v.tb));
    setText("cursorTimeDelta",fmtDelta(v.delta));
    setText("cursorSpeed",fmtPair(v.a.speed,v.b.speed,1,"km/h"));
    setText("cursorBrake",fmtPair(v.a.brake,v.b.brake,0,"%"));
    setText("cursorThrottle",fmtPair(v.a.throttle,v.b.throttle,0,"%"));
    setText("cursorGear",(Number.isFinite(v.a.gear)?Math.round(v.a.gear):"—")+" / "+(Number.isFinite(v.b.gear)?Math.round(v.b.gear):"—"));
    AMSTrack.setPosition(progress);
    AMSTrack.setAnalysisPosition(progress);
    AMSTrack.setTrajectoryPosition(progress);
    AMSTrack.setTrajectoryCoachingPosition(progress);
  }

  function zoneClass(delta){
    if(!Number.isFinite(Number(delta)))return "";
    return Number(delta)>0.003?"loss-cell":Number(delta)<-0.003?"gain-cell":"neutral-cell";
  }

  function renderSectorAnalysis(rows){
    const body=q("#sectorAnalysisBody");if(!body)return;body.innerHTML="";
    for(const z of rows||[]){
      const tr=document.createElement("tr");
      tr.innerHTML=`<td><strong>S${z.index}</strong></td>
        <td>${(z.start*100).toFixed(1)}–${(z.end*100).toFixed(1)}%</td>
        <td>${fmtSec(z.a?.time)}</td>
        <td>${fmtSec(z.b?.time)}</td>
        <td class="${zoneClass(z.delta)}"><strong>${fmtDelta(z.delta)}</strong></td>
        <td>${fmtNum(z.a?.minSpeed,1)} / ${fmtNum(z.a?.maxSpeed,1)} km/h</td>
        <td>${fmtNum(z.a?.peakBrake,0,"%")}</td>
        <td>${fmtNum(z.a?.avgThrottle,0,"%")}</td>`;
      body.appendChild(tr);
    }
  }

  function setZoomWindow(start,end){
    let a=Math.max(0,Math.min(100,Number(start))),b=Math.max(0,Math.min(100,Number(end)));
    if(!Number.isFinite(a))a=0;if(!Number.isFinite(b))b=100;
    if(b-a<1){if(a<=98)b=a+1;else a=b-1;}
    const zs=q("#zoomStart"),ze=q("#zoomEnd");
    if(zs)zs.value=String(Math.round(a));if(ze)ze.value=String(Math.round(b));
    setText("zoomStartText",Math.round(a)+"%");setText("zoomEndText",Math.round(b)+"%");
    AMSCharts.setZoom(a/100,b/100);
  }

  function renderMiniSectors(rows){
    const body=q("#miniSectorBody");if(!body)return;body.innerHTML="";
    for(const z of rows||[]){
      const tr=document.createElement("tr");tr.className="mini-sector-row";tr.title="Clicar para ampliar este minissetor";
      tr.innerHTML=`<td><strong>MS${z.index}</strong></td>
        <td>${(z.start*100).toFixed(1)}–${(z.end*100).toFixed(1)}%</td>
        <td>${fmtSec(z.a?.time)}</td>
        <td>${fmtSec(z.b?.time)}</td>
        <td class="${zoneClass(z.delta)}"><strong>${fmtDelta(z.delta)}</strong></td>
        <td>${fmtNum(z.a?.minSpeed,1)} / ${fmtNum(z.a?.maxSpeed,1)}</td>
        <td>${fmtNum(z.a?.peakBrake,0,"%")}</td>
        <td>${fmtNum(z.a?.avgThrottle,0,"%")}</td>
        <td>${Number.isFinite(z.a?.minGear)?Math.round(z.a.minGear):"—"}–${Number.isFinite(z.a?.maxGear)?Math.round(z.a.maxGear):"—"}</td>`;
      tr.addEventListener("click",()=>setZoomWindow(z.start*100,z.end*100));
      body.appendChild(tr);
    }
  }

  function renderDrivingEvents(events,referenceEvents){
    const body=q("#drivingEventsBody");if(!body)return;body.innerHTML="";
    const length=Number(AMSTrack.reference?.lengthM);
    for(const e of (events||[]).slice(0,40)){
      const ref=AMSAnalysis.nearestEvent(referenceEvents,e.type,e.position);
      let offset="—";
      if(ref&&Number.isFinite(length)){
        let d=ref.position-e.position;if(d>.5)d-=1;if(d<-.5)d+=1;
        offset=(d*length>=0?"+":"")+(d*length).toFixed(0)+" m";
      }else if(ref){
        offset=((ref.position-e.position)*100).toFixed(1)+"%";
      }
      const input=e.type==="brake"?fmtNum(e.peak,0,"%"):fmtNum(e.throttle,0,"%");
      const tr=document.createElement("tr");
      tr.innerHTML=`<td><span class="event-tag ${e.type}">${e.type==="brake"?"BRAKE":"THROTTLE"}</span></td>
        <td>${(e.position*100).toFixed(1)}%</td><td>${fmtNum(e.speed,1," km/h")}</td>
        <td>${input}</td><td>${e.type==="brake"?fmtSec(e.duration):"—"}</td><td>${offset}</td>`;
      tr.addEventListener("click",()=>setZoomWindow(Math.max(0,e.position*100-2),Math.min(100,e.position*100+4)));
      body.appendChild(tr);
    }
    if(!body.children.length)body.innerHTML='<tr><td colspan="6">Sem eventos detetados.</td></tr>';
  }

  async function refreshEngineeringAnalysis(){
    if(!state.selectedDetail)return;
    state.analysisLap=AMSAnalysis.prepareLap(state.selectedDetail);
    const refId=q("#telemetryReferenceSelect")?.value;
    let refDetail=refId?await detail(refId):null;
    state.analysisRef=refDetail?AMSAnalysis.prepareLap(refDetail):null;
    if(state.analysisRef&&!AMSAnalysis.compatible(state.analysisLap,state.analysisRef))state.analysisRef=null;

    const events=AMSAnalysis.detectEvents(state.analysisLap);
    const refEvents=state.analysisRef?AMSAnalysis.detectEvents(state.analysisRef):[];
    state.analysisResult=state.analysisRef
      ?AMSAnalysis.compare(state.analysisLap,state.analysisRef,state.miniCount)
      :{compatible:false,profile:[],sectors:AMSAnalysis.zones(state.analysisLap,null,3),minisectors:AMSAnalysis.zones(state.analysisLap,null,state.miniCount),events,referenceEvents:[]};

    AMSCharts.setTelemetry(state.analysisLap.samples);
    AMSCharts.setReference(state.analysisRef?.samples||[],state.analysisResult.profile||[]);

    const refMs=Number(state.analysisRef?.detail?.lap_time_ms);
    const ownMs=Number(state.selectedDetail?.lap_time_ms);
    setText("telemetryReferenceTime",Number.isFinite(refMs)?fmtLap(refMs):"—");
    setText("telemetryLapDelta",Number.isFinite(refMs)&&Number.isFinite(ownMs)?fmtDelta((ownMs-refMs)/1000):"—");
    setText("analysisComparisonStatus",state.analysisRef?"A vs REF · distância sincronizada":"SEM REFERÊNCIA COMPATÍVEL");

    renderSectorAnalysis(state.analysisResult.sectors||[]);
    renderMiniSectors(state.analysisResult.minisectors||[]);
    renderDrivingEvents(events,refEvents);
    AMSTrack.renderAnalysisMap(state.analysisResult.minisectors||[],events);
    AMSTrack.renderTrajectoryCompare(state.analysisLap,state.analysisRef);
    AMSTrack.renderTrajectoryCoaching(state.analysisLap,state.analysisRef);
    renderAnalysisCursor(0);
  }

  async function selectLap(id,goTelemetry=false){
    const d=await detail(id); if(!d)return;
    state.selectedId=id; state.selectedDetail=d; renderLaps();
    setText("telemetryStatus",`${(d.telemetry||[]).length} amostras`);
    const sel=q("#telemetryLapSelect"); if(sel)sel.value=id;
    setText("simName",d.simulator||"—"); setText("trackName",d.circuit||"—"); setText("carName",d.car||"—");
    fillReferenceSelector();
    await AMSTrack.load(d.circuit||"","",d.telemetry||[]);
    state.replayCursor=0;
    const seek=q("#replaySeek"); if(seek)seek.value="0";
    setText("replayPositionText","0.0%");
    updateWorkspace(); updateReplayDerived(d);
    setZoomWindow(0,100);
    await refreshEngineeringAnalysis();
    if(goTelemetry)switchView("telemetry");
  }

  function renderReplayTiming(d,sample){
    const body=q("#timingBody"); if(!body)return;
    const pos=sample?.positionOverall??sample?.position??"—", cls=sample?.positionClass??"—";
    body.innerHTML=`<tr class="focus-row"><td><strong>${pos}</strong></td><td>${cls==="—"?"—":"P"+cls}</td><td><strong>${pilotName(d.pilot_id)}</strong><br><small>REPLAY</small></td><td>${d.car||"—"}</td><td>${d.lap_number??"—"}</td><td>${fmtLap(d.lap_time_ms)}</td><td>${fmtLap(sample?.bestLapTime*1000)}</td><td>${Number.isFinite(Number(sample?.delta))?Number(sample.delta).toFixed(3):"—"}</td><td>—</td><td>${Number.isFinite(Number(sample?.fuel))?Number(sample.fuel).toFixed(1)+" L":"—"}</td><td>—</td></tr>`;
  }

  function applyReplaySample(d,index){
    const samples=d?.telemetry||[];
    if(!samples.length)return;
    const i=Math.max(0,Math.min(samples.length-1,Math.floor(index)));
    const s=samples[i];
    AMSRealtime.applySample({sample:s,circuit:d.circuit,car:d.car,simulator:d.simulator});
    const t=Number(s.t);
    if(Number.isFinite(t))setText("sessionTime",t.toFixed(2)+"s");
    setText("liveRaceTime",Number.isFinite(t)?t.toFixed(1)+"s":"—");
    setText("liveFlag",s.flagText||"—");
    setText("lapStateChip","REPLAY");
    renderReplayTiming(d,s);

    const seek=q("#replaySeek");
    const ratio=samples.length>1?i/(samples.length-1):0;
    if(seek)seek.value=String(Math.round(ratio*1000));
    const pos=Number(s.position);
    const progress=Number.isFinite(pos)?Math.max(0,Math.min(1,pos/100)):ratio;
    setText("replayPositionText",Number.isFinite(pos)?pos.toFixed(1)+"%":(ratio*100).toFixed(1)+"%");
    AMSCharts.setExternalCursor(progress);
    AMSTrack.setAnalysisPosition(progress);
    renderAnalysisCursor(progress);
  }

  async function startReplay(){
    if(!state.selectedDetail&&state.laps[0])await selectLap(state.laps[0].id);
    const d=state.selectedDetail, samples=d?.telemetry||[]; if(!samples.length)return;
    if(state.replayTimer){clearInterval(state.replayTimer);state.replayTimer=null;}
    if(state.replayCursor>=samples.length-1)state.replayCursor=0;

    AMSRealtime.mode="replay";
    const btn=q("#replayBtn"); if(btn)btn.textContent="■ Parar replay";
    const tbtn=q("#telemetryReplayBtn"); if(tbtn)tbtn.textContent="■ Parar";
    const liveBtn=q("#simulateLiveBtn"); if(liveBtn)liveBtn.textContent="■ Parar simulação";
    setText("connectionText","REPLAY SUPABASE"); setText("liveBadgeText","REPLAY");
    setText("liveTrack",d.circuit||"—"); setText("liveCars","1"); setText("liveGap","—");

    const duration=Math.max(1,Number(d.lap_time_ms)/1000);
    state.replayTimer=setInterval(()=>{
      if(state.replayCursor>=samples.length){stopReplay();return;}
      applyReplaySample(d,state.replayCursor);
      const samplesPerTick=samples.length/(duration*20);
      state.replayCursor+=Math.max(.1,samplesPerTick*state.replaySpeed);
    },50);
  }

  function stopReplay(){
    if(state.replayTimer)clearInterval(state.replayTimer); state.replayTimer=null;
    AMSRealtime.mode="offline";
    const btn=q("#replayBtn"); if(btn)btn.textContent="▶ Replay volta";
    const tbtn=q("#telemetryReplayBtn"); if(tbtn)tbtn.textContent="▶ Replay";
    const liveBtn=q("#simulateLiveBtn"); if(liveBtn)liveBtn.textContent="▶ Simular com volta gravada";
    setText("connectionText",state.isCoach?"COACH · SUPABASE":"SUPABASE ACCOUNT");
    setText("liveBadgeText","OFFLINE"); setText("lapStateChip","SEM LIVE");
  }

  function seekReplay(value){
    const d=state.selectedDetail,samples=d?.telemetry||[];
    if(!samples.length)return;
    const ratio=Math.max(0,Math.min(1,Number(value)/1000));
    state.replayCursor=ratio*(samples.length-1);
    applyReplaySample(d,state.replayCursor);
  }

  function exportTelemetryCsv(){
    const d=state.selectedDetail,samples=d?.telemetry||[];
    if(!samples.length)return;
    const keys=[...new Set(samples.flatMap(s=>Object.keys(s||{})))];
    const esc=v=>{
      if(v===null||v===undefined)return "";
      const s=String(v);
      return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
    };
    const rows=[keys.join(","),...samples.map(s=>keys.map(k=>esc(s?.[k])).join(","))];
    const blob=new Blob([rows.join("\n")],{type:"text/csv;charset=utf-8"});
    const url=URL.createObjectURL(blob);
    const a=document.createElement("a");
    a.href=url;
    a.download=`AMS-${(d.circuit||"track").replace(/[^a-z0-9]+/gi,"-")}-lap-${d.lap_number??"x"}.csv`;
    document.body.appendChild(a);a.click();a.remove();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  }

  function compareDuration(){
    if(!state.compareLapA||!state.compareLapB)return 1;
    return Math.max(
      Number(state.compareLapA.lapTimeSec)||0,
      Number(state.compareLapB.lapTimeSec)||0,
      1
    );
  }

  function setCompareProgress(progress){
    if(!state.compareLapA||!state.compareLapB)return;
    const p=Math.max(0,Math.min(1,Number(progress)||0));
    state.compareProgress=p;
    const t=AMSAnalysis.timeAt(state.compareLapA,p);
    if(Number.isFinite(t))state.compareReplayTime=t;
    AMSTrack.setFocusedComparePosition(p);
    AMSCharts.setCompareExternalCursors(null,null);
    AMSCharts.setExternalCursor(p);

    const duration=compareDuration();
    const seek=q("#compareReplaySeek");
    if(seek)seek.value=String(Math.round(Math.max(0,Math.min(1,state.compareReplayTime/duration))*1000));
    setText("compareReplayPosition",state.compareReplayTime.toFixed(1)+"s");
  }

  function setCompareReplayTime(timeSec){
    if(!state.compareLapA||!state.compareLapB)return null;
    const duration=compareDuration();
    const t=Math.max(0,Math.min(duration,Number(timeSec)||0));
    state.compareReplayTime=t;

    const result=AMSTrack.setFocusedCompareReplayTime(t);
    if(result){
      state.compareProgress=result.pA;
      AMSCharts.setCompareExternalCursors(result.pA,result.pRef);
    }

    const seek=q("#compareReplaySeek");
    if(seek)seek.value=String(Math.round((t/duration)*1000));
    setText("compareReplayPosition",t.toFixed(1)+"s");
    return result;
  }

  function stopCompareReplay(){
    if(state.compareTimer)clearInterval(state.compareTimer);
    state.compareTimer=null;
    const b1=q("#compareReplayBtn"),b2=q("#compareReplayToggle");
    if(b1)b1.textContent="▶ Replay";
    if(b2)b2.textContent="▶";
  }

  async function startCompareReplay(){
    if(!state.compareLapA||!state.compareLapB)await compare();
    if(!state.compareLapA||!state.compareLapB)return;
    if(state.compareTimer){stopCompareReplay();return;}

    if(!(state.compareLapA.samples||[]).length||!(state.compareLapB.samples||[]).length)return;
    const duration=compareDuration();
    if(state.compareReplayTime>=duration-.001)state.compareReplayTime=0;

    const b1=q("#compareReplayBtn"),b2=q("#compareReplayToggle");
    if(b1)b1.textContent="■ Parar";
    if(b2)b2.textContent="■";

    // True delta replay: both laps share the same elapsed-time clock.
    // Each lap resolves its own track position p(t), so the faster lap moves
    // visibly ahead instead of being forced to the same LapDistPct.
    let previous=performance.now();
    state.compareTimer=setInterval(()=>{
      const now=performance.now();
      const dt=Math.max(0,Math.min(.25,(now-previous)/1000));
      previous=now;
      state.compareReplayTime=Math.min(duration,state.compareReplayTime+dt*state.compareSpeed);
      setCompareReplayTime(state.compareReplayTime);
      if(state.compareReplayTime>=duration)stopCompareReplay();
    },33);
  }

  function seekCompare(value){
    if(!state.compareLapA||!state.compareLapB)return;
    const ratio=Math.max(0,Math.min(1,Number(value)/1000));
    setCompareReplayTime(ratio*compareDuration());
  }

  async function compare(){
    stopCompareReplay();
    const aId=q("#compareLapA")?.value,bId=q("#compareLapB")?.value;
    const [a,b]=await Promise.all([detail(aId),detail(bId)]); if(!a||!b)return;

    state.compareDetailA=a;state.compareDetailB=b;
    setText("compareTimeA",fmtLap(a.lap_time_ms)); setText("compareTimeB",fmtLap(b.lap_time_ms));
    const diff=Number(a.lap_time_ms)-Number(b.lap_time_ms);
    setText("compareDiff",Number.isFinite(diff)?((diff>=0?"+":"")+(diff/1000).toFixed(3)+"s"):"—");

    const compatible=a.simulator===b.simulator&&a.circuit===b.circuit&&a.car===b.car;
    setText("compareCompatibility",compatible?"MATCH":"DIFFERENT");
    setText("compareNote",compatible?"Mesma combinação · A laranja / referência azul":"Pista/carro/simulador diferentes");
    if(!compatible){
      state.compareLapA=null;state.compareLapB=null;
      setText("compareFocusStatus","INCOMPATÍVEL");
      return;
    }

    await AMSTrack.load(a.circuit||"","",a.telemetry||[]);
    state.compareLapA=AMSAnalysis.prepareLap(a);
    state.compareLapB=AMSAnalysis.prepareLap(b);
    state.compareProgress=0;
    state.compareReplayTime=0;

    AMSCharts.setZoom(0,1);
    AMSCharts.setCompare(state.compareLapA.samples,state.compareLapB.samples);
    AMSTrack.renderFocusedCompare(state.compareLapA,state.compareLapB);
    setCompareReplayTime(0);
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

  q("#engineerAnalyzeBtn")?.addEventListener("click",analyzeEngineerSession);
  q("#engineerSessionSelect")?.addEventListener("change",()=>setText("engineerStatus","Pronto para analisar"));
  q("#telemetryLapSelect")?.addEventListener("change",e=>selectLap(e.target.value));
  q("#telemetryReferenceSelect")?.addEventListener("change",()=>refreshEngineeringAnalysis());
  q("#miniSectorCount")?.addEventListener("change",e=>{state.miniCount=Math.max(5,Number(e.target.value)||20);refreshEngineeringAnalysis();});
  q("#zoomStart")?.addEventListener("input",e=>setZoomWindow(e.target.value,q("#zoomEnd")?.value||100));
  q("#zoomEnd")?.addEventListener("input",e=>setZoomWindow(q("#zoomStart")?.value||0,e.target.value));
  q("#zoomResetBtn")?.addEventListener("click",()=>setZoomWindow(0,100));
  q("#compareBtn")?.addEventListener("click",compare);
  q("#compareReplayBtn")?.addEventListener("click",startCompareReplay);
  q("#compareReplayToggle")?.addEventListener("click",startCompareReplay);
  q("#compareReplaySeek")?.addEventListener("input",e=>seekCompare(e.target.value));
  q("#compareReplaySpeed")?.addEventListener("change",e=>{state.compareSpeed=Math.max(.25,Number(e.target.value)||1);});
  q("#compareFocusZoom")?.addEventListener("change",e=>AMSTrack.setFocusedCompareZoom(e.target.value));
  q("#replayBtn")?.addEventListener("click",()=>state.replayTimer?stopReplay():startReplay());
  q("#telemetryReplayBtn")?.addEventListener("click",()=>state.replayTimer?stopReplay():startReplay());
  q("#simulateLiveBtn")?.addEventListener("click",()=>{switchView("live");state.replayTimer?stopReplay():startReplay();});
  q("#replaySeek")?.addEventListener("input",e=>seekReplay(e.target.value));
  q("#replaySpeed")?.addEventListener("change",e=>{state.replaySpeed=Math.max(.25,Number(e.target.value)||1);});
  q("#exportCsvBtn")?.addEventListener("click",exportTelemetryCsv);
  document.addEventListener("ams-trajectory-seek",e=>{
    const p=Math.max(0,Math.min(1,Number(e.detail?.progress)||0));
    seekReplay(p*1000);
    switchView("telemetry");
  });
  AMSCharts.setCompareCursorCallback(p=>{
    if(p===null||!state.compareLapA)return;
    if(state.compareTimer)stopCompareReplay();
    setCompareProgress(Math.max(0,Math.min(1,Number(p)||0)));
  });
  AMSCharts.setCursorCallback(p=>renderAnalysisCursor(p));

  window.addEventListener("resize",()=>{AMSCharts.drawAll();AMSTrack.setPosition(AMSTrack.progress);});
  document.addEventListener("ams-auth-changed",e=>{if(e.detail?.user)loadCloud();else stopReplay();});

  initWorkspace();
  AMSAuth.init();
  const probe=setInterval(()=>{if(AMSAuth.user?.id){clearInterval(probe);loadCloud();}},250);
  setTimeout(()=>clearInterval(probe),5000);
  AMSRealtime.start();
})();