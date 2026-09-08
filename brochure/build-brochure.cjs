// ════════════════════════════════════════════════════════════════════════════
//  بروشور «سماك البوابة» — HTML متصل (سكرول) بعرض A4 بورتريه، بلا قواطع صفحات.
//  هوية سماك الرسمية: كحلي #1a365d / ذهبي #c5a059 / داكن #0a0f1e — خط Cairo.
//   • صفحة مستقلة لكل وحدة: المخطط + مواصفات مطابقة لمحتوى الموقع.
//   • أيقونات ذهبية رسمية (بلا ألوان)، واتساب ذهبي، هاتف قابل للضغط (tel:).
//   • صفحات: غلاف · معرض · مميزات · وحدات · ضمانات · موقع · تواصل.
//   • علامة مائية بنمط سماك، بيانات التواصل في كل صفحة، شعار فال الرسمي.
// ════════════════════════════════════════════════════════════════════════════
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const IMG = path.join(ROOT, 'public/images');
const LITE = path.join(__dirname, 'lite');
const b64 = (p, mime) => `data:${mime};base64,` + fs.readFileSync(p).toString('base64');
const png = (p) => b64(p, 'image/png');
const lpng = (name) => b64(path.join(LITE, name), 'image/png');   // نسخة مُحسّنة (أخفّ)
const ljpg = (name) => b64(path.join(LITE, name), 'image/jpeg');  // نسخة مُحسّنة (أخفّ)

// ─── أصول الهوية ─────────────────────────────────────────────────────────────
const LOGO_GOLD = png(path.join(__dirname, 'logo-gold-hd.png'));
const FAL_LOGO  = png(path.join(__dirname, 'fal-logo.png'));
const WMARK     = lpng('watermark.png');
const PLAN_A = lpng('plan-a-dark.png');
const PLAN_B = lpng('plan-b-dark.png');
const PLAN_ROOF = lpng('plan-roof-dark.png');

const HERO_BLD = ljpg('exterior-front.jpg');
const AERIAL   = ljpg('project-aerial.jpg');
const PARKING  = ljpg('parking.jpg');
// خريطة بهوية سماك على أرضية OpenStreetMap (ODbL — الإسناد داخل الصورة)
const MAP_IMG  = ljpg('map-brand.jpg');
const MAKKAH   = ljpg('makkah.jpg');
const PH = {
  extCorner: ljpg('exterior-corner.jpg'), extSide: ljpg('exterior-side.jpg'),
  lobby: ljpg('interior-lobby.jpg'), living: ljpg('interior-living.jpg'),
  kitchen: ljpg('interior-kitchen.jpg'), bed: ljpg('interior-bedroom.jpg'),
  bath: ljpg('interior-bathroom.jpg'), corridor: ljpg('interior-corridor.jpg'),
};

// ─── إعدادات ─────────────────────────────────────────────────────────────────
const WA      = '966920032842';
const PHONE   = '920032842';
const FAL_AD  = '7201055174';
const FAL_LIC = '1200043676';
const SITE    = 'Semak.sa';
const MAPS_URL = 'https://www.google.com/maps/search/?api=1&query=21.379472,39.716935';
const VIDEO_URL = 'https://brochure.semak.sa/video.html';
const TAGLINE = 'سقفٌ يعلو برؤيتك، ومسكنٌ يحكي قصتك';

// ─── أيقونات ذهبية رسمية (مسارات Lucide — نفس أيقونات الموقع) ─────────────────
const G = '#c5a059';
const ICONS = {
  play: '<circle cx="12" cy="12" r="10"/><path d="m10 8 6 4-6 4Z"/>',
  ruler: '<path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/>',
  bed: '<path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/>',
  user: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/>',
  drops: '<path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 4.24 7 2c-.29 2.24-1.14 4.13-2.29 5.06S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A11 11 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a7 7 0 0 1-11.91 4.97"/>',
  finger: '<path d="M12 10a2 2 0 0 0-2 2c0 1.02-.1 2.51-.26 4"/><path d="M14 13.12c0 2.38 0 6.38-1 8.88"/><path d="M17.29 21.02c.12-.6.43-2.3.5-3.02"/><path d="M2 12a10 10 0 0 1 18-6"/><path d="M2 16h.01"/><path d="M21.8 16c.2-2 .131-5.354 0-6"/><path d="M5 19.5C5.5 18 6 15 6 12a6 6 0 0 1 .34-2"/><path d="M8.65 22c.21-.66.45-1.32.57-2"/><path d="M9 6.8a6 6 0 0 1 9 5.2v2"/>',
  wifi: '<path d="M12 20h.01"/><path d="M2 8.82a15 15 0 0 1 20 0"/><path d="M5 12.86a10 10 0 0 1 14 0"/><path d="M8.5 16.43a5 5 0 0 1 7 0"/>',
  box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
  car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
  layers: '<path d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z"/><path d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65"/><path d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65"/>',
  bath: '<path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.68 3 4 3.68 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/><line x1="10" x2="8" y1="5" y2="7"/><line x1="2" x2="22" y1="12" y2="12"/><line x1="7" x2="7" y1="19" y2="21"/><line x1="17" x2="17" y1="19" y2="21"/>',
  umbrella: '<path d="M22 12a10.06 10.06 0 0 0-20 0Z"/><path d="M12 12v8a2 2 0 0 0 4 0"/><path d="M12 2v1"/>',
  home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/>',
  award: '<path d="m15.477 12.89 1.515 8.526a.5.5 0 0 1-.81.47l-3.58-2.687a1 1 0 0 0-1.197 0l-3.586 2.686a.5.5 0 0 1-.81-.469l1.514-8.526"/><circle cx="12" cy="8" r="6"/>',
  kaaba: '<rect x="4" y="5" width="16" height="15" rx="1"/><path d="M4 9h16"/><path d="M8 5v15"/>',
  train: '<rect x="4" y="3" width="16" height="16" rx="2"/><path d="M4 11h16"/><path d="M12 3v8"/><path d="m8 19-2 3"/><path d="m18 22-2-3"/><path d="M8 15h.01"/><path d="M16 15h.01"/>',
  plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  tree: '<path d="m17 14 3 3.3a1 1 0 0 1-.7 1.7H4.7a1 1 0 0 1-.7-1.7L7 14h-.3a1 1 0 0 1-.7-1.7L9 9h-.2A1 1 0 0 1 8 7.3L12 3l4 4.3a1 1 0 0 1-.8 1.7H15l3 3.3a1 1 0 0 1-.7 1.7H17Z"/><path d="M12 22v-3"/>',
  cart: '<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  zap: '<path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>',
  drop: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
  bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  building: '<path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/><path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/><path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/><path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>',
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
  pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
  mail: '<rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>',
};
const gi = (name, size = 17, color = G) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;
const waSvg = (fill) => `<svg viewBox="0 0 24 24" fill="${fill}" width="18" height="18"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38c1.45.79 3.08 1.21 4.79 1.21 5.46 0 9.91-4.45 9.91-9.91C21.95 6.45 17.5 2 12.04 2m5.8 14.02c-.24.68-1.4 1.3-1.94 1.38-.5.07-1.13.1-1.82-.11-.42-.13-.96-.31-1.65-.61-2.9-1.25-4.79-4.17-4.94-4.36-.14-.19-1.18-1.57-1.18-2.99s.75-2.12 1.01-2.41c.26-.29.57-.36.76-.36l.55.01c.18.01.41-.07.64.49.24.57.81 1.99.88 2.13.07.14.12.31.02.5-.09.19-.14.31-.28.48-.14.17-.29.37-.42.5-.14.14-.28.29-.12.57.16.28.71 1.17 1.53 1.9 1.05.94 1.94 1.23 2.22 1.37.28.14.44.12.6-.07.16-.19.69-.81.87-1.09.18-.28.36-.23.61-.14.25.09 1.6.76 1.87.9.28.14.46.21.53.33.07.11.07.64-.17 1.32"/></svg>`;

