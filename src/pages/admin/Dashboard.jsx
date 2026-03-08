import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, LogOut, Shield, FilePenLine, Wrench, ClipboardCheck, Calculator, ExternalLink, QrCode, Users, RefreshCw, Search, CalendarDays, LayoutGrid, GanttChartSquare, CheckSquare, UserCog, Clock, MessageCircle, Printer, ArrowRight } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { API_URL, TIME_SLOTS } from '../../utils/helpers';
import UnitInspection from './UnitInspection';

const APP_MODULES = [
  { id: "maintenance", label: "إدارة طلبات الصيانة", icon: Wrench, color: "text-purple-600", bg: "bg-purple-50" },
  { id: "letters", label: "منشئ الخطابات", icon: FilePenLine, color: "text-orange-500", bg: "bg-orange-50" },
  { id: "qr", label: "رموز الوحدات (QR)", icon: QrCode, color: "text-slate-800", bg: "bg-slate-100" },
  { id: "leads", label: "سجل المهتمين (Leads)", icon: Users, color: "text-teal-600", bg: "bg-teal-50" },
  { id: "accounting", label: "النظام المحاسبي (دفترة)", icon: Calculator, color: "text-emerald-600", bg: "bg-emerald-50" },
  { id: "inspection", label: "فحص واستلام الوحدات", icon: ClipboardCheck, color: "text-indigo-600", bg: "bg-indigo-50" },
  { id: "users_manage", label: "إدارة الموظفين والصلاحيات", icon: Shield, color: "text-[#1a365d]", bg: "bg-blue-50" }
];

