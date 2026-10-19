/* Public entry point. Uses the same AMSAuth session as portal.html. */
(()=>{
  'use strict';
  const byId=id=>document.getElementById(id);
  const form=byId('welcomeForm');
  if(!form||!window.AMSAuth)return;
  let mode='login',busy=false,recovery=null;
  const email=byId('welcomeEmail'),password=byId('welcomePassword'),confirm=byId('welcomeConfirm');
  const status=byId('accessStatus'),submit=byId('accessSubmit');
  const messages={login:['Bem-vindo à equipa.','Entra na tua conta AMSports.','Entrar →'],signup:['Junta-te à equipa.','Cria a tua conta e confirma o email.','Criar conta →'],recover:['Recuperar acesso.','Enviaremos um link para redefinir a palavra-passe.','Enviar link →'],reset:['Nova palavra-passe.','Define uma nova palavra-passe para a conta recuperada.','Guardar palavra-passe →']};
  function report(message,error=false){status.textContent=message;status.dataset.error=String(error);}
  function setBusy(value){busy=value;form.querySelectorAll('button,input').forEach(el=>el.disabled=value);confirm.disabled=value||!['signup','reset'].includes(mode);byId('createAccount').disabled=value;byId('recoverAccount').disabled=value;byId('backToLogin').disabled=value;submit.textContent=value?'A processar…':messages[mode][2];}
  function setMode(value){
    if(busy)return;
    mode=value;const copy=messages[value];
    byId('accessTitle').textContent=copy[0];byId('accessDescription').textContent=copy[1];submit.textContent=copy[2];
    byId('emailField').hidden=mode==='reset';email.required=mode!=='reset';
    byId('passwordField').hidden=mode==='recover';password.required=mode!=='recover';password.autocomplete=mode==='login'?'current-password':'new-password';
    password.minLength=mode==='login'?1:8;
    byId('confirmField').hidden=!['signup','reset'].includes(mode);confirm.required=['signup','reset'].includes(mode);confirm.disabled=!confirm.required;confirm.minLength=8;
    byId('createAccount').hidden=mode!=='login';byId('recoverAccount').hidden=mode!=='login';byId('backToLogin').hidden=mode==='login';
    byId('existingSession').hidden=true;password.value=confirm.value='';password.type='password';byId('togglePassword').textContent='Mostrar';byId('togglePassword').setAttribute('aria-label','Mostrar palavra-passe');byId('togglePassword').setAttribute('aria-pressed','false');report('');
  }
  async function authRequest(path,options={}){
    const response=await fetch(AMS_CONFIG.supabaseUrl+'/auth/v1'+path,{...options,headers:{...AMSAuth.headers(options.token),...(options.headers||{})}});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.msg||data.error_description||data.message||'Não foi possível concluir o pedido. Tenta novamente.');
    return data;
  }
  byId('createAccount').addEventListener('click',()=>{setMode('signup');email.focus();});
  byId('recoverAccount').addEventListener('click',()=>{setMode('recover');email.focus();});
  byId('backToLogin').addEventListener('click',()=>{recovery=null;setMode('login');email.focus();});
  byId('togglePassword').addEventListener('click',()=>{const show=password.type==='password';password.type=show?'text':'password';byId('togglePassword').textContent=show?'Ocultar':'Mostrar';byId('togglePassword').setAttribute('aria-label',show?'Ocultar palavra-passe':'Mostrar palavra-passe');byId('togglePassword').setAttribute('aria-pressed',String(show));});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!form.reportValidity())return;
    if(['signup','reset'].includes(mode)&&password.value!==confirm.value){report('As palavras-passe não coincidem.',true);confirm.focus();return;}
    if(mode==='reset'&&!recovery){report('O link de recuperação já não está disponível. Pede um novo link.',true);return;}
    setBusy(true);report('');let success=null;
    try{
      if(mode==='login'){
        await AMSAuth.login(email.value.trim(),password.value);location.assign('portal.html');
      }else if(mode==='signup'){
        const result=await AMSAuth.signup(email.value.trim(),password.value);
        if(result.access_token)location.assign('portal.html');
        else{password.value=confirm.value='';report('Se a conta puder ser criada, receberás um email de confirmação. Depois, inicia sessão.');}
      }else if(mode==='recover'){
        // Same-origin root also receives Supabase's implicit recovery callback.
        const redirect=new URL('./',location.href).href;
        await authRequest('/recover?'+new URLSearchParams({redirect_to:redirect}),{method:'POST',body:JSON.stringify({email:email.value.trim()})});
        report('Se existir uma conta com este email, receberás um link de recuperação. Verifica também o spam.');
      }else{
        const current=recovery;
        if(current.expires_at<=Date.now()/1000)throw new Error('O link expirou. Volta ao login e pede um novo link.');
        await authRequest('/user',{method:'PUT',token:current.access_token,body:JSON.stringify({password:password.value})});
        // Do not leave a recovery session signed in or retain its tokens.
        await authRequest('/logout',{method:'POST',token:current.access_token}).catch(()=>{});
        recovery=null;AMSAuth.user=null;AMSAuth.save(null);AMSAuth.clearLoginCookie();
        password.value=confirm.value='';success='Palavra-passe atualizada. Inicia sessão com a nova palavra-passe.';
      }
    }catch(error){report(error.message||'Ligação indisponível. Tenta novamente.',true);}
    finally{setBusy(false);if(success){setMode('login');report(success);}}
  });
  async function boot(){
    const params=new URLSearchParams(location.hash.slice(1));
    const callback=params.has('access_token')||params.has('error')||params.has('error_description');
    if(callback){
      // Remove credentials before navigation, rendering errors, or loading the portal.
      history.replaceState(null,'',location.pathname+location.search);
      const error=params.get('error_description');
      if(error||params.has('error')){report('O link não é válido ou expirou. Pede um novo link de recuperação.',true);return;}
      const token=params.get('access_token'),type=params.get('type');
      if(!token||!['recovery','signup','invite','magiclink','email_change'].includes(type)){report('Link de autenticação não reconhecido. Inicia sessão ou pede um novo link.',true);return;}
      setBusy(true);
      try{
        const user=await authRequest('/user',{token});
        const ttl=Math.max(1,Math.min(86400,Number(params.get('expires_in'))||3600));
        const session={access_token:token,refresh_token:params.get('refresh_token')||'',token_type:'bearer',expires_at:Math.floor(Date.now()/1000)+ttl,user};
        setBusy(false);
        if(type==='recovery'){recovery=session;setMode('reset');email.value=user.email||'';password.focus();}
        else{AMSAuth.user=user;AMSAuth.save(session);location.replace('portal.html');}
      }catch{setBusy(false);report('Não foi possível validar o link. Pede um novo link ou tenta novamente com ligação à Internet.',true);}
      return;
    }
    setMode(new URLSearchParams(location.search).get('mode')==='recover'?'recover':'login');
    try{email.value=AMSAuth.loginHint()||'';}catch{/* Cookie access may be disabled. */}
    setBusy(true);
    try{const user=await AMSAuth.restore();if(user&&mode==='login'){byId('existingSession').hidden=false;report('Já tens sessão iniciada. Podes continuar para o portal.');}}
    finally{setBusy(false);AMSAuth.startPersistence();}
  }
  boot().catch(()=>{setBusy(false);report('Não foi possível restaurar a sessão. Podes iniciar sessão novamente.',true);});
})();
