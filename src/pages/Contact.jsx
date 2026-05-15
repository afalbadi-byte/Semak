import React, { useState, useContext, useEffect } from 'react';
import { Phone, MapPin, Send, RefreshCw, MessageCircle, Mail, Clock } from 'lucide-react';
import { API_URL } from '../utils/helpers';
import PageMeta from '../components/PageMeta';
import { AppContext } from '../context/AppContext';
import { notifyAdmin, replyToClient } from '../services/whatsappService';

const ALL_UNITS = ["SM-A01","SM-A02","SM-A03","SM-A04","SM-A05","SM-A06","SM-A07"];

export default function Contact() {
  const { showToast } = useContext(AppContext);
  const [loading, setLoading] = useState(false);
  const [soldUnits, setSoldUnits] = useState({});

  useEffect(() => {
    fetch(`${API_URL}?action=get_units_status`)
      .then(r => r.json())
      .then(d => { if (d.success) setSoldUnits(d.data); })
      .catch(() => {});
  }, []);

  // رقم خدمة العملاء الموحد
  const supportPhone = "920032842";
  // صيغة الواتساب الصحيحة للسعودية (+966)
  const waPhone = "966920032842"; 
  const waMessage = encodeURIComponent("مرحباً، أود الاستفسار عن خدمات ومشاريع سماك العقارية.");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    const rawPhone = e.target.phone.value.trim();
    if (!/^[0-9+\-\s()]{7,15}$/.test(rawPhone)) {
      showToast("تنبيه", "رقم الجوال غير صحيح", "error");
      setLoading(false);
      return;
    }

    const payload = {
      name: e.target.name.value.trim(),
      phone: rawPhone,
      interest: e.target.unit.value,
      source: "الموقع الإلكتروني"
    };

    try {
      const response = await fetch(`${API_URL}?action=add_lead`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (data.success) {
        showToast("تم الإرسال بنجاح", "شكراً لاهتمامك، سيتم التواصل معك قريباً.", "success");
        // إرسال إشعار واتساب للإدارة + رد ترحيبي للعميل
        await Promise.allSettled([
          notifyAdmin({ id: data.id, name: payload.name, phone: payload.phone, interest: payload.interest }),
          replyToClient(payload.phone, payload.name),
        ]);
        e.target.reset();
      } else { throw new Error("فشل"); }
    } catch (error) {
      showToast("تنبيه", "حدث خطأ في الاتصال، يرجى المحاولة لاحقاً.", "error");
    } finally { setLoading(false); }
  };

  return (
    <>
    <PageMeta title="تواصل معنا" description="تواصل مع سماك العقارية لحجز وحدتك أو الاستفسار — الرقم الموحد 920032842، أو راسلنا على واتساب." />
    <div className="pt-32 pb-20 min-h-screen relative flex items-center bg-cover bg-center animate-fadeIn" style={{ backgroundImage: `url('/images/contact-bg.jpg')` }}>
      <div className="absolute inset-0 hero-gradient" />
      <div className="container mx-auto px-6 relative z-10 max-w-6xl">
        
        <div className="text-center mb-12">
          <h2 className="text-[#c5a059] font-black tracking-[0.3em] uppercase text-sm mb-4">يسعدنا خدمتك</h2>
          <h3 className="text-4xl md:text-5xl font-black text-white">تواصل مع سماك العقارية</h3>
        </div>

        <div className="bg-slate-900/60 backdrop-blur-lg rounded-[3rem] shadow-2xl overflow-hidden flex flex-col lg:flex-row border border-white/10">
          
          {/* قسم معلومات التواصل المباشر (يمين) */}
          <div className="lg:w-5/12 p-10 md:p-16 flex flex-col justify-center text-white bg-[#1a365d]/50">
            <h4 className="text-2xl font-black mb-8 border-b border-white/10 pb-4">قنوات التواصل المباشر</h4>
            
            <div className="space-y-6">
              <a href={`https://wa.me/${waPhone}?text=${waMessage}`} target="_blank" rel="noreferrer" className="flex items-center gap-4 bg-[#25D366]/10 hover:bg-[#25D366]/20 p-4 rounded-2xl border border-[#25D366]/30 transition-all group">
                <div className="w-12 h-12 bg-[#25D366] rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"><MessageCircle size={24} /></div>
                <div><p className="text-xs text-[#25D366] font-bold">محادثة فورية</p><p className="font-bold text-lg font-sans tracking-wider" dir="ltr">WhatsApp</p></div>
              </a>

              <a href={`tel:${supportPhone}`} className="flex items-center gap-4 bg-white/5 hover:bg-white/10 p-4 rounded-2xl border border-white/10 transition-all group">
                <div className="w-12 h-12 bg-[#c5a059] rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"><Phone size={24} /></div>
                <div><p className="text-xs text-[#c5a059] font-bold">الرقم الموحد</p><p className="font-bold text-lg font-sans tracking-wider" dir="ltr">{supportPhone}</p></div>
              </a>

              <div className="flex items-center gap-4 p-4 rounded-2xl">
                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center"><Mail className="text-slate-300" size={24} /></div>
                <div><p className="text-xs text-slate-400 font-bold">البريد الإلكتروني</p><p className="font-bold text-base font-sans tracking-wider" dir="ltr">info@semak.sa</p></div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-2xl">
                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center"><MapPin className="text-slate-300" size={24} /></div>
                <div><p className="text-xs text-slate-400 font-bold">المقر الرئيسي</p><p className="font-bold text-base">حي البوابة، مكة المكرمة</p></div>
              </div>
            </div>
          </div>
          
          {/* قسم نموذج حجز الوحدة (يسار) */}
          <div className="lg:w-7/12 bg-slate-900/30 p-10 md:p-16 border-r border-white/10">
            <h4 className="text-2xl font-black text-white mb-2">تسجيل اهتمام / حجز وحدة</h4>
            <p className="text-slate-400 text-sm mb-8">دعنا نساعدك في العثور على مسكن أحلامك.</p>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-bold mb-2 text-slate-200">الاسم الكامل</label>
                <input type="text" name="name" required className="w-full bg-white/10 border border-white/20 px-6 py-4 rounded-2xl outline-none focus:border-[#c5a059] text-white placeholder-gray-400 transition" placeholder="الاسم الثلاثي" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2 text-slate-200">رقم الجوال</label>
                <input type="tel" name="phone" required className="w-full bg-white/10 border border-white/20 px-6 py-4 rounded-2xl outline-none focus:border-[#c5a059] text-white placeholder-gray-400 transition" placeholder="05xxxxxxxx" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2 text-slate-200">الوحدة المهتم بها</label>
                <select name="unit" required className="w-full bg-white/10 border border-white/20 px-6 py-4 rounded-2xl outline-none focus:border-[#c5a059] text-white transition [&>option]:text-slate-900" defaultValue="">
                  <option value="" disabled>اختر الوحدة</option>
                  <option value="استفسار عام">استفسار عام</option>
                  {ALL_UNITS.map(u => {
                    const sold = !!soldUnits[u];
                    return (
                      <option key={u} value={u} disabled={sold} className={sold ? "text-red-500 bg-red-100" : ""}>
                        {u}{sold ? " (مباعة / محجوزة)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-[#c5a059] text-white py-5 rounded-2xl font-black text-xl hover:bg-yellow-600 transition flex justify-center items-center gap-2 shadow-xl">
                {loading ? <RefreshCw className="animate-spin" /> : <Send />} إرسال الطلب
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
    </>
  );
}