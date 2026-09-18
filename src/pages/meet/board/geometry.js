// ════════════════════════════════════════════════════════════════════════════
//  هندسة السبورة — الحدود والدوران والتحجيم والالتقاط
//  ─────────────────────────────────────────────────────────────────────────
//  كل عنصر له صندوق محلّي (x,y,w,h) وزاوية دوران حول مركزه. الحساب كلّه يجري
//  في الفضاء المحلّي ثم يُعاد إلى فضاء اللوح، فيصحّ التحجيم والالتقاط مهما
//  دار العنصر. القلم والخطوط لها صندوقها المشتقّ من نقاطها.
// ════════════════════════════════════════════════════════════════════════════

export const RAD = Math.PI / 180;

// الأنواع التي تُرسم كصندوق: تُحجَّم وتُدار ويُكتب فيها
export const BOXY = ['rect', 'roundrect', 'ellipse', 'diamond', 'triangle', 'star', 'note', 'text', 'image', 'frame'];
export const isBoxy = k => BOXY.indexOf(k) >= 0;
export const isSeg  = k => k === 'line' || k === 'arrow' || k === 'connector';

export const rot = (px, py, cx, cy, deg) => {
    if (!deg) return { x: px, y: py };
    const a = deg * RAD, c = Math.cos(a), s = Math.sin(a);
    const dx = px - cx, dy = py - cy;
    return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
};

// الصندوق المحلّي — قبل الدوران
export function rawBounds(it) {
    const d = it.data || {};
    if (it.kind === 'pen') {
        const p = d.pts || [];
        if (!p.length) return null;
        let x1 = p[0][0], y1 = p[0][1], x2 = x1, y2 = y1;
        for (let i = 1; i < p.length; i++) {
            const q = p[i];
            if (q[0] < x1) x1 = q[0]; if (q[1] < y1) y1 = q[1];
            if (q[0] > x2) x2 = q[0]; if (q[1] > y2) y2 = q[1];
        }
        return { x: x1, y: y1, w: Math.max(1, x2 - x1), h: Math.max(1, y2 - y1) };
    }
    if (isSeg(it.kind))
        return { x: Math.min(d.x1, d.x2), y: Math.min(d.y1, d.y2),
                 w: Math.abs(d.x2 - d.x1), h: Math.abs(d.y2 - d.y1) };
    return { x: d.x || 0, y: d.y || 0, w: d.w || 0, h: d.h || 0 };
}

export const centerOf = it => { const b = rawBounds(it); return b ? { x: b.x + b.w / 2, y: b.y + b.h / 2 } : { x: 0, y: 0 }; };

// الأركان الأربعة بعد الدوران، بترتيب: يسار-أعلى، يمين-أعلى، يمين-أسفل، يسار-أسفل
export function corners(it) {
    const b = rawBounds(it);
    if (!b) return [];
    const a = (it.data && it.data.rot) || 0;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    return [[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]]
        .map(([x, y]) => rot(x, y, cx, cy, a));
}

// الصندوق المحاذي للمحاور بعد الدوران — للتحديد والخريطة المصغّرة والتصدير
export function aabb(it) {
    const a = (it.data && it.data.rot) || 0;
    const b = rawBounds(it);
    if (!b) return null;
    if (!a) return b;
    const cs = corners(it);
    const xs = cs.map(p => p.x), ys = cs.map(p => p.y);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
}

export function groupBounds(list) {
    const bs = list.map(aabb).filter(Boolean);
    if (!bs.length) return null;
    const x1 = Math.min(...bs.map(b => b.x)), y1 = Math.min(...bs.map(b => b.y));
    const x2 = Math.max(...bs.map(b => b.x + b.w)), y2 = Math.max(...bs.map(b => b.y + b.h));
    return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
}

