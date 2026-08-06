import React, { useState, useEffect, useContext } from 'react';
import { Users, Search, RefreshCw, MessageCircle, UserCheck, X, Building, CheckCircle2, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { sendWhatsAppMessage, normalizePhone } from '../../services/whatsappService';

import { API_URL } from '../../lib/api/client';
import { AppContext } from '../../context/AppContext';

export default function LeadsManage({ showToast }) {
    const { branding } = useContext(AppContext);
    const companyName = branding?.company_name || 'سماك العقارية';
    const [leads, setLeads] = useState([]);
    const [projectsData, setProjectsData] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");

    // حالات نافذة "التحويل إلى مالك"
    const [showConvertModal, setShowConvertModal] = useState(false);
    const [selectedLead, setSelectedLead] = useState(null);
    const [convertData, setConvertData] = useState({ project_id: "", unit_code: "" });
    const [converting, setConverting] = useState(false);
    const [expandedNotes, setExpandedNotes] = useState({}); // {leadId: true/false}

    // تحليل الملاحظات لقائمة عناصر بتاريخ ووقت [YYYY-MM-DD HH:MM] متن
    const parseNotes = (notesText) => {
        if (!notesText) return [];
        const lines = notesText.split('\n').filter(l => l.trim());
        return lines.map(line => {
            const m = line.match(/^\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2})\]\s*(.+)$/);
            if (m) return { time: m[1], text: m[2] };
            return { time: null, text: line };
        }).reverse(); // الأحدث أولاً
    };

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

    // حذف مهتم (يحذف كل السجلات المُجمَّعة بنفس الجوال)
    const deleteLead = async (lead) => {
        const ids = lead.merged_ids || [lead.id];
        const extra = ids.length > 1 ? `\n\nسيتم حذف ${ids.length} سجلات مرتبطة بنفس الجوال.` : '';
        if (!confirm(`تأكيد حذف ${lead.name} (${lead.phone})؟${extra}\nالحذف نهائي.`)) return;
        try {
            await Promise.all(ids.map(id =>
                fetch(`${API_URL}?action=delete_lead`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id })
                })
            ));
            setLeads(prev => prev.filter(l => !ids.includes(l.id)));
            if (showToast) showToast("تم الحذف", `حُذف سجل ${lead.name}`);
        } catch (e) {
            if (showToast) showToast("فشل الحذف", e.message, "error");
        }
    };

    // إرسال رسالة واتساب للمهتم — تلقائي عبر API
    const notifyWhatsApp = async (lead) => {
        const msg = `مرحباً بك أستاذ ${lead.name}،\nمعك فريق المبيعات من *${companyName}* 🏢\n\nبناءً على طلبك واهتمامك بالوحدة (${lead.unit})، يسعدنا تواصلك وتقديم كافة التفاصيل والرد على استفساراتك.\n\nكيف يمكننا خدمتك اليوم؟`;
        const result = await sendWhatsAppMessage(lead.phone, msg);
        if (showToast) {
            if (result.success) showToast("تم الإرسال ✅", `أُرسلت رسالة واتساب لـ ${lead.name}`);
            else showToast("فشل الإرسال", result.error || "تحقق من إعدادات API", "error");
        }
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

    // مفتاح تجميع موحّد للجوال (يلغي الفروق بين 05.., 9665.., +9665.., 5..)
    const phoneKey = (p) => {
        if (!p) return '';
        // حوّل الأرقام العربية إلى لاتينية
        let s = String(p).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString());
        // أبقِ الأرقام فقط
        const digits = s.replace(/[^0-9]/g, '');
        // أزل البادئة 966 أو الصفر، خذ آخر 9 أرقام كمفتاح موحد
        const stripped = digits.replace(/^(966|0)+/, '');
        return stripped.slice(-9); // آخر 9 أرقام (الجزء الفريد من الجوال السعودي)
    };

    // دمج كل المهتمين بنفس الجوال في سجل واحد، مع تجميع الاهتمامات والملاحظات
    const groupedLeads = (() => {
        const groups = {};
        for (const l of leads) {
            const key = phoneKey(l.phone) || `id:${l.id}`;
            if (!groups[key]) groups[key] = [];
            groups[key].push(l);
        }
        return Object.values(groups).map(arr => {
            const sorted = [...arr].sort((a, b) => (b.id || 0) - (a.id || 0)); // الأحدث أولاً
            const primary = sorted[0];
            const interests = Array.from(new Set(sorted.map(x => x.interest).filter(Boolean))).join('، ');
            const allNotes = sorted
                .map(x => x.notes)
                .filter(Boolean)
                .join('\n');
            return {
                ...primary,
                interest: interests || primary.interest,
                notes: allNotes || primary.notes,
                merged_ids: sorted.map(x => x.id),
                merged_count: sorted.length,
                last_activity: sorted[0].created_at || '', // أحدث سجل في المجموعة = آخر تواصل
                summary: sorted.map(x => x.summary).find(Boolean) || '', // أحدث ملخص متوفر في المجموعة
            };
        // ترتيب المجموعات نفسها: آخر تواصل أولاً (أحدث id في كل مجموعة)
        }).sort((a, b) => (b.merged_ids[0] || 0) - (a.merged_ids[0] || 0));
    })();

    const filteredLeads = groupedLeads.filter(l =>
        String(l.name).includes(searchQuery) || String(l.phone).includes(searchQuery)
    );

    return (
        <div className="bg-white dark:bg-brand-900 rounded-[2rem] shadow-xl border border-slate-100 dark:border-brand-700 overflow-hidden mb-12 animate-fade-in-up relative">
            
            {/* نافذة التحويل إلى مالك */}
            {showConvertModal && selectedLead && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-white dark:bg-brand-900 rounded-[2.5rem] shadow-2xl p-8 max-w-lg w-full relative">
                        <button onClick={() => setShowConvertModal(false)} className="absolute top-6 left-6 text-slate-400 hover:text-red-500 transition bg-slate-100 p-2 rounded-full"><X size={20} /></button>
                        
                        <div className="flex items-center gap-4 mb-6">
                            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                                <UserCheck size={28} />
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-brand-800 dark:text-brand-100">تحويل إلى مالك</h3>
                                <p className="text-sm font-bold text-slate-500 dark:text-brand-400">إتمام البيع لـ: <span className="text-emerald-600 dark:text-emerald-300">{selectedLead.name}</span></p>
                            </div>
                        </div>

                        <form onSubmit={handleConvertToOwner} className="space-y-5">
                            <div>
                                <label className="block text-xs font-bold text-slate-600 dark:text-brand-300 mb-2">رقم الجوال المعتمد</label>
                                <input type="text" readOnly value={selectedLead.phone} className="w-full p-3 rounded-xl border border-slate-200 dark:border-brand-700 bg-slate-50 dark:bg-brand-900 text-slate-500 dark:text-brand-400 font-bold" dir="ltr" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block mb-2">المشروع</label>
                                    <select value={convertData.project_id} onChange={(e) => setConvertData({...convertData, project_id: e.target.value, unit_code: ""})} className="w-full p-3 rounded-xl border border-emerald-200 dark:border-brand-700 outline-none focus:border-emerald-500 bg-white dark:bg-brand-900 dark:text-brand-50 font-bold">
                                        {projectsData.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-bold text-emerald-800 dark:text-emerald-300 block mb-2">تحديد الوحدة المباعة</label>
                                    <select required value={convertData.unit_code} onChange={(e) => setConvertData({...convertData, unit_code: e.target.value})} className="w-full p-3 rounded-xl border border-emerald-200 dark:border-brand-700 outline-none focus:border-emerald-500 font-black text-brand-800 dark:text-brand-50 bg-emerald-50 dark:bg-brand-900">
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

            <div className="p-8 border-b border-slate-100 dark:border-brand-700 bg-slate-50/50 dark:bg-brand-800/40 flex flex-col md:flex-row justify-between items-center gap-6">
                <div>
                    <h3 className="text-2xl font-black text-brand-800 dark:text-brand-100 flex items-center gap-3"><Users className="text-teal-600" /> سجل المهتمين والمبيعات</h3>
                    <p className="text-slate-500 dark:text-brand-400 text-sm mt-1">إدارة الطلبات الواردة، التواصل عبر واتساب، وتحويلهم لملاك</p>
                </div>
                <button onClick={loadData} className="bg-teal-500 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-teal-600 transition flex items-center gap-2 shadow-md">
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> تحديث السجل
                </button>
            </div>

            <div className="p-6 bg-white dark:bg-brand-900 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="relative w-full sm:w-96">
                    <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-brand-400" size={18} />
                    <input type="text" placeholder="بحث بالاسم أو الجوال..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-slate-50 dark:bg-brand-900 border border-slate-200 dark:border-brand-700 rounded-xl py-3 pr-12 pl-4 outline-none focus:border-teal-500 transition font-bold dark:text-brand-50 dark:placeholder-brand-500" />
                </div>
                <div className="text-slate-500 dark:text-brand-400 font-bold">إجمالي الطلبات: <span className="text-brand-800 dark:text-brand-100 text-xl">{filteredLeads.length}</span></div>
            </div>

            <div className="overflow-x-auto min-h-[400px]">
                <table className="w-full text-right">
                    <thead className="bg-slate-50 dark:bg-brand-800/60 text-slate-600 dark:text-brand-300 text-sm uppercase tracking-wider">
                        <tr>
                            <th className="px-6 py-4 border-b dark:border-brand-700">الاسم والجوال</th>
                            <th className="px-6 py-4 border-b dark:border-brand-700">الوحدة المفضلة</th>
                            <th className="px-6 py-4 border-b dark:border-brand-700">ملاحظات فهد</th>
                            <th className="px-6 py-4 border-b dark:border-brand-700 text-center">الحالة والإجراء</th>
                            <th className="px-6 py-4 border-b dark:border-brand-700 text-center">تواصل سريع</th>
                            <th className="px-6 py-4 border-b dark:border-brand-700 text-center">حذف</th>
                        </tr>
                    </thead>
                    <tbody className="text-slate-700 dark:text-brand-300 divide-y divide-slate-50 dark:divide-brand-700">
                        {loading ? (
                            <tr><td colSpan="6" className="text-center py-12 text-teal-600 font-bold"><RefreshCw className="animate-spin inline mr-2" /> جاري التحميل...</td></tr>
                        ) : filteredLeads.length === 0 ? (
                            <tr><td colSpan="6" className="text-center py-12 text-slate-400 font-bold">لا يوجد سجلات مهتمين مطابقة.</td></tr>
                        ) : filteredLeads.map((lead) => {
                            const entries = parseNotes(lead.notes);
                            const isOpen  = expandedNotes[lead.id];
                            const latest  = entries[0];
                            return (
                            <React.Fragment key={lead.id}>
                            <tr className="hover:bg-teal-50/30 dark:hover:bg-brand-800 transition-colors duration-200">
                                <td className="px-6 py-4">
                                    <div className="font-bold text-brand-800 dark:text-brand-100 text-base flex items-center gap-2 flex-wrap">
                                        {lead.name}
                                        {lead.merged_count > 1 && (
                                            <span className="text-[10px] font-bold bg-teal-100 dark:bg-teal-500/15 text-teal-800 dark:text-teal-300 px-2 py-0.5 rounded-full" title={`${lead.merged_count} اهتمامات بنفس الجوال`}>
                                                {lead.merged_count} اهتمامات
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-sm text-slate-500 dark:text-brand-400 font-mono mt-1" dir="ltr">{lead.phone}</div>
                                    {lead.last_activity && (
                                        <div className="text-[11px] text-slate-400 dark:text-brand-500 mt-1">آخر تواصل: {String(lead.last_activity).slice(0, 16)}</div>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <span className="bg-teal-50 text-teal-700 px-3 py-1 rounded-lg text-sm font-bold border border-teal-200 shadow-sm flex items-center w-max gap-1">
                                        <Building size={14} /> {lead.unit || "غير محدد"}
                                    </span>
                                </td>
                                <td className="px-6 py-4 min-w-[260px]">
                                    {lead.summary && (
                                        <div className="mb-2 bg-teal-50/70 dark:bg-teal-900/20 border-r-2 border-teal-400 rounded-l-lg px-3 py-2">
                                            <div className="text-[10px] font-black text-teal-700 dark:text-teal-300 mb-0.5">🤖 ملخص فهد</div>
                                            <div className="text-xs text-slate-700 dark:text-brand-200 leading-relaxed">{lead.summary}</div>
                                        </div>
                                    )}
                                    {entries.length === 0 ? (
                                        !lead.summary && <span className="text-xs text-slate-300 italic">لا توجد ملاحظات بعد</span>
                                    ) : (
                                        <button
                                            onClick={() => setExpandedNotes(p => ({ ...p, [lead.id]: !p[lead.id] }))}
                                            className="w-full text-right bg-amber-50/60 border-r-2 border-amber-300 rounded-l-lg px-3 py-2 flex items-start justify-between gap-2 hover:bg-amber-100/50 transition"
                                        >
                                            <div className="flex-1 min-w-0">
                                                {latest.time && (
                                                    <div className="text-[10px] text-amber-700 font-mono font-bold mb-0.5">{latest.time}</div>
                                                )}
                                                <div className="text-xs text-slate-700 dark:text-brand-300 leading-relaxed line-clamp-2">{latest.text}</div>
                                            </div>
                                            <div className="flex flex-col items-center shrink-0 mt-0.5">
                                                {isOpen ? <ChevronUp size={14} className="text-amber-700"/> : <ChevronDown size={14} className="text-amber-700"/>}
                                                {entries.length > 1 && (
                                                    <span className="text-[9px] font-bold bg-amber-200 text-amber-900 rounded-full px-1.5 mt-0.5">{entries.length}</span>
                                                )}
                                            </div>
                                        </button>
                                    )}
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
                                <td className="px-6 py-4 text-center">
                                    <button
                                        onClick={() => deleteLead(lead)}
                                        className="bg-red-50 text-red-600 p-2.5 rounded-xl hover:bg-red-600 hover:text-white transition shadow-sm mx-auto flex items-center justify-center"
                                        title="حذف السجل نهائياً"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                            {isOpen && entries.length > 1 && (
                                <tr className="bg-amber-50/40 dark:bg-amber-500/5">
                                    <td colSpan="6" className="px-6 py-4">
                                        <div className="border-r-4 border-amber-400 pr-4">
                                            <div className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-2 flex items-center gap-2">
                                                <span>سجل المحادثات الكامل لـ {lead.name}</span>
                                                <span className="bg-amber-200 text-amber-900 px-2 py-0.5 rounded-full text-[10px]">{entries.length} ملاحظة</span>
                                            </div>
                                            <div className="space-y-2 max-h-96 overflow-y-auto pl-2">
                                                {entries.map((e, i) => (
                                                    <div key={i} className="bg-white dark:bg-brand-900 border border-amber-100 dark:border-brand-700 rounded-lg p-3 shadow-sm">
                                                        {e.time && (
                                                            <div className="text-[11px] text-amber-700 dark:text-amber-300 font-mono font-bold mb-1">{e.time}</div>
                                                        )}
                                                        <div className="text-sm text-slate-700 dark:text-brand-300 leading-relaxed whitespace-pre-wrap break-words">{e.text}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </td>
                                </tr>
                            )}
                            </React.Fragment>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}