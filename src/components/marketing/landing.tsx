import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import {
  Sparkles,
  ArrowRight,
  Check,
  ChevronDown,
  Wand2,
  LayoutGrid,
  Clapperboard,
  UserRound,
  Film,
  Download,
  Play,
  Repeat,
  Tv,
  Clock,
  ShieldCheck,
  Ban,
  Mail,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui";
import { LogoWordmark } from "@/components/logo";
import { MobileNav } from "@/components/marketing/mobile-nav";
import { HeaderAuth } from "@/components/marketing/header-auth";
import {
  SHOWCASE,
  CONSISTENT_CHARACTER,
  CHARACTER_SCENES,
  SEASON,
  type ShowcaseMedia,
} from "@/lib/showcase";
import { UGC_STYLES } from "@/lib/ugc-templates";
import { InViewVideo, PhoneFrame, UgcStyleTile } from "@/components/marketing/ugc-phone";
import { SupportForm } from "@/components/support/support-view";
import { generatedSrc, type DemoItem } from "@/lib/demo-content";
import { CLASS_BY_KEY, elementsByClass, thumbFor, type StudioElement } from "@/lib/catalog";
import type { AssetClass } from "@/lib/types";
import { USE_CASES, heroDemo, type UseCase } from "@/lib/use-cases";
import { LEGAL_LINKS, COMPANY } from "@/components/legal/legal-page";

const APP = "/app";

/* ------------------------------ Primitives ------------------------------ */

export function CTA({
  href,
  children,
  variant = "primary",
  size = "lg",
  className,
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "outline" | "soft";
  size?: "md" | "lg";
  className?: string;
}) {
  const variants = {
    primary: "bg-accent text-white hover:bg-accent-2 shadow-[0_8px_24px_-8px_rgba(236,19,32,0.7)]",
    outline: "border border-line-2 text-fg hover:bg-surface-2 hover:border-faint",
    soft: "bg-surface-3 text-fg hover:bg-line-2",
  };
  const sizes = { md: "h-10 px-4 text-sm rounded-xl", lg: "h-12 px-6 text-[15px] rounded-xl" };
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition-colors",
        variants[variant],
        sizes[size],
        className,
      )}
    >
      {children}
    </Link>
  );
}

function MediaTile({ m, className }: { m: ShowcaseMedia; className?: string }) {
  if (m.type === "video") {
    return (
      // eslint-disable-next-line jsx-a11y/media-has-caption
      <video
        src={m.src}
        poster={m.poster}
        autoPlay
        muted
        loop
        playsInline
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={m.src} alt={m.label} className={cn("h-full w-full object-cover", className)} />;
}

function Brand() {
  return (
    <Link href="/" className="flex items-center">
      <LogoWordmark />
    </Link>
  );
}

/* -------------------------------- Sections ------------------------------ */

export function Header() {
  // whitespace-nowrap: a squeezed link must never wrap and fatten the pill.
  const link = "whitespace-nowrap rounded-full px-3.5 py-2 transition-colors hover:bg-surface-2/80 hover:text-fg";
  return (
    <header className="sticky top-2 z-30 px-2 sm:top-3 sm:px-4">
      <div className="glass mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 rounded-full pl-4 pr-2 sm:pl-5">
        <Brand />
        {/* Full nav needs lg — below that the signed-in chips crowd it out,
            so the hamburger takes over. */}
        <nav className="hidden items-center gap-0.5 text-sm font-medium text-muted lg:flex">
          <a href="/#styles" className={link}>Styles</a>
          <a href="/#how" className={link}>How it works</a>
          <a href="/#compare" className={link}>Compare</a>
          <a href="/#characters" className={link}>Your presenter</a>
          <a href="/pricing" className={link}>Pricing</a>
        </nav>
        <div className="flex items-center gap-2">
          <HeaderAuth />
          <MobileNav appHref="/app/ugc" />
        </div>
      </div>
    </header>
  );
}

/** Concrete capability pills shown under the hero CTAs. */
const HERO_PILLS = [
  "10 proven ad styles",
  "Your real product, not a lookalike",
  "Same presenter in every ad",
  "9:16 · native audio · 15s",
];

/** The three real UGC ads framed as phones in the hero. */
const HERO_PHONES = ["ugc-mirror-routine", "ugc-car-review", "ugc-kitchen-counter"]
  .map((id) => ({ style: UGC_STYLES.find((s) => s.id === id)!, src: generatedSrc(id) }))
  .filter((p) => p.style && p.src) as { style: (typeof UGC_STYLES)[number]; src: string }[];

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* brand-color gradient mesh backdrop */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1100px 560px at 50% -12%, rgba(236,19,32,0.20), transparent 60%)," +
            "radial-gradient(720px 440px at 10% 6%, rgba(255,120,60,0.12), transparent 55%)," +
            "radial-gradient(760px 460px at 92% 16%, rgba(124,92,255,0.08), transparent 55%)",
        }}
      />
      {/* faint studio grid */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.6]"
        style={{
          maskImage: "radial-gradient(760px 420px at 50% 6%, #000, transparent 78%)",
          WebkitMaskImage: "radial-gradient(760px 420px at 50% 6%, #000, transparent 78%)",
          backgroundImage:
            "linear-gradient(to right, rgba(16,16,20,0.055) 1px, transparent 1px), linear-gradient(to bottom, rgba(16,16,20,0.055) 1px, transparent 1px)",
          backgroundSize: "42px 42px",
        }}
      />
      {/* soft fade into the page below */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-b from-transparent to-bg" />
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-16 text-center sm:px-6 sm:pt-24">
        <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent-soft px-3 py-1 text-[12px] font-semibold text-accent-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logos/bytedance.svg" alt="" className="h-3.5 w-3.5" />
          Powered by Seedance 2.0 — ByteDance&rsquo;s frontier video model
        </div>
        <h1 className="font-display mx-auto mt-5 max-w-4xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-[58px]">
          Scroll-stopping UGC ads.
          <br className="hidden sm:block" /> <span className="gradient-text">No creators required.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-muted">
          Pick one of ten proven 15-second ad styles, swap in your real product, your presenter
          and your two lines — and render a vertical, ready-to-post ad with native audio.
          Minutes, not weeks. No briefs, no booking, no usage-rights negotiations.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <CTA href="/app/ugc">
            <Sparkles size={18} /> Make your first ad
          </CTA>
          <CTA href="#styles" variant="outline">
            Browse the styles <ArrowRight size={16} />
          </CTA>
        </div>
        <p className="mt-3 text-[13px] text-faint">Plans from $19/month · 4 months on us when billed yearly · cancel anytime</p>

        {/* concrete value pills */}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
          {HERO_PILLS.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1.5 rounded-full border border-line-2 bg-surface/70 px-3 py-1 text-[12px] font-medium text-muted backdrop-blur"
            >
              <Check size={12} className="text-teal" /> {t}
            </span>
          ))}
        </div>

        {/* Hero visual — three of the real ads, framed as phones. */}
        <div className="relative mx-auto mt-12 max-w-3xl">
          <div className="flex items-center justify-center gap-4 sm:gap-6">
            {HERO_PHONES.map((p, i) => (
              <div
                key={p.style.id}
                className={cn(
                  i === 1 ? "w-56 sm:w-64" : "hidden w-48 sm:block",
                  i === 0 && "rotate-[-3deg]",
                  i === 2 && "rotate-[3deg]",
                )}
              >
                <PhoneFrame className={i === 1 ? "z-10" : "opacity-95"}>
                  <InViewVideo src={p.src} autoPlayEager={i === 1} className="h-full w-full object-cover" />
                  <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2.5 pb-2 pt-8 text-left">
                    <span className="block text-[11.5px] font-semibold text-white">{p.style.name}</span>
                  </span>
                </PhoneFrame>
                <p className="mt-2 text-center text-[11px] text-faint">{p.style.setting}</p>
              </div>
            ))}
          </div>
          {/* what gets swapped in: your product, your presenter */}
          <div className="absolute -left-6 top-10 hidden rotate-[-6deg] lg:block">
            <FloatChip
              m={{ id: "chip-your-product", type: "image", src: "/generated/prod-serum.jpg", label: "Glow Serum", tag: "Your product" }}
            />
          </div>
          <div className="absolute -right-8 top-36 hidden rotate-[5deg] lg:block">
            <FloatChip
              m={{ id: "chip-your-presenter", type: "image", src: "/generated/ugc-maya-sheet.jpg", label: "Maya — cast once, reuse forever", tag: "Your presenter" }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function FloatChip({ m }: { m: ShowcaseMedia }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-line-2 bg-surface/90 p-1.5 pr-3 shadow-[0_12px_30px_-12px_rgba(16,18,27,0.4)] backdrop-blur">
      <span className="h-10 w-10 overflow-hidden rounded-xl">
        <MediaTile m={m} />
      </span>
      <span className="text-left">
        <span className="block text-[10px] font-medium uppercase tracking-wide text-accent-2">{m.tag}</span>
        <span className="block text-[13px] font-semibold text-fg">{m.label}</span>
      </span>
    </div>
  );
}

