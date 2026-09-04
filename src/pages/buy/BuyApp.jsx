import React, { useState, useEffect, useCallback } from 'react';
import { Home, FilePlus, Package, Bot, LogOut, RefreshCw } from 'lucide-react';
import { API_URL, getAdminToken, LS_ADMIN_JWT } from '../../lib/api/client';
import BuyHome from './BuyHome';
import BuyInvoice from './BuyInvoice';
import BuyItems from './BuyItems';
import BuyChat from './BuyChat';
import BuyWelcome from './BuyWelcome';

// ─── تطبيق المشتريات للجوال — يُثبَّت من المتصفح على الآيفون والأندرويد ──────
const TABS = [
    { k: 'home',  t: 'الرئيسية',   icon: Home },
    { k: 'new',   t: 'فاتورة',     icon: FilePlus },
    { k: 'items', t: 'الأسعار',    icon: Package },
    { k: 'chat',  t: 'المساعد',    icon: Bot },
];

// بطاقة تعريف مستقلة حتى يظهر التطبيق باسمه وأيقونته على الشاشة الرئيسية
function useBuyManifest() {
    useEffect(() => {
        const mf = {
            name: 'مشتريات سماك', short_name: 'مشتريات', lang: 'ar', dir: 'rtl',
            display: 'standalone', orientation: 'portrait', scope: '/buy', start_url: '/buy',
            theme_color: '#1a365d', background_color: '#0f172a',
            icons: [{ src: '/images/favicon.png', sizes: 'any', type: 'image/png', purpose: 'any maskable' }],
        };
        const blob = URL.createObjectURL(new Blob([JSON.stringify(mf)], { type: 'application/manifest+json' }));
        const prev = document.querySelector('link[rel="manifest"]');
        const prevHref = prev ? prev.getAttribute('href') : null;
        if (prev) prev.setAttribute('href', blob);
        const title = document.title;
        document.title = 'مشتريات سماك';
        let meta = document.querySelector('meta[name="apple-mobile-web-app-title"]');
        if (!meta) { meta = document.createElement('meta'); meta.name = 'apple-mobile-web-app-title'; document.head.appendChild(meta); }
        meta.content = 'مشتريات سماك';
        return () => {
            if (prev && prevHref) prev.setAttribute('href', prevHref);
            document.title = title;
            URL.revokeObjectURL(blob);
        };
    }, []);
}

export default function BuyApp() {
    const [tab, setTab]   = useState('home');
    // الترحيب يُعرض أول مرة فقط لكل جهاز
    const [welcome, setWelcome] = useState(() => {
        try { return localStorage.getItem('buy_seen') !== '1'; } catch { return true; }
    });
    const [user, setUser] = useState(null);
    const [state, setState] = useState('loading');   // loading | ok | denied | anon
    useBuyManifest();

    const check = useCallback(async () => {
        const t = getAdminToken();
        if (!t) { setState('anon'); return; }
        try {
            const r = await fetch(`${API_URL}?action=me`, { headers: { Authorization: `Bearer ${t}` } }).then(x => x.json());
            const u = r.user || r.data || r;
            if (!u || !u.id) { setState('anon'); return; }
            let perms = u.permissions;
            try { perms = typeof perms === 'string' ? JSON.parse(perms || '[]') : (perms || []); } catch { perms = []; }
            const can = u.role === 'admin' || perms.includes('finance') || perms.includes('accounting');
            setUser({ ...u, perms });
            setState(can ? 'ok' : 'denied');
        } catch { setState('anon'); }
    }, []);

    useEffect(() => { check(); }, [check]);

    const logout = () => {
        try { localStorage.removeItem(LS_ADMIN_JWT); } catch { /* تجاهل */ }
        window.location.href = '/login';
    };

    if (state === 'loading') return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <RefreshCw className="animate-spin text-gold-500" size={28} />
        </div>
    );
    if (state === 'anon') { window.location.href = '/login'; return null; }
    if (state === 'denied') return (
        <div dir="rtl" className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-3 p-8 font-cairo">
            <p className="font-black">لا تملك صلاحية المشتريات</p>
            <p className="text-sm text-slate-400 text-center">اطلب من الإدارة تفعيل صلاحية «الإدارة المالية» لحسابك</p>
            <button onClick={logout} className="mt-3 px-4 py-2 rounded-xl bg-white/10 text-sm font-bold">تسجيل الخروج</button>
        </div>
    );

    if (welcome) return (
        <BuyWelcome userName={user?.name || ''}
            onStart={() => { try { localStorage.setItem('buy_seen', '1'); } catch { /* تجاهل */ } setWelcome(false); }} />
    );

    return (
        <div dir="rtl" className="min-h-screen bg-[#0b1220] text-white font-cairo flex flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <header className="px-4 pb-3 bg-gradient-to-l from-[#1a365d] to-[#2d5299] sticky top-0 z-20"
                style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
                <div className="flex items-center justify-between">
                    <div>
                        <div className="text-[11px] text-white/60 font-bold">مشتريات سماك</div>
                        <div className="font-black">{user?.name || 'مدير المشتريات'}</div>
                    </div>
                    <button onClick={() => setWelcome(true)} className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center ml-2 text-[11px] font-bold">
                        دليل
                    </button>
                    <button onClick={logout} className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center">
                        <LogOut size={16} />
                    </button>
                </div>
            </header>

            <main className="flex-1 overflow-y-auto pb-24">
                {tab === 'home'  && <BuyHome  onNew={() => setTab('new')} />}
                {tab === 'new'   && <BuyInvoice onDone={() => setTab('home')} />}
                {tab === 'items' && <BuyItems />}
                {tab === 'chat'  && <BuyChat userName={user?.name || ''} />}
            </main>

            <nav className="fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur border-t border-white/10 z-30">
                <div className="grid grid-cols-4">
                    {TABS.map(t => {
                        const Icon = t.icon;
                        const on = tab === t.k;
                        return (
                            <button key={t.k} onClick={() => setTab(t.k)}
                                className={'min-h-[56px] py-2 flex flex-col items-center justify-center gap-1 text-[11px] font-bold transition ' +
                                    (on ? 'text-gold-500' : 'text-slate-400')}>
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
