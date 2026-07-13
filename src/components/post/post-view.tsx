"use client";

// Post — the studio's post-production room. The current production's shots
// line up on a timeline: play them back-to-back as one piece, send any scene
// back to Make to regenerate with edits, and export the whole cut as a
// single video file (stitched in the browser — canvas + audio capture).

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  Clapperboard,
  Download,
  Film,
  Loader2,
  Pause,
  Play,
  Scissors,
  Sparkles,
} from "lucide-react";
import { useStore } from "@/lib/store";
import type { Plan, PlanIdea, VideoJob } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Button, Card, Badge, EmptyState } from "@/components/ui";
import { VideoPreview } from "@/components/shared";

function fmtSec(total: number): string {
  if (total < 60) return `${total}s`;
  const m = Math.floor(total / 60);
  const s = total % 60;
  return s ? `${m}:${String(s).padStart(2, "0")}` : `${m} min`;
}

type ShotRow = { idea: PlanIdea; index: number; job: VideoJob | null; ready: boolean };

export function PostView() {
  const router = useRouter();
  const plans = useStore((s) => s.plans);
  const videos = useStore((s) => s.videos);
  const assets = useStore((s) => s.assets);
  const hydrated = useStore((s) => s.hasHydrated);
  const setDraftDirection = useStore((s) => s.setDraftDirection);
  const setDraftElements = useStore((s) => s.setDraftElements);
  const setDraftPlanRef = useStore((s) => s.setDraftPlanRef);
  const markIdeaSent = useStore((s) => s.markIdeaSent);

  const plan = plans[0] ?? null;

  const shots: ShotRow[] = useMemo(() => {
    if (!plan) return [];
    return plan.ideas.map((idea, index) => {
      const job = (idea.jobId && videos.find((v) => v.id === idea.jobId)) || null;
      return { idea, index, job, ready: !!(job && job.status === "succeeded" && job.videoUrl) };
    });
  }, [plan, videos]);

  const readyShots = shots.filter((s) => s.ready);
  const totalSec = shots.reduce((sum, s) => sum + (s.idea.durationSec ?? 0), 0);

  // ------------------------------- player -------------------------------
  // Two alternating <video> elements: while one plays, the next shot is
  // already loaded in the other, so the cut plays as one continuous piece.
  const videoARef = useRef<HTMLVideoElement>(null);
  const videoBRef = useRef<HTMLVideoElement>(null);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null); // index into readyShots
  const [activeEl, setActiveEl] = useState<0 | 1>(0);
  const playTokenRef = useRef(0);

  // ------------------------------- export -------------------------------
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const audioSourcesRef = useRef<WeakMap<HTMLVideoElement, MediaElementAudioSourceNode>>(new WeakMap());
  const audioDestRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const rafRef = useRef(0);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportDone, setExportDone] = useState(false);

  const els = () => [videoARef.current, videoBRef.current] as const;

  function stopPlayback() {
    playTokenRef.current++;
    els().forEach((v) => v?.pause());
    cancelAnimationFrame(rafRef.current);
    setPlayingIdx(null);
  }

  useEffect(() => () => stopPlayback(), []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Wire a video element's audio into the shared graph (speakers + recorder). */
  function audioFor(v: HTMLVideoElement) {
    const ctx = (audioCtxRef.current ??= new AudioContext());
    let src = audioSourcesRef.current.get(v);
    if (!src) {
      src = ctx.createMediaElementSource(v);
      src.connect(ctx.destination);
      audioSourcesRef.current.set(v, src);
    }
    return { ctx, src };
  }

  /**
   * Play the produced shots in order. With `record`, the frames are drawn to
   * a canvas and captured together with the audio into one downloadable file.
   */
  async function playSequence(record: boolean) {
    if (readyShots.length === 0 || exporting) return;
    stopPlayback();
    const token = ++playTokenRef.current;
    const [a, b] = els();
    if (!a || !b) return;
    setError(null);
    setExportDone(false);

    const urls = readyShots.map((s) => s.job!.videoUrl!);
    let recorder: MediaRecorder | null = null;

    const load = (v: HTMLVideoElement, url: string) =>
      new Promise<void>((resolve, reject) => {
        v.src = url;
        v.load();
        const ok = () => {
          cleanup();
          resolve();
        };
        const bad = () => {
          cleanup();
          reject(new Error("A shot's video failed to load"));
        };
        const cleanup = () => {
          v.removeEventListener("loadeddata", ok);
          v.removeEventListener("error", bad);
        };
        v.addEventListener("loadeddata", ok);
        v.addEventListener("error", bad);
      });

    try {
      await load(a, urls[0]);
      if (urls[1]) void load(b, urls[1]).catch(() => {});

      if (record) {
        const canvas = canvasRef.current!;
        canvas.width = a.videoWidth || 1280;
        canvas.height = a.videoHeight || 720;
        const g = canvas.getContext("2d")!;
        const { ctx } = audioFor(a);
        audioFor(b);
        // resume() only settles after a user gesture — don't let it hang the export.
        await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 2000))]);
        const dest = (audioDestRef.current ??= ctx.createMediaStreamDestination());
        audioSourcesRef.current.get(a)!.connect(dest);
        audioSourcesRef.current.get(b)!.connect(dest);
        const stream = new MediaStream([
          ...canvas.captureStream(30).getVideoTracks(),
          ...dest.stream.getAudioTracks(),
        ]);
        const mime = ["video/mp4", "video/webm;codecs=vp9,opus", "video/webm"].find((m) =>
          MediaRecorder.isTypeSupported(m),
        );
        const chunks: Blob[] = [];
        recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
        recorder.onstop = () => {
          if (playTokenRef.current !== token || chunks.length === 0) return;
          const ext = (recorder!.mimeType || "").includes("mp4") ? "mp4" : "webm";
          const blob = new Blob(chunks, { type: recorder!.mimeType || "video/webm" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${(plan?.title || "production").replace(/[^\w\d -]+/g, "").trim() || "production"}.${ext}`;
          link.click();
          setTimeout(() => URL.revokeObjectURL(url), 30_000);
          setExportDone(true);
        };
        recorderRef.current = recorder;
        recorder.start(500);
        setExporting(true);

        const draw = () => {
          if (playTokenRef.current !== token) return;
          const v = els()[activeElRef.current];
          if (v && v.videoWidth) {
            // Letterbox: keep every shot fully visible on the first shot's canvas.
            const scale = Math.min(canvas.width / v.videoWidth, canvas.height / v.videoHeight);
            const w = v.videoWidth * scale;
            const h = v.videoHeight * scale;
            g.fillStyle = "#000";
            g.fillRect(0, 0, canvas.width, canvas.height);
            g.drawImage(v, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
          }
          rafRef.current = requestAnimationFrame(draw);
        };
        rafRef.current = requestAnimationFrame(draw);
      }

      // Run the sequence across the two elements.
      let current: HTMLVideoElement = a;
      let standby: HTMLVideoElement = b;
      for (let i = 0; i < urls.length; i++) {
        if (playTokenRef.current !== token) return;
        setPlayingIdx(i);
        setActiveEl(current === a ? 0 : 1);
        activeElRef.current = current === a ? 0 : 1;
        current.currentTime = 0;
        await current.play();
        // Preload the shot after next into the element that just finished.
        const nextUrl = urls[i + 1];
        const afterNext = urls[i + 2];
        await new Promise<void>((resolve) => {
          const onEnd = () => {
            current.removeEventListener("ended", onEnd);
            resolve();
          };
          current.addEventListener("ended", onEnd);
        });
        if (playTokenRef.current !== token) return;
        if (nextUrl) {
          // The standby element should already have nextUrl; swap roles.
          if (standby.src !== nextUrl) await load(standby, nextUrl);
          const finished = current;
          current = standby;
          standby = finished;
          if (afterNext) void load(standby, afterNext).catch(() => {});
        }
      }
      setPlayingIdx(null);
    } catch (e) {
      if (playTokenRef.current === token) {
        setError(e instanceof Error ? e.message : "Playback failed");
      }
    } finally {
      if (playTokenRef.current === token) {
        cancelAnimationFrame(rafRef.current);
        if (recorder && recorder.state !== "inactive") recorder.stop();
        setExporting(false);
        setPlayingIdx(null);
      }
    }
  }
  const activeElRef = useRef<0 | 1>(0);

  function cancelExport() {
    const rec = recorderRef.current;
    stopPlayback();
    if (rec && rec.state !== "inactive") rec.stop();
    setExporting(false);
  }

  /** Send a shot back to Make to regenerate it — edits happen there. */
  function regenerate(p: Plan, idea: PlanIdea) {
    setDraftDirection(idea.prompt);
    setDraftPlanRef({ planId: p.id, ideaId: idea.id });
    const elementIds = (p.castIds ?? []).flatMap((cid) => {
      const c = assets.find((x) => x.id === cid);
      if (!c) return [];
      const voice = assets.find((x) => x.categoryId === c.categoryId && x.kind === "audio");
      return [c.id, ...(voice ? [voice.id] : [])];
    });
    if (elementIds.length) setDraftElements(elementIds);
    markIdeaSent(p.id, idea.id);
    router.push("/app");
  }

  if (!hydrated) return <div className="mx-auto h-8 max-w-3xl w-40 rounded bg-surface-2" />;

  if (!plan || plan.ideas.length === 0) {
    return (
      <div className="mx-auto max-w-3xl">
        <header className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight">Post</h1>
          <p className="mt-1 text-sm text-muted">
            The editing room — stitch your production’s shots into one video.
          </p>
        </header>
        <EmptyState
          icon={<Scissors size={24} />}
          title="Nothing to cut yet"
          description="Direct a production in Plan and produce its shots in Make — they line up here, ready to stitch into one video."
          action={
            <Button onClick={() => router.push("/app/plan")}>
              <Clapperboard size={16} /> Go to Plan
            </Button>
          }
        />
      </div>
    );
  }

  const playing = playingIdx !== null;

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Post</h1>
        <p className="mt-1 text-sm text-muted">
          The editing room. Your production’s shots play as one piece — regenerate any scene in
          Make, then export the whole cut as a single video.
        </p>
      </header>

      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-lg font-bold tracking-tight">
            {plan.title || plan.brief}
          </h2>
          <Badge tone={readyShots.length === shots.length ? "teal" : "neutral"}>
            {readyShots.length}/{shots.length} shots produced
          </Badge>
          {totalSec > 0 && <Badge tone="neutral">{fmtSec(totalSec)}</Badge>}
        </div>

        {/* The cut — one continuous playback across shots */}
        <div className="relative mt-4 overflow-hidden rounded-xl border border-line bg-black aspect-video">
          {readyShots.length === 0 ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
              <Film size={22} className="text-white/40" />
              <p className="max-w-xs text-[13px] text-white/60">
                No shots produced yet — open them in Plan and make them first.
              </p>
            </div>
          ) : (
            <>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                ref={videoARef}
                crossOrigin="anonymous"
                playsInline
                preload="auto"
                className={cn(
                  "absolute inset-0 h-full w-full object-contain",
                  activeEl === 0 ? "opacity-100" : "opacity-0",
                )}
                poster={activeEl === 0 ? undefined : readyShots[0]?.job?.posterUrl}
              />
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                ref={videoBRef}
                crossOrigin="anonymous"
                playsInline
                preload="auto"
                className={cn(
                  "absolute inset-0 h-full w-full object-contain",
                  activeEl === 1 ? "opacity-100" : "opacity-0",
                )}
              />
              {!playing && (
                <button
                  onClick={() => playSequence(false)}
                  className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors hover:bg-black/20"
                  aria-label="Play the cut"
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-ink shadow-lg">
                    <Play size={22} className="ml-0.5 text-black" />
                  </span>
                </button>
              )}
              {playing && (
                <div className="absolute left-3 top-3 flex items-center gap-2">
                  <span className="rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-bold text-white">
                    Shot {readyShots[playingIdx!] ? readyShots[playingIdx!].index + 1 : ""} ·{" "}
                    {playingIdx! + 1}/{readyShots.length}
                  </span>
                  {exporting && (
                    <span className="flex items-center gap-1.5 rounded-md bg-danger/90 px-2 py-0.5 text-[11px] font-bold text-white">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> Exporting
                    </span>
                  )}
                </div>
              )}
              {playing && (
                <button
                  onClick={() => (exporting ? cancelExport() : stopPlayback())}
                  className="absolute bottom-3 right-3 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  aria-label="Stop"
                >
                  <Pause size={16} />
                </button>
              )}
            </>
          )}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            onClick={() => playSequence(false)}
            disabled={readyShots.length === 0 || playing}
            variant="outline"
          >
            <Play size={15} /> Play the cut
          </Button>
          <Button onClick={() => playSequence(true)} disabled={readyShots.length === 0 || playing}>
            {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {exporting ? "Exporting…" : "Export as one video"}
          </Button>
          {exportDone && (
            <span className="flex items-center gap-1 text-[12.5px] font-medium text-teal">
              <Check size={13} /> Saved to your downloads
            </span>
          )}
          <span className="ml-auto text-[12px] text-faint">
            {readyShots.length < shots.length
              ? "Only produced shots are stitched — the export runs in real time."
              : "The export plays the cut once while saving it."}
          </span>
        </div>
        {error && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-danger">
            <AlertTriangle size={13} /> {error}
          </p>
        )}
        {/* Export surface — hidden; frames are composited here while recording. */}
        <canvas ref={canvasRef} className="hidden" />
      </Card>

      {/* Timeline */}
      <div className="mt-5">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[12px] font-semibold uppercase tracking-wider text-faint">
            Timeline
          </span>
          <span className="text-[11px] text-faint">
            {shots.length} {shots.length === 1 ? "shot" : "shots"} · {fmtSec(totalSec)}
          </span>
        </div>
        <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
          {shots.map(({ idea, index, job, ready }) => (
            <div
              key={idea.id}
              className={cn(
                "w-56 shrink-0 overflow-hidden rounded-xl border bg-surface",
                playing && readyShots[playingIdx!]?.idea.id === idea.id
                  ? "border-accent/60 ring-2 ring-accent/20"
                  : "border-line",
              )}
            >
              <div className="relative aspect-video bg-surface-2">
                {ready ? (
                  <VideoPreview src={job!.videoUrl!} poster={job!.posterUrl} className="h-full w-full" />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
                    {job?.status === "failed" ? (
                      <AlertTriangle size={16} className="text-danger" />
                    ) : job ? (
                      <Loader2 size={16} className="animate-spin text-accent-2" />
                    ) : (
                      <Clapperboard size={16} className="text-faint" />
                    )}
                    <span className="px-2 text-[11px] text-faint">
                      {job?.status === "failed"
                        ? "Failed — regenerate it"
                        : job
                          ? "Producing…"
                          : "Not produced yet"}
                    </span>
                  </div>
                )}
                <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  Shot {index + 1}
                </span>
                {idea.durationSec && (
                  <span className="absolute right-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                    {idea.durationSec}s
                  </span>
                )}
              </div>
              <div className="p-2.5">
                <p className="truncate text-[12.5px] font-semibold text-fg">{idea.title}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  {(() => {
                    const rendering = !!job && !ready && job.status !== "failed";
                    return (
                      <Button
                        size="sm"
                        variant="soft"
                        className="flex-1 gap-1"
                        disabled={rendering}
                        onClick={() => regenerate(plan, idea)}
                      >
                        {rendering ? (
                          <>
                            <Loader2 size={12} className="animate-spin" /> Producing…
                          </>
                        ) : (
                          <>
                            <Sparkles size={12} /> {ready || job?.status === "failed" ? "Regenerate" : "Produce"}
                          </>
                        )}
                      </Button>
                    );
                  })()}
                  {ready && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1"
                      onClick={() => router.push(`/app/library?open=${idea.jobId}`)}
                    >
                      <Film size={12} /> View
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-1 text-[12px] text-faint">
          Regenerate opens the shot in Make with its script — tweak it there and produce a new take;
          the cut updates automatically.
        </p>
      </div>
    </div>
  );
}
