import React, { useState, useEffect } from 'react';
import { Download, Share, PlusSquare, X, Smartphone } from 'lucide-react';

// ─── زر تثبيت التطبيق على الجوال ─────────────────────────────────────────────
// أندرويد: نافذة التثبيت الأصلية بضغطة واحدة عبر beforeinstallprompt.
// آيفون: آبل لا تتيح تثبيتاً برمجياً، فنعرض الخطوات مصوّرة داخل التطبيق.
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches
    || window.navigator.standalone === true;

export default function InstallApp({ label = 'ثبّت التطبيق على جوالك', hint = '', className = '' }) {
    const [prompt, setPrompt] = useState(null);
    const [showIos, setShowIos] = useState(false);
    const [done, setDone] = useState(false);
    const [installed, setInstalled] = useState(() => { try { return isStandalone(); } catch { return false; } });

    useEffect(() => {
        const onPrompt = e => { e.preventDefault(); setPrompt(e); };
        const onInstalled = () => { setInstalled(true); setDone(true); };
        window.addEventListener('beforeinstallprompt', onPrompt);
        window.addEventListener('appinstalled', onInstalled);
        return () => {
            window.removeEventListener('beforeinstallprompt', onPrompt);
            window.removeEventListener('appinstalled', onInstalled);
        };
    }, []);

    if (installed) return null;

    const ios = (() => { try { return isIOS(); } catch { return false; } })();
    // لا نعرض الزر على الحاسب حيث لا معنى للتثبيت على الشاشة الرئيسية
    if (!prompt && !ios) return null;

    const click = async () => {
        if (prompt) {
            prompt.prompt();
            try { const r = await prompt.userChoice; if (r.outcome === 'accepted') setDone(true); } catch { /* تجاهل */ }
            setPrompt(null);
        } else {
            setShowIos(true);
        }
    };

    return (
        <>
            <button type="button" onClick={click}
                className={'w-full min-h-[52px] rounded-2xl bg-[#c5a059] text-[#0b1220] text-[15px] font-black flex items-center justify-center gap-2 active:scale-[.99] transition ' + className}>
                <Download size={18} /> {done ? 'تم التثبيت' : label}
            </button>
            {hint && <p className="text-[11px] text-slate-400 text-center mt-1.5">{hint}</p>}

            {showIos && (
                <div className="fixed inset-0 bg-black/70 z-[100] flex items-end justify-center p-4" onClick={() => setShowIos(false)}>
                    <div dir="rtl" className="bg-[#0f1e36] text-white rounded-3xl w-full max-w-sm p-5 space-y-4 font-cairo"
                        onClick={e => e.stopPropagation()}
                        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)' }}>
                        <div className="flex items-center justify-between">
                            <h3 className="font-black flex items-center gap-2"><Smartphone size={18} className="text-[#c5a059]" /> التثبيت على الآيفون</h3>
                            <button onClick={() => setShowIos(false)} className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center"><X size={16} /></button>
                        </div>
                        <p className="text-[13px] text-slate-300 leading-relaxed">
                            آبل لا تسمح للمواقع بتثبيت نفسها، والخطوتان التاليتان تكفيان مرة واحدة فقط:
                        </p>
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 bg-white/5 rounded-2xl p-3">
                                <div className="w-10 h-10 rounded-xl bg-[#c5a059] text-[#0b1220] flex items-center justify-center font-black shrink-0">١</div>
                                <div className="flex-1 text-[13px] font-bold">اضغط زر المشاركة في أسفل سفاري</div>
                                <Share size={20} className="text-[#c5a059] shrink-0" />
                            </div>
                            <div className="flex items-center gap-3 bg-white/5 rounded-2xl p-3">
                                <div className="w-10 h-10 rounded-xl bg-[#c5a059] text-[#0b1220] flex items-center justify-center font-black shrink-0">٢</div>
                                <div className="flex-1 text-[13px] font-bold">اختر «إضافة إلى الشاشة الرئيسية»</div>
                                <PlusSquare size={20} className="text-[#c5a059] shrink-0" />
                            </div>
                        </div>
                        <p className="text-[11px] text-slate-400">
                            لو كنت تتصفح من كروم على الآيفون فافتح الرابط في سفاري أولاً — التثبيت من سفاري فقط.
                        </p>
                        <button onClick={() => setShowIos(false)}
                            className="w-full min-h-[48px] rounded-2xl bg-white/10 text-sm font-bold">فهمت</button>
                    </div>
                </div>
            )}
        </>
    );
}
