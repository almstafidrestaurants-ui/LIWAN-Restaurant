(() => {
  'use strict';
  const sections = window.LIWAN_SECTIONS || [];
  const baseItems = sections.flatMap(section => section.items.map(item => ({...item, categoryId:section.id, categoryName:section.name, image:item.image || section.image})));
  let items = baseItems.slice();
  let customItems = [];
  const byId = new Map(items.map(item => [item.id, item]));
  let editingId = null;
  const sync = window.LIWAN_SYNC;
  const $ = id => document.getElementById(id);
  let cloudPrices = Object.create(null);
  let history = [];
  let loaded = false;
  let noticeTimer;
  const pending = new Set();
  function currentPrice(item) {
    if (item.isCustom) return item.price;
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
    $('editedItems').textContent=String(items.filter(i=>!i.isCustom && currentPrice(i)!==i.price).length);
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
      const row=document.createElement('article');row.className='product'+(!item.isCustom && currentPrice(item)!==item.price?' changed':'');
      const img=document.createElement('img');img.src=item.image;img.alt='';img.loading='lazy';
      const info=document.createElement('div');info.className='product-info';
      const name=document.createElement('strong');name.textContent=item.name;
      const original=document.createElement('small');original.textContent=item.categoryName+(item.isCustom?' · صنف أضافه المالك':' · السعر الأساسي: '+money(item.price));
      info.append(name,original);
      if(!item.isCustom && currentPrice(item)!==item.price){const chip=document.createElement('span');chip.className='modified';chip.textContent='سعر محدّث على المنيو';info.append(chip);}
      const wrapper=document.createElement('div');wrapper.className='price-box';
      const label=document.createElement('label');label.textContent='السعر الحالي';label.htmlFor='price-'+item.id;
      const input=document.createElement('input');input.id='price-'+item.id;input.type='number';input.min='0';input.max='10000';input.step='0.01';input.value=String(currentPrice(item));
      wrapper.append(label,input);
      const actions=document.createElement('div');actions.className='actions';
      const apply=document.createElement('button');apply.type='button';apply.className='save';apply.textContent='حفظ';
      const reset=document.createElement('button');reset.type='button';reset.className='restore';reset.textContent='الأصلي';reset.hidden=!!item.isCustom;
      function setBusy(isBusy){if(isBusy)pending.add(item.id);else pending.delete(item.id);apply.disabled=isBusy;reset.disabled=isBusy || item.isCustom || currentPrice(item)===item.price;input.disabled=isBusy;}
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
      const row=document.createElement('div');row.className='history-entry';
      const detail=document.createElement('div');const name=document.createElement('strong');name.textContent=entry.productName || byId.get(entry.productId)?.name || 'صنف محذوف';
      const change=document.createElement('small');change.textContent=money(entry.oldPrice)+' ← '+money(entry.newPrice);
      detail.append(name,change);
      const time=document.createElement('small');const at=entry.at;
      const date=at && typeof at.toDate==='function' ? at.toDate() : null;
      time.textContent=date && Number.isFinite(date.getTime())?date.toLocaleString('ar-LB'):'الآن';
      row.append(detail,time);target.append(row);
    }
  }
  function readItemForm(){return {
    sectionId:$('newItemSection').value,
    name:$('newItemName').value.trim(),
    price:$('newItemPrice').value.trim(),
    image:$('newItemImage').value.trim(),
    description:$('newItemDescription').value.trim()
  };}
  function resetItemForm(){
    editingId=null;$('addItemForm').reset();$('addTitle').textContent='إضافة صنف جديد';
    $('addItemButton').textContent='+ حفظ الصنف في القسم';$('cancelItemEdit').hidden=true;
  }
  function openEditItem(item){
    editingId=item.id;
    $('newItemSection').value=item.sectionId;
    $('newItemName').value=item.name;
    $('newItemPrice').value=String(item.price);
    $('newItemImage').value=item.image || '';
    $('newItemDescription').value=item.description || '';
    $('addTitle').textContent='تعديل الصنف: '+item.name;
    $('addItemButton').textContent='حفظ التعديل';
    $('cancelItemEdit').hidden=false;
    document.querySelector('[data-panel="add"]').click();
    $('addItemForm').scrollIntoView({behavior:'smooth',block:'start'});
  }
  function renderCustomItems(){
    const target=$('customItems');target.replaceChildren();
    $('customCount').textContent=customItems.length+' صنف';
    if(!customItems.length){const p=document.createElement('p');p.className='empty';p.textContent='لم تضف أصنافاً بعد.';target.append(p);return;}
    for(const item of customItems){
      const row=document.createElement('div');row.className='manage-item';
      const img=document.createElement('img');img.src=item.image || sections.find(s=>s.id===item.sectionId)?.image || '';img.alt='';img.loading='lazy';
      const info=document.createElement('div');info.className='manage-item-info';
      const name=document.createElement('strong');name.textContent=item.name;
      const meta=document.createElement('small');meta.textContent=(sections.find(s=>s.id===item.sectionId)?.name||'')+' · '+money(item.price);
      info.append(name,meta);
      const actions=document.createElement('div');actions.className='actions';
      const edit=document.createElement('button');edit.type='button';edit.className='restore';edit.textContent='تعديل';edit.addEventListener('click',()=>openEditItem(item));
      const remove=document.createElement('button');remove.type='button';remove.className='restore danger';remove.textContent='حذف';
      remove.addEventListener('click',async()=>{
        if(!window.confirm('هل تريد حذف «'+item.name+'» من منيو الزبائن؟'))return;
        edit.disabled=true;remove.disabled=true;
        try{await sync.deleteMenuItem(item.id);message('حُذف الصنف من Firebase ومنيو الزبائن.');if(editingId===item.id)resetItemForm();}
        catch(error){message('لم يتم الحذف: '+(error.message||error),true);edit.disabled=false;remove.disabled=false;}
      });
      actions.append(edit,remove);row.append(img,info,actions);target.append(row);
    }
  }
  $('addItemForm').addEventListener('submit',async event=>{
    event.preventDefault();
    const input=readItemForm(), raw=input.price, n=Number(raw);
    if(!/^\d+(?:\.\d{1,2})?$/.test(raw)||!Number.isFinite(n)||n>10000){message('أدخل سعراً صحيحاً بمنزلتين عشريتين كحد أقصى.',true);return;}
    const button=$('addItemButton');button.disabled=true;
    try{
      if(editingId)await sync.updateMenuItem(editingId,input);
      else await sync.addMenuItem(input);
      message(editingId?'تم تعديل الصنف في القسم المحدد.':'تمت إضافة الصنف في أول القسم المحدد لجميع الزبائن.');
      resetItemForm();
    }catch(error){message('تعذر حفظ الصنف: '+(error.message||error),true);}
    finally{button.disabled=false;}
  });
  $('cancelItemEdit').addEventListener('click',resetItemForm);
  for(const section of sections){
    for(const key of ['category','newItemSection']){
      const option=document.createElement('option');option.value=section.id;option.textContent=section.name;$(key).append(option);
    }
  }
  document.querySelectorAll('[data-panel]').forEach(button=>button.addEventListener('click',()=>{
    const panel=button.dataset.panel;
    $('pricesPanel').hidden=panel!=='prices';
    $('addPanel').hidden=panel!=='add';
    $('historyPanel').hidden=panel!=='history';
    document.querySelectorAll('[data-panel]').forEach(b=>b.classList.toggle('active',b===button));
    if(panel==='history')renderHistory();
  }));
  $('search').addEventListener('input',renderProducts);
  $('category').addEventListener('change',renderProducts);
  sync.listenMenuItems((added, fromCache)=>{
    if(fromCache)return;
    customItems=added;
    items=[...customItems.map(item=>({ ...item, categoryId:item.sectionId,
      categoryName:sections.find(s=>s.id===item.sectionId)?.name || '',
      image:item.image || sections.find(s=>s.id===item.sectionId)?.image || ''})),...baseItems];
    byId.clear();for(const item of items)byId.set(item.id,item);
    renderStats();renderProducts();renderCustomItems();
  },error=>message('تعذر تحميل الأصناف الجديدة: '+(error.message||error),true));
  sync.listenPrices((prices, fromCache)=>{
    // Prevent unverified offline cached snapshots from enabling writes.
    if (fromCache) {loaded=false;renderProducts();return;}
    cloudPrices=prices;loaded=true;renderStats();renderProducts();
  },error=>{loaded=false;renderProducts();message('تعذر تحميل الأسعار من Firebase: '+(error.message||error),true);});
  sync.listenHistory(entries=>{history=entries;renderHistory();},error=>{message('تعذر تحميل سجل التعديلات: '+(error.message||error),true);});
  renderStats();renderProducts();renderCustomItems();
})();
