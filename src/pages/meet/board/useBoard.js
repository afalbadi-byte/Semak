import { useState, useEffect, useRef, useCallback } from 'react';
import { API_URL, getAdminToken } from '../../../lib/api/client';

// ════════════════════════════════════════════════════════════════════════════
//  حالة السبورة ومزامنتها
//  ─────────────────────────────────────────────────────────────────────────
//  العناصر تُحفظ عنصراً عنصراً، والجلب يطلب ما تغيّر بعد رقم النسخة فقط.
//  التراجع يعمل على دفعات: كل عملية تُسجَّل بما كان وما صار لكل عنصر مسّته،
//  فتحريك عشرة عناصر معاً يتراجع بضغطة واحدة كما هو متوقّع.
// ════════════════════════════════════════════════════════════════════════════

const uid = () => 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export { uid };

export default function useBoard(boardId, opts) {
    const [items, setItems] = useState({});
    const [rev, setRev]     = useState(0);
    const [sync, setSync]   = useState('idle');     // idle | busy | err
    const [peers, setPeers] = useState([]);
    const [me, setMe]       = useState(null);

    const pending = useRef(new Map());
    const undoS   = useRef([]);
    const redoS   = useRef([]);
    const itemsR  = useRef({});
    const revR    = useRef(0);
    const cursor  = useRef({ x: 0, y: 0, tool: 'sel', sel_n: 0 });
    const [stack, setStack] = useState({ u: 0, r: 0 });   // لإحياء أزرار التراجع
    itemsR.current = items; revR.current = rev;

    // الضيف يُعرَف برمز دعوته، والموظّف بجلسته
    const guestToken = opts && opts.guestToken;
    const auth = () => (guestToken ? { 'X-Guest-Token': guestToken } : { Authorization: 'Bearer ' + getAdminToken() });
    const jhdr = () => ({ 'Content-Type': 'application/json', ...auth() });

    // ─── الجلب ──────────────────────────────────────────────────────────────
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
    }, []);

    const pull = useCallback(async () => {
        if (!boardId) return;
        try {
            const r = await fetch(`${API_URL}?action=board_get&board=${encodeURIComponent(boardId)}&since=${revR.current}`,
                { headers: auth() }).then(x => x.json());
            if (r && r.success) {
                absorb(r.items);
                if (r.rev > revR.current) { revR.current = r.rev; setRev(r.rev); }
                setSync('idle');
            }
        } catch (e) { setSync('err'); }
    }, [boardId, absorb]);

    // ─── الدفع ──────────────────────────────────────────────────────────────
    const flush = useCallback(async () => {
        if (!boardId || !pending.current.size) return;
        const batch = Array.from(pending.current.values());
        pending.current.clear();
        setSync('busy');
        try {
            const r = await fetch(`${API_URL}?action=board_save`, {
                method: 'POST', headers: jhdr(), body: JSON.stringify({ board: boardId, items: batch }),
            }).then(x => x.json());
            // رقم النسخة يتقدّم بكتابتنا، فنتجاوز صدى عناصرنا في الجلب التالي
            if (r && r.success && r.rev > revR.current) { revR.current = r.rev; setRev(r.rev); }
            setSync('idle');
        } catch (e) { setSync('err'); }
    }, [boardId]);

    // ─── نبضة الحضور ────────────────────────────────────────────────────────
    const ping = useCallback(async () => {
        if (!boardId) return;
        try {
            const c = cursor.current;
            const r = await fetch(`${API_URL}?action=board_presence`, {
                method: 'POST', headers: jhdr(),
                body: JSON.stringify({ board: boardId, x: c.x, y: c.y, tool: c.tool, sel_n: c.sel_n }),
            }).then(x => x.json());
            if (r && r.success) { setPeers(r.peers || []); setMe(r.me || null); }
        } catch (e) { /* الحضور ليس حرجاً — لا نُظهر خطأً */ }
    }, [boardId]);

    const setCursor = useCallback((x, y, tool, selN) => {
        cursor.current = { x, y, tool: tool || cursor.current.tool, sel_n: selN || 0 };
    }, []);

    useEffect(() => {
        if (!boardId) return;
        pull(); ping();
        const a = setInterval(pull, 2000);
        const b = setInterval(flush, 600);
        const c = setInterval(ping, 2000);
        return () => { clearInterval(a); clearInterval(b); clearInterval(c); flush(); };
    }, [boardId, pull, flush, ping]);

    // ─── الكتابة ────────────────────────────────────────────────────────────
    const apply = useCallback(ops => {
        setItems(prev => {
            const nx = { ...prev };
            for (const o of ops) {
                if (o.after) { nx[o.after.id] = o.after; pending.current.set(o.after.id, wire(o.after, 0)); }
                else { delete nx[o.id]; pending.current.set(o.id, { id: o.id, kind: 'x', z: 0, data: null, deleted: 1 }); }
            }
            return nx;
        });
    }, []);

    const wire = (it, del) => ({ id: it.id, kind: it.kind, z: it.z || 0, data: it.data, deleted: del ? 1 : 0 });

    // عملية واحدة على دفعة عناصر، قابلة للتراجع ككتلة
    const commit = useCallback(list => {
        const arr = Array.isArray(list) ? list : [list];
        if (!arr.length) return;
        const ops = arr.map(o => ({
            id: o.id || (o.after && o.after.id),
            before: 'before' in o ? o.before : itemsR.current[o.id || (o.after && o.after.id)],
            after: o.after === undefined ? o : o.after,
        }));
        undoS.current.push(ops);
        if (undoS.current.length > 200) undoS.current.shift();
        redoS.current = [];
        setStack({ u: undoS.current.length, r: 0 });
        apply(ops);
    }, [apply]);

    const remove = useCallback(list => {
        const arr = (Array.isArray(list) ? list : [list]).filter(Boolean);
        if (!arr.length) return;
        const ops = arr.map(it => ({ id: it.id, before: it, after: null }));
        undoS.current.push(ops);
        redoS.current = [];
        setStack({ u: undoS.current.length, r: 0 });
        apply(ops);
    }, [apply]);

    // تحديث صامت بلا تسجيل — أثناء السحب، ثم يُثبَّت بـcommit عند الإفلات
    const preview = useCallback(list => {
        setItems(prev => {
            const nx = { ...prev };
            for (const it of list) nx[it.id] = it;
            return nx;
        });
    }, []);

    const undo = useCallback(() => {
        const ops = undoS.current.pop();
        if (!ops) return;
        redoS.current.push(ops);
        setStack({ u: undoS.current.length, r: redoS.current.length });
        apply(ops.map(o => (o.before ? { id: o.id, after: o.before } : { id: o.id, after: null })));
    }, [apply]);

    const redo = useCallback(() => {
        const ops = redoS.current.pop();
        if (!ops) return;
        undoS.current.push(ops);
        setStack({ u: undoS.current.length, r: redoS.current.length });
        apply(ops.map(o => (o.after ? { id: o.id, after: o.after } : { id: o.id, after: null })));
    }, [apply]);

    const clear = useCallback(async () => {
        try {
            const r = await fetch(`${API_URL}?action=board_clear`, {
                method: 'POST', headers: jhdr(), body: JSON.stringify({ board: boardId }),
            }).then(x => x.json());
            if (r && r.success) { setItems({}); revR.current = r.rev; setRev(r.rev); undoS.current = []; redoS.current = []; setStack({ u: 0, r: 0 }); }
            return !!(r && r.success);
        } catch (e) { setSync('err'); return false; }
    }, [boardId]);

    // ─── رفع صورة ───────────────────────────────────────────────────────────
    const upload = useCallback(async file => {
        const fd = new FormData();
        fd.append('file', file);
        const r = await fetch(`${API_URL}?action=board_upload&board=${encodeURIComponent(boardId)}`,
            { method: 'POST', headers: auth(), body: fd }).then(x => x.json());
        if (!r || !r.success) throw new Error((r && r.message) || 'تعذّر رفع الصورة');
        return r.url;
    }, [boardId]);

    return { items, rev, sync, peers, me, commit, preview, remove, clear, undo, redo,
             canUndo: stack.u > 0, canRedo: stack.r > 0, upload, setCursor, pull };
}
