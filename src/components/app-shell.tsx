"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clapperboard, Film, FolderOpen, LogOut, Loader2, Plus, Coins, UserCircle, Sparkles } from "lucide-react";
import { useStore } from "@/lib/store";
import { supabase, cloudConfigured } from "@/lib/supabase";
import { TOPUPS, PLAN_ITEMS, type BillingItem } from "@/lib/billing";
import { cn } from "@/lib/utils";
import { Button, Modal, Badge } from "@/components/ui";
import { AuthModal } from "@/components/auth/auth-modal";
import { LogoMark } from "@/components/logo";

const NAV = [
  { href: "/app", label: "Video", icon: Clapperboard },
  { href: "/app/assets", label: "Assets", icon: FolderOpen },
  { href: "/app/library", label: "Library", icon: Film },
];

function Brand() {
  return (
    <Link href="/app" className="flex items-center gap-2.5">
      <LogoMark size={36} className="drop-shadow-[0_6px_14px_rgba(124,108,255,0.45)]" />
      <span className="text-[17px] font-extrabold tracking-tight text-fg">MightyMak</span>
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

function BuyCreditsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const addCredits = useStore((s) => s.addCredits);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Start a real MamoPay checkout; if payments aren't configured (or the user
  // is signed out), fall back to the instant demo top-up so the app still works.
  async function buy(item: BillingItem) {
    if (busy) return;
    setBusy(item.id);
    setError(null);
    try {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (token) {
        const res = await fetch("/api/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ itemId: item.id, origin: window.location.origin }),
        });
        if (res.ok) {
          const { url } = await res.json();
          if (url) {
            window.location.href = url; // hand off to MamoPay's hosted checkout
            return;
          }
        } else if (res.status !== 501) {
          const d = await res.json().catch(() => ({}));
          throw new Error(d.error ?? "Checkout failed");
        }
        // 501 → payments not configured yet; fall through to demo.
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
              p.popular ? "border-accent/40" : "border-line",
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
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {PLAN_ITEMS.map((p) => (
          <button
            key={p.id}
            disabled={!!busy}
            onClick={() => buy(p)}
            className={cn(
              "relative flex items-center justify-between rounded-2xl border bg-surface-2 p-4 text-left transition-colors hover:border-accent/50 disabled:opacity-60",
              p.popular ? "border-accent/40" : "border-line",
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

export function AppShell({ children }: { children: ReactNode }) {
  const [buyOpen, setBuyOpen] = useState(false);
  const authOpen = useStore((s) => s.authOpen);
  const setAuthOpen = useStore((s) => s.setAuthOpen);
  const [email, setEmail] = useState<string | null>(null);
  const hydrateFromCloud = useStore((s) => s.hydrateFromCloud);
  const signOutToLocal = useStore((s) => s.signOutToLocal);
  const lastUser = useRef<string | null>(null);
  const [purchaseNote, setPurchaseNote] = useState<string | null>(null);

  // Returning from MamoPay checkout — the webhook adds credits async, so poll
  // the cloud a few times for them to land, and confirm to the user.
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
    return () => clearInterval(poll);
  }, [hydrateFromCloud]);

  useEffect(() => {
    if (!supabase) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setEmail(session.user.email ?? "Account");
        // Covers sign-ins completed outside the modal too (e.g. the email
        // confirmation link landing back on /app).
        setAuthOpen(false);
        if (lastUser.current !== session.user.id) {
          lastUser.current = session.user.id;
          void hydrateFromCloud(session.user.id);
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

      <BuyCreditsModal open={buyOpen} onClose={() => setBuyOpen(false)} />
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