// المسافة من نقطة إلى قطعة — لالتقاط الخطوط والقلم بدقّة لا بصندوقها
function distSeg(px, py, x1, y1, x2, y2) {
    const dx = x2 - x1, dy = y2 - y1;
    const L = dx * dx + dy * dy;
    let t = L ? ((px - x1) * dx + (py - y1) * dy) / L : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

// التقاط دقيق: الخطوط والقلم بمسافة من المسار، والأشكال بصندوقها المحلّي
export function hitTest(it, p, pad) {
    const d = it.data || {};
    const tol = (pad || 6) + (d.w || d.sw || 3) / 2;
    if (it.kind === 'pen') {
        const pts = d.pts || [];
        for (let i = 1; i < pts.length; i++)
            if (distSeg(p.x, p.y, pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1]) <= tol) return true;
        return false;
    }
    if (isSeg(it.kind)) return distSeg(p.x, p.y, d.x1, d.y1, d.x2, d.y2) <= tol;
    const b = rawBounds(it);
    if (!b) return false;
    const c = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    const q = rot(p.x, p.y, c.x, c.y, -(d.rot || 0));
    const e = pad || 4;
    // الإطار يُلتقط من حافّته وعنوانه فقط، فيبقى ما بداخله قابلاً للنقر
    if (it.kind === 'frame') {
        const inOuter = q.x >= b.x - e && q.x <= b.x + b.w + e && q.y >= b.y - 26 && q.y <= b.y + b.h + e;
        const inInner = q.x > b.x + 6 && q.x < b.x + b.w - 6 && q.y > b.y + 6 && q.y < b.y + b.h - 6;
        return inOuter && !inInner;
    }
    return q.x >= b.x - e && q.x <= b.x + b.w + e && q.y >= b.y - e && q.y <= b.y + b.h + e;
}

// هل يقع العنصر داخل مستطيل التحديد كاملاً
export function insideRect(it, r) {
    const b = aabb(it);
    return !!b && b.x >= r.x && b.y >= r.y && b.x + b.w <= r.x + r.w && b.y + b.h <= r.y + r.h;
}

export function moveItem(it, dx, dy) {
    const d = { ...(it.data || {}) };
    if (it.kind === 'pen') d.pts = (d.pts || []).map(([x, y]) => [x + dx, y + dy]);
    else if (isSeg(it.kind)) { d.x1 += dx; d.y1 += dy; d.x2 += dx; d.y2 += dy; }
    else { d.x = (d.x || 0) + dx; d.y = (d.y || 0) + dy; }
    return { ...it, data: d };
}

// ─── التحجيم ───────────────────────────────────────────────────────────────
// المقبض المقابل يبقى ثابتاً في فضاء اللوح مهما كانت الزاوية: نحسب الصندوق
// الجديد في الفضاء المحلّي ثم نزيح العنصر ليعود الركن الثابت إلى موضعه.
export const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export function handlePoints(b, deg) {
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const raw = {
        nw: [b.x, b.y], n: [cx, b.y], ne: [b.x + b.w, b.y], e: [b.x + b.w, cy],
        se: [b.x + b.w, b.y + b.h], s: [cx, b.y + b.h], sw: [b.x, b.y + b.h], w: [b.x, cy],
    };
    const out = {};
    for (const k of HANDLES) out[k] = rot(raw[k][0], raw[k][1], cx, cy, deg || 0);
    out.rotate = rot(cx, b.y - 28, cx, cy, deg || 0);
    return out;
}

const OPP = { nw: 'se', n: 's', ne: 'sw', e: 'w', se: 'nw', s: 'n', sw: 'ne', w: 'e' };

export function resizeBox(b, handle, local, keepRatio, min) {
    const m = min || 8;
    let { x, y, w, h } = b;
    const r = x + w, bt = y + h;
    if (handle.indexOf('w') >= 0) { x = Math.min(local.x, r - m); w = r - x; }
    if (handle.indexOf('e') >= 0) { w = Math.max(m, local.x - x); }
    if (handle.indexOf('n') >= 0) { y = Math.min(local.y, bt - m); h = bt - y; }
    if (handle.indexOf('s') >= 0) { h = Math.max(m, local.y - y); }
    if (keepRatio && b.w && b.h) {
        const k = Math.max(w / b.w, h / b.h);
        const nw = b.w * k, nh = b.h * k;
        if (handle.indexOf('w') >= 0) x = r - nw;
        if (handle.indexOf('n') >= 0) y = bt - nh;
        w = nw; h = nh;
    }
    return { x, y, w: Math.max(m, w), h: Math.max(m, h) };
}