// ─── الوحدات (بترتيب A01→A07) ─────────────────────────────────────────────────
const SOLD     = ['SM-A05', 'SM-A06', 'SM-A07'];
const RESERVED = ['SM-A01'];
// النسخة العامة تُبنى بلا أسعار: PUBLIC=1 أو الوسيط --public
const PUBLIC   = process.env.PUBLIC === '1' || process.argv.includes('--public');
const UNITS = [
  { code: 'SM-A01', floor: 'الأول',  price: '720,000', face: 'واجهتين',      bg: PH.lobby },
  { code: 'SM-A02', floor: 'الأول',  price: '700,000', face: 'واجهة أمامية', bg: PH.kitchen },
  { code: 'SM-A03', floor: 'الثاني', price: '720,000', face: 'واجهتين',      bg: PH.living },
  { code: 'SM-A04', floor: 'الثاني', price: '700,000', face: 'واجهة أمامية', bg: PH.corridor },
  { code: 'SM-A05', floor: 'الثالث', price: '720,000', face: 'واجهتين',      bg: PH.bed },
  { code: 'SM-A06', floor: 'الثالث', price: '700,000', face: 'واجهة أمامية', bg: PH.bath },
  { code: 'SM-A07', floor: 'الرابع', price: '1,100,000', face: 'روف فاخر',   bg: PH.extCorner },
];
const isRoof = (u) => u.face === 'روف فاخر';
const planFor = (u) => u.face === 'واجهتين' ? PLAN_A : (u.face === 'واجهة أمامية' ? PLAN_B : null);
const planNote = (u) => u.face === 'واجهتين' ? 'مخطط الوحدة — واجهتان · الأبعاد بالمتر'
                    : u.face === 'واجهة أمامية' ? 'مخطط الوحدة — واجهة أمامية · الأبعاد بالمتر'
                    : 'مخطط الروف الفاخر — SM-A07 · 477 م²';
// مواصفات الوحدة — مطابقة لمحتوى الموقع
const specsFor = (u) => isRoof(u) ? [
  ['ruler', '477 م²'], ['bed', '4 غرف'], ['user', 'غرفة خادمة'], ['drops', 'غرفة غسيل'],
  ['umbrella', 'سطح خاص كبير'], ['layers', 'خزان أرضي وعلوي'], ['bath', '4 دورات مياه'],
] : [
  ['ruler', '197 م²'], ['bed', '5 غرف'], ['user', 'غرفة خادمة'], ['drops', 'غرفة غسيل'],
  ['finger', 'دخول ذكي'], ['wifi', 'منزل ذكي'], ['box', 'مستودع'], ['car', 'موقف خاص'],
  ['layers', 'خزان أرضي وعلوي'], ['bath', '4 دورات مياه'],
];
const waLink = (u) => {
  const size = isRoof(u) ? '477 م²' : '197 م²';
  const rooms = isRoof(u) ? '4 غرف' : '5 غرف';
  const msg = `السلام عليكم، أرغب بالاستفسار عن الوحدة ${u.code} (${size} · ${rooms}) في مشروع سماك البوابة بحي البوابة، مكة المكرمة، وأتطلّع لمعرفة مزيد من التفاصيل.`;
  return `https://wa.me/${WA}?text=${encodeURIComponent(msg)}`;
};

