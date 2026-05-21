import React, { useState, useEffect, useRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Calculator, Save, CloudDownload, RefreshCw, Printer, Plus, Trash2, Users, FileSpreadsheet, Presentation } from 'lucide-react';
import { API_URL, getImg } from '../../utils/helpers';
import PrintableLetterhead, { SEMAK_PRINT_CSS } from '../../components/PrintableLetterhead';

// فتح نافذة طباعة مستقلة - الهيدر/الفوتر/العلامة المائية تتكرر على كل صفحة
const printInNewWindow = (jsx, title) => {
    const html = renderToStaticMarkup(jsx);
    const w = window.open('', '_blank', 'width=900,height=1200');
    if (!w) {
        alert('يرجى السماح بفتح النوافذ المنبثقة للطباعة');
        return;
    }
    w.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
<style>${SEMAK_PRINT_CSS}</style>
</head>
<body>${html}</body>
</html>`);
    w.document.close();
    w.onload = () => {
        const tryPrint = () => { w.focus(); w.print(); };
        if (w.document.fonts && w.document.fonts.ready) {
            w.document.fonts.ready.then(() => setTimeout(tryPrint, 200));
        } else {
            setTimeout(tryPrint, 500);
        }
    };
};

export default function FeasibilityCalc({ showToast }) {
    const [loading, setLoading] = useState(false);
    const [savedProjects, setSavedProjects] = useState([]);
    const [currentProjectId, setCurrentProjectId] = useState("");
    const [projectName, setProjectName] = useState("");

    // refs غير مستخدمة بعد التحويل لـ window.print() — تُحذف

    // خيارات الطباعة
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

    // --- العمليات الحسابية المباشرة ---
    const groundBuilt = inputs.archLandArea * (inputs.archGroundPct / 100);
    const typicalBuilt = inputs.archLandArea * (inputs.archTypicalPct / 100);
    const roofBuilt = typicalBuilt * (inputs.archRoofPct / 100);
    const totalBuilt = groundBuilt + (typicalBuilt * inputs.archFloorsCount) + roofBuilt;
    const floorCountTotal = 1 + inputs.archFloorsCount + (roofBuilt > 0 ? 1 : 0);
    const totalNet = Math.max(0, totalBuilt - (inputs.archCommonArea * floorCountTotal));
    const totalUnits = inputs.uGround + (inputs.uTypical * inputs.archFloorsCount) + inputs.uRoof;

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

    // --- الاتصال بقاعدة البيانات ---
    useEffect(() => { loadProjectsList(); }, []);

    const loadProjectsList = async () => {
        try {
            const res = await fetch(`${API_URL}?action=get_feasibilities`);
            const data = await res.json();
            if(data.success) setSavedProjects(data.data);
        } catch(e) {}
    };

    const handleSaveCloud = async () => {
        if(!projectName.trim()) return showToast?.("تنبيه", "يرجى كتابة اسم المشروع", "error") || alert("يرجى كتابة اسم المشروع");
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
                showToast?.("نجاح", "تم حفظ المشروع في السحابة!") || alert("تم حفظ المشروع بنجاح");
                setCurrentProjectId(data.id);
                loadProjectsList();
            }
        } catch(e) { showToast?.("خطأ", "فشل الاتصال", "error"); }
        finally { setLoading(false); }
    };

    const handleLoadCloud = async (id) => {
        if(!id) return;
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}?action=get_feasibility_data&id=${id}`);
            const data = await res.json();
            if(data.success) {
                setInputs(data.data.inputs);
                setInvestors(data.data.investors);
                setCurrentProjectId(id);
                setProjectName(savedProjects.find(p=>p.id==id)?.project_name || "");
                showToast?.("نجاح", "تم استدعاء بيانات المشروع");
            }
        } catch(e) {} finally { setLoading(false); }
    };

    // الـ JSX للطباعة (يُولّد عند الضغط ويُحقن في نافذة جديدة)
    const buildTeaserJSX = () => (
        <PrintableLetterhead documentLabel="عرض استثماري" subtitle={projectName || 'مشروع سماك'} date={new Date().toLocaleDateString('en-GB')}>
            <TeaserContent />
        </PrintableLetterhead>
    );
    const buildDetailedJSX = () => (
        <PrintableLetterhead documentLabel="الملحق المالي التفصيلي" subtitle={projectName || 'مشروع سماك'} date={new Date().toLocaleDateString('en-GB')}>
            <DetailedContent />
        </PrintableLetterhead>
    );
    const handlePrintTeaser   = () => printInNewWindow(buildTeaserJSX(),  `عرض_استثماري_${projectName || 'سماك'}`);
    const handlePrintDetailed = () => printInNewWindow(buildDetailedJSX(), `الملحق_المالي_${projectName || 'سماك'}`);

    // مكوّنات الطباعة (داخلية في FeasibilityCalc لتصل للحالة)
    function TeaserContent() {
        return (
                    <div style={{ fontFamily: 'Cairo, sans-serif', fontSize: '13px', color: '#1e293b' }}>
                        {/* العنوان */}
                        <div style={{ textAlign: 'center', margin: '6mm 0 8mm' }}>
                            <div style={{ display: 'inline-block', padding: '6px 14px', borderRadius: '999px', backgroundColor: 'rgba(197,160,89,0.10)', border: '1px solid rgba(197,160,89,0.25)', color: '#c5a059', fontWeight: 700, fontSize: '11px', marginBottom: '10px' }}>ملخص تنفيذي - فرصة استثمارية</div>
                            <h2 style={{ fontSize: '30px', fontWeight: 900, color: '#1a365d', margin: '0 0 6px' }}>{projectName || 'مشروع سماك الصفوة'}</h2>
                            <p style={{ fontSize: '12px', color: '#64748b', fontWeight: 700, margin: 0 }}>بناء شراكة استراتيجية بتمويل (وافي)</p>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '10mm' }}>
                            <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '20px', padding: '18px', textAlign: 'center' }}>
                                <p style={{ color: '#64748b', fontWeight: 700, fontSize: '12px', margin: '0 0 6px' }}>رأس المال الاستثماري المستهدف</p>
                                <p style={{ fontSize: '24px', fontWeight: 900, color: '#1a365d', margin: '0 0 4px' }}>{printMode === 'single' ? formatMoney(investors[selectedInvestorIndex]?.amount) : formatMoney(investorCapitalPool)}</p>
                                <p style={{ fontSize: '9px', color: '#c5a059', fontWeight: 700, margin: 0 }}>يغطى بتوفير الأرض والمصاريف التأسيسية</p>
                            </div>
                            <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '20px', padding: '18px', textAlign: 'center' }}>
                                <p style={{ color: '#065f46', fontWeight: 700, fontSize: '12px', margin: '0 0 6px' }}>المبيعات المتوقعة للمشروع</p>
                                <p style={{ fontSize: '24px', fontWeight: 900, color: '#059669', margin: '0 0 4px' }}>{formatMoney(totalSales)}</p>
                                <p style={{ fontSize: '9px', color: '#059669', fontWeight: 700, margin: 0 }}>يتم تمويل البناء من التدفقات النقدية</p>
                            </div>
                        </div>
                        <div style={{ backgroundColor: '#1a365d', color: 'white', padding: '20px', borderRadius: '20px', display: 'grid', gridTemplateColumns: '1fr 1fr', textAlign: 'center', marginBottom: '10mm' }}>
                            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.2)' }}>
                                <p style={{ color: '#cbd5e1', fontWeight: 700, fontSize: '12px', margin: '0 0 4px' }}>العائد المتوقع (ROI)</p>
                                <p style={{ fontSize: '28px', fontWeight: 900, color: '#c5a059', margin: 0 }}>
                                    {printMode === 'single'
                                        ? (investors[selectedInvestorIndex]?.amount > 0 ? (invProfitPool * (investors[selectedInvestorIndex].amount / investorCapitalPool) / investors[selectedInvestorIndex].amount * 100).toFixed(1) : 0) + '%'
                                        : overAllROI.toFixed(1) + '%'}
                                </p>
                            </div>
                            <div>
                                <p style={{ color: '#cbd5e1', fontWeight: 700, fontSize: '12px', margin: '0 0 4px' }}>دورة المشروع المستهدفة</p>
                                <p style={{ fontSize: '28px', fontWeight: 900, color: 'white', margin: 0 }}>{inputs.sDuration} شهر</p>
                            </div>
                        </div>
                        <div style={{ backgroundColor: '#ffffff', border: '2px solid rgba(197,160,89,0.2)', padding: '14px 18px', borderRadius: '20px' }}>
                            <h3 style={{ fontSize: '15px', fontWeight: 900, color: '#1a365d', margin: '0 0 10px', borderBottom: '1px solid #f1f5f9', paddingBottom: '6px' }}>التفاصيل المعمارية</h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', textAlign: 'center' }}>
                                <div><span style={{ display: 'block', fontSize: '22px', fontWeight: 900, color: '#1a365d' }}>{totalUnits}</span><span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>وحدة سكنية</span></div>
                                <div><span style={{ display: 'block', fontSize: '22px', fontWeight: 900, color: '#1a365d' }}>{formatMoney(totalBuilt)}</span><span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>متر مربع بناء</span></div>
                                <div><span style={{ display: 'block', fontSize: '22px', fontWeight: 900, color: '#1a365d' }}>{formatMoney(totalNet)}</span><span style={{ fontSize: '10px', fontWeight: 700, color: '#64748b' }}>متر مساحة للبيع</span></div>
                            </div>
                        </div>
                        <div style={{ marginTop: '10mm', backgroundColor: '#f1f5f9', padding: '8px 14px', borderRadius: '10px', fontSize: '10px', color: '#475569', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>إدارة التطوير والاستثمار — وثيقة سرية</span>
                            <span dir="ltr">info@semak.sa | semak.sa | 920032842</span>
                        </div>
                    </div>
        );
    }
    function DetailedContent() {
        return (
                    <div style={{ fontFamily: 'Cairo, sans-serif', color: '#1e293b' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 900, color: '#1a365d', margin: '0 0 8px' }}>اقتصاديات المشروع الإجمالية</h3>
                        <div style={{ border: '2px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden', marginBottom: '6mm' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'right' }}>
                                <tbody>
                                    <tr style={{ backgroundColor: '#f8fafc' }}>
                                        <td style={{ padding: '10px 14px', color: '#475569', fontWeight: 700, width: '66%' }}>رأس المال التأسيسي (الأرض + التأسيس والرخص)</td>
                                        <td style={{ padding: '10px 14px', color: '#1a365d', fontWeight: 900 }}>{formatMoney(investorCapitalPool)} ريال</td>
                                    </tr>
                                    <tr>
                                        <td style={{ padding: '10px 14px', color: '#475569', fontWeight: 700 }}>تكلفة البناء والخدمات (تُمَول من المبيعات)</td>
                                        <td style={{ padding: '10px 14px', color: '#1a365d', fontWeight: 900 }}>{formatMoney(buildCost)} ريال</td>
                                    </tr>
                                    <tr style={{ backgroundColor: '#f8fafc' }}>
                                        <td style={{ padding: '10px 14px', color: '#475569', fontWeight: 700 }}>ميزانية التسويق والسعي</td>
                                        <td style={{ padding: '10px 14px', color: '#1a365d', fontWeight: 900 }}>{formatMoney(marketingCost)} ريال</td>
                                    </tr>
                                    <tr style={{ backgroundColor: '#fef2f2', borderTop: '2px solid #fecaca' }}>
                                        <td style={{ padding: '10px 14px', color: '#7f1d1d', fontWeight: 900 }}>إجمالي التكاليف المتوقعة للمشروع</td>
                                        <td style={{ padding: '10px 14px', color: '#b91c1c', fontWeight: 900 }}>{formatMoney(totalProjectCosts)} ريال</td>
                                    </tr>
                                    <tr style={{ backgroundColor: '#ecfdf5', borderTop: '2px solid #a7f3d0' }}>
                                        <td style={{ padding: '10px 14px', color: '#064e3b', fontWeight: 900 }}>إجمالي المبيعات المتوقعة للمشروع</td>
                                        <td style={{ padding: '10px 14px', color: '#047857', fontWeight: 900 }}>{formatMoney(totalSales)} ريال</td>
                                    </tr>
                                    <tr style={{ backgroundColor: '#1a365d', color: 'white' }}>
                                        <td style={{ padding: '12px 14px', fontWeight: 900, color: 'white' }}>صافي الربح الكلي للمشروع</td>
                                        <td style={{ padding: '12px 14px', color: '#c5a059', fontWeight: 900, fontSize: '15px' }}>{formatMoney(netProfit)} ريال</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                        <h3 style={{ fontSize: '14px', fontWeight: 900, color: '#1a365d', margin: '8mm 0 8px' }}>توزيع حصص التمويل والأرباح</h3>
                        <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', marginBottom: '6mm' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', textAlign: 'right' }}>
                                <thead style={{ backgroundColor: '#f1f5f9' }}>
                                    <tr>
                                        <th style={{ padding: '8px', color: '#1a365d', fontWeight: 900 }}>المستثمر</th>
                                        <th style={{ padding: '8px', color: '#1a365d', fontWeight: 900, textAlign: 'center' }}>المبلغ</th>
                                        <th style={{ padding: '8px', color: '#1a365d', fontWeight: 900, textAlign: 'center' }}>الحصة %</th>
                                        <th style={{ padding: '8px', color: '#1a365d', fontWeight: 900, textAlign: 'center' }}>الربح المتوقع</th>
                                        <th style={{ padding: '8px', color: '#1a365d', fontWeight: 900, textAlign: 'center' }}>إجمالي الاسترداد</th>
                                        <th style={{ padding: '8px', color: '#1a365d', fontWeight: 900, textAlign: 'center' }}>ROI</th>
                                        <th style={{ padding: '8px', color: '#1a365d', fontWeight: 900, textAlign: 'center' }}>سنوي</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {investors.map((inv, i) => {
                                        const pct = investorCapitalPool > 0 ? (inv.amount / investorCapitalPool) * 100 : 0;
                                        const prof = invProfitPool * (pct / 100);
                                        const r = inv.amount > 0 ? (prof / inv.amount * 100) : 0;
                                        return (
                                            <tr key={i} style={{ backgroundColor: i % 2 === 0 ? 'white' : '#fafbfc' }}>
                                                <td style={{ padding: '8px' }}>{inv.name || '---'}</td>
                                                <td style={{ padding: '8px', textAlign: 'center' }}>{formatMoney(inv.amount)}</td>
                                                <td style={{ padding: '8px', textAlign: 'center', color: '#64748b' }}>{pct.toFixed(1)}%</td>
                                                <td style={{ padding: '8px', textAlign: 'center', color: '#059669' }}>{formatMoney(prof)}</td>
                                                <td style={{ padding: '8px', textAlign: 'center', color: '#c5a059', fontWeight: 900 }}>{formatMoney(inv.amount + prof)}</td>
                                                <td style={{ padding: '8px', textAlign: 'center' }}>{r.toFixed(1)}%</td>
                                                <td style={{ padding: '8px', textAlign: 'center', color: '#2563eb' }}>{(r / (inputs.sDuration/12)).toFixed(1)}%</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: showDevInPrint ? '1fr 1fr' : '1fr', gap: '10px' }}>
                            {showDevInPrint && (
                                <div style={{ borderTop: '4px solid #1a365d', backgroundColor: 'white', padding: '12px 14px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                                    <h4 style={{ fontSize: '11px', fontWeight: 900, color: '#1a365d', margin: '0 0 4px' }}>حصة المطور العقاري (أتعاب التطوير)</h4>
                                    <p style={{ fontSize: '18px', fontWeight: 900, color: '#1a365d', margin: '0 0 4px' }}>{formatMoney(devProfit)} ريال</p>
                                    <p style={{ fontSize: '9px', color: '#64748b', margin: 0, lineHeight: 1.6 }}>أتعاب التطوير، الإدارة، وتغطية المخاطر حتى تسليم المفتاح عبر نظام وتراخيص وافي.</p>
                                </div>
                            )}
                            <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '14px', border: '1px solid #e2e8f0' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #e2e8f0', paddingBottom: '6px', marginBottom: '6px' }}>
                                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>تكلفة الأرض للمتر المباع</span>
                                    <span style={{ fontSize: '12px', fontWeight: 900, color: '#1a365d' }}>{formatMoney(landCostPerSqm)} ريال</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569' }}>إجمالي التكلفة للمتر المباع</span>
                                    <span style={{ fontSize: '12px', fontWeight: 900, color: '#dc2626' }}>{formatMoney(totalCostPerSqm)} ريال</span>
                                </div>
                            </div>
                        </div>
                        <div style={{ marginTop: '6mm', backgroundColor: '#f1f5f9', padding: '8px 14px', borderRadius: '10px', fontSize: '10px', color: '#475569', fontWeight: 700, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>إدارة التطوير والاستثمار — وثيقة سرية</span>
                            <span dir="ltr">info@semak.sa | semak.sa | 920032842</span>
                        </div>
                    </div>
        );
    }

    return (
        <div className="animate-fadeIn pb-10 font-cairo" dir="rtl">
            
            {/* شريط الإدارة السحابية */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 mb-8 flex flex-col md:flex-row items-end gap-4">
                <div className="flex-1 w-full">
                    <label className="block text-xs font-bold text-[#1a365d] mb-2">اسم المشروع الحالي</label>
                    <input type="text" value={projectName} onChange={e=>setProjectName(e.target.value)} placeholder="اكتب اسم المشروع للحفظ..." className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-[#1a365d] outline-none focus:border-[#c5a059]" />
                </div>
                <button onClick={handleSaveCloud} disabled={loading} className="bg-emerald-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-emerald-700 transition flex items-center gap-2 shadow-md w-full md:w-auto justify-center">
                    {loading ? <RefreshCw size={18} className="animate-spin"/> : <Save size={18}/>} حفظ المشروع
                </button>
                <div className="w-px bg-slate-200 hidden md:block h-12 mx-2"></div>
                <div className="flex-1 w-full flex items-end gap-2">
                    <div className="w-full">
                        <label className="block text-xs font-bold text-slate-500 mb-2">المشاريع المحفوظة</label>
                        <select onChange={(e) => handleLoadCloud(e.target.value)} value={currentProjectId} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl font-bold text-[#1a365d] outline-none cursor-pointer">
                            <option value="">-- استدعاء مشروع محفوظ --</option>
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
                            <Calculator className="text-[#c5a059]" /> <h2 className="text-lg font-black">1. الموجه المعماري والمالي الأساسي</h2>
                        </div>
                        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 border-b border-slate-100">
                            <div><label className="text-[10px] font-bold block mb-1">مساحة الأرض</label><input type="number" name="archLandArea" value={inputs.archLandArea} onChange={handleChange} className="w-full p-2 rounded border" /></div>
                            <div><label className="text-[10px] font-bold block mb-1">خدمات الدور</label><input type="number" name="archCommonArea" value={inputs.archCommonArea} onChange={handleChange} className="w-full p-2 rounded border" /></div>
                            <div><label className="text-[10px] font-bold block mb-1">الأدوار المتكررة</label><input type="number" name="archFloorsCount" value={inputs.archFloorsCount} onChange={handleChange} className="w-full p-2 rounded border" /></div>
                            <div><label className="text-[10px] font-bold block mb-1">نسبة الملحق %</label><input type="number" name="archRoofPct" value={inputs.archRoofPct} onChange={handleChange} className="w-full p-2 rounded border" /></div>
                        </div>
                        <div className="p-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                            <div className="border p-3 rounded-xl"><label className="text-xs text-slate-500 block">بناء الأرضي %</label><input type="number" name="archGroundPct" value={inputs.archGroundPct} onChange={handleChange} className="w-full border-b mb-2" /><label className="text-xs text-[#c5a059] font-bold block">وحدات الأرضي</label><input type="number" name="uGround" value={inputs.uGround} onChange={handleChange} className="w-full font-bold text-navy" /></div>
                            <div className="border p-3 rounded-xl"><label className="text-xs text-slate-500 block">بناء المتكرر %</label><input type="number" name="archTypicalPct" value={inputs.archTypicalPct} onChange={handleChange} className="w-full border-b mb-2" /><label className="text-xs text-[#c5a059] font-bold block">وحدات المتكرر</label><input type="number" name="uTypical" value={inputs.uTypical} onChange={handleChange} className="w-full font-bold text-navy" /></div>
                            <div className="border p-3 rounded-xl flex flex-col justify-end"><label className="text-xs text-[#c5a059] font-bold block mb-2">وحدات الملحق</label><input type="number" name="uRoof" value={inputs.uRoof} onChange={handleChange} className="w-full font-bold text-navy" /></div>
                        </div>
                    </div>

                    {/* 2. المالي */}
                    <div className="bg-white rounded-3xl shadow-md border border-slate-200 p-6">
                        <h2 className="text-xl font-black text-[#1a365d] mb-4 border-b pb-4">2. التكاليف والرخص والمحاصة</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                            <div className="bg-slate-50 p-4 rounded-xl border flex gap-2">
                                <div className="flex-1"><label className="text-[10px] font-bold">سعر البيع</label><input type="number" name="finSellPrice" value={inputs.finSellPrice} onChange={handleChange} className="w-full p-2 rounded border" /></div>
                                <div className="flex-1"><label className="text-[10px] font-bold text-orange-600">تكلفة البناء</label><input type="number" name="finBuildCost" value={inputs.finBuildCost} onChange={handleChange} className="w-full p-2 rounded border text-orange-600" /></div>
                                <div className="flex-1"><label className="text-[10px] font-bold">قيمة الأرض</label><input type="number" name="finLandPrice" value={inputs.finLandPrice} onChange={handleChange} className="w-full p-2 rounded border" /></div>
                            </div>
                            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 grid grid-cols-3 gap-2">
                                <div><label className="text-[9px]">وافي</label><input type="number" name="sWafi" value={inputs.sWafi} onChange={handleChange} className="w-full p-1 border text-xs rounded"/></div>
                                <div><label className="text-[9px]">هندسي</label><input type="number" name="sEng" value={inputs.sEng} onChange={handleChange} className="w-full p-1 border text-xs rounded"/></div>
                                <div><label className="text-[9px]">البلدية</label><input type="number" name="sMunicipality" value={inputs.sMunicipality} onChange={handleChange} className="w-full p-1 border text-xs rounded"/></div>
                                <div><label className="text-[9px]">مشرف</label><input type="number" name="sSupervision" value={inputs.sSupervision} onChange={handleChange} className="w-full p-1 border text-xs rounded"/></div>
                                <div><label className="text-[9px]">محاسب</label><input type="number" name="sAcc" value={inputs.sAcc} onChange={handleChange} className="w-full p-1 border text-xs rounded"/></div>
                                <div><label className="text-[9px]">أخرى</label><input type="number" name="sOther" value={inputs.sOther} onChange={handleChange} className="w-full p-1 border text-xs rounded"/></div>
                            </div>
                        </div>
                        <div className="bg-orange-50 p-4 rounded-2xl flex items-center gap-4 border border-orange-100">
                            <div className="flex-1 flex gap-2">
                                <div className="flex-1"><label className="text-[10px] font-bold text-orange-800 mb-1 block">علاوة مستثمر %</label><input type="number" name="inInvBonusPct" value={inputs.inInvBonusPct} onChange={handleChange} className="w-full p-2 rounded border border-orange-200 text-orange-700 font-bold" /></div>
                                <div className="flex-1"><label className="text-[10px] font-bold text-emerald-800 mb-1 block">تسويق وسعي %</label><input type="number" name="sMarkPct" value={inputs.sMarkPct} onChange={handleChange} className="w-full p-2 rounded border border-emerald-200 text-emerald-700 font-bold" /></div>
                                <div className="flex-1"><label className="text-[10px] font-bold text-slate-800 mb-1 block">مدة المشروع</label><input type="number" name="sDuration" value={inputs.sDuration} onChange={handleChange} className="w-full p-2 rounded border border-slate-200 font-bold" /></div>
                            </div>
                            <div className="w-32 text-center bg-white p-2 rounded-xl border shadow-sm"><span className="block text-[9px] text-slate-400">حصة المستثمر</span><span className="text-xl font-black text-emerald-600">{finalInvPct.toFixed(1)}%</span></div>
                        </div>
                    </div>

                    {/* 3. قائمة المستثمرين */}
                    <div className="bg-white rounded-3xl shadow-md border border-slate-200 p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-black text-[#1a365d]"><Users className="inline text-[#c5a059] mr-2"/>قائمة المستثمرين</h2>
                            <button onClick={addInvestorRow} className="bg-[#1a365d] text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-800 transition flex items-center gap-1 shadow-sm"><Plus size={14}/> إضافة مستثمر</button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-right text-sm">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr className="text-slate-600">
                                        <th className="p-3">الاسم</th><th className="p-3">المبلغ المستثمر</th><th className="p-3 text-center">الربح المتوقع</th><th className="p-3 text-center">إجراء</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {investors.map((inv, i) => {
                                        const pct = investorCapitalPool > 0 ? (inv.amount / investorCapitalPool) * 100 : 0;
                                        const prof = invProfitPool * (pct / 100);
                                        return (
                                            <tr key={i} className="hover:bg-slate-50 transition">
                                                <td className="p-2"><input type="text" value={inv.name} onChange={e=>handleInvestorChange(i, 'name', e.target.value)} className="border border-slate-200 p-2 rounded-lg w-full text-sm outline-none focus:border-gold" placeholder="اسم المستثمر..." /></td>
                                                <td className="p-2"><input type="number" value={inv.amount} onChange={e=>handleInvestorChange(i, 'amount', e.target.value)} className="border border-slate-200 p-2 rounded-lg w-full text-sm font-black text-[#1a365d] outline-none focus:border-gold" /></td>
                                                <td className="p-2 text-emerald-600 font-black text-center bg-slate-50/50">{formatMoney(prof)}</td>
                                                <td className="p-2 text-center"><button onClick={() => removeInvestor(i)} className="text-red-400 hover:text-red-600 bg-white border border-slate-200 p-1.5 rounded shadow-sm transition"><Trash2 size={16}/></button></td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                                <tfoot className="bg-slate-50 font-black border-t-2 border-slate-200">
                                    <tr>
                                        <td className="p-3 text-[#1a365d]">الإجمالي المجمع</td>
                                        <td className="p-3 text-[#1a365d]">{formatMoney(totalInvestedVal)}</td>
                                        <td className="p-3 text-center text-emerald-600">{formatMoney(invProfitPool * (totalInvestedPct/100))}</td>
                                        <td className="p-3 text-center text-xs text-slate-500">{totalInvestedPct.toFixed(1)}%</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>

                <div className="xl:col-span-4 space-y-6">
                    {/* ملخص اقتصاديات المشروع */}
                    <div className="bg-[#1a365d] text-white rounded-3xl shadow-xl p-6 border-b-8 border-[#c5a059] relative overflow-hidden">
                         <h3 className="text-base font-black text-[#c5a059] mb-6 border-b border-white/10 pb-3">ملخص اقتصاديات المشروع</h3>
                         <div className="space-y-3 text-sm font-bold relative z-10">
                             <div className="flex justify-between border-b border-white/5 pb-2"><span>إجمالي المبيعات</span> <span className="text-emerald-400 font-black">{formatMoney(totalSales)}</span></div>
                             <div className="flex justify-between border-b border-white/5 pb-2"><span>تكلفة البناء</span> <span className="text-red-300 font-black">{formatMoney(buildCost)}</span></div>
                             <div className="flex justify-between border-b border-white/5 pb-2"><span>التأسيس والرخص</span> <span className="text-red-300 font-black">{formatMoney(softCosts)}</span></div>
                             <div className="flex justify-between border-b border-white/5 pb-2"><span>السعي والتسويق</span> <span className="text-orange-400 font-black">{formatMoney(marketingCost)}</span></div>
                             <div className="flex justify-between pt-2 border-t border-white/20 text-lg"><span>صافي الربح الكلي</span> <span className="text-emerald-400 font-black">{formatMoney(netProfit)}</span></div>
                         </div>
                    </div>

                    {/* إعدادات وتوليد الطباعة */}
                    <div className="bg-white p-6 rounded-[2rem] shadow-md border border-slate-200">
                        <label className="block text-sm font-black text-[#1a365d] mb-4 border-b border-slate-100 pb-3">خيارات العروض والطباعة</label>
                        
                        <div className="mb-4">
                            <label className="block text-[11px] font-bold text-slate-500 mb-2">طريقة عرض المستثمرين في التقرير:</label>
                            <select value={printMode} onChange={e=>setPrintMode(e.target.value)} className="w-full p-2.5 border border-slate-200 rounded-lg mb-2 text-sm font-bold bg-slate-50 text-navy outline-none focus:border-[#c5a059]">
                                <option value="all">إظهار كافة المستثمرين (قائمة مفصلة)</option>
                                <option value="summary">إظهار الإجمالي فقط (ملخص بدون أسماء)</option>
                                <option value="single">تخصيص التقرير لمستثمر محدد</option>
                            </select>
                            
                            {printMode === 'single' && (
                                <select value={selectedInvestorIndex} onChange={e=>setSelectedInvestorIndex(e.target.value)} className="w-full p-2.5 border border-[#c5a059] rounded-lg mb-2 text-sm font-black bg-orange-50 text-orange-800 outline-none">
                                    {investors.map((inv, i) => <option key={i} value={i}>{inv.name || `مستثمر ${i+1}`}</option>)}
                                </select>
                            )}
                        </div>

                        <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100 mb-5 cursor-pointer">
                            <input type="checkbox" id="devToggle" checked={showDevInPrint} onChange={e=>setShowDevInPrint(e.target.checked)} className="w-4 h-4 accent-[#c5a059] cursor-pointer" /> 
                            <label htmlFor="devToggle" className="text-xs font-bold text-navy cursor-pointer select-none">إظهار تفاصيل المطور في الملحق</label>
                        </div>

                        <div className="flex flex-col gap-3 border-t border-slate-100 pt-5">
                            <button onClick={handlePrintTeaser} className="w-full bg-[#c5a059] text-white py-3.5 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-yellow-600 transition shadow-lg"><Presentation size={18}/> العرض الاستثماري (الملخص)</button>
                            <button onClick={handlePrintDetailed} className="w-full bg-[#1a365d] text-white py-3.5 rounded-xl font-black flex items-center justify-center gap-2 hover:bg-blue-900 transition shadow-lg"><FileSpreadsheet size={18}/> الملحق المالي التفصيلي</button>
                        </div>
                    </div>
                </div>
            </div>
            

        </div>
    );
}