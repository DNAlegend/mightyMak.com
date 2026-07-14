import Link from "next/link";
import type { ReactNode } from "react";
import {
  Sparkles,
  ArrowRight,
  Check,
  ChevronDown,
  Wand2,
  Layers,
  Clapperboard,
  Lightbulb,
  UserRound,
  Scissors,
  Film,
  Download,
  Play,
  Repeat,
  Tv,
  Clock,
  ShieldCheck,
  Ban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui";
import { LogoWordmark } from "@/components/logo";
import { MobileNav } from "@/components/marketing/mobile-nav";
import {
  HERO,
  HERO_CHIPS,
  SHOWCASE,
  CONSISTENT_CHARACTER,
  CHARACTER_SCENES,
  SEASON,
  type ShowcaseMedia,
} from "@/lib/showcase";
import { DEMO_CONTENT, generatedSrc, type DemoItem } from "@/lib/demo-content";
import { LEGAL_LINKS, COMPANY } from "@/components/legal/legal-page";

const APP = "/app";

/* ------------------------------ Primitives ------------------------------ */

function CTA({
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
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Brand />
        <nav className="hidden items-center gap-7 text-sm font-medium text-muted md:flex">
          <a href="/#features" className="transition-colors hover:text-fg">Features</a>
          <a href="/#characters" className="transition-colors hover:text-fg">Characters</a>
          <a href="/#longform" className="transition-colors hover:text-fg">Seasons</a>
          <a href="/#usecases" className="transition-colors hover:text-fg">Use cases</a>
          <a href="/pricing" className="transition-colors hover:text-fg">Pricing</a>
        </nav>
        <div className="flex items-center gap-2">
          <CTA href={APP} variant="soft" size="md" className="hidden sm:inline-flex">Sign in</CTA>
          <CTA href={APP} size="md">Get started</CTA>
          <MobileNav appHref={APP} />
        </div>
      </div>
    </header>
  );
}

/** Concrete capability pills shown under the hero CTAs. */
const HERO_PILLS = [
  "Shot-by-shot planning",
  "Consistent characters",
  "Native audio",
  "1080p export",
];

/** Scene thumbnails for the hero timeline — real generated media when available. */
const HERO_TIMELINE = SHOWCASE.slice(0, 4);

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* brand-red glow backdrop */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 480px at 50% -12%, rgba(236,19,32,0.15), transparent 62%), radial-gradient(680px 380px at 88% 18%, rgba(255,90,44,0.10), transparent 55%)",
        }}
      />
      {/* faint studio grid */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-[0.5]"
        style={{
          maskImage: "radial-gradient(680px 360px at 50% 8%, #000, transparent 75%)",
          WebkitMaskImage: "radial-gradient(680px 360px at 50% 8%, #000, transparent 75%)",
          backgroundImage:
            "linear-gradient(to right, rgba(16,16,20,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(16,16,20,0.05) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-16 text-center sm:px-6 sm:pt-24">
        <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-accent/25 bg-accent-soft px-3 py-1 text-[12px] font-semibold text-accent-2">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-70" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
          </span>
          Powered by our own VIBVID engine
        </div>
        <h1 className="font-display mx-auto mt-5 max-w-4xl text-4xl font-bold leading-[1.05] tracking-tight sm:text-[58px]">
          Not just clips.
          <br className="hidden sm:block" /> <span className="gradient-text">Finished video productions.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-muted">
          Brief the Strategist and it writes your shot list. Cast consistent characters,
          generate every scene, then cut them into one finished video — draft cheaply, produce
          in full 1080p with native audio. One studio, from idea to export.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <CTA href={APP}>
            <Sparkles size={18} /> Start creating free
          </CTA>
          <CTA href="#how" variant="outline">
            See how it works <ArrowRight size={16} />
          </CTA>
        </div>
        <p className="mt-3 text-[13px] text-faint">Free to start · paid plans from $19/month · cancel anytime</p>

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

        {/* Hero visual — a real cut coming together in the studio */}
        <div className="relative mx-auto mt-12 max-w-4xl">
          <div className="overflow-hidden rounded-[22px] border border-line-2 bg-surface shadow-[0_40px_100px_-35px_rgba(16,18,27,0.5)]">
            {/* studio window chrome */}
            <div className="flex items-center gap-2 border-b border-line bg-surface-2/70 px-4 py-2.5">
              <span className="flex gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              </span>
              <span className="ml-2 flex items-center gap-1.5 text-[12px] font-medium text-muted">
                <Clapperboard size={13} className="text-accent-2" /> VIBVID Studio — Post
              </span>
              <span className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-accent px-2.5 py-1 text-[11px] font-semibold text-white">
                <Download size={12} /> Export cut
              </span>
            </div>
            {/* the finished scene, playing */}
            <div className="relative aspect-video w-full bg-black">
              <MediaTile m={HERO} />
              <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white/85 backdrop-blur-md">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" /> Scene 2 · the reveal
              </span>
              <div className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white/85 backdrop-blur-md">
                1080p · native audio
              </div>
            </div>
            {/* the timeline — four scenes stitched into one cut */}
            <div className="border-t border-line bg-surface-2/50 px-3 py-3 sm:px-4">
              <div className="mb-2 flex items-center justify-between text-[11px] font-medium text-faint">
                <span className="inline-flex items-center gap-1.5">
                  <Film size={12} className="text-accent-2" /> 4 scenes stitched into one cut
                </span>
                <span>0:18</span>
              </div>
              <div className="grid grid-cols-4 gap-2">
                {HERO_TIMELINE.map((m, i) => (
                  <div
                    key={m.id}
                    className={cn(
                      "relative aspect-video overflow-hidden rounded-lg border",
                      i === 1 ? "border-accent ring-1 ring-accent/40" : "border-line-2",
                    )}
                  >
                    <MediaTile m={m} />
                    <span className="absolute left-1 top-1 rounded bg-black/55 px-1.5 py-0.5 text-[9px] font-semibold text-white/90">
                      {i + 1}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* floating cast chips */}
          <div className="absolute -left-3 top-16 hidden rotate-[-6deg] sm:block">
            <FloatChip m={HERO_CHIPS[0]} />
          </div>
          <div className="absolute -right-4 top-28 hidden rotate-[5deg] sm:block">
            <FloatChip m={HERO_CHIPS[1]} />
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

function ModelBand() {
  const items = ["Vib Production", "Vib Draft", "The Strategist", "The Director", "+ more soon"];
  return (
    <section className="border-y border-line bg-surface-2/50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-6 py-5">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-faint">The VIBVID engine</span>
        {items.map((i) => (
          <span key={i} className="text-sm font-medium text-muted">{i}</span>
        ))}
      </div>
    </section>
  );
}

const FEATURES = [
  {
    icon: Lightbulb,
    title: "Plan it",
    body: "Tell the Strategist your goal — “a launch video that goes viral for my brand” — and get a shot-by-shot blueprint, timed to the second and ready to shoot.",
  },
  {
    icon: UserRound,
    title: "Cast it",
    body: "Turn a selfie or a description into a reusable character — every angle in one sheet, an optional voice — so the same face carries across every scene.",
  },
  {
    icon: Clapperboard,
    title: "Shoot it",
    body: "Generate each scene with your characters, products and references. Draft for pennies to iterate, then produce in full 1080p with native audio.",
  },
  {
    icon: Scissors,
    title: "Cut it",
    body: "Line your shots up on the timeline, play them as one piece, regenerate any scene, then export the whole thing as a single finished video.",
  },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">One studio, the whole production</h2>
        <p className="mt-3 text-[17px] text-muted">From brief to a finished, exportable video — plan, cast, shoot and cut in one place.</p>
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
  { n: "1", icon: Lightbulb, title: "Plan", body: "Brief the Strategist and pick a length — it writes the whole video, beat by beat. Send it to Make when it reads right." },
  { n: "2", icon: Layers, title: "Cast & collect", body: "Create characters, and drop your product shots, clips, sound and scripts into Assets — the raw material of every shot." },
  { n: "3", icon: Wand2, title: "Make", body: "Add references, pick Draft or Production quality, and generate each scene. Everything lands in My Videos, ready to review." },
  { n: "4", icon: Scissors, title: "Cut & export", body: "Stitch your shots on the timeline in Post, regenerate any scene, then download one finished video ready to publish." },
];

function Steps() {
  return (
    <section id="how" className="border-y border-line bg-surface-2/40">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">From idea to a finished cut in four steps</h2>
          <p className="mt-3 text-[17px] text-muted">Simple enough for a first-timer, deep enough for a real production.</p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
      </div>
    </section>
  );
}

function DemoCard({ d }: { d: DemoItem }) {
  const src = generatedSrc(d.id);
  const vertical = d.aspect === "9:16";
  return (
    <div className="flex flex-col overflow-hidden rounded-[var(--radius-xl2)] border border-line bg-surface">
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

function UseCases() {
  return (
    <section id="usecases" className="border-y border-line bg-surface-2/40">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Every format, one prompt</h2>
          <p className="mt-3 text-[17px] text-muted">
            Vertical UGC ads, product films, fashion, brand spots — these are the exact prompts.
            Tap one to open it in the studio and make it yours.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {DEMO_CONTENT.map((d) => (
            <DemoCard key={d.id} d={d} />
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
        <Badge tone="accent" className="mb-3">Consistent characters</Badge>
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Cast once. Star them in every video.
        </h2>
        <p className="mt-3 text-[17px] text-muted">
          The hardest part of AI video is keeping a face the same twice. Create a character once and
          VIBVID locks their identity — so one cast member can carry a whole series of videos.
        </p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr] lg:items-start">
        {/* The character sheet */}
        <div className="rounded-[var(--radius-xl2)] border border-line bg-surface p-4 lg:sticky lg:top-24">
          <div className="relative aspect-[3/4] overflow-hidden rounded-2xl border border-line-2 bg-surface-2">
            <MediaTile m={c} />
            <span className="absolute left-2.5 top-2.5">
              <Badge tone="neutral" className="border-white/20 bg-black/55 text-white backdrop-blur-sm">
                <UserRound size={11} className="mr-1 inline" /> Character sheet
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
            The same character, generated into six different videos
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
            a description, then cast them into any shot in <span className="font-medium text-fg">Make</span>.
            Reuse the same character across unlimited videos — perfect for a recurring host, mascot, or
            series lead.
          </div>
        </div>
      </div>
    </section>
  );
}

const LONGFORM_STEPS = [
  { icon: Clapperboard, label: "Scene", body: "One 4–15s shot with native audio." },
  { icon: Film, label: "Episode", body: "Stitch scenes on the Post timeline into a full episode." },
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
            Scenes ladder up into episodes, and episodes into a season or a feature. Plan the arc,
            reuse your cast, and assemble everything into long-form video — all in one studio.
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
              <span className="font-semibold text-fg">Make a full movie the same way</span> — plan the
              acts in Plan, generate every scene in Make with a consistent cast, then assemble the whole
              runtime in Post and export one continuous film.
            </p>
            <CTA href={APP} size="md" className="shrink-0">
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
  aed?: string;
  period: string;
  headline: string;
  credits: string;
  blurb: string;
  popular: boolean;
  perks: string[];
  cta: string;
  /** Billing catalog id — the CTA jumps straight into checkout. */
  itemId?: string;
  /** For the free plan: go straight into the app instead of checkout. */
  href?: string;
};

const PLANS: Plan[] = [
  {
    name: "Free",
    price: "$0",
    period: "",
    headline: "20 credits to try",
    credits: "20",
    blurb: "Kick the tires — no card needed.",
    popular: false,
    perks: [
      "20 credits included",
      "Draft & Production models",
      "Output carries a small watermark",
      "Standard queue priority",
    ],
    cta: "Start free",
    href: APP,
  },
  {
    name: "Creator",
    price: "$19",
    aed: "AED 69",
    period: "/ mo",
    headline: "≈ 3 Full-HD clips (5s each) / mo",
    credits: "300",
    blurb: "For individual creators.",
    popular: false,
    perks: [
      "300 credits / month",
      "No watermark",
      "Commercial usage rights",
      "Full HD 1080p export",
      "Top up credits any time",
    ],
    cta: "Get Creator",
    itemId: "plan-creator",
  },
  {
    name: "Pro",
    price: "$49",
    aed: "AED 179",
    period: "/ mo",
    headline: "≈ 11 Full-HD clips (5s each) / mo",
    credits: "1,000",
    blurb: "For businesses & marketers.",
    popular: true,
    perks: [
      "1,000 credits / month",
      "Everything in Creator",
      "Native 4K export",
      "Faster generation",
    ],
    cta: "Get Pro",
    itemId: "plan-pro",
  },
  {
    name: "Agency",
    price: "$129",
    aed: "AED 475",
    period: "/ mo",
    headline: "≈ 33 Full-HD clips (5s each) / mo",
    credits: "3,000",
    blurb: "For agencies & content teams.",
    popular: false,
    perks: [
      "3,000 credits / month",
      "Everything in Pro",
      "Multiple brand workspaces",
      "Team access",
    ],
    cta: "Get Agency",
    itemId: "plan-agency",
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="border-b border-line bg-surface-2/40">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Badge tone="accent" className="mb-3">Pricing</Badge>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Start free. Scale on credits.</h2>
          <p className="mt-3 text-[17px] text-muted">
            Every plan is a monthly credit budget — draft cheaply, produce in full quality, and
            top up any time. No surprise bills, no lock-in.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
              <p className="mt-0.5 h-4 text-[12px] text-faint">{p.aed ?? " "}</p>
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
                href={p.href ?? `${APP}?buy=${p.itemId}`}
                variant={p.popular ? "primary" : "outline"}
                size="md"
                className="mt-6 w-full"
              >
                {p.cta}
              </CTA>
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
          <CTA href="mailto:sales@vibvid.ai?subject=VIBVID%20Business%20plan" variant="outline" size="md" className="shrink-0">
            Contact sales <ArrowRight size={16} />
          </CTA>
        </div>

        <p className="mt-6 text-center text-[13px] text-faint">
          Run out of credits? Buy top-up packs any time from inside the studio — from $15 for 200
          credits. Pack credits stay valid for 12 months.
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-center text-[12px] leading-relaxed text-faint">
          Generation credits are non-transferable service-usage units. They have no cash value and
          cannot be exchanged, transferred or resold.
        </p>
        <p className="mx-auto mt-3 max-w-2xl text-center text-[12px] leading-relaxed text-faint">
          Plans are billed monthly in US dollars and renew automatically until you cancel — cancel
          anytime from your account. The price you see is the total you pay: no taxes or extra fees
          are added at checkout. Card payments and subscriptions are processed securely by our
          payment processor, {COMPANY.paymentProcessor}. See our{" "}
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
    q: "What can I actually make?",
    a: "Full productions, not just single clips. The Strategist plans a multi-scene video, you generate each shot (4–15s, native audio) with our own VIBVID engine, then stitch them into one finished cut in Post — vertical UGC ads, product films, fashion, brand spots. Draft quality for fast iteration, up to full 1080p Production for the final export.",
  },
  {
    q: "How do my assets change the output?",
    a: "Add pictures, clips, sound and scripts to a shot and they steer it directly: images set the exact frames or act as identity references, clips lend their motion, and your character's sheet keeps the same face in every video — so the sneaker in your clip is your sneaker, not a lookalike.",
  },
  {
    q: "Can I upload my own reference materials?",
    a: "Yes — pictures, clips, sound and scripts. You must own those materials or have the rights and permissions to use them. Don't upload other people's copyrighted work, or anyone's likeness or voice, without authorization.",
  },
  {
    q: "How do credits work?",
    a: "Everything you generate spends credits, and quality is part of the price — a standard image is ~3 credits, a 5-second Draft clip ~15, a 5-second 720p HD render ~45, and a 5-second 1080p Full-HD render (native audio) ~90; native 4K is the top tier at ~200. Paid plans refill monthly (Creator 300, Pro 1,000, Agency 3,000) and reset each cycle; the Free tier includes 20 one-time credits to try the studio. Run out early? Buy a top-up pack any time — from $15 — and those stay valid for 12 months.",
  },
  {
    q: "Do I own what I make, and can I use it commercially?",
    a: "Everything you generate lands in your private library, stored on your account, ready to download. Commercial use is available on all paid plans, subject to the VIBVID Terms of Service and any rights attached to materials you upload.",
  },
  {
    q: "How long does a video take?",
    a: "Typically 30–90 seconds from prompt to finished clip. Images land in a few seconds.",
  },
  {
    q: "Can I keep the same character across videos?",
    a: "Yes — that's what Characters is for. Create one from a selfie or a description and you get a single reference sheet with every angle of them, plus an optional voice. Cast them in Make and the engine keeps their identity consistent from video to video.",
  },
  {
    q: "Can I create videos of real people?",
    a: "VIBVID is for original and authorized creation only. It does not permit deceptive impersonation, unauthorized use of a real person's likeness, face swaps, deepfakes, voice impersonation or misleading testimonials. A character built from your own selfie is fine; someone else's face or voice without their permission is not. See the Acceptable Use Policy for the full list.",
  },
  {
    q: "Can I make a full episode, season or movie?",
    a: "Yes. Each generation is a scene (4–15s); stitch scenes on the Post timeline into an episode, then chain episodes — reusing the same cast and world — into a season or a feature-length film. Plan the arc in Plan, generate every shot in Make, assemble the whole runtime in Post, and export it as one continuous video. There's no cap on length beyond your credits.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="border-t border-line bg-surface-2/40">
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Questions, answered</h2>
        </div>
        <div className="mt-10 space-y-3">
          {FAQS.map((f) => (
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
          Start producing today
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[16px] text-white/85">
          Spin up your studio in seconds — free to start, paid plans from $19/month, cancel anytime.
        </p>
        <div className="mt-7 flex justify-center">
          <Link
            href={APP}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-7 text-[15px] font-semibold text-accent transition-transform hover:scale-[1.02]"
          >
            <Sparkles size={18} /> Create your first video
          </Link>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xs">
            <Brand />
            <p className="mt-3 text-[13px] leading-relaxed text-faint">
              An AI video studio. Plan, cast, shoot and cut — from idea to a finished 1080p video.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-10 gap-y-2 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">Product</span>
              <a href="/#features" className="text-sm text-muted hover:text-fg">Features</a>
              <a href="/#how" className="text-sm text-muted hover:text-fg">How it works</a>
              <a href="/pricing" className="text-sm text-muted hover:text-fg">Pricing</a>
              <Link href={APP} className="text-sm text-muted hover:text-fg">Launch studio</Link>
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-faint">Legal</span>
              {LEGAL_LINKS.map((l) => (
                <Link key={l.href} href={l.href} className="text-sm text-muted hover:text-fg">
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-10 border-t border-line pt-6">
          <p className="text-[13px] leading-relaxed text-faint">
            © 2026 {COMPANY.legalName}. All rights reserved. Card payments and subscriptions are
            processed securely by our payment processor, {COMPANY.paymentProcessor}.
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
        <ModelBand />
        <Features />
        <Steps />
        <CharacterConsistency />
        <UseCases />
        <LongForm />
        <Showcase />
        <ResponsibleAI />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
