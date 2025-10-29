# مدرسة رقية الإسلامية — تطبيق «قيمنا تصنع الأثر»

## إعداد سريع
1) أنشئ مشروع Supabase جديدًا، ثم انسخ `Project URL` و`anon public key` إلى `app.js` مكان القيم:
```
const SUPABASE_URL = "https://YOUR_PROJECT.supabase.co";
const SUPABASE_ANON_KEY = "YOUR_ANON_PUBLIC_KEY";
```
2) افتح لوحة SQL في Supabase ونفّذ محتوى `schema.sql` كما هو.
3) ارفع مجلد الموقع (الملفات الساكنة) إلى Vercel/Netlify أو أي خادم ملفات ثابتة.
4) افتح الموقع. دخول المعلمات/المنسقة يتم عبر البريد (OTP) من خلال Supabase Auth (Mail/Magic Link).
5) دخول الطالبة يتم برمز (مثل: `RUK-001`) عبر زر «دخول»؛ الدالة `claim_student_token` تُرجع بيانات الطالبة وتلغي الرمز.

## ملاحظات
- حساب النقاط يجري تلقائيًا عند «اعتماد» المبادرة وفق المعادلة:
  `Total = 10 × ValueWeight × ImpactFactor × EvidenceFactor − Penalty`  
  حيث ValueWeight: الانضباط 1.0 — التعاون 1.1 — الأمانة 1.2 — العزيمة 1.15؛ EvidenceFactor=1.2 عند وجود توثيق.
- العروض:
  - `initiatives_weekly`: مجموع نقاط هذا الأسبوع (Top 10 في الواجهة).
  - `initiatives_monthly_values`: تقرير شهري حسب القيم.
- تصدير CSV بترميز UTF‑8 BOM ليعمل في Excel بالعربية.
