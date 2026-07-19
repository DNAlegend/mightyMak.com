"use client";

// Characters — design or capture a character once, get a full reference sheet
// (turnaround, portrait, expressions), optionally give them a voice, and cast
// them in any shot. A character is a composite asset plus a collection of its
// parts, so "Use in Make" fills image slots with their sheets/photos and a
// sound slot with their voice.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Coins,
  ImagePlus,
  Loader2,
  Plus,
  Mic,
  Sparkles,
  Square,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cloudConfigured } from "@/lib/supabase";
import { getModel, priceFor } from "@/lib/models";
import { uploadDataUrl, uploadFile } from "@/lib/cloud";
import { clearPendingSheet, getPendingSheet, setPendingSheet } from "@/lib/pending-sheet";
import type { Asset, AssetPart } from "@/lib/types";
import { cn, uid } from "@/lib/utils";
import { Badge, Button, Card, EmptyState, Modal, Progress, Segmented, TextInput } from "@/components/ui";
import { thumbFor } from "@/lib/catalog";

type StyleKey = "photoreal" | "cinematic" | "anime" | "3d";

const STYLES: Record<StyleKey, { label: string; suffix: string }> = {
  photoreal: { label: "Photoreal", suffix: "photorealistic, natural skin texture, studio lighting" },
  cinematic: { label: "Cinematic", suffix: "cinematic film still, dramatic lighting, rich color grade, 35mm grain" },
  anime: { label: "Anime", suffix: "high-quality anime character art, clean lineart, cel shading" },
  "3d": { label: "3D Toon", suffix: "stylized 3D animation character render, soft global illumination, expressive" },
};

/**
 * ONE character = ONE sheet image: a strict 2×4 grid of eight boxes.
 * Top row — the face from four directions; bottom row — the full body from
 * four directions, so the sheet describes both the face AND the character's
 * shape, width and height.
 */
const sheetPrompt = (base: string, style: string) =>
  `Character reference sheet of ${base}, laid out as ONE clean composition on a pure white background: a strict grid of eight boxes in two rows of four with thin gutters, exactly ONE figure per box — never two figures in the same box. Top row, left to right — box 1: head-and-shoulders front view facing camera; box 2: head-and-shoulders left profile; box 3: head-and-shoulders right profile; box 4: the back of the head. Bottom row, left to right — box 5: full body standing, front view; box 6: full body, left side view; box 7: full body, right side view; box 8: full body, back view. The exact same face, hair, height, build, body width, proportions and outfit in every box, feet visible in the bottom row so the full height reads clearly. One single person per box, no text or labels, fashion-catalog clarity, even studio lighting. ${style}`;

/** A locally staged upload (already in Storage) waiting to be saved as an asset. */
interface StagedFile {
  url: string;
  name: string;
}

/** What was entered to produce the sheet — stored on the character, editable later. */
interface Recipe {
  description: string;
  biology: string;
  wardrobe: string;
  style: StyleKey;
}

const RECIPE_LABEL = "Recipe";

/** Read the stored inputs back off a saved character. */
function recipeOf(a: Asset): Recipe | null {
  const part = a.parts?.find((p) => p.label === RECIPE_LABEL);
  if (!part) return null;
  try {
    const r = JSON.parse(part.url) as Partial<Recipe>;
    return {
      description: r.description ?? "",
      biology: r.biology ?? "",
      wardrobe: r.wardrobe ?? "",
      style: (r.style as StyleKey) ?? "photoreal",
    };
  } catch {
    return null;
  }
}

