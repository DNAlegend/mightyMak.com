"use client";

import { useEffect, useMemo, useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Upload,
  Pencil,
  Trash2,
  Sparkles,
  Music,
  Film,
  Image as ImageIcon,
  TextQuote,
  Layers,
  Check,
  ChevronLeft,
  FolderPlus,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { cloudConfigured } from "@/lib/supabase";
import { uploadFile } from "@/lib/cloud";
import type { Asset, AssetKind, Category } from "@/lib/types";
import { isComposite } from "@/lib/types";
import { cn, timeAgo, uid } from "@/lib/utils";
import { Button, EmptyState, Modal, TextInput } from "@/components/ui";
import { thumbFor } from "@/lib/catalog";
import { AssetThumb } from "@/components/shared";

// Signed-in uploads stream straight to cloud Storage — the cap is Storage's
// own per-file limit (50 MB on the current plan). The demo (no account) keeps
// files in browser localStorage, which genuinely can't hold more than ~8 MB.
const MAX_BYTES_CLOUD = 50 * 1024 * 1024;
const MAX_BYTES_LOCAL = 8 * 1024 * 1024;

const kindIcon: Record<AssetKind, typeof ImageIcon> = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  prompt: TextQuote,
};

/** User-facing names for the raw kinds. */
const kindLabel: Record<AssetKind, string> = {
  image: "picture",
  video: "video",
  audio: "sound",
  prompt: "script",
};

/** The raw type buckets the library is organized into — nothing fancier. */
const TYPE_CHIPS: { key: AssetKind | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "video", label: "Videos" },
  { key: "image", label: "Pictures" },
  { key: "audio", label: "Sound" },
  { key: "prompt", label: "Scripts" },
];

