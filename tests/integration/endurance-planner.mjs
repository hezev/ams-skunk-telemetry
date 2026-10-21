import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const platform=process.env.AMS_APP||'windows',sandbox={window:{}};
vm.runInNewContext(fs.readFileSync(new URL(`../../wwwroot/js/endurance-planner.js`,import.meta.url),'utf8'),sandbox);
const engine=sandbox.window.AMSEndurancePlanner;
const config={raceMinutes:360,tankLitres:100,startLitres:100,reserveLitres:5,litresPerLap:3,maxStintMinutes:60,
 tyreLaps:50,pitLossSeconds:25,refuelLitresPerSecond:2,tyreSeconds:30,swapSeconds:20,parallelService:true,
 drivers:[{id:'a',name:'Pilot A',paceSeconds:120},{id:'b',name:'Pilot B',paceSeconds:122}]};
function verify(c){
 const result=engine.calculate(c);assert.ok(result.seconds>=c.raceMinutes*60);
 assert.equal(result.stops,result.stints.length-1);
 let previous=0,laps=0,used=0;
 const tyreMileage=new Map();
 result.stints.forEach((s,index)=>{
  assert.equal(s.driverId,c.drivers[index%c.drivers.length].id);
  assert.ok(s.fuelStart<=c.tankLitres+1e-7);assert.ok(s.fuelEnd>=c.reserveLitres-1e-7);
  assert.ok(s.endSeconds-s.startSeconds<=c.maxStintMinutes*60+1e-7);
  assert.equal(s.firstLap,laps+1);assert.equal(s.lastLap,laps+s.laps);laps+=s.laps;
  tyreMileage.set(s.tyreSet,(tyreMileage.get(s.tyreSet)||0)+s.laps);
  assert.ok(tyreMileage.get(s.tyreSet)<=c.tyreLaps);
  assert.ok(Math.abs(s.fuelStart-s.fuelEnd-s.laps*c.litresPerLap)<1e-6);
  if(index){
   assert.ok(s.pitBefore);assert.equal(s.startSeconds,previous+s.pitBefore.seconds);
   assert.ok(Math.abs(s.fuelStart-result.stints[index-1].fuelEnd-s.pitBefore.refuelLitres)<1e-6);
   const pit=s.pitBefore,services=[pit.refuelLitres/c.refuelLitresPerSecond,pit.changeTyres?c.tyreSeconds:0,pit.changeDriver?c.swapSeconds:0];
   const expected=c.pitLossSeconds+(c.parallelService?Math.max(...services):services.reduce((a,b)=>a+b,0));
   assert.ok(Math.abs(pit.seconds-expected)<1e-7,'Parallel/sequential services and driver swaps must match configured times');
  }else{assert.equal(s.pitBefore,null);assert.equal(s.startSeconds,0);}
  used+=s.laps*c.litresPerLap;previous=s.endSeconds;
 });
 assert.equal(laps,result.laps);assert.equal(previous,result.seconds);
 assert.ok(Math.abs(c.startLitres+result.refuelLitres-used-result.stints.at(-1).fuelEnd)<1e-6);
 const last=result.stints.at(-1),pace=c.drivers.find(d=>d.id===last.driverId).paceSeconds;
 assert.ok(last.endSeconds-pace<c.raceMinutes*60+1e-7||last.laps===1,'Stops may cross the flag time but must finish one lap');
 assert.equal(result.drivers.reduce((n,d)=>n+d.laps,0),result.laps);
 assert.equal(result.tyreSets,1+result.stints.filter(s=>s.pitBefore?.changeTyres).length);
 return result;
}
const normal=verify(config);assert.ok(normal.stops>0);assert.equal(normal.drivers.length,2);
const short=verify({...config,raceMinutes:1});assert.equal(short.stops,0);assert.equal(short.refuelLitres,0);assert.equal(short.laps,1);
verify({...config,raceMinutes:1440,tyreLaps:17,parallelService:false});
verify({...config,raceMinutes:13,startLitres:8,tyreLaps:2});
verify({...config,changeTyresEveryStop:true,drivers:[config.drivers[0]]});
for(let i=1;i<=200;i++)verify({...config,raceMinutes:5+i*2.31,tankLitres:20+i%90,startLitres:20+i%90,tyreLaps:1+i%60,maxStintMinutes:5+i%55,parallelService:i%2===0});
for(const [patch,error] of [[{litresPerLap:0},'FUEL_USE'],[{drivers:[]},'DRIVERS'],[{startLitres:101},'FUEL_START'],[{reserveLitres:101},'FUEL_RESERVE'],[{startLitres:7},'START_NO_LAP'],[{tyreLaps:1.5},'TYRE_LIFE'],[{tankLitres:null},'FUEL_TANK']])assert.throws(()=>engine.calculate({...config,...patch}),new RegExp(error));
assert.equal(engine.measuredPace([{lap_time_ms:120000},{lap_time_ms:121000},{lap_time_ms:180000},{lap_time_ms:0}]).seconds,121);
assert.equal(engine.measuredPace([]),null);
console.log('PASS: endurance rotation, fuel conservation/reserve/capacity, tyre life, pit service, final fill, timed finish, 200 varied races and invalid-input checks.');
