import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Search, Calendar, User, DollarSign, Receipt,
  Edit3, Trash2, Eye, ChevronLeft, RefreshCw,
  AlertTriangle, CheckCircle2, X, FileText, Printer
} from 'lucide-react';

const API_URL = "https://semak.sa/api.php";

// ─── حساب حالة الفاتورة ──────────────────────────────────────────
function invoiceStatus(total, paid) {
  const t = parseFloat(total) || 0;
  const p = parseFloat(paid) || 0;
  if (p >= t && t > 0) return { label: 'مدفوعة',     cls: 'bg-green-100 text-green-700 border-green-200' };
  if (p > 0)           return { label: 'جزئي',        cls: 'bg-amber-100 text-amber-700 border-amber-200' };
  return                      { label: 'غير مدفوعة', cls: 'bg-red-100 text-red-700 border-red-200' };
}

// ─── تنسيق الأرقام ───────────────────────────────────────────────
const fmt = (n, currency = 'SAR') =>
  new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(n) || 0) +
  ' ' + (currency === 'SAR' ? 'ر.س' : currency === 'USD' ? '$' : '€');

// ─── اليوم بتنسيق YYYY-MM-DD ─────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);

// ─── بند فاتورة فارغ ─────────────────────────────────────────────
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

// ─── شارة الحالة ─────────────────────────────────────────────────
function StatusBadge({ total, paid }) {
  const s = invoiceStatus(total, paid);
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ─── شريحة ملخص ──────────────────────────────────────────────────
function SummaryChip({ icon: Icon, label, value, color }) {
  return (
    <div className={`flex items-center gap-3 bg-white rounded-2xl shadow-sm border border-slate-100 px-4 py-3 flex-1 min-w-[160px]`}>
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

// ════════════════════════════════════════════════════════════════
// المكوّن الرئيسي
// ════════════════════════════════════════════════════════════════
export default function InvoicesManage({ user, navigateTo, showToast: externalToast }) {
  // ─── حالة العرض ─────────────────────────────────────────────
  const [view, setView]               = useState('list');
  const [invoices, setInvoices]       = useState([]);
  const [clients, setClients]         = useState([]);
  const [products, setProducts]       = useState([]);
  const [workCycles, setWorkCycles]   = useState([]);
  const [loading, setLoading]         = useState(false);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');
  const [selected, setSelected]       = useState(null);
  const [confirmId, setConfirmId]     = useState(null);
  const [toast, setToast]             = useState(null);

  const [filters, setFilters] = useState({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
    to: today(),
    search: '',
  });
  const [appliedFilters, setAppliedFilters] = useState({ ...filters });

  const defaultForm = {
    client_id: '', date: today(), currency: 'SAR',
    work_order_id: '', notes: '',
    items: [emptyItem()],
  };
  const [form, setForm] = useState(defaultForm);

  // ─── Toast مساعد ─────────────────────────────────────────────
  const notify = (msg, type = 'success') => setToast({ msg, type });

  // ─── جلب البيانات الأساسية ────────────────────────────────────
  const loadDropdowns = useCallback(async () => {
    try {
      const [cRes, pRes, wRes] = await Promise.all([
        fetch(`${API_URL}?action=daftra_clients`),
        fetch(`${API_URL}?action=daftra_products`),
        fetch(`${API_URL}?action=daftra_v2_work_cycles`),
      ]);
      const [cData, pData, wData] = await Promise.all([cRes.json(), pRes.json(), wRes.json()]);

      // عملاء Daftra: البيانات ملفوفة في Client{}
      if (cData.success && Array.isArray(cData.data)) {
        setClients(cData.data.map(r => {
          const c = r.Client || r;
          return {
            id: c.id,
            name: c.business_name || `${c.first_name || ''} ${c.last_name || ''}`.trim() || `عميل #${c.id}`,
          };
        }));
      }
      if (pData.success && Array.isArray(pData.data)) setProducts(pData.data);
      if (wData.success && Array.isArray(wData.data)) setWorkCycles(wData.data);
    } catch { /* تجاهل أخطاء القوائم المنسدلة */ }
  }, []);

  const loadInvoices = useCallback(async (f = appliedFilters) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(
        `${API_URL}?action=daftra_invoices_list&from=${f.from}&to=${f.to}`
      );
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setInvoices(data.data);
      } else {
        setInvoices([]);
        setError(data.message || 'فشل تحميل الفواتير');
      }
    } catch {
      setError('خطأ في الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }, [appliedFilters]);

  useEffect(() => {
    loadDropdowns();
  }, [loadDropdowns]);

  useEffect(() => {
    if (view === 'list') loadInvoices(appliedFilters);
  }, [view, appliedFilters]); // eslint-disable-line

  // ─── فلترة العرض ─────────────────────────────────────────────
  const displayed = invoices.filter(inv => {
    if (!appliedFilters.search) return true;
    const q = appliedFilters.search.toLowerCase();
    return (
      String(inv.no || '').toLowerCase().includes(q) ||
      String(inv.client || '').toLowerCase().includes(q)
    );
  });

  // ─── ملخص مالي ───────────────────────────────────────────────
  const totalRevenue  = displayed.reduce((s, i) => s + (parseFloat(i.total) || 0), 0);
  const totalPaid     = displayed.reduce((s, i) => s + (parseFloat(i.paid)  || 0), 0);
  const totalOutstanding = totalRevenue - totalPaid;

  // ─── إجراءات الفاتورة ────────────────────────────────────────
  const openCreate = () => {
    setForm(defaultForm);
    setSelected(null);
    setView('create');
  };

  const openEdit = (inv) => {
    setSelected(inv);
    setForm({
      client_id:     inv.client_id || '',
      date:          inv.date || today(),
      currency:      inv.currency || 'SAR',
      work_order_id: inv.work_order_id || '',
      notes:         inv.notes || '',
      items:         Array.isArray(inv.items) && inv.items.length ? inv.items : [emptyItem()],
    });
    setView('edit');
  };

  const openDetail = (inv) => {
    setSelected(inv);
    setView('detail');
  };

  const handleDelete = async (id) => {
    setConfirmId(null);
    try {
      const res  = await fetch(`${API_URL}?action=daftra_invoice_delete&id=${id}`);
      const data = await res.json();
      if (data.success) {
        notify('تم حذف الفاتورة بنجاح');
        loadInvoices();
      } else {
        notify(data.message || 'فشل حذف الفاتورة', 'error');
      }
    } catch {
      notify('خطأ في الاتصال بالخادم', 'error');
    }
  };

  const handleSave = async () => {
    if (!form.client_id)   return notify('يرجى اختيار العميل', 'error');
    if (!form.date)        return notify('يرجى تحديد التاريخ', 'error');
    if (!form.items.length) return notify('أضف بنداً واحداً على الأقل', 'error');

    const validItems = form.items.filter(it => it.name && parseFloat(it.quantity) > 0);
    if (!validItems.length) return notify('يرجى إدخال اسم وكمية لكل بند', 'error');

    setSaving(true);
    try {
      const action = view === 'edit' ? 'daftra_invoice_update' : 'daftra_invoice_create';
      const body   = {
        ...(view === 'edit' ? { id: selected.id } : {}),
        client_id:     form.client_id,
        date:          form.date,
        currency:      form.currency,
        work_order_id: form.work_order_id || '',
        notes:         form.notes || '',
        items:         validItems.map(it => ({
          name:       it.name,
          quantity:   parseFloat(it.quantity) || 1,
          unit_price: parseFloat(it.unit_price) || 0,
          discount:   parseFloat(it.discount) || 0,
          tax:        parseFloat(it.tax) ?? 15,
        })),
      };

      const res  = await fetch(`${API_URL}?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.success) {
        notify(view === 'edit' ? 'تم تحديث الفاتورة بنجاح' : 'تم إنشاء الفاتورة بنجاح');
        setView('list');
      } else {
        notify(data.message || 'فشل حفظ الفاتورة', 'error');
      }
    } catch {
      notify('خطأ في الاتصال بالخادم', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ─── حسابات البنود ───────────────────────────────────────────
  const lineTotal = (item) => {
    const qty     = parseFloat(item.quantity)   || 0;
    const price   = parseFloat(item.unit_price) || 0;
    const disc    = parseFloat(item.discount)   || 0;
    const tax     = parseFloat(item.tax)        || 0;
    const base    = qty * price;
    const discAmt = base * (disc / 100);
    const taxAmt  = (base - discAmt) * (tax / 100);
    return base - discAmt + taxAmt;
  };

  const subtotal     = form.items.reduce((s, it) => {
    const qty = parseFloat(it.quantity) || 0;
    const prc = parseFloat(it.unit_price) || 0;
    return s + qty * prc;
  }, 0);
  const totalDisc    = form.items.reduce((s, it) => {
    const qty = parseFloat(it.quantity) || 0;
    const prc = parseFloat(it.unit_price) || 0;
    return s + (qty * prc) * ((parseFloat(it.discount) || 0) / 100);
  }, 0);
  const totalTax     = form.items.reduce((s, it) => {
    const qty   = parseFloat(it.quantity) || 0;
    const prc   = parseFloat(it.unit_price) || 0;
    const disc  = (parseFloat(it.discount) || 0) / 100;
    const taxPc = (parseFloat(it.tax) || 0) / 100;
    return s + (qty * prc * (1 - disc)) * taxPc;
  }, 0);
  const grandTotal = subtotal - totalDisc + totalTax;

  // ─── تعديل بنود الفاتورة ─────────────────────────────────────
  const updateItem = (idx, field, val) => {
    setForm(f => {
      const items = f.items.map((it, i) => i === idx ? { ...it, [field]: val } : it);
      return { ...f, items };
    });
  };
  const addItem = () => setForm(f => ({ ...f, items: [...f.items, emptyItem()] }));
  const removeItem = (idx) => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  const applyProduct = (idx, productId) => {
    const prod = products.find(p => String(p.id) === String(productId));
    if (prod) {
      updateItem(idx, 'name', prod.name);
      updateItem(idx, 'unit_price', parseFloat(prod.price) || 0);
    }
  };

  // ════════════════════════════════════════════════════════════
  // عرض: قائمة الفواتير
  // ════════════════════════════════════════════════════════════
  const ListView = () => (
    <div>
      {/* رأس الصفحة */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-[#1a365d] to-[#2d5299] rounded-2xl flex items-center justify-center shadow-lg">
            <Receipt size={20} className="text-[#c5a059]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#1a365d]">الفواتير</h1>
            <p className="text-xs text-slate-400 font-medium">إدارة الفواتير والمدفوعات</p>
          </div>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md transition-colors"
        >
          <Plus size={16} />
          فاتورة جديدة
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
                placeholder="رقم فاتورة أو اسم عميل..."
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
          icon={FileText}
          label="إجمالي الفواتير"
          value={displayed.length}
          color="bg-[#1a365d]"
        />
        <SummaryChip
          icon={DollarSign}
          label="الإيرادات"
          value={fmt(totalRevenue)}
          color="bg-blue-500"
        />
        <SummaryChip
          icon={CheckCircle2}
          label="المحصّل"
          value={fmt(totalPaid)}
          color="bg-green-500"
        />
        <SummaryChip
          icon={AlertTriangle}
          label="المتبقي"
          value={fmt(totalOutstanding)}
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

      {/* جدول الفواتير */}
      {!loading && !error && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {displayed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-300">
              <Receipt size={48} className="mb-4" />
              <p className="text-sm font-bold text-slate-400">لا توجد فواتير في هذه الفترة</p>
              <button
                onClick={openCreate}
                className="mt-4 flex items-center gap-2 bg-[#1a365d] text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-[#2d5299] transition-colors"
              >
                <Plus size={14} />
                أنشئ أول فاتورة
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['رقم الفاتورة', 'التاريخ', 'العميل', 'الإجمالي', 'المدفوع', 'المتبقي', 'الحالة', 'إجراءات'].map(h => (
                      <th key={h} className="px-4 py-3 text-right text-xs font-black text-slate-400 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((inv, idx) => {
                    const remaining = (parseFloat(inv.total) || 0) - (parseFloat(inv.paid) || 0);
                    return (
                      <tr
                        key={inv.id}
                        className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}
                      >
                        <td className="px-4 py-3">
                          <span className="bg-[#1a365d]/10 text-[#1a365d] px-2 py-0.5 rounded-lg text-xs font-black">
                            #{inv.no || inv.id}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500 font-medium whitespace-nowrap">{inv.date || '—'}</td>
                        <td className="px-4 py-3 text-xs text-slate-700 font-bold">{inv.client || '—'}</td>
                        <td className="px-4 py-3 text-xs font-black text-slate-700 whitespace-nowrap">{fmt(inv.total, inv.currency)}</td>
                        <td className="px-4 py-3 text-xs font-bold text-green-600 whitespace-nowrap">{fmt(inv.paid, inv.currency)}</td>
                        <td className="px-4 py-3 text-xs font-bold text-amber-600 whitespace-nowrap">{fmt(remaining, inv.currency)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge total={inv.total} paid={inv.paid} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => openDetail(inv)}
                              title="عرض"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => openEdit(inv)}
                              title="تعديل"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-[#c5a059] hover:bg-amber-50 transition-colors"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button
                              onClick={() => setConfirmId(inv.id)}
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
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // عرض: تفاصيل الفاتورة
  // ════════════════════════════════════════════════════════════
  const DetailView = () => {
    if (!selected) return null;
    const inv        = selected;
    const remaining  = (parseFloat(inv.total) || 0) - (parseFloat(inv.paid) || 0);
    const st         = invoiceStatus(inv.total, inv.paid);
    const currency   = inv.currency || 'SAR';

    return (
      <div>
        {/* رجوع */}
        <button
          onClick={() => setView('list')}
          className="flex items-center gap-2 text-slate-500 hover:text-[#1a365d] font-bold text-sm mb-5 transition-colors"
        >
          <ChevronLeft size={16} />
          رجوع إلى القائمة
        </button>

        {/* بطاقة الرأس */}
        <div className="bg-gradient-to-br from-[#1a365d] to-[#2d5299] rounded-2xl p-6 mb-5 shadow-xl text-white">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Receipt size={18} className="text-[#c5a059]" />
                <span className="text-[#c5a059] font-black text-lg">#{inv.no || inv.id}</span>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <User size={14} className="text-white/60" />
                <span className="text-sm font-bold">{inv.client || '—'}</span>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <Calendar size={14} className="text-white/60" />
                <span className="text-sm text-white/80">{inv.date || '—'}</span>
              </div>
              {inv.work_order_id && (
                <div className="flex items-center gap-2 mt-1.5">
                  <FileText size={14} className="text-white/60" />
                  <span className="text-xs text-white/70">مشروع #{inv.work_order_id}</span>
                </div>
              )}
            </div>
            <span className={`px-3 py-1.5 rounded-xl text-sm font-black border ${st.cls}`}>
              {st.label}
            </span>
          </div>
        </div>

        {/* ملاحظات */}
        {inv.notes && (
          <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 mb-5 text-sm text-amber-800 font-medium">
            {inv.notes}
          </div>
        )}

        {/* بنود الفاتورة */}
        {Array.isArray(inv.items) && inv.items.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 mb-5 overflow-hidden">
            <div className="px-5 py-3 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-black text-[#1a365d]">بنود الفاتورة</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    {['البند', 'الكمية', 'السعر', 'الخصم', 'الضريبة', 'الإجمالي'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-right text-xs font-black text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {inv.items.map((it, idx) => (
                    <tr key={idx} className="border-b border-slate-50">
                      <td className="px-4 py-3 text-xs font-bold text-slate-700">{it.name}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{it.quantity}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{fmt(it.unit_price, currency)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{it.discount || 0}%</td>
                      <td className="px-4 py-3 text-xs text-slate-500">{it.tax ?? 15}%</td>
                      <td className="px-4 py-3 text-xs font-black text-slate-700">{fmt(lineTotal(it), currency)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* الملخص المالي */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-5">
          <h3 className="text-sm font-black text-[#1a365d] mb-4">الملخص المالي</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400 font-medium">المجموع قبل الضريبة</span>
              <span className="font-bold text-slate-700">{fmt(inv.total, currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400 font-medium">المدفوع</span>
              <span className="font-bold text-green-600">{fmt(inv.paid, currency)}</span>
            </div>
            <div className="border-t border-slate-100 pt-3 flex justify-between">
              <span className="text-sm font-black text-slate-700">المتبقي</span>
              <span className={`text-base font-black ${remaining > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {fmt(remaining, currency)}
              </span>
            </div>
          </div>
        </div>

        {/* أزرار الإجراءات */}
        <div className="flex gap-3">
          <button
            onClick={() => openEdit(inv)}
            className="flex items-center gap-2 bg-[#1a365d] hover:bg-[#2d5299] text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-colors"
          >
            <Edit3 size={15} />
            تعديل الفاتورة
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors"
          >
            <Printer size={15} />
            طباعة
          </button>
        </div>
      </div>
    );
  };

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
        رجوع
      </button>

      <h2 className="text-lg font-black text-[#1a365d] mb-6">
        {view === 'edit' ? 'تعديل الفاتورة' : 'فاتورة جديدة'}
      </h2>

      {/* قسم: معلومات الفاتورة */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-5">
        <h3 className="text-sm font-black text-[#1a365d] mb-4 flex items-center gap-2">
          <User size={15} className="text-[#c5a059]" />
          معلومات الفاتورة
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* العميل */}
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-500 mb-1">العميل <span className="text-red-500">*</span></label>
            <select
              value={form.client_id}
              onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))}
              className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d] bg-white"
            >
              <option value="">— اختر العميل —</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
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

      {/* قسم: بنود الفاتورة */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-black text-[#1a365d] flex items-center gap-2">
            <FileText size={15} className="text-[#c5a059]" />
            بنود الفاتورة
          </h3>
          <button
            onClick={addItem}
            className="flex items-center gap-1.5 text-xs bg-[#1a365d]/10 hover:bg-[#1a365d]/20 text-[#1a365d] px-3 py-1.5 rounded-xl font-bold transition-colors"
          >
            <Plus size={13} />
            أضف بند
          </button>
        </div>

        <div className="space-y-3">
          {form.items.map((item, idx) => (
            <div key={idx} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <div className="flex items-start gap-3 mb-3">
                <div className="flex-1">
                  <label className="block text-xs font-bold text-slate-400 mb-1">اختر منتجاً (اختياري)</label>
                  <select
                    value=""
                    onChange={e => { if (e.target.value) applyProduct(idx, e.target.value); }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 bg-white"
                  >
                    <option value="">— تعبئة من قائمة المنتجات —</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>{p.name} — {fmt(p.price)}</option>
                    ))}
                  </select>
                </div>
                {form.items.length > 1 && (
                  <button
                    onClick={() => removeItem(idx)}
                    className="mt-5 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* اسم البند */}
                <div className="col-span-2 md:col-span-3 lg:col-span-2">
                  <label className="block text-xs font-bold text-slate-400 mb-1">اسم البند <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    placeholder="وصف الخدمة أو المنتج"
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

              {/* إجمالي السطر */}
              <div className="mt-2 text-left">
                <span className="text-xs text-slate-400 font-medium">إجمالي البند: </span>
                <span className="text-sm font-black text-[#1a365d]">{fmt(lineTotal(item), form.currency)}</span>
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
            <span className="font-bold text-slate-700">{fmt(subtotal, form.currency)}</span>
          </div>
          {totalDisc > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-400 font-medium">إجمالي الخصم</span>
              <span className="font-bold text-red-500">- {fmt(totalDisc, form.currency)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-slate-400 font-medium">إجمالي الضريبة</span>
            <span className="font-bold text-slate-600">{fmt(totalTax, form.currency)}</span>
          </div>
          <div className="border-t border-slate-200 pt-2.5 flex justify-between">
            <span className="text-sm font-black text-[#1a365d]">الإجمالي الكلي</span>
            <span className="text-lg font-black text-[#1a365d]">{fmt(grandTotal, form.currency)}</span>
          </div>
        </div>
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
            حفظ الفاتورة
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
        <Toast
          msg={toast.msg}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {/* مربع تأكيد الحذف */}
      {confirmId && (
        <ConfirmDialog
          msg="هل أنت متأكد من حذف هذه الفاتورة؟ لا يمكن التراجع عن هذا الإجراء."
          onConfirm={() => handleDelete(confirmId)}
          onCancel={() => setConfirmId(null)}
        />
      )}

      {/* المحتوى */}
      {view === 'list'            && <ListView />}
      {view === 'detail'          && <DetailView />}
      {(view === 'create' || view === 'edit') && <FormView />}
    </div>
  );
}