/** What to say when a type bucket is empty. */
const EMPTY_HINTS: Record<AssetKind | "all", { title: string; desc: string }> = {
  all: {
    title: "Nothing here",
    desc: "Use the add buttons above, or drag & drop files anywhere on this page.",
  },
  video: {
    title: "No videos yet",
    desc: "Add reference clips (MP4 · MOV, up to 50 MB signed in) — the model imitates their motion. Videos you generate in the Studio can be saved here too.",
  },
  image: {
    title: "No pictures yet",
    desc: "Add product shots, faces or scenes (JPG · PNG · WebP) — used as exact frames or references so the video shows your thing.",
  },
  audio: {
    title: "No sound yet",
    desc: "Add music or voice snippets (MP3 · WAV) — they set the mood of the soundtrack.",
  },
  prompt: {
    title: "No scripts yet",
    desc: "Write reusable text — a brand look, a camera move, a style line for every shot.",
  },
};

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function AssetsView() {
  const router = useRouter();
  const assets = useStore((s) => s.assets);
  const categories = useStore((s) => s.categories);
  const hydrated = useStore((s) => s.hasHydrated);
  const addAsset = useStore((s) => s.addAsset);
  const addCategory = useStore((s) => s.addCategory);
  const renameCategory = useStore((s) => s.renameCategory);
  const removeCategory = useStore((s) => s.removeCategory);
  const moveAsset = useStore((s) => s.moveAsset);
  const removeAsset = useStore((s) => s.removeAsset);
  const setDraftRef = useStore((s) => s.setDraftRef);

  const [filter, setFilter] = useState<AssetKind | "all">("all");
  const [openCol, setOpenCol] = useState<string | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [warn, setWarn] = useState<string | null>(null);
  /** Files are streaming to Storage — big videos take a moment. */
  const [busy, setBusy] = useState(false);
  const cloudUser = useStore((s) => s.cloudUser);
  const [newPromptOpen, setNewPromptOpen] = useState(false);
  const [collectFor, setCollectFor] = useState<string[] | null>(null); // asset ids picking a collection
  const [actionAsset, setActionAsset] = useState<Asset | null>(null);
  const [renameColOpen, setRenameColOpen] = useState(false);
  // Tile-on-tile drag & drop (iOS-style combine into a collection).
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  // A collection just born from a drop — prompt for its name.
  const [namingCol, setNamingCol] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const colIds = useMemo(() => new Set(categories.map((c) => c.id)), [categories]);
  const openColMeta = openCol ? categories.find((c) => c.id === openCol) ?? null : null;

  // The collection was deleted (possibly from another tab) — fall back home.
  useEffect(() => {
    if (openCol && !colIds.has(openCol)) setOpenCol(null);
  }, [openCol, colIds]);

  const inCollection = (id: string) => assets.filter((a) => a.categoryId === id);

  /** Tiles for the current view. Home ("All") hides collection members — they live in their folder. */
  const visible = useMemo(() => {
    if (openCol) return assets.filter((a) => a.categoryId === openCol);
    if (filter !== "all") return assets.filter((a) => a.kind === filter);
    return assets.filter((a) => !a.categoryId || !colIds.has(a.categoryId));
  }, [assets, filter, openCol, colIds]);

  const countFor = (key: AssetKind | "all") =>
    key === "all" ? assets.length : assets.filter((a) => a.kind === key).length;

  function exitSelect() {
    setSelecting(false);
    setSel([]);
  }

  function toggleSel(id: string) {
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function ingest(files: FileList | File[]) {
    // Signed-in accounts stream files straight to Storage (big videos OK);
    // the local demo keeps the small data-URL path so localStorage survives.
    const cloud = cloudConfigured && !!cloudUser;
    const maxBytes = cloud ? MAX_BYTES_CLOUD : MAX_BYTES_LOCAL;
    let skipped = 0;
    let failed = 0;
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        const kind: AssetKind | null = file.type.startsWith("image/")
          ? "image"
          : file.type.startsWith("video/")
            ? "video"
            : file.type.startsWith("audio/")
              ? "audio"
              : null;
        if (!kind || file.size > maxBytes) {
          skipped++;
          continue;
        }
        let url: string;
        if (cloud) {
          const publicUrl = await uploadFile(uid("up"), file);
          if (!publicUrl) {
            failed++;
            continue;
          }
          url = publicUrl;
        } else {
          url = await readAsDataURL(file);
        }
        addAsset({
          name: file.name.replace(/\.[^.]+$/, ""),
          kind,
          url,
          posterUrl: kind === "image" ? url : undefined,
          categoryId: openCol, // uploading inside a collection files it there
          source: "upload",
        });
      }
    } finally {
      setBusy(false);
    }
    const notes: string[] = [];
    if (skipped > 0)
      notes.push(
        `${skipped} file${skipped > 1 ? "s were" : " was"} skipped (must be an image, video, or audio under ${cloud ? 50 : 8} MB${cloud ? "" : " — sign in for up to 50 MB"}).`,
      );
    if (failed > 0) notes.push(`${failed} upload${failed > 1 ? "s" : ""} failed — try again.`);
    setWarn(notes.length ? notes.join(" ") : null);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) ingest(e.dataTransfer.files);
  }

  /** Drop asset A onto asset B: join B's collection, or found a new one together. */
  function combineTiles(targetId: string) {
    if (!dragId || dragId === targetId) return;
    const target = assets.find((a) => a.id === targetId);
    if (!target) return;
    if (target.categoryId && colIds.has(target.categoryId)) {
      moveAsset(dragId, target.categoryId); // target already lives in a collection
    } else {
      const cat = addCategory("New collection");
      moveAsset(dragId, cat.id);
      moveAsset(targetId, cat.id);
      setNamingCol(cat.id); // two in — ask for the name
    }
    setDragId(null);
    setOverId(null);
  }

  function dropIntoCollection(catId: string) {
    if (!dragId) return;
    moveAsset(dragId, catId);
    setDragId(null);
    setOverId(null);
  }

  if (!hydrated) return <div className="mx-auto h-8 max-w-5xl w-40 rounded bg-surface-2" />;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Assets</h1>
        {assets.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => (selecting ? exitSelect() : setSelecting(true))}>
            {selecting ? "Done" : "Select"}
          </Button>
        )}
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*"
          className="hidden"
          onChange={(e) => e.target.files && ingest(e.target.files)}
        />
      </header>

      {/* The four ways in — plain and simple. */}
      <div className="mb-4 flex flex-wrap gap-2">
        {(
          [
            { label: "Add video", icon: Film, accept: "video/*" },
            { label: "Add picture", icon: ImageIcon, accept: "image/*" },
            { label: "Add sound", icon: Music, accept: "audio/*" },
            { label: "Add script", icon: TextQuote, accept: null },
          ] as const
        ).map((x) => (
          <button
            key={x.label}
            onClick={() => {
              if (!x.accept) {
                setNewPromptOpen(true);
                return;
              }
              if (fileRef.current) {
                fileRef.current.accept = x.accept;
                fileRef.current.click();
              }
            }}
            className="flex items-center gap-2 rounded-xl border border-dashed border-line-2 px-3.5 py-2 text-[13px] font-medium text-muted transition-colors hover:border-accent/50 hover:text-fg"
          >
            <x.icon size={15} className="text-accent-2" /> {x.label}
          </button>
        ))}
      </div>

      {/* Inside a collection: back + name + manage. Home: type chips. */}
      {openColMeta ? (
        <div className="mb-4 flex items-center gap-2">
          <button
            onClick={() => { setOpenCol(null); exitSelect(); }}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <ChevronLeft size={16} /> All assets
          </button>
          <h2 className="text-[15px] font-semibold">{openColMeta.name}</h2>
          <span className="text-xs text-faint">{inCollection(openColMeta.id).length}</span>
          <span className="ml-auto flex items-center gap-1">
            <button
              onClick={() => setRenameColOpen(true)}
              className="rounded-lg p-1.5 text-faint transition-colors hover:bg-surface-2 hover:text-fg"
              aria-label="Rename collection"
            >
              <Pencil size={14} />
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete “${openColMeta.name}”? Its items go back to the library.`)) {
                  removeCategory(openColMeta.id);
                  setOpenCol(null);
                }
              }}
              className="rounded-lg p-1.5 text-faint transition-colors hover:bg-surface-2 hover:text-danger"
              aria-label="Delete collection"
            >
              <Trash2 size={14} />
            </button>
          </span>
        </div>
      ) : (
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {TYPE_CHIPS.map((t) => (
            <button
              key={t.key}
              onClick={() => setFilter(t.key)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition-colors",
                filter === t.key
                  ? "border-accent/40 bg-accent-soft text-fg"
                  : "border-line text-muted hover:border-faint hover:text-fg",
              )}
            >
              {t.label} <span className="text-faint">{countFor(t.key)}</span>
            </button>
          ))}
        </div>
      )}

      <section
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragId) setDragOver(true); // file drops only — not internal tile drags
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "min-h-[300px] rounded-[var(--radius-xl2)] transition-colors",
          dragOver && "outline-2 outline-dashed outline-accent/60",
        )}
      >
        {busy && (
          <div className="mb-3 rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs text-muted">
            Uploading… big videos can take a moment.
          </div>
        )}
        {warn && (
          <div className="mb-3 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
            {warn}
          </div>
        )}

        {assets.length === 0 ? (
          <EmptyState
            icon={<Upload size={24} />}
            art={[thumbFor("prod-sneakers"), thumbFor("dress-evening-gown"), thumbFor("set-enchanted-forest")]}
            title="Your library is empty"
            description="Add the pictures, videos, sound and scripts your videos are made from — use the buttons above, or drag & drop files anywhere on this page. Select a few later and collect them into a set."
          />
        ) : openCol && visible.length === 0 ? (
          <EmptyState
            icon={<Layers size={24} />}
            title="Empty collection"
            description="Add something with the buttons above (it files straight into this collection), or go back, hit Select, and collect existing assets."
          />
        ) : !openCol && visible.length === 0 && (filter !== "all" || categories.length === 0) ? (
          <EmptyState
            icon={filter === "prompt" ? <TextQuote size={24} /> : <Upload size={24} />}
            title={EMPTY_HINTS[filter].title}
            description={EMPTY_HINTS[filter].desc}
          />
        ) : (
          <div className="grid grid-cols-4 gap-x-3 gap-y-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7">
            {!openCol &&
              filter === "all" &&
              categories.map((c) => (
                <FolderTile
                  key={c.id}
                  c={c}
                  items={inCollection(c.id)}
                  dimmed={selecting}
                  dropReady={!!dragId && overId === c.id}
                  onOpen={() => !selecting && setOpenCol(c.id)}
                  onDragEnter={() => dragId && setOverId(c.id)}
                  onDragLeave={() => setOverId((o) => (o === c.id ? null : o))}
                  onDropAsset={() => dropIntoCollection(c.id)}
                />
              ))}
            {visible.map((a) => (
              <IconTile
                key={a.id}
                a={a}
                selecting={selecting}
                selected={sel.includes(a.id)}
                dragging={dragId === a.id}
                dropReady={!!dragId && dragId !== a.id && overId === a.id}
                draggable={!selecting && !openCol}
                onClick={() => (selecting ? toggleSel(a.id) : setActionAsset(a))}
                onDragStart={() => setDragId(a.id)}
                onDragEnd={() => {
                  setDragId(null);
                  setOverId(null);
                }}
                onDragEnter={() => dragId && dragId !== a.id && setOverId(a.id)}
                onDragLeave={() => setOverId((o) => (o === a.id ? null : o))}
                onDropAsset={() => combineTiles(a.id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Selection action bar */}
      {selecting && sel.length > 0 && (
        <div className="animate-rise fixed bottom-20 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-2xl border border-line bg-surface px-2 py-1.5 shadow-[0_16px_40px_-16px_rgba(16,18,27,0.4)] md:bottom-6">
          <span className="px-2 text-sm font-medium tabular-nums">{sel.length} selected</span>
          <Button size="sm" variant="soft" onClick={() => setCollectFor(sel)}>
            <FolderPlus size={15} /> Collect
          </Button>
          {openCol && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                sel.forEach((id) => moveAsset(id, null));
                exitSelect();
              }}
            >
              Remove
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-danger"
            onClick={() => {
              if (confirm(`Delete ${sel.length} asset${sel.length > 1 ? "s" : ""}? This can't be undone.`)) {
                sel.forEach((id) => removeAsset(id));
                exitSelect();
              }
            }}
          >
            <Trash2 size={15} />
          </Button>
          <button onClick={exitSelect} className="rounded-lg p-1.5 text-faint hover:text-fg" aria-label="Cancel selection">
            <X size={15} />
          </button>
        </div>
      )}

      <NewPromptModal
        open={newPromptOpen}
        onClose={() => setNewPromptOpen(false)}
        onSubmit={(name, text) => {
          addAsset({
            name,
            kind: "prompt",
            url: "",
            categoryId: openCol,
            source: "upload",
            promptFragment: text,
          });
          setNewPromptOpen(false);
        }}
      />

      <CollectModal
        open={collectFor !== null}
        collections={categories}
        countFor={(id) => inCollection(id).length}
        onClose={() => setCollectFor(null)}
        onPick={(catId) => {
          (collectFor ?? []).forEach((id) => moveAsset(id, catId));
          setCollectFor(null);
          exitSelect();
        }}
        onCreate={(name) => {
          const cat = addCategory(name);
          (collectFor ?? []).forEach((id) => moveAsset(id, cat.id));
          setCollectFor(null);
          exitSelect();
        }}
      />

      {actionAsset && (
        <AssetActions
          asset={actionAsset}
          onClose={() => setActionAsset(null)}
          onUse={() => {
            setDraftRef(actionAsset.id);
            router.push("/app/make");
          }}
          onCollect={() => {
            setCollectFor([actionAsset.id]);
            setActionAsset(null);
          }}
        />
      )}

      <RenameModal
        open={renameColOpen}
        initial={openColMeta?.name ?? ""}
        onClose={() => setRenameColOpen(false)}
        onSubmit={(name) => {
          if (openCol) renameCategory(openCol, name);
          setRenameColOpen(false);
        }}
      />

      {/* Two tiles just combined — christen the new collection. */}
      <RenameModal
        open={namingCol !== null}
        title="Name the collection"
        initial=""
        placeholder="e.g. Spring campaign"
        onClose={() => setNamingCol(null)}
        onSubmit={(name) => {
          if (namingCol) renameCategory(namingCol, name);
          setNamingCol(null);
        }}
      />
    </div>
  );
}

