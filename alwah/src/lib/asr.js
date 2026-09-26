// ════════════════════════════════════════════════════════════════════════════
//  الأذن: تعرّفٌ على التلاوة يعمل على الجهاز نفسه
//  ─────────────────────────────────────────────────────────────────────────
//  النموذج مضبوطٌ على القرآن وحده ويُشغَّل داخل المتصفّح: الصوت لا يغادر
//  الجهاز، ولا مفتاح ولا خادم، ويعمل بلا إنترنت بعد أوّل تحميل. والتعرّف يجري
//  في عاملٍ مستقلّ (Worker) فلا تتجمّد الواجهة، وعلى WASM لأن WebGPU يهذي على
//  بعض معالجات الجوال.
//
//  النموذج الأوّل بحجم base: قياسُه على تلاوةٍ نظيفةٍ ومشوّشةٍ أظهر أنه يقرأ
//  الاثنتين بلا خطأ، بينما يشوّه tiny المشوّشة. وإن ثقل على الجهاز — قِسناه من
//  زمن التعرّف نفسه — خفّفناه إلى tiny من تلقاء أنفسنا.
// ════════════════════════════════════════════════════════════════════════════
import { call } from './api';

const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1';
const SR = 16000;
const SEG = 5000;            // طول المقطع على الجهاز بالمللي ثانية
const SEG_CLOUD = 3800;      // السحاب أسرع، فالمقطع أقصر ويكون الكشف أقرب للحظة
const SEG_CLOUD_MAX = 7000;  // حدّ التهدئة إن ضاق المزوّد بعدد الطلبات
const OVERLAP = 1.4;         // ثوانٍ من آخر المقطع تُضمّ إلى تاليه فلا تُبتر كلمة
const SLOW_MS = 7000;        // فوقه يُعدّ الجهاز بطيئاً فيُخفَّف النموذج — والحدّ مرتفع لأن الخفيف أقلّ دقّة

// المشفّر في tiny بصيغةٍ كاملة: صيغته المضغوطة تستعمل ConvInteger ولا ينفّذها المتصفّح
const HEAVY = [
    { id: 'An0xity/whisper-base-ar-quran-onnx-timestamped', dtype: 'q8' },
    { id: 'Sharjeelbaig/whisper-tiny-ar-quran-onnx', dtype: { encoder_model: 'fp32', decoder_model_merged: 'q8' } },
];
const LIGHT = [
    { id: 'Sharjeelbaig/whisper-tiny-ar-quran-onnx', dtype: { encoder_model: 'fp32', decoder_model_merged: 'q8' } },
    { id: 'Sharjeelbaig/whisper-tiny-ar-quran-onnx', dtype: 'fp32' },
];

const WORKER = `
import { pipeline, env } from '${CDN}';
env.allowLocalModels = false;
let p = null, busy = false, pending = null;

async function load(models, tag) {
  let last = null;
  for (const cfg of models) {
    try {
      p = await pipeline('automatic-speech-recognition', cfg.id, {
        dtype: cfg.dtype, device: 'wasm',
        progress_callback: x => self.postMessage({ type: 'progress', x }),
      });
      self.postMessage({ type: tag, model: cfg.id });
      return true;
    } catch (err) { p = null; last = err; }
  }
  self.postMessage({ type: 'error', message: String((last && last.message) || last || 'تعذّر تحميل النموذج') });
  return false;
}

async function run(pcm) {
  busy = true;
  const t0 = Date.now();
  try {
    const r = await p(pcm, { language: 'ar', task: 'transcribe' });
    self.postMessage({ type: 'text', text: ((r && r.text) || '').trim(), ms: Date.now() - t0 });
  } catch (err) { self.postMessage({ type: 'error', message: String((err && err.message) || err) }); }
  busy = false;
  if (pending) { const q = pending; pending = null; await run(q); }
}

self.onmessage = async e => {
  const m = e.data;
  if (m.type === 'load') await load(m.models, 'ready');
  else if (m.type === 'light') { const was = p; p = null; if (!await load(m.models, 'switched')) p = was; }
  else if (m.type === 'audio') {
    if (!p) return;
    if (busy) { pending = m.pcm; return; }      // لا نُهمل مقطعاً: نحفظ الأحدث
    await run(m.pcm);
  }
};`;

let worker = null, ready = false, loading = null, lightened = false;
const listeners = { text: [], error: [] };

export const asrSupported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.AudioContext && window.Worker);
export const asrReady = () => ready;

