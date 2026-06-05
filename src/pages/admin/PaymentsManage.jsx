import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowDownCircle, ArrowUpCircle, Plus, Calendar, DollarSign,
  Wallet, RefreshCw, AlertTriangle, CheckCircle2, X, Search,
  CreditCard, User, FileText
} from 'lucide-react';

import { API_URL } from '../../lib/api/client';

// ─── تنسيق الأرقام ───────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(n) || 0) +
  ' ر.س';

// ─── اليوم بتنسيق YYYY-MM-DD ─────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);

// ─── طرق الدفع ───────────────────────────────────────────────────
const METHODS = [
  { value: 'cash',   label: 'نقدي' },
  { value: 'bank',   label: 'تحويل بنكي' },
  { value: 'cheque', label: 'شيك' },
  { value: 'card',   label: 'بطاقة' },
];
const methodLabel = (m) => (METHODS.find(x => x.value === m) || {}).label || m || '—';

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

// ════════════════════════════════════════════════════════════════
// المكوّن الرئيسي
// ════════════════════════════════════════════════════════════════
export default function PaymentsManage() {
  // ─── التبويب النشط ───────────────────────────────────────────
  const [tab, setTab] = useState('collection'); // collection | payments

  // ─── حالة عامة ───────────────────────────────────────────────
  const [toast, setToast] = useState(null);
  const notify = (msg, type = 'success') => setToast({ msg, type });

  // ─── القوائم المنسدلة ────────────────────────────────────────
  const [treasuries, setTreasuries] = useState([]);
  const [suppliers, setSuppliers]   = useState([]);

  // ─── تبويب التحصيل (دفعات العملاء) ───────────────────────────
  const [collRows, setCollRows]       = useState([]);
  const [collLoaded, setCollLoaded]   = useState(false);
  const [collLoading, setCollLoading] = useState(false);
  const [collError, setCollError]     = useState('');
  const [collFilters, setCollFilters] = useState({ from: '', to: '' });
  const [collForm, setCollForm]       = useState(false);
  const [collSaving, setCollSaving]   = useState(false);

  // ─── تبويب المدفوعات (دفعات الموردين) ────────────────────────
  const [payRows, setPayRows]       = useState([]);
  const [payLoaded, setPayLoaded]   = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [payError, setPayError]     = useState('');
  const [payFilters, setPayFilters] = useState({ from: '', to: '' });
  const [payForm, setPayForm]       = useState(false);
  const [paySaving, setPaySaving]   = useState(false);

  // ─── نماذج الإدخال ───────────────────────────────────────────
  const emptyCollForm = () => ({ invoice_id: '', amount: '', date: today(), treasury_id: '', method: 'cash', notes: '' });
  const emptyPayForm  = () => ({ purchase_id: '', supplier_id: '', amount: '', date: today(), treasury_id: '', method: 'cash', notes: '' });
  const [collData, setCollData] = useState(emptyCollForm());
  const [payData, setPayData]   = useState(emptyPayForm());

  // ─── جلب القوائم المنسدلة ────────────────────────────────────
  const loadDropdowns = useCallback(async () => {
    try {
      const [tRes, sRes] = await Promise.all([
        fetch(`${API_URL}?action=daftra_treasuries`),
        fetch(`${API_URL}?action=daftra_suppliers_list`),
      ]);
      const [tData, sData] = await Promise.all([tRes.json(), sRes.json()]);
      if (tData.success !== false && Array.isArray(tData.data)) setTreasuries(tData.data);
      if (sData.success !== false && Array.isArray(sData.data)) setSuppliers(sData.data);
    } catch { /* تجاهل أخطاء القوائم المنسدلة */ }
  }, []);

  useEffect(() => {
    loadDropdowns();
  }, [loadDropdowns]);

  // ─── تحميل دفعات العملاء ──────────────────────────────────────
  const loadCollection = useCallback(async (f = collFilters) => {
    setCollLoading(true);
    setCollError('');
    try {
      let url = `${API_URL}?action=daftra_invoice_payments_list&page=1`;
      if (f.from) url += `&from=${f.from}`;
      if (f.to)   url += `&to=${f.to}`;
      const res  = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setCollRows(data.data);
      } else {
        setCollRows([]);
        setCollError(data.message || 'فشل تحميل الدفعات');
      }
    } catch {
      setCollError('خطأ في الاتصال بالخادم');
    } finally {
      setCollLoading(false);
      setCollLoaded(true);
    }
  }, [collFilters]);

  // ─── تحميل دفعات الموردين ─────────────────────────────────────
  const loadPayments = useCallback(async (f = payFilters) => {
    setPayLoading(true);
    setPayError('');
    try {
      let url = `${API_URL}?action=daftra_supplier_payments_list&page=1`;
      if (f.from) url += `&from=${f.from}`;
      if (f.to)   url += `&to=${f.to}`;
      const res  = await fetch(url);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setPayRows(data.data);
      } else {
        setPayRows([]);
        setPayError(data.message || 'فشل تحميل الدفعات');
      }
    } catch {
      setPayError('خطأ في الاتصال بالخادم');
    } finally {
      setPayLoading(false);
      setPayLoaded(true);
    }
  }, [payFilters]);

  // ─── تحميل كسول لكل تبويب عند أول تفعيل ───────────────────────
  useEffect(() => {
    if (tab === 'collection' && !collLoaded) loadCollection();
    if (tab === 'payments'   && !payLoaded)  loadPayments();
  }, [tab, collLoaded, payLoaded, loadCollection, loadPayments]);

  // ─── ملخصات ──────────────────────────────────────────────────
  const collCount = collRows.length;
  const collTotal = collRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
  const payCount  = payRows.length;
  const payTotal  = payRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);

  // ─── حفظ تحصيل (دفعة عميل) ────────────────────────────────────
  const handleSaveCollection = async () => {
    if (!collData.invoice_id) return notify('يرجى إدخال رقم الفاتورة', 'error');
    if (!collData.amount || parseFloat(collData.amount) <= 0) return notify('يرجى إدخال مبلغ صحيح', 'error');

    setCollSaving(true);
    try {
      const payload = {
        invoice_id:  collData.invoice_id,
        amount:      collData.amount,
        date:        collData.date,
        treasury_id: collData.treasury_id,
        method:      collData.method,
        notes:       collData.notes || '',
      };
      const res  = await fetch(`${API_URL}?action=daftra_invoice_payment_add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        notify('تم تسجيل الدفعة');
        setCollData(emptyCollForm());
        setCollForm(false);
        loadCollection();
      } else {
        notify(data.message || 'فشل تسجيل الدفعة', 'error');
      }
    } catch {
      notify('خطأ في الاتصال بالخادم', 'error');
    } finally {
      setCollSaving(false);
    }
  };

  // ─── حفظ صرف (دفعة مورد) ──────────────────────────────────────
  const handleSavePayment = async () => {
    if (!payData.purchase_id) return notify('يرجى إدخال رقم فاتورة الشراء', 'error');
    if (!payData.amount || parseFloat(payData.amount) <= 0) return notify('يرجى إدخال مبلغ صحيح', 'error');

    setPaySaving(true);
    try {
      const payload = {
        purchase_id: payData.purchase_id,
        supplier_id: payData.supplier_id || '',
        amount:      payData.amount,
        date:        payData.date,
        treasury_id: payData.treasury_id,
        method:      payData.method,
        notes:       payData.notes || '',
      };
      const res  = await fetch(`${API_URL}?action=daftra_supplier_payment_add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        notify('تم تسجيل الصرف');
        setPayData(emptyPayForm());
        setPayForm(false);
        loadPayments();
      } else {
        notify(data.message || 'فشل تسجيل الصرف', 'error');
      }
    } catch {
      notify('خطأ في الاتصال بالخادم', 'error');
    } finally {
      setPaySaving(false);
    }
  };

  // ─── حقول مشتركة للنموذج ──────────────────────────────────────
  const inputCls = "w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d] bg-white";

  // ════════════════════════════════════════════════════════════
  // نموذج تسجيل تحصيل
  // ════════════════════════════════════════════════════════════
  const CollectionForm = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-black text-[#1a365d] flex items-center gap-2">
          <ArrowDownCircle size={16} className="text-green-600" />
          تسجيل تحصيل
        </h3>
        <button
          onClick={() => setCollForm(false)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* رقم الفاتورة */}
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">رقم الفاتورة <span className="text-red-500">*</span></label>
          <div className="relative">
            <FileText size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="number"
              placeholder="مثال: 1024"
              value={collData.invoice_id}
              onChange={e => setCollData(d => ({ ...d, invoice_id: e.target.value }))}
              className={`${inputCls} pr-8`}
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
              value={collData.amount}
              onChange={e => setCollData(d => ({ ...d, amount: e.target.value }))}
              className={`${inputCls} pr-8`}
            />
          </div>
        </div>

        {/* التاريخ */}
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">التاريخ</label>
          <div className="relative">
            <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="date"
              value={collData.date}
              onChange={e => setCollData(d => ({ ...d, date: e.target.value }))}
              className={`${inputCls} pr-8`}
            />
          </div>
        </div>

        {/* الخزينة */}
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">الخزينة</label>
          <select
            value={collData.treasury_id}
            onChange={e => setCollData(d => ({ ...d, treasury_id: e.target.value }))}
            className={inputCls}
          >
            <option value="">— اختر الخزينة —</option>
            {treasuries.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}{t.balance != null ? ` (${fmt(t.balance)})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* طريقة الدفع */}
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">طريقة الدفع</label>
          <select
            value={collData.method}
            onChange={e => setCollData(d => ({ ...d, method: e.target.value }))}
            className={inputCls}
          >
            {METHODS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* ملاحظات */}
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-500 mb-1">ملاحظات</label>
          <textarea
            rows={2}
            placeholder="ملاحظات إضافية..."
            value={collData.notes}
            onChange={e => setCollData(d => ({ ...d, notes: e.target.value }))}
            className={`${inputCls} resize-none`}
          />
        </div>
      </div>

      <div className="flex gap-3 mt-5">
        <button
          onClick={handleSaveCollection}
          disabled={collSaving}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl font-black text-sm shadow-md transition-colors"
        >
          {collSaving ? (
            <><RefreshCw size={15} className="animate-spin" /> جاري الحفظ...</>
          ) : (
            <><CheckCircle2 size={15} /> تسجيل الدفعة</>
          )}
        </button>
        <button
          onClick={() => setCollForm(false)}
          className="px-6 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200 transition-colors"
        >
          إلغاء
        </button>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // نموذج تسجيل صرف
  // ════════════════════════════════════════════════════════════
  const PaymentForm = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-black text-[#1a365d] flex items-center gap-2">
          <ArrowUpCircle size={16} className="text-red-600" />
          تسجيل صرف
        </h3>
        <button
          onClick={() => setPayForm(false)}
          className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* رقم فاتورة الشراء */}
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">رقم فاتورة الشراء <span className="text-red-500">*</span></label>
          <div className="relative">
            <FileText size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="number"
              placeholder="مثال: 512"
              value={payData.purchase_id}
              onChange={e => setPayData(d => ({ ...d, purchase_id: e.target.value }))}
              className={`${inputCls} pr-8`}
            />
          </div>
        </div>

        {/* المورد */}
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">المورد (اختياري)</label>
          <div className="relative">
            <User size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 z-10" />
            <select
              value={payData.supplier_id}
              onChange={e => setPayData(d => ({ ...d, supplier_id: e.target.value }))}
              className={`${inputCls} pr-8`}
            >
              <option value="">— اختر المورد —</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
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
              value={payData.amount}
              onChange={e => setPayData(d => ({ ...d, amount: e.target.value }))}
              className={`${inputCls} pr-8`}
            />
          </div>
        </div>

        {/* التاريخ */}
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">التاريخ</label>
          <div className="relative">
            <Calendar size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300" />
            <input
              type="date"
              value={payData.date}
              onChange={e => setPayData(d => ({ ...d, date: e.target.value }))}
              className={`${inputCls} pr-8`}
            />
          </div>
        </div>

        {/* الخزينة */}
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">الخزينة</label>
          <select
            value={payData.treasury_id}
            onChange={e => setPayData(d => ({ ...d, treasury_id: e.target.value }))}
            className={inputCls}
          >
            <option value="">— اختر الخزينة —</option>
            {treasuries.map(t => (
              <option key={t.id} value={t.id}>
                {t.name}{t.balance != null ? ` (${fmt(t.balance)})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* طريقة الدفع */}
        <div>
          <label className="block text-xs font-bold text-slate-500 mb-1">طريقة الدفع</label>
          <select
            value={payData.method}
            onChange={e => setPayData(d => ({ ...d, method: e.target.value }))}
            className={inputCls}
          >
            {METHODS.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* ملاحظات */}
        <div className="md:col-span-2">
          <label className="block text-xs font-bold text-slate-500 mb-1">ملاحظات</label>
          <textarea
            rows={2}
            placeholder="ملاحظات إضافية..."
            value={payData.notes}
            onChange={e => setPayData(d => ({ ...d, notes: e.target.value }))}
            className={`${inputCls} resize-none`}
          />
        </div>
      </div>

      <div className="flex gap-3 mt-5">
        <button
          onClick={handleSavePayment}
          disabled={paySaving}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed text-white px-6 py-2.5 rounded-xl font-black text-sm shadow-md transition-colors"
        >
          {paySaving ? (
            <><RefreshCw size={15} className="animate-spin" /> جاري الحفظ...</>
          ) : (
            <><CheckCircle2 size={15} /> تسجيل الصرف</>
          )}
        </button>
        <button
          onClick={() => setPayForm(false)}
          className="px-6 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200 transition-colors"
        >
          إلغاء
        </button>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // شريط الفلاتر (تاريخ)
  // ════════════════════════════════════════════════════════════
  const DateFilter = ({ filters, setFilters, onApply }) => (
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
        <button
          onClick={onApply}
          className="flex items-center gap-2 bg-[#1a365d] hover:bg-[#2d5299] text-white px-4 py-2 rounded-xl font-bold text-sm transition-colors"
        >
          <Search size={14} />
          تصفية
        </button>
      </div>
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // تبويب التحصيل (دفعات العملاء)
  // ════════════════════════════════════════════════════════════
  const CollectionTab = () => (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg">
            <ArrowDownCircle size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-black text-[#1a365d]">التحصيل</h2>
            <p className="text-xs text-slate-400 font-medium">دفعات العملاء المحصّلة</p>
          </div>
        </div>
        <button
          onClick={() => { setCollData(emptyCollForm()); setCollForm(v => !v); }}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md transition-colors"
        >
          <Plus size={16} />
          تسجيل تحصيل
        </button>
      </div>

      {collForm && <CollectionForm />}

      <DateFilter filters={collFilters} setFilters={setCollFilters} onApply={() => loadCollection(collFilters)} />

      <div className="flex flex-wrap gap-3 mb-5">
        <SummaryChip icon={CreditCard}  label="عدد الدفعات"   value={collCount}        color="bg-[#1a365d]" />
        <SummaryChip icon={DollarSign}  label="إجمالي المحصّل" value={fmt(collTotal)}   color="bg-green-500" />
      </div>

      {collLoading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={28} className="text-[#1a365d] animate-spin" />
        </div>
      )}
      {collError && !collLoading && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 flex items-center gap-3 text-red-600 text-sm font-bold">
          <AlertTriangle size={16} />
          {collError}
        </div>
      )}

      {!collLoading && !collError && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {collRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-300">
              <ArrowDownCircle size={48} className="mb-4" />
              <p className="text-sm font-bold text-slate-400">لا توجد دفعات في هذه الفترة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-right">
                    {['التاريخ', 'رقم الفاتورة', 'العميل', 'المبلغ', 'طريقة الدفع', 'الخزينة', 'ملاحظات'].map(h => (
                      <th key={h} className="px-4 py-3 text-right text-xs font-black text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {collRows.map((r, idx) => (
                    <tr
                      key={r.id || idx}
                      className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}
                    >
                      <td className="px-4 py-3 text-xs text-slate-500 font-medium whitespace-nowrap">{r.date || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="bg-[#1a365d]/10 text-[#1a365d] px-2 py-0.5 rounded-lg text-xs font-black">
                          #{r.invoice_no || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700 font-bold">{r.client || '—'}</td>
                      <td className="px-4 py-3 text-xs font-black text-green-600 whitespace-nowrap">{fmt(r.amount)}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 font-medium whitespace-nowrap">{methodLabel(r.method)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 font-medium whitespace-nowrap">{r.treasury || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 font-medium max-w-[200px] truncate">{r.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );

  // ════════════════════════════════════════════════════════════
  // تبويب المدفوعات (دفعات الموردين)
  // ════════════════════════════════════════════════════════════
  const PaymentsTab = () => (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-red-500 rounded-2xl flex items-center justify-center shadow-lg">
            <ArrowUpCircle size={20} className="text-white" />
          </div>
          <div>
            <h2 className="text-lg font-black text-[#1a365d]">المدفوعات</h2>
            <p className="text-xs text-slate-400 font-medium">دفعات الموردين المصروفة</p>
          </div>
        </div>
        <button
          onClick={() => { setPayData(emptyPayForm()); setPayForm(v => !v); }}
          className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md transition-colors"
        >
          <Plus size={16} />
          تسجيل صرف
        </button>
      </div>

      {payForm && <PaymentForm />}

      <DateFilter filters={payFilters} setFilters={setPayFilters} onApply={() => loadPayments(payFilters)} />

      <div className="flex flex-wrap gap-3 mb-5">
        <SummaryChip icon={CreditCard}  label="عدد الدفعات"    value={payCount}      color="bg-[#1a365d]" />
        <SummaryChip icon={DollarSign}  label="إجمالي المصروف" value={fmt(payTotal)} color="bg-red-500" />
      </div>

      {payLoading && (
        <div className="flex items-center justify-center py-16">
          <RefreshCw size={28} className="text-[#1a365d] animate-spin" />
        </div>
      )}
      {payError && !payLoading && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-4 flex items-center gap-3 text-red-600 text-sm font-bold">
          <AlertTriangle size={16} />
          {payError}
        </div>
      )}

      {!payLoading && !payError && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {payRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-300">
              <ArrowUpCircle size={48} className="mb-4" />
              <p className="text-sm font-bold text-slate-400">لا توجد دفعات في هذه الفترة</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-right">
                    {['التاريخ', 'رقم فاتورة الشراء', 'المورد', 'المبلغ', 'طريقة الدفع', 'الخزينة', 'ملاحظات'].map(h => (
                      <th key={h} className="px-4 py-3 text-right text-xs font-black text-slate-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payRows.map((r, idx) => (
                    <tr
                      key={r.id || idx}
                      className={`border-b border-slate-50 hover:bg-slate-50/50 transition-colors ${idx % 2 === 0 ? '' : 'bg-slate-50/30'}`}
                    >
                      <td className="px-4 py-3 text-xs text-slate-500 font-medium whitespace-nowrap">{r.date || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="bg-[#1a365d]/10 text-[#1a365d] px-2 py-0.5 rounded-lg text-xs font-black">
                          #{r.purchase_id || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700 font-bold">{r.supplier || '—'}</td>
                      <td className="px-4 py-3 text-xs font-black text-red-600 whitespace-nowrap">{fmt(r.amount)}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 font-medium whitespace-nowrap">{methodLabel(r.method)}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 font-medium whitespace-nowrap">{r.treasury || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-400 font-medium max-w-[200px] truncate">{r.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
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

      {/* رأس الصفحة */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-gradient-to-br from-[#1a365d] to-[#2d5299] rounded-2xl flex items-center justify-center shadow-lg">
          <Wallet size={20} className="text-[#c5a059]" />
        </div>
        <div>
          <h1 className="text-xl font-black text-[#1a365d]">المدفوعات والتحصيل</h1>
          <p className="text-xs text-slate-400 font-medium">إدارة دفعات العملاء والموردين</p>
        </div>
      </div>

      {/* التبويبات */}
      <div className="flex gap-2 mb-6 bg-white rounded-2xl shadow-sm border border-slate-100 p-1.5 w-fit">
        <button
          onClick={() => setTab('collection')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-colors ${
            tab === 'collection'
              ? 'bg-green-600 text-white shadow-md'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <ArrowDownCircle size={16} />
          التحصيل
        </button>
        <button
          onClick={() => setTab('payments')}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-colors ${
            tab === 'payments'
              ? 'bg-red-600 text-white shadow-md'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          <ArrowUpCircle size={16} />
          المدفوعات
        </button>
      </div>

      {/* محتوى التبويب */}
      {tab === 'collection' ? <CollectionTab /> : <PaymentsTab />}
    </div>
  );
}
