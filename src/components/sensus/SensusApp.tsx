import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowRight, BookOpen, BrainCircuit, CalendarCheck, CalendarDays, Check, ChevronDown, Copy, Gauge, Goal, LoaderCircle,
  Mic, Pencil, Plus, Search, Settings, ShieldCheck, Sparkles, Square, Target, Trash2, Waves, X,
} from "lucide-react";
import logoAsset from "@/assets/sensus-logo.png.asset.json";
import { analyzeSensusInput, type ClarityResult, type StressBand } from "@/services/nebius";
import { Button } from "./Button";
import { CalendarActions } from "./CalendarActions";
import { recordWav } from "./record-wav";
import { generateFollowUpPrompts } from "@/lib/follow-up.functions";
import { generateExecutionRoadmap, type ExecutionRoadmap } from "@/lib/roadmap.functions";
import { planWeekFromReflection, type WeekPlan } from "@/lib/agenda.functions";

const example = "I have three major deliverables due this week and I keep thinking everyone will realize I am not capable. I am over-preparing every detail, avoiding asking for help, and staying online late, but I still feel behind. Next week I want to ship the beta and still protect two evenings.";

type Mode = "reflect" | "week" | "execute";
type GoalItem = { id: string; title: string; category: string; date: string; status: "In momentum" | "Refining" | "Achieved"; roadmap?: ExecutionRoadmap };
type Reflection = { id: string; text: string; result?: ClarityResult; guidanceMessage?: string; followUpPrompts?: string[]; gentleFocus?: string; createdAt: string };
type ActionEdits = { removed: string[]; custom: string[]; renamed: Record<string, string> };
type ActionEntry = { key: string; label: string; custom: boolean };

const initialGoals: GoalItem[] = [
  { id: "beta", title: "Ship v1 to 10 design partners", category: "Career", date: "Oct 30", status: "In momentum" },
  { id: "hours", title: "Keep my week under 55 hours", category: "Mindset", date: "Weekly", status: "Refining" },
];

const BAND_COPY: Record<StressBand, { hint: string; width: string }> = {
  Steady: { hint: "Pressure is real, but your resources still match the demand.", width: "33%" },
  Strained: { hint: "Demand is outrunning recovery. Protect one thing this week.", width: "66%" },
  Depleted: { hint: "Energy is already spent. Recovery is the productive move.", width: "100%" },
};

function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState(initial);
  const hydrated = useRef(false);
  useEffect(() => { const saved = localStorage.getItem(key); if (saved) { try { setValue(JSON.parse(saved) as T); } catch { /* ignore */ } } hydrated.current = true; }, [key]);
  useEffect(() => { if (hydrated.current) localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue] as const;
}

/** Shared push-to-talk: records, transcribes, and appends the words to existing text. */
function useDictation(append: (spoken: string) => void, onError: (message: string) => void) {
  const recorder = useRef<Awaited<ReturnType<typeof recordWav>> | null>(null);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const toggle = async () => {
    if (!recording) {
      try { recorder.current = await recordWav(); setRecording(true); setSeconds(0); timer.current = setInterval(() => setSeconds((n) => n + 1), 1000); }
      catch { onError("Microphone access is needed to record."); }
      return;
    }
    setRecording(false);
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    try {
      const file = await recorder.current?.stop();
      recorder.current = null;
      if (!file) return;
      setTranscribing(true);
      const form = new FormData();
      form.append("audio", file);
      const response = await fetch("/api/transcribe", { method: "POST", body: form });
      const body = await response.json() as { text?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Transcription failed.");
      const spoken = body.text?.trim();
      if (spoken) append(spoken);
    } catch (caught) { onError(caught instanceof Error ? caught.message : "Transcription failed."); }
    finally { setTranscribing(false); }
  };
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  return { recording, transcribing, seconds, toggle };
}

function LogoMark() { return <img src={logoAsset.url} alt="Sensus" className="logo-image" width={148} height={49} />; }
function SourcePill({ source }: { source: "nebius" | "demo" }) { return <span className={source === "nebius" ? "source-pill source-live" : "source-pill"}>{source === "nebius" ? "Live reasoning" : "Demo reasoning"}</span>; }
function formatTime(seconds: number) { return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }

function useAtmosphericPointer() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const selector = ".section-heading, .vision-hero, .voice-panel, .goal-builder, .insight-card, .agenda-card, .agenda-composer, .history-card, .settings-dialog, .listening-card, .empty-insights, .history-empty";
    let frame = 0;
    let pending: { target: HTMLElement; x: number; y: number } | null = null;
    const paint = () => {
      frame = 0;
      if (!pending) return;
      const { target, x, y } = pending;
      const rect = target.getBoundingClientRect();
      target.style.setProperty("--pointer-x", `${x - rect.left}px`);
      target.style.setProperty("--pointer-y", `${y - rect.top}px`);
      target.dataset["pointerGlow"] = "true";
      pending = null;
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const target = (event.target as Element | null)?.closest<HTMLElement>(selector);
      if (!target) return;
      pending = { target, x: event.clientX, y: event.clientY };
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const onPointerOut = (event: PointerEvent) => {
      const target = (event.target as Element | null)?.closest<HTMLElement>(selector);
      if (target && !target.contains(event.relatedTarget as Node | null)) delete target.dataset["pointerGlow"];
    };
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerout", onPointerOut, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerout", onPointerOut);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);
}

