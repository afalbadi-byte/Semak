import React, { useEffect, useState } from 'react';
import { ShieldCheck, Languages, Fingerprint, ScanFace, Clock, Eye, EyeOff } from 'lucide-react';
import { call, token } from '../lib/api';
import { t } from '../lib/i18n';
import { pkSupported, pkLogin, pkHere, pkCancelled } from '../lib/passkey';
import { Btn, Field, inputCls } from '../ui';

// ─── شعارٌ يُرسم أمامك: الإيصال يصعد، سطوره تُكتب، والعملة تسقط عليه ─────────
function AnimatedMark({ size = 112 }) {
    return (
        <svg viewBox="0 0 512 512" width={size} height={size} className="oh-mark drop-shadow-xl" aria-hidden="true">
            <defs>
                <linearGradient id="ohg" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#15877a" /><stop offset="1" stopColor="#0a4f47" />
                </linearGradient>
            </defs>
            <rect width="512" height="512" rx="116" fill="url(#ohg)" className="oh-tile" />
            <g className="oh-rcpt">
                <path d="M131 112 L347 112 L347 400 L331 419 L315 400 L299 419 L283 400 L267 419 L251 400 L235 419 L219 400 L203 419 L187 400 L171 419 L155 400 L139 419 L131 400 Z" fill="#fffdf9" />
                <rect className="oh-l1" x="162" y="155" width="130" height="15" rx="7.5" fill="#0f6b61" opacity=".55" />
                <rect className="oh-l2" x="162" y="194" width="152" height="15" rx="7.5" fill="#0f6b61" opacity=".55" />
                <rect className="oh-l3" x="162" y="233" width="106" height="15" rx="7.5" fill="#0f6b61" opacity=".55" />
                <rect className="oh-l4" x="162" y="292" width="74" height="22" rx="9" fill="#0f6b61" />
            </g>
            <g className="oh-coin">
                <circle cx="356" cy="376" r="82" fill="#e2a33b" stroke="#0f6b61" strokeWidth="15" />
                <circle cx="356" cy="376" r="43" fill="none" stroke="#fffdf9" strokeWidth="13" opacity=".85" />
            </g>
        </svg>
    );
}

