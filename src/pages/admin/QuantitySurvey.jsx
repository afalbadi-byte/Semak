// ════════════════════════════════════════════════════════════════════════════
//  التمتير وتقدير تكلفة التنفيذ — أداة ذكية لحساب كميات وتكاليف بنود البناء
//  كل بند له معادلة حساب افتراضية (مساحة / محيط جدران / طول×ارتفاع / م.ط / مقطوعية)
//  قابلة للتغيير لكل قسم. الحفظ: JSON blob لكل كشف في acc_settings['qs_survey_{id}']
// ════════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Ruler, Plus, Trash2, Save, ArrowRight, Loader2, Download, Copy,
  Calculator, ChevronDown, ChevronUp, FileSpreadsheet, CircleDollarSign,
  Layers, Sigma, AlertTriangle, Check, Wand2,
} from 'lucide-react';
import { apiGet, apiPost, TENANT } from '../../lib/api/client';

const LS_KEY = 'semak_qs_cache';

// ─── معادلات الحساب ──────────────────────────────────────────────────────────
const MODES = {
  area:      { label: 'مساحة (طول × عرض)',             unit: 'م²',  hint: 'ط × ع',            calc: (L, W, H) => L * W },
  perimeter: { label: 'جدران الغرفة ((ط+ع)×2×ارتفاع)', unit: 'م²',  hint: '(ط+ع)×2×ا',        calc: (L, W, H) => (L + W) * 2 * H },
  lh:        { label: 'طول × ارتفاع',                   unit: 'م²',  hint: 'ط × ا',            calc: (L, W, H) => L * (H || W) },
  volume:    { label: 'طول × عرض × ارتفاع',             unit: 'م²',  hint: 'ط × ع × ا',        calc: (L, W, H) => L * W * H },
  linear:    { label: 'متر طولي',                       unit: 'م.ط', hint: 'الطول فقط',         calc: (L) => L },
};

const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };

// كمية السطر: يدوي يتغلب على المعادلة — والمعادلة تتجاهل الأبعاد الفارغة بذكاء
function rowQty(row, mode) {
  if (row.manual !== '' && row.manual != null) return num(row.manual);
  const L = num(row.L), W = num(row.W), H = num(row.H);
  if (!L && !W && !H) return 0;
  const m = MODES[mode] || MODES.area;
  if (mode === 'area')      return L && W ? L * W : (L || W);
  if (mode === 'perimeter') return H ? (L + W) * 2 * H : 0;
  if (mode === 'lh')        return L * (H || W || 1);
  if (mode === 'volume')    return [L, W, H].filter(Boolean).reduce((a, b) => a * b, 1);
  if (mode === 'linear')    return L * (W || 1);
  return m.calc(L, W, H);
}

const uid = () => Math.random().toString(36).slice(2, 9);
const emptyRow = () => ({ id: uid(), name: '', L: '', W: '', H: '', manual: '' });
const newSection = (name = 'قسم جديد', mode = null) => ({ id: uid(), name, mode, mult: 1, multLabel: '', rows: [emptyRow(), emptyRow(), emptyRow()], open: true });

// ─── القالب الافتراضي (بنية مشروع سماك — بدون أرقام) ─────────────────────────
const DEFAULT_TRADES = [
  { name: 'العظم',     mode: 'area',      sections: ['الأسقف', 'الخزانات والملاحق', 'الأسوار'] },
  { name: 'اللياسة',   mode: 'perimeter', sections: ['الشقق', 'الدرج', 'الواجهات الخارجية'] },
  { name: 'الكيشاني',  mode: 'lh',        sections: ['دورات المياه والمطابخ'] },
  { name: 'الجبس',     mode: 'area',      sections: ['الشقق', 'الدرج'] },
  { name: 'الأرضيات',  mode: 'area',      sections: ['الشقق', 'الأجزاء المشتركة', 'السكلو (النعلات)'] },
  { name: 'الدهان',    mode: 'perimeter', sections: ['الجدران', 'الأسقف'] },
  { name: 'البروفايل', mode: 'lh',        sections: ['الواجهات والمنور', 'الدرج والسطح'] },
];
const DEFAULT_LUMPS = [
  { name: 'السباك',    amount: '' },
  { name: 'الكهربائي', amount: '' },
];

