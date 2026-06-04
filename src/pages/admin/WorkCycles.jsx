import React, { useState, useEffect, useCallback } from 'react';
import {
    Layers, RefreshCw, ChevronLeft, Building2, DollarSign, ExternalLink,
    TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, ShoppingCart,
    Search, Calendar, FileText, Receipt, User, MapPin, Home,
    ChevronDown, ChevronUp, Image, Eye, Hash, Briefcase,
    Phone, Mail, CreditCard, Tag, Activity, Maximize2, X
} from 'lucide-react';

const API_URL = "https://semak.sa/api.php";

/* ── حالة المشروع من follow_up_status ── */
function statusStyle(fus) {
    if (!fus?.name) return { label: 'مفتوح', cls: 'bg-emerald-100 text-emerald-700' };
    const cm = {
        teal:   'bg-teal-100 text-teal-700',
        blue:   'bg-blue-100 text-blue-700',
        green:  'bg-emerald-100 text-emerald-700',
        red:    'bg-red-100 text-red-700',
        orange: 'bg-orange-100 text-orange-700',
        yellow: 'bg-yellow-100 text-yellow-700',
        purple: 'bg-purple-100 text-purple-700',
        grey:   'bg-slate-200 text-slate-700',
        gray:   'bg-slate-200 text-slate-700',
    };
    return { label: fus.name, cls: cm[fus.color] || 'bg-slate-100 text-slate-600' };
}

const fmt = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

