"use client";

// UGC Ads — its own world. The heart is the STYLE LIBRARY: ten real
// 15-second UGC ads we actually generated (a car, the bus, a kitchen, a
// bathroom mirror…), each with its full recipe. Tap "Copy this style" and
// the ad's direction, setting and rhythm carry over while you swap in YOUR
// product, YOUR presenter (a saved character or a described one) and YOUR
// spoken lines — then the clip renders right here on the Seedance tier you
// pick. Product ads only for now — app and screen formats come later.

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  Coins,
  Loader2,
  MapPin,
  Megaphone,
  Package,
  Play,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cloudConfigured } from "@/lib/supabase";
import { getModel, videoRate } from "@/lib/models";
import { generatedSrc } from "@/lib/demo-content";
import { UGC_STYLES, type UgcStyle, type UgcStyleInputs } from "@/lib/ugc-templates";
import type { Asset } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge, Button, Card, Progress } from "@/components/ui";

const textareaCls =
  "w-full resize-none rounded-xl border border-line bg-surface-2 p-3 text-base leading-relaxed text-fg placeholder:text-faint focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 sm:text-sm";
const inputCls =
  "h-10 w-full rounded-xl border border-line bg-surface-2 px-3 text-sm text-fg placeholder:text-faint focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20";

type UgcTier = "mini" | "pro" | "4k";
const TIERS: Record<UgcTier, { label: string; modelId: string; resolution: string }> = {
  mini: { label: "Mini · 720p", modelId: "seedance-2-mini", resolution: "720p" },
  pro: { label: "Pro · 1080p", modelId: "seedance-2-pro", resolution: "1080p" },
  "4k": { label: "4K", modelId: "seedance-2-pro", resolution: "4K" },
};

