import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, Wrench, Phone, Home, Clock,
  CircleCheck, ChevronLeft, HardHat,
  ListChecks, CalendarDays, MessageCircle,
  AlertCircle, Loader2, Key, FileCheck,
  CheckCircle2, ArrowLeft, Star, Bell,
  Building2, ShieldCheck, CalendarClock,
  Zap, DoorOpen, Droplets,
} from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { API_URL } from '../../utils/helpers';

/* ─── الحالات وألوانها ─── */
const STATUS_STYLE = {
  'قيد الانتظار':          'bg-amber-100 text-amber-700 border-amber-200',
  'تم التعيين':            'bg-blue-100 text-blue-700 border-blue-200',
  'تم اعتماد الموعد':      'bg-blue-100 text-blue-700 border-blue-200',
  'تم اقتراح موعد بديل':  'bg-purple-100 text-purple-700 border-purple-200',
  'جاري العمل':            'bg-indigo-100 text-indigo-700 border-indigo-200',
  'مكتمل':                 'bg-green-100 text-green-700 border-green-200',
};

const STATUS_STEP = {
  'قيد الانتظار': 0,
  'تم التعيين': 1, 'تم اعتماد الموعد': 1, 'تم اقتراح موعد بديل': 1,
  'جاري العمل': 2,
  'مكتمل': 3,
};

const MAINT_STEPS = [
  { Icon: ListChecks,   label: 'تم الاستلام'  },
  { Icon: CalendarDays, label: 'تأكيد الموعد' },
  { Icon: HardHat,      label: 'جاري العمل'   },
  { Icon: CircleCheck,  label: 'مكتمل'        },
];

/* ─── مراحل رحلة التسليم ─── */
const JOURNEY = [
  { id: 'registered',       icon: Home,        label: 'تسجيل الوحدة' },
  { id: 'inspecting',       icon: HardHat,     label: 'فحص الشركة'   },
  { id: 'client_ready',     icon: FileCheck,   label: 'مراجعتك'      },
  { id: 'handed_over',      icon: Key,         label: 'التسليم'      },
];

const journeyStageIndex = (inspectionStatus) => {
  if (!inspectionStatus)                          return 1; // inspecting
  if (inspectionStatus === 'client_ready')        return 2;
  if (inspectionStatus === 'client_submitted')    return 2; // submitted snags, still in review
  if (inspectionStatus === 'handed_over')         return 3;
  return 1;
};

/* ─── أيقونة واتساب ─── */
const WhatsAppIcon = () => (
  <svg width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
    <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
  </svg>
);

/* ─── فئات الضمان ─── */
const WARRANTY_CATS = [
  {
    key:    'electric',
    label:  'كهرباء وإنارة',
    icon:   Zap,
    years:  3,
    color:  'amber',
    items:  ['إنارة', 'مراوح شفط', 'أفياش', 'مفاتيح'],
    types:  ['كهرباء', 'إنارة', 'مراوح شفط', 'أفياش', 'مفاتيح'],
  },
  {
    key:    'structure',
    label:  'إنشاءات',
    icon:   DoorOpen,
    years:  10,
    color:  'blue',
    items:  ['شبابيك', 'أبواب'],
    types:  ['إنشاءات', 'شبابيك', 'أبواب'],
  },
  {
    key:    'plumbing',
    label:  'سباكة',
    icon:   Droplets,
    years:  3,
    color:  'cyan',
    items:  ['خلاطات', 'شطافات', 'محابس', 'سخانات'],
    types:  ['سباكة', 'خلاطات', 'شطافات', 'محابس', 'سخانات'],
  },
];

const COLOR_MAP = {
  amber: { bg: 'bg-amber-50', text: 'text-amber-600', bar: 'bg-amber-500', badge: 'bg-amber-50 text-amber-600 border-amber-200', icon: 'bg-amber-50' },
  blue:  { bg: 'bg-blue-50',  text: 'text-blue-600',  bar: 'bg-blue-500',  badge: 'bg-blue-50 text-blue-600 border-blue-200',   icon: 'bg-blue-50'  },
  cyan:  { bg: 'bg-cyan-50',  text: 'text-cyan-600',  bar: 'bg-cyan-500',  badge: 'bg-cyan-50 text-cyan-600 border-cyan-200',   icon: 'bg-cyan-50'  },
};

