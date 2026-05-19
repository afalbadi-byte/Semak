# سماك العقارية — دليل المشروع

## الهوية البصرية (Visual Identity)

### الألوان الرسمية
| الاستخدام | الكود | الوصف |
|---|---|---|
| **Primary** | `#1a365d` | الكحلي الداكن — اللون الرئيسي للعلامة |
| **Accent** | `#c5a059` | الذهبي — لون التمييز والتفاعل |
| **Dark BG** | `#0a0f1e` | خلفية الأقسام الداكنة جداً (كـ About hero) |
| **WhatsApp** | `#25D366` | أخضر واتساب فقط — لا يُستخدم لغيره |

> ❌ لا تستخدم ألوان مشابهة كـ `#080d18` أو `#1e3a5f` — استخدم الأكواد الرسمية فقط.

### الخلفيات
| الصفحة/القسم | الكلاس |
|---|---|
| خلفية الصفحات العامة | `bg-slate-50` |
| البطاقات والأجزاء البيضاء | `bg-white` |
| الأقسام الداكنة (primary) | `bg-[#1a365d]` |
| الأقسام الداكنة جداً | `bg-[#0a0f1e]` |
| تراكب على صور البطل | `bg-[#1a365d]/80` أو `/90` أو `/92` |

### الحواف المدورة
| الاستخدام | الكلاس |
|---|---|
| الأزرار | `rounded-2xl` |
| البطاقات القياسية | `rounded-2xl` |
| البطاقات المميزة | `rounded-[2rem]` |
| الشارات / التسميات | `rounded-full` |

### الخطوط والأوزان
- خط المشروع: **Cairo** (`font-cairo`) مع `dir="rtl"` دائماً
- عناوين رئيسية: `font-black`
- عناوين فرعية / أزرار: `font-bold`
- روابط Navbar: `font-semibold`

### الظلال
| الاستخدام | الكلاس |
|---|---|
| تحوّل hover للبطاقات | `hover:shadow-xl` |
| المودالات والقوائم | `shadow-2xl` |
| الأزرار الرئيسية | `shadow-lg` |

### الطباعة (Typography Patterns)
```jsx
{/* عنوان قسم نموذجي */}
<p className="text-[#c5a059] font-black tracking-[0.3em] text-xs uppercase mb-3">
  عنوان القسم الصغير
</p>
<h2 className="text-3xl md:text-4xl font-black text-[#1a365d]">
  العنوان الرئيسي
</h2>
```

### الأزرار
```jsx
{/* زر رئيسي */}
<button className="bg-[#1a365d] text-white px-8 py-4 rounded-2xl font-bold hover:bg-[#c5a059] transition-all shadow-lg hover:-translate-y-0.5">
  نص الزر
</button>

{/* زر ثانوي */}
<button className="bg-white border-2 border-[#1a365d]/20 text-[#1a365d] px-8 py-4 rounded-2xl font-bold hover:border-[#c5a059] hover:text-[#c5a059] transition-all">
  نص الزر
</button>
```

---

## هيكل المشروع

```
src/
├── pages/
│   ├── Home.jsx          — الرئيسية
│   ├── About.jsx         — من نحن
│   ├── Projects.jsx      — مشاريعنا + مخططات تفاعلية
│   ├── Services.jsx      — خدماتنا
│   ├── Contact.jsx       — تواصل معنا
│   ├── LegalPage.jsx     — سياسة + شروط
│   ├── NotFound.jsx      — صفحة 404
│   └── customer/
│       ├── CustomerLogin.jsx  — تسجيل دخول الملاك
│       ├── Portal.jsx         — بوابة الملاك
│       └── Maintenance.jsx    — طلب صيانة
│   └── admin/
│       ├── AdminLogin.jsx
│       ├── Dashboard.jsx
│       ├── TechDashboard.jsx
│       ├── LetterGenerator.jsx
│       ├── UnitInspection.jsx
│       └── UnitHandover.jsx
├── components/
│   ├── Navbar.jsx        — تخفى على: login, portal, maintenance, dashboard...
│   ├── Footer.jsx        — تخفى على نفس المسارات
│   ├── Partners.jsx      — تخفى على نفس المسارات
│   ├── PageMeta.jsx      — تعيين عنوان التبويب لكل صفحة
│   └── GlobalStyles.jsx
└── context/
    └── AppContext.jsx
```

## قواعد مهمة

1. **الهوية البصرية**: التزم دائماً بالألوان الرسمية `#1a365d` و`#c5a059` و`#0a0f1e` — لا تُدخل ألواناً جديدة دون ضرورة.
2. **PageMeta**: كل صفحة يجب أن تحتوي على `<PageMeta title="..." />` لعنوان التبويب الصحيح.
3. **الاتجاه**: `dir="rtl"` محدد في الـ Router wrapper — لا تضفه يدوياً على كل مكون.
4. **الخط**: `font-cairo` محدد على المستوى الجذري — لا تضفه يدوياً إلا للصفحات المعزولة (portal, maintenance).
5. **الإخفاء**: أي صفحة معزولة (portal/admin) تُضاف لقوائم `HIDE_ON_PATHS` في Navbar, Footer, Partners.
6. **Preview**: الخادم يعمل من worktree — عدّل دائماً ملفات `src/` الرئيسية وملفات الـ worktree معاً.
