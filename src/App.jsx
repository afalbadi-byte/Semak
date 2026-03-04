import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, ArrowRight, Award, Bath, Bed, Box, Building, CalendarDays, Car,
  ChevronDown, CircleCheckBig, CircleCheck, Clock, Droplets, ExternalLink, Eye,
  FilePenLine, Fingerprint, HardHat, HousePlus, House, Layers, LayoutGrid, Leaf,
  ListChecks, Lock, LogOut, MapPin, Menu, MessageCircle, Moon, Phone, Plane,
  Printer, QrCode, Receipt, RefreshCw, Ruler, Search, Send, ShieldCheck,
  ShoppingCart, Target, TramFront, TreePine, Umbrella, UserCheck, UserCog, User,
  Users, Wifi, Wrench, X, ZoomIn
} from 'lucide-react';

// --- Global Constants ---
// 🔴 ضع رابط موقعك الفعلي هنا 🔴
const API_URL = "https://semak.sa/api.php";

const ADMIN_CREDS = {
  id: 999,
  name: "Ahmed.F Al-Badi (Admin)",
  role: "admin",
  job: "المدير العام",
  email: "ahmed.albadi@semak.sa",
  pass: "Medo@3225"
};

const TECHNICIANS = {
  تكييف: "ديلاور (فني تكييف)",
  سباكة: "صدام (فني كهرباء )",
  كهرباء: "ابراهيم (مبلط)",
  أخرى: "فريق الدعم العام"
};
const TECHNICIANS_LIST = Object.values(TECHNICIANS);
const TIME_SLOTS = [
  "08:00 ص - 10:00 ص",
  "10:00 ص - 12:00 م",
  "01:00 م - 03:00 م",
  "04:00 م - 06:00 م"
];

const getImg = (id, sz = "w1500") => `https://drive.google.com/thumbnail?id=${id}&sz=${sz}`;

