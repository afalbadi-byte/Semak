import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, Plus, Search, Phone, Mail, MapPin, DollarSign,
  Edit3, Trash2, Eye, ChevronLeft, ChevronRight, RefreshCw,
  AlertTriangle, CheckCircle2, X, BookOpen,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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
          <button onClick={onCancel} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-sm font-bold hover:bg-slate-200 transition-colors">إلغاء</button>
          <button onClick={onConfirm} className="px-4 py-2 rounded-xl bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors">تأكيد</button>
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

const fmtNumber = (n) =>
  new Intl.NumberFormat('ar-SA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parseFloat(n) || 0);

const emptyForm = () => ({
  name: '', phone: '', email: '', address: '', vat_number: '', cr_number: '', notes: '',
});

// ─── تطبيع صف acc_parties المسطّح ───────────────────────────────
const norm = (c) => ({
  id:         c.id,
  name:       c.name || `عميل #${c.id}`,
  phone:      c.phone || '',
  email:      c.email || '',
  address:    c.address || '',
  notes:      c.notes || '',
  vat_number: c.vat_number || '',
  cr_number:  c.cr_number || '',
  balance:    parseFloat(c.balance || 0),
  _raw:       c,
});

// ════════════════════════════════════════════════════════════════
// المكوّن الرئيسي — العملاء (acc_parties type=customer)
// ════════════════════════════════════════════════════════════════
export default function ClientsManage({ user, navigateTo }) {
  const navigate = useNavigate();
  const [view, setView]           = useState('list'); // list | create | edit | detail
  const [clients, setClients]     = useState([]);
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

  // ─── جلب العملاء من acc_parties ──────────────────────────────
  const loadClients = useCallback(async (pg = 1, q = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ action: 'acc_parties_list', type: 'customer', tenant: 1, page: pg });
      if (q.trim()) params.append('search', q.trim());
      const res  = await fetch(`${API_URL}?${params}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setClients(data.data);
        setHasNextPage(data.has_next_page || false);
      } else {
        setClients([]); setHasNextPage(false);
      }
    } catch {
      notify('خطأ في الاتصال بالخادم', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (view === 'list') loadClients(page, search);
  }, [view, page]); // eslint-disable-line

  const handleSearch = (e) => { e.preventDefault(); setPage(1); loadClients(1, search); };

  const totalBalance = clients.reduce((s, c) => s + parseFloat(c.balance || 0), 0);
  const normalizedClients = clients.map(norm);
  const tc = useTableControls(normalizedClients, { pageSize: 15, initialSort: { key: 'name', dir: 'asc' } });

  // ─── إنشاء عميل ──────────────────────────────────────────────
  const handleCreate = async () => {
    if (!form.name.trim()) { notify('يرجى إدخال الاسم', 'error'); return; }
    setSaving(true);
    try {
      const res  = await fetch(`${API_URL}?action=gl_party_save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, type: 'customer', tenant_id: 1 }),
      });
      const data = await res.json();
      if (data.success) {
        notify('تم إضافة العميل بنجاح');
        setView('list'); setPage(1); setSearch(''); loadClients(1, '');
      } else { notify(data.message || 'فشل الإنشاء', 'error'); }
    } catch { notify('خطأ في الاتصال', 'error'); }
    finally { setSaving(false); }
  };

  // ─── تحديث عميل ──────────────────────────────────────────────
  const handleUpdate = async () => {
    if (!form.name.trim()) { notify('يرجى إدخال الاسم', 'error'); return; }
    setSaving(true);
    try {
      const res  = await fetch(`${API_URL}?action=gl_party_save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, id: selected.id, type: 'customer', tenant_id: 1 }),
      });
      const data = await res.json();
      if (data.success) {
        notify('تم تحديث العميل بنجاح');
        setView('list'); loadClients(page, search);
      } else { notify(data.message || 'فشل التحديث', 'error'); }
    } catch { notify('خطأ في الاتصال', 'error'); }
    finally { setSaving(false); }
  };

  // ─── حذف / تعطيل عميل ────────────────────────────────────────
  const handleDelete = async (id) => {
    try {
      const res  = await fetch(`${API_URL}?action=gl_party_delete&id=${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        notify(data.deactivated ? 'تم تعطيل العميل (مرتبط بحركات محاسبية)' : 'تم حذف العميل');
        setClients((prev) => prev.filter((c) => c.id !== id));
        if (view === 'detail') setView('list');
      } else { notify(data.message || 'فشل الحذف', 'error'); }
    } catch { notify('خطأ في الاتصال', 'error'); }
    finally { setConfirmId(null); }
  };

  const openEdit = (raw) => {
    const cl = norm(raw);
    setSelected(cl);
    setForm({ name: cl.name, phone: cl.phone, email: cl.email, address: cl.address, vat_number: cl.vat_number, cr_number: cl.cr_number, notes: cl.notes });
    setView('edit');
  };
  const openDetail = (raw) => { setSelected(norm(raw)); setView('detail'); };

  // ─── قائمة ───────────────────────────────────────────────────
  if (view === 'list') {
    return (
      <div className="pt-24 pb-20 bg-transparent min-h-screen" dir="rtl">
        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        {confirmId && (
          <ConfirmDialog
            msg="هل أنت متأكد؟ العملاء ذوو الحركات المحاسبية يُعطَّلون بدلًا من الحذف."
            onConfirm={() => handleDelete(confirmId)}
            onCancel={() => setConfirmId(null)}
          />
        )}
        <div className="container mx-auto px-4 max-w-7xl">
          {/* Header */}
          <div className="bg-white dark:bg-brand-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-brand-700 p-6 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              {navigateTo && (
                <button onClick={() => navigateTo('dashboard')} className="p-3 bg-slate-50 dark:bg-brand-800 hover:bg-slate-100 dark:hover:bg-brand-800 rounded-full border border-slate-200 dark:border-brand-700 transition hidden md:block">
                  <ChevronRight size={22} className="text-slate-500 dark:text-brand-300" />
                </button>
              )}
              <div>
                <h1 className="text-2xl font-black text-brand-800 dark:text-brand-100 flex items-center gap-2">
                  <Users className="text-gold-500" size={28} /> إدارة العملاء
                </h1>
                <p className="text-slate-400 dark:text-brand-400 text-sm font-bold mt-0.5">قائمة العملاء المستقلة</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ExportButton
                rows={clients.map(norm)}
                columns={[
                  { key: 'name',       label: 'الاسم' },
                  { key: 'phone',      label: 'الهاتف' },
                  { key: 'email',      label: 'البريد' },
                  { key: 'address',    label: 'العنوان' },
                  { key: 'vat_number', label: 'الرقم الضريبي' },
                  { key: 'cr_number',  label: 'السجل التجاري' },
                  { key: 'balance',    label: 'الرصيد', format: fmt.money },
                ]}
                filename="العملاء"
              />
              <button onClick={() => { setForm(emptyForm()); setView('create'); }}
                className="flex items-center gap-2 bg-brand-800 hover:bg-brand-900 text-white px-6 py-3 rounded-xl font-bold transition shadow-md">
                <Plus size={18} /> إضافة عميل
              </button>
            </div>
          </div>

          {/* Summary */}
          <div className="flex flex-wrap gap-3 mb-6">
            <SummaryChip icon={Users}       label="إجمالي العملاء" value={clients.length}                              color="bg-brand-800" />
            <SummaryChip icon={DollarSign}  label="إجمالي الذمم"   value={`${fmtNumber(totalBalance)} ر.س`}            color={totalBalance >= 0 ? 'bg-emerald-500' : 'bg-red-500'} />
          </div>

          {/* Search */}
          <form onSubmit={handleSearch} className="flex gap-2 mb-6">
            <div className="relative flex-1">
              <Search size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="البحث بالاسم أو الهاتف أو البريد أو الرقم الضريبي..."
                className="w-full bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-700 rounded-xl pr-10 pl-4 py-3 text-sm font-bold text-slate-700 dark:text-brand-50 dark:placeholder-brand-500 outline-none focus:border-gold-500 transition" />
            </div>
            <button type="submit" className="bg-gold-500 hover:bg-amber-600 text-white px-5 py-3 rounded-xl font-bold transition flex items-center gap-2">
              <Search size={16} /> بحث
            </button>
            <button type="button" onClick={() => { setSearch(''); setPage(1); loadClients(1, ''); }}
              className="bg-slate-100 dark:bg-brand-800 hover:bg-slate-200 dark:hover:bg-brand-800 text-slate-600 dark:text-brand-300 px-4 py-3 rounded-xl font-bold transition" title="إعادة تعيين">
              <RefreshCw size={16} />
            </button>
          </form>

          {/* Table */}
          {loading ? (
            <div className="text-center py-20"><RefreshCw className="animate-spin mx-auto text-brand-800 dark:text-brand-300 mb-3" size={36} /><p className="text-slate-400 dark:text-brand-400 font-bold">جاري التحميل...</p></div>
          ) : clients.length === 0 ? (
            <div className="text-center py-20 bg-white dark:bg-brand-900 rounded-[2rem] border border-slate-100 dark:border-brand-700">
              <Users size={48} className="mx-auto text-slate-200 mb-3" />
              <p className="text-slate-400 dark:text-brand-400 font-bold">لا يوجد عملاء</p>
            </div>
          ) : (
            <div className="bg-white dark:bg-brand-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-brand-700 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-sm">
                  <thead className="bg-slate-50 dark:bg-brand-800/60 border-b border-slate-100 dark:border-brand-700">
                    <tr className="text-brand-800 dark:text-brand-100 font-black text-xs">
                      <SortHeader label="الاسم"        sortKey="name"    activeKey={tc.sortKey} dir={tc.sortDir} onSort={tc.toggleSort} />
                      <SortHeader label="الهاتف"       sortKey="phone"   activeKey={tc.sortKey} dir={tc.sortDir} onSort={tc.toggleSort} />
                      <SortHeader label="البريد"       sortKey="email"   activeKey={tc.sortKey} dir={tc.sortDir} onSort={tc.toggleSort} />
                      <SortHeader label="الرصيد (ر.س)" sortKey="balance" activeKey={tc.sortKey} dir={tc.sortDir} onSort={tc.toggleSort} align="center" />
                      <th className="p-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-brand-700">
                    {tc.pageRows.map((cl, idx) => (
                      <tr key={cl.id || idx} className="hover:bg-slate-50/70 dark:hover:bg-brand-800 transition cursor-pointer" onClick={() => openDetail(cl._raw)}>
                        <td className="p-4 font-black text-brand-800 dark:text-brand-100">{cl.name}</td>
                        <td className="p-4 text-slate-500 dark:text-brand-400 font-medium" dir="ltr">{cl.phone || '—'}</td>
                        <td className="p-4 text-slate-500 dark:text-brand-400 font-medium">{cl.email || '—'}</td>
                        <td className="p-4 text-center">
                          <span className={`font-black text-sm ${cl.balance > 0 ? 'text-emerald-600' : cl.balance < 0 ? 'text-red-600' : 'text-slate-400'}`}>
                            {fmtNumber(cl.balance)}
                          </span>
                        </td>
                        <td className="p-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => navigate(`/admin/dashboard/parties/${cl.id}`)} title="كشف الحساب"
                              className="p-2 rounded-lg bg-slate-100 dark:bg-brand-800 hover:bg-brand-800 hover:text-white text-slate-500 dark:text-brand-300 transition">
                              <BookOpen size={15} />
                            </button>
                            <button onClick={() => openDetail(cl._raw)} title="عرض"
                              className="p-2 rounded-lg bg-slate-100 dark:bg-brand-800 hover:bg-brand-800 hover:text-white text-slate-500 dark:text-brand-300 transition">
                              <Eye size={15} />
                            </button>
                            <button onClick={() => openEdit(cl._raw)} title="تعديل"
                              className="p-2 rounded-lg bg-slate-100 dark:bg-brand-800 hover:bg-gold-500 hover:text-white text-slate-500 dark:text-brand-300 transition">
                              <Edit3 size={15} />
                            </button>
                            <button onClick={() => setConfirmId(cl.id)} title="حذف"
                              className="p-2 rounded-lg bg-slate-100 dark:bg-brand-800 hover:bg-red-500 hover:text-white text-slate-500 dark:text-brand-300 transition">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-6 pb-2 pt-2">
                <TablePager page={tc.page} totalPages={tc.totalPages} setPage={tc.setPage} pageStart={tc.pageStart} pageEnd={tc.pageEnd} totalRows={tc.totalRows} />
              </div>
              <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 dark:border-brand-700 bg-slate-50/50 dark:bg-brand-800/40">
                <button disabled={page === 1} onClick={() => { const p = page - 1; setPage(p); loadClients(p, search); }}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-700 text-sm font-bold text-slate-600 dark:text-brand-300 hover:bg-slate-100 dark:hover:bg-brand-800 disabled:opacity-40 disabled:cursor-not-allowed transition">
                  <ChevronRight size={16} /> السابق
                </button>
                <span className="text-sm font-bold text-slate-500 dark:text-brand-400">صفحة {page}</span>
                <button disabled={!hasNextPage} onClick={() => { const p = page + 1; setPage(p); loadClients(p, search); }}
                  className="flex items-center gap-1 px-4 py-2 rounded-xl bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-700 text-sm font-bold text-slate-600 dark:text-brand-300 hover:bg-slate-100 dark:hover:bg-brand-800 disabled:opacity-40 disabled:cursor-not-allowed transition">
                  التالي <ChevronLeft size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── تفاصيل ──────────────────────────────────────────────────
  if (view === 'detail' && selected) {
    return (
      <div className="pt-24 pb-20 bg-transparent min-h-screen" dir="rtl">
        {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
        {confirmId && (
          <ConfirmDialog msg="هل أنت متأكد؟ العملاء ذوو الحركات المحاسبية يُعطَّلون بدلًا من الحذف."
            onConfirm={() => handleDelete(confirmId)} onCancel={() => setConfirmId(null)} />
        )}
        <div className="container mx-auto px-4 max-w-3xl">
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setView('list')} className="p-3 bg-white dark:bg-brand-900 rounded-full border border-slate-200 dark:border-brand-700 hover:bg-slate-100 dark:hover:bg-brand-800 transition">
              <ChevronRight size={22} className="text-slate-500 dark:text-brand-300" />
            </button>
            <h2 className="text-xl font-black text-brand-800 dark:text-brand-100">تفاصيل العميل</h2>
          </div>

          <div className="bg-white dark:bg-brand-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-brand-700 overflow-hidden mb-6">
            <div className="bg-brand-800 p-8 flex flex-col md:flex-row items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-gold-500/20 border-4 border-gold-500/40 flex items-center justify-center">
                <Users size={40} className="text-gold-500" />
              </div>
              <div className="text-center md:text-right">
                <h3 className="text-2xl font-black text-white">{selected.name}</h3>
                <div className={`mt-2 inline-block px-4 py-1 rounded-full text-sm font-black ${selected.balance > 0 ? 'bg-emerald-500/20 text-emerald-300' : selected.balance < 0 ? 'bg-red-500/20 text-red-300' : 'bg-white/10 text-slate-300'}`}>
                  الرصيد: {fmtNumber(selected.balance)} ر.س
                </div>
              </div>
            </div>
            <div className="p-6 space-y-4">
              {selected.phone && (
                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-brand-800/40 rounded-xl border border-slate-100 dark:border-brand-700">
                  <Phone size={18} className="text-gold-500" />
                  <div><p className="text-xs text-slate-400 dark:text-brand-400 font-medium">الهاتف</p><p className="font-black text-brand-800 dark:text-brand-100" dir="ltr">{selected.phone}</p></div>
                </div>
              )}
              {selected.email && (
                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-brand-800/40 rounded-xl border border-slate-100 dark:border-brand-700">
                  <Mail size={18} className="text-gold-500" />
                  <div><p className="text-xs text-slate-400 dark:text-brand-400 font-medium">البريد الإلكتروني</p><p className="font-black text-brand-800 dark:text-brand-100">{selected.email}</p></div>
                </div>
              )}
              {selected.address && (
                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-brand-800/40 rounded-xl border border-slate-100 dark:border-brand-700">
                  <MapPin size={18} className="text-gold-500" />
                  <div><p className="text-xs text-slate-400 dark:text-brand-400 font-medium">العنوان</p><p className="font-black text-brand-800 dark:text-brand-100">{selected.address}</p></div>
                </div>
              )}
              {selected.vat_number && (
                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-brand-800/40 rounded-xl border border-slate-100 dark:border-brand-700">
                  <span className="text-gold-500 font-black text-xs w-[18px] text-center">ض</span>
                  <div><p className="text-xs text-slate-400 dark:text-brand-400 font-medium">الرقم الضريبي</p><p className="font-black text-brand-800 dark:text-brand-100 font-mono" dir="ltr">{selected.vat_number}</p></div>
                </div>
              )}
              {selected.cr_number && (
                <div className="flex items-center gap-3 p-4 bg-slate-50 dark:bg-brand-800/40 rounded-xl border border-slate-100 dark:border-brand-700">
                  <span className="text-gold-500 font-black text-xs w-[18px] text-center">س</span>
                  <div><p className="text-xs text-slate-400 dark:text-brand-400 font-medium">رقم السجل التجاري</p><p className="font-black text-brand-800 dark:text-brand-100 font-mono" dir="ltr">{selected.cr_number}</p></div>
                </div>
              )}
              {selected.notes && (
                <div className="p-4 bg-amber-50 dark:bg-amber-500/15 rounded-xl border border-amber-100 dark:border-amber-500/30">
                  <p className="text-xs text-amber-600 dark:text-amber-300 font-bold mb-1">ملاحظات</p>
                  <p className="text-sm text-slate-700 dark:text-brand-300 font-medium">{selected.notes}</p>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => navigate(`/admin/dashboard/parties/${selected.id}`)}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-100 dark:bg-brand-800 hover:bg-slate-200 dark:hover:bg-brand-700 text-brand-800 dark:text-brand-100 py-4 rounded-2xl font-black transition border border-slate-200 dark:border-brand-700">
              <BookOpen size={18} /> كشف الحساب
            </button>
            <button onClick={() => openEdit(selected._raw)}
              className="flex-1 flex items-center justify-center gap-2 bg-brand-800 hover:bg-brand-900 text-white py-4 rounded-2xl font-black transition shadow-md">
              <Edit3 size={18} /> تعديل
            </button>
            <button onClick={() => setConfirmId(selected.id)}
              className="flex-1 flex items-center justify-center gap-2 bg-red-50 hover:bg-red-600 text-red-600 hover:text-white py-4 rounded-2xl font-black transition border border-red-200">
              <Trash2 size={18} /> حذف
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── إنشاء / تعديل ───────────────────────────────────────────
  const isEdit = view === 'edit';
  return (
    <div className="pt-24 pb-20 bg-transparent min-h-screen" dir="rtl">
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => setView(isEdit ? 'detail' : 'list')} className="p-3 bg-white dark:bg-brand-900 rounded-full border border-slate-200 dark:border-brand-700 hover:bg-slate-100 dark:hover:bg-brand-800 transition">
            <ChevronRight size={22} className="text-slate-500 dark:text-brand-300" />
          </button>
          <h2 className="text-xl font-black text-brand-800 dark:text-brand-100">{isEdit ? 'تعديل بيانات العميل' : 'إضافة عميل جديد'}</h2>
        </div>
        <div className="bg-white dark:bg-brand-900 rounded-[2rem] shadow-sm border border-slate-100 dark:border-brand-700 p-6 md:p-8 space-y-5">
          <div>
            <label className="block text-xs font-black text-brand-800 dark:text-brand-100 mb-1.5">الاسم <span className="text-red-500">*</span></label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم العميل أو الشركة..."
              className="w-full bg-slate-50 dark:bg-brand-800/40 border border-slate-200 dark:border-brand-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-brand-50 dark:placeholder-brand-500 outline-none focus:border-gold-500 transition" />
          </div>
          <div>
            <label className="block text-xs font-black text-brand-800 dark:text-brand-100 mb-1.5 flex items-center gap-1"><Phone size={13} /> الهاتف</label>
            <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="05xxxxxxxx" dir="ltr"
              className="w-full bg-slate-50 dark:bg-brand-800/40 border border-slate-200 dark:border-brand-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-brand-50 dark:placeholder-brand-500 outline-none focus:border-gold-500 transition" />
          </div>
          <div>
            <label className="block text-xs font-black text-brand-800 dark:text-brand-100 mb-1.5 flex items-center gap-1"><Mail size={13} /> البريد الإلكتروني</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="example@domain.com" dir="ltr"
              className="w-full bg-slate-50 dark:bg-brand-800/40 border border-slate-200 dark:border-brand-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-brand-50 dark:placeholder-brand-500 outline-none focus:border-gold-500 transition" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-500 dark:text-brand-400 mb-1.5">الرقم الضريبي</label>
              <input type="text" value={form.vat_number} onChange={(e) => setForm({ ...form, vat_number: e.target.value })} placeholder="3xxxxxxxxxxxxxxxxx" dir="ltr"
                className="w-full bg-slate-50 dark:bg-brand-800/40 border border-slate-200 dark:border-brand-700 rounded-xl px-4 py-3 text-sm font-mono text-slate-700 dark:text-brand-50 dark:placeholder-brand-500 outline-none focus:border-gold-500 transition" />
            </div>
            <div>
              <label className="block text-xs font-black text-slate-500 dark:text-brand-400 mb-1.5">رقم السجل التجاري</label>
              <input type="text" value={form.cr_number} onChange={(e) => setForm({ ...form, cr_number: e.target.value })} placeholder="10xxxxxxxx" dir="ltr"
                className="w-full bg-slate-50 dark:bg-brand-800/40 border border-slate-200 dark:border-brand-700 rounded-xl px-4 py-3 text-sm font-mono text-slate-700 dark:text-brand-50 dark:placeholder-brand-500 outline-none focus:border-gold-500 transition" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-black text-brand-800 dark:text-brand-100 mb-1.5 flex items-center gap-1"><MapPin size={13} /> العنوان</label>
            <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="المدينة، الحي..."
              className="w-full bg-slate-50 dark:bg-brand-800/40 border border-slate-200 dark:border-brand-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-brand-50 dark:placeholder-brand-500 outline-none focus:border-gold-500 transition" />
          </div>
          <div>
            <label className="block text-xs font-black text-brand-800 dark:text-brand-100 mb-1.5">ملاحظات</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="أي ملاحظات إضافية..." rows={3}
              className="w-full bg-slate-50 dark:bg-brand-800/40 border border-slate-200 dark:border-brand-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-700 dark:text-brand-50 dark:placeholder-brand-500 outline-none focus:border-gold-500 transition resize-none" />
          </div>
          <button onClick={isEdit ? handleUpdate : handleCreate} disabled={saving}
            className="w-full flex items-center justify-center gap-2 bg-brand-800 hover:bg-brand-900 text-white py-4 rounded-2xl font-black transition shadow-md disabled:opacity-60">
            {saving ? <RefreshCw size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
            {saving ? 'جاري الحفظ...' : isEdit ? 'حفظ التعديلات' : 'إضافة العميل'}
          </button>
        </div>
      </div>
    </div>
  );
}
