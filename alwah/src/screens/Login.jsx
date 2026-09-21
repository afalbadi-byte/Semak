import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import { call, token } from '../lib/api';
import { Btn, Field, inputCls } from '../ui';

// ─── الدخول، أو فتح حسابٍ جديد لأسرة ────────────────────────────────────────
// من لا حساب له يسجّل بنفسه فيصير مشرف أسرته، ثم يضيف أفرادها من داخل حسابه.
export default function Login({ setup, onDone }) {
    const [f, setF] = useState({ family: '', name: '', username: '', password: '' });
    const [tab, setTab] = useState(setup ? 'new' : 'in');   // in: دخول · new: حساب جديد
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');
    const set = (k, v) => setF(x => ({ ...x, [k]: v }));
    const isNew = tab === 'new';

    const submit = async e => {
        e.preventDefault();
        setBusy(true); setErr('');
        const r = await call(isNew ? (setup ? 'setup' : 'register') : 'login', { body: f });
        setBusy(false);
        if (!r.success) { setErr(r.message || (isNew ? 'تعذّر إنشاء الحساب' : 'تعذّر الدخول')); return; }
        token.set(r.token);
        onDone();
    };

    return (
        <div className="min-h-screen bg-paper lg:flex" dir="rtl">
            <div className="al-hero relative overflow-hidden text-white px-6 pt-14 pb-12 lg:flex-1 lg:flex lg:flex-col lg:justify-center rounded-b-[36px] lg:rounded-none"
                style={{ paddingTop: 'calc(env(safe-area-inset-top) + 56px)' }}>
                <div className="absolute inset-0 al-pattern" />
                <div className="relative max-w-md mx-auto text-center">
                    <img src="./icon-512.png" alt="" className="al-rise w-24 h-24 mx-auto rounded-[28px] shadow-2xl" />
                    <h1 className="al-rise text-[34px] font-bold mt-5" style={{ animationDelay: '.1s' }}>ألواح</h1>
                    <p className="al-rise text-white/80 text-[14px] mt-1" style={{ animationDelay: '.2s' }}>متابعة حفظ القرآن للأسرة</p>
                    <p className="al-rise font-quran text-[22px] leading-[2] mt-6 text-[#f3e3bf]" style={{ animationDelay: '.3s' }}>
                        وَلَقَدْ يَسَّرْنَا الْقُرْآنَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ
                    </p>
                </div>
            </div>

            <div className="px-5 -mt-6 lg:mt-0 lg:flex-1 lg:flex lg:items-center relative">
                <form onSubmit={submit} className="al-rise bg-paper-card rounded-3xl border border-paper-2 shadow-card p-5 space-y-3 max-w-md mx-auto w-full"
                    style={{ animationDelay: '.35s' }}>
                    {!setup ? (
                        <div className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-paper-2">
                            {[['in', 'دخول'], ['new', 'حساب جديد']].map(([k, t]) => (
                                <button key={k} type="button" onClick={() => { setTab(k); setErr(''); }}
                                    className={'h-10 rounded-xl text-[13px] font-bold ' + (tab === k ? 'bg-paper-card text-ink shadow-card' : 'text-ink-3')}>{t}</button>
                            ))}
                        </div>
                    ) : null}
                    <h2 className="font-bold text-ink text-[17px]">{isNew ? 'حساب جديد لأسرتك' : 'تسجيل الدخول'}</h2>
                    {isNew ? (
                        <>
                            <p className="text-[12px] text-ink-3 leading-6">تصير مشرف أسرتك: تضيف أفرادها من داخل حسابك، وتعطي من تشاء دخولاً خاصاً به. ولا يرى أحدٌ بيانات أسرتك.</p>
                            <Field label="اسم الأسرة"><input className={inputCls} value={f.family} onChange={e => set('family', e.target.value)} placeholder="أسرة فلان" /></Field>
                            <Field label="اسمك"><input className={inputCls} value={f.name} onChange={e => set('name', e.target.value)} /></Field>
                        </>
                    ) : null}
                    <Field label="اسم الدخول">
                        <input className={inputCls} dir="ltr" autoCapitalize="none" autoComplete="username" value={f.username} onChange={e => set('username', e.target.value)} />
                    </Field>
                    <Field label="كلمة المرور">
                        <input className={inputCls} dir="ltr" type="password" autoComplete={isNew ? 'new-password' : 'current-password'} value={f.password} onChange={e => set('password', e.target.value)} />
                    </Field>
                    {err ? <div className="rounded-xl bg-red-50 text-red-700 p-3 text-[13px] font-semibold">{err}</div> : null}
                    <Btn className="w-full !h-12" busy={busy}><LogIn size={17} />{isNew ? 'أنشئ الحساب' : 'دخول'}</Btn>
                    {isNew ? <p className="text-[11px] text-ink-3 leading-6 text-center">بعد الإنشاء: الإعدادات ← أفراد الأسرة ← إضافة</p> : null}
                </form>
                <p className="text-center text-[11px] text-ink-3 mt-4 mb-8 lg:hidden">لا يحتاج الدخول إلا مرّة على كل جهاز</p>
            </div>
        </div>
    );
}