export function resizeItem(it, handle, world, keepRatio) {
    const d = { ...(it.data || {}) };
    const b = rawBounds(it);
    if (!b) return it;
    const deg = d.rot || 0;
    const c0 = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    const fixedBefore = handlePoints(b, deg)[OPP[handle]];
    const local = rot(world.x, world.y, c0.x, c0.y, -deg);
    const nb = resizeBox(b, handle, local, keepRatio || it.kind === 'image', it.kind === 'text' ? 40 : 12);
    const c1 = { x: nb.x + nb.w / 2, y: nb.y + nb.h / 2 };
    const fixedAfter = rot(handlePoints(nb, 0)[OPP[handle]].x, handlePoints(nb, 0)[OPP[handle]].y, c1.x, c1.y, deg);
    const off = { x: fixedBefore.x - fixedAfter.x, y: fixedBefore.y - fixedAfter.y };

    if (it.kind === 'pen') {
        const sx = nb.w / b.w, sy = nb.h / b.h;
        d.pts = (d.pts || []).map(([x, y]) => [nb.x + (x - b.x) * sx + off.x, nb.y + (y - b.y) * sy + off.y]);
        return { ...it, data: d };
    }
    if (isSeg(it.kind)) {
        const sx = nb.w / (b.w || 1), sy = nb.h / (b.h || 1);
        d.x1 = nb.x + (d.x1 - b.x) * sx + off.x; d.y1 = nb.y + (d.y1 - b.y) * sy + off.y;
        d.x2 = nb.x + (d.x2 - b.x) * sx + off.x; d.y2 = nb.y + (d.y2 - b.y) * sy + off.y;
        return { ...it, data: d };
    }
    d.x = nb.x + off.x; d.y = nb.y + off.y; d.w = nb.w; d.h = nb.h;
    return { ...it, data: d };
}

// تحجيم مجموعة: نسبة واحدة تُطبَّق على الجميع حول ركن ثابت
export function scaleItem(it, origin, sx, sy) {
    const d = { ...(it.data || {}) };
    const S = (v, o, k) => o + (v - o) * k;
    if (it.kind === 'pen') { d.pts = (d.pts || []).map(([x, y]) => [S(x, origin.x, sx), S(y, origin.y, sy)]); return { ...it, data: d }; }
    if (isSeg(it.kind)) {
        d.x1 = S(d.x1, origin.x, sx); d.y1 = S(d.y1, origin.y, sy);
        d.x2 = S(d.x2, origin.x, sx); d.y2 = S(d.y2, origin.y, sy);
        return { ...it, data: d };
    }
    d.x = S(d.x, origin.x, sx); d.y = S(d.y, origin.y, sy);
    d.w = Math.max(8, (d.w || 0) * sx); d.h = Math.max(8, (d.h || 0) * sy);
    if (d.size) d.size = Math.max(8, d.size * Math.min(sx, sy));
    return { ...it, data: d };
}

export function rotateItem(it, deg, pivot) {
    const d = { ...(it.data || {}) };
    if (it.kind === 'pen' || isSeg(it.kind)) {
        const c = pivot || centerOf(it);
        if (it.kind === 'pen') d.pts = (d.pts || []).map(([x, y]) => { const p = rot(x, y, c.x, c.y, deg); return [p.x, p.y]; });
        else {
            const a = rot(d.x1, d.y1, c.x, c.y, deg), b = rot(d.x2, d.y2, c.x, c.y, deg);
            d.x1 = a.x; d.y1 = a.y; d.x2 = b.x; d.y2 = b.y;
        }
        return { ...it, data: d };
    }
    if (pivot) {
        const c = centerOf(it);
        const nc = rot(c.x, c.y, pivot.x, pivot.y, deg);
        d.x = (d.x || 0) + (nc.x - c.x); d.y = (d.y || 0) + (nc.y - c.y);
    }
    d.rot = ((d.rot || 0) + deg) % 360;
    return { ...it, data: d };
}

