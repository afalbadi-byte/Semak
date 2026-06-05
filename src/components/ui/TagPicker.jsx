import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Tag, Plus, X, Check } from 'lucide-react';
import { apiGet, apiPost } from '../../lib/api/client';

// ════════════════════════════════════════════════════════════════════════════
//  منتقي الوسوم (Tags) — نمط دفترة: إنشاء/تلوين/ربط/إزالة.
//  وضعان:
//   1) متحكَّم به محليًا (value + onChange) — للنماذج قبل الحفظ.
//   2) ربط فوري بالخادم (entity + entityId) — يحفظ التغييرات مباشرةً عبر acc_tag_set.
//  props:
//    value:    Array<{id,name,color}>   — الوسوم المختارة (في الوضع المتحكَّم).
//    onChange: (tags) => void           — عند تغيّر المجموعة.
//    entity:   string                   — نوع الكيان (invoice/party/product/expense...).
//    entityId: number                   — معرّف الكيان (يفعّل الحفظ الفوري).
//    tenant:   number                   — افتراضي 1.
//    readOnly: boolean                  — عرض فقط (شارات بلا تعديل).
//    size:     'sm' | 'md'              — حجم الشارات.
// ════════════════════════════════════════════════════════════════════════════

// لوحة ألوان ثابتة (لدعم Tailwind purge) — اسم اللون ↔ أصناف.
export const TAG_COLORS = {
    slate:   'bg-slate-100 text-slate-700 border-slate-200',
    red:     'bg-red-100 text-red-700 border-red-200',
    orange:  'bg-orange-100 text-orange-700 border-orange-200',
    amber:   'bg-amber-100 text-amber-700 border-amber-200',
    yellow:  'bg-yellow-100 text-yellow-700 border-yellow-200',
    lime:    'bg-lime-100 text-lime-700 border-lime-200',
    green:   'bg-green-100 text-green-700 border-green-200',
    emerald: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    teal:    'bg-teal-100 text-teal-700 border-teal-200',
    cyan:    'bg-cyan-100 text-cyan-700 border-cyan-200',
    sky:     'bg-sky-100 text-sky-700 border-sky-200',
    blue:    'bg-blue-100 text-blue-700 border-blue-200',
    indigo:  'bg-indigo-100 text-indigo-700 border-indigo-200',
    violet:  'bg-violet-100 text-violet-700 border-violet-200',
    purple:  'bg-purple-100 text-purple-700 border-purple-200',
    fuchsia: 'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
    pink:    'bg-pink-100 text-pink-700 border-pink-200',
    rose:    'bg-rose-100 text-rose-700 border-rose-200',
};
const COLOR_NAMES = Object.keys(TAG_COLORS);

// نقطة لون صغيرة (لمختار اللون).
const SWATCH = {
    slate: 'bg-slate-400', red: 'bg-red-500', orange: 'bg-orange-500', amber: 'bg-amber-500',
    yellow: 'bg-yellow-500', lime: 'bg-lime-500', green: 'bg-green-500', emerald: 'bg-emerald-500',
    teal: 'bg-teal-500', cyan: 'bg-cyan-500', sky: 'bg-sky-500', blue: 'bg-blue-500',
    indigo: 'bg-indigo-500', violet: 'bg-violet-500', purple: 'bg-purple-500', fuchsia: 'bg-fuchsia-500',
    pink: 'bg-pink-500', rose: 'bg-rose-500',
};

export function tagClass(color) {
    return TAG_COLORS[color] || TAG_COLORS.slate;
}

// شارة وسم للعرض (قابلة لإعادة الاستخدام في الجداول والفلاتر).
export function TagChip({ tag, size = 'sm', onRemove, className = '' }) {
    const pad = size === 'md' ? 'px-2.5 py-1 text-[12px]' : 'px-2 py-0.5 text-[11px]';
    return (
        <span className={`inline-flex items-center gap-1 rounded-full border font-bold whitespace-nowrap ${pad} ${tagClass(tag.color)} ${className}`}>
            {tag.name}
            {onRemove && (
                <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(tag); }}
                    className="opacity-60 hover:opacity-100 transition -ml-0.5">
                    <X size={12} />
                </button>
            )}
        </span>
    );
}

