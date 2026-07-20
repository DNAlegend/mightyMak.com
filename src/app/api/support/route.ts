import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { allowRequest, RATE_LIMIT_MESSAGE } from "@/lib/rate-limit";

// Support tickets. POST works signed-in (bearer token → the account's email)
// AND signed-out (landing page — email typed in), because the people who most
// need help are often the ones who can't get past sign-in or checkout.
// GET returns the caller's own tickets (signed-in only).

const TOPICS = new Set(["billing", "generation", "account", "other"]);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function callerFromRequest(req: Request) {
  if (!supabaseAdmin) return null;
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email?.toLowerCase() ?? null, token };
}

export async function POST(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Support isn't configured on this deployment" }, { status: 503 });
  }
  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    topic?: string;
    message?: string;
    company?: string;
  };

  // Honeypot — a hidden field humans never fill. Bots get a quiet "ok".
  if (body.company) return NextResponse.json({ ok: true });

  const message = (body.message ?? "").trim();
  if (message.length < 10) {
    return NextResponse.json({ error: "Tell us a little more — at least 10 characters" }, { status: 400 });
  }
  if (message.length > 4000) {
    return NextResponse.json({ error: "Please keep it under 4,000 characters" }, { status: 400 });
  }
  const topic = TOPICS.has(body.topic ?? "") ? body.topic! : "other";

  const caller = await callerFromRequest(req);
  const email = caller?.email ?? (body.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 320) {
    return NextResponse.json({ error: "Enter the email we should reply to" }, { status: 400 });
  }

  // Signed-in callers get the shared per-user hourly limiter.
  if (caller) {
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (anonKey && url) {
      const sb = createClient(url, anonKey, {
        global: { headers: { Authorization: `Bearer ${caller.token}` } },
        auth: { persistSession: false },
      });
      if (!(await allowRequest(sb, "support", 10))) {
        return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
      }
    }
  }

  const { data, error } = await supabaseAdmin
    .from("support_tickets")
    .insert({ user_id: caller?.id ?? null, email, topic, message })
    .select("id")
    .single();
  if (error) {
    console.error("[support] insert failed:", error.message);
    return NextResponse.json({ error: "Could not save your ticket — please try again" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id });
}

export async function GET(req: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Support isn't configured on this deployment" }, { status: 503 });
  }
  const caller = await callerFromRequest(req);
  if (!caller) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { data, error } = await supabaseAdmin
    .from("support_tickets")
    .select("id, topic, message, status, created_at")
    .eq("user_id", caller.id)
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) {
    return NextResponse.json({ error: "Could not load your tickets" }, { status: 500 });
  }
  return NextResponse.json({ tickets: data ?? [] });
}
