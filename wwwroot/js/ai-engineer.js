/* Explain measured driving weaknesses. The local lesson remains usable without AI. */
window.AMSAIEngineer={
  revision:0,
  tr(pt,en){return window.AMSEngineerCoaching.tr(pt,en);},
  lessons(){return window.AMSEngineerCoaching.lessons(window.AMSEngineer?.currentReport);},
  report(){
    const analysis=window.AMSEngineer?.currentReport,lessons=this.lessons();
    return {ok:!!analysis?.ok&&lessons.length>0,mode:'driving_coach',
      comparison:'Latest valid lap versus best complete lap of the selected session',
      coaching_zones:lessons.map(l=>({zone:l.zone,location:l.label,loss_seconds:l.loss,observation:l.observation,
        action:l.action,practice:l.practice})),
      response_format:{lessons:[{zone:'existing zone number',action:'one short teaching step',practice:'one short drill and how to check improvement'}]}};
  },
  render(lessons=this.lessons()){
    const host=document.getElementById('engineerAiOutput');if(!host)return;
    host.replaceChildren();
    if(!lessons.length){host.textContent=window.AMSEngineerCoaching.empty(window.AMSEngineer?.currentReport);return;}
    const add=(tag,text,parent,cls)=>{const el=document.createElement(tag);el.textContent=text;if(cls)el.className=cls;parent.appendChild(el);return el;};
    lessons.forEach((lesson,index)=>{
      const card=document.createElement('details');card.className='engineer-coach-lesson';card.open=index===0;
      const summary=document.createElement('summary');
      add('strong',lesson.label,summary);add('span','+'+lesson.loss.toFixed(3)+'s',summary);
      card.appendChild(summary);
      add('p',lesson.observation,card,'engineer-coach-observation');
      add('h4',this.tr('O que mudar','What to change'),card);add('p',lesson.action,card);
      add('h4',this.tr('Como praticar e verificar','How to practise and check'),card);add('p',lesson.practice,card);
      host.appendChild(card);
    });
  },
  readResponse(text,lessons){
    let parsed;
    try{parsed=JSON.parse(String(text||'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''));}catch{return null;}
    if(!Array.isArray(parsed?.lessons)||!parsed.lessons.length||parsed.lessons.length>3)return null;
    const known=new Map(lessons.map(l=>[l.zone,l])),seen=new Set(),updates=new Map();
    for(const item of parsed.lessons){
      if(!known.has(item?.zone)||seen.has(item.zone))return null;
      seen.add(item.zone);
      const unrelated=/\b(?:setup|springs?|dampers?|differential|molas?|amortecedores|diferencial|aero|pressões|pressures|INCONCLUSIVE|BOTH)\b|σ/iu;
      if(['action','practice'].some(k=>typeof item[k]!=='string'||!item[k].trim()||item[k].length>280||/\d/.test(item[k])||unrelated.test(item[k])))return null;
      updates.set(item.zone,{action:item.action.trim(),practice:item.practice.trim()});
    }
    return lessons.map(l=>({...l,...updates.get(l.zone)}));
  },
  busy(value){for(const id of ['engineerAiBtn','engineerAskBtn']){const b=document.getElementById(id);if(b)b.disabled=value;}},
  status(text){const el=document.getElementById('engineerAiStatus');if(el)el.textContent=text;},
  async ask(question=''){
    const analysis=window.AMSEngineer?.currentReport,lessons=this.lessons(),report=this.report();
    if(!report.ok){this.render();return;}
    const revision=++this.revision,language=window.AMSi18n?.getLanguage?.()==='en'?'en':'pt-PT';
    const current=()=>revision===this.revision&&window.AMSEngineer?.currentReport===analysis;
    this.busy(true);this.status(this.tr('A preparar orientação…','Preparing guidance…'));
    const instructions='Responde apenas JSON: {"lessons":[{"zone":numero_existente,"action":"texto","practice":"texto"}]}. '+
      'Usa apenas coaching_zones do relatório, no máximo três. Explica didaticamente como melhorar a condução nos pontos fracos. '+
      'action: uma mudança concreta na próxima passagem. practice: um exercício simples e como verificar a melhoria. '+
      'Cada texto até 280 caracteres. Não uses algarismos nos textos, jargão estatístico, setup, percentagens ou ganhos prometidos. '+
      'Não inventes zonas, causas ou medidas. Não incluas introdução, diagnóstico geral ou resumo. '+
      'Pergunta do piloto: '+String(question||'Como melhorar estes pontos fracos?').trim().slice(0,350);
    try{
      const token=await AMSAuth.token();if(!current())return;
      if(!token)throw Error('Sign in required');
      const data=await AMSSupabase.request('/functions/v1/virtual-engineer',{token,method:'POST',body:{report,question:instructions,language,
        context:{simulator:analysis.context?.simulator||'',circuit:analysis.context?.circuit||'',car:analysis.context?.car||'',session_id:analysis.context?.sessionId||''}}});
      if(!current())return;
      const refined=this.readResponse(data?.text,lessons);
      this.render(refined||lessons);
      this.status(refined?this.tr('Orientação pronta','Guidance ready'):this.tr('Plano de treino disponível','Practice plan available'));
    }catch{
      if(!current())return;
      this.render(lessons);this.status(this.tr('Usa o plano de treino abaixo','Use the practice plan below'));
    }finally{if(current())this.busy(false);}
  },
  reset(){
    window.AMSEngineerCoaching.compactWorkspace();
    this.revision++;this.busy(false);this.render();
    window.AMSEngineerCoaching.renderEvidence(window.AMSEngineer?.currentReport);
    this.status(this.lessons().length?this.tr('Plano de treino pronto','Practice plan ready'):
      window.AMSEngineer?.currentReport?.ok?this.tr('Sem perdas confirmadas','No confirmed losses'):this.tr('À espera de análise','Awaiting analysis'));
  },
  init(){
    window.AMSEngineerCoaching.compactWorkspace();
    window.addEventListener('ams-engineer-analysis',()=>this.reset());
    document.addEventListener('ams:languagechange',()=>this.reset());
    const input=document.getElementById('engineerQuestion');
    document.getElementById('engineerAiBtn')?.addEventListener('click',()=>this.ask());
    document.getElementById('engineerAskBtn')?.addEventListener('click',()=>this.ask(input?.value||''));
    input?.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();this.ask(input.value);}});
    this.reset();
  }
};
requestAnimationFrame(()=>AMSAIEngineer.init());
