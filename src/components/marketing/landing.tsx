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
  Play,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui";
import { LogoWordmark } from "@/components/logo";
import { HERO, HERO_CHIPS, HERO_PROMPT, SHOWCASE, type ShowcaseMedia } from "@/lib/showcase";
import { DEMO_CONTENT, generatedSrc, type DemoItem } from "@/lib/demo-content";

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
    primary: "bg-accent text-white hover:bg-accent-2 shadow-[0_8px_24px_-8px_rgba(124,108,255,0.8)]",
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

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Brand />
        <nav className="hidden items-center gap-7 text-sm font-medium text-muted md:flex">
          <a href="#pricing" className="transition-colors hover:text-fg">Pricing</a>
          <a href="#features" className="transition-colors hover:text-fg">Features</a>
          <a href="#usecases" className="transition-colors hover:text-fg">Use cases</a>
          <a href="#showcase" className="transition-colors hover:text-fg">Showcase</a>
        </nav>
        <div className="flex items-center gap-2">
          <CTA href={APP} variant="soft" size="md" className="hidden sm:inline-flex">Sign in</CTA>
          <CTA href={APP} size="md">Get started</CTA>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* gradient backdrop */}
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(900px 480px at 50% -10%, rgba(124,108,255,0.14), transparent 60%), radial-gradient(700px 400px at 85% 20%, rgba(13,148,136,0.10), transparent 55%)",
        }}
      />
      <div className="mx-auto max-w-6xl px-4 pb-10 pt-16 text-center sm:px-6 sm:pt-24">
        <div className="mx-auto inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1 text-[12px] font-medium text-muted">
          <Sparkles size={13} className="text-accent-2" /> Powered by our own MightyMak engine
        </div>
        <h1 className="font-display mx-auto mt-5 max-w-4xl text-4xl font-bold leading-[1.07] tracking-tight sm:text-[56px]">
          Your AI video studio,
          <br className="hidden sm:block" /> <span className="gradient-text">one prompt away.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-muted">
          Plan the concept, cast your characters, and produce scroll-stopping video — cheap
          drafts to iterate, full 1080p with native audio when it counts. One studio, every
          video managed.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <CTA href={APP}>
            <Sparkles size={18} /> Start creating
          </CTA>
          <CTA href="#pricing" variant="outline">
            See plans &amp; pricing <ArrowRight size={16} />
          </CTA>
        </div>
        <p className="mt-3 text-[13px] text-faint">Plans from $15/month · cancel anytime</p>

        {/* Hero visual — the studio in action */}
        <div className="relative mx-auto mt-12 max-w-4xl">
          <div className="overflow-hidden rounded-[20px] border border-line-2 bg-surface shadow-[0_30px_80px_-30px_rgba(16,18,27,0.45)]">
            <div className="relative aspect-video w-full bg-black">
              <MediaTile m={HERO} />
              <div className="absolute right-3 top-3 rounded-full border border-white/15 bg-black/45 px-2.5 py-1 text-[11px] font-medium text-white/85 backdrop-blur-md">
                Mak Production · 1080p · 5s
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 sm:p-5">
                <div className="flex items-center gap-2.5 rounded-xl border border-white/15 bg-black/45 px-3.5 py-2.5 backdrop-blur-md">
                  <Wand2 size={15} className="shrink-0 text-white/60" />
                  <span className="truncate text-left text-[13px] text-white/85">{HERO_PROMPT}</span>
                  <span className="ml-auto hidden shrink-0 items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-[12px] font-semibold text-white sm:flex">
                    <Sparkles size={13} /> Generate
                  </span>
                </div>
              </div>
            </div>
          </div>
          {/* floating chips */}
          <div className="absolute -left-3 top-8 hidden rotate-[-6deg] sm:block">
            <FloatChip m={HERO_CHIPS[0]} />
          </div>
          <div className="absolute -right-4 top-24 hidden rotate-[5deg] sm:block">
            <FloatChip m={HERO_CHIPS[1]} />
          </div>
          <div className="absolute -bottom-5 left-1/3 hidden rotate-[3deg] md:block">
            <FloatChip m={HERO_CHIPS[2]} />
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
  const items = ["Mak Production", "Mak Draft", "The Strategist", "The Director", "+ more soon"];
  return (
    <section className="border-y border-line bg-surface-2/50">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-8 gap-y-3 px-6 py-5">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-faint">The MightyMak engine</span>
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
    body: "Tell the Strategist your goal — “a video that goes viral for my brand” — and get a detailed second-by-second blueprint, ready to shoot.",
  },
  {
    icon: UserRound,
    title: "Cast it",
    body: "Turn a selfie or a description into a full character sheet — every angle in one image, an optional voice — and reuse the same character in every video.",
  },
  {
    icon: Clapperboard,
    title: "Make it",
    body: "Draft takes for pennies, then produce in full 1080p with native audio. Every video lands in My Videos with its plan, prompt and references attached.",
  },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">One studio, the whole pipeline</h2>
        <p className="mt-3 text-[17px] text-muted">From brief to published video — plan, cast, make and manage in one place.</p>
      </div>
      <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
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
  { n: "1", icon: Lightbulb, title: "Plan", body: "Brief the Strategist and pick a length — it writes the whole video, beat by beat. Open the plan in Make when it reads right." },
  { n: "2", icon: Layers, title: "Cast & collect", body: "Create characters, and drop your product shots, clips, sound and scripts into Assets — the raw material of every shot." },
  { n: "3", icon: Wand2, title: "Make & publish", body: "Add references, pick Draft or Production quality, generate. Review in My Videos, remix what works, download and post." },
];

