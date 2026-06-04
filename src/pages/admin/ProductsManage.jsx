import React, { useState, useEffect, useCallback } from 'react';
import {
  Package, Plus, Search, Tag, DollarSign,
  Edit3, Trash2, ChevronLeft, RefreshCw,
  AlertTriangle, CheckCircle2, X
} from 'lucide-react';
import ExportButton from '../../components/ExportButton';
import { fmt as fmtExport } from '../../utils/exporters';
import useTableControls from '../../utils/useTableControls';
import SortHeader from '../../components/SortHeader';
import TablePager from '../../components/TablePager';

const API_URL = "https://semak.sa/api.php";

// ─── تنسيق الأرقام ───────────────────────────────────────────────
const fmt = (n) =>
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

// ─── شارة النوع ──────────────────────────────────────────────────
function TypeBadge({ type }) {
  const isService = type === '2' || type === 'service' || String(type) === '2';
  return isService
    ? <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-blue-100 text-blue-700 border-blue-200">خدمة</span>
    : <span className="px-2.5 py-0.5 rounded-full text-xs font-bold border bg-green-100 text-green-700 border-green-200">منتج</span>;
}

// ─── القيم الافتراضية للنموذج ─────────────────────────────────────
const defaultForm = () => ({
  name: '',
  code: '',
  sale_price: '',
  purchase_price: '',
  unit: 'قطعة',
  notes: '',
});