export default function TagPicker({
    value,
    onChange,
    entity,
    entityId,
    tenant = 1,
    readOnly = false,
    size = 'sm',
    className = '',
}) {
    const controlled = Array.isArray(value);
    const [selected, setSelected] = useState(controlled ? value : []);
    const [all, setAll]       = useState([]);     // كل الوسوم المتاحة
    const [open, setOpen]     = useState(false);
    const [query, setQuery]   = useState('');
    const [color, setColor]   = useState('blue'); // لون الوسم الجديد
    const [busy, setBusy]     = useState(false);
    const boxRef = useRef(null);

    useEffect(() => { if (controlled) setSelected(value || []); }, [value, controlled]);

    // جلب كل الوسوم المتاحة + (في وضع الربط) الوسوم الحالية للكيان.
    const loadAll = useCallback(() => {
        apiGet('acc_tags_list', { tenant })
            .then(r => setAll(Array.isArray(r?.data) ? r.data : []))
            .catch(() => setAll([]));
    }, [tenant]);

    useEffect(() => {
        loadAll();
        if (!controlled && entity && entityId) {
            apiGet('acc_tags_for', { tenant, entity, entity_id: entityId })
                .then(r => setSelected(Array.isArray(r?.data) ? r.data : []))
                .catch(() => {});
        }
    }, [loadAll, controlled, entity, entityId, tenant]);

    useEffect(() => {
        const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', onDoc);
        return () => document.removeEventListener('mousedown', onDoc);
    }, []);

    // مزامنة المجموعة المختارة (محليًا + للخادم إن كان وضع الربط).
    const commit = useCallback((next) => {
        setSelected(next);
        onChange?.(next);
        if (!controlled && entity && entityId) {
            apiPost('acc_tag_set', { tenant_id: tenant, entity, entity_id: entityId, tag_ids: next.map(t => t.id) })
                .catch(() => {});
        }
    }, [onChange, controlled, entity, entityId, tenant]);

    const isSel = (t) => selected.some(s => s.id === t.id);

    const toggle = (t) => {
        if (isSel(t)) commit(selected.filter(s => s.id !== t.id));
        else          commit([...selected, t]);
    };

    const remove = (t) => commit(selected.filter(s => s.id !== t.id));

    // إنشاء وسم جديد (أو إيجاد المطابق بالاسم) ثم إضافته.
    const createTag = async () => {
        const name = query.trim();
        if (!name || busy) return;
        const existing = all.find(t => t.name.toLowerCase() === name.toLowerCase());
        if (existing) { if (!isSel(existing)) toggle(existing); setQuery(''); return; }
        setBusy(true);
        try {
            const r = await apiPost('acc_tag_save', { tenant_id: tenant, name, color });
            if (r?.success && r.id) {
                const tag = { id: r.id, name, color };
                setAll(a => [...a, tag].sort((x, y) => x.name.localeCompare(y.name, 'ar')));
                commit([...selected, tag]);
                setQuery('');
            }
        } finally { setBusy(false); }
    };

    const filtered = all.filter(t =>
        t.name.toLowerCase().includes(query.trim().toLowerCase())
    );
    const exactExists = all.some(t => t.name.toLowerCase() === query.trim().toLowerCase());

    if (readOnly) {
        return (
            <div className={`flex flex-wrap gap-1 ${className}`}>
                {selected.length === 0
                    ? <span className="text-slate-300 text-xs">—</span>
                    : selected.map(t => <TagChip key={t.id} tag={t} size={size} />)}
            </div>
        );
    }

    return (
        <div ref={boxRef} className={`relative ${className}`}>
            <div className="flex flex-wrap items-center gap-1.5 min-h-[42px] px-2.5 py-2 rounded-xl border border-slate-200 bg-white focus-within:border-[#c5a059] focus-within:ring-2 focus-within:ring-[#c5a059]/20 transition">
                {selected.map(t => <TagChip key={t.id} tag={t} size={size} onRemove={remove} />)}
                <button type="button" onClick={() => setOpen(o => !o)}
                    className="inline-flex items-center gap-1 text-[12px] font-bold text-[#c5a059] hover:text-[#a8843f] transition">
                    <Tag size={13} /> {selected.length ? 'إضافة' : 'وسم'}
                </button>
            </div>

            {open && (
                <div className="absolute z-50 mt-1 w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-2 custom-scrollbar" dir="rtl">
                    <div className="flex items-center gap-1.5 mb-2">
                        <input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); createTag(); } }}
                            placeholder="ابحث أو أنشئ وسمًا..."
                            autoFocus
                            className="flex-1 px-2.5 py-1.5 rounded-lg border border-slate-200 outline-none text-sm font-bold text-[#1a365d] focus:border-[#c5a059]"
                        />
                        <button type="button" onClick={createTag} disabled={!query.trim() || busy}
                            title="إنشاء وسم جديد"
                            className="shrink-0 w-8 h-8 grid place-items-center rounded-lg bg-[#c5a059] text-white disabled:opacity-40 hover:bg-[#a8843f] transition">
                            <Plus size={16} />
                        </button>
                    </div>

                    {/* مختار اللون للوسم الجديد */}
                    {query.trim() && !exactExists && (
                        <div className="flex flex-wrap gap-1 mb-2 px-0.5">
                            {COLOR_NAMES.map(c => (
                                <button key={c} type="button" onClick={() => setColor(c)}
                                    title={c}
                                    className={`w-5 h-5 rounded-full ${SWATCH[c]} transition ${color === c ? 'ring-2 ring-offset-1 ring-[#1a365d]' : 'opacity-70 hover:opacity-100'}`} />
                            ))}
                        </div>
                    )}

                    <ul className="max-h-52 overflow-auto custom-scrollbar -mx-0.5">
                        {filtered.length === 0 && !query.trim() && (
                            <li className="px-2 py-3 text-center text-xs text-slate-400 font-bold">لا توجد وسوم بعد</li>
                        )}
                        {filtered.map(t => (
                            <li key={t.id}
                                onClick={() => toggle(t)}
                                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-slate-50 transition">
                                <TagChip tag={t} size={size} />
                                {isSel(t) && <Check size={15} className="text-emerald-600 shrink-0" />}
                            </li>
                        ))}
                        {query.trim() && !exactExists && (
                            <li onClick={createTag}
                                className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-slate-50 transition text-[12px] font-bold text-[#1a365d]">
                                <Plus size={13} className="text-[#c5a059]" />
                                إنشاء «<span className="text-[#c5a059]">{query.trim()}</span>»
                            </li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
}
