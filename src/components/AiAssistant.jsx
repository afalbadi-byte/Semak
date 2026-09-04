import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, RefreshCw, Bot, MessageSquarePlus, LogOut, Maximize2, Minimize2 } from 'lucide-react';
import { API_URL, getAdminToken } from '../lib/api/client';
import MiniMarkdown from './MiniMarkdown';

// يرسم محرف الريال الرسمي (U+20C0) برسمة .sar لأن أغلب الخطوط لا تحمله بعد
const renderWithSar = (text) => {
  const parts = String(text).split('⃀');
  if (parts.length === 1) return text;
  return parts.map((p, i) => (
    <React.Fragment key={i}>{p}{i < parts.length - 1 && <span className="sar" />}</React.Fragment>
  ));
};

// ─── مساعد سماك الذكي — نافذة عائمة لموظفي لوحة الإدارة (صلاحية ai_assistant) ───
const SUGGESTIONS = [
  'كم صرفنا على السباكة؟',
  'وش متوسط سعر شراء الرخام؟',
  'وش أسعار الوحدات والعرض الحالي؟',
  'وش ضمانات المشروع؟',
];

export default function AiAssistant({ userName = '' }) {
  const [open, setOpen] = useState(false);
  const [wide, setWide] = useState(false);
  const [messages, setMessages] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('semak_ai_chat') || '[]'); } catch { return []; }
  });
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  const clearChat = () => {
    setMessages([]); setInput('');
    try { sessionStorage.removeItem('semak_ai_chat'); } catch { /* تجاهل */ }
  };
  const newSession = () => { clearChat(); };
  const endSession = () => { clearChat(); setOpen(false); };

  useEffect(() => {
    try { sessionStorage.setItem('semak_ai_chat', JSON.stringify(messages.slice(-30))); } catch { /* تجاهل */ }
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || loading) return;
    setInput('');
    const next = [...messages, { role: 'user', content: q }];
    setMessages(next);
    setLoading(true);
    try {
      const t = getAdminToken();
      const res = await fetch(`${API_URL}?action=ai_assistant_chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
        body: JSON.stringify({ messages: next.slice(-14) }),
      });
      const data = await res.json();
      setMessages(m => [...m, {
        role: 'assistant',
        content: data.success ? data.reply
          : ((data.message || 'تعذر الاتصال — أعد المحاولة') + (data.detail ? ' — ' + data.detail : '')),
      }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'خطأ في الاتصال بالخادم — أعد المحاولة' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* الزر العائم */}
      <button
        onClick={() => setOpen(o => !o)}
        title="مساعد سماك الذكي"
        className="fixed bottom-6 left-6 z-[90] w-14 h-14 rounded-full bg-gradient-to-br from-[#1a365d] to-[#2d5299] shadow-2xl flex items-center justify-center hover:scale-110 transition-transform border-2 border-gold-500/60"
      >
        {open ? <X size={22} className="text-white" /> : <Sparkles size={22} className="text-gold-500" />}
      </button>

      {/* نافذة المحادثة */}
      {open && (
        <div dir="rtl" className={'fixed bottom-24 left-6 z-[90] max-w-[calc(100vw-3rem)] max-h-[80vh] bg-white dark:bg-brand-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-brand-700 flex flex-col overflow-hidden font-cairo ' +
            (wide ? 'w-[760px] h-[640px]' : 'w-[380px] h-[480px]')}>
          {/* الرأس */}
          <div className="bg-gradient-to-l from-[#1a365d] to-[#2d5299] px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <Bot size={18} className="text-gold-500" />
            </div>
            <div className="flex-1">
              <div className="text-white font-black text-sm">مساعد سماك الذكي</div>
              <div className="text-white/60 text-[10px] font-bold">ملم بالمشروع والمشتريات والأسعار — اسأل أي شيء</div>
            </div>
            <button onClick={() => setWide(w => !w)} title={wide ? 'تصغير النافذة' : 'توسيع النافذة'}
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
              {wide ? <Minimize2 size={15} className="text-white" /> : <Maximize2 size={15} className="text-white" />}
            </button>
            <button onClick={newSession} title="جلسة جديدة — يبدأ من صفحة بيضاء"
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition">
              <MessageSquarePlus size={15} className="text-white" />
            </button>
            <button onClick={endSession} title="إنهاء الجلسة — يمسح المحادثة ويغلق"
              className="w-8 h-8 rounded-lg bg-white/10 hover:bg-red-500/70 flex items-center justify-center transition">
              <LogOut size={15} className="text-white" />
            </button>
          </div>

          {/* الرسائل */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-slate-50/60 dark:bg-brand-800/30">
            {messages.length === 0 && (
              <div className="pt-4">
                <p className="text-center text-xs text-slate-400 font-bold mb-3">
                  {userName ? `يا هلا ${userName}! ` : 'يا هلا! '}جرب تسألني:
                </p>
                <div className="flex flex-col gap-2">
                  {SUGGESTIONS.map(s => (
                    <button key={s} onClick={() => send(s)}
                      className="text-right text-xs font-bold text-brand-800 dark:text-brand-200 bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-700 rounded-xl px-3 py-2 hover:border-gold-500 hover:text-gold-600 transition-colors">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                <div className={`px-3 py-2 rounded-2xl text-xs font-medium leading-relaxed ${
                  m.role === 'user'
                    ? 'max-w-[85%] whitespace-pre-wrap bg-[#1a365d] text-white rounded-tr-sm'
                    : 'max-w-full w-full bg-white dark:bg-brand-800 text-slate-700 dark:text-brand-100 border border-slate-100 dark:border-brand-700 rounded-tl-sm'
                }`}>
                  {m.role === 'user' ? renderWithSar(m.content) : <MiniMarkdown text={m.content} />}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-end">
                <div className="bg-white dark:bg-brand-800 border border-slate-100 dark:border-brand-700 rounded-2xl px-3 py-2">
                  <RefreshCw size={13} className="animate-spin text-gold-500" />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* الإدخال */}
          <div className="p-2.5 border-t border-slate-100 dark:border-brand-700 bg-white dark:bg-brand-900 flex items-center gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(); }}
              placeholder="اكتب سؤالك..."
              className="flex-1 px-3 py-2 border border-slate-200 dark:border-brand-700 rounded-xl text-xs font-medium text-slate-700 dark:text-brand-50 dark:bg-brand-900 focus:outline-none focus:ring-2 focus:ring-[#1a365d]/20 focus:border-[#1a365d]"
            />
            <button onClick={() => send()} disabled={loading || !input.trim()}
              className="w-9 h-9 rounded-xl bg-gold-500 hover:bg-amber-600 disabled:opacity-40 text-white flex items-center justify-center transition-colors">
              <Send size={15} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
