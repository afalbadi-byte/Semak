import React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

// ─── رأس عمود قابل للترتيب ───────────────────────────────────────────────────
export default function SortHeader({ label, k, sortKey, dir, onSort, className = '', align = 'right' }) {
    const on = sortKey === k;
    const Icon = !on ? ChevronsUpDown : dir === 'asc' ? ChevronUp : ChevronDown;
    return (
        <th className={'whitespace-nowrap ' + className}>
            <button type="button" onClick={() => onSort(k)}
                className={'w-full flex items-center gap-1 select-none min-h-[36px] ' +
                    (align === 'right' ? 'justify-start' : 'justify-center') + ' ' +
                    (on ? 'text-brand-900 dark:text-brand-50 font-black' : 'hover:text-brand-700')}>
                {label}
                <Icon size={13} className={on ? 'text-gold-500' : 'opacity-40'} />
            </button>
        </th>
    );
}

// شريط ترتيب للجوال: قائمة أعمدة وزر اتجاه
export function SortBar({ cols, sortKey, dir, onSort, onDir }) {
    return (
        <div className="flex gap-2 items-center">
            <select value={sortKey || ''} onChange={e => onSort(e.target.value)}
                className="flex-1 min-w-0 h-[44px] px-3 rounded-xl bg-white/[0.06] border border-white/10 text-[13px] outline-none">
                <option value="" className="bg-slate-800">الترتيب الافتراضي</option>
                {cols.map(c => <option key={c.k} value={c.k} className="bg-slate-800">{c.t}</option>)}
            </select>
            <button type="button" onClick={onDir} disabled={!sortKey}
                className="h-[44px] px-3 rounded-xl bg-white/10 text-[12px] font-bold flex items-center gap-1.5 disabled:opacity-40">
                {dir === 'asc' ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                {dir === 'asc' ? 'تصاعدي' : 'تنازلي'}
            </button>
        </div>
    );
}
