"use client";

// Support — raise a ticket, from the landing page or inside the app.
// One form, two homes: the landing section asks for an email; the in-app page
// uses the signed-in account's email and lists the caller's open tickets.

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, LifeBuoy, Loader2, Send } from "lucide-react";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Badge, Button, Card } from "@/components/ui";

const inputCls =
  "h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg placeholder:text-faint focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20";
const textareaCls =
  "w-full resize-none rounded-xl border border-line bg-surface-2 p-3 text-base leading-relaxed text-fg placeholder:text-faint focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 sm:text-sm";

const TOPICS = [
  { id: "billing", label: "Billing & plans" },
  { id: "generation", label: "Making videos" },
  { id: "account", label: "Account & sign-in" },
  { id: "other", label: "Something else" },
] as const;

interface Ticket {
  id: string;
  topic: string;
  message: string;
  status: "open" | "resolved";
  created_at: string;
}

async function authToken(): Promise<string | null> {
  if (!supabase) return null;
  return (await supabase.auth.getSession()).data.session?.access_token ?? null;
}

/**
 * The ticket form. `knownEmail` (in-app, signed in) hides the email field —
 * the server uses the account's email regardless of what the client sends.
 */
export function SupportForm({
  knownEmail,
  onSubmitted,
}: {
  knownEmail?: string | null;
  onSubmitted?: () => void;
}) {
  const [email, setEmail] = useState("");
  const [topic, setTopic] = useState<(typeof TOPICS)[number]["id"]>("other");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit() {
    if (sending) return;
    setError(null);
    setSending(true);
    try {
      const token = await authToken();
      const res = await fetch("/api/support", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ email: knownEmail ?? email, topic, message }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Could not send your ticket");
      setDone(knownEmail ?? email);
      setMessage("");
      onSubmitted?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send your ticket");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="flex flex-col items-start gap-2 py-2">
        <span className="flex items-center gap-2 text-[14px] font-semibold text-teal">
          <CheckCircle2 size={17} /> Ticket received
        </span>
        <p className="text-[13px] leading-relaxed text-muted">
          We&rsquo;ll get back to you at <span className="font-medium text-fg">{done}</span>.
        </p>
        <Button size="sm" variant="soft" className="mt-1" onClick={() => setDone(null)}>
          Raise another
        </Button>
      </div>
    );
  }

  return (
    <div>
      {!knownEmail && (
        <>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-faint">
            Your email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className={cn(inputCls, "mb-3")}
          />
        </>
      )}

      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-faint">
        What&rsquo;s it about?
      </label>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {TOPICS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTopic(t.id)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
              topic === t.id
                ? "border-accent bg-accent-soft text-fg"
                : "border-line text-muted hover:border-line-2",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-faint">
        How can we help?
      </label>
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={4}
        placeholder="Tell us what happened — the more detail, the faster we can fix it."
        className={textareaCls}
      />
      {/* Honeypot — humans never see or fill this. */}
      <input
        type="text"
        name="company"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />

      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      <Button
        className="mt-3 w-full sm:w-auto"
        onClick={submit}
        disabled={sending || message.trim().length < 10 || (!knownEmail && !email.includes("@"))}
      >
        {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Send ticket
      </Button>
    </div>
  );
}

/** The in-app Support page: the form plus the caller's own tickets. */
export function SupportView() {
  const cloudUser = useStore((s) => s.cloudUser);
  const [email, setEmail] = useState<string | null>(null);
  const [tickets, setTickets] = useState<Ticket[] | null>(null);

  const loadTickets = useCallback(async () => {
    const token = await authToken();
    if (!token) return;
    const res = await fetch("/api/support", { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const data = (await res.json()) as { tickets: Ticket[] };
    setTickets(data.tickets);
  }, []);

  useEffect(() => {
    if (!supabase || !cloudUser) return;
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    void loadTickets();
  }, [cloudUser, loadTickets]);

  return (
    <div className="mx-auto max-w-2xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Support</h1>
        <p className="mt-1 text-sm text-muted">
          Stuck on billing, a render that went wrong, anything — raise a ticket and we&rsquo;ll
          reply to your email.
        </p>
      </header>

      <Card className="p-5">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-2">
          <LifeBuoy size={14} /> New ticket
        </div>
        <SupportForm knownEmail={email} onSubmitted={loadTickets} />
      </Card>

      {tickets && tickets.length > 0 && (
        <>
          <h2 className="mb-2 mt-8 text-[13px] font-semibold uppercase tracking-wider text-faint">
            Your tickets
          </h2>
          <div className="space-y-2">
            {tickets.map((t) => (
              <Card key={t.id} className="p-4">
                <div className="flex items-center gap-2">
                  <Badge tone={t.status === "resolved" ? "neutral" : "accent"}>
                    {t.status === "resolved" ? "Resolved" : "Open"}
                  </Badge>
                  <span className="text-[11.5px] text-faint">
                    {TOPICS.find((x) => x.id === t.topic)?.label ?? t.topic} ·{" "}
                    {new Date(t.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-muted">
                  {t.message}
                </p>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
