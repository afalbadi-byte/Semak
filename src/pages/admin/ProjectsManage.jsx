import React, { useState, useEffect } from 'react';
import { Building, Plus, Trash2, LayoutGrid, ChevronRight, RefreshCw, Edit, User, Phone, Copy, Check, QrCode as QrIcon, X, Printer } from 'lucide-react';
import QRCode from 'react-qr-code'; 

const API_URL = "https://semak.sa/api.php";

export default function ProjectsManage({ showToast }) {
    const [projectsList, setProjectsList] = useState([]);
    const [loading, setLoading] = useState(true);
    
    const [activeProject, setActiveProject] = useState(null);
    const [isEditingProjInfo, setIsEditingProjInfo] = useState(false);
    const [projInfoEdit, setProjInfoEdit] = useState({});
    const [newProjectName, setNewProjectName] = useState("");
    const [newProjectDesc, setNewProjectDesc] = useState("");
    const [newUnitCode, setNewUnitCode] = useState("");
    const [spaceInputs, setSpaceInputs] = useState({});
    const [localLoading, setLocalLoading] = useState(false);
    
    const [copiedId, setCopiedId] = useState(null);
    const [qrModalData, setQrModalData] = useState(null);

    const loadProjects = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}?action=get_projects_data`);
            const data = await res.json();
            if (data.success) {
                setProjectsList(data.data || []);
                if (activeProject) {
                    const updated = data.data.find(p => p.id === activeProject.id);
                    if (updated) setActiveProject(updated);
                }
            }
        } catch (e) { console.error(e); } 
        finally { setLoading(false); }
    };

    useEffect(() => { loadProjects(); }, []);

    const handleCopyText = (text, id) => {
        navigator.clipboard.writeText(text);
        setCopiedId(id);
        if(showToast) showToast("تم النسخ", "تم نسخ البيانات للحافظة بنجاح ✅");
        setTimeout(() => setCopiedId(null), 2000);
    };

    const copyProjectData = (e, p) => {
        e.stopPropagation();
        const text = `🏢 مشروع: ${p.name}\n📝 الوصف: ${p.description || 'لا يوجد'}\n📊 الحالة: ${p.status || 'نشط'}\n🔢 عدد الوحدات: ${p.units_details?.length || 0} وحدة`;
        handleCopyText(text, `proj_${p.id}`);
    };

    const copyUnitData = (u, projName) => {
        let text = `🏠 وحدة رقم: ${u.unit_code}\n🏢 المشروع: ${projName}`;
        if (u.owner_name) {
            text += `\n👤 المالك: ${u.owner_name}\n📱 الجوال: ${u.owner_phone}`;
        } else {
            text += `\n📊 الحالة: متاحة`;
        }
        if (u.spaces && u.spaces.length > 0) {
            text += `\n🚪 الفراغات:\n- ${u.spaces.join('\n- ')}`;
        }
        handleCopyText(text, `unit_${u.id}`);
    };

    const handleDuplicateProject = async (e, projectId) => {
        e.stopPropagation();
        if (!window.confirm("هل تريد استنساخ هذا المشروع بالكامل بجميع وحداته وفراغاته؟")) return;
        setLocalLoading(true);
        try {
            const res = await fetch(`${API_URL}?action=duplicate_project`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_id: projectId }) });
            const data = await res.json();
            if (data.success) {
                if(showToast) showToast("تم الاستنساخ", "تم إنشاء نسخة مطابقة من المشروع ✅");
                loadProjects();
            }
        } catch (e) { } finally { setLocalLoading(false); }
    };

    const handleDuplicateUnit = async (unit) => {
        const newCode = window.prompt("أدخل رمز/رقم الوحدة الجديدة:", `${unit.unit_code}-copy`);
        if (!newCode || newCode.trim() === "") return;
        setLocalLoading(true);
        try {
            const res = await fetch(`${API_URL}?action=duplicate_unit`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unit_id: unit.id, new_unit_code: newCode.trim() }) });
            const data = await res.json();
            if (data.success) {
                if(showToast) showToast("تم الاستنساخ", `تم استنساخ الوحدة برقم ${newCode} ✅`);
                loadProjects();
            } else {
                if(showToast) showToast("خطأ", data.message, "error");
            }
        } catch (e) { } finally { setLocalLoading(false); }
    };

    const handleAddProject = async (e) => { e.preventDefault(); if (!newProjectName.trim()) return; setLocalLoading(true); try { const res = await fetch(`${API_URL}?action=add_project`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newProjectName, description: newProjectDesc }) }); const data = await res.json(); if (data.success) { setNewProjectName(""); setNewProjectDesc(""); if(showToast) showToast("تم", "تم تأسيس المشروع بنجاح"); loadProjects(); } } catch (e) {} finally { setLocalLoading(false); } };
    const handleUpdateProjectInfo = async (e) => { e.preventDefault(); setLocalLoading(true); try { const res = await fetch(`${API_URL}?action=update_project_info`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(projInfoEdit) }); const data = await res.json(); if (data.success) { setIsEditingProjInfo(false); if(showToast) showToast("تم", "تم تحديث بيانات المشروع"); loadProjects(); } } catch (e) {} finally { setLocalLoading(false); } };
    const handleAddUnitCard = async (e) => { e.preventDefault(); if (!newUnitCode.trim()) return; const codeToAdd = newUnitCode.trim(); setNewUnitCode(""); setLocalLoading(true); try { const res = await fetch(`${API_URL}?action=add_unit_card`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ project_id: activeProject.id, unit_code: codeToAdd }) }); const data = await res.json(); if (data.success) { const newUnit = { id: data.unit_id, unit_code: codeToAdd, spaces: [], status: 'متاح' }; setActiveProject(prev => ({ ...prev, units_details: [...(prev.units_details || []), newUnit] })); loadProjects(); } else { if(showToast) showToast("تنبيه", data.message, "error"); } } catch (e) {} finally { setLocalLoading(false); } };
    const updateUnitSpaces = async (unitId, newSpacesArray) => { setActiveProject(prev => ({ ...prev, units_details: prev.units_details.map(u => u.id === unitId ? { ...u, spaces: newSpacesArray } : u) })); try { await fetch(`${API_URL}?action=update_unit_spaces`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unit_id: unitId, spaces: newSpacesArray }) }); loadProjects(); } catch (e) {} };
    const handleAddSpaceToUnit = (unit) => { const spaceName = spaceInputs[unit.id]; if (!spaceName || !spaceName.trim()) return; const updatedSpaces = [...(unit.spaces || []), spaceName.trim()]; setSpaceInputs({ ...spaceInputs, [unit.id]: "" }); updateUnitSpaces(unit.id, updatedSpaces); };
    const handleRemoveSpaceFromUnit = (unit, spaceIndex) => { const updatedSpaces = unit.spaces.filter((_, i) => i !== spaceIndex); updateUnitSpaces(unit.id, updatedSpaces); };
    const handleDeleteUnit = async (unitId) => { if (!window.confirm("هل أنت متأكد من حذف هذه الوحدة؟")) return; setActiveProject(prev => ({ ...prev, units_details: prev.units_details.filter(u => u.id !== unitId) })); try { await fetch(`${API_URL}?action=delete_unit_card`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ unit_id: unitId }) }); loadProjects(); } catch (e) {} };

    const handlePrintQR = () => {
        const printContent = document.getElementById('qr-print-area').innerHTML;
        const originalContent = document.body.innerHTML;
        document.body.innerHTML = `<div style="display:flex; flex-direction:column; align-items:center; justify-content:center; height:100vh; text-align:center; font-family:sans-serif;">${printContent}</div>`;
        window.print();
        document.body.innerHTML = originalContent;
        window.location.reload(); 
    };

    return (
        <div className="bg-slate-50 min-h-[600px] rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden mb-12 animate-fadeIn relative">
            
            {qrModalData && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full relative text-center border border-slate-100">
                        <button onClick={() => setQrModalData(null)} className="absolute top-4 left-4 text-slate-400 hover:text-red-500 bg-slate-100 p-2 rounded-full transition">
                            <X size={20} />
                        </button>
                        
                        <div id="qr-print-area" className="flex flex-col items-center">
                            <h3 className="text-xl font-black text-[#1a365d] mb-2">رمز طلب الصيانة</h3>
                            <p className="text-sm text-[#c5a059] mb-6 font-black bg-slate-50 px-4 py-1.5 rounded-lg inline-block border border-slate-100">
                                وحدة: {qrModalData.unit_code}
                            </p>

                            <div className="bg-white p-4 rounded-3xl shadow-sm border-2 border-slate-100 inline-block mb-6">
                                <QRCode
                                    // 🔥 التعديل هنا: غيرنا الرابط ليكون /maintenance عشان يطابق صفحة الملاك
                                    value={`https://semak.sa/maintenance?unit=${encodeURIComponent(qrModalData.unit_code.trim())}`}
                                    size={200}
                                    bgColor="#FFFFFF"
                                    fgColor="#1a365d"
                                    level="H"
                                />
                            </div>
                            <p className="text-xs text-slate-400 mb-6 font-bold px-4">امسح الرمز لتقديم طلب صيانة لهذه الوحدة مباشرة عبر النظام</p>
                        </div>

                        <button onClick={handlePrintQR} className="w-full bg-[#1a365d] text-white py-4 rounded-xl font-black hover:bg-blue-800 transition flex items-center justify-center gap-2 shadow-lg">
                            <Printer size={20} /> طباعة الرمز
                        </button>
                    </div>
                </div>
            )}

            {!activeProject && (
                <div className="p-8">
                    <div className="flex flex-col mb-8 gap-4 border-b border-slate-200 pb-6">
                        <h3 className="text-2xl md:text-3xl font-black text-[#1a365d] flex items-center gap-3 mb-4"><Building className="text-rose-600" size={32}/> إدارة المشاريع والوحدات</h3>
                        <form onSubmit={handleAddProject} className="flex flex-col md:flex-row gap-3 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                            <input type="text" required value={newProjectName} onChange={e => setNewProjectName(e.target.value)} placeholder="اسم المشروع الجديد..." className="px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-rose-500 font-bold text-sm flex-1" />
                            <input type="text" value={newProjectDesc} onChange={e => setNewProjectDesc(e.target.value)} placeholder="الوصف (اختياري)" className="px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-rose-500 font-bold text-sm flex-1" />
                            <button type="submit" disabled={localLoading} className="bg-[#1a365d] text-white px-8 py-3 rounded-xl font-bold hover:bg-rose-600 transition flex items-center justify-center gap-2">
                                {localLoading ? <RefreshCw size={18} className="animate-spin" /> : <Plus size={18} />} تأسيس
                            </button>
                        </form>
                    </div>

                    {loading ? (
                        <div className="text-center py-20 text-slate-400 font-bold"><RefreshCw className="animate-spin mx-auto mb-4 text-rose-500" size={40}/> جاري تحميل المشاريع...</div>
                    ) : projectsList.length === 0 ? (
                        <div className="text-center py-20 text-slate-400 font-bold bg-white rounded-2xl border border-slate-100 shadow-sm">لا توجد مشاريع مسجلة حالياً.</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {projectsList.map(p => (
                                <div key={p.id} onClick={() => setActiveProject(p)} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md hover:border-rose-300 transition-all cursor-pointer group relative">
                                    <button onClick={(e) => handleDuplicateProject(e, p.id)} className="absolute top-6 left-6 p-2 rounded-lg bg-slate-50 text-slate-400 hover:text-blue-600 hover:bg-blue-100 transition shadow-sm border border-slate-100" title="استنساخ المشروع بجميع وحداته"><Copy size={16} /></button>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-12 h-12 bg-rose-50 rounded-xl flex items-center justify-center text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition"><Building size={24} /></div>
                                        <span className="bg-slate-100 text-[#1a365d] px-3 py-1 rounded-full text-xs font-black mr-auto ml-10">{p.units_details?.length || 0} وحدة</span>
                                    </div>
                                    <h4 className="text-xl font-black text-[#1a365d] mb-1">{p.name}</h4>
                                    <p className="text-xs text-slate-500 mb-4">{p.description || 'بدون وصف'}</p>
                                    <p className="text-xs text-slate-400 font-bold flex items-center gap-1 group-hover:text-rose-500 transition">انقر لإدارة بطاقات الوحدات والفراغات <ChevronRight size={14}/></p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activeProject && (
                <div className="animate-fadeIn bg-slate-100 min-h-full pb-10 relative">
                    <div className="bg-[#1a365d] p-6 text-white shadow-md relative z-10">
                        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4">
                            <div className="flex items-center gap-4">
                                <button onClick={() => {setActiveProject(null); setIsEditingProjInfo(false);}} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition"><ChevronRight size={24} /></button>
                                <div><h3 className="text-2xl font-black">{activeProject.name}</h3><p className="text-rose-300 text-xs mt-1 font-bold">بطاقات الوحدات وتخصيص الفراغات</p></div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button onClick={(e) => copyProjectData(e, activeProject)} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition w-full md:w-auto" title="نسخ بيانات المشروع">
                                    {copiedId === `proj_${activeProject.id}` ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />} نسخ
                                </button>
                                <button onClick={() => { setProjInfoEdit(activeProject); setIsEditingProjInfo(!isEditingProjInfo); }} className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition w-full md:w-auto">
                                    <Edit size={16}/> تعديل
                                </button>
                            </div>
                        </div>
                        {isEditingProjInfo && (
                            <form onSubmit={handleUpdateProjectInfo} className="mt-6 bg-white/10 p-5 rounded-2xl border border-white/20 animate-fadeIn">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <input required type="text" value={projInfoEdit.name} onChange={e => setProjInfoEdit({...projInfoEdit, name: e.target.value})} className="p-3 rounded-xl bg-white text-[#1a365d] font-bold outline-none" placeholder="اسم المشروع" />
                                    <input type="text" value={projInfoEdit.description} onChange={e => setProjInfoEdit({...projInfoEdit, description: e.target.value})} className="p-3 rounded-xl bg-white text-[#1a365d] outline-none" placeholder="الوصف" />
                                    <select value={projInfoEdit.status || 'نشط'} onChange={e => setProjInfoEdit({...projInfoEdit, status: e.target.value})} className="p-3 rounded-xl bg-white text-[#1a365d] font-bold outline-none">
                                        <option value="نشط">نشط</option><option value="مكتمل">مكتمل</option><option value="مغلق">مغلق</option>
                                    </select>
                                </div>
                                <button type="submit" className="bg-rose-600 text-white px-6 py-2 rounded-xl font-bold hover:bg-rose-700 transition w-full md:w-auto">حفظ التعديلات</button>
                            </form>
                        )}
                    </div>

                    <div className="p-6 md:p-8">
                        <form onSubmit={handleAddUnitCard} className="bg-white p-4 md:p-5 rounded-[1.5rem] border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-3 mb-8 items-center max-w-3xl mx-auto">
                            <span className="font-bold text-[#1a365d] whitespace-nowrap hidden md:block">إضافة بطاقة وحدة يدوياً:</span>
                            <div className="flex-1 w-full"><input type="text" required value={newUnitCode} onChange={e => setNewUnitCode(e.target.value)} placeholder="مثال: VILLA-01" className="w-full px-4 py-3 rounded-xl border border-slate-200 outline-none focus:border-rose-500 font-black text-center sm:text-right bg-slate-50 focus:bg-white transition" /></div>
                            <button type="submit" disabled={localLoading} className="w-full sm:w-auto bg-rose-600 text-white px-8 py-3 rounded-xl font-black hover:bg-rose-700 transition flex items-center justify-center gap-2 shadow-lg">
                                {localLoading ? <RefreshCw size={18} className="animate-spin" /> : <LayoutGrid size={18} />} إضافة البطاقة
                            </button>
                        </form>

                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                            {(!activeProject.units_details || activeProject.units_details.length === 0) && <div className="col-span-full text-center py-10 text-slate-400 font-bold bg-white rounded-3xl border border-slate-200">لم يتم إنشاء أي بطاقات وحدات لهذا المشروع.</div>}
                            {(activeProject.units_details || []).map(unit => (
                                <div key={unit.id} className="bg-white p-5 rounded-[1.5rem] shadow-sm border border-slate-200 flex flex-col hover:shadow-md transition group relative overflow-hidden">
                                    
                                    {unit.owner_name && <div className="absolute top-0 right-0 w-full h-1 bg-emerald-500"></div>}

                                    <div className="flex justify-between items-center mb-4 border-b border-slate-100 pb-3">
                                        <h4 className="text-lg font-black text-[#1a365d] flex items-center gap-2">
                                            <div className={`w-3 h-3 rounded-full ${unit.owner_name ? 'bg-emerald-500' : 'bg-rose-500'}`}></div> {unit.unit_code}
                                        </h4>
                                        <div className="flex items-center gap-1">
                                            <button onClick={() => setQrModalData(unit)} className="text-slate-400 hover:text-[#1a365d] hover:bg-slate-100 p-2 rounded-lg transition" title="عرض وطباعة باركود الصيانة">
                                                <QrIcon size={16} />
                                            </button>
                                            
                                            <button onClick={() => copyUnitData(unit, activeProject.name)} className="text-slate-400 hover:text-[#1a365d] hover:bg-slate-100 p-2 rounded-lg transition" title="نسخ بيانات الوحدة">
                                                {copiedId === `unit_${unit.id}` ? <Check size={16} className="text-emerald-500" /> : <Copy size={16} />}
                                            </button>
                                            <button onClick={() => handleDuplicateUnit(unit)} className="text-blue-500 bg-blue-50 hover:bg-blue-600 hover:text-white p-2 rounded-lg transition shadow-sm" title="استنساخ الوحدة بفراغاتها"><Copy size={16} /></button>
                                            <button onClick={() => handleDeleteUnit(unit.id)} className="text-slate-300 hover:text-red-500 hover:bg-red-50 p-2 rounded-lg transition" title="حذف الوحدة"><Trash2 size={16}/></button>
                                        </div>
                                    </div>

                                    {unit.owner_name && (
                                        <div className="bg-emerald-50/70 p-3 rounded-xl border border-emerald-100 mb-4 animate-fadeIn">
                                            <p className="text-xs font-bold text-emerald-900 flex items-center gap-2 mb-1"><User size={14} className="text-emerald-600"/> {unit.owner_name}</p>
                                            <p className="text-[11px] text-emerald-700 font-mono flex items-center gap-2" dir="ltr"><Phone size={14} className="text-emerald-600"/> {unit.owner_phone}</p>
                                        </div>
                                    )}

                                    <div className="flex-1 mb-6 min-h-[80px]">
                                        {(!unit.spaces || unit.spaces.length === 0) && <p className="text-xs text-slate-400 font-medium italic text-center mt-6">لا يوجد فراغات، قم بإضافتها بالأسفل.</p>}
                                        <div className="flex flex-wrap gap-2">
                                            {(unit.spaces || []).map((space, idx) => (
                                                <div key={idx} className="flex items-center gap-1 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-lg hover:border-slate-300 transition animate-fadeIn">
                                                    <span className="text-xs font-bold text-slate-700">{space}</span>
                                                    <button onClick={() => handleRemoveSpaceFromUnit(unit, idx)} className="text-slate-300 hover:text-red-500 ml-1"><Trash2 size={12}/></button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex gap-2 mt-auto bg-slate-50 p-2 rounded-xl border border-slate-100 focus-within:border-blue-300 transition-colors">
                                        <input type="text" value={spaceInputs[unit.id] || ""} onChange={e => setSpaceInputs({...spaceInputs, [unit.id]: e.target.value})} onKeyPress={e => {if(e.key === 'Enter') { e.preventDefault(); handleAddSpaceToUnit(unit); }}} placeholder="اكتب اسم الفراغ (صالة...)" className="flex-1 px-3 py-2 rounded-lg border-none bg-transparent text-xs outline-none font-bold text-slate-700 placeholder-slate-400" />
                                        <button type="button" onClick={(e) => { e.preventDefault(); handleAddSpaceToUnit(unit); }} className="bg-[#1a365d] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-800 transition shadow-sm">إضافة</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}