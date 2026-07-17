"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft, ArrowRight, Clapperboard, Film, FolderOpen, LayoutGrid, LogOut, Loader2, Mail, Package, Plus, Coins, UserCircle, UserRound, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { supabase, cloudConfigured } from "@/lib/supabase";
import { TOPUPS, PLAN_ITEMS, PLAN_ITEMS_YEARLY, billingItem, planVariant, type BillingItem } from "@/lib/billing";
import { cn } from "@/lib/utils";
import { Button, Modal, Badge, TextInput } from "@/components/ui";
import { AuthModal } from "@/components/auth/auth-modal";
import { Turnstile, captchaEnabled } from "@/components/auth/turnstile";
import { CheckoutPanel } from "@/components/checkout/checkout-panel";
import { AccountModal } from "@/components/account/account-modal";
import { LogoWordmark } from "@/components/logo";

// The nav splits into the production pipeline and the library of what you own.
// `short` is the label used on the compact mobile bar (6 items must fit).
const NAV_GROUPS: { label: string; items: { href: string; label: string; short?: string; icon: typeof Clapperboard }[] }[] = [
  {
    label: "Production",
    items: [
      { href: "/app", label: "Make", icon: Clapperboard },
      { href: "/app/storyboard", label: "Storyboard", short: "Board", icon: LayoutGrid },
      { href: "/app/videos", label: "My Videos", short: "Videos", icon: Film },
    ],
  },
  {
    label: "Library",
    items: [
      { href: "/app/characters", label: "Characters", short: "Cast", icon: UserRound },
      { href: "/app/products", label: "Products", short: "Product", icon: Package },
      { href: "/app/assets", label: "Assets", icon: FolderOpen },
    ],
  },
];
// Flat list for the mobile bar (can't show group headers) — one source of truth.
const NAV_ITEMS = NAV_GROUPS.flatMap((g) => g.items);

