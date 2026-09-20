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
    wajiz: { slug: 'al-wajiz-wahidi', name: 'الوجيز', by: 'أبو الحسن الواحدي، صاحب «أسباب النزول»' },
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

// جُمل سبب النزول: ما ذُكر فيه النزول أو السؤال الذي نزلت فيه الآية
const CUES = /(نزلت|نزل|أنزل|فأنزل|سبب النزول|سأل|قالوا|لمّا)/;
export function nuzulOf(text) {
    if (!text) return '';
    const parts = text.split(/(?<=[.؟!])\s+|\n+/).map(x => x.trim()).filter(Boolean);
    const hit = parts.filter(p => /(نزلت|أنزل الله|فأنزل|نزل في|سبب نزول)/.test(p));
    if (hit.length) return hit.join(' ');
    return parts.filter(p => CUES.test(p)).slice(0, 2).join(' ');
}
