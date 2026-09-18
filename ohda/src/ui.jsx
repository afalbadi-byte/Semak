import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
    Car, Coffee, Package, Wrench, Wifi, Landmark, GraduationCap, Home, HeartPulse, Tag, ShoppingCart,
    Fuel, Plane, Gift, Baby, Shirt, BookOpen, Zap, Building2, Utensils, Loader2, X,
} from 'lucide-react';
import { money } from './lib/fmt';

// ─── الأيقونات المتاحة للتصنيفات ────────────────────────────────────────────
export const ICONS = {
    car: Car, coffee: Coffee, package: Package, wrench: Wrench, wifi: Wifi, landmark: Landmark,
    graduation: GraduationCap, home: Home, heart: HeartPulse, tag: Tag, cart: ShoppingCart, fuel: Fuel,
    plane: Plane, gift: Gift, baby: Baby, shirt: Shirt, book: BookOpen, zap: Zap, building: Building2, food: Utensils,
};
export const CatIcon = ({ name, size = 16, className }) => {
    const I = ICONS[name] || Tag;
    return <I size={size} className={className} />;
};
export const PALETTE = ['#0f6b61', '#0ea5e9', '#2563eb', '#8b5cf6', '#db2777', '#dc2626', '#f97316', '#c77a12', '#65a30d', '#64748b'];

// ─── المال: الرقم بارز والعملة خافتة ────────────────────────────────────────
export function Money({ v, className = '', cur = true, frac, sign }) {
    const n = Number(v || 0);
    return (
        <span className={'tabular-nums whitespace-nowrap ' + className} dir="ltr">
            {cur ? <span className="text-[0.62em] font-medium opacity-60 me-1">ر.س</span> : null}
            {sign && n > 0 ? '+' : ''}{money(n, frac)}
        </span>
    );
}

export function Card({ children, className = '', as: As = 'div', ...rest }) {
    return <As className={'bg-paper-card rounded-2xl border border-paper-2 shadow-card ' + className} {...rest}>{children}</As>;
}

// بطاقةٌ تُفتح: كل رقمٍ له دلالة يوصل إلى تفاصيله
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
            {hint ? <span className="block text-[11px] text-ink-3 mt-1">{hint}</span> : null}
        </label>
    );
}
export const inputCls = 'w-full h-11 px-3 rounded-xl bg-white border border-paper-2 text-[15px] text-ink outline-none focus:border-brand focus:ring-2 focus:ring-brand-50 placeholder:text-ink-3';

export function Seg({ value, onChange, options, className = '' }) {
    return (
        <div className={'flex p-1 rounded-xl bg-paper-2 ' + className}>
            {options.map(o => (
                <button key={o.v} type="button" onClick={() => onChange(o.v)}
                    className={'flex-1 h-9 rounded-lg text-[13px] font-semibold transition ' +
                        (value === o.v ? 'bg-paper-card text-ink shadow-card' : 'text-ink-3')}>
                    {o.t}
                </button>
            ))}
        </div>
    );
}

export function Progress({ used, total, color }) {
    const p = total > 0 ? Math.min(100, (used / total) * 100) : 0;
    const over = total > 0 && used > total;
    const warn = !over && p >= 80;
    return (
        <div className="h-2 rounded-full bg-paper-2 overflow-hidden">
            <div className="h-full rounded-full transition-all"
                style={{ width: p + '%', background: over ? '#dc2626' : warn ? '#c77a12' : (color || '#0f6b61') }} />
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

// ─── ورقة منبثقة: من الأسفل على الجوّال، وفي الوسط على الشاشة الكبيرة ─────────
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
                    <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-paper-2 flex items-center justify-center text-ink-2"><X size={18} /></button>
                </div>
                <div className="p-5">{children}</div>
            </div>
        </div>
    );
}

// ─── الرسوم ─────────────────────────────────────────────────────────────────
// حلقة التصنيفات: كل قطعة رابطٌ إلى حركاتها
export function Donut({ data, size = 168, stroke = 26, center, hrefFor }) {
    const total = data.reduce((s, d) => s + d.value, 0) || 1;
    const r = (size - stroke) / 2, C = 2 * Math.PI * r;
    let acc = 0;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ebe7de" strokeWidth={stroke} />
            {data.map((d, i) => {
                const len = (d.value / total) * C;
                const el = (
                    <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={d.color} strokeWidth={stroke}
                        strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-acc}
                        transform={`rotate(-90 ${size / 2} ${size / 2})`} className="transition-opacity hover:opacity-80" />
                );
                acc += len;
                return hrefFor ? <a key={i} href={hrefFor(d)}>{el}</a> : el;
            })}
            {center}
        </svg>
    );
}

// أعمدة: يومية أو شهرية — العمود رابطٌ إلى حركات يومه
export function Bars({ data, height = 120, hrefFor, color = '#0f6b61', labelEvery = 1, label }) {
    const max = Math.max(1, ...data.map(d => d.value));
    return (
        <div className="flex items-end gap-[3px]" style={{ height }} dir="ltr">
            {data.map((d, i) => {
                const h = Math.max(d.value > 0 ? 3 : 0, (d.value / max) * (height - 18));
                const inner = (
                    <div className="flex flex-col items-center justify-end h-full group">
                        <div className="w-full rounded-t-[4px] transition group-hover:opacity-75"
                            style={{ height: h, background: d.color || color, opacity: d.value ? 1 : 0.15, minHeight: 2 }}
                            title={d.title} />
                        <span className="text-[9px] text-ink-3 mt-1 h-3 leading-3">{i % labelEvery === 0 && label ? label(d) : ''}</span>
                    </div>
                );
                return hrefFor && d.value
                    ? <a key={i} href={hrefFor(d)} className="flex-1 min-w-0 h-full">{inner}</a>
                    : <div key={i} className="flex-1 min-w-0 h-full">{inner}</div>;
            })}
        </div>
    );
}

// ─── رسائل عابرة ────────────────────────────────────────────────────────────
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
                    style={{ background: t.kind === 'err' ? '#b91c1c' : '#18211f' }}>
                    {t.msg}
                </div>
            ) : null}
        </ToastCtx.Provider>
    );
}
