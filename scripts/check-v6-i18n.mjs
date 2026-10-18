import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const source=readFileSync('desktop/ui/ams-v6-desktop.js','utf8');
const match=source.match(/const v6English = Object\.freeze\((\{[^\n]+\})\);/);
assert(match,'No desktop translation catalog found');
const translations=JSON.parse(match[1]);
const essential=[
 'DEFINIÇÕES','Definições e ligações · Mobile, conta, unidades, OBS, privacidade e atualizações.',
 'Diagnóstico','Conta AMS','Unidades','Vídeo / OBS','Privacidade','Atualizações',
 'EMPARELHAMENTO AMSPORTS MOBILE','SERVIÇO','Ativo','Desativado',
 'Desativar mobile','Ativar mobile','Gerar novo PIN','Atualizar',
 'DIAGNÓSTICO DE LIGAÇÕES','Verificar novamente','CONTA AMS E CLOUD',
 'UNIDADES E FORMATAÇÃO','Testar ligação OBS','VERSÃO E ATUALIZAÇÕES',
 'Pilotos e permissões','Equipa','Resumo do arquivo','A carregar voltas...'
];
for(const key of essential){
 assert.equal(typeof translations[key],'string','Missing English translation: '+key);
 assert(translations[key].length>0,'Empty English translation: '+key);
}
assert(Object.keys(translations).length>=100,'Missing recent desktop translation coverage');
assert(source.includes('document.addEventListener("ams:languagechange"'),'Missing language-change handling');
assert(source.includes('translateTeamCards()'),'Missing live Team translation refresh');
assert(source.includes('if(view.classList.contains("active"))render()'),'Settings tab must rerender when language switches');
console.log('Validated '+Object.keys(translations).length+' PT/EN desktop labels and dynamic language updates.');
