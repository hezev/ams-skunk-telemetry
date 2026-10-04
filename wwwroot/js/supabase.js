window.AMSSupabase = {
  enabled:false,
  url:"",
  anonKey:"",
  configure({url,anonKey}){
    this.url=url||"";
    this.anonKey=anonKey||"";
    this.enabled=Boolean(this.url&&this.anonKey);
  },
  async connect(){
    if(!this.enabled) return {mode:"mock",connected:false};
    // Fase 2: inicializar @supabase/supabase-js aqui.
    return {mode:"supabase",connected:true};
  }
};
