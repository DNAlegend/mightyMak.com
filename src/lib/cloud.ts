"use client";

// Cloud persistence layer: maps the store's domain objects onto Supabase rows
// and provides fire-and-forget write-through helpers. All functions are
// no-ops (or return null) when no user is signed in, so the store can call
// them unconditionally.

import { supabase } from "./supabase";
import type { Asset, Category, Plan, VideoJob } from "./types";

let activeUserId: string | null = null;

export function setCloudUser(id: string | null) {
  activeUserId = id;
}

export function getCloudUser(): string | null {
  return activeUserId;
}

export function cloudOn(): boolean {
  return !!supabase && !!activeUserId;
}

function warn(op: string, error: unknown) {
  console.warn(`[cloud] ${op} failed:`, error);
}

/* -------------------------------- mappers -------------------------------- */

type Row = Record<string, unknown>;

function assetToRow(a: Asset): Row {
  return {
    id: a.id,
    user_id: activeUserId,
    name: a.name,
    kind: a.kind,
    url: a.url,
    poster_url: a.posterUrl ?? null,
    category_id: a.categoryId,
    source: a.source,
    size_bytes: a.sizeBytes ?? null,
    class: a.class ?? null,
    owner: a.owner ?? null,
    parts: a.parts ?? null,
    prompt_fragment: a.promptFragment ?? null,
    accent: a.accent ?? null,
    created_at: a.createdAt,
  };
}

function rowToAsset(r: Row): Asset {
  return {
    id: r.id as string,
    name: r.name as string,
    kind: r.kind as Asset["kind"],
    url: r.url as string,
    posterUrl: (r.poster_url as string) ?? undefined,
    categoryId: (r.category_id as string) ?? null,
    source: r.source as Asset["source"],
    sizeBytes: (r.size_bytes as number) ?? undefined,
    class: (r.class as Asset["class"]) ?? undefined,
    owner: (r.owner as Asset["owner"]) ?? undefined,
    parts: (r.parts as Asset["parts"]) ?? undefined,
    promptFragment: (r.prompt_fragment as string) ?? undefined,
    accent: (r.accent as string) ?? undefined,
    createdAt: Number(r.created_at),
  };
}

function categoryToRow(c: Category): Row {
  return {
    id: c.id,
    user_id: activeUserId,
    name: c.name,
    system: !!c.system,
    created_at: c.createdAt,
  };
}

function rowToCategory(r: Row): Category {
  return {
    id: r.id as string,
    name: r.name as string,
    system: !!r.system,
    createdAt: Number(r.created_at),
  };
}

function jobToRow(v: VideoJob): Row {
  return {
    id: v.id,
    user_id: activeUserId,
    prompt: v.prompt,
    status: v.status,
    progress: v.progress,
    tier: v.tier,
    duration_sec: v.durationSec,
    aspect_ratio: v.aspectRatio,
    audio: v.audio,
    model_id: v.modelId ?? null,
    modality: v.modality ?? "video",
    ref_asset_id: v.refAssetId,
    video_url: v.videoUrl ?? null,
    poster_url: v.posterUrl ?? null,
    credits_cost: v.creditsCost,
    error: v.error ?? null,
    elements: v.elements ?? null,
    direction: v.direction ?? null,
    simulated: v.simulated ?? false,
    created_at: v.createdAt,
    // Provenance columns are newer — only send them when set, so older
    // deployments/rows keep working even before the migration lands.
    ...(v.planId ? { plan_id: v.planId, idea_id: v.ideaId ?? null } : {}),
  };
}

function rowToJob(r: Row): VideoJob {
  return {
    taskId: (r.task_id as string) ?? undefined,
    id: r.id as string,
    prompt: r.prompt as string,
    status: r.status as VideoJob["status"],
    progress: (r.progress as number) ?? 0,
    tier: r.tier as VideoJob["tier"],
    durationSec: r.duration_sec as number,
    aspectRatio: r.aspect_ratio as VideoJob["aspectRatio"],
    audio: !!r.audio,
    modelId: (r.model_id as string) ?? undefined,
    modality: (r.modality as VideoJob["modality"]) ?? "video",
    refAssetId: (r.ref_asset_id as string) ?? null,
    videoUrl: (r.video_url as string) ?? undefined,
    posterUrl: (r.poster_url as string) ?? undefined,
    creditsCost: (r.credits_cost as number) ?? 0,
    error: (r.error as string) ?? undefined,
    elements: (r.elements as string[]) ?? undefined,
    direction: (r.direction as string) ?? undefined,
    simulated: r.simulated ? true : undefined,
    createdAt: Number(r.created_at),
    planId: (r.plan_id as string) ?? undefined,
    ideaId: (r.idea_id as string) ?? undefined,
  };
}

