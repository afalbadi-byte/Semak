import React, { useState, useContext } from 'react';
import { Phone, MapPin, RefreshCw, Send } from 'lucide-react';
import { AppContext } from '../context/AppContext';
import { API_URL, getImg } from '../utils/helpers';

export default function Contact() {
  const [loading, setLoading] = useState(false);
  const { showToast } = useContext(AppContext);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    const payload = {
      name: e.target.name.value,
      phone: e.target.phone.value,
      unit: e.target.unit.value,
    };

    try {
      const response = await fetch(`${API_URL}?action=add_lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (response.ok) {
        showToast("تم الإرسال بنجاح", "شكراً لاهتمامك، سيتم التواصل معك قريباً.");
        e.target.reset();
      } else {
        throw new Error("فشل");
      }
    } catch {
      showToast("تنبيه", "حدث خطأ في الاتصال، يرجى المحاولة لاحقاً.", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pt-32 pb-20 min-h-screen relative flex items-center bg-cover bg-center" style={{ backgroundImage: `url('${getImg("18fCsrolSEvo8q9wt2_z4BXlB88BZ-62-")}')` }}>
      <div className="absolute inset-0 hero-gradient" />
      <div className="container mx-auto px-6 relative z-10 max-w-5xl">
        <div className="bg-slate-900/60 backdrop-blur-lg rounded-[3rem] shadow-2xl overflow-hidden flex flex-col lg:flex-row border border-white/10">
          <div className="lg:w-1/2 p-12 md:p-20 flex flex-col justify-center text-white">
            <h2 className="text-4xl font-black mb-6">احجز وحدتك السكنية الآن</h2>
            <p className="text-slate-200 text-lg mb-10 leading-relaxed">بادر بالتسجيل لتملك وحدتك في هذا المشروع.</p>
            <div className="space-y-4 mb-10">
              <div className="flex items-center gap-4 text-xl font-bold">
                <Phone className="text-[#c5a059]" /> 920032842
              </div>
              <div className="flex items-center gap-4 text-xl font-bold">
                <MapPin className="text-[#c5a059]" /> حي البوابة، مكة المكرمة
              </div>
            </div>
          </div>
          <div className="lg:w-1/2 bg-slate-900/30 p-12 md:p-20 border-r border-white/10">
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
                <select name="unit" className="w-full bg-white/10 border border-white/20 px-6 py-4 rounded-2xl outline-none focus:border-[#c5a059] text-white transition [&>option]:text-slate-900" defaultValue="">
                  <option value="" disabled>اختر الوحدة</option>
                  <option value="SM-A01">SM-A01</option>
                  <option value="SM-A02">SM-A02</option>
                  <option value="SM-A03">SM-A03</option>
                  <option value="SM-A04">SM-A04</option>
                  <option value="SM-A05" disabled className="text-red-500 bg-red-100">SM-A05 (محجوزة)</option>
                  <option value="SM-A06">SM-A06</option>
                  <option value="SM-A07" disabled className="text-red-500 bg-red-100">SM-A07 (تم البيع)</option>
                </select>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-[#c5a059] text-white py-5 rounded-2xl font-black text-xl hover:bg-yellow-600 transition flex justify-center items-center gap-2 shadow-xl">
                {loading ? <RefreshCw className="animate-spin" /> : <Send />} إرسال طلب الاهتمام
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}