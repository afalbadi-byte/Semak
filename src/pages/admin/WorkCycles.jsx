import React, { useState, useEffect, useCallback } from 'react';
import {
    Layers, RefreshCw, ChevronLeft, Building2, DollarSign, ExternalLink,
    TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Receipt,
    ShoppingCart, Search, Link2, Users, Home, CheckSquare, Save, X,
    Calendar, FileText
} from 'lucide-react';

const API_URL = "https://semak.sa/api.php";

// ── مطابقة اسم المشروع مع work_order بدفترة ──────────────────────────────
// يزيل الأرقام والأقواس ويقارن النص الجوهري مع اشتراط تشابه كافٍ
function normName(s = '') {
    return s.replace(/[\d()\[\]#؟?.,،\-_]/g, '').replace(/\s+/g, ' ').trim();
}
function matchByName(projectName, woTitle) {
    const pn = normName(projectName);
    const wn = normName(woTitle);
    if (!pn || !wn) return false;
    if (pn === wn) return true;
    // تطابق جزئي فقط إذا كان الجزء الأقصر ≥ 70% من طول الأطول (لتفادي تطابقات واسعة مثل "سماك" مع "سماك الزايدي")
    const shorter = pn.length <= wn.length ? pn : wn;
    const longer  = pn.length <= wn.length ? wn : pn;
    return longer.includes(shorter) && shorter.length / longer.length >= 0.7;
}

export default function WorkCycles() {
    const [projects, setProjects]       = useState([]); // محلية
    const [workOrders, setWorkOrders]   = useState([]); // دفترة
    const [merged, setMerged]           = useState([]); // مدمجة
    const [loading, setLoading]         = useState(true);
    const [selected, setSelected]       = useState(null); // { type:'project'|'wo', id }
    const [search, setSearch]           = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        const [pRes, wRes] = await Promise.all([
            fetch(`${API_URL}?action=get_project_cycles`).then(r => r.json()).catch(() => ({ success: false })),
            fetch(`${API_URL}?action=daftra_list&module=work_orders`).then(r => r.json()).catch(() => ({ success: false })),
        ]);
        const localProjects = pRes.success ? (pRes.data || []) : [];
        const daftraWOs     = wRes.success ? (wRes.data || []) : [];
        setProjects(localProjects);
        setWorkOrders(daftraWOs);

        // دمج: كل مشروع محلي يُربط بـ work_order من دفترة
        const usedWoIds = new Set();
        const items = localProjects.map(p => {
            // ابحث عن work_order مطابق بالاسم أو بـ daftra_id المحفوظ
            const wo = daftraWOs.find(w =>
                (p.daftra_id && String(p.daftra_id) === String(w.id)) ||
                matchByName(p.name, w.title || '')
            );
            if (wo) usedWoIds.add(String(wo.id));
            return { type: 'project', project: p, wo: wo || null };
        });

        // أضف work_orders من دفترة التي لم تتطابق مع أي مشروع محلي
        daftraWOs.forEach(wo => {
            if (!usedWoIds.has(String(wo.id))) {
                items.push({ type: 'wo_only', wo, project: null });
            }
        });

        setMerged(items);
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = merged.filter(item => {
        if (!search) return true;
        const name = item.project?.name || item.wo?.title || '';
        return name.toLowerCase().includes(search.toLowerCase());
    });

    if (selected) {
        return (
            <CycleDetail
                item={selected}
                workOrders={workOrders}
                onBack={() => { setSelected(null); load(); }}
            />
        );
    }

    return (
        <div className="space-y-6 p-4 md:p-6">
            {/* رأس الصفحة */}
            <div className="bg-gradient-to-l from-[#1a365d] to-[#0f2543] rounded-[2rem] p-6 md:p-8 text-white shadow-xl">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-[#c5a059] rounded-2xl flex items-center justify-center shadow-lg">
                            <Layers size={32}/>
                        </div>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-black">دورات العمل</h1>
                            <p className="text-sm text-slate-300 mt-1">بيانات المشاريع المحلية مع الملخص المالي من دفترة</p>
                        </div>
                    </div>
                    <a href="https://semak.daftra.com/work_orders" target="_blank" rel="noreferrer"
                        className="bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition">
                        <ExternalLink size={14}/> دفترة
                    </a>
                </div>
            </div>

            {/* شريط البحث */}
            <div className="bg-white rounded-2xl shadow border border-slate-100 p-4 flex items-center gap-3">
                <div className="relative flex-1">
                    <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input type="text" placeholder="بحث باسم المشروع..." value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 pr-9 pl-3 py-2.5 rounded-xl outline-none focus:border-emerald-500"/>
                </div>
                <button onClick={load} className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 px-3 py-2.5 rounded-xl transition" title="تحديث">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
                </button>
                <span className="text-sm font-bold text-slate-500">{filtered.length} دورة</span>
            </div>

            {loading ? (
                <div className="bg-white rounded-2xl p-12 text-center">
                    <RefreshCw className="animate-spin inline mr-2 text-emerald-600"/> جاري التحميل...
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center text-slate-400">
                    <Layers size={48} className="mx-auto mb-3 opacity-50"/>
                    <p className="font-bold">لا توجد دورات عمل</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((item, i) => (
                        <CycleCard key={i} item={item} onOpen={() => setSelected(item)}/>
                    ))}
                </div>
            )}
        </div>
    );
}

// ─────────────── بطاقة الدورة ─────────────────────────────────────────────

function CycleCard({ item, onOpen }) {
    const { project: p, wo } = item;
    const name  = p?.name  || wo?.title || '—';
    const total = Number(p?.total_units || 0);
    const sold  = Number(p?.sold_units  || 0);
    const avail = Number(p?.available_units || 0);
    const soldPct = total > 0 ? Math.round((sold / total) * 100) : 0;
    const linked = !!wo;

    const statusMap = {
        '1': { label: 'مفتوحة',      cls: 'bg-emerald-100 text-emerald-700' },
        '2': { label: 'قيد التنفيذ', cls: 'bg-blue-100 text-blue-700' },
        '3': { label: 'مكتملة',      cls: 'bg-slate-200 text-slate-700' },
        '4': { label: 'ملغاة',       cls: 'bg-red-100 text-red-700' },
    };
    const st = wo ? (statusMap[String(wo.status)] || { label: wo.status || '—', cls: 'bg-slate-100 text-slate-600' }) : null;

    return (
        <div className="bg-white rounded-2xl shadow border border-slate-100 p-5 hover:shadow-md transition cursor-pointer" onClick={onOpen}>
            {/* رأس البطاقة */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-11 h-11 shrink-0 bg-[#1a365d] rounded-xl flex items-center justify-center">
                        <Building2 size={22} className="text-[#c5a059]"/>
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-lg font-black text-[#1a365d] truncate">{name}</h3>
                        {wo?.number && <p className="text-xs text-slate-400 font-mono">#{wo.number}</p>}
                    </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                    {st && <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${st.cls}`}>{st.label}</span>}
                    {linked
                        ? <span className="text-[10px] font-bold bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-lg flex items-center gap-1"><Link2 size={9}/>مرتبط بدفترة</span>
                        : p
                            ? <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg">محلي</span>
                            : <span className="text-[10px] font-bold bg-amber-50 text-amber-600 px-2 py-0.5 rounded-lg">دفترة فقط</span>
                    }
                </div>
            </div>

            {/* وحدات (إن وجدت) */}
            {p && (
                <>
                    <div className="grid grid-cols-3 gap-2 mb-3">
                        <MiniStat label="إجمالي" val={total} color="slate"/>
                        <MiniStat label="مباعة"  val={sold}  color="emerald"/>
                        <MiniStat label="متاحة"  val={avail} color="blue"/>
                    </div>
                    <div className="mb-3">
                        <div className="flex justify-between text-xs text-slate-500 mb-1">
                            <span>نسبة المبيعات</span>
                            <span className="font-bold text-[#1a365d]">{soldPct}%</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-gradient-to-l from-[#c5a059] to-[#1a365d] rounded-full"
                                style={{ width: `${soldPct}%` }}/>
                        </div>
                    </div>
                </>
            )}

            {/* تواريخ من دفترة */}
            {wo?.start_date && (
                <div className="flex items-center gap-1 text-xs text-slate-500 mb-1">
                    <Calendar size={11}/> بدء: {wo.start_date}
                    {wo.delivery_date && <> — تسليم: {wo.delivery_date}</>}
                </div>
            )}

            <div className="text-xs font-bold text-emerald-600 mt-3 pt-3 border-t border-slate-100">
                {linked ? 'عرض الملخص المالي ←' : p ? 'عرض الوحدات ←' : 'عرض التفاصيل ←'}
            </div>
        </div>
    );
}

function MiniStat({ label, val, color }) {
    const c = { slate: 'bg-slate-50 text-slate-600', emerald: 'bg-emerald-50 text-emerald-700', blue: 'bg-blue-50 text-blue-700' };
    return (
        <div className={`${c[color]} rounded-xl p-2 text-center`}>
            <div className="text-lg font-black">{val}</div>
            <div className="text-[10px] font-bold opacity-80">{label}</div>
        </div>
    );
}

// ─────────────── صفحة التفاصيل ───────────────────────────────────────────────

function CycleDetail({ item, workOrders, onBack }) {
    const { project: p, wo: initWo } = item;

    const [summary, setSummary] = useState(null);
    const [loading, setLoading] = useState(false);
    const [units,   setUnits]   = useState([]);
    const [linking, setLinking] = useState(false);
    const [selWoId, setSelWoId] = useState('');
    const [saving,  setSaving]  = useState(false);
    const [wo, setWo] = useState(initWo);

    const fmt = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

    // جلب الملخص المالي من دفترة
    const loadSummary = useCallback(async (woId) => {
        if (!woId) return;
        setLoading(true);
        const res = await fetch(`${API_URL}?action=daftra_work_order_summary&id=${woId}`)
            .then(r => r.json()).catch(() => null);
        if (res?.success) {
            setSummary(res.summary);
            setUnits([]); // سيُستبدل بالوحدات المحلية
        }
        setLoading(false);
    }, []);

    // جلب الوحدات من قاعدة البيانات المحلية
    useEffect(() => {
        if (!p?.id) return;
        fetch(`${API_URL}?action=project_cycle_summary&id=${p.id}`)
            .then(r => r.json())
            .then(j => { if (j.success) setUnits(j.units || []); });
    }, [p?.id]);

    useEffect(() => {
        if (wo?.id) loadSummary(wo.id);
    }, [wo?.id]);

    const saveLink = async () => {
        if (!selWoId || !p?.id) return;
        setSaving(true);
        await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'set_project_daftra_id', project_id: p.id, daftra_id: selWoId }),
        });
        const newWo = workOrders.find(w => String(w.id) === String(selWoId));
        setWo(newWo || null);
        setSaving(false);
        setLinking(false);
        if (newWo) loadSummary(newWo.id);
    };

    const removeLink = async () => {
        if (!p?.id) return;
        await fetch(API_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'set_project_daftra_id', project_id: p.id, daftra_id: null }),
        });
        setWo(null); setSummary(null);
    };

    const name = p?.name || wo?.title || '—';
    const total = Number(p?.total_units || 0);
    const sold  = Number(p?.sold_units  || 0);
    const avail = Number(p?.available_units || 0);

    return (
        <div className="space-y-6 p-4 md:p-6">
            <button onClick={onBack} className="flex items-center gap-2 text-[#1a365d] font-bold hover:text-emerald-600 transition">
                <ChevronLeft size={18}/> رجوع لدورات العمل
            </button>

            {/* رأس الدورة */}
            <div className="bg-gradient-to-l from-[#1a365d] to-[#0f2543] rounded-[2rem] p-6 text-white shadow-xl">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        {wo?.number && <div className="text-xs font-mono text-slate-400 mb-1">دورة عمل #{wo.number}</div>}
                        <h2 className="text-2xl font-black mb-1">{name}</h2>
                        {wo?.description && <p className="text-slate-300 text-sm mb-2">{wo.description}</p>}
                        <div className="flex flex-wrap gap-3 text-xs text-slate-300">
                            {wo?.start_date    && <span>📅 بدء: {wo.start_date}</span>}
                            {wo?.delivery_date && <span>🏁 تسليم: {wo.delivery_date}</span>}
                        </div>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                        {wo ? (
                            <>
                                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5">
                                    <Link2 size={11}/> مرتبط بدفترة #{wo.id}
                                </span>
                                {p && (
                                    <button onClick={removeLink}
                                        className="bg-white/10 hover:bg-white/20 text-white/70 px-2 py-1 rounded-lg text-xs flex items-center gap-1">
                                        <X size={10}/> تغيير الربط
                                    </button>
                                )}
                            </>
                        ) : p ? (
                            <button onClick={() => setLinking(true)}
                                className="bg-[#c5a059]/20 hover:bg-[#c5a059]/30 border border-[#c5a059]/40 text-[#c5a059] px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition">
                                <Link2 size={14}/> ربط بدفترة
                            </button>
                        ) : null}
                    </div>
                </div>
            </div>

            {/* نافذة الربط */}
            {linking && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                    <h3 className="font-black text-amber-900 mb-3 flex items-center gap-2">
                        <Link2 size={16}/> اختر دورة العمل في دفترة
                    </h3>
                    <select value={selWoId} onChange={e => setSelWoId(e.target.value)}
                        className="w-full border border-amber-300 bg-white rounded-xl px-3 py-2.5 outline-none focus:border-amber-500 text-sm mb-3">
                        <option value="">— اختر دورة العمل —</option>
                        {workOrders.map(w => (
                            <option key={w.id} value={w.id}>
                                {w.title || `دورة #${w.number}`} (ID: {w.id})
                            </option>
                        ))}
                    </select>
                    <div className="flex gap-2">
                        <button onClick={saveLink} disabled={!selWoId || saving}
                            className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition">
                            {saving ? <RefreshCw size={14} className="animate-spin"/> : <Save size={14}/>} حفظ
                        </button>
                        <button onClick={() => setLinking(false)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold transition">إلغاء</button>
                    </div>
                </div>
            )}

            {/* إحصائيات الوحدات */}
            {p && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <BigStat label="إجمالي الوحدات" value={total}  icon={Home}        color="slate"/>
                    <BigStat label="وحدات مباعة"     value={sold}   icon={CheckSquare} color="emerald"/>
                    <BigStat label="وحدات متاحة"     value={avail}  icon={Building2}   color="blue"/>
                    <BigStat label="نسبة المبيعات"
                        value={total > 0 ? `${Math.round((sold/total)*100)}%` : '—'}
                        icon={TrendingUp} color="gold"/>
                </div>
            )}

            {/* الملخص المالي */}
            {loading && (
                <div className="bg-white rounded-2xl p-8 text-center">
                    <RefreshCw className="animate-spin inline mr-2 text-emerald-600"/> جاري جلب البيانات المالية من دفترة...
                </div>
            )}

            {!loading && wo && summary && (
                <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <BigStat label="الإيرادات"   value={fmt(summary.total_revenue)}   icon={TrendingUp}   color="emerald"/>
                        <BigStat label="المشتريات"   value={fmt(summary.total_purchases)} icon={ShoppingCart} color="purple"/>
                        <BigStat label="المصروفات"   value={fmt(summary.total_expenses)}  icon={TrendingDown} color="red"/>
                        <BigStat label="صافي الربح"  value={fmt(summary.net_profit)}      icon={DollarSign}
                            color={summary.net_profit >= 0 ? 'emerald' : 'red'}/>
                    </div>

                    {/* مؤشر الميزانية */}
                    {summary.budget > 0 && (
                        <BudgetBar summary={summary} fmt={fmt}/>
                    )}
                </>
            )}

            {!loading && wo && !summary && (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-center text-slate-400">
                    <FileText size={32} className="mx-auto mb-2 opacity-40"/>
                    <p className="font-bold">لا توجد معاملات مالية لهذه الدورة في دفترة بعد</p>
                </div>
            )}

            {!wo && !linking && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 text-center">
                    <Link2 size={32} className="mx-auto mb-2 text-amber-400"/>
                    <p className="font-bold text-amber-800">غير مرتبط بدفترة</p>
                    <p className="text-sm text-amber-600 mt-1">اضغط "ربط بدفترة" لعرض الإيرادات والمصروفات</p>
                </div>
            )}

            {/* قائمة الوحدات */}
            {units.length > 0 && (
                <div className="bg-white rounded-2xl shadow border border-slate-100 overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex items-center gap-2 bg-slate-50/40">
                        <Users size={18} className="text-slate-700"/>
                        <h3 className="font-black text-[#1a365d]">الوحدات ({units.length})</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-sm">
                            <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                                <tr>
                                    <th className="px-3 py-2">رمز الوحدة</th>
                                    <th className="px-3 py-2">الحالة</th>
                                    <th className="px-3 py-2">المالك</th>
                                    <th className="px-3 py-2">الجوال</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {units.map((u, i) => (
                                    <tr key={i} className="hover:bg-slate-50/50">
                                        <td className="px-3 py-2 font-mono font-bold text-[#1a365d]">{u.unit_code}</td>
                                        <td className="px-3 py-2">
                                            <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${u.owner_name ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'}`}>
                                                {u.owner_name ? 'مباعة' : 'متاحة'}
                                            </span>
                                        </td>
                                        <td className="px-3 py-2">{u.owner_name || '—'}</td>
                                        <td className="px-3 py-2 font-mono">{u.owner_phone || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

function BudgetBar({ summary, fmt }) {
    const over = summary.budget_used_pct > 100;
    return (
        <div className={`rounded-2xl p-5 border ${over ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    {over ? <AlertTriangle className="text-red-600"/> : <CheckCircle2 className="text-emerald-600"/>}
                    <h3 className={`font-black ${over ? 'text-red-900' : 'text-[#1a365d]'}`}>استهلاك الميزانية</h3>
                </div>
                <div className={`text-2xl font-black ${over ? 'text-red-700' : 'text-emerald-700'}`}>{summary.budget_used_pct}%</div>
            </div>
            <div className="h-3 bg-white rounded-full overflow-hidden border border-slate-200">
                <div className={`h-full transition-all ${over ? 'bg-gradient-to-l from-red-500 to-orange-500' : 'bg-gradient-to-l from-emerald-500 to-teal-500'}`}
                    style={{ width: `${Math.min(100, summary.budget_used_pct)}%` }}/>
            </div>
            <div className="flex justify-between text-xs mt-2 font-bold">
                <span className="text-slate-600">استُهلك: {fmt(summary.total_cost)} ريال</span>
                <span className={summary.budget_left >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                    {summary.budget_left >= 0 ? 'متبقي' : 'تجاوز'}: {fmt(Math.abs(summary.budget_left))} ريال
                </span>
            </div>
        </div>
    );
}

function BigStat({ label, value, icon: Icon, color }) {
    const c = {
        slate:   'bg-slate-50  text-slate-700  border-slate-200',
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        blue:    'bg-blue-50    text-blue-700   border-blue-200',
        purple:  'bg-purple-50  text-purple-700 border-purple-200',
        red:     'bg-red-50     text-red-700    border-red-200',
        gold:    'bg-amber-50   text-amber-700  border-amber-200',
    };
    return (
        <div className={`border rounded-2xl p-4 ${c[color] || c.slate}`}>
            {Icon && <Icon size={18} className="mb-1 opacity-70"/>}
            <div className="text-[10px] font-bold opacity-80">{label}</div>
            <div className="text-2xl font-black">{value}</div>
        </div>
    );
}
