LIWAN — إعداد Firebase للمزامنة التلقائية للأسعار
================================================

الهدف:
- يبقى منيو الزبائن بنفس الشكل.
- تظهر له الأسعار المحفوظة في Firestore تلقائياً.
- شاشة Owner فيها حقل كلمة مرور فقط. لا يُطلب بريد إلكتروني عند الدخول.
- يقتصر تغيير الأسعار على مستخدم المالك المُعتمد وفق Firebase Authentication وقواعد Firestore.

الإعداد الأولي (يُنفّذ مرة واحدة):

1) افتح https://console.firebase.google.com/ وأنشئ مشروع LIWAN.
2) افتح Build > Firestore Database > Create database، واختر Production mode.
3) افتح Build > Authentication > Sign-in method وفعّل Email/Password.
4) من Authentication > Users > Add user، أنشئ مستخدماً واحداً للمالك
   ببريد إلكتروني مخصص وكلمة مرور جديدة وقوية. هذا البريد لن يظهر في شاشة الإدارة.
   لا تستخدم كلمة المرور القديمة 2027؛ فهي كانت مكشوفة في PASS.Text على GitHub.
5) انسخ UID للمستخدم الجديد من Authentication > Users.
6) أضف Web App من Project settings > General > Your apps، وانسخ القيم:
   apiKey, authDomain, projectId, appId
7) افتح الملف firebase-config.js واملأ تلك القيم، وكذلك:
   ownerEmail = البريد الذي أدخلته في خطوة 4
   ownerUid = UID من خطوة 5
   ملاحظة: اسم البريد وإعدادات Web App ليست كلمة المرور؛ لا تضع كلمة المرور
   ولا ملفات Service Account ولا مفاتيح Admin SDK داخل GitHub.
8) افتح firestore.rules. استبدل OWNER_UID_HERE بالـ UID نفسه.
   من Firestore Database > Rules الصق القواعد واضغط Publish.
   إذا كان Firebase مستخدماً لتطبيقات أخرى فادمج القواعد ولا تحذف قواعدها.
9) راجع Authentication > Settings > Authorized domains وأضف:
   almstafidrestaurants-ui.github.io
   إذا كان غير موجود في القائمة.
10) ارفع محتويات هذا المجلد إلى جذر مستودع GitHub:
    https://github.com/almstafidrestaurants-ui/LIWAN-Restaurant
    (لا ترفع مجلد LIWAN_FIREBASE_PASSWORD_ONLY كطبقة إضافية).
11) احذف PASS.Text و pass-gate.js القديمين يدوياً من GitHub. مجرد رفع ZIP
    لا يحذف الملفات القديمة من المستودع، وقد تبقى كلمة المرور 2027 مكشوفة
    في سجلّ GitHub؛ استخدم كلمة مرور جديدة تماماً.
12) عندما يكون نشر GitHub Pages ناجحاً، افتح:
    صفحة المالك: https://almstafidrestaurants-ui.github.io/LIWAN-Restaurant/owner.html
    المنيو: https://almstafidrestaurants-ui.github.io/LIWAN-Restaurant/
    أدخل كلمة المرور فقط في صفحة المالك، عدّل مثلاً 22 إلى 28 واضغط حفظ.
    افتح المنيو على جهاز آخر؛ يجب أن يظهر السعر الجديد.

تنبيهات مهمّة:
- هذا الملف لا يستطيع إنشاء مشروع Firebase في حسابك تلقائياً.
  لا تبدأ المزامنة الحقيقية إلا بعد إعداد مشروعك ووضع قيمه ونشر القواعد.
- لا يمكن تأمين كتابة الأسعار باعتماد PASS.Text في GitHub Pages؛
  لم نعد نستخدمه إطلاقاً.
- أسعار menu-data.js هي الأسعار الأساسية فقط؛ عندما تتصل Firestore تظهر
  التغييرات من مجموعة menuPrices وتُحدّث مباشرة عبر onSnapshot.
- إذا انقطع الاتصال، قد يرى الزائر السعر الأساسي بدلاً من آخر سعر محفوظ،
  لذا تأكد من الاتصال بعد تعديل الأسعار.
- قد توجد حصص/تكاليف تشغيل Firebase.
- تطبيق LIWAN ADMIN Android الذي يفتح owner.html لا يحتاج إلى تغيير الرابط.

الملفات الجديدة/الأساسية:
  firebase-config.js  <-- تعبئة بيانات مشروع Firebase
  firestore.rules     <-- قواعد الأمان التي تُنشر في Firestore
  liwan-sync.js       <-- القراءة الحية والحفظ
  owner-auth.js       <-- الدخول بكلمة مرور فقط باستخدام Firebase Auth
  owner.js            <-- لوحة الأسعار
  index.html,script.js <-- الزبائن

تشخيص الأعطال:
- شاشة الدخول غير نشطة: تأكد من القيم الست في firebase-config.js.
- لم يتم حفظ السعر: تحقق من أن UID نفسه في config وفي firestore.rules،
  ومن نشر القواعد وفعل حساب Email/Password.
- ظهر السعر في Owner دون الزبون: افتح المنيو بعد نشر index.html وscript.js
  وliwan-sync.js وتحقق من اتصال الجهاز بـ Firebase.
- GitHub Pages أحمر: افتح GitHub > Actions لمراجعة أخطاء عملية النشر.
