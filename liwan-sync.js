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
    // The ID is generated automatically; only the authenticated owner can create a document.
    const target = db.collection('menuItems').doc('new-' + ref.id);
    await target.set({ ...item, createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(), createdBy: uid, updatedBy: uid });
    return target.id;
  }
  async function updateMenuItem(id, form) {
    const uid = await requireOwner();
    if (!/^new-[A-Za-z0-9]{20}$/.test(id)) throw new Error('هذا الصنف ليس من إضافات المالك.');
    await db.collection('menuItems').doc(id).update({ ...validateItem(form),
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(), updatedBy: uid });
  }
  async function deleteMenuItem(id) {
    await requireOwner();
    if (!/^new-[A-Za-z0-9]{20}$/.test(id)) throw new Error('لا يمكن حذف صنف من المنيو الأصلي هنا.');
    await db.collection('menuItems').doc(id).delete();
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
    listenPrices,listenHistory,listenMenuItems,addMenuItem,updateMenuItem,deleteMenuItem,
    isOwner,loginWithPassword,savePrice};
})();
