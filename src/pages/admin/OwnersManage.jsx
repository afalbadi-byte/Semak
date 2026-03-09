import React, { useState, useEffect } from 'react';
import { UserCheck, RefreshCw, Plus, Edit, Trash2, Save } from 'lucide-react';

const API_URL = "https://semak.sa/api.php";

export default function OwnersManage({ showToast }) {
    const [ownersList, setOwnersList] = useState([]);
    const [projectsData, setProjectsData] = useState([]); 
    const [loading, setLoading] = useState(true);
    const [localLoading, setLocalLoading] = useState(false);

    const [showAddOwner, setShowAddOwner] = useState(false);
    const [newOwner, setNewOwner] = useState({ name: "", phone: "", email: "", project_id: "", unit_code: "" });
    
    // حالة التعديل الجديدة
    const [editingOwner, setEditingOwner] = useState(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const resOwners = await fetch(`${API_URL}?action=get_owners`);
            const dataOwners = await resOwners.json();
            if (dataOwners.success) setOwnersList(dataOwners.data);

            const resProj = await fetch(`${API_URL}?action=get_projects_data`);
            const dataProj = await resProj.json();
            if (dataProj.success) {
                setProjectsData(dataProj.data);
                if (dataProj.data.length > 0 && !newOwner.project_id) {
                    setNewOwner(prev => ({ ...prev, project_id: dataProj.data[0].id }));
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadData(); }, []);

    // إضافة مالك جديد
    const handleAddOwner = async (e) => {
        e.preventDefault();
        if(!newOwner.unit_code) { 
            if(showToast) showToast("تنبيه", "يجب اختيار الوحدة من القائمة", "error"); 
            return; 
        }
        setLocalLoading(true);
        try {
            const res = await fetch(`${API_URL}?action=add_owner`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newOwner) });
            const data = await res.json();
            if(data.success) {
                if(showToast) showToast("تم", "تم تسجيل المالك وربطه بالوحدة بنجاح ✅");
                setShowAddOwner(false);
                setNewOwner({ name: "", phone: "", email: "", project_id: projectsData[0]?.id || "", unit_code: "" });
                loadData();
            } else {
                if(showToast) showToast("خطأ", data.message || "حدث خطأ أثناء الحفظ", "error");
            }
        } catch (e) { if(showToast) showToast("خطأ", "فشل الاتصال بالسيرفر", "error"); } 
        finally { setLocalLoading(false); }
    };

    // فتح نافذة التعديل وتجهيز بيانات المالك
    const openEditMode = (owner) => {
        // البحث عن المشروع الخاص بوحدة هذا المالك لتحديده في القائمة تلقائياً
        let foundProjectId = "";
        for (let p of projectsData) {
            if (p.units.includes(owner.unit_code)) {
                foundProjectId = p.id; break;
            }
        }
        setEditingOwner({
            id: owner.id,
            name: owner.owner_name,
            phone: owner.owner_phone,
            email: owner.owner_email || "",
            project_id: foundProjectId,
            unit_code: owner.unit_code
        });
        setShowAddOwner(false);
        window.scrollTo({top: 300, behavior: 'smooth'});
    };

    // حفظ التعديلات
    const handleUpdateOwner = async (e) => {
        e.preventDefault();
        setLocalLoading(true);
        try {
            const res = await fetch(`${API_URL}?action=update_owner`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingOwner) });
            const data = await res.json();
            if(data.success) {
                if(showToast) showToast("تم التحديث", "تم حفظ تعديلات المالك بنجاح ✅");
                setEditingOwner(null);
                loadData();
            } else {
                if(showToast) showToast("خطأ", data.message, "error");
            }
        } catch (e) { if(showToast) showToast("خطأ", "فشل الاتصال", "error"); } 
        finally { setLocalLoading(false); }
    };

    // حذف المالك نهائياً
    const handleDeleteOwner = async (id) => {
        if (!window.confirm("هل أنت متأكد من حذف هذا المالك؟ سيتم تحرير وحدته وإرجاعها لحالة 'متاح'.")) return;
        try {
            const res = await fetch(`${API_URL}?action=delete_owner`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
            const data = await res.json();
            if(data.success) {
                if(showToast) showToast("تم الحذف", "تم حذف المالك وتحرير الوحدة بنجاح");
                loadData();
            }
        } catch (e) {}
    };

    return (
        <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden mb-12 p-6 md:p-8 animate-fadeIn">
            
            {/* --- الهيدر --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-100 pb-6 gap-4">
                <h3 className="text-2xl font-black text-[#1a365d] flex items-center gap-3">
                    <UserCheck className="text-emerald-600" size={28}/> سجل ملاك الوحدات
                </h3>
                <button onClick={() => { setShowAddOwner(!showAddOwner); setEditingOwner(null); }} className="bg-emerald-600 text-white px-5 py-3 rounded-xl font-bold hover:bg-emerald-700 transition shadow-md flex items-center gap-2">
                    {showAddOwner ? "إلغاء الإضافة ✕" : <><Plus size={18}/> إضافة مالك جديد</>}
                </button>
            </div>

            {/* --- نموذج الإضافة --- */}
            {showAddOwner && !editingOwner && (
                <form onSubmit={handleAddOwner} className="bg-emerald-50 p-6 md:p-8 rounded-2xl mb-8 border border-emerald-100 shadow-inner animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                        <div>
                            <label className="text-xs font-bold text-emerald-800 block mb-2">اختر المشروع أولاً</label>
                            <select value={newOwner.project_id} onChange={(e) => setNewOwner({...newOwner, project_id: e.target.value, unit_code: ""})} className="w-full p-3 rounded-xl border border-emerald-200 outline-none focus:border-emerald-500 bg-white">
                                {projectsData.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-emerald-800 block mb-2">اختر الوحدة (المتاحة)</label>
                            <select required value={newOwner.unit_code} onChange={(e) => setNewOwner({...newOwner, unit_code: e.target.value})} className="w-full p-3 rounded-xl border border-emerald-200 outline-none focus:border-emerald-500 font-bold bg-white">
                                <option value="" disabled>-- حدد الوحدة من هنا --</option>
                                {projectsData.find(p => p.id.toString() === newOwner.project_id.toString())?.units.map(u => (
                                    <option key={u} value={u}>{u}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
                        <div><label className="text-xs font-bold text-slate-600 block mb-2">اسم المالك (رب الأسرة)</label><input required type="text" value={newOwner.name} onChange={(e) => setNewOwner({...newOwner, name: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-emerald-500" placeholder="الاسم الرباعي" /></div>
                        <div><label className="text-xs font-bold text-slate-600 block mb-2">رقم الجوال</label><input required type="tel" value={newOwner.phone} onChange={(e) => setNewOwner({...newOwner, phone: e.target.value})} dir="ltr" placeholder="05XXXXXXXX" className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-emerald-500 text-left" /></div>
                        <div><label className="text-xs font-bold text-slate-600 block mb-2">البريد الإلكتروني (اختياري)</label><input type="email" value={newOwner.email} onChange={(e) => setNewOwner({...newOwner, email: e.target.value})} dir="ltr" className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-emerald-500 text-left" placeholder="email@example.com" /></div>
                    </div>
                    
                    <button type="submit" disabled={localLoading} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-black text-lg hover:bg-emerald-700 transition flex justify-center items-center gap-2 shadow-lg disabled:opacity-50">
                        {localLoading ? <RefreshCw className="animate-spin" /> : <UserCheck size={20} />} حفظ وربط المالك بالوحدة
                    </button>
                </form>
            )}

            {/* --- 🔥 نموذج التعديل الشامل --- */}
            {editingOwner && (
                <form onSubmit={handleUpdateOwner} className="bg-blue-50 p-6 md:p-8 rounded-2xl mb-8 border border-blue-200 shadow-inner animate-fadeIn relative">
                    <button type="button" onClick={() => setEditingOwner(null)} className="absolute top-4 left-4 text-blue-400 hover:text-blue-600 font-bold text-sm bg-white px-3 py-1 rounded-lg shadow-sm">إلغاء ✕</button>
                    <h4 className="text-blue-800 font-black mb-6 flex items-center gap-2"><Edit size={20}/> تعديل بيانات المالك والوحدة</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5 border-b border-blue-200 pb-5">
                        <div>
                            <label className="text-xs font-bold text-blue-800 block mb-2">نقل المالك لمشروع آخر؟</label>
                            <select value={editingOwner.project_id} onChange={(e) => setEditingOwner({...editingOwner, project_id: e.target.value, unit_code: ""})} className="w-full p-3 rounded-xl border border-blue-200 outline-none focus:border-blue-500 bg-white">
                                {projectsData.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-blue-800 block mb-2">تغيير الوحدة</label>
                            <select required value={editingOwner.unit_code} onChange={(e) => setEditingOwner({...editingOwner, unit_code: e.target.value})} className="w-full p-3 rounded-xl border border-blue-200 outline-none focus:border-blue-500 font-bold bg-white">
                                <option value="" disabled>-- اختر الوحدة --</option>
                                {projectsData.find(p => p.id.toString() === editingOwner.project_id.toString())?.units.map(u => (
                                    <option key={u} value={u}>{u}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
                        <div><label className="text-xs font-bold text-slate-600 block mb-2">اسم المالك</label><input required type="text" value={editingOwner.name} onChange={(e) => setEditingOwner({...editingOwner, name: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500" /></div>
                        <div><label className="text-xs font-bold text-slate-600 block mb-2">رقم الجوال</label><input required type="tel" value={editingOwner.phone} onChange={(e) => setEditingOwner({...editingOwner, phone: e.target.value})} dir="ltr" className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 text-left" /></div>
                        <div><label className="text-xs font-bold text-slate-600 block mb-2">البريد الإلكتروني</label><input type="email" value={editingOwner.email} onChange={(e) => setEditingOwner({...editingOwner, email: e.target.value})} dir="ltr" className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 text-left" /></div>
                    </div>
                    
                    <button type="submit" disabled={localLoading} className="w-full bg-blue-600 text-white py-4 rounded-xl font-black text-lg hover:bg-blue-700 transition flex justify-center items-center gap-2 shadow-lg disabled:opacity-50">
                        {localLoading ? <RefreshCw className="animate-spin" /> : <Save size={20} />} حفظ التعديلات الشاملة
                    </button>
                </form>
            )}

            {/* --- جدول الملاك --- */}
            <div className="overflow-x-auto">
                {loading ? (
                    <div className="text-center py-12 text-slate-400 font-bold"><RefreshCw className="animate-spin mx-auto mb-3 text-emerald-500" size={32}/> جاري تحميل السجل...</div>
                ) : (
                    <table className="w-full text-right">
                        <thead className="bg-slate-50 text-slate-600 text-xs md:text-sm uppercase tracking-wider">
                            <tr>
                                <th className="p-4 rounded-tr-xl">بيانات المالك والاتصال</th>
                                <th className="p-4">المشروع والوحدة</th>
                                <th className="p-4 text-center">تاريخ التسجيل</th>
                                <th className="p-4 rounded-tl-xl text-center">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {ownersList.length === 0 ? <tr><td colSpan="4" className="text-center p-8 text-slate-400 font-bold">لا يوجد ملاك مسجلين في النظام حالياً.</td></tr> : null}
                            {ownersList.map(o => (
                                <tr key={o.id} className="hover:bg-emerald-50/50 transition group">
                                    <td className="p-4">
                                        <span className="font-bold text-[#1a365d] text-base group-hover:text-emerald-700 transition">{o.owner_name}</span><br/>
                                        <span className="text-xs text-slate-500 font-mono" dir="ltr">{o.owner_phone}</span>
                                    </td>
                                    <td className="p-4">
                                        <span className="text-sm font-black text-emerald-700 bg-emerald-100 px-3 py-1 rounded-lg border border-emerald-200 shadow-sm">{o.unit_code}</span><br/>
                                        <span className="text-[11px] text-slate-500 mt-1 inline-block">{o.project_name || 'مشروع غير محدد'}</span>
                                    </td>
                                    <td className="p-4 text-xs text-slate-400 font-mono text-center" dir="ltr">
                                        {o.created_at?.substring(0,10)}
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <button onClick={() => openEditMode(o)} className="text-blue-500 bg-blue-50 p-2.5 rounded-xl hover:bg-blue-500 hover:text-white transition shadow-sm" title="تعديل المالك"><Edit size={16}/></button>
                                            <button onClick={() => handleDeleteOwner(o.id)} className="text-red-500 bg-red-50 p-2.5 rounded-xl hover:bg-red-500 hover:text-white transition shadow-sm" title="حذف المالك وإرجاع الوحدة"><Trash2 size={16}/></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}