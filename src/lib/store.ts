"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  type Asset,
  type Category,
  type GenerateParams,
  type Plan,
  type PlanIdea,
  type VideoJob,
} from "./types";
import { pickSample } from "./samples";
import { getModel, priceFor } from "./models";
import { uid } from "./utils";
import { supabase } from "./supabase";
import {
  adjustCreditsRemote,
  cloudOn,
  getCloudUser,
  deleteAssetRow,
  deleteCategoryRow,
  deleteGenerationRow,
  fetchCloudState,
  fetchPlans,
  pushAsset,
  pushCategory,
  pushGeneration,
  pushPlan,
  deletePlanRow,
  setCloudUser,
  updateAssetRow,
  updateCategoryRow,
  updateGenerationRow,
  uploadDataUrl,
} from "./cloud";

const STARTING_CREDITS = 120;

// Module-level (non-persisted) handles for the in-flight simulation timers.
const timers = new Map<string, ReturnType<typeof setInterval>>();

// The library starts EMPTY — no demo starter content. Users fill it by
// uploading, saving generations, or writing prompt snippets. Accounts seeded
// by older builds are cleaned up in hydrateFromCloud below.

function hasRefs(p: GenerateParams): boolean {
  return !!(p.refAssetId || (p.elements && p.elements.length > 0));
}

interface StoreState {
  hasHydrated: boolean;
  /** Signed-in Supabase user id, or null in local demo mode. */
  cloudUser: string | null;
  /** Opens the sign-in modal (rendered by the app shell) from anywhere. */
  authOpen: boolean;
  credits: number;
  videos: VideoJob[];
  assets: Asset[];
  categories: Category[];
  /** Director's note carried from a "Remix" action into the Studio. */
  draftDirection: string | null;
  /** Shot element ids carried from a "Remix" action into the Studio. */
  draftElements: string[] | null;
  /** Asset id carried from a "Use in Studio" action into the Studio. */
  draftRefAssetId: string | null;
  /** Planning sessions (the Plan surface before Make). */
  plans: Plan[];
  /** Plan idea carried from Plan into Make — stamps the next generation. */
  draftPlanRef: { planId: string; ideaId: string } | null;

  setHasHydrated: (v: boolean) => void;
  setAuthOpen: (v: boolean) => void;

  // cloud session
  hydrateFromCloud: (userId: string) => Promise<void>;
  signOutToLocal: () => void;

  // generation
  estimate: (
    p: Pick<GenerateParams, "tier" | "durationSec" | "modelId" | "refAssetId" | "resolution">,
  ) => number;
  generate: (p: GenerateParams) => string;
  removeVideo: (id: string) => void;
  setDraftDirection: (direction: string | null) => void;
  setDraftElements: (elements: string[] | null) => void;
  setDraftRef: (assetId: string | null) => void;
  setDraftPlanRef: (ref: { planId: string; ideaId: string } | null) => void;

  // plans
  /** The production currently open in Plan / Post (null = the productions list). */
  activePlanId: string | null;
  setActivePlan: (id: string | null) => void;
  addPlan: (
    brief: string,
    ideas: Array<Pick<PlanIdea, "title" | "hook" | "prompt" | "durationSec" | "role">>,
    meta?: Pick<Plan, "title" | "logline" | "direction" | "targetSec" | "castIds">,
  ) => Plan;
  removePlan: (id: string) => void;
  markIdeaSent: (planId: string, ideaId: string) => void;
  /** Replace an idea's blueprint (e.g. after a safe rewrite to pass checks). */
  updateIdeaPrompt: (planId: string, ideaId: string, prompt: string) => void;

  // credits
  addCredits: (n: number) => void;

  // assets
  addAsset: (a: Omit<Asset, "id" | "createdAt">) => Asset;
  saveVideoToAssets: (videoId: string, categoryId?: string | null) => Asset | null;
  removeAsset: (id: string) => void;
  renameAsset: (id: string, name: string) => void;
  moveAsset: (id: string, categoryId: string | null) => void;

  // categories
  addCategory: (name: string) => Category;
  renameCategory: (id: string, name: string) => void;
  removeCategory: (id: string) => void;
}

function patchVideo(set: StoreSet, id: string, patch: Partial<VideoJob>) {
  set((s) => ({
    videos: s.videos.map((v) => (v.id === id ? { ...v, ...patch } : v)),
  }));
}

