"use client";

// Products — add a product once from photos or a description, get a clean
// multi-angle product sheet, and feature it in any shot. A product is a
// composite asset plus its parts, so "Use in Studio" fills image slots with
// its sheet and reference photos — keeping the exact same product across
// every scene. A finished sheet saves the product automatically; clicking a
// saved product opens it in full with everything entered to produce it,
// editable, with one-tap regeneration.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Coins,
  ImagePlus,
  Loader2,
  Plus,
  Package,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cloudConfigured } from "@/lib/supabase";
import { getModel, priceFor } from "@/lib/models";
import { uploadDataUrl } from "@/lib/cloud";
import { clearPendingSheet, getPendingSheet, setPendingSheet } from "@/lib/pending-sheet";
import type { Asset, AssetPart } from "@/lib/types";
import { uid } from "@/lib/utils";
import { Badge, Button, Card, EmptyState, Modal, Progress, Segmented, TextInput } from "@/components/ui";
import { thumbFor } from "@/lib/catalog";

type StyleKey = "studio" | "photoreal" | "lifestyle" | "premium";

const STYLES: Record<StyleKey, { label: string; suffix: string }> = {
  studio: { label: "Studio", suffix: "clean e-commerce studio shot, pure white background, soft shadows, crisp detail" },
  photoreal: { label: "Photoreal", suffix: "photorealistic product photography, true materials, soft natural studio light" },
  lifestyle: { label: "Lifestyle", suffix: "lifestyle product photography, placed in a real setting, natural light, shallow depth of field" },
  premium: { label: "Premium", suffix: "premium advertising product shot, dramatic lighting, rich reflections, luxury feel" },
};

/** ONE product = ONE sheet image: every angle in one clean composition. */
const sheetPrompt = (base: string, style: string) =>
  `Complete product reference sheet of ${base}, laid out as one clean composition on a pure white studio background. Top row: the product shown from four angles side by side — front view, three-quarter view, side view, and back view — the identical product, lighting and proportions in each. Bottom left: a neat grid of close-up detail shots showing material, texture and key features. Bottom right: one large hero shot of the product, beautifully lit, catalog quality. The exact same product in every view — same shape, colour and finish — crisp studio lighting, soft reflections, e-commerce clarity. No text, labels or watermarks. ${style}`;

/** A locally staged upload (already in Storage) waiting to be saved as an asset. */
interface StagedFile {
  url: string;
  name: string;
}

/** What was entered to produce the sheet — stored on the product, editable later. */
interface Recipe {
  description: string;
  details: string;
  setting: string;
  style: StyleKey;
}

const RECIPE_LABEL = "Recipe";

/** Read the stored inputs back off a saved product. */
function recipeOf(a: Asset): Recipe | null {
  const part = a.parts?.find((p) => p.label === RECIPE_LABEL);
  if (!part) return null;
  try {
    const r = JSON.parse(part.url) as Partial<Recipe>;
    return {
      description: r.description ?? "",
      details: r.details ?? "",
      setting: r.setting ?? "",
      style: (r.style as StyleKey) ?? "studio",
    };
  } catch {
    return null;
  }
}

