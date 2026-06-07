import React, { createContext, useState, useEffect, useCallback } from 'react';

// ─── مفاتيح localStorage ─────────────────────────────────────────────────────
const LS_PLATFORM_JWT = 'semak_platform_token';
const LS_ADMIN_JWT    = 'semak_admin_jwt';

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

  // ── مدير المنصة (SaaS platform owner) ──────────────────────────────────────
  const [platformUser, setPlatformUserState] = useState(() => {
    try {
      const t = localStorage.getItem(LS_PLATFORM_JWT);
      return t ? { token: t } : null;
    } catch { return null; }
  });
  const setPlatformUser = useCallback((token) => {
    if (token) {
      localStorage.setItem(LS_PLATFORM_JWT, token);
      setPlatformUserState({ token });
    } else {
      localStorage.removeItem(LS_PLATFORM_JWT);
      setPlatformUserState(null);
    }
  }, []);
  const logoutPlatform = useCallback(() => setPlatformUser(null), [setPlatformUser]);

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
    localStorage.removeItem("semak_current_user");
    localStorage.removeItem("semak_customer");
    localStorage.removeItem(LS_ADMIN_JWT);
  };

  return (
    <AppContext.Provider value={{
      adminUser, setAdminUser,
      customer, setCustomer,
      platformUser, setPlatformUser, logoutPlatform,
      toast, showToast,
      theme, setTheme, cycleTheme,
      logout
    }}>
      {children}
    </AppContext.Provider>
  );
};
