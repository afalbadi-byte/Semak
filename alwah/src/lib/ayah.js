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

// المقاطع المقترحة لجزءٍ من الورد: ما حدّده المشرف، وإلا ما حسبه الخادم بالسور والآيات
export async function partRange(plan, part) {
    if (!plan) return null;
    const own = plan.ranges && segsOf(plan.ranges[part]);
    if (own) return own;
    const auto = plan.auto && segsOf(plan.auto[part]);
    if (auto) return auto;
    const r = await rangeOfPages(part === 'alwah' ? plan.alwah : part === 'rev' ? plan.review : plan.new ? [plan.new.page] : []);
    return r ? [r] : null;
}

// ─── المقاطع المتعدّدة: الجزء من الورد قد يكون مقاطع من سورٍ مختلفة ────────────
// صيغة المقطع [من، إلى]، والجزء قائمة مقاطع مرتّبة من جهة البقرة إلى جهة الناس
export const segsOf = x => (!x || !x.length ? null : typeof x[0] === 'string' ? [x] : x);
export const segsAyahs = segs => (segs || []).flatMap(([a, b]) => between(a, b));
export async function segsPages(segs) {
    const set = new Set();
    for (const [a, b] of segs || []) (await pagesOf(a, b)).forEach(p => set.add(p));
    return [...set].sort((x, y) => x - y);
}
export async function segsLines(segs) {
    let n = 0;
    for (const [a, b] of segs || []) n += await linesOf(a, b);
    return n;
}
// مقطع الحفظ الجديد من آيةٍ إلى آية بترتيب الحفظ: لمن يحفظ من الناس صعوداً، بعد
// آخر السورة تأتي السورة التي قبلها من أوّلها (الجاثية ثم الدخان…)
export function memSegs(dir, from, to) {
    const f = parse(from), t = parse(to);
    if (dir === 'asc' || f.s === t.s) return cmp(from, to) <= 0 ? [[from, to]] : [[from, from]];
    if (t.s > f.s) return [[from, from]];
    const o = [[from, key(f.s, AYAT[f.s - 1])]];
    for (let s = f.s - 1; s > t.s; s--) o.push([key(s, 1), key(s, AYAT[s - 1])]);
    o.push([key(t.s, 1), to]);
    return o.sort((x, y) => cmp(x[0], y[0]));
}

// بداية مقطع الحفظ ونهايته بترتيب الحفظ (من الناس صعوداً: السورة الأعلى رقماً أوّلاً)
export function memEnds(dir, segs) {
    if (!segs || !segs.length) return [null, null];
    if (dir === 'asc') return [segs[0][0], segs[segs.length - 1][1]];
    const sn = k => +String(k).split(':')[0];
    const hi = segs.reduce((a, b) => (sn(b[0]) > sn(a[0]) ? b : a)), lo = segs.reduce((a, b) => (sn(b[0]) < sn(a[0]) ? b : a));
    return [hi[0], lo[1]];
}

// ─── الجزء من الورد مقطعاً واحداً «من سورة كذا آية كذا إلى سورة كذا آية كذا» ─────────
// من أوّل آيةٍ من جهة البقرة إلى آخر آيةٍ من جهة الناس. وما لم يُعدَّل يبقى محتواه
// الدقيق كما حُسب (المحفوظ فقط)، وإن عُدِّل صار ما بين الآيتين.
export function oneRange(segs) {
    const s = segsOf(segs);
    if (!s) return null;
    let a = s[0][0], b = s[0][1];
    s.forEach(([x, y]) => { if (cmp(x, a) < 0) a = x; if (cmp(y, b) > 0) b = y; });
    return [a, b];
}
// المقاطع الفعلية لنطاقٍ واحد: الأصلية إن لم يتغيّر، وإلا ما بين الآيتين
export const segsFor = (one, orig) => {
    const o = oneRange(orig);
    return o && one && o[0] === one[0] && o[1] === one[1] ? segsOf(orig) : one ? [one] : null;
};
