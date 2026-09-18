import React, { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { call, token } from '../lib/api';
import { Btn, Field, inputCls } from '../ui';

// الدخول، أو التهيئة الأولى: أوّل حسابٍ يُنشأ هو المدير، ثم تُغلق التهيئة
export default function Login({ setup, onDone }) {
    const [f, setF] = useState({ username: '', password: '', name: '' });
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const set = k => e => setF({ ...f, [k]: e.target.value });

    const submit = async e => {
        e.preventDefault();
        setBusy(true); setErr('');
        const r = await call(setup ? 'setup' : 'login', { body: f });
        setBusy(false);
        if (!r.success) { setErr(r.message || 'تعذّر الدخول'); return; }
        token.set(r.token);
        onDone();
    };

    return (
        <div className="min-h-screen bg-paper flex items-center justify-center p-5" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <img src="./icon-192.png" alt="" className="w-20 h-20 rounded-[22px] mx-auto shadow-lg shadow-brand/20" />
                    <h1 className="text-2xl font-bold mt-4">عُهدة</h1>
                    <p className="text-[13px] text-ink-3 mt-1">عُهدتك ومصاريفك وإيصالاتك في مكانٍ واحد</p>
                </div>

                <form onSubmit={submit} className="bg-paper-card rounded-3xl border border-paper-2 shadow-card p-6 space-y-4">
                    {setup ? (
                        <div className="flex gap-2.5 p-3 rounded-2xl bg-brand-50 text-brand-800 text-[12.5px] leading-6">
                            <ShieldCheck size={18} className="shrink-0 mt-0.5" />
                            <span>أوّل حساب يُنشأ هنا هو <b>المدير</b>: يضيف المستخدمين ويربط Google Drive. وتُغلق هذه الصفحة بعده.</span>
                        </div>
                    ) : null}
                    {setup ? (
                        <Field label="اسمك">
                            <input className={inputCls} value={f.name} onChange={set('name')} autoComplete="name" required />
                        </Field>
                    ) : null}
                    <Field label="اسم الدخول" hint={setup ? 'حروف إنجليزية صغيرة وأرقام' : null}>
                        <input className={inputCls} dir="ltr" value={f.username} onChange={set('username')}
                            autoCapitalize="none" autoCorrect="off" autoComplete="username" required />
                    </Field>
                    <Field label="كلمة المرور" hint={setup ? 'ثمانية أحرف فأكثر' : null}>
                        <input className={inputCls} dir="ltr" type="password" value={f.password} onChange={set('password')}
                            autoComplete={setup ? 'new-password' : 'current-password'} required />
                    </Field>
                    {err ? <p className="text-[13px] text-red-700 font-semibold">{err}</p> : null}
                    <Btn className="w-full" busy={busy} type="submit">{setup ? 'أنشئ حساب المدير' : 'دخول'}</Btn>
                </form>
                {!setup ? <p className="text-center text-[12px] text-ink-3 mt-5">الحسابات يُنشئها المدير — اطلب منه اسم دخولك</p> : null}
            </div>
        </div>
    );
}