// --- Styles Component ---
const GlobalStyles = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;900&family=Amiri:wght@400;700&display=swap');
    .font-cairo { font-family: 'Cairo', sans-serif; }
    .font-amiri { font-family: 'Amiri', serif; }
    body { font-family: 'Cairo', sans-serif; overflow-x: hidden; background-color: #f8fafc; }
    .hero-gradient { background: linear-gradient(rgba(15, 23, 42, 0.8), rgba(15, 23, 42, 0.6)); }
    .text-glow { text-shadow: 0 0 15px rgba(197, 160, 89, 0.4); }
    .card-hover { transition: all 0.3s ease; }
    .card-hover:hover { transform: translateY(-10px); box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1); }
    .logo-blend-light { mix-blend-mode: multiply; }
    .logo-footer-gold { transition: transform 0.3s ease; }
    .logo-footer-gold:hover { transform: scale(1.05); filter: drop-shadow(0 0 10px rgba(197, 160, 89, 0.3)); }
    .map-container iframe { filter: grayscale(20%) contrast(1.2) opacity(0.9); transition: all 0.3s ease; }
    .map-container:hover iframe { filter: grayscale(0%) opacity(1); }
    @keyframes marquee { 0% { transform: translateX(0%); } 100% { transform: translateX(-100%); } }
    .marquee-container { display: flex; overflow: hidden; width: 100%; direction: ltr; }
    .marquee-content { display: flex; min-width: 100%; flex-shrink: 0; align-items: center; justify-content: space-around; animation: marquee 25s linear infinite; }
    .marquee-container:hover .marquee-content { animation-play-state: paused; }
    /* Print Styles */
    .a4-page { width: 210mm; min-height: 297mm; height: auto; background: white; margin: 0 auto; position: relative; padding: 0; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 0 20px rgba(0,0,0,0.15); color: #333; transform-origin: top center; }
    .decorative-strip { position: absolute; right: 0; top: 0; bottom: 0; width: 8mm; background: linear-gradient(180deg, #1a365d 0%, #1a365d 85%, #c5a059 85%, #c5a059 100%); z-index: 10; -webkit-print-color-adjust: exact; }
    .corner-accent { position: absolute; bottom: 20mm; left: 20mm; width: 30mm; height: 30mm; border-bottom: 2px solid #c5a059; border-left: 2px solid #c5a059; opacity: 0.3; pointer-events: none; z-index: 5; }
    .watermark { position: absolute; top: 55%; left: 45%; transform: translate(-50%, -50%); opacity: 0.04; width: 80%; pointer-events: none; filter: grayscale(100%); z-index: 0; }
    .letter-header { padding: 15mm 20mm 5mm 30mm; display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; }
    .letter-footer { margin-top: auto; background-color: #1a365d; color: white; padding: 12px 0; border-top: 4px solid #c5a059; z-index: 20; -webkit-print-color-adjust: exact !important; }
    .letter-body { padding: 10mm 20mm 10mm 30mm; flex-grow: 1; font-family: 'Amiri', serif; font-size: 18px; line-height: 2.2; position: relative; z-index: 5; display: flex; flex-direction: column; font-variant-ligatures: no-common-ligatures; letter-spacing: 0px; }
    @media print {
        @page { size: A4; margin: 0; }
        body * { visibility: hidden; }
        #printArea, #printArea * { visibility: visible; }
        #printArea { position: absolute; left: 0; top: 0; width: 100%; }
        .no-print { display: none !important; }
        .a4-page { box-shadow: none !important; width: 100% !important; min-height: 297mm !important; }
        .decorative-strip { background: linear-gradient(180deg, #1a365d 0%, #1a365d 85%, #c5a059 85%, #c5a059 100%) !important; -webkit-print-color-adjust: exact !important; }
        .letter-footer { background-color: #1a365d !important; color: white !important; -webkit-print-color-adjust: exact !important; position: absolute !important; bottom: 0 !important; left: 0 !important; width: 100% !important;}
    }
    .timeline-container { position: relative; }
    .timeline-container::before { content: ''; position: absolute; top: 0; bottom: 0; right: 24px; width: 2px; background: #e2e8f0; }
    .timeline-item { position: relative; padding-right: 60px; margin-bottom: 30px; }
    .timeline-item:last-child { margin-bottom: 0; }
    .timeline-icon { position: absolute; right: 8px; top: 0; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; z-index: 10; border: 4px solid white; }
    .kanban-scroll::-webkit-scrollbar { height: 6px; }
    .kanban-scroll::-webkit-scrollbar-track { background: #f1f5f9; border-radius: 8px; }
    .kanban-scroll::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 8px; }
    .kanban-scroll::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
  `}</style>
);

// --- Sub Components ---

const HomeView = ({ navigateTo }) => (
  <div className="relative min-h-screen flex items-center justify-center bg-cover bg-center py-32" style={{ backgroundImage: `url('${getImg("1P0nERTU6SQiWHLf-53bpp1Jsjf120Kq4")}')` }}>
    <div className="absolute inset-0 hero-gradient" />
    <div className="container mx-auto px-4 md:px-6 relative z-10 flex flex-col items-center justify-center mt-10">
      <img src={getImg("1-d_n0rD8H8CZf_y6l1suQlcWThhmkBmb")} alt="شعار" className="h-20 md:h-32 mb-8 object-contain brightness-0 invert drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] opacity-95 hover:opacity-100 transition duration-500 hover:scale-105 transform" />
      <div className="bg-slate-900/80 backdrop-blur-xl rounded-[3rem] border border-white/10 shadow-2xl p-8 md:p-12 max-w-4xl w-full text-center relative overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#c5a059]/20 rounded-full blur-3xl pointer-events-none" />
        <div className="inline-block px-4 py-1.5 rounded-full bg-[#c5a059]/20 border border-[#c5a059]/40 text-[#c5a059] font-bold text-xs md:text-sm mb-4 animate-pulse tracking-wide">
          فرصة استثمارية وسكنية حصرية
        </div>
        <h1 className="text-2xl md:text-4xl font-black text-white mb-4 leading-tight">تحفة معمارية.. <span className="text-[#c5a059] text-glow">بـ 7 وحدات فقط</span></h1>
        <p className="text-slate-300 text-sm md:text-base mb-8 max-w-2xl mx-auto leading-relaxed font-light">
          نضع بين أيديكم خبرتنا الطويلة في سماك العقارية لنقدم مسكناً يجمع بين الخصوصية التامة والتقنيات الحديثة في قلب مكة المكرمة.
        </p>
        <div className="w-full h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 divide-white/5 mb-10 md:divide-x md:divide-x-reverse">
          <div className="px-2"><span className="block text-3xl md:text-4xl font-black text-white mb-1">07</span><p className="text-[#c5a059] font-bold uppercase text-[10px] md:text-xs tracking-widest">وحدات سكنية</p></div>
          <div className="px-2"><span className="block text-3xl md:text-4xl font-black text-white mb-1">+200</span><p className="text-[#c5a059] font-bold uppercase text-[10px] md:text-xs tracking-widest">متر مربع مساحة</p></div>
          <div className="px-2"><span className="block text-3xl md:text-4xl font-black text-white mb-1">10</span><p className="text-[#c5a059] font-bold uppercase text-[10px] md:text-xs tracking-widest">سنوات ضمان</p></div>
          <div className="px-2 border-none"><span className="block text-3xl md:text-4xl font-black text-white mb-1">100%</span><p className="text-[#c5a059] font-bold uppercase text-[10px] md:text-xs tracking-widest">تملك حر</p></div>
        </div>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button onClick={() => navigateTo("contact")} className="bg-[#c5a059] text-white px-8 py-3 rounded-2xl font-bold text-lg hover:bg-yellow-600 transition shadow-lg shadow-[#c5a059]/20 transform hover:-translate-y-1">احجز معاينتك اليوم</button>
          <button onClick={() => navigateTo("projects")} className="bg-white/5 backdrop-blur-md border border-white/20 text-white px-8 py-3 rounded-2xl font-bold text-lg hover:bg-white/10 transition">استكشف الفرصة</button>
        </div>
      </div>
    </div>
  </div>
);

const AboutView = () => {
  const values = [
    { icon: HousePlus, color: "blue", title: "بيئة ذكية متكاملة", desc: "وحدات مجهزة بالكامل بأنظمة الإنارة والدخول الذكي، مع بنية تحتية مرنة للمستقبل." },
    { icon: ShieldCheck, color: "red", title: "أمان العائلة أولاً", desc: "أنظمة مراقبة CCTV متطورة، وأقفال إلكترونية ذكية تضمن أقصى درجات الحماية." },
    { icon: Award, color: "amber", title: "جودة بلا تنازلات", desc: "استخدام أرقى خامات البورسلان، الرخام، والأدوات الصحية من ماركات عالمية." }
  ];
  const pillars = [
    { icon: Leaf, title: "تعزيز جودة الحياة", desc: "من خلال توفير بيئة سكنية متكاملة الخدمات تعزز رفاهية وراحة الساكنين." },
    { icon: Wifi, title: "المسكن الذكي", desc: "تبني تقنيات البناء الحديثة والأنظمة الذكية لضمان كفاءة الطاقة وسهولة التحكم." },
    { icon: Users, title: "المساهمة في التملك", desc: "تقديم خيارات سكنية متنوعة بأسعار تنافسية تدعم تطلعات الأسر السعودية في التملك." },
    { icon: Building, title: "أنسنة مكة", desc: "مراعاة الهوية العمرانية والإنسانية مكة المكرمة في تصاميمنا لخلق مجتمعات حيوية." }
  ];
  return (
    <div className="bg-white min-h-screen">
      <div className="relative h-[60vh] flex items-center justify-center bg-fixed bg-cover bg-center" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070&auto=format&fit=crop')" }}>
        <div className="absolute inset-0 bg-[#1a365d]/80 mix-blend-multiply" />
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
        <div className="relative z-10 text-center text-white p-6 max-w-4xl">
          <h1 className="text-5xl md:text-7xl font-black mb-6 tracking-tight">من نحن</h1>
          <div className="w-24 h-1.5 bg-[#c5a059] mx-auto rounded-full mb-6" />
          <p className="text-xl md:text-3xl font-light leading-relaxed opacity-90">سقف يعلو برؤيتك، ومسكن يحكي قصتك</p>
        </div>
      </div>
      <div className="py-24 bg-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#c5a059]/5 rounded-bl-[100%] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-[#1a365d]/5 rounded-tr-[100%] pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10 max-w-5xl text-center">
          <div className="inline-block px-6 py-2 rounded-full bg-slate-100 text-[#1a365d] font-bold mb-8 shadow-sm">قصتنا</div>
          <h2 className="text-4xl md:text-6xl font-black text-[#1a365d] mb-10 leading-tight">سماك العقارية</h2>
          <p className="text-xl md:text-2xl text-slate-600 leading-loose font-light relative">
            في قلب مكة المكرمة، حيث تلتقي الروحانية بطموح المستقبل، ولدت <strong>سماك</strong>. لم نأتِ لنبني مجرد جدران وأسقف، بل لنرسم أسلوب حياة يتناغم مع قدسية المكان.
          </p>
        </div>
      </div>
    </div>
  );
};

const ProjectsView = () => {
  const [selectedFloor, setSelectedFloor] = useState("first");
  const [expandedUnit, setExpandedUnit] = useState(null);
  const [previewImg, setPreviewImg] = useState(null);
  const toggleUnit = (id) => setExpandedUnit(expandedUnit === id ? null : id);
  const floors = [{ id: "ground", label: "الدور الأرضي" }, { id: "first", label: "الدور الأول" }, { id: "second", label: "الدور الثاني" }, { id: "third", label: "الدور الثالث" }, { id: "fourth", label: "الدور الرابع" }];
  const unitsData = {
    first: [{ id: "sm-a01", title: "وحدة SM-A01", price: "720,000 ريال", badge: "واجهتين", isSpecial: true }, { id: "sm-a02", title: "وحدة SM-A02", price: "700,000 ريال", badge: "واجهة أمامية", isSpecial: false }],
    second: [{ id: "sm-a03", title: "وحدة SM-A03", price: "720,000 ريال", badge: "واجهتين", isSpecial: true }, { id: "sm-a04", title: "وحدة SM-A04", price: "700,000 ريال", badge: "واجهة أمامية", isSpecial: false }],
    third: [{ id: "sm-a05", title: "وحدة SM-A05", price: "720,000 ريال", badge: "واجهتين", isSpecial: true, isSold: true }, { id: "sm-a06", title: "وحدة SM-A06", price: "700,000 ريال", badge: "واجهة أمامية", isSpecial: false }],
    fourth: [{ id: "sm-a07", title: "وحدة SM-A07", price: "1,100,000 ريال", badge: "فيلا روف فاخرة", isSpecial: true, isSold: true, roof: true }]
  };
  const images = { ground: getImg("1WCjS9UTiXUV8oSWjbsZgbHQuWFhU-F31"), first: getImg("1_SOkisFdEjokohC6DwFjJAakT0DxJild"), second: getImg("1o0NXJ_iC-LhrvDIC4i_uOy0WSfJfsAG1"), third: getImg("1MZuAEed1Vdn70eknds87xSInFEPINogE"), fourth: getImg("1dMNgoNkLMjmjOeHA1R98ApKOX8yFK1y1") };

  return (
    <div className="pt-32 pb-20 bg-slate-50 min-h-screen">
      {previewImg && (
        <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4 cursor-pointer" onClick={() => setPreviewImg(null)}>
          <img src={previewImg} className="max-w-full max-h-screen rounded-lg shadow-2xl" alt="مخطط مكبر" />
          <button className="absolute top-4 right-4 text-white p-2"><X size={40} /></button>
        </div>
      )}
      <div className="container mx-auto px-6 mb-24">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-[#c5a059] font-black tracking-[0.3em] uppercase text-sm mb-4 leading-tight">مشاريعنا</h2>
          <h3 className="text-4xl md:text-5xl font-black text-[#1a365d] mb-8">سماك - البوابة 1</h3>
        </div>
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {floors.map(f => (
            <button key={f.id} onClick={() => setSelectedFloor(f.id)} className={`px-6 py-3 rounded-full font-bold border-2 border-[#1a365d] transition ${selectedFloor === f.id ? "bg-[#1a365d] text-white" : "text-[#1a365d] hover:bg-[#1a365d]/10"}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="bg-white rounded-[3rem] p-8 md:p-12 shadow-xl border border-slate-100 min-h-[500px] grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1">
            {selectedFloor !== "ground" && unitsData[selectedFloor].map(unit => (
              <div key={unit.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-4 cursor-pointer" onClick={() => toggleUnit(unit.id)}>
                <span className="block font-bold text-xl text-[#1a365d]">{unit.title}</span>
                <span className="text-[#c5a059] font-black text-lg">{unit.price}</span>
              </div>
            ))}
          </div>
          <div className="order-1 lg:order-2 h-full min-h-[400px]">
            <div className="relative cursor-pointer overflow-hidden rounded-3xl h-full bg-slate-200 flex items-center justify-center" onClick={() => setPreviewImg(images[selectedFloor])}>
              <img src={images[selectedFloor]} className="w-full h-full object-cover" alt="مخطط" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ContactView = ({ showToast }) => {
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=add_lead`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: e.target.name.value, phone: e.target.phone.value, unit: e.target.unit.value })
      });
      if (res.ok) {
        showToast("تم الإرسال", "سنتواصل معك قريباً");
        e.target.reset();
      }
    } catch { showToast("خطأ", "حدث خطأ في الاتصال", "error"); } 
    finally { setLoading(false); }
  };
  return (
    <div className="pt-32 pb-20 min-h-screen relative flex items-center justify-center"><div className="w-full max-w-xl bg-white p-8 rounded-3xl shadow-xl">
      <h2 className="text-2xl font-black mb-6 text-center">احجز وحدتك الآن</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="text" name="name" required className="w-full border p-4 rounded-xl" placeholder="الاسم" />
        <input type="tel" name="phone" required className="w-full border p-4 rounded-xl" placeholder="الجوال" />
        <select name="unit" className="w-full border p-4 rounded-xl">
          <option value="SM-A01">SM-A01</option><option value="SM-A02">SM-A02</option>
        </select>
        <button type="submit" disabled={loading} className="w-full bg-[#c5a059] text-white py-4 rounded-xl font-bold">إرسال</button>
      </form>
    </div></div>
  );
};

const AdminLoginView = ({ setUser, navigateTo, showToast }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
        setUser(data.user);
        showToast("تم", `مرحباً بك، ${data.user.name}`);
        navigateTo("dashboard");
      } else { showToast("خطأ", data.message, "error"); }
    } catch { showToast("خطأ", "فشل الاتصال", "error"); }
    finally { setLoading(false); }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900"><div className="bg-white p-10 rounded-[2.5rem] w-full max-w-md">
      <h2 className="text-2xl font-black text-center mb-6">بوابة الموظفين</h2>
      <form onSubmit={handleLogin} className="space-y-4">
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} required className="w-full border p-4 rounded-xl" placeholder="Email" />
        <input type="password" value={password} onChange={e=>setPassword(e.target.value)} required className="w-full border p-4 rounded-xl" placeholder="Password" />
        <button type="submit" disabled={loading} className="w-full bg-[#1a365d] text-white py-4 rounded-xl font-bold">دخول</button>
      </form>
    </div></div>
  );
};

const CustomerLoginView = ({ setCustomer, navigateTo, showToast }) => {
  const handleLogin = (e) => {
    e.preventDefault();
    if (e.target.user.value === "user" && e.target.password.value === "user") {
      setCustomer({ username: "user", name: "عميل تجريبي", unit: "SM-A01" });
      navigateTo("maintenance");
    } else { showToast("خطأ", "بيانات خاطئة", "error"); }
  };
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900"><div className="bg-white p-10 rounded-[2.5rem] w-full max-w-md">
      <h2 className="text-2xl font-black text-center mb-6">بوابة العملاء</h2>
      <form onSubmit={handleLogin} className="space-y-4">
        <input type="text" name="user" required className="w-full border p-4 rounded-xl" placeholder="User" />
        <input type="password" name="password" required className="w-full border p-4 rounded-xl" placeholder="Password" />
        <button type="submit" className="w-full bg-[#c5a059] text-white py-4 rounded-xl font-bold">دخول</button>
      </form>
    </div></div>
  );
};

const MaintenanceView = ({ customer, setCustomer, navigateTo, showToast }) => {
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("new");
  
  const submitTicket = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=add_maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: e.target.name.value, phone: e.target.phone.value, unit: e.target.unit.value, type: e.target.type.value, desc: e.target.desc.value })
      });
      if (res.ok) {
        showToast("نجاح", "تم استلام الطلب");
        e.target.reset();
        setTab("track");
      }
    } catch { showToast("خطأ", "فشل الاتصال", "error"); }
    finally { setLoading(false); }
  };
  return (
    <div className="pt-32 pb-20 min-h-screen flex justify-center"><div className="w-full max-w-3xl px-6">
      <div className="flex justify-center gap-4 mb-6">
        <button onClick={()=>setTab("new")} className={`px-6 py-2 rounded-full font-bold ${tab==="new"?"bg-[#c5a059] text-white":"bg-white"}`}>طلب جديد</button>
        <button onClick={()=>setTab("track")} className={`px-6 py-2 rounded-full font-bold ${tab==="track"?"bg-[#c5a059] text-white":"bg-white"}`}>طلباتي</button>
      </div>
      {tab === "new" ? (
        <form onSubmit={submitTicket} className="bg-white p-8 rounded-[2rem] space-y-4 shadow-xl">
          <input type="text" name="name" defaultValue={customer?.name} required className="w-full border p-3 rounded-xl" placeholder="الاسم" />
          <input type="tel" name="phone" required className="w-full border p-3 rounded-xl" placeholder="الجوال" />
          <input type="text" name="unit" defaultValue={customer?.unit} required className="w-full border p-3 rounded-xl" placeholder="الوحدة" />
          <select name="type" required className="w-full border p-3 rounded-xl"><option value="سباكة">سباكة</option><option value="كهرباء">كهرباء</option></select>
          <textarea name="desc" required className="w-full border p-3 rounded-xl" placeholder="الوصف"></textarea>
          <button type="submit" disabled={loading} className="w-full bg-[#c5a059] text-white py-3 rounded-xl font-bold">إرسال</button>
        </form>
      ) : (<div className="bg-white p-8 rounded-[2rem] text-center text-slate-500 shadow-xl">تم استلام طلبك وبانتظار تعيين الفني.</div>)}
    </div></div>
  );
};

const DashboardView = ({ user, setUser, navigateTo, showToast }) => {
  const [activeTab, setActiveTab] = useState("");
  const [leads, setLeads] = useState([]);
  const [users, setUsers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);

  const loadData = async (action, setter) => {
    setActiveTab(action.replace("get_", ""));
    setLoading(true);
    try { const res = await fetch(`${API_URL}?action=${action}`); setter(await res.json()); } 
    catch { showToast("خطأ", "فشل الاتصال", "error"); } 
    finally { setLoading(false); }
  };

  const updateTicketStatus = (id, field, value) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, [field]: value } : t));
    showToast("تحديث", "تم تحديث الحالة");
  };

  return (
    <div className="pt-32 pb-20 bg-slate-50 min-h-screen"><div className="container mx-auto px-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-black">لوحة التحكم - {user?.name}</h1>
        <button onClick={() => {setUser(null); navigateTo("home");}} className="text-red-500 font-bold">خروج</button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {user?.role === "admin" && <button onClick={() => loadData("get_users", setUsers)} className="bg-white p-6 rounded-2xl shadow-md font-bold">الموظفين</button>}
        <button onClick={() => navigateTo("letter-generator")} className="bg-white p-6 rounded-2xl shadow-md font-bold">صانع الخطابات</button>
        <button onClick={() => loadData("get_maintenance", setTickets)} className="bg-white p-6 rounded-2xl shadow-md font-bold">الصيانة</button>
        {user?.role === "admin" && <button onClick={() => loadData("get_leads", setLeads)} className="bg-white p-6 rounded-2xl shadow-md font-bold">المهتمين</button>}
      </div>
      {/* Content area based on activeTab */}
      {activeTab === "users" && <div className="bg-white p-6 rounded-2xl shadow-md">عرض الموظفين... (تم جلب {users.length} موظف)</div>}
      {activeTab === "leads" && <div className="bg-white p-6 rounded-2xl shadow-md">عرض المهتمين... (تم جلب {leads.length} مهتم)</div>}
      {activeTab === "maintenance" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tickets.map(t => (
            <div key={t.id} className="bg-white p-4 rounded-xl shadow-sm border">
              <p className="font-bold">{t.type} | {t.unit}</p>
              <p className="text-sm text-slate-500 mb-2">{t.descrip || t.desc}</p>
              <select value={t.status} onChange={e=>updateTicketStatus(t.id, "status", e.target.value)} className="w-full text-xs p-2 border rounded">
                <option value="قيد الانتظار">قيد الانتظار</option><option value="جاري العمل">جاري العمل</option><option value="مكتمل">مكتمل</option>
              </select>
            </div>
          ))}
        </div>
      )}
    </div></div>
  );
};

const LetterGeneratorView = ({ user, navigateTo, showToast }) => {
  const [data, setData] = useState({ date: new Date().toISOString().split("T")[0], recipient: "السادة المحترمين", subject: "", body: "", signName: user?.name || "", signTitle: user?.job || "", showStamp: user?.role === "admin" });
  const [dbTemplates, setDbTemplates] = useState([]);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [newTempMeta, setNewTempMeta] = useState({ category: "إدارية عامة", title: "" });

  const fetchTemplates = async () => {
    try { const res = await fetch(`${API_URL}?action=get_templates`); setDbTemplates(await res.json()); } catch {}
  };
  useEffect(() => { fetchTemplates(); }, []);

  const saveTemplateToDB = async () => {
    try {
      const res = await fetch(`${API_URL}?action=add_template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: newTempMeta.category, title: newTempMeta.title, subject: data.subject, body: data.body })
      });
      if (res.ok) { showToast("تم", "حفظ النموذج"); setShowSaveForm(false); fetchTemplates(); }
    } catch { showToast("خطأ", "فشل الحفظ", "error"); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 flex flex-col md:flex-row font-cairo">
      <div className="w-full md:w-1/3 bg-slate-900 text-white p-6 flex flex-col overflow-y-auto no-print">
        <div className="flex justify-between mb-4"><h2 className="font-bold text-[#c5a059]">صانع الخطابات</h2><button onClick={() => navigateTo("dashboard")}>عودة</button></div>
        <select onChange={e => {
            const sel = dbTemplates.find(t => t.id.toString() === e.target.value);
            if (sel) setData({...data, subject: sel.subject, body: sel.body});
          }} className="mb-4 bg-slate-800 p-2 rounded text-white">
          <option value="custom">-- نموذج جديد --</option>
          {dbTemplates.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
        </select>
        <input type="text" value={data.recipient} onChange={e=>setData({...data, recipient: e.target.value})} className="mb-2 p-2 bg-slate-800 rounded" placeholder="المستلم" />
        <input type="text" value={data.subject} onChange={e=>setData({...data, subject: e.target.value})} className="mb-2 p-2 bg-slate-800 rounded font-bold" placeholder="الموضوع" />
        <textarea rows="8" value={data.body} onChange={e=>setData({...data, body: e.target.value})} className="mb-4 p-2 bg-slate-800 rounded" placeholder="النص..."></textarea>
        {user?.role === "admin" && (
          <div className="bg-slate-800 p-4 rounded mb-4">
            {!showSaveForm ? <button onClick={()=>setShowSaveForm(true)} className="text-teal-400 text-sm font-bold w-full">+ حفظ كنموذج دائم</button> : (
              <div className="space-y-2">
                <input type="text" value={newTempMeta.title} onChange={e=>setNewTempMeta({...newTempMeta, title:e.target.value})} placeholder="اسم النموذج السري" className="w-full p-2 text-black text-sm rounded"/>
                <button onClick={saveTemplateToDB} className="bg-teal-500 w-full py-1 rounded text-sm font-bold">تأكيد الحفظ</button>
              </div>
            )}
          </div>
        )}
        <button onClick={() => window.print()} className="bg-[#c5a059] py-3 rounded font-bold mt-auto">طباعة (PDF)</button>
      </div>
      <div className="flex-1 overflow-y-auto p-10 flex justify-center bg-gray-200">
        <div className="a4-page bg-white p-12 relative" id="printArea">
           <img src={getImg("1I5KIPkeuwJ0CawpWJLpiHdmofSKLQglN")} className="h-20 mb-8 object-contain" alt="logo" />
           <p className="text-sm font-bold mb-4">{data.date}</p>
           <h3 className="text-xl font-bold mb-4">{data.recipient}</h3>
           <h2 className="text-center font-bold text-xl underline mb-8">{data.subject}</h2>
           <div className="whitespace-pre-line leading-loose text-lg">{data.body}</div>
           <div className="mt-20 flex justify-between">
              <div className="w-48">{data.showStamp && <img src={getImg("1lCYGae5VrEMVh8OEKHHBWTxLPJH7t0u5")} alt="stamp"/>}</div>
              <div className="text-center"><p className="font-bold text-xl">{data.signTitle}</p><p className="text-lg">{data.signName}</p></div>
           </div>
        </div>
      </div>
    </div>
  );
};

const PartnersView = () => <div id="partners-section"></div>;
const LegalPage = ({ title, navigateTo }) => <div>{title} <button onClick={()=>navigateTo("home")}>عودة</button></div>;

export default function App() {
  const [currentPage, setCurrentPage] = useState("home");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState({ show: false, title: "", desc: "", type: "success" });
  const [navVisible, setNavVisible] = useState(true);
  const [adminUser, setAdminUser] = useState(null);
  const [customer, setCustomer] = useState(null);

  const showToast = (title, desc, type = "success") => {
    setToast({ show: true, title, desc, type });
    setTimeout(() => setToast({ show: false }), 3000);
  };
  const navigateTo = (page) => { setCurrentPage(page); window.scrollTo(0, 0); };
  const hideNavOn = ["login", "customer-login", "dashboard", "letter-generator"];

  return (
    <div dir="rtl" className="min-h-screen flex flex-col font-cairo bg-slate-50">
      <GlobalStyles />
      <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-white px-8 py-4 rounded-xl shadow-2xl transition-all no-print ${toast.show ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"}`}>
        <p className="font-bold">{toast.title}</p><p className="text-sm text-gray-500">{toast.desc}</p>
      </div>
      {!hideNavOn.includes(currentPage) && (
        <nav className="bg-white/95 shadow-sm fixed w-full z-50 p-4 flex justify-between">
          <img src={getImg("1I5KIPkeuwJ0CawpWJLpiHdmofSKLQglN")} className="h-10 cursor-pointer" onClick={()=>navigateTo("home")} alt="logo" />
          <div className="hidden md:flex gap-6 items-center">
            <button onClick={()=>navigateTo("home")}>الرئيسية</button>
            <button onClick={()=>navigateTo("login")} className="text-[#c5a059]">دخول الموظفين</button>
          </div>
        </nav>
      )}
      <div className="flex-grow">
        {currentPage === "home" && <HomeView navigateTo={navigateTo} />}
        {currentPage === "about" && <AboutView />}
        {currentPage === "projects" && <ProjectsView />}
        {currentPage === "contact" && <ContactView showToast={showToast} />}
        {currentPage === "customer-login" && <CustomerLoginView setCustomer={setCustomer} navigateTo={navigateTo} showToast={showToast} />}
        {currentPage === "maintenance" && <MaintenanceView customer={customer} setCustomer={setCustomer} navigateTo={navigateTo} showToast={showToast} />}
        {currentPage === "login" && <AdminLoginView setUser={setAdminUser} navigateTo={navigateTo} showToast={showToast} />}
        {currentPage === "dashboard" && <DashboardView user={adminUser} setUser={setAdminUser} navigateTo={navigateTo} showToast={showToast} />}
        {currentPage === "letter-generator" && <LetterGeneratorView user={adminUser} navigateTo={navigateTo} showToast={showToast} />}
      </div>
    </div>
  );
}