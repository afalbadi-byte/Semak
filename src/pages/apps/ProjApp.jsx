import React, { useState, useEffect, useCallback } from 'react';
import { Home, Building2, FileText, Bot, RefreshCw, ChevronLeft, Wallet } from 'lucide-react';
import { API_URL, getAdminToken } from '../../lib/api/client';
import AppShell from './AppShell';
import BuyEntity from '../buy/BuyEntity';
import BuyRecords from '../buy/BuyRecords';
import BuyChat from '../buy/BuyChat';
import { useDepthGuard } from '../../lib/backstack';
import { syncDaftra } from '../../lib/sync';

const money = v => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const auth = () => { const t = getAdminToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };

const TABS = [
    { k: 'home',    t: 'المشاريع', icon: Home },
    { k: 'units',   t: 'الوحدات',  icon: Building2 },
    { k: 'records', t: 'السجلات',  icon: FileText },
    { k: 'chat',    t: 'المساعد',  icon: Bot },
];

// ─── تطبيق المشاريع ─────────────────────────────────────────────────────────
export default function ProjApp() {
    return (
        <AppShell appKey="proj" title="مشاريع سماك" tabs={TABS}
            perms={['projects', 'finance', 'accounting', 'units']} manifest="/proj.webmanifest">
            {(tab, user) => (
                <>
                    {tab === 'home'    && <Projects />}
                    {tab === 'units'   && <Units />}
                    {tab === 'records' && <BuyRecords />}
                    {tab === 'chat'    && <BuyChat userName={user?.name || ''} />}
                </>
            )}
        </AppShell>
    );
}

function Projects() {
    const [rows, setRows] = useState([]);
    const [busy, setBusy] = useState(false);
    const [stack, setStack] = useState([]);

    const load = useCallback(async (force = false) => {
        setBusy(true);
        try {
            await syncDaftra({ force });   // الأرقام تُبنى على أحدث ما في دفترة
            const r = await fetch(`${API_URL}?action=pbudget_list`, { headers: auth() }).then(x => x.json());
            setRows(r.data || []);
        } catch { setRows([]); }
        finally { setBusy(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const open = (type, value) => setStack(s => s.concat({ type, value }));
    const back = () => setStack(s => s.slice(0, -1));
    useDepthGuard(stack.length, back);

    if (stack.length) {
        const top = stack[stack.length - 1];
        return <BuyEntity key={top.type + top.value} type={top.type} value={top.value} onOpen={open} onBack={back} />;
    }

    return (
        <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
                <h2 className="font-black text-[15px]">المشاريع ونسب الإنجاز</h2>
                <button onClick={() => load(true)} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <RefreshCw size={16} className={busy ? 'animate-spin' : ''} />
                </button>
            </div>

            {rows.map(p => {
                const pct  = p.pct == null ? null : Number(p.pct);
                const over = pct != null && pct > 100;
                const near = pct != null && pct > 85 && pct <= 100;
                const bar  = over ? 'bg-red-500' : near ? 'bg-amber-500' : 'bg-emerald-500';
                return (
                    <button key={p.project_id} onClick={() => open('project', p.project_id)}
                        className="w-full text-right rounded-2xl bg-white/[0.05] border border-white/10 p-3.5 active:bg-white/10">
                        <div className="flex items-center justify-between gap-2">
                            <div className="font-black text-[15px]">{p.name}</div>
                            <div className={'text-[20px] font-black ' + (over ? 'text-red-400' : 'text-[#c5a059]')}>
                                {pct == null ? '—' : pct + '%'}
                            </div>
                        </div>
                        <div className="h-2 rounded-full bg-white/10 mt-2 overflow-hidden">
                            <div className={'h-full ' + bar} style={{ width: Math.min(100, pct || 0) + '%' }} />
                        </div>
                        <div className="text-[11px] text-slate-400 mt-2">
                            إنفاق {money(p.spent)} من {money(p.budget)} · متبقٍ {money(p.remaining)}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                            {p.invoices} فاتورة · {p.ptype === 'contracting' ? 'مقاولات' : 'تطوير'}
                            {Number(p.supervision) > 0 ? ` · إشراف ${money(p.supervision)}` : ''}
                            <ChevronLeft size={13} className="mr-auto text-slate-600" />
                        </div>
                    </button>
                );
            })}
            {!rows.length && !busy && <p className="text-center text-slate-500 text-sm py-8">لا مشاريع</p>}
        </div>
    );
}

function Units() {
    const [rows, setRows]   = useState([]);
    const [owners, setOwn]  = useState([]);
    const [busy, setBusy]   = useState(false);
    const [stack, setStack] = useState([]);

    const load = useCallback(async () => {
        setBusy(true);
        try {
            const r = await fetch(`${API_URL}?action=kpi_detail&key=units_available`, { headers: auth() }).then(x => x.json());
            setRows(r.rows || []);
            const o = await fetch(`${API_URL}?action=get_owners`).then(x => x.json());
            setOwn(o.data || []);
        } catch { setRows([]); }
        finally { setBusy(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const open = (type, value) => setStack(s => s.concat({ type, value }));
    const back = () => setStack(s => s.slice(0, -1));
    useDepthGuard(stack.length, back);

    if (stack.length) {
        const top = stack[stack.length - 1];
        return <BuyEntity key={top.type + top.value} type={top.type} value={top.value} onOpen={open} onBack={back} />;
    }

    const sold = rows.filter(r => String(r.status).includes('مباع')).length;
    const held = rows.filter(r => String(r.status).includes('محجوز')).length;

    return (
        <div className="p-4 space-y-3">
            <div className="grid grid-cols-3 gap-2">
                {[['الوحدات', rows.length], ['مباعة', sold], ['محجوزة', held]].map(([t, v]) => (
                    <div key={t} className="rounded-xl bg-white/[0.06] border border-white/10 p-3 text-center">
                        <div className="text-[19px] font-black">{v}</div>
                        <div className="text-[11px] text-slate-400">{t}</div>
                    </div>
                ))}
            </div>

            {rows.map(u => {
                const own = owners.find(o => o.unit_code === u.unit_code);
                const s = String(u.status || 'متاح');
                const color = s.includes('مباع') ? 'text-emerald-300 bg-emerald-500/15'
                    : s.includes('محجوز') ? 'text-amber-300 bg-amber-500/15' : 'text-sky-300 bg-sky-500/15';
                return (
                    <button key={u.unit_code} onClick={() => open('unit', u.unit_code)}
                        className="w-full text-right rounded-xl bg-white/[0.05] border border-white/10 p-3 active:bg-white/10">
                        <div className="flex items-center justify-between gap-2">
                            <span className="font-black text-[14px]">{u.unit_code}</span>
                            <span className={'text-[11px] font-bold px-2 py-1 rounded-lg ' + color}>{s}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 mt-1">
                            {own ? own.owner_name : 'بلا مالك مسجّل'}{own && own.owner_phone ? ' · ' + own.owner_phone : ''}
                        </div>
                    </button>
                );
            })}
            {!rows.length && !busy && <p className="text-center text-slate-500 text-sm py-8">لا وحدات</p>}
        </div>
    );
}