/** Make is the index route — it also owns /app/make; the rest match by prefix. */
const isActive = (href: string, pathname: string) =>
  href === "/app"
    ? pathname === "/app" || pathname.startsWith("/app/make")
    : pathname.startsWith(href);

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
      {NAV_GROUPS.map((group, gi) => (
        <div key={group.label} className={cn("flex flex-col gap-1", gi > 0 && "mt-5")}>
          <div className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wider text-faint">
            {group.label}
          </div>
          {group.items.map(({ href, label, icon: Icon }) => {
            const active = isActive(href, pathname);
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
        </div>
      ))}
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

/** localStorage key caching whether the account has an active subscription. */
const SUBSCRIBED_KEY = "vibvid-subscribed";

/**
 * Ask the server to start an on-site Stripe checkout. Pass a `token` for a
 * signed-in buyer, or an `email` for a guest (their account is created
 * server-side). Returns the Embedded Checkout client secret to mount in-page,
 * or null when payments aren't configured on the server (501), in which case
 * callers fall back to demo credits.
 */
async function requestCheckout(
  item: BillingItem,
  auth: { token?: string; email?: string },
): Promise<{ clientSecret: string } | null> {
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
  const data = await res.json();
  if (data.provider === "stripe" && typeof data.clientSecret === "string") {
    return { clientSecret: data.clientSecret };
  }
  return null;
}

function BuyCreditsModal({
  open,
  onClose,
  autostart,
}: {
  open: boolean;
  onClose: () => void;
  /** When set, checkout for this item starts as soon as the modal opens. */
  autostart?: BillingItem | null;
}) {
  const addCredits = useStore((s) => s.addCredits);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [cycle, setCycle] = useState<"month" | "year">("month");
  // Set once a checkout starts: the Embedded Checkout form renders in-page.
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const autostarted = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSelected(autostart?.id ?? null);
    setCycle(autostart?.interval === "year" ? "year" : "month");
    setClientSecret(null);
  }, [open, autostart]);

  // Start an on-site Stripe checkout: fetch a client secret and mount Stripe's
  // embedded form here. Only signed-in users reach this modal (the paywall gate
  // handles guests). The demo grant exists ONLY for local no-cloud setups — a
  // real account never gets free credits, even if Stripe is unconfigured.
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
        const start = await requestCheckout(item, { token });
        if (start) {
          setClientSecret(start.clientSecret);
          return;
        }
        // null → payments not configured on the server (501).
        setError("Payments aren’t configured on this server yet — try again later.");
        return;
      }
      // Local demo (no cloud): instant credits, no charge.
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

  if (clientSecret) {
    return (
      <Modal open={open} onClose={onClose} title="Checkout" size="lg">
        <CheckoutPanel clientSecret={clientSecret} onBack={() => setClientSecret(null)} />
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

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-faint">Or subscribe</div>
        <div className="inline-flex rounded-full border border-line bg-surface p-0.5 text-[12px] font-medium">
          <button
            onClick={() => setCycle("month")}
            className={cn("rounded-full px-3 py-1 transition-colors", cycle === "month" ? "bg-accent text-white" : "text-muted hover:text-fg")}
          >
            Monthly
          </button>
          <button
            onClick={() => setCycle("year")}
            className={cn("rounded-full px-3 py-1 transition-colors", cycle === "year" ? "bg-accent text-white" : "text-muted hover:text-fg")}
          >
            Annual · 4 months on us
          </button>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(cycle === "year" ? PLAN_ITEMS_YEARLY : PLAN_ITEMS).map((p) => (
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
              <div className="text-xs text-faint">
                {p.credits.toLocaleString()} credits / {p.interval === "year" ? "yr" : "mo"} · {p.sublabel}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-lg font-semibold text-accent-2">
              {busy === p.id ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>{p.priceLabel}<span className="text-xs font-normal text-faint">/{p.interval === "year" ? "yr" : "mo"}</span></>
              )}
            </div>
          </button>
        ))}
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}
      <p className="mt-4 text-xs text-faint">
        Secure checkout by Stripe, our payment processor. Plans renew each billing period until
        cancelled; credits are added the moment your payment clears. See our{" "}
        <a href="/refunds" className="underline hover:text-fg">Refund &amp; Cancellation Policy</a>.
      </p>
    </Modal>
  );
}

/**
 * Signed-out gate: email → one-time code → in. No payment here — new and
 * returning users sign in the same way and land inside the studio, which stays
 * locked (ActivateGate) until they subscribe.
 */
