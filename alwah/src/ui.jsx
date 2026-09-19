import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { Loader2, X, Minus, Plus } from 'lucide-react';
import { GRADES } from './lib/quran';

export const PALETTE = ['#1f5f4a', '#0e7490', '#2563eb', '#7c3aed', '#db2777', '#dc2626', '#ea580c', '#b8893a', '#65a30d', '#475569'];

export function Card({ children, className = '', as: As = 'div', ...rest }) {
    return <As className={'bg-paper-card rounded-2xl border border-paper-2 shadow-card ' + className} {...rest}>{children}</As>;
}

export function LinkCard({ href, children, className = '' }) {
    return (
        <a href={href} className={'block bg-paper-card rounded-2xl border border-paper-2 shadow-card transition hover:border-brand-100 hover:shadow-md active:scale-[.99] ' + className}>
            {children}
        </a>
    );
}

export function Section({ title, action, children, className = '' }) {
    return (
        <section className={className}>
            <div className="flex items-center justify-between mb-2 px-1">
                <h2 className="text-[13px] font-bold text-ink-2">{title}</h2>
                {action}
            </div>
            {children}
        </section>
    );
}

export function Btn({ children, kind = 'primary', className = '', busy, ...rest }) {
    const k = {
        primary: 'bg-brand text-white hover:bg-brand-700',
        soft: 'bg-brand-50 text-brand-700 hover:bg-brand-100',
        gold: 'bg-gold text-white hover:brightness-95',
        ghost: 'bg-transparent text-ink-2 hover:bg-paper-2',
        line: 'bg-paper-card border border-paper-2 text-ink hover:border-ink-3',
        danger: 'bg-red-50 text-red-700 hover:bg-red-100',
    }[kind];
    return (
        <button className={'h-11 px-4 rounded-xl font-semibold text-[14px] inline-flex items-center justify-center gap-2 transition disabled:opacity-40 ' + k + ' ' + className}
            disabled={busy || rest.disabled} {...rest}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : null}{children}
        </button>
    );
}

export function Field({ label, hint, children, className = '' }) {
    return (
        <label className={'block ' + className}>
            {label ? <span className="block text-[12px] font-semibold text-ink-2 mb-1.5">{label}</span> : null}
            {children}
            {hint ? <span className="block text-[11px] text-ink-3 mt-1 leading-5">{hint}</span> : null}
        </label>
    );
}
export const inputCls = 'w-full h-11 px-3 rounded-xl bg-white border border-paper-2 text-[15px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand-50 placeholder:text-ink-3';

export function Seg({ value, onChange, options, className = '' }) {
    return (
        <div className={'flex p-1 rounded-xl bg-paper-2 ' + className}>
            {options.map(o => (
                <button key={String(o.v)} type="button" onClick={() => onChange(o.v)}
                    className={'flex-1 h-9 rounded-lg text-[13px] font-semibold transition ' +
                        (value === o.v ? 'bg-paper-card text-ink shadow-card' : 'text-ink-3')}>
                    {o.t}
                </button>
            ))}
        </div>
    );
}

// عدّاد بزرّين: للأسطر والأخطاء والتنبيهات
export function Stepper({ value, onChange, min = 0, max = 99, step = 1, label, tone }) {
    const n = Number(value) || 0;
    const set = v => onChange(Math.max(min, Math.min(max, v)));
    return (
        <div className="flex items-center gap-2">
            <button type="button" onClick={() => set(n - step)} disabled={n <= min}
                className="w-10 h-10 rounded-xl bg-paper-2 text-ink-2 flex items-center justify-center disabled:opacity-30"><Minus size={16} /></button>
            <div className="min-w-[44px] text-center">
                <div className={'text-[20px] font-bold tabular-nums leading-none ' + (tone && n ? tone : 'text-ink')}>{n}</div>
                {label ? <div className="text-[10px] text-ink-3 mt-1">{label}</div> : null}
            </div>
            <button type="button" onClick={() => set(n + step)} disabled={n >= max}
                className="w-10 h-10 rounded-xl bg-paper-2 text-ink-2 flex items-center justify-center disabled:opacity-30"><Plus size={16} /></button>
        </div>
    );
}

