// ─── أوصاف كشوف المشتريات: كشف المورد وكشف المشروع ─────────────────────────
// تُستعمل في الموقع وفي تطبيق المشتريات معاً، فيخرج الملفّ نفسه من المكانين.
const n = v => Number(v) || 0;
const period = (from, to) => ((from || to) ? (from || 'البداية') + ' — ' + (to || 'اليوم') : 'كل الفترات');
const fname = (t, name, from, to) => t + ' — ' + name + ((from || to) ? ' ' + (from || '…') + ' إلى ' + (to || '…') : '');

// كشف حساب المورد: فواتير ومرتجعات ودفعات برصيدٍ متحرّك
export function supplierDoc(supplier, d, rows, from, to) {
    const list = rows || d.rows || [];
    const closing = n(d.closing);
    return {
        title: 'كشف حساب مورد', subtitle: supplier, filename: fname('كشف حساب', supplier, from, to),
        meta: [['المورد', supplier], ['الفترة', period(from, to)]],
        cards: [['رصيد أول المدة', n(d.opening)], ['عليه (فواتير)', n(d.total_debit)], ['له (دفعات ومرتجعات)', n(d.total_credit)],
            [closing >= 0 ? 'المستحق للمورد' : 'رصيدنا عنده', Math.abs(closing), true]],
        columns: [{ label: 'التاريخ', type: 'date' }, { label: 'الحركة', width: 12 }, { label: 'المرجع', width: 30 },
            { label: 'عليه', type: 'money' }, { label: 'له', type: 'money' }, { label: 'الرصيد', type: 'money' }],
        rows: [['', '', { v: 'رصيد أول المدة', b: 1 }, '', '', n(d.opening)],
            ...list.map(r => [r.date, r.kind, r.ref || '', n(r.debit) || '', n(r.credit) || '', n(r.balance)])],
        foot: ['', '', { v: 'الإجماليات', b: 1 }, n(d.total_debit), n(d.total_credit), closing],
        signature: true,
    };
}

const KIND = { invoice: 'فاتورة', refund: 'مرتجع', extra: 'تكلفة إضافية', payment: 'دفعة' };

// كشف حساب المشروع: الفواتير والمرتجعات والتكاليف الإضافية والدفعات
export function projectDoc(projectName, d, lines, from, to) {
    const s = d.summary || {};
    const list = lines || d.lines || [];
    const basis = s.basis === 'gross' ? 'شامل الضريبة' : 'صافي بلا ضريبة';
    const cards = [
        ['الميزانية', n(s.budget)], ['المفوتر', n(s.invoiced)], ['المرتجع', n(s.refunded)],
        ['صافي التكلفة', n(s.net_cost), true], ['المدفوع', n(s.paid)], ['المستحق للموردين', n(s.outstanding)],
    ];
    if (s.remaining !== undefined && s.remaining !== null) cards.push(['المتبقّي من الميزانية', n(s.remaining)]);
    return {
        title: 'كشف حساب مشروع', subtitle: projectName, filename: fname('كشف حساب مشروع', projectName, from, to),
        meta: [['المشروع', projectName], ['الفترة', period(from, to)], ['الأساس', basis]],
        cards,
        columns: [{ label: 'التاريخ', type: 'date' }, { label: 'النوع', width: 12 }, { label: 'الرقم', width: 12 },
            { label: 'المورد / الطرف', width: 30 }, { label: 'مدين', type: 'money' }, { label: 'دائن', type: 'money' },
            { label: 'مدفوع', type: 'money' }, { label: 'الضريبة', type: 'money' }, { label: 'الرصيد', type: 'money' }],
        rows: list.map(l => [l.date || '', KIND[l.type] || l.type || '', l.no || l.ref || '', l.party || l.supplier || '',
            n(l.debit) || '', n(l.credit) || '', n(l.cash) || '', n(l.vat) || '', l.type === 'payment' ? '' : n(l.balance)]),
        foot: ['', '', '', { v: 'الإجماليات', b: 1 },
            list.reduce((a, l) => a + n(l.debit), 0), list.reduce((a, l) => a + n(l.credit), 0),
            list.reduce((a, l) => a + n(l.cash), 0), list.reduce((a, l) => a + n(l.vat), 0), ''],
        signature: true,
    };
}
