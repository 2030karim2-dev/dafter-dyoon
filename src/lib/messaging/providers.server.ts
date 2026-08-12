/**
 * Server-only delivery layer.
 * All providers are reached through the Lovable connector gateway; no key ever
 * touches the browser. Every function returns a uniform result so the queue
 * engine can record success/failure without knowing the provider.
 */

const GATEWAY = "https://connector-gateway.lovable.dev";

export interface SendResult {
  ok: boolean;
  ref?: string;
  error?: string;
  /** true when the channel is simply not configured yet (not a real failure) */
  unavailable?: boolean;
}

function keys() {
  return {
    lovable: process.env["LOVABLE_API_KEY"],
    twilio: process.env["TWILIO_API_KEY"],
    telegram: process.env["TELEGRAM_API_KEY"],
    gatewayapi: process.env["GATEWAYAPI_API_KEY"],
  };
}

/** Which automatic channels are wired up right now. */
export function channelAvailability() {
  const k = keys();
  return {
    whatsapp_auto: Boolean(k.lovable && k.twilio),
    telegram: Boolean(k.lovable && k.telegram),
    sms: Boolean(k.lovable && (k.twilio || k.gatewayapi)),
  };
}

async function twilioSend(
  to: string,
  body: string,
  from: string,
  whatsapp: boolean,
): Promise<SendResult> {
  const k = keys();
  if (!k.lovable || !k.twilio)
    return { ok: false, unavailable: true, error: "قناة Twilio غير مربوطة" };
  const prefix = whatsapp ? "whatsapp:" : "";
  const res = await fetch(`${GATEWAY}/twilio/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${k.lovable}`,
      "X-Connection-Api-Key": k.twilio,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: `${prefix}+${to}`,
      From: `${prefix}${from.startsWith("+") ? from : `+${from}`}`,
      Body: body,
    }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`[twilio] ${res.status}: ${text}`);
    return { ok: false, error: `Twilio ${res.status}: ${text.slice(0, 300)}` };
  }
  try {
    const j = JSON.parse(text) as { sid?: string };
    return { ok: true, ref: j.sid };
  } catch {
    return { ok: true };
  }
}

/** Automatic WhatsApp send (requires a linked Twilio connection + sender number). */
export async function sendWhatsApp(
  to: string,
  body: string,
  from: string | null,
): Promise<SendResult> {
  if (!from) return { ok: false, unavailable: true, error: "لم يتم تحديد رقم واتساب المُرسل" };
  return twilioSend(to, body, from, true);
}

/** SMS send — Twilio first, GatewayAPI as an alternative provider. */
export async function sendSms(to: string, body: string, from: string | null): Promise<SendResult> {
  const k = keys();
  if (k.lovable && k.twilio && from) return twilioSend(to, body, from, false);
  if (k.lovable && k.gatewayapi) {
    const res = await fetch(`${GATEWAY}/gatewayapi/mobile/single`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${k.lovable}`,
        "X-Connection-Api-Key": k.gatewayapi,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sender: from ?? "Daftarak", recipient: Number(to), message: body }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`[gatewayapi] ${res.status}: ${text}`);
      return { ok: false, error: `SMS ${res.status}: ${text.slice(0, 300)}` };
    }
    return { ok: true };
  }
  return { ok: false, unavailable: true, error: "قناة الرسائل النصية غير مُفعّلة" };
}

/** Telegram message to the owner's chat. */
export async function sendTelegram(chatId: string, text: string): Promise<SendResult> {
  const k = keys();
  if (!k.lovable || !k.telegram)
    return { ok: false, unavailable: true, error: "بوت تليجرام غير مربوط" };
  const res = await fetch(`${GATEWAY}/telegram/sendMessage`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${k.lovable}`,
      "X-Connection-Api-Key": k.telegram,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  const raw = await res.text();
  if (!res.ok) {
    console.error(`[telegram] ${res.status}: ${raw}`);
    return { ok: false, error: `Telegram ${res.status}: ${raw.slice(0, 300)}` };
  }
  try {
    const j = JSON.parse(raw) as {
      ok?: boolean;
      description?: string;
      result?: { message_id?: number };
    };
    if (j.ok === false) return { ok: false, error: j.description ?? "Telegram error" };
    return { ok: true, ref: j.result?.message_id ? String(j.result.message_id) : undefined };
  } catch {
    return { ok: true };
  }
}

/** Dispatch by channel name. */
export async function deliver(
  channel: string,
  destination: string,
  body: string,
  opts: { whatsappFrom: string | null; smsFrom: string | null },
): Promise<SendResult> {
  if (channel === "telegram") return sendTelegram(destination, body);
  if (channel === "sms") return sendSms(destination, body, opts.smsFrom);
  if (channel === "whatsapp") return sendWhatsApp(destination, body, opts.whatsappFrom);
  return { ok: false, error: `قناة غير مدعومة: ${channel}` };
}
