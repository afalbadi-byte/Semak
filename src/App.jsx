import React, { useState, useEffect } from 'react';
import {
  ArrowLeft, ArrowRight, Award, Bath, Bed, Box, Building, CalendarDays, Car, Calculator,
  ChevronDown, CircleCheckBig, CircleCheck, Clock, Droplets, ExternalLink, Eye,
  FilePenLine, Fingerprint, GanttChartSquare, HardHat, HousePlus, House, Layers, LayoutGrid, Leaf,
  ListChecks, Lock, LogOut, MapPin, Menu, MessageCircle, Moon, Phone, Plane,
  Printer, QrCode, Receipt, RefreshCw, Ruler, Search, Send, ShieldCheck,
  ShoppingCart, Target, TramFront, TreePine, Umbrella, UserCheck, UserCog, User,
  Users, Wifi, Wrench, X, ZoomIn, Shield, CheckSquare
} from 'lucide-react';

// --- Global Constants ---
// 🔴 رابط ملف API الخاص بك 🔴
const API_URL = "https://semak.sa/api.php"; 

const ADMIN_CREDS = {
  id: 999,
  name: "Ahmed.F Al-Badi (Admin)",
  role: "admin",
  job: "المدير العام",
  email: "ahmed.albadi@semak.sa",
  pass: "Medo@3225"
};

const TIME_SLOTS = [
  "08:00 ص - 10:00 ص",
  "10:00 ص - 12:00 م",
  "01:00 م - 03:00 م",
  "04:00 م - 06:00 م"
];

