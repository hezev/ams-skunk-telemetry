import fs from "node:fs";

const read=p=>fs.readFileSync(p,"utf8");
const index=read("wwwroot/index.html");
const app=read("wwwroot/js/app.js");
const analysis=read("wwwroot/js/analysis.js");
const charts=read("wwwroot/js/charts.js");
const track=read("wwwroot/js/track-map.js");
const ui=read("wwwroot/js/engineering-ui.js");

for(const [name,src] of [["app",app],["analysis",analysis],["charts",charts],["track-map",track],["engineering-ui",ui]]){
  try{ new Function(src); }
  catch(err){ throw new Error(name+" syntax: "+err.message); }
}

for(const id of ["telemetryLapSelect","telemetryReferenceSelect","engineeringAnalysisMount","telemetryReferenceTime","telemetryLapDelta"]){
  if(!index.includes('id="'+id+'"')) throw new Error("Missing index id "+id);
}

for(const id of ["zoomStart","zoomEnd","miniSectorCount","analysisTrackSvg","trajectoryCompareSvg","trajectoryCompareStatus","trajectoryCoachCurrent","trajectoryCoachBody","sectorAnalysisBody","miniSectorBody","drivingEventsBody"]){
  if(!ui.includes('id="'+id+'"')) throw new Error("Missing engineering UI id "+id);
}
for(const id of ["compareFocusSvg","compareMiniMapSvg","compareFocusCoach","compareReplaySeek","compareFocusZoom","compareReplayBtn","compareReplayToggle"]){
  if(!index.includes('id="'+id+'"')) throw new Error("Missing Lap Compare id "+id);
}

for(const token of ["prepareLap","comparisonProfile","detectEvents","segmentStats"]){
  if(!analysis.includes(token)) throw new Error("Missing analysis function "+token);
}
for(const token of ["setReference","setZoom","timeDelta","cursorCallback"]){
  if(!charts.includes(token)) throw new Error("Missing chart capability "+token);
}
for(const token of ["renderAnalysisMap","setAnalysisPosition","GPS REFERENCE","renderTrajectoryCompare","setTrajectoryPosition","integrateTrajectory","renderTrajectoryCoaching","setTrajectoryCoachingPosition","detectCorners","renderFocusedCompare","setFocusedComparePosition","setFocusedCompareZoom","estimateLapLength","lengthMatchScore","buildTrackSync","mappedProgress","reconstructRelativeTrajectory","gpsSampleLatLon","hasRealGps","reconstructGpsTrajectory","hasMultipleConfigurations","metadataTrackLengthM","artworkStartFinishPoint","calibrateArtworkCenterline","circularFitOffset","yawOffset","MAPA OK · TRAJECTÓRIA INSUFICIENTE","renderDashboardCompareMap","dashboardMapCursor"]){
  if(!track.includes(token)) throw new Error("Missing map capability "+token);
}
for(const token of ["refreshEngineeringAnalysis","renderMiniSectors","renderDrivingEvents","setZoomWindow","ams-trajectory-seek","startCompareReplay","setCompareProgress","seekCompare"]){
  if(!app.includes(token)) throw new Error("Missing app capability "+token);
}


// Layout regressions: map first, compact expandable charts second, coaching in a separate panel.
const telemetryIndex=index.slice(index.indexOf('<section id="telemetry"'),index.indexOf('</section>',index.indexOf('<section id="telemetry"')));
const mapPos=telemetryIndex.indexOf('id="telemetryMapFirst"');
const chartPos=telemetryIndex.indexOf('class="telemetry-grid telemetry-grid-dense"');
const analysisPos=telemetryIndex.indexOf('id="engineeringAnalysisMount"');
if(mapPos<0||chartPos<0||analysisPos<0||!(mapPos<chartPos&&chartPos<analysisPos)){
  throw new Error("Telemetry map / charts / analysis order regression");
}
const expand=read("wwwroot/js/ams-telemetry-expand.js");
const compact=read("wwwroot/css/ams-telemetry-expand.css");
try{new Function(expand);}catch(err){throw new Error("Telemetry expand syntax: "+err.message);}
for(const token of ["ams-trajectory-coach-panel","trajectory-coach-current","trajectory-coach-table-wrap","telemetryMapFirst","ams-chart-expanded","AMSCharts?.drawAll"]){
  if(!expand.includes(token))throw new Error("Missing map, coach or chart expansion integration: "+token);
}
for(const token of [".ams-chart-expanded","height:102px","height:90px"]){
  if(!compact.includes(token))throw new Error("Missing compact/expanded chart styling: "+token);
}

for(const id of ["trajectoryMarkerA","trajectoryMarkerRef","compareLapMarkerA","compareLapMarkerRef"]){if(!track.includes(id))throw new Error("Missing visible lap marker "+id);}

// Production presentation integrity: every linked local CSS/JS asset must exist.
const assetRefs=[...index.matchAll(/<(?:script|link)\b[^>]*(?:src|href)="((?:css|js)\/[^"]+)"/g)]
  .map(match=>match[1].split("?")[0]);
for(const asset of assetRefs){
  if(!fs.existsSync("wwwroot/"+asset))throw new Error("Missing deployed asset: "+asset);
}
const cssOrder=assetRefs.filter(path=>path.endsWith(".css"));
const idx=path=>cssOrder.indexOf(path);
for(const [before,after] of [
  ["css/ams-square-compact.css","css/ams-workstation-v7.css"],
  ["css/ams-telemetry-expand.css","css/ams-workstation-v7.css"],
  ["css/ams-workstation-v7.css","css/ams-dashboard-engineer-v8.css"],
  ["css/ams-dashboard-engineer-v8.css","css/ams-records-setup-v9.css"]
]){
  if(idx(before)<0||idx(after)<0||idx(before)>=idx(after))throw new Error("Workstation CSS load order regression: "+before+" -> "+after);
}
if(index.includes('data-view="overlay-builder"'))throw new Error("Overlay Builder unexpectedly restored to navigation");


const cursorMethod=charts.match(/  setCompareExternalCursors\(a,b\)\{[\s\S]*?\n  \},/);
if(!cursorMethod)throw new Error("Missing Compare cursor update method");
const {setCompareExternalCursors}=new Function("return ({"+cursorMethod[0]+"})")();
const chartState={compareCursorA:undefined,compareCursorB:undefined,cursorPos:.4,scheduleDraw(){}};
setCompareExternalCursors.call(chartState,.2,.7);
if(chartState.compareCursorA!==.2||chartState.compareCursorB!==.7)throw new Error("Compare replay cursors not synchronized");
setCompareExternalCursors.call(chartState,null,null);
if(chartState.compareCursorA!==null||chartState.compareCursorB!==null)throw new Error("Cleared Compare cursors incorrectly snap to start");
setCompareExternalCursors.call(chartState,0,1);
if(chartState.compareCursorA!==0||chartState.compareCursorB!==1)throw new Error("Valid Compare 0% or 100% cursor rejected");

console.log("AMS engineering telemetry smoke test: OK");
