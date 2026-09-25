import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { LayoutGrid, ReceiptText, Plus, Wallet, Settings as Cog, PieChart, ChevronRight, LogOut, Languages, Fingerprint, ScanFace } from 'lucide-react';
import { call, token } from './lib/api';
import { useRoute, href, back } from './lib/router';
import { t, setLang, getLang } from './lib/i18n';
import { Spinner, ToastHost, Sheet, Btn, useToast } from './ui';
import { watchIdle, expired, touch } from './lib/idle';
import { pkSupported, pkHere, pkRegister, pkCancelled } from './lib/passkey';
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
import Profile from './screens/Profile';

// ─── البيانات المشتركة بين الشاشات ──────────────────────────────────────────
const DataCtx = createContext(null);
export const useData = () => useContext(DataCtx);

const NAV = [
    { k: '/',         t: 'الرئيسية',  icon: LayoutGrid },
    { k: '/txns',     t: 'الحركات',   icon: ReceiptText },
    { k: '/funds',    t: 'العُهد',    icon: Wallet },
    { k: '/budgets',  t: 'الميزانية', icon: PieChart },
    { k: '/settings', t: 'الإعدادات', icon: Cog },
];

export default function App() {
    const [state, setState] = useState('loading');   // loading | anon | setup | ok
    const [me, setMe] = useState(null);
    const [profile, setProfile] = useState({});
    const [logo, setLogo] = useState(null);
    const [flags, setFlags] = useState({});
    const [cats, setCats] = useState([]);
    const [funds, setFunds] = useState([]);
    const [noFund, setNoFund] = useState(null);   // حركاتٌ بلا عهدة: تُعرض لتُسكَّن
    const [lang, setL] = useState(getLang());
    const [reason, setReason] = useState('');      // سبب الخروج: idle
    const [askBio, setAskBio] = useState(false);

    // تبديل اللغة يعيد رسم التطبيق كلّه باتجاهه الجديد
    const changeLang = useCallback(async (l, persist) => {
        setLang(l); setL(l);
        if (persist) await call('profile_save', { body: { lang: l } });
    }, []);

    const reloadCats = useCallback(async () => { const r = await call('cats'); if (r.success) setCats(r.data); }, []);
    const reloadFunds = useCallback(async () => { const r = await call('funds'); if (r.success) { setFunds(r.data); setNoFund(r.no_fund || null); } }, []);
    const reloadMe = useCallback(async () => {
        const r = await call('me');
        if (!r.success) return false;
        setMe(r.user); setProfile(r.profile || {}); setLogo(r.logo_url || null);
        setFlags({ ai: r.ai, drive_linked: r.drive_linked, drive_configured: r.drive_configured });
        if (r.user.lang && r.user.lang !== getLang()) { setLang(r.user.lang); setL(r.user.lang); }
        return true;
    }, []);

    const boot = useCallback(async () => {
        if (!token.get()) {
            const s = await call('status');
            setState(s.needs_setup ? 'setup' : 'anon');
            return;
        }
        if (expired()) { token.clear(); setReason('idle'); setState('anon'); return; }
        if (!(await reloadMe())) { setState('anon'); return; }
        touch(true);
        await Promise.all([reloadCats(), reloadFunds()]);
        setState('ok');
    }, [reloadCats, reloadFunds, reloadMe]);

    useEffect(() => { boot(); }, [boot]);
    useEffect(() => {
        const f = () => { setMe(null); setState('anon'); };
        window.addEventListener('ohda:logout', f);
        return () => window.removeEventListener('ohda:logout', f);
    }, []);

    const logout = () => { token.clear(); setMe(null); setReason(''); setState('anon'); window.location.hash = '/'; };

    // الخروج التلقائي بعد المدّة المختارة بلا نشاط
    useEffect(() => {
        if (state !== 'ok') return undefined;
        return watchIdle(() => { token.clear(); setMe(null); setReason('idle'); setState('anon'); });
    }, [state]);

    // بعد الدخول بكلمة المرور على جهازٍ يدعم البصمة: عرضٌ واحد لتفعيلها
    const afterLogin = async info => {
        // دخولٌ جديد يبدأ عدّاد النشاط من الآن، وإلا عدّه الإقلاعُ منتهياً فأخرجه فوراً
        touch(true); setReason(''); setState('loading'); await boot();
        let dismissed = false;
        try { dismissed = localStorage.getItem('ohda_pk_ask') === 'no'; } catch (e) { /* تجاهل */ }
        if (info && info.via === 'password' && !pkHere() && !dismissed && await pkSupported()) setAskBio(true);
    };

    if (state === 'loading') return <div className="min-h-screen bg-paper"><Spinner className="pt-40" /></div>;
    if (state === 'anon' || state === 'setup')
        return (
            <ToastHost>
                <Login key={lang} setup={state === 'setup'} lang={lang} onLang={l => changeLang(l, false)} reason={reason}
                    onDone={afterLogin} />
            </ToastHost>
        );

    return (
        <ToastHost>
            <DataCtx.Provider value={{ me, profile, logo, flags, cats, funds, noFund, lang, changeLang, reloadCats, reloadFunds, reloadMe, logout, reboot: boot }}>
                <Shell key={lang} />
                <BioOffer open={askBio} onClose={() => setAskBio(false)} />
            </DataCtx.Provider>
        </ToastHost>
    );
}

