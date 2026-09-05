import React, { useState, useEffect, useCallback } from 'react';
import { Home, FilePlus, Package, Bot, LogOut, RefreshCw, FileText } from 'lucide-react';
import { API_URL, getAdminToken, LS_ADMIN_JWT } from '../../lib/api/client';
import BuyHome from './BuyHome';
import BuyInvoice from './BuyInvoice';
import BuyItems from './BuyItems';
import BuyChat from './BuyChat';
import BuyRecords from './BuyRecords';
import BuyWelcome from './BuyWelcome';
import BuyLogin from './BuyLogin';
import BuySplash from './BuySplash';
import BuyInstallGate from './BuyInstallGate';

// ─── تطبيق المشتريات للجوال — يُثبَّت من المتصفح على الآيفون والأندرويد ──────
const TABS = [
    { k: 'home',    t: 'الرئيسية', icon: Home },
    { k: 'new',     t: 'فاتورة',   icon: FilePlus },
    { k: 'records', t: 'السجلات',  icon: FileText },
    { k: 'items',   t: 'الأسعار',  icon: Package },
    { k: 'chat',    t: 'المساعد',  icon: Bot },
];

// بطاقة تعريف مستقلة حتى يظهر التطبيق باسمه وأيقونته على الشاشة الرئيسية
function useBuyManifest() {
    useEffect(() => {
        // بطاقة تعريف حقيقية على الخادم — المتصفحات لا تقبل التثبيت من رابط blob
        const prev = document.querySelector('link[rel="manifest"]');
        const prevHref = prev ? prev.getAttribute('href') : null;
        if (prev) prev.setAttribute('href', '/buy.webmanifest');
        const title = document.title;
        document.title = 'مشتريات سماك';
        const metas = [];
        const setMeta = (name, content) => {
            let m = document.querySelector('meta[name="' + name + '"]');
            const created = !m;
            if (!m) { m = document.createElement('meta'); m.name = name; document.head.appendChild(m); }
            metas.push({ el: m, created, old: m.content });
            m.content = content;
        };
        setMeta('apple-mobile-web-app-title', 'مشتريات سماك');
        setMeta('apple-mobile-web-app-capable', 'yes');
        setMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
        setMeta('theme-color', '#1a365d');
        // سفاري يأخذ أيقونة الشاشة الرئيسية من apple-touch-icon لا من بطاقة التعريف
        const apple = document.querySelector('link[rel="apple-touch-icon"]');
        const appleOld = apple ? apple.getAttribute('href') : null;
        if (apple) apple.setAttribute('href', '/images/app-icon-512.png');
        return () => {
            if (prev && prevHref) prev.setAttribute('href', prevHref);
            if (apple && appleOld) apple.setAttribute('href', appleOld);
            document.title = title;
            metas.forEach(m => { if (m.created) m.el.remove(); else m.el.content = m.old; });
        };
    }, []);
}

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

export default function BuyApp() {
    const [tab, setTab]   = useState('home');
    // الترحيب يُعرض أول مرة فقط لكل جهاز
    const [splash, setSplash] = useState(() => {
        try { return sessionStorage.getItem('buy_splash') !== '1'; } catch { return true; }
    });
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
        setUser(null); setState('anon');
    };

    // الهاتف يلزمه التثبيت؛ الحاسب يُستخدم من لوحة الإدارة أصلاً
    if (isPhone() && !isStandalone()) return <BuyInstallGate />;

    if (splash) return (
        <BuySplash userName={user?.name || ''}
            onDone={() => { try { sessionStorage.setItem('buy_splash', '1'); } catch { /* تجاهل */ } setSplash(false); }} />
    );
    if (state === 'loading') return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <RefreshCw className="animate-spin text-gold-500" size={28} />
        </div>
    );
    if (state === 'anon') return <BuyLogin onDone={() => { setState('loading'); check(); }} />;
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
                {tab === 'records' && <BuyRecords />}
                {tab === 'items' && <BuyItems />}
                {tab === 'chat'  && <BuyChat userName={user?.name || ''} />}
            </main>

            <nav className="fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur border-t border-white/10 z-30">
                <div className="grid grid-cols-5">
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
