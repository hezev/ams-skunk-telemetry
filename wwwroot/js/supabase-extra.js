Object.assign(window.AMSSupabase,{
  async getPilots(token){
    const q=new URLSearchParams({select:"id,pilot_name,team,created_at",order:"pilot_name.asc",limit:"500"});
    return this.request("/rest/v1/ams_pilots?"+q,{token});
  },
  async isCoach(token,userId){
    try{
      const q=new URLSearchParams({select:"user_id",user_id:"eq."+userId,limit:"1"});
      const rows=await this.request("/rest/v1/ams_coaches?"+q,{token});
      return Array.isArray(rows)&&rows.length>0;
    }catch{return false;}
  }
});