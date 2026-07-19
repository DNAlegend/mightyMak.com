"use client";

// The mobile navigation menu for the marketing header. Kept as its own client
// component so the landing page itself can stay a server component. Opens a
// full-width sheet under the header, closes on link tap, backdrop tap, Escape,
// or a resize up to desktop — and locks body scroll while open.

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X, ArrowRight } from "lucide-react";

const NAV_LINKS = [
  { href: "/#styles", label: "Styles" },
  { href: "/#how", label: "How it works" },
  { href: "/#compare", label: "Compare" },
  { href: "/pricing", label: "Pricing" },
];

export function MobileNav({ appHref }: { appHref: string }) {
  const [open, setOpen] = useState(false);

  // Close on Escape, and lock body scroll while the sheet is open. Also close
  // when the viewport widens past the desktop breakpoint — the CSS hides the
  // sheet there, and without this the invisible menu kept the page
  // scroll-locked.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const mq = window.matchMedia("(min-width: 768px)");
    const onWiden = (e: MediaQueryListEvent) => e.matches && setOpen(false);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    mq.addEventListener("change", onWiden);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      mq.removeEventListener("change", onWiden);
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-10 items-center justify-center rounded-xl border border-line-2 text-fg transition-colors hover:bg-surface-2"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>

      {open && (
        <>
          {/* backdrop */}
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-16 z-40 bg-black/30 backdrop-blur-sm"
          />
          {/* sheet */}
          <nav className="animate-rise fixed inset-x-0 top-16 z-50 border-b border-line bg-bg px-4 pb-6 pt-2 shadow-[0_24px_60px_-24px_rgba(16,18,27,0.4)]">
            <div className="flex flex-col">
              {NAV_LINKS.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between border-b border-line py-3.5 text-[16px] font-medium text-fg"
                >
                  {l.label}
                  <ArrowRight size={16} className="text-faint" />
                </Link>
              ))}
            </div>
            <div className="mt-5">
              <Link
                href={appHref}
                onClick={() => setOpen(false)}
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-accent text-[15px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(236,19,32,0.7)] transition-colors hover:bg-accent-2"
              >
                Make your first ad <ArrowRight size={16} />
              </Link>
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
