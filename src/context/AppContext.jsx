import React, { createContext, useState } from 'react';

// إنشاء الخزنة (السياق)
export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [adminUser, setAdminUser] = useState(null);

  const [customer, setCustomerState] = useState(() => {
    try { const s = localStorage.getItem('semak_customer'); return s ? JSON.parse(s) : null; }
    catch { return null; }
  });

  const setCustomer = (data) => {
    setCustomerState(data);
    if (data) localStorage.setItem('semak_customer', JSON.stringify(data));
    else localStorage.removeItem('semak_customer');
  };

  // حفظ حالة الإشعارات (الرسائل المنبثقة)
  const [toast, setToast] = useState({ show: false, title: "", desc: "", type: "success" });

  // دالة موحدة لإظهار الإشعارات في أي مكان بالموقع
  const showToast = (title, desc, type = "success") => {
    setToast({ show: true, title, desc, type });
    setTimeout(() => setToast({ show: false, title: "", desc: "", type: "success" }), 4000);
  };

  const logout = () => {
    setAdminUser(null);
    setCustomerState(null);
    localStorage.removeItem("semak_admin_email");
    localStorage.removeItem("semak_customer");
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