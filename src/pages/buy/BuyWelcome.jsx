import React, { useState } from 'react';
import { ScanLine, Wallet, Package, Bot, ChevronLeft, ShieldCheck } from 'lucide-react';
import InstallApp from '../../components/InstallApp';

// ─── شاشة الترحيب — هوية سماك: كحلي #1a365d وذهبي #c5a059 ──────────────────
// المقاسات القياسية المطبّقة هنا:
//   • أصغر مساحة لمس 48×48 (Material) و44×44 (iOS HIG) — كل زر لا يقل عن 48
//   • هوامش جانبية 16 نقطة، وتباعد رأسي 8/16/24
//   • عنوان 28، عنوان فرعي 17، نص 15، ثانوي 13 — تقارب مقياس iOS النصي
//   • مناطق آمنة أعلى وأسفل عبر env(safe-area-inset-*) لشاشات النوتش
const FEATURES = [
    {
        k: 'scan', icon: ScanLine, t: 'صوّر الفاتورة وتنقرأ',
        d: 'صوّر فاتورة المورد ويقرأها المعالج الذكي: اسم المورد ورقم الفاتورة وتاريخها ومبالغها وبنودها، ويطابق كل بند بأقرب صنف في أصنافنا ويعرض عليك آخر سعر اشتريناه به. تراجع وتصحّح ثم تعتمد — لا يُحفظ شيء قبل اعتمادك.',
    },
    {
        k: 'pay', icon: Wallet, t: 'سجل السداد وإيصاله',
        d: 'مع كل فاتورة تسجل إن سُدِّدت: المبلغ وطريقة السداد (تحويل، نقدي، شيك، بطاقة) والبنك والمرجع وتاريخه، وترفق صورة الإيصال. يُحفظ للمورد سجل دفعات كامل، والمتبقي يُحدَّث تلقائياً.',
    },
    {
        k: 'prices', icon: Package, t: 'أسعارنا في جيبك',
        d: 'قبل ما تشتري، شف آخر سعر اشترينا به الصنف ومن أي مورد، ونسبة تغيره عن المرة السابقة وأدنى وأعلى سعر دفعناه. الأصناف مرتبة بالأكثر طلباً.',
    },
    {
        k: 'ai', icon: Bot, t: 'اسأل بلغتك',
        d: 'اسأل عن أي مورد أو صنف أو فاتورة بالعربي: كم صرفنا عليه، من أرخص مورد، وش ارتفع سعره. المساعد يقرأ بياناتنا مباشرة ويجيب بأرقام حقيقية في حدود صلاحيتك.',
    },
];

export default function BuyWelcome({ onStart, userName = '' }) {
    const [open, setOpen] = useState(null);

    return (
        <div dir="rtl" className="min-h-screen bg-[#0b1220] text-white font-cairo flex flex-col"
            style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
            <div className="px-4 pt-10 pb-6 text-center">
                <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-bl from-[#1a365d] to-[#2d5299] border border-[#c5a059]/40 flex items-center justify-center">
                    <img src="/images/favicon.png" alt="" className="w-9 h-9 object-contain"
                        onError={e => { e.currentTarget.style.display = 'none'; }} />
                </div>
                <h1 className="text-[28px] leading-tight font-black mt-4">مشتريات سماك</h1>
                <p className="text-[15px] text-slate-400 mt-1">
                    {userName ? `يا هلا ${userName} — ` : ''}فاتورة تُصوَّر، وسعر يُعرف، وسداد يُوثَّق
                </p>
            </div>

            <div className="flex-1 px-4 space-y-3">
                {FEATURES.map(f => {
                    const Icon = f.icon;
                    const on = open === f.k;
                    return (
                        <button key={f.k} onClick={() => setOpen(on ? null : f.k)}
                            className={'w-full text-right rounded-2xl border transition-all overflow-hidden ' +
                                (on ? 'bg-[#1a365d]/60 border-[#c5a059]/60' : 'bg-white/[0.04] border-white/10')}>
                            <div className="flex items-center gap-3 p-4 min-h-[64px]">
                                <div className={'w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ' +
                                    (on ? 'bg-[#c5a059] text-[#0b1220]' : 'bg-white/10 text-[#c5a059]')}>
                                    <Icon size={21} />
                                </div>
                                <div className="flex-1 text-[15px] font-black">{f.t}</div>
                                <ChevronLeft size={18} className={'text-slate-500 transition-transform ' + (on ? '-rotate-90' : '')} />
                            </div>
                            {on && <p className="px-4 pb-4 text-[13px] leading-relaxed text-slate-300">{f.d}</p>}
                        </button>
                    );
                })}
            </div>

            <div className="p-4 space-y-3">
                <div className="flex items-center justify-center gap-1.5 text-[12px] text-slate-500">
                    <ShieldCheck size={14} /> بياناتك داخل نظام سماك، وكل إدخال باسمك
                </div>
                <InstallApp label="ثبّت التطبيق على الشاشة الرئيسية" className="!bg-white/10 !text-white" />
                <button onClick={onStart}
                    className="w-full min-h-[52px] rounded-2xl bg-[#c5a059] text-[#0b1220] text-[17px] font-black active:scale-[.99] transition">
                    ابدأ
                </button>
            </div>
        </div>
    );
}
