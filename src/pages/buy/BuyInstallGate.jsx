import React, { useEffect, useState } from 'react';
import { Smartphone, ShieldCheck, RefreshCw } from 'lucide-react';
import InstallApp from '../../components/InstallApp';

// ─── بوابة التثبيت: التطبيق يُستخدم مثبَّتاً على الجوال لا من داخل المتصفح ───
// السبب عملي: النسخة المثبَّتة تفتح بملء الشاشة، وتحتفظ بالجلسة والكاميرا،
// ولا تضيع بين تبويبات المتصفح. أما الحاسب فيُستخدم من اللوحة لا من هنا.
export default function BuyInstallGate() {
    const [checking, setChecking] = useState(false);
    const [oneTap, setOneTap] = useState(() => (typeof window !== 'undefined' && !!window.__bip));
    useEffect(() => {
        const on = () => setOneTap(true);
        window.addEventListener('bip-ready', on);
        window.addEventListener('beforeinstallprompt', on);
        return () => { window.removeEventListener('bip-ready', on); window.removeEventListener('beforeinstallprompt', on); };
    }, []);
    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
        || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

    // لو ثُبّت في نافذة أخرى، تحديث الصفحة يكفي للدخول
    useEffect(() => {
        const onInstalled = () => window.location.reload();
        window.addEventListener('appinstalled', onInstalled);
        return () => window.removeEventListener('appinstalled', onInstalled);
    }, []);

    return (
        <div dir="rtl" className="min-h-screen bg-[#0b1220] text-white font-cairo flex flex-col justify-center px-5"
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}>
            <div className="text-center">
                <img src="/images/app-icon-512.png" alt="" className="w-24 h-24 mx-auto rounded-3xl shadow-2xl"
                    onError={e => { e.currentTarget.style.display = 'none'; }} />
                <h1 className="text-[24px] font-black mt-5">مشتريات سماك</h1>
                <p className="text-[14px] text-slate-300 mt-2 leading-relaxed">
                    ثبّت التطبيق على جوالك للمتابعة
                </p>
            </div>

            <div className="mt-7 space-y-3">
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex items-start gap-3">
                    <Smartphone size={18} className="text-[#c5a059] mt-0.5 shrink-0" />
                    <p className="text-[13px] text-slate-300 leading-relaxed">
                        النسخة المثبّتة تفتح بملء الشاشة، وتفتح الكاميرا لتصوير الفواتير مباشرة،
                        وتبقيك مسجّل الدخول فلا تعيد الدخول كل مرة.
                    </p>
                </div>
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4 flex items-start gap-3">
                    <ShieldCheck size={18} className="text-[#c5a059] mt-0.5 shrink-0" />
                    <p className="text-[13px] text-slate-300 leading-relaxed">
                        بعد التثبيت افتح التطبيق من أيقونته على الشاشة الرئيسية — لا من المتصفح.
                    </p>
                </div>
            </div>

            <div className="mt-7">
                <InstallApp label={ios ? 'كيف أثبّته على الآيفون؟' : (oneTap ? 'ثبّت التطبيق الآن' : 'كيف أثبّته؟')} />
                {!ios && !oneTap && (
                    <p className="text-[11px] text-slate-500 text-center mt-2">
                        إن لم يظهر التثبيت بنقرة واحدة فحدّث الصفحة، أو ثبّته من قائمة كروم
                    </p>
                )}
                <button onClick={() => { setChecking(true); window.location.reload(); }}
                    className="w-full min-h-[48px] mt-3 rounded-2xl bg-white/10 text-sm font-bold flex items-center justify-center gap-2">
                    {checking ? <RefreshCw size={15} className="animate-spin" /> : null} ثبّتُّه — افتح التطبيق
                </button>
            </div>
        </div>
    );
}
