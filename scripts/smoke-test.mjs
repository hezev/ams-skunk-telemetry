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
for(const token of ["renderAnalysisMap","setAnalysisPosition","GPS REFERENCE","renderTrajectoryCompare","setTrajectoryPosition","integrateTrajectory","renderTrajectoryCoaching","setTrajectoryCoachingPosition","detectCorners","renderFocusedCompare","setFocusedComparePosition","setFocusedCompareZoom","estimateLapLength","lengthMatchScore","buildTrackSync","mappedProgress","reconstructRelativeTrajectory"]){
  if(!track.includes(token)) throw new Error("Missing map capability "+token);
}
for(const token of ["refreshEngineeringAnalysis","renderMiniSectors","renderDrivingEvents","setZoomWindow","ams-trajectory-seek","startCompareReplay","setCompareProgress","seekCompare"]){
  if(!app.includes(token)) throw new Error("Missing app capability "+token);
}

console.log("AMS engineering telemetry smoke test: OK");
