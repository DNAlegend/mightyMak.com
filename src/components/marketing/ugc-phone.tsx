"use client";

// The landing page's UGC media primitives. The style library shows ten real
// mp4s (~70 MB total), so playback is strictly viewport-driven: each video
// loads metadata only and plays while at least a third of it is on screen.

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";

/** A muted looping video that plays only while (mostly) in the viewport. */
export function InViewVideo({
  src,
  poster,
  className,
  autoPlayEager,
}: {
  src: string;
  poster?: string;
  className?: string;
  /** Above-the-fold media (the hero phones) may start immediately. */
  autoPlayEager?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void el.play().catch(() => {});
        else el.pause();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    // eslint-disable-next-line jsx-a11y/media-has-caption
    <video
      ref={ref}
      src={src}
      poster={poster}
      muted
      loop
      playsInline
      preload={autoPlayEager ? "auto" : "metadata"}
      autoPlay={autoPlayEager}
      className={className}
    />
  );
}

/** A minimal 9:16 phone shell — dark bezel, notch, nothing else. */
export function PhoneFrame({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={`relative rounded-[1.8rem] border border-line-2 bg-black p-1.5 shadow-[0_24px_60px_-24px_rgba(16,18,27,0.5)] ${className ?? ""}`}>
      <div className="relative aspect-[9/16] overflow-hidden rounded-[1.35rem] bg-black">
        {children}
        {/* the notch */}
        <div className="pointer-events-none absolute left-1/2 top-1.5 h-4 w-16 -translate-x-1/2 rounded-full bg-black/90" />
      </div>
    </div>
  );
}

/** One style-library tile: the real ad in a phone, its setting and hook.
 *  Props are plain strings — this crosses the server→client boundary. */
export function UgcStyleTile({
  id,
  name,
  setting,
  hook,
  src,
}: {
  id: string;
  name: string;
  setting: string;
  hook: string;
  src: string;
}) {
  return (
    <Link href={`/app/ugc?style=${id}`} className="group block" title={`Copy the ${name} style`}>
      <PhoneFrame className="transition-transform duration-200 group-hover:-translate-y-1">
        <InViewVideo src={src} className="h-full w-full object-cover" />
        <span className="pointer-events-none absolute left-1.5 top-7 inline-flex items-center gap-1 rounded-full border border-white/20 bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          <MapPin size={9} /> {setting}
        </span>
        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2.5 pb-2.5 pt-8">
          <span className="block text-[12.5px] font-semibold leading-tight text-white">{name}</span>
          <span className="mt-0.5 block truncate text-[11px] italic text-white/75">&ldquo;{hook}&rdquo;</span>
        </span>
      </PhoneFrame>
      <span className="mt-1.5 flex items-center justify-center gap-1 text-[12px] font-medium text-muted transition-colors group-hover:text-accent-2">
        Use this style <ArrowRight size={12} />
      </span>
    </Link>
  );
}
