// ─── تنسيق الأرقام والتواريخ ────────────────────────────────────────────────

export const money = (v, frac) => {
    const n = Number(v || 0);
    const f = frac !== undefined ? frac : (Math.round(n) === n ? 0 : 2);
    return n.toLocaleString('en-US', { minimumFractionDigits: f, maximumFractionDigits: f });
};

export const today = () => {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

const iso = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

// الفترات الجاهزة في لوحة المعلومات
export function period(key) {
    const n = new Date();
    const y = n.getFullYear(), m = n.getMonth();
    switch (key) {
        case 'last': return { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) };
        case 'q':    return { from: iso(new Date(y, Math.floor(m / 3) * 3, 1)), to: iso(new Date(y, Math.floor(m / 3) * 3 + 3, 0)) };
        case 'year': return { from: y + '-01-01', to: y + '-12-31' };
        case 'all':  return { from: '2000-01-01', to: '2100-12-31' };
        default:     return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
    }
}

const AR = 'ar-SA-u-ca-gregory-nu-latn';
export const dayLabel = s => {
    if (!s) return '';
    const t = today();
    const y = iso(new Date(Date.now() - 86400000));
    if (s === t) return 'اليوم';
    if (s === y) return 'أمس';
    return new Date(s + 'T12:00:00').toLocaleDateString(AR, { weekday: 'long', day: 'numeric', month: 'long' });
};
export const shortDate = s => (s ? new Date(s + 'T12:00:00').toLocaleDateString(AR, { day: 'numeric', month: 'short' }) : '');
export const fullDate = s => (s ? new Date(s + 'T12:00:00').toLocaleDateString(AR, { day: 'numeric', month: 'long', year: 'numeric' }) : '');
export const monthLabel = ym => new Date(ym + '-15T12:00:00').toLocaleDateString(AR, { month: 'short' });

export const METHODS = { cash: 'نقداً', card: 'بطاقة', transfer: 'تحويل' };
export const KINDS = { custody: 'عهدة عمل', budget: 'ميزانية', personal: 'مصاريف شخصية' };
