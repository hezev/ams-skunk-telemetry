window.AMSSupabase = {
  get url(){ return AMS_CONFIG.supabaseUrl; },
  get anonKey(){ return AMS_CONFIG.publishableKey; },

  headers(token){
    const h = { apikey:this.anonKey, Accept:"application/json" };
    if(token) h.Authorization = "Bearer " + token;
    return h;
  },

  async request(path,{token,method="GET",body}={}){
    const headers=this.headers(token);
    if(body!==undefined) headers["Content-Type"]="application/json";
    const res=await fetch(this.url+path,{
      method,headers,
      body:body===undefined?undefined:JSON.stringify(body),
      cache:"no-store"
    });
    if(!res.ok){
      const data=await res.json().catch(()=>({}));
      throw new Error(data.message||data.msg||data.error_description||data.error||("HTTP "+res.status));
    }
    if(res.status===204) return null;
    const text=await res.text();
    return text?JSON.parse(text):null;
  },

  async getLiveSessions(token){
    const q=new URLSearchParams({
      select:"pilot_id,simulator,circuit,car,sample,updated_at",
      order:"updated_at.desc",
      limit:"100"
    });
    return this.request("/rest/v1/ams_live_sessions?"+q,{token});
  },

  async getBestLaps(token,pilotId=null,shared=false){
    const params={
      select:"id,pilot_id,simulator,circuit,circuit_layout,car,lap_time_ms,completed_at,verified,shared,telemetry",
      order:"lap_time_ms.asc",
      limit:"150"
    };
    if(pilotId) params.pilot_id="eq."+pilotId;
    if(shared) params.shared="eq.true";
    return this.request("/rest/v1/ams_best_laps?"+new URLSearchParams(params),{token});
  },

  fresh(row){
    return Boolean(row?.updated_at && Date.now()-Date.parse(row.updated_at)<=AMS_CONFIG.liveFreshnessMs);
  },

  samplePosition(sample){
    if(!sample || typeof sample!=="object") return null;
    const keys=["lapDistPct","LapDistPct","lap_dist_pct","trackPosition","track_position","lapPct","lap_pct"];
    for(const k of keys){
      const v=Number(sample[k]);
      if(Number.isFinite(v)){
        if(v>1 && v<=100) return v/100;
        return ((v%1)+1)%1;
      }
    }
    return null;
  }
};
