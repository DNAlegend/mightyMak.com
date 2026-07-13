"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clapperboard, Film, FolderOpen, Lightbulb, LogOut, Loader2, Mail, Plus, Coins, Scissors, UserCircle, UserRound, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { supabase, cloudConfigured } from "@/lib/supabase";
import { TOPUPS, PLAN_ITEMS, billingItem, type BillingItem } from "@/lib/billing";
import { cn } from "@/lib/utils";
import { Button, Modal, Badge, TextInput } from "@/components/ui";
import { AuthModal } from "@/components/auth/auth-modal";
import { LogoWordmark } from "@/components/logo";

const NAV = [
  { href: "/app/plan", label: "Plan", icon: Lightbulb },
  { href: "/app", label: "Make", icon: Clapperboard },
  { href: "/app/post", label: "Post", icon: Scissors },
  { href: "/app/characters", label: "Characters", icon: UserRound },
  { href: "/app/assets", label: "Assets", icon: FolderOpen },
  { href: "/app/library", label: "My Videos", icon: Film },
];

function Brand() {
  return (
    <Link href="/app" className="flex items-center">
      <LogoWordmark />
    </Link>
  );
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active
                ? "bg-accent-soft text-fg"
                : "text-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            <Icon size={18} className={active ? "text-accent-2" : ""} />
            {label}
          </Link>
        );
      })}
    </>
  );
}

function CreditWidget({ onBuy }: { onBuy: () => void }) {
  const credits = useStore((s) => s.credits);
  const hydrated = useStore((s) => s.hasHydrated);
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-xl border border-line bg-surface-2 px-3 py-1.5">
        <Coins size={15} className="text-warn" />
        <span className="text-sm font-semibold tabular-nums">
          {hydrated ? credits.toLocaleString() : "—"}
        </span>
        <span className="text-xs text-faint">credits</span>
      </div>
      <Button size="sm" variant="soft" onClick={onBuy} className="gap-1.5">
        <Plus size={15} /> Buy
      </Button>
    </div>
  );
}

/** localStorage key remembering a guest buyer's email across the MamoPay redirect. */
const CHECKOUT_EMAIL_KEY = "mm-checkout-email";

/**
 * Ask the server for a MamoPay payment URL. Pass a `token` for a signed-in
 * buyer, or an `email` for a guest (their account is created server-side).
 * Returns null when payments aren't configured on the server (501).
 */
async function requestCheckout(
  item: BillingItem,
  auth: { token?: string; email?: string },
): Promise<string | null> {
  const res = await fetch("/api/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(auth.token ? { Authorization: `Bearer ${auth.token}` } : {}),
    },
    body: JSON.stringify({
      itemId: item.id,
      origin: window.location.origin,
      ...(auth.token ? {} : { email: auth.email }),
    }),
  });
  if (res.status === 501) return null;
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error ?? "Checkout failed");
  }
  return (await res.json()).url ?? null;
}

/**
 * MamoPay's inline checkout, embedded on our page. The hosted payment page
 * runs in an iframe and talks to us via postMessage (same protocol as Mamo's
 * official checkout-inline script): "checkout-complete" on success,
 * "closeIframe" when the payer backs out, and a `confirmation_required`
 * payload when 3-D Secure needs a full-page redirect (that flow returns via
 * the normal ?purchase=success handler).
 */
