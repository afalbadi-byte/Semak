import React, { useContext, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Home, Phone, ArrowRight, RefreshCw } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { API_URL } from '../../utils/helpers';

export default function CustomerLogin() {
  const { setCustomer, showToast } = useContext(AppContext);
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    const unitCode = e.target.unit_code.value.trim().toUpperCase();
    const phone = e.target.phone.value.trim();

    if (!unitCode || !phone) {
      showToast("تنبيه", "يرجى إدخال رقم الوحدة ورقم الجوال", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=customer_login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unit_code: unitCode, phone })
      });
      const data = await res.json();

      if (data.success) {
        setCustomer(data.data);
        showToast("تم تسجيل الدخول", `أهلاً بك، ${data.data.name}`);
        navigate("/portal");
      } else {
        showToast("خطأ", data.message || "رقم الوحدة أو الجوال غير صحيح", "error");
      }
    } catch {
      showToast("خطأ", "فشل الاتصال بالخادم، حاول لاحقاً", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cover bg-center relative -mt-24" style={{ backgroundImage: "url('/images/customer-login-bg.jpg')" }}>
      <div className="absolute inset-0 bg-[#1a365d]/90 backdrop-blur-sm" />
      <div className="bg-white p-10 md:p-12 rounded-[2.5rem] shadow-2xl max-w-md w-full text-center relative z-10 border border-white/20">
        <div className="w-16 h-16 bg-[#c5a059]/10 text-[#c5a059] rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
          <ShieldCheck size={32} />
        </div>
        <h2 className="text-2xl font-black text-[#1a365d]">بوابة الملاك</h2>
        <p className="text-slate-500 text-sm mt-2 mb-8">أدخل رقم وحدتك ورقم جوالك المسجل للدخول</p>
        <form onSubmit={handleLogin} className="space-y-6 text-right">
          <div>
            <label className="block text-sm font-bold mb-2 text-[#1a365d]">رقم الوحدة</label>
            <div className="relative">
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"><Home size={16} /></span>
              <input
                type="text"
                name="unit_code"
                required
                className="w-full bg-slate-50 border border-slate-200 px-6 py-4 pr-12 rounded-xl outline-none focus:border-[#c5a059] focus:bg-white text-slate-800 transition font-bold tracking-widest"
                placeholder="SM-A01"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold mb-2 text-[#1a365d]">رقم الجوال المسجل</label>
            <div className="relative">
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"><Phone size={16} /></span>
              <input
                type="tel"
                name="phone"
                required
                className="w-full bg-slate-50 border border-slate-200 px-6 py-4 pr-12 rounded-xl outline-none focus:border-[#c5a059] focus:bg-white text-slate-800 transition"
                placeholder="05xxxxxxxx"
                dir="ltr"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#c5a059] text-white py-4 rounded-xl font-bold text-lg hover:bg-yellow-600 transition shadow-lg shadow-[#c5a059]/30 mt-4 flex justify-center items-center gap-2"
          >
            {loading ? <RefreshCw className="animate-spin" size={20} /> : "دخول"}
          </button>
        </form>
        <div className="mt-8 text-center pt-6 border-t border-slate-100">
          <button onClick={() => navigate("/")} className="text-slate-400 hover:text-[#1a365d] text-sm flex items-center justify-center gap-2 mx-auto transition">
            <ArrowRight size={14} /> العودة للموقع الرئيسي
          </button>
        </div>
      </div>
    </div>
  );
}