/* ---------------------------- UGC style library --------------------------- */
/* The proof: all ten real, unedited renders — each a complete 15-second ad
   shot in a real place. Copying one is the product's core loop. */

function UgcStyleLibrary() {
  const tiles = UGC_STYLES.map((s) => ({ s, src: generatedSrc(s.id) })).filter(
    (t): t is { s: (typeof UGC_STYLES)[number]; src: string } => !!t.src,
  );
  return (
    <section id="styles" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <Badge tone="accent" className="mb-3">The style library</Badge>
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Ten ads, already directed. Yours to copy.
        </h2>
        <p className="mt-3 text-[17px] text-muted">
          Every video below is a real, unedited render — a complete 15-second ad shot in a real
          place with its own beats and spoken lines. Copy a style and the direction stays; the
          product, the presenter and the lines become yours.
        </p>
      </div>
      <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map(({ s, src }) => (
          <UgcStyleTile key={s.id} id={s.id} name={s.name} setting={s.setting} hook={s.demo.open} src={src} />
        ))}
      </div>
      <div className="mt-8 flex flex-col items-center gap-3">
        <p className="text-[13px] text-faint">
          All ten rendered with VIBVID from the scripts in the library — no editing, no post.
        </p>
        <CTA href="/app/ugc" size="md">
          Open the style library <ArrowRight size={16} />
        </CTA>
      </div>
    </section>
  );
}

/* ------------------------------ UGC economics ----------------------------- */

const COMPARE_ROWS: { row: string; creator: string; vibvid: string }[] = [
  {
    row: "Cost per ad",
    creator: "Typically $150–$400+ per video",
    vibvid: "From ≈ $7 of your monthly credits (≈ $13 in Full HD)",
  },
  {
    row: "Turnaround",
    creator: "1–2 weeks — sourcing, briefing, shipping product, waiting",
    vibvid: "Minutes — each render takes about 30–90 seconds",
  },
  {
    row: "Changing one line",
    creator: "A re-brief, sometimes a re-shoot",
    vibvid: "Edit the line, render again",
  },
  {
    row: "Testing 5 hooks",
    creator: "5 briefs, 5 invoices",
    vibvid: "5 renders on one Pro month",
  },
  {
    row: "Usage rights",
    creator: "Licensed, often time-limited",
    vibvid: "Commercial rights included on every plan",
  },
  {
    row: "Same face next month",
    creator: "If they're available and still on brand",
    vibvid: "Always — the presenter is your character",
  },
];

