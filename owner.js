(() => {
  'use strict';
  const sections = window.LIWAN_SECTIONS || [];
  const items = sections.flatMap(section => section.items.map(item => ({...item, categoryId:section.id, categoryName:section.name, image:item.image || section.image})));
  const byId = new Map(items.map(item => [item.id,item]));
  const KEY = 'liwan-owner-demo-prices-v1';
  const $ = id => document.getElementById(id);
  function initial(){return {prices:{},history:[]};}
  function load(){
    try {
      const v=JSON.parse(localStorage.getItem(KEY)||'null');
      if(!v||typeof v!=='object'||Array.isArray(v))return initial();
      return {
        prices: v.prices && typeof v.prices==='object' && !Array.isArray(v.prices) ? v.prices : {},
        history: Array.isArray(v.history) ? v.history.slice(0,80) : []
      };
    } catch (_) {return initial();}
  }
  let state=load();
  let noticeTimer;
  function saveState(){try {localStorage.setItem(KEY,JSON.stringify(state));return true;}catch (_){return false;}}
  function currentPrice(item){
    const value=Object.prototype.hasOwnProperty.call(state.prices,item.id)?state.prices[item.id]:null;
    return typeof value==='number' && Number.isFinite(value) && value>=0 && value<=10000 ? value : item.price;
  }
  function money(num){return '$'+Number(num).toFixed(2).replace(/\.00$/,'');}
  function message(text,bad=false){
    const box=$('notice');box.textContent=text;box.classList.toggle('error',bad);box.hidden=false;
    clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{box.hidden=true;},4800);
  }
  function record(item,oldPrice,newPrice){
    if(oldPrice===newPrice)return;
    state.history.unshift({id:item.id,name:item.name,old:oldPrice,new:newPrice,at:new Date().toISOString()});
    state.history=state.history.slice(0,80);
  }
  function renderStats(){
    $('totalItems').textContent=String(items.length);
    $('editedItems').textContent=String(items.filter(i=>currentPrice(i)!==i.price).length);
  }
  function renderProducts(){
    const target=$('products');target.replaceChildren();
    const search=$('search').value.trim().toLocaleLowerCase('ar');
    const category=$('category').value;
    const filtered=items.filter(i=>(!category || i.categoryId===category) && (!search || i.name.toLocaleLowerCase('ar').includes(search)));
    $('filteredCount').textContent=filtered.length+' صنف';
    if(!filtered.length){const p=document.createElement('p');p.className='empty';p.textContent='لا توجد أصناف مطابقة.';target.append(p);return;}
    for(const item of filtered){
      const row=document.createElement('article');row.className='product'+(currentPrice(item)!==item.price?' changed':'');
      const img=document.createElement('img');img.src=item.image;img.alt='';img.loading='lazy';
      const info=document.createElement('div');info.className='product-info';
      const name=document.createElement('strong');name.textContent=item.name;
      const original=document.createElement('small');original.textContent=item.categoryName+' · السعر الأصلي: '+money(item.price);
      info.append(name,original);
      if(currentPrice(item)!==item.price){const chip=document.createElement('span');chip.className='modified';chip.textContent='سعر معدّل تجريبياً';info.append(chip);}
      const wrapper=document.createElement('div');wrapper.className='price-box';
      const label=document.createElement('label');label.textContent='السعر الحالي';label.htmlFor='price-'+item.id;
      const input=document.createElement('input');input.id='price-'+item.id;input.type='number';input.min='0';input.max='10000';input.step='0.01';input.value=String(currentPrice(item));
      wrapper.append(label,input);
      const actions=document.createElement('div');actions.className='actions';
      const apply=document.createElement('button');apply.type='button';apply.className='save';apply.textContent='حفظ';
      apply.addEventListener('click',()=>{
        const raw=input.value.trim();const next=Number(raw);
        if(!/^\d+(?:\.\d{1,2})?$/.test(raw)||!Number.isFinite(next)||next>10000){message('أدخل سعراً صحيحاً بين 0 و10000، بمنزلتين عشريتين كحد أقصى.',true);return;}
        const old=currentPrice(item);
        if(next===item.price)delete state.prices[item.id];else state.prices[item.id]=next;
        record(item,old,next);
        const persisted=saveState();renderStats();renderProducts();
        message(persisted?'تم حفظ السعر تجريبياً. افتح منيو الزبون في نفس المتصفح لمشاهدته.':'تعذّر حفظ السعر في المتصفح. التغييرات مؤقتة.',!persisted);
      });
      const reset=document.createElement('button');reset.type='button';reset.className='restore';reset.textContent='الأصلي';reset.disabled=currentPrice(item)===item.price;
      reset.addEventListener('click',()=>{
        record(item,currentPrice(item),item.price);delete state.prices[item.id];
        const persisted=saveState();renderStats();renderProducts();message(persisted?'تمت استعادة السعر الأصلي.':'تعذّر تخزين التغيير.',!persisted);
      });
      actions.append(apply,reset);row.append(img,info,wrapper,actions);target.append(row);
    }
  }
  function renderHistory(){
    const target=$('history');target.replaceChildren();
    if(!state.history.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='لا توجد تعديلات بعد.';target.append(empty);return;}
    for(const entry of state.history){
      if(!byId.has(entry.id))continue;
      const row=document.createElement('div');row.className='history-entry';
      const detail=document.createElement('div');const name=document.createElement('strong');name.textContent=entry.name;
      const change=document.createElement('small');change.textContent=money(entry.old)+' ← '+money(entry.new);
      detail.append(name,change);
      const time=document.createElement('small');const date=new Date(entry.at);time.textContent=Number.isFinite(date.getTime())?date.toLocaleString('ar-LB'):'غير محدد';
      row.append(detail,time);target.append(row);
    }
  }
  for(const section of sections){const option=document.createElement('option');option.value=section.id;option.textContent=section.name;$('category').append(option);}
  document.querySelectorAll('[data-panel]').forEach(button=>button.addEventListener('click',()=>{
    const showHistory=button.dataset.panel==='history';
    $('pricesPanel').hidden=showHistory;$('historyPanel').hidden=!showHistory;
    document.querySelectorAll('[data-panel]').forEach(b=>b.classList.toggle('active',b===button));
    if(showHistory)renderHistory();
  }));
  $('search').addEventListener('input',renderProducts);
  $('category').addEventListener('change',renderProducts);
  window.addEventListener('storage',event=>{if(event.key===KEY){state=load();renderStats();renderProducts();renderHistory();}});
  renderStats();renderProducts();
})();