/* ═══════════════════════════════════════════════════════════
   الصفحة الرئيسية
══════════════════════════════════════════════════════════════ */
export default function WorkCycles() {
    const [workCycles, setWorkCycles] = useState([]);
    const [loading,    setLoading]    = useState(true);
    const [error,      setError]      = useState('');
    const [selected,   setSelected]   = useState(null);
    const [search,     setSearch]     = useState('');

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const res = await fetch(`${API_URL}?action=daftra_v2_work_cycles`).then(r => r.json());
            if (res.success) setWorkCycles(res.data || []);
            else setError(res.message || 'فشل الاتصال بدفترة');
        } catch { setError('خطأ في الاتصال بالسيرفر'); }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = workCycles.filter(wc =>
        !search ||
        (wc.title || '').toLowerCase().includes(search.toLowerCase()) ||
        (wc.work_order_client?.business_name || '').toLowerCase().includes(search.toLowerCase())
    );

    if (selected) return <CycleDetail wc={selected} onBack={() => setSelected(null)} />;

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
                            <h1 className="text-2xl md:text-3xl font-black">المشاريع</h1>
                            <p className="text-sm text-slate-300 mt-1">
                                {loading ? 'جاري التحميل...' : `${workCycles.length} مشروع — يتزامن مباشرة مع دفترة`}
                            </p>
                        </div>
                    </div>
                    <a href="https://semak.daftra.com/v2/owner/entity/workflow/le_workflow-type-entity-1/list"
                        target="_blank" rel="noreferrer"
                        className="bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition">
                        <ExternalLink size={14}/> إدارة المشاريع في دفترة
                    </a>
                </div>
            </div>

            {/* شريط البحث */}
            <div className="bg-white rounded-2xl shadow border border-slate-100 p-4 flex items-center gap-3">
                <div className="relative flex-1">
                    <Search size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"/>
                    <input type="text" placeholder="بحث بالاسم أو اسم العميل..."
                        value={search} onChange={e => setSearch(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 pr-9 pl-3 py-2.5 rounded-xl outline-none focus:border-blue-500 text-sm"
                    />
                </div>
                <button onClick={load} className="bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-2.5 rounded-xl transition" title="تحديث">
                    <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/>
                </button>
                <span className="text-sm font-bold text-slate-500 shrink-0">{filtered.length} مشروع</span>
            </div>

            {/* القائمة */}
            {loading ? (
                <div className="bg-white rounded-2xl p-12 text-center text-slate-500">
                    <RefreshCw className="animate-spin inline ml-2 text-blue-500"/>جاري التحميل...
                </div>
            ) : error ? (
                <div className="bg-red-50 border border-red-200 rounded-2xl p-8 text-center text-red-700">
                    <AlertTriangle size={32} className="mx-auto mb-2"/>
                    <p className="font-bold">{error}</p>
                    <button onClick={load} className="mt-3 bg-red-100 hover:bg-red-200 px-4 py-2 rounded-xl text-sm font-bold transition">إعادة المحاولة</button>
                </div>
            ) : filtered.length === 0 ? (
                <div className="bg-white rounded-2xl p-12 text-center text-slate-400">
                    <Layers size={48} className="mx-auto mb-3 opacity-40"/>
                    <p className="font-bold">لا توجد مشاريع</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {filtered.map((wc, i) => <ProjectCard key={wc.id ?? i} wc={wc} onOpen={() => setSelected(wc)}/>)}
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   بطاقة المشروع في القائمة
══════════════════════════════════════════════════════════════ */
function ProjectCard({ wc, onOpen }) {
    const st      = statusStyle(wc.work_order_follow_up_status);
    const client  = wc.work_order_client?.business_name || '';
    const custom  = wc['le_workflow-type-entity-1_custom_data'] || {};
    const hasMap  = (() => { try { const m = JSON.parse(custom.map_location||'{}'); return m.lat && m.long; } catch { return false; } })();

    return (
        <div className="bg-white rounded-2xl shadow border border-slate-100 overflow-hidden hover:shadow-md transition">
            {/* شريط الحالة */}
            <div className="bg-gradient-to-l from-[#1a365d] to-[#0f2543] px-5 py-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Building2 size={18} className="text-[#c5a059]"/>
                    <span className="text-white font-black text-sm">{wc.title || `مشروع #${wc.number}`}</span>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${st.cls}`}>{st.label}</span>
            </div>

            {/* المحتوى */}
            <div className="p-5 space-y-3">
                {/* صف المعلومات الأساسية */}
                <div className="grid grid-cols-2 gap-3">
                    <InfoPill icon={Hash} label="رقم المشروع" value={`#${wc.number}`} color="slate"/>
                    <InfoPill icon={User} label="العميل" value={client} color="blue"/>
                    {wc.start_date && <InfoPill icon={Calendar} label="تاريخ البدء" value={wc.start_date} color="slate"/>}
                    {wc.delivery_date && <InfoPill icon={Calendar} label="التسليم" value={wc.delivery_date} color="amber"/>}
                    {custom.activity && <InfoPill icon={Home} label="النشاط" value={custom.activity} color="teal"/>}
                    {custom.work_order_type1 && <InfoPill icon={Briefcase} label="نوع العمل" value={custom.work_order_type1} color="indigo"/>}
                </div>

                {/* الميزانية + الوحدات */}
                <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                    <div>
                        <p className="text-[10px] text-slate-400 font-bold mb-0.5">الميزانية</p>
                        <p className="text-lg font-black text-[#1a365d]">{Number(wc.budget||0).toLocaleString('en-US')} <span className="text-xs text-slate-400">{wc.budget_currency || 'ريال'}</span></p>
                    </div>
                    {custom.apartment_count > 0 && (
                        <div className="text-left">
                            <p className="text-[10px] text-slate-400 font-bold mb-0.5">عدد الوحدات</p>
                            <p className="text-lg font-black text-[#1a365d]">{custom.apartment_count} <span className="text-xs text-slate-400">وحدة</span></p>
                        </div>
                    )}
                    {hasMap && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 font-bold">
                            <MapPin size={12}/> موقع محدد
                        </span>
                    )}
                </div>

                {/* زر التفاصيل */}
                <button onClick={onOpen}
                    className="w-full bg-[#1a365d] hover:bg-[#0f2543] text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition">
                    <Maximize2 size={15}/> عرض التفاصيل الكاملة
                </button>
            </div>
        </div>
    );
}

/* ── InfoPill مصغّر للبطاقة ── */
function InfoPill({ icon: Icon, label, value, color = 'slate' }) {
    if (!value) return null;
    const bg = {
        slate:  'bg-slate-50  text-slate-600',
        blue:   'bg-blue-50   text-blue-700',
        amber:  'bg-amber-50  text-amber-700',
        teal:   'bg-teal-50   text-teal-700',
        indigo: 'bg-indigo-50 text-indigo-700',
    };
    return (
        <div className={`${bg[color] || bg.slate} rounded-xl px-3 py-2`}>
            <div className="flex items-center gap-1.5 mb-0.5">
                <Icon size={11} className="opacity-60 shrink-0"/>
                <span className="text-[10px] font-bold opacity-70 truncate">{label}</span>
            </div>
            <p className="text-xs font-black truncate">{value}</p>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   صفحة التفاصيل الكاملة
══════════════════════════════════════════════════════════════ */
function CycleDetail({ wc, onBack }) {
    const [detail,   setDetail]   = useState(null);
    const [finance,  setFinance]  = useState(null);
    const [invoices, setInvoices] = useState([]);
    const [purchases,setPurchases]= useState([]);
    const [loading,  setLoading]  = useState(true);
    const [sections, setSections] = useState({
        info: true, property: true, attachments: true,
        client: false, finance: true, invoices: false, purchases: false
    });
    const [lightbox, setLightbox] = useState(null); // URL لمعاينة المرفق

    const toggle = key => setSections(p => ({ ...p, [key]: !p[key] }));

    useEffect(() => {
        if (!wc?.id) { setLoading(false); return; }
        fetch(`${API_URL}?action=daftra_v2_work_cycle_single&id=${wc.id}`)
            .then(r => r.json())
            .then(j => {
                if (j.success) {
                    setDetail(j.data);
                    setFinance(j.finance);
                    setInvoices(j.invoices || []);
                    setPurchases(j.purchases || []);
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [wc?.id]);

    const d       = detail || wc;
    const custom  = d['le_workflow-type-entity-1_custom_data'] || {};
    const client  = d.work_order_client || {};
    const st      = statusStyle(d.work_order_follow_up_status);
    const staff   = d.staff || {};

    // موقع الخريطة
    let mapLat = null, mapLng = null;
    try { const m = JSON.parse(custom.map_location || '{}'); mapLat = m.lat; mapLng = m.long; } catch {}

    return (
        <div className="space-y-4 p-4 md:p-6">
            {/* رجوع */}
            <button onClick={onBack} className="flex items-center gap-2 text-[#1a365d] font-bold hover:text-blue-600 transition text-sm">
                <ChevronLeft size={18}/> رجوع للمشاريع
            </button>

            {/* Header بانر */}
            <div className="bg-gradient-to-l from-[#1a365d] to-[#0f2543] rounded-[2rem] p-6 text-white shadow-xl">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                        {wc.number && <div className="text-xs font-mono text-slate-400 mb-1">مشروع #{wc.number}</div>}
                        <h2 className="text-2xl font-black mb-1">{d.title}</h2>
                        {client.business_name && (
                            <div className="flex items-center gap-2 text-slate-300 text-sm mb-3">
                                <User size={13}/> {client.business_name}
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2 text-xs">
                            {d.start_date    && <span className="bg-white/10 px-3 py-1 rounded-full">📅 بدء: {d.start_date}</span>}
                            {d.delivery_date && <span className="bg-white/10 px-3 py-1 rounded-full">🏁 تسليم: {d.delivery_date}</span>}
                            {custom.activity && <span className="bg-white/10 px-3 py-1 rounded-full">🏗️ {custom.activity}</span>}
                            {custom.apartment_count > 0 && <span className="bg-white/10 px-3 py-1 rounded-full">🏢 {custom.apartment_count} وحدة</span>}
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-xl ${st.cls}`}>{st.label}</span>
                        {Number(d.budget) > 0 && (
                            <div className="bg-white/10 px-3 py-1.5 rounded-xl text-right">
                                <div className="text-[10px] text-slate-400">الميزانية</div>
                                <div className="text-base font-black">{fmt(d.budget)} {d.budget_currency || 'ريال'}</div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══ معلومات المشروع ═══ */}
            <Section title="معلومات المشروع" icon={FileText} color="blue" open={sections.info} onToggle={() => toggle('info')}>
                <InfoRow icon={Hash}      label="رقم المشروع"   value={`#${d.number}`}/>
                <InfoRow icon={Tag}       label="نوع العمل"      value={custom.work_order_type1}/>
                <InfoRow icon={Calendar}  label="تاريخ البدء"   value={d.start_date}/>
                <InfoRow icon={Calendar}  label="تاريخ التسليم" value={d.delivery_date}/>
                <InfoRow icon={DollarSign} label="الميزانية"    value={Number(d.budget)>0 ? `${fmt(d.budget)} ${d.budget_currency||'ريال'}` : null}/>
                <InfoRow icon={Building2} label="الفرع"          value={d.branch?.name}/>
                <InfoRow icon={User}      label="أُضيف بواسطة"  value={staff.full_name}/>
                <InfoRow icon={Activity}  label="الحالة"         value={st.label} valueClass={`font-bold px-2 py-0.5 rounded-lg text-xs ${st.cls}`}/>
            </Section>

            {/* ═══ تفاصيل العقار ═══ */}
            <Section title="تفاصيل العقار والموقع" icon={Home} color="teal" open={sections.property} onToggle={() => toggle('property')}>
                <InfoRow icon={Home}      label="النشاط"          value={custom.activity}/>
                <InfoRow icon={Briefcase} label="نوع المشروع"     value={custom.work_order_type1}/>
                <InfoRow icon={Building2} label="عدد الوحدات"     value={custom.apartment_count ? `${custom.apartment_count} وحدة` : null}/>
                <InfoRow icon={MapPin}    label="اسم الموقع"       value={custom.site_location1}/>
                <InfoRow icon={FileText}  label="اسم المشروع"     value={custom.project_name}/>
                <InfoRow icon={Layers}    label="مساحة الموقع"    value={custom.location_space}/>
                {mapLat && mapLng && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                        <a href={`https://www.google.com/maps?q=${mapLat},${mapLng}`}
                            target="_blank" rel="noreferrer"
                            className="flex items-center gap-2 text-emerald-600 hover:text-emerald-800 font-bold text-sm transition">
                            <MapPin size={16}/> فتح الموقع في خرائط جوجل
                        </a>
                    </div>
                )}
            </Section>

            {/* ═══ المرفقات ═══ */}
            <Section title="المرفقات" icon={Image} color="purple" open={sections.attachments} onToggle={() => toggle('attachments')}>
                <AttachRow
                    icon={FileText} label="المخطط الهندسي"
                    value={custom.engineering_chart}
                    onView={url => setLightbox(url)}
                />
                <AttachRow
                    icon={Image} label="صورة الموقع"
                    value={custom.location_photo}
                    isImage
                    onView={url => setLightbox(url)}
                />
                {!custom.engineering_chart && !custom.location_photo && (
                    <p className="text-center text-slate-400 text-sm py-4">
                        لا توجد مرفقات مضافة لهذا المشروع في دفترة بعد
                    </p>
                )}
            </Section>

            {/* ═══ بيانات العميل ═══ */}
            <Section title="بيانات العميل" icon={User} color="indigo" open={sections.client} onToggle={() => toggle('client')}>
                <InfoRow icon={User}     label="اسم المنشأة"   value={client.business_name}/>
                <InfoRow icon={CreditCard} label="الرقم الضريبي" value={client.bn1}/>
                <InfoRow icon={CreditCard} label="السجل التجاري" value={client.bn2}/>
                <InfoRow icon={Phone}    label="الجوال"          value={client.phone2 || client.phone1}/>
                <InfoRow icon={Mail}     label="البريد"           value={client.email}/>
                <InfoRow icon={MapPin}   label="المدينة"         value={client.state}/>
            </Section>

            {/* ═══ الملخص المالي ═══ */}
            {(loading || finance) && (
                <Section title="الملخص المالي" icon={DollarSign} color="emerald" open={sections.finance} onToggle={() => toggle('finance')}>
                    {loading ? (
                        <div className="text-center py-6 text-slate-400">
                            <RefreshCw size={20} className="animate-spin inline ml-2"/>جاري الحساب...
                        </div>
                    ) : finance ? (
                        <>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                <FinanceStat label="الإيرادات"  value={fmt(finance.revenue)}   icon={TrendingUp}   color="emerald"/>
                                <FinanceStat label="المشتريات"  value={fmt(finance.purchases)} icon={ShoppingCart} color="purple"/>
                                <FinanceStat label="المصروفات"  value={fmt(finance.expenses)}  icon={TrendingDown} color="red"/>
                                <FinanceStat label="صافي الربح" value={fmt(finance.net)}       icon={DollarSign}   color={finance.net >= 0 ? 'emerald' : 'red'}/>
                            </div>
                            {finance.budget > 0 && <BudgetBar finance={finance}/>}
                        </>
                    ) : (
                        <p className="text-center text-slate-400 text-sm py-4">لا توجد معاملات مالية بعد</p>
                    )}
                </Section>
            )}

            {/* ═══ الفواتير ═══ */}
            {invoices.length > 0 && (
                <Section title={`الفواتير (${invoices.length})`} icon={Receipt} color="blue" open={sections.invoices} onToggle={() => toggle('invoices')}>
                    <TransTable
                        rows={invoices}
                        cols={[
                            { key: 'no',     label: 'رقم' },
                            { key: 'date',   label: 'التاريخ' },
                            { key: 'client', label: 'العميل' },
                            { key: 'total',  label: 'الإجمالي', fmt },
                            { key: 'paid',   label: 'المدفوع',  fmt },
                        ]}
                    />
                </Section>
            )}

            {/* ═══ المشتريات ═══ */}
            {purchases.length > 0 && (
                <Section title={`المشتريات (${purchases.length})`} icon={ShoppingCart} color="amber" open={sections.purchases} onToggle={() => toggle('purchases')}>
                    <TransTable
                        rows={purchases}
                        cols={[
                            { key: 'no',       label: 'رقم' },
                            { key: 'date',     label: 'التاريخ' },
                            { key: 'supplier', label: 'المورد' },
                            { key: 'total',    label: 'الإجمالي', fmt },
                        ]}
                    />
                </Section>
            )}

            {/* لايتبوكس المرفق */}
            {lightbox && (
                <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
                    <div className="relative max-w-4xl max-h-[90vh] w-full" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setLightbox(null)}
                            className="absolute -top-10 left-0 text-white hover:text-red-300 flex items-center gap-1 font-bold text-sm">
                            <X size={18}/> إغلاق
                        </button>
                        <img src={lightbox} alt="مرفق" className="w-full h-auto max-h-[85vh] object-contain rounded-2xl shadow-2xl"/>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ═══════════════════════════════════════════════════════════
   مكوّنات مساعدة
══════════════════════════════════════════════════════════════ */

/* ── قسم قابل للطي ── */
function Section({ title, icon: Icon, color = 'blue', open, onToggle, children }) {
    const colors = {
        blue:    'text-blue-600',
        teal:    'text-teal-600',
        emerald: 'text-emerald-600',
        purple:  'text-purple-600',
        indigo:  'text-indigo-600',
        amber:   'text-amber-600',
        red:     'text-red-600',
    };
    return (
        <div className="bg-white rounded-2xl shadow border border-slate-100 overflow-hidden">
            <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/70 transition"
                onClick={onToggle}>
                <div className="flex items-center gap-2.5">
                    <Icon size={18} className={colors[color] || 'text-slate-600'}/>
                    <span className="font-black text-[#1a365d] text-sm">{title}</span>
                </div>
                {open
                    ? <ChevronUp size={16} className="text-slate-400"/>
                    : <ChevronDown size={16} className="text-slate-400"/>
                }
            </button>
            {open && <div className="border-t border-slate-100 px-5 py-4">{children}</div>}
        </div>
    );
}

/* ── صف معلومة ── */
function InfoRow({ icon: Icon, label, value, valueClass }) {
    return (
        <div className="flex items-start justify-between py-2.5 border-b border-slate-50 last:border-0 gap-3">
            <div className="flex items-center gap-2 text-slate-400 text-sm shrink-0">
                {Icon && <Icon size={13}/>}
                <span className="text-slate-500 font-medium">{label}</span>
            </div>
            <span className={valueClass || 'font-bold text-[#1a365d] text-sm text-left'}>
                {value || <span className="text-slate-300 text-xs font-normal italic">غير محدد</span>}
            </span>
        </div>
    );
}

/* ── صف مرفق ── */
function AttachRow({ icon: Icon, label, value, isImage, onView }) {
    return (
        <div className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0 gap-3">
            <div className="flex items-center gap-2 text-sm">
                <Icon size={15} className={value ? 'text-blue-500' : 'text-slate-300'}/>
                <span className={`font-medium ${value ? 'text-slate-700' : 'text-slate-400'}`}>{label}</span>
            </div>
            {value ? (
                <button onClick={() => onView(value)}
                    className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-xl transition">
                    <Eye size={12}/> {isImage ? 'معاينة الصورة' : 'فتح الملف'}
                </button>
            ) : (
                <span className="text-[11px] text-slate-300 italic">لم يُرفق بعد</span>
            )}
        </div>
    );
}

/* ── بطاقة مالية ── */
function FinanceStat({ label, value, icon: Icon, color }) {
    const c = {
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        purple:  'bg-purple-50  text-purple-700  border-purple-200',
        red:     'bg-red-50     text-red-700     border-red-200',
        blue:    'bg-blue-50    text-blue-700    border-blue-200',
    };
    return (
        <div className={`border rounded-2xl p-4 ${c[color] || c.blue}`}>
            <Icon size={17} className="mb-1.5 opacity-70"/>
            <div className="text-[10px] font-bold opacity-80 mb-0.5">{label}</div>
            <div className="text-xl font-black">{value}</div>
        </div>
    );
}

/* ── شريط الميزانية ── */
function BudgetBar({ finance }) {
    const over = finance.budget_used_pct > 100;
    return (
        <div className={`rounded-2xl p-4 border mt-1 ${over ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                    {over ? <AlertTriangle size={15} className="text-red-600"/> : <CheckCircle2 size={15} className="text-emerald-600"/>}
                    <span className={`text-sm font-black ${over ? 'text-red-900' : 'text-[#1a365d]'}`}>استهلاك الميزانية</span>
                </div>
                <span className={`text-xl font-black ${over ? 'text-red-700' : 'text-emerald-700'}`}>{finance.budget_used_pct}%</span>
            </div>
            <div className="h-2.5 bg-white rounded-full overflow-hidden border border-slate-200">
                <div className={`h-full ${over ? 'bg-red-500' : 'bg-emerald-500'} transition-all`}
                    style={{ width: `${Math.min(100, finance.budget_used_pct)}%` }}/>
            </div>
            <div className="flex justify-between text-xs font-bold mt-2">
                <span className="text-slate-500">استُهلك: {fmt(finance.total_cost)} ريال</span>
                <span className={finance.budget_left >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                    {finance.budget_left >= 0 ? 'متبقي' : 'تجاوز'}: {fmt(Math.abs(finance.budget_left))} ريال
                </span>
            </div>
        </div>
    );
}

/* ── جدول المعاملات ── */
function TransTable({ rows, cols }) {
    return (
        <div className="overflow-x-auto rounded-xl border border-slate-100">
            <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 border-b border-slate-100">
                    <tr>{cols.map(c => <th key={c.key} className="px-3 py-2.5 font-bold">{c.label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {rows.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50/60">
                            {cols.map(c => (
                                <td key={c.key} className="px-3 py-2.5 text-slate-700">
                                    {c.fmt ? c.fmt(row[c.key]) : (row[c.key] || '—')}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
