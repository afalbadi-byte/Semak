// صفحات دخول ثابتة لتطبيقات PWA (buy / proj / qc).
//
// العطب الذي تعالجه: iOS يقرأ بطاقة التعريف وقت تحليل الترويسة، وindex.html
// يعلن البطاقة العامة (start_url:"/") ثم يبدّلها سكربت — بعد فوات الأوان.
// فأيقونة الشاشة الرئيسية كانت تفتح semak.sa لا semak.sa/buy.
// وكان ينقص apple-mobile-web-app-capable، فلا يفتح كتطبيق مستقل أصلا.
//
// الحل: نسخة من index.html لكل تطبيق، والوسوم مكتوبة فيها لا مُحقَنة بجافاسكربت.
import fs from 'fs';
import path from 'path';

const DIST = 'dist';
const APPS = [
  { slug: 'buy',  title: 'مشتريات سماك',  short: 'مشتريات' },
  { slug: 'proj', title: 'مشاريع سماك',   short: 'مشاريع'  },
  { slug: 'qc',   title: 'جودة سماك',     short: 'الجودة'  },
];

const src = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8');

for (const a of APPS) {
  let h = src;

  // إضافة Vite تحقن بطاقة تعريف ثانية في نهاية الترويسة. ومع بطاقتين يأخذ
  // كل متصفح واحدة — كروم الأولى وسفاري قد يأخذ الأخيرة. نمحوهما جميعا
  // ونضع واحدة صريحة، فلا يبقى للتخمين موضع.
  h = h.replace(/\s*<link rel="manifest"[^>]*>/g, '');
  h = h.replace('<link rel="apple-touch-icon" href="/logo.png" />',
    `<link rel="apple-touch-icon" href="/images/app-icon-512.png" />\n` +
    `    <link rel="manifest" href="/${a.slug}.webmanifest" />`);

  // بدونها يفتح iOS الرابط في سفاري بشريط العنوان، لا كتطبيق مستقل
  h = h.replace('<meta name="viewport"',
    `<meta name="apple-mobile-web-app-capable" content="yes" />\n` +
    `    <meta name="mobile-web-app-capable" content="yes" />\n` +
    `    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />\n` +
    `    <meta name="apple-mobile-web-app-title" content="${a.short}" />\n` +
    `    <meta name="viewport"`);

  h = h.replace(/<title>[\s\S]*?<\/title>/, `<title>${a.title}</title>`);

  // العطب الأصلي: iOS تقرأ og:url لتحديد الرابط عند «مشاركة»، لا شريط العنوان.
  // وكانت مثبّتة على الجذر، فأيقونة الشاشة الرئيسية تفتح semak.sa مهما فعلنا
  // ببطاقة التعريف.
  const url = `https://semak.sa/${a.slug}`;
  h = h.replace(/<meta property="og:url" content="[^"]*">/,
                `<meta property="og:url" content="${url}">`);
  h = h.replace(/<meta property="og:title" content="[^"]*">/,
                `<meta property="og:title" content="${a.title}">`);
  h = h.replace(/<meta name="twitter:title" content="[^"]*">/,
                `<meta name="twitter:title" content="${a.title}">`);
  h = h.replace(/<link rel="canonical" href="[^"]*"\s*\/?>/,
                `<link rel="canonical" href="${url}">`);

  const dir = path.join(DIST, a.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), h);
  console.log('✔ ' + path.join(dir, 'index.html'));
}
