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

// ─── الميكروفون: يلتقط، ويقطّع عند السكوت، ويرسل المقاطع للعامل ─────────────
export async function listen({ onChunk, onLevel, onError }) {
    listeners.text = [onChunk]; listeners.error = onError ? [onError] : [];
    const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    });
    const ac = new AudioContext({ sampleRate: SR });
    const src = ac.createMediaStreamSource(stream);
    const proc = ac.createScriptProcessor(4096, 1, 1);
    const buf = [];
    let voiced = 0, silence = 0, dead = false, floor = 0.012;

    const flush = () => {
        const n = buf.reduce((s, x) => s + x.length, 0);
        buf.length = 0; voiced = 0; silence = 0;
        if (n < SR * 0.7 || dead) return;
        const pcm = new Float32Array(n);
        let o = 0; for (const b of bufKeep) { pcm.set(b, o); o += b.length; }
        worker.postMessage({ type: 'audio', pcm }, [pcm.buffer]);
    };
    let bufKeep = [];

    proc.onaudioprocess = e => {
        if (dead) return;
        const x = e.inputBuffer.getChannelData(0);
        let sum = 0, peak = 0;
        for (let i = 0; i < x.length; i++) { const v = Math.abs(x[i]); sum += v; if (v > peak) peak = v; }
        const avg = sum / x.length;
        floor = floor * 0.995 + avg * 0.005;                 // أرضية الضجيج تتكيّف مع المكان
        onLevel && onLevel(peak);
        const speaking = avg > Math.max(0.006, floor * 2.2);
        if (speaking) { voiced += x.length; silence = 0; buf.push(new Float32Array(x)); }
        else if (voiced) {
            silence += x.length;
            buf.push(new Float32Array(x));
            if (silence > SR * 0.45) { bufKeep = buf.slice(); flush(); }
        } else if (buf.length > 4) buf.shift();              // نحتفظ بلحظةٍ قبل الكلام
        else buf.push(new Float32Array(x));
        if (voiced > SR * 9) { bufKeep = buf.slice(); flush(); }
    };

    src.connect(proc); proc.connect(ac.destination);
    return {
        stop() {
            dead = true;
            listeners.text = []; listeners.error = [];
            try { proc.disconnect(); src.disconnect(); } catch (e) { /* مغلق */ }
            try { stream.getTracks().forEach(t => t.stop()); } catch (e) { /* تجاهل */ }
            try { ac.close(); } catch (e) { /* تجاهل */ }
        },
    };
}
