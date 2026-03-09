import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code'; 
import OwnersManage from './OwnersManage';
import MaintenanceManage from './MaintenanceManage';
import UsersManage from './UsersManage';
import { AppContext } from '../../context/AppContext';
import { 
  RefreshCw, LogOut, Lock, Shield, FilePenLine, 
  Wrench, ClipboardCheck, Calculator, QrCode as QrIcon, 
  Users, Phone, Mail, Globe, Building2, Edit, CheckSquare, 
  MessageCircle, Printer, Building, Plus, Trash2, UserCheck 
} from 'lucide-react';

import UnitInspection from './UnitInspection';
import ProjectsManage from './ProjectsManage';

const API_URL = "https://semak.sa/api.php";
const getImg = (id) => `https://drive.google.com/thumbnail?id=${id}&sz=w1000`;
const TIME_SLOTS = ["08:00 ص - 10:00 ص", "10:00 ص - 12:00 م", "01:00 م - 03:00 م", "04:00 م - 06:00 م"];

const APP_MODULES = [
  { id: "projects_manage", label: "إدارة المشاريع", icon: Building, color: "text-rose-600", bg: "bg-rose-50" },
  { id: "owners_manage", label: "سجل الملاك", icon: UserCheck, color: "text-emerald-600", bg: "bg-emerald-50" },
  { id: "maintenance", label: "إدارة طلبات الصيانة", icon: Wrench, color: "text-purple-600", bg: "bg-purple-50" },
  { id: "leads", label: "سجل المهتمين (Leads)", icon: Users, color: "text-teal-600", bg: "bg-teal-50" },
  { id: "inspection", label: "فحص واستلام الوحدات", icon: ClipboardCheck, color: "text-indigo-600", bg: "bg-indigo-50" },
  { id: "letters", label: "منشئ الخطابات", icon: FilePenLine, color: "text-orange-500", bg: "bg-orange-50" },
  { id: "accounting", label: "النظام المحاسبي (دفترة)", icon: Calculator, color: "text-emerald-600", bg: "bg-emerald-50" },
  { id: "qr", label: "رموز الوحدات (QR)", icon: QrIcon, color: "text-slate-800", bg: "bg-slate-100" },
  { id: "users_manage", label: "الموظفين والصلاحيات", icon: Shield, color: "text-[#1a365d]", bg: "bg-blue-50" }
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, setUser, showToast } = useContext(AppContext);
  
  const [activeUser, setActiveUser] = useState(user || null);
  const [activeTab, setActiveTab] = useState("");
  const [leads, setLeads] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [techList, setTechList] = useState([]); 
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [selectedUserForPerms, setSelectedUserForPerms] = useState(null);

  const [ownersList, setOwnersList] = useState([]);
  const [projectsData, setProjectsData] = useState([]); 
  const [showAddOwner, setShowAddOwner] = useState(false);
  const [newOwner, setNewOwner] = useState({ name: "", phone: "", email: "", project_id: "", unit_code: "" });

  useEffect(() => {
    if (!activeUser) {
      const savedUser = localStorage.getItem("semak_current_user");
      if (savedUser) { try { setActiveUser(JSON.parse(savedUser)); if(setUser) setUser(JSON.parse(savedUser)); } catch(e) {} } 
      else { navigate("/login"); }
    }
  }, [activeUser, navigate, setUser]);

  if (!activeUser) return null;
  const hasPerm = (perm) => activeUser.role === 'admin' || (activeUser.permissions && activeUser.permissions.includes(perm));

  const handleLogout = () => { 
    localStorage.removeItem("semak_current_user"); 
    if (typeof setUser === 'function') setUser(null); 
    window.location.href = "/login"; 
  };

  const syncMyProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=get_users`);
      const allUsers = await res.json();
      if(Array.isArray(allUsers)) {
          const myUpdatedData = allUsers.find(u => u.id === activeUser.id);
          if (myUpdatedData) { setActiveUser(myUpdatedData); if(setUser) setUser(myUpdatedData); localStorage.setItem("semak_current_user", JSON.stringify(myUpdatedData)); if(showToast) showToast("تم التحديث", "تمت المزامنة بنجاح ✅"); }
      }
    } catch { if(showToast) showToast("خطأ", "فشل الاتصال", "error"); } finally { setLoading(false); }
  };

  // 🔥 درع الحماية تم تطبيقه هنا (Array.isArray) لمنع الشاشة البيضاء
  const loadLeads = async () => { setActiveTab("leads"); setLoading(true); try { const res = await fetch(`${API_URL}?action=get_leads`); const data = await res.json(); setLeads(Array.isArray(data) ? data : []); } catch {} finally { setLoading(false); } };
  
  const loadUsers = async () => { 
      setActiveTab("users"); setLoading(true); 
      try { 
          const res = await fetch(`${API_URL}?action=get_users`); 
          const data = await res.json(); 
          if(Array.isArray(data)) {
              setUsersList(data); 
              setTechList(data.filter(u => u.role === "technician").map(t => t.name)); 
          } else {
              setUsersList([]); setTechList([]);
          }
      } catch {} finally { setLoading(false); } 
  };

  const loadMaintenance = async () => { 
      setActiveTab("maintenance"); setLoading(true); 
      try { 
          const res = await fetch(`${API_URL}?action=get_maintenance`); 
          let data = await res.json(); 
          if(Array.isArray(data)) {
              const parsed = data.map(row => { 
                  let desc = row.descrip || "---"; let scheduleDate = row.date ? row.date.split(" ")[0] : ""; let scheduleTime = "غير محدد"; 
                  if (desc.includes("التاريخ المفضل:")) { const dateMatch = desc.match(/التاريخ المفضل: (.*)/); if (dateMatch) scheduleDate = dateMatch[1]; const timeMatch = desc.match(/الوقت المفضل: (.*)/); if (timeMatch) scheduleTime = timeMatch[1]; desc = desc.split(`\n\nالوصف:\n`)[1] || desc; } 
                  return { id: row.id, date: row.date, scheduleDate, scheduleTime, name: row.name, phone: row.phone, unit: row.unit, type: row.type, desc: desc, status: row.status || "قيد الانتظار", technician: row.technician || "لم يتم التعيين", otp: row.otp }; 
              }); 
              setTickets(parsed); 
          } else {
              setTickets([]);
          }
          fetch(`${API_URL}?action=get_users`).then(r => r.json()).then(d => { if(Array.isArray(d)) setTechList(d.filter(u => u.role === "technician").map(t => t.name)) }).catch(()=>{}); 
      } catch {} finally { setLoading(false); } 
  };

  const loadOwners = async () => { setActiveTab("owners_manage"); setLoading(true); try { const res = await fetch(`${API_URL}?action=get_owners`); const data = await res.json(); if(data.success && Array.isArray(data.data)) setOwnersList(data.data); else setOwnersList([]); const projRes = await fetch(`${API_URL}?action=get_projects_data`); const projData = await projRes.json(); if(projData.success && Array.isArray(projData.data)) { setProjectsData(projData.data); if(projData.data.length > 0) setNewOwner({...newOwner, project_id: projData.data[0].id}); } } catch {} finally { setLoading(false); } };
  
  const handleAddOwner = async (e) => { e.preventDefault(); if(!newOwner.unit_code) { if(showToast) showToast("تنبيه", "يجب اختيار الوحدة", "error"); return; } setLoading(true); try { const res = await fetch(`${API_URL}?action=add_owner`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newOwner) }); const data = await res.json(); if(data.success) { if(showToast) showToast("تم", "تم ربط المالك بالوحدة بنجاح"); setShowAddOwner(false); setNewOwner({ name: "", phone: "", email: "", project_id: projectsData[0]?.id || "", unit_code: "" }); loadOwners(); } } catch {} finally { setLoading(false); } };
  const updateTicketStatus = async (id, field, value) => { let newOtp = null; let apiField = field; let apiValue = value; setTickets(prev => prev.map(t => { if (t.id === id) { let updatedTicket = { ...t, [field]: value }; if (field === "status" && value === "تم اعتماد الموعد" && !t.otp) { newOtp = Math.floor(1000 + Math.random() * 9000).toString(); updatedTicket.otp = newOtp; } return updatedTicket; } return t; })); const currentTicket = tickets.find(t => t.id === id); if (field === "scheduleDate" || field === "scheduleTime") { apiField = "descrip"; const updatedDate = field === "scheduleDate" ? value : currentTicket.scheduleDate; const updatedTime = field === "scheduleTime" ? value : currentTicket.scheduleTime; apiValue = `الوقت المفضل: ${updatedTime}\nالتاريخ المفضل: ${updatedDate}\n\nالوصف:\n${currentTicket.desc}`; } try { const payload = { ticket_id: id, field_name: apiField, new_value: apiValue }; if (newOtp) payload.otp = newOtp; await fetch(`${API_URL}?action=update_maintenance`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); } catch {} };
  const notifyWhatsApp = (ticket) => { let phone = ticket.phone.toString().replace(/^0/, "966").replace(/\D/g, ""); let techText = ticket.technician && ticket.technician !== "لم يتم التعيين" ? `👨‍🔧 الفني المختص: *${ticket.technician}*` : "سيتم إعلامكم باسم الفني لاحقاً."; let dateText = ticket.scheduleDate ? `📅 التاريخ: *${ticket.scheduleDate}*\n⏰ الوقت: *${ticket.scheduleTime}*` : "لم يتم تحديد موعد الزيارة بعد."; let otpText = ticket.otp ? `\n\n🔑 *رمز إغلاق الطلب (OTP):* ${ticket.otp}\n_(يرجى تزويد الفني بهذا الرمز عند الانتهاء لتأكيد إغلاق الطلب)_` : ""; let msg = `مرحباً بك عميلنا العزيز من شركة *سماك العقارية* 🏢\n\nبخصوص طلب الصيانة رقم: *${ticket.id}*\nالخاص بوحدة: *${ticket.unit}*\n\nحالة الطلب الآن: *${ticket.status}*.\n\n${techText}\n\n*موعد الزيارة:*\n${dateText}${otpText}\n\nنسعد بخدمتكم!`; window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank"); };
  const columns = [ { id: "pending", title: "طلبات ومواعيد جديدة", color: "border-slate-300", bg: "bg-slate-100", text: "text-slate-700", statuses: ["قيد الانتظار", undefined] }, { id: "active", title: "معتمدة / جاري العمل", color: "border-blue-300", bg: "bg-blue-50", text: "text-blue-700", statuses: ["تم التعيين", "تم اعتماد الموعد", "تم اقتراح موعد بديل", "جاري العمل"] }, { id: "completed", title: "مكتملة", color: "border-green-300", bg: "bg-green-50", text: "text-green-700", statuses: ["مكتمل"] } ];
  const renderTicketCard = (ticket) => ( <div key={ticket.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-4 flex flex-col"> <div className="flex justify-between items-start mb-3"><span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-[10px] font-black">#{ticket.id}</span><span className="bg-[#c5a059]/10 text-[#c5a059] px-2 py-1 rounded-full text-[10px] font-bold">{ticket.type} | {ticket.unit}</span></div> <p className="text-xs text-slate-500 mb-3 line-clamp-2 bg-slate-50 p-2 rounded-lg border border-slate-100">{ticket.desc}</p> <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 space-y-3 mt-auto"> <div className="grid grid-cols-2 gap-2"> <div><label className="text-[10px] text-slate-500 font-bold block mb-1">التاريخ</label><input type="date" value={ticket.scheduleDate || ""} onChange={(e) => updateTicketStatus(ticket.id, "scheduleDate", e.target.value)} className="w-full text-xs font-bold p-2 rounded-lg border border-slate-200 outline-none" /></div> <div><label className="text-[10px] text-slate-500 font-bold block mb-1">الوقت</label><select value={ticket.scheduleTime || "غير محدد"} onChange={(e) => updateTicketStatus(ticket.id, "scheduleTime", e.target.value)} className="w-full text-xs font-bold p-2 rounded-lg border border-slate-200 outline-none"><option value="غير محدد" disabled>اختر</option>{TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}</select></div> </div> <select value={ticket.technician || "لم يتم التعيين"} onChange={(e) => updateTicketStatus(ticket.id, "technician", e.target.value)} className="w-full text-xs font-bold p-2 rounded-lg border border-slate-200 outline-none mt-2"><option value="لم يتم التعيين" disabled>-- إسناد لفني --</option>{techList.map(tech => <option key={tech} value={tech}>{tech}</option>)}</select> <div className="flex gap-2 mt-2"> <select value={ticket.status} onChange={(e) => updateTicketStatus(ticket.id, "status", e.target.value)} className="flex-grow text-xs font-bold p-2 rounded-lg border outline-none"><option value="قيد الانتظار">قيد الانتظار</option><option value="تم التعيين">تم التعيين</option><option value="تم اعتماد الموعد">تم اعتماد الموعد</option><option value="جاري العمل">جاري العمل</option><option value="مكتمل">مكتمل</option></select> <button onClick={() => notifyWhatsApp(ticket)} className="bg-green-500 text-white p-2 rounded-lg hover:bg-green-600 transition shadow-md flex items-center justify-center w-10"><MessageCircle size={16} /></button> </div> {activeUser?.role === "admin" && ticket.otp && (ticket.status === "تم اعتماد الموعد" || ticket.status === "جاري العمل") && ( <div className="text-[9px] text-slate-400 text-center mt-1">(رمز الإغلاق: {ticket.otp})</div> )} </div> </div> );

  const buildVCard = () => { const org = activeUser.department ? `شركة سماك العقارية - ${activeUser.department}` : `شركة سماك العقارية`; return `BEGIN:VCARD\nVERSION:3.0\nN;CHARSET=UTF-8:${activeUser.name};;;;\nFN;CHARSET=UTF-8:${activeUser.name}\nORG;CHARSET=UTF-8:${org}\nTITLE;CHARSET=UTF-8:${activeUser.job || 'موظف'}\nTEL;TYPE=CELL:${activeUser.phone || ''}\nEMAIL;TYPE=WORK:${activeUser.email}\nURL:https://semak.sa\nEND:VCARD`; };

  return (
    <div className="pt-20 pb-20 bg-slate-50 min-h-screen animate-fadeIn">
      <div className="container mx-auto px-6 max-w-6xl">
        
        {/* --- 💳 البطاقة الرقمية --- */}
        <div className="mb-14 flex flex-col items-center">
            <div className="relative w-full max-w-3xl bg-gradient-to-br from-[#1a365d] via-[#112240] to-[#0f172a] rounded-[2.5rem] shadow-2xl overflow-hidden border border-[#c5a059]/40 p-8 md:p-12">
                <div className="absolute top-0 right-0 w-72 h-72 bg-[#c5a059]/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                <div className="relative flex flex-col md:flex-row items-center md:items-start justify-between gap-10">
                    <div className="flex-1 text-center md:text-right z-10 w-full">
                        <img src={getImg("1HEFY56KLYGJNmc-tufIXmYDUbGyOIdDX")} alt="سماك" className="h-16 md:h-20 w-auto object-contain drop-shadow-lg mb-3 mx-auto md:mx-0" />
                        <h2 className="text-3xl md:text-4xl font-black text-white mb-2">{activeUser.name}</h2>
                        <p className="text-[#c5a059] font-bold text-lg uppercase tracking-wider mb-6">{activeUser.job || 'موظف'}</p>
                    </div>
                    <div className="bg-white p-3 rounded-2xl shadow-xl relative z-10">
                        <QRCode value={buildVCard()} size={120} bgColor="#FFFFFF" fgColor="#1a365d" level="H" includeMargin={false} />
                    </div>
                </div>
            </div>

            <div className="flex flex-wrap justify-center gap-4 mt-8">
                <button onClick={syncMyProfile} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition flex items-center gap-2 shadow-md">
                    <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> تحديث بيانات الكرت
                </button>
                <button onClick={handleLogout} className="bg-red-50 text-red-600 px-6 py-3 rounded-xl font-bold hover:bg-red-600 hover:text-white transition flex items-center gap-2 shadow-md"><LogOut size={16} /> خروج</button>
            </div>
        </div>

        {/* --- 🛠️ الكروت الرئيسية --- */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {APP_MODULES.map(module => {
                if (!hasPerm(module.id)) return null;
                const Icon = module.icon;
                return (
                    <div 
                        key={module.id} 
                        onClick={() => {
                            window.scrollTo({ top: 600, behavior: 'smooth' });
                            if (module.id === 'users_manage') loadUsers();
                            else if (module.id === 'maintenance') loadMaintenance();
                            else if (module.id === 'leads') loadLeads();
                            else if (module.id === 'owners_manage') loadOwners();
                            else if (module.id === 'projects_manage') setActiveTab("projects_manage");
                            else if (module.id === 'inspection') setActiveTab("inspection");
                            else if (module.id === 'letters') window.open('/admin/letter-generator', '_blank');
                            else setActiveTab(module.id);
                        }} 
                        className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-slate-100 hover:-translate-y-1 hover:shadow-lg transition cursor-pointer group text-center md:text-right"
                    >
                        <div className={`w-12 h-12 ${module.bg} rounded-xl flex items-center justify-center text-xl ${module.color} mb-4 mx-auto md:mx-0 group-hover:bg-[#1a365d] group-hover:text-white transition-colors`}><Icon size={24} /></div>
                        <h3 className="text-md font-bold text-[#1a365d]">{module.label}</h3>
                    </div>
                );
            })}
        </div>

        {/* --- 📋 محتوى الأقسام الفرعية --- */}

        {activeTab === "projects_manage" && hasPerm("projects_manage") && (
            <ProjectsManage showToast={showToast} />
        )}

        {activeTab === "owners_manage" && hasPerm("owners_manage") && (
            <OwnersManage showToast={showToast} />
        )}

        {activeTab === "inspection" && hasPerm("inspection") && (
          <div className="mb-12 animate-fadeIn relative z-10"><div className="-mt-16"><UnitInspection user={activeUser} navigateTo={() => setActiveTab("")} showToast={showToast} /></div></div>
        )}

        {activeTab === "users" && hasPerm("users_manage") && (
            <UsersManage showToast={showToast} activeUser={activeUser} />
        )}
        
        {/* قسم الصيانة (بقي كما هو حتى نفصله لاحقاً) */}
        
        {activeTab === "maintenance" && hasPerm("maintenance") && (
    <MaintenanceManage showToast={showToast} activeUser={activeUser} />
)}

      </div>
    </div>
  );
}