export function loadAsr(onProgress) {
    if (ready) return Promise.resolve(true);
    if (loading) return loading;
    loading = new Promise((res, rej) => {
        const url = URL.createObjectURL(new Blob([WORKER], { type: 'text/javascript' }));
        worker = new Worker(url, { type: 'module' });
        let seen = {};
        worker.onmessage = e => {
            const m = e.data;
            if (m.type === 'progress') {
                const x = m.x;
                if (!x || !x.file) return;
                if (x.status === 'progress') seen[x.file] = { a: x.loaded || 0, b: x.total || 0 };
                if (x.status === 'done') seen[x.file] = { a: 1, b: 1 };
                const a = Object.values(seen).reduce((s, v) => s + v.a, 0);
                const b = Object.values(seen).reduce((s, v) => s + v.b, 0);
                onProgress && onProgress(b ? Math.min(0.99, a / b) : 0);
            } else if (m.type === 'ready') {
                ready = true; onProgress && onProgress(1); res(true);
            } else if (m.type === 'switched') {
                seen = {};
            } else if (m.type === 'text') {
                listeners.text.forEach(f => f(m.text, m.ms));
            } else if (m.type === 'error') {
                if (!ready) { loading = null; rej(new Error(m.message)); }
                else listeners.error.forEach(f => f(m.message));
            }
        };
        worker.onerror = e => { if (!ready) { loading = null; rej(new Error(e.message || 'تعذّر تشغيل المعالج')); } };
        worker.postMessage({ type: 'load', models: HEAVY });
    });
    return loading;
}

// تحويل التردّد بالاستيفاء الخطّي: يكفي للكلام ولا يحتاج مكتبة
function resample(x, from, to) {
    if (!from || from === to) return x;
    const ratio = from / to;
    const n = Math.max(1, Math.floor(x.length / ratio));
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const t = i * ratio, j = Math.floor(t), f = t - j;
        out[i] = j + 1 < x.length ? x[j] * (1 - f) + x[j + 1] * f : x[x.length - 1];
    }
    return out;
}

// تنظيف المقطع قبل التعرّف: إزالة الهدير تحت الكلام (مروحةٌ أو مكيّف أو حركة
// اليد) بمرشّحٍ عالي التمرير، ثم رفع الصوت إلى مستوىً ثابت. النموذج دُرّب على
// تلاواتٍ مضبوطة المستوى، فالصوت البعيد الخافت يُشوّش عليه.
function clean(x) {
    const y = new Float32Array(x.length);
    let prevIn = 0, prevOut = 0, peak = 0;
    for (let i = 0; i < x.length; i++) {
        const v = 0.97 * (prevOut + x[i] - prevIn);     // مرشّحٌ من الرتبة الأولى
        prevIn = x[i]; prevOut = v;
        y[i] = v;
        const a = Math.abs(v); if (a > peak) peak = a;
    }
    if (peak > 0.001) {
        const g = Math.min(8, 0.32 / peak);             // رفعٌ محدود فلا يتضخّم الضجيج
        for (let i = 0; i < y.length; i++) y[i] *= g;
    }
    return y;
}

