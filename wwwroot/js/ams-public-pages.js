(()=>{
  'use strict';
  const input=document.getElementById('ams-help-search');
  if(!input)return;
  const items=[...document.querySelectorAll('[data-faq]')];
  const normalize=text=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt');
  function filter(){
    const value=normalize(input.value.trim());let count=0;
    for(const item of items){item.hidden=!normalize(item.textContent).includes(value);if(!item.hidden)count++;}
    document.getElementById('ams-help-empty').hidden=count>0;
    document.getElementById('helpSearchCount').textContent=value?`${count} ${count===1?'resposta encontrada':'respostas encontradas'}`:'';
  }
  input.addEventListener('input',filter);
  document.querySelectorAll('[data-open-faq]').forEach(button=>button.addEventListener('click',()=>{
    input.value='';filter();const item=items.find(el=>el.dataset.faq===button.dataset.openFaq);
    if(item){item.open=true;item.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});item.querySelector('summary').focus({preventScroll:true});}
  }));
  const id=location.hash.slice(1);const linked=items.find(item=>item.dataset.faq===id);
  if(linked){linked.open=true;linked.scrollIntoView({block:'start'});}
})();