/* --------------------------------- Tiles --------------------------------- */

function IconTile({
  a,
  selecting,
  selected,
  dragging = false,
  dropReady = false,
  draggable = false,
  onClick,
  onDragStart,
  onDragEnd,
  onDragEnter,
  onDragLeave,
  onDropAsset,
}: {
  a: Asset;
  selecting: boolean;
  selected: boolean;
  dragging?: boolean;
  /** Another tile is hovering over this one — about to combine. */
  dropReady?: boolean;
  draggable?: boolean;
  onClick: () => void;
  onDragStart?: () => void;
  onDragEnd?: () => void;
  onDragEnter?: () => void;
  onDragLeave?: () => void;
  onDropAsset?: () => void;
}) {
  const Icon = kindIcon[a.kind];
  return (
    <button
      onClick={onClick}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", a.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart?.();
      }}
      onDragEnd={onDragEnd}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        onDragEnter?.();
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDropAsset?.();
      }}
      className={cn("group text-center transition-opacity", dragging && "opacity-40")}
    >
      <span
        className={cn(
          "relative block aspect-square w-full overflow-hidden rounded-2xl border bg-surface-2 transition-all",
          dropReady
            ? "scale-110 border-accent ring-2 ring-accent/50"
            : selected
              ? "border-accent ring-2 ring-accent/40"
              : "border-line group-hover:border-faint",
        )}
      >
        {a.kind === "prompt" ? (
          <span className="flex h-full w-full items-center justify-center bg-accent-soft text-accent-2">
            <TextQuote size={20} />
          </span>
        ) : (
          <AssetThumb a={a} className="h-full w-full" />
        )}
        {a.kind !== "prompt" && (
          <span className="absolute bottom-1 right-1 rounded-md bg-black/55 p-[3px] text-white">
            <Icon size={9} />
          </span>
        )}
        {selecting && (
          <span
            className={cn(
              "absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full border",
              selected ? "border-accent bg-accent text-white" : "border-white/70 bg-black/25 backdrop-blur-sm",
            )}
          >
            {selected && <Check size={12} />}
          </span>
        )}
      </span>
      <span className="mt-1 block truncate text-[11px] text-muted">{a.name}</span>
    </button>
  );
}

