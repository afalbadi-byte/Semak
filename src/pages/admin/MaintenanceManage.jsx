import React, { useState, useEffect } from 'react';
import { Wrench, RefreshCw, MessageCircle } from 'lucide-react';

const API_URL = "https://semak.sa/api.php";
const TIME_SLOTS = ["08:00 ص - 10:00 ص", "10:00 ص - 12:00 م", "01:00 م - 03:00 م", "04:00 م - 06:00 م"];

export default function MaintenanceManage({ showToast, activeUser }) {
    const [tickets, setTickets] = useState([]);
    const [techList, setTechList] = useState([]);
    const [loading, setLoading] = useState(true);

    const columns = [ 
        { id: "pending", title: "طلبات ومواعيد جديدة", color: "border-slate-300", bg: "bg-slate-100", text: "text-slate-700", statuses: ["قيد الانتظار", undefined] }, 
        { id: "active", title: "معتمدة / جاري العمل", color: "border-blue-300", bg: "bg-blue-50", text: "text-blue-700", statuses: ["تم التعيين", "تم اعتماد الموعد", "تم اقتراح موعد بديل", "جاري العمل"] }, 
        { id: "completed", title: "مكتملة", color: "border-green-300", bg: "bg-green-50", text: "text-green-700", statuses: ["مكتمل"] } 
    ];

    const loadMaintenance = async () => { 
        setLoading(true); 
        try { 
            const res = await fetch(`${API_URL}?action=get_maintenance`); 
            let data = await res.json(); 
            if(Array.isArray(data)) {
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
            } else {
                setTickets([]);
            }
            
            // جلب قائمة الفنيين من جدول الموظفين
            fetch(`${API_URL}?action=get_users`)
            .then(r => r.json())
            .then(d => { 
                if(Array.isArray(d)) setTechList(d.filter(u => u.role === "technician").map(t => t.name)) 
            }).catch(()=>{}); 
            
        } catch(e) { 
            console.error(e);
        } finally { 
            setLoading(false); 
        } 
    };

    useEffect(() => {
        loadMaintenance();
    }, []);

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
            const res = await fetch(`${API_URL}?action=update_maintenance`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); 
            const data = await res.json();
            if(data.success && showToast && field === "status") {
                showToast("تم التحديث", "تم تحديث حالة الطلب بنجاح");
            }
        } catch(e) {
            if(showToast) showToast("خطأ", "فشل الاتصال", "error");
        } 
    };

    const notifyWhatsApp = (ticket) => { 
        let phone = ticket.phone.toString().replace(/^0/, "966").replace(/\D/g, ""); 
        let techText = ticket.technician && ticket.technician !== "لم يتم التعيين" ? `👨‍🔧 الفني المختص: *${ticket.technician}*` : "سيتم إعلامكم باسم الفني لاحقاً."; 
        let dateText = ticket.scheduleDate ? `📅 التاريخ: *${ticket.scheduleDate}*\n⏰ الوقت: *${ticket.scheduleTime}*` : "لم يتم تحديد موعد الزيارة بعد."; 
        let otpText = ticket.otp ? `\n\n🔑 *رمز إغلاق الطلب (OTP):* ${ticket.otp}\n_(يرجى تزويد الفني بهذا الرمز عند الانتهاء لتأكيد إغلاق الطلب)_` : ""; 
        let msg = `مرحباً بك عميلنا العزيز من شركة *سماك العقارية* 🏢\n\nبخصوص طلب الصيانة رقم: *${ticket.id}*\nالخاص بوحدة: *${ticket.unit}*\n\nحالة الطلب الآن: *${ticket.status}*.\n\n${techText}\n\n*موعد الزيارة:*\n${dateText}${otpText}\n\nنسعد بخدمتكم!`; 
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank"); 
    };

    const renderTicketCard = (ticket) => ( 
        <div key={ticket.id} className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 mb-4 flex flex-col hover:shadow-md transition"> 
            <div className="flex justify-between items-start mb-3">
                <span className="bg-purple-100 text-purple-700 px-2 py-1 rounded text-[10px] font-black tracking-wider">#{ticket.id}</span>
                <span className="bg-[#c5a059]/10 text-[#c5a059] px-2 py-1 rounded-full text-[10px] font-bold">{ticket.type} | {ticket.unit}</span>
            </div> 
            
            <p className="text-xs text-slate-500 mb-3 line-clamp-3 bg-slate-50 p-2.5 rounded-lg border border-slate-100 font-medium leading-relaxed">{ticket.desc}</p> 
            
            <div className="bg-blue-50/50 p-3 rounded-xl border border-blue-100 space-y-3 mt-auto"> 
                <div className="grid grid-cols-2 gap-2"> 
                    <div>
                        <label className="text-[10px] text-slate-500 font-bold block mb-1">التاريخ</label>
                        <input type="date" value={ticket.scheduleDate || ""} onChange={(e) => updateTicketStatus(ticket.id, "scheduleDate", e.target.value)} className="w-full text-xs font-bold p-2 rounded-lg border border-slate-200 outline-none focus:border-purple-400 transition" />
                    </div> 
                    <div>
                        <label className="text-[10px] text-slate-500 font-bold block mb-1">الوقت</label>
                        <select value={ticket.scheduleTime || "غير محدد"} onChange={(e) => updateTicketStatus(ticket.id, "scheduleTime", e.target.value)} className="w-full text-xs font-bold p-2 rounded-lg border border-slate-200 outline-none focus:border-purple-400 transition">
                            <option value="غير محدد" disabled>اختر</option>
                            {TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div> 
                </div> 
                
                <select value={ticket.technician || "لم يتم التعيين"} onChange={(e) => updateTicketStatus(ticket.id, "technician", e.target.value)} className="w-full text-xs font-bold p-2 rounded-lg border border-slate-200 outline-none mt-2 focus:border-purple-400 transition">
                    <option value="لم يتم التعيين" disabled>-- إسناد لفني --</option>
                    {techList.map(tech => <option key={tech} value={tech}>{tech}</option>)}
                </select> 
                
                <div className="flex gap-2 mt-2"> 
                    <select value={ticket.status} onChange={(e) => updateTicketStatus(ticket.id, "status", e.target.value)} className="flex-grow text-xs font-bold p-2 rounded-lg border outline-none focus:border-purple-400 transition">
                        <option value="قيد الانتظار">قيد الانتظار</option>
                        <option value="تم التعيين">تم التعيين</option>
                        <option value="تم اعتماد الموعد">تم اعتماد الموعد</option>
                        <option value="جاري العمل">جاري العمل</option>
                        <option value="مكتمل">مكتمل</option>
                    </select> 
                    <button onClick={() => notifyWhatsApp(ticket)} className="bg-green-500 text-white p-2 rounded-lg hover:bg-green-600 transition shadow-md flex items-center justify-center w-10" title="إرسال تحديث للعميل واتساب">
                        <MessageCircle size={16} />
                    </button> 
                </div> 
                
                {activeUser?.role === "admin" && ticket.otp && (ticket.status === "تم اعتماد الموعد" || ticket.status === "جاري العمل") && ( 
                    <div className="text-[10px] text-slate-500 font-bold bg-slate-100 p-1.5 rounded text-center mt-2 border border-slate-200">
                        (رمز الإغلاق: <span className="text-purple-600">{ticket.otp}</span>)
                    </div> 
                )} 
            </div> 
        </div> 
    );

    return (
        <div className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden mb-12 p-6 md:p-8 animate-fadeIn">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-100 pb-6 gap-4">
                <h3 className="text-2xl font-black text-[#1a365d] flex items-center gap-3">
                    <Wrench className="text-purple-600" size={28}/> إدارة طلبات الصيانة
                </h3>
                <button onClick={loadMaintenance} className="bg-slate-50 text-slate-500 px-4 py-2 rounded-xl font-bold hover:bg-purple-50 hover:text-purple-600 transition flex items-center gap-2 border border-slate-200">
                    <RefreshCw size={18} className={loading ? "animate-spin" : ""} /> تحديث الطلبات
                </button>
            </div>

            {loading ? (
                <div className="text-center py-20 text-slate-400 font-bold"><RefreshCw className="animate-spin mx-auto mb-4 text-purple-500" size={40}/> جاري تحميل الطلبات...</div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {columns.map(col => (
                        <div key={col.id} className={`bg-slate-50 p-4 md:p-5 rounded-3xl border-2 ${col.color} flex flex-col h-full shadow-inner`}>
                            <h4 className={`font-black text-center mb-5 text-sm md:text-base ${col.text}`}>
                                {col.title} ({tickets.filter(t => col.statuses.includes(t.status)).length})
                            </h4>
                            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-[300px]">
                                {tickets.filter(t => col.statuses.includes(t.status)).length === 0 ? (
                                    <div className="text-center text-slate-400 text-xs font-bold py-16 bg-white rounded-2xl border border-slate-100 border-dashed">لا توجد طلبات هنا</div> 
                                ) : (
                                    tickets.filter(t => col.statuses.includes(t.status)).map(renderTicketCard)
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}