// ─── عرض تفعيل البصمة بعد الدخول ────────────────────────────────────────────
function BioOffer({ open, onClose }) {
    const toast = useToast();
    const [busy, setBusy] = useState(false);
    const ios = /iPhone|iPad|Mac/.test(navigator.userAgent || '');
    const I = ios ? ScanFace : Fingerprint;
    const enable = async () => {
        setBusy(true);
        try { await pkRegister(); toast(t(ios ? 'فُعّل الدخول بـ Face ID' : 'فُعّل الدخول بالبصمة')); onClose(); }
        catch (e) { if (!pkCancelled(e)) toast(t(e.message || 'تعذّر التفعيل'), 'err'); }
        setBusy(false);
    };
    const later = () => { try { localStorage.setItem('ohda_pk_ask', 'no'); } catch (e) { /* تجاهل */ } onClose(); };
    return (
        <Sheet open={open} onClose={later} title={t(ios ? 'الدخول بـ Face ID' : 'الدخول بالبصمة')}>
            <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-brand-50 text-brand mx-auto flex items-center justify-center"><I size={32} /></div>
                <p className="text-[14px] text-ink-2 leading-7">{t('ادخل في المرّة القادمة بلمسةٍ واحدة بدل كلمة المرور. البصمة لا تغادر جهازك.')}</p>
                <Btn className="w-full !h-12" busy={busy} onClick={enable}>{t('فعّلها على هذا الجهاز')}</Btn>
                <button onClick={later} className="text-[13px] text-ink-3 font-semibold">{t('ليس الآن')}</button>
            </div>
        </Sheet>
    );
}

