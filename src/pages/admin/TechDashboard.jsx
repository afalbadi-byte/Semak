import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, RefreshCw, Wrench, CalendarDays } from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { API_URL } from '../../utils/helpers';

export default function TechDashboard() {
  const { adminUser: user, setAdminUser, showToast } = useContext(AppContext);
  const navigate = useNavigate();
  
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [otpInputs, setOtpInputs] = useState({});

  useEffect(() => {
    if (!user) {
      navigate("/login");
    } else {
      loadMyTickets();
    }
  }, [user, navigate]);

  const handleLogout = () => {
    setAdminUser(null);
    navigate("/");
  };

  const loadMyTickets = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=get_maintenance`);
      let data = await res.json();
      
      const myTickets = data.filter(t => t.technician === user.name).map(row => {
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
         return { ...row, scheduleDate, scheduleTime, desc };
      });
      setTickets(myTickets);
    } catch (err) {
      showToast("خطأ", "تعذر جلب المهام", "error");
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, newStatus) => {
    setTickets(prev => prev.map(t => t.id === id ? { ...t, status: newStatus } : t));
    try {
      const res = await fetch(`${API_URL}?action=update_maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket_id: id, field_name: "status", new_value: newStatus })
      });
      const data = await res.json();
      if (data.success) {
        showToast("تم التحديث", `تم تحديث حالة الطلب إلى: ${newStatus}`);
      }
    } catch (error) { showToast("خطأ", "تعذر الاتصال بقاعدة البيانات.", "error"); }
  };

  const handleOtpSubmit = (ticket) => {
    const enteredOtp = otpInputs[ticket.id];
    if (enteredOtp === ticket.otp) {
      updateStatus(ticket.id, "مكتمل");
    } else {
      showToast("رمز خاطئ", "رمز التفعيل (OTP) غير صحيح، يرجى التأكد من العميل.", "error");
    }
  };

  if (!user) return null;

  return (
    <div className="pt-24 pb-20 bg-slate-50 min-h-screen">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="flex justify-between items-center mb-8 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-black text-[#1a365d]">بوابة المهام</h1>
            <p className="text-slate-500 text-sm mt-1">الفني: <span className="font-bold text-[#c5a059]">{user?.name}</span></p>
          </div>
          <button onClick={handleLogout} className="bg-red-50 text-red-600 p-3 rounded-xl hover:bg-red-600 hover:text-white transition">
            <LogOut size={20} />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-[#c5a059]"><RefreshCw className="animate-spin inline mr-2" /> جاري التحميل...</div>
        ) : tickets.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-slate-100"><p className="text-slate-500">لا توجد لديك مهام مسندة حالياً.</p></div>
        ) : (
          <div className="space-y-4">
            {tickets.map(ticket => (
              <div key={ticket.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-2">
                    <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-lg text-xs font-black">#{ticket.id}</span>
                    <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-lg text-xs font-bold">{ticket.type}</span>
                  </div>
                  <span className={`px-3 py-1 rounded-lg text-xs font-bold ${ticket.status === 'مكتمل' ? 'bg-green-100 text-green-700' : ticket.status === 'جاري العمل' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'}`}>
                    {ticket.status}
                  </span>
                </div>
                
                <h3 className="font-black text-lg text-[#1a365d] mb-2">{ticket.unit}</h3>
                <div className="bg-slate-50 p-4 rounded-xl text-sm text-slate-600 mb-4 border border-slate-100">
                  <div className="flex items-center gap-2 mb-2 font-bold text-[#1a365d]"><CalendarDays size={16} className="text-[#c5a059]"/> {ticket.scheduleDate} | {ticket.scheduleTime}</div>
                  <p className="border-t border-slate-200 pt-2 mt-2 leading-relaxed">{ticket.desc}</p>
                </div>

                {ticket.status === "تم اعتماد الموعد" && (
                  <button onClick={() => updateStatus(ticket.id, "جاري العمل")} className="w-full bg-[#1a365d] text-white py-3 rounded-xl font-bold hover:bg-[#c5a059] transition flex justify-center items-center gap-2 shadow-lg">
                    <Wrench size={18} /> بدء العمل (أنا في الموقع)
                  </button>
                )}

                {ticket.status === "جاري العمل" && (
                  <div className="bg-green-50 p-4 rounded-xl border border-green-200 text-center animate-fadeIn">
                    <label className="block text-sm font-bold text-green-800 mb-2">أدخل رمز الإغلاق (OTP) من العميل لإنهاء المهمة</label>
                    <div className="flex gap-2">
                      <input 
                        type="text" maxLength={4} placeholder="----"
                        value={otpInputs[ticket.id] || ""}
                        onChange={(e) => setOtpInputs({...otpInputs, [ticket.id]: e.target.value})}
                        className="w-full text-center text-xl font-black p-3 rounded-xl border border-green-300 outline-none focus:border-green-500 tracking-widest"
                      />
                      <button onClick={() => handleOtpSubmit(ticket)} className="bg-green-600 text-white px-6 rounded-xl font-bold hover:bg-green-700 transition shadow-md">إغلاق</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}