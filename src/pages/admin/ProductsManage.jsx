import React, { useState, useEffect, useCallback } from 'react';
import {
  Package, Plus, Search, Tag, DollarSign,
  Edit3, Trash2, ChevronLeft, RefreshCw, BarChart2,
  AlertTriangle, CheckCircle2, X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ExportButton from '../../components/ExportButton';
import { fmt as fmtExport } from '../../utils/exporters';
import useTableControls from '../../utils/useTableControls';
import SortHeader from '../../components/SortHeader';
import TablePager from '../../components/TablePager';
import { API_URL } from '../../lib/api/client';

// ─── تنسيق السعر ─────────────────────────────────────────────────
const fmtPrice = (n) =>
  new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(n) || 0) + ' ر.س';

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

// ─── ConfirmDialog ────────────────────────────────────────────────
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
          <button onClick={onCancel} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200 transition-colors">إلغاء</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors">تأكيد</button>
        </div>
      </div>
    </div>
  );
}

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

// ─── النموذج الفارغ ───────────────────────────────────────────────
const defaultForm = () => ({
  name: '', code: '', unit_price: '', buy_price: '', unit: 'قطعة', description: '',
});

// ════════════════════════════════════════════════════════════════
// المكوّن الرئيسي — المنتجات والخدمات (acc_products)
// ════════════════════════════════════════════════════════════════
export default function ProductsManage({ user, navigateTo }) {
  const navigate = useNavigate();
  const [view, setView]           = useState('list');
  const [products, setProducts]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [search, setSearch]       = useState('');
  const [page, setPage]           = useState(1);
  const [hasMore, setHasMore]     = useState(false);
  const [selected, setSelected]   = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [toast, setToast]         = useState(null);
  const [form, setForm]           = useState(defaultForm());

  const notify = (msg, type = 'success') => setToast({ msg, type });

  // ─── جلب القائمة من acc_products ─────────────────────────────
  const loadProducts = useCallback(async (pg = 1, q = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ action: 'acc_products_list', tenant: 1, page: pg });
      if (q.trim()) params.append('search', q.trim());
      const res  = await fetch(`${API_URL}?${params}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        if (pg === 1) setProducts(data.data);
        else setProducts(prev => [...prev, ...data.data]);
        setHasMore(data.has_next_page || false);
        setPage(pg);
      } else {
        if (pg === 1) setProducts([]);
        setHasMore(false);
      }
    } catch {
      notify('فشل الاتصال بالخادم', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (view === 'list') loadProducts(1, search); }, [view, loadProducts]);

  // ─── بحث فوري ────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => { if (view === 'list') loadProducts(1, search); }, 400);
    return () => clearTimeout(timer);
  }, [search]); // eslint-disable-line

  const handleField = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const openCreate = () => { setSelected(null); setForm(defaultForm()); setView('create'); };

  const openEdit = (p) => {
    setSelected(p);
    setForm({
      name:       p.name || '',
      code:       p.code || '',
      unit_price: p.unit_price || '',
      buy_price:  p.buy_price || '',
      unit:       p.unit || 'قطعة',
      description: p.description || '',
    });
    setView('edit');
  };

  // ─── حفظ منتج ────────────────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) { notify('يرجى إدخال اسم المنتج', 'error'); return; }
    if (!form.unit_price)  { notify('يرجى إدخال سعر البيع', 'error'); return; }
    setSaving(true);
    try {
      const isEdit = view === 'edit' && selected;
      const body = {
        tenant_id:   1,
        name:        form.name.trim(),
        code:        form.code.trim(),
        description: form.description.trim(),
        unit:        form.unit.trim() || 'قطعة',
        unit_price:  parseFloat(form.unit_price) || 0,
        buy_price:   parseFloat(form.buy_price)  || 0,
      };
      if (isEdit) body.id = selected.id;

      const res  = await fetch(`${API_URL}?action=acc_product_save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        notify(isEdit ? 'تم تحديث المنتج بنجاح' : 'تم إضافة المنتج بنجاح');
        setView('list');
      } else { notify(data.message || 'حدث خطأ أثناء الحفظ', 'error'); }
    } catch { notify('فشل الاتصال بالخادم', 'error'); }
    finally { setSaving(false); }
  };

  // ─── حذف منتج ────────────────────────────────────────────────
  const handleDelete = async (id) => {
    setConfirmId(null);
    try {
      const res  = await fetch(`${API_URL}?action=acc_product_delete&id=${id}&tenant=1`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        notify(data.deactivated ? 'تم تعطيل المنتج (مرتبط بفواتير)' : 'تم حذف المنتج بنجاح');
        setProducts(prev => prev.filter(p => p.id !== id));
      } else { notify(data.message || 'فشل الحذف', 'error'); }
    } catch { notify('فشل الاتصال بالخادم', 'error'); }
  };

  // ─── ملخص ─────────────────────────────────────────────────────
  const totalCount = products.length;
  const avgPrice   = totalCount > 0
    ? products.reduce((sum, p) => sum + (parseFloat(p.unit_price) || 0), 0) / totalCount
    : 0;

  // ─── فرز + ترقيم محلي ────────────────────────────────────────
  const normalized = products.map(p => ({
    id:           p.id,
    code:         p.code || '',
    name:         p.name || '',
    unit_price:   parseFloat(p.unit_price) || 0,
    buy_price:    parseFloat(p.buy_price)  || 0,
    stock:        parseFloat(p.stock_balance) || 0,
    _raw:         p,
  }));
  const tc = useTableControls(normalized, { pageSize: 15, initialSort: { key: 'name', dir: 'asc' } });

  // ════ نموذج الإنشاء / التعديل ════════════════════════════════
  if (view === 'create' || view === 'edit') {
    const isEdit = view === 'edit';
    return (
      <div className="animate-fadeIn pb-10" dir="rtl">
        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

        <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-sm border border-slate-100 dark:border-brand-700 p-6 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('list')} className="p-2.5 bg-slate-50 dark:bg-brand-800 hover:bg-slate-100 dark:hover:bg-brand-800 rounded-xl border border-slate-200 dark:border-brand-700 transition">
              <ChevronLeft size={20} className="text-slate-600 dark:text-brand-300" />
            </button>
            <div>
              <h1 className="text-xl font-black text-brand-800 dark:text-brand-100 flex items-center gap-2">
                <Package size={22} className="text-gold-500" />
                {isEdit ? 'تعديل المنتج / الخدمة' : 'إضافة منتج أو خدمة جديدة'}
              </h1>
              <p className="text-xs text-slate-400 dark:text-brand-400 font-medium mt-0.5">
                {isEdit ? `تعديل: ${form.name}` : 'أدخل تفاصيل المنتج أو الخدمة'}
              </p>
            </div>
          </div>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 bg-brand-800 hover:bg-brand-900 text-white px-6 py-3 rounded-xl font-bold text-sm transition shadow-md disabled:opacity-60">
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {isEdit ? 'حفظ التعديلات' : 'حفظ المنتج'}
          </button>
        </div>

        <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-sm border border-slate-100 dark:border-brand-700 p-8 max-w-2xl">
          <div className="space-y-5">
            {/* الاسم */}
            <div>
              <label className="block text-xs font-bold text-brand-800 dark:text-brand-100 mb-1.5">اسم المنتج / الخدمة <span className="text-red-500">*</span></label>
              <input type="text" name="name" value={form.name} onChange={handleField} placeholder="مثال: خدمة صيانة كهربائية"
                className="w-full bg-slate-50 dark:bg-brand-800/40 border border-slate-200 dark:border-brand-700 rounded-xl p-3 text-sm font-medium text-slate-800 dark:text-brand-50 dark:placeholder-brand-500 outline-none focus:border-gold-500 focus:bg-white dark:focus:bg-brand-900 transition" />
            </div>

            {/* الكود */}
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-brand-400 mb-1.5">الكود (اختياري)</label>
              <input type="text" name="code" value={form.code} onChange={handleField} placeholder="مثال: SRV-001" dir="ltr"
                className="w-full bg-slate-50 dark:bg-brand-800/40 border border-slate-200 dark:border-brand-700 rounded-xl p-3 text-sm font-medium text-slate-800 dark:text-brand-50 dark:placeholder-brand-500 outline-none focus:border-gold-500 focus:bg-white dark:focus:bg-brand-900 transition" />
            </div>

            {/* الأسعار */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-brand-800 dark:text-brand-100 mb-1.5">سعر البيع (ر.س) <span className="text-red-500">*</span></label>
                <div className="relative">
                  <DollarSign size={15} className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400" />
                  <input type="number" name="unit_price" value={form.unit_price} onChange={handleField} min="0" step="0.01" placeholder="0.00" dir="ltr"
                    className="w-full bg-slate-50 dark:bg-brand-800/40 border border-slate-200 dark:border-brand-700 rounded-xl p-3 pr-8 text-sm font-medium text-slate-800 dark:text-brand-50 dark:placeholder-brand-500 outline-none focus:border-gold-500 focus:bg-white dark:focus:bg-brand-900 transition" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-brand-400 mb-1.5">سعر الشراء (ر.س)</label>
                <div className="relative">
                  <DollarSign size={15} className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400" />
                  <input type="number" name="buy_price" value={form.buy_price} onChange={handleField} min="0" step="0.01" placeholder="0.00" dir="ltr"
                    className="w-full bg-slate-50 dark:bg-brand-800/40 border border-slate-200 dark:border-brand-700 rounded-xl p-3 pr-8 text-sm font-medium text-slate-800 dark:text-brand-50 dark:placeholder-brand-500 outline-none focus:border-gold-500 focus:bg-white dark:focus:bg-brand-900 transition" />
                </div>
              </div>
            </div>

            {/* الوحدة */}
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-brand-400 mb-1.5">وحدة القياس</label>
              <div className="flex gap-2 flex-wrap">
                {['قطعة', 'ساعة', 'متر', 'متر مربع', 'كيلو', 'طن', 'خدمة'].map(u => (
                  <button key={u} type="button" onClick={() => setForm(f => ({ ...f, unit: u }))}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${form.unit === u ? 'bg-brand-800 text-white border-brand-800' : 'bg-slate-50 dark:bg-brand-800/40 text-slate-600 dark:text-brand-300 border-slate-200 dark:border-brand-700 hover:bg-slate-100 dark:hover:bg-brand-800'}`}>
                    {u}
                  </button>
                ))}
                <input type="text" name="unit" value={form.unit} onChange={handleField} placeholder="أو اكتب وحدة مخصصة..."
                  className="flex-1 min-w-[150px] bg-slate-50 dark:bg-brand-800/40 border border-slate-200 dark:border-brand-700 rounded-xl p-2.5 text-xs font-medium text-slate-800 dark:text-brand-50 dark:placeholder-brand-500 outline-none focus:border-gold-500 focus:bg-white dark:focus:bg-brand-900 transition" />
              </div>
            </div>

            {/* الوصف */}
            <div>
              <label className="block text-xs font-bold text-slate-500 dark:text-brand-400 mb-1.5">وصف / ملاحظات</label>
              <textarea name="description" value={form.description} onChange={handleField} rows={3} placeholder="وصف إضافي أو ملاحظات..."
                className="w-full bg-slate-50 dark:bg-brand-800/40 border border-slate-200 dark:border-brand-700 rounded-xl p-3 text-sm font-medium text-slate-800 dark:text-brand-50 dark:placeholder-brand-500 outline-none focus:border-gold-500 focus:bg-white dark:focus:bg-brand-900 transition resize-none" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ════ القائمة ═════════════════════════════════════════════════
  return (
    <div className="animate-fadeIn pb-10" dir="rtl">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {confirmId !== null && (
        <ConfirmDialog
          msg="هل أنت متأكد؟ المنتجات المرتبطة بفواتير تُعطَّل بدلًا من الحذف."
          onConfirm={() => handleDelete(confirmId)}
          onCancel={() => setConfirmId(null)}
        />
      )}

      {/* Header */}
      <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-sm border border-slate-100 dark:border-brand-700 p-6 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-brand-800 rounded-2xl flex items-center justify-center shadow">
            <Package size={24} className="text-gold-500" />
          </div>
          <div>
            <h1 className="text-xl font-black text-brand-800 dark:text-brand-100">المنتجات والخدمات</h1>
            <p className="text-xs text-slate-400 dark:text-brand-400 font-medium mt-0.5">كتالوج المنتجات المستقل</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <ExportButton
            rows={products}
            columns={[
              { key: 'code',        label: 'الكود',       format: (_v, r) => r.code || '' },
              { key: 'name',        label: 'الاسم',       format: (_v, r) => r.name || '' },
              { key: 'unit_price',  label: 'سعر البيع',   format: (_v, r) => fmtExport.money(r.unit_price) },
              { key: 'buy_price',   label: 'سعر الشراء',  format: (_v, r) => fmtExport.money(r.buy_price) },
              { key: 'unit',        label: 'الوحدة',      format: (_v, r) => r.unit || '' },
              { key: 'stock_balance', label: 'المخزون',   format: (_v, r) => fmtExport.int(r.stock_balance) },
            ]}
            filename="المنتجات"
          />
          <button onClick={() => loadProducts(1, search)} title="تحديث"
            className="p-2.5 bg-slate-50 dark:bg-brand-800 hover:bg-slate-100 dark:hover:bg-brand-800 rounded-xl border border-slate-200 dark:border-brand-700 transition text-slate-500 dark:text-brand-300">
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button onClick={openCreate}
            className="flex items-center gap-2 bg-gold-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition shadow-md">
            <Plus size={18} /> إضافة منتج / خدمة
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap gap-3 mb-6">
        <SummaryChip icon={Package}    label="إجمالي البنود"      value={`${totalCount} بند`}  color="bg-brand-800" />
        <SummaryChip icon={DollarSign} label="متوسط سعر البيع"    value={fmtPrice(avgPrice)}   color="bg-gold-500" />
      </div>

      {/* Search */}
      <div className="bg-white dark:bg-brand-900 rounded-2xl shadow-sm border border-slate-100 dark:border-brand-700 px-4 py-3 mb-4 flex items-center gap-3">
        <Search size={18} className="text-slate-400 flex-shrink-0" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الكود أو الوصف..."
          className="flex-1 bg-transparent text-sm font-medium text-slate-700 dark:text-brand-50 outline-none placeholder:text-slate-300 dark:placeholder:text-brand-500" />
        {search && <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600 transition"><X size={16} /></button>}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-sm border border-slate-100 dark:border-brand-700 overflow-hidden">
        {loading && products.length === 0 ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-400 dark:text-brand-400">
            <RefreshCw size={24} className="animate-spin" /><span className="font-bold text-sm">جاري التحميل...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-brand-400 gap-3">
            <Package size={40} className="opacity-30" /><p className="font-bold text-sm">لا توجد نتائج</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 dark:bg-brand-800/60 border-b border-slate-100 dark:border-brand-700">
                  <tr className="text-brand-800 dark:text-brand-100 font-black text-xs">
                    <SortHeader label="الكود"      sortKey="code"       activeKey={tc.sortKey} dir={tc.sortDir} onSort={tc.toggleSort} />
                    <SortHeader label="الاسم"      sortKey="name"       activeKey={tc.sortKey} dir={tc.sortDir} onSort={tc.toggleSort} />
                    <SortHeader label="سعر البيع"  sortKey="unit_price" activeKey={tc.sortKey} dir={tc.sortDir} onSort={tc.toggleSort} />
                    <SortHeader label="سعر الشراء" sortKey="buy_price"  activeKey={tc.sortKey} dir={tc.sortDir} onSort={tc.toggleSort} />
                    <th className="px-5 py-4">الوحدة</th>
                    <SortHeader label="المخزون"    sortKey="stock"      activeKey={tc.sortKey} dir={tc.sortDir} onSort={tc.toggleSort} />
                    <th className="px-5 py-4 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-brand-700">
                  {tc.pageRows.map((np, idx) => {
                    const p = np._raw;
                    return (
                      <tr key={p.id || idx} className="hover:bg-slate-50/60 dark:hover:bg-brand-800 transition-colors">
                        <td className="px-5 py-3.5">
                          <span className="text-xs font-mono text-slate-500 dark:text-brand-400 bg-slate-100 dark:bg-brand-800 px-2 py-0.5 rounded">
                            {p.code || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-800 dark:text-brand-100 max-w-[200px]">
                          <span className="block truncate">{p.name || '—'}</span>
                        </td>
                        <td className="px-5 py-3.5 font-bold text-brand-800 dark:text-brand-100">
                          {fmtPrice(p.unit_price)}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500 dark:text-brand-400">
                          {p.buy_price ? fmtPrice(p.buy_price) : '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="flex items-center gap-1 text-slate-600 dark:text-brand-300 text-xs font-medium">
                            <Tag size={12} className="text-gold-500" /> {p.unit || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-brand-300 text-xs tabular-nums" dir="ltr">
                          {p.stock_balance != null ? Number(p.stock_balance).toLocaleString('en-US', { maximumFractionDigits: 3 }) : '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => navigate(`/admin/dashboard/prod/${p.id}`)} title="حركة الصنف"
                              className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition">
                              <BarChart2 size={15} />
                            </button>
                            <button onClick={() => openEdit(p)} title="تعديل"
                              className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition">
                              <Edit3 size={15} />
                            </button>
                            <button onClick={() => setConfirmId(p.id)} title="حذف"
                              className="p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-5 pb-2 pt-2">
              <TablePager page={tc.page} totalPages={tc.totalPages} setPage={tc.setPage} pageStart={tc.pageStart} pageEnd={tc.pageEnd} totalRows={tc.totalRows} />
            </div>

            {hasMore && (
              <div className="flex justify-center p-5 border-t border-slate-100 dark:border-brand-700">
                <button onClick={() => loadProducts(page + 1, search)} disabled={loading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-slate-50 dark:bg-brand-800 hover:bg-slate-100 dark:hover:bg-brand-800 text-slate-600 dark:text-brand-300 rounded-xl text-sm font-bold border border-slate-200 dark:border-brand-700 transition disabled:opacity-60">
                  {loading ? <RefreshCw size={15} className="animate-spin" /> : null}
                  تحميل المزيد
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
