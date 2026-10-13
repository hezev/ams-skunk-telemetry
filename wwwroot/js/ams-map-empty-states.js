/* Map empty-state cues. Do not alter track geometry, replay positions or SVG markers. */
(()=>{
'use strict';
const attach=(stageSelector,statusSelector,emptyText,unavailableText)=>{
 const stage=document.querySelector(stageSelector),status=document.querySelector(statusSelector);
 if(!stage||!status)return;
 const hint=document.createElement('div');hint.className='ams-map-empty-hint';hint.setAttribute('role','status');
 stage.append(hint);
 const update=()=>{
  const value=status.textContent.trim();
  const unavailable=/INSUFICIENTE|SEM TRAJECTÓRIA|SEM COMPARAÇÃO|SEM PISTA|SEM MAPA/i.test(value);
  const waiting=/SELECIONA|SEM VOLTA|SEM DADOS/i.test(value);
  const show=unavailable||waiting;
  hint.textContent=unavailable?unavailableText:emptyText;
  hint.hidden=!show;
 };
 new MutationObserver(update).observe(status,{childList:true,subtree:true,characterData:true});
 update();
};
attach('#telemetryMapFirst .trajectory-stage','#trajectoryCompareStatus','Seleciona uma volta para visualizar a trajetória.','Não há trajetória disponível para esta volta.');
attach('#compareFocusStage','#compareFocusStatus','Seleciona duas voltas para visualizar a comparação.','Não há dados suficientes para apresentar este mapa.');
})();