// الدخول، أو التهيئة الأولى: أوّل حسابٍ يُنشأ هو المدير، ثم تُغلق التهيئة
export default function Login({ setup, onDone, lang, onLang, reason }) {
    const [f, setF] = useState({ username: '', password: '', name: '' });
    const [err, setErr] = useState('');
    const [busy, setBusy] = useState(false);
    const [bio, setBio] = useState(false);          // الجهاز يدعم البصمة/الوجه
    const [bioBusy, setBioBusy] = useState(false);
    const [show, setShow] = useState(false);
    // الدخلة كاملة في أول فتحٍ للجلسة، ومختصرة بعدها
    const [full] = useState(() => { try { return sessionStorage.getItem('ohda_intro') !== '1'; } catch (e) { return true; } });
    useEffect(() => { try { sessionStorage.setItem('ohda_intro', '1'); } catch (e) { /* تجاهل */ } }, []);
    useEffect(() => { if (!setup) pkSupported().then(setBio); }, [setup]);
    const set = k => e => setF({ ...f, [k]: e.target.value });
    const ios = /iPhone|iPad|Mac/.test(navigator.userAgent || '');
    const BioIcon = ios ? ScanFace : Fingerprint;

    const submit = async e => {
        e.preventDefault();
        setBusy(true); setErr('');
        const r = await call(setup ? 'setup' : 'login', { body: { ...f, lang } });
        setBusy(false);
        if (!r.success) { setErr(t(r.message || 'تعذّر الدخول')); return; }
        token.set(r.token);
        onDone({ via: 'password' });
    };

    const bioLogin = async () => {
        setErr(''); setBioBusy(true);
        try {
            const tk = await pkLogin();
            token.set(tk);
            onDone({ via: 'passkey' });
        } catch (e2) {
            if (!pkCancelled(e2)) setErr(t(e2.message || 'تعذّر التحقّق من البصمة'));
        }
        setBioBusy(false);
    };

    return (
        <div className={'oh-login min-h-screen bg-paper lg:grid lg:grid-cols-2 ' + (full ? 'oh-full' : 'oh-quick')}>
            {/* ── اللوحة الملوّنة: الشعار والاسم ── */}
            <section className="oh-hero relative overflow-hidden text-white flex flex-col items-center justify-center px-6 pt-16 pb-24 lg:pb-16 lg:min-h-screen"
                style={{ paddingTop: 'calc(env(safe-area-inset-top) + 56px)' }}>
                <span className="oh-orb oh-orb1" /><span className="oh-orb oh-orb2" /><span className="oh-orb oh-orb3" />
                <AnimatedMark />
                <h1 className="oh-title text-[34px] font-bold mt-5 tracking-tight">{t('عُهدة')}</h1>
                <p className="oh-sub text-[14px] text-white/75 mt-1 text-center max-w-xs">{t('عُهدتك ومصاريفك وإيصالاتك في مكانٍ واحد')}</p>
                <ul className="oh-sub hidden lg:flex flex-col gap-2 mt-10 text-[13px] text-white/80">
                    <li>✓ {t('صوّر الإيصال ويقرأه التطبيق لك')}</li>
                    <li>✓ {t('لكل غرضٍ عهدته ورصيده المستقل')}</li>
                    <li>✓ {t('كشف حساب PDF بروابط المستندات')}</li>
                </ul>
            </section>

            <button onClick={() => onLang(lang === 'en' ? 'ar' : 'en')}
                className="oh-sub fixed top-4 end-4 z-20 h-9 px-3 rounded-xl bg-white/15 lg:bg-paper-card lg:border lg:border-paper-2 text-white lg:text-ink-2 backdrop-blur text-[12px] font-bold flex items-center gap-1.5"
                style={{ marginTop: 'env(safe-area-inset-top)' }}>
                <Languages size={15} />{lang === 'en' ? 'عربي' : 'English'}
            </button>

            {/* ── بطاقة الدخول: تصعد فوق اللوحة على الجوّال ── */}
            <section className="relative z-10 -mt-14 lg:mt-0 px-5 pb-10 lg:flex lg:items-center lg:justify-center" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 28px)' }}>
                <div className="oh-card w-full max-w-sm mx-auto">
                    <div className="bg-paper-card rounded-3xl border border-paper-2 shadow-xl shadow-ink/5 p-6 space-y-4">
                        <div>
                            <h2 className="text-[19px] font-bold">{t(setup ? 'إعداد التطبيق' : 'أهلاً بك')}</h2>
                            <p className="text-[12.5px] text-ink-3 mt-0.5">{t(setup ? 'أنشئ حساب المدير لتبدأ' : 'سجّل دخولك لتكمل')}</p>
                        </div>

                        {reason === 'idle' ? (
                            <div className="flex gap-2 p-3 rounded-2xl bg-amber-50 text-amber-900 text-[12.5px] leading-6">
                                <Clock size={16} className="shrink-0 mt-1" />
                                <span>{t('خرجتَ تلقائياً بعد فترةٍ بلا نشاط، حمايةً لبياناتك.')}</span>
                            </div>
                        ) : null}

                        {setup ? (
                            <div className="flex gap-2.5 p-3 rounded-2xl bg-brand-50 text-brand-800 text-[12.5px] leading-6">
                                <ShieldCheck size={18} className="shrink-0 mt-0.5" />
                                <span>{t('أوّل حساب يُنشأ هنا هو المدير: يضيف المستخدمين ويربط Google Drive. وتُغلق هذه الصفحة بعده.')}</span>
                            </div>
                        ) : null}

                        {/* البصمة أولاً إن كانت مفعّلة على هذا الجهاز */}
                        {bio && !setup ? (
                            <>
                                <button type="button" onClick={bioLogin} disabled={bioBusy}
                                    className={'w-full h-14 rounded-2xl font-bold text-[15px] flex items-center justify-center gap-2.5 transition active:scale-[.98] disabled:opacity-60 ' +
                                        (pkHere() ? 'bg-brand text-white shadow-lg shadow-brand/25 oh-pulse' : 'bg-brand-50 text-brand-700 border border-brand-100')}>
                                    <BioIcon size={24} />{t(ios ? 'الدخول بـ Face ID' : 'الدخول بالبصمة')}
                                </button>
                                <div className="flex items-center gap-3 text-[11px] text-ink-3">
                                    <span className="flex-1 h-px bg-paper-2" />{t('أو بكلمة المرور')}<span className="flex-1 h-px bg-paper-2" />
                                </div>
                            </>
                        ) : null}

                        <form onSubmit={submit} className="space-y-4">
                            {setup ? (
                                <Field label={t('اسمك')}>
                                    <input className={inputCls} value={f.name} onChange={set('name')} autoComplete="name" required />
                                </Field>
                            ) : null}
                            <Field label={t('اسم الدخول')} hint={setup ? t('حروف إنجليزية صغيرة وأرقام') : null}>
                                <input className={inputCls} dir="ltr" value={f.username} onChange={set('username')}
                                    autoCapitalize="none" autoCorrect="off" autoComplete="username webauthn" required />
                            </Field>
                            <Field label={t('كلمة المرور')} hint={setup ? t('ثمانية أحرف فأكثر') : null}>
                                <div className="relative">
                                    <input className={inputCls + ' pe-11'} dir="ltr" type={show ? 'text' : 'password'} value={f.password} onChange={set('password')}
                                        autoComplete={setup ? 'new-password' : 'current-password'} required />
                                    <button type="button" onClick={() => setShow(v => !v)} aria-label={t(show ? 'إخفاء' : 'إظهار')}
                                        className="absolute end-1 top-1 w-9 h-9 rounded-lg text-ink-3 hover:bg-paper-2 flex items-center justify-center">
                                        {show ? <EyeOff size={17} /> : <Eye size={17} />}
                                    </button>
                                </div>
                            </Field>
                            {err ? <p className="text-[13px] text-red-700 font-semibold">{err}</p> : null}
                            <Btn className="w-full !h-12" kind={bio && pkHere() && !setup ? 'line' : 'primary'} busy={busy} type="submit">
                                {setup ? t('أنشئ حساب المدير') : t('دخول')}
                            </Btn>
                        </form>
                    </div>
                    {!setup ? <p className="text-center text-[12px] text-ink-3 mt-5">{t('الحسابات يُنشئها المدير — اطلب منه اسم دخولك')}</p> : null}
                </div>
            </section>
        </div>
    );
}