// ─── الضمانات ─────────────────────────────────────────────────────────────────
const WARR = [
  { y: '50', u: 'سنة',   label: 'السباكة الداخلية',                 ic: 'drop' },
  { y: '25', u: 'سنة',   label: 'القواطع الكهربائية',                ic: 'zap' },
  { y: '10', u: 'سنوات', label: 'الهيكل الإنشائي',                  ic: 'building' },
  { y: '3',  u: 'سنوات', label: 'الإنارة والأفياش والأدوات الصحية', ic: 'bulb' },
];
// ─── المميزات (مطابقة لمحتوى الموقع) ─────────────────────────────────────────
const FEATURES = [
  { ic: 'home',   t: 'بيئة ذكية متكاملة', d: 'وحداتٌ مجهّزة بالكامل بأنظمة الإنارة والدخول الذكي، مع بنيةٍ تحتية مرنة تتيح التوسّع مستقبلاً' },
  { ic: 'shield', t: 'أمان العائلة أولاً', d: 'أنظمة مراقبة CCTV متطوّرة، وأقفال إلكترونية ذكية تضمن لكم ولعائلتكم أقصى درجات الحماية' },
  { ic: 'award',  t: 'جودة بلا تنازلات',   d: 'أرقى خامات البورسلان والرخام والأدوات الصحية من ماركاتٍ عالميةٍ موثوقة' },
];
// ─── الموقع (مطابق لمحتوى الموقع) ────────────────────────────────────────────
const DIST = [
  { ic: 'kaaba', v: '15 دقيقة', l: 'عن المسجد الحرام' },
  { ic: 'train', v: '9 دقائق',  l: 'عن محطة قطار الحرمين' },
  { ic: 'plane', v: '50 دقيقة', l: 'عن مطار الملك عبدالعزيز' },
  { ic: 'moon',  v: 'مقابل',    l: 'مسجد' },
  { ic: 'tree',  v: 'مقابل',    l: 'حديقة عامة' },
  { ic: 'cart',  v: '5 دقائق',  l: 'عن المتاجر الكبرى' },
];

