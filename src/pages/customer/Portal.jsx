import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogOut, Wrench, Phone, Home, Clock,
  CircleCheck, ChevronLeft, HardHat,
  ListChecks, CalendarDays, MessageCircle,
  AlertCircle, Loader2,
} from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { API_URL } from '../../utils/helpers';

const STATUS_STYLE = {
  'قيد الانتظار':         'bg-amber-100 text-amber-700 border-amber-200',
  'تم التعيين':           'bg-blue-100 text-blue-700 border-blue-200',
  'تم اعتماد الموعد':     'bg-blue-100 text-blue-700 border-blue-200',
  'تم اقتراح موعد بديل':  'bg-purple-100 text-purple-700 border-purple-200',
  'جاري العمل':           'bg-indigo-100 text-indigo-700 border-indigo-200',
  'مكتمل':                'bg-green-100 text-green-700 border-green-200',
};

const STATUS_STEP = {
  'قيد الانتظار': 0,
  'تم التعيين': 1, 'تم اعتماد الموعد': 1, 'تم اقتراح موعد بديل': 1,
  'جاري العمل': 2,
  'مكتمل': 3,
};

const STEPS = [
  { Icon: ListChecks,  label: 'تم الاستلام' },
  { Icon: CalendarDays, label: 'تأكيد الموعد' },
  { Icon: HardHat,     label: 'جاري العمل' },
  { Icon: CircleCheck, label: 'مكتمل' },
];

const WhatsAppIcon = () => (
  <svg width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
    <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
  </svg>
);

export default function Portal() {
  const { customer, logout, showToast } = useContext(AppContext);
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!customer) { navigate('/customer-login'); return; }
    fetch(`${API_URL}?action=get_customer_tickets&unit=${encodeURIComponent(customer.unit)}`)
      .then(r => r.json())
      .then(d => { if (d.success) setTickets(d.data || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#0f2044] to-[#1a365d] -mt-24 pt-10 pb-20 font-cairo" dir="rtl">
      <div className="max-w-2xl mx-auto px-4 space-y-4">

        {/* ─── Header ─── */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-[#c5a059] text-xs font-bold tracking-widest uppercase mb-0.5">بوابة الملاك</p>
            <h1 className="text-white text-2xl font-black">أهلاً، {firstName} 👋</h1>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 bg-white/10 hover:bg-red-500/80 text-white px-4 py-2 rounded-xl text-sm font-bold transition border border-white/10"
          >
            <LogOut size={15} /> خروج
          </button>
        </div>

        {/* ─── Unit Card ─── */}
        <div className="bg-white/8 border border-white/10 rounded-2xl p-5 flex items-center justify-between backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#c5a059]/15 flex items-center justify-center flex-shrink-0">
              <Home size={20} className="text-[#c5a059]" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-bold">وحدتك العقارية</p>
              <p className="text-white font-black text-xl tracking-widest">{customer.unit}</p>
            </div>
          </div>
          {customer.phone && (
            <div className="text-left">
              <p className="text-slate-500 text-xs font-bold">جوال مسجل</p>
              <p className="text-slate-300 font-bold text-sm" dir="ltr">{customer.phone}</p>
            </div>
          )}
        </div>

        {/* ─── Stats ─── */}
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

        {/* ─── Active Ticket Tracker ─── */}
        {loading ? (
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

            {/* Progress bar */}
            <div className="flex items-center gap-1 mb-3">
              {STEPS.map(({ Icon }, i) => (
                <React.Fragment key={i}>
                  <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${i <= activeStep ? 'bg-[#c5a059] text-white shadow-md' : 'bg-slate-100 text-slate-400'}`}>
                    <Icon size={15} />
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`flex-1 h-1 rounded-full transition-colors ${i < activeStep ? 'bg-[#c5a059]' : 'bg-slate-100'}`} />
                  )}
                </React.Fragment>
              ))}
            </div>
            <p className="text-xs text-slate-400 font-bold">{STEPS[activeStep].label}</p>
          </div>
        ) : !loading && (
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center backdrop-blur-sm">
            <AlertCircle size={26} className="text-slate-500 mx-auto mb-2" />
            <p className="text-slate-400 font-bold text-sm">لا توجد طلبات صيانة نشطة حالياً</p>
          </div>
        )}

        {/* ─── Quick Actions ─── */}
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

        {/* ─── Recent Tickets ─── */}
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

        {/* ─── Contact ─── */}
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
