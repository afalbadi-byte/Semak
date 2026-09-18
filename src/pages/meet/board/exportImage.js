import { rawBounds, aabb, groupBounds, connectorEnds, isSeg } from './geometry';
import { noteBg, fitSize } from './render';

// ════════════════════════════════════════════════════════════════════════════
//  تصدير السبورة صورةً — رسمٌ يدويّ على لوح ثنائي الأبعاد
//  ─────────────────────────────────────────────────────────────────────────
//  لا نلتقط الصفحة بمكتبة خارجية: نحن نملك نموذج كل عنصر، فرسمه بأنفسنا
//  يعطي دقّةً كاملة عند أي تكبير، ويشتغل على ما لا تراه الشاشة الآن.
// ════════════════════════════════════════════════════════════════════════════

const loadImg = src => new Promise(res => {
    const im = new Image();
    im.crossOrigin = 'anonymous';
    im.onload = () => res(im);
    im.onerror = () => res(null);
    im.src = src;
});

function wrap(c, text, w, size) {
    c.font = '800 ' + size + 'px Cairo, system-ui, sans-serif';
    const out = [];
    for (const para of String(text || '').split('\n')) {
        let line = '';
        for (const word of para.split(' ')) {
            const probe = line ? line + ' ' + word : word;
            if (c.measureText(probe).width > w && line) { out.push(line); line = word; } else line = probe;
        }
        out.push(line);
    }
    return out;
}

function drawText(c, text, b, size, color, middle) {
    if (!text) return;
    c.fillStyle = color;
    c.textAlign = 'center';
    const lines = wrap(c, text, b.w - 16, size);
    const lh = size * 1.4;
    const top = middle ? b.y + b.h / 2 - (lines.length * lh) / 2 + lh * 0.75 : b.y + size + 4;
    lines.forEach((ln, i) => c.fillText(ln, b.x + b.w / 2, top + i * lh));
    c.textAlign = 'start';
}

function head(c, a, b, w, color) {
    const ang = Math.atan2(b.y - a.y, b.x - a.x), L = 8 + w * 2.2, S = 0.42;
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(b.x, b.y);
    c.lineTo(b.x - L * Math.cos(ang - S), b.y - L * Math.sin(ang - S));
    c.lineTo(b.x - L * Math.cos(ang + S), b.y - L * Math.sin(ang + S));
    c.closePath(); c.fill();
}

