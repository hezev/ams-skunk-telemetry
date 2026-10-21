/* Delegated help for existing and dynamically rendered portal controls. No telemetry writes. */
(()=>{
 'use strict';
 const words={
  dashboard:['Painel principal','Resume a sessão, o estado da ligação e as voltas recentes.','Dashboard','Summarises the session, connection status and recent laps.'],
  live:['Live Pitwall','Acompanha pilotos e posições da sessão em direto. Os replays de análise não alteram estes dados.','Live Pitwall','Follows drivers and live session positions. Analysis replays do not change this data.'],
  telemetry:['Telemetria','Consulta os canais guardados numa volta, como velocidade, travão e acelerador.','Telemetry','Inspects recorded lap channels, including speed, brake and throttle.'],
  sessions:['Sessões','Agrupa as voltas por sessão, piloto, simulador, pista e carro.','Sessions','Groups laps by session, driver, simulator, track and car.'],
  laps:['Voltas','Consulta as voltas disponíveis e seleciona uma para analisar.','Laps','Lists available laps and lets you select one for analysis.'],
  compare:['Comparar voltas','Compara duas voltas compatíveis e identifica ganhos e perdas de tempo.','Lap comparison','Compares compatible laps and identifies time gained or lost.'],
  engineer:['Engenheiro','Analisa a sessão e a condução. O replay desta área é independente da sessão em direto.','Engineer','Analyses sessions and driving. This replay is independent of the live session.'],
  records:['Recordes','Consulta tempos de referência e filtra os resultados por simulador, pista ou carro.','Records','Browses reference times and filters results by simulator, track or car.'],
  driver:['Piloto','Consulta o perfil e os resultados associados ao piloto.','Driver','Shows the driver profile and associated results.'],
  team:['Equipa','Cria a equipa, convida membros e consulta as voltas e a telemetria partilhadas após aceitarem o convite.','Team','Create a team, invite members and inspect shared laps and telemetry after they accept.'],
  workspace:['Área de trabalho','Organiza os painéis de pista, tempos e telemetria.','Workspace','Arranges track, timing and telemetry panels.'],
  strategy:['Estratégia','Calcula stints de endurance com rotação de pilotos, pneus, reabastecimento e tempos de boxes. Guarda o plano para a equipa.','Strategy','Calculate endurance stints with driver rotation, tyres, refuelling and pit times. Save the plan for your team.'],
  setup:['Setup','Consulta afinações e recomendações com base nos dados disponíveis da sessão.','Setup','Reviews setup information and recommendations based on available session evidence.'],
  racecontrol:['Race Control','Mostra a sessão em direto. Os replays de comparação e engenheiro não controlam este painel.','Race Control','Shows the live session. Comparison and engineer replays do not control this panel.'],
  lapA:['Volta A','É a volta que estás a analisar. Seleciona uma volta guardada para consultar os canais reais.','Lap A','The lap being analysed. Select a recorded lap to inspect its real channels.'],
  reference:['Volta de referência','Define a volta usada como base. A pista e o layout devem ser compatíveis com a Volta A.','Reference lap','Sets the baseline lap. Track and layout must be compatible with Lap A.'],
  delta:['Diferença de tempo','Um valor negativo indica ganho da Volta A; um valor positivo indica perda, face à referência.','Time delta','A negative value means Lap A is faster; a positive value means it is slower than the reference.'],
  replay:['Replay de comparação','Reproduz apenas as voltas selecionadas nesta comparação. Não altera o Live Pitwall nem o Race Control.','Comparison replay','Plays only the selected comparison laps. Does not affect Live Pitwall or Race Control.'],
  engineerReplay:['Replay do engenheiro','Reproduz a volta escolhida no Engenheiro, independentemente da comparação e da sessão em direto.','Engineer replay','Plays the selected Engineer lap independently of comparison and the live session.'],
  seek:['Posição do replay','Avança ou recua nesta reprodução. Não muda a posição do carro no simulador.','Replay position','Seeks within this replay. Does not change the car position in the simulator.'],
  speed:['Velocidade do replay','Altera a velocidade de reprodução da análise, sem modificar os dados gravados.','Replay speed','Changes analysis playback speed without changing recorded data.'],
  zoom:['Zoom do mapa','Aproxima a vista da trajetória. Os dados originais da volta mantêm-se.','Map zoom','Zooms into the trajectory view. Original lap data stays unchanged.'],
  export:['Exportar CSV','Transfere os canais disponíveis da volta para análise numa folha de cálculo.','Export CSV','Downloads available lap channels for spreadsheet analysis.'],
  analyze:['Analisar sessão','Calcula a análise com os dados disponíveis da sessão escolhida.','Analyse session','Calculates analysis using the selected session data.'],
  briefing:['Briefing do engenheiro','Pede uma síntese da sessão ao serviço de engenharia. O pedido utiliza os dados necessários à análise.','Engineer briefing','Requests a session summary from the engineering service using the analysis data it needs.'],
  login:['Entrar na conta','Acede ao histórico e aos dados autorizados da tua conta AMSports.','Sign in','Accesses your history and data permitted for your AMSports account.'],
  logout:['Terminar sessão','Remove a sessão guardada neste navegador e termina o acesso autenticado ao portal.','Sign out','Removes the saved browser session and ends authenticated portal access.'],
  layout:['Editar layout','Personaliza a disposição dos painéis desta página.','Edit layout','Customises this page’s panel arrangement.'],
  language:['Idioma','Altera o idioma do portal.','Language','Changes the portal language.'],
  play:['Android · teste interno','Abre o teste interno da Google Play. O acesso depende da participação no teste.','Android · internal test','Opens the Google Play internal test. Access depends on test participation.'],
  status:['Estado da ligação','Indica o estado dos dados recebidos. Entrar na conta não garante que exista uma sessão do simulador em direto.','Connection status','Shows received data status. Signing in does not imply there is a live simulator session.']
 };
 const ids={telemetryLapSelect:'lapA',telemetryReferenceSelect:'reference',compareLapA:'lapA',compareLapB:'reference',telemetryLapDelta:'delta',compareDelta:'delta',compareReplayBtn:'replay',compareReplayToggle:'replay',compareReplaySeek:'seek',engineerReplaySeek:'seek',compareReplaySpeed:'speed',engineerReplaySpeed:'speed',compareFocusZoom:'zoom',exportCsvBtn:'export',engineerAnalyzeBtn:'analyze',engineerSessionSelect:'analyze',engineerReplayLapSelect:'engineerReplay',engineerReplayBtn:'engineerReplay',engineerAiBtn:'briefing',engineerAskBtn:'briefing',loginBtn:'login',logoutBtn:'logout',layoutEditBtn:'layout','ams-language-select':'language',connectionPill:'status'};
 const tip=document.createElement('div');tip.className='ams-context-tooltip';tip.id='amsContextTooltip';tip.setAttribute('role','tooltip');tip.hidden=true;
 const heading=document.createElement('strong'),body=document.createElement('span'),note=document.createElement('small');tip.append(heading,body,note);document.body.append(tip);
 let trigger=null,pending=null,suppressed=null,timer=null,hideTimer=null,position=null,pinned=false;
 const english=()=>window.AMSi18n?.getLanguage?.()==='en';
 function keyFor(el){const view=el.dataset.view;return el.dataset.amsHelp||ids[el.id]||(el.matches('#mainNav button[data-view]')?(view==='setup-lab'?'setup':view):null)||(el.matches('.ams-google-play-link')?'play':null)||(el.matches('[data-engineer-prompt]')?'briefing':null);}
 function find(target){if(!(target instanceof Element))return null;const el=target.closest('[data-ams-help],#mainNav button[data-view],button[id],select[id],input[type=range][id],.ams-google-play-link,[data-engineer-prompt]');return el&&words[keyFor(el)]?el:null;}
 function close(){clearTimeout(timer);clearTimeout(hideTimer);pending=null;if(trigger){const ids=(trigger.getAttribute('aria-describedby')||'').split(/\s+/).filter(id=>id&&id!==tip.id);if(ids.length)trigger.setAttribute('aria-describedby',ids.join(' '));else trigger.removeAttribute('aria-describedby');}trigger=null;tip.hidden=true;pinned=false;}
 function place(point){
  if(!trigger)return;
  const viewport=window.visualViewport;
  const view={left:viewport?.offsetLeft||0,top:viewport?.offsetTop||0,width:viewport?.width||window.innerWidth,height:viewport?.height||window.innerHeight};
  tip.style.maxWidth=Math.max(120,view.width-16)+'px';
  const rect=trigger.getBoundingClientRect(),w=tip.offsetWidth,h=tip.offsetHeight;
  const x=point?point.x:rect.left+Math.min(rect.width/2,25),y=point?point.y:rect.bottom;
  const left=Math.max(view.left+8,Math.min(x+12,view.left+view.width-w-8));let top=y+18;
  const flipped=top+h>view.top+view.height-8;if(flipped)top=Math.max(view.top+8,(point?point.y:rect.top)-h-14);
  tip.style.left=left+'px';tip.style.top=top+'px';tip.dataset.flipped=String(flipped);
  tip.style.setProperty('--ams-tip-arrow',Math.max(12,Math.min(w-20,x-left))+'px');
 }
 function content(){if(!trigger)return;const text=words[keyFor(trigger)],offset=english()?2:0;heading.textContent=text[offset];body.textContent=text[offset+1];note.textContent=english()?'Esc to dismiss':'Esc para fechar';}
 function open(el,point,pin=false){if(suppressed===el)return;close();trigger=el;position=point;pinned=pin;content();tip.hidden=false;const described=(el.getAttribute('aria-describedby')||'').split(/\s+/).filter(Boolean);if(!described.includes(tip.id))described.push(tip.id);el.setAttribute('aria-describedby',described.join(' '));place(point);}
 function queue(el,point){clearTimeout(timer);clearTimeout(hideTimer);if(trigger===el||suppressed===el)return;pending=el;position=point;timer=setTimeout(()=>open(el,position),350);}
 function deferClose(){clearTimeout(timer);pending=null;clearTimeout(hideTimer);if(!pinned&&document.activeElement!==trigger)hideTimer=setTimeout(close,300);}
 document.addEventListener('pointerover',event=>{if(event.pointerType!=='mouse')return;if(tip.contains(event.target)){clearTimeout(hideTimer);return;}const el=find(event.target);if(el)queue(el,{x:event.clientX,y:event.clientY});});
 document.addEventListener('pointermove',event=>{if(pending&&pending.contains(event.target))position={x:event.clientX,y:event.clientY};});
 document.addEventListener('pointerout',event=>{const el=find(event.target);if(el&&!el.contains(event.relatedTarget)){if(suppressed===el)suppressed=null;if(!tip.contains(event.relatedTarget))deferClose();}});
 tip.addEventListener('pointerenter',()=>clearTimeout(hideTimer));tip.addEventListener('pointerleave',deferClose);
 document.addEventListener('focusin',event=>{const el=find(event.target);if(el)queue(el,null);});
 document.addEventListener('focusout',event=>{const el=find(event.target);if(el){if(suppressed===el)suppressed=null;close();}});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){suppressed=trigger||pending;close();}});
 document.addEventListener('pointerdown',event=>{if(!tip.contains(event.target)&&!find(event.target))close();});
 document.addEventListener('click',event=>{const info=event.target.closest('[data-ams-help-info]');if(info){suppressed=null;if(trigger===info&&pinned)close();else open(info,null,true);}});
 window.addEventListener('resize',close);window.addEventListener('scroll',close,{capture:true,passive:true});
 window.visualViewport?.addEventListener('resize',close);
 document.addEventListener('ams:languagechange',()=>{content();place(position);document.querySelectorAll('[data-ams-help-info]').forEach(button=>{const text=words[keyFor(button)];button.setAttribute('aria-label',(english()?'Explain ':'Explicar ')+text[english()?2:0]);});});
 document.addEventListener('ams-auth-changed',close);
 // Dedicated, non-destructive touch targets beside the most important selectors.
 for(const id of ['telemetryLapSelect','telemetryReferenceSelect','compareLapA','compareLapB']){
  const field=document.getElementById(id);if(!field)continue;
  const button=document.createElement('button');button.type='button';button.className='ams-context-info';button.dataset.amsHelp=ids[id];button.dataset.amsHelpInfo='';button.textContent='?';button.setAttribute('aria-label',(english()?'Explain ':'Explicar ')+words[ids[id]][english()?2:0]);field.parentElement.append(button);
 }
 window.AMSContextHelp={close};
})();
