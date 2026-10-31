/* LIWAN Owner — password-only screen with Firebase Email/Password behind the scenes. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const sync = window.LIWAN_SYNC;
  const status = $('loginStatus');
  const button = $('loginButton');
  const input = $('loginPassword');
  let loaded = false;
  if (!sync?.configured || !sync.auth || !sync.ownerReady) {
    button.disabled = true;
    status.textContent = !sync?.configured
      ? 'Firebase غير جاهز. تحقق من إعدادات الربط.'
      : 'لم يكتمل إعداد المالك. أضف ownerEmail و ownerUid إلى firebase-config.js.';
    return;
  }
  const auth = sync.auth;
  const persistenceReady = auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
  auth.onAuthStateChanged(async user => {
    try {
      const authorized = user ? await sync.isOwner(user) : false;
      if (authorized) {
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
        if (user) {
          status.textContent = 'هذا الحساب غير مخوّل.';
          await auth.signOut();
        }
      }
    } catch (_) {
      $('loginPage').hidden = false;
      $('ownerTopbar').hidden = true;
      $('ownerDashboard').hidden = true;
      status.textContent = 'تعذّر التحقق من صلاحية الدخول.';
    }
  });
  $('loginForm').addEventListener('submit', async event => {
    event.preventDefault();
    button.disabled = true;
    status.textContent = 'جارِ التحقق من كلمة المرور...';
    const provided = input.value;
    input.value = '';
    try {
      await persistenceReady;
      await sync.loginWithPassword(provided);
      status.textContent = '';
    } catch (err) {
      const code = err?.code || '';
      if (code === 'auth/too-many-requests')
        status.textContent = 'محاولات كثيرة. حاول لاحقاً.';
      else if (['auth/wrong-password','auth/user-not-found','auth/invalid-credential','auth/invalid-login-credentials','auth/invalid-email'].includes(code))
        status.textContent = 'كلمة المرور غير صحيحة.';
      else
        status.textContent = 'تعذّر الدخول: ' + (err?.message || 'تأكد من إعداد الحساب.');
    } finally { button.disabled = false; }
  });
  $('logoutButton').addEventListener('click', async () => {
    await auth.signOut();
    window.location.reload();
  });
})();
