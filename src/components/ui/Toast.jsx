import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertTriangle, Info, X } from 'lucide-react';

// ════════════════════════════════════════════════════════════════════════════
//  نظام إشعارات موحّد (Toast) مستقل عن AppContext — لاستبدال alert() في الشاشات.
//  الاستخدام:
//    <ToastProvider> ... </ToastProvider>
//    const toast = useToast(); toast.success('تم الحفظ'); toast.error('فشل');
// ════════════════════════════════════════════════════════════════════════════

const ToastCtx = createContext(null);

const KIND = {
    success: { cls: 'bg-emerald-600', Icon: CheckCircle2 },
    error:   { cls: 'bg-red-600',     Icon: AlertTriangle },
    info:    { cls: 'bg-[#1a365d]',   Icon: Info },
};

function ToastItem({ msg, kind, onClose }) {
    const k = KIND[kind] || KIND.success;
    const Icon = k.Icon;
    return (
        <div className={`flex items-center gap-2.5 px-5 py-3 rounded-2xl shadow-xl font-bold text-sm text-white animate-fadeIn ${k.cls}`}>
            <Icon size={18} className="shrink-0" />
            <span className="leading-tight">{msg}</span>
            <button onClick={onClose} className="opacity-70 hover:opacity-100 transition shrink-0"><X size={15} /></button>
        </div>
    );
}

export function ToastProvider({ children }) {
    const [toasts, setToasts] = useState([]);
    const dismiss = useCallback((id) => setToasts(t => t.filter(x => x.id !== id)), []);
    const show = useCallback((msg, kind = 'success', ttl = 3500) => {
        const id = Date.now() + Math.random();
        setToasts(t => [...t, { id, msg, kind }]);
        if (ttl) setTimeout(() => dismiss(id), ttl);
        return id;
    }, [dismiss]);

    const value = {
        show,
        success: (m, ttl) => show(m, 'success', ttl),
        error:   (m, ttl) => show(m, 'error', ttl),
        info:    (m, ttl) => show(m, 'info', ttl),
        dismiss,
    };

    return (
        <ToastCtx.Provider value={value}>
            {children}
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 items-center no-print" dir="rtl">
                {toasts.map(t => <ToastItem key={t.id} {...t} onClose={() => dismiss(t.id)} />)}
            </div>
        </ToastCtx.Provider>
    );
}

export function useToast() {
    const ctx = useContext(ToastCtx);
    if (!ctx) {
        // احتياطي آمن إن لم يُلفّ المكوّن بالمزوّد (لا يكسر الشاشة)
        const noop = () => {};
        return { show: (m) => console.log('[toast]', m), success: noop, error: noop, info: noop, dismiss: noop };
    }
    return ctx;
}
