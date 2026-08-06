import React, { useState, useEffect, useContext, useRef } from 'react';
import DOMPurify from 'dompurify';
import { useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { FilePenLine, Printer, RefreshCw, Loader2, ArrowRight } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { API_URL } from '../../utils/helpers';
import { getAdminToken } from '../../lib/api/client';
import { renderToStaticMarkup } from 'react-dom/server';
import PrintableLetterhead, { SEMAK_PRINT_CSS } from '../../components/PrintableLetterhead';

// فتح نافذة طباعة مستقلة - الهيدر/الفوتر/العلامة المائية تتكرر على كل صفحة
const printInNewWindow = (jsx, title) => {
    const html = renderToStaticMarkup(jsx);
    const w = window.open('', '_blank', 'width=900,height=1200');
    if (!w) { alert('يرجى السماح بفتح النوافذ المنبثقة'); return; }
    w.document.write(`<!DOCTYPE html>
<html dir="rtl" lang="ar"><head><meta charset="utf-8"><title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&family=Amiri:wght@400;700&display=swap" rel="stylesheet">
<style>${SEMAK_PRINT_CSS}</style></head><body>${html}</body></html>`);
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

export default function LetterGenerator() {
  const { user: contextUser, showToast, branding } = useContext(AppContext);
  const companyName = branding?.company_name || 'سماك العقارية';
  const navigate = useNavigate();

  // 🔥 مرجع (Ref) لربط الورقة المخفية بالطابعة
  // printRef غير مستخدم بعد التحويل لـ Portal

  const [dbUser, setDbUser] = useState(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  const [data, setData] = useState({
    date: new Date().toISOString().split("T")[0],
    recipient: "شركاء النجاح",
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

  // دالة الطباعة - نافذة جديدة مستقلة (الأكثر موثوقية)
  const handlePrint = () => {
    const jsx = (
      <PrintableLetterhead documentLabel="خطاب رسمي" date={data.date} companyName={companyName}>
        <div className="font-amiri" style={{ fontSize: '15px', lineHeight: 2.2, color: '#1e293b' }}>
          <div style={{ marginTop: '8mm', marginBottom: '6mm', borderRight: '4px solid #c5a059', paddingRight: '14px', paddingTop: '6px', paddingBottom: '6px', backgroundColor: '#f8fafc', borderRadius: '0 12px 12px 0' }}>
            <h3 style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 700, fontSize: '20px', color: '#1a365d', margin: 0, lineHeight: 1.6 }}>
              السادة / {data.recipient}<br />
              <span style={{ color: '#c5a059', fontSize: '16px', marginTop: '2px', display: 'inline-block' }}>المحترمين،،</span>
            </h3>
          </div>
          {data.subject && (
            <div style={{ textAlign: 'center', margin: '8mm 0' }}>
              <div style={{ display: 'inline-block', border: '2px solid rgba(26,54,93,0.15)', padding: '8px 26px', borderRadius: '999px', backgroundColor: '#ffffff', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
                <span style={{ fontFamily: 'Cairo, sans-serif', fontWeight: 900, fontSize: '17px', color: '#1a365d' }}>الموضوع: {data.subject}</span>
              </div>
            </div>
          )}
          <div className="quill-content"
            style={{ textAlign: 'justify', lineHeight: 2.3, color: '#1e293b', fontSize: '15px', wordWrap: 'break-word', whiteSpace: 'pre-wrap' }}
            dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(data.body) }}
          />
          <div style={{ marginTop: '16mm', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', padding: '0 14px', minHeight: '120px' }}>
            <div style={{ width: '140px', display: 'flex', justifyContent: 'center', position: 'relative' }}>
              {data.showStamp && dbUser?.role === 'admin' && (
                <img src="/images/stamp.png" alt="ختم" style={{ width: '100%', objectFit: 'contain', opacity: 0.95, mixBlendMode: 'multiply' }} />
              )}
            </div>
            <div style={{ textAlign: 'center', fontFamily: 'Cairo, sans-serif' }}>
              <p style={{ fontWeight: 700, color: '#c5a059', marginBottom: '8px', fontSize: '14px', letterSpacing: '0.05em', margin: '0 0 8px' }}>{data.signTitle}</p>
              <p style={{ fontWeight: 900, fontSize: '18px', color: '#1a365d', borderTop: '2px solid #e2e8f0', paddingTop: '8px', minWidth: '200px', margin: 0 }}>{data.signName}</p>
            </div>
          </div>
        </div>
      </PrintableLetterhead>
    );
    printInNewWindow(jsx, `خطاب_${data.recipient || 'سماك'}`);
  };

  useEffect(() => {
    const fetchUserFromDB = async () => {
      const currentId = contextUser?.id || JSON.parse(localStorage.getItem("semak_current_user"))?.id;
      
      if (!currentId) {
        navigate("/login");
        return;
      }

      try {
        const res = await fetch(`${API_URL}?action=get_users`);
        const result = await res.json();
        const usersArray = result.success ? result.data : [];
        const freshUser = usersArray.find(u => u.id.toString() === currentId.toString());

        if (freshUser) {
          setDbUser(freshUser);
          setData(prev => ({
            ...prev,
            signName: freshUser.name || "",
            signTitle: freshUser.job || (freshUser.role === 'admin' ? "المدير العام" : "موظف"),
            showStamp: false
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
      // 🔥 استخراج النماذج بشكل صحيح سواء كانت مغلفة أو مصفوفة مباشرة
      setDbTemplates(Array.isArray(result) ? result : (result.success ? result.data : []));
    } catch (error) {
      console.error("تعذر جلب النماذج", error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

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
        headers: { "Content-Type": "application/json", ...(getAdminToken() ? { Authorization: `Bearer ${getAdminToken()}` } : {}) },
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
      <div className="w-full h-64 flex flex-col items-center justify-center bg-white dark:bg-brand-900 rounded-[2rem] shadow-sm font-cairo">
        <Loader2 className="animate-spin text-gold-500 mb-4" size={48} />
        <p className="font-bold text-lg text-brand-800 dark:text-brand-100">جاري تجهيز صانع الخطابات...</p>
      </div>
    );
  }

  return (
    <>
      <style>{`
        .quill-content p { margin-bottom: 0.8rem; }
        .quill-content li { margin-bottom: 0.5rem; }
      `}</style>
      
      {/* ========================================================= */}
      {/* 1. نسخة العرض على الشاشة (الداشبورد) */}
      {/* ========================================================= */}
      <div className="w-full flex flex-col md:flex-row gap-6 font-cairo mb-10 animate-fadeIn min-h-[800px] bg-transparent">
        
        {/* اللوحة الجانبية (أدوات التحكم) */}
        <div className="w-full md:w-[350px] bg-gradient-to-b from-[#112240] to-[#0a192f] text-white flex flex-col rounded-[2rem] shadow-2xl overflow-hidden border border-white/5">
          <div className="p-6 bg-[#0f172a]/50 flex flex-col gap-4 border-b border-white/10 relative">
            <button onClick={() => navigate(-1)} className="self-start flex items-center gap-2 text-slate-400 hover:text-[#c5a059] transition-colors text-sm font-bold group">
              <ArrowRight size={18} className="transform group-hover:-translate-x-1 transition-transform" />
              العودة للوحة التحكم
            </button>
            <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-l from-[#c5a059] to-yellow-200 flex items-center gap-2">
              <FilePenLine className="text-[#c5a059]" /> صانع الخطابات
            </h2>
          </div>
          
          <div className="p-6 space-y-5 flex-grow overflow-y-auto custom-scrollbar">
            <div>
              <label className="text-xs font-bold text-[#c5a059] block mb-2 uppercase tracking-wider">اختر نموذجاً للبدء</label>
              <select onChange={handleTemplateChange} className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm outline-none text-white focus:border-[#c5a059] focus:ring-1 focus:ring-[#c5a059]/50 transition cursor-pointer hover:bg-white/10">
                <option value="custom" className="text-black">✨ -- خطاب جديد (فارغ) --</option>
                {loadingTemplates ? (
                  <option disabled>جاري تحميل النماذج...</option>
                ) : (
                  Object.keys(groupedTemplates).map(category => (
                    <optgroup key={category} label={category} className="text-[#c5a059] font-bold bg-[#112240]">
                      {groupedTemplates[category].map(temp => (
                        <option key={temp.id} value={temp.id} className="text-white font-normal bg-[#0a192f]">{temp.title}</option>
                      ))}
                    </optgroup>
                  ))
                )}
              </select>
            </div>
            
            <div className="w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent my-2" />
            
            <div className="space-y-4">
              <div><label className="text-xs text-slate-400 block mb-1">التاريخ</label><input type="date" value={data.date} onChange={e => setData({ ...data, date: e.target.value })} className="w-full bg-white/5 rounded-xl p-3 text-sm outline-none border border-white/10 focus:border-[#c5a059] transition text-white hover:bg-white/10" style={{ colorScheme: "dark" }} /></div>
              <div><label className="text-xs text-slate-400 block mb-1">المستلم</label><input type="text" value={data.recipient} onChange={e => setData({ ...data, recipient: e.target.value })} className="w-full bg-white/5 rounded-xl p-3 text-sm outline-none border border-white/10 focus:border-[#c5a059] transition text-white hover:bg-white/10" /></div>
              <div><label className="text-xs text-slate-400 block mb-1">الموضوع</label><input type="text" value={data.subject} onChange={e => setData({ ...data, subject: e.target.value })} className="w-full bg-white/5 rounded-xl p-3 text-sm outline-none font-bold border border-white/10 focus:border-[#c5a059] transition text-white hover:bg-white/10" /></div>
            </div>
            
            <div className="mb-4">
              <label className="text-xs text-slate-400 block mb-1">نص الخطاب (المحرر الذكي)</label>
              <div className="bg-white rounded-xl text-black overflow-hidden border-2 border-transparent focus-within:border-[#c5a059]/50 transition-all shadow-inner">
                <ReactQuill theme="snow" value={data.body} onChange={(content) => setData({ ...data, body: content })} modules={quillModules} placeholder="ابدأ بكتابة إبداعك هنا..." />
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-xs text-slate-400 block mb-1">اسم الموقع</label><input type="text" value={data.signName} onChange={e => setData({ ...data, signName: e.target.value })} className="w-full bg-white/5 rounded-xl p-3 text-sm outline-none border border-white/10 focus:border-[#c5a059] transition text-white hover:bg-white/10" /></div>
              <div><label className="text-xs text-slate-400 block mb-1">المنصب</label><input type="text" value={data.signTitle} onChange={e => setData({ ...data, signTitle: e.target.value })} className="w-full bg-white/5 rounded-xl p-3 text-sm outline-none border border-white/10 focus:border-[#c5a059] transition text-white hover:bg-white/10" /></div>
            </div>
            
            {dbUser?.role === "admin" && (
              <div className="flex justify-between items-center p-4 bg-white/5 rounded-xl border border-white/10 mt-2 hover:bg-white/10 transition-colors cursor-pointer" onClick={() => setData({ ...data, showStamp: !data.showStamp })}>
                <span className="text-sm font-bold text-slate-300">تفعيل الختم الرسمي</span>
                <div className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 ${data.showStamp ? 'bg-[#c5a059]' : 'bg-slate-600'}`}>
                  <div className={`w-4 h-4 rounded-full bg-white transition-transform transform ${data.showStamp ? 'translate-x-0' : '-translate-x-6'}`} />
                </div>
              </div>
            )}

            <div className="bg-white/5 p-4 rounded-xl mt-4 border border-white/10 border-dashed">
              {!showSaveForm ? (
                <button onClick={() => setShowSaveForm(true)} className="w-full text-sm font-bold text-teal-400 hover:text-teal-300 transition flex items-center justify-center gap-2 py-2">
                  <FilePenLine size={16} /> حفظ الخطاب كنموذج جديد
                </button>
              ) : (
                <div className="space-y-3 animate-fadeIn">
                  <div className="text-xs text-slate-400 mb-2 text-center bg-[#0f172a] p-2 rounded-lg">سيتم حفظ هذا النص كقالب لاستخدامه لاحقاً.</div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">تصنيف النموذج</label>
                    <select value={newTempMeta.category} onChange={e => setNewTempMeta({...newTempMeta, category: e.target.value})} className="w-full bg-white/10 rounded-lg p-2 text-sm outline-none border border-white/20 focus:border-teal-500 text-white">
                      <option className="text-black" value="إدارية عامة">إدارية عامة</option>
                      <option className="text-black" value="النماذج المالية">النماذج المالية</option>
                      <option className="text-black" value="نماذج العملاء والمبيعات">نماذج العملاء والمبيعات</option>
                      <option className="text-black" value="إدارة الأملاك والصيانة">إدارة الأملاك والصيانة</option>
                      <option className="text-black" value="الشؤون القانونية وإدارة الأملاك">الشؤون القانونية وإدارة الأملاك</option>
                      <option className="text-black" value="الموارد البشرية والموظفين">الموارد البشرية والموظفين</option>
                      <option className="text-black" value="خدمة العملاء">خدمة العملاء</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-300 block mb-1">الاسم المقترح للنموذج</label>
                    <input type="text" value={newTempMeta.title} onChange={e => setNewTempMeta({...newTempMeta, title: e.target.value})} className="w-full bg-white/10 rounded-lg p-2 text-sm outline-none border border-white/20 focus:border-teal-500 text-white font-bold" />
                  </div>
                  <div className="flex gap-2 pt-2">
                    <button onClick={saveTemplateToDB} disabled={isSaving} className="flex-1 bg-gradient-to-r from-teal-600 to-emerald-500 text-white py-2 rounded-lg font-bold text-sm hover:opacity-90 transition flex items-center justify-center shadow-lg">
                      {isSaving ? <RefreshCw className="animate-spin" size={16} /> : "تأكيد"}
                    </button>
                    <button onClick={() => setShowSaveForm(false)} className="px-4 bg-slate-700 text-white py-2 rounded-lg font-bold text-sm hover:bg-slate-600 transition">إلغاء</button>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          <div className="p-4 bg-[#0f172a] border-t border-white/10">
            {/* 🔥 الزر السحري للطباعة بعد ربطه */}
            <button onClick={handlePrint} className="w-full bg-gradient-to-r from-[#c5a059] to-yellow-600 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition shadow-[0_0_20px_rgba(197,160,89,0.3)] transform hover:-translate-y-1">
              <Printer size={20} /> طباعة أو تصدير PDF
            </button>
          </div>
        </div>

        {/* 📄 مساحة عرض الورقة الفخمة على الشاشة */}
        <div className="flex-1 bg-gradient-to-br from-slate-200 to-slate-300 dark:from-brand-900 dark:to-brand-950 rounded-[2rem] overflow-y-auto p-4 md:p-10 flex justify-center items-start shadow-inner border border-slate-300 dark:border-brand-700 relative">
          <div className="a4-page bg-white text-black shadow-[0_20px_50px_rgba(0,0,0,0.15)] relative overflow-hidden flex flex-col transition-all duration-500 ring-1 ring-slate-900/5" style={{ width: '210mm', minHeight: '297mm', padding: '0', margin: '0' }}>
            
            {/* 🌟 Header الفخم */}
            <div className="h-3 w-full flex">
              <div className="h-full bg-[#1a365d] w-3/4"></div>
              <div className="h-full bg-[#c5a059] w-1/4"></div>
            </div>
            <div className="px-12 pt-10 pb-6 flex justify-between items-center relative border-b border-slate-100">
              <img src={"/images/logo-main.png"} alt="شعار" className="h-28 object-contain drop-shadow-sm z-10" />
              <div className="text-left border-l-4 border-[#c5a059] pl-6 z-10">
                <h1 className="text-3xl font-black text-[#1a365d] tracking-tight">{companyName}</h1>
                <p className="text-[#c5a059] font-bold text-sm mt-2 tracking-wider">سقف يعلو برؤيتك ومسكن يحكي قصتك</p>
                <p className="text-slate-400 text-xs mt-1 font-sans tracking-widest">CR: 7051031099</p>
              </div>
              <div className="absolute top-0 left-0 w-64 h-64 bg-gradient-to-br from-[#1a365d]/5 to-transparent rounded-br-full -z-0"></div>
            </div>
            
            <div className="font-amiri text-lg relative z-10 flex-grow pt-8 px-12 pb-12 w-full break-words overflow-hidden">
              <img src={"/images/semak-watermark.png"} className="absolute top-[28%] left-1/2 transform -translate-x-1/2 opacity-[0.045] w-[62%] pointer-events-none" alt="" />
              
              <div className="flex justify-between items-center mb-10 pb-4 border-b border-dashed border-slate-200">
                <div className="flex items-center gap-2 text-sm font-cairo">
                  <span className="w-2 h-2 rounded-full bg-[#1a365d]"></span>
                  <strong className="text-[#1a365d]">التاريخ:</strong>
                  <span className="text-slate-700">{data.date}</span>
                </div>
              </div>
              
              <div className="mb-10 border-r-4 border-[#c5a059] pr-5 py-2 bg-gradient-to-l from-slate-50 to-transparent rounded-l-2xl">
                <h3 className="font-bold text-2xl text-[#1a365d] font-cairo leading-relaxed">
                  السادة / {data.recipient} <br/>
                  <span className="text-[#c5a059] text-xl mt-1 inline-block">المحترمين،،</span>
                </h3>
              </div>
              
              {data.subject && (
                <div className="flex justify-center mb-12">
                  <div className="bg-white border-2 border-[#1a365d]/10 px-12 py-3 rounded-full shadow-sm relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#1a365d]/5 via-transparent to-[#c5a059]/5 opacity-50"></div>
                    <span className="font-black text-xl text-[#1a365d] font-cairo relative z-10">الموضوع: {data.subject}</span>
                  </div>
                </div>
              )}
              
              <div className="text-justify leading-[2.4] flex-grow quill-content whitespace-pre-wrap break-words text-slate-800 text-[1.15rem]" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(data.body) }}></div>
              
              <div className="mt-24 mb-4 flex justify-between items-end px-8 relative min-h-[160px]">
                <div className="absolute inset-0 bg-gradient-to-t from-slate-50 to-transparent rounded-b-3xl -z-10"></div>
                <div className="relative w-48 flex justify-center">
                  {data.showStamp && dbUser?.role === "admin" && (
                    <img src={"/images/stamp.png"} className="w-full object-contain opacity-95 mix-blend-multiply absolute bottom-0 drop-shadow-md" alt="ختم" />
                  )}
                </div>
                <div className="text-center font-cairo relative z-10 pb-2">
                  <p className="font-bold text-[#c5a059] mb-3 text-lg uppercase tracking-wider">{data.signTitle}</p>
                  <p className="font-black text-2xl text-[#1a365d] border-t-2 border-slate-200 pt-4 min-w-[220px]">{data.signName}</p>
                </div>
              </div>
            </div>
            
            {/* 🌟 Footer الفخم */}
            <div className="mt-auto px-10 pb-8">
              <div className="bg-[#1a365d] rounded-2xl p-5 flex justify-between items-center text-white shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-10 -mt-10 blur-2xl"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#c5a059]/20 rounded-full -ml-8 -mb-8 blur-xl"></div>
                
                <div className="relative z-10">
                  <p className="font-bold text-base tracking-wide text-[#c5a059]">{companyName}</p>
                  <p className="text-white/80 text-xs mt-1">المملكة العربية السعودية - مكة المكرمة - حي البوابة</p>
                </div>
                <div className="flex flex-col items-end gap-1.5 relative z-10 font-sans tracking-wide" dir="ltr">
                  <span className="text-white font-bold text-sm flex items-center gap-2">920032842 <span className="text-[#c5a059]">📞</span></span>
                  <span className="text-white/80 text-xs flex items-center gap-2">semak.sa <span className="text-[#c5a059]">🌐</span></span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </>
  );
}