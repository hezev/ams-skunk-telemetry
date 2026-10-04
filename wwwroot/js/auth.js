window.AMSAuth = {
  user: null,
  session: null,

  headers(token){
    const h = {
      "apikey": AMS_CONFIG.publishableKey,
      "Content-Type": "application/json"
    };
    if(token) h.Authorization = "Bearer " + token;
    return h;
  },

  async login(email, password){
    const res = await fetch(
      AMS_CONFIG.supabaseUrl + "/auth/v1/token?grant_type=password",
      {
        method: "POST",
        headers: this.headers(),
        body: JSON.stringify({ email, password })
      }
    );

    const data = await res.json();
    if(!res.ok) throw new Error(data.msg || data.error_description || data.message || "Falha no login.");

    this.session = data;
    this.user = data.user || null;
    localStorage.setItem("ams_auth_session", JSON.stringify(data));
    this.render();
    return data;
  },

  async restore(){
    let saved;
    try { saved = JSON.parse(localStorage.getItem("ams_auth_session") || "null"); }
    catch { saved = null; }

    if(!saved?.access_token){
      this.render();
      return null;
    }

    const res = await fetch(AMS_CONFIG.supabaseUrl + "/auth/v1/user", {
      headers: this.headers(saved.access_token)
    });

    if(!res.ok){
      localStorage.removeItem("ams_auth_session");
      this.render();
      return null;
    }

    this.session = saved;
    this.user = await res.json();
    this.render();
    return this.user;
  },

  logout(){
    this.user = null;
    this.session = null;
    localStorage.removeItem("ams_auth_session");
    this.render();
  },

  render(){
    const loginBtn = document.getElementById("loginBtn");
    const userBox = document.getElementById("pilotUser");
    const userName = document.getElementById("pilotUserName");

    if(this.user){
      if(loginBtn) loginBtn.hidden = true;
      if(userBox) userBox.hidden = false;
      if(userName) userName.textContent =
        this.user.user_metadata?.display_name ||
        this.user.user_metadata?.full_name ||
        this.user.email ||
        "Piloto";
    } else {
      if(loginBtn) loginBtn.hidden = false;
      if(userBox) userBox.hidden = true;
    }
  },

  init(){
    const modal = document.getElementById("loginModal");
    const form = document.getElementById("loginForm");
    const error = document.getElementById("loginError");

    document.getElementById("loginBtn")?.addEventListener("click", () => {
      modal?.classList.add("open");
      document.getElementById("loginEmail")?.focus();
    });

    document.getElementById("loginClose")?.addEventListener("click", () => {
      modal?.classList.remove("open");
    });

    document.getElementById("logoutBtn")?.addEventListener("click", () => this.logout());

    modal?.addEventListener("click", e => {
      if(e.target === modal) modal.classList.remove("open");
    });

    form?.addEventListener("submit", async e => {
      e.preventDefault();
      if(error) error.textContent = "";

      const submit = form.querySelector('button[type="submit"]');
      const email = document.getElementById("loginEmail").value.trim();
      const password = document.getElementById("loginPassword").value;

      try{
        if(submit){ submit.disabled = true; submit.textContent = "A entrar…"; }
        await this.login(email, password);
        modal?.classList.remove("open");
        form.reset();
      }catch(err){
        if(error) error.textContent = err.message;
      }finally{
        if(submit){ submit.disabled = false; submit.textContent = "Entrar"; }
      }
    });

    this.restore();
  }
};
