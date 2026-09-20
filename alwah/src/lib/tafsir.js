// ════════════════════════════════════════════════════════════════════════════
//  التفسير وسبب النزول: نصوصٌ منشورة بأسمائها، لا اجتهاد من التطبيق
//  ─────────────────────────────────────────────────────────────────────────
//  المصدر مكتبة tafsir_api (نصوصٌ مأخوذة من مركز تفسير وموقع quran.com)، وتُجلب
//  للآية وحدها وتُحفظ على الجهاز بعد أوّل مرّة. وكل نصٍّ يُعرض باسم كتابه ومؤلّفه.
// ════════════════════════════════════════════════════════════════════════════
const CDN = 'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/';

export const BOOKS = {
    mukhtasar: { slug: 'ar-tafsir-al-mukhtasar', name: 'المختصر في التفسير', by: 'مركز تفسير للدراسات القرآنية' },
    muyassar: { slug: 'ar-tafsir-muyassar', name: 'التفسير الميسر', by: 'مجمع الملك فهد لطباعة المصحف' },
    saadi: { slug: 'ar-tafsir-as-saadi', name: 'تيسير الكريم الرحمن', by: 'عبد الرحمن السعدي' },
    wajiz: { slug: 'al-wajiz-wahidi', name: 'الوجيز', by: 'أبو الحسن الواحدي، صاحب «أسباب النزول»', old: true },
};

const CK = (b, k) => 'alwah_tf_' + b + '_' + k.replace(':', '_');
const mem = new Map();

// نصّ كتابٍ لآية: من الذاكرة، ثم من الجهاز، ثم من الشبكة
export function ayahText(book, key) {
    const b = BOOKS[book];
    const id = book + '|' + key;
    if (mem.has(id)) return mem.get(id);
    const pr = (async () => {
        try { const c = localStorage.getItem(CK(book, key)); if (c !== null) return c; } catch (e) { /* لا تخزين */ }
        const [s, a] = key.split(':');
        const r = await fetch(`${CDN}${b.slug}/${s}/${a}.json`);
        if (!r.ok) throw new Error('تعذّر جلب النصّ');
        const j = await r.json();
        const t = clean(j.text || '');
        try { localStorage.setItem(CK(book, key), t); } catch (e) { /* تجاهل */ }
        return t;
    })().catch(e => { mem.delete(id); throw e; });
    mem.set(id, pr);
    return pr;
}

// تنظيف وسوم HTML والمسافات الزائدة
function clean(t) {
    return String(t)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

// جُمل سبب النزول: ما صُرّح فيه بالنزول
export function nuzulOf(text) {
    if (!text) return '';
    const parts = text.split(/(?<=[.؟!])\s+|\n+/).map(x => x.trim()).filter(Boolean);
    const hit = parts.filter(p => /(نزلت|نزلَت|أنزل الله|فأنزل|نزل في|سبب نزول|سبب النزول)/.test(p));
    return hit.length ? hit.join(' ') : '';
}

// سبب النزول: يُطلب من المحقَّق الحديث أوّلاً (المختصر ثم الميسر ثم السعدي)، فإن لم
// يذكروه فمن «الوجيز» للواحدي، مع التنبيه إلى أنّه من التفاسير المتقدّمة
export const NUZUL_ORDER = ['mukhtasar', 'muyassar', 'saadi', 'wajiz'];
export async function nuzulFor(key) {
    for (const b of NUZUL_ORDER) {
        let t = '';
        try { t = await ayahText(b, key); } catch (e) { continue; }
        const n = nuzulOf(t);
        if (n) return { book: b, text: n };
    }
    return null;
}
