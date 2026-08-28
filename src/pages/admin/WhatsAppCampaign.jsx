import React, { useState, useEffect, useContext, useMemo } from 'react';
import {
  Send, Users, LayoutTemplate, Search, CheckCircle2, XCircle, RefreshCw,
  Megaphone, Building2, UserPlus, AlertTriangle, Loader2, Phone
} from 'lucide-react';
import { getAzeerTemplates, sendWhatsAppTemplate, normalizePhone } from '../../services/whatsappService';
import { API_URL } from '../../lib/api/client';
import { AppContext } from '../../context/AppContext';

// وحدات مشروع سماك البوابة (مطابقة لصفحة المشاريع) — لتعبئة قوالب العروض بسرعة
const UNITS = [
  { code: 'SM-A01', facade: 'واجهتين',      price: 'تبدأ من 663,695 ريال',   size: '197.5', rooms: '5 غرف' },
  { code: 'SM-A02', facade: 'واجهة أمامية', price: 'تبدأ من 663,695 ريال',   size: '197.5', rooms: '5 غرف' },
  { code: 'SM-A03', facade: 'واجهتين',      price: 'تبدأ من 663,695 ريال',   size: '197.5', rooms: '5 غرف' },
  { code: 'SM-A04', facade: 'واجهة أمامية', price: 'تبدأ من 663,695 ريال',   size: '197.5', rooms: '5 غرف' },
  { code: 'SM-A05', facade: 'واجهتين',      price: 'تبدأ من 663,695 ريال',   size: '197.5', rooms: '5 غرف' },
  { code: 'SM-A06', facade: 'واجهة أمامية', price: 'تبدأ من 663,695 ريال',   size: '197.5', rooms: '5 غرف' },
  { code: 'SM-A07', facade: 'روف فاخر',     price: 'بالتواصل', size: '477', rooms: '4 غرف' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default function WhatsAppCampaign({ showToast }) {
  const { branding } = useContext(AppContext);
  const toast = (t, m, type) => showToast && showToast(t, m, type);

  const [templates, setTemplates]   = useState([]);
  const [tplLoading, setTplLoading] = useState(true);
  const [selectedTpl, setSelectedTpl] = useState(null);

  const [leads, setLeads]   = useState([]);
  const [ldLoading, setLdLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [manualNumbers, setManualNumbers] = useState('');

  const [personalizeFirst, setPersonalizeFirst] = useState(true); // {{1}} = اسم العميل
  const [varValues, setVarValues] = useState({}); // { 2: '...', 3: '...', 4: '...' }
  const [quickUnit, setQuickUnit] = useState('');
  const [testNumber, setTestNumber] = useState('');

  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ done: 0, ok: 0, fail: 0, total: 0 });
  const [results, setResults] = useState(null);

  useEffect(() => { loadTemplates(); loadLeads(); }, []);

  const loadTemplates = async () => {
    setTplLoading(true);
    try {
      const list = await getAzeerTemplates();
      setTemplates(Array.isArray(list) ? list : []);
    } catch { setTemplates([]); }
    finally { setTplLoading(false); }
  };

  const loadLeads = async () => {
    setLdLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=get_leads`);
      const data = await res.json();
      setLeads(Array.isArray(data) ? data.filter(l => l.phone) : []);
    } catch { setLeads([]); }
    finally { setLdLoading(false); }
  };

  // ── تحليل متغيّرات القالب ({{1}}, {{2}}...) من نص BODY ──
  const bodyText = useMemo(
    () => selectedTpl?.components?.find(c => c.type === 'BODY')?.text || '',
    [selectedTpl]
  );
  const varNums = useMemo(() => {
    const nums = (bodyText.match(/\{\{(\d+)\}\}/g) || []).map(m => parseInt(m.replace(/\D/g, ''), 10));
    return [...new Set(nums)].sort((a, b) => a - b);
  }, [bodyText]);

  // القيم القابلة للتعبئة يدوياً (نستثني {{1}} إذا كان تخصيص الاسم مفعّلاً)
  const manualVarNums = varNums.filter(n => !(personalizeFirst && n === 1));

  // ── تعبئة سريعة بوحدة (لقوالب العروض 4 متغيّرات: 1=اسم 2=وحدة 3=واجهة 4=سعر) ──
  const applyUnit = (code) => {
    setQuickUnit(code);
    const u = UNITS.find(x => x.code === code);
    if (!u) return;
    setVarValues(v => ({ ...v, 2: u.code, 3: u.facade, 4: u.price }));
  };

  // ── قائمة المستقبِلين النهائية (leads مختارون + أرقام يدوية، بلا تكرار) ──
  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      if (statusFilter && l.status !== statusFilter) return false;
      if (sourceFilter && l.source !== sourceFilter) return false;
      if (search) {
        const q = search.trim();
        if (!(`${l.name || ''} ${l.phone || ''}`.includes(q))) return false;
      }
      return true;
    });
  }, [leads, statusFilter, sourceFilter, search]);

  const recipients = useMemo(() => {
    const map = new Map();
    leads.filter(l => selectedIds.has(l.id)).forEach(l => {
      const p = normalizePhone(l.phone);
      if (p && !map.has(p)) map.set(p, { phone: p, name: l.name || 'عميلنا العزيز' });
    });
    manualNumbers.split(/[\n,]+/).map(s => s.trim()).filter(Boolean).forEach(raw => {
      const p = normalizePhone(raw);
      if (p && !map.has(p)) map.set(p, { phone: p, name: 'عميلنا العزيز' });
    });
    return [...map.values()];
  }, [leads, selectedIds, manualNumbers]);

  const statuses = useMemo(() => [...new Set(leads.map(l => l.status).filter(Boolean))], [leads]);
  const sources  = useMemo(() => [...new Set(leads.map(l => l.source).filter(Boolean))], [leads]);

  const toggleId = (id) => setSelectedIds(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const selectAllFiltered = () => setSelectedIds(s => { const n = new Set(s); filteredLeads.forEach(l => n.add(l.id)); return n; });
  const clearSelection = () => setSelectedIds(new Set());

  // ── بناء متغيّرات BODY لمستقبِل معيّن ──
  const buildVars = (name) => varNums.map(n => (personalizeFirst && n === 1) ? name : (varValues[n] || ''));

  // ── معاينة (لأول مستقبِل) ──
  const preview = useMemo(() => {
    if (!bodyText) return '';
    const name = recipients[0]?.name || 'أبو محمد';
    let txt = bodyText;
    varNums.forEach(n => {
      const val = (personalizeFirst && n === 1) ? name : (varValues[n] || `{{${n}}}`);
      txt = txt.replaceAll(`{{${n}}}`, val);
    });
    return txt;
  }, [bodyText, varNums, varValues, personalizeFirst, recipients]);

  const missingVars = manualVarNums.filter(n => !((varValues[n] || '').trim()));

  // ── إرسال تجريبي لرقم واحد ──
  const sendTest = async () => {
    if (!selectedTpl) return toast('تنبيه', 'اختر قالباً أولاً', 'error');
    if (!testNumber.trim()) return toast('تنبيه', 'أدخل رقم التجربة', 'error');
    setSending(true);
    const res = await sendWhatsAppTemplate(normalizePhone(testNumber), selectedTpl.name, buildVars('عميلنا العزيز'));
    setSending(false);
    res.success ? toast('تم الإرسال ✅', 'وصلت رسالة التجربة') : toast('فشل', res.error || 'تحقق من القالب', 'error');
  };

  // ── إرسال الحملة ──
  const sendCampaign = async () => {
    if (!selectedTpl) return toast('تنبيه', 'اختر قالباً', 'error');
    if (recipients.length === 0) return toast('تنبيه', 'اختر مستقبِلين', 'error');
    if (missingVars.length) return toast('تنبيه', `عبّئ المتغيّرات: ${missingVars.map(n => `{{${n}}}`).join(' ')}`, 'error');
    if (!confirm(`إرسال قالب «${selectedTpl.name}» إلى ${recipients.length} مستقبِل؟\n\nتأكّد أن لديهم موافقة استقبال (opt-in). فهد بيتولّى الردود.`)) return;

    setSending(true);
    setResults(null);
    let ok = 0, fail = 0;
    const fails = [];
    for (let i = 0; i < recipients.length; i++) {
      const r = recipients[i];
      try {
        const res = await sendWhatsAppTemplate(r.phone, selectedTpl.name, buildVars(r.name));
        res.success ? ok++ : (fail++, fails.push({ ...r, error: res.error }));
      } catch (e) { fail++; fails.push({ ...r, error: e.message }); }
      setProgress({ done: i + 1, ok, fail, total: recipients.length });
      if (i < recipients.length - 1) await sleep(1500); // تحكّم بالمعدّل
    }
    setSending(false);
    setResults({ ok, fail, fails });
    toast(fail ? 'اكتمل مع أخطاء' : 'تمّت الحملة ✅', `أُرسل ${ok} · فشل ${fail}`, fail ? 'error' : 'success');
  };

  const card = 'bg-white dark:bg-brand-900/40 rounded-2xl border border-slate-100 dark:border-brand-700 shadow-sm';
  const label = 'text-xs font-bold text-slate-500 dark:text-brand-300 mb-1 block';
  const input = 'w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-brand-700 bg-white dark:bg-brand-900 text-sm text-slate-800 dark:text-brand-100 focus:border-gold-500 outline-none';

  return (
    <div className="max-w-6xl mx-auto space-y-6" dir="rtl">
      {/* الترويسة */}
      <div className={`${card} p-6`}>
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gold-500/10 flex items-center justify-center"><Megaphone className="text-gold-500" /></div>
          <div>
            <h2 className="text-2xl font-black text-brand-800 dark:text-brand-100">الحملات التسويقية — واتساب</h2>
            <p className="text-sm text-slate-500 dark:text-brand-300">أرسل قالباً معتمداً لشريحة من العملاء، وفهد يتولّى الردود تلقائياً.</p>
          </div>
        </div>
        <div className="mt-4 flex items-start gap-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>القوالب التسويقية تتطلب موافقة العميل المسبقة (opt-in). التزم بحدود واتساب لتجنّب حظر الرقم — يوجد فاصل زمني تلقائي بين الرسائل.</span>
        </div>
      </div>

      {/* الخطوة 1: القالب */}
      <div className={`${card} p-6`}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-black text-brand-800 dark:text-brand-100 flex items-center gap-2"><LayoutTemplate size={18} className="text-gold-500" /> ١) اختر القالب</h3>
          <button onClick={loadTemplates} className="text-xs text-slate-500 hover:text-gold-500 flex items-center gap-1"><RefreshCw size={13} /> تحديث</button>
        </div>
        {tplLoading ? (
          <p className="text-sm text-slate-400 flex items-center gap-2"><Loader2 size={16} className="animate-spin" /> جاري جلب القوالب المعتمدة…</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-slate-400">لا توجد قوالب معتمدة. أنشئ قوالبك في لوحة Mottasl واعتمدها من Meta أولاً.</p>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {templates.map(tpl => {
              const active = selectedTpl?.name === tpl.name;
              const body = tpl.components?.find(c => c.type === 'BODY')?.text || '';
              return (
                <button key={tpl.id || tpl.name} onClick={() => { setSelectedTpl(tpl); setVarValues({}); setQuickUnit(''); }}
                  className={`text-right p-3 rounded-xl border transition ${active ? 'border-gold-500 bg-gold-500/5 ring-1 ring-gold-500' : 'border-slate-200 dark:border-brand-700 hover:border-gold-400'}`}>
                  <div className="font-bold text-sm text-brand-800 dark:text-brand-100 mb-1 truncate">{tpl.name}</div>
                  <div className="text-[11px] text-slate-500 dark:text-brand-300 line-clamp-3 leading-relaxed">{body.slice(0, 140)}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* الخطوة 2: المتغيّرات */}
      {selectedTpl && varNums.length > 0 && (
        <div className={`${card} p-6`}>
          <h3 className="font-black text-brand-800 dark:text-brand-100 mb-4 flex items-center gap-2"><Building2 size={18} className="text-gold-500" /> ٢) تعبئة المتغيّرات</h3>

          {varNums.includes(1) && (
            <label className="flex items-center gap-2 mb-4 text-sm text-slate-700 dark:text-brand-200 cursor-pointer">
              <input type="checkbox" checked={personalizeFirst} onChange={e => setPersonalizeFirst(e.target.checked)} className="accent-gold-500" />
              المتغيّر <code className="bg-slate-100 dark:bg-brand-800 px-1 rounded">{'{{1}}'}</code> = اسم العميل (تخصيص تلقائي لكل مستقبِل)
            </label>
          )}

          {manualVarNums.length >= 3 && (
            <div className="mb-4">
              <span className={label}>تعبئة سريعة بوحدة من سماك البوابة (يملأ الوحدة/الواجهة/السعر)</span>
              <select value={quickUnit} onChange={e => applyUnit(e.target.value)} className={input}>
                <option value="">— اختر وحدة —</option>
                {UNITS.map(u => <option key={u.code} value={u.code}>{u.code} · {u.rooms} · {u.size}م² · {u.facade} · {u.price}</option>)}
              </select>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3">
            {manualVarNums.map(n => (
              <div key={n}>
                <span className={label}>المتغيّر {`{{${n}}}`}</span>
                <input value={varValues[n] || ''} onChange={e => setVarValues(v => ({ ...v, [n]: e.target.value }))}
                  placeholder={`قيمة {{${n}}}`} className={input} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* الخطوة 3: المستقبِلون */}
      {selectedTpl && (
        <div className={`${card} p-6`}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-black text-brand-800 dark:text-brand-100 flex items-center gap-2"><Users size={18} className="text-gold-500" /> ٣) المستقبِلون</h3>
            <span className="text-sm font-bold text-gold-500">{recipients.length} مستقبِل</span>
          </div>

          {/* فلاتر */}
          <div className="grid sm:grid-cols-3 gap-2 mb-3">
            <div className="relative">
              <Search size={14} className="absolute right-2 top-2.5 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الجوال" className={`${input} pr-7`} />
            </div>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className={input}>
              <option value="">كل الحالات</option>
              {statuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value)} className={input}>
              <option value="">كل المصادر</option>
              {sources.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2 mb-2 text-xs">
            <button onClick={selectAllFiltered} className="px-3 py-1 rounded-lg bg-brand-800 text-white hover:bg-gold-500 transition">تحديد الظاهر ({filteredLeads.length})</button>
            <button onClick={clearSelection} className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-brand-800 text-slate-600 dark:text-brand-300 hover:bg-slate-200">إلغاء التحديد</button>
            <button onClick={loadLeads} className="text-slate-400 hover:text-gold-500 flex items-center gap-1 mr-auto"><RefreshCw size={12} /> تحديث</button>
          </div>

          {/* قائمة الـleads */}
          <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-100 dark:border-brand-700 divide-y divide-slate-100 dark:divide-brand-800">
            {ldLoading ? <p className="p-4 text-sm text-slate-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> جاري التحميل…</p>
              : filteredLeads.length === 0 ? <p className="p-4 text-sm text-slate-400">لا يوجد عملاء مطابقون.</p>
              : filteredLeads.map(l => (
                <label key={l.id} className="flex items-center gap-3 p-2.5 hover:bg-slate-50 dark:hover:bg-brand-800/40 cursor-pointer text-sm">
                  <input type="checkbox" checked={selectedIds.has(l.id)} onChange={() => toggleId(l.id)} className="accent-gold-500" />
                  <span className="font-bold text-brand-800 dark:text-brand-100 flex-1">{l.name || '—'}</span>
                  <span dir="ltr" className="text-slate-500 dark:text-brand-300 text-xs">{l.phone}</span>
                  {l.status && <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-brand-800 text-slate-500">{l.status}</span>}
                </label>
              ))}
          </div>

          {/* أرقام يدوية */}
          <div className="mt-3">
            <span className={label}><UserPlus size={12} className="inline" /> أرقام إضافية يدوياً (سطر أو فاصلة بين كل رقم)</span>
            <textarea value={manualNumbers} onChange={e => setManualNumbers(e.target.value)} rows={2}
              placeholder="05xxxxxxxx، 05xxxxxxx" className={input} dir="ltr" />
          </div>
        </div>
      )}

      {/* الخطوة 4: المعاينة والإرسال */}
      {selectedTpl && (
        <div className={`${card} p-6`}>
          <h3 className="font-black text-brand-800 dark:text-brand-100 mb-4 flex items-center gap-2"><Send size={18} className="text-gold-500" /> ٤) المعاينة والإرسال</h3>

          <div className="bg-slate-50 dark:bg-brand-900 rounded-xl p-4 mb-4 border border-slate-100 dark:border-brand-700">
            <p className="text-[11px] text-slate-400 mb-2">معاينة (لأول مستقبِل):</p>
            <pre className="whitespace-pre-wrap text-sm text-slate-800 dark:text-brand-100 font-sans leading-relaxed">{preview || '—'}</pre>
          </div>

          {/* إرسال تجريبي */}
          <div className="flex flex-col sm:flex-row gap-2 mb-4">
            <input value={testNumber} onChange={e => setTestNumber(e.target.value)} placeholder="رقم للتجربة (05xxxxxxxx)" className={`${input} sm:max-w-xs`} dir="ltr" />
            <button onClick={sendTest} disabled={sending}
              className="px-4 py-2 rounded-xl border-2 border-brand-800/20 text-brand-800 dark:text-brand-100 font-bold text-sm hover:border-gold-500 hover:text-gold-500 transition flex items-center justify-center gap-2 disabled:opacity-50">
              <Phone size={15} /> إرسال تجريبي
            </button>
          </div>

          {/* شريط التقدّم */}
          {sending && (
            <div className="mb-4">
              <div className="flex justify-between text-xs text-slate-500 mb-1">
                <span>جاري الإرسال… {progress.done}/{progress.total}</span>
                <span className="text-emerald-600">✅ {progress.ok}</span>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-brand-800 overflow-hidden">
                <div className="h-full bg-gold-500 transition-all" style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
              </div>
            </div>
          )}

          {/* النتائج */}
          {results && (
            <div className="mb-4 flex flex-wrap gap-3 text-sm">
              <span className="flex items-center gap-1 text-emerald-600"><CheckCircle2 size={16} /> نجح {results.ok}</span>
              {results.fail > 0 && <span className="flex items-center gap-1 text-red-500"><XCircle size={16} /> فشل {results.fail}</span>}
            </div>
          )}

          <button onClick={sendCampaign} disabled={sending || recipients.length === 0}
            className="w-full py-3.5 rounded-2xl bg-brand-800 text-white font-black hover:bg-gold-500 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
            {sending ? <><Loader2 size={18} className="animate-spin" /> جاري الإرسال…</> : <><Send size={18} /> إرسال الحملة إلى {recipients.length} مستقبِل</>}
          </button>
        </div>
      )}
    </div>
  );
}
