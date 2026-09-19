// ════════════════════════════════════════════════════════════════════════════
//  الآيات: السورة ورقم الآية وأوّل كلماتها وصفحتها
//  ─────────────────────────────────────────────────────────────────────────
//  المقاطع (للتكرار والتسميع وتعديل الورد) تُحدَّد بآية البداية وآية النهاية،
//  وتُعرض بالسورة ورقم الآية وأوّل أربع كلمات منها. بيانات كل سورة (نصّ أوّل الآية
//  وصفحتها) من واجهة quran.com بطلبٍ واحد، وتُحفظ على الجهاز بعد أوّل مرّة.
// ════════════════════════════════════════════════════════════════════════════
import { SURAHS } from './quran';
import { loadPage } from './mushaf';

// عدد آيات كل سورة (حفص)
export const AYAT = [7, 286, 200, 176, 120, 165, 206, 75, 129, 109, 123, 111, 43, 52, 99, 128, 111, 110, 98, 135,
    112, 78, 118, 64, 77, 227, 93, 88, 69, 60, 34, 30, 73, 54, 45, 83, 182, 88, 75, 85, 54, 53, 89, 59, 37, 35, 38,
    29, 18, 45, 60, 49, 62, 55, 78, 96, 29, 22, 24, 13, 14, 11, 11, 18, 12, 12, 30, 52, 52, 44, 28, 28, 20, 56, 40,
    31, 50, 40, 46, 42, 29, 19, 36, 25, 22, 17, 19, 26, 30, 20, 15, 21, 11, 8, 8, 19, 5, 8, 8, 11, 11, 8, 3, 9, 5,
    4, 7, 3, 6, 3, 5, 4, 5, 6];

export const key = (s, a) => s + ':' + a;
export const parse = k => { const [s, a] = String(k).split(':').map(Number); return { s, a }; };
export const cmp = (x, y) => { const p = parse(x), q = parse(y); return p.s - q.s || p.a - q.a; };
export const surahName = s => (SURAHS[s - 1] ? SURAHS[s - 1][0] : '');
export const ayahName = k => { const { s, a } = parse(k); return surahName(s) + ' ' + a; };

const CK = s => 'alwah_ch_v1_' + s;
const mem = new Map();

// بيانات السورة: لكل آيةٍ صفحتها وأوّل أربع كلمات منها
export function chapter(s) {
    if (mem.has(s)) return mem.get(s);
    const pr = (async () => {
        try { const c = localStorage.getItem(CK(s)); if (c) return JSON.parse(c); } catch (e) { /* لا تخزين */ }
        const r = await fetch(`https://api.quran.com/api/v4/verses/by_chapter/${s}?fields=text_uthmani&per_page=300&page=1`);
        if (!r.ok) throw new Error('تعذّر تحميل السورة');
        const j = await r.json();
        const v = (j.verses || []).map(x => ({ p: x.page_number, t: first4(x.text_uthmani) }));
        try { localStorage.setItem(CK(s), JSON.stringify(v)); } catch (e) { /* تجاهل */ }
        return v;
    })().catch(e => { mem.delete(s); throw e; });
    mem.set(s, pr);
    return pr;
}

// أوّل أربع كلمات (بلا علامات الوقف المنفردة)
export function first4(t) {
    return String(t || '').split(/\s+/).filter(w => w && !/^[ۖ-ۭؕ-ؚ]+$/.test(w)).slice(0, 4).join(' ');
}

export async function ayahInfo(k) {
    const { s, a } = parse(k);
    const c = await chapter(s);
    return c[a - 1] || null;
}
export const ayahPage = async k => { const i = await ayahInfo(k); return i ? i.p : null; };