export function SensusApp() {
  useAtmosphericPointer();
  const [mode, setMode] = useState<Mode>("week");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [goals, setGoals] = useStoredState<GoalItem[]>("sensus-goals", initialGoals);
  const [reflections, setReflections] = useStoredState<Reflection[]>("sensus-reflections", []);
  const [plan, setPlan] = useStoredState<WeekPlan | null>("sensus-week-plan", null);
  return <div className="app-shell min-h-screen bg-background text-foreground"><div className="ambient-aurora" aria-hidden="true"><i className="aurora-sage" /><i className="aurora-lavender" /><i className="aurora-sky" /></div>
    <header className="app-header"><div className="header-inner">
      <div className="brand"><LogoMark /><p>Speak once. Get the pattern and a scheduled week.</p></div>
      <div className="header-actions"><Button variant="icon" size="icon" aria-label="Open settings" onClick={() => setSettingsOpen(true)}><Settings className="size-4" /></Button></div>
    </div></header>
    <main className="main-shell">
      <nav className="mode-dock" aria-label="Sensus modes">
        <button className={mode === "reflect" ? "mode-option active" : "mode-option"} onClick={() => setMode("reflect")}><Mic className="size-4" /><span>Reflect</span></button>
        <button className={mode === "week" ? "mode-option active" : "mode-option"} onClick={() => setMode("week")}><CalendarDays className="size-4" /><span>My Week</span></button>
        <button className={mode === "execute" ? "mode-option active" : "mode-option"} onClick={() => setMode("execute")}><Target className="size-4" /><span>Execution</span></button>
      </nav>
      {mode === "reflect"
        ? <ReflectView reflections={reflections} setReflections={setReflections} goals={goals} setGoals={setGoals} setPlan={setPlan} onScheduled={() => setMode("week")} />
        : mode === "week"
          ? <WeekView goals={goals} setGoals={setGoals} plan={plan} setPlan={setPlan} onSpeak={() => setMode("reflect")} />
          : <ExecuteView goals={goals} setGoals={setGoals} />}
      <div className="safety-note app-footer-note"><ShieldCheck className="size-4" /><p><b>Responsible AI:</b> Sensus is a non-clinical tool for cognitive productivity, not therapy or medical advice. Your reflections stay in this browser; text and audio are sent to AI providers for analysis and transcription only, and are not retained by Sensus.</p></div>
    </main>
    <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
  </div>;
}

