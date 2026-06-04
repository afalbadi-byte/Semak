import React from 'react';
import { ChevronRight, ChevronLeft, ChevronsRight, ChevronsLeft } from 'lucide-react';

/**
 * شريط ترقيم صفحات موحّد (RTL).
 * @param {number} page       الصفحة الحالية (1-based).
 * @param {number} totalPages إجمالي الصفحات.
 * @param {Function} setPage  setter للصفحة.
 * @param {number} pageStart  فهرس بداية العرض (0-based).
 * @param {number} pageEnd    فهرس نهاية العرض.
 * @param {number} totalRows  إجمالي الصفوف.
 */
export default function TablePager({ page, totalPages, setPage, pageStart, pageEnd, totalRows }) {
    if (totalRows === 0) return null;
    const go = (p) => setPage(Math.min(Math.max(1, p), totalPages));

    // أرقام صفحات مختصرة حول الصفحة الحالية
    const pages = [];
    const win = 1;
    for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= page - win && i <= page + win)) pages.push(i);
        else if (pages[pages.length - 1] !== '…') pages.push('…');
    }

    const btn = "w-9 h-9 flex items-center justify-center rounded-lg text-sm font-bold transition";

    return (
        <div className="flex items-center justify-between flex-wrap gap-3 px-1 pt-4">
            <p className="text-xs font-bold text-slate-400">
                عرض <span className="text-slate-700">{pageStart + 1}</span>–<span className="text-slate-700">{pageEnd}</span> من <span className="text-slate-700">{totalRows}</span>
            </p>
            {totalPages > 1 && (
                <div className="flex items-center gap-1" dir="ltr">
                    <button onClick={() => go(1)} disabled={page === 1}
                        className={`${btn} ${page === 1 ? 'text-slate-300' : 'text-slate-500 hover:bg-slate-100'}`}><ChevronsRight size={16}/></button>
                    <button onClick={() => go(page - 1)} disabled={page === 1}
                        className={`${btn} ${page === 1 ? 'text-slate-300' : 'text-slate-500 hover:bg-slate-100'}`}><ChevronRight size={16}/></button>
                    {pages.map((p, i) => p === '…'
                        ? <span key={`e${i}`} className="px-1 text-slate-300">…</span>
                        : <button key={p} onClick={() => go(p)}
                            className={`${btn} ${p === page ? 'bg-[#1a365d] text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{p}</button>
                    )}
                    <button onClick={() => go(page + 1)} disabled={page === totalPages}
                        className={`${btn} ${page === totalPages ? 'text-slate-300' : 'text-slate-500 hover:bg-slate-100'}`}><ChevronLeft size={16}/></button>
                    <button onClick={() => go(totalPages)} disabled={page === totalPages}
                        className={`${btn} ${page === totalPages ? 'text-slate-300' : 'text-slate-500 hover:bg-slate-100'}`}><ChevronsLeft size={16}/></button>
                </div>
            )}
        </div>
    );
}
