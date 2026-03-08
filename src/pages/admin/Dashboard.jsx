import React, { useState, useEffect } from 'react';
import QRCode from 'react-qr-code'; 
import { Search, RefreshCw, LogOut, Lock, Shield, FilePenLine, Wrench, ClipboardCheck, Calculator, ExternalLink, QrCode as QrIcon, Users, CalendarDays, MessageCircle, Printer, CheckSquare, Phone, Mail, Globe, Building2, Edit } from 'lucide-react';

const API_URL = "https://semak.sa/api.php";
const getImg = (id, sz = "w1500") => `https://drive.google.com/thumbnail?id=${id}&sz=${sz}`;
const TIME_SLOTS = ["08:00 ص - 10:00 ص", "10:00 ص - 12:00 م", "01:00 م - 03:00 م", "04:00 م - 06:00 م"];

const APP_MODULES = [
  { id: "maintenance", label: "إدارة طلبات الصيانة", icon: Wrench, color: "text-purple-600", bg: "bg-purple-50" },
  { id: "letters", label: "منشئ الخطابات", icon: FilePenLine, color: "text-orange-500", bg: "bg-orange-50" },
  { id: "qr", label: "رموز الوحدات (QR)", icon: QrIcon, color: "text-slate-800", bg: "bg-slate-100" },
  { id: "leads", label: "سجل المهتمين (Leads)", icon: Users, color: "text-teal-600", bg: "bg-teal-50" },
  { id: "accounting", label: "النظام المحاسبي (دفترة)", icon: Calculator, color: "text-emerald-600", bg: "bg-emerald-50" },
  { id: "inspection", label: "فحص واستلام الوحدات", icon: ClipboardCheck, color: "text-indigo-600", bg: "bg-indigo-50" },
  { id: "users_manage", label: "إدارة الموظفين والصلاحيات", icon: Shield, color: "text-[#1a365d]", bg: "bg-blue-50" }
];

export default function Dashboard({ user, setUser, showToast }) {
  const [activeUser, setActiveUser] = useState(user || null);
  
  const [activeTab, setActiveTab] = useState("");
  const [leads, setLeads] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [usersList, setUsersList] = useState([]);
  const [techList, setTechList] = useState([]); 
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // حالات إدارة الموظفين
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedUserForPerms, setSelectedUserForPerms] = useState(null);

  useEffect(() => {
    if (!activeUser) {
      const savedUser = localStorage.getItem("semak_current_user");
      if (savedUser) {
        try { 
            const parsed = JSON.parse(savedUser);
            setActiveUser(parsed); 
            if(setUser) setUser(parsed);
        } catch(e) {}
      } else {
        window.location.href = "/login";
      }
    }
  }, []);

  if (!activeUser) return null;

  const hasPerm = (perm) => activeUser.role === 'admin' || (activeUser.permissions && activeUser.permissions.includes(perm));

  const handleLogout = () => {
    localStorage.removeItem("semak_current_user");
    window.location.href = "/";
  };

  const loadLeads = async () => {
    setActiveTab("leads"); setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=get_leads`);
      setLeads(await res.json());
    } catch { 
        if(showToast) showToast("خطأ", "تعذر جلب البيانات", "error"); else alert("خطأ في جلب البيانات");
    } finally { setLoading(false); }
  };

  const loadUsers = async () => {
    setActiveTab("users"); setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=get_users`);
      const data = await res.json();
      setUsersList(data);
      setTechList(data.filter(u => u.role === "technician").map(t => t.name));
    } catch { 
        if(showToast) showToast("خطأ", "تعذر جلب الموظفين", "error"); else alert("خطأ في جلب الموظفين");
    } finally { setLoading(false); }
  };

  const loadMaintenance = async () => {
    setActiveTab("maintenance"); setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=get_maintenance`);
      let data = await res.json();
      const parsed = data.map(row => {
         let desc = row.descrip || "---";
         let scheduleDate = row.date ? row.date.split(" ")[0] : "";
         let scheduleTime = "غير محدد";
         if (desc.includes("التاريخ المفضل:")) {
           const dateMatch = desc.match(/التاريخ المفضل: (.*)/);
           if (dateMatch) scheduleDate = dateMatch[1];
           const timeMatch = desc.match(/الوقت المفضل: (.*)/);
           if (timeMatch) scheduleTime = timeMatch[1];
           desc = desc.split(`\n\nالوصف:\n`)[1] || desc;
         }
         return { id: row.id, date: row.date, scheduleDate, scheduleTime, name: row.name, phone: row.phone, unit: row.unit, type: row.type, desc: desc, status: row.status || "قيد الانتظار", technician: row.technician || "لم يتم التعيين", otp: row.otp };
      });
      setTickets(parsed);
      fetch(`${API_URL}?action=get_users`).then(r => r.json()).then(d => setTechList(d.filter(u => u.role === "technician").map(t => t.name))).catch(()=>{});
    } catch { 
        if(showToast) showToast("خطأ", "تعذر جلب الصيانة", "error"); else alert("خطأ في جلب تذاكر الصيانة");
    } finally { setLoading(false); }
  };

  const handleAddUser = async (e) => {
    e.preventDefault(); setLoading(true);
    const payload = { 
        name: e.target.name.value, job: e.target.job.value, email: e.target.email.value, 
        phone: e.target.phone.value, department: e.target.department.value, 
        role: e.target.role.value, password: e.target.password.value 
    };
    try {
      const res = await fetch(`${API_URL}?action=add_user`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.success) {
        if(showToast) showToast("تم", data.message); else alert(data.message);
        e.target.reset(); setShowAddUser(false); loadUsers();
      } else {
        if(showToast) showToast("خطأ", data.message, "error"); else alert(data.message);
      }
    } catch { if(showToast) showToast("خطأ", "فشل الاتصال", "error"); else alert("فشل الاتصال"); }
    finally { setLoading(false); }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault(); setLoading(true);
    const payload = { 
        id: editingUser.id, name: e.target.name.value, job: e.target.job.value, 
        email: e.target.email.value, phone: e.target.phone.value, 
        department: e.target.department.value, role: e.target.role.value
    };
    if (e.target.password.value) payload.password = e.target.password.value;

    try {
      const res = await fetch(`${API_URL}?action=update_user`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.success) {
        if(showToast) showToast("تم التحديث", "تم تحديث بيانات الموظف بنجاح"); else alert("تم تحديث البيانات");
        setEditingUser(null); loadUsers();
      } else {
        if(showToast) showToast("خطأ", data.message, "error"); else alert(data.message);
      }
    } catch { if(showToast) showToast("خطأ", "فشل الاتصال", "error"); else alert("فشل الاتصال"); }
    finally { setLoading(false); }
  };

  const handleSavePermissions = async (userId, newPerms) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=update_permissions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: userId, permissions: newPerms }) });
      const data = await res.json();
      if (data.success) {
        if(showToast) showToast("تم", data.message); else alert(data.message);
        loadUsers(); setSelectedUserForPerms(null); 
      }
    } catch { if(showToast) showToast("خطأ", "فشل الاتصال", "error"); else alert("فشل الاتصال"); }
    finally { setLoading(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=change_password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: activeUser.id, old_password: e.target.old_password.value, new_password: e.target.new_password.value }) });
      const data = await res.json();
      if (data.success) { if(showToast) showToast("نجاح", data.message); e.target.reset(); } 
      else { if(showToast) showToast("خطأ", data.message, "error"); }
    } catch { if(showToast) showToast("خطأ", "فشل الاتصال", "error"); }
    finally { setLoading(false); }
  };

  const updateTicketStatus = async (id, field, value) => {
    let newOtp = null; let apiField = field; let apiValue = value;
    setTickets(prev => prev.map(t => {
      if (t.id === id) {
        let updatedTicket = { ...t, [field]: value };
        if (field === "status" && value === "تم اعتماد الموعد" && !t.otp) { newOtp = Math.floor(1000 + Math.random() * 9000).toString(); updatedTicket.otp = newOtp; }
        return updatedTicket;
      }
      return t;
    }));
    const currentTicket = tickets.find(t => t.id === id);
    if (field === "scheduleDate" || field === "scheduleTime") {
      apiField = "descrip";
      const updatedDate = field === "scheduleDate" ? value : currentTicket.scheduleDate;
      const updatedTime = field === "scheduleTime" ? value : currentTicket.scheduleTime;
      apiValue = `الوقت المفضل: ${updatedTime}\nالتاريخ المفضل: ${updatedDate}\n\nالوصف:\n${currentTicket.desc}`;
    }
    try {
      const payload = { ticket_id: id, field_name: apiField, new_value: apiValue };
      if (newOtp) payload.otp = newOtp;
      await fetch(`${API_URL}?action=update_maintenance`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } catch {}
  };

  const notifyWhatsApp = (ticket) => {
    let phone = ticket.phone.toString().replace(/^0/, "966").replace(/\D/g, "");
    let techText = ticket.technician && ticket.technician !== "لم يتم التعيين" ? `👨‍🔧 الفني المختص: *${ticket.technician}*` : "سيتم إعلامكم باسم الفني لاحقاً.";
    let dateText = ticket.scheduleDate ? `📅 التاريخ: *${ticket.scheduleDate}*\n⏰ الوقت: *${ticket.scheduleTime}*` : "لم يتم تحديد موعد الزيارة بعد.";
    let otpText = ticket.otp ? `\n\n🔑 *رمز إغلاق الطلب (OTP):* ${ticket.otp}\n_(يرجى تزويد الفني بهذا الرمز عند **الانتهاء من العمل** لتأكيد إغلاق الطلب بنجاح)_` : "";
    let msg = `مرحباً بك عميلنا العزيز من شركة *سماك العقارية* 🏢\n\nبخصوص طلب الصيانة رقم: *${ticket.id}*\nالخاص بوحدة: *${ticket.unit}*\nنوع الطلب: *${ticket.type}*\n\nحالة الطلب الآن: *${ticket.status}*.\n\n${techText}\n\n*موعد الزيارة:*\n${dateText}${otpText}\n\nنسعد بخدمتكم!`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const columns = [
    { id: "pending", title: "طلبات ومواعيد جديدة", color: "border-slate-300", bg: "bg-slate-100", text: "text-slate-700", statuses: ["قيد الانتظار", undefined] },
    { id: "active", title: "معتمدة / جاري العمل", color: "border-blue-300", bg: "bg-blue-50", text: "text-blue-700", statuses: ["تم التعيين", "تم اعتماد الموعد", "تم اقتراح موعد بديل", "جاري العمل"] },
    { id: "completed", title: "مكتملة", color: "border-green-300", bg: "bg-green-50", text: "text-green-700", statuses: ["مكتمل"] }
  ];

  const renderTicketCard = (ticket) => (
    <div key={ticket.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-4 flex flex-col">
      <div className="flex justify-between items-start mb-3"><span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-[10px] font-black">#{ticket.id}</span><span className="bg-[#c5a059]/10 text-[#c5a059] px-2 py-1 rounded-full text-[10px] font-bold">{ticket.type} | {ticket.unit}</span></div>
      <p className="text-xs text-slate-500 mb-3 line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-100">{ticket.desc}</p>
      <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 space-y-3 mt-auto">
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[10px] text-slate-500 font-bold block mb-1">التاريخ</label><input type="date" value={ticket.scheduleDate || ""} onChange={(e) => updateTicketStatus(ticket.id, "scheduleDate", e.target.value)} className="w-full text-xs font-bold p-2 rounded-lg border border-slate-200 outline-none" /></div>
          <div><label className="text-[10px] text-slate-500 font-bold block mb-1">الوقت</label><select value={ticket.scheduleTime || "غير محدد"} onChange={(e) => updateTicketStatus(ticket.id, "scheduleTime", e.target.value)} className="w-full text-xs font-bold p-2 rounded-lg border border-slate-200 outline-none"><option value="غير محدد" disabled>اختر</option>{TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
        </div>
        <select value={ticket.technician || "لم يتم التعيين"} onChange={(e) => updateTicketStatus(ticket.id, "technician", e.target.value)} className="w-full text-xs font-bold p-2 rounded-lg border border-slate-200 outline-none mt-2"><option value="لم يتم التعيين" disabled>-- إسناد لفني --</option>{techList.map(tech => <option key={tech} value={tech}>{tech}</option>)}</select>
        <div className="flex gap-2 mt-2">
            <select value={ticket.status} onChange={(e) => updateTicketStatus(ticket.id, "status", e.target.value)} className="flex-grow text-xs font-bold p-2 rounded-lg border outline-none"><option value="قيد الانتظار">قيد الانتظار</option><option value="تم التعيين">تم التعيين</option><option value="تم اعتماد الموعد">تم اعتماد الموعد</option><option value="جاري العمل">جاري العمل</option><option value="مكتمل">مكتمل</option></select>
            <button onClick={() => notifyWhatsApp(ticket)} className="bg-green-500 text-white p-2 rounded-lg hover:bg-green-600 transition shadow-md flex items-center justify-center w-10"><MessageCircle size={16} /></button>
        </div>
        {activeUser?.role === "admin" && ticket.otp && (ticket.status === "تم اعتماد الموعد" || ticket.status === "جاري العمل") && ( <div className="text-[9px] text-slate-400 text-center mt-1">(رمز الإغلاق: {ticket.otp})</div> )}
      </div>
    </div>
  );

 // 📇 بناء بيانات بطاقة العمل بشكل احترافي للـ QR Code (مع دعم اللغة العربية UTF-8)
  const buildVCard = () => {
    const org = activeUser.department ? `شركة سماك العقارية - ${activeUser.department}` : `شركة سماك العقارية`;
    const phone = activeUser.phone || '';
    const unifiedPhone = '+966920032842';
    
    return `BEGIN:VCARD
VERSION:3.0
N;CHARSET=UTF-8:${activeUser.name};;;;
FN;CHARSET=UTF-8:${activeUser.name}
ORG;CHARSET=UTF-8:${org}
TITLE;CHARSET=UTF-8:${activeUser.job || 'موظف'}
${phone ? `TEL;TYPE=CELL:${phone}\n` : ''}TEL;TYPE=WORK:${unifiedPhone}
EMAIL;TYPE=WORK:${activeUser.email}
URL:https://semak.sa
END:VCARD`;
  };

  return (
    <div className="pt-16 pb-20 bg-slate-50 min-h-screen animate-fadeIn">
      <div className="container mx-auto px-6 max-w-6xl">
        
        {/* --- 💳 البطاقة الرقمية الفخمة كبطاقة أعمال حقيقية --- */}
        <div className="mb-14 flex flex-col items-center">
            <div className="relative w-full max-w-3xl bg-gradient-to-br from-[#1a365d] via-[#112240] to-[#0f172a] rounded-[2.5rem] shadow-2xl overflow-hidden border border-[#c5a059]/40 group transform transition-all hover:scale-[1.02] duration-500">
                
                {/* تأثيرات خلفية زجاجية وتوهج ذهبي */}
                <div className="absolute top-0 right-0 w-72 h-72 bg-[#c5a059]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-56 h-56 bg-[#c5a059]/10 rounded-full blur-3xl translate-y-1/4 -translate-x-1/4 pointer-events-none"></div>

                <div className="relative p-8 md:p-12 flex flex-col h-full justify-between">
                    
                    <div className="flex flex-col md:flex-row items-center md:items-start justify-between gap-10">
                        {/* معلومات الموظف (الجهة اليمنى) */}
                        <div className="flex-1 text-center md:text-right z-10 w-full">
                            {/* 🌟 الشعار والسلوقان */}
                            <div className="mb-8 flex flex-col items-center md:items-start">
                                <img src={getImg("1HEFY56KLYGJNmc-tufIXmYDUbGyOIdDX")} alt="سماك العقارية" className="h-16 md:h-20 w-auto object-contain drop-shadow-lg mb-3" />
                                <p className="text-[#c5a059]/80 text-xs tracking-widest font-medium">سقف يعلو برؤيتك، ومسكن يحكي قصتك</p>
                            </div>
                            
                            <h2 className="text-3xl md:text-4xl font-black text-white mb-2 tracking-wide drop-shadow-md">{activeUser.name}</h2>
                            <div className="flex flex-col md:flex-row items-center md:items-start gap-2 md:gap-3 mb-8">
                                <p className="text-[#c5a059] font-bold text-lg uppercase tracking-wider">{activeUser.job || 'موظف'}</p>
                                {activeUser.department && (
                                    <>
                                      <span className="hidden md:block text-slate-500">•</span>
                                      <span className="bg-white/10 text-slate-300 px-3 py-1 rounded-full text-xs font-bold border border-white/5">{activeUser.department}</span>
                                    </>
                                )}
                            </div>
                            
                            {/* بيانات التواصل الشخصية */}
                            <div className="space-y-4 text-slate-200 text-sm font-medium">
                                {activeUser.phone && (
                                    <p className="flex items-center justify-center md:justify-start gap-3 group/item">
                                        <span className="w-8 h-8 rounded-full bg-[#c5a059]/10 border border-[#c5a059]/30 flex items-center justify-center text-[#c5a059] group-hover/item:bg-[#c5a059] group-hover/item:text-[#1a365d] transition-colors"><Phone size={14}/></span> 
                                        <span dir="ltr" className="tracking-wider">{activeUser.phone}</span>
                                    </p>
                                )}
                                <p className="flex items-center justify-center md:justify-start gap-3 group/item">
                                    <span className="w-8 h-8 rounded-full bg-[#c5a059]/10 border border-[#c5a059]/30 flex items-center justify-center text-[#c5a059] group-hover/item:bg-[#c5a059] group-hover/item:text-[#1a365d] transition-colors"><Mail size={14}/></span> 
                                    {activeUser.email}
                                </p>
                            </div>
                        </div>

                        {/* قسم الـ QR Code الذهبي (الجهة اليسرى) */}
                        <div className="flex flex-col items-center bg-[#0a1224]/60 p-6 rounded-[2rem] backdrop-blur-xl border border-[#c5a059]/20 shadow-2xl relative z-10">
                            <div className="bg-white p-3 rounded-2xl shadow-xl relative">
                                {/* إطار ذهبي داخلي للـ QR */}
                                <div className="absolute inset-0 border-2 border-[#c5a059] rounded-2xl opacity-50 m-1 pointer-events-none"></div>
                                <QRCode 
                                    value={buildVCard()}
                                    size={140} 
                                    bgColor="#FFFFFF"
                                    fgColor="#1a365d" 
                                    level="H" 
                                    includeMargin={false}
                                />
                            </div>
                            <p className="text-[11px] text-[#c5a059] font-bold mt-5 tracking-widest uppercase flex items-center gap-2 drop-shadow-md">
                                امسح لحفظ جهة الاتصال
                            </p>
                        </div>
                    </div>

                    {/* الفوتر: بيانات الشركة الأساسية */}
                    <div className="mt-10 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs font-bold text-slate-400 z-10">
                        <p className="flex items-center gap-2 hover:text-[#c5a059] transition cursor-pointer" onClick={() => window.open('https://semak.sa', '_blank')}>
                            <Globe size={14} className="text-[#c5a059]" /> www.semak.sa
                        </p>
                        <p className="flex items-center gap-2 tracking-widest hover:text-[#c5a059] transition cursor-pointer" dir="ltr" onClick={() => window.open('tel:+966920032842')}>
                            <Phone size={14} className="text-[#c5a059]" /> +966 9200 32842
                        </p>
                    </div>

                </div>
            </div>

            {/* أزرار التحكم أسفل البطاقة */}
            <div className="flex flex-wrap justify-center gap-4 mt-8">
                <button onClick={() => setActiveTab("settings")} className="bg-white text-[#1a365d] px-6 py-3 rounded-xl font-bold hover:bg-slate-100 transition flex items-center gap-2 shadow-md border border-slate-200">
                    <Lock size={16} /> إعدادات الحساب
                </button>
                <button onClick={handleLogout} className="bg-red-50 text-red-600 px-6 py-3 rounded-xl font-bold hover:bg-red-600 hover:text-white transition flex items-center gap-2 shadow-md border border-red-100">
                    <LogOut size={16} /> تسجيل خروج بأمان
                </button>
            </div>
        </div>

        {/* الكروت الرئيسية */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {hasPerm("users_manage") && ( <div onClick={loadUsers} className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 hover:-translate-y-1 hover:shadow-lg transition cursor-pointer group"><div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-xl text-[#1a365d] mb-4 group-hover:bg-[#1a365d] group-hover:text-white transition"><Shield size={24} /></div><h3 className="text-lg font-bold text-[#1a365d] mb-1">الموظفين والصلاحيات</h3><p className="text-slate-500 text-sm">إدارة الحسابات والصلاحيات.</p></div> )}
          {hasPerm("leads") && ( <div onClick={loadLeads} className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 hover:-translate-y-1 hover:shadow-lg transition cursor-pointer group"><div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center text-xl text-teal-600 mb-4 group-hover:bg-teal-500 group-hover:text-white transition"><Users size={24} /></div><h3 className="text-lg font-bold text-[#1a365d] mb-1">سجل المهتمين (Leads)</h3><p className="text-slate-500 text-sm">متابعة طلبات الموقع.</p></div> )}
          {hasPerm("maintenance") && ( <div onClick={loadMaintenance} className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 hover:-translate-y-1 hover:shadow-lg transition cursor-pointer group"><div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-xl text-purple-600 mb-4 group-hover:bg-purple-500 group-hover:text-white transition"><Wrench size={24} /></div><h3 className="text-lg font-bold text-[#1a365d] mb-1">طلبات الصيانة</h3><p className="text-slate-500 text-sm">إدارة المهام والتوزيع.</p></div> )}
          {hasPerm("letters") && ( <div onClick={() => window.location.href = "/letter-generator"} className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 hover:-translate-y-1 hover:shadow-lg transition cursor-pointer group"><div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-xl text-[#c5a059] mb-4 group-hover:bg-[#c5a059] group-hover:text-white transition"><FilePenLine size={24} /></div><h3 className="text-lg font-bold text-[#1a365d] mb-1">منشئ الخطابات</h3><p className="text-slate-500 text-sm">إصدار خطابات رسمية.</p></div> )}
          {hasPerm("accounting") && ( <div onClick={() => window.open("https://semak.daftra.com/", "_blank")} className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 hover:-translate-y-1 hover:shadow-lg transition cursor-pointer group"><div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-xl text-emerald-600 mb-4 group-hover:bg-emerald-500 group-hover:text-white transition"><Calculator size={24} /></div><h3 className="text-lg font-bold text-[#1a365d] mb-1">النظام المحاسبي</h3><p className="text-slate-500 text-sm">منصة دفترة.</p></div> )}
          {hasPerm("qr") && ( <div onClick={() => setActiveTab("qr")} className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 hover:-translate-y-1 hover:shadow-lg transition cursor-pointer group"><div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-xl text-slate-800 mb-4 group-hover:bg-slate-800 group-hover:text-white transition"><QrIcon size={24} /></div><h3 className="text-lg font-bold text-[#1a365d] mb-1">رموز الوحدات (QR)</h3><p className="text-slate-500 text-sm">توليد وطباعة QR للعملاء.</p></div> )}
        </div>

        {/* الموظفين والصلاحيات */}
        {activeTab === "users" && hasPerm("users_manage") && (
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden mb-12 p-8">
            <div className="flex justify-between mb-6">
                <h3 className="text-2xl font-black text-[#1a365d] flex items-center gap-3"><Users className="text-blue-600" /> قائمة الموظفين</h3>
                <button onClick={() => { setShowAddUser(!showAddUser); setEditingUser(null); }} className="bg-[#1a365d] text-white px-4 py-2 rounded-xl font-bold">{showAddUser ? "إغلاق" : "إضافة موظف +"}</button>
            </div>
            
            {/* نموذج إضافة موظف جديد */}
            {showAddUser && !editingUser && (
              <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-6 rounded-xl mb-6 border border-slate-100">
                <div><label className="text-xs font-bold text-slate-500 block mb-1">الاسم</label><input required name="name" type="text" className="w-full p-3 rounded-xl border border-slate-200 outline-none" /></div>
                <div><label className="text-xs font-bold text-slate-500 block mb-1">المسمى</label><input required name="job" type="text" className="w-full p-3 rounded-xl border border-slate-200 outline-none" /></div>
                <div><label className="text-xs font-bold text-slate-500 block mb-1">الإيميل</label><input required name="email" type="email" className="w-full p-3 rounded-xl border border-slate-200 outline-none text-left" dir="ltr" /></div>
                <div><label className="text-xs font-bold text-blue-600 block mb-1">رقم الجوال</label><input required name="phone" type="tel" placeholder="05XXXXXXXX" className="w-full p-3 rounded-xl border border-blue-200 outline-none text-left" dir="ltr" /></div>
                <div><label className="text-xs font-bold text-slate-500 block mb-1">القسم (اختياري)</label><input name="department" type="text" placeholder="مثال: المبيعات" className="w-full p-3 rounded-xl border border-slate-200 outline-none" /></div>
                <div><label className="text-xs font-bold text-slate-500 block mb-1">الصلاحية</label><select name="role" className="w-full p-3 rounded-xl border border-slate-200 outline-none"><option value="employee">موظف</option><option value="admin">مدير</option><option value="technician">فني صيانة</option></select></div>
                <div><label className="text-xs font-bold text-slate-500 block mb-1">كلمة المرور الافتراضية</label><input required name="password" type="text" defaultValue="123456" className="w-full p-3 rounded-xl border border-slate-200 outline-none" /></div>
                <div className="flex items-end"><button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold hover:bg-blue-700 transition">حفظ الموظف</button></div>
              </form>
            )}

            {/* ✏️ نموذج تعديل بيانات موظف موجود */}
            {editingUser && (
              <div className="bg-orange-50 border border-orange-200 p-6 rounded-xl mb-6 relative">
                  <h4 className="text-orange-800 font-bold mb-4 flex items-center gap-2"><Edit size={18}/> تعديل بيانات: {editingUser.name}</h4>
                  <button onClick={() => setEditingUser(null)} className="absolute top-4 left-4 text-orange-400 hover:text-orange-700 font-bold text-sm">إلغاء التعديل ✕</button>
                  <form onSubmit={handleUpdateUser} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div><label className="text-xs font-bold text-slate-500 block mb-1">الاسم</label><input required name="name" defaultValue={editingUser.name} type="text" className="w-full p-3 rounded-xl border border-slate-200 outline-none" /></div>
                    <div><label className="text-xs font-bold text-slate-500 block mb-1">المسمى</label><input required name="job" defaultValue={editingUser.job} type="text" className="w-full p-3 rounded-xl border border-slate-200 outline-none" /></div>
                    <div><label className="text-xs font-bold text-slate-500 block mb-1">الإيميل</label><input required name="email" defaultValue={editingUser.email} type="email" className="w-full p-3 rounded-xl border border-slate-200 outline-none text-left" dir="ltr" /></div>
                    <div><label className="text-xs font-bold text-blue-600 block mb-1">رقم الجوال</label><input required name="phone" defaultValue={editingUser.phone} type="tel" className="w-full p-3 rounded-xl border border-blue-200 outline-none text-left" dir="ltr" /></div>
                    <div><label className="text-xs font-bold text-slate-500 block mb-1">القسم</label><input name="department" defaultValue={editingUser.department} type="text" className="w-full p-3 rounded-xl border border-slate-200 outline-none" /></div>
                    <div><label className="text-xs font-bold text-slate-500 block mb-1">الصلاحية</label><select name="role" defaultValue={editingUser.role} className="w-full p-3 rounded-xl border border-slate-200 outline-none"><option value="employee">موظف</option><option value="admin">مدير</option><option value="technician">فني صيانة</option></select></div>
                    <div><label className="text-xs font-bold text-orange-600 block mb-1">باسورد جديد (اتركه فارغاً لعدم التغيير)</label><input name="password" type="text" placeholder="****" className="w-full p-3 rounded-xl border border-orange-200 outline-none placeholder-orange-300" /></div>
                    <div className="flex items-end"><button type="submit" className="w-full bg-orange-500 text-white p-3 rounded-xl font-bold hover:bg-orange-600 transition shadow-md">تحديث البيانات</button></div>
                  </form>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-right"><thead className="bg-slate-50 text-slate-600 text-sm uppercase"><tr><th className="p-4">الاسم والاتصال</th><th className="p-4">المنصب والقسم</th><th className="p-4">الصلاحية</th><th className="p-4">إجراءات</th></tr></thead><tbody className="divide-y divide-slate-100">
                {usersList.map(u => (
                  <React.Fragment key={u.id}>
                    <tr className="hover:bg-slate-50 transition">
                      <td className="p-4">
                        <span className="font-bold text-[#1a365d]">{u.name}</span><br/>
                        <span className="text-[10px] text-slate-400 font-mono" dir="ltr">{u.phone || 'لا يوجد رقم'} | {u.email}</span>
                      </td>
                      <td className="p-4 text-slate-500">{u.job} <br/><span className="text-[10px] text-slate-400">{u.department || '-'}</span></td>
                      <td className="p-4"><span className="bg-slate-100 px-3 py-1 rounded-lg text-xs font-bold">{u.role === 'admin' ? 'مدير نظام' : u.role === 'technician' ? 'فني صيانة' : 'موظف'}</span></td>
                      <td className="p-4 flex gap-2">
                        {u.role !== "admin" && (<button onClick={() => { setSelectedUserForPerms(selectedUserForPerms?.id === u.id ? null : u); setEditingUser(null); }} className="text-indigo-600 bg-indigo-50 px-3 py-2 rounded-lg text-xs font-bold hover:bg-indigo-600 hover:text-white transition flex items-center gap-1"><Shield size={14} /> الصلاحيات</button>)}
                        <button onClick={() => { setEditingUser(u); setShowAddUser(false); setSelectedUserForPerms(null); window.scrollTo({top: 500, behavior: 'smooth'}); }} className="text-orange-600 bg-orange-50 px-3 py-2 rounded-lg text-xs font-bold hover:bg-orange-500 hover:text-white transition flex items-center gap-1"><Edit size={14} /> تعديل</button>
                      </td>
                    </tr>
                    {selectedUserForPerms?.id === u.id && (
                      <tr><td colSpan="4" className="p-0 border-b-4 border-indigo-500"><div className="bg-slate-900 p-8 shadow-inner relative"><h4 className="text-white font-bold mb-6 flex items-center gap-2"><CheckSquare className="text-indigo-400" /> صلاحيات: {u.name}</h4><div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                        {APP_MODULES.map(module => {
                          let userPerms = []; try { userPerms = u.permissions ? JSON.parse(u.permissions) : []; } catch(e){}
                          const isChecked = selectedUserForPerms.tempPerms ? selectedUserForPerms.tempPerms.includes(module.id) : userPerms.includes(module.id);
                          const IconComp = module.icon;
                          return (
                            <label key={module.id} className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer border transition-all ${isChecked ? 'bg-white/10 border-indigo-400 shadow-md' : 'bg-white/5 border-transparent'}`}><input type="checkbox" className="w-5 h-5 accent-indigo-500 rounded" checked={isChecked} onChange={(e) => { const cp = selectedUserForPerms.tempPerms || userPerms; const np = e.target.checked ? [...cp, module.id] : cp.filter(p => p !== module.id); setSelectedUserForPerms({...selectedUserForPerms, tempPerms: np}); }} /><div className={`w-8 h-8 rounded-lg flex items-center justify-center ${module.bg} ${module.color}`}><IconComp size={16} /></div><span className="text-sm font-bold text-slate-200">{module.label}</span></label>
                          )})}
                      </div><div className="flex justify-end gap-3 border-t border-slate-700 pt-6"><button onClick={() => setSelectedUserForPerms(null)} className="px-6 py-2 text-slate-300 font-bold">إلغاء</button><button onClick={() => handleSavePermissions(u.id, selectedUserForPerms.tempPerms || [])} className="bg-indigo-500 text-white px-8 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg">{loading ? <RefreshCw className="animate-spin" /> : <Shield size={16} />} حفظ</button></div></div></td></tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody></table>
            </div>
          </div>
        )}

        {/* باقي الإعدادات */}
        {activeTab === "settings" && (
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden mb-12 p-8 max-w-xl mx-auto">
            <h3 className="text-2xl font-black text-[#1a365d] flex items-center gap-2 mb-2"><Lock className="text-[#c5a059]" /> إعدادات الأمان</h3>
            <p className="text-slate-500 mb-6">تغيير كلمة المرور الخاصة بحسابك.</p>
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div><label className="block text-sm font-bold mb-2 text-[#1a365d]">كلمة المرور الحالية</label><input type="password" name="old_password" required className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl outline-none" /></div>
              <div><label className="block text-sm font-bold mb-2 text-[#1a365d]">كلمة المرور الجديدة</label><input type="password" name="new_password" required minLength={6} className="w-full bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl outline-none" /></div>
              <button type="submit" disabled={loading} className="w-full bg-[#1a365d] text-white py-3 rounded-xl font-bold mt-4">{loading ? <RefreshCw className="animate-spin mx-auto" /> : "حفظ كلمة المرور"}</button>
            </form>
          </div>
        )}

        {activeTab === "leads" && hasPerm("leads") && (
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden mb-12 p-8">
            <h3 className="text-2xl font-black text-[#1a365d] flex items-center gap-3 mb-6"><Users className="text-teal-600" /> سجل المهتمين</h3>
            <div className="overflow-x-auto"><table className="w-full text-right"><thead className="bg-slate-50 text-slate-600 text-sm uppercase"><tr><th className="p-4">الاسم</th><th className="p-4">رقم الجوال</th><th className="p-4">الوحدة</th><th className="p-4">التاريخ</th></tr></thead><tbody className="divide-y divide-slate-100">
                {leads.map((l, i) => (<tr key={i} className="hover:bg-slate-50 transition"><td className="p-4 font-bold text-[#1a365d]">{l.name}</td><td className="p-4 font-sans text-slate-600" dir="ltr">{l.phone}</td><td className="p-4"><span className="bg-teal-50 text-teal-700 px-3 py-1 rounded-full text-xs font-bold">{l.unit}</span></td><td className="p-4 text-xs font-sans text-slate-400" dir="ltr">{String(l.date).substring(0,16)}</td></tr>))}
            </tbody></table></div>
          </div>
        )}

        {activeTab === "maintenance" && hasPerm("maintenance") && (
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden mb-12 p-8">
            <h3 className="text-2xl font-black text-[#1a365d] flex items-center gap-3 mb-6"><Wrench className="text-purple-600" /> إدارة الصيانة</h3>
            <div className="flex overflow-x-auto pb-4 gap-6 items-start">
              {columns.map(col => { const colTickets = tickets.filter(t => col.statuses.includes(t.status)); return (<div key={col.id} className={`w-80 flex-shrink-0 rounded-2xl border-t-4 ${col.color} ${col.bg} p-4`}><h4 className={`font-black ${col.text} text-lg mb-4`}>{col.title} ({colTickets.length})</h4>{colTickets.map(renderTicketCard)}</div>); })}
            </div>
          </div>
        )}

        {activeTab === "qr" && hasPerm("qr") && (
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden mb-12 p-8">
            <div className="flex justify-between mb-6"><h3 className="text-2xl font-black text-[#1a365d] flex items-center gap-3"><QrIcon className="text-slate-800" /> رموز (QR)</h3><button onClick={() => window.print()} className="bg-slate-800 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2"><Printer size={16} /> طباعة</button></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                {["SM-A01", "SM-A02", "SM-A03", "SM-A04"].map(unit => { 
                    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(`https://semak.sa/customer-login?unit=${unit}&auth=smak2026`)}&margin=10`; 
                    return (<div key={unit} className="bg-white p-6 rounded-3xl border border-slate-200 text-center shadow-sm"><h4 className="font-black text-[#1a365d] text-xl mb-4">{unit}</h4><img src={qrUrl} alt="QR Code" className="mx-auto rounded-xl border border-slate-100 mb-4" /><a href={qrUrl} target="_blank" className="text-xs font-bold text-slate-500 hover:text-[#1a365d]">عرض الصورة</a></div>); 
                })}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}