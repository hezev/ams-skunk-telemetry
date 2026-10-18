/* Cloud sessions own a map context; recorded laps never supply the live map. */
(()=>{
 'use strict';
 let key='',revision=0,pending=false,nextAttemptAt=0;
 const status=text=>{for(const id of ['liveMapStatus','raceControlMapStatus']){const el=document.getElementById(id);if(el)el.textContent=text;}};
 const tr=(pt,en)=>window.AMSi18n?.getLanguage?.()==='en'?en:pt;
 async function update(rows){
   const owner=window.AMSAuth?.user?.id;
   const row=rows?.find(row=>row.pilot_id===owner);
   if(!row?.circuit){
     key='';revision++;pending=false;
     window.AMSLiveMap?.beginTrack(null);
     status(tr('Sem sessão em direto','No live session'));return;
   }
   const sample=row.sample||{},metadata={...(sample._capture?.metadata||row.metadata||{})};
   const trackId=String(metadata.TrackID??sample.trackId??sample.track_id??'').trim();
   const next=[owner,row.simulator,row.circuit,trackId,metadata.TrackConfigName||'',sample.sessionNum??''].join('|');
   if(next===key&&(pending||Date.now()<nextAttemptAt))return;
   const current=++revision;key=next;pending=true;nextAttemptAt=Date.now()+10000;
   AMSLiveMap.beginTrack({key:next,trackId,circuit:row.circuit});
   try{
     const engine=window.AMSLiveTrack||(window.AMSLiveTrack=AMSTrack.createContext('webLive'));
     let id=trackId;
     if(!id){
       // Existing Windows live rows carry the full circuit/layout name. Only
       // accept it when the catalogue identifies one layout, never a venue guess.
       const index=await engine.getIndex();
       const words=engine.significantWords(row.circuit+' '+(metadata.TrackConfigName||''));
       const matches=words.length?index.filter(entry=>words.every(word=>entry.search.includes(word))):[];
       const ids=[...new Set(matches.map(entry=>engine.entryTrackId(entry)).filter(Boolean))];
       if(ids.length!==1)throw Error('Track layout is missing or ambiguous');
       id=ids[0];
     }
     if(current!==revision)return;
     AMSLiveMap.beginTrack({key:next,trackId:id,circuit:row.circuit});
     const result=await engine.load(row.circuit,metadata.TrackConfigName||'',[{...sample,_capture:{metadata:{...metadata,TrackID:id}}}]);
     if(current!==revision)return;
     if(!result?.map)throw Error('Track map unavailable');
     AMSLiveMap.setTrack(result.map,next);
     nextAttemptAt=Date.now()+60000;
   }catch(error){
     if(current===revision){AMSLiveMap.failTrack(next);console.warn('AMS web live map:',error.message||error);}
   }finally{if(current===revision)pending=false;}
 }
 document.addEventListener('ams-live-update',event=>void update(event.detail?.rows||[]));
 document.addEventListener('ams-auth-changed',event=>{if(!event.detail?.user)void update([]);});
})();
