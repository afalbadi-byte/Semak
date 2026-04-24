import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Shield, Scale } from 'lucide-react';

export default function LegalPage({ title, navigateTo }) {
  const navigate = useNavigate();

  return (
    <div className="pt-32 pb-20 bg-slate-50 min-h-screen animate-fadeIn">
      <div className="container mx-auto px-6 max-w-4xl text-right">
        <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-xl border border-slate-100 relative overflow-hidden">
          
          {/* زخرفة خلفية */}
          <div className="absolute top-0 left-0 w-full h-2 bg-[#c5a059]" />
          <div className="absolute top-0 left-0 w-64 h-64 bg-[#c5a059]/5 rounded-br-full pointer-events-none -z-0" />

          {/* رأس الصفحة */}
          <div className="flex justify-between items-center mb-10 relative z-10 border-b border-slate-100 pb-6">
            <h1 className="text-3xl md:text-4xl font-black text-[#1a365d] flex items-center gap-3">
              {title === "سياسة الخصوصية" ? <Shield className="text-[#c5a059]" size={36} /> : <Scale className="text-[#c5a059]" size={36} />}
              {title}
            </h1>
            <button onClick={() => navigateTo ? navigateTo("home") : navigate("/")} className="text-slate-400 hover:text-[#c5a059] bg-slate-50 hover:bg-orange-50 p-3 rounded-full transition">
              <ArrowRight size={24} />
            </button>
          </div>

          {/* المحتوى */}
          <div className="prose prose-lg text-slate-600 space-y-8 relative z-10 font-medium leading-loose">
            
            {title === "سياسة الخصوصية" && (
              <>
                <p className="text-lg font-bold text-[#1a365d]">
                  نحرص في <span className="text-[#c5a059]">سماك العقارية</span> على حماية خصوصية بيانات عملائنا وزوار موقعنا الإلكتروني. توضح هذه السياسة كيفية جمعنا للمعلومات، واستخدامها، وحمايتها.
                </p>

                <div>
                  <h3 className="text-xl font-black text-[#1a365d] mb-3">1. البيانات التي نجمعها</h3>
                  <p>نقوم بجمع المعلومات التي تقدمها لنا طواعية عند استخدامك للموقع، وتشمل:</p>
                  <ul className="list-disc list-inside pr-4 space-y-2 mt-2">
                    <li>المعلومات الشخصية (مثل: الاسم، رقم الجوال، البريد الإلكتروني).</li>
                    <li>المعلومات العقارية (مثل: الوحدة التي ترغب بحجزها أو تمتلكها).</li>
                    <li>البيانات المرفقة في طلبات الصيانة والتواصل المباشر.</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-black text-[#1a365d] mb-3">2. كيف نستخدم معلوماتك؟</h3>
                  <p>نستخدم البيانات التي نجمعها للأغراض التالية:</p>
                  <ul className="list-disc list-inside pr-4 space-y-2 mt-2">
                    <li>الرد على استفساراتك وتقديم خدمات الدعم الفني.</li>
                    <li>إدارة طلبات الصيانة ومتابعة مهام التسليم عبر بوابة الملاك.</li>
                    <li>تحسين جودة خدماتنا ومشاريعنا العقارية.</li>
                    <li>إرسال التحديثات الهامة، والعروض الخاصة (بإمكانك إلغاء الاشتراك في أي وقت).</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-black text-[#1a365d] mb-3">3. حماية ومشاركة البيانات</h3>
                  <p>
                    نلتزم بعدم بيع أو تأجير بياناتك الشخصية لأي جهة خارجية. قد نقوم بمشاركة بعض البيانات مع شركائنا الموثوقين (مثل فرق الصيانة والمقاولين) بالقدر اللازم فقط لتنفيذ الخدمات المطلوبة منك (مثل إصلاح الأعطال في وحدتك). نتخذ كافة التدابير الأمنية والتقنية اللازمة لحماية بياناتك من الوصول غير المصرح به.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-black text-[#1a365d] mb-3">4. حقوق المستخدم</h3>
                  <p>
                    يحق لك في أي وقت طلب الوصول إلى بياناتك الشخصية، أو تصحيحها، أو طلب حذفها من سجلاتنا بالتواصل مع إدارة الموقع عبر قنوات التواصل المعتمدة.
                  </p>
                </div>

                <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100">
                  <p className="text-sm font-bold text-blue-800">
                    * تحتفظ سماك العقارية بالحق في تحديث سياسة الخصوصية هذه متى دعت الحاجة، وسيتم نشر أي تعديلات على هذه الصفحة.
                  </p>
                </div>
              </>
            )}

            {title === "الشروط والأحكام" && (
              <>
                <p className="text-lg font-bold text-[#1a365d]">
                  مرحباً بك في الموقع الإلكتروني لشركة <span className="text-[#c5a059]">سماك العقارية</span>. بوصولك واستخدامك لهذا الموقع، فإنك توافق على الالتزام بالشروط والأحكام التالية:
                </p>

                <div>
                  <h3 className="text-xl font-black text-[#1a365d] mb-3">1. استخدام الموقع</h3>
                  <p>
                    يُسمح باستخدام هذا الموقع لأغراض مشروعة فقط، وتتعهد بعدم استخدامه بطريقة تسيء للشركة أو تضر بالموقع أو تعطله. جميع المعلومات المقدمة من قبلك (مثل طلبات الحجز والصيانة) يجب أن تكون صحيحة ومحدثة.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-black text-[#1a365d] mb-3">2. الملكية الفكرية</h3>
                  <p>
                    جميع المحتويات الموجودة على هذا الموقع، بما في ذلك المخططات الهندسية، التصاميم، الصور، النصوص، والشعارات، هي ملكية حصرية لشركة "سماك العقارية" ومحمية بموجب قوانين حماية الملكية الفكرية في المملكة العربية السعودية. يُمنع منعاً باتاً نسخها أو إعادة استخدامها بدون إذن كتابي مسبق.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-black text-[#1a365d] mb-3">3. دقة المعلومات العقارية</h3>
                  <p>
                    نحرص على أن تكون المعلومات والمواصفات المعروضة للوحدات دقيقة ومحدثة. ومع ذلك، تُعد المخططات والصور ثلاثية الأبعاد (3D) تقريبية وتوضيحية، وقد تخضع لبعض التعديلات المعمارية البسيطة لأغراض تطويرية أو تنظيمية دون إشعار مسبق، ولا تُعد ملزمة تعاقدياً إلا بما يتم تدوينه في العقود الرسمية.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-black text-[#1a365d] mb-3">4. بوابة الملاك وطلبات الصيانة</h3>
                  <p>
                    بوابة الملاك مخصصة لعملاء سماك العقارية المعتمدين. عند تقديم طلب صيانة، فإنك تقر بأن العطل يقع ضمن فترة وشروط الضمان المبرمة في عقدك. للشركة الحق في رفض الطلبات الوهمية أو الناتجة عن سوء الاستخدام.
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-black text-[#1a365d] mb-3">5. القانون المطبق</h3>
                  <p>
                    تخضع هذه الشروط والأحكام وتُفسر وفقاً للأنظمة والقوانين المعمول بها في المملكة العربية السعودية. أي نزاع ينشأ عن استخدام هذا الموقع يخضع للاختصاص الحصري للمحاكم السعودية.
                  </p>
                </div>

              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}