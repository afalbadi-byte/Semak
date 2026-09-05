import React, { useState, useEffect } from 'react';
import { Fingerprint, Loader2, Check } from 'lucide-react';
import { passkeyLogin, passkeyRegister, passkeyAvailableHere } from '../lib/passkey';

// ─── زر الدخول بالبصمة ───────────────────────────────────────────────────────
export function PasskeyLoginButton({ identifier = '', onSuccess, className = '' }) {
    const [ok, setOk]     = useState(false);
    const [busy, setBusy] = useState(false);
    const [err, setErr]   = useState('');

    useEffect(() => { passkeyAvailableHere().then(setOk); }, []);
    if (!ok) return null;

    const go = async () => {
        setBusy(true); setErr('');
        try { const r = await passkeyLogin(identifier); onSuccess && onSuccess(r); }
        catch (e) { setErr(e.message || 'تعذر الدخول بالبصمة'); }
        finally { setBusy(false); }
    };

    return (
        <>
            <button type="button" onClick={go} disabled={busy}
                className={'w-full min-h-[52px] rounded-2xl bg-white/10 text-[15px] font-black flex items-center justify-center gap-2 disabled:opacity-50 ' + className}>
                {busy ? <Loader2 size={18} className="animate-spin" /> : <Fingerprint size={19} />}
                الدخول بالبصمة
            </button>
            {err && <p className="text-[11px] text-red-400 text-center mt-1.5">{err}</p>}
        </>
    );
}

// ─── تفعيل البصمة على هذا الجهاز — بعد الدخول ────────────────────────────────
export function PasskeySetupCard({ onDone, compact = false }) {
    const [ok, setOk]     = useState(false);
    const [busy, setBusy] = useState(false);
    const [done, setDone] = useState(false);
    const [err, setErr]   = useState('');

    useEffect(() => { passkeyAvailableHere().then(setOk); }, []);
    if (!ok || done) return null;

    const go = async () => {
        setBusy(true); setErr('');
        try { await passkeyRegister(); setDone(true); onDone && onDone(); }
        catch (e) { setErr(e.message || 'تعذر التفعيل'); }
        finally { setBusy(false); }
    };

    if (compact) {
        return (
            <button onClick={go} disabled={busy}
                className="w-full min-h-[48px] rounded-2xl bg-white/10 text-[13px] font-bold flex items-center justify-center gap-2">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Fingerprint size={17} className="text-[#c5a059]" />}
                فعّل الدخول بالبصمة على هذا الجهاز
            </button>
        );
    }

    return (
        <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
            <div className="flex items-center gap-2 mb-1.5">
                <Fingerprint size={18} className="text-[#c5a059]" />
                <span className="font-black text-sm">الدخول بالبصمة</span>
            </div>
            <p className="text-[12px] text-slate-300 leading-relaxed mb-3">
                فعّلها مرة واحدة على هذا الجهاز فتدخل ببصمتك أو وجهك بلا كلمة مرور.
                بصمتك لا تُرسل ولا تُحفظ عندنا؛ تبقى داخل جهازك.
            </p>
            {err && <p className="text-[11px] text-red-400 mb-2">{err}</p>}
            <button onClick={go} disabled={busy}
                className="w-full min-h-[48px] rounded-xl bg-[#c5a059] text-[#0b1220] text-sm font-black flex items-center justify-center gap-2 disabled:opacity-60">
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} تفعيل
            </button>
        </div>
    );
}
