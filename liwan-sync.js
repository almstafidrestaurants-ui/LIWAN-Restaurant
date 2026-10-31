/* LIWAN shared prices (Firebase Spark): public reads, UID-protected owner writes. */
(() => {
  'use strict';
  const config = window.LIWAN_FIREBASE_CONFIG || {};
  const ready = ['apiKey', 'authDomain', 'projectId', 'appId'].every(k =>
    typeof config[k] === 'string' && !!config[k].trim());
  let app, db, auth;
  let error = '';
  if (ready) {
    try {
      if (!window.firebase || typeof firebase.initializeApp !== 'function')
        throw new Error('تعذّر تحميل Firebase SDK');
      app = firebase.apps.length ? firebase.app() : firebase.initializeApp({
        apiKey: config.apiKey,
        authDomain: config.authDomain,
        projectId: config.projectId,
        storageBucket: config.storageBucket,
        messagingSenderId: config.messagingSenderId,
        appId: config.appId
      });
      db = app.firestore();
      auth = app.auth();
    } catch (err) { error = String(err?.message || err); }
  } else {
    error = 'إعدادات Firebase غير مكتملة في firebase-config.js';
  }
  const ownerEmail = typeof config.ownerEmail === 'string' ? config.ownerEmail.trim() : '';
  const ownerUid = typeof config.ownerUid === 'string' ? config.ownerUid.trim() : '';
  const ownerReady = !!ownerEmail && !!ownerUid && !/^(OWNER_|YOUR_|ضع)/i.test(ownerUid);
  const validPrice = n => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 10000;
  function listenPrices(onPrices, onError) {
    if (!db) { onError?.(new Error(error)); return () => {}; }
    return db.collection('menuPrices').onSnapshot(snapshot => {
      const prices = Object.create(null);
      snapshot.forEach(doc => {
        const v = doc.data()?.price;
        if (validPrice(v)) prices[doc.id] = v;
      });
      onPrices(prices, !!snapshot.metadata.fromCache);
    }, err => { onError?.(err); });
  }
  function listenHistory(onHistory, onError) {
    if (!db) { onError?.(new Error(error)); return () => {}; }
    return db.collection('priceHistory').orderBy('at', 'desc').limit(80).onSnapshot(
      snapshot => onHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))),
      err => { onError?.(err); }
    );
  }
  const validName = name => typeof name === 'string' && name.trim().length > 0 && name.trim().length <= 120;
  const validImage = image => typeof image === 'string' && image.length <= 400 &&
    (!image || /^https:\/\/[^\s]+$/.test(image) || /^images\/[a-zA-Z0-9_./%()\- ]+$/.test(image));
  const sectionIds = new Set((window.LIWAN_SECTIONS || []).map(section => section.id));
  const baseItemIds = new Set((window.LIWAN_SECTIONS || []).flatMap(section => section.items.map(item => item.id)));
  const photoIdValid = id => baseItemIds.has(id) || /^new-[A-Za-z0-9]{20}$/.test(id);
  const photoDataValid = data => typeof data === 'string' && data.length <= 120000 &&
    /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data);
  function listenMenuOverrides(onItems, onError) {
    if (!db) { onError?.(new Error(error)); return () => {}; }
    return db.collection('menuOverrides').onSnapshot(snapshot => {
      const entries = Object.create(null);
      snapshot.forEach(doc => {
        const d = doc.data();
        if (baseItemIds.has(doc.id) && validName(d.name) && validImage(d.image) &&
            typeof d.description === 'string' && d.description.length <= 250)
          entries[doc.id] = {name:d.name, image:d.image, description:d.description};
      });
      onItems(entries, !!snapshot.metadata.fromCache);
    }, err => onError?.(err));
  }
  function listenMenuPhotos(onPhotos, onError) {
    if (!db) { onError?.(new Error(error)); return () => {}; }
    return db.collection('menuPhotos').onSnapshot(snapshot => {
      const entries = Object.create(null);
      snapshot.forEach(doc => {
        const photo = doc.data()?.data;
        if (photoIdValid(doc.id) && photoDataValid(photo)) entries[doc.id] = photo;
      });
      onPhotos(entries, !!snapshot.metadata.fromCache);
    }, err => onError?.(err));
  }
  function photoBatch(batch, id, photoData, clearPhoto, uid) {
    if (!photoIdValid(id)) throw new Error('معرّف الصورة غير صحيح.');
    if (photoData) {
      if (!photoDataValid(photoData)) throw new Error('حجم الصورة كبير جداً. اختر صورة أصغر.');
      batch.set(db.collection('menuPhotos').doc(id), {data:photoData,
        updatedAt:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:uid});
    } else if (clearPhoto) batch.delete(db.collection('menuPhotos').doc(id));
  }

  function listenMenuItems(onItems, onError) {
    if (!db) { onError?.(new Error(error)); return () => {}; }
    return db.collection('menuItems').onSnapshot(snapshot => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isCustom: true }))
        .filter(item => item.id.startsWith('new-') && validName(item.name) &&
          validPrice(item.price) && sectionIds.has(item.sectionId) && validImage(item.image || ''));
      const sortTime = item => item.createdAt?.toMillis?.() ??
        ((item.createdAt?.seconds || 0) * 1000 + (item.createdAt?.nanoseconds || 0) / 1000000);
      items.sort((a,b) => sortTime(b) - sortTime(a) || b.id.localeCompare(a.id));
      onItems(items, !!snapshot.metadata.fromCache);
    }, error => onError?.(error));
  }
  function validateItem(form) {
    const name = typeof form.name === 'string' ? form.name.trim() : '';
    const sectionId = form.sectionId;
    const price = Number(form.price);
    const image = typeof form.image === 'string' ? form.image.trim() : '';
    const description = typeof form.description === 'string' ? form.description.trim() : '';
    if (!sectionIds.has(sectionId)) throw new Error('اختر قسماً صحيحاً.');
    if (!validName(name)) throw new Error('اسم الصنف مطلوب ولا يزيد عن 120 حرفاً.');
    if (!validPrice(price)) throw new Error('أدخل سعراً بين 0 و10000.');
    if (!validImage(image)) throw new Error('استخدم رابط صورة HTTPS أو مسارًا يبدأ بـ images/ فقط.');
    if (description.length > 250) throw new Error('الوصف طويل جداً.');
    return { name, sectionId, price, image, description };
  }
  async function requireOwner() {
    if (!db || !auth || !await isOwner(auth.currentUser))
      throw new Error('يجب تسجيل دخول المالك أولاً.');
    return auth.currentUser.uid;
  }
  async function addMenuItem(form) {
    const uid = await requireOwner();
    const item = validateItem(form);
    const ref = db.collection('menuItems').doc();
    const target = db.collection('menuItems').doc('new-' + ref.id);
    const batch = db.batch();
    batch.set(target, { ...item, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: uid, updatedBy: uid });
    photoBatch(batch, target.id, form.photoData || '', false, uid);
    await batch.commit();
    return target.id;
  }
  async function updateMenuItem(id, form) {
    const uid = await requireOwner();
    if (!/^new-[A-Za-z0-9]{20}$/.test(id)) throw new Error('هذا الصنف ليس من إضافات المالك.');
    const batch = db.batch();
    batch.update(db.collection('menuItems').doc(id), { ...validateItem(form),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: uid });
    photoBatch(batch, id, form.photoData || '', !!form.clearPhoto, uid);
    await batch.commit();
  }
  async function saveBaseItem(base, form, oldPrice) {
    const uid = await requireOwner();
    if (!baseItemIds.has(base.id)) throw new Error('الصنف الأصلي غير معروف.');
    if (form.sectionId !== base.categoryId) throw new Error('لا يمكن نقل صنف أصلي لقسم آخر.');
    const name = typeof form.name === 'string' ? form.name.trim() : '';
    const description = typeof form.description === 'string' ? form.description.trim() : '';
    const image = typeof form.image === 'string' && form.image.trim()
      ? form.image.trim() : base.image;
    const price = Number(form.price);
    if (!validName(name) || description.length > 250 || !validImage(image) || !validPrice(price))
      throw new Error('تحقق من اسم الصنف أو السعر أو الصورة.');
    const batch = db.batch();
    const ref = db.collection('menuOverrides').doc(base.id);
    if (name === base.name && image === base.image && description === (base.description || ''))
      batch.delete(ref);
    else batch.set(ref, {name, image, description,
      updatedAt:firebase.firestore.FieldValue.serverTimestamp(), updatedBy:uid});
    photoBatch(batch, base.id, form.photoData || '', !!form.clearPhoto, uid);
    if (price !== oldPrice) {
      const pRef = db.collection('menuPrices').doc(base.id);
      if (price === base.price) batch.delete(pRef);
      else batch.set(pRef, {price, updatedAt:firebase.firestore.FieldValue.serverTimestamp(), updatedBy:uid});
      batch.set(db.collection('priceHistory').doc(), {productId:base.id, productName:name,
        oldPrice,newPrice:price,at:firebase.firestore.FieldValue.serverTimestamp(),updatedBy:uid});
    }
    await batch.commit();
  }
  async function deleteMenuItem(id) {
    const uid = await requireOwner();
    if (!/^new-[A-Za-z0-9]{20}$/.test(id)) throw new Error('لا يمكن حذف صنف من المنيو الأصلي هنا.');
    const batch = db.batch();
    batch.delete(db.collection('menuItems').doc(id));
    batch.delete(db.collection('menuPhotos').doc(id));
    await batch.commit();
  }
  async function isOwner(user) {
    // A UI-only check; authorization is ultimately enforced by firestore.rules.
    return !!user && ownerReady && user.uid === ownerUid &&
      typeof user.email === 'string' && user.email.toLowerCase() === ownerEmail.toLowerCase();
  }
  async function loginWithPassword(password) {
    if (!auth) throw new Error(error || 'Firebase غير جاهز');
    if (!ownerReady) throw new Error('أكمل ownerEmail و ownerUid في firebase-config.js أولاً.');
    if (typeof password !== 'string' || !password || password.length > 128)
      throw new Error('أدخل كلمة مرور صحيحة.');
    // The owner only types the password. The email is preconfigured and public, not secret.
    const credential = await auth.signInWithEmailAndPassword(ownerEmail, password);
    if (!await isOwner(credential.user)) {
      await auth.signOut();
      throw new Error('هذا الحساب غير مخوّل لتعديل الأسعار.');
    }
    return credential;
  }
  async function savePrice(item, oldPrice, newPrice) {
    if (!db || !auth || !await isOwner(auth.currentUser))
      throw new Error('الدخول غير مصرح.');
    if (!validPrice(newPrice) || !validPrice(oldPrice) || !validPrice(item.price))
      throw new Error('سعر غير صحيح.');
    if (!/^[a-zA-Z0-9-]{1,80}$/.test(item.id))
      throw new Error('معرّف الصنف غير صحيح.');
    const batch = db.batch();
    if (item.isCustom) {
      if (!/^new-[A-Za-z0-9]{20}$/.test(item.id)) throw new Error('معرّف غير صالح.');
      batch.update(db.collection('menuItems').doc(item.id), {
        price: newPrice,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: auth.currentUser.uid
      });
    } else {
      const ref = db.collection('menuPrices').doc(item.id);
      if (newPrice === item.price) batch.delete(ref);
      else batch.set(ref, {
        price: newPrice,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: auth.currentUser.uid
      });
    }
    batch.set(db.collection('priceHistory').doc(), {
      productId: item.id,
      productName: item.name,
      oldPrice, newPrice,
      at: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: auth.currentUser.uid
    });
    await batch.commit();
  }
  window.LIWAN_SYNC = {configured:!!db,ownerReady,error,auth,
    listenPrices,listenHistory,listenMenuItems,listenMenuOverrides,listenMenuPhotos,addMenuItem,updateMenuItem,saveBaseItem,deleteMenuItem,
    isOwner,loginWithPassword,savePrice};
})();
