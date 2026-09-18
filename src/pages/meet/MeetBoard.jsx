import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    MousePointer2, Hand, Pen, Highlighter, Eraser, StickyNote, Square, Circle, Diamond,
    Triangle, Star, ArrowUpRight, Minus, Spline, Type, Frame, MessageCircle, Image as ImageIcon,
    Undo2, Redo2, Download, Trash2, ZoomIn, ZoomOut, Maximize, Users, Loader2, LayoutTemplate,
    Search, Lock, Unlock, Copy, ChevronUp, ChevronDown, AlignHorizontalJustifyStart,
    AlignVerticalJustifyStart, Grid3x3, Magnet, Map as MapIcon,
} from 'lucide-react';
import useBoard, { uid } from './board/useBoard';
import {
    rawBounds, aabb, groupBounds, hitTest, insideRect, moveItem, resizeItem, scaleItem,
    rotateItem, handlePoints, nearestAnchor, snapMove, alignDelta, isSeg, isBoxy,
} from './board/geometry';
import { Shape, TextBox } from './board/render';
import { TEMPLATES } from './board/templates';
import exportImage, { download } from './board/exportImage';

// ════════════════════════════════════════════════════════════════════════════
//  سبورة الاجتماع — لوح لا نهائي بإمكانات لوحات العمل المعروفة
//  ─────────────────────────────────────────────────────────────────────────
//  تحديد متعدّد وتحجيم ودوران، موصّلات تتبع الأشكال، إطارات وصور وتعليقات،
//  قوالب جاهزة، التقاط وأدلّة محاذاة، خريطة مصغّرة، ومؤشّرات الحاضرين.
//  الرسم في SVG والنصّ في HTML فوقه، والتفاعل كلّه على طبقة واحدة تلتقط
//  المؤشّر وتحسب الإصابة هندسياً — فلا تتنازع العناصر على الأحداث.
// ════════════════════════════════════════════════════════════════════════════

const COLORS = ['#f6c343', '#ffffff', '#60a5fa', '#34d399', '#f87171', '#c084fc', '#fb923c', '#22d3ee', '#a3e635', '#94a3b8'];
const SVG_HALF = 50000;
const SHAPE_KINDS = ['rect', 'roundrect', 'ellipse', 'diamond', 'triangle', 'star'];

const TOOLS = [
    { k: 'sel',    t: 'تحديد (V)',   icon: MousePointer2 },
    { k: 'pan',    t: 'تحريك (H)',   icon: Hand },
    { k: 'pen',    t: 'قلم (P)',     icon: Pen },
    { k: 'marker', t: 'مضيء (M)',    icon: Highlighter },
    { k: 'note',   t: 'ملاحظة (N)',  icon: StickyNote },
    { k: 'text',   t: 'نص (T)',      icon: Type },
    { k: 'shape',  t: 'شكل (R)',     icon: Square },
    { k: 'connector', t: 'موصّل (C)', icon: Spline },
    { k: 'arrow',  t: 'سهم (A)',     icon: ArrowUpRight },
    { k: 'line',   t: 'خط (L)',      icon: Minus },
    { k: 'frame',  t: 'إطار (F)',    icon: Frame },
    { k: 'comment',t: 'تعليق',       icon: MessageCircle },
    { k: 'erase',  t: 'ممحاة (E)',   icon: Eraser },
];
const SHAPE_ICONS = { rect: Square, roundrect: Square, ellipse: Circle, diamond: Diamond, triangle: Triangle, star: Star };

