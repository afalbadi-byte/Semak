// ════════════════════════════════════════════════════════════════════════════
//  التفسير وسبب النزول: نصوصٌ منشورة بأسمائها، لا اجتهاد من التطبيق
//  ─────────────────────────────────────────────────────────────────────────
//  الكتب الثلاثة معتمدةٌ ومحقَّقة: المختصر (مركز تفسير)، والميسر (مجمع الملك فهد)،
//  والسعدي. وتُجلب النصوص من مكتبة tafsir_api، وتُجلب
//  للآية وحدها وتُحفظ على الجهاز بعد أوّل مرّة. وكل نصٍّ يُعرض باسم كتابه ومؤلّفه.
// ════════════════════════════════════════════════════════════════════════════
const CDN = 'https://cdn.jsdelivr.net/gh/spa5k/tafsir_api@main/tafsir/';

export const BOOKS = {
    mukhtasar: { slug: 'ar-tafsir-al-mukhtasar', name: 'المختصر في التفسير', by: 'مركز تفسير للدراسات القرآنية' },
    muyassar: { slug: 'ar-tafsir-muyassar', name: 'التفسير الميسر', by: 'مجمع الملك فهد لطباعة المصحف' },
    saadi: { slug: 'ar-tafsir-as-saadi', name: 'تيسير الكريم الرحمن', by: 'عبد الرحمن السعدي' },
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

// سبب النزول: لا يُعرض إلا ما صرّح به المفسّرون في الكتب المعتمدة الثلاثة أعلاه
// (لا كتب متقدّمة فيها مرويات تحتاج تحقيقاً، ولا شيء من عند التطبيق)
export const NUZUL_ORDER = ['mukhtasar', 'muyassar', 'saadi'];
export async function nuzulFor(key) {
    for (const b of NUZUL_ORDER) {
        let t = '';
        try { t = await ayahText(b, key); } catch (e) { continue; }
        const n = nuzulOf(t);
        if (n) return { book: b, text: n };
    }
    return null;
}

// ─── أسباب النزول: «الصحيح المسند من أسباب النزول» للشيخ مقبل الوادعي ─────────
// اقتصر مؤلّفه على ما صحّ إسناده، والنصّ يُعرض كما هو بإسناده وتخريجه ورقم صفحته
// في المطبوع. البيانات ملفٌّ لكل سورة داخل التطبيق، فلا تعتمد على خدمةٍ خارجية.
export const ASBAB_BOOK = { name: 'الصحيح المسند من أسباب النزول', by: 'الشيخ مقبل بن هادي الوادعي رحمه الله' };
const suras = new Map();
export async function asbabFor(key) {
    const [s, a] = String(key).split(':');
    if (!suras.has(s)) {
        suras.set(s, (async () => {
            try {
                const c = localStorage.getItem('alwah_asbab_' + s);
                if (c !== null) return JSON.parse(c);
            } catch (e) { /* لا تخزين */ }
            const r = await fetch('./asbab/' + s + '.json');
            if (!r.ok) return {};
            const j = await r.json();
            try { localStorage.setItem('alwah_asbab_' + s, JSON.stringify(j)); } catch (e) { /* تجاهل */ }
            return j;
        })().catch(() => ({})));
    }
    const d = await suras.get(s);
    return (d && d[a]) || null;
}