function planToRow(p: Plan): Row {
  return {
    id: p.id,
    user_id: activeUserId,
    brief: p.brief,
    // The jsonb column carries plan meta too (v2 wrapper) — no extra columns.
    ideas: {
      v: 2,
      title: p.title,
      logline: p.logline,
      direction: p.direction,
      targetSec: p.targetSec,
      castIds: p.castIds,
      clips: p.ideas,
    },
    created_at: p.createdAt,
  };
}

function rowToPlan(r: Row): Plan {
  const raw = r.ideas as
    | Plan["ideas"]
    | {
        v: 2;
        title?: string;
        logline?: string;
        direction?: string;
        targetSec?: number;
        castIds?: string[];
        clips: Plan["ideas"];
      }
    | null;
  const wrapped = raw && !Array.isArray(raw) ? raw : null;
  return {
    id: r.id as string,
    brief: r.brief as string,
    title: wrapped?.title,
    logline: wrapped?.logline,
    direction: wrapped?.direction,
    targetSec: wrapped?.targetSec,
    castIds: wrapped?.castIds,
    ideas: (wrapped ? wrapped.clips : (raw as Plan["ideas"])) ?? [],
    createdAt: Number(r.created_at),
  };
}

/* --------------------------------- reads --------------------------------- */

export interface CloudState {
  credits: number;
  categories: Category[];
  assets: Asset[];
  videos: VideoJob[];
  /** True when the account has no library yet (fresh signup). */
  empty: boolean;
}

export async function fetchCloudState(): Promise<CloudState | null> {
  if (!supabase || !activeUserId) return null;
  try {
    const [profile, cats, assets, gens] = await Promise.all([
      supabase.from("profiles").select("credits").eq("id", activeUserId).maybeSingle(),
      supabase.from("categories").select("*").order("created_at", { ascending: true }),
      supabase.from("assets").select("*").order("created_at", { ascending: false }),
      supabase.from("generations").select("*").order("created_at", { ascending: false }),
    ]);
    const firstError = profile.error ?? cats.error ?? assets.error ?? gens.error;
    if (firstError) throw firstError;
    return {
      credits: profile.data?.credits ?? 0,
      categories: (cats.data ?? []).map(rowToCategory),
      assets: (assets.data ?? []).map(rowToAsset),
      videos: (gens.data ?? []).map(rowToJob),
      empty: (cats.data ?? []).length === 0 && (assets.data ?? []).length === 0,
    };
  } catch (e) {
    warn("fetchCloudState", e);
    return null;
  }
}

/**
 * Plans are fetched separately from the main state so a missing table (the
 * migration not applied yet) degrades to local-only plans instead of breaking
 * the whole hydration.
 */
export async function fetchPlans(): Promise<Plan[] | null> {
  if (!supabase || !activeUserId) return null;
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    warn("fetchPlans", error);
    return null;
  }
  return (data ?? []).map(rowToPlan);
}

/** Seed a fresh account's library with the starter catalog. */
export async function seedCloud(categories: Category[], assets: Asset[]): Promise<void> {
  if (!supabase || !activeUserId) return;
  try {
    const { error: catErr } = await supabase
      .from("categories")
      .upsert(categories.map(categoryToRow));
    if (catErr) throw catErr;
    const { error: astErr } = await supabase.from("assets").upsert(assets.map(assetToRow));
    if (astErr) throw astErr;
  } catch (e) {
    warn("seedCloud", e);
  }
}

/* --------------------------------- writes -------------------------------- */

export function pushPlan(p: Plan): void {
  if (!cloudOn()) return;
  supabase!.from("plans").upsert(planToRow(p)).then(({ error }) => {
    if (error) warn("pushPlan", error);
  });
}

export function deletePlanRow(id: string): void {
  if (!cloudOn()) return;
  supabase!.from("plans").delete().eq("id", id).eq("user_id", activeUserId!)
    .then(({ error }) => { if (error) warn("deletePlanRow", error); });
}

export function pushAsset(a: Asset): void {
  if (!cloudOn()) return;
  supabase!.from("assets").upsert(assetToRow(a)).then(({ error }) => {
    if (error) warn("pushAsset", error);
  });
}

export function updateAssetRow(id: string, patch: Partial<Asset>): void {
  if (!cloudOn()) return;
  const row: Row = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.url !== undefined) row.url = patch.url;
  if (patch.posterUrl !== undefined) row.poster_url = patch.posterUrl;
  if (patch.categoryId !== undefined) row.category_id = patch.categoryId;
  supabase!.from("assets").update(row).eq("id", id).eq("user_id", activeUserId!)
    .then(({ error }) => { if (error) warn("updateAssetRow", error); });
}

