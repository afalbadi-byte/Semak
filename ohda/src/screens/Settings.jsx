import React, { useEffect, useState } from 'react';
import { KeyRound, Users, HardDrive, Trash2, PieChart, LogOut, ChevronLeft, UserPlus, CheckCircle2, AlertTriangle, Link2, Download, FileDown } from 'lucide-react';
import { call } from '../lib/api';
import { fullDate } from '../lib/fmt';
import { Card, Btn, Sheet, Field, inputCls, Spinner, useToast } from '../ui';
import { useData } from '../App';

export default function Settings({ q }) {
    const { me, logout } = useData();
    const toast = useToast();
    const [pw, setPw] = useState(false);
    const admin = me.role === 'admin';

    useEffect(() => {
        if (q.drive === 'ok') toast('رُبط Google Drive');
        if (q.drive === 'err') toast('لم يكتمل ربط Drive — أعد المحاولة', 'err');
    }, [q.drive]);   // eslint-disable-line react-hooks/exhaustive-deps

    const Row = ({ icon: I, t, sub, onClick, hrefTo, danger }) => {
        const inner = (
            <>
                <span className={'w-9 h-9 rounded-xl flex items-center justify-center ' + (danger ? 'bg-red-50 text-red-700' : 'bg-brand-50 text-brand')}><I size={17} /></span>
                <span className="flex-1 min-w-0">
                    <span className={'block text-[14px] font-semibold ' + (danger ? 'text-red-700' : '')}>{t}</span>
                    {sub ? <span className="block text-[12px] text-ink-3 truncate">{sub}</span> : null}
                </span>
                {!danger ? <ChevronLeft size={17} className="text-ink-3" /> : null}
            </>
        );
        const cls = 'w-full flex items-center gap-3 px-4 py-3 hover:bg-paper text-right';
        return hrefTo ? <a href={hrefTo} className={cls}>{inner}</a> : <button onClick={onClick} className={cls}>{inner}</button>;
    };

    return (
        <div className="space-y-5 pt-2 lg:pt-0 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0 lg:items-start">
            <div className="space-y-5">
                <Card className="p-4 flex items-center gap-3">
                    <span className="w-12 h-12 rounded-2xl bg-brand text-white text-[18px] font-bold flex items-center justify-center">{me.name.slice(0, 1)}</span>
                    <div>
                        <div className="font-bold">{me.name}</div>
                        <div className="text-[12px] text-ink-3" dir="ltr">@{me.username}{admin ? ' · مدير' : ''}</div>
                    </div>
                </Card>
                <Card className="divide-y divide-paper-2 overflow-hidden">
                    <Row icon={PieChart} t="الميزانية والتصنيفات" sub="سقفٌ شهري لكل تصنيف" hrefTo="#/budgets" />
                    <Row icon={Trash2} t="السلّة" sub="الحركات المحذوفة تُستعاد من هنا" hrefTo="#/txns?trash=1" />
                    <Row icon={FileDown} t="كشف حساب PDF" sub="رصيدٌ جارٍ وروابط المستندات" hrefTo="#/statement" />
                    <Row icon={Download} t="تصدير الحركات" sub="ملف Excel بكل ما سجّلته" hrefTo="#/txns" />
                    <Row icon={KeyRound} t="تغيير كلمة المرور" onClick={() => setPw(true)} />
                    <Row icon={LogOut} t="تسجيل الخروج" onClick={logout} danger />
                </Card>
            </div>

            {admin ? (
                <div className="space-y-5">
                    <DrivePanel />
                    <UsersPanel />
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
        if (v.new !== v.again) { setErr('كلمتا المرور الجديدتان غير متطابقتين'); return; }
        setBusy(true);
        const r = await call('password', { body: v });
        setBusy(false);
        if (!r.success) { setErr(r.message); return; }
        toast('تغيّرت كلمة المرور'); setV({ old: '', new: '', again: '' }); onClose();
    };
    return (
        <Sheet open={open} onClose={onClose} title="تغيير كلمة المرور">
            <div className="space-y-4">
                <Field label="الحالية"><input type="password" dir="ltr" className={inputCls} value={v.old} onChange={e => setV({ ...v, old: e.target.value })} autoComplete="current-password" /></Field>
                <Field label="الجديدة" hint="ثمانية أحرف فأكثر"><input type="password" dir="ltr" className={inputCls} value={v.new} onChange={e => setV({ ...v, new: e.target.value })} autoComplete="new-password" /></Field>
                <Field label="أعد كتابتها"><input type="password" dir="ltr" className={inputCls} value={v.again} onChange={e => setV({ ...v, again: e.target.value })} autoComplete="new-password" /></Field>
                {err ? <p className="text-[13px] text-red-700 font-semibold">{err}</p> : null}
                <Btn className="w-full" busy={busy} onClick={save}>حفظ</Btn>
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
        if (!r.success) { toast(r.message, 'err'); return; }
        window.location.href = r.url;
    };
    const unlink = async () => {
        if (!window.confirm('فكّ ربط Drive؟ تبقى الملفات في درايفك وعلى الخادم، وتتوقّف الرفعات الجديدة.')) return;
        const r = await call('drive_unlink', { body: {} });
        if (r.success) { toast('فُكّ الربط'); load(); }
    };

    if (!s) return <Card className="p-4"><Spinner className="!py-6" /></Card>;
    const c = s.counts || {};
    return (
        <Card className="p-4 space-y-3">
            <div className="flex items-center gap-2">
                <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand flex items-center justify-center"><HardDrive size={17} /></span>
                <div className="flex-1">
                    <div className="font-bold text-[14px]">Google Drive</div>
                    <div className="text-[12px] text-ink-3">مجلد «عُهدة» في درايفك، وتحته مجلد لكل مستخدم</div>
                </div>
                {s.linked ? <span className="text-[12px] font-semibold text-brand flex items-center gap-1"><CheckCircle2 size={14} />مربوط</span> : null}
            </div>

            {!s.configured ? (
                <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-[12.5px] text-amber-900 leading-6">
                    مفاتيح Google لم تُضف إلى الخادم بعد. الملفات محفوظة على الخادم الآن، وتُرفع كلها إلى درايف تلقائياً فور الربط.
                </div>
            ) : !s.linked ? (
                <Btn className="w-full" busy={busy} onClick={link}><Link2 size={16} />اربط حساب Google Drive</Btn>
            ) : (
                <>
                    <div className="grid grid-cols-3 gap-2 text-center">
                        {[['رُفعت', c.done || 0, 'text-brand'], ['بالانتظار', c.pending || 0, 'text-ink'], ['تعثّرت', c.failed || 0, c.failed ? 'text-red-700' : 'text-ink']].map(([t, n, cl]) => (
                            <div key={t} className="rounded-xl bg-paper p-2.5">
                                <div className={'text-[18px] font-bold ' + cl}>{n}</div>
                                <div className="text-[11px] text-ink-3">{t}</div>
                            </div>
                        ))}
                    </div>
                    {s.last_error && (c.failed || c.pending > 5) ? (
                        <p className="text-[11.5px] text-ink-3 flex gap-1.5"><AlertTriangle size={13} className="shrink-0 text-amber mt-0.5" />
                            آخر خطأ: {(s.last_error.error && (s.last_error.error.message || s.last_error.error)) || s.last_error.error_description || 'غير معروف'}</p>
                    ) : null}
                    <div className="flex gap-2">
                        <Btn kind="line" className="flex-1" busy={busy} onClick={link}>إعادة الربط</Btn>
                        <Btn kind="ghost" onClick={unlink}>فكّ الربط</Btn>
                    </div>
                </>
            )}
        </Card>
    );
}

// ─── المستخدمون ─────────────────────────────────────────────────────────────
function UsersPanel() {
    const { me } = useData();
    const toast = useToast();
    const [rows, setRows] = useState(null);
    const [edit, setEdit] = useState(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const load = () => call('users').then(r => r.success && setRows(r.data));
    useEffect(() => { load(); }, []);

    const save = async () => {
        setErr(''); setBusy(true);
        const r = await call('user_save', { body: edit });
        setBusy(false);
        if (!r.success) { setErr(r.message); return; }
        toast(edit.id ? 'حُفظ المستخدم' : 'أُنشئ الحساب — أرسل له اسم الدخول وكلمة المرور');
        setEdit(null); load();
    };

    return (
        <Card className="overflow-hidden">
            <div className="flex items-center gap-2 p-4 pb-2">
                <span className="w-9 h-9 rounded-xl bg-brand-50 text-brand flex items-center justify-center"><Users size={17} /></span>
                <div className="flex-1">
                    <div className="font-bold text-[14px]">المستخدمون</div>
                    <div className="text-[12px] text-ink-3">لكل مستخدمٍ بياناته وحده — لا يرى أحدٌ بيانات غيره</div>
                </div>
                <Btn kind="soft" className="!h-9 !px-3 text-[13px]" onClick={() => { setErr(''); setEdit({ username: '', name: '', password: '', active: 1 }); }}>
                    <UserPlus size={15} />إضافة
                </Btn>
            </div>
            {!rows ? <Spinner className="!py-8" /> : (
                <div className="divide-y divide-paper-2">
                    {rows.map(u => (
                        <button key={u.id} onClick={() => { setErr(''); setEdit({ ...u, password: '', active: Number(u.active) }); }}
                            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-paper text-right">
                            <span className={'w-9 h-9 rounded-xl flex items-center justify-center font-bold ' + (Number(u.active) ? 'bg-paper-2 text-ink-2' : 'bg-red-50 text-red-400')}>{u.name.slice(0, 1)}</span>
                            <span className="flex-1 min-w-0">
                                <span className="block text-[14px] font-semibold">{u.name}{u.role === 'admin' ? <span className="text-[11px] text-brand font-semibold"> · مدير</span> : null}{!Number(u.active) ? <span className="text-[11px] text-red-600"> · موقوف</span> : null}</span>
                                <span className="block text-[12px] text-ink-3" dir="ltr">@{u.username} · {u.txns} حركة{u.last_login ? ' · آخر دخول ' + fullDate(u.last_login.slice(0, 10)) : ''}</span>
                            </span>
                            <ChevronLeft size={16} className="text-ink-3" />
                        </button>
                    ))}
                </div>
            )}

            <Sheet open={!!edit} onClose={() => setEdit(null)} title={edit && edit.id ? 'تعديل المستخدم' : 'مستخدم جديد'}>
                {edit ? (
                    <div className="space-y-4">
                        <Field label="الاسم"><input className={inputCls} value={edit.name} onChange={e => setEdit({ ...edit, name: e.target.value })} placeholder="أمي، عهدة العمل…" /></Field>
                        {!edit.id ? (
                            <Field label="اسم الدخول" hint="حروف إنجليزية صغيرة وأرقام">
                                <input className={inputCls} dir="ltr" autoCapitalize="none" value={edit.username} onChange={e => setEdit({ ...edit, username: e.target.value })} />
                            </Field>
                        ) : null}
                        <Field label={edit.id ? 'كلمة مرور جديدة' : 'كلمة المرور'} hint={edit.id ? 'اتركها فارغة لتبقى كما هي' : 'ثمانية أحرف فأكثر'}>
                            <input className={inputCls} dir="ltr" value={edit.password} onChange={e => setEdit({ ...edit, password: e.target.value })} autoComplete="new-password" />
                        </Field>
                        {edit.id && Number(edit.id) !== Number(me.id) ? (
                            <label className="flex items-center gap-2 text-[14px]">
                                <input type="checkbox" className="w-5 h-5 accent-brand" checked={!!edit.active} onChange={e => setEdit({ ...edit, active: e.target.checked ? 1 : 0 })} />
                                الحساب فعّال
                            </label>
                        ) : null}
                        {err ? <p className="text-[13px] text-red-700 font-semibold">{err}</p> : null}
                        <Btn className="w-full" busy={busy} onClick={save}>حفظ</Btn>
                    </div>
                ) : null}
            </Sheet>
        </Card>
    );
}
