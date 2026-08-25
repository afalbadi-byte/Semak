import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Search, Calendar, DollarSign, ShoppingCart,
  Building, Edit3, ChevronLeft, RefreshCw,
  AlertTriangle, CheckCircle2, X, Package, Truck
} from 'lucide-react';
import ExportButton from '../../components/ExportButton';
import { fmt as fmtExport } from '../../utils/exporters';
import useTableControls from '../../utils/useTableControls';
import SortHeader from '../../components/SortHeader';
import TablePager from '../../components/TablePager';

import { API_URL } from '../../lib/api/client';
import { useToast } from '../../components/ui';
import { usePartyDirectory } from '../../hooks/usePartyDirectory';

// ─── تنسيق الأرقام ───────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(n) || 0) + ' ر.س';

// ─── اليوم بتنسيق YYYY-MM-DD ─────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);

// ─── بند فارغ ────────────────────────────────────────────────────
const emptyItem = () => ({ name: '', quantity: 1, unit_price: 0, discount: 0, tax: 15 });


// ─── شريحة ملخص ──────────────────────────────────────────────────
function SummaryChip({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-3 bg-white dark:bg-brand-900 rounded-2xl shadow-sm border border-slate-100 dark:border-brand-700 px-4 py-3 flex-1 min-w-[160px]">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-slate-400 dark:text-brand-400 font-medium">{label}</p>
        <p className="text-sm font-black text-slate-700 dark:text-brand-300">{value}</p>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// المكوّن الرئيسي
// ════════════════════════════════════════════════════════════════
export default function PurchasesManage({ user, navigateTo, showToast: externalToast }) {
  const navigate   = useNavigate();
  const partyDir   = usePartyDirectory();

  // ─── حالة العرض ─────────────────────────────────────────────
  const [view, setView]             = useState('list');
  const [purchases, setPurchases]   = useState([]);
  const [suppliers, setSuppliers]   = useState([]);
  const [workCycles, setWorkCycles] = useState([]);
  const [classTree, setClassTree]   = useState([]);   // شجرة التصنيف [{code,level,name}]
  const [classMap, setClassMap]     = useState({});   // { [purchase_id]: code }
  const [classFilter, setClassFilter] = useState(''); // '' الكل · 'none' غير مصنف · بادئة كود
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [selected, setSelected]     = useState(null);
  const toast                        = useToast();

  const [filters, setFilters] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    to: today(),
    search: '',
  });
  const [appliedFilters, setAppliedFilters] = useState({ ...filters });

  const defaultForm = {
    supplier_id: '', date: today(),
    work_order_id: '', notes: '',
    items: [emptyItem()],
  };
  const [form, setForm] = useState(defaultForm);

  // ─── Toast مساعد ─────────────────────────────────────────────
  const notify = (msg, type = 'success') => type === 'error' ? toast.error(msg) : toast.success(msg);

  // ─── جلب القوائم المنسدلة ─────────────────────────────────────
  const loadDropdowns = useCallback(async () => {
    try {
      const [sRes, wRes, tRes, cRes] = await Promise.all([
        fetch(`${API_URL}?action=daftra_suppliers_list`),
        fetch(`${API_URL}?action=daftra_v2_work_cycles`),
        fetch(`${API_URL}?action=pur_class_tree`),
        fetch(`${API_URL}?action=pur_class_get`),
      ]);
      const [sData, wData, tData, cData] = await Promise.all([sRes.json(), wRes.json(), tRes.json(), cRes.json()]);
      if (sData.success && Array.isArray(sData.data)) setSuppliers(sData.data);
      if (wData.success && Array.isArray(wData.data)) setWorkCycles(wData.data);
      if (tData.success && Array.isArray(tData.tree)) setClassTree(tData.tree);
      if (cData.success && Array.isArray(cData.data)) {
        const m = {};
        cData.data.forEach(r => { if (r.kind === 'purchase') m[String(r.ref_id)] = r.code; });
        setClassMap(m);
      }
    } catch { /* تجاهل */ }
  }, []);

  // ─── حفظ تصنيف فاتورة (تفاؤلي + تراجع عند الفشل) ─────────────
  const setClass = async (purchase, code) => {
    const purchaseId = purchase.id;
    const prev = classMap[String(purchaseId)] || '';
    setClassMap(m => ({ ...m, [String(purchaseId)]: code }));
    try {
      const res = await fetch(`${API_URL}?action=pur_class_set`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: 'purchase', ref_id: purchaseId, supplier_id: purchase.supplier_id || 0, code }),
      });
      const data = await res.json();
      if (!data.success) throw new Error();
    } catch {
      setClassMap(m => ({ ...m, [String(purchaseId)]: prev }));
      notify('تعذر حفظ التصنيف — أعد المحاولة', 'error');
    }
  };

  const classNameOf = (code) => (classTree.find(t => t.code === code) || {}).name || code;

  // ─── جلب قائمة المشتريات ─────────────────────────────────────
  const loadPurchases = useCallback(async (f = appliedFilters) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${API_URL}?action=daftra_purchases_list&from=${f.from}&to=${f.to}`
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setPurchases(data.data);
        // دمج التصنيفات القادمة مع القائمة (تشمل المصنفة تلقائياً حسب المورد)
        setClassMap(m => {
          const merged = { ...m };
          data.data.forEach(r => { if (r.class_code) merged[String(r.id)] = r.class_code; });
          return merged;
        });
      } else {
        setPurchases([]);
        setError(data.message || 'فشل تحميل فواتير الشراء');
      }
    } catch {
      setError('خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => { loadDropdowns(); }, [loadDropdowns]);

  useEffect(() => {
    if (view === 'list') loadPurchases(appliedFilters);
  }, [view, appliedFilters]); // eslint-disable-line

  // ─── فلترة العرض ─────────────────────────────────────────────
  // بادئة المطابقة: البند الرئيسي يشمل كل فروعه (1000→1)، والفرعي فروعه (1300→13)، والتفصيلي نفسه
  const classPrefix = (c) => c.replace(/0+$/, '') || c[0];
  // أصناف الفاتورة كلها (من بنودها) — الفلتر يطلع أي فاتورة «تحتوي» الصنف لا الغالب فقط
  const codesOf = (p) => {
    const set = new Set(Array.isArray(p.class_codes) ? p.class_codes : []);
    const dom = classMap[String(p.id)];
    if (dom) set.add(dom);
    return [...set];
  };
  const displayed = purchases.filter(p => {
    const codes = codesOf(p);
    if (classFilter === 'none' && codes.length) return false;
    if (classFilter && classFilter !== 'none') {
      const pre = classPrefix(classFilter);
      if (!codes.some(c => c.startsWith(pre))) return false;
    }
    if (!appliedFilters.search) return true;
    const q = appliedFilters.search.toLowerCase();
    return (
      String(p.no || '').toLowerCase().includes(q) ||
      String(p.supplier || '').toLowerCase().includes(q)
    );
  });

  const unclassifiedCount = purchases.filter(p => !classMap[String(p.id)]).length;
  const extraCodesOf = (p) => codesOf(p).filter(c => c !== (classMap[String(p.id)] || ''));

  // ─── عرض «حسب الأصناف»: مجموع مشتريات كل بند من قاعدة البيانات ──
  const [viewMode, setViewMode]   = useState('invoices'); // invoices | categories
  const [reportRows, setReportRows] = useState([]);
  const loadReport = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}?action=pur_class_report`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) setReportRows(data.data);
    } catch { /* تجاهل */ }
  }, []);
  useEffect(() => { if (viewMode === 'categories') loadReport(); }, [viewMode, loadReport]);

  // مجموع بند بكل فروعه (بادئة الكود)
  const sumByPrefix = (prefix) => reportRows
    .filter(r => r.code.startsWith(prefix))
    .reduce((a, r) => ({ total: a.total + parseFloat(r.total || 0), invoices: a.invoices + parseInt(r.invoices || 0, 10) }), { total: 0, invoices: 0 });
  const reportGrand = reportRows.reduce((s, r) => s + parseFloat(r.total || 0), 0);

  // ─── ملخص مالي ───────────────────────────────────────────────
  const totalAmount      = displayed.reduce((s, p) => s + (parseFloat(p.total) || 0), 0);
  const totalPaid        = displayed.reduce((s, p) => s + (parseFloat(p.paid)  || 0), 0);
  const totalOutstanding = totalAmount - totalPaid;

  // ─── فرز + ترقيم صفحات ───────────────────────────────────────
  const tc = useTableControls(displayed, { pageSize: 15, initialSort: { key: 'date', dir: 'desc' } });

  // ─── حسابات البنود ───────────────────────────────────────────
  const lineTotal = (item) => {
    const qty    = parseFloat(item.quantity)   || 0;
    const price  = parseFloat(item.unit_price) || 0;
    const disc   = parseFloat(item.discount)   || 0;
    const tax    = parseFloat(item.tax)        || 0;
    const base   = qty * price;
    const discAmt = base * (disc / 100);
    const taxAmt  = (base - discAmt) * (tax / 100);
    return base - discAmt + taxAmt;
  };

  const subtotal  = form.items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0), 0);
  const totalDisc = form.items.reduce((s, it) => {
    const base = (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0);
    return s + base * ((parseFloat(it.discount) || 0) / 100);
  }, 0);
  const totalTax  = form.items.reduce((s, it) => {
    const base  = (parseFloat(it.quantity) || 0) * (parseFloat(it.unit_price) || 0);
    const disc  = (parseFloat(it.discount) || 0) / 100;
    const taxPc = (parseFloat(it.tax) || 0) / 100;
    return s + (base * (1 - disc)) * taxPc;
  }, 0);
  const grandTotal = subtotal - totalDisc + totalTax;

  // ─── إجراءات النموذج ─────────────────────────────────────────
  const updateItem = (idx, field, val) =>
    setForm(f => ({ ...f, items: f.items.map((it, i) => i === idx ? { ...it, [field]: val } : it) }));

  const addItem    = () => setForm(f => ({ ...f, items: [...f.items, emptyItem()] }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));

  const openCreate = () => {
    setForm(defaultForm);
    setSelected(null);
    setView('create');
  };

  const openEdit = (p) => {
    setSelected(p);
    setForm({
      supplier_id:   p.supplier_id || '',
      date:          p.date || today(),
      work_order_id: p.work_order_id || '',
      notes:         p.notes || '',
      items:         Array.isArray(p.items) && p.items.length ? p.items : [emptyItem()],
    });
    setView('edit');
  };

  const handleSave = async () => {
    if (!form.supplier_id) return notify('يرجى اختيار المورد', 'error');
    if (!form.date)        return notify('يرجى تحديد التاريخ', 'error');
    const validItems = form.items.filter(it => it.name && parseFloat(it.quantity) > 0);
    if (!validItems.length) return notify('يرجى إدخال اسم وكمية لكل بند', 'error');

    setSaving(true);
    try {
      const action = view === 'edit' ? 'daftra_purchase_update' : 'daftra_purchase_create';
      const body = {
        ...(view === 'edit' ? { id: selected.id } : {}),
        supplier_id:   form.supplier_id,
        date:          form.date,
        work_order_id: form.work_order_id || '',
        notes:         form.notes || '',
        items:         validItems.map(it => ({
          name:       it.name,
          quantity:   parseFloat(it.quantity)   || 1,
          unit_price: parseFloat(it.unit_price) || 0,
          discount:   parseFloat(it.discount)   || 0,
          tax:        parseFloat(it.tax)        ?? 15,
        })),
      };

      const res  = await fetch(`${API_URL}?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        notify(view === 'edit' ? 'تم تحديث فاتورة الشراء بنجاح' : 'تم إنشاء أمر الشراء بنجاح');
        setView('list');
      } else {
        notify(data.message || 'فشل حفظ فاتورة الشراء', 'error');
      }
    } catch {
      notify('خطأ في الاتصال بالخادم', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ════════════════════════════════════════════════════════════
  // عرض: قائمة المشتريات
  // ════════════════════════════════════════════════════════════
  const ListView = () => (
    <div>
      {/* رأس الصفحة */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#1a365d] to-[#2d5299] rounded-2xl flex items-center justify-center shadow-lg">
            <ShoppingCart size={20} className="text-gold-500" />
          </div>
          <div>
            <h1 className="text-xl font-black text-brand-800 dark:text-brand-100">فواتير الشراء</h1>
            <p className="text-xs text-slate-400 dark:text-brand-400 font-medium">إدارة أوامر الشراء والموردين</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-100 dark:bg-brand-800 rounded-xl p-1">
            <button onClick={() => setViewMode('invoices')}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-colors ${viewMode === 'invoices' ? 'bg-white dark:bg-brand-900 text-brand-800 dark:text-brand-100 shadow-sm' : 'text-slate-500 dark:text-brand-400'}`}>
              الفواتير
            </button>
            <button onClick={() => setViewMode('categories')}
              className={`px-4 py-1.5 rounded-lg text-xs font-black transition-colors ${viewMode === 'categories' ? 'bg-white dark:bg-brand-900 text-brand-800 dark:text-brand-100 shadow-sm' : 'text-slate-500 dark:text-brand-400'}`}>
              حسب الأصناف
            </button>
          </div>
          <ExportButton
            rows={displayed}
            columns={[
              { key: 'no', label: 'رقم الفاتورة' },
              { key: 'date', label: 'التاريخ' },
              { key: 'supplier', label: 'المورد' },
              { key: 'total', label: 'الإجمالي', format: fmtExport.money },
              { key: 'paid', label: 'المدفوع', format: fmtExport.money },
              { key: 'id', label: 'التصنيف', format: (v) => { const c = classMap[String(v)] || ''; return c ? `${c} - ${classNameOf(c)}` : 'غير مصنف'; } },
            ]}
            filename="فواتير_الشراء"
          />
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-gold-500 hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md transition-colors"
          >
            <Plus size={16} />
            أمر شراء جديد
          </button>
        </div>
      </div>

      {/* ── عرض حسب الأصناف: مجموع مشتريات كل بند ── */}
      {viewMode === 'categories' ? (
        <div className="bg-white dark:bg-brand-900 rounded-2xl shadow-sm border border-slate-100 dark:border-brand-700 overflow-hidden">
          {reportRows.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-slate-400 dark:text-brand-400 gap-3">
              <RefreshCw size={22} className="animate-spin" /><span className="text-sm font-bold">جاري تحميل تقرير الأصناف...</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-brand-800/60 border-b border-slate-100 dark:border-brand-700">
                    <th className="px-4 py-3 text-right text-xs font-black text-slate-400 dark:text-brand-400">الصنف</th>
                    <th className="px-4 py-3 text-center text-xs font-black text-slate-400 dark:text-brand-400 whitespace-nowrap">عدد الفواتير</th>
                    <th className="px-4 py-3 text-left text-xs font-black text-slate-400 dark:text-brand-400 whitespace-nowrap">إجمالي المشتريات</th>
                    <th className="px-4 py-3 text-right text-xs font-black text-slate-400 dark:text-brand-400 w-[220px]">النسبة</th>
                  </tr>
                </thead>
                <tbody>
                  {classTree.map(t => {
                    const s = sumByPrefix(classPrefix(t.code));
                    if (s.total <= 0) return null;
                    const pct = reportGrand > 0 ? (s.total / reportGrand) * 100 : 0;
                    return (
                      <tr key={t.code} className={`border-b border-slate-50 dark:border-brand-700 ${t.level === 1 ? 'bg-[#1a365d]/[0.04] dark:bg-brand-800/40' : ''}`}>
                        <td className={`px-4 py-2.5 ${t.level === 1 ? 'font-black text-brand-800 dark:text-brand-100 text-sm' : t.level === 2 ? 'font-bold text-slate-700 dark:text-brand-200 text-xs pr-8' : 'font-medium text-slate-500 dark:text-brand-400 text-xs pr-14'}`}>
                          <span className="text-slate-300 dark:text-brand-500 font-mono text-[10px] ml-2">{t.code}</span>{t.name}
                        </td>
                        <td className="px-4 py-2.5 text-center text-xs font-bold text-slate-500 dark:text-brand-400">{s.invoices}</td>
                        <td className={`px-4 py-2.5 text-left whitespace-nowrap ${t.level === 1 ? 'font-black text-brand-800 dark:text-brand-100 text-sm' : 'font-bold text-slate-600 dark:text-brand-300 text-xs'}`}>{fmt(s.total)}</td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-2 bg-slate-100 dark:bg-brand-800 rounded-full overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${Math.max(pct, 1)}%`, background: t.level === 1 ? '#1a365d' : '#c5a059' }} />
                            </div>
                            <span className="text-[10px] font-black text-slate-500 dark:text-brand-400 w-11 text-left" dir="ltr">{pct.toFixed(1)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50 dark:bg-brand-800/60">
                    <td className="px-4 py-3 font-black text-brand-800 dark:text-brand-100 text-sm">الإجمالي</td>
                    <td></td>
                    <td className="px-4 py-3 text-left font-black text-brand-800 dark:text-brand-100 text-sm whitespace-nowrap">{fmt(reportGrand)}</td>
                    <td className="px-4 py-3 text-[10px] text-slate-400 font-bold">القيم صافية قبل الضريبة — من بنود الفواتير المصنفة</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      ) : (
      <>
      {/* شريط الفلاتر */}
      <div className="bg-white dark:bg-brand-900 rounded-2xl shadow-sm border border-slate-100 dark:border-brand-700 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400 dark:text-brand-400 font-bold">من</label>
            <div className="relative">
              <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <input
                type="date"
                value={filters.from}
                onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
                className="pr-8 pl-3 py-2 border border-slate-200 dark:border-brand-700 rounded-xl text-sm font-medium text-slate-600 dark:text-brand-50 dark:bg-brand-900 dark:placeholder-brand-500 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d]"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400 dark:text-brand-400 font-bold">إلى</label>
            <div className="relative">
              <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <input
                type="date"
                value={filters.to}
                onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
                className="pr-8 pl-3 py-2 border border-slate-200 dark:border-brand-700 rounded-xl text-sm font-medium text-slate-600 dark:text-brand-50 dark:bg-brand-900 dark:placeholder-brand-500 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d]"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
            <label className="text-xs text-slate-400 dark:text-brand-400 font-bold">بحث</label>
            <div className="relative">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <input
                type="text"
                placeholder="رقم أمر أو اسم مورد..."
                value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                className="w-full pr-8 pl-3 py-2 border border-slate-200 dark:border-brand-700 rounded-xl text-sm font-medium text-slate-600 dark:text-brand-50 dark:bg-brand-900 dark:placeholder-brand-500 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d]"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400 dark:text-brand-400 font-bold">التصنيف</label>
            <select
              value={classFilter}
              onChange={e => setClassFilter(e.target.value)}
              className="px-3 py-2 border border-slate-200 dark:border-brand-700 rounded-xl text-sm font-medium text-slate-600 dark:text-brand-50 dark:bg-brand-900 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d]"
            >
              <option value="">كل البنود</option>
              <option value="none">غير مصنف</option>
              {classTree.filter(t => t.level === 1).map(main => (
                <optgroup key={main.code} label={`${main.code} — ${main.name}`}>
                  <option value={main.code}>{main.code} — {main.name} (كامل الفرع)</option>
                  {classTree
                    .filter(t => t.level > 1 && t.code[0] === main.code[0])
                    .map(t => (
                      <option key={t.code} value={t.code}>
                        {t.level === 3 ? `　${t.code} ${t.name}` : `${t.code} ${t.name}`}
                      </option>
                    ))}
                </optgroup>
              ))}
            </select>
          </div>
          <button
            onClick={() => setAppliedFilters({ ...filters })}
            className="flex items-center gap-2 bg-brand-800 hover:bg-brand-900 text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors"
          >
            <RefreshCw size={14} />
            تطبيق
          </button>
        </div>
      </div>

      {/* شرائح الملخص */}
      <div className="flex flex-wrap gap-3 mb-5">
        <SummaryChip icon={ShoppingCart} label="إجمالي الأوامر"   value={displayed.length}       color="bg-brand-800" />
        <SummaryChip icon={DollarSign}   label="إجمالي المشتريات" value={fmt(totalAmount)}        color="bg-indigo-500" />
        <SummaryChip icon={CheckCircle2} label="المدفوع"           value={fmt(totalPaid)}          color="bg-green-500" />
        <SummaryChip icon={AlertTriangle} label="المتبقي"          value={fmt(totalOutstanding)}   color="bg-amber-500" />
        <SummaryChip icon={Package}      label="غير مصنف"          value={unclassifiedCount}       color={unclassifiedCount > 0 ? 'bg-red-500' : 'bg-emerald-600'} />
      </div>

      {/* حالة التحميل / الخطأ */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={28} className="text-brand-800 dark:text-brand-300 animate-spin" />
        </div>
      )}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 flex items-center gap-3 text-red-600 text-sm font-bold">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* جدول المشتريات */}
      {!loading && !error && (
        <div className="bg-white dark:bg-brand-900 rounded-2xl shadow-sm border border-slate-100 dark:border-brand-700 overflow-hidden">
          {displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-300">
              <ShoppingCart size={48} className="mb-4" />
              <p className="text-sm font-bold text-slate-400 dark:text-brand-400">لا توجد فواتير شراء في هذه الفترة</p>
              <button
                onClick={openCreate}
                className="mt-4 flex items-center gap-2 bg-gold-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-amber-600 transition-colors"
              >
                <Plus size={14} />
                أنشئ أول أمر شراء
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 dark:bg-brand-800/60 border-b border-slate-100 dark:border-brand-700">
                    <SortHeader label="رقم"      sortKey="no"       activeKey={tc.sortKey} dir={tc.sortDir} onSort={tc.toggleSort} />
                    <SortHeader label="التاريخ"  sortKey="date"     activeKey={tc.sortKey} dir={tc.sortDir} onSort={tc.toggleSort} />
                    <SortHeader label="المورد"   sortKey="supplier" activeKey={tc.sortKey} dir={tc.sortDir} onSort={tc.toggleSort} />
                    <SortHeader label="الإجمالي" sortKey="total"    activeKey={tc.sortKey} dir={tc.sortDir} onSort={tc.toggleSort} />
                    <th className="px-4 py-3 text-right text-xs font-black text-slate-400 dark:text-brand-400 whitespace-nowrap">المتبقي</th>
                    <th className="px-4 py-3 text-right text-xs font-black text-slate-400 dark:text-brand-400 whitespace-nowrap">التصنيف</th>
                    <th className="px-4 py-3 text-right text-xs font-black text-slate-400 dark:text-brand-400 whitespace-nowrap">المشروع</th>
                    <th className="px-4 py-3 text-right text-xs font-black text-slate-400 dark:text-brand-400 whitespace-nowrap">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {tc.pageRows.map((p, idx) => {
                    const remaining = (parseFloat(p.total) || 0) - (parseFloat(p.paid) || 0);
                    const project   = workCycles.find(w => String(w.id) === String(p.work_order_id));
                    return (
                      <tr
                        key={p.id}
                        className={`border-b border-slate-50 dark:border-brand-700 hover:bg-slate-50/50 dark:hover:bg-brand-800 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}
                      >
                        <td className="px-4 py-3">
                          <span className="bg-gold-500/15 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-lg text-xs font-black">
                            #{p.no || p.id}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-brand-400 font-medium whitespace-nowrap">{p.date || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Truck size={13} className="text-slate-300 shrink-0" />
                            {(() => {
                              const pid = partyDir.byDaftraId?.[String(p.supplier_id || '')];
                              return pid ? (
                                <button onClick={() => navigate(`/admin/dashboard/parties/${pid}`)}
                                  className="text-xs font-bold text-brand-800 dark:text-brand-200 hover:text-blue-600 dark:hover:text-blue-400 hover:underline text-right">
                                  {p.supplier || '—'}
                                </button>
                              ) : <span className="text-xs text-slate-700 dark:text-brand-300 font-bold">{p.supplier || '—'}</span>;
                            })()}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs font-black text-slate-700 dark:text-brand-300 whitespace-nowrap">{fmt(p.total)}</td>
                        <td className="px-4 py-3 text-xs font-bold whitespace-nowrap">
                          <span className={remaining > 0 ? 'text-amber-600' : 'text-green-600'}>
                            {fmt(remaining)}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={classMap[String(p.id)] || ''}
                            onChange={e => setClass(p, e.target.value)}
                            className={`max-w-[180px] px-2 py-1.5 border rounded-xl text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 dark:bg-brand-900 dark:text-brand-50 ${classMap[String(p.id)] ? 'border-slate-200 dark:border-brand-700 text-slate-600' : 'border-red-300 text-red-500 bg-red-50/50'}`}
                          >
                            <option value="">— غير مصنف —</option>
                            {classTree.filter(t => t.level === 1).map(main => (
                              <optgroup key={main.code} label={`${main.code} — ${main.name}`}>
                                {classTree
                                  .filter(t => t.level > 1 && t.code[0] === main.code[0])
                                  .map(t => (
                                    <option key={t.code} value={t.code}>
                                      {t.level === 3 ? `  ${t.code} ${t.name}` : `${t.code} ${t.name}`}
                                    </option>
                                  ))}
                              </optgroup>
                            ))}
                          </select>
                          {extraCodesOf(p).length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1" title={extraCodesOf(p).map(c => `${c} ${classNameOf(c)}`).join(' · ')}>
                              {extraCodesOf(p).slice(0, 3).map(c => (
                                <span key={c} className="bg-slate-100 dark:bg-brand-800 text-slate-500 dark:text-brand-300 px-1.5 py-0.5 rounded text-[10px] font-bold">{c}</span>
                              ))}
                              {extraCodesOf(p).length > 3 && <span className="text-[10px] text-slate-400 font-bold">+{extraCodesOf(p).length - 3}</span>}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 dark:text-brand-400 font-medium">
                          {project
                            ? <span className="flex items-center gap-1"><Building size={12} className="text-slate-300" />{project.title || `#${project.number || project.id}`}</span>
                            : <span className="text-slate-300">—</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => openEdit(p)}
                            title="تعديل"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-gold-500 hover:bg-amber-50 transition-colors"
                          >
                            <Edit3 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <div className="px-4 pb-4">
                <TablePager page={tc.page} totalPages={tc.totalPages} setPage={tc.setPage}
                  pageStart={tc.pageStart} pageEnd={tc.pageEnd} totalRows={tc.totalRows} />
              </div>
            </div>
          )}
        </div>
      )}
      </>
      )}
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // عرض: نموذج الإنشاء / التعديل
  // ════════════════════════════════════════════════════════════
  const FormView = () => (
    <div>
      {/* رجوع */}
      <button
        onClick={() => setView('list')}
        className="flex items-center gap-2 text-slate-500 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-100 font-bold text-sm mb-5 transition-colors"
      >
        <ChevronLeft size={16} />
        رجوع إلى القائمة
      </button>

      <h2 className="text-lg font-black text-brand-800 dark:text-brand-100 mb-6 flex items-center gap-2">
        <ShoppingCart size={18} className="text-gold-500" />
        {view === 'edit' ? 'تعديل فاتورة الشراء' : 'أمر شراء جديد'}
      </h2>

      {/* قسم: معلومات أمر الشراء */}
      <div className="bg-white dark:bg-brand-900 rounded-2xl shadow-sm border border-slate-100 dark:border-brand-700 p-5 mb-5">
        <h3 className="text-sm font-black text-brand-800 dark:text-brand-100 mb-4 flex items-center gap-2">
          <Truck size={15} className="text-gold-500" />
          معلومات أمر الشراء
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* المورد */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 dark:text-brand-400 mb-1">المورد <span className="text-red-500">*</span></label>
            <select
              value={form.supplier_id}
              onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-brand-700 rounded-xl text-sm font-medium text-slate-700 dark:text-brand-50 dark:bg-brand-900 dark:placeholder-brand-500 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d]"
            >
              <option value="">— اختر المورد —</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* التاريخ */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-brand-400 mb-1">التاريخ <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-brand-700 rounded-xl text-sm font-medium text-slate-700 dark:text-brand-50 dark:bg-brand-900 dark:placeholder-brand-500 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d]"
            />
          </div>

          {/* المشروع */}
          <div>
            <label className="block text-xs font-bold text-slate-500 dark:text-brand-400 mb-1">المشروع (اختياري)</label>
            <select
              value={form.work_order_id}
              onChange={e => setForm(f => ({ ...f, work_order_id: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-brand-700 rounded-xl text-sm font-medium text-slate-700 dark:text-brand-50 dark:bg-brand-900 dark:placeholder-brand-500 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d]"
            >
              <option value="">— بدون مشروع —</option>
              {workCycles.map(w => (
                <option key={w.id} value={w.id}>{w.title || `مشروع #${w.number || w.id}`}</option>
              ))}
            </select>
          </div>

          {/* ملاحظات */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 dark:text-brand-400 mb-1">ملاحظات</label>
            <textarea
              rows={2}
              placeholder="ملاحظات إضافية..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 dark:border-brand-700 rounded-xl text-sm font-medium text-slate-700 dark:text-brand-50 dark:bg-brand-900 dark:placeholder-brand-500 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d] resize-none"
            />
          </div>
        </div>
      </div>

      {/* قسم: بنود الشراء */}
      <div className="bg-white dark:bg-brand-900 rounded-2xl shadow-sm border border-slate-100 dark:border-brand-700 p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-brand-800 dark:text-brand-100 flex items-center gap-2">
            <Package size={15} className="text-gold-500" />
            بنود الشراء
          </h3>
          <button
            onClick={addItem}
            className="flex items-center gap-1.5 text-xs bg-gold-500/15 hover:bg-gold-500/25 text-amber-800 dark:text-amber-300 px-3 py-1.5 rounded-xl font-bold transition-colors"
          >
            <Plus size={13} />
            أضف بند
          </button>
        </div>

        <div className="space-y-3">
          {form.items.map((item, idx) => (
            <div key={idx} className="bg-slate-50 dark:bg-brand-800/40 rounded-xl p-4 border border-slate-100 dark:border-brand-700">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-2">
                {/* اسم البند */}
                <div className="col-span-2 md:col-span-3 lg:col-span-2">
                  <label className="block text-xs font-bold text-slate-400 dark:text-brand-400 mb-1">اسم البند <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder="وصف المادة أو الخدمة"
                    value={item.name}
                    onChange={e => updateItem(idx, 'name', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-brand-700 rounded-xl text-sm font-medium text-slate-700 dark:text-brand-50 dark:bg-brand-900 dark:placeholder-brand-500 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d]"
                  />
                </div>

                {/* الكمية */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-brand-400 mb-1">الكمية</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.quantity}
                    onChange={e => updateItem(idx, 'quantity', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-brand-700 rounded-xl text-sm font-medium text-slate-700 dark:text-brand-50 dark:bg-brand-900 dark:placeholder-brand-500 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d]"
                  />
                </div>

                {/* سعر الوحدة */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-brand-400 mb-1">سعر الوحدة</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={e => updateItem(idx, 'unit_price', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-brand-700 rounded-xl text-sm font-medium text-slate-700 dark:text-brand-50 dark:bg-brand-900 dark:placeholder-brand-500 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d]"
                  />
                </div>

                {/* الخصم */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-brand-400 mb-1">خصم %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={item.discount}
                    onChange={e => updateItem(idx, 'discount', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-brand-700 rounded-xl text-sm font-medium text-slate-700 dark:text-brand-50 dark:bg-brand-900 dark:placeholder-brand-500 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d]"
                  />
                </div>

                {/* الضريبة */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 dark:text-brand-400 mb-1">ضريبة %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={item.tax}
                    onChange={e => updateItem(idx, 'tax', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 dark:border-brand-700 rounded-xl text-sm font-medium text-slate-700 dark:text-brand-50 dark:bg-brand-900 dark:placeholder-brand-500 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d]"
                  />
                </div>
              </div>

              {/* إجمالي السطر + زر الحذف */}
              <div className="flex items-center justify-between mt-1">
                <div>
                  <span className="text-xs text-slate-400 dark:text-brand-400 font-medium">إجمالي البند: </span>
                  <span className="text-sm font-black text-brand-800 dark:text-brand-100">{fmt(lineTotal(item))}</span>
                </div>
                {form.items.length > 1 && (
                  <button
                    onClick={() => removeItem(idx)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* قسم: الإجمالي */}
      <div className="bg-white dark:bg-brand-900 rounded-2xl shadow-sm border border-slate-100 dark:border-brand-700 p-5 mb-6">
        <h3 className="text-sm font-black text-brand-800 dark:text-brand-100 mb-4 flex items-center gap-2">
          <DollarSign size={15} className="text-gold-500" />
          الإجمالي
        </h3>
        <div className="space-y-2.5 max-w-xs mr-auto">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400 dark:text-brand-400 font-medium">الإجمالي قبل الخصم</span>
            <span className="font-bold text-slate-700 dark:text-brand-300">{fmt(subtotal)}</span>
          </div>
          {totalDisc > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-400 dark:text-brand-400 font-medium">إجمالي الخصم</span>
              <span className="font-bold text-red-500">- {fmt(totalDisc)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-slate-400 dark:text-brand-400 font-medium">إجمالي الضريبة (15%)</span>
            <span className="font-bold text-slate-600 dark:text-brand-300">{fmt(totalTax)}</span>
          </div>
          <div className="border-t border-slate-200 dark:border-brand-700 pt-2.5 flex justify-between">
            <span className="text-sm font-black text-brand-800 dark:text-brand-100">الإجمالي الكلي</span>
            <span className="text-lg font-black text-brand-800 dark:text-brand-100">{fmt(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* زر الحفظ */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 bg-gold-500 hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-black text-sm shadow-lg transition-colors"
      >
        {saving ? (
          <>
            <RefreshCw size={15} className="animate-spin" />
            جاري الحفظ...
          </>
        ) : (
          <>
            <CheckCircle2 size={15} />
            {view === 'edit' ? 'تحديث فاتورة الشراء' : 'حفظ أمر الشراء'}
          </>
        )}
      </button>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // التصيير الرئيسي
  // ════════════════════════════════════════════════════════════
  return (
    <div dir="rtl" className="font-cairo min-h-screen bg-transparent p-4 md:p-6">

      {/* المحتوى */}
      {view === 'list'                       && <ListView />}
      {(view === 'create' || view === 'edit') && <FormView />}
    </div>
  );
}