export function ProductStudio() {
  const router = useRouter();
  /** Gallery first — the creation wizard opens on "Add new". */
  const [creating, setCreating] = useState(false);
  const assets = useStore((s) => s.assets);
  const videos = useStore((s) => s.videos);
  const credits = useStore((s) => s.credits);
  const hydrated = useStore((s) => s.hasHydrated);
  const generate = useStore((s) => s.generate);
  const addAsset = useStore((s) => s.addAsset);
  const addCategory = useStore((s) => s.addCategory);
  const removeAsset = useStore((s) => s.removeAsset);
  const updateAsset = useStore((s) => s.updateAsset);
  const setDraftElements = useStore((s) => s.setDraftElements);
  const cloudUser = useStore((s) => s.cloudUser);
  const subscribed = useStore((s) => s.subscribed);
  const setAuthOpen = useStore((s) => s.setAuthOpen);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [details, setDetails] = useState("");
  const [setting, setSetting] = useState("");
  const [style, setStyle] = useState<StyleKey>("studio");
  const [photos, setPhotos] = useState<StagedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  /** The saved product being viewed/edited (null while making a new one). */
  const [editingId, setEditingId] = useState<string | null>(null);
  /** The product's current sheet URL (existing or freshly rendered). */
  const [sheet, setSheet] = useState<string | null>(null);
  /** Job ids already auto-saved — a render persists exactly once. */
  const savedJobs = useRef<Set<string>>(new Set());
  /** Full-screen view of the sheet. */
  const [fullOpen, setFullOpen] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);

  const products = useMemo(
    () => assets.filter((a) => a.class === "product" && (a.parts?.length ?? 0) > 0),
    [assets],
  );
  const needsSignIn = cloudConfigured && !cloudUser;
  // Unsubscribed: keep Generate clickable so it opens the subscribe paywall.
  const locked = cloudConfigured && subscribed === false;

  // The sheet renders on the 2K image model — product detail deserves it.
  const model = getModel("seedream-45");
  const cost = priceFor(model, { count: 1 });
  const canAfford = credits >= cost;
  const described = description.trim().length > 3 || photos.length > 0;
  const canGenerate = hydrated && described && canAfford;

  const job = jobId ? videos.find((v) => v.id === jobId) ?? null : null;
  const rendering = job?.status === "rendering";

  const base = [
    photos.length
      ? "the exact product shown in the reference photos — same shape, colour, materials and finish"
      : null,
    description.trim() || null,
    details.trim() || null,
    setting.trim() ? `presented ${setting.trim()}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  async function stageFiles(files: FileList | null) {
    if (!files?.length) return;
    if (needsSignIn) {
      setAuthOpen(true);
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of Array.from(files).slice(0, 4 - photos.length)) {
        if (file.size > 8 * 1024 * 1024) {
          setUploadError("Files must be under 8 MB.");
          continue;
        }
        const dataUrl = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result as string);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        // Cloud → Storage URL; demo (no cloud) → keep the data URL locally
        // instead of failing with a misleading "try again".
        let url = await uploadDataUrl(uid("produp"), dataUrl);
        if (!url && !cloudConfigured) url = dataUrl;
        if (!url) {
          setUploadError("Upload failed — try again.");
          continue;
        }
        setPhotos((p) => [...p, { url, name: file.name.replace(/\.[^.]+$/, "") }].slice(0, 4));
      }
    } finally {
      setUploading(false);
    }
  }

  function onGenerate() {
    if (rendering) return;
    if (locked) {
      useStore.getState().blockIfLocked(); // opens the subscribe paywall
      return;
    }
    if (!canGenerate) return;
    const id = generate({
      prompt: sheetPrompt(base, STYLES[style].suffix),
      tier: "standard",
      durationSec: 5,
      aspectRatio: "1:1",
      audio: false,
      modelId: model.id,
      modality: "image",
      direction: description.trim() || name.trim(),
      refImageUrls: photos.length ? photos.map((p) => p.url) : undefined,
    });
    setJobId(id);
    // Safety net: if they navigate away mid-render, the next visit restores
    // this state and the auto-save still lands the paid sheet.
    setPendingSheet("product", {
      jobId: id,
      data: { editingId, name, description, details, setting, style, photos },
    });
  }

  /**
   * Persist the product from the current form state — automatically after a
   * render, and via "Save details" for text edits. A product = a collection
   * of real assets + one composite that bundles them (parts include the
   * Recipe: everything entered to produce the sheet).
   */
  function persistProduct(overrides?: { sheetUrl?: string | null }) {
    const theSheet = overrides?.sheetUrl !== undefined ? overrides.sheetUrl : sheet;
    const prodName = name.trim() || "New Product";
    const recipePart: AssetPart = {
      role: "reference",
      kind: "prompt",
      url: JSON.stringify({ description, details, setting, style } satisfies Recipe),
      label: RECIPE_LABEL,
    };
    const parts: AssetPart[] = [
      ...photos.map((p, i) => ({
        role: "reference" as const,
        kind: "image" as const,
        url: p.url,
        posterUrl: p.url,
        label: `Photo ${i + 1}`,
      })),
      ...(theSheet
        ? [{ role: "primary" as const, kind: "image" as const, url: theSheet, posterUrl: theSheet, label: "Product sheet" }]
        : []),
      recipePart,
    ];
    const hero = theSheet ?? photos[0]?.url ?? "";
    const promptFragment = `${prodName}${description.trim() ? `, ${description.trim().split(/[,.\n]/)[0].toLowerCase()}` : ""}`;

    if (editingId) {
      const existing = assets.find((a) => a.id === editingId);
      if (!existing) return;
      updateAsset(editingId, { name: prodName, url: hero, posterUrl: hero, parts, promptFragment });
      const colId = existing.categoryId;
      if (colId) {
        const sheetAsset = assets.find((a) => a.categoryId === colId && a.kind === "image" && / product sheet$/.test(a.name));
        if (theSheet && sheetAsset && sheetAsset.url !== theSheet) {
          updateAsset(sheetAsset.id, { url: theSheet, posterUrl: theSheet });
        } else if (theSheet && !sheetAsset) {
          addAsset({ name: `${prodName} — product sheet`, kind: "image", url: theSheet, posterUrl: theSheet, categoryId: colId, source: "generation", promptFragment: `${prodName}'s product sheet — every angle of it` });
        }
      }
      return;
    }

    const col = addCategory(`${prodName} — product`);
    photos.forEach((p, i) => {
      addAsset({ name: `${prodName} — photo ${i + 1}`, kind: "image", url: p.url, posterUrl: p.url, categoryId: col.id, source: "upload", promptFragment: `${prodName}'s reference photo` });
    });
    if (theSheet) {
      addAsset({ name: `${prodName} — product sheet`, kind: "image", url: theSheet, posterUrl: theSheet, categoryId: col.id, source: "generation", promptFragment: `${prodName}'s product sheet — every angle of it` });
    }
    const composite = addAsset({
      name: prodName,
      kind: "image",
      url: hero,
      posterUrl: hero || undefined,
      categoryId: col.id,
      source: "generation",
      class: "product",
      promptFragment,
      parts,
    } as Omit<Asset, "id" | "createdAt">);
    setEditingId(composite.id);
  }

  // A finished sheet saves the product automatically — nothing to click.
  useEffect(() => {
    if (!job || job.status !== "succeeded" || !job.posterUrl) return;
    if (savedJobs.current.has(job.id)) return;
    savedJobs.current.add(job.id);
    setSheet(job.posterUrl);
    persistProduct({ sheetUrl: job.posterUrl });
    clearPendingSheet("product");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job?.status, job?.posterUrl]);

  // Restore an in-flight (or finished-but-unsaved) render from a previous
  // visit, so navigating away mid-render never loses the paid sheet.
  useEffect(() => {
    if (!hydrated || jobId) return;
    const pending = getPendingSheet<{
      editingId: string | null;
      name: string;
      description: string;
      details: string;
      setting: string;
      style: StyleKey;
      photos: StagedFile[];
    }>("product");
    if (!pending) return;
    const pendingJob = useStore.getState().videos.find((v) => v.id === pending.jobId);
    if (!pendingJob || pendingJob.status === "failed") {
      clearPendingSheet("product");
      return;
    }
    const d = pending.data;
    setEditingId(d.editingId);
    setName(d.name);
    setDescription(d.description);
    setDetails(d.details);
    setSetting(d.setting);
    setStyle(d.style);
    setPhotos(d.photos ?? []);
    setJobId(pending.jobId);
    setCreating(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  /** Blank slate for "Add new product" — never reopen with last time's data. */
  function resetForm() {
    setEditingId(null);
    setName("");
    setDescription("");
    setDetails("");
    setSetting("");
    setStyle("studio");
    setPhotos([]);
    setJobId(null);
    setSheet(null);
    setUploadError(null);
  }

  /** Open a saved product in full: sheet, recipe — edit & regenerate. */
  function openProduct(c: Asset) {
    const recipe = recipeOf(c);
    setEditingId(c.id);
    setName(c.name);
    setDescription(recipe?.description ?? "");
    setDetails(recipe?.details ?? "");
    setSetting(recipe?.setting ?? "");
    setStyle(recipe?.style ?? "studio");
    const photoParts = (c.parts ?? []).filter((p) => p.role === "reference" && p.kind === "image");
    setPhotos(photoParts.map((p, i) => ({ url: p.url, name: `Photo ${i + 1}` })));
    const sheetPart = c.parts?.find((p) => p.role === "primary");
    setSheet(sheetPart?.url ?? c.posterUrl ?? null);
    setJobId(null);
    setUploadError(null);
    setCreating(true);
  }

  /** Feature it: its sheet & photos fill image slots in the Studio. */
  function useInMake(product: Asset) {
    const ids = assets
      .filter((a) => a.categoryId === product.categoryId && a.id !== product.id)
      .map((a) => a.id);
    setDraftElements(ids.length ? ids : [product.id]);
    router.push("/app/make");
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Products</h1>
        <p className="mt-1 text-sm text-muted">
          Add a product from photos or a description — get a clean multi-angle product sheet, then
          feature the exact same product in any video. Sheets save themselves.
        </p>
      </header>

      {/* Gallery first — the wizard hides behind "Add new". */}
      {!creating && (
        <div className="mb-5">
          <Button
            size="lg"
            onClick={() => {
              resetForm();
              setCreating(true);
            }}
          >
            <Plus size={17} /> Add new product
          </Button>
        </div>
      )}
      {!creating && products.length === 0 && (
        <EmptyState
          icon={<Plus size={24} />}
          art={[thumbFor("prod-serum"), thumbFor("prod-watch"), thumbFor("prod-handbag")]}
          title="No products yet"
          description="Turn a single product shot into a full study sheet the studio can shoot from. Tap “Add new product” to make your first."
        />
      )}

      {/* ------------------------- Saved products ------------------------- */}
      {!creating && products.length > 0 && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {products.map((c) => {
            const views = c.parts?.filter((p) => p.kind === "image").length ?? 0;
            return (
              <Card key={c.id} className="group overflow-hidden">
                <div className="relative aspect-square bg-surface-2">
                  <button onClick={() => openProduct(c)} className="block h-full w-full" title={`Open ${c.name}`}>
                    {c.posterUrl || c.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.posterUrl ?? c.url} alt={c.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-faint">
                        <Package size={26} />
                      </div>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete ${c.name}? Its sheet assets stay in your library.`)) {
                        removeAsset(c.id);
                      }
                    }}
                    className="absolute right-2 top-2 rounded-lg bg-black/55 p-1.5 text-white transition-opacity hover:bg-black/75 sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label="Delete product"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="p-3">
                  <div className="truncate text-[13.5px] font-semibold">{c.name}</div>
                  <div className="mt-1 text-[11px] text-faint">{views} views</div>
                  <Button size="sm" variant="soft" className="mt-2 w-full" onClick={() => useInMake(c)}>
                    <Sparkles size={13} /> Use in Studio
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {creating && (
        <>
          <button
            onClick={() => setCreating(false)}
            className="mb-4 text-[13px] font-medium text-muted transition-colors hover:text-fg"
          >
            ← All products
          </button>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,400px)_1fr]">
        {/* ------------------------------ Form ------------------------------ */}
        <Card className="h-fit p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-2">
            <Package size={14} /> {editingId ? "Edit product" : "New product"}
          </div>

          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-faint">Name</label>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Glow Serum, Court Sneaker…" />

          {/* Photos — build the product from one or more pictures */}
          <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">
            Photos <span className="normal-case">(optional — 1 to 4 pictures of it)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {photos.map((p, i) => (
              <span key={p.url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.name} className="h-14 w-14 rounded-xl border border-line object-cover" />
                <button
                  onClick={() => setPhotos((arr) => arr.filter((_, j) => j !== i))}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-fg text-bg"
                  aria-label="Remove photo"
                >
                  <X size={11} />
                </button>
              </span>
            ))}
            {photos.length < 4 && (
              <button
                onClick={() => photoRef.current?.click()}
                disabled={uploading}
                className="flex h-14 w-14 items-center justify-center rounded-xl border border-dashed border-line-2 text-faint transition-colors hover:border-accent/50 hover:text-accent-2"
                aria-label="Add photo"
              >
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <ImagePlus size={16} />}
              </button>
            )}
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                void stageFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">
            What is it?
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="A frosted-glass skincare serum bottle with a bamboo dropper cap…"
            className="w-full resize-none rounded-xl border border-line bg-surface-2 p-3 text-base leading-relaxed text-fg placeholder:text-faint focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 sm:text-sm"
          />

          <label className="mb-1.5 mt-3 block text-xs font-medium uppercase tracking-wide text-faint">
            Details <span className="normal-case">(materials, colours, finish)</span>
          </label>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={2}
            placeholder="Amber glass, brushed-gold collar, matte label, 30ml, soft-touch cap…"
            className="w-full resize-none rounded-xl border border-line bg-surface-2 p-3 text-base leading-relaxed text-fg placeholder:text-faint focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 sm:text-sm"
          />

          <label className="mb-1.5 mt-3 block text-xs font-medium uppercase tracking-wide text-faint">
            Setting or packaging <span className="normal-case">(optional)</span>
          </label>
          <TextInput
            value={setting}
            onChange={(e) => setSetting(e.target.value)}
            placeholder="in a minimal white gift box, on a marble surface"
          />
          {uploadError && <p className="mt-2 text-xs text-danger">{uploadError}</p>}

          <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">Style</label>
          <Segmented<StyleKey>
            value={style}
            onChange={setStyle}
            options={(Object.keys(STYLES) as StyleKey[]).map((k) => ({ value: k, label: STYLES[k].label }))}
          />

          <div className="mt-4 flex items-center justify-between border-t border-line pt-3 text-sm">
            <span className="text-muted">Model</span>
            <span className="font-medium">
              {model.glyph} {model.name}
            </span>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-sm">
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
            <Button
              size="lg"
              className="mt-3 w-full"
              disabled={rendering || (!locked && !canGenerate)}
              onClick={onGenerate}
            >
              {rendering ? (
                <>
                  <Loader2 size={17} className="animate-spin" /> Generating…
                </>
              ) : locked ? (
                <>
                  <Sparkles size={17} /> Subscribe to generate
                </>
              ) : sheet ? (
                <>
                  <Sparkles size={17} /> Regenerate product sheet
                </>
              ) : (
                <>
                  <Sparkles size={17} /> Generate product sheet
                </>
              )}
            </Button>
          )}
          {editingId && !rendering && (
            <Button variant="soft" className="mt-2 w-full" onClick={() => persistProduct()}>
              <Check size={16} /> Save details
            </Button>
          )}
          {hydrated && !needsSignIn && !locked && !canAfford && (
            <p className="mt-2 text-center text-xs text-danger">
              Not enough credits — you need {cost - credits} more.
            </p>
          )}
        </Card>

        {/* ----------------------------- The sheet ---------------------------- */}
        <div className="space-y-4">
          {!job && !sheet ? (
            <Card className="flex min-h-[320px] flex-col items-center justify-center p-8 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-2">
                <Package size={22} />
              </span>
              <p className="mt-3 max-w-sm text-sm text-muted">
                Your product sheet appears here — one image with every angle of it: front,
                three-quarter, side and back, detail close-ups, and a hero shot. It saves itself
                the moment it renders.
              </p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="relative aspect-square w-full bg-surface-2">
                {rendering ? (
                  <div className="shimmer flex h-full flex-col items-center justify-center">
                    <Loader2 size={20} className="animate-spin text-accent-2" />
                    <div className="mt-3 w-32">
                      <Progress value={job!.progress} />
                    </div>
                  </div>
                ) : job?.status === "failed" ? (
                  <div className="flex h-full items-center justify-center p-4 text-center text-xs text-danger">
                    {job.error ?? "Failed"}
                  </div>
                ) : sheet ? (
                  <button onClick={() => setFullOpen(true)} className="block h-full w-full" title="View full size">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sheet} alt="Product sheet" className="h-full w-full object-cover" />
                  </button>
                ) : null}
                <span className="pointer-events-none absolute left-2 top-2">
                  <Badge tone="neutral" className="border-white/20 bg-black/55 text-white backdrop-blur-sm">
                    Product sheet
                  </Badge>
                </span>
              </div>
            </Card>
          )}

          {!!sheet && !rendering && (
            <Card className="flex flex-wrap items-center gap-2 p-4">
              <span className="flex items-center gap-1.5 text-[13px] font-medium text-teal">
                <Check size={15} /> Saved automatically
              </span>
              <span className="text-[12px] text-faint">— tap the sheet to see it full size</span>
              <Button
                size="sm"
                className="ml-auto"
                onClick={() => {
                  const c = assets.find((a) => a.id === editingId);
                  if (c) useInMake(c);
                }}
                disabled={!editingId}
              >
                Use in Studio <ArrowRight size={15} />
              </Button>
            </Card>
          )}
        </div>
      </div>
        </>
      )}

      {/* The sheet, full size. */}
      <Modal open={fullOpen} onClose={() => setFullOpen(false)} size="lg" title={name.trim() || "Product sheet"}>
        {sheet && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={sheet} alt="Product sheet — full size" className="w-full rounded-xl" />
        )}
      </Modal>
    </div>
  );
}
