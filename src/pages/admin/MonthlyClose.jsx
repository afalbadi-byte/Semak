import React, { useState, useEffect, useCallback } from 'react';
import { CalendarCheck, RefreshCw, Lock, Unlock, AlertTriangle, FileText, CheckCircle2, DollarSign, ShoppingCart, Banknote } from 'lucide-react';
import { API_URL } from '../../lib/api/client';
import { useToast } from '../../components/ui';

// ─── القفلة الشهرية المحاسبية — تقرير الشهر + العجوزات + الإقفال الموثق ───
const fmt = (n) => new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 0 }).format(parseFloat(n) || 0) + ' ر.س';
const prevMonth = () => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); };

function Chip({ icon: Icon, label, value, color, alert }) {
  return (
    <div className={`flex items-center gap-3 bg-white dark:bg-brand-900 rounded-2xl shadow-sm border px-4 py-3 flex-1 min-w-[170px] ${alert ? 'border-red-300' : 'border-slate-100 dark:border-brand-700'}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}><Icon size={19} className="text-white" /></div>
      <div>
        <p className="text-xs text-slate-400 dark:text-brand-400 font-medium">{label}</p>
        <p className={`text-sm font-black ${alert ? 'text-red-600' : 'text-slate-700 dark:text-brand-200'}`}>{value}</p>
      </div>
    </div>
  );
}

export default function MonthlyClose({ user }) {
  const toast = useToast();
  const [ym, setYm] = useState(prevMonth());
  const [rep, setRep] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [history, setHistory] = useState([]);

  const loadHistory = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}?action=month_close_list`);
      const d = await r.json();
      if (d.success) setHistory(d.data);
    } catch { /* تجاهل */ }
  }, []);
  useEffect(() => { loadHistory(); }, [loadHistory]);

  const generate = async (m = ym) => {
    setLoading(true); setRep(null);
    try {
      const r = await fetch(`${API_URL}?action=month_close_report&ym=${m}`);
      const d = await r.json();
      if (d.success) { setRep(d); setNotes(d.closing?.notes || ''); }
      else toast.error(d.message || 'فشل توليد التقرير');
    } catch { toast.error('خطأ في الاتصال بالخادم'); }
    finally { setLoading(false); }
  };

  const saveClosing = async (status) => {
    if (!rep) return;
    setSaving(true);
    try {
      const r = await fetch(`${API_URL}?action=month_close_save`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ym: rep.ym, status, notes, closed_by: user?.name || '', report: { summary: rep.summary, categories: rep.categories, cashflow: rep.cashflow, unpaid: rep.unpaid, unclassified: rep.unclassified } }),
      });
      const d = await r.json();
      if (d.success) {
        toast.success(status === 'closed' ? `تم إقفال شهر ${rep.ym} وتوثيق تقريره ✓` : 'أعيد فتح الشهر');
        generate(rep.ym); loadHistory();
      } else toast.error('فشل الحفظ');
    } catch { toast.error('خطأ في الاتصال'); }
    finally { setSaving(false); }
  };

  const closed = rep?.closing?.status === 'closed';
  const s = rep?.summary;

  return (
    <div dir="rtl" className="font-cairo p-4 md:p-6">
      {/* الرأس */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#1a365d] to-[#2d5299] rounded-2xl flex items-center justify-center shadow-lg">
            <CalendarCheck size={20} className="text-gold-500" />
          </div>
          <div>
            <h1 className="text-xl font-black text-brand-800 dark:text-brand-100">القفلة الشهرية المحاسبية</h1>
            <p className="text-xs text-slate-400 dark:text-brand-400 font-medium">تقرير الشهر · العجوزات والملاحظات · الإقفال الموثق</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={ym} onChange={e => setYm(e.target.value)}
            className="px-3 py-2 border border-slate-200 dark:border-brand-700 rounded-xl text-sm font-bold text-slate-600 dark:text-brand-50 dark:bg-brand-900 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20" />
          <button onClick={() => generate()} disabled={loading}
            className="flex items-center gap-2 bg-[#1a365d] hover:bg-[#2d5299] disabled:opacity-60 text-white px-5 py-2 rounded-xl font-black text-sm shadow-md transition-colors">
            {loading ? <RefreshCw size={15} className="animate-spin" /> : <FileText size={15} />} توليد تقرير القفلة
          </button>
        </div>
      </div>

      {rep && s && (
        <>
          {/* حالة الشهر */}
          <div className={`rounded-2xl px-4 py-3 mb-4 flex items-center gap-3 border ${closed ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
            {closed ? <Lock size={16} /> : <Unlock size={16} />}
            <span className="text-sm font-black">
              شهر {rep.ym}: {closed ? `مقفل ✓ (بواسطة ${rep.closing.closed_by || '—'} في ${rep.closing.closed_at || ''})` : 'مفتوح — لم يُقفل بعد'}
            </span>
          </div>

          {/* الملخص */}
          <div className="flex flex-wrap gap-3 mb-5">
            <Chip icon={ShoppingCart} label="فواتير الشهر" value={`${s.invoices_count} فاتورة · ${fmt(s.invoices_total)}`} color="bg-brand-800" />
            <Chip icon={DollarSign} label="إجمالي التكلفة (بنود)" value={fmt(s.cost_total)} color="bg-indigo-500" />
            <Chip icon={Banknote} label="تدفقات نقدية" value={fmt(s.cashflow_total)} color="bg-amber-500" />
            <Chip icon={FileText} label="مصاريف الشهر" value={`${s.expenses_count} · ${fmt(s.expenses_total)}`} color="bg-red-500" />
            <Chip icon={AlertTriangle} label="ذمم غير مدفوعة" value={fmt(s.outstanding)} color={s.outstanding > 0 ? 'bg-amber-600' : 'bg-emerald-600'} alert={s.outstanding > 0} />
            <Chip icon={AlertTriangle} label="عجز التصنيف" value={`${s.unclassified_count} فاتورة · ${s.expenses_unclassified} مصروف`} color={(s.unclassified_count + s.expenses_unclassified) > 0 ? 'bg-red-500' : 'bg-emerald-600'} alert={(s.unclassified_count + s.expenses_unclassified) > 0} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
            {/* بنود التكلفة */}
            <div className="bg-white dark:bg-brand-900 rounded-2xl shadow-sm border border-slate-100 dark:border-brand-700 p-4">
              <h3 className="text-sm font-black text-brand-800 dark:text-brand-100 mb-3">بنود التكلفة هذا الشهر</h3>
              {rep.categories.length === 0 ? <p className="text-xs text-slate-400 font-bold">لا يوجد</p> : rep.categories.map(c => (
                <div key={c.code} className="flex justify-between items-center py-1.5 border-b border-slate-50 dark:border-brand-800 text-xs">
                  <span className="font-bold text-slate-600 dark:text-brand-300"><span className="text-slate-300 font-mono text-[10px] ml-1">{c.code}</span>{c.name}</span>
                  <span className="font-black text-brand-800 dark:text-brand-100">{fmt(c.total)}</span>
                </div>
              ))}
              {rep.cashflow.length > 0 && (
                <>
                  <h4 className="text-[11px] font-black text-gold-600 mt-3 mb-1">تدفقات نقدية (خارج التكلفة)</h4>
                  {rep.cashflow.map(c => (
                    <div key={c.code} className="flex justify-between items-center py-1 text-xs">
                      <span className="font-bold text-amber-700">{c.name}</span>
                      <span className="font-black text-amber-800">{fmt(c.total)}</span>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* العجوزات */}
            <div className="bg-white dark:bg-brand-900 rounded-2xl shadow-sm border border-slate-100 dark:border-brand-700 p-4">
              <h3 className="text-sm font-black text-red-600 mb-3">العجوزات والملاحظات الآلية</h3>
              {rep.unpaid.length > 0 && (
                <>
                  <h4 className="text-[11px] font-black text-slate-500 mb-1">ذمم غير مدفوعة (الأعلى):</h4>
                  {rep.unpaid.slice(0, 8).map((u, i) => (
                    <div key={i} className="flex justify-between text-xs py-1 border-b border-slate-50 dark:border-brand-800">
                      <span className="font-bold text-slate-600 dark:text-brand-300">#{u.no} · {u.supplier}</span>
                      <span className="font-black text-amber-600">{fmt(u.remaining)}</span>
                    </div>
                  ))}
                </>
              )}
              {rep.unclassified.length > 0 && (
                <>
                  <h4 className="text-[11px] font-black text-slate-500 mt-3 mb-1">فواتير غير مصنفة:</h4>
                  {rep.unclassified.slice(0, 8).map((u, i) => (
                    <div key={i} className="flex justify-between text-xs py-1 border-b border-slate-50 dark:border-brand-800">
                      <span className="font-bold text-slate-600 dark:text-brand-300">#{u.no} · {u.supplier}</span>
                      <span className="font-black text-red-500">{fmt(u.total)}</span>
                    </div>
                  ))}
                </>
              )}
              {rep.unpaid.length === 0 && rep.unclassified.length === 0 && s.expenses_unclassified === 0 && (
                <p className="text-xs font-bold text-emerald-600 flex items-center gap-1"><CheckCircle2 size={14} /> لا عجوزات — الشهر نظيف وجاهز للإقفال</p>
              )}
              {s.expenses_unclassified > 0 && <p className="text-xs font-bold text-red-500 mt-2">+ {s.expenses_unclassified} مصروفاً بلا تصنيف (صفحة المصروفات)</p>}
            </div>
          </div>

          {/* الملاحظات والإقفال */}
          <div className="bg-white dark:bg-brand-900 rounded-2xl shadow-sm border border-slate-100 dark:border-brand-700 p-4 mb-5">
            <h3 className="text-sm font-black text-brand-800 dark:text-brand-100 mb-2">ملاحظات القفلة</h3>
            <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)} disabled={closed}
              placeholder="ملاحظاتك على الشهر: تسويات مطلوبة، فروقات، متابعات..."
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-brand-700 rounded-xl text-sm font-medium text-slate-700 dark:text-brand-50 dark:bg-brand-900 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 resize-none disabled:bg-slate-50" />
            <div className="flex items-center gap-2 mt-3">
              {!closed ? (
                <button onClick={() => saveClosing('closed')} disabled={saving}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white px-6 py-2.5 rounded-xl font-black text-sm shadow-md transition-colors">
                  {saving ? <RefreshCw size={15} className="animate-spin" /> : <Lock size={15} />} إقفال الشهر وتوثيق التقرير
                </button>
              ) : (
                <button onClick={() => saveClosing('open')} disabled={saving}
                  className="flex items-center gap-2 bg-white border-2 border-amber-300 text-amber-700 hover:bg-amber-50 px-6 py-2.5 rounded-xl font-black text-sm transition-colors">
                  <Unlock size={15} /> إعادة فتح الشهر
                </button>
              )}
              <span className="text-[10px] text-slate-400 font-bold">الإقفال يحفظ لقطة كاملة من التقرير والملاحظات في قاعدة البيانات</span>
            </div>
          </div>
        </>
      )}

      {/* سجل القفلات */}
      <div className="bg-white dark:bg-brand-900 rounded-2xl shadow-sm border border-slate-100 dark:border-brand-700 p-4">
        <h3 className="text-sm font-black text-brand-800 dark:text-brand-100 mb-3">سجل القفلات</h3>
        {history.length === 0 ? <p className="text-xs text-slate-400 font-bold">لا توجد قفلات موثقة بعد</p> : history.map(h => (
          <button key={h.ym} onClick={() => { setYm(h.ym); generate(h.ym); }}
            className="w-full flex justify-between items-center py-2 border-b border-slate-50 dark:border-brand-800 text-xs hover:bg-slate-50 dark:hover:bg-brand-800 rounded-lg px-2 transition-colors">
            <span className="font-black text-brand-800 dark:text-brand-100">{h.ym}</span>
            <span className="font-bold text-slate-400 truncate max-w-[40%]">{h.notes || ''}</span>
            <span className={`px-2 py-0.5 rounded-full font-black ${h.status === 'closed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
              {h.status === 'closed' ? `مقفل · ${h.closed_by || ''}` : 'مفتوح'}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