// ─── مرابط الموصّلات ───────────────────────────────────────────────────────
// الموصّل يُخزَّن بالمعرّف لا بالإحداثيات، فيتبع الشكل حين يتحرّك أو يُحجَّم.
export const ANCHORS = ['t', 'r', 'b', 'l'];

export function anchorPoint(it, a) {
    const b = rawBounds(it);
    if (!b) return null;
    const c = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    const raw = { t: [c.x, b.y], r: [b.x + b.w, c.y], b: [c.x, b.y + b.h], l: [b.x, c.y], c: [c.x, c.y] };
    const q = raw[a] || raw.c;
    return rot(q[0], q[1], c.x, c.y, (it.data && it.data.rot) || 0);
}

export function nearestAnchor(it, p) {
    let best = 'c', dist = Infinity;
    for (const a of ANCHORS) {
        const q = anchorPoint(it, a);
        const dd = Math.hypot(q.x - p.x, q.y - p.y);
        if (dd < dist) { dist = dd; best = a; }
    }
    return { anchor: best, dist };
}

// نقطتا الموصّل بعد حلّ المرابط — تُحسب عند الرسم لا عند الحفظ
export function connectorEnds(it, byId) {
    const d = it.data || {};
    let a = { x: d.x1, y: d.y1 }, b = { x: d.x2, y: d.y2 };
    if (d.from && byId[d.from.id]) {
        const p = anchorPoint(byId[d.from.id], d.from.anchor);
        if (p) a = p;
    }
    if (d.to && byId[d.to.id]) {
        const p = anchorPoint(byId[d.to.id], d.to.anchor);
        if (p) b = p;
    }
    return [a, b];
}

// ─── الالتقاط والأدلّة ─────────────────────────────────────────────────────
// عند التحريك نقارن حواف المتحرّك ومركزه بحواف الجيران، فإن قربت التصقت
// وظهر خطّ دليل. عتبة الالتقاط بالبكسل على الشاشة لا باللوح، فتثبت مع التكبير.
export function snapMove(movingBox, others, k, grid) {
    const T = 7 / (k || 1);
    let dx = 0, dy = 0, bestX = T, bestY = T;
    const guides = [];
    const mx = [movingBox.x, movingBox.x + movingBox.w / 2, movingBox.x + movingBox.w];
    const my = [movingBox.y, movingBox.y + movingBox.h / 2, movingBox.y + movingBox.h];

    for (const o of others) {
        const ox = [o.x, o.x + o.w / 2, o.x + o.w];
        const oy = [o.y, o.y + o.h / 2, o.y + o.h];
        for (const a of mx) for (const b of ox) {
            const diff = b - a;
            if (Math.abs(diff) < bestX) { bestX = Math.abs(diff); dx = diff; guides.push({ v: b }); }
        }
        for (const a of my) for (const b of oy) {
            const diff = b - a;
            if (Math.abs(diff) < bestY) { bestY = Math.abs(diff); dy = diff; guides.push({ h: b }); }
        }
    }
    if (grid && !dx) dx = Math.round(movingBox.x / grid) * grid - movingBox.x;
    if (grid && !dy) dy = Math.round(movingBox.y / grid) * grid - movingBox.y;
    return { dx, dy, guides: guides.slice(-6) };
}

// ─── المحاذاة والتوزيع ─────────────────────────────────────────────────────
export function alignDelta(it, box, how) {
    const b = aabb(it);
    if (!b) return { dx: 0, dy: 0 };
    switch (how) {
        case 'left':   return { dx: box.x - b.x, dy: 0 };
        case 'right':  return { dx: box.x + box.w - (b.x + b.w), dy: 0 };
        case 'hcenter':return { dx: box.x + box.w / 2 - (b.x + b.w / 2), dy: 0 };
        case 'top':    return { dx: 0, dy: box.y - b.y };
        case 'bottom': return { dx: 0, dy: box.y + box.h - (b.y + b.h) };
        case 'vcenter':return { dx: 0, dy: box.y + box.h / 2 - (b.y + b.h / 2) };
        default:       return { dx: 0, dy: 0 };
    }
}
