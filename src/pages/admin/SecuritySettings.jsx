import React, { useState } from 'react';
import {
    ShieldCheck, Mail, MessageCircle, Send, MailCheck, RefreshCw,
    Lock, CheckCircle2, AlertTriangle, KeyRound
} from 'lucide-react';
import { apiPost, TENANT, currentUser } from '../../lib/api/client';

export default function SecuritySettings({ showToast }) {
    const u = currentUser() || {};
    const toast = (t, m, k) => { if (showToast) showToast(t, m, k); };

    // ─── التحقق بخطوتين ───────────────────────────────────────────────
    const [twofa, setTwofa]       = useState(!!u.twofa);
    const [channel, setChannel]   = useState(u.twofa_channel === 'whatsapp' ? 'whatsapp' : 'email');
    const [savingTwofa, setSavingTwofa] = useState(false);

    const saveTwofa = async (enabled, ch) => {
        if (!u.id) { toast('خطأ', 'تعذّر تحديد المستخدم الحالي', 'error'); return; }
        setSavingTwofa(true);
        try {
            const res = await apiPost('set_twofa', { user_id: u.id, enabled: enabled ? 1 : 0, channel: ch }, {}, { tenant: TENANT });
            if (res.success) {
                setTwofa(enabled); setChannel(ch);
                // حدّث الجلسة المحفوظة
                try {
                    const cur = JSON.parse(localStorage.getItem('semak_current_user') || '{}');
                    cur.twofa = enabled ? 1 : 0; cur.twofa_channel = ch;
                    localStorage.setItem('semak_current_user', JSON.stringify(cur));
                } catch { /* تجاهل */ }
                toast('تم الحفظ', enabled ? `التحقق بخطوتين مُفعّل عبر ${ch === 'whatsapp' ? 'الواتساب' : 'البريد'}` : 'تم تعطيل التحقق بخطوتين');
            } else {
                toast('خطأ', res.message || 'تعذّر الحفظ', 'error');
            }
        } catch { toast('خطأ', 'فشل الاتصال بالسيرفر', 'error'); }
        finally { setSavingTwofa(false); }
    };

    // ─── اختبار البريد ────────────────────────────────────────────────
    const [testTo, setTestTo]     = useState(u.email || '');
    const [testing, setTesting]   = useState(false);
    const sendTest = async () => {
        setTesting(true);
        try {
            const res = await apiPost('send_test_email', { to: testTo, actor: u.name || u.email || '' }, {}, { tenant: TENANT });
            if (res.success) toast('تم', res.message || 'وصلت رسالة الاختبار');
            else toast(res.configured === false ? 'غير مُهيّأ' : 'فشل', res.message || 'تعذّر الإرسال', 'error');
        } catch { toast('خطأ', 'فشل الاتصال بالسيرفر', 'error'); }
        finally { setTesting(false); }
    };

    // ─── بريد تحديث ───────────────────────────────────────────────────
    const [to, setTo]           = useState('');
    const [subject, setSubject] = useState('');
    const [body, setBody]       = useState('');
    const [ctaUrl, setCtaUrl]   = useState('');
    const [ctaLabel, setCtaLabel] = useState('');
    const [sending, setSending] = useState(false);

    const sendUpdate = async () => {
        if (!to.trim() || !subject.trim() || !body.trim()) {
            toast('تنبيه', 'أدخل المستلِم والعنوان والمحتوى', 'error'); return;
        }
        setSending(true);
        try {
            const res = await apiPost('send_update_email', {
                to, subject, title: subject, body,
                cta_url: ctaUrl, cta_label: ctaLabel || 'فتح',
                actor: u.name || u.email || '',
            }, {}, { tenant: TENANT });
            if (res.success) {
                toast('تم الإرسال', res.message || 'تم إرسال البريد');
                setBody(''); setSubject(''); setCtaUrl(''); setCtaLabel('');
            } else {
                toast(res.configured === false ? 'غير مُهيّأ' : 'فشل', res.message || 'تعذّر الإرسال', 'error');
            }
        } catch { toast('خطأ', 'فشل الاتصال بالسيرفر', 'error'); }
        finally { setSending(false); }
    };

    const Card = ({ icon: Icon, title, desc, children }) => (
        <div className="bg-white dark:bg-brand-900 rounded-[2rem] shadow-card border border-brand-100/70 dark:border-brand-700 overflow-hidden">
            <div className="p-6 border-b border-brand-100/70 dark:border-brand-700 bg-brand-50/50 dark:bg-brand-800/40">
                <h3 className="text-lg font-black text-brand-800 dark:text-brand-50 flex items-center gap-2.5">
                    <Icon className="text-gold-500" size={20} /> {title}
                </h3>
                {desc && <p className="text-slate-500 dark:text-brand-300 text-sm mt-1">{desc}</p>}
            </div>
            <div className="p-6">{children}</div>
        </div>
    );

    return (
        <div className="animate-fadeIn max-w-3xl mx-auto space-y-6">

            {/* التحقق بخطوتين */}
            <Card icon={ShieldCheck} title="التحقق بخطوتين عند الدخول" desc="حماية إضافية لحسابك — يُطلب رمز عند كل دخول من جهاز جديد.">
                <div className="flex items-center justify-between gap-4 mb-5">
                    <div className="flex items-center gap-3">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${twofa ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-slate-100 text-slate-400 dark:bg-brand-800 dark:text-brand-400'}`}>
                            {twofa ? <CheckCircle2 size={22} /> : <Lock size={22} />}
                        </div>
                        <div>
                            <div className="font-bold text-brand-800 dark:text-brand-50">{twofa ? 'مُفعّل' : 'مُعطّل'}</div>
                            <div className="text-xs text-slate-500 dark:text-brand-400">{u.email || '—'}</div>
                        </div>
                    </div>
                    <button
                        onClick={() => saveTwofa(!twofa, channel)}
                        disabled={savingTwofa}
                        className={`relative w-14 h-7 rounded-full transition ${twofa ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-brand-700'} disabled:opacity-50`}
                        aria-label="تبديل التحقق بخطوتين"
                    >
                        <span className={`absolute top-0.5 ${twofa ? 'right-0.5' : 'right-7'} w-6 h-6 bg-white rounded-full shadow transition-all`} />
                    </button>
                </div>

                <div className={twofa ? '' : 'opacity-50 pointer-events-none'}>
                    <label className="block text-xs font-black text-slate-400 dark:text-brand-400 mb-2">قناة إرسال الرمز الافتراضية</label>
                    <div className="flex gap-2">
                        <button onClick={() => saveTwofa(true, 'email')} disabled={savingTwofa}
                            className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border transition ${channel === 'email' ? 'bg-brand-800 text-white border-brand-800' : 'bg-white dark:bg-brand-800 text-brand-800 dark:text-brand-100 border-slate-200 dark:border-brand-700 hover:border-gold-500'}`}>
                            <Mail size={16} /> البريد الإلكتروني
                        </button>
                        <button onClick={() => saveTwofa(true, 'whatsapp')} disabled={savingTwofa}
                            className={`flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 border transition ${channel === 'whatsapp' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white dark:bg-brand-800 text-emerald-700 dark:text-emerald-300 border-slate-200 dark:border-brand-700 hover:border-emerald-500'}`}>
                            <MessageCircle size={16} /> واتساب
                        </button>
                    </div>
                    <p className="text-xs text-slate-400 dark:text-brand-500 mt-2 flex items-center gap-1.5">
                        <KeyRound size={12} /> يمكنك تغيير القناة وقت الدخول أيضًا.
                    </p>
                </div>
            </Card>

            {/* اختبار البريد */}
            <Card icon={MailCheck} title="اختبار خادم البريد (SMTP)" desc="تأكد أن إرسال البريد عبر بريد سماك يعمل.">
                <div className="flex flex-col sm:flex-row gap-3">
                    <input value={testTo} onChange={e => setTestTo(e.target.value)} type="email" placeholder="البريد المستلِم"
                        className="input flex-1 py-3" dir="ltr" />
                    <button onClick={sendTest} disabled={testing} className="btn btn-primary px-5 py-3 flex items-center justify-center gap-2">
                        {testing ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />} إرسال اختبار
                    </button>
                </div>
                <p className="text-xs text-slate-400 dark:text-brand-500 mt-3 flex items-center gap-1.5">
                    <AlertTriangle size={12} /> إن لم تُهيّأ بيانات SMTP بعد، سيظهر تنبيه «غير مُهيّأ».
                </p>
            </Card>

            {/* بريد تحديث */}
            <Card icon={Mail} title="إرسال بريد تحديث" desc="رسالة بقالب سماك (أزرق/ذهبي) — مستلِم واحد أو عدة مستلِمين مفصولين بفاصلة.">
                <div className="space-y-3">
                    <input value={to} onChange={e => setTo(e.target.value)} placeholder="المستلِمون (a@x.com, b@y.com)"
                        className="input w-full py-3" dir="ltr" />
                    <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="عنوان الرسالة"
                        className="input w-full py-3" />
                    <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="نص الرسالة…" rows={5}
                        className="input w-full py-3 resize-y" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <input value={ctaUrl} onChange={e => setCtaUrl(e.target.value)} placeholder="رابط زر (اختياري)"
                            className="input w-full py-3" dir="ltr" />
                        <input value={ctaLabel} onChange={e => setCtaLabel(e.target.value)} placeholder="نص الزر (مثال: فتح الفاتورة)"
                            className="input w-full py-3" />
                    </div>
                    <div className="flex justify-end">
                        <button onClick={sendUpdate} disabled={sending} className="btn btn-primary px-6 py-3 flex items-center gap-2">
                            {sending ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />} إرسال البريد
                        </button>
                    </div>
                </div>
            </Card>
        </div>
    );
}
