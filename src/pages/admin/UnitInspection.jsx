import React, { useState, useEffect, useContext } from 'react';
import { ClipboardCheck, DoorOpen, Sofa, ChefHat, Bed, Bath, UserCheck, Droplets, Umbrella, X, ZoomIn, Award, AlertTriangle, CheckCircle, XCircle, FileText, Save, RefreshCw } from 'lucide-react';
import { getImg, API_URL } from '../../utils/helpers';
import { AppContext } from '../../context/AppContext';

export default function UnitInspection() {
  const { adminUser: user, showToast } = useContext(AppContext);
  const [selectedUnit, setSelectedUnit] = useState("SM-A01");
  const [activeRoom, setActiveRoom] = useState("entrance");
  const [inspectionData, setInspectionData] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false); // حالة تحميل جديدة للبيانات
  const [previewPlan, setPreviewPlan] = useState(null);

  const getUnitImage = (unit) => {
    const images = {
      "SM-A01": getImg("1_SOkisFdEjokohC6DwFjJAakT0DxJild"),
      "SM-A02": getImg("1_SOkisFdEjokohC6DwFjJAakT0DxJild"),
      "SM-A03": getImg("1o0NXJ_iC-LhrvDIC4i_uOy0WSfJfsAG1"),
      "SM-A04": getImg("1o0NXJ_iC-LhrvDIC4i_uOy0WSfJfsAG1"),
      "SM-A05": getImg("1MZuAEed1Vdn70eknds87xSInFEPINogE"),
      "SM-A06": getImg("1MZuAEed1Vdn70eknds87xSInFEPINogE"),
      "SM-A07": getImg("1dMNgoNkLMjmjOeHA1R98ApKOX8yFK1y1") 
    };
    return images[unit];
  };

  const getRoomsForUnit = (unit) => {
    const isRoof = unit === "SM-A07";
    return [
      { id: "entrance", label: "المدخل ومجلس الضيوف", icon: DoorOpen },
      { id: "living", label: "صالة المعيشة", icon: Sofa },
      { id: "kitchen", label: "المطبخ", icon: ChefHat },
      { id: "master_bed", label: "غرفة النوم الرئيسية", icon: Bed },
      { id: "bed_2", label: "غرفة نوم 2", icon: Bed },
      { id: "bed_3", label: "غرفة نوم 3", icon: Bed },
      { id: "bed_4", label: "غرفة نوم 4", icon: Bed },
      ...(isRoof ? [] : [{ id: "bed_5", label: "غرفة نوم 5", icon: Bed }]),
      { id: "bath_1", label: "دورة مياه الضيوف", icon: Bath },
      { id: "bath_2", label: "دورة مياه العائلة", icon: Bath },
      { id: "bath_3", label: "دورة مياه الماستر", icon: Bath },
      { id: "bath_4", label: "دورة مياه الخادمة", icon: Bath },
      { id: "maid", label: "غرفة الخادمة", icon: UserCheck },
      { id: "laundry", label: "غرفة الغسيل", icon: Droplets },
      ...(isRoof ? [{ id: "roof", label: "السطح الخاص", icon: Umbrella }] : [])
    ];
  };

  const currentRooms = getRoomsForUnit(selectedUnit);

  const ROOM_CHECKLISTS = {
    "general_dry": { 
      "الأبواب والنوافذ 🚪": ["سلاسة الفتح والإغلاق للباب وعدم احتكاكه بالأرضية", "سلامة الأقفال والمقابض والمفصلات", "عزل الصوت والهواء حول النوافذ (سلامة الرابل)", "خلو زجاج النوافذ وإطارات الألمنيوم من الخدوش"],
      "الأعمال الكهربائية والأنظمة ⚡": ["جاهزية الأفياش واختبار القطبية والتأريض", "استجابة مفاتيح الإضاءة وخلو السبوت لايت من الوميض", "عمل أنظمة المنزل الذكي", "جاهزية كواشف الدخان والإنذار"],
      "التشطيبات المعمارية 🎨": ["استواء الجدران والأسقف المستعارة", "تجانس لون الدهان", "سلامة النعلات الجدارية", "خلو الأرضيات من الكسور أو التطبيل"],
      "التكييف والتهوية ❄️": ["كفاءة تبريد التكييف واستجابة الثرموستات", "خلو وحدات التكييف من الاهتزازات", "نظافة مخارج ومداخل الهواء"]
    },
    "wet_bath": { 
      "أعمال السباكة 🚰": ["قوة ضغط المياه (الحار والبارد)", "تصريف المياه بانسيابية وسرعة", "خلو أسفل المغاسل من أي تسريبات", "عمل السيفون المخفي والشطاف بكفاءة", "عمل السخان بكفاءة"],
      "العزل والتشطيبات 🧱": ["الميول الصحيح للبلاط باتجاه الصفاية", "اكتمال الترويبة والسيليكون", "خلو الجدران من أي علامات للرطوبة", "سلامة المرايا والإكسسوارات"],
      "الكهرباء والتهوية ⚡": ["عمل مروحة الشفط بكفاءة", "سلامة الإضاءة وإحكام إغلاقها", "تأمين الأفياش الجدارية"],
      "الأبواب 🚪": ["سلامة الباب (مقاوم للماء)", "عمل قفل الخصوصية بسلاسة"]
    },
    "kitchen": { 
      "السباكة 🚰": ["قوة ضغط المياه في حوض المطبخ", "عدم وجود تسريبات نهائياً في وصلات التصريف", "انسيابية التصريف في الحوض"],
      "الكهرباء والتهوية ⚡": ["توافر وتوصيل أفياش الأجهزة الثقيلة", "عمل مروحة الشفط الجدارية", "تأمين أفياش سطح العمل"],
      "التشطيبات 🧱": ["خلو الأرضيات من التكسر والميول السليم", "سلامة تكسيات الجدران خلف الدواليب"]
    },
    "laundry": { 
      "السباكة 🚰": ["جاهزية محابس الغسالة", "انسيابية التصريف في الصفاية الأرضية"],
      "الكهرباء والأنظمة ⚡": ["عمل أفياش الغسالة والنشافة", "جاهزية مروحة الشفط"],
      "التشطيبات 🧱": ["سلامة الأرضيات والعزل المائي المزدوج"]
    },
    "roof": { 
      "العزل والتصريف 🌧️": ["سلامة طبقات العزل المائي والحراري", "الميول الهندسي الصحيح نحو المزاريب", "خلو المزاريب من أي عوائق"],
      "الأعمال الإنشائية 🧱": ["سلامة أسوار السترة", "نظافة وثبات بلاط السطح"],
      "الكهرباء والتكييف ⚡": ["عمل الإنارة الخارجية", "العزل السليم لتمديدات التكييف الخارجية", "ثبات وحدات التكييف الخارجية"]
    }
  };

  const getChecklistType = (roomId) => {
    if (roomId.startsWith('bath')) return "wet_bath";
    if (roomId === 'kitchen') return "kitchen";
    if (roomId === 'laundry') return "laundry";
    if (roomId === 'roof') return "roof";
    return "general_dry";
  };

  // 🔥 سحب البيانات من السيرفر عند تغيير الوحدة
  useEffect(() => {
    const fetchInspectionData = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`${API_URL}?action=get_inspection&unit=${selectedUnit}`);
        const data = await res.json();
        
        if (data.success && data.data.inspection_data) {
          setInspectionData(prev => ({
            ...prev,
            [selectedUnit]: JSON.parse(data.data.inspection_data)
          }));
        } else {
          setInspectionData(prev => ({ ...prev, [selectedUnit]: {} }));
        }
      } catch (error) {
        console.error("Error fetching data");
      } finally {
        setIsLoading(false);
      }
    };

    fetchInspectionData();
    setActiveRoom("entrance");
  }, [selectedUnit]);

  const handleUnitChange = (e) => setSelectedUnit(e.target.value);

  const handleCheck = (category, itemIndex, status) => {
    setInspectionData(prev => ({
      ...prev,
      [selectedUnit]: {
        ...(prev[selectedUnit] || {}),
        [activeRoom]: {
          ...((prev[selectedUnit] || {})[activeRoom] || {}),
          [`${category}-${itemIndex}`]: { ...(((prev[selectedUnit] || {})[activeRoom] || {})[`${category}-${itemIndex}`] || {}), status }
        }
      }
    }));
  };

  const handleNoteChange = (category, itemIndex, note) => {
    setInspectionData(prev => ({
      ...prev,
      [selectedUnit]: {
        ...(prev[selectedUnit] || {}),
        [activeRoom]: {
          ...((prev[selectedUnit] || {})[activeRoom] || {}),
          [`${category}-${itemIndex}`]: { ...(((prev[selectedUnit] || {})[activeRoom] || {})[`${category}-${itemIndex}`] || {}), note }
        }
      }
    }));
  };

  // الحسابات الخاصة بالنسبة المئوية
  const currentUnitData = inspectionData[selectedUnit] || {};
  const currentRoomData = currentUnitData[activeRoom] || {};
  
  const currentChecklist = ROOM_CHECKLISTS[getChecklistType(activeRoom)];
  const roomTotalItems = Object.values(currentChecklist).flat().length;
  const roomAnsweredItems = Object.keys(currentRoomData).length;
  const roomProgress = Math.round((roomAnsweredItems / roomTotalItems) * 100) || 0;

  const unitTotalItems = currentRooms.reduce((total, room) => {
    return total + Object.values(ROOM_CHECKLISTS[getChecklistType(room.id)]).flat().length;
  }, 0);
  const unitAnsweredItems = Object.values(currentUnitData).reduce((acc, roomData) => acc + Object.keys(roomData).length, 0);
  const unitProgress = Math.round((unitAnsweredItems / unitTotalItems) * 100) || 0;

  const isUnitFullyEvaluated = unitProgress === 100;
  const hasFails = Object.values(currentUnitData).some(roomData => 
    Object.values(roomData).some(item => item.status === 'fail')
  );

  // 🔥 إرسال البيانات للسيرفر وحفظها في قاعدة البيانات
  const handleSave = async () => {
    setIsSaving(true);
    const unitDataToSave = inspectionData[selectedUnit] || {};

    try {
      const res = await fetch(`${API_URL}?action=save_inspection`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unit: selectedUnit,
          evaluator_id: user?.id || 1, 
          inspection_data: JSON.stringify(unitDataToSave),
          progress: unitProgress
        })
      });
      
      const result = await res.json();
      if (result.success) {
        showToast("تم الحفظ بنجاح", `تم حفظ تقرير فحص الوحدة ${selectedUnit} في قاعدة البيانات`, "success");
      } else {
        showToast("خطأ", "حدث خطأ أثناء الحفظ في السيرفر", "error");
      }
    } catch (error) {
      showToast("خطأ اتصال", "تعذر الاتصال بقاعدة البيانات", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const activeRoomData = currentRooms.find(r => r.id === activeRoom) || currentRooms[0];

  return (
    <div className="bg-slate-50 rounded-[2rem] shadow-xl border border-slate-200 overflow-hidden mb-12 animate-fade-in-up relative">
      {previewPlan && (
        <div className="fixed inset-0 bg-black/95 z-[9999] flex items-center justify-center p-4 cursor-pointer backdrop-blur-sm" onClick={() => setPreviewPlan(null)}>
          <img src={previewPlan} className="max-w-full max-h-screen object-contain rounded-xl shadow-2xl" alt="مخطط مكبر" />
          <button className="absolute top-6 right-6 text-white bg-white/10 hover:bg-white/20 p-3 rounded-full transition"><X size={32} /></button>
          <div className="absolute bottom-6 bg-black/50 text-white px-6 py-2 rounded-full backdrop-blur-md">مخطط الوحدة {selectedUnit}</div>
        </div>
      )}

      <div className="p-6 md:p-8 bg-white border-b border-slate-200 flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h3 className="text-2xl font-black text-[#1a365d] flex items-center gap-3"><ClipboardCheck className="text-indigo-600" /> الفحص والتدقيق الفني</h3>
          <p className="text-slate-500 text-sm mt-1">المعايير المعروضة تتغير تلقائياً حسب نوع الغرفة.</p>
        </div>
        <div className="flex flex-col items-end gap-3 w-full md:w-auto">
          <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mb-1 border border-slate-200">
            <div className={`h-full transition-all duration-700 ${isUnitFullyEvaluated ? (hasFails ? 'bg-orange-500' : 'bg-green-500') : 'bg-indigo-600'}`} style={{ width: `${unitProgress}%` }} />
          </div>
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 w-full">
            <div className="flex bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm flex-grow md:w-64">
              <span className="bg-slate-200 text-slate-700 px-4 py-3 font-bold text-sm border-l border-slate-300">الوحدة</span>
              <select value={selectedUnit} onChange={handleUnitChange} className="bg-transparent text-[#1a365d] font-black px-4 py-3 outline-none w-full">
                {["SM-A01", "SM-A02", "SM-A03", "SM-A04", "SM-A05", "SM-A06", "SM-A07"].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <button onClick={handleSave} disabled={isSaving || isLoading} className="bg-[#1a365d] text-white px-8 py-3 rounded-xl text-sm font-bold hover:bg-indigo-900 transition flex items-center justify-center gap-2 shadow-lg whitespace-nowrap h-full w-full sm:w-auto">
              {isSaving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />} حفظ التقرير
            </button>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="p-20 text-center text-indigo-600 font-bold flex flex-col items-center gap-4">
          <RefreshCw size={40} className="animate-spin" /> جاري جلب بيانات الفحص من قاعدة البيانات...
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row">
          <div className="w-full lg:w-[40%] bg-white border-l border-slate-200 p-6 flex flex-col items-center">
            <div className="relative w-full max-w-[400px] bg-slate-100 p-3 rounded-[2rem] shadow-inner border border-slate-200 cursor-pointer overflow-hidden group" onClick={() => setPreviewPlan(getUnitImage(selectedUnit))}>
              <img src={getUnitImage(selectedUnit)} alt="مخطط" className="w-full h-64 object-contain mix-blend-darken group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-[#1a365d]/90 backdrop-blur-md text-white px-6 py-3 rounded-2xl flex items-center gap-3 shadow-2xl whitespace-nowrap border border-white/20 transform group-hover:-translate-y-2 transition-all">
                 <activeRoomData.icon size={20} className="text-[#c5a059]" /> 
                 <span className="font-bold text-sm tracking-wide">جاري فحص: {activeRoomData.label}</span>
              </div>
              <div className="absolute top-4 right-4 bg-white/80 text-slate-800 p-2 rounded-xl backdrop-blur-sm shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"><ZoomIn size={20} /></div>

              {isUnitFullyEvaluated && !hasFails && (
                <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none bg-white/60 backdrop-blur-[2px] rounded-[2rem]">
                  <div className="animate-stamp-in border-4 border-green-600 text-green-600 rounded-3xl p-4 flex flex-col items-center justify-center bg-white/95 shadow-2xl">
                    <Award size={48} className="mb-1" />
                    <span className="text-2xl font-black tracking-widest uppercase">مُطابق</span>
                    <span className="text-xs font-bold mt-1 bg-green-100 px-3 py-1 rounded-full">جاهزة للتسليم</span>
                  </div>
                </div>
              )}
              {isUnitFullyEvaluated && hasFails && (
                <div className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none bg-white/60 backdrop-blur-[2px] rounded-[2rem]">
                  <div className="animate-stamp-in border-4 border-orange-500 text-orange-600 rounded-3xl p-4 flex flex-col items-center justify-center bg-white/95 shadow-2xl">
                    <AlertTriangle size={48} className="mb-1" />
                    <span className="text-2xl font-black tracking-widest uppercase">ملاحظات</span>
                    <span className="text-xs font-bold mt-1 bg-orange-100 px-3 py-1 rounded-full">تتطلب معالجة الصيانة</span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="mt-8 w-full">
              <div className="flex items-center justify-between mb-4 px-2">
                <p className="text-sm font-bold text-slate-500">اختر الفراغ المراد فحصه:</p>
                <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded font-bold">{currentRooms.length} فراغات</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3 max-h-[350px] overflow-y-auto p-2 custom-scrollbar">
                {currentRooms.map(room => {
                  const Icon = room.icon;
                  const isActive = activeRoom === room.id;
                  const rChecklist = ROOM_CHECKLISTS[getChecklistType(room.id)];
                  const rTotalItems = Object.values(rChecklist).flat().length;
                  const rData = currentUnitData[room.id] || {};
                  const isRoomCompleted = Object.keys(rData).length === rTotalItems;

                  return (
                    <button 
                      key={room.id} 
                      onClick={() => setActiveRoom(room.id)}
                      className={`relative flex flex-col items-center justify-center p-4 rounded-2xl font-bold transition-all text-xs text-center border-2 ${isActive ? 'bg-indigo-50 text-indigo-800 border-indigo-500 shadow-md scale-105 z-10' : isRoomCompleted ? 'bg-green-50/50 text-green-700 border-green-200 hover:bg-green-50' : 'bg-white text-slate-600 border-slate-100 hover:border-indigo-200 hover:bg-slate-50'}`}
                    >
                      <Icon size={24} className={`mb-2 ${isActive ? 'text-indigo-600' : isRoomCompleted ? 'text-green-500' : 'text-slate-400'}`} />
                      <span className="line-clamp-2 leading-tight">{room.label}</span>
                      {isRoomCompleted && (
                        <div className="absolute top-2 right-2 bg-white rounded-full p-0.5 shadow-sm">
                          <CheckCircle size={14} className="text-green-500" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex-1 p-6 md:p-10 bg-slate-50 overflow-y-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                  <activeRoomData.icon size={24} />
                </div>
                <div>
                  <span className="text-xs font-bold text-slate-400 block">فحص وتدقيق ({getChecklistType(activeRoom)}):</span>
                  <h4 className="text-xl font-black text-[#1a365d]">{activeRoomData.label}</h4>
                </div>
              </div>
              
              <div className="w-full md:w-48">
                <span className="text-xs font-bold text-slate-500 mb-2 flex justify-between">
                  <span>إنجاز الفراغ</span>
                  <span className={roomProgress === 100 ? "text-green-600 font-black" : "text-indigo-600 font-black"}>{roomProgress}%</span>
                </span>
                <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
                  <div className={`h-full transition-all duration-500 ${roomProgress === 100 ? 'bg-green-500' : 'bg-indigo-500'}`} style={{ width: `${roomProgress}%` }} />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {Object.entries(currentChecklist).map(([category, items]) => (
                <div key={category} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                  <h5 className="font-black text-sm text-[#1a365d] mb-5 flex items-center gap-2 border-b border-slate-100 pb-3">
                    <div className="w-2 h-2 rounded-full bg-[#c5a059]" /> {category}
                  </h5>
                  <div className="space-y-3">
                    {items.map((item, index) => {
                      const itemKey = `${category}-${index}`;
                      const itemData = currentRoomData[itemKey] || {};
                      const isPass = itemData.status === 'pass';
                      const isFail = itemData.status === 'fail';

                      return (
                        <div key={index} className={`p-4 rounded-xl border transition-all ${isFail ? 'bg-red-50 border-red-200' : isPass ? 'bg-green-50/30 border-green-200' : 'bg-slate-50 border-slate-200 hover:border-indigo-300'}`}>
                          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                            <span className={`text-sm font-bold flex-1 ${isFail ? 'text-red-900' : isPass ? 'text-green-800' : 'text-slate-700'}`}>{item}</span>
                            <div className="flex gap-2 shrink-0 bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
                              <button 
                                onClick={() => handleCheck(category, index, 'pass')}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition ${isPass ? 'bg-green-500 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-green-50 hover:text-green-700'}`}
                              >
                                <CheckCircle size={16} /> مطابق
                              </button>
                              <div className="w-px bg-slate-200 my-1"></div>
                              <button 
                                onClick={() => handleCheck(category, index, 'fail')}
                                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition ${isFail ? 'bg-red-500 text-white shadow-md' : 'bg-transparent text-slate-500 hover:bg-red-50 hover:text-red-700'}`}
                              >
                                <XCircle size={16} /> ملاحظة
                              </button>
                            </div>
                          </div>
                          {isFail && (
                            <div className="mt-4 pt-4 border-t border-red-200/50 animate-fadeIn relative">
                              <FileText size={16} className="absolute right-3 top-7 text-red-400" />
                              <textarea 
                                placeholder="اكتب وصفاً دقيقاً للمشكلة..." 
                                value={itemData.note || ""}
                                onChange={(e) => handleNoteChange(category, index, e.target.value)}
                                className="w-full bg-white border border-red-200 rounded-xl p-3 pr-10 text-sm outline-none focus:border-red-400 focus:ring-2 focus:ring-red-100 text-red-900 placeholder-red-300 min-h-[80px] transition-all shadow-inner"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}