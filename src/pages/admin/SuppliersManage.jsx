import React, { useState, useEffect, useCallback } from 'react';
import {
  Truck, Plus, Search, Phone, Mail, MapPin,
  Edit3, Trash2, ChevronLeft, ChevronRight, RefreshCw,
  AlertTriangle, CheckCircle2, X,
} from 'lucide-react';
import ExportButton from '../../components/ExportButton';
import { fmt } from '../../utils/exporters';
import useTableControls from '../../utils/useTableControls';
import SortHeader from '../../components/SortHeader';
import TablePager from '../../components/TablePager';

import { API_URL } from '../../lib/api/client';

// ─── Toast ───────────────────────────────────────────────────────
function Toast({ msg, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);
  const bg = type === 'error' ? 'bg-red-600' : 'bg-green-600';
  return (
    <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl text-white text-sm font-bold ${bg} animate-fadeIn`}>
      {type === 'error' ? <AlertTriangle size={18} /> : <CheckCircle2 size={18} />}
      {msg}
      <button onClick={onClose} className="mr-1 opacity-70 hover:opacity-100"><X size={14} /></button>
    </div>
  );
}

// ─── ConfirmDialog ───────────────────────────────────────────────
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
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200 transition-colors"
          >
            إلغاء
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors"
          >
            حذف
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SummaryChip ─────────────────────────────────────────────────
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

// ─── النموذج الفارغ ──────────────────────────────────────────────
const emptyForm = () => ({
  business_name: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
});

// ─── normalize supplier ───────────────────────────────────────────
const norm = (s) => {
  const sp = s.Supplier || s;
  return {
    id:            sp.id,
    name:          sp.business_name || `${sp.first_name || ''} ${sp.last_name || ''}`.trim() || `مورد #${sp.id}`,
    phone:         sp.mobile || sp.phone || '',
    email:         sp.email || '',
    address:       sp.address || '',
    notes:         sp.notes || '',
    business_name: sp.business_name || '',
  };
};

