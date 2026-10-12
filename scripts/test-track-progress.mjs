// Regression tests for missing telemetry progress/GPS fields.
// Run: node scripts/test-track-progress.mjs
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
const context={window:{},console};vm.createContext(context);
vm.runInContext(fs.readFileSync("wwwroot/js/track-map.js","utf8"),context);
vm.runInContext(fs.readFileSync("wwwroot/js/track-fingerprint.js","utf8"),context);
const map=context.window.AMSTrack,fp=context.window.AMSTrackFingerprint;
const bad={lapDistPct:null,position:"",trackPositionPct:null};
assert.equal(map.rawSampleProgress(bad,5,11),0.5,"missing progress should use sample index");
assert.equal(map.rawSampleProgress({lapDistPct:0.42},5,11),0.42);
assert.equal(map.rawSampleProgress({position:42},5,11),0.42);
const samples=Array.from({length:40},(_,i)=>({lapDistPct:i/40,yawNorth:i*Math.PI/20,lat:null,lon:null}));
const fingerprint=fp.telemetryFingerprint(samples);
assert.equal(fingerprint.source,"HEADING","missing GPS must not be interpreted as latitude/longitude zero");
assert.equal(fp.telemetryFingerprint(samples.map(s=>({...s,lat:"",lon:""}))).source,"HEADING");
console.log("Track progress and GPS regression checks passed");