function SignUpGate() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [resent, setResent] = useState(false);
  // Captcha (active only when NEXT_PUBLIC_TURNSTILE_SITE_KEY is configured).
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaReset, setCaptchaReset] = useState(0);
  const captchaReady = !captchaEnabled || Boolean(captchaToken);
  function consumeCaptcha() {
    setCaptchaToken(null);
    setCaptchaReset((k) => k + 1);
  }
  const emailValid = /^\S+@\S+\.\S+$/.test(email.trim());

  async function sendCode() {
    if (busy || !supabase) return;
    setError(null);
    if (!emailValid) {
      setError("Enter a valid email to continue.");
      return;
    }
    if (!captchaReady) {
      setError("Complete the quick check first.");
      return;
    }
    setBusy(true);
    try {
      const e = email.trim().toLowerCase();
      const { error: err } = await supabase.auth.signInWithOtp({
        email: e,
        options: {
          shouldCreateUser: true, // new email → account created on verify
          emailRedirectTo: `${window.location.origin}/app`,
          ...(captchaToken ? { captchaToken } : {}),
        },
      });
      if (err) throw err;
      setResent(false);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t send your code.");
    } finally {
      consumeCaptcha();
      setBusy(false);
    }
  }

  async function resend() {
    if (!supabase || !emailValid || !captchaReady) return;
    await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/app`,
        ...(captchaToken ? { captchaToken } : {}),
      },
    });
    consumeCaptcha();
    setResent(true);
  }

  // Verify the code; success flips the session and the gate unmounts by itself
  // (AppShell listens to onAuthStateChange).
  async function verifyCode() {
    if (!supabase || verifying) return;
    const token = otpCode.trim();
    if (!/^\d{6}$/.test(token)) return;
    setVerifying(true);
    setOtpError(null);
    try {
      const { data: vData, error: vErr } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token,
        type: "email",
      });
      if (vErr) throw vErr;
      // Record ToS/Privacy acceptance (the consent line is shown on the form).
      const uid = vData?.user?.id;
      if (uid) {
        void supabase.from("profiles").update({ accepted_terms_at: new Date().toISOString() }).eq("id", uid);
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : "";
      setOtpError(
        /expired|invalid/i.test(raw)
          ? "That code didn’t match or has expired — check the digits or resend."
          : raw || "Couldn’t verify the code.",
      );
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="flex justify-center">
          <LogoWordmark className="text-2xl" />
        </div>

        {step === "email" ? (
          <>
            <div className="mt-5 text-center">
              <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Let’s get started</h1>
              <p className="mx-auto mt-2 max-w-sm text-[14.5px] text-muted">
                Enter your email and we’ll send a one-time code to sign you in. You’ll pick a plan
                once you’re inside.
              </p>
            </div>

            <div className="mt-7">
              <label className="mb-1.5 block text-[13px] font-medium text-fg">Email</label>
              <TextInput
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && sendCode()}
              />
            </div>

            {captchaEnabled && <Turnstile onToken={setCaptchaToken} resetKey={captchaReset} />}
            <Button className="mt-4 w-full gap-2" size="lg" onClick={sendCode} disabled={busy || !captchaReady}>
              {busy ? <Loader2 size={17} className="animate-spin" /> : <>Continue <ArrowRight size={17} /></>}
            </Button>
            {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}

            <p className="mt-4 text-center text-[12px] text-faint">
              By continuing you agree to the{" "}
              <Link href="/terms" className="underline hover:text-fg">Terms of Service</Link> and{" "}
              <Link href="/privacy" className="underline hover:text-fg">Privacy Policy</Link>.
            </p>
          </>
        ) : (
          <>
            <div className="mt-5 flex justify-center">
              <button
                onClick={() => {
                  setError(null);
                  setOtpError(null);
                  setStep("email");
                }}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-line-2 bg-surface px-3 py-1 text-[13px] font-medium text-muted transition-colors hover:text-fg"
              >
                <ArrowLeft size={13} className="shrink-0" />
                <span className="truncate">{email}</span>
                <span className="shrink-0 text-accent-2">· change</span>
              </button>
            </div>

            <div className="mt-4 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-accent-2">
                <Mail size={26} />
              </span>
              <h1 className="font-display mt-4 text-2xl font-bold tracking-tight">Enter your code</h1>
              <p className="mx-auto mt-2 max-w-sm text-[14.5px] text-muted">
                We emailed a sign-in code to <span className="font-semibold text-fg">{email}</span>. Type it
                below, or tap the link in the same email.
              </p>
            </div>

            <div className="mx-auto mt-6 max-w-[240px]">
              <TextInput
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="123456"
                maxLength={6}
                autoFocus
                value={otpCode}
                className="text-center font-mono !text-2xl tracking-[0.35em]"
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                onKeyDown={(e) => e.key === "Enter" && verifyCode()}
              />
            </div>
            {otpError && <p className="mt-3 text-center text-sm text-danger">{otpError}</p>}
            <div className="mt-5 flex flex-col items-center gap-3">
              <Button onClick={verifyCode} disabled={verifying || !/^\d{6}$/.test(otpCode.trim())}>
                {verifying ? <Loader2 size={16} className="animate-spin" /> : <>Verify &amp; continue</>}
              </Button>
              {captchaEnabled && !resent && <Turnstile onToken={setCaptchaToken} resetKey={captchaReset} />}
              <Button variant="outline" size="sm" onClick={resend} disabled={resent || !captchaReady}>
                <Mail size={14} /> {resent ? "Code sent — check your inbox" : "Resend the code"}
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Shown in the studio's main area to a signed-in user without an active
 * subscription. The rest of the app (nav, account) is visible, but generation
 * is locked until they subscribe to one of the three plans. Payment is in-page
 * (embedded checkout); on completion Stripe returns them to /app?purchase=success
 * and the app re-checks their subscription and unlocks.
 */
function ActivateGate({ preselect }: { preselect: BillingItem | null }) {
  const planPreselect = preselect?.kind === "subscription" ? preselect : null;
  const [selectedId, setSelectedId] = useState(
    planPreselect?.id.replace(/-year$/, "") ?? PLAN_ITEMS.find((p) => p.popular)?.id ?? PLAN_ITEMS[0].id,
  );
  const [cycle, setCycle] = useState<"month" | "year">(planPreselect?.interval === "year" ? "year" : "month");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const baseMonthly = PLAN_ITEMS.find((p) => p.id === selectedId) ?? PLAN_ITEMS.find((p) => p.popular) ?? PLAN_ITEMS[0];
  const paid = (cycle === "year" ? planVariant(baseMonthly.id, "year") : null) ?? baseMonthly;

  async function go() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token) {
        setError("Your session expired — refresh the page and sign in again.");
        return;
      }
      const start = await requestCheckout(paid, { token });
      if (!start) {
        setError("Payments aren’t configured on this server yet — try again later.");
        return;
      }
      setClientSecret(start.clientSecret);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setBusy(false);
    }
  }

  if (clientSecret) {
    return (
      <div className="mx-auto max-w-lg py-4">
        <CheckoutPanel clientSecret={clientSecret} onBack={() => setClientSecret(null)} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg py-4">
      <div className="text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-2">
          <Sparkles size={22} />
        </span>
        <h1 className="font-display mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Activate your studio</h1>
        <p className="mx-auto mt-2 max-w-sm text-[14.5px] text-muted">
          Choose a plan to unlock generation. Pay for the year and get 4 months on us. Cancel anytime.
        </p>
      </div>

      <div className="mt-5 flex justify-center">
        <div className="inline-flex rounded-full border border-line bg-surface p-0.5 text-[12.5px] font-medium">
          <button
            onClick={() => setCycle("month")}
            className={cn("rounded-full px-3.5 py-1.5 transition-colors", cycle === "month" ? "bg-accent text-white" : "text-muted hover:text-fg")}
          >
            Monthly
          </button>
          <button
            onClick={() => setCycle("year")}
            className={cn("rounded-full px-3.5 py-1.5 transition-colors", cycle === "year" ? "bg-accent text-white" : "text-muted hover:text-fg")}
          >
            Annual · 4 months on us
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        {PLAN_ITEMS.map((base) => {
          const p = (cycle === "year" ? planVariant(base.id, "year") : null) ?? base;
          const active = selectedId === base.id;
          return (
            <button
              key={base.id}
              onClick={() => setSelectedId(base.id)}
              className={cn(
                "flex w-full items-center justify-between rounded-2xl border bg-surface p-4 text-left transition-colors",
                active ? "border-accent ring-1 ring-accent/40" : "border-line hover:border-faint",
              )}
            >
              <span className="flex items-center gap-3">
                <span className={cn("flex h-4 w-4 items-center justify-center rounded-full border", active ? "border-accent" : "border-line-2")}>
                  {active && <span className="h-2 w-2 rounded-full bg-accent" />}
                </span>
                <span>
                  <span className="flex items-center gap-2 text-[15px] font-semibold text-fg">
                    {p.label}
                    {"popular" in p && p.popular && <Badge tone="accent">Most popular</Badge>}
                  </span>
                  <span className="block text-[12.5px] text-faint">
                    {cycle === "year" ? p.sublabel : `${p.credits.toLocaleString()} credits / mo · ${p.sublabel}`}
                  </span>
                </span>
              </span>
              <span className="text-lg font-bold text-fg">
                {p.priceLabel}
                <span className="text-xs font-normal text-faint">{cycle === "year" ? "/yr" : "/mo"}</span>
              </span>
            </button>
          );
        })}
      </div>

      <Button className="mt-4 w-full" size="lg" onClick={go} disabled={busy}>
        {busy ? <Loader2 size={17} className="animate-spin" /> : <>Subscribe — {paid.priceLabel}{cycle === "year" ? "/yr" : "/mo"}</>}
      </Button>
      {error && <p className="mt-3 text-center text-sm text-danger">{error}</p>}
      <p className="mt-4 text-center text-[12px] text-faint">
        Secure checkout by Stripe · charged in US dollars · renews {cycle === "year" ? "yearly" : "monthly"} · cancel anytime.
      </p>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [buyOpen, setBuyOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const authOpen = useStore((s) => s.authOpen);
  const setAuthOpen = useStore((s) => s.setAuthOpen);
  const [email, setEmail] = useState<string | null>(null);
  const hydrateFromCloud = useStore((s) => s.hydrateFromCloud);
  const signOutToLocal = useStore((s) => s.signOutToLocal);
  const lastUser = useRef<string | null>(null);
  const [purchaseNote, setPurchaseNote] = useState<string | null>(null);
  const [autoBuy, setAutoBuy] = useState<BillingItem | null>(null);
  // True once Supabase has reported the initial session (gate vs app decision).
  const [authReady, setAuthReady] = useState(false);
  // Studio access lives in the store so any view can open the paywall on a paid
  // action. null = still checking; false = locked (browsable, generate prompts
  // subscribe). Seeded from a cached hint so decisions are instant on load.
  const subscribed = useStore((s) => s.subscribed);
  const setSubscribed = useStore((s) => s.setSubscribed);
  const activateOpen = useStore((s) => s.activateOpen);
  const setActivateOpen = useStore((s) => s.setActivateOpen);
  useEffect(() => {
    const c = localStorage.getItem(SUBSCRIBED_KEY);
    if (c === "1" || c === "0") setSubscribed(c === "1");
  }, [setSubscribed]);

  // Ask the server whether this account may use the studio, and cache the
  // answer so the next load decides instantly.
  const checkSubscription = useCallback(async () => {
    if (!supabase) return;
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    if (!token) return;
    try {
      const res = await fetch("/api/account", { headers: { Authorization: `Bearer ${token}` } });
      const d = res.ok ? await res.json() : null;
      const b = d?.billing;
      // Unlock on the same signal the server enforces (admin or credits), plus
      // an active subscription so a subscriber who's momentarily at 0 credits
      // is never gated. Credits only come from subscribing.
      const active =
        Boolean(d?.admin) ||
        (typeof d?.credits === "number" && d.credits > 0) ||
        Boolean(b && b.plan && ["active", "trialing", "past_due"].includes(b.status));
      setSubscribed(active);
      localStorage.setItem(SUBSCRIBED_KEY, active ? "1" : "0");
    } catch {
      /* leave the current (possibly cached) value in place */
    }
  }, [setSubscribed]);

  // ?buy=<itemId> — a plan chosen on the landing page. Carry it in as the
  // preselected plan; signed-in subscribers get the credits modal, everyone
  // else lands on the ActivateGate with it preselected.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const item = billingItem(params.get("buy") ?? "");
    if (!item) return;
    params.delete("buy");
    const qs = params.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
    setAutoBuy(item);
    if (!supabase) setBuyOpen(true); // demo mode — just show the options
  }, []);

  // Subscribers who arrive with ?buy= get the credits modal (top-up / switch).
  useEffect(() => {
    if (subscribed && autoBuy) setBuyOpen(true);
  }, [subscribed, autoBuy]);

  // Returning in-page from Stripe's embedded checkout (?purchase=success). The
  // webhook grants credits and activates the subscription async, so poll the
  // cloud a few times for the balance to land and re-check the subscription so
  // the studio unlocks.
  useEffect(() => {
    if (typeof window === "undefined" || !supabase) return;
    const status = new URLSearchParams(window.location.search).get("purchase");
    if (!status) return;
    window.history.replaceState({}, "", window.location.pathname);
    if (status === "failed") {
      setPurchaseNote("Payment didn’t go through — no charge was made.");
      const t = setTimeout(() => setPurchaseNote(null), 6000);
      return () => clearTimeout(t);
    }
    let poll: ReturnType<typeof setInterval> | null = null;
    void supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        setPurchaseNote("Payment received — sign in to see your credits.");
        setTimeout(() => setPurchaseNote(null), 15000);
        return;
      }
      setPurchaseNote("Payment received — activating your studio…");
      void checkSubscription();
      // Only claim success when the balance actually increased — the webhook
      // grants credits async and can fail; never tell a customer "all set" on faith.
      const before = useStore.getState().credits;
      let n = 0;
      poll = setInterval(async () => {
        const uid = (await supabase!.auth.getSession()).data.session?.user?.id;
        if (uid) await hydrateFromCloud(uid);
        const now = useStore.getState().credits;
        if (now > before) {
          if (poll) clearInterval(poll);
          void checkSubscription();
          setPurchaseNote("You’re all set — your studio is active.");
          setTimeout(() => setPurchaseNote(null), 4000);
          return;
        }
        if (++n >= 7) {
          if (poll) clearInterval(poll);
          void checkSubscription();
          setPurchaseNote(
            "Payment received — your credits are still processing. If they don’t appear in a few minutes, email support@vibvid.ai.",
          );
          setTimeout(() => setPurchaseNote(null), 20000);
        }
      }, 3000);
    });
    return () => {
      if (poll) clearInterval(poll);
    };
  }, [hydrateFromCloud, checkSubscription]);

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
          void checkSubscription();
        }
      } else {
        setEmail(null);
        if (event === "SIGNED_OUT") {
          lastUser.current = null;
          setSubscribed(null);
          localStorage.removeItem(SUBSCRIBED_KEY);
          signOutToLocal();
        }
      }
    });
    return () => subscription.unsubscribe();
  }, [hydrateFromCloud, signOutToLocal, setAuthOpen, checkSubscription]);

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
        <SignUpGate />
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
        <nav className="mt-8 flex flex-col">
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
              {/* Locked users can browse; the Buy button routes them to subscribe
                  rather than the top-up modal (top-ups are a subscriber add-on). */}
              <CreditWidget onBuy={() => (subscribed === false ? setActivateOpen(true) : setBuyOpen(true))} />
              {cloudConfigured &&
                (email ? (
                  <div className="flex items-center gap-1.5">
                    <span className="hidden max-w-[150px] truncate text-xs text-muted lg:block">{email}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setAccountOpen(true)}
                      title="Account & billing"
                      className="gap-1.5"
                    >
                      <UserCircle size={15} />
                    </Button>
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

        {/* The whole studio is browsable; paid actions (generate, Strategist,
            Director) open the subscribe paywall for a locked account. */}
        <main className="px-4 pb-24 pt-6 sm:px-6 md:pb-10">{children}</main>
      </div>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface/95 backdrop-blur-md md:hidden">
        <MobileNav />
      </nav>

      <BuyCreditsModal
        open={buyOpen}
        autostart={autoBuy}
        onClose={() => {
          setBuyOpen(false);
          setAutoBuy(null);
        }}
      />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
      <AccountModal open={accountOpen} onClose={() => setAccountOpen(false)} />
      <Modal open={activateOpen} onClose={() => setActivateOpen(false)} size="lg">
        <ActivateGate preselect={autoBuy} />
      </Modal>

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
      {NAV_ITEMS.map(({ href, label, short, icon: Icon }) => {
        const active = isActive(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium",
              active ? "text-accent-2" : "text-faint",
            )}
          >
            <Icon size={19} />
            <span className="max-w-full truncate">{short ?? label}</span>
          </Link>
        );
      })}
    </>
  );
}
