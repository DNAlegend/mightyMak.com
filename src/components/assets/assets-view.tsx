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
import type { Asset, AssetKind, Category } from "@/lib/types";
import { isComposite } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";
import { Button, EmptyState, Modal, TextInput } from "@/components/ui";
import { AssetThumb } from "@/components/shared";

const MAX_BYTES = 8 * 1024 * 1024; // keep within browser storage for the demo

const kindIcon: Record<AssetKind, typeof ImageIcon> = {
  image: ImageIcon,
  video: Film,
  audio: Music,
  prompt: TextQuote,
};

/** The raw type buckets the library is organized into — nothing fancier. */
const TYPE_CHIPS: { key: AssetKind | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "video", label: "Videos" },
  { key: "image", label: "Pictures" },
  { key: "audio", label: "Sound" },
  { key: "prompt", label: "Prompts" },
];

/** What to say when a type bucket is empty — teach, don't just apologize. */
const EMPTY_HINTS: Record<AssetKind | "all", { title: string; desc: string }> = {
  all: {
    title: "Nothing here",
    desc: "Drag & drop files anywhere on this page, or use the Upload button.",
  },
  video: {
    title: "No videos yet",
    desc: "Upload reference clips (MP4 · MOV, under 8 MB) — the model imitates their motion and energy. Videos you generate can be saved here too.",
  },
  image: {
    title: "No pictures yet",
    desc: "Upload product shots, faces or scenes (JPG · PNG · WebP). Pictures steer your videos — as the exact first/last frame, or as reference images the model copies.",
  },
  audio: {
    title: "No sound yet",
    desc: "Upload music or voice snippets (MP3 · WAV). Sound flavors the written prompt when you generate.",
  },
  prompt: {
    title: "No prompts yet",
    desc: "Save prompt snippets you want to reuse — a brand look, a camera move, a style line for every shot.",
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
  const [newPromptOpen, setNewPromptOpen] = useState(false);
  const [collectFor, setCollectFor] = useState<string[] | null>(null); // asset ids picking a collection
  const [actionAsset, setActionAsset] = useState<Asset | null>(null);
  const [renameColOpen, setRenameColOpen] = useState(false);
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
    let skipped = 0;
    for (const file of Array.from(files)) {
      const kind: AssetKind | null = file.type.startsWith("image/")
        ? "image"
        : file.type.startsWith("video/")
          ? "video"
          : file.type.startsWith("audio/")
            ? "audio"
            : null;
      if (!kind || file.size > MAX_BYTES) {
        skipped++;
        continue;
      }
      const url = await readAsDataURL(file);
      addAsset({
        name: file.name.replace(/\.[^.]+$/, ""),
        kind,
        url,
        posterUrl: kind === "image" ? url : undefined,
        categoryId: openCol, // uploading inside a collection files it there
        source: "upload",
      });
    }
    if (skipped > 0)
      setWarn(`${skipped} file${skipped > 1 ? "s were" : " was"} skipped (must be an image, video, or audio under 8 MB).`);
    else setWarn(null);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.length) ingest(e.dataTransfer.files);
  }

  if (!hydrated) return <div className="mx-auto h-8 max-w-5xl w-40 rounded bg-surface-2" />;

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Assets</h1>
        <div className="flex items-center gap-2">
          {assets.length > 0 && (
            <Button variant="ghost" size="sm" onClick={() => (selecting ? exitSelect() : setSelecting(true))}>
              {selecting ? "Done" : "Select"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setNewPromptOpen(true)}>
            <TextQuote size={15} /> New prompt
          </Button>
          <Button size="sm" onClick={() => fileRef.current?.click()}>
            <Upload size={15} /> Upload
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,video/*,audio/*"
          className="hidden"
          onChange={(e) => e.target.files && ingest(e.target.files)}
        />
      </header>

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
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={cn(
          "min-h-[300px] rounded-[var(--radius-xl2)] transition-colors",
          dragOver && "outline-2 outline-dashed outline-accent/60",
        )}
      >
        {warn && (
          <div className="mb-3 rounded-xl border border-warn/30 bg-warn/10 px-3 py-2 text-xs text-warn">
            {warn}
          </div>
        )}

        {assets.length === 0 ? (
          <StartHere onUpload={() => fileRef.current?.click()} onNewPrompt={() => setNewPromptOpen(true)} />
        ) : openCol && visible.length === 0 ? (
          <EmptyState
            icon={<Layers size={24} />}
            title="Empty collection"
            description="Upload here to file things directly into it, or go back, hit Select, and add existing assets."
            action={
              <Button variant="soft" onClick={() => fileRef.current?.click()}>
                <Upload size={16} /> Upload into this collection
              </Button>
            }
          />
        ) : !openCol && visible.length === 0 && (filter !== "all" || categories.length === 0) ? (
          <EmptyState
            icon={filter === "prompt" ? <TextQuote size={24} /> : <Upload size={24} />}
            title={EMPTY_HINTS[filter].title}
            description={EMPTY_HINTS[filter].desc}
            action={
              filter === "prompt" ? (
                <Button variant="soft" onClick={() => setNewPromptOpen(true)}>
                  <TextQuote size={16} /> New prompt
                </Button>
              ) : (
                <Button variant="soft" onClick={() => fileRef.current?.click()}>
                  <Upload size={16} /> Upload files
                </Button>
              )
            }
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
                  onOpen={() => !selecting && setOpenCol(c.id)}
                />
              ))}
            {visible.map((a) => (
              <IconTile
                key={a.id}
                a={a}
                selecting={selecting}
                selected={sel.includes(a.id)}
                onClick={() => (selecting ? toggleSel(a.id) : setActionAsset(a))}
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
            router.push("/app");
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
    </div>
  );
}

/* --------------------------------- Tiles --------------------------------- */

function IconTile({
  a,
  selecting,
  selected,
  onClick,
}: {
  a: Asset;
  selecting: boolean;
  selected: boolean;
  onClick: () => void;
}) {
  const Icon = kindIcon[a.kind];
  return (
    <button onClick={onClick} className="group text-center">
      <span
        className={cn(
          "relative block aspect-square w-full overflow-hidden rounded-2xl border bg-surface-2 transition-all",
          selected ? "border-accent ring-2 ring-accent/40" : "border-line group-hover:border-faint",
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
  onOpen,
}: {
  c: Category;
  items: Asset[];
  dimmed: boolean;
  onOpen: () => void;
}) {
  const previews = items.slice(0, 4);
  return (
    <button onClick={onOpen} className={cn("group text-center", dimmed && "cursor-default opacity-40")}>
      <span className="block aspect-square w-full rounded-2xl border border-line bg-surface-3/60 p-1.5 transition-colors group-hover:border-faint">
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

/* --------------------------- First-run guidance --------------------------- */

/** First-run guide: the library is empty by design — show how to fill it. */
function StartHere({ onUpload, onNewPrompt }: { onUpload: () => void; onNewPrompt: () => void }) {
  const tiles = [
    {
      icon: ImageIcon,
      title: "Pictures",
      body: "Product shots, faces, scenes. Use one as the exact first or last frame, or as reference images the model copies — so the video shows your thing, not a lookalike.",
      action: "Upload JPG · PNG · WebP",
      onClick: onUpload,
    },
    {
      icon: Film,
      title: "Videos",
      body: "Reference clips whose motion and energy the model imitates. Anything you generate in Make can be saved back here and reused.",
      action: "Upload MP4 · MOV",
      onClick: onUpload,
    },
    {
      icon: Music,
      title: "Sound",
      body: "Music and voice snippets. They flavor the written prompt, steering the mood of the soundtrack your video is generated with.",
      action: "Upload MP3 · WAV",
      onClick: onUpload,
    },
    {
      icon: TextQuote,
      title: "Prompts",
      body: "Reusable text — your brand look, a favorite camera move, a style line you want in every shot. Drop one into any generation.",
      action: "Write a prompt",
      onClick: onNewPrompt,
    },
  ];
  return (
    <div>
      <div className="rounded-[var(--radius-xl2)] border border-line bg-surface p-6 text-center">
        <h2 className="font-display text-lg font-bold tracking-tight">Your library is empty — that&apos;s the starting point</h2>
        <p className="mx-auto mt-1.5 max-w-lg text-[13.5px] leading-relaxed text-muted">
          Assets are the raw material your videos are made from. Three ways to add them: upload
          files (or drag &amp; drop anywhere on this page), save something you generated in{" "}
          <span className="font-medium text-fg">Make</span>, or write a reusable prompt. Then
          group anything into collections — select a few items and hit Collect.
        </p>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {tiles.map((t) => (
          <div key={t.title} className="flex flex-col rounded-[var(--radius-xl2)] border border-line bg-surface p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-soft text-accent-2">
              <t.icon size={19} />
            </span>
            <h3 className="mt-3 text-[15px] font-semibold">{t.title}</h3>
            <p className="mt-1 flex-1 text-[13px] leading-relaxed text-muted">{t.body}</p>
            <button
              onClick={t.onClick}
              className="mt-3 self-start text-[13px] font-semibold text-accent-2 transition-colors hover:text-accent"
            >
              {t.action} →
            </button>
          </div>
        ))}
      </div>
    </div>
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
            <span className="capitalize">{asset.kind}</span>
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
          <ActionItem icon={<Sparkles size={16} />} label="Use in Make" onClick={() => { onUse(); onClose(); }} />
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
  onClose,
  onSubmit,
}: {
  open: boolean;
  initial: string;
  onClose: () => void;
  onSubmit: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  useEffect(() => {
    if (open) setName(initial);
  }, [open, initial]);
  return (
    <Modal open={open} onClose={onClose} title="Rename collection" size="sm">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) onSubmit(name.trim());
        }}
      >
        <TextInput autoFocus value={name} onChange={(e) => setName(e.target.value)} />
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
    <Modal open={open} onClose={onClose} title="New prompt" size="md">
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
            placeholder="The prompt text — e.g. warm golden-hour light, shallow depth of field, filmed on 35mm"
            rows={5}
            className="w-full resize-none rounded-xl border border-line bg-surface-2 px-3 py-2.5 text-sm text-fg placeholder:text-faint focus:border-accent/50 focus:outline-none"
          />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button type="submit" size="sm" disabled={!text.trim()}>Save prompt</Button>
        </div>
      </form>
    </Modal>
  );
}
