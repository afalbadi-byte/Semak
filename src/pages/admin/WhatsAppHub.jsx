// ════════════════════════════════════════════════════════════════════════════
//  مركز واتساب — بديل داخلي للوحة متصل/Azeer
//  الإحصائيات من قاعدة بياناتنا (كل الرسائل تمر عبر الـwebhook)،
//  والقوالب مباشرة من متصل عبر بروكسي السيرفر (wa_templates) مع إرسال تجريبي.
// ════════════════════════════════════════════════════════════════════════════
import React, { useState, useEffect, useCallback } from 'react';
import {
  MessageCircle, LayoutTemplate, RefreshCw, Send, Users, Bot, UserCircle2,
  Clock, ExternalLink, Search, Megaphone, Inbox, PauseCircle, TrendingUp,
  CheckCircle2, XCircle, Loader2, BellDot,
} from 'lucide-react';
import { apiGet, apiPost, TENANT } from '../../lib/api/client';
import { getAzeerTemplates, normalizePhone } from '../../services/whatsappService';

const fmt = (n) => (Number.isFinite(n) ? n : 0).toLocaleString('en-US');

// ─── بطاقة إحصائية ────────────────────────────────────────────────────────────
function Stat({ icon: Icon, label, value, sub, color = 'emerald' }) {
  return (
    <div className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-200 dark:border-brand-700 p-4">
      <p className="text-xs font-bold text-slate-400 dark:text-brand-400 flex items-center gap-1.5">
        <Icon className={`w-4 h-4 text-${color}-500`} /> {label}
      </p>
      <p className={`text-2xl font-black mt-1 text-${color}-600 dark:text-${color}-400`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 dark:text-brand-500 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── تبويب الإحصائيات ─────────────────────────────────────────────────────────
function StatsTab({ showToast, goTab }) {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiGet('wa_hub_stats', {}, { tenant: TENANT });
      if (r?.success) setStats(r.stats);
      else showToast?.('خطأ', r?.message || 'تعذر جلب الإحصائيات', 'error');
    } catch { showToast?.('خطأ', 'تعذر الاتصال بالخادم', 'error'); }
    setLoading(false);
  }, [showToast]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;
  if (!stats) return <p className="text-center text-slate-400 py-16">لا توجد بيانات</p>;

  const roles = stats.by_role || {};
  const maxDaily = Math.max(1, ...(stats.daily || []).map(d => d.in + d.out));
  const conv = stats.leads_total > 0 ? ((stats.leads_sold / stats.leads_total) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat icon={MessageCircle} label="رسائل اليوم"        value={fmt(stats.today_messages)} sub={`${fmt(stats.week_messages)} هذا الأسبوع`} color="emerald" />
        <Stat icon={Users}         label="عملاء تواصلوا"      value={fmt(stats.unique_customers)} sub={`${fmt(stats.week_customers)} هذا الأسبوع`} color="teal" />
        <Stat icon={BellDot}       label="رسائل غير مقروءة"   value={fmt(stats.unread)} sub={stats.unread > 0 ? 'تحتاج متابعة في الصندوق' : 'كل شيء مقروء'} color={stats.unread > 0 ? 'amber' : 'emerald'} />
        <Stat icon={PauseCircle}   label="فهد موقوف لعملاء"   value={fmt(stats.paused_bots)} sub="تدخل بشري نشط" color={stats.paused_bots > 0 ? 'red' : 'slate'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* نشاط 14 يوماً */}
        <div className="lg:col-span-2 bg-white dark:bg-brand-900 rounded-2xl border border-slate-200 dark:border-brand-700 p-5">
          <h4 className="font-extrabold text-slate-700 dark:text-brand-100 text-sm mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-emerald-500" /> نشاط آخر 14 يوماً
          </h4>
          <div className="flex items-end gap-1.5 h-36">
            {(stats.daily || []).map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group" title={`${d.d}: وارد ${d.in} · صادر ${d.out}`}>
                <div className="w-full flex flex-col justify-end" style={{ height: '120px' }}>
                  <div className="w-full bg-emerald-400 rounded-t-sm" style={{ height: `${(d.out / maxDaily) * 100}%` }} />
                  <div className="w-full bg-teal-600 rounded-b-sm" style={{ height: `${(d.in / maxDaily) * 100}%` }} />
                </div>
                <span className="text-[9px] text-slate-400">{String(d.d).slice(8, 10)}</span>
              </div>
            ))}
            {!stats.daily?.length && <p className="text-slate-400 text-sm m-auto">لا يوجد نشاط بعد</p>}
          </div>
          <div className="flex gap-4 mt-3 text-[11px] text-slate-500 dark:text-brand-400">
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-teal-600 inline-block" /> وارد من العملاء</span>
            <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-emerald-400 inline-block" /> صادر (فهد + الموظفون)</span>
          </div>
        </div>

        {/* توزيع الردود + أنشط الساعات */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-200 dark:border-brand-700 p-5">
            <h4 className="font-extrabold text-slate-700 dark:text-brand-100 text-sm mb-3">من يرد على العملاء؟</h4>
            {[
              { k: 'assistant', label: '🤖 فهد', color: 'bg-teal-500' },
              { k: 'agent',     label: '👤 الموظفون', color: 'bg-blue-500' },
              { k: 'user',      label: '💬 رسائل العملاء', color: 'bg-slate-400' },
            ].map(({ k, label, color }) => {
              const v = roles[k] || 0;
              const total = Object.values(roles).reduce((a, b) => a + b, 0) || 1;
              return (
                <div key={k} className="mb-2.5">
                  <div className="flex justify-between text-xs font-bold text-slate-600 dark:text-brand-300 mb-1">
                    <span>{label}</span><span>{fmt(v)}</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-brand-800 rounded-full overflow-hidden">
                    <div className={`h-full ${color} rounded-full`} style={{ width: `${(v / total) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-200 dark:border-brand-700 p-5">
            <h4 className="font-extrabold text-slate-700 dark:text-brand-100 text-sm mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" /> أنشط ساعات العملاء
            </h4>
            <div className="flex flex-wrap gap-2">
              {(stats.hours || []).map((h, i) => (
                <span key={i} className="text-xs font-bold bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 px-3 py-1.5 rounded-full">
                  {h.h}:00 — {fmt(h.c)} رسالة
                </span>
              ))}
              {!stats.hours?.length && <p className="text-slate-400 text-xs">لا توجد بيانات كافية</p>}
            </div>
          </div>
        </div>
      </div>

      {/* مؤشر المبيعات */}
      <div className="bg-gradient-to-l from-emerald-600 to-teal-600 rounded-2xl p-5 text-white flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="text-sm font-bold opacity-90">قناة واتساب → مبيعات</p>
          <p className="text-2xl font-black mt-1">{fmt(stats.leads_total)} مهتم · {fmt(stats.leads_sold)} بيع · تحويل {conv}%</p>
          <p className="text-xs opacity-75 mt-1">{fmt(stats.leads_week)} مهتم جديد هذا الأسبوع</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => goTab('inbox')} className="bg-white/15 hover:bg-white/25 backdrop-blur px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition">
            <Inbox className="w-4 h-4" /> الصندوق
          </button>
          <button onClick={() => goTab('campaign')} className="bg-white/15 hover:bg-white/25 backdrop-blur px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition">
            <Megaphone className="w-4 h-4" /> حملة جديدة
          </button>
        </div>
      </div>

      <div className="text-left">
        <button onClick={load} className="text-xs font-bold text-slate-400 hover:text-emerald-600 flex items-center gap-1.5 mr-auto transition">
          <RefreshCw className="w-3.5 h-3.5" /> تحديث الإحصائيات
        </button>
      </div>
    </div>
  );
}

// ─── تبويب القوالب ────────────────────────────────────────────────────────────
function TemplatesTab({ showToast }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('all');
  const [testFor, setTestFor] = useState(null);   // القالب المفتوح للإرسال التجريبي
  const [testPhone, setTestPhone] = useState('');
  const [testVars, setTestVars] = useState([]);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const list = await getAzeerTemplates();
    setTemplates(list);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const openTest = (tpl) => {
    const body = tpl.components?.find(c => c.type === 'BODY')?.text || '';
    const count = (body.match(/\{\{\d+\}\}/g) || []).length;
    setTestFor(tpl); setTestVars(Array(count).fill('')); setTestPhone('');
  };

  const sendTest = async () => {
    const phone = normalizePhone(testPhone);
    if (!phone || phone.length < 12) { showToast?.('تنبيه', 'أدخل رقم جوال صحيح', 'error'); return; }
    setSending(true);
    try {
      const res = await fetch(`https://semak.sa/api.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_whatsapp', phone, type: 'template',
          message: `[Template: ${testFor.name}]`,
          template_name: testFor.name, template_lang: testFor.language || 'ar',
          template_vars: testVars,
        }),
      });
      const r = await res.json();
      if (r?.success) { showToast?.('نجاح', `أُرسل قالب ${testFor.name} إلى ${phone}`); setTestFor(null); }
      else showToast?.('خطأ', r?.message || 'فشل الإرسال', 'error');
    } catch { showToast?.('خطأ', 'تعذر الاتصال', 'error'); }
    setSending(false);
  };

  const shown = templates.filter(t => {
    if (filter === 'approved' && String(t.status).toLowerCase() !== 'approved') return false;
    if (filter === 'other'    && String(t.status).toLowerCase() === 'approved') return false;
    const body = t.components?.find(c => c.type === 'BODY')?.text || '';
    return !q.trim() || t.name.includes(q) || body.includes(q);
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="ابحث في القوالب…"
            className="w-full bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-700 rounded-xl pr-9 pl-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-300 dark:text-brand-100" />
        </div>
        {[['all', 'الكل'], ['approved', 'معتمدة'], ['other', 'قيد المراجعة/مرفوضة']].map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k)}
            className={`px-3 py-2 rounded-xl text-xs font-bold transition ${filter === k ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-700 text-slate-500'}`}>
            {l}
          </button>
        ))}
        <button onClick={load} className="p-2.5 bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-700 rounded-xl text-slate-500 hover:text-emerald-600 transition" title="مزامنة من متصل">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
        <a href="https://app.azeer.com/apps/templates" target="_blank" rel="noreferrer"
          className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-600 bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-700 px-3 py-2.5 rounded-xl transition"
          title="إنشاء قالب جديد يتم من منصة متصل (يتطلب موافقة Meta)">
          <ExternalLink className="w-3.5 h-3.5" /> تقديم قالب جديد
        </a>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {shown.map(tpl => {
            const body = tpl.components?.find(c => c.type === 'BODY')?.text || '';
            const approved = String(tpl.status).toLowerCase() === 'approved';
            const varCount = (body.match(/\{\{\d+\}\}/g) || []).length;
            return (
              <div key={tpl.name} className="bg-white dark:bg-brand-900 rounded-2xl border border-slate-200 dark:border-brand-700 p-4 flex flex-col">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h4 className="font-extrabold text-slate-800 dark:text-brand-100 text-sm break-all" dir="ltr">{tpl.name}</h4>
                  <span className={`text-[10px] font-black px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1 ${
                    approved ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'}`}>
                    {approved ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {approved ? 'معتمد' : tpl.status}
                  </span>
                </div>
                <div className="flex gap-1.5 mb-2">
                  <span className="text-[10px] font-bold bg-slate-100 dark:bg-brand-800 text-slate-500 dark:text-brand-300 px-2 py-0.5 rounded-full">{tpl.category}</span>
                  <span className="text-[10px] font-bold bg-slate-100 dark:bg-brand-800 text-slate-500 dark:text-brand-300 px-2 py-0.5 rounded-full">{tpl.language}</span>
                  {varCount > 0 && <span className="text-[10px] font-bold bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-300 px-2 py-0.5 rounded-full">{varCount} متغير</span>}
                </div>
                <p className="text-xs text-slate-600 dark:text-brand-300 leading-relaxed whitespace-pre-wrap bg-slate-50 dark:bg-brand-800/50 rounded-xl p-3 flex-1 max-h-36 overflow-y-auto">{body}</p>
                {approved && (
                  <button onClick={() => openTest(tpl)}
                    className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 border border-emerald-200 dark:border-emerald-800 rounded-xl py-2 transition">
                    <Send className="w-3.5 h-3.5" /> إرسال لرقم
                  </button>
                )}
              </div>
            );
          })}
          {!shown.length && <p className="col-span-full text-center text-slate-400 py-10">لا توجد قوالب مطابقة</p>}
        </div>
      )}

      {/* نافذة الإرسال */}
      {testFor && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setTestFor(null)}>
          <div className="bg-white dark:bg-brand-900 rounded-3xl shadow-2xl p-6 max-w-md w-full" onClick={e => e.stopPropagation()}>
            <h3 className="font-extrabold text-slate-800 dark:text-brand-100 mb-1 flex items-center gap-2">
              <Send className="w-5 h-5 text-emerald-600" /> إرسال قالب
            </h3>
            <p className="text-xs text-slate-400 mb-4" dir="ltr">{testFor.name}</p>
            <label className="text-xs font-bold text-slate-500 dark:text-brand-400 block mb-1">رقم الجوال</label>
            <input value={testPhone} onChange={e => setTestPhone(e.target.value)} dir="ltr" placeholder="05XXXXXXXX أو 9665XXXXXXXX"
              className="w-full border border-slate-200 dark:border-brand-700 rounded-xl px-3 py-2.5 text-sm mb-3 outline-none focus:ring-2 focus:ring-emerald-300 dark:bg-brand-800 dark:text-brand-100" />
            {testVars.map((v, i) => (
              <div key={i} className="mb-2">
                <label className="text-xs font-bold text-purple-600 block mb-1">{`المتغير {{${i + 1}}}`}</label>
                <input value={v} onChange={e => { const nv = [...testVars]; nv[i] = e.target.value; setTestVars(nv); }}
                  className="w-full border border-slate-200 dark:border-brand-700 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-300 dark:bg-brand-800 dark:text-brand-100" />
              </div>
            ))}
            <div className="flex gap-2 mt-4">
              <button onClick={sendTest} disabled={sending}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl transition flex items-center justify-center gap-2 disabled:opacity-60">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} إرسال
              </button>
              <button onClick={() => setTestFor(null)} className="px-5 border border-slate-200 dark:border-brand-700 rounded-xl text-sm font-bold text-slate-500">إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════