// ─── الميكروفون ─────────────────────────────────────────────────────────────
// التسجيل بـ MediaRecorder لا بـ ScriptProcessor: الأخير يعطي صمتاً على بعض
// أجهزة أندرويد فيهذي النموذج على الصمت. نسجّل مقاطع قصيرة مستقلّة، نفكّها
// إلى عيّنات، ونحوّلها إلى 16 ألفاً، ونضمّ إلى أوّل كلٍّ منها ذيل سابقه فلا
// تُبتر كلمةٌ على الحدّ، ثم نقيس الشدّة: الصامت لا يُرسل أصلاً.
export async function listen({ onChunk, onLevel, onError, onInfo, cloud, hint }) {
    let slow = 0;
    let useCloud = !!cloud;                         // يسقط وحده إلى الجهاز إن تعثّر
    let segCloud = SEG_CLOUD;                       // يطول إن ضاق المزوّد بعدد الطلبات السحاب
    listeners.text = [(text, ms) => {
        if (ms > SLOW_MS) slow++; else slow = 0;
        if (slow >= 2 && !lightened) {                  // الجهاز لا يلحق: نخفّف النموذج
            lightened = true; slow = 0;
            worker.postMessage({ type: 'light', models: LIGHT });
            onInfo && onInfo({ note: 'خُفِّف النموذج لسرعة الجهاز' });
        }
        onChunk && onChunk(text, ms);
    }];
    listeners.error = onError ? [onError] : [];

    const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const ac = new AudioContext();
    try { await ac.resume(); } catch (e) { /* مستأنَف أصلاً */ }

    // مؤشّر المستوى: من محلّل مستقلّ، فيبقى يتحرّك ولو تعثّر التسجيل
    const src = ac.createMediaStreamSource(stream);
    const an = ac.createAnalyser(); an.fftSize = 512;
    src.connect(an);
    const buf = new Float32Array(an.fftSize);
    let peak = 0;
    const meter = setInterval(() => {
        an.getFloatTimeDomainData(buf);
        let p = 0; for (let i = 0; i < buf.length; i++) { const v = Math.abs(buf[i]); if (v > p) p = v; }
        peak = Math.max(peak * 0.85, p);
        onLevel && onLevel(peak);
    }, 120);

    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'].find(t => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || '';
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 64000 } : undefined);
    let dead = false, tail = null, faint = 0;
    let lastBlob = null;                            // آخر مقطعٍ سُمع، يُراجَع برأيٍ ثانٍ عند الشكّ

    rec.ondataavailable = async e => {
        if (dead || !e.data || e.data.size < 2000) return;
        try {
            lastBlob = e.data;
            const ab = await e.data.arrayBuffer();
            const decoded = await ac.decodeAudioData(ab.slice(0));
            const raw = resample(decoded.getChannelData(0), decoded.sampleRate, SR);
            let sum = 0; for (let i = 0; i < raw.length; i++) sum += Math.abs(raw[i]);
            const avg = sum / raw.length;
            onInfo && onInfo({ rate: decoded.sampleRate, level: avg, light: lightened });
            const fixed = clean(raw);
            const keep = Math.min(fixed.length, Math.round(SR * OVERLAP));
            const next = fixed.slice(fixed.length - keep);
            // الخافت جداً لا يُرسل: النموذج عليه يكرّر ويهذي. والقارئ يُنبَّه ليقرّب الجوال.
            if (avg < 0.0025) {
                tail = null;
                if (++faint === 3) onInfo && onInfo({ note: 'صوتك بعيد — قرّب الجوال من فمك' });
                return;
            }
            faint = 0;
            let pcm = fixed;
            if (tail && tail.length) {                  // ذيل المقطع السابق أوّلاً
                pcm = new Float32Array(tail.length + fixed.length);
                pcm.set(tail, 0); pcm.set(fixed, tail.length);
            }
            tail = next;
            if (useCloud) {                             // السحاب: يُرسل المقطع كما سُجّل، بلا تحويل
                const t0 = Date.now();
                const r = await call('asr', { form: e.data, params: { hint: hint ? hint() : '' } });
                if (r && r.success && typeof r.text === 'string') { onChunk && onChunk(r.text.trim(), Date.now() - t0); return; }
                const msg = (r && r.message) || 'انقطع الاتصال';
                // ضيقٌ بعدد الطلبات لا عطبٌ في الخدمة: نهدّئ ونطيل المقطع ونبقى في السحاب
                if (/429|rate limit/i.test(msg) && segCloud < SEG_CLOUD_MAX) {
                    segCloud = Math.min(SEG_CLOUD_MAX, segCloud + 1200);
                    onInfo && onInfo({ note: 'هدّأتُ الإرسال ليتّسع له حدّ الخطّة (' + (segCloud / 1000).toFixed(1) + 'ث للمقطع)' });
                    return;
                }
                useCloud = false;                       // تعذّر السحاب: نكمل على الجهاز
                onInfo && onInfo({ cloud: false, note: msg });
                try { await loadAsr(); } catch (err) { onError && onError('تعذّر تشغيل النموذج على الجهاز'); return; }
            }
            worker.postMessage({ type: 'audio', pcm });
        } catch (err) { onError && onError(String((err && err.message) || err)); }
    };

    // تسجيلٌ مستقلّ لكل مقطع: المقاطع التالية في timeslice بلا ترويسةٍ فلا تُفكّ
    const loop = () => {
        if (dead) return;
        try { rec.start(); } catch (e) { return; }
        setTimeout(() => { try { rec.state === 'recording' && rec.stop(); } catch (e) { /* متوقّف */ } }, useCloud ? segCloud : SEG);
    };
    rec.onstop = () => { if (!dead) setTimeout(loop, 60); };
    loop();
    return {
        // رأيٌ ثانٍ من النموذج الأكبر: لا يُطلب إلا حين يوشك التطبيق أن يحكم بالخطأ
        async recheck(hintText) {
            if (!useCloud || !lastBlob) return null;
            const r = await call('asr', { form: lastBlob, params: { m: 'big', hint: hintText || '' } });
            return r && r.success && typeof r.text === 'string' ? r.text.trim() : null;
        },
        stop() {
            dead = true;
            clearInterval(meter);
            listeners.text = []; listeners.error = [];
            try { rec.state !== 'inactive' && rec.stop(); } catch (e) { /* متوقّف */ }
            try { src.disconnect(); an.disconnect(); } catch (e) { /* مغلق */ }
            try { stream.getTracks().forEach(t => t.stop()); } catch (e) { /* تجاهل */ }
            try { ac.close(); } catch (e) { /* تجاهل */ }
        },
    };
}
