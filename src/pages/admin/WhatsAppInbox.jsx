// ============================================================
// src/pages/admin/WhatsAppInbox.jsx
// صندوق بريد WhatsApp — Azeer (mottasl.ai)
// ============================================================
import { useState, useEffect, useRef, useCallback } from "react";
import { RefreshCw, Send, LayoutTemplate, ChevronDown, ChevronUp } from "lucide-react";
import {
  getWhatsAppMessages,
  sendWhatsAppMessage,
  getAzeerTemplates,
  normalizePhone,
} from "../../services/whatsappService";

const REFRESH_INTERVAL = 30_000;

export default function WhatsAppInbox() {
  const [conversations, setConversations] = useState([]);
  const [selectedPhone, setSelectedPhone] = useState(null);
  const [messages, setMessages] = useState([]);
  const [replyText, setReplyText]     = useState("");
  const [loading, setLoading]         = useState(true);
  const [sending, setSending]         = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // قوالب Azeer
  const [templates, setTemplates]           = useState([]);
  const [showTemplates, setShowTemplates]   = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [templateVars, setTemplateVars]     = useState([]);

  // حقل رقم جوال يدوي (للإرسال لجهة جديدة)
  const [newPhone, setNewPhone]   = useState("");
  const [showNewPhone, setShowNewPhone] = useState(false);

  const chatEndRef = useRef(null);

  // ─── جلب المحادثات ──────────────────────────────────────────
  const fetchConversations = useCallback(async () => {
    const data = await getWhatsAppMessages({});
    setConversations(data.conversations || []);
    setLoading(false);
  }, []);

  // ─── جلب رسائل محادثة ───────────────────────────────────────
  const fetchMessages = useCallback(async (phone) => {
    const data = await getWhatsAppMessages({ phone });
    setMessages(data.messages || []);
    setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  useEffect(() => {
    fetchConversations();
    const iv = setInterval(fetchConversations, REFRESH_INTERVAL);
    return () => clearInterval(iv);
  }, [fetchConversations]);

  useEffect(() => {
    if (!selectedPhone) return;
    fetchMessages(selectedPhone);
    const iv = setInterval(() => fetchMessages(selectedPhone), REFRESH_INTERVAL);
    return () => clearInterval(iv);
  }, [selectedPhone, fetchMessages]);

  // ─── جلب القوالب ────────────────────────────────────────────
  const handleLoadTemplates = async () => {
    setLoadingTemplates(true);
    const list = await getAzeerTemplates();
    setTemplates(list);
    setShowTemplates(true);
    setLoadingTemplates(false);
  };

  // ─── اختيار قالب ────────────────────────────────────────────
  const handleSelectTemplate = (tpl) => {
    setSelectedTemplate(tpl);
    // احسب عدد المتغيرات من body component
    const body = tpl.components?.find(c => c.type === "BODY");
    const count = (body?.text?.match(/\{\{(\d+)\}\}/g) || []).length;
    setTemplateVars(Array(count).fill(""));
    setShowTemplates(false);
  };

  const handleClearTemplate = () => {
    setSelectedTemplate(null);
    setTemplateVars([]);
  };

  // ─── إرسال رسالة ────────────────────────────────────────────
  const handleSend = async () => {
    const targetPhone = selectedPhone || normalizePhone(newPhone);
    if (!targetPhone) return;

    let msgBody = replyText.trim();
    let payload;

    if (selectedTemplate) {
      // إرسال عبر template
      payload = {
        action: "send_whatsapp",
        phone: targetPhone,
        message: `[Template: ${selectedTemplate.name}]`,
        type: "template",
        template_name: selectedTemplate.name,
        template_vars: templateVars,
      };
    } else {
      if (!msgBody) return;
      payload = {
        action: "send_whatsapp",
        phone: targetPhone,
        message: msgBody,
        type: "custom",
      };
    }

    setSending(true);
    try {
      const res = await fetch("https://semak.sa/api.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await res.json();
      if (result.success) {
        const displayMsg = selectedTemplate
          ? `[قالب: ${selectedTemplate.name}] ${templateVars.join(" — ")}`
          : msgBody;
        setMessages(prev => [...prev, {
          id: Date.now(), from_phone: "me", message_body: displayMsg,
          direction: "outbound", created_at: new Date().toISOString(), status: "sent",
        }]);
        setReplyText("");
        handleClearTemplate();
        if (newPhone && !selectedPhone) {
          setSelectedPhone(targetPhone);
          setShowNewPhone(false);
          setNewPhone("");
        }
        setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      } else {
        alert("فشل الإرسال: " + (result.error || "خطأ غير معروف"));
      }
    } catch {
      alert("فشل الاتصال بالخادم");
    }
    setSending(false);
  };

  const filtered = conversations.filter(c =>
    (c.from_name || c.from_phone || "").toLowerCase().includes(searchQuery.toLowerCase())
  );
  const selectedConv = conversations.find(c => c.from_phone === selectedPhone);

  return (
    <div className="flex h-[calc(100vh-6rem)] bg-white rounded-2xl shadow overflow-hidden border border-gray-100 mx-4 my-4">

      {/* ─── Sidebar ──────────────────────────────────────────── */}
      <div className="w-80 border-l border-gray-200 flex flex-col bg-gray-50 flex-shrink-0">

        {/* Header */}
        <div className="p-4 bg-[#1a365d]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-white font-bold text-lg">
              <WaIcon /> صندوق واتساب
            </div>
            <button onClick={fetchConversations} title="تحديث" className="text-white/60 hover:text-white transition">
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
          <input
            type="text" placeholder="بحث..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 rounded-full text-gray-800 text-sm outline-none"
          />
        </div>

        {/* زر إرسال لجهة جديدة */}
        <button
          onClick={() => { setShowNewPhone(!showNewPhone); setSelectedPhone(null); }}
          className="mx-3 mt-3 px-4 py-2 bg-[#25D366] text-white rounded-xl text-sm font-bold hover:bg-green-600 transition flex items-center justify-center gap-2"
        >
          <span>+</span> رسالة جديدة
        </button>

        {showNewPhone && (
          <div className="mx-3 mt-2 p-3 bg-white rounded-xl border border-green-200">
            <p className="text-xs font-bold text-gray-500 mb-1">رقم الجوال (مثال: 966501234567)</p>
            <input
              type="tel" value={newPhone} onChange={e => setNewPhone(e.target.value)}
              placeholder="966XXXXXXXXX" dir="ltr"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-green-400"
            />
          </div>
        )}

        {/* قائمة المحادثات */}
        <div className="flex-1 overflow-y-auto mt-2">
          {loading ? (
            <div className="flex items-center justify-center h-32">
              <RefreshCw className="animate-spin text-[#25D366]" size={24} />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">لا توجد محادثات بعد</div>
          ) : filtered.map(conv => (
            <button
              key={conv.from_phone}
              onClick={() => { setSelectedPhone(conv.from_phone); setShowNewPhone(false); }}
              className={`w-full text-right px-4 py-3 flex items-center gap-3 hover:bg-gray-100 transition border-b border-gray-100 ${
                conv.from_phone === selectedPhone ? "bg-white border-r-4 border-r-[#25D366]" : ""
              }`}
            >
              <div className="w-10 h-10 rounded-full bg-[#25D366] flex-shrink-0 flex items-center justify-center text-white font-bold text-sm">
                {(conv.from_name || conv.from_phone || "؟")[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0 text-right">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-800 text-sm truncate">{conv.from_name || "عميل"}</span>
                  {conv.unread > 0 && (
                    <span className="w-5 h-5 rounded-full bg-[#25D366] text-white text-xs flex items-center justify-center flex-shrink-0 mr-1">
                      {conv.unread}
                    </span>
                  )}
                </div>
                <span className="text-xs text-gray-400 font-mono">{conv.from_phone}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ─── Chat Area ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0">
        {(selectedPhone || showNewPhone) ? (
          <>
            {/* Chat Header */}
            <div className="px-5 py-3 bg-[#f0f2f5] border-b border-gray-200 flex items-center gap-3 flex-shrink-0">
              {selectedPhone ? (
                <>
                  <div className="w-10 h-10 rounded-full bg-[#25D366] flex items-center justify-center text-white font-bold">
                    {(selectedConv?.from_name || selectedPhone)[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800 text-sm">{selectedConv?.from_name || "عميل"}</p>
                    <p className="text-xs text-gray-500 font-mono">{selectedPhone}</p>
                  </div>
                </>
              ) : (
                <div>
                  <p className="font-bold text-gray-800 text-sm">رسالة جديدة</p>
                  <p className="text-xs text-gray-500 font-mono">{newPhone || "أدخل رقم الجوال"}</p>
                </div>
              )}

              {/* زر القوالب */}
              <button
                onClick={showTemplates ? () => setShowTemplates(false) : handleLoadTemplates}
                className="mr-auto flex items-center gap-2 px-4 py-2 bg-[#1a365d] text-white rounded-xl text-xs font-bold hover:bg-blue-900 transition"
              >
                {loadingTemplates
                  ? <RefreshCw size={14} className="animate-spin" />
                  : <LayoutTemplate size={14} />}
                القوالب
                {showTemplates ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              </button>
            </div>

            {/* قائمة القوالب (dropdown) */}
            {showTemplates && (
              <div className="bg-white border-b border-gray-200 p-4 max-h-60 overflow-y-auto">
                {templates.length === 0 ? (
                  <p className="text-center text-gray-400 text-sm py-4">لا توجد قوالب معتمدة في حسابك</p>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {templates.filter(t => t.status === "approved" || t.status === "APPROVED").map(tpl => (
                      <button
                        key={tpl.id || tpl.name}
                        onClick={() => handleSelectTemplate(tpl)}
                        className="text-right px-4 py-3 rounded-xl border border-gray-200 hover:border-[#25D366] hover:bg-green-50 transition"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-gray-800 text-sm">{tpl.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                            tpl.category === "UTILITY" ? "bg-blue-100 text-blue-700" :
                            tpl.category === "MARKETING" ? "bg-purple-100 text-purple-700" :
                            "bg-gray-100 text-gray-600"
                          }`}>{tpl.category}</span>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-2">
                          {tpl.components?.find(c => c.type === "BODY")?.text || ""}
                        </p>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* القالب المختار */}
            {selectedTemplate && (
              <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-blue-700 flex items-center gap-1">
                    <LayoutTemplate size={12} /> قالب: {selectedTemplate.name}
                  </span>
                  <button onClick={handleClearTemplate} className="text-xs text-red-500 hover:text-red-700 font-bold">✕ إلغاء</button>
                </div>
                <p className="text-xs text-gray-600 mb-2 bg-white p-2 rounded-lg border border-blue-100">
                  {selectedTemplate.components?.find(c => c.type === "BODY")?.text || ""}
                </p>
                {templateVars.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {templateVars.map((v, i) => (
                      <div key={i}>
                        <label className="text-xs font-bold text-blue-600 block mb-1">{`{{${i + 1}}}`}</label>
                        <input
                          type="text" value={v} placeholder={`قيمة المتغير ${i + 1}`}
                          onChange={e => {
                            const nv = [...templateVars];
                            nv[i] = e.target.value;
                            setTemplateVars(nv);
                          }}
                          className="w-full px-2 py-1.5 rounded-lg border border-blue-200 text-xs outline-none focus:border-blue-400"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2" style={{ background: "#e5ddd5" }}>
              {selectedPhone && messages.length === 0 && (
                <div className="text-center text-gray-400 text-sm mt-10">لا توجد رسائل بعد</div>
              )}
              {[...messages].reverse().map(msg => (
                <div key={msg.id} className={`flex ${msg.direction === "outbound" ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl shadow-sm text-sm whitespace-pre-wrap ${
                    msg.direction === "outbound"
                      ? "bg-white text-gray-800 rounded-tl-none"
                      : "bg-[#dcf8c6] text-gray-800 rounded-tr-none"
                  }`}>
                    <p>{msg.message_body}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {msg.created_at
                        ? new Date(msg.created_at).toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" })
                        : ""}
                      {msg.direction === "outbound" && " ✓✓"}
                    </p>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Reply Box */}
            <div className="p-3 bg-[#f0f2f5] border-t border-gray-200 flex items-end gap-2 flex-shrink-0">
              {!selectedTemplate && (
                <textarea
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  placeholder="اكتب رسالتك أو اختر قالباً..."
                  rows={2}
                  className="flex-1 px-4 py-2 rounded-2xl border border-gray-300 resize-none outline-none text-sm focus:border-[#25D366] transition"
                />
              )}
              {selectedTemplate && (
                <div className="flex-1 px-4 py-2 rounded-2xl border border-[#25D366] bg-green-50 text-sm text-green-700 font-bold text-center">
                  جاهز لإرسال القالب ← اضغط إرسال
                </div>
              )}
              <button
                onClick={handleSend}
                disabled={sending || (!replyText.trim() && !selectedTemplate)}
                className="w-10 h-10 rounded-full bg-[#25D366] text-white flex items-center justify-center hover:bg-green-600 transition disabled:opacity-40 flex-shrink-0"
              >
                {sending ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
              </button>
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400" style={{ background: "#e5ddd5" }}>
            <WaIcon size={64} className="opacity-30 mb-4" />
            <p className="text-lg font-bold">اختر محادثة أو أرسل رسالة جديدة</p>
            <p className="text-sm mt-1">رسائل واتساب من عملائك تظهر هنا</p>
          </div>
        )}
      </div>
    </div>
  );
}

function WaIcon({ size = 24, className = "" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.38 1.25 4.80L2.05 22l5.43-1.42c1.38.74 2.94 1.16 4.56 1.16 5.46 0 9.91-4.45 9.91-9.91S17.50 2 12.04 2zm0 18.16c-1.47 0-2.91-.4-4.16-1.15l-.3-.18-3.12.82.83-3.04-.2-.31a8.26 8.26 0 01-1.27-4.43c0-4.54 3.7-8.24 8.24-8.24 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 012.41 5.83c.02 4.54-3.68 8.24-8.22 8.24zm4.52-6.16c-.25-.12-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.12-.17.25-.64.81-.78.97-.14.17-.29.19-.54.06-.25-.12-1.05-.39-1.99-1.23-.74-.66-1.23-1.47-1.38-1.72-.14-.25-.02-.38.11-.51.11-.11.25-.29.37-.43s.17-.25.25-.41c.08-.17.04-.31-.02-.43s-.56-1.34-.76-1.84c-.2-.48-.41-.42-.56-.43h-.48c-.17 0-.43.06-.66.31-.22.25-.86.85-.86 2.07 0 1.22.89 2.40 1.01 2.56.12.17 1.75 2.67 4.23 3.74.59.26 1.05.41 1.41.52.59.19 1.13.16 1.56.1.48-.07 1.47-.60 1.67-1.18.21-.58.21-1.07.14-1.18s-.22-.16-.47-.28z"/>
    </svg>
  );
}