/** Public https photos of a product composite. */
function productPhotoUrls(p: Asset): string[] {
  return (p.parts ?? [])
    .filter((x) => x.kind === "image" && /^https:\/\//i.test(x.url))
    .map((x) => x.url)
    .slice(0, 3);
}

export function UgcStudio() {
  const router = useRouter();
  const assets = useStore((s) => s.assets);
  const videos = useStore((s) => s.videos);
  const credits = useStore((s) => s.credits);
  const hydrated = useStore((s) => s.hasHydrated);
  const generate = useStore((s) => s.generate);
  const cloudUser = useStore((s) => s.cloudUser);
  const subscribed = useStore((s) => s.subscribed);
  const setAuthOpen = useStore((s) => s.setAuthOpen);

  /** The chosen library style — null shows the library. */
  const [styleId, setStyleId] = useState<string | null>(null);
  /** Which library card is playing inline. */
  const [playingId, setPlayingId] = useState<string | null>(null);
  // Builder inputs — blank fields fall back to the style's demo values.
  const [productId, setProductId] = useState<string | null>(null);
  const [presenterId, setPresenterId] = useState<string | null>(null);
  const [presenterDesc, setPresenterDesc] = useState("");
  const [productName, setProductName] = useState("");
  const [benefit, setBenefit] = useState("");
  const [openLine, setOpenLine] = useState("");
  const [closeLine, setCloseLine] = useState("");
  const [script, setScript] = useState("");
  /** The last auto-composed script — a mismatch means the creator hand-edited. */
  const lastAuto = useRef("");
  const [tier, setTier] = useState<UgcTier>("pro");
  const [jobId, setJobId] = useState<string | null>(null);

  const products = useMemo(
    () => assets.filter((a) => a.class === "product" && (a.parts?.length ?? 0) > 0),
    [assets],
  );
  const characters = useMemo(
    () => assets.filter((a) => a.class === "character" && (a.parts?.length ?? 0) > 0),
    [assets],
  );
  const byId = useMemo(() => Object.fromEntries(assets.map((a) => [a.id, a])), [assets]);
  const needsSignIn = cloudConfigured && !cloudUser;
  const locked = cloudConfigured && subscribed === false;

  const style = styleId ? UGC_STYLES.find((s) => s.id === styleId) ?? null : null;
  const product = productId ? byId[productId] : null;
  const presenter = presenterId ? byId[presenterId] : null;

  const durationSec = style?.durationSec ?? 15;
  const model = getModel(TIERS[tier].modelId);
  const cost = videoRate(model, TIERS[tier].resolution) * durationSec;
  const canAfford = credits >= cost;

  const job = jobId ? videos.find((v) => v.id === jobId) ?? null : null;
  const rendering = job?.status === "rendering";
  const videoUrl = job?.status === "succeeded" ? job.videoUrl ?? null : null;

  /** The builder's effective inputs — blanks fall back to the style's originals. */
  function styleInputs(s: UgcStyle): UgcStyleInputs {
    return {
      product: productName.trim() || product?.name || s.demo.product,
      benefit: benefit.trim() || s.demo.benefit,
      presenter:
        (presenter ? `${presenter.name} — exactly the person in the attached character sheet` : "") ||
        presenterDesc.trim() ||
        s.demo.presenter,
      open: openLine.trim() || s.demo.open,
      close: closeLine.trim() || s.demo.close,
    };
  }

  const autoScript = style ? style.script(styleInputs(style)) : "";
  const scriptEdited = script !== "" && script !== lastAuto.current;
  const effectiveScript = scriptEdited ? script : autoScript;
  if (!scriptEdited && script !== autoScript && style) {
    // Keep the visible textarea in lockstep with input changes.
    lastAuto.current = autoScript;
    if (script !== autoScript) setScript(autoScript);
  }

  function copyStyle(s: UgcStyle) {
    setStyleId(s.id);
    setPlayingId(null);
    setScript("");
    lastAuto.current = "";
    setOpenLine("");
    setCloseLine("");
    setBenefit("");
    // Keep any already-picked product/presenter — that's the point of copying.
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /** References + legend in the exact order Seedance receives them. */
  function buildReferences(): { urls: string[]; legend: string[] } {
    const urls: string[] = [];
    const legend: string[] = [];
    const slot = () => `Image ${urls.length}`;
    if (presenter && /^https:\/\//i.test(presenter.url)) {
      urls.push(presenter.url);
      legend.push(
        `${slot()} is the character sheet of "${presenter.name}" — this exact person is the creator on camera; copy the face, hair and build exactly.`,
      );
    }
    if (product) {
      for (const u of productPhotoUrls(product)) {
        urls.push(u);
        legend.push(
          `${slot()} shows the product "${product.name}" — reproduce this exact product, its shape, colors, materials and label; do not redesign it.`,
        );
      }
    }
    return { urls: urls.slice(0, 9), legend };
  }

  function onGenerate() {
    const text = effectiveScript;
    if (rendering || !text.trim()) return;
    if (needsSignIn) {
      setAuthOpen(true);
      return;
    }
    if (locked) {
      useStore.getState().blockIfLocked();
      return;
    }
    if (!canAfford) return;
    const { urls, legend } = buildReferences();
    const t = TIERS[tier];
    const label = `UGC — ${style?.name ?? "ad"} — ${productName.trim() || product?.name || style?.demo.product || "ad"}`;
    const id = generate({
      prompt: legend.length ? `${legend.join(" ")}\n\n${text}` : text,
      tier: "standard",
      durationSec,
      aspectRatio: "9:16",
      audio: true,
      modelId: t.modelId,
      modality: "video",
      elements: [presenterId, productId].filter(Boolean) as string[],
      direction: label,
      posterUrl: product?.posterUrl,
      resolution: t.resolution,
      refImageUrls: urls.length ? urls : undefined,
    });
    setJobId(id);
  }

  const needsMedia = !product && !productName.trim();
  const canGenerate = hydrated && effectiveScript.trim().length > 0 && canAfford && !needsMedia;

  /* --------------------------------- UI --------------------------------- */

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">UGC Ads</h1>
        <p className="mt-1 text-sm text-muted">
          Ten real ads, ten real places — a car, the bus, a kitchen counter. Copy a style, swap in
          your product, your presenter and your lines, and shoot it.
        </p>
      </header>

      {/* ============================ PRODUCT WORLD ============================ */}
      {!style && (
        <>
          <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-faint">
            The style library — real ads, real places. Copy one.
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {UGC_STYLES.map((s) => {
              const src = generatedSrc(s.id);
              const playing = playingId === s.id;
              return (
                <Card key={s.id} className="group flex flex-col overflow-hidden">
                  <div className="relative aspect-[9/16] bg-surface-2">
                    {src ? (
                      playing ? (
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        <video src={src} autoPlay controls playsInline className="h-full w-full object-cover" />
                      ) : (
                        <button className="h-full w-full" onClick={() => setPlayingId(s.id)} aria-label={`Play ${s.name}`}>
                          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                          <video src={src} muted playsInline preload="metadata" className="h-full w-full object-cover" />
                          <span className="absolute inset-0 flex items-center justify-center">
                            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-transform group-hover:scale-110">
                              <Play size={16} className="ml-0.5" />
                            </span>
                          </span>
                        </button>
                      )
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-2 p-3 text-center">
                        <Megaphone size={18} className="text-faint" />
                        <span className="text-[10.5px] text-faint">Example rendering…</span>
                      </div>
                    )}
                    <span className="pointer-events-none absolute left-1.5 top-1.5">
                      <Badge tone="neutral" className="border-white/20 bg-black/55 text-white backdrop-blur-sm">
                        <MapPin size={9} /> {s.setting}
                      </Badge>
                    </span>
                  </div>
                  <div className="flex flex-1 flex-col p-2.5">
                    <div className="text-[12.5px] font-semibold leading-tight">{s.name}</div>
                    <div className="mt-0.5 text-[11px] text-faint">{s.demo.product} · {s.durationSec}s</div>
                    <Button size="sm" className="mt-auto w-full pt-0.5" onClick={() => copyStyle(s)}>
                      Copy this style
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      {style && (
        <>
          <button
            onClick={() => {
              setStyleId(null);
              setScript("");
              lastAuto.current = "";
            }}
            className="mb-4 flex items-center gap-1 text-[13px] font-medium text-muted transition-colors hover:text-fg"
          >
            <ArrowLeft size={14} /> All styles
          </button>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,420px)_1fr]">
            {/* ------------------------------ Builder ----------------------------- */}
            <Card className="h-fit p-5">
              <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-2">
                <Megaphone size={14} /> {style.name}
              </div>
              <div className="mb-3 flex items-center gap-1.5 text-[12px] text-faint">
                <MapPin size={11} /> {style.setting} · {style.durationSec}s · 9:16
              </div>

              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-faint">
                Your product
              </label>
              {products.length === 0 ? (
                <button
                  onClick={() => router.push("/app/products")}
                  className="flex w-full items-center gap-2 rounded-xl border border-dashed border-line-2 px-3 py-2 text-left text-[12.5px] text-muted transition-colors hover:border-accent/50 hover:text-fg"
                >
                  <Package size={14} className="text-accent-2" /> Save a product — its photos keep the ad exact
                </button>
              ) : (
                <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                  {products.map((p) => {
                    const on = productId === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => {
                          setProductId(on ? null : p.id);
                          if (!on && !productName.trim()) setProductName(p.name);
                        }}
                        className={cn(
                          "flex shrink-0 items-center gap-2 rounded-xl border py-1.5 pl-1.5 pr-3 text-[12px] font-medium transition-colors",
                          on ? "border-accent bg-accent-soft text-fg" : "border-line text-muted hover:border-line-2",
                        )}
                      >
                        <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                          {p.posterUrl || p.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={p.posterUrl ?? p.url} alt={p.name} className="h-full w-full object-cover" />
                          ) : (
                            <Package size={14} className="m-auto text-faint" />
                          )}
                          {on && (
                            <span className="absolute inset-0 flex items-center justify-center bg-accent/70 text-white">
                              <Check size={13} />
                            </span>
                          )}
                        </span>
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              )}
              <input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder={style.demo.product}
                className={`${inputCls} mt-2`}
              />

              <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">
                The presenter
              </label>
              {characters.length > 0 && (
                <div className="-mx-1 mb-2 flex gap-2 overflow-x-auto px-1 pb-1">
                  {characters.map((c) => {
                    const on = presenterId === c.id;
                    return (
                      <button
                        key={c.id}
                        onClick={() => setPresenterId(on ? null : c.id)}
                        className={cn(
                          "flex shrink-0 items-center gap-2 rounded-xl border py-1.5 pl-1.5 pr-3 text-[12px] font-medium transition-colors",
                          on ? "border-accent bg-accent-soft text-fg" : "border-line text-muted hover:border-line-2",
                        )}
                      >
                        <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-surface-2">
                          {c.posterUrl || c.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={c.posterUrl ?? c.url} alt={c.name} className="h-full w-full object-cover" />
                          ) : (
                            <UserRound size={14} className="m-auto text-faint" />
                          )}
                          {on && (
                            <span className="absolute inset-0 flex items-center justify-center bg-accent/70 text-white">
                              <Check size={13} />
                            </span>
                          )}
                        </span>
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              )}
              {!presenter && (
                <input
                  value={presenterDesc}
                  onChange={(e) => setPresenterDesc(e.target.value)}
                  placeholder={style.demo.presenter}
                  className={inputCls}
                />
              )}
              {presenter && (
                <p className="text-[11.5px] text-faint">
                  {presenter.name}&rsquo;s character sheet rides along — same face in every ad.
                </p>
              )}

              <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">
                The benefit
              </label>
              <input
                value={benefit}
                onChange={(e) => setBenefit(e.target.value)}
                placeholder={style.demo.benefit}
                className={inputCls}
              />

              <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">
                What they say <span className="normal-case">(opening & closing lines)</span>
              </label>
              <input
                value={openLine}
                onChange={(e) => setOpenLine(e.target.value)}
                placeholder={style.demo.open}
                className={inputCls}
              />
              <input
                value={closeLine}
                onChange={(e) => setCloseLine(e.target.value)}
                placeholder={style.demo.close}
                className={`${inputCls} mt-2`}
              />

              <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">
                Renders on
              </label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(TIERS) as UgcTier[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTier(t)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-[12px] font-medium transition-colors",
                      tier === t ? "border-accent bg-accent-soft text-fg" : "border-line text-muted hover:border-line-2",
                    )}
                  >
                    Seedance 2.0 {TIERS[t].label}
                  </button>
                ))}
              </div>
            </Card>

            {/* --------------------------- Script + clip --------------------------- */}
            <div className="space-y-4">
              <Card className="p-5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-2">
                    <Megaphone size={14} /> The shooting script
                  </div>
                  <span className="flex items-center gap-1.5">
                    {scriptEdited && (
                      <button
                        onClick={() => {
                          setScript("");
                          lastAuto.current = "";
                        }}
                        className="text-[11px] font-medium text-accent-2 hover:underline"
                      >
                        Reset to the style
                      </button>
                    )}
                    <Badge tone="neutral">9:16 · {style.durationSec}s</Badge>
                  </span>
                </div>
                <textarea
                  value={effectiveScript}
                  onChange={(e) => setScript(e.target.value)}
                  rows={14}
                  className={textareaCls}
                />
                <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-sm">
                  <span className="text-muted">Cost</span>
                  <span className="flex items-center gap-1.5 font-semibold">
                    <Coins size={15} className="text-warn" /> {cost} credits
                  </span>
                </div>
                {needsSignIn ? (
                  <Button size="lg" className="mt-3 w-full" onClick={() => setAuthOpen(true)}>
                    <Sparkles size={17} /> Sign in to generate
                  </Button>
                ) : (
                  <Button
                    size="lg"
                    className="mt-3 w-full"
                    disabled={rendering || (!locked && !canGenerate)}
                    onClick={onGenerate}
                  >
                    {rendering ? (
                      <>
                        <Loader2 size={17} className="animate-spin" /> Shooting the ad…
                      </>
                    ) : locked ? (
                      <>
                        <Sparkles size={17} /> Subscribe to generate
                      </>
                    ) : videoUrl ? (
                      <>
                        <Sparkles size={17} /> Shoot a variant
                      </>
                    ) : (
                      <>
                        <Sparkles size={17} /> Shoot my version
                      </>
                    )}
                  </Button>
                )}
                {needsMedia && (
                  <p className="mt-2 text-center text-xs text-faint">
                    Pick a saved product (or at least type its name) so the ad shows the real thing.
                  </p>
                )}
                {hydrated && !needsSignIn && !locked && !canAfford && (
                  <p className="mt-2 text-center text-xs text-danger">
                    Not enough credits — you need {cost - credits} more.
                  </p>
                )}
              </Card>

              {job && (
                <Card className="overflow-hidden">
                  {rendering ? (
                    <div className="shimmer flex aspect-[9/16] max-h-[480px] w-full flex-col items-center justify-center bg-surface-2">
                      <Loader2 size={20} className="animate-spin text-accent-2" />
                      <div className="mt-3 w-32">
                        <Progress value={job.progress} />
                      </div>
                      <span className="mt-2 text-[11px] text-faint">Shooting your UGC ad…</span>
                    </div>
                  ) : videoUrl ? (
                    <div className="p-3">
                      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                      <video
                        src={videoUrl}
                        poster={job.posterUrl ?? undefined}
                        controls
                        playsInline
                        className="mx-auto max-h-[480px] rounded-xl border border-line"
                      />
                      <p className="mt-2 text-center text-[12px] text-faint">
                        Saved to My Videos with its full production record.
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 text-center text-sm text-danger">{job.error ?? "The ad failed — try again."}</div>
                  )}
                </Card>
              )}
            </div>
          </div>
        </>
      )}

    </div>
  );
}
