# LIWAN — نسخة Firebase Spark المجانية (بدون Cloud Functions)

هذا المشروع يعمل على **Firebase Spark** باستخدام Firestore وEmail/Password Authentication.

- تظهر للمالك خانة **كلمة المرور فقط**؛ لا توجد خانة بريد إلكتروني.
- يتطلب Firebase حساب بريد إلكتروني **مرة واحدة فقط** داخل لوحة Authentication، وهو مخفي في واجهة المالك لكن مُدرج في إعدادات الموقع العامة. البريد **ليس سرًا**.
- يتم التحقق من كلمة السر داخل Firebase Authentication، وليس من ملف PASS.Text؛ لا تُنشر كلمة السر مطلقًا.
- صاحب المطعم وحده يغير الأسعار، عبر قواعد Firestore التي تتحقق من UID؛ كل الزبائن يستطيعون قراءة الأسعار.
- لا حاجة إلى Cloud Functions أو Blaze أو إدخال بطاقة دفع ما دمت ضمن حدود Spark.

## الإعداد النهائي بعد ربط حساب المالك

**تم الربط بالفعل داخل الملفات المرفقة:**

- مشروع Firebase: `liwan-restauran`
- بريد المالك: `almstafidrestaurants@gmail.com` (مُدرج تلقائيًا في الكود، ولا يظهر في شاشة الدخول)
- UID: `VA3ViQPnNZf94nTvibXDGqumAqM2`
- `firestore.rules`: أضيف إليه UID بالفعل.
- **لم يتم نشر القواعد أو الموقع من هذه النسخة**.

**الخطوة 1 — نشر قواعد الأمان:**

1. افتح Firebase Console → Firestore → قاعدة `(default)` → **Rules**.
2. الصق النص الكامل من `firestore.rules`، واضغط **Publish**. لا تسمح للزبائن بالكتابة.
3. Firebase Console → Authentication → Settings → Authorized domains: تأكد أن `almstafidrestaurants-ui.github.io` مدرج، وأضفه إن لم يكن.

**الخطوة 2 — نشر الموقع:**

4. فك أرشيف `LIWAN_GITHUB_UPLOAD_UID_READY.zip`، وارفع **الملفات الموجودة بداخله** (وليس ملف zip نفسه) إلى جذر مستودع `LIWAN-Restaurant` على فرع `main` في GitHub، واستبدل الملفات ذات الأسماء نفسها.
5. احذف من مستودع GitHub الملفين القديمين `PASS.Text` و`pass-gate.js` (هذا المشروع لا يستخدمهما)، ولا تنشر أي كلمة مرور.
6. تأكد من نجاح نشر GitHub Pages.

**الخطوة 3 — اختبار سريع:**

7. افتح `https://almstafidrestaurants-ui.github.io/LIWAN-Restaurant/owner.html` وأدخل **كلمة المرور الجديدة التي وضعتها لحساب المالك داخل Firebase** فقط، دون بريد.
8. غيّر سعر أحد الأصناف واحفظه. ستجد سجل السعر في `Firestore → Data → menuPrices`؛ افتح المنيو من جهاز آخر للتأكد من المزامنة.

**مهم:** لا تظهر أي نافذة تطلب البريد الإلكتروني، لكن البريد موجود في ملفات جافاسكربت العامة ولا يُعامل على أنه سرّ؛ الحماية تأتي من Firebase Authentication وقواعد Firestore. لا تُحفظ كلمة المرور في الموقع.

> إذا عدلت السعر قديمًا باستخدام `localStorage`، أعد حفظه بعد النشر. وإذا لم تُنشر قواعد Firestore، فحفظ الأسعار لن يعمل حتى لو نجح الدخول.

## ملاحظات / أخطاء

- «أكمل ownerEmail وownerUid»: تأكد من كتابتهما في الملف المنشور.
- `Missing or insufficient permissions`: تأكد من UID في قواعد Firestore ومن الضغط على Publish.
- `auth/invalid-credential`: تحقق من كلمة المرور وحساب المستخدم.
- الأسعار لا تتغير عند الزبائن: تأكد من نجاح حفظ السعر، ثم اختبر صفحة المنيو في متصفح آخر. راقب Firestore → Data → collection `menuPrices`.
- `auth/unauthorized-domain`: أضف دومين GitHub Pages في Authentication → Settings → Authorized domains.
- لا تغيّر `projectId` أو `appId` اللذين ربطناهما بمشروعك.

## الملفات

- `index.html`, `script.js`, `style.css`, `menu-data.js`: منيو الزبائن الأصلي.
- `owner.html`, `owner.js`, `owner-auth.js`, `owner.css`: لوحة الإدارة وكلمة السر الواحدة.
- `liwan-sync.js`, `firebase-config.js`: مزامنة الأسعار والدخول عبر Firebase.
- `firestore.rules`: قواعد Firestore للصقها في لوحة Firebase (ليست جزءًا من ملفات العرض).
- `images/`: صور المطعم كما هي.

حساب المالك أُنشئ مسبقًا. تم ربط بريده وUID محليًا فقط؛ قواعد الأمان والموقع لم يُنشرا بعد.


## إضافة الأصناف إلى القسم المحدد (الإصدار الجديد)

- من لوحة المالك، افتح «إضافة صنف» واختر أحد أقسام المنيو التسعة ثم اكتب اسم الصنف وسعره.
- يظهر أحدث صنف في أول القسم المختار في منيو الزبائن بعد الحفظ في Firestore.
- يمكن تعديل الصنف المضاف أو حذفه من نفس اللوحة. لا يمكن حذف الأصناف الأصلية من هذه الواجهة.
- الصور الاختيارية تُرفع إلى GitHub في مجلد images؛ يمكن إدخال مسار صورة، أو ترك الخانة فارغة لاستخدام صورة القسم.
- لا بد من نشر ملف firestore.rules الجديد **من لوحة Firestore > Rules > Publish**؛ رفعه إلى GitHub وحده لا ينشر القواعد.
- لا تغيير لطريقة الدخول بكلمة مرور فقط، أو تصميم المنيو الحالي.