// الآيات من آيةٍ إلى آية (عبر السور)
export function between(from, to) {
    if (cmp(from, to) > 0) [from, to] = [to, from];
    const f = parse(from), t = parse(to), out = [];
    for (let s = f.s; s <= t.s; s++) {
        const a0 = s === f.s ? f.a : 1, a1 = s === t.s ? t.a : AYAT[s - 1];
        for (let a = a0; a <= a1; a++) out.push(key(s, a));
        if (out.length > 7000) break;
    }
    return out;
}

// الصفحات التي يغطيها المقطع
export async function pagesOf(from, to) {
    if (cmp(from, to) > 0) [from, to] = [to, from];
    const [p0, p1] = await Promise.all([ayahPage(from), ayahPage(to)]);
    const o = [];
    if (p0 && p1) for (let p = p0; p <= p1; p++) o.push(p);
    return o;
}

// آيات الصفحة بالترتيب
export async function pageAyahs(p) {
    const d = await loadPage(p);
    const out = [];
    for (let i = 1; i <= 15; i++) (d.lines[i] || []).forEach(w => { const k = w.k.slice(0, w.k.lastIndexOf(':')); if (out[out.length - 1] !== k) out.push(k); });
    return out;
}

// مقطع صفحاتٍ متتالية: من أوّل آيةٍ في أوّلها إلى آخر آيةٍ في آخرها
export async function rangeOfPages(pages) {
    if (!pages || !pages.length) return null;
    const s = [...pages].sort((a, b) => a - b);
    let end = s[0];
    for (let i = 1; i < s.length && s[i] === end + 1; i++) end = s[i];
    const [a, b] = await Promise.all([pageAyahs(s[0]), pageAyahs(end)]);
    return a.length && b.length ? [a[0], b[b.length - 1]] : null;
}

// أوّل آيةٍ تبدأ من سطرٍ معيّن في صفحة (بداية حفظ اليوم)
export async function ayahAtLine(p, line) {
    const d = await loadPage(p);
    for (let i = Math.max(1, line); i <= 15; i++) {
        const ws = (d.lines[i] || []).filter(w => !w.end);
        if (ws.length) return ws[0].k.slice(0, ws[0].k.lastIndexOf(':'));
    }
    return null;
}

// عدد الأسطر التي يشغلها المقطع (لتحويل «إلى آية» في الحفظ الجديد إلى أسطر)
export async function linesOf(from, to) {
    const pages = await pagesOf(from, to);
    if (!pages.length) return 0;
    const set = new Set(between(from, to));
    let n = 0;
    for (const p of pages) {
        const d = await loadPage(p);
        for (let i = 1; i <= 15; i++) if ((d.lines[i] || []).some(w => set.has(w.k.slice(0, w.k.lastIndexOf(':'))))) n++;
    }
    return n;
}

// «الملك ١ · تبارك الذي بيده الملك»
export async function label(k) {
    const i = await ayahInfo(k).catch(() => null);
    return ayahName(k) + (i && i.t ? ' · ' + i.t : '');
}

// مقطع حفظ اليوم من أسطره: من أوّل آيةٍ في سطر البداية إلى آخر آيةٍ في سطر النهاية
export async function newRange(plan) {
    if (!plan || !plan.new) return null;
    const d = await loadPage(plan.new.page), f0 = plan.new.from_line, f1 = Math.min(15, f0 + plan.new.lines - 1);
    let a = null, b = null;
    for (let i = f0; i <= 15; i++) (d.lines[i] || []).forEach(w => { if (w.end) return; const k = w.k.slice(0, w.k.lastIndexOf(':')); if (!a) a = k; if (i <= f1 || !b) b = k; });
    return a ? [a, b] : rangeOfPages([plan.new.page]);
}

// المقطع المقترح لجزءٍ من الورد: ما حدّده المشرف، وإلا المحسوب من الصفحات
export async function partRange(plan, part) {
    if (!plan) return null;
    if (plan.ranges && plan.ranges[part]) return plan.ranges[part];
    if (part === 'new') return newRange(plan);
    return rangeOfPages(part === 'alwah' ? plan.alwah : plan.review);
}
