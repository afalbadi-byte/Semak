// بيانات تواصل سماك لمنشورات اليوم الوطني: عمود التواصل أسفل اليسار (بلا رمز البروشور — طلب أحمد).
// نفس القيم والأيقونات والرمز في assistant/post/make-post.cjs، والخط IBM Plex Sans Arabic (الخط الثانوي في دليل الهوية).
const fs = require('fs');
const path = require('path');
const A = f => path.join(__dirname, '..', '..', 'assistant', 'post', 'assets', f);
const b64 = (f, m) => `data:${m};base64,` + fs.readFileSync(A(f)).toString('base64');

const CONTACTS = [['ig', 'info.semak'], ['x', 'semak_sa'], ['web', 'semak.sa'], ['mail', 'info@semak.sa'], ['tel', '920 032 842']];
const ICON = {
  ig: '<rect x="2.5" y="2.5" width="19" height="19" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r=".9" fill="currentColor" stroke="none"/>',
  x: '<rect x="2.5" y="2.5" width="19" height="19" rx="5"/><path d="M8 7.5l8 9M16 7.5l-8 9"/>',
  web: '<circle cx="12" cy="12" r="9.5"/><path d="M2.5 12h19M12 2.5c2.6 2.8 3.9 6 3.9 9.5s-1.3 6.7-3.9 9.5c-2.6-2.8-3.9-6-3.9-9.5s1.3-6.7 3.9-9.5z"/>',
  mail: '<rect x="2.5" y="4.5" width="19" height="15" rx="2.5"/><path d="M3 6.5l9 6.5 9-6.5"/>',
  tel: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
};

const css = `
@font-face{font-family:'PlexK';src:url('${b64('IBMPlexSansArabic-Bold.ttf', 'font/ttf')}');font-weight:700}
.k-contacts{position:absolute;left:42px;bottom:28px;direction:ltr}
.k-row{display:flex;align-items:center;gap:14px;height:44px}
.k-row svg{width:26px;height:26px;fill:none;stroke:#fff;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round;flex:none;opacity:.95}
.k-row span{font-family:'PlexK',Tahoma,sans-serif;font-weight:700;font-size:25px;color:#fff;letter-spacing:.2px}
.k-qr{position:absolute;right:40px;bottom:24px;width:124px;text-align:center}
.k-qr .c{display:inline-block;background:#fff;border-radius:12px;padding:9px;box-shadow:0 6px 18px rgba(0,0,0,.18)}
.k-qr img{display:block;width:92px;height:92px}
.k-qr .t{margin-top:8px;font-family:'PlexK',Tahoma,sans-serif;font-weight:700;font-size:19px;line-height:1.35;color:#fff}`;

const html = `
<div class="k-contacts">${CONTACTS.map(([k, v]) => `<div class="k-row"><svg viewBox="0 0 24 24">${ICON[k]}</svg><span>${v}</span></div>`).join('')}</div>`;

module.exports = { css, html };
