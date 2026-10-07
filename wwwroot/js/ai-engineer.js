window.AMSAIEngineer={
  text(id){return document.getElementById(id)?.textContent?.trim()||"—";},
  report(){
    const rows=[...document.querySelectorAll("#engineerEvidenceBody tr")].map(tr=>{
      const c=[...tr.querySelectorAll("td")].map(td=>td.textContent.trim());
      return {zone:c[0]||"—",median_loss:c[1]||"—",time_sigma:c[2]||"—",brake_sigma:c[3]||"—",throttle_sigma:c[4]||"—",min_speed_sigma:c[5]||"—",diagnosis:c[6]||"—",confidence:c[7]||"—"};
    });
    return {
      ok:rows.length>0,
      best_lap:this.text("engineerBestLap"),
      consistent_pace:this.text("engineerPace"),
      achievable_lap:this.text("engineerAchievable"),
      consistency:this.text("engineerConsistency"),
      verdict:this.text("engineerVerdict"),
      driver_influence:this.text("engineerDriverShare"),
      setup_influence:this.text("engineerSetupShare"),
      absolute_theoretical:this.text("engineerAbsolute"),
      driver_opportunity:this.text("engineerDriverPotential"),
      setup_potential:this.text("engineerSetupPotential"),
      setup_confidence:this.text("engineerSetupConfidence"),
      setup_assessment:this.text("engineerSetupText"),
      priorities:[...document.querySelectorAll("#engineerPriorities .engineer-priority")].map(x=>x.textContent.replace(/\s+/g," ").trim()),
      evidence_rows:rows
    };
  },
  async ask(question=""){
    const output=document.getElementById("engineerAiOutput"),status=document.getElementById("engineerAiStatus");
    const brief=document.getElementById("engineerAiBtn"),ask=document.getElementById("engineerAskBtn");
    const report=this.report();
    if(!report.ok){
      if(output)output.textContent="Analisa primeiro uma sessão no Virtual Performance Engineer.";
      if(status)status.textContent="SEM RELATÓRIO";
      return;
    }
    if(brief)brief.disabled=true;if(ask)ask.disabled=true;
    if(output)output.textContent="A analisar a evidência da sessão…";
    if(status)status.textContent="AI · A ANALISAR";
    try{
      const sessionToken=await AMSAuth.token();
      if(!sessionToken)throw new Error("Sessão de login necessária.");
      const data=await AMSSupabase.request("/functions/v1/virtual-engineer",{
        token:sessionToken,method:"POST",
        body:{report,question:String(question||"").trim(),context:{
          simulator:this.text("simName"),circuit:this.text("trackName"),car:this.text("carName"),
          session:document.getElementById("engineerSessionSelect")?.selectedOptions?.[0]?.textContent||"—"
        }}
      });
      if(output)output.textContent=data?.text||"Sem resposta do Virtual Engineer.";
      if(status)status.textContent=(data?.model||"AI")+" · CONCLUÍDO";
    }catch(err){
      const msg=String(err?.message||err);
      if(output)output.textContent=(msg.includes("OPENAI_API_KEY")||msg.includes("AI_NOT_CONFIGURED"))?"A integração AI está instalada, mas falta configurar a chave da API no backend.":"Não foi possível gerar o briefing: "+msg;
      if(status)status.textContent="AI INDISPONÍVEL";
    }finally{
      if(brief)brief.disabled=false;if(ask)ask.disabled=false;
    }
  },
  init(){
    const brief=document.getElementById("engineerAiBtn"),ask=document.getElementById("engineerAskBtn"),input=document.getElementById("engineerQuestion");
    brief?.addEventListener("click",()=>this.ask(""));
    ask?.addEventListener("click",()=>this.ask(input?.value||""));
    input?.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();this.ask(input.value||"");}});
  }
};
requestAnimationFrame(()=>AMSAIEngineer.init());
