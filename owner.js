(() => {
  'use strict';
  const sections = window.LIWAN_SECTIONS || [];
  const items = sections.flatMap(section => section.items.map(item => ({...item, categoryId:section.id, categoryName:section.name, image:item.image || section.image})));
  const byId = new Map(items.map(item => [item.id, item]));
  const sync = window.LIWAN_SYNC;
  const $ = id => document.getElementById(id);
  let cloudPrices = Object.create(null);
  let history = [];
  let loaded = false;
  let noticeTimer;
  const pending = new Set();
  function currentPrice(item) {
    const v = cloudPrices[item.id];
    return typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 10000 ? v : item.price;
  }
  function money(num){return '$'+Number(num).toFixed(2).replace(/\.00$/,'');}
  function message(text,bad=false){
    const box=$('notice'); box.textContent=text;box.classList.toggle('error',bad);box.hidden=false;
    clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>{box.hidden=true;},7000);
  }
  function renderStats(){
    $('totalItems').textContent=String(items.length);
    $('editedItems').textContent=String(items.filter(i=>currentPrice(i)!==i.price).length);
  }
  function renderProducts(){
    const target=$('products'); target.replaceChildren();
    const search=$('search').value.trim().toLocaleLowerCase('ar');
    const category=$('category').value;
    const filtered=items.filter(i=>(!category || i.categoryId===category) && (!search || i.name.toLocaleLowerCase('ar').includes(search)));
    $('filteredCount').textContent=filtered.length+' صنف';
    if(!loaded){const p=document.createElement('p');p.className='empty';p.textContent='جارِ تحميل الأسعار من الخادم...';target.append(p);return;}
    if(!filtered.length){const p=document.createElement('p');p.className='empty';p.textContent='لا توجد أصناف مطابقة.';target.append(p);return;}
    for(const item of filtered){
      const row=document.createElement('article');row.className='product'+(currentPrice(item)!==item.price?' changed':'');
      const img=document.createElement('img');img.src=item.image;img.alt='';img.loading='lazy';
      const info=document.createElement('div');info.className='product-info';
      const name=document.createElement('strong');name.textContent=item.name;
      const original=document.createElement('small');original.textContent=item.categoryName+' · السعر الأساسي: '+money(item.price);
      info.append(name,original);
      if(currentPrice(item)!==item.price){const chip=document.createElement('span');chip.className='modified';chip.textContent='سعر محدّث على المنيو';info.append(chip);}
      const wrapper=document.createElement('div');wrapper.className='price-box';
      const label=document.createElement('label');label.textContent='السعر الحالي';label.htmlFor='price-'+item.id;
      const input=document.createElement('input');input.id='price-'+item.id;input.type='number';input.min='0';input.max='10000';input.step='0.01';input.value=String(currentPrice(item));
      wrapper.append(label,input);
      const actions=document.createElement('div');actions.className='actions';
      const apply=document.createElement('button');apply.type='button';apply.className='save';apply.textContent='حفظ';
      const reset=document.createElement('button');reset.type='button';reset.className='restore';reset.textContent='الأصلي';
      function setBusy(isBusy){if(isBusy)pending.add(item.id);else pending.delete(item.id);apply.disabled=isBusy;reset.disabled=isBusy || currentPrice(item)===item.price;input.disabled=isBusy;}
      setBusy(pending.has(item.id));
      apply.addEventListener('click',async()=>{
        const raw=input.value.trim();const next=Number(raw);
        if(!/^\d+(?:\.\d{1,2})?$/.test(raw)||!Number.isFinite(next)||next>10000){message('أدخل سعراً صحيحاً بين 0 و10000، بمنزلتين عشريتين كحد أقصى.',true);return;}
        const old=currentPrice(item);
        if (next===old){message('هذا هو السعر الحالي بالفعل.');return;}
        setBusy(true);
        try {await sync.savePrice(item,old,next); message('تم حفظ السعر على الخادم. سيظهر للزبائن تلقائياً.');}
        catch(err){message('لم يتم حفظ السعر: '+(err.message||'تعذّر الاتصال بالخادم'),true);}
        finally {setBusy(false); renderProducts();}
      });
      reset.addEventListener('click',async()=>{
        const old=currentPrice(item);if(old===item.price)return;
        setBusy(true);
        try {await sync.savePrice(item,old,item.price);message('تمت استعادة السعر الأساسي على الخادم.');}
        catch(err){message('لم تنجح الاستعادة: '+(err.message||'فشل الاتصال'),true);}
        finally{setBusy(false);renderProducts();}
      });
      actions.append(apply,reset);row.append(img,info,wrapper,actions);target.append(row);
    }
  }
  function renderHistory(){
    const target=$('history');target.replaceChildren();
    if(!history.length){const empty=document.createElement('div');empty.className='empty';empty.textContent='لا توجد تعديلات محفوظة بعد.';target.append(empty);return;}
    for(const entry of history){
      if(!byId.has(entry.productId))continue;
      const row=document.createElement('div');row.className='history-entry';
      const detail=document.createElement('div');const name=document.createElement('strong');name.textContent=entry.productName || byId.get(entry.productId).name;
      const change=document.createElement('small');change.textContent=money(entry.oldPrice)+' ← '+money(entry.newPrice);
      detail.append(name,change);
      const time=document.createElement('small');const at=entry.at;
      const date=at && typeof at.toDate==='function' ? at.toDate() : null;
      time.textContent=date && Number.isFinite(date.getTime())?date.toLocaleString('ar-LB'):'الآن';
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
  sync.listenPrices((prices, fromCache)=>{
    // Prevent unverified offline cached snapshots from enabling writes.
    if (fromCache) {loaded=false;renderProducts();return;}
    cloudPrices=prices;loaded=true;renderStats();renderProducts();
  },error=>{loaded=false;renderProducts();message('تعذر تحميل الأسعار من Firebase: '+(error.message||error),true);});
  sync.listenHistory(entries=>{history=entries;renderHistory();},error=>{message('تعذر تحميل سجل التعديلات: '+(error.message||error),true);});
  renderStats();renderProducts();
})();
