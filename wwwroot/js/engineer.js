window.AMSEngineer = {
  clamp(v,a=0,b=1){ return Math.max(a,Math.min(b,v)); },
  finite(values){ return (values||[]).map(Number).filter(Number.isFinite); },
  mean(values){ const a=this.finite(values); return a.length?a.reduce((s,v)=>s+v,0)/a.length:null; },
  percentile(values,p){
    const a=this.finite(values).sort((x,y)=>x-y);
    if(!a.length)return null;
    if(a.length===1)return a[0];
    const x=this.clamp(Number(p))*(a.length-1);
    const i=Math.floor(x),j=Math.min(a.length-1,i+1),t=x-i;
    return a[i]+(a[j]-a[i])*t;
  },
  median(values){ return this.percentile(values,.5); },
  stddev(values){
    const a=this.finite(values);
    if(a.length<2)return 0;
    const m=this.mean(a);
    return Math.sqrt(a.reduce((s,v)=>s+(v-m)*(v-m),0)/(a.length-1));
  },
  cv(values){ const m=Math.abs(Number(this.mean(values))); return m>1e-9?this.stddev(values)/m:0; },
  fmtLap(sec){
    const n=Number(sec); if(!Number.isFinite(n)||n<=0)return "—";
    const m=Math.floor(n/60),s=n-m*60; return m+":"+s.toFixed(3).padStart(6,"0");
  },
  fmtDelta(sec){
    const n=Number(sec); return Number.isFinite(n)?((n>=0?"+":"")+n.toFixed(3)+"s"):"—";
  },
  nearestCorner(progress,corners=[]){
    let best=null,d=Infinity;
    for(const c of corners){
      const raw=Math.abs(Number(c.p)-progress),cd=Math.min(raw,1-raw);
      if(cd<d){d=cd;best=c;}
    }
    return d<=.05?best:null;
  },
  zoneLabel(index,start,end,corners){
    const c=this.nearestCorner((start+end)/2,corners);
    return c?("T"+c.index+" · "+c.direction):("Zona "+index);
  },
  fingerprint(lap,events,start,end){
    const samples=(lap?.samples||[]).filter(s=>s._p>=start&&s._p<=end);
    const read=key=>samples.map(s=>s?.[key]).filter(v=>typeof v==='number'&&Number.isFinite(v));
    const speed=read("speed"),steer=read("steer"),yaw=read("yawRate");
    const absSteer=steer.map(Math.abs),absYaw=yaw.map(Math.abs);
    let correction=0;
    for(let i=1;i<steer.length;i++)correction+=Math.abs(steer[i]-steer[i-1]);
    correction=steer.length>1?correction/(steer.length-1):null;
    const inRange=(events||[]).filter(e=>e.position>=Math.max(0,start-.012)&&e.position<=Math.min(1,end+.02));
    const brake=inRange.find(e=>e.type==="brake")||null;
    const throttle=inRange.find(e=>e.type==="throttle")||null;
    const meanSteer=this.mean(absSteer),meanYaw=this.mean(absYaw);
    return {
      brakeP:Number.isFinite(Number(brake?.position))?Number(brake.position):null,
      throttleP:Number.isFinite(Number(throttle?.position))?Number(throttle.position):null,
      minSpeed:speed.length?Math.min(...speed):null,
      steerYawRatio:Number.isFinite(meanSteer)&&Number.isFinite(meanYaw)&&meanYaw>.01?meanSteer/meanYaw:null,
      correction
    };
  },
  adviceFor(zone){
    const e=zone.evidence||[];
    if(zone.diagnosis==="DRIVER"){
      if(e.some(x=>x.includes("travagem")))return "Fixar uma referência de travagem e repetir a mesma libertação de brake antes de procurar mais velocidade.";
      if(e.some(x=>x.includes("throttle")))return "Repetir o ponto de pickup e a progressão de throttle; a variação de saída está a custar tempo.";
      if(e.some(x=>x.includes("velocidade mínima")))return "Estabilizar a velocidade de entrada/apex. O carro já demonstrou que a zona pode ser feita mais depressa.";
      return "Priorizar repetibilidade nesta zona antes de alterar o setup.";
    }
    if(zone.diagnosis==="SETUP")return "Inputs já são repetíveis. Fazer um teste A/B pequeno de balance, uma variável de cada vez, e validar nesta mesma zona.";
    if(zone.diagnosis==="BOTH")return "Há variação de pilotagem e um padrão de balance repetível. Primeiro reduzir a variação; depois fazer um teste A/B de setup.";
    return "Recolher mais voltas comparáveis antes de atribuir a perda a pilotagem ou setup.";
  },
  analyze(details,options={}){
    const track=options.track;
    const corners=track?.detectCorners?.()||[];
    const session=options.session||{};
    const context={sessionId:String(session.id||''),simulator:session.sim||'',circuit:session.track||'',car:session.car||''};
    const map=track?.reference&&track.centerline?.length>=50?{
      name:context.circuit||track.reference.name,
      points:track.centerline.map(p=>({x:Number(p.x),y:Number(p.y)})),
      turns:corners.length&&corners.every(c=>c.official)?corners.map(c=>({p:c.p,index:c.index})):[]
    }:null;
    const trackLengthM=Number(options.trackLengthM);
    const miniCount=Math.max(10,Math.min(40,Number(options.minisectors)||20));
    const validByArrival=(details||[])
      .map(d=>AMSAnalysis.prepareLap(d))
      .filter(l=>l.samples.length>=30&&Number.isFinite(Number(l.lapTimeSec))&&l.lapTimeSec>0);
    const prepared=[...validByArrival].sort((a,b)=>a.lapTimeSec-b.lapTimeSec);
    if(prepared.length<2)return {ok:false,reason:"São necessárias pelo menos duas voltas com telemetria válida."};

    const times=prepared.map(l=>l.lapTimeSec);
    const bestLap=prepared[0],bestTime=bestLap.lapTimeSec;
    const currentLap=validByArrival[validByArrival.length-1];
    const pace=this.percentile(times,.35),lapSd=this.stddev(times);
    const consistency=Math.round(this.clamp(100-(lapSd/Math.max(bestTime,.001))*5000,0,100));
    const lapRows=prepared.map(l=>({lap:l,events:AMSAnalysis.detectEvents(l)}));
    const rawZones=[];

    for(let i=0;i<miniCount;i++){
      const start=i/miniCount,end=(i+1)/miniCount;
      const rows=lapRows.map(row=>({
        lap:row.lap,
        stats:AMSAnalysis.segmentStats(row.lap,start,end),
        fp:this.fingerprint(row.lap,row.events,start,end)
      })).filter(r=>typeof r.stats?.time==='number'&&Number.isFinite(r.stats.time));
      if(!rows.length)continue;

      const zoneTimes=rows.map(r=>r.stats.time),sorted=[...zoneTimes].sort((a,b)=>a-b);
      const bestSeg=sorted[0],secondSeg=sorted[Math.min(1,sorted.length-1)];
      const medianSeg=this.median(zoneTimes),timeSd=this.stddev(zoneTimes);
      const bestLapRow=rows.find(r=>r.lap===bestLap)||rows[0],bestLapSeg=Number(bestLapRow?.stats?.time);
      const currentRow=rows.find(r=>r.lap===currentLap);
      const difference=(a,b)=>typeof a==='number'&&Number.isFinite(a)&&typeof b==='number'&&Number.isFinite(b)?a-b:null;
      const drivingEvidence={
        loss:difference(currentRow?.stats?.time,bestLapRow?.stats?.time),
        brakeShiftP:difference(currentRow?.fp?.brakeP,bestLapRow?.fp?.brakeP),
        throttleShiftP:difference(currentRow?.fp?.throttleP,bestLapRow?.fp?.throttleP),
        minSpeedLoss:difference(bestLapRow?.fp?.minSpeed,currentRow?.fp?.minSpeed)
      };
      const brakeP=rows.map(r=>r.fp.brakeP).filter(Number.isFinite);
      const throttleP=rows.map(r=>r.fp.throttleP).filter(Number.isFinite);
      const minSpeed=rows.map(r=>r.fp.minSpeed).filter(Number.isFinite);
      const ratio=rows.map(r=>r.fp.steerYawRatio).filter(Number.isFinite);
      const correction=rows.map(r=>r.fp.correction).filter(Number.isFinite);
      const brakeStdP=this.stddev(brakeP),throttleStdP=this.stddev(throttleP),minSpeedSd=this.stddev(minSpeed);
      const avgLoss=Math.max(0,Number(medianSeg)-Number(bestSeg));
      const repeatablePotential=Number.isFinite(bestLapSeg)&&sorted.length>1?Math.max(0,bestLapSeg-secondSeg):0;

      let driverScore=0;
      if(timeSd>Math.max(.045,medianSeg*.014))driverScore+=.30;
      if(brakeP.length>=3&&brakeStdP>.0014)driverScore+=.25;
      if(throttleP.length>=3&&throttleStdP>.0022)driverScore+=.20;
      if(minSpeed.length>=3&&minSpeedSd>2.4)driverScore+=.15;
      if(correction.length>=3&&this.cv(correction)>.30)driverScore+=.10;

      rawZones.push({
        index:i+1,start,end,label:this.zoneLabel(i+1,start,end,corners),bestSeg,secondSeg,medianSeg,timeSd,bestLapSeg,avgLoss,repeatablePotential,
        brakeStdP,throttleStdP,minSpeedSd,
        brakeSamples:brakeP.length,throttleSamples:throttleP.length,minSpeedSamples:minSpeed.length,drivingEvidence,
        brakeStdM:Number.isFinite(trackLengthM)?brakeStdP*trackLengthM:null,
        throttleStdM:Number.isFinite(trackLengthM)?throttleStdP*trackLengthM:null,
        ratioMedian:this.median(ratio),ratioCv:this.cv(ratio),
        correctionMedian:this.median(correction),correctionCv:this.cv(correction),
        driverScore:this.clamp(driverScore)
      });
    }

    const ratioThreshold=this.percentile(rawZones.map(z=>z.ratioMedian).filter(Number.isFinite),.75);
    const correctionThreshold=this.percentile(rawZones.map(z=>z.correctionMedian).filter(Number.isFinite),.75);
    let balanceTelemetry=false;

    const zones=rawZones.map(z=>{
      const timeStable=z.timeSd<=Math.max(.060,z.medianSeg*.012);
      const brakeStable=!Number.isFinite(z.brakeStdP)||z.brakeStdP<=.0014;
      const throttleStable=!Number.isFinite(z.throttleStdP)||z.throttleStdP<=.0022;
      const speedStable=!Number.isFinite(z.minSpeedSd)||z.minSpeedSd<=2.0;
      const inputsStable=timeStable&&brakeStable&&throttleStable&&speedStable;
      const balanceHigh=Number.isFinite(z.ratioMedian)&&Number.isFinite(ratioThreshold)&&ratioThreshold>0&&z.ratioMedian>ratioThreshold*1.08&&z.ratioCv<.22;
      const tractionHigh=Number.isFinite(z.correctionMedian)&&Number.isFinite(correctionThreshold)&&correctionThreshold>0&&z.correctionMedian>correctionThreshold*1.12&&z.correctionCv<.24;
      if(Number.isFinite(z.ratioMedian)||Number.isFinite(z.correctionMedian))balanceTelemetry=true;

      let setupScore=0;
      if(inputsStable)setupScore+=.30;
      if(balanceHigh)setupScore+=.38;
      if(tractionHigh)setupScore+=.28;
      if(timeStable&&z.avgLoss>.035)setupScore+=.08;
      setupScore=this.clamp(setupScore);

      let diagnosis="INCONCLUSIVE";
      if(z.driverScore>=.50&&setupScore>=.55)diagnosis="BOTH";
      else if(z.driverScore>=.50)diagnosis="DRIVER";
      else if(setupScore>=.55)diagnosis="SETUP";

      const evidence=[];
      if(Number.isFinite(z.brakeStdM)&&z.brakeStdM>5)evidence.push("travagem varia ±"+z.brakeStdM.toFixed(1)+" m");
      else if(z.brakeStdP>.0014)evidence.push("travagem varia "+(z.brakeStdP*100).toFixed(2)+"% da volta");
      if(Number.isFinite(z.throttleStdM)&&z.throttleStdM>8)evidence.push("throttle varia ±"+z.throttleStdM.toFixed(1)+" m");
      else if(z.throttleStdP>.0022)evidence.push("throttle varia "+(z.throttleStdP*100).toFixed(2)+"% da volta");
      if(z.minSpeedSd>2.4)evidence.push("velocidade mínima σ "+z.minSpeedSd.toFixed(1)+" km/h");
      if(balanceHigh)evidence.push("steering/yaw persistentemente elevado");
      if(tractionHigh)evidence.push("correções de steering repetíveis na aceleração");
      if(inputsStable&&diagnosis!=="DRIVER")evidence.push("inputs repetíveis entre voltas");
      if(!evidence.length)evidence.push("evidência ainda insuficiente");

      const confidence=Math.round(this.clamp(42+Math.abs(z.driverScore-setupScore)*40+Math.min(12,prepared.length*1.5)+(diagnosis==="INCONCLUSIVE"?-10:8),20,94));
      const priority=z.avgLoss*(.6+Math.max(z.driverScore,setupScore))+z.repeatablePotential*.8+z.timeSd*.25;
      return {...z,setupScore,diagnosis,evidence,confidence,priority};
    });

    const absoluteTheoretical=Math.max(0,zones.reduce((s,z)=>s+z.bestSeg,0));
    const repeatablePotential=zones.reduce((s,z)=>s+z.repeatablePotential,0);
    const achievable=Math.max(absoluteTheoretical,Math.min(bestTime,bestTime-repeatablePotential));
    const weight=z=>Math.max(.001,z.avgLoss+z.repeatablePotential);
    const driverWeight=zones.reduce((s,z)=>s+weight(z)*z.driverScore,0),setupWeight=zones.reduce((s,z)=>s+weight(z)*z.setupScore,0);
    const totalWeight=driverWeight+setupWeight,driverShare=totalWeight>0?driverWeight/totalWeight:0,setupShare=totalWeight>0?setupWeight/totalWeight:0;

    const driverPotential=Math.min(bestTime*.04,zones.reduce((s,z)=>{
      const factor=z.diagnosis==="DRIVER"?1:z.diagnosis==="BOTH"?.55:.18;
      return s+z.repeatablePotential*factor+z.avgLoss*z.driverScore*.18;
    },0));

    const setupCandidates=zones.filter(z=>z.diagnosis==="SETUP"||z.diagnosis==="BOTH");
    const setupUpper=setupCandidates.length?Math.min(bestTime*.018,setupCandidates.reduce((s,z)=>s+z.avgLoss*z.setupScore*.20+z.repeatablePotential*.35,0)):0;
    const setupLow=setupUpper>.06?setupUpper*.30:0;

    const priorities=[...zones]
      .filter(z=>z.avgLoss>.010||z.repeatablePotential>.010||z.driverScore>.45||z.setupScore>.50)
      .sort((a,b)=>b.priority-a.priority).slice(0,3)
      .map((z,i)=>({rank:i+1,label:z.label,diagnosis:z.diagnosis,confidence:z.confidence,loss:z.avgLoss,advice:this.adviceFor(z),evidence:z.evidence.slice(0,2)}));

    let verdict="Pilotagem e repetibilidade são a prioridade.";
    if(setupShare>.52&&setupCandidates.length>=2)verdict="Há sinais repetíveis de balance que justificam um teste A/B de setup.";
    else if(driverShare>.62)verdict="A maior parte da oportunidade está na execução do piloto, não no setup.";
    else if(setupCandidates.length&&driverShare>.35)verdict="Há uma combinação de execução do piloto e possível influência do setup.";

    // Last chronologically supplied valid lap versus fastest valid lap.
    // No fictional traces: every ordinate is interpolated from stored telemetry.
    const channel=(lap,key)=>Array.from({length:121},(_,i)=>{
      const value=AMSAnalysis.interpolate(lap,i/120,key);
      return Number.isFinite(value)?Number(value):null;
    });
    const lapComparison={
      latestTime:currentLap.lapTimeSec,
      bestTime,
      speedCurrent:channel(currentLap,"speed"),speedBest:channel(bestLap,"speed"),
      throttleCurrent:channel(currentLap,"throttle"),throttleBest:channel(bestLap,"throttle")
    };

    return {
      ok:true,context,map,lapCount:prepared.length,bestTime,consistentPace:pace,lapStdDev:lapSd,consistency,achievable,absoluteTheoretical,
      repeatablePotential,driverPotential,driverShare,setupShare,balanceTelemetry,verdict,priorities,zones,lapComparison,
      setupPotential:{low:setupLow,high:setupUpper,confidence:setupCandidates.length?Math.round(this.mean(setupCandidates.map(z=>z.confidence))||0):0,candidates:setupCandidates.length}
    };
  },
  render(report){
    this.currentReport=report?.ok?report:null;
    const set=(id,value)=>{ const el=document.getElementById(id); if(el)el.textContent=value; };
    if(!report?.ok){
      set("engineerStatus",report?.reason||"Sem dados suficientes.");
      for(const id of ["engineerBestLap","engineerPace","engineerAchievable","engineerConsistency","engineerAbsolute","engineerDriverPotential","engineerDriverShare","engineerSetupShare","engineerSetupPotential","engineerSetupConfidence"])set(id,"—");
      set("engineerVerdict","Analisa uma sessão para gerar o diagnóstico.");
      set("engineerSetupText","A estimativa depende de evidência repetível da sessão.");
      for(const id of ["engineerDriverBar","engineerSetupBar"]){const bar=document.getElementById(id);if(bar)bar.style.width="0%";}
      const priority=document.getElementById("engineerPriorities");if(priority)priority.textContent="Sem análise.";
      window.AMSEngineerCoaching.renderEvidence(report);
      window.AMSEngineerMockupPanels?.render(report);
      window.dispatchEvent(new CustomEvent("ams-engineer-analysis",{detail:{report}}));
      return;
    }
    set("engineerStatus","EVIDENCE ENGINE · "+report.lapCount+" VOLTAS");
    set("engineerBestLap",this.fmtLap(report.bestTime));
    set("engineerPace",this.fmtLap(report.consistentPace));
    set("engineerAchievable",this.fmtLap(report.achievable));
    set("engineerConsistency",report.consistency+"/100");
    set("engineerVerdict",report.verdict);
    set("engineerAbsolute",this.fmtLap(report.absoluteTheoretical));
    set("engineerDriverPotential",report.driverPotential>0?report.driverPotential.toFixed(2)+"s":"—");

    const setup=report.setupPotential;
    if(setup.high>.015){
      set("engineerSetupPotential",setup.low.toFixed(2)+"–"+setup.high.toFixed(2)+"s");
      set("engineerSetupConfidence",setup.confidence+"%");
      set("engineerSetupText","Estimativa provisória baseada em padrões repetíveis de balance. Para quantificar o ganho real, o AMS deve comparar stints A/B com snapshots de setup.");
    }else{
      set("engineerSetupPotential","NÃO PRIORITÁRIO");
      set("engineerSetupConfidence",setup.candidates?setup.confidence+"%":"—");
      set("engineerSetupText",report.balanceTelemetry?"Não há evidência forte de que uma alteração de setup seja a prioridade neste stint. Estabiliza primeiro a pilotagem e volta a medir.":"Faltam canais de dinâmica suficientes para atribuir perda ao setup com confiança.");
    }

    const driverBar=document.getElementById("engineerDriverBar"),setupBar=document.getElementById("engineerSetupBar");
    if(driverBar)driverBar.style.width=(report.driverShare*100).toFixed(0)+"%";
    if(setupBar)setupBar.style.width=(report.setupShare*100).toFixed(0)+"%";
    set("engineerDriverShare",(report.driverShare*100).toFixed(0)+"%");
    set("engineerSetupShare",(report.setupShare*100).toFixed(0)+"%");

    const priorityHost=document.getElementById("engineerPriorities");
    if(priorityHost){
      priorityHost.innerHTML="";
      for(const p of report.priorities){
        const row=document.createElement("div");
        row.className="engineer-priority";
        row.innerHTML='<div class="engineer-priority-rank">P'+p.rank+'</div><div><strong>'+p.label+'</strong><span>'+p.evidence.join(" · ")+'</span><p>'+p.advice+'</p></div><div class="engineer-priority-meta"><span class="engineer-tag '+p.diagnosis.toLowerCase()+'">'+p.diagnosis+'</span><b>'+p.confidence+'%</b></div>';
        priorityHost.appendChild(row);
      }
      if(!report.priorities.length)priorityHost.textContent="Sem oportunidades dominantes detetadas neste stint.";
    }

    window.AMSEngineerMockupPanels?.render(report);

    window.AMSEngineerCoaching.renderEvidence(report);
    window.dispatchEvent(new CustomEvent("ams-engineer-analysis",{detail:{report}}));
  }
};
