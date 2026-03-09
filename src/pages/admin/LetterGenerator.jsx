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
  const [loadingAuth, setLoadingAuth] = useState(true); // حالة التحميل من السيرفر

  const [data, setData] = useState({
    date: new Date().toISOString().split("T")[0],
    recipient: "شركاء النجاح المحترمين",
    subject: "",
    body: "", 
    signName: "", // سيتم تعبئتها من الداتابيس
    signTitle: "", // سيتم تعبئتها من الداتابيس
    showStamp: false
  });

  const [dbTemplates, setDbTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newTempMeta, setNewTempMeta] = useState({ category: "إدارية عامة", title: "" });

  // 🔥 سحب بياناتك الحية من قاعدة البيانات مباشرة
  useEffect(() => {
    const fetchUserFromDB = async () => {
      // نحتاج الـ ID فقط كـ "مفتاح" لمعرفة هويتك
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
          // تعبئة البيانات في الخطاب من قاعدة البيانات فوراً
          setData(prev => ({
            ...prev,
            signName: freshUser.name || "أحمد البادي",
            signTitle: freshUser.job || "المدير العام",
            showStamp: freshUser.role === "admin"
          }));
        } else {
          // إذا لم يجد المستخدم في الداتابيس (تم حذفه مثلاً)
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

  const groupedTemplates = dbTemplates.reduce((acc, curr) => {
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

  // شاشة تحميل أثناء الاتصال بقاعدة البيانات
  if (loadingAuth) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white font-cairo">
        <Loader2 className="animate-spin text-[#c5a059] mb-4" size={48} />
        <p className="font-bold text-lg">جاري التحقق من الصلاحيات والبيانات...</p>
      </div>
    );
  }

  if (!dbUser) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 h-screen w-screen flex flex-col md:flex-row font-cairo overflow-hidden">
      <div className="w-full md:w-1/3 min-w-[320px] bg-slate-900 text-white flex flex-col shadow-2xl h-full overflow-y-auto no-print">
        <div className="p-6 border-b border-slate-700 flex justify-between items-center">
          <h2 className="text-xl font-bold text-[#c5a059] flex items-center gap-2"><FilePenLine /> صانع الخطابات</h2>
          <button onClick={() => window.close()} className="p-2 bg-slate-800 rounded hover:bg-slate-700 transition" title="إغلاق النافذة"><ArrowRight size={18} /></button>
        </div>
        <div className="p-6 space-y-4 flex-grow">
          <div>
            <label className="text-xs font-bold text-[#c5a059] block mb-2">اختر نموذجاً للبدء</label>
            <select onChange={handleTemplateChange} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm outline-none text-white focus:border-[#c5a059] transition cursor-pointer">
              <option value="custom">-- خطاب جديد (فارغ) --</option>
              {loadingTemplates ? (
                <option disabled>جاري تحميل النماذج...</option>
              ) : (
                Object.keys(groupedTemplates).map(category => (
                  <optgroup key={category} label={category} className="text-[#c5a059] font-bold">
                    {groupedTemplates[category].map(temp => (
                      <option key={temp.id} value={temp.id} className="text-white font-normal">{temp.title}</option>
                    ))}
                  </optgroup>
                ))
              )}
            </select>
          </div>
          <div className="w-full h-px bg-slate-700/50 my-2" />
          
          <div><label className="text-xs text-slate-400 block mb-1">التاريخ</label><input type="date" value={data.date} onChange={e => setData({ ...data, date: e.target.value })} className="w-full bg-slate-800 rounded p-2 text-sm outline-none border border-slate-700 focus:border-[#c5a059] transition" style={{ colorScheme: "dark" }} /></div>
          <div><label className="text-xs text-slate-400 block mb-1">المستلم</label><input type="text" value={data.recipient} onChange={e => setData({ ...data, recipient: e.target.value })} className="w-full bg-slate-800 rounded p-2 text-sm outline-none border border-slate-700 focus:border-[#c5a059] transition" /></div>
          <div><label className="text-xs text-slate-400 block mb-1">الموضوع</label><input type="text" value={data.subject} onChange={e => setData({ ...data, subject: e.target.value })} className="w-full bg-slate-800 rounded p-2 text-sm outline-none font-bold border border-slate-700 focus:border-[#c5a059] transition" /></div>
          
          <div className="mb-4">
            <label className="text-xs text-slate-400 block mb-1">نص الخطاب (المحرر الذكي)</label>
            <div className="bg-white rounded-lg text-black">
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
            <div><label className="text-xs text-slate-400 block mb-1">اسم الموقع</label><input type="text" value={data.signName} onChange={e => setData({ ...data, signName: e.target.value })} className="w-full bg-slate-800 rounded p-2 text-sm outline-none border border-slate-700 focus:border-[#c5a059] transition" /></div>
            <div><label className="text-xs text-slate-400 block mb-1">المنصب</label><input type="text" value={data.signTitle} onChange={e => setData({ ...data, signTitle: e.target.value })} className="w-full bg-slate-800 rounded p-2 text-sm outline-none border border-slate-700 focus:border-[#c5a059] transition" /></div>
          </div>
          
          {dbUser?.role === "admin" && (
            <div className="flex justify-between items-center pt-4 border-b border-slate-700 pb-4">
              <span className="text-sm font-bold text-slate-300">إظهار الختم والتوقيع الرسمي</span>
              <input type="checkbox" checked={data.showStamp} onChange={e => setData({ ...data, showStamp: e.target.checked })} className="w-5 h-5 accent-[#c5a059] cursor-pointer" />
            </div>
          )}

          <div className="bg-slate-800/50 p-4 rounded-xl mt-4 border border-slate-700">
            {!showSaveForm ? (
              <button onClick={() => setShowSaveForm(true)} className="w-full text-sm font-bold text-teal-400 hover:text-teal-300 transition flex items-center justify-center gap-2 py-2">
                <FilePenLine size={16} /> حفظ التعديلات كنموذج جديد
              </button>
            ) : (
              <div className="space-y-3 animate-fadeIn">
                <div className="text-xs text-slate-400 mb-2 text-center bg-slate-800 p-2 rounded">سيتم حفظ هذا النص كقالب جديد في قاعدة البيانات ليتم استخدامه لاحقاً من قبل الجميع.</div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">تصنيف النموذج الجديد</label>
                  <select value={newTempMeta.category} onChange={e => setNewTempMeta({...newTempMeta, category: e.target.value})} className="w-full bg-slate-700 rounded p-2 text-sm outline-none border border-slate-600 focus:border-teal-500">
                    <option value="النماذج المالية">النماذج المالية</option>
                    <option value="نماذج العملاء والمبيعات">نماذج العملاء والمبيعات</option>
                    <option value="إدارة الأملاك والصيانة">إدارة الأملاك والصيانة</option>
                    <option value="الشؤون القانونية وإدارة الأملاك">الشؤون القانونية وإدارة الأملاك</option>
                    <option value="الموارد البشرية والموظفين">الموارد البشرية والموظفين</option>
                    <option value="خدمة العملاء">خدمة العملاء</option>
                    <option value="إدارية عامة">إدارية عامة</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">اسم النموذج (في القائمة)</label>
                  <input type="text" value={newTempMeta.title} onChange={e => setNewTempMeta({...newTempMeta, title: e.target.value})} className="w-full bg-slate-700 rounded p-2 text-sm outline-none border border-slate-600 focus:border-teal-500 text-white font-bold" placeholder="مثال: نموذج استلام جديد" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={saveTemplateToDB} disabled={isSaving} className="flex-1 bg-teal-600 text-white py-2 rounded font-bold text-sm hover:bg-teal-500 transition flex items-center justify-center shadow-lg">
                    {isSaving ? <RefreshCw className="animate-spin" size={16} /> : "تأكيد الحفظ كجديد"}
                  </button>
                  <button onClick={() => setShowSaveForm(false)} className="px-4 bg-slate-600 text-white py-2 rounded font-bold text-sm hover:bg-slate-500 transition">إلغاء</button>
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="p-4 bg-slate-950 border-t border-slate-800">
          <button onClick={() => window.print()} className="w-full bg-[#c5a059] text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-yellow-600 transition shadow-lg shadow-[#c5a059]/20 transform hover:-translate-y-1">
            <Printer /> طباعة / تصدير (PDF)
          </button>
        </div>
      </div>

      <div className="flex-1 bg-gray-200 overflow-y-auto p-4 md:p-10 flex justify-center items-start">
        <div className="a4-page bg-white text-black shadow-xl" id="printArea">
          <div className="decorative-strip" />
          <div className="letter-header">
            <img src={getImg("1I5KIPkeuwJ0CawpWJLpiHdmofSKLQglN")} alt="شعار" className="h-20 md:h-24 object-contain" />
            <div className="flex flex-col items-end">
              <p className="text-[#c5a059] font-bold text-xs md:text-sm mb-2 font-cairo">سقف يعلو برؤيتك ومسكن يحكي قصتك</p>
              <div className="bg-slate-50 px-4 py-1 rounded-full border border-slate-200">
                <p className="text-[#1a365d] text-xs md:text-sm font-bold tracking-wider font-cairo">الرقم الموحد: 7051031099</p>
              </div>
            </div>
          </div>
          <div className="letter-body font-amiri text-base md:text-lg relative z-10 flex-grow pt-8 md:pt-10 px-8 md:px-12">
            <img src={getImg("1I5KIPkeuwJ0CawpWJLpiHdmofSKLQglN")} className="watermark" alt="" />
            <div className="text-left mb-6 md:mb-8 font-cairo text-sm text-[#1a365d]"><strong>التاريخ:</strong> {data.date}</div>
            <div className="mb-6"><h3 className="font-bold text-lg md:text-xl text-black font-cairo">{data.recipient}</h3></div>
            <div className="mb-6 font-cairo">تحية طيبة وبعد،،</div>
            <div className="text-center mb-8 md:mb-10"><span className="border-b-2 border-[#c5a059] pb-2 px-8 font-bold text-lg md:text-xl text-[#1a365d] font-cairo">{data.subject}</span></div>
            
            <div className="text-justify leading-[2.2] flex-grow quill-content" dangerouslySetInnerHTML={{ __html: data.body }}></div>
            
            <div className="corner-accent" />
            <div className="mt-12 mb-12 flex justify-between items-start px-4 md:px-12 relative min-h-[150px]">
              <div className="relative w-40 md:w-48 flex justify-center">
                {data.showStamp && dbUser?.role === "admin" && (
                  <img src={getImg("1lCYGae5VrEMVh8OEKHHBWTxLPJH7t0u5")} className="w-full object-contain opacity-90 mix-blend-multiply" alt="ختم" />
                )}
              </div>
              <div className="text-center pt-8 md:pt-10 pl-4 md:pl-8 font-cairo">
                <p className="font-bold text-[#1a365d] mb-2 text-lg md:text-xl">{data.signTitle}</p>
                <p className="font-bold text-base md:text-lg">{data.signName}</p>
              </div>
            </div>
          </div>
          <div className="letter-footer">
            <div className="text-center pl-4 font-cairo">
              <p className="font-bold text-xs md:text-sm mb-1">المملكة العربية السعودية - مكة المكرمة - حي البوابة</p>
              <div className="flex justify-center gap-6 text-[10px] md:text-xs text-gray-300 ltr" dir="ltr">
                <span className="font-sans">semak.sa</span>
                <span className="font-sans">920032842</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}