import { API_URL } from '../utils/helpers';

const API_KEY            = import.meta.env.VITE_MOTTASL_API_KEY;
const ADMIN_PHONE        = import.meta.env.VITE_WA_ADMIN_PHONE;
const TEMPLATE_ID        = import.meta.env.VITE_WA_CLIENT_TEMPLATE_ID;
const TEMPLATE_LANG      = import.meta.env.VITE_WA_CLIENT_TEMPLATE_LANG || "ar";
const MAINT_TEMPLATE_ID  = import.meta.env.VITE_WA_MAINT_TEMPLATE_ID;

const BASE_URL = "https://api.mottasl.ai/v1";

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${API_KEY}`,
});

// تنظيف رقم الهاتف وإضافة مفتاح السعودية
export function normalizePhone(phone) {
  const clean = String(phone).replace(/\D/g, "");
  return clean.startsWith("966") ? clean : `966${clean.replace(/^0/, "")}`;
}

// تسجيل حالة إرسال الواتساب في قاعدة البيانات
async function logWaSent(id, type) {
  if (!id) return;
  fetch(`${API_URL}?action=update_wa_status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, type }),
  });
}

async function sendText(to, body) {
  if (!API_KEY) return;
  return fetch(`${BASE_URL}/message/send`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ to, type: "text", text: { body } }),
  });
}

async function sendTemplate(to, templateId, lang, bodyVars = []) {
  if (!API_KEY || !templateId) return;
  return fetch(`${BASE_URL}/message/send?create=true`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      to,
      type: "template",
      template: {
        template_id: templateId,
        language: lang,
        ...(bodyVars.length > 0 && {
          components: [{
            type: "body",
            parameters: bodyVars.map(v => ({ type: "text", text: String(v) })),
          }],
        }),
      },
    }),
  });
}

// ─── صفحة التواصل ───────────────────────────────────────────

// إشعار الإدارة بعميل جديد — تلقائي عبر API
export async function notifyAdmin({ id, name, phone, interest }) {
  if (!API_KEY || !ADMIN_PHONE) return { ok: false };
  const msg =
    `🔔 *عميل جديد - سماك العقارية*\n\n` +
    `👤 الاسم: ${name}\n` +
    `📞 الجوال: ${phone}\n` +
    `🏠 الاهتمام: ${interest}\n\n` +
    `⏰ ${new Date().toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })}`;
  const res = await sendText(ADMIN_PHONE, msg);
  if (res?.ok) { logWaSent(id, "lead"); return { ok: true }; }
  return { ok: false };
}

// رد ترحيبي للعميل — قالب معتمد أولاً، ثم رسالة نصية
export async function replyToClient(clientPhone, clientName) {
  if (!API_KEY || !clientPhone) return { ok: false };

  if (TEMPLATE_ID) {
    const res = await sendTemplate(normalizePhone(clientPhone), TEMPLATE_ID, TEMPLATE_LANG, [clientName]);
    if (res?.ok) return { ok: true };
  }

  const body =
    `مرحباً ${clientName} 👋\n\n` +
    `شكراً لاهتمامك بـ*سماك العقارية*،\n` +
    `تم استلام طلبك بنجاح وسيتواصل معك أحد مستشارينا في أقرب وقت.\n\n` +
    `للاستفسار الفوري:\n📞 920032842`;
  const res2 = await sendText(normalizePhone(clientPhone), body);
  return { ok: !!res2?.ok };
}

// ─── صفحة الصيانة ───────────────────────────────────────────

// تأكيد استلام الطلب للعميل فور إرسال طلبه
export async function notifyClientTicketReceived({ id, name, unit, type, date, time, phone }) {
  if (!API_KEY || !phone) return { ok: false };
  const tech  = "سيتم التحديد";
  const dateV = date ? `${date} — ${time || ""}` : "سيتم التأكيد";

  // إذا كان عندنا قالب معتمد نستخدمه
  if (MAINT_TEMPLATE_ID) {
    const res = await sendTemplate(normalizePhone(phone), MAINT_TEMPLATE_ID, TEMPLATE_LANG, [
      String(id),           // {{1}} رقم الطلب
      unit,                 // {{2}} الوحدة
      type,                 // {{3}} نوع الطلب
      "قيد الانتظار",       // {{4}} الحالة
      tech,                 // {{5}} الفني
      dateV,                // {{6}} الموعد
      "—",                  // {{7}} رمز الإغلاق
    ]);
    if (res?.ok) { logWaSent(id, "maintenance"); return { ok: true }; }
  }

  // fallback: نص
  const body =
    `✅ *تم استلام طلب الصيانة - سماك العقارية*\n\n` +
    `مرحباً ${name}،\n` +
    `تم استلام طلبك رقم *#${id}* بنجاح.\n\n` +
    `🏠 الوحدة: *${unit}*\n` +
    `⚠️ نوع العطل: *${type}*\n` +
    `📅 الموعد المفضل: *${date || "—"}* — *${time || "—"}*\n\n` +
    `سنتواصل معك قريباً لتأكيد موعد الزيارة.\n` +
    `للاستفسار ردّ على هذه الرسالة 💬`;

  const res2 = await sendText(normalizePhone(phone), body);
  if (res2?.ok) { logWaSent(id, "maintenance"); return { ok: true }; }
  return { ok: false };
}

