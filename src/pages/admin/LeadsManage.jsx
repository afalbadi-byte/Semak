import React, { useState, useEffect } from 'react';
import { Users, Search, RefreshCw, MessageCircle, UserCheck, X, Building, CheckCircle2 } from 'lucide-react';

const API_URL = "https://semak.sa/api.php";

export default function LeadsManage({ showToast }) {
    const [leads, setLeads] = useState([]);
    const [projectsData, setProjectsData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // حالات نافذة "التحويل إلى مالك"
    const [showConvertModal, setShowConvertModal] = useState(false);
    const [selectedLead, setSelectedLead] = useState(null);
    const [convertData, setConvertData] = useState({ project_id: "", unit_code: "" });
    const [converting, setConverting] = useState(false);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // جلب المهتمين والمشاريع (لربط الوحدة عند البيع)
            const [leadsRes, projRes] = await Promise.all([
                fetch(`${API_URL}?action=get_leads`),
                fetch(`${API_URL}?action=get_projects_data`)
            ]);
            
            const leadsData = await leadsRes.json();
            const projData = await projRes.json();
            
            if (Array.isArray(leadsData)) setLeads(leadsData);
            if (projData.success) {
                setProjectsData(projData.data);
                if(projData.data.length > 0) setConvertData(prev => ({ ...prev, project_id: projData.data[0].id }));
            }
        } catch (e) {
            if(showToast) showToast("خطأ", "تعذر جلب البيانات", "error");
        } finally {
            setLoading(false);
        }
    };

    // إرسال رسالة واتساب للمهتم
    const notifyWhatsApp = (lead) => {
        let phone = lead.phone.toString().replace(/^0/, "966").replace(/\D/g, "");
        let msg = `مرحباً بك أستاذ ${lead.name}،\nمعك فريق المبيعات من *سماك العقارية* 🏢\n\nبناءً على طلبك واهتمامك بالوحدة (${lead.unit})، يسعدنا تواصلك وتقديم كافة التفاصيل والرد على استفساراتك.\n\nكيف يمكننا خدمتك اليوم؟`;
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
    };

    // تغيير حالة المهتم (جديد، مهتم، تم البيع، مرفوض)
    const handleStatusChange = async (leadId, newStatus) => {
        const lead = leads.find(l => l.id === leadId);
        
        // إذا اختار "تم البيع"، نفتح نافذة التحويل ليصبح مالكاً
        if (newStatus === 'تم البيع') {
            setSelectedLead(lead);
            setShowConvertModal(true);
            return;
        }

        // التحديث المباشر لباقي الحالات
        updateLeadInDB(leadId, newStatus);
    };

    // دالة تحديث حالة الـ Lead في قاعدة البيانات
    const updateLeadInDB = async (id, status) => {
        setLeads(prev => prev.map(l => l.id === id ? { ...l, status: status } : l));
        try {
            // ملاحظة: تأكد أن الـ API الخاص بك يدعم update_lead_status
            await fetch(`${API_URL}?action=update_lead_status`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, status })
            });
            if(showToast) showToast("تم التحديث", `تم تغيير حالة العميل إلى: ${status}`);
        } catch (e) {}
    };

    // تأكيد تحويل المهتم إلى مالك فعلي وربطه بوحدة
    const handleConvertToOwner = async (e) => {
        e.preventDefault();
        if (!convertData.unit_code) {
            if(showToast) showToast("تنبيه", "يجب اختيار الوحدة المراد بيعها للعميل", "error");
            return;
        }

        setConverting(true);
        try {
            // 1. إضافته في جدول الملاك
            const ownerPayload = {
                name: selectedLead.name,
                phone: selectedLead.phone,
                email: "", // يمكن تركه فارغاً أو أخذه إن وُجد
                project_id: convertData.project_id,
                unit_code: convertData.unit_code
            };

            const resOwner = await fetch(`${API_URL}?action=add_owner`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(ownerPayload)
            });
            const dataOwner = await resOwner.json();

            if (dataOwner.success) {
                // 2. تحديث حالته في سجل المهتمين إلى "تم البيع"
                await updateLeadInDB(selectedLead.id, 'تم البيع');
                if(showToast) showToast("عملية بيع ناجحة 🎉", `تم تسجيل ${selectedLead.name} كمالك للوحدة ${convertData.unit_code} بنجاح!`);
                setShowConvertModal(false);
                setSelectedLead(null);
                setConvertData({ project_id: projectsData[0]?.id || "", unit_code: "" });
            } else {
                if(showToast) showToast("خطأ", dataOwner.message || "حدث خطأ أثناء نقل العميل", "error");
            }
        } catch (e) {
            if(showToast) showToast("خطأ", "فشل الاتصال بالسيرفر", "error");
        } finally {
            setConverting(false);
        }
    };

    const filteredLeads = leads.filter(l => String(l.name).includes(searchQuery) || String(l.phone).includes(searchQuery));

    return (
        <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden mb-12 animate-fade-in-up relative">
            
            {/* نافذة التحويل إلى مالك */}
            {showConvertModal && selectedLead && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 max-w-lg w-full relative">
                        <button onClick={() => setShowConvertModal(false)} className="absolute top-6 left-6 text-slate-400 hover:text-red-500 transition bg-slate-100 p-2 rounded-full"><X size={20} /></button>
                        
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                                <UserCheck size={28} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-[#1a365d]">تحويل إلى مالك</h3>
                                <p className="text-sm font-bold text-slate-500">إتمام البيع لـ: <span className="text-emerald-600">{selectedLead.name}</span></p>
                            </div>
                        </div>

                        <form onSubmit={handleConvertToOwner} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-2">رقم الجوال المعتمد</label>
                                <input type="text" readOnly value={selectedLead.phone} className="w-full p-3 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 font-bold" dir="ltr" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-emerald-800 block mb-2">المشروع</label>
                                    <select value={convertData.project_id} onChange={(e) => setConvertData({...convertData, project_id: e.target.value, unit_code: ""})} className="w-full p-3 rounded-xl border border-emerald-200 outline-none focus:border-emerald-500 bg-white font-bold">
                                        {projectsData.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-emerald-800 block mb-2">تحديد الوحدة المباعة</label>
                                    <select required value={convertData.unit_code} onChange={(e) => setConvertData({...convertData, unit_code: e.target.value})} className="w-full p-3 rounded-xl border border-emerald-200 outline-none focus:border-emerald-500 font-black text-[#1a365d] bg-emerald-50">
                                        <option value="" disabled>-- اختر الوحدة --</option>
                                        {projectsData.find(p => String(p.id) === String(convertData.project_id))?.units.map(u => (
                                            <option key={u} value={u}>{u}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <button type="submit" disabled={converting} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-black text-lg hover:bg-emerald-700 transition flex justify-center items-center gap-2 shadow-lg disabled:opacity-50 mt-4">
                                {converting ? <RefreshCw className="animate-spin" size={20} /> : <CheckCircle2 size={20} />} تأكيد البيع وإصدار الملكية
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <div className="p-8 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <h3 className="text-2xl font-black text-[#1a365d] flex items-center gap-3"><Users className="text-teal-600" /> سجل المهتمين والمبيعات</h3>
                    <p className="text-slate-500 text-sm mt-1">إدارة الطلبات الواردة، التواصل عبر واتساب، وتحويلهم لملاك</p>
                </div>
                <button onClick={loadData} className="bg-teal-500 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-teal-600 transition flex items-center gap-2 shadow-md">
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> تحديث السجل
                </button>
            </div>

            <div className="p-6 bg-white flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="relative w-full sm:w-96">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input type="text" placeholder="بحث بالاسم أو الجوال..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-12 pl-4 outline-none focus:border-teal-500 transition font-bold" />
                </div>
                <div className="text-slate-500 font-bold">إجمالي الطلبات: <span className="text-[#1a365d] text-xl">{filteredLeads.length}</span></div>
            </div>

            <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full text-right">
                    <thead className="bg-slate-50 text-slate-600 text-sm uppercase tracking-wider">
                        <tr>
                            <th className="px-6 py-4 border-b">الاسم والجوال</th>
                            <th className="px-6 py-4 border-b">الوحدة المفضلة</th>
                            <th className="px-6 py-4 border-b text-center">الحالة والإجراء</th>
                            <th className="px-6 py-4 border-b text-center">تواصل سريع</th>
                        </tr>
                    </thead>
                    <tbody className="text-slate-700 divide-y divide-slate-50">
                        {loading ? (
                            <tr><td colSpan="4" className="text-center py-12 text-teal-600 font-bold"><RefreshCw className="animate-spin inline mr-2" /> جاري التحميل...</td></tr>
                        ) : filteredLeads.length === 0 ? (
                            <tr><td colSpan="4" className="text-center py-12 text-slate-400 font-bold">لا يوجد سجلات مهتمين مطابقة.</td></tr>
                        ) : filteredLeads.map((lead) => (
                            <tr key={lead.id} className="hover:bg-teal-50/30 transition-colors duration-200">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-[#1a365d] text-base">{lead.name}</div>
                                    <div className="text-sm text-slate-500 font-mono mt-1" dir="ltr">{lead.phone}</div>
                                </td>
                                <td className="px-6 py-4">
                                    <span className="bg-teal-50 text-teal-700 px-3 py-1 rounded-lg text-sm font-bold border border-teal-200 shadow-sm flex items-center w-max gap-1">
                                        <Building size={14} /> {lead.unit || "غير محدد"}
                                    </span>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <select 
                                        value={lead.status || "جديد"} 
                                        onChange={(e) => handleStatusChange(lead.id, e.target.value)}
                                        className={`text-xs font-bold px-3 py-2 rounded-xl border outline-none cursor-pointer shadow-sm transition
                                            ${lead.status === 'تم البيع' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                                              lead.status === 'مهتم' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                                              lead.status === 'مرفوض' ? 'bg-red-100 text-red-800 border-red-300' :
                                              'bg-orange-100 text-orange-800 border-orange-300'
                                            }`}
                                    >
                                        <option value="جديد">🟠 طلب جديد</option>
                                        <option value="مهتم">🔵 العميل مهتم (متابعة)</option>
                                        <option value="تم البيع">🟢 تم البيع (تحويل لمالك)</option>
                                        <option value="مرفوض">🔴 غير مهتم / مرفوض</option>
                                    </select>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <button 
                                        onClick={() => notifyWhatsApp(lead)} 
                                        className="bg-[#25D366] text-white p-2.5 rounded-xl hover:bg-green-600 transition shadow-md shadow-green-200 mx-auto flex items-center justify-center"
                                        title="مراسلة العميل عبر الواتساب"
                                    >
                                        <MessageCircle size={20} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}