export function deleteAssetRow(id: string): void {
  if (!cloudOn()) return;
  supabase!.from("assets").delete().eq("id", id).eq("user_id", activeUserId!)
    .then(({ error }) => { if (error) warn("deleteAssetRow", error); });
}

export function pushCategory(c: Category): void {
  if (!cloudOn()) return;
  supabase!.from("categories").upsert(categoryToRow(c)).then(({ error }) => {
    if (error) warn("pushCategory", error);
  });
}

export function updateCategoryRow(id: string, patch: Partial<Category>): void {
  if (!cloudOn()) return;
  const row: Row = {};
  if (patch.name !== undefined) row.name = patch.name;
  supabase!.from("categories").update(row).eq("id", id).eq("user_id", activeUserId!)
    .then(({ error }) => { if (error) warn("updateCategoryRow", error); });
}

export function deleteCategoryRow(id: string): void {
  if (!cloudOn()) return;
  // Orphan this folder's assets first, mirroring the local behavior.
  supabase!.from("assets").update({ category_id: null })
    .eq("category_id", id).eq("user_id", activeUserId!)
    .then(({ error }) => {
      if (error) warn("deleteCategoryRow(orphan)", error);
      supabase!.from("categories").delete().eq("id", id).eq("user_id", activeUserId!)
        .then(({ error: delErr }) => { if (delErr) warn("deleteCategoryRow", delErr); });
    });
}

export function pushGeneration(v: VideoJob): void {
  if (!cloudOn()) return;
  supabase!.from("generations").upsert(jobToRow(v)).then(({ error }) => {
    if (error) warn("pushGeneration", error);
  });
}

export function updateGenerationRow(id: string, patch: Partial<VideoJob>): void {
  if (!cloudOn()) return;
  const row: Row = {};
  if (patch.status !== undefined) row.status = patch.status;
  if (patch.progress !== undefined) row.progress = patch.progress;
  if (patch.videoUrl !== undefined) row.video_url = patch.videoUrl;
  if (patch.posterUrl !== undefined) row.poster_url = patch.posterUrl;
  if (patch.error !== undefined) row.error = patch.error;
  if (patch.simulated !== undefined) row.simulated = patch.simulated;
  supabase!.from("generations").update(row).eq("id", id).eq("user_id", activeUserId!)
    .then(({ error }) => { if (error) warn("updateGenerationRow", error); });
}

export function deleteGenerationRow(id: string): void {
  if (!cloudOn()) return;
  supabase!.from("generations").delete().eq("id", id).eq("user_id", activeUserId!)
    .then(({ error }) => { if (error) warn("deleteGenerationRow", error); });
}

/**
 * Atomically adjust the profile's credit balance on the server. The server's
 * returned balance is fed back through `onBalance` so the local count can't
 * drift from the source of truth (e.g. spends from another tab or device).
 */
export function adjustCreditsRemote(delta: number, onBalance?: (balance: number) => void): void {
  if (!cloudOn()) return;
  supabase!.rpc("adjust_credits", { delta }).then(({ data, error }) => {
    if (error) warn("adjustCredits", error);
    else if (data === null || data === undefined) warn("adjustCredits", "insufficient credits on server");
    else if (typeof data === "number" && onBalance) onBalance(data);
  });
}

/* --------------------------------- storage ------------------------------- */

/**
 * Upload a data-URL file to the assets bucket under the user's folder and
 * return its public URL, or null on failure / when signed out.
 */
/**
 * Upload a raw File/Blob straight to Storage — no base64 detour, so big
 * videos never squat in memory or localStorage. Returns the public URL.
 */
export async function uploadFile(assetId: string, file: Blob): Promise<string | null> {
  if (!supabase || !activeUserId) return null;
  try {
    const ext = file.type.split("/")[1]?.split("+")[0] || "bin";
    const path = `${activeUserId}/${assetId}.${ext}`;
    const { error } = await supabase.storage.from("assets").upload(path, file, {
      contentType: file.type,
      upsert: true,
    });
    if (error) throw error;
    return supabase.storage.from("assets").getPublicUrl(path).data.publicUrl;
  } catch (e) {
    warn("uploadFile", e);
    return null;
  }
}

export async function uploadDataUrl(assetId: string, dataUrl: string): Promise<string | null> {
  if (!supabase || !activeUserId) return null;
  try {
    const blob = await (await fetch(dataUrl)).blob();
    const ext = blob.type.split("/")[1]?.split("+")[0] || "bin";
    const path = `${activeUserId}/${assetId}.${ext}`;
    const { error } = await supabase.storage.from("assets").upload(path, blob, {
      contentType: blob.type,
      upsert: true,
    });
    if (error) throw error;
    return supabase.storage.from("assets").getPublicUrl(path).data.publicUrl;
  } catch (e) {
    warn("uploadDataUrl", e);
    return null;
  }
}
