import React, { useState, useEffect } from 'react';
import { AlertTriangle, Printer, Building, RefreshCw, FileWarning, Search, ChevronDown, Wrench, X, CheckCircle } from 'lucide-react';

const API_URL = "https://semak.sa/api.php";

export default function SnagList() {
    const [loading, setLoading] = useState(true);
    const [snagUnits, setSnagUnits] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [expandedUnit, setExpandedUnit] = useState(null);
    const [printData, setPrintData] = useState(null);

    useEffect(() => {
        fetchSnags();
    }, []);

    const fetchSnags = async () => {
        setLoading(true);
        try {
            const [projRes, tasksRes] = await Promise.all([
                fetch(`${API_URL}?action=get_projects_data`),
                fetch(`${API_URL}?action=get_all_inspections`)
            ]);
            const projData = await projRes.json();
            const tasksData = await tasksRes.json();

            if (tasksData.success && projData.success) {
                const processedData = [];
                
                tasksData.data.forEach(task => {
                    if (parseInt(task.progress) === 100) return; 
                    
                    try {
                        const data = JSON.parse(task.inspection_data);
                        const snags = [];
                        
                        Object.keys(data).forEach(key => {
                            if (data[key].passed === false) {
                                const parts = key.split('_');
                                if(parts.length >= 3) {
                                    const space = parts[0];
                                    const cat = parts[1];
                                    const item = parts.slice(2).join('_');
                                    snags.push({ space, cat, item, note: data[key].notes });
                                }
                            }
                        });

                        if (snags.length > 0) {
                            const projName = projData.data.find(p => p.units_details?.some(u => u.unit_code === task.unit))?.name || "مشروع غير محدد";
                            
                            const groupedByCategory = snags.reduce((acc, snag) => {
                                if (!acc[snag.cat]) acc[snag.cat] = [];
                                acc[snag.cat].push(snag);
                                return acc;
                            }, {});

                            processedData.push({
                                unit: task.unit,
                                project: projName,
                                progress: task.progress,
                                totalSnags: snags.length,
                                categories: Object.entries(groupedByCategory)
                            });
                        }
                    } catch (e) {}
                });
                
                setSnagUnits(processedData);
            }
        } catch (e) {} finally {
            setLoading(false);
        }
    };

    const handlePrint = (unitData) => {
        setPrintData(unitData);
        setTimeout(() => {
            window.print();
            setPrintData(null);
        }, 300);
    };

    const filteredUnits = snagUnits.filter(u => u.unit.toLowerCase().includes(searchTerm.toLowerCase()) || u.project.includes(searchTerm));

    return (
        <div className="animate-fadeIn relative">
            
            {/* 🖨️ شاشة الطباعة */}
            {printData && (
                <div className="fixed inset-0 bg-white z-[9999] p-10 print-only text-right" dir="rtl">
                    <div className="border-b-2 border-slate-800 pb-6 mb-8 flex justify-between items-end">
                        <div>
                            <h1 className="text-3xl font-black mb-2">تقرير ملاحظات الوحدة (Snag List)</h1>
                            <p className="text-lg font-bold text-slate-600">رقم الوحدة: {printData.unit} | المشروع: {printData.project}</p>
                        </div>
                        <div className="text-left">
                            <p className="font-bold">تاريخ التقرير: {new Date().toLocaleDateString('ar-SA')}</p>
                            <p className="font-bold text-red-600">إجمالي الملاحظات: {printData.totalSnags}</p>
                        </div>
                    </div>

                    <div className="space-y-8">
                        {printData.categories.map(([catName, snags], idx) => (
                            <div key={idx} className="break-inside-avoid">
                                <h3 className="text-xl font-black text-slate-800 mb-4 pb-2 border-b border-slate-300">{catName}</h3>
                                <table className="w-full border-collapse border border-slate-300">
                                    <thead>
                                        <tr className="bg-slate-100"><th className="border border-slate-300 p-3 w-1/4">الفراغ</th><th className="border border-slate-300 p-3 w-1/3">البند</th><th className="border border-slate-300 p-3">الملاحظة (العيوب)</th></tr>
                                    </thead>
                                    <tbody>
                                        {snags.map((snag, sIdx) => (
                                            <tr key={sIdx}>
                                                <td className="border border-slate-300 p-3 font-bold">{snag.space}</td>
                                                <td className="border border-slate-300 p-3">{snag.item}</td>
                                                <td className="border border-slate-300 p-3 text-red-600 font-bold">{snag.note || 'بدون تفاصيل'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* 🖥️ واجهة الداش بورد */}
            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-2xl font-black text-[#1a365d] flex items-center gap-3"><FileWarning className="text-orange-500" size={28} /> مركز تقارير السناق ليست</h1>
                    <p className="text-slate-500 font-bold text-sm mt-1">الوحدات التي تحتوي على ملاحظات وتحتاج صيانة من المقاول</p>
                </div>
                <div className="relative w-full md:w-auto">
                    <input type="text" placeholder="ابحث برقم الوحدة..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="w-full md:w-72 bg-slate-50 border border-slate-200 pl-10 pr-4 py-3 rounded-xl outline-none focus:border-orange-400 font-bold text-sm" />
                    <Search className="absolute left-3 top-3.5 text-slate-400" size={18} />
                </div>
            </div>

            {loading ? (
                <div className="text-center py-20"><RefreshCw className="animate-spin mx-auto text-orange-500 mb-4" size={40} /><p className="text-slate-500 font-bold">جاري تجميع التقارير...</p></div>
            ) : filteredUnits.length === 0 ? (
                <div className="bg-emerald-50 border border-emerald-100 rounded-[2rem] p-10 text-center">
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={40}/></div>
                    <h2 className="text-2xl font-black text-emerald-800 mb-2">ممتاز! الشغل نظيف</h2>
                    <p className="text-emerald-600 font-bold">لا توجد أي وحدات معلقة بملاحظات (Snag List) في الوقت الحالي.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {filteredUnits.map((unitData, index) => {
                        return (
                            <div key={index} className="bg-white rounded-[2rem] shadow-sm border border-red-100 overflow-hidden hover:shadow-md transition">
                                <div className="p-6 bg-red-50/30 border-b border-red-50 flex justify-between items-start">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="text-2xl font-black text-[#1a365d]">{unitData.unit}</h3>
                                            <span className="bg-red-100 text-red-600 px-3 py-1 rounded-lg text-xs font-black flex items-center gap-1"><AlertTriangle size={14}/> {unitData.totalSnags} أخطاء</span>
                                        </div>
                                        <p className="text-slate-500 font-bold text-sm flex items-center gap-1"><Building size={14}/> {unitData.project}</p>
                                    </div>
                                    <button onClick={() => handlePrint(unitData)} className="p-3 bg-white text-[#1a365d] hover:text-white hover:bg-[#1a365d] border border-slate-200 rounded-xl transition shadow-sm" title="طباعة للمقاول"><Printer size={20}/></button>
                                </div>

                                <div className="p-6">
                                    <div className="space-y-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                                        {unitData.categories.map(([catName, snags], cIdx) => (
                                            <div key={cIdx} className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden">
                                                <div className="bg-slate-100 px-4 py-2 font-black text-[#1a365d] text-sm flex justify-between">
                                                    {catName} <span className="bg-white px-2 py-0.5 rounded text-xs text-slate-500 border border-slate-200">{snags.length}</span>
                                                </div>
                                                <div className="p-4 space-y-3">
                                                    {snags.map((snag, sIdx) => (
                                                        <div key={sIdx} className="flex flex-col gap-1 border-b border-slate-100 last:border-0 pb-2 last:pb-0">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-xs font-black bg-orange-100 text-orange-700 px-2 py-1 rounded">{snag.space}</span>
                                                                <span className="text-xs font-bold text-slate-500">{snag.item}</span>
                                                            </div>
                                                            <p className="text-sm font-bold text-red-600 mt-1">"{snag.note || 'لا يوجد تفاصيل'}"</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <style jsx>{`
                @media print {
                    body * { visibility: hidden; }
                    .print-only, .print-only * { visibility: visible; }
                    .print-only { position: absolute; left: 0; top: 0; width: 100%; height: 100%; background: white; padding: 20px; }
                }
            `}</style>
        </div>
    );
}