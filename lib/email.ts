/**
 * lib/email.ts — transactional email (#41).
 *
 * DESIGN: This helper is SERVER-ONLY. It must only ever be imported from API
 * routes or server components, never from browser code, because it reads the
 * secret RESEND_API_KEY from the environment.
 *
 * DORMANT-BY-DEFAULT: Until a RESEND_API_KEY is added to the environment
 * (Vercel → Project → Settings → Environment Variables), every send is a
 * safe no-op. It logs a note and returns { sent: false, skipped: true } so
 * callers never crash and features keep working without email configured.
 *
 * TO TURN ON EMAIL LATER:
 *   1. Create a free account at https://resend.com and make an API key.
 *   2. Add env var RESEND_API_KEY on Vercel (Production + Preview).
 *   3. (Optional) Add EMAIL_FROM once you've verified your own domain in
 *      Resend, e.g. "SoundStage Live <invites@yourdomain.com>". Until then it
 *      falls back to Resend's ready-to-use test sender "onboarding@resend.dev".
 * No code change needed — it flips on automatically when the key is present.
 */

export type SendEmailInput = {
  to: string;
  subject: string;
  /** Plain-text body. Used as-is, and auto-wrapped into simple HTML if no html given. */
  text: string;
  /** Optional pre-built HTML body. */
  html?: string;
};

export type SendEmailResult =
  | { sent: true; id: string | null }
  | { sent: false; skipped: true; reason: string }
  | { sent: false; skipped: false; error: string };

const DEFAULT_FROM = "SoundStage Live <onboarding@resend.dev>";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Wrap a plain-text message in a minimal, safe HTML shell. */
function textToHtml(text: string): string {
  const safe = escapeHtml(text).replace(/\n/g, "<br/>");
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;">${safe}</div>`;
}

/**
 * Send one transactional email. Never throws — returns a result object so the
 * caller can decide what to do (usually: ignore failures, since email is a
 * best-effort side channel, not the core action).
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;

  // DORMANT PATH: no key configured yet → safe no-op.
  if (!apiKey) {
    console.log(
      `[email] RESEND_API_KEY not set — skipping email to ${input.to} ("${input.subject}"). Add the key on Vercel to enable sending.`
    );
    return { sent: false, skipped: true, reason: "RESEND_API_KEY not set" };
  }

  const from = process.env.EMAIL_FROM || DEFAULT_FROM;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        text: input.text,
        html: input.html || textToHtml(input.text),
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[email] Resend responded ${res.status}: ${detail}`);
      return { sent: false, skipped: false, error: `Resend ${res.status}` };
    }

    const data = (await res.json().catch(() => null)) as { id?: string } | null;
    return { sent: true, id: data?.id ?? null };
  } catch (err) {
    console.error("[email] send failed:", err);
    return {
      sent: false,
      skipped: false,
      error: err instanceof Error ? err.message : "unknown error",
    };
  }
}

/* ---------- Email templates (#41) ---------- */

/** The invite email a guest receives (#20 close-the-loop). */
export function guestInviteEmail(args: {
  guestName: string;
  hostName: string;
  showOrEpisode?: string | null;
  message?: string | null;
  acceptUrl: string;
}): { subject: string; text: string; html: string } {
  const { guestName, hostName, showOrEpisode, message, acceptUrl } = args;
  const context = showOrEpisode ? ` for "${showOrEpisode}"` : "";
  const subject = `${hostName} invited you to be a guest${context}`;

  const lines = [
    `Hi ${guestName},`,
    ``,
    `${hostName} would like to have you as a guest${context} on their podcast.`,
    message ? `\nTheir note: "${message}"\n` : ``,
    `You can accept or decline here:`,
    acceptUrl,
    ``,
    `— Sent via SoundStage Live`,
  ].filter((l) => l !== ``).join("\n");

  const html = `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#0f172a;">
    <h2 style="font-size:20px;">You've been invited as a guest</h2>
    <p>Hi ${escapeHtml(guestName)},</p>
    <p><strong>${escapeHtml(hostName)}</strong> would like to have you as a guest${
      showOrEpisode ? ` for <strong>${escapeHtml(showOrEpisode)}</strong>` : ""
    } on their podcast.</p>
    ${message ? `<p style="padding:12px 16px;background:#f1f5f9;border-radius:8px;">${escapeHtml(message)}</p>` : ""}
    <p style="margin:24px 0;">
      <a href="${escapeHtml(acceptUrl)}" style="background:#0f172a;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Respond to invite</a>
    </p>
    <p style="font-size:13px;color:#64748b;">Or paste this link into your browser:<br/>${escapeHtml(acceptUrl)}</p>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
    <p style="font-size:12px;color:#94a3b8;">Sent via SoundStage Live</p>
  </div>`;

  return { subject, text: lines, html };
}
