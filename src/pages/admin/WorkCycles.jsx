import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Layers, RefreshCw, ChevronLeft, Building2, DollarSign, ExternalLink,
    TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, ShoppingCart,
    Search, Calendar, FileText, Receipt, User, MapPin, Home,
    ChevronDown, ChevronUp, Image, Eye, Hash, Briefcase,
    Phone, Mail, CreditCard, Activity, X, Edit3
} from 'lucide-react';

import { API_URL } from '../../lib/api/client';
import { usePartyDirectory } from '../../hooks/usePartyDirectory';
const DAFTRA  = "https://semak.daftra.com";

const fmt = n => Number(n || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });

function statusStyle(fus) {
    if (!fus?.name) return { label: 'مفتوح', cls: 'bg-emerald-100 text-emerald-700' };
    const cm = { teal:'bg-teal-100 text-teal-700', blue:'bg-blue-100 text-blue-700',
        green:'bg-emerald-100 text-emerald-700', red:'bg-red-100 text-red-700',
        orange:'bg-orange-100 text-orange-700', yellow:'bg-yellow-100 text-yellow-700',
        purple:'bg-purple-100 text-purple-700', grey:'bg-slate-200 text-slate-700', gray:'bg-slate-200 text-slate-700' };
    return { label: fus.name, cls: cm[fus.color] || 'bg-slate-100 text-slate-600' };
}

/* ═══════════════════════════════════════════════════════ */
export default function WorkCycles() {
    const [list,    setList]    = useState([]);
    const [loading, setLoading] = useState(true);
    const [error,   setError]   = useState('');
    const [sel,     setSel]     = useState(null);
    const [q,       setQ]       = useState('');

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const r = await fetch(`${API_URL}?action=daftra_v2_work_cycles`).then(r => r.json());
            if (r.success) setList(r.data || []);
            else setError(r.message || 'فشل الاتصال');
        } catch { setError('خطأ في الاتصال'); }
        setLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const filtered = list.filter(wc =>
        !q ||
        (wc.title || '').includes(q) ||
        (wc.work_order_client?.business_name || '').includes(q)
    );

    if (sel) return <Detail wc={sel} onBack={() => setSel(null)} />;

    return (
        <div className="space-y-5 p-4 md:p-6">
            {/* هيدر */}
            <div className="bg-gradient-to-l from-[#1a365d] to-[#0f2543] rounded-[2rem] p-6 text-white shadow-xl">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-[#c5a059] rounded-2xl flex items-center justify-center shadow-lg">
                            <Layers size={28}/>
                        </div>
                        <div>
                            <h1 className="text-2xl font-black">المشاريع</h1>
                            <p className="text-sm text-slate-300 mt-0.5">
                                {loading ? 'جاري التحميل...' : `${list.length} مشروع — مباشر من دفترة`}
                            </p>
                        </div>
                    </div>
                    <button onClick={load} className="bg-white/10 hover:bg-white/20 border border-white/20 px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition">
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''}/> تحديث
                    </button>
                </div>
            </div>

            {/* بحث */}
            <div className="bg-white dark:bg-brand-900 rounded-2xl shadow border border-slate-100 dark:border-brand-700 p-3 flex items-center gap-3">
                <div className="relative flex-1">
                    <Search size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-brand-400"/>
                    <input value={q} onChange={e => setQ(e.target.value)} placeholder="بحث..."
                        className="w-full bg-slate-50 dark:bg-brand-900 border border-slate-200 dark:border-brand-700 pr-9 pl-3 py-2 rounded-xl outline-none focus:border-blue-400 text-sm dark:text-brand-50 dark:placeholder-brand-500"/>
                </div>
                <span className="text-xs font-bold text-slate-400 dark:text-brand-400 shrink-0">{filtered.length} مشروع</span>
            </div>

            {/* الحالات */}
            {loading ? (
                <div className="bg-white dark:bg-brand-900 rounded-2xl p-10 text-center text-slate-400 dark:text-brand-400 text-sm">
                    <RefreshCw className="animate-spin inline ml-2 text-blue-500" size={18}/>تحميل...
                </div>
            ) : error ? (
                <div className="bg-red-50 dark:bg-red-500/15 border border-red-200 dark:border-red-500/30 rounded-2xl p-6 text-center text-red-700 dark:text-red-300">
                    <AlertTriangle size={28} className="mx-auto mb-2"/>
                    <p className="font-bold text-sm">{error}</p>
                    <button onClick={load} className="mt-3 bg-red-100 dark:bg-red-500/20 px-4 py-2 rounded-xl text-sm font-bold">إعادة المحاولة</button>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {filtered.map((wc, i) => <Card key={wc.id ?? i} wc={wc} onOpen={() => setSel(wc)}/>)}
                </div>
            )}
        </div>
    );
}

