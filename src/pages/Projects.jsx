import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import PageMeta from '../components/PageMeta';
import { API_URL } from '../utils/helpers';
import { HousePlus, ShieldCheck, Award, Building, TramFront, Plane, Moon, TreePine, ShoppingCart, MapPin, ZoomIn, ChevronDown, Ruler, Bed, UserCheck, Droplets, Fingerprint, Wifi, Umbrella, Box, Car, Layers, Bath, CalendarCheck, PhoneCall } from 'lucide-react';


export default function Projects() {
  const navigate = useNavigate();
  const [selectedFloor, setSelectedFloor] = useState("first");
  const [expandedUnit, setExpandedUnit] = useState(null);
  const [previewImg, setPreviewImg] = useState(null);
  const [soldUnits, setSoldUnits] = useState({});

  useEffect(() => {
    fetch(`${API_URL}?action=get_units_status`)
      .then(r => r.json())
      .then(d => { if (d.success) setSoldUnits(d.data); })
      .catch(() => {});
  }, []);

  const toggleUnit = (id) => setExpandedUnit(expandedUnit === id ? null : id);

  const isSoldUnit = (unitId) => !!soldUnits[unitId.toUpperCase()];

  const floors = [
    { id: "ground", label: "الدور الأرضي" },
    { id: "first", label: "الدور الأول" },
    { id: "second", label: "الدور الثاني" },
    { id: "third", label: "الدور الثالث" },
    { id: "fourth", label: "الدور الرابع" }
  ];

  const unitsBase = {
    first: [
      { id: "sm-a01", title: "وحدة SM-A01", price: "720,000 ريال", badge: "واجهتين", isSpecial: true },
      { id: "sm-a02", title: "وحدة SM-A02", price: "700,000 ريال", badge: "واجهة أمامية", isSpecial: false }
    ],
    second: [
      { id: "sm-a03", title: "وحدة SM-A03", price: "720,000 ريال", badge: "واجهتين", isSpecial: true },
      { id: "sm-a04", title: "وحدة SM-A04", price: "700,000 ريال", badge: "واجهة أمامية", isSpecial: false }
    ],
    third: [
      { id: "sm-a05", title: "وحدة SM-A05", price: "720,000 ريال", badge: "واجهتين", isSpecial: true },
      { id: "sm-a06", title: "وحدة SM-A06", price: "700,000 ريال", badge: "واجهة أمامية", isSpecial: false }
    ],
    fourth: [
      { id: "sm-a07", title: "وحدة SM-A07", price: "1,100,000 ريال", badge: "فيلا روف فاخرة", isSpecial: true, roof: true }
    ]
  };

  const unitsData = Object.fromEntries(
    Object.entries(unitsBase).map(([floor, units]) => [
      floor,
      units.map(u => ({ ...u, isSold: isSoldUnit(u.id) }))
    ])
  );

  return (
    <>
    <PageMeta title="مشاريعنا" description="استكشف مشروع سماك البوابة 1 — 7 وحدات سكنية حصرية بمواصفات فاخرة في حي البوابة بمكة المكرمة." />
    <div className="pt-32 pb-20 bg-slate-50 dark:bg-brand-900/40 min-h-screen animate-fadeIn">
      <div className="container mx-auto px-6 mb-24">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <h2 className="text-gold-500 font-black tracking-[0.3em] uppercase text-sm mb-4 leading-tight">مشاريعنا</h2>
          <h3 className="text-4xl md:text-5xl font-black text-brand-800 dark:text-brand-100 mb-8">سماك - البوابة 1</h3>
          <p className="text-slate-500 dark:text-brand-300 text-lg">لم نهتم فقط بالبناء، بل صممنا نمط حياة يجمع بين الأصالة والحداثة ليكون منزلك هو واحتك الخاصة.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-brand-900 p-6 rounded-[2rem] card-hover border border-slate-100 dark:border-brand-700 group">
            <div className="w-12 h-12 bg-blue-50 text-brand-800 dark:text-brand-300 rounded-xl flex items-center justify-center mb-4 group-hover:bg-brand-800 group-hover:text-white transition-colors duration-500">
              <HousePlus size={24} />
            </div>
            <h4 className="text-xl font-black text-brand-800 dark:text-brand-100 mb-3">بيئة ذكية متكاملة</h4>
            <p className="text-slate-500 dark:text-brand-300 text-sm leading-relaxed">وحدات مجهزة بالكامل بأنظمة الإنارة والدخول الذكي، مع بنية تحتية مرنة تتيح لك التوسع وإضافة المزيد.</p>
          </div>
          <div className="bg-white dark:bg-brand-900 p-6 rounded-[2rem] card-hover border border-slate-100 dark:border-brand-700 group">
            <div className="w-12 h-12 bg-red-50 text-red-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-red-600 group-hover:text-white transition-colors duration-500">
              <ShieldCheck size={24} />
            </div>
            <h4 className="text-xl font-black text-brand-800 dark:text-brand-100 mb-3">أمان العائلة أولاً</h4>
            <p className="text-slate-500 dark:text-brand-300 text-sm leading-relaxed">أنظمة مراقبة CCTV متطورة، وأقفال إلكترونية ذكية تضمن لك ولعائلتك أقصى درجات الحماية.</p>
          </div>
          <div className="bg-white dark:bg-brand-900 p-6 rounded-[2rem] card-hover border border-slate-100 dark:border-brand-700 group">
            <div className="w-12 h-12 bg-amber-50 text-gold-500 rounded-xl flex items-center justify-center mb-4 group-hover:bg-gold-500 group-hover:text-white transition-colors duration-500">
              <Award size={24} />
            </div>
            <h4 className="text-xl font-black text-brand-800 dark:text-brand-100 mb-3">جودة بلا تنازلات</h4>
            <p className="text-slate-500 dark:text-brand-300 text-sm leading-relaxed">استخدام أرقى خامات البورسلان، الرخام، والأدوات الصحية من ماركات عالمية موثوقة.</p>
          </div>
        </div>
      </div>

      <div className="relative overflow-hidden bg-cover bg-center py-20 mb-24" style={{ backgroundImage: `url('/images/project-aerial.jpg')` }}>
        <div className="absolute inset-0 bg-[#1a365d]/90" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 items-center gap-16">
            <div>
              <h2 className="text-gold-500 font-bold mb-4">الموقع الاستراتيجي</h2>
              <h3 className="text-4xl font-black text-white mb-8">في قلب الحدث، وقريب من خدماتك</h3>
              <div className="grid grid-cols-2 gap-4 text-white">
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm hover:bg-white/10 transition">
                  <div className="flex items-center gap-3 mb-2">
                    <Building className="text-gold-500" size={20} />
                    <span className="font-bold text-lg">15 دقيقة</span>
                  </div>
                  <p className="text-slate-400 text-sm">عن المسجد الحرام</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm hover:bg-white/10 transition">
                  <div className="flex items-center gap-3 mb-2">
                    <TramFront className="text-gold-500" size={20} />
                    <span className="font-bold text-lg">9 دقائق</span>
                  </div>
                  <p className="text-slate-400 text-sm">عن محطة قطار الحرمين</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm hover:bg-white/10 transition">
                  <div className="flex items-center gap-3 mb-2">
                    <Plane className="text-gold-500" size={20} />
                    <span className="font-bold text-lg">50 دقيقة</span>
                  </div>
                  <p className="text-slate-400 text-sm">عن مطار الملك عبدالعزيز</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm hover:bg-white/10 transition">
                  <div className="flex items-center gap-3 mb-2">
                    <Moon className="text-gold-500" size={20} />
                    <span className="font-bold text-lg">مقابل</span>
                  </div>
                  <p className="text-slate-400 text-sm">مسجد </p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm hover:bg-white/10 transition">
                  <div className="flex items-center gap-3 mb-2">
                    <TreePine className="text-gold-500" size={20} />
                    <span className="font-bold text-lg">مقابل</span>
                  </div>
                  <p className="text-slate-400 text-sm">حديقة عامة</p>
                </div>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 backdrop-blur-sm hover:bg-white/10 transition">
                  <div className="flex items-center gap-3 mb-2">
                    <ShoppingCart className="text-gold-500" size={20} />
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
              <div className="absolute top-10 -right-4 bg-gold-500 p-6 rounded-l-[2rem] shadow-2xl z-20">
                <p className="text-white font-black text-2xl">7</p>
                <p className="text-white/80 font-bold text-sm">وحدات<br />فقط</p>
              </div>
              <a href="https://maps.google.com/" target="_blank" rel="noreferrer" className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white text-brand-800 px-8 py-4 rounded-2xl font-bold shadow-2xl hover:bg-gold-500 hover:text-white transition flex items-center gap-3 group z-20 whitespace-nowrap">
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
          <h2 className="text-gold-500 font-black tracking-[0.3em] uppercase text-sm mb-4">مخططات المشروع</h2>
          <h3 className="text-3xl md:text-4xl font-black text-brand-800 dark:text-brand-100">اختر الطابق لاستعراض الوحدات</h3>
        </div>
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {floors.map(f => (
            <button key={f.id} onClick={() => setSelectedFloor(f.id)} className={`px-6 py-3 rounded-full font-bold border-2 border-brand-800 dark:border-brand-700 transition ${selectedFloor === f.id ? "bg-brand-800 text-white" : "text-brand-800 dark:text-brand-300 hover:bg-brand-800/10"}`}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="bg-white dark:bg-brand-900 rounded-[3rem] p-8 md:p-12 shadow-xl border border-slate-100 dark:border-brand-700 min-h-[500px] grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1">
            <h4 className="text-3xl font-black text-brand-800 dark:text-brand-100 mb-6">مواصفات {floors.find(f => f.id === selectedFloor).label}</h4>
            {selectedFloor === "ground" ? (
              <div className="space-y-4">
                <p className="text-slate-500 dark:text-brand-300 mb-8 leading-relaxed">تم تخصيص الدور الأرضي بالكامل لمواقف السيارات والخدمات العامة للمبنى.</p>
                <div className="bg-white dark:bg-brand-900/40 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-brand-700 flex items-center gap-4 text-brand-800 dark:text-brand-100 font-bold">
                  <Car className="text-gold-500" /> مواقف خاصة
                </div>
                <div className="bg-white dark:bg-brand-900/40 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-brand-700 flex items-center gap-4 text-brand-800 dark:text-brand-100 font-bold">
                  <HousePlus className="text-gold-500" /> مدخل ومصعد
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {unitsData[selectedFloor].map(unit => (
                  <div key={unit.id} className="bg-white dark:bg-brand-900/40 rounded-2xl shadow-sm border border-slate-100 dark:border-brand-700 relative overflow-hidden transition-all duration-300 hover:shadow-md">
                    {unit.isSpecial && <div className="absolute top-0 left-0 bg-gold-500 text-white text-xs px-3 py-1 rounded-br-lg z-10">مميزة</div>}
                    {unit.isSold && (
                      <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/50 backdrop-blur-[1px] pointer-events-none">
                        <div className="border-[5px] border-red-600 text-red-600 text-3xl font-black px-6 py-2 rounded-xl transform -rotate-12 opacity-80 shadow-lg tracking-wider">تم البيع / محجوز</div>
                      </div>
                    )}
                    <div className="p-5 cursor-pointer" onClick={() => toggleUnit(unit.id)}>
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="block font-bold text-xl text-brand-800 dark:text-brand-100">{unit.title}</span>
                          <span className="text-gold-500 font-black text-lg">{unit.price}</span>
                        </div>
                        <div className="flex flex-col items-end gap-2 mt-2">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold ${unit.isSpecial ? "bg-gold-500/10 text-gold-500" : "bg-slate-100 dark:bg-brand-800 text-slate-600 dark:text-brand-300"}`}>{unit.badge}</span>
                          <ChevronDown className={`text-slate-400 dark:text-brand-400 transition-transform duration-300 mt-1 ${expandedUnit === unit.id ? "rotate-180" : ""}`} />
                        </div>
                      </div>
                    </div>
                    {expandedUnit === unit.id && (
                      <div className="px-5 pb-5 bg-slate-50/50 dark:bg-brand-800/30 border-t border-slate-100 dark:border-brand-700 pt-4 animate-fadeIn">
                        <div className="grid grid-cols-2 gap-3 text-sm text-slate-600 dark:text-brand-300 mb-6">
                          <span className="flex items-center gap-2"><Ruler size={16} className="text-gold-500" /> {unit.roof ? "422 م²" : "204 م²"}</span>
                          <span className="flex items-center gap-2"><Bed size={16} className="text-gold-500" /> {unit.roof ? "4 غرف" : "5 غرف"}</span>
                          <span className="flex items-center gap-2"><UserCheck size={16} className="text-gold-500" /> غرفة خادمة</span>
                          <span className="flex items-center gap-2"><Droplets size={16} className="text-gold-500" /> غرفة غسيل</span>
                          {!unit.roof && <span className="flex items-center gap-2"><Fingerprint size={16} className="text-gold-500" /> دخول ذكي</span>}
                          {!unit.roof && <span className="flex items-center gap-2"><Wifi size={16} className="text-gold-500" /> منزل ذكي</span>}
                          {unit.roof && <span className="flex items-center gap-2"><Umbrella size={16} className="text-gold-500" /> سطح خاص كبير</span>}
                          {!unit.roof && <span className="flex items-center gap-2"><Box size={16} className="text-gold-500" /> مستودع</span>}
                          {!unit.roof && <span className="flex items-center gap-2"><Car size={16} className="text-gold-500" /> موقف خاص</span>}
                          <span className="col-span-2 flex items-center gap-2"><Layers size={16} className="text-gold-500" /> خزان أرضي وعلوي مستقل</span>
                          <span className="col-span-2 flex items-center gap-2"><Bath size={16} className="text-gold-500" /> 4 دورات مياه</span>
                        </div>
                        
                        {/* أزرار الحجز والاتصال الجديدة */}
                        <div className="flex flex-col sm:flex-row gap-3 pt-4 border-t border-slate-200 dark:border-brand-700 relative z-30">
                          <button
                            onClick={(e) => { e.stopPropagation(); window.scrollTo(0, 0); navigate('/contact'); }}
                            disabled={unit.isSold}
                            className={`flex-1 py-3 rounded-xl text-sm font-bold transition flex items-center justify-center gap-2 ${unit.isSold ? 'bg-slate-200 dark:bg-brand-800 text-slate-400 dark:text-brand-500 cursor-not-allowed' : 'bg-brand-800 text-white hover:bg-gold-500 shadow-md'}`}
                          >
                            <CalendarCheck size={18} /> {unit.isSold ? "الوحدة غير متاحة" : "احجز هذه الوحدة"}
                          </button>
                          <a
                            href="tel:920032842"
                            onClick={(e) => e.stopPropagation()}
                            className="flex-1 bg-white dark:bg-brand-900 border-2 border-brand-800 dark:border-brand-700 text-brand-800 dark:text-brand-300 py-3 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-brand-800 transition flex items-center justify-center gap-2 shadow-sm"
                          >
                            <PhoneCall size={18} /> 920032842
                          </a>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="order-1 lg:order-2 h-full min-h-[420px]">
            <div className="relative overflow-hidden rounded-3xl shadow-xl border-4 border-white h-full bg-white dark:bg-brand-900 flex items-center justify-center p-2">
              <img
                key={selectedFloor}
                src={`/images/floor-${selectedFloor === 'ground' ? 'ground.jpg' : selectedFloor === 'first' ? '1.png' : selectedFloor === 'second' ? '2.png' : selectedFloor === 'third' ? '3.png' : '4.png'}`}
                alt={`مخطط ${floors.find(f => f.id === selectedFloor)?.label}`}
                className="w-full h-full object-contain rounded-2xl cursor-pointer hover:scale-[1.02] transition-transform duration-300"
                style={{ maxHeight: '520px' }}
                onClick={() => setPreviewImg(`/images/floor-${selectedFloor === 'ground' ? 'ground.jpg' : selectedFloor === 'first' ? '1.png' : selectedFloor === 'second' ? '2.png' : selectedFloor === 'third' ? '3.png' : '4.png'}`)}
              />
              <button
                onClick={() => setPreviewImg(`/images/floor-${selectedFloor === 'ground' ? 'ground.jpg' : selectedFloor === 'first' ? '1.png' : selectedFloor === 'second' ? '2.png' : selectedFloor === 'third' ? '3.png' : '4.png'}`)}
                className="absolute bottom-4 left-4 bg-brand-800/80 hover:bg-brand-800 text-white p-2.5 rounded-xl backdrop-blur-sm transition shadow-lg"
              >
                <ZoomIn size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    {/* مودال عرض المخطط بالحجم الكامل */}
    {previewImg && (
      <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-fadeIn" onClick={() => setPreviewImg(null)}>
        <button className="absolute top-6 left-6 text-white/80 hover:text-white text-4xl font-light z-10 bg-white/10 hover:bg-white/20 w-12 h-12 rounded-full flex items-center justify-center backdrop-blur-sm transition" onClick={() => setPreviewImg(null)}>&times;</button>
        <img src={previewImg} alt="معاينة المخطط" className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()} />
      </div>
    )}
    </>
  );
}