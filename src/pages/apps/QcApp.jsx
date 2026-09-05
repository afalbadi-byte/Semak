import React, { useState, useEffect, useCallback } from 'react';
import { Home, ClipboardCheck, AlertTriangle, Bot, RefreshCw, ChevronLeft, ArrowRight,
         Check, X, Camera, Loader2 } from 'lucide-react';
import { API_URL, getAdminToken } from '../../lib/api/client';
import AppShell from './AppShell';
import BuyChat from '../buy/BuyChat';
import { useDepthGuard } from '../../lib/backstack';

const auth = () => { const t = getAdminToken(); return t ? { Authorization: `Bearer ${t}` } : {}; };
const post = (action, body) => fetch(`${API_URL}?action=${action}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', ...auth() },
    body: JSON.stringify(body),
}).then(r => r.json());

const TABS = [
    { k: 'home',  t: 'الوحدات',   icon: Home },
    { k: 'check', t: 'الفحص',     icon: ClipboardCheck },
    { k: 'notes', t: 'الملاحظات', icon: AlertTriangle },
    { k: 'chat',  t: 'المساعد',   icon: Bot },
];

// ─── تطبيق الجودة ───────────────────────────────────────────────────────────
export default function QcApp() {
    const [unit, setUnit] = useState(null);   // الوحدة المفتوحة للفحص
    return (
        <AppShell appKey="qc" title="جودة سماك" tabs={TABS}
            perms={['inspection', 'snaglist', 'projects', 'units']} manifest="/qc.webmanifest">
            {(tab, user) => (
                <>
                    {tab === 'home'  && <UnitsBoard onOpen={u => setUnit(u)} />}
                    {tab === 'check' && (unit
                        ? <Checklist unit={unit} onBack={() => setUnit(null)} />
                        : <UnitsBoard onOpen={u => setUnit(u)} hint="اختر وحدة لبدء الفحص" />)}
                    {tab === 'notes' && <Notes />}
                    {tab === 'chat'  && <BuyChat userName={user?.name || ''} />}
                </>
            )}
        </AppShell>
    );
}

function UnitsBoard({ onOpen, hint }) {
    const [rows, setRows] = useState([]);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setBusy(true);
        try {
            const r = await fetch(`${API_URL}?action=qc_units`, { headers: auth() }).then(x => x.json());
            setRows(r.data || []);
        } catch { setRows([]); }
        finally { setBusy(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const tot = rows.reduce((s, r) => s + Number(r.items || 0), 0);
    const bad = rows.reduce((s, r) => s + Number(r.failed || 0), 0);
    const pen = rows.reduce((s, r) => s + Number(r.pending || 0), 0);

    return (
        <div className="p-4 space-y-3">
            {hint && <p className="text-[12px] text-slate-400 text-center">{hint}</p>}
            <div className="grid grid-cols-3 gap-2">
                {[['بنود الفحص', tot], ['ملاحظات', bad], ['بانتظار', pen]].map(([t, v], i) => (
                    <div key={t} className="rounded-xl bg-white/[0.06] border border-white/10 p-3 text-center">
                        <div className={'text-[19px] font-black ' + (i === 1 && v > 0 ? 'text-red-400' : '')}>{v}</div>
                        <div className="text-[11px] text-slate-400">{t}</div>
                    </div>
                ))}
            </div>

            <div className="flex items-center justify-between">
                <h2 className="font-black text-[15px]">حالة الفحص لكل وحدة</h2>
                <button onClick={load} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <RefreshCw size={16} className={busy ? 'animate-spin' : ''} />
                </button>
            </div>

            {rows.map(u => (
                <button key={u.unit} onClick={() => onOpen(u.unit)}
                    className="w-full text-right rounded-xl bg-white/[0.05] border border-white/10 p-3 active:bg-white/10">
                    <div className="flex items-center justify-between gap-2">
                        <span className="font-black text-[14px]">{u.unit}</span>
                        <span className="text-[18px] font-black text-[#c5a059]">{u.progress}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/10 mt-2 overflow-hidden">
                        <div className="h-full bg-emerald-500" style={{ width: u.progress + '%' }} />
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-2">
                        {u.items} بند · مطابق {u.passed}
                        {u.failed > 0 && <span className="text-red-400 font-bold">· ملاحظات {u.failed}</span>}
                        <ChevronLeft size={13} className="mr-auto text-slate-600" />
                    </div>
                </button>
            ))}
            {!rows.length && !busy && <p className="text-center text-slate-500 text-sm py-8">لا وحدات</p>}
        </div>
    );
}

// قائمة فحص وحدة: مناطق تُفتح، وكل بند يُعلَّم مطابقا أو ملاحظة بصورة
function Checklist({ unit, onBack }) {
    const [areas, setAreas] = useState([]);
    const [open, setOpen]   = useState(null);
    const [busy, setBusy]   = useState(false);
    const [saving, setSaving] = useState('');
    const [note, setNote]   = useState(null);   // { key, text, notes }

    const load = useCallback(async () => {
        setBusy(true);
        try {
            const r = await fetch(`${API_URL}?action=qc_unit&unit=${encodeURIComponent(unit)}`, { headers: auth() })
                .then(x => x.json());
            setAreas(r.success ? (r.areas || []) : []);
        } catch { setAreas([]); }
        finally { setBusy(false); }
    }, [unit]);
    useEffect(() => { load(); }, [load]);

    useDepthGuard(open ? 1 : 0, () => setOpen(null));
    useDepthGuard(note ? 1 : 0, () => setNote(null));

    const mark = async (key, passed, notes, photo) => {
        setSaving(key);
        try {
            const r = await post('qc_mark', { unit, key, passed, notes, photo });
            if (!r.success) { alert(r.message || 'تعذر الحفظ'); return; }
            setAreas(prev => prev.map(a => ({
                ...a,
                elements: a.elements.map(e => ({
                    ...e,
                    items: e.items.map(it => (it.key === key
                        ? { ...it, passed, notes: notes ?? it.notes, photo: photo ?? it.photo }
                        : it)),
                })),
            })));
        } finally { setSaving(''); }
    };

    const cur = areas.find(a => a.area === open);

    if (busy) return <div className="flex justify-center py-16"><Loader2 size={26} className="animate-spin text-[#c5a059]" /></div>;

    return (
        <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
                <button onClick={() => (open ? setOpen(null) : onBack())}
                    className="flex items-center gap-1.5 text-[13px] font-bold text-slate-400 min-h-[44px]">
                    <ArrowRight size={16} /> {open ? 'المناطق' : 'الوحدات'}
                </button>
                <span className="font-black text-[15px]">{unit}{open ? ' · ' + open : ''}</span>
            </div>

            {!open && areas.map(a => (
                <button key={a.area} onClick={() => setOpen(a.area)}
                    className="w-full text-right rounded-xl bg-white/[0.05] border border-white/10 p-3 active:bg-white/10">
                    <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-[14px]">{a.area}</span>
                        <span className="text-[12px] text-slate-400">{a.done}/{a.count}</span>
                    </div>
                    {a.failed > 0 && <div className="text-[11px] text-red-400 font-bold mt-1">{a.failed} ملاحظة</div>}
                </button>
            ))}

            {cur && cur.elements.map(el => (
                <div key={el.element} className="rounded-xl bg-white/[0.04] border border-white/10 p-3 space-y-2">
                    <div className="font-black text-[13px] text-[#c5a059]">{el.element}</div>
                    {el.items.map(it => (
                        <div key={it.key} className="rounded-lg bg-black/25 p-2.5">
                            <div className="text-[12px] leading-relaxed">{it.text}</div>
                            {it.notes && <div className="text-[11px] text-amber-300 mt-1">ملاحظة: {it.notes}</div>}
                            <div className="flex gap-2 mt-2">
                                <button onClick={() => mark(it.key, true)}
                                    className={'flex-1 min-h-[44px] rounded-lg text-[12px] font-bold flex items-center justify-center gap-1 border '
                                        + (it.passed === true ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white/5 border-white/10 text-slate-300')}>
                                    <Check size={14} /> مطابق
                                </button>
                                <button onClick={() => setNote({ key: it.key, text: it.text, notes: it.notes || '' })}
                                    className={'flex-1 min-h-[44px] rounded-lg text-[12px] font-bold flex items-center justify-center gap-1 border '
                                        + (it.passed === false ? 'bg-red-500 text-white border-red-500' : 'bg-white/5 border-white/10 text-slate-300')}>
                                    <X size={14} /> ملاحظة
                                </button>
                                {saving === it.key && <Loader2 size={16} className="animate-spin text-[#c5a059] self-center" />}
                            </div>
                        </div>
                    ))}
                </div>
            ))}

            {note && <NoteSheet note={note} onClose={() => setNote(null)}
                onSave={(text, photo) => { mark(note.key, false, text, photo); setNote(null); }} />}
        </div>
    );
}

// نافذة تسجيل ملاحظة: نص وصورة اختيارية
function NoteSheet({ note, onClose, onSave }) {
    const [text, setText]   = useState(note.notes || '');
    const [photo, setPhoto] = useState(null);
    const [busy, setBusy]   = useState(false);

    const pick = e => {
        const f = e.target.files && e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => setPhoto({ name: f.name || 'note.jpg', dataUrl: String(r.result) });
        r.readAsDataURL(f);
    };

    const save = async () => {
        setBusy(true);
        let url = '';
        try {
            if (photo) {
                const up = await post('doc_upload', { filename: photo.name, data: photo.dataUrl.split(',')[1] || '' });
                if (up.success) url = up.url;
            }
        } catch { /* الملاحظة تُحفظ ولو تعذرت الصورة */ }
        setBusy(false);
        onSave(text.trim(), url);
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[80] flex items-end justify-center p-4" onClick={onClose}>
            <div dir="rtl" className="bg-[#0f1e36] rounded-3xl w-full max-w-sm p-5 space-y-3" onClick={e => e.stopPropagation()}
                style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
                <h3 className="font-black text-[14px]">تسجيل ملاحظة</h3>
                <p className="text-[12px] text-slate-400 leading-relaxed">{note.text}</p>
                <textarea value={text} onChange={e => setText(e.target.value)} rows={3}
                    placeholder="وصف الملاحظة والمطلوب إصلاحه"
                    className="w-full px-3 py-3 rounded-xl bg-white/[0.06] border border-white/10 text-[14px] outline-none focus:border-[#c5a059]" />
                <label className="block">
                    <div className="min-h-[56px] rounded-xl border border-dashed border-white/15 flex items-center justify-center gap-2">
                        <Camera size={16} className="text-[#c5a059]" />
                        <span className="text-[12px] font-bold text-slate-300">{photo ? 'أُرفقت صورة' : 'صوّر الملاحظة'}</span>
                    </div>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={pick} />
                </label>
                <div className="flex gap-2">
                    <button onClick={onClose} className="flex-1 min-h-[48px] rounded-2xl bg-white/10 text-sm font-bold">إلغاء</button>
                    <button onClick={save} disabled={busy}
                        className="flex-[2] min-h-[48px] rounded-2xl bg-red-500 text-white text-sm font-black flex items-center justify-center gap-2 disabled:opacity-60">
                        {busy ? <Loader2 size={16} className="animate-spin" /> : <X size={16} />} حفظ الملاحظة
                    </button>
                </div>
            </div>
        </div>
    );
}

function Notes() {
    const [rows, setRows] = useState([]);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setBusy(true);
        try {
            const r = await fetch(`${API_URL}?action=qc_notes`, { headers: auth() }).then(x => x.json());
            setRows(r.data || []);
        } catch { setRows([]); }
        finally { setBusy(false); }
    }, []);
    useEffect(() => { load(); }, [load]);

    const byUnit = {};
    rows.forEach(r => { (byUnit[r.unit] = byUnit[r.unit] || []).push(r); });

    return (
        <div className="p-4 space-y-3">
            <div className="flex items-center justify-between">
                <h2 className="font-black text-[15px]">الملاحظات المفتوحة ({rows.length})</h2>
                <button onClick={load} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                    <RefreshCw size={16} className={busy ? 'animate-spin' : ''} />
                </button>
            </div>

            {Object.keys(byUnit).map(u => (
                <div key={u} className="rounded-2xl bg-white/[0.04] border border-white/10 p-3 space-y-2">
                    <div className="font-black text-[13px]">{u} · {byUnit[u].length} ملاحظة</div>
                    {byUnit[u].map((n, i) => (
                        <div key={i} className="rounded-xl bg-black/25 p-2.5">
                            <div className="text-[12px] font-bold">{n.area} · {n.element}</div>
                            <div className="text-[12px] text-slate-300 mt-0.5">{n.item}</div>
                            {n.notes && <div className="text-[11px] text-amber-300 mt-1">{n.notes}</div>}
                            <div className="flex items-center gap-2 mt-1.5">
                                {n.photo && <a href={n.photo} target="_blank" rel="noopener noreferrer"
                                    className="text-[11px] text-sky-300 font-bold">عرض الصورة</a>}
                                <span className="text-[10px] text-slate-500 mr-auto">{n.by} {n.at}</span>
                            </div>
                        </div>
                    ))}
                </div>
            ))}
            {!rows.length && !busy && (
                <p className="text-center text-slate-500 text-sm py-10">لا ملاحظات — كل ما فُحص مطابق</p>
            )}
        </div>
    );
}
