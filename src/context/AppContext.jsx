import React, { createContext, useState } from 'react';

// إنشاء الخزنة (السياق)
export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  // حفظ بيانات المستخدمين
  const [adminUser, setAdminUser] = useState(null);
  const [customer, setCustomer] = useState(null);

  // حفظ حالة الإشعارات (الرسائل المنبثقة)
  const [toast, setToast] = useState({ show: false, title: "", desc: "", type: "success" });

  // دالة موحدة لإظهار الإشعارات في أي مكان بالموقع
  const showToast = (title, desc, type = "success") => {
    setToast({ show: true, title, desc, type });
    setTimeout(() => setToast({ show: false, title: "", desc: "", type: "success" }), 4000);
  };

  // دالة موحدة لتسجيل الخروج
  const logout = () => {
    setAdminUser(null);
    setCustomer(null);
    localStorage.removeItem("semak_admin_email");
    localStorage.removeItem("semak_admin_password");
  };

  return (
    <AppContext.Provider value={{ 
      adminUser, setAdminUser, 
      customer, setCustomer, 
      toast, showToast,
      logout
    }}>
      {children}
    </AppContext.Provider>
  );
};