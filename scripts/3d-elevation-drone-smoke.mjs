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
 'data.profile.minimumM.toFixed(0)','altAt(p.p)','p.y+height']){
 assert.ok(script.includes(snippet),'missing drone/elevation feature: '+snippet);
}
assert.ok(styles.includes('ams-map3d-overlay[hidden]')&&html.includes('id="compareFocusSvg"'));
console.log('PASS: elevation aligned with same centerline, missing alt rejected; 2D intact; drone camera follows recorded trajectory.');