// ─── CSS ─────────────────────────────────────────────────────────────────────
const FONT_CSS = fs.readFileSync(path.join(__dirname, 'cairo-embedded.css'), 'utf8');
const CSS = `
${FONT_CSS}
* { box-sizing:border-box; margin:0; padding:0; -webkit-print-color-adjust:exact !important; print-color-adjust:exact !important; }
:root { --navy:#1a365d; --deep:#0a0f1e; --gold:#c5a059; }
html,body { font-family:'Cairo', Tahoma, sans-serif; color:var(--navy); background:#d7dde5; }

.doc { width:210mm; margin:0 auto; background:#fff; box-shadow:0 0 70px rgba(0,0,0,.25); overflow:hidden; }
.sheet { position:relative; width:210mm; overflow:hidden; display:flex; flex-direction:column; }
.gap { width:210mm; height:6mm; background:#fff; }

.goldgrid { position:absolute; inset:0; z-index:1; pointer-events:none; opacity:.07;
  background-image:
    repeating-linear-gradient(90deg, var(--gold) 0, var(--gold) 1px, transparent 1px, transparent 64px),
    repeating-linear-gradient(0deg,  var(--gold) 0, var(--gold) 1px, transparent 1px, transparent 64px); }
.wm { position:absolute; inset:0; z-index:0; background-image:url('${WMARK}'); background-repeat:no-repeat;
      background-position:center; background-size:cover; opacity:.03; pointer-events:none; }
/* العلامة المائية للصفحات الداكنة — نسخة بيضاء */
.wmd { position:absolute; inset:0; z-index:2; background-image:url('${WMARK}'); background-repeat:no-repeat;
       background-position:center; background-size:cover; opacity:.045; filter:invert(1); pointer-events:none; }

.head { position:relative; z-index:3; display:flex; justify-content:space-between; align-items:flex-start; padding:12mm 15mm 0; }
.head .badge { width:52px; height:52px; border:2px solid var(--gold); border-radius:50%; display:flex; align-items:center;
               justify-content:center; font-weight:900; font-size:18px; color:var(--navy); flex-shrink:0; }
.head .ttl { display:flex; flex-direction:column; align-items:flex-start; }
.head .ttl .proj { color:var(--gold); font-weight:800; font-size:12px; letter-spacing:.04em; }
.head .ttl h2 { font-size:27px; font-weight:900; color:var(--navy); margin-top:2px; }
.head .ttl .rule { height:4px; width:110px; background:var(--gold); border-radius:2px; margin-top:8px; }
.dark .head .badge, .usec .head .badge { color:#fff; }
.dark .head .ttl h2, .usec .head .ttl h2 { color:#fff; text-shadow:0 2px 12px rgba(0,0,0,.45); }

/* شريط التواصل السفلي — في كل صفحة */
.cbar { position:relative; z-index:5; background:var(--navy); border-top:3px solid var(--gold); color:#fff;
        display:flex; justify-content:space-between; align-items:center; padding:9px 15mm; gap:12px; }
.cbar .cl { display:flex; flex-direction:column; }
.cbar .cl .nm { color:var(--gold); font-weight:800; font-size:12.5px; }
.cbar .cl .tg { color:#cbd5e1; font-size:9.5px; }
.cbar .cr { display:flex; gap:11px; font-size:10.5px; color:#e5e7eb; white-space:nowrap; align-items:center; }
.cbar .cr span { display:inline-flex; align-items:center; gap:5px; }
.cbar .cr b { color:#fff; font-weight:800; }
.cbar .cr a { color:#fff; text-decoration:none; }

/* شعار فال */
.fal-badge { display:inline-flex; align-items:center; gap:13px; }
.fal-logo-w { height:44px; width:auto; display:block; }
.fal-txt { font-size:13px; font-weight:800; color:#fff; }

/* داكن (غلاف/تواصل) */
.dark { background:var(--deep); }
/* صفحة روحانية مكة */
.mecca { background:var(--deep); }
.mecca-photo { position:absolute; inset:0; z-index:0; background-size:cover; background-position:center; }
.mecca-veil { position:absolute; inset:0; z-index:1; background:linear-gradient(to bottom, rgba(10,15,30,.82) 0%, rgba(10,15,30,.68) 42%, rgba(10,15,30,.86) 100%); }
.mecca-inner { flex:1; display:flex; flex-direction:column; justify-content:center; align-items:center; text-align:center; padding:0 22mm; position:relative; z-index:3; color:#fff; }
.mecca-ic { margin-bottom:22px; }
.mecca .m-kick { color:var(--gold); font-weight:800; letter-spacing:.24em; font-size:24px; margin-bottom:6px; }
.mecca h1 { font-size:50px; font-weight:900; margin:12px 0 28px; text-shadow:0 2px 14px rgba(0,0,0,.4); }
.mecca-body { max-width:600px; }
.mecca-body p { font-size:17px; color:#dbe4f0; line-height:2.05; margin-bottom:15px; }
.mecca-body b { color:var(--gold); }
.mecca-tag { text-align:center; color:var(--gold); font-weight:800; font-size:20px; margin-top:34px; position:relative; z-index:3; }
.cover-bg { position:absolute; inset:0; z-index:0; background-size:cover; background-position:center; }
.veil { position:absolute; inset:0; z-index:1; }
.cover .veil { background:linear-gradient(to bottom, rgba(10,15,30,.32) 0%, rgba(10,15,30,.22) 28%, rgba(10,15,30,.85) 66%, rgba(10,15,30,.96) 100%); }
.logo-top { position:relative; z-index:10; display:flex; justify-content:center; padding:14mm 0 0; }
.logo-top img { height:280px; }
.cover .logo-top img { height:196px; }
.dark-inner { flex:1; display:flex; flex-direction:column; justify-content:flex-end; padding:0 18mm 12mm; position:relative; z-index:3; color:#fff; }
.contact .dark-inner { justify-content:flex-start; padding-top:128mm; }
.contact { position:relative; }
.contact .logo-top { position:absolute; top:11%; left:0; right:0; padding:0; }
.contact .logo-top img { height:230px; }
.contact-photo { position:absolute; inset:0; z-index:0; background-size:cover; background-position:center 55%;
  -webkit-mask-image:linear-gradient(to top, #000 46%, transparent 100%); mask-image:linear-gradient(to top, #000 46%, transparent 100%); }
.contact-veil { position:absolute; inset:0; z-index:1; background:linear-gradient(to top, rgba(10,15,30,.55) 0%, rgba(10,15,30,.80) 40%, rgba(10,15,30,.95) 72%, #0a0f1e 100%); }
.dark-inner .kick { color:var(--gold); font-weight:800; letter-spacing:.26em; font-size:13px; text-shadow:0 2px 10px rgba(0,0,0,.4); }
.dark-inner h1 { font-size:56px; font-weight:900; margin:10px 0 10px; line-height:1.05; text-shadow:0 3px 18px rgba(0,0,0,.5); }
.dark-inner .sub { font-size:16.5px; color:#dbe4f0; max-width:540px; line-height:1.85; text-shadow:0 2px 12px rgba(0,0,0,.5); }
.dark-inner .sub b { color:#fff; }
.stats { display:flex; gap:28px; margin-top:26px; flex-wrap:wrap; align-items:flex-start; }
.stats .s { display:flex; flex-direction:column; }
.stats .s .v { font-size:30px; font-weight:900; color:var(--gold); text-shadow:0 2px 12px rgba(0,0,0,.4); display:flex; align-items:center; gap:6px; }
.stats .s .l { font-size:12px; color:#cbd5e1; margin-top:2px; }
.stats .s a { color:var(--gold); text-decoration:none; }
.cover-fal { margin-top:26px; }
.cover-cta { display:flex; gap:14px; margin-top:24px; flex-wrap:wrap; }
.cbtn { display:inline-flex; align-items:center; gap:9px; padding:14px 28px; border-radius:13px; font-weight:800; font-size:17px; text-decoration:none; box-shadow:0 8px 22px rgba(0,0,0,.28); }
.cbtn.call { background:var(--gold); color:#0a0f1e; }
.cbtn.wa { background:#fff; color:#0a0f1e; }
/* ── غلاف: محتوى بالنص متوزّع طولياً + مبنى مندمج ── */
.cover2 { position:relative; background:var(--deep); color:#fff; }
.cover2-photo { position:absolute; inset:0; z-index:0; background-size:cover; background-position:center 32%; }
.cover2-veil { position:absolute; inset:0; z-index:1; background:linear-gradient(to bottom, rgba(10,15,30,.90) 0%, rgba(10,15,30,.72) 44%, rgba(10,15,30,.62) 60%, rgba(10,15,30,.90) 100%); }
.cover2-inner { position:relative; z-index:3; flex:1; display:flex; flex-direction:column; align-items:center; justify-content:space-between; text-align:center; padding:16mm 16mm 8mm; }
.c2-logo { position:relative; z-index:10; height:250px; filter:brightness(0) invert(1); }
.c2-terms-corner { position:absolute; z-index:4; bottom:calc(14mm + 14px); right:15mm; font-size:12px; color:rgba(255,255,255,.6); font-weight:600; }
.c2-block { display:flex; flex-direction:column; align-items:center; }
.c2-proj { color:var(--gold); font-weight:900; font-size:42px; letter-spacing:.02em; margin-bottom:14px; }
.c2-head { font-size:58px; font-weight:900; line-height:1.12; text-shadow:0 3px 16px rgba(0,0,0,.5); }
.c2-sub { font-size:18px; color:#dbe4f0; margin-top:16px; line-height:1.7; max-width:560px; text-shadow:0 2px 10px rgba(0,0,0,.4); }
.c2-price { margin-top:26px; display:flex; align-items:baseline; gap:12px; justify-content:center; }
.c2-price .pk { font-size:20px; color:#cbd5e1; font-weight:700; }
.c2-price .pv { font-size:78px; font-weight:900; color:var(--gold); direction:ltr; line-height:1; text-shadow:0 3px 16px rgba(0,0,0,.45); }
.c2-price .pc { font-size:25px; color:var(--gold); font-weight:800; }
.c2-terms { font-size:12.5px; color:rgba(255,255,255,.7); font-weight:600; margin-top:14px; }
/* صف تواصل موحّد — أيقونة + قيمة كرابط ذكي بلا بوكسات */
.crow { display:flex; flex-wrap:wrap; justify-content:center; align-items:center; gap:11px 22px; }
.crow a { display:inline-flex; align-items:center; gap:8px; text-decoration:none; font-weight:700; font-size:17px; direction:ltr; }
.crow.on-dark a { color:#fff; }
.crow.on-light a { color:var(--navy); }
.film-cta { margin-top:30px; display:inline-flex; align-items:center; gap:10px; background:var(--gold); color:#0a0f1e;
            text-decoration:none; font-weight:800; font-size:17px; padding:14px 32px; border-radius:14px;
            width:fit-content; box-shadow:0 8px 24px rgba(197,160,89,.35); }
.wa-cta { margin-top:24px; display:inline-flex; align-items:center; gap:10px; background:var(--gold); color:#0a0f1e; text-decoration:none;
          font-weight:800; font-size:16px; padding:14px 30px; border-radius:14px; width:fit-content; box-shadow:0 8px 24px rgba(197,160,89,.35); }

/* صفحة الوحدة */
.usec { min-height:214mm; background-size:cover; background-position:center; }
.usec .veil { z-index:1; background:linear-gradient(to bottom, rgba(10,15,30,.86), rgba(10,15,30,.72) 55%, rgba(26,54,93,.66)); }
.u-body { position:relative; z-index:3; flex:1; display:flex; flex-direction:column; gap:14px; padding:6mm 15mm 9mm; }
.plan-wrap { background:rgba(10,15,30,.60); backdrop-filter:blur(7px); border:1px solid rgba(197,160,89,.42);
             border-radius:18px; box-shadow:0 14px 44px rgba(0,0,0,.30); padding:14px 16px 10px; display:flex; flex-direction:column; }
.plan-wrap .planimg { width:100%; aspect-ratio:2820/1224; background-size:contain; background-repeat:no-repeat; background-position:center; }
.plan-a { background-image:url('${PLAN_A}'); }
.plan-b { background-image:url('${PLAN_B}'); }
.plan-roof { background-image:url('${PLAN_ROOF}'); }
.plan-wrap .planimg.plan-roof { aspect-ratio:2200/1238; }
.plan-wrap .roof-ph { width:100%; height:150px; border-radius:12px; background-size:cover; background-position:center; }
.plan-cap { text-align:center; color:rgba(255,255,255,.72); font-size:11px; font-weight:700; margin-top:9px; }
.u-card { background:rgba(10,15,30,.60); backdrop-filter:blur(7px); border:1px solid rgba(197,160,89,.42);
          border-radius:18px; padding:18px 22px; display:flex; flex-direction:column; gap:14px; color:#fff; box-shadow:0 14px 44px rgba(0,0,0,.30); }
.u-top { display:flex; justify-content:space-between; align-items:center; }
.u-top:has(> .face-chip:only-child) { justify-content:flex-start; }
.u-price { font-size:34px; font-weight:900; color:var(--gold); }
.u-price span { font-size:14px; color:#cbd5e1; font-weight:700; }
.face-chip { font-size:12px; font-weight:800; padding:6px 15px; border-radius:999px; background:rgba(255,255,255,.14); color:#e5e7eb; }
.face-chip.g { background:rgba(197,160,89,.24); color:var(--gold); }
.specs { display:grid; grid-template-columns:1fr 1fr; gap:9px 18px; }
.specs .sp { display:flex; align-items:center; gap:8px; font-size:12.5px; color:#e5e7eb; }
.specs .sp svg { flex-shrink:0; }
.wa { display:inline-flex; align-items:center; justify-content:center; gap:9px; background:rgba(197,160,89,.12); border:1.5px solid var(--gold);
      color:var(--gold); text-decoration:none; font-weight:800; font-size:14px; padding:12px; border-radius:12px; }
.u-sold.rsvd { border-color:var(--gold); color:#f2e3c4; background:rgba(197,160,89,.14); }
.u-sold { text-align:center; border:2px solid #dc2626; color:#fecaca; font-weight:900; padding:12px; border-radius:12px; background:rgba(220,38,38,.14); }
.ribbon.rsv { background:var(--gold); color:#0a0f1e; }
.ribbon { position:absolute; top:26px; left:-54px; transform:rotate(-45deg); background:#dc2626; color:#fff; font-weight:900;
          padding:8px 64px; z-index:6; box-shadow:0 4px 14px rgba(0,0,0,.35); font-size:15px; letter-spacing:.1em; }

/* المعرض */
.light { background:#fff; }
.gallery-grid { position:relative; z-index:3; flex:1; display:grid; grid-template-columns:repeat(2,1fr); grid-template-rows:repeat(3,1fr);
                gap:12px; padding:6mm 15mm 12mm; }
.gcell { position:relative; border-radius:15px; overflow:hidden; background-size:cover; background-position:center; box-shadow:0 6px 20px rgba(26,54,93,.12); min-height:118px; }
.gcell .cap { position:absolute; inset:auto 0 0 0; padding:22px 14px 11px; color:#fff; font-weight:800; font-size:14px;
              background:linear-gradient(transparent, rgba(10,15,30,.82)); }
.gcell .cap span { display:block; font-size:10px; font-weight:600; color:var(--gold); letter-spacing:.08em; margin-top:1px; }

/* المميزات */
.feat-body { position:relative; z-index:3; flex:1; display:flex; flex-direction:column; justify-content:center; gap:16px; padding:8mm 15mm 14mm; }
.fcard { background:#fff; border:1px solid #eef1f5; border-radius:20px; padding:24px 26px; display:flex; gap:18px; align-items:flex-start; box-shadow:0 8px 24px rgba(26,54,93,.08); }
.fcard .fic { width:54px; height:54px; border-radius:14px; background:rgba(197,160,89,.12); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.fcard h4 { font-size:19px; font-weight:900; color:var(--navy); margin-bottom:6px; }
.fcard p { font-size:13px; color:#64748b; line-height:1.7; }

/* الضمانات */
.warr-body { position:relative; z-index:3; flex:1; display:flex; flex-direction:column; justify-content:space-evenly; gap:14px; padding:12mm 15mm 16mm; }
.warr-hero { text-align:center; }
.warr-ic { display:flex; justify-content:center; margin-bottom:14px; }
.warr-hero .k { color:var(--gold); font-weight:800; letter-spacing:.14em; font-size:13px; }
.warr-hero .big { font-size:68px; font-weight:900; color:var(--navy); line-height:1; margin:8px 0 8px; }
.warr-hero .big em { font-size:24px; color:var(--gold); font-style:normal; }
.warr-hero p { color:#64748b; font-size:13px; max-width:460px; margin:0 auto; line-height:1.7; }
.warr-grid { display:grid; grid-template-columns:1fr 1fr; gap:18px; }
.wcard { background:#fff; border:1px solid #eef1f5; border-radius:16px; padding:26px 22px; display:flex; align-items:center; gap:16px; box-shadow:0 6px 20px rgba(26,54,93,.08); }
.wcard .wic { width:60px; height:60px; border-radius:14px; background:rgba(197,160,89,.13); display:flex; align-items:center; justify-content:center; flex-shrink:0; }
.wcard .yrs { font-size:32px; font-weight:900; color:var(--navy); line-height:1; }
.wcard .yrs em { font-size:14px; color:var(--gold); font-style:normal; font-weight:800; margin-right:3px; }
.wcard .lbl { font-size:12.5px; color:#64748b; font-weight:700; margin-top:4px; }

/* الموقع */
.loc-body { position:relative; z-index:3; flex:1; display:flex; flex-direction:column; gap:18px; padding:6mm 15mm 14mm; }
.loc-card { border-radius:18px; overflow:hidden; border:1px solid #eef1f5; display:flex; flex-direction:column; box-shadow:0 6px 22px rgba(26,54,93,.12); text-decoration:none; }
.loc-card .hero-band { height:340px; background-size:cover; background-position:center; position:relative; }
.loc-card .map-open { position:absolute; bottom:14px; right:14px; background:rgba(255,255,255,.95); color:var(--navy); font-weight:800; font-size:13px; padding:9px 15px; border-radius:999px; display:inline-flex; align-items:center; gap:7px; box-shadow:0 6px 18px rgba(0,0,0,.2); }
.loc-card .caption { padding:11px 16px; background:var(--navy); color:#fff; font-size:13px; }
.loc-card .caption b { color:var(--gold); }
.dist-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
.dcard { background:#fff; border:1px solid #eef1f5; border-radius:14px; padding:14px; text-align:center; box-shadow:0 5px 16px rgba(26,54,93,.07); }
.dcard .di { display:flex; justify-content:center; margin-bottom:6px; }
.dcard .dv { font-size:17px; font-weight:900; color:var(--navy); }
.dcard .dl { font-size:11px; color:#64748b; margin-top:2px; }

/* ── تقسيم صفحات A4 للطباعة/تصدير PDF فقط (لا يؤثر على العرض أونلاين) ── */
@media print {
  @page { size:210mm 297mm; margin:0; }
  html, body { background:#fff; }
  .doc { box-shadow:none; overflow:visible; width:210mm; margin:0; }
  .gap { display:none !important; }
  .sheet { height:297mm !important; min-height:297mm !important; overflow:hidden;
           break-after:page; page-break-after:always; break-inside:avoid; page-break-inside:avoid; }
  .sheet:last-child { break-after:auto; page-break-after:auto; }
}
`;