function Steps() {
  return (
    <section id="how" className="border-y border-line bg-surface-2/40">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">From idea to output in three steps</h2>
          <p className="mt-3 text-[17px] text-muted">Simple enough for a first-timer, deep enough for a real production.</p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-3">
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
            <span className="text-[12px] font-medium text-muted">{d.aspect} · MightyMak</span>
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
          href={`/app?purpose=${d.purpose}&prompt=${encodeURIComponent(d.prompt)}`}
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

function Showcase() {
  return (
    <section id="showcase" className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
      <div className="mx-auto max-w-2xl text-center">
        <Badge tone="accent" className="mb-3">Made with MightyMak</Badge>
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

const PLANS = [
  {
    name: "Basic",
    price: "$15",
    period: "/ month",
    headline: "≈ 5 pro videos / month",
    credits: "700",
    blurb: "Get started — a video a week, plus drafts.",
    popular: false,
    perks: [
      "≈ 5 production videos or 45 drafts",
      "Draft & Production models",
      "Up to 15s · 1080p · native audio",
      "Top up credits any time",
    ],
    cta: "Get Basic",
    /** Billing catalog id — the CTA jumps straight into checkout. */
    itemId: "plan-basic",
  },
  {
    name: "Creator",
    price: "$29",
    period: "/ month",
    headline: "≈ 12 pro videos / month",
    credits: "1,500",
    blurb: "For weekly publishing — the sweet spot.",
    popular: true,
    perks: [
      "≈ 12 production videos or 100 drafts",
      "Everything in Basic",
      "Plan → Make → My Videos workflow",
      "Priority rendering",
    ],
    cta: "Get Creator",
    itemId: "plan-creator",
  },
  {
    name: "Max",
    price: "$59",
    period: "/ month",
    headline: "≈ 26 pro videos / month",
    credits: "3,200",
    blurb: "For daily creators — lowest cost per video.",
    popular: false,
    perks: [
      "≈ 26 production videos every month",
      "Everything in Creator",
      "Best credit rate per dollar",
      "Priority rendering",
    ],
    cta: "Get Max",
    itemId: "plan-max",
  },
];

function Pricing() {
  return (
    <section id="pricing" className="border-b border-line bg-surface-2/40">
      <div className="mx-auto max-w-5xl px-4 py-20 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <Badge tone="accent" className="mb-3">Pricing</Badge>
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Simple pricing, in US dollars</h2>
          <p className="mt-3 text-[17px] text-muted">
            Three plans, one workflow — draft cheaply, produce in full quality, top up credits
            whenever you need more.
          </p>
        </div>
        <div className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={cn(
                "relative flex flex-col rounded-[var(--radius-xl2)] border bg-surface p-6",
                p.popular ? "border-accent/50 shadow-[0_20px_50px_-24px_rgba(124,108,255,0.6)]" : "border-line",
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
                <div className="mt-0.5 text-[12px] text-faint">{p.credits} credits / month</div>
              </div>

              <ul className="mt-4 flex-1 space-y-2.5 border-t border-line pt-4">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2.5 text-[13px] text-fg">
                    <Check size={15} className="mt-0.5 shrink-0 text-teal" /> {perk}
                  </li>
                ))}
              </ul>
              <CTA
                href={`${APP}?buy=${p.itemId}`}
                variant={p.popular ? "primary" : "outline"}
                size="md"
                className="mt-6 w-full"
              >
                {p.cta}
              </CTA>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-[13px] text-faint">
          Run out of credits? Buy more any time from inside the studio — packs from $6, no plan change needed.
        </p>
      </div>
    </section>
  );
}

const FAQS = [
  {
    q: "What can I actually generate?",
    a: "Real 4–15 second videos with native audio, rendered by our own MightyMak engine — vertical UGC ads, product films, fashion clips, brand spots. Draft quality for fast iteration, up to full 1080p Production quality for the final cut.",
  },
  {
    q: "How do my assets change the output?",
    a: "Add pictures, clips, sound and scripts to a shot and they steer it directly: images set the exact frames or act as identity references, clips lend their motion, and your character's sheet keeps the same face in every video — so the sneaker in your clip is your sneaker, not a lookalike.",
  },
  {
    q: "How do credits work?",
    a: "Every video costs credits, and quality is part of the price — a 5-second Draft take runs 15 credits, a full 1080p Production render 120. Plans refill monthly (Basic 700, Creator 1,500, Max 3,200). Run out before your refill? Buy a top-up pack any time from inside the studio — starting at $6.",
  },
  {
    q: "Do I own what I make?",
    a: "Yes. Everything you generate lands in your private library, stored on your account, ready to download and use in your campaigns.",
  },
  {
    q: "How long does a video take?",
    a: "Typically 30–90 seconds from prompt to finished clip. Images land in a few seconds.",
  },
  {
    q: "Can I keep the same character across videos?",
    a: "Yes — that's what Characters is for. Create one from a selfie or a description and you get a single reference sheet with every angle of them, plus an optional voice. Cast them in Make and the engine keeps their identity consistent from video to video.",
  },
];

function FAQ() {
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
      <div className="relative overflow-hidden rounded-[24px] border border-accent/30 bg-gradient-to-br from-accent via-[#8b5cf6] to-teal px-6 py-14 text-center text-white shadow-[0_30px_80px_-30px_rgba(124,108,255,0.7)]">
        <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Start producing today
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-[16px] text-white/85">
          Spin up your studio in seconds — plans from $15/month, cancel anytime.
        </p>
        <div className="mt-7 flex justify-center">
          <Link
            href={APP}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-7 text-[15px] font-semibold text-[#4c3ce0] transition-transform hover:scale-[1.02]"
          >
            <Sparkles size={18} /> Create your first video
          </Link>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
        <Brand />
        <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted">
          <a href="#features" className="hover:text-fg">Features</a>
          <a href="#how" className="hover:text-fg">How it works</a>
          <a href="#pricing" className="hover:text-fg">Pricing</a>
          <Link href={APP} className="hover:text-fg">Launch studio</Link>
        </nav>
        <p className="text-[13px] text-faint">© 2026 MightyMak</p>
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
        <Pricing />
        <Features />
        <Steps />
        <UseCases />
        <Showcase />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
