/* Integration checks with isolated browser contexts and intercepted Auth responses.
   Requires Playwright + Edge; never sends credentials/email or mutates production. */
const {chromium}=require('playwright');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../wwwroot');
const user={id:'11111111-1111-4111-8111-111111111111',email:'fixture@example.invalid',user_metadata:{}};
const session={access_token:'fixture-access',refresh_token:'fixture-refresh',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,user};
const testPassword='Fixture-Only-Password42';
(async()=>{
 const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');const file=path.resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'application/octet-stream');res.end(fs.readFileSync(file));});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const output=process.env.AMS_PUBLIC_TEST_OUTPUT; if(output)fs.mkdirSync(output,{recursive:true});
 let cases=0;
 async function setup(handler=()=>null,seed=null,options={}){
  const context=await browser.newContext(options);const calls=[],errors=[];
  if(seed)await context.addInitScript(value=>localStorage.setItem('ams_auth_session',JSON.stringify(value)),seed);
  await context.route('**/*.supabase.co/**',async route=>{const request=route.request();calls.push({path:new URL(request.url()).pathname,method:request.method(),body:request.postDataJSON(),authorization:request.headers().authorization});let response=handler(request,calls)||null;if(!response){const p=new URL(request.url()).pathname;response={status:200,body:p.endsWith('/user')?user:p.endsWith('/token')?session:p.endsWith('/ams_is_coach')?false:[]};}await route.fulfill({status:response.status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(response.body)});});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  return {context,page,calls,errors};
 }
 async function ready(page,url='/'){await page.goto(base+url,{waitUntil:'domcontentloaded'});await page.locator('#accessSubmit').waitFor({state:'attached'});await page.waitForFunction(()=>!document.getElementById('accessSubmit').disabled);}
 async function fill(page){await page.locator('#welcomeEmail').fill(user.email);await page.locator('#welcomePassword').fill(testPassword);}
 async function finish(test){assert.deepEqual(test.errors,[]);await test.context.close();cases++;}
 try{
  let test=await setup();await ready(test.page);
  for(const width of [1440,390,320]){
   await test.page.setViewportSize({width,height:1100});
   for(const file of ['index.html','ajuda.html','privacidade.html']){
    await test.page.goto(base+'/'+file);const geometry=await test.page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(geometry.scroll<=geometry.width+1,`${file} at ${width}px overflows`);
    if(output&&width===1440)await test.page.screenshot({path:path.join(output,file.replace('.html','.png')),fullPage:true});
   }
  }
  assert.equal(test.calls.length,0,'Public pages must not require a cloud query');
  await test.page.goto(base+'/ajuda.html');await test.page.locator('#ams-help-search').fill('ligacao');assert.ok(await test.page.locator('[data-faq="connection"]').isVisible());
  await test.page.locator('#ams-help-search').fill('zzzz');assert.ok(await test.page.locator('#ams-help-empty').isVisible());
  await test.page.getByRole('button',{name:/Encontrar as minhas voltas/}).click();assert.equal(await test.page.locator('[data-faq="laps"]').getAttribute('open'),'');
  await finish(test);

  test=await setup();await ready(test.page);await fill(test.page);await test.page.locator('#accessSubmit').click();await test.page.waitForURL('**/portal.html');
  assert.ok(test.calls.some(call=>call.path.endsWith('/token')&&call.body.email===user.email));
  assert.ok(!await test.page.evaluate(value=>JSON.stringify(localStorage).includes(value),testPassword));
  await test.page.locator('#mainNav [data-view="live"]').hover();await test.page.locator('#amsContextTooltip').waitFor({state:'visible'});assert.match(await test.page.locator('#amsContextTooltip').textContent(),/replays|replay/i);
  await test.page.keyboard.press('Escape');assert.ok(await test.page.locator('#amsContextTooltip').isHidden());
  await test.page.locator('#mainNav [data-view="compare"]').click();
  const info=test.page.getByRole('button',{name:'Explicar Volta A',exact:true});
  await info.click();await test.page.locator('#amsContextTooltip').waitFor({state:'visible'});assert.match(await test.page.locator('#amsContextTooltip').textContent(),/volta que/);
  await test.page.locator('#amsContextTooltip').hover();await test.page.waitForTimeout(450);assert.ok(await test.page.locator('#amsContextTooltip').isVisible(),'Tooltip must be hoverable');
  if(output)await test.page.screenshot({path:path.join(output,'portal-tooltip.png')});
  await test.page.keyboard.press('Escape');
  await test.page.locator('#ams-language-select').selectOption('en');await test.page.locator('#mainNav [data-view="engineer"]').hover();await test.page.locator('#amsContextTooltip').waitFor({state:'visible'});assert.match(await test.page.locator('#amsContextTooltip').textContent(),/Analyses sessions/);
  await test.page.locator('#logoutBtn').click();assert.equal(await test.page.evaluate(()=>localStorage.getItem('ams_auth_session')),null);
  await finish(test);

  test=await setup(request=>new URL(request.url()).pathname.endsWith('/token')?{status:400,body:{msg:'Credenciais inválidas.'}}:null);
  await ready(test.page);await fill(test.page);await test.page.locator('#accessSubmit').click();await test.page.waitForFunction(()=>document.getElementById('accessStatus').dataset.error==='true');assert.match(await test.page.locator('#accessStatus').textContent(),/inválidas/);assert.ok(!test.page.url().includes('portal.html'));await finish(test);

  test=await setup(request=>new URL(request.url()).pathname.endsWith('/signup')?{status:200,body:{id:user.id}}:null);
  await ready(test.page);await test.page.locator('#createAccount').click();await fill(test.page);await test.page.locator('#welcomeConfirm').fill('Mismatch-Only');await test.page.locator('#accessSubmit').click();assert.match(await test.page.locator('#accessStatus').textContent(),/não coincidem/);assert.equal(test.calls.length,0);
  await test.page.locator('#welcomeConfirm').fill(testPassword);await test.page.locator('#accessSubmit').click();await test.page.waitForFunction(()=>document.getElementById('accessStatus').textContent.includes('confirmação'));assert.equal(test.calls.filter(c=>c.path.endsWith('/signup')).length,1);await finish(test);

  test=await setup(request=>new URL(request.url()).pathname.endsWith('/recover')?{status:200,body:{}}:null);
  await ready(test.page,'/?mode=recover');await test.page.locator('#welcomeEmail').fill(user.email);await test.page.locator('#accessSubmit').click();await test.page.waitForFunction(()=>document.getElementById('accessStatus').textContent.includes('Se existir'));
  const call=test.calls.find(c=>c.path.endsWith('/recover'));assert.ok(call);assert.equal(call.body.email,user.email);await finish(test);

  test=await setup();await ready(test.page,'/#access_token=fixture-recovery&refresh_token=fixture-recovery-refresh&type=recovery&expires_in=3600');
  assert.ok(!test.page.url().includes('access_token'));assert.equal(await test.page.evaluate(()=>localStorage.getItem('ams_auth_session')),null);
  await test.page.locator('#welcomePassword').fill(testPassword);await test.page.locator('#welcomeConfirm').fill(testPassword);await test.page.locator('#accessSubmit').click();await test.page.waitForFunction(()=>document.getElementById('accessStatus').textContent.includes('atualizada'));
  assert.ok(test.calls.some(c=>c.path.endsWith('/user')&&c.method==='PUT'&&c.authorization==='Bearer fixture-recovery'));
  assert.ok(test.calls.some(c=>c.path.endsWith('/logout')));assert.equal(await test.page.evaluate(()=>localStorage.getItem('ams_auth_session')),null);await finish(test);

  test=await setup(request=>new URL(request.url()).pathname.endsWith('/user')?{status:401,body:{message:'Expired'}}:null);
  await ready(test.page,'/#access_token=expired-fixture&type=recovery');assert.ok(!test.page.url().includes('access_token'));assert.match(await test.page.locator('#accessStatus').textContent(),/validar/);assert.equal(test.calls.filter(c=>c.method==='PUT').length,0);await finish(test);

  test=await setup(()=>null,session);await ready(test.page);
  assert.ok(await test.page.locator('#existingSession').isVisible());assert.match(await test.page.locator('#existingSession').textContent(),/Avançar para o Portal de Telemetria/);
  for(const selector of ['#welcomeForm','#welcomeEmail','#welcomePassword','#createAccount','#recoverAccount','#accessPrivacy'])assert.ok(await test.page.locator(selector).isHidden(),selector);
  assert.equal(await test.page.locator('#acesso button:visible,#acesso a:visible').count(),1);
  if(output)await test.page.screenshot({path:path.join(output,'existing-session.png'),fullPage:true});
  await test.page.evaluate(()=>{localStorage.removeItem('ams_auth_session');dispatchEvent(new StorageEvent('storage',{key:'ams_auth_session'}));});
  await test.page.locator('#welcomeForm').waitFor({state:'visible'});assert.ok(await test.page.locator('#existingSession').isHidden());await finish(test);
  test=await setup(request=>new URL(request.url()).pathname.endsWith('/user')?{status:401,body:{message:'Expired'}}:null,session);await ready(test.page);
  assert.ok(await test.page.locator('#welcomeForm').isVisible());assert.ok(await test.page.locator('#existingSession').isHidden());await finish(test);
  test=await setup(()=>null,session,{viewport:{width:390,height:844},hasTouch:true,isMobile:true});await test.page.goto(base+'/portal.html');
  await test.page.locator('#mainNav [data-view="compare"]').click();
  await test.page.getByRole('button',{name:'Explicar Volta A',exact:true}).tap();await test.page.locator('#amsContextTooltip').waitFor({state:'visible'});
  const mobileTip=await test.page.locator('#amsContextTooltip').boundingBox();
  if(output)await test.page.screenshot({path:path.join(output,'portal-mobile-tooltip.png')});
  assert.ok(mobileTip.x>=0&&mobileTip.x+mobileTip.width<=390&&mobileTip.y>=0&&mobileTip.y+mobileTip.height<=844,JSON.stringify({tip:mobileTip,viewport:await test.page.evaluate(()=>({width:innerWidth,height:innerHeight,visualWidth:visualViewport?.width,scale:visualViewport?.scale}))}));await finish(test);
  const nojs=await browser.newContext({javaScriptEnabled:false});const page=await nojs.newPage();await page.goto(base+'/ajuda.html');assert.ok(await page.getByRole('heading',{name:/Pronto para/}).isVisible());await page.goto(base+'/privacidade.html');assert.ok(await page.getByRole('link',{name:'info@algarvemsports.pt',exact:true}).first().isVisible());await nojs.close();cases++;
  console.log(`PASS: ${cases} browser scenarios, mobile layout, Auth fixtures, recovery, contextual help, portal isolation and public pages without JavaScript.`);
 }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;});
