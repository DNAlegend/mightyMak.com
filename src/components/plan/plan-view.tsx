"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Lightbulb,
  Loader2,
  Sparkles,
  Trash2,
  ArrowRight,
  Film,
  Check,
  AlertTriangle,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import { timeAgo, cn } from "@/lib/utils";
import { Button, Card, Badge, EmptyState } from "@/components/ui";

const LENGTHS = [5, 10, 15] as const;

export function PlanView() {
  const router = useRouter();
  const plans = useStore((s) => s.plans);
  const videos = useStore((s) => s.videos);
  const hydrated = useStore((s) => s.hasHydrated);
  const addPlan = useStore((s) => s.addPlan);
  const removePlan = useStore((s) => s.removePlan);
  const markIdeaSent = useStore((s) => s.markIdeaSent);
  const setDraftDirection = useStore((s) => s.setDraftDirection);
  const setDraftPlanRef = useStore((s) => s.setDraftPlanRef);
  const setAuthOpen = useStore((s) => s.setAuthOpen);

  const [brief, setBrief] = useState("");
  const [durationSec, setDurationSec] = useState<number>(5);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One plan, one idea — the plan IS the idea.
  const plan = plans[0] ?? null;
  const idea = plan?.ideas[0] ?? null;
  const job = useMemo(
    () => (idea?.jobId ? videos.find((v) => v.id === idea.jobId) : undefined),
    [videos, idea],
  );

  async function writePlan() {
    const goal = brief.trim();
    if (!goal || busy) return;
    if (plan && !confirm("Write a new plan? It replaces this one (videos already made stay in My Videos).")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const token = (await supabase?.auth.getSession())?.data.session?.access_token;
      if (!token) {
        setAuthOpen(true);
        return;
      }
      const res = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ brief: goal, count: 1, durationSec }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "The Strategist is unavailable");
      addPlan(goal, [{ ...data.ideas[0], durationSec }]);
      setBrief("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function openAndMake() {
    if (!plan || !idea) return;
    setDraftDirection(idea.prompt);
    setDraftPlanRef({ planId: plan.id, ideaId: idea.id });
    markIdeaSent(plan.id, idea.id);
    router.push("/app");
  }

  if (!hydrated) return <div className="mx-auto h-8 max-w-3xl w-40 rounded bg-surface-2" />;

  const state = job
    ? job.status === "succeeded"
      ? "produced"
      : job.status === "failed"
        ? "failed"
        : "producing"
    : idea?.sentAt
      ? "sent"
      : "idea";

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Plan</h1>
        <p className="mt-1 text-sm text-muted">
          Tell the Strategist what you want, pick a length — it writes one detailed,
          second-by-second plan. Then open it in Make.
        </p>
      </header>

      {/* The brief */}
      <div className="rounded-[var(--radius-xl2)] border border-line bg-surface p-4">
        <textarea
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) writePlan();
          }}
          placeholder='What are we making? — e.g. "A video that will go viral for my skincare brand"'
          rows={3}
          className="w-full resize-none rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-[15px] text-fg placeholder:text-faint focus:border-accent/50 focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[12px] font-medium uppercase tracking-wider text-faint">Length</span>
          {LENGTHS.map((d) => (
            <button
              key={d}
              onClick={() => setDurationSec(d)}
              className={cn(
                "rounded-full border px-3 py-1 text-[13px] font-medium transition-colors",
                durationSec === d
                  ? "border-accent/40 bg-accent-soft text-fg"
                  : "border-line text-muted hover:border-faint hover:text-fg",
              )}
            >
              {d}s
            </button>
          ))}
          <Button className="ml-auto" onClick={writePlan} disabled={busy || !brief.trim()}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Lightbulb size={16} />}
            {busy ? "Writing…" : plan ? "New plan" : "Write the plan"}
          </Button>
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>

      {/* The one clean plan */}
      {!plan || !idea ? (
        <div className="mt-6">
          <EmptyState
            icon={<Lightbulb size={24} />}
            title="No plan yet"
            description="Describe your goal above and the Strategist writes the plan — every second of the video, ready to make."
          />
        </div>
      ) : (
        <Card className="mt-6 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-lg font-bold tracking-tight">{idea.title}</h2>
                {idea.durationSec && <Badge tone="neutral">{idea.durationSec}s</Badge>}
                {state === "produced" && (
                  <Badge tone="teal">
                    <Check size={11} /> Produced
                  </Badge>
                )}
                {state === "producing" && (
                  <Badge tone="accent">
                    <Loader2 size={11} className="animate-spin" /> Producing
                  </Badge>
                )}
                {state === "failed" && (
                  <Badge tone="neutral" className="text-danger">
                    <AlertTriangle size={11} /> Failed
                  </Badge>
                )}
              </div>
              {idea.hook && <p className="mt-1 text-[14px] text-muted">{idea.hook}</p>}
            </div>
            <button
              onClick={() => {
                if (confirm("Delete this plan? Videos already made stay in My Videos.")) {
                  removePlan(plan.id);
                }
              }}
              className="rounded-lg p-1.5 text-faint transition-colors hover:bg-surface-2 hover:text-danger"
              aria-label="Delete plan"
            >
              <Trash2 size={15} />
            </button>
          </div>

          <p className="mt-4 whitespace-pre-line rounded-xl border border-line bg-surface-2 p-4 text-[13.5px] leading-relaxed text-fg">
            {idea.prompt}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {state === "produced" || state === "producing" ? (
              <>
                <Button onClick={() => router.push(`/app/library?open=${idea.jobId}`)}>
                  <Film size={16} /> View video
                </Button>
                <Button variant="outline" onClick={openAndMake}>
                  <Sparkles size={15} /> Make again
                </Button>
              </>
            ) : (
              <Button size="lg" onClick={openAndMake}>
                <Sparkles size={16} /> Open &amp; Make <ArrowRight size={15} />
              </Button>
            )}
            <span className="ml-auto text-[12px] text-faint">
              from “{plan.brief}” · {timeAgo(plan.createdAt)}
            </span>
          </div>
        </Card>
      )}
    </div>
  );
}
