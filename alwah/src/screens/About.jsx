import React from 'react';
import { BookOpen, Layers, RotateCcw, Radio, BellRing, Mic, BookText, ShieldCheck } from 'lucide-react';
import { Card, Section } from '../ui';

// ─── حول ألواح: ما هو، وكيف يُحسب الورد، ومن أين جاءت النصوص ─────────────────
export default function About() {
    return (
        <div className="space-y-5 pb-6">
            <Card className="p-5 text-center space-y-2">
                <img src="./icon-192.png" alt="" className="w-16 h-16 rounded-2xl mx-auto" />
                <h1 className="text-[20px] font-bold text-ink">ألواح</h1>
                <p className="text-[13px] text-ink-2 leading-7">
                    تطبيقٌ لمتابعة حفظ القرآن في البيت: لكل فردٍ مصحفه وورده وتسميعه،
                    ولكل أسرةٍ بياناتها وحدها.
                </p>
                <p className="font-quran text-[17px] text-brand leading-9">وَلَقَدْ يَسَّرْنَا ٱلْقُرْءَانَ لِلذِّكْرِ فَهَلْ مِن مُّدَّكِرٍ</p>
            </Card>

            <Section title="الورد">
                <Card className="p-4 space-y-3 text-[13px] leading-7 text-ink-2">
                    <Line icon={BookOpen} c="#1f5f4a" t="الحفظ الجديد">
                        مقدار اليوم من موضع الحافظ. ومن يحفظ من جهة الناس يمضي سورةً سورة، وكل سورةٍ من أوّلها إلى آخرها.
                    </Line>
                    <Line icon={Layers} c="#b8893a" t="الألواح">
                        آخر ما حُفظ، يُعاد يومياً حتى يثبت.
                    </Line>
                    <Line icon={RotateCcw} c="#0e7490" t="المراجعة">
                        دورةٌ على المحفوظ كلّه، تبدأ من الجزء الثلاثين وتصعد، ثم تعود.
                    </Line>
                    <p className="pt-1 border-t border-paper-2">
                        الورد يحدّده المشرف ويبقى حتى يغيّره، ولا يتقدّم شيءٌ إلا بإجازته بـ«تمّ التسميع».
                        وما لم يُسمَّع يعود غداً كما هو. والحفظ الجديد لا يُجاز قبل الألواح والمراجعة.
                    </p>
                </Card>
            </Section>

            <Section title="ما في التطبيق">
                <Card className="p-4 space-y-3 text-[13px] leading-7 text-ink-2">
                    <Line icon={BookText} c="#7c3aed" t="مصحف لكل فرد">
                        مصحف المدينة بخطّ صفحاته، وتُعلَّم عليه أخطاء كل حافظٍ وتنبيهاته، فيرى مواضع ضعفه.
                    </Line>
                    <Line icon={Mic} c="#dc2626" t="المُسمِع">
                        تلاوة الشيخ محمد أيوب من أيّ آيةٍ إلى أيّ آية، بتكرار المقطع أو الآية، والمصحف يتبع التلاوة.
                    </Line>
                    <Line icon={Radio} c="#0e7490" t="جلسة الذكر">
                        مجلس الأسرة بالصوت والصورة ومصحفٍ مشترك، لأفراد الأسرة وحدهم.
                    </Line>
                    <Line icon={BellRing} c="#b8893a" t="التذكير">
                        إشعارٌ بورد اليوم بعد الفجر، وتذكيرٌ عصراً ومساءً بما لم يُسمَّع.
                    </Line>
                </Card>
            </Section>

            <Section title="المصادر">
                <Card className="p-4 space-y-2.5 text-[13px] leading-7 text-ink-2">
                    <p><b className="text-ink">نصّ المصحف وخطوطه:</b> مصحف المدينة برواية حفص، بخطوط مجمع الملك فهد لطباعة المصحف الشريف (QCF)، عبر واجهة quran.com.</p>
                    <p><b className="text-ink">التلاوة:</b> الشيخ محمد أيوب رحمه الله، من مكتبة everyayah.com.</p>
                    <p><b className="text-ink">التفسير:</b> «المختصر في التفسير» لمركز تفسير للدراسات القرآنية، و«التفسير الميسر» لمجمع الملك فهد، و«تيسير الكريم الرحمن» للشيخ عبد الرحمن السعدي.</p>
                    <p><b className="text-ink">سبب النزول:</b> يُؤخذ ممّا صرّح به المفسّرون: من «المختصر في التفسير» ثم «الميسر» ثم «السعدي»، فإن لم يذكروه فمن «الوجيز» لأبي الحسن الواحدي صاحب «أسباب النزول»، مع التنبيه إلى أنّه من التفاسير المتقدّمة وفي مروياتها ما يحتاج تحقيقاً.</p>
                    <p className="text-[12px] text-ink-3 leading-6">
                        النصوص تُعرض باسم كتابها ومؤلّفه كما هي، ولا يضيف التطبيق من عنده شيئاً. وما لم يُذكر فيه سبب نزولٍ في المصدر يُقال فيه ذلك صراحةً.
                        ومن أراد التوسّع فليرجع إلى كتب التفسير وأهل العلم.
                    </p>
                </Card>
            </Section>

            <Section title="الخصوصية">
                <Card className="p-4 text-[13px] leading-7 text-ink-2">
                    <Line icon={ShieldCheck} c="#1f5f4a" t="بيانات كل أسرةٍ لها">
                        لا ترى أسرةٌ بيانات أخرى، ولا يرى الفرد إلا ورده ومصحفه. والمشرف يرى أفراد أسرته وحدهم.
                    </Line>
                </Card>
            </Section>

            <p className="text-center text-[11px] text-ink-3 leading-6">
                ألواح · alwah.semak.sa
                <span className="block">نسأل الله أن ينفع به، وأن يجعله في ميزان من أعان عليه.</span>
            </p>
        </div>
    );
}

function Line({ icon: I, c, t, children }) {
    return (
        <div className="flex items-start gap-2.5">
            <span className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-white" style={{ background: c }}><I size={15} /></span>
            <div className="flex-1 min-w-0">
                <div className="font-bold text-ink text-[13.5px]">{t}</div>
                <div>{children}</div>
            </div>
        </div>
    );
}
