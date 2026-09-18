import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
    MousePointer2, Hand, Pen, Eraser, StickyNote, Square, Circle, Diamond,
    ArrowUpRight, Minus, Type, Undo2, Redo2, Download, Trash2, ZoomIn, ZoomOut,
    Crosshair, Users, Loader2,
} from 'lucide-react';
import { API_URL, getAdminToken } from '../../lib/api/client';

// ════════════════════════════════════════════════════════════════════════════
//  سبورة الاجتماع — لوح لا نهائي يعمل عليه الحاضرون معاً
//  ─────────────────────────────────────────────────────────────────────────
//  العناصر تُحفظ في الخادم عنصراً عنصراً، والمزامنة تجلب ما تغيّر بعد رقم
//  النسخة فقط. فمن يحرّك ملاحظة لا يمسح ما رسمه غيره، ولا نُرسل اللوح كاملاً
//  في كل حركة. التراجع محلّي: لكل عملية نقيضها محفوظ في مكدّس عند صاحبها.
// ════════════════════════════════════════════════════════════════════════════

const COLORS = ['#f6c343', '#ffffff', '#60a5fa', '#34d399', '#f87171', '#c084fc', '#fb923c', '#94a3b8'];
const NOTE_BG = { '#f6c343': '#f6c343', '#60a5fa': '#93c5fd', '#34d399': '#6ee7b7', '#f87171': '#fca5a5', '#c084fc': '#d8b4fe', '#fb923c': '#fdba74', '#ffffff': '#f1f5f9', '#94a3b8': '#cbd5e1' };

const TOOLS = [
    { k: 'sel',     t: 'تحديد',   icon: MousePointer2 },
    { k: 'pan',     t: 'تحريك',   icon: Hand },
    { k: 'pen',     t: 'قلم',     icon: Pen },
    { k: 'note',    t: 'ملاحظة',  icon: StickyNote },
    { k: 'text',    t: 'نص',      icon: Type },
    { k: 'rect',    t: 'مستطيل',  icon: Square },
    { k: 'ellipse', t: 'دائرة',   icon: Circle },
    { k: 'diamond', t: 'معيّن',   icon: Diamond },
    { k: 'arrow',   t: 'سهم',     icon: ArrowUpRight },
    { k: 'line',    t: 'خط',      icon: Minus },
    { k: 'erase',   t: 'ممحاة',   icon: Eraser },
];

const uid = () => 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const SVG_HALF = 50000;

// ─── الحدود الخارجية لعنصر، بإحداثيات اللوح ────────────────────────────────
function bounds(it) {
    const d = it.data || {};
    if (it.kind === 'pen') {
        const p = d.pts || [];
        if (!p.length) return null;
        let x1 = p[0][0], y1 = p[0][1], x2 = x1, y2 = y1;
        for (const [x, y] of p) { if (x < x1) x1 = x; if (y < y1) y1 = y; if (x > x2) x2 = x; if (y > y2) y2 = y; }
        return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 };
    }
    if (it.kind === 'arrow' || it.kind === 'line')
        return { x: Math.min(d.x1, d.x2), y: Math.min(d.y1, d.y2), w: Math.abs(d.x2 - d.x1), h: Math.abs(d.y2 - d.y1) };
    if (it.kind === 'text') return { x: d.x, y: d.y, w: d.w || 220, h: d.h || 40 };
    return { x: d.x, y: d.y, w: d.w || 0, h: d.h || 0 };
}

function hit(it, x, y, pad) {
    const b = bounds(it);
    if (!b) return false;
    const p = pad || 8;
    return x >= b.x - p && x <= b.x + b.w + p && y >= b.y - p && y <= b.y + b.h + p;
}

// تحريك عنصر بمقدار — كل نوع يُزاح بطريقته
function moved(it, dx, dy) {
    const d = { ...(it.data || {}) };
    if (it.kind === 'pen') d.pts = (d.pts || []).map(([x, y]) => [x + dx, y + dy]);
    else if (it.kind === 'arrow' || it.kind === 'line') { d.x1 += dx; d.y1 += dy; d.x2 += dx; d.y2 += dy; }
    else { d.x += dx; d.y += dy; }
    return { ...it, data: d };
}

