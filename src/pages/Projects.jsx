import React, { useState } from 'react';
import { X, ZoomIn, HousePlus, ShieldCheck, Award, Building, TramFront, Plane, Moon, TreePine, ShoppingCart, MapPin, Ruler, Bed, UserCheck, Droplets, Fingerprint, Wifi, Umbrella, Box, Car, Layers, Bath, ChevronDown } from 'lucide-react';
import { getImg } from '../utils/helpers';

export default function Projects() {
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
                <iframe title="موقع المشروع" width="100%" height="100%" frameBorder="0" style={{ border: 0 }} src="https://maps.google.com/maps?q=Mecca&t=&z=13&ie=UTF8&iwloc=&output=embed" allowFullScreen={true} />
              </div>
              <div className="absolute top-10 -right-4 bg-[#c5a059] p-6 rounded-l-[2rem] shadow-2xl z-20">
                <p className="text-white font-black text-2xl">7</p>
                <p className="text-white/80 font-bold text-sm">وحدات<br />فقط</p>
              </div>
              <a href="https://maps.google.com/" target="_blank" rel="noreferrer" className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white text-[#1a365d] px-8 py-4 rounded-2xl font-bold shadow-2xl hover:bg-[#c5a059] hover:text-white transition flex items-center gap-3 group z-20 whitespace-nowrap">
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
                  <HousePlus className="text-[#c5a059]" /> مدخل ومصعد
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
}