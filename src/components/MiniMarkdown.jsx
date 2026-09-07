import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

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

// جدول بزر نسخ يحوّله لنص مفصول بمسافات Tab — يلصق كجدول حقيقي في إكسل/شيتس/وورد
function TableBlock({ head, rows }) {
    const [copied, setCopied] = useState(false);
    const doCopy = () => {
        const tsv = [head, ...rows].map(r => r.join('\t')).join('\n');
        try { navigator.clipboard.writeText(tsv); } catch { /* تجاهل */ }
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
    };
    return (
        <div className="my-2 -mx-1">
            <div className="flex justify-end mb-1">
                <button type="button" onClick={doCopy}
                    className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-[#c5a059] transition-colors">
                    {copied ? <><Check size={11} className="text-emerald-500" /> نُسخ الجدول</> : <><Copy size={11} /> نسخ الجدول</>}
                </button>
            </div>
            <div className="overflow-x-auto">
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
        </div>
    );
}

// رسم بياني احترافي بسيط (شريطي/خطي) — SVG يدوي بلا مكتبات، بألوان الهوية
const CHART_COLORS = ['#1a365d', '#c5a059', '#3b6ea5', '#8a6a3a'];

function ChartBlock({ spec }) {
    const [state, setState] = useState('idle'); // idle | copied | downloaded
    const svgRef = React.useRef(null);
    const { type, title, unit, labels, series } = (() => {
        const s = spec || {};
        return {
            type: s.type === 'line' ? 'line' : 'bar',
            title: String(s.title || ''),
            unit: String(s.unit || ''),
            labels: Array.isArray(s.labels) ? s.labels : [],
            series: Array.isArray(s.series) && s.series.length
                ? s.series.filter(x => x && Array.isArray(x.values))
                : [],
        };
    })();
    if (!labels.length || !series.length) return null;

    const hasLegend = series.length > 1;
    const W = 560, H = 300, padL = 60, padR = 20, padT = title ? 36 : 16, padB = hasLegend ? 60 : 44;
    const plotW = W - padL - padR, plotH = H - padT - padB;
    const allVals = series.flatMap(s => (s.values || []).map(Number).filter(v => !isNaN(v)));
    const maxV = Math.max(1, ...allVals, 0);
    const niceMax = (() => {
        const p = Math.pow(10, Math.floor(Math.log10(maxV || 1)));
        return (Math.ceil(maxV / p) * p) || 1;
    })();
    const yTicks = 4;
    const xForIndex = k => padL + (plotW * (k + 0.5) / labels.length);
    const yForVal = v => padT + plotH - (plotH * v / niceMax);
    const fmt = n => Number(n).toLocaleString('en-US', { maximumFractionDigits: 0 });

    const exportImage = () => {
        try {
            const svgEl = svgRef.current;
            const xml = new XMLSerializer().serializeToString(svgEl);
            const svg64 = btoa(unescape(encodeURIComponent(xml)));
            const img = new window.Image();
            img.onload = () => {
                const scale = 2;
                const canvas = document.createElement('canvas');
                canvas.width = W * scale; canvas.height = H * scale;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                canvas.toBlob(blob => {
                    if (!blob) return;
                    if (navigator.clipboard && window.ClipboardItem) {
                        navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })])
                            .then(() => { setState('copied'); setTimeout(() => setState('idle'), 1500); })
                            .catch(() => downloadBlob(blob));
                    } else downloadBlob(blob);
                }, 'image/png');
            };
            img.src = 'data:image/svg+xml;base64,' + svg64;
        } catch { /* تجاهل */ }
    };
    const downloadBlob = blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = (title || 'رسم-بياني') + '.png'; a.click();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        setState('downloaded'); setTimeout(() => setState('idle'), 1500);
    };

    return (
        <div className="my-2 -mx-1">
            <div className="flex justify-end mb-1">
                <button type="button" onClick={exportImage}
                    className="flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-[#c5a059] transition-colors">
                    {state === 'copied' && <><Check size={11} className="text-emerald-500" /> نُسخت الصورة</>}
                    {state === 'downloaded' && <><Check size={11} className="text-emerald-500" /> نزّلت الصورة</>}
                    {state === 'idle' && <><Copy size={11} /> نسخ كصورة</>}
                </button>
            </div>
            <div className="overflow-x-auto bg-white dark:bg-white rounded-xl border border-slate-200 dark:border-brand-700 p-2">
                <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, direction: 'rtl' }}
                    className="block mx-auto" xmlns="http://www.w3.org/2000/svg">
                    <rect x="0" y="0" width={W} height={H} fill="#ffffff" />
                    {title && (
                        <text x={W / 2} y="20" textAnchor="middle" fontSize="13" fontWeight="900" fontFamily="Cairo, Tahoma, sans-serif" fill="#1a365d">{title}</text>
                    )}
                    {Array.from({ length: yTicks + 1 }).map((_, k) => {
                        const v = niceMax * k / yTicks;
                        const y = yForVal(v);
                        return (
                            <g key={k}>
                                <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                                <text x={padL - 8} y={y + 3} textAnchor="end" fontSize="9" fill="#64748b">{fmt(v)}</text>
                            </g>
                        );
                    })}
                    <line x1={padL} x2={W - padR} y1={padT + plotH} y2={padT + plotH} stroke="#94a3b8" strokeWidth="1" />
                    {type === 'line'
                        ? series.map((s, si) => {
                            const pts = (s.values || []).map((v, k) => `${xForIndex(k)},${yForVal(Number(v) || 0)}`).join(' ');
                            return (
                                <g key={si}>
                                    <polyline points={pts} fill="none" stroke={CHART_COLORS[si % CHART_COLORS.length]} strokeWidth="2.5" />
                                    {(s.values || []).map((v, k) => (
                                        <circle key={k} cx={xForIndex(k)} cy={yForVal(Number(v) || 0)} r="3" fill={CHART_COLORS[si % CHART_COLORS.length]} />
                                    ))}
                                </g>
                            );
                        })
                        : series.map((s, si) => {
                            const groupW = plotW / labels.length;
                            const barW = Math.max(6, (groupW * 0.62) / series.length);
                            return (s.values || []).map((v, k) => {
                                const vv = Number(v) || 0;
                                const x = xForIndex(k) - (series.length * barW) / 2 + si * barW;
                                const y = yForVal(vv);
                                return (
                                    <rect key={si + '_' + k} x={x} y={y} width={barW} height={Math.max(0, (padT + plotH) - y)}
                                        fill={CHART_COLORS[si % CHART_COLORS.length]} rx="2" />
                                );
                            });
                        })}
                    {labels.map((lb, k) => (
                        <text key={k} x={xForIndex(k)} y={padT + plotH + 20} textAnchor="middle" fontSize="10.5" fontFamily="Cairo, Tahoma, sans-serif" fill="#475569">{String(lb)}</text>
                    ))}
                    {hasLegend && (
                        <g>
                            {series.map((s, si) => (
                                <g key={si} transform={`translate(${padL + si * 120}, ${H - 6})`}>
                                    <rect width="8" height="8" y="-8" fill={CHART_COLORS[si % CHART_COLORS.length]} rx="2" />
                                    <text x="14" y="0" fontSize="10.5" fontFamily="Cairo, Tahoma, sans-serif" fill="#334155">{s.name || ''}</text>
                                </g>
                            ))}
                        </g>
                    )}
                </svg>
                {unit && <div className="text-center text-[9px] text-slate-400 mt-1">الوحدة: {unit}</div>}
            </div>
        </div>
    );
}

