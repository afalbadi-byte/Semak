// ════════════════════════════════════════════════════════════════════════════
//  الأذن: تعرّفٌ على التلاوة يعمل على الجهاز نفسه
//  ─────────────────────────────────────────────────────────────────────────
//  النموذج مضبوطٌ على القرآن وحده (Tarteel، رخصة Apache) ويُشغَّل بـ
//  transformers.js داخل المتصفّح: الصوت لا يغادر الجهاز، ولا مفتاح ولا خادم،
//  ويعمل بلا إنترنت بعد أوّل تحميل لأنّ المتصفّح يخزّن النموذج.
//
//  التلاوة تُقطَّع بالسكوت: نسجّل حتى يسكت القارئ لحظةً، فنرسل المقطع للتعرّف.
//  هذا أدقّ من تقطيعٍ بالثواني، لأنّ الوقف عند رأس الآية هو الأصل في القراءة.
// ════════════════════════════════════════════════════════════════════════════
const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1';
// المشفّر بصيغةٍ كاملة والمفكّك مضغوط: الصيغة المضغوطة للمشفّر تستعمل عقدة
// ConvInteger لا يدعمها محرّك ONNX في المتصفّح، فتفشل الجلسة قبل أن تبدأ.
const MODELS = [
    { id: 'Sharjeelbaig/whisper-tiny-ar-quran-onnx', dtype: { encoder_model: 'fp32', decoder_model_merged: 'q8' } },
    { id: 'Sharjeelbaig/whisper-tiny-ar-quran-onnx', dtype: 'fp32' },
    { id: 'eventhorizon0/tarteel-ai-onnx-whisper-base-ar-quran', dtype: { encoder_model: 'fp32', decoder_model_merged: 'q8' } },
];
const SR = 16000;

let tf = null;          // مكتبة transformers.js بعد تحميلها
let asr = null;         // خطّ التعرّف بعد بنائه
let loading = null;

export const asrSupported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.AudioContext);

// تحميل المكتبة والنموذج مرّةً واحدة، مع نسبة التقدّم لواجهةٍ تطمئن المنتظر
export function loadAsr(onProgress) {
    if (asr) return Promise.resolve(asr);
    if (loading) return loading;
    loading = (async () => {
        tf = await import(/* @vite-ignore */ CDN);
        tf.env.allowLocalModels = false;
        let last = null;
        for (const m of MODELS) {
            const seen = {};
            try {
                asr = await tf.pipeline('automatic-speech-recognition', m.id, {
                    dtype: m.dtype,
                    progress_callback: p => {
                        if (!onProgress || !p || !p.file) return;
                        if (p.status === 'progress') seen[p.file] = { a: p.loaded || 0, b: p.total || 0 };
                        if (p.status === 'done') seen[p.file] = { a: 1, b: 1, done: 1 };
                        const a = Object.values(seen).reduce((s, x) => s + x.a, 0);
                        const b = Object.values(seen).reduce((s, x) => s + x.b, 0);
                        onProgress(b ? Math.min(0.99, a / b) : 0);
                    },
                });
                onProgress && onProgress(1);
                return asr;
            } catch (e) { last = e; asr = null; }      // صيغةٌ لا يدعمها الجهاز: نجرّب التي تليها
        }
        throw last || new Error('تعذّر تحميل نموذج التلاوة');
    })().catch(e => { loading = null; throw e; });
    return loading;
}

export const asrReady = () => !!asr;

// ─── الميكروفون: يلتقط، ويقطّع عند السكوت، ويسلّم المقاطع ───────────────────
export async function listen({ onChunk, onLevel, onError }) {
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const ac = new AudioContext({ sampleRate: SR });
    const src = ac.createMediaStreamSource(stream);
    const an = ac.createAnalyser(); an.fftSize = 1024;
    const proc = ac.createScriptProcessor(4096, 1, 1);
    const buf = [];                  // عيّنات المقطع الجاري
    let voiced = 0, silence = 0, busy = false, dead = false;

    const flush = async () => {
        const n = buf.reduce((s, x) => s + x.length, 0);
        if (n < SR * 0.6) { buf.length = 0; voiced = 0; return; }     // أقصر من أن تكون تلاوة
        const pcm = new Float32Array(n);
        let o = 0; for (const b of buf) { pcm.set(b, o); o += b.length; }
        buf.length = 0; voiced = 0;
        if (busy) return;                                             // لا نُزاحم تعرّفاً جارياً
        busy = true;
        try { const r = await asr(pcm, { language: 'ar', task: 'transcribe', chunk_length_s: 30 }); if (!dead) onChunk((r && r.text || '').trim()); }
        catch (e) { onError && onError(e); }
        busy = false;
    };

    proc.onaudioprocess = e => {
        if (dead) return;
        const x = e.inputBuffer.getChannelData(0);
        let peak = 0; for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); if (v > peak) peak = v; }
        onLevel && onLevel(peak);
        const speaking = peak > 0.018;
        if (speaking) { voiced += x.length; silence = 0; buf.push(new Float32Array(x)); }
        else if (voiced) {
            silence += x.length;
            buf.push(new Float32Array(x));
            if (silence > SR * 0.55) flush();                         // سكتةٌ تكفي لنهاية آية
        }
        if (voiced > SR * 12) flush();                                // لا نترك المقطع يطول
    };

    src.connect(an); an.connect(proc); proc.connect(ac.destination);
    return {
        stop() {
            dead = true;
            try { proc.disconnect(); an.disconnect(); src.disconnect(); } catch (e) { /* مغلق */ }
            try { stream.getTracks().forEach(t => t.stop()); } catch (e) { /* تجاهل */ }
            try { ac.close(); } catch (e) { /* تجاهل */ }
        },
    };
}
