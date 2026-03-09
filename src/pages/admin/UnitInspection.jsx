import React, { useState, useEffect } from 'react';
import { ChevronRight, ClipboardCheck, CheckCircle2, Save, Printer, RefreshCw, FileWarning, Settings2, ShieldCheck, Zap, PaintRoller, DoorOpen, PlusCircle, ListTodo, Hammer, Building } from 'lucide-react';

const API_URL = "https://semak.sa/api.php";

// 🔥 التصنيفات الهندسية العامة (تطبق على أي غرفة/فراغ يجي من الداتابيس)
const GENERIC_CATEGORIES = [
  { id: 'finishes', name: 'التشطيبات', icon: PaintRoller, color: 'text-orange-500', items: ['استواء الأرضيات والترويبة', 'جودة الدهانات وخلوها من التشققات', 'الأسقف المستعارة (الجبس)', 'العزل المائي (إن وجد)'] },
  { id: 'mep', name: 'الأعمال الكهروميكانيكية', icon: Zap, color: 'text-blue-500', items: ['عمل الأفياش والمفاتيح', 'توزيع الإضاءة', 'عمل التكييف والتهوية', 'السباكة وتصريف المياه'] },
  { id: 'doors', name: 'الأبواب والنوافذ', icon: DoorOpen, color: 'text-slate-600', items: ['سلاسة فتح وإغلاق الأبواب', 'المفصلات والكوالين', 'عزل النوافذ (صوت ومياه)'] }
];

