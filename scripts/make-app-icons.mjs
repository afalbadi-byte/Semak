// ─── أيقونات تطبيقات سماك — هويّة واحدة، وشارة تميّز كل تطبيق ─────────────
// الخلفية نفسها لكل التطبيقات (الكحلي ونقش سماك وشعارها الأبيض)، وفي الزاوية
// شارةٌ دائرية بلون التطبيق ورمزه، فتُعرَف الأيقونة على الشاشة الرئيسية من نظرة.
// شغّله عند إضافة تطبيق أو تغيير رمز:  node scripts/make-app-icons.mjs
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const ROOT = 'C:/Users/ahmed/Semak';
const sharp = require(ROOT + '/rega-registration/node_modules/sharp');
const React = require(ROOT + '/node_modules/react');
const { renderToStaticMarkup } = require(ROOT + '/node_modules/react-dom/server');
const L = require(ROOT + '/node_modules/lucide-react');

const OUT = path.resolve('public/images/icons');
fs.mkdirSync(OUT, { recursive: true });

// اللون والرمز لكل تطبيق — يطابق src/lib/semakApps.js
const APPS = [
    { slug: 'apps', color: '#ffffff', ink: '#1a365d', ring: '#c5a059', icon: 'LayoutGrid' },
    { slug: 'buy',  color: '#f59e0b', ink: '#ffffff', ring: '#ffffff', icon: 'ShoppingCart' },
    { slug: 'proj', color: '#0ea5e9', ink: '#ffffff', ring: '#ffffff', icon: 'HardHat' },
    { slug: 'qc',   color: '#10b981', ink: '#ffffff', ring: '#ffffff', icon: 'ClipboardCheck' },
    { slug: 'meet', color: '#8b5cf6', ink: '#ffffff', ring: '#ffffff', icon: 'Video' },
];

const S = 512;
const glyph = (name, color) => renderToStaticMarkup(React.createElement(L[name], { size: 24, color, strokeWidth: 2.2 }))
    .replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');

// لونٌ أبيض بشفافية الصورة الأصلية (مضروبةً في opacity) — للنقش والشعار
async function tintWhite(input, opacity = 1) {
    const buf = await sharp(input).ensureAlpha().png().toBuffer();
    const { width: w, height: h } = await sharp(buf).metadata();
    let alpha = await sharp(buf).extractChannel(3).raw().toBuffer();
    if (opacity !== 1) alpha = Buffer.from(alpha.map(v => Math.round(v * opacity)));
    return sharp({ create: { width: w, height: h, channels: 3, background: '#ffffff' } })
        .joinChannel(alpha, { raw: { width: w, height: h, channels: 1 } }).png().toBuffer();
}

// الخلفية: تدرّج كحلي ونقش سماك الأبيض الخافت
async function background(rounded) {
    const pat = await sharp('public/images/pattern-semak.png').resize(Math.round(S * 1.5))
        .extract({ left: 90, top: 60, width: S, height: S }).png().toBuffer();
    const lines = await tintWhite(pat, 0.13);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
      <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d5299"/><stop offset="1" stop-color="#16305a"/></linearGradient></defs>
      <rect width="${S}" height="${S}" fill="url(#g)"/></svg>`;
    const flat = await sharp(Buffer.from(svg)).composite([{ input: lines }]).png().toBuffer();
    if (!rounded) return flat;
    const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}"><rect width="${S}" height="${S}" rx="112" fill="#fff"/></svg>`);
    return sharp(flat).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

const whiteLogo = width => sharp('public/logo.png').resize({ width }).png().toBuffer().then(b => tintWhite(b));

async function make(app, pad) {
    // pad: هامش المنطقة الآمنة (المقنّعة تحتاج هامشاً أكبر يقصّه أندرويد)
    const inner = S - pad * 2;
    const logo = await whiteLogo(Math.round(inner * 0.56));
    const badge = Math.round(inner * 0.44);
    const bx = pad + inner - badge - Math.round(inner * 0.02);
    const by = pad + inner - badge - Math.round(inner * 0.02);
    const g = Math.round(badge * 0.56);
    const badgeSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${badge}" height="${badge}">
      <circle cx="${badge / 2}" cy="${badge / 2}" r="${badge / 2 - Math.round(badge * 0.035)}" fill="${app.color}" stroke="${app.ring}" stroke-width="${Math.round(badge * 0.06)}"/>
      <svg x="${(badge - g) / 2}" y="${(badge - g) / 2}" width="${g}" height="${g}" viewBox="0 0 24 24" fill="none" stroke="${app.ink}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">${glyph(app.icon, app.ink)}</svg>
    </svg>`;
    return async rounded => sharp(await background(rounded)).composite([
        { input: logo, left: Math.round(pad + inner * 0.03), top: Math.round(pad + inner * 0.03) },
        { input: Buffer.from(badgeSvg), left: bx, top: by },
    ]).png().toBuffer();
}

(async () => {
    for (const app of APPS) {
        const std = await make(app, 56);
        const msk = await make(app, 104);
        const rounded = await std(true);
        const square = await std(false);
        await sharp(rounded).resize(512).toFile(path.join(OUT, `${app.slug}-512.png`));
        await sharp(rounded).resize(192).toFile(path.join(OUT, `${app.slug}-192.png`));
        await sharp(square).resize(180).toFile(path.join(OUT, `${app.slug}-180.png`));   // iOS يقصّ الزوايا بنفسه
        await sharp(await msk(false)).resize(512).toFile(path.join(OUT, `${app.slug}-maskable.png`));
        console.log('✔', app.slug);
    }
    // لوحة معاينة للخمسة جنباً إلى جنب
    const tiles = await Promise.all(APPS.map(a => sharp(path.join(OUT, `${a.slug}-512.png`)).resize(160).png().toBuffer()));
    await sharp({ create: { width: 5 * 180 + 20, height: 200, channels: 3, background: '#e5e7eb' } })
        .composite(tiles.map((t, i) => ({ input: t, left: 20 + i * 180, top: 20 }))).png()
        .toFile(path.join(process.env.PREVIEW || OUT, 'preview.png'));
})();