export default function MiniMarkdown({ text }) {
    const lines = String(text || '').split('\n');
    const blocks = [];
    let i = 0;
    // بداية جدول صحيحة فقط، حتى لا يعلق السطر الذي يبدأ بشرطة رأسية بلا فاصل
    const tableAt = k => k < lines.length && lines[k].trim().startsWith('|')
        && k + 1 < lines.length && isSep(lines[k + 1]);

    while (i < lines.length) {
        const line = lines[i];

        // كتلة مرمَّزة ```lang ... ``` — رسم بياني إن كانت chart، وإلا نص أحادي المسافة
        const fence = line.match(/^```(\w+)?\s*$/);
        if (fence) {
            const lang = fence[1] || '';
            i++;
            const body = [];
            while (i < lines.length && !/^```\s*$/.test(lines[i])) { body.push(lines[i]); i++; }
            if (i < lines.length) i++; // تخطي سطر الإغلاق ```
            const raw = body.join('\n');
            if (lang === 'chart') {
                let spec = null;
                try { spec = JSON.parse(raw); } catch { spec = null; }
                if (spec) { blocks.push(<ChartBlock key={'ch' + i} spec={spec} />); continue; }
            }
            blocks.push(
                <pre key={'code' + i} className="my-2 p-2 rounded-xl bg-slate-100 dark:bg-brand-800 text-[11px] overflow-x-auto whitespace-pre-wrap">{raw}</pre>
            );
            continue;
        }

        // جدول: سطر أعمدة يليه سطر فاصل
        if (tableAt(i)) {
            const head = cells(line);
            i += 2;
            const rows = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) { rows.push(cells(lines[i])); i++; }
            blocks.push(<TableBlock key={'tb' + i} head={head} rows={rows} />);
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
