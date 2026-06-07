import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../context/AppContext';
import { apiGet } from '../../lib/api/client';
import {
  CheckCircle2, XCircle, Zap, Clock, AlertTriangle, Crown,
  Users, FileText, Shield, RefreshCw, ExternalLink, MessageCircle
} from 'lucide-react';

/* ─── معلومات الباقات ─── */
const PLANS = [
  {
    id: 'trial',
    name: 'تجربة مجانية',
    price: 0,
    period: '14 يوماً',
    color: 'slate',
    features: [
      { label: 'حتى 3 مستخدمين', ok: true },
      { label: 'حتى 50 فاتورة شهرياً', ok: true },
      { label: 'الدفترة المحاسبية', ok: true },
      { label: 'إدارة العقارات والوحدات', ok: true },
      { label: 'ZATCA - رمز QR', ok: true },
      { label: 'فواتير الكترونية معتمدة', ok: false },
      { label: 'دعم فني مخصص', ok: false },
    ],
  },
  {
    id: 'starter',
    name: 'المبتدئ',
    price: 299,
    period: 'شهرياً',
    color: 'blue',
    features: [
      { label: 'حتى 5 مستخدمين', ok: true },
      { label: 'حتى 500 فاتورة شهرياً', ok: true },
      { label: 'الدفترة المحاسبية', ok: true },
      { label: 'إدارة العقارات والوحدات', ok: true },
      { label: 'ZATCA - رمز QR', ok: true },
      { label: 'فواتير الكترونية معتمدة', ok: true },
      { label: 'دعم فني مخصص', ok: false },
    ],
  },
  {
    id: 'pro',
    name: 'الاحترافي',
    price: 599,
    period: 'شهرياً',
    color: 'amber',
    recommended: true,
    features: [
      { label: 'حتى 15 مستخدماً', ok: true },
      { label: 'فواتير غير محدودة', ok: true },
      { label: 'الدفترة المحاسبية', ok: true },
      { label: 'إدارة العقارات والوحدات', ok: true },
      { label: 'ZATCA - فاتورة معتمدة', ok: true },
      { label: 'فواتير الكترونية معتمدة', ok: true },
      { label: 'دعم فني مخصص', ok: true },
    ],
  },
  {
    id: 'enterprise',
    name: 'المؤسسي',
    price: 1499,
    period: 'شهرياً',
    color: 'purple',
    features: [
      { label: 'مستخدمون غير محدودون', ok: true },
      { label: 'فواتير غير محدودة', ok: true },
      { label: 'الدفترة المحاسبية', ok: true },
      { label: 'إدارة العقارات والوحدات', ok: true },
      { label: 'ZATCA - فاتورة معتمدة', ok: true },
      { label: 'فواتير الكترونية معتمدة', ok: true },
      { label: 'دعم فني مخصص + مدير حساب', ok: true },
    ],
  },
];

