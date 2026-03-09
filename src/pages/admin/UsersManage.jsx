import React, { useState, useEffect } from 'react';
import { Shield, Plus, Edit, Trash2, RefreshCw, Save, Lock, UserCheck } from 'lucide-react';

const API_URL = "https://semak.sa/api.php";

const MODULES_LIST = [
    { id: "projects_manage", label: "إدارة المشاريع" },
    { id: "owners_manage", label: "سجل الملاك" },
    { id: "maintenance", label: "إدارة الصيانة" },
    { id: "leads", label: "المهتمين (Leads)" },
    { id: "inspection", label: "فحص الوحدات" },
    { id: "letters", label: "منشئ الخطابات" },
    { id: "users_manage", label: "إدارة الموظفين" }
];

export default function UsersManage({ showToast, activeUser }) {
    const [usersList, setUsersList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [localLoading, setLocalLoading] = useState(false);

    const [showAddUser, setShowAddUser] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [selectedUserForPerms, setSelectedUserForPerms] = useState(null);

    const [newUser, setNewUser] = useState({ name: "", job: "", email: "", phone: "", department: "", role: "employee", password: "" });

    const loadUsers = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_URL}?action=get_users`);
            const data = await res.json();
            setUsersList(data || []);
        } catch (e) {
            console.error(e);
        } finally { setLoading(false); }
    };

    useEffect(() => { loadUsers(); }, []);

    // دالة النزول/الصعود الناعم لبداية القسم
    const scrollToTop = () => {
        document.getElementById('users-manage-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    // --- إضافة موظف جديد ---
    const handleAddUser = async (e) => {
        e.preventDefault();
        setLocalLoading(true);
        try {
            const res = await fetch(`${API_URL}?action=add_user`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(newUser) });
            const data = await res.json();
            if (data.success) {
                if(showToast) showToast("تم", "تم إضافة الموظف بنجاح ✅");
                setShowAddUser(false);
                setNewUser({ name: "", job: "", email: "", phone: "", department: "", role: "employee", password: "" });
                loadUsers();
            }
        } catch (e) { if(showToast) showToast("خطأ", "فشل الاتصال", "error"); } 
        finally { setLocalLoading(false); }
    };

    // --- تعديل موظف قائم ---
    const handleUpdateUser = async (e) => {
        e.preventDefault();
        setLocalLoading(true);
        try {
            const res = await fetch(`${API_URL}?action=update_user`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingUser) });
            const data = await res.json();
            if (data.success) {
                if(showToast) showToast("تم التحديث", "تم تحديث بيانات الموظف بنجاح ✅");
                setEditingUser(null);
                loadUsers();
            }
        } catch (e) { if(showToast) showToast("خطأ", "فشل الاتصال", "error"); } 
        finally { setLocalLoading(false); }
    };

    // --- حذف موظف ---
    const handleDeleteUser = async (id) => {
        if(id === activeUser?.id) {
            if(showToast) showToast("تنبيه", "لا يمكنك حذف حسابك الخاص!", "error");
            return;
        }
        if (!window.confirm("هل أنت متأكد من حذف هذا الموظف نهائياً؟")) return;
        try {
            await fetch(`${API_URL}?action=delete_user`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
            if(showToast) showToast("تم الحذف", "تم حذف الموظف بنجاح");
            loadUsers();
        } catch (e) {}
    };

    // --- حفظ الصلاحيات ---
    const handleSavePermissions = async () => {
        setLocalLoading(true);
        try {
            const permsToSave = typeof selectedUserForPerms.permissions === 'string' ? JSON.parse(selectedUserForPerms.permissions || "[]") : selectedUserForPerms.permissions;
            const res = await fetch(`${API_URL}?action=update_permissions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: selectedUserForPerms.id, permissions: permsToSave }) });
            const data = await res.json();
            if (data.success) {
                if(showToast) showToast("تم", "تم تحديث صلاحيات الموظف ✅");
                setSelectedUserForPerms(null);
                loadUsers();
            }
        } catch (e) { if(showToast) showToast("خطأ", "فشل الاتصال", "error"); } 
        finally { setLocalLoading(false); }
    };

    const togglePermission = (moduleId) => {
        let currentPerms = [];
        try { currentPerms = typeof selectedUserForPerms.permissions === 'string' ? JSON.parse(selectedUserForPerms.permissions || "[]") : (selectedUserForPerms.permissions || []); } catch(e) {}
        
        if (currentPerms.includes(moduleId)) {
            currentPerms = currentPerms.filter(p => p !== moduleId);
        } else {
            currentPerms.push(moduleId);
        }
        setSelectedUserForPerms({ ...selectedUserForPerms, permissions: JSON.stringify(currentPerms) });
    };

    const isPermGranted = (moduleId) => {
        if(selectedUserForPerms.role === 'admin') return true;
        try {
            const perms = typeof selectedUserForPerms.permissions === 'string' ? JSON.parse(selectedUserForPerms.permissions || "[]") : (selectedUserForPerms.permissions || []);
            return perms.includes(moduleId);
        } catch(e) { return false; }
    };

    return (
        <div id="users-manage-section" className="bg-white rounded-[2rem] shadow-xl border border-slate-100 overflow-hidden mb-12 p-6 md:p-8 animate-fadeIn scroll-mt-24">
            
            {/* --- الهيدر --- */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 border-b border-slate-100 pb-6 gap-4">
                <h3 className="text-2xl font-black text-[#1a365d] flex items-center gap-3">
                    <Shield className="text-blue-600" size={28}/> إدارة الموظفين والصلاحيات
                </h3>
                <button onClick={() => { setShowAddUser(!showAddUser); setEditingUser(null); setSelectedUserForPerms(null); }} className="bg-[#1a365d] text-white px-5 py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-md flex items-center gap-2">
                    {showAddUser ? "إلغاء ✕" : <><Plus size={18}/> إضافة موظف جديد</>}
                </button>
            </div>

            {/* --- نموذج إضافة موظف --- */}
            {showAddUser && !editingUser && (
                <form onSubmit={handleAddUser} className="bg-blue-50/50 p-6 md:p-8 rounded-2xl mb-8 border border-blue-100 shadow-inner animate-fadeIn">
                    <h4 className="font-bold text-[#1a365d] mb-4 flex items-center gap-2"><UserCheck size={18}/> بيانات الموظف الجديد</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
                        <div><label className="text-xs font-bold text-slate-500 block mb-2">الاسم الكامل</label><input required type="text" value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500" /></div>
                        <div><label className="text-xs font-bold text-slate-500 block mb-2">المسمى الوظيفي</label><input required type="text" value={newUser.job} onChange={e => setNewUser({...newUser, job: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500" /></div>
                        <div><label className="text-xs font-bold text-slate-500 block mb-2">القسم / الإدارة</label><input required type="text" value={newUser.department} onChange={e => setNewUser({...newUser, department: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500" /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
                        <div><label className="text-xs font-bold text-slate-500 block mb-2">البريد الإلكتروني (للدخول)</label><input required type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} dir="ltr" className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 text-left" /></div>
                        <div><label className="text-xs font-bold text-slate-500 block mb-2">رقم الجوال</label><input required type="text" value={newUser.phone} onChange={e => setNewUser({...newUser, phone: e.target.value})} dir="ltr" className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 text-left" /></div>
                        <div><label className="text-xs font-bold text-slate-500 block mb-2">نوع الحساب</label>
                            <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 font-bold">
                                <option value="employee">موظف (صلاحيات مخصصة)</option>
                                <option value="admin">مدير نظام (صلاحيات كاملة)</option>
                                <option value="technician">فني صيانة</option>
                            </select>
                        </div>
                        <div><label className="text-xs font-bold text-slate-500 block mb-2">كلمة المرور</label><input required type="text" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} dir="ltr" className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500 text-left" /></div>
                    </div>
                    <button type="submit" disabled={localLoading} className="w-full bg-[#1a365d] text-white py-4 rounded-xl font-black hover:bg-blue-700 transition flex justify-center items-center gap-2 shadow-lg disabled:opacity-50">
                        {localLoading ? <RefreshCw className="animate-spin" /> : <Save size={20} />} حفظ وإنشاء الحساب
                    </button>
                </form>
            )}

            {/* --- نموذج التعديل --- */}
            {editingUser && (
                <form onSubmit={handleUpdateUser} className="bg-orange-50 p-6 md:p-8 rounded-2xl mb-8 border border-orange-100 shadow-inner animate-fadeIn relative">
                    <button type="button" onClick={() => setEditingUser(null)} className="absolute top-4 left-4 text-orange-400 hover:text-orange-600 font-bold text-sm bg-white px-3 py-1 rounded-lg shadow-sm">إلغاء ✕</button>
                    <h4 className="font-bold text-orange-800 mb-4 flex items-center gap-2"><Edit size={18}/> تعديل بيانات: {editingUser.name}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
                        <div><label className="text-xs font-bold text-slate-500 block mb-2">الاسم</label><input required type="text" value={editingUser.name} onChange={e => setEditingUser({...editingUser, name: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-orange-500" /></div>
                        <div><label className="text-xs font-bold text-slate-500 block mb-2">المسمى الوظيفي</label><input required type="text" value={editingUser.job} onChange={e => setEditingUser({...editingUser, job: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-orange-500" /></div>
                        <div><label className="text-xs font-bold text-slate-500 block mb-2">القسم</label><input required type="text" value={editingUser.department} onChange={e => setEditingUser({...editingUser, department: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-orange-500" /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
                        <div><label className="text-xs font-bold text-slate-500 block mb-2">البريد</label><input required type="email" value={editingUser.email} onChange={e => setEditingUser({...editingUser, email: e.target.value})} dir="ltr" className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-orange-500 text-left" /></div>
                        <div><label className="text-xs font-bold text-slate-500 block mb-2">الجوال</label><input required type="text" value={editingUser.phone} onChange={e => setEditingUser({...editingUser, phone: e.target.value})} dir="ltr" className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-orange-500 text-left" /></div>
                        <div><label className="text-xs font-bold text-slate-500 block mb-2">نوع الحساب</label>
                            <select value={editingUser.role} onChange={e => setEditingUser({...editingUser, role: e.target.value})} className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-orange-500 font-bold">
                                <option value="employee">موظف</option><option value="admin">مدير نظام</option><option value="technician">فني صيانة</option>
                            </select>
                        </div>
                        <div><label className="text-xs font-bold text-slate-500 block mb-2">الرقم السري (اتركه فارغاً لعدم التغيير)</label><input type="text" placeholder="***" onChange={e => setEditingUser({...editingUser, password: e.target.value})} dir="ltr" className="w-full p-3 rounded-xl border border-slate-200 outline-none focus:border-orange-500 text-left bg-white/50" /></div>
                    </div>
                    <button type="submit" disabled={localLoading} className="w-full bg-orange-500 text-white py-4 rounded-xl font-black hover:bg-orange-600 transition flex justify-center items-center gap-2 shadow-lg disabled:opacity-50">
                        {localLoading ? <RefreshCw className="animate-spin" /> : <Save size={20} />} حفظ التعديلات
                    </button>
                </form>
            )}

            {/* --- نافذة الصلاحيات المتقدمة --- */}
            {selectedUserForPerms && (
                <div className="bg-slate-800 p-6 md:p-8 rounded-2xl mb-8 border border-slate-700 shadow-2xl animate-fadeIn relative">
                    <button type="button" onClick={() => setSelectedUserForPerms(null)} className="absolute top-4 left-4 text-slate-400 hover:text-white font-bold text-sm bg-slate-700 px-3 py-1 rounded-lg transition">إغلاق ✕</button>
                    <h4 className="text-white font-black mb-2 flex items-center gap-2"><Lock size={20} className="text-blue-400"/> إدارة صلاحيات: <span className="text-blue-400">{selectedUserForPerms.name}</span></h4>
                    
                    {selectedUserForPerms.role === 'admin' ? (
                        <div className="bg-blue-900/50 border border-blue-500/30 p-4 rounded-xl text-blue-200 text-sm mt-4">
                            ℹ️ هذا الحساب من نوع "مدير نظام"، ويمتلك جميع الصلاحيات تلقائياً. لا حاجة لتحديدها يدوياً.
                        </div>
                    ) : (
                        <>
                            <p className="text-slate-400 text-xs mb-6">حدد الأقسام التي يمكن للموظف الوصول إليها في النظام:</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mb-8">
                                {MODULES_LIST.map(mod => {
                                    const granted = isPermGranted(mod.id);
                                    return (
                                        <div key={mod.id} onClick={() => togglePermission(mod.id)} className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${granted ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                                            <span className="font-bold text-sm">{mod.label}</span>
                                            <div className={`w-5 h-5 rounded flex items-center justify-center border ${granted ? 'bg-blue-500 border-blue-500' : 'border-slate-600'}`}>
                                                {granted && <div className="w-2.5 h-2.5 bg-white rounded-sm"></div>}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            <button onClick={handleSavePermissions} disabled={localLoading} className="w-full bg-blue-600 text-white py-4 rounded-xl font-black hover:bg-blue-500 transition flex justify-center items-center gap-2 shadow-lg disabled:opacity-50">
                                {localLoading ? <RefreshCw className="animate-spin" /> : <Shield size={20} />} حفظ الصلاحيات
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* --- جدول الموظفين --- */}
            <div className="overflow-x-auto">
                {loading ? (
                    <div className="text-center py-12 text-slate-400 font-bold"><RefreshCw className="animate-spin mx-auto mb-3 text-blue-500" size={32}/> جاري تحميل الموظفين...</div>
                ) : (
                    <table className="w-full text-right">
                        <thead className="bg-slate-50 text-slate-600 text-xs md:text-sm uppercase tracking-wider">
                            <tr>
                                <th className="p-4 rounded-tr-xl">الموظف والوظيفة</th>
                                <th className="p-4 text-center">القسم / الإدارة</th>
                                <th className="p-4 text-center">نوع الحساب</th>
                                <th className="p-4 rounded-tl-xl text-center">إجراءات</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {usersList.length === 0 ? <tr><td colSpan="4" className="text-center p-8 text-slate-400 font-bold">لا يوجد موظفين.</td></tr> : null}
                            {usersList.map(u => (
                                <tr key={u.id} className="hover:bg-blue-50/30 transition group">
                                    <td className="p-4">
                                        <span className="font-bold text-[#1a365d] text-base block">{u.name}</span>
                                        <span className="text-xs text-slate-500 font-bold bg-slate-100 px-2 py-1 rounded inline-block mt-1">{u.job || 'غير محدد'}</span>
                                        <div className="text-[10px] text-slate-400 font-mono mt-1" dir="ltr">{u.phone} • {u.email}</div>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className="text-sm font-bold text-slate-600">{u.department || '---'}</span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`text-xs font-black px-3 py-1.5 rounded-lg border shadow-sm ${u.role === 'admin' ? 'bg-rose-50 text-rose-700 border-rose-200' : u.role === 'technician' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-blue-50 text-blue-700 border-blue-200'}`}>
                                            {u.role === 'admin' ? 'مدير نظام 👑' : u.role === 'technician' ? 'فني صيانة 🔧' : 'موظف 👤'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            {/* استخدام دالة النزول الناعم بدلاً من الرقم الثابت */}
                                            <button onClick={() => { setSelectedUserForPerms(u); setEditingUser(null); setShowAddUser(false); scrollToTop(); }} className="text-slate-500 bg-slate-100 p-2.5 rounded-xl hover:bg-slate-700 hover:text-white transition shadow-sm" title="الصلاحيات"><Shield size={16}/></button>
                                            <button onClick={() => { setEditingUser(u); setSelectedUserForPerms(null); setShowAddUser(false); scrollToTop(); }} className="text-blue-500 bg-blue-50 p-2.5 rounded-xl hover:bg-blue-500 hover:text-white transition shadow-sm" title="تعديل"><Edit size={16}/></button>
                                            {u.id !== activeUser?.id && (
                                                <button onClick={() => handleDeleteUser(u.id)} className="text-red-500 bg-red-50 p-2.5 rounded-xl hover:bg-red-500 hover:text-white transition shadow-sm" title="حذف الموظف"><Trash2 size={16}/></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}