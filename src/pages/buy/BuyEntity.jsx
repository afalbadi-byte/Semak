import React, { useState, useEffect } from 'react';
import { ArrowRight, Loader2, ExternalLink, Layers, Download, Archive } from 'lucide-react';
import { API_URL, getAdminToken } from '../../lib/api/client';

const money = v => (v === null || v === undefined || v === '' || isNaN(Number(v)))
    ? String(v ?? '—') : Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const isNum = v => v !== '' && v !== null && v !== undefined && !isNaN(Number(v));
const auth = () => { const t = getAdminToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };
const LABEL = { supplier: 'مورد', purchase: 'فاتورة شراء', product: 'صنف', project: 'مشروع', unit: 'وحدة' };

// ─── بطاقة كيان داخل التطبيق: كل دلالة فيها تفتح بطاقتها ────────────────────
export default function BuyEntity({ type, value, onOpen, onBack, depth = 0 }) {
    const [data, setData] = useState(null);
    const [err, setErr]   = useState('');

    useEffect(() => {
        let live = true;
        setData(null); setErr('');
        fetch(`${API_URL}?action=entity&type=${encodeURIComponent(type)}&value=${encodeURIComponent(value)}`,
            { headers: auth() })
            .then(r => r.json())
            .then(r => { if (!live) return; r.success ? setData(r) : setErr(r.message || 'تعذر الجلب'); })
            .catch(() => live && setErr('تعذر الاتصال'));
        return () => { live = false; };
    }, [type, value]);

    return (
        <div className="p-4 space-y-3">
            <button onClick={onBack} className="flex items-center gap-1.5 text-[13px] font-bold text-slate-400 min-h-[44px]">
                <ArrowRight size={16} /> رجوع
            </button>

            {err && <div className="rounded-xl bg-red-500/15 text-red-300 p-3 text-xs font-bold">{err}</div>}
            {!data && !err && <div className="flex justify-center py-10"><Loader2 size={24} className="animate-spin text-[#c5a059]" /></div>}

            {data && (
                <>
                    <div>
                        <div className="text-[11px] font-bold text-[#c5a059]">{LABEL[data.type] || data.subtitle}</div>
                        <h2 className="text-[20px] font-black leading-tight">{data.title}</h2>
                        {!!(data.links || []).length && (
                            <div className="flex gap-2 flex-wrap mt-2">
                                {data.links.map((l, i) => (
                                    <button key={i} onClick={() => onOpen(l.type, l.value)}
                                        className="text-[11px] font-bold bg-white/10 rounded-lg px-2.5 py-1.5">
                                        {l.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {!!(data.stats || []).length && (
                        <div className="grid grid-cols-2 gap-2">
                            {data.stats.map((s, i) => (
                                <div key={i} className="rounded-xl bg-white/[0.06] border border-white/10 p-2.5">
                                    <div className="text-[11px] text-slate-400">{s.label}</div>
                                    <div className="text-[15px] font-black mt-0.5 tabular-nums">
                                        {s.money ? money(s.value) : String(s.value ?? '—')}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {(data.sections || []).map((sec, si) => (
                        <Section key={si} sec={sec} onOpen={onOpen} />
                    ))}
                </>
            )}
        </div>
    );
}

// صفوف القسم كبطاقات لا كجدول — أنسب لعرض الجوال
function Section({ sec, onOpen }) {
    const [open, setOpen] = useState(true);
    const rows = sec.rows || [];
    const cols = sec.cols || [];
    const links = [sec.link, sec.link2].filter(Boolean);
    const head = cols[0];
    const rest = cols.slice(1);

    return (
        <div className="rounded-2xl bg-white/[0.04] border border-white/10 overflow-hidden">
            <button onClick={() => setOpen(o => !o)}
                className="w-full flex items-center gap-2 p-3 min-h-[48px]">
                <Layers size={15} className="text-[#c5a059]" />
                <span className="font-black text-[13px]">{sec.title}</span>
                <span className="text-[11px] text-slate-500 mr-auto">{rows.length}</span>
            </button>
            {sec.download && rows.some(r => Number(r.downloadable) === 1) && (
                <a href={`${API_URL}?action=doc_zip&purchase_id=${sec.purchase_id}`}
                    className="mx-3 mb-2 h-[44px] rounded-xl bg-white/10 flex items-center justify-center gap-1.5 text-[12px] font-bold">
                    <Archive size={14} className="text-[#c5a059]" /> تنزيل كل المستندات
                </a>
            )}

            {open && (
                <div className="px-3 pb-3 space-y-2">
                    {!rows.length && <p className="text-[12px] text-slate-500 text-center py-3">لا بيانات</p>}
                    {rows.map((r, i) => {
                        const hl = links.find(l => l.col === head?.k);
                        const val = head ? r[head.k] : '';
                        return (
                            <div key={i} className="rounded-xl bg-black/25 border border-white/5 p-2.5">
                                <div className="flex items-start justify-between gap-2">
                                    {hl
                                        ? <button onClick={() => onOpen(hl.type, r[hl.value_col])}
                                            className="text-[13px] font-bold text-[#c5a059] text-right underline decoration-dotted underline-offset-4">
                                            {String(val ?? '—')}
                                          </button>
                                        : <span className="text-[13px] font-bold">{String(val ?? '—')}</span>}
                                    <span className="flex items-center gap-2 shrink-0">
                                        {sec.download && r.id && Number(r.downloadable) === 1 && (
                                            <a href={`${API_URL}?action=doc_get&id=${r.id}`} download
                                                className="text-[11px] font-bold text-[#c5a059] flex items-center gap-1">
                                                <Download size={13} /> تنزيل
                                            </a>
                                        )}
                                        {sec.download && Number(r.downloadable) !== 1 && (
                                            <span className="text-[10px] text-slate-500">في أرشيف الدرايف</span>
                                        )}
                                        {sec.url_col && r[sec.url_col] && !sec.download && (
                                            <a href={r[sec.url_col]} target="_blank" rel="noopener noreferrer"
                                                className="text-[11px] text-sky-300 flex items-center gap-1">
                                                <ExternalLink size={12} /> فتح
                                            </a>
                                        )}
                                    </span>
                                </div>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 mt-1.5">
                                    {rest.filter(c => c.k !== sec.url_col).map(c => {
                                        const lk = links.find(l => l.col === c.k);
                                        const v = r[c.k];
                                        if (v === null || v === undefined || v === '') return null;
                                        return (
                                            <div key={c.k} className="flex justify-between gap-2 text-[11px]">
                                                <span className="text-slate-500 shrink-0">{c.t}</span>
                                                {lk
                                                    ? <button onClick={() => onOpen(lk.type, r[lk.value_col])}
                                                        className="font-bold text-[#c5a059] truncate text-left">{String(v)}</button>
                                                    : <span className={'font-bold truncate text-left ' + (isNum(v) ? 'tabular-nums' : '')}>
                                                        {isNum(v) && String(v).includes('.') ? money(v) : String(v)}
                                                      </span>}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
