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

// لا تسامح: الكلمة تُطابَق حرفاً بحرف بعد إسقاط التشكيل والرسم فقط. وما
// يخطئ فيه التعرّف لا يُمرَّر هنا، بل يُراجَع برأيٍ ثانٍ قبل الحكم بالخطأ.
function near(a, b) {
    return a === b;
}

// ─── محرّك المتابعة ─────────────────────────────────────────────────────────
// مطابقةٌ كلمةً بكلمة على الترتيب: لا نتقدّم إلا إلى الكلمة التي تلي، فلا
// يمكن تخطّي آيةٍ ولا القفز إلى آخر الصفحة. وما ليس من النصّ — استعاذةٌ أو
// ضجيجٌ أو إعادةٌ لما قُرئ — يُطرح ولا يُحسب خطأً ولا تقدّماً.

// ما يُقال قبل الشروع في التلاوة فلا يُحاسَب عليه
const PRELUDE = new Set(['اعوذ', 'بالله', 'من', 'الشيطان', 'الرجيم', 'بسم', 'الله', 'الرحمن', 'الرحيم']);

// حرفٌ يتكرّر ثلاثاً متتابعة لا يقع في كلامٍ عربيّ: هو صرير ميكروفونٍ أو نفَس
const NOISE = /(.)\1\1/;

// التعرّف على الصوت الخافت يدخل في دورةٍ فيكرّر الكلمة مراراً: «الناس الناس
// الناس…». هذا هذيانٌ لا تلاوة، فيُطرح المقطع كلّه ولا يُحسب خطأً.
function babble(ws) {
    if (ws.length < 4) return false;
    return new Set(ws).size * 3 <= ws.length;
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
            if (babble(heard)) return { advanced: 0, matched: 0, error: null, babble: true, heard: heard.length };

            const back = flat.slice(Math.max(0, pos - 8), pos).map(x => x.n);   // ما قُرئ قريباً
            const isRepeat = h => back.some(b => b === h || near(b, h));
            let matched = 0, stray = 0, lastWrong = '';

            for (const h of heard) {
                if (pos >= flat.length) break;
                const want = flat[pos].n;
                if (h === want || near(h, want)) { pos++; matched++; continue; }
                // كلمتان في النصّ نطقهما التعرّف موصولتين: «الحمدلله»
                const two = flat[pos + 1] ? want + flat[pos + 1].n : '';
                if (two && h === two) { pos += 2; matched += 2; continue; }
                if (isRepeat(h)) continue;                       // إعادةٌ من تراكب المقاطع
                if (h.length <= 2) continue;                     // حرفٌ أو حرفان: ضجيج
                if (NOISE.test(h)) continue;                     // «صططططط»: ضجيجٌ فسّره التعرّف حروفاً مكرّرة
                if (!matched && PRELUDE.has(h)) continue;        // استعاذةٌ أو بسملةٌ قبل الشروع
                stray++; lastWrong = h;
                break;                                           // لا نتجاوز الكلمة المنتظرة
            }

            if (matched) { miss = 0; return { advanced: matched, matched, error: null, heard: heard.length }; }
            if (!stray) return { advanced: 0, matched: 0, error: null, repeat: true, heard: heard.length };

            // كلامٌ لا يوافق الكلمة المنتظرة: نتربّص مقطعين — التعرّف يشوّه
            // كلمةً أحياناً — ثم نحكم بالخطأ ونقف عندها حتى تُقرأ
            miss++;
            const error = miss >= 2 ? { expected: flat[pos], heard: lastWrong || heard.join(' ') } : null;
            if (error) miss = 0;
            return { advanced: 0, matched: 0, error, stuck: !!error, heard: heard.length };
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