function MamoInlineCheckout({
  url,
  onComplete,
  onDismiss,
}: {
  url: string;
  onComplete: () => void;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const origin = new URL(url).origin;
    function onMessage(e: MessageEvent) {
      if (e.origin !== origin) return;
      const data = e.data as { message?: string; type?: string; payload?: string } | string;
      const msg = typeof data === "string" ? data : data?.message;
      if (msg === "checkout-complete") onComplete();
      else if (msg === "closeIframe") onDismiss();
      else if (typeof data === "object" && data?.type === "confirmation_required" && data.payload) {
        window.location.replace(data.payload); // 3-D Secure hop
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  return (
    <iframe
      src={`${url}${url.includes("?") ? "&" : "?"}consumer=${encodeURIComponent(window.location.href)}`}
      allow="payment"
      title="Secure MamoPay checkout"
      className="h-[600px] w-full rounded-2xl bg-transparent"
    />
  );
}

function BuyCreditsModal({
  open,
  onClose,
  autostart,
  onPaid,
}: {
  open: boolean;
  onClose: () => void;
  /** When set, checkout for this item starts as soon as the modal opens. */
  autostart?: BillingItem | null;
  /** Called after an embedded payment completes on-page. */
  onPaid: () => void;
}) {
  const addCredits = useStore((s) => s.addCredits);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [payUrl, setPayUrl] = useState<string | null>(null);
  const autostarted = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setPayUrl(null);
    setSelected(autostart?.id ?? null);
  }, [open, autostart]);

  // Start a real MamoPay checkout — embedded right here in the modal. Only
  // signed-in users reach this modal (the paywall gate handles guests);
  // without cloud keys, fall back to demo credits.
  async function buy(item: BillingItem) {
    if (busy) return;
    setSelected(item.id);
    setBusy(item.id);
    setError(null);
    try {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (cloudConfigured && !token) {
        setError("Your session expired — sign in again to continue.");
        return;
      }
      if (token) {
        const url = await requestCheckout(item, { token });
        if (url) {
          setPayUrl(url); // pay on this page, in the modal
          return;
        }
        // null → payments not configured yet; fall through to demo.
      }
      // Demo fallback: instant credits, no charge.
      addCredits(item.credits);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(null);
    }
  }

  // A plan picked on the landing page (?buy=) starts checkout on open — the
  // user already chose it there, so don't make them click it a second time.
  useEffect(() => {
    if (!open || !autostart || autostarted.current === autostart.id) return;
    autostarted.current = autostart.id;
    void buy(autostart);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, autostart]);

  if (payUrl) {
    return (
      <Modal open={open} onClose={onClose} title="Complete your payment" size="lg">
        <MamoInlineCheckout
          url={payUrl}
          onComplete={() => {
            setPayUrl(null);
            onClose();
            onPaid();
          }}
          onDismiss={() => setPayUrl(null)}
        />
        <div className="mt-3 flex items-center justify-between">
          <button
            className="text-[13px] font-medium text-muted hover:text-fg"
            onClick={() => setPayUrl(null)}
          >
            ← Back to packs &amp; plans
          </button>
          <span className="text-[12px] text-faint">Secure checkout by MamoPay · USD</span>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title="Get more credits" size="lg">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-faint">Top up — one-time</div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {TOPUPS.map((p) => (
          <button
            key={p.id}
            disabled={!!busy}
            onClick={() => buy(p)}
            className={cn(
              "relative rounded-2xl border bg-surface-2 p-4 text-left transition-colors hover:border-accent/50 disabled:opacity-60",
              selected === p.id
                ? "border-accent ring-1 ring-accent/40"
                : p.popular
                  ? "border-accent/40"
                  : "border-line",
            )}
          >
            {p.popular && (
              <span className="absolute right-3 top-3">
                <Badge tone="accent">Popular</Badge>
              </span>
            )}
            <div className="text-sm font-medium text-muted">{p.label}</div>
            <div className="mt-1 text-2xl font-bold tabular-nums">{p.credits.toLocaleString()}</div>
            <div className="text-xs text-faint">credits · {p.sublabel}</div>
            <div className="mt-3 flex items-center gap-1.5 text-lg font-semibold text-accent-2">
              {busy === p.id ? <Loader2 size={16} className="animate-spin" /> : p.priceLabel}
            </div>
          </button>
        ))}
      </div>

      <div className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-faint">
        Or subscribe — monthly
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {PLAN_ITEMS.map((p) => (
          <button
            key={p.id}
            disabled={!!busy}
            onClick={() => buy(p)}
            className={cn(
              "relative flex items-center justify-between rounded-2xl border bg-surface-2 p-4 text-left transition-colors hover:border-accent/50 disabled:opacity-60",
              selected === p.id
                ? "border-accent ring-1 ring-accent/40"
                : p.popular
                  ? "border-accent/40"
                  : "border-line",
            )}
          >
            <div>
              <div className="text-sm font-semibold text-fg">{p.label}</div>
              <div className="text-xs text-faint">{p.credits.toLocaleString()} credits / mo · {p.sublabel}</div>
            </div>
            <div className="flex items-center gap-1.5 text-lg font-semibold text-accent-2">
              {busy === p.id ? <Loader2 size={16} className="animate-spin" /> : <>{p.priceLabel}<span className="text-xs font-normal text-faint">/mo</span></>}
            </div>
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <p className="mt-4 text-xs text-faint">
        Secure checkout by MamoPay. Credits are added the moment your payment clears.
      </p>
    </Modal>
  );
}

/**
 * Full-screen gate shown to visitors who aren't signed in: pick a paid plan
 * (email → payment → confirm) or create a free account. Nothing behind it is
 * usable until they've done one of the two.
 */
function PaywallGate({
  preselect,
  confirmEmail,
  onSignInInstead,
  onStartOver,
}: {
  /** Plan carried over from the landing page (?buy=…). */
  preselect: BillingItem | null;
  /** Guest just paid — show the "confirm your email" step instead of plans. */
  confirmEmail: string | null;
  onSignInInstead: (resume: BillingItem | null) => void;
  onStartOver: () => void;
}) {
  const setAuthOpen = useStore((s) => s.setAuthOpen);
  const [email, setEmail] = useState("");
  const [selectedId, setSelectedId] = useState(
    preselect?.id ?? PLAN_ITEMS.find((p) => p.popular)?.id ?? PLAN_ITEMS[0].id,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);
  const [payUrl, setPayUrl] = useState<string | null>(null);
  // Set when an embedded payment completes on-page (no redirect happened).
  const [paidEmail, setPaidEmail] = useState<string | null>(null);

  useEffect(() => {
    if (preselect) setSelectedId(preselect.id);
  }, [preselect]);

  // Paid only — there is no free tier.
  const paid = PLAN_ITEMS.find((p) => p.id === selectedId) ?? PLAN_ITEMS[0];
  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim());
  // Confirm step: reached via full-page return (?purchase=success) or on-page.
  const confirmingEmail = confirmEmail ?? paidEmail;

  async function go() {
    if (busy) return;
    setError(null);
    if (!emailValid) {
      setError("Enter your email — you’ll go straight to payment.");
      return;
    }
    setBusy(true);
    try {
      const url = await requestCheckout(paid, { email: email.trim() });
      if (!url) {
        setError("Payments aren’t configured on this server yet — try again later.");
        return;
      }
      // Remember who's paying in case 3-D Secure forces a full-page round trip.
      localStorage.setItem(CHECKOUT_EMAIL_KEY, email.trim().toLowerCase());
      setPayUrl(url); // pay right here on the page
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  // Embedded payment finished without leaving the page — email the sign-in
  // link ourselves (the redirect handler would have done this otherwise).
  function handlePaid() {
    const e = email.trim().toLowerCase();
    localStorage.removeItem(CHECKOUT_EMAIL_KEY);
    void supabase?.auth.signInWithOtp({
      email: e,
      options: { emailRedirectTo: `${window.location.origin}/app` },
    });
    setPayUrl(null);
    setPaidEmail(e);
  }

  async function resend() {
    if (!supabase || !confirmingEmail) return;
    await supabase.auth.signInWithOtp({
      email: confirmingEmail,
      options: { emailRedirectTo: `${window.location.origin}/app` },
    });
    setResent(true);
  }

  if (confirmingEmail) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-md text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-2">
            <Mail size={26} />
          </span>
          <h1 className="font-display mt-5 text-2xl font-bold tracking-tight">Confirm your email</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-muted">
            Payment received — your credits are already in your account. We sent a sign-in
            link to <span className="font-semibold text-fg">{confirmingEmail}</span>. Click it to
            activate your account and open the studio.
          </p>
          <div className="mt-6 flex flex-col items-center gap-3">
            <Button variant="outline" onClick={resend} disabled={resent}>
              <Mail size={15} /> {resent ? "Link sent again — check your inbox" : "Resend the link"}
            </Button>
            <button
              className="text-[13px] font-medium text-accent-2 hover:underline"
              onClick={() => {
                setPaidEmail(null);
                onStartOver();
              }}
            >
              Wrong email? Start over
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (payUrl && paid) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="w-full max-w-lg">
          <div className="mb-5 text-center">
            <h1 className="font-display text-2xl font-bold tracking-tight">Complete your payment</h1>
            <p className="mt-1.5 text-[14px] text-muted">
              MightyMak {paid.label} — {paid.priceLabel}/mo · {paid.credits.toLocaleString()} credits
              every month, for <span className="font-medium text-fg">{email.trim()}</span>.
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_16px_40px_-24px_rgba(16,18,27,0.3)]">
            <MamoInlineCheckout url={payUrl} onComplete={handlePaid} onDismiss={() => setPayUrl(null)} />
          </div>
          <div className="mt-3 flex items-center justify-between">
            <button
              className="text-[13px] font-medium text-muted hover:text-fg"
              onClick={() => setPayUrl(null)}
            >
              ← Back to plans
            </button>
            <span className="text-[12px] text-faint">Secure checkout by MamoPay · USD</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="text-center">
          <LogoWordmark className="text-2xl" />
          <h1 className="font-display mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Pick your plan</h1>
          <p className="mx-auto mt-2 max-w-sm text-[14.5px] text-muted">
            You go straight to payment — your account is created on the way and confirmed
            right after. Cancel anytime.
          </p>
        </div>

        <div className="mt-7 space-y-3">
          {PLAN_ITEMS.map((p) => {
            const active = selectedId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedId(p.id)}
                className={cn(
                  "flex w-full items-center justify-between rounded-2xl border bg-surface p-4 text-left transition-colors",
                  active ? "border-accent ring-1 ring-accent/40" : "border-line hover:border-faint",
                )}
              >
                <span className="flex items-center gap-3">
                  <span
                    className={cn(
                      "flex h-4 w-4 items-center justify-center rounded-full border",
                      active ? "border-accent" : "border-line-2",
                    )}
                  >
                    {active && <span className="h-2 w-2 rounded-full bg-accent" />}
                  </span>
                  <span>
                    <span className="flex items-center gap-2 text-[15px] font-semibold text-fg">
                      {p.label}
                      {"popular" in p && p.popular && <Badge tone="accent">Most popular</Badge>}
                    </span>
                    <span className="block text-[12.5px] text-faint">
                      {p.credits.toLocaleString()} credits / mo · {p.sublabel}
                    </span>
                  </span>
                </span>
                <span className="text-lg font-bold text-fg">
                  {p.priceLabel}
                  <span className="text-xs font-normal text-faint">/mo</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4">
          <TextInput
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && go()}
          />
        </div>

        <Button className="mt-4 w-full" size="lg" onClick={go} disabled={busy}>
          {busy ? (
            <Loader2 size={17} className="animate-spin" />
          ) : (
            <>Continue to payment — {paid.priceLabel}/mo</>
          )}
        </Button>
        {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}

        <p className="mt-4 text-center text-[13px] text-muted">
          Already have an account?{" "}
          <button
            className="font-medium text-accent-2 hover:underline"
            onClick={() => onSignInInstead(preselect ? paid : null)}
          >
            Sign in
          </button>
        </p>
        <p className="mt-5 text-center text-[12px] text-faint">
          Secure checkout by MamoPay · charged in US dollars · cancel anytime.
        </p>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [buyOpen, setBuyOpen] = useState(false);
  const authOpen = useStore((s) => s.authOpen);
  const setAuthOpen = useStore((s) => s.setAuthOpen);
  const [email, setEmail] = useState<string | null>(null);
  const hydrateFromCloud = useStore((s) => s.hydrateFromCloud);
  const signOutToLocal = useStore((s) => s.signOutToLocal);
  const lastUser = useRef<string | null>(null);
  const [purchaseNote, setPurchaseNote] = useState<string | null>(null);
  const [autoBuy, setAutoBuy] = useState<BillingItem | null>(null);
  const pendingBuy = useRef<BillingItem | null>(null);
  // True once Supabase has reported the initial session (gate vs app decision).
  const [authReady, setAuthReady] = useState(false);
  // Guest who just paid — the gate shows the "confirm your email" step.
  const [guestConfirmEmail, setGuestConfirmEmail] = useState<string | null>(null);

  // ?buy=<itemId> — a plan chosen on the landing page. Signed in: open the
  // credits modal and start checkout immediately. Signed out: preselect it on
  // the paywall gate (email → payment → confirmation).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const item = billingItem(params.get("buy") ?? "");
    if (!item) return;
    params.delete("buy");
    const qs = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    if (!supabase) {
      setBuyOpen(true); // demo mode — just show the options
      return;
    }
    void supabase.auth.getSession().then(({ data }) => {
      setAutoBuy(item);
      if (data.session) setBuyOpen(true);
      // signed out → the gate picks up `autoBuy` as its preselected plan
    });
  }, []);

  // Returning from MamoPay checkout. Signed in: the webhook adds credits
  // async, so poll the cloud a few times for them to land. Guest checkout:
  // their account already exists (created at checkout) and holds the credits —
  // email them a confirmation link that signs them in and confirms the account.
  useEffect(() => {
    if (typeof window === "undefined" || !supabase) return;
    const status = new URLSearchParams(window.location.search).get("purchase");
    if (!status) return;
    window.history.replaceState({}, "", window.location.pathname);
    if (status === "failed") {
      localStorage.removeItem(CHECKOUT_EMAIL_KEY);
      setPurchaseNote("Payment didn’t go through — no charge was made.");
      const t = setTimeout(() => setPurchaseNote(null), 6000);
      return () => clearTimeout(t);
    }
    let poll: ReturnType<typeof setInterval> | null = null;
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        localStorage.removeItem(CHECKOUT_EMAIL_KEY);
        setPurchaseNote("Payment received — adding your credits…");
        let n = 0;
        poll = setInterval(async () => {
          const uid = (await supabase!.auth.getSession()).data.session?.user?.id;
          if (uid) void hydrateFromCloud(uid);
          if (++n >= 5) {
            if (poll) clearInterval(poll);
            setPurchaseNote("Credits added — you’re all set.");
            setTimeout(() => setPurchaseNote(null), 4000);
          }
        }, 3000);
        return;
      }
      const guestEmail = localStorage.getItem(CHECKOUT_EMAIL_KEY);
      if (guestEmail) {
        localStorage.removeItem(CHECKOUT_EMAIL_KEY);
        void supabase!.auth.signInWithOtp({
          email: guestEmail,
          options: { emailRedirectTo: `${window.location.origin}/app` },
        });
        setGuestConfirmEmail(guestEmail); // gate shows the confirm-email step
      } else {
        setPurchaseNote("Payment received — sign in to see your credits.");
        setTimeout(() => setPurchaseNote(null), 15000);
      }
    });
    return () => {
      if (poll) clearInterval(poll);
    };
  }, [hydrateFromCloud]);

  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setAuthReady(true);
      if (session?.user) {
        setEmail(session.user.email ?? "Account");
        // Covers sign-ins completed outside the modal too (e.g. the email
        // confirmation link landing back on /app).
        setAuthOpen(false);
        if (lastUser.current !== session.user.id) {
          lastUser.current = session.user.id;
          void hydrateFromCloud(session.user.id);
        }
        // They picked a plan while signed out — resume checkout now.
        if (pendingBuy.current) {
          setAutoBuy(pendingBuy.current);
          pendingBuy.current = null;
          setBuyOpen(true);
        }
      } else {
        setEmail(null);
        if (event === "SIGNED_OUT") {
          lastUser.current = null;
          signOutToLocal();
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [hydrateFromCloud, signOutToLocal, setAuthOpen]);

  // An embedded (on-page) payment just completed — the webhook grants credits
  // async, so poll the cloud for them to land, mirroring the redirect flow.
  function celebratePurchase() {
    setPurchaseNote("Payment received — adding your credits…");
    let n = 0;
    const poll = setInterval(async () => {
      const uid = (await supabase!.auth.getSession()).data.session?.user?.id;
      if (uid) void hydrateFromCloud(uid);
      if (++n >= 5) {
        clearInterval(poll);
        setPurchaseNote("Credits added — you’re all set.");
        setTimeout(() => setPurchaseNote(null), 4000);
      }
    }, 3000);
  }

  // Payment-first: when the cloud is live, nobody uses the studio anonymously.
  // Wait for the initial session check, then gate signed-out visitors.
  if (cloudConfigured && !authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <LogoWordmark className="animate-pulse text-2xl" />
      </div>
    );
  }
  if (cloudConfigured && !email) {
    return (
      <div className="min-h-screen">
        <PaywallGate
          preselect={autoBuy}
          confirmEmail={guestConfirmEmail}
          onStartOver={() => setGuestConfirmEmail(null)}
          onSignInInstead={(resume) => {
            pendingBuy.current = resume;
            setAuthOpen(true);
          }}
        />
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
        {purchaseNote && (
          <div className="animate-rise fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium text-fg shadow-[0_16px_40px_-16px_rgba(16,18,27,0.4)]">
            <span className="flex items-center gap-2">
              <Coins size={15} className="text-teal" /> {purchaseNote}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface/60 px-4 py-5 backdrop-blur-md md:flex">
        <div className="px-1">
          <Brand />
        </div>
        <nav className="mt-8 flex flex-col gap-1">
          <NavLinks />
        </nav>
        <div className="mt-auto">
          <div className="rounded-xl border border-line bg-surface-2 p-3 text-xs text-muted">
            <div className="mb-1 flex items-center gap-1.5 font-medium text-fg">
              <Sparkles size={13} className="text-teal" /> {email ? "Cloud sync on" : "Demo mode"}
            </div>
            {email
              ? "Your library, credits and generations are saved to your account."
              : "Data is saved in this browser. Sign in to sync it to your account."}
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="md:pl-64">
        {/* Topbar */}
        <header className="sticky top-0 z-20 border-b border-line bg-bg/80 backdrop-blur-md">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="md:hidden">
              <Brand />
            </div>
            <div className="hidden text-sm text-faint md:block" />
            <div className="flex items-center gap-2">
              <CreditWidget onBuy={() => setBuyOpen(true)} />
              {cloudConfigured &&
                (email ? (
                  <div className="flex items-center gap-1.5">
                    <span className="hidden max-w-[150px] truncate text-xs text-muted lg:block">{email}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => supabase?.auth.signOut()}
                      title="Sign out"
                      className="gap-1.5"
                    >
                      <LogOut size={15} />
                    </Button>
                  </div>
                ) : (
                  <Button size="sm" variant="outline" onClick={() => setAuthOpen(true)} className="gap-1.5">
                    <UserCircle size={15} /> Sign in
                  </Button>
                ))}
            </div>
          </div>
        </header>

        <main className="px-4 pb-24 pt-6 sm:px-6 md:pb-10">{children}</main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 backdrop-blur-md md:hidden">
        <MobileNav />
      </nav>

      <BuyCreditsModal
        open={buyOpen}
        autostart={autoBuy}
        onPaid={celebratePurchase}
        onClose={() => {
          setBuyOpen(false);
          setAutoBuy(null);
        }}
      />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      {purchaseNote && (
        <div className="animate-rise fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm font-medium text-fg shadow-[0_16px_40px_-16px_rgba(16,18,27,0.4)]">
          <span className="flex items-center gap-2">
            <Coins size={15} className="text-teal" /> {purchaseNote}
          </span>
        </div>
      )}
    </div>
  );
}

function MobileNav() {
  const pathname = usePathname();
  return (
    <>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/app" ? pathname === "/app" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium",
              active ? "text-accent-2" : "text-faint",
            )}
          >
            <Icon size={20} />
            {label}
          </Link>
        );
      })}
    </>
  );
}