/** iPhone-folder-style tile: a mini grid of the collection's first items. */
function FolderTile({
  c,
  items,
  dimmed,
  dropReady = false,
  onOpen,
  onDragEnter,
  onDragLeave,
  onDropAsset,
}: {
  c: Category;
  items: Asset[];
  dimmed: boolean;
  /** A tile is hovering over this folder — about to drop in. */
  dropReady?: boolean;
  onOpen: () => void;
  onDragEnter?: () => void;
  onDragLeave?: () => void;
  onDropAsset?: () => void;
}) {
  const previews = items.slice(0, 4);
  return (
    <button
      onClick={onOpen}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        onDragEnter?.();
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDropAsset?.();
      }}
      className={cn("group text-center", dimmed && "cursor-default opacity-40")}
    >
      <span
        className={cn(
          "block aspect-square w-full rounded-2xl border bg-surface-3/60 p-1.5 transition-all group-hover:border-faint",
          dropReady ? "scale-110 border-accent ring-2 ring-accent/50" : "border-line",
        )}
      >
        <span className="grid h-full w-full grid-cols-2 grid-rows-2 gap-1">
          {Array.from({ length: 4 }).map((_, i) =>
            previews[i] ? (
              <span key={i} className="overflow-hidden rounded-lg bg-surface-2">
                {previews[i].kind === "prompt" ? (
                  <span className="flex h-full w-full items-center justify-center bg-accent-soft text-accent-2">
                    <TextQuote size={11} />
                  </span>
                ) : (
                  <AssetThumb a={previews[i]} className="h-full w-full" />
                )}
              </span>
            ) : (
              <span key={i} className="rounded-lg bg-surface-2/70" />
            ),
          )}
        </span>
      </span>
      <span className="mt-1 block truncate text-[11px] font-medium text-fg">{c.name}</span>
      <span className="block text-[10px] tabular-nums text-faint">{items.length}</span>
    </button>
  );
}