function ReflectView({ reflections, setReflections, goals, setGoals, setPlan, onScheduled }: {
  reflections: Reflection[]; setReflections: (v: Reflection[]) => void; goals: GoalItem[]; setGoals: (v: GoalItem[]) => void; setPlan: (v: WeekPlan | null) => void; onScheduled: () => void;
}) {
  const analyze = useServerFn(analyzeSensusInput);
  const planWeek = useServerFn(planWeekFromReflection);
  const [text, setText] = useState("");
  const [result, setResult] = useState<ClarityResult | null>(reflections.find((item) => item.result)?.result ?? null);
  const [loading, setLoading] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [error, setError] = useState("");
  const [guidance, setGuidance] = useState("");
  const [completed, setCompleted] = useStoredState<string[]>("sensus-actions", []);
  const [actionEdits, setActionEdits] = useStoredState<ActionEdits>("sensus-action-edits", { removed: [], custom: [], renamed: {} });
  const dictation = useDictation((spoken) => setText((current) => `${current.trim()}${current.trim() ? " " : ""}${spoken}`), setError);

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const runAnalysis = async () => {
    if (!text.trim() || loading) return;
    setLoading(true); setError(""); setGuidance("");
    try {
      const next = await analyze({ data: { text } });
      const entry = { id: crypto.randomUUID(), text, createdAt: new Date().toISOString() };
      if (next.is_sufficient) { setResult(next); setReflections([{ ...entry, result: next }, ...reflections].slice(0, 50)); }
      else { setResult(null); setGuidance(next.guidance_message); setReflections([{ ...entry, guidanceMessage: next.guidance_message }, ...reflections].slice(0, 50)); }
    } catch { setError("Analysis is unavailable right now. Your reflection is still here."); }
    finally { setLoading(false); }
  };
  const scheduleWeek = async () => {
    if (scheduling || text.trim().length < 40) { if (text.trim().length < 40) setError("Say a little more about the week ahead so Sensus can schedule it."); return; }
    setScheduling(true); setError("");
    try {
      const response = await planWeek({ data: { reflection: text.trim(), goals: goals.map(({ id, title, category }) => ({ id, title, category })) } });
      if (!response.ok) { setError(response.error); return; }
      setPlan(response.plan);
      const fresh = response.plan.goals.filter((item) => !item.existingGoalId && !goals.some((goal) => goal.title.trim().toLowerCase() === item.title.trim().toLowerCase()));
      if (fresh.length) setGoals([...fresh.map((item) => ({ id: crypto.randomUUID(), title: item.title, category: item.category, date: "This week", status: "In momentum" as const })), ...goals]);
      onScheduled();
    } catch { setError("Week planning is unavailable right now.") }
    finally { setScheduling(false); }
  };

  const actionItems: ActionEntry[] = [
    ...(result?.action_items ?? []).filter((action) => !actionEdits.removed.includes(action)).map((action) => ({ key: action, label: actionEdits.renamed[action] ?? action, custom: false })),
    ...actionEdits.custom.map((action) => ({ key: `custom:${action}`, label: action, custom: true })),
  ];

  return <section className="view-enter">
    <div className="section-heading"><div><span className="eyebrow"><Sparkles className="size-3.5" /> DAILY REFLECTION</span><h1>Turn mental noise into<br /><span>clear next moves.</span></h1></div><p>Speak freely about today and the week ahead. Sensus finds the pattern, then turns it into a schedule you can keep.</p></div>

    <div className="voice-panel">
      <div className="voice-stage">
        <div className={dictation.recording ? "record-aura active" : "record-aura"}>
          <button className="record-button" aria-label={dictation.recording ? "Stop recording" : "Start recording"} onClick={dictation.toggle}>{dictation.recording ? <Square className="size-7 fill-current" /> : <Mic className="size-8" />}</button>
        </div>
        <div className="record-copy"><b>{dictation.recording ? "Listening deeply" : dictation.transcribing ? "Adding your words" : "Tap to speak"}</b><span>{dictation.recording ? formatTime(dictation.seconds) : "Your voice stays private and focused"}</span></div>
        <Waveform active={dictation.recording} />
      </div>
      <div className="transcript-side">
        <div className="panel-label"><span>Reflection transcript</span><span>{wordCount} words</span></div>
        <textarea value={text} onChange={(event) => { setText(event.target.value); setGuidance(""); }} placeholder="What feels tangled right now, and what do you want to do next week?" />
        <div className="preset-row"><button onClick={() => { setText(example); setGuidance(""); }}><span>⚡</span>Try an example</button></div>
        <div className="analyze-row" aria-live="polite">
          {error && <p className="error-text">{error}</p>}
          <Button size="lg" onClick={runAnalysis} disabled={loading || dictation.recording || !text.trim()}>{loading ? <LoaderCircle className="size-4 animate-spin" /> : <BrainCircuit className="size-4" />}{loading ? "Finding the signal" : "Reveal the signal"}<ArrowRight className="size-4" /></Button>
        </div>
      </div>
    </div>

    {guidance
      ? <article className="listening-card view-enter"><span className="icon-box mint"><Waves className="size-4" /></span><div><span className="eyebrow">SENSUS IS LISTENING...</span><h2>A little more context will reveal the pattern.</h2><p>{guidance}</p><div className="preset-row"><button onClick={() => { setText(example); setGuidance(""); }}><span>⚡</span>Try an example</button></div></div></article>
      : result ? <div className="results-wrap">
        <div className="results-header"><div><span className="eyebrow">YOUR CLARITY MAP</span><h2>The signal beneath the noise</h2></div><SourcePill source={result.source} /></div>
        <div className="insight-grid">
          <article className="insight-card compact-insight reframe-card"><div className="card-top"><span className="icon-box violet"><BrainCircuit /></span><span className="mini-label">GROUNDED PERSPECTIVE</span></div><span className="distortion">Pattern · {result.detected_distortion}</span><blockquote>“{result.reframe}”</blockquote><Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(result.reframe)}><Copy className="size-3.5" />Copy insight</Button></article>
          <article className="insight-card compact-insight"><div className="card-top"><span className="icon-box cyan"><Gauge /></span><span className="mini-label">BLIND-SPOT MIRROR</span></div><h3>{result.blind_spot_insight}</h3></article>
          <ActionsCard items={actionItems} completed={completed}
            onToggle={(label) => setCompleted(completed.includes(label) ? completed.filter((item) => item !== label) : [...completed, label])}
            onAdd={(label) => { if (!actionEdits.custom.includes(label)) setActionEdits({ ...actionEdits, custom: [...actionEdits.custom, label] }); }}
            onRemove={(key, custom) => custom ? setActionEdits({ ...actionEdits, custom: actionEdits.custom.filter((item) => `custom:${item}` !== key) }) : setActionEdits({ ...actionEdits, removed: [...actionEdits.removed, key] })}
            onRename={(key, label, custom) => custom ? setActionEdits({ ...actionEdits, custom: actionEdits.custom.map((item) => `custom:${item}` === key ? label : item) }) : setActionEdits({ ...actionEdits, renamed: { ...actionEdits.renamed, [key]: label } })} />
          <article className="insight-card wellness-card"><div className="card-top"><span className="icon-box rose"><Gauge /></span><span className="mini-label">WELLNESS PULSE</span></div>
            <div className="stress-row"><div><span>Capacity today</span><strong className="band-value">{result.stress_band}</strong></div><div className="meter"><i style={{ width: BAND_COPY[result.stress_band].width }} /></div></div>
            <p className="band-hint">{BAND_COPY[result.stress_band].hint}</p>
            <div className="tag-row">{result.emotional_tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
            <div className="grounding"><Waves className="size-4" /><div><b>2-minute reset</b><p>{result.grounding_micro_habit}</p></div></div>
          </article>
        </div>
        <div className="schedule-cta"><div><b>Turn this into next week.</b><span>Sensus links what you said to the goals you already track, then books realistic blocks.</span></div><Button size="lg" onClick={scheduleWeek} disabled={scheduling}>{scheduling ? <LoaderCircle className="size-4 animate-spin" /> : <CalendarCheck className="size-4" />}{scheduling ? "Scheduling your week" : "Schedule this into my week"}</Button></div>
      </div>
      : <div className="empty-insights"><BrainCircuit className="size-5" /><span>Your clarity map will unfold here after your first reflection.</span></div>}

    <ReflectionLog reflections={reflections} setReflections={setReflections} />
  </section>;
}

