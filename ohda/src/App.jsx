import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { LayoutGrid, ReceiptText, Plus, Wallet, Settings as Cog, PieChart, ChevronRight, LogOut } from 'lucide-react';
import { call, token } from './lib/api';
import { useRoute, href, back } from './lib/router';
import { Spinner, ToastHost } from './ui';
import Login from './screens/Login';
import Dashboard from './screens/Dashboard';
import Txns from './screens/Txns';
import TxnForm from './screens/TxnForm';
import Funds from './screens/Funds';
import FundView from './screens/FundView';
import FundReport from './screens/FundReport';
import Budgets from './screens/Budgets';
import Settings from './screens/Settings';
import Statement from './screens/Statement';

// ─── البيانات المشتركة بين الشاشات ──────────────────────────────────────────
const DataCtx = createContext(null);
export const useData = () => useContext(DataCtx);

const NAV = [
    { k: '/',        t: 'الرئيسية',  icon: LayoutGrid },
    { k: '/txns',    t: 'الحركات',   icon: ReceiptText },
    { k: '/funds',   t: 'العُهد',    icon: Wallet },
    { k: '/budgets', t: 'الميزانية', icon: PieChart },
    { k: '/settings', t: 'الإعدادات', icon: Cog },
];

export default function App() {
    const [state, setState] = useState('loading');   // loading | anon | setup | ok
    const [me, setMe] = useState(null);
    const [flags, setFlags] = useState({});
    const [cats, setCats] = useState([]);
    const [funds, setFunds] = useState([]);

    const reloadCats = useCallback(async () => { const r = await call('cats'); if (r.success) setCats(r.data); }, []);
    const reloadFunds = useCallback(async () => { const r = await call('funds'); if (r.success) setFunds(r.data); }, []);

    const boot = useCallback(async () => {
        if (!token.get()) {
            const s = await call('status');
            setState(s.needs_setup ? 'setup' : 'anon');
            return;
        }
        const r = await call('me');
        if (!r.success) { setState('anon'); return; }
        setMe(r.user);
        setFlags({ ai: r.ai, drive_linked: r.drive_linked, drive_configured: r.drive_configured });
        await Promise.all([reloadCats(), reloadFunds()]);
        setState('ok');
    }, [reloadCats, reloadFunds]);

    useEffect(() => { boot(); }, [boot]);
    useEffect(() => {
        const f = () => { setMe(null); setState('anon'); };
        window.addEventListener('ohda:logout', f);
        return () => window.removeEventListener('ohda:logout', f);
    }, []);

    const logout = () => { token.clear(); setMe(null); setState('anon'); window.location.hash = '/'; };

    if (state === 'loading') return <div className="min-h-screen bg-paper"><Spinner className="pt-40" /></div>;
    if (state === 'anon' || state === 'setup')
        return <ToastHost><Login setup={state === 'setup'} onDone={() => { setState('loading'); boot(); }} /></ToastHost>;

    return (
        <ToastHost>
            <DataCtx.Provider value={{ me, flags, cats, funds, reloadCats, reloadFunds, logout, reboot: boot }}>
                <Shell />
            </DataCtx.Provider>
        </ToastHost>
    );
}