/* --------------------------------- Modals -------------------------------- */

/** Pick an existing collection or create a new one for the given assets. */
function CollectModal({
  open,
  collections,
  countFor,
  onClose,
  onPick,
  onCreate,
}: {
  open: boolean;
  collections: Category[];
  countFor: (id: string) => number;
  onClose: () => void;
  onPick: (catId: string) => void;
  onCreate: (name: string) => void;
}) {
  const [name, setName] = useState("");
  useEffect(() => {
    if (open) setName("");
  }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="Add to collection" size="sm">
      {collections.length > 0 && (
        <div className="mb-4 space-y-1">
          {collections.map((c) => (
            <button
              key={c.id}
              onClick={() => onPick(c.id)}
              className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-sm text-fg transition-colors hover:bg-surface-2"
            >
              <span className="flex items-center gap-2.5">
                <Layers size={16} className="text-faint" /> {c.name}
              </span>
              <span className="text-xs tabular-nums text-faint">{countFor(c.id)}</span>
            </button>
          ))}
        </div>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onCreate(name.trim());
        }}
        className="flex gap-2"
      >
        <TextInput
          autoFocus={collections.length === 0}
          value={name}
          placeholder="New collection — e.g. Spring campaign"
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" size="sm" disabled={!name.trim()}>
          <FolderPlus size={15} /> Create
        </Button>
      </form>
    </Modal>
  );
}

