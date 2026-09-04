import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, ChevronLeft } from 'lucide-react';

// ─── مسار الصفحة: الرئيسية ← القسم ← الصفحة ← البطاقة، وكل حلقة قابلة للضغط ───
export default function Breadcrumbs({ trail }) {
    const navigate = useNavigate();
    if (!trail || trail.length <= 1) return null;
    return (
        <nav className="flex items-center gap-1 flex-wrap px-6 md:px-8 pt-4 text-[12px] no-print" aria-label="مسار الصفحة">
            {trail.map((c, i) => {
                const last = i === trail.length - 1;
                return (
                    <React.Fragment key={i}>
                        {i > 0 && <ChevronLeft size={13} className="text-slate-300 shrink-0" />}
                        {last || !c.to ? (
                            <span className="font-black text-brand-900 dark:text-brand-100">{c.label}</span>
                        ) : (
                            <button onClick={() => navigate(c.to)}
                                className="text-slate-500 hover:text-gold-600 font-bold transition flex items-center gap-1">
                                {i === 0 && <Home size={13} />}{c.label}
                            </button>
                        )}
                    </React.Fragment>
                );
            })}
        </nav>
    );
}
