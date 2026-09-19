import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Settings as Cog, Home as HomeIcon, ChevronRight, Radio } from 'lucide-react';
import { call, token } from './lib/api';
import { useRoute, back } from './lib/router';
import { Spinner, ToastHost } from './ui';
import Login from './screens/Login';
import Home from './screens/Home';
import MemberView from './screens/MemberView';
import Record from './screens/Record';
import Settings from './screens/Settings';
import MushafView from './screens/MushafView';
import Session from './screens/Session';

// ─── البيانات المشتركة بين الشاشات ──────────────────────────────────────────
const DataCtx = createContext(null);
export const useData = () => useContext(DataCtx);

export default function App() {
    const [state, setState] = useState('loading');   // loading | anon | setup | ok
    const [me, setMe] = useState(null);
    const [family, setFamily] = useState(null);
    const [sup, setSup] = useState(false);
    const [members, setMembers] = useState([]);

    const reloadMembers = useCallback(async () => { const r = await call('members'); if (r.success) setMembers(r.data); return r; }, []);
    const boot = useCallback(async () => {
        if (!token.get()) { const s = await call('status'); setState(s.needs_setup ? 'setup' : 'anon'); return; }
        const r = await call('me');
        if (!r.success) { setState('anon'); return; }
        setMe(r.user); setFamily(r.family); setSup(!!r.sup);
        await reloadMembers();
        setState('ok');
    }, [reloadMembers]);

    useEffect(() => { boot(); }, [boot]);
    useEffect(() => {
        const f = () => { setMe(null); setState('anon'); };
        window.addEventListener('alwah:logout', f);
        return () => window.removeEventListener('alwah:logout', f);
    }, []);

    const logout = () => { token.clear(); setMe(null); setState('anon'); window.location.hash = '/'; };

    if (state === 'loading') return <div className="min-h-screen bg-paper"><Spinner className="pt-40" /></div>;
    if (state === 'anon' || state === 'setup')
        return <ToastHost><Login setup={state === 'setup'} onDone={() => { setState('loading'); boot(); }} /></ToastHost>;

    return (
        <ToastHost>
            <DataCtx.Provider value={{ me, family, sup, members, reloadMembers, logout, reboot: boot, setFamily }}>
                <Shell />
            </DataCtx.Provider>
        </ToastHost>
    );
}

function Shell() {
    const r = useRoute();
    const { me, sup, members } = useData();
    const p = r.parts;

    // الفرد الذي يرى نفسه فقط: صفحته هي الرئيسية
    const solo = !sup && me.member_id;
    let page;
    if (p[0] === 'm' && p[1] && p[2] === 'log') page = <Record id={+p[1]} d={r.q.d} />;
    else if (p[0] === 'm' && p[1] && p[2] === 'mushaf') page = <MushafView key={p[1]} id={+p[1]} p={r.q.p} />;
    else if (p[0] === 'session') page = <Session />;
    else if (p[0] === 'm' && p[1]) page = <MemberView id={+p[1]} />;
    else if (p[0] === 'settings') page = <Settings />;
    else page = solo ? <MemberView id={me.member_id} /> : <Home />;

    const top = p.length === 0 || (solo && p[0] === 'm' && +p[1] === me.member_id && !p[2]);
    return (
        <div className="min-h-screen bg-paper" dir="rtl">
            <header className="sticky top-0 z-30 bg-paper/90 backdrop-blur border-b border-paper-2"
                style={{ paddingTop: 'env(safe-area-inset-top)' }}>
                <div className="max-w-3xl mx-auto h-14 px-4 flex items-center gap-2">
                    {!top ? (
                        <button onClick={() => back('/')} className="w-10 h-10 -ms-2 rounded-xl flex items-center justify-center text-ink-2 hover:bg-paper-2" aria-label="رجوع">
                            <ChevronRight size={22} />
                        </button>
                    ) : null}
                    <a href="#/" className="flex items-center gap-2 flex-1 min-w-0">
                        <img src="./icon-192.png" alt="" className="w-8 h-8 rounded-lg" />
                        <span className="font-bold text-ink">ألواح</span>
                        {members.length > 1 && sup ? <span className="text-[12px] text-ink-3 truncate">· {members.length} أفراد</span> : null}
                    </a>
                    {p[0] !== '' && p.length ? <a href="#/" className="w-10 h-10 rounded-xl flex items-center justify-center text-ink-2 hover:bg-paper-2" aria-label="الرئيسية"><HomeIcon size={19} /></a> : null}
                    <a href="#/session" className={'w-10 h-10 rounded-xl flex items-center justify-center hover:bg-paper-2 ' + (p[0] === 'session' ? 'text-brand' : 'text-ink-2')} aria-label="جلسة الذكر" title="جلسة الذكر"><Radio size={19} /></a>
                    <a href="#/settings" className={'w-10 h-10 rounded-xl flex items-center justify-center hover:bg-paper-2 ' + (p[0] === 'settings' ? 'text-brand' : 'text-ink-2')} aria-label="الإعدادات"><Cog size={19} /></a>
                </div>
            </header>
            <main className="max-w-3xl mx-auto px-4 pt-4 pb-16" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 64px)' }}>
                {page}
            </main>
        </div>
    );
}
