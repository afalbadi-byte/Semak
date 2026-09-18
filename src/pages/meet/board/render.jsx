import React from 'react';
import { rawBounds, connectorEnds, isSeg } from './geometry';

// ════════════════════════════════════════════════════════════════════════════
//  رسم عناصر السبورة
//  ─────────────────────────────────────────────────────────────────────────
//  الهندسة كلّها في طبقة SVG واحدة، والنصوص في طبقة HTML فوقها: فـSVG لا يلفّ
//  السطور ولا يحرّر، وHTML يفعل الاثنين. الطبقتان تتحرّكان بالتحويل نفسه،
//  فلا تنفصل كلمةٌ عن شكلها مهما كبّرنا أو أدرنا.
// ════════════════════════════════════════════════════════════════════════════

export const NOTE_BG = {
    '#f6c343': '#f7d070', '#60a5fa': '#93c5fd', '#34d399': '#6ee7b7', '#f87171': '#fca5a5',
    '#c084fc': '#d8b4fe', '#fb923c': '#fdba74', '#ffffff': '#f1f5f9', '#94a3b8': '#cbd5e1',
    '#22d3ee': '#67e8f9', '#a3e635': '#bef264',
};
export const noteBg = c => NOTE_BG[c] || '#f7d070';

const starPoints = (b) => {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2, R = Math.min(b.w, b.h) / 2, r = R * 0.42;
    const p = [];
    for (let i = 0; i < 10; i++) {
        const a = (Math.PI / 5) * i - Math.PI / 2;
        const rr = i % 2 ? r : R;
        p.push((cx + rr * Math.cos(a) * (b.w / Math.min(b.w, b.h))).toFixed(1) + ',' +
               (cy + rr * Math.sin(a) * (b.h / Math.min(b.w, b.h))).toFixed(1));
    }
    return p.join(' ');
};

// السهم يُرسم كمسار مملوء لا كعلامة نهاية، فيكبر مع سماكة الخط ويُصدَّر بأمانة
function arrowHead(a, b, w) {
    const ang = Math.atan2(b.y - a.y, b.x - a.x), L = 8 + w * 2.2, S = 0.42;
    const p1 = { x: b.x - L * Math.cos(ang - S), y: b.y - L * Math.sin(ang - S) };
    const p2 = { x: b.x - L * Math.cos(ang + S), y: b.y - L * Math.sin(ang + S) };
    return `M${b.x} ${b.y}L${p1.x} ${p1.y}L${p2.x} ${p2.y}Z`;
}

