import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, RefreshCw, ChevronLeft, Globe } from 'lucide-react';
import { API_URL, getAdminToken, LS_ADMIN_JWT } from '../../lib/api/client';
import { SEMAK_APPS, canUse, appIcon } from '../../lib/semakApps';
import BuyLogin from '../buy/BuyLogin';
import BuyChangePw from '../buy/BuyChangePw';
import BuyInstallGate from '../buy/BuyInstallGate';

// ════════════════════════════════════════════════════════════════════════════
//  «تطبيقات سماك» — بوابةٌ واحدة تُثبَّت مرّة، وتفتح كل تطبيق داخلها
//  ─────────────────────────────────────────────────────────────────────────
//  نطاقها يشمل الموقع كلّه، فتبقى التطبيقات في نافذتها ملء الشاشة بلا تثبيتٍ
//  مستقلّ لكل واحد. ولا يظهر لكل موظّف إلا ما تسمح به صلاحياته.
// ════════════════════════════════════════════════════════════════════════════

const isStandalone = () => {
    try {
        return window.matchMedia('(display-mode: standalone)').matches
            || window.matchMedia('(display-mode: fullscreen)').matches || window.navigator.standalone === true;
    } catch { return false; }
};
const isPhone = () => { try { return /iphone|ipad|ipod|android|mobile/i.test(navigator.userAgent); } catch { return false; } };
const hello = () => { const h = new Date().getHours(); return h < 12 ? 'صباح الخير' : 'مساء الخير'; };

export default function AppsHub() {
    const nav = useNavigate();
    const [user, setUser] = useState(null);
    const [state, setState] = useState('loading');

    // بطاقة تعريف البوابة وأيقونتها
    useEffect(() => {
        const link = document.querySelector('link[rel="manifest"]');
        const old = link ? link.getAttribute('href') : null;
        if (link) link.setAttribute('href', '/apps.webmanifest');
        const apple = document.querySelector('link[rel="apple-touch-icon"]');
        const appleOld = apple ? apple.getAttribute('href') : null;
        if (apple) apple.setAttribute('href', '/images/icons/apps-180.png');
        const t = document.title; document.title = 'تطبيقات سماك';
        try { sessionStorage.setItem('semak_hub', '1'); } catch (e) {}
        return () => {
            if (link && old) link.setAttribute('href', old);
            if (apple && appleOld) apple.setAttribute('href', appleOld);
            document.title = t;
        };
    }, []);

    const check = useCallback(async () => {
        const t = getAdminToken();
        if (!t) { setState('anon'); return; }
        try {
            const r = await fetch(`${API_URL}?action=me`, { headers: { Authorization: `Bearer ${t}` } }).then(x => x.json());
            const u = r.user || null;
            if (!u || !u.id) { setState('anon'); return; }
            let p = u.permissions;
            try { p = typeof p === 'string' ? JSON.parse(p || '[]') : (p || []); } catch { p = []; }
            setUser({ ...u, perms: p }); setState('ok');
        } catch { setState('anon'); }
    }, []);
    useEffect(() => { check(); }, [check]);

    const logout = () => { try { localStorage.removeItem(LS_ADMIN_JWT); } catch (e) {} setUser(null); setState('anon'); };

    if (isPhone() && !isStandalone()) return <BuyInstallGate />;
    if (state === 'loading') return (
        <div className="min-h-screen bg-[#0b1220] flex items-center justify-center"><RefreshCw className="animate-spin text-[#c5a059]" size={28} /></div>
    );
    if (state === 'anon') return <BuyLogin onDone={() => { setState('loading'); check(); }} />;
    if (user && parseInt(user.must_change_password ?? 0, 10) === 1)
        return <BuyChangePw onDone={() => { setState('loading'); check(); }} />;

    const mine = SEMAK_APPS.filter(a => canUse(a, user));
    const open = a => (a.web ? window.location.assign(a.path) : nav(a.path));

    return (
        <div dir="rtl" className="min-h-screen bg-[#0b1220] text-white font-cairo"
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
            <header className="relative overflow-hidden px-5 pt-6 pb-8 bg-gradient-to-bl from-[#2d5299] to-[#1a365d]">
                <img src="/images/pattern-semak.png" alt="" className="absolute inset-0 w-full h-full object-cover opacity-[.08]"
                    style={{ filter: 'invert(1)' }} onError={e => { e.currentTarget.style.display = 'none'; }} />
                <div className="relative flex items-start justify-between">
                    <div>
                        <div className="text-[12px] text-[#c5a059] font-bold">تطبيقات سماك</div>
                        <h1 className="text-[22px] font-black mt-1">{hello()}، {(user.name || '').split(' ')[0]}</h1>
                        <p className="text-[13px] text-white/70 mt-1">{mine.length} {mine.length === 1 ? 'تطبيق متاح' : 'تطبيقات متاحة'} لك</p>
                    </div>
                    <button onClick={logout} title="تسجيل الخروج" className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0"><LogOut size={16} /></button>
                </div>
            </header>

            <main className="relative z-10 px-4 -mt-4 max-w-3xl mx-auto">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {mine.map(a => (
                        <button key={a.slug} onClick={() => open(a)}
                            className="text-right rounded-3xl bg-[#111a2e] border border-white/10 p-4 active:scale-[.98] transition hover:border-white/25"
                            style={{ boxShadow: `inset 0 3px 0 ${a.color}` }}>
                            <img src={appIcon(a)} alt="" className="w-16 h-16 rounded-2xl shadow-xl" />
                            <div className="mt-3 font-black text-[15px] flex items-center gap-1">
                                {a.short}{a.web ? <Globe size={12} className="text-white/40" /> : null}
                            </div>
                            <div className="text-[11px] text-slate-400 leading-5 mt-0.5 min-h-[40px]">{a.desc}</div>
                            <div className="mt-2 text-[11px] font-bold flex items-center gap-0.5" style={{ color: a.color }}>افتح<ChevronLeft size={13} /></div>
                        </button>
                    ))}
                </div>

                <p className="text-center text-[11px] text-slate-600 mt-8">تظهر هنا التطبيقات التي تسمح بها صلاحياتك</p>
            </main>
        </div>
    );
}