// ════════════════════════════════════════════════════════════════
// المكوّن الرئيسي
// ════════════════════════════════════════════════════════════════
export default function SuppliersManage({ user, navigateTo, showToast: externalToast }) {
  const [view, setView]           = useState('list'); // list | create | edit
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading]     = useState(false);
  const [saving, setSaving]       = useState(false);
  const [selected, setSelected]   = useState(null);
  const [confirmId, setConfirmId] = useState(null);
  const [toast, setToast]         = useState(null);
  const [search, setSearch]       = useState('');
  const [page, setPage]           = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [form, setForm]           = useState(emptyForm());

  const notify = (msg, type = 'success') => setToast({ msg, type });

  // ─── فرز + ترقيم صفحات (على الصفوف المُحمّلة) ───────────────
  const normalizedSuppliers = suppliers.map(s => ({ ...norm(s), _raw: s }));
  const tc = useTableControls(normalizedSuppliers, { pageSize: 15, initialSort: { key: 'name', dir: 'asc' } });

  // ─── جلب الموردين ─────────────────────────────────────────────
  const loadSuppliers = useCallback(async (pg = 1, q = search) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ action: 'daftra_suppliers_list', page: pg });
      if (q.trim()) params.append('search', q.trim());
      const res  = await fetch(`${API_URL}?${params.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setSuppliers(data.data);
        setHasNextPage(data.has_next_page || data.data.length >= 20);
      } else {
        setSuppliers([]);
        setHasNextPage(false);
      }
    } catch {
      notify('خطأ في الاتصال بالخادم', 'error');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line

  useEffect(() => {
    if (view === 'list') loadSuppliers(page, search);
  }, [view, page]); // eslint-disable-line

  // ─── بحث ─────────────────────────────────────────────────────
  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    loadSuppliers(1, search);
  };

  // ─── إنشاء مورد ──────────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.business_name.trim()) { notify('يرجى إدخال الاسم', 'error'); return; }
    setSaving(true);
    try {
      const res  = await fetch(`${API_URL}?action=daftra_supplier_create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (data.success) {
        notify('تم إضافة المورد بنجاح');
        setView('list');
        setPage(1);
        loadSuppliers(1, '');
        setSearch('');
      } else {
        notify(data.message || 'فشل الإنشاء', 'error');
      }
    } catch {
      notify('خطأ في الاتصال', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ─── تحديث مورد ──────────────────────────────────────────────
  const handleUpdate = async () => {
    if (!form.business_name.trim()) { notify('يرجى إدخال الاسم', 'error'); return; }
    setSaving(true);
    try {
      const res  = await fetch(`${API_URL}?action=daftra_supplier_update`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selected.id, ...form }),
      });
      const data = await res.json();
      if (data.success) {
        notify('تم تحديث المورد بنجاح');
        setView('list');
        loadSuppliers(page, search);
      } else {
        notify(data.message || 'فشل التحديث', 'error');
      }
    } catch {
      notify('خطأ في الاتصال', 'error');
    } finally {
      setSaving(false);
    }
  };

  // ─── حذف مورد ────────────────────────────────────────────────
  const handleDelete = async (id) => {
    try {
      const res  = await fetch(`${API_URL}?action=daftra_supplier_delete&id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        notify('تم حذف المورد');
        setSuppliers((prev) => prev.filter((s) => (s.Supplier?.id || s.id) !== id));
      } else {
        notify(data.message || 'فشل الحذف', 'error');
      }
    } catch {
      notify('خطأ في الاتصال', 'error');
    } finally {
      setConfirmId(null);
    }
  };

  // ─── فتح تعديل ───────────────────────────────────────────────
  const openEdit = (s) => {
    const sp = norm(s);
    setSelected(sp);
    setForm({
      business_name: sp.business_name || sp.name,
      phone:         sp.phone,
      email:         sp.email,
      address:       sp.address,
      notes:         sp.notes,
    });
    setView('edit');
  };

  // ─── عرض القائمة ─────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="pt-24 pb-20 bg-transparent min-h-screen" dir="rtl">
        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        {confirmId && (
          <ConfirmDialog
            msg="هل أنت متأكد من حذف هذا المورد؟"
            onConfirm={() => handleDelete(confirmId)}
            onCancel={() => setConfirmId(null)}
          />
        )}

        <div className="container mx-auto px-4 max-w-7xl">
          {/* ─── Header ─── */}
          <div className="bg-white dark:bg-brand-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-brand-700 p-6 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              {navigateTo && (
                <button
                  onClick={() => navigateTo('dashboard')}
                  className="p-3 bg-slate-50 dark:bg-brand-800 hover:bg-slate-100 dark:hover:bg-brand-800 rounded-full border border-slate-200 dark:border-brand-700 transition hidden md:block"
                >
                  <ChevronRight size={22} className="text-slate-500 dark:text-brand-300" />
                </button>
              )}
              <div>
                <h1 className="text-2xl font-black text-brand-800 dark:text-brand-100 flex items-center gap-2">
                  <Truck className="text-gold-500" size={28} />
                  إدارة الموردين
                </h1>
                <p className="text-slate-400 dark:text-brand-400 text-sm font-bold mt-0.5">قائمة موردي دفترة</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ExportButton
                rows={suppliers.map(norm)}
                columns={[
                  { key: 'name', label: 'الاسم' },
                  { key: 'phone', label: 'الهاتف' },
                  { key: 'email', label: 'البريد' },
                  { key: 'address', label: 'العنوان' },
                ]}
                filename="الموردين"
              />
              <button
                onClick={() => { setForm(emptyForm()); setView('create'); }}
                className="flex items-center gap-2 bg-brand-800 hover:bg-brand-900 text-white px-6 py-3 rounded-xl font-bold transition shadow-md"
              >
                <Plus size={18} /> إضافة مورد
              </button>
            </div>
          </div>

          {/* ─── Summary Chips ─── */}
          <div className="flex flex-wrap gap-3 mb-6">
            <SummaryChip
              icon={Truck}
              label="إجمالي الموردين"
              value={suppliers.length}
              color="bg-brand-800"
            />
          </div>

          {/* ─── Search ─── */}
          <form onSubmit={handleSearch} className="flex gap-2 mb-6">
            <div className="relative flex-1">
              <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="البحث بالاسم..."
                className="w-full bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-700 rounded-xl pr-10 pl-4 py-3 text-sm font-bold text-slate-700 dark:text-brand-50 dark:placeholder-brand-500 outline-none focus:border-gold-500 transition"
              />
            </div>
            <button
              type="submit"
              className="bg-gold-500 hover:bg-amber-600 text-white px-5 py-3 rounded-xl font-bold transition flex items-center gap-2"
            >
              <Search size={16} /> بحث
            </button>
            <button
              type="button"
              onClick={() => { setSearch(''); setPage(1); loadSuppliers(1, ''); }}
              className="bg-slate-100 dark:bg-brand-800 hover:bg-slate-200 dark:hover:bg-brand-800 text-slate-600 dark:text-brand-300 px-4 py-3 rounded-xl font-bold transition"
              title="إعادة تعيين"
            >
              <RefreshCw size={16} />
            </button>
          </form>

          {/* ─── Table ─── */}
          {loading ? (
            <div className="text-center py-20">
              <RefreshCw className="animate-spin mx-auto text-brand-800 dark:text-brand-300 mb-3" size={36} />
              <p className="text-slate-400 dark:text-brand-400 font-bold">جاري التحميل...</p>
            </div>
          ) : suppliers.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-brand-900 rounded-[2rem] border border-slate-100 dark:border-brand-700">
              <Truck size={48} className="mx-auto text-slate-200 mb-3" />
              <p className="text-slate-400 dark:text-brand-400 font-bold">لا يوجد موردون</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-brand-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-brand-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 dark:bg-brand-800/60 border-b border-slate-100 dark:border-brand-700">
                    <tr className="text-brand-800 dark:text-brand-100 font-black text-xs">
                      <SortHeader label="الاسم"            sortKey="name"  activeKey={tc.sortKey} dir={tc.sortDir} onSort={tc.toggleSort} />
                      <SortHeader label="الهاتف"           sortKey="phone" activeKey={tc.sortKey} dir={tc.sortDir} onSort={tc.toggleSort} />
                      <SortHeader label="البريد الإلكتروني" sortKey="email" activeKey={tc.sortKey} dir={tc.sortDir} onSort={tc.toggleSort} />
                      <th className="p-4">العنوان</th>
                      <th className="p-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-brand-700">
                    {tc.pageRows.map((sp, idx) => {
                      const s = sp._raw;
                      return (
                        <tr key={sp.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-brand-800 transition">
                          <td className="p-4 font-black text-brand-800 dark:text-brand-100">{sp.name}</td>
                          <td className="p-4 text-slate-500 dark:text-brand-400 font-medium" dir="ltr">{sp.phone || '—'}</td>
                          <td className="p-4 text-slate-500 dark:text-brand-400 font-medium">{sp.email || '—'}</td>
                          <td className="p-4 text-slate-500 dark:text-brand-400 font-medium max-w-[200px] truncate">{sp.address || '—'}</td>
                          <td className="p-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => openEdit(s)}
                                className="p-2 rounded-lg bg-slate-100 dark:bg-brand-800 hover:bg-gold-500 hover:text-white text-slate-500 dark:text-brand-300 transition"
                                title="تعديل"
                              >
                                <Edit3 size={15} />
                              </button>
                              <button
                                onClick={() => setConfirmId(sp.id)}
                                className="p-2 rounded-lg bg-slate-100 dark:bg-brand-800 hover:bg-red-500 hover:text-white text-slate-500 dark:text-brand-300 transition"
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
              <div className="px-6 pb-2 pt-2">
                <TablePager page={tc.page} totalPages={tc.totalPages} setPage={tc.setPage}
                  pageStart={tc.pageStart} pageEnd={tc.pageEnd} totalRows={tc.totalRows} />
              </div>

              {/* ─── Pagination (server) ─── */}
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-brand-700 bg-slate-50/50 dark:bg-brand-800/40">
                <button
                  disabled={page === 1}
                  onClick={() => { const p = page - 1; setPage(p); loadSuppliers(p, search); }}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-700 text-sm font-bold text-slate-600 dark:text-brand-300 hover:bg-slate-100 dark:hover:bg-brand-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronRight size={16} /> السابق
                </button>
                <span className="text-sm font-bold text-slate-500 dark:text-brand-400">صفحة {page}</span>
                <button
                  disabled={!hasNextPage}
                  onClick={() => { const p = page + 1; setPage(p); loadSuppliers(p, search); }}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-700 text-sm font-bold text-slate-600 dark:text-brand-300 hover:bg-slate-100 dark:hover:bg-brand-800 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  التالي <ChevronLeft size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── عرض الإنشاء / التعديل ───────────────────────────────────
  const isEdit = view === 'edit';
  return (
    <div className="pt-24 pb-20 bg-transparent min-h-screen" dir="rtl">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}

      <div className="container mx-auto px-4 max-w-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setView('list')}
            className="p-3 bg-white dark:bg-brand-900 rounded-full border border-slate-200 dark:border-brand-700 hover:bg-slate-100 dark:hover:bg-brand-800 transition"
          >
            <ChevronRight size={22} className="text-slate-500 dark:text-brand-300" />
          </button>
          <h2 className="text-xl font-black text-brand-800 dark:text-brand-100">
            {isEdit ? 'تعديل بيانات المورد' : 'إضافة مورد جديد'}
          </h2>
        </div>

        <div className="bg-white dark:bg-brand-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-brand-700 p-6 md:p-8 space-y-5">
          {/* الاسم */}
          <div>
            <label className="block text-xs font-black text-brand-800 dark:text-brand-100 mb-1.5">
              الاسم <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={form.business_name}
              onChange={(e) => setForm({ ...form, business_name: e.target.value })}
              placeholder="اسم المورد أو الشركة..."
              className="w-full bg-slate-50 dark:bg-brand-800/40 border border-slate-200 dark:border-brand-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-brand-50 dark:placeholder-brand-500 outline-none focus:border-gold-500 transition"
            />
          </div>

          {/* الهاتف */}
          <div>
            <label className="block text-xs font-black text-brand-800 dark:text-brand-100 mb-1.5 flex items-center gap-1">
              <Phone size={13} /> الهاتف
            </label>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="05xxxxxxxx"
              dir="ltr"
              className="w-full bg-slate-50 dark:bg-brand-800/40 border border-slate-200 dark:border-brand-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-brand-50 dark:placeholder-brand-500 outline-none focus:border-gold-500 transition"
            />
          </div>

          {/* البريد */}
          <div>
            <label className="block text-xs font-black text-brand-800 dark:text-brand-100 mb-1.5 flex items-center gap-1">
              <Mail size={13} /> البريد الإلكتروني
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="example@domain.com"
              dir="ltr"
              className="w-full bg-slate-50 dark:bg-brand-800/40 border border-slate-200 dark:border-brand-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-brand-50 dark:placeholder-brand-500 outline-none focus:border-gold-500 transition"
            />
          </div>

          {/* العنوان */}
          <div>
            <label className="block text-xs font-black text-brand-800 dark:text-brand-100 mb-1.5 flex items-center gap-1">
              <MapPin size={13} /> العنوان
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="المدينة، الحي..."
              className="w-full bg-slate-50 dark:bg-brand-800/40 border border-slate-200 dark:border-brand-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-brand-50 dark:placeholder-brand-500 outline-none focus:border-gold-500 transition"
            />
          </div>

          {/* ملاحظات */}
          <div>
            <label className="block text-xs font-black text-brand-800 dark:text-brand-100 mb-1.5">ملاحظات</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="أي ملاحظات إضافية..."
              rows={3}
              className="w-full bg-slate-50 dark:bg-brand-800/40 border border-slate-200 dark:border-brand-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-brand-50 dark:placeholder-brand-500 outline-none focus:border-gold-500 transition resize-none"
            />
          </div>

          {/* Save */}
          <button
            onClick={isEdit ? handleUpdate : handleCreate}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-brand-800 hover:bg-brand-900 text-white py-4 rounded-2xl font-black transition shadow-md disabled:opacity-60"
          >
            {saving ? (
              <RefreshCw size={18} className="animate-spin" />
            ) : (
              <CheckCircle2 size={18} />
            )}
            {saving ? 'جاري الحفظ...' : isEdit ? 'حفظ التعديلات' : 'إضافة المورد'}
          </button>
        </div>
      </div>
    </div>
  );
}
