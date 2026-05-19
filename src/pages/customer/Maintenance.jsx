import React, { useState, useContext, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { LogOut, RefreshCw, Send, ListChecks, CalendarDays, HardHat, CircleCheck, Clock, Loader2, ShieldCheck } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { API_URL, TIME_SLOTS } from '../../utils/helpers';
// WhatsApp notifications are handled server-side in api.php

/* ─── فئات الضمان ─── */
const WARRANTY_CATS = [
  { key: 'electric',  years: 3,  types: ['كهرباء', 'إنارة', 'مراوح شفط', 'أفياش', 'مفاتيح'] },
  { key: 'structure', years: 10, types: ['إنشاءات', 'شبابيك', 'أبواب'] },
  { key: 'plumbing',  years: 3,  types: ['سباكة', 'خلاطات', 'شطافات', 'محابس', 'سخانات'] },
];

// يرجع مدة الضمان (بالسنوات) لنوع الطلب، أو null إذا ما ينطبق
const getWarrantyYears = (type, handoverDate) => {
  if (!handoverDate) return null;
  for (const cat of WARRANTY_CATS) {
    if (cat.types.some(t => type.includes(t))) {
      const end = new Date(handoverDate);
      end.setFullYear(end.getFullYear() + cat.years);
      return new Date() < end ? cat.years : null;
    }
  }
  return null;
};

export default function Maintenance() {
  const { customer, setCustomer, showToast } = useContext(AppContext);
  const navigate = useNavigate();
  const location = useLocation();

  const [loading, setLoading] = useState(false);
  const [qrLoading, setQrLoading] = useState(true);
  const [tab, setTab] = useState("new");
  const [handoverDate, setHandoverDate] = useState(null); // تاريخ التسليم (لحساب الضمان)
  const [warrantyYears, setWarrantyYears] = useState(null); // سنوات ضمان النوع المختار
  const [type, setType] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [guestPhone, setGuestPhone] = useState(""); // جوال العميل غير المسجل
  const [guestName,  setGuestName]  = useState(""); // اسم العميل غير المسجل
  const [ticket, setTicket] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // قراءة رابط الـ QR مرة واحدة فقط عند تغيّر الـ URL
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const unitFromQR = query.get('unit');

    if (!unitFromQR) {
      // دخل الصفحة بدون QR — وجّهه لتسجيل الدخول إذا ما عنده جلسة
      setQrLoading(false);
      if (!customer) navigate("/customer-login");
      return;
    }

    // إذا الوحدة نفسها محمّلة مسبقاً، لا تعيد الجلب
    if (customer?.unit === unitFromQR) {
      setQrLoading(false);
      return;
    }

    // جلب بيانات المالك من الـ QR
    fetch(`${API_URL}?action=get_unit_owner&unit_code=${encodeURIComponent(unitFromQR.trim())}`)
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCustomer(data.data);
          showToast("أهلاً بك", `مرحباً بك، تم التعرف على وحدتك (${unitFromQR})`, "success");
        } else {
          // وحدة بدون مالك — نضع بيانات أساسية حتى يقدر يرسل طلب
          setCustomer(
            data.data || { name: "زائر", phone: "", unit: unitFromQR }
          );
        }
      })
      .catch(() => {
        // فشل الاتصال — نعرض الصفحة بدون بيانات مالك بدل ما نخفيها
        setCustomer({ name: "زائر", phone: "", unit: unitFromQR });
      })
      .finally(() => {
        setQrLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  // جلب تاريخ التسليم عند تحميل بيانات العميل
  useEffect(() => {
    if (!customer?.unit) return;
    fetch(`${API_URL}?action=get_inspection&unit=${encodeURIComponent(customer.unit)}`)
      .then(r => r.json())
      .then(d => {
        if (d.success && d.data?.status === 'handed_over' && d.data?.client_submitted_at) {
          setHandoverDate(d.data.client_submitted_at);
        }
      })
      .catch(() => {});
  }, [customer?.unit]);

  // إعادة حساب الضمان عند تغيير نوع الطلب
  useEffect(() => {
    setWarrantyYears(getWarrantyYears(type, handoverDate));
  }, [type, handoverDate]);

  const loadHistory = async (unit) => {
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=get_customer_tickets&unit=${encodeURIComponent(unit)}`);
      const data = await res.json();
      if (data.success) setHistory(data.data);
    } catch { /* silent */ } finally {
      setHistoryLoading(false);
    }
  };

  const handleLogout = () => {
    setCustomer(null);
    showToast("تم الخروج", "نتمنى لك يوماً سعيداً");
    navigate("/");
  };

  const submitTicket = async (e) => {
    e.preventDefault();
    if (!date || !time) {
      showToast("تنبيه", "يرجى اختيار التاريخ والوقت المناسب لزيارة الفني", "error");
      return;
    }
    setLoading(true);
    
    const desc = `الوقت المفضل: ${time}\nالتاريخ المفضل: ${date}\n\nالوصف:\n${e.target.desc.value}`;
    
    // استخدام بيانات المالك المسجل أو البيانات اللي أدخلها العميل يدوياً
    const isRegistered = !!(customer.phone);
    const finalPhone = customer.phone || guestPhone;
    const finalName  = isRegistered ? customer.name : (guestName || "غير مسجل");

    const rawType = e.target.type.value;
    const payload = {
      name: finalName,
      phone: finalPhone,
      unit: e.target.unit.value,
      type: warrantyYears ? `[ضمان ${warrantyYears}س] ${rawType}` : rawType,
      desc: desc
    };

    try {
      const res = await fetch(`${API_URL}?action=add_maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await res.json();

      if(result.success) {
          showToast("نجاح", "تم استلام طلبك وبانتظار اعتماده من الإدارة.");
          // الإشعارات (إدارة + عميل) تُرسل من api.php تلقائياً
          e.target.reset();
          setDate("");
          setTime("");
          setGuestPhone("");
          setGuestName("");
          setTicket({...payload, id: result.id, status: "قيد الانتظار", technician: "لم يتم التعيين", scheduleDate: date, scheduleTime: time});
          setTab("track");
      } else {
          showToast("تنبيه", "حدث خطأ في قاعدة البيانات", "error");
      }
    } catch {
      showToast("تنبيه", "حدث خطأ في الاتصال", "error");
    } finally {
      setLoading(false);
    }
  };

  const renderTracker = () => {
    if (!ticket) return <div className="text-center py-10 text-slate-500 font-bold">لم تقم برفع أي طلب في هذه الجلسة.</div>;
    
    const steps = [
      { id: 1, label: "تم استلام الطلب", status: "قيد الانتظار", icon: ListChecks, desc: "تم استلام طلبك وبانتظار مراجعة الجدول." },
      { id: 2, label: "تأكيد الموعد والفني", status: "تم اعتماد الموعد", icon: CalendarDays, desc: `تم الاعتماد. الفني: ${ticket.technician && ticket.technician !== "لم يتم التعيين" ? ticket.technician : "سيتم التحديد"} | الموعد: ${ticket.scheduleDate || "سيتم التأكيد"} (${ticket.scheduleTime || ""})` },
      { id: 3, label: "جاري العمل", status: "جاري العمل", icon: HardHat, desc: "الفني في طريقه إليك أو يباشر العمل حالياً." },
      { id: 4, label: "مكتمل", status: "مكتمل", icon: CircleCheck, desc: "تم إغلاق الطلب، شكراً لتعاونكم." }
    ];
    
    let currentStep = 0;
    if (["تم التعيين", "تم اعتماد الموعد", "تم اقتراح موعد بديل"].includes(ticket.status)) currentStep = 1;
    if (ticket.status === "جاري العمل") currentStep = 2;
    if (ticket.status === "مكتمل") currentStep = 3;

    return (
      <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 relative overflow-hidden animate-fade-in-up">
        <div className="absolute top-0 right-0 w-full h-2 bg-[#1a365d]" />
        <div className="flex justify-between items-start mb-6 border-b border-slate-100 pb-6">
          <div>
            <h4 className="text-2xl font-black text-[#1a365d] mb-2">طلب رقم {ticket.id}</h4>
            <p className="text-slate-500 flex items-center gap-2 font-bold text-sm"><Clock size={16} /> الموعد المفضل: {ticket.scheduleDate}</p>
          </div>
          <span className="bg-[#c5a059]/10 text-[#c5a059] px-4 py-2 rounded-xl font-bold text-sm border border-[#c5a059]/20">{ticket.type}</span>
        </div>
        {/* زر واتساب لفتح نافذة المحادثة — يضمن وصول الإشعارات التلقائية */}
        <a
          href={`https://wa.me/966550163121?text=${encodeURIComponent(`مرحباً، أودّ متابعة طلب الصيانة رقم #${ticket.id} للوحدة ${ticket.unit}`)}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center justify-center gap-2 w-full mb-6 bg-green-500 hover:bg-green-600 text-white font-black py-3 rounded-2xl transition shadow"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          تواصل معنا عبر واتساب لاستلام التحديثات
        </a>
        <div className="timeline-container pr-4">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const isPast = i <= currentStep;
            const isCurrent = i === currentStep;
            return (
              <div key={step.id} className="timeline-item">
                <div className={`timeline-icon ${isPast ? "bg-[#c5a059] text-white shadow-lg shadow-orange-200" : "bg-slate-200 text-slate-400"}`}>
                  <Icon size={16} />
                </div>
                <div className={`bg-slate-50 rounded-2xl p-5 border ${isCurrent ? "border-[#c5a059] shadow-md" : "border-slate-100"} transition-all`}>
                  <h5 className={`font-bold text-lg mb-1 ${isCurrent ? "text-[#c5a059]" : "text-[#1a365d]"}`}>{step.label}</h5>
                  <p className="text-slate-500 text-sm font-bold">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (qrLoading) {
      return (
          <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white font-cairo">
              <div className="text-center">
                  <Loader2 className="animate-spin text-[#c5a059] mx-auto mb-4" size={48} />
                  <p className="font-bold text-lg">جاري مسح الوحدة وتهيئة النظام...</p>
              </div>
          </div>
      );
  }

  if (!customer) return null;

  return (
    <div className="pt-32 pb-20 bg-slate-50 min-h-screen relative flex items-center justify-center bg-cover bg-center font-cairo" style={{ backgroundImage: "url('/images/maintenance-bg.jpg')" }}>
      <div className="absolute inset-0 bg-[#1a365d]/90 backdrop-blur-sm" />
      <div className="w-full max-w-3xl px-6 relative z-10">
        <div className="text-center mb-10 text-white relative">
          <button onClick={handleLogout} className="absolute left-0 top-0 bg-red-500/20 text-red-100 hover:bg-red-500 hover:text-white px-4 py-2 rounded-xl transition text-sm font-bold flex items-center gap-2 backdrop-blur-md border border-red-500/30">
            <LogOut size={16} /> خروج
          </button>
          <h2 className="text-[#c5a059] font-black tracking-[0.1em] uppercase text-sm mb-2">بوابة الملاك</h2>
          <h3 className="text-3xl md:text-4xl font-black mb-6">طلب صيانة سريع</h3>
          <div className="flex justify-center gap-2 bg-white/10 p-2 rounded-full backdrop-blur-md w-fit mx-auto border border-white/10">
            <button onClick={() => setTab("new")} className={`px-5 py-2 rounded-full font-bold text-sm transition ${tab === "new" ? "bg-[#c5a059] text-white shadow-lg" : "text-slate-300 hover:text-white"}`}>رفع طلب</button>
            <button onClick={() => setTab("track")} className={`px-5 py-2 rounded-full font-bold text-sm transition ${tab === "track" ? "bg-[#c5a059] text-white shadow-lg" : "text-slate-300 hover:text-white"}`}>آخر طلب</button>
            <button onClick={() => { setTab("history"); loadHistory(customer.unit); }} className={`px-5 py-2 rounded-full font-bold text-sm transition ${tab === "history" ? "bg-[#c5a059] text-white shadow-lg" : "text-slate-300 hover:text-white"}`}>سجل طلباتي</button>
          </div>
        </div>
        {tab === "history" ? (
          <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border border-slate-100 animate-fade-in-up">
            <div className="absolute top-0 right-0 w-full h-2 bg-gradient-to-r from-[#1a365d] to-[#c5a059]" />
            <h4 className="text-xl font-black text-[#1a365d] mb-6 flex items-center gap-2">
              <ListChecks size={22} className="text-[#c5a059]" /> سجل جميع طلبات الصيانة
            </h4>
            {historyLoading ? (
              <div className="text-center py-10"><Loader2 className="animate-spin text-[#c5a059] mx-auto" size={36} /></div>
            ) : history.length === 0 ? (
              <p className="text-center text-slate-400 font-bold py-10">لا توجد طلبات سابقة لهذه الوحدة.</p>
            ) : (
              <div className="space-y-4">
                {history.map(t => {
                  const statusColors = {
                    "مكتمل": "bg-green-100 text-green-700",
                    "جاري العمل": "bg-blue-100 text-blue-700",
                    "قيد الانتظار": "bg-orange-100 text-orange-700",
                  };
                  const color = statusColors[t.status] || "bg-slate-100 text-slate-600";
                  return (
                    <div key={t.id} className="flex items-center justify-between bg-slate-50 p-4 rounded-2xl border border-slate-100">
                      <div>
                        <span className="text-xs text-slate-400 font-bold">#{t.id}</span>
                        <p className="font-black text-[#1a365d] mt-0.5">{t.type}</p>
                        <p className="text-xs text-slate-500 mt-1">{t.date ? t.date.split(" ")[0] : ""}</p>
                      </div>
                      <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${color}`}>{t.status || "قيد الانتظار"}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : tab === "new" ? (
          <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 relative overflow-hidden animate-fade-in-up">
            <div className="absolute top-0 right-0 w-full h-2 bg-gradient-to-r from-[#c5a059] to-yellow-600" />
            
            {/* معلومات الوحدة */}
            <div className={`p-4 rounded-2xl mb-6 border flex flex-col md:flex-row gap-4 items-center justify-between ${customer.phone ? 'bg-slate-50 border-slate-200' : 'bg-amber-50 border-amber-200'}`}>
                <div>
                    <p className="text-xs text-slate-500 font-bold">{customer.phone ? 'المالك المسجل:' : 'الوحدة:'}</p>
                    <p className="text-[#1a365d] font-black text-lg">
                        {customer.phone ? customer.name : `وحدة ${customer.unit}`}
                    </p>
                    {customer.phone && (
                        <p className="text-xs text-slate-400 font-bold" dir="ltr">{customer.phone}</p>
                    )}
                </div>
                <div className="bg-[#1a365d] text-white px-4 py-2 rounded-xl text-center">
                    <p className="text-[10px] text-slate-300 font-bold">رقم الوحدة</p>
                    <p className="font-black tracking-widest text-[#c5a059]">{customer.unit}</p>
                </div>
            </div>

            <form onSubmit={submitTicket} className="space-y-6">
              {/* الخانات المخفية */}
              <input type="hidden" name="unit" value={customer.unit} />

              {/* حقول الاسم والجوال — تظهر فقط إذا الوحدة ما عندها مالك مسجل */}
              {!customer.phone && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
                  <p className="text-sm font-black text-amber-800 flex items-center gap-2">
                    ⚠️ هذه الوحدة غير مسجلة — يرجى إدخال بياناتك
                  </p>
                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-amber-700">الاسم الكامل</label>
                    <input
                      type="text"
                      required
                      value={guestName}
                      onChange={e => setGuestName(e.target.value)}
                      placeholder="أدخل اسمك الكامل"
                      className="w-full bg-white border border-amber-300 px-4 py-3 rounded-xl outline-none focus:border-amber-500 transition font-bold text-slate-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold mb-1.5 text-amber-700">رقم الجوال (واتساب)</label>
                    <input
                      type="tel"
                      required
                      value={guestPhone}
                      onChange={e => setGuestPhone(e.target.value)}
                      placeholder="05XXXXXXXX"
                      dir="ltr"
                      className="w-full bg-white border border-amber-300 px-4 py-3 rounded-xl outline-none focus:border-amber-500 transition font-bold text-slate-700 text-left"
                    />
                  </div>
                  <p className="text-xs text-amber-600 font-bold">
                    ستصلك رسالة واتساب بتحديثات طلبك على هذا الرقم
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-bold mb-2 text-[#1a365d]">نوع العطل</label>
                <select name="type" required value={type} onChange={e => setType(e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-5 py-4 rounded-2xl outline-none focus:border-[#c5a059] transition shadow-sm font-bold text-slate-700">
                  <option value="" disabled>-- اختر نوع العطل --</option>
                  <optgroup label="⚡ كهرباء وإنارة (ضمان 3 سنوات)">
                    <option value="إنارة">مشكلة في الإنارة 💡</option>
                    <option value="مراوح شفط">مراوح شفط 🌀</option>
                    <option value="أفياش">أفياش ومقابس 🔌</option>
                    <option value="مفاتيح">مفاتيح كهربائية 🔘</option>
                    <option value="كهرباء">كهرباء عامة ⚡</option>
                  </optgroup>
                  <optgroup label="🏗️ إنشاءات (ضمان 10 سنوات)">
                    <option value="شبابيك">شبابيك 🪟</option>
                    <option value="أبواب">أبواب 🚪</option>
                    <option value="إنشاءات">إنشاءات عامة 🏗️</option>
                  </optgroup>
                  <optgroup label="🚰 سباكة (ضمان 3 سنوات)">
                    <option value="خلاطات">خلاطات 🚿</option>
                    <option value="شطافات">شطافات 🚽</option>
                    <option value="محابس">محابس 🔧</option>
                    <option value="سخانات">سخانات ♨️</option>
                    <option value="سباكة">سباكة عامة 🚰</option>
                  </optgroup>
                  <optgroup label="🔧 أخرى">
                    <option value="تكييف">تكييف ❄️</option>
                    <option value="أخرى">أخرى (يرجى التوضيح) 🛠️</option>
                  </optgroup>
                </select>
              </div>
              
              {type && (
                <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 animate-fadeIn">
                  <h4 className="text-sm font-bold text-blue-800 mb-4 flex items-center gap-2"><CalendarDays size={16} /> متى يناسبك زيارة الفني؟</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold mb-2 text-slate-500">التاريخ</label>
                      <input type="date" min={new Date().toISOString().split("T")[0]} required value={date} onChange={e => setDate(e.target.value)} className="w-full bg-white border border-blue-200 px-4 py-3 rounded-xl outline-none focus:border-blue-500 transition shadow-sm text-sm font-bold text-slate-700" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-2 text-slate-500">الوقت المتاح</label>
                      <div className="grid grid-cols-2 gap-2">
                        {TIME_SLOTS.map(t => (
                          <div key={t} onClick={() => setTime(t)} className={`text-[10px] md:text-xs font-bold text-center py-3 px-1 rounded-xl cursor-pointer transition-all border ${time === t ? "bg-blue-600 text-white border-blue-600 shadow-md transform scale-105" : "bg-white text-slate-600 border-blue-100 hover:border-blue-300"}`}>
                            {t}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-bold mb-2 text-[#1a365d]">وصف المشكلة (اختياري)</label>
                <textarea name="desc" rows="3" className="w-full bg-slate-50 border border-slate-200 px-5 py-3 rounded-2xl outline-none focus:border-[#c5a059] transition shadow-sm font-bold text-slate-700" placeholder="أخبرنا بالمزيد من التفاصيل لمساعدة الفني..." />
              </div>
              
              {/* شارة الضمان — تظهر فقط إذا اختار نوعاً يقع ضمن الضمان */}
              {warrantyYears && (
                <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-2xl px-4 py-3">
                  <ShieldCheck size={20} className="text-green-600 flex-shrink-0" />
                  <div>
                    <p className="text-green-700 text-sm font-black">هذا النوع مشمول بضمان {warrantyYears} سنوات</p>
                    <p className="text-green-600 text-xs font-bold">ستُعالَج بأولوية عالية على حسابنا</p>
                  </div>
                </div>
              )}

              <button type="submit" disabled={loading} className={`w-full text-white px-8 py-4 rounded-full font-black transition shadow-lg transform hover:-translate-y-1 text-lg flex justify-center items-center gap-2
                ${warrantyYears ? 'bg-green-600 hover:bg-green-700 shadow-green-600/20' : 'bg-[#1a365d] hover:bg-[#112240] shadow-[#1a365d]/20'}`}>
                {loading ? <RefreshCw className="animate-spin" /> : warrantyYears ? <ShieldCheck /> : <Send />}
                {warrantyYears ? `إرسال طلب ضمان (${warrantyYears} سنوات)` : 'إرسال الطلب للفني'}
              </button>
            </form>
          </div>
        ) : renderTracker()}
      </div>
    </div>
  );
}