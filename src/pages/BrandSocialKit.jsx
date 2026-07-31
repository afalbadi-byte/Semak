import React, { useEffect, useRef, useState } from 'react';
import { Download, Image as ImageIcon, Check } from 'lucide-react';
import PageMeta from '../components/PageMeta';

const NAVY = '#1a365d';
const GOLD = '#c5a059';
const DARK = '#0a0f1e';
const WHITE = '#ffffff';

const COMPANY = {
  name: 'سماك العقارية',
  slogan: 'سقف يعلو برؤيتك، ومسكن يحكي قصتك',
  description: 'نطور مشاريع سكنية بمعايير عالية تجمع بين جودة البناء، والموقع المميز، والتصميم العصري، لنقدم تجربة تملك تلبي تطلعات الأسرة السعودية.',
  website: 'semak.sa',
  phone: '920032842',
  email: 'info@semak.sa',
};

const ASSETS = [
  { id: 'facebook-cover', title: 'غلاف فيسبوك', hint: 'صفحة فيسبوك · 1702×630', width: 1702, height: 630, type: 'cover' },
  { id: 'linkedin-cover', title: 'غلاف لينكدإن', hint: 'صفحة الشركة · 4200×700', width: 4200, height: 700, type: 'cover' },
  { id: 'x-cover', title: 'غلاف X', hint: 'X / تويتر · 1500×500', width: 1500, height: 500, type: 'cover' },
  { id: 'whatsapp-business', title: 'هوية واتساب للأعمال', hint: 'صورة حساب · 1080×1080', width: 1080, height: 1080, type: 'whatsapp' },
  { id: 'profile', title: 'صورة الملف الشخصي', hint: 'صورة موحّدة للحسابات · 1080×1080', width: 1080, height: 1080, type: 'profile' },
  { id: 'instagram-template', title: 'قالب منشور إنستقرام', hint: 'منشور رأسي · 1080×1350', width: 1080, height: 1350, type: 'template' },
  { id: 'story-template', title: 'قالب الستوري', hint: 'ستوري / ريلز · 1080×1920', width: 1080, height: 1920, type: 'story' },
  { id: 'ad-template', title: 'قالب الإعلانات', hint: 'إعلان رأسي · 1080×1350', width: 1080, height: 1350, type: 'ad' },
];

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function drawImageCover(ctx, image, x, y, width, height) {
  if (!image) return;
  const imageRatio = image.width / image.height;
  const targetRatio = width / height;
  let sourceWidth = image.width;
  let sourceHeight = image.height;
  let sourceX = 0;
  let sourceY = 0;

  if (imageRatio > targetRatio) {
    sourceWidth = image.height * targetRatio;
    sourceX = (image.width - sourceWidth) / 2;
  } else {
    sourceHeight = image.width / targetRatio;
    sourceY = (image.height - sourceHeight) / 2;
  }
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

function drawMotif(ctx, width, height) {
  const step = Math.max(34, Math.round(width / 34));
  ctx.save();
  ctx.strokeStyle = 'rgba(197,160,89,0.12)';
  ctx.lineWidth = Math.max(1, width / 1800);
  for (let x = -step; x < width + step; x += step) {
    for (let y = -step; y < height + step; y += step) {
      ctx.beginPath();
      ctx.moveTo(x, y + step / 2);
      ctx.lineTo(x + step / 2, y);
      ctx.lineTo(x + step, y + step / 2);
      ctx.lineTo(x + step / 2, y + step);
      ctx.closePath();
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawBase(ctx, width, height, building, photoOnRight = true) {
  ctx.fillStyle = NAVY;
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = DARK;
  ctx.globalAlpha = 0.72;
  ctx.fillRect(0, 0, width, height);
  ctx.globalAlpha = 1;

  if (building) {
    const photoWidth = photoOnRight ? width * 0.47 : width;
    const photoX = photoOnRight ? width - photoWidth : 0;
    ctx.save();
    ctx.beginPath();
    ctx.rect(photoX, 0, photoWidth, height);
    ctx.clip();
    drawImageCover(ctx, building, photoX, 0, photoWidth, height);
    ctx.fillStyle = 'rgba(10,15,30,0.62)';
    ctx.fillRect(photoX, 0, photoWidth, height);
    ctx.restore();
  }

  const gradient = ctx.createLinearGradient(0, 0, width, 0);
  gradient.addColorStop(0, 'rgba(10,15,30,0.06)');
  gradient.addColorStop(0.46, 'rgba(26,54,93,0.98)');
  gradient.addColorStop(1, 'rgba(10,15,30,0.16)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);
  drawMotif(ctx, width, height);
}

function drawLogo(ctx, logo, x, y, width) {
  if (!logo) return;
  const height = width * (logo.height / logo.width);
  ctx.drawImage(logo, x, y, width, height);
}

function drawText(ctx, text, x, y, size, color = WHITE, align = 'right') {
  ctx.save();
  ctx.direction = 'rtl';
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.font = `900 ${size}px Cairo, Tahoma, Arial`;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function drawParagraph(ctx, text, x, y, maxWidth, fontSize, lineHeight, color = 'rgba(255,255,255,0.84)', maxLines = 3) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  ctx.save();
  ctx.direction = 'rtl';
  ctx.textAlign = 'right';
  ctx.font = `600 ${fontSize}px Cairo, Tahoma, Arial`;
  words.forEach((word) => {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      if (lines.length < maxLines - 1) lines.push(line);
      line = word;
    } else {
      line = next;
    }
  });
  if (line && lines.length < maxLines) lines.push(line);
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  lines.forEach((current, index) => ctx.fillText(current, x, y + index * lineHeight));
  ctx.restore();
  return lines.length * lineHeight;
}

function drawContactStrip(ctx, width, height, pad, compact = false) {
  const items = compact
    ? [COMPANY.website]
    : [COMPANY.website, COMPANY.phone, COMPANY.email];
  const y = height - pad * 0.78;
  const gap = compact ? 0 : pad * 0.58;
  const itemWidth = compact ? width * 0.2 : Math.min(width * 0.16, 270);
  const total = items.length * itemWidth + (items.length - 1) * gap;
  let x = width - pad - total;

  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.font = `700 ${Math.max(14, width / 105)}px Cairo, Tahoma, Arial`;
  items.forEach((item) => {
    roundedRect(ctx, x, y - pad * 0.24, itemWidth, pad * 0.5, pad * 0.14);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(197,160,89,0.7)';
    ctx.lineWidth = Math.max(1, width / 2200);
    ctx.stroke();
    ctx.fillStyle = WHITE;
    ctx.direction = 'ltr';
    ctx.fillText(item, x + itemWidth / 2, y + 1);
    x += itemWidth + gap;
  });
  ctx.restore();
}

function drawCover(ctx, spec, logo, building) {
  const { width: w, height: h } = spec;
  drawBase(ctx, w, h, building);
  const pad = Math.max(42, w * 0.055);
  const compact = h / w < 0.22;
  const logoWidth = compact ? w * 0.095 : w * 0.13;
  drawLogo(ctx, logo, pad, pad * 0.62, logoWidth);

  const textX = w * 0.5;
  const titleSize = compact ? h * 0.2 : h * 0.12;
  const titleY = compact ? h * 0.43 : h * 0.37;
  drawText(ctx, COMPANY.name, textX, titleY, titleSize);
  drawText(ctx, COMPANY.slogan, textX, titleY + titleSize * 0.82, titleSize * 0.33, GOLD);

  if (spec.id !== 'x-cover') {
    drawParagraph(ctx, COMPANY.description, textX, titleY + titleSize * 1.48, w * 0.43, titleSize * 0.24, titleSize * 0.42, 'rgba(255,255,255,0.82)', compact ? 2 : 2);
  }
  drawContactStrip(ctx, w, h, pad, compact);
}

function drawProfile(ctx, spec, logo) {
  const { width: w, height: h } = spec;
  ctx.fillStyle = DARK;
  ctx.fillRect(0, 0, w, h);
  drawMotif(ctx, w, h);
  ctx.save();
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, w * 0.38, 0, Math.PI * 2);
  ctx.fillStyle = NAVY;
  ctx.fill();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = w * 0.016;
  ctx.stroke();
  ctx.restore();
  if (logo) {
    const logoWidth = w * 0.48;
    const logoHeight = logoWidth * (logo.height / logo.width);
    drawLogo(ctx, logo, (w - logoWidth) / 2, (h - logoHeight) / 2, logoWidth);
  }
}

function drawVertical(ctx, spec, logo, building) {
  const { width: w, height: h, type } = spec;
  const isStory = type === 'story';
  drawBase(ctx, w, h, building, false);
  const pad = w * 0.08;
  const logoWidth = w * 0.25;
  drawLogo(ctx, logo, pad, pad, logoWidth);

  const contentTop = isStory ? h * 0.48 : h * 0.39;
  const contentWidth = w * 0.8;
  const contentX = w - pad;
  roundedRect(ctx, pad, contentTop - h * 0.1, contentWidth, h * (isStory ? 0.28 : 0.31), w * 0.04);
  ctx.fillStyle = 'rgba(10,15,30,0.82)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(197,160,89,0.65)';
  ctx.lineWidth = Math.max(2, w / 700);
  ctx.stroke();

  const titleSize = isStory ? w * 0.073 : w * 0.066;
  drawText(ctx, COMPANY.name, contentX - pad * 0.45, contentTop, titleSize);
  drawText(ctx, COMPANY.slogan, contentX - pad * 0.45, contentTop + titleSize * 0.9, titleSize * 0.37, GOLD);

  if (type === 'whatsapp' || type === 'ad' || type === 'story') {
    drawParagraph(ctx, COMPANY.description, contentX - pad * 0.45, contentTop + titleSize * 1.72, contentWidth - pad * 0.8, titleSize * 0.28, titleSize * 0.52, 'rgba(255,255,255,0.85)', isStory ? 3 : 2);
  }

  if (type === 'template' || type === 'story') {
    const frameY = isStory ? h * 0.19 : h * 0.18;
    const frameH = isStory ? h * 0.22 : h * 0.19;
    roundedRect(ctx, pad, frameY, w - pad * 2, frameH, w * 0.035);
    ctx.strokeStyle = 'rgba(197,160,89,0.72)';
    ctx.lineWidth = Math.max(2, w / 700);
    ctx.setLineDash([w * 0.024, w * 0.018]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  drawContactStrip(ctx, w, h, pad, type === 'story');
}

function drawAsset(ctx, spec, logo, building) {
  ctx.clearRect(0, 0, spec.width, spec.height);
  if (spec.type === 'profile') drawProfile(ctx, spec, logo);
  else if (spec.type === 'cover') drawCover(ctx, spec, logo, building);
  else drawVertical(ctx, spec, logo, building);
}

function loadImage(src) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function SocialCanvas({ spec }) {
  const ref = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadImage('/images/logo-footer.png'), loadImage('/images/hero-bg.jpg')]).then(([logo, building]) => {
      if (cancelled || !ref.current) return;
      const canvas = ref.current;
      canvas.width = spec.width;
      canvas.height = spec.height;
      drawAsset(canvas.getContext('2d'), spec, logo, building);
      setReady(true);
    });
    return () => { cancelled = true; };
  }, [spec]);

  const download = () => {
    const link = document.createElement('a');
    link.download = `semak-${spec.id}-${spec.width}x${spec.height}.png`;
    link.href = ref.current.toDataURL('image/png');
    link.click();
  };

  return (
    <article className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-shadow">
      <div className="bg-[#0a0f1e] h-[330px] sm:h-[370px] p-4 flex items-center justify-center overflow-hidden">
        <canvas ref={ref} className="max-w-full max-h-full w-auto h-auto object-contain" />
      </div>
      <div className="p-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-black text-[#1a365d]">{spec.title}</h2>
          <p className="text-xs text-slate-500 mt-1">{spec.hint}</p>
        </div>
        <button disabled={!ready} onClick={download} className="shrink-0 bg-[#1a365d] text-white rounded-2xl px-4 py-3 font-bold text-sm hover:bg-[#c5a059] disabled:opacity-50 transition-colors flex items-center gap-2">
          <Download size={17} />
          تنزيل PNG
        </button>
      </div>
    </article>
  );
}

export default function BrandSocialKit() {
  return (
    <>
      <PageMeta title="ملفات السوشال" />
      <main className="min-h-screen bg-slate-50 font-cairo" dir="rtl">
        <section className="bg-[#0a0f1e] text-white relative overflow-hidden">
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: 'radial-gradient(#c5a059 1px, transparent 1px)', backgroundSize: '28px 28px' }} />
          <div className="max-w-7xl mx-auto px-6 py-16 relative">
            <p className="text-[#c5a059] font-black tracking-[.25em] text-xs mb-3">SEMAK SOCIAL KIT</p>
            <h1 className="text-3xl md:text-5xl font-black">أصول سوشال ميديا مؤسسية</h1>
            <p className="text-slate-300 mt-4 max-w-3xl leading-8">حزمة موحّدة لبيانات سماك العقارية فقط: الاسم والشعار ونبذة الشركة وبيانات التواصل الرسمية، دون أسعار أو وعود أو معلومات عن المشاريع.</p>
          </div>
        </section>

        <section className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex items-center gap-3 mb-7 text-[#1a365d]">
            <span className="w-10 h-10 rounded-2xl bg-[#c5a059]/15 grid place-items-center"><ImageIcon size={20} /></span>
            <div>
              <h2 className="font-black text-2xl">الحزمة المؤسسية</h2>
              <p className="text-sm text-slate-500">كل أصل جاهز للتنزيل بصيغة PNG وبالمقاس المحدد تحته.</p>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-6">{ASSETS.map((spec) => <SocialCanvas key={spec.id} spec={spec} />)}</div>
          <div className="mt-10 bg-white border border-[#c5a059]/25 rounded-[2rem] p-6 flex gap-4 items-start">
            <Check className="text-[#c5a059] shrink-0 mt-1" />
            <p className="leading-8 text-slate-600">اعتمدنا الشعار الذهبي على الخلفيات الكحلية، والخطوط الهندسية الهادئة، والمبنى كعنصر بصري فقط. قالب واتساب هو صورة حساب لأن واتساب للأعمال لا يوفر مساحة غلاف مستقلة.</p>
          </div>
        </section>
      </main>
    </>
  );
}
