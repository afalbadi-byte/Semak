import React, { useState, useEffect } from 'react';
import { ChevronRight, ClipboardCheck, CheckCircle2, Save, Printer, RefreshCw, FileWarning, Settings2, ShieldCheck, PlusCircle, ListTodo, Building, Trash2, X, Plus, AlertTriangle } from 'lucide-react';
import QRCode from 'react-qr-code';

const API_URL = "https://semak.sa/api.php";

export default function UnitInspection({ user, navigateTo, showToast }) {
  const [viewMode, setViewMode] = useState('list'); 
  const [inspectionsList, setInspectionsList] = useState([]);
  const [dbProjects, setDbProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // القالب الديناميكي للبنود
  const [globalTemplate, setGlobalTemplate] = useState([]);
  const [newCatName, setNewCatName] = useState("");
  const [newItemNames, setNewItemNames] = useState({});

  // للـ QR والتقارير
  const [showQRModal, setShowQRModal] = useState(false);
  const [qrUnit, setQrUnit] = useState("");
  const [showSnagModal, setShowSnagModal] = useState(false);
  const [currentSnags, setCurrentSnags] = useState([]);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    if (viewMode === 'list') {
      fetchData();
    }
  }, [viewMode]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [projRes, tasksRes, templateRes] = await Promise.all([
        fetch(`${API_URL}?action=get_projects_data`),
        fetch(`${API_URL}?action=get_all_inspections`),
        fetch(`${API_URL}?action=get_inspection_template`)
      ]);
      const projData = await projRes.json();
      const tasksData = await tasksRes.json();
      const templateData = await templateRes.json();
      
      if (projData.success) setDbProjects(projData.data);
      if (tasksData.success) setInspectionsList(tasksData.data);
      if (templateData.success) setGlobalTemplate(templateData.data);
    } catch (e) {
      if(showToast) showToast("خطأ", "فشل الاتصال", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async () => {
    setSaving(true);
    try {
      await fetch(`${API_URL}?action=save_inspection_template`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ template: globalTemplate })
      });
      if(showToast) showToast("تم الحفظ", "تم تحديث بنود الفحص بنجاح");
      setViewMode('list');
    } catch (e) {
      if(showToast) showToast("خطأ", "فشل الحفظ", "error");
    } finally {
      setSaving(false);
    }
  };

  const addCategory = () => {
    if(!newCatName.trim()) return;
    setGlobalTemplate([...globalTemplate, { name: newCatName, color: 'text-indigo-500', items: [] }]);
    setNewCatName("");
  };

  const addItem = (catIndex) => {
    const item = newItemNames[catIndex];
    if(!item || !item.trim()) return;
    const newT = [...globalTemplate];
    newT[catIndex].items.push(item);
    setGlobalTemplate(newT);
    setNewItemNames({...newItemNames, [catIndex]: ""});
  };

  const removeItem = (catIndex, itemIndex) => {
    const newT = [...globalTemplate];
    newT[catIndex].items.splice(itemIndex, 1);
    setGlobalTemplate(newT);
  };

  const handleDeleteTask = async (unitCode) => {
    if(!window.confirm(`تأكيد حذف تقرير الوحدة ${unitCode}؟`)) return;
    await fetch(`${API_URL}?action=delete_inspection`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unit: unitCode }) });
    fetchData();
  };

  const openSnagReport = (inspectionDataStr) => {
      try {
          const data = JSON.parse(inspectionDataStr);
          const snags = [];
          Object.keys(data).forEach(key => {
              if(data[key].passed === false) { // جلب الملاحظات فقط
                  const [space, cat, item] = key.split('_');
                  snags.push({ space, cat, item, note: data[key].notes });
              }
          });
          setCurrentSnags(snags);
          setShowSnagModal(true);
      } catch (e) {}
  };

  if (viewMode === 'settings') {
      return (
          <div className="pt-24 pb-20 bg-slate-50 min-h-screen animate-fadeIn">
              <div className="container mx-auto px-6 max-w-4xl">
                  <div className="bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100 mb-6 flex justify-between items-center">
                      <div>
                          <h1 className="text-2xl font-black text-[#1a365d] flex items-center gap-3"><Settings2 className="text-orange-500"/> إدارة بنود الفحص (لجميع المشاريع)</h1>
                          <p className="text-sm text-slate-500 mt-2 font-bold">هذه البنود هي التي ستظهر للعميل في جواله أثناء فحصه لوحدته.</p>
                      </div>
                      <button onClick={handleSaveTemplate} disabled={saving} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition">
                          {saving ? <RefreshCw className="animate-spin" size={18}/> : <Save size={18}/>} حفظ واعتماد
                      </button>
                  </div>

                  <div className="space-y-6">
                      {globalTemplate.map((cat, catIdx) => (
                          <div key={catIdx} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                              <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
                                  <h3 className={`text-lg font-black ${cat.color}`}>{cat.name}</h3>
                                  <button onClick={() => {const n=[...globalTemplate]; n.splice(catIdx,1); setGlobalTemplate(n);}} className="text-red-400 hover:text-red-600"><Trash2 size={18}/></button>
                              </div>
                              <div className="flex flex-wrap gap-2 mb-4">
                                  {cat.items.map((item, iIdx) => (
                                      <span key={iIdx} className="bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg text-sm font-bold flex items-center gap-2 text-slate-700">
                                          {item} <button onClick={()=>removeItem(catIdx, iIdx)} className="text-slate-400 hover:text-red-500"><X size={14}/></button>
                                      </span>
                                  ))}
                              </div>
                              <div className="flex gap-2">
                                  <input type="text" value={newItemNames[catIdx]||""} onChange={e=>setNewItemNames({...newItemNames, [catIdx]: e.target.value})} placeholder="بند جديد (مثال: فحص العزل)" className="flex-1 bg-slate-50 border border-slate-200 px-4 py-2 rounded-lg text-sm font-bold outline-none focus:border-indigo-400" />
                                  <button onClick={()=>addItem(catIdx)} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold hover:bg-slate-300 transition text-sm">إضافة بند</button>
                              </div>
                          </div>
                      ))}

                      <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 flex gap-3">
                          <input type="text" value={newCatName} onChange={e=>setNewCatName(e.target.value)} placeholder="اسم قسم جديد (مثال: التكييف المركزي)" className="flex-1 bg-white border border-indigo-200 px-4 py-3 rounded-xl text-sm font-bold outline-none focus:border-indigo-500" />
                          <button onClick={addCategory} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-700 transition flex items-center gap-2"><Plus size={18}/> قسم جديد</button>
                      </div>
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="pt-24 pb-20 bg-slate-50 min-h-screen animate-fadeIn relative">
      
      {/* نافذة تقرير الـ Snag List */}
      {showSnagModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
              <div className="bg-white rounded-[2rem] shadow-2xl p-8 max-w-2xl w-full relative max-h-[90vh] overflow-y-auto">
                  <button onClick={() => setShowSnagModal(false)} className="absolute top-6 left-6 text-slate-400 hover:text-red-500"><X size={24} /></button>
                  <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-6">
                      <div className="w-12 h-12 bg-red-100 text-red-500 rounded-xl flex items-center justify-center"><AlertTriangle size={24} /></div>
                      <div><h3 className="text-2xl font-black text-[#1a365d]">تقرير الملاحظات (Snag List)</h3><p className="text-slate-500 font-bold text-sm">ملاحظات رفضها العميل أثناء الفحص وتحتاج صيانة</p></div>
                  </div>
                  {currentSnags.length === 0 ? (
                      <div className="text-center p-10 bg-emerald-50 text-emerald-600 rounded-2xl font-bold">لا توجد ملاحظات! الوحدة سليمة 100%</div>
                  ) : (
                      <div className="space-y-4">
                          {currentSnags.map((snag, i) => (
                              <div key={i} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                                  <div className="flex justify-between items-center mb-2">
                                      <span className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-md text-xs font-black">{snag.space}</span>
                                      <span className="text-xs font-bold text-slate-500">{snag.cat} - {snag.item}</span>
                                  </div>
                                  <p className="text-sm font-bold text-red-600 bg-red-50 p-3 rounded-lg border border-red-100 mt-2">"{snag.note || 'لم يكتب العميل تفاصيل'}"</p>
                              </div>
                          ))}
                      </div>
                  )}
                  <div className="mt-6 text-center"><button onClick={() => window.print()} className="bg-[#1a365d] text-white px-8 py-3 rounded-xl font-bold flex items-center justify-center gap-2 mx-auto"><Printer size={18}/> طباعة التقرير للمقاول</button></div>
              </div>
          </div>
      )}

      {/* نافذة الباركود للعميل */}
      {showQRModal && (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
              <div className="bg-white rounded-[2rem] shadow-2xl p-8 max-w-sm w-full relative text-center">
                  <button onClick={() => setShowQRModal(false)} className="absolute top-4 left-4 text-slate-400 hover:text-red-500 bg-slate-100 p-2 rounded-full transition"><X size={20} /></button>
                  <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4"><ShieldCheck size={32} /></div>
                  <h3 className="text-2xl font-black text-[#1a365d] mb-1">تسليم وفحص الوحدة</h3>
                  <p className="text-sm text-slate-500 font-bold mb-6">دع المالك يمسح الرمز للبدء بالفحص والاستلام</p>
                  <div className="bg-slate-50 p-4 rounded-3xl border-2 border-slate-100 inline-block mb-6 shadow-inner">
                      <QRCode value={`https://semak.sa/handover?unit=${encodeURIComponent(qrUnit.trim())}`} size={200} bgColor="#f8fafc" fgColor="#1a365d" level="H" />
                  </div>
              </div>
          </div>
      )}

      <div className="container mx-auto px-6 max-w-6xl">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-6 bg-white p-8 rounded-[2.5rem] shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-[#1a365d] flex items-center gap-3"><ListTodo className="text-indigo-600" size={32} /> فحص وتسليم الوحدات</h1>
            <p className="text-slate-400 text-sm font-bold mt-1">توليد روابط فحص للعملاء، متابعة الملاحظات، والاعتماد</p>
          </div>
          {isAdmin && (
            <button onClick={() => setViewMode('settings')} className="bg-orange-50 text-orange-600 px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-orange-100 transition border border-orange-200">
              <Settings2 size={20} /> إدارة بنود الفحص بالداتا بيس
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-20"><RefreshCw className="animate-spin mx-auto text-indigo-500 mb-4" size={40} /><p className="text-slate-500 font-bold">جاري تحميل البيانات...</p></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* كروت توليد الفحص السريع للمشاريع */}
            <div className="bg-indigo-600 text-white p-6 rounded-[2rem] shadow-lg flex flex-col justify-center items-center text-center cursor-pointer hover:bg-indigo-700 transition transform hover:-translate-y-1" onClick={() => {
                const u = window.prompt("أدخل رقم الوحدة المراد تجهيزها للفحص:");
                if(u) { setQrUnit(u); setShowQRModal(true); }
            }}>
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mb-4"><PlusCircle size={32} /></div>
                <h3 className="text-xl font-black mb-1">إنشاء فحص لعميل</h3>
                <p className="text-sm font-medium text-indigo-200">إصدار باركود جديد لغرض الفحص والاستلام</p>
            </div>

            {inspectionsList.map((task, idx) => {
              const prog = parseInt(task.progress);
              const hasSnags = prog > 0 && prog < 100;
              const isDone = prog === 100;
              
              return (
                <div key={idx} className={`bg-white p-6 rounded-[2rem] shadow-sm border-2 hover:shadow-lg transition-shadow relative overflow-hidden ${hasSnags ? 'border-red-200' : isDone ? 'border-emerald-200' : 'border-slate-100'}`}>
                  <div className="flex justify-between items-start mb-4">
                    <div className={`px-3 py-1 rounded-full text-xs font-black ${hasSnags ? 'bg-red-50 text-red-600' : isDone ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                        {hasSnags ? 'يوجد ملاحظات (Snag)' : isDone ? 'مكتمل ومُسلّم' : 'قيد الفحص'}
                    </div>
                    <span className="text-2xl font-black text-[#1a365d]">{prog}%</span>
                  </div>
                  
                  <h3 className="text-xl font-black text-[#1a365d] mb-4 pr-2">وحدة: {task.unit}</h3>
                  <div className="w-full bg-slate-100 h-2 rounded-full mb-6 overflow-hidden">
                    <div className={`h-full ${hasSnags ? 'bg-red-400' : isDone ? 'bg-emerald-400' : 'bg-blue-400'}`} style={{ width: `${prog}%` }}></div>
                  </div>

                  <div className="flex gap-2">
                    {hasSnags ? (
                        <button onClick={() => openSnagReport(task.inspection_data)} className="flex-1 bg-red-50 text-red-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-red-600 hover:text-white transition">
                            <AlertTriangle size={16} /> تقرير الـ Snag List
                        </button>
                    ) : isDone ? (
                        <div className="flex-1 bg-emerald-50 text-emerald-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2">
                            <CheckCircle2 size={16} /> تم استلام المالك
                        </div>
                    ) : (
                        <button onClick={() => {setQrUnit(task.unit); setShowQRModal(true);}} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-200 transition">
                            <ShieldCheck size={16} /> إظهار الباركود للعميل
                        </button>
                    )}
                    {isAdmin && (
                      <button onClick={() => handleDeleteTask(task.unit)} className="bg-red-50 text-red-500 p-3 rounded-xl hover:bg-red-500 hover:text-white transition" title="حذف السجل"><Trash2 size={16} /></button>
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