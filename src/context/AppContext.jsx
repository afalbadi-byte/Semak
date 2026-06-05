import React, { createContext, useState, useEffect, useCallback } from 'react';

// إنشاء الخزنة (السياق)
export const AppContext = createContext();

// ── إدارة الثيم (فاتح/داكن/تلقائي) ─────────────────────────────────────────
const THEME_KEY = 'semak_theme';
const getStoredTheme = () => {
  try { return localStorage.getItem(THEME_KEY) || 'system'; } catch { return 'system'; }
};
const systemPrefersDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

const applyTheme = (theme) => {
  if (typeof document === 'undefined') return;
  const isDark = theme === 'dark' || (theme === 'system' && systemPrefersDark());
  document.documentElement.classList.toggle('dark', isDark);
};

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

  // ── الثيم ────────────────────────────────────────────────────────────────
  const [theme, setThemeState] = useState(getStoredTheme);

  const setTheme = useCallback((next) => {
    setThemeState(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
    applyTheme(next);
  }, []);

  const cycleTheme = useCallback(() => {
    const order = ['light', 'dark', 'system'];
    setThemeState((prev) => {
      const next = order[(order.indexOf(prev) + 1) % order.length];
      try { localStorage.setItem(THEME_KEY, next); } catch { /* ignore */ }
      applyTheme(next);
      return next;
    });
  }, []);

  // تطبيق الثيم عند الإقلاع + الاستماع لتغيّر تفضيل النظام عند الوضع التلقائي
  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener?.('change', onChange);
    return () => mq.removeEventListener?.('change', onChange);
  }, [theme]);

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
      theme, setTheme, cycleTheme,
      logout
    }}>
      {children}
    </AppContext.Provider>
  );
};
