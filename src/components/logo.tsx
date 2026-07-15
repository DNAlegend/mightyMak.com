// The VIBVID square mark (public/logo-square.png) — the brand logo used for the
// app/favicon and any square placement. `animated` is kept for API
// compatibility; the image itself carries the design.

import { cn } from "@/lib/utils";

export function LogoMark({
  size = 36,
  className,
}: {
  size?: number;
  animated?: boolean;
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-square.png"
      alt="VIBVID.AI"
      width={size}
      height={size}
      draggable={false}
      className={cn("rounded-[0.28em]", className)}
    />
  );
}

/**
 * The wordmark, exactly as the logo draws it: "VIB" in ink, then "VID" in white
 * on a red pill with a play triangle, then a muted ".AI".
 */
export function LogoWordmark({ className }: { className?: string }) {
  // The brand wordmark image (public/logo-wordmark.png). Height scales with the
  // font-size set via className (defaults to text-[19px]); width auto-fits.
  return (
    <span className={cn("inline-flex items-center text-[19px] leading-none", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-wordmark.png" alt="VIBVID.AI" className="h-[1.35em] w-auto" draggable={false} />
    </span>
  );
}
