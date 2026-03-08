import React, { useState, useEffect } from 'react';
import { ChevronRight, ClipboardCheck, Home, CheckCircle2, AlertCircle, Save, Printer, RefreshCw } from 'lucide-react';

const API_URL = "https://semak.sa/api.php";

const INSPECTION_AREAS = [
  { id: 'living', name: 'غرفة المعيشة / الصالة', items: ['الدهانات', 'الأرضيات', 'الأبواب والنوافذ', 'الأفياش والكهرباء', 'التكييف'] },
  { id: 'kitchen', name: 'المطبخ', items: ['السباكة والتصريف', 'الرخام / الكاونتر', 'الخزائن', 'التهوية', 'الإضاءة'] },
  { id: 'master_bed', name: 'غرفة النوم الرئيسية', items: ['الأرضيات', 'الخزائن الحائطية', 'دورة المياه الخاصة', 'العزل الصوتي', 'الإضاءة'] },
  { id: 'bathrooms', name: 'دورات المياه العامة', items: ['أطقم الحمام', 'العزل المائي', 'تصريف المياه', 'السخانات', 'الخلاطات'] },
  { id: 'exterior', name: 'الخارج / الحوش / الواجهة', items: ['الإضاءة الخارجية', 'الإنتركوم', 'الباب الرئيسي', 'مواقف السيارات'] }
];

export default function UnitInspection({ user, navigateTo, showToast }) {
  const [selectedUnit, setSelectedUnit] = useState("SM-A01");
  const [inspectionData, setInspectionData] = useState({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // جلب البيانات المخزنة مسبقاً لهذه الوحدة
  useEffect(() => {
    loadInspection();
  }, [selectedUnit]);

  const loadInspection = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=get_inspection&unit=${selectedUnit}`);
      const data = await res.json();
      if (data.success && data.data) {
        setInspectionData(JSON.parse(data.data.inspection_data));
      } else {
        setInspectionData({}); // وحدة جديدة
      }
    } catch (e) {
      console.error("فشل التحميل");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleItem = (areaId, item) => {
    const key = `${areaId}_${item}`;
    setInspectionData(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const calculateProgress = () => {
    const totalItems = INSPECTION_AREAS.reduce((acc, area) => acc + area.items.length, 0);
    const checkedItems = Object.values(inspectionData).filter(v => v === true).length;
    return Math.round((checkedItems / totalItems) * 100);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        unit: selectedUnit,
        evaluator_id: user?.id || 1,
        inspection_data: JSON.stringify(inspectionData),
        progress: calculateProgress()
      };
      const res = await fetch(`${API_URL}?action=save_inspection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast("تم الحفظ", "تم حفظ تقرير الفحص بنجاح ✅");
      }
    } catch (e) {
      showToast("خطأ", "فشل الاتصال بالسيرفر", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pt-24 pb-20 bg-slate-50 min-h-screen animate-fadeIn">
      <div className="container mx-auto px-6 max-w-5xl">
        
        {/* الرأس */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div className="flex items-center gap-4">
            <button onClick={() => navigateTo('dashboard')} className="p-3 hover:bg-slate-100 rounded-full transition">
              <ChevronRight size={24} className="text-slate-600" />
            </button>
            <div>
              <h1 className="text-2xl font-black text-[#1a365d] flex items-center gap-2">
                <ClipboardCheck className="text-indigo-600" /> فحص واستلام الوحدات
              </h1>
              <p className="text-slate-400 text-xs font-bold">إدارة الجودة والتدقيق الهندسي</p>
            </div>
          </div>

          <div className="flex gap-3 w-full md:w-auto">
            <select 
              value={selectedUnit} 
              onChange={(e) => setSelectedUnit(e.target.value)}
              className="bg-slate-100 border-none rounded-xl px-4 py-3 font-bold text-[#1a365d] outline-none focus:ring-2 ring-indigo-500"
            >
              {["SM-A01", "SM-A02", "SM-A03", "SM-A04", "SM-A05"].map(u => <option key={u} value={u}>الوحدة: {u}</option>)}
            </select>
            <button onClick={handleSave} disabled={saving} className="bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 hover:bg-indigo-700 transition shadow-lg shadow-indigo-100 disabled:opacity-50">
              {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />} حفظ التقرير
            </button>
          </div>
        </div>

        {/* شريط الإنجاز */}
        <div className="bg-white p-6 rounded-[2rem] mb-8 shadow-sm border border-slate-100">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-black text-slate-700">نسبة جاهزية الوحدة ({selectedUnit})</span>
            <span className="text-indigo-600 font-black">{calculateProgress()}%</span>
          </div>
          <div className="w-full bg-slate-100 h-4 rounded-full overflow-hidden">
            <div 
              className="bg-gradient-to-r from-indigo-500 to-emerald-400 h-full transition-all duration-1000" 
              style={{ width: `${calculateProgress()}%` }}
            ></div>
          </div>
        </div>

        {/* مناطق الفحص */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {INSPECTION_AREAS.map(area => (
            <div key={area.id} className="bg-white rounded-[2rem] shadow-sm border border-slate-100 overflow-hidden group hover:border-indigo-200 transition-colors">
              <div className="p-6 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-black text-[#1a365d]">{area.name}</h3>
                <span className="bg-white text-[10px] font-bold px-3 py-1 rounded-full text-slate-400 border border-slate-200 uppercase tracking-widest">{area.items.length} نقاط</span>
              </div>
              <div className="p-6 space-y-4">
                {area.items.map(item => {
                  const isChecked = inspectionData[`${area.id}_${item}`];
                  return (
                    <div 
                      key={item} 
                      onClick={() => handleToggleItem(area.id, item)}
                      className={`flex items-center justify-between p-4 rounded-2xl cursor-pointer transition-all border ${isChecked ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100 hover:bg-slate-50'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors ${isChecked ? 'bg-emerald-500 border-emerald-500' : 'border-slate-200'}`}>
                          {isChecked && <CheckCircle2 size={16} className="text-white" />}
                        </div>
                        <span className={`text-sm font-bold ${isChecked ? 'text-emerald-700' : 'text-slate-600'}`}>{item}</span>
                      </div>
                      {!isChecked && <AlertCircle size={16} className="text-slate-300" />}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* زر الطباعة */}
        <div className="mt-12 text-center">
          <button onClick={() => window.print()} className="bg-slate-800 text-white px-10 py-4 rounded-2xl font-black flex items-center gap-3 mx-auto hover:bg-black transition no-print shadow-xl">
            <Printer size={20} /> طباعة محضر استلام الوحدة رسمي
          </button>
        </div>

      </div>
    </div>
  );
}