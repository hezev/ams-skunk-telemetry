/* Driving-only coaching shared by the evidence table and AI request. */
window.AMSEngineerCoaching={
  finite:v=>typeof v==='number'&&Number.isFinite(v),
  tr(pt,en){return window.AMSi18n?.getLanguage?.()==='en'?en:pt;},
  zones(report){
    if(!report?.ok)return [];
    return (report.zones||[]).filter(z=>{
      const e=z.drivingEvidence;
      if(z.diagnosis!=='DRIVER'||!e||!this.finite(e.loss)||e.loss<.05)return false;
      return (z.brakeSamples>=3&&this.finite(e.brakeShiftP)&&Math.abs(e.brakeShiftP)>.0014)||
        (z.throttleSamples>=3&&this.finite(e.throttleShiftP)&&Math.abs(e.throttleShiftP)>.0022)||
        (z.minSpeedSamples>=3&&this.finite(e.minSpeedLoss)&&e.minSpeedLoss>2.4);
    }).sort((a,b)=>b.drivingEvidence.loss-a.drivingEvidence.loss||a.index-b.index);
  },
  lesson(z){
    const e=z.drivingEvidence,pt=this.tr.bind(this);
    let cause,observation,action,practice;
    if(z.throttleSamples>=3&&this.finite(e.throttleShiftP)&&e.throttleShiftP>.0022){
      cause='exit';
      observation=pt('Começas a acelerar mais tarde do que na tua melhor volta.','You start accelerating later than on your best lap.');
      action=pt('Prepara a saída antes do vértice: olha para a saída e endireita o volante à medida que aplicas o acelerador progressivamente.','Prepare the exit before the apex: look towards the exit and unwind the steering as you progressively apply the throttle.');
      practice=pt('Repete três passagens com a mesma entrada. Confirma se consegues começar a acelerar mais cedo, sem correções adicionais, e reduzir a perda nesta zona.','Repeat three passes with the same entry. Check whether you can start accelerating earlier without extra corrections and reduce the loss in this zone.');
    }else if(z.brakeSamples>=3&&this.finite(e.brakeShiftP)&&e.brakeShiftP<-.0014){
      cause='early-braking';
      observation=pt('Começas a travar mais cedo do que na tua melhor volta.','You start braking earlier than on your best lap.');
      action=pt('Escolhe uma referência visível para travar e aproxima-a gradualmente da passagem de referência. Mantém a libertação do travão suave.','Choose a visible braking marker and gradually bring it closer to the reference pass. Keep the brake release smooth.');
      practice=pt('Faz três passagens e altera apenas o ponto de travagem. Mantém o ponto de viragem e confirma se a perda diminui sem comprometer a saída.','Make three passes and change only the braking point. Keep the turn-in point and check whether the loss decreases without compromising the exit.');
    }else if(z.brakeSamples>=3&&this.finite(e.brakeShiftP)&&e.brakeShiftP>.0014){
      cause='late-braking';
      observation=pt('Começas a travar mais tarde do que na tua melhor volta, mas esta passagem é mais lenta.','You start braking later than on your best lap, but this pass is slower.');
      action=pt('Volta a uma referência de travagem repetível. Termina a fase mais forte da travagem antes de pedir mais rotação ao carro e liberta o pedal progressivamente.','Return to a repeatable braking marker. Finish the strongest braking phase before asking the car for more rotation, then release the pedal progressively.');
      practice=pt('Repete três passagens sem atrasar mais a travagem. Compara a velocidade de passagem e a aplicação do acelerador para confirmar se recuperaste tempo.','Repeat three passes without braking any later. Compare the corner speed and throttle application to check whether you recovered time.');
    }else if(z.minSpeedSamples>=3&&this.finite(e.minSpeedLoss)&&e.minSpeedLoss>2.4){
      cause='corner-speed';
      observation=pt('A velocidade mínima é inferior à da tua melhor volta.','Your minimum speed is lower than on your best lap.');
      action=pt('Mantém a referência de travagem e trabalha a libertação do pedal e o ponto de viragem. Procura uma passagem mais fluida, sem acrescentar movimentos bruscos ao volante.','Keep the braking marker and work on brake release and turn-in. Aim for a smoother passage without adding abrupt steering inputs.');
      practice=pt('Faz três passagens com a mesma entrada. Confirma se a velocidade mínima melhora e a perda diminui, mantendo uma saída controlada.','Make three passes with the same entry. Check whether minimum speed improves and the loss decreases while keeping the exit controlled.');
    }else{
      cause='throttle-consistency';
      observation=pt('A aplicação do acelerador difere da melhor volta e varia entre passagens.','Throttle application differs from your best lap and varies between passes.');
      action=pt('Usa a mesma referência de saída e aumenta o acelerador de forma progressiva, acompanhando a abertura do volante.','Use the same exit marker and build the throttle progressively as you unwind the steering.');
      practice=pt('Repete três passagens sem mudar a entrada. Procura uma aplicação mais repetível do acelerador e confirma se o tempo da zona melhora.','Repeat three passes without changing the entry. Aim for more repeatable throttle application and check whether the zone time improves.');
    }
    const focus={
      exit:pt('Preparar a saída e aplicar o acelerador progressivamente.','Prepare the exit and apply the throttle progressively.'),
      'early-braking':pt('Aproximar gradualmente a referência de travagem.','Gradually bring the braking marker closer to the reference.'),
      'late-braking':pt('Estabilizar a travagem antes de procurar travar mais tarde.','Stabilise braking before trying to brake later.'),
      'corner-speed':pt('Trabalhar a libertação do travão e a fluidez da passagem.','Work on brake release and a smoother passage.'),
      'throttle-consistency':pt('Repetir a mesma progressão do acelerador na saída.','Repeat the same throttle progression on exit.')
    }[cause];
    return {zone:z.index,label:z.label,start:z.start,end:z.end,loss:e.loss,cause,observation,action,practice,focus};
  },
  lessons(report,limit=3){
    const official=!!report?.map?.turns?.length,groups=[];
    for(const z of this.zones(report).sort((a,b)=>a.start-b.start)){
      const lesson=this.lesson(z),last=groups[groups.length-1];
      if(last&&Math.abs(last.end-lesson.start)<.000001&&last.cause===lesson.cause&&(!official||last.label===lesson.label)){
        last.end=lesson.end;last.lastZone=lesson.zone;last.loss+=lesson.loss;
      }else groups.push({...lesson,lastZone:lesson.zone});
    }
    for(const g of groups){
      if(!official){
        const number=g.zone===g.lastZone?String(g.zone):g.zone+'–'+g.lastZone;
        g.label=this.tr(g.zone===g.lastZone?'Zona ':'Zonas ',g.zone===g.lastZone?'Zone ':'Zones ')+number+' · '+(g.start*100).toFixed(0)+'–'+(g.end*100).toFixed(0)+'%';
      }
    }
    return groups.sort((a,b)=>b.loss-a.loss||a.zone-b.zone).slice(0,limit);
  },
  compactWorkspace(){
    const view=document.getElementById('engineer'),details=view?.querySelector('.engineer-secondary-details');
    if(!details)return;
    for(const selector of ['.engineer-mockup-kpis','.engineer-mockup-insights-column','.engineer-priority-card','.engineer-scorecard-card','.ams-enhancement-grid',':scope > .ams-work-card']){
      const panel=view.querySelector(selector);if(panel)details.appendChild(panel);
    }
    const layout=view.querySelector('.engineer-mockup-layout'),table=document.getElementById('engineerEvidenceBody')?.closest('.table-card');
    if(layout&&table)layout.after(table);
  },
  empty(report){return report?.ok?
    this.tr('Não foram confirmadas perdas de condução na última volta. Só são mostradas zonas com perda de tempo e diferenças de condução sustentadas por passagens comparáveis.','No driving losses were confirmed on the latest lap. Only zones with time loss and driving differences supported by comparable passes are shown.'):
    this.tr('Analisa uma sessão para identificar onde melhorar a condução.','Analyze a session to identify where to improve your driving.');},
  renderEvidence(report){
    const body=document.getElementById('engineerEvidenceBody');if(!body)return;
    body.replaceChildren();
    const lessons=this.lessons(report,Infinity);
    const empty=document.getElementById('engineerEvidenceEmpty');
    if(empty){empty.hidden=lessons.length>0;empty.textContent=this.empty(report);}
    for(const lesson of lessons){
      const row=document.createElement('tr');row.dataset.zone=String(lesson.zone);
      for(const value of [lesson.label,'+'+lesson.loss.toFixed(3)+'s',lesson.observation,lesson.focus]){
        const cell=document.createElement('td');cell.textContent=value;row.appendChild(cell);
      }
      body.appendChild(row);
    }
  }
};
