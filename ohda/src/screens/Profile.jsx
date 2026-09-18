import React, { useEffect, useRef, useState } from 'react';
import { Building2, User, FileSignature, ImagePlus, Trash2, Check, Languages } from 'lucide-react';
import { call, shrink } from '../lib/api';
import { t } from '../lib/i18n';
import { Card, Btn, Field, inputCls, Seg, useToast } from '../ui';
import { useData } from '../App';

// الجوّال المخزَّن دولياً (9665…) يُعرض محلياً (05…) كما يكتبه الناس
export const localPhone = p => (!p ? '' : /^966/.test(String(p)) ? '0' + String(p).slice(3) : '+' + p);

// إعداد الحساب: بيانات المنشأة وصاحب العهدة والمعتمِد — تظهر في الكشوف والتقارير
export default function Profile() {
    const { me, profile, logo, reloadMe, lang, changeLang } = useData();
    const toast = useToast();
    const [v, setV] = useState(() => ({ ...profile, name: me.name, email: me.email || '', phone: localPhone(me.phone) }));
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const [logoBusy, setLogoBusy] = useState(false);
    const fileRef = useRef(null);
    useEffect(() => { setV(x => ({ ...profile, ...x })); }, [profile]);   // eslint-disable-line react-hooks/exhaustive-deps

    const set = k => e => setV({ ...v, [k]: e.target.value });

    const save = async () => {
        setErr(''); setBusy(true);
        const r = await call('profile_save', { body: v });
        setBusy(false);
        if (!r.success) { setErr(t(r.message)); return; }
        await reloadMe();
        toast(t('حُفظ إعداد الحساب'));
    };

    const upLogo = async e => {
        const f = e.target.files && e.target.files[0];
        e.target.value = '';
        if (!f) return;
        setLogoBusy(true);
        const sm = await shrink(f);
        const form = new FormData();
        // الشعار PNG يُحفظ كما هو ليبقى خلفيته شفافة، وغيره يُصغَّر
        form.append('file', f.type === 'image/png' ? f : sm, f.name || 'logo');
        const r = await call('logo_upload', { form });
        setLogoBusy(false);
        if (!r.success) { toast(t(r.message), 'err'); return; }
        await reloadMe();
        toast(t('رُفع الشعار'));
    };
    const rmLogo = async () => {
        const r = await call('logo_upload', { body: { remove: 1 } });
        if (r.success) { await reloadMe(); toast(t('أُزيل الشعار')); }
    };

    const F = ({ k, label, hint, ltr, ph, type }) => (
        <Field label={t(label)} hint={hint ? t(hint) : null}>
            <input className={inputCls} value={v[k] || ''} onChange={set(k)} dir={ltr ? 'ltr' : undefined} placeholder={ph || ''} type={type || 'text'}
                inputMode={type === 'tel' ? 'tel' : undefined} />
        </Field>
    );

    return (
        <div className="pt-2 lg:pt-0 space-y-5 lg:grid lg:grid-cols-2 lg:gap-6 lg:space-y-0 lg:items-start">
            <div className="space-y-5">
                {/* اللغة */}
                <Card className="p-4">
                    <div className="flex items-center gap-2 mb-3 font-bold text-[14px]"><Languages size={17} className="text-brand" />{t('لغة التطبيق')}</div>
                    <Seg value={lang} onChange={l => changeLang(l, true)} options={[{ v: 'ar', t: 'العربية' }, { v: 'en', t: 'English' }]} />
                </Card>

                {/* المنشأة */}
                <Card className="p-4 space-y-4">
                    <div className="flex items-center gap-2 font-bold text-[14px]"><Building2 size={17} className="text-brand" />{t('المنشأة')}</div>
                    <div className="flex items-center gap-3">
                        <div className="w-20 h-20 rounded-2xl border border-paper-2 bg-white flex items-center justify-center overflow-hidden shrink-0">
                            {logo ? <img src={logo} alt="" className="w-full h-full object-contain" /> : <ImagePlus size={24} className="text-ink-3" />}
                        </div>
                        <div className="flex flex-col gap-2">
                            <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={upLogo} />
                            <Btn kind="soft" className="!h-9 text-[13px]" busy={logoBusy} onClick={() => fileRef.current.click()}>
                                <ImagePlus size={15} />{t(logo ? 'تغيير الشعار' : 'رفع شعار المنشأة')}
                            </Btn>
                            {logo ? <Btn kind="ghost" className="!h-8 text-[12px]" onClick={rmLogo}><Trash2 size={14} />{t('إزالة')}</Btn> : null}
                            <span className="text-[11px] text-ink-3">{t('PNG بخلفية شفافة أفضل')}</span>
                        </div>
                    </div>
                    {F({ k: 'org_name', label: 'اسم المنشأة' })}
                    {F({ k: 'org_name_en', label: 'اسم المنشأة بالإنجليزية', ltr: true })}
                    <div className="grid grid-cols-2 gap-3">
                        {F({ k: 'vat_no', label: 'الرقم الضريبي', hint: '١٥ رقماً', ltr: true, ph: '3xxxxxxxxxxxxx3' })}
                        {F({ k: 'cr_no', label: 'السجل التجاري', ltr: true })}
                    </div>
                    {F({ k: 'org_address', label: 'العنوان' })}
                    <div className="grid grid-cols-2 gap-3">
                        {F({ k: 'org_phone', label: 'هاتف المنشأة', ltr: true, type: 'tel' })}
                        {F({ k: 'org_email', label: 'بريد المنشأة', ltr: true, type: 'email' })}
                    </div>
                </Card>
            </div>

            <div className="space-y-5">
                {/* المستفيد */}
                <Card className="p-4 space-y-4">
                    <div className="flex items-center gap-2 font-bold text-[14px]"><User size={17} className="text-brand" />{t('المستفيد (صاحب العهدة)')}</div>
                    {F({ k: 'name', label: 'اسمك في التطبيق' })}
                    {F({ k: 'beneficiary', label: 'الاسم كما يظهر في الكشوف', hint: 'اتركه فارغاً ليُستعمل اسمك' })}
                    <div className="grid grid-cols-2 gap-3">
                        {F({ k: 'email', label: 'البريد الإلكتروني', ltr: true, type: 'email' })}
                        {F({ k: 'phone', label: 'رقم الجوال', ltr: true, type: 'tel', ph: '05xxxxxxxx' })}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        {F({ k: 'employee_no', label: 'الرقم الوظيفي', ltr: true })}
                        {F({ k: 'job_title', label: 'المسمّى الوظيفي' })}
                    </div>
                    {F({ k: 'department', label: 'الإدارة' })}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="col-span-2">{F({ k: 'iban', label: 'الآيبان', hint: 'لتحويل المستحقّ عند التصفية', ltr: true, ph: 'SA00 0000 0000 0000 0000 0000' })}</div>
                        {F({ k: 'bank', label: 'البنك' })}
                    </div>
                </Card>

                {/* التقارير */}
                <Card className="p-4 space-y-4">
                    <div className="flex items-center gap-2 font-bold text-[14px]"><FileSignature size={17} className="text-brand" />{t('التقارير والاعتماد')}</div>
                    <div className="grid grid-cols-2 gap-3">
                        {F({ k: 'approver_name', label: 'اسم المعتمِد' })}
                        {F({ k: 'approver_title', label: 'صفته' })}
                    </div>
                    <Field label={t('ملاحظة أسفل التقارير')} hint={t('تظهر في ذيل كشف الحساب وتقرير التصفية')}>
                        <textarea className={inputCls + ' h-auto py-2 min-h-[70px]'} value={v.report_note || ''} onChange={set('report_note')} />
                    </Field>
                </Card>

                {err ? <p className="text-[13px] text-red-700 font-semibold">{err}</p> : null}
                <Btn className="w-full !h-12" busy={busy} onClick={save}><Check size={18} />{t('حفظ')}</Btn>
            </div>
        </div>
    );
}