function calcWarranty(start, years) {
  const end      = new Date(start);
  end.setFullYear(end.getFullYear() + years);
  const now      = new Date();
  const totalMs  = end - start;
  const usedMs   = Math.min(now - start, totalMs);
  const remainMs = Math.max(end - now, 0);
  return {
    end,
    isActive:    now < end,
    usedPct:     Math.min(Math.round((usedMs / totalMs) * 100), 100),
    remainDays:  Math.ceil(remainMs / (1000 * 60 * 60 * 24)),
    remainYears: (remainMs / (1000 * 60 * 60 * 24 * 365)).toFixed(1),
  };
}

/* ─── مكوّن بطاقة الضمان ─── */
function WarrantyCard({ handoverDate, onRequestMaintenance }) {
  const start = new Date(handoverDate);
  const fmt   = (d) => d.toLocaleDateString('ar-SA', { year: 'numeric', month: 'short', day: 'numeric' });
  const hasAnyActive = WARRANTY_CATS.some(c => calcWarranty(start, c.years).isActive);

  return (
    <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
      <div className="h-1.5 bg-gradient-to-r from-[#c5a059] via-amber-400 to-[#c5a059]" />
      <div className="p-5">

        {/* العنوان */}
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-10 h-10 rounded-xl bg-[#c5a059]/10 flex items-center justify-center flex-shrink-0">
            <ShieldCheck size={20} className="text-[#c5a059]" />
          </div>
          <div>
            <p className="text-[#1a365d] font-black text-sm">ضمانات وحدتك</p>
            <p className="text-slate-400 text-xs font-bold">من تاريخ التسليم: {fmt(start)}</p>
          </div>
        </div>

        {/* فئات الضمان */}
        <div className="space-y-3 mb-4">
          {WARRANTY_CATS.map(({ key, label, icon: Icon, years, color, items }) => {
            const { end, isActive, usedPct, remainDays, remainYears } = calcWarranty(start, years);
            const c = COLOR_MAP[color];
            return (
              <div key={key} className={`rounded-xl border p-3.5 ${isActive ? 'border-slate-100' : 'border-red-100 opacity-60'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg ${c.icon} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={15} className={c.text} />
                    </div>
                    <div>
                      <p className="text-[#1a365d] font-black text-xs">{label}</p>
                      <p className="text-slate-400 text-[10px] font-bold">{items.join(' · ')}</p>
                    </div>
                  </div>
                  <div className="text-left flex-shrink-0">
                    <span className={`text-[10px] font-black px-2 py-1 rounded-full border ${isActive ? c.badge : 'bg-red-50 text-red-500 border-red-200'}`}>
                      {isActive ? `● ${years} سنوات` : '✕ منتهي'}
                    </span>
                  </div>
                </div>

                {/* شريط التقدم */}
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1.5">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${isActive ? c.bar : 'bg-red-300'}`}
                    style={{ width: `${usedPct}%` }}
                  />
                </div>
                <div className="flex justify-between text-[9px] font-bold text-slate-400">
                  <span dir="ltr">{fmt(start)}</span>
                  {isActive
                    ? <span className={c.text}>متبقي {remainDays > 365 ? `${remainYears} سنة` : `${remainDays} يوم`}</span>
                    : <span className="text-red-400">انتهى {fmt(end)}</span>
                  }
                </div>
              </div>
            );
          })}
        </div>

        {/* زر الصيانة */}
        <button
          onClick={onRequestMaintenance}
          className={`w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all ${
            hasAnyActive
              ? 'bg-[#1a365d] hover:bg-[#c5a059] text-white shadow-md hover:-translate-y-0.5'
              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
          }`}
        >
          <Wrench size={16} />
          {hasAnyActive ? 'رفع تذكرة صيانة (ضمان)' : 'رفع طلب صيانة'}
        </button>
      </div>
    </div>
  );
}

export default function Portal() {
  const { customer, logout, showToast } = useContext(AppContext);
  const navigate = useNavigate();

  const [tickets,    setTickets]    = useState([]);
  const [inspection, setInspection] = useState(null); // null = لم يُجلب بعد
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!customer) { navigate('/customer-login'); return; }

    const fetchAll = async () => {
      try {
        const [ticketRes, inspRes] = await Promise.all([
          fetch(`${API_URL}?action=get_customer_tickets&unit=${encodeURIComponent(customer.unit)}`),
          fetch(`${API_URL}?action=get_inspection&unit=${encodeURIComponent(customer.unit)}`),
        ]);
        const ticketData = await ticketRes.json();
        const inspData   = await inspRes.json();
        if (ticketData.success) setTickets(ticketData.data || []);
        setInspection(inspData.success ? inspData.data : false); // false = لا يوجد فحص
      } catch {
        setInspection(false);
      } finally {
        setDataLoading(false);
      }
    };

    fetchAll();
  }, [customer, navigate]);

  const handleLogout = () => {
    logout();
    showToast('تم الخروج', 'نتمنى لك يوماً سعيداً');
    navigate('/');
  };

  if (!customer) return null;

  const activeTickets = tickets.filter(t => t.status !== 'مكتمل');
  const latestActive  = activeTickets[0] ?? null;
  const activeStep    = latestActive ? (STATUS_STEP[latestActive.status] ?? 0) : 0;
  const firstName     = customer.name?.split(' ')[0] || customer.name;

  /* ─── مرحلة رحلة التسليم ─── */
  const inspStatus   = inspection ? inspection.status : null;
  const stageIdx     = inspection === false ? 0 : journeyStageIndex(inspStatus);
  // false = API رجع فشل (لا يوجد فحص بعد) → مرحلة الانتظار
  // null  = لم يُجلب بعد (loading)

  const isHandedOver    = inspStatus === 'handed_over';
  const isClientReady   = inspStatus === 'client_ready';
  const isSnagSubmitted = inspStatus === 'client_submitted';

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f2044] to-[#1a365d] -mt-24 pt-10 pb-24 font-cairo" dir="rtl">
      <div className="max-w-2xl mx-auto px-4 space-y-4">

        {/* ─── Header ─── */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[#c5a059] text-xs font-bold tracking-widest uppercase mb-0.5">بوابة الملاك</p>
            <h1 className="text-white text-2xl font-black">
              أهلاً، {firstName} 👋
            </h1>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-white/10 hover:bg-red-500/80 text-white px-4 py-2 rounded-xl text-sm font-bold transition border border-white/10"
          >
            <LogOut size={15} /> خروج
          </button>
        </div>

        {/* ─── بطاقة الوحدة ─── */}
        <div className="bg-white/10 border border-white/10 rounded-2xl p-5 flex items-center justify-between backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#c5a059]/20 flex items-center justify-center flex-shrink-0">
              <Building2 size={20} className="text-[#c5a059]" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-bold">وحدتك العقارية</p>
              <p className="text-white font-black text-xl tracking-widest">{customer.unit}</p>
              {customer.project && <p className="text-slate-400 text-xs mt-0.5">{customer.project}</p>}
            </div>
          </div>
          {isHandedOver && (
            <div className="flex items-center gap-1.5 bg-green-500/20 text-green-400 text-xs font-bold px-3 py-1.5 rounded-full border border-green-500/30">
              <CheckCircle2 size={13} /> مُسلَّمة
            </div>
          )}
        </div>

        {/* ══════════ رحلة التسليم ══════════ */}
        <div className="bg-white/8 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
          <p className="text-[#c5a059] text-xs font-bold tracking-widest uppercase mb-4 flex items-center gap-2">
            <Star size={12} /> رحلة وحدتك
          </p>

          {/* شريط المراحل */}
          <div className="flex items-center gap-1 mb-4">
            {JOURNEY.map(({ icon: Icon, label }, i) => {
              const done    = i < stageIdx;
              const current = i === stageIdx;
              const pending = i > stageIdx;
              return (
                <React.Fragment key={i}>
                  <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300
                      ${done    ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' : ''}
                      ${current ? 'bg-[#c5a059] text-white shadow-lg shadow-[#c5a059]/40 scale-110' : ''}
                      ${pending ? 'bg-white/10 text-white/30' : ''}
                    `}>
                      {done ? <CheckCircle2 size={18} /> : <Icon size={16} />}
                    </div>
                    <p className={`text-[10px] font-bold text-center leading-tight w-14
                      ${done ? 'text-green-400' : ''}
                      ${current ? 'text-[#c5a059]' : ''}
                      ${pending ? 'text-white/30' : ''}
                    `}>{label}</p>
                  </div>
                  {i < JOURNEY.length - 1 && (
                    <div className={`flex-1 h-[2px] rounded-full mb-5 transition-all duration-500
                      ${i < stageIdx ? 'bg-green-500' : 'bg-white/10'}
                    `} />
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {/* نص المرحلة الحالية */}
          {dataLoading ? (
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
              <Loader2 size={14} className="animate-spin" /> جاري تحميل حالة وحدتك...
            </div>
          ) : isHandedOver ? (
            <div className="flex items-center gap-2 bg-green-500/10 text-green-400 text-sm font-bold px-3 py-2 rounded-xl border border-green-500/20">
              <CheckCircle2 size={16} /> تم تسليم وحدتك رسمياً — مرحباً بك كمالك
            </div>
          ) : isSnagSubmitted ? (
            <div className="flex items-center gap-2 bg-amber-500/10 text-amber-400 text-sm font-bold px-3 py-2 rounded-xl border border-amber-500/20">
              <Clock size={16} /> تم استلام ملاحظاتك — الفريق يعمل على معالجتها
            </div>
          ) : isClientReady ? (
            <div className="flex items-center gap-2 bg-[#c5a059]/10 text-[#c5a059] text-sm font-bold px-3 py-2 rounded-xl border border-[#c5a059]/20">
              <Bell size={16} className="animate-pulse" /> وحدتك جاهزة — ابدأ مراجعتك الآن
            </div>
          ) : inspection === false ? (
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
              <Clock size={14} /> وحدتك قيد التجهيز — سنُبلغك عند الجاهزية
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400 text-xs font-bold">
              <HardHat size={14} /> الفريق الهندسي يفحص وحدتك حالياً
            </div>
          )}
        </div>

        {/* ══════════ بطاقة مراجعة الوحدة (عند الجاهزية) ══════════ */}
        {isClientReady && (
          <div className="bg-gradient-to-l from-[#c5a059] to-[#e8c97a] rounded-2xl p-5 shadow-xl shadow-[#c5a059]/20">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <FileCheck size={20} className="text-white" />
              </div>
              <div>
                <p className="text-white font-black text-base">وحدتك جاهزة للمراجعة!</p>
                <p className="text-white/80 text-xs mt-0.5 leading-relaxed">
                  أتم الفريق الهندسي فحص وحدتك. راجع النتائج ووقّع إلكترونياً على وثيقة الاستلام.
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate(`/handover?unit=${encodeURIComponent(customer.unit)}`)}
              className="w-full bg-white text-[#1a365d] py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-[#1a365d] hover:text-white transition-all duration-200 shadow-lg"
            >
              ابدأ مراجعة وحدتك <ArrowLeft size={16} />
            </button>
          </div>
        )}

        {/* بطاقة التسليم المكتمل */}
        {isHandedOver && (
          <div className="bg-gradient-to-l from-green-600 to-emerald-500 rounded-2xl p-5 shadow-xl shadow-green-500/20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Key size={22} className="text-white" />
              </div>
              <div>
                <p className="text-white font-black text-base">تم تسليم وحدتك 🎉</p>
                <p className="text-white/80 text-xs mt-0.5">
                  أنت الآن مالك رسمي — مرحباً بك في عائلة سماك العقارية
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ══════════ بطاقة الضمان (بعد التسليم) ══════════ */}
        {isHandedOver && inspection?.client_submitted_at && (
          <WarrantyCard
            handoverDate={inspection.client_submitted_at}
            onRequestMaintenance={() => navigate('/maintenance')}
          />
        )}

        {/* ─── إحصائيات ─── */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center backdrop-blur-sm">
            <p className="text-3xl font-black text-[#c5a059]">{tickets.length}</p>
            <p className="text-slate-400 text-xs font-bold mt-1">إجمالي الطلبات</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center backdrop-blur-sm">
            <p className="text-3xl font-black text-blue-400">{activeTickets.length}</p>
            <p className="text-slate-400 text-xs font-bold mt-1">طلبات نشطة</p>
          </div>
        </div>

        {/* ─── متابع الطلب النشط ─── */}
        {dataLoading ? (
          <div className="bg-white/5 rounded-2xl p-8 flex justify-center">
            <Loader2 className="animate-spin text-[#c5a059]" size={32} />
          </div>
        ) : latestActive ? (
          <div className="bg-white rounded-2xl p-5 shadow-xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-xs text-slate-400 font-bold mb-0.5">الطلب النشط</p>
                <p className="text-[#1a365d] font-black text-lg">#{latestActive.id} — {latestActive.type}</p>
                {latestActive.technician && latestActive.technician !== 'لم يتم التعيين' && (
                  <p className="text-slate-500 text-xs font-bold mt-0.5">الفني: {latestActive.technician}</p>
                )}
              </div>
              <span className={`text-xs px-3 py-1.5 rounded-full font-bold border flex-shrink-0 ${STATUS_STYLE[latestActive.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                {latestActive.status}
              </span>
            </div>
            <div className="flex items-center gap-1 mb-3">
              {MAINT_STEPS.map(({ Icon }, i) => (
                <React.Fragment key={i}>
                  <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${i <= activeStep ? 'bg-[#c5a059] text-white shadow-md' : 'bg-slate-100 text-slate-400'}`}>
                    <Icon size={15} />
                  </div>
                  {i < MAINT_STEPS.length - 1 && (
                    <div className={`flex-1 h-1 rounded-full transition-colors ${i < activeStep ? 'bg-[#c5a059]' : 'bg-slate-100'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
            <p className="text-xs text-slate-400 font-bold">{MAINT_STEPS[activeStep].label}</p>
          </div>
        ) : (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center backdrop-blur-sm">
            <AlertCircle size={26} className="text-slate-500 mx-auto mb-2" />
            <p className="text-slate-400 font-bold text-sm">لا توجد طلبات صيانة نشطة حالياً</p>
          </div>
        )}

        {/* ─── الإجراءات السريعة ─── */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => navigate('/maintenance')}
            className="bg-[#c5a059] hover:bg-[#d4b570] text-white rounded-2xl p-5 flex flex-col items-center gap-2 font-bold transition shadow-lg shadow-[#c5a059]/20 hover:-translate-y-0.5 active:scale-95"
          >
            <Wrench size={24} />
            <span className="text-sm">طلب صيانة</span>
          </button>
          <a
            href={`https://wa.me/966920032842?text=${encodeURIComponent(`مرحباً، أنا ${customer.name} مالك الوحدة ${customer.unit}، أود الاستفسار`)}`}
            target="_blank"
            rel="noreferrer"
            className="bg-[#25D366] hover:bg-[#1fba5a] text-white rounded-2xl p-5 flex flex-col items-center gap-2 font-bold transition shadow-lg hover:-translate-y-0.5 active:scale-95"
          >
            <WhatsAppIcon />
            <span className="text-sm">تواصل معنا</span>
          </a>
        </div>

        {/* ─── آخر الطلبات ─── */}
        {tickets.length > 0 && (
          <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-[#1a365d] font-black text-base">آخر الطلبات</h3>
              <button
                onClick={() => navigate('/maintenance')}
                className="text-[#c5a059] text-xs font-bold flex items-center gap-1 hover:underline"
              >
                عرض الكل <ChevronLeft size={13} />
              </button>
            </div>
            <div className="divide-y divide-slate-50">
              {tickets.slice(0, 4).map(t => (
                <div key={t.id} className="px-5 py-3.5 flex items-center justify-between">
                  <div>
                    <p className="text-[#1a365d] font-black text-sm">{t.type}</p>
                    <p className="text-slate-400 text-xs font-bold flex items-center gap-1 mt-0.5">
                      <Clock size={10} /> #{t.id} · {t.date?.split(' ')[0] || ''}
                    </p>
                  </div>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-bold border flex-shrink-0 ${STATUS_STYLE[t.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {t.status || 'قيد الانتظار'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── التواصل ─── */}
        <a
          href="tel:920032842"
          className="flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl px-5 py-4 text-slate-300 hover:text-white transition group"
        >
          <div className="w-10 h-10 rounded-xl bg-[#c5a059]/10 group-hover:bg-[#c5a059]/20 flex items-center justify-center flex-shrink-0 transition-colors">
            <Phone size={18} className="text-[#c5a059]" />
          </div>
          <div>
            <p className="text-xs text-slate-500 font-bold">الهاتف الموحد</p>
            <p className="font-black text-sm" dir="ltr">920032842</p>
          </div>
          <MessageCircle size={16} className="mr-auto text-slate-600 group-hover:text-slate-400 transition-colors" />
        </a>

      </div>
    </div>
  );
}
