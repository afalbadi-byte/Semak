import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, ShieldCheck, Trash2, RefreshCw, Key, Mail, User, X, Edit } from 'lucide-react';

const API_URL = "https://semak.sa/api.php";

export default function UsersManage({ showToast }) {
    const [usersList, setUsersList] = useState([]);
    const [loading, setLoading] = useState(false);
    
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('add'); 
    const [saving, setSaving] = useState(false);

    // تم التعديل ليطابق الداتا بيس: email بدلاً من username، و employee بدلاً من engineer
    const [formData, setFormData] = useState({
        id: null,
        name: '',
        email: '',
        password: '',
        role: 'employee' 
    });

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}?action=get_users`);
            const data = await res.json();
            if (data.success) { setUsersList(data.data); }
        } catch (e) {
            console.error("Error Fetching:", e);
        } finally { setLoading(false); }
    };

    const openAddModal = () => {
        setModalMode('add');
        setFormData({ id: null, name: '', email: '', password: '', role: 'employee' });
        setShowModal(true);
    };

    const openEditModal = (usr) => {
        setModalMode('edit');
        setFormData({
            id: usr.id,
            name: usr.name,
            email: usr.email, // جلب الإيميل
            password: '', 
            role: usr.role // employee أو admin
        });
        setShowModal(true);
    };

    const handleSaveUser = async (e) => {
        e.preventDefault();
        setSaving(true);
        const action = modalMode === 'add' ? 'add_user' : 'update_user';
        
        try {
            const res = await fetch(`${API_URL}?action=${action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });
            const data = await res.json();
            
            if (data.success) {
                if(showToast) showToast("تم بنجاح", modalMode === 'add' ? "تم إضافة الموظف الجديد ✅" : "تم تحديث بيانات الموظف بنجاح ✅");
                setShowModal(false);
                fetchUsers(); 
            } else {
                if(showToast) showToast("خطأ", data.message || "فشل العملية", "error");
            }
        } catch (e) {
            if(showToast) showToast("خطأ", "مشكلة في الاتصال بالسيرفر", "error");
        } finally { setSaving(false); }
    };

    const handleDeleteUser = async (id, name) => {
        if(!window.confirm(`هل أنت متأكد من حذف الموظف: ${name}؟`)) return;
        try {
            const res = await fetch(`${API_URL}?action=delete_user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id })
            });
            const data = await res.json();
            if(data.success) {
                if(showToast) showToast("تم الحذف", `تم حذف ${name} من النظام`);
                fetchUsers();
            }
        } catch (e) {}
    };

    return (
        <div className="animate-fadeIn">
            
            {showModal && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fadeIn">
                    <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 max-w-lg w-full relative">
                        <button onClick={() => setShowModal(false)} className="absolute top-6 left-6 text-slate-400 hover:text-red-500 transition"><X size={24} /></button>
                        
                        <div className="flex items-center gap-4 mb-8">
                            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${modalMode === 'add' ? 'bg-indigo-50 text-indigo-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                {modalMode === 'add' ? <UserPlus size={28} /> : <Edit size={28} />}
                            </div>
                            <div>
                                <h3 className="text-2xl font-black text-[#1a365d]">
                                    {modalMode === 'add' ? 'إضافة موظف جديد' : 'تعديل بيانات الموظف'}
                                </h3>
                                <p className="text-sm font-bold text-slate-500">
                                    {modalMode === 'add' ? 'إنشاء حساب للموظف' : 'تحديث الصلاحيات وكلمة المرور'}
                                </p>
                            </div>
                        </div>

                        <form onSubmit={handleSaveUser} className="space-y-5">
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">الاسم الكامل</label>
                                <div className="relative">
                                    <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="مثال: م. أحمد محمد" className="w-full bg-slate-50 border border-slate-200 text-[#1a365d] rounded-xl pr-12 pl-4 py-3 outline-none focus:border-indigo-500 font-bold transition" />
                                    <User className="absolute right-4 top-3.5 text-slate-400" size={20} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">اسم المستخدم / الإيميل</label>
                                <div className="relative">
                                    <input required type="text" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="مثال: ahmed@semak.sa" className="w-full bg-slate-50 border border-slate-200 text-[#1a365d] rounded-xl pr-12 pl-4 py-3 outline-none focus:border-indigo-500 font-bold transition" />
                                    <Mail className="absolute right-4 top-3.5 text-slate-400" size={20} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">كلمة المرور</label>
                                <div className="relative">
                                    <input type="text" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} required={modalMode === 'add'} placeholder={modalMode === 'add' ? "كلمة مرور قوية..." : "اكتب باسوورد جديد، أو اتركه فارغاً"} className="w-full bg-slate-50 border border-slate-200 text-[#1a365d] rounded-xl pr-12 pl-4 py-3 outline-none focus:border-indigo-500 font-bold transition" />
                                    <Key className="absolute right-4 top-3.5 text-slate-400" size={20} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-2">الصلاحية والدور</label>
                                <div className="grid grid-cols-2 gap-4">
                                    {/* تم تعديل القيمة هنا إلى employee بناءً على صورتك */}
                                    <label className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition ${formData.role === 'employee' ? 'border-indigo-500 bg-indigo-50 text-indigo-700 shadow-sm' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                        <input type="radio" name="role" value="employee" checked={formData.role === 'employee'} onChange={e => setFormData({...formData, role: e.target.value})} className="hidden" />
                                        <Shield size={24} />
                                        <span className="font-black text-sm">موظف / مهندس</span>
                                    </label>
                                    <label className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 cursor-pointer transition ${formData.role === 'admin' ? 'border-[#c5a059] bg-orange-50 text-orange-700 shadow-sm' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                                        <input type="radio" name="role" value="admin" checked={formData.role === 'admin'} onChange={e => setFormData({...formData, role: e.target.value})} className="hidden" />
                                        <ShieldCheck size={24} />
                                        <span className="font-black text-sm">إدارة عليا (Admin)</span>
                                    </label>
                                </div>
                            </div>
                            <button type="submit" disabled={saving} className="w-full bg-[#1a365d] text-white py-4 rounded-xl font-black text-lg hover:bg-blue-900 transition mt-4 flex justify-center gap-2 shadow-lg">
                                {saving ? <RefreshCw className="animate-spin" size={24} /> : (modalMode === 'add' ? 'اعتماد وإضافة الموظف' : 'حفظ التعديلات')}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100">
                <div>
                    <h1 className="text-2xl font-black text-[#1a365d] flex items-center gap-3"><Users className="text-indigo-500" size={28} /> إدارة الموظفين والصلاحيات</h1>
                    <p className="text-slate-500 font-bold text-sm mt-1">إضافة موظفين، تعيين كلمات المرور، وإدارة الوصول للنظام</p>
                </div>
                <button onClick={openAddModal} className="w-full md:w-auto bg-[#c5a059] text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-yellow-600 transition shadow-lg">
                    <UserPlus size={20} /> إضافة موظف جديد
                </button>
            </div>

            {loading ? (
                <div className="text-center py-20"><RefreshCw className="animate-spin mx-auto text-indigo-500 mb-4" size={40} /><p className="text-slate-500 font-bold">جاري تحميل البيانات...</p></div>
            ) : usersList.length === 0 ? (
                <div className="text-center bg-white p-10 rounded-[2rem] border border-slate-100 shadow-sm">
                    <Users size={48} className="mx-auto text-slate-300 mb-4" />
                    <p className="text-slate-500 font-bold">لا يوجد موظفين مسجلين حالياً.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {usersList.map((usr) => (
                        <div key={usr.id} className="bg-white rounded-[2rem] shadow-sm border border-slate-100 p-6 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition">
                            <div className={`absolute top-0 left-0 w-1 h-full ${usr.role === 'admin' ? 'bg-[#c5a059]' : 'bg-indigo-500'}`}></div>
                            
                            <div className="flex items-start gap-4 mb-6">
                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm ${usr.role === 'admin' ? 'bg-orange-50 text-orange-600' : 'bg-indigo-50 text-indigo-600'}`}>
                                    {usr.role === 'admin' ? <ShieldCheck size={32} /> : <Shield size={32} />}
                                </div>
                                <div className="flex-1 overflow-hidden">
                                    <h3 className="text-xl font-black text-[#1a365d] mb-1 truncate" title={usr.name}>{usr.name}</h3>
                                    <p className="text-sm font-bold text-slate-500 mb-2 truncate" title={usr.email}>{usr.email}</p>
                                    <span className={`px-3 py-1 text-xs font-black rounded-lg ${usr.role === 'admin' ? 'bg-orange-100 text-orange-800' : 'bg-indigo-100 text-indigo-800'}`}>
                                        {usr.role === 'admin' ? 'إدارة عليا' : 'موظف / مهندس'}
                                    </span>
                                </div>
                            </div>

                            <div className="flex gap-2 pt-4 border-t border-slate-100">
                                <button onClick={() => openEditModal(usr)} className="flex-1 py-2.5 bg-slate-50 text-slate-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-500 hover:text-white transition">
                                    <Edit size={16} /> تعديل
                                </button>
                                <button onClick={() => handleDeleteUser(usr.id, usr.name)} className="flex-1 py-2.5 bg-red-50 text-red-600 rounded-xl font-bold text-sm flex items-center justify-center gap-2 hover:bg-red-500 hover:text-white transition">
                                    <Trash2 size={16} /> حذف
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}