// ─── مكوّنات ─────────────────────────────────────────────────────────────────
const FAL_WHITE_IMG = png(path.join(__dirname, 'fal-white.png'));
const falBadge = `<div class="fal-badge"><img class="fal-logo-w" src="${FAL_WHITE_IMG}" alt="فال FAL"><span class="fal-txt">${FAL_AD}</span></div>`;
const contactItems = (color) => `<a href="tel:${PHONE}">${gi('phone', 19, color)} <span>${PHONE}</span></a><a href="https://wa.me/${WA}" target="_blank" rel="noreferrer">${waSvg(color)} <span>واتساب</span></a><a href="mailto:info@semak.sa">${gi('mail', 19, color)} <span>info@semak.sa</span></a><a href="https://semak.sa" target="_blank" rel="noreferrer">${gi('globe', 19, color)} <span>${SITE}</span></a>`;
const cbar = `<div class="cbar"><div class="cl"><span class="nm">سماك العقارية</span><span class="tg">${TAGLINE}</span></div><div class="cr"><span>${gi('phone', 13, '#fff')} <a href="tel:${PHONE}"><b>${PHONE}</b></a></span><span>${gi('mail', 13, '#fff')} <a href="mailto:info@semak.sa"><b>info@semak.sa</b></a></span><span>${gi('globe', 13, '#fff')} <a href="https://semak.sa" target="_blank" rel="noreferrer"><b>${SITE}</b></a></span><span>${gi('pin', 13, '#fff')} <a href="${MAPS_URL}" target="_blank" rel="noreferrer">حي البوابة، مكة</a></span></div></div>`;
const head = (num, proj, title) => `<div class="head"><div class="ttl"><div class="proj">${proj}</div><h2>${title}</h2><div class="rule"></div></div>${num ? `<div class="badge">${num}</div>` : ''}</div>`;

