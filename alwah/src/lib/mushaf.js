// ════════════════════════════════════════════════════════════════════════════
//  المصحف: نصّ مصحف المدينة كلمةً كلمة وسطراً سطراً، بخطّ صفحته نفسه
//  ─────────────────────────────────────────────────────────────────────────
//  الكلمات ومواضعها من واجهة quran.com (مفتوحة، تسمح بالطلب من المتصفح)، والخطّ
//  خطّ مجمع الملك فهد لكل صفحة (QCF v1): كل كلمةٍ رمزٌ في خطّ صفحتها، فتُرسم
//  الصفحة كما في المصحف المطبوع تماماً. تُحفظ الصفحة بعد أوّل تحميل فتفتح بلا شبكة.
// ════════════════════════════════════════════════════════════════════════════
import { SURAHS } from './quran';

const API = 'https://api.quran.com/api/v4/verses/by_page/';
const FONT = p => `https://static.qurancdn.com/fonts/quran/hafs/v1/woff2/p${p}.woff2`;
const CK = p => 'alwah_pg_v1_' + p;
const mem = new Map();
const fonts = new Map();

export const fontName = p => 'QCF_P' + String(p).padStart(3, '0');

// خطّ الصفحة: يُحمَّل مرّةً ويُعاد استعماله
export function loadFont(p) {
    if (fonts.has(p)) return fonts.get(p);
    const pr = (async () => {
        const f = new FontFace(fontName(p), `url(${FONT(p)}) format('woff2')`, { display: 'block' });
        await f.load();
        document.fonts.add(f);
        return true;
    })().catch(e => { fonts.delete(p); throw e; });
    fonts.set(p, pr);
    return pr;
}

// الصفحة مختصرة: الأسطر (١–١٥)، وفي كل سطرٍ كلماته، وسطور رؤوس السور والبسملة
export async function loadPage(p) {
    if (mem.has(p)) return mem.get(p);
    try {
        const c = localStorage.getItem(CK(p));
        if (c) { const v = JSON.parse(c); mem.set(p, v); return v; }
    } catch (e) { /* لا تخزين */ }

    let verses = [], page = 1;
    for (;;) {
        const url = `${API}${p}?words=true&word_fields=text_uthmani,code_v1,line_number&per_page=50&page=${page}&mushaf=1`;
        const r = await fetch(url);
        if (!r.ok) throw new Error('تعذّر تحميل الصفحة');
        const j = await r.json();
        verses = verses.concat(j.verses || []);
        if (!j.pagination || !j.pagination.next_page) break;
        page = j.pagination.next_page;
    }

    const lines = {};
    let firstSurahLine = {};                  // سورةٌ تبدأ في هذه الصفحة: سطر أوّل كلماتها
    let lastSurah = 0;
    for (const v of verses) {
        const [s, a] = v.verse_key.split(':').map(Number);
        lastSurah = s;
        for (const w of v.words) {
            const L = w.line_number;
            (lines[L] = lines[L] || []).push({
                k: `${s}:${a}:${w.position}`, c: w.code_v1, t: w.text_uthmani,
                end: w.char_type_name === 'end',
            });
            if (a === 1 && w.position === 1 && firstSurahLine[s] === undefined) firstSurahLine[s] = L;
        }
    }
    // رؤوس السور: السطران قبل أوّل آية (اسم السورة ثم البسملة، إلا الفاتحة والتوبة)
    const heads = {};
    Object.entries(firstSurahLine).forEach(([s, L]) => {
        s = +s;
        if (s === 1) { if (L > 1) heads[L - 1] = { type: 'name', s }; return; }
        if (s === 9) { if (L > 1) heads[L - 1] = { type: 'name', s }; return; }
        if (L > 2) { heads[L - 2] = { type: 'name', s }; heads[L - 1] = { type: 'bism' }; }
        else if (L === 2) heads[1] = { type: 'bism', s };
    });
    // سطورٌ فارغة في ذيل الصفحة: رأس السورة التالية يبدأ هنا
    const used = Object.keys(lines).map(Number);
    const maxL = used.length ? Math.max(...used) : 0;
    if (maxL && maxL < 15 && p !== 1 && p !== 2 && lastSurah < 114) {
        const next = lastSurah + 1;
        heads[maxL + 1] = { type: 'name', s: next };
        if (maxL + 2 <= 15 && next !== 9) heads[maxL + 2] = { type: 'bism' };
    }
    const out = { p, lines, heads, short: p <= 2 };
    mem.set(p, out);
    try { localStorage.setItem(CK(p), JSON.stringify(out)); } catch (e) { /* ممتلئ */ }
    return out;
}

export const surahName = s => (SURAHS[s - 1] ? SURAHS[s - 1][0] : '');

// تحميلٌ مسبق للصفحتين المجاورتين: التقليب يصير فورياً
export function prefetch(p) {
    [p - 1, p + 1].forEach(q => { if (q >= 1 && q <= 604) { loadPage(q).catch(() => {}); loadFont(q).catch(() => {}); } });
}

// ─── علامات المصحف: بدايات الأرباع والأحزاب والأجزاء، ومواضع السجدات ─────────
// كما في طبعة مصحف المدينة، لكل صفحة ما فيها من علامات على أسطرها
let marksAll = null;
export async function pageMarks(p) {
    if (!marksAll) {
        marksAll = (async () => {
            try { const c = localStorage.getItem('alwah_marks_v1'); if (c) return JSON.parse(c); } catch (e) { /* لا تخزين */ }
            const r = await fetch('./marks.json');
            if (!r.ok) return {};
            const j = await r.json();
            try { localStorage.setItem('alwah_marks_v1', JSON.stringify(j)); } catch (e) { /* تجاهل */ }
            return j;
        })().catch(() => ({}));
    }
    const all = await marksAll;
    return all[p] || null;
}
// موضع الصفحة: الجزء والحزب والربع (من آخر علامةٍ قبلها أو فيها)
export async function pagePlace(p) {
    const all = await (marksAll || pageMarks(p).then(() => marksAll));
    let best = null;
    for (let q = p; q >= 1; q--) {
        const x = all && all[q];
        if (x && x.m && x.m.length) { best = x.m[q === p ? 0 : x.m.length - 1]; break; }
    }
    if (!best) return null;
    const quarter = ((best.rub - 1) % 4);
    return { juz: best.juz, hizb: best.hizb, rub: best.rub, quarter, label: ['أوّل الحزب', 'ربع الحزب', 'نصف الحزب', 'ثلاثة أرباع الحزب'][quarter] };
}

// فهرس الأجزاء والأحزاب: لكل حزبٍ صفحته وجزؤه (من العلامات نفسها)
export async function hizbIndex() {
    await pageMarks(1);
    const all = await marksAll;
    const out = [];
    for (const [p, x] of Object.entries(all || {})) {
        (x.m || []).forEach(m => { if ((m.rub - 1) % 4 === 0) out.push({ hizb: m.hizb, juz: m.juz, page: +p, k: m.k }); });
    }
    return out.sort((a, b) => a.page - b.page);
}
