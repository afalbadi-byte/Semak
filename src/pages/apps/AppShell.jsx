import React, { useState, useEffect, useCallback } from 'react';
import { LogOut, RefreshCw } from 'lucide-react';
import { API_URL, getAdminToken, LS_ADMIN_JWT } from '../../lib/api/client';
import { useDepthGuard } from '../../lib/backstack';
import BuyLogin from '../buy/BuyLogin';
import BuySplash from '../buy/BuySplash';
import BuyInstallGate from '../buy/BuyInstallGate';

// ─── هيكل مشترك لتطبيقات الجوال ─────────────────────────────────────────────
// نفس آلية تطبيق المشتريات: ترحيب، بوابة تثبيت، دخول داخلي، تبويبات،
// وحركة رجوع تنزل شاشة لا تخرج من التطبيق.
const isStandalone = () => {
    try {
        return window.matchMedia('(display-mode: standalone)').matches
            || window.matchMedia('(display-mode: fullscreen)').matches
            || window.navigator.standalone === true;
    } catch { return false; }
};
const isPhone = () => {
    try { return /iphone|ipad|ipod|android|mobile/i.test(navigator.userAgent); } catch { return false; }
};

export default function AppShell({ appKey, title, tabs, perms, manifest, children }) {
    const [tab, setTab]     = useState(tabs[0].k);
    const [user, setUser]   = useState(null);
    const [state, setState] = useState('loading');
    const [splash, setSplash] = useState(() => {
        try { return sessionStorage.getItem(appKey + '_splash') !== '1'; } catch { return true; }
    });

    useDepthGuard(tab === tabs[0].k ? 0 : 1, () => setTab(tabs[0].k));

    // بطاقة تعريف التطبيق وأيقونته — تُربط قبل تقييم المتصفح للتثبيت
    useEffect(() => {
        const link = document.querySelector('link[rel="manifest"]');
        const old  = link ? link.getAttribute('href') : null;
        if (link && manifest) link.setAttribute('href', manifest);
        const t = document.title;
        document.title = title;
        return () => {
            if (link && old) link.setAttribute('href', old);
            document.title = t;
        };
    }, [manifest, title]);

    const check = useCallback(async () => {
        const t = getAdminToken();
        if (!t) { setState('anon'); return; }
        try {
            const r = await fetch(`${API_URL}?action=me`, { headers: { Authorization: `Bearer ${t}` } }).then(x => x.json());
            const u = r.user || null;
            if (!u || !u.id) { setState('anon'); return; }
            let p = u.permissions;
            try { p = typeof p === 'string' ? JSON.parse(p || '[]') : (p || []); } catch { p = []; }
            const ok = u.role === 'admin' || perms.some(k => p.includes(k));
            setUser({ ...u, perms: p });
            setState(ok ? 'ok' : 'denied');
        } catch { setState('anon'); }
    }, [perms]);

    useEffect(() => { check(); }, [check]);

    const logout = () => {
        try { localStorage.removeItem(LS_ADMIN_JWT); } catch { /* تجاهل */ }
        setUser(null); setState('anon');
    };

    if (isPhone() && !isStandalone()) return <BuyInstallGate />;
    if (splash) return (
        <BuySplash userName={user?.name || ''}
            onDone={() => { try { sessionStorage.setItem(appKey + '_splash', '1'); } catch { /* تجاهل */ } setSplash(false); }} />
    );
    if (state === 'loading') return (
        <div className="min-h-screen bg-[#0b1220] flex items-center justify-center">
            <RefreshCw className="animate-spin text-[#c5a059]" size={28} />
        </div>
    );
    if (state === 'anon') return <BuyLogin onDone={() => { setState('loading'); check(); }} />;
    if (state === 'denied') return (
        <div dir="rtl" className="min-h-screen bg-[#0b1220] text-white flex flex-col items-center justify-center gap-3 p-8 font-cairo">
            <p className="font-black">لا تملك صلاحية {title}</p>
            <p className="text-sm text-slate-400 text-center">اطلب من الإدارة تفعيل الصلاحية المناسبة لحسابك</p>
            <button onClick={logout} className="mt-3 px-4 py-2 rounded-xl bg-white/10 text-sm font-bold">تسجيل الخروج</button>
        </div>
    );

    return (
        <div dir="rtl" className="min-h-screen bg-[#0b1220] text-white font-cairo flex flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <header className="px-4 pb-3 bg-gradient-to-l from-[#1a365d] to-[#2d5299] sticky top-0 z-20"
                style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-[11px] text-white/60 font-bold">{title}</div>
                        <div className="font-black">{user?.name || ''}</div>
                    </div>
                    <button onClick={logout} className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center">
                        <LogOut size={16} />
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto pb-24">{children(tab, user)}</main>

            <nav className="fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur border-t border-white/10 z-30">
                <div className={'grid grid-cols-' + tabs.length}>
                    {tabs.map(t => {
                        const Icon = t.icon;
                        const on = tab === t.k;
                        return (
                            <button key={t.k} onClick={() => setTab(t.k)}
                                className={'min-h-[56px] py-2 flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition '
                                    + (on ? 'text-[#c5a059]' : 'text-slate-400')}>
                                <Icon size={19} />{t.t}
                            </button>
                        );
                    })}
                </div>
                <div className="h-[env(safe-area-inset-bottom)]" />
            </nav>
        </div>
    );
}
