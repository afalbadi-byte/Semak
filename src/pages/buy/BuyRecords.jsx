import React, { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, Paperclip, ChevronLeft, Wallet, ShieldCheck, ShieldAlert } from 'lucide-react';
import { API_URL, getAdminToken } from '../../lib/api/client';
import BuyEntity from './BuyEntity';
import BuyReturns from './BuyReturns';
import { SortBar } from '../../components/SortHeader';
import { useDepthGuard } from '../../lib/backstack';
import { syncDaftra } from '../../lib/sync';

const money = v => Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const short = v => Number(v || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
const auth = () => { const t = getAdminToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };

// ─── السجلات: الفواتير والموردون، وكل صف يفتح بطاقته ────────────────────────
export default function BuyRecords() {
    const [tab, setTab]     = useState('invoices');
    const [q, setQ]         = useState('');
    const [rows, setRows]   = useState([]);
    const [sum, setSum]     = useState(null);
    const [busy, setBusy]   = useState(false);
    const [filter, setFilter] = useState('');        // '' | unpaid | no_docs | daftra_doc
    const [stack, setStack] = useState([]);          // مكدس البطاقات المفتوحة
    const [sortKey, setSortKey] = useState('date');
    const [sortDir, setSortDir] = useState('desc');
    const [more, setMore] = useState(false);
    const [proof, setProof] = useState(null);        // تدقيق إثباتات الدفعات
    const [onlyGap, setOnlyGap] = useState(true);
    const view = rows;
    // تبويب الدفعات مستقل: يقرأ تدقيق الإثباتات لا قائمة الفواتير
    useEffect(() => {
        if (tab !== 'payments') return;
        let live = true;
        setBusy(true);
        fetch(`${API_URL}?action=pay_proofs${onlyGap ? '&only=missing' : ''}`, { headers: auth() })
            .then(r => r.json())
            .then(r => { if (live && r.success) setProof(r); })
            .catch(() => {})
            .finally(() => live && setBusy(false));
        return () => { live = false; };
    }, [tab, onlyGap]);

    const SORTS = tab === 'invoices'
        ? [{ k: 'date', t: 'التاريخ' }, { k: 'gross', t: 'المبلغ' }, { k: 'remaining', t: 'المتبقي' },
           { k: 'supplier', t: 'المورد' }, { k: 'no', t: 'رقم الفاتورة' }, { k: 'docs', t: 'المستندات' }]
        : [{ k: 'gross', t: 'القيمة' }, { k: 'invoices', t: 'عدد الفواتير' }, { k: 'outstanding', t: 'المتبقي' },
           { k: 'last_date', t: 'آخر تعامل' }, { k: 'name', t: 'الاسم' }];

    const PAGE = 40;
    const load = useCallback(async (append = false, force = false) => {
        setBusy(true);
        try {
            if (!append) await syncDaftra({ force });
            const extra  = filter ? `&${filter}=1` : '';
            const offset = append ? rows.length : 0;
            const r = await fetch(`${API_URL}?action=buy_list&kind=${tab}&q=${encodeURIComponent(q)}`
                + `&limit=${PAGE}&offset=${offset}&sort=${sortKey}&dir=${sortDir}${extra}`,
                { headers: auth() }).then(x => x.json());
            const got = r.data || [];
            setRows(prev => (append ? prev.concat(got) : got));
            if (r.summary) setSum(r.summary);
            setMore(got.length === PAGE);
        } catch { if (!append) setRows([]); }
        finally { setBusy(false); }
    }, [tab, q, filter, sortKey, sortDir, rows.length]);

    useEffect(() => { if (tab !== 'returns') load(false); }, [tab, filter, sortKey, sortDir]);   // eslint-disable-line react-hooks/exhaustive-deps

    const open = (type, value) => setStack(s => s.concat({ type, value }));
    const back = () => setStack(s => s.slice(0, -1));
    useDepthGuard(stack.length, back);

    if (stack.length) {
        const top = stack[stack.length - 1];
        return <BuyEntity key={top.type + top.value} type={top.type} value={top.value}
            onOpen={open} onBack={back} depth={stack.length} />;
    }

    return (
        <div className="p-4 space-y-3">
            <div className="grid grid-cols-4 gap-2">
                {[['invoices', 'الفواتير'], ['suppliers', 'الموردون'], ['payments', 'الدفعات'],
                  ['returns', 'المرتجعات']].map(([k, t]) => (
                    <button key={k} onClick={() => { setTab(k); setRows([]); }}
                        className={'h-[48px] rounded-xl text-[13px] font-black border ' +
                            (tab === k ? 'bg-[#c5a059] text-[#0b1220] border-[#c5a059]' : 'bg-white/5 border-white/10 text-slate-300')}>
                        {t}
                    </button>
                ))}
            </div>

            {tab === 'returns' && <BuyReturns />}

            {tab !== 'payments' && tab !== 'returns' && (
            <div className="flex gap-2">
                <div className="relative flex-1 min-w-0">
                    <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()}
                        placeholder={tab === 'invoices' ? 'ابحث برقم الفاتورة أو المورد' : 'ابحث عن مورد'}
                        className="w-full min-w-0 h-[52px] pr-9 pl-3 rounded-xl bg-white/[0.06] border border-white/10 text-[15px] outline-none focus:border-[#c5a059]" />
                </div>
                <button onClick={() => load(false, true)} className="w-[52px] h-[52px] rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                    <RefreshCw size={17} className={busy ? 'animate-spin' : ''} />
                </button>
            </div>
            )}

            {tab === 'payments' && (
                <>
                    {proof && (
                        <div className="rounded-2xl bg-white/[0.05] border border-white/10 p-3 space-y-2">
                            <div className="flex items-center gap-2">
                                {proof.without_proof === 0
                                    ? <ShieldCheck size={16} className="text-emerald-300" />
                                    : <ShieldAlert size={16} className="text-amber-300" />}
                                <span className="text-[13px] font-black">إثباتات الدفعات</span>
                                <span className="text-[11px] text-slate-400 mr-auto">{proof.payments} دفعة</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="rounded-xl bg-emerald-500/10 p-2.5">
                                    <div className="text-[11px] text-emerald-300">لها إثبات</div>
                                    <div className="text-[15px] font-black tabular-nums">{proof.with_proof}</div>
                                    <div className="text-[10px] text-slate-400 tabular-nums">{money(proof.amount_with_proof)}</div>
                                </div>
                                <div className="rounded-xl bg-amber-500/10 p-2.5">
                                    <div className="text-[11px] text-amber-300">بلا إثبات</div>
                                    <div className="text-[15px] font-black tabular-nums">{proof.without_proof}</div>
                                    <div className="text-[10px] text-slate-400 tabular-nums">{money(proof.amount_without_proof)}</div>
                                </div>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-relaxed">
                                الإثبات: إيصال مرفوع على الدفعة، أو مستند إيصال على فاتورتها، أو مرفق في دفترة عليها.
                            </p>
                            <button onClick={() => setOnlyGap(v => !v)}
                                className="w-full h-[40px] rounded-xl bg-white/10 text-[12px] font-bold">
                                {onlyGap ? 'اعرض كل الدفعات' : 'اعرض الناقصة فقط'}
                            </button>
                        </div>
                    )}
                    {busy && !proof && (
                        <p className="text-[12px] text-slate-500 text-center py-6">يحسب…</p>
                    )}
                    <div className="space-y-2">
                        {(proof?.rows || []).map(r => (
                            <button key={r.source + r.id} onClick={() => r.purchase_id && open('purchase', r.purchase_id)}
                                className="w-full text-right rounded-xl bg-white/[0.05] border border-white/10 p-3 active:bg-white/10">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="text-[14px] font-bold truncate">{r.supplier || '—'}</div>
                                        <div className="text-[11px] text-slate-400 mt-0.5">
                                            {r.invoice_no ? '#' + r.invoice_no + ' · ' : ''}{r.pay_date} · {r.source}
                                        </div>
                                    </div>
                                    <div className="text-left shrink-0">
                                        <div className="text-[15px] font-black tabular-nums">{money(r.amount)}</div>
                                        <div className={'text-[10px] font-bold ' +
                                            (Number(r.has_proof) ? 'text-emerald-300' : 'text-amber-300')}>
                                            {Number(r.has_proof) ? 'له إثبات' : 'بلا إثبات'}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))}
                        {proof && !(proof.rows || []).length && (
                            <p className="text-[12px] text-emerald-300 text-center py-6 font-bold">
                                كل الدفعات لها إثباتاتها ✓
                            </p>
                        )}
                    </div>
                </>
            )}

            {tab === 'invoices' && (
                <div className="grid grid-cols-3 gap-2">
                    {[['', 'الكل'], ['unpaid', 'غير مسددة'], ['no_docs', 'بلا مستند'],
                      ['daftra_doc', 'لها مرفق بدفترة']].map(([k, t]) => (
                        <button key={k} onClick={() => setFilter(k)}
                            className={'h-[44px] rounded-xl text-[12px] font-bold border ' +
                                (filter === k ? 'bg-white/15 border-white/20' : 'bg-white/5 border-white/10 text-slate-400')}>
                            {t}
                        </button>
                    ))}
                </div>
            )}

            {tab === 'invoices' && sum && (
                <button onClick={() => setFilter(filter === 'unpaid' ? '' : 'unpaid')}
                    className="w-full rounded-xl bg-white/[0.04] border border-white/10 p-3 text-right active:bg-white/10">
                    <div className="flex justify-between items-center text-[12px]">
                        <span className="text-slate-400">{sum.n} فاتورة</span>
                        <span className="font-black tabular-nums">{short(sum.gross)}</span>
                        <span className="text-amber-300 font-bold tabular-nums">متبقٍ {short(sum.outstanding)}</span>
                    </div>
                    <div className="text-[10px] text-slate-500 mt-1">
                        {Number(sum.unpaid_n) > 0
                            ? `على ${sum.unpaid_n} فاتورة — اضغط لعرضها`
                            : 'كل الفواتير مسددة'}
                        {Number(sum.overpaid) > 0.5 ? ` · سداد زائد ${short(sum.overpaid)}` : ''}
                    </div>
                </button>
            )}

            {tab !== 'payments' && tab !== 'returns' && <SortBar cols={SORTS} sortKey={sortKey} dir={sortDir}
                onSort={k => setSortKey(k || (tab === 'invoices' ? 'date' : 'gross'))}
                onDir={() => setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))} />}

            <div className="space-y-2">
                {tab === 'invoices' && view.map(r => (
                    <button key={r.id} onClick={() => open('purchase', r.id)}
                        className="w-full text-right rounded-xl bg-white/[0.05] border border-white/10 p-3 active:bg-white/10">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <div className="text-[14px] font-bold truncate">{r.supplier}</div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                    #{r.no} · {r.date}{r.project ? ' · ' + r.project : ''}
                                </div>
                            </div>
                            <div className="text-left shrink-0">
                                <div className="text-[15px] font-black tabular-nums">{money(r.gross)}</div>
                                {Number(r.remaining) > 0.5 && (
                                    <div className="text-[11px] text-amber-300 font-bold tabular-nums">متبقٍ {money(r.remaining)}</div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <span className={'text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 ' +
                                (Number(r.docs) > 0 ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300')}>
                                <Paperclip size={10} /> {Number(r.docs) > 0 ? r.docs + ' مستند' : 'بلا مستند'}
                            </span>
                            {r.origin === 'local' && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-sky-500/15 text-sky-300">من التطبيق</span>
                            )}
                            <ChevronLeft size={14} className="text-slate-600 mr-auto" />
                        </div>
                    </button>
                ))}

                {tab === 'suppliers' && view.map(r => (
                    <button key={r.name} onClick={() => open('supplier', r.name)}
                        className="w-full text-right rounded-xl bg-white/[0.05] border border-white/10 p-3 active:bg-white/10">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <div className="text-[14px] font-bold truncate">{r.name}</div>
                                <div className="text-[11px] text-slate-400 mt-0.5">
                                    {r.invoices} فاتورة · آخر تعامل {r.last_date}
                                </div>
                            </div>
                            <div className="text-left shrink-0">
                                <div className="text-[15px] font-black tabular-nums">{short(r.gross)}</div>
                                {Number(r.outstanding) > 0.5 && (
                                    <div className="text-[11px] text-amber-300 font-bold flex items-center gap-1 justify-end">
                                        <Wallet size={11} /> {short(r.outstanding)}
                                    </div>
                                )}
                            </div>
                        </div>
                    </button>
                ))}

                {!rows.length && !busy && tab !== 'returns' && tab !== 'payments' && <p className="text-center text-slate-500 text-sm py-8">لا نتائج</p>}

                {more && tab !== 'returns' && (
                    <button onClick={() => load(true)} disabled={busy}
                        className="w-full min-h-[48px] rounded-xl bg-white/10 text-[13px] font-bold disabled:opacity-50">
                        {busy ? 'جارٍ التحميل...' : 'تحميل المزيد'}
                    </button>
                )}
                {rows.length > 0 && !more && tab !== 'returns' && (
                    <p className="text-center text-[11px] text-slate-600 py-2">عُرضت كل النتائج ({rows.length})</p>
                )}
            </div>
        </div>
    );
}
