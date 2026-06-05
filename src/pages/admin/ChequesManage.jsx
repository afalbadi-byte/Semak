import React, { useState, useEffect, useCallback } from 'react';
import {
  CreditCard, Search, Calendar, RefreshCw,
  AlertTriangle, CheckCircle2, X, ChevronDown,
  DollarSign, Building
} from 'lucide-react';
import ExportButton from '../../components/ExportButton';
import { fmt as fmtExport } from '../../utils/exporters';

import { API_URL } from '../../lib/api/client';

// ─── تنسيق الأرقام ───────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(n) || 0) + ' ر.س';

// ─── اليوم بتنسيق YYYY-MM-DD ─────────────────────────────────────
const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10);

// ─── تعريفات الحالات ──────────────────────────────────────────────
const STATUS_CONFIG = {
  pending:   { label: 'معلق',     cls: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  collected: { label: 'محصّل',    cls: 'bg-green-100 text-green-700 border-green-200'  },
  paid:      { label: 'مسدّد',    cls: 'bg-green-100 text-green-700 border-green-200'  },
  returned:  { label: 'مرتجع',   cls: 'bg-red-100 text-red-700 border-red-200'        },
  postponed: { label: 'مؤجل',    cls: 'bg-slate-100 text-slate-600 border-slate-200'  },
};

// أسماء الحالات المتوافقة مع نوع الشيك
const STATUS_OPTIONS_RECEIVABLE = [
  { value: 'pending',   label: 'معلق'   },
  { value: 'collected', label: 'محصّل'  },
  { value: 'returned',  label: 'مرتجع'  },
  { value: 'postponed', label: 'مؤجل'   },
];
const STATUS_OPTIONS_PAYABLE = [
  { value: 'pending',   label: 'معلق'   },
  { value: 'paid',      label: 'مسدّد'  },
  { value: 'returned',  label: 'مرتجع'  },
  { value: 'postponed', label: 'مؤجل'   },
];

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

// ─── شارة الحالة ─────────────────────────────────────────────────
function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || { label: status || '—', cls: 'bg-slate-100 text-slate-500 border-slate-200' };
  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

// ─── صف شيك مع تغيير الحالة ──────────────────────────────────────
function ChequeRow({ cheque, type, onStatusChange, updatingId }) {
  const c = cheque.Cheque || cheque;
  const id = c.id;
  const statusOptions = type === 'receivable' ? STATUS_OPTIONS_RECEIVABLE : STATUS_OPTIONS_PAYABLE;
  const currentStatus = c.status || 'pending';
  const isUpdating = updatingId === id;

  const partyName =
    c.client_name || c.supplier_name ||
    c.client?.business_name || c.supplier?.business_name ||
    c.party_name || '—';

  const dueDate = c.due_date || c.date || '—';

  return (
    <tr className="hover:bg-slate-50/60 transition-colors">
      {/* رقم الشيك */}
      <td className="px-5 py-3.5">
        <span className="text-xs font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded font-bold">
          {c.cheque_number || c.number || `#${id}`}
        </span>
      </td>

      {/* الجهة */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-2">
          <Building size={14} className="text-slate-400 flex-shrink-0" />
          <span className="font-medium text-slate-700 text-sm max-w-[160px] truncate block">
            {partyName}
          </span>
        </div>
      </td>

      {/* المبلغ */}
      <td className="px-5 py-3.5 font-bold text-[#1a365d]">
        {fmt(c.amount || c.total)}
      </td>

      {/* تاريخ الاستحقاق */}
      <td className="px-5 py-3.5">
        <div className="flex items-center gap-1.5 text-slate-600 text-sm">
          <Calendar size={13} className="text-[#c5a059]" />
          <span dir="ltr">{dueDate}</span>
        </div>
      </td>

      {/* البنك */}
      <td className="px-5 py-3.5 text-slate-600 text-sm">
        {c.bank_name || c.bank || '—'}
      </td>

      {/* الحالة */}
      <td className="px-5 py-3.5">
        <StatusBadge status={currentStatus} />
      </td>

      {/* تغيير الحالة */}
      <td className="px-5 py-3.5">
        <div className="relative">
          <select
            value={currentStatus}
            disabled={isUpdating}
            onChange={e => onStatusChange(id, type, e.target.value)}
            className={`appearance-none text-xs font-bold border rounded-xl px-3 py-2 pr-7 outline-none cursor-pointer transition
              ${isUpdating
                ? 'opacity-50 cursor-wait bg-slate-50 border-slate-200 text-slate-400'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:border-[#c5a059] focus:border-[#1a365d]'
              }`}
          >
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute top-1/2 -translate-y-1/2 left-2.5 text-slate-400 pointer-events-none" />
          {isUpdating && (
            <RefreshCw size={12} className="absolute top-1/2 -translate-y-1/2 right-2 animate-spin text-[#c5a059]" />
          )}
        </div>
      </td>
    </tr>
  );
}

// ════════════════════════════════════════════════════════════════
// المكوّن الرئيسي – الشيكات
// ════════════════════════════════════════════════════════════════
export default function ChequesManage({ user, navigateTo }) {
  // ─── التبويب النشط ────────────────────────────────────────────
  const [activeTab, setActiveTab]       = useState('receivable');

  // ─── بيانات التبويبين ─────────────────────────────────────────
  const [receivable, setReceivable]     = useState([]);
  const [payable, setPayable]           = useState([]);

  // ─── الحالة العامة ───────────────────────────────────────────
  const [loading, setLoading]           = useState(false);
  const [updatingId, setUpdatingId]     = useState(null);
  const [toast, setToast]               = useState(null);

  // ─── الفلاتر ─────────────────────────────────────────────────
  const [filters, setFilters] = useState({
    from: monthStart(),
    to:   today(),
  });
  const [appliedFilters, setAppliedFilters] = useState({ ...filters });

  // ─── Toast مساعد ─────────────────────────────────────────────
  const notify = (msg, type = 'success') => setToast({ msg, type });

  // ─── جلب الشيكات ─────────────────────────────────────────────
  const loadCheques = useCallback(async (type, af) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        action: 'daftra_cheques_list',
        type,
        page: '1',
        from: af.from,
        to:   af.to,
      });
      const res  = await fetch(`${API_URL}?${params}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        if (type === 'receivable') setReceivable(data.data);
        else setPayable(data.data);
      } else {
        if (type === 'receivable') setReceivable([]);
        else setPayable([]);
      }
    } catch {
      notify('فشل الاتصال بالخادم', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  // ─── جلب كلا التبويبين عند التحميل الأولي / تغيير الفلاتر ───
  const loadAll = useCallback((af) => {
    loadCheques('receivable', af);
    loadCheques('payable', af);
  }, [loadCheques]);

  useEffect(() => {
    loadAll(appliedFilters);
  }, []);

  // ─── تطبيق الفلاتر ───────────────────────────────────────────
  const applyFilters = () => {
    setAppliedFilters({ ...filters });
    loadCheques('receivable', filters);
    loadCheques('payable', filters);
  };

  // ─── تغيير حالة شيك ──────────────────────────────────────────
  const handleStatusChange = async (id, type, status) => {
    setUpdatingId(id);
    try {
      const res = await fetch(`${API_URL}?action=daftra_cheque_update_status`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id, type, status }),
      });
      const data = await res.json();
      if (data.success) {
        // تحديث محلي فوري
        const updater = (list) =>
          list.map(row => {
            const c = row.Cheque || row;
            if (c.id === id) {
              if (row.Cheque) return { ...row, Cheque: { ...row.Cheque, status } };
              return { ...row, status };
            }
            return row;
          });
        if (type === 'receivable') setReceivable(prev => updater(prev));
        else setPayable(prev => updater(prev));
        notify('تم تحديث الحالة بنجاح');
      } else {
        notify(data.message || 'فشل تحديث الحالة', 'error');
      }
    } catch {
      notify('فشل الاتصال بالخادم', 'error');
    } finally {
      setUpdatingId(null);
    }
  };

  // ─── حسابات الملخص ───────────────────────────────────────────
  const computeSummary = (list) => {
    const total = list.length;
    const totalAmount = list.reduce((s, row) => {
      const c = row.Cheque || row;
      return s + (parseFloat(c.amount || c.total) || 0);
    }, 0);
    const pendingAmount = list
      .filter(row => {
        const c = row.Cheque || row;
        return c.status === 'pending';
      })
      .reduce((s, row) => {
        const c = row.Cheque || row;
        return s + (parseFloat(c.amount || c.total) || 0);
      }, 0);
    return { total, totalAmount, pendingAmount };
  };

  const currentList    = activeTab === 'receivable' ? receivable : payable;
  const summary        = computeSummary(currentList);

  // ════════════════════════════════════════════════════════════════
  return (
    <div className="animate-fadeIn pb-10" dir="rtl">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      {/* ─── رأس الصفحة ─── */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 mb-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-[#1a365d] rounded-2xl flex items-center justify-center shadow">
            <CreditCard size={24} className="text-[#c5a059]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#1a365d]">الشيكات</h1>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              إدارة الشيكات المستلمة والمدفوعة من دفترة
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ExportButton
            rows={currentList}
            columns={[
              { key: 'no', label: 'رقم الشيك', format: (_v, row) => { const c = row.Cheque || row; return c.cheque_number || c.number || `#${c.id}`; } },
              { key: 'party', label: 'الجهة', format: (_v, row) => { const c = row.Cheque || row; return c.client_name || c.supplier_name || c.client?.business_name || c.supplier?.business_name || c.party_name || ''; } },
              { key: 'amount', label: 'المبلغ', format: (_v, row) => { const c = row.Cheque || row; return fmtExport.money(c.amount ?? c.total); } },
              { key: 'due_date', label: 'تاريخ الاستحقاق', format: (_v, row) => { const c = row.Cheque || row; return c.due_date || c.date || ''; } },
              { key: 'bank', label: 'البنك', format: (_v, row) => { const c = row.Cheque || row; return c.bank_name || c.bank || ''; } },
              { key: 'status', label: 'الحالة', format: (_v, row) => { const c = row.Cheque || row; return (STATUS_CONFIG[c.status] || {}).label || c.status || ''; } },
            ]}
            filename="الشيكات"
          />
          <button
            onClick={() => loadAll(appliedFilters)}
            className="p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition text-slate-500"
            title="تحديث"
          >
            <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* ─── التبويبات ─── */}
      <div className="flex gap-2 mb-6">
        {[
          { key: 'receivable', label: 'شيكات مستلمة', count: receivable.length },
          { key: 'payable',    label: 'شيكات مدفوعة', count: payable.length    },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-sm font-bold border transition ${
              activeTab === tab.key
                ? 'bg-[#1a365d] text-white border-[#1a365d] shadow-md'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <CreditCard size={16} />
            {tab.label}
            <span className={`px-2 py-0.5 rounded-full text-xs font-black ${
              activeTab === tab.key
                ? 'bg-white/20 text-white'
                : 'bg-slate-100 text-slate-500'
            }`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ─── شرائح الملخص ─── */}
      <div className="flex flex-wrap gap-3 mb-6">
        <SummaryChip
          icon={CreditCard}
          label={activeTab === 'receivable' ? 'شيكات مستلمة' : 'شيكات مدفوعة'}
          value={`${summary.total} شيك`}
          color="bg-[#1a365d]"
        />
        <SummaryChip
          icon={DollarSign}
          label="إجمالي المبالغ"
          value={fmt(summary.totalAmount)}
          color="bg-[#c5a059]"
        />
        <SummaryChip
          icon={AlertTriangle}
          label="معلق"
          value={fmt(summary.pendingAmount)}
          color="bg-amber-500"
        />
      </div>

      {/* ─── فلتر التاريخ ─── */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-4 flex flex-col sm:flex-row items-end gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Calendar size={16} className="text-[#c5a059] flex-shrink-0" />
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap">من تاريخ:</span>
          <input
            type="date"
            value={filters.from}
            onChange={e => setFilters(f => ({ ...f, from: e.target.value }))}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-[#c5a059] transition"
            dir="ltr"
          />
        </div>
        <div className="flex items-center gap-2 flex-1">
          <Calendar size={16} className="text-[#c5a059] flex-shrink-0" />
          <span className="text-xs font-bold text-slate-500 whitespace-nowrap">إلى تاريخ:</span>
          <input
            type="date"
            value={filters.to}
            onChange={e => setFilters(f => ({ ...f, to: e.target.value }))}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 outline-none focus:border-[#c5a059] transition"
            dir="ltr"
          />
        </div>
        <button
          onClick={applyFilters}
          disabled={loading}
          className="flex items-center gap-2 bg-[#1a365d] hover:bg-[#152d50] text-white px-5 py-2.5 rounded-xl text-sm font-bold transition shadow-sm disabled:opacity-60 whitespace-nowrap"
        >
          <Search size={15} />
          تصفية
        </button>
      </div>

      {/* ─── الجدول ─── */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 gap-3 text-slate-400">
            <RefreshCw size={24} className="animate-spin" />
            <span className="font-bold text-sm">جاري التحميل...</span>
          </div>
        ) : currentList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <CreditCard size={40} className="opacity-30" />
            <p className="font-bold text-sm">
              {activeTab === 'receivable' ? 'لا توجد شيكات مستلمة' : 'لا توجد شيكات مدفوعة'}
            </p>
            <p className="text-xs text-slate-300">جرب تغيير نطاق التاريخ</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-[#1a365d] font-black text-xs">
                  <th className="px-5 py-4">رقم الشيك</th>
                  <th className="px-5 py-4">
                    {activeTab === 'receivable' ? 'العميل' : 'المورد'}
                  </th>
                  <th className="px-5 py-4">المبلغ</th>
                  <th className="px-5 py-4">تاريخ الاستحقاق</th>
                  <th className="px-5 py-4">البنك</th>
                  <th className="px-5 py-4">الحالة</th>
                  <th className="px-5 py-4 text-center">تغيير الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {currentList.map((cheque, idx) => {
                  const c = cheque.Cheque || cheque;
                  return (
                    <ChequeRow
                      key={c.id || idx}
                      cheque={cheque}
                      type={activeTab}
                      onStatusChange={handleStatusChange}
                      updatingId={updatingId}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── تعليمة أسفل الصفحة ─── */}
      {!loading && currentList.length > 0 && (
        <p className="text-center text-xs text-slate-300 font-medium mt-4">
          تُنشأ الشيكات تلقائياً من المعاملات في دفترة — لا يمكن إضافتها يدوياً هنا.
        </p>
      )}
    </div>
  );
}