const unitSection = (u, i) => {
  const sold = SOLD.includes(u.code);
  const reserved = !sold && RESERVED.includes(u.code);
  const pc = u.face === 'واجهتين' ? 'plan-a' : (u.face === 'واجهة أمامية' ? 'plan-b' : 'plan-roof');
  const g = !isRoof(u) && u.face !== 'واجهة أمامية' ? ' g' : (isRoof(u) ? ' g' : '');
  const price = isRoof(u) ? '1,100,000' : u.price;
  return `
<section class="sheet usec" style="background-image:url('${u.bg}')">
  <div class="veil"></div><div class="goldgrid"></div><div class="wmd"></div>
  ${sold ? `<div class="ribbon">مباع</div>` : reserved ? `<div class="ribbon rsv">محجوزة</div>` : ''}
  ${head(String(i + 1).padStart(2, '0'), 'سماك البوابة', 'الوحدة ' + u.code)}
  <div class="u-body">
    <div class="plan-wrap">
      ${pc ? `<div class="planimg ${pc}"></div>` : `<div class="roof-ph" style="background-image:url('${AERIAL}')"></div>`}
      <div class="plan-cap">${planNote(u)}</div>
    </div>
    <div class="u-card">
      <div class="u-top">${PUBLIC ? '' : `<div class="u-price">${u.price} <span>ريال</span></div>`}<div class="face-chip${g}">${u.face}</div></div>
      <div class="specs">${specsFor(u).map(([ic, t]) => `<div class="sp">${gi(ic)} ${t}</div>`).join('')}</div>
      ${sold ? `<div class="u-sold">تم بيع هذه الوحدة</div>` : reserved ? `<div class="u-sold rsvd">هذه الوحدة محجوزة</div>` : `<a class="wa" href="${waLink(u)}" target="_blank" rel="noreferrer">${waSvg(G)} الاستفسار عن الوحدة عبر واتساب</a>`}
    </div>
  </div>
  ${cbar}
</section>`;
};

