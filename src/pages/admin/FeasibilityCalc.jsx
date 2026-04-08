import React, { useState, useEffect } from 'react';
import { 
    Calculator, Save, RefreshCw, Plus, Trash2, Users, 
    FileSpreadsheet, Presentation, LayoutDashboard, 
    Landmark, Briefcase, FileText, DownloadCloud, ChevronDown 
} from 'lucide-react';
import { API_URL, getImg } from '../../utils/helpers';

const InputField = ({ label, name, value, onChange, type = "number", span = 1, step, textClass = "text-[#1a365d]" }) => (
    <div className={`col-span-${span}`}>
        <label className="block text-[11px] font-black text-slate-500 mb-2">{label}</label>
        <input 
            type={type} 
            name={name} 
            value={value === 0 && type === "number" ? '' : value}
            onChange={onChange} 
            step={step} 
            placeholder="0"
            className={`w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 outline-none focus:border-[#c5a059] focus:ring-2 focus:ring-[#c5a059]/20 transition-all font-black text-base ${textClass}`} 
        />
    </div>
);

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

    const handleChange = (e) => {
        const val = e.target.value;
        setInputs(prev => ({ 
            ...prev, 
            [e.target.name]: val === "" ? "" : parseFloat(val) 
        }));
    };

    const handleInvestorChange = (index, field, value) => {
        setInvestors(prev => {
            const newInvestors = [...prev];
            newInvestors[index] = { 
                ...newInvestors[index], 
                [field]: field === 'amount' ? (value === "" ? "" : parseFloat(value)) : value 
            };
            return newInvestors;
        });
    };

    const addInvestorRow = () => setInvestors(prev => [...prev, { name: "", amount: 0 }]);
    const removeInvestor = (index) => setInvestors(prev => prev.filter((_, i) => i !== index));
    const formatMoney = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n || 0);

    // --- العمليات الحسابية ---
    const archLandArea = inputs.archLandArea || 0;
    const archCommonArea = inputs.archCommonArea || 0;
    const finSellPrice = inputs.finSellPrice || 0;
    const finLandPrice = inputs.finLandPrice || 0;

    const groundBuilt = archLandArea * ((inputs.archGroundPct || 0) / 100);
    const typicalBuilt = archLandArea * ((inputs.archTypicalPct || 0) / 100);
    const roofBuilt = typicalBuilt * ((inputs.archRoofPct || 0) / 100);
    
    const floorsCount = inputs.archFloorsCount || 0;
    const totalBuilt = groundBuilt + (typicalBuilt * floorsCount) + roofBuilt;
    const floorCountTotal = 1 + floorsCount + (roofBuilt > 0 ? 1 : 0);
    const totalNet = Math.max(0, totalBuilt - (archCommonArea * floorCountTotal));
    
    const landCostPerSqm = totalNet > 0 ? (finLandPrice / totalNet) : 0;

    const uGround = inputs.uGround || 0;
    const uTypical = inputs.uTypical || 0;
    const uRoof = inputs.uRoof || 0;
    const totalUnits = uGround + (uTypical * floorsCount) + uRoof;

    const netGround = Math.max(0, groundBuilt - archCommonArea);
    const avgGround = uGround > 0 ? netGround / uGround : 0;
    
    const netTypical = Math.max(0, typicalBuilt - archCommonArea);
    const avgTypical = uTypical > 0 ? netTypical / uTypical : 0;
    
    const netRoof = Math.max(0, roofBuilt - archCommonArea);
    const avgRoof = uRoof > 0 ? netRoof / uRoof : 0;

    const roofSurfaceSalesValue = uRoof > 0 ? (netRoof * landCostPerSqm) : 0;
    const totalSales = (totalNet * finSellPrice) + roofSurfaceSalesValue;
    
    const floorsData = [];
    if (groundBuilt > 0) floorsData.push({ label: "الدور الأرضي", built: groundBuilt, net: netGround, units: uGround });
    if (typicalBuilt > 0 && floorsCount > 0) {
        for(let i=1; i<=floorsCount; i++) floorsData.push({ label: `متكرر ${i}`, built: typicalBuilt, net: netTypical, units: uTypical });
    }
    if (roofBuilt > 0) floorsData.push({ label: "الملحق (الروف)", built: roofBuilt, net: netRoof, units: uRoof });

    const marketingCost = totalSales * ((inputs.sMarkPct || 0) / 100);
    const buildCost = (totalNet * (inputs.finBuildCost || 0)) + (totalUnits * (inputs.inServiceCostPerUnit || 0));
    const insCost = buildCost * ((inputs.sInsurancePct || 0) / 100);
    const testCost = buildCost * ((inputs.sTestingPct || 0) / 100);
    const softCosts = (inputs.sWafi || 0) + (inputs.sEng || 0) + (inputs.sMunicipality || 0) + (inputs.sSupervision || 0) + (inputs.sAcc || 0) + (inputs.sOther || 0) + insCost + testCost;

    const totalProjectCosts = finLandPrice + buildCost + softCosts + marketingCost;
    const netProfit = totalSales - totalProjectCosts;

    const investorCapitalPool = finLandPrice + softCosts;
    const baseInvPct = totalProjectCosts > 0 ? (investorCapitalPool / totalProjectCosts) * 100 : 0;
    const finalInvPct = Math.min(100, Math.max(0, baseInvPct + (inputs.inInvBonusPct || 0)));
    
    const invProfitPool = netProfit * (finalInvPct / 100);
    const devProfit = netProfit * ( (100 - finalInvPct) / 100 );

    const overAllROI = investorCapitalPool > 0 ? (invProfitPool / investorCapitalPool) * 100 : 0;
    const sDuration = inputs.sDuration || 0;
    const annualROI = sDuration > 0 ? overAllROI / (sDuration / 12) : 0;

    const totalCostPerSqm = totalNet > 0 ? (totalProjectCosts / totalNet) : 0;

    const totalInvestedVal = investors.reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0);
    const totalInvestedPct = investorCapitalPool > 0 ? (totalInvestedVal / investorCapitalPool) * 100 : 0;
    const totalInvestedProfit = invProfitPool * (totalInvestedPct / 100);

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
        const cleanInvestors = investors.map(inv => ({ name: inv.name, amount: Number(inv.amount) || 0 }));
        const payload = { 
            id: currentProjectId || null, 
            project_name: projectName, 
            data: { inputs: { ...inputs }, investors: cleanInvestors } 
        };

        try {
            const res = await fetch(`${API_URL}?action=save_feasibility`, {
                method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload)
            });
            const data = await res.json();
            if(data.success) {
                if(showToast) showToast("نجاح", "تم حفظ المشروع والمستثمرين في السحابة!"); else alert("تم الحفظ بنجاح");
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
                if (parsedData) {
                    if (parsedData.inputs) setInputs(prev => ({ ...prev, ...parsedData.inputs }));
                    if (parsedData.investors && Array.isArray(parsedData.investors) && parsedData.investors.length > 0) {
                        setInvestors(parsedData.investors);
                    } else {
                        setInvestors([{ name: "الشريك الاستراتيجي", amount: parsedData.inputs?.finLandPrice || 0 }]);
                    }
                    setCurrentProjectId(id);
                    setProjectName(savedProjects.find(p=>p.id==id)?.project_name || "");
                    if(showToast) showToast("نجاح", "تم استدعاء بيانات المشروع كاملة");
                }
            }
        } catch(e) {} finally { setLoading(false); }
    };

    // =======================================================
    // 🔥 التصدير للـ PDF (بدون صفحة بيضاء وغلاف احترافي)
    // =======================================================
    const exportToPDF = (type) => {
        const invName = printMode === 'single' ? investors[selectedInvestorIndex]?.name : 'إجمالي المستثمرين';
        const invAmount = printMode === 'single' ? formatMoney(investors[selectedInvestorIndex]?.amount) : formatMoney(investorCapitalPool);
        const invRoi = printMode === 'single' ? 
            (investors[selectedInvestorIndex]?.amount > 0 ? ((invProfitPool * (investors[selectedInvestorIndex].amount / investorCapitalPool)) / investors[selectedInvestorIndex].amount * 100).toFixed(1) : 0) 
            : overAllROI.toFixed(1);

        let investorsTableRows = '';
        if(printMode === 'single') {
            const inv = investors[selectedInvestorIndex];
            investorsTableRows = `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 12px; font-weight: bold; color: #1a365d;">${inv?.name}</td>
                    <td style="padding: 12px; text-align: center; font-weight: 900;">${formatMoney(inv?.amount)}</td>
                    <td style="padding: 12px; text-align: center; color: #64748b;">${investorCapitalPool > 0 ? ((inv?.amount||0)/investorCapitalPool*100).toFixed(1) : 0}%</td>
                    <td style="padding: 12px; text-align: center; color: #059669; font-weight: 900;">${formatMoney(invProfitPool * ((inv?.amount||0)/investorCapitalPool))}</td>
                    <td style="padding: 12px; text-align: center; color: #c5a059; font-weight: 900;">${formatMoney((inv?.amount||0) + invProfitPool * ((inv?.amount||0)/investorCapitalPool))}</td>
                    <td style="padding: 12px; text-align: center; font-weight: bold;">${invRoi}%</td>
                </tr>
            `;
        } else if(printMode === 'summary') {
            investorsTableRows = `
                <tr style="border-bottom: 1px solid #f1f5f9;">
                    <td style="padding: 12px; font-weight: bold; color: #1a365d;">إجمالي المستثمرين</td>
                    <td style="padding: 12px; text-align: center; font-weight: 900;">${formatMoney(totalInvestedVal)}</td>
                    <td style="padding: 12px; text-align: center; color: #64748b;">${totalInvestedPct.toFixed(1)}%</td>
                    <td style="padding: 12px; text-align: center; color: #059669; font-weight: 900;">${formatMoney(totalInvestedProfit)}</td>
                    <td style="padding: 12px; text-align: center; color: #c5a059; font-weight: 900;">${formatMoney(totalInvestedVal + totalInvestedProfit)}</td>
                    <td style="padding: 12px; text-align: center; font-weight: bold;">${overAllROI.toFixed(1)}%</td>
                </tr>
            `;
        } else {
            investors.forEach(inv => {
                const amount = Number(inv.amount) || 0;
                const pct = investorCapitalPool > 0 ? (amount / investorCapitalPool) * 100 : 0;
                const prof = invProfitPool * (pct / 100);
                const r = amount > 0 ? (prof / amount * 100) : 0;
                investorsTableRows += `
                    <tr style="border-bottom: 1px solid #f1f5f9;">
                        <td style="padding: 10px; font-weight: bold; color: #1a365d;">${inv.name}</td>
                        <td style="padding: 10px; text-align: center; font-weight: bold;">${formatMoney(amount)}</td>
                        <td style="padding: 10px; text-align: center; color: #64748b;">${pct.toFixed(1)}%</td>
                        <td style="padding: 10px; text-align: center; color: #059669; font-weight: bold;">${formatMoney(prof)}</td>
                        <td style="padding: 10px; text-align: center; color: #c5a059; font-weight: bold;">${formatMoney(amount + prof)}</td>
                        <td style="padding: 10px; text-align: center; font-weight: bold;">${r.toFixed(1)}%</td>
                    </tr>
                `;
            });
        }

        const archDetailsHTML = `
            <div style="border: 2px solid #e2e8f0; border-radius: 16px; overflow: hidden; margin-top: 10px;">
                <table style="width: 100%; text-align: right; border-collapse: collapse; font-size: 13px;">
                    <thead style="background-color: #f8fafc; border-bottom: 2px solid #e2e8f0;">
                        <tr>
                            <th style="padding: 12px; color: #1a365d;">الدور</th>
                            <th style="padding: 12px; text-align: center; color: #1a365d;">الوحدات</th>
                            <th style="padding: 12px; text-align: center; color: #1a365d;">المساحة الصافية</th>
                            <th style="padding: 12px; text-align: center; color: #1a365d;">متوسط المساحة</th>
                            <th style="padding: 12px; text-align: center; color: #1a365d;">السعر المتوقع للوحدة</th>
                        </tr>
                    </thead>
                    <tbody style="background-color: white; font-weight: bold;">
                        ${uGround > 0 ? `<tr><td style="padding:10px 12px; border-bottom:1px solid #f1f5f9; color:#475569;">الأرضي</td><td style="padding:10px 12px; text-align:center;">${uGround}</td><td style="padding:10px 12px; text-align:center;">${netGround.toFixed(1)} م²</td><td style="padding:10px 12px; text-align:center; color:#059669;">${avgGround.toFixed(1)} م²</td><td style="padding:10px 12px; text-align:center; color:#c5a059;">${formatMoney(avgGround * finSellPrice)}</td></tr>` : ''}
                        ${uTypical > 0 ? `<tr><td style="padding:10px 12px; border-bottom:1px solid #f1f5f9; color:#475569;">المتكرر (${floorsCount} دور)</td><td style="padding:10px 12px; text-align:center;">${uTypical * floorsCount}</td><td style="padding:10px 12px; text-align:center;">${(netTypical * floorsCount).toFixed(1)} م²</td><td style="padding:10px 12px; text-align:center; color:#059669;">${avgTypical.toFixed(1)} م²</td><td style="padding:10px 12px; text-align:center; color:#c5a059;">${formatMoney(avgTypical * finSellPrice)}</td></tr>` : ''}
                        ${uRoof > 0 ? `<tr><td style="padding:10px 12px; border-bottom:1px solid #f1f5f9; color:#475569;">الملحق + السطح</td><td style="padding:10px 12px; text-align:center;">${uRoof}</td><td style="padding:10px 12px; text-align:center;">${netRoof.toFixed(1)} م²</td><td style="padding:10px 12px; text-align:center; color:#059669;">${avgRoof.toFixed(1)} م²</td><td style="padding:10px 12px; text-align:center; color:#c5a059;">${formatMoney(avgRoof * finSellPrice + (avgRoof * landCostPerSqm))}</td></tr>` : ''}
                    </tbody>
                </table>
            </div>
        `;

        let contentHTML = '';
        if (type === 'teaser') {
            contentHTML = `
                <div style="text-align: center; margin-bottom: 20px;">
                    <div style="display: inline-block; padding: 6px 20px; border-radius: 50px; border: 1px solid #fde68a; background-color: #fffbeb; color: #c5a059; font-weight: bold; font-size: 12px; margin-bottom: 15px;">
                        ملخص تنفيذي - فرصة استثمارية ${printMode === 'single' ? `<span style="color:#1a365d; font-weight:900;">(${invName})</span>` : ''}
                    </div>
                    <h2 style="font-size: 42px; font-weight: 900; color: #1a365d; margin: 0 0 5px 0;">${projectName || "مشروع سماك الصفوة 2"}</h2>
                    <p style="font-size: 16px; color: #64748b; font-weight: bold; margin: 0;">شراكة استثمارية للتطوير العقاري</p>
                </div>

                <div class="page-break-avoid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                    <div style="background-color: #ecfdf5; border: 1px solid #d1fae5; border-radius: 20px; padding: 30px 20px; text-align: center;">
                        <p style="color: #065f46; font-weight: 900; font-size: 14px; margin: 0 0 10px 0;">المبيعات المتوقعة للمشروع</p>
                        <p style="color: #059669; font-weight: 900; font-size: 32px; margin: 0 0 5px 0;">${formatMoney(totalSales)}</p>
                        <p style="color: #059669; font-weight: bold; font-size: 10px; margin: 0;">العوائد الإجمالية المتوقعة للمشروع</p>
                    </div>
                    <div style="background-color: white; border: 1px solid #e2e8f0; border-radius: 20px; padding: 30px 20px; text-align: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
                        <p style="color: #64748b; font-weight: 900; font-size: 14px; margin: 0 0 10px 0;">السيولة الاستثمارية المستهدفة</p>
                        <p style="color: #1a365d; font-weight: 900; font-size: 32px; margin: 0 0 5px 0;">${invAmount}</p>
                        <p style="color: #c5a059; font-weight: bold; font-size: 10px; margin: 0;">متطلبات السيولة النقدية لبدء المشروع</p>
                    </div>
                </div>

                <div class="page-break-avoid" style="background-color: #1a365d; border-radius: 20px; padding: 30px; display: grid; grid-template-columns: 1fr 1fr; text-align: center; margin-bottom: 20px;">
                    <div style="border-left: 1px solid rgba(255,255,255,0.2);">
                        <p style="color: #cbd5e1; font-weight: bold; font-size: 14px; margin: 0 0 10px 0;">دورة المشروع المستهدفة</p>
                        <p style="color: white; font-weight: 900; font-size: 36px; margin: 0;">${inputs.sDuration} شهراً</p>
                    </div>
                    <div>
                        <p style="color: #cbd5e1; font-weight: bold; font-size: 14px; margin: 0 0 10px 0;">العائد الإجمالي المتوقع للمستثمر (ROI)</p>
                        <p style="color: #c5a059; font-weight: 900; font-size: 36px; margin: 0;">${invRoi}%</p>
                    </div>
                </div>

                <div class="page-break-avoid" style="border: 1px solid rgba(197, 160, 89, 0.3); border-radius: 20px; padding: 25px;">
                    <h3 style="color: #1a365d; font-weight: 900; font-size: 18px; margin: 0 0 15px 0; text-align:center;">التفاصيل المعمارية</h3>
                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; text-align: center; margin-bottom: 15px;">
                        <div style="background: #f8fafc; padding:15px; border-radius: 12px;">
                            <span style="display: block; color: #1a365d; font-weight: 900; font-size: 26px;">${totalUnits}</span>
                            <span style="color: #64748b; font-weight: bold; font-size: 12px;">إجمالي الوحدات السكنية</span>
                        </div>
                        <div style="background: #f8fafc; padding:15px; border-radius: 12px;">
                            <span style="display: block; color: #1a365d; font-weight: 900; font-size: 26px;">${formatMoney(totalNet)} م²</span>
                            <span style="color: #64748b; font-weight: bold; font-size: 12px;">إجمالي المساحات للبيع</span>
                        </div>
                        <div style="background: #f8fafc; padding:15px; border-radius: 12px;">
                            <span style="display: block; color: #1a365d; font-weight: 900; font-size: 26px;">${formatMoney(finSellPrice)} ريال</span>
                            <span style="color: #64748b; font-weight: bold; font-size: 12px;">سعر المتر المستهدف</span>
                        </div>
                    </div>
                    ${archDetailsHTML}
                </div>
            `;
        } else {
            contentHTML = `
                <div style="text-align: center; margin-bottom: 15px;">
                    <div style="display: inline-block; padding: 6px 20px; border-radius: 50px; background-color: #f8fafc; border: 1px solid #e2e8f0; color: #1a365d; font-weight: bold; font-size: 12px; margin-bottom: 10px;">
                        الملحق المالي التفصيلي
                    </div>
                    <h2 style="font-size: 28px; font-weight: 900; color: #1a365d; margin: 0;">${projectName || "مشروع سماك الصفوة 2"}</h2>
                </div>

                <div class="page-break-avoid" style="border: 2px solid #e2e8f0; border-radius: 16px; overflow: hidden; margin-bottom: 25px;">
                    <table style="width: 100%; text-align: right; border-collapse: collapse; font-size: 12px;">
                        <tbody style="font-weight: bold;">
                            <tr style="border-bottom: 1px solid #e2e8f0;">
                                <td style="padding: 10px 12px; background-color: #f8fafc; color: #475569; width: 65%;">قيمة الأرض الإجمالية</td>
                                <td style="padding: 10px 12px; color: #1a365d; font-weight: 900; font-size: 14px;">${formatMoney(finLandPrice)}</td>
                            </tr>
                            
                            <tr><td colspan="2" style="padding: 8px 12px; background-color: #f1f5f9; color: #1a365d; font-weight: 900;">تفصيل المصاريف الإدارية والتأسيس والرخص</td></tr>
                            <tr><td style="padding: 6px 12px; color: #475569;">- رخصة وافي</td><td style="padding: 6px 12px; color: #1a365d; font-weight: bold;">${formatMoney(inputs.sWafi)}</td></tr>
                            <tr><td style="padding: 6px 12px; color: #475569;">- المكتب الهندسي</td><td style="padding: 6px 12px; color: #1a365d; font-weight: bold;">${formatMoney(inputs.sEng)}</td></tr>
                            <tr><td style="padding: 6px 12px; color: #475569;">- رخصة البلدية</td><td style="padding: 6px 12px; color: #1a365d; font-weight: bold;">${formatMoney(inputs.sMunicipality)}</td></tr>
                            <tr><td style="padding: 6px 12px; color: #475569;">- إشراف هندسي ومحاسبي</td><td style="padding: 6px 12px; color: #1a365d; font-weight: bold;">${formatMoney((inputs.sSupervision||0) + (inputs.sAcc||0))}</td></tr>
                            <tr><td style="padding: 6px 12px; color: #475569;">- فحص وتأمين المبنى</td><td style="padding: 6px 12px; color: #1a365d; font-weight: bold;">${formatMoney(insCost + testCost)}</td></tr>
                            <tr><td style="padding: 6px 12px; color: #475569;">- مصاريف أخرى</td><td style="padding: 6px 12px; color: #1a365d; font-weight: bold;">${formatMoney(inputs.sOther)}</td></tr>
                            <tr style="border-bottom: 1px solid #e2e8f0; background-color: #f8fafc;">
                                <td style="padding: 10px 12px; color: #1a365d; font-weight: 900;">إجمالي مصاريف التأسيس والرخص</td>
                                <td style="padding: 10px 12px; color: #1a365d; font-weight: 900;">${formatMoney(softCosts)}</td>
                            </tr>

                            <tr style="border-bottom: 1px solid #e2e8f0; background-color: #fffbeb;">
                                <td style="padding: 12px; color: #c5a059; font-weight: 900;">السيولة الاستثمارية المستهدفة</td>
                                <td style="padding: 12px; color: #c5a059; font-weight: 900; font-size: 15px;">${formatMoney(investorCapitalPool)}</td>
                            </tr>

                            <tr style="border-bottom: 1px solid #e2e8f0;">
                                <td style="padding: 12px; background-color: white; color: #475569;">تكلفة البناء والخدمات الإجمالية</td>
                                <td style="padding: 12px; color: #1a365d; font-weight: 900; font-size: 15px;">${formatMoney(buildCost)}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #e2e8f0;">
                                <td style="padding: 12px; background-color: #f8fafc; color: #475569;">ميزانية التسويق والسعي</td>
                                <td style="padding: 12px; color: #1a365d; font-weight: 900; font-size: 15px;">${formatMoney(marketingCost)}</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #e2e8f0; background-color: #fef2f2;">
                                <td style="padding: 12px; color: #991b1b; font-weight: 900;">إجمالي التكاليف المتوقعة للمشروع</td>
                                <td style="padding: 12px; color: #b91c1c; font-weight: 900; font-size: 16px;">${formatMoney(totalProjectCosts)}</td>
                            </tr>

                            <tr style="border-bottom: 1px solid #e2e8f0; background-color: #f8fafc;">
                                <td style="padding: 12px; color: #475569;">إجمالي مساحات البيع للمشروع</td>
                                <td style="padding: 12px; color: #1a365d; font-weight: 900; font-size: 15px;">${formatMoney(totalNet)} م²</td>
                            </tr>
                            <tr style="border-bottom: 1px solid #e2e8f0; background-color: white;">
                                <td style="padding: 12px; color: #475569;">سعر البيع المستهدف للمتر</td>
                                <td style="padding: 12px; color: #1a365d; font-weight: 900; font-size: 15px;">${formatMoney(finSellPrice)} ريال</td>
                            </tr>

                            <tr style="border-bottom: 1px solid #e2e8f0; background-color: #ecfdf5;">
                                <td style="padding: 12px; color: #065f46; font-weight: 900;">إجمالي المبيعات المتوقعة للمشروع (شاملة مبيعات الأسطح)</td>
                                <td style="padding: 12px; color: #059669; font-weight: 900; font-size: 16px;">${formatMoney(totalSales)}</td>
                            </tr>
                            <tr style="background-color: #1a365d; color: white;">
                                <td style="padding: 16px; font-weight: 900; font-size: 15px;">صافي الربح الكلي للمشروع</td>
                                <td style="padding: 16px; font-weight: 900; font-size: 20px; color: #c5a059;">${formatMoney(netProfit)}</td>
                            </tr>
                            <tr style="background-color: #0f172a; color: white;">
                                <td style="padding: 14px 16px; font-weight: 900; font-size: 13px;">العائد السنوي المتوقع للمشروع (Annual ROI)</td>
                                <td style="padding: 14px 16px; font-weight: 900; font-size: 18px; color: #10b981;">${annualROI.toFixed(1)}%</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <div class="page-break-avoid">
                    <h3 style="font-size: 16px; font-weight: 900; color: #1a365d; margin: 0 0 10px 0;">التفاصيل المعمارية وأسعار الوحدات</h3>
                    ${archDetailsHTML}
                </div>

                <div class="page-break">
                    <h3 style="font-size: 18px; font-weight: 900; color: #1a365d; margin: 0 0 15px 0;">توزيع حصص التمويل والأرباح</h3>
                    <div style="border: 2px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 20px;">
                        <table style="width: 100%; text-align: right; border-collapse: collapse; font-size: 11px;">
                            <thead style="background-color: #f1f5f9; border-bottom: 2px solid #e2e8f0;">
                                <tr>
                                    <th style="padding: 12px; color: #1a365d;">المستثمر</th>
                                    <th style="padding: 12px; text-align: center; color: #1a365d;">المبلغ المستثمر</th>
                                    <th style="padding: 12px; text-align: center; color: #1a365d;">الحصة %</th>
                                    <th style="padding: 12px; text-align: center; color: #1a365d;">الربح المتوقع</th>
                                    <th style="padding: 12px; text-align: center; color: #1a365d;">إجمالي الاسترداد</th>
                                    <th style="padding: 12px; text-align: center; color: #1a365d;">ROI</th>
                                </tr>
                            </thead>
                            <tbody style="background-color: white;">
                                ${investorsTableRows}
                            </tbody>
                        </table>
                    </div>

                    ${showDevInPrint ? `
                        <div style="border-top: 4px solid #1a365d; background-color: white; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
                            <h4 style="font-size: 14px; font-weight: 900; color: #1a365d; margin: 0 0 5px 0;">حصة المطور العقاري</h4>
                            <p style="font-size: 24px; font-weight: 900; color: #1a365d; margin: 0 0 5px 0;">${formatMoney(devProfit)} SAR</p>
                            <p style="font-size: 11px; color: #64748b; margin: 0; font-weight: bold;">أتعاب التطوير، الإدارة، وتغطية المخاطر حتى تسليم المفتاح عبر نظام وتراخيص وافي.</p>
                        </div>
                    ` : ''}
                </div>
            `;
        }

        const htmlTemplate = `
            <!DOCTYPE html>
            <html lang="ar" dir="rtl">
            <head>
                <meta charset="UTF-8">
                <title>تقرير ${projectName || 'سماك العقارية'}</title>
                <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet">
                <style>
                    * { box-sizing: border-box; }
                    body { font-family: 'Cairo', sans-serif; margin: 0; padding: 0; background: white; -webkit-print-color-adjust: exact; color-adjust: exact; }
                    @page { size: A4 portrait; margin: 0; }
                    
                    /* 🔥 إزالة الصفحة البيضاء بضبط الارتفاع للغلاف بشكل أدق من ورقة الـ A4 بقليل 🔥 */
                    .print-cover { position: relative; width: 100%; height: 295mm; page-break-after: always; background-color: #1a365d; display: flex; flex-direction: column; overflow: hidden; -webkit-print-color-adjust: exact; color-adjust: exact; box-sizing: border-box; z-index: 2000; margin: 0; padding: 0;}

                    .cover-bg { position: absolute; inset: 0; background-image: url('${getImg("1P0nERTU6SQiWHLf-53bpp1Jsjf120Kq4")}'); background-size: cover; background-position: center; z-index: 1; opacity: 0.4; mix-blend-mode: overlay; }
                    .cover-overlay { position: absolute; inset: 0; background-color: rgba(26,54,93,0.85); z-index: 2; }
                    .cover-content { position: relative; z-index: 10; display: flex; flex-direction: column; height: 100%; justify-content: space-between; }

                    /* 🔥 الهيدر والفوتر الثابت في كل الصفحات (من الصفحة الثانية فصاعداً) 🔥 */
                    .fixed-header { position: fixed; top: 0; left: 0; right: 0; height: 120px; background: white; z-index: 1000; -webkit-print-color-adjust: exact; color-adjust: exact;}
                    .fixed-footer { position: fixed; bottom: 0; left: 0; right: 0; height: 50px; background: white; z-index: 1000; -webkit-print-color-adjust: exact; color-adjust: exact;}
                    
                    /* إخفاء الهيدر/فوتر الثابت عن الغلاف بطريقة برمجية للطباعة */
                    @media print {
                        .print-cover { display: flex !important; }
                        .print-cover ~ .report-wrapper .fixed-header,
                        .print-cover ~ .report-wrapper .fixed-footer { display: none !important; }
                        .report-wrapper > thead .fixed-header,
                        .report-wrapper > tfoot .fixed-footer { display: block !important; }
                    }

                    .top-bar { display: flex; height: 8px; width: 100%; flex-shrink: 0; }
                    .bar-gold { background-color: #c5a059; width: 30%; }
                    .bar-navy { background-color: #1a365d; width: 70%; }
                    
                    .header-content { padding: 20px 40px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #f1f5f9; }
                    .logo-box img { height: 75px; object-fit: contain; }
                    .title-box { text-align: right; border-right: 4px solid #c5a059; padding-right: 15px; }
                    .title-box h1 { margin: 0; color: #1a365d; font-weight: 900; font-size: 20px; }
                    .title-box p { margin: 2px 0 0 0; color: #c5a059; font-weight: bold; font-size: 10px; }

                    .footer-content { padding: 10px 40px; display: flex; justify-content: space-between; align-items: center; background-color: #f8fafc; border-top: 1px solid #e2e8f0; height: 42px;}
                    .footer-left { color: #64748b; font-size: 10px; font-weight: bold; }
                    .footer-right h4 { margin: 0; color: #1a365d; font-weight: 900; font-size: 12px; }
                    .footer-right p { margin: 0; color: #94a3b8; font-size: 9px; }
                    
                    /* 🔥 إزالة page-break-before: always; من الجدول لعدم التعارض مع الغلاف 🔥 */
                    table.report-wrapper { width: 100%; border-collapse: collapse; position: relative; z-index: 10; margin: 0; padding: 0;}
                    .header-space { height: 120px; }
                    .footer-space { height: 50px; }
                    .main-container { padding: 20px 40px; position: relative; z-index: 10;}

                    .watermark { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 70%; opacity: 0.08; z-index: 0; pointer-events: none; -webkit-print-color-adjust: exact; color-adjust: exact;}

                    .page-break { page-break-before: always; padding-top: 15px; }
                    .page-break-avoid { page-break-inside: avoid; }
                </style>
            </head>
            <body>
                <div class="print-cover">
                    <div class="cover-bg"></div>
                    <div class="cover-overlay"></div>
                    <div class="cover-content">
                        <div class="top-bar"><div class="bar-gold"></div><div class="bar-navy"></div></div>

                        <div style="text-align: center; padding-top: 80px;">
                            <img src="${getImg("1HEFY56KLYGJNmc-tufIXmYDUbGyOIdDX")}" alt="Semak Logo" style="height: 140px; object-fit: contain; margin-bottom: 40px;" />
                            <h1 style="font-size: 28px; font-weight: 900; color: #c5a059; margin: 0 0 15px 0;">سماك العقارية</h1>
                            <h2 style="font-size: 64px; font-weight: 900; color: white; margin: 0 0 20px 0; line-height: 1;">${projectName || "سماك الصفوة 2"}</h2>
                            <p style="font-size: 22px; color: #cbd5e1; font-weight: 900; margin: 0 0 30px 0;">دراسة جدوى فرصة استثمارية للتطوير العقاري</p>
                            <p style="font-size: 15px; color: #94a3b8; font-weight: bold; margin: 0;">تطوير مجمع سكني فاخر بنظام البيع على الخارطة (وافي)</p>
                            <p style="font-size: 15px; color: #94a3b8; font-weight: bold; margin: 10px 0 0 0;">إجمالي وحدات المشروع: <span style="color:white; font-weight:900;">${totalUnits} وحدة</span></p>
                        </div>

                        <div style="padding: 30px 60px; border-top: 1px solid rgba(255,255,255,0.2); text-align: center; margin-top: auto;">
                            <p style="color: #c5a059; font-size: 16px; font-weight: bold; margin: 0;">إدارة التطوير والاستثمار | وثيقة سرية للمستثمرين</p>
                            <p style="color: #cbd5e1; font-size: 12px; font-weight: bold; margin: 5px 0 0 0;" dir="ltr">info@semak.sa | semak.sa | 920032842</p>
                        </div>
                    </div>
                </div>

                <table class="report-wrapper">
                    <thead>
                        <tr><td>
                            <div class="fixed-header">
                                <div class="top-bar"><div class="bar-gold"></div><div class="bar-navy"></div></div>
                                <div class="header-content">
                                    <div class="title-box">
                                        <h1>سماك العقارية</h1>
                                        <p>سقف يعلو برؤيتك ومسكن يحكي قصتك</p>
                                    </div>
                                    <div class="logo-box">
                                        <img src="${getImg("1I5KIPkeuwJ0CawpWJLpiHdmofSKLQglN")}" alt="Semak Logo" />
                                    </div>
                                </div>
                            </div>
                            <div class="header-space"></div>
                        </td></tr>
                    </thead>
                    <tbody>
                        <tr><td>
                            <img src="${getImg("1I5KIPkeuwJ0CawpWJLpiHdmofSKLQglN")}" class="watermark" />
                            <div class="main-container">
                                ${contentHTML}
                            </div>
                        </td></tr>
                    </tbody>
                    <tfoot>
                        <tr><td>
                            <div class="footer-space"></div>
                            <div class="fixed-footer">
                                <div class="footer-content">
                                    <div class="footer-left" dir="ltr">info@semak.sa | semak.sa | 920032842</div>
                                    <div class="footer-right">
                                        <h4>إدارة التطوير والاستثمار</h4>
                                        <p>وثيقة سرية للمستثمرين</p>
                                    </div>
                                </div>
                                <div class="top-bar"><div class="bar-navy"></div><div class="bar-gold"></div></div>
                            </div>
                        </td></tr>
                    </tfoot>
                </table>

                <script>
                    window.onload = () => { setTimeout(() => { window.print(); }, 1500); };
                <\/script>
            </body>
            </html>
        `;

        const win = window.open('', '_blank');
        win.document.write(htmlTemplate);
        win.document.close();
    };

    return (
        <div className="animate-fadeIn pb-12 font-cairo" dir="rtl">
            <div className="bg-white p-6 md:p-8 rounded-[2.5rem] shadow-sm border border-slate-100 mb-8 flex flex-col lg:flex-row items-center gap-6 no-print">
                <div className="flex items-center gap-4 w-full lg:w-auto">
                    <div className="w-14 h-14 bg-indigo-50 text-[#1a365d] rounded-2xl flex items-center justify-center shrink-0">
                        <DownloadCloud size={28} />
                    </div>
                    <div className="flex-1">
                        <label className="block text-[11px] font-black text-slate-400 mb-1 tracking-wide">النسخة السحابية</label>
                        <h2 className="text-xl font-black text-[#1a365d]">إدارة الدراسات</h2>
                    </div>
                </div>
                <div className="w-full lg:w-px bg-slate-100 lg:h-16 h-px"></div>
                <div className="flex-1 w-full grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div><label className="block text-[11px] font-black text-slate-500 mb-2">اسم المشروع الحالي</label><input type="text" value={projectName} onChange={e=>setProjectName(e.target.value)} placeholder="مثال: مشروع سماك الصفوة 3..." className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl font-black text-[#1a365d] outline-none focus:border-[#c5a059] transition-all" /></div>
                    <div><label className="block text-[11px] font-black text-slate-500 mb-2">استدعاء دراسة محفوظة</label><div className="relative"><select onChange={(e) => handleLoadCloud(e.target.value)} value={currentProjectId} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-2xl font-black text-[#1a365d] outline-none cursor-pointer focus:border-[#c5a059] transition-all appearance-none"><option value="">-- اختر مشروعاً للقراءة --</option>{savedProjects.map(p => <option key={p.id} value={p.id}>{p.project_name}</option>)}</select><div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 pointer-events-none"><ChevronDown size={16}/></div></div></div>
                </div>
                <button onClick={handleSaveCloud} disabled={loading} className="w-full lg:w-auto bg-[#1a365d] text-white px-10 py-4 rounded-2xl font-black hover:bg-blue-900 transition-all flex items-center justify-center gap-3 shadow-lg shrink-0">{loading ? <RefreshCw size={20} className="animate-spin"/> : <Save size={20}/>} <span>حفظ المشروع</span></button>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 no-print">
                <div className="xl:col-span-8 space-y-8">
                    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-6 md:p-8 border-b border-slate-100 flex items-center gap-4"><div className="w-12 h-12 bg-orange-50 text-[#c5a059] rounded-2xl flex items-center justify-center shrink-0"><LayoutDashboard size={24} /></div><div><h2 className="text-xl font-black text-[#1a365d]">1. الموجه المعماري</h2><p className="text-xs font-bold text-slate-400 mt-1">توزيع المساحات والوحدات السكنية للمشروع</p></div></div>
                        <div className="p-6 md:p-8 bg-white">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8"><InputField label="مساحة الأرض (م²)" name="archLandArea" value={inputs.archLandArea} onChange={handleChange} /><InputField label="مساحة الخدمات (م²)" name="archCommonArea" value={inputs.archCommonArea} onChange={handleChange} /><InputField label="الأدوار المتكررة" name="archFloorsCount" value={inputs.archFloorsCount} onChange={handleChange} /><InputField label="نسبة الملحق %" name="archRoofPct" value={inputs.archRoofPct} onChange={handleChange} /></div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6"><div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col gap-4"><InputField label="بناء الأرضي %" name="archGroundPct" value={inputs.archGroundPct} onChange={handleChange} /><InputField label="وحدات الأرضي" name="uGround" value={inputs.uGround} onChange={handleChange} textClass="text-[#c5a059]" /></div><div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col gap-4"><InputField label="بناء المتكرر %" name="archTypicalPct" value={inputs.archTypicalPct} onChange={handleChange} /><InputField label="وحدات المتكرر" name="uTypical" value={inputs.uTypical} onChange={handleChange} textClass="text-[#c5a059]" /></div><div className="bg-slate-50 p-5 rounded-3xl border border-slate-100 flex flex-col justify-end gap-4"><div className="hidden md:block h-[72px]"></div><InputField label="وحدات الملحق (الروف)" name="uRoof" value={inputs.uRoof} onChange={handleChange} textClass="text-[#c5a059]" /></div></div>
                        </div>
                        <div className="overflow-x-auto bg-slate-50/50 p-6 md:p-8 border-t border-slate-100">
                            <table className="w-full text-right text-sm">
                                <thead><tr className="text-slate-400 font-black border-b-2 border-slate-200">
                                    <th className="py-3 px-4">الدور</th>
                                    <th className="py-3 px-4 text-center">إجمالي البناء</th>
                                    <th className="py-3 px-4 text-center">المساحة الصافية</th>
                                    <th className="py-3 px-4 text-center">عدد الوحدات</th>
                                    <th className="py-3 px-4 text-center">متوسط المساحة</th>
                                    <th className="py-3 px-4 text-center text-emerald-600">السعر المتوقع</th>
                                </tr></thead>
                                <tbody>
                                    {inputs.uGround > 0 && (<tr className="border-b border-slate-100 hover:bg-white transition-colors"><td className="py-4 px-4 font-black text-[#1a365d]">الأرضي</td><td className="py-4 px-4 text-center font-bold text-slate-600" dir="ltr">{groundBuilt.toFixed(1)} m²</td><td className="py-4 px-4 text-center font-black text-slate-600" dir="ltr">{netGround.toFixed(1)} m²</td><td className="py-4 px-4 text-center font-black text-[#c5a059]">{inputs.uGround}</td><td className="py-4 px-4 text-center font-bold text-slate-600" dir="ltr">{avgGround.toFixed(1)} m²</td><td className="py-4 px-4 text-center font-black text-emerald-600">{formatMoney(avgGround * inputs.finSellPrice)}</td></tr>)}
                                    {inputs.uTypical > 0 && (<tr className="border-b border-slate-100 hover:bg-white transition-colors"><td className="py-4 px-4 font-black text-[#1a365d]">المتكرر</td><td className="py-4 px-4 text-center font-bold text-slate-600" dir="ltr">{(typicalBuilt * inputs.archFloorsCount).toFixed(1)} m²</td><td className="py-4 px-4 text-center font-black text-slate-600" dir="ltr">{(netTypical * inputs.archFloorsCount).toFixed(1)} m²</td><td className="py-4 px-4 text-center font-black text-[#c5a059]">{inputs.uTypical * inputs.archFloorsCount}</td><td className="py-4 px-4 text-center font-bold text-slate-600" dir="ltr">{avgTypical.toFixed(1)} m²</td><td className="py-4 px-4 text-center font-black text-emerald-600">{formatMoney(avgTypical * inputs.finSellPrice)}</td></tr>)}
                                    {inputs.uRoof > 0 && (<tr className="border-b border-slate-100 hover:bg-white transition-colors"><td className="py-4 px-4 font-black text-[#1a365d]">الملحق + السطح</td><td className="py-4 px-4 text-center font-bold text-slate-600" dir="ltr">{roofBuilt.toFixed(1)} m²</td><td className="py-4 px-4 text-center font-black text-slate-600" dir="ltr">{netRoof.toFixed(1)} m²</td><td className="py-4 px-4 text-center font-black text-[#c5a059]">{inputs.uRoof}</td><td className="py-4 px-4 text-center font-bold text-slate-600" dir="ltr">{avgRoof.toFixed(1)} m²</td><td className="py-4 px-4 text-center font-black text-emerald-600">{formatMoney(avgRoof * inputs.finSellPrice + (avgRoof * landCostPerSqm))}</td></tr>)}
                                </tbody>
                                <tfoot><tr className="bg-[#1a365d] text-white rounded-2xl"><td className="py-4 px-4 font-black rounded-r-xl">الإجمالي الكلي</td><td className="py-4 px-4 text-center font-bold" dir="ltr">{totalBuilt.toFixed(1)} m²</td><td className="py-4 px-4 text-center font-black" dir="ltr">{totalNet.toFixed(1)} m²</td><td className="py-4 px-4 text-center font-black">{totalUnits}</td><td className="py-4 px-4 text-center font-black">--</td><td className="py-4 px-4 text-center font-black rounded-l-xl text-[#c5a059]">{formatMoney(totalSales)}</td></tr></tfoot>
                            </table>
                        </div>
                    </div>

                    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-6 md:p-8 border-b border-slate-100 flex items-center gap-4"><div className="w-12 h-12 bg-blue-50 text-[#1a365d] rounded-2xl flex items-center justify-center shrink-0"><Landmark size={24} /></div><div><h2 className="text-xl font-black text-[#1a365d]">2. التكاليف والمحاصة</h2><p className="text-xs font-bold text-slate-400 mt-1">تحديد التكاليف التشغيلية والإدارية ونسب الأرباح</p></div></div>
                        <div className="p-6 md:p-8 space-y-8 bg-white">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6"><InputField label="سعر بيع المتر المستهدف" name="finSellPrice" value={inputs.finSellPrice} onChange={handleChange} textClass="text-emerald-600" /><InputField label="تكلفة بناء المتر" name="finBuildCost" value={inputs.finBuildCost} onChange={handleChange} textClass="text-red-500" /><InputField label="إدخال خدمات للوحدة" name="inServiceCostPerUnit" value={inputs.inServiceCostPerUnit} onChange={handleChange} textClass="text-red-500" /></div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6"><InputField label="قيمة الأرض الإجمالية" name="finLandPrice" value={inputs.finLandPrice} onChange={handleChange} /><InputField label="مدة المشروع (أشهر)" name="sDuration" value={inputs.sDuration} onChange={handleChange} textClass="text-[#c5a059]" /></div>
                            <div className="bg-[#1a365d]/5 p-6 md:p-8 rounded-[2rem] border border-[#1a365d]/10"><h3 className="text-sm font-black text-[#1a365d] mb-6 flex items-center gap-2"><Briefcase size={18} className="text-[#1a365d]" /> المصاريف الإدارية والتأسيس والرخص</h3><div className="grid grid-cols-2 md:grid-cols-4 gap-6"><InputField label="رخصة وافي" name="sWafi" value={inputs.sWafi} onChange={handleChange} /><InputField label="المكتب الهندسي" name="sEng" value={inputs.sEng} onChange={handleChange} /><InputField label="رخصة البلدية" name="sMunicipality" value={inputs.sMunicipality} onChange={handleChange} /><InputField label="مكتب مشرف" name="sSupervision" value={inputs.sSupervision} onChange={handleChange} /><InputField label="محاسب قانوني" name="sAcc" value={inputs.sAcc} onChange={handleChange} /><InputField label="مصاريف أخرى" name="sOther" value={inputs.sOther} onChange={handleChange} /><InputField label="تأمين (% من بناء)" name="sInsurancePct" value={inputs.sInsurancePct} onChange={handleChange} step="0.1" /><InputField label="فحص (% من بناء)" name="sTestingPct" value={inputs.sTestingPct} onChange={handleChange} step="0.1" /></div></div>
                            <div className="bg-gradient-to-l from-[#1a365d] to-[#0f172a] p-6 md:p-8 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-8 shadow-xl relative overflow-hidden"><div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -mr-10 -mt-10 blur-3xl pointer-events-none"></div><div className="flex-1 w-full grid grid-cols-2 gap-6 relative z-10"><div><label className="text-[11px] font-black text-slate-300 block mb-2 uppercase tracking-wider">علاوة لنسبة المستثمر %</label><input type="number" name="inInvBonusPct" value={inputs.inInvBonusPct} onChange={handleChange} className="w-full p-4 rounded-2xl border-none font-black text-white text-xl outline-none bg-white/10 focus:bg-white/20 transition-all text-center" /></div><div><label className="text-[11px] font-black text-slate-300 block mb-2 uppercase tracking-wider">السعي والتسويق %</label><input type="number" name="sMarkPct" value={inputs.sMarkPct} onChange={handleChange} step="0.1" className="w-full p-4 rounded-2xl border-none font-black text-[#c5a059] text-xl outline-none bg-white/10 focus:bg-white/20 transition-all text-center" /></div></div><div className="w-full md:w-64 text-center bg-white p-6 rounded-3xl shadow-inner relative z-10"><span className="block text-[11px] font-black text-slate-400 mb-1 uppercase tracking-wider">إجمالي حصة المستثمرين</span><span className="text-4xl font-black text-[#1a365d]">{finalInvPct.toFixed(1)}%</span></div></div>
                        </div>
                    </div>

                    <div className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden">
                        <div className="p-6 md:p-8 border-b border-slate-100 flex justify-between items-center gap-4"><div className="flex items-center gap-4"><div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center shrink-0"><Users size={24} /></div><div><h2 className="text-xl font-black text-[#1a365d]">3. قائمة المستثمرين</h2><p className="text-xs font-bold text-slate-400 mt-1">إضافة الشركاء وتوزيع الحصص المالية</p></div></div><button onClick={addInvestorRow} className="bg-[#1a365d] text-white px-5 py-3 rounded-xl text-sm font-black hover:bg-blue-900 transition-all flex items-center gap-2 shadow-md"><Plus size={18}/> إضافة شريك</button></div>
                        <div className="overflow-x-auto p-6 md:p-8 bg-white"><table className="w-full text-right text-sm border-separate border-spacing-y-3"><thead><tr className="text-slate-400 font-black text-[11px] uppercase tracking-wider"><th className="px-4 pb-2">اسم المستثمر</th><th className="px-4 pb-2">المبلغ المستثمر (SAR)</th><th className="px-4 pb-2 text-center">نسبة الإسهام</th><th className="px-4 pb-2 text-center">الربح المتوقع</th><th className="px-4 pb-2 text-center">إجراء</th></tr></thead><tbody>{investors.map((inv, i) => {const amount = Number(inv.amount) || 0; const pct = investorCapitalPool > 0 ? (amount / investorCapitalPool) * 100 : 0; const prof = invProfitPool * (pct / 100); return (<tr key={i} className="bg-slate-50 transition-all rounded-2xl group"><td className="p-2 rounded-r-2xl"><input type="text" value={inv.name} onChange={e=>handleInvestorChange(i, 'name', e.target.value)} className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl font-bold text-[#1a365d] outline-none focus:border-[#c5a059] focus:ring-2 focus:ring-[#c5a059]/20" placeholder="اسم المستثمر..." /></td><td className="p-2"><input type="number" value={inv.amount} onChange={e=>handleInvestorChange(i, 'amount', e.target.value)} className="w-full bg-white border border-slate-200 px-4 py-3 rounded-xl font-black text-[#1a365d] outline-none focus:border-[#c5a059] focus:ring-2 focus:ring-[#c5a059]/20" /></td><td className="p-2 text-center font-black text-slate-500">{pct.toFixed(1)}%</td><td className="p-2 text-center font-black text-emerald-600">{formatMoney(prof)}</td><td className="p-2 text-center rounded-l-2xl"><button onClick={() => removeInvestor(i)} className="text-slate-400 hover:text-red-500 transition-colors p-3 bg-white rounded-xl shadow-sm border border-slate-100 hover:border-red-100"><Trash2 size={18}/></button></td></tr>)})}</tbody><tfoot><tr><td className="p-4 font-black text-[#1a365d]">الإجمالي المجمع</td><td className="p-4 font-black text-[#1a365d] text-lg">{formatMoney(totalInvestedVal)}</td><td className="p-4 text-center font-black text-slate-400">{totalInvestedPct.toFixed(1)}%</td><td className="p-4 text-center font-black text-emerald-600 text-lg">{formatMoney(totalInvestedProfit)}</td><td className="p-4 text-center text-[10px] font-bold text-slate-400">تأكد من المطابقة</td></tr></tfoot></table></div>
                    </div>
                </div>

                <div className="xl:col-span-4 space-y-8">
                    <div className="bg-[#1a365d] text-white rounded-[2rem] shadow-2xl p-8 border-b-[12px] border-[#c5a059] relative overflow-hidden">
                         <div className="absolute -left-6 -top-6 opacity-[0.03] transform -rotate-12"><Calculator size={200}/></div>
                         <h3 className="text-lg font-black text-[#c5a059] mb-8 flex items-center gap-2 relative z-10"><FileText size={20}/> ملخص اقتصاديات المشروع</h3>
                         <div className="grid grid-cols-2 gap-4 mb-8 relative z-10"><div className="bg-white/5 p-4 rounded-2xl text-center border border-white/10 backdrop-blur-sm"><span className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">تكلفة أرض للمتر</span><span className="text-lg font-black text-white">{formatMoney(landCostPerSqm)}</span></div><div className="bg-white/5 p-4 rounded-2xl text-center border border-white/10 backdrop-blur-sm"><span className="block text-[10px] font-bold text-slate-400 mb-1 uppercase tracking-widest">تكلفة بناء للمتر</span><span className="text-lg font-black text-red-300">{formatMoney(totalCostPerSqm)}</span></div></div>
                         <div className="space-y-4 text-sm relative z-10">
                             <div className="flex justify-between items-center border-b border-white/10 pb-3"><span className="font-bold text-slate-300">إجمالي المبيعات</span> <span className="text-emerald-400 font-black text-lg">{formatMoney(totalSales)}</span></div>
                             <div className="flex justify-between items-center border-b border-white/10 pb-3"><span className="font-bold text-slate-300">تكلفة البناء</span> <span className="text-red-300 font-black">{formatMoney(buildCost)}</span></div>
                             <div className="flex justify-between items-center border-b border-white/10 pb-3"><span className="font-bold text-slate-300">التأسيس والرخص</span> <span className="text-red-300 font-black">{formatMoney(softCosts)}</span></div>
                             <div className="flex justify-between items-center border-b border-white/10 pb-3"><span className="font-bold text-slate-300">السعي والتسويق</span> <span className="text-orange-400 font-black">{formatMoney(marketingCost)}</span></div>
                             <div className="flex justify-between items-center pt-2"><span className="font-bold text-white">السيولة الاستثمارية</span> <span className="text-white font-black text-lg">{formatMoney(investorCapitalPool)}</span></div>
                             <div className="flex justify-between items-center pt-6 mt-4 border-t border-white/20"><span className="font-black text-white text-base">صافي الربح الكلي</span> <span className="text-emerald-400 font-black text-2xl">{formatMoney(netProfit)}</span></div>
                         </div>
                         <div className="grid grid-cols-2 gap-4 mt-8 relative z-10"><div className="bg-[#c5a059]/10 p-4 rounded-2xl text-center border border-[#c5a059]/30"><span className="block text-[10px] font-bold text-[#c5a059] mb-1">إجمالي ربح المستثمرين</span><span className="text-xl font-black text-white">{formatMoney(invProfitPool)}</span></div><div className="bg-white/10 p-4 rounded-2xl text-center border border-white/20"><span className="block text-[10px] font-bold text-slate-300 mb-1">صافي ربح المطور</span><span className="text-xl font-black text-white">{formatMoney(devProfit)}</span></div></div>
                    </div>

                    <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col gap-6"><div className="flex justify-between items-start"><div><span className="block text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">العائد الإجمالي (ROI)</span><span className="text-5xl font-black text-[#1a365d]">{overAllROI.toFixed(1)}%</span></div><div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center font-black text-2xl border border-emerald-100">%</div></div><div className="space-y-4 border-t border-slate-100 pt-6"><div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl"><span className="text-xs font-bold text-slate-500">العائد السنوي المتوقع</span><span className="text-base font-black text-emerald-600">{annualROI.toFixed(1)}%</span></div><div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl"><span className="text-xs font-bold text-slate-500">إجمالي الاسترداد المستهدف</span><span className="text-base font-black text-[#1a365d]">SAR {formatMoney(investorCapitalPool + invProfitPool)}</span></div></div></div>

                    <div className="bg-white p-8 rounded-[2rem] shadow-sm border border-slate-100">
                        <h3 className="text-base font-black text-[#1a365d] mb-6 flex items-center gap-2"><Presentation size={20} className="text-[#c5a059]" /> خيارات العروض والتصدير</h3>
                        <div className="space-y-6">
                            <div>
                                <label className="block text-[11px] font-black text-slate-500 mb-3 uppercase tracking-wider">طريقة عرض المستثمرين في التقرير</label>
                                <div className="relative">
                                    <select value={printMode} onChange={e=>setPrintMode(e.target.value)} className="w-full bg-slate-50 border border-slate-200 px-4 py-3.5 rounded-2xl text-sm font-black text-[#1a365d] outline-none focus:border-[#c5a059] appearance-none cursor-pointer relative z-10"><option value="all">إظهار كافة المستثمرين (قائمة مفصلة)</option><option value="summary">إظهار الإجمالي فقط (ملخص بدون أسماء)</option><option value="single">تخصيص التقرير لمستثمر محدد</option></select>
                                    <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-slate-400 z-20 pointer-events-none"><ChevronDown size={16}/></div>
                                </div>
                                {printMode === 'single' && (
                                    <div className="mt-3 relative animate-fadeIn">
                                        <select value={selectedInvestorIndex} onChange={e=>setSelectedInvestorIndex(e.target.value)} className="w-full bg-orange-50 border border-[#c5a059] px-4 py-3.5 rounded-2xl text-sm font-black text-orange-900 outline-none cursor-pointer appearance-none relative z-10">{investors.map((inv, i) => <option key={i} value={i}>{inv.name || `مستثمر ${i+1}`}</option>)}</select>
                                        <div className="absolute left-4 top-1/2 transform -translate-y-1/2 text-orange-900 z-20 pointer-events-none"><ChevronDown size={16}/></div>
                                    </div>
                                )}
                            </div>
                            <label className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 cursor-pointer group hover:bg-slate-100 transition-colors"><input type="checkbox" checked={showDevInPrint} onChange={e=>setShowDevInPrint(e.target.checked)} className="w-5 h-5 text-[#c5a059] accent-[#c5a059] cursor-pointer rounded-md border-slate-300" /> <span className="text-xs font-black text-[#1a365d] select-none">إظهار تفاصيل وأتعاب المطور في الملحق</span></label>
                            <div className="flex flex-col gap-4 border-t border-slate-100 pt-6">
                                <button onClick={() => exportToPDF('teaser')} className="w-full bg-[#c5a059] text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-yellow-600 transition-all shadow-lg shadow-[#c5a059]/30 text-base"><Presentation size={22}/> تصدير العرض الاستثماري</button>
                                <button onClick={() => exportToPDF('detailed')} className="w-full bg-[#1a365d] text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 hover:bg-blue-900 transition-all shadow-lg shadow-blue-900/20 text-base"><FileSpreadsheet size={22}/> تصدير الملحق المالي (PDF)</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}