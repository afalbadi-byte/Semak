import React, { useState } from 'react';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';
import { API_URL, getAdminToken } from '../../lib/api/client';

// ─── تغيير كلمة المرور الإلزامي ─────────────────────────────────────────────
// الحساب الجديد يُسلَّم بكلمة مؤقتة، ولا يُستخدم التطبيق قبل تغييرها.
export default function BuyChangePw({ onDone }) {
    const [oldPw, setOldPw] = useState('');
    const [pw1, setPw1]     = useState('');
    const [pw2, setPw2]     = useState('');
    const [busy, setBusy]   = useState(false);
    const [err, setErr]     = useState('');

    const field = 'w-full min-w-0 h-[52px] px-3 rounded-2xl bg-white/[0.06] border border-white/10 text-[15px] outline-none focus:border-[#c5a059]';

    const save = async e => {
        e.preventDefault();
        if (pw1.length < 8) return setErr('كلمة المرور الجديدة ثمانية أحرف على الأقل');
        if (pw1 !== pw2)    return setErr('الكلمتان غير متطابقتين');
        setBusy(true); setErr('');
        try {
            const t = getAdminToken();
            const r = await fetch(`${API_URL}?action=change_password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
                body: JSON.stringify({ old_password: oldPw, new_password: pw1 }),
            }).then(x => x.json());
            if (!r.success) { setErr(r.message || 'تعذر التغيير'); return; }
            onDone && onDone();
        } catch { setErr('تعذر الاتصال بالخادم'); }
        finally { setBusy(false); }
    };

    return (
        <div dir="rtl" className="min-h-screen bg-[#0b1220] text-white font-cairo flex flex-col justify-center px-5"
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
            <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-white/10 flex items-center justify-center">
                    <ShieldCheck size={28} className="text-[#c5a059]" />
                </div>
                <h1 className="text-[22px] font-black mt-4">غيّر كلمة المرور</h1>
                <p className="text-[13px] text-slate-400 mt-1.5 leading-relaxed">
                    دخلت بكلمة مرور مؤقتة — اختر كلمتك الخاصة قبل استخدام التطبيق
                </p>
            </div>

            <form onSubmit={save} className="space-y-3">
                <input type="password" value={oldPw} onChange={e => setOldPw(e.target.value)}
                    placeholder="كلمة المرور المؤقتة" className={field} dir="ltr" autoComplete="current-password" />
                <input type="password" value={pw1} onChange={e => setPw1(e.target.value)}
                    placeholder="كلمة المرور الجديدة" className={field} dir="ltr" autoComplete="new-password" />
                <input type="password" value={pw2} onChange={e => setPw2(e.target.value)}
                    placeholder="أعد كتابة الجديدة" className={field} dir="ltr" autoComplete="new-password" />
                {err && <div className="rounded-xl bg-red-500/15 text-red-300 p-3 text-xs font-bold">{err}</div>}
                <button type="submit" disabled={busy}
                    className="w-full min-h-[52px] rounded-2xl bg-[#c5a059] text-[#0b1220] text-[16px] font-black flex items-center justify-center gap-2 disabled:opacity-60">
                    {busy ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />} حفظ ومتابعة
                </button>
            </form>
        </div>
    );
}
