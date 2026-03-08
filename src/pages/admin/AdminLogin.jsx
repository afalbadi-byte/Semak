import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Lock, RefreshCw, ArrowRight } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { API_URL, getImg } from '../../utils/helpers';

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const { setAdminUser, showToast } = useContext(AppContext);
  const navigate = useNavigate();

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
        if (rememberMe) {
          localStorage.setItem("semak_admin_email", email);
          localStorage.setItem("semak_admin_password", password);
        } else {
          localStorage.removeItem("semak_admin_email");
          localStorage.removeItem("semak_admin_password");
        }
        setAdminUser(data.user);
        showToast("تم تسجيل الدخول", `مرحباً بك، ${data.user.name}`);
        
        if (data.user.role === "technician") {
          navigate("/admin/tech-dashboard");
        } else {
          navigate("/admin/dashboard");
        }
      } else {
        showToast("خطأ", data.message, "error");
      }
    } catch {
      showToast("تنبيه", "جاري الدخول ببيانات تجريبية (نظراً لعدم وجود قاعدة بيانات حالياً)", "success");
      // وضع تجريبي مؤقت لحين ربط القاعدة
      setAdminUser({ id: 999, name: "Ahmed", role: "admin", job: "المدير العام", permissions: '["maintenance","letters","qr","leads","accounting","inspection","users_manage"]' });
      navigate("/admin/dashboard");
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
          <button onClick={() => navigate("/")} className="text-slate-400 hover:text-[#1a365d] text-sm flex items-center justify-center gap-2 mx-auto transition">
            <ArrowRight size={14} /> العودة للموقع الرئيسي
          </button>
        </div>
      </div>
    </div>
  );
}