function UgcEconomics() {
  return (
    <section id="compare" className="border-y border-line bg-surface-2/40">
      <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            The math is the whole pitch.
          </h2>
          <p className="mt-3 text-[17px] text-muted">
            Creator content converts — sourcing creators is what doesn&rsquo;t scale. Keep the
            format, drop the logistics.
          </p>
        </div>
        <div className="mt-10 overflow-hidden rounded-[var(--radius-xl2)] border border-line bg-surface">
          <div className="grid grid-cols-[1fr_1.2fr_1.2fr] border-b border-line bg-surface-2/60 text-[12px] font-semibold uppercase tracking-wider text-faint sm:text-[12.5px]">
            <div className="px-3 py-3 sm:px-5" />
            <div className="px-3 py-3 sm:px-5">Booking a UGC creator</div>
            <div className="px-3 py-3 text-accent-2 sm:px-5">VIBVID</div>
          </div>
          {COMPARE_ROWS.map((r) => (
            <div key={r.row} className="grid grid-cols-[1fr_1.2fr_1.2fr] border-b border-line text-[13px] leading-snug last:border-b-0 sm:text-[13.5px]">
              <div className="px-3 py-3.5 font-semibold text-fg sm:px-5">{r.row}</div>
              <div className="px-3 py-3.5 text-muted sm:px-5">{r.creator}</div>
              <div className="px-3 py-3.5 font-medium text-fg sm:px-5">{r.vibvid}</div>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-4 max-w-3xl text-center text-[12px] leading-relaxed text-faint">
          Creator prices are typical market rates for a single short UGC video and vary widely.
          VIBVID figures assume a 15-second ad rendered in 720p HD (135 credits) on the Pro plan —
          $39 for 800 credits per month. Presenters are original AI characters, not real people;
          follow each platform&rsquo;s rules on disclosing AI-generated content.
        </p>
        <div className="mt-6 flex justify-center">
          <CTA href="#pricing" size="md">
            See plans <ArrowRight size={16} />
          </CTA>
        </div>
      </div>
    </section>
  );
}

/** The engine band: VIBVID's brand is built on Seedance 2.0 — say it loudly. */
function SeedanceBand() {
  const points = [
    {
      title: "Cinematic motion",
      body: "Physics, camera moves and light that hold up shot after shot — footage that reads as filmed, not generated.",
    },
    {
      title: "Native audio",
      body: "Dialogue, ambience and sound effects are generated with the picture. No dubbing pass, no silent clips.",
    },
    {
      title: "Native 4K",
      body: "Not an upscale. The 4K tier renders every pixel at full resolution — the ceiling of AI video today.",
    },
  ];
  return (
    <section id="seedance" className="border-y border-line bg-surface-2/40">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logos/bytedance.svg" alt="ByteDance" className="h-5 w-5" />
              <span className="text-[12px] font-semibold uppercase tracking-[0.16em] text-faint">
                The engine
              </span>
            </div>
            <h2 className="font-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Seedance 2.0
            </h2>
            <p className="mt-3 text-[16px] leading-relaxed text-muted">
              The go-to AI video model — built by ByteDance, the company behind TikTok. VIBVID
              runs it in three tiers: <strong className="font-semibold text-fg">Mini</strong> for
              fast drafts, <strong className="font-semibold text-fg">Pro</strong> for cinematic
              1080p, and native <strong className="font-semibold text-fg">4K</strong> — with
              Seedream drawing your storyboards, characters and stills on the same stack.
              It&rsquo;s why the ads above read as filmed, not generated.
            </p>
            <div className="mt-5 inline-flex flex-wrap items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-medium text-muted">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo-square.png" alt="VIBVID" className="h-4 w-4 rounded-[4px]" />
              <span className="font-semibold text-fg">VIBVID</span>
              <span className="text-faint">running</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logos/bytedance.svg" alt="ByteDance" className="h-4 w-4" />
              <span className="font-semibold text-fg">Seedance 2.0</span>
              <span className="text-faint">by ByteDance</span>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {points.map((p) => (
              <div key={p.title} className="rounded-2xl border border-line bg-surface p-5">
                <div className="text-[15px] font-semibold text-fg">{p.title}</div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

const FEATURES = [
  {
    icon: LayoutGrid,
    title: "Board it",
    body: "Give the Storyboard your product and the idea — it writes the commercial scene by scene, sized to your video length, and draws all nine key frames as one sheet.",
  },
  {
    icon: UserRound,
    title: "Cast it",
    body: "Turn a selfie or a description into a reusable character — every angle in one sheet, an optional voice — so the same face carries across every scene.",
  },
  {
    icon: Clapperboard,
    title: "Shoot it",
    body: "Generate each scene with your characters, products and references. Draft for pennies to iterate, then produce in 1080p or native 4K with audio.",
  },
  {
    icon: Film,
    title: "Own it",
    body: "Every video lands in My Videos with its full production record — the prompt and every reference that made it — ready to download, remix and publish.",
  },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">There&rsquo;s a whole studio underneath</h2>
        <p className="mt-3 text-[17px] text-muted">
          UGC ads are one workflow. The same studio storyboards, casts and shoots anything —
          product films, explainers, brand spots, whole seasons.
        </p>
      </div>
      <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-[var(--radius-xl2)] border border-line bg-surface p-6 shadow-[0_1px_2px_rgba(16,18,27,0.04),0_10px_26px_-18px_rgba(16,18,27,0.14)]">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-soft text-accent-2">
              <f.icon size={20} />
            </span>
            <h3 className="mt-4 text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-[14px] leading-relaxed text-muted">{f.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  { n: "1", icon: LayoutGrid, title: "Pick a style", body: "Ten proven 15-second formats — the front-seat review, the bus whisper, the mirror routine. Each is a complete shooting script rendered in a real place." },
  { n: "2", icon: Wand2, title: "Make it yours", body: "Swap in your product from a few photos, design your presenter, and write two spoken lines — the opener and the closer. The direction, setting and rhythm stay proven." },
  { n: "3", icon: Download, title: "Render and post", body: "Generate in 9:16 with native audio. Draft a variation cheaply to test the hook, produce the winner in HD, and post it to TikTok, Reels or Shorts." },
];

function Steps() {
  return (
    <section id="how" className="border-y border-line bg-surface-2/40">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">From style to posted ad in three steps</h2>
          <p className="mt-3 text-[17px] text-muted">No briefs. No shoots. No waiting on a creator&rsquo;s calendar.</p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="relative rounded-[var(--radius-xl2)] border border-line bg-surface p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-white">{s.n}</span>
                <s.icon size={20} className="text-accent-2" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{s.body}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex justify-center">
          <CTA href="/app/ugc" size="md">
            Start with a style <ArrowRight size={16} />
          </CTA>
        </div>
      </div>
    </section>
  );
}

/* --------------------------- Element band ------------------------------- */
/* Three slow marquee rows of the studio element catalog — every tile is real
   Seedream output, the same engine subscribers get. */

const BAND_ROWS: { classes: AssetClass[]; duration: string; reverse?: boolean }[] = [
  { classes: ["character", "dress"], duration: "72s" },
  { classes: ["scene", "product"], duration: "88s", reverse: true },
  { classes: ["dance", "audio"], duration: "80s" },
];

function ElementTile({ e }: { e: StudioElement }) {
  return (
    <figure className="relative h-32 w-32 shrink-0 overflow-hidden rounded-2xl border border-line bg-surface sm:h-40 sm:w-40">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={thumbFor(e.id)} alt={e.name} loading="lazy" className="h-full w-full object-cover" />
      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/35 to-transparent px-2.5 pb-2 pt-7">
        <span className="block truncate text-[12px] font-semibold text-white">{e.name}</span>
        <span className="block text-[10px] font-medium uppercase tracking-wider text-white/70">
          {CLASS_BY_KEY[e.class].label}
        </span>
      </figcaption>
    </figure>
  );
}

function MarqueeRow({ classes, duration, reverse }: (typeof BAND_ROWS)[number]) {
  const items = classes.flatMap((c) => elementsByClass(c));
  return (
    <div className="marquee-row overflow-hidden">
      <div
        className={cn("marquee-track flex w-max", reverse && "marquee-reverse")}
        style={{ "--marquee-dur": duration } as CSSProperties}
      >
        {[0, 1].map((copy) => (
          <div key={copy} aria-hidden={copy === 1} className="flex shrink-0 gap-3 pr-3 sm:gap-4 sm:pr-4">
            {items.map((e) => (
              <ElementTile key={`${copy}-${e.id}`} e={e} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function ElementBand() {
  return (
    <section id="elements" className="overflow-hidden py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            A back lot full of elements
          </h2>
          <p className="mt-3 text-[17px] text-muted">
            Characters, wardrobe, sets, dances, products and scores — every tile below was generated
            with the engine you get. Pick them in the Studio, or bring your own.
          </p>
        </div>
      </div>
      <div className="relative mt-12 space-y-3 sm:space-y-4">
        {BAND_ROWS.map((row) => (
          <MarqueeRow key={row.classes.join("-")} {...row} />
        ))}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-bg to-transparent sm:w-24" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-bg to-transparent sm:w-24" />
      </div>
    </section>
  );
}

/** The media block of a demo card: real clip when generated, styled placeholder otherwise. */
export function DemoMedia({ d }: { d: DemoItem }) {
  const src = generatedSrc(d.id);
  const vertical = d.aspect === "9:16";
  return (
    <div
      className={cn("relative w-full overflow-hidden", vertical ? "aspect-[3/4]" : "aspect-video")}
      style={{ background: `linear-gradient(135deg, ${d.accent}22, ${d.accent}08 60%, transparent)` }}
    >
      {src ? (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={src} autoPlay muted loop playsInline className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2">
          <span
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-white"
            style={{ backgroundColor: d.accent }}
          >
            <Clapperboard size={22} />
          </span>
          <span className="text-[12px] font-medium text-muted">{d.aspect} · VIBVID</span>
        </div>
      )}
      <span className="absolute left-2.5 top-2.5">
        <Badge tone="neutral" className="border-white/20 bg-black/55 text-white backdrop-blur-sm">
          {d.tag}
        </Badge>
      </span>
    </div>
  );
}

export function DemoCard({ d }: { d: DemoItem }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-[var(--radius-xl2)] border border-line bg-surface">
      <DemoMedia d={d} />
      <div className="flex flex-1 flex-col p-4">
        <h3 className="text-[15px] font-semibold">{d.title}</h3>
        <p className="mt-2 flex-1 rounded-xl border border-line bg-surface-2 p-2.5 text-[12.5px] leading-relaxed text-muted">
          “{d.prompt}”
        </p>
        <Link
          href={`/app/make?purpose=${d.purpose}&prompt=${encodeURIComponent(d.prompt)}`}
          className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent-2 transition-colors hover:text-accent"
        >
          <Wand2 size={14} /> Try this prompt <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}

/** A commercial use case: flagship demo media + buyer/pain framing + two paths in. */
export function UseCaseCard({ u }: { u: UseCase }) {
  const demo = heroDemo(u);
  return (
    <div className="flex flex-col overflow-hidden rounded-[var(--radius-xl2)] border border-line bg-surface">
      <DemoMedia d={demo} />
      <div className="flex flex-1 flex-col p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-accent-2">{u.buyer}</div>
        <h3 className="mt-1 text-[15px] font-semibold">{u.label}</h3>
        <p className="mt-1 text-[13px] leading-relaxed text-muted">{u.pain}</p>
        <p className="mt-2.5 flex-1 rounded-xl border border-line bg-surface-2 p-2.5 text-[12.5px] leading-relaxed text-muted">
          “{demo.prompt}”
        </p>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
          <Link
            href={`/app/make?purpose=${u.purposeId}&prompt=${encodeURIComponent(demo.prompt)}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent-2 transition-colors hover:text-accent"
          >
            <Wand2 size={14} /> Try this prompt
          </Link>
          <Link
            href={`/use-cases/${u.slug}`}
            className="inline-flex items-center gap-1 text-[13px] font-medium text-muted transition-colors hover:text-fg"
          >
            Learn more <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  );
}

function UseCases() {
  return (
    <section id="usecases" className="border-y border-line bg-surface-2/40">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            What teams ship with VIBVID
          </h2>
          <p className="mt-3 text-[17px] text-muted">
            Ads, explainers, training, courses, comms, onboarding — real prompts from real
            workflows. Tap one to open it in the studio, or read the playbook.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {USE_CASES.map((u) => (
            <UseCaseCard key={u.slug} u={u} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CharacterConsistency() {
  const c = CONSISTENT_CHARACTER;
  return (
    <section id="characters" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <Badge tone="accent" className="mb-3">Your presenter</Badge>
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Cast a presenter once. Same face in every ad.
        </h2>
        <p className="mt-3 text-[17px] text-muted">
          Audiences trust a familiar face — and the hardest part of AI video is keeping one.
          Create your presenter once and VIBVID locks their identity, so the person fronting your
          car-seat ad this week fronts your kitchen ad next month.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr] lg:items-start">
        {/* The character sheet */}
        <div className="rounded-[var(--radius-xl2)] border border-line bg-surface p-4 lg:sticky lg:top-24">
          <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-line-2 bg-surface-2">
            <MediaTile m={c} />
            <span className="absolute left-2.5 top-2.5">
              <Badge tone="neutral" className="border-white/20 bg-black/55 text-white backdrop-blur-sm">
                <UserRound size={11} className="mr-1 inline" /> Presenter sheet
              </Badge>
            </span>
          </div>
          <div className="mt-3.5 px-1">
            <div className="flex items-center gap-2">
              <h3 className="text-[15px] font-semibold">{c.name}</h3>
              <span className="text-[13px] text-faint">· {c.role}</span>
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{c.blurb}</p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {["Locked identity", "Every angle", "Optional voice"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full border border-line-2 bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">
                  <Check size={10} className="text-teal" /> {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* The same face, many videos */}
        <div>
          <div className="mb-3 flex items-center gap-2 text-[13px] font-medium text-faint">
            <Repeat size={14} className="text-accent-2" />
            The same presenter, cast into six different ad styles
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {CHARACTER_SCENES.map((m) => (
              <div
                key={m.id}
                className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-line bg-surface-2"
              >
                <MediaTile m={m} className="transition-transform duration-500 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
                {/* the consistent-identity chip pins the same face to every card */}
                <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full border border-white/15 bg-black/50 px-2 py-0.5 text-[10px] font-semibold text-white/90 backdrop-blur-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" /> {c.name}
                </span>
                <div className="absolute bottom-2 left-2.5 right-2.5">
                  <span className="block text-[10px] font-medium uppercase tracking-wide text-white/60">{m.tag}</span>
                  <span className="flex items-center gap-1 text-[12.5px] font-semibold text-white">
                    {m.type === "video" && <Play size={11} fill="white" />} {m.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 rounded-2xl border border-line bg-surface-2/60 p-4 text-[13px] leading-relaxed text-muted">
            <span className="font-semibold text-fg">How it works: </span>
            open <span className="font-medium text-fg">Characters</span>, create {c.name} from a selfie or
            a description, then cast them into any UGC style or{" "}
            <span className="font-medium text-fg">Studio</span> shot. The same presenter carries
            every ad your brand runs — a face your audience starts to recognise.
          </div>
        </div>
      </div>
    </section>
  );
}

const LONGFORM_STEPS = [
  { icon: Clapperboard, label: "Scene", body: "One 4–15s shot with native audio." },
  { icon: Film, label: "Episode", body: "Generate scene after scene from one storyboard — same cast, same world." },
  { icon: Tv, label: "Season", body: "Chain episodes with the same cast and world." },
];

function LongForm() {
  return (
    <section id="longform" className="border-y border-line bg-surface-2/40">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Badge tone="accent" className="mb-3">Long-form</Badge>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Not just a clip — a whole season
          </h2>
          <p className="mt-3 text-[17px] text-muted">
            Scenes ladder up into episodes, and episodes into a season or a feature. Board the arc,
            reuse your cast, and generate every scene to match — then cut them together in any editor.
          </p>
        </div>

        {/* scene → episode → season ladder */}
        <div className="mt-12 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
          {LONGFORM_STEPS.map((s, i) => (
            <div key={s.label} className="flex items-center gap-3 sm:flex-col sm:gap-3">
              <div className="flex flex-1 items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 sm:flex-col sm:px-6 sm:py-5 sm:text-center">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-2">
                  <s.icon size={19} />
                </span>
                <span>
                  <span className="block text-[15px] font-semibold">{s.label}</span>
                  <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{s.body}</span>
                </span>
              </div>
              {i < LONGFORM_STEPS.length - 1 && (
                <ArrowRight size={18} className="mx-auto shrink-0 rotate-90 text-faint sm:rotate-0" />
              )}
            </div>
          ))}
        </div>

        {/* the season, laid out as episodes */}
        <div className="mt-10 rounded-[var(--radius-xl2)] border border-line bg-surface p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[13px] font-semibold text-fg">
              <Tv size={15} className="text-accent-2" /> Neon Samurai · Season 1
            </div>
            <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-faint">
              <Clock size={12} /> 9:45 · 33 scenes
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {SEASON.map((ep) => (
              <div key={ep.n} className="overflow-hidden rounded-2xl border border-line bg-surface-2">
                <div className="relative aspect-video overflow-hidden bg-black">
                  <MediaTile m={ep.media} />
                  <span className="absolute left-2 top-2 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {ep.n}
                  </span>
                  <span className="absolute bottom-2 right-2 rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm">
                    {ep.runtime}
                  </span>
                </div>
                <div className="p-3">
                  <h3 className="text-[14px] font-semibold">{ep.title}</h3>
                  <p className="mt-0.5 text-[12px] text-faint">{ep.scenes}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 flex flex-col items-start justify-between gap-3 border-t border-line pt-5 sm:flex-row sm:items-center">
            <p className="max-w-xl text-[13px] leading-relaxed text-muted">
              <span className="font-semibold text-fg">Make a full movie the same way</span> — board the
              acts as storyboards, generate every scene in the Studio with a consistent cast, then cut
              the whole runtime together into one continuous film.
            </p>
            <CTA href="/app" size="md" className="shrink-0">
              <Clapperboard size={16} /> Start your season
            </CTA>
          </div>
        </div>
      </div>
    </section>
  );
}

const RESPONSIBLE_DONTS = [
  "Deceptive impersonation or unauthorized likenesses of real people",
  "Face swaps, deepfakes or voice impersonation",
  "Misleading testimonials or fabricated endorsements",
  "Content that infringes another person’s intellectual-property or privacy rights",
];

function ResponsibleAI() {
  return (
    <section id="responsible" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="rounded-[24px] border border-line bg-surface p-7 sm:p-10">
        <div className="grid gap-8 lg:grid-cols-2 lg:items-center">
          <div>
            <Badge tone="accent" className="mb-3">Responsible AI</Badge>
            <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
              Built for original, authorized creation
            </h2>
            <p className="mt-3 text-[16px] leading-relaxed text-muted">
              VIBVID is designed for original and authorized content — your own ideas, fictional
              characters you build, and materials you own or have permission to use. It is not a tool
              for impersonating real people or copying someone else’s work.
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["Original content", "Authorized likenesses", "Rights you own"].map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1.5 rounded-full border border-line-2 bg-surface-2 px-3 py-1 text-[12px] font-medium text-muted"
                >
                  <ShieldCheck size={12} className="text-teal" /> {t}
                </span>
              ))}
            </div>
            <Link
              href="/acceptable-use"
              className="mt-6 inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent-2 transition-colors hover:text-accent"
            >
              Read the Acceptable Use Policy <ArrowRight size={14} />
            </Link>
          </div>
          <div className="rounded-2xl border border-line bg-surface-2/60 p-5 sm:p-6">
            <div className="mb-3.5 text-[12px] font-semibold uppercase tracking-wider text-faint">
              Not permitted on VIBVID
            </div>
            <ul className="space-y-3">
              {RESPONSIBLE_DONTS.map((d) => (
                <li key={d} className="flex items-start gap-2.5 text-[13.5px] leading-relaxed text-fg">
                  <Ban size={15} className="mt-0.5 shrink-0 text-accent-2" /> {d}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

function Showcase() {
  return (
    <section id="showcase" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <Badge tone="accent" className="mb-3">Made with VIBVID</Badge>
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Output that looks the part</h2>
        <p className="mt-3 text-[17px] text-muted">Video and images generated in seconds — every one ready to drop into your campaign.</p>
      </div>
      <div className="mt-12 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        {SHOWCASE.map((m, i) => (
          <div
            key={m.id}
            className={cn(
              "group relative overflow-hidden rounded-2xl border border-line bg-surface-2",
              i % 5 === 0 ? "col-span-2 aspect-video" : "aspect-square",
            )}
          >
            <MediaTile m={m} className="transition-transform duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
            <div className="absolute bottom-2.5 left-3 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="block text-[11px] font-medium text-white/70">{m.tag}</span>
              <span className="flex items-center gap-1 text-sm font-semibold text-white">
                {m.type === "video" && <Play size={12} fill="white" />} {m.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

type Plan = {
  name: string;
  price: string;
  period: string;
  headline: string;
  credits: string;
  blurb: string;
  popular: boolean;
  perks: string[];
  cta: string;
  /** Billing catalog id — the CTA jumps straight into checkout. */
  itemId: string;
  /** Annual offer (8× the monthly price — 4 months on us). */
  yearPrice: string;
};

const PLANS: Plan[] = [
  {
    name: "Creator",
    price: "$19",
    period: "/ mo",
    headline: "≈ 3 Full-HD clips (5s each) / mo",
    credits: "300",
    blurb: "For individual creators.",
    popular: false,
    perks: [
      "300 credits / month",
      "All models — drafts to native 4K",
      "No watermark",
      "Commercial usage rights",
      "Upgrade or cancel anytime",
    ],
    cta: "Get Creator",
    itemId: "plan-creator",
    yearPrice: "$152",
  },
  {
    name: "Pro",
    price: "$39",
    period: "/ mo",
    headline: "≈ 8 Full-HD clips (5s each) / mo",
    credits: "800",
    blurb: "For businesses & marketers.",
    popular: true,
    perks: [
      "800 credits / month",
      "Everything in Creator",
      "Room for 10–15s productions",
      "Annual: 9,600 credits up front",
    ],
    cta: "Get Pro",
    itemId: "plan-pro",
    yearPrice: "$312",
  },
  {
    name: "Agency",
    price: "$69",
    period: "/ mo",
    headline: "≈ 16 Full-HD clips (5s each) / mo",
    credits: "1,500",
    blurb: "For agencies & content teams.",
    popular: false,
    perks: [
      "1,500 credits / month",
      "Everything in Pro",
      "Volume for daily content output",
      "Annual: 18,000 credits up front",
    ],
    cta: "Get Agency",
    itemId: "plan-agency",
    yearPrice: "$552",
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="border-b border-line bg-surface-2/40">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Badge tone="accent" className="mb-3">Pricing</Badge>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Simple plans. Scale on credits.</h2>
          <p className="mt-3 text-[17px] text-muted">
            Every plan is a monthly credit budget — draft cheaply, produce in full quality, and
            upgrade whenever you need more. Pay for the year and get 4 months on us. No surprise
            bills, no lock-in.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={cn(
                "relative flex flex-col rounded-[var(--radius-xl2)] border bg-surface p-6",
                p.popular ? "border-accent/60 shadow-[0_20px_50px_-24px_rgba(236,19,32,0.55)]" : "border-line",
              )}
            >
              {p.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge tone="accent">Most popular</Badge>
                </span>
              )}
              <div className="text-sm font-semibold text-muted">{p.name}</div>
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-4xl font-bold tracking-tight">{p.price}</span>
                <span className="text-sm text-faint">{p.period}</span>
              </div>
              <p className="mt-1 text-[13px] text-faint">{p.blurb}</p>

              <div className="mt-5 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5">
                <div className="text-[15px] font-semibold text-fg">{p.headline}</div>
                <div className="mt-0.5 text-[12px] text-faint">{p.credits} credits{p.period ? " / month" : ""}</div>
              </div>

              <ul className="mt-4 flex-1 space-y-2.5 border-t border-line pt-4">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2.5 text-[13px] text-fg">
                    <Check size={15} className="mt-0.5 shrink-0 text-teal" /> {perk}
                  </li>
                ))}
              </ul>
              <CTA
                href={`/app?buy=${p.itemId}`}
                variant={p.popular ? "primary" : "outline"}
                size="md"
                className="mt-6 w-full"
              >
                {p.cta}
              </CTA>
              <Link
                href={`/app?buy=${p.itemId}-year`}
                className="mt-2.5 text-center text-[12.5px] font-medium text-accent-2 hover:underline"
              >
                or {p.yearPrice}/yr — 4 months on us
              </Link>
            </div>
          ))}
        </div>

        {/* Business — contact sales */}
        <div className="mt-5 flex flex-col items-center justify-between gap-4 rounded-[var(--radius-xl2)] border border-line bg-surface px-6 py-5 sm:flex-row">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[15px] font-semibold">Business</span>
              <Badge tone="neutral">From $299 / mo</Badge>
            </div>
            <p className="mt-1 text-[13px] text-muted">
              Custom credit volumes, API access, priority support and onboarding for high-volume teams.
            </p>
          </div>
          <CTA href="mailto:support@vibvid.ai?subject=VIBVID%20Business%20plan" variant="outline" size="md" className="shrink-0">
            Contact sales <ArrowRight size={16} />
          </CTA>
        </div>

        <p className="mt-6 text-center text-[13px] text-faint">
          Run out of credits early? Upgrade your plan from inside the studio — the higher budget
          applies right away. Otherwise your credits refresh at the next billing cycle.
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-center text-[12px] leading-relaxed text-faint">
          Generation credits are non-transferable service-usage units. They have no cash value and
          cannot be exchanged, transferred or resold.
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-center text-[12px] leading-relaxed text-faint">
          Plans are billed in US dollars — monthly, or yearly with 4 months on us — and renew
          automatically until you cancel — cancel anytime from your account. The price you see is
          the total you pay: no taxes or extra fees are added at checkout. Card payments and
          subscriptions are processed securely by our payment processor, {COMPANY.paymentProcessor}. See our{" "}
          <Link href="/refunds" className="underline hover:text-fg">Refund &amp; Cancellation Policy</Link>{" "}
          and{" "}
          <Link href="/terms" className="underline hover:text-fg">Terms</Link>.
        </p>
      </div>
    </section>
  );
}

const FAQS = [
  {
    q: "Do AI UGC ads actually look real?",
    a: "Judge for yourself — every example in the style library on this page is an unedited render. The styles are directed like real creator videos: handheld phone framing, real settings, imperfect motion, native audio. The presenters are original AI characters, not real people — VIBVID never impersonates anyone, and you should follow each platform's rules on labelling AI-generated content.",
  },
  {
    q: "Can the ad show my actual product?",
    a: "Yes. Add your product in the Products studio from a few photos and it gets a reference sheet that steers every scene — the serum in the ad is your serum, with your label, not a lookalike.",
  },
  {
    q: "How fast can I get my first ad?",
    a: "Minutes. Pick a style, swap in your product, presenter and two spoken lines, and generate — each render takes about 30–90 seconds. Most people go from sign-up to a finished, postable 15-second vertical ad in their first session.",
  },
  {
    q: "How many ads does my plan cover?",
    a: "A 15-second ad is 135 credits in 720p HD or 270 in Full-HD 1080p. That's about 2 ads a month on Creator, 5 on Pro and 11 on Agency in HD — half that in Full HD. Drafts cost ~45 credits, so test variations cheaply before producing the winner. Credits also cover everything else the studio makes.",
  },
  {
    q: "What model powers VIBVID?",
    a: "Seedance 2.0, by ByteDance — the go-to AI video model, known for cinematic motion, native audio and native 4K. VIBVID runs it in three tiers (Mini, Pro, 4K) and pairs it with Seedream for storyboards, characters and stills, so your whole production runs on one state-of-the-art stack.",
  },
  {
    q: "Can I upload my own reference materials?",
    a: "Yes — pictures, clips, sound and scripts. You must own those materials or have the rights and permissions to use them. Don't upload other people's copyrighted work, or anyone's likeness or voice, without authorization.",
  },
  {
    q: "How do credits work?",
    a: "Everything you generate spends credits, and quality is part of the price — a standard image is ~3 credits, a 5-second Draft clip ~15, a 5-second 720p HD render ~45, and a 5-second 1080p Full-HD render (native audio) ~90; native 4K is the top tier at ~200. Plans refill monthly (Creator 300, Pro 800, Agency 1,500) and reset each cycle; annual billing deposits the full year of credits up front. Run out early? Upgrade your plan and the bigger budget applies right away — otherwise credits refresh at your next billing cycle.",
  },
  {
    q: "Do I own what I make, and can I use it commercially?",
    a: "Everything you generate lands in your private library, stored on your account, ready to download. Commercial use is available on all paid plans, subject to the VIBVID Terms of Service and any rights attached to materials you upload.",
  },
  {
    q: "Can I keep the same presenter across all my ads?",
    a: "Yes — that's what Characters is for. Create one from a selfie or a description and you get a single reference sheet with every angle of them, plus an optional voice. Cast them in the Studio and the engine keeps their identity consistent from video to video.",
  },
  {
    q: "Can I create videos of real people?",
    a: "VIBVID is for original and authorized creation only. It does not permit deceptive impersonation, unauthorized use of a real person's likeness, face swaps, deepfakes, voice impersonation or misleading testimonials. A character built from your own selfie is fine; someone else's face or voice without their permission is not. See the Acceptable Use Policy for the full list.",
  },
];

export function FAQ({ items = FAQS }: { items?: { q: string; a: string }[] }) {
  return (
    <section id="faq" className="border-t border-line bg-surface-2/40">
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Questions, answered</h2>
        </div>
        <div className="mt-10 space-y-3">
          {items.map((f) => (
            <details
              key={f.q}
              className="group rounded-2xl border border-line bg-surface p-5 open:border-accent/40"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold text-fg">
                {f.q}
                <ChevronDown
                  size={17}
                  className="shrink-0 text-faint transition-transform group-open:rotate-180"
                />
              </summary>
              <p className="mt-3 text-[14px] leading-relaxed text-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function Support() {
  return (
    <section id="support" className="border-t border-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_minmax(0,480px)] lg:items-start">
        <div>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Stuck on something? Talk to us.
          </h2>
          <p className="mt-4 max-w-md text-[15.5px] leading-relaxed text-muted">
            Billing, a render that came out wrong, a plan question — raise a ticket and a human
            reads it. We reply to your email, usually within a day. Signed-in creators can also
            track their tickets under Support inside the app.
          </p>
        </div>
        <div className="rounded-[20px] border border-line bg-surface p-6 shadow-sm">
          <SupportForm />
        </div>
      </div>
    </section>
  );
}

function FinalCTA() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="relative overflow-hidden rounded-[24px] border border-accent/30 bg-gradient-to-br from-[#ec1320] via-[#d40e1a] to-[#ff5a2c] px-6 py-14 text-center text-white shadow-[0_30px_80px_-30px_rgba(236,19,32,0.7)]">
        {/* soft play-triangle watermark */}
        <svg
          viewBox="0 0 100 100"
          aria-hidden
          className="pointer-events-none absolute -right-6 -top-8 h-48 w-48 text-white/10"
        >
          <path d="M32 22 L78 50 L32 78 Z" fill="currentColor" />
        </svg>
        <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Your first ad is one style away.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[16px] text-white/85">
          Pick a style, swap in your product, and post a finished UGC ad today — plans from
          $19/month, 4 months on us when billed yearly, cancel anytime.
        </p>
        <div className="mt-7 flex justify-center">
          <Link
            href="/app/ugc"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-7 text-[15px] font-semibold text-accent transition-transform hover:scale-[1.02]"
          >
            <Sparkles size={18} /> Make your first UGC ad
          </Link>
        </div>
      </div>
    </section>
  );
}

const FOOTER_COLS: { heading: string; links: { label: string; href: string }[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "UGC styles", href: "/#styles" },
      { label: "How it works", href: "/#how" },
      { label: "Compare", href: "/#compare" },
      { label: "Your presenter", href: "/#characters" },
      { label: "Pricing", href: "/pricing" },
      { label: "Make your first ad", href: "/app/ugc" },
    ],
  },
  {
    heading: "Use cases",
    links: [
      ...USE_CASES.map((u) => ({ label: u.label, href: `/use-cases/${u.slug}` })),
      { label: "All use cases", href: "/use-cases" },
    ],
  },
  {
    heading: "Explore",
    links: [
      { label: "Responsible AI", href: "/#responsible" },
      { label: "FAQ", href: "/#faq" },
      { label: "Support", href: "/#support" },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-surface-2/30">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid grid-cols-2 gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr_1fr] max-md:[&>*:first-child]:col-span-2">
          {/* Brand + contact */}
          <div className="max-w-sm">
            <Brand />
            <p className="mt-4 text-[13.5px] leading-relaxed text-faint">
              The AI UGC ad studio. Pick a proven style, swap in your product and presenter, and
              render vertical ads with native audio — plus a full video studio underneath, up to
              native 4K.
            </p>
            <div className="mt-5 flex flex-col gap-2.5">
              <a
                href={`mailto:${COMPANY.supportEmail}`}
                className="inline-flex items-center gap-2 text-[13px] text-muted transition-colors hover:text-fg"
              >
                <Mail size={14} className="text-accent-2" /> {COMPANY.supportEmail}
              </a>
              <span className="inline-flex items-center gap-2 text-[13px] text-faint">
                <MapPin size={14} className="text-accent-2" /> Operated under the laws of {COMPANY.jurisdiction}.
              </span>
              <span className="inline-flex items-center gap-2 text-[13px] text-faint">
                <ShieldCheck size={14} className="text-teal" /> Secure payments by {COMPANY.paymentProcessor}
              </span>
            </div>
          </div>

          {/* Link columns */}
          {FOOTER_COLS.map((col) => (
            <div key={col.heading} className="flex flex-col gap-2.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">{col.heading}</span>
              {col.links.map((l) => (
                <Link key={l.href} href={l.href} className="text-sm text-muted transition-colors hover:text-fg">
                  {l.label}
                </Link>
              ))}
            </div>
          ))}

          <div className="flex flex-col gap-2.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">Legal</span>
            {LEGAL_LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="text-sm text-muted transition-colors hover:text-fg">
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col gap-4 border-t border-line pt-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[13px] text-faint">© {year} {COMPANY.legalName}. All rights reserved.</p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px] text-faint">
              <Link href="/terms" className="transition-colors hover:text-fg">Terms</Link>
              <Link href="/privacy" className="transition-colors hover:text-fg">Privacy</Link>
              <Link href="/refunds" className="transition-colors hover:text-fg">Refunds</Link>
              <a href={`mailto:${COMPANY.supportEmail}`} className="transition-colors hover:text-fg">Contact</a>
            </div>
          </div>
          <p className="max-w-3xl text-[12px] leading-relaxed text-faint">
            Card payments and subscriptions are processed securely by our payment processor,{" "}
            {COMPANY.paymentProcessor}; we never store your card details. Prices are shown in US dollars,
            total at checkout. Generation credits are non-transferable service-usage units with no cash
            value. VIBVID.AI is a creation tool for original and authorized content only — see the{" "}
            <Link href="/acceptable-use" className="underline hover:text-fg">Acceptable Use Policy</Link>.
          </p>
        </div>
      </div>
    </footer>
  );
}

export function Landing() {
  return (
    <div className="min-h-screen">
      <Header />
      <main>
        <Hero />
        <UgcStyleLibrary />
        <Steps />
        <UgcEconomics />
        <CharacterConsistency />
        <Pricing />
        <ResponsibleAI />
        <FAQ />
        <Support />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
