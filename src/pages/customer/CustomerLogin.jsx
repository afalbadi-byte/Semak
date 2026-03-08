import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, User, Lock, ArrowRight } from 'lucide-react';
import { AppContext } from '../../context/AppContext';

export default function CustomerLogin() {
  const { setCustomer, showToast } = useContext(AppContext);
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    const user = e.target.user.value;
    const pass = e.target.password.value;
    if (user === "user" && pass === "user") {
      setCustomer({ username: "user", name: "عميل تجريبي", unit: "SM-A01" });
      showToast("تم تسجيل الدخول بنجاح", "مرحباً بك في بوابة العملاء");
      navigate("/maintenance");
    } else {
      showToast("خطأ", "بيانات الدخول غير صحيحة", "error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cover bg-center relative" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=2073&auto=format&fit=crop')" }}>
      <div className="absolute inset-0 bg-[#1a365d]/90 backdrop-blur-sm" />
      <div className="bg-white p-10 md:p-12 rounded-[2.5rem] shadow-2xl max-w-md w-full text-center relative z-10 border border-white/20">
        <div className="w-16 h-16 bg-[#c5a059]/10 text-[#c5a059] rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
          <ShieldCheck size={32} />
        </div>
        <h2 className="text-2xl font-black text-[#1a365d]">بوابة العملاء</h2>
        <p className="text-slate-500 text-sm mt-2 mb-8">تسجيل الدخول لطلب و متابعة خدمات الصيانة</p>
        <form onSubmit={handleLogin} className="space-y-6 text-right">
          <div>
            <label className="block text-sm font-bold mb-2 text-[#1a365d]">اسم المستخدم</label>
            <div className="relative">
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"><User size={16} /></span>
              <input type="text" name="user" required className="w-full bg-slate-50 border border-slate-200 px-6 py-4 pr-12 rounded-xl outline-none focus:border-[#c5a059] focus:bg-white text-slate-800 transition" placeholder="user" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold mb-2 text-[#1a365d]">كلمة المرور</label>
            <div className="relative">
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"><Lock size={16} /></span>
              <input type="password" name="password" required className="w-full bg-slate-50 border border-slate-200 px-6 py-4 pr-12 rounded-xl outline-none focus:border-[#c5a059] focus:bg-white text-slate-800 transition" placeholder="user" />
            </div>
          </div>
          <button type="submit" className="w-full bg-[#c5a059] text-white py-4 rounded-xl font-bold text-lg hover:bg-yellow-600 transition shadow-lg shadow-[#c5a059]/30 mt-4">دخول</button>
        </form>
        <div className="mt-6 p-4 bg-slate-50 rounded-xl text-xs text-slate-500 text-center">
          <strong>حساب التجربة:</strong> (user / user)
        </div>
        <div className="mt-8 text-center pt-6 border-t border-slate-100">
          <button onClick={() => navigate("/")} className="text-slate-400 hover:text-[#1a365d] text-sm flex items-center justify-center gap-2 mx-auto transition">
            <ArrowRight size={14} /> العودة للموقع الرئيسي
          </button>
        </div>
      </div>
    </div>
  );
}