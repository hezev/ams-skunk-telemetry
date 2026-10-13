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

console.log("AMS engineering telemetry smoke test: OK");
