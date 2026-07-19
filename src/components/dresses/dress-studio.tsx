"use client";

// Wardrobe — the simple one. Upload a photo (or a few) of an outfit, name
// it, save. The outfit becomes a dress-class composite whose photos ride as
// references in the Studio, so a character can wear the exact garment from
// your pictures in any shot. No generation, no sheet — just your images.

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ImagePlus, Loader2, Plus, Shirt, Sparkles, Trash2, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { cloudConfigured } from "@/lib/supabase";
import { uploadDataUrl } from "@/lib/cloud";
import type { Asset, AssetPart } from "@/lib/types";
import { uid } from "@/lib/utils";
import { Button, Card, EmptyState, TextInput } from "@/components/ui";
import { thumbFor } from "@/lib/catalog";

/** A locally staged upload (already in Storage) waiting to be saved. */
interface StagedFile {
  url: string;
  name: string;
}

export function DressStudio() {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const assets = useStore((s) => s.assets);
  const addAsset = useStore((s) => s.addAsset);
  const addCategory = useStore((s) => s.addCategory);
  const removeAsset = useStore((s) => s.removeAsset);
  const updateAsset = useStore((s) => s.updateAsset);
  const setDraftElements = useStore((s) => s.setDraftElements);
  const cloudUser = useStore((s) => s.cloudUser);
  const setAuthOpen = useStore((s) => s.setAuthOpen);

  const [name, setName] = useState("");
  const [photos, setPhotos] = useState<StagedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  /** The saved outfit being viewed/edited (null while making a new one). */
  const [editingId, setEditingId] = useState<string | null>(null);
  const photoRef = useRef<HTMLInputElement>(null);

  const dresses = useMemo(
    () => assets.filter((a) => a.class === "dress" && (a.parts?.length ?? 0) > 0),
    [assets],
  );
  const needsSignIn = cloudConfigured && !cloudUser;

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
        let url = await uploadDataUrl(uid("dressup"), dataUrl);
        if (!url && !cloudConfigured) url = dataUrl;
        if (!url) {
          setUploadError("Upload failed — try again.");
          continue;
        }
        setPhotos((p) => [...p, { url, name: file.name.replace(/\.[^.]+$/, "") }].slice(0, 4));
      }
    } finally {
      setUploading(false);
      if (photoRef.current) photoRef.current.value = "";
    }
  }

  /** Save the outfit: photos as parts, the first photo as its face. */
  function persistDress() {
    if (!photos.length) return;
    const outfitName = name.trim() || "New Outfit";
    const hero = photos[0].url;
    const parts: AssetPart[] = photos.map((p, i) => ({
      role: i === 0 ? ("primary" as const) : ("reference" as const),
      kind: "image" as const,
      url: p.url,
      posterUrl: p.url,
      label: `Photo ${i + 1}`,
    }));
    const promptFragment = `${outfitName} — the exact outfit shown in its reference photos, same cut, colour and fabric`;

    if (editingId) {
      updateAsset(editingId, { name: outfitName, url: hero, posterUrl: hero, parts, promptFragment });
    } else {
      const col = addCategory(`${outfitName} — outfit`);
      photos.forEach((p, i) => {
        addAsset({
          name: `${outfitName} — photo ${i + 1}`,
          kind: "image",
          url: p.url,
          posterUrl: p.url,
          categoryId: col.id,
          source: "upload",
          promptFragment: `${outfitName}'s reference photo`,
        });
      });
      addAsset({
        name: outfitName,
        kind: "image",
        url: hero,
        posterUrl: hero,
        categoryId: col.id,
        source: "upload",
        class: "dress",
        promptFragment,
        parts,
      } as Omit<Asset, "id" | "createdAt">);
    }
    resetForm();
    setCreating(false);
  }

  function resetForm() {
    setEditingId(null);
    setName("");
    setPhotos([]);
    setUploadError(null);
  }

  /** Open a saved outfit to rename or swap photos. */
  function openDress(d: Asset) {
    setEditingId(d.id);
    setName(d.name);
    const photoParts = (d.parts ?? []).filter((p) => p.kind === "image");
    setPhotos(photoParts.map((p, i) => ({ url: p.url, name: `Photo ${i + 1}` })));
    setUploadError(null);
    setCreating(true);
  }

  /** Dress the scene: its photos fill image slots in the Studio. */
  function useInMake(dress: Asset) {
    setDraftElements([dress.id]);
    router.push("/app/make");
  }

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Wardrobe</h1>
        <p className="mt-1 text-sm text-muted">
          Upload photos of an outfit and name it — then dress your characters in the exact same
          garment in any video.
        </p>
      </header>

      {/* Gallery first — the form hides behind "Add new". */}
      {!creating && (
        <div className="mb-5">
          <Button
            size="lg"
            onClick={() => {
              resetForm();
              setCreating(true);
            }}
          >
            <Plus size={17} /> Add new outfit
          </Button>
        </div>
      )}
      {!creating && dresses.length === 0 && (
        <EmptyState
          icon={<Plus size={24} />}
          art={[thumbFor("dress-evening-gown"), thumbFor("dress-kimono"), thumbFor("dress-cyber-armor")]}
          title="No outfits yet"
          description="Upload a photo of an outfit and your characters can wear the exact same garment. Tap “Add new outfit” to save your first."
        />
      )}

      {/* -------------------------- Saved outfits -------------------------- */}
      {!creating && dresses.length > 0 && (
        <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {dresses.map((d) => {
            const views = d.parts?.filter((p) => p.kind === "image").length ?? 0;
            return (
              <Card key={d.id} className="group overflow-hidden">
                <div className="relative aspect-square bg-surface-2">
                  <button onClick={() => openDress(d)} className="block h-full w-full" title={`Open ${d.name}`}>
                    {d.posterUrl || d.url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={d.posterUrl ?? d.url} alt={d.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-faint">
                        <Shirt size={26} />
                      </div>
                    )}
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete ${d.name}? Its photos stay in your library.`)) {
                        removeAsset(d.id);
                      }
                    }}
                    className="absolute right-2 top-2 rounded-lg bg-black/55 p-1.5 text-white transition-opacity hover:bg-black/75 sm:opacity-0 sm:group-hover:opacity-100"
                    aria-label="Delete outfit"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
                <div className="p-3">
                  <div className="truncate text-[13.5px] font-semibold">{d.name}</div>
                  <div className="mt-1 text-[11px] text-faint">{views} {views === 1 ? "photo" : "photos"}</div>
                  <Button size="sm" variant="soft" className="mt-2 w-full" onClick={() => useInMake(d)}>
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
            ← All outfits
          </button>
          <Card className="max-w-md p-5">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-accent-2">
              <Shirt size={14} /> {editingId ? "Edit outfit" : "New outfit"}
            </div>

            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-faint">Name</label>
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Scarlet Gown, Midnight Tux…" />

            <label className="mb-1.5 mt-4 block text-xs font-medium uppercase tracking-wide text-faint">
              Photos <span className="normal-case">(1 to 4 pictures of the outfit)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {photos.map((p, i) => (
                <span key={p.url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt={p.name} className="h-20 w-20 rounded-xl border border-line object-cover" />
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
                  className="flex h-20 w-20 items-center justify-center rounded-xl border border-dashed border-line-2 text-faint transition-colors hover:border-accent/50 hover:text-accent-2"
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
            {uploadError && <p className="mt-2 text-xs text-danger">{uploadError}</p>}

            {needsSignIn ? (
              <Button size="lg" className="mt-5 w-full" onClick={() => setAuthOpen(true)}>
                <Check size={17} /> Sign in to save
              </Button>
            ) : (
              <Button size="lg" className="mt-5 w-full" disabled={!photos.length} onClick={persistDress}>
                <Check size={17} /> {editingId ? "Save changes" : "Save outfit"}
              </Button>
            )}
            <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
              The first photo is the outfit&rsquo;s cover. In the Studio, its photos ride as
              references so the exact same garment appears in your shots.
            </p>
          </Card>
        </>
      )}
    </div>
  );
}
