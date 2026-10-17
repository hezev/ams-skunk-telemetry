/* v6 Desktop-only Team / Settings. Loaded only by WebView2; web portal is untouched. */
(()=>{
"use strict";
if(!window.chrome?.webview||document.getElementById("amsV6Settings"))return;
const $=(s,root=document)=>root.querySelector(s);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
const btn=(label,handler,accent=false)=>{const b=el("button","v6-btn"+(accent?" primary":""),label);b.type="button";b.addEventListener("click",handler);return b};
const info=(label,val,subtitle)=>{const box=el("div","v6-stat");box.append(el("span","v6-muted",label),el("strong","v6-number",val),el("small","v6-muted",subtitle||""));return box};
const card=(title,description)=>{const box=el("article","v6-card");box.append(el("h3","",title));if(description)box.append(el("p","v6-muted",description));return box};
const native=(kind,props={})=>window.chrome.webview.postMessage(Object.assign({kind:"ams.desktop."+kind},props));
const state={mobile:null,sim:"À espera de simulador",lastCloud:"",tab:"AMSports Mobile",unit:localStorage.getItem("ams.v6.units")||"metric"};
const tabs=["AMSports Mobile","Diagnóstico","Conta AMS","Unidades","Vídeo / OBS","Privacidade","Atualizações"];
const nav=$("#mainNav");
const settingsButton=el("button","","Settings");
settingsButton.type="button";settingsButton.dataset.view="amsV6Settings";nav.append(settingsButton);
const view=el("section","view v6-settings-view");view.id="amsV6Settings";
view.append(el("div","v6-title","SETTINGS"),el("p","v6-subtitle","Definições e ligações · Mobile, conta, unidades, OBS, privacidade e atualizações."));
const columns=el("div","v6-settings-layout");
const rail=el("div","v6-settings-rail"),body=el("div","v6-settings-body");
columns.append(rail,body);view.append(columns);$(".content").append(view);
function showSettings(){
  document.querySelectorAll(".view").forEach(n=>n.classList.remove("active"));
  document.querySelectorAll("#mainNav button").forEach(n=>n.classList.remove("active"));
  settingsButton.classList.add("active");view.classList.add("active");render();
}
settingsButton.addEventListener("click",showSettings);
nav.addEventListener("click",e=>{if(e.target!==settingsButton&&e.target.closest("button")!==settingsButton){view.classList.remove("active");}});
function setTab(tab){state.tab=tab;render();}
function render(){rail.replaceChildren();tabs.forEach(t=>{
  const b=btn(t,()=>setTab(t));b.classList.add("v6-rail-btn");if(t===state.tab)b.classList.add("selected");rail.append(b);
});body.replaceChildren();const work=({
"AMSports Mobile":renderMobile,"Diagnóstico":renderDiagnostics,"Conta AMS":renderAccount,
"Unidades":renderUnits,"Vídeo / OBS":renderOBS,"Privacidade":renderPrivacy,"Atualizações":renderUpdates
})[state.tab];work?.();}
function mobileState(){return state.mobile||{enabled:false,port:0,pin:"—",ips:[],clients:0,pairing:"",qr:null};}
function mobileCommand(action,props){native("mobile."+action,props);setTimeout(()=>native("mobile.status"),450);}
function renderMobile(){
  const m=mobileState(),a=card("EMPARELHAMENTO AMSPORTS MOBILE","O telemóvel ou tablet recebe a telemetria diretamente deste programa pela rede local. A aplicação não necessita de coletor.");
  const layout=el("div","v6-mobile-layout"),qrBox=el("div","v6-qr-box");
  qrBox.append(el("h4","","LER QR CODE"));
  if(m.qr){const img=el("img","v6-qr");img.src=m.qr;img.alt="QR de emparelhamento AMSports Mobile";qrBox.append(img);}
  else qrBox.append(el("div","v6-qr-placeholder","Ativa o serviço e liga o PC à rede local para gerar o QR"));
  const grid=el("div","v6-stats-grid");
  grid.append(info("SERVIÇO",m.enabled?"Ativo":"Desativado","Rede local · SSE"),
    info("IP LOCAL",m.ips?.[0]||"—","Mesmo Wi-Fi do PC"),
    info("PORTA",m.port||"—","8181–8190"),
    info("PIN",m.enabled?m.pin:"—","6 dígitos"),
    info("DISPOSITIVOS",m.clients||0,"Ligados agora"),info("PROTOCOLO",m.mode||"SSE","Compatível com Android"));
  const details=el("div","v6-mobile-details");details.append(grid);
  details.append(el("span","v6-muted","Alternativa manual"));
  const uri=el("code","v6-uri",m.pairing||"Aguardando serviço local");details.append(uri);
  const controls=el("div","v6-buttons");
  controls.append(btn(m.enabled?"Desativar mobile":"Ativar mobile",()=>mobileCommand("toggle",{enabled:!m.enabled}),true),
    btn("Gerar novo PIN",()=>mobileCommand("rotate")),
    btn("Atualizar",()=>native("mobile.status")));
  details.append(controls);layout.append(qrBox,details);a.append(layout);
  const steps=el("div","v6-steps");
  ["Abrir AMSports Mobile no Android e ligar à mesma rede Wi-Fi.","Ler QR ou introduzir IP, porta e PIN na aplicação.","Confirmar ligação e iniciar o simulador para receber dados reais."].forEach((s,i)=>{const v=el("div","v6-step");v.append(el("b","",String(i+1)),el("span","",s));steps.append(v);});
  a.append(steps);body.append(a);
}
function renderDiagnostics(){
  const a=card("DIAGNÓSTICO DE LIGAÇÕES","Estado real do serviço local e da ligação à conta AMS.");
  const m=mobileState(),grid=el("div","v6-stats-grid");
  grid.append(info("SIMULADOR",state.sim,"Origem de telemetria"),info("CONTA AMS",AMSAuth.user?.email||"Desligada","Autenticação Supabase"),
    info("MOBILE",m.enabled?"Ativo":"Desativado","SSE · rede local"),info("DISPOSITIVOS",m.clients||0,"Sessões Android"));
  a.append(grid,btn("Verificar novamente",()=>native("mobile.status")));body.append(a);
  const b=card("Verificações","A gravação de telemetria continua localmente. A sincronização Cloud requer conta autenticada e ligação à Internet.");
  b.append(el("p","", "Versão da aplicação: 6.0.0 · motor de aquisição iRacing integrado · outros simuladores em migração."));body.append(b);
}
function renderAccount(){
 const a=card("CONTA AMS E CLOUD","Identidade partilhada com o portal skunk.pt. Nunca é utilizada uma chave de administração dentro da aplicação.");
 const grid=el("div","v6-stats-grid");
 grid.append(info("CONTA AMS",AMSAuth.user?.email||"Sem sessão","Piloto autenticado"),info("SYNC CLOUD",AMSAuth.user?"Disponível":"Aguarda login","Autorização RLS"),
    info("ARQUIVO LOCAL","Ativo","Canais completos guardados no PC"),info("VÍDEO","Local","Não é enviado à Cloud"));
 a.append(grid,btn(AMSAuth.user?"Consultar conta":"Abrir conta / LOGIN",()=>{
  if(!AMSAuth.user)$("#loginBtn")?.click();else document.querySelector('[data-view="team"]')?.click();
 },true));body.append(a);
}
function renderUnits(){
 const a=card("UNIDADES E FORMATAÇÃO","Esta opção modifica indicadores visuais da aplicação. Os dados brutos gravados permanecem nas unidades originais.");
 const row=el("div","v6-buttons");row.append(btn("Métrico · km/h · °C",()=>setUnits("metric"),state.unit==="metric"),
  btn("Imperial · mph · °F",()=>setUnits("imperial"),state.unit==="imperial"));a.append(row);
 a.append(el("p","v6-muted","Nesta versão o seletor aplica-se aos indicadores de Live suportados. A conversão de todos os gráficos ainda está em desenvolvimento."));body.append(a);
}
function setUnits(unit){state.unit=unit;localStorage.setItem("ams.v6.units",unit);render();}
function renderOBS(){
 const a=card("VÍDEO / OBS","Integração local com OBS Studio para associar vídeo às sessões.");
 const grid=el("div","v6-stats-grid");
 grid.append(info("ENDEREÇO","127.0.0.1:4455","OBS WebSocket v5"),info("MODO","Localhost","Ligação no mesmo PC"));
 a.append(grid);
 a.append(el("p","v6-muted","A gravação automática e a sincronização dos clips ainda não foram migradas do motor Go. Nenhum vídeo é enviado para a Cloud."));body.append(a);
}
function renderPrivacy(){
 const a=card("PRIVACIDADE","Mantemos o controlo de acesso no Supabase e o emparelhamento Mobile restrito à rede local.");
 const list=el("div","v6-privacy");
 [
 ["TELEMETRIA LOCAL","Gravação no PC","Os canais completos do SDK são mantidos localmente."],
 ["CLOUD AMS","Conta autenticada","As voltas e o Live são sincronizados usando a identidade do piloto."],
 ["DISPOSITIVOS MOBILE",mobileState().enabled?"Em transmissão":"Desativados","PIN de seis dígitos; não expor em redes públicas."],
 ["VÍDEO / OBS","Local","Os clips não são enviados automaticamente."]
 ].forEach(([h,v,d])=>{const c=card(h,d);c.prepend(el("strong","v6-number",v));list.append(c)});a.append(list);
 a.append(btn(mobileState().enabled?"Desativar transmissão Mobile":"Abrir definições Mobile",()=>setTab("AMSports Mobile"),true));body.append(a);
}
function renderUpdates(){
 const a=card("VERSÃO E ATUALIZAÇÕES","A aplicação v6 é uma evolução independente do programa anterior.");
 a.append(info("VERSÃO","6.0.0","Windows 64-bit · preview"),
  el("p","v6-muted","Esta versão não ativa o antigo atualizador Go. O canal de atualização autenticado terá de ser migrado e testado antes da distribuição pública."));
 const b=btn("Abrir versões no GitHub",()=>window.open("https://github.com/hezev/ams-skunk-telemetry/releases","_blank"));a.append(b);body.append(a);
}
const team=$("#team");
if(team){
 const title=team.querySelector(".titlebar");
 if(title)title.insertAdjacentHTML("afterend",'<div class="v6-team-grid" id="v6TeamCards"><article class="v6-card"><h3>Conta AMS</h3><strong id="v6TeamAccount">—</strong><p class="v6-muted" id="v6TeamPilot">—</p></article><article class="v6-card"><h3>Pilotos e permissões</h3><p class="v6-muted">O acesso a pilotos e treinadores depende de permissões reais do Supabase. Não apresentamos equipas simuladas.</p><button class="v6-btn primary" type="button" id="v6TeamLogin">Abrir conta / LOGIN</button></article><article class="v6-card"><h3>Equipa</h3><p class="v6-muted">Os pilotos disponíveis para esta conta aparecem na tabela abaixo, conforme as regras de acesso.</p></article></div><article class="v6-card v6-team-summary"><h3>Resumo do arquivo</h3><p id="v6TeamArchive" class="v6-muted">A carregar voltas...</p></article>');
 $("#v6TeamLogin")?.addEventListener("click",()=>$("#loginBtn")?.click());
}
async function teamRefresh(){
 if(!team)return;
 const u=AMSAuth.user;$("#v6TeamAccount").textContent=u?.email||"Sem login";
 $("#v6TeamPilot").textContent=u?"Piloto · "+(u.user_metadata?.pilot_name||u.email):"Inicia sessão AMS para carregar os dados";
 if(!u){$("#v6TeamArchive").textContent="Inicia sessão para consultar o arquivo.";return;}
 try{
   const token=await AMSAuth.token();if(!token)return;
   const laps=await AMSSupabase.getLaps(token,u.id)||[];
   const valid=laps.map(x=>Number(x.lap_time_ms)).filter(Number.isFinite);
   const best=valid.length?Math.min(...valid):null;
   const formatted=best==null?"—":(Math.floor(best/60000)+":"+(best%60000/1000).toFixed(3).padStart(6,"0"));
   $("#v6TeamArchive").textContent=laps.length+" voltas disponíveis · melhor tempo "+formatted;
 }catch(e){$("#v6TeamArchive").textContent="Não foi possível consultar o arquivo: "+String(e.message||e);}
}
document.addEventListener("ams-auth-changed",()=>{teamRefresh();if(view.classList.contains("active"))render();});
document.querySelector('[data-view="team"]')?.addEventListener("click",()=>setTimeout(teamRefresh,100));
window.chrome.webview.addEventListener("message",e=>{
 const msg=e.data||{};
 if(msg.kind==="ams.desktop.mobile.status"){state.mobile=msg.state;if(view.classList.contains("active"))render();}
 if(msg.kind==="ams.desktop.mobile.error")alert("AMSports Mobile: "+(msg.message||"Erro"));
 if(msg.kind==="ams.desktop.sim.status"){state.sim=msg.message||state.sim;if(view.classList.contains("active")&&state.tab==="Diagnóstico")render();}
});
const initialSet=window.AMSRealtime?.set;
if(initialSet&&!window.AMSRealtime._v6Wrapped){
 window.AMSRealtime._v6Wrapped=true;
 window.AMSRealtime.set=function(id,value){
  let v=value;
  if(state.unit==="imperial"&&id==="speed"&&Number.isFinite(Number(value)))v=(Number(value)*.621371).toFixed(0);
  return initialSet.call(this,id,v);
 };
}
native("mobile.status");teamRefresh();
})();
