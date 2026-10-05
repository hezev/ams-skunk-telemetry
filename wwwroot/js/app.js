(()=>{
  const q=s=>document.querySelector(s);
  const qa=s=>[...document.querySelectorAll(s)];

  function switchView(id){
    qa(".view").forEach(v=>v.classList.toggle("active",v.id===id));
    qa("#mainNav button").forEach(b=>b.classList.toggle("active",b.dataset.view===id));
    requestAnimationFrame(()=>AMSCharts.drawAll(AMSRealtime.phase));
  }

  qa("#mainNav button").forEach(btn=>btn.addEventListener("click",()=>switchView(btn.dataset.view)));

  const timing=q("#timingBody");
  AMSMock.drivers.forEach(d=>{
    const tr=document.createElement("tr");
    if(d.driver==="H. Azevedo") tr.classList.add("focus-row");
    tr.innerHTML=`<td><strong>${d.pos}</strong></td><td>P${d.cls}</td><td><strong>${d.driver}</strong><br><small>${d.number}</small></td><td>${d.car}</td><td>${d.lap}</td><td>${d.last}</td><td>${d.best}</td><td class="${d.delta.startsWith("-")?"green":"red"}">${d.delta}</td><td>${d.gap}</td><td>${d.fuel} L</td><td>${d.stint}</td>`;
    timing.appendChild(tr);
  });

  const sessions=q("#sessionsBody");
  AMSMock.sessions.forEach(s=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${s.date}</td><td>${s.sim}</td><td>${s.track}</td><td>${s.car}</td><td>${s.laps}</td><td>${s.best}</td><td><span class="status ${s.status}">${s.status==="live"?"Live":"Complete"}</span></td>`;
    sessions.appendChild(tr);
  });

  const laps=q("#lapsBody");
  AMSMock.laps.forEach(l=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td>${l.lap}</td><td><strong>${l.time}</strong></td><td>${l.s1}</td><td>${l.s2}</td><td>${l.s3}</td><td class="${l.delta==="PB"?"green":"red"}">${l.delta}</td><td>${l.fuel} L</td>`;
    laps.appendChild(tr);
  });

  const records=q("#recordsBody");
  AMSMock.records.forEach(r=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td><strong>${r.rank}</strong></td><td>${r.driver}</td><td>${r.car}</td><td>${r.track}</td><td><strong>${r.time}</strong></td>`;
    records.appendChild(tr);
  });

  window.addEventListener("resize",()=>{
    AMSCharts.drawAll(AMSRealtime.phase);
    AMSTrack.setPosition(AMSTrack.progress);
  });


  const fmtLapMs=ms=>{
    const n=Number(ms);
    if(!Number.isFinite(n)) return "—";
    const min=Math.floor(n/60000);
    const sec=(n-min*60000)/1000;
    return min+":"+sec.toFixed(3).padStart(6,"0");
  };

  async function loadCloudAccountData(){
    if(!AMSAuth.user?.id) return;

    const token=await AMSAuth.token();
    if(!token) return;

    try{
      const [own,shared]=await Promise.all([
        AMSSupabase.getLaps(token,AMSAuth.user.id),
        AMSSupabase.getBestLaps(token,null,true)
      ]);

      const laps=q("#lapsBody");
      laps.innerHTML="";
      if(Array.isArray(own) && own.length){
        own.slice(0,100).forEach(l=>{
          const tr=document.createElement("tr");
          tr.dataset.lapId=l.id;
          tr.classList.add("cloud-lap-row");
          const when=l.completed_at?new Date(l.completed_at).toLocaleString("pt-PT"):"—";
          tr.innerHTML=`<td><strong>${l.lap_number??"—"}</strong></td><td><strong>${fmtLapMs(l.lap_time_ms)}</strong></td><td>${l.circuit||"—"}</td><td>${l.car||"—"}</td><td><small>${l.session_id||"—"}</small></td><td>${when}</td><td class="${l.verified?"green":""}">${l.verified?"VERIFIED":"RECORDED"}</td>`;
          laps.appendChild(tr);
        });
      }else{
        laps.innerHTML='<tr><td colspan="7" class="empty-cloud">Nenhuma volta encontrada nesta conta.</td></tr>';
      }

      const sessions=q("#sessionsBody");
      sessions.innerHTML="";
      const grouped=new Map();
      for(const l of (own||[])){
        const key=l.session_id||[l.simulator,l.circuit,l.car,l.completed_at?.slice(0,10)].join("|");
        if(!grouped.has(key)){
          grouped.set(key,{
            id:key,sim:l.simulator,track:l.circuit,car:l.car,
            laps:0,best:null,last:null
          });
        }
        const s=grouped.get(key);
        s.laps++;
        if(Number.isFinite(Number(l.lap_time_ms)) && (s.best===null || Number(l.lap_time_ms)<s.best)) s.best=Number(l.lap_time_ms);
        const d=l.completed_at?new Date(l.completed_at):null;
        if(d && (!s.last || d>s.last)) s.last=d;
      }
      if(grouped.size){
        [...grouped.values()].sort((a,b)=>(b.last?.getTime()||0)-(a.last?.getTime()||0)).forEach(s=>{
          const tr=document.createElement("tr");
          tr.innerHTML=`<td>${s.last?s.last.toLocaleDateString("pt-PT"):"—"}</td><td>${s.sim||"—"}</td><td>${s.track||"—"}</td><td>${s.car||"—"}</td><td>${s.laps}</td><td><strong>${fmtLapMs(s.best)}</strong></td><td><span class="status complete">Complete</span></td>`;
          sessions.appendChild(tr);
        });
      }else{
        sessions.innerHTML='<tr><td colspan="7" class="empty-cloud">Sem sessões gravadas nesta conta.</td></tr>';
      }

      const records=q("#recordsBody");
      records.innerHTML="";
      if(Array.isArray(shared) && shared.length){
        shared.slice(0,50).forEach((r,i)=>{
          const tr=document.createElement("tr");
          tr.innerHTML=`<td><strong>${i+1}</strong></td><td>${r.pilot_id===AMSAuth.user.id?"Tu":"AMS Pilot"}</td><td>${r.car||"—"}</td><td>${[r.circuit,r.circuit_layout].filter(Boolean).join(" · ")}</td><td><strong>${fmtLapMs(r.lap_time_ms)}</strong></td>`;
          records.appendChild(tr);
        });
      }else{
        records.innerHTML='<tr><td colspan="5" class="empty-cloud">Ainda não existem melhores voltas partilhadas em ams_best_laps.</td></tr>';
      }

      const c=document.getElementById("connectionText");
      if(c && AMSRealtime.mode!=="cloud") c.textContent="SUPABASE ACCOUNT";
    }catch(err){
      console.warn("AMS cloud laps:",err);
      const laps=q("#lapsBody");
      const records=q("#recordsBody");
      if(laps) laps.innerHTML='<tr><td colspan="7" class="empty-cloud error-cloud">Erro Supabase: '+String(err.message||err)+'</td></tr>';
      if(records) records.innerHTML='<tr><td colspan="5" class="empty-cloud error-cloud">Não foi possível carregar referências.</td></tr>';
      const c=document.getElementById("connectionText");
      if(c)c.textContent="SUPABASE ERROR";
    }
  }

  document.addEventListener("ams-auth-changed",e=>{
    if(e.detail?.user){
      loadCloudAccountData();
      AMSRealtime.nextCloudPoll=0;
      AMSRealtime.pollCloud();
    }else{
      AMSRealtime.mode="mock";
      AMSRealtime.liveRows=[];
      const c=document.getElementById("connectionText");
      if(c)c.textContent="MOCK LIVE";
    }
  });

  AMSAuth.init();

  // If a valid session was restored very quickly, ensure cloud data still loads.
  const restoredProbe=setInterval(()=>{
    if(AMSAuth.user?.id){
      clearInterval(restoredProbe);
      loadCloudAccountData();
      AMSRealtime.nextCloudPoll=0;
      AMSRealtime.pollCloud();
    }
  },250);
  setTimeout(()=>clearInterval(restoredProbe),5000);

  const trackEl = q("#trackName");
  const loadCurrentTrack = () => AMSTrack.load(trackEl?.textContent || "Algarve International Circuit");
  loadCurrentTrack();

  if(trackEl){
    new MutationObserver(loadCurrentTrack).observe(trackEl,{childList:true,subtree:true,characterData:true});
  }

  AMSCharts.drawAll();
  AMSRealtime.start();
})();