/* ── بطاقة المشروع ── */
function Card({ wc, onOpen }) {
    const st     = statusStyle(wc.work_order_follow_up_status);
    const client = wc.work_order_client?.business_name || '';
    const custom = wc['le_workflow-type-entity-1_custom_data'] || {};

    return (
        <div className="bg-white dark:bg-brand-900 rounded-2xl shadow border border-slate-100 dark:border-brand-700 overflow-hidden hover:shadow-md transition cursor-pointer" onClick={onOpen}>
            {/* شريط العنوان */}
            <div className="bg-gradient-to-l from-[#1a365d] to-[#152d55] px-5 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                    <Building2 size={16} className="text-[#c5a059] shrink-0"/>
                    <span className="text-white font-black text-sm truncate">{wc.title}</span>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${st.cls}`}>{st.label}</span>
            </div>

            <div className="p-4 space-y-3">
                {/* صفوف المعلومات */}
                <div className="space-y-1.5">
                    <Row icon={Hash}      label="رقم المشروع" value={`#${wc.number}`}/>
                    {client   && <Row icon={User}     label="العميل"      value={client}/>}
                    {wc.start_date    && <Row icon={Calendar} label="بدء العمل"   value={wc.start_date}/>}
                    {wc.delivery_date && <Row icon={Calendar} label="التسليم"    value={wc.delivery_date} highlight/>}
                    {custom.activity  && <Row icon={Home}     label="النشاط"     value={custom.activity}/>}
                    {custom.work_order_type1 && <Row icon={Briefcase} label="نوع العمل" value={custom.work_order_type1}/>}
                    {custom.apartment_count > 0 && <Row icon={Building2} label="عدد الوحدات" value={`${custom.apartment_count} وحدة`}/>}
                </div>

                {/* الميزانية */}
                {Number(wc.budget) > 0 && (
                    <div className="bg-slate-50 dark:bg-brand-800/40 rounded-xl px-4 py-2.5 flex items-center justify-between">
                        <span className="text-xs text-slate-400 dark:text-brand-400 font-bold">الميزانية</span>
                        <span className="text-base font-black text-brand-800 dark:text-brand-100">
                            {fmt(wc.budget)} <span className="text-xs text-slate-400 font-normal">{wc.budget_currency || 'ريال'}</span>
                        </span>
                    </div>
                )}

                <div className="pt-1 text-xs font-bold text-blue-600 flex items-center gap-1">
                    عرض التفاصيل والملخص المالي <ChevronLeft size={13}/>
                </div>
            </div>
        </div>
    );
}

function Row({ icon: Icon, label, value, highlight }) {
    return (
        <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-1.5 text-slate-400">
                <Icon size={12}/>
                <span className="text-xs">{label}</span>
            </div>
            <span className={`text-xs font-bold ${highlight ? 'text-amber-700 dark:text-amber-300' : 'text-slate-700 dark:text-brand-300'}`}>{value}</span>
        </div>
    );
}

/* ═══════════════════════════════════════════════════════
   صفحة التفاصيل الكاملة
═══════════════════════════════════════════════════════ */
function Detail({ wc, onBack }) {
    const navigate   = useNavigate();
    const partyDir   = usePartyDirectory();
    const [data,     setData]     = useState(null);
    const [finance,  setFinance]  = useState(null);
    const [invoices, setInvoices] = useState([]);
    const [purchases,setPurchases]= useState([]);
    const [loading,  setLoading]  = useState(true);
    const [open,     setOpen]     = useState({ info:true, client:false, finance:true, invoices:true, purchases:true });
    const [lightbox, setLightbox] = useState(null);

    const tog = k => setOpen(p => ({...p, [k]: !p[k]}));

    useEffect(() => {
        if (!wc?.id) { setLoading(false); return; }
        fetch(`${API_URL}?action=daftra_v2_work_cycle_single&id=${wc.id}`)
            .then(r => r.json())
            .then(j => {
                if (j.success) {
                    setData(j.data);
                    setFinance(j.finance);
                    setInvoices(j.invoices || []);
                    setPurchases(j.purchases || []);
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [wc?.id]);

    const d      = data || wc;
    const custom = d['le_workflow-type-entity-1_custom_data'] || {};
    const client = d.work_order_client || {};
    const st     = statusStyle(d.work_order_follow_up_status);
    const staff  = d.staff || {};

    // خرائط
    let mapLat = null, mapLng = null;
    try { const m = JSON.parse(custom.map_location || '{}'); mapLat = m.lat; mapLng = m.long; } catch {}
    const hasMap = mapLat && mapLng;

    // المرفقات الموجودة فقط
    const attachments = [
        { label: 'المخطط الهندسي', value: custom.engineering_chart, isImage: false },
        { label: 'صورة الموقع',    value: custom.location_photo,   isImage: true  },
    ].filter(a => a.value);

    return (
        <div className="space-y-4 p-4 md:p-6">
            {/* رجوع */}
            <div className="flex items-center justify-between">
                <button onClick={onBack} className="flex items-center gap-2 text-brand-800 dark:text-brand-300 font-bold hover:text-blue-600 transition text-sm">
                    <ChevronLeft size={18}/> رجوع للمشاريع
                </button>
                <a href={`${DAFTRA}/v2/owner/entity/workflow/le_workflow-type-entity-1/${wc.id}/edit`}
                    target="_blank" rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 border border-slate-200 px-3 py-1.5 rounded-xl transition">
                    <Edit3 size={12}/> تعديل في دفترة
                </a>
            </div>

            {/* هيدر المشروع */}
            <div className="bg-gradient-to-l from-[#1a365d] to-[#0f2543] rounded-[2rem] p-6 text-white shadow-xl">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <div className="text-xs font-mono text-slate-400 mb-1">#{d.number}</div>
                        <h2 className="text-2xl font-black mb-2">{d.title}</h2>
                        {client.business_name && (
                            <div className="flex items-center gap-2 text-slate-300 text-sm mb-3">
                                <User size={13}/> {client.business_name}
                            </div>
                        )}
                        <div className="flex flex-wrap gap-2">
                            {d.start_date    && <Chip label={`📅 بدء: ${d.start_date}`}/>}
                            {d.delivery_date && <Chip label={`🏁 تسليم: ${d.delivery_date}`} warn/>}
                            {custom.activity && <Chip label={`🏗️ ${custom.activity}`}/>}
                            {custom.apartment_count > 0 && <Chip label={`🏢 ${custom.apartment_count} وحدة`}/>}
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className={`text-xs font-bold px-3 py-1.5 rounded-xl ${st.cls}`}>{st.label}</span>
                        {Number(d.budget) > 0 && (
                            <div className="bg-white/10 rounded-xl px-3 py-2 text-right">
                                <div className="text-[10px] text-slate-400">الميزانية</div>
                                <div className="text-lg font-black">{fmt(d.budget)} <span className="text-xs text-slate-300">{d.budget_currency||'ريال'}</span></div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* ═══ معلومات المشروع ═══ */}
            <Sec title="معلومات المشروع" icon={FileText} color="blue" open={open.info} onToggle={() => tog('info')}>
                <IRow icon={Hash}      label="رقم المشروع"    value={`#${d.number}`}/>
                <IRow icon={Briefcase} label="نوع المشروع"    value={custom.work_order_type1}/>
                <IRow icon={Home}      label="النشاط"          value={custom.activity}/>
                <IRow icon={Building2} label="عدد الوحدات"    value={custom.apartment_count ? `${custom.apartment_count} وحدة` : null}/>
                <IRow icon={FileText}  label="مساحة الموقع"   value={custom.location_space}/>
                <IRow icon={MapPin}    label="اسم الموقع"      value={custom.site_location1}/>
                <IRow icon={Calendar}  label="تاريخ البدء"    value={d.start_date}/>
                <IRow icon={Calendar}  label="تاريخ التسليم"  value={d.delivery_date}/>
                <IRow icon={DollarSign} label="الميزانية"     value={Number(d.budget)>0 ? `${fmt(d.budget)} ${d.budget_currency||'ريال'}` : null}/>
                <IRow icon={User}      label="أُضيف بواسطة"  value={staff.full_name}/>
                <IRow icon={Building2} label="الفرع"          value={d.branch?.name}/>
                <IRow icon={Activity}  label="الحالة الحالية" value={st.label} valueCls={`inline-block font-bold px-2 py-0.5 rounded-lg text-[11px] ${st.cls}`}/>
                {hasMap && (
                    <a href={`https://www.google.com/maps?q=${mapLat},${mapLng}`}
                        target="_blank" rel="noreferrer"
                        className="mt-3 pt-3 border-t border-slate-100 flex items-center gap-2 text-emerald-600 hover:text-emerald-800 font-bold text-sm transition">
                        <MapPin size={15}/> فتح موقع المشروع في خرائط جوجل
                    </a>
                )}
            </Sec>

            {/* ═══ المرفقات — تظهر فقط لو فيه مرفقات ═══ */}
            {attachments.length > 0 && (
                <Sec title={`المرفقات (${attachments.length})`} icon={Image} color="purple" open={open.attachments ?? true} onToggle={() => tog('attachments')}>
                    {attachments.map((a, i) => (
                        <div key={i} className="flex items-center justify-between py-3 border-b border-slate-50 last:border-0">
                            <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                {a.isImage ? <Image size={15} className="text-blue-500"/> : <FileText size={15} className="text-blue-500"/>}
                                {a.label}
                            </div>
                            <button onClick={() => setLightbox(a.value)}
                                className="flex items-center gap-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-xl transition">
                                <Eye size={12}/> {a.isImage ? 'معاينة الصورة' : 'فتح الملف'}
                            </button>
                        </div>
                    ))}
                </Sec>
            )}

            {/* ═══ بيانات العميل ═══ */}
            {client.business_name && (
                <Sec title="بيانات العميل" icon={User} color="indigo" open={open.client} onToggle={() => tog('client')}>
                    <IRow icon={User}       label="اسم المنشأة"    value={client.business_name}/>
                    <IRow icon={CreditCard} label="الرقم الضريبي"  value={client.bn1}/>
                    <IRow icon={CreditCard} label="السجل التجاري"  value={client.bn2}/>
                    <IRow icon={Phone}      label="الجوال"          value={client.phone2 || client.phone1}/>
                    <IRow icon={Mail}       label="البريد الإلكتروني" value={client.email}/>
                    <IRow icon={MapPin}     label="المدينة"          value={client.state}/>
                </Sec>
            )}

            {/* ═══ الملخص المالي ═══ */}
            <Sec title="الملخص المالي" icon={DollarSign} color="emerald" open={open.finance} onToggle={() => tog('finance')}>
                {loading ? (
                    <div className="text-center py-6 text-slate-400 text-sm">
                        <RefreshCw size={18} className="animate-spin inline ml-2"/>جاري الحساب...
                    </div>
                ) : finance ? (
                    <>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                            <FStat label="الإيرادات"  value={fmt(finance.revenue)}   icon={TrendingUp}   color="emerald"/>
                            <FStat label="المشتريات"  value={fmt(finance.purchases)} icon={ShoppingCart} color="purple"/>
                            <FStat label="المصروفات"  value={fmt(finance.expenses)}  icon={TrendingDown} color="red"/>
                            <FStat label="صافي الربح" value={fmt(finance.net)}       icon={DollarSign}   color={finance.net >= 0 ? 'emerald' : 'red'}/>
                        </div>
                        {finance.budget > 0 && <BudgetBar f={finance}/>}
                    </>
                ) : (
                    <p className="text-center text-slate-400 text-sm py-4">لا توجد معاملات مالية مرتبطة بعد</p>
                )}
            </Sec>

            {/* ═══ الفواتير — تظهر فقط لو في فواتير ═══ */}
            {invoices.length > 0 && (
                <Sec title={`الفواتير (${invoices.length})`} icon={Receipt} color="blue" open={open.invoices} onToggle={() => tog('invoices')}>
                    <TTable rows={invoices} cols={[
                        {key:'no', label:'رقم'}, {key:'date', label:'التاريخ'},
                        {key:'client', label:'العميل', linkKey:'client_id'},
                        {key:'total', label:'الإجمالي', fmt},
                        {key:'paid', label:'المدفوع', fmt},
                    ]} navigate={navigate} partyDir={partyDir}/>
                </Sec>
            )}

            {/* ═══ المشتريات — تظهر فقط لو في مشتريات ═══ */}
            {purchases.length > 0 && (
                <Sec title={`أوامر الشراء (${purchases.length})`} icon={ShoppingCart} color="amber" open={open.purchases} onToggle={() => tog('purchases')}>
                    <TTable rows={purchases} cols={[
                        {key:'no', label:'رقم'}, {key:'date', label:'التاريخ'},
                        {key:'supplier', label:'المورد', linkKey:'supplier_id'},
                        {key:'total', label:'الإجمالي', fmt},
                    ]} navigate={navigate} partyDir={partyDir}/>
                </Sec>
            )}

            {/* لايتبوكس */}
            {lightbox && (
                <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
                    <div className="relative max-w-4xl w-full" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setLightbox(null)}
                            className="absolute -top-10 left-0 text-white/80 hover:text-white flex items-center gap-1 text-sm font-bold">
                            <X size={18}/> إغلاق
                        </button>
                        <img src={lightbox} alt="مرفق" className="w-full h-auto max-h-[85vh] object-contain rounded-2xl shadow-2xl"/>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ════════════════════════════════════════════
   مكوّنات مساعدة صغيرة
════════════════════════════════════════════ */

function Chip({ label, warn }) {
    return <span className={`text-[11px] px-2.5 py-1 rounded-full ${warn ? 'bg-amber-500/20 text-amber-200' : 'bg-white/10 text-slate-200'}`}>{label}</span>;
}

function Sec({ title, icon: Icon, color='blue', open, onToggle, children }) {
    const clr = { blue:'text-blue-600', teal:'text-teal-600', emerald:'text-emerald-600',
        purple:'text-purple-600', indigo:'text-indigo-600', amber:'text-amber-600', red:'text-red-600' };
    return (
        <div className="bg-white dark:bg-brand-900 rounded-2xl shadow border border-slate-100 dark:border-brand-700 overflow-hidden">
            <button className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50/60 dark:hover:bg-brand-800/40 transition" onClick={onToggle}>
                <div className="flex items-center gap-2.5">
                    <Icon size={17} className={clr[color]||'text-slate-500'}/>
                    <span className="font-black text-brand-800 dark:text-brand-100 text-sm">{title}</span>
                </div>
                {open ? <ChevronUp size={15} className="text-slate-400"/> : <ChevronDown size={15} className="text-slate-400"/>}
            </button>
            {open && <div className="border-t border-slate-100 dark:border-brand-700 px-5 py-4">{children}</div>}
        </div>
    );
}

function IRow({ icon: Icon, label, value, valueCls }) {
    if (value === null || value === undefined || value === '') return null;
    return (
        <div className="flex items-start justify-between py-2.5 border-b border-slate-50 dark:border-brand-700/40 last:border-0 gap-4">
            <div className="flex items-center gap-2 text-slate-400 dark:text-brand-400 shrink-0">
                {Icon && <Icon size={12}/>}
                <span className="text-xs text-slate-500 dark:text-brand-400">{label}</span>
            </div>
            <span className={valueCls || 'font-bold text-brand-800 dark:text-brand-100 text-sm text-left'}>{value}</span>
        </div>
    );
}

function FStat({ label, value, icon: Icon, color }) {
    const c = { emerald:'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30', purple:'bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/30',
        red:'bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 border-red-200 dark:border-red-500/30', blue:'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30' };
    return (
        <div className={`border rounded-2xl p-3.5 ${c[color]||c.blue}`}>
            <Icon size={16} className="mb-1.5 opacity-70"/>
            <div className="text-[10px] font-bold opacity-70 mb-0.5">{label}</div>
            <div className="text-xl font-black">{value}</div>
        </div>
    );
}

function BudgetBar({ f }) {
    const over = f.budget_used_pct > 100;
    return (
        <div className={`rounded-2xl p-4 border ${over ? 'bg-red-50 dark:bg-red-500/15 border-red-200 dark:border-red-500/30' : 'bg-slate-50 dark:bg-brand-800/40 border-slate-100 dark:border-brand-700'}`}>
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                    {over ? <AlertTriangle size={14} className="text-red-600"/> : <CheckCircle2 size={14} className="text-emerald-600"/>}
                    <span className={`text-sm font-black ${over ? 'text-red-900 dark:text-red-300' : 'text-brand-800 dark:text-brand-100'}`}>استهلاك الميزانية</span>
                </div>
                <span className={`text-xl font-black ${over ? 'text-red-700' : 'text-emerald-700'}`}>{f.budget_used_pct}%</span>
            </div>
            <div className="h-2.5 bg-white dark:bg-brand-800 rounded-full overflow-hidden border border-slate-200 dark:border-brand-700 mb-2">
                <div className={`h-full ${over ? 'bg-red-500' : 'bg-emerald-500'}`} style={{width:`${Math.min(100,f.budget_used_pct)}%`}}/>
            </div>
            <div className="flex justify-between text-xs font-bold">
                <span className="text-slate-500 dark:text-brand-400">استُهلك: {fmt(f.total_cost)} ريال</span>
                <span className={f.budget_left >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                    {f.budget_left >= 0 ? 'متبقي' : 'تجاوز'}: {fmt(Math.abs(f.budget_left))} ريال
                </span>
            </div>
        </div>
    );
}

function TTable({ rows, cols, navigate, partyDir }) {
    return (
        <div className="overflow-x-auto rounded-xl border border-slate-100 dark:border-brand-700">
            <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 dark:bg-brand-800/60 text-xs text-slate-400 dark:text-brand-400 border-b border-slate-100 dark:border-brand-700">
                    <tr>{cols.map(c => <th key={c.key} className="px-3 py-2.5 font-bold">{c.label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-brand-700">
                    {rows.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50/60 dark:hover:bg-brand-800">
                            {cols.map(c => {
                                const display = c.fmt ? c.fmt(row[c.key]) : (row[c.key] || '—');
                                const pid = c.linkKey && partyDir
                                    ? partyDir.byDaftraId?.[String(row[c.linkKey] || '')]
                                    : null;
                                return (
                                    <td key={c.key} className="px-3 py-2.5 text-slate-700 dark:text-brand-300">
                                        {pid && navigate ? (
                                            <button
                                                onClick={() => navigate(`/admin/dashboard/parties/${pid}`)}
                                                className="font-bold text-brand-800 dark:text-brand-200 hover:text-blue-600 dark:hover:text-blue-400 hover:underline text-right"
                                            >
                                                {display}
                                            </button>
                                        ) : display}
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
