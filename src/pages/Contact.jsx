import React, { useState, useContext, useEffect, useRef } from 'react';
import { Phone, MapPin, Send, RefreshCw, MessageCircle, Mail, Clock } from 'lucide-react';
import { API_URL } from '../utils/helpers';
import PageMeta from '../components/PageMeta';
import { AppContext } from '../context/AppContext';
import { replyToClient } from '../services/whatsappService';

const ALL_UNITS = ["SM-A01","SM-A02","SM-A03","SM-A04","SM-A05","SM-A06","SM-A07"];

export default function Contact() {
  const { showToast } = useContext(AppContext);
  const [loading, setLoading] = useState(false);
  const [soldUnits, setSoldUnits] = useState({});
  const submitting = useRef(false);

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
    if (submitting.current) return;
    submitting.current = true;
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
      message: e.target.message.value.trim(),
      source: "الموقع الإلكتروني"
    };

    try {
      const response = await fetch(`${API_URL}?action=add_lead`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (data.success) {
        showToast("تم الإرسال بنجاح", "شكراً لاهتمامك، سيتم التواصل معك قريباً.", "success");
        replyToClient(payload.phone, payload.name); // قالب ترحيب للعميل (إشعار الإدارة في api.php)
        e.target.reset();
      } else { throw new Error("فشل"); }
    } catch (error) {
      showToast("تنبيه", "حدث خطأ في الاتصال، يرجى المحاولة لاحقاً.", "error");
    } finally { setLoading(false); submitting.current = false; }
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
              <a href={`https://wa.me/${waPhone}?text=${waMessage}`} target="_blank" rel="noreferrer" className="flex items-center gap-4 bg-white/5 hover:bg-white/10 p-4 rounded-2xl border border-white/10 hover:border-[#c5a059]/40 transition-all group">
                <div className="w-12 h-12 bg-white/10 border border-[#c5a059]/30 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"><MessageCircle className="text-[#c5a059]" size={24} /></div>
                <div><p className="text-xs text-[#c5a059] font-bold">محادثة فورية</p><p className="font-bold text-lg font-sans tracking-wider text-white" dir="ltr">WhatsApp</p></div>
              </a>

              <a href={`tel:${supportPhone}`} className="flex items-center gap-4 bg-white/5 hover:bg-white/10 p-4 rounded-2xl border border-white/10 hover:border-[#c5a059]/40 transition-all group">
                <div className="w-12 h-12 bg-white/10 border border-[#c5a059]/30 rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform"><Phone className="text-[#c5a059]" size={24} /></div>
                <div><p className="text-xs text-[#c5a059] font-bold">الرقم الموحد</p><p className="font-bold text-lg font-sans tracking-wider text-white" dir="ltr">{supportPhone}</p></div>
              </a>

              <a href="mailto:info@semak.sa" className="flex items-center gap-4 bg-white/5 hover:bg-white/10 p-4 rounded-2xl border border-white/10 hover:border-[#c5a059]/40 transition-all group">
                <div className="w-12 h-12 bg-white/10 border border-[#c5a059]/30 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform"><Mail className="text-[#c5a059]" size={24} /></div>
                <div><p className="text-xs text-slate-400 font-bold">البريد الإلكتروني</p><p className="font-bold text-base font-sans tracking-wider text-white" dir="ltr">info@semak.sa</p></div>
              </a>

              <div className="flex items-center gap-4 p-4 rounded-2xl">
                <div className="w-12 h-12 bg-white/10 border border-[#c5a059]/30 rounded-full flex items-center justify-center"><MapPin className="text-[#c5a059]" size={24} /></div>
                <div><p className="text-xs text-slate-400 font-bold">المقر الرئيسي</p><p className="font-bold text-base">حي البوابة، مكة المكرمة</p></div>
              </div>
            </div>

            {/* حسابات التواصل الاجتماعي */}
            <div className="mt-8 pt-6 border-t border-white/10">
              <p className="text-xs text-slate-400 font-bold mb-4 tracking-widest uppercase">تابعنا على</p>
              <div className="flex gap-3">

                {/* إنستقرام */}
                <a href="https://www.instagram.com/info.semak" target="_blank" rel="noreferrer"
                  className="group flex items-center gap-3 flex-1 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#c5a059]/40 p-3 rounded-2xl transition-all duration-300">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/10 border border-[#c5a059]/30 shadow-lg group-hover:scale-110 transition-transform flex-shrink-0">
                    <svg viewBox="0 0 24 24" fill="#c5a059" className="w-4 h-4">
                      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 font-bold">إنستقرام</p>
                    <p className="text-white font-bold text-xs truncate" dir="ltr">@info.semak</p>
                  </div>
                </a>

                {/* فيسبوك */}
                <a href="https://www.facebook.com/semak.sa" target="_blank" rel="noreferrer"
                  className="group flex items-center gap-3 flex-1 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#c5a059]/40 p-3 rounded-2xl transition-all duration-300">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/10 border border-[#c5a059]/30 shadow-lg group-hover:scale-110 transition-transform flex-shrink-0">
                    <svg viewBox="0 0 24 24" fill="#c5a059" className="w-4 h-4">
                      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 font-bold">فيسبوك</p>
                    <p className="text-white font-bold text-xs truncate" dir="ltr">SEMAK</p>
                  </div>
                </a>

              </div>

              {/* X و لينكدإن */}
              <div className="flex gap-3 mt-3">

                {/* X (تويتر) */}
                <a href="https://x.com/semak_sa" target="_blank" rel="noreferrer"
                  className="group flex items-center gap-3 flex-1 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#c5a059]/40 p-3 rounded-2xl transition-all duration-300">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/10 border border-[#c5a059]/30 shadow-lg group-hover:scale-110 transition-transform flex-shrink-0">
                    <svg viewBox="0 0 24 24" fill="#c5a059" className="w-4 h-4">
                      <path d="M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z"/>
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 font-bold">X (تويتر)</p>
                    <p className="text-white font-bold text-xs truncate" dir="ltr">@semak_sa</p>
                  </div>
                </a>

                {/* لينكدإن */}
                <a href="https://www.linkedin.com/company/semak-realestate" target="_blank" rel="noreferrer"
                  className="group flex items-center gap-3 flex-1 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#c5a059]/40 p-3 rounded-2xl transition-all duration-300">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/10 border border-[#c5a059]/30 shadow-lg group-hover:scale-110 transition-transform flex-shrink-0">
                    <svg viewBox="0 0 24 24" fill="#c5a059" className="w-4 h-4">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-slate-400 font-bold">لينكدإن</p>
                    <p className="text-white font-bold text-xs truncate" dir="ltr">semak-realestate</p>
                  </div>
                </a>

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
              <div>
                <label className="block text-sm font-bold mb-2 text-slate-200">رسالتك <span className="text-slate-400 font-normal">(اختياري)</span></label>
                <textarea name="message" rows={3} className="w-full bg-white/10 border border-white/20 px-6 py-4 rounded-2xl outline-none focus:border-[#c5a059] text-white placeholder-gray-400 transition resize-none" placeholder="أخبرنا عن استفسارك أو ما تودّ معرفته..." />
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