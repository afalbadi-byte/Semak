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

// مسافة تحرير كاملة: التعرّف على صوت الجوال يبدّل حرفاً أو حرفين في الكلمة
// (الرحيم ← الرجيم)، فنسامح بقدر طول الكلمة: حرفٌ في الرباعية، وحرفان في
// السداسية وما فوقها، ولا مسامحة في القصيرة فهي تُلبِس غيرها.
function dist(a, b, cap) {
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > cap) return cap + 1;
    let prev = new Uint8Array(lb + 1), cur = new Uint8Array(lb + 1);
    for (let j = 0; j <= lb; j++) prev[j] = j;
    for (let i = 1; i <= la; i++) {
        cur[0] = i;
        let best = cur[0];
        for (let j = 1; j <= lb; j++) {
            cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            if (cur[j] < best) best = cur[j];
        }
        if (best > cap) return cap + 1;
        const t = prev; prev = cur; cur = t;
    }
    return prev[lb];
}

function near(a, b) {
    if (a === b) return true;
    const len = Math.max(a.length, b.length);
    const cap = len >= 6 ? 2 : len >= 4 ? 1 : 0;
    if (!cap) return false;
    return dist(a, b, cap) <= cap;
}

// ─── محرّك المتابعة ─────────────────────────────────────────────────────────
// المطابقة بمحاذاةٍ مرنة لا بموضعٍ مقفل: نأخذ ما سمعناه ونبحث عن أطول تتابعٍ
// يوافق النصّ المنتظر في نافذةٍ أمامه. فما ليس من الآية — استعاذةٌ أو بسملةٌ
// أو ضجيج — يسقط من تلقاء نفسه، ولا يُحسب خطأً ولا يوقف القارئ.
const WINDOW = 40;

// أطول تتابعٍ مشترك: يرجع مواضع المطابقة في النصّ المنتظر
function align(heard, want) {
    const n = heard.length, m = want.length;
    const dp = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
    for (let i = n - 1; i >= 0; i--)
        for (let j = m - 1; j >= 0; j--)
            dp[i][j] = (heard[i] === want[j] || near(heard[i], want[j]))
                ? dp[i + 1][j + 1] + 1
                : Math.max(dp[i + 1][j], dp[i][j + 1]);
    const hit = [];
    let i = 0, j = 0;
    while (i < n && j < m) {
        if (heard[i] === want[j] || near(heard[i], want[j])) { hit.push(j); i++; j++; }
        else if (dp[i + 1][j] >= dp[i][j + 1]) i++;
        else j++;
    }
    return hit;
}

export function tracker(expected) {
    // expected: [{ k: 'سورة:آية', items: [{ t: 'الكلمة', wk: 'سورة:آية:موضع', line }] }]
    const flat = [];
    expected.forEach((a, ai) => a.items.forEach((w, wi) => flat.push({ n: norm(w.t), raw: w.t, wk: w.wk, line: w.line, ai, wi, k: a.k })));
    let pos = 0;
    let miss = 0;

    return {
        get pos() { return pos; },
        get total() { return flat.length; },
        get done() { return pos >= flat.length; },
        at: i => flat[i],
        current() { return flat[pos] ? flat[pos].k : null; },
        reset(i) { pos = Math.max(0, Math.min(flat.length, i)); miss = 0; },

        feed(text) {
            const heard = words(text);
            if (!heard.length || pos >= flat.length) return { advanced: 0, error: null, matched: 0, heard: heard.length };
            const win = flat.slice(pos, pos + WINDOW).map(x => x.n);
            const hit = align(heard, win);
            // تتابعٌ من كلمتين فأكثر يُعدّ قراءةً للنصّ، وما دونه لا يُبنى عليه
            if (hit.length >= 2) {
                const last = hit[hit.length - 1];
                const skipped = (last + 1) - hit.length;         // كلماتٌ في النصّ لم تُسمع
                pos += last + 1;
                miss = 0;
                return { advanced: last + 1, matched: hit.length, skipped, error: null, heard: heard.length };
            }
            // المقاطع متراكبة، فقد يكون كلّ ما في المقطع كلماتٍ قرأها قبل قليل:
            // إعادةٌ لا خطأ، فلا تُحسب تعثّراً
            const back = flat.slice(Math.max(0, pos - 10), pos).map(x => x.n);
            if (heard.some(h => back.some(b => b === h || near(b, h))))
                return { advanced: 0, matched: hit.length, error: null, repeat: true, heard: heard.length };

            // لا تتابع ولا إعادة: نتربّص ثلاثة مقاطع قبل أن نحكم بالخطأ، فالتعرّف
            // يشوّه كلمةً أو كلمتين أحياناً ولا يصحّ أن نوقف القارئ لذلك
            miss++;
            const error = miss >= 3 ? { expected: flat[pos], heard: heard.join(' ') } : null;
            if (error) miss = 0;
            return { advanced: 0, matched: hit.length, error, stuck: !!error, heard: heard.length };
        },

        ayahDone() {
            const done = new Set();
            for (let i = 0; i < pos; i++) {
                const w = flat[i];
                if (i + 1 >= flat.length || flat[i + 1].ai !== w.ai) done.add(w.k);
            }
            return done;
        },
    };
}
