import React, { useState, useEffect } from 'react';
import { Users, RefreshCw, MessageCircle, Phone, Plus, Trash2 } from 'lucide-react';

const API_URL = "https://semak.sa/api.php";

export default function LeadsManage({ showToast }) {
    const [leads, setLeads] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newLead, setNewLead] = useState({ name: "", phone: "", interest: "", source: "" });

    // أعمدة لوحة الـ CRM
    const columns = [
        { id: "new", title: "عملاء جدد", color: "border-sky-300", bg: "bg-sky-50", text: "text-sky-700", statuses: ["جديد", undefined] },
        { id: "negotiation", title: "تم التواصل / قيد التفاوض", color: "border-amber-300", bg: "bg-amber-50", text: "text-amber-700", statuses: ["تم التواصل", "قيد التفاوض", "مؤجل"] },
        { id: "won", title: "تم البيع بنجاح", color: "border-emerald-300", bg: "bg-emerald-50", text: "text-emerald-700", statuses: ["تم البيع", "تم التأجير"] },
        { id: "lost", title: "مستبعد / غير مهتم", color: "border-rose-300", bg: "bg-rose-50", text: "text-rose-700", statuses: ["غير مهتم", "رقم خاطئ"] }
    ];

    const loadLeads = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}?action=get_leads`);
            const data = await res.json();
            if (Array.isArray(data)) setLeads(data);
            else setLeads([]);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadLeads(); }, []);

    const handleAddLead = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}?action=add_lead`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newLead) });
            const data = await res.json();
            if (data.success) {
                if (showToast) showToast("تم الإضافة", "تم تسجيل العميل الجديد بنجاح ✅");
                setNewLead({ name: "", phone: "", interest: "", source: "" });
                setShowAddForm(false);
                loadLeads();
            }
        } catch (e) { } finally { setLoading(false); }
    };

    const updateLead = async (id, status, notes) => {
        setLeads(prev => prev.map(l => l.id === id ? { ...l, status, notes } : l));
        try {
            await fetch(`${API_URL}?action=update_lead_status`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status, notes }) });
        } catch (e) { }
    };

    const deleteLead = async (id) => {
        if (!window.confirm("هل أنت متأكد من حذف هذا العميل؟")) return;
        setLeads(prev => prev.filter(l => l.id !== id));
        try {
            await fetch(`${API_URL}?action=delete_lead`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
            if (showToast) showToast("تم الحذف", "تم حذف العميل من السجل");
        } catch (e) { }
    };

    const notifyWhatsApp = (phone, name) => {
        let cleanPhone = phone.toString().replace(/^0/, "966").replace(/\D/g, "");
        let msg = `مرحباً أستاذ ${name}،\nمعك فريق المبيعات من شركة *سماك العقارية* 🏢\n\nتواصلنا معك بخصوص اهتمامك بمشاريعنا، كيف نقدر نخدمك اليوم؟`;
        window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, "_blank");
    };

    const renderLeadCard = (lead) => (
        <div key={lead.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-4 flex flex-col hover:shadow-md transition">
            <div className="flex justify-between items-start mb-2">
                <h4 className="font-black text-[#1a365d] text-sm">{lead.name}</h4>
                <button onClick={() => deleteLead(lead.id)} className="text-slate-300 hover:text-red-500 transition"><Trash2 size={14} /></button>
            </div>
            
            <div className="flex items-center gap-2 mb-3">
                <span className="bg-slate-100 text-slate-600 px-2 py-1 rounded text-[10px] font-bold flex items-center gap-1"><Phone size={10}/> {lead.phone}</span>
                {lead.interest && <span className="bg-[#c5a059]/10 text-[#c5a059] px-2 py-1 rounded text-[10px] font-bold">{lead.interest}</span>}
            </div>

            <div className="bg-slate-50 p-2 rounded-xl border border-slate-100 mb-3">
                <input 
                    type="text" 
                    defaultValue={lead.notes || ""} 
                    onBlur={(e) => updateLead(lead.id, lead.status, e.target.value)}
                    placeholder="أضف ملاحظاتك هنا..." 
                    className="w-full bg-transparent text-xs font-medium outline-none text-slate-600 placeholder-slate-400"
                />
            </div>

            <div className="flex gap-2 mt-auto">
                <select 
                    value={lead.status || "جديد"} 
                    onChange={(e) => updateLead(lead.id, e.target.value, lead.notes)} 
                    className="flex-grow text-[11px] font-bold p-2 rounded-lg border border-slate-200 outline-none focus:border-teal-400 transition"
                >
                    <option value="جديد">✨ جديد</option>
                    <option value="تم التواصل">📞 تم التواصل</option>
                    <option value="قيد التفاوض">⏳ قيد التفاوض</option>
                    <option value="مؤجل">📅 مؤجل</option>
                    <option value="تم البيع">🎉 تم البيع</option>
                    <option value="تم التأجير">🔑 تم التأجير</option>
                    <option value="غير مهتم">❌ غير مهتم</option>
                    <option value="رقم خاطئ">🚫 رقم خاطئ</option>
                </select>
                <button onClick={() => notifyWhatsApp(lead.phone, lead.name)} className="bg-green-500 text-white p-2 rounded-lg hover:bg-green-600 transition shadow-md w-9 flex justify-center items-center" title="مراسلة واتساب">
                    <MessageCircle size={14} />
                </button>
            </div>
        </div>
    );

    return (
        <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden mb-12 p-6 md:p-8 animate-fadeIn">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-100 pb-6 gap-4">
                <h3 className="text-2xl font-black text-[#1a365d] flex items-center gap-3">
                    <Users className="text-teal-600" size={28}/> سجل المهتمين (CRM)
                </h3>
                <div className="flex gap-2">
                    <button onClick={() => setShowAddForm(!showAddForm)} className="bg-teal-600 text-white px-4 py-2 rounded-xl font-bold hover:bg-teal-700 transition flex items-center gap-2 shadow-sm">
                        <Plus size={18} /> إضافة عميل
                    </button>
                    <button onClick={loadLeads} className="bg-slate-50 text-slate-500 px-4 py-2 rounded-xl font-bold hover:bg-teal-50 hover:text-teal-600 transition flex items-center gap-2 border border-slate-200">
                        <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                    </button>
                </div>
            </div>

            {showAddForm && (
                <form onSubmit={handleAddLead} className="bg-teal-50/50 p-5 rounded-2xl border border-teal-100 mb-8 animate-fadeIn grid grid-cols-1 md:grid-cols-4 gap-4">
                    <input required type="text" placeholder="اسم العميل" value={newLead.name} onChange={e => setNewLead({...newLead, name: e.target.value})} className="p-3 rounded-xl border border-teal-200 outline-none focus:border-teal-500 text-sm font-bold" />
                    <input required type="text" placeholder="رقم الجوال" value={newLead.phone} onChange={e => setNewLead({...newLead, phone: e.target.value})} className="p-3 rounded-xl border border-teal-200 outline-none focus:border-teal-500 text-sm font-bold" dir="ltr" />
                    <input type="text" placeholder="الاهتمام (مثال: فيلا 01)" value={newLead.interest} onChange={e => setNewLead({...newLead, interest: e.target.value})} className="p-3 rounded-xl border border-teal-200 outline-none focus:border-teal-500 text-sm font-bold" />
                    <button type="submit" className="bg-teal-600 text-white p-3 rounded-xl font-bold hover:bg-teal-700 transition shadow-md">حفظ العميل</button>
                </form>
            )}

            {loading ? (
                <div className="text-center py-20 text-slate-400 font-bold"><RefreshCw className="animate-spin mx-auto mb-4 text-teal-500" size={40}/> جاري تحميل السجل...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {columns.map(col => (
                        <div key={col.id} className={`bg-slate-50 p-3 rounded-3xl border-2 ${col.color} flex flex-col h-full shadow-inner`}>
                            <h4 className={`font-black text-center mb-4 text-sm ${col.text}`}>
                                {col.title} ({leads.filter(l => col.statuses.includes(l.status)).length})
                            </h4>
                            <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar min-h-[400px]">
                                {leads.filter(l => col.statuses.includes(l.status)).length === 0 ? (
                                    <div className="text-center text-slate-400 text-xs font-bold py-10 bg-white rounded-xl border border-slate-100 border-dashed">لا يوجد عملاء هنا</div> 
                                ) : (
                                    leads.filter(l => col.statuses.includes(l.status)).map(renderLeadCard)
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}