function makeTrade(t) {
  return {
    id: uid(), name: t.name, type: 'metered', mode: t.mode,
    price: '', adjusted: '', paid: '',
    sections: t.sections.map(s => newSection(s, null)),
  };
}
function makeLump(l) {
  return { id: uid(), name: l.name, type: 'lump', amount: l.amount, adjusted: '', paid: '' };
}
function makeDefaultSurvey(name) {
  return {
    name: name || 'كشف تمتير جديد',
    trades: [...DEFAULT_TRADES.map(makeTrade), ...DEFAULT_LUMPS.map(makeLump)],
  };
}

// ─── حسابات البند ─────────────────────────────────────────────────────────────
function tradeCalc(tr) {
  if (tr.type === 'lump') {
    const cost = num(tr.amount);
    const final = tr.adjusted !== '' ? num(tr.adjusted) : cost;
    return { meters: 0, cost, final, paid: num(tr.paid), remaining: final - num(tr.paid) };
  }
  let meters = 0;
  for (const sec of tr.sections || []) {
    const mode = sec.mode || tr.mode || 'area';
    const sub = (sec.rows || []).reduce((a, r) => a + rowQty(r, mode), 0);
    meters += sub * (num(sec.mult) || 1);
  }
  const cost = meters * num(tr.price);
  const final = tr.adjusted !== '' ? num(tr.adjusted) : cost;
  return { meters, cost, final, paid: num(tr.paid), remaining: final - num(tr.paid) };
}

