import { NextResponse } from "next/server";

// Called by the database trigger on auth.users insert (see the
// signup_notify migration) — every new account, whatever door it came
// through (OTP sign-up, guest checkout), emails the founder.
//
// Auth: a shared secret header set in the trigger and in Vercel env.
// Email: Resend (RESEND_API_KEY). Without a verified domain Resend still
// delivers from onboarding@resend.dev to the Resend account owner's own
// address — exactly this use case. NOTIFY_EMAIL overrides the recipient.

const RECIPIENT = process.env.NOTIFY_EMAIL ?? "abuaisha.hussin@gmail.com";
// The Resend account already sends the auth emails for vibvid.ai, so the
// domain is verified — send from it (NOTIFY_FROM overrides if needed).
const FROM = process.env.NOTIFY_FROM ?? "VIBVID <notifications@vibvid.ai>";

export async function POST(req: Request) {
  const secret = process.env.SIGNUP_NOTIFY_SECRET;
  if (!secret || req.headers.get("x-signup-secret") !== secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { email?: string; created_at?: string };
  const email = (body.email ?? "").slice(0, 320) || "(no email on record)";
  const when = body.created_at ? new Date(body.created_at).toUTCString() : new Date().toUTCString();

  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn(`[notify-signup] RESEND_API_KEY not set — new account not emailed: ${email}`);
    return NextResponse.json({ ok: true, sent: false });
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM,
      to: [RECIPIENT],
      subject: `New VIBVID account: ${email}`,
      text: `Someone just created a VIBVID account.\n\nEmail: ${email}\nWhen: ${when}\n\n— vibvid.ai`,
    }),
  });
  if (!res.ok) {
    console.warn("[notify-signup] Resend rejected:", res.status, (await res.text()).slice(0, 300));
    return NextResponse.json({ ok: true, sent: false });
  }
  return NextResponse.json({ ok: true, sent: true });
}
