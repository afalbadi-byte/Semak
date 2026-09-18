import React, { useEffect, useState } from 'react';
import {
    KeyRound, Users, HardDrive, Trash2, PieChart, LogOut, ChevronLeft, UserPlus, CheckCircle2, AlertTriangle,
    Link2, Download, FileDown, Building2, Languages, MessageCircle,
} from 'lucide-react';
import { call } from '../lib/api';
import { t } from '../lib/i18n';
import { fullDate } from '../lib/fmt';
import { Card, Btn, Sheet, Field, inputCls, Seg, Spinner, useToast } from '../ui';
import { useData } from '../App';
import { localPhone } from './Profile';

export default function Settings({ q }) {
    const { me, logout, profile, logo, lang, changeLang } = useData();
    const toast = useToast();
    const [pw, setPw] = useState(false);
    const admin = me.role === 'admin';

    useEffect(() => {
        if (q.drive === 'ok') toast(t('رُبط Google Drive'));
        if (q.drive === 'err') toast(t('لم يكتمل ربط Drive — أعد المحاولة'), 'err');
    }, [q.drive]);   // eslint-disable-line react-hooks/exhaustive-deps

    const Row = ({ icon: I, label, sub, onClick, hrefTo, danger }) => {
        const inner = (
            <>
                <span className={'w-9 h-9 rounded-xl flex items-center justify-center ' + (danger ? 'bg-red-50 text-red-700' : 'bg-brand-50 text-brand')}><I size={17} /></span>
                <span className="flex-1 min-w-0">
                    <span className={'block text-[14px] font-semibold ' + (danger ? 'text-red-700' : '')}>{label}</span>
                    {sub ? <span className="block text-[12px] text-ink-3 truncate">{sub}</span> : null}
                </span>
                {!danger ? <ChevronLeft size={17} className="text-ink-3 ltr:rotate-180" /> : null}
            </>
        );
        const cls = 'w-full flex items-center gap-3 px-4 py-3 hover:bg-paper text-start';
        return hrefTo ? <a href={hrefTo} className={cls}>{inner}</a> : <button onClick={onClick} className={cls}>{inner}</button>;
    };

    return (
        <div className="space-y-5 pt-2 lg:pt-0 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0 lg:items-start">
            <div className="space-y-5">
                <a href="#/profile" className="block">
                    <Card className="p-4 flex items-center gap-3 hover:border-brand-100">
                        {logo ? <img src={logo} alt="" className="w-12 h-12 rounded-2xl object-contain bg-white border border-paper-2" />
                            : <span className="w-12 h-12 rounded-2xl bg-brand text-white text-[18px] font-bold flex items-center justify-center">{me.name.slice(0, 1)}</span>}
                        <div className="flex-1 min-w-0">
                            <div className="font-bold truncate">{me.name}</div>
                            <div className="text-[12px] text-ink-3 truncate">
                                {profile.org_name || <span dir="ltr">@{me.username}</span>}{admin ? ' · ' + t('مدير') : ''}
                            </div>
                        </div>
                        <span className="text-[12px] font-semibold text-brand">{t('إعداد الحساب')}</span>
                    </Card>
                </a>

                <Card className="p-4">
                    <div className="flex items-center gap-2 mb-3 font-bold text-[14px]"><Languages size={17} className="text-brand" />{t('لغة التطبيق')}</div>
                    <Seg value={lang} onChange={l => changeLang(l, true)} options={[{ v: 'ar', t: 'العربية' }, { v: 'en', t: 'English' }]} />
                </Card>

                <Card className="divide-y divide-paper-2 overflow-hidden">
                    <Row icon={Building2} label={t('إعداد الحساب')} sub={t('الشعار واسم المنشأة والرقم الضريبي وبيانات المستفيد')} hrefTo="#/profile" />
                    <Row icon={PieChart} label={t('الميزانية والتصنيفات')} sub={t('سقفٌ شهري لكل تصنيف')} hrefTo="#/budgets" />
                    <Row icon={FileDown} label={t('كشف حساب PDF')} sub={t('رصيدٌ جارٍ وروابط المستندات')} hrefTo="#/statement" />
                    <Row icon={Download} label={t('تصدير الحركات')} sub={t('ملف Excel بكل ما سجّلته')} hrefTo="#/txns" />
                    <Row icon={Trash2} label={t('السلّة')} sub={t('الحركات المحذوفة تُستعاد من هنا')} hrefTo="#/txns?trash=1" />
                    <Row icon={KeyRound} label={t('تغيير كلمة المرور')} onClick={() => setPw(true)} />
                    <Row icon={LogOut} label={t('تسجيل الخروج')} onClick={logout} danger />
                </Card>
            </div>

            {admin ? (
                <div className="space-y-5">
                    <UsersPanel />
                    <DrivePanel />
                </div>
            ) : null}

            <PwSheet open={pw} onClose={() => setPw(false)} />
        </div>
    );
}

