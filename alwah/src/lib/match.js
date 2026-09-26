// ════════════════════════════════════════════════════════════════════════════
//  المقارنة: ما قرأه الحافظ مقابل نصّ المصحف
//  ─────────────────────────────────────────────────────────────────────────
//  النصّ معلومٌ سلفاً، فالمقارنة حسابيةٌ لا اجتهاد فيها: كلمةٌ بكلمة بترتيبها.
//  والتعرّف الآليّ يخطئ في الرسم لا في اللفظ غالباً (الهمزات والتاء المربوطة
//  والألف المقصورة)، فنُسوّي هذه قبل المقارنة، ونقيس ما بقي بمسافة تحرير:
//  اختلافُ حرفٍ واحد في كلمةٍ طويلة يُحتسب مقاربةً لا خطأ، وما زاد فخطأ.
// ════════════════════════════════════════════════════════════════════════════

// إسقاط التشكيل والرسم القرآني الخاص (السكون الصغير، المدّ، علامات الوقف)
const MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

export function norm(s) {
    return String(s || '')
        .replace(MARKS, '')
        .replace(/[أإآٱٲٵ]/g, 'ا')
        .replace(/[ؤئء]/g, 'ء')
        .replace(/ة/g, 'ه')
        .replace(/ى/g, 'ي')
        .replace(/[^ء-ي\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

export const words = s => norm(s).split(' ').filter(Boolean);

// مسافة تحرير محدودة: نكتفي بمعرفة «قريبة أم لا»
function near(a, b) {
    if (a === b) return true;
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    if (la < 4 || lb < 4) return false;              // الكلمات القصيرة لا تُسامَح
    let i = 0, j = 0, diff = 0;
    while (i < la && j < lb) {
        if (a[i] === b[j]) { i++; j++; continue; }
        if (++diff > 1) return false;
        if (la > lb) i++; else if (lb > la) j++; else { i++; j++; }
    }
    return diff + (la - i) + (lb - j) <= 1;
}

// ─── محرّك المتابعة ─────────────────────────────────────────────────────────
// يمسك موضع القارئ من النصّ المنتظر، ويستقبل ما سمعه المتعرِّف مقطعاً مقطعاً.
// يرجع لكل مقطع: كم كلمةً تقدّم، وأين وقع الخطأ إن وقع.
export function tracker(expected) {
    // expected: [{ k: 'سورة:آية', items: [{ t: 'الكلمة', wk: 'سورة:آية:موضع', line }] }]
    const flat = [];
    expected.forEach((a, ai) => a.items.forEach((w, wi) => flat.push({ n: norm(w.t), raw: w.t, wk: w.wk, line: w.line, ai, wi, k: a.k })));
    let pos = 0;                                     // أوّل كلمةٍ لم تُقرأ بعد
    let miss = 0;                                    // محاولاتٌ متتالية بلا تقدّم

    return {
        get pos() { return pos; },
        get total() { return flat.length; },
        get done() { return pos >= flat.length; },
        at: i => flat[i],
        // موضع القارئ بالآيات: الآية الجارية وما اكتمل منها
        ayahDone() {
            const done = new Set();
            for (let i = 0; i < pos; i++) {
                const w = flat[i];
                if (i + 1 >= flat.length || flat[i + 1].ai !== w.ai) done.add(w.k);
            }
            return done;
        },
        current() { return flat[pos] ? flat[pos].k : null; },
        reset(i) { pos = Math.max(0, Math.min(flat.length, i)); miss = 0; },

        // يبتلع مقطعاً مسموعاً ويحاول مطابقته من الموضع الحالي
        feed(text) {
            const heard = words(text);
            if (!heard.length) return { advanced: 0, error: null };
            let i = 0, adv = 0, error = null;
            while (i < heard.length && pos < flat.length) {
                const h = heard[i], e = flat[pos].n;
                if (h === e || near(h, e)) { pos++; adv++; i++; continue; }
                // ربما ابتلع المتعرّف كلمةً قصيرة (واو أو «من»)، فننظر التالية
                if (flat[pos + 1] && (flat[pos + 1].n === h || near(flat[pos + 1].n, h)) && e.length <= 3) {
                    pos += 2; adv += 2; i++; continue;
                }
                // أو سمع كلمةً زائدة (تكرار القارئ أو ضجيج): نتخطّاها مرّة
                if (flat[pos] && i + 1 < heard.length && (heard[i + 1] === e || near(heard[i + 1], e))) { i++; continue; }
                error = { expected: flat[pos], heard: h };
                break;
            }
            if (adv) miss = 0; else if (error) miss++;
            return { advanced: adv, error, stuck: miss >= 2 };
        },
    };
}