// إشعار الإدارة بطلب صيانة جديد + تسجيل الحالة
export async function notifyMaintenanceAdmin({ id, name, phone, unit, type, date, time }) {
  const body =
    `🔧 *طلب صيانة جديد #${id || "جديد"} - سماك*\n\n` +
    `👤 المالك: ${name}\n` +
    `📞 الجوال: ${phone}\n` +
    `🏠 الوحدة: ${unit}\n` +
    `⚠️ نوع العطل: ${type}\n` +
    `📅 الموعد المفضل: ${date} — ${time}\n\n` +
    `⏰ ${new Date().toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })}`;
  const res = await sendText(ADMIN_PHONE, body);
  if (res?.ok) logWaSent(id, "maintenance");
  return res;
}

// إشعار العميل تلقائياً عند كل تغيير في حالة طلبه
// يُرجع { ok: true } عند النجاح، أو { ok: false, error } عند الفشل
export async function notifyClientStatusUpdate(ticket) {
  if (!API_KEY)        return { ok: false, error: "API key غير مضبوط" };
  if (!ticket.phone)   return { ok: false, error: "رقم جوال العميل غير موجود" };

  const tech = ticket.technician && ticket.technician !== "لم يتم التعيين"
    ? ticket.technician : "سيتم التحديد";
  const date = ticket.scheduleDate
    ? `${ticket.scheduleDate} — ${ticket.scheduleTime || ""}` : "سيتم التأكيد";
  const otp = ticket.otp || "—";

  try {
    // ── أولوية: قالب معتمد ──────────────────────────────────
    if (MAINT_TEMPLATE_ID) {
      const res = await sendTemplate(
        normalizePhone(ticket.phone),
        MAINT_TEMPLATE_ID,
        TEMPLATE_LANG,
        [
          String(ticket.id),  // {{1}} رقم الطلب
          ticket.unit,        // {{2}} الوحدة
          ticket.type,        // {{3}} نوع الطلب
          ticket.status,      // {{4}} الحالة
          tech,               // {{5}} الفني
          date,               // {{6}} الموعد
          otp,                // {{7}} رمز الإغلاق
        ]
      );
      if (res?.ok) { logWaSent(ticket.id, "maintenance"); return { ok: true }; }
      // إذا فشل القالب نجرب النص
    }

    // ── fallback: رسالة نصية ────────────────────────────────
    const techLine = ticket.technician && ticket.technician !== "لم يتم التعيين"
      ? `👨‍🔧 الفني: ${ticket.technician}\n` : "";
    const dateLine = ticket.scheduleDate
      ? `📅 الموعد: ${ticket.scheduleDate} — ${ticket.scheduleTime || ""}\n` : "";
    const otpLine  = ticket.otp
      ? `\n🔑 رمز الإغلاق (أعطه للفني عند الانتهاء): *${ticket.otp}*\n` : "";

    const body =
      `🔧 *تحديث طلب الصيانة - سماك العقارية*\n\n` +
      `طلب رقم: #${ticket.id} | وحدة: ${ticket.unit}\n` +
      `نوع العطل: ${ticket.type}\n\n` +
      `الحالة الآن: *${ticket.status}*\n` +
      `${techLine}${dateLine}${otpLine}\n` +
      `للاستفسار ردّ على هذه الرسالة 💬`;

    const res2 = await sendText(normalizePhone(ticket.phone), body);
    if (res2?.ok) { logWaSent(ticket.id, "maintenance"); return { ok: true }; }

    return { ok: false, error: `HTTP ${res2?.status}` };
  } catch (err) {
    return { ok: false, error: err.message || "خطأ غير معروف" };
  }
}

// ═══════════════════════════════════════════════════════════════
// دوال صندوق البريد (WhatsAppInbox)
// ═══════════════════════════════════════════════════════════════


/** جلب المحادثات والرسائل من DB عبر backend */
export async function getWhatsAppMessages(filters = {}) {
  try {
    const params = new URLSearchParams({ action: "get_whatsapp_messages", ...filters });
    const res = await fetch(`${API_URL}?${params}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error("getWhatsAppMessages:", err);
    return { messages: [], conversations: [] };
  }
}

/** إرسال رسالة نصية مباشرة عبر Azeer */
export async function sendWhatsAppMessage(phone, message) {
  if (!API_KEY) return { success: false, error: "API key غير مضبوط" };
  const to = normalizePhone(phone);
  try {
    const res = await fetch(`${BASE_URL}/message/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({ to, type: "text", text: { body: message } }),
    });
    const data = await res.json();
    return res.ok
      ? { success: true, message_id: data.id || data.message_id || "" }
      : { success: false, error: data.message || data.error || `HTTP ${res.status}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/** جلب قوالب Azeer المعتمدة */
export async function getAzeerTemplates() {
  if (!API_KEY) return [];
  try {
    const res = await fetch(`${BASE_URL}/partner/templates`, {
      headers: { Authorization: `Bearer ${API_KEY}`, Accept: "application/json" },
    });
    const data = await res.json();
    return data.data || data || [];
  } catch (err) {
    console.error("getAzeerTemplates:", err);
    return [];
  }
}

/** إرسال رسالة عبر قالب معتمد */
export async function sendWhatsAppTemplate(phone, templateName, vars = []) {
  if (!API_KEY) return { success: false, error: "API key غير مضبوط" };
  const to = normalizePhone(phone);
  const components = vars.length
    ? [{ type: "body", parameters: vars.map(v => ({ type: "text", text: String(v) })) }]
    : [];
  try {
    const res = await fetch(`${BASE_URL}/message/send?create=true`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        to,
        type: "template",
        template: {
          name: templateName,
          language: { code: TEMPLATE_LANG },
          components,
        },
      }),
    });
    const data = await res.json();
    return res.ok
      ? { success: true, message_id: data.id || data.message_id || "" }
      : { success: false, error: data.message || data.error || `HTTP ${res.status}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