function ReflectionLog({ reflections, setReflections }: { reflections: Reflection[]; setReflections: (v: Reflection[]) => void }) {
  const generate = useServerFn(generateFollowUpPrompts);
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const query = search.trim().toLowerCase();
  const filtered = reflections.filter((reflection) => !query || [reflection.text, reflection.guidanceMessage, reflection.result?.reframe, reflection.result?.detected_distortion, ...(reflection.result?.action_items ?? []), ...(reflection.followUpPrompts ?? [])].filter(Boolean).join(" ").toLowerCase().includes(query));
  const trend = useMemo(() => {
    const bands = reflections.filter((item) => item.result).slice(0, 5).reverse().map((item) => item.result!.stress_band);
    return bands.length >= 2 ? `${bands[0]} → ${bands[bands.length - 1]} across your last ${bands.length} reflections` : null;
  }, [reflections]);
  const createPrompts = async (reflection: Reflection) => {
    if (reflection.text.trim().length < 60) { setError("This entry is too short for meaningful follow-up questions."); return; }
    setLoadingId(reflection.id); setError("");
    try {
      const response = await generate({ data: { reflection: reflection.text.trim() } });
      if (!response.ok) { setError(response.error); return; }
      setReflections(reflections.map((item) => item.id === reflection.id ? { ...item, followUpPrompts: response.prompts, gentleFocus: response.gentleFocus } : item));
    } catch { setError("Sensus could not shape follow-up prompts right now.") }
    finally { setLoadingId(null); }
  };
  return <section className="history-view reflect-log">
    <div className="history-toolbar">
      <label className="history-search"><Search className="size-4" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search past reflections, patterns, or actions" aria-label="Search reflections" /></label>
      <div className="date-filters">{search && <Button variant="ghost" size="sm" onClick={() => setSearch("")}><X className="size-3.5" />Clear</Button>}{reflections.length > 0 && <ConfirmRemove label="all reflection history" confirmLabel="Clear all history?" onConfirm={() => setReflections([])} withText />}</div>
    </div>
    <div className="history-summary"><span>{filtered.length} {filtered.length === 1 ? "reflection" : "reflections"}</span>{trend && <span className="trend-line"><Gauge className="size-3.5" />{trend}</span>}</div>
    {error && <p className="history-error" role="alert">{error}</p>}
    {filtered.length ? <div className="history-entries">{filtered.map((reflection) => <ReflectionCard key={reflection.id} reflection={reflection} loading={loadingId === reflection.id} onGenerate={() => createPrompts(reflection)} onDelete={() => setReflections(reflections.filter((item) => item.id !== reflection.id))} />)}</div>
      : <div className="history-empty"><BookOpen className="size-5" /><b>{reflections.length ? "No reflections match this search." : "No recorded reflections yet."}</b><span>{reflections.length ? "Try a different phrase." : "Speak or type above to generate your first clarity map."}</span></div>}
  </section>;
}

