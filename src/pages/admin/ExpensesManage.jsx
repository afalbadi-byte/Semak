import React, { useState, useEffect, useCallback } from 'react';
import {
  Receipt, Plus, Search, Calendar, Tag, DollarSign,
  Edit3, Trash2, ChevronLeft, RefreshCw,
  AlertTriangle, CheckCircle2, X
} from 'lucide-react';
import ExportButton from '../../components/ExportButton';
import { fmt as fmtExport } from '../../utils/exporters';
import useTableControls from '../../utils/useTableControls';
import SortHeader from '../../components/SortHeader';
import TablePager from '../../components/TablePager';

import { API_URL } from '../../lib/api/client';

// ─── تنسيق الأرقام ───────────────────────────────────────────────
const fmt = (n, currency = 'SAR') =>
  new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(n) || 0) +
  ' ' + (currency === 'SAR' ? 'ر.س' : currency === 'USD' ? '$' : '€');

// ─── اليوم بتنسيق YYYY-MM-DD ─────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);

// ─── بداية الشهر ─────────────────────────────────────────────────
const monthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

// ─── ألوان الفئات ────────────────────────────────────────────────
const CATEGORY_COLORS = [
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-green-100 text-green-700 border-green-200',
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-pink-100 text-pink-700 border-pink-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
];

function categoryColor(id) {
  const idx = (parseInt(id) || 0) % CATEGORY_COLORS.length;
  return CATEGORY_COLORS[idx];
}

