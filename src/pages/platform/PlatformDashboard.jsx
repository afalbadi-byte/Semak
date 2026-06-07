import React, { useState, useEffect, useContext, useCallback } from 'react';
import { Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import { AppContext } from '../../context/AppContext';
import { API_URL, LS_PLATFORM_JWT } from '../../lib/api/client';
import {
  LayoutDashboard, Users, Settings, LogOut, RefreshCw,
  Plus, Search, ChevronRight, Building2, CheckCircle2,
  XCircle, Clock, TrendingUp, Package, FileText,
  ShieldCheck, AlertTriangle, Pencil, X, Check,
  Globe, Palette, Phone, Mail, Hash, Send, DollarSign,
  PauseCircle, Ban
} from 'lucide-react';

// ─── API helper (platform-scoped) ───────────────────────────────────────────
async function platApi(action, body = null) {
  const token = localStorage.getItem(LS_PLATFORM_JWT);
  const opts = {
    method: body ? 'POST' : 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  };
  if (body) opts.body = JSON.stringify({ action, ...body });
  const url = body ? `${API_URL}?action=${action}` : `${API_URL}?action=${action}`;
  const res = await fetch(url, opts);
  return res.json();
}

// ─── Shared UI atoms ─────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    active:    'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    suspended: 'bg-amber-500/10  text-amber-400  border-amber-500/20',
    cancelled: 'bg-red-500/10    text-red-400    border-red-500/20',
  };
  const icons = { active: <CheckCircle2 size={11} />, suspended: <AlertTriangle size={11} />, cancelled: <XCircle size={11} /> };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${map[status] || map.active}`}>
      {icons[status]} {status}
    </span>
  );
};

const PlanBadge = ({ plan }) => {
  const map = {
    trial:      'bg-slate-500/10 text-slate-400 border-slate-500/20',
    starter:    'bg-blue-500/10  text-blue-400  border-blue-500/20',
    pro:        'bg-purple-500/10 text-purple-400 border-purple-500/20',
    enterprise: 'bg-[#c5a059]/10 text-[#c5a059] border-[#c5a059]/20',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wide ${map[plan] || map.trial}`}>
      {plan}
    </span>
  );
};

const Stat = ({ icon, label, value, sub }) => (
  <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
    <div className="flex items-center gap-2 mb-2">
      <div className="text-[#c5a059]">{icon}</div>
      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">{label}</span>
    </div>
    <div className="text-3xl font-black text-white tabular-nums">{value}</div>
    {sub && <div className="text-xs text-slate-600 mt-0.5">{sub}</div>}
  </div>
);

