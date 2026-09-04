import React from 'react';

// ─── عارض ماركداون مصغّر: عناوين وقوائم وجداول وتشديد — بلا مكتبات خارجية ────
// النص يُحوَّل إلى عناصر React مباشرة، فلا حقن HTML ولا حاجة لتنقية.

// تشديد **نص** ورمز الريال ⃀ داخل السطر
function inline(text, keyBase) {
    const out = [];
    const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
    parts.forEach((p, i) => {
        if (/^\*\*[^*]+\*\*$/.test(p)) {
            out.push(<strong key={keyBase + 'b' + i} className="font-black">{sar(p.slice(2, -2), keyBase + 'b' + i)}</strong>);
        } else if (p) {
            out.push(<React.Fragment key={keyBase + 't' + i}>{sar(p, keyBase + 't' + i)}</React.Fragment>);
        }
    });
    return out;
}

function sar(text, keyBase) {
    const parts = String(text).split('⃀');
    if (parts.length === 1) return text;
    return parts.map((p, i) => (
        <React.Fragment key={keyBase + 's' + i}>{p}{i < parts.length - 1 && <span className="sar" />}</React.Fragment>
    ));
}

const cells = line => line.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').map(c => c.trim());
const isSep  = line => /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes('-');

export default function MiniMarkdown({ text }) {
    const lines = String(text || '').split('\n');
    const blocks = [];
    let i = 0;
    // بداية جدول صحيحة فقط، حتى لا يعلق السطر الذي يبدأ بشرطة رأسية بلا فاصل
    const tableAt = k => k < lines.length && lines[k].trim().startsWith('|')
        && k + 1 < lines.length && isSep(lines[k + 1]);

    while (i < lines.length) {
        const line = lines[i];

        // جدول: سطر أعمدة يليه سطر فاصل
        if (tableAt(i)) {
            const head = cells(line);
            i += 2;
            const rows = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(cells(lines[i])); i++; }
            blocks.push(
                <div key={'tb' + i} className="my-2 -mx-1 overflow-x-auto">
                    <table className="w-full text-[11px] border-collapse">
                        <thead>
                            <tr>{head.map((h, k) => (
                                <th key={k} className="bg-slate-100 dark:bg-brand-700 text-slate-600 dark:text-brand-100 font-black px-2 py-1.5 text-right whitespace-nowrap border border-slate-200 dark:border-brand-600">
                                    {inline(h, 'h' + k)}
                                </th>))}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((r, ri) => (
                                <tr key={ri}>
                                    {r.map((c, ci) => (
                                        <td key={ci} className="px-2 py-1.5 border border-slate-200 dark:border-brand-700 whitespace-nowrap align-top">
                                            {inline(c, 'c' + ri + '_' + ci)}
                                        </td>))}
                                </tr>))}
                        </tbody>
                    </table>
                </div>
            );
            continue;
        }

        // عنوان
        const h = line.match(/^(#{1,4})\s+(.*)$/);
        if (h) {
            blocks.push(<div key={'h' + i} className="font-black text-[12px] mt-2 mb-1 text-brand-900 dark:text-brand-50">{inline(h[2], 'hh' + i)}</div>);
            i++; continue;
        }

        // قائمة
        if (/^\s*([-*]|\d+[.)])\s+/.test(line)) {
            const items = [];
            while (i < lines.length && /^\s*([-*]|\d+[.)])\s+/.test(lines[i])) {
                items.push(lines[i].replace(/^\s*([-*]|\d+[.)])\s+/, '')); i++;
            }
            blocks.push(
                <ul key={'ul' + i} className="list-disc pr-4 space-y-0.5 my-1">
                    {items.map((it, k) => <li key={k}>{inline(it, 'li' + i + '_' + k)}</li>)}
                </ul>
            );
            continue;
        }

        if (line.trim() === '') { i++; continue; }

        const para = [];
        do { para.push(lines[i]); i++; }
        while (i < lines.length && lines[i].trim() !== '' && !tableAt(i)
               && !/^(#{1,4})\s+/.test(lines[i]) && !/^\s*([-*]|\d+[.)])\s+/.test(lines[i]));
        blocks.push(<p key={'p' + i} className="my-1 leading-relaxed">{inline(para.join(' '), 'pp' + i)}</p>);
    }

    return <div className="space-y-0.5">{blocks}</div>;
}
