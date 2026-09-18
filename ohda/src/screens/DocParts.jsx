import React from 'react';
import { t, isEn } from '../lib/i18n';
import { fullDate } from '../lib/fmt';

// ─── أجزاء المستندات المطبوعة: الترويسة وبيانات المستفيد والتوقيعات ───────────
// من «إعداد الحساب»: شعار المنشأة واسمها ورقمها الضريبي وسجلّها، وبيانات صاحب
// العهدة وآيبانه، واسم المعتمِد — فيخرج الكشف ورقةً رسمية تُسلَّم كما هي.

export function DocHeader({ title, subtitle, meta, profile = {}, logo }) {
    const org = (isEn() && profile.org_name_en) || profile.org_name;
    return (
        <header className="border-b-2 border-ink pb-4 mb-5">
            <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                    {logo ? <img src={logo} alt="" className="w-16 h-16 object-contain shrink-0" /> : null}
                    <div className="min-w-0">
                        {org ? <div className="text-[15px] font-bold leading-6">{org}</div> : null}
                        <div className="text-[11px] text-ink-2 leading-5">
                            {profile.vat_no ? <span>{t('الرقم الضريبي')}: <b className="tabular-nums" dir="ltr">{profile.vat_no}</b></span> : null}
                            {profile.vat_no && profile.cr_no ? ' · ' : ''}
                            {profile.cr_no ? <span>{t('السجل التجاري')}: <b className="tabular-nums" dir="ltr">{profile.cr_no}</b></span> : null}
                        </div>
                        {profile.org_address ? <div className="text-[11px] text-ink-3 leading-5">{profile.org_address}</div> : null}
                        {profile.org_phone || profile.org_email ? (
                            <div className="text-[11px] text-ink-3 leading-5" dir="ltr" style={{ textAlign: isEn() ? 'left' : 'right' }}>
                                {[profile.org_phone, profile.org_email].filter(Boolean).join(' · ')}
                            </div>
                        ) : null}
                    </div>
                </div>
                <div className="text-end shrink-0">
                    <h1 className="text-[22px] font-bold leading-7">{title}</h1>
                    {subtitle ? <p className="text-[13px] mt-0.5">{subtitle}</p> : null}
                    <div className="text-[11.5px] text-ink-2 leading-6 mt-1">
                        {meta.map(([k, v]) => <div key={k}>{k}: {v}</div>)}
                    </div>
                </div>
            </div>
        </header>
    );
}

// بيانات صاحب العهدة — لا تظهر إلا الحقول المعبّأة
export function Beneficiary({ name, email, phone, profile = {} }) {
    const rows = [
        ['صاحب العهدة', profile.beneficiary || name],
        ['الرقم الوظيفي', profile.employee_no],
        ['المسمّى الوظيفي', profile.job_title],
        ['الإدارة', profile.department],
        ['البريد', email, true],
        ['الجوال', phone ? '+' + phone : '', true],
        ['الآيبان', profile.iban, true],
        ['البنك', profile.bank],
    ].filter(r => r[1]);
    if (!rows.length) return null;
    return (
        <section className="mb-5 rounded-xl border border-paper-2 px-3 py-2.5 grid grid-cols-2 lg:grid-cols-4 print:grid-cols-4 gap-x-4 gap-y-1.5 text-[11.5px] print-avoid">
            {rows.map(([k, v, ltr]) => (
                <div key={k} className="min-w-0">
                    <div className="text-ink-3">{t(k)}</div>
                    <div className={'font-semibold ' + (ltr ? 'break-all' : 'truncate')} dir={ltr ? 'ltr' : undefined} style={ltr ? { textAlign: isEn() ? 'left' : 'right' } : undefined}>{v}</div>
                </div>
            ))}
        </section>
    );
}

export function Signatures({ name, profile = {} }) {
    const cols = [
        [t('صاحب العهدة'), profile.beneficiary || name, profile.job_title],
        [t('المراجِع / المعتمِد'), profile.approver_name, profile.approver_title],
    ];
    return (
        <section className="grid grid-cols-2 gap-10 mt-10 mb-4 print-avoid text-[12px]">
            {cols.map(([role, who, title]) => (
                <div key={role}>
                    <div className="font-bold">{role}</div>
                    <div className="text-ink-2 mb-8 min-h-[18px]">{who || ''}{title ? ' — ' + title : ''}</div>
                    <div className="border-t border-ink pt-1 text-ink-3">{t('التوقيع والتاريخ')}</div>
                </div>
            ))}
        </section>
    );
}

export function DocFooter({ right, note }) {
    return (
        <footer className="mt-8 pt-3 border-t border-paper-2 text-[10.5px] text-ink-3">
            {note ? <p className="mb-2 text-ink-2 leading-5">{note}</p> : null}
            <div className="flex justify-between">
                <span>{t('أُعدّ بتطبيق عُهدة')} · {fullDate(new Date().toISOString().slice(0, 10))}</span><span>{right}</span>
            </div>
        </footer>
    );
}
