window.AMSAnalysis = {
  clamp(v,a=0,b=1){ return Math.max(a,Math.min(b,v)); },

  prepareLap(detail){
    const raw=Array.isArray(detail?.telemetry)?detail.telemetry:[];
    const valid=raw.map((s,i)=>{
      const p=Number(s?.position);
      const t=Number(s?.t);
      if(!Number.isFinite(p)) return null;
      return {...s,_index:i,_p:this.clamp(p/100),_rawTime:Number.isFinite(t)?t:null};
    }).filter(Boolean).sort((a,b)=>a._p-b._p);

    if(!valid.length) return {detail,samples:[],lapTimeSec:Number(detail?.lap_time_ms||0)/1000};

    const timed=valid.filter(s=>Number.isFinite(s._rawTime));
    const t0=timed[0]?._rawTime??0;
    const t1=timed[timed.length-1]?._rawTime??t0;
    const official=Number(detail?.lap_time_ms)/1000;
    const rawDuration=Math.max(.001,t1-t0);
    const lapTimeSec=Number.isFinite(official)&&official>0?official:rawDuration;
    const scale=lapTimeSec/rawDuration;

    valid.forEach(s=>{
      s._time=Number.isFinite(s._rawTime)?Math.max(0,(s._rawTime-t0)*scale):null;
    });

    return {detail,samples:valid,lapTimeSec,t0,t1,scale};
  },

  bracket(lap,pct){
    const p=this.clamp(pct);
    const a=lap?.samples||[];
    if(!a.length) return null;
    if(p<=a[0]._p) return {a:null,b:a[0],t:a[0]._p>0?p/a[0]._p:0};
    if(p>=a[a.length-1]._p){
      const start=a[a.length-1]._p;
      return {a:a[a.length-1],b:null,t:start<1?(p-start)/(1-start):1};
    }
    let lo=0,hi=a.length-1;
    while(hi-lo>1){
      const m=(lo+hi)>>1;
      if(a[m]._p<=p) lo=m; else hi=m;
    }
    const pa=a[lo]._p,pb=a[hi]._p;
    return {a:a[lo],b:a[hi],t:pb>pa?(p-pa)/(pb-pa):0};
  },

  interpolate(lap,pct,key){
    const br=this.bracket(lap,pct);
    if(!br) return null;
    const read=(s)=>{
      if(!s) return null;
      const v=key==="_time"?s._time:Number(s?.[key]);
      return Number.isFinite(v)?v:null;
    };
    let av=read(br.a),bv=read(br.b);
    if(key==="_time"){
      if(br.a===null) av=0;
      if(br.b===null) bv=lap.lapTimeSec;
    }
    if(av===null&&bv===null) return null;
    if(av===null) return bv;
    if(bv===null) return av;
    return av+(bv-av)*br.t;
  },

  timeAt(lap,pct){ return this.interpolate(lap,pct,"_time"); },

  progressAtTime(lap,timeSec){
    const duration=Math.max(.001,Number(lap?.lapTimeSec)||0);
    const t=Math.max(0,Math.min(duration,Number(timeSec)||0));
    if(t<=0)return 0;
    if(t>=duration)return 1;

    const timed=(lap?.samples||[])
      .filter(s=>Number.isFinite(Number(s?._time))&&Number.isFinite(Number(s?._p)))
      .sort((a,b)=>Number(a._time)-Number(b._time));

    if(timed.length<2)return this.clamp(t/duration);
    if(t<=Number(timed[0]._time)){
      const end=Math.max(.000001,Number(timed[0]._time));
      return this.clamp(Number(timed[0]._p)*(t/end));
    }
    if(t>=Number(timed[timed.length-1]._time)){
      const a=timed[timed.length-1];
      const ta=Number(a._time),pa=Number(a._p);
      const span=Math.max(.000001,duration-ta);
      return this.clamp(pa+(1-pa)*(t-ta)/span);
    }

    let lo=0,hi=timed.length-1;
    while(hi-lo>1){
      const m=(lo+hi)>>1;
      if(Number(timed[m]._time)<=t)lo=m;else hi=m;
    }
    const a=timed[lo],b=timed[hi];
    const ta=Number(a._time),tb=Number(b._time);
    const pa=Number(a._p),pb=Number(b._p);
    const u=tb>ta?(t-ta)/(tb-ta):0;
    return this.clamp(pa+(pb-pa)*u);
  },

  segmentStats(lap,start,end){
    const s=this.clamp(start),e=this.clamp(end);
    const samples=(lap?.samples||[]).filter(x=>x._p>=s&&x._p<=e);
    const values=key=>samples.map(x=>Number(x?.[key])).filter(Number.isFinite);
    const speed=values("speed"),brake=values("brake"),throttle=values("throttle"),gear=values("gear"),glat=values("gLat"),glong=values("gLong");
    const t0=this.timeAt(lap,s),t1=this.timeAt(lap,e);
    const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
    return {
      start:s,end:e,
      time:Number.isFinite(t0)&&Number.isFinite(t1)?Math.max(0,t1-t0):null,
      minSpeed:speed.length?Math.min(...speed):null,
      maxSpeed:speed.length?Math.max(...speed):null,
      peakBrake:brake.length?Math.max(...brake):null,
      avgThrottle:avg(throttle),
      minGear:gear.length?Math.min(...gear):null,
      maxGear:gear.length?Math.max(...gear):null,
      peakLatG:glat.length?Math.max(...glat.map(Math.abs)):null,
      peakLongG:glong.length?Math.max(...glong.map(Math.abs)):null
    };
  },

  zones(lap,ref,count){
    const out=[];
    for(let i=0;i<count;i++){
      const start=i/count,end=(i+1)/count;
      const a=this.segmentStats(lap,start,end);
      const b=ref?this.segmentStats(ref,start,end):null;
      out.push({
        index:i+1,start,end,a,b,
        delta:a&&b&&Number.isFinite(a.time)&&Number.isFinite(b.time)?a.time-b.time:null
      });
    }
    return out;
  },

  comparisonProfile(lap,ref,points=301){
    if(!lap||!ref) return [];
    const out=[];
    for(let i=0;i<points;i++){
      const p=i/(points-1);
      const ta=this.timeAt(lap,p),tb=this.timeAt(ref,p);
      if(Number.isFinite(ta)&&Number.isFinite(tb)) out.push({position:p*100,delta:ta-tb});
    }
    return out;
  },

  compatible(a,b){
    return !!a&&!!b&&a.detail?.simulator===b.detail?.simulator&&a.detail?.circuit===b.detail?.circuit&&a.detail?.car===b.detail?.car;
  },

  compare(lap,ref,miniCount=20){
    const compatible=this.compatible(lap,ref);
    if(!compatible) return {compatible:false,profile:[],sectors:[],minisectors:[],events:[]};
    return {
      compatible:true,
      profile:this.comparisonProfile(lap,ref),
      sectors:this.zones(lap,ref,3),
      minisectors:this.zones(lap,ref,miniCount),
      events:this.detectEvents(lap),
      referenceEvents:this.detectEvents(ref)
    };
  },

  detectEvents(lap){
    const s=lap?.samples||[];
    if(!s.length) return [];
    const events=[];
    let braking=false,start=null,peak=0,startSpeed=null;
    let recentlyLowThrottle=false,lastLowP=-1;

    for(let i=0;i<s.length;i++){
      const x=s[i],br=Number(x.brake)||0,th=Number(x.throttle)||0,sp=Number(x.speed);
      if(!braking&&br>=5){
        braking=true;start=x;peak=br;startSpeed=Number.isFinite(sp)?sp:null;
      }else if(braking){
        peak=Math.max(peak,br);
        if(br<=2){
          const end=x;
          if(start&&end._p-start._p>.0015){
            events.push({
              type:"brake",
              position:start._p,
              endPosition:end._p,
              speed:startSpeed,
              peak,
              duration:Number.isFinite(start._time)&&Number.isFinite(end._time)?end._time-start._time:null
            });
          }
          braking=false;start=null;peak=0;
        }
      }

      if(th<35){ recentlyLowThrottle=true;lastLowP=x._p; }
      if(recentlyLowThrottle&&th>=80&&br<5&&x._p-lastLowP<.08){
        const last=events[events.length-1];
        if(!last||last.type!=="throttle"||Math.abs(last.position-x._p)>.015){
          events.push({type:"throttle",position:x._p,speed:Number.isFinite(sp)?sp:null,throttle:th});
        }
        recentlyLowThrottle=false;
      }
      if(recentlyLowThrottle&&x._p-lastLowP>=.08) recentlyLowThrottle=false;
    }
    return events.sort((a,b)=>a.position-b.position);
  },

  nearestEvent(events,type,p){
    let best=null,d=Infinity;
    for(const e of events||[]){
      if(e.type!==type) continue;
      const x=Math.abs(e.position-p);
      if(x<d){d=x;best=e;}
    }
    return best;
  },

  cursorValues(lap,ref,pct){
    const p=this.clamp(pct);
    const keys=["speed","throttle","brake","rpm","gear","steer","gLat","gLong","fuel"];
    const a={},b={};
    for(const k of keys){
      a[k]=this.interpolate(lap,p,k);
      b[k]=ref?this.interpolate(ref,p,k):null;
    }
    const ta=this.timeAt(lap,p),tb=ref?this.timeAt(ref,p):null;
    return {p,ta,tb,delta:Number.isFinite(ta)&&Number.isFinite(tb)?ta-tb:null,a,b};
  }
};