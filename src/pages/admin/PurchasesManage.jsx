import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Calendar, DollarSign, ShoppingCart,
  Building, Edit3, ChevronLeft, RefreshCw,
  AlertTriangle, CheckCircle2, X, Package, Truck
} from 'lucide-react';

const API_URL = "https://semak.sa/api.php";

// ─── تنسيق الأرقام ───────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(n) || 0) + ' ر.س';

// ─── اليوم بتنسيق YYYY-MM-DD ─────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);

// ─── بند فارغ ────────────────────────────────────────────────────
const emptyItem = () => ({ name: '', quantity: 1, unit_price: 0, discount: 0, tax: 15 });

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

// ════════════════════════════════════════════════════════════════
// المكوّن الرئيسي
// ════════════════════════════════════════════════════════════════
export default function PurchasesManage({ user, navigateTo, showToast: externalToast }) {
  // ─── حالة العرض ─────────────────────────────────────────────
  const [view, setView]             = useState('list');
  const [purchases, setPurchases]   = useState([]);
  const [suppliers, setSuppliers]   = useState([]);
  const [workCycles, setWorkCycles] = useState([]);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');
  const [selected, setSelected]     = useState(null);
  const [toast, setToast]           = useState(null);

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
  const notify = (msg, type = 'success') => setToast({ msg, type });

  // ─── جلب القوائم المنسدلة ─────────────────────────────────────
  const loadDropdowns = useCallback(async () => {
    try {
      const [sRes, wRes] = await Promise.all([
        fetch(`${API_URL}?action=daftra_suppliers_list`),
        fetch(`${API_URL}?action=daftra_v2_work_cycles`),
      ]);
      const [sData, wData] = await Promise.all([sRes.json(), wRes.json()]);
      if (sData.success && Array.isArray(sData.data)) setSuppliers(sData.data);
      if (wData.success && Array.isArray(wData.data)) setWorkCycles(wData.data);
    } catch { /* تجاهل */ }
  }, []);

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
  const displayed = purchases.filter(p => {
    if (!appliedFilters.search) return true;
    const q = appliedFilters.search.toLowerCase();
    return (
      String(p.no || '').toLowerCase().includes(q) ||
      String(p.supplier || '').toLowerCase().includes(q)
    );
  });

  // ─── ملخص مالي ───────────────────────────────────────────────
  const totalAmount      = displayed.reduce((s, p) => s + (parseFloat(p.total) || 0), 0);
  const totalPaid        = displayed.reduce((s, p) => s + (parseFloat(p.paid)  || 0), 0);
  const totalOutstanding = totalAmount - totalPaid;

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
            <ShoppingCart size={20} className="text-[#c5a059]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#1a365d]">فواتير الشراء</h1>
            <p className="text-xs text-slate-400 font-medium">إدارة أوامر الشراء والموردين</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-[#c5a059] hover:bg-amber-600 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md transition-colors"
        >
          <Plus size={16} />
          أمر شراء جديد
        </button>
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
                placeholder="رقم أمر أو اسم مورد..."
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
        <SummaryChip icon={ShoppingCart} label="إجمالي الأوامر"   value={displayed.length}       color="bg-[#1a365d]" />
        <SummaryChip icon={DollarSign}   label="إجمالي المشتريات" value={fmt(totalAmount)}        color="bg-indigo-500" />
        <SummaryChip icon={CheckCircle2} label="المدفوع"           value={fmt(totalPaid)}          color="bg-green-500" />
        <SummaryChip icon={AlertTriangle} label="المتبقي"          value={fmt(totalOutstanding)}   color="bg-amber-500" />
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

      {/* جدول المشتريات */}
      {!loading && !error && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-300">
              <ShoppingCart size={48} className="mb-4" />
              <p className="text-sm font-bold text-slate-400">لا توجد فواتير شراء في هذه الفترة</p>
              <button
                onClick={openCreate}
                className="mt-4 flex items-center gap-2 bg-[#c5a059] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-amber-600 transition-colors"
              >
                <Plus size={14} />
                أنشئ أول أمر شراء
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['رقم', 'التاريخ', 'المورد', 'الإجمالي', 'المتبقي', 'المشروع', 'إجراءات'].map(h => (
                      <th key={h} className="px-4 py-3 text-right text-xs font-black text-slate-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((p, idx) => {
                    const remaining = (parseFloat(p.total) || 0) - (parseFloat(p.paid) || 0);
                    const project   = workCycles.find(w => String(w.id) === String(p.work_order_id));
                    return (
                      <tr
                        key={p.id}
                        className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}
                      >
                        <td className="px-4 py-3">
                          <span className="bg-[#c5a059]/15 text-[#7a5c1e] px-2 py-0.5 rounded-lg text-xs font-black">
                            #{p.no || p.id}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 font-medium whitespace-nowrap">{p.date || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <Truck size={13} className="text-slate-300 shrink-0" />
                            <span className="text-xs text-slate-700 font-bold">{p.supplier || '—'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs font-black text-slate-700 whitespace-nowrap">{fmt(p.total)}</td>
                        <td className="px-4 py-3 text-xs font-bold whitespace-nowrap">
                          <span className={remaining > 0 ? 'text-amber-600' : 'text-green-600'}>
                            {fmt(remaining)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 font-medium">
                          {project
                            ? <span className="flex items-center gap-1"><Building size={12} className="text-slate-300" />{project.title || `#${project.number || project.id}`}</span>
                            : <span className="text-slate-300">—</span>
                          }
                        </td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => openEdit(p)}
                            title="تعديل"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-[#c5a059] hover:bg-amber-50 transition-colors"
                          >
                            <Edit3 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
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
        className="flex items-center gap-2 text-slate-500 hover:text-[#1a365d] font-bold text-sm mb-5 transition-colors"
      >
        <ChevronLeft size={16} />
        رجوع إلى القائمة
      </button>

      <h2 className="text-lg font-black text-[#1a365d] mb-6 flex items-center gap-2">
        <ShoppingCart size={18} className="text-[#c5a059]" />
        {view === 'edit' ? 'تعديل فاتورة الشراء' : 'أمر شراء جديد'}
      </h2>

      {/* قسم: معلومات أمر الشراء */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-5">
        <h3 className="text-sm font-black text-[#1a365d] mb-4 flex items-center gap-2">
          <Truck size={15} className="text-[#c5a059]" />
          معلومات أمر الشراء
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* المورد */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 mb-1">المورد <span className="text-red-500">*</span></label>
            <select
              value={form.supplier_id}
              onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d] bg-white"
            >
              <option value="">— اختر المورد —</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          {/* التاريخ */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">التاريخ <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d]"
            />
          </div>

          {/* المشروع */}
          <div>
            <label className="block text-xs font-bold text-slate-500 mb-1">المشروع (اختياري)</label>
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
              rows={2}
              placeholder="ملاحظات إضافية..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d] resize-none"
            />
          </div>
        </div>
      </div>

      {/* قسم: بنود الشراء */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-[#1a365d] flex items-center gap-2">
            <Package size={15} className="text-[#c5a059]" />
            بنود الشراء
          </h3>
          <button
            onClick={addItem}
            className="flex items-center gap-1.5 text-xs bg-[#c5a059]/15 hover:bg-[#c5a059]/25 text-[#7a5c1e] px-3 py-1.5 rounded-xl font-bold transition-colors"
          >
            <Plus size={13} />
            أضف بند
          </button>
        </div>

        <div className="space-y-3">
          {form.items.map((item, idx) => (
            <div key={idx} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-2">
                {/* اسم البند */}
                <div className="col-span-2 md:col-span-3 lg:col-span-2">
                  <label className="block text-xs font-bold text-slate-400 mb-1">اسم البند <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder="وصف المادة أو الخدمة"
                    value={item.name}
                    onChange={e => updateItem(idx, 'name', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d] bg-white"
                  />
                </div>

                {/* الكمية */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">الكمية</label>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={item.quantity}
                    onChange={e => updateItem(idx, 'quantity', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d] bg-white"
                  />
                </div>

                {/* سعر الوحدة */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">سعر الوحدة</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unit_price}
                    onChange={e => updateItem(idx, 'unit_price', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d] bg-white"
                  />
                </div>

                {/* الخصم */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">خصم %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={item.discount}
                    onChange={e => updateItem(idx, 'discount', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d] bg-white"
                  />
                </div>

                {/* الضريبة */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">ضريبة %</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={item.tax}
                    onChange={e => updateItem(idx, 'tax', e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d] bg-white"
                  />
                </div>
              </div>

              {/* إجمالي السطر + زر الحذف */}
              <div className="flex items-center justify-between mt-1">
                <div>
                  <span className="text-xs text-slate-400 font-medium">إجمالي البند: </span>
                  <span className="text-sm font-black text-[#1a365d]">{fmt(lineTotal(item))}</span>
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
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-6">
        <h3 className="text-sm font-black text-[#1a365d] mb-4 flex items-center gap-2">
          <DollarSign size={15} className="text-[#c5a059]" />
          الإجمالي
        </h3>
        <div className="space-y-2.5 max-w-xs mr-auto">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400 font-medium">الإجمالي قبل الخصم</span>
            <span className="font-bold text-slate-700">{fmt(subtotal)}</span>
          </div>
          {totalDisc > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-400 font-medium">إجمالي الخصم</span>
              <span className="font-bold text-red-500">- {fmt(totalDisc)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-slate-400 font-medium">إجمالي الضريبة (15%)</span>
            <span className="font-bold text-slate-600">{fmt(totalTax)}</span>
          </div>
          <div className="border-t border-slate-200 pt-2.5 flex justify-between">
            <span className="text-sm font-black text-[#1a365d]">الإجمالي الكلي</span>
            <span className="text-lg font-black text-[#1a365d]">{fmt(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* زر الحفظ */}
      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 bg-[#c5a059] hover:bg-amber-600 disabled:opacity-60 disabled:cursor-not-allowed text-white px-8 py-3 rounded-xl font-black text-sm shadow-lg transition-colors"
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
    <div dir="rtl" className="font-cairo min-h-screen bg-slate-50 p-4 md:p-6">
      {/* Toast */}
      {toast && (
        <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />
      )}

      {/* المحتوى */}
      {view === 'list'                       && <ListView />}
      {(view === 'create' || view === 'edit') && <FormView />}
    </div>
  );
}
