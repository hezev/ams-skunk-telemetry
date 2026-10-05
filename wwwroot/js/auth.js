window.AMSAuth = {
  user:null,
  session:null,

  headers(token){
    const h={apikey:AMS_CONFIG.publishableKey,"Content-Type":"application/json"};
    if(token) h.Authorization="Bearer "+token;
    return h;
  },

  save(session){
    this.session=session;
    if(session) localStorage.setItem("ams_auth_session",JSON.stringify(session));
    else localStorage.removeItem("ams_auth_session");
  },

  async signup(email,password){
    const res=await fetch(AMS_CONFIG.supabaseUrl+"/auth/v1/signup",{
      method:"POST",
      headers:this.headers(),
      body:JSON.stringify({email,password})
    });
    const data=await res.json();
    if(!res.ok) throw new Error(data.msg||data.error_description||data.message||"Falha ao criar conta.");
    if(data.access_token){
      data.expires_at=Math.floor(Date.now()/1000)+(data.expires_in||3600);
      this.user=data.user||null;
      this.save(data);
      this.render();
      document.dispatchEvent(new CustomEvent("ams-auth-changed",{detail:{user:this.user}}));
    }
    return data;
  },

  async login(email,password){
    const res=await fetch(AMS_CONFIG.supabaseUrl+"/auth/v1/token?grant_type=password",{
      method:"POST",headers:this.headers(),body:JSON.stringify({email,password})
    });
    const data=await res.json();
    if(!res.ok) throw new Error(data.msg||data.error_description||data.message||"Falha no login.");
    data.expires_at=Math.floor(Date.now()/1000)+(data.expires_in||3600);
    this.user=data.user||null;
    this.save(data);
    this.render();
    document.dispatchEvent(new CustomEvent("ams-auth-changed",{detail:{user:this.user}}));
    return data;
  },

  async refresh(){
    if(!this.session?.refresh_token) throw new Error("Sessão expirada.");
    const res=await fetch(AMS_CONFIG.supabaseUrl+"/auth/v1/token?grant_type=refresh_token",{
      method:"POST",headers:this.headers(),body:JSON.stringify({refresh_token:this.session.refresh_token})
    });
    const data=await res.json();
    if(!res.ok) throw new Error(data.msg||data.error_description||data.message||"Sessão expirada.");
    data.expires_at=Math.floor(Date.now()/1000)+(data.expires_in||3600);
    this.user=data.user||this.user;
    this.save(data);
    return data;
  },

  async token(){
    if(!this.session?.access_token) return null;
    if(this.session.expires_at && this.session.expires_at<Date.now()/1000+60){
      try{ await this.refresh(); }catch{ this.logout(false); return null; }
    }
    return this.session?.access_token||null;
  },

  async restore(){
    try{ this.session=JSON.parse(localStorage.getItem("ams_auth_session")||"null"); }catch{ this.session=null; }
    if(!this.session?.access_token){ this.render(); return null; }
    const token=await this.token();
    if(!token){ this.render(); return null; }
    try{
      const res=await fetch(AMS_CONFIG.supabaseUrl+"/auth/v1/user",{headers:this.headers(token)});
      if(!res.ok) throw new Error();
      this.user=await res.json();
    }catch{
      this.logout(false);
      return null;
    }
    this.render();
    document.dispatchEvent(new CustomEvent("ams-auth-changed",{detail:{user:this.user}}));
    return this.user;
  },

  logout(notify=true){
    this.user=null; this.save(null); this.render();
    if(notify) document.dispatchEvent(new CustomEvent("ams-auth-changed",{detail:{user:null}}));
  },

  render(){
    const loginBtn=document.getElementById("loginBtn");
    const userBox=document.getElementById("pilotUser");
    const userName=document.getElementById("pilotUserName");
    if(this.user){
      if(loginBtn) loginBtn.hidden=true;
      if(userBox) userBox.hidden=false;
      if(userName) userName.textContent=this.user.user_metadata?.pilot_name||this.user.user_metadata?.display_name||this.user.email?.split("@")[0]||"Piloto";
    }else{
      if(loginBtn) loginBtn.hidden=false;
      if(userBox) userBox.hidden=true;
    }
  },

  init(){
    const modal=document.getElementById("loginModal");
    const form=document.getElementById("loginForm");
    const error=document.getElementById("loginError");

    document.getElementById("loginBtn")?.addEventListener("click",()=>{
      modal?.classList.add("open");
      document.getElementById("loginEmail")?.focus();
    });
    document.getElementById("loginClose")?.addEventListener("click",()=>modal?.classList.remove("open"));
    document.getElementById("logoutBtn")?.addEventListener("click",()=>this.logout());
    modal?.addEventListener("click",e=>{if(e.target===modal)modal.classList.remove("open")});

    document.getElementById("signupBtn")?.addEventListener("click",async()=>{
      if(error) error.textContent="";
      const email=document.getElementById("loginEmail").value.trim();
      const password=document.getElementById("loginPassword").value;
      if(!email || !password){
        if(error) error.textContent="Indica email e password para criar a conta.";
        return;
      }
      try{
        const data=await this.signup(email,password);
        if(data.access_token){
          modal?.classList.remove("open");
          form?.reset();
        }else if(error){
          error.textContent="Conta criada. Confirma o email e depois inicia sessão.";
        }
      }catch(err){
        if(error) error.textContent=err.message;
      }
    });

    form?.addEventListener("submit",async e=>{
      e.preventDefault();
      if(error) error.textContent="";
      const submit=form.querySelector('button[type="submit"]');
      try{
        if(submit){submit.disabled=true;submit.textContent="A entrar…";}
        await this.login(document.getElementById("loginEmail").value.trim(),document.getElementById("loginPassword").value);
        modal?.classList.remove("open"); form.reset();
      }catch(err){ if(error) error.textContent=err.message; }
      finally{ if(submit){submit.disabled=false;submit.textContent="Entrar";} }
    });

    this.restore();
  }
};
