import React, { useState, useEffect } from 'react';
import { ChevronRight, ClipboardCheck, CheckCircle2, Save, RefreshCw, FileWarning, Settings2, ShieldCheck, Trash2, X, AlertTriangle, Hammer, Plus, HardHat, Copy, Link as LinkIcon, Eye } from 'lucide-react';

const API_URL = "https://semak.sa/api.php";

export default function UnitInspection({ user, navigateTo, showToast }) {
  const [viewMode, setViewMode] = useState('list'); // list, setup, inspect, client_setup
  const [inspectionsList, setInspectionsList] = useState([]);
  const [dbProjects, setDbProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedUnitObj, setSelectedUnitObj] = useState(null);
  const [unitName, setUnitName] = useState("");
  const [inspectionData, setInspectionData] = useState({});

  const [globalTemplate, setGlobalTemplate] = useState([]);
  const [newItemName, setNewItemName] = useState("");
  const [newTarget, setNewTarget] = useState("both");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");

  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkUnit, setLinkUnit] = useState("");
  const [showSnagModal, setShowSnagModal] = useState(false);
  const [currentSnags, setCurrentSnags] = useState([]);
  const [showSelectUnitModal, setShowSelectUnitModal] = useState(false);
  const [selectedReadyUnit, setSelectedReadyUnit] = useState("");

  const isAdmin = user?.role === 'admin';

  useEffect(() => { if (viewMode === 'list') fetchData(); }, [viewMode]);
  useEffect(() => { if (['setup', 'inspect', 'client_setup'].includes(viewMode) && unitName) loadInspection(); }, [unitName, selectedProject]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projRes, tasksRes, templateRes] = await Promise.all([
        fetch(`${API_URL}?action=get_projects_data`), fetch(`${API_URL}?action=get_all_inspections`), fetch(`${API_URL}?action=get_inspection_template`)
      ]);
      const projData = await projRes.json(); const tasksData = await tasksRes.json(); const templateData = await templateRes.json();
      
      if (projData.success && Array.isArray(projData.data)) setDbProjects(projData.data);
      if (tasksData.success && Array.isArray(tasksData.data)) setInspectionsList(tasksData.data);
      
      if (templateData.success && Array.isArray(templateData.data)) {
        const formattedTemplate = templateData.data.map(cat => ({
          ...cat, items: Array.isArray(cat.items) ? cat.items.map(item => typeof item === 'string' ? { name: item, target: 'both' } : item) : []
        }));
        setGlobalTemplate(formattedTemplate);
        if(formattedTemplate.length > 0) setSelectedCategory(formattedTemplate[0].name);
      }
    } catch (e) {} finally { setLoading(false); }
  };

  const loadInspection = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=get_inspection&unit=${unitName}`);
      const data = await res.json();
      if (data.success && data.data) { setInspectionData(JSON.parse(data.data.inspection_data || "{}")); } 
      else {
        const initialData = {};
        if (selectedUnitObj && Array.isArray(selectedUnitObj.spaces)) {
          selectedUnitObj.spaces.forEach(space => {
            (globalTemplate || []).forEach(cat => { 
                if(Array.isArray(cat.items)) {
                    cat.items.forEach(item => { initialData[`${space}_${cat.name}_${item.name}`] = { isSelected: true, passed: null, notes: '', clientVisible: true }; }); 
                }
            });
          });
        }
        setInspectionData(initialData);
      }
    } catch (e) {} finally { setLoading(false); }
  };

  const handleToggleAll = (status) => {
    setInspectionData(prev => {
        const newData = {};
        Object.keys(prev || {}).forEach(key => { newData[key] = { ...prev[key], isSelected: status }; });
        return newData;
    });
  };

  const handleCopySetup = (sourceUnitCode) => {
      if(!sourceUnitCode) return;
      const sourceTask = (inspectionsList || []).find(t => t.unit === sourceUnitCode);
      if(!sourceTask) return;
      try {
          const sourceData = JSON.parse(sourceTask.inspection_data || "{}");
          setInspectionData(prev => {
              const newData = {};
              Object.keys(prev || {}).forEach(key => {
                  let finalIsSelected = prev[key].isSelected; 
                  if (sourceData[key] !== undefined) { finalIsSelected = sourceData[key].isSelected; } 
                  else {
                      const parts = key.split('_');
                      if (parts.length >= 3) {
                          const catItemKey = parts[1] + '_' + parts.slice(2).join('_');
                          const matchingSourceKeys = Object.keys(sourceData).filter(sKey => sKey.endsWith('_' + catItemKey));
                          if (matchingSourceKeys.length > 0) {
                              const isTurnedOffAnywhere = matchingSourceKeys.some(sKey => sourceData[sKey].isSelected === false);
                              finalIsSelected = !isTurnedOffAnywhere;
                          }
                      }
                  }
                  newData[key] = { ...prev[key], isSelected: finalIsSelected };
              });
              return newData;
          });
          if(showToast) showToast("تم الاستنساخ", `تم تطبيق إعدادات الوحدة ${sourceUnitCode} بنجاح`);
      } catch(e) { if(showToast) showToast("خطأ", "فشل نسخ الإعدادات", "error"); }
  };

  const handleCreateNewTask = () => {
    if (!dbProjects || dbProjects.length === 0) return;
    const firstProj = dbProjects[0]; setSelectedProject(firstProj);
    const firstUnit = firstProj.units_details?.[0]; setSelectedUnitObj(firstUnit || null);
    setUnitName(firstUnit?.unit_code || ""); setViewMode('setup');
  };

  const handleOpenTask = (unitCode, dataString, mode) => {
    let foundProj = null; let foundUnit = null;
    for(let p of (dbProjects || [])) { 
        const u = (p.units_details || []).find(ud => ud.unit_code === unitCode); 
        if(u) { foundProj = p; foundUnit = u; break; } 
    }
    if (foundProj) setSelectedProject(foundProj); if (foundUnit) setSelectedUnitObj(foundUnit);
    setUnitName(unitCode); setInspectionData(JSON.parse(dataString || "{}")); setViewMode(mode); 
  };

  const calculateProgress = () => {
    const activeItems = Object.values(inspectionData || {}).filter(v => v?.isSelected);
    if (activeItems.length === 0) return 0;
    const passedItems = activeItems.filter(v => v.passed === true).length;
    return Math.round((passedItems / activeItems.length) * 100);
  };

  const handleSaveEngineerTask = async () => {
    if (!unitName) return;
    setSaving(true);
    try {
      const payload = { unit: unitName, evaluator_id: user?.id || 1, inspection_data: JSON.stringify(inspectionData), progress: calculateProgress() };
      await fetch(`${API_URL}?action=save_inspection`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if(showToast) showToast("تم الحفظ", `تم حفظ عمل المهندس للوحدة ${unitName} بنجاح ✅`);
      setViewMode('list'); 
    } catch (e) {} finally { setSaving(false); }
  };

  const handleSaveClientSetup = async () => {
    if (!unitName) return;
    setSaving(true);
    try {
      const payload = { unit: unitName, evaluator_id: user?.id || 1, inspection_data: JSON.stringify(inspectionData), progress: calculateProgress() };
      await fetch(`${API_URL}?action=save_inspection`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if(showToast) showToast("تم الحفظ", `تم تحديد بنود العميل بنجاح وإصدار الرابط ✅`);
      setLinkUnit(unitName);
      setViewMode('list');
      setShowLinkModal(true); // إظهار الرابط تلقائياً بعد الحفظ
    } catch (e) {} finally { setSaving(false); }
  };

  const toggleItemSelection = (space, cat, item) => { const key = `${space}_${cat}_${item}`; setInspectionData(prev => ({ ...prev, [key]: { ...prev[key], isSelected: !prev[key]?.isSelected } })); };
  const handleStatusChange = (space, cat, item, status) => { const key = `${space}_${cat}_${item}`; setInspectionData(prev => ({ ...prev, [key]: { ...prev[key], passed: status === 'pass' } })); };
  const handleNoteChange = (space, cat, item, note) => { const key = `${space}_${cat}_${item}`; setInspectionData(prev => ({ ...prev, [key]: { ...prev[key], notes: note } })); };
  
  // دالة جديدة لتفعيل/إلغاء تفعيل ظهور البند للعميل
  const toggleClientVisibility = (space, cat, item) => {
      const key = `${space}_${cat}_${item}`;
      setInspectionData(prev => ({ ...prev, [key]: { ...prev[key], clientVisible: prev[key]?.clientVisible === false ? true : false } }));
  };

  const handleDeleteTask = async (unitCode) => {
    if(!window.confirm(`تأكيد حذف تقرير الوحدة ${unitCode}؟`)) return;
    await fetch(`${API_URL}?action=delete_inspection`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unit: unitCode }) });
    fetchData();
  };

  const handleSaveTemplate = async () => {
    setSaving(true);
    try {
      await fetch(`${API_URL}?action=save_inspection_template`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ template: globalTemplate }) });
      if(showToast) showToast("تم الحفظ", "تم التحديث بنجاح"); setViewMode('list');
    } catch (e) {} finally { setSaving(false); }
  };

  const handleAddItem = () => {
    if(!newItemName.trim()) return;
    let targetCatName = selectedCategory; let templateCopy = [...(globalTemplate || [])];
    if (selectedCategory === "new") {
        if(!newCategoryName.trim()) return;
        targetCatName = newCategoryName.trim(); templateCopy.push({ name: targetCatName, color: 'text-indigo-600', items: [] });
    }
    const catIndex = templateCopy.findIndex(c => c.name === targetCatName);
    if(catIndex > -1) {
        templateCopy[catIndex].items.push({ name: newItemName.trim(), target: newTarget });
        setGlobalTemplate(templateCopy); setNewItemName("");
        if(selectedCategory === "new") { setSelectedCategory(targetCatName); setNewCategoryName(""); }
    }
  };

  const handleUpdateItemTarget = (catIndex, itemIndex, newTargetValue) => {
      const templateCopy = [...globalTemplate]; templateCopy[catIndex].items[itemIndex].target = newTargetValue; setGlobalTemplate(templateCopy);
  };

  const handleRemoveItem = (catIndex, itemIndex) => {
      const templateCopy = [...globalTemplate]; templateCopy[catIndex].items.splice(itemIndex, 1);
      if(templateCopy[catIndex].items.length === 0) {
          templateCopy.splice(catIndex, 1);
          if(templateCopy.length > 0) setSelectedCategory(templateCopy[0].name); else setSelectedCategory("new");
      }
      setGlobalTemplate(templateCopy);
  };

  const openSnagReport = (inspectionDataStr) => {
      try {
          const data = JSON.parse(inspectionDataStr || "{}"); const snags = [];
          Object.keys(data).forEach(key => { if(data[key].passed === false) { const [space, cat, item] = key.split('_'); snags.push({ space, cat, item, note: data[key].notes }); } });
          setCurrentSnags(snags); setShowSnagModal(true);
      } catch (e) {}
  };

  const copyClientLink = () => {
    const link = `https://semak.sa/handover?unit=${encodeURIComponent(String(linkUnit).trim())}`;
    navigator.clipboard.writeText(link);
    if(showToast) showToast("تم النسخ", "تم نسخ رابط العميل بنجاح، يمكنك لصقه وإرساله الآن");
    setTimeout(() => setShowLinkModal(false), 1500); 
  };

  if (viewMode === 'settings') {
      return (
          <div className="pt-24 pb-20 bg-slate-50 min-h-screen animate-fadeIn">
              <div className="container mx-auto px-6 max-w-5xl">
                  <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
                      <div>
                          <button onClick={() => setViewMode('list')} className="text-slate-400 hover:text-[#1a365d] mb-2 flex items-center gap-1 text-sm font-bold transition"><ChevronRight size={16}/> العودة للقائمة</button>
                          <h1 className="text-2xl font-black text-[#1a365d] flex items-center gap-3"><Settings2 className="text-orange-500"/> إدارة بنود الفحص المركزية</h1>
                      </div>
                      <button onClick={handleSaveTemplate} disabled={saving} className="bg-[#1a365d] text-white px-10 py-4 rounded-xl font-black flex items-center gap-2 hover:bg-blue-900 transition shadow-xl">
                          {saving ? <RefreshCw className="animate-spin" size={20}/> : <Save size={20}/>} حفظ واعتماد البنود
                      </button>
                  </div>

                  <div className="bg-[#1a365d] p-6 rounded-[2rem] shadow-xl mb-8 flex flex-col md:flex-row gap-4 items-end animate-fade-in-up relative overflow-hidden">
                      <div className="w-full md:w-1/4 relative z-10">
                          <label className="block text-xs font-bold text-slate-300 mb-2">القسم</label>
                          <select value={selectedCategory} onChange={e=>setSelectedCategory(e.target.value)} className="w-full bg-white/10 border border-white/20 text-white rounded-xl p-3 outline-none font-bold text-sm">
                              {(globalTemplate || []).map(c => <option key={c.name} value={c.name} className="text-slate-900">{c.name}</option>)}
                              <option value="new" className="text-slate-900">+ إنشاء قسم جديد...</option>
                          </select>
                      </div>
                      {selectedCategory === "new" && (
                          <div className="w-full md:w-1/4 relative z-10">
                              <label className="block text-xs font-bold text-slate-300 mb-2">اسم القسم الجديد</label>
                              <input type="text" value={newCategoryName} onChange={e=>setNewCategoryName(e.target.value)} className="w-full bg-white border border-white/20 text-[#1a365d] rounded-xl p-3 outline-none font-bold text-sm" />
                          </div>
                      )}
                      <div className="flex-1 w-full relative z-10">
                          <label className="block text-xs font-bold text-slate-300 mb-2">اسم البند</label>
                          <input type="text" value={newItemName} onChange={e=>setNewItemName(e.target.value)} onKeyPress={e => {if(e.key === 'Enter') handleAddItem();}} className="w-full bg-white border border-white/20 text-[#1a365d] rounded-xl p-3 outline-none font-bold text-sm" />
                      </div>
                      <div className="w-full md:w-1/5 relative z-10">
                          <label className="block text-xs font-bold text-slate-300 mb-2">مخصص لـ</label>
                          <select value={newTarget} onChange={e=>setNewTarget(e.target.value)} className="w-full bg-white/10 border border-white/20 text-white rounded-xl p-3 outline-none font-bold text-sm">
                              <option value="both" className="text-slate-900">يظهر للجميع</option>
                              <option value="client" className="text-slate-900">للعميل فقط</option>
                              <option value="engineer" className="text-slate-900">للمهندس فقط</option>
                          </select>
                      </div>
                      <button onClick={handleAddItem} className="bg-[#c5a059] text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-yellow-600 transition relative z-10"><Plus size={20}/> إضافة</button>
                  </div>

                  <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden animate-fadeIn">
                      <div className="overflow-x-auto">
                          <table className="w-full text-right">
                              <thead className="bg-slate-50 border-b border-slate-100 text-[#1a365d] font-black text-sm">
                                  <tr><th className="p-5 w-1/4">القسم</th><th className="p-5 w-2/4">اسم البند</th><th className="p-5">يظهر لـ</th><th className="p-5 text-center">إجراء</th></tr>
                              </thead>
                              <tbody>
                                  {(globalTemplate || []).length === 0 && <tr><td colSpan="4" className="text-center p-10 text-slate-400 font-bold">لا توجد بنود حالياً</td></tr>}
                                  {(globalTemplate || []).map((cat, cIdx) => (
                                      (cat.items || []).map((item, iIdx) => (
                                          <tr key={`${cIdx}-${iIdx}`} className="border-b border-slate-50 hover:bg-slate-50/50 transition">
                                              <td className="p-5 font-bold text-slate-500 text-sm">{cat.name}</td>
                                              <td className="p-5 font-black text-[#1a365d] text-sm">{item.name}</td>
                                              <td className="p-5">
                                                  <select value={item.target} onChange={(e) => handleUpdateItemTarget(cIdx, iIdx, e.target.value)} className={`text-xs font-bold p-2 rounded-lg border outline-none cursor-pointer ${item.target === 'both' ? 'bg-indigo-50 text-indigo-700' : item.target === 'client' ? 'bg-emerald-50 text-emerald-700' : 'bg-orange-50 text-orange-700'}`}>
                                                      <option value="both">👥 يظهر للجميع</option>
                                                      <option value="client">👤 للعميل فقط</option>
                                                      <option value="engineer">👷‍♂️ للمهندس فقط</option>
                                                  </select>
                                              </td>
                                              <td className="p-5 text-center"><button onClick={() => handleRemoveItem(cIdx, iIdx)} className="text-slate-300 hover:text-red-500 transition p-2 bg-white rounded-lg border border-slate-100 shadow-sm"><Trash2 size={16}/></button></td>
                                          </tr>
                                      ))
                                  ))}
                              </tbody>
                          </table>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  if (viewMode === 'setup' || viewMode === 'inspect' || viewMode === 'client_setup') {
      const spacesArray = Array.isArray(selectedUnitObj?.spaces) ? selectedUnitObj.spaces : [];
      const dynamicDictionary = spacesArray.map(spaceName => ({ space: spaceName, categories: globalTemplate || [] }));

      return (
        <div className="pt-24 pb-20 bg-slate-50 min-h-screen animate-fadeIn">
          <div className="container mx-auto px-6 max-w-6xl">
            <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 mb-8 flex flex-col justify-between items-start gap-6 relative overflow-hidden">
              {viewMode === 'setup' && <div className="absolute top-0 left-0 w-full h-1 bg-orange-400"></div>}
              {viewMode === 'client_setup' && <div className="absolute top-0 left-0 w-full h-1 bg-emerald-400"></div>}
              
              <div className="flex flex-col md:flex-row justify-between items-center w-full gap-4">
                  <div className="flex items-center gap-4 w-full md:w-auto">
                    <button onClick={() => setViewMode('list')} className="p-3 bg-slate-50 hover:bg-slate-100 rounded-full transition border border-slate-100 hidden md:block"><ChevronRight size={24} className="text-slate-600" /></button>
                    <div className="flex-1">
                      <h1 className="text-2xl font-black text-[#1a365d] flex items-center gap-3">
                        {viewMode === 'setup' ? <Settings2 className="text-orange-500" size={32} /> : 
                         viewMode === 'client_setup' ? <Eye className="text-emerald-500" size={32} /> : 
                         <ClipboardCheck className="text-indigo-600" size={32} />} 
                        
                        {viewMode === 'setup' ? 'تجهيز خطة الفحص للمهندس' : 
                         viewMode === 'client_setup' ? 'تحديد البنود المرئية للعميل' : 
                         'تنفيذ الفحص الهندسي'}
                      </h1>
                      
                      <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                         {viewMode === 'setup' ? (
                           <>
                             <select value={selectedProject?.id || ""} onChange={(e) => { const proj = dbProjects.find(p => p.id.toString() === e.target.value); setSelectedProject(proj); const firstUnit = proj?.units_details?.[0]; setSelectedUnitObj(firstUnit || null); setUnitName(firstUnit?.unit_code || ""); }} className="bg-slate-50 border border-orange-200 text-[#1a365d] font-black outline-none px-4 py-2 rounded-xl focus:border-orange-500 transition">
                                 {(dbProjects || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                             </select>
                             <select value={unitName} onChange={(e) => { setUnitName(e.target.value); const u = selectedProject?.units_details?.find(ud => ud.unit_code === e.target.value); setSelectedUnitObj(u || null); }} className="bg-slate-50 border border-orange-200 text-[#1a365d] font-black outline-none px-4 py-2 rounded-xl focus:border-orange-500 transition">
                                 {selectedProject?.units_details?.length > 0 ? (selectedProject.units_details.map(u => <option key={u.id} value={u.unit_code}>وحدة: {u.unit_code}</option>)) : (<option disabled>لا توجد وحدات</option>)}
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
                  
                  {viewMode === 'client_setup' ? (
                      <button onClick={handleSaveClientSetup} disabled={saving} className="bg-emerald-600 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-emerald-700 transition shadow-lg w-full md:w-auto">
                        {saving ? <RefreshCw size={18} className="animate-spin" /> : <LinkIcon size={18} />} حفظ وإصدار الرابط
                      </button>
                  ) : (
                      <button onClick={handleSaveEngineerTask} disabled={saving} className="bg-indigo-600 text-white px-8 py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition shadow-lg w-full md:w-auto">
                        {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />} حفظ عمل المهندس
                      </button>
                  )}
              </div>

              {viewMode === 'setup' && (
                  <div className="w-full bg-orange-50 border border-orange-200 rounded-xl p-4 flex flex-col gap-4 mt-2">
                      {(inspectionsList || []).length > 0 && (
                          <div className="flex flex-col md:flex-row items-center gap-4">
                              <div className="flex items-center gap-2 text-orange-800 font-black whitespace-nowrap">
                                  <Copy size={20} />
                                  <span>استنساخ إعدادات وحدة سابقة:</span>
                              </div>
                              <select 
                                  className="flex-1 w-full bg-white border border-orange-200 text-[#1a365d] text-sm font-bold outline-none px-4 py-2.5 rounded-lg focus:border-orange-500"
                                  onChange={(e) => { handleCopySetup(e.target.value); e.target.value = ""; }}
                                  defaultValue=""
                              >
                                  <option value="" disabled>-- اختر وحدة لنسخ إعداداتها --</option>
                                  {(inspectionsList || []).map(t => <option key={t.unit} value={t.unit}>الوحدة: {t.unit}</option>)}
                              </select>
                          </div>
                      )}
                      <div className={`flex flex-wrap items-center gap-3 pt-3 ${(inspectionsList || []).length > 0 ? 'border-t border-orange-200/50' : ''}`}>
                          <span className="text-sm font-black text-orange-800 ml-2">إجراءات سريعة:</span>
                          <button onClick={() => handleToggleAll(true)} className="bg-emerald-500 text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-emerald-600 transition shadow-sm flex items-center gap-2"><CheckCircle2 size={16} /> تحديد الكل</button>
                          <button onClick={() => handleToggleAll(false)} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold text-sm hover:bg-slate-300 transition shadow-sm flex items-center gap-2"><X size={16} /> إلغاء تحديد الكل</button>
                      </div>
                  </div>
              )}
            </div>

            {viewMode === 'inspect' && (
                <div className="bg-white p-8 rounded-[2rem] mb-8 shadow-sm border border-slate-100 relative overflow-hidden">
                <div className="relative z-10 flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2"><div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600"><CheckCircle2 size={20}/></div><span className="text-lg font-black text-[#1a365d]">نسبة الإنجاز والمطابقة</span></div>
                    <span className="text-3xl text-indigo-600 font-black">{calculateProgress()}%</span>
                </div>
                <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden relative z-10">
                    <div className="bg-gradient-to-l from-indigo-500 to-emerald-400 h-full transition-all duration-1000 ease-out" style={{ width: `${calculateProgress()}%` }}></div>
                </div>
                </div>
            )}

            <div className="space-y-8">
              {dynamicDictionary.map((spaceData, index) => {
                // فلترة الأقسام بناءً على وضع الشاشة
                const categoriesForEngineer = (spaceData.categories || []).map(cat => ({
                    ...cat, items: (cat.items || []).filter(i => i.target === 'both' || i.target === 'engineer')
                })).filter(cat => cat.items.length > 0);

                if (categoriesForEngineer.length === 0) return null;

                // في شاشة الفحص أو شاشة العميل، نخفي الفراغات اللي مافيها بنود
                const hasActiveItems = categoriesForEngineer.some(cat => cat.items.some(item => inspectionData[`${spaceData.space}_${cat.name}_${item.name}`]?.isSelected));
                if ((viewMode === 'inspect' || viewMode === 'client_setup') && !hasActiveItems) return null;

                // في شاشة العميل (تجهيز)، إذا الغرفة مافيها ولا بند فحصه المهندس، نخفيها
                if (viewMode === 'client_setup') {
                    const hasEvaluatedItems = categoriesForEngineer.some(cat => cat.items.some(item => {
                        const d = inspectionData[`${spaceData.space}_${cat.name}_${item.name}`];
                        return d?.isSelected && d?.passed !== null;
                    }));
                    if (!hasEvaluatedItems) return null;
                }

                return (
                  <div key={index} className={`bg-white rounded-[2.5rem] shadow-sm border overflow-hidden ${viewMode === 'setup' ? 'border-orange-100' : viewMode === 'client_setup' ? 'border-emerald-100' : 'border-slate-100'}`}>
                    <div className={`${viewMode === 'setup' ? 'bg-[#c5a059]' : viewMode === 'client_setup' ? 'bg-emerald-600' : 'bg-[#1a365d]'} p-6 text-white flex justify-between items-center`}>
                        <h2 className="text-2xl font-black">{spaceData.space}</h2>
                        {viewMode === 'client_setup' && <span className="text-sm font-bold bg-white/20 px-4 py-1 rounded-lg">إعدادات ظهور بنود الغرفة</span>}
                    </div>
                    <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
                        {categoriesForEngineer.map((cat, catIdx) => {
                            const hasActiveCatItems = cat.items.some(item => inspectionData[`${spaceData.space}_${cat.name}_${item.name}`]?.isSelected);
                            if ((viewMode === 'inspect' || viewMode === 'client_setup') && !hasActiveCatItems) return null;

                            // في شاشة العميل (تجهيز)، إذا القسم مافيه بند انحص، نخفيه
                            if (viewMode === 'client_setup') {
                                const hasEvaluatedCatItems = cat.items.some(item => {
                                    const d = inspectionData[`${spaceData.space}_${cat.name}_${item.name}`];
                                    return d?.isSelected && d?.passed !== null;
                                });
                                if (!hasEvaluatedCatItems) return null;
                            }

                            return (
                                <div key={catIdx} className="bg-slate-50/50 rounded-2xl p-5 border border-slate-100">
                                    <h3 className="font-black text-[#1a365d] mb-4 border-b border-slate-200 pb-3">{cat.name}</h3>
                                    <div className="space-y-4">
                                        {cat.items.map((item, itemIdx) => {
                                            const key = `${spaceData.space}_${cat.name}_${item.name}`;
                                            const itemData = inspectionData[key] || { isSelected: false, passed: null, notes: '', clientVisible: true };
                                            
                                            if (viewMode === 'setup') {
                                                return (
                                                    <label key={itemIdx} className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer border transition-all ${itemData.isSelected ? 'bg-orange-50 border-orange-200 shadow-sm' : 'bg-white border-slate-200 opacity-60 hover:bg-slate-50'}`}>
                                                        <input type="checkbox" checked={itemData.isSelected} onChange={() => toggleItemSelection(spaceData.space, cat.name, item.name)} className="mt-0.5 w-5 h-5 accent-orange-500 cursor-pointer" />
                                                        <span className={`text-sm font-bold ${itemData.isSelected ? 'text-orange-900' : 'text-slate-500'}`}>{item.name}</span>
                                                    </label>
                                                );
                                            }

                                            if (!itemData.isSelected) return null;

                                            // شاشة (تجهيز العميل): تظهر فقط البنود اللي المهندس قيمها!
                                            if (viewMode === 'client_setup') {
                                                if (itemData.passed === null) return null; // المهندس ما قيمها، لا تظهر للأدمن
                                                
                                                const isVisible = itemData.clientVisible !== false;
                                                return (
                                                    <label key={itemIdx} className={`flex items-start gap-3 p-4 rounded-xl cursor-pointer border transition-all ${isVisible ? 'bg-emerald-50 border-emerald-200 shadow-sm' : 'bg-white border-slate-200 opacity-60 hover:bg-slate-50'}`}>
                                                        <input type="checkbox" checked={isVisible} onChange={() => toggleClientVisibility(spaceData.space, cat.name, item.name)} className="mt-0.5 w-5 h-5 accent-emerald-500 cursor-pointer" />
                                                        <div>
                                                            <span className={`text-sm font-bold block ${isVisible ? 'text-emerald-900' : 'text-slate-500'}`}>{item.name}</span>
                                                            <span className={`text-[10px] font-black mt-1 px-2 py-0.5 rounded inline-block ${itemData.passed ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                                {itemData.passed ? 'تقييم المهندس: مطابق' : 'تقييم المهندس: ملاحظة'}
                                                            </span>
                                                        </div>
                                                    </label>
                                                );
                                            }

                                            // شاشة فحص المهندس
                                            const isPassed = itemData.passed === true; const isFailed = itemData.passed === false;
                                            return (
                                                <div key={itemIdx} className={`flex flex-col p-4 rounded-xl border transition-all duration-300 ${isPassed ? 'bg-emerald-50/50 border-emerald-100' : isFailed ? 'bg-white border-red-200 shadow-sm' : 'bg-white border-slate-200'}`}>
                                                    <span className={`font-bold text-sm mb-3 ${isPassed ? 'text-emerald-800' : isFailed ? 'text-red-700' : 'text-slate-700'}`}>{item.name}</span>
                                                    <div className="flex gap-2">
                                                        <button onClick={() => handleStatusChange(spaceData.space, cat.name, item.name, 'pass')} className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${isPassed ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-emerald-100'}`}><CheckCircle2 size={14} /> مطابق</button>
                                                        <button onClick={() => handleStatusChange(spaceData.space, cat.name, item.name, 'fail')} className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${isFailed ? 'bg-red-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-red-100'}`}><FileWarning size={14} /> ملاحظة</button>
                                                    </div>
                                                    {isFailed && (<textarea placeholder="اكتب ملاحظة..." value={itemData.notes || ''} onChange={(e) => handleNoteChange(spaceData.space, cat.name, item.name, e.target.value)} className="w-full mt-3 bg-red-50/50 border border-red-100 rounded-lg p-3 text-xs font-medium outline-none focus:border-red-400 focus:bg-white resize-none h-20" />)}
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
          </div>
        </div>
      );
  }

  return (
    <div className="pt-24 pb-20 bg-slate-50 min-h-screen animate-fadeIn relative">
      
      {/* النافذة الخاصة بالرابط */}
      {showLinkModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
              <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 max-w-md w-full relative text-center">
                  <button onClick={() => setShowLinkModal(false)} className="absolute top-4 left-4 text-slate-400 hover:text-red-500 bg-slate-100 p-2 rounded-full transition"><X size={20} /></button>
                  <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4"><LinkIcon size={32} /></div>
                  
                  <h3 className="text-2xl font-black text-[#1a365d] mb-2">رابط تسليم العميل</h3>
                  <p className="text-sm font-bold text-slate-500 mb-6">وحدة رقم: {linkUnit}</p>
                  
                  <div className="flex items-center gap-2 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 overflow-hidden">
                      <input 
                          type="text" 
                          readOnly 
                          value={`https://semak.sa/handover?unit=${encodeURIComponent(String(linkUnit).trim())}`} 
                          className="flex-1 bg-transparent text-sm font-bold text-slate-600 outline-none text-left w-full" 
                          dir="ltr"
                      />
                  </div>
                  
                  <button onClick={copyClientLink} className="w-full bg-[#1a365d] text-white py-4 rounded-xl font-black text-lg hover:bg-blue-900 transition flex justify-center items-center gap-2 shadow-lg">
                      <Copy size={20} /> نسخ الرابط وإرساله
                  </button>
              </div>
          </div>
      )}

      {showSnagModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-[2rem] shadow-2xl p-8 max-w-2xl w-full relative max-h-[90vh] overflow-y-auto">
                  <button onClick={() => setShowSnagModal(false)} className="absolute top-6 left-6 text-slate-400 hover:text-red-500"><X size={20} /></button>
                  <h3 className="text-2xl font-black text-[#1a365d] mb-6">تقرير الملاحظات (Snag List)</h3>
                  <div className="space-y-4">
                      {currentSnags.map((snag, i) => (
                          <div key={i} className="bg-slate-50 p-4 rounded-xl border border-slate-200"><div className="font-black text-sm mb-2">{snag.space} | {snag.item}</div><p className="text-red-600 bg-red-50 p-2 text-sm rounded">"{snag.note}"</p></div>
                      ))}
                  </div>
              </div>
          </div>
      )}

      <div className="container mx-auto px-6 max-w-6xl">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
              <button onClick={() => navigateTo('dashboard')} className="p-3 bg-slate-50 rounded-full border hidden md:block"><ChevronRight size={24} className="text-slate-600" /></button>
              <div><h1 className="text-2xl font-black text-[#1a365d]">فحص وتسليم الوحدات</h1><p className="text-slate-400 text-sm font-bold mt-1">إدارة فحوصات المهندسين والعملاء</p></div>
          </div>
          <button onClick={() => setViewMode('settings')} className="bg-orange-50 text-orange-600 px-6 py-3 rounded-xl font-black flex gap-2 border border-orange-200 w-full md:w-auto justify-center"><Settings2 size={20} /> إدارة البنود المركزية</button>
        </div>

        {loading ? (
          <div className="text-center py-20"><RefreshCw className="animate-spin mx-auto text-indigo-500 mb-4" size={40} /><p className="text-slate-500 font-bold">جاري التحميل...</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-blue-600 text-white p-6 rounded-[2rem] shadow-lg flex flex-col justify-center items-center text-center cursor-pointer hover:bg-blue-700 transition transform hover:-translate-y-1 min-h-[220px]" onClick={handleCreateNewTask}>
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4"><HardHat size={32} /></div>
                <h3 className="text-xl font-black mb-1">تكليف فحص مهندس</h3>
                <p className="text-sm font-medium text-blue-200">إنشاء مهمة للمهندس لفحص وحدة جديدة</p>
            </div>

            {(inspectionsList || []).map((task, idx) => {
              const prog = parseInt(task.progress || 0);
              const hasSnags = prog > 0 && prog < 100;
              const isDone = prog === 100;
              return (
                <div key={idx} className={`bg-white p-6 rounded-[2rem] shadow-sm border-2 relative flex flex-col min-h-[220px] ${hasSnags ? 'border-red-200' : isDone ? 'border-emerald-200' : 'border-slate-100'}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className={`px-3 py-1 rounded-md text-[11px] font-black ${hasSnags ? 'bg-red-50 text-red-600' : isDone ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                        {hasSnags ? 'يوجد ملاحظات (Snag)' : isDone ? 'مكتمل ومُسلّم' : 'قيد الفحص'}
                    </div>
                    <span className="text-2xl font-black text-[#1a365d]">{prog}%</span>
                  </div>
                  <h3 className="text-xl font-black text-[#1a365d] mb-1">وحدة: {task.unit}</h3>
                  <div className="w-full bg-slate-100 h-2 rounded-full mb-6 mt-auto overflow-hidden">
                    <div className={`h-full ${hasSnags ? 'bg-red-400' : isDone ? 'bg-emerald-400' : 'bg-blue-400'}`} style={{ width: `${prog}%` }}></div>
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                        {hasSnags ? (
                            <button onClick={() => openSnagReport(task.inspection_data)} className="flex-1 bg-red-50 text-red-700 py-3 rounded-xl font-bold text-sm flex justify-center gap-2"><AlertTriangle size={16} /> تقرير</button>
                        ) : (
                            <button onClick={() => handleOpenTask(task.unit, task.inspection_data, 'inspect')} className="flex-1 bg-indigo-50 text-indigo-700 py-3 rounded-xl font-bold text-sm flex justify-center gap-2 hover:bg-indigo-600 hover:text-white transition"><Hammer size={16} /> الفحص الهندسي</button>
                        )}
                        {isAdmin && <button onClick={() => handleOpenTask(task.unit, task.inspection_data, 'setup')} className="bg-slate-50 text-slate-500 p-3 rounded-xl hover:bg-slate-200 transition" title="تعديل خطة الفحص"><Settings2 size={16} /></button>}
                        {isAdmin && <button onClick={() => handleDeleteTask(task.unit)} className="bg-red-50 text-red-400 p-3 rounded-xl hover:bg-red-500 hover:text-white transition" title="حذف المهمة"><Trash2 size={16} /></button>}
                    </div>

                    {/* زر تجهيز العميل (يظهر فقط إذا كان הפحص مكتمل 100%) */}
                    {isDone && isAdmin && (
                        <button onClick={() => handleOpenTask(task.unit, task.inspection_data, 'client_setup')} className="w-full mt-2 bg-emerald-50 text-emerald-700 py-3 rounded-xl font-bold text-sm flex justify-center items-center gap-2 hover:bg-emerald-600 hover:text-white transition shadow-sm">
                            <Eye size={16} /> تجهيز للعميل وإصدار الرابط
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