// قائمة الوحدات لإدارة الصلاحيات
const APP_MODULES = [
  { id: "maintenance", label: "إدارة طلبات الصيانة", icon: Wrench, color: "text-purple-600", bg: "bg-purple-50" },
  { id: "letters", label: "منشئ الخطابات", icon: FilePenLine, color: "text-orange-500", bg: "bg-orange-50" },
  { id: "qr", label: "رموز الوحدات (QR)", icon: QrCode, color: "text-slate-800", bg: "bg-slate-100" },
  { id: "leads", label: "سجل المهتمين (Leads)", icon: Users, color: "text-teal-600", bg: "bg-teal-50" },
  { id: "accounting", label: "النظام المحاسبي (دفترة)", icon: Calculator, color: "text-emerald-600", bg: "bg-emerald-50" },
  { id: "users_manage", label: "إدارة الموظفين والصلاحيات", icon: Shield, color: "text-[#1a365d]", bg: "bg-blue-50" }
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
    
    @keyframes marquee { 
        0% { transform: translateX(0%); } 
        100% { transform: translateX(-100%); } 
    }
    .marquee-container { 
        display: flex; overflow: hidden; width: 100%; direction: ltr; 
    }
    .marquee-content { 
        display: flex; min-width: 100%; flex-shrink: 0; align-items: center; justify-content: space-around; animation: marquee 25s linear infinite; 
    }
    .marquee-container:hover .marquee-content { animation-play-state: paused; }
    
    /* Print Styles */
    .a4-page {
        width: 210mm; min-height: 297mm; height: auto; background: white; margin: 0 auto;
        position: relative; padding: 0; display: flex; flex-direction: column; overflow: hidden;
        box-shadow: 0 0 20px rgba(0,0,0,0.15); color: #333; transform-origin: top center;
    }
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
          <div className="px-2">
            <span className="block text-3xl md:text-4xl font-black text-white mb-1">07</span>
            <p className="text-[#c5a059] font-bold uppercase text-[10px] md:text-xs tracking-widest">وحدات سكنية</p>
          </div>
          <div className="px-2">
            <span className="block text-3xl md:text-4xl font-black text-white mb-1">+200</span>
            <p className="text-[#c5a059] font-bold uppercase text-[10px] md:text-xs tracking-widest">متر مربع مساحة</p>
          </div>
          <div className="px-2">
            <span className="block text-3xl md:text-4xl font-black text-white mb-1">10</span>
            <p className="text-[#c5a059] font-bold uppercase text-[10px] md:text-xs tracking-widest">سنوات ضمان</p>
          </div>
          <div className="px-2 border-none">
            <span className="block text-3xl md:text-4xl font-black text-white mb-1">100%</span>
            <p className="text-[#c5a059] font-bold uppercase text-[10px] md:text-xs tracking-widest">تملك حر</p>
          </div>
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
        <div className="absolute top-10 left-10 text-[200px] text-slate-50 font-black leading-none -z-10 select-none hidden md:block">01</div>
        <div className="container mx-auto px-6 relative z-10 max-w-5xl text-center">
          <div className="inline-block px-6 py-2 rounded-full bg-slate-100 text-[#1a365d] font-bold mb-8 shadow-sm">قصتنا</div>
          <h2 className="text-4xl md:text-6xl font-black text-[#1a365d] mb-10 leading-tight">سماك العقارية</h2>
          <p className="text-xl md:text-2xl text-slate-600 leading-loose font-light relative">
            <span className="text-6xl text-[#c5a059]/20 absolute -top-8 -right-8 font-serif">"</span>
            في قلب مكة المكرمة، حيث تلتقي الروحانية بطموح المستقبل، ولدت <strong>سماك</strong>. لم نأتِ لنبني مجرد جدران وأسقف، بل لنرسم أسلوب حياة يتناغم مع قدسية المكان. نؤمن بأن السكن هو امتداد للإنسان، لذا نصيغ مجتمعاتنا بعناية لتكون ملاذاً ذكياً ومستداماً، يمنحك شعوراً عميقاً بالانتماء والرفاهية، مساهمين بذلك في كتابة فصل جديد من قصة التطور العمراني في أطهر البقاع.
            <span className="text-6xl text-[#c5a059]/20 absolute -bottom-12 -left-8 font-serif">"</span>
          </p>
        </div>
      </div>

      <div className="py-24 bg-slate-50 relative">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/diagmonds-light.png')] opacity-40" />
        <div className="container mx-auto px-6 relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
          <div className="bg-white p-10 rounded-[3rem] shadow-xl border-t-8 border-[#1a365d] hover:-translate-y-2 transition-transform duration-500 group">
            <div className="flex items-center gap-6 mb-6">
              <div className="w-20 h-20 bg-[#1a365d]/5 rounded-2xl flex items-center justify-center text-[#1a365d] text-4xl group-hover:bg-[#1a365d] group-hover:text-white transition-colors duration-300">
                <Eye size={40} />
              </div>
              <h3 className="text-4xl font-black text-[#1a365d]">الرؤية</h3>
            </div>
            <p className="text-slate-600 text-lg leading-loose text-justify border-r-4 border-slate-100 pr-6">
              الريادة في صياغة مفهوم السكن العصري في مكة المكرمة، عبر تطوير مجتمعات عمرانية ذكية ومستدامة ترفع جودة الحياة وتواكب طموحات رؤية المملكة 2030 في إثراء المشهد الحضري.
            </p>
          </div>
          <div className="bg-white p-10 rounded-[3rem] shadow-xl border-t-8 border-[#c5a059] hover:-translate-y-2 transition-transform duration-500 group">
            <div className="flex items-center gap-6 mb-6">
              <div className="w-20 h-20 bg-[#c5a059]/5 rounded-2xl flex items-center justify-center text-[#c5a059] text-4xl group-hover:bg-[#c5a059] group-hover:text-white transition-colors duration-300">
                <Target size={40} />
              </div>
              <h3 className="text-4xl font-black text-[#1a365d]">الرسالة</h3>
            </div>
            <p className="text-slate-600 text-lg leading-loose text-justify border-r-4 border-slate-100 pr-6">
              تقديم منتجات عقارية نوعية تجمع بين روحانية الجوار وأحدث تقنيات البناء الذكي، ملتزمين بأعلى معايير الجودة والخصوصية، لنخلق فرصاً استثمارية وسكنية آمنة تحقق الرفاهية.
            </p>
          </div>
        </div>
      </div>

      <div className="py-24 bg-[#1a365d] relative overflow-hidden">
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(#c5a059 1px, transparent 1px)", backgroundSize: "30px 30px" }} />
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <span className="text-[#c5a059] font-bold tracking-[0.3em] uppercase text-sm">التزامنا</span>
            <h3 className="text-4xl md:text-5xl font-black text-white mt-2">قيمنا الراسخة</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {values.map((val, idx) => {
              const Icon = val.icon;
              let bg = "from-blue-400 to-blue-600 shadow-blue-500/30";
              if (val.color === "red") bg = "from-red-400 to-red-600 shadow-red-500/30";
              if (val.color === "amber") bg = "from-amber-400 to-amber-600 shadow-amber-500/30";
              
              return (
                <div key={idx} className="bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-[2.5rem] hover:bg-white/10 transition-colors duration-300 group">
                  <div className={`w-16 h-16 bg-gradient-to-br ${bg} rounded-2xl flex items-center justify-center text-white mb-6 shadow-lg group-hover:scale-110 transition-transform`}>
                    <Icon size={32} />
                  </div>
                  <h4 className="text-2xl font-bold text-white mb-4">{val.title}</h4>
                  <p className="text-slate-300 leading-relaxed">{val.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="py-24 bg-slate-900 text-white relative overflow-hidden" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1565552629477-ff14d7acd490?q=80&w=2070&auto=format&fit=crop')", backgroundSize: "cover", backgroundPosition: "center", backgroundAttachment: "fixed" }}>
        <div className="absolute inset-0 bg-[#1a365d]/80" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-16 flex flex-col md:flex-row items-center justify-center gap-6">
            <h3 className="text-3xl md:text-4xl font-bold">ركائزنا المتوافقة مع</h3>
            <img src={getImg("1ZyQiajC0S8NhwqOczZ8jtpaKLMUz2weR")} alt="رؤية 2030" className="h-16 md:h-20 w-auto opacity-90 hover:opacity-100 transition-opacity duration-300 mix-blend-screen" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            {pillars.map((pillar, idx) => {
              const Icon = pillar.icon;
              return (
                <div key={idx} className="text-center p-6 bg-white/5 rounded-3xl border border-white/5 backdrop-blur-sm hover:bg-white/10 transition duration-300">
                  <div className="w-16 h-16 mx-auto bg-white/10 rounded-full flex items-center justify-center mb-4 text-[#c5a059]">
                    <Icon size={28} />
                  </div>
                  <h4 className="text-xl font-bold mb-2">{pillar.title}</h4>
                  <p className="text-slate-300 text-sm">{pillar.desc}</p>
                </div>
              );
            })}
          </div>
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

  const floors = [
    { id: "ground", label: "الدور الأرضي" },
    { id: "first", label: "الدور الأول" },
    { id: "second", label: "الدور الثاني" },
    { id: "third", label: "الدور الثالث" },
    { id: "fourth", label: "الدور الرابع" }
  ];

  const unitsData = {
    first: [
      { id: "sm-a01", title: "وحدة SM-A01", price: "720,000 ريال", badge: "واجهتين", isSpecial: true },
      { id: "sm-a02", title: "وحدة SM-A02", price: "700,000 ريال", badge: "واجهة أمامية", isSpecial: false }
    ],
    second: [
      { id: "sm-a03", title: "وحدة SM-A03", price: "720,000 ريال", badge: "واجهتين", isSpecial: true },
      { id: "sm-a04", title: "وحدة SM-A04", price: "700,000 ريال", badge: "واجهة أمامية", isSpecial: false }
    ],
    third: [
      { id: "sm-a05", title: "وحدة SM-A05", price: "720,000 ريال", badge: "واجهتين", isSpecial: true, isSold: true },
      { id: "sm-a06", title: "وحدة SM-A06", price: "700,000 ريال", badge: "واجهة أمامية", isSpecial: false }
    ],
    fourth: [
      { id: "sm-a07", title: "وحدة SM-A07", price: "1,100,000 ريال", badge: "فيلا روف فاخرة", isSpecial: true, isSold: true, roof: true }
    ]
  };

  const images = {
    ground: getImg("1WCjS9UTiXUV8oSWjbsZgbHQuWFhU-F31"),
    first: getImg("1_SOkisFdEjokohC6DwFjJAakT0DxJild"),
    second: getImg("1o0NXJ_iC-LhrvDIC4i_uOy0WSfJfsAG1"),
    third: getImg("1MZuAEed1Vdn70eknds87xSInFEPINogE"),
    fourth: getImg("1dMNgoNkLMjmjOeHA1R98ApKOX8yFK1y1")
  };

  return (
    <div className="pt-32 pb-20 bg-slate-50 min-h-screen">
      {previewImg && (
        <div className="fixed inset-0 bg-black/90 z-[9999] flex items-center justify-center p-4 cursor-pointer" onClick={() => setPreviewImg(null)}>
          <img src={previewImg} className="max-w-full max-h-screen rounded-lg shadow-2xl" alt="مخطط مكبر" />
          <button className="absolute top-4 right-4 text-white p-2">
            <X size={40} />
          </button>
        </div>
      )}
      <div className="container mx-auto px-6 mb-24">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-[#c5a059] font-black tracking-[0.3em] uppercase text-sm mb-4 leading-tight">مشاريعنا</h2>
          <h3 className="text-4xl md:text-5xl font-black text-[#1a365d] mb-8">سماك - البوابة 1</h3>
          <p className="text-slate-500 text-lg">لم نهتم فقط بالبناء، بل صممنا نمط حياة يجمع بين الأصالة والحداثة ليكون منزلك هو واحتك الخاصة.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-[2rem] card-hover border border-slate-100 group">
            <div className="w-12 h-12 bg-blue-50 text-[#1a365d] rounded-xl flex items-center justify-center mb-4 group-hover:bg-[#1a365d] group-hover:text-white transition-colors duration-500">
              <HousePlus size={24} />
            </div>
            <h4 className="text-xl font-black text-[#1a365d] mb-3">بيئة ذكية متكاملة</h4>
            <p className="text-slate-500 text-sm leading-relaxed">وحدات مجهزة بالكامل بأنظمة الإنارة والدخول الذكي، مع بنية تحتية مرنة تتيح لك التوسع وإضافة المزيد.</p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] card-hover border border-slate-100 group">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-red-600 group-hover:text-white transition-colors duration-500">
              <ShieldCheck size={24} />
            </div>
            <h4 className="text-xl font-black text-[#1a365d] mb-3">أمان العائلة أولاً</h4>
            <p className="text-slate-500 text-sm leading-relaxed">أنظمة مراقبة CCTV متطورة، وأقفال إلكترونية ذكية تضمن لك ولعائلتك أقصى درجات الحماية.</p>
          </div>
          <div className="bg-white p-6 rounded-[2rem] card-hover border border-slate-100 group">
            <div className="w-12 h-12 bg-amber-50 text-[#c5a059] rounded-xl flex items-center justify-center mb-4 group-hover:bg-[#c5a059] group-hover:text-white transition-colors duration-500">
              <Award size={24} />
            </div>
            <h4 className="text-xl font-black text-[#1a365d] mb-3">جودة بلا تنازلات</h4>
            <p className="text-slate-500 text-sm leading-relaxed">استخدام أرقى خامات البورسلان، الرخام، والأدوات الصحية من ماركات عالمية موثوقة.</p>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden bg-cover bg-center py-20 mb-24" style={{ backgroundImage: `url('${getImg("1ahnVUVfBEL8KIY2y1YYJAoupt2WvHRV6")}')` }}>
        <div className="absolute inset-0 bg-[#1a365d]/90" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-16">
            <div>
              <h2 className="text-[#c5a059] font-bold mb-4">الموقع الاستراتيجي</h2>
              <h3 className="text-4xl font-black text-white mb-8">في قلب الحدث، وقريب من خدماتك</h3>
              <div className="grid grid-cols-2 gap-4 text-white">
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm hover:bg-white/10 transition">
                  <div className="flex items-center gap-3 mb-2">
                    <Building className="text-[#c5a059]" size={20} />
                    <span className="font-bold text-lg">15 دقيقة</span>
                  </div>
                  <p className="text-slate-400 text-sm">عن المسجد الحرام</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm hover:bg-white/10 transition">
                  <div className="flex items-center gap-3 mb-2">
                    <TramFront className="text-[#c5a059]" size={20} />
                    <span className="font-bold text-lg">9 دقائق</span>
                  </div>
                  <p className="text-slate-400 text-sm">عن محطة قطار الحرمين</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm hover:bg-white/10 transition">
                  <div className="flex items-center gap-3 mb-2">
                    <Plane className="text-[#c5a059]" size={20} />
                    <span className="font-bold text-lg">50 دقيقة</span>
                  </div>
                  <p className="text-slate-400 text-sm">عن مطار الملك عبدالعزيز</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm hover:bg-white/10 transition">
                  <div className="flex items-center gap-3 mb-2">
                    <Moon className="text-[#c5a059]" size={20} />
                    <span className="font-bold text-lg">مقابل</span>
                  </div>
                  <p className="text-slate-400 text-sm">مسجد </p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm hover:bg-white/10 transition">
                  <div className="flex items-center gap-3 mb-2">
                    <TreePine className="text-[#c5a059]" size={20} />
                    <span className="font-bold text-lg">مقابل</span>
                  </div>
                  <p className="text-slate-400 text-sm">حديقة عامة</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm hover:bg-white/10 transition">
                  <div className="flex items-center gap-3 mb-2">
                    <ShoppingCart className="text-[#c5a059]" size={20} />
                    <span className="font-bold text-lg">5 دقائق</span>
                  </div>
                  <p className="text-slate-400 text-sm">خمسة من المتاجر الكبرى</p>
                </div>
              </div>
            </div>
            <div className="relative h-[500px] map-container">
              <div className="absolute inset-0 bg-slate-800 rounded-[3rem] overflow-hidden shadow-2xl border-8 border-white/5">
                <iframe title="موقع المشروع" width="100%" height="100%" frameBorder="0" style={{ border: 0 }} src="https://maps.google.com/maps?q=حي+البوابة+مكة+المكرمة&hl=ar&z=14&output=embed" allowFullScreen={true} />
              </div>
              <div className="absolute top-10 -right-4 bg-[#c5a059] p-6 rounded-l-[2rem] shadow-2xl z-20">
                <p className="text-white font-black text-2xl">7</p>
                <p className="text-white/80 font-bold text-sm">وحدات<br />فقط</p>
              </div>
              <a href="https://maps.app.goo.gl/nfJhZ8oGvE6ZrbR49" target="_blank" rel="noreferrer" className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white text-[#1a365d] px-8 py-4 rounded-2xl font-bold shadow-2xl hover:bg-[#c5a059] hover:text-white transition flex items-center gap-3 group z-20 whitespace-nowrap">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-white/20 transition">
                  <MapPin size={20} />
                </div>
                <span>افتح الموقع في خرائط جوجل</span>
              </a>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <h2 className="text-[#c5a059] font-black tracking-[0.3em] uppercase text-sm mb-4">مخططات المشروع</h2>
          <h3 className="text-3xl md:text-4xl font-black text-[#1a365d]">اختر الطابق لاستعراض الوحدات</h3>
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
            <h4 className="text-3xl font-black text-[#1a365d] mb-6">مواصفات {floors.find(f => f.id === selectedFloor).label}</h4>
            {selectedFloor === "ground" ? (
              <div className="space-y-4">
                <p className="text-slate-500 mb-8 leading-relaxed">تم تخصيص الدور الأرضي بالكامل لمواقف السيارات والخدمات العامة للمبنى.</p>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 text-[#1a365d] font-bold">
                  <Car className="text-[#c5a059]" /> مواقف خاصة
                </div>
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4 text-[#1a365d] font-bold">
                  <House className="text-[#c5a059]" /> مدخل ومصعد
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {unitsData[selectedFloor].map(unit => (
                  <div key={unit.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 relative overflow-hidden transition-all duration-300 hover:shadow-md">
                    {unit.isSpecial && <div className="absolute top-0 left-0 bg-[#c5a059] text-white text-xs px-3 py-1 rounded-br-lg z-10">مميزة</div>}
                    {unit.isSold && (
                      <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-[1px]">
                        <div className="border-[5px] border-red-600 text-red-600 text-3xl font-black px-6 py-2 rounded-xl transform -rotate-12 opacity-80 shadow-lg tracking-wider">تم البيع / محجوز</div>
                      </div>
                    )}
                    <div className="p-5 cursor-pointer" onClick={() => toggleUnit(unit.id)}>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="block font-bold text-xl text-[#1a365d]">{unit.title}</span>
                          <span className="text-[#c5a059] font-black text-lg">{unit.price}</span>
                        </div>
                        <div className="flex flex-col items-end gap-2 mt-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${unit.isSpecial ? "bg-[#c5a059]/10 text-[#c5a059]" : "bg-slate-100 text-slate-600"}`}>{unit.badge}</span>
                          <ChevronDown className={`text-slate-400 transition-transform duration-300 mt-1 ${expandedUnit === unit.id ? "rotate-180" : ""}`} />
                        </div>
                      </div>
                    </div>
                    {expandedUnit === unit.id && (
                      <div className="px-5 pb-5 bg-slate-50/50 border-t border-slate-100 pt-4 grid grid-cols-2 gap-3 text-sm text-slate-600 animate-fadeIn">
                        <span className="flex items-center gap-2"><Ruler size={16} className="text-[#c5a059]" /> {unit.roof ? "422 م²" : "204 م²"}</span>
                        <span className="flex items-center gap-2"><Bed size={16} className="text-[#c5a059]" /> {unit.roof ? "4 غرف" : "5 غرف"}</span>
                        <span className="flex items-center gap-2"><UserCheck size={16} className="text-[#c5a059]" /> غرفة خادمة</span>
                        <span className="flex items-center gap-2"><Droplets size={16} className="text-[#c5a059]" /> غرفة غسيل</span>
                        {!unit.roof && <span className="flex items-center gap-2"><Fingerprint size={16} className="text-[#c5a059]" /> دخول ذكي</span>}
                        {!unit.roof && <span className="flex items-center gap-2"><Wifi size={16} className="text-[#c5a059]" /> منزل ذكي</span>}
                        {unit.roof && <span className="flex items-center gap-2"><Umbrella size={16} className="text-[#c5a059]" /> سطح خاص كبير</span>}
                        {!unit.roof && <span className="flex items-center gap-2"><Box size={16} className="text-[#c5a059]" /> مستودع</span>}
                        {!unit.roof && <span className="flex items-center gap-2"><Car size={16} className="text-[#c5a059]" /> موقف خاص</span>}
                        <span className="col-span-2 flex items-center gap-2"><Layers size={16} className="text-[#c5a059]" /> خزان أرضي وعلوي مستقل</span>
                        <span className="flex items-center gap-2"><Bath size={16} className="text-[#c5a059]" /> 4 دورات مياه</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="order-1 lg:order-2 h-full min-h-[400px]">
            <div className="relative group cursor-pointer overflow-hidden rounded-3xl shadow-lg border-4 border-white h-full bg-slate-200 flex items-center justify-center" onClick={() => setPreviewImg(images[selectedFloor])}>
              <div className="absolute top-4 left-4 z-20 w-16 h-16 md:w-24 md:h-24 opacity-50 pointer-events-none mix-blend-multiply">
                <img src={getImg("1I5KIPkeuwJ0CawpWJLpiHdmofSKLQglN")} className="w-full h-full object-contain" alt="Logo" />
              </div>
              <img src={images[selectedFloor]} className="w-full h-full object-cover transform group-hover:scale-105 transition duration-700" alt="مخطط" />
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur px-6 py-3 rounded-full text-sm font-bold text-[#1a365d] shadow-lg flex items-center gap-2 transition-transform hover:scale-105">
                <ZoomIn size={16} /> اضغط للتكبير
              </div>
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
};

const AdminLoginView = ({ setUser, navigateTo, showToast }) => {
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
        if (rememberMe) {
          localStorage.setItem("semak_admin_email", email);
          localStorage.setItem("semak_admin_password", password);
        } else {
          localStorage.removeItem("semak_admin_email");
          localStorage.removeItem("semak_admin_password");
        }
        setUser(data.user);
        showToast("تم تسجيل الدخول", `مرحباً بك، ${data.user.name}`);
        
        // التوجيه الذكي حسب نوع الحساب
        if (data.user.role === "technician") {
          navigateTo("tech-dashboard");
        } else {
          navigateTo("dashboard");
        }
      } else {
        showToast("خطأ", data.message, "error");
      }
    } catch {
      showToast("خطأ", "فشل الاتصال بالسيرفر", "error");
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
          <button onClick={() => navigateTo("home")} className="text-slate-400 hover:text-[#1a365d] text-sm flex items-center justify-center gap-2 mx-auto transition">
            <ArrowRight size={14} /> العودة للموقع الرئيسي
          </button>
        </div>
      </div>
    </div>
  );
};

const CustomerLoginView = ({ setCustomer, navigateTo, showToast }) => {
  const handleLogin = (e) => {
    e.preventDefault();
    const user = e.target.user.value;
    const pass = e.target.password.value;
    if (user === "user" && pass === "user") {
      setCustomer({ username: "user", name: "عميل تجريبي", unit: "SM-A01" });
      showToast("تم تسجيل الدخول بنجاح", "مرحباً بك في بوابة العملاء");
      navigateTo("maintenance");
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
          <button onClick={() => navigateTo("home")} className="text-slate-400 hover:text-[#1a365d] text-sm flex items-center justify-center gap-2 mx-auto transition">
            <ArrowRight size={14} /> العودة للموقع الرئيسي
          </button>
        </div>
      </div>
    </div>
  );
};

const MaintenanceView = ({ customer, setCustomer, navigateTo, showToast }) => {
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState("new");
  const [type, setType] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [ticket, setTicket] = useState(null);

  const handleLogout = () => {
    setCustomer(null);
    showToast("تم تسجيل الخروج", "نتمنى لك يوماً سعيداً");
    navigateTo("home");
  };

  const submitTicket = async (e) => {
    e.preventDefault();
    if (!date || !time) {
      showToast("تنبيه", "يرجى اختيار التاريخ والوقت المناسب لزيارة الفني", "error");
      return;
    }
    setLoading(true);
    
    // إزالة الربط التلقائي بالفني وإسناده لـ "لم يتم التعيين"
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
      // تعيين الفني الافتراضي إلى "لم يتم التعيين"
      setTicket({...payload, id: result.id, status: "قيد الانتظار", technician: "لم يتم التعيين", scheduleDate: date, scheduleTime: time});
      setTab("track");
    } catch {
      showToast("تنبيه", "حدث خطأ. حاول لاحقاً.", "error");
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
};

// --- بوابة الفنيين (جديدة) ---
const TechDashboardView = ({ user, setUser, navigateTo, showToast }) => {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [otpInputs, setOtpInputs] = useState({});

  const handleLogout = () => {
    setUser(null);
    navigateTo("home");
  };

  const loadMyTickets = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=get_maintenance`);
      let data = await res.json();
      
      // جلب المهام وتصفيتها لتظهر مهام هذا الفني فقط
      const myTickets = data.filter(t => t.technician === user.name).map(row => {
         let desc = row.descrip || "---";
         let scheduleDate = row.date ? row.date.split(" ")[0] : "";
         let scheduleTime = "غير محدد";
         if (desc.includes("التاريخ المفضل:")) {
           const dateMatch = desc.match(/التاريخ المفضل: (.*)/);
           if (dateMatch) scheduleDate = dateMatch[1];
           const timeMatch = desc.match(/الوقت المفضل: (.*)/);
           if (timeMatch) scheduleTime = timeMatch[1];
           desc = desc.split(`\n\nالوصف:\n`)[1] || desc;
         }
         return { ...row, scheduleDate, scheduleTime, desc };
      });
      setTickets(myTickets);
    } catch (err) {
      showToast("خطأ", "تعذر جلب المهام", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadMyTickets(); }, []);

  const updateStatus = async (id, newStatus) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
    try {
      const res = await fetch(`${API_URL}?action=update_maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: id, field_name: "status", new_value: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        showToast("تم التحديث", `تم تحديث حالة الطلب إلى: ${newStatus}`);
      }
    } catch (error) { showToast("خطأ", "تعذر الاتصال بقاعدة البيانات.", "error"); }
  };

  const handleOtpSubmit = (ticket) => {
    const enteredOtp = otpInputs[ticket.id];
    if (enteredOtp === ticket.otp) {
      updateStatus(ticket.id, "مكتمل");
    } else {
      showToast("رمز خاطئ", "رمز التفعيل (OTP) غير صحيح، يرجى التأكد من العميل.", "error");
    }
  };

  return (
    <div className="pt-24 pb-20 bg-slate-50 min-h-screen">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-black text-[#1a365d]">بوابة المهام</h1>
            <p className="text-slate-500 text-sm mt-1">الفني: <span className="font-bold text-[#c5a059]">{user?.name}</span></p>
          </div>
          <button onClick={handleLogout} className="bg-red-50 text-red-600 p-3 rounded-xl hover:bg-red-600 hover:text-white transition">
            <LogOut size={20} />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-[#c5a059]"><RefreshCw className="animate-spin inline mr-2" /> جاري التحميل...</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-100"><p className="text-slate-500">لا توجد لديك مهام مسندة حالياً.</p></div>
        ) : (
          <div className="space-y-4">
            {tickets.map(ticket => (
              <div key={ticket.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-2">
                    <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-lg text-xs font-black">#{ticket.id}</span>
                    <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-lg text-xs font-bold">{ticket.type}</span>
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold ${ticket.status === 'مكتمل' ? 'bg-green-100 text-green-700' : ticket.status === 'جاري العمل' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                    {ticket.status}
                  </span>
                </div>
                
                <h3 className="font-black text-lg text-[#1a365d] mb-2">{ticket.unit}</h3>
                <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-600 mb-4 border border-slate-100">
                  <div className="flex items-center gap-2 mb-2 font-bold text-[#1a365d]"><CalendarDays size={16} className="text-[#c5a059]"/> {ticket.scheduleDate} | {ticket.scheduleTime}</div>
                  <p className="border-t border-slate-200 pt-2 mt-2 leading-relaxed">{ticket.desc}</p>
                </div>

                {/* أزرار التحكم والإجراءات */}
                {ticket.status === "تم اعتماد الموعد" && (
                  <button onClick={() => updateStatus(ticket.id, "جاري العمل")} className="w-full bg-[#1a365d] text-white py-3 rounded-xl font-bold hover:bg-[#c5a059] transition flex justify-center items-center gap-2 shadow-lg">
                    <Wrench size={18} /> بدء العمل (أنا في الموقع)
                  </button>
                )}

                {ticket.status === "جاري العمل" && (
                  <div className="bg-green-50 p-4 rounded-xl border border-green-200 text-center animate-fadeIn">
                    <label className="block text-sm font-bold text-green-800 mb-2">أدخل رمز الإغلاق (OTP) من العميل لإنهاء المهمة</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" maxLength={4} placeholder="----"
                        value={otpInputs[ticket.id] || ""}
                        onChange={(e) => setOtpInputs({...otpInputs, [ticket.id]: e.target.value})}
                        className="w-full text-center text-xl font-black p-3 rounded-xl border border-green-300 outline-none focus:border-green-500 tracking-widest"
                      />
                      <button onClick={() => handleOtpSubmit(ticket)} className="bg-green-600 text-white px-6 rounded-xl font-bold hover:bg-green-700 transition shadow-md">إغلاق</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// --- لوحة الإدارة ---
const DashboardView = ({ user, setUser, navigateTo, showToast }) => {
  const [activeTab, setActiveTab] = useState("");
  const [leads, setLeads] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [users, setUsers] = useState([]);
  const [techList, setTechList] = useState([]); // قائمة الفنيين من قاعدة البيانات
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState("kanban"); // "kanban" | "calendar" | "gantt"
  const [showAddUser, setShowAddUser] = useState(false);
  const [otpInputs, setOtpInputs] = useState({}); 
  const [selectedUserForPerms, setSelectedUserForPerms] = useState(null);

  // دالة مساعدة للتحقق من الصلاحيات
  const hasPerm = (perm) => {
    if (user?.role === 'admin') return true;
    if (!user?.permissions) return false;
    return user.permissions.includes(perm);
  };

  const handleLogout = () => {
    setUser(null);
    navigateTo("home");
  };

  const loadLeads = async () => {
    setActiveTab("leads");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=get_leads`);
      const data = await res.json();
      setLeads(data);
    } catch (err) {
      showToast("خطأ", "تعذر جلب سجل المهتمين", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setActiveTab("users");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=get_users`);
      const data = await res.json();
      setUsers(data);
      // تحديث قائمة الفنيين من مستخدمي النظام
      setTechList(data.filter(u => u.role === "technician").map(t => t.name));
    } catch (err) {
      showToast("خطأ", "تعذر جلب الموظفين", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadMaintenance = async () => {
    setActiveTab("maintenance");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=get_maintenance`);
      let data = await res.json();
      
      const parsed = data.map(row => {
         let desc = row.descrip || "---";
         let scheduleDate = row.date ? row.date.split(" ")[0] : "";
         let scheduleTime = "غير محدد";
         
         if (desc.includes("التاريخ المفضل:")) {
           const dateMatch = desc.match(/التاريخ المفضل: (.*)/);
           if (dateMatch) scheduleDate = dateMatch[1];
           const timeMatch = desc.match(/الوقت المفضل: (.*)/);
           if (timeMatch) scheduleTime = timeMatch[1];
           desc = desc.split(`\n\nالوصف:\n`)[1] || desc;
         }

         return {
            id: row.id,
            date: row.date,
            scheduleDate,
            scheduleTime,
            name: row.name,
            phone: row.phone,
            unit: row.unit,
            type: row.type,
            desc: desc,
            status: row.status || "قيد الانتظار",
            technician: row.technician || "لم يتم التعيين",
            otp: row.otp 
         };
      });
      setTickets(parsed);

      // جلب الفنيين صامتاً لاستخدامهم في القائمة المنسدلة للتعيين
      fetch(`${API_URL}?action=get_users`)
        .then(res => res.json())
        .then(usersData => setTechList(usersData.filter(u => u.role === "technician").map(t => t.name)))
        .catch(() => {});

    } catch (err) {
      showToast("خطأ", "تعذر جلب تذاكر الصيانة", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = {
      name: e.target.name.value,
      job: e.target.job.value,
      email: e.target.email.value,
      role: e.target.role.value,
      password: e.target.password.value
    };
    try {
      const res = await fetch(`${API_URL}?action=add_user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast("تم", data.message);
        e.target.reset();
        setShowAddUser(false);
        loadUsers();
      }
    } catch { showToast("خطأ", "فشل الاتصال", "error"); }
    finally { setLoading(false); }
  };

  const handleSavePermissions = async (userId, newPerms) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=update_permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, permissions: newPerms })
      });
      const data = await res.json();
      if (data.success) {
        showToast("تم الحفظ", data.message);
        loadUsers(); 
        setSelectedUserForPerms(null); 
      } else {
        showToast("خطأ", data.message, "error");
      }
    } catch { showToast("خطأ", "فشل الاتصال", "error"); }
    finally { setLoading(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=change_password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          old_password: e.target.old_password.value,
          new_password: e.target.new_password.value
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast("نجاح", data.message);
        e.target.reset();
      } else {
        showToast("خطأ", data.message, "error");
      }
    } catch { showToast("خطأ", "فشل الاتصال", "error"); }
    finally { setLoading(false); }
  };

  const updateTicketStatus = async (id, field, value) => {
    let newOtp = null;
    let apiField = field;
    let apiValue = value;

    // 1. تحديد التذكرة الحالية وتحديثها في الواجهة فوراً
    setTickets(prev => prev.map(t => {
      if (t.id === id) {
        let updatedTicket = { ...t, [field]: value };
        // توليد OTP في حال تم اعتماد الموعد لأول مرة
        if (field === "status" && value === "تم اعتماد الموعد" && !t.otp) {
          newOtp = Math.floor(1000 + Math.random() * 9000).toString();
          updatedTicket.otp = newOtp;
        }
        return updatedTicket;
      }
      return t;
    }));

    // 2. معالجة البيانات لإرسالها للداتابيس
    const currentTicket = tickets.find(t => t.id === id);
    
    // إذا كان التعديل يخص التاريخ أو الوقت، يجب تحديث حقل "descrip" في الداتابيس
    if (field === "scheduleDate" || field === "scheduleTime") {
      apiField = "descrip"; // الحقل الفعلي في قاعدة البيانات
      const updatedDate = field === "scheduleDate" ? value : currentTicket.scheduleDate;
      const updatedTime = field === "scheduleTime" ? value : currentTicket.scheduleTime;
      
      // إعادة بناء النص البرمجي ليقرأه السيرفر ولوحة الفنيين
      apiValue = `الوقت المفضل: ${updatedTime}\nالتاريخ المفضل: ${updatedDate}\n\nالوصف:\n${currentTicket.desc}`;
    }

    try {
      // 3. الإرسال الفعلي للداتابيس
      const payload = { 
        ticket_id: id, 
        field_name: apiField, 
        new_value: apiValue 
      };
      
      // إضافة الـ OTP للطلب إذا وُجد
      if (newOtp) payload.otp = newOtp;

      const res = await fetch(`${API_URL}?action=update_maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      
      const data = await res.json();
      
      if (data.success) {
        showToast("تم التحديث", "تم حفظ التغييرات في قاعدة البيانات");
      } else {
        showToast("خطأ", "فشل الحفظ في السيرفر", "error");
      }
    } catch (error) {
      showToast("خطأ اتصال", "تعذر الوصول للسيرفر"، "error");
    }
  };

  const notifyWhatsApp = (ticket) => {
    if (!ticket.phone || ticket.phone === "---") {
      showToast("خطأ", "رقم جوال العميل غير صالح", "error");
      return;
    }
    let phone = ticket.phone.toString().replace(/^0/, "966").replace(/\D/g, "");
    
    let techText = ticket.technician && ticket.technician !== "لم يتم التعيين" ? `👨‍🔧 الفني المختص: *${ticket.technician}*` : "سيتم إعلامكم باسم الفني لاحقاً.";
    let dateText = ticket.scheduleDate ? `📅 التاريخ: *${ticket.scheduleDate}*\n⏰ الوقت: *${ticket.scheduleTime}*` : "لم يتم تحديد موعد الزيارة بعد.";
    
    let otpText = ticket.otp ? `\n\n🔑 *رمز إغلاق الطلب (OTP):* ${ticket.otp}\n_(يرجى تزويد الفني بهذا الرمز عند **الانتهاء من العمل** لتأكيد إغلاق الطلب بنجاح)_` : "";
    
    let msg = `مرحباً بك عميلنا العزيز من شركة *سماك العقارية* 🏢\n\nبخصوص طلب الصيانة رقم: *${ticket.id}*\nالخاص بوحدة: *${ticket.unit}*\nنوع الطلب: *${ticket.type}*\n\nنفيدكم بأنه تمت مراجعة طلبكم، وحالة الطلب الآن: *${ticket.status}*.\n\n${techText}\n\n*موعد الزيارة (المعتمد / المقترح):*\n${dateText}${otpText}\n\n💡 *(في حال عدم مناسبة الموعد أعلاه، يرجى الرد على هذه الرسالة وسنقوم بتنسيق موعد بديل يناسبكم)*\n\nنسعد بخدمتكم، ونتمنى لكم يوماً سعيداً!`;
    
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const columns = [
    { id: "pending", title: "طلبات ومواعيد جديدة", color: "border-slate-300", bg: "bg-slate-100", text: "text-slate-700", statuses: ["قيد الانتظار", undefined] },
    { id: "active", title: "معتمدة / جاري العمل", color: "border-blue-300", bg: "bg-blue-50", text: "text-blue-700", statuses: ["تم التعيين", "تم اعتماد الموعد", "تم اقتراح موعد بديل", "جاري العمل"] },
    { id: "completed", title: "مكتملة", color: "border-green-300", bg: "bg-green-50", text: "text-green-700", statuses: ["مكتمل"] }
  ];

  const renderTicketCard = (ticket) => (
    <div key={ticket.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-4 hover:shadow-md transition group">
      <div className="flex justify-between items-start mb-3">
        <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-[10px] font-black tracking-wider">#{ticket.id}</span>
        <span className="bg-[#c5a059]/10 text-[#c5a059] px-2 py-1 rounded-full text-[10px] font-bold">{ticket.type} | {ticket.unit}</span>
      </div>
      
      <p className="text-xs text-slate-500 mb-3 line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-100">{ticket.desc}</p>
      
      <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 space-y-3 mt-4">
        <div className="flex items-center gap-2 mb-1">
          <CalendarDays size={14} className="text-blue-600" />
          <span className="text-xs font-bold text-blue-800">إدارة الموعد والتكليف</span>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-500 font-bold block mb-1">تاريخ الزيارة</label>
            <input 
              type="date" 
              value={ticket.scheduleDate || ""} 
              onChange={(e) => updateTicketStatus(ticket.id, "scheduleDate", e.target.value)} 
              className="w-full text-xs font-bold p-2 rounded-lg border border-slate-200 outline-none focus:border-blue-400 bg-white" 
            />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 font-bold block mb-1">وقت الزيارة</label>
            <select 
              value={ticket.scheduleTime || "غير محدد"} 
              onChange={(e) => updateTicketStatus(ticket.id, "scheduleTime", e.target.value)} 
              className="w-full text-xs font-bold p-2 rounded-lg border border-slate-200 outline-none focus:border-blue-400 bg-white"
            >
              <option value="غير محدد" disabled>اختر الوقت</option>
              {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-blue-100">
          <select 
            value={ticket.technician || "لم يتم التعيين"} 
            onChange={(e) => updateTicketStatus(ticket.id, "technician", e.target.value)} 
            className="w-full text-xs font-bold p-2 rounded-lg bg-white border border-slate-200 outline-none focus:border-blue-400 text-slate-700"
          >
            <option value="لم يتم التعيين" disabled>-- إسناد لفني --</option>
            {techList.map(tech => <option key={tech} value={tech}>{tech}</option>)}
          </select>

          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <select 
                value={ticket.status} 
                onChange={(e) => updateTicketStatus(ticket.id, "status", e.target.value)} 
                className={`flex-grow text-xs font-bold p-2 rounded-lg border outline-none ${
                  ticket.status === "مكتمل" ? "bg-green-100 text-green-700 border-green-200" : 
                  ticket.status === "تم اعتماد الموعد" ? "bg-blue-100 text-blue-700 border-blue-200" :
                  "bg-white text-slate-700 border-slate-200"
                }`}
              >
                <option value="قيد الانتظار">قيد الانتظار (طلب جديد)</option>
                <option value="تم التعيين">تم تعيين الفني (بلا موعد مؤكد)</option>
                <option value="تم اعتماد الموعد">تم اعتماد الموعد</option>
                <option value="تم اقتراح موعد بديل">تم اقتراح موعد بديل</option>
                <option value="جاري العمل">جاري العمل</option>
                <option value="مكتمل" disabled={ticket.status === "جاري العمل" && ticket.otp}>مكتمل (يتطلب رمز العميل)</option>
              </select>
              
              <button 
                onClick={() => notifyWhatsApp(ticket)} 
                className="w-10 flex-shrink-0 bg-green-500 text-white rounded-lg flex items-center justify-center hover:bg-green-600 transition shadow-md shadow-green-200" 
                title="إرسال الموعد للعميل بالواتساب"
              >
                <MessageCircle size={16} />
              </button>
            </div>

            {ticket.status === "جاري العمل" && ticket.otp && (
              <div className="flex items-center gap-2 mt-1 p-2 bg-green-50 border border-green-200 rounded-lg animate-fadeIn shadow-inner">
                <Lock size={14} className="text-green-600 flex-shrink-0" />
                <input 
                  type="text" 
                  placeholder="رمز إغلاق الطلب" 
                  maxLength={4}
                  value={otpInputs[ticket.id] || ""}
                  onChange={(e) => setOtpInputs({...otpInputs, [ticket.id]: e.target.value})}
                  className="w-full text-center text-xs font-bold p-1.5 rounded border border-green-300 outline-none focus:border-green-500"
                />
                <button 
                  onClick={() => {
                    if(otpInputs[ticket.id] === ticket.otp) {
                      updateTicketStatus(ticket.id, "status", "مكتمل");
                      showToast("عمل ممتاز!", "تم إغلاق الطلب بناءً على تأكيد العميل.");
                    } else {
                      showToast("رمز خاطئ", "الرمز غير صحيح، يرجى طلبه من العميل.", "error");
                    }
                  }}
                  className="bg-green-500 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-green-600 transition flex-shrink-0 whitespace-nowrap shadow-sm"
                >
                  إغلاق
                </button>
              </div>
            )}
            
            {user?.role === "admin" && ticket.otp && (ticket.status === "تم اعتماد الموعد" || ticket.status === "جاري العمل") && (
               <div className="text-[9px] text-slate-400 text-center mt-1">
                 (للمدير فقط: رمز الإغلاق هو {ticket.otp})
               </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const sortedDates = Object.keys(tickets.reduce((acc, ticket) => {
    const date = ticket.scheduleDate || "غير مجدول";
    if (!acc[date]) acc[date] = [];
    acc[date].push(ticket);
    return acc;
  }, {})).sort((a, b) => a === "غير مجدول" ? 1 : b === "غير مجدول" ? -1 : new Date(a) - new Date(b));

  const groupedTickets = tickets.reduce((acc, ticket) => {
    const date = ticket.scheduleDate || "غير مجدول";
    if (!acc[date]) acc[date] = [];
    acc[date].push(ticket);
    return acc;
  }, {});

  return (
    <div className="pt-32 pb-20 bg-slate-50 min-h-screen">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-[#1a365d]">لوحة الخدمات</h1>
            <p className="text-slate-500 mt-2">أهلاً بك، <span className="font-bold text-[#c5a059]">{user?.name}</span></p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setActiveTab("settings")} className="bg-white border border-slate-200 text-slate-700 px-5 py-3 rounded-xl font-bold hover:bg-slate-100 transition flex items-center gap-2">
              <Lock size={16} /> إعدادات الحساب
            </button>
            <button onClick={handleLogout} className="bg-red-50 text-red-600 px-5 py-3 rounded-xl font-bold hover:bg-red-600 hover:text-white transition flex items-center gap-2">
              <LogOut size={16} /> تسجيل خروج
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          
          {/* كرت الموظفين والصلاحيات */}
          {hasPerm("users_manage") && (
            <div onClick={() => {loadUsers(); setActiveTab("users");}} className="bg-white p-8 rounded-[2rem] shadow-lg border border-slate-100 hover:-translate-y-2 hover:shadow-2xl transition duration-300 cursor-pointer group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-[#1a365d]" />
              <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-3xl text-[#1a365d] mb-6 group-hover:bg-[#1a365d] group-hover:text-white transition-colors">
                <Shield size={32} />
              </div>
              <h3 className="text-2xl font-bold text-[#1a365d] mb-2">الموظفين والصلاحيات</h3>
              <p className="text-slate-500 mb-6">إدارة حسابات الموظفين وتحديد صلاحياتهم.</p>
            </div>
          )}
          
          {/* كرت الخطابات */}
          {hasPerm("letters") && (
            <div onClick={() => navigateTo("letter-generator")} className="bg-white p-8 rounded-[2rem] shadow-lg border border-slate-100 hover:-translate-y-2 hover:shadow-2xl transition duration-300 cursor-pointer group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-[#c5a059]" />
              <div className="w-16 h-16 bg-orange-50 rounded-2xl flex items-center justify-center text-3xl text-[#c5a059] mb-6 group-hover:bg-[#c5a059] group-hover:text-white transition-colors">
                <FilePenLine size={32} />
              </div>
              <h3 className="text-2xl font-bold text-[#1a365d] mb-2">منشئ الخطابات</h3>
              <p className="text-slate-500 mb-6">إنشاء وطباعة خطابات رسمية.</p>
            </div>
          )}

          {/* كرت الصيانة */}
          {hasPerm("maintenance") && (
            <div onClick={loadMaintenance} className="bg-white p-8 rounded-[2rem] shadow-lg border border-slate-100 hover:-translate-y-2 hover:shadow-2xl transition duration-300 cursor-pointer group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-purple-500" />
              <div className="w-16 h-16 bg-purple-50 rounded-2xl flex items-center justify-center text-3xl text-purple-600 mb-6 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                <Wrench size={32} />
              </div>
              <h3 className="text-2xl font-bold text-[#1a365d] mb-2">طلبات الصيانة</h3>
              <p className="text-slate-500 mb-6">توزيع آلي، تقويم، ولوحة مهام احترافية.</p>
            </div>
          )}

          {/* كرت النظام المحاسبي (جديد) */}
          {hasPerm("accounting") && (
            <div onClick={() => window.open("https://semak.daftra.com/", "_blank")} className="bg-white p-8 rounded-[2rem] shadow-lg border border-slate-100 hover:-translate-y-2 hover:shadow-2xl transition duration-300 cursor-pointer group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />
              <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center text-3xl text-emerald-600 mb-6 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                <Calculator size={32} />
              </div>
              <h3 className="text-2xl font-bold text-[#1a365d] mb-2">النظام المحاسبي</h3>
              <p className="text-slate-500 mb-6">الدخول إلى منصة دفترة لإدارة الحسابات والفواتير.</p>
              <div className="flex items-center text-emerald-600 font-bold group-hover:gap-2 transition-all">
                فتح دفترة <ExternalLink size={16} className="mr-2" />
              </div>
            </div>
          )}

          {/* كرت QR */}
          {hasPerm("qr") && (
            <div onClick={() => setActiveTab("qr")} className="bg-white p-8 rounded-[2rem] shadow-lg border border-slate-100 hover:-translate-y-2 hover:shadow-2xl transition duration-300 cursor-pointer group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-slate-800" />
              <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center text-3xl text-slate-800 mb-6 group-hover:bg-slate-800 group-hover:text-white transition-colors">
                <QrCode size={32} />
              </div>
              <h3 className="text-2xl font-bold text-[#1a365d] mb-2">رموز الوحدات (QR)</h3>
              <p className="text-slate-500 mb-6">توليد وطباعة رموز QR للعملاء.</p>
            </div>
          )}

          {/* كرت المهتمين */}
          {hasPerm("leads") && (
            <div onClick={loadLeads} className="bg-white p-8 rounded-[2rem] shadow-lg border border-slate-100 hover:-translate-y-2 hover:shadow-2xl transition duration-300 cursor-pointer group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-teal-500" />
              <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center text-3xl text-teal-600 mb-6 group-hover:bg-teal-500 group-hover:text-white transition-colors">
                <Users size={32} />
              </div>
              <h3 className="text-2xl font-bold text-[#1a365d] mb-2">سجل المهتمين (Leads)</h3>
              <p className="text-slate-500 mb-6">متابعة الطلبات الواردة من الموقع الإلكتروني.</p>
            </div>
          )}
        </div>

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden mb-12 p-8 max-w-xl mx-auto animate-fade-in-up">
            <h3 className="text-2xl font-black text-[#1a365d] mb-2 flex items-center gap-2"><Lock className="text-[#c5a059]" /> إعدادات الأمان</h3>
            <p className="text-slate-500 mb-6">تغيير كلمة المرور الخاصة بحسابك.</p>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-bold mb-2 text-[#1a365d]">كلمة المرور الحالية</label>
                <input type="password" name="old_password" required className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl outline-none focus:border-[#c5a059]" />
              </div>
              <div>
                <label className="block text-sm font-bold mb-2 text-[#1a365d]">كلمة المرور الجديدة</label>
                <input type="password" name="new_password" required minLength={6} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl outline-none focus:border-[#c5a059]" />
              </div>
              <button type="submit" disabled={loading} className="w-full bg-[#1a365d] text-white py-3 rounded-xl font-bold hover:bg-[#c5a059] transition mt-4">
                {loading ? <RefreshCw className="animate-spin mx-auto" /> : "حفظ كلمة المرور"}
              </button>
            </form>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === "users" && hasPerm("users_manage") && (
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden mb-12 animate-fade-in-up">
            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-[#1a365d] flex items-center gap-3"><Users className="text-blue-600" /> قائمة الموظفين</h3>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowAddUser(!showAddUser)} className="bg-[#1a365d] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition">
                  {showAddUser ? "إغلاق النموذج" : "إضافة موظف جديد +"}
                </button>
                <button onClick={loadUsers} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-300 transition">
                  <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            {showAddUser && (
              <div className="p-8 bg-blue-50/50 border-b border-slate-100 animate-fadeIn">
                <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label className="text-xs font-bold text-slate-500 mb-1 block">الاسم</label><input required name="name" type="text" className="w-full p-3 rounded-xl border border-slate-200 outline-none" /></div>
                  <div><label className="text-xs font-bold text-slate-500 mb-1 block">المسمى الوظيفي</label><input required name="job" type="text" className="w-full p-3 rounded-xl border border-slate-200 outline-none" /></div>
                  <div><label className="text-xs font-bold text-slate-500 mb-1 block">البريد الإلكتروني</label><input required name="email" type="email" className="w-full p-3 rounded-xl border border-slate-200 outline-none" /></div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">الصلاحية</label>
                    <select name="role" className="w-full p-3 rounded-xl border border-slate-200 outline-none">
                      <option value="employee">موظف (تخصيص الصلاحيات)</option>
                      <option value="admin">مدير (صلاحيات كاملة)</option>
                      <option value="technician">فني صيانة (بوابة الفنيين)</option>
                    </select>
                  </div>
                  <div><label className="text-xs font-bold text-slate-500 mb-1 block">كلمة المرور الافتراضية</label><input required name="password" type="text" defaultValue="123456" className="w-full p-3 rounded-xl border border-slate-200 outline-none" /></div>
                  <div className="flex items-end"><button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold hover:bg-blue-700 transition">حفظ الموظف</button></div>
                </form>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-slate-50 text-slate-600 text-sm uppercase tracking-wider">
                  <tr><th className="px-6 py-4">الاسم</th><th className="px-6 py-4">المنصب</th><th className="px-6 py-4">الصلاحية</th><th className="px-6 py-4">إجراءات</th></tr>
                </thead>
                <tbody className="text-slate-700 divide-y divide-slate-50">
                  {users.map((u) => (
                    <React.Fragment key={u.id}>
                      <tr className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4 font-bold">{u.name}</td>
                        <td className="px-6 py-4 text-slate-500">{u.job} <br/><span className="text-[10px] text-slate-400 font-mono">{u.email}</span></td>
                        <td className="px-6 py-4">
                          {u.role === "admin" ? <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">مدير نظام</span> : 
                           u.role === "technician" ? <span className="bg-[#c5a059]/10 text-[#c5a059] px-2 py-1 rounded text-xs font-bold">فني صيانة</span> :
                           <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded text-xs font-bold">موظف</span>}
                        </td>
                        <td className="px-6 py-4">
                          {u.role !== "admin" && (
                            <button 
                              onClick={() => setSelectedUserForPerms(selectedUserForPerms?.id === u.id ? null : u)} 
                              className="text-[#c5a059] bg-[#c5a059]/10 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-[#c5a059] hover:text-white transition flex items-center gap-1"
                            >
                              <Shield size={14} /> تعديل الصلاحيات
                            </button>
                          )}
                        </td>
                      </tr>
                      
                      {selectedUserForPerms?.id === u.id && (
                        <tr>
                          <td colSpan="4" className="p-0 border-b-2 border-[#c5a059]">
                            <div className="bg-slate-900 p-6 shadow-inner animate-fadeIn relative">
                              <h4 className="text-white font-bold mb-4 flex items-center gap-2"><CheckSquare className="text-[#c5a059]" /> حدد الصفحات المسموح لـ ({u.name}) بالدخول إليها:</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                                {APP_MODULES.map(module => {
                                  let userPerms = [];
                                  try { userPerms = u.permissions ? JSON.parse(u.permissions) : []; } catch(e){}
                                  
                                  const isChecked = selectedUserForPerms.tempPerms ? selectedUserForPerms.tempPerms.includes(module.id) : userPerms.includes(module.id);
                                  
                                  return (
                                    <label key={module.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer border transition-all ${isChecked ? 'bg-white/10 border-[#c5a059]' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                                      <input 
                                        type="checkbox" 
                                        className="w-5 h-5 accent-[#c5a059]" 
                                        checked={isChecked}
                                        onChange={(e) => {
                                          const currentPerms = selectedUserForPerms.tempPerms || userPerms;
                                          const newPerms = e.target.checked ? [...currentPerms, module.id] : currentPerms.filter(p => p !== module.id);
                                          setSelectedUserForPerms({...selectedUserForPerms, tempPerms: newPerms});
                                        }}
                                      />
                                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${module.bg} ${module.color}`}>
                                        <module.icon size={16} />
                                      </div>
                                      <span className="text-sm font-bold text-slate-200">{module.label}</span>
                                    </label>
                                  )
                                })}
                              </div>
                              <div className="flex justify-end gap-3 border-t border-slate-700 pt-4 mt-2">
                                <button onClick={() => setSelectedUserForPerms(null)} className="px-5 py-2 text-slate-400 font-bold hover:text-white transition text-sm">إلغاء</button>
                                <button onClick={() => handleSavePermissions(u.id, selectedUserForPerms.tempPerms || [])} className="bg-[#c5a059] text-white px-6 py-2 rounded-xl font-bold hover:bg-yellow-600 transition flex items-center gap-2 text-sm">
                                  {loading ? <RefreshCw size={16} className="animate-spin" /> : <Shield size={16} />} حفظ الصلاحيات للموظف
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Maintenance Tab */}
        {activeTab === "maintenance" && hasPerm("maintenance") && (
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden mb-12 animate-fade-in-up">
            <div className="p-6 md:p-8 border-b border-slate-200 bg-slate-50 flex flex-col md:flex-row justify-between items-center gap-6">
              <div>
                <h3 className="text-2xl font-black text-[#1a365d] flex items-center gap-3"><Wrench className="text-purple-600" /> إدارة مهام الصيانة</h3>
                <p className="text-slate-500 text-sm mt-1">توزيع المهام، تحديث الحالة، ومراسلة العميل بسهولة.</p>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                <div className="bg-white p-1 rounded-xl shadow-sm border border-slate-200 flex overflow-hidden">
                  <button onClick={() => setViewMode("kanban")} className={`px-4 py-2 text-sm font-bold flex items-center gap-2 transition ${viewMode === "kanban" ? "bg-purple-100 text-purple-700" : "text-slate-500 hover:bg-slate-50"}`}>
                    <LayoutGrid size={16} /> اللوحة
                  </button>
                  <button onClick={() => setViewMode("calendar")} className={`px-4 py-2 text-sm font-bold flex items-center gap-2 transition border-l border-r border-slate-100 ${viewMode === "calendar" ? "bg-purple-100 text-purple-700" : "text-slate-500 hover:bg-slate-50"}`}>
                    <CalendarDays size={16} /> التقويم
                  </button>
                  <button onClick={() => setViewMode("gantt")} className={`px-4 py-2 text-sm font-bold flex items-center gap-2 transition ${viewMode === "gantt" ? "bg-purple-100 text-purple-700" : "text-slate-500 hover:bg-slate-50"}`}>
                    <GanttChartSquare size={16} /> مخطط جانت
                  </button>
                </div>
                <button onClick={loadMaintenance} className="bg-[#1a365d] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition flex items-center gap-2 shadow-sm w-full sm:w-auto justify-center">
                  {loading ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />} تحديث
                </button>
              </div>
            </div>

            <div className="p-4 md:p-8 bg-slate-50/50">
              {tickets.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                  <p className="text-lg">لا توجد تذاكر صيانة حالياً...</p>
                </div>
              ) : viewMode === "gantt" ? (
                <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                  <div className="overflow-x-auto">
                    <div className="min-w-[1000px]">
                      <div className="grid grid-cols-[200px_repeat(7,1fr)] bg-slate-100 border-b border-slate-200">
                        <div className="p-4 font-black text-[#1a365d] border-l border-slate-200 flex items-center justify-center">
                          الفنيين / الموارد
                        </div>
                        {[...Array(7)].map((_, index) => {
                          const date = new Date();
                          date.setDate(date.getDate() + index);
                          const offset = date.getTimezoneOffset();
                          const localDate = new Date(date.getTime() - (offset*60*1000));
                          const dateString = localDate.toISOString().split("T")[0];
                          const dayName = new Intl.DateTimeFormat('ar-SA', { weekday: 'long' }).format(date);
                          const isToday = index === 0;

                          return (
                            <div key={index} className={`p-3 text-center border-l border-slate-200 flex flex-col items-center justify-center ${isToday ? 'bg-purple-50' : ''}`}>
                              <span className={`text-xs font-bold mb-1 ${isToday ? 'text-purple-600' : 'text-slate-500'}`}>{dayName}</span>
                              <span className={`text-sm font-black ${isToday ? 'text-purple-700 bg-purple-200 px-2 py-0.5 rounded-md' : 'text-slate-700'}`}>{dateString}</span>
                            </div>
                          );
                        })}
                      </div>

                      {techList.map((tech, techIndex) => (
                        <div key={techIndex} className="grid grid-cols-[200px_repeat(7,1fr)] border-b border-slate-100 hover:bg-slate-50 transition-colors">
                          <div className="p-4 border-l border-slate-200 flex items-center">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 font-bold text-xs flex-shrink-0">
                                <UserCog size={16} />
                              </div>
                              <span className="font-bold text-sm text-[#1a365d] leading-tight">{tech.split(" ")[0]} <br/><span className="text-[10px] text-slate-400 font-normal">{tech.split("(")[1]?.replace(")","") || ""}</span></span>
                            </div>
                          </div>
                          
                          {[...Array(7)].map((_, dayIndex) => {
                            const date = new Date();
                            date.setDate(date.getDate() + dayIndex);
                            const offset = date.getTimezoneOffset();
                            const localDate = new Date(date.getTime() - (offset*60*1000));
                            const dateString = localDate.toISOString().split("T")[0];
                            const isToday = dayIndex === 0;
                            
                            const dayTickets = tickets.filter(t => t.technician === tech && t.scheduleDate === dateString);

                            return (
                              <div key={dayIndex} className={`p-2 border-l border-slate-200 min-h-[100px] relative ${isToday ? 'bg-purple-50/30' : ''}`}>
                                {dayTickets.map(t => {
                                  let bgClass = "bg-slate-100 border-slate-300 text-slate-700";
                                  if(t.status === "تم اعتماد الموعد") bgClass = "bg-blue-100 border-blue-300 text-blue-800 shadow-sm";
                                  if(t.status === "جاري العمل") bgClass = "bg-purple-100 border-purple-300 text-purple-800 shadow-sm";
                                  if(t.status === "مكتمل") bgClass = "bg-green-100 border-green-300 text-green-800";
                                  if(t.status === "تم اقتراح موعد بديل") bgClass = "bg-orange-100 border-orange-300 text-orange-800";

                                  return (
                                    <div key={t.id} className={`mb-2 p-2 rounded-lg border ${bgClass} cursor-pointer hover:scale-105 transition-transform group`} title={t.desc}>
                                      <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] font-black tracking-wider">#{t.id}</span>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/50">{t.unit}</span>
                                      </div>
                                      <div className="flex items-center gap-1 text-[10px] font-bold opacity-80 mb-1">
                                        <Clock size={10} /> {t.scheduleTime !== "غير محدد" && t.scheduleTime ? t.scheduleTime.split(" - ")[0] : "أي وقت"}
                                      </div>
                                      <div className="text-[10px] truncate opacity-90">{t.type}</div>
                                    </div>
                                  )
                                })}
                              </div>
                            );
                          })}
                        </div>
                      ))}
                      
                      <div className="grid grid-cols-[200px_repeat(7,1fr)] bg-red-50/30">
                        <div className="p-4 border-l border-slate-200 flex items-center text-red-600 font-bold text-sm">
                          <span className="flex items-center gap-2"><Lock size={16}/> مهام غير معينة</span>
                        </div>
                        {[...Array(7)].map((_, dayIndex) => {
                            const date = new Date();
                            date.setDate(date.getDate() + dayIndex);
                            const offset = date.getTimezoneOffset();
                            const localDate = new Date(date.getTime() - (offset*60*1000));
                            const dateString = localDate.toISOString().split("T")[0];
                            const unassignedTickets = tickets.filter(t => (t.technician === "لم يتم التعيين" || !t.technician) && t.scheduleDate === dateString);

                            return (
                              <div key={dayIndex} className="p-2 border-l border-slate-200 min-h-[80px]">
                                {unassignedTickets.map(t => (
                                  <div key={t.id} className="mb-2 p-2 rounded-lg border bg-red-100 border-red-200 text-red-700 cursor-pointer">
                                    <div className="flex justify-between items-center mb-1">
                                      <span className="text-[10px] font-black">#{t.id}</span>
                                      <span className="text-[10px] font-bold">{t.unit}</span>
                                    </div>
                                    <div className="text-[10px] truncate">{t.type}</div>
                                  </div>
                                ))}
                              </div>
                            )
                        })}
                      </div>

                    </div>
                  </div>
                </div>
              ) : viewMode === "kanban" ? (
                <div className="flex overflow-x-auto pb-4 gap-6 kanban-scroll items-start">
                  {columns.map(col => {
                    const colTickets = tickets.filter(t => col.statuses.includes(t.status));
                    return (
                      <div key={col.id} className={`w-80 flex-shrink-0 rounded-2xl border-t-4 ${col.color} ${col.bg} p-4 max-h-[800px] overflow-y-auto kanban-scroll flex flex-col`}>
                        <div className="flex justify-between items-center mb-4">
                          <h4 className={`font-black ${col.text} text-lg`}>{col.title}</h4>
                          <span className="bg-white text-slate-500 px-2 py-0.5 rounded-full text-xs font-bold shadow-sm">{colTickets.length}</span>
                        </div>
                        <div className="flex-grow">
                          {colTickets.length === 0 ? <p className="text-xs text-center text-slate-400 py-4">لا توجد مهام</p> : colTickets.map(renderTicketCard)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-8 max-w-5xl mx-auto">
                  {sortedDates.map(dateKey => (
                    <div key={dateKey} className="relative">
                      <div className="sticky top-0 bg-slate-50/90 backdrop-blur-sm z-10 py-2 mb-4 border-b-2 border-purple-200">
                        <h4 className="text-lg font-black text-[#1a365d] flex items-center gap-2">
                          <CalendarDays className="text-purple-600" />
                          {dateKey === "غير مجدول" ? "طلبات غير مجدولة (بدون تاريخ)" : `الزيارات المجدولة ليوم: ${dateKey}`}
                        </h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pl-4">
                        {groupedTickets[dateKey].map(renderTicketCard)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* QR Tab */}
        {activeTab === "qr" && hasPerm("qr") && (
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden mb-12 animate-fade-in-up">
            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-[#1a365d] flex items-center gap-3"><QrCode className="text-slate-800" /> رموز الاستجابة السريعة (QR)</h3>
                <p className="text-slate-500 text-sm mt-1">طباعة هذه رموز ولصقها في الوحدات لطلب الصيانة.</p>
              </div>
              <button onClick={() => window.print()} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-900 transition flex items-center gap-2">
                <Printer size={16} /> طباعة الصفحة
              </button>
            </div>
            <div className="p-8 bg-slate-50/20">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {["SM-A01", "SM-A02", "SM-A03", "SM-A04", "SM-A05", "SM-A06", "SM-A07"].map(unit => {
                  const url = `${window.location.origin + window.location.pathname}?unit=${unit}&auth=smak2026`;
                  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(url)}&margin=10`;
                  return (
                    <div key={unit} className="bg-white p-6 rounded-3xl border border-slate-200 text-center shadow-sm flex flex-col items-center justify-between">
                      <div>
                        <h4 className="font-black text-[#1a365d] text-xl mb-1">{unit}</h4>
                        <p className="text-xs text-slate-400 mb-4">مسح لطلب الصيانة</p>
                      </div>
                      <img src={qrUrl} alt={`QR Code ${unit}`} className="w-full max-w-[150px] mb-4 border-2 border-slate-100 rounded-xl" crossOrigin="anonymous" />
                      <button onClick={() => window.open(qrUrl, "_blank")} className="bg-slate-50 text-slate-600 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-200 transition w-full no-print flex items-center justify-center gap-2">
                        <ExternalLink size={14} /> عرض الصورة
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* Leads Tab */}
        {activeTab === "leads" && hasPerm("leads") && (
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden mb-12 animate-fade-in-up">
            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-6">
              <div>
                <h3 className="text-2xl font-black text-[#1a365d] flex items-center gap-3"><Users className="text-[#c5a059]" /> سجل المهتمين</h3>
                <p className="text-slate-500 text-sm mt-1">يتم جلب البيانات مباشرة من قاعدة البيانات المعتمدة</p>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={loadLeads} className="bg-[#c5a059] text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-yellow-600 transition flex items-center gap-2 shadow-lg shadow-orange-100">
                  {loading ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />} تحديث البيانات
                </button>
              </div>
            </div>
            <div className="p-6 bg-white flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="relative w-full sm:w-96">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="بحث بالاسم أو الجوال..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-12 pl-4 outline-none focus:border-[#c5a059] transition" />
              </div>
              <div className="text-slate-400 text-sm font-bold">العدد الكلي: <span className="text-[#1a365d] text-lg">{leads.filter(l => String(l.name).includes(searchQuery) || String(l.phone).includes(searchQuery)).length}</span></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-slate-50 text-slate-600 text-sm uppercase tracking-wider">
                  <tr>
                    <th className="px-6 py-4 border-b">#</th>
                    <th className="px-6 py-4 border-b">الاسم الكريم</th>
                    <th className="px-6 py-4 border-b">رقم الجوال</th>
                    <th className="px-6 py-4 border-b">الوحدة المهتم بها</th>
                    <th className="px-6 py-4 border-b">تاريخ التسجيل</th>
                  </tr>
                </thead>
                <tbody className="text-slate-700 divide-y divide-slate-50">
                  {loading ? (
                    <tr><td colSpan="5" className="text-center py-12 text-[#c5a059]"><RefreshCw className="animate-spin inline mr-2" /> جاري التحميل...</td></tr>
                  ) : leads.filter(l => String(l.name).includes(searchQuery) || String(l.phone).includes(searchQuery)).map((lead, i) => (
                    <tr key={i} className="hover:bg-blue-50/50 transition-colors duration-200">
                      <td className="px-6 py-4 text-slate-400 text-xs font-mono">{leads.length - i}</td>
                      <td className="px-6 py-4 font-bold text-[#1a365d]">{lead.name}</td>
                      <td className="px-6 py-4 font-sans text-slate-600 font-medium" dir="ltr">{lead.phone}</td>
                      <td className="px-6 py-4"><span className="bg-[#c5a059]/10 text-[#c5a059] px-3 py-1 rounded-full text-xs font-bold border border-[#c5a059]/20">{lead.unit}</span></td>
                      <td className="px-6 py-4 text-sm text-slate-400 font-sans" dir="ltr">{String(lead.date).length > 25 ? String(lead.date).substring(0, 16) + "..." : lead.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const LetterGeneratorView = ({ user, navigateTo, showToast }) => {
  const [data, setData] = useState({
    date: new Date().toISOString().split("T")[0],
    recipient: "شركاء النجاح المحترمين",
    subject: "",
    body: "",
    signName: user?.name || "أحمد البادي",
    signTitle: user?.job || "المدير العام",
    showStamp: user?.role === "admin"
  });

  const [dbTemplates, setDbTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newTempMeta, setNewTempMeta] = useState({ category: "إدارية عامة", title: "" });

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch(`${API_URL}?action=get_templates`);
      const result = await res.json();
      setDbTemplates(result);
    } catch (error) {
      console.error("تعذر جلب النماذج", error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const groupedTemplates = dbTemplates.reduce((acc, curr) => {
    if (!acc[curr.category]) acc[curr.category] = [];
    acc[curr.category].push(curr);
    return acc;
  }, {});

  const handleTemplateChange = (e) => {
    const val = e.target.value;
    if (val === "custom") {
      setData({ ...data, subject: "", body: "" });
      setNewTempMeta({ category: "إدارية عامة", title: "" });
      setShowSaveForm(false);
      return;
    }
    const selected = dbTemplates.find(t => t.id.toString() === val);
    if (selected) {
      setData({ ...data, subject: selected.subject, body: selected.body });
      setNewTempMeta({ category: selected.category, title: selected.title + " - معدل" });
      setShowSaveForm(false);
    }
  };

  const saveTemplateToDB = async () => {
    if (!newTempMeta.title.trim()) {
      showToast("تنبيه", "يرجى كتابة اسم للنموذج الجديد", "error");
      return;
    }
    if (!data.subject.trim() || !data.body.trim()) {
      showToast("تنبيه", "محتوى الخطاب (الموضوع والنص) فارغ!", "error");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}?action=add_template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: newTempMeta.category,
          title: newTempMeta.title,
          subject: data.subject,
          body: data.body
        })
      });
      const result = await res.json();
      if (result.success) {
        showToast("تم بنجاح", "تم حفظ النموذج كنسخة جديدة في قاعدة البيانات.");
        setShowSaveForm(false);
        fetchTemplates();
      } else {
        showToast("خطأ", "حدث خطأ أثناء الحفظ", "error");
      }
    } catch (error) {
      showToast("خطأ اتصال", "فشل الاتصال بالسيرفر", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 h-screen w-screen flex flex-col md:flex-row font-cairo overflow-hidden">
      <div className="w-full md:w-1/3 min-w-[320px] bg-slate-900 text-white flex flex-col shadow-2xl h-full overflow-y-auto no-print">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-[#c5a059] flex items-center gap-2"><FilePenLine /> صانع الخطابات</h2>
          <button onClick={() => navigateTo("dashboard")} className="p-2 bg-slate-800 rounded hover:bg-slate-700 transition"><ArrowRight size={18} /></button>
        </div>
        <div className="p-6 space-y-4 flex-grow">
          <div>
            <label className="text-xs font-bold text-[#c5a059] block mb-2">اختر نموذجاً للبدء</label>
            <select onChange={handleTemplateChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm outline-none text-white focus:border-[#c5a059] transition">
              <option value="custom">-- خطاب جديد (فارغ) --</option>
              {loadingTemplates ? (
                <option disabled>جاري تحميل النماذج...</option>
              ) : (
                Object.keys(groupedTemplates).map(category => (
                  <optgroup key={category} label={category} className="text-[#c5a059] font-bold">
                    {groupedTemplates[category].map(temp => (
                      <option key={temp.id} value={temp.id} className="text-white font-normal">{temp.title}</option>
                    ))}
                  </optgroup>
                ))
              )}
            </select>
          </div>
          <div className="w-full h-px bg-slate-700/50 my-2" />
          
          <div><label className="text-xs text-slate-400 block mb-1">التاريخ</label><input type="date" value={data.date} onChange={e => setData({ ...data, date: e.target.value })} className="w-full bg-slate-800 rounded p-2 text-sm outline-none border border-slate-700 focus:border-[#c5a059] transition" style={{ colorScheme: "dark" }} /></div>
          <div><label className="text-xs text-slate-400 block mb-1">المستلم</label><input type="text" value={data.recipient} onChange={e => setData({ ...data, recipient: e.target.value })} className="w-full bg-slate-800 rounded p-2 text-sm outline-none border border-slate-700 focus:border-[#c5a059] transition" /></div>
          <div><label className="text-xs text-slate-400 block mb-1">الموضوع</label><input type="text" value={data.subject} onChange={e => setData({ ...data, subject: e.target.value })} className="w-full bg-slate-800 rounded p-2 text-sm outline-none font-bold border border-slate-700 focus:border-[#c5a059] transition" /></div>
          <div><label className="text-xs text-slate-400 block mb-1">نص الخطاب</label><textarea rows="8" value={data.body} onChange={e => setData({ ...data, body: e.target.value })} className="w-full bg-slate-800 rounded p-2 text-sm outline-none leading-relaxed border border-slate-700 focus:border-[#c5a059] transition" /></div>
          
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-slate-400 block mb-1">اسم الموقع</label><input type="text" value={data.signName} onChange={e => setData({ ...data, signName: e.target.value })} className="w-full bg-slate-800 rounded p-2 text-sm outline-none border border-slate-700 focus:border-[#c5a059] transition" /></div>
            <div><label className="text-xs text-slate-400 block mb-1">المنصب</label><input type="text" value={data.signTitle} onChange={e => setData({ ...data, signTitle: e.target.value })} className="w-full bg-slate-800 rounded p-2 text-sm outline-none border border-slate-700 focus:border-[#c5a059] transition" /></div>
          </div>
          
          {user?.role === "admin" && (
            <div className="flex justify-between items-center pt-4 border-b border-slate-700 pb-4">
              <span className="text-sm font-bold text-slate-300">إظهار الختم والتوقيع</span>
              <input type="checkbox" checked={data.showStamp} onChange={e => setData({ ...data, showStamp: e.target.checked })} className="w-5 h-5 accent-[#c5a059] cursor-pointer" />
            </div>
          )}

          {user?.role === "admin" && (
            <div className="bg-slate-800/50 p-4 rounded-xl mt-4 border border-slate-700">
              {!showSaveForm ? (
                <button onClick={() => setShowSaveForm(true)} className="w-full text-sm font-bold text-teal-400 hover:text-teal-300 transition flex items-center justify-center gap-2 py-2">
                  <FilePenLine size={16} /> حفظ التعديلات كنموذج جديد
                </button>
              ) : (
                <div className="space-y-3 animate-fadeIn">
                  <div className="text-xs text-slate-400 mb-2 text-center bg-slate-800 p-2 rounded">سيتم حفظ هذا النص كقالب جديد في قاعدة البيانات ليتم استخدامه لاحقاً.</div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">تصنيف النموذج الجديد</label>
                    <select value={newTempMeta.category} onChange={e => setNewTempMeta({...newTempMeta, category: e.target.value})} className="w-full bg-slate-700 rounded p-2 text-sm outline-none border border-slate-600 focus:border-teal-500">
                      <option value="النماذج المالية">النماذج المالية</option>
                      <option value="نماذج العملاء والمبيعات">نماذج العملاء والمبيعات</option>
                      <option value="إدارة الأملاك والصيانة">إدارة الأملاك والصيانة</option>
                      <option value="الشؤون القانونية وإدارة الأملاك">الشؤون القانونية وإدارة الأملاك</option>
                      <option value="الموارد البشرية والموظفين">الموارد البشرية والموظفين</option>
                      <option value="خدمة العملاء">خدمة العملاء</option>
                      <option value="إدارية عامة">إدارية عامة</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">اسم النموذج (في القائمة)</label>
                    <input type="text" value={newTempMeta.title} onChange={e => setNewTempMeta({...newTempMeta, title: e.target.value})} className="w-full bg-slate-700 rounded p-2 text-sm outline-none border border-slate-600 focus:border-teal-500 text-white font-bold" placeholder="مثال: نموذج استلام جديد" />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={saveTemplateToDB} disabled={isSaving} className="flex-1 bg-teal-600 text-white py-2 rounded font-bold text-sm hover:bg-teal-500 transition flex items-center justify-center shadow-lg">
                      {isSaving ? <RefreshCw className="animate-spin" size={16} /> : "تأكيد الحفظ كجديد"}
                    </button>
                    <button onClick={() => setShowSaveForm(false)} className="px-4 bg-slate-600 text-white py-2 rounded font-bold text-sm hover:bg-slate-500 transition">إلغاء</button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
        <div className="p-4 bg-slate-950 border-t border-slate-800">
          <button onClick={() => window.print()} className="w-full bg-[#c5a059] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-yellow-600 transition shadow-lg shadow-[#c5a059]/20 transform hover:-translate-y-1">
            <Printer /> طباعة / تصدير (PDF)
          </button>
        </div>
      </div>

      <div className="flex-1 bg-gray-200 overflow-y-auto p-4 md:p-10 flex justify-center items-start">
        <div className="a4-page bg-white text-black shadow-xl" id="printArea">
          <div className="decorative-strip" />
          <div className="letter-header">
            <img src={getImg("1I5KIPkeuwJ0CawpWJLpiHdmofSKLQglN")} alt="شعار" className="h-20 md:h-24 object-contain" />
            <div className="flex flex-col items-end">
              <p className="text-[#c5a059] font-bold text-xs md:text-sm mb-2 font-cairo">سقف يعلو برؤيتك ومسكن يحكي قصتك</p>
              <div className="bg-slate-50 px-4 py-1 rounded-full border border-slate-200">
                <p className="text-[#1a365d] text-xs md:text-sm font-bold tracking-wider font-cairo">الرقم الموحد: 7051031099</p>
              </div>
            </div>
          </div>
          <div className="letter-body font-amiri text-base md:text-lg relative z-10 flex-grow pt-8 md:pt-10 px-8 md:px-12">
            <img src={getImg("1I5KIPkeuwJ0CawpWJLpiHdmofSKLQglN")} className="watermark" alt="" />
            <div className="text-left mb-6 md:mb-8 font-cairo text-sm text-[#1a365d]"><strong>التاريخ:</strong> {data.date}</div>
            <div className="mb-6"><h3 className="font-bold text-lg md:text-xl text-black font-cairo">{data.recipient}</h3></div>
            <div className="mb-6 font-cairo">تحية طيبة وبعد،،</div>
            <div className="text-center mb-8 md:mb-10"><span className="border-b-2 border-[#c5a059] pb-2 px-8 font-bold text-lg md:text-xl text-[#1a365d] font-cairo">{data.subject}</span></div>
            <div className="text-justify whitespace-pre-line leading-[2.2] flex-grow">{data.body}</div>
            <div className="corner-accent" />
            <div className="mt-12 mb-12 flex justify-between items-start px-4 md:px-12 relative min-h-[150px]">
              <div className="relative w-40 md:w-48 flex justify-center">
                {data.showStamp && user?.role === "admin" && (
                  <img src={getImg("1lCYGae5VrEMVh8OEKHHBWTxLPJH7t0u5")} className="w-full object-contain opacity-90 mix-blend-multiply" alt="ختم" />
                )}
              </div>
              <div className="text-center pt-8 md:pt-10 pl-4 md:pl-8 font-cairo">
                <p className="font-bold text-[#1a365d] mb-2 text-lg md:text-xl">{data.signTitle}</p>
                <p className="font-bold text-base md:text-lg">{data.signName}</p>
              </div>
            </div>
          </div>
          <div className="letter-footer">
            <div className="text-center pl-4 font-cairo">
              <p className="font-bold text-xs md:text-sm mb-1">المملكة العربية السعودية - مكة المكرمة - حي البوابة</p>
              <div className="flex justify-center gap-6 text-[10px] md:text-xs text-gray-300 ltr" dir="ltr">
                <span className="font-sans">semak.sa</span>
                <span className="font-sans">920032842</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const PartnersView = () => {
  const partners = [
    "18kk3r0kSgBdkQvCj7KC3fe29SQt4s_Y_", "1CFm4oTf091j04ndhYBhN4-LiirPgsywc", "1Ho4XCxeEQHTt4QRHJQnGbhSNCybY9Kli",
    "1T_LJDA_3XAAHSHl3DLib9foDVsQHjrCE", "10BuljftpVn9MsU2XbFJQ6zkRnM4djnGs", "1DwooJvRW8QrG-pDa1am0JDjbiVNp3AKP",
    "1Tcfv84RKa5YJ7ao-ktt9HLAk9TKQLy4F", "144wMG57xjPdnX1SYoBTzlQu0XEbIWiO3", "1NG-fNtmh8Nm2qxZdTPZs3IYlYgQGxOr8",
    "1H1f5ByalQMYeNi91qq5eEzXIwY1GCpPZ"
  ];
  return (
    <div className="py-10 bg-white border-t border-slate-100 overflow-hidden no-print" id="partners-section">
      <div className="container mx-auto text-center mb-8">
        <h2 className="text-[#c5a059] font-black tracking-[0.3em] text-sm mb-2">شركاء النجاح</h2>
        <h3 className="text-2xl md:text-3xl font-black text-[#1a365d]">نختار الأفضل لبناء منزلك</h3>
      </div>
      <div className="marquee-container relative">
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-white to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-white to-transparent z-10 pointer-events-none" />
        {[1, 2, 3].map(i => (
          <div key={i} className="marquee-content gap-8 pr-8" aria-hidden={i !== 1}>
            {partners.map((p, j) => (
              <div key={j} className="w-32 h-20 flex items-center justify-center shrink-0">
                <img src={getImg(p, "w500")} className="max-w-full max-h-full object-contain transition duration-300 hover:scale-110" alt="شريك" />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

const LegalPage = ({ title, navigateTo }) => (
  <div className="pt-32 pb-20 bg-slate-50 min-h-screen container mx-auto px-6 max-w-4xl text-right">
    <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100">
      <div className="flex justify-between items-center mb-10">
        <h1 className="text-3xl font-black text-[#1a365d]">{title}</h1>
        <button onClick={() => navigateTo("home")} className="text-slate-400 hover:text-[#c5a059]">
          <ArrowRight size={24} />
        </button>
      </div>
      <div className="prose prose-lg text-slate-600 space-y-6">
        <p>محتوى {title} يكتب هنا...</p>
        {title === "سياسة الخصوصية" && <p>نحرص في سماك العقارية على حماية خصوصية بيانات عملائنا...</p>}
        {title === "الشروط والأحكام" && <p>بوصولك واستخدامك لموقع سماك العقارية، فإنك توافق على الالتزام بهذه الشروط...</p>}
      </div>
    </div>
  </div>
);

// --- Main App Component ---
export default function App() {
  const [currentPage, setCurrentPage] = useState("home");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [toast, setToast] = useState({ show: false, title: "", desc: "", type: "success" });
  const [navVisible, setNavVisible] = useState(true);
  const [adminUser, setAdminUser] = useState(null);
  const [customer, setCustomer] = useState(null);

  useEffect(() => {
    document.title = "سماك العقارية | سقف يعلو برؤيتك، ومسكن يحكي قصتك";
    let icon = document.querySelector("link[rel~='icon']");
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      document.getElementsByTagName("head")[0].appendChild(icon);
    }
    icon.href = getImg("1CcCFvgasNW1MEZt65AY9ZD7FzdDvuNgJ", "w128");
  }, []);

  useEffect(() => {
    let lastScrollY = window.scrollY;
    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      if (currentScrollY > lastScrollY && currentScrollY > 100) setNavVisible(false);
      else setNavVisible(true);
      lastScrollY = currentScrollY;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const unit = params.get("unit");
    const auth = params.get("auth");
    if (unit && auth === "smak2026") {
      setCustomer({ username: "qr_user", name: "عميل سماك", unit });
      window.history.replaceState({}, document.title, window.location.pathname);
      showToast("دخول سريع", `مرحباً بك، تم تسجيل دخولك لخدمة صيانة الوحدة ${unit}`);
      setCurrentPage("maintenance");
    }
  }, []);

  const showToast = (title, desc, type = "success") => {
    setToast({ show: true, title, desc, type });
    setTimeout(() => setToast({ show: false, title: "", desc: "", type: "success" }), 4000);
  };

  const navigateTo = (page) => {
    setCurrentPage(page === "maintenance" && !customer ? "customer-login" : page);
    setMobileMenuOpen(false);
    window.scrollTo(0, 0);
  };

  // إخفاء الـ Navbar عن كل هذه الصفحات الخاصة ببوابات الدخول والمهام
  const hideNavOn = ["login", "customer-login", "dashboard", "letter-generator", "tech-dashboard"];

  return (
    <div dir="rtl" className="min-h-screen flex flex-col font-cairo text-slate-900 bg-slate-50">
      <GlobalStyles />
      
      {/* Toast Notification */}
      <div className={`fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-white border-r-4 ${toast.type === "error" ? "border-red-500" : "border-[#c5a059]"} px-8 py-4 rounded-xl shadow-2xl flex items-center gap-4 transition-all duration-500 no-print ${toast.show ? "translate-y-0 opacity-100 visible" : "translate-y-20 opacity-0 invisible"}`}>
        <div className={`p-2 rounded-full ${toast.type === "error" ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"}`}>
          <CircleCheckBig size={24} />
        </div>
        <div>
          <p className="font-bold text-[#1a365d]">{toast.title}</p>
          <p className="text-sm text-gray-500">{toast.desc}</p>
        </div>
      </div>

      {/* Navigation */}
      {!hideNavOn.includes(currentPage) && (
        <nav className={`bg-white/95 backdrop-blur-md shadow-sm fixed w-full z-50 transition-transform duration-300 ease-in-out no-print ${navVisible ? "translate-y-0" : "-translate-y-full"}`}>
          <div className="container mx-auto px-4 md:px-8 py-3 flex justify-between items-center">
            <div className="flex items-center gap-4">
              <div className="flex items-center cursor-pointer" onClick={() => navigateTo("home")}>
                <img src={getImg("1I5KIPkeuwJ0CawpWJLpiHdmofSKLQglN")} alt="سماك العقارية" className="h-20 md:h-28 w-auto object-contain logo-blend-light" />
              </div>
              <div className="h-10 w-[2px] bg-[#c5a059]/30 hidden md:block" />
              <p className="hidden md:block text-xs text-slate-400 font-medium">سقف يعلو برؤيتك، ومسكن يحكي قصتك</p>
            </div>
            
            <div className="hidden md:flex items-center space-x-8 space-x-reverse">
              <button onClick={() => navigateTo("home")} className={`font-semibold transition ${currentPage === "home" ? "text-[#c5a059]" : "text-slate-600 hover:text-[#c5a059]"}`}>الرئيسية</button>
              <button onClick={() => navigateTo("about")} className={`font-semibold transition ${currentPage === "about" ? "text-[#c5a059]" : "text-slate-600 hover:text-[#c5a059]"}`}>من نحن</button>
              <button onClick={() => navigateTo("projects")} className={`font-semibold transition ${currentPage === "projects" ? "text-[#c5a059]" : "text-slate-600 hover:text-[#c5a059]"}`}>مشاريعنا</button>
              <button onClick={() => document.getElementById("partners-section")?.scrollIntoView({ behavior: "smooth" })} className="font-semibold transition text-slate-600 hover:text-[#c5a059]">شركاؤنا</button>
              <button onClick={() => navigateTo("maintenance")} className={`font-semibold transition ${currentPage === "maintenance" ? "text-[#c5a059]" : "text-slate-600 hover:text-[#c5a059]"}`}>طلب صيانة</button>
              <button onClick={() => navigateTo("contact")} className="bg-[#1a365d] text-white px-8 py-3 rounded-full hover:bg-[#0f172a] transition-all transform hover:scale-105 shadow-lg font-bold">احجز الآن</button>
            </div>
            
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)} className="md:hidden text-[#1a365d] text-2xl">
              {mobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
          {mobileMenuOpen && (
            <div className="md:hidden bg-white border-t border-slate-100 px-6 py-8 flex flex-col space-y-6 shadow-xl no-print">
              <button onClick={() => navigateTo("home")} className="text-xl font-bold text-[#1a365d] text-right">الرئيسية</button>
              <button onClick={() => navigateTo("about")} className="text-xl font-bold text-[#1a365d] text-right">من نحن</button>
              <button onClick={() => navigateTo("projects")} className="text-xl font-bold text-[#1a365d] text-right">مشاريعنا</button>
              <button onClick={() => { document.getElementById("partners-section")?.scrollIntoView({ behavior: "smooth" }); setMobileMenuOpen(false); }} className="text-xl font-bold text-[#1a365d] text-right">شركاؤنا</button>
              <button onClick={() => navigateTo("maintenance")} className="text-xl font-bold text-[#1a365d] text-right">طلب صيانة</button>
              <button onClick={() => navigateTo("contact")} className="bg-[#c5a059] text-white py-4 rounded-xl text-center font-bold">احجز وحدتك</button>
            </div>
          )}
        </nav>
      )}

      {/* Main Content Area */}
      <div className="flex-grow">
        {currentPage === "home" && <HomeView navigateTo={navigateTo} />}
        {currentPage === "about" && <AboutView />}
        {currentPage === "projects" && <ProjectsView />}
        {currentPage === "contact" && <ContactView showToast={showToast} />}
        {currentPage === "customer-login" && <CustomerLoginView setCustomer={setCustomer} navigateTo={navigateTo} showToast={showToast} />}
        {currentPage === "maintenance" && <MaintenanceView customer={customer} setCustomer={setCustomer} navigateTo={navigateTo} showToast={showToast} />}
        
        {/* بوابات الإدارة والموظفين والفنيين */}
        {currentPage === "login" && <AdminLoginView setUser={setAdminUser} navigateTo={navigateTo} showToast={showToast} />}
        {currentPage === "dashboard" && <DashboardView user={adminUser} setUser={setAdminUser} navigateTo={navigateTo} showToast={showToast} />}
        {currentPage === "tech-dashboard" && <TechDashboardView user={adminUser} setUser={setAdminUser} navigateTo={navigateTo} showToast={showToast} />}
        
        {currentPage === "letter-generator" && <LetterGeneratorView user={adminUser} navigateTo={navigateTo} showToast={showToast} />}
        {currentPage === "privacy" && <LegalPage title="سياسة الخصوصية" navigateTo={navigateTo} />}
        {currentPage === "terms" && <LegalPage title="الشروط والأحكام" navigateTo={navigateTo} />}
      </div>

      {/* Footer / Partners */}
      {!hideNavOn.includes(currentPage) && <PartnersView />}
      {!hideNavOn.includes(currentPage) && (
        <footer className="bg-[#0f172a] text-white pt-24 pb-12 no-print">
          <div className="container mx-auto px-6 text-center">
            <div className="mb-12 flex flex-col items-center">
              <img src={getImg("1HEFY56KLYGJNmc-tufIXmYDUbGyOIdDX")} alt="شعار تذييل" className="max-h-32 md:max-h-48 w-auto object-contain logo-footer-gold" />
              <p className="text-slate-400 mt-1 tracking-widest font-bold text-xl uppercase">سقف يعلو برؤيتك، ومسكن يحكي قصتك</p>
            </div>
            <div className="border-t border-white/5 pt-12 flex flex-col md:flex-row justify-between items-center text-slate-100 text-sm gap-6">
              <p>© 2026 سماك العقارية. جميع الحقوق محفوظة.</p>
              <div className="flex flex-wrap justify-center gap-6 font-medium">
                <button onClick={() => navigateTo("privacy")} className="hover:text-white transition">سياسة الخصوصية</button>
                <button onClick={() => navigateTo("terms")} className="hover:text-white transition">الشروط والأحكام</button>
                <button onClick={() => navigateTo("login")} className="hover:text-[#c5a059] transition flex items-center gap-2">
                  <Lock size={14} /> بوابة الموظفين
                </button>
              </div>
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}