export function GradePicker({ value, onChange }) {
    return (
        <div className="grid grid-cols-5 gap-1.5">
            {GRADES.map(g => {
                const on = value === g.v;
                return (
                    <button key={g.v} type="button" onClick={() => onChange(on ? 0 : g.v)}
                        className={'h-10 rounded-xl text-[12px] font-bold border transition ' + (on ? 'text-white border-transparent' : 'bg-white border-paper-2 text-ink-2')}
                        style={on ? { background: g.c } : undefined}>{g.t}</button>
                );
            })}
        </div>
    );
}

// حلقة التقدّم: نسبة المحفوظ من المصحف
export function Ring({ value, size = 64, stroke = 7, color = '#1f5f4a', children }) {
    const r = (size - stroke) / 2, C = 2 * Math.PI * r;
    const p = Math.max(0, Math.min(1, value || 0));
    return (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} className="-rotate-90">
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ebe5d8" strokeWidth={stroke} />
                <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
                    strokeDasharray={`${Math.max(0.001, p * C)} ${C}`} />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">{children}</div>
        </div>
    );
}

export function Empty({ icon: I, title, text, action }) {
    return (
        <div className="text-center py-12 px-6">
            {I ? <div className="w-14 h-14 rounded-2xl bg-brand-50 text-brand mx-auto flex items-center justify-center mb-3"><I size={24} /></div> : null}
            <p className="font-bold text-ink">{title}</p>
            {text ? <p className="text-[13px] text-ink-3 mt-1 leading-6">{text}</p> : null}
            {action ? <div className="mt-4">{action}</div> : null}
        </div>
    );
}

export const Spinner = ({ className = '' }) => (
    <div className={'flex justify-center py-16 ' + className}><Loader2 className="animate-spin text-brand" size={26} /></div>
);

export function Sheet({ open, onClose, title, children, wide }) {
    useEffect(() => {
        if (!open) return undefined;
        const k = e => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', k);
        document.body.style.overflow = 'hidden';
        return () => { window.removeEventListener('keydown', k); document.body.style.overflow = ''; };
    }, [open, onClose]);
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] flex items-end lg:items-center justify-center" onClick={onClose}>
            <div onClick={e => e.stopPropagation()}
                className={'w-full bg-paper rounded-t-3xl lg:rounded-3xl max-h-[92vh] overflow-y-auto ' + (wide ? 'lg:max-w-2xl' : 'lg:max-w-lg')}
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
                <div className="sticky top-0 bg-paper/95 backdrop-blur px-5 pt-4 pb-3 flex items-center gap-2 border-b border-paper-2 z-10">
                    <h3 className="font-bold text-ink flex-1">{title}</h3>
                    <button onClick={onClose} aria-label="إغلاق" className="w-9 h-9 rounded-xl hover:bg-paper-2 flex items-center justify-center text-ink-2"><X size={18} /></button>
                </div>
                <div className="p-5">{children}</div>
            </div>
        </div>
    );
}

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastHost({ children }) {
    const [t, setT] = useState(null);
    const show = useCallback((msg, kind) => {
        setT({ msg, kind, id: Date.now() });
        setTimeout(() => setT(x => (x && Date.now() - x.id >= 2600 ? null : x)), 2700);
    }, []);
    return (
        <ToastCtx.Provider value={show}>
            {children}
            {t ? (
                <div className="fixed z-[60] left-1/2 -translate-x-1/2 bottom-24 lg:bottom-8 px-4 py-2.5 rounded-xl shadow-lg text-[13px] font-semibold text-white"
                    style={{ background: t.kind === 'err' ? '#b91c1c' : '#1b2320' }}>
                    {t.msg}
                </div>
            ) : null}
        </ToastCtx.Provider>
    );
}

// التاريخ بالهجري والميلادي
export const hijri = d => {
    try { return new Intl.DateTimeFormat('ar-SA-u-ca-islamic-umalqura-nu-latn', { day: 'numeric', month: 'long' }).format(new Date(d + 'T12:00:00')); }
    catch (e) { return ''; }
};
export const greg = (d, opts) => {
    try { return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', opts || { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(d + 'T12:00:00')); }
    catch (e) { return d; }
};
export const todayStr = () => {
    const n = new Date(); const z = x => String(x).padStart(2, '0');
    return n.getFullYear() + '-' + z(n.getMonth() + 1) + '-' + z(n.getDate());
};
