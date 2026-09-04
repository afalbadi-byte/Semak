// ─── روابط الكيانات: أي دلالة في النظام (مورد، فاتورة، صنف، مشروع، وحدة) لها بطاقة ───
export const ENTITY_LABEL = {
    supplier: 'مورد',
    purchase: 'فاتورة شراء',
    product:  'صنف',
    project:  'مشروع',
    unit:     'وحدة',
};

// المسار داخل اللوحة — التنقل عبر الـURL فالرابط قابل للمشاركة وزر الرجوع يعمل
export const entityPath = (type, value) =>
    `/admin/dashboard/ent/${type}/${encodeURIComponent(String(value ?? ''))}`;

// تفكيك المسار: كل ما بعد النوع هو القيمة (أسماء الموردين قد تحوي رموزاً)
export function parseEntity(splat) {
    if (!splat || !splat.startsWith('ent/')) return null;
    const rest = splat.slice(4);
    const i = rest.indexOf('/');
    if (i < 0) return null;
    const type = rest.slice(0, i);
    let value = rest.slice(i + 1);
    try { value = decodeURIComponent(value); } catch { /* القيمة كما هي */ }
    return { type, value };
}
