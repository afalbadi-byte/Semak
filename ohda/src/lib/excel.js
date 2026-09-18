// ─── Excel عُهدة بهويّة التطبيق ─────────────────────────────────────────────
// ألوان عُهدة، وشعار المنشأة من «إعداد الحساب» (أو شعار التطبيق)، وبياناتها في التذييل،
// وخانات توقيع صاحب العهدة والمعتمِد. الأرقام تُجمع، وكل صفحة مستندٍ رابطٌ يُنقر.
import { brandedExcel } from '../../../src/lib/brandedExcel';
import { t, isEn } from './i18n';
import { call } from './api';
import { fullDate, METHODS, KINDS } from './fmt';

function theme(profile, logo, who) {
    const p = profile || {};
    const org = (isEn() && p.org_name_en) || p.org_name || t('عُهدة');
    return {
        org, font: 'IBM Plex Sans Arabic', rtl: !isEn(),
        primary: '#0f6b61', accent: '#c77a12', accentText: '#9a5d0c',
        soft: '#e7f3f1', zebra: '#faf8f3', accentSoft: '#fbf0dd', ink: '#18211f', muted: '#7b8784', line: '#ebe7de',
        logo: logo || './icon-512.png',
        footer: [p.org_address, p.org_phone, p.org_email,
            p.vat_no ? t('الرقم الضريبي') + ' ' + p.vat_no : '', p.cr_no ? t('السجل التجاري') + ' ' + p.cr_no : '']
            .filter(Boolean).join('  |  ') || t('عُهدة'),
        signatures: [[t('صاحب العهدة'), p.beneficiary || who || ''], [t('المراجِع / المعتمِد'), '']],
        labels: { issued: t('تاريخ الإصدار'), page: t('صفحة'), of: t('من'), sign: t('التوقيع والتاريخ') },
    };
}

const range = (from, to) => (from || t('البداية')) + ' — ' + (to || t('اليوم'));
const pagesOf = x => (x.docs && x.docs.length ? x.docs.map(dc => dc.url) : x.doc_url ? [x.doc_url] : []);
const docCells = (x, n) => {
    const ps = pagesOf(x);
    return Array.from({ length: n }, (_, k) => ps[k] ? { v: n > 1 ? t('صفحة') + ' ' + (k + 1) : t('عرض'), href: ps[k] } : '');
};
const docCols = n => Array.from({ length: n }, (_, k) => ({ label: n > 1 ? t('المستند') + ' ' + (k + 1) : t('المستند'), width: 11 }));
const desc = x => [x.vendor || t(x.type === 'in' ? 'استلام مبلغ' : 'مصروف'), x.ref, x.note].filter(Boolean).join(' · ');

// ── كشف الحساب ──
export async function statementExcel(d, { fundName, from, to, who }) {
    const p = d.profile || {};
    const rows = d.rows || [];
    const n = Math.max(1, ...rows.map(x => pagesOf(x).length));
    const all = !d.fund;
    const sum = k => rows.filter(x => x.type === k).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const vat = rows.filter(x => x.type === 'out').reduce((s, x) => s + (Number(x.vat) || 0), 0);
    const blank = (k) => Array(k).fill('');
    await brandedExcel({
        title: t('كشف حساب'), subtitle: fundName, sheet: t('كشف الحساب'),
        filename: [t('كشف حساب'), fundName, range(from, to).replace(' — ', ' - ')].join(' - '),
        meta: [[t('الفترة'), range(from, to)], [t('صاحب العهدة'), p.beneficiary || who || ''],
            [t('الجوال'), p.phone || ''], [t('البريد'), p.email || '']],
        cards: [[t('الرصيد الافتتاحي'), d.opening], [t('الوارد'), sum('in')], [t('الصادر'), sum('out')], [t('الرصيد الختامي'), d.closing, true]],
        columns: [{ label: t('التاريخ'), type: 'date' }, { label: t('البيان'), width: 38 }, { label: t('التصنيف'), width: 16 },
            ...(all ? [{ label: t('العهدة'), width: 16 }] : []),
            { label: t('وارد'), type: 'money' }, { label: t('صادر'), type: 'money' }, { label: t('الضريبة'), type: 'money', width: 12 },
            { label: t('الرصيد'), type: 'money' }, ...docCols(n)],
        rows: [
            ['', { v: t('الرصيد الافتتاحي'), b: 1 }, '', ...(all ? [''] : []), '', '', '', Number(d.opening) || 0, ...blank(n)],
            ...rows.map(x => [x.d, desc(x), x.type === 'out' ? (x.cat_name || '') : '', ...(all ? [x.fund_name || ''] : []),
                x.type === 'in' ? x.amount : '', x.type === 'out' ? x.amount : '', x.type === 'out' && x.vat ? x.vat : '', x.balance, ...docCells(x, n)]),
        ],
        foot: ['', { v: t('الإجماليات'), b: 1 }, '', ...(all ? [''] : []), sum('in'), sum('out'), vat, Number(d.closing) || 0, ...blank(n)],
        signature: true,
    }, theme(p, d.logo_url, who));
}

