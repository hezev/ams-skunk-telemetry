import fs from "node:fs";

const read=p=>fs.readFileSync(p,"utf8");
const index=read("wwwroot/index.html");
const app=read("wwwroot/js/app.js");
const analysis=read("wwwroot/js/analysis.js");
const charts=read("wwwroot/js/charts.js");
const fingerprint=read("wwwroot/js/track-fingerprint.js");
const track=read("wwwroot/js/track-map.js");
const ui=read("wwwroot/js/engineering-ui.js");

for(const [name,src] of [["app",app],["analysis",analysis],["charts",charts],["track-fingerprint",fingerprint],["track-map",track],["engineering-ui",ui]]){
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
for(const token of ["telemetryFingerprint","signatureFromPoints","compare","hashSignature"]){
  if(!fingerprint.includes(token)) throw new Error("Missing fingerprint capability "+token);
}

globalThis.window={};
new Function(fingerprint)();
const FP=globalThis.window.AMSTrackFingerprint;
if(!FP) throw new Error("Track Fingerprint Engine did not initialize");
const base=Array.from({length:220},(_,i)=>{
  const a=Math.PI*2*i/220;
  const r=1+.18*Math.sin(a*3)+.08*Math.sin(a*7);
  return {x:Math.cos(a)*r*1.7,y:Math.sin(a)*r};
});
const transformed=base.map(({x,y})=>{
  const a=.83,c=Math.cos(a),sn=Math.sin(a);
  return {x:(x*c-y*sn)*2.4+37,y:(x*sn+y*c)*2.4-12};
});
const wrong=Array.from({length:220},(_,i)=>{
  const a=Math.PI*2*i/220;
  return {x:Math.cos(a)*1.8,y:Math.sin(a)};
});
const sig=FP.signatureFromPoints(base);
const fp={source:"GPS",points:sig.points,headings:sig.headings,cacheKey:"smoke"};
const same=FP.compare(fp,transformed);
const other=FP.compare(fp,wrong);
if(!same||same.score<.8) throw new Error("Fingerprint invariant match too weak");
if(!other||same.score<=other.score+.08) throw new Error("Fingerprint cannot separate layouts");
for(const token of ["renderAnalysisMap","setAnalysisPosition","GPS REFERENCE","renderTrajectoryCompare","setTrajectoryPosition","integrateTrajectory","renderTrajectoryCoaching","setTrajectoryCoachingPosition","detectCorners","renderFocusedCompare","setFocusedComparePosition","setFocusedCompareZoom","estimateLapLength","lengthMatchScore","buildTrackSync","mappedProgress","reconstructRelativeTrajectory","gpsSampleLatLon","hasRealGps","reconstructGpsTrajectory","resolveByFingerprint","artworkFingerprintCenterline","fingerprintCandidates","hasMultipleConfigurations","distinctiveLayoutTokens","TrackID is authoritative"]){
  if(!track.includes(token)) throw new Error("Missing map capability "+token);
}
for(const token of ["refreshEngineeringAnalysis","renderMiniSectors","renderDrivingEvents","setZoomWindow","ams-trajectory-seek","startCompareReplay","setCompareProgress","seekCompare"]){
  if(!app.includes(token)) throw new Error("Missing app capability "+token);
}

console.log("AMS engineering telemetry smoke test: OK");
