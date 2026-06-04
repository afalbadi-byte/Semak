import React, { useState, useEffect } from 'react';
import { Link2, CheckCircle2, AlertTriangle, RefreshCw, Save, ExternalLink, ShieldCheck, Clock } from 'lucide-react';

const API_URL = "https://semak.sa/api.php";

export default function DaftraLink() {
  const [status, setStatus]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [cookie, setCookie]   = useState('');
  const [saving, setSaving]   = useState(false);
  const [result, setResult]   = useState(null);

  const loadStatus = () => {
    setLoading(true);
    fetch(`${API_URL}?action=daftra_cookie_status`)
      .then(r => r.json())
      .then(d => { if (d.success) setStatus(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadStatus(); }, []);

  const save = async () => {
    if (!cookie.trim()) { setResult({ ok: false, msg: 'الصق الكوكي أولاً' }); return; }
    setSaving(true); setResult(null);
    try {
      const res = await fetch(`${API_URL}?action=daftra_save_cookie`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookie: cookie.trim() }),
      });
      const d = await res.json();
      setResult({ ok: d.valid, msg: d.message || (d.success ? 'تم الحفظ' : 'فشل') });
      if (d.success) { setCookie(''); loadStatus(); }
    } catch {
      setResult({ ok: false, msg: 'خطأ في الاتصال بالخادم' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="animate-fadeIn p-6 md:p-8 max-w-3xl mx-auto font-cairo" dir="rtl">
      {/* رأس */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
          <Link2 size={24} />
        </div>
        <div>
          <h2 className="text-2xl font-black text-[#1a365d]">ربط دفترة</h2>
          <p className="text-sm text-slate-500 mt-0.5">جلسة دفترة المستخدمة لتحميل ملفات PDF الرسمية</p>
        </div>
      </div>

      {/* حالة الاتصال */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6 mb-5">
        <h3 className="text-sm font-black text-slate-700 mb-4 flex items-center gap-2">
          <ShieldCheck size={16} className="text-indigo-500" /> حالة الجلسة
        </h3>
        {loading ? (
          <div className="flex items-center gap-2 text-slate-400 text-sm"><RefreshCw size={16} className="animate-spin" /> جاري الفحص…</div>
        ) : status?.set ? (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
              <CheckCircle2 size={18} /> الجلسة مُخزّنة
            </div>
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span className="font-mono bg-slate-50 px-2 py-1 rounded">{status.preview}</span>
              {status.updated_at && <span className="flex items-center gap-1"><Clock size={12} /> {status.updated_at}</span>}
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
            <AlertTriangle size={18} /> لا توجد جلسة مُخزّنة — الصق الكوكي بالأسفل
          </div>
        )}
      </div>

      {/* خطوات الحصول على الكوكي */}
      <div className="bg-indigo-50/50 border border-indigo-100 rounded-3xl p-6 mb-5">
        <h3 className="text-sm font-black text-indigo-900 mb-3">كيف أحصل على الكوكي؟</h3>
        <ol className="space-y-2 text-[13px] text-slate-600 font-medium list-decimal pr-5">
          <li>افتح <a href="https://semak.daftra.com/owner/invoices/index" target="_blank" rel="noreferrer" className="text-indigo-600 font-bold inline-flex items-center gap-1">دفترة وسجّل الدخول <ExternalLink size={12} /></a></li>
          <li>اضغط <span className="font-bold">F12</span> لفتح أدوات المطوّر ← تبويب <span className="font-bold">Network</span></li>
          <li>حدّث الصفحة، واضغط على أي طلب لـ <span className="font-mono text-xs">semak.daftra.com</span></li>
          <li>في <span className="font-bold">Request Headers</span> انسخ قيمة <span className="font-mono text-xs bg-white px-1 rounded">Cookie</span> كاملة</li>
          <li>الصقها بالأسفل واضغط حفظ</li>
        </ol>
      </div>

      {/* إدخال الكوكي */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-6">
        <label className="text-sm font-black text-slate-700 mb-2 block">لصق الكوكي</label>
        <textarea
          value={cookie}
          onChange={e => setCookie(e.target.value)}
          rows={5}
          dir="ltr"
          placeholder="CAKEPHP=...; oi_session=...; XSRF-TOKEN=..."
          className="w-full border border-slate-200 rounded-2xl px-4 py-3 text-xs font-mono focus:border-indigo-500 outline-none resize-none mb-4 text-left"
        />
        {result && (
          <div className={`flex items-center gap-2 text-sm font-bold mb-4 ${result.ok ? 'text-emerald-600' : 'text-amber-600'}`}>
            {result.ok ? <CheckCircle2 size={16} /> : <AlertTriangle size={16} />} {result.msg}
          </div>
        )}
        <div className="flex gap-3">
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 bg-[#1a365d] hover:bg-[#2d5299] disabled:opacity-60 text-white px-6 py-3 rounded-xl font-bold text-sm transition-colors"
          >
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />} حفظ وفحص
          </button>
          <button
            onClick={loadStatus}
            className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-3 rounded-xl font-bold text-sm transition-colors"
          >
            <RefreshCw size={16} /> تحديث الحالة
          </button>
        </div>
      </div>
    </div>
  );
}
