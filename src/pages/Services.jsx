import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Key, Lightbulb, LineChart, ShieldCheck, Wrench, ArrowLeft } from 'lucide-react';
import { getImg } from '../utils/helpers';

export default function Services() {
  const navigate = useNavigate();

  const servicesList = [
    {
      icon: Building2,
      title: "التطوير العقاري",
      desc: "نبتكر مشاريع سكنية وتجارية متكاملة تواكب رؤية المملكة 2030 وتلبي تطلعات الأسر السعودية بأعلى معايير الجودة."
    },
    {
      icon: Key,
      title: "إدارة الأملاك",
      desc: "ندير عقاراتك باحترافية تامة، من تأجير وتحصيل إلى صيانة دورية، لضمان استدامة أصولك وتعظيم عوائدك الاستثمارية."
    },
    {
      icon: LineChart,
      title: "دراسات الجدوى والمبيعات",
      desc: "نقدم تحليلات دقيقة للسوق ودراسات جدوى اقتصادية للمشاريع، بالإضافة لخدمات التسويق والمبيعات الاستراتيجية."
    },
    {
      icon: Lightbulb,
      title: "الحلول الذكية (Smart Homes)",
      desc: "نحول مسكنك إلى بيئة ذكية متكاملة، من خلال أنظمة تحكم بالإضاءة، التكييف، والدخول الذكي لضمان رفاهيتك."
    },
    {
      icon: Wrench,
      title: "الصيانة والتشغيل",
      desc: "فريق هندسي وفني متخصص لتقديم خدمات الصيانة الوقائية والتصحيحية لجميع مشاريعنا ووحدات العملاء."
    },
    {
      icon: ShieldCheck,
      title: "التسليم وخدمات ما بعد البيع",
      desc: "نضمن لك تجربة تسليم سلسة بشفافية تامة، مع تفعيل فوري للضمانات الشاملة على الهيكل والأعمال الكهروميكانيكية."
    }
  ];

  return (
    <div className="bg-slate-50 min-h-screen animate-fadeIn pb-20 pt-32">
      {/* رأس الصفحة */}
      <div className="container mx-auto px-6 mb-16 text-center">
        <h2 className="text-[#c5a059] font-black tracking-[0.3em] uppercase text-sm mb-4">مجالات التميز</h2>
        <h3 className="text-4xl md:text-5xl font-black text-[#1a365d] mb-6">خدماتنا المتكاملة</h3>
        <p className="text-slate-500 text-lg max-w-2xl mx-auto leading-relaxed">
          في سماك العقارية، لا نبني مجرد جدران، بل نصنع أسلوب حياة. نقدم باقة من الخدمات الشاملة لضمان راحة عملائنا ونجاح استثماراتهم.
        </p>
      </div>

      {/* شبكة الخدمات */}
      <div className="container mx-auto px-6 max-w-6xl">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {servicesList.map((srv, idx) => {
            const Icon = srv.icon;
            return (
              <div key={idx} className="bg-white p-8 rounded-[2rem] shadow-sm border-b-4 border-transparent hover:border-[#c5a059] hover:shadow-xl transition-all duration-300 group cursor-pointer">
                <div className="w-16 h-16 bg-[#1a365d]/5 text-[#1a365d] rounded-2xl flex items-center justify-center mb-6 group-hover:bg-[#1a365d] group-hover:text-white transition-colors duration-300">
                  <Icon size={32} />
                </div>
                <h4 className="text-2xl font-black text-[#1a365d] mb-4">{srv.title}</h4>
                <p className="text-slate-500 leading-loose">{srv.desc}</p>
              </div>
            );
          })}
        </div>

        {/* دعوة لاتخاذ إجراء */}
        <div className="mt-20 bg-[#1a365d] rounded-[3rem] p-10 md:p-16 text-center text-white shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#c5a059]/20 rounded-full blur-3xl pointer-events-none -mr-10 -mt-10" />
          <h3 className="text-3xl md:text-4xl font-black mb-6 relative z-10">هل تبحث عن شريك استراتيجي لعقارك؟</h3>
          <p className="text-slate-300 mb-10 max-w-2xl mx-auto relative z-10">تواصل معنا اليوم ودعنا نناقش كيف يمكننا في سماك العقارية تلبية احتياجاتك بأعلى معايير الجودة والاحترافية.</p>
          <button onClick={() => navigate('/contact')} className="bg-[#c5a059] text-white px-10 py-4 rounded-full font-bold text-lg hover:bg-yellow-600 transition shadow-[0_0_20px_rgba(197,160,89,0.4)] relative z-10 flex items-center gap-3 mx-auto">
            تواصل معنا الآن <ArrowLeft size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}