function ReflectionCard({ reflection, loading, onGenerate, onDelete }: { reflection: Reflection; loading: boolean; onGenerate: () => void; onDelete: () => void }) {
  const [open, setOpen] = useState(false);
  const result = reflection.result;
  return <article className={reflection.guidanceMessage ? "history-card guidance-entry" : "history-card"}>
    <div className="history-card-row">
      <button className="history-card-head" onClick={() => setOpen(!open)} aria-expanded={open}><div><span className="history-kind">{reflection.guidanceMessage ? "Guidance" : result ? `${result.detected_distortion} · ${result.stress_band}` : "Journal entry"}</span><h3>{reflection.text}</h3><time>{new Date(reflection.createdAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</time></div><ChevronDown className={open ? "size-4 rotate-180" : "size-4"} /></button>
      <ConfirmRemove label="this reflection" onConfirm={onDelete} />
    </div>
    {open && <div className="history-detail view-enter" aria-live="polite">
      {reflection.guidanceMessage && <div className="history-guidance"><Waves className="size-4" /><p>{reflection.guidanceMessage}</p></div>}
      {result && <>
        <div className="history-insight"><span>Grounded perspective</span><blockquote>“{result.reframe}”</blockquote></div>
        <div className="history-insight"><span>Blind-spot mirror</span><p>{result.blind_spot_insight}</p></div>
        <div className="history-actions"><span>Action items</span>{result.action_items.map((action) => <p key={action}><Check className="size-3.5" />{action}</p>)}</div>
      </>}
      {reflection.gentleFocus && <p className="gentle-focus"><Sparkles className="size-3.5" />{reflection.gentleFocus}</p>}
      {reflection.followUpPrompts?.length
        ? <div className="prompt-list"><span>Follow-up journal prompts</span>{reflection.followUpPrompts.map((prompt, index) => <div key={prompt}><b>{String(index + 1).padStart(2, "0")}</b><p>{prompt}</p></div>)}</div>
        : !reflection.guidanceMessage && <Button variant="glass" onClick={onGenerate} disabled={loading}>{loading ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}{loading ? "Shaping prompts" : "Generate follow-up prompts"}</Button>}
    </div>}
  </article>;
}

function WeekView({ goals, setGoals, plan, setPlan, onSpeak }: { goals: GoalItem[]; setGoals: (v: GoalItem[]) => void; plan: WeekPlan | null; setPlan: (v: WeekPlan | null) => void; onSpeak: () => void }) {
  const planWeek = useServerFn(planWeekFromReflection);
  const [brief, setBrief] = useStoredState("sensus-week-brief", "");
  const [planning, setPlanning] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [composing, setComposing] = useState(false);
  const dictation = useDictation((spoken) => setBrief([brief.trim(), spoken].filter(Boolean).join(" ")), setError);
  const buildWeek = async () => {
    if (planning) return;
    if (brief.trim().length < 40) { setError("Share a little more about what you want to do next week."); return; }
    setPlanning(true); setError(""); setNotice("");
    try {
      const response = await planWeek({ data: { reflection: brief.trim(), goals: goals.map(({ id, title, category }) => ({ id, title, category })) } });
      if (!response.ok) { setError(response.error); return; }
      setPlan(response.plan);
      const fresh = response.plan.goals.filter((item) => !item.existingGoalId && !goals.some((goal) => goal.title.trim().toLowerCase() === item.title.trim().toLowerCase()));
      if (fresh.length) setGoals([...fresh.map((item) => ({ id: crypto.randomUUID(), title: item.title, category: item.category, date: "This week", status: "In momentum" as const })), ...goals]);
      setNotice(fresh.length ? `${fresh.length} new goal${fresh.length > 1 ? "s" : ""} added to your programme.` : "Your agenda is linked to the goals you already track.");
      setComposing(false);
    } catch { setError("Week planning is unavailable right now. Your notes are still here."); }
    finally { setPlanning(false); }
  };
  const patchBlock = (id: string, patch: Partial<WeekPlan["blocks"][number]>) => { if (plan) setPlan({ ...plan, blocks: plan.blocks.map((block) => block.id === id ? { ...block, ...patch } : block) }); };
  const removeBlock = (id: string) => { if (plan) setPlan({ ...plan, blocks: plan.blocks.filter((block) => block.id !== id) }); };
  const done = plan?.blocks.filter((block) => block.done).length ?? 0;

  return <section className="view-enter agenda-view">
    <div className="section-heading agenda-hero"><div><span className="eyebrow"><CalendarDays className="size-3.5" /> MY WEEK</span><h1>See your week.<br /><span>Move with intention.</span></h1></div><p>Sensus reads what matters next week, connects it to your goals, and books realistic blocks you can edit.</p></div>

    {!plan && !composing
      ? <div className="week-cold-open"><CalendarDays className="size-6" /><b>Your week is open.</b><span>Tell Sensus what matters next week and it will build the schedule.</span><div className="cold-open-actions"><Button size="lg" onClick={onSpeak}><Mic className="size-4" />Speak about your week</Button><Button variant="glass" size="lg" onClick={() => setComposing(true)}><Pencil className="size-4" />Type it instead</Button></div></div>
      : <div className="agenda-composer">
        <textarea value={brief} onChange={(event) => setBrief(event.target.value)} placeholder="Next week I want to finish… I have time on… I also need space for…" aria-label="What do you want to do next week?" />
        <Button variant="icon" size="icon" className={dictation.recording ? "agenda-mic recording" : "agenda-mic"} aria-label={dictation.recording ? "Stop planning by voice" : "Plan by voice"} onClick={dictation.toggle}>{dictation.recording ? <Square className="size-4 fill-current" /> : dictation.transcribing ? <LoaderCircle className="size-4 animate-spin" /> : <Mic className="size-4" />}</Button>
        <div className="agenda-compose-actions"><span>{brief.length ? `${brief.length} characters` : "Type or speak naturally"}</span><Button onClick={buildWeek} disabled={planning || dictation.transcribing}>{planning ? <LoaderCircle className="size-4 animate-spin" /> : <CalendarCheck className="size-4" />}{planning ? "Building your week" : plan ? "Replan my week" : "Build my week"}</Button></div>
      </div>}

    <div aria-live="polite">{error && <p className="error-text">{error}</p>}{notice && <p className="agenda-notice" role="status"><Check className="size-3.5" />{notice}</p>}</div>

    {plan && <article className="agenda-card agenda-standalone">
      <div className="agenda-head">
        <div><span className="mini-label"><CalendarDays className="size-3.5" /> NEXT WEEK AGENDA</span><h2>{done} of {plan.blocks.length} blocks done</h2><p>{plan.summary}</p></div>
        <div className="agenda-head-actions"><Button variant="glass" size="sm" onClick={() => setComposing(true)}><Pencil className="size-3.5" />Edit brief</Button><ConfirmRemove label="this agenda" confirmLabel="Clear agenda?" onConfirm={() => { setPlan(null); setNotice(""); }} withText /></div>
      </div>
      <div className="plan-meta"><span><Sparkles className="size-3" />{plan.meta.model}</span><span>{plan.meta.toolCalls} agent tool calls</span><span>{plan.meta.goalsLinked} goals linked · {plan.meta.goalsCreated} created</span><span>{plan.meta.blocksScheduled} blocks scheduled</span><span>{(plan.meta.latencyMs / 1000).toFixed(1)}s</span></div>
      {plan.goals.length > 0 && <div className="agenda-goals">{plan.goals.map((goal) => <span key={`${goal.title}-${goal.category}`}><Goal className="size-3" />{goal.title}<i>{goal.category}</i></span>)}</div>}
      <div className="agenda-week">{groupByDay(plan.blocks).map((day) => <div className="agenda-day" key={day.label}>
        <span className="agenda-day-label">{day.label}</span>
        <div className="agenda-blocks">{day.blocks.map((block) => <AgendaBlockCard key={block.id} block={block} onPatch={(patch) => patchBlock(block.id, patch)} onRemove={() => removeBlock(block.id)} />)}</div>
      </div>)}</div>
    </article>}
  </section>;
}

function groupByDay(blocks: WeekPlan["blocks"]) {
  return blocks.reduce<{ label: string; blocks: WeekPlan["blocks"] }[]>((acc, block) => {
    const current = acc.find((group) => group.label === block.dayLabel);
    if (current) current.blocks.push(block); else acc.push({ label: block.dayLabel, blocks: [block] });
    return acc;
  }, []);
}

function AgendaBlockCard({ block, onPatch, onRemove }: { block: WeekPlan["blocks"][number]; onPatch: (patch: { title?: string; done?: boolean }) => void; onRemove: () => void }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(block.title);
  return <div className={block.done ? "agenda-block done" : "agenda-block"}>
    <span className="agenda-time">{block.timeLabel}<i>{block.durationMinutes} min</i></span>
    <div className="agenda-body">
      {editing
        ? <div className="block-edit"><input value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Edit block title" autoFocus /><Button variant="icon" size="icon" aria-label="Save block" onClick={() => { if (title.trim()) onPatch({ title: title.trim() }); setEditing(false); }}><Check className="size-3.5" /></Button><Button variant="icon" size="icon" aria-label="Cancel block edit" onClick={() => { setTitle(block.title); setEditing(false); }}><X className="size-3.5" /></Button></div>
        : <b>{block.title}</b>}
      <span className="agenda-goal">{block.goalTitle}</span>
      <p>{block.why}</p>
      <div className="block-tools">
        <button className={block.done ? "check-box checked" : "check-box"} aria-label={`Mark ${block.title} done`} aria-pressed={!!block.done} onClick={() => onPatch({ done: !block.done })}>{block.done && <Check className="size-3" />}</button>
        <CalendarActions title={block.title} compact when={block.startsAt} />
        <Button variant="icon" size="icon" aria-label={`Edit ${block.title}`} title="Edit" onClick={() => setEditing(true)}><Pencil className="size-3.5" /></Button>
        <ConfirmRemove label={block.title} onConfirm={onRemove} />
      </div>
    </div>
  </div>;
}

function ExecuteView({ goals, setGoals }: { goals: GoalItem[]; setGoals: (v: GoalItem[]) => void }) {
  const buildRoadmap = useServerFn(generateExecutionRoadmap);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Career");
  const [loading, setLoading] = useState(false);
  const [featured, setFeatured] = useState<GoalItem | null>(goals.find((goal) => goal.roadmap) ?? null);
  const [planError, setPlanError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const createGoal = async () => {
    const goalTitle = title.trim();
    if (goalTitle.length < 3) { setPlanError("Name the goal in a few words so Sensus can plan it."); return; }
    setLoading(true); setPlanError("");
    try {
      const response = await buildRoadmap({ data: { title: goalTitle, category, horizonWeeks: null } });
      if (!response.ok) { setPlanError(response.error); return; }
      const goal: GoalItem = { id: crypto.randomUUID(), title: goalTitle, category, date: `${response.roadmap.horizonWeeks} weeks`, status: "Refining", roadmap: response.roadmap };
      setGoals([goal, ...goals]); setFeatured(goal); setTitle("");
    } catch { setPlanError("Sensus could not reach the planner. Please try again."); }
    finally { setLoading(false); }
  };
  return <section className="view-enter">
    <div className="vision-hero"><div><span className="eyebrow amber"><Goal className="size-3.5" /> EXECUTION ARCHITECTURE</span><h1>Deconstruct ambition<br /><span>into daily execution.</span></h1></div><p>Name the goal. Sensus stress-tests it, then sequences dated milestones you can put on a calendar.</p></div>
    <div className="goal-builder">
      <div className="goal-inputs"><div className="field-grow"><label htmlFor="goal-title">What do you want to make real?</label><input id="goal-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ship v1 to 10 design partners" /></div><div><label htmlFor="category">Category</label><select id="category" value={category} onChange={(event) => setCategory(event.target.value)}>{["Career", "Fitness", "Mindset", "Creative"].map((item) => <option key={item}>{item}</option>)}</select></div><Button variant="primary" size="lg" onClick={createGoal} disabled={loading}>{loading ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}Generate Execution Roadmap</Button></div>
      <div aria-live="polite">{planError && <p className="plan-error"><ShieldCheck className="size-3.5" />{planError}</p>}{loading && <p className="plan-status">Stress-testing the ambition and sequencing milestones…</p>}</div>
      {featured?.roadmap && <>
        <div className="woop-grid"><div><span>01 · THE DREAM</span><p>{featured.roadmap.dream}</p></div><div><span>02 · INTERNAL FRICTION</span><p>{featured.roadmap.internal_friction}</p></div><div><span>03 · IF—THEN BRIDGE</span><p>{featured.roadmap.if_then_plan}</p><CalendarActions title={`Sensus: ${featured.title}`} /></div></div>
        <div className="roadmap-block view-enter"><div className="roadmap-head"><div><span className="eyebrow">EXECUTION ROADMAP</span><h3>{featured.roadmap.milestones.length} milestones · {featured.roadmap.horizonWeeks} weeks</h3></div><p>{featured.roadmap.weeklyCommitment}</p></div>
          <ol className="milestone-list">{featured.roadmap.milestones.map((milestone, index) => <li key={milestone.title}><div className="milestone-index">{String(index + 1).padStart(2, "0")}</div><div className="milestone-body"><div className="milestone-top"><b>{milestone.title}</b><span className="milestone-due"><CalendarDays className="size-3.5" />{milestone.dueLabel}</span></div><p>{milestone.outcome}</p><p className="milestone-action"><ArrowRight className="size-3.5" />{milestone.firstAction}</p><CalendarActions title={`${featured.title}: ${milestone.title}`} when={milestone.dueDate} compact /></div></li>)}</ol>
        </div>
      </>}
    </div>
    <div className="goal-roster">
      <div className="roster-head"><span className="eyebrow">YOUR GOALS</span><h3>{goals.length} {goals.length === 1 ? "goal" : "goals"} in play</h3></div>
      {goals.length ? <ul>{goals.map((goal) => <li key={goal.id}>{editingId === goal.id
        ? <><input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} aria-label="Edit goal title" autoFocus /><Button variant="icon" size="icon" aria-label="Save goal" onClick={() => { if (editTitle.trim().length >= 3) setGoals(goals.map((item) => item.id === goal.id ? { ...item, title: editTitle.trim() } : item)); setEditingId(null); }}><Check className="size-3.5" /></Button><Button variant="icon" size="icon" aria-label="Cancel goal edit" onClick={() => setEditingId(null)}><X className="size-3.5" /></Button></>
        : <><div><b>{goal.title}</b><span>{goal.category} · {goal.status}</span></div><div className="roster-tools">{goal.roadmap && <Button variant="ghost" size="sm" onClick={() => setFeatured(goal)}>View roadmap</Button>}<Button variant="icon" size="icon" aria-label={`Edit ${goal.title}`} title="Edit" onClick={() => { setEditingId(goal.id); setEditTitle(goal.title); }}><Pencil className="size-3.5" /></Button><ConfirmRemove label={goal.title} onConfirm={() => { setGoals(goals.filter((item) => item.id !== goal.id)); if (featured?.id === goal.id) setFeatured(null); }} /></div></>}</li>)}</ul>
        : <div className="list-empty-card"><Target className="size-5" /><b>No goals yet.</b><span>Name one ambition above and Sensus will build the roadmap.</span><Button variant="glass" size="sm" onClick={() => document.getElementById("goal-title")?.focus()}><Plus className="size-3.5" />Add your first goal</Button></div>}
    </div>
  </section>;
}

function Waveform({ active }: { active: boolean }) { return <div className={active ? "waveform active" : "waveform"} aria-hidden="true">{Array.from({ length: 42 }, (_, i) => <i key={i} style={{ height: `${8 + ((i * 13) % 28)}px`, animationDelay: `${(i % 8) * -0.09}s` }} />)}</div>; }

function ConfirmRemove({ label, onConfirm, confirmLabel, withText }: { label: string; onConfirm: () => void; confirmLabel?: string; withText?: boolean }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const timer = setTimeout(() => setArmed(false), 5000); return () => clearTimeout(timer); }, [armed]);
  if (!armed) return withText
    ? <Button variant="ghost" size="sm" onClick={() => setArmed(true)}><Trash2 className="size-3.5" />{confirmLabel ? "Clear" : "Remove"}</Button>
    : <Button variant="icon" size="icon" className="remove-button" aria-label={`Remove ${label}`} title="Remove" onClick={() => setArmed(true)}><Trash2 className="size-3.5" /></Button>;
  return <span className="confirm-remove"><span>{confirmLabel ?? "Remove?"}</span><Button variant="icon" size="icon" className="confirm-yes" aria-label={`Confirm removing ${label}`} onClick={() => { setArmed(false); onConfirm(); }}><Check className="size-3.5" /></Button><Button variant="icon" size="icon" aria-label="Cancel removal" onClick={() => setArmed(false)}><X className="size-3.5" /></Button></span>;
}