// ─── Toast ───────────────────────────────────────────────────────
function Toast({ msg, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  const bg = type === 'success' ? 'bg-green-600' : 'bg-red-600';
  return (
    <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-white text-sm font-bold ${bg} animate-fadeIn`}>
      {type === 'success' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
      {msg}
      <button onClick={onClose} className="mr-1 opacity-70 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

// ─── شريحة ملخص ──────────────────────────────────────────────────
function SummaryChip({ icon: Icon, label, value, color }) {
  return (
    <div className="flex items-center gap-3 bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-3 flex-1 min-w-[160px]">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
        <Icon size={20} className="text-white" />
      </div>
      <div>
        <p className="text-xs text-slate-400 font-medium">{label}</p>
        <p className="text-sm font-black text-slate-700">{value}</p>
      </div>
    </div>
  );
}

// ─── مربع تأكيد الحذف ────────────────────────────────────────────
function ConfirmDialog({ msg, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
            <AlertTriangle size={20} className="text-red-600" />
          </div>
          <p className="text-sm font-bold text-slate-700">{msg}</p>
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onCancel} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200 transition-colors">
            إلغاء
          </button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors">
            حذف
          </button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// المكوّن الرئيسي – المصروفات
// ═══════════════════════════════════════════════════════════════════
export default function ExpensesManage({ user, navigateTo }) {
  // ─── حالة العرض ──────────────────────────────────────────────
  const [view, setView]           = useState('list');
  const [expenses, setExpenses]   = useState([]);
  const [categories, setCategories] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [workCycles, setWorkCycles] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');
  const [selected, setSelected]   = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [toast, setToast]         = useState(null);

  const [filters, setFilters] = useState({
    from: monthStart(),
    to: today(),
    search: '',
  });
  const [appliedFilters, setAppliedFilters] = useState({ ...filters });

  const defaultForm = {
    date: today(),
    amount: '',
    currency: 'SAR',
    category_id: '',
    supplier_id: '',
    work_order_id: '',
    notes: '',
  };
  const [form, setForm] = useState(defaultForm);

  // ─── Toast مساعد ──────────────────────────────────────────────
  const notify = (msg, type = 'success') => setToast({ msg, type });

  // ─── جلب القوائم المنسدلة ────────────────────────────────────
  const loadDropdowns = useCallback(async () => {
    try {
      const [catRes, supRes, wRes] = await Promise.all([
        fetch(`${API_URL}?action=daftra_expense_categories`),
        fetch(`${API_URL}?action=daftra_suppliers_list`),
        fetch(`${API_URL}?action=daftra_v2_work_cycles`),
      ]);
      const [catData, supData, wData] = await Promise.all([catRes.json(), supRes.json(), wRes.json()]);

      if (catData.success && Array.isArray(catData.data)) {
        setCategories(catData.data.map(r => {
          const c = r.ExpenseCategory || r.Category || r;
          return { id: c.id, name: c.name || c.title || `فئة #${c.id}` };
        }));
      }
      if (supData.success && Array.isArray(supData.data)) {
        setSuppliers(supData.data.map(r => {
          const s = r.Supplier || r;
          return {
            id: s.id,
            name: s.business_name || `${s.first_name || ''} ${s.last_name || ''}`.trim() || `مورد #${s.id}`,
          };
        }));
      }
      if (wData.success && Array.isArray(wData.data)) {
        setWorkCycles(wData.data);
      }
    } catch { /* تجاهل أخطاء القوائم */ }
  }, []);

  // ─── جلب المصروفات ───────────────────────────────────────────
  const loadExpenses = useCallback(async (f = appliedFilters) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${API_URL}?action=daftra_expenses_list&from=${f.from}&to=${f.to}`
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setExpenses(data.data);
      } else {
        setExpenses([]);
        setError(data.message || 'فشل تحميل المصروفات');
      }
    } catch {
      setError('خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => { loadDropdowns(); }, [loadDropdowns]);

  useEffect(() => {
    if (view === 'list') loadExpenses(appliedFilters);
  }, [view, appliedFilters]); // eslint-disable-line

  // ─── فلترة محلية ─────────────────────────────────────────────
  const displayed = expenses.filter(exp => {
    if (!appliedFilters.search) return true;
    const q = appliedFilters.search.toLowerCase();
    return (
      String(exp.notes || '').toLowerCase().includes(q) ||
      String(exp.category || '').toLowerCase().includes(q) ||
      String(exp.category_name || '').toLowerCase().includes(q)
    );
  });

  // ─── ملخصات ───────────────────────────────────────────────────
  const totalAmount = displayed.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const thisMonthAmount = displayed
    .filter(e => String(e.date || '').startsWith(new Date().toISOString().slice(0, 7)))
    .reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);

  // ─── فرز + ترقيم صفحات ───────────────────────────────────────
  const tc = useTableControls(displayed, { pageSize: 15, initialSort: { key: 'date', dir: 'desc' } });

  // ─── إيجاد اسم الفئة من المعرف ───────────────────────────────
  const getCategoryName = (id) => {
    const cat = categories.find(c => String(c.id) === String(id));
    return cat ? cat.name : id ? `فئة #${id}` : '—';
  };

  const getSupplierName = (id) => {
    const sup = suppliers.find(s => String(s.id) === String(id));
    return sup ? sup.name : id ? `مورد #${id}` : '—';
  };

  const getWorkCycleName = (id) => {
    const wc = workCycles.find(w => String(w.id) === String(id));
    return wc ? (wc.title || `مشروع #${wc.number || wc.id}`) : id ? `مشروع #${id}` : '—';
  };

  // ─── إجراءات الإنشاء / التعديل ───────────────────────────────
  const openCreate = () => {
    setForm(defaultForm);
    setSelected(null);
    setView('create');
  };

  const openEdit = (exp) => {
    setSelected(exp);
    setForm({
      date:          exp.date || today(),
      amount:        exp.amount || '',
      currency:      exp.currency || 'SAR',
      category_id:   exp.category_id || exp.expense_category_id || '',
      supplier_id:   exp.supplier_id || '',
      work_order_id: exp.work_order_id || '',
      notes:         exp.notes || '',
    });
    setView('edit');
  };

  // ─── حذف مصروف ───────────────────────────────────────────────
  const handleDelete = async (id) => {
    setConfirmId(null);
    try {
      const res  = await fetch(`${API_URL}?action=daftra_expense_delete&id=${id}`);
      const data = await res.json();
      if (data.success) {
        notify('تم حذف المصروف بنجاح');
        loadExpenses();
      } else {
        notify(data.message || 'فشل حذف المصروف', 'error');
      }
    } catch {
      notify('خطأ في الاتصال بالخادم', 'error');
    }
  };

  // ─── حفظ المصروف ─────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.date)               return notify('يرجى تحديد التاريخ', 'error');
    if (!form.amount || parseFloat(form.amount) <= 0)
                                  return notify('يرجى إدخال مبلغ صحيح', 'error');
    if (!form.category_id)        return notify('يرجى اختيار الفئة', 'error');

    setSaving(true);
    try {
      const action = view === 'edit' ? 'daftra_expense_update' : 'daftra_expense_create';
      const body   = {
        ...(view === 'edit' ? { id: selected.id } : {}),
        date:          form.date,
        amount:        parseFloat(form.amount),
        currency:      form.currency,
        category_id:   form.category_id,
        supplier_id:   form.supplier_id || '',
        work_order_id: form.work_order_id || '',
        notes:         form.notes || '',
      };

      const res  = await fetch(`${API_URL}?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        notify(view === 'edit' ? 'تم تحديث المصروف بنجاح' : 'تم إضافة المصروف بنجاح');
        setView('list');
      } else {
        notify(data.message || 'فشل حفظ المصروف', 'error');
      }
    } catch {
      notify('خطأ في الاتصال بالخادم', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ══════════════════════════════════════════════════════════════
  // عرض: قائمة المصروفات
  // ══════════════════════════════════════════════════════════════
  const ListView = () => (
    <div>
      {/* رأس الصفحة */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#1a365d] to-[#2d5299] rounded-2xl flex items-center justify-center shadow-lg">
            <Receipt size={20} className="text-[#c5a059]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#1a365d]">المصروفات</h1>
            <p className="text-xs text-slate-400 font-medium">تتبع وإدارة مصروفات الشركة</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            rows={displayed}
            columns={[
              { key: 'date', label: 'التاريخ' },
              { key: 'category', label: 'الفئة', format: (v, r) => v || r.category_name || getCategoryName(r.category_id || r.expense_category_id) },
              { key: 'supplier', label: 'المورد', format: (v, r) => v || getSupplierName(r.supplier_id) },
              { key: 'amount', label: 'المبلغ', format: fmtExport.money },
              { key: 'notes', label: 'ملاحظات' },
            ]}
            filename="المصروفات"
          />
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md transition-colors"
          >
            <Plus size={16} />
            مصروف جديد
          </button>
        </div>
      </div>

      {/* شريط الفلاتر */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400 font-bold">من</label>
            <div className="relative">
              <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <input
                type="date"
                value={filters.from}
                onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
                className="pr-8 pl-3 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d]"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400 font-bold">إلى</label>
            <div className="relative">
              <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <input
                type="date"
                value={filters.to}
                onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
                className="pr-8 pl-3 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d]"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
            <label className="text-xs text-slate-400 font-bold">بحث</label>
            <div className="relative">
              <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <input
                type="text"
                placeholder="ملاحظات أو فئة..."
                value={filters.search}
                onChange={e => setFilters(f => ({ ...f, search: e.target.value }))}
                className="w-full pr-8 pl-3 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d]"
              />
            </div>
          </div>
          <button
            onClick={() => setAppliedFilters({ ...filters })}
            className="flex items-center gap-2 bg-[#1a365d] hover:bg-[#2d5299] text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors"
          >
            <RefreshCw size={14} />
            تطبيق
          </button>
        </div>
      </div>

      {/* شرائح الملخص */}
      <div className="flex flex-wrap gap-3 mb-5">
        <SummaryChip
          icon={Receipt}
          label="إجمالي السجلات"
          value={displayed.length}
          color="bg-[#1a365d]"
        />
        <SummaryChip
          icon={DollarSign}
          label="إجمالي المصروفات"
          value={fmt(totalAmount)}
          color="bg-red-500"
        />
        <SummaryChip
          icon={Calendar}
          label="مصروفات هذا الشهر"
          value={fmt(thisMonthAmount)}
          color="bg-amber-500"
        />
      </div>

      {/* حالة التحميل / الخطأ */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={28} className="text-[#1a365d] animate-spin" />
        </div>
      )}
      {error && !loading && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 flex items-center gap-3 text-red-600 text-sm font-bold">
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {/* جدول المصروفات */}
      {!loading && !error && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-300">
              <Receipt size={48} className="mb-4" />
              <p className="text-sm font-bold text-slate-400">لا توجد مصروفات في هذه الفترة</p>
              <button
                onClick={openCreate}
                className="mt-4 flex items-center gap-2 bg-[#1a365d] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#2d5299] transition-colors"
              >
                <Plus size={14} />
                أضف أول مصروف
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <SortHeader label="التاريخ" sortKey="date"     activeKey={tc.sortKey} dir={tc.sortDir} onSort={tc.toggleSort} />
                    <SortHeader label="الفئة"   sortKey="category" activeKey={tc.sortKey} dir={tc.sortDir} onSort={tc.toggleSort} />
                    <SortHeader label="المورد"  sortKey="supplier" activeKey={tc.sortKey} dir={tc.sortDir} onSort={tc.toggleSort} />
                    <SortHeader label="المبلغ"  sortKey="amount"   activeKey={tc.sortKey} dir={tc.sortDir} onSort={tc.toggleSort} />
                    <th className="px-4 py-3 text-right text-xs font-black text-slate-400 whitespace-nowrap">المشروع</th>
                    <th className="px-4 py-3 text-right text-xs font-black text-slate-400 whitespace-nowrap">ملاحظات</th>
                    <th className="px-4 py-3 text-right text-xs font-black text-slate-400 whitespace-nowrap">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {tc.pageRows.map((exp, idx) => {
                    const catId   = exp.category_id || exp.expense_category_id || '';
                    const catName = exp.category || exp.category_name || getCategoryName(catId);
                    const supName = exp.supplier || getSupplierName(exp.supplier_id);
                    const wcName  = exp.project || exp.work_order || getWorkCycleName(exp.work_order_id);
                    return (
                      <tr
                        key={exp.id}
                        className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}
                      >
                        <td className="px-4 py-3 text-xs text-slate-500 font-medium whitespace-nowrap">{exp.date || '—'}</td>
                        <td className="px-4 py-3">
                          {catName ? (
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${categoryColor(catId)}`}>
                              {catName}
                            </span>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600 font-medium">{supName || '—'}</td>
                        <td className="px-4 py-3 text-xs font-black text-red-600 whitespace-nowrap">{fmt(exp.amount, exp.currency)}</td>
                        <td className="px-4 py-3 text-xs text-slate-500 font-medium">
                          {wcName && wcName !== '—' ? (
                            <span className="bg-[#1a365d]/10 text-[#1a365d] px-2 py-0.5 rounded-lg text-xs font-bold">
                              {wcName}
                            </span>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 max-w-[180px] truncate">{exp.notes || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openEdit(exp)}
                              title="تعديل"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-[#c5a059] hover:bg-amber-50 transition-colors"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => setConfirmId(exp.id)}
                              title="حذف"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
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
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // عرض: نموذج الإنشاء / التعديل
  // ══════════════════════════════════════════════════════════════
  const FormView = () => (
    <div>
      <button
        onClick={() => setView('list')}
        className="flex items-center gap-2 text-slate-500 hover:text-[#1a365d] font-bold text-sm mb-5 transition-colors"
      >
        <ChevronLeft size={16} />
        رجوع
      </button>

      <h2 className="text-lg font-black text-[#1a365d] mb-6">
        {view === 'edit' ? 'تعديل المصروف' : 'إضافة مصروف جديد'}
      </h2>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-6">
        <h3 className="text-sm font-black text-[#1a365d] mb-4 flex items-center gap-2">
          <Receipt size={15} className="text-[#c5a059]" />
          تفاصيل المصروف
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* التاريخ */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">التاريخ <span className="text-red-500">*</span></label>
            <div className="relative">
              <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-full pr-8 pl-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d]"
              />
            </div>
          </div>

          {/* المبلغ */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">المبلغ <span className="text-red-500">*</span></label>
            <div className="relative">
              <DollarSign size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full pr-8 pl-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d]"
              />
            </div>
          </div>

          {/* العملة */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">العملة</label>
            <select
              value={form.currency}
              onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d] bg-white"
            >
              <option value="SAR">ريال سعودي (SAR)</option>
              <option value="USD">دولار أمريكي (USD)</option>
              <option value="EUR">يورو (EUR)</option>
            </select>
          </div>

          {/* الفئة */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">الفئة <span className="text-red-500">*</span></label>
            <div className="relative">
              <Tag size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />
              <select
                value={form.category_id}
                onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}
                className="w-full pr-8 pl-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d] bg-white"
              >
                <option value="">— اختر الفئة —</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* المورد */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">المورد (اختياري)</label>
            <select
              value={form.supplier_id}
              onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d] bg-white"
            >
              <option value="">— بدون مورد —</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* المشروع */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">المشروع / أمر العمل (اختياري)</label>
            <select
              value={form.work_order_id}
              onChange={e => setForm(f => ({ ...f, work_order_id: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d] bg-white"
            >
              <option value="">— بدون مشروع —</option>
              {workCycles.map(w => (
                <option key={w.id} value={w.id}>{w.title || `مشروع #${w.number || w.id}`}</option>
              ))}
            </select>
          </div>

          {/* ملاحظات */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 mb-1">ملاحظات</label>
            <textarea
              rows={3}
              placeholder="وصف المصروف أو ملاحظات إضافية..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d] resize-none"
            />
          </div>
        </div>

        {/* معاينة المبلغ */}
        {parseFloat(form.amount) > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
            <span className="text-sm text-slate-400 font-medium">المبلغ المُدخَل</span>
            <span className="text-lg font-black text-red-600">{fmt(form.amount, form.currency)}</span>
          </div>
        )}
      </div>

      {/* زر الحفظ */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 bg-[#1a365d] hover:bg-[#2d5299] disabled:opacity-60 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-black text-sm shadow-lg transition-colors"
      >
        {saving ? (
          <>
            <RefreshCw size={15} className="animate-spin" />
            جاري الحفظ...
          </>
        ) : (
          <>
            <CheckCircle2 size={15} />
            حفظ المصروف
          </>
        )}
      </button>
    </div>
  );

  // ══════════════════════════════════════════════════════════════
  // التصيير الرئيسي
  // ══════════════════════════════════════════════════════════════
  return (
    <div dir="rtl" className="font-cairo min-h-screen bg-slate-50 p-4 md:p-6">
      {/* Toast */}
      {toast && (
        <Toast
          msg={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* مربع تأكيد الحذف */}
      {confirmId && (
        <ConfirmDialog
          msg="هل أنت متأكد من حذف هذا المصروف؟ لا يمكن التراجع عن هذا الإجراء."
          onConfirm={() => handleDelete(confirmId)}
          onCancel={() => setConfirmId(null)}
        />
      )}

      {/* المحتوى */}
      {view === 'list'                        && <ListView />}
      {(view === 'create' || view === 'edit') && <FormView />}
    </div>
  );
}
