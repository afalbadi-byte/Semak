import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, Loader2, XCircle, UserCheck, ChevronDown, Check, X, Send, FileWarning } from 'lucide-react';
import { API_URL } from '../../utils/helpers'; 

export default function UnitHandover() {
    const location = useLocation();
    const navigate = useNavigate();
    
    const [unitCode, setUnitCode] = useState("");
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [hasSnagsSubmitted, setHasSnagsSubmitted] = useState(false);

    const [globalTemplate, setGlobalTemplate] = useState([]);
    const [unitSpaces, setUnitSpaces] = useState([]);
    const [inspectionData, setInspectionData] = useState({});
    const [formData, setFormData] = useState({ owner_name: "", owner_phone: "", agreed: false });
    const [expandedSpace, setExpandedSpace] = useState(null);

    useEffect(() => {
        const query = new URLSearchParams(location.search);
        const unit = query.get('unit');
        if (!unit) { setError("الرابط غير صحيح."); setLoading(false); return; }
        setUnitCode(unit);
        fetchData(unit);
    }, [location]);

    const fetchData = async (unit) => {
        try {
            const ownerRes = await fetch(`${API_URL}?action=get_unit_owner&unit_code=${encodeURIComponent(unit.trim())}`);
            const ownerData = await ownerRes.json();
            if (ownerData.success && ownerData.data.name !== "غير مسجل") {
                setError(`تم تسليم الوحدة مسبقاً للمالك: ${ownerData.data.name}`); setLoading(false); return;
            }

            const projRes = await fetch(`${API_URL}?action=get_projects_data`);
            const projData = await projRes.json();
            let spaces = ["صالة", "غرفة نوم", "مطبخ", "حمام"];
            if (projData.success) {
                for(let p of projData.data) {
                    const u = p.units_details?.find(ud => ud.unit_code === unit);
                    if(u && u.spaces && u.spaces.length > 0) { spaces = u.spaces; break; }
                }
            }
            setUnitSpaces(spaces);
            setExpandedSpace(spaces[0]);

            const templateRes = await fetch(`${API_URL}?action=get_inspection_template`);
            const templateData = await templateRes.json();
            
            let template = [];
            if (templateData.success && templateData.data) {
                // تصفية البنود: نظهر للعميل البنود المخصصة له وللجميع فقط
                template = templateData.data.map(cat => {
                    return {
                        ...cat,
                        items: cat.items
                                .map(item => typeof item === 'string' ? { name: item, target: 'both' } : item)
                                .filter(item => item.target === 'both' || item.target === 'client')
                    };
                }).filter(cat => cat.items.length > 0); // نخفي الأقسام اللي صارت فاضية للعميل
            }

            setGlobalTemplate(template);

            const initialData = {};
            spaces.forEach(space => {
                template.forEach(cat => {
                    cat.items.forEach(item => {
                        initialData[`${space}_${cat.name}_${item.name}`] = { passed: null, notes: '' };
                    });
                });
            });
            setInspectionData(initialData);

        } catch (e) { setError("فشل الاتصال."); } finally { setLoading(false); }
    };

    const setItemStatus = (key, status) => {
        setInspectionData(prev => ({ ...prev, [key]: { ...prev[key], passed: status } }));
    };

    const setItemNote = (key, note) => {
        setInspectionData(prev => ({ ...prev, [key]: { ...prev[key], notes: note } }));
    };

    const totalItems = Object.keys(inspectionData).length;
    const answeredItems = Object.values(inspectionData).filter(v => v.passed !== null).length;
    const isAllAnswered = totalItems > 0 && answeredItems === totalItems;
    
    const passedItemsCount = Object.values(inspectionData).filter(v => v.passed === true).length;
    const progressScore = totalItems === 0 ? 0 : Math.round((passedItemsCount / totalItems) * 100);

    const submitInspection = async (e) => {
        e.preventDefault();
        if (!isAllAnswered) { alert("الرجاء فحص جميع البنود أولاً"); return; }
        if (progressScore === 100 && !formData.agreed) { alert("يجب الموافقة على الإقرار"); return; }
        
        setSaving(true);
        try {
            const payload = { 
                unit: unitCode, 
                owner_name: formData.owner_name, 
                owner_phone: formData.owner_phone, 
                inspection_data: inspectionData, 
                progress: progressScore 
            };
            const res = await fetch(`${API_URL}?action=submit_client_inspection`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.success) {
                if (progressScore === 100) setIsSuccess(true);
                else setHasSnagsSubmitted(true);
            }
        } catch (e) { alert("فشل الاتصال."); } finally { setSaving(false); }
    };

    if (loading) return <div className="min-h-screen flex items-center justify-center bg-slate-50 font-cairo"><Loader2 className="animate-spin text-[#c5a059] mx-auto" size={48} /></div>;

    if (error) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 font-cairo p-4 text-center">
            <div className="bg-white p-8 rounded-[2rem] shadow-xl max-w-md w-full"><XCircle className="text-red-500 mx-auto mb-4" size={60} /><h2 className="text-xl font-black text-[#1a365d] mb-2">تنبيه</h2><p className="text-slate-500 font-bold">{error}</p></div>
        </div>
    );

    if (isSuccess) return (
        <div className="min-h-screen flex items-center justify-center bg-[#1a365d] font-cairo p-4 text-center">
            <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full animate-fade-in-up"><ShieldCheck className="text-emerald-500 mx-auto mb-4" size={70} /><h2 className="text-3xl font-black text-[#1a365d] mb-2">تم الاعتماد! 🎉</h2><p className="text-slate-500 font-bold mb-6">تم استلامك للوحدة (<span className="text-emerald-600">{unitCode}</span>) وبدأ سريان الضمان الشامل.</p></div>
        </div>
    );

    if (hasSnagsSubmitted) return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 font-cairo p-4 text-center">
            <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full border border-orange-100 animate-fade-in-up"><FileWarning className="text-orange-500 mx-auto mb-4" size={70} /><h2 className="text-2xl font-black text-[#1a365d] mb-2">تم رفع الملاحظات 🛠️</h2><p className="text-slate-500 font-bold leading-relaxed">شكراً لك! تم استلام تقرير الملاحظات وسيقوم فريق الصيانة بمعالجتها في أقرب وقت.</p></div>
        </div>
    );

    return (
        <div className="min-h-screen py-12 flex flex-col items-center bg-slate-50 font-cairo px-4">
            <div className="max-w-2xl w-full">
                <div className="bg-[#1a365d] p-8 rounded-[2.5rem] text-center text-white shadow-xl mb-6 relative overflow-hidden">
                    <h2 className="text-2xl font-black mb-2">فحص واستلام الوحدة</h2>
                    <p className="text-[#c5a059] font-bold text-sm mb-6">وحدة رقم: {unitCode}</p>
                    <div className="w-full bg-[#112240] h-3 rounded-full overflow-hidden mb-2">
                        <div className="bg-gradient-to-l from-emerald-400 to-emerald-500 h-full transition-all duration-500" style={{ width: `${(answeredItems / totalItems) * 100}%` }}></div>
                    </div>
                    <p className="text-xs font-bold text-slate-300">تم فحص: {answeredItems} من {totalItems} بند</p>
                </div>

                <div className="space-y-4 mb-8">
                    {unitSpaces.map((space, idx) => {
                        const isExpanded = expandedSpace === space;
                        
                        return (
                            <div key={idx} className="bg-white rounded-[2rem] shadow-sm border border-slate-200 overflow-hidden">
                                <button onClick={() => setExpandedSpace(isExpanded ? null : space)} className="w-full p-5 flex justify-between items-center hover:bg-slate-50">
                                    <h3 className="font-black text-lg text-[#1a365d]">{space}</h3>
                                    <ChevronDown className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} size={20} />
                                </button>
                                {isExpanded && (
                                    <div className="p-5 pt-0 border-t border-slate-100 bg-slate-50/30 space-y-6">
                                        {globalTemplate.map((cat, cIdx) => (
                                            <div key={cIdx}>
                                                <h4 className={`text-xs font-black mb-3 ${cat.color || 'text-indigo-500'}`}>{cat.name}</h4>
                                                <div className="space-y-3">
                                                    {cat.items.map((item, iIdx) => {
                                                        const key = `${space}_${cat.name}_${item.name}`;
                                                        const data = inspectionData[key];
                                                        
                                                        return (
                                                            <div key={iIdx} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                                                                <p className="text-sm font-bold text-[#1a365d] mb-3">{item.name}</p>
                                                                <div className="flex gap-2 mb-2">
                                                                    <button onClick={() => setItemStatus(key, true)} className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${data.passed === true ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-emerald-100'}`}><Check size={16}/> سليم</button>
                                                                    <button onClick={() => setItemStatus(key, false)} className={`flex-1 py-2.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all ${data.passed === false ? 'bg-orange-500 text-white shadow-md' : 'bg-slate-100 text-slate-500 hover:bg-orange-100'}`}><X size={16}/> ملاحظة</button>
                                                                </div>
                                                                {data.passed === false && (
                                                                    <textarea value={data.notes} onChange={(e) => setItemNote(key, e.target.value)} placeholder="اكتب وصف المشكلة هنا..." className="w-full mt-2 bg-orange-50/50 border border-orange-100 p-3 rounded-lg text-xs font-bold outline-none focus:border-orange-400 resize-none" rows="2" />
                                                                )}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {isAllAnswered && progressScore === 100 && (
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-emerald-100 animate-fade-in-up">
                        <h3 className="text-xl font-black text-[#1a365d] mb-6 text-center">إقرار الاستلام النهائي ✅</h3>
                        <form onSubmit={submitInspection} className="space-y-5 text-right">
                            <input required type="text" value={formData.owner_name} onChange={e => setFormData({...formData, owner_name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-5 py-3.5 rounded-xl outline-none focus:border-emerald-500 font-bold" placeholder="الاسم الرباعي للمالك" />
                            <input required type="tel" value={formData.owner_phone} onChange={e => setFormData({...formData, owner_phone: e.target.value})} className="w-full bg-slate-50 border border-slate-200 px-5 py-3.5 rounded-xl outline-none focus:border-emerald-500 font-bold" placeholder="رقم الجوال" />
                            <label className="flex items-start gap-3 cursor-pointer">
                                <input required type="checkbox" checked={formData.agreed} onChange={e => setFormData({...formData, agreed: e.target.checked})} className="mt-1 w-5 h-5 accent-emerald-500" />
                                <span className="text-xs font-bold text-slate-500 leading-relaxed">أقر بأنني عاينت الوحدة وهي مطابقة للمواصفات وأستلمها رسمياً ويبدأ الضمان.</span>
                            </label>
                            <button type="submit" disabled={saving || !formData.agreed} className="w-full bg-emerald-500 text-white py-4 rounded-xl font-black text-lg hover:bg-emerald-600 transition shadow-xl mt-4 flex justify-center items-center gap-2">{saving ? <Loader2 className="animate-spin" size={20}/> : <UserCheck size={20}/>} توقيع واستلام الوحدة</button>
                        </form>
                    </div>
                )}

                {isAllAnswered && progressScore < 100 && (
                    <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-orange-200 animate-fade-in-up text-center">
                        <FileWarning className="text-orange-500 mx-auto mb-4" size={40} />
                        <h3 className="text-lg font-black text-[#1a365d] mb-2">إرسال الملاحظات</h3>
                        <p className="text-sm font-bold text-slate-500 mb-6">سيتم إرسالها كتقرير (Snag List) لفريق الصيانة.</p>
                        <button onClick={submitInspection} disabled={saving} className="w-full bg-orange-500 text-white py-4 rounded-xl font-black text-lg hover:bg-orange-600 transition shadow-xl flex justify-center items-center gap-2">{saving ? <Loader2 className="animate-spin" size={20}/> : <Send size={20}/>} رفع التقرير للإدارة</button>
                    </div>
                )}

            </div>
        </div>
    );
}