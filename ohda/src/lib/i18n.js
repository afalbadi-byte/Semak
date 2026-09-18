// ─── اللغتان ────────────────────────────────────────────────────────────────
// النصّ العربي هو المفتاح، والإنجليزية ترجمته. فما فاتته الترجمة يظهر عربياً
// ولا ينكسر، ورسائل الخادم العربية تُترجَم بالقاموس نفسه.
import EN from './en';

const saved = (() => { try { return localStorage.getItem('ohda_lang'); } catch (e) { return null; } })();
let LANG = saved === 'en' || saved === 'ar' ? saved
    : (typeof navigator !== 'undefined' && /^ar/i.test(navigator.language || '') ? 'ar' : (saved || 'ar'));

export const getLang = () => LANG;
export const isEn = () => LANG === 'en';

export function setLang(l) {
    LANG = l === 'en' ? 'en' : 'ar';
    try { localStorage.setItem('ohda_lang', LANG); } catch (e) { /* تجاهل */ }
    applyDir();
}

export function applyDir() {
    const h = document.documentElement;
    h.lang = LANG;
    h.dir = LANG === 'en' ? 'ltr' : 'rtl';
}

export function t(s, vars) {
    if (s === undefined || s === null) return '';
    let out = LANG === 'en' ? (EN[s] !== undefined ? EN[s] : s) : s;
    if (vars) for (const k of Object.keys(vars)) out = out.split('{' + k + '}').join(String(vars[k]));
    return out;
}

applyDir();
