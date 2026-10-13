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
  const extra=[['strategy','Strategy'],['setup-lab','Setup Lab']];
  const workspace=nav.querySelector('[data-view="workspace"]');
  extra.forEach(([id,name])=>{if(nav.querySelector('[data-view="'+id+'"]'))return;const b=document.createElement('button');b.type='button';b.dataset.view=id;b.textContent=name;nav.insertBefore(b,workspace||null);});
  const content=$('.content');
  if(!content)return;
  const section=(id,title,subtitle,body)=>{
    const el=document.createElement('section');el.id=id;el.className='view';
    el.innerHTML='<div class="titlebar"><div><h1>'+title+'</h1><p>'+subtitle+'</p></div></div>'+body;
    content.appendChild(el);return el;
  };
  // Keep actionable original headings; decorative status ribbons have been retired.
  const titles=[['dashboard','Race Control Command Center'],['compare','Lap Compare & Corner Explorer'],['engineer','Session Intelligence & AI Engineer']];
  titles.forEach(([id,title])=>{const h=document.querySelector('#'+id+' .titlebar h1');if(h)h.textContent=title;});
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
    card('2. Setup Comparison','<p class="ams-concept-note">Diferenças reais dos parâmetros relativamente ao setup de referência. Não são previsões de tempo por volta.</p><div class="ams-premium-list" id="setupCompare" aria-live="polite"></div>') +
    card('3. My Tune Catalog','<div id="setupCatalog" class="ams-premium-list"></div>'+note('Perfis guardados neste navegador. Ainda não sincronizados com Supabase.')+'<div class="ams-visual-tabs"><button id="setupExport" class="ams-secondary" type="button">Exportar JSON</button><button id="setupImport" class="ams-secondary" type="button">Importar JSON</button><input id="setupImportFile" type="file" accept="application/json,.json" hidden></div>')+
    '</div>');
  // Safe navigation: the existing application only registered listeners for original nav items.
  nav.addEventListener('click',e=>{
    const btn=e.target.closest('button[data-view]');
    if(!btn||!extra.some(x=>x[0]===btn.dataset.view))return;
    document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===btn.dataset.view));
    nav.querySelectorAll('button').forEach(v=>v.classList.toggle('active',v===btn));
  });
  const setupContext=()=>window.AMSSetupSessionContext?.getSelected?.()||null;
  const sameCarContext=(saved,current)=>!saved||!current||
    (String(saved.simulator||'').trim().toLowerCase()===String(current.simulator||'').trim().toLowerCase()
     &&String(saved.car||'').trim().toLowerCase()===String(current.car||'').trim().toLowerCase());
  const setupKey='ams_setup_catalog_v1';
  const readSetups=()=>{try{const s=JSON.parse(localStorage.getItem(setupKey)||'[]');return Array.isArray(s)?s:[]}catch{return []}};
  const params=()=>Object.fromEntries(setupDefinitions.map(([name],i)=>[name,Number($('#setup-lab [data-setup-param="'+i+'"]').value)]));
  let baseline=Object.fromEntries(setupDefinitions.map(d=>[d[0],d[3]]));
  let baselineName='GT3 Baseline';
  const renderComparison=()=>{
    const container=$('#setupCompare');container.replaceChildren();
    const heading=document.createElement('div');const text=document.createElement('span');text.textContent='Referência';const strong=document.createElement('strong');strong.textContent=baselineName;heading.append(text,strong);container.append(heading);
    const current=params();let changed=0;
    setupDefinitions.forEach(([name])=>{
      const before=Number(baseline[name]),after=current[name],delta=after-before;
      if(!Number.isFinite(before)||!Number.isFinite(after))return;
      if(Math.abs(delta)>0.000001)changed++;
      const row=document.createElement('div');const label=document.createElement('span');label.textContent=name;const value=document.createElement('strong');value.textContent=before+' → '+after+(Math.abs(delta)>0.000001?' ('+(delta>0?'+':'')+Number(delta.toFixed(2))+')':' (igual)');
      row.append(label,value);container.append(row);
    });
    const summary=document.createElement('p');summary.className='ams-concept-note';summary.textContent=changed+' de '+setupDefinitions.length+' parâmetros alterados face à referência.';container.append(summary);
  };
  const refreshSetup=()=>{
    const rows=readSetups(),catalog=$('#setupCatalog');
    catalog.replaceChildren();
    if(!rows.length){catalog.textContent='Ainda não existem setups guardados.';return;}
    rows.slice(-12).reverse().forEach((item)=>{
      const div=document.createElement('div');div.className='ams-saved-row';
      const label=document.createElement('span');label.textContent=item.name;
      const b=document.createElement('button');b.type='button';b.className='ams-secondary';b.textContent='Carregar';
      b.addEventListener('click',()=>{
        const context=setupContext();
        if(!sameCarContext(item.context,context)){
          $('#setupMessage').textContent='Este perfil pertence a outro carro/simulador. Seleciona uma sessão compatível para o carregar.';
          return;
        }
        $('#setupName').value=item.name;
        setupDefinitions.forEach(([name],i)=>{const inp=$('#setup-lab [data-setup-param="'+i+'"]');inp.value=item.parameters[name]??setupDefinitions[i][3];$('#setupValue'+i).textContent=inp.value;});
        $('#setupMessage').textContent='Perfil carregado localmente.';
        baseline={...item.parameters};baselineName=item.name;renderComparison();
      });
      const small=document.createElement('small');
      small.className='setup-profile-context';
      small.textContent=item.context
        ?[item.context.simulator,item.context.car,item.context.track].filter(Boolean).join(' · ')
        :'Perfil antigo sem carro identificado';
      if(!sameCarContext(item.context,setupContext())){
        div.classList.add('setup-profile-incompatible');
        b.disabled=true;b.title='Carro ou simulador incompatível com a sessão selecionada';
      }
      div.append(label,small,b);catalog.append(div);
    });
  };
  setupDefinitions.forEach((_,i)=>$('#setup-lab [data-setup-param="'+i+'"]').addEventListener('input',e=>{$('#setupValue'+i).textContent=e.target.value;renderComparison();}));
  $('#setupReset').addEventListener('click',()=>{setupDefinitions.forEach((d,i)=>{const el=$('#setup-lab [data-setup-param="'+i+'"]');el.value=d[3];$('#setupValue'+i).textContent=el.value;});renderComparison();});
  $('#setupSave').addEventListener('click',()=>{
    const name=$('#setupName').value.trim()||'Sem nome',rows=readSetups();
    const context=setupContext();
    rows.push({name,parameters:params(),savedAt:new Date().toISOString(),
      context:context?{simulator:context.simulator,car:context.car,track:context.track}:null});
    try{localStorage.setItem(setupKey,JSON.stringify(rows.slice(-30)));$('#setupMessage').textContent='Setup guardado neste navegador.';refreshSetup()}catch{$('#setupMessage').textContent='Não foi possível guardar este setup.'}
  });
  $('#setupExport').addEventListener('click',()=>{
    const data=JSON.stringify(readSetups(),null,2);const blob=new Blob([data],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download='ams-setups.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  $('#setupImport').addEventListener('click',()=>$('#setupImportFile').click());
  $('#setupImportFile').addEventListener('change',async e=>{
    const file=e.target.files?.[0];if(!file)return;
    try{
      if(file.size>256000)throw new Error('Ficheiro demasiado grande (máximo 256 KB).');
      const parsed=JSON.parse(await file.text());
      if(!Array.isArray(parsed)||parsed.length>30)throw new Error('Catálogo inválido ou com mais de 30 setups.');
      const validated=parsed.map(item=>{
        if(!item||typeof item.name!=='string'||!item.name.trim()||item.name.length>70||!item.parameters||typeof item.parameters!=='object')throw new Error('Estrutura de setup inválida.');
        const values={};
        for(const [name,min,max,,step] of setupDefinitions){
          const n=item.parameters[name];
          if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max||Math.abs((n-min)/step-Math.round((n-min)/step))>0.00001)throw new Error('Parâmetro inválido: '+name);
          values[name]=n;
        }
        let context=null;
        if(item.context!=null){
          if(typeof item.context!=='object'||Array.isArray(item.context)||
             !['simulator','car','track'].every(k=>typeof item.context[k]==='string'&&item.context[k].length<=120))
            throw new Error('Contexto do perfil inválido.');
          context={simulator:item.context.simulator,car:item.context.car,track:item.context.track};
        }
        return {name:item.name.trim(),parameters:values,savedAt:typeof item.savedAt==='string'&&Number.isFinite(Date.parse(item.savedAt))?item.savedAt:new Date().toISOString(),context};
      });
      const merged=[...readSetups(),...validated].slice(-30);
      localStorage.setItem(setupKey,JSON.stringify(merged));
      refreshSetup();$('#setupMessage').textContent=validated.length+' setups importados com sucesso.';
    }catch(err){$('#setupMessage').textContent='Importação rejeitada: '+(err.message||'JSON inválido');}
    finally{e.target.value='';}
  });
  document.addEventListener('ams-setup-context-change',refreshSetup);
  refreshSetup();renderComparison();
})();