function PwSheet({ open, onClose }) {
    const toast = useToast();
    const [v, setV] = useState({ old: '', new: '', again: '' });
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const save = async () => {
        setErr('');
        if (v.new !== v.again) { setErr(t('كلمتا المرور الجديدتان غير متطابقتين')); return; }
        setBusy(true);
        const r = await call('password', { body: v });
        setBusy(false);
        if (!r.success) { setErr(t(r.message)); return; }
        toast(t('تغيّرت كلمة المرور')); setV({ old: '', new: '', again: '' }); onClose();
    };
    return (
        <Sheet open={open} onClose={onClose} title={t('تغيير كلمة المرور')}>
            <div className="space-y-4">
                <Field label={t('الحالية')}><input type="password" dir="ltr" className={inputCls} value={v.old} onChange={e => setV({ ...v, old: e.target.value })} autoComplete="current-password" /></Field>
                <Field label={t('الجديدة')} hint={t('ثمانية أحرف فأكثر')}><input type="password" dir="ltr" className={inputCls} value={v.new} onChange={e => setV({ ...v, new: e.target.value })} autoComplete="new-password" /></Field>
                <Field label={t('أعد كتابتها')}><input type="password" dir="ltr" className={inputCls} value={v.again} onChange={e => setV({ ...v, again: e.target.value })} autoComplete="new-password" /></Field>
                {err ? <p className="text-[13px] text-red-700 font-semibold">{err}</p> : null}
                <Btn className="w-full" busy={busy} onClick={save}>{t('حفظ')}</Btn>
            </div>
        </Sheet>
    );
}