// readOnly: للضيف غير المأذون له بالرسم — يرى ويتنقّل ويكبّر فقط
export default function MeetBoard({ boardId, userName, dense, guestToken, readOnly }) {
    const B = useBoard(boardId, { guestToken });
    const { items } = B;

    const [tool, setTool]   = useState(readOnly ? 'pan' : 'sel');
    const [shape, setShape] = useState('rect');
    const [style, setStyle] = useState({ color: '#f6c343', fill: 'none', sw: 3, dash: '', size: 22 });
    const [sel, setSel]     = useState([]);
    const [edit, setEdit]   = useState(null);
    const [view, setView]   = useState({ x: 0, y: 0, k: 1 });
    const [draft, setDraft] = useState(null);
    const [marquee, setMarquee] = useState(null);
    const [guides, setGuides]   = useState([]);
    const [snapOn, setSnapOn]   = useState(true);
    const [gridOn, setGridOn]   = useState(false);
    const [menu, setMenu]       = useState(null);
    const [panel, setPanel]     = useState(null);   // colors | templates | search | export
    const [query, setQuery]     = useState('');
    const [showMap, setShowMap] = useState(!dense);
    const [note, setNote]       = useState('');     // رسالة عابرة أعلى اللوح

    const wrap = useRef(null);
    const file = useRef(null);
    const g    = useRef(null);            // الحركة الجارية
    const ptrs = useRef(new Map());
    const clip = useRef([]);
    const tap  = useRef({ t: 0, x: 0, y: 0 });   // النقرة السابقة — للنقر المزدوج واللمس المزدوج
    const viewR = useRef(view); viewR.current = view;
    const itemsR = useRef(items); itemsR.current = items;
    const selR = useRef(sel); selR.current = sel;
    const toolR = useRef(tool); toolR.current = tool;

    const list = useMemo(() => Object.values(items).sort((a, b) => (a.z || 0) - (b.z || 0)), [items]);
    const selItems = useMemo(() => sel.map(id => items[id]).filter(Boolean), [sel, items]);
    const selBox = useMemo(() => (selItems.length ? groupBounds(selItems) : null), [selItems]);
    const single = selItems.length === 1 ? selItems[0] : null;
    const flash = m => { setNote(m); setTimeout(() => setNote(''), 2600); };

    // ─── إحداثيات ───────────────────────────────────────────────────────────
    const toWorld = useCallback((cx, cy) => {
        const r = wrap.current.getBoundingClientRect();
        const v = viewR.current;
        return { x: (cx - r.left - v.x) / v.k, y: (cy - r.top - v.y) / v.k };
    }, []);

    const zoomAt = useCallback((cx, cy, f) => {
        setView(v => {
            const k = Math.min(6, Math.max(0.08, v.k * f));
            const r = wrap.current.getBoundingClientRect();
            const px = cx - r.left, py = cy - r.top;
            return { k, x: px - ((px - v.x) / v.k) * k, y: py - ((py - v.y) / v.k) * k };
        });
    }, []);

    const focusBox = useCallback((box, margin) => {
        if (!box) return;
        const r = wrap.current.getBoundingClientRect();
        const m = margin || 80;
        const k = Math.min(3, Math.max(0.08, Math.min((r.width - m) / Math.max(40, box.w), (r.height - m) / Math.max(40, box.h))));
        setView({ k, x: r.width / 2 - (box.x + box.w / 2) * k, y: r.height / 2 - (box.y + box.h / 2) * k });
    }, []);

    const fit = () => focusBox(groupBounds(list) || { x: -300, y: -200, w: 600, h: 400 });

    // ─── إنشاء ──────────────────────────────────────────────────────────────
    const nextZ = () => (list.length ? Math.max(...list.map(i => i.z || 0)) + 1 : 1);
    const mk = (kind, data, z) => ({ id: uid(), kind, z: z || nextZ(), data });

    const addAt = (kind, p) => {
        let it = null;
        if (kind === 'note')
            it = mk('note', { x: p.x - 85, y: p.y - 60, w: 170, h: 120, text: '', color: style.color });
        else if (kind === 'text')
            it = mk('text', { x: p.x - 110, y: p.y - 16, w: 220, h: 34, text: '', size: style.size, color: style.color });
        else if (kind === 'comment')
            it = mk('comment', { x: p.x, y: p.y, w: 28, h: 28, text: '', by: userName, at: new Date().toISOString().slice(0, 16).replace('T', ' ') });
        if (!it) return;
        B.commit(it);
        setSel([it.id]); setEdit(it.id); setTool('sel');
    };

    const dropTemplate = t => {
        const r = wrap.current.getBoundingClientRect();
        const p = toWorld(r.left + r.width / 2 - 300, r.top + r.height / 2 - 220);
        const built = t.build(p.x, p.y);
        const z0 = nextZ();
        built.forEach((b, i) => { b.z = z0 + i; });
        B.commit(built);
        setSel(built.map(b => b.id));
        setPanel(null);
        flash('أُضيف قالب «' + t.name + '»');
    };

    // ─── صور ────────────────────────────────────────────────────────────────
    const placeImage = useCallback(async (f, at) => {
        try {
            const url = await B.upload(f);
            const im = new Image();
            im.onload = () => {
                const k = Math.min(1, 520 / Math.max(im.width, im.height));
                const w = im.width * k, h = im.height * k;
                const it = mk('image', { x: at.x - w / 2, y: at.y - h / 2, w, h, src: url });
                B.commit(it); setSel([it.id]);
            };
            im.src = url;
        } catch (e) { flash(e.message || 'تعذّر رفع الصورة'); }
    }, [B]);

    useEffect(() => {
        const onPaste = e => {
            const f = Array.from(e.clipboardData?.files || [])[0];
            if (f && f.type.startsWith('image/')) {
                const r = wrap.current.getBoundingClientRect();
                placeImage(f, toWorld(r.left + r.width / 2, r.top + r.height / 2));
                return;
            }
            // لصق عناصر منسوخة داخل السبورة نفسها
            if (clip.current.length && !edit) pasteClip();
        };
        window.addEventListener('paste', onPaste);
        return () => window.removeEventListener('paste', onPaste);
    });

    const onDrop = e => {
        e.preventDefault();
        const f = Array.from(e.dataTransfer.files || [])[0];
        if (f && f.type.startsWith('image/')) placeImage(f, toWorld(e.clientX, e.clientY));
    };

    // ─── نسخ ولصق ───────────────────────────────────────────────────────────
    const copySel = () => { clip.current = selItems.map(i => JSON.parse(JSON.stringify(i))); flash(selItems.length + ' عنصر في الحافظة'); };
    const pasteClip = (offset) => {
        if (!clip.current.length) return;
        const map = {};
        const z0 = nextZ();
        const off = offset || 24;
        const out = clip.current.map((it, i) => {
            const nid = uid(); map[it.id] = nid;
            return { ...it, id: nid, z: z0 + i, data: { ...it.data } };
        });
        // الموصّلات المنسوخة تُعاد ربطها بالنسخ الجديدة لا بالأصول
        for (const it of out) {
            const d = it.data;
            if (d.from && map[d.from.id]) d.from = { ...d.from, id: map[d.from.id] };
            if (d.to && map[d.to.id]) d.to = { ...d.to, id: map[d.to.id] };
        }
        const moved = out.map(it => moveItem(it, off, off));
        B.commit(moved);
        setSel(moved.map(i => i.id));
    };
    const duplicate = () => { copySel(); setTimeout(() => pasteClip(24), 0); };

    // ─── تعديل الخصائص ──────────────────────────────────────────────────────
    const patchSel = patch => {
        if (!selItems.length) return;
        B.commit(selItems.map(it => ({ id: it.id, before: it, after: { ...it, data: { ...it.data, ...patch } } })));
    };
    const zOrder = how => {
        if (!selItems.length) return;
        const zs = list.map(i => i.z || 0);
        const top = Math.max(0, ...zs), bot = Math.min(0, ...zs);
        B.commit(selItems.map((it, i) => ({ id: it.id, before: it,
            after: { ...it, z: how === 'front' ? top + 1 + i : how === 'back' ? bot - 1 - i
                : (it.z || 0) + (how === 'up' ? 1 : -1) } })));
    };
    const align = how => {
        if (selItems.length < 2 || !selBox) return;
        B.commit(selItems.map(it => {
            const d = alignDelta(it, selBox, how);
            return { id: it.id, before: it, after: moveItem(it, d.dx, d.dy) };
        }));
    };
    const toggleLock = () => {
        const lock = !selItems.every(i => i.data && i.data.locked);
        patchSel({ locked: lock ? 1 : 0 });
        flash(lock ? 'قُفلت العناصر' : 'فُتح القفل');
    };
    const delSel = () => { if (selItems.length) { B.remove(selItems.filter(i => !(i.data && i.data.locked))); setSel([]); } };

    // ─── الحركة ─────────────────────────────────────────────────────────────
    const pickAt = p => {
        const arr = list.slice().reverse();
        return arr.find(it => !(it.data && it.data.locked) && hitTest(it, p, 6 / view.k)) || null;
    };

    const handleHit = p => {
        if (!selBox || !selItems.length) return null;
        const r = 9 / view.k;
        const deg = single && isBoxy(single.kind) ? (single.data.rot || 0) : 0;
        const base = single && isBoxy(single.kind) ? rawBounds(single) : selBox;
        const hp = handlePoints(base, deg);
        for (const k of Object.keys(hp))
            if (Math.hypot(hp[k].x - p.x, hp[k].y - p.y) <= r) return { key: k, base, deg };
        return null;
    };

    const down = e => {
        if (e.button === 2) return;                              // اليمين لقائمة السياق
        setMenu(null); setPanel(null);
        ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (ptrs.current.size === 2) {
            const [a, b] = Array.from(ptrs.current.values());
            g.current = { mode: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), v: viewR.current };
            return;
        }
        wrap.current.setPointerCapture(e.pointerId);
        const p = toWorld(e.clientX, e.clientY);
        const T = readOnly ? 'pan' : toolR.current;

        // حدث dblclick لا يصل بعد أسر المؤشّر، ولا وجود له في اللمس أصلاً،
        // فنكشف النقرتين بأنفسنا: زمنٌ قريب وموضعٌ لم يتزحزح.
        const now = Date.now();
        const isDouble = now - tap.current.t < 350
            && Math.abs(e.clientX - tap.current.x) < 10 && Math.abs(e.clientY - tap.current.y) < 10;
        tap.current = { t: now, x: e.clientX, y: e.clientY };
        if (isDouble && T === 'sel') { g.current = { mode: 'dbl', p }; return; }

        if (T === 'pan' || e.button === 1 || e.altKey) { g.current = { mode: 'pan', sx: e.clientX, sy: e.clientY, v: view }; return; }

        if (T === 'sel') {
            const h = handleHit(p);
            if (h) {
                const orig = {}; selItems.forEach(i => { orig[i.id] = i; });
                g.current = h.key === 'rotate'
                    ? { mode: 'rotate', orig, center: { x: h.base.x + h.base.w / 2, y: h.base.y + h.base.h / 2 }, start: p, deg0: h.deg }
                    : { mode: 'resize', orig, key: h.key, base: h.base, group: !single };
                return;
            }
            const under = pickAt(p);
            if (under) {
                let nx = sel;
                if (e.shiftKey) nx = sel.includes(under.id) ? sel.filter(i => i !== under.id) : sel.concat(under.id);
                else if (!sel.includes(under.id)) nx = [under.id];
                setSel(nx);
                const orig = {}; nx.forEach(id => { if (items[id]) orig[id] = items[id]; });
                g.current = { mode: 'move', orig, start: p, moved: false };
            } else {
                if (!e.shiftKey) setSel([]);
                g.current = { mode: 'marquee', start: p, add: e.shiftKey ? sel : [] };
                setMarquee({ x: p.x, y: p.y, w: 0, h: 0 });
            }
            return;
        }

        if (T === 'erase') { g.current = { mode: 'erase', hit: [] }; eraseAt(p); return; }
        if (T === 'note' || T === 'text' || T === 'comment') { g.current = { mode: 'create', kind: T, p }; return; }
        if (T === 'pen' || T === 'marker') {
            g.current = { mode: 'pen' };
            setDraft(mk('pen', { pts: [[p.x, p.y]], color: style.color, w: T === 'marker' ? 18 : style.sw, marker: T === 'marker' ? 1 : 0 }));
            return;
        }
        if (T === 'connector') {
            const from = pickAt(p);
            g.current = { mode: 'seg', connector: true, from };
            setDraft(mk('connector', { x1: p.x, y1: p.y, x2: p.x, y2: p.y, color: style.color, w: style.sw, curve: 1,
                from: from ? { id: from.id, anchor: nearestAnchor(from, p).anchor } : null }));
            return;
        }
        if (T === 'arrow' || T === 'line') {
            g.current = { mode: 'seg' };
            setDraft(mk(T, { x1: p.x, y1: p.y, x2: p.x, y2: p.y, color: style.color, w: style.sw, dash: style.dash }));
            return;
        }
        if (T === 'frame') {
            g.current = { mode: 'box', p, kind: 'frame' };
            setDraft(mk('frame', { x: p.x, y: p.y, w: 0, h: 0, title: 'إطار', color: '#64748b' }));
            return;
        }
        g.current = { mode: 'box', p, kind: shape };
        setDraft(mk(shape, { x: p.x, y: p.y, w: 0, h: 0, color: style.color, fill: style.fill, sw: style.sw, dash: style.dash, text: '' }));
    };

    const eraseAt = p => {
        const u = pickAt(p);
        if (u) { B.remove(u); }
    };

    const move = e => {
        const p = toWorld(e.clientX, e.clientY);
        B.setCursor(p.x, p.y, toolR.current, selR.current.length);
        if (ptrs.current.has(e.pointerId)) ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const gg = g.current;
        if (!gg) return;

        if (gg.mode === 'pinch') {
            if (ptrs.current.size < 2) return;
            const [a, b] = Array.from(ptrs.current.values());
            const f = Math.hypot(a.x - b.x, a.y - b.y) / (gg.d || 1);
            const r = wrap.current.getBoundingClientRect();
            const cx = (a.x + b.x) / 2 - r.left, cy = (a.y + b.y) / 2 - r.top;
            const k = Math.min(6, Math.max(0.08, gg.v.k * f));
            setView({ k, x: cx - ((cx - gg.v.x) / gg.v.k) * k, y: cy - ((cy - gg.v.y) / gg.v.k) * k });
            return;
        }
        if (gg.mode === 'pan') { setView({ k: gg.v.k, x: gg.v.x + (e.clientX - gg.sx), y: gg.v.y + (e.clientY - gg.sy) }); return; }
        if (gg.mode === 'erase') { eraseAt(p); return; }

        if (gg.mode === 'marquee') {
            const r = { x: Math.min(gg.start.x, p.x), y: Math.min(gg.start.y, p.y),
                w: Math.abs(p.x - gg.start.x), h: Math.abs(p.y - gg.start.y) };
            setMarquee(r);
            const inside = list.filter(it => insideRect(it, r)).map(i => i.id);
            setSel(Array.from(new Set(gg.add.concat(inside))));
            return;
        }

        if (gg.mode === 'move') {
            let dx = p.x - gg.start.x, dy = p.y - gg.start.y;
            const ids = Object.keys(gg.orig);
            if (snapOn && ids.length) {
                const box = groupBounds(ids.map(i => gg.orig[i]));
                const others = list.filter(i => ids.indexOf(i.id) < 0 && i.kind !== 'pen').map(aabb).filter(Boolean);
                const s = snapMove({ ...box, x: box.x + dx, y: box.y + dy }, others, view.k, gridOn ? 20 : 0);
                dx += s.dx; dy += s.dy;
                setGuides(s.guides);
            }
            gg.moved = Math.abs(dx) + Math.abs(dy) > 0.5;
            gg.last = ids.map(i => moveItem(gg.orig[i], dx, dy));
            B.preview(gg.last);
            return;
        }

        if (gg.mode === 'resize') {
            const ids = Object.keys(gg.orig);
            if (!gg.group) {
                const it = gg.orig[ids[0]];
                gg.last = [resizeItem(it, gg.key, p, e.shiftKey)];
            } else {
                const b = gg.base, key = gg.key;
                const fx = key.indexOf('w') >= 0 ? b.x + b.w : b.x;
                const fy = key.indexOf('n') >= 0 ? b.y + b.h : b.y;
                let sx = key.indexOf('w') >= 0 ? (fx - p.x) / (b.w || 1) : key.indexOf('e') >= 0 ? (p.x - fx) / (b.w || 1) : 1;
                let sy = key.indexOf('n') >= 0 ? (fy - p.y) / (b.h || 1) : key.indexOf('s') >= 0 ? (p.y - fy) / (b.h || 1) : 1;
                sx = Math.max(0.05, sx); sy = Math.max(0.05, sy);
                if (e.shiftKey) { const m = Math.max(sx, sy); sx = m; sy = m; }
                gg.last = ids.map(i => scaleItem(gg.orig[i], { x: fx, y: fy }, sx, sy));
            }
            B.preview(gg.last);
            return;
        }

        if (gg.mode === 'rotate') {
            const a0 = Math.atan2(gg.start.y - gg.center.y, gg.start.x - gg.center.x);
            const a1 = Math.atan2(p.y - gg.center.y, p.x - gg.center.x);
            let deg = ((a1 - a0) * 180) / Math.PI;
            if (e.shiftKey) deg = Math.round(deg / 15) * 15;
            gg.last = Object.keys(gg.orig).map(i => rotateItem(gg.orig[i], deg, gg.center));
            B.preview(gg.last);
            return;
        }

        if (gg.mode === 'pen') { setDraft(d => d && { ...d, data: { ...d.data, pts: d.data.pts.concat([[p.x, p.y]]) } }); return; }

        if (gg.mode === 'seg') {
            let to = null;
            if (gg.connector) {
                const u = pickAt(p);
                if (u && (!gg.from || u.id !== gg.from.id)) to = { id: u.id, anchor: nearestAnchor(u, p).anchor };
            }
            setDraft(d => d && { ...d, data: { ...d.data, x2: p.x, y2: p.y, to } });
            return;
        }

        if (gg.mode === 'box') {
            let w = Math.abs(p.x - gg.p.x), h = Math.abs(p.y - gg.p.y);
            if (e.shiftKey) { const m = Math.max(w, h); w = m; h = m; }
            setDraft(d => d && { ...d, data: { ...d.data, x: Math.min(gg.p.x, p.x), y: Math.min(gg.p.y, p.y), w, h } });
        }
    };

    const up = e => {
        ptrs.current.delete(e.pointerId);
        const gg = g.current;
        g.current = null;
        setGuides([]);
        setMarquee(null);
        if (!gg) return;

        if (gg.mode === 'create') { addAt(gg.kind, gg.p); return; }
        if (gg.mode === 'dbl') {
            const u = pickAt(gg.p);
            if (u && (u.kind === 'comment' || u.kind === 'note' || u.kind === 'text' || isBoxy(u.kind))) {
                setSel([u.id]); setEdit(u.id);
            } else if (!u) addAt('note', gg.p);
            return;
        }

        if ((gg.mode === 'move' || gg.mode === 'resize' || gg.mode === 'rotate') && gg.last) {
            if (gg.mode !== 'move' || gg.moved)
                B.commit(gg.last.map(it => ({ id: it.id, before: gg.orig[it.id], after: it })));
            return;
        }
        if (!draft) return;
        const d = draft;
        setDraft(null);
        if (d.kind === 'pen') { if ((d.data.pts || []).length > 1) B.commit(d); return; }
        if (isSeg(d.kind)) {
            const len = Math.hypot(d.data.x2 - d.data.x1, d.data.y2 - d.data.y1);
            if (len > 8) { B.commit(d); setSel([d.id]); }
            return;
        }
        if (d.data.w < 6 && d.data.h < 6) {
            // نقرة مجرّدة بأداة شكل: شكلٌ بمقاس افتراضي، كما تفعل اللوحات المعروفة
            const nd = { ...d, data: { ...d.data, w: 160, h: 110, x: d.data.x - 80, y: d.data.y - 55 } };
            B.commit(nd); setSel([nd.id]); setTool('sel');
            return;
        }
        B.commit(d); setSel([d.id]);
        if (d.kind !== 'frame') setTool('sel');
    };

    const wheel = e => {
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.1 : 0.9); return; }
        setView(v => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };

    const context = e => {
        e.preventDefault();
        if (readOnly) return;
        const p = toWorld(e.clientX, e.clientY);
        const u = pickAt(p);
        if (u && !sel.includes(u.id)) setSel([u.id]);
        const r = wrap.current.getBoundingClientRect();
        setMenu({ x: e.clientX - r.left, y: e.clientY - r.top, on: !!u });
    };

    // ─── لوحة المفاتيح ──────────────────────────────────────────────────────
    useEffect(() => {
        const onKey = e => {
            if (readOnly) return;
            const t = (e.target.tagName || '').toLowerCase();
            if (t === 'input' || t === 'textarea') {
                if (e.key === 'Escape') e.target.blur();
                return;
            }
            const meta = e.ctrlKey || e.metaKey;
            if (meta && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? B.redo() : B.undo(); return; }
            if (meta && e.key.toLowerCase() === 'y') { e.preventDefault(); B.redo(); return; }
            if (meta && e.key.toLowerCase() === 'a') { e.preventDefault(); setSel(list.filter(i => !(i.data && i.data.locked)).map(i => i.id)); return; }
            if (meta && e.key.toLowerCase() === 'c') { copySel(); return; }
            if (meta && e.key.toLowerCase() === 'x') { copySel(); delSel(); return; }
            if (meta && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(); return; }
            if (meta && e.key.toLowerCase() === 'l') { e.preventDefault(); toggleLock(); return; }
            if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); delSel(); return; }
            if (e.key === 'Escape') { setSel([]); setEdit(null); setPanel(null); setMenu(null); return; }
            if (e.key === 'Enter' && single) { setEdit(single.id); return; }
            if (e.key.startsWith('Arrow') && selItems.length) {
                e.preventDefault();
                const step = e.shiftKey ? 20 : 2;
                const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
                const dy = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0;
                B.commit(selItems.map(it => ({ id: it.id, before: it, after: moveItem(it, dx, dy) })));
                return;
            }
            if (e.key === ']') { zOrder('front'); return; }
            if (e.key === '[') { zOrder('back'); return; }
            const map = { v: 'sel', h: 'pan', p: 'pen', m: 'marker', n: 'note', t: 'text', r: 'shape',
                c: 'connector', a: 'arrow', l: 'line', f: 'frame', e: 'erase' };
            const k = map[e.key.toLowerCase()];
            if (k) setTool(k);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    // ─── التصدير ────────────────────────────────────────────────────────────
    const doExport = async what => {
        setPanel(null);
        let src = list, area = null, name = null;
        if (what === 'sel') { if (!selItems.length) { flash('لا تحديد'); return; } src = selItems; }
        if (what === 'frame') {
            const fr = single && single.kind === 'frame' ? single : list.find(i => i.kind === 'frame' && sel.includes(i.id));
            if (!fr) { flash('اختر إطاراً أولاً'); return; }
            area = rawBounds(fr);
            src = list.filter(i => { const b = aabb(i); return b && b.x >= area.x - 4 && b.y >= area.y - 4 && b.x + b.w <= area.x + area.w + 4 && b.y + b.h <= area.y + area.h + 4; });
            name = (fr.data.title || 'إطار');
        }
        if (!src.length) { flash('لا شيء للتصدير'); return; }
        const cv = await exportImage(src, area, {});
        if (cv) download(cv, name);
    };

    // ─── البحث ──────────────────────────────────────────────────────────────
    const hits = useMemo(() => {
        const q = query.trim();
        if (!q) return [];
        return list.filter(i => ((i.data && (i.data.text || i.data.title)) || '').indexOf(q) >= 0).slice(0, 30);
    }, [query, list]);

    // ─── الخريطة المصغّرة ───────────────────────────────────────────────────
    const mapBox = useMemo(() => {
        const b = groupBounds(list);
        if (!b) return null;
        const pad = Math.max(b.w, b.h) * 0.15 + 100;
        return { x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 };
    }, [list]);

    const MAP_W = 176, MAP_H = 118;
    const mapK = mapBox ? Math.min(MAP_W / mapBox.w, MAP_H / mapBox.h) : 1;
    const viewport = () => {
        if (!wrap.current) return null;
        const r = wrap.current.getBoundingClientRect();
        return { x: -view.x / view.k, y: -view.y / view.k, w: r.width / view.k, h: r.height / view.k };
    };

    // ─── الواجهة ────────────────────────────────────────────────────────────
    const btn = on => 'w-9 h-9 rounded-xl flex items-center justify-center transition shrink-0 ' +
        (on ? 'bg-gold-500 text-slate-900' : 'bg-white/10 text-slate-200 hover:bg-white/20');
    const sbtn = 'px-2.5 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-[11px] font-bold flex items-center gap-1 shrink-0';
    const ShapeIcon = SHAPE_ICONS[shape] || Square;
    const hp = selBox ? handlePoints(single && isBoxy(single.kind) ? rawBounds(single) : selBox,
        single && isBoxy(single.kind) ? (single.data.rot || 0) : 0) : null;
    const K = view.k;
    const showStyle = selItems.length > 0 || ['pen', 'marker', 'shape', 'arrow', 'line', 'connector', 'note', 'text'].indexOf(tool) >= 0;

    return (
        <div className="absolute inset-0 overflow-hidden bg-[#0f172a] select-none" dir="ltr"
            onDrop={onDrop} onDragOver={e => e.preventDefault()}>

            <div ref={wrap} className="absolute inset-0 touch-none"
                style={{ cursor: tool === 'pan' ? 'grab' : tool === 'sel' ? 'default' : 'crosshair',
                    backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.09) 1px, transparent 1px)',
                    backgroundSize: (26 * K) + 'px ' + (26 * K) + 'px',
                    backgroundPosition: view.x + 'px ' + view.y + 'px' }}
                onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
                onWheel={wheel} onContextMenu={context}>

                <div className="absolute top-0 left-0 origin-top-left"
                    style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${K})` }}>

                    <svg className="absolute pointer-events-none"
                        style={{ left: -SVG_HALF, top: -SVG_HALF, width: SVG_HALF * 2, height: SVG_HALF * 2 }}
                        viewBox={`${-SVG_HALF} ${-SVG_HALF} ${SVG_HALF * 2} ${SVG_HALF * 2}`}>
                        {list.map(it => <g key={it.id}><Shape it={it} byId={items} /></g>)}
                        {draft ? <Shape it={draft} byId={items} ghost /> : null}

                        {/* أدلّة المحاذاة */}
                        {guides.map((gd, i) => (gd.v != null
                            ? <line key={i} x1={gd.v} y1={-SVG_HALF} x2={gd.v} y2={SVG_HALF} stroke="#f6c343" strokeWidth={1 / K} strokeDasharray={`${4 / K} ${4 / K}`} />
                            : <line key={i} x1={-SVG_HALF} y1={gd.h} x2={SVG_HALF} y2={gd.h} stroke="#f6c343" strokeWidth={1 / K} strokeDasharray={`${4 / K} ${4 / K}`} />))}

                        {/* مستطيل التحديد */}
                        {marquee ? <rect x={marquee.x} y={marquee.y} width={marquee.w} height={marquee.h}
                            fill="rgba(246,195,67,.10)" stroke="#f6c343" strokeWidth={1 / K} /> : null}

                        {/* إطار التحديد ومقابضه */}
                        {selBox && !edit ? (
                            <g>
                                {selItems.length > 1 ? selItems.map(it => {
                                    const b = aabb(it);
                                    return b ? <rect key={it.id} x={b.x} y={b.y} width={b.w} height={b.h} fill="none"
                                        stroke="#f6c343" strokeWidth={0.8 / K} opacity="0.5" /> : null;
                                }) : null}
                                {(() => {
                                    const base = single && isBoxy(single.kind) ? rawBounds(single) : selBox;
                                    const deg = single && isBoxy(single.kind) ? (single.data.rot || 0) : 0;
                                    const cx = base.x + base.w / 2, cy = base.y + base.h / 2;
                                    return (
                                        <g transform={deg ? `rotate(${deg} ${cx} ${cy})` : undefined}>
                                            <rect x={base.x} y={base.y} width={base.w} height={base.h}
                                                fill="none" stroke="#f6c343" strokeWidth={1.4 / K} />
                                            <line x1={cx} y1={base.y} x2={cx} y2={base.y - 28 / K} stroke="#f6c343" strokeWidth={1.2 / K} />
                                        </g>
                                    );
                                })()}
                                {Object.keys(hp).map(k => (
                                    <circle key={k} cx={hp[k].x} cy={hp[k].y} r={(k === 'rotate' ? 6 : 5) / K}
                                        fill={k === 'rotate' ? '#0f172a' : '#f6c343'} stroke="#f6c343" strokeWidth={1.6 / K} />
                                ))}
                            </g>
                        ) : null}

                        {/* مؤشّرات الحاضرين */}
                        {B.peers.map(p => (
                            <g key={p.uid} transform={`translate(${p.x} ${p.y}) scale(${1 / K})`} opacity="0.95">
                                <path d="M0 0 L0 17 L4.5 12.5 L7.5 19 L10 18 L7 11.5 L13 11 Z" fill={p.color} stroke="#0f172a" strokeWidth="1" />
                                <rect x="12" y="14" rx="4" width={Math.max(34, (p.name || '').length * 7 + 12)} height="17" fill={p.color} />
                                <text x="18" y="26" fontSize="11" fontWeight="800" fill="#0f172a"
                                    style={{ fontFamily: 'Cairo, sans-serif' }}>{p.name || 'زميل'}</text>
                            </g>
                        ))}
                    </svg>

                    {/* طبقة النصوص والتعليقات */}
                    {list.map(it => (
                        it.kind === 'comment' ? (
                            <div key={it.id} className="absolute" style={{ left: it.data.x, top: it.data.y }}>
                                <div className="rounded-full rounded-bl-none bg-gold-500 text-slate-900 text-[11px] font-black px-2 py-1 shadow-lg whitespace-nowrap"
                                    style={{ pointerEvents: 'none' }}>
                                    {edit === it.id ? '' : (it.data.text || 'تعليق') + ' · ' + (it.data.by || '')}
                                </div>
                                {edit === it.id ? (
                                    <textarea autoFocus defaultValue={it.data.text || ''} dir="auto"
                                        onBlur={e => { B.commit({ ...it, data: { ...it.data, text: e.target.value } }); setEdit(null); }}
                                        className="absolute top-0 left-0 w-56 h-20 rounded-xl bg-slate-900 text-white text-[12px] p-2 outline outline-2 outline-gold-500 resize-none" />
                                ) : null}
                            </div>
                        ) : (
                            <TextBox key={it.id} it={it} editing={edit === it.id}
                                onCancel={() => setEdit(null)}
                                onCommit={v => {
                                    setEdit(null);
                                    const key = it.kind === 'frame' ? 'title' : 'text';
                                    if (v !== (it.data[key] || '')) B.commit({ ...it, data: { ...it.data, [key]: v } });
                                }} />
                        )
                    ))}
                </div>
            </div>

            {/* ── شريط الأدوات ── */}
            {!readOnly ? <div dir="rtl" className={'absolute z-20 flex gap-1.5 bg-slate-900/92 backdrop-blur border border-white/10 rounded-2xl p-1.5 shadow-2xl ' +
                (dense ? 'inset-x-2 overflow-x-auto no-scrollbar' : 'top-1/2 -translate-y-1/2 right-3 flex-col max-h-[86vh] overflow-y-auto no-scrollbar')}
                style={dense ? { bottom: 'calc(env(safe-area-inset-bottom) + 12px)' } : undefined}>
                {TOOLS.map(t => {
                    const I = t.k === 'shape' ? ShapeIcon : t.icon;
                    return (
                        <button key={t.k} title={t.t}
                            onClick={() => { if (t.k === 'shape' && tool === 'shape') { const i = SHAPE_KINDS.indexOf(shape); setShape(SHAPE_KINDS[(i + 1) % SHAPE_KINDS.length]); } setTool(t.k); setEdit(null); }}
                            className={btn(tool === t.k)}><I size={17} /></button>
                    );
                })}
                <button title="صورة" onClick={() => file.current.click()} className={btn(false)}><ImageIcon size={17} /></button>
                <div className={dense ? 'w-px bg-white/15 mx-0.5 shrink-0' : 'h-px bg-white/15 my-0.5'} />
                <button title="تراجع (Ctrl+Z)" onClick={B.undo} disabled={!B.canUndo} className={btn(false) + ' disabled:opacity-30'}><Undo2 size={17} /></button>
                <button title="إعادة (Ctrl+Y)" onClick={B.redo} disabled={!B.canRedo} className={btn(false) + ' disabled:opacity-30'}><Redo2 size={17} /></button>
            </div> : null}
            <input ref={file} type="file" accept="image/*" className="hidden"
                onChange={e => { const f = e.target.files[0]; if (f) { const r = wrap.current.getBoundingClientRect(); placeImage(f, toWorld(r.left + r.width / 2, r.top + r.height / 2)); } e.target.value = ''; }} />

            {/* ── شريط الخصائص ── */}
            {showStyle ? (
                <div dir="rtl" className={'absolute z-20 flex items-center gap-1.5 bg-slate-900/92 backdrop-blur border border-white/10 rounded-2xl p-1.5 shadow-2xl overflow-x-auto no-scrollbar max-w-[92vw] ' +
                    (dense ? 'top-16 inset-x-3' : 'bottom-4 left-1/2 -translate-x-1/2')}>
                    {COLORS.slice(0, 8).map(c => (
                        <button key={c} onClick={() => { setStyle(s => ({ ...s, color: c })); patchSel({ color: c }); }}
                            className={'w-6 h-6 rounded-full border-2 shrink-0 ' + (style.color === c ? 'border-white' : 'border-white/20')}
                            style={{ background: c }} />
                    ))}
                    <span className="w-px h-6 bg-white/15 shrink-0" />
                    {[2, 4, 8].map(w => (
                        <button key={w} onClick={() => { setStyle(s => ({ ...s, sw: w })); patchSel({ sw: w, w }); }}
                            className={'w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ' + (style.sw === w ? 'bg-gold-500' : 'bg-white/10')}>
                            <span className="rounded-full" style={{ width: w + 3, height: w + 3, background: style.sw === w ? '#0f172a' : '#e2e8f0' }} />
                        </button>
                    ))}
                    <button onClick={() => { const d = style.dash ? '' : 'dash'; setStyle(s => ({ ...s, dash: d })); patchSel({ dash: d }); }}
                        className={'px-2 h-7 rounded-lg text-[11px] font-bold shrink-0 ' + (style.dash ? 'bg-gold-500 text-slate-900' : 'bg-white/10')}>متقطّع</button>
                    <button onClick={() => { const f = style.fill === 'none' ? style.color + '33' : 'none'; setStyle(s => ({ ...s, fill: f })); patchSel({ fill: f }); }}
                        className={'px-2 h-7 rounded-lg text-[11px] font-bold shrink-0 ' + (style.fill !== 'none' ? 'bg-gold-500 text-slate-900' : 'bg-white/10')}>تعبئة</button>

                    {selItems.length ? (
                        <>
                            <span className="w-px h-6 bg-white/15 shrink-0" />
                            <button title="للأمام (])" onClick={() => zOrder('front')} className={sbtn}><ChevronUp size={13} /></button>
                            <button title="للخلف ([)" onClick={() => zOrder('back')} className={sbtn}><ChevronDown size={13} /></button>
                            <button title="تكرار (Ctrl+D)" onClick={duplicate} className={sbtn}><Copy size={13} /></button>
                            <button title="قفل (Ctrl+L)" onClick={toggleLock} className={sbtn}>
                                {selItems.every(i => i.data && i.data.locked) ? <Lock size={13} /> : <Unlock size={13} />}
                            </button>
                            {selItems.length > 1 ? (
                                <>
                                    <button title="محاذاة لليسار" onClick={() => align('left')} className={sbtn}><AlignHorizontalJustifyStart size={13} /></button>
                                    <button title="محاذاة للأعلى" onClick={() => align('top')} className={sbtn}><AlignVerticalJustifyStart size={13} /></button>
                                </>
                            ) : null}
                            <button title="حذف" onClick={delSel} className="px-2.5 h-8 rounded-lg bg-red-600/80 hover:bg-red-600 text-[11px] font-bold shrink-0"><Trash2 size={13} /></button>
                        </>
                    ) : null}
                </div>
            ) : null}

            {/* ── الشريط العلوي ── */}
            <div dir="rtl" className="absolute top-3 right-3 left-3 z-20 flex items-start gap-1.5 flex-wrap pointer-events-none">
                {/* على الجوّال يكفي التكبير بالإصبعين، فنُبقي ما لا بديل عنه فقط */}
                <div className="flex gap-1.5 bg-slate-900/92 backdrop-blur border border-white/10 rounded-2xl p-1.5 pointer-events-auto">
                    {!dense ? <button title="تصغير" onClick={() => { const r = wrap.current.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 0.83); }} className={btn(false)}><ZoomOut size={16} /></button> : null}
                    <button onClick={() => setView(v => ({ ...v, k: 1 }))} className="px-1.5 self-center text-[11px] font-black text-slate-300 tabular-nums">{Math.round(K * 100)}%</button>
                    {!dense ? <button title="تكبير" onClick={() => { const r = wrap.current.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.2); }} className={btn(false)}><ZoomIn size={16} /></button> : null}
                    <button title="ملء الشاشة بالمحتوى" onClick={fit} className={btn(false)}><Maximize size={16} /></button>
                </div>
                <div className="flex gap-1.5 bg-slate-900/92 backdrop-blur border border-white/10 rounded-2xl p-1.5 pointer-events-auto">
                    <button title="قوالب" onClick={() => setPanel(p => (p === 'templates' ? null : 'templates'))} className={btn(panel === 'templates')}><LayoutTemplate size={16} /></button>
                    <button title="بحث" onClick={() => setPanel(p => (p === 'search' ? null : 'search'))} className={btn(panel === 'search')}><Search size={16} /></button>
                    <button title="تصدير" onClick={() => setPanel(p => (p === 'export' ? null : 'export'))} className={btn(panel === 'export')}><Download size={16} /></button>
                    {!dense ? <button title="التقاط ومحاذاة" onClick={() => setSnapOn(v => !v)} className={btn(snapOn)}><Magnet size={16} /></button> : null}
                    {!dense ? <button title="شبكة" onClick={() => setGridOn(v => !v)} className={btn(gridOn)}><Grid3x3 size={16} /></button> : null}
                    {!dense ? <button title="خريطة مصغّرة" onClick={() => setShowMap(v => !v)} className={btn(showMap)}><MapIcon size={16} /></button> : null}
                    <button title="مسح السبورة" onClick={async () => {
                        if (!window.confirm('مسح السبورة كاملة؟ تُعلَّم العناصر محذوفة ولا تُزال من سجل الخادم.')) return;
                        if (await B.clear()) { setSel([]); flash('مُسحت السبورة'); }
                    }} className={btn(false)}><Trash2 size={16} /></button>
                </div>
                <div className="ms-auto flex items-center gap-2 bg-slate-900/92 backdrop-blur border border-white/10 rounded-2xl px-2.5 py-2 pointer-events-auto">
                    {B.sync === 'busy' ? <Loader2 size={13} className="animate-spin text-gold-500" />
                        : <span className={'w-2 h-2 rounded-full ' + (B.sync === 'err' ? 'bg-red-500' : 'bg-emerald-500')} />}
                    <span className="text-[11px] font-bold text-slate-300">{list.length}{dense ? '' : ' عنصر'}</span>
                    {B.peers.length ? (
                        <span className="flex items-center gap-1 border-s border-white/10 ps-2">
                            {B.peers.slice(0, 4).map(p => (
                                <span key={p.uid} title={p.name}
                                    className="w-6 h-6 rounded-full text-[10px] font-black text-slate-900 flex items-center justify-center"
                                    style={{ background: p.color }}>{(p.name || '؟').slice(0, 1)}</span>
                            ))}
                        </span>
                    ) : <Users size={13} className="text-slate-500" />}
                </div>
            </div>

            {/* ── اللوحات المنبثقة ── */}
            {panel === 'templates' ? (
                <div dir="rtl" className="absolute top-16 right-3 z-30 w-64 bg-slate-900/96 backdrop-blur border border-white/10 rounded-2xl p-2 shadow-2xl space-y-1">
                    {TEMPLATES.map(t => (
                        <button key={t.key} onClick={() => dropTemplate(t)}
                            className="w-full text-right px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/10">
                            <div className="text-[13px] font-black text-white">{t.name}</div>
                            <div className="text-[11px] text-slate-400">{t.hint}</div>
                        </button>
                    ))}
                </div>
            ) : null}

            {panel === 'search' ? (
                <div dir="rtl" className="absolute top-16 right-3 z-30 w-64 bg-slate-900/96 backdrop-blur border border-white/10 rounded-2xl p-2 shadow-2xl">
                    <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="ابحث في نصوص اللوح"
                        className="w-full h-9 px-3 rounded-xl bg-white/[0.06] border border-white/10 text-[13px] outline-none text-white placeholder-slate-500" />
                    <div className="mt-1.5 max-h-56 overflow-y-auto space-y-1">
                        {hits.map(h => (
                            <button key={h.id} onClick={() => { setSel([h.id]); focusBox(aabb(h), 260); }}
                                className="w-full text-right px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-white/10 text-[12px] text-slate-200 truncate">
                                {(h.data.text || h.data.title || '').slice(0, 40)}
                            </button>
                        ))}
                        {query && !hits.length ? <p className="text-[12px] text-slate-500 text-center py-3">لا نتائج</p> : null}
                    </div>
                </div>
            ) : null}

            {panel === 'export' ? (
                <div dir="rtl" className="absolute top-16 right-3 z-30 w-52 bg-slate-900/96 backdrop-blur border border-white/10 rounded-2xl p-2 shadow-2xl space-y-1">
                    {[['all', 'السبورة كاملة'], ['sel', 'التحديد فقط'], ['frame', 'الإطار المحدَّد']].map(([k, t]) => (
                        <button key={k} onClick={() => doExport(k)}
                            className="w-full text-right px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/10 text-[13px] font-bold text-white">{t}</button>
                    ))}
                </div>
            ) : null}

            {/* ── قائمة السياق ── */}
            {menu ? (
                <div dir="rtl" className="absolute z-40 w-44 bg-slate-900/97 border border-white/10 rounded-xl p-1 shadow-2xl"
                    style={{ top: menu.y, left: Math.max(4, menu.x - 176) }} onMouseLeave={() => setMenu(null)}>
                    {menu.on ? (
                        <>
                            <MenuItem onClick={() => { setEdit(sel[0]); setMenu(null); }}>تحرير النص</MenuItem>
                            <MenuItem onClick={() => { duplicate(); setMenu(null); }}>تكرار</MenuItem>
                            <MenuItem onClick={() => { copySel(); setMenu(null); }}>نسخ</MenuItem>
                            <MenuItem onClick={() => { zOrder('front'); setMenu(null); }}>إلى الأمام</MenuItem>
                            <MenuItem onClick={() => { zOrder('back'); setMenu(null); }}>إلى الخلف</MenuItem>
                            <MenuItem onClick={() => { toggleLock(); setMenu(null); }}>قفل / فتح</MenuItem>
                            <MenuItem danger onClick={() => { delSel(); setMenu(null); }}>حذف</MenuItem>
                        </>
                    ) : (
                        <>
                            <MenuItem onClick={() => { pasteClip(); setMenu(null); }}>لصق</MenuItem>
                            <MenuItem onClick={() => { setSel(list.map(i => i.id)); setMenu(null); }}>تحديد الكل</MenuItem>
                            <MenuItem onClick={() => { fit(); setMenu(null); }}>ملء الشاشة بالمحتوى</MenuItem>
                        </>
                    )}
                </div>
            ) : null}

            {/* ── الخريطة المصغّرة ── */}
            {showMap && mapBox ? (
                <div dir="ltr" className="absolute bottom-3 left-3 z-20 rounded-xl border border-white/10 bg-slate-900/92 backdrop-blur p-1.5 shadow-2xl"
                    style={{ width: MAP_W + 12 }}>
                    <svg width={MAP_W} height={MAP_H} className="rounded-lg bg-slate-950/60 cursor-pointer"
                        onClick={e => {
                            const r = e.currentTarget.getBoundingClientRect();
                            const wx = mapBox.x + (e.clientX - r.left) / mapK, wy = mapBox.y + (e.clientY - r.top) / mapK;
                            const b = wrap.current.getBoundingClientRect();
                            setView(v => ({ ...v, x: b.width / 2 - wx * v.k, y: b.height / 2 - wy * v.k }));
                        }}>
                        <g transform={`scale(${mapK}) translate(${-mapBox.x} ${-mapBox.y})`}>
                            {list.map(it => {
                                const b = aabb(it);
                                if (!b) return null;
                                return <rect key={it.id} x={b.x} y={b.y} width={Math.max(2 / mapK, b.w)} height={Math.max(2 / mapK, b.h)}
                                    fill={it.kind === 'note' ? '#f6c343' : (it.data && it.data.color) || '#64748b'} opacity="0.7" />;
                            })}
                            {(() => { const v = viewport(); return v ? <rect x={v.x} y={v.y} width={v.w} height={v.h}
                                fill="rgba(246,195,67,.10)" stroke="#f6c343" strokeWidth={1.5 / mapK} /> : null; })()}
                        </g>
                    </svg>
                </div>
            ) : null}

            {note ? (
                <div dir="rtl" className="absolute top-16 left-1/2 -translate-x-1/2 z-40 px-3 py-1.5 rounded-xl bg-slate-900/95 border border-white/10 text-[12px] font-bold text-slate-200 shadow-xl">
                    {note}
                </div>
            ) : null}
        </div>
    );
}

function MenuItem({ children, onClick, danger }) {
    return (
        <button onClick={onClick}
            className={'w-full text-right px-3 py-1.5 rounded-lg text-[12px] font-bold ' +
                (danger ? 'text-red-300 hover:bg-red-500/15' : 'text-slate-200 hover:bg-white/10')}>
            {children}
        </button>
    );
}