const fmt = (n) => (Number.isFinite(n) ? n : 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
const fmtSAR = (n) => fmt(Math.round(n));

// ════════════════════════════════════════════════════════════════════════════
export default function QuantitySurvey({ showToast }) {
  const [view, setView] = useState('list');           // list | editor
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [survey, setSurvey] = useState(null);
  const [surveyId, setSurveyId] = useState(null);
  const [activeTrade, setActiveTrade] = useState('summary');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const toast = useCallback((title, msg, type) => showToast?.(title, msg, type), [showToast]);

  // ─── تحميل القائمة ─────────────────────────────────────────────────────────
  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet('qs_list', {}, { tenant: TENANT });
      if (res?.success) setSurveys(res.surveys || []);
    } catch { /* offline — نكمل من الكاش */ }
    setLoading(false);
  }, []);
  useEffect(() => { loadList(); }, [loadList]);

  // ─── فتح / إنشاء كشف ──────────────────────────────────────────────────────
  const openSurvey = async (id) => {
    setLoading(true);
    try {
      const res = await apiGet('qs_get', { id }, { tenant: TENANT });
      if (res?.success && res.data) {
        setSurvey(res.data); setSurveyId(id); setView('editor');
        setActiveTrade('summary'); setDirty(false);
      } else toast('خطأ', 'تعذر فتح الكشف', 'error');
    } catch {
      const cached = JSON.parse(localStorage.getItem(LS_KEY + '_' + id) || 'null');
      if (cached) { setSurvey(cached); setSurveyId(id); setView('editor'); setDirty(false); }
      else toast('خطأ', 'لا يوجد اتصال بالخادم', 'error');
    }
    setLoading(false);
  };

  const createSurvey = () => {
    const s = makeDefaultSurvey('');
    const id = Date.now().toString(36);
    setSurvey(s); setSurveyId(id); setView('editor');
    setActiveTrade('summary'); setDirty(true);
  };

  const deleteSurvey = async (id) => {
    if (!window.confirm('حذف هذا الكشف نهائياً؟')) return;
    try {
      await apiPost('qs_delete', { id }, {}, { tenant: TENANT });
      localStorage.removeItem(LS_KEY + '_' + id);
      loadList();
    } catch { toast('خطأ', 'تعذر الحذف', 'error'); }
  };

  // ─── الإجماليات ────────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    if (!survey) return null;
    const per = (survey.trades || []).map(tr => ({ tr, c: tradeCalc(tr) }));
    const grand = per.reduce((a, { c }) => ({
      cost: a.cost + c.cost, final: a.final + c.final,
      paid: a.paid + c.paid, remaining: a.remaining + c.remaining,
    }), { cost: 0, final: 0, paid: 0, remaining: 0 });
    return { per, grand, progress: grand.final > 0 ? grand.paid / grand.final : 0 };
  }, [survey]);

  // ─── الحفظ ────────────────────────────────────────────────────────────────
  const save = async () => {
    if (!survey || !surveyId) return;
    if (!survey.name?.trim()) { toast('تنبيه', 'اكتب اسم الكشف / المشروع أولاً', 'error'); return; }
    setSaving(true);
    localStorage.setItem(LS_KEY + '_' + surveyId, JSON.stringify(survey));
    try {
      const res = await apiPost('qs_save', { id: surveyId, data: survey, total: totals?.grand.final || 0 }, {}, { tenant: TENANT });
      if (res?.success) { setDirty(false); toast('نجاح', 'تم حفظ الكشف'); loadList(); }
      else toast('خطأ', res?.message || 'فشل الحفظ', 'error');
    } catch { toast('تنبيه', 'حُفظ محلياً فقط — لا يوجد اتصال', 'error'); }
    setSaving(false);
  };

  // ─── تعديل الحالة ─────────────────────────────────────────────────────────
  const patch = (fn) => { setSurvey(s => { const c = structuredClone(s); fn(c); return c; }); setDirty(true); };
  const patchTrade = (tid, fn) => patch(s => { const t = s.trades.find(x => x.id === tid); if (t) fn(t); });

  // ─── تصدير Excel ──────────────────────────────────────────────────────────
  const exportExcel = async () => {
    if (!survey || !totals) return;
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: true }] };
    // ورقة الاجماليات
    const sumRows = totals.per.map(({ tr, c }) => ({
      'البند': tr.name,
      'الأمتار': tr.type === 'lump' ? 'مقطوعية' : fmt(c.meters),
      'سعر المتر': tr.type === 'lump' ? '-' : num(tr.price),
      'التكلفة المحسوبة': Math.round(c.cost),
      'تعديل الحساب': tr.adjusted !== '' ? num(tr.adjusted) : '',
      'النهائي': Math.round(c.final),
      'المدفوع': Math.round(c.paid),
      'المتبقي': Math.round(c.remaining),
    }));
    sumRows.push({ 'البند': 'الإجمالي', 'الأمتار': '', 'سعر المتر': '', 'التكلفة المحسوبة': Math.round(totals.grand.cost), 'تعديل الحساب': '', 'النهائي': Math.round(totals.grand.final), 'المدفوع': Math.round(totals.grand.paid), 'المتبقي': Math.round(totals.grand.remaining) });
    const ws = XLSX.utils.json_to_sheet(sumRows);
    ws['!cols'] = Array(8).fill({ wch: 15 });
    XLSX.utils.book_append_sheet(wb, ws, 'اجماليات');
    // ورقة لكل بند ممتّر
    for (const tr of survey.trades) {
      if (tr.type === 'lump') continue;
      const rows = [];
      for (const sec of tr.sections || []) {
        const mode = sec.mode || tr.mode || 'area';
        for (const r of sec.rows || []) {
          if (!r.name && !r.L && !r.W && !r.H && !r.manual) continue;
          rows.push({
            'القسم': sec.name, 'البيان': r.name,
            'الطول': r.L, 'العرض/العدد': r.W, 'الارتفاع': r.H,
            'الأمتار': fmt(rowQty(r, mode)),
          });
        }
        if (num(sec.mult) > 1) rows.push({ 'القسم': sec.name, 'البيان': `× ${sec.mult} (${sec.multLabel || 'مضاعف'})`, 'الطول': '', 'العرض/العدد': '', 'الارتفاع': '', 'الأمتار': '' });
      }
      const wst = XLSX.utils.json_to_sheet(rows);
      wst['!cols'] = Array(6).fill({ wch: 14 });
      XLSX.utils.book_append_sheet(wb, wst, tr.name.slice(0, 30));
    }
    XLSX.writeFile(wb, `تمتير_${survey.name || 'كشف'}.xlsx`);
  };

  // ════════════════ واجهة قائمة الكشوف ════════════════
  if (view === 'list') {
    return (
      <div className="p-6 md:p-8" dir="rtl">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h2 className="text-2xl font-extrabold text-slate-800 flex items-center gap-2">
              <Ruler className="w-7 h-7 text-emerald-600" /> التمتير وتقدير التكاليف
            </h2>
            <p className="text-slate-500 text-sm mt-1">حساب كميات البنود (لياسة، أرضيات، دهان...) وتقدير تكلفة تنفيذ المشروع</p>
          </div>
          <button onClick={createSurvey} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-5 py-2.5 rounded-xl shadow transition">
            <Plus className="w-5 h-5" /> كشف جديد
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
        ) : surveys.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300">
            <Calculator className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-semibold">لا توجد كشوف تمتير بعد</p>
            <p className="text-slate-400 text-sm mt-1">أنشئ كشفاً جديداً — يأتي جاهزاً ببنود البناء الأساسية</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {surveys.map(s => (
              <div key={s.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:shadow-md transition group">
                <div className="flex items-start justify-between">
                  <button onClick={() => openSurvey(s.id)} className="text-right flex-1">
                    <h3 className="font-extrabold text-slate-800 group-hover:text-emerald-700 transition">{s.name}</h3>
                    <p className="text-xs text-slate-400 mt-1">آخر تحديث: {s.updated}</p>
                    <p className="text-lg font-black text-emerald-600 mt-3">{fmtSAR(s.total || 0)} <span className="text-xs font-bold">﷼</span></p>
                  </button>
                  <button onClick={() => deleteSurvey(s.id)} className="p-2 text-slate-300 hover:text-red-500 transition" title="حذف">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ════════════════ واجهة المحرر ════════════════
  if (!survey || !totals) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;

  const tr = survey.trades.find(t => t.id === activeTrade);

  return (
    <div className="p-4 md:p-6" dir="rtl">
      {/* الرأس */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button onClick={() => { if (dirty && !window.confirm('توجد تعديلات غير محفوظة — الخروج؟')) return; setView('list'); loadList(); }}
          className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 transition" title="رجوع">
          <ArrowRight className="w-5 h-5 text-slate-600" />
        </button>
        <input value={survey.name} onChange={e => patch(s => { s.name = e.target.value; })}
          placeholder="اسم الكشف / المشروع…"
          className="flex-1 min-w-[200px] text-xl font-extrabold text-slate-800 bg-transparent border-b-2 border-transparent focus:border-emerald-400 outline-none py-1" />
        <button onClick={exportExcel} className="flex items-center gap-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold px-4 py-2 rounded-xl transition">
          <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel
        </button>
        <button onClick={save} disabled={saving}
          className={`flex items-center gap-2 font-bold px-5 py-2 rounded-xl shadow transition text-white ${dirty ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-400'}`}>
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : dirty ? <Save className="w-4 h-4" /> : <Check className="w-4 h-4" />}
          {saving ? 'جارٍ الحفظ…' : dirty ? 'حفظ' : 'محفوظ'}
        </button>
      </div>

      {/* بطاقات الإجمالي */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'التكلفة المتوقعة', val: totals.grand.final, color: 'emerald', icon: CircleDollarSign },
          { label: 'المحسوبة (قبل التعديل)', val: totals.grand.cost, color: 'slate', icon: Calculator },
          { label: 'المدفوع', val: totals.grand.paid, color: 'blue', icon: Check },
          { label: 'المتبقي', val: totals.grand.remaining, color: 'amber', icon: AlertTriangle },
        ].map((c, i) => (
          <div key={i} className={`bg-white rounded-2xl border border-slate-200 p-4`}>
            <p className="text-xs font-bold text-slate-400 flex items-center gap-1.5"><c.icon className={`w-4 h-4 text-${c.color}-500`} /> {c.label}</p>
            <p className={`text-xl font-black mt-1 text-${c.color}-600`}>{fmtSAR(c.val)} <span className="text-xs">﷼</span></p>
          </div>
        ))}
      </div>

      {/* تبويبات البنود */}
      <div className="flex gap-2 flex-wrap mb-4">
        <button onClick={() => setActiveTrade('summary')}
          className={`px-4 py-2 rounded-xl font-bold text-sm transition ${activeTrade === 'summary' ? 'bg-slate-800 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
          <Sigma className="w-4 h-4 inline ml-1" /> الاجماليات
        </button>
        {survey.trades.map(t => {
          const c = tradeCalc(t);
          return (
            <button key={t.id} onClick={() => setActiveTrade(t.id)}
              className={`px-4 py-2 rounded-xl font-bold text-sm transition ${activeTrade === t.id ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
              {t.name}
              {c.final > 0 && <span className={`mr-1.5 text-[10px] ${activeTrade === t.id ? 'text-emerald-100' : 'text-slate-400'}`}>{fmtSAR(c.final)}</span>}
            </button>
          );
        })}
        <button onClick={() => {
          const name = window.prompt('اسم البند الجديد؟'); if (!name) return;
          const lump = window.confirm('هل هو بند مقطوعية (مبلغ ثابت بدون تمتير)؟\nموافق = مقطوعية · إلغاء = بند ممتّر');
          patch(s => { s.trades.push(lump ? makeLump({ name, amount: '' }) : { id: uid(), name, type: 'metered', mode: 'area', price: '', adjusted: '', paid: '', sections: [newSection('القسم الأول')] }); });
        }} className="px-3 py-2 rounded-xl border border-dashed border-slate-300 text-slate-400 hover:text-emerald-600 hover:border-emerald-400 transition text-sm font-bold">
          <Plus className="w-4 h-4 inline" /> بند
        </button>
      </div>

      {/* ─── محتوى التبويب ─── */}
      {activeTrade === 'summary' ? (
        <SummaryTable totals={totals} onOpen={setActiveTrade} onDeleteTrade={(tid) => { if (window.confirm('حذف هذا البند بكامل تمتيره؟')) patch(s => { s.trades = s.trades.filter(x => x.id !== tid); }); }} />
      ) : tr ? (
        tr.type === 'lump'
          ? <LumpEditor tr={tr} patchTrade={patchTrade} />
          : <TradeEditor tr={tr} patchTrade={patchTrade} toast={toast} />
      ) : null}
    </div>
  );
}

