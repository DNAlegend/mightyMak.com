"use client";

// Auth-aware top-right of the marketing header. Signed out: Sign in + Get
// started. Signed in: a profile chip (avatar + email) and an "Open studio"
// button, so a logged-in visitor can see they're signed in from the home page.

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

const APP = "/app";
const btn = "inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors";
const primary = "bg-accent text-white hover:bg-accent-2 shadow-[0_8px_24px_-8px_rgba(236,19,32,0.7)]";
const soft = "bg-surface-3 text-fg hover:bg-line-2";

export function HeaderAuth() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user?.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user?.email ?? null));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (email) {
    const initial = email.trim()[0]?.toUpperCase() ?? "?";
    return (
      <div className="flex items-center gap-2">
        <Link href={APP} className={cn(btn, primary, "hidden sm:inline-flex")}>
          Open studio
        </Link>
        <Link
          href={APP}
          title={`Signed in as ${email}`}
          className="flex items-center gap-2 rounded-full border border-line-2 bg-surface py-1 pl-1 pr-1 transition-colors hover:border-faint sm:pr-3"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">
            {initial}
          </span>
          <span className="hidden max-w-[160px] truncate text-[13px] font-medium text-muted sm:block">{email}</span>
        </Link>
      </div>
    );
  }

  return (
    <>
      <Link href={APP} className={cn(btn, soft, "hidden sm:inline-flex")}>
        Sign in
      </Link>
      <Link href={APP} className={cn(btn, primary)}>
        Get started
      </Link>
    </>
  );
}
