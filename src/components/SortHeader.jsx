import React from 'react';
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

/**
 * عنوان عمود قابل للفرز — يُستخدم داخل <thead><tr>.
 * @param {string} label   نص العنوان.
 * @param {string} sortKey مفتاح الحقل للفرز.
 * @param {string} activeKey مفتاح العمود المُفعّل حاليًا.
 * @param {string} dir     'asc' | 'desc'.
 * @param {Function} onSort callback(sortKey).
 * @param {string} align   'right' | 'center' | 'left'.
 * @param {string} className تمرير أصناف إضافية للـ th.
 */
export default function SortHeader({ label, sortKey, activeKey, dir, onSort, align = 'right', className = '' }) {
    const active = activeKey === sortKey;
    const justify = align === 'center' ? 'justify-center' : align === 'left' ? 'justify-end' : 'justify-start';
    return (
        <th className={`px-4 py-3 select-none ${className}`}>
            <button
                onClick={() => onSort(sortKey)}
                className={`flex items-center gap-1.5 w-full ${justify} font-black text-xs transition-colors ${active ? 'text-[#c5a059]' : 'text-slate-500 hover:text-[#1a365d]'}`}
            >
                <span>{label}</span>
                {active
                    ? (dir === 'asc' ? <ChevronUp size={13}/> : <ChevronDown size={13}/>)
                    : <ChevronsUpDown size={13} className="opacity-40"/>}
            </button>
        </th>
    );
}
