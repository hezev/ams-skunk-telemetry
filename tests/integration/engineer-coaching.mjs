import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const platform=process.env.AMS_APP||'windows';
const root=new URL(`../../wwwroot/js/`,import.meta.url);
let language='pt';
const context=vm.createContext({console,document:{getElementById:()=>null,addEventListener(){}},requestAnimationFrame(){},addEventListener(){},
  AMSi18n:{getLanguage:()=>language}});
context.window=context;
for(const file of ['analysis.js','engineer-coaching.js','engineer.js','ai-engineer.js'])vm.runInContext(fs.readFileSync(new URL(file,root),'utf8'),context);
const coach=context.AMSEngineerCoaching,ai=context.AMSAIEngineer,engine=context.AMSEngineer;
const zone=(index,extra={})=>({index,label:'Zona '+index,start:.1,end:.2,diagnosis:'DRIVER',brakeSamples:3,throttleSamples:3,minSpeedSamples:3,
  drivingEvidence:{loss:.24,brakeShiftP:-.003,throttleShiftP:0,minSpeedLoss:0},...extra});
const report={ok:true,context:{simulator:'iRacing',circuit:'Selected track',car:'Selected car',sessionId:'archive'},zones:[
  zone(1),zone(2,{diagnosis:'SETUP'}),zone(3,{diagnosis:'BOTH'}),zone(4,{diagnosis:'INCONCLUSIVE'}),
  zone(5,{drivingEvidence:{loss:.01,brakeShiftP:-.005}}),zone(6,{drivingEvidence:{loss:0,brakeShiftP:-.005}}),
  zone(7,{drivingEvidence:{loss:.3,brakeShiftP:null,throttleShiftP:null,minSpeedLoss:null}}),
  zone(8,{brakeSamples:1,throttleSamples:1,minSpeedSamples:1}),
  zone(9,{drivingEvidence:{loss:.42,brakeShiftP:0,throttleShiftP:.006,minSpeedLoss:0}}),
  zone(10,{drivingEvidence:{loss:.31,brakeShiftP:0,throttleShiftP:0,minSpeedLoss:8}}),
  zone(11,{drivingEvidence:{loss:.15,brakeShiftP:.005,throttleShiftP:0,minSpeedLoss:0}})
]};
assert.equal(coach.zones(report).map(z=>z.index).join(','),'9,10,1,11','Only meaningful driving losses with actual input evidence qualify');
assert.equal(coach.lessons(report).length,3,'The teaching plan has at most three priorities');
assert.equal(coach.lessons(report)[0].cause,'exit');
assert.equal(coach.lesson(zone(11,{drivingEvidence:{loss:.15,brakeShiftP:.005}})).cause,'late-braking');
assert.equal(coach.zones({ok:true,zones:[zone(1,{drivingEvidence:{loss:-.2,brakeShiftP:-.004}})]}).length,0,'A gain is not a weakness');
assert.equal(coach.zones({ok:true,zones:[zone(1,{drivingEvidence:undefined})]}).length,0,'Legacy reports must not invent lap-specific losses');
const joined=coach.lessons({ok:true,zones:[zone(1,{start:.1,end:.15}),zone(2,{start:.15,end:.2})]});
assert.equal(joined.length,1,'Consecutive zones with the same difficulty form one exercise');
assert.equal(joined[0].loss,.48,'Grouped losses are the sum of non-overlapping intervals');
const fp=engine.fingerprint({samples:[{_p:.15,speed:null,steer:null,yawRate:null}]},[],.1,.2);
assert.equal(fp.minSpeed,null,'Missing speed must not become zero');
const lessons=coach.lessons(report);
assert.equal(ai.readResponse('Verbose unstructured diagnosis',lessons),null);
assert.equal(ai.readResponse(JSON.stringify({lessons:[{zone:999,action:'Invented',practice:'Invented'}]}),lessons),null);
assert.equal(ai.readResponse(JSON.stringify({lessons:[{zone:9,action:'Brake 20 metres later',practice:'Repeat'}]}),lessons),null,'AI must not introduce numerical instructions');
assert.equal(ai.readResponse(JSON.stringify({lessons:[{zone:9,action:'Altera o setup.',practice:'Troca as molas.'}]}),lessons),null,'Setup advice must not replace driving lessons');
const refined=ai.readResponse(JSON.stringify({lessons:[{zone:9,action:'Olha para a saída e abre o volante.',practice:'Repete três passagens e compara o acelerador.'}]}),lessons);
assert.equal(refined[0].loss,lessons[0].loss,'AI cannot replace measured loss');
assert.equal(refined[0].observation,lessons[0].observation,'AI cannot replace measured evidence');
assert.match(refined[0].action,/Olha/);
language='en';assert.match(coach.lesson(zone(1)).observation,/earlier/);language='pt';
engine.currentReport=report;
const compact=ai.report();
assert.equal(compact.coaching_zones.length,3);
assert.equal('setup_influence' in compact,false);
assert.equal('evidence_rows' in compact,false,'AI data comes from the structured report, not table cell positions');
let requests=0,resolveRequest;
context.AMSAuth={token:async()=>'fixture'};
context.AMSSupabase={request:async(url,options)=>{
  requests++;assert.equal(options.body.context.circuit,'Selected track');assert.ok(options.body.question.length<=1200);
  return new Promise(resolve=>{resolveRequest=resolve;});
}};
const displayed=[];ai.render=(value)=>displayed.push(value);
const pending=ai.ask('Como praticar?');
await new Promise(resolve=>setImmediate(resolve));
engine.currentReport={ok:true,zones:[]};
resolveRequest({text:JSON.stringify({lessons:[{zone:9,action:'Resposta antiga',practice:'Não mostrar'}]})});
await pending;assert.equal(displayed.length,0,'A stale AI reply must not overwrite the selected session');
await ai.ask();assert.equal(requests,1,'No confirmed weakness means no AI request');
// End-to-end calculation with different recorded braking and throttle points.
const laps=[0,1,2].map(n=>({id:String(n),lap_time_ms:(100+3*n)*1000,telemetry:Array.from({length:1001},(_,i)=>{
  const p=i/1000,local=p%.2;
  return {position:p*100,t:p*(100+3*n),speed:130-30*Math.sin(Math.PI*local/.2)-4*n,
    brake:local>=.06-n*.004&&local<.09?60:0,throttle:local<.11+n*.004?20:95,gear:3,steer:8,yawRate:2};
})}));
const analyzed=engine.analyze(laps,{minisectors:20});
assert.ok(coach.zones(analyzed).length>0,'Measured changes must produce an actionable driving weakness');
assert.ok(coach.zones(analyzed).every(z=>z.drivingEvidence.loss>=.05));
const fastestLatest=engine.analyze([laps[2],laps[1],laps[0]],{minisectors:20});
assert.equal(coach.zones(fastestLatest).length,0,'The latest lap is the reference: do not coach losses from older laps');
const identical=engine.analyze([laps[0],{...laps[0],id:'same'}],{minisectors:20});
assert.equal(coach.zones(identical).length,0,'Repeatable identical laps must not generate driving faults');
console.log(`PASS (${platform}): meaningful losses, missing inputs, latest-lap comparison, concise coaching, AI validation and stale-reply isolation.`);
