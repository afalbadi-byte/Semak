import React, { useState, useEffect } from 'react';
import { Calculator, Save, RefreshCw, Plus, Trash2, Users, FileSpreadsheet, Presentation } from 'lucide-react';
import { API_URL, getImg } from '../../utils/helpers';

export default function FeasibilityCalc({ showToast }) {
    const [loading, setLoading] = useState(false);
    const [savedProjects, setSavedProjects] = useState([]);
    const [currentProjectId, setCurrentProjectId] = useState("");
    const [projectName, setProjectName] = useState("");

    // خيارات الطباعة الأصلية (بدون مكتبات خارجية)
    const [printingType, setPrintingType] = useState(null); // 'teaser' أو 'detailed'
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

    // --- السحابة وقاعدة البيانات ---
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
        const payload = {
            id: currentProjectId || null,
            project_name: projectName,
            data: { inputs, investors }
        };
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

    // --- نظام الطباعة الأصلي HTML ---
    const triggerNativePrint = (type) => {
        if (!showDevInPrint) document.body.classList.add("hide-dev-print");
        setPrintingType(type); // يعرض ورقة الطباعة ويخفي الحاسبة
    };

    useEffect(() => {
        if (printingType) {
            // ننتظر ثانية عشان المتصفح يرسم الصفحة البيضاء الجديدة
            const timer = setTimeout(() => {
                window.print();
                setPrintingType(null); // نرجع الحاسبة بعد ما يقفل نافذة الطباعة
                document.body.classList.remove("hide-dev-print");
            }, 500);
            return () => clearTimeout(timer);
        }
    }, [printingType]);


    // ==========================================
    // عرض ورقة الطباعة فقط (تختفي الحاسبة)
    // ==========================================
    if (printingType === 'teaser') {
        return (
            <div className="font-cairo bg-white p-10 flex flex-col justify-between min-h-screen" dir="rtl" style={{ width: "210mm", margin: "0 auto" }}>
                <style>{`
                    @page { size: A4 portrait; margin: 0; }
                    body { background: white !important; margin: 0 !important; padding: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    #root > div > nav, #root > div > footer, aside, header { display: none !important; }
                `}</style>
                <div>
                    <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-8">
                        <img src={getImg("1I5KIPkeuwJ0CawpWJLpiHdmofSKLQglN")} className="h-16 object-contain" alt="Logo" />
                        <div className="text-left border-l-4 border-[#c5a059] pl-4">
                            <h1 className="text-2xl font-black text-[#1a365d] tracking-tight">سماك العقارية</h1>
                            <p className="text-[#c5a059] font-bold text-xs mt-1">سقف يعلو برؤيتك ومسكن يحكي قصتك</p>
                        </div>
                    </div>
                    
                    <div className="text-center mb-10 relative">
                        <img src={getImg("1I5KIPkeuwJ0CawpWJLpiHdmofSKLQglN")} className="absolute top-0 left-1/2 transform -translate-x-1/2 opacity-[0.03] w-[60%] pointer-events-none grayscale z-0" alt="Bg"/>
                        <div className="relative z-10">
                            <div className="inline-block px-5 py-2 rounded-full bg-[#c5a059]/10 border border-[#c5a059]/20 text-[#c5a059] font-bold text-sm mb-4">
                                ملخص تنفيذي - فرصة استثمارية {printMode === 'single' && <span className="text-[#1a365d] font-black px-1">({investors[selectedInvestorIndex]?.name})</span>}
                            </div>
                            <h2 className="text-5xl font-black text-[#1a365d] mb-3">{projectName || "مشروع سماك الصفوة 2"}</h2>
                            <p className="text-lg text-slate-500 font-bold">بناء شراكة استراتيجية بتمويل (وافي)</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-8 mb-8 relative z-10">
                        <div className="bg-slate-50 p-8 rounded-3xl border border-slate-200 text-center">
                            <p className="text-slate-500 font-bold text-base mb-2">رأس المال الاستثماري المستهدف</p>
                            <p className="text-4xl font-black text-[#1a365d] mb-2">{printMode === 'single' ? formatMoney(investors[selectedInvestorIndex]?.amount) : formatMoney(investorCapitalPool)}</p>
                            <p className="text-xs text-[#c5a059] font-bold">يغطى بتوفير الأرض والمصاريف التأسيسية</p>
                        </div>
                        <div className="bg-emerald-50 p-8 rounded-3xl border border-emerald-100 text-center">
                            <p className="text-emerald-800 font-bold text-base mb-2">المبيعات المتوقعة للمشروع</p>
                            <p className="text-4xl font-black text-emerald-600 mb-2">{formatMoney(totalSales)}</p>
                            <p className="text-xs text-emerald-600 font-bold">يتم تمويل البناء من التدفقات النقدية</p>
                        </div>
                    </div>

                    <div className="bg-[#1a365d] text-white p-10 rounded-3xl grid grid-cols-2 text-center mb-8 relative z-10" style={{backgroundColor:"#1a365d", color:"white"}}>
                        <div className="border-l border-white/20">
                            <p className="text-slate-300 font-bold mb-3 text-base">العائد المتوقع للمستثمر (ROI)</p>
                            <p className="text-5xl font-black" style={{color:"#c5a059"}}>
                                {printMode === 'single' ? (investors[selectedInvestorIndex]?.amount > 0 ? ((invProfitPool * (investors[selectedInvestorIndex].amount / investorCapitalPool)) / investors[selectedInvestorIndex].amount * 100).toFixed(1) : 0) + "%" : overAllROI.toFixed(1) + "%"}
                            </p>
                        </div>
                        <div>
                            <p className="text-slate-300 font-bold mb-3 text-base">دورة المشروع المستهدفة</p>
                            <p className="text-5xl font-black text-white">{inputs.sDuration} شهر</p>
                        </div>
                    </div>

                    <div className="bg-white border-2 border-[#c5a059]/20 p-8 rounded-3xl relative z-10">
                        <h3 className="text-xl font-black text-[#1a365d] mb-6 border-b border-slate-100 pb-3">التفاصيل المعمارية</h3>
                        <div className="grid grid-cols-3 gap-6 text-center">
                            <div><span className="block text-3xl font-black text-[#1a365d] mb-1">{totalUnits}</span><span className="text-sm font-bold text-slate-500">وحدة سكنية</span></div>
                            <div><span className="block text-3xl font-black text-[#1a365d] mb-1">{formatMoney(totalBuilt)}</span><span className="text-sm font-bold text-slate-500">متر مربع بناء</span></div>
                            <div><span className="block text-3xl font-black text-[#1a365d] mb-1">{formatMoney(totalNet)}</span><span className="text-sm font-bold text-slate-500">متر مساحة للبيع</span></div>
                        </div>
                    </div>
                </div>

                <div className="mt-auto pt-6 pb-6">
                    <div className="bg-slate-100 px-6 py-4 rounded-xl flex justify-between items-center text-sm font-bold text-slate-500" style={{backgroundColor:"#f1f5f9"}}>
                        <div className="flex flex-col"><span className="text-[#1a365d]">إدارة التطوير والاستثمار</span><span className="text-[10px]">وثيقة سرية للمستثمرين</span></div>
                        <div dir="ltr" className="flex flex-col items-end gap-1"><span>info@semak.sa | semak.sa | 920032842</span></div>
                    </div>
                </div>
            </div>
        );
    }

    if (printingType === 'detailed') {
        return (
            <div className="font-cairo bg-white p-10 flex flex-col justify-between min-h-screen" dir="rtl" style={{ width: "210mm", margin: "0 auto" }}>
                <style>{`
                    @page { size: A4 portrait; margin: 0; }
                    body { background: white !important; margin: 0 !important; padding: 0 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    #root > div > nav, #root > div > footer, aside, header { display: none !important; }
                    body.hide-dev-print .dev-profit-print-box { display: none !important; }
                    body.hide-dev-print .print-profit-grid { grid-template-columns: 1fr !important; }
                `}</style>
                <div>
                    <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-6">
                        <img src={getImg("1I5KIPkeuwJ0CawpWJLpiHdmofSKLQglN")} className="h-14 object-contain" alt="Logo" />
                        <div className="text-left border-l-4 border-[#c5a059] pl-4"><h1 className="text-xl font-black text-[#1a365d]">الملحق المالي التفصيلي</h1><p className="text-[#c5a059] font-bold text-[10px] mt-1">{projectName || "مشروع سماك الصفوة 2"}</p></div>
                    </div>
                    
                    <div className="bg-white rounded-2xl border-2 border-slate-200 overflow-hidden mb-6">
                        <table className="w-full text-right text-xs">
                            <tbody className="divide-y divide-slate-100 font-bold">
                                <tr><td className="p-3 bg-slate-50 text-slate-500 w-2/3" style={{backgroundColor:"#f8fafc"}}>رأس المال التأسيسي (الأرض + التأسيس والرخص)</td><td className="p-3 text-[#1a365d] text-sm font-black">{formatMoney(investorCapitalPool)}</td></tr>
                                <tr><td className="p-3 bg-white text-slate-500">تكلفة البناء والخدمات الإجمالية (ممول من المبيعات)</td><td className="p-3 text-[#1a365d] text-sm font-black">{formatMoney(buildCost)}</td></tr>
                                <tr><td className="p-3 bg-slate-50 text-slate-500" style={{backgroundColor:"#f8fafc"}}>ميزانية التسويق والسعي</td><td className="p-3 text-[#1a365d] text-sm font-black">{formatMoney(marketingCost)}</td></tr>
                                <tr className="border-t-2 border-red-200" style={{backgroundColor: "#fef2f2"}}><td className="p-3 font-black text-red-900">إجمالي التكاليف المتوقعة للمشروع</td><td className="p-3 text-red-700 font-black text-sm">{formatMoney(totalProjectCosts)}</td></tr>
                                <tr className="border-t-2 border-emerald-200" style={{backgroundColor: "#ecfdf5"}}><td className="p-3 font-black text-emerald-900">إجمالي المبيعات المتوقعة للمشروع</td><td className="p-3 text-emerald-700 font-black text-sm">{formatMoney(totalSales)}</td></tr>
                                <tr style={{backgroundColor: "#1a365d", color: "white"}}><td className="p-3 font-black">صافي الربح الكلي للمشروع</td><td className="p-3 font-black text-lg" style={{color:"#c5a059"}}>{formatMoney(netProfit)}</td></tr>
                            </tbody>
                        </table>
                    </div>

                    <h3 className="text-sm font-black text-[#1a365d] mb-2">توزيع حصص التمويل والأرباح على المستثمرين</h3>
                    <div className="rounded-xl border border-slate-200 overflow-hidden mb-6">
                        <table className="w-full text-right text-[10px]">
                            <thead className="border-b border-slate-200" style={{backgroundColor: "#f1f5f9"}}>
                                <tr>
                                    <th className="p-2.5 text-[#1a365d] font-black">المستثمر</th>
                                    <th className="p-2.5 text-center text-[#1a365d] font-black">المبلغ المستثمر</th>
                                    <th className="p-2.5 text-center text-[#1a365d] font-black">الحصة %</th>
                                    <th className="p-2.5 text-center text-[#1a365d] font-black">الربح المتوقع</th>
                                    <th className="p-2.5 text-center text-[#1a365d] font-black">إجمالي الاسترداد</th>
                                    <th className="p-2.5 text-center text-[#1a365d] font-black">ROI</th>
                                    <th className="p-2.5 text-center text-[#1a365d] font-black">سنوي</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 font-bold bg-white">
                                {printMode === 'single' ? (
                                    <tr>
                                        <td className="p-2.5 border-r border-slate-100">{investors[selectedInvestorIndex]?.name}</td>
                                        <td className="p-2.5 text-center border-r border-slate-100">{formatMoney(investors[selectedInvestorIndex]?.amount)}</td>
                                        <td className="p-2.5 text-center border-r border-slate-100 text-slate-500">{investorCapitalPool > 0 ? ((investors[selectedInvestorIndex]?.amount||0)/investorCapitalPool*100).toFixed(1) : 0}%</td>
                                        <td className="p-2.5 text-center border-r border-slate-100 text-emerald-600">{formatMoney(invProfitPool * ((investors[selectedInvestorIndex]?.amount||0)/investorCapitalPool))}</td>
                                        <td className="p-2.5 text-center border-r border-slate-100 text-[#c5a059] font-black">{formatMoney((investors[selectedInvestorIndex]?.amount||0) + invProfitPool * ((investors[selectedInvestorIndex]?.amount||0)/investorCapitalPool))}</td>
                                        <td className="p-2.5 text-center border-r border-slate-100">{((invProfitPool * ((investors[selectedInvestorIndex]?.amount||0)/investorCapitalPool)) / (investors[selectedInvestorIndex]?.amount||1) * 100).toFixed(1)}%</td>
                                        <td className="p-2.5 text-center text-blue-600">{(((invProfitPool * ((investors[selectedInvestorIndex]?.amount||0)/investorCapitalPool)) / (investors[selectedInvestorIndex]?.amount||1) * 100) / (inputs.sDuration/12)).toFixed(1)}%</td>
                                    </tr>
                                ) : printMode === 'summary' ? (
                                    <tr>
                                        <td className="p-2.5 border-r border-slate-100">إجمالي المستثمرين</td>
                                        <td className="p-2.5 text-center border-r border-slate-100">{formatMoney(totalInvestedVal)}</td>
                                        <td className="p-2.5 text-center border-r border-slate-100 text-slate-500">{totalInvestedPct.toFixed(1)}%</td>
                                        <td className="p-2.5 text-center border-r border-slate-100 text-emerald-600">{formatMoney(totalInvestedProfit)}</td>
                                        <td className="p-2.5 text-center border-r border-slate-100 text-[#c5a059] font-black">{formatMoney(totalInvestedVal + totalInvestedProfit)}</td>
                                        <td className="p-2.5 text-center border-r border-slate-100">{overAllROI.toFixed(1)}%</td>
                                        <td className="p-2.5 text-center text-blue-600">{annualROI.toFixed(1)}%</td>
                                    </tr>
                                ) : (
                                    <>
                                        {investors.map((inv, i) => {
                                            const pct = investorCapitalPool > 0 ? (inv.amount / investorCapitalPool) * 100 : 0;
                                            const prof = invProfitPool * (pct / 100);
                                            const r = inv.amount > 0 ? (prof / inv.amount * 100) : 0;
                                            return (
                                                <tr key={i}>
                                                    <td className="p-2.5 border-r border-slate-100">{inv.name || '---'}</td>
                                                    <td className="p-2.5 text-center border-r border-slate-100">{formatMoney(inv.amount)}</td>
                                                    <td className="p-2.5 text-center border-r border-slate-100 text-slate-500">{pct.toFixed(1)}%</td>
                                                    <td className="p-2.5 text-center border-r border-slate-100 text-emerald-600">{formatMoney(prof)}</td>
                                                    <td className="p-2.5 text-center border-r border-slate-100 text-[#c5a059] font-black">{formatMoney(inv.amount + prof)}</td>
                                                    <td className="p-2.5 text-center border-r border-slate-100">{r.toFixed(1)}%</td>
                                                    <td className="p-2.5 text-center text-blue-600">{(r / (inputs.sDuration/12)).toFixed(1)}%</td>
                                                </tr>
                                            );
                                        })}
                                        <tr style={{backgroundColor: "#f8fafc"}}>
                                            <td className="p-2.5 border-r border-slate-100 text-navy font-black">الإجمالي المجمع</td>
                                            <td className="p-2.5 text-center border-r border-slate-100 font-black">{formatMoney(totalInvestedVal)}</td>
                                            <td className="p-2.5 text-center border-r border-slate-100 font-black text-slate-500">{totalInvestedPct.toFixed(1)}%</td>
                                            <td className="p-2.5 text-center border-r border-slate-100 font-black text-emerald-600">{formatMoney(totalInvestedProfit)}</td>
                                            <td className="p-2.5 text-center border-r border-slate-100 font-black text-[#c5a059]">{formatMoney(totalInvestedVal + totalInvestedProfit)}</td>
                                            <td className="p-2.5 text-center border-r border-slate-100 font-black">{overAllROI.toFixed(1)}%</td>
                                            <td className="p-2.5 text-center text-blue-600 font-black">{annualROI.toFixed(1)}%</td>
                                        </tr>
                                    </>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="grid grid-cols-2 gap-4 flex-shrink-0 print-profit-grid">
                        <div className="border-t-4 border-[#1a365d] bg-white p-4 rounded-2xl shadow-sm border border-slate-100 dev-profit-print-box">
                            <h4 className="text-xs font-black text-[#1a365d] mb-1">حصة المطور العقاري</h4>
                            <p className="text-xl font-black text-[#1a365d] mb-1">{formatMoney(devProfit)} SAR</p>
                            <p className="text-[9px] text-slate-500 mt-1 leading-relaxed">أتعاب التطوير، الإدارة، وتغطية المخاطر حتى تسليم المفتاح عبر نظام وافي.</p>
                        </div>
                        
                        <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 flex flex-col justify-center gap-3" style={{backgroundColor:"#f8fafc"}}>
                            <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                                <span className="text-[10px] font-bold text-slate-600">تكلفة الأرض للمتر المباع</span>
                                <span className="text-sm font-black text-[#1a365d]">{formatMoney(landCostPerSqm)} SAR</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold text-slate-600">إجمالي التكلفة للمتر المباع</span>
                                <span className="text-sm font-black text-red-600">{formatMoney(totalCostPerSqm)} SAR</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-auto px-8 pb-4 pt-4">
                    <div className="bg-slate-100 rounded-xl p-3 flex justify-between items-center" style={{backgroundColor:"#f1f5f9", WebkitPrintColorAdjust:"exact"}}>
                        <div><p className="font-bold text-[#1a365d] text-xs">إدارة التطوير والاستثمار</p><p className="text-slate-500 text-[9px]">وثيقة سرية للمستثمرين</p></div>
                        <div className="text-left font-sans text-[11px] font-bold text-slate-500 flex flex-col items-end gap-0.5" dir="ltr">
                            <span>info@semak.sa | semak.sa | 920032842</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // ==========================================
    // واجهة الحاسبة الطبيعية (لا تظهر عند الطباعة)
    // ==========================================
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

                    {/* 2. المالي */}
                    <div className="bg-white rounded-3xl shadow-md border border-slate-200 p-6">
                        <h2 className="text-xl font-black text-[#1a365d] mb-6 border-b border-slate-100 pb-4">2. التكاليف والاتفاقية الشاملة</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                            <div className="space-y-4">
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <label className="block text-[11px] font-bold text-slate-600 mb-2">سعر بيع المتر / تكلفة بناء المتر / إدخال خدمات للوحدة</label>
                                    <div className="flex gap-2">
                                        <input type="number" name="finSellPrice" value={inputs.finSellPrice} onChange={handleChange} className="w-1/3 p-2 rounded-lg border border-slate-200 outline-none focus:border-[#c5a059] text-sm font-bold" title="سعر البيع" />
                                        <input type="number" name="finBuildCost" value={inputs.finBuildCost} onChange={handleChange} className="w-1/3 p-2 rounded-lg border border-slate-200 outline-none focus:border-[#c5a059] text-sm font-bold text-orange-600" title="تكلفة البناء" />
                                        <input type="number" name="inServiceCostPerUnit" value={inputs.inServiceCostPerUnit} onChange={handleChange} className="w-1/3 p-2 rounded-lg border border-slate-200 outline-none focus:border-[#c5a059] text-sm font-bold text-orange-600" title="إدخال الخدمات" />
                                    </div>
                                </div>
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                                    <label className="block text-[11px] font-bold text-slate-600 mb-1">قيمة الأرض الإجمالية / مدة المشروع (أشهر)</label>
                                    <div className="flex gap-2">
                                        <input type="number" name="finLandPrice" value={inputs.finLandPrice} onChange={handleChange} className="w-2/3 p-2 rounded-lg border border-slate-200 outline-none focus:border-[#c5a059] text-sm font-bold" />
                                        <input type="number" name="sDuration" value={inputs.sDuration} onChange={handleChange} className="w-1/3 p-2 rounded-lg border border-slate-200 outline-none focus:border-[#c5a059] text-sm font-black text-blue-600" />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-blue-50/30 p-4 rounded-2xl border border-blue-100 h-fit">
                                <label className="block text-[11px] font-bold text-blue-800 mb-3">المصاريف الإدارية والتأسيس والرخص</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <div><label className="text-[9px] text-slate-500 font-bold">وافي / هندسي / بلدية</label><div className="flex gap-1 mt-1"><input type="number" name="sWafi" value={inputs.sWafi} onChange={handleChange} className="w-1/3 p-1 border border-blue-200 text-xs rounded outline-none font-bold"/><input type="number" name="sEng" value={inputs.sEng} onChange={handleChange} className="w-1/3 p-1 border border-blue-200 text-xs rounded outline-none font-bold"/><input type="number" name="sMunicipality" value={inputs.sMunicipality} onChange={handleChange} className="w-1/3 p-1 border border-blue-200 text-xs rounded outline-none font-bold"/></div></div>
                                    <div><label className="text-[9px] text-slate-500 font-bold">مشرف / محاسب / أخرى</label><div className="flex gap-1 mt-1"><input type="number" name="sSupervision" value={inputs.sSupervision} onChange={handleChange} className="w-1/3 p-1 border border-blue-200 text-xs rounded outline-none font-bold"/><input type="number" name="sAcc" value={inputs.sAcc} onChange={handleChange} className="w-full p-1 border border-blue-200 text-xs rounded outline-none font-bold"/><input type="number" name="sOther" value={inputs.sOther} onChange={handleChange} className="w-1/3 p-1 border border-blue-200 text-xs rounded outline-none font-bold"/></div></div>
                                    <div className="bg-indigo-50 p-2 rounded border border-indigo-100"><label className="text-[9px] font-bold text-indigo-800 block">تأمين (% من بناء)</label><input type="number" name="sInsurancePct" value={inputs.sInsurancePct} onChange={handleChange} step="0.1" className="w-full p-1 rounded text-[10px] mt-1 border border-indigo-200 outline-none font-bold"/></div>
                                    <div className="bg-indigo-50 p-2 rounded border border-indigo-100"><label className="text-[9px] font-bold text-indigo-800 block">فحص (% من بناء)</label><input type="number" name="sTestingPct" value={inputs.sTestingPct} onChange={handleChange} step="0.1" className="w-full p-1 rounded text-[10px] mt-1 border border-indigo-200 outline-none font-bold"/></div>
                                </div>
                            </div>
                        </div>

                        <div className="bg-orange-50 p-5 rounded-2xl flex flex-col md:flex-row items-center gap-4 border border-orange-100">
                            <div className="flex-1 w-full">
                                <label className="text-[11px] font-bold block mb-2 text-slate-600">علاوة مستثمر % / السعي والتسويق %</label>
                                <div className="flex gap-3">
                                    <input type="number" name="inInvBonusPct" value={inputs.inInvBonusPct} onChange={handleChange} className="w-1/2 p-2 rounded-lg border border-orange-200 font-black text-orange-600 outline-none focus:border-orange-500" />
                                    <input type="number" name="sMarkPct" value={inputs.sMarkPct} onChange={handleChange} step="0.1" className="w-1/2 p-2 rounded-lg border border-emerald-200 font-black text-emerald-600 outline-none focus:border-emerald-500" />
                                </div>
                            </div>
                            <div className="w-full md:w-48 text-center bg-white p-3 rounded-xl border shadow-sm">
                                <span className="block text-[10px] font-bold text-slate-400 mb-1">حصة المستثمرين الإجمالية</span>
                                <span className="text-2xl font-black text-emerald-600">{finalInvPct.toFixed(1)}%</span>
                            </div>
                        </div>
                    </div>

                    {/* 3. قائمة المستثمرين */}
                    <div className="bg-white rounded-3xl shadow-md border border-slate-200 p-6">
                        <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                            <h2 className="text-xl font-black text-[#1a365d] flex items-center gap-2"><Users className="text-[#c5a059]"/>قائمة المستثمرين</h2>
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
                            <button onClick={() => triggerNativePrint('teaser')} className="w-full bg-[#c5a059] text-white py-4 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-yellow-600 transition shadow-lg text-lg"><Presentation size={20}/> العرض الاستثماري</button>
                            <button onClick={() => triggerNativePrint('detailed')} className="w-full bg-[#1a365d] text-white py-4 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-blue-900 transition shadow-lg text-lg"><FileSpreadsheet size={20}/> الملحق المالي التفصيلي</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}