// ─── الإطار ─────────────────────────────────────────────────────────────────
function Shell() {
    const r = useRoute();
    const { me, logout, lang, changeLang, profile, logo } = useData();
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
    else if (p0 === 'profile') { screen = <Profile />; title = 'إعداد الحساب'; sub = true; }
    else if (p0 === 'budgets') { screen = <Budgets />; title = 'الميزانية'; }
    else if (p0 === 'settings') { screen = <Settings q={r.q} />; title = 'الإعدادات'; }
    else { screen = <Dashboard q={r.q} />; title = 'الرئيسية'; }

    const backTo = p0 === 'fund' && p2 === 'report' ? '/fund/' + p1 : p0 === 'statement' && r.q.fund ? '/fund/' + r.q.fund : p0 === 'profile' ? '/settings' : '/';
    const LangBtn = ({ className = '' }) => (
        <button onClick={() => changeLang(lang === 'en' ? 'ar' : 'en', true)} title={t('تغيير اللغة')}
            className={'h-9 px-2.5 rounded-xl text-[12px] font-bold text-ink-2 hover:bg-paper-2 flex items-center gap-1.5 ' + className}>
            <Languages size={15} />{lang === 'en' ? 'عربي' : 'EN'}
        </button>
    );

    return (
        <div className="min-h-screen bg-paper text-ink lg:flex print:bg-white print:min-h-0 print:block">
            {/* ── الشريط الجانبي (الشاشة الكبيرة) ── */}
            <aside className="hidden lg:flex no-print flex-col w-64 shrink-0 h-screen sticky top-0 border-e border-paper-2 bg-paper-card px-4 py-6">
                <a href="#/profile" className="flex items-center gap-2.5 px-2 mb-8">
                    <img src={logo || './icon-192.png'} alt="" className="w-9 h-9 rounded-xl object-contain bg-white" />
                    <div className="min-w-0">
                        <div className="font-bold text-[17px] leading-5 truncate">{(lang === 'en' && profile.org_name_en) || profile.org_name || t('عُهدة')}</div>
                        <div className="text-[11px] text-ink-3 truncate">{me.name}</div>
                    </div>
                </a>
                <a href={href('/txn/new', { type: 'out' })}
                    className="h-11 rounded-xl bg-brand text-white font-semibold text-[14px] flex items-center justify-center gap-2 hover:bg-brand-700 mb-2">
                    <Plus size={18} />{t('مصروف جديد')}
                </a>
                <a href={href('/txn/new', { type: 'in' })}
                    className="h-10 rounded-xl bg-brand-50 text-brand-700 font-semibold text-[13px] flex items-center justify-center gap-2 hover:bg-brand-100 mb-6">
                    {t('استلام مبلغ')}
                </a>
                <nav className="space-y-1 flex-1">
                    {NAV.map(n => {
                        const I = n.icon, on = top === n.k || (n.k === '/funds' && p0 === 'fund') || (n.k === '/txns' && p0 === 'txn') || (n.k === '/settings' && p0 === 'profile');
                        return (
                            <a key={n.k} href={'#' + n.k}
                                className={'flex items-center gap-3 h-11 px-3 rounded-xl text-[14px] font-semibold transition ' +
                                    (on ? 'bg-brand-50 text-brand-700' : 'text-ink-2 hover:bg-paper')}>
                                <I size={18} />{t(n.t)}
                            </a>
                        );
                    })}
                </nav>
                <LangBtn className="self-start mb-1" />
                <button onClick={logout} className="flex items-center gap-3 h-10 px-3 rounded-xl text-[13px] text-ink-3 hover:bg-paper">
                    <LogOut size={16} className="ltr:rotate-180" />{t('خروج')}
                </button>
            </aside>

            <div className="flex-1 min-w-0">
                {/* ── الترويسة ── */}
                <header className="no-print sticky top-0 z-30 bg-paper/90 backdrop-blur border-b border-paper-2 lg:border-0 lg:bg-transparent lg:backdrop-blur-0 lg:static"
                    style={{ paddingTop: 'env(safe-area-inset-top)' }}>
                    <div className="h-14 px-4 lg:px-8 lg:h-16 flex items-center gap-2 max-w-6xl mx-auto">
                        {sub ? (
                            <button onClick={() => back(backTo)}
                                className="w-10 h-10 -me-1 rounded-xl hover:bg-paper-2 flex items-center justify-center text-ink-2" aria-label={t('رجوع')}>
                                <ChevronRight size={22} className="ltr:rotate-180" />
                            </button>
                        ) : (
                            <img src={logo || './icon-192.png'} alt="" className="w-8 h-8 rounded-lg lg:hidden object-contain bg-white" />
                        )}
                        <h1 className="font-bold text-[17px] lg:text-[22px] flex-1 truncate">{t(title)}</h1>
                        {!sub ? <LangBtn className="lg:hidden" /> : null}
                    </div>
                </header>

                <main className={'max-w-6xl mx-auto px-4 lg:px-8 ' + (sub ? 'pb-10' : 'pb-28 lg:pb-12')}>{screen}</main>
            </div>

            {/* ── شريط التبويبات (الجوّال) ── */}
            {!sub ? (
                <nav className="no-print lg:hidden fixed bottom-0 inset-x-0 z-40 bg-paper-card/95 backdrop-blur border-t border-paper-2"
                    style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
                    <div className="grid grid-cols-5 h-[60px] items-center">
                        {[NAV[0], NAV[1], null, NAV[2], NAV[4]].map(n => {
                            if (!n) return (
                                <a key="add" href={href('/txn/new', { type: 'out' })} aria-label={t('مصروف جديد')}
                                    className="mx-auto -mt-7 w-14 h-14 rounded-2xl bg-brand text-white flex items-center justify-center shadow-lg shadow-brand/30 active:scale-95 transition">
                                    <Plus size={26} />
                                </a>
                            );
                            const I = n.icon, on = top === n.k || (n.k === '/funds' && p0 === 'fund') || (n.k === '/txns' && p0 === 'txn');
                            return (
                                <a key={n.k} href={'#' + n.k}
                                    className={'flex flex-col items-center justify-center gap-0.5 text-[10.5px] font-semibold ' + (on ? 'text-brand' : 'text-ink-3')}>
                                    <I size={20} />{t(n.t)}
                                </a>
                            );
                        })}
                    </div>
                </nav>
            ) : null}
        </div>
    );
}