// ─── الإطار ─────────────────────────────────────────────────────────────────
function Shell() {
    const r = useRoute();
    const { me, logout } = useData();
    const [p0, p1, p2] = r.parts;
    const top = '/' + (p0 || '');

    let screen, title = '', sub = false;
    if (!p0) { screen = <Dashboard q={r.q} />; title = 'الرئيسية'; }
    else if (p0 === 'txns') { screen = <Txns q={r.q} />; title = 'الحركات'; }
    else if (p0 === 'txn') { screen = <TxnForm id={p1 === 'new' ? 0 : Number(p1)} q={r.q} />; title = p1 === 'new' ? (r.q.type === 'in' ? 'استلام مبلغ' : 'مصروف جديد') : 'تفاصيل الحركة'; sub = true; }
    else if (p0 === 'funds') { screen = <Funds />; title = 'العُهد'; }
    else if (p0 === 'fund' && p2 === 'report') { screen = <FundReport id={Number(p1)} />; title = 'تقرير التصفية'; sub = true; }
    else if (p0 === 'fund') { screen = <FundView id={Number(p1)} />; title = 'كشف العهدة'; sub = true; }
    else if (p0 === 'statement') { screen = <Statement q={r.q} />; title = 'كشف حساب'; sub = true; }
    else if (p0 === 'budgets') { screen = <Budgets />; title = 'الميزانية'; }
    else if (p0 === 'settings') { screen = <Settings q={r.q} />; title = 'الإعدادات'; }
    else { screen = <Dashboard q={r.q} />; title = 'الرئيسية'; }


    return (
        <div className="min-h-screen bg-paper text-ink lg:flex print:bg-white print:min-h-0 print:block">
            {/* ── الشريط الجانبي (الشاشة الكبيرة) ── */}
            <aside className="hidden lg:flex no-print flex-col w-64 shrink-0 h-screen sticky top-0 border-l border-paper-2 bg-paper-card px-4 py-6">
                <div className="flex items-center gap-2.5 px-2 mb-8">
                    <img src="./icon-192.png" alt="" className="w-9 h-9 rounded-xl" />
                    <div>
                        <div className="font-bold text-[17px] leading-5">عُهدة</div>
                        <div className="text-[11px] text-ink-3">{me.name}</div>
                    </div>
                </div>
                <a href={href('/txn/new', { type: 'out' })}
                    className="h-11 rounded-xl bg-brand text-white font-semibold text-[14px] flex items-center justify-center gap-2 hover:bg-brand-700 mb-2">
                    <Plus size={18} />مصروف جديد
                </a>
                <a href={href('/txn/new', { type: 'in' })}
                    className="h-10 rounded-xl bg-brand-50 text-brand-700 font-semibold text-[13px] flex items-center justify-center gap-2 hover:bg-brand-100 mb-6">
                    استلام مبلغ
                </a>
                <nav className="space-y-1 flex-1">
                    {NAV.map(n => {
                        const I = n.icon, on = top === n.k || (n.k === '/funds' && p0 === 'fund') || (n.k === '/txns' && p0 === 'txn');
                        return (
                            <a key={n.k} href={'#' + n.k}
                                className={'flex items-center gap-3 h-11 px-3 rounded-xl text-[14px] font-semibold transition ' +
                                    (on ? 'bg-brand-50 text-brand-700' : 'text-ink-2 hover:bg-paper')}>
                                <I size={18} />{n.t}
                            </a>
                        );
                    })}
                </nav>
                <button onClick={logout} className="flex items-center gap-3 h-10 px-3 rounded-xl text-[13px] text-ink-3 hover:bg-paper">
                    <LogOut size={16} />خروج
                </button>
            </aside>

            <div className="flex-1 min-w-0">
                {/* ── الترويسة ── */}
                <header className="no-print sticky top-0 z-30 bg-paper/90 backdrop-blur border-b border-paper-2 lg:border-0 lg:bg-transparent lg:backdrop-blur-0 lg:static"
                    style={{ paddingTop: 'env(safe-area-inset-top)' }}>
                    <div className="h-14 px-4 lg:px-8 lg:h-16 flex items-center gap-2 max-w-6xl mx-auto">
                        {sub ? (
                            <button onClick={() => back(p0 === 'fund' && p2 === 'report' ? '/fund/' + p1 : p0 === 'statement' && r.q.fund ? '/fund/' + r.q.fund : '/')}
                                className="w-10 h-10 -me-1 rounded-xl hover:bg-paper-2 flex items-center justify-center text-ink-2" aria-label="رجوع">
                                <ChevronRight size={22} />
                            </button>
                        ) : (
                            <img src="./icon-192.png" alt="" className="w-8 h-8 rounded-lg lg:hidden" />
                        )}
                        <h1 className="font-bold text-[17px] lg:text-[22px] flex-1 truncate">{title}</h1>
                        {!sub ? <span className="lg:hidden text-[12px] text-ink-3 truncate max-w-[40%]">{me.name}</span> : null}
                    </div>
                </header>

                <main className={'max-w-6xl mx-auto px-4 lg:px-8 ' + (sub ? 'pb-10' : 'pb-28 lg:pb-12')}>{screen}</main>
            </div>

            {/* ── شريط التبويبات (الجوّال) ── */}
            {!sub ? (
                <nav className="no-print lg:hidden fixed bottom-0 inset-x-0 z-40 bg-paper-card/95 backdrop-blur border-t border-paper-2"
                    style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                    <div className="grid grid-cols-5 h-[60px] items-center">
                        {[NAV[0], NAV[1], null, NAV[2], NAV[4]].map((n, i) => {
                            if (!n) return (
                                <a key="add" href={href('/txn/new', { type: 'out' })} aria-label="مصروف جديد"
                                    className="mx-auto -mt-7 w-14 h-14 rounded-2xl bg-brand text-white flex items-center justify-center shadow-lg shadow-brand/30 active:scale-95 transition">
                                    <Plus size={26} />
                                </a>
                            );
                            const I = n.icon, on = top === n.k || (n.k === '/funds' && p0 === 'fund') || (n.k === '/txns' && p0 === 'txn');
                            return (
                                <a key={n.k} href={'#' + n.k}
                                    className={'flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold ' + (on ? 'text-brand' : 'text-ink-3')}>
                                    <I size={20} />{n.t}
                                </a>
                            );
                        })}
                    </div>
                </nav>
            ) : null}
        </div>
    );
}
