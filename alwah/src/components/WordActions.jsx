import React from 'react';
import { X, Undo2, CheckCircle2, Eraser } from 'lucide-react';

// ─── ما يُفعل بكلمةٍ لُمست: خطأ، تنبيه، تراجع، أتقنها، مسح ─────────────────────
export default function WordActions({ word, mark, onOp, onClose, busy }) {
    if (!word) return null;
    const m = mark || { err: 0, warn: 0, resolved: 0 };
    return (
        <div className="fixed inset-x-0 bottom-0 z-40 px-3" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 12px)' }}>
            <div className="max-w-lg mx-auto bg-paper-card rounded-3xl border border-paper-2 shadow-2xl p-4 al-rise">
                <div className="flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                        <div className="font-quran text-[28px] leading-[1.6] text-ink truncate">{word.t}</div>
                        <div className="text-[12px] text-ink-3">
                            {m.err || m.warn ? `أخطاء ${m.err} · تنبيهات ${m.warn}${m.resolved ? ' · أُتقنت' : ''}` : 'لا علامات على هذه الكلمة'}
                        </div>
                    </div>
                    <button onClick={onClose} className="w-9 h-9 rounded-xl hover:bg-paper-2 flex items-center justify-center text-ink-3" aria-label="إغلاق"><X size={18} /></button>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                    <button disabled={busy} onClick={() => onOp('err')} className="h-14 rounded-2xl bg-red-600 text-white font-bold text-[16px] disabled:opacity-50">خطأ</button>
                    <button disabled={busy} onClick={() => onOp('warn')} className="h-14 rounded-2xl bg-amber-500 text-white font-bold text-[16px] disabled:opacity-50">تنبيه</button>
                </div>
                {m.err || m.warn ? (
                    <div className="grid grid-cols-3 gap-2 mt-2">
                        <button disabled={busy} onClick={() => onOp('undo')} className="h-10 rounded-xl bg-paper-2 text-ink-2 text-[12px] font-semibold inline-flex items-center justify-center gap-1"><Undo2 size={14} />تراجع</button>
                        <button disabled={busy} onClick={() => onOp('resolve')} className="h-10 rounded-xl bg-green-50 text-green-700 text-[12px] font-semibold inline-flex items-center justify-center gap-1"><CheckCircle2 size={14} />{m.resolved ? 'ليست متقنة' : 'أتقنها'}</button>
                        <button disabled={busy} onClick={() => { if (window.confirm('مسح كل علامات هذه الكلمة؟')) onOp('clear'); }} className="h-10 rounded-xl bg-paper-2 text-ink-3 text-[12px] font-semibold inline-flex items-center justify-center gap-1"><Eraser size={14} />مسح</button>
                    </div>
                ) : null}
            </div>
        </div>
    );
}
