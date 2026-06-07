import React, { useContext, useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import PageMeta from '../../components/PageMeta';
import {
  LogOut, Wrench, Phone, Home, Clock,
  CircleCheck, ChevronLeft, HardHat,
  ListChecks, CalendarDays, MessageCircle,
  AlertCircle, Loader2, Key, FileCheck,
  CheckCircle2, ArrowLeft, Star, Bell,
  Building2, ShieldCheck, CalendarClock,
  Zap, DoorOpen, Droplets, CreditCard,
  FileText, Receipt, Send, X, ChevronDown,
  ReceiptText, Landmark, BadgeDollarSign,
} from 'lucide-react';
import { AppContext } from '../../context/AppContext';
import { API_URL } from '../../utils/helpers';

/* ─── ثوابت ─── */
const STATUS_STYLE = {
  'قيد الانتظار':         'bg-amber-100 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30',
  'تم التعيين':           'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
  'تم اعتماد الموعد':     'bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-500/30',
  'تم اقتراح موعد بديل': 'bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-500/30',
  'جاري العمل':           'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30',
  'مكتمل':                'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300 border-green-200 dark:border-green-500/30',
};
const STATUS_STEP = {
  'قيد الانتظار': 0, 'تم التعيين': 1, 'تم اعتماد الموعد': 1, 'تم اقتراح موعد بديل': 1, 'جاري العمل': 2, 'مكتمل': 3,
};
const MAINT_STEPS = [
  { Icon: ListChecks, label: 'تم الاستلام' }, { Icon: CalendarDays, label: 'تأكيد الموعد' },
  { Icon: HardHat, label: 'جاري العمل' }, { Icon: CircleCheck, label: 'مكتمل' },
];
const JOURNEY = [
  { id: 'registered', icon: Home, label: 'تسجيل الوحدة' },
  { id: 'inspecting', icon: HardHat, label: 'فحص الشركة' },
  { id: 'client_ready', icon: FileCheck, label: 'مراجعتك' },
  { id: 'handed_over', icon: Key, label: 'التسليم' },
];
const journeyStageIndex = (s) => {
  if (!s) return 1;
  if (s === 'client_ready' || s === 'client_submitted') return 2;
  if (s === 'handed_over') return 3;
  return 1;
};
const WhatsAppIcon = () => (
  <svg width="22" height="22" fill="currentColor" viewBox="0 0 16 16">
    <path d="M13.601 2.326A7.854 7.854 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.933 7.933 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.898 7.898 0 0 0 13.6 2.326zM7.994 14.521a6.573 6.573 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.557 6.557 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.729.729 0 0 0-.529.247c-.182.198-.691.677-.691 1.654 0 .977.71 1.916.81 2.049.098.133 1.394 2.132 3.383 2.992.47.205.84.326 1.129.418.475.152.904.129 1.246.08.38-.058 1.171-.48 1.338-.943.164-.464.164-.86.114-.943-.049-.084-.182-.133-.38-.232z"/>
  </svg>
);
const WARRANTY_CATS = [
  { key: 'electric', label: 'كهرباء وإنارة', icon: Zap,      years: 3,  color: 'amber', types: ['كهرباء','إنارة','مراوح شفط','أفياش','مفاتيح'] },
  { key: 'structure', label: 'إنشاءات',       icon: DoorOpen, years: 10, color: 'blue',  types: ['إنشاءات','شبابيك','أبواب'] },
  { key: 'plumbing', label: 'سباكة',          icon: Droplets, years: 3,  color: 'cyan',  types: ['سباكة','خلاطات','شطافات','محابس','سخانات'] },
];
const COLOR_MAP = {
  amber: { bg:'bg-amber-50',text:'text-amber-600',bar:'bg-amber-500',badge:'bg-amber-50 text-amber-600 border-amber-200',icon:'bg-amber-50' },
  blue:  { bg:'bg-blue-50', text:'text-blue-600', bar:'bg-blue-500', badge:'bg-blue-50 text-blue-600 border-blue-200',  icon:'bg-blue-50' },
  cyan:  { bg:'bg-cyan-50', text:'text-cyan-600', bar:'bg-cyan-500', badge:'bg-cyan-50 text-cyan-600 border-cyan-200',  icon:'bg-cyan-50' },
};
function calcWarranty(start, years) {
  const end = new Date(start); end.setFullYear(end.getFullYear() + years);
  const now = new Date(); const totalMs = end - start; const usedMs = Math.min(now - start, totalMs);
  const remainMs = Math.max(end - now, 0);
  return { end, isActive: now < end, usedPct: Math.min(Math.round((usedMs/totalMs)*100),100),
    remainDays: Math.ceil(remainMs/(1000*60*60*24)), remainYears: (remainMs/(1000*60*60*24*365)).toFixed(1) };
}
function WarrantyCard({ handoverDate, onRequestMaintenance }) {
  const start = new Date(handoverDate);
  const fmt = (d) => d.toLocaleDateString('ar-SA', { year:'numeric', month:'short', day:'numeric' });
  const hasAnyActive = WARRANTY_CATS.some(c => calcWarranty(start, c.years).isActive);
  return (
    <div className="bg-white dark:bg-brand-900 rounded-2xl shadow-xl overflow-hidden">
      <div className="h-1.5 bg-gradient-to-r from-gold-500 via-amber-400 to-gold-500" />
      <div className="p-5">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gold-500/10 flex items-center justify-center flex-shrink-0"><ShieldCheck size={20} className="text-gold-500" /></div>
          <div><p className="text-brand-800 dark:text-brand-100 font-black text-sm">ضمانات وحدتك</p><p className="text-slate-400 dark:text-brand-400 text-xs font-bold">من تاريخ التسليم: {fmt(start)}</p></div>
        </div>
        <div className="space-y-3 mb-4">
          {WARRANTY_CATS.map(({ key, label, icon: Icon, years, color, types }) => {
            const { end, isActive, usedPct, remainDays, remainYears } = calcWarranty(start, years);
            const c = COLOR_MAP[color];
            return (
              <div key={key} className={`rounded-xl border p-3.5 ${isActive ? 'border-slate-100 dark:border-brand-700' : 'border-red-100 dark:border-red-500/30 opacity-60'}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-lg ${c.icon} flex items-center justify-center flex-shrink-0`}><Icon size={15} className={c.text} /></div>
                    <div><p className="text-brand-800 dark:text-brand-100 font-black text-xs">{label}</p><p className="text-slate-400 dark:text-brand-400 text-[10px] font-bold">{types.slice(0,4).join(' · ')}</p></div>
                  </div>
                  <span className={`text-[10px] font-black px-2 py-1 rounded-full border ${isActive ? c.badge : 'bg-red-50 text-red-500 border-red-200'}`}>{isActive ? `● ${years} سنوات` : '✕ منتهي'}</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden mb-1.5"><div className={`h-full rounded-full transition-all duration-700 ${isActive ? c.bar : 'bg-red-300'}`} style={{ width: `${usedPct}%` }} /></div>
                <div className="flex justify-between text-[9px] font-bold text-slate-400">
                  <span dir="ltr">{fmt(start)}</span>
                  {isActive ? <span className={c.text}>متبقي {remainDays > 365 ? `${remainYears} سنة` : `${remainDays} يوم`}</span> : <span className="text-red-400">انتهى {fmt(end)}</span>}
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={onRequestMaintenance} className={`w-full py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all ${hasAnyActive ? 'bg-brand-800 hover:bg-gold-500 text-white shadow-md hover:-translate-y-0.5' : 'bg-slate-100 dark:bg-brand-800 text-slate-500 dark:text-brand-400'}`}>
          <Wrench size={16} /> {hasAnyActive ? 'رفع تذكرة صيانة (ضمان)' : 'رفع طلب صيانة'}
        </button>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   تبويب: حسابي المالي
──────────────────────────────────────────────────────────── */
function FinancialTab({ customer }) {
  const [acct, setAcct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    const phone = customer?.phone || '';
    const partyId = customer?.party_id || '';
    const qs = new URLSearchParams({ action: 'customer_account', phone, party_id: partyId }).toString();
    fetch(`${API_URL}?${qs}`)
      .then(r => r.json())
      .then(d => { if (d.success) setAcct(d); else setErr(d.message || 'لا يوجد حساب'); })
      .catch(() => setErr('فشل الاتصال'))
      .finally(() => setLoading(false));
  }, [customer]);

  const money = (v) => Number(v || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const INV_STATUS = { posted: 'مُستحق', partial: 'جزئي', paid: 'مدفوع', draft: 'مسودة', void: 'ملغى' };
  const INV_CLS   = { posted: 'text-rose-600 bg-rose-50 border-rose-200', partial: 'text-amber-700 bg-amber-50 border-amber-200', paid: 'text-emerald-700 bg-emerald-50 border-emerald-200', draft: 'text-slate-500 bg-slate-100 border-slate-200', void: 'text-slate-400 bg-slate-50 border-slate-200' };

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gold-500" size={30} /></div>;
  if (err) return (
    <div className="bg-white dark:bg-brand-900 rounded-2xl p-6 text-center shadow-xl">
      <Landmark size={30} className="text-slate-300 mx-auto mb-2" />
      <p className="text-slate-500 font-bold text-sm">{err}</p>
      <p className="text-slate-400 text-xs mt-1">لا يوجد حساب مالي مرتبط بهذا الملف — تواصل مع الإدارة لربط حسابك</p>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* بطاقة الإجماليات */}
      <div className="bg-gradient-to-l from-[#1a365d] to-[#0f2044] rounded-2xl p-5 border border-white/10 shadow-xl">
        <p className="text-gold-500 text-xs font-bold tracking-widest uppercase mb-3 flex items-center gap-2"><BadgeDollarSign size={13} /> ملخص حسابك</p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'إجمالي الفواتير', val: acct.totals.invoiced, cls: 'text-white' },
            { label: 'المسدَّد', val: acct.totals.paid, cls: 'text-emerald-400' },
            { label: 'المتبقي', val: acct.totals.balance, cls: acct.totals.balance > 0 ? 'text-rose-400' : 'text-emerald-400' },
          ].map(({ label, val, cls }) => (
            <div key={label} className="text-center">
              <p className={`text-xl font-black tabular-nums ${cls}`} dir="ltr">{money(val)}</p>
              <p className="text-white/50 text-[10px] font-bold mt-0.5">{label} ﷼</p>
            </div>
          ))}
        </div>
      </div>

      {/* الفواتير */}
      {acct.invoices.length > 0 && (
        <div className="bg-white dark:bg-brand-900 rounded-2xl shadow-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-brand-700 flex items-center gap-2">
            <ReceiptText size={15} className="text-gold-500" />
            <h3 className="text-brand-800 dark:text-brand-100 font-black text-sm">الفواتير</h3>
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-brand-800 text-slate-500 dark:text-brand-400 mr-auto">{acct.invoices.length}</span>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-brand-800">
            {acct.invoices.map(inv => {
              const bal = Math.max(0, Number(inv.total) - Number(inv.paid));
              return (
                <div key={inv.id} className="px-5 py-3.5 flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-brand-800 dark:text-brand-100 font-black text-sm font-mono" dir="ltr">{inv.invoice_no || `#${inv.id}`}</p>
                      <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full border ${INV_CLS[inv.status] || INV_CLS.draft}`}>{INV_STATUS[inv.status] || inv.status}</span>
                    </div>
                    <p className="text-slate-400 text-xs font-bold" dir="ltr">{inv.issue_date}{inv.due_date ? ` ← ${inv.due_date}` : ''}</p>
                  </div>
                  <div className="text-left flex-shrink-0">
                    <p className="font-black text-sm text-brand-800 dark:text-brand-100 tabular-nums" dir="ltr">{money(inv.total)} ﷼</p>
                    {bal > 0.01 && <p className="text-rose-500 text-xs font-bold tabular-nums" dir="ltr">متبقي {money(bal)} ﷼</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* سجل الدفعات */}
      {acct.payments.length > 0 && (
        <div className="bg-white dark:bg-brand-900 rounded-2xl shadow-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 dark:border-brand-700 flex items-center gap-2">
            <Receipt size={15} className="text-emerald-500" />
            <h3 className="text-brand-800 dark:text-brand-100 font-black text-sm">سجل الدفعات</h3>
          </div>
          <div className="divide-y divide-slate-50 dark:divide-brand-800">
            {acct.payments.map((p, i) => (
              <div key={i} className="px-5 py-3.5 flex items-center justify-between">
                <div>
                  <p className="text-brand-800 dark:text-brand-100 font-black text-sm font-mono" dir="ltr">{p.pay_no}</p>
                  <p className="text-slate-400 text-xs font-bold" dir="ltr">{p.date} · {p.method === 'bank' ? 'بنك' : 'نقداً'}</p>
                </div>
                <p className="font-black text-emerald-600 dark:text-emerald-400 tabular-nums text-sm" dir="ltr">{money(p.amount)} ﷼</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {acct.invoices.length === 0 && acct.payments.length === 0 && (
        <div className="bg-white dark:bg-brand-900 rounded-2xl p-8 text-center shadow-xl">
          <FileText size={28} className="text-slate-300 mx-auto mb-2" />
          <p className="text-slate-400 font-bold text-sm">لا توجد معاملات مالية مسجّلة بعد</p>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   تبويب: الوحدات المتاحة
──────────────────────────────────────────────────────────── */
function AvailableUnitsTab({ customer }) {
  const [units, setUnits]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [lead, setLead]       = useState(null);  // { unit_code, project_id, project_name }
  const [form, setForm]       = useState({ name: customer?.name || '', phone: customer?.phone || '', national_id: customer?.national_id || '', notes: '' });
  const [busy, setBusy]       = useState(false);
  const [done, setDone]       = useState(false);

  useEffect(() => {
    fetch(`${API_URL}?action=customer_available_units`)
      .then(r => r.json())
      .then(d => { if (d.success) setUnits(d.data); })
      .finally(() => setLoading(false));
  }, []);

  const submitLead = async () => {
    if (!form.name || !form.phone) return;
    setBusy(true);
    try {
      const res = await fetch(`${API_URL}?action=customer_lead_save`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, unit_code: lead?.unit_code || '', project_id: lead?.project_id || 0 }),
      });
      const d = await res.json();
      if (d.success) { setDone(true); setLead(null); }
    } catch {}
    finally { setBusy(false); }
  };

  // تجميع بالمشروع
  const byProject = units.reduce((acc, u) => {
    const k = u.project_name || 'غير محدد';
    if (!acc[k]) acc[k] = { id: u.project_id, name: k, desc: u.project_desc, units: [] };
    acc[k].units.push(u);
    return acc;
  }, {});

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="animate-spin text-gold-500" size={30} /></div>;

  return (
    <div className="space-y-4">
      {done && (
        <div className="bg-emerald-500/20 border border-emerald-500/30 rounded-2xl p-5 flex items-start gap-3">
          <CheckCircle2 size={22} className="text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-emerald-300 font-black text-sm">تم تسجيل طلبك بنجاح</p>
            <p className="text-emerald-400/70 text-xs mt-0.5">سيتواصل معك فريق المبيعات في أقرب وقت</p>
          </div>
        </div>
      )}

      {Object.keys(byProject).length === 0 ? (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
          <Building2 size={28} className="text-slate-500 mx-auto mb-2" />
          <p className="text-slate-400 font-bold text-sm">لا توجد وحدات متاحة حالياً</p>
          <p className="text-slate-500 text-xs mt-1">تواصل معنا للاستفسار عن الوحدات القادمة</p>
        </div>
      ) : Object.values(byProject).map(proj => (
        <div key={proj.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden backdrop-blur-sm">
          <div className="px-5 py-4 border-b border-white/10">
            <p className="text-white font-black text-base">{proj.name}</p>
            {proj.desc && <p className="text-slate-400 text-xs font-bold mt-0.5">{proj.desc}</p>}
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            {proj.units.map(u => (
              <div key={u.id} className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl p-3.5 transition">
                <div className="flex items-start justify-between gap-1 mb-2">
                  <p className="text-gold-500 font-black text-sm">{u.unit_code}</p>
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">متاح</span>
                </div>
                {u.area  && <p className="text-slate-400 text-[10px] font-bold">المساحة: {u.area}</p>}
                {u.price && <p className="text-white text-[11px] font-black mt-0.5">{u.price} ﷼</p>}
                {/* specs */}
                {u.spaces?.slice(0, 3).map((sp, i) => (
                  <p key={i} className="text-slate-500 text-[10px] truncate">{sp.label}: {sp.value}</p>
                ))}
                <button
                  onClick={() => { setLead({ unit_code: u.unit_code, project_id: u.project_id, project_name: u.project_name }); setDone(false); }}
                  className="mt-2.5 w-full py-1.5 rounded-lg bg-gold-500/20 hover:bg-gold-500/30 text-gold-500 text-[11px] font-black border border-gold-500/30 transition">
                  أبدِ اهتمامك
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Modal: نموذج الاهتمام */}
      {lead && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center p-0" onClick={() => setLead(null)}>
          <div className="bg-[#0f2044] border border-white/10 rounded-t-3xl w-full max-w-lg p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <div>
                <h3 className="text-white font-black text-base">أبدِ اهتمامك بالوحدة</h3>
                <p className="text-gold-500 text-xs font-bold mt-0.5">{lead.unit_code} — {lead.project_name}</p>
              </div>
              <button onClick={() => setLead(null)} className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400"><X size={18} /></button>
            </div>
            {[
              { key: 'name',        label: 'الاسم الكامل',       type: 'text',  req: true  },
              { key: 'phone',       label: 'رقم الجوال',         type: 'tel',   req: true  },
              { key: 'national_id', label: 'رقم الهوية (اختياري)', type: 'text',  req: false },
              { key: 'notes',       label: 'ملاحظات',            type: 'text',  req: false },
            ].map(({ key, label, type, req }) => (
              <div key={key}>
                <label className="block text-xs font-bold text-slate-400 mb-1">{label}</label>
                <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  required={req} placeholder={req ? label : '—'}
                  className="w-full bg-white/5 border border-white/10 text-white placeholder:text-slate-600 px-4 py-3 rounded-xl text-sm font-bold outline-none focus:border-gold-500 transition" />
              </div>
            ))}
            <button onClick={submitLead} disabled={busy || !form.name || !form.phone}
              className="w-full py-3.5 rounded-xl bg-gold-500 hover:bg-[#d4b570] text-white font-black text-sm flex items-center justify-center gap-2 disabled:opacity-50 transition">
              {busy ? <Loader2 className="animate-spin" size={18} /> : <><Send size={16} /> إرسال الطلب</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   البوابة الرئيسية
──────────────────────────────────────────────────────────── */
export default function Portal() {
  const { customer, logout, showToast } = useContext(AppContext);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('unit'); // 'unit' | 'account' | 'units'
  const [tickets, setTickets]       = useState([]);
  const [inspection, setInspection] = useState(null);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    if (!customer) { navigate('/customer-login'); return; }
    // إن لم يكن لديه وحدة → ابدأ بتبويب الوحدات المتاحة
    if (!customer.unit) setActiveTab('units');
    const fetchAll = async () => {
      if (!customer.unit) { setDataLoading(false); return; }
      try {
        const [ticketRes, inspRes] = await Promise.all([
          fetch(`${API_URL}?action=get_customer_tickets&unit=${encodeURIComponent(customer.unit)}`),
          fetch(`${API_URL}?action=get_inspection&unit=${encodeURIComponent(customer.unit)}`),
        ]);
        const td = await ticketRes.json(); const id = await inspRes.json();
        if (td.success) setTickets(td.data || []);
        setInspection(id.success ? id.data : false);
      } catch { setInspection(false); }
      finally { setDataLoading(false); }
    };
    fetchAll();
  }, [customer, navigate]);

  const handleLogout = () => { logout(); showToast('تم الخروج', 'نتمنى لك يوماً سعيداً'); navigate('/'); };
  if (!customer) return null;

  const activeTickets = tickets.filter(t => t.status !== 'مكتمل');
  const latestActive  = activeTickets[0] ?? null;
  const activeStep    = latestActive ? (STATUS_STEP[latestActive.status] ?? 0) : 0;
  const firstName     = customer.name?.split(' ')[0] || customer.name;
  const inspStatus    = inspection ? inspection.status : null;
  const stageIdx      = inspection === false ? 0 : journeyStageIndex(inspStatus);
  const isHandedOver  = inspStatus === 'handed_over';
  const isClientReady = inspStatus === 'client_ready';
  const isSnagSubmitted = inspStatus === 'client_submitted';
  const hasUnit = !!customer.unit;

  const TABS = [
    ...(hasUnit ? [{ id: 'unit', label: 'وحدتي', icon: Home }] : []),
    { id: 'account', label: 'حسابي', icon: CreditCard },
    { id: 'units', label: 'الوحدات المتاحة', icon: Building2 },
  ];

  return (
    <>
    <PageMeta title="بوابة الملاك" description="بوابة ملاك سماك العقارية — تابع وحدتك وحسابك المالي والوحدات المتاحة." />
    <div className="min-h-screen bg-gradient-to-b from-[#0f2044] to-[#1a365d] -mt-24 pt-10 pb-24 font-cairo" dir="rtl">
      <div className="max-w-2xl mx-auto px-4 space-y-4">

        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-gold-500 text-xs font-bold tracking-widest uppercase mb-0.5">بوابة الملاك</p>
            <h1 className="text-white text-2xl font-black">أهلاً، {firstName} 👋</h1>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 bg-white/10 hover:bg-red-500/80 text-white px-4 py-2 rounded-xl text-sm font-bold transition border border-white/10">
            <LogOut size={15} /> خروج
          </button>
        </div>

        {/* بطاقة الهوية */}
        <div className="bg-white/10 border border-white/10 rounded-2xl p-5 flex items-center justify-between backdrop-blur-sm">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gold-500/20 flex items-center justify-center flex-shrink-0">
              <Building2 size={20} className="text-gold-500" />
            </div>
            <div>
              <p className="text-slate-400 text-xs font-bold">{hasUnit ? 'وحدتك العقارية' : 'عميل سماك العقارية'}</p>
              {hasUnit
                ? <p className="text-white font-black text-xl tracking-widest">{customer.unit}</p>
                : <p className="text-white font-black text-base">{customer.name}</p>}
              {customer.project_label && <p className="text-slate-400 text-xs mt-0.5">{customer.project_label}</p>}
            </div>
          </div>
          {isHandedOver && (
            <div className="flex items-center gap-1.5 bg-green-500/20 text-green-400 text-xs font-bold px-3 py-1.5 rounded-full border border-green-500/30">
              <CheckCircle2 size={13} /> مُسلَّمة
            </div>
          )}
        </div>

        {/* شريط التبويبات */}
        <div className="flex gap-2 bg-white/5 border border-white/10 rounded-2xl p-1.5">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} onClick={() => setActiveTab(id)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-black transition ${activeTab === id ? 'bg-gold-500 text-white shadow-lg' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        {/* ══════════ تبويب: وحدتي ══════════ */}
        {activeTab === 'unit' && hasUnit && (
          <>
            {/* رحلة التسليم */}
            <div className="bg-white/8 border border-white/10 rounded-2xl p-5 backdrop-blur-sm">
              <p className="text-gold-500 text-xs font-bold tracking-widest uppercase mb-4 flex items-center gap-2"><Star size={12} /> رحلة وحدتك</p>
              <div className="flex items-center gap-1 mb-4">
                {JOURNEY.map(({ icon: Icon, label }, i) => {
                  const done = i < stageIdx; const current = i === stageIdx; const pending = i > stageIdx;
                  return (
                    <React.Fragment key={i}>
                      <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 ${done ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' : ''} ${current ? 'bg-gold-500 text-white shadow-lg shadow-gold-500/40 scale-110' : ''} ${pending ? 'bg-white/10 text-white/30' : ''}`}>
                          {done ? <CheckCircle2 size={18} /> : <Icon size={16} />}
                        </div>
                        <p className={`text-[10px] font-bold text-center leading-tight w-14 ${done ? 'text-green-400' : ''} ${current ? 'text-gold-500' : ''} ${pending ? 'text-white/30' : ''}`}>{label}</p>
                      </div>
                      {i < JOURNEY.length - 1 && <div className={`flex-1 h-[2px] rounded-full mb-5 transition-all duration-500 ${i < stageIdx ? 'bg-green-500' : 'bg-white/10'}`} />}
                    </React.Fragment>
                  );
                })}
              </div>
              {dataLoading ? <div className="flex items-center gap-2 text-slate-400 text-xs font-bold"><Loader2 size={14} className="animate-spin" /> جاري تحميل حالة وحدتك...</div>
                : isHandedOver ? <div className="flex items-center gap-2 bg-green-500/10 text-green-400 text-sm font-bold px-3 py-2 rounded-xl border border-green-500/20"><CheckCircle2 size={16} /> تم تسليم وحدتك رسمياً — مرحباً بك كمالك</div>
                : isSnagSubmitted ? <div className="flex items-center gap-2 bg-amber-500/10 text-amber-400 text-sm font-bold px-3 py-2 rounded-xl border border-amber-500/20"><Clock size={16} /> تم استلام ملاحظاتك — الفريق يعمل على معالجتها</div>
                : isClientReady ? <div className="flex items-center gap-2 bg-gold-500/10 text-gold-500 text-sm font-bold px-3 py-2 rounded-xl border border-gold-500/20"><Bell size={16} className="animate-pulse" /> وحدتك جاهزة — ابدأ مراجعتك الآن</div>
                : inspection === false ? <div className="flex items-center gap-2 text-slate-400 text-xs font-bold"><Clock size={14} /> وحدتك قيد التجهيز — سنُبلغك عند الجاهزية</div>
                : <div className="flex items-center gap-2 text-slate-400 text-xs font-bold"><HardHat size={14} /> الفريق الهندسي يفحص وحدتك حالياً</div>
              }
            </div>

            {isClientReady && (
              <div className="bg-gradient-to-l from-[#c5a059] to-[#e8c97a] rounded-2xl p-5 shadow-xl shadow-gold-500/20">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0"><FileCheck size={20} className="text-white" /></div>
                  <div><p className="text-white font-black text-base">وحدتك جاهزة للمراجعة!</p><p className="text-white/80 text-xs mt-0.5 leading-relaxed">راجع النتائج ووقّع إلكترونياً على وثيقة الاستلام.</p></div>
                </div>
                <button onClick={() => navigate(`/handover?unit=${encodeURIComponent(customer.unit)}`)} className="w-full bg-white text-brand-800 py-3.5 rounded-xl font-black text-sm flex items-center justify-center gap-2 hover:bg-brand-800 hover:text-white transition-all duration-200 shadow-lg">
                  ابدأ مراجعة وحدتك <ArrowLeft size={16} />
                </button>
              </div>
            )}

            {isHandedOver && (
              <div className="bg-gradient-to-l from-green-600 to-emerald-500 rounded-2xl p-5 shadow-xl shadow-green-500/20">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0"><Key size={22} className="text-white" /></div>
                  <div><p className="text-white font-black text-base">تم تسليم وحدتك 🎉</p><p className="text-white/80 text-xs mt-0.5">أنت الآن مالك رسمي — مرحباً بك في عائلة سماك العقارية</p></div>
                </div>
              </div>
            )}

            {isHandedOver && inspection?.client_submitted_at && (
              <WarrantyCard handoverDate={inspection.client_submitted_at} onRequestMaintenance={() => navigate('/maintenance')} />
            )}

            {/* إحصائيات */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center backdrop-blur-sm">
                <p className="text-3xl font-black text-gold-500">{tickets.length}</p>
                <p className="text-slate-400 text-xs font-bold mt-1">إجمالي الطلبات</p>
              </div>
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 text-center backdrop-blur-sm">
                <p className="text-3xl font-black text-blue-400">{activeTickets.length}</p>
                <p className="text-slate-400 text-xs font-bold mt-1">طلبات نشطة</p>
              </div>
            </div>

            {dataLoading ? <div className="bg-white/5 rounded-2xl p-8 flex justify-center"><Loader2 className="animate-spin text-gold-500" size={32} /></div>
              : latestActive ? (
              <div className="bg-white dark:bg-brand-900 rounded-2xl p-5 shadow-xl">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <p className="text-xs text-slate-400 dark:text-brand-400 font-bold mb-0.5">الطلب النشط</p>
                    <p className="text-brand-800 dark:text-brand-100 font-black text-lg">#{latestActive.id} — {latestActive.type}</p>
                    {latestActive.technician && latestActive.technician !== 'لم يتم التعيين' && <p className="text-slate-500 dark:text-brand-300 text-xs font-bold mt-0.5">الفني: {latestActive.technician}</p>}
                  </div>
                  <span className={`text-xs px-3 py-1.5 rounded-full font-bold border flex-shrink-0 ${STATUS_STYLE[latestActive.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{latestActive.status}</span>
                </div>
                <div className="flex items-center gap-1 mb-3">
                  {MAINT_STEPS.map(({ Icon }, i) => (
                    <React.Fragment key={i}>
                      <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-colors ${i <= activeStep ? 'bg-gold-500 text-white shadow-md' : 'bg-slate-100 text-slate-400'}`}><Icon size={15} /></div>
                      {i < MAINT_STEPS.length - 1 && <div className={`flex-1 h-1 rounded-full transition-colors ${i < activeStep ? 'bg-gold-500' : 'bg-slate-100'}`} />}
                    </React.Fragment>
                  ))}
                </div>
                <p className="text-xs text-slate-400 font-bold">{MAINT_STEPS[activeStep].label}</p>
              </div>
            ) : (
              <div className="bg-white/5 border border-white/10 rounded-2xl p-6 text-center backdrop-blur-sm">
                <AlertCircle size={26} className="text-slate-500 mx-auto mb-2" />
                <p className="text-slate-400 font-bold text-sm">لا توجد طلبات صيانة نشطة حالياً</p>
              </div>
            )}

            {/* إجراءات سريعة */}
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => navigate('/maintenance')} className="bg-gold-500 hover:bg-[#d4b570] text-white rounded-2xl p-5 flex flex-col items-center gap-2 font-bold transition shadow-lg shadow-gold-500/20 hover:-translate-y-0.5 active:scale-95">
                <Wrench size={24} /><span className="text-sm">طلب صيانة</span>
              </button>
              <a href={`https://wa.me/966920032842?text=${encodeURIComponent(`مرحباً، أنا ${customer.name} مالك الوحدة ${customer.unit}، أود الاستفسار`)}`} target="_blank" rel="noreferrer" className="bg-[#25D366] hover:bg-[#1fba5a] text-white rounded-2xl p-5 flex flex-col items-center gap-2 font-bold transition shadow-lg hover:-translate-y-0.5 active:scale-95">
                <WhatsAppIcon /><span className="text-sm">تواصل معنا</span>
              </a>
            </div>

            {tickets.length > 0 && (
              <div className="bg-white dark:bg-brand-900 rounded-2xl shadow-xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 dark:border-brand-700 flex items-center justify-between">
                  <h3 className="text-brand-800 dark:text-brand-100 font-black text-base">آخر الطلبات</h3>
                  <button onClick={() => navigate('/maintenance')} className="text-gold-500 text-xs font-bold flex items-center gap-1 hover:underline">عرض الكل <ChevronLeft size={13} /></button>
                </div>
                <div className="divide-y divide-slate-50 dark:divide-brand-800">
                  {tickets.slice(0, 4).map(t => (
                    <div key={t.id} className="px-5 py-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-brand-800 dark:text-brand-100 font-black text-sm">{t.type}</p>
                        <p className="text-slate-400 dark:text-brand-400 text-xs font-bold flex items-center gap-1 mt-0.5"><Clock size={10} /> #{t.id} · {t.date?.split(' ')[0] || ''}</p>
                      </div>
                      <span className={`text-xs px-2.5 py-1 rounded-full font-bold border flex-shrink-0 ${STATUS_STYLE[t.status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>{t.status || 'قيد الانتظار'}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <a href="tel:920032842" className="flex items-center gap-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl px-5 py-4 text-slate-300 hover:text-white transition group">
              <div className="w-10 h-10 rounded-xl bg-gold-500/10 group-hover:bg-gold-500/20 flex items-center justify-center flex-shrink-0 transition-colors"><Phone size={18} className="text-gold-500" /></div>
              <div><p className="text-xs text-slate-500 font-bold">الهاتف الموحد</p><p className="font-black text-sm" dir="ltr">920032842</p></div>
              <MessageCircle size={16} className="mr-auto text-slate-600 group-hover:text-slate-400 transition-colors" />
            </a>
          </>
        )}

        {/* ══════════ تبويب: حسابي المالي ══════════ */}
        {activeTab === 'account' && <FinancialTab customer={customer} />}

        {/* ══════════ تبويب: الوحدات المتاحة ══════════ */}
        {activeTab === 'units' && <AvailableUnitsTab customer={customer} />}

      </div>
    </div>
    </>
  );
}
