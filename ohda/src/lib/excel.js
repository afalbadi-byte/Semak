// ─── كشف الحساب بصيغة Excel ────────────────────────────────────────────────
// ملفٌّ حقيقي: الأرقام تُجمع، والورقة باتجاه اللغة، وكل صفحة مستندٍ رابطٌ يُنقر.
import { t, isEn } from './i18n';

export async function statementExcel(d, { fundName, from, to }) {
    const XLSX = await import('xlsx');                 // يُحمَّل عند الحاجة فقط
    const p = d.profile || {};
    const rows = d.rows || [];
    const pages = x => (x.docs && x.docs.length ? x.docs.map(dc => dc.url) : x.doc_url ? [x.doc_url] : []);
    const maxPages = Math.max(1, ...rows.map(x => pages(x).length));
    const head = [t('التاريخ'), t('البيان'), t('التصنيف'), ...(d.fund ? [] : [t('العهدة')]), t('وارد'), t('صادر'), t('الضريبة'), t('الرصيد')];
    const docCols = Array.from({ length: maxPages }, (_, k) => maxPages > 1 ? t('المستند') + ' ' + (k + 1) : t('المستند'));

    const aoa = [];
    const org = (isEn() && p.org_name_en) || p.org_name;
    if (org) aoa.push([org]);
    aoa.push([t('كشف حساب') + ' — ' + fundName]);
    aoa.push([t('الفترة'), (from || t('البداية')) + ' — ' + (to || t('اليوم'))]);
    if (p.vat_no) aoa.push([t('الرقم الضريبي'), p.vat_no]);
    if (p.beneficiary) aoa.push([t('صاحب العهدة'), p.beneficiary]);
    aoa.push([t('تاريخ الإصدار'), new Date().toISOString().slice(0, 10)]);
    aoa.push([]);
    const headRow = aoa.length;
    aoa.push([...head, ...docCols]);
    const blank = head.length - 1;
    aoa.push([ '', t('الرصيد الافتتاحي'), ...Array(blank - 2).fill(''), Number(d.opening) || 0 ]);
    const first = aoa.length;
    rows.forEach(x => {
        const desc = [x.vendor || t(x.type === 'in' ? 'استلام مبلغ' : 'مصروف'), x.ref, x.note].filter(Boolean).join(' · ');
        aoa.push([x.d, desc, x.type === 'out' ? (x.cat_name || '') : '', ...(d.fund ? [] : [x.fund_name || '']),
            x.type === 'in' ? x.amount : '', x.type === 'out' ? x.amount : '', x.type === 'out' && x.vat ? x.vat : '', x.balance]);
    });
    const sum = k => rows.filter(x => x.type === k).reduce((s, x) => s + (Number(x.amount) || 0), 0);
    const vat = rows.filter(x => x.type === 'out').reduce((s, x) => s + (Number(x.vat) || 0), 0);
    aoa.push(['', t('الإجماليات'), '', ...(d.fund ? [] : ['']), sum('in'), sum('out'), vat, Number(d.closing) || 0]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    Object.keys(ws).forEach(k => { if (k[0] !== '!' && ws[k].t === 'n') ws[k].z = '#,##0.00'; });
    rows.forEach((x, i) => pages(x).forEach((url, k) => {
        ws[XLSX.utils.encode_cell({ r: first + i, c: head.length + k })] =
            { t: 's', v: maxPages > 1 ? t('صفحة') + ' ' + (k + 1) : t('عرض'), l: { Target: url, Tooltip: t('فتح المستند') } };
    }));
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: aoa.length - 1, c: head.length + maxPages - 1 } });
    ws['!cols'] = [{ wch: 12 }, { wch: 40 }, { wch: 16 }, ...(d.fund ? [] : [{ wch: 16 }]), { wch: 13 }, { wch: 13 }, { wch: 11 }, { wch: 14 }, ...docCols.map(() => ({ wch: 10 }))];
    ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: headRow, c: 0 }, e: { r: headRow + rows.length + 1, c: head.length - 1 } }) };

    const wb = XLSX.utils.book_new();
    wb.Workbook = { Views: [{ RTL: !isEn() }] };
    XLSX.utils.book_append_sheet(wb, ws, t('كشف الحساب').slice(0, 31));
    const name = [t('كشف حساب'), fundName, (from || t('البداية')) + ' - ' + (to || t('اليوم'))].join(' - ');
    XLSX.writeFile(wb, name.replace(/[\/:*?"<>|]+/g, ' ').trim().slice(0, 120) + '.xlsx');
}