// ─── Google Drive ───────────────────────────────────────────────────────────
function DrivePanel() {
    const toast = useToast();
    const [s, setS] = useState(null);
    const [busy, setBusy] = useState(false);
    const load = () => call('drive_status').then(r => r.success && setS(r));
    useEffect(() => { load(); }, []);

    const link = async () => {
        setBusy(true);
        const r = await call('drive_url');
        setBusy(false);
        if (!r.success) { toast(t(r.message), 'err'); return; }
        window.location.href = r.url;
    };
    const unlink = async () => {
        if (!window.confirm(t('فكّ ربط Drive؟ تبقى الملفات في درايفك وعلى الخادم، وتتوقّف الرفعات الجديدة.'))) return;
        const r = await call('drive_unlink', { body: {} });
        if (r.success) { toast(t('فُكّ الربط')); load(); }
    };

    if (!s) return <Card className="p-4"><Spinner className="!py-6" /></Card>;
    const c = s.counts || {};
    return (
        <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand flex items-center justify-center"><HardDrive size={17} /></span>
                <div className="flex-1">
                    <div className="font-bold text-[14px]">Google Drive</div>
                    <div className="text-[12px] text-ink-3">{t('مجلد «عُهدة» في درايفك، وتحته مجلد لكل مستخدم')}</div>
                </div>
                {s.linked ? <span className="text-[12px] font-semibold text-brand flex items-center gap-1"><CheckCircle2 size={14} />{t('مربوط')}</span> : null}
            </div>

            {!s.configured ? (
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-[12.5px] text-amber-900 leading-6">
                    {t('مفاتيح Google لم تُضف إلى الخادم بعد. الملفات محفوظة على الخادم الآن، وتُرفع كلها إلى درايف تلقائياً فور الربط.')}
                </div>
            ) : !s.linked ? (
                <Btn className="w-full" busy={busy} onClick={link}><Link2 size={16} />{t('اربط حساب Google Drive')}</Btn>
            ) : (
                <>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        {[['رُفعت', c.done || 0, 'text-brand'], ['بالانتظار', c.pending || 0, 'text-ink'], ['تعثّرت', c.failed || 0, c.failed ? 'text-red-700' : 'text-ink']].map(([k, n, cl]) => (
                            <div key={k} className="rounded-xl bg-paper p-2.5">
                                <div className={'text-[18px] font-bold ' + cl}>{n}</div>
                                <div className="text-[11px] text-ink-3">{t(k)}</div>
                            </div>
                        ))}
                    </div>
                    {s.last_error && (c.failed || c.pending > 5) ? (
                        <p className="text-[11.5px] text-ink-3 flex gap-1.5"><AlertTriangle size={13} className="shrink-0 text-amber mt-0.5" />
                            {t('آخر خطأ:')} {(s.last_error.error && (s.last_error.error.message || s.last_error.error)) || s.last_error.error_description || '—'}</p>
                    ) : null}
                    <div className="flex gap-2">
                        <Btn kind="line" className="flex-1" busy={busy} onClick={link}>{t('إعادة الربط')}</Btn>
                        <Btn kind="ghost" onClick={unlink}>{t('فكّ الربط')}</Btn>
                    </div>
                </>
            )}
        </Card>
    );
}

// ─── رسالة الدعوة بلغة المستلم ──────────────────────────────────────────────
// الرابط يُبنى من عنوان التطبيق الحالي، فيصحّ على semak.sa/ohda وعلى النطاق الفرعي
function inviteText({ name, username, password, lang }) {
    const url = window.location.origin + window.location.pathname.replace(/[^/]*$/, '');
    if (lang === 'en') return [
        `Hi ${name} 👋`,
        '',
        "I've set you up on «Ohda», an app to record your expenses and receipts. Your data is private to you.",
        '',
        '🔗 Link:', url,
        '',
        `👤 Username: ${username}`,
        password ? `🔑 Password: ${password}` : '🔑 Password: the one I sent you earlier',
        '',
        '📲 Install it on your phone:',
        'iPhone: open the link in Safari → tap Share → «Add to Home Screen».',
        'Android: open the link in Chrome → ⋮ menu → «Install app».',
        '',
        '🧾 To record an expense: tap the green (+) → «Scan receipt» → check the figures → Save.',
    ].join('\n');
    return [
        `السلام عليكم ${name} 🌷`,
        '',
        'جهّزت لك تطبيق «عُهدة» لتسجيل المصاريف والإيصالات، وبياناتك فيه خاصة بك ما يشوفها أحد غيرك.',
        '',
        '🔗 الرابط:', url,
        '',
        `👤 اسم الدخول: ${username}`,
        password ? `🔑 كلمة المرور: ${password}` : '🔑 كلمة المرور: اللي أرسلتها لك سابقاً',
        '',
        '📲 طريقة تنزيله على الجوال:',
        'آيفون: افتح الرابط من Safari ← زر المشاركة ← «إضافة إلى الشاشة الرئيسية».',
        'أندرويد: افتح الرابط من Chrome ← النقاط الثلاث ← «تثبيت التطبيق».',
        '',
        '🧾 لتسجيل مصروف: اضغط (+) الأخضر ← «صوّر الإيصال» ← تأكد من الأرقام ← «حفظ».',
    ].join('\n');
}

