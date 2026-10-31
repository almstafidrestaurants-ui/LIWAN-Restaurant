/* LIWAN — PASS.Text showcase. Not authentication or access control. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const form = $('loginForm');
  const input = $('loginPassword');
  const status = $('loginStatus');
  const button = $('loginButton');
  let unlocked = false;
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (unlocked) return;
    button.disabled = true;
    status.textContent = 'جارِ قراءة ملف كلمة المرور...';
    try {
      // GitHub Pages files are public. Any visitor can fetch PASS.Text directly.
      const response = await fetch('./PASS.Text', { cache: 'no-store' });
      if (!response.ok) throw new Error('Could not read PASS.Text');
      const saved = (await response.text()).replace(/^\uFEFF/, '').trim();
      if (!saved) throw new Error('Empty password file');
      if (input.value !== saved) {
        status.textContent = 'كلمة المرور غير صحيحة.';
        input.value = '';
        input.focus();
        return;
      }
      unlocked = true;
      input.value = '';
      $('loginPage').hidden = true;
      $('ownerTopbar').hidden = false;
      $('ownerDashboard').hidden = false;
      $('logoutButton').addEventListener('click', () => window.location.reload());
      const script = document.createElement('script');
      script.src = 'owner.js';
      script.onerror = () => { status.textContent = 'تعذّر تحميل لوحة الإدارة.'; };
      document.body.appendChild(script);
    } catch (_) {
      status.textContent = 'تعذّر قراءة PASS.Text. افتح المشروع باستخدام Live Server أو خادم محلي، وتأكد من وجود الملف بجانب owner.html.';
    } finally {
      button.disabled = false;
    }
  });
})();
