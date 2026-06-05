import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Loader2 } from 'lucide-react';

// ════════════════════════════════════════════════════════════════════════════
//  حقل بحث مع اقتراحات فورية من قاعدة البيانات (نمط دفترة).
//  props:
//    value, onChange(text)            — النص الظاهر (مُتحكَّم به).
//    fetcher(query) -> Promise<Array> — جلب الاقتراحات (مع تأخير 250ms).
//    onSelect(item)                   — عند اختيار عنصر.
//    getLabel(item) -> string         — النص الذي يُكتب في الحقل عند الاختيار.
//    renderItem(item) -> node         — تخصيص عرض كل اقتراح (اختياري).
//    minChars (افتراضي 1)             — أقل عدد أحرف لبدء البحث.
// ════════════════════════════════════════════════════════════════════════════

export default function Autocomplete({
    value,
    onChange,
    fetcher,
    onSelect,
    getLabel = (x) => x?.name ?? '',
    renderItem,
    placeholder = 'ابحث...',
    minChars = 1,
    className = '',
    inputClassName = '',
    disabled = false,
}) {
    const [open, setOpen]     = useState(false);
    const [items, setItems]   = useState([]);
    const [loading, setLoading] = useState(false);
    const [active, setActive] = useState(-1);
    const boxRef = useRef(null);
    const tmr    = useRef(null);
    const query  = value ?? '';

    const run = useCallback((q) => {
        if (!fetcher || q.trim().length < minChars) { setItems([]); setOpen(false); return; }
        setLoading(true);
        Promise.resolve(fetcher(q))
            .then(res => { setItems(Array.isArray(res) ? res : []); setOpen(true); })
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    }, [fetcher, minChars]);

    useEffect(() => {
        if (tmr.current) clearTimeout(tmr.current);
        tmr.current = setTimeout(() => run(query), 250);
        return () => { if (tmr.current) clearTimeout(tmr.current); };
    }, [query, run]);

    useEffect(() => {
        const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    const pick = (it) => {
        onSelect?.(it);
        onChange?.(getLabel(it));
        setOpen(false);
        setActive(-1);
    };

    const onKey = (e) => {
        if (!open || items.length === 0) return;
        if (e.key === 'ArrowDown')      { e.preventDefault(); setActive(a => Math.min(a + 1, items.length - 1)); }
        else if (e.key === 'ArrowUp')   { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
        else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(items[active]); }
        else if (e.key === 'Escape')    setOpen(false);
    };

    return (
        <div ref={boxRef} className={`relative ${className}`}>
            <div className="relative">
                <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-brand-400 pointer-events-none" />
                <input
                    value={query}
                    disabled={disabled}
                    onChange={(e) => onChange?.(e.target.value)}
                    onFocus={() => items.length && setOpen(true)}
                    onKeyDown={onKey}
                    placeholder={placeholder}
                    autoComplete="off"
                    className={`w-full pr-9 pl-9 py-2.5 rounded-xl border border-slate-200 dark:border-brand-700 focus:border-gold-400 focus:ring-2 focus:ring-gold-400/20 outline-none text-sm font-bold text-brand-800 dark:text-brand-50 bg-white dark:bg-brand-900 transition disabled:bg-slate-50 dark:disabled:bg-brand-800 disabled:text-slate-400 dark:disabled:text-brand-500 ${inputClassName}`}
                />
                {loading && <Loader2 size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-500 animate-spin" />}
            </div>

            {open && items.length > 0 && (
                <ul className="absolute z-40 mt-1 w-full max-h-64 overflow-auto bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-700 rounded-xl shadow-xl py-1 custom-scrollbar">
                    {items.map((it, i) => (
                        <li
                            key={it.id ?? i}
                            onMouseDown={(e) => { e.preventDefault(); pick(it); }}
                            onMouseEnter={() => setActive(i)}
                            className={`px-3 py-2 cursor-pointer text-sm font-bold text-brand-800 dark:text-brand-100 transition ${i === active ? 'bg-gold-500/10 dark:bg-gold-500/15' : 'hover:bg-slate-50 dark:hover:bg-brand-800'}`}
                        >
                            {renderItem ? renderItem(it) : getLabel(it)}
                        </li>
                    ))}
                </ul>
            )}

            {open && !loading && items.length === 0 && query.trim().length >= minChars && (
                <div className="absolute z-40 mt-1 w-full bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-700 rounded-xl shadow-xl px-3 py-3 text-sm text-slate-400 dark:text-brand-400 font-bold text-center">
                    لا توجد نتائج
                </div>
            )}
        </div>
    );
}