export function CharacterStudio() {
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
  const [biology, setBiology] = useState("");
  const [wardrobe, setWardrobe] = useState("");
  const [style, setStyle] = useState<StyleKey>("photoreal");
  const [photos, setPhotos] = useState<StagedFile[]>([]);
  const [voice, setVoice] = useState<StagedFile | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  /** The saved character being viewed/edited (null while making a new one). */
  const [editingId, setEditingId] = useState<string | null>(null);
  /** The character's current sheet URL (existing or freshly rendered). */
  const [sheet, setSheet] = useState<string | null>(null);
  /** Job ids already auto-saved — a render persists exactly once. */
  const savedJobs = useRef<Set<string>>(new Set());
  /** Full-screen view of the sheet. */
  const [fullOpen, setFullOpen] = useState(false);
  const photoRef = useRef<HTMLInputElement>(null);
  const voiceRef = useRef<HTMLInputElement>(null);
  // In-browser voice recording (MediaRecorder) — capped at 60 seconds.
  const [recording, setRecording] = useState(false);
  const [recSecs, setRecSecs] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const recTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const characters = useMemo(
    () => assets.filter((a) => a.class === "character" && (a.parts?.length ?? 0) > 0),
    [assets],
  );
  const needsSignIn = cloudConfigured && !cloudUser;
  // Unsubscribed: keep Generate clickable so it opens the subscribe paywall.
  const locked = cloudConfigured && subscribed === false;

  // The sheet renders on the 2K image model — identity work deserves the detail.
  const model = getModel("seedream-45");
  const cost = priceFor(model, { count: 1 });
  const canAfford = credits >= cost;
  const described = description.trim().length > 3 || photos.length > 0;
  const canGenerate = hydrated && described && canAfford;

  const job = jobId ? videos.find((v) => v.id === jobId) ?? null : null;
  const rendering = job?.status === "rendering";

  const base = [
    photos.length
      ? "the exact person shown in the reference photo — same face, same hair, same body"
      : null,
    description.trim() || null,
    biology.trim() || null,
    wardrobe.trim() ? `wearing ${wardrobe.trim()}` : null,
  ]
    .filter(Boolean)
    .join(", ");

  async function stageFiles(files: FileList | null, kind: "photo" | "voice") {
    if (!files?.length) return;
    if (needsSignIn) {
      setAuthOpen(true);
      return;
    }
    setUploading(true);
    setUploadError(null);
    try {
      for (const file of Array.from(files).slice(0, 1)) {
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
        let url = await uploadDataUrl(uid("charup"), dataUrl);
        if (!url && !cloudConfigured) url = dataUrl;
        if (!url) {
          setUploadError("Upload failed — try again.");
          continue;
        }
        const staged = { url, name: file.name.replace(/\.[^.]+$/, "") };
        if (kind === "photo") setPhotos([staged]);
        else applyVoice(staged);
      }
    } finally {
      setUploading(false);
    }
  }

  /** Record a voice sample right in the browser; stop uploads it to Storage. */
  async function toggleRecord() {
    if (recording) {
      recRef.current?.stop();
      return;
    }
    if (needsSignIn) {
      setAuthOpen(true);
      return;
    }
    setUploadError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : undefined;
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const chunks: BlobPart[] = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recTimer.current) clearInterval(recTimer.current);
        setRecording(false);
        setUploading(true);
        try {
          const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
          // Cloud: straight to Storage. Demo: keep it local as a data URL.
          let url = await uploadFile(uid("charvoice"), blob);
          if (!url) {
            url = await new Promise<string>((res, rej) => {
              const r = new FileReader();
              r.onload = () => res(r.result as string);
              r.onerror = rej;
              r.readAsDataURL(blob);
            });
          }
          applyVoice({ url, name: "Recorded voice" });
        } catch {
          setUploadError("Couldn't save the recording — try again.");
        } finally {
          setUploading(false);
        }
      };
      rec.start();
      recRef.current = rec;
      setRecSecs(0);
      setRecording(true);
      let secs = 0;
      recTimer.current = setInterval(() => {
        secs += 1;
        setRecSecs(secs);
        if (secs >= 60) recRef.current?.stop(); // hard cap
      }, 1000);
    } catch {
      setUploadError("Microphone unavailable — allow mic access and try again.");
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
      aspectRatio: "16:9",
      audio: false,
      modelId: model.id,
      modality: "image",
      direction: description.trim() || name.trim(),
      refImageUrls: photos.length ? photos.map((p) => p.url) : undefined,
    });
    setJobId(id);
    // Safety net: if they navigate away mid-render, the next visit restores
    // this state and the auto-save still lands the paid sheet.
    setPendingSheet("character", {
      jobId: id,
      data: { editingId, name, description, biology, wardrobe, style, photos, voice },
    });
  }

  /**
   * Persist the character from the current form state — automatically after a
   * render, and again whenever the voice or details change on a saved one.
   * A character = a collection of real assets + one composite that bundles
   * them (parts include the Recipe: everything entered to produce the sheet).
   */
  function persistCharacter(overrides?: { sheetUrl?: string | null; voice?: StagedFile | null }) {
    const theSheet = overrides?.sheetUrl !== undefined ? overrides.sheetUrl : sheet;
    const theVoice = overrides?.voice !== undefined ? overrides.voice : voice;
    const charName = name.trim() || "New Character";
    const recipePart: AssetPart = {
      role: "reference",
      kind: "prompt",
      url: JSON.stringify({ description, biology, wardrobe, style } satisfies Recipe),
      label: RECIPE_LABEL,
    };
    const parts: AssetPart[] = [
      ...photos.map((p, i) => ({
        role: "face" as const,
        kind: "image" as const,
        url: p.url,
        posterUrl: p.url,
        label: `Photo ${i + 1}`,
      })),
      ...(theSheet
        ? [{ role: "primary" as const, kind: "image" as const, url: theSheet, posterUrl: theSheet, label: "Character sheet" }]
        : []),
      ...(theVoice ? [{ role: "voice" as const, kind: "audio" as const, url: theVoice.url, label: "Voice" }] : []),
      recipePart,
    ];
    const hero = theSheet ?? photos[0]?.url ?? "";
    const promptFragment = `${charName}${description.trim() ? `, ${description.trim().split(/[,.\n]/)[0].toLowerCase()}` : ""}`;

    if (editingId) {
      const existing = assets.find((a) => a.id === editingId);
      if (!existing) return;
      updateAsset(editingId, { name: charName, url: hero, posterUrl: hero, parts, promptFragment });
      const colId = existing.categoryId;
      if (colId) {
        // Keep the collection in step: one sheet asset, one voice asset.
        const sheetAsset = assets.find((a) => a.categoryId === colId && a.kind === "image" && / character sheet$/.test(a.name));
        if (theSheet && sheetAsset && sheetAsset.url !== theSheet) {
          updateAsset(sheetAsset.id, { url: theSheet, posterUrl: theSheet });
        } else if (theSheet && !sheetAsset) {
          addAsset({ name: `${charName} — character sheet`, kind: "image", url: theSheet, posterUrl: theSheet, categoryId: colId, source: "generation", promptFragment: `${charName}'s character sheet — every angle of them` });
        }
        const voiceAsset = assets.find((a) => a.categoryId === colId && a.kind === "audio");
        if (theVoice && voiceAsset && voiceAsset.url !== theVoice.url) {
          updateAsset(voiceAsset.id, { url: theVoice.url });
        } else if (theVoice && !voiceAsset) {
          addAsset({ name: `${charName} — voice`, kind: "audio", url: theVoice.url, categoryId: colId, source: "upload", promptFragment: `${charName}'s voice` });
        } else if (!theVoice && voiceAsset) {
          removeAsset(voiceAsset.id);
        }
      }
      return;
    }

    const col = addCategory(`${charName} — character`);
    photos.forEach((p, i) => {
      addAsset({ name: `${charName} — photo ${i + 1}`, kind: "image", url: p.url, posterUrl: p.url, categoryId: col.id, source: "upload", promptFragment: `${charName}'s reference photo` });
    });
    if (theSheet) {
      addAsset({ name: `${charName} — character sheet`, kind: "image", url: theSheet, posterUrl: theSheet, categoryId: col.id, source: "generation", promptFragment: `${charName}'s character sheet — every angle of them` });
    }
    if (theVoice) {
      addAsset({ name: `${charName} — voice`, kind: "audio", url: theVoice.url, categoryId: col.id, source: "upload", promptFragment: `${charName}'s voice` });
    }
    const composite = addAsset({
      name: charName,
      kind: "image",
      url: hero,
      posterUrl: hero || undefined,
      categoryId: col.id,
      source: "generation",
      class: "character",
      promptFragment,
      parts,
    } as Omit<Asset, "id" | "createdAt">);
    setEditingId(composite.id);
  }

  // A finished sheet saves the character automatically — nothing to click.
  useEffect(() => {
    if (!job || job.status !== "succeeded" || !job.posterUrl) return;
    if (savedJobs.current.has(job.id)) return;
    savedJobs.current.add(job.id);
    setSheet(job.posterUrl);
    persistCharacter({ sheetUrl: job.posterUrl });
    clearPendingSheet("character");
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
      biology: string;
      wardrobe: string;
      style: StyleKey;
      photos: StagedFile[];
      voice: StagedFile | null;
    }>("character");
    if (!pending) return;
    const pendingJob = useStore.getState().videos.find((v) => v.id === pending.jobId);
    // Not in the store YET may just mean cloud videos haven't hydrated —
    // keep the marker; only a job we can SEE failed is truly dead.
    if (!pendingJob) return;
    if (pendingJob.status === "failed") {
      clearPendingSheet("character");
      return;
    }
    const d = pending.data;
    setEditingId(d.editingId);
    setName(d.name);
    setDescription(d.description);
    setBiology(d.biology);
    setWardrobe(d.wardrobe);
    setStyle(d.style);
    setPhotos(d.photos ?? []);
    setVoice(d.voice ?? null);
    setJobId(pending.jobId);
    setCreating(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  /** Stage a voice and, on a saved character, persist it immediately. */
  function applyVoice(v: StagedFile | null) {
    setVoice(v);
    if (editingId) persistCharacter({ voice: v });
  }

  /** Blank slate for "Add new character". */
  function resetForm() {
    setEditingId(null);
    setName("");
    setDescription("");
    setBiology("");
    setWardrobe("");
    setStyle("photoreal");
    setPhotos([]);
    setVoice(null);
    setJobId(null);
    setSheet(null);
    setUploadError(null);
  }

  /** Open a saved character in full: sheet, recipe, voice — edit & regenerate. */
  function openCharacter(c: Asset) {
    const recipe = recipeOf(c);
    setEditingId(c.id);
    setName(c.name);
    setDescription(recipe?.description ?? "");
    setBiology(recipe?.biology ?? "");
    setWardrobe(recipe?.wardrobe ?? "");
    setStyle(recipe?.style ?? "photoreal");
    const photo = c.parts?.find((p) => p.role === "face");
    setPhotos(photo ? [{ url: photo.url, name: "Photo" }] : []);
    const v = c.parts?.find((p) => p.role === "voice");
    setVoice(v ? { url: v.url, name: "Their voice" } : null);
    const sheetPart = c.parts?.find((p) => p.role === "primary");
    setSheet(sheetPart?.url ?? c.posterUrl ?? null);
    setJobId(null);
    setUploadError(null);
    setCreating(true);
  }

  /** Cast them: their sheets & photos fill image slots, their voice a sound slot. */
  function useInMake(character: Asset) {
    const ids = assets
      .filter((a) => a.categoryId === character.categoryId && a.id !== character.id)
      .map((a) => a.id);
    setDraftElements(ids.length ? ids : [character.id]);
    router.push("/app/make");
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Characters</h1>
        <p className="mt-1 text-sm text-muted">
          Create a character from one photo or a description — get an 8-box reference sheet, give
          them a voice, and cast them in any video.
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
            <Plus size={17} /> Add new character
          </Button>
        </div>
      )}
      {!creating && characters.length === 0 && (
        <EmptyState
          icon={<Plus size={24} />}
          art={[thumbFor("cast-astronaut"), thumbFor("cast-forest-spirit"), thumbFor("cast-desert-nomad")]}
          title="No characters yet"
          description="One photo in, a full character sheet out — face and body from every angle, plus a voice if you record one. Tap “Add new character” to make your first."
        />
      )}

      {/* ------------------------- Saved characters ------------------------- */}
      {!creating && characters.length > 0 && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {characters.map((c) => {
            const hasVoice = c.parts?.some((p) => p.role === "voice");
            const views = c.parts?.filter((p) => p.kind === "image").length ?? 0;
            return (
              <Card key={c.id} className="group overflow-hidden">
                <div className="relative aspect-square bg-surface-2">
                  <button
                    onClick={() => openCharacter(c)}
                    className="block h-full w-full"
                    title={`Open ${c.name}`}
                  >
                    {c.posterUrl || c.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.posterUrl ?? c.url} alt={c.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-faint">
                        <UserRound size={26} />
                      </div>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete ${c.name}? Their sheet assets stay in your library.`)) {
                        removeAsset(c.id);
                      }
                    }}
                    className="absolute right-2 top-2 rounded-lg bg-black/55 p-1.5 text-white transition-opacity hover:bg-black/75 sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label="Delete character"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="p-3">
                  <div className="truncate text-[13.5px] font-semibold">{c.name}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] text-faint">
                    {views} views
                    {hasVoice && (
                      <Badge tone="teal">
                        <Mic size={10} /> Voice
                      </Badge>
                    )}
                  </div>
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
            ← All characters
          </button>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,400px)_1fr]">
        {/* ------------------------------ Form ------------------------------ */}
        <Card className="h-fit p-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-2">
            <UserRound size={14} /> {editingId ? "Edit character" : "New character"}
          </div>

          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-faint">Name</label>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Aria, Kato, Nova…" />

          {/* Photos — build the character from one or more pictures */}
          <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">
            Photo <span className="normal-case">(optional — one clear picture of them)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {photos.map((p, i) => (
              <span key={p.url} className="relative">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={p.name} className="h-14 w-14 rounded-xl border border-line object-cover" />
                <button
                  onClick={() => setPhotos((arr) => arr.filter((_, j) => j !== i))}
                  className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-fg text-bg"
                  aria-label="Remove photo"
                >
                  <X size={10} />
                </button>
              </span>
            ))}
            {photos.length < 1 && (
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
              className="hidden"
              onChange={(e) => {
                void stageFiles(e.target.files, "photo");
                e.target.value = "";
              }}
            />
          </div>

          <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">
            Who are they?
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="A confident creative director in her late 20s, calm and warm…"
            className="w-full resize-none rounded-xl border border-line bg-surface-2 p-3 text-base leading-relaxed text-fg placeholder:text-faint focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 sm:text-sm"
          />

          <label className="mb-1.5 mt-3 block text-xs font-medium uppercase tracking-wide text-faint">
            Biology <span className="normal-case">(body, face, hair — the physical facts)</span>
          </label>
          <textarea
            value={biology}
            onChange={(e) => setBiology(e.target.value)}
            rows={2}
            placeholder="Long blonde hair, blue eyes, fair skin, 175cm, athletic build…"
            className="w-full resize-none rounded-xl border border-line bg-surface-2 p-3 text-base leading-relaxed text-fg placeholder:text-faint focus:border-accent/50 focus:outline-none focus:ring-2 focus:ring-accent/20 sm:text-sm"
          />

          <label className="mb-1.5 mt-3 block text-xs font-medium uppercase tracking-wide text-faint">
            What are they wearing?
          </label>
          <TextInput
            value={wardrobe}
            onChange={(e) => setWardrobe(e.target.value)}
            placeholder="a camel wool coat over a cream sweater, black leggings, ankle boots"
          />

          {/* Voice — optional */}
          <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">
            Voice <span className="normal-case">(optional — a sample of how they sound)</span>
          </label>
          {voice ? (
            <div className="rounded-xl border border-line bg-surface-2 px-3 py-2">
              <span className="flex items-center gap-2 text-[13px]">
                <Mic size={14} className="text-teal" />
                <span className="min-w-0 flex-1 truncate">{voice.name}</span>
                <button onClick={() => applyVoice(null)} className="text-faint hover:text-fg" aria-label="Remove voice">
                  <X size={13} />
                </button>
              </span>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio src={voice.url} controls preload="metadata" className="mt-2 h-8 w-full" />
            </div>
          ) : recording ? (
            <button
              onClick={toggleRecord}
              className="flex items-center gap-2 rounded-xl border border-danger/50 bg-danger/10 px-3 py-2 text-[13px] font-semibold text-danger"
            >
              <span className="h-2 w-2 animate-pulse rounded-full bg-danger" />
              Recording {Math.floor(recSecs / 60)}:{String(recSecs % 60).padStart(2, "0")}
              <Square size={12} className="ml-1" fill="currentColor" /> Stop
            </button>
          ) : (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={toggleRecord}
                disabled={uploading}
                className="flex items-center gap-2 rounded-xl border border-dashed border-line-2 px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:border-accent/50 hover:text-fg"
              >
                <span className="h-2 w-2 rounded-full bg-danger" /> Record their voice
              </button>
              <button
                onClick={() => voiceRef.current?.click()}
                disabled={uploading}
                className="flex items-center gap-2 rounded-xl border border-dashed border-line-2 px-3 py-2 text-[13px] font-medium text-muted transition-colors hover:border-accent/50 hover:text-fg"
              >
                <Mic size={14} className="text-accent-2" /> Upload a sample
              </button>
            </div>
          )}
          <input
            ref={voiceRef}
            type="file"
            accept="audio/*"
            className="hidden"
            onChange={(e) => {
              void stageFiles(e.target.files, "voice");
              e.target.value = "";
            }}
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
                  <Sparkles size={17} /> Regenerate character sheet
                </>
              ) : (
                <>
                  <Sparkles size={17} /> Generate character sheet
                </>
              )}
            </Button>
          )}
          {editingId && !rendering && (
            <Button
              variant="soft"
              className="mt-2 w-full"
              onClick={() => persistCharacter()}
            >
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
                <UserRound size={22} />
              </span>
              <p className="mt-3 max-w-sm text-sm text-muted">
                Your character sheet appears here — one image, eight boxes: the face from four
                directions on top, the full body from four directions below, so their shape,
                width and height read at a glance. It saves itself the moment it renders.
              </p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="relative aspect-video w-full bg-surface-2">
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
                    <img src={sheet} alt="Character sheet" className="h-full w-full object-cover" />
                  </button>
                ) : null}
                <span className="pointer-events-none absolute left-2 top-2">
                  <Badge tone="neutral" className="border-white/20 bg-black/55 text-white backdrop-blur-sm">
                    Character sheet
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
      <Modal open={fullOpen} onClose={() => setFullOpen(false)} size="lg" title={name.trim() || "Character sheet"}>
        {sheet && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={sheet} alt="Character sheet — full size" className="w-full rounded-xl" />
        )}
      </Modal>
    </div>
  );
}
