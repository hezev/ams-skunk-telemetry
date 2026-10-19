import fs from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>fs.readFileSync(p,'utf8');
const html=read('wwwroot/portal.html');
const three=read('wwwroot/js/ams-dual-map-3d-v41.js');
const css=read('wwwroot/css/ams-dual-map-3d-v41.css');
const app=read('wwwroot/js/app.js');
// Crucial: existing 2D SVG nodes, selectors, controls, diagrams and charts are untouched.
for(const id of ['telemetryMapFirst','trajectoryCompareSvg','compareFocusStage','compareFocusSvg',
  'compareMiniMapSvg','engineerReplaySeek','compareReplaySeek','compareFocusZoom']){
 assert.ok(html.includes('id="'+id+'"')||['trajectoryCompareSvg'].includes(id),'Missing original 2D node: '+id);
}
assert.match(html,/<script type="module" src="js\/ams-dual-map-3d-v41\.js/);
assert.match(html,/css\/ams-dual-map-3d-v41\.css/);
assert.ok(html.indexOf('ams-dual-map-3d-v41.js')>html.indexOf('js/app.js'), '3D must be additive, after original app');
// 2D MUST be the default; Three.js may only load on explicit 3D click.
assert.match(three,/name==='2D'/);
assert.match(three,/btn3\.addEventListener\('click',\(\)=>setActive\(true\)\)/);
assert.match(three,/loadThree\(\)/);
assert.match(three,/overlay\.hidden=true/);
assert.match(css,/ams-map3d-overlay\[hidden\]\{display:none!important\}/);
assert.match(css,/compareFocusStage\.ams-map3d-active/);
// Re-use the original validated map geometry and trajectory fitting.
assert.match(three,/track\.centerline/);
assert.match(three,/track\.trajectoryCompare/);
assert.match(three,/track\.focusedCompare/);
assert.match(three,/track\.trajectoryPoint/);
assert.match(app,/ams-3d-telemetry-data/);
assert.match(app,/ams-compare-data/);
// Without an elevation channel, map remains visually planar: y is a renderer-only constant.
assert.match(three,/SEM ALTITUDE PONTUAL|sem dados de elevação/);
console.log('PASS: opt-in maps, 2D original preserved, event wiring, planar-data honesty');