function AssetActions({
  asset,
  onClose,
  onUse,
  onCollect,
}: {
  asset: Asset;
  onClose: () => void;
  onUse: () => void;
  onCollect: () => void;
}) {
  const removeAsset = useStore((s) => s.removeAsset);
  const renameAsset = useStore((s) => s.renameAsset);
  const [mode, setMode] = useState<"menu" | "rename">("menu");
  const [name, setName] = useState(asset.name);

  return (
    <Modal open onClose={onClose} title={mode === "rename" ? "Rename asset" : asset.name} size="sm">
      {mode === "menu" && (
        <div className="space-y-1">
          <div className="mb-2 flex items-center gap-1.5 px-1 text-[11.5px] text-faint">
            <span className="capitalize">{kindLabel[asset.kind]}</span>
            <span>·</span>
            {timeAgo(asset.createdAt)}
            {isComposite(asset) && (
              <>
                <span>·</span>
                <Layers size={11} /> {asset.parts!.length} parts
              </>
            )}
          </div>
          {asset.kind === "prompt" && asset.promptFragment && (
            <p className="mb-2 rounded-xl border border-line bg-surface-2 p-3 text-[13px] leading-relaxed text-muted">
              “{asset.promptFragment}”
            </p>
          )}
          <ActionItem icon={<Sparkles size={16} />} label="Use in Studio" onClick={() => { onUse(); onClose(); }} />
          <ActionItem icon={<FolderPlus size={16} />} label="Add to collection" onClick={onCollect} />
          <ActionItem icon={<Pencil size={16} />} label="Rename" onClick={() => setMode("rename")} />
          <ActionItem
            icon={<Trash2 size={16} />}
            label="Delete"
            danger
            onClick={() => {
              removeAsset(asset.id);
              onClose();
            }}
          />
        </div>
      )}

      {mode === "rename" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.trim()) renameAsset(asset.id, name.trim());
            onClose();
          }}
        >
          <TextInput value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="sm">Save</Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function ActionItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
        danger ? "text-danger hover:bg-danger/10" : "text-fg hover:bg-surface-2",
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function RenameModal({
  open,
  initial,
  title = "Rename collection",
  placeholder,
  onClose,
  onSubmit,
}: {
  open: boolean;
  initial: string;
  title?: string;
  placeholder?: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  useEffect(() => {
    if (open) setName(initial);
  }, [open, initial]);
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSubmit(name.trim());
        }}
      >
        <TextInput
          autoFocus
          value={name}
          placeholder={placeholder}
          onChange={(e) => setName(e.target.value)}
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm">Save</Button>
        </div>
      </form>
    </Modal>
  );
}

function NewPromptModal({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (name: string, text: string) => void;
}) {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  useEffect(() => {
    if (open) {
      setName("");
      setText("");
    }
  }, [open]);
  return (
    <Modal open={open} onClose={onClose} title="Add script" size="md">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const body = text.trim();
          if (!body) return;
          onSubmit(name.trim() || body.slice(0, 40), body);
        }}
      >
        <div className="space-y-3">
          <TextInput
            autoFocus
            value={name}
            placeholder="Name (optional) — e.g. Brand look"
            onChange={(e) => setName(e.target.value)}
          />
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="The text — e.g. warm golden-hour light, shallow depth of field, filmed on 35mm"
            rows={5}
            className="w-full resize-none rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-base text-fg placeholder:text-faint focus:border-accent/50 focus:outline-none sm:text-sm"
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" disabled={!text.trim()}>Save script</Button>
        </div>
      </form>
    </Modal>
  );
}
