"use client";

// Character Studio — design a character once (look, outfit, style), generate
// a full reference sheet (turnaround angles, portrait, expressions) with the
// real image model, and save the result as a reusable Character asset.

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Bookmark, Check, Coins, Loader2, Sparkles, UserRound } from "lucide-react";
import { useStore } from "@/lib/store";
import { cloudConfigured } from "@/lib/supabase";
import { getModel, priceFor } from "@/lib/models";
import { categoryIdForClass } from "@/lib/catalog";
import type { Asset, AssetPart } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Badge, Button, Card, Progress, Segmented, TextInput } from "@/components/ui";
import { AssetThumb } from "@/components/shared";

type StyleKey = "photoreal" | "cinematic" | "anime" | "3d";

const STYLES: Record<StyleKey, { label: string; suffix: string }> = {
  photoreal: { label: "Photoreal", suffix: "photorealistic, natural skin texture, studio lighting" },
  cinematic: { label: "Cinematic", suffix: "cinematic film still, dramatic lighting, rich color grade, 35mm grain" },
  anime: { label: "Anime", suffix: "high-quality anime character art, clean lineart, cel shading" },
  "3d": { label: "3D Toon", suffix: "stylized 3D animation character render, soft global illumination, expressive" },
};

interface PanelDef {
  key: "sheet" | "portrait" | "expressions";
  label: string;
  hint: string;
  aspect: "16:9" | "1:1";
  wide: boolean;
  prompt: (base: string, style: string) => string;
}

const PANELS: PanelDef[] = [
  {
    key: "sheet",
    label: "Turnaround sheet",
    hint: "Front · ¾ · profile · back",
    aspect: "16:9",
    wide: true,
    prompt: (base, style) =>
      `Character reference sheet of ${base} — full body turnaround with four views side by side: front view, three-quarter view, side profile view, back view. Same relaxed standing pose, consistent character design and outfit across all views, neutral light-gray studio background, even lighting. ${style}`,
  },
  {
    key: "portrait",
    label: "Portrait",
    hint: "The face card",
    aspect: "1:1",
    wide: false,
    prompt: (base, style) =>
      `Character portrait of ${base} — waist-up, facing camera, confident relaxed expression, neutral dark studio backdrop. ${style}`,
  },
  {
    key: "expressions",
    label: "Expressions",
    hint: "Six emotions grid",
    aspect: "1:1",
    wide: false,
    prompt: (base, style) =>
      `Expression sheet of ${base} — a clean grid of six close-up facial expressions: neutral, happy, angry, surprised, sad, determined. Consistent character across all six, neutral background. ${style}`,
  },
];