function ActionsCard({ items, completed, onToggle, onAdd, onRemove, onRename }: { items: ActionEntry[]; completed: string[]; onToggle: (label: string) => void; onAdd: (label: string) => void; onRemove: (key: string, custom: boolean) => void; onRename: (key: string, label: string, custom: boolean) => void }) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [draft, setDraft] = useState("");
  const submit = () => { if (!draft.trim()) return; onAdd(draft.trim()); setDraft(""); };
  return <article className="insight-card actions-card"><div className="card-top"><span className="icon-box mint"><CalendarCheck /></span><span className="mini-label">ACTION EXECUTION</span></div>
    <div className="action-list">{items.length ? items.map((item) => <div className="action-item" key={item.key}>{editingKey === item.key
      ? <><input className="action-edit" value={editValue} onChange={(event) => setEditValue(event.target.value)} aria-label="Edit action item" autoFocus /><Button variant="icon" size="icon" aria-label="Save action item" onClick={() => { if (editValue.trim()) onRename(item.key, editValue.trim(), item.custom); setEditingKey(null); }}><Check className="size-3.5" /></Button><Button variant="icon" size="icon" aria-label="Cancel action edit" onClick={() => setEditingKey(null)}><X className="size-3.5" /></Button></>
      : <><button aria-label={`Mark ${item.label} complete`} className={completed.includes(item.label) ? "check-box checked" : "check-box"} onClick={() => onToggle(item.label)}>{completed.includes(item.label) && <Check className="size-3" />}</button><span className={completed.includes(item.label) ? "done" : ""}>{item.label}</span><div className="action-tools"><CalendarActions title={item.label} compact /><Button variant="icon" size="icon" aria-label={`Edit ${item.label}`} title="Edit" onClick={() => { setEditingKey(item.key); setEditValue(item.label); }}><Pencil className="size-3.5" /></Button><ConfirmRemove label={item.label} onConfirm={() => onRemove(item.key, item.custom)} /></div></>}</div>)
      : <p className="list-empty">No tasks here yet. Add the one step you can take today.</p>}</div>
    <div className="action-add"><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") submit(); }} placeholder="Add a custom task" aria-label="New action item" /><Button variant="glass" size="sm" onClick={submit} disabled={!draft.trim()}><Plus className="size-3.5" />Add task</Button></div>
  </article>;
}

function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="settings-dialog">
    <div className="dialog-head"><div><Dialog.Title>Intelligence settings</Dialog.Title><Dialog.Description>Private keys stay on the server and never enter browser storage.</Dialog.Description></div><Dialog.Close asChild><Button variant="icon" size="icon" aria-label="Close settings"><X className="size-4" /></Button></Dialog.Close></div>
    <div className="connection-list">
      <div><span className="connection-icon cyan"><Waves /></span><div><b>ElevenLabs Scribe</b><p>Voice transcription</p></div><span className="connected">Connected</span></div>
      <div><span className="connection-icon violet"><BrainCircuit /></span><div><b>Nebius GLM-5.3-Flash</b><p>Reflection analysis</p></div><span className="connected">Connected</span></div>
      <div><span className="connection-icon violet"><Sparkles /></span><div><b>Lovable AI · gpt-6-astra</b><p>Agentic week planner, roadmaps, follow-up prompts</p></div><span className="connected">Connected</span></div>
    </div>
    <div className="privacy-note"><Settings className="size-4" /><p>Reflections are stored only in this browser. Text and audio are sent to the providers above for analysis and transcription, and are not retained by Sensus.</p></div>
  </Dialog.Content></Dialog.Portal></Dialog.Root>;
}