export default function Dashboard() {
  const { adminUser: user, setAdminUser, showToast, logout } = useContext(AppContext);
  const navigate = useNavigate();
  
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

  useEffect(() => {
    if (!user) navigate("/login");
  }, [user, navigate]);

  const hasPerm = (perm) => {
    if (user?.role === 'admin') return true;
    if (!user?.permissions) return false;
    return user.permissions.includes(perm);
  };

  const handleLogout = () => {
    logout();
    navigate("/");
  };

  const loadLeads = async () => {
    setActiveTab("leads");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=get_leads`);
      const data = await res.json();
      setLeads(data);
    } catch { showToast("خطأ", "تعذر جلب سجل المهتمين", "error"); }
    finally { setLoading(false); }
  };

  const loadUsers = async () => {
    setActiveTab("users");
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=get_users`);
      const data = await res.json();
      setUsersList(data);
      setTechList(data.filter(u => u.role === "technician").map(t => t.name));
    } catch { showToast("خطأ", "تعذر جلب الموظفين", "error"); }
    finally { setLoading(false); }
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
         return { id: row.id, date: row.date, scheduleDate, scheduleTime, name: row.name, phone: row.phone, unit: row.unit, type: row.type, desc: desc, status: row.status || "قيد الانتظار", technician: row.technician || "لم يتم التعيين", otp: row.otp };
      });
      setTickets(parsed);
      fetch(`${API_URL}?action=get_users`).then(res => res.json()).then(usersData => setTechList(usersData.filter(u => u.role === "technician").map(t => t.name))).catch(()=>{});
    } catch { showToast("خطأ", "تعذر جلب تذاكر الصيانة", "error"); }
    finally { setLoading(false); }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setLoading(true);
    const payload = { name: e.target.name.value, job: e.target.job.value, email: e.target.email.value, role: e.target.role.value, password: e.target.password.value };
    try {
      const res = await fetch(`${API_URL}?action=add_user`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.success) { showToast("تم", data.message); e.target.reset(); setShowAddUser(false); loadUsers(); }
    } catch { showToast("خطأ", "فشل الاتصال", "error"); }
    finally { setLoading(false); }
  };

  const handleSavePermissions = async (userId, newPerms) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=update_permissions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: userId, permissions: newPerms }) });
      const data = await res.json();
      if (data.success) { showToast("تم الحفظ", data.message); loadUsers(); setSelectedUserForPerms(null); }
      else { showToast("خطأ", data.message, "error"); }
    } catch { showToast("خطأ", "فشل الاتصال", "error"); }
    finally { setLoading(false); }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=change_password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: user.id, old_password: e.target.old_password.value, new_password: e.target.new_password.value }) });
      const data = await res.json();
      if (data.success) { showToast("نجاح", data.message); e.target.reset(); }
      else { showToast("خطأ", data.message, "error"); }
    } catch { showToast("خطأ", "فشل الاتصال", "error"); }
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
      const res = await fetch(`${API_URL}?action=update_maintenance`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const data = await res.json();
      if (data.success) { showToast("تم التحديث", "تم حفظ التغييرات في قاعدة البيانات"); }
      else { showToast("خطأ", "فشل الحفظ في السيرفر", "error"); }
    } catch { showToast("خطأ اتصال", "تعذر الوصول للسيرفر", "error"); }
  };

  const notifyWhatsApp = (ticket) => {
    if (!ticket.phone || ticket.phone === "---") { showToast("خطأ", "رقم جوال العميل غير صالح", "error"); return; }
    let phone = ticket.phone.toString().replace(/^0/, "966").replace(/\D/g, "");
    let techText = ticket.technician && ticket.technician !== "لم يتم التعيين" ? `👨‍🔧 الفني المختص: *${ticket.technician}*` : "سيتم إعلامكم باسم الفني لاحقاً.";
    let dateText = ticket.scheduleDate ? `📅 التاريخ: *${ticket.scheduleDate}*\n⏰ الوقت: *${ticket.scheduleTime}*` : "لم يتم تحديد موعد الزيارة بعد.";
    let otpText = ticket.otp ? `\n\n🔑 *رمز إغلاق الطلب (OTP):* ${ticket.otp}\n_(يرجى تزويد الفني بهذا الرمز عند **الانتهاء من العمل** لتأكيد إغلاق الطلب بنجاح)_` : "";
    let msg = `مرحباً بك عميلنا العزيز من شركة *سماك العقارية* 🏢\n\nبخصوص طلب الصيانة رقم: *${ticket.id}*\nالخاص بوحدة: *${ticket.unit}*\nنوع الطلب: *${ticket.type}*\n\nنفيدكم بأنه تمت مراجعة طلبكم، وحالة الطلب الآن: *${ticket.status}*.\n\n${techText}\n\n*موعد الزيارة (المعتمد / المقترح):*\n${dateText}${otpText}\n\n💡 *(في حال عدم مناسبة الموعد أعلاه، يرجى الرد على هذه الرسالة وسنقوم بتنسيق موعد بديل يناسبكم)*\n\nنسعد بخدمتكم، ونتمنى لكم يوماً سعيداً!`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const renderTicketCard = (ticket) => (
    <div key={ticket.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-4 hover:shadow-md transition group">
      <div className="flex justify-between items-start mb-3">
        <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-[10px] font-black tracking-wider">#{ticket.id}</span>
        <span className="bg-[#c5a059]/10 text-[#c5a059] px-2 py-1 rounded-full text-[10px] font-bold">{ticket.type} | {ticket.unit}</span>
      </div>
      <p className="text-xs text-slate-500 mb-3 line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-100">{ticket.desc}</p>
      <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 space-y-3 mt-4">
        <div className="grid grid-cols-2 gap-2">
          <div><label className="text-[10px] text-slate-500 font-bold block mb-1">تاريخ الزيارة</label><input type="date" value={ticket.scheduleDate || ""} onChange={(e) => updateTicketStatus(ticket.id, "scheduleDate", e.target.value)} className="w-full text-xs font-bold p-2 rounded-lg border border-slate-200 outline-none focus:border-blue-400 bg-white" /></div>
          <div><label className="text-[10px] text-slate-500 font-bold block mb-1">وقت الزيارة</label><select value={ticket.scheduleTime || "غير محدد"} onChange={(e) => updateTicketStatus(ticket.id, "scheduleTime", e.target.value)} className="w-full text-xs font-bold p-2 rounded-lg border border-slate-200 outline-none focus:border-blue-400 bg-white"><option value="غير محدد" disabled>اختر الوقت</option>{TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
        </div>
        <div className="space-y-2 pt-2 border-t border-blue-100">
          <select value={ticket.technician || "لم يتم التعيين"} onChange={(e) => updateTicketStatus(ticket.id, "technician", e.target.value)} className="w-full text-xs font-bold p-2 rounded-lg bg-white border border-slate-200 outline-none focus:border-blue-400 text-slate-700"><option value="لم يتم التعيين" disabled>-- إسناد لفني --</option>{techList.map(tech => <option key={tech} value={tech}>{tech}</option>)}</select>
          <div className="flex gap-2">
            <select value={ticket.status} onChange={(e) => updateTicketStatus(ticket.id, "status", e.target.value)} className="flex-grow text-xs font-bold p-2 rounded-lg border outline-none bg-white"><option value="قيد الانتظار">قيد الانتظار</option><option value="تم التعيين">تم تعيين الفني</option><option value="تم اعتماد الموعد">تم اعتماد الموعد</option><option value="جاري العمل">جاري العمل</option><option value="مكتمل" disabled={ticket.status === "جاري العمل" && ticket.otp}>مكتمل</option></select>
            <button onClick={() => notifyWhatsApp(ticket)} className="w-10 flex-shrink-0 bg-green-500 text-white rounded-lg flex items-center justify-center hover:bg-green-600 transition"><MessageCircle size={16} /></button>
          </div>
          {ticket.status === "جاري العمل" && ticket.otp && (
            <div className="flex items-center gap-2 mt-1 p-2 bg-green-50 border border-green-200 rounded-lg">
              <Lock size={14} className="text-green-600" /><input type="text" placeholder="رمز الإغلاق" maxLength={4} value={otpInputs[ticket.id] || ""} onChange={(e) => setOtpInputs({...otpInputs, [ticket.id]: e.target.value})} className="w-full text-center text-xs font-bold p-1.5 rounded border border-green-300" /><button onClick={() => { if(otpInputs[ticket.id] === ticket.otp) { updateTicketStatus(ticket.id, "status", "مكتمل"); showToast("عمل ممتاز!", "تم إغلاق الطلب"); } else { showToast("رمز خاطئ", "الرمز غير صحيح", "error"); } }} className="bg-green-500 text-white px-3 py-1.5 rounded text-xs font-bold">إغلاق</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const columns = [
    { id: "pending", title: "جديدة", color: "border-slate-300", bg: "bg-slate-100", text: "text-slate-700", statuses: ["قيد الانتظار", undefined] },
    { id: "active", title: "جاري العمل", color: "border-blue-300", bg: "bg-blue-50", text: "text-blue-700", statuses: ["تم التعيين", "تم اعتماد الموعد", "تم اقتراح موعد بديل", "جاري العمل"] },
    { id: "completed", title: "مكتملة", color: "border-green-300", bg: "bg-green-50", text: "text-green-700", statuses: ["مكتمل"] }
  ];

  if (!user) return null;

  return (
    <div className="pt-32 pb-20 bg-slate-50 min-h-screen">
      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center mb-12 gap-6">
          <div><h1 className="text-3xl md:text-4xl font-black text-[#1a365d]">لوحة الخدمات</h1><p className="text-slate-500 mt-2">أهلاً بك، <span className="font-bold text-[#c5a059]">{user?.name}</span></p></div>
          <div className="flex gap-3">
            <button onClick={() => setActiveTab("settings")} className="bg-white border border-slate-200 text-slate-700 px-5 py-3 rounded-xl font-bold hover:bg-slate-100 flex items-center gap-2"><Lock size={16} /> إعدادات الحساب</button>
            <button onClick={handleLogout} className="bg-red-50 text-red-600 px-5 py-3 rounded-xl font-bold hover:bg-red-600 hover:text-white flex items-center gap-2"><LogOut size={16} /> خروج</button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
          {APP_MODULES.map(mod => {
            if (!hasPerm(mod.id)) return null;
            return (
              <div key={mod.id} onClick={() => {
                if(mod.id === 'users_manage') loadUsers();
                else if(mod.id === 'leads') loadLeads();
                else if(mod.id === 'maintenance') loadMaintenance();
                else if(mod.id === 'letters') navigate("/admin/letter-generator");
                else if(mod.id === 'accounting') window.open("https://semak.daftra.com/", "_blank");
                else setActiveTab(mod.id);
              }} className="bg-white p-8 rounded-[2rem] shadow-lg border border-slate-100 hover:-translate-y-2 cursor-pointer group">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mb-6 ${mod.bg} ${mod.color}`}><mod.icon size={32} /></div>
                <h3 className="text-2xl font-bold text-[#1a365d] mb-2">{mod.label}</h3>
              </div>
            )
          })}
        </div>

        {activeTab === "settings" && (
          <div className="bg-white p-8 max-w-xl mx-auto rounded-2xl shadow-xl"><h3 className="text-2xl font-black mb-4">إعدادات الأمان</h3><form onSubmit={handleChangePassword} className="space-y-4"><input type="password" name="old_password" placeholder="كلمة المرور الحالية" required className="w-full p-3 border rounded-xl" /><input type="password" name="new_password" placeholder="كلمة المرور الجديدة" required className="w-full p-3 border rounded-xl" /><button type="submit" className="w-full bg-[#1a365d] text-white py-3 rounded-xl font-bold">حفظ</button></form></div>
        )}

        {activeTab === "users" && hasPerm("users_manage") && (
          <div className="bg-white rounded-2xl shadow-xl p-8"><h3 className="text-2xl font-black mb-4">الموظفين</h3>{/* جدول الموظفين يوضع هنا للتوضيح */} <p className="text-slate-500">تم تحميل قائمة الموظفين (متصل بالداتا بيس مستقبلاً).</p></div>
        )}

        {activeTab === "maintenance" && hasPerm("maintenance") && (
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <h3 className="text-2xl font-black mb-4">إدارة الصيانة</h3>
            <div className="flex overflow-x-auto pb-4 gap-6 kanban-scroll items-start">
              {columns.map(col => {
                const colTickets = tickets.filter(t => col.statuses.includes(t.status));
                return (
                  <div key={col.id} className={`w-80 flex-shrink-0 rounded-2xl border-t-4 ${col.color} ${col.bg} p-4 max-h-[800px] overflow-y-auto`}>
                    <h4 className={`font-black ${col.text} mb-4`}>{col.title}</h4>
                    {colTickets.map(renderTicketCard)}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "inspection" && hasPerm("inspection") && <UnitInspection />}
        
        {activeTab === "qr" && hasPerm("qr") && (
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center"><h3 className="text-2xl font-black mb-4"><QrCode className="inline mr-2"/> طباعة QR</h3><button onClick={()=>window.print()} className="bg-slate-800 text-white px-4 py-2 rounded-xl">طباعة</button></div>
        )}

        {activeTab === "leads" && hasPerm("leads") && (
          <div className="bg-white rounded-2xl shadow-xl p-8"><h3 className="text-2xl font-black mb-4">المهتمين</h3><p>عدد المهتمين: {leads.length}</p></div>
        )}
      </div>
    </div>
  );
}