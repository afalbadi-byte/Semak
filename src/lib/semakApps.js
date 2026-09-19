// ─── سجلّ تطبيقات سماك — مصدرٌ واحد للاسم والأيقونة والصلاحية ─────────────
// تقرؤه بوابة «تطبيقات سماك» لتعرض لكل مستخدم ما يحقّ له فقط، وتقرؤه الشاشات
// المشتركة (الدخول والتثبيت) لتُظهر أيقونة التطبيق المفتوح.
// الصلاحيات هنا نفسها التي يفحصها كل تطبيق عند فتحه — لا بابٌ يظهر ثم يُغلق.
export const SEMAK_APPS = [
    { slug: 'buy',  path: '/buy',  name: 'مشتريات سماك', short: 'المشتريات',
      desc: 'فواتير الشراء والأسعار ودفعات الموردين', color: '#f59e0b',
      perms: ['finance', 'accounting'] },
    { slug: 'proj', path: '/proj', name: 'مشاريع سماك', short: 'المشاريع',
      desc: 'المشاريع ونسب الإنجاز والوحدات والسجلات', color: '#0ea5e9',
      perms: ['projects', 'finance', 'accounting', 'units'] },
    { slug: 'qc',   path: '/qc',   name: 'جودة سماك', short: 'الجودة',
      desc: 'فحص الوحدات وتسجيل الملاحظات ومتابعتها', color: '#10b981',
      perms: ['inspection', 'snaglist', 'projects', 'units'] },
    { slug: 'meet', path: '/meet', name: 'غرفة اجتماعات سماك', short: 'الاجتماعات',
      desc: 'الأجندة والمهام والمكالمة والسبورة', color: '#8b5cf6',
      perms: null },                                   // لكل موظّف له حساب
    { slug: 'admin', path: '/admin/dashboard', name: 'لوحة الإدارة', short: 'الإدارة',
      desc: 'النظام الكامل: الحسابات والعقود والتقارير', color: '#c5a059',
      perms: 'any', web: true, icon: '/images/app-icon-512.png' },
];

export const appIcon = a => a.icon || `/images/icons/${a.slug}-512.png`;

export function canUse(app, user) {
    if (!user) return false;
    if (user.role === 'admin') return true;
    const p = Array.isArray(user.perms) ? user.perms : [];
    if (app.perms === null) return true;
    if (app.perms === 'any') return p.length > 0;
    return app.perms.some(k => p.includes(k));
}

// هل فُتح التطبيق من داخل البوابة؟ (فيظهر زر الرجوع إليها)
export const fromHub = () => { try { return sessionStorage.getItem('semak_hub') === '1'; } catch (e) { return false; } };