export default function UnitInspection({ user, navigateTo, showToast }) {
  const [viewMode, setViewMode] = useState('list'); 
  const [inspectionsList, setInspectionsList] = useState([]);
  
  // 🔥 حالات البيانات الديناميكية من الداتابيس
  const [dbProjects, setDbProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState(null);
  const [unitName, setUnitName] = useState(""); 
  
  const [inspectionData, setInspectionData] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === 'admin';

  // 1. جلب المشاريع وقائمة المهام عند فتح الأداة
  useEffect(() => {
    const fetchInitialData = async () => {
      setLoading(true);
      try {
        // جلب المشاريع (الغرف والوحدات)
        const projRes = await fetch(`${API_URL}?action=get_projects_data`);
        const projData = await projRes.json();
        if (projData.success) {
          setDbProjects(projData.data);
          if (projData.data.length > 0) setSelectedProject(projData.data[0]);
        }
        
        // جلب المهام الحالية
        const tasksRes = await fetch(`${API_URL}?action=get_all_inspections`);
        const tasksData = await tasksRes.json();
        if (tasksData.success) setInspectionsList(tasksData.data);
        
      } catch (e) {
        if(showToast) showToast("خطأ", "فشل الاتصال بقاعدة البيانات", "error");
      } finally {
        setLoading(false);
      }
    };
    
    if (viewMode === 'list') {
      fetchInitialData();
    }
  }, [viewMode]);

  // 2. تحديث قائمة البنود بناءً على المشروع والوحدة المختارة
  useEffect(() => {
    if ((viewMode === 'setup' || viewMode === 'inspect') && unitName) {
      loadInspection();
    }
  }, [unitName, selectedProject]);

  const loadInspection = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=get_inspection&unit=${unitName}`);
      const data = await res.json();
      
      if (data.success && data.data) {
        // إذا الوحدة لها فحص سابق، اسحبه
        setInspectionData(JSON.parse(data.data.inspection_data));
      } else {
        // 🔥 إذا فحص جديد، ابنِ القالب بناءً على (غرف المشروع المحدد)
        const initialData = {};
        if (selectedProject && selectedProject.spaces) {
          selectedProject.spaces.forEach(space => {
            GENERIC_CATEGORIES.forEach(cat => {
              cat.items.forEach(item => {
                initialData[`${space}_${cat.name}_${item}`] = { isSelected: true, passed: null, notes: '' };
              });
            });
          });
        }
        setInspectionData(initialData);
      }
    } catch (e) {
      if(showToast) showToast("خطأ", "فشل تحميل بيانات الوحدة", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewTask = () => {
    if (dbProjects.length === 0) {
      if(showToast) showToast("تنبيه", "لا توجد مشاريع مسجلة في النظام", "error");
      return;
    }
    const firstProj = dbProjects[0];
    setSelectedProject(firstProj);
    setUnitName(firstProj.units[0] || ""); 
    setViewMode('setup');
  };

  const handleOpenTask = (unit, dataString, mode) => {
    // البحث عن المشروع الذي تنتمي له هذه الوحدة
    const proj = dbProjects.find(p => p.units.includes(unit));
    if (proj) setSelectedProject(proj);
    
    setUnitName(unit);
    setInspectionData(JSON.parse(dataString));
    setViewMode(mode); 
  };

  const toggleItemSelection = (space, cat, item) => {
    const key = `${space}_${cat}_${item}`;
    setInspectionData(prev => ({
      ...prev,
      [key]: { ...prev[key], isSelected: !prev[key]?.isSelected }
    }));
  };

  const handleStatusChange = (space, cat, item, status) => {
    const key = `${space}_${cat}_${item}`;
    setInspectionData(prev => ({
      ...prev,
      [key]: { ...prev[key], passed: status === 'pass' }
    }));
  };

  const handleNoteChange = (space, cat, item, note) => {
    const key = `${space}_${cat}_${item}`;
    setInspectionData(prev => ({
      ...prev,
      [key]: { ...prev[key], notes: note }
    }));
  };

  const calculateProgress = () => {
    const activeItems = Object.values(inspectionData).filter(v => v?.isSelected);
    if (activeItems.length === 0) return 0;
    const passedItems = activeItems.filter(v => v.passed === true).length;
    return Math.round((passedItems / activeItems.length) * 100);
  };

  const handleSave = async () => {
    if (!unitName) {
      if(showToast) showToast("تنبيه", "يجب تحديد الوحدة أولاً", "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        unit: unitName,
        evaluator_id: user?.id || 1,
        inspection_data: JSON.stringify(inspectionData),
        progress: calculateProgress()
      };
      const res = await fetch(`${API_URL}?action=save_inspection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        if(showToast) showToast("تم الحفظ", `تم حفظ المهمة للوحدة ${unitName} بنجاح ✅`);
        setViewMode('list'); 
      }
    } catch (e) {
      if(showToast) showToast("خطأ", "فشل الاتصال بالسيرفر", "error");
    } finally {
      setSaving(false);
    }
  };

  // ==========================================
  // 1. شاشة القائمة
  // ==========================================
  if (viewMode === 'list') {
    return (
      <div className="pt-24 pb-20 bg-slate-50 min-h-screen animate-fadeIn">
        <div className="container mx-auto px-6 max-w-6xl">
          
          <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
            <div className="flex items-center gap-4">
              <button onClick={() => navigateTo('dashboard')} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-full transition border border-slate-100">
                <ChevronRight size={24} className="text-slate-600" />
              </button>
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-[#1a365d] flex items-center gap-3">
                  <ListTodo className="text-indigo-600" size={32} /> مهام الفحص والاستلام
                </h1>
                <p className="text-slate-400 text-sm font-bold mt-1">الوحدات المجدولة للتدقيق الهندسي عبر مشاريع الشركة</p>
              </div>
            </div>

            {isAdmin && (
              <button onClick={handleCreateNewTask} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-200">
                <PlusCircle size={20} /> تكليف فحص جديد
              </button>
            )}
          </div>

          {loading ? (
            <div className="text-center py-20"><RefreshCw className="animate-spin mx-auto text-indigo-500 mb-4" size={40} /><p className="text-slate-500 font-bold">جاري تحميل البيانات...</p></div>
          ) : inspectionsList.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-[2rem] border border-slate-100 shadow-sm"><ClipboardCheck className="mx-auto text-slate-300 mb-4" size={60} /><p className="text-slate-500 font-bold text-lg">لا توجد وحدات مجدولة للفحص حالياً</p></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {inspectionsList.map((task, idx) => {
                const prog = parseInt(task.progress);
                const statusColor = prog === 100 ? 'text-emerald-500 bg-emerald-50' : prog > 0 ? 'text-blue-500 bg-blue-50' : 'text-slate-500 bg-slate-100';
                const statusText = prog === 100 ? 'مكتمل' : prog > 0 ? 'قيد الفحص' : 'مهمة جديدة';
                const projName = dbProjects.find(p => p.units.includes(task.unit))?.name || "مشروع غير محدد";

                return (
                  <div key={idx} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 hover:shadow-lg transition-shadow group relative overflow-hidden">
                    <div className={`absolute top-0 right-0 w-2 h-full ${prog === 100 ? 'bg-emerald-400' : prog > 0 ? 'bg-blue-400' : 'bg-slate-300'}`}></div>
                    
                    <div className="flex justify-between items-start mb-4">
                      <div className={`px-3 py-1 rounded-full text-xs font-black ${statusColor}`}>{statusText}</div>
                      <span className="text-2xl font-black text-[#1a365d]">{prog}%</span>
                    </div>
                    
                    <h3 className="text-xl font-black text-[#1a365d] mb-1 pr-2">{task.unit}</h3>
                    <p className="text-xs font-bold text-slate-400 mb-4 pr-2 flex items-center gap-1"><Building size={12}/> {projName}</p>
                    
                    <div className="w-full bg-slate-100 h-2 rounded-full mb-6 overflow-hidden">
                      <div className={`h-full ${prog === 100 ? 'bg-emerald-400' : 'bg-blue-400'}`} style={{ width: `${prog}%` }}></div>
                    </div>

                    <div className="flex gap-2">
                      <button onClick={() => handleOpenTask(task.unit, task.inspection_data, 'inspect')} className="flex-1 bg-indigo-50 text-indigo-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-600 hover:text-white transition">
                        <Hammer size={16} /> {prog > 0 ? 'متابعة الفحص' : 'بدء الفحص'}
                      </button>
                      {isAdmin && (
                        <button onClick={() => handleOpenTask(task.unit, task.inspection_data, 'setup')} className="bg-slate-50 text-slate-500 p-3 rounded-xl hover:bg-slate-200 transition" title="تعديل الخطة">
                          <Settings2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // 2. شاشة التجهيز (Setup) والتنفيذ (Inspect)
  // ==========================================
  
  // بناء القاموس الديناميكي بناءً على غرف المشروع المحدد
  const dynamicDictionary = selectedProject?.spaces?.map(spaceName => ({
    space: spaceName,
    categories: GENERIC_CATEGORIES
  })) || [];

  return (
    <div className="pt-24 pb-20 bg-slate-50 min-h-screen animate-fadeIn">
      <div className="container mx-auto px-6 max-w-6xl">
        
        <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 mb-8 flex flex-col md:flex-row justify-between items-center gap-6 relative overflow-hidden">
          {viewMode === 'setup' && <div className="absolute top-0 left-0 w-full h-1 bg-orange-400"></div>}
          <div className="flex items-center gap-4 w-full md:w-auto">
            <button onClick={() => setViewMode('list')} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-full transition border border-slate-100 hidden md:block">
              <ChevronRight size={24} className="text-slate-600" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-black text-[#1a365d] flex items-center gap-3">
                {viewMode === 'setup' ? <Settings2 className="text-orange-500" size={32} /> : <ClipboardCheck className="text-indigo-600" size={32} />} 
                {viewMode === 'setup' ? 'تجهيز خطة الفحص (مدير)' : 'تنفيذ الفحص (مهندس)'}
              </h1>
              
              <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                 {/* 🔥 القوائم الديناميكية للمشاريع والوحدات */}
                 {viewMode === 'setup' ? (
                   <>
                     <select 
                        value={selectedProject?.id || ""} 
                        onChange={(e) => {
                          const proj = dbProjects.find(p => p.id.toString() === e.target.value);
                          setSelectedProject(proj);
                          setUnitName(proj?.units[0] || "");
                        }} 
                        className="bg-slate-50 border border-orange-200 text-[#1a365d] font-black outline-none px-4 py-2 rounded-xl focus:border-orange-500 transition shadow-sm cursor-pointer"
                     >
                       {dbProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                     </select>
                     
                     <select 
                        value={unitName} 
                        onChange={(e) => setUnitName(e.target.value)} 
                        className="bg-slate-50 border border-orange-200 text-[#1a365d] font-black outline-none px-4 py-2 rounded-xl focus:border-orange-500 transition shadow-sm cursor-pointer"
                     >
                       {selectedProject?.units.length > 0 ? (
                          selectedProject.units.map(u => <option key={u} value={u}>وحدة: {u}</option>)
                       ) : (
                          <option disabled>لا توجد وحدات</option>
                       )}
                     </select>
                   </>
                 ) : (
                   <div className="flex items-center gap-2">
                     <span className="text-sm font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">{selectedProject?.name}</span>
                     <span className="text-lg font-black text-[#1a365d] bg-slate-100 px-4 py-1 rounded-lg border border-slate-200">{unitName}</span>
                   </div>
                 )}
              </div>
            </div>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <button onClick={handleSave} disabled={saving} className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-200 disabled:opacity-50">
              {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />} حفظ المهمة
            </button>
          </div>
        </div>

        {viewMode === 'inspect' && (
            <div className="bg-white p-8 rounded-[2rem] mb-8 shadow-sm border border-slate-100 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
            <div className="relative z-10 flex justify-between items-center mb-4">
                <div className="flex items-center gap-2">
                    <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600"><CheckCircle2 size={20}/></div>
                    <span className="text-lg font-black text-[#1a365d]">نسبة الإنجاز والمطابقة</span>
                </div>
                <span className="text-3xl text-indigo-600 font-black">{calculateProgress()}%</span>
            </div>
            <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden relative z-10">
                <div className="bg-gradient-to-l from-indigo-500 to-emerald-400 h-full transition-all duration-1000 ease-out" style={{ width: `${calculateProgress()}%` }}></div>
            </div>
            </div>
        )}

        {/* 🔥 عرض الغرف الديناميكي بناءً على المشروع */}
        <div className="space-y-8">
          {dynamicDictionary.length === 0 && !loading && (
             <div className="text-center p-10 bg-white rounded-3xl border border-slate-100"><p className="text-slate-500 font-bold">لا توجد غرف مسجلة لهذا المشروع في قاعدة البيانات.</p></div>
          )}

          {dynamicDictionary.map((spaceData, index) => {
            const hasActiveItems = spaceData.categories.some(cat => 
                cat.items.some(item => inspectionData[`${spaceData.space}_${cat.name}_${item}`]?.isSelected)
            );
            if (viewMode === 'inspect' && !hasActiveItems) return null;

            return (
              <div key={index} className={`bg-white rounded-[2.5rem] shadow-sm border overflow-hidden ${viewMode === 'setup' ? 'border-orange-100' : 'border-slate-100'}`}>
                <div className={`${viewMode === 'setup' ? 'bg-[#c5a059]' : 'bg-[#1a365d]'} p-6 text-white flex justify-between items-center`}>
                    <h2 className="text-2xl font-black">{spaceData.space}</h2>
                    {viewMode === 'setup' && <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold">ضع علامة (صح) على البنود المطلوبة</span>}
                </div>

                <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                    {spaceData.categories.map((cat, catIdx) => {
                        const Icon = cat.icon;
                        const hasActiveCatItems = cat.items.some(item => inspectionData[`${spaceData.space}_${cat.name}_${item}`]?.isSelected);
                        if (viewMode === 'inspect' && !hasActiveCatItems) return null;

                        return (
                            <div key={catIdx} className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100">
                                <div className="flex items-center gap-3 mb-6 border-b border-slate-200 pb-4">
                                    <div className={`p-2 bg-white rounded-lg shadow-sm ${cat.color}`}><Icon size={20} /></div>
                                    <h3 className="font-black text-[#1a365d]">{cat.name}</h3>
                                </div>

                                <div className="space-y-4">
                                    {cat.items.map((item, itemIdx) => {
                                        const key = `${spaceData.space}_${cat.name}_${item}`;
                                        const itemData = inspectionData[key] || { isSelected: false, passed: null, notes: '' };
                                        
                                        if (viewMode === 'setup') {
                                            return (
                                                <label key={itemIdx} className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer border transition-all ${itemData.isSelected ? 'bg-orange-50 border-orange-200 shadow-sm' : 'bg-white border-slate-200 opacity-60 hover:bg-slate-50'}`}>
                                                    <input type="checkbox" checked={itemData.isSelected} onChange={() => toggleItemSelection(spaceData.space, cat.name, item)} className="mt-0.5 w-5 h-5 accent-orange-500 cursor-pointer" />
                                                    <span className={`text-sm font-bold ${itemData.isSelected ? 'text-orange-900' : 'text-slate-500'}`}>{item}</span>
                                                </label>
                                            );
                                        }

                                        if (!itemData.isSelected) return null;

                                        const isPassed = itemData.passed === true;
                                        const isFailed = itemData.passed === false;

                                        return (
                                            <div key={itemIdx} className={`flex flex-col p-4 rounded-xl border transition-all duration-300 ${isPassed ? 'bg-emerald-50/50 border-emerald-100' : isFailed ? 'bg-white border-red-200 shadow-sm' : 'bg-white border-slate-200'}`}>
                                                <span className={`font-bold text-sm mb-3 ${isPassed ? 'text-emerald-800' : isFailed ? 'text-red-700' : 'text-slate-700'}`}>{item}</span>
                                                <div className="flex gap-2">
                                                    <button onClick={() => handleStatusChange(spaceData.space, cat.name, item, 'pass')} className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${isPassed ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-600'}`}>
                                                        <CheckCircle2 size={14} /> مطابق
                                                    </button>
                                                    <button onClick={() => handleStatusChange(spaceData.space, cat.name, item, 'fail')} className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${isFailed ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-600'}`}>
                                                        <FileWarning size={14} /> ملاحظة
                                                    </button>
                                                </div>

                                                <div className={`grid transition-all duration-300 ease-in-out ${isFailed ? 'grid-rows-[1fr] opacity-100 mt-3' : 'grid-rows-[0fr] opacity-0 mt-0'}`}>
                                                    <div className="overflow-hidden">
                                                        <textarea placeholder="اكتب تفاصيل الملاحظة الهندسية..." value={itemData.notes || ''} onChange={(e) => handleNoteChange(spaceData.space, cat.name, item, e.target.value)} className="w-full bg-red-50/50 border border-red-100 rounded-lg p-3 text-xs font-medium outline-none focus:border-red-400 focus:bg-white resize-none h-20 placeholder-red-300 text-red-800" />
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
              </div>
            );
          })}
        </div>

        {viewMode === 'inspect' && (
          <div className="mt-12 text-center">
            <button onClick={() => window.print()} className="bg-[#1a365d] text-white px-10 py-4 rounded-2xl font-black flex items-center justify-center gap-3 mx-auto hover:bg-[#c5a059] transition-colors no-print shadow-xl">
              <Printer size={20} /> طباعة تقرير الاستلام الهندسي
            </button>
          </div>
        )}

      </div>
    </div>
  );
}