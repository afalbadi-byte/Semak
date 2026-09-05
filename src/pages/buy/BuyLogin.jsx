import React, { useState } from 'react';
import { Loader2, LogIn, KeyRound } from 'lucide-react';
import { API_URL, LS_ADMIN_JWT } from '../../lib/api/client';
import InstallApp from '../../components/InstallApp';

const DEVICE_KEY = 'semak_device_token';

// ─── الدخول داخل التطبيق نفسه ────────────────────────────────────────────────
// آيفون يحفظ الصفحة المفتوحة عند «إضافة إلى الشاشة الرئيسية»، فلو خرجنا
// لصفحة دخول البوابة لحُفظت هي بدل التطبيق. فالدخول يتم هنا بلا مغادرة /buy.
export default function BuyLogin({ onDone }) {
    const [email, setEmail]   = useState(() => { try { return localStorage.getItem('semak_admin_email') || ''; } catch { return ''; } });
    const [pass, setPass]     = useState('');
    const [code, setCode]     = useState('');
    const [ticket, setTicket] = useState(null);
    const [flow, setFlow]     = useState('password');   // password | identifier
    const [sentTo, setSentTo] = useState('');
    const [busy, setBusy]     = useState(false);
    const [err, setErr]       = useState('');

    const finish = (data, jwt) => {
        try {
            if (jwt) localStorage.setItem(LS_ADMIN_JWT, jwt);
            localStorage.setItem('semak_current_user', JSON.stringify(data));
            if (email) localStorage.setItem('semak_admin_email', email);
        } catch { /* تجاهل */ }
        onDone && onDone();
    };

    const login = async e => {
        e.preventDefault();
        if (!email.trim() || !pass) return;
        setBusy(true); setErr('');
        try {
            let device_token;
            try { device_token = localStorage.getItem(DEVICE_KEY) || undefined; } catch { device_token = undefined; }
            const r = await fetch(`${API_URL}?action=login`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), password: pass, device_token }),
            }).then(x => x.json());
            if (r.otp_required) { setTicket(r.ticket || (r.otp && r.otp.ticket) || null); setErr(''); }
            else if (r.success) finish(r.data, r.jwt);
            else setErr(r.message || 'بيانات الدخول غير صحيحة');
        } catch { setErr('تعذر الاتصال بالخادم'); }
        finally { setBusy(false); }
    };

    const codeLogin = async e => {
        e.preventDefault();
        if (!email.trim()) return;
        setBusy(true); setErr('');
        try {
            let device_token;
            try { device_token = localStorage.getItem(DEVICE_KEY) || undefined; } catch { device_token = undefined; }
            const r = await fetch(`${API_URL}?action=auth_otp_start`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ identifier: email.trim(), scope: 'staff', device_token }),
            }).then(x => x.json());
            if (r.success && r.data) finish(r.data, r.jwt);          // جهاز موثوق
            else if (r.otp_required) {
                setFlow('identifier'); setTicket(r.ticket);
                setSentTo(r.masked_email || r.masked_phone || '');
            } else setErr(r.message || 'تعذر إرسال الرمز');
        } catch { setErr('تعذر الاتصال بالخادم'); }
        finally { setBusy(false); }
    };

    const verify = async e => {
        e.preventDefault();
        if (!code.trim()) return;
        setBusy(true); setErr('');
        try {
            const act = flow === 'identifier' ? 'auth_otp_verify' : 'verify_login_otp';
            const r = await fetch(`${API_URL}?action=${act}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ticket, code: code.trim(), remember_device: true }),
            }).then(x => x.json());
            if (r.success) {
                try { if (r.device_token) localStorage.setItem(DEVICE_KEY, r.device_token); } catch { /* تجاهل */ }
                finish(r.data, r.jwt);
            } else { setErr(r.message || 'الرمز غير صحيح'); setCode(''); }
        } catch { setErr('تعذر الاتصال بالخادم'); }
        finally { setBusy(false); }
    };

    const field = 'w-full min-h-[52px] px-3 rounded-2xl bg-white/5 border border-white/10 text-[15px] outline-none focus:border-[#c5a059]';

    return (
        <div dir="rtl" className="min-h-screen bg-[#0b1220] text-white font-cairo flex flex-col justify-center px-5"
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
            <div className="text-center mb-7">
                <img src="/images/app-icon-512.png" alt="" className="w-20 h-20 mx-auto rounded-2xl"
                    onError={e => { e.currentTarget.style.display = 'none'; }} />
                <h1 className="text-[24px] font-black mt-4">مشتريات سماك</h1>
                <p className="text-[13px] text-slate-400 mt-1">سجّل دخولك بحسابك في سماك</p>
            </div>

            {!ticket ? (
                <form onSubmit={login} className="space-y-3">
                    <input type="email" inputMode="email" autoComplete="username" value={email}
                        onChange={e => setEmail(e.target.value)} placeholder="البريد الإلكتروني"
                        className={field} dir="ltr" />
                    <input type="password" autoComplete="current-password" value={pass}
                        onChange={e => setPass(e.target.value)} placeholder="كلمة المرور" className={field} dir="ltr" />
                    {err && <div className="rounded-xl bg-red-500/15 text-red-300 p-3 text-xs font-bold">{err}</div>}
                    <button type="submit" disabled={busy}
                        className="w-full min-h-[52px] rounded-2xl bg-[#c5a059] text-[#0b1220] text-[16px] font-black flex items-center justify-center gap-2 disabled:opacity-60">
                        {busy ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />} دخول
                    </button>
                    <button type="button" onClick={codeLogin} disabled={busy || !email.trim()}
                        className="w-full min-h-[48px] rounded-2xl bg-white/10 text-[14px] font-bold flex items-center justify-center gap-2 disabled:opacity-40">
                        <KeyRound size={16} /> دخول برمز بدل كلمة المرور
                    </button>
                </form>
            ) : (
                <form onSubmit={verify} className="space-y-3">
                    <p className="text-[13px] text-slate-300 text-center">
                        أرسلنا رمز التحقق{sentTo ? ' إلى ' + sentTo : ''} — أدخله للمتابعة
                    </p>
                    <input inputMode="numeric" autoComplete="one-time-code" value={code}
                        onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="رمز التحقق"
                        className={field + ' text-center tracking-[0.4em] font-black'} />
                    {err && <div className="rounded-xl bg-red-500/15 text-red-300 p-3 text-xs font-bold">{err}</div>}
                    <button type="submit" disabled={busy}
                        className="w-full min-h-[52px] rounded-2xl bg-[#c5a059] text-[#0b1220] text-[16px] font-black flex items-center justify-center gap-2 disabled:opacity-60">
                        {busy ? <Loader2 size={18} className="animate-spin" /> : <KeyRound size={18} />} تأكيد
                    </button>
                    <button type="button" onClick={() => { setTicket(null); setCode(''); setErr(''); setFlow('password'); }}
                        className="w-full min-h-[44px] text-xs font-bold text-slate-400">رجوع</button>
                </form>
            )}

            <div className="mt-8">
                <InstallApp label="ثبّت التطبيق على الشاشة الرئيسية" className="!bg-white/10 !text-white"
                    hint="يُفتح بعدها من أيقونته مباشرة" />
            </div>
        </div>
    );
}
