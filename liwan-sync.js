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
    const ref = db.collection('menuPrices').doc(item.id);
    if (newPrice === item.price) batch.delete(ref);
    else batch.set(ref, {
      price: newPrice,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: auth.currentUser.uid
    });
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
    listenPrices,listenHistory,isOwner,loginWithPassword,savePrice};
})();
