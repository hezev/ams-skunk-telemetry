/* Team access is authorised by Postgres. This module never changes live/replay feeds. */
(()=>{
  'use strict';
  const $=s=>document.querySelector(s),lang=()=>window.AMSi18n?.getLanguage?.()||localStorage.getItem('ams.language')||'pt';
  const t=(pt,en)=>lang()==='en'?en:pt;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let team=null,account=null,epoch=0,busy=false,available=true,sharedLaps=[],contextLaps=[],plan=null,planInput=null,invite=null;
  let signature='',draftRoster=new Map(),rosterOrder=[];
  const who=()=>window.AMSAuth?.user?.id;
  const names=()=>team?.members||[{id:who(),pilot_name:window.AMSAuth?.user?.user_metadata?.pilot_name||t('Tu','You')}].filter(m=>m.id);
  const peers=()=>names().filter(m=>m.id!==who()).map(m=>m.id);
  const orderedNames=()=>{
    const members=names();
    return [...rosterOrder.map(id=>members.find(m=>m.id===id)).filter(Boolean),...members.filter(m=>!rosterOrder.includes(m.id))];
  };
  const notify=()=>document.dispatchEvent(new CustomEvent('ams-team-access-changed'));
  async function rpc(action,payload={}){
    const id=who(),revision=epoch,token=await AMSAuth.token();
    if(!id||!token)throw Error('TEAM_LOGIN_REQUIRED');
    const result=await AMSSupabase.request('/rest/v1/rpc/ams_team',{token,method:'POST',body:{action,payload}});
    if(id!==who()||revision!==epoch)throw Error('TEAM_SESSION_CHANGED');
    return result;
  }
  function receive(data,{announce=true}={}){
    const prior=signature;
    const changed=JSON.stringify(team)!==JSON.stringify(data?.team||null)||!available;
    team=data?.team?.id&&Array.isArray(data.team.members)?data.team:null;
    signature=JSON.stringify([who(),team?.id,...names().map(m=>m.id).sort()]);
    available=true;
    if(prior!==signature){
      if(prior)epoch++;
      sharedLaps=[];contextLaps=[];draftRoster.clear();rosterOrder=[];plan=null;planInput=null;invite=null;
      renderRoster();renderResult();
      if(announce||prior)notify();
    }
    if(changed)renderTeam();renderPlanTools();
  }
  async function refresh({announce=true}={}){
    if(!who())return;
    try{receive(await rpc('snapshot'),{announce});}
    catch(error){
      if(error.message==='TEAM_SESSION_CHANGED')return;
      const hadPeers=peers().length>0;
      if(hadPeers)epoch++;
      team=null;signature='';sharedLaps=[];available=false;
      if(hadPeers){contextLaps=[];draftRoster.clear();rosterOrder=[];plan=null;planInput=null;renderRoster();renderResult();notify();}
      renderTeam();renderPlanTools();
    }
  }
  const errors={
    TEAM_ALREADY_MEMBER:['Já pertences a uma equipa. Sai dessa equipa antes de aceitar outro convite.','You already belong to a team. Leave it before accepting another invitation.'],
    TEAM_INVITE_INVALID:['O convite é inválido, expirou ou já foi utilizado.','The invitation is invalid, expired or already used.'],
    TEAM_OWNER_REQUIRED:['Só o responsável da equipa pode fazer esta alteração.','Only the team owner can make this change.'],
    TEAM_LOGIN_REQUIRED:['Inicia sessão para gerir a equipa.','Sign in to manage your team.'],
    TEAM_SESSION_CHANGED:['A sessão mudou. Tenta novamente.','The session changed. Please retry.'],
    TEAM_MEMBER_LIMIT:['A equipa atingiu o limite de 16 membros.','This team has reached the 16-member limit.'],
    TEAM_INVITE_LIMIT:['Cancela um convite pendente antes de criar outro.','Cancel a pending invitation before creating another.'],
    TEAM_PLAN_CHANGED:['Outro membro alterou o plano. Carrega o plano da equipa antes de guardar.','Another member changed the plan. Load the team plan before saving.'],
    TEAM_NOT_MEMBER:['Já não pertences a esta equipa. Atualiza a página.','You no longer belong to this team. Refresh the page.']
  };
  function message(error){const key=Object.keys(errors).find(k=>String(error?.message||error).includes(k));return key?t(...errors[key]):t('Não foi possível concluir. Verifica a ligação e tenta novamente.','Could not complete the operation. Check your connection and retry.');}
  function status(text){const el=$('#teamStatus');if(el)el.textContent=text;}
  async function mutate(action,payload={}){
    if(busy)return;busy=true;renderTeam();
    try{
      const result=await rpc(action,payload);receive(result);
      if(result.code)invite={code:result.code,expires_at:result.expires_at};
      if(action==='cancel_invite')invite=null;
      status(t('Equipa atualizada.','Team updated.'));
      renderTeam();
    }catch(error){status(message(error));}
    finally{busy=false;renderTeam();}
  }
  function button(action,label,id=''){return `<button type="button" class="ams-secondary" data-team-action="${action}" data-id="${esc(id)}" ${busy?'disabled':''}>${label}</button>`;}
  function renderTeam(){
    const root=$('#teamManagement');if(!root)return;
    const createValue=root.querySelector('#teamCreate input')?.value||'';
    const acceptValue=root.querySelector('#teamAccept input')?.value||'';
    if(!who())root.innerHTML=`<p>${t('Inicia sessão para criar ou entrar numa equipa.','Sign in to create or join a team.')}</p>`;
    else if(!available)root.innerHTML=`<p>${t('A gestão de equipas está indisponível. As tuas voltas continuam acessíveis.','Team management is unavailable. Your own laps remain accessible.')}</p>${button('refresh',t('Tentar novamente','Retry'))}`;
    else if(!team)root.innerHTML=`<div class="endurance-grid"><form id="teamCreate"><h3>${t('Criar equipa','Create a team')}</h3><label>${t('Nome da equipa','Team name')}<input name="name" maxlength="80" required autocomplete="off"></label><p>${t('Ao criar a equipa autorizas os membros que convidares a consultar as tuas voltas, telemetria, setups e dados em direto. Só podes pertencer a uma equipa de cada vez.','Creating a team lets invited members read your laps, telemetry, setups and live data. You can belong to one team at a time.')}</p><button class="ams-primary" ${busy?'disabled':''}>${t('Criar equipa e partilhar','Create team and share')}</button></form><form id="teamAccept"><h3>${t('Entrar com convite','Join with an invitation')}</h3><label>${t('Código de convite','Invitation code')}<input name="code" minlength="64" maxlength="64" required autocomplete="off" spellcheck="false"></label><p>${t('Ao aceitar, tu e os restantes membros passam a consultar os dados uns dos outros. Cada piloto mantém o controlo das suas gravações. Podes sair da equipa a qualquer momento.','Accepting gives you and the other members read access to each other’s data. Each pilot controls their own recordings. You can leave at any time.')}</p><button class="ams-primary" ${busy?'disabled':''}>${t('Aceitar e partilhar telemetria','Accept and share telemetry')}</button></form></div>`;
    else{
      const owner=team.owner_id===who();
      root.innerHTML=`<div class="team-toolbar"><h2>${esc(team.name)}</h2>${owner?button('invite',t('+ Adicionar membro','+ Add member')):button('leave',t('Sair da equipa','Leave team'))}${owner?button('disband',t('Dissolver equipa','Disband team')):''}</div><p>${t('Partilha de leitura entre os membros. Remover um membro ou sair da equipa termina o acesso partilhado no servidor. Ficheiros já exportados não podem ser recolhidos.','Members share read access. Removing a member or leaving the team ends shared server access. Previously exported files cannot be recalled.')}</p><div class="team-member-list">${names().map(m=>`<div class="team-member"><div><strong>${esc(m.pilot_name)}</strong><small>${m.id===team.owner_id?t('Responsável','Owner'):t('Membro','Member')}${m.id===who()?' · '+t('Tu','You'):''}</small></div><div>${button('laps',t('Ver voltas','View laps'),m.id)}${owner&&m.id!==who()?button('remove',t('Remover','Remove'),m.id):''}</div></div>`).join('')}</div>${owner?`<div class="team-invites"><h3>${t('Convites pendentes','Pending invitations')}</h3>${team.invites?.length?team.invites.map(i=>`<div>${t('Válido até','Valid until')} ${esc(new Date(i.expires_at).toLocaleString(lang()==='en'?'en-GB':'pt-PT'))} ${button('cancel_invite',t('Cancelar convite','Cancel invitation'),i.id)}</div>`).join(''):`<p>${t('Sem convites pendentes.','No pending invitations.')}</p>`}</div>`:''}${invite?`<div class="team-invite-code"><label>${t('Envia este código apenas ao membro que queres convidar. É de utilização única e expira em 7 dias.','Send this code only to the member you want to invite. It is single-use and expires in 7 days.')}<input id="teamInviteCode" readonly value="${esc(invite.code)}"></label>${button('copy',t('Copiar código','Copy code'))}</div>`:''}`;
    }
    root.querySelector('#teamCreate')?.addEventListener('submit',e=>{e.preventDefault();void mutate('create',{name:new FormData(e.target).get('name')});});
    root.querySelector('#teamAccept')?.addEventListener('submit',e=>{e.preventDefault();void mutate('accept',{code:new FormData(e.target).get('code').trim()});});
    if(root.querySelector('#teamCreate input'))root.querySelector('#teamCreate input').value=createValue;
    if(root.querySelector('#teamAccept input'))root.querySelector('#teamAccept input').value=acceptValue;
    const subtitle=$('#team .titlebar h1');if(subtitle)subtitle.textContent=t('Equipa','Team');
    if($('#teamSubtitle'))$('#teamSubtitle').textContent=t('Membros, partilha de telemetria e preparação de endurance','Members, telemetry sharing and endurance preparation');
    const selector=$('#teamPilotFilter');if(selector){const chosen=selector.value;selector.replaceChildren(new Option(t('Todos os membros','All members'),''));for(const m of names())selector.add(new Option(m.pilot_name,m.id));if(names().some(m=>m.id===chosen))selector.value=chosen;}
    renderSharedLaps();
  }
  function renderSharedLaps(){
    const body=$('#teamSharedLaps');if(!body)return;
    const filter=$('#teamPilotFilter')?.value;
    const rows=contextLaps.filter(l=>!filter||l.pilot_id===filter).slice(0,500);
    body.innerHTML=rows.map(l=>`<tr><td>${esc(names().find(m=>m.id===l.pilot_id)?.pilot_name||t('Tu','You'))}</td><td>${esc(l.circuit)}</td><td>${esc(l.car)}</td><td>${formatLap(l.lap_time_ms)}</td><td>${esc(l.completed_at?new Date(l.completed_at).toLocaleString(lang()==='en'?'en-GB':'pt-PT'):'—')}</td><td>${button('open_lap',t('Analisar','Analyse'),l.id)}</td></tr>`).join('')||`<tr><td colspan="6">${t('Sem voltas sincronizadas para este membro.','No synced laps for this member.')}</td></tr>`;
  }
  const formatLap=ms=>{const s=Number(ms)/1000;return Number.isFinite(s)&&s>0?Math.floor(s/60)+':'+(s%60).toFixed(3).padStart(6,'0'):'—';};
  const clock=s=>{const n=Math.round(s);return String(Math.floor(n/3600)).padStart(2,'0')+':'+String(Math.floor(n/60)%60).padStart(2,'0')+':'+String(n%60).padStart(2,'0');};
  function mount(){
    const teamView=$('#team');if(teamView&&!$('#teamManagement')){
      const box=document.createElement('article');box.className='card team-management';box.id='teamManagement';box.setAttribute('data-i18n-ignore','');
      const feedback=document.createElement('p');feedback.id='teamStatus';feedback.setAttribute('role','status');feedback.setAttribute('aria-live','polite');
      teamView.querySelector('.titlebar').after(box,feedback);
      const archive=document.createElement('article');archive.className='card team-archive';archive.setAttribute('data-i18n-ignore','');
      archive.innerHTML=`<h3>${t('Voltas dos membros','Member laps')}</h3><label>${t('Piloto','Driver')}<select id="teamPilotFilter"></select></label><p>${t('Histórico recente: até 500 voltas cloud da equipa e o arquivo local do teu PC. Abre uma volta para consultar os canais de telemetria.','Recent history: up to 500 team cloud laps and your PC’s local archive. Open a lap to inspect its telemetry channels.')}</p><div class="endurance-scroll"><table><thead><tr>${['Piloto|Driver','Pista|Track','Carro|Car','Tempo|Time','Data|Date',''].map(s=>`<th>${t(...s.split('|'))||''}</th>`).join('')}</tr></thead><tbody id="teamSharedLaps"></tbody></table></div>`;
      teamView.append(archive);$('#teamPilotFilter').addEventListener('change',renderSharedLaps);
      box.addEventListener('click',event=>{
        const b=event.target.closest('[data-team-action]');if(!b)return;const action=b.dataset.teamAction,id=b.dataset.id;
        if(action==='refresh')return void refresh();
        if(action==='laps'){$('#teamPilotFilter').value=id;renderSharedLaps();archive.scrollIntoView({block:'start'});return;}
        if(action==='copy'){const input=$('#teamInviteCode');input.select();navigator.clipboard?.writeText(input.value).then(()=>status(t('Código copiado.','Code copied.'))).catch(()=>status(t('Seleciona e copia o código.','Select and copy the code.')));return;}
        if(['remove','leave','disband'].includes(action)&&!confirm(t('Confirmas? O acesso partilhado desta equipa será terminado para os membros afetados. As voltas originais são mantidas.','Confirm? Shared team access will end for the affected members. Original laps are preserved.')))return;
        void mutate(action,action==='remove'?{pilot_id:id}:action==='cancel_invite'?{id}:{});
      });
      archive.addEventListener('click',event=>{const b=event.target.closest('[data-team-action="open_lap"]');if(b)document.dispatchEvent(new CustomEvent('ams-team-open-lap',{detail:{id:b.dataset.id}}));});
    }
    mountStrategy();renderTeam();
  }
  const fields=[
    ['raceMinutes','Duração da corrida (min)','Race duration (min)',1,2880,1,360],
    ['tankLitres','Capacidade útil do depósito (L)','Usable tank capacity (L)',.1,500,.1,''],
    ['startLitres','Combustível na partida (L)','Starting fuel (L)',0,500,.1,''],
    ['reserveLitres','Reserva de combustível (L)','Fuel reserve (L)',0,500,.1,''],
    ['litresPerLap','Consumo por volta (L)','Fuel per lap (L)',.001,100,.001,''],
    ['maxStintMinutes','Duração máxima de cada stint (min)','Maximum stint duration (min)',1,300,1,60],
    ['tyreLaps','Vida planeada dos pneus (voltas)','Planned tyre life (laps)',1,10000,1,''],
    ['pitLossSeconds','Perda na via das boxes (s)','Pit lane time loss (s)',0,1800,.1,''],
    ['refuelLitresPerSecond','Débito de reabastecimento (L/s)','Refuelling rate (L/s)',.01,100,.01,''],
    ['tyreSeconds','Tempo de troca de pneus (s)','Tyre change time (s)',0,1800,.1,''],
    ['swapSeconds','Tempo de troca de piloto (s)','Driver change time (s)',0,1800,.1,'']
  ];
  function mountStrategy(){
    const root=$('#strategy');if(!root)return;
    root.setAttribute('data-i18n-ignore','');
    root.innerHTML=`<div class="titlebar"><div><h1>${t('Estratégia de endurance','Endurance strategy')}</h1><p>${t('Pilotos · stints · pneus · reabastecimento','Drivers · stints · tyres · refuelling')}</p></div></div><article class="card endurance-config"><form id="enduranceForm"><h2>${t('Preparar a corrida','Prepare the race')}</h2><div class="endurance-grid"><label>${t('Pista e carro das voltas gravadas','Track and car from recorded laps')}<select id="enduranceContext"></select></label><label>${t('Identificação da corrida / composto','Race / tyre compound')}<input id="enduranceLabel" maxlength="100" placeholder="${t('Ex.: Spa 6h · seco','E.g. Spa 6h · dry')}"></label></div><p id="endurancePaceNote"></p><div class="endurance-grid endurance-fields">${fields.map(([id,pt,en,min,max,step,value])=>`<label>${t(pt,en)}<input name="${id}" type="number" required min="${min}" max="${max}" step="${step}" value="${value}"></label>`).join('')}</div><p>${t('Confirma os consumos, a vida dos pneus e os tempos de boxes para esta corrida. Estes valores são introduzidos por ti; não são limites oficiais do simulador. A reserva é mantida em cada stint.','Confirm consumption, tyre life and pit times for this race. You enter these values; they are not official simulator limits. The reserve is maintained in every stint.')}</p><div class="endurance-checks"><label><input id="enduranceParallel" type="checkbox"> ${t('Reabastecimento, pneus e troca de piloto em simultâneo','Refuelling, tyres and driver change happen in parallel')}</label><label><input id="enduranceEveryTyre" type="checkbox"> ${t('Trocar pneus em todas as paragens','Change tyres at every stop')}</label></div><h3>${t('Ordem de rotação dos pilotos','Driver rotation order')}</h3><p>${t('Os pilotos selecionados alternam por esta ordem. O ritmo sugerido usa a mediana das cinco voltas gravadas mais rápidas nesta combinação; ajusta-o para um ritmo de corrida sustentável.','Selected drivers alternate in this order. Suggested pace uses the median of the five fastest recorded laps in this combination; adjust it to a sustainable race pace.')}</p><div id="enduranceRoster"></div><div class="team-toolbar"><button type="submit" class="ams-primary">${t('Calcular plano de stints','Calculate stint plan')}</button><button type="button" id="enduranceSave" class="ams-secondary" disabled>${t('Guardar plano para a equipa','Save plan for the team')}</button><button type="button" id="enduranceLoad" class="ams-secondary" disabled>${t('Carregar plano da equipa','Load team plan')}</button><button type="button" id="enduranceExport" class="ams-secondary" disabled>${t('Exportar CSV','Export CSV')}</button></div><p id="enduranceStatus" role="status" aria-live="polite"></p></form></article><div id="enduranceResult"></div>`;
    refreshContexts();renderRoster();renderResult();renderPlanTools();
    $('#enduranceContext').addEventListener('change',()=>{draftRoster.clear();renderRoster();invalidate();});
    $('#enduranceRoster').addEventListener('click',event=>{
      const b=event.target.closest('[data-move]');if(!b)return;
      captureRoster();const ids=orderedNames().map(m=>m.id),index=ids.indexOf(b.closest('[data-driver]').dataset.driver);
      const next=index+Number(b.dataset.move);if(next<0||next>=ids.length)return;
      [ids[index],ids[next]]=[ids[next],ids[index]];rosterOrder=ids;renderRoster();invalidate();
    });
    $('#enduranceForm').addEventListener('input',e=>{if(e.target.closest('#enduranceRoster'))captureRoster();invalidate();});
    $('#enduranceForm').addEventListener('submit',e=>{e.preventDefault();calculate();});
    $('#enduranceSave').addEventListener('click',async()=>{
      if(!plan||!planInput||!team)return;
      const target=team.id,revision=team.plan_revision;
      $('#enduranceSave').disabled=true;
      try{
        const data=await rpc('save_plan',{revision,plan:{version:1,input:planInput,label:$('#enduranceLabel').value,context:$('#enduranceContext').value}});
        if(data.team?.id!==target)throw Error('TEAM_NOT_MEMBER');
        receive(data);$('#enduranceStatus').textContent=t('Plano guardado para todos os membros.','Plan saved for all members.');
      }catch(error){$('#enduranceStatus').textContent=message(error);}finally{renderPlanTools();}
    });
    $('#enduranceLoad').addEventListener('click',()=>void loadTeamPlan());
    $('#enduranceExport').addEventListener('click',exportPlan);
  }
  function refreshContexts(chosen){
    const el=$('#enduranceContext');if(!el)return;const old=chosen??el.value;
    const combos=[...new Set(contextLaps.map(l=>JSON.stringify([l.simulator,l.circuit,l.car])))];
    el.replaceChildren(new Option(t('Configuração manual','Manual configuration'),''));
    combos.forEach(key=>el.add(new Option(JSON.parse(key).join(' · '),key)));
    if([...el.options].some(o=>o.value===old))el.value=old;
    $('#endurancePaceNote').textContent=t('Sem ritmo gravado, introduz os segundos por volta manualmente. Nenhum consumo é inventado a partir de voltas sem medição.','Without recorded pace, enter seconds per lap manually. Fuel consumption is never invented from laps without a measurement.');
  }
  function captureRoster(){
    $('#enduranceRoster')?.querySelectorAll('[data-driver]').forEach(row=>draftRoster.set(row.dataset.driver,{
      enabled:row.querySelector('[data-enabled]').checked,pace:row.querySelector('[data-pace]').value}));
  }
  function renderRoster(){
    const root=$('#enduranceRoster');if(!root)return;
    const combo=$('#enduranceContext')?.value;
    const members=orderedNames();
    root.innerHTML=members.map((m,index)=>{
      const laps=contextLaps.filter(l=>l.pilot_id===m.id&&JSON.stringify([l.simulator,l.circuit,l.car])===combo);
      const measured=AMSEndurancePlanner.measuredPace(laps),draft=draftRoster.get(m.id);
      return `<div class="endurance-driver" data-driver="${esc(m.id)}"><div class="endurance-driver-order"><label><input data-enabled type="checkbox" ${draft?.enabled===false?'':'checked'}> ${index+1}. ${esc(m.pilot_name)}</label><span><button type="button" data-move="-1" class="ams-secondary" aria-label="${t('Subir piloto','Move driver up')}" ${index===0?'disabled':''}>↑</button><button type="button" data-move="1" class="ams-secondary" aria-label="${t('Descer piloto','Move driver down')}" ${index===members.length-1?'disabled':''}>↓</button></span></div><label>${t('Ritmo (s/volta)','Pace (s/lap)')}<input data-pace type="number" min="5" max="7200" step="0.001" value="${esc(draft?.pace??(measured?.seconds.toFixed(3)||''))}"></label><small>${measured?t('Base gravada: ','Recorded base: ')+measured.seconds.toFixed(3)+' s · '+measured.count+' '+t('voltas','laps'):t('Sem voltas nesta combinação · ritmo manual','No laps in this combination · manual pace')}</small></div>`;
    }).join('')||`<p>${t('Inicia sessão para selecionar os pilotos.','Sign in to select drivers.')}</p>`;
  }
  function invalidate(){plan=null;planInput=null;renderResult();renderPlanTools();$('#enduranceStatus').textContent=t('Calcula novamente após alterar os dados.','Recalculate after changing the inputs.');}
  function readInput(){
    const form=$('#enduranceForm'),input=Object.fromEntries(fields.map(([id])=>[id,form.elements[id].value]));
    input.parallelService=$('#enduranceParallel').checked;input.changeTyresEveryStop=$('#enduranceEveryTyre').checked;
    input.drivers=[...$('#enduranceRoster').querySelectorAll('[data-driver]')].filter(row=>row.querySelector('[data-enabled]').checked)
      .map(row=>({id:row.dataset.driver,name:names().find(m=>m.id===row.dataset.driver)?.pilot_name||'',paceSeconds:row.querySelector('[data-pace]').value}));
    return input;
  }
  const planErrors={
    DRIVER_PACE:['Preenche um ritmo válido para cada piloto selecionado.','Enter a valid pace for each selected driver.'],
    DRIVERS:['Seleciona pelo menos um piloto.','Select at least one driver.'],
    STINT_NO_LAP:['O depósito, a reserva, os pneus ou o limite de stint não permitem completar uma volta.','The tank, reserve, tyres or stint limit do not allow one complete lap.'],
    START_NO_LAP:['O combustível de partida não permite completar uma volta e manter a reserva.','Starting fuel cannot cover one lap while maintaining the reserve.'],
    FUEL_START:['O combustível de partida não pode exceder a capacidade do depósito.','Starting fuel cannot exceed tank capacity.'],
    FUEL_RESERVE:['A reserva deve ser inferior à capacidade do depósito.','Reserve must be below tank capacity.']
  };
  function calculate(){
    try{const input=readInput();const result=AMSEndurancePlanner.calculate(input);plan=result;planInput=input;renderResult();renderPlanTools();$('#enduranceStatus').textContent=t('Plano calculado. Confirma os pressupostos antes da corrida.','Plan calculated. Confirm the assumptions before the race.');}
    catch(error){plan=null;planInput=null;renderResult();renderPlanTools();$('#enduranceStatus').textContent=planErrors[error.message]?t(...planErrors[error.message]):t('Revê os valores da corrida, combustível, pneus e paragens.','Review race, fuel, tyre and pit stop values.');}
  }
  function renderPlanTools(){
    if($('#enduranceSave'))$('#enduranceSave').disabled=!plan||!team||!available;
    if($('#enduranceLoad'))$('#enduranceLoad').disabled=!team?.plan||!available;
    if($('#enduranceExport'))$('#enduranceExport').disabled=!plan;
  }
  async function loadTeamPlan(){
    try{
      const result=await rpc('snapshot');receive(result);
      const saved=team?.plan;if(saved?.version!==1||!saved.input)throw Error('TEAM_INVALID_PLAN');
      const current=new Set(names().map(m=>m.id));
      if(!Array.isArray(saved.input.drivers)||saved.input.drivers.some(d=>!current.has(d.id)))throw Error('TEAM_INVALID_PLAN');
      const value=saved.input;AMSEndurancePlanner.calculate(value);
      rosterOrder=value.drivers.map(d=>d.id);
      fields.forEach(([id])=>$('#enduranceForm').elements[id].value=value[id]);
      $('#enduranceParallel').checked=value.parallelService===true;$('#enduranceEveryTyre').checked=value.changeTyresEveryStop===true;
      $('#enduranceLabel').value=String(saved.label||'').slice(0,100);
      refreshContexts(saved.context);
      names().forEach(m=>{const d=value.drivers.find(d=>d.id===m.id);draftRoster.set(m.id,{enabled:!!d,pace:d?.paceSeconds||''});});
      renderRoster();calculate();$('#enduranceStatus').textContent=t('Plano da equipa carregado e recalculado.','Team plan loaded and recalculated.');
    }catch(error){$('#enduranceStatus').textContent=message(error);}
  }
  function renderResult(){
    const root=$('#enduranceResult');if(!root)return;
    if(!plan){root.innerHTML=`<article class="card endurance-empty"><h3>${t('O plano de corrida aparece aqui','Your race plan appears here')}</h3><p>${t('Define o combustível, os pneus, os tempos de paragem e o ritmo dos pilotos.','Set fuel, tyres, pit stop times and driver pace.')}</p></article>`;return;}
    root.innerHTML=`<div class="endurance-summary">${[[t('Voltas previstas','Planned laps'),plan.laps],[t('Paragens','Pit stops'),plan.stops],[t('Combustível a adicionar','Fuel to add'),plan.refuelLitres.toFixed(1)+' L'],[t('Jogos de pneus','Tyre sets'),plan.tyreSets],[t('Tempo projetado','Projected time'),clock(plan.seconds)]].map(([label,value])=>`<div><small>${label}</small><strong>${value}</strong></div>`).join('')}</div><article class="card endurance-output"><h2>${t('Plano de stints','Stint plan')}</h2><p>${t('Corrida por tempo: termina na primeira passagem pela meta após a duração definida. Cada paragem inclui a perda na via das boxes e os serviços escolhidos. Não inclui bandeiras, tráfego nem reparações.','Timed race: finishes at the first line crossing after the configured duration. Each stop includes pit lane loss and the selected services. Flags, traffic and repairs are not modelled.')}</p><div class="endurance-scroll"><table><thead><tr>${['Stint|Stint','Piloto|Driver','Início → Fim|Start → End','Voltas|Laps','Combustível início → fim|Fuel start → end','Antes do stint: refuel / pneus / boxes|Before stint: refuel / tyres / pit time'].map(s=>`<th>${t(...s.split('|'))}</th>`).join('')}</tr></thead><tbody>${plan.stints.map(s=>`<tr><td>${s.number}</td><td><strong>${esc(s.driver)}</strong></td><td>${clock(s.startSeconds)} → ${clock(s.endSeconds)}</td><td>${s.firstLap}–${s.lastLap} (${s.laps})</td><td>${s.fuelStart.toFixed(1)} → ${s.fuelEnd.toFixed(1)} L</td><td>${s.pitBefore?'+'+s.pitBefore.refuelLitres.toFixed(1)+' L · '+(s.pitBefore.changeTyres?t('pneus novos','new tyres'):t('manter pneus','keep tyres'))+' · '+s.pitBefore.seconds.toFixed(1)+' s':t('Partida · pneus novos','Start · new tyres')} · ${t('jogo','set')} ${s.tyreSet}</td></tr>`).join('')}</tbody></table></div><h3>${t('Distribuição pelos pilotos','Driver allocation')}</h3><div class="team-member-list">${plan.drivers.map(d=>`<div class="team-member"><strong>${esc(d.name)}</strong><span>${d.stints} stints · ${d.laps} ${t('voltas','laps')} · ${clock(d.seconds)}</span></div>`).join('')}</div></article>`;
  }
  function exportPlan(){
    if(!plan)return;
    const cell=v=>{const text=String(v),safe=/^[\s\u0000-\u001f]*[=+@-]/.test(text)?"'"+text:text;return '"'+safe.replace(/"/g,'""')+'"';};
    const rows=[['Stint','Driver','Start','End','First lap','Last lap','Fuel start L','Fuel end L','Refuel L','New tyres','Pit seconds'],...plan.stints.map(s=>[s.number,s.driver,clock(s.startSeconds),clock(s.endSeconds),s.firstLap,s.lastLap,s.fuelStart.toFixed(3),s.fuelEnd.toFixed(3),(s.pitBefore?.refuelLitres||0).toFixed(3),s.pitBefore?.changeTyres||s.number===1,(s.pitBefore?.seconds||0).toFixed(3)])];
    const url=URL.createObjectURL(new Blob(['\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='AMS-endurance-stints.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  window.AMSTeams=Object.freeze({refresh,getMembers:()=>names().map(m=>({...m})),getPeerIds:()=>[...peers()],
    async augmentLaps(token,own){
      const id=who();await refresh({announce:false});const revision=epoch;
      const ids=peers();let rows=[];
      if(ids.length){const query=new URLSearchParams({select:'id,pilot_id,local_lap_id,simulator,circuit,car,lap_time_ms,completed_at,lap_number,session_id,verified',pilot_id:'in.('+ids.join(',')+')',order:'completed_at.desc',limit:'500'});rows=await AMSSupabase.request('/rest/v1/ams_laps?'+query,{token})||[];}
      if(id!==who()||revision!==epoch)return [];
      sharedLaps=rows.filter(l=>ids.includes(l.pilot_id));
      const all=[...new Map([...own,...sharedLaps].map(l=>[l.id,l])).values()];
      const members=new Set(names().map(m=>m.id));
      const nextContext=all.filter(l=>members.has(l.pilot_id));
      const changed=JSON.stringify(contextLaps)!==JSON.stringify(nextContext);
      contextLaps=nextContext;
      if(changed){refreshContexts();captureRoster();renderRoster();renderSharedLaps();}
      return all;
    }
  });
  document.addEventListener('ams-auth-changed',()=>{
    if(account===who())return;account=who();epoch++;team=null;invite=null;available=true;signature='';contextLaps=[];sharedLaps=[];draftRoster.clear();rosterOrder=[];plan=null;planInput=null;
    renderTeam();refreshContexts();renderRoster();renderResult();renderPlanTools();if(who())void refresh();
  });
  document.addEventListener('ams:languagechange',()=>{
    captureRoster();const old=readInput(),label=$('#enduranceLabel')?.value,context=$('#enduranceContext')?.value;
    mountStrategy();fields.forEach(([id])=>$('#enduranceForm').elements[id].value=old[id]);
    $('#enduranceLabel').value=label||'';$('#enduranceParallel').checked=old.parallelService;$('#enduranceEveryTyre').checked=old.changeTyresEveryStop;
    refreshContexts(context);renderRoster();renderTeam();
  });
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&who())void refresh();});
  setInterval(()=>{if(!document.hidden&&who())void refresh();},30000);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();
