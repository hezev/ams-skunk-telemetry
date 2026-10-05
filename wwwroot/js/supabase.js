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

  async getLiveSessions(token,pilotId=null){
    const params={
      select:"pilot_id,simulator,circuit,car,sample,updated_at",
      order:"updated_at.desc",
      limit:"100"
    };
    if(pilotId) params.pilot_id="eq."+pilotId;
    return this.request("/rest/v1/ams_live_sessions?"+new URLSearchParams(params),{token});
  },

  async getLaps(token,pilotId=null){
    const params={
      select:"id,pilot_id,local_lap_id,simulator,circuit,car,lap_time_ms,completed_at,lap_number,session_id,verified",
      order:"completed_at.desc",
      limit:"250"
    };
    if(pilotId) params.pilot_id="eq."+pilotId;
    return this.request("/rest/v1/ams_laps?"+new URLSearchParams(params),{token});
  },

  async getBestLaps(token,pilotId=null,shared=false){
    const params={
      select:"id,pilot_id,simulator,circuit,circuit_layout,car,lap_time_ms,completed_at,verified",
      order:"lap_time_ms.asc",
      limit:"150"
    };
    if(pilotId) params.pilot_id="eq."+pilotId;
    if(shared) params.shared="eq.true";
    return this.request("/rest/v1/ams_best_laps?"+new URLSearchParams(params),{token});
  },

  async getLapTelemetry(token,id){
    const q=new URLSearchParams({
      select:"id,pilot_id,simulator,circuit,car,lap_time_ms,lap_number,session_id,completed_at,telemetry",
      id:"eq."+id,
      limit:"1"
    });
    const rows=await this.request("/rest/v1/ams_laps?"+q,{token});
    return rows?.[0]||null;
  },

  fresh(row){
    return Boolean(row?.updated_at && Date.now()-Date.parse(row.updated_at)<=AMS_CONFIG.liveFreshnessMs);
  },

  samplePosition(sample){
    if(!sample || typeof sample!=="object") return null;

    // AMS Telemetry v5.12.17 stores replay position as 0..100 percent.
    const percentKeys=["position","trackPositionPct","track_position_pct"];
    for(const k of percentKeys){
      const v=Number(sample[k]);
      if(Number.isFinite(v)) return Math.max(0,Math.min(1,v/100));
    }

    // Native/normalized variants may already be 0..1.
    const normalizedKeys=["lapDistPct","LapDistPct","lap_dist_pct","trackPosition","track_position","lapPct","lap_pct"];
    for(const k of normalizedKeys){
      const v=Number(sample[k]);
      if(Number.isFinite(v)){
        if(v>1 && v<=100) return v/100;
        return Math.max(0,Math.min(1,v));
      }
    }
    return null;
  }
};
