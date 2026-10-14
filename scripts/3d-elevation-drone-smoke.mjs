import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const trackSource=fs.readFileSync('wwwroot/js/track-map.js','utf8');
const script=fs.readFileSync('wwwroot/js/ams-dual-map-3d-v41.js','utf8');
const styles=fs.readFileSync('wwwroot/css/ams-dual-map-3d-v41.css','utf8');
const html=fs.readFileSync('wwwroot/index.html','utf8');
const sandbox={window:{}};
vm.runInNewContext(trackSource,sandbox);
const t=sandbox.window.AMSTrack;
assert.ok(t&&typeof t.resampleGpsElevation==='function');
// A known, closed, irregularly sampled reference with REAL altitude samples.
// Crucial: projection and alt profile must share the same closed-lap station.
const pts=[];
for(let i=0;i<100;i++){
 const a=2*Math.PI*i/100;
 pts.push({x:Math.cos(a)*80,y:Math.sin(a)*34,alt:390+32*Math.sin(a)+4*Math.cos(2*a)});
}
const line=t.resampleClosed(pts,2400);
const elevations=t.resampleGpsElevation(pts,2400,'fixture');
assert.equal(line.length,2400);
assert.equal(elevations.heights.length,line.length);
assert.ok(Math.abs(elevations.heights[0]-pts[0].alt)<.01);
const index=600;
assert.ok(Math.abs(line[index].x)<2,'quarter-lap alignment drifted');
assert.ok(Math.abs(elevations.heights[index]-(390+32*Math.sin(Math.PI/2)+4*Math.cos(Math.PI)))<3,'quarter-lap altitude misaligned');
assert.ok(elevations.maximumM-elevations.minimumM>60);
const zero=pts.map(p=>({...p,alt:0}));
assert.equal(t.resampleGpsElevation(zero,2400),null,'zero-filled elevation invented');
const partial=pts.map((p,i)=>({...p,alt:i<15?NaN:p.alt}));
assert.equal(t.resampleGpsElevation(partial,2400),null,'missing elevation interpolated silently');
const flat=pts.map(p=>({...p,alt:401}));
assert.equal(t.resampleGpsElevation(flat,2400),null,'flat reference falsely claims relief');
assert.ok(!trackSource.includes('this.centerline=this.resampleClosed(projected,2400);\n    this.elevationProfile='),'2D centerline must be unchanged');
// 3D follow cam is tied to real fit-marker positions, not a synthetic clock.
for(const snippet of ['followCamera(snap=false)','this.followTarget=marker.position.clone()',"this.view.cameraMode==='heli'",
 'cameraSelect.addEventListener','view.reliefScale=Number(heightSelect.value)','heightFactor',
 'data.profile.minimumM.toFixed(0)','altAt(finite(p.q)?p.q:p.p)','p.y+height']){
 assert.ok(script.includes(snippet),'missing drone/elevation feature: '+snippet);
}
assert.ok(styles.includes('ams-map3d-overlay[hidden]')&&html.includes('id="compareFocusSvg"'));
console.log('PASS: elevation aligned with same centerline, missing alt rejected; 2D intact; drone camera follows recorded trajectory.');

// v43 regression: actual renderer must give the racing line the same local
// road elevation, even when iRacing LapDistPct (p) and GPS road station (q)
// differ. The original 2D trajectoryPoint intentionally does not expose q.
const begin=script.indexOf(' geometryContext(){');
const finish=script.indexOf(' makeRibbon(',begin);
assert.ok(begin>=0&&finish>begin,'geometryContext not found');
const geometry=script.slice(begin,finish).trim().replace(/^geometryContext\(\)\{/,'').replace(/\}\s*$/,'');
const geometryFn=new Function('track','finite', 'return function geometryContext(){'+geometry+'}')(
 t,v=>typeof v==='number'&&Number.isFinite(v)
);
t.centerline=line;
t.reference={source:'test track',lengthM:4000};
t.elevationProfile=elevations;
const world={T:{Vector3:class{constructor(x,y,z){this.x=x;this.y=y;this.z=z}}},view:{reliefScale:3}};
const geometryModel=geometryFn.call(world);
assert.equal(geometryModel.hasElevation,true,'synthetic profile unexpectedly missing');
const fixturePoint={...line[600],p:.5,q:.25};
assert.ok(Math.abs(geometryModel.toWorld(fixturePoint,.06).y-(geometryModel.altAt(.25)+.06))<1e-7,
 'line height is not sampled at the actual road geometry station q');
assert.ok(Math.abs(geometryModel.altAt(.25)-geometryModel.altAt(.5))>.1,'regression fixture altitudes too similar');
const heightOfRoad=geometryModel.toWorld({...line[600],p:.25},0).y+.03;
const heightOfLap=geometryModel.toWorld(fixturePoint,0).y+.06;
assert.ok(Math.abs(heightOfLap-heightOfRoad-.03)<1e-7,'trace floats above road');
assert.ok(!script.includes('path,.52,1.03'),'old one-unit floating trajectory offset returned');
assert.match(script,/this\.makeRibbon\(path,\.52,verticalOffset,/);
for(const shift of ['.06','.068']){
 assert.ok(script.includes('this.showTrajectory(')&&script.includes(shift),'missing compact trace offsets');
}
const surfaceStart=script.indexOf(' surfacePoint(fit,progress,offset=0){');
const surfaceEnd=script.indexOf(' moveCars(){',surfaceStart);
assert.ok(surfaceStart>=0&&surfaceEnd>surfaceStart);
const surfMethod=script.slice(surfaceStart,surfaceEnd).trim().replace(/^surfacePoint\(fit,progress,offset=0\)\{/,'').replace(/\}\s*$/,'');
const surfacePoint=new Function('track','finite','return function surfacePoint(fit,progress,offset=0){'+surfMethod+'}')(
 t,v=>typeof v==='number'&&Number.isFinite(v)
);
const fit={points:[{p:0,x:line[600].x,y:line[600].y},{p:1,x:line[600].x,y:line[600].y}],
 sync:[{p:0,q:.25},{p:1,q:.75}]};
const marker=surfacePoint.call({model:geometryModel},fit,.5,.085);
assert.ok(Math.abs(marker.y-(geometryModel.altAt(.5)+.085))<1e-7,
 'moving kart lost its q-based local road elevation');
assert.ok(script.includes('marker.position.copy(ground)'),'kart not grounded on its road surface');
console.log('PASS: 3D ribbon + kart stay on local road station, no 1-unit floating offset.');
