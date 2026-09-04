import React, { useState, useRef, useEffect } from 'react';
import { Send, RefreshCw, MessageSquarePlus } from 'lucide-react';
import { API_URL, getAdminToken } from '../../lib/api/client';
import MiniMarkdown from '../../components/MiniMarkdown';

const SUGGESTIONS = [
    'كم سعر سلك 4 ملي وآخر مورد؟',
    'وش الأصناف اللي ارتفعت أسعارها؟',
    'كم المستحق لشركة دائرة الكيان؟',
    'فواتير هذا الشهر بلا مستند',
];

// ─── المساعد الذكي داخل التطبيق — بصلاحيات المشتريات نفسها ─────────────────
export default function BuyChat({ userName = '' }) {
    const [messages, setMessages] = useState(() => {
        try { return JSON.parse(sessionStorage.getItem('buy_ai_chat') || '[]'); } catch { return []; }
    });
    const [input, setInput]   = useState('');
    const [busy, setBusy]     = useState(false);
    const endRef = useRef(null);

    useEffect(() => {
        try { sessionStorage.setItem('buy_ai_chat', JSON.stringify(messages.slice(-30))); } catch { /* تجاهل */ }
        endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const send = async text => {
        const q = (text ?? input).trim();
        if (!q || busy) return;
        setInput('');
        const next = [...messages, { role: 'user', content: q }];
        setMessages(next); setBusy(true);
        try {
            const t = getAdminToken();
            const r = await fetch(`${API_URL}?action=ai_assistant_chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
                body: JSON.stringify({ messages: next.slice(-14) }),
            }).then(x => x.json());
            setMessages(m => [...m, {
                role: 'assistant',
                content: r.success ? r.reply : ((r.message || 'تعذر الاتصال') + (r.detail ? ' — ' + r.detail : '')),
            }]);
        } catch {
            setMessages(m => [...m, { role: 'assistant', content: 'تعذر الاتصال بالخادم' }]);
        } finally { setBusy(false); }
    };

    const reset = () => {
        setMessages([]);
        try { sessionStorage.removeItem('buy_ai_chat'); } catch { /* تجاهل */ }
    };

    return (
        <div className="flex flex-col h-[calc(100vh-11rem)]">
            <div className="flex items-center justify-between px-4 py-2">
                <span className="text-xs font-black text-slate-300">المساعد الذكي</span>
                <button onClick={reset} className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                    <MessageSquarePlus size={13} /> جلسة جديدة
                </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 space-y-2">
                {!messages.length && (
                    <div className="pt-2 space-y-2">
                        <p className="text-center text-xs text-slate-500 font-bold">
                            {userName ? `يا هلا ${userName}! ` : ''}جرب تسألني:
                        </p>
                        {SUGGESTIONS.map(s => (
                            <button key={s} onClick={() => send(s)}
                                className="w-full text-right text-xs font-bold bg-white/5 border border-white/10 rounded-xl px-3 py-2.5">
                                {s}
                            </button>
                        ))}
                    </div>
                )}
                {messages.map((m, i) => (
                    <div key={i} className={m.role === 'user' ? 'flex justify-start' : ''}>
                        <div className={m.role === 'user'
                            ? 'max-w-[85%] bg-[#2d5299] rounded-2xl rounded-tr-sm px-3 py-2 text-xs whitespace-pre-wrap'
                            : 'bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm px-3 py-2 text-xs'}>
                            {m.role === 'user' ? m.content : <MiniMarkdown text={m.content} />}
                        </div>
                    </div>
                ))}
                {busy && <div className="bg-white/5 rounded-2xl px-3 py-2 w-fit"><RefreshCw size={14} className="animate-spin text-gold-500" /></div>}
                <div ref={endRef} />
            </div>

            <div className="p-3 flex gap-2 border-t border-white/10">
                <input value={input} onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && send()}
                    placeholder="اسأل عن الأسعار والموردين والفواتير..."
                    className="flex-1 px-3 py-3 rounded-xl bg-white/5 border border-white/10 text-sm outline-none focus:border-gold-500" />
                <button onClick={() => send()} disabled={busy || !input.trim()}
                    className="w-12 rounded-xl bg-gold-500 text-slate-900 flex items-center justify-center disabled:opacity-40">
                    <Send size={17} />
                </button>
            </div>
        </div>
    );
}