type StoreSet = (
  partial: Partial<StoreState> | ((s: StoreState) => Partial<StoreState>),
) => void;

/**
 * The demo render loop: progress ticks, then a sample result lands.
 * `mirror` additionally persists the job + credit spend to the cloud
 * (signed-in users whose server has no real model configured).
 */
function startSimulatedRender(set: StoreSet, get: () => StoreState, job: VideoJob, mirror: boolean) {
  if (mirror) {
    pushGeneration(job);
    adjustCreditsRemote(-job.creditsCost, (balance) => set({ credits: balance }));
  }
  let progress = 0;
  const sampleIndex = get().videos.length;
  const interval = setInterval(() => {
    progress = Math.min(100, progress + 9 + Math.random() * 12);
    if (progress >= 100) {
      clearInterval(interval);
      timers.delete(job.id);
      const sample = pickSample(sampleIndex);
      const result: Partial<VideoJob> = {
        status: "succeeded",
        progress: 100,
        simulated: true,
        // Image models produce a still; video models produce a clip.
        videoUrl: job.modality === "image" ? undefined : sample.video,
        posterUrl: job.posterUrl ?? sample.poster,
      };
      patchVideo(set, job.id, result);
      if (mirror) updateGenerationRow(job.id, result);
    } else {
      patchVideo(set, job.id, { progress: Math.round(progress) });
    }
  }, 380);
  timers.set(job.id, interval);
}

/**
 * Poll /api/generate?id=… until a real render lands (or fails). Also used to
 * resume watching an in-flight render after a page reload.
 */
async function pollRenderUntilDone(set: StoreSet, job: Pick<VideoJob, "id" | "posterUrl">) {
  const token = (await supabase!.auth.getSession()).data.session?.access_token;
  if (!token) return;
  let progress = 8;
  patchVideo(set, job.id, { progress });
  const deadline = Date.now() + 10 * 60_000;
  for (;;) {
    await new Promise((r) => setTimeout(r, 4000));
    progress = Math.min(92, progress + 3 + Math.random() * 6);
    patchVideo(set, job.id, { progress: Math.round(progress) });
    try {
      const poll = await fetch(`/api/generate?id=${job.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const pd = await poll.json().catch(() => ({} as Record<string, unknown>));
      if (pd.status === "succeeded") {
        patchVideo(set, job.id, {
          status: "succeeded",
          progress: 100,
          videoUrl: (pd.videoUrl as string) ?? undefined,
          posterUrl: (pd.posterUrl as string) ?? job.posterUrl,
        });
        return;
      }
      if (pd.status === "failed") {
        if (typeof pd.credits === "number") set({ credits: pd.credits });
        patchVideo(set, job.id, {
          status: "failed",
          progress: 100,
          error: (pd.error as string) ?? "Generation failed",
        });
        return;
      }
    } catch {
      // transient network hiccup — keep polling until the deadline
    }
    if (Date.now() > deadline) {
      patchVideo(set, job.id, {
        status: "failed",
        progress: 100,
        error: "Timed out — the render may still land in your Library later",
      });
      return;
    }
  }
}

/**
 * Real generation through /api/generate (BytePlus Seedance/Seedream).
 * The server spends the credits and owns the generations row; the local
 * optimistic deduction is reconciled with the returned balance. Falls back
 * to the simulation only if the request never reached the model.
 */
async function runCloudGeneration(set: StoreSet, get: () => StoreState, job: VideoJob) {
  let posted = false;
  try {
    const token = (await supabase!.auth.getSession()).data.session?.access_token;
    if (!token) throw new Error("no session");

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        id: job.id,
        prompt: job.prompt,
        modelId: job.modelId,
        aspectRatio: job.aspectRatio,
        durationSec: job.durationSec,
        tier: job.tier,
        audio: job.audio,
        posterUrl: job.posterUrl,
        elements: job.elements,
        direction: job.direction,
        refImageUrls: job.refImageUrls,
        refVideoUrls: job.refVideoUrls,
        firstFrameUrl: job.firstFrameUrl,
        lastFrameUrl: job.lastFrameUrl,
        resolution: job.resolution,
      }),
    });
    if (res.status === 501) {
      // No real model behind the server — keep the demo pipeline.
      startSimulatedRender(set, get, job, true);
      return;
    }
    posted = true;
    const data = await res.json().catch(() => ({} as Record<string, unknown>));
    if (!res.ok) {
      // Server never charged — undo the optimistic local deduction.
      set((s) => ({ credits: s.credits + job.creditsCost }));
      patchVideo(set, job.id, {
        status: "failed",
        progress: 100,
        error: (data.error as string) ?? `Generation failed (${res.status})`,
      });
      return;
    }
    if (typeof data.credits === "number") set({ credits: data.credits });
    if (data.status === "succeeded") {
      patchVideo(set, job.id, {
        status: "succeeded",
        progress: 100,
        videoUrl: (data.videoUrl as string) ?? undefined,
        posterUrl: (data.posterUrl as string) ?? job.posterUrl,
      });
      return;
    }

    // Video renders as an async task — poll until it lands (~30–90s).
    if (typeof data.taskId === "string") patchVideo(set, job.id, { taskId: data.taskId });
    await pollRenderUntilDone(set, job);
  } catch (e) {
    if (!posted) {
      console.warn("[generate] real generation unavailable, simulating:", e);
      startSimulatedRender(set, get, job, true);
    } else {
      patchVideo(set, job.id, { status: "failed", progress: 100, error: "Generation failed" });
    }
  }
}

export const useStore = create<StoreState>()(
  persist(
    (set, get) => ({
      hasHydrated: false,
      cloudUser: null,
      authOpen: false,
      credits: STARTING_CREDITS,
      videos: [],
      assets: [],
      categories: [],
      draftDirection: null,
      draftElements: null,
      draftRefAssetId: null,
      plans: [],
      activePlanId: null,
      draftPlanRef: null,

      setHasHydrated: (v) => set({ hasHydrated: v }),
      setAuthOpen: (v) => set({ authOpen: v }),

      hydrateFromCloud: async (userId) => {
        setCloudUser(userId);
        // Show loading state while the account's data replaces local state.
        set({ hasHydrated: false });
        const cloud = await fetchCloudState();
        // The user signed out or switched accounts while we were fetching —
        // that flow owns the store now; discard this stale snapshot.
        if (getCloudUser() !== userId) return;
        // Plans load separately (missing table degrades to local-only plans).
        void fetchPlans().then((plans) => {
          if (plans && getCloudUser() === userId)
            set((s) => ({
              plans,
              // Drop a stale pointer to a production that no longer exists.
              activePlanId: plans.some((p) => p.id === s.activePlanId) ? s.activePlanId : null,
            }));
        });
        if (!cloud) {
          // Fetch failed — fall back to what's on screen rather than hanging.
          set({ hasHydrated: true });
          return;
        }
        if (cloud.empty) {
          // Fresh account: the library starts empty — the Assets page explains
          // how to fill it.
          set({ cloudUser: userId, credits: cloud.credits, categories: [], assets: [], videos: [], hasHydrated: true });
          return;
        }
        // Clean up accounts seeded by older builds: demo starter content is
        // gone from the product — remove it (only rows this user owns; their
        // own uploads and generations are untouched).
        const starters = cloud.assets.filter((a) => a.source === "starter");
        starters.forEach((a) => deleteAssetRow(a.id));
        cloud.categories.filter((c) => c.system).forEach((c) => deleteCategoryRow(c.id));
        const cloudAssets = cloud.assets.filter((a) => a.source !== "starter");
        const cloudCategories = cloud.categories.filter((c) => !c.system);
        // Renders left "rendering" by a closed tab: real Ark tasks resume
        // polling (the render likely finished server-side); only simulated
        // rows (no task id) get settled with a sample.
        const videos = cloud.videos.map((v, i) => {
          if (v.status !== "rendering") return v;
          if (v.taskId) {
            void pollRenderUntilDone(set, v);
            return v;
          }
          const sample = pickSample(i);
          const settled: VideoJob = {
            ...v,
            status: "succeeded",
            progress: 100,
            simulated: true,
            videoUrl: v.modality === "image" ? v.videoUrl : v.videoUrl ?? sample.video,
            posterUrl: v.posterUrl ?? sample.poster,
          };
          updateGenerationRow(v.id, settled);
          return settled;
        });
        set({
          cloudUser: userId,
          credits: cloud.credits,
          categories: cloudCategories,
          assets: cloudAssets,
          videos,
          hasHydrated: true,
        });
      },

      signOutToLocal: () => {
        setCloudUser(null);
        timers.forEach((t) => clearInterval(t));
        timers.clear();
        set({
          cloudUser: null,
          credits: STARTING_CREDITS,
          videos: [],
          assets: [],
          categories: [],
          plans: [],
          activePlanId: null,
          draftPlanRef: null,
          hasHydrated: true,
        });
      },

      estimate: (p) =>
        priceFor(getModel(p.modelId), {
          durationSec: p.durationSec,
          count: 1,
          hasRefs: !!p.refAssetId,
          resolution: p.resolution,
        }),

      generate: (p) => {
        const model = getModel(p.modelId);
        const modality = p.modality ?? model.modality;
        const cost = priceFor(model, {
          durationSec: p.durationSec,
          count: 1,
          hasRefs: hasRefs(p),
        });
        const id = uid("vid");
        const job: VideoJob = {
          id,
          prompt: p.prompt.trim(),
          status: "rendering",
          progress: 0,
          tier: p.tier,
          durationSec: p.durationSec,
          aspectRatio: p.aspectRatio,
          audio: p.audio,
          modelId: model.id,
          modality,
          refAssetId: p.refAssetId ?? null,
          posterUrl: p.posterUrl,
          refImageUrls: p.refImageUrls,
          refVideoUrls: p.refVideoUrls,
          firstFrameUrl: p.firstFrameUrl,
          lastFrameUrl: p.lastFrameUrl,
          resolution: p.resolution,
          elements: p.elements,
          direction: p.direction,
          creditsCost: cost,
          createdAt: Date.now(),
          planId: p.planId,
          ideaId: p.ideaId,
        };

        set((s) => ({ credits: s.credits - cost, videos: [job, ...s.videos] }));

        // Provenance: link the plan idea to the job it just became.
        if (p.planId && p.ideaId) {
          set((s) => {
            const plans = s.plans.map((pl) =>
              pl.id === p.planId
                ? {
                    ...pl,
                    ideas: pl.ideas.map((i) => (i.id === p.ideaId ? { ...i, jobId: id } : i)),
                  }
                : pl,
            );
            const updated = plans.find((pl) => pl.id === p.planId);
            if (updated) pushPlan(updated);
            return { plans, draftPlanRef: null };
          });
        }

        if (cloudOn()) {
          // Signed in: real generation via the server (or its sim fallback).
          void runCloudGeneration(set, get, job);
        } else {
          startSimulatedRender(set, get, job, false);
        }

        return id;
      },

      removeVideo: (id) => {
        const t = timers.get(id);
        if (t) {
          clearInterval(t);
          timers.delete(id);
        }
        set((s) => ({ videos: s.videos.filter((v) => v.id !== id) }));
        deleteGenerationRow(id);
      },

      setDraftDirection: (direction) => set({ draftDirection: direction }),

      setDraftElements: (elements) => set({ draftElements: elements }),

      setDraftRef: (assetId) => set({ draftRefAssetId: assetId }),

      setDraftPlanRef: (ref) => set({ draftPlanRef: ref }),

      setActivePlan: (id) => set({ activePlanId: id }),

      addPlan: (brief, ideas, meta) => {
        const plan: Plan = {
          id: uid("plan"),
          brief,
          createdAt: Date.now(),
          ...meta,
          ideas: ideas.map((i) => ({ ...i, id: uid("idea") })),
        };
        // Newest production first; it becomes the open one.
        set((s) => ({ plans: [plan, ...s.plans], activePlanId: plan.id }));
        pushPlan(plan);
        return plan;
      },

      removePlan: (id) => {
        set((s) => ({
          plans: s.plans.filter((p) => p.id !== id),
          activePlanId: s.activePlanId === id ? null : s.activePlanId,
        }));
        deletePlanRow(id);
      },

      markIdeaSent: (planId, ideaId) => {
        set((s) => {
          const plans = s.plans.map((pl) =>
            pl.id === planId
              ? {
                  ...pl,
                  ideas: pl.ideas.map((i) => (i.id === ideaId ? { ...i, sentAt: Date.now() } : i)),
                }
              : pl,
          );
          const updated = plans.find((pl) => pl.id === planId);
          if (updated) pushPlan(updated);
          return { plans };
        });
      },

      updateIdeaPrompt: (planId, ideaId, prompt) => {
        set((s) => {
          const plans = s.plans.map((pl) =>
            pl.id === planId
              ? {
                  ...pl,
                  // A rewritten blueprint is a fresh attempt — detach the failed job.
                  ideas: pl.ideas.map((i) =>
                    i.id === ideaId ? { ...i, prompt, jobId: undefined } : i,
                  ),
                }
              : pl,
          );
          const updated = plans.find((pl) => pl.id === planId);
          if (updated) pushPlan(updated);
          return { plans };
        });
      },

      addCredits: (n) => {
        set((s) => ({ credits: s.credits + n }));
        adjustCreditsRemote(n, (balance) => set({ credits: balance }));
      },

      addAsset: (a) => {
        const asset: Asset = { ...a, id: uid("ast"), createdAt: Date.now() };
        set((s) => ({ assets: [asset, ...s.assets] }));
        if (cloudOn()) {
          if (asset.url.startsWith("data:")) {
            // Move upload payloads into Storage, then persist the public URL.
            void (async () => {
              const publicUrl = await uploadDataUrl(asset.id, asset.url);
              if (!publicUrl) {
                // Upload failed — keep the asset local-only rather than
                // writing a multi-megabyte data URL into the database.
                console.warn("[cloud] upload failed; asset kept local:", asset.id);
                return;
              }
              const final: Asset = {
                ...asset,
                url: publicUrl,
                posterUrl: asset.posterUrl?.startsWith("data:") ? publicUrl : asset.posterUrl,
              };
              set((s) => ({ assets: s.assets.map((x) => (x.id === asset.id ? final : x)) }));
              pushAsset(final);
            })();
          } else {
            pushAsset(asset);
          }
        }
        return asset;
      },

      saveVideoToAssets: (videoId, categoryId = null) => {
        const v = get().videos.find((x) => x.id === videoId);
        if (!v) return null;
        const isImage = v.modality === "image";
        return get().addAsset({
          name: v.prompt.slice(0, 40) || (isImage ? "Generated image" : "Generated video"),
          kind: isImage ? "image" : "video",
          url: (isImage ? v.posterUrl : v.videoUrl) ?? v.posterUrl ?? "",
          posterUrl: v.posterUrl,
          categoryId,
          source: "generation",
        });
      },

      removeAsset: (id) => {
        set((s) => ({ assets: s.assets.filter((a) => a.id !== id) }));
        deleteAssetRow(id);
      },

      renameAsset: (id, name) => {
        set((s) => ({
          assets: s.assets.map((a) => (a.id === id ? { ...a, name } : a)),
        }));
        updateAssetRow(id, { name });
      },

      moveAsset: (id, categoryId) => {
        set((s) => ({
          assets: s.assets.map((a) => (a.id === id ? { ...a, categoryId } : a)),
        }));
        updateAssetRow(id, { categoryId });
      },

      addCategory: (name) => {
        const cat: Category = { id: uid("cat"), name: name.trim(), createdAt: Date.now() };
        set((s) => ({ categories: [...s.categories, cat] }));
        pushCategory(cat);
        return cat;
      },

      renameCategory: (id, name) => {
        set((s) => ({
          categories: s.categories.map((c) => (c.id === id ? { ...c, name } : c)),
        }));
        updateCategoryRow(id, { name });
      },

      removeCategory: (id) => {
        set((s) => ({
          categories: s.categories.filter((c) => c.id !== id),
          // orphaned assets fall back to "Uncategorized"
          assets: s.assets.map((a) => (a.categoryId === id ? { ...a, categoryId: null } : a)),
        }));
        deleteCategoryRow(id);
      },
    }),
    {
      name: "mightymak-v3",
      version: 5,
      storage: createJSONStorage(() => localStorage),
      // v5: the demo starter library is gone — drop seeded content but keep
      // everything the user added themselves (and their credits and videos).
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as Partial<StoreState>;
        if (version < 5) {
          return {
            ...s,
            assets: (s.assets ?? []).filter((a) => a.source !== "starter"),
            categories: [],
          } as StoreState;
        }
        return s as StoreState;
      },
      partialize: (s) => ({
        credits: s.credits,
        videos: s.videos,
        assets: s.assets,
        categories: s.categories,
        plans: s.plans,
        activePlanId: s.activePlanId,
      }),
      onRehydrateStorage: () => (state) => {
        // A render interrupted by a tab close shouldn't hang — settle it with a sample.
        state?.videos.forEach((v, i) => {
          if (v.status === "rendering") {
            const sample = pickSample(i);
            v.status = "succeeded";
            v.progress = 100;
            if (v.modality !== "image") v.videoUrl = v.videoUrl ?? sample.video;
            v.posterUrl = v.posterUrl ?? sample.poster;
          }
        });
        state?.setHasHydrated(true);
      },
    },
  ),
);