// ─── جدول الاجماليات ──────────────────────────────────────────────────────────
function SummaryTable({ totals, onOpen, onDeleteTrade }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
      <table className="w-full text-sm min-w-[760px]">
        <thead>
          <tr className="bg-slate-50 text-slate-500 text-xs">
            {['البند', 'الأمتار', 'سعر المتر', 'التكلفة المحسوبة', 'تعديل الحساب', 'النهائي', 'المدفوع', 'المتبقي', ''].map((h, i) =>
              <th key={i} className="px-4 py-3 font-bold text-right whitespace-nowrap">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {totals.per.map(({ tr, c }) => (
            <tr key={tr.id} className="border-t border-slate-100 hover:bg-emerald-50/40 transition cursor-pointer" onClick={() => onOpen(tr.id)}>
              <td className="px-4 py-3 font-extrabold text-slate-700">{tr.name}
                {tr.type === 'lump' && <span className="mr-2 text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">مقطوعية</span>}
              </td>
              <td className="px-4 py-3 font-bold text-slate-600">{tr.type === 'lump' ? '—' : fmt(c.meters)}</td>
              <td className="px-4 py-3 text-slate-500">{tr.type === 'lump' ? '—' : (tr.price || '—')}</td>
              <td className="px-4 py-3 text-slate-600">{fmtSAR(c.cost)}</td>
              <td className="px-4 py-3 text-amber-600 font-bold">{tr.adjusted !== '' ? fmtSAR(num(tr.adjusted)) : '—'}</td>
              <td className="px-4 py-3 font-black text-emerald-700">{fmtSAR(c.final)}</td>
              <td className="px-4 py-3 text-blue-600">{c.paid ? fmtSAR(c.paid) : '—'}</td>
              <td className="px-4 py-3 font-bold text-slate-700">{fmtSAR(c.remaining)}</td>
              <td className="px-2 py-3" onClick={e => e.stopPropagation()}>
                <button onClick={() => onDeleteTrade(tr.id)} className="p-1.5 text-slate-300 hover:text-red-500 transition"><Trash2 className="w-4 h-4" /></button>
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-slate-200 bg-slate-50 font-black text-slate-800">
            <td className="px-4 py-3">الإجمالي</td>
            <td colSpan={2}></td>
            <td className="px-4 py-3">{fmtSAR(totals.grand.cost)}</td>
            <td></td>
            <td className="px-4 py-3 text-emerald-700 text-base">{fmtSAR(totals.grand.final)} ﷼</td>
            <td className="px-4 py-3 text-blue-700">{fmtSAR(totals.grand.paid)}</td>
            <td className="px-4 py-3">{fmtSAR(totals.grand.remaining)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
      {totals.grand.final > 0 && (
        <div className="px-4 py-3 border-t border-slate-100 flex items-center gap-3">
          <span className="text-xs font-bold text-slate-500">نسبة الإنجاز المالي</span>
          <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-l from-emerald-500 to-emerald-400 rounded-full transition-all" style={{ width: `${Math.min(100, totals.progress * 100)}%` }} />
          </div>
          <span className="text-sm font-black text-emerald-600">{(totals.progress * 100).toFixed(1)}%</span>
        </div>
      )}
    </div>
  );
}

// ─── محرر بند مقطوعية ─────────────────────────────────────────────────────────
function LumpEditor({ tr, patchTrade }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-xl">
      <h3 className="font-extrabold text-slate-800 mb-4 flex items-center gap-2"><CircleDollarSign className="w-5 h-5 text-emerald-600" /> {tr.name} — مقطوعية</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label="المبلغ المتفق عليه (﷼)" value={tr.amount} onChange={v => patchTrade(tr.id, t => { t.amount = v; })} />
        <Field label="تعديل الحساب (اختياري)" value={tr.adjusted} onChange={v => patchTrade(tr.id, t => { t.adjusted = v; })} accent="amber" />
        <Field label="المدفوع" value={tr.paid} onChange={v => patchTrade(tr.id, t => { t.paid = v; })} accent="blue" />
      </div>
      <p className="text-xs text-slate-400 mt-4">بند بدون تمتير — يُحتسب المبلغ مباشرة ضمن إجمالي المشروع. «تعديل الحساب» يتغلب على المبلغ إن وُجد.</p>
    </div>
  );
}

// ─── محرر بند ممتّر ───────────────────────────────────────────────────────────
function TradeEditor({ tr, patchTrade, toast }) {
  const c = tradeCalc(tr);
  return (
    <div className="space-y-4">
      {/* شريط تسعير البند */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[140px]">
          <p className="text-[11px] font-bold text-slate-400 mb-1">المعادلة الافتراضية للبند</p>
          <select value={tr.mode} onChange={e => patchTrade(tr.id, t => { t.mode = e.target.value; })}
            className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-slate-700 bg-slate-50">
            {Object.entries(MODES).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
          </select>
        </div>
        <Field label={`سعر المتر (${MODES[tr.mode]?.unit || 'م²'})`} value={tr.price} onChange={v => patchTrade(tr.id, t => { t.price = v; })} w="w-32" />
        <Field label="تعديل الحساب" value={tr.adjusted} onChange={v => patchTrade(tr.id, t => { t.adjusted = v; })} accent="amber" w="w-32" />
        <Field label="المدفوع" value={tr.paid} onChange={v => patchTrade(tr.id, t => { t.paid = v; })} accent="blue" w="w-32" />
        <div className="mr-auto text-left">
          <p className="text-[11px] font-bold text-slate-400">إجمالي الأمتار → التكلفة</p>
          <p className="font-black text-slate-800">{fmt(c.meters)} {MODES[tr.mode]?.unit} <span className="text-emerald-600">→ {fmtSAR(c.final)} ﷼</span></p>
        </div>
      </div>

      {/* الأقسام */}
      {(tr.sections || []).map(sec => (
        <SectionEditor key={sec.id} tr={tr} sec={sec} patchTrade={patchTrade} toast={toast} />
      ))}
      <button onClick={() => patchTrade(tr.id, t => { t.sections.push(newSection()); })}
        className="w-full py-3 rounded-2xl border-2 border-dashed border-slate-300 text-slate-400 hover:text-emerald-600 hover:border-emerald-400 font-bold text-sm transition">
        <Plus className="w-4 h-4 inline ml-1" /> إضافة قسم (مثل: الشقق، الدرج، السور…)
      </button>
    </div>
  );
}

// ─── سحب البيانات من المخطط (صورة / PDF / DWG) ───────────────────────────────
// DWG: يُفكّ في المتصفح عبر WASM (libredwg). إن وُجدت نصوص وديمنشنات حقيقية
// تُرسل كبيانات CAD؛ وإن كانت النصوص «مفجّرة» تُرسم اللوحات إلى صور وتُقرأ بصرياً.
function DrawingExtractButton({ onRooms, toast }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const isDwg = /\.dwg$/i.test(file.name);
    if (!isDwg && file.size > 5 * 1024 * 1024) { toast?.('تنبيه', 'حجم الملف يتجاوز 5MB — صغّر الصورة', 'error'); return; }
    if (isDwg && file.size > 60 * 1024 * 1024) { toast?.('تنبيه', 'ملف DWG أكبر من 60MB', 'error'); return; }
    setBusy(true);
    try {
      let payload;
      if (isDwg) {
        const { extractFromDwg } = await import('../../lib/dwgExtract');
        const ex = await extractFromDwg(file, setStage);
        setStage('جارٍ تحليل البيانات…');
        payload = ex.kind === 'cad' ? { cad: ex.cad } : { files: ex.images };
      } else {
        setStage('جارٍ قراءة المخطط…');
        const b64 = await new Promise((res, rej) => {
          const rd = new FileReader();
          rd.onload = () => res(String(rd.result).split(',')[1]);
          rd.onerror = rej;
          rd.readAsDataURL(file);
        });
        payload = { file: b64, media_type: file.type === 'application/pdf' ? 'application/pdf' : (file.type || 'image/png') };
      }
      const r = await apiPost('qs_extract_drawing', payload, {}, { tenant: TENANT });
      if (r?.success && r.rooms?.length) {
        onRooms(r.rooms);
        toast?.('نجاح', `تم استخراج ${r.rooms.length} فراغاً من المخطط`);
      } else toast?.('خطأ', r?.message || 'لم يُعثر على فراغات في المخطط', 'error');
    } catch (err) { toast?.('خطأ', err?.message || 'فشل قراءة المخطط', 'error'); }
    setBusy(false); setStage('');
  };

  return (
    <>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp,application/pdf,.dwg" className="hidden" onChange={handleFile} />
      <button onClick={() => inputRef.current?.click()} disabled={busy}
        className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1 disabled:opacity-60">
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
        {busy ? (stage || 'جارٍ قراءة المخطط…') : 'سحب من المخطط (صورة / PDF / DWG)'}
      </button>
    </>
  );
}

// ─── محرر قسم ─────────────────────────────────────────────────────────────────
function SectionEditor({ tr, sec, patchTrade, toast }) {
  const mode = sec.mode || tr.mode || 'area';
  const sub = (sec.rows || []).reduce((a, r) => a + rowQty(r, mode), 0);
  const total = sub * (num(sec.mult) || 1);
  const patchSec = (fn) => patchTrade(tr.id, t => { const s = t.sections.find(x => x.id === sec.id); if (s) fn(s); });

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      {/* رأس القسم */}
      <div className="flex items-center gap-2 px-4 py-3 bg-slate-50/70 flex-wrap">
        <button onClick={() => patchSec(s => { s.open = !s.open; })} className="p-1 text-slate-400">
          {sec.open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
        <input value={sec.name} onChange={e => patchSec(s => { s.name = e.target.value; })}
          className="font-extrabold text-slate-700 bg-transparent outline-none border-b border-transparent focus:border-emerald-400 min-w-[120px]" />
        <select value={sec.mode || ''} onChange={e => patchSec(s => { s.mode = e.target.value || null; })}
          className="text-[11px] border border-slate-200 rounded-lg px-2 py-1 bg-white text-slate-500 font-bold" title="معادلة هذا القسم">
          <option value="">معادلة البند ({MODES[tr.mode]?.hint})</option>
          {Object.entries(MODES).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
        </select>
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-slate-400 font-bold">×</span>
          <input type="number" min="1" value={sec.mult} onChange={e => patchSec(s => { s.mult = e.target.value; })}
            className="w-14 border border-slate-200 rounded-lg px-2 py-1 text-center font-bold" title="مضاعف — مثل 6 شقق" />
          <input value={sec.multLabel} onChange={e => patchSec(s => { s.multLabel = e.target.value; })}
            placeholder="شقق…" className="w-16 border border-slate-200 rounded-lg px-2 py-1 text-slate-500" />
        </div>
        <div className="mr-auto flex items-center gap-3">
          <span className="text-sm font-black text-emerald-600">{fmt(total)} {MODES[mode]?.unit}</span>
          <button onClick={() => { if (window.confirm('حذف القسم؟')) patchTrade(tr.id, t => { t.sections = t.sections.filter(x => x.id !== sec.id); }); }}
            className="p-1.5 text-slate-300 hover:text-red-500 transition"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>

      {/* السطور */}
      {sec.open && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-[11px] text-slate-400 border-t border-slate-100">
                <th className="px-3 py-2 text-right font-bold w-[30%]">البيان</th>
                <th className="px-2 py-2 font-bold">الطول</th>
                <th className="px-2 py-2 font-bold">العرض / العدد</th>
                <th className="px-2 py-2 font-bold">الارتفاع</th>
                <th className="px-2 py-2 font-bold">يدوي</th>
                <th className="px-3 py-2 font-bold text-left">الأمتار <span className="font-normal">({MODES[mode]?.hint})</span></th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody>
              {(sec.rows || []).map(r => {
                const q = rowQty(r, mode);
                return (
                  <tr key={r.id} className="border-t border-slate-50 hover:bg-slate-50/50">
                    <td className="px-3 py-1">
                      <input value={r.name} onChange={e => patchSec(s => { const x = s.rows.find(y => y.id === r.id); x.name = e.target.value; })}
                        placeholder="المجلس، الصالة…" className="w-full bg-transparent outline-none py-1 font-semibold text-slate-700" />
                    </td>
                    {['L', 'W', 'H', 'manual'].map(f => (
                      <td key={f} className="px-2 py-1">
                        <input type="number" step="any" value={r[f]}
                          onChange={e => patchSec(s => { const x = s.rows.find(y => y.id === r.id); x[f] = e.target.value; })}
                          className={`w-full text-center bg-transparent outline-none py-1 rounded-lg focus:bg-white focus:ring-1 focus:ring-emerald-300 ${f === 'manual' ? 'text-purple-600 font-bold' : 'text-slate-600'}`} />
                      </td>
                    ))}
                    <td className="px-3 py-1 text-left font-bold text-slate-700">{q ? fmt(q) : ''}</td>
                    <td className="px-1">
                      <button onClick={() => patchSec(s => { s.rows = s.rows.filter(y => y.id !== r.id); })}
                        className="p-1 text-slate-200 hover:text-red-400 transition"><Trash2 className="w-3.5 h-3.5" /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="flex items-center gap-2 px-3 py-2 border-t border-slate-100">
            <button onClick={() => patchSec(s => { s.rows.push(emptyRow()); })}
              className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> سطر</button>
            <button onClick={() => patchSec(s => { const last = s.rows[s.rows.length - 1]; s.rows.push(last ? { ...structuredClone(last), id: uid(), name: '' } : emptyRow()); })}
              className="text-xs font-bold text-slate-400 hover:text-slate-600 flex items-center gap-1"><Copy className="w-3.5 h-3.5" /> تكرار الأخير</button>
            <DrawingExtractButton toast={toast} onRooms={(rooms) => patchSec(s => {
              s.rows = s.rows.filter(r => r.name || r.L || r.W || r.H || r.manual); // إزالة السطور الفارغة
              for (const rm of rooms) s.rows.push({ id: uid(), name: rm.name, L: rm.L === '' ? '' : String(rm.L), W: rm.W === '' ? '' : String(rm.W), H: rm.H === '' ? '' : String(rm.H), manual: '' });
            })} />
            <span className="mr-auto text-[11px] text-slate-400">«يدوي» يتغلب على المعادلة — استخدمه للقيم الجاهزة أو الخصم (بالسالب)</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── حقل رقم صغير ─────────────────────────────────────────────────────────────
function Field({ label, value, onChange, accent = 'slate', w = '' }) {
  return (
    <div className={w}>
      <p className="text-[11px] font-bold text-slate-400 mb-1">{label}</p>
      <input type="number" step="any" value={value} onChange={e => onChange(e.target.value)}
        className={`w-full border border-slate-200 rounded-xl px-3 py-2 text-sm font-bold text-${accent}-700 focus:ring-2 focus:ring-emerald-300 outline-none`} />
    </div>
  );
}