const gcell = (img, t, s) => `<div class="gcell" style="background-image:url('${img}')"><div class="cap">${t}<span>${s}</span></div></div>`;
const wcard = (w) => `<div class="wcard"><div class="wic">${gi(w.ic, 26)}</div><div><div class="yrs">${w.y} <em>${w.u}</em></div><div class="lbl">${w.label}</div></div></div>`;
const fcard = (f) => `<div class="fcard"><div class="fic">${gi(f.ic, 26)}</div><div><h4>${f.t}</h4><p>${f.d}</p></div></div>`;
const dcard = (d) => `<div class="dcard"><div class="di">${gi(d.ic, 22)}</div><div class="dv">${d.v}</div><div class="dl">${d.l}</div></div>`;

// ─── الوثيقة ─────────────────────────────────────────────────────────────────
const BODY = `<div class="doc">

<!-- الغلاف -->
<section class="sheet cover2" style="min-height:297mm">
  <div class="cover2-photo" style="background-image:url('${HERO_BLD}')"></div>
  <div class="cover2-veil"></div>
  <div class="wmd"></div>
  <div class="cover2-inner">
    <img class="c2-logo" src="${LOGO_GOLD}" alt="سماك العقارية">
    <div class="c2-block">
      <div class="c2-proj">سماك البوابة</div>
      <h1 class="c2-head">حيث السكينة<br>والطمأنينة</h1>
      <div class="c2-sub">في قلب مكة المكرمة — حي البوابة، داخل حدود الحرم المكّي الشريف</div>
      ${PUBLIC ? '' : '<div class="c2-price"><span class="pk">بأسعارٍ تبدأ من</span><span class="pv">700,000</span><span class="pc">ريال</span></div>'}
    </div>
    <div class="c2-block">
      <div class="crow on-dark">${contactItems('#ffffff')}</div>
      <div style="margin-top:18px">${falBadge}</div>
      <div style="margin-top:10px; font-size:12px; color:rgba(255,255,255,.62); font-weight:600">تطبّق الشروط والأحكام</div>
    </div>
  </div>
  ${cbar}
</section>
<div class="gap"></div>

<!-- روحانية مكة (من نحن) -->
<section class="sheet mecca dark" style="min-height:250mm">
  <div class="mecca-photo" style="background-image:url('${MAKKAH}')"></div>
  <div class="mecca-veil"></div>
  <div class="goldgrid"></div>
  <div class="wmd"></div>
  <div class="mecca-inner">
    <div class="m-kick">مكانةٌ وروحانية</div>
    <h1>في جوار البيت العتيق</h1>
    <div class="mecca-body">
      <p>مكة المكرمة أطهر بقاع الأرض وقبلة المسلمين؛ تسكن عندها القلوب طمأنينةً، وتزداد الأرواح صفاءً بقربها من الحرم الشريف</p>
      <p>وحين تسكن في هذا الجوار الطاهر، تنعم بحياةٍ تفيض بالسكينة والبركة، قريباً من المسجد الحرام والمشاعر المقدّسة</p>
      <p>وفي <b>سماك البوابة</b> نمنحك شرف هذا الجوار داخل حدود الحرم، لتجمع بين روحانية المكان ورفاهية السكن العصري</p>
    </div>
    <div class="mecca-tag">سقفٌ يعلو برؤيتك، ومسكنٌ يحكي قصتك</div>
  </div>
  ${cbar}
</section>
<div class="gap"></div>

<!-- معرض المشروع -->
<section class="sheet gallery light" style="min-height:250mm">
  <div class="wm"></div>
  ${head('', 'سماك البوابة', 'معرض المشروع')}
  <div class="gallery-grid">
    ${gcell(PH.extSide, 'الواجهة الخارجية', 'EXTERIOR')}
    ${gcell(PH.lobby, 'المدخل والاستقبال', 'LOBBY')}
    ${gcell(PH.living, 'صالة المعيشة', 'LIVING')}
    ${gcell(PH.kitchen, 'المطبخ الحديث', 'KITCHEN')}
    ${gcell(PH.bed, 'غرفة النوم', 'BEDROOM')}
    ${gcell(PH.bath, 'دورة المياه', 'BATHROOM')}
  </div>
  ${cbar}
</section>
<div class="gap"></div>

<!-- مميزات المشروع -->
<section class="sheet feat light" style="min-height:230mm">
  <div class="wm"></div>
  ${head('', 'نمط حياة راقٍ', 'مميزات المشروع')}
  <div class="feat-body">
    <p style="text-align:center;color:#64748b;font-size:14px;max-width:520px;margin:0 auto 4px;line-height:1.7">لم نهتمّ بالبناء فحسب، بل صمّمنا نمط حياةٍ يجمع بين الأصالة والحداثة ليكون منزلكم واحتكم الخاصة</p>
    ${FEATURES.map(fcard).join('')}
  </div>
  ${cbar}
</section>
<div class="gap"></div>

<!-- صفحة لكل وحدة -->
${UNITS.map((u, i) => unitSection(u, i)).join('\n<div class="gap"></div>\n')}
<div class="gap"></div>

<!-- الضمانات -->
<section class="sheet warr light" style="min-height:245mm">
  <div class="wm"></div>
  ${head('', 'ضمانات موثّقة', 'ضمانات المشروع')}
  <div class="warr-body">
    <div class="warr-hero">
      <div class="warr-ic">${gi('shield', 88)}</div>
      <div class="k">راحة بالٍ تدوم</div>
      <div class="big">تصل إلى 50 <em>سنة</em></div>
      <p>نلتزم بجودة الإنشاء والتشطيب عبر ضماناتٍ موثّقة تشمل أهمّ عناصر الوحدة، لتمنحكم الثقة والاطمئنان على استثماركم</p>
    </div>
    <div class="warr-grid">${WARR.map(wcard).join('')}</div>
  </div>
  ${cbar}
</section>
<div class="gap"></div>

<!-- الموقع -->
<section class="sheet loc light" style="min-height:250mm">
  <div class="wm"></div>
  ${head('', 'مكة المكرمة — حي البوابة', 'الموقع الاستراتيجي')}
  <div class="loc-body">
    <a class="loc-card" href="${MAPS_URL}" target="_blank" rel="noreferrer">
      <div class="hero-band" style="background-image:url('${MAP_IMG}')"><span class="map-open">${gi('pin', 18)} افتح الموقع في خرائط جوجل</span></div>
      <div class="caption"><b>سماك البوابة</b> — حي البوابة، مكة المكرمة · داخل حدود الحرم</div>
    </a>
    <div class="dist-grid">${DIST.map(dcard).join('')}</div>
  </div>
  ${cbar}
</section>
<div class="gap"></div>

<!-- التواصل -->
<section class="sheet contact dark" style="min-height:250mm">
  <div class="contact-photo" style="background-image:url('${PARKING}')"></div>
  <div class="contact-veil"></div>
  <div class="goldgrid"></div>
  <div class="wmd"></div>
  <div class="logo-top"><img src="${LOGO_GOLD}" alt="سماك العقارية"></div>
  <div class="dark-inner">
    <div class="sub">يسرّ فريق مبيعات سماك العقارية خدمتكم وتزويدكم بكامل التفاصيل والإجابة عن استفساراتكم على مدار الأسبوع</div>
    <div class="crow on-dark" style="justify-content:flex-start; margin-top:30px; font-size:19px; gap:16px 28px">${contactItems('#ffffff')}</div>
    <a class="film-cta" href="${VIDEO_URL}" target="_blank" rel="noreferrer">${gi('play', 20, '#0a0f1e')} شاهد فيلم التعريف</a>
    <div class="cover-fal" style="margin-top:34px">${falBadge}</div>
  </div>
  ${cbar}
</section>

</div>`;

const HTML = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>بروشور سماك البوابة — سماك العقارية</title><style>${CSS}</style></head><body>${BODY}</body></html>`;
const ARTIFACT = `<style>${CSS}</style>\n<div dir="rtl" lang="ar">${BODY}</div>`;

const OUT = path.join(__dirname, 'سماك-البوابة-بروشور.html');
const OUT_A = path.join(__dirname, 'سماك-البوابة-بروشور-artifact.html');
const OUT_HOST = path.join(__dirname, 'albawaba.html'); // ملف الاستضافة (اسم نظيف) → semak.sa/albawaba.html
fs.writeFileSync(OUT, HTML, 'utf8');
fs.writeFileSync(OUT_A, ARTIFACT, 'utf8');
fs.writeFileSync(OUT_HOST, HTML, 'utf8');
console.log('✔ بروشور:', Math.round(HTML.length / 1024), 'KB · artifact + albawaba.html');