// ════════════════════════════════════════════════════════════════
// المكوّن الرئيسي – المنتجات والخدمات
// ════════════════════════════════════════════════════════════════
export default function ProductsManage({ user, navigateTo }) {
  // ─── حالة العرض ─────────────────────────────────────────────
  const [view, setView]           = useState('list');
  const [products, setProducts]   = useState([]);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [search, setSearch]       = useState('');
  const [page, setPage]           = useState(1);
  const [hasMore, setHasMore]     = useState(false);
  const [selected, setSelected]   = useState(null);   // منتج قيد التعديل
  const [confirmId, setConfirmId] = useState(null);
  const [toast, setToast]         = useState(null);
  const [form, setForm]           = useState(defaultForm());

  // ─── Toast مساعد ─────────────────────────────────────────────
  const notify = (msg, type = 'success') => setToast({ msg, type });

  // ─── جلب القائمة ─────────────────────────────────────────────
  const loadProducts = useCallback(async (pg = 1, q = '') => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_URL}?action=daftra_products_list&page=${pg}&search=${encodeURIComponent(q)}`
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        if (pg === 1) {
          setProducts(data.data);
        } else {
          setProducts(prev => [...prev, ...data.data]);
        }
        setHasMore(data.data.length >= 20);
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

  useEffect(() => {
    if (view === 'list') {
      loadProducts(1, search);
    }
  }, [view, loadProducts]);

  // ─── بحث فوري ────────────────────────────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      if (view === 'list') loadProducts(1, search);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  // ─── نموذج: تغيير الحقول ─────────────────────────────────────
  const handleField = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  // ─── فتح نموذج الإنشاء ───────────────────────────────────────
  const openCreate = () => {
    setSelected(null);
    setForm(defaultForm());
    setView('create');
  };

  // ─── فتح نموذج التعديل ───────────────────────────────────────
  const openEdit = (product) => {
    setSelected(product);
    const p = product.Product || product;
    setForm({
      name:           p.name || '',
      code:           p.code || '',
      sale_price:     p.sale_price || p.price || '',
      purchase_price: p.purchase_price || '',
      unit:           p.unit || 'قطعة',
      notes:          p.notes || p.description || '',
    });
    setView('edit');
  };

  // ─── حفظ (إنشاء أو تعديل) ────────────────────────────────────
  const handleSave = async () => {
    if (!form.name.trim()) { notify('يرجى إدخال اسم المنتج أو الخدمة', 'error'); return; }
    if (!form.sale_price)  { notify('يرجى إدخال سعر البيع', 'error'); return; }

    setSaving(true);
    try {
      const isEdit = view === 'edit' && selected;
      const pid = isEdit ? (selected.Product?.id || selected.id) : null;
      const method = isEdit ? 'PUT' : 'POST';
      const action = isEdit ? 'daftra_product_update' : 'daftra_product_create';

      const url = isEdit
        ? `${API_URL}?action=${action}&id=${pid}`
        : `${API_URL}?action=${action}`;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:           form.name.trim(),
          code:           form.code.trim(),
          sale_price:     parseFloat(form.sale_price) || 0,
          purchase_price: parseFloat(form.purchase_price) || 0,
          unit:           form.unit.trim() || 'قطعة',
          notes:          form.notes.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        notify(isEdit ? 'تم تحديث المنتج بنجاح' : 'تم إضافة المنتج بنجاح');
        setView('list');
      } else {
        notify(data.message || 'حدث خطأ أثناء الحفظ', 'error');
      }
    } catch {
      notify('فشل الاتصال بالخادم', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ─── حذف ─────────────────────────────────────────────────────
  const handleDelete = async (id) => {
    setConfirmId(null);
    try {
      const res = await fetch(`${API_URL}?action=daftra_product_delete&id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        notify('تم حذف المنتج بنجاح');
        setProducts(prev => prev.filter(p => (p.Product?.id || p.id) !== id));
      } else {
        notify(data.message || 'فشل الحذف', 'error');
      }
    } catch {
      notify('فشل الاتصال بالخادم', 'error');
    }
  };

  // ─── حسابات الملخص ───────────────────────────────────────────
  const totalCount = products.length;
  const avgPrice = totalCount > 0
    ? products.reduce((sum, p) => {
        const item = p.Product || p;
        return sum + (parseFloat(item.sale_price || item.price) || 0);
      }, 0) / totalCount
    : 0;

  // ─── فرز + ترقيم صفحات (على الصفوف المُحمّلة) ───────────────
  // تطبيع الصفوف بمفاتيح الفرز المطلوبة مع الاحتفاظ بالصف الأصلي في _raw
  const normalizedProducts = products.map(row => {
    const p = row.Product || row;
    return {
      id:            p.id,
      code:          p.code || '',
      name:          p.name || '',
      selling_price: parseFloat(p.sale_price ?? p.price) || 0,
      buying_price:  parseFloat(p.purchase_price) || 0,
      stock:         parseFloat(p.stock_count) || 0,
      _raw:          row,
    };
  });
  const tc = useTableControls(normalizedProducts, { pageSize: 15, initialSort: { key: 'name', dir: 'asc' } });

  // ════════ عرض النموذج (إنشاء / تعديل) ════════════════════════
  if (view === 'create' || view === 'edit') {
    const isEdit = view === 'edit';
    return (
      <div className="animate-fadeIn pb-10" dir="rtl">
        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

        {/* ─── رأس الصفحة ─── */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setView('list')}
              className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition"
            >
              <ChevronLeft size={20} className="text-slate-600" />
            </button>
            <div>
              <h1 className="text-xl font-black text-[#1a365d] flex items-center gap-2">
                <Package size={22} className="text-[#c5a059]" />
                {isEdit ? 'تعديل المنتج / الخدمة' : 'إضافة منتج أو خدمة جديدة'}
              </h1>
              <p className="text-xs text-slate-400 font-medium mt-0.5">
                {isEdit ? `تعديل: ${form.name}` : 'أدخل تفاصيل المنتج أو الخدمة'}
              </p>
            </div>
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 bg-[#1a365d] hover:bg-[#152d50] text-white px-6 py-3 rounded-xl font-bold text-sm transition shadow-md disabled:opacity-60"
          >
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
            {isEdit ? 'حفظ التعديلات' : 'حفظ المنتج'}
          </button>
        </div>

        {/* ─── بطاقة النموذج ─── */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-8 max-w-2xl">
          <div className="space-y-5">

            {/* الاسم */}
            <div>
              <label className="block text-xs font-bold text-[#1a365d] mb-1.5">
                اسم المنتج / الخدمة <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleField}
                placeholder="مثال: خدمة صيانة كهربائية"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-800 outline-none focus:border-[#c5a059] focus:bg-white transition"
              />
            </div>

            {/* الكود */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">
                الكود (اختياري)
              </label>
              <input
                type="text"
                name="code"
                value={form.code}
                onChange={handleField}
                placeholder="مثال: SRV-001"
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-800 outline-none focus:border-[#c5a059] focus:bg-white transition"
                dir="ltr"
              />
            </div>

            {/* الأسعار */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-[#1a365d] mb-1.5">
                  سعر البيع (ر.س) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <DollarSign size={15} className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400" />
                  <input
                    type="number"
                    name="sale_price"
                    value={form.sale_price}
                    onChange={handleField}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 pr-8 text-sm font-medium text-slate-800 outline-none focus:border-[#c5a059] focus:bg-white transition"
                    dir="ltr"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5">
                  سعر الشراء (ر.س)
                </label>
                <div className="relative">
                  <DollarSign size={15} className="absolute top-1/2 -translate-y-1/2 right-3 text-slate-400" />
                  <input
                    type="number"
                    name="purchase_price"
                    value={form.purchase_price}
                    onChange={handleField}
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 pr-8 text-sm font-medium text-slate-800 outline-none focus:border-[#c5a059] focus:bg-white transition"
                    dir="ltr"
                  />
                </div>
              </div>
            </div>

            {/* الوحدة */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">
                وحدة القياس
              </label>
              <div className="flex gap-2 flex-wrap">
                {['قطعة', 'ساعة', 'متر', 'متر مربع', 'كيلو', 'طن', 'خدمة'].map(u => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, unit: u }))}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition ${
                      form.unit === u
                        ? 'bg-[#1a365d] text-white border-[#1a365d]'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {u}
                  </button>
                ))}
                <input
                  type="text"
                  name="unit"
                  value={form.unit}
                  onChange={handleField}
                  placeholder="أو اكتب وحدة مخصصة..."
                  className="flex-1 min-w-[150px] bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-800 outline-none focus:border-[#c5a059] focus:bg-white transition"
                />
              </div>
            </div>

            {/* الملاحظات */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-1.5">
                ملاحظات
              </label>
              <textarea
                name="notes"
                value={form.notes}
                onChange={handleField}
                rows={3}
                placeholder="وصف إضافي أو ملاحظات..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm font-medium text-slate-800 outline-none focus:border-[#c5a059] focus:bg-white transition resize-none"
              />
            </div>

          </div>
        </div>
      </div>
    );
  }

  // ════════ عرض القائمة ═════════════════════════════════════════
  return (
    <div className="animate-fadeIn pb-10" dir="rtl">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {confirmId !== null && (
        <ConfirmDialog
          msg="هل أنت متأكد من حذف هذا المنتج / الخدمة؟ لا يمكن التراجع."
          onConfirm={() => handleDelete(confirmId)}
          onCancel={() => setConfirmId(null)}
        />
      )}

      {/* ─── رأس الصفحة ─── */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#1a365d] rounded-2xl flex items-center justify-center shadow">
            <Package size={24} className="text-[#c5a059]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#1a365d]">المنتجات والخدمات</h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">إدارة كتالوج المنتجات والخدمات في دفترة</p>
          </div>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <ExportButton
            rows={products}
            columns={[
              { key: 'code', label: 'الكود', format: (_v, r) => (r.Product || r).code || '' },
              { key: 'name', label: 'الاسم', format: (_v, r) => (r.Product || r).name || '' },
              { key: 'category', label: 'الفئة', format: (_v, r) => {
                const t = (r.Product || r).product_type ?? (r.Product || r).type;
                return String(t) === '2' || t === 'service' ? 'خدمة' : 'منتج';
              } },
              { key: 'selling_price', label: 'سعر البيع', format: (_v, r) => fmtExport.money((r.Product || r).sale_price ?? (r.Product || r).price) },
              { key: 'buying_price', label: 'سعر الشراء', format: (_v, r) => fmtExport.money((r.Product || r).purchase_price) },
              { key: 'unit', label: 'الوحدة', format: (_v, r) => (r.Product || r).unit || '' },
              { key: 'stock', label: 'المخزون', format: (_v, r) => fmtExport.int((r.Product || r).stock_count) },
            ]}
            filename="المنتجات"
          />
          <button
            onClick={() => loadProducts(1, search)}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition text-slate-500"
            title="تحديث"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-[#c5a059] hover:bg-[#b8943f] text-white px-5 py-2.5 rounded-xl font-bold text-sm transition shadow-md"
          >
            <Plus size={18} />
            إضافة منتج / خدمة
          </button>
        </div>
      </div>

      {/* ─── شرائح الملخص ─── */}
      <div className="flex flex-wrap gap-3 mb-6">
        <SummaryChip
          icon={Package}
          label="إجمالي البنود"
          value={`${totalCount} بند`}
          color="bg-[#1a365d]"
        />
        <SummaryChip
          icon={DollarSign}
          label="متوسط سعر البيع"
          value={fmt(avgPrice)}
          color="bg-[#c5a059]"
        />
      </div>

      {/* ─── شريط البحث ─── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-3 mb-4 flex items-center gap-3">
        <Search size={18} className="text-slate-400 flex-shrink-0" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ابحث بالاسم أو الكود..."
          className="flex-1 bg-transparent text-sm font-medium text-slate-700 outline-none placeholder:text-slate-300"
        />
        {search && (
          <button onClick={() => setSearch('')} className="text-slate-400 hover:text-slate-600 transition">
            <X size={16} />
          </button>
        )}
      </div>

      {/* ─── الجدول ─── */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {loading && products.length === 0 ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
            <RefreshCw size={24} className="animate-spin" />
            <span className="font-bold text-sm">جاري التحميل...</span>
          </div>
        ) : products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <Package size={40} className="opacity-30" />
            <p className="font-bold text-sm">لا توجد نتائج</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr className="text-[#1a365d] font-black text-xs">
                    <SortHeader label="الكود"     sortKey="code"          activeKey={tc.sortKey} dir={tc.sortDir} onSort={tc.toggleSort} />
                    <SortHeader label="الاسم"     sortKey="name"          activeKey={tc.sortKey} dir={tc.sortDir} onSort={tc.toggleSort} />
                    <th className="px-5 py-4">الفئة</th>
                    <SortHeader label="سعر البيع"  sortKey="selling_price" activeKey={tc.sortKey} dir={tc.sortDir} onSort={tc.toggleSort} />
                    <SortHeader label="سعر الشراء" sortKey="buying_price"  activeKey={tc.sortKey} dir={tc.sortDir} onSort={tc.toggleSort} />
                    <th className="px-5 py-4">الوحدة</th>
                    <SortHeader label="المخزون"   sortKey="stock"         activeKey={tc.sortKey} dir={tc.sortDir} onSort={tc.toggleSort} />
                    <th className="px-5 py-4 text-center">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {tc.pageRows.map((np, idx) => {
                    const row = np._raw;
                    const p = row.Product || row;
                    const pid = p.id;
                    return (
                      <tr key={pid || idx} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3.5">
                          <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                            {p.code || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 font-bold text-slate-800 max-w-[200px]">
                          <span className="block truncate">{p.name || '—'}</span>
                        </td>
                        <td className="px-5 py-3.5">
                          <TypeBadge type={p.product_type || p.type} />
                        </td>
                        <td className="px-5 py-3.5 font-bold text-[#1a365d]">
                          {fmt(p.sale_price || p.price)}
                        </td>
                        <td className="px-5 py-3.5 text-slate-500">
                          {p.purchase_price ? fmt(p.purchase_price) : '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="flex items-center gap-1 text-slate-600 text-xs font-medium">
                            <Tag size={12} className="text-[#c5a059]" />
                            {p.unit || '—'}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-slate-600 text-xs">
                          {p.stock_count != null ? p.stock_count : '—'}
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => openEdit(row)}
                              className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                              title="تعديل"
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              onClick={() => setConfirmId(pid)}
                              className="p-2 bg-red-50 text-red-500 hover:bg-red-100 rounded-lg transition"
                              title="حذف"
                            >
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

            {/* ─── ترقيم محلي للصفوف المُحمّلة ─── */}
            <div className="px-5 pb-2 pt-2">
              <TablePager page={tc.page} totalPages={tc.totalPages} setPage={tc.setPage}
                pageStart={tc.pageStart} pageEnd={tc.pageEnd} totalRows={tc.totalRows} />
            </div>

            {/* ─── تحميل المزيد ─── */}
            {hasMore && (
              <div className="flex justify-center p-5 border-t border-slate-100">
                <button
                  onClick={() => loadProducts(page + 1, search)}
                  disabled={loading}
                  className="flex items-center gap-2 px-6 py-2.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-xl text-sm font-bold border border-slate-200 transition disabled:opacity-60"
                >
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