const PLAN_COLOR = {
  slate: { badge: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300', card: 'border-slate-200 dark:border-slate-700', btn: 'bg-slate-800 text-white' },
  blue:  { badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',  card: 'border-blue-200 dark:border-blue-700',  btn: 'bg-blue-600 text-white'  },
  amber: { badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300', card: 'border-[#c5a059] shadow-lg shadow-[#c5a059]/10', btn: 'bg-[#c5a059] text-slate-950' },
  purple:{ badge: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300', card: 'border-purple-300 dark:border-purple-700', btn: 'bg-purple-600 text-white' },
};

/* ─── إحصائيات الاستخدام ─── */
function UsageCard({ label, used, limit, icon: Icon, color }) {
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0;
  const isHigh = pct >= 80;
  return (
    <div className="bg-white dark:bg-brand-900 rounded-2xl p-5 border border-brand-100 dark:border-brand-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
            <Icon size={16} />
          </div>
          <span className="text-sm font-bold text-brand-800 dark:text-brand-100">{label}</span>
        </div>
        <span className={`text-xs font-black ${isHigh ? 'text-red-500' : 'text-slate-500 dark:text-brand-400'}`}>
          {limit === -1 ? `${used} / غير محدود` : `${used} / ${limit}`}
        </span>
      </div>
      {limit > 0 && (
        <div className="w-full h-2 bg-slate-100 dark:bg-brand-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${isHigh ? 'bg-red-400' : 'bg-[#c5a059]'}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export default function SubscriptionPage() {
  const { branding } = useContext(AppContext);

  const plan       = branding?.plan    || 'trial';
  const status     = branding?.status  || 'active';
  const daysLeft   = branding?.days_left ?? null;
  const trialEnds  = branding?.trial_ends;
  const expired    = plan === 'trial' && daysLeft !== null && daysLeft <= 0;
  const urgent     = plan === 'trial' && !expired && daysLeft !== null && daysLeft <= 7;
  const companyName = branding?.company_name || 'سماك العقارية';
  const upgradeUrl  = (planName) =>
    `https://wa.me/966920032842?text=${encodeURIComponent(`أود الترقية إلى باقة ${planName} في نظام ${companyName}`)}`;

  const [usage, setUsage] = useState(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  useEffect(() => {
    setLoadingUsage(true);
    apiGet('tenant_usage')
      .then(d => { if (d.success) setUsage(d); })
      .catch(() => {})
      .finally(() => setLoadingUsage(false));
  }, []);

  const currentPlanInfo = PLANS.find(p => p.id === plan) || PLANS[0];

  return (
    <div className="space-y-8 max-w-5xl" dir="rtl">
      {/* ─── العنوان ─── */}
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-[#c5a059]/10 flex items-center justify-center">
          <Crown size={20} className="text-[#c5a059]" />
        </div>
        <div>
          <h2 className="text-xl font-black text-brand-800 dark:text-brand-50">الاشتراك والباقة</h2>
          <p className="text-sm text-slate-500 dark:text-brand-400">إدارة خطة اشتراكك وعرض الاستخدام الحالي</p>
        </div>
      </div>

      {/* ─── بطاقة الباقة الحالية ─── */}
      <div className={`rounded-2xl border-2 p-6 ${
        expired ? 'bg-red-50 border-red-300 dark:bg-red-900/10 dark:border-red-700' :
        urgent  ? 'bg-amber-50 border-amber-300 dark:bg-amber-900/10 dark:border-amber-700' :
                  'bg-white dark:bg-brand-900 border-[#c5a059]/40'
      }`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${
              expired ? 'bg-red-100 dark:bg-red-900/30' :
              urgent  ? 'bg-amber-100 dark:bg-amber-900/30' :
                        'bg-[#c5a059]/10'
            }`}>
              {expired ? <AlertTriangle size={24} className="text-red-500" /> :
               plan === 'trial' ? <Clock size={24} className="text-[#c5a059]" /> :
               <Crown size={24} className="text-[#c5a059]" />}
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-xl font-black text-brand-800 dark:text-brand-50">
                  {currentPlanInfo.name}
                </h3>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  status === 'suspended' ? 'bg-red-100 text-red-700' :
                  status === 'cancelled' ? 'bg-gray-100 text-gray-700' :
                  'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                }`}>
                  {status === 'active' ? 'نشط' : status === 'suspended' ? 'معلّق' : 'ملغى'}
                </span>
              </div>
              {plan === 'trial' && trialEnds && (
                <p className={`text-sm font-bold ${expired ? 'text-red-600' : urgent ? 'text-amber-600' : 'text-slate-600 dark:text-brand-300'}`}>
                  {expired
                    ? 'انتهت فترة التجربة المجانية'
                    : `تنتهي التجربة بعد ${daysLeft} ${daysLeft === 1 ? 'يوم' : 'يوم'} — ${trialEnds}`}
                </p>
              )}
              {plan !== 'trial' && (
                <p className="text-sm text-slate-500 dark:text-brand-400">
                  {currentPlanInfo.price.toLocaleString('ar-SA')} ريال / {currentPlanInfo.period}
                </p>
              )}
            </div>
          </div>

          {/* زر الترقية */}
          {(plan === 'trial' || plan === 'starter') && (
            <a
              href={upgradeUrl(plan === 'trial' ? 'الاحترافي' : 'المؤسسي')}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-[#c5a059] hover:bg-[#b8913f] text-slate-950 font-black px-5 py-3 rounded-xl transition text-sm shrink-0 shadow-lg shadow-[#c5a059]/20"
            >
              <Zap size={15} /> ترقية الباقة
            </a>
          )}
          {plan === 'trial' && daysLeft !== null && !expired && (
            <div className="md:hidden w-full">
              <div className="flex justify-between text-xs font-bold text-slate-500 mb-1">
                <span>أيام التجربة</span>
                <span>{daysLeft} / 14</span>
              </div>
              <div className="w-full h-2.5 bg-slate-100 dark:bg-brand-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${urgent ? 'bg-amber-400' : 'bg-[#c5a059]'}`}
                  style={{ width: `${Math.max(0, Math.round((daysLeft / 14) * 100))}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* شريط التقدم للأجهزة الكبيرة */}
        {plan === 'trial' && daysLeft !== null && !expired && (
          <div className="hidden md:block mt-5">
            <div className="flex justify-between text-xs font-bold text-slate-500 dark:text-brand-400 mb-1.5">
              <span>أيام التجربة المجانية المتبقية</span>
              <span>{daysLeft} من أصل 14 يوماً</span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 dark:bg-brand-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${urgent ? 'bg-amber-400' : 'bg-[#c5a059]'}`}
                style={{ width: `${Math.max(0, Math.round((daysLeft / 14) * 100))}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ─── إحصائيات الاستخدام ─── */}
      {usage && (
        <div>
          <h3 className="text-base font-black text-brand-800 dark:text-brand-100 mb-3">
            الاستخدام الحالي
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <UsageCard
              label="المستخدمون"
              used={usage.users}
              limit={usage.max_users}
              icon={Users}
              color="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
            />
            <UsageCard
              label="فواتير هذا الشهر"
              used={usage.invoices_month}
              limit={usage.max_invoices_month}
              icon={FileText}
              color="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
            />
            <UsageCard
              label="السجل التجاري المتحقق منه"
              used={usage.vat_verified ? 1 : 0}
              limit={1}
              icon={Shield}
              color="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
            />
          </div>
        </div>
      )}
      {loadingUsage && (
        <div className="flex items-center gap-2 text-slate-400 text-sm">
          <RefreshCw size={14} className="animate-spin" /> جارٍ تحميل بيانات الاستخدام…
        </div>
      )}

      {/* ─── مقارنة الباقات ─── */}
      <div>
        <h3 className="text-base font-black text-brand-800 dark:text-brand-100 mb-4">مقارنة الباقات</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {PLANS.map(p => {
            const pc = PLAN_COLOR[p.color];
            const isCurrent = p.id === plan;
            return (
              <div
                key={p.id}
                className={`relative rounded-2xl border-2 p-5 bg-white dark:bg-brand-900 transition ${pc.card} ${isCurrent ? 'ring-2 ring-[#c5a059]/40' : ''}`}
              >
                {p.recommended && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#c5a059] text-slate-950 text-[10px] font-black px-3 py-0.5 rounded-full whitespace-nowrap">
                    الأكثر شيوعاً
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 right-3 bg-green-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full">
                    باقتك الحالية
                  </div>
                )}
                <div className="mb-4">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${pc.badge}`}>{p.name}</span>
                  <div className="mt-3">
                    {p.price === 0 ? (
                      <p className="text-2xl font-black text-brand-800 dark:text-brand-50">مجاني</p>
                    ) : (
                      <>
                        <span className="text-2xl font-black text-brand-800 dark:text-brand-50">{p.price.toLocaleString('ar-SA')}</span>
                        <span className="text-slate-500 dark:text-brand-400 text-sm"> ريال/{p.period}</span>
                      </>
                    )}
                  </div>
                </div>
                <ul className="space-y-2 mb-5">
                  {p.features.map((f, i) => (
                    <li key={i} className="flex items-center gap-2 text-xs">
                      {f.ok
                        ? <CheckCircle2 size={13} className="text-green-500 shrink-0" />
                        : <XCircle size={13} className="text-slate-300 dark:text-brand-600 shrink-0" />}
                      <span className={f.ok ? 'text-brand-700 dark:text-brand-200' : 'text-slate-400 dark:text-brand-500 line-through'}>
                        {f.label}
                      </span>
                    </li>
                  ))}
                </ul>
                {!isCurrent && p.id !== 'trial' && (
                  <a
                    href={upgradeUrl(p.name)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black transition ${pc.btn} hover:opacity-90`}
                  >
                    <ExternalLink size={12} /> اشترك في {p.name}
                  </a>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── تواصل مع المبيعات ─── */}
      <div className="bg-gradient-to-l from-[#1a365d] to-[#0f2044] rounded-2xl p-6 text-white">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-black mb-1">هل تحتاج مساعدة في الاختيار؟</h3>
            <p className="text-slate-300 text-sm">فريق المبيعات جاهز للإجابة على أسئلتك ومساعدتك في اختيار الباقة الأنسب.</p>
          </div>
          <a
            href={`https://wa.me/966920032842?text=${encodeURIComponent(`أود الاستفسار عن باقات نظام ${companyName}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-[#25D366] hover:bg-[#1fa855] text-white font-black px-6 py-3 rounded-xl transition shrink-0 shadow-lg"
          >
            <MessageCircle size={16} /> تواصل معنا عبر واتساب
          </a>
        </div>
      </div>
    </div>
  );
}
