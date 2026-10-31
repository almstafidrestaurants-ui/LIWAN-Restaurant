/* LIWAN | Real-time shared price overrides (Firestore + Firebase Auth).
   The public menu only reads prices. Writes are protected by Firestore security rules.
*/
(() => {
  'use strict';
  const config = window.LIWAN_FIREBASE_CONFIG || {};
  const configured = ['apiKey', 'authDomain', 'projectId', 'appId', 'ownerUid', 'ownerEmail'].every(k =>
    typeof config[k] === 'string' && config[k].trim().length > 0 && !config[k].startsWith('YOUR_'));
  let app, db, auth;
  let error = '';
  if (configured) {
    try {
      if (!window.firebase || typeof firebase.initializeApp !== 'function') throw new Error('تعذّر تحميل Firebase SDK');
      app = firebase.apps.length ? firebase.app() : firebase.initializeApp({
        apiKey:config.apiKey, authDomain:config.authDomain, projectId:config.projectId, appId:config.appId
      });
      db = firebase.firestore(app);
      auth = firebase.auth(app);
    } catch (err) { error = String(err && err.message || err); }
  } else {error = 'لم يتم إعداد Firebase بعد. افتح firebase-config.js واتبع README-FIREBASE-AR.md';}

  const validPrice = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 10000;
  function listenPrices(onPrices, onError) {
    if (!db) {if (onError) onError(new Error(error)); return () => {};}
    return db.collection('menuPrices').onSnapshot(snapshot => {
      const values = Object.create(null);
      snapshot.forEach(doc => {
        const price = doc.data() && doc.data().price;
        if (validPrice(price)) values[doc.id] = price;
      });
      onPrices(values, !!snapshot.metadata.fromCache);
    }, err => { if (onError) onError(err); });
  }
  function listenHistory(onHistory, onError) {
    if (!db) {if (onError) onError(new Error(error)); return () => {};}
    return db.collection('priceHistory').orderBy('at', 'desc').limit(80).onSnapshot(snapshot => {
      onHistory(snapshot.docs.map(doc => ({id:doc.id, ...doc.data()})));
    }, err => {if (onError) onError(err);});
  }
  function isOwner(user) {return !!user && !!config.ownerUid && user.uid === config.ownerUid;}
  async function savePrice(item, oldPrice, newPrice) {
    if (!db || !auth || !isOwner(auth.currentUser)) throw new Error('الدخول غير مصرح.');
    if (!validPrice(newPrice) || !validPrice(oldPrice) || !validPrice(item.price)) throw new Error('سعر غير صحيح.');
    const batch=db.batch();
    const priceRef=db.collection('menuPrices').doc(item.id);
    if (newPrice === item.price) batch.delete(priceRef);
    else batch.set(priceRef, {
      price: newPrice,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: auth.currentUser.uid
    });
    const historyRef=db.collection('priceHistory').doc();
    batch.set(historyRef, {
      productId: item.id, productName: item.name,
      oldPrice, newPrice,
      at: firebase.firestore.FieldValue.serverTimestamp(),
      updatedBy: auth.currentUser.uid
    });
    await batch.commit();
  }
  window.LIWAN_SYNC = { configured: !!db, error, auth, isOwner, listenPrices, listenHistory, savePrice };
})();
