/* LIWAN owner sign-in: Firestore rules are the authority, never this interface alone. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const sync = window.LIWAN_SYNC;
  const form = $('loginForm');
  const status = $('loginStatus');
  const button = $('loginButton');
  const email = $('loginEmail');
  const password = $('loginPassword');
  let loaded=false;
  if (!sync || !sync.configured || !sync.auth) {
    button.disabled = true;
    status.textContent = 'لم يكتمل ربط Firebase. راجع ملف README-FIREBASE-AR.md قبل استخدام لوحة الإدارة.';
    return;
  }
  const auth=sync.auth;
  auth.setPersistence(firebase.auth.Auth.Persistence.SESSION).catch(() => {});
  auth.onAuthStateChanged(async user => {
    if (sync.isOwner(user)) {
      $('loginPage').hidden = true;
      $('ownerTopbar').hidden = false;
      $('ownerDashboard').hidden = false;
      if (!loaded) {
        loaded = true;
        const script = document.createElement('script');
        script.src = 'owner.js';
        script.onerror = () => { status.textContent = 'تعذّر تحميل لوحة الإدارة.'; };
        document.body.appendChild(script);
      }
    } else {
      $('loginPage').hidden = false;
      $('ownerTopbar').hidden = true;
      $('ownerDashboard').hidden = true;
      if (user) { status.textContent = 'هذا الحساب ليس حساب صاحب المطعم.'; await auth.signOut(); }
    }
  }, () => {status.textContent='تعذّر التحقق من حالة الدخول.';});
  form.addEventListener('submit', async event => {
    event.preventDefault();
    button.disabled=true;
    status.textContent='جارِ التحقق من بيانات الدخول...';
    try {
      await auth.signInWithEmailAndPassword(email.value.trim(), password.value);
      password.value='';
      status.textContent='';
    } catch (err) {
      password.value='';
      status.textContent = err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found'
        ? 'بيانات الدخول غير صحيحة.' : 'تعذّر تسجيل الدخول: ' + (err.message || 'خطأ في الاتصال');
    } finally {button.disabled=false;}
  });
  $('logoutButton').addEventListener('click', async () => {
    await auth.signOut();
    window.location.reload();
  });
})();
