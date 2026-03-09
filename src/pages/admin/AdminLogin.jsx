import React, { useState, useEffect } from 'react';
import { User, Lock, RefreshCw, ArrowRight } from 'lucide-react';

const API_URL = "https://semak.sa/api.php";
const getImg = (id, sz = "w1500") => `https://drive.google.com/thumbnail?id=${id}&sz=${sz}`;

export default function AdminLogin({ setUser, showToast }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedEmail = localStorage.getItem("semak_admin_email");
    const savedPassword = localStorage.getItem("semak_admin_password");
    if (savedEmail && savedPassword) {
      setEmail(savedEmail);
      setPassword(savedPassword);
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
          localStorage.setItem("semak_admin_password", password);
        } else {
          localStorage.removeItem("semak_admin_email");
          localStorage.removeItem("semak_admin_password");
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
    <div className="min-h-screen flex items-center justify-center bg-cover bg-center relative" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2069&auto=format&fit=crop')" }}>
      <div className="absolute inset-0 bg-[#1a365d]/90 backdrop-blur-sm" />
      <div className="bg-white p-10 md:p-12 rounded-[2.5rem] shadow-2xl max-w-md w-full text-center relative z-10 border border-white/20">
        <img src={getImg("1I5KIPkeuwJ0CawpWJLpiHdmofSKLQglN")} alt="سماك العقارية" className="h-16 mx-auto mb-4 object-contain" />
        <h2 className="text-2xl font-black text-[#1a365d]">بوابة الموظفين</h2>
        <p className="text-slate-500 text-sm mt-2 mb-8">تسجيل الدخول للوصول للأدوات الإدارية والفنية</p>
        <form onSubmit={handleLogin} className="space-y-6 text-right">
          <div>
            <label className="block text-sm font-bold mb-2 text-[#1a365d]">البريد الإلكتروني</label>
            <div className="relative">
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"><User size={16} /></span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 px-6 py-4 pr-12 rounded-xl outline-none focus:border-[#c5a059] focus:bg-white text-slate-800 transition" placeholder="Email" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold mb-2 text-[#1a365d]">كلمة المرور</label>
            <div className="relative">
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"><Lock size={16} /></span>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 px-6 py-4 pr-12 rounded-xl outline-none focus:border-[#c5a059] focus:bg-white text-slate-800 transition" placeholder="••••••••" />
            </div>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <input type="checkbox" id="rememberMe" checked={rememberMe} onChange={(e) => setRememberMe(e.target.checked)} className="w-4 h-4 accent-[#c5a059] cursor-pointer rounded border-slate-300"/>
            <label htmlFor="rememberMe" className="text-sm text-slate-600 font-bold cursor-pointer select-none">تذكر بيانات الدخول</label>
          </div>
          <button type="submit" disabled={loading} className="w-full bg-[#1a365d] text-white py-4 rounded-xl font-bold text-lg hover:bg-[#c5a059] transition shadow-lg shadow-[#1a365d]/30 mt-4 flex justify-center items-center gap-2">
            {loading ? <RefreshCw className="animate-spin" size={20} /> : "دخول"}
          </button>
        </form>
        <div className="mt-8 text-center pt-6 border-t border-slate-100">
          <button onClick={() => window.location.href = "/"} className="text-slate-400 hover:text-[#1a365d] text-sm flex items-center justify-center gap-2 mx-auto transition">
            <ArrowRight size={14} /> العودة للموقع الرئيسي
          </button>
        </div>
      </div>
    </div>
  );
}