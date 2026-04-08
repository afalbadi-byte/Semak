import React, { useState, useEffect } from 'react';
import { 
    Calculator, Save, RefreshCw, Plus, Trash2, Users, 
    FileSpreadsheet, Presentation, LayoutDashboard, 
    Landmark, Briefcase, FileText, DownloadCloud 
} from 'lucide-react';
import { API_URL, getImg } from '../../utils/helpers';

export default function FeasibilityCalc({ showToast }) {
    const [loading, setLoading] = useState(false);
    const [savedProjects, setSavedProjects] = useState([]);
    const [currentProjectId, setCurrentProjectId] = useState("");
    const [projectName, setProjectName] = useState("");

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

    const handleChange = (e) => setInputs({ ...inputs, [e.target.name]: parseFloat(e.target.value) || 0 });

    const handleInvestorChange = (index, field, value) => {
        const newInvestors = [...investors];
        newInvestors[index][field] = field === 'amount' ? (parseFloat(value) || 0) : value;
        setInvestors(newInvestors);
    };

    const addInvestorRow = () => setInvestors([...investors, { name: "", amount: 0 }]);
    const removeInvestor = (index) => setInvestors(investors.filter((_, i) => i !== index));
    const formatMoney = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n || 0);

    // --- العمليات الحسابية ---
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
    
    const invProfitPool = netProfit * (finalInvPct / 100);
    const devProfit = netProfit * ( (100 - finalInvPct) / 100 );

    const overAllROI = investorCapitalPool > 0 ? (invProfitPool / investorCapitalPool) * 100 : 0;
    const annualROI = inputs.sDuration > 0 ? overAllROI / (inputs.sDuration / 12) : 0;

    const landCostPerSqm = totalNet > 0 ? (inputs.finLandPrice / totalNet) : 0;
    const totalCostPerSqm = totalNet > 0 ? (totalProjectCosts / totalNet) : 0;

    const totalInvestedVal = investors.reduce((sum, inv) => sum + inv.amount, 0);
    const totalInvestedPct = investorCapitalPool > 0 ? (totalInvestedVal / investorCapitalPool) * 100 : 0;
    const totalInvestedProfit = invProfitPool * (totalInvestedPct / 100);

    // --- السحابة ---
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

    // --- تصدير PDF ---
    const exportToPDF = (type) => {
        const templateId = type === 'teaser' ? 'pdf-teaser-template' : 'pdf-detailed-template';
        const content = document.getElementById(templateId).innerHTML;
        const win = window.open('', '_blank');
        win.document.write(`
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>تقرير ${projectName || 'سماك'}</title>
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
                <script src="https://cdn.tailwindcss.com"></script>
                <style>
                    body { font-family: 'Cairo', sans-serif; background: white; -webkit-print-color-adjust: exact; color-adjust: exact; margin: 0; padding: 0; }
                    @page { size: A4 portrait; margin: 0; }
                    .page-container { width: 210mm; height: 296mm; margin: 0 auto; padding: 40px; display: flex; flex-direction: column; justify-content: space-between; background: white; }
                </style>
            </head>
            <body><div class="page-container">${content}</div><script>window.onload=()=>{setTimeout(()=>{window.print();},1000);};</script></body>
            </html>
        `);
        win.document.close();
    };

    return (
        <div className="animate-fadeIn pb-12 font-cairo" dir="rtl">
            
            {/* شريط السحابة */}
            <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 mb-8 flex flex-col lg:flex-row items-center gap-6">
                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <div className="w-14 h-14 bg-indigo-50 text-[#1a365d] rounded-2xl flex items-center justify-center shrink-0">
                        <DownloadCloud size={28} />
                    </div>
                    <div className="flex-1">
                        <label className="block text-[11px] font-black text-slate-400 mb-1">النسخة السحابية</label>
                        <h2 className="text-xl font-black text-[#1a365d]">إدارة الدراسات</h2>
                    </div>
                </div>
                <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input type="text" value={projectName} onChange={e=>setProjectName(e.target.value)} placeholder="اسم المشروع..." className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl font-black text-[#1a365d] outline-none focus:border-[#c5a059]" />
                    <select onChange={(e) => handleLoadCloud(e.target.value)} value={currentProjectId} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl font-black text-[#1a365d] outline-none cursor-pointer focus:border-[#c5a059]">
                        <option value="">-- استدعاء دراسة سابقة --</option>
                        {savedProjects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}
                    </select>
                </div>
                <button onClick={handleSaveCloud} disabled={loading} className="w-full lg:w-auto bg-[#1a365d] text-white px-8 py-4 rounded-2xl font-black hover:bg-blue-900 transition-all flex items-center justify-center gap-3 shadow-lg">
                    {loading ? <RefreshCw size={20} className="animate-spin"/> : <Save size={20}/>} <span>حفظ السحابة</span>
                </button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
                <div className="xl:col-span-8 space-y-8">
                    
                    {/* 1. المعماري */}
                    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-6 md:p-8 border-b border-slate-100 flex items-center gap-4">
                            <div className="w-12 h-12 bg-orange-50 text-[#c5a059] rounded-2xl flex items-center justify-center shrink-0"><LayoutDashboard size={24} /></div>
                            <div><h2 className="text-xl font-black text-[#1a365d]">1. الموجه المعماري</h2></div>
                        </div>
                        <div className="p-6 md:p-8">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
                                <div><label className="block text-[11px] font-black text-slate-500 mb-2">مساحة الأرض</label><input type="number" name="archLandArea" value={inputs.archLandArea} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-black text-[#1a365d] focus:border-[#c5a059] outline-none" /></div>
                                <div><label className="block text-[11px] font-black text-slate-500 mb-2">خدمات الدور</label><input type="number" name="archCommonArea" value={inputs.archCommonArea} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-black text-[#1a365d] focus:border-[#c5a059] outline-none" /></div>
                                <div><label className="block text-[11px] font-black text-slate-500 mb-2">الأدوار المتكررة</label><input type="number" name="archFloorsCount" value={inputs.archFloorsCount} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-black text-[#1a365d] focus:border-[#c5a059] outline-none" /></div>
                                <div><label className="block text-[11px] font-black text-slate-500 mb-2">نسبة الملحق %</label><input type="number" name="archRoofPct" value={inputs.archRoofPct} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-black text-[#1a365d] focus:border-[#c5a059] outline-none" /></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col gap-4">
                                    <div><label className="block text-[11px] font-black text-slate-500 mb-2">بناء الأرضي %</label><input type="number" name="archGroundPct" value={inputs.archGroundPct} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-black text-[#1a365d]" /></div>
                                    <div><label className="block text-[11px] font-black text-slate-500 mb-2 font-bold text-[#c5a059]">وحدات الأرضي</label><input type="number" name="uGround" value={inputs.uGround} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-black text-[#c5a059]" /></div>
                                </div>
                                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col gap-4">
                                    <div><label className="block text-[11px] font-black text-slate-500 mb-2">بناء المتكرر %</label><input type="number" name="archTypicalPct" value={inputs.archTypicalPct} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-black text-[#1a365d]" /></div>
                                    <div><label className="block text-[11px] font-black text-slate-500 mb-2 font-bold text-[#c5a059]">وحدات المتكرر</label><input type="number" name="uTypical" value={inputs.uTypical} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-black text-[#c5a059]" /></div>
                                </div>
                                <div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col justify-end">
                                    <div><label className="block text-[11px] font-black text-slate-500 mb-2 font-bold text-[#c5a059]">وحدات الملحق</label><input type="number" name="uRoof" value={inputs.uRoof} onChange={handleChange} className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 font-black text-[#c5a059]" /></div>
                                </div>
                            </div>
                        </div>
                        <div className="overflow-x-auto bg-slate-50/50 p-6 md:p-8 border-t border-slate-100">
                            <table className="w-full text-right text-sm">
                                <thead><tr className="text-slate-400 font-black border-b-2 border-slate-200"><th className="py-3 px-4">الدور</th><th className="py-3 px-4 text-center">إجمالي البناء</th><th className="py-3 px-4 text-center text-emerald-600">الصافي للبيع</th><th className="py-3 px-4 text-center">الوحدات</th></tr></thead>
                                <tbody>{floorsData.map((f, i) => (<tr key={i} className="border-b border-slate-100 hover:bg-white"><td className="py-4 px-4 font-black text-[#1a365d]">{f.label}</td><td className="py-4 px-4 text-center font-bold text-slate-600">{f.built.toFixed(1)} m²</td><td className="py-4 px-4 text-center font-black text-emerald-600">{f.net.toFixed(1)} m²</td><td className="py-4 px-4 text-center font-black text-[#c5a059]">{f.units}</td></tr>))}</tbody>
                                <tfoot><tr className="bg-[#1a365d] text-white"><td className="py-4 px-4 font-black rounded-r-2xl">الإجمالي</td><td className="py-4 px-4 text-center font-bold">{totalBuilt.toFixed(1)} m²</td><td className="py-4 px-4 text-center font-black text-[#c5a059]">{totalNet.toFixed(1)} m²</td><td className="py-4 px-4 text-center font-black rounded-l-2xl">{totalUnits}</td></tr></tfoot>
                            </table>
                        </div>
                    </div>

                    {/* 2. المالي */}
                    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-6 md:p-8 border-b border-slate-100 flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-50 text-[#1a365d] rounded-2xl flex items-center justify-center shrink-0"><Landmark size={24} /></div>
                            <div><h2 className="text-xl font-black text-[#1a365d]">2. التكاليف والاتفاقية</h2></div>
                        </div>
                        <div className="p-6 md:p-8 space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div><label className="block text-[11px] font-black text-slate-500 mb-2">سعر بيع المتر</label><input type="number" name="finSellPrice" value={inputs.finSellPrice} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-black text-emerald-600" /></div>
                                <div><label className="block text-[11px] font-black text-slate-500 mb-2">تكلفة بناء المتر</label><input type="number" name="finBuildCost" value={inputs.finBuildCost} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-black text-red-500" /></div>
                                <div><label className="block text-[11px] font-black text-slate-500 mb-2">إدخال خدمات الوحدة</label><input type="number" name="inServiceCostPerUnit" value={inputs.inServiceCostPerUnit} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-black text-red-500" /></div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div><label className="block text-[11px] font-black text-slate-500 mb-2">قيمة الأرض</label><input type="number" name="finLandPrice" value={inputs.finLandPrice} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-black text-[#1a365d]" /></div>
                                <div><label className="block text-[11px] font-black text-slate-500 mb-2">مدة المشروع (شهر)</label><input type="number" name="sDuration" value={inputs.sDuration} onChange={handleChange} className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 font-black text-[#c5a059]" /></div>
                            </div>
                            <div className="bg-slate-50 p-6 md:p-8 rounded-[2rem] border border-slate-100 grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div className="col-span-4 mb-2 flex items-center gap-2 font-black text-[#1a365d] text-sm"><Briefcase size={16} className="text-[#c5a059]"/> المصاريف الإدارية والتأسيس</div>
                                <div><label className="text-[10px] block mb-1">وافي</label><input type="number" name="sWafi" value={inputs.sWafi} onChange={handleChange} className="w-full p-2 rounded-xl border border-slate-200 bg-white text-xs font-bold" /></div>
                                <div><label className="text-[10px] block mb-1">هندسي</label><input type="number" name="sEng" value={inputs.sEng} onChange={handleChange} className="w-full p-2 rounded-xl border border-slate-200 bg-white text-xs font-bold" /></div>
                                <div><label className="text-[10px] block mb-1">بلدية</label><input type="number" name="sMunicipality" value={inputs.sMunicipality} onChange={handleChange} className="w-full p-2 rounded-xl border border-slate-200 bg-white text-xs font-bold" /></div>
                                <div><label className="text-[10px] block mb-1">إشراف</label><input type="number" name="sSupervision" value={inputs.sSupervision} onChange={handleChange} className="w-full p-2 rounded-xl border border-slate-200 bg-white text-xs font-bold" /></div>
                                <div><label className="text-[10px] block mb-1">محاسب</label><input type="number" name="sAcc" value={inputs.sAcc} onChange={handleChange} className="w-full p-2 rounded-xl border border-slate-200 bg-white text-xs font-bold" /></div>
                                <div><label className="text-[10px] block mb-1">أخرى</label><input type="number" name="sOther" value={inputs.sOther} onChange={handleChange} className="w-full p-2 rounded-xl border border-slate-200 bg-white text-xs font-bold" /></div>
                                <div><label className="text-[10px] block mb-1">تأمين %</label><input type="number" name="sInsurancePct" value={inputs.sInsurancePct} onChange={handleChange} step="0.1" className="w-full p-2 rounded-xl border border-slate-200 bg-white text-xs font-bold" /></div>
                                <div><label className="text-[10px] block mb-1">فحص %</label><input type="number" name="sTestingPct" value={inputs.sTestingPct} onChange={handleChange} step="0.1" className="w-full p-2 rounded-xl border border-slate-200 bg-white text-xs font-bold" /></div>
                            </div>
                            <div className="bg-gradient-to-l from-[#1a365d] to-[#0f172a] p-8 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl">
                                <div className="flex-1 w-full grid grid-cols-2 gap-6">
                                    <div><label className="text-[11px] font-black text-slate-300 block mb-2 uppercase">علاوة مستثمر %</label><input type="number" name="inInvBonusPct" value={inputs.inInvBonusPct} onChange={handleChange} className="w-full p-4 rounded-2xl border-none font-black text-white text-xl bg-white/10" /></div>
                                    <div><label className="text-[11px] font-black text-slate-300 block mb-2 uppercase">السعي %</label><input type="number" name="sMarkPct" value={inputs.sMarkPct} onChange={handleChange} step="0.1" className="w-full p-4 rounded-2xl border-none font-black text-[#c5a059] text-xl bg-white/10" /></div>
                                </div>
                                <div className="w-full md:w-64 text-center bg-white p-6 rounded-3xl"><span className="block text-[11px] font-black text-slate-400 mb-1">إجمالي حصة المستثمرين</span><span className="text-4xl font-black text-[#1a365d]">{finalInvPct.toFixed(1)}%</span></div>
                            </div>
                        </div>
                    </div>

                    {/* 3. المستثمرين */}
                    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center">
                            <div className="flex items-center gap-4"><div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0"><Users size={24} /></div><div><h2 className="text-xl font-black text-[#1a365d]">3. قائمة المستثمرين</h2></div></div>
                            <button onClick={addInvestorRow} className="bg-[#1a365d] text-white px-5 py-3 rounded-xl text-sm font-black hover:bg-blue-900 transition flex items-center gap-2"><Plus size={18}/> إضافة شريك</button>
                        </div>
                        <div className="overflow-x-auto p-6 md:p-8">
                            <table className="w-full text-right text-sm border-separate border-spacing-y-3">
                                <thead><tr className="text-slate-400 font-black text-[11px] uppercase tracking-wider"><th className="px-4 pb-2">المستثمر</th><th className="px-4 pb-2">المبلغ (SAR)</th><th className="px-4 pb-2 text-center">الإسهام</th><th className="px-4 pb-2 text-center text-emerald-600">الربح المتوقع</th><th className="px-4 pb-2 text-center">حذف</th></tr></thead>
                                <tbody>{investors.map((inv, i) => {
                                    const pct = investorCapitalPool > 0 ? (inv.amount / investorCapitalPool) * 100 : 0;
                                    const prof = invProfitPool * (pct / 100);
                                    return (<tr key={i} className="bg-slate-50 rounded-2xl group"><td className="p-2 rounded-r-2xl"><input type="text" value={inv.name} onChange={e=>handleInvestorChange(i, 'name', e.target.value)} className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl font-bold" /></td><td className="p-2"><input type="number" value={inv.amount} onChange={e=>handleInvestorChange(i, 'amount', e.target.value)} className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl font-black text-[#1a365d]" /></td><td className="p-2 text-center font-black text-slate-500">{pct.toFixed(1)}%</td><td className="p-2 text-center font-black text-emerald-600">{formatMoney(prof)}</td><td className="p-2 text-center rounded-l-2xl"><button onClick={() => removeInvestor(i)} className="text-slate-400 hover:text-red-500 p-3 bg-white rounded-xl border border-slate-100 shadow-sm"><Trash2 size={18}/></button></td></tr>)
                                })}</tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* العمود الجانبي */}
                <div className="xl:col-span-4 space-y-8">
                    <div className="bg-[#1a365d] text-white rounded-[2rem] shadow-2xl p-8 border-b-[12px] border-[#c5a059] relative overflow-hidden">
                         <h3 className="text-lg font-black text-[#c5a059] mb-8 flex items-center gap-2 relative z-10"><FileText size={20}/> ملخص اقتصاديات المشروع</h3>
                         <div className="grid grid-cols-2 gap-4 mb-8 relative z-10"><div className="bg-white/5 p-4 rounded-2xl text-center border border-white/10"><span className="block text-[10px] text-slate-400 mb-1">أرض للمتر</span><span className="text-lg font-black text-white">{formatMoney(landCostPerSqm)}</span></div><div className="bg-white/5 p-4 rounded-2xl text-center border border-white/10"><span className="block text-[10px] text-slate-400 mb-1">بناء للمتر</span><span className="text-lg font-black text-red-300">{formatMoney(totalCostPerSqm)}</span></div></div>
                         <div className="space-y-4 text-sm relative z-10">
                             <div className="flex justify-between border-b border-white/10 pb-3"><span>المبيعات</span> <span className="text-emerald-400 font-black text-lg">{formatMoney(totalSales)}</span></div>
                             <div className="flex justify-between border-b border-white/10 pb-3"><span>البناء</span> <span className="text-red-300 font-black">{formatMoney(buildCost)}</span></div>
                             <div className="flex justify-between border-b border-white/10 pb-3"><span>التأسيس</span> <span className="text-red-300 font-black">{formatMoney(softCosts)}</span></div>
                             <div className="flex justify-between border-b border-white/10 pb-3"><span>التسويق</span> <span className="text-orange-400 font-black">{formatMoney(marketingCost)}</span></div>
                             <div className="flex justify-between pt-2 border-t border-white/20"><span className="font-black text-white text-base">صافي الربح الكلي</span> <span className="text-emerald-400 font-black text-2xl">{formatMoney(netProfit)}</span></div>
                         </div>
                    </div>

                    <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col gap-6">
                        <div className="flex justify-between items-start"><div><span className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">العائد الإجمالي (ROI)</span><span className="text-5xl font-black text-[#1a365d]">{overAllROI.toFixed(1)}%</span></div><div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-black text-2xl">%</div></div>
                        <div className="space-y-4 border-t border-slate-100 pt-6"><div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl"><span className="text-xs font-bold text-slate-500">العائد السنوي</span><span className="text-base font-black text-emerald-600">{annualROI.toFixed(1)}%</span></div><div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl"><span className="text-xs font-bold text-slate-500">الاسترداد الكلي</span><span className="text-base font-black text-[#1a365d]">SAR {formatMoney(investorCapitalPool + invProfitPool)}</span></div></div>
                    </div>

                    <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 space-y-6">
                        <h3 className="text-base font-black text-[#1a365d] flex items-center gap-2"><Presentation size={20} className="text-[#c5a059]" /> خيارات التصدير</h3>
                        <select value={printMode} onChange={e=>setPrintMode(e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-4 py-3.5 rounded-2xl text-sm font-black text-[#1a365d] outline-none">
                            <option value="all">إظهار كافة المستثمرين</option>
                            <option value="summary">إظهار الإجمالي فقط</option>
                            <option value="single">مستثمر محدد</option>
                        </select>
                        {printMode === 'single' && (<select value={selectedInvestorIndex} onChange={e=>setSelectedInvestorIndex(e.target.value)} className="w-full bg-orange-50 border border-[#c5a059] px-4 py-3.5 rounded-2xl text-sm font-black text-orange-900 outline-none">{investors.map((inv, i) => <option key={i} value={i}>{inv.name || `مستثمر ${i+1}`}</option>)}</select>)}
                        <label className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 cursor-pointer"><input type="checkbox" checked={showDevInPrint} onChange={e=>setShowDevInPrint(e.target.checked)} className="w-5 h-5 accent-[#c5a059]" /><span className="text-xs font-black text-[#1a365d]">إظهار أتعاب المطور</span></label>
                        <div className="flex flex-col gap-4 border-t border-slate-100 pt-6">
                            <button onClick={() => exportToPDF('teaser')} className="w-full bg-[#c5a059] text-white py-4 rounded-2xl font-black hover:bg-yellow-600 transition-all flex items-center justify-center gap-3 shadow-lg shadow-[#c5a059]/30"><Presentation size={22}/> العرض الاستثماري</button>
                            <button onClick={() => exportToPDF('detailed')} className="w-full bg-[#1a365d] text-white py-4 rounded-2xl font-black hover:bg-blue-900 transition-all flex items-center justify-center gap-3 shadow-lg shadow-blue-900/20"><FileSpreadsheet size={22}/> الملحق المالي (PDF)</button>
                        </div>
                    </div>
                </div>
            </div>

            {/* قوالب التصدير المخفية */}
            <div style={{ display: 'none' }}>
                <div id="pdf-teaser-template">
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'2px solid #f1f5f9', paddingBottom:'1.5rem', marginBottom:'3rem' }}>
                        <img src={getImg("1I5KIPkeuwJ0CawpWJLpiHdmofSKLQglN")} style={{ height:'4.5rem' }} alt="Logo" />
                        <div style={{ textAlign:'left', borderLeft:'6px solid #c5a059', paddingLeft:'1.5rem' }}><h1 style={{ fontSize:'1.8rem', fontWeight:'900', color:'#1a365d', margin:0 }}>سماك العقارية</h1><p style={{ color:'#c5a059', fontWeight:'bold', fontSize:'0.85rem', margin:0 }}>سقف يعلو برؤيتك ومسكن يحكي قصتك</p></div>
                    </div>
                    <div style={{ textAlign:'center', marginBottom:'3rem' }}>
                        <div style={{ display:'inline-block', padding:'0.5rem 1.5rem', borderRadius:'9999px', backgroundColor:'#f8fafc', border:'1px solid #e2e8f0', color:'#c5a059', fontWeight:'900', fontSize:'1rem', marginBottom:'1.5rem' }}>دراسة فرصة استثمارية {printMode==='single'?investors[selectedInvestorIndex]?.name:''}</div>
                        <h2 style={{ fontSize:'3.5rem', fontWeight:'900', color:'#1a365d', marginBottom:'1rem', margin:0 }}>{projectName || "مشروع سماك الصفوة"}</h2>
                        <p style={{ fontSize:'1.25rem', color:'#64748b', fontWeight:'bold', margin:0 }}>بناء شراكة استراتيجية بنموذج تمويل (وافي)</p>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'2rem', marginBottom:'2.5rem' }}>
                        <div style={{ backgroundColor:'#f8fafc', padding:'2.5rem', borderRadius:'2rem', border:'1px solid #e2e8f0', textAlign:'center' }}><p style={{ color:'#64748b', fontWeight:'900', fontSize:'1.1rem', margin:0 }}>رأس المال المطلوب</p><p style={{ fontSize:'2.8rem', fontWeight:'900', color:'#1a365d', margin:0 }}>{printMode==='single'?formatMoney(investors[selectedInvestorIndex]?.amount):formatMoney(investorCapitalPool)}</p></div>
                        <div style={{ backgroundColor:'#ecfdf5', padding:'2.5rem', borderRadius:'2rem', border:'1px solid #a7f3d0', textAlign:'center' }}><p style={{ color:'#065f46', fontWeight:'900', fontSize:'1.1rem', margin:0 }}>المبيعات المتوقعة</p><p style={{ fontSize:'2.8rem', fontWeight:'900', color:'#059669', margin:0 }}>{formatMoney(totalSales)}</p></div>
                    </div>
                    <div style={{ backgroundColor:'#1a365d', color:'white', padding:'3rem', borderRadius:'2rem', display:'grid', gridTemplateColumns:'1fr 1fr', textAlign:'center', marginBottom:'3rem' }}>
                        <div style={{ borderLeft:'1px solid rgba(255,255,255,0.2)' }}><p style={{ color:'#cbd5e1', fontWeight:'bold', fontSize:'1.1rem', margin:0 }}>العائد المتوقع (ROI)</p><p style={{ fontSize:'3.5rem', fontWeight:'900', color:'#c5a059', margin:0 }}>{printMode==='single'?(investors[selectedInvestorIndex]?.amount>0?((invProfitPool*(investors[selectedInvestorIndex].amount/investorCapitalPool))/investors[selectedInvestorIndex].amount*100).toFixed(1):0):overAllROI.toFixed(1)}%</p></div>
                        <div><p style={{ color:'#cbd5e1', fontWeight:'bold', fontSize:'1.1rem', margin:0 }}>دورة المشروع</p><p style={{ fontSize:'3.5rem', fontWeight:'900', color:'white', margin:0 }}>{inputs.sDuration} شهر</p></div>
                    </div>
                    <div style={{ backgroundColor:'white', border:'2px solid rgba(197, 160, 89, 0.3)', padding:'2.5rem', borderRadius:'2rem' }}>
                        <h3 style={{ fontSize:'1.4rem', fontWeight:'900', color:'#1a365d', marginBottom:'2rem', borderBottom:'1px solid #f1f5f9', paddingBottom:'1rem', margin:0 }}>التفاصيل المعمارية</h3>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', textAlign:'center' }}>
                            <div><span style={{ display:'block', fontSize:'2.2rem', fontWeight:'900' }}>{totalUnits}</span><span style={{ fontSize:'1rem', color:'#64748b' }}>وحدة سكنية</span></div>
                            <div><span style={{ display:'block', fontSize:'2.2rem', fontWeight:'900' }}>{formatMoney(totalBuilt)}</span><span style={{ fontSize:'1rem', color:'#64748b' }}>م² بناء</span></div>
                            <div><span style={{ display:'block', fontSize:'2.2rem', fontWeight:'900' }}>{formatMoney(totalNet)}</span><span style={{ fontSize:'1rem', color:'#64748b' }}>م² للبيع</span></div>
                        </div>
                    </div>
                </div>

                <div id="pdf-detailed-template">
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'2px solid #f1f5f9', paddingBottom:'1.25rem', marginBottom:'2rem' }}>
                        <img src={getImg("1I5KIPkeuwJ0CawpWJLpiHdmofSKLQglN")} style={{ height:'3.8rem' }} alt="Logo" />
                        <div style={{ textAlign:'left', borderLeft:'5px solid #c5a059', paddingLeft:'1.25rem' }}><h1 style={{ fontSize:'1.4rem', fontWeight:'900', color:'#1a365d', margin:0 }}>الملحق المالي التفصيلي</h1><p style={{ color:'#c5a059', fontWeight:'bold', fontSize:'0.75rem', margin:0 }}>{projectName || "مشروع سماك الصفوة"}</p></div>
                    </div>
                    <div style={{ backgroundColor:'white', borderRadius:'1.5rem', border:'2px solid #e2e8f0', overflow:'hidden', marginBottom:'2rem' }}>
                        <table style={{ width:'100%', textAlign:'right', fontSize:'0.85rem', borderCollapse:'collapse' }}>
                            <tbody style={{ fontWeight:'bold' }}>
                                <tr style={{ borderBottom:'1px solid #e2e8f0' }}><td style={{ padding:'1rem', backgroundColor:'#f8fafc', color:'#475569', width:'60%' }}>رأس المال التأسيسي (أرض + رخص)</td><td style={{ padding:'1rem', color:'#1a365d', fontSize:'1.1rem', fontWeight:'900' }}>{formatMoney(investorCapitalPool)}</td></tr>
                                <tr style={{ borderBottom:'1px solid #e2e8f0' }}><td style={{ padding:'1rem' }}>تكلفة البناء والخدمات (ممول من المبيعات)</td><td style={{ padding:'1rem', color:'#1a365d', fontSize:'1.1rem', fontWeight:'900' }}>{formatMoney(buildCost)}</td></tr>
                                <tr style={{ borderBottom:'1px solid #e2e8f0', backgroundColor:'#fef2f2' }}><td style={{ padding:'1rem', fontWeight:'900', color:'#991b1b' }}>إجمالي التكاليف المتوقعة</td><td style={{ padding:'1rem', color:'#b91c1c', fontWeight:'900', fontSize:'1.1rem' }}>{formatMoney(totalProjectCosts)}</td></tr>
                                <tr style={{ borderBottom:'1px solid #e2e8f0', backgroundColor:'#ecfdf5' }}><td style={{ padding:'1rem', fontWeight:'900', color:'#065f46' }}>إجمالي المبيعات المتوقعة</td><td style={{ padding:'1rem', color:'#059669', fontWeight:'900', fontSize:'1.1rem' }}>{formatMoney(totalSales)}</td></tr>
                                <tr style={{ backgroundColor:'#1a365d', color:'white' }}><td style={{ padding:'1.25rem', fontWeight:'900', fontSize:'1.1rem' }}>صافي الربح الكلي للمشروع</td><td style={{ padding:'1.25rem', fontWeight:'900', fontSize:'1.4rem', color:'#c5a059' }}>{formatMoney(netProfit)}</td></tr>
                            </tbody>
                        </table>
                    </div>
                    <h3 style={{ fontSize:'1.1rem', fontWeight:'900', color:'#1a365d', marginBottom:'1rem' }}>توزيع حصص التمويل والأرباح</h3>
                    <div style={{ borderRadius:'1rem', border:'2px solid #e2e8f0', overflow:'hidden', marginBottom:'2rem' }}>
                        <table style={{ width:'100%', textAlign:'right', fontSize:'0.75rem', borderCollapse:'collapse' }}>
                            <thead style={{ backgroundColor:'#f8fafc', borderBottom:'2px solid #e2e8f0' }}><tr><th style={{ padding:'0.85rem', color:'#1a365d' }}>المستثمر</th><th style={{ textAlign:'center' }}>المبلغ</th><th style={{ textAlign:'center' }}>الحصة%</th><th style={{ textAlign:'center' }}>الربح</th><th style={{ textAlign:'center' }}>ROI</th></tr></thead>
                            <tbody style={{ fontWeight:'bold' }}>
                                {printMode==='single' ? (<tr><td style={{ padding:'0.85rem' }}>{investors[selectedInvestorIndex]?.name}</td><td style={{ textAlign:'center' }}>{formatMoney(investors[selectedInvestorIndex]?.amount)}</td><td style={{ textAlign:'center' }}>{(investors[selectedInvestorIndex]?.amount/investorCapitalPool*100).toFixed(1)}%</td><td style={{ textAlign:'center' }}>{formatMoney(invProfitPool*(investors[selectedInvestorIndex].amount/investorCapitalPool))}</td><td style={{ textAlign:'center' }}>{((invProfitPool*(investors[selectedInvestorIndex].amount/investorCapitalPool))/investors[selectedInvestorIndex].amount*100).toFixed(1)}%</td></tr>) : 
                                investors.map((inv, i) => (<tr><td style={{ padding:'0.75rem' }}>{inv.name}</td><td style={{ textAlign:'center' }}>{formatMoney(inv.amount)}</td><td style={{ textAlign:'center' }}>{(inv.amount/investorCapitalPool*100).toFixed(1)}%</td><td style={{ textAlign:'center' }}>{formatMoney(invProfitPool*(inv.amount/investorCapitalPool))}</td><td style={{ textAlign:'center' }}>{(inv.amount>0?(invProfitPool*(inv.amount/investorCapitalPool)/inv.amount*100):0).toFixed(1)}%</td></tr>))}
                            </tbody>
                        </table>
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'1.5rem' }}>
                        {showDevInPrint && (<div style={{ borderTop:'4px solid #1a365d', padding:'1.5rem', borderRadius:'1.5rem', border:'1px solid #e2e8f0' }}><h4 style={{ fontSize:'0.85rem', fontWeight:'900', margin:0 }}>حصة المطور</h4><p style={{ fontSize:'1.5rem', fontWeight:'900', color:'#1a365d', margin:0 }}>{formatMoney(devProfit)} SAR</p></div>)}
                        <div style={{ backgroundColor:'#f8fafc', padding:'1.5rem', borderRadius:'1.5rem', border:'1px solid #e2e8f0' }}><div style={{ display:'flex', justifyContent:'space-between', borderBottom:'1px solid #e2e8f0', paddingBottom:'0.5rem' }}><span>تكلفة الأرض للمتر</span><strong>{formatMoney(landCostPerSqm)}</strong></div><div style={{ display:'flex', justifyContent:'space-between', paddingTop:'0.5rem' }}><span>إجمالي التكلفة للمتر</span><strong>{formatMoney(totalCostPerSqm)}</strong></div></div>
                    </div>
                </div>
            </div>
        </div>
    );
}