export function CharacterStudio() {
  const assets = useStore((s) => s.assets);
  const videos = useStore((s) => s.videos);
  const credits = useStore((s) => s.credits);
  const hydrated = useStore((s) => s.hasHydrated);
  const generate = useStore((s) => s.generate);
  const addAsset = useStore((s) => s.addAsset);
  const cloudUser = useStore((s) => s.cloudUser);
  const setAuthOpen = useStore((s) => s.setAuthOpen);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [dressId, setDressId] = useState<string | null>(null);
  const [style, setStyle] = useState<StyleKey>("cinematic");
  const [selected, setSelected] = useState<Record<PanelDef["key"], boolean>>({
    sheet: true,
    portrait: true,
    expressions: false,
  });
  const [jobIds, setJobIds] = useState<Partial<Record<PanelDef["key"], string>>>({});
  const [saved, setSaved] = useState(false);

  const dresses = useMemo(() => assets.filter((a) => a.class === "dress"), [assets]);
  const dress = dresses.find((d) => d.id === dressId) ?? null;
  const needsSignIn = cloudConfigured && !cloudUser;

  const model = getModel("seedream-3");
  const perPanel = priceFor(model, { count: 1 });
  const chosen = PANELS.filter((p) => selected[p.key]);
  const cost = chosen.length * perPanel;
  const canAfford = credits >= cost;
  const canGenerate = hydrated && description.trim().length > 3 && chosen.length > 0 && canAfford;

  const jobs = PANELS.map((p) => ({
    panel: p,
    job: jobIds[p.key] ? videos.find((v) => v.id === jobIds[p.key]) ?? null : null,
  }));
  const activeJobs = jobs.filter((j) => j.job);
  const rendering = activeJobs.some((j) => j.job!.status === "rendering");
  const doneJobs = activeJobs.filter((j) => j.job!.status === "succeeded" && j.job!.posterUrl);
  const allDone = activeJobs.length > 0 && !rendering && doneJobs.length > 0;

  const base = `${description.trim()}${dress ? `, wearing ${dress.promptFragment ?? dress.name.toLowerCase()}` : ""}`;

  function onGenerate() {
    if (!canGenerate || rendering) return;
    setSaved(false);
    const ids: Partial<Record<PanelDef["key"], string>> = {};
    for (const p of chosen) {
      ids[p.key] = generate({
        prompt: p.prompt(base, STYLES[style].suffix),
        tier: "standard",
        durationSec: 5,
        aspectRatio: p.aspect,
        audio: false,
        modelId: model.id,
        modality: "image",
        direction: description.trim(),
      });
    }
    setJobIds(ids);
  }

  function onSave() {
    const parts: AssetPart[] = doneJobs.map(({ panel, job }) => ({
      role: panel.key === "portrait" ? "primary" : "reference",
      kind: "image",
      url: job!.posterUrl!,
      posterUrl: job!.posterUrl,
      label: panel.label,
    }));
    const hero =
      doneJobs.find((j) => j.panel.key === "portrait")?.job?.posterUrl ?? doneJobs[0].job!.posterUrl!;
    addAsset({
      name: name.trim() || "New Character",
      kind: "image",
      url: hero,
      posterUrl: hero,
      categoryId: categoryIdForClass("character"),
      source: "generation",
      class: "character",
      promptFragment: description.trim().split(/[,.\n]/)[0].toLowerCase(),
      parts: parts.length > 1 ? parts : undefined,
    } as Omit<Asset, "id" | "createdAt">);
    setSaved(true);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6 text-center">
        <div className="mb-1.5 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-2">
          <UserRound size={14} /> Character Studio
        </div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Design a character once, cast them forever</h1>
        <p className="mt-1.5 text-sm text-muted">
          Describe them, dress them, pick a style — get a full reference sheet and save them to your library.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
        {/* ------------------------------ Form ------------------------------ */}
        <Card className="h-fit p-5">
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-faint">Name</label>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Aria, Kato, Nova…" />

          <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">
            Who are they?
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="A confident woman in her 20s with short silver hair and cybernetic ear implants…"
            className="w-full resize-none rounded-xl border border-line bg-surface-2 p-3 text-sm leading-relaxed text-fg placeholder:text-faint focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20"
          />

          <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">
            Outfit <span className="normal-case">(from your wardrobe)</span>
          </label>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            <button
              onClick={() => setDressId(null)}
              className={cn(
                "shrink-0 rounded-xl border px-3 py-2 text-[12px] font-medium transition-colors",
                !dressId ? "border-accent/60 bg-accent-soft text-fg" : "border-line text-muted hover:border-line-2",
              )}
            >
              As described
            </button>
            {dresses.map((d) => (
              <button
                key={d.id}
                onClick={() => setDressId(dressId === d.id ? null : d.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-xl border py-1.5 pl-1.5 pr-3 text-[12px] font-medium transition-colors",
                  dressId === d.id ? "border-accent/60 bg-accent-soft text-fg" : "border-line text-muted hover:border-line-2",
                )}
              >
                <AssetThumb a={d} className="h-7 w-7 rounded-lg" />
                {d.name}
              </button>
            ))}
          </div>

          <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">Style</label>
          <Segmented<StyleKey>
            value={style}
            onChange={setStyle}
            options={(Object.keys(STYLES) as StyleKey[]).map((k) => ({ value: k, label: STYLES[k].label }))}
          />

          <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">Sheet panels</label>
          <div className="space-y-2">
            {PANELS.map((p) => (
              <button
                key={p.key}
                onClick={() => setSelected((s) => ({ ...s, [p.key]: !s[p.key] }))}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors",
                  selected[p.key] ? "border-accent/60 bg-accent-soft" : "border-line hover:border-line-2",
                )}
              >
                <span>
                  <span className="block text-[13px] font-semibold text-fg">{p.label}</span>
                  <span className="block text-[11px] text-faint">{p.hint}</span>
                </span>
                <span className="flex items-center gap-2">
                  <span className="text-[11px] text-faint">{perPanel} cr</span>
                  {selected[p.key] && <Check size={15} className="text-accent-2" />}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
            <span className="text-muted">Estimated cost</span>
            <span className="flex items-center gap-1.5 font-semibold">
              <Coins size={15} className="text-warn" /> {cost} credits
            </span>
          </div>
          {needsSignIn ? (
            <Button size="lg" className="mt-3 w-full" onClick={() => setAuthOpen(true)}>
              <Sparkles size={17} /> Sign in to generate
            </Button>
          ) : (
            <Button size="lg" className="mt-3 w-full" disabled={!canGenerate || rendering} onClick={onGenerate}>
              {rendering ? (
                <>
                  <Loader2 size={17} className="animate-spin" /> Generating…
                </>
              ) : (
                <>
                  <Sparkles size={17} /> Generate character sheet
                </>
              )}
            </Button>
          )}
          {hydrated && !needsSignIn && !canAfford && (
            <p className="mt-2 text-center text-xs text-danger">
              Not enough credits — you need {cost - credits} more.
            </p>
          )}
        </Card>

        {/* ----------------------------- Results ---------------------------- */}
        <div className="space-y-4">
          {activeJobs.length === 0 ? (
            <Card className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-2">
                <UserRound size={22} />
              </span>
              <p className="mt-3 max-w-sm text-sm text-muted">
                Your character sheet appears here — every angle of them, their outfit and their
                expressions, ready to reuse in any shot.
              </p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {jobs
                .filter((j) => j.job)
                .map(({ panel, job }) => (
                  <Card key={panel.key} className={cn("overflow-hidden", panel.wide && "sm:col-span-2")}>
                    <div className={cn("relative w-full bg-surface-2", panel.aspect === "16:9" ? "aspect-video" : "aspect-square", !panel.wide && "sm:aspect-square")}>
                      {job!.status === "rendering" ? (
                        <div className="shimmer flex h-full flex-col items-center justify-center">
                          <Loader2 size={20} className="animate-spin text-accent-2" />
                          <div className="mt-3 w-32">
                            <Progress value={job!.progress} />
                          </div>
                        </div>
                      ) : job!.status === "succeeded" && job!.posterUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={job!.posterUrl} alt={panel.label} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full items-center justify-center p-4 text-center text-xs text-danger">
                          {job!.error ?? "Failed"}
                        </div>
                      )}
                      <span className="absolute left-2 top-2">
                        <Badge tone="neutral" className="border-white/20 bg-black/55 text-white backdrop-blur-sm">
                          {panel.label}
                        </Badge>
                      </span>
                    </div>
                  </Card>
                ))}
            </div>
          )}

          {allDone && (
            <Card className="flex flex-wrap items-center gap-2 p-4">
              <Button onClick={onSave} disabled={saved}>
                {saved ? (
                  <>
                    <Check size={16} className="text-teal" /> Saved to Characters
                  </>
                ) : (
                  <>
                    <Bookmark size={16} /> Save to Characters
                  </>
                )}
              </Button>
              {saved && (
                <Link href="/app/assets" className="ml-auto">
                  <Button variant="ghost" size="sm">
                    View in Assets <ArrowRight size={15} />
                  </Button>
                </Link>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
