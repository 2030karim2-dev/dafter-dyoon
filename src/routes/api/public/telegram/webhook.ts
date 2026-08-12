/**
 * Telegram bot webhook — links the owner's chat to their Daftarak account.
 * The owner sends "/start DFT-XXXXXX" to the bot; we store the chat id.
 * Security: Telegram's X-Telegram-Bot-Api-Secret-Token, derived from the
 * connection key (same derivation used when registering the webhook).
 */
import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";

function deriveSecret(apiKey: string): string {
  return createHash("sha256").update(`telegram-webhook:${apiKey}`).digest("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const l = Buffer.from(a);
  const r = Buffer.from(b);
  return l.length === r.length && timingSafeEqual(l, r);
}

export const Route = createFileRoute("/api/public/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["TELEGRAM_API_KEY"];
        if (!apiKey) return new Response("Not configured", { status: 503 });

        const provided = request.headers.get("X-Telegram-Bot-Api-Secret-Token") ?? "";
        if (!safeEqual(provided, deriveSecret(apiKey))) {
          return new Response("Unauthorized", { status: 401 });
        }

        const update = (await request.json()) as {
          message?: { chat?: { id?: number }; text?: string };
        };
        const chatId = update.message?.chat?.id;
        const text = (update.message?.text ?? "").trim();
        if (!chatId || !text) return Response.json({ ok: true, ignored: true });

        const code = text
          .replace(/^\/start\s*/i, "")
          .trim()
          .toUpperCase();
        if (!/^DFT-[A-Z0-9]{4,10}$/.test(code)) {
          return Response.json({ ok: true, ignored: true });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: row } = await supabaseAdmin
          .from("channel_settings")
          .select("user_id")
          .eq("telegram_link_code", code)
          .maybeSingle();
        if (!row) return Response.json({ ok: true, matched: false });

        await supabaseAdmin
          .from("channel_settings")
          .update({
            telegram_chat_id: String(chatId),
            telegram_link_code: null,
            telegram_enabled: true,
          })
          .eq("user_id", row.user_id);

        return Response.json({ ok: true, matched: true });
      },
    },
  },
});
