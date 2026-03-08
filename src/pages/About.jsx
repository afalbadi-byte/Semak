import React from 'react';
import { HousePlus, ShieldCheck, Award, Leaf, Wifi, Users, Building, Eye, Target } from 'lucide-react';
import { getImg } from '../utils/helpers';

export default function About() {
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
    <div className="bg-white min-h-screen animate-fadeIn">
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
              تقديم منتجات العقارية نوعية تجمع بين روحانية الجوار وأحدث تقنيات البناء الذكي، ملتزمين بأعلى معايير الجودة والخصوصية، لنخلق فرصاً استثمارية وسكنية آمنة تحقق الرفاهية.
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
}