// ── تقرير تصفية العهدة: المستلَم، المصروفات مرقّمةً بإيصالاتها، وحسب التصنيف ──
export async function fundReportExcel(f, data, { profile, logo, who }) {
    // روابط المستندات الدائمة (درايف أو رابط سنة) من كشف العهدة
    const st = await call('statement', { params: { fund: f.id } });
    const links = {};
    (st && st.rows ? st.rows : []).forEach(x => { links[x.id] = x; });
    const n = Math.max(1, ...data.outs.map(x => pagesOf(links[x.id] || {}).length));
    const bal = data.received - data.spent;
    const cards = [[t('المستلم'), data.received], [t('المصروف'), data.spent], [t('الضريبة'), data.vat],
        [bal >= 0 ? t('المتبقّي لدى صاحب العهدة') : t('المستحق لصاحب العهدة'), Math.abs(bal), true]];
    const p = profile || {};
    await brandedExcel({
        title: t('تقرير تصفية عهدة'), subtitle: f.name + ' · ' + t(KINDS[f.kind] || ''), sheet: t('تقرير التصفية'),
        filename: t('تقرير تصفية عهدة') + ' - ' + f.name,
        meta: [[t('الفترة'), (fullDate(data.from) || '—') + ' — ' + (fullDate(data.to) || '—')],
            [t('الحالة'), t(f.status === 'settled' ? 'مُصفّاة' : 'مفتوحة')],
            [t('صاحب العهدة'), p.beneficiary || who || ''], [t('الآيبان'), p.iban ? p.iban + (p.bank ? ' — ' + p.bank : '') : '']],
        cards,
        tables: [
            ...(data.ins.length ? [{
                title: t('المبالغ المستلمة'),
                columns: [{ label: t('التاريخ'), type: 'date' }, { label: t('المصدر'), width: 38 }, { label: t('المرجع'), width: 16 }, { label: t('المبلغ'), type: 'money' }],
                rows: data.ins.map(x => [x.d, x.vendor || x.note || t('استلام مبلغ'), x.ref || '', x.amount]),
                foot: ['', { v: t('الإجمالي'), b: 1 }, '', data.received],
            }] : []),
            {
                title: t('المصروفات ({n})', { n: data.outs.length }),
                columns: [{ label: '#', width: 6 }, { label: t('التاريخ'), type: 'date' }, { label: t('الجهة'), width: 30 }, { label: t('التصنيف'), width: 16 },
                    { label: t('الدفع'), width: 12 }, { label: t('المرجع'), width: 14 }, { label: t('الضريبة'), type: 'money', width: 12 },
                    { label: t('المبلغ'), type: 'money' }, ...docCols(n)],
                rows: data.outs.map(x => [x.n, x.d, x.vendor || x.note || '', x.cat_name || '', x.method ? t(METHODS[x.method]) : '', x.ref || '',
                    x.vat || '', x.amount, ...docCells(links[x.id] || {}, n)]),
                foot: ['', '', { v: t('الإجمالي'), b: 1 }, '', '', '', data.vat, data.spent, ...Array(n).fill('')],
            },
            {
                title: t('حسب التصنيف'),
                columns: [{ label: t('التصنيف'), width: 30 }, { label: t('المبلغ'), type: 'money' }, { label: '%', width: 8 }],
                rows: data.byCat.map(([k, v]) => [k, v, data.spent ? Math.round(v / data.spent * 1000) / 10 + '%' : '']),
            },
        ],
        note: data.missing ? t('تنبيه: {n} مصروفٍ بلا إيصال مرفق.', { n: data.missing }) : '',
        signature: true,
    }, theme(p, logo, who));
}