// ─── Overview Tab ──────────────────────────────────────────────────────────
function OverviewTab() {
  const [stats,        setStats]        = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [sending,      setSending]      = useState(false);
  const [reminderRes,  setReminderRes]  = useState(null);

  const reload = () => {
    setLoading(true);
    platApi('platform_stats').then(r => {
      if (r.success) setStats(r.stats);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { reload(); }, []);

  const sendReminders = async () => {
    setSending(true); setReminderRes(null);
    try {
      const r = await platApi('platform_trial_reminders');
      setReminderRes(r);
    } catch { setReminderRes({ success: false, message: 'Network error' }); }
    finally { setSending(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <RefreshCw size={24} className="animate-spin text-[#c5a059]" />
    </div>
  );

  const mrr = stats?.mrr ?? 0;
  const mrrFmt = mrr >= 1000 ? `${(mrr/1000).toFixed(1)}k` : String(mrr);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-black text-white">Platform Overview</h2>
        <div className="flex gap-2">
          <button onClick={reload} className="px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-xs font-bold transition flex items-center gap-1.5">
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={sendReminders} disabled={sending}
            className="px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50">
            {sending ? <RefreshCw size={13} className="animate-spin"/> : <Send size={13} />}
            Send Trial Reminders
          </button>
        </div>
      </div>

      {/* Row 1 — tenant counts */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={<Building2 size={18} />}    label="Total Tenants"  value={stats?.total ?? 0}     sub={`${stats?.active ?? 0} active`} />
        <Stat icon={<Clock size={18} />}         label="On Trial"       value={stats?.trial ?? 0}     sub={stats?.expiredTrials ? `${stats.expiredTrials} expired` : 'active trials'} />
        <Stat icon={<TrendingUp size={18} />}    label="New This Month" value={stats?.newMonth ?? 0}  sub="signups" />
        <Stat icon={<Users size={18} />}         label="Total Users"    value={stats?.users ?? 0}     sub="across all tenants" />
      </div>

      {/* Row 2 — revenue + health */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={<DollarSign size={18} />}   label="MRR (SAR)"      value={`${mrrFmt} ﷼`}         sub={`${stats?.paid ?? 0} paid tenants`} />
        <Stat icon={<FileText size={18} />}     label="Total Invoices" value={(stats?.invs ?? 0).toLocaleString()} sub="all tenants" />
        <Stat icon={<PauseCircle size={18} />}  label="Suspended"      value={stats?.suspended ?? 0} sub="need attention" />
        <Stat icon={<Ban size={18} />}           label="Cancelled"      value={stats?.cancelled ?? 0} sub="churned" />
      </div>

      {/* Expired trials alert */}
      {(stats?.expiredTrials ?? 0) > 0 && (
        <div className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-amber-400 text-sm font-bold">
          <AlertTriangle size={16} className="shrink-0" />
          {stats.expiredTrials} trial tenant{stats.expiredTrials > 1 ? 's' : ''} expired — they will be auto-suspended on next login.
        </div>
      )}

      {/* Reminder result */}
      {reminderRes && (
        <div className={`rounded-xl px-4 py-3 text-sm font-bold border ${reminderRes.success ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
          {reminderRes.success
            ? `✓ Sent ${reminderRes.total_sent} reminder${reminderRes.total_sent !== 1 ? 's' : ''} — ${reminderRes.total_failed} failed.`
            : `✗ ${reminderRes.message}`}
          {reminderRes.sent?.length > 0 && (
            <div className="mt-2 space-y-0.5 text-xs font-normal">
              {reminderRes.sent.map((s, i) => (
                <div key={i} className="text-emerald-300">{s.name} ({s.email}) — {s.type === 'soon' ? `${s.days}d left` : 'expired'}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Trial days remaining helper ──────────────────────────────────────────
function trialDaysLeft(trial_ends) {
  if (!trial_ends) return null;
  const diff = Math.ceil((new Date(trial_ends) - new Date()) / 86400000);
  return diff;
}

// ─── Tenant Row (in list) ─────────────────────────────────────────────────
const TenantRow = ({ t, onClick }) => {
  const days = t.plan === 'trial' ? trialDaysLeft(t.trial_ends) : null;
  return (
    <tr
      onClick={onClick}
      className="border-b border-slate-800/60 hover:bg-slate-800/40 cursor-pointer transition group"
    >
      <td className="px-4 py-3">
        <div className="font-bold text-white text-sm">{t.name}</div>
        <div className="text-[11px] text-slate-500 font-mono">{t.slug}</div>
      </td>
      <td className="px-4 py-3"><PlanBadge plan={t.plan} /></td>
      <td className="px-4 py-3"><StatusBadge status={t.status} /></td>
      <td className="px-4 py-3 text-slate-400 text-sm">{t.owner_email}</td>
      <td className="px-4 py-3 text-slate-500 text-xs">
        {t.trial_ends ? (
          <span className={days !== null && days <= 3 ? (days <= 0 ? 'text-red-400 font-bold' : 'text-amber-400 font-bold') : ''}>
            {new Date(t.trial_ends).toLocaleDateString('en-SA')}
            {days !== null && days <= 7 && (
              <span className="ml-1">
                ({days <= 0 ? 'expired' : `${days}d left`})
              </span>
            )}
          </span>
        ) : '—'}
      </td>
      <td className="px-4 py-3 text-slate-400 text-sm text-right">{t.user_count ?? 0}</td>
      <td className="px-4 py-3 text-slate-400 text-sm text-right">{t.invoice_count ?? 0}</td>
      <td className="px-4 py-3 text-right">
        <ChevronRight size={14} className="text-slate-600 group-hover:text-[#c5a059] transition inline-block" />
      </td>
    </tr>
  );
};

// ─── Create Tenant Modal ──────────────────────────────────────────────────
function CreateTenantModal({ onClose, onCreated }) {
  const [form, setForm]     = useState({ name: '', slug: '', owner_name: '', owner_email: '', phone: '', plan: 'trial', notes: '' });
  const [saving,  setSaving]  = useState(false);
  const [err,     setErr]     = useState('');
  const [success, setSuccess] = useState(null); // result after creation

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  // auto-slug from name
  const handleName = (v) => {
    set('name', v);
    const slug = v.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9\-]/g, '').slice(0, 40);
    set('slug', slug);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      const r = await platApi('platform_tenant_create', form);
      if (r.success) { setSuccess(r); }
      else setErr(r.message || 'Error');
    } catch { setErr('Network error'); }
    finally { setSaving(false); }
  };

  // show success screen
  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
        <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md shadow-2xl p-8 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
            <Check size={28} className="text-emerald-400" />
          </div>
          <h3 className="font-black text-white text-lg mb-1">Tenant Created!</h3>
          <p className="text-slate-400 text-sm mb-4">{success.message}</p>
          <div className="bg-slate-950 rounded-xl p-4 text-left space-y-1.5 mb-6">
            <div className="flex justify-between text-sm"><span className="text-slate-500">Tenant ID</span><span className="text-white font-bold">#{success.tenant_id}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Slug</span><code className="text-[#c5a059]">{success.slug}</code></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Email sent</span><span className={success.email_sent ? 'text-emerald-400' : 'text-slate-500'}>{success.email_sent ? '✓ Sent' : '— (SMTP not configured)'}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">WhatsApp</span><span className={success.wa_sent ? 'text-emerald-400' : 'text-slate-500'}>{success.wa_sent ? '✓ Sent' : '— (no phone / WA error)'}</span></div>
          </div>
          <button onClick={() => { onCreated(success); }}
            className="w-full py-3 bg-[#c5a059] hover:bg-[#b8913f] text-slate-950 font-black rounded-xl transition">
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h3 className="font-black text-white">New Tenant</h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-slate-500 mb-1 uppercase tracking-widest">Company Name *</label>
              <input value={form.name} onChange={e => handleName(e.target.value)} required
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#c5a059]/60"
                placeholder="شركة النخبة العقارية" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1 uppercase tracking-widest">Slug *</label>
              <div className="relative">
                <Hash size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input value={form.slug} onChange={e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9\-]/g, ''))} required
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg pl-7 pr-3 py-2.5 text-sm font-mono outline-none focus:border-[#c5a059]/60"
                  placeholder="al-nakhba" />
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1 uppercase tracking-widest">Plan</label>
              <select value={form.plan} onChange={e => set('plan', e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#c5a059]/60">
                {['trial','starter','pro','enterprise'].map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1 uppercase tracking-widest">Owner Name *</label>
              <input value={form.owner_name} onChange={e => set('owner_name', e.target.value)} required
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#c5a059]/60"
                placeholder="محمد العمري" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1 uppercase tracking-widest">Phone</label>
              <div className="relative">
                <Phone size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input value={form.phone} onChange={e => set('phone', e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg pl-7 pr-3 py-2.5 text-sm outline-none focus:border-[#c5a059]/60"
                  placeholder="05xxxxxxxx" />
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-500 mb-1 uppercase tracking-widest">Owner Email *</label>
              <div className="relative">
                <Mail size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                <input type="email" value={form.owner_email} onChange={e => set('owner_email', e.target.value)} required
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg pl-7 pr-3 py-2.5 text-sm outline-none focus:border-[#c5a059]/60"
                  placeholder="owner@company.sa" />
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-500 mb-1 uppercase tracking-widest">Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2.5 text-sm outline-none focus:border-[#c5a059]/60 resize-none"
                placeholder="Optional notes…" />
            </div>
          </div>

          {err && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{err}</p>}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-sm font-bold transition">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 rounded-lg bg-[#c5a059] hover:bg-[#b8913f] text-slate-950 font-black text-sm transition flex items-center justify-center gap-2 disabled:opacity-50">
              {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
              Create Tenant
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Tenant Detail Panel ───────────────────────────────────────────────────
function TenantDetail({ tenantId, onBack, onUpdated }) {
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(true);
  const [editing,   setEditing]   = useState(false);
  const [form,      setForm]      = useState({});
  const [saving,    setSaving]    = useState(false);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    platApi('platform_tenant_get', { id: tenantId })
      .then(r => { if (r.success) { setData(r); setForm(r.tenant); } })
      .finally(() => setLoading(false));
  }, [tenantId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    const r = await platApi('platform_tenant_update', { id: tenantId, ...form });
    setSaving(false);
    if (r.success) { setEditing(false); load(); onUpdated?.(); }
  };

  const resendInvite = async () => {
    setResending(true); setResendMsg(null);
    try {
      const r = await platApi('platform_resend_invite', { id: tenantId });
      setResendMsg(r.success
        ? `✓ Sent — Email: ${r.email_sent ? 'ok' : 'failed'}, WhatsApp: ${r.wa_sent ? 'ok' : '—'}`
        : `✗ ${r.message}`);
    } catch { setResendMsg('✗ Network error'); }
    finally { setResending(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <RefreshCw size={24} className="animate-spin text-[#c5a059]" />
    </div>
  );
  if (!data) return <div className="text-slate-500 py-20 text-center">Tenant not found</div>;

  const { tenant, settings, users } = data;

  const Field = ({ label, fkey, type = 'text' }) => (
    <div>
      <div className="text-[10px] text-slate-600 uppercase tracking-widest mb-1">{label}</div>
      {editing
        ? <input type={type} value={form[fkey] ?? ''} onChange={e => setForm(p => ({ ...p, [fkey]: e.target.value }))}
            className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-[#c5a059]/60" />
        : <div className="text-white text-sm font-bold">{tenant[fkey] || '—'}</div>
      }
    </div>
  );

  const SelectField = ({ label, fkey, options }) => (
    <div>
      <div className="text-[10px] text-slate-600 uppercase tracking-widest mb-1">{label}</div>
      {editing
        ? <select value={form[fkey] ?? ''} onChange={e => setForm(p => ({ ...p, [fkey]: e.target.value }))}
            className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-[#c5a059]/60">
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        : editing
          ? null
          : <PlanBadge plan={tenant[fkey]} />
      }
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="text-slate-500 hover:text-[#c5a059] text-sm transition flex items-center gap-1">
          <ChevronRight size={14} className="rotate-180" /> Tenants
        </button>
        <span className="text-slate-700">/</span>
        <span className="text-white text-sm font-bold">{tenant.name}</span>
      </div>

      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-xl font-black text-white">{tenant.name}</h2>
            <div className="flex items-center gap-2 mt-1.5">
              <code className="text-[#c5a059] text-xs bg-[#c5a059]/10 px-2 py-0.5 rounded">{tenant.slug}</code>
              <StatusBadge status={tenant.status} />
              <PlanBadge plan={tenant.plan} />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {/* Resend invite button — always visible */}
            <div className="flex flex-col items-end gap-1">
              <button onClick={resendInvite} disabled={resending}
                className="px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:border-blue-500/50 hover:text-blue-400 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50">
                {resending ? <RefreshCw size={13} className="animate-spin" /> : <Send size={13} />}
                Resend Invite
              </button>
              {resendMsg && (
                <span className={`text-[10px] font-bold ${resendMsg.startsWith('✓') ? 'text-emerald-400' : 'text-red-400'}`}>
                  {resendMsg}
                </span>
              )}
            </div>
            {editing ? (
              <>
                <button onClick={() => { setEditing(false); setForm(tenant); }}
                  className="px-3 py-2 rounded-lg border border-slate-700 text-slate-400 hover:text-white text-xs font-bold transition flex items-center gap-1.5">
                  <X size={13} /> Cancel
                </button>
                <button onClick={save} disabled={saving}
                  className="px-4 py-2 rounded-lg bg-[#c5a059] text-slate-950 font-black text-xs transition flex items-center gap-1.5 disabled:opacity-50">
                  {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />} Save
                </button>
              </>
            ) : (
              <button onClick={() => setEditing(true)}
                className="px-4 py-2 rounded-lg border border-slate-700 text-slate-300 hover:border-[#c5a059] hover:text-[#c5a059] text-xs font-bold transition flex items-center gap-1.5">
                <Pencil size={13} /> Edit
              </button>
            )}
          </div>
        </div>

        {/* Fields */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-800">
          <Field label="Owner Name"  fkey="owner_name" />
          <Field label="Owner Email" fkey="owner_email" type="email" />
          <Field label="Phone"       fkey="phone" />
          <Field label="CR Number"   fkey="cr_number" />
          <Field label="VAT Number"  fkey="vat_number" />
          <Field label="Domain"      fkey="domain" />
          <Field label="Trial Ends"  fkey="trial_ends" type="date" />
          <Field label="Max Users"   fkey="max_users" type="number" />
          <div>
            <div className="text-[10px] text-slate-600 uppercase tracking-widest mb-1">Plan</div>
            {editing
              ? <select value={form.plan ?? ''} onChange={e => setForm(p => ({ ...p, plan: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-[#c5a059]/60">
                  {['trial','starter','pro','enterprise'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              : <PlanBadge plan={tenant.plan} />
            }
          </div>
          <div>
            <div className="text-[10px] text-slate-600 uppercase tracking-widest mb-1">Status</div>
            {editing
              ? <select value={form.status ?? ''} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-[#c5a059]/60">
                  {['active','suspended','cancelled'].map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              : <StatusBadge status={tenant.status} />
            }
          </div>
          <div className="col-span-2 md:col-span-1">
            <div className="text-[10px] text-slate-600 uppercase tracking-widest mb-1">Primary Color</div>
            {editing
              ? <div className="flex items-center gap-2">
                  <input type="color" value={form.primary_color ?? '#c5a059'}
                    onChange={e => setForm(p => ({ ...p, primary_color: e.target.value }))}
                    className="w-9 h-9 rounded cursor-pointer bg-slate-950 border border-slate-700" />
                  <input type="text" value={form.primary_color ?? ''}
                    onChange={e => setForm(p => ({ ...p, primary_color: e.target.value }))}
                    className="flex-1 bg-slate-950 border border-slate-700 text-white rounded-lg px-2 py-2 text-sm font-mono outline-none focus:border-[#c5a059]/60" />
                </div>
              : <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full border border-slate-700" style={{ background: tenant.primary_color }} />
                  <code className="text-slate-300 text-sm">{tenant.primary_color}</code>
                </div>
            }
          </div>
        </div>

        {/* Notes */}
        {(editing || tenant.notes) && (
          <div className="mt-4 pt-4 border-t border-slate-800">
            <div className="text-[10px] text-slate-600 uppercase tracking-widest mb-1">Notes</div>
            {editing
              ? <textarea value={form.notes ?? ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                  className="w-full bg-slate-950 border border-slate-700 text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-[#c5a059]/60 resize-none" />
              : <p className="text-slate-400 text-sm">{tenant.notes}</p>
            }
          </div>
        )}
      </div>

      {/* Users */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
        <h3 className="font-black text-white mb-4 flex items-center gap-2"><Users size={16} className="text-[#c5a059]" /> Users ({users?.length ?? 0})</h3>
        {users?.length === 0
          ? <p className="text-slate-600 text-sm">No users yet</p>
          : <div className="space-y-2">
              {users?.map(u => (
                <div key={u.id} className="flex items-center justify-between py-2 border-b border-slate-800/60 last:border-0">
                  <div>
                    <div className="text-white text-sm font-bold">{u.name}</div>
                    <div className="text-slate-500 text-xs">{u.email}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-[10px] text-slate-500 bg-slate-800 px-2 py-0.5 rounded">{u.role}</code>
                    <span className={`w-2 h-2 rounded-full ${u.status === 1 || u.status === '1' ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                  </div>
                </div>
              ))}
            </div>
        }
      </div>

      {/* acc_settings */}
      {Object.keys(settings ?? {}).length > 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="font-black text-white mb-4 flex items-center gap-2"><Settings size={16} className="text-[#c5a059]" /> Settings</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(settings ?? {}).filter(([k]) => k !== 'zatca_private_key').map(([k, v]) => (
              <div key={k} className="bg-slate-950/60 rounded-lg p-3">
                <div className="text-[10px] text-slate-600 font-mono mb-0.5">{k}</div>
                <div className="text-slate-300 text-xs font-bold truncate">{v || '—'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tenants Tab ───────────────────────────────────────────────────────────
function TenantsTab() {
  const [tenants, setTenants]    = useState([]);
  const [loading, setLoading]    = useState(true);
  const [search,  setSearch]     = useState('');
  const [showCreate, setCreate]  = useState(false);
  const [selected,   setSelected] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    platApi('platform_tenant_list').then(r => {
      if (r.success) setTenants(r.tenants);
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = tenants.filter(t =>
    !search || [t.name, t.slug, t.owner_email].some(v => v?.toLowerCase().includes(search.toLowerCase()))
  );

  if (selected) {
    return <TenantDetail tenantId={selected} onBack={() => setSelected(null)} onUpdated={load} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-lg font-black text-white">Tenants ({tenants.length})</h2>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              className="bg-slate-900 border border-slate-700 text-white placeholder-slate-600 rounded-lg pl-8 pr-3 py-2 text-sm outline-none focus:border-[#c5a059]/60 w-52"
              placeholder="Search…" />
          </div>
          <button onClick={() => setCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#c5a059] hover:bg-[#b8913f] text-slate-950 font-black rounded-lg text-sm transition">
            <Plus size={16} /> New Tenant
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw size={24} className="animate-spin text-[#c5a059]" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-600">
            {search ? 'No results match your search' : 'No tenants yet — create the first one'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-800">
                  {['Tenant','Plan','Status','Owner Email','Trial Ends','Users','Invoices',''].map(h => (
                    <th key={h} className="px-4 py-3 text-[10px] font-bold text-slate-600 uppercase tracking-widest">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => (
                  <TenantRow key={t.id} t={t} onClick={() => setSelected(t.id)} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateTenantModal
          onClose={() => setCreate(false)}
          onCreated={() => { setCreate(false); load(); }}
        />
      )}
    </div>
  );
}

// ─── Sidebar nav link ─────────────────────────────────────────────────────
const SideLink = ({ to, icon, label, end }) => (
  <NavLink to={to} end={end}
    className={({ isActive }) =>
      `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold transition
       ${isActive
        ? 'bg-[#c5a059]/10 text-[#c5a059] border border-[#c5a059]/20'
        : 'text-slate-400 hover:text-white hover:bg-slate-800/60'}`
    }>
    {icon}
    {label}
  </NavLink>
);

// ─── Main Layout ──────────────────────────────────────────────────────────
export default function PlatformDashboard() {
  const { logoutPlatform } = useContext(AppContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logoutPlatform();
    navigate('/platform/login');
  };

  return (
    <div dir="ltr" className="min-h-screen bg-slate-950 flex">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        {/* Brand */}
        <div className="px-4 py-5 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#c5a059]/10 flex items-center justify-center border border-[#c5a059]/20">
              <ShieldCheck size={16} className="text-[#c5a059]" />
            </div>
            <div>
              <div className="text-white font-black text-sm leading-none">Semak Platform</div>
              <div className="text-slate-600 text-[10px] mt-0.5">Super Admin</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          <SideLink to="/platform/dashboard"          end icon={<LayoutDashboard size={16} />} label="Overview" />
          <SideLink to="/platform/dashboard/tenants"      icon={<Building2 size={16} />}       label="Tenants" />
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-slate-800">
          <button onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-bold text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition">
            <LogOut size={16} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-6 lg:p-8">
          <Routes>
            <Route index                element={<OverviewTab />} />
            <Route path="tenants"       element={<TenantsTab />} />
            <Route path="*"             element={<OverviewTab />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}