export default function WhatsAppHub({ showToast, onNavigateTab }) {
  const [tab, setTab] = useState('stats');
  const goTab = (t) => { if (onNavigateTab) onNavigateTab(t === 'inbox' ? 'whatsapp' : t); };

  return (
    <div className="p-6 md:p-8" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <div>
          <h2 className="text-2xl font-extrabold text-slate-800 dark:text-brand-100 flex items-center gap-2">
            <MessageCircle className="w-7 h-7 text-[#25D366]" /> مركز واتساب
          </h2>
          <p className="text-slate-500 dark:text-brand-300 text-sm mt-1">لوحة تحكم موحدة — إحصائيات القناة وإدارة القوالب دون مغادرة البوابة</p>
        </div>
        <div className="flex gap-2">
          {[['stats', 'الإحصائيات', TrendingUp], ['templates', 'القوالب', LayoutTemplate]].map(([k, l, I]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition ${tab === k ? 'bg-slate-800 dark:bg-emerald-600 text-white' : 'bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-700 text-slate-600 dark:text-brand-300'}`}>
              <I className="w-4 h-4" /> {l}
            </button>
          ))}
        </div>
      </div>
      {tab === 'stats' ? <StatsTab showToast={showToast} goTab={goTab} /> : <TemplatesTab showToast={showToast} />}
    </div>
  );
}
