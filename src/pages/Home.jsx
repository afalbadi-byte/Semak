import React from 'react';
import { useNavigate } from 'react-router-dom';
import PageMeta from '../components/PageMeta';
import {
  ShieldCheck, Wifi, Award, MapPin, Building, TramFront,
  Plane, CheckCircle2, ArrowLeft, Phone, MessageCircle
} from 'lucide-react';

const WhatsAppIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16">
    <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
  </svg>
);

export default function Home() {
  const navigate = useNavigate();

  const features = [
    {
      icon: Wifi,
      color: 'blue',
      title: 'منزل ذكي متكامل',
      desc: 'أنظمة تحكم بالإضاءة، التكييف، والدخول الذكي — كل شيء بلمسة من هاتفك.',
    },
    {
      icon: ShieldCheck,
      color: 'red',
      title: 'أمان 24/7',
      desc: 'كاميرات CCTV متطورة وأقفال إلكترونية ذكية لأقصى درجات الحماية لعائلتك.',
    },
    {
      icon: Award,
      color: 'amber',
      title: 'تشطيبات فاخرة',
      desc: 'أرقى خامات البورسلان والرخام من ماركات عالمية موثوقة مع ضمان 10 سنوات.',
    },
  ];

  const locations = [
    { icon: Building,   label: '15 دقيقة', sub: 'عن المسجد الحرام' },
    { icon: TramFront,  label: '9 دقائق',  sub: 'محطة قطار الحرمين' },
    { icon: Plane,      label: '50 دقيقة', sub: 'مطار الملك عبدالعزيز' },
    { icon: MapPin,     label: 'في القلب', sub: 'حي البوابة، مكة المكرمة' },
  ];

  const units = [
    { id: 'SM-A01', floor: 'الدور الأول', badge: 'واجهتين',         price: '720,000', special: true  },
    { id: 'SM-A02', floor: 'الدور الأول', badge: 'واجهة أمامية',    price: '700,000', special: false },
    { id: 'SM-A07', floor: 'الدور الرابع', badge: 'فيلا روف فاخرة', price: '1,100,000', special: true },
  ];

  return (
    <>
    <PageMeta
      title="الرئيسية"
      description="سماك العقارية — وحدات سكنية راقية في قلب مكة المكرمة. 7 وحدات حصرية، تصميم ذكي، تملك حر."
    />

    {/* ══════════════════════════ HERO ══════════════════════════ */}
    <div
      className="relative min-h-screen flex items-center justify-center bg-cover bg-center py-32 animate-fadeIn"
      style={{ backgroundImage: `url('/images/hero-bg.jpg')` }}
    >
      <div className="absolute inset-0 hero-gradient" />
      <div className="container mx-auto px-4 md:px-6 relative z-10 flex flex-col items-center justify-center mt-10">
        <img
          src="/images/logo-light.png"
          alt="شعار سماك العقارية"
          className="h-20 md:h-32 mb-8 object-contain brightness-0 invert drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] opacity-95 hover:opacity-100 transition duration-500 hover:scale-105 transform"
        />

        <div className="bg-slate-900/80 backdrop-blur-xl rounded-[3rem] border border-white/10 shadow-2xl p-8 md:p-12 max-w-4xl w-full text-center relative overflow-hidden">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#c5a059]/20 rounded-full blur-3xl pointer-events-none" />

          <div className="inline-block px-4 py-1.5 rounded-full bg-[#c5a059]/20 border border-[#c5a059]/40 text-[#c5a059] font-bold text-xs md:text-sm mb-4 animate-pulse tracking-wide">
            فرصة استثمارية وسكنية حصرية
          </div>

          <h1 className="text-2xl md:text-4xl font-black text-white mb-4 leading-tight">
            تحفة معمارية.. <span className="text-[#c5a059] text-glow">بـ 7 وحدات فقط</span>
          </h1>

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
              <p className="text-[#c5a059] font-bold uppercase text-[10px] md:text-xs tracking-widest">م² مساحة</p>
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
            <button
              onClick={() => navigate("/contact")}
              className="bg-[#c5a059] text-white px-8 py-3 rounded-2xl font-bold text-lg hover:bg-yellow-600 transition shadow-lg shadow-[#c5a059]/20 transform hover:-translate-y-1"
            >
              احجز معاينتك اليوم
            </button>
            <button
              onClick={() => navigate("/projects")}
              className="bg-white/5 backdrop-blur-md border border-white/20 text-white px-8 py-3 rounded-2xl font-bold text-lg hover:bg-white/10 transition"
            >
              استكشف الفرصة
            </button>
          </div>
        </div>
      </div>
    </div>

    {/* ══════════════════════════ المميزات ══════════════════════════ */}
    <div className="bg-white py-24">
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="text-center mb-16">
          <p className="text-[#c5a059] font-black tracking-[0.3em] text-xs uppercase mb-3">لماذا سماك؟</p>
          <h2 className="text-3xl md:text-4xl font-black text-[#1a365d]">مسكن يفوق التوقعات</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {features.map((f, i) => {
            const Icon = f.icon;
            const colorMap = {
              blue:  { bg: 'bg-blue-50',  text: 'text-[#1a365d]',  hover: 'group-hover:bg-[#1a365d] group-hover:text-white' },
              red:   { bg: 'bg-red-50',   text: 'text-red-600',    hover: 'group-hover:bg-red-600 group-hover:text-white'   },
              amber: { bg: 'bg-amber-50', text: 'text-[#c5a059]',  hover: 'group-hover:bg-[#c5a059] group-hover:text-white' },
            };
            const c = colorMap[f.color];
            return (
              <div key={i} className="group bg-slate-50 hover:bg-white p-8 rounded-[2rem] border border-transparent hover:border-[#c5a059]/20 hover:shadow-xl transition-all duration-300 cursor-default text-right">
                <div className={`w-14 h-14 ${c.bg} ${c.text} rounded-2xl flex items-center justify-center mb-6 transition-colors duration-300 ${c.hover}`}>
                  <Icon size={28} />
                </div>
                <h3 className="text-xl font-black text-[#1a365d] mb-3">{f.title}</h3>
                <p className="text-slate-500 leading-loose text-sm">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>

    {/* ══════════════════════════ الموقع ══════════════════════════ */}
    <div className="bg-[#080d18] py-24">
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="text-center mb-16">
          <p className="text-[#c5a059] font-black tracking-[0.3em] text-xs uppercase mb-3">الموقع الاستراتيجي</p>
          <h2 className="text-3xl md:text-4xl font-black text-white">في قلب مكة المكرمة</h2>
          <p className="text-slate-400 mt-4 max-w-xl mx-auto text-sm leading-relaxed">
            حي البوابة — على مقربة من كل ما يهمك، ومرفقاتك الأساسية بالقرب منك.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {locations.map((l, i) => {
            const Icon = l.icon;
            return (
              <div key={i} className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-6 text-center transition-all group">
                <div className="w-12 h-12 bg-[#c5a059]/10 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:bg-[#c5a059]/20 transition">
                  <Icon size={22} className="text-[#c5a059]" />
                </div>
                <p className="text-white font-black text-lg">{l.label}</p>
                <p className="text-slate-400 text-xs mt-1">{l.sub}</p>
              </div>
            );
          })}
        </div>
        <div className="text-center">
          <button
            onClick={() => navigate('/projects')}
            className="inline-flex items-center gap-2 text-[#c5a059] font-bold text-sm hover:underline"
          >
            شاهد الموقع على الخريطة <ArrowLeft size={16} />
          </button>
        </div>
      </div>
    </div>

    {/* ══════════════════════════ تيزر الوحدات ══════════════════════════ */}
    <div className="bg-slate-50 py-24">
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="flex items-end justify-between mb-12 flex-wrap gap-4">
          <div>
            <p className="text-[#c5a059] font-black tracking-[0.3em] text-xs uppercase mb-3">مشاريعنا</p>
            <h2 className="text-3xl md:text-4xl font-black text-[#1a365d]">سماك — البوابة 1</h2>
          </div>
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-2 text-[#1a365d] font-bold text-sm border-2 border-[#1a365d]/20 px-5 py-2.5 rounded-full hover:border-[#c5a059] hover:text-[#c5a059] transition"
          >
            جميع الوحدات <ArrowLeft size={16} />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {units.map((u) => (
            <div
              key={u.id}
              onClick={() => navigate('/projects')}
              className="bg-white rounded-[2rem] p-7 border border-slate-100 hover:border-[#c5a059]/30 hover:shadow-xl transition-all duration-300 cursor-pointer group"
            >
              {u.special && (
                <span className="inline-block bg-[#c5a059]/10 text-[#c5a059] text-xs font-black px-3 py-1 rounded-full mb-4">
                  مميزة
                </span>
              )}
              <h3 className="text-2xl font-black text-[#1a365d] mb-1">{u.id}</h3>
              <p className="text-slate-400 text-sm mb-4">{u.floor} — {u.badge}</p>
              <div className="flex items-center justify-between">
                <span className="text-[#c5a059] font-black text-lg">{u.price} <span className="text-sm font-bold">ريال</span></span>
                <span className="text-xs text-slate-400 group-hover:text-[#c5a059] transition flex items-center gap-1 font-bold">
                  التفاصيل <ArrowLeft size={12} />
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-10 text-center">
          <button
            onClick={() => navigate('/projects')}
            className="bg-[#1a365d] text-white px-10 py-4 rounded-2xl font-bold text-base hover:bg-[#c5a059] transition-all shadow-lg hover:-translate-y-0.5 inline-flex items-center gap-2"
          >
            استعرض جميع الوحدات والمخططات <ArrowLeft size={18} />
          </button>
        </div>
      </div>
    </div>

    {/* ══════════════════════════ CTA نهائي ══════════════════════════ */}
    <div
      className="relative py-28 bg-cover bg-center overflow-hidden"
      style={{ backgroundImage: `url('/images/contact-bg.jpg')` }}
    >
      <div className="absolute inset-0 bg-[#1a365d]/92" />
      <div className="container mx-auto px-6 relative z-10 text-center max-w-3xl">
        <div className="inline-flex items-center gap-2 bg-[#c5a059]/20 border border-[#c5a059]/40 text-[#c5a059] font-bold text-xs px-4 py-1.5 rounded-full mb-6">
          <CheckCircle2 size={14} /> فرصة محدودة — 7 وحدات فقط
        </div>
        <h2 className="text-3xl md:text-5xl font-black text-white mb-6 leading-tight">
          هل أنت مستعد لامتلاك<br />
          <span className="text-[#c5a059]">منزل أحلامك؟</span>
        </h2>
        <p className="text-slate-300 text-base mb-10 leading-relaxed max-w-xl mx-auto">
          تواصل معنا اليوم واحصل على استشارة مجانية من فريق مبيعاتنا المتخصص.
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <a
            href="https://wa.me/966920032842?text=أهلاً، أود الاستفسار عن وحدات سماك العقارية"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-3 bg-[#25D366] hover:bg-[#1fba5a] text-white px-8 py-4 rounded-2xl font-bold text-base transition-all shadow-lg hover:-translate-y-0.5"
          >
            <WhatsAppIcon /> تواصل عبر واتساب
          </a>
          <button
            onClick={() => navigate('/contact')}
            className="flex items-center justify-center gap-3 bg-white/10 border border-white/20 text-white px-8 py-4 rounded-2xl font-bold text-base hover:bg-white/20 transition-all"
          >
            <Phone size={18} /> احجز معاينة
          </button>
        </div>
      </div>
    </div>

    </>
  );
}
