import React, { useState, useEffect, useCallback } from 'react';
import { ListChecks, Video, PenTool, FileText, LogOut, RefreshCw } from 'lucide-react';
import { API_URL, getAdminToken, LS_ADMIN_JWT } from '../../lib/api/client';
import MeetAgenda from './MeetAgenda';
import MeetCall from './MeetCall';
import MeetBoard from './MeetBoard';
import MeetMinutes from './MeetMinutes';
import BuyLogin from '../buy/BuyLogin';
import BuyChangePw from '../buy/BuyChangePw';
import HubButton from '../../components/HubButton';

// ─── تطبيق غرفة الاجتماعات للجوال — بثوب تطبيق المشتريات نفسه ───────────────
const TABS = [
    { k: 'agenda',  t: 'الاجتماع', icon: ListChecks },
    { k: 'call',    t: 'المكالمة', icon: Video },
    { k: 'board',   t: 'السبورة',  icon: PenTool },
    { k: 'minutes', t: 'المحاضر',  icon: FileText },
];

// بطاقة تعريف مستقلة حتى يظهر التطبيق باسمه وأيقونته على الشاشة الرئيسية
function useMeetManifest() {
    useEffect(() => {
        const prev = document.querySelector('link[rel="manifest"]');
        const prevHref = prev ? prev.getAttribute('href') : null;
        if (prev) prev.setAttribute('href', '/meet.webmanifest');
        const title = document.title;
        document.title = 'غرفة اجتماعات سماك';
        const metas = [];
        const setMeta = (name, content) => {
            let m = document.querySelector('meta[name="' + name + '"]');
            const created = !m;
            if (!m) { m = document.createElement('meta'); m.name = name; document.head.appendChild(m); }
            metas.push({ el: m, created, old: m.content });
            m.content = content;
        };
        setMeta('apple-mobile-web-app-title', 'اجتماعات سماك');
        setMeta('apple-mobile-web-app-capable', 'yes');
        setMeta('apple-mobile-web-app-status-bar-style', 'black-translucent');
        setMeta('theme-color', '#1a365d');
        const apple = document.querySelector('link[rel="apple-touch-icon"]');
        const appleOld = apple ? apple.getAttribute('href') : null;
        if (apple) apple.setAttribute('href', '/images/icons/meet-180.png');
        return () => {
            if (prev && prevHref) prev.setAttribute('href', prevHref);
            if (apple && appleOld) apple.setAttribute('href', appleOld);
            document.title = title;
            metas.forEach(m => { if (m.created) m.el.remove(); else m.el.content = m.old; });
        };
    }, []);
}

export default function MeetApp() {
    // التبويب يُحفظ فيبقى المستخدم مكانه بعد تحديث الصفحة أو السحب للتحديث
    const [tab, setTab] = useState(() => {
        try { return sessionStorage.getItem('meet_tab') || 'agenda'; } catch (e) { return 'agenda'; }
    });
    useEffect(() => { try { sessionStorage.setItem('meet_tab', tab); } catch (e) {} }, [tab]);

    const [user, setUser]   = useState(null);
    const [state, setState] = useState('loading');   // loading | ok | denied | anon
    const [meeting, setMeeting] = useState(null);
    const [callOn, setCallOn] = useState(false);
    useEffect(() => { if (tab === 'call') setCallOn(true); }, [tab]);
    useMeetManifest();

    const check = useCallback(async () => {
        const t = getAdminToken();
        if (!t) { setState('anon'); return; }
        try {
            const r = await fetch(`${API_URL}?action=me`, { headers: { Authorization: `Bearer ${t}` } }).then(x => x.json());
            const u = r.user || r.data || r;
            if (!u || !u.id) { setState('anon'); return; }
            let perms = u.permissions;
            try { perms = typeof perms === 'string' ? JSON.parse(perms || '[]') : (perms || []); } catch { perms = []; }
            setUser({ ...u, perms });
            setState('ok');                           // غرفة الاجتماعات لكل موظّف له حساب
        } catch { setState('anon'); }
    }, []);
    useEffect(() => { check(); }, [check]);

    const logout = () => {
        try { localStorage.removeItem(LS_ADMIN_JWT); } catch (e) {}
        setUser(null); setState('anon');
    };

    if (state === 'loading') return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center">
            <RefreshCw className="animate-spin text-gold-500" size={28} />
        </div>
    );
    if (state === 'anon') return <BuyLogin onDone={() => { setState('loading'); check(); }} />;
    if (user && parseInt(user.must_change_password ?? 0, 10) === 1)
        return <BuyChangePw onDone={() => { setState('loading'); check(); }} />;

    const boardId = 'mtg-' + (meeting ? meeting.id : 0);

    return (
        <div dir="rtl" className="min-h-screen bg-[#0b1220] text-white font-cairo flex flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <header className="px-4 pb-3 bg-gradient-to-l from-[#1a365d] to-[#2d5299] sticky top-0 z-20"
                style={{ paddingTop: 'calc(env(safe-area-inset-top) + 16px)' }}>
                <div className="flex items-center justify-between">
                    <div className="min-w-0">
                        <div className="text-[11px] text-white/60 font-bold">غرفة اجتماعات سماك</div>
                        <div className="font-black truncate">{meeting ? meeting.title : (user?.name || 'الاجتماع الدوري')}</div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0"><HubButton />
                    <button onClick={logout} className="w-11 h-11 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                        <LogOut size={16} />
                    </button></div>
                </div>
            </header>

            <main className={'flex-1 min-h-0 relative ' + (tab === 'board' ? 'overflow-hidden' : 'overflow-y-auto pb-24')}>
                {tab === 'agenda'  && <MeetAgenda userName={user?.name || ''} onMeeting={setMeeting} />}
                {/* المكالمة تبقى حيّة خلف التبويبات: تُخفى ولا تُهدم، فالانتقال للسبورة لا يقطعها */}
                {callOn && <div className={tab === 'call' ? '' : 'hidden'}><MeetCall active={tab === 'call'} userName={user?.name || ''} userEmail={user?.email || ''}
                                          meetingTitle={meeting ? meeting.title : ''}
                                          meetingId={meeting ? meeting.id : 0} meeting={meeting} dense /></div>}
                {/* صندوقٌ مموضَع ينتهي فوق شريط التبويبات، فتملؤه السبورة ولا تختفي أدواتها تحته */}
                {tab === 'board'   && (
                    <div className="absolute inset-x-0 top-0" style={{ bottom: 'calc(58px + env(safe-area-inset-bottom))' }}>
                        <MeetBoard boardId={boardId} userName={user?.name || ''} dense />
                    </div>
                )}
                {tab === 'minutes' && <MeetMinutes />}
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