export default function MeetBoard({ boardId, userName, dense }) {
    const [items, setItems]   = useState({});      // id → عنصر
    const [rev, setRev]       = useState(0);
    const [tool, setTool]     = useState('sel');
    const [color, setColor]   = useState('#f6c343');
    const [sel, setSel]       = useState(null);
    const [edit, setEdit]     = useState(null);    // معرّف العنصر الذي يُكتب فيه
    const [view, setView]     = useState({ x: 0, y: 0, k: 1 });
    const [draft, setDraft]   = useState(null);    // ما يُرسم الآن قبل حفظه
    const [sync, setSync]     = useState('idle');  // idle | busy | err
    const [peers, setPeers]   = useState([]);
    const [pal, setPal]       = useState(false);

    const wrap    = useRef(null);
    const pending = useRef(new Map());             // ما ينتظر الإرسال
    const gesture = useRef(null);
    const undoS   = useRef([]);
    const redoS   = useRef([]);
    const itemsR  = useRef({});
    const revR    = useRef(0);
    itemsR.current = items; revR.current = rev;

    const tk = () => getAdminToken();
    const hdr = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + tk() });

    // ─── المزامنة ───────────────────────────────────────────────────────────
    const absorb = useCallback(list => {
        if (!list || !list.length) return;
        setItems(prev => {
            const nx = { ...prev };
            for (const it of list) {
                if (it.deleted) delete nx[it.id];
                else nx[it.id] = { id: it.id, kind: it.kind, z: it.z, data: it.data || {}, by: it.updated_by };
            }
            return nx;
        });
        const names = list.map(i => i.updated_by).filter(n => n && n !== userName);
        if (names.length) setPeers(p => Array.from(new Set(p.concat(names))).slice(-4));
    }, [userName]);

    const pull = useCallback(async () => {
        if (!boardId) return;
        try {
            const r = await fetch(`${API_URL}?action=board_get&board=${encodeURIComponent(boardId)}&since=${revR.current}`,
                { headers: { Authorization: 'Bearer ' + tk() } }).then(x => x.json());
            if (r && r.success) {
                absorb(r.items);
                if (r.rev > revR.current) { revR.current = r.rev; setRev(r.rev); }
                setSync('idle');
            }
        } catch (e) { setSync('err'); }
    }, [boardId, absorb]);

    const flush = useCallback(async () => {
        if (!boardId || !pending.current.size) return;
        const batch = Array.from(pending.current.values());
        pending.current.clear();
        setSync('busy');
        try {
            const r = await fetch(`${API_URL}?action=board_save`, {
                method: 'POST', headers: hdr(), body: JSON.stringify({ board: boardId, items: batch }),
            }).then(x => x.json());
            // رقم النسخة يتقدّم بكتابتنا، فنتجاوز صدى عناصرنا في السحب التالي
            if (r && r.success && r.rev > revR.current) { revR.current = r.rev; setRev(r.rev); }
            setSync('idle');
        } catch (e) { setSync('err'); }
    }, [boardId]);

    useEffect(() => {
        if (!boardId) return;
        pull();
        const a = setInterval(pull, 2500);
        const b = setInterval(flush, 700);
        return () => { clearInterval(a); clearInterval(b); flush(); };
    }, [boardId, pull, flush]);

    // ─── الكتابة المحلّية ────────────────────────────────────────────────────
    const push = useCallback((it, del) => {
        pending.current.set(it.id, { id: it.id, kind: it.kind, z: it.z || 0, data: it.data, deleted: del ? 1 : 0 });
        setItems(prev => {
            const nx = { ...prev };
            if (del) delete nx[it.id]; else nx[it.id] = it;
            return nx;
        });
    }, []);

    // كل عملية تُسجَّل مع نقيضها فيمكن التراجع عنها
    const act = useCallback((it, del, before) => {
        undoS.current.push({ it, del: !!del, before: before === undefined ? itemsR.current[it.id] : before });
        if (undoS.current.length > 120) undoS.current.shift();
        redoS.current = [];
        push(it, del);
    }, [push]);

    const undo = () => {
        const e = undoS.current.pop();
        if (!e) return;
        redoS.current.push(e);
        if (e.before) push(e.before, false); else push(e.it, true);
        setSel(null);
    };
    const redo = () => {
        const e = redoS.current.pop();
        if (!e) return;
        undoS.current.push(e);
        push(e.it, e.del);
        setSel(null);
    };

    const clearAll = async () => {
        if (!window.confirm('مسح السبورة كاملة؟ يبقى ما مُسح في سجل الخادم ولا يُحذف نهائياً.')) return;
        try {
            const r = await fetch(`${API_URL}?action=board_clear`, {
                method: 'POST', headers: hdr(), body: JSON.stringify({ board: boardId }),
            }).then(x => x.json());
            if (r && r.success) { setItems({}); revR.current = r.rev; setRev(r.rev); setSel(null); }
        } catch (e) { setSync('err'); }
    };

    // ─── تحويل الإحداثيات ───────────────────────────────────────────────────
    const toWorld = useCallback((cx, cy) => {
        const b = wrap.current.getBoundingClientRect();
        return { x: (cx - b.left - view.x) / view.k, y: (cy - b.top - view.y) / view.k };
    }, [view]);

    const zoomAt = (cx, cy, factor) => {
        setView(v => {
            const k = Math.min(4, Math.max(0.15, v.k * factor));
            const b = wrap.current.getBoundingClientRect();
            const px = cx - b.left, py = cy - b.top;
            return { k, x: px - ((px - v.x) / v.k) * k, y: py - ((py - v.y) / v.k) * k };
        });
    };

    const fit = () => {
        const all = Object.values(items).map(bounds).filter(Boolean);
        if (!all.length) { setView({ x: 0, y: 0, k: 1 }); return; }
        const x1 = Math.min(...all.map(b => b.x)), y1 = Math.min(...all.map(b => b.y));
        const x2 = Math.max(...all.map(b => b.x + b.w)), y2 = Math.max(...all.map(b => b.y + b.h));
        const b = wrap.current.getBoundingClientRect();
        const k = Math.min(3, Math.max(0.15, Math.min((b.width - 60) / Math.max(40, x2 - x1), (b.height - 60) / Math.max(40, y2 - y1))));
        setView({ k, x: b.width / 2 - ((x1 + x2) / 2) * k, y: b.height / 2 - ((y1 + y2) / 2) * k });
    };

    // ─── اللمس والمؤشّر ─────────────────────────────────────────────────────
    const ptrs = useRef(new Map());

    const down = e => {
        if (edit) return;
        ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (ptrs.current.size === 2) {                         // إصبعان: تكبير وتحريك
            const [a, b] = Array.from(ptrs.current.values());
            gesture.current = { mode: 'pinch', d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k, view };
            return;
        }
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = toWorld(e.clientX, e.clientY);

        if (tool === 'pan' || (tool === 'sel' && e.button === 1)) {
            gesture.current = { mode: 'pan', sx: e.clientX, sy: e.clientY, v: view }; return;
        }
        if (tool === 'sel') {
            const under = Object.values(items).sort((a, b) => (b.z || 0) - (a.z || 0)).find(it => hit(it, p.x, p.y, 10));
            if (under) { setSel(under.id); gesture.current = { mode: 'move', id: under.id, p, orig: under, before: under }; }
            else { setSel(null); gesture.current = { mode: 'pan', sx: e.clientX, sy: e.clientY, v: view }; }
            return;
        }
        if (tool === 'erase') { gesture.current = { mode: 'erase' }; eraseAt(p); return; }
        if (tool === 'pen') { gesture.current = { mode: 'pen' }; setDraft({ id: uid(), kind: 'pen', data: { pts: [[p.x, p.y]], color, w: 3 } }); return; }
        if (tool === 'note') {
            const it = { id: uid(), kind: 'note', z: Date.now() % 100000,
                data: { x: p.x - 90, y: p.y - 60, w: 180, h: 120, text: '', color } };
            act(it); setSel(it.id); setEdit(it.id); setTool('sel'); return;
        }
        if (tool === 'text') {
            const it = { id: uid(), kind: 'text', z: Date.now() % 100000,
                data: { x: p.x, y: p.y - 14, w: 240, h: 34, text: '', color, size: 22 } };
            act(it); setSel(it.id); setEdit(it.id); setTool('sel'); return;
        }
        if (tool === 'arrow' || tool === 'line') {
            gesture.current = { mode: 'seg' };
            setDraft({ id: uid(), kind: tool, data: { x1: p.x, y1: p.y, x2: p.x, y2: p.y, color, w: 3 } }); return;
        }
        gesture.current = { mode: 'shape', p };
        setDraft({ id: uid(), kind: tool, data: { x: p.x, y: p.y, w: 0, h: 0, color, sw: 3 } });
    };

    const eraseAt = p => {
        const under = Object.values(itemsR.current).find(it => hit(it, p.x, p.y, 6));
        if (under) act(under, true);
    };

    const move = e => {
        if (ptrs.current.has(e.pointerId)) ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const g = gesture.current;
        if (!g) return;
        if (g.mode === 'pinch') {
            if (ptrs.current.size < 2) return;
            const [a, b] = Array.from(ptrs.current.values());
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            const f = d / (g.d || 1);
            setView(v => {
                const k = Math.min(4, Math.max(0.15, g.k * f));
                const r = wrap.current.getBoundingClientRect();
                const cx = (a.x + b.x) / 2 - r.left, cy = (a.y + b.y) / 2 - r.top;
                return { k, x: cx - ((cx - g.view.x) / g.view.k) * k, y: cy - ((cy - g.view.y) / g.view.k) * k };
            });
            return;
        }
        if (g.mode === 'pan') {
            setView({ k: g.v.k, x: g.v.x + (e.clientX - g.sx), y: g.v.y + (e.clientY - g.sy) });
            return;
        }
        const p = toWorld(e.clientX, e.clientY);
        if (g.mode === 'erase') { eraseAt(p); return; }
        if (g.mode === 'move') {
            const cur = itemsR.current[g.id];
            if (!cur) return;
            const nx = moved(g.orig, p.x - g.p.x, p.y - g.p.y);
            setItems(prev => ({ ...prev, [g.id]: nx }));
            g.last = nx;
            return;
        }
        if (g.mode === 'pen') {
            setDraft(d => d && { ...d, data: { ...d.data, pts: d.data.pts.concat([[p.x, p.y]]) } });
            return;
        }
        if (g.mode === 'seg') { setDraft(d => d && { ...d, data: { ...d.data, x2: p.x, y2: p.y } }); return; }
        if (g.mode === 'shape') {
            setDraft(d => d && { ...d, data: { ...d.data,
                x: Math.min(g.p.x, p.x), y: Math.min(g.p.y, p.y),
                w: Math.abs(p.x - g.p.x), h: Math.abs(p.y - g.p.y) } });
        }
    };

    const up = e => {
        ptrs.current.delete(e.pointerId);
        const g = gesture.current;
        gesture.current = null;
        if (!g) return;
        if (g.mode === 'move' && g.last) { act(g.last, false, g.before); return; }
        if (!draft) return;
        const d = draft;
        setDraft(null);
        if (d.kind === 'pen' && (d.data.pts || []).length < 2) return;
        const b = bounds(d);
        if (d.kind !== 'pen' && b && b.w < 4 && b.h < 4) return;
        act({ ...d, z: Date.now() % 100000 });
    };

    const wheel = e => {
        if (e.ctrlKey || e.metaKey) { e.preventDefault(); zoomAt(e.clientX, e.clientY, e.deltaY < 0 ? 1.12 : 0.89); return; }
        setView(v => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };

    // مفاتيح سريعة كما في لوحات العمل المعروفة
    useEffect(() => {
        const k = e => {
            if (edit) return;
            const t = (e.target.tagName || '').toLowerCase();
            if (t === 'input' || t === 'textarea') return;
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
            if ((e.key === 'Delete' || e.key === 'Backspace') && sel) {
                const it = itemsR.current[sel]; if (it) { act(it, true); setSel(null); } return;
            }
            const map = { v: 'sel', h: 'pan', p: 'pen', n: 'note', t: 'text', r: 'rect', o: 'ellipse', a: 'arrow', l: 'line', e: 'erase' };
            if (map[e.key.toLowerCase()]) setTool(map[e.key.toLowerCase()]);
        };
        window.addEventListener('keydown', k);
        return () => window.removeEventListener('keydown', k);
    }, [sel, edit, act]);

    // ─── تصدير صورة ─────────────────────────────────────────────────────────
    const exportPng = () => {
        const all = Object.values(items);
        if (!all.length) { window.alert('السبورة فارغة'); return; }
        const bs = all.map(bounds).filter(Boolean);
        const pad = 40;
        const x1 = Math.min(...bs.map(b => b.x)) - pad, y1 = Math.min(...bs.map(b => b.y)) - pad;
        const x2 = Math.max(...bs.map(b => b.x + b.w)) + pad, y2 = Math.max(...bs.map(b => b.y + b.h)) + pad;
        const s = Math.min(2, 2400 / Math.max(1, x2 - x1));
        const cv = document.createElement('canvas');
        cv.width = Math.round((x2 - x1) * s); cv.height = Math.round((y2 - y1) * s);
        const c = cv.getContext('2d');
        c.fillStyle = '#0f172a'; c.fillRect(0, 0, cv.width, cv.height);
        c.setTransform(s, 0, 0, s, -x1 * s, -y1 * s);
        c.lineCap = 'round'; c.lineJoin = 'round';
        const wrapText = (text, w, size, lh) => {
            c.font = '700 ' + size + 'px Cairo, system-ui, sans-serif';
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
        };
        for (const it of all.sort((a, b) => (a.z || 0) - (b.z || 0))) {
            const d = it.data || {};
            c.strokeStyle = d.color || '#fff'; c.fillStyle = d.color || '#fff'; c.lineWidth = d.w || d.sw || 3;
            if (it.kind === 'pen') {
                const p = d.pts || []; if (p.length < 2) continue;
                c.beginPath(); c.moveTo(p[0][0], p[0][1]);
                for (let i = 1; i < p.length; i++) c.lineTo(p[i][0], p[i][1]);
                c.stroke();
            } else if (it.kind === 'line' || it.kind === 'arrow') {
                c.beginPath(); c.moveTo(d.x1, d.y1); c.lineTo(d.x2, d.y2); c.stroke();
                if (it.kind === 'arrow') {
                    const a = Math.atan2(d.y2 - d.y1, d.x2 - d.x1), L = 16;
                    c.beginPath(); c.moveTo(d.x2, d.y2);
                    c.lineTo(d.x2 - L * Math.cos(a - 0.4), d.y2 - L * Math.sin(a - 0.4));
                    c.lineTo(d.x2 - L * Math.cos(a + 0.4), d.y2 - L * Math.sin(a + 0.4));
                    c.closePath(); c.fill();
                }
            } else if (it.kind === 'rect') { c.strokeRect(d.x, d.y, d.w, d.h); }
            else if (it.kind === 'ellipse') {
                c.beginPath(); c.ellipse(d.x + d.w / 2, d.y + d.h / 2, Math.abs(d.w / 2), Math.abs(d.h / 2), 0, 0, 6.2832); c.stroke();
            } else if (it.kind === 'diamond') {
                c.beginPath(); c.moveTo(d.x + d.w / 2, d.y); c.lineTo(d.x + d.w, d.y + d.h / 2);
                c.lineTo(d.x + d.w / 2, d.y + d.h); c.lineTo(d.x, d.y + d.h / 2); c.closePath(); c.stroke();
            } else if (it.kind === 'note') {
                c.fillStyle = NOTE_BG[d.color] || '#f6c343';
                c.fillRect(d.x, d.y, d.w, d.h);
                c.fillStyle = '#0f172a';
                const lines = wrapText(d.text, d.w - 20, 15, 22);
                lines.forEach((ln, i) => c.fillText(ln, d.x + d.w - 10 - c.measureText(ln).width, d.y + 26 + i * 22));
            } else if (it.kind === 'text') {
                c.fillStyle = d.color || '#fff';
                const size = d.size || 22;
                const lines = wrapText(d.text, d.w || 240, size, size * 1.4);
                lines.forEach((ln, i) => c.fillText(ln, (d.x + (d.w || 240)) - c.measureText(ln).width, d.y + size + i * size * 1.4));
            }
        }
        const a = document.createElement('a');
        a.href = cv.toDataURL('image/png');
        a.download = 'سبورة-سماك-' + new Date().toISOString().slice(0, 10) + '.png';
        a.click();
    };

    // ─── الرسم ──────────────────────────────────────────────────────────────
    const vector = useMemo(
        () => Object.values(items).filter(i => i.kind !== 'note' && i.kind !== 'text').sort((a, b) => (a.z || 0) - (b.z || 0)),
        [items]);
    const html = useMemo(
        () => Object.values(items).filter(i => i.kind === 'note' || i.kind === 'text').sort((a, b) => (a.z || 0) - (b.z || 0)),
        [items]);

    const shape = (it, ghost) => {
        const d = it.data || {};
        const sw = d.w || d.sw || 3;
        const on = !ghost && sel === it.id;
        const common = { stroke: d.color || '#fff', strokeWidth: sw, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round',
            opacity: ghost ? 0.75 : 1 };
        if (it.kind === 'pen') {
            const p = d.pts || [];
            if (!p.length) return null;
            return <path key={it.id} d={'M' + p.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L')} {...common} />;
        }
        if (it.kind === 'line' || it.kind === 'arrow')
            return (
                <g key={it.id}>
                    <line x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} {...common}
                        markerEnd={it.kind === 'arrow' ? 'url(#mk-' + (d.color || '#fff').replace('#', '') + ')' : undefined} />
                </g>
            );
        if (it.kind === 'rect')
            return <rect key={it.id} x={d.x} y={d.y} width={d.w} height={d.h} rx="6" {...common}
                className={on ? 'outline-dashed' : ''} />;
        if (it.kind === 'ellipse')
            return <ellipse key={it.id} cx={d.x + d.w / 2} cy={d.y + d.h / 2} rx={Math.abs(d.w / 2)} ry={Math.abs(d.h / 2)} {...common} />;
        if (it.kind === 'diamond')
            return <polygon key={it.id}
                points={`${d.x + d.w / 2},${d.y} ${d.x + d.w},${d.y + d.h / 2} ${d.x + d.w / 2},${d.y + d.h} ${d.x},${d.y + d.h / 2}`}
                {...common} />;
        return null;
    };

    const selB = sel && items[sel] ? bounds(items[sel]) : null;
    const btn = on => 'w-9 h-9 rounded-xl flex items-center justify-center transition shrink-0 ' +
        (on ? 'bg-gold-500 text-slate-900' : 'bg-white/10 text-slate-200 hover:bg-white/20');

    return (
        <div className="relative w-full h-full overflow-hidden bg-[#0f172a] select-none" dir="ltr">
            {/* اللوح */}
            <div ref={wrap} className="absolute inset-0 touch-none"
                style={{ cursor: tool === 'pan' ? 'grab' : tool === 'sel' ? 'default' : 'crosshair',
                    backgroundImage: 'radial-gradient(circle, rgba(255,255,255,.10) 1px, transparent 1px)',
                    backgroundSize: (26 * view.k) + 'px ' + (26 * view.k) + 'px',
                    backgroundPosition: view.x + 'px ' + view.y + 'px' }}
                onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onWheel={wheel}>

                <div className="absolute top-0 left-0 origin-top-left"
                    style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
                    <svg className="absolute pointer-events-none"
                        style={{ left: -SVG_HALF, top: -SVG_HALF, width: SVG_HALF * 2, height: SVG_HALF * 2 }}
                        viewBox={`${-SVG_HALF} ${-SVG_HALF} ${SVG_HALF * 2} ${SVG_HALF * 2}`}>
                        <defs>
                            {COLORS.map(c => (
                                <marker key={c} id={'mk-' + c.replace('#', '')} viewBox="0 0 10 10" refX="9" refY="5"
                                    markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                                    <path d="M0,0 L10,5 L0,10 z" fill={c} />
                                </marker>
                            ))}
                        </defs>
                        {vector.map(it => shape(it))}
                        {draft && draft.kind !== 'note' && draft.kind !== 'text' ? shape(draft, true) : null}
                        {selB ? <rect x={selB.x - 6} y={selB.y - 6} width={selB.w + 12} height={selB.h + 12}
                            fill="none" stroke="#f6c343" strokeWidth={1.5 / view.k} strokeDasharray={6 / view.k} /> : null}
                    </svg>

                    {html.map(it => {
                        const d = it.data || {};
                        const on = sel === it.id;
                        if (it.kind === 'note') return (
                            <div key={it.id}
                                onPointerDown={e => { if (tool !== 'sel') return; e.stopPropagation();
                                    setSel(it.id);
                                    const p = toWorld(e.clientX, e.clientY);
                                    gesture.current = { mode: 'move', id: it.id, p, orig: it, before: it };
                                    wrap.current.setPointerCapture(e.pointerId); }}
                                onDoubleClick={() => { setSel(it.id); setEdit(it.id); }}
                                className="absolute rounded-lg shadow-xl"
                                style={{ left: d.x, top: d.y, width: d.w, height: d.h, background: NOTE_BG[d.color] || '#f6c343',
                                    outline: on ? '2px solid #f6c343' : 'none', outlineOffset: 4 }}>
                                {edit === it.id ? (
                                    <textarea autoFocus defaultValue={d.text} dir="auto"
                                        onBlur={e => { setEdit(null); act({ ...it, data: { ...d, text: e.target.value } }, false, it); }}
                                        className="w-full h-full bg-transparent p-2.5 text-[15px] font-bold leading-6 text-slate-900 outline-none resize-none text-right" />
                                ) : (
                                    <div dir="auto" className="w-full h-full p-2.5 text-[15px] font-bold leading-6 text-slate-900 overflow-hidden whitespace-pre-wrap text-right">
                                        {d.text || <span className="opacity-40">انقر مرّتين للكتابة</span>}
                                    </div>
                                )}
                            </div>
                        );
                        return (
                            <div key={it.id}
                                onPointerDown={e => { if (tool !== 'sel') return; e.stopPropagation();
                                    setSel(it.id);
                                    const p = toWorld(e.clientX, e.clientY);
                                    gesture.current = { mode: 'move', id: it.id, p, orig: it, before: it };
                                    wrap.current.setPointerCapture(e.pointerId); }}
                                onDoubleClick={() => { setSel(it.id); setEdit(it.id); }}
                                className="absolute" style={{ left: d.x, top: d.y, width: d.w || 240,
                                    outline: on ? '2px dashed #f6c343' : 'none', outlineOffset: 6 }}>
                                {edit === it.id ? (
                                    <textarea autoFocus defaultValue={d.text} dir="auto" rows={2}
                                        onBlur={e => { setEdit(null); act({ ...it, data: { ...d, text: e.target.value } }, false, it); }}
                                        style={{ color: d.color, fontSize: (d.size || 22) + 'px' }}
                                        className="w-full bg-black/30 rounded-lg px-1 font-black leading-tight outline-none resize-none text-right" />
                                ) : (
                                    <div dir="auto" style={{ color: d.color, fontSize: (d.size || 22) + 'px' }}
                                        className="font-black leading-tight whitespace-pre-wrap text-right">
                                        {d.text || <span className="opacity-40">نص</span>}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* شريط الأدوات */}
            <div dir="rtl" className={'absolute z-20 flex gap-1.5 bg-slate-900/90 backdrop-blur border border-white/10 rounded-2xl p-1.5 shadow-2xl ' +
                (dense ? 'bottom-3 inset-x-3 overflow-x-auto' : 'top-1/2 -translate-y-1/2 right-3 flex-col')}>
                {TOOLS.map(t => {
                    const I = t.icon;
                    return <button key={t.k} title={t.t} onClick={() => { setTool(t.k); setEdit(null); }} className={btn(tool === t.k)}><I size={17} /></button>;
                })}
                <div className={dense ? 'w-px bg-white/15 mx-0.5 shrink-0' : 'h-px bg-white/15 my-0.5'} />
                <button title="اللون" onClick={() => setPal(v => !v)} className={btn(false)}>
                    <span className="w-4 h-4 rounded-full border border-white/40" style={{ background: color }} />
                </button>
                <button title="تراجع" onClick={undo} className={btn(false)}><Undo2 size={17} /></button>
                <button title="إعادة" onClick={redo} className={btn(false)}><Redo2 size={17} /></button>
            </div>

            {pal && (
                <div dir="rtl" className={'absolute z-30 bg-slate-900/95 border border-white/10 rounded-2xl p-2 grid grid-cols-4 gap-1.5 shadow-2xl ' +
                    (dense ? 'bottom-16 right-3' : 'top-1/2 -translate-y-1/2 right-16')}>
                    {COLORS.map(c => (
                        <button key={c} onClick={() => { setColor(c); setPal(false);
                            if (sel && items[sel]) { const it = items[sel]; act({ ...it, data: { ...it.data, color: c } }, false, it); } }}
                            className={'w-7 h-7 rounded-full border-2 ' + (color === c ? 'border-white' : 'border-white/20')}
                            style={{ background: c }} />
                    ))}
                </div>
            )}

            {/* الشريط العلوي: التكبير والتصدير والحالة */}
            <div dir="rtl" className="absolute top-3 right-3 left-3 z-20 flex items-center gap-1.5 pointer-events-none">
                <div className="flex gap-1.5 bg-slate-900/90 backdrop-blur border border-white/10 rounded-2xl p-1.5 pointer-events-auto">
                    <button title="تصغير" onClick={() => { const b = wrap.current.getBoundingClientRect(); zoomAt(b.left + b.width / 2, b.top + b.height / 2, 0.83); }} className={btn(false)}><ZoomOut size={17} /></button>
                    <span className="px-1.5 self-center text-[11px] font-black text-slate-300 tabular-nums">{Math.round(view.k * 100)}%</span>
                    <button title="تكبير" onClick={() => { const b = wrap.current.getBoundingClientRect(); zoomAt(b.left + b.width / 2, b.top + b.height / 2, 1.2); }} className={btn(false)}><ZoomIn size={17} /></button>
                    <button title="اضبط على المحتوى" onClick={fit} className={btn(false)}><Crosshair size={17} /></button>
                </div>
                <div className="flex gap-1.5 bg-slate-900/90 backdrop-blur border border-white/10 rounded-2xl p-1.5 pointer-events-auto">
                    <button title="تنزيل صورة" onClick={exportPng} className={btn(false)}><Download size={17} /></button>
                    <button title="مسح السبورة" onClick={clearAll} className={btn(false)}><Trash2 size={17} /></button>
                </div>
                <div className="ms-auto flex items-center gap-2 bg-slate-900/90 backdrop-blur border border-white/10 rounded-2xl px-2.5 py-2 pointer-events-auto">
                    {sync === 'busy' ? <Loader2 size={13} className="animate-spin text-gold-500" />
                        : <span className={'w-2 h-2 rounded-full ' + (sync === 'err' ? 'bg-red-500' : 'bg-emerald-500')} />}
                    <span className="text-[11px] font-bold text-slate-300">
                        {sync === 'err' ? 'انقطع الاتصال' : Object.keys(items).length + ' عنصر'}
                    </span>
                    {peers.length ? (
                        <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400 border-s border-white/10 ps-2">
                            <Users size={12} />{peers.length + 1}
                        </span>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
