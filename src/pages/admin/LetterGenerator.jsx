import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { FilePenLine, ArrowRight, Printer, RefreshCw, Loader2 } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { API_URL, getImg } from '../../utils/helpers';

export default function LetterGenerator() {
  const { user: contextUser, showToast } = useContext(AppContext);
  const navigate = useNavigate();

  const [dbUser, setDbUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [data, setData] = useState({
    date: new Date().toISOString().split("T")[0],
    recipient: "شركاء النجاح المحترمين",
    subject: "",
    body: "", 
    signName: "", 
    signTitle: "", 
    showStamp: false
  });

  const [dbTemplates, setDbTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newTempMeta, setNewTempMeta] = useState({ category: "إدارية عامة", title: "" });

  useEffect(() => {
    const fetchUserFromDB = async () => {
      const currentId = contextUser?.id || JSON.parse(localStorage.getItem("semak_current_user"))?.id;
      
      if (!currentId) {
        navigate("/login");
        return;
      }

      try {
        const res = await fetch(`${API_URL}?action=get_users`);
        const users = await res.json();
        const freshUser = users.find(u => u.id === currentId);

        if (freshUser) {
          setDbUser(freshUser);
          setData(prev => ({
            ...prev,
            signName: freshUser.name || "أحمد البادي",
            signTitle: freshUser.job || "المدير العام",
            showStamp: freshUser.role === "admin"
          }));
        } else {
          navigate("/login");
        }
      } catch (error) {
        if(showToast) showToast("خطأ", "فشل التحقق من بيانات المستخدم", "error");
      } finally {
        setLoadingAuth(false);
      }
    };

    fetchUserFromDB();
  }, [contextUser, navigate]);

  const quillModules = {
    toolbar: [
      [{ 'header': [1, 2, 3, false] }],
      ['bold', 'italic', 'underline', 'strike'],
      [{ 'color': [] }, { 'background': [] }],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'align': [] }],
      ['link', 'image'],
      ['clean']
    ],
  };

  const fetchTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const res = await fetch(`${API_URL}?action=get_templates`);
      const result = await res.json();
      setDbTemplates(result);
    } catch (error) {
      console.error("تعذر جلب النماذج", error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

// 🔥 درع الحماية: نتأكد إن النماذج عبارة عن قائمة قبل ما نرتبها عشان ما تطلع شاشة بيضاء
  const groupedTemplates = (Array.isArray(dbTemplates) ? dbTemplates : []).reduce((acc, curr) => {
    if (!acc[curr.category]) acc[curr.category] = [];
    acc[curr.category].push(curr);
    return acc;
  }, {});

  const handleTemplateChange = (e) => {
    const val = e.target.value;
    if (val === "custom") {
      setData({ ...data, subject: "", body: "" });
      setNewTempMeta({ category: "إدارية عامة", title: "" });
      setShowSaveForm(false);
      return;
    }
    const selected = dbTemplates.find(t => t.id.toString() === val);
    if (selected) {
      setData({ ...data, subject: selected.subject, body: selected.body });
      setNewTempMeta({ category: selected.category, title: selected.title + " - معدل" });
      setShowSaveForm(false);
    }
  };

  const saveTemplateToDB = async () => {
    if (!newTempMeta.title.trim()) {
      if(showToast) showToast("تنبيه", "يرجى كتابة اسم للنموذج الجديد", "error");
      return;
    }
    if (!data.subject.trim() || data.body.replace(/<[^>]*>?/gm, '').trim() === '') {
      if(showToast) showToast("تنبيه", "محتوى الخطاب (الموضوع والنص) فارغ!", "error");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`${API_URL}?action=add_template`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: newTempMeta.category,
          title: newTempMeta.title,
          subject: data.subject,
          body: data.body
        })
      });
      const result = await res.json();
      if (result.success) {
        if(showToast) showToast("تم بنجاح", "تم حفظ النموذج كنسخة جديدة في قاعدة البيانات.");
        setShowSaveForm(false);
        fetchTemplates();
      } else {
        if(showToast) showToast("خطأ", "حدث خطأ أثناء الحفظ", "error");
      }
    } catch (error) {
      if(showToast) showToast("خطأ اتصال", "فشل الاتصال بالسيرفر", "error");
    } finally {
      setIsSaving(false);
    }
  };

  if (loadingAuth) {
    return (
      <div className="w-full h-64 flex flex-col items-center justify-center bg-white rounded-[2rem] shadow-sm font-cairo">
        <Loader2 className="animate-spin text-[#c5a059] mb-4" size={48} />
        <p className="font-bold text-lg text-[#1a365d]">جاري التحقق من الصلاحيات والبيانات...</p>
      </div>
    );
  }

  if (!dbUser) return null;

  return (
    // 🔥 التعديل هنا: شلنا (fixed inset-0 h-screen w-screen) عشان يندمج صح مع الداش بورد
    <div className="w-full flex flex-col md:flex-row gap-6 font-cairo mb-10 animate-fadeIn min-h-[800px]">
      
      {/* 🛠️ اللوحة الجانبية (أدوات التحكم) */}
      <div className="w-full md:w-[350px] bg-[#112240] text-white flex flex-col rounded-[2rem] shadow-xl overflow-hidden no-print">
        <div className="p-6 bg-[#0f172a] flex justify-between items-center border-b border-white/10">
          <h2 className="text-xl font-bold text-[#c5a059] flex items-center gap-2"><FilePenLine /> صانع الخطابات</h2>
        </div>
        
        <div className="p-6 space-y-4 flex-grow overflow-y-auto">
          <div>
            <label className="text-xs font-bold text-[#c5a059] block mb-2">اختر نموذجاً للبدء</label>
            <select onChange={handleTemplateChange} className="w-full bg-white/10 border border-white/20 rounded-xl p-3 text-sm outline-none text-white focus:border-[#c5a059] transition cursor-pointer">
              <option value="custom">-- خطاب جديد (فارغ) --</option>
              {loadingTemplates ? (
                <option disabled>جاري تحميل النماذج...</option>
              ) : (
                Object.keys(groupedTemplates).map(category => (
                  <optgroup key={category} label={category} className="text-[#c5a059] font-bold bg-[#112240]">
                    {groupedTemplates[category].map(temp => (
                      <option key={temp.id} value={temp.id} className="text-white font-normal">{temp.title}</option>
                    ))}
                  </optgroup>
                ))
              )}
            </select>
          </div>
          <div className="w-full h-px bg-white/10 my-2" />
          
          <div><label className="text-xs text-slate-400 block mb-1">التاريخ</label><input type="date" value={data.date} onChange={e => setData({ ...data, date: e.target.value })} className="w-full bg-white/10 rounded-xl p-3 text-sm outline-none border border-white/20 focus:border-[#c5a059] transition text-white" style={{ colorScheme: "dark" }} /></div>
          <div><label className="text-xs text-slate-400 block mb-1">المستلم</label><input type="text" value={data.recipient} onChange={e => setData({ ...data, recipient: e.target.value })} className="w-full bg-white/10 rounded-xl p-3 text-sm outline-none border border-white/20 focus:border-[#c5a059] transition text-white" /></div>
          <div><label className="text-xs text-slate-400 block mb-1">الموضوع</label><input type="text" value={data.subject} onChange={e => setData({ ...data, subject: e.target.value })} className="w-full bg-white/10 rounded-xl p-3 text-sm outline-none font-bold border border-white/20 focus:border-[#c5a059] transition text-white" /></div>
          
          <div className="mb-4">
            <label className="text-xs text-slate-400 block mb-1">نص الخطاب (المحرر الذكي)</label>
            <div className="bg-white rounded-xl text-black overflow-hidden border border-white/20">
              <ReactQuill 
                theme="snow" 
                value={data.body} 
                onChange={(content) => setData({ ...data, body: content })} 
                modules={quillModules}
                placeholder="اكتب تفاصيل الخطاب هنا... يمكنك إضافة صور ولصق جداول."
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs text-slate-400 block mb-1">اسم الموقع</label><input type="text" value={data.signName} onChange={e => setData({ ...data, signName: e.target.value })} className="w-full bg-white/10 rounded-xl p-3 text-sm outline-none border border-white/20 focus:border-[#c5a059] transition text-white" /></div>
            <div><label className="text-xs text-slate-400 block mb-1">المنصب</label><input type="text" value={data.signTitle} onChange={e => setData({ ...data, signTitle: e.target.value })} className="w-full bg-white/10 rounded-xl p-3 text-sm outline-none border border-white/20 focus:border-[#c5a059] transition text-white" /></div>
          </div>
          
          {dbUser?.role === "admin" && (
            <div className="flex justify-between items-center pt-4 border-t border-white/10 mt-4">
              <span className="text-sm font-bold text-slate-300">إظهار الختم والتوقيع الرسمي</span>
              <input type="checkbox" checked={data.showStamp} onChange={e => setData({ ...data, showStamp: e.target.checked })} className="w-5 h-5 accent-[#c5a059] cursor-pointer rounded" />
            </div>
          )}

          <div className="bg-white/5 p-4 rounded-xl mt-4 border border-white/10">
            {!showSaveForm ? (
              <button onClick={() => setShowSaveForm(true)} className="w-full text-sm font-bold text-teal-400 hover:text-teal-300 transition flex items-center justify-center gap-2 py-2">
                <FilePenLine size={16} /> حفظ التعديلات كنموذج جديد
              </button>
            ) : (
              <div className="space-y-3 animate-fadeIn">
                <div className="text-xs text-slate-400 mb-2 text-center bg-[#0f172a] p-2 rounded-lg">سيتم حفظ هذا النص كقالب جديد ليتم استخدامه لاحقاً.</div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">تصنيف النموذج الجديد</label>
                  <select value={newTempMeta.category} onChange={e => setNewTempMeta({...newTempMeta, category: e.target.value})} className="w-full bg-white/10 rounded-lg p-2 text-sm outline-none border border-white/20 focus:border-teal-500 text-white">
                    <option className="text-black" value="النماذج المالية">النماذج المالية</option>
                    <option className="text-black" value="نماذج العملاء والمبيعات">نماذج العملاء والمبيعات</option>
                    <option className="text-black" value="إدارة الأملاك والصيانة">إدارة الأملاك والصيانة</option>
                    <option className="text-black" value="الشؤون القانونية وإدارة الأملاك">الشؤون القانونية وإدارة الأملاك</option>
                    <option className="text-black" value="الموارد البشرية والموظفين">الموارد البشرية والموظفين</option>
                    <option className="text-black" value="خدمة العملاء">خدمة العملاء</option>
                    <option className="text-black" value="إدارية عامة">إدارية عامة</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">اسم النموذج (في القائمة)</label>
                  <input type="text" value={newTempMeta.title} onChange={e => setNewTempMeta({...newTempMeta, title: e.target.value})} className="w-full bg-white/10 rounded-lg p-2 text-sm outline-none border border-white/20 focus:border-teal-500 text-white font-bold" placeholder="مثال: نموذج استلام جديد" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={saveTemplateToDB} disabled={isSaving} className="flex-1 bg-teal-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-teal-500 transition flex items-center justify-center shadow-lg">
                    {isSaving ? <RefreshCw className="animate-spin" size={16} /> : "تأكيد الحفظ"}
                  </button>
                  <button onClick={() => setShowSaveForm(false)} className="px-4 bg-slate-600 text-white py-2 rounded-lg font-bold text-sm hover:bg-slate-500 transition">إلغاء</button>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="p-4 bg-[#0f172a] border-t border-white/10">
          <button onClick={() => window.print()} className="w-full bg-[#c5a059] text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-yellow-600 transition shadow-lg shadow-[#c5a059]/20 transform hover:-translate-y-1">
            <Printer /> طباعة / تصدير (PDF)
          </button>
        </div>
      </div>

      {/* 📜 منطقة المعاينة والطباعة (ورقة A4) */}
      <div className="flex-1 bg-slate-200 rounded-[2rem] overflow-y-auto p-4 md:p-8 flex justify-center items-start shadow-inner border border-slate-300 print:p-0 print:bg-white print:border-none print:shadow-none print:rounded-none">
        <div className="a4-page bg-white text-black shadow-2xl relative print:shadow-none" id="printArea" style={{ width: '210mm', minHeight: '297mm', padding: '0', margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
          
          <div className="decorative-strip" style={{ height: '8px', background: 'linear-gradient(90deg, #1a365d, #c5a059)', width: '100%' }} />
          
          <div className="letter-header flex justify-between items-center px-12 pt-8 pb-4 border-b border-gray-100">
            <img src={getImg("1I5KIPkeuwJ0CawpWJLpiHdmofSKLQglN")} alt="شعار" className="h-24 object-contain" />
            <div className="flex flex-col items-end">
              <p className="text-[#c5a059] font-bold text-sm mb-2 font-cairo">سقف يعلو برؤيتك ومسكن يحكي قصتك</p>
              <div className="bg-slate-50 px-4 py-1 rounded-full border border-slate-200">
                <p className="text-[#1a365d] text-sm font-bold tracking-wider font-cairo">الرقم الموحد: 7051031099</p>
              </div>
            </div>
          </div>
          
          <div className="letter-body font-amiri text-lg relative z-10 flex-grow pt-10 px-12">
            <img src={getImg("1I5KIPkeuwJ0CawpWJLpiHdmofSKLQglN")} className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-[0.03] w-[60%] pointer-events-none" alt="" />
            
            <div className="text-left mb-8 font-cairo text-sm text-[#1a365d]"><strong>التاريخ:</strong> {data.date}</div>
            <div className="mb-6"><h3 className="font-bold text-xl text-black font-cairo">{data.recipient}</h3></div>
            <div className="mb-6 font-cairo">تحية طيبة وبعد،،</div>
            <div className="text-center mb-10"><span className="border-b-2 border-[#c5a059] pb-2 px-8 font-bold text-xl text-[#1a365d] font-cairo">{data.subject}</span></div>
            
            <div className="text-justify leading-[2.2] flex-grow quill-content" dangerouslySetInnerHTML={{ __html: data.body }}></div>
            
            <div className="mt-16 mb-8 flex justify-between items-end px-4 relative min-h-[150px]">
              <div className="relative w-48 flex justify-center">
                {data.showStamp && dbUser?.role === "admin" && (
                  <img src={getImg("1lCYGae5VrEMVh8OEKHHBWTxLPJH7t0u5")} className="w-full object-contain opacity-90 mix-blend-multiply absolute bottom-0" alt="ختم" />
                )}
              </div>
              <div className="text-center font-cairo relative z-10 pb-4">
                <p className="font-bold text-[#1a365d] mb-3 text-xl">{data.signTitle}</p>
                <p className="font-bold text-lg">{data.signName}</p>
              </div>
            </div>
          </div>
          
          <div className="letter-footer mt-auto border-t border-gray-100 bg-gray-50/50">
            <div className="text-center py-4 font-cairo">
              <p className="font-bold text-sm mb-1 text-[#1a365d]">المملكة العربية السعودية - مكة المكرمة - حي البوابة</p>
              <div className="flex justify-center gap-6 text-xs text-gray-400 ltr" dir="ltr">
                <span className="font-sans font-bold">semak.sa</span>
                <span className="font-sans font-bold">920032842</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}