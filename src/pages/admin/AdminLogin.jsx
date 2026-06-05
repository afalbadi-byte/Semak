import React, { useState, useEffect } from 'react';
import { User, Lock, RefreshCw, ArrowRight } from 'lucide-react';

import { API_URL } from '../../lib/api/client';

export default function AdminLogin({ setUser, showToast }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem("semak_admin_email");
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const res = await fetch(`${API_URL}?action=login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (data.success) {
        // 🔥 السر هنا: السيرفر يرسل البيانات في data.data وليس data.user
        const userData = data.data; 

        if (rememberMe) {
          localStorage.setItem("semak_admin_email", email);
          // لا نخزن كلمة السر أبداً — نكتفي بالإيميل
        } else {
          localStorage.removeItem("semak_admin_email");
        }
        
        // حفظ الجلسة
        localStorage.setItem("semak_current_user", JSON.stringify(userData));
        
        if (setUser) setUser(userData);
        if (showToast) showToast("تم تسجيل الدخول", `مرحباً بك، ${userData.name}`);
        
        // النقل الجبري والقوي للصفحة
        if (userData.role === "technician") {
          window.location.href = "/tech-dashboard";
        } else {
          window.location.href = "/admin/dashboard"; // تأكد أن هذا هو مسار الداش بورد عندك
        }
      } else {
        if (showToast) showToast("خطأ", data.message, "error");
        else alert(data.message);
      }
    } catch (error) {
      if (showToast) showToast("خطأ", "فشل الاتصال بالسيرفر", "error");
      else alert("فشل الاتصال بالسيرفر");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-cover bg-center relative" style={{ backgroundImage: "url('/images/admin-login-bg.jpg')" }}>
      <div className="absolute inset-0 bg-[#1a365d]/90 backdrop-blur-sm" />
      <div className="bg-white dark:bg-brand-900 p-10 md:p-12 rounded-[2.5rem] shadow-2xl max-w-md w-full text-center relative z-10 border border-white/20 dark:border-brand-700">
        <img src="/images/logo-main.png" alt="سماك العقارية" className="h-16 mx-auto mb-4 object-contain dark:hidden" />
        <div
          aria-hidden="true"
          className="hidden dark:block w-44 h-16 mx-auto mb-4 bg-gold-500"
          style={{
            WebkitMaskImage: 'url(/images/logo-main.png)',
            maskImage: 'url(/images/logo-main.png)',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            WebkitMaskPosition: 'center',
            maskPosition: 'center',
            WebkitMaskSize: 'contain',
            maskSize: 'contain',
          }}
        />
        <h2 className="text-2xl font-black text-brand-800 dark:text-brand-100">بوابة الموظفين</h2>
        <p className="text-slate-500 dark:text-brand-400 text-sm mt-2 mb-8">تسجيل الدخول للوصول للأدوات الإدارية والفنية</p>
        <form onSubmit={handleLogin} className="space-y-6 text-right">
          <div>
            <label className="block text-sm font-bold mb-2 text-brand-800 dark:text-brand-100">البريد الإلكتروني</label>
            <div className="relative">
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-brand-400"><User size={16} /></span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-slate-50 dark:bg-brand-900 border border-slate-200 dark:border-brand-700 px-6 py-4 pr-12 rounded-xl outline-none focus:border-gold-500 focus:bg-white dark:focus:bg-brand-800 text-slate-800 dark:text-brand-50 dark:placeholder-brand-500 transition" placeholder="Email" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold mb-2 text-brand-800 dark:text-brand-100">كلمة المرور</label>
            <div className="relative">
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-brand-400"><Lock size={16} /></span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-slate-50 dark:bg-brand-900 border border-slate-200 dark:border-brand-700 px-6 py-4 pr-12 rounded-xl outline-none focus:border-gold-500 focus:bg-white dark:focus:bg-brand-800 text-slate-800 dark:text-brand-50 dark:placeholder-brand-500 transition" placeholder="••••••••" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input type="checkbox" id="rememberMe" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-4 h-4 accent-gold-500 cursor-pointer rounded border-slate-300 dark:border-brand-700"/>
            <label htmlFor="rememberMe" className="text-sm text-slate-600 dark:text-brand-300 font-bold cursor-pointer select-none">تذكر بيانات الدخول</label>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-brand-800 text-white py-4 rounded-xl font-bold text-lg hover:bg-gold-500 transition shadow-lg shadow-brand-800/30 mt-4 flex justify-center items-center gap-2">
            {loading ? <RefreshCw className="animate-spin" size={20} /> : "دخول"}
          </button>
        </form>
        <div className="mt-8 text-center pt-6 border-t border-slate-100 dark:border-brand-700">
          <button onClick={() => window.location.href = "/"} className="text-slate-400 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-100 text-sm flex items-center justify-center gap-2 mx-auto transition">
            <ArrowRight size={14} /> العودة للموقع الرئيسي
          </button>
        </div>
      </div>
    </div>
  );
}