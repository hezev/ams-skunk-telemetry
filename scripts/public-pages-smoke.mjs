import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve('wwwroot');
for(const name of ['index.html','portal.html','ajuda.html','privacidade.html']){
 const html=fs.readFileSync(path.join(root,name),'utf8');
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]);
 assert.equal(new Set(ids).size,ids.length,`${name}: duplicate IDs`);
 for(const [,reference] of html.matchAll(/\b(?:href|src)="([^"]+)"/g)){
  if(/^(https?:|mailto:|data:|\/\/)/.test(reference))continue;
  const [relative,fragment]=reference.split('#');
  const target=path.resolve(root,relative.split('?')[0]||name);
  assert.ok(target.startsWith(root+path.sep),`${name}: link outside web root`);
  assert.ok(fs.existsSync(target),`${name}: missing ${reference}`);
  if(fragment&&target.endsWith('.html'))assert.match(fs.readFileSync(target,'utf8'),new RegExp(`\\bid="${fragment}"`),`${name}: missing anchor ${reference}`);
 }
}
const landing=fs.readFileSync(path.join(root,'index.html'),'utf8');
const portal=fs.readFileSync(path.join(root,'portal.html'),'utf8');
assert.match(landing,/welcomeForm/);assert.doesNotMatch(landing,/js\/app\.js/);
assert.match(portal,/js\/app\.js/);assert.match(portal,/ams-context-help\.js/);
assert.match(landing,/4701744519821401123/);assert.match(landing,/iPhone · planeado/);
console.log('PASS: public entry point, unchanged portal entry, local assets and public navigation links.');