export function Shape({ it, byId, ghost }) {
    const d = it.data || {};
    const b = rawBounds(it);
    if (!b) return null;
    const stroke = d.color || '#e2e8f0';
    const sw = d.sw || d.w || 3;
    const deg = d.rot || 0;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const spin = deg ? `rotate(${deg} ${cx} ${cy})` : undefined;
    const op = ghost ? 0.7 : (d.opacity != null ? d.opacity : 1);
    const dash = d.dash ? (d.dash === 'dot' ? sw + ' ' + sw * 2 : sw * 3 + ' ' + sw * 2) : undefined;
    const S = { stroke, strokeWidth: sw, fill: d.fill && d.fill !== 'none' ? d.fill : 'none',
        strokeLinecap: 'round', strokeLinejoin: 'round', strokeDasharray: dash, opacity: op };

    if (it.kind === 'pen') {
        const p = d.pts || [];
        if (p.length < 2) return null;
        // القلم المضيء يُرسم شفّافاً وعريضاً بمزج «ضربٍ» فيُبرز ما تحته ولا يخفيه
        return <path d={'M' + p.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L')}
            fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
            opacity={d.marker ? 0.35 : op} style={d.marker ? { mixBlendMode: 'screen' } : undefined} />;
    }

    if (isSeg(it.kind)) {
        const [a, c] = connectorEnds(it, byId || {});
        const mid = d.curve
            ? ` Q ${(a.x + c.x) / 2 + (c.y - a.y) * 0.22} ${(a.y + c.y) / 2 - (c.x - a.x) * 0.22} ${c.x} ${c.y}`
            : ` L ${c.x} ${c.y}`;
        return (
            <g opacity={op}>
                <path d={`M ${a.x} ${a.y}${mid}`} fill="none" stroke={stroke} strokeWidth={sw}
                    strokeLinecap="round" strokeDasharray={dash} />
                {it.kind !== 'line' ? <path d={arrowHead(a, c, sw)} fill={stroke} /> : null}
                {d.bothEnds ? <path d={arrowHead(c, a, sw)} fill={stroke} /> : null}
            </g>
        );
    }

    if (it.kind === 'image')
        return <image href={d.src} x={b.x} y={b.y} width={b.w} height={b.h} transform={spin}
            opacity={op} preserveAspectRatio="none" />;

    if (it.kind === 'frame')
        return (
            <g transform={spin}>
                <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="8"
                    fill={d.fill || 'rgba(255,255,255,.03)'} stroke={stroke} strokeWidth={2} strokeDasharray="10 6" />
                <text x={b.x + 4} y={b.y - 8} fill={stroke} fontSize="15" fontWeight="800"
                    style={{ fontFamily: 'Cairo, sans-serif' }}>{d.title || 'إطار'}</text>
            </g>
        );

    if (it.kind === 'note')
        return (
            <g transform={spin} opacity={op}>
                <rect x={b.x + 2} y={b.y + 4} width={b.w} height={b.h} rx="4" fill="rgba(0,0,0,.35)" />
                <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="4" fill={noteBg(d.color)} />
            </g>
        );

    if (it.kind === 'text') return null;                       // النص كلّه في طبقة HTML

    const common = { ...S, transform: spin };
    if (it.kind === 'rect')      return <rect x={b.x} y={b.y} width={b.w} height={b.h} {...common} />;
    if (it.kind === 'roundrect') return <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={Math.min(24, b.h / 4)} {...common} />;
    if (it.kind === 'ellipse')   return <ellipse cx={cx} cy={cy} rx={b.w / 2} ry={b.h / 2} {...common} />;
    if (it.kind === 'diamond')   return <polygon points={`${cx},${b.y} ${b.x + b.w},${cy} ${cx},${b.y + b.h} ${b.x},${cy}`} {...common} />;
    if (it.kind === 'triangle')  return <polygon points={`${cx},${b.y} ${b.x + b.w},${b.y + b.h} ${b.x},${b.y + b.h}`} {...common} />;
    if (it.kind === 'star')      return <polygon points={starPoints(b)} {...common} />;
    return null;
}

// ─── طبقة النص ─────────────────────────────────────────────────────────────
// الملاحظة تُصغّر خطّها حتى يتّسع النص، كما في اللوحات المعروفة.
export function fitSize(text, w, h) {
    const n = (text || '').length || 1;
    const area = Math.max(1, w * h);
    const s = Math.sqrt(area / (n * 1.6));
    return Math.max(10, Math.min(38, s));
}

export function TextBox({ it, editing, onCommit, onCancel }) {
    const d0 = it.data || {};
    // الإطار يحمل عنوانه في title، وبقيّة العناصر نصّها في text
    const d = it.kind === 'frame' ? { ...d0, text: d0.title || '' } : d0;
    if (it.kind === 'frame' && !editing) return null;     // العنوان يُرسم في طبقة SVG
    if (it.kind !== 'note' && it.kind !== 'text' && !d.text && !editing) return null;
    const b = rawBounds(it);
    if (!b) return null;
    const isNote = it.kind === 'note';
    const size = it.kind === 'text' ? (d.size || 22) : (isNote ? fitSize(d.text, b.w, b.h) : Math.min(18, b.h / 3));
    const col = isNote ? '#0f172a' : (it.kind === 'text' ? (d.color || '#e2e8f0') : (d.textColor || '#e2e8f0'));
    const style = {
        position: 'absolute', left: b.x, top: b.y, width: b.w, height: it.kind === 'text' ? 'auto' : b.h,
        transform: d.rot ? `rotate(${d.rot}deg)` : undefined, transformOrigin: 'center',
        color: col, fontSize: size + 'px', lineHeight: 1.4, fontWeight: 800,
        display: 'flex', alignItems: isNote ? 'center' : (it.kind === 'text' ? 'flex-start' : 'center'),
        justifyContent: 'center', padding: isNote ? 10 : 4, textAlign: 'center',
        whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflow: 'hidden',
    };
    if (editing) return (
        <textarea autoFocus defaultValue={d.text || ''} dir="auto"
            onBlur={e => onCommit(e.target.value)}
            onKeyDown={e => {
                if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); onCommit(e.target.value); }
            }}
            style={{ ...style, background: isNote ? 'transparent' : 'rgba(2,6,23,.6)', border: 'none',
                outline: '2px solid #f6c343', borderRadius: 4, resize: 'none', display: 'block' }} />
    );
    return <div dir="auto" style={{ ...style, pointerEvents: 'none' }}>{d.text || ''}</div>;
}
