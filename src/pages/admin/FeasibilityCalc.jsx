import React, { useState, useEffect } from 'react';
import { Calculator, Save, RefreshCw, Plus, Trash2, Users, FileSpreadsheet, Presentation } from 'lucide-react';
import { API_URL, getImg } from '../../utils/helpers';

export default function FeasibilityCalc({ showToast }) {
    const [loading, setLoading] = useState(false);
    const [savedProjects, setSavedProjects] = useState([]);
    const [currentProjectId, setCurrentProjectId] = useState("");
    const [projectName, setProjectName] = useState("");

    // خيارات التصدير والطباعة
    const [printMode, setPrintMode] = useState("all");
    const [selectedInvestorIndex, setSelectedInvestorIndex] = useState(0);
    const [showDevInPrint, setShowDevInPrint] = useState(true);

    const [inputs, setInputs] = useState({
        archLandArea: 1139.35, archCommonArea: 60, archFloorsCount: 2, archRoofPct: 50,
        archGroundPct: 65, uGround: 4, archTypicalPct: 75, uTypical: 5, uRoof: 3,
        finSellPrice: 3170, finBuildCost: 1800, inServiceCostPerUnit: 17000, finLandPrice: 1837201,
        sWafi: 50000, sEng: 95000, sMunicipality: 40000, sSupervision: 80000, sAcc: 99000, sOther: 10000,
        sInsurancePct: 1, sTestingPct: 0.5, inInvBonusPct: 0, sMarkPct: 2.5, sDuration: 18
    });

    const [investors, setInvestors] = useState([{ name: "الشريك الاستراتيجي", amount: 1837201 }]);

    const handleChange = (e) => {
        setInputs({ ...inputs, [e.target.name]: parseFloat(e.target.value) || 0 });
    };

    const handleInvestorChange = (index, field, value) => {
        const newInvestors = [...investors];
        newInvestors[index][field] = field === 'amount' ? (parseFloat(value) || 0) : value;
        setInvestors(newInvestors);
    };

    const addInvestorRow = () => setInvestors([...investors, { name: "", amount: 0 }]);
    const removeInvestor = (index) => setInvestors(investors.filter((_, i) => i !== index));
    const formatMoney = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n || 0);

    // --- العمليات الحسابية الشاملة ---
    const groundBuilt = inputs.archLandArea * (inputs.archGroundPct / 100);
    const typicalBuilt = inputs.archLandArea * (inputs.archTypicalPct / 100);
    const roofBuilt = typicalBuilt * (inputs.archRoofPct / 100);
    const totalBuilt = groundBuilt + (typicalBuilt * inputs.archFloorsCount) + roofBuilt;
    const floorCountTotal = 1 + inputs.archFloorsCount + (roofBuilt > 0 ? 1 : 0);
    const totalNet = Math.max(0, totalBuilt - (inputs.archCommonArea * floorCountTotal));
    const totalUnits = inputs.uGround + (inputs.uTypical * inputs.archFloorsCount) + inputs.uRoof;

    const floorsData = [];
    if (groundBuilt > 0) floorsData.push({ label: "الدور الأرضي", built: groundBuilt, net: Math.max(0, groundBuilt - inputs.archCommonArea), units: inputs.uGround });
    if (typicalBuilt > 0 && inputs.archFloorsCount > 0) {
        for(let i=1; i<=inputs.archFloorsCount; i++) floorsData.push({ label: `متكرر ${i}`, built: typicalBuilt, net: Math.max(0, typicalBuilt - inputs.archCommonArea), units: inputs.uTypical });
    }
    if (roofBuilt > 0) floorsData.push({ label: "الملحق (الروف)", built: roofBuilt, net: Math.max(0, roofBuilt - inputs.archCommonArea), units: inputs.uRoof });

    const totalSales = totalNet * inputs.finSellPrice;
    const marketingCost = totalSales * (inputs.sMarkPct / 100);
    const buildCost = (totalNet * inputs.finBuildCost) + (totalUnits * inputs.inServiceCostPerUnit);
    const insCost = buildCost * (inputs.sInsurancePct / 100);
    const testCost = buildCost * (inputs.sTestingPct / 100);
    const softCosts = inputs.sWafi + inputs.sEng + inputs.sMunicipality + inputs.sSupervision + inputs.sAcc + inputs.sOther + insCost + testCost;

    const totalProjectCosts = inputs.finLandPrice + buildCost + softCosts + marketingCost;
    const netProfit = totalSales - totalProjectCosts;

    const investorCapitalPool = inputs.finLandPrice + softCosts;
    const baseInvPct = totalProjectCosts > 0 ? (investorCapitalPool / totalProjectCosts) * 100 : 0;
    const finalInvPct = Math.min(100, Math.max(0, baseInvPct + inputs.inInvBonusPct));
    const finalDevPct = 100 - finalInvPct;

    const invProfitPool = netProfit * (finalInvPct / 100);
    const devProfit = netProfit * (finalDevPct / 100);

    const overAllROI = investorCapitalPool > 0 ? (invProfitPool / investorCapitalPool) * 100 : 0;
    const annualROI = inputs.sDuration > 0 ? overAllROI / (inputs.sDuration / 12) : 0;

    const landCostPerSqm = totalNet > 0 ? (inputs.finLandPrice / totalNet) : 0;
    const totalCostPerSqm = totalNet > 0 ? (totalProjectCosts / totalNet) : 0;

    const totalInvestedVal = investors.reduce((sum, inv) => sum + inv.amount, 0);
    const totalInvestedPct = investorCapitalPool > 0 ? (totalInvestedVal / investorCapitalPool) * 100 : 0;
    const totalInvestedProfit = invProfitPool * (totalInvestedPct / 100);

    // --- الاتصال بالسحابة ---
    useEffect(() => { loadProjectsList(); }, []);

    const loadProjectsList = async () => {
        try {
            const res = await fetch(`${API_URL}?action=get_feasibilities`);
            const data = await res.json();
            if(data.success) setSavedProjects(data.data);
        } catch(e) {}
    };

    const handleSaveCloud = async () => {
        if(!projectName.trim()) {
            if(showToast) showToast("تنبيه", "يرجى كتابة اسم المشروع", "error"); else alert("يرجى كتابة اسم المشروع");
            return;
        }
        setLoading(true);
        const payload = { id: currentProjectId || null, project_name: projectName, data: { inputs, investors } };
        try {
            const res = await fetch(`${API_URL}?action=save_feasibility`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
            });
            const data = await res.json();
            if(data.success) {
                if(showToast) showToast("نجاح", "تم حفظ المشروع في السحابة!"); else alert("تم الحفظ بنجاح");
                setCurrentProjectId(data.id);
                loadProjectsList();
            }
        } catch(e) { } finally { setLoading(false); }
    };

    const handleLoadCloud = async (id) => {
        if(!id) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}?action=get_feasibility_data&id=${id}`);
            const textRes = await res.text();
            const data = JSON.parse(textRes);
            if(data.success) {
                let parsedData = typeof data.data === 'string' ? JSON.parse(data.data) : data.data;
                if (parsedData && parsedData.inputs) {
                    setInputs(prev => ({ ...prev, ...parsedData.inputs }));
                    if(parsedData.investors) setInvestors(parsedData.investors);
                    setCurrentProjectId(id);
                    setProjectName(savedProjects.find(p=>p.id==id)?.project_name || "");
                    if(showToast) showToast("نجاح", "تم استدعاء بيانات المشروع");
                }
            }
        } catch(e) {} finally { setLoading(false); }
    };

    // =======================================================
    // 🔥 دالة استخراج الـ PDF الذكية (تعمل في نافذة منفصلة)
    // =======================================================
    const exportToPDF = (type) => {
        // سحب كود الـ HTML الخاص بالقالب المخفي
        const templateId = type === 'teaser' ? 'pdf-teaser-template' : 'pdf-detailed-template';
        const content = document.getElementById(templateId).innerHTML;
        
        // فتح نافذة جديدة نظيفة 100%
        const win = window.open('', '_blank');
        
        // رسم هيكل صفحة الـ PDF ودمج التصميمات والألوان
        win.document.write(`
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>تصدير تقرير - ${projectName || 'سماك العقارية'}</title>
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    body { 
                        font-family: 'Cairo', sans-serif; 
                        background: white; 
                        -webkit-print-color-adjust: exact; 
                        color-adjust: exact; 
                        margin: 0; 
                        padding: 0; 
                    }
                    @page { size: A4 portrait; margin: 0; }
                    /* إعداد الورقة للطباعة أو الـ PDF بشكل مثالي */
                    .page-container {
                        width: 210mm;
                        height: 296mm;
                        margin: 0 auto;
                        padding: 40px;
                        display: flex;
                        flex-direction: column;
                        justify-content: space-between;
                        background: white;
                    }
                </style>
            </head>
            <body>
                <div class="page-container">
                    ${content}
                </div>
                <script>
                    // الانتظار ثانية واحدة لتكتمل تحميل الخطوط والالوان ثم تظهر شاشة الحفظ PDF
                    window.onload = () => {
                        setTimeout(() => {
                            window.print();
                        }, 1000);
                    };
                </script>
            </body>
            </html>
        `);
        win.document.close();
    };

    // =======================================================
    // واجهة الحاسبة الطبيعية (UI)
    // =======================================================
    return (
        <div className="animate-fadeIn pb-10 font-cairo" dir="rtl">
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 mb-8 flex flex-col md:flex-row items-end gap-4">
                <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-[#1a365d] mb-2">اسم المشروع الحالي</label>
                    <input type="text" value={projectName} onChange={e=>setProjectName(e.target.value)} placeholder="مثال: مشروع سماك الصفوة 3..." className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-[#1a365d] outline-none focus:border-[#c5a059] transition" />
                </div>
                <button onClick={handleSaveCloud} disabled={loading} className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700 transition flex items-center gap-2 shadow-md w-full md:w-auto justify-center">
                    {loading ? <RefreshCw size={18} className="animate-spin"/> : <Save size={18}/>} حفظ سحابياً
                </button>
                <div className="w-px bg-slate-200 hidden md:block h-12 mx-2"></div>
                <div className="flex-1 w-full flex items-end gap-2">
                    <div className="w-full">
                        <label className="block text-xs font-bold text-slate-500 mb-2">المشاريع المحفوظة</label>
                        <select onChange={(e) => handleLoadCloud(e.target.value)} value={currentProjectId} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-[#1a365d] outline-none cursor-pointer focus:border-[#c5a059]">
                            <option value="">-- اختر مشروعاً لاستدعائه --</option>
                            {savedProjects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                        </select>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                <div className="xl:col-span-8 space-y-8">
                    
                    {/* 1. المعماري */}
                    <div className="bg-white rounded-3xl shadow-md border border-slate-200 overflow-hidden">
                        <div className="bg-indigo-900 p-4 text-white flex items-center gap-3">
                            <Calculator className="text-[#c5a059]" /> <h2 className="text-lg font-black">1. الموجه المعماري (توزيع المساحات)</h2>
                        </div>
                        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4 bg-white border-b border-slate-100">
                            <div><label className="text-[10px] font-bold block mb-1 text-slate-600">مساحة الأرض (م²)</label><input type="number" name="archLandArea" value={inputs.archLandArea} onChange={handleChange} className="w-full p-2.5 rounded-lg border border-slate-200 focus:border-[#c5a059] outline-none bg-slate-50 font-bold" /></div>
                            <div><label className="text-[10px] font-bold block mb-1 text-slate-600">مساحة الخدمات (م²)</label><input type="number" name="archCommonArea" value={inputs.archCommonArea} onChange={handleChange} className="w-full p-2.5 rounded-lg border border-slate-200 focus:border-[#c5a059] outline-none bg-slate-50 font-bold" /></div>
                            <div><label className="text-[10px] font-bold block mb-1 text-slate-600">الأدوار المتكررة</label><input type="number" name="archFloorsCount" value={inputs.archFloorsCount} onChange={handleChange} className="w-full p-2.5 rounded-lg border border-slate-200 focus:border-[#c5a059] outline-none bg-slate-50 font-bold" /></div>
                            <div><label className="text-[10px] font-bold block mb-1 text-slate-600">نسبة الملحق %</label><input type="number" name="archRoofPct" value={inputs.archRoofPct} onChange={handleChange} className="w-full p-2.5 rounded-lg border border-slate-200 focus:border-[#c5a059] outline-none bg-slate-50 font-bold" /></div>
                        </div>
                        <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="border border-slate-100 p-3 rounded-xl bg-slate-50"><label className="text-xs text-slate-500 block mb-1">بناء الأرضي %</label><input type="number" name="archGroundPct" value={inputs.archGroundPct} onChange={handleChange} className="w-full border border-slate-200 rounded px-2 py-1 mb-2 outline-none font-bold" /><label className="text-xs text-[#c5a059] font-bold block mb-1">وحدات الأرضي</label><input type="number" name="uGround" value={inputs.uGround} onChange={handleChange} className="w-full font-black text-[#1a365d] border border-slate-200 rounded px-2 py-1 outline-none" /></div>
                            <div className="border border-slate-100 p-3 rounded-xl bg-slate-50"><label className="text-xs text-slate-500 block mb-1">بناء المتكرر %</label><input type="number" name="archTypicalPct" value={inputs.archTypicalPct} onChange={handleChange} className="w-full border border-slate-200 rounded px-2 py-1 mb-2 outline-none font-bold" /><label className="text-xs text-[#c5a059] font-bold block mb-1">وحدات المتكرر</label><input type="number" name="uTypical" value={inputs.uTypical} onChange={handleChange} className="w-full font-black text-[#1a365d] border border-slate-200 rounded px-2 py-1 outline-none" /></div>
                            <div className="border border-slate-100 p-3 rounded-xl bg-slate-50 flex flex-col justify-end"><label className="text-xs text-[#c5a059] font-bold block mb-2">وحدات الملحق (الروف)</label><input type="number" name="uRoof" value={inputs.uRoof} onChange={handleChange} className="w-full font-black text-[#1a365d] border border-slate-200 rounded px-2 py-1 outline-none" /></div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-right text-xs border-t border-slate-200">
                                <thead className="bg-slate-100">
                                    <tr className="text-slate-600 font-bold">
                                        <th className="py-3 px-4">الدور</th>
                                        <th className="py-3 px-4 text-center">إجمالي البناء</th>
                                        <th className="py-3 px-4 text-center">المساحة الصافية للبيع</th>
                                        <th className="py-3 px-4 text-center">عدد الوحدات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {floorsData.map((floor, i) => (
                                        <tr key={i} className="border-b border-slate-50">
                                            <td className="py-3 px-4 font-bold text-[#1a365d]">{floor.label}</td>
                                            <td className="py-3 px-4 text-center" dir="ltr">{floor.built.toFixed(1)} m²</td>
                                            <td className="py-3 px-4 text-center font-bold text-emerald-600" dir="ltr">{floor.net.toFixed(1)} m²</td>
                                            <td className="py-3 px-4 text-center font-black">{floor.units}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-indigo-50 border-t-2 border-indigo-100 font-black text-indigo-900">
                                    <tr>
                                        <td className="py-3 px-4">الإجمالي الكلي</td>
                                        <td className="py-3 px-4 text-center" dir="ltr">{totalBuilt.toFixed(1)} m²</td>
                                        <td className="py-3 px-4 text-center text-emerald-700" dir="ltr">{totalNet.toFixed(1)} m²</td>
                                        <td className="py-3 px-4 text-center">{totalUnits}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* 2. المالي بالتصميم الجديد (الكحلي والذهبي) */}
                    <div className="bg-white rounded-3xl shadow-md border border-slate-200 p-6 md:p-8">
                        <h2 className="text-xl font-black text-[#1a365d] mb-8 border-b border-slate-100 pb-4 flex items-center gap-2">
                            <Calculator className="text-[#c5a059]" /> 2. التكاليف والاتفاقية الشاملة
                        </h2>
                        
                        <div className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                    <label className="block text-xs font-bold text-slate-500 mb-2">سعر بيع المتر المستهدف</label>
                                    <input type="number" name="finSellPrice" value={inputs.finSellPrice} onChange={handleChange} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-[#c5a059] text-base font-black text-[#1a365d] transition bg-white" />
                                </div>
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                    <label className="block text-xs font-bold text-slate-500 mb-2">تكلفة بناء المتر</label>
                                    <input type="number" name="finBuildCost" value={inputs.finBuildCost} onChange={handleChange} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-[#c5a059] text-base font-black text-[#1a365d] transition bg-white" />
                                </div>
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                    <label className="block text-xs font-bold text-slate-500 mb-2">إدخال خدمات للوحدة</label>
                                    <input type="number" name="inServiceCostPerUnit" value={inputs.inServiceCostPerUnit} onChange={handleChange} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-[#c5a059] text-base font-black text-[#1a365d] transition bg-white" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                    <label className="block text-xs font-bold text-slate-500 mb-2">قيمة الأرض الإجمالية</label>
                                    <input type="number" name="finLandPrice" value={inputs.finLandPrice} onChange={handleChange} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-[#c5a059] text-base font-black text-[#1a365d] transition bg-white" />
                                </div>
                                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100">
                                    <label className="block text-xs font-bold text-slate-500 mb-2">مدة المشروع (أشهر)</label>
                                    <input type="number" name="sDuration" value={inputs.sDuration} onChange={handleChange} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-[#c5a059] text-base font-black text-[#c5a059] transition bg-white" />
                                </div>
                            </div>

                            <div className="bg-[#1a365d]/5 p-6 md:p-8 rounded-3xl border border-[#1a365d]/10">
                                <h3 className="text-sm font-black text-[#1a365d] mb-6">المصاريف الإدارية والتأسيس والرخص</h3>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                                    <div><label className="text-xs font-bold text-[#1a365d] block mb-2">رخصة وافي</label><input type="number" name="sWafi" value={inputs.sWafi} onChange={handleChange} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-[#c5a059] text-sm font-bold text-[#1a365d] bg-white shadow-sm" /></div>
                                    <div><label className="text-xs font-bold text-[#1a365d] block mb-2">المكتب الهندسي</label><input type="number" name="sEng" value={inputs.sEng} onChange={handleChange} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-[#c5a059] text-sm font-bold text-[#1a365d] bg-white shadow-sm" /></div>
                                    <div><label className="text-xs font-bold text-[#1a365d] block mb-2">رخصة البلدية</label><input type="number" name="sMunicipality" value={inputs.sMunicipality} onChange={handleChange} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-[#c5a059] text-sm font-bold text-[#1a365d] bg-white shadow-sm" /></div>
                                    <div><label className="text-xs font-bold text-[#1a365d] block mb-2">مكتب مشرف</label><input type="number" name="sSupervision" value={inputs.sSupervision} onChange={handleChange} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-[#c5a059] text-sm font-bold text-[#1a365d] bg-white shadow-sm" /></div>
                                    <div><label className="text-xs font-bold text-[#1a365d] block mb-2">محاسب قانوني</label><input type="number" name="sAcc" value={inputs.sAcc} onChange={handleChange} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-[#c5a059] text-sm font-bold text-[#1a365d] bg-white shadow-sm" /></div>
                                    <div><label className="text-xs font-bold text-[#1a365d] block mb-2">مصاريف أخرى</label><input type="number" name="sOther" value={inputs.sOther} onChange={handleChange} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-[#c5a059] text-sm font-bold text-[#1a365d] bg-white shadow-sm" /></div>
                                    <div className="md:col-span-1 pt-4"><label className="text-xs font-bold text-[#1a365d] block mb-2">تأمين (% من بناء)</label><input type="number" name="sInsurancePct" value={inputs.sInsurancePct} onChange={handleChange} step="0.1" className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-[#c5a059] text-sm font-bold text-[#1a365d] bg-white shadow-sm" /></div>
                                    <div className="md:col-span-1 pt-4"><label className="text-xs font-bold text-[#1a365d] block mb-2">فحص (% من بناء)</label><input type="number" name="sTestingPct" value={inputs.sTestingPct} onChange={handleChange} step="0.1" className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-[#c5a059] text-sm font-bold text-[#1a365d] bg-white shadow-sm" /></div>
                                </div>
                            </div>

                            <div className="bg-gradient-to-r from-[#1a365d] to-[#0f172a] p-6 md:p-8 rounded-3xl flex flex-col md:flex-row items-center gap-6 shadow-xl relative overflow-hidden">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl pointer-events-none"></div>
                                <div className="flex-1 w-full grid grid-cols-2 gap-4 relative z-10">
                                    <div className="bg-white/10 p-5 rounded-2xl border border-white/10 backdrop-blur-sm">
                                        <label className="text-xs font-bold text-slate-300 block mb-2">علاوة لنسبة المستثمر %</label>
                                        <input type="number" name="inInvBonusPct" value={inputs.inInvBonusPct} onChange={handleChange} className="w-full p-3 rounded-xl border-none font-black text-white outline-none bg-white/10 focus:bg-white/20 transition text-center" />
                                    </div>
                                    <div className="bg-white/10 p-5 rounded-2xl border border-white/10 backdrop-blur-sm">
                                        <label className="text-xs font-bold text-slate-300 block mb-2">السعي والتسويق %</label>
                                        <input type="number" name="sMarkPct" value={inputs.sMarkPct} onChange={handleChange} step="0.1" className="w-full p-3 rounded-xl border-none font-black text-[#c5a059] outline-none bg-white/10 focus:bg-white/20 transition text-center" />
                                    </div>
                                </div>
                                <div className="w-full md:w-64 text-center bg-white p-6 rounded-2xl shadow-inner border-4 border-[#c5a059] relative z-10 transform md:scale-105">
                                    <span className="block text-xs font-bold text-slate-500 mb-1">حصة المستثمرين الإجمالية</span>
                                    <span className="text-4xl font-black text-[#1a365d]">{finalInvPct.toFixed(1)}%</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. قائمة المستثمرين */}
                    <div className="bg-white rounded-3xl shadow-md border border-slate-200 p-6">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                            <h2 className="text-xl font-black text-[#1a365d] flex items-center gap-2"><Users className="text-[#c5a059]"/>3. قائمة المستثمرين</h2>
                            <button onClick={addInvestorRow} className="bg-[#1a365d] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-blue-900 transition flex items-center gap-1 shadow-sm"><Plus size={14}/> إضافة مستثمر</button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-right text-sm">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr className="text-slate-600">
                                        <th className="p-3">اسم المستثمر</th><th className="p-3">المبلغ المستثمر (SAR)</th><th className="p-3 text-center">نسبة الإسهام</th><th className="p-3 text-center">الربح المتوقع</th><th className="p-3 text-center">إجراء</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {investors.map((inv, i) => {
                                        const pct = investorCapitalPool > 0 ? (inv.amount / investorCapitalPool) * 100 : 0;
                                        const prof = invProfitPool * (pct / 100);
                                        return (
                                            <tr key={i} className="hover:bg-slate-50 transition">
                                                <td className="p-2"><input type="text" value={inv.name} onChange={e=>handleInvestorChange(i, 'name', e.target.value)} className="border border-slate-200 p-2 rounded-lg w-full text-sm outline-none focus:border-[#c5a059]" placeholder="اسم المستثمر..." /></td>
                                                <td className="p-2"><input type="number" value={inv.amount} onChange={e=>handleInvestorChange(i, 'amount', e.target.value)} className="border border-slate-200 p-2 rounded-lg w-full text-sm font-black text-[#1a365d] outline-none focus:border-[#c5a059]" /></td>
                                                <td className="p-2 text-center text-xs font-bold text-slate-500 bg-slate-50/50">{pct.toFixed(1)}%</td>
                                                <td className="p-2 text-emerald-600 font-black text-center">{formatMoney(prof)}</td>
                                                <td className="p-2 text-center"><button onClick={() => removeInvestor(i)} className="text-red-400 hover:text-red-600 hover:bg-red-50 bg-white border border-slate-200 p-1.5 rounded-lg shadow-sm transition"><Trash2 size={16}/></button></td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                                <tfoot className="bg-slate-50 font-black border-t-2 border-slate-200">
                                    <tr>
                                        <td className="p-3 text-[#1a365d]">الإجمالي المجمع</td>
                                        <td className="p-3 text-[#1a365d]">{formatMoney(totalInvestedVal)}</td>
                                        <td className="p-3 text-center text-slate-500">{totalInvestedPct.toFixed(1)}%</td>
                                        <td className="p-3 text-center text-emerald-600">{formatMoney(totalInvestedProfit)}</td>
                                        <td className="p-3 text-center text-[10px] text-slate-400 font-normal">تأكد من المطابقة</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="xl:col-span-4 space-y-6">
                    <div className="bg-[#1a365d] text-white rounded-3xl shadow-xl p-6 border-b-8 border-[#c5a059] relative overflow-hidden">
                         <div className="absolute -right-4 -top-4 opacity-5"><Presentation className="w-32 h-32"/></div>
                         <h3 className="text-base font-black text-[#c5a059] mb-6 border-b border-white/10 pb-3 relative z-10">ملخص اقتصاديات المشروع</h3>
                         
                         <div className="grid grid-cols-2 gap-3 mb-6 bg-white/5 p-3 rounded-xl border border-white/10 relative z-10">
                            <div className="text-center">
                                <span className="block text-[9px] text-slate-400 mb-1">تكلفة الأرض للمتر المباع</span>
                                <span className="text-sm font-black text-white">{formatMoney(landCostPerSqm)}</span>
                            </div>
                            <div className="text-center border-r border-white/10">
                                <span className="block text-[9px] text-slate-400 mb-1">التكلفة الكلية للمتر المباع</span>
                                <span className="text-sm font-black text-red-300">{formatMoney(totalCostPerSqm)}</span>
                            </div>
                         </div>

                         <div className="space-y-3 text-sm font-bold relative z-10">
                             <div className="flex justify-between border-b border-white/5 pb-2"><span>إجمالي المبيعات</span> <span className="text-emerald-400 font-black">{formatMoney(totalSales)}</span></div>
                             <div className="flex justify-between border-b border-white/5 pb-2"><span>تكلفة البناء</span> <span className="text-red-300 font-black">{formatMoney(buildCost)}</span></div>
                             <div className="flex justify-between border-b border-white/5 pb-2"><span>التأسيس والرخص</span> <span className="text-red-300 font-black">{formatMoney(softCosts)}</span></div>
                             <div className="flex justify-between border-b border-white/5 pb-2"><span>السعي والتسويق</span> <span className="text-orange-400 font-black">{formatMoney(marketingCost)}</span></div>
                             <div className="flex justify-between pt-2"><span>رأس المال (الأرض+التأسيس)</span> <span className="text-white font-black">{formatMoney(investorCapitalPool)}</span></div>
                             <div className="flex justify-between pt-2 border-t border-white/20 text-lg"><span>صافي الربح الكلي</span> <span className="text-emerald-400 font-black">{formatMoney(netProfit)}</span></div>
                         </div>

                         <div className="grid grid-cols-2 gap-3 mt-6 relative z-10">
                             <div className="bg-white/5 p-3 rounded-2xl text-center border border-white/10">
                                 <span className="block text-[10px] text-slate-400 mb-1">إجمالي ربح المستثمرين</span>
                                 <span className="text-base font-black text-[#c5a059]">{formatMoney(invProfitPool)}</span>
                             </div>
                             <div className="bg-white/5 p-3 rounded-2xl text-center border border-white/10">
                                 <span className="block text-[10px] text-slate-300 mb-1">صافي ربح المطور</span>
                                 <span className="text-base font-black text-white">{formatMoney(devProfit)}</span>
                             </div>
                         </div>
                    </div>

                    <div className="bg-white p-6 rounded-[2rem] shadow-md border border-slate-200">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <span className="block text-sm font-bold text-slate-500">العائد الإجمالي (ROI)</span>
                                <span className="text-4xl font-black text-[#1a365d] mt-1 block">{overAllROI.toFixed(1)}%</span>
                            </div>
                            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-black text-xl border border-emerald-100">%</div>
                        </div>
                        <div className="space-y-4 border-t border-slate-100 pt-5">
                            <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-500">العائد السنوي:</span><span className="text-sm font-black text-emerald-600">{annualROI.toFixed(1)}%</span></div>
                            <div className="flex justify-between items-center"><span className="text-xs font-bold text-slate-500">إجمالي الاسترداد المستهدف:</span><span className="text-sm font-black text-[#1a365d]">SAR {formatMoney(investorCapitalPool + invProfitPool)}</span></div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-[2rem] shadow-md border border-slate-200">
                        <label className="block text-sm font-black text-[#1a365d] mb-4 border-b border-slate-100 pb-3">خيارات العروض والطباعة</label>
                        
                        <div className="mb-4">
                            <label className="block text-[11px] font-bold text-slate-500 mb-2">طريقة عرض المستثمرين في التقرير:</label>
                            <select value={printMode} onChange={e=>setPrintMode(e.target.value)} className="w-full p-3 border border-slate-200 rounded-xl mb-2 text-sm font-bold bg-slate-50 text-navy outline-none focus:border-[#c5a059]">
                                <option value="all">إظهار كافة المستثمرين (قائمة مفصلة)</option>
                                <option value="summary">إظهار الإجمالي فقط (ملخص بدون أسماء)</option>
                                <option value="single">تخصيص التقرير لمستثمر محدد</option>
                            </select>
                            
                            {printMode === 'single' && (
                                <select value={selectedInvestorIndex} onChange={e=>setSelectedInvestorIndex(e.target.value)} className="w-full p-3 border border-[#c5a059] rounded-xl mb-2 text-sm font-black bg-orange-50 text-orange-800 outline-none">
                                    {investors.map((inv, i) => <option key={i} value={i}>{inv.name || `مستثمر ${i+1}`}</option>)}
                                </select>
                            )}
                        </div>

                        <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 mb-6 cursor-pointer">
                            <input type="checkbox" id="devToggle" checked={showDevInPrint} onChange={e=>setShowDevInPrint(e.target.checked)} className="w-5 h-5 accent-[#c5a059] cursor-pointer rounded" /> 
                            <label htmlFor="devToggle" className="text-xs font-bold text-[#1a365d] cursor-pointer select-none">إظهار تفاصيل المطور في الملحق</label>
                        </div>

                        <div className="flex flex-col gap-3 border-t border-slate-100 pt-5">
                            {/* 🔥 أزرار التصدير الذكية الجديدة 🔥 */}
                            <button onClick={() => exportToPDF('teaser')} className="w-full bg-[#c5a059] text-white py-4 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-yellow-600 transition shadow-lg text-lg"><Presentation size={20}/> تصدير العرض الاستثماري</button>
                            <button onClick={() => exportToPDF('detailed')} className="w-full bg-[#1a365d] text-white py-4 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-blue-900 transition shadow-lg text-lg"><FileSpreadsheet size={20}/> تصدير الملحق المالي</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* =======================================================
                🔥 الحاويات المخفية لتغذية نافذة الـ PDF (لاتمسحها)
            ======================================================= */}
            <div style={{ display: 'none' }}>
                <div id="pdf-teaser-template">
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem', marginBottom: '2rem' }}>
                            <img src={getImg("1I5KIPkeuwJ0CawpWJLpiHdmofSKLQglN")} style={{ height: '4rem', objectFit: 'contain' }} alt="Logo" />
                            <div style={{ textAlign: 'left', borderLeft: '4px solid #c5a059', paddingLeft: '1rem' }}>
                                <h1 style={{ fontSize: '1.5rem', fontWeight: '900', color: '#1a365d', margin: 0 }}>سماك العقارية</h1>
                                <p style={{ color: '#c5a059', fontWeight: 'bold', fontSize: '0.75rem', marginTop: '0.25rem', margin: 0 }}>سقف يعلو برؤيتك ومسكن يحكي قصتك</p>
                            </div>
                        </div>
                        
                        <div style={{ textAlign: 'center', marginBottom: '2.5rem', position: 'relative' }}>
                            <div style={{ display: 'inline-block', padding: '0.5rem 1.25rem', borderRadius: '9999px', backgroundColor: 'rgba(197, 160, 89, 0.1)', border: '1px solid rgba(197, 160, 89, 0.2)', color: '#c5a059', fontWeight: 'bold', fontSize: '0.875rem', marginBottom: '1rem' }}>
                                ملخص تنفيذي - فرصة استثمارية {printMode === 'single' ? <span style={{ color: '#1a365d', fontWeight: '900', padding: '0 0.25rem' }}>({investors[selectedInvestorIndex]?.name})</span> : ''}
                            </div>
                            <h2 style={{ fontSize: '3rem', fontWeight: '900', color: '#1a365d', marginBottom: '0.75rem', margin: 0 }}>{projectName || "مشروع سماك الصفوة 2"}</h2>
                            <p style={{ fontSize: '1.125rem', color: '#64748b', fontWeight: 'bold', margin: 0 }}>بناء شراكة استراتيجية بتمويل (وافي)</p>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '2rem', marginBottom: '2rem' }}>
                            <div style={{ backgroundColor: '#f8fafc', padding: '2rem', borderRadius: '1.5rem', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                                <p style={{ color: '#64748b', fontWeight: 'bold', fontSize: '1rem', marginBottom: '0.5rem', margin: 0 }}>رأس المال الاستثماري المستهدف</p>
                                <p style={{ fontSize: '2.25rem', fontWeight: '900', color: '#1a365d', marginBottom: '0.5rem', margin: 0 }}>{printMode === 'single' ? formatMoney(investors[selectedInvestorIndex]?.amount) : formatMoney(investorCapitalPool)}</p>
                                <p style={{ fontSize: '0.75rem', color: '#c5a059', fontWeight: 'bold', margin: 0 }}>يغطى بتوفير الأرض والمصاريف التأسيسية</p>
                            </div>
                            <div style={{ backgroundColor: '#ecfdf5', padding: '2rem', borderRadius: '1.5rem', border: '1px solid #d1fae5', textAlign: 'center' }}>
                                <p style={{ color: '#065f46', fontWeight: 'bold', fontSize: '1rem', marginBottom: '0.5rem', margin: 0 }}>المبيعات المتوقعة للمشروع</p>
                                <p style={{ fontSize: '2.25rem', fontWeight: '900', color: '#059669', marginBottom: '0.5rem', margin: 0 }}>{formatMoney(totalSales)}</p>
                                <p style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 'bold', margin: 0 }}>يتم تمويل البناء من التدفقات النقدية</p>
                            </div>
                        </div>

                        <div style={{ backgroundColor: '#1a365d', color: 'white', padding: '2.5rem', borderRadius: '1.5rem', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', textAlign: 'center', marginBottom: '2rem' }}>
                            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.2)' }}>
                                <p style={{ color: '#cbd5e1', fontWeight: 'bold', marginBottom: '0.75rem', fontSize: '1rem', margin: 0 }}>العائد المتوقع للمستثمر (ROI)</p>
                                <p style={{ fontSize: '3rem', fontWeight: '900', color: '#c5a059', margin: 0 }}>
                                    {printMode === 'single' ? (investors[selectedInvestorIndex]?.amount > 0 ? ((invProfitPool * (investors[selectedInvestorIndex].amount / investorCapitalPool)) / investors[selectedInvestorIndex].amount * 100).toFixed(1) : 0) + "%" : overAllROI.toFixed(1) + "%"}
                                </p>
                            </div>
                            <div>
                                <p style={{ color: '#cbd5e1', fontWeight: 'bold', marginBottom: '0.75rem', fontSize: '1rem', margin: 0 }}>دورة المشروع المستهدفة</p>
                                <p style={{ fontSize: '3rem', fontWeight: '900', color: 'white', margin: 0 }}>{inputs.sDuration} شهر</p>
                            </div>
                        </div>

                        <div style={{ backgroundColor: 'white', border: '2px solid rgba(197, 160, 89, 0.2)', padding: '2rem', borderRadius: '1.5rem' }}>
                            <h3 style={{ fontSize: '1.25rem', fontWeight: '900', color: '#1a365d', marginBottom: '1.5rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem', margin: 0 }}>التفاصيل المعمارية</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '1.5rem', textAlign: 'center' }}>
                                <div><span style={{ display: 'block', fontSize: '1.875rem', fontWeight: '900', color: '#1a365d', marginBottom: '0.25rem' }}>{totalUnits}</span><span style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#64748b' }}>وحدة سكنية</span></div>
                                <div><span style={{ display: 'block', fontSize: '1.875rem', fontWeight: '900', color: '#1a365d', marginBottom: '0.25rem' }}>{formatMoney(totalBuilt)}</span><span style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#64748b' }}>متر مربع بناء</span></div>
                                <div><span style={{ display: 'block', fontSize: '1.875rem', fontWeight: '900', color: '#1a365d', marginBottom: '0.25rem' }}>{formatMoney(totalNet)}</span><span style={{ fontSize: '0.875rem', fontWeight: 'bold', color: '#64748b' }}>متر مساحة للبيع</span></div>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: '1.5rem' }}>
                        <div style={{ backgroundColor: '#f1f5f9', padding: '1rem 1.5rem', borderRadius: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', fontWeight: 'bold', color: '#64748b' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ color: '#1a365d' }}>إدارة التطوير والاستثمار</span><span style={{ fontSize: '0.625rem' }}>وثيقة سرية للمستثمرين</span></div>
                            <div dir="ltr" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.125rem' }}><span>info@semak.sa | semak.sa | 920032842</span></div>
                        </div>
                    </div>
                </div>

                <div id="pdf-detailed-template">
                    <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f1f5f9', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
                            <img src={getImg("1I5KIPkeuwJ0CawpWJLpiHdmofSKLQglN")} style={{ height: '3.5rem', objectFit: 'contain' }} alt="Logo" />
                            <div style={{ textAlign: 'left', borderLeft: '4px solid #c5a059', paddingLeft: '1rem' }}>
                                <h1 style={{ fontSize: '1.25rem', fontWeight: '900', color: '#1a365d', margin: 0 }}>الملحق المالي التفصيلي</h1>
                                <p style={{ color: '#c5a059', fontWeight: 'bold', fontSize: '0.625rem', marginTop: '0.25rem', margin: 0 }}>{projectName || "مشروع سماك الصفوة 2"}</p>
                            </div>
                        </div>
                        
                        <div style={{ backgroundColor: 'white', borderRadius: '1rem', border: '2px solid #e2e8f0', overflow: 'hidden', marginBottom: '1.5rem' }}>
                            <table style={{ width: '100%', textAlign: 'right', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                                <tbody style={{ fontWeight: 'bold' }}>
                                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '0.75rem', backgroundColor: '#f8fafc', color: '#64748b', width: '66.66%' }}>رأس المال التأسيسي (الأرض + التأسيس والرخص)</td><td style={{ padding: '0.75rem', color: '#1a365d', fontSize: '0.875rem', fontWeight: '900' }}>{formatMoney(investorCapitalPool)}</td></tr>
                                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '0.75rem', backgroundColor: 'white', color: '#64748b' }}>تكلفة البناء والخدمات الإجمالية (ممول من المبيعات)</td><td style={{ padding: '0.75rem', color: '#1a365d', fontSize: '0.875rem', fontWeight: '900' }}>{formatMoney(buildCost)}</td></tr>
                                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}><td style={{ padding: '0.75rem', backgroundColor: '#f8fafc', color: '#64748b' }}>ميزانية التسويق والسعي</td><td style={{ padding: '0.75rem', color: '#1a365d', fontSize: '0.875rem', fontWeight: '900' }}>{formatMoney(marketingCost)}</td></tr>
                                    <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#fef2f2' }}><td style={{ padding: '0.75rem', fontWeight: '900', color: '#7f1d1d' }}>إجمالي التكاليف المتوقعة للمشروع</td><td style={{ padding: '0.75rem', color: '#b91c1c', fontWeight: '900', fontSize: '0.875rem' }}>{formatMoney(totalProjectCosts)}</td></tr>
                                    <tr style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: '#ecfdf5' }}><td style={{ padding: '0.75rem', fontWeight: '900', color: '#064e3b' }}>إجمالي المبيعات المتوقعة للمشروع</td><td style={{ padding: '0.75rem', color: '#047857', fontWeight: '900', fontSize: '0.875rem' }}>{formatMoney(totalSales)}</td></tr>
                                    <tr style={{ backgroundColor: '#1a365d', color: 'white' }}><td style={{ padding: '0.75rem', fontWeight: '900' }}>صافي الربح الكلي للمشروع</td><td style={{ padding: '0.75rem', fontWeight: '900', fontSize: '1.125rem', color: '#c5a059' }}>{formatMoney(netProfit)}</td></tr>
                                </tbody>
                            </table>
                        </div>

                        <h3 style={{ fontSize: '0.875rem', fontWeight: '900', color: '#1a365d', marginBottom: '0.5rem', margin: 0 }}>توزيع حصص التمويل والأرباح على المستثمرين</h3>
                        <div style={{ borderRadius: '0.75rem', border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: '1.5rem' }}>
                            <table style={{ width: '100%', textAlign: 'right', fontSize: '0.625rem', borderCollapse: 'collapse' }}>
                                <thead style={{ backgroundColor: '#f1f5f9', borderBottom: '1px solid #e2e8f0' }}>
                                    <tr>
                                        <th style={{ padding: '0.625rem', color: '#1a365d', fontWeight: '900', borderLeft: '1px solid #e2e8f0' }}>المستثمر</th>
                                        <th style={{ padding: '0.625rem', textAlign: 'center', color: '#1a365d', fontWeight: '900', borderLeft: '1px solid #e2e8f0' }}>المبلغ المستثمر</th>
                                        <th style={{ padding: '0.625rem', textAlign: 'center', color: '#1a365d', fontWeight: '900', borderLeft: '1px solid #e2e8f0' }}>الحصة %</th>
                                        <th style={{ padding: '0.625rem', textAlign: 'center', color: '#1a365d', fontWeight: '900', borderLeft: '1px solid #e2e8f0' }}>الربح المتوقع</th>
                                        <th style={{ padding: '0.625rem', textAlign: 'center', color: '#1a365d', fontWeight: '900', borderLeft: '1px solid #e2e8f0' }}>إجمالي الاسترداد</th>
                                        <th style={{ padding: '0.625rem', textAlign: 'center', color: '#1a365d', fontWeight: '900', borderLeft: '1px solid #e2e8f0' }}>ROI</th>
                                        <th style={{ padding: '0.625rem', textAlign: 'center', color: '#1a365d', fontWeight: '900' }}>سنوي</th>
                                    </tr>
                                </thead>
                                <tbody style={{ fontWeight: 'bold', backgroundColor: 'white' }}>
                                    {printMode === 'single' ? (
                                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '0.625rem', borderLeft: '1px solid #f1f5f9' }}>{investors[selectedInvestorIndex]?.name}</td>
                                            <td style={{ padding: '0.625rem', textAlign: 'center', borderLeft: '1px solid #f1f5f9' }}>{formatMoney(investors[selectedInvestorIndex]?.amount)}</td>
                                            <td style={{ padding: '0.625rem', textAlign: 'center', borderLeft: '1px solid #f1f5f9', color: '#64748b' }}>{investorCapitalPool > 0 ? ((investors[selectedInvestorIndex]?.amount||0)/investorCapitalPool*100).toFixed(1) : 0}%</td>
                                            <td style={{ padding: '0.625rem', textAlign: 'center', borderLeft: '1px solid #f1f5f9', color: '#059669' }}>{formatMoney(invProfitPool * ((investors[selectedInvestorIndex]?.amount||0)/investorCapitalPool))}</td>
                                            <td style={{ padding: '0.625rem', textAlign: 'center', borderLeft: '1px solid #f1f5f9', color: '#c5a059', fontWeight: '900' }}>{formatMoney((investors[selectedInvestorIndex]?.amount||0) + invProfitPool * ((investors[selectedInvestorIndex]?.amount||0)/investorCapitalPool))}</td>
                                            <td style={{ padding: '0.625rem', textAlign: 'center', borderLeft: '1px solid #f1f5f9' }}>{((invProfitPool * ((investors[selectedInvestorIndex]?.amount||0)/investorCapitalPool)) / (investors[selectedInvestorIndex]?.amount||1) * 100).toFixed(1)}%</td>
                                            <td style={{ padding: '0.625rem', textAlign: 'center', color: '#2563eb' }}>{(((invProfitPool * ((investors[selectedInvestorIndex]?.amount||0)/investorCapitalPool)) / (investors[selectedInvestorIndex]?.amount||1) * 100) / (inputs.sDuration/12)).toFixed(1)}%</td>
                                        </tr>
                                    ) : printMode === 'summary' ? (
                                        <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                                            <td style={{ padding: '0.625rem', borderLeft: '1px solid #f1f5f9' }}>إجمالي المستثمرين</td>
                                            <td style={{ padding: '0.625rem', textAlign: 'center', borderLeft: '1px solid #f1f5f9' }}>{formatMoney(totalInvestedVal)}</td>
                                            <td style={{ padding: '0.625rem', textAlign: 'center', borderLeft: '1px solid #f1f5f9', color: '#64748b' }}>{totalInvestedPct.toFixed(1)}%</td>
                                            <td style={{ padding: '0.625rem', textAlign: 'center', borderLeft: '1px solid #f1f5f9', color: '#059669' }}>{formatMoney(totalInvestedProfit)}</td>
                                            <td style={{ padding: '0.625rem', textAlign: 'center', borderLeft: '1px solid #f1f5f9', color: '#c5a059', fontWeight: '900' }}>{formatMoney(totalInvestedVal + totalInvestedProfit)}</td>
                                            <td style={{ padding: '0.625rem', textAlign: 'center', borderLeft: '1px solid #f1f5f9' }}>{overAllROI.toFixed(1)}%</td>
                                            <td style={{ padding: '0.625rem', textAlign: 'center', color: '#2563eb' }}>{annualROI.toFixed(1)}%</td>
                                        </tr>
                                    ) : (
                                        <>
                                            {investors.map((inv, i) => {
                                                const pct = investorCapitalPool > 0 ? (inv.amount / investorCapitalPool) * 100 : 0;
                                                const prof = invProfitPool * (pct / 100);
                                                const r = inv.amount > 0 ? (prof / inv.amount * 100) : 0;
                                                return (
                                                    <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                                        <td style={{ padding: '0.625rem', borderLeft: '1px solid #f1f5f9' }}>{inv.name || '---'}</td>
                                                        <td style={{ padding: '0.625rem', textAlign: 'center', borderLeft: '1px solid #f1f5f9' }}>{formatMoney(inv.amount)}</td>
                                                        <td style={{ padding: '0.625rem', textAlign: 'center', borderLeft: '1px solid #f1f5f9', color: '#64748b' }}>{pct.toFixed(1)}%</td>
                                                        <td style={{ padding: '0.625rem', textAlign: 'center', borderLeft: '1px solid #f1f5f9', color: '#059669' }}>{formatMoney(prof)}</td>
                                                        <td style={{ padding: '0.625rem', textAlign: 'center', borderLeft: '1px solid #f1f5f9', color: '#c5a059', fontWeight: '900' }}>{formatMoney(inv.amount + prof)}</td>
                                                        <td style={{ padding: '0.625rem', textAlign: 'center', borderLeft: '1px solid #f1f5f9' }}>{r.toFixed(1)}%</td>
                                                        <td style={{ padding: '0.625rem', textAlign: 'center', color: '#2563eb' }}>{(r / (inputs.sDuration/12)).toFixed(1)}%</td>
                                                    </tr>
                                                );
                                            })}
                                            <tr style={{ backgroundColor: '#f8fafc' }}>
                                                <td style={{ padding: '0.625rem', borderLeft: '1px solid #f1f5f9', color: '#1a365d', fontWeight: '900' }}>الإجمالي المجمع</td>
                                                <td style={{ padding: '0.625rem', textAlign: 'center', borderLeft: '1px solid #f1f5f9', fontWeight: '900' }}>{formatMoney(totalInvestedVal)}</td>
                                                <td style={{ padding: '0.625rem', textAlign: 'center', borderLeft: '1px solid #f1f5f9', fontWeight: '900', color: '#64748b' }}>{totalInvestedPct.toFixed(1)}%</td>
                                                <td style={{ padding: '0.625rem', textAlign: 'center', borderLeft: '1px solid #f1f5f9', fontWeight: '900', color: '#059669' }}>{formatMoney(totalInvestedProfit)}</td>
                                                <td style={{ padding: '0.625rem', textAlign: 'center', borderLeft: '1px solid #f1f5f9', fontWeight: '900', color: '#c5a059' }}>{formatMoney(totalInvestedVal + totalInvestedProfit)}</td>
                                                <td style={{ padding: '0.625rem', textAlign: 'center', borderLeft: '1px solid #f1f5f9', fontWeight: '900' }}>{overAllROI.toFixed(1)}%</td>
                                                <td style={{ padding: '0.625rem', textAlign: 'center', fontWeight: '900', color: '#2563eb' }}>{annualROI.toFixed(1)}%</td>
                                            </tr>
                                        </>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: showDevInPrint ? 'repeat(2, minmax(0, 1fr))' : 'minmax(0, 1fr)', gap: '1rem', flexShrink: 0 }}>
                            {showDevInPrint && (
                                <div style={{ borderTop: '4px solid #1a365d', backgroundColor: 'white', padding: '1rem', borderRadius: '1rem', border: '1px solid #f1f5f9' }}>
                                    <h4 style={{ fontSize: '0.75rem', fontWeight: '900', color: '#1a365d', margin: '0 0 0.25rem 0' }}>حصة المطور العقاري</h4>
                                    <p style={{ fontSize: '1.25rem', fontWeight: '900', color: '#1a365d', margin: '0 0 0.25rem 0' }}>{formatMoney(devProfit)} SAR</p>
                                    <p style={{ fontSize: '0.5625rem', color: '#64748b', lineHeight: 1.6, margin: 0 }}>أتعاب التطوير، الإدارة، وتغطية المخاطر حتى تسليم المفتاح عبر نظام وتراخيص وافي.</p>
                                </div>
                            )}
                            
                            <div style={{ backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '1rem', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '0.75rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.5rem' }}>
                                    <span style={{ fontSize: '0.625rem', fontWeight: 'bold', color: '#475569' }}>تكلفة الأرض للمتر المباع</span>
                                    <span style={{ fontSize: '0.875rem', fontWeight: '900', color: '#1a365d' }}>{formatMoney(landCostPerSqm)} SAR</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ fontSize: '0.625rem', fontWeight: 'bold', color: '#475569' }}>إجمالي التكلفة للمتر المباع</span>
                                    <span style={{ fontSize: '0.875rem', fontWeight: '900', color: '#dc2626' }}>{formatMoney(totalCostPerSqm)} SAR</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: '1.5rem' }}>
                        <div style={{ backgroundColor: '#f1f5f9', padding: '0.75rem 1.25rem', borderRadius: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', fontWeight: 'bold', color: '#64748b' }}>
                            <div style={{ display: 'flex', flexDirection: 'column' }}><span style={{ color: '#1a365d' }}>إدارة التطوير والاستثمار</span><span style={{ fontSize: '0.5625rem' }}>وثيقة سرية للمستثمرين</span></div>
                            <div dir="ltr" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.125rem' }}><span>info@semak.sa | semak.sa | 920032842</span></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}