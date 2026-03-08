import React, { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, RefreshCw, Send, ListChecks, CalendarDays, HardHat, CircleCheck, Clock } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { API_URL, TIME_SLOTS } from '../../utils/helpers';

export default function Maintenance() {
  const { customer, setCustomer, showToast } = useContext(AppContext);
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("new");
  const [type, setType] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [ticket, setTicket] = useState(null);

  // حماية الصفحة: إذا مافيه عميل مسجل دخول، يرجعه لصفحة الدخول
  useEffect(() => {
    if (!customer) {
      navigate("/customer-login");
    }
  }, [customer, navigate]);

  const handleLogout = () => {
    setCustomer(null);
    showToast("تم تسجيل الخروج", "نتمنى لك يوماً سعيداً");
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
    
    const payload = {
      name: e.target.name.value,
      phone: e.target.phone.value,
      unit: e.target.unit.value,
      type: e.target.type.value,
      desc: desc
    };

    try {
      const res = await fetch(`${API_URL}?action=add_maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      
      showToast("نجاح", "تم استلام طلبك وبانتظار اعتماد الموعد من الإدارة.");
      e.target.reset();
      setDate("");
      setTime("");
      setTicket({...payload, id: result.id || Math.floor(Math.random()*1000), status: "قيد الانتظار", technician: "لم يتم التعيين", scheduleDate: date, scheduleTime: time});
      setTab("track");
    } catch {
      showToast("تنبيه", "حدث خطأ. سيتم حفظ طلبك محلياً للتجربة.", "error");
      // للتجربة في حال عدم وجود قاعدة بيانات حالياً
      setTicket({...payload, id: Math.floor(Math.random()*1000), status: "قيد الانتظار", technician: "لم يتم التعيين", scheduleDate: date, scheduleTime: time});
      setTab("track");
    } finally {
      setLoading(false);
    }
  };

  const renderTracker = () => {
    if (!ticket) return <div className="text-center py-10 text-slate-500">لا يوجد طلبات سابقة.</div>;
    
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
        <div className="flex justify-between items-start mb-10 border-b border-slate-100 pb-6">
          <div>
            <h4 className="text-2xl font-black text-[#1a365d] mb-2">طلب رقم {ticket.id}</h4>
            <p className="text-slate-500 flex items-center gap-2"><Clock size={16} /> تاريخ الطلب: {ticket.date || new Date().toLocaleDateString("ar-EG")}</p>
          </div>
          <span className="bg-[#c5a059]/10 text-[#c5a059] px-4 py-2 rounded-xl font-bold text-sm border border-[#c5a059]/20">{ticket.type}</span>
        </div>
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
                  <p className="text-slate-500 text-sm">{step.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  if (!customer) return null; // لا تعرض شيء إذا لم يكن مسجل دخول لتفادي الأخطاء قبل التوجيه

  return (
    <div className="pt-32 pb-20 bg-slate-50 min-h-screen relative flex items-center justify-center bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1581094794329-c8112a89af12?q=80&w=2070&auto=format&fit=crop')" }}>
      <div className="absolute inset-0 bg-[#1a365d]/90 backdrop-blur-sm" />
      <div className="w-full max-w-3xl px-6 relative z-10">
        <div className="text-center mb-10 text-white relative">
          <button onClick={handleLogout} className="absolute left-0 top-0 bg-red-500/20 text-red-100 hover:bg-red-500 hover:text-white px-4 py-2 rounded-xl transition text-sm font-bold flex items-center gap-2 backdrop-blur-md border border-red-500/30">
            <LogOut size={16} /> خروج
          </button>
          <h2 className="text-[#c5a059] font-black tracking-[0.1em] uppercase text-sm mb-2">بوابة العملاء</h2>
          <h3 className="text-3xl md:text-4xl font-black mb-6">إدارة طلبات الصيانة</h3>
          <div className="flex justify-center gap-4 bg-white/10 p-2 rounded-full backdrop-blur-md w-fit mx-auto border border-white/10">
            <button onClick={() => setTab("new")} className={`px-6 py-2 rounded-full font-bold text-sm transition ${tab === "new" ? "bg-[#c5a059] text-white shadow-lg" : "text-slate-300 hover:text-white"}`}>طلب جديد</button>
            <button onClick={() => setTab("track")} className={`px-6 py-2 rounded-full font-bold text-sm transition ${tab === "track" ? "bg-[#c5a059] text-white shadow-lg" : "text-slate-300 hover:text-white"}`}>متابعة طلباتي</button>
          </div>
        </div>
        {tab === "new" ? (
          <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 relative overflow-hidden animate-fade-in-up">
            <div className="absolute top-0 right-0 w-full h-2 bg-gradient-to-r from-[#c5a059] to-yellow-600" />
            <form onSubmit={submitTicket} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold mb-2 text-[#1a365d]">الاسم الكامل</label>
                  <input type="text" name="name" defaultValue={customer?.name} required className="w-full bg-slate-50 border border-slate-200 px-5 py-3 rounded-2xl outline-none focus:border-[#c5a059] transition shadow-sm" placeholder="اسمك الكريم" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 text-[#1a365d]">رقم الجوال</label>
                  <input type="tel" name="phone" required className="w-full bg-slate-50 border border-slate-200 px-5 py-3 rounded-2xl outline-none focus:border-[#c5a059] transition shadow-sm" placeholder="05xxxxxxxx" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold mb-2 text-[#1a365d]">رقم الوحدة العقارية</label>
                  <input type="text" name="unit" defaultValue={customer?.unit} readOnly={!!customer?.unit} required className={`w-full bg-slate-50 border border-slate-200 px-5 py-3 rounded-2xl outline-none transition shadow-sm ${customer?.unit ? "bg-slate-100 cursor-not-allowed text-slate-500" : "focus:border-[#c5a059]"}`} placeholder="مثال: SM-A01" />
                </div>
                <div>
                  <label className="block text-sm font-bold mb-2 text-[#1a365d]">نوع العطل</label>
                  <select name="type" required value={type} onChange={e => setType(e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-5 py-3 rounded-2xl outline-none focus:border-[#c5a059] transition shadow-sm">
                    <option value="" disabled>اختر نوع العطل...</option>
                    <option value="تكييف">تكييف</option>
                    <option value="سباكة">سباكة</option>
                    <option value="كهرباء">كهرباء</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>
              </div>
              {type && (
                <div className="bg-blue-50/50 p-6 rounded-2xl border border-blue-100 animate-fadeIn">
                  <h4 className="text-sm font-bold text-blue-800 mb-4 flex items-center gap-2"><CalendarDays size={16} /> الموعد المفضل للزيارة (حسب جدول الفني)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold mb-2 text-slate-500">التاريخ المناسب لك</label>
                      <input type="date" min={new Date().toISOString().split("T")[0]} required value={date} onChange={e => setDate(e.target.value)} className="w-full bg-white border border-blue-200 px-4 py-3 rounded-xl outline-none focus:border-blue-500 transition shadow-sm text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold mb-2 text-slate-500">الوقت المتاح المفضل</label>
                      <div className="grid grid-cols-2 gap-2">
                        {TIME_SLOTS.map(t => (
                          <div key={t} onClick={() => setTime(t)} className={`text-xs font-bold text-center py-3 rounded-xl cursor-pointer transition-all border ${time === t ? "bg-blue-600 text-white border-blue-600 shadow-md transform scale-105" : "bg-white text-slate-600 border-blue-100 hover:border-blue-300"}`}>
                            {t}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  {date && time && (
                    <div className="mt-4 text-xs text-blue-600 font-bold bg-blue-100 p-3 rounded-lg flex justify-between items-center">
                      <span>سنقوم بمراجعة الموعد وتأكيده معك.</span>
                      <span>تفضيلك: {date} | {time}</span>
                    </div>
                  )}
                </div>
              )}
              <div>
                <label className="block text-sm font-bold mb-2 text-[#1a365d]">وصف المشكلة بالتفصيل</label>
                <textarea name="desc" rows="3" required className="w-full bg-slate-50 border border-slate-200 px-5 py-3 rounded-2xl outline-none focus:border-[#c5a059] transition shadow-sm" placeholder="يرجى وصف العطل هنا..." />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-[#c5a059] text-white px-8 py-4 rounded-full font-bold hover:bg-yellow-600 transition shadow-lg shadow-[#c5a059]/20 transform hover:-translate-y-1 text-lg flex justify-center items-center gap-2">
                {loading ? <RefreshCw className="animate-spin" /> : <Send />} إرسال الطلب
              </button>
            </form>
          </div>
        ) : renderTracker()}
      </div>
    </div>
  );
}