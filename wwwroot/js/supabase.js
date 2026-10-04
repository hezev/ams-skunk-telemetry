window.AMSSupabase = {
  get url(){ return AMS_CONFIG.supabaseUrl; },
  get anonKey(){ return AMS_CONFIG.publishableKey; },
  enabled: true,

  async connect(){
    if(!this.url || !this.anonKey) return {mode:"mock",connected:false};
    return {mode:"supabase",connected:true};
  }
};
