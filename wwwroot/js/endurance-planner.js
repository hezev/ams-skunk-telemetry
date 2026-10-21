/* Pure planning engine. Seconds, litres and complete laps; no live-state writes. */
(()=>{
  'use strict';
  const fail=code=>{throw new Error(code);};
  const number=(v,min,max,code)=>{
    if(v===null||v===''||typeof v==='boolean')fail(code);
    const n=Number(v);if(!Number.isFinite(n)||n<min||n>max)fail(code);return n;
  };
  function calculate(input){
    const race=number(input.raceMinutes,1,2880,'RACE_DURATION')*60;
    const tank=number(input.tankLitres,.1,500,'FUEL_TANK');
    const reserve=number(input.reserveLitres,0,tank,'FUEL_RESERVE');
    const start=number(input.startLitres,0,tank,'FUEL_START');
    const use=number(input.litresPerLap,.001,100,'FUEL_USE');
    const maxSeconds=number(input.maxStintMinutes,1,300,'STINT_DURATION')*60;
    const tyreLife=number(input.tyreLaps,1,10000,'TYRE_LIFE');
    if(!Number.isInteger(tyreLife))fail('TYRE_LIFE');
    const lane=number(input.pitLossSeconds,0,1800,'PIT_LOSS');
    const rate=number(input.refuelLitresPerSecond,.01,100,'REFUEL_RATE');
    const tyreSeconds=number(input.tyreSeconds,0,1800,'TYRE_TIME');
    const swapSeconds=number(input.swapSeconds,0,1800,'SWAP_TIME');
    const drivers=input.drivers;
    if(!Array.isArray(drivers)||!drivers.length||drivers.length>16)fail('DRIVERS');
    if(new Set(drivers.map(d=>d.id)).size!==drivers.length)fail('DRIVERS');
    const roster=drivers.map(d=>({id:String(d.id||''),name:String(d.name||'').slice(0,80),
      pace:number(d.paceSeconds,5,7200,'DRIVER_PACE')}));
    if(roster.some(d=>!d.id))fail('DRIVERS');
    const limit=(fuel,tyres,driver)=>Math.min(Math.floor((fuel-reserve+1e-8)/use),
      Math.floor((maxSeconds+1e-8)/driver.pace),tyres);
    if(roster.some(d=>limit(tank,tyreLife,d)<1))fail('STINT_NO_LAP');
    if(limit(start,tyreLife,roster[0])<1)fail('START_NO_LAP');
    const stints=[],totals=roster.map(d=>({id:d.id,name:d.name,laps:0,seconds:0,stints:0}));
    let elapsed=0,fuel=start,tyres=tyreLife,lap=0,tyreSet=1,pendingPit=null;
    for(let i=0;i<5000;i++){
      const driver=roster[i%roster.length],capacity=limit(fuel,tyres,driver);
      if(capacity<1)fail('STINT_NO_LAP');
      const needed=Math.max(1,Math.ceil((race-elapsed-1e-8)/driver.pace));
      const laps=Math.min(capacity,needed),begin=elapsed,initial=fuel;
      elapsed+=laps*driver.pace;fuel=Math.max(0,fuel-laps*use);tyres-=laps;
      const stint={number:i+1,driverId:driver.id,driver:driver.name,startSeconds:begin,endSeconds:elapsed,
        firstLap:lap+1,lastLap:lap+laps,laps,fuelStart:initial,fuelEnd:fuel,tyreSet,pitBefore:pendingPit};
      stints.push(stint);lap+=laps;
      const total=totals[i%roster.length];total.laps+=laps;total.seconds+=laps*driver.pace;total.stints++;
      if(elapsed>=race-1e-8)return {stints,drivers:totals,laps:lap,seconds:elapsed,stops:stints.length-1,
        refuelLitres:stints.reduce((sum,s)=>sum+(s.pitBefore?.refuelLitres||0),0),
        pitSeconds:stints.reduce((sum,s)=>sum+(s.pitBefore?.seconds||0),0),tyreSets:tyreSet,
        consumptionLitres:lap*use,reserveLitres:reserve};
      const next=roster[(i+1)%roster.length];
      const changeTyres=tyres===0||input.changeTyresEveryStop===true;
      if(changeTyres){tyres=tyreLife;tyreSet++;}
      const changeDriver=next.id!==driver.id;
      const maxLaps=limit(tank,tyres,next);
      const service=litres=>{
        const refuel=litres/rate,tire=changeTyres?tyreSeconds:0,swap=changeDriver?swapSeconds:0;
        return lane+(input.parallelService===true?Math.max(refuel,tire,swap):refuel+tire+swap);
      };
      // Minimise the final fill, including time spent in that stop. If no shorter
      // stint reaches the flag, fill for the full feasible next stint.
      let nextLaps=maxLaps;
      for(let n=1;n<=maxLaps;n++){
        const add=Math.max(0,reserve+n*use-fuel);
        if(elapsed+service(add)+n*next.pace>=race-1e-8){nextLaps=n;break;}
      }
      const add=Math.max(0,reserve+nextLaps*use-fuel),pitTime=service(add);
      pendingPit={atSeconds:elapsed,seconds:pitTime,refuelLitres:add,changeTyres,changeDriver};
      fuel+=add;elapsed+=pitTime;
    }
    fail('PLAN_TOO_LONG');
  }
  function measuredPace(laps){
    // Use the median of the fastest five recorded laps, never a fabricated pace.
    const valid=laps.map(l=>Number(l.lap_time_ms)/1000).filter(n=>n>=5&&n<=7200).sort((a,b)=>a-b).slice(0,5);
    if(!valid.length)return null;
    const m=Math.floor(valid.length/2);return {seconds:valid.length%2?valid[m]:(valid[m-1]+valid[m])/2,count:valid.length};
  }
  window.AMSEndurancePlanner=Object.freeze({calculate,measuredPace});
})();