// list: العناصر المطلوب تصديرها. area: صندوق اختياري (إطار أو تحديد)
export default async function exportImage(list, area, opts) {
    const o = opts || {};
    if (!list.length) return null;
    const box = area || groupBounds(list);
    if (!box) return null;
    const pad = area ? 0 : 48;
    const W = box.w + pad * 2, H = box.h + pad * 2;
    const s = Math.min(3, Math.max(1, 2600 / Math.max(W, H)));
    const cv = document.createElement('canvas');
    cv.width = Math.round(W * s); cv.height = Math.round(H * s);
    const c = cv.getContext('2d');
    c.fillStyle = o.bg || '#0f172a';
    c.fillRect(0, 0, cv.width, cv.height);
    c.setTransform(s, 0, 0, s, (-box.x + pad) * s, (-box.y + pad) * s);
    c.lineCap = 'round'; c.lineJoin = 'round';

    const byId = {};
    for (const it of list) byId[it.id] = it;
    const imgs = {};
    await Promise.all(list.filter(i => i.kind === 'image' && i.data && i.data.src)
        .map(async i => { imgs[i.id] = await loadImg(i.data.src); }));

    for (const it of list.slice().sort((a, b) => (a.z || 0) - (b.z || 0))) {
        if (it.kind === 'comment') continue;              // التعليقات ملاحظاتُ عملٍ لا تدخل الصورة
        const d = it.data || {};
        const b = rawBounds(it);
        if (!b) continue;
        const stroke = d.color || '#e2e8f0';
        const sw = d.sw || d.w || 3;
        c.save();
        c.globalAlpha = d.opacity != null ? d.opacity : 1;
        if (d.rot && !isSeg(it.kind) && it.kind !== 'pen') {
            c.translate(b.x + b.w / 2, b.y + b.h / 2);
            c.rotate((d.rot * Math.PI) / 180);
            c.translate(-(b.x + b.w / 2), -(b.y + b.h / 2));
        }
        c.strokeStyle = stroke; c.fillStyle = stroke; c.lineWidth = sw;
        c.setLineDash(d.dash ? (d.dash === 'dot' ? [sw, sw * 2] : [sw * 3, sw * 2]) : []);
        const cx = b.x + b.w / 2, cy = b.y + b.h / 2;

        if (it.kind === 'pen') {
            const p = d.pts || [];
            if (p.length > 1) {
                if (d.marker) c.globalAlpha = 0.35;
                c.beginPath(); c.moveTo(p[0][0], p[0][1]);
                for (let i = 1; i < p.length; i++) c.lineTo(p[i][0], p[i][1]);
                c.stroke();
            }
        } else if (isSeg(it.kind)) {
            const [a, e] = connectorEnds(it, byId);
            c.beginPath(); c.moveTo(a.x, a.y);
            if (d.curve) c.quadraticCurveTo((a.x + e.x) / 2 + (e.y - a.y) * 0.22, (a.y + e.y) / 2 - (e.x - a.x) * 0.22, e.x, e.y);
            else c.lineTo(e.x, e.y);
            c.stroke();
            c.setLineDash([]);
            if (it.kind !== 'line') head(c, a, e, sw, stroke);
            if (d.bothEnds) head(c, e, a, sw, stroke);
        } else if (it.kind === 'image') {
            const im = imgs[it.id];
            if (im) c.drawImage(im, b.x, b.y, b.w, b.h);
            else { c.strokeRect(b.x, b.y, b.w, b.h); }
        } else if (it.kind === 'frame') {
            c.setLineDash([10, 6]); c.lineWidth = 2;
            c.strokeRect(b.x, b.y, b.w, b.h);
            c.setLineDash([]);
            c.font = '800 15px Cairo, system-ui, sans-serif';
            c.fillText(d.title || 'إطار', b.x + 4, b.y - 8);
        } else if (it.kind === 'note') {
            c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(b.x + 2, b.y + 4, b.w, b.h);
            c.fillStyle = noteBg(d.color); c.fillRect(b.x, b.y, b.w, b.h);
            drawText(c, d.text, b, fitSize(d.text, b.w, b.h), '#0f172a', true);
        } else if (it.kind === 'text') {
            drawText(c, d.text, b, d.size || 22, stroke, false);
        } else {
            if (d.fill && d.fill !== 'none') { c.fillStyle = d.fill; }
            c.beginPath();
            if (it.kind === 'ellipse') c.ellipse(cx, cy, b.w / 2, b.h / 2, 0, 0, 6.2832);
            else if (it.kind === 'diamond') { c.moveTo(cx, b.y); c.lineTo(b.x + b.w, cy); c.lineTo(cx, b.y + b.h); c.lineTo(b.x, cy); c.closePath(); }
            else if (it.kind === 'triangle') { c.moveTo(cx, b.y); c.lineTo(b.x + b.w, b.y + b.h); c.lineTo(b.x, b.y + b.h); c.closePath(); }
            else if (it.kind === 'star') {
                const R = Math.min(b.w, b.h) / 2, r = R * 0.42;
                for (let i = 0; i < 10; i++) {
                    const a = (Math.PI / 5) * i - Math.PI / 2, rr = i % 2 ? r : R;
                    const px = cx + rr * Math.cos(a) * (b.w / Math.min(b.w, b.h));
                    const py = cy + rr * Math.sin(a) * (b.h / Math.min(b.w, b.h));
                    i ? c.lineTo(px, py) : c.moveTo(px, py);
                }
                c.closePath();
            } else {
                const r = it.kind === 'roundrect' ? Math.min(24, b.h / 4) : 0;
                if (r && c.roundRect) c.roundRect(b.x, b.y, b.w, b.h, r);
                else c.rect(b.x, b.y, b.w, b.h);
            }
            if (d.fill && d.fill !== 'none') c.fill();
            c.stroke();
            if (d.text) drawText(c, d.text, b, Math.min(18, b.h / 3), d.textColor || '#e2e8f0', true);
        }
        c.restore();
    }
    return cv;
}

export function download(cv, name) {
    const a = document.createElement('a');
    a.href = cv.toDataURL('image/png');
    a.download = (name || 'سبورة-سماك-' + new Date().toISOString().slice(0, 10)) + '.png';
    a.click();
}
