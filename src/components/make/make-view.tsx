"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  Loader2,
  Wand2,
  ChevronDown,
  X,
  Plus,
  Coins,
  Download,
  Bookmark,
  Check,
  ArrowRight,
  Layers,
  ImagePlus,
  Undo2,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cloudConfigured } from "@/lib/supabase";
import { getModel, listModels, priceFor, DEFAULT_MODEL_ID } from "@/lib/models";
import { ASSET_CLASSES, CLASS_BY_KEY, composeFromAssets } from "@/lib/catalog";
import { PURPOSES, PURPOSE_BY_ID, DEFAULT_PURPOSE_ID } from "@/lib/purposes";
import {
  ASPECT_RATIOS,
  DURATIONS,
  REF_IMAGE_LIMIT,
  TIERS,
  type AspectRatio,
  type Asset,
  type AssetClass,
  type Modality,
  type Tier,
} from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";
import { Button, Card, Badge, Segmented, Toggle, Modal } from "@/components/ui";
import { AssetThumb, ClassIcon, ModelPicker, ResultHero, CompositeBadge } from "@/components/shared";

type Picks = Partial<Record<AssetClass, string>>;

export function MakeView({ mode }: { mode?: Modality }) {
  const credits = useStore((s) => s.credits);
  const hydrated = useStore((s) => s.hasHydrated);
  const assets = useStore((s) => s.assets);
  const generate = useStore((s) => s.generate);
  const videos = useStore((s) => s.videos);
  const saveVideoToAssets = useStore((s) => s.saveVideoToAssets);
  const draftElements = useStore((s) => s.draftElements);
  const draftDirection = useStore((s) => s.draftDirection);
  const draftRefAssetId = useStore((s) => s.draftRefAssetId);
  const setDraftElements = useStore((s) => s.setDraftElements);
  const setDraftDirection = useStore((s) => s.setDraftDirection);
  const setDraftRef = useStore((s) => s.setDraftRef);

  const byId = useMemo(() => Object.fromEntries(assets.map((a) => [a.id, a])), [assets]);

  const initialPurpose = PURPOSE_BY_ID[mode === "image" ? "still" : DEFAULT_PURPOSE_ID];
  const [purposeId, setPurposeId] = useState<string>(initialPurpose.id);
  const [modality, setModality] = useState<Modality>(initialPurpose.modality);
  const [modelId, setModelId] = useState<string>(initialPurpose.modelId || DEFAULT_MODEL_ID);
  const [prompt, setPrompt] = useState("");
  const [picks, setPicks] = useState<Picks>({});
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(initialPurpose.aspectRatio);
  const [durationSec, setDurationSec] = useState<number>(initialPurpose.durationSec);
  const [tier, setTier] = useState<Tier>("standard");
  const [audio, setAudio] = useState(true);
  const [showAssets, setShowAssets] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [pickClass, setPickClass] = useState<AssetClass | null>(null);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState(false);
  const [directing, setDirecting] = useState(false);
  const [directorError, setDirectorError] = useState<string | null>(null);
  const [draftBackup, setDraftBackup] = useState<string | null>(null);
  const cloudUser = useStore((s) => s.cloudUser);
  const setAuthOpen = useStore((s) => s.setAuthOpen);
  const resultRef = useRef<HTMLDivElement>(null);
  // Real backend configured but visitor not signed in → route them to auth
  // instead of quietly simulating (a sample clip reads as broken generation).
  const needsSignIn = cloudConfigured && !cloudUser;

  // Consume drafts handed over from Assets ("Use in Make") or Library ("Remix").
  useEffect(() => {
    const seed: Picks = {};
    const place = (id: string) => {
      const a = byId[id];
      if (a?.class && !seed[a.class]) seed[a.class] = id;
    };
    if (draftRefAssetId) {
      place(draftRefAssetId);
      setDraftRef(null);
    }
    if (draftElements) {
      draftElements.forEach(place);
      setDraftElements(null);
    }
    if (draftDirection != null) {
      setPrompt(draftDirection);
      setDraftDirection(null);
    }
    if (Object.keys(seed).length) {
      setPicks((p) => ({ ...seed, ...p }));
      setShowAssets(true);
    }
    // Landing links arrive as ?purpose=…&prompt=… — preconfigure the studio.
    const params = new URLSearchParams(window.location.search);
    const linkedPurpose = params.get("purpose");
    if (
      linkedPurpose &&
      PURPOSE_BY_ID[linkedPurpose] &&
      (!mode || PURPOSE_BY_ID[linkedPurpose].modality === mode)
    ) {
      applyPurpose(linkedPurpose);
    }
    const linked = params.get("prompt");
    if (linked) setPrompt(linked);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyPurpose(id: string) {
    const p = PURPOSE_BY_ID[id];
    if (!p) return;
    setPurposeId(id);
    setModality(p.modality);
    setModelId(p.modelId);
    setAspectRatio(p.aspectRatio);
    setDurationSec(p.durationSec);
    if (id !== "custom") setShowAssets(true);
  }

  const purpose = PURPOSE_BY_ID[purposeId] ?? PURPOSE_BY_ID[DEFAULT_PURPOSE_ID];
  // Dedicated generator pages only offer purposes of their modality.
  const availablePurposes = PURPOSES.filter((p) => !mode || p.modality === mode);
  // Surface this purpose's asset classes first; the rest stay available.
  const orderedClasses = [
    ...purpose.classes,
    ...ASSET_CLASSES.map((c) => c.key).filter((k) => !purpose.classes.includes(k)),
  ];

  const heading =
    mode === "image"
      ? { kicker: "Image", h1: "Design your frame", sub: "Pick what you're making, type your idea, Generate." }
      : { kicker: "Video", h1: "Direct your shot", sub: "Pick what you're making, type your idea, Generate." };

  const model = getModel(modelId);
  const pickedAssets = ASSET_CLASSES.map((c) => picks[c.key])
    .filter(Boolean)
    .map((id) => byId[id as string])
    .filter(Boolean) as Asset[];

  // The typed prompt doubles as the director's note when assets are picked;
  // the purpose's style language is woven in at the end.
  const finalPrompt = useMemo(() => {
    const composed = composeFromAssets(pickedAssets, prompt);
    if (!composed || !purpose.styleSuffix) return composed;
    return `${composed} — ${purpose.styleSuffix}`;
  }, [pickedAssets, prompt, purpose.styleSuffix]);
  const cost = priceFor(model, { durationSec, count: 1, hasRefs: pickedAssets.length > 0 });
  const canAfford = credits >= cost;
  // `hydrated` also gates the brief window while a signed-in account's cloud
  // state is loading, so a spend can't race the authoritative balance.
  const canGenerate = hydrated && finalPrompt.trim().length > 0 && canAfford;
  const activeJob = videos.find((v) => v.id === activeJobId) ?? null;
  const rendering = activeJob?.status === "rendering";
  const pickedCount = pickedAssets.length;

  function switchModality(m: Modality) {
    // Flipping the toggle on the universal Make page re-anchors the purpose
    // so format and model stay coherent with the chosen modality.
    applyPurpose(m === "image" ? "still" : "custom");
  }

  function setPick(cls: AssetClass, id: string | null) {
    setPicks((p) => ({ ...p, [cls]: id ?? undefined }));
  }

  // Bring the render (and then the finished shot) into view.
  useEffect(() => {
    if (activeJob) resultRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [activeJob?.status === "succeeded", !!activeJob]); // eslint-disable-line react-hooks/exhaustive-deps

  // Every picked visual asset with a publicly reachable image can steer the
  // video (one = first frame, several = Seedance reference images).
  const refImageUrls =
    modality === "video"
      ? pickedAssets
          .filter(
            (a) =>
              a.kind === "image" &&
              (a.url.startsWith("https://") ||
                (a.url.startsWith("/") &&
                  typeof window !== "undefined" &&
                  window.location.protocol === "https:")),
          )
          .slice(0, REF_IMAGE_LIMIT)
          .map((a) => (a.url.startsWith("/") ? window.location.origin + a.url : a.url))
      : [];

  async function onDirect() {
    if (needsSignIn) {
      setAuthOpen(true);
      return;
    }
    const brief = prompt.trim();
    if (!brief || directing) return;
    setDirecting(true);
    setDirectorError(null);
    try {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token) throw new Error("Please sign in first");
      const res = await fetch("/api/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          brief,
          modality,
          purpose: purpose.id === "custom" ? null : `${purpose.label} — ${purpose.tagline}`,
          assets: pickedAssets.map((a) => a.promptFragment ?? a.name),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.prompt) throw new Error(data.error ?? "The Director is unavailable");
      setDraftBackup(brief);
      setPrompt(data.prompt);
    } catch (e) {
      setDirectorError(e instanceof Error ? e.message : "The Director is unavailable");
    } finally {
      setDirecting(false);
    }
  }

  function onGenerate() {
    if (!canGenerate || rendering) return;
    const scene = pickedAssets.find((a) => a.class === "scene");
    const posterUrl = (scene ?? pickedAssets[0])?.posterUrl ?? (scene ?? pickedAssets[0])?.url;
    const id = generate({
      prompt: finalPrompt,
      tier,
      durationSec,
      aspectRatio,
      audio,
      modelId,
      modality,
      elements: pickedAssets.map((a) => a.id),
      direction: prompt,
      posterUrl,
      refImageUrls: refImageUrls.length ? refImageUrls : undefined,
    });
    setActiveJobId(id);
    setSavedMsg(false);
  }

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-5 text-center">
        <div className="mb-1.5 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-2">
          <Sparkles size={14} /> {heading.kicker}
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{heading.h1}</h1>
        <p className="mt-1.5 text-sm text-muted">{heading.sub}</p>
      </header>

      {/* Purpose picker */}
      <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1.5">
        {availablePurposes.map((p) => (
          <button
            key={p.id}
            onClick={() => applyPurpose(p.id)}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors",
              purposeId === p.id
                ? "border-accent/60 bg-accent-soft"
                : "border-line bg-surface hover:border-line-2",
            )}
          >
            <span className="text-lg leading-none">{p.glyph}</span>
            <span>
              <span className="block text-[13px] font-semibold leading-tight text-fg">{p.label}</span>
              <span className="block text-[11px] leading-tight text-faint">{p.tagline}</span>
            </span>
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="p-5">
          {/* Prompt */}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={3}
            placeholder={purpose.placeholder}
            className="w-full resize-none rounded-xl border border-line bg-surface-2 p-3.5 text-[15px] leading-relaxed text-fg placeholder:text-faint focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />

          {/* The Director — any language in, pro English prompt out */}
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Button
              variant="soft"
              size="sm"
              disabled={directing || !prompt.trim()}
              onClick={onDirect}
              className="gap-1.5"
            >
              {directing ? (
                <>
                  <Loader2 size={14} className="animate-spin" /> Improving…
                </>
              ) : (
                <>
                  <Wand2 size={14} /> Improve prompt
                </>
              )}
            </Button>
            {draftBackup && draftBackup !== prompt && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1"
                onClick={() => {
                  setPrompt(draftBackup);
                  setDraftBackup(null);
                }}
              >
                <Undo2 size={13} /> Undo
              </Button>
            )}
            <span className="text-[11.5px] text-faint">Any language — عربي · 中文 · English</span>
          </div>
          {directorError && <p className="mt-1.5 text-xs text-danger">{directorError}</p>}

          {/* Try-this chips */}
          {!prompt && pickedCount === 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              <span className="flex items-center gap-1 text-[11px] font-medium text-faint">
                <Wand2 size={12} /> Try
              </span>
              {purpose.ideas.map((idea) => (
                <button
                  key={idea}
                  onClick={() => setPrompt(idea)}
                  className="rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] text-muted transition-colors hover:border-accent/40 hover:text-fg"
                >
                  {idea.length > 38 ? idea.slice(0, 38) + "…" : idea}
                </button>
              ))}
            </div>
          )}

          {/* Add assets (slot assembly) */}
          <div className="mt-4 border-t border-line pt-4">
            <button
              onClick={() => setShowAssets((v) => !v)}
              className="flex w-full items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-fg"
            >
              <ChevronDown size={15} className={cn("transition-transform", showAssets && "rotate-180")} />
              Add assets from your library
              {pickedCount > 0 && <Badge tone="accent" className="ml-1">{pickedCount}</Badge>}
            </button>

            {/* Collapsed summary chips */}
            {!showAssets && pickedCount > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {pickedAssets.map((a) => (
                  <span
                    key={a.id}
                    className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 py-1 pl-1 pr-2 text-[12px] text-fg"
                  >
                    <AssetThumb a={a} className="h-5 w-5 rounded-full" />
                    {a.name}
                    <button onClick={() => setPick(a.class as AssetClass, null)} className="rounded-full p-0.5 text-faint hover:text-fg">
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {showAssets && (
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {orderedClasses.map((key) => (
                  <SlotCard
                    key={key}
                    cls={key}
                    asset={picks[key] ? (byId[picks[key] as string] as Asset) : null}
                    onPick={() => setPickClass(key)}
                    onClear={() => setPick(key, null)}
                  />
                ))}
              </div>
            )}

            {modality === "video" && (showAssets || refImageUrls.length > 0) && (
              <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-faint">
                <ImagePlus size={13} className="shrink-0" />
                {refImageUrls.length > 0
                  ? `${refImageUrls.length} of ${REF_IMAGE_LIMIT} reference images attached`
                  : `1 image sets the first frame · up to ${REF_IMAGE_LIMIT} steer the look`}
              </p>
            )}

            {pickedCount > 0 && finalPrompt && (
              <div className="mt-3 rounded-xl border border-line bg-surface-2 p-3">
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-faint">
                  What the model will be told
                </div>
                <p className="text-[13px] leading-relaxed text-muted">{finalPrompt}</p>
              </div>
            )}
          </div>

          {/* Model & options (disclosed; the purpose already set sane defaults) */}
          <div className="mt-4 border-t border-line pt-4">
            <button
              onClick={() => setShowOptions((v) => !v)}
              className="flex w-full items-center gap-1.5 text-sm font-medium text-muted transition-colors hover:text-fg"
            >
              <ChevronDown size={15} className={cn("transition-transform", showOptions && "rotate-180")} /> Options
              <span className="ml-auto text-[12px] font-normal text-faint">
                {getModel(modelId).name} · {aspectRatio}
                {modality === "video" ? ` · ${durationSec}s` : ""}
              </span>
            </button>

            {showOptions && (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted">Model</label>
                  <ModelPicker
                    modality={modality}
                    modelId={modelId}
                    onModality={switchModality}
                    onModel={setModelId}
                    lockModality={!!mode}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted">Aspect</label>
                    <Segmented<AspectRatio>
                      value={aspectRatio}
                      onChange={setAspectRatio}
                      options={ASPECT_RATIOS.map((r) => ({ value: r, label: r }))}
                    />
                  </div>
                  {modality === "video" && (
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted">Duration</label>
                      <Segmented<number>
                        value={durationSec}
                        onChange={setDurationSec}
                        options={DURATIONS.map((d) => ({ value: d, label: `${d}s` }))}
                      />
                    </div>
                  )}
                </div>
                {modality === "video" && (
                  <>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-muted">Quality</label>
                      <Segmented<Tier>
                        value={tier}
                        onChange={setTier}
                        options={(Object.keys(TIERS) as Tier[]).map((t) => ({
                          value: t,
                          label: TIERS[t].label,
                          hint: `${TIERS[t].resolution} · ${TIERS[t].creditsPerSec}/s`,
                        }))}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-line bg-surface-2 px-3.5 py-2.5">
                      <span className="text-sm font-medium text-fg">Native audio</span>
                      <Toggle checked={audio} onChange={setAudio} />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Generate */}
          <div className="mt-5 border-t border-line pt-4">
            <div className="mb-3 flex items-center justify-between text-sm">
              <span className="text-muted">Estimated cost</span>
              <span className="flex items-center gap-1.5 font-semibold">
                <Coins size={15} className="text-warn" /> {cost} credits
              </span>
            </div>
            {needsSignIn ? (
              <Button size="lg" className="w-full" onClick={() => setAuthOpen(true)}>
                <Sparkles size={18} /> Sign in to generate
              </Button>
            ) : (
              <Button size="lg" className="w-full" disabled={!canGenerate || rendering} onClick={onGenerate}>
                {rendering ? (
                  <>
                    <Loader2 size={18} className="animate-spin" /> Generating…
                  </>
                ) : (
                  <>
                    <Sparkles size={18} /> Generate
                  </>
                )}
              </Button>
            )}
            {!needsSignIn && hydrated && !canAfford && (
              <p className="mt-2 text-center text-xs text-danger">
                Not enough credits — you need {cost - credits} more. Tap “Buy” in the top bar.
              </p>
            )}
            {needsSignIn && (
              <p className="mt-2 text-center text-xs text-faint">
                Free account · 1,200 credits to start — your shot renders with the real{" "}
                {modality === "video" ? "Seedance" : "Seedream"} model.
              </p>
            )}
          </div>
        </div>
      </Card>

      {/* Result */}
      {activeJob && (
        <div ref={resultRef}>
        <Card className="mt-5 p-5">
          <ResultHero job={activeJob} />
          {activeJob.status === "succeeded" && (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button
                variant="soft"
                size="sm"
                onClick={() => {
                  saveVideoToAssets(activeJob.id);
                  setSavedMsg(true);
                  setTimeout(() => setSavedMsg(false), 2000);
                }}
              >
                {savedMsg ? (
                  <>
                    <Check size={15} className="text-teal" /> Saved
                  </>
                ) : (
                  <>
                    <Bookmark size={15} /> Save to Assets
                  </>
                )}
              </Button>
              {activeJob.videoUrl || activeJob.posterUrl ? (
                <a href={activeJob.videoUrl ?? activeJob.posterUrl} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm">
                    <Download size={15} /> Download
                  </Button>
                </a>
              ) : null}
              <Link href="/app/library" className="ml-auto">
                <Button variant="ghost" size="sm">
                  Library <ArrowRight size={15} />
                </Button>
              </Link>
            </div>
          )}
        </Card>
        </div>
      )}

      <SlotPickerModal
        cls={pickClass}
        assets={assets}
        selectedId={pickClass ? picks[pickClass] ?? null : null}
        onSelect={(id) => {
          if (pickClass) setPick(pickClass, id);
          setPickClass(null);
        }}
        onClose={() => setPickClass(null)}
      />
    </div>
  );
}

/* --------------------------- Slot building blocks -------------------------- */

function SlotCard({
  cls,
  asset,
  onPick,
  onClear,
}: {
  cls: AssetClass;
  asset: Asset | null;
  onPick: () => void;
  onClear: () => void;
}) {
  const meta = CLASS_BY_KEY[cls];
  if (asset) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-accent/40 bg-accent-soft/40 p-2.5">
        <AssetThumb a={asset} className="h-11 w-11 shrink-0 rounded-lg" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-wide text-accent-2">{meta.label}</div>
          <div className="truncate text-sm font-medium text-fg">{asset.name}</div>
        </div>
        <button onClick={onPick} className="rounded-lg px-2 py-1 text-[12px] font-medium text-muted hover:text-fg">
          Change
        </button>
        <button onClick={onClear} className="rounded-full p-1 text-faint hover:text-fg" aria-label="Remove">
          <X size={15} />
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={onPick}
      className="flex items-center gap-3 rounded-xl border border-dashed border-line-2 p-2.5 text-left transition-colors hover:border-accent/40 hover:bg-surface-2"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-faint">
        <ClassIcon icon={meta.icon} size={18} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-fg">{meta.label}</span>
        <span className="block truncate text-[12px] text-faint">{meta.tagline}</span>
      </span>
      <Plus size={16} className="mr-1 text-faint" />
    </button>
  );
}

function SlotPickerModal({
  cls,
  assets,
  selectedId,
  onSelect,
  onClose,
}: {
  cls: AssetClass | null;
  assets: Asset[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
}) {
  const meta = cls ? CLASS_BY_KEY[cls] : null;
  const options = cls ? assets.filter((a) => a.class === cls) : [];
  return (
    <Modal open={!!cls} onClose={onClose} title={meta ? `Choose a ${meta.label}` : ""} size="lg">
      {options.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">
          No {meta?.plural.toLowerCase()} yet.{" "}
          <Link href="/app/assets" className="text-accent-2 hover:underline" onClick={onClose}>
            Upload some
          </Link>{" "}
          to use here.
        </p>
      ) : (
        <div className="grid max-h-[55vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
          {options.map((a) => {
            const active = selectedId === a.id;
            return (
              <button
                key={a.id}
                onClick={() => onSelect(active ? null : a.id)}
                className={cn(
                  "group relative overflow-hidden rounded-xl border bg-surface text-left transition-all",
                  active ? "border-accent ring-2 ring-accent/40" : "border-line hover:border-line-2",
                )}
              >
                <div className="relative aspect-[4/3] overflow-hidden">
                  <AssetThumb a={a} className="h-full w-full" />
                  <span className="absolute left-1.5 top-1.5 flex gap-1">
                    <CompositeBadge a={a} />
                    {a.owner === "business" && (
                      <Badge tone="neutral" className="bg-black/55 text-white border-white/20 backdrop-blur-sm">
                        Business
                      </Badge>
                    )}
                  </span>
                  {active && (
                    <span className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-accent text-white">
                      <Check size={14} />
                    </span>
                  )}
                </div>
                <div className="p-2">
                  <div className="truncate text-[13px] font-medium text-fg">{a.name}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
