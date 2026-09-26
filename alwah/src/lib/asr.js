// ════════════════════════════════════════════════════════════════════════════
//  الأذن: تعرّفٌ على التلاوة يعمل على الجهاز نفسه
//  ─────────────────────────────────────────────────────────────────────────
//  النموذج مضبوطٌ على القرآن وحده (Tarteel، رخصة Apache) ويُشغَّل داخل
//  المتصفّح: الصوت لا يغادر الجهاز، ولا مفتاح ولا خادم، ويعمل بلا إنترنت بعد
//  أوّل تحميل. والتعرّف يجري في عاملٍ مستقلّ (Worker) فلا تتجمّد الواجهة،
//  وعلى WebGPU إن توفّرت وإلا فعلى WASM.
//
//  التلاوة تُقطَّع بالسكوت لا بالثواني: نسجّل حتى يقف القارئ لحظةً فنرسل
//  المقطع — وهذا موافقٌ لوقف القارئ على رؤوس الآي.
// ════════════════════════════════════════════════════════════════════════════
const CDN = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.5.1';
const SR = 16000;

// المشفّر بصيغةٍ كاملة: صيغته المضغوطة تستعمل ConvInteger ولا ينفّذها المتصفّح
const MODELS = [
    { id: 'Sharjeelbaig/whisper-tiny-ar-quran-onnx', dtype: { encoder_model: 'fp32', decoder_model_merged: 'q8' } },
    { id: 'Sharjeelbaig/whisper-tiny-ar-quran-onnx', dtype: 'fp32' },
];

const WORKER = `
import { pipeline, env } from '${CDN}';
env.allowLocalModels = false;
let p = null, busy = false;
self.onmessage = async e => {
  const m = e.data;
  if (m.type === 'load') {
    let last = null;
    for (const dev of (m.gpu ? ['webgpu', 'wasm'] : ['wasm'])) {
      for (const cfg of m.models) {
        try {
          p = await pipeline('automatic-speech-recognition', cfg.id, {
            dtype: cfg.dtype, device: dev,
            progress_callback: x => self.postMessage({ type: 'progress', x }),
          });
          self.postMessage({ type: 'ready', device: dev });
          return;
        } catch (err) { p = null; last = err; }
      }
    }
    self.postMessage({ type: 'error', message: String((last && last.message) || last || 'تعذّر تحميل النموذج') });
  } else if (m.type === 'audio') {
    if (!p || busy) return;                       // لا نُزاحم تعرّفاً جارياً
    busy = true;
    const t0 = Date.now();
    try {
      const r = await p(m.pcm, { language: 'ar', task: 'transcribe' });
      self.postMessage({ type: 'text', text: ((r && r.text) || '').trim(), ms: Date.now() - t0 });
    } catch (err) { self.postMessage({ type: 'error', message: String((err && err.message) || err) }); }
    busy = false;
  }
};`;

let worker = null, ready = false, loading = null;
const listeners = { text: [], error: [] };

export const asrSupported = () => !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.AudioContext && window.Worker);
export const asrReady = () => ready;

export function loadAsr(onProgress) {
    if (ready) return Promise.resolve(true);
    if (loading) return loading;
    loading = new Promise((res, rej) => {
        const url = URL.createObjectURL(new Blob([WORKER], { type: 'text/javascript' }));
        worker = new Worker(url, { type: 'module' });
        const seen = {};
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
            } else if (m.type === 'text') {
                listeners.text.forEach(f => f(m.text, m.ms));
            } else if (m.type === 'error') {
                if (!ready) { loading = null; rej(new Error(m.message)); }
                else listeners.error.forEach(f => f(m.message));
            }
        };
        worker.onerror = e => { if (!ready) { loading = null; rej(new Error(e.message || 'تعذّر تشغيل المعالج')); } };
        worker.postMessage({ type: 'load', models: MODELS, gpu: !!navigator.gpu });
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

// ─── الميكروفون ─────────────────────────────────────────────────────────────
// التسجيل بـ MediaRecorder لا بـ ScriptProcessor: الأخير يعطي صمتاً على بعض
// أجهزة أندرويد (السياق الصوتي يبدأ موقوفاً)، فيهذي النموذج على الصمت ويخرج
// كلاماً ثابتاً لا علاقة له بالتلاوة. هنا نسجّل مقاطع قصيرة، نفكّها إلى
// عيّنات، ونحوّلها إلى 16 ألفاً، ثم نقيس شدّتها: الصامت لا يُرسل أصلاً.
export async function listen({ onChunk, onLevel, onError, onInfo }) {
    listeners.text = [onChunk]; listeners.error = onError ? [onError] : [];
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
    let dead = false;

    rec.ondataavailable = async e => {
        if (dead || !e.data || e.data.size < 2000) return;
        try {
            const ab = await e.data.arrayBuffer();
            const decoded = await ac.decodeAudioData(ab.slice(0));
            const raw = decoded.getChannelData(0);
            let sum = 0; for (let i = 0; i < raw.length; i++) sum += Math.abs(raw[i]);
            const avg = sum / raw.length;
            onInfo && onInfo({ rate: decoded.sampleRate, gpu: !!navigator.gpu, level: avg });
            if (avg < 0.0015) return;                       // صمت: لا نُشغّل النموذج عليه فيهذي
            worker.postMessage({ type: 'audio', pcm: resample(raw, decoded.sampleRate, SR) });
        } catch (err) { onError && onError(String((err && err.message) || err)); }
    };

    rec.start(5000);                                        // مقطعٌ كل خمس ثوان
    return {
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
