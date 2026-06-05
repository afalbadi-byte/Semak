import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Home } from 'lucide-react';

// ════════════════════════════════════════════════════════════════════════════
//  مسار تنقّل (Breadcrumbs) RTL داخل اللوحة.
//  items: [{ label, to? }] — العنصر الأخير (أو بلا to) هو الصفحة الحالية.
//  to نسبي داخل /admin/dashboard.
// ════════════════════════════════════════════════════════════════════════════

export default function Breadcrumbs({ items = [], className = '' }) {
    const navigate = useNavigate();
    return (
        <nav className={`flex items-center gap-1.5 text-[13px] font-bold flex-wrap ${className}`} dir="rtl">
            <button
                onClick={() => navigate('/admin/dashboard')}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-[#c5a059] transition"
            >
                <Home size={14} /> الرئيسية
            </button>
            {items.map((it, i) => {
                const isLast = i === items.length - 1;
                return (
                    <React.Fragment key={i}>
                        <ChevronLeft size={14} className="text-slate-300 shrink-0" />
                        {it.to && !isLast ? (
                            <button
                                onClick={() => navigate(`/admin/dashboard/${it.to}`)}
                                className="text-slate-500 hover:text-[#c5a059] transition"
                            >
                                {it.label}
                            </button>
                        ) : (
                            <span className="text-[#1a365d]">{it.label}</span>
                        )}
                    </React.Fragment>
                );
            })}
        </nav>
    );
}