function waLink(phone, text) {
    return 'https://wa.me/' + (phone ? String(phone).replace(/\D/g, '').replace(/^0(?=5)/, '966') : '') + '?text=' + encodeURIComponent(text);
}

// ─── المستخدمون ─────────────────────────────────────────────────────────────
function UsersPanel() {
    const { me } = useData();
    const toast = useToast();
    const [rows, setRows] = useState(null);
    const [edit, setEdit] = useState(null);
    const [sent, setSent] = useState(null);     // بيانات آخر حفظ — لزرّ الإرسال بعده
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const load = () => call('users').then(r => r.success && setRows(r.data));
    useEffect(() => { load(); }, []);

    const save = async () => {
        setErr(''); setBusy(true);
        const r = await call('user_save', { body: edit });
        setBusy(false);
        if (!r.success) { setErr(t(r.message)); return; }
        // كلمة المرور لا تُخزَّن مقروءة، فلا تُرسل إلا الآن وهي في يد المدير
        setSent({ name: edit.name, username: edit.username, password: edit.password, phone: edit.phone, lang: edit.lang || 'ar', isNew: !edit.id });
        toast(t(edit.id ? 'حُفظ المستخدم' : 'أُنشئ الحساب'));
        setEdit(null); load();
    };

    const sendInvite = u => { window.open(waLink(u.phone, inviteText(u)), '_blank', 'noopener'); };

    return (
        <Card className="overflow-hidden">
            <div className="flex items-center gap-2 p-4 pb-2">
                <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand flex items-center justify-center"><Users size={17} /></span>
                <div className="flex-1">
                    <div className="font-bold text-[14px]">{t('المستخدمون')}</div>
                    <div className="text-[12px] text-ink-3">{t('لكل مستخدمٍ بياناته وحده — لا يرى أحدٌ بيانات غيره')}</div>
                </div>
                <Btn kind="soft" className="!h-9 !px-3 text-[13px]" onClick={() => { setErr(''); setEdit({ username: '', name: '', password: '', phone: '', lang: 'ar', active: 1 }); }}>
                    <UserPlus size={15} />{t('إضافة')}
                </Btn>
            </div>

            {sent ? (
                <div className="mx-4 mb-3 rounded-2xl bg-brand-50 border border-brand-100 p-3">
                    <p className="text-[12.5px] text-brand-800 font-semibold">
                        {t(sent.isNew ? 'أُنشئ حساب {n} — أرسل له بيانات الدخول' : 'حُفظ حساب {n}', { n: sent.name })}
                    </p>
                    <div className="flex gap-2 mt-2">
                        <button onClick={() => sendInvite(sent)}
                            className="flex-1 h-10 rounded-xl bg-[#25D366] text-white font-semibold text-[13px] flex items-center justify-center gap-2">
                            <MessageCircle size={16} />{t('أرسل بياناته واتساب')}
                        </button>
                        <Btn kind="ghost" className="!h-10 text-[12px]" onClick={() => setSent(null)}>{t('إغلاق')}</Btn>
                    </div>
                    {!sent.password ? <p className="text-[11px] text-ink-3 mt-1.5">{t('لم تُغيَّر كلمة المرور، فالرسالة بلا كلمة مرور.')}</p> : null}
                </div>
            ) : null}

            {!rows ? <Spinner className="!py-8" /> : (
                <div className="divide-y divide-paper-2">
                    {rows.map(u => (
                        <div key={u.id} className="flex items-center gap-2 pe-3 hover:bg-paper">
                            <button onClick={() => { setErr(''); setEdit({ ...u, password: '', phone: localPhone(u.phone), lang: u.lang || 'ar', active: Number(u.active) }); }}
                                className="flex-1 min-w-0 flex items-center gap-3 px-4 py-3 text-start">
                                <span className={'w-9 h-9 rounded-xl flex items-center justify-center font-bold shrink-0 ' + (Number(u.active) ? 'bg-paper-2 text-ink-2' : 'bg-red-50 text-red-400')}>{u.name.slice(0, 1)}</span>
                                <span className="flex-1 min-w-0">
                                    <span className="block text-[14px] font-semibold truncate">{u.name}
                                        {u.role === 'admin' ? <span className="text-[11px] text-brand font-semibold"> · {t('مدير')}</span> : null}
                                        {!Number(u.active) ? <span className="text-[11px] text-red-600"> · {t('موقوف')}</span> : null}</span>
                                    <span className="block text-[12px] text-ink-3 truncate" dir="ltr" style={{ textAlign: 'inherit' }}>
                                        @{u.username} · {t('{n} حركة', { n: u.txns })}{u.last_login ? ' · ' + t('آخر دخول') + ' ' + fullDate(u.last_login.slice(0, 10)) : ''}
                                    </span>
                                </span>
                            </button>
                            <button title={t('أرسل الرابط واتساب')} onClick={() => sendInvite({ name: u.name, username: u.username, password: '', phone: u.phone, lang: u.lang })}
                                className="w-9 h-9 rounded-xl text-[#1da851] hover:bg-[#25D366]/10 flex items-center justify-center shrink-0">
                                <MessageCircle size={17} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <Sheet open={!!edit} onClose={() => setEdit(null)} title={t(edit && edit.id ? 'تعديل المستخدم' : 'مستخدم جديد')}>
                {edit ? (
                    <div className="space-y-4">
                        <Field label={t('الاسم')}><input className={inputCls} value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} placeholder={t('أمي، عهدة العمل…')} /></Field>
                        {!edit.id ? (
                            <Field label={t('اسم الدخول')} hint={t('حروف إنجليزية صغيرة وأرقام')}>
                                <input className={inputCls} dir="ltr" autoCapitalize="none" value={edit.username} onChange={e => setEdit({ ...edit, username: e.target.value.toLowerCase() })} />
                            </Field>
                        ) : null}
                        <Field label={t(edit.id ? 'كلمة مرور جديدة' : 'كلمة المرور')} hint={t(edit.id ? 'اتركها فارغة لتبقى كما هي' : 'ثمانية أحرف فأكثر')}>
                            <input className={inputCls} dir="ltr" value={edit.password} onChange={e => setEdit({ ...edit, password: e.target.value })} autoComplete="new-password" />
                        </Field>
                        <Field label={t('جوال واتساب')} hint={t('لإرسال بيانات الدخول مباشرة')}>
                            <input className={inputCls} dir="ltr" type="tel" inputMode="tel" placeholder="05xxxxxxxx" value={edit.phone || ''} onChange={e => setEdit({ ...edit, phone: e.target.value })} />
                        </Field>
                        <div>
                            <span className="block text-[12px] font-semibold text-ink-2 mb-1.5">{t('لغة المستخدم')}</span>
                            <Seg value={edit.lang || 'ar'} onChange={l => setEdit({ ...edit, lang: l })} options={[{ v: 'ar', t: 'العربية' }, { v: 'en', t: 'English' }]} />
                        </div>
                        {edit.id && Number(edit.id) !== Number(me.id) ? (
                            <label className="flex items-center gap-2 text-[14px]">
                                <input type="checkbox" className="w-5 h-5 accent-brand" checked={!!edit.active} onChange={e => setEdit({ ...edit, active: e.target.checked ? 1 : 0 })} />
                                {t('الحساب فعّال')}
                            </label>
                        ) : null}
                        {err ? <p className="text-[13px] text-red-700 font-semibold">{err}</p> : null}
                        <Btn className="w-full" busy={busy} onClick={save}>{t('حفظ')}</Btn>
                    </div>
                ) : null}
            </Sheet>
        </Card>
    );
}
