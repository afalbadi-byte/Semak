import { API_URL } from '../utils/helpers';

const API_KEY        = import.meta.env.VITE_MOTTASL_API_KEY;
const ADMIN_PHONE    = import.meta.env.VITE_WA_ADMIN_PHONE;
const TEMPLATE_ID    = import.meta.env.VITE_WA_CLIENT_TEMPLATE_ID;
const TEMPLATE_LANG  = import.meta.env.VITE_WA_CLIENT_TEMPLATE_LANG || "ar";

// قوالب الصيانة — تنتظر موافقة WhatsApp
const T_MAINT_RECEIVED = "semak_maint_received";  // [name, ticket_id, type]
const T_MAINT_UPDATE   = "semak_maint_update";    // [name, ticket_id, status]
const T_TECH_ASSIGNED  = "semak_tech_assigned";   // [name, ticket_id, tech_name]

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

async function sendTemplate(to, templateName, lang, bodyVars = []) {
  if (!API_KEY || !templateName) return;
  return fetch(`${BASE_URL}/message/send?create=true`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      to,
      type: "template",
      template: {
        template_id: templateName,
        language: lang,
        ...(bodyVars.length > 0 && { argument: { BODY: bodyVars.map(String) } }),
      },
    }),
  });
}

// ─── صفحة التواصل ───────────────────────────────────────────

// إشعار الإدارة بعميل جديد
// يعمل فقط إذا راسل المدير الحساب التجاري خلال آخر 24 ساعة (نافذة WhatsApp)
// الحل الدائم: إنشاء قالب إداري معتمد وضع معرفه في VITE_WA_ADMIN_TEMPLATE_ID
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

// رد ترحيبي للعميل — قالب معتمد فقط (النص لا يعمل خارج نافذة 24 ساعة)
export async function replyToClient(clientPhone, clientName) {
  if (!API_KEY || !clientPhone || !TEMPLATE_ID) {
    console.error("[WA] replyToClient: مفقود API_KEY أو TEMPLATE_ID", { API_KEY: !!API_KEY, TEMPLATE_ID });
    return { ok: false };
  }
  const to = normalizePhone(clientPhone);
  console.log("[WA] replyToClient → template:", TEMPLATE_ID, "to:", to, "name:", clientName);
  const res = await sendTemplate(to, TEMPLATE_ID, TEMPLATE_LANG, [clientName]);
  const data = res ? await res.clone().json().catch(() => ({})) : {};
  console.log("[WA] replyToClient result:", res?.status, data);
  if (res?.ok) return { ok: true };
  return { ok: false, error: data };
}

// ─── صفحة الصيانة ───────────────────────────────────────────

// تأكيد استلام الطلب للعميل فور إرسال طلبه
export async function notifyClientTicketReceived({ id, name, unit, type, date, time, phone }) {
  if (!API_KEY || !phone) return { ok: false };

  const res = await sendTemplate(normalizePhone(phone), T_MAINT_RECEIVED, TEMPLATE_LANG, [
    name,       // {{1}} اسم العميل
    String(id), // {{2}} رقم الطلب
    type,       // {{3}} نوع الطلب
  ]);
  if (res?.ok) { logWaSent(id, "maintenance"); return { ok: true }; }

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

// إشعار العميل عند تعيين فني لطلبه
export async function notifyClientTechAssigned(ticket) {
  if (!API_KEY || !ticket.phone) return { ok: false };
  const tech = ticket.technician && ticket.technician !== "لم يتم التعيين"
    ? ticket.technician : "سيتم التحديد";

  const res = await sendTemplate(normalizePhone(ticket.phone), T_TECH_ASSIGNED, TEMPLATE_LANG, [
    ticket.name || "العميل الكريم", // {{1}} اسم العميل
    String(ticket.id),              // {{2}} رقم الطلب
    tech,                           // {{3}} اسم الفني
  ]);
  if (res?.ok) { logWaSent(ticket.id, "maintenance"); return { ok: true }; }

  // fallback: نص
  const body =
    `🔧 *تحديث طلب الصيانة - سماك العقارية*\n\n` +
    `مرحباً، تم تعيين الفني *${tech}* لطلبك رقم #${ticket.id}.\n` +
    `سيصل إليك قريباً. للاستفسار ردّ على هذه الرسالة 💬`;
  const res2 = await sendText(normalizePhone(ticket.phone), body);
  if (res2?.ok) { logWaSent(ticket.id, "maintenance"); return { ok: true }; }
  return { ok: false };
}

// إشعار العميل تلقائياً عند كل تغيير في حالة طلبه
export async function notifyClientStatusUpdate(ticket) {
  if (!API_KEY)        return { ok: false, error: "API key غير مضبوط" };
  if (!ticket.phone)   return { ok: false, error: "رقم جوال العميل غير موجود" };

  try {
    const res = await sendTemplate(
      normalizePhone(ticket.phone),
      T_MAINT_UPDATE,
      TEMPLATE_LANG,
      [
        ticket.name || "العميل الكريم", // {{1}} اسم العميل
        String(ticket.id),              // {{2}} رقم الطلب
        ticket.status,                  // {{3}} الحالة الجديدة
      ]
    );
    if (res?.ok) { logWaSent(ticket.id, "maintenance"); return { ok: true }; }

    // fallback: نص
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
          template_id: templateName,
          language: TEMPLATE_LANG,
          ...(vars.length > 0 && { argument: { BODY: vars.map(String) } }),
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
