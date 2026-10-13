/* AMS five concept screens: additive presentation + local prototype tools.
   Existing dashboard, lap comparison and engineer computation remain authoritative. */
(()=>{
  const $=s=>document.querySelector(s);
  const safe=(v)=>String(v??"—").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const card=(title,body,extra="")=>'<article class="ams-concept-card '+extra+'"><h3>'+title+'</h3>'+body+'</article>';
  const kpis=items=>'<div class="ams-kpis">'+items.map(x=>'<div><span>'+x[0]+'</span><strong class="'+(x[2]||'')+'">'+x[1]+'</strong></div>').join('')+'</div>';
  const note=t=>'<p class="ams-concept-note">'+t+'</p>';
  const svgPlot='<div class="ams-plot"><svg viewBox="0 0 520 118" preserveAspectRatio="none" aria-label="Demonstração de visualização de telemetria"><path d="M0 85H520M0 55H520M0 25H520" fill="none" stroke="#2f3848" stroke-width="1"/><path d="M0 83L34 78L64 35L92 40L127 62L153 51L188 14L210 33L241 29L266 79L299 83L323 48L347 56L380 21L413 29L451 67L479 51L520 38" fill="none" stroke="#e94b5a" stroke-width="2.6"/><path d="M0 79L34 82L64 43L92 46L127 59L153 59L188 20L210 27L241 40L266 71L299 81L323 55L347 49L380 27L413 36L451 62L479 58L520 42" fill="none" stroke="#448fdf" stroke-width="2.3"/></svg></div>';
  const nav=$('#mainNav');
  if(!nav)return;
  const extra=[['strategy','Strategy'],['setup-lab','Setup Lab'],['overlay-builder','Overlay Builder']];
  const workspace=nav.querySelector('[data-view="workspace"]');
  extra.forEach(([id,name])=>{if(nav.querySelector('[data-view="'+id+'"]'))return;const b=document.createElement('button');b.type='button';b.dataset.view=id;b.textContent=name;nav.insertBefore(b,workspace||null);});
  const content=$('.content');
  if(!content)return;
  const section=(id,title,subtitle,body)=>{
    const el=document.createElement('section');el.id=id;el.className='view';
    el.innerHTML='<div class="titlebar"><div><h1>'+title+'</h1><p>'+subtitle+'</p></div></div>'+body;
    content.appendChild(el);return el;
  };
  // Additive visual concept ribbons only — no fake live performance metrics.
  const dash=$('#dashboard .titlebar');
  if(dash){
    const wrap=document.createElement('div');wrap.className='ams-compare-strip';
    wrap.innerHTML=kpis([['Race Control','LIVE / REPLAY','ams-red'],['Monitorização','Pilotos e circuitos','ams-blue'],['Incidentes','Disponibilidade variável','ams-gold'],['Estratégia','Dados de sessão','']]);
    dash.after(wrap);
    const title=$('#dashboard h1');if(title)title.textContent='Race Control Command Center';
  }
  const compare=$('#compare .titlebar');
  if(compare){
    const wrap=document.createElement('div');wrap.className='ams-compare-strip';
    wrap.innerHTML=kpis([['A vs referência','Comparação','ams-red'],['Setores','Análise','ams-blue'],['Trajectory Coach','Ativo','ams-gold'],['Corner Explorer','Por curva',''],['Replay','Sincronizado','ams-blue']]);
    compare.after(wrap);const title=$('#compare h1');if(title)title.textContent='Lap Compare & Corner Explorer';
  }
  const engineer=$('#engineer .titlebar');
  if(engineer){
    const title=$('#engineer h1');if(title)title.textContent='Session Intelligence & AI Engineer';
    const bar=document.createElement('div');bar.className='ams-compare-strip';bar.innerHTML=kpis([['Engineer Verdict','Baseado em evidência','ams-red'],['Lap Consistency','Análise da sessão','ams-blue'],['Development','Recomendações','ams-gold'],['AI Engineer','Assistente contextual','']]);
    engineer.after(bar);
  }
  // Strategy: illustrative UI only. Estimated values are intentionally not fabricated.
  section('strategy','Race Strategy','Combustível · gestão de stint · planeamento de corrida',
    kpis([['Fuel on board','—'],['Consumption','—'],['Laps remaining','—'],['Pit window','A calcular','ams-gold']])+
    '<div class="ams-premium-grid">'+
    card('Pit Strategy', '<div class="ams-premium-list"><div><span>Estratégia atual</span><strong>Sem plano</strong></div><div><span>Próxima paragem</span><strong>—</strong></div><div><span>Composto</span><strong>—</strong></div></div>'+note('Os dados serão apresentados apenas quando existirem medições válidas.'))+
    card('Stint Timeline','<p class="ams-muted">Seleciona uma sessão com telemetria para obter uma projeção fundamentada.</p>'+Array.from({length:4},(_,i)=>'<div class="ams-timeline">'+Array.from({length:22},(_,j)=>'<span class="'+(j===i*5?'flag':j%7===0?'best':'')+'"></span>').join('')+'</div>').join('')+note('Faixas meramente ilustrativas; não representam uma corrida gravada.'))+
    card('Strategy Notes','<div class="ams-premium-list"><div><span>Combustível alvo</span><strong>A definir</strong></div><div><span>Desgaste de pneus</span><strong>Sem dados</strong></div><div><span>Weather / Flags</span><strong>Sem feed</strong></div></div>')+
    '</div>');
  const setupDefinitions=[['Rear wing',0,16,8,1],['Brake bias',45,65,54,.5],['Front pressure',20,32,26,.1],['Rear pressure',20,32,26,.1],['Front ride height',30,100,55,1],['Rear ride height',30,110,65,1],['Front ARB',1,12,5,1],['Rear ARB',1,12,7,1]];
  const makeSetupControls=()=>setupDefinitions.map(([name,min,max,value,step],i)=>'<label class="ams-setup-row"><span>'+name+'</span><input data-setup-param="'+i+'" aria-label="'+name+'" type="range" min="'+min+'" max="'+max+'" value="'+value+'" step="'+step+'"><output id="setupValue'+i+'">'+value+'</output></label>').join('');
  section('setup-lab','Setup Lab & Tune Catalog','Guardar perfis de setup · comparar parâmetros · preparar experiências',
    '<div class="ams-premium-grid">'+
    card('1. Setup Sheet','<label class="ams-label" for="setupName">Nome do setup</label><input id="setupName" class="ams-control" maxlength="70" value="GT3 Baseline" />'+makeSetupControls()+'<div class="ams-visual-tabs"><button id="setupReset" class="ams-secondary" type="button">Repor</button><button id="setupSave" class="ams-primary" type="button">Guardar localmente</button></div><p id="setupMessage" class="ams-muted" role="status"></p>')+
    card('2. Comparison & Recommendations','<div class="ams-premium-list" id="setupCompare"><div><span>Baseline</span><strong>Por definir</strong></div></div>'+note('Este módulo NÃO prevê ganhos de tempo. Recomendações automáticas exigem calibração e validação com telemetria real.')+'<div class="ams-line"></div><h3>Impacto estimado</h3>'+kpis([['Lap time','N/D'],['Stability','N/D'],['Traction','N/D'],['Tyre wear','N/D']])+svgPlot) +
    card('3. My Tune Catalog','<div id="setupCatalog" class="ams-premium-list"></div>'+note('Perfis guardados neste navegador. Ainda não sincronizados com Supabase.')+'<button id="setupExport" class="ams-secondary" type="button">Exportar JSON</button>')+
    '</div>');
  const available=['Standings','Relative','Delta Bar','Track Map','Fuel','Inputs','Tyres','Spotter','Flags','Lap Timer'];
  const savedOverlay=()=>{
    try{const data=JSON.parse(localStorage.getItem('ams_overlay_layout_v1')||'null');return Array.isArray(data)?data:null}catch{return null}
  };
  const initialOverlay=savedOverlay()||[
    {id:'tile-1',name:'Standings',x:4,y:6},
    {id:'tile-2',name:'Track Map',x:70,y:6},
    {id:'tile-3',name:'Delta Bar',x:40,y:5},
    {id:'tile-4',name:'Fuel',x:70,y:71},
    {id:'tile-5',name:'Inputs',x:5,y:72}
  ];
  section('overlay-builder','Overlay Builder & Driver HUD Profiles','Editor de posições · biblioteca de widgets · perfis por carro',
    '<div class="ams-premium-grid">'+
    card('Widget Library','<div class="ams-premium-list">'+available.map(n=>'<button class="ams-secondary ams-add-widget" style="text-align:left" type="button" data-widget-name="'+n+'">+ '+n+'</button>').join('')+'</div>')+
    card('Live Overlay Preview','<div class="ams-visual-tabs"><label class="ams-label" for="overlayProfile">Perfil</label><select id="overlayProfile" class="ams-control"><option>GT3 Sprint</option><option>Endurance</option><option>Broadcast</option><option>Single Monitor</option></select></div><div class="ams-preview" id="overlayCanvas" aria-label="Editor de widgets"></div><div class="ams-visual-tabs"><button class="ams-primary" id="overlaySave" type="button">Guardar layout</button><button class="ams-secondary" id="overlayReset" type="button">Repor layout</button></div><p class="ams-muted" role="status" id="overlayStatus">Arrasta um widget para alterar a posição.</p>')+
    card('Widget Properties','<p class="ams-muted" id="overlaySelected">Seleciona um widget na pré-visualização.</p><label class="ams-label" for="overlayPosX">Posição X (%)</label><input class="ams-control" id="overlayPosX" type="number" min="0" max="85"><label class="ams-label" for="overlayPosY">Posição Y (%)</label><input class="ams-control" id="overlayPosY" type="number" min="0" max="85"><div class="ams-visual-tabs"><button class="ams-secondary" id="overlayRemove" type="button">Remover selecionado</button></div>'+note('Este é um editor de perfis Web. Overlay sobre o simulador Windows depende da integração desktop e não está ativado aqui.'))+
    '</div>');
  // Safe navigation: the existing application only registered listeners for original nav items.
  nav.addEventListener('click',e=>{
    const btn=e.target.closest('button[data-view]');
    if(!btn||!extra.some(x=>x[0]===btn.dataset.view))return;
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===btn.dataset.view));
    nav.querySelectorAll('button').forEach(v=>v.classList.toggle('active',v===btn));
  });
  const setupKey='ams_setup_catalog_v1';
  const readSetups=()=>{try{const s=JSON.parse(localStorage.getItem(setupKey)||'[]');return Array.isArray(s)?s:[]}catch{return []}};
  const params=()=>Object.fromEntries(setupDefinitions.map(([name],i)=>[name,Number($('#setup-lab [data-setup-param="'+i+'"]').value)]));
  const refreshSetup=()=>{
    const rows=readSetups(),catalog=$('#setupCatalog');
    catalog.replaceChildren();
    if(!rows.length){catalog.textContent='Ainda não existem setups guardados.';return;}
    rows.slice(-12).reverse().forEach((item)=>{
      const div=document.createElement('div');div.className='ams-saved-row';
      const label=document.createElement('span');label.textContent=item.name;
      const b=document.createElement('button');b.type='button';b.className='ams-secondary';b.textContent='Carregar';
      b.addEventListener('click',()=>{
        $('#setupName').value=item.name;
        setupDefinitions.forEach(([name],i)=>{const inp=$('#setup-lab [data-setup-param="'+i+'"]');inp.value=item.parameters[name]??setupDefinitions[i][3];$('#setupValue'+i).textContent=inp.value;});
        $('#setupMessage').textContent='Perfil carregado localmente.';
        $('#setupCompare').textContent='Setup selecionado: '+item.name;
      });
      div.append(label,b);catalog.append(div);
    });
  };
  setupDefinitions.forEach((_,i)=>$('#setup-lab [data-setup-param="'+i+'"]').addEventListener('input',e=>$('#setupValue'+i).textContent=e.target.value));
  $('#setupReset').addEventListener('click',()=>setupDefinitions.forEach((d,i)=>{const el=$('#setup-lab [data-setup-param="'+i+'"]');el.value=d[3];$('#setupValue'+i).textContent=el.value;}));
  $('#setupSave').addEventListener('click',()=>{
    const name=$('#setupName').value.trim()||'Sem nome',rows=readSetups();rows.push({name,parameters:params(),savedAt:new Date().toISOString()});
    try{localStorage.setItem(setupKey,JSON.stringify(rows.slice(-30)));$('#setupMessage').textContent='Setup guardado neste navegador.';refreshSetup()}catch{$('#setupMessage').textContent='Não foi possível guardar este setup.'}
  });
  $('#setupExport').addEventListener('click',()=>{
    const data=JSON.stringify(readSetups(),null,2);const blob=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='ams-setups.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });refreshSetup();
  // Every HUD profile has an independent, persisted widget layout.
  // Legacy single-layout saves are migrated into GT3 Sprint on first load.
  const profilesKey='ams_overlay_profiles_v2';
  const profileSelect=$('#overlayProfile');
  const profileNames=[...profileSelect.options].map(o=>o.value);
  const copyLayout=list=>list.map(w=>({...w}));
  const defaultLayout=()=>copyLayout([
    {id:'tile-1',name:'Standings',x:4,y:6},
    {id:'tile-2',name:'Track Map',x:70,y:6},
    {id:'tile-3',name:'Delta Bar',x:40,y:5},
    {id:'tile-4',name:'Fuel',x:70,y:71},
    {id:'tile-5',name:'Inputs',x:5,y:72}
  ]);
  const validLayout=list=>Array.isArray(list)?list.filter(w=>w&&typeof w.id==='string'&&typeof w.name==='string'&&Number.isFinite(Number(w.x))&&Number.isFinite(Number(w.y))).slice(0,40).map(w=>({id:w.id,name:w.name,x:Math.max(0,Math.min(84,Number(w.x))),y:Math.max(0,Math.min(85,Number(w.y)))})):null;
  let profiles={};
  try{const raw=JSON.parse(localStorage.getItem(profilesKey)||'{}');if(raw&&typeof raw==='object'&&!Array.isArray(raw))for(const name of profileNames){const layout=validLayout(raw[name]);if(layout)profiles[name]=layout;}}catch{}
  if(!profiles['GT3 Sprint'])profiles['GT3 Sprint']=validLayout(savedOverlay())||defaultLayout();
  const activeName=()=>profileSelect.value;
  let overlay=copyLayout(profiles[activeName()]||defaultLayout()),selected=null;
  const canvas=$('#overlayCanvas');
  const status=$('#overlayStatus');
  const markChanged=()=>{status.textContent='Alterações por guardar no perfil '+activeName()+'.';};
  const selectTile=id=>{selected=id;renderOverlay();};
  const renderOverlay=()=>{
    canvas.replaceChildren();
    overlay.forEach(w=>{
      const el=document.createElement('div');el.className='ams-overlay-tile'+(selected===w.id?' selected':'');
      el.style.left=w.x+'%';el.style.top=w.y+'%';el.dataset.tileId=w.id;
      const label=document.createElement('b');label.textContent=w.name;
      const val=document.createElement('em');val.textContent='Pré-visualização';
      el.append(label,val);el.addEventListener('click',()=>selectTile(w.id));
      el.addEventListener('pointerdown',e=>{
        if(e.button!==0)return;selectTile(w.id);const b=canvas.getBoundingClientRect();
        const move=ev=>{w.x=Math.max(0,Math.min(84,Math.round((ev.clientX-b.left)/b.width*100)));w.y=Math.max(0,Math.min(85,Math.round((ev.clientY-b.top)/b.height*100)));el.style.left=w.x+'%';el.style.top=w.y+'%';$('#overlayPosX').value=w.x;$('#overlayPosY').value=w.y;markChanged();};
        const done=()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',done);};
        document.addEventListener('pointermove',move);document.addEventListener('pointerup',done,{once:true});
      });
      canvas.append(el);
    });
    const w=overlay.find(x=>x.id===selected);$('#overlaySelected').textContent=w?'Selecionado: '+w.name:'Seleciona um widget na pré-visualização.';
    $('#overlayPosX').value=w?.x??0;$('#overlayPosY').value=w?.y??0;
  };
  document.querySelectorAll('.ams-add-widget').forEach(b=>b.addEventListener('click',()=>{
    const id='tile-'+Date.now().toString(36)+'-'+overlay.length;
    overlay.push({id,name:b.dataset.widgetName,x:30,y:32});selectTile(id);markChanged();
  }));
  ['X','Y'].forEach(axis=>$('#overlayPos'+axis).addEventListener('change',e=>{
    const w=overlay.find(x=>x.id===selected);if(!w)return;w[axis.toLowerCase()]=Math.max(0,Math.min(85,Number(e.target.value)||0));renderOverlay();markChanged();
  }));
  $('#overlayRemove').addEventListener('click',()=>{overlay=overlay.filter(w=>w.id!==selected);selected=null;renderOverlay();markChanged();});
  $('#overlayReset').addEventListener('click',()=>{overlay=defaultLayout();selected=null;renderOverlay();markChanged();});
  const saveProfile=()=>{try{profiles[activeName()]=copyLayout(overlay);localStorage.setItem(profilesKey,JSON.stringify(profiles));status.textContent='Perfil '+activeName()+' guardado neste navegador.';return true}catch{status.textContent='Erro ao guardar o perfil.';return false}};
  $('#overlaySave').addEventListener('click',saveProfile);
  profileSelect.addEventListener('change',()=>{
    overlay=copyLayout(profiles[activeName()]||defaultLayout());selected=null;renderOverlay();
    status.textContent=profiles[activeName()]?'Perfil '+activeName()+' carregado.':'Novo perfil '+activeName()+' com layout inicial.';
  });
  // Additional profile operations respect the selected HUD configuration.
  const actions=document.createElement('div');actions.className='ams-overlay-profile-actions';
  const duplicate=document.createElement('button');duplicate.type='button';duplicate.className='ams-secondary';duplicate.textContent='Duplicar neste perfil';
  duplicate.addEventListener('click',()=>{const original=profiles['GT3 Sprint']||defaultLayout();overlay=copyLayout(original);selected=null;renderOverlay();markChanged();});
  const exportBtn=document.createElement('button');exportBtn.type='button';exportBtn.className='ams-secondary';exportBtn.textContent='Exportar perfil JSON';
  exportBtn.addEventListener('click',()=>{
    const text=JSON.stringify({profile:activeName(),widgets:overlay},null,2),url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
    const link=document.createElement('a');link.href=url;link.download='ams-hud-'+activeName().toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  actions.append(duplicate,exportBtn);status.before(actions);
  renderOverlay();
})();