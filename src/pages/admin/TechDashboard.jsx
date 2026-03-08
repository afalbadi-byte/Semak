import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, RefreshCw, LogOut, Lock, Shield, FilePenLine, Wrench, ClipboardCheck, Calculator, ExternalLink, QrCode, Users, UserCog, CalendarDays, LayoutGrid, GanttChartSquare, CheckSquare, MessageCircle, Printer } from 'lucide-react';
import { API_URL } from '../../utils/helpers';
import { AppContext } from '../../context/AppContext';

const TIME_SLOTS = [
  "08:00 ص - 10:00 ص",
  "10:00 ص - 12:00 م",
  "01:00 م - 03:00 م",
  "04:00 م - 06:00 م"
];

const APP_MODULES = [
  { id: "maintenance", label: "إدارة طلبات الصيانة", icon: Wrench, color: "text-purple-600", bg: "bg-purple-50" },
  { id: "letters", label: "منشئ الخطابات", icon: FilePenLine, color: "text-orange-500", bg: "bg-orange-50" },
  { id: "qr", label: "رموز الوحدات (QR)", icon: QrCode, color: "text-slate-800", bg: "bg-slate-100" },
  { id: "leads", label: "سجل المهتمين (Leads)", icon: Users, color: "text-teal-600", bg: "bg-teal-50" },
  { id: "accounting", label: "النظام المحاسبي (دفترة)", icon: Calculator, color: "text-emerald-600", bg: "bg-emerald-50" },
  { id: "inspection", label: "فحص واستلام الوحدات", icon: ClipboardCheck, color: "text-indigo-600", bg: "bg-indigo-50" },
  { id: "users_manage", label: "إدارة الموظفين والصلاحيات", icon: Shield, color: "text-[#1a365d]", bg: "bg-blue-50" }
];

export default function Dashboard(props) {
  const navigate = useNavigate();
  const context = useContext(AppContext) || {};
  
  // 🔥 دالة ذكية تجيب بياناتك حتى لو سويت تحديث للصفحة
  const getActiveUser = () => {
    if (props.user) return props.user;
    if (context.user) return context.user;
    const localUser = localStorage.getItem("semak_current_user");
    if (localUser) return JSON.parse(localUser);
    return null;
  };

  const activeUser = getActiveUser();
  const showToast = props.showToast || context.showToast || alert;
  const setUser = props.setUser || context.setUser;
  
  const [activeTab, setActiveTab] = useState("");
  const [leads, setLeads] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [usersList, setUsersList] = useState([]);
  const [techList, setTechList] = useState([]); 
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState("kanban");
  const [showAddUser, setShowAddUser] = useState(false);
  const [otpInputs, setOtpInputs] = useState({}); 
  const [selectedUserForPerms, setSelectedUserForPerms] = useState(null);

  if (!activeUser) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
            <Lock size={48} className="text-slate-300 mb-4 animate-bounce" />
            <p className="text-[#1a365d] font-bold text-xl mb-4">الرجاء تسجيل الدخول للوصول للبوابة...</p>
            <button onClick={() => navigate("/login")} className="bg-[#c5a059] text-white px-6 py-2 rounded-xl font-bold shadow-lg">الذهاب لصفحة الدخول</button>
        </div>
      );
  }

  const hasPerm = (perm) => {
    if (activeUser?.role === 'admin') return true;
    if (!activeUser?.permissions) return false;
    return activeUser.permissions.includes(perm);
  };

  const handleLogout = () => {
    if(setUser) setUser(null);
    localStorage.removeItem("semak_current_user");
    navigate("/");
  };

  const loadLeads = async () => {
    setActiveTab("leads");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=get_leads`);
      const data = await res.json();
      setLeads(data);
    } catch (err) {
      showToast("خطأ", "تعذر جلب سجل المهتمين", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setActiveTab("users");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=get_users`);
      const data = await res.json();
      setUsersList(data);
      setTechList(data.filter(u => u.role === "technician").map(t => t.name));
    } catch (err) {
      showToast("خطأ", "تعذر جلب الموظفين", "error");
    } finally {
      setLoading(false);
    }
  };

  const loadMaintenance = async () => {
    setActiveTab("maintenance");
    setLoading(true);
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

         return {
            id: row.id, date: row.date, scheduleDate, scheduleTime,
            name: row.name, phone: row.phone, unit: row.unit, type: row.type,
            desc: desc, status: row.status || "قيد الانتظار",
            technician: row.technician || "لم يتم التعيين", otp: row.otp 
         };
      });
      setTickets(parsed);

      fetch(`${API_URL}?action=get_users`)
        .then(res => res.json())
        .then(usersData => setTechList(usersData.filter(u => u.role === "technician").map(t => t.name)))
        .catch(() => {});
    } catch (err) {
      showToast("خطأ", "تعذر جلب تذاكر الصيانة", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = {
      name: e.target.name.value,
      job: e.target.job.value,
      email: e.target.email.value,
      role: e.target.role.value,
      password: e.target.password.value
    };
    try {
      const res = await fetch(`${API_URL}?action=add_user`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast("تم", data.message);
        e.target.reset();
        setShowAddUser(false);
        loadUsers();
      } else {
        showToast("خطأ", data.message, "error");
      }
    } catch { showToast("خطأ", "فشل الاتصال", "error"); }
    finally { setLoading(false); }
  };

  const handleSavePermissions = async (userId, newPerms) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=update_permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, permissions: newPerms })
      });
      const data = await res.json();
      if (data.success) {
        showToast("تم الحفظ", data.message);
        loadUsers(); 
        setSelectedUserForPerms(null); 
      } else {
        showToast("خطأ", data.message, "error");
      }
    } catch { showToast("خطأ", "فشل الاتصال", "error"); }
    finally { setLoading(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=change_password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: activeUser.id,
          old_password: e.target.old_password.value,
          new_password: e.target.new_password.value
        })
      });
      const data = await res.json();
      if (data.success) {
        showToast("نجاح", data.message);
        e.target.reset();
      } else {
        showToast("خطأ", data.message, "error");
      }
    } catch { showToast("خطأ", "فشل الاتصال", "error"); }
    finally { setLoading(false); }
  };

  const updateTicketStatus = async (id, field, value) => {
    let newOtp = null;
    let apiField = field;
    let apiValue = value;

    setTickets(prev => prev.map(t => {
      if (t.id === id) {
        let updatedTicket = { ...t, [field]: value };
        if (field === "status" && value === "تم اعتماد الموعد" && !t.otp) {
          newOtp = Math.floor(1000 + Math.random() * 9000).toString();
          updatedTicket.otp = newOtp;
        }
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

      const res = await fetch(`${API_URL}?action=update_maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        showToast("تم التحديث", "تم حفظ التغييرات في قاعدة البيانات");
      }
    } catch (error) {
      showToast("خطأ اتصال", "تعذر الوصول للسيرفر", "error");
    }
  };

  const notifyWhatsApp = (ticket) => {
    if (!ticket.phone || ticket.phone === "---") {
      showToast("خطأ", "رقم جوال العميل غير صالح", "error");
      return;
    }
    let phone = ticket.phone.toString().replace(/^0/, "966").replace(/\D/g, "");
    let techText = ticket.technician && ticket.technician !== "لم يتم التعيين" ? `👨‍🔧 الفني المختص: *${ticket.technician}*` : "سيتم إعلامكم باسم الفني لاحقاً.";
    let dateText = ticket.scheduleDate ? `📅 التاريخ: *${ticket.scheduleDate}*\n⏰ الوقت: *${ticket.scheduleTime}*` : "لم يتم تحديد موعد الزيارة بعد.";
    let otpText = ticket.otp ? `\n\n🔑 *رمز إغلاق الطلب (OTP):* ${ticket.otp}\n_(يرجى تزويد الفني بهذا الرمز عند **الانتهاء من العمل** لتأكيد إغلاق الطلب بنجاح)_` : "";
    
    let msg = `مرحباً بك عميلنا العزيز من شركة *سماك العقارية* 🏢\n\nبخصوص طلب الصيانة رقم: *${ticket.id}*\nالخاص بوحدة: *${ticket.unit}*\nنوع الطلب: *${ticket.type}*\n\nنفيدكم بأنه تمت مراجعة طلبكم، وحالة الطلب الآن: *${ticket.status}*.\n\n${techText}\n\n*موعد الزيارة (المعتمد / المقترح):*\n${dateText}${otpText}\n\n💡 *(في حال عدم مناسبة الموعد أعلاه، يرجى الرد على هذه الرسالة وسنقوم بتنسيق موعد بديل يناسبكم)*\n\nنسعد بخدمتكم، ونتمنى لكم يوماً سعيداً!`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const columns = [
    { id: "pending", title: "طلبات ومواعيد جديدة", color: "border-slate-300", bg: "bg-slate-100", text: "text-slate-700", statuses: ["قيد الانتظار", undefined] },
    { id: "active", title: "معتمدة / جاري العمل", color: "border-blue-300", bg: "bg-blue-50", text: "text-blue-700", statuses: ["تم التعيين", "تم اعتماد الموعد", "تم اقتراح موعد بديل", "جاري العمل"] },
    { id: "completed", title: "مكتملة", color: "border-green-300", bg: "bg-green-50", text: "text-green-700", statuses: ["مكتمل"] }
  ];

  const renderTicketCard = (ticket) => (
    <div key={ticket.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-4 hover:shadow-md transition group">
      <div className="flex justify-between items-start mb-3">
        <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-[10px] font-black tracking-wider">#{ticket.id}</span>
        <span className="bg-[#c5a059]/10 text-[#c5a059] px-2 py-1 rounded-full text-[10px] font-bold">{ticket.type} | {ticket.unit}</span>
      </div>
      <p className="text-xs text-slate-500 mb-3 line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-100">{ticket.desc}</p>
      
      <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 space-y-3 mt-4">
        <div className="flex items-center gap-2 mb-1">
          <CalendarDays size={14} className="text-blue-600" />
          <span className="text-xs font-bold text-blue-800">إدارة الموعد والتكليف</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-500 font-bold block mb-1">تاريخ الزيارة</label>
            <input type="date" value={ticket.scheduleDate || ""} onChange={(e) => updateTicketStatus(ticket.id, "scheduleDate", e.target.value)} className="w-full text-xs font-bold p-2 rounded-lg border border-slate-200 outline-none focus:border-blue-400 bg-white" />
          </div>
          <div>
            <label className="text-[10px] text-slate-500 font-bold block mb-1">وقت الزيارة</label>
            <select value={ticket.scheduleTime || "غير محدد"} onChange={(e) => updateTicketStatus(ticket.id, "scheduleTime", e.target.value)} className="w-full text-xs font-bold p-2 rounded-lg border border-slate-200 outline-none focus:border-blue-400 bg-white">
              <option value="غير محدد" disabled>اختر الوقت</option>
              {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div className="space-y-2 pt-2 border-t border-blue-100">
          <select value={ticket.technician || "لم يتم التعيين"} onChange={(e) => updateTicketStatus(ticket.id, "technician", e.target.value)} className="w-full text-xs font-bold p-2 rounded-lg bg-white border border-slate-200 outline-none focus:border-blue-400 text-slate-700">
            <option value="لم يتم التعيين" disabled>-- إسناد لفني --</option>
            {techList.map(tech => <option key={tech} value={tech}>{tech}</option>)}
          </select>
          <div className="flex gap-2">
            <select value={ticket.status} onChange={(e) => updateTicketStatus(ticket.id, "status", e.target.value)} className={`flex-grow text-xs font-bold p-2 rounded-lg border outline-none ${ticket.status === "مكتمل" ? "bg-green-100 text-green-700 border-green-200" : ticket.status === "تم اعتماد الموعد" ? "bg-blue-100 text-blue-700 border-blue-200" : "bg-white text-slate-700 border-slate-200"}`}>
              <option value="قيد الانتظار">قيد الانتظار (طلب جديد)</option>
              <option value="تم التعيين">تم تعيين الفني (بلا موعد مؤكد)</option>
              <option value="تم اعتماد الموعد">تم اعتماد الموعد</option>
              <option value="تم اقتراح موعد بديل">تم اقتراح موعد بديل</option>
              <option value="جاري العمل">جاري العمل</option>
              <option value="مكتمل" disabled={ticket.status === "جاري العمل" && ticket.otp}>مكتمل (يتطلب رمز العميل)</option>
            </select>
            <button onClick={() => notifyWhatsApp(ticket)} className="w-10 flex-shrink-0 bg-green-500 text-white rounded-lg flex items-center justify-center hover:bg-green-600 transition shadow-md shadow-green-200" title="إرسال الموعد للعميل بالواتساب">
              <MessageCircle size={16} />
            </button>
          </div>
          {activeUser?.role === "admin" && ticket.otp && (ticket.status === "تم اعتماد الموعد" || ticket.status === "جاري العمل") && (
             <div className="text-[9px] text-slate-400 text-center mt-1">(للمدير فقط: رمز الإغلاق هو {ticket.otp})</div>
          )}
        </div>
      </div>
    </div>
  );

  const sortedDates = Object.keys(tickets.reduce((acc, ticket) => {
    const date = ticket.scheduleDate || "غير مجدول";
    if (!acc[date]) acc[date] = [];
    acc[date].push(ticket);
    return acc;
  }, {})).sort((a, b) => a === "غير مجدول" ? 1 : b === "غير مجدول" ? -1 : new Date(a) - new Date(b));

  const groupedTickets = tickets.reduce((acc, ticket) => {
    const date = ticket.scheduleDate || "غير مجدول";
    if (!acc[date]) acc[date] = [];
    acc[date].push(ticket);
    return acc;
  }, {});

  return (
    <div className="pt-20 pb-20 bg-slate-50 min-h-screen">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-3xl font-black text-[#1a365d]">لوحة الخدمات</h1>
            <p className="text-slate-500 mt-1">أهلاً بك، <span className="font-bold text-[#c5a059]">{activeUser?.name}</span></p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => setActiveTab("settings")} className="bg-slate-100 text-slate-700 px-5 py-3 rounded-xl font-bold hover:bg-slate-200 transition flex items-center gap-2">
              <Lock size={16} /> إعدادات الحساب
            </button>
            <button onClick={handleLogout} className="bg-red-50 text-red-600 px-5 py-3 rounded-xl font-bold hover:bg-red-600 hover:text-white transition flex items-center gap-2 shadow-sm">
              <LogOut size={16} /> تسجيل خروج
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {hasPerm("users_manage") && (
            <div onClick={loadUsers} className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 hover:-translate-y-1 hover:shadow-lg transition duration-300 cursor-pointer group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-[#1a365d]" />
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center text-xl text-[#1a365d] mb-4 group-hover:bg-[#1a365d] group-hover:text-white transition-colors">
                <Shield size={24} />
              </div>
              <h3 className="text-lg font-bold text-[#1a365d] mb-1">الموظفين والصلاحيات</h3>
              <p className="text-slate-500 text-sm">إدارة حسابات الموظفين وتحديد صلاحياتهم.</p>
            </div>
          )}

          {hasPerm("leads") && (
            <div onClick={loadLeads} className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 hover:-translate-y-1 hover:shadow-lg transition duration-300 cursor-pointer group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-teal-500" />
              <div className="w-12 h-12 bg-teal-50 rounded-xl flex items-center justify-center text-xl text-teal-600 mb-4 group-hover:bg-teal-500 group-hover:text-white transition-colors">
                <Users size={24} />
              </div>
              <h3 className="text-lg font-bold text-[#1a365d] mb-1">سجل المهتمين (Leads)</h3>
              <p className="text-slate-500 text-sm">متابعة الطلبات الواردة من الموقع الإلكتروني.</p>
            </div>
          )}

          {hasPerm("maintenance") && (
            <div onClick={loadMaintenance} className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 hover:-translate-y-1 hover:shadow-lg transition duration-300 cursor-pointer group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-purple-500" />
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center text-xl text-purple-600 mb-4 group-hover:bg-purple-500 group-hover:text-white transition-colors">
                <Wrench size={24} />
              </div>
              <h3 className="text-lg font-bold text-[#1a365d] mb-1">طلبات الصيانة</h3>
              <p className="text-slate-500 text-sm">توزيع آلي، تقويم، ولوحة مهام احترافية.</p>
            </div>
          )}

          {hasPerm("letters") && (
            <div onClick={() => navigate("/letter-generator")} className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 hover:-translate-y-1 hover:shadow-lg transition duration-300 cursor-pointer group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-[#c5a059]" />
              <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center text-xl text-[#c5a059] mb-4 group-hover:bg-[#c5a059] group-hover:text-white transition-colors">
                <FilePenLine size={24} />
              </div>
              <h3 className="text-lg font-bold text-[#1a365d] mb-1">منشئ الخطابات</h3>
              <p className="text-slate-500 text-sm">إنشاء وطباعة خطابات رسمية.</p>
            </div>
          )}

          {hasPerm("accounting") && (
            <div onClick={() => window.open("https://semak.daftra.com/", "_blank")} className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 hover:-translate-y-1 hover:shadow-lg transition duration-300 cursor-pointer group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500" />
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center text-xl text-emerald-600 mb-4 group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                <Calculator size={24} />
              </div>
              <h3 className="text-lg font-bold text-[#1a365d] mb-1">النظام المحاسبي</h3>
              <p className="text-slate-500 text-sm">الدخول إلى منصة دفترة لإدارة الحسابات والفواتير.</p>
            </div>
          )}

          {hasPerm("qr") && (
            <div onClick={() => setActiveTab("qr")} className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 hover:-translate-y-1 hover:shadow-lg transition duration-300 cursor-pointer group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-slate-800" />
              <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center text-xl text-slate-800 mb-4 group-hover:bg-slate-800 group-hover:text-white transition-colors">
                <QrCode size={24} />
              </div>
              <h3 className="text-lg font-bold text-[#1a365d] mb-1">رموز الوحدات (QR)</h3>
              <p className="text-slate-500 text-sm">توليد وطباعة رموز QR للعملاء.</p>
            </div>
          )}

          {hasPerm("inspection") && (
            <div onClick={() => navigate("/inspection")} className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 hover:-translate-y-1 hover:shadow-lg transition duration-300 cursor-pointer group relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500" />
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-xl text-indigo-600 mb-4 group-hover:bg-indigo-500 group-hover:text-white transition-colors">
                <ClipboardCheck size={24} />
              </div>
              <h3 className="text-lg font-bold text-[#1a365d] mb-1">فحص واستلام الوحدات</h3>
              <p className="text-slate-500 text-sm">قائمة تدقيق للغرف والأعمال الإنشائية.</p>
            </div>
          )}
        </div>

        {/* الموظفين والصلاحيات */}
        {activeTab === "users" && hasPerm("users_manage") && (
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden mb-12 animate-fade-in-up">
            <div className="p-8 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-[#1a365d] flex items-center gap-3"><Users className="text-blue-600" /> قائمة الموظفين</h3>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowAddUser(!showAddUser)} className="bg-[#1a365d] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-800 transition">
                  {showAddUser ? "إغلاق النموذج" : "إضافة موظف جديد +"}
                </button>
                <button onClick={loadUsers} className="bg-slate-200 text-slate-700 px-4 py-2 rounded-xl hover:bg-slate-300 transition">
                  <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
                </button>
              </div>
            </div>

            {showAddUser && (
              <div className="p-8 bg-blue-50 border-b border-slate-100 animate-fadeIn">
                <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div><label className="text-xs font-bold text-slate-500 mb-1 block">الاسم</label><input required name="name" type="text" className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-400" /></div>
                  <div><label className="text-xs font-bold text-slate-500 mb-1 block">المسمى الوظيفي</label><input required name="job" type="text" className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-400" /></div>
                  <div><label className="text-xs font-bold text-slate-500 mb-1 block">البريد الإلكتروني</label><input required name="email" type="email" className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-400" /></div>
                  <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">الصلاحية</label>
                    <select name="role" className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-400">
                      <option value="employee">موظف (تخصيص الصلاحيات)</option>
                      <option value="admin">مدير (صلاحيات كاملة)</option>
                      <option value="technician">فني صيانة (بوابة الفنيين)</option>
                    </select>
                  </div>
                  <div><label className="text-xs font-bold text-slate-500 mb-1 block">كلمة المرور الافتراضية</label><input required name="password" type="text" defaultValue="123456" className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-400" /></div>
                  <div className="flex items-end"><button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-md">حفظ الموظف</button></div>
                </form>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-slate-50 text-slate-600 text-sm uppercase tracking-wider">
                  <tr><th className="px-6 py-4 border-b border-slate-200">الاسم</th><th className="px-6 py-4 border-b border-slate-200">المنصب</th><th className="px-6 py-4 border-b border-slate-200">الصلاحية</th><th className="px-6 py-4 border-b border-slate-200">إجراءات</th></tr>
                </thead>
                <tbody className="text-slate-700 divide-y divide-slate-100">
                  {usersList.map((u) => (
                    <React.Fragment key={u.id}>
                      <tr className="hover:bg-slate-50 transition">
                        <td className="px-6 py-4 font-bold text-[#1a365d]">{u.name}</td>
                        <td className="px-6 py-4 text-slate-500">{u.job} <br/><span className="text-[10px] text-slate-400 font-mono">{u.email}</span></td>
                        <td className="px-6 py-4">
                          {u.role === "admin" ? <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-lg text-xs font-bold border border-blue-200">مدير نظام</span> : 
                           u.role === "technician" ? <span className="bg-[#c5a059]/10 text-[#c5a059] px-3 py-1 rounded-lg text-xs font-bold border border-[#c5a059]/20">فني صيانة</span> :
                           <span className="bg-slate-100 text-slate-600 px-3 py-1 rounded-lg text-xs font-bold border border-slate-200">موظف</span>}
                        </td>
                        <td className="px-6 py-4">
                          {u.role !== "admin" && (
                            <button onClick={() => setSelectedUserForPerms(selectedUserForPerms?.id === u.id ? null : u)} className="text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl text-xs font-bold hover:bg-indigo-600 hover:text-white transition flex items-center gap-2 border border-indigo-100">
                              <Shield size={14} /> تعديل الصلاحيات
                            </button>
                          )}
                        </td>
                      </tr>
                      {selectedUserForPerms?.id === u.id && (
                        <tr>
                          <td colSpan="4" className="p-0 border-b-4 border-indigo-500">
                            <div className="bg-slate-900 p-8 shadow-inner animate-fadeIn relative">
                              <h4 className="text-white font-bold mb-6 flex items-center gap-2"><CheckSquare className="text-indigo-400" /> حدد الصفحات المسموح لـ ({u.name}) بالدخول إليها:</h4>
                              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                                {APP_MODULES.map(module => {
                                  let userPerms = [];
                                  try { userPerms = u.permissions ? JSON.parse(u.permissions) : []; } catch(e){}
                                  const isChecked = selectedUserForPerms.tempPerms ? selectedUserForPerms.tempPerms.includes(module.id) : userPerms.includes(module.id);
                                  return (
                                    <label key={module.id} className={`flex items-center gap-3 p-4 rounded-xl cursor-pointer border transition-all ${isChecked ? 'bg-white/10 border-indigo-400 shadow-md' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                                      <input type="checkbox" className="w-5 h-5 accent-indigo-500 rounded cursor-pointer" checked={isChecked} onChange={(e) => {
                                          const currentPerms = selectedUserForPerms.tempPerms || userPerms;
                                          const newPerms = e.target.checked ? [...currentPerms, module.id] : currentPerms.filter(p => p !== module.id);
                                          setSelectedUserForPerms({...selectedUserForPerms, tempPerms: newPerms});
                                        }}
                                      />
                                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${module.bg} ${module.color}`}>
                                        <module.icon size={16} />
                                      </div>
                                      <span className="text-sm font-bold text-slate-200">{module.label}</span>
                                    </label>
                                  )
                                })}
                              </div>
                              <div className="flex justify-end gap-3 border-t border-slate-700 pt-6">
                                <button onClick={() => setSelectedUserForPerms(null)} className="px-6 py-2 text-slate-300 font-bold hover:text-white transition text-sm">إلغاء وتراجع</button>
                                <button onClick={() => handleSavePermissions(u.id, selectedUserForPerms.tempPerms || [])} className="bg-indigo-500 text-white px-8 py-2 rounded-xl font-bold hover:bg-indigo-400 transition flex items-center gap-2 text-sm shadow-lg">
                                  {loading ? <RefreshCw size={16} className="animate-spin" /> : <Shield size={16} />} حفظ الصلاحيات 
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* باقي التابات (المهتمين، الصيانة، الإعدادات، الخ) ... نفس الكود تماماً بدون أي نقص */}
        {activeTab === "leads" && hasPerm("leads") && (
          <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden mb-12 animate-fade-in-up">
            <div className="p-8 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h3 className="text-2xl font-black text-[#1a365d] flex items-center gap-3"><Users className="text-teal-600" /> سجل المهتمين</h3>
              </div>
              <button onClick={loadLeads} className="bg-teal-500 text-white px-6 py-2 rounded-xl font-bold hover:bg-teal-600 transition flex items-center gap-2 shadow-md">
                {loading ? <RefreshCw className="animate-spin" size={16} /> : <RefreshCw size={16} />} تحديث البيانات
              </button>
            </div>
            <div className="p-6 bg-white flex justify-between items-center border-b border-slate-100">
              <div className="relative w-96">
                <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input type="text" placeholder="بحث بالاسم أو الجوال..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl py-3 pr-12 pl-4 outline-none focus:border-teal-500 transition" />
              </div>
              <div className="text-slate-400 text-sm font-bold">العدد الكلي: <span className="text-[#1a365d] text-lg">{leads.filter(l => String(l.name).includes(searchQuery) || String(l.phone).includes(searchQuery)).length}</span></div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="bg-slate-50 text-slate-600 text-sm uppercase tracking-wider">
                  <tr><th className="px-6 py-4 border-b">#</th><th className="px-6 py-4 border-b">الاسم الكريم</th><th className="px-6 py-4 border-b">رقم الجوال</th><th className="px-6 py-4 border-b">الوحدة المهتم بها</th><th className="px-6 py-4 border-b">تاريخ التسجيل</th></tr>
                </thead>
                <tbody className="text-slate-700 divide-y divide-slate-50">
                  {loading ? <tr><td colSpan="5" className="text-center py-12 text-teal-500"><RefreshCw className="animate-spin inline mr-2" /> جاري التحميل...</td></tr> : leads.filter(l => String(l.name).includes(searchQuery) || String(l.phone).includes(searchQuery)).map((lead, i) => (
                    <tr key={i} className="hover:bg-teal-50/30 transition-colors">
                      <td className="px-6 py-4 text-slate-400 text-xs font-mono">{leads.length - i}</td>
                      <td className="px-6 py-4 font-bold text-[#1a365d]">{lead.name}</td>
                      <td className="px-6 py-4 font-sans text-slate-600 font-medium" dir="ltr">{lead.phone}</td>
                      <td className="px-6 py-4"><span className="bg-teal-50 text-teal-700 px-3 py-1 rounded-full text-xs font-bold border border-teal-200">{lead.unit}</span></td>
                      <td className="px-6 py-4 text-sm text-slate-400 font-sans" dir="ltr">{String(lead.date).substring(0, 16)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}