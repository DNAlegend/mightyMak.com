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
  Clapperboard,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { supabase } from "@/lib/supabase";
import type { Plan, PlanIdea, VideoJob } from "@/lib/types";
import { timeAgo, cn } from "@/lib/utils";
import { Button, Card, Badge, EmptyState } from "@/components/ui";
import { classifyGenError, genErrorReason, safeRewritePrompt } from "@/components/shared";

/**
 * Split a script into timeline sections ("0-2s: ..."), plus trailing audio /
 * mood sections when present. Returns null when there's no timeline — the
 * script then renders as a plain paragraph.
 */
function planSegments(prompt: string): { label: string; text: string }[] | null {
  const re = /(\d+\s*[-–]\s*\d+\s*s)\s*[:.]\s*/gi;
  const out: { label: string; text: string }[] = [];
  let label: string | null = null;
  let last = 0;
  for (let m = re.exec(prompt); m; m = re.exec(prompt)) {
    const before = prompt.slice(last, m.index).trim();
    if (label !== null) out.push({ label, text: before });
    else if (before) out.push({ label: "", text: before });
    label = m[1].replace(/\s+/g, "");
    last = re.lastIndex;
  }
  if (label === null) return null;
  const tail = prompt.slice(last).trim();
  // Peel the closing audio + style directions into their own sections.
  const audioAt = tail.search(/Audio\s*:/i);
  const styleAt = tail.search(/Overall\s+mood|Sound\s+design|Overall\s+style/i);
  const cut = [audioAt, styleAt].filter((i) => i > 0).sort((a, b) => a - b)[0];
  if (cut !== undefined) {
    out.push({ label, text: tail.slice(0, cut).trim() });
    const rest = tail.slice(cut).trim();
    const styleInRest = rest.search(/Overall\s+mood|Sound\s+design|Overall\s+style/i);
    if (/^Audio\s*:/i.test(rest) && styleInRest > 0) {
      out.push({ label: "Audio", text: rest.slice(0, styleInRest).trim() });
      out.push({ label: "Style", text: rest.slice(styleInRest).trim() });
    } else {
      out.push({ label: /^Audio\s*:/i.test(rest) ? "Audio" : "Style", text: rest });
    }
  } else {
    out.push({ label, text: tail });
  }
  return out.filter((s) => s.text);
}

type ClipState = "idea" | "sent" | "producing" | "produced" | "failed";

function clipState(idea: PlanIdea, job: VideoJob | undefined): ClipState {
  if (job) {
    if (job.status === "succeeded") return "produced";
    if (job.status === "failed") return "failed";
    return "producing";
  }
  return idea.sentAt ? "sent" : "idea";
}

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
  const updateIdeaPrompt = useStore((s) => s.updateIdeaPrompt);

  const [brief, setBrief] = useState("");
  const [busy, setBusy] = useState(false);
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // One plan at a time — the current cut.
  const plan = plans[0] ?? null;
  const jobsById = useMemo(() => {
    const m = new Map<string, VideoJob>();
    for (const v of videos) m.set(v.id, v);
    return m;
  }, [videos]);

  const totalSec = plan?.ideas.reduce((sum, i) => sum + (i.durationSec ?? 0), 0) ?? 0;

  async function writePlan() {
    const goal = brief.trim();
    if (!goal || busy) return;
    if (plan && !confirm("Direct a new plan? It replaces this one (videos already made stay in My Videos).")) {
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
        body: JSON.stringify({ brief: goal }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "The Strategist is unavailable");
      const clips: Array<{ title: string; role: string; durationSec: number; why: string; prompt: string }> =
        data.clips ?? [];
      addPlan(
        goal,
        clips.map((c) => ({
          title: c.title,
          hook: c.why,
          prompt: c.prompt,
          role: c.role || undefined,
          durationSec: c.durationSec,
        })),
        { title: data.title || undefined, logline: data.logline || undefined, direction: data.direction || undefined },
      );
      setBrief("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  function openAndMake(p: Plan, idea: PlanIdea) {
    setDraftDirection(idea.prompt);
    setDraftPlanRef({ planId: p.id, ideaId: idea.id });
    markIdeaSent(p.id, idea.id);
    router.push("/app");
  }

  /** A failed clip, rewritten by the Director to pass the checks, back into Make. */
  async function fixAndRetry(p: Plan, idea: PlanIdea, job: VideoJob | undefined) {
    if (fixingId) return;
    setFixingId(idea.id);
    setError(null);
    try {
      const rewritten = await safeRewritePrompt(idea.prompt, job?.error);
      updateIdeaPrompt(p.id, idea.id, rewritten);
      setDraftDirection(rewritten);
      setDraftPlanRef({ planId: p.id, ideaId: idea.id });
      markIdeaSent(p.id, idea.id);
      router.push("/app");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn’t rewrite the clip");
    } finally {
      setFixingId(null);
    }
  }

  if (!hydrated) return <div className="mx-auto h-8 max-w-3xl w-40 rounded bg-surface-2" />;

  return (
    <div className="mx-auto max-w-3xl">
      <header className="mb-5">
        <h1 className="text-2xl font-bold tracking-tight">Plan</h1>
        <p className="mt-1 text-sm text-muted">
          Give the Strategist a goal — or a whole story. It directs the cut: how many clips,
          how long each one should run (5, 10 or 15s) and why, with the full script for every clip.
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
          placeholder='A goal or a whole story — e.g. "A video that goes viral for my skincare brand", or paste the story you want told'
          rows={4}
          className="w-full resize-none rounded-xl border border-line bg-surface-2 px-3.5 py-3 text-[15px] text-fg placeholder:text-faint focus:border-accent/50 focus:outline-none"
        />
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[12px] text-faint">
            The Strategist picks each clip’s length — you can still change it in Make.
          </span>
          <Button className="ml-auto shrink-0" onClick={writePlan} disabled={busy || !brief.trim()}>
            {busy ? <Loader2 size={16} className="animate-spin" /> : <Clapperboard size={16} />}
            {busy ? "Directing…" : plan ? "New plan" : "Direct it"}
          </Button>
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>

      {/* The cut */}
      {!plan || plan.ideas.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<Lightbulb size={24} />}
            title="No plan yet"
            description="Describe your goal or story above — the Strategist breaks it into clips with a recommended length and a full script for each."
          />
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {/* Treatment header */}
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-display text-lg font-bold tracking-tight">
                    {plan.title || plan.brief}
                  </h2>
                  <Badge tone="neutral">
                    {plan.ideas.length} {plan.ideas.length === 1 ? "clip" : "clips"}
                    {totalSec > 0 && <> · {totalSec}s</>}
                  </Badge>
                </div>
                {plan.logline && <p className="mt-1 text-[14px] text-muted">{plan.logline}</p>}
                {plan.direction && (
                  <p className="mt-3 rounded-xl border border-line bg-surface-2 p-3 text-[13px] leading-relaxed text-fg">
                    <span className="mr-2 rounded-md bg-teal-soft px-2 py-0.5 text-[11px] font-bold text-teal">
                      Direction
                    </span>
                    {plan.direction}
                  </p>
                )}
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
            <p className="mt-3 text-[12px] text-faint">
              from “{plan.brief.length > 90 ? `${plan.brief.slice(0, 90)}…` : plan.brief}” ·{" "}
              {timeAgo(plan.createdAt)}
            </p>
          </Card>

          {/* The clips */}
          {plan.ideas.map((idea, index) => {
            const job = idea.jobId ? jobsById.get(idea.jobId) : undefined;
            const state = clipState(idea, job);
            const fixing = fixingId === idea.id;
            const segments = planSegments(idea.prompt);
            return (
              <Card key={idea.id} className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-fg px-2 py-0.5 text-[11px] font-bold tabular-nums text-surface">
                    Clip {index + 1}
                  </span>
                  {idea.role && <Badge tone="accent">{idea.role}</Badge>}
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
                  {state === "sent" && <Badge tone="neutral">In Make</Badge>}
                  {state === "failed" && (
                    <Badge tone="neutral" className="text-danger">
                      <AlertTriangle size={11} /> Failed
                    </Badge>
                  )}
                </div>
                <h3 className="mt-2 font-display text-[16px] font-bold tracking-tight">{idea.title}</h3>
                {idea.hook && <p className="mt-1 text-[13.5px] text-muted">{idea.hook}</p>}

                {!segments ? (
                  <p className="mt-3 whitespace-pre-line rounded-xl border border-line bg-surface-2 p-4 text-[13.5px] leading-relaxed text-fg">
                    {idea.prompt}
                  </p>
                ) : (
                  <div className="mt-3 space-y-1.5">
                    {segments.map((s, i) => (
                      <div key={i} className="flex items-start gap-3 rounded-xl border border-line bg-surface-2 p-3">
                        <span
                          className={cn(
                            "mt-0.5 shrink-0 rounded-md px-2 py-0.5 text-[11px] font-bold tabular-nums",
                            s.label === "Style" || s.label === "Audio"
                              ? "bg-teal-soft text-teal"
                              : "bg-accent-soft text-accent-2",
                          )}
                        >
                          {s.label || "Setup"}
                        </span>
                        <p className="text-[13.5px] leading-relaxed text-fg">{s.text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Why it failed + how to get it through next time */}
                {state === "failed" &&
                  (() => {
                    const info = classifyGenError(job?.error);
                    const reason = genErrorReason(job?.error);
                    return (
                      <div className="mt-4 rounded-xl border border-danger/30 bg-danger/5 p-4">
                        <div className="flex items-center gap-2 text-[13.5px] font-semibold text-danger">
                          <AlertTriangle size={14} /> {info.title}
                        </div>
                        <p className="mt-1 text-[13px] leading-relaxed text-muted">{info.detail}</p>
                        {reason && (
                          <p
                            className="mt-2 truncate rounded-lg border border-line bg-surface px-2.5 py-1.5 font-mono text-[11px] text-faint"
                            title={reason}
                          >
                            {reason}
                          </p>
                        )}
                        <ul className="mt-2.5 space-y-1">
                          {info.tips.map((tip) => (
                            <li key={tip} className="flex gap-2 text-[12.5px] leading-relaxed text-fg">
                              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-danger/60" />
                              {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })()}

                <div className="mt-4 flex flex-wrap items-center gap-2">
                  {state === "failed" ? (
                    <>
                      <Button onClick={() => fixAndRetry(plan, idea, job)} disabled={fixing || !!fixingId}>
                        {fixing ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                        {fixing ? "Rewriting…" : "Fix & retry"}
                      </Button>
                      <Button variant="outline" onClick={() => openAndMake(plan, idea)} disabled={fixing}>
                        Open &amp; Make
                      </Button>
                    </>
                  ) : state === "produced" || state === "producing" ? (
                    <>
                      <Button onClick={() => router.push(`/app/library?open=${idea.jobId}`)}>
                        <Film size={16} /> View video
                      </Button>
                      <Button variant="outline" onClick={() => openAndMake(plan, idea)}>
                        <Sparkles size={15} /> Make again
                      </Button>
                    </>
                  ) : (
                    <Button onClick={() => openAndMake(plan, idea)}>
                      <Sparkles size={16} /> Open &amp; Make <ArrowRight size={15} />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
