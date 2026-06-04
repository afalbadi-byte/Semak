import React, { useState, useEffect, useCallback } from 'react';
import {
  Landmark, RefreshCw, ArrowUpCircle, ArrowDownCircle, ChevronRight,
  Plus, X, CheckCircle, AlertCircle, Loader2, Calendar, FileText
} from 'lucide-react';

const API_URL = "https://semak.sa/api.php";

const fmt = (n, currency = 'SAR') =>
  Number(n || 0).toLocaleString('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) +
  ' ' + currency;

const today = () => new Date().toISOString().slice(0, 10);

/* ─── Toast-like inline banner ─── */
function Banner({ msg, type, onClose }) {
  if (!msg) return null;
  const isErr = type === 'error';
  return (
    <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium mb-4
      ${isErr ? 'bg-red-900/40 border border-red-500/40 text-red-300' : 'bg-emerald-900/40 border border-emerald-500/40 text-emerald-300'}`}>
      {isErr ? <AlertCircle size={16} /> : <CheckCircle size={16} />}
      <span className="flex-1">{msg}</span>
      <button onClick={onClose} className="opacity-60 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

/* ─── Quick-add transaction form (reused in overview + detail) ─── */
function TransactionForm({ treasuries, defaultTreasuryId, onSuccess, onCancel, compact = false }) {
  const [form, setForm] = useState({
    treasury_id: defaultTreasuryId || (treasuries[0]?.id ?? ''),
    type: 'in',
    amount: '',
    notes: '',
    date: today(),
  });
  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.treasury_id || !form.amount || !form.date) {
      setBanner({ msg: 'يرجى ملء الحقول المطلوبة', type: 'error' });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${API_URL}?action=daftra_treasury_add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: parseFloat(form.amount) }),
      });
      const data = await res.json();
      if (data.success) {
        setBanner({ msg: 'تمت الإضافة بنجاح', type: 'success' });
        setForm(f => ({ ...f, amount: '', notes: '', date: today() }));
        onSuccess && onSuccess();
      } else {
        setBanner({ msg: data.message || 'حدث خطأ أثناء الحفظ', type: 'error' });
      }
    } catch {
      setBanner({ msg: 'تعذّر الاتصال بالخادم', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={`bg-[#0f2240] border border-[#c5a059]/20 rounded-xl p-4 ${compact ? '' : 'mt-4'}`}>
      {banner && <Banner msg={banner.msg} type={banner.type} onClose={() => setBanner(null)} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {/* Treasury select – only shown when not locked to a detail view */}
        {!defaultTreasuryId && (
          <select
            value={form.treasury_id}
            onChange={e => set('treasury_id', e.target.value)}
            className="col-span-2 sm:col-span-1 bg-[#1a365d] border border-[#c5a059]/30 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#c5a059]"
          >
            <option value="">اختر الخزينة</option>
            {treasuries.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}

        {/* Type buttons */}
        <div className="flex gap-2 col-span-2 sm:col-span-1">
          <button
            onClick={() => set('type', 'in')}
            className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm font-bold border transition-all
              ${form.type === 'in'
                ? 'bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/30'
                : 'bg-[#1a365d] border-[#c5a059]/20 text-gray-400 hover:border-emerald-500/50'}`}
          >
            <ArrowUpCircle size={14} /> دخل
          </button>
          <button
            onClick={() => set('type', 'out')}
            className={`flex-1 flex items-center justify-center gap-1 px-3 py-2 rounded-lg text-sm font-bold border transition-all
              ${form.type === 'out'
                ? 'bg-red-600 border-red-500 text-white shadow-lg shadow-red-900/30'
                : 'bg-[#1a365d] border-[#c5a059]/20 text-gray-400 hover:border-red-500/50'}`}
          >
            <ArrowDownCircle size={14} /> صرف
          </button>
        </div>

        {/* Amount */}
        <input
          type="number"
          min="0"
          step="0.01"
          placeholder="المبلغ *"
          value={form.amount}
          onChange={e => set('amount', e.target.value)}
          className="bg-[#1a365d] border border-[#c5a059]/30 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#c5a059] placeholder-gray-500"
        />

        {/* Notes */}
        <input
          type="text"
          placeholder="الملاحظات"
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          className="col-span-2 sm:col-span-1 bg-[#1a365d] border border-[#c5a059]/30 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#c5a059] placeholder-gray-500"
        />

        {/* Date */}
        <input
          type="date"
          value={form.date}
          onChange={e => set('date', e.target.value)}
          className="bg-[#1a365d] border border-[#c5a059]/30 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#c5a059]"
        />

        {/* Submit */}
        <div className="flex gap-2">
          <button
            onClick={submit}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 bg-[#c5a059] hover:bg-[#d4b06a] disabled:opacity-50 text-[#1a365d] font-bold rounded-lg px-4 py-2 text-sm transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            إضافة
          </button>
          {onCancel && (
            <button
              onClick={onCancel}
              className="px-3 py-2 rounded-lg border border-[#c5a059]/20 text-gray-400 hover:text-white text-sm transition-colors"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Treasury card ─── */
function TreasuryCard({ treasury, onClick }) {
  const bal = parseFloat(treasury.balance || 0);
  const positive = bal >= 0;
  return (
    <button
      onClick={onClick}
      className="group bg-[#0f2240] border border-[#c5a059]/20 hover:border-[#c5a059]/60 rounded-2xl p-6 text-right transition-all hover:shadow-xl hover:shadow-[#c5a059]/5 hover:-translate-y-0.5 w-full"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="w-10 h-10 rounded-xl bg-[#1a365d] border border-[#c5a059]/30 flex items-center justify-center group-hover:border-[#c5a059]/70 transition-colors">
          <Landmark size={18} className="text-[#c5a059]" />
        </div>
        <div>
          <p className="text-gray-400 text-xs mb-0.5">الخزينة</p>
          <p className="text-white font-bold text-base">{treasury.name}</p>
        </div>
      </div>

      <div className="mt-2">
        <p className="text-gray-500 text-xs mb-1">الرصيد الحالي</p>
        <p className={`text-2xl font-black tracking-tight ${positive ? 'text-emerald-400' : 'text-red-400'}`}>
          {fmt(bal, treasury.currency || 'SAR')}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-[#c5a059]/10 flex items-center justify-between">
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full
          ${treasury.status === 'active' ? 'bg-emerald-900/40 text-emerald-400' : 'bg-gray-700/40 text-gray-400'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${treasury.status === 'active' ? 'bg-emerald-400' : 'bg-gray-500'}`} />
          {treasury.status === 'active' ? 'نشطة' : 'غير نشطة'}
        </span>
        <span className="text-[#c5a059] text-xs opacity-0 group-hover:opacity-100 transition-opacity">
          عرض المعاملات ←
        </span>
      </div>
    </button>
  );
}

/* ─── OVERVIEW VIEW ─── */
function OverviewView({ treasuries, onSelectTreasury, onRefresh, loading }) {
  const [showQuickForm, setShowQuickForm] = useState(false);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#c5a059]/10 border border-[#c5a059]/30 flex items-center justify-center">
            <Landmark size={20} className="text-[#c5a059]" />
          </div>
          <div>
            <h1 className="text-white text-xl font-bold">الخزاين</h1>
            <p className="text-gray-500 text-xs">إدارة الخزاين والمعاملات المالية</p>
          </div>
        </div>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-[#1a365d] border border-[#c5a059]/30 hover:border-[#c5a059]/60 rounded-xl text-[#c5a059] text-sm font-medium transition-all"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          تحديث
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-[#c5a059]" />
        </div>
      )}

      {/* Treasury grid */}
      {!loading && treasuries.length === 0 && (
        <div className="text-center py-16 text-gray-500">
          <Landmark size={40} className="mx-auto mb-3 opacity-30" />
          <p>لا توجد خزاين محملة</p>
        </div>
      )}

      {!loading && treasuries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          {treasuries.map(t => (
            <TreasuryCard key={t.id} treasury={t} onClick={() => onSelectTreasury(t)} />
          ))}
        </div>
      )}

      {/* Quick transaction section */}
      <div className="bg-[#0f2240] border border-[#c5a059]/20 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Plus size={16} className="text-[#c5a059]" />
            <h2 className="text-white font-semibold text-sm">إضافة معاملة سريعة</h2>
          </div>
          {!showQuickForm && (
            <button
              onClick={() => setShowQuickForm(true)}
              className="text-xs text-[#c5a059] hover:underline"
            >
              فتح النموذج
            </button>
          )}
        </div>

        {showQuickForm ? (
          <TransactionForm
            treasuries={treasuries}
            onSuccess={() => { onRefresh(); }}
            onCancel={() => setShowQuickForm(false)}
          />
        ) : (
          <p className="text-gray-500 text-xs mt-2">اضغط لإضافة دخل أو صرف سريع دون فتح الخزينة</p>
        )}
      </div>
    </div>
  );
}

/* ─── DETAIL VIEW ─── */
function DetailView({ treasury, onBack, onRefresh }) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  });
  const [toDate, setToDate] = useState(today);

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_URL}?action=daftra_treasury_transactions&treasury_id=${treasury.id}&from=${fromDate}&to=${toDate}`
      );
      const data = await res.json();
      if (data.success) {
        setTransactions(Array.isArray(data.data) ? data.data : []);
      } else {
        setError(data.message || 'فشل تحميل المعاملات');
      }
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }, [treasury.id, fromDate, toDate]);

  useEffect(() => { fetchTransactions(); }, [fetchTransactions]);

  /* calculate running balance from transactions (sorted ascending by date) */
  const sorted = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
  let runningBal = 0;
  const withBalance = sorted.map(tx => {
    runningBal += tx.type === 'in' ? parseFloat(tx.amount || 0) : -parseFloat(tx.amount || 0);
    return { ...tx, runningBalance: runningBal };
  }).reverse(); // show newest first in table

  const totalIn = transactions.filter(t => t.type === 'in').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const totalOut = transactions.filter(t => t.type === 'out').reduce((s, t) => s + parseFloat(t.amount || 0), 0);
  const currency = treasury.currency || 'SAR';
  const bal = parseFloat(treasury.balance || 0);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-3 py-2 bg-[#1a365d] border border-[#c5a059]/30 hover:border-[#c5a059]/60 rounded-xl text-[#c5a059] text-sm transition-all"
        >
          <ChevronRight size={16} />
          رجوع
        </button>
        <div className="flex-1">
          <h1 className="text-white text-xl font-bold">{treasury.name}</h1>
          <p className={`text-sm font-semibold ${bal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            الرصيد: {fmt(bal, currency)}
          </p>
        </div>
        <button
          onClick={() => setShowForm(s => !s)}
          className="flex items-center gap-2 px-4 py-2 bg-[#c5a059] hover:bg-[#d4b06a] text-[#1a365d] font-bold rounded-xl text-sm transition-colors"
        >
          <Plus size={14} />
          إضافة معاملة
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <TransactionForm
          treasuries={[treasury]}
          defaultTreasuryId={treasury.id}
          onSuccess={() => { fetchTransactions(); onRefresh(); }}
          onCancel={() => setShowForm(false)}
          compact
        />
      )}

      {/* Summary chips */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        <div className="bg-emerald-900/20 border border-emerald-500/20 rounded-xl p-3 text-center">
          <p className="text-gray-400 text-xs mb-1">إجمالي الدخل</p>
          <p className="text-emerald-400 font-bold text-sm">{fmt(totalIn, currency)}</p>
        </div>
        <div className="bg-red-900/20 border border-red-500/20 rounded-xl p-3 text-center">
          <p className="text-gray-400 text-xs mb-1">إجمالي الصرف</p>
          <p className="text-red-400 font-bold text-sm">{fmt(totalOut, currency)}</p>
        </div>
        <div className="bg-[#c5a059]/10 border border-[#c5a059]/20 rounded-xl p-3 text-center">
          <p className="text-gray-400 text-xs mb-1">عدد المعاملات</p>
          <p className="text-[#c5a059] font-bold text-sm">{transactions.length}</p>
        </div>
      </div>

      {/* Date filter */}
      <div className="flex items-center gap-3 mb-5 bg-[#0f2240] border border-[#c5a059]/20 rounded-xl p-4">
        <Calendar size={16} className="text-[#c5a059] shrink-0" />
        <span className="text-gray-400 text-sm">من:</span>
        <input
          type="date"
          value={fromDate}
          onChange={e => setFromDate(e.target.value)}
          className="bg-[#1a365d] border border-[#c5a059]/30 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#c5a059]"
        />
        <span className="text-gray-400 text-sm">إلى:</span>
        <input
          type="date"
          value={toDate}
          onChange={e => setToDate(e.target.value)}
          className="bg-[#1a365d] border border-[#c5a059]/30 text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#c5a059]"
        />
        <button
          onClick={fetchTransactions}
          disabled={loading}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-[#c5a059] hover:bg-[#d4b06a] text-[#1a365d] font-bold rounded-lg text-sm transition-colors"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          بحث
        </button>
      </div>

      {/* Error */}
      {error && <Banner msg={error} type="error" onClose={() => setError(null)} />}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={28} className="animate-spin text-[#c5a059]" />
        </div>
      ) : withBalance.length === 0 ? (
        <div className="text-center py-14 text-gray-500 bg-[#0f2240] border border-[#c5a059]/10 rounded-2xl">
          <FileText size={36} className="mx-auto mb-3 opacity-30" />
          <p>لا توجد معاملات في هذه الفترة</p>
        </div>
      ) : (
        <div className="bg-[#0f2240] border border-[#c5a059]/20 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#c5a059]/20 bg-[#1a365d]/60">
                  <th className="text-right text-[#c5a059] font-semibold px-4 py-3">التاريخ</th>
                  <th className="text-right text-[#c5a059] font-semibold px-4 py-3">النوع</th>
                  <th className="text-right text-[#c5a059] font-semibold px-4 py-3">المبلغ</th>
                  <th className="text-right text-[#c5a059] font-semibold px-4 py-3">الرصيد المتراكم</th>
                  <th className="text-right text-[#c5a059] font-semibold px-4 py-3">الملاحظات</th>
                </tr>
              </thead>
              <tbody>
                {withBalance.map((tx, i) => (
                  <tr
                    key={tx.id || i}
                    className="border-b border-[#c5a059]/10 hover:bg-[#1a365d]/30 transition-colors"
                  >
                    <td className="px-4 py-3 text-gray-300 whitespace-nowrap">{tx.date}</td>
                    <td className="px-4 py-3">
                      {tx.type === 'in' ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-900/30 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full text-xs font-bold">
                          <ArrowUpCircle size={11} /> دخل
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-red-900/30 text-red-400 border border-red-500/30 px-2 py-0.5 rounded-full text-xs font-bold">
                          <ArrowDownCircle size={11} /> صرف
                        </span>
                      )}
                    </td>
                    <td className={`px-4 py-3 font-semibold whitespace-nowrap ${tx.type === 'in' ? 'text-emerald-400' : 'text-red-400'}`}>
                      {tx.type === 'out' ? '−' : '+'}{fmt(tx.amount, currency)}
                    </td>
                    <td className={`px-4 py-3 font-mono text-xs whitespace-nowrap ${tx.runningBalance >= 0 ? 'text-gray-300' : 'text-red-400'}`}>
                      {fmt(tx.runningBalance, currency)}
                    </td>
                    <td className="px-4 py-3 text-gray-400 max-w-xs truncate">{tx.notes || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── ROOT COMPONENT ─── */
export default function TreasuryManage({ showToast }) {
  const [view, setView] = useState('overview'); // 'overview' | 'detail'
  const [treasuries, setTreasuries] = useState([]);
  const [selectedTreasury, setSelectedTreasury] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTreasuries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}?action=daftra_treasuries`);
      const data = await res.json();
      if (data.success) {
        setTreasuries(Array.isArray(data.data) ? data.data : []);
      } else {
        setError(data.message || 'فشل تحميل الخزاين');
      }
    } catch {
      setError('تعذّر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTreasuries(); }, [fetchTreasuries]);

  const handleSelectTreasury = (t) => {
    setSelectedTreasury(t);
    setView('detail');
  };

  const handleBack = () => {
    setView('overview');
    setSelectedTreasury(null);
    fetchTreasuries();
  };

  return (
    <div dir="rtl" className="min-h-screen bg-[#0d1f38] p-4 sm:p-6 font-[Cairo,sans-serif]">
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap');`}</style>

      <div className="max-w-5xl mx-auto">
        {error && view === 'overview' && (
          <Banner msg={error} type="error" onClose={() => setError(null)} />
        )}

        {view === 'overview' && (
          <OverviewView
            treasuries={treasuries}
            onSelectTreasury={handleSelectTreasury}
            onRefresh={fetchTreasuries}
            loading={loading}
          />
        )}

        {view === 'detail' && selectedTreasury && (
          <DetailView
            treasury={selectedTreasury}
            onBack={handleBack}
            onRefresh={fetchTreasuries}
          />
        )}
      </div>
    </div>
  );
}
