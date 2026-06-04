import React, { useState, useRef, useEffect } from 'react';
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import { exportToExcel, exportToCSV } from '../utils/exporters';

/**
 * زر تصدير موحّد — قائمة منسدلة (Excel / CSV).
 * @param {Array}  rows     الصفوف المراد تصديرها (المفلترة حاليًا).
 * @param {Array}  columns  [{ key, label, format? }]
 * @param {string} filename اسم الملف بدون امتداد.
 * @param {string} sheetName اسم الورقة (اختياري).
 * @param {boolean} disabled
 */
export default function ExportButton({ rows = [], columns = [], filename = 'export', sheetName, disabled }) {
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    const count = rows?.length || 0;
    const isDisabled = disabled || count === 0;

    const doExport = (type) => {
        setOpen(false);
        if (type === 'excel') exportToExcel(rows, columns, filename, sheetName || 'البيانات');
        else exportToCSV(rows, columns, filename);
    };

    return (
        <div className="relative" ref={ref}>
            <button
                onClick={() => !isDisabled && setOpen(o => !o)}
                disabled={isDisabled}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition border shadow-sm
                    ${isDisabled
                        ? 'bg-slate-50 text-slate-300 border-slate-200 cursor-not-allowed'
                        : 'bg-white text-[#1a365d] border-slate-200 hover:border-[#c5a059] hover:text-[#c5a059]'}`}
            >
                <Download size={16}/>
                <span>تصدير</span>
                {count > 0 && <span className="text-[10px] font-black bg-slate-100 text-slate-500 rounded-full px-1.5">{count}</span>}
                <ChevronDown size={14} className={`transition ${open ? 'rotate-180' : ''}`}/>
            </button>

            {open && (
                <div className="absolute left-0 mt-2 w-44 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-50 animate-fadeIn">
                    <button onClick={() => doExport('excel')}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 transition">
                        <FileSpreadsheet size={17} className="text-emerald-600"/> ملف Excel
                    </button>
                    <button onClick={() => doExport('csv')}
                        className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition border-t border-slate-50">
                        <FileText size={17} className="text-blue-600"/> ملف CSV
                    </button>
                </div>
            )}
        </div>
    );
}
