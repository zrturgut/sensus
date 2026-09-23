import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowRight, BookOpen, BrainCircuit, CalendarCheck, CalendarDays, Check, ChevronDown, Copy, Eye, Gauge, Goal, Headphones, Heart,
  LayoutDashboard, LoaderCircle, Maximize2, Mic, Pin, Plus, RefreshCw, Search, Settings, ShieldCheck, Sparkles, Square, Target, Volume2, Waves, X,
} from "lucide-react";
import runnerImage from "@/assets/vision-runner.jpg";
import studioImage from "@/assets/vision-studio.jpg";
import mountainImage from "@/assets/vision-mountain.jpg";
import { analyzeSensusInput, type ClarityResult, type GoalResult } from "@/services/nebius";
import { Button } from "./Button";
import { CalendarActions } from "./CalendarActions";
import { recordWav } from "./record-wav";
import { startAmbientAudio, type AmbientAudio } from "@/lib/ambient-audio";
import { generateFollowUpPrompts } from "@/lib/follow-up.functions";

const presets = [
  { icon: "⚡", label: "Work overload & imposter loop", text: "I have three major deliverables due this week and I keep thinking everyone will realize I am not capable. I am over-preparing every detail, avoiding asking for help, and staying online late, but I still feel behind." },
  { icon: "🌅", label: "Morning burnout & routine friction", text: "I wake up already tired and then feel guilty that my morning routine falls apart. I try to fit exercise, planning, and deep work in before the day starts, but the pressure makes me avoid all of it." },
];
const affirmationVariations = [
  "I turn pressure into clear priorities and meet today with steady self-trust.",
  "I am capable, grounded, and free to grow through progress rather than perfection.",
  "I choose courageous action, protect my energy, and let consistency carry my vision forward.",
  "I welcome today’s opportunities with an open heart, a clear mind, and purposeful momentum.",
];

type Mode = "clarity" | "vision" | "board" | "history";
type GoalItem = { id: string; title: string; category: string; date: string; status: "In momentum" | "Refining" | "Achieved"; analysis?: GoalResult; imageUrl?: string; imagePrompt?: string };
type Reflection = { id: string; text: string; result?: ClarityResult; guidanceMessage?: string; followUpPrompts?: string[]; gentleFocus?: string; createdAt: string };
type AffirmationTile = { id: string; text: string; prompt?: string; title?: string; imageQuery?: string; createdAt: string; palette: number; favorite?: boolean };
const initialGoals: GoalItem[] = [
  { id: "run", title: "Run a half-marathon", category: "Fitness", date: "Nov 16", status: "In momentum" },
  { id: "ship", title: "Ship the AI product", category: "Career", date: "Oct 30", status: "Refining" },
  { id: "clarity", title: "Protect a clear mind", category: "Mindset", date: "Daily", status: "In momentum" },
];
const images = [runnerImage, studioImage, mountainImage];

function useStoredState<T>(key: string, initial: T) {
  const [value, setValue] = useState(initial);
  const hydrated = useRef(false);
  useEffect(() => { const saved = localStorage.getItem(key); if (saved) { try { setValue(JSON.parse(saved) as T); } catch { /* ignore */ } } hydrated.current = true; }, [key]);
  useEffect(() => { if (hydrated.current) localStorage.setItem(key, JSON.stringify(value)); }, [key, value]);
  return [value, setValue] as const;
}

function LogoMark() { return <div className="logo-mark"><Waves className="size-5" /></div>; }
function SourcePill({ source }: { source: "nebius" | "demo" }) { return <span className={source === "nebius" ? "source-pill source-live" : "source-pill"}>{source === "nebius" ? "Live reasoning" : "Demo reasoning"}</span>; }
function formatTime(seconds: number) { return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`; }

function useAtmosphericPointer() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const selector = ".section-heading, .vision-hero, .voice-panel, .goal-builder, .insight-card, .affirmation-capsule, .vision-card, .affirmation-composer, .follow-up-composer, .history-card, .settings-dialog, .listening-card, .empty-insights, .history-empty";
    let frame = 0;
    let pending: { target: HTMLElement; x: number; y: number } | null = null;
    let touchTimer: ReturnType<typeof setTimeout> | null = null;
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
    const queue = (target: HTMLElement, x: number, y: number) => {
      pending = { target, x, y };
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "mouse") return;
      const target = (event.target as Element | null)?.closest<HTMLElement>(selector);
      if (target) queue(target, event.clientX, event.clientY);
    };
    const onPointerOut = (event: PointerEvent) => {
      const target = (event.target as Element | null)?.closest<HTMLElement>(selector);
      if (target && !target.contains(event.relatedTarget as Node | null)) delete target.dataset["pointerGlow"];
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === "mouse") return;
      const target = (event.target as Element | null)?.closest<HTMLElement>(selector);
      if (!target) return;
      queue(target, event.clientX, event.clientY);
      target.dataset["touchGlow"] = "true";
      if (touchTimer) clearTimeout(touchTimer);
      touchTimer = setTimeout(() => delete target.dataset["touchGlow"], 420);
    };
    document.addEventListener("pointermove", onPointerMove, { passive: true });
    document.addEventListener("pointerout", onPointerOut, { passive: true });
    document.addEventListener("pointerdown", onPointerDown, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerout", onPointerOut);
      document.removeEventListener("pointerdown", onPointerDown);
      if (frame) cancelAnimationFrame(frame);
      if (touchTimer) clearTimeout(touchTimer);
    };
  }, []);
}

export function SensusApp() {
  useAtmosphericPointer();
  const [mode, setMode] = useState<Mode>("clarity");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [goals, setGoals] = useStoredState<GoalItem[]>("sensus-goals", initialGoals);
  const [reflections, setReflections] = useStoredState<Reflection[]>("sensus-reflections", []);
  const [affirmations, setAffirmations] = useStoredState<AffirmationTile[]>("sensus-affirmations", []);
  useEffect(() => {
    const removedTestTexts = ["hello. right now we are testing", "hello, bla bla bla"];
    const cleaned = reflections.filter((item) => !removedTestTexts.includes(item.text.trim().toLowerCase()));
    if (cleaned.length !== reflections.length) setReflections(cleaned);
  }, [reflections, setReflections]);
  return <div className="app-shell min-h-screen bg-background text-foreground"><div className="ambient-aurora" aria-hidden="true"><i className="aurora-sage" /><i className="aurora-lavender" /><i className="aurora-sky" /></div>
    <header className="app-header"><div className="header-inner">
      <div className="brand"><LogoMark /><div><div className="brand-name">SENSUS</div><p>Voice-first clarity, grounded execution & vision</p></div></div>
      <div className="header-actions"><div className="status-cluster"><span className="status-badge"><i className="status-dot cyan" />Speech <b>ElevenLabs Scribe</b></span><span className="status-badge"><i className="status-dot mint" />Reasoning <b>Nebius Token Factory</b></span></div><Button variant="icon" size="icon" aria-label="Open settings" onClick={() => setSettingsOpen(true)}><Settings className="size-4" /></Button></div>
    </div></header>
    <main className="main-shell">
      <nav className="mode-dock" aria-label="Sensus modes"><button className={mode === "clarity" ? "mode-option active" : "mode-option"} onClick={() => setMode("clarity")}><Mic className="size-4" /><span>Clarity Engine</span></button><button className={mode === "vision" ? "mode-option active" : "mode-option"} onClick={() => setMode("vision")}><Target className="size-4" /><span>Vision & Execution Architecture</span></button><button className={mode === "board" ? "mode-option active" : "mode-option"} onClick={() => setMode("board")}><LayoutDashboard className="size-4" /><span>Vision Board</span></button><button className={mode === "history" ? "mode-option active" : "mode-option"} onClick={() => setMode("history")}><BookOpen className="size-4" /><span>Reflection History</span></button></nav>
      {mode === "clarity" ? <ClarityView reflections={reflections} setReflections={setReflections} affirmations={affirmations} setAffirmations={setAffirmations} /> : mode === "vision" ? <VisionView goals={goals} setGoals={setGoals} /> : mode === "board" ? <BoardView goals={goals} setGoals={setGoals} affirmations={affirmations} setAffirmations={setAffirmations} /> : <HistoryView reflections={reflections} setReflections={setReflections} />}
    </main>
    <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
  </div>;
}

function ClarityView({ reflections, setReflections, affirmations, setAffirmations }: { reflections: Reflection[]; setReflections: (v: Reflection[]) => void; affirmations: AffirmationTile[]; setAffirmations: (v: AffirmationTile[]) => void }) {
  const analyze = useServerFn(analyzeSensusInput);
  const recorder = useRef<Awaited<ReturnType<typeof recordWav>> | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recording, setRecording] = useState(false); const [seconds, setSeconds] = useState(0); const [text, setText] = useState("");
  const [result, setResult] = useState<ClarityResult | null>(reflections.find((item) => item.result)?.result ?? null); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [completed, setCompleted] = useStoredState<string[]>("sensus-actions", []); const [drawer, setDrawer] = useState(false); const [question, setQuestion] = useState("");
  const [guidance, setGuidance] = useState("");
  const [affirmationLoading, setAffirmationLoading] = useState(false); const [audioState, setAudioState] = useState<"idle" | "loading" | "playing">("idle"); const [affirmationNotice, setAffirmationNotice] = useState("");
  const toggleRecording = async () => {
    setError("");
    if (!recording) { try { recorder.current = await recordWav(); setRecording(true); setSeconds(0); timer.current = setInterval(() => setSeconds((n) => n + 1), 1000); } catch { setError("Microphone access is needed to record a reflection."); } return; }
    setRecording(false); if (timer.current) clearInterval(timer.current); timer.current = null;
    try { const file = await recorder.current?.stop(); recorder.current = null; if (!file) return; setLoading(true); const form = new FormData(); form.append("audio", file); const response = await fetch("/api/transcribe", { method: "POST", body: form }); const body = await response.json() as { text?: string; error?: string }; if (!response.ok) throw new Error(body.error ?? "Transcription failed."); setText(body.text ?? ""); } catch (caught) { setError(caught instanceof Error ? caught.message : "Transcription failed."); } finally { setLoading(false); }
  };
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const enoughContext = text.trim().length >= 60 && wordCount >= 15;
  const shortGuidance = "Tell Sensus a little more about what's on your mind, what happened today, or what feels heavy right now (at least a couple of sentences) so we can find the pattern.";
  const runAnalysis = async () => { if (!enoughContext) { setGuidance(shortGuidance); setResult(null); return; } setLoading(true); setError(""); setGuidance(""); try { const next = await analyze({ data: { kind: "clarity", text } }); if (!("is_sufficient" in next)) throw new Error("Unexpected analysis response"); if (next.is_sufficient) { setResult(next); setReflections([{ id: crypto.randomUUID(), text, result: next, createdAt: new Date().toISOString() }, ...reflections].slice(0, 50)); } else { setResult(null); setGuidance(next.guidance_message); setReflections([{ id: crypto.randomUUID(), text, guidanceMessage: next.guidance_message, createdAt: new Date().toISOString() }, ...reflections].slice(0, 50)); } } catch { setError("Analysis is unavailable right now. Your reflection is still here."); } finally { setLoading(false); } };
  const toggleAction = (action: string) => setCompleted(completed.includes(action) ? completed.filter((item) => item !== action) : [...completed, action]);
  const pinAffirmation = () => { if (!result) return; const affirmation = result.positive_affirmation ?? "I meet this moment with clarity, self-trust, and the courage to shape what comes next."; if (affirmations.some((item) => item.text === affirmation)) { setAffirmationNotice("Already glowing on your Affirmation Wall."); return; } setAffirmations([{ id: crypto.randomUUID(), text: affirmation, prompt: result.manifestation_prompt, title: result.vision_tile_suggestion?.title, imageQuery: result.vision_tile_suggestion?.image_query, createdAt: new Date().toISOString(), palette: affirmations.length % 4, favorite: false }, ...affirmations]); setAffirmationNotice("Pinned to your Affirmation Wall."); };
  const refreshAffirmation = async () => { if (!text.trim() || affirmationLoading) return; setAffirmationLoading(true); setAffirmationNotice(""); try { const next = await analyze({ data: { kind: "clarity", text: `${text}\nCreate a fresh affirmation variation for this moment.` } }); if ("reframe" in next && result) { const generated = next.positive_affirmation; const fresh = generated && generated !== result.positive_affirmation ? generated : affirmationVariations.find((item) => item !== result.positive_affirmation) ?? "I turn pressure into clear priorities and meet today with steady self-trust."; setResult({ ...result, positive_affirmation: fresh, affirmation_category: next.affirmation_category, vision_tile_suggestion: next.vision_tile_suggestion, manifestation_prompt: next.manifestation_prompt, source: next.source }); } } catch { setAffirmationNotice("A fresh affirmation is unavailable right now."); } finally { setAffirmationLoading(false); } };
  const playAffirmation = async () => { if (!result || audioState !== "idle") return; setAudioState("loading"); setAffirmationNotice(""); try { const response = await fetch("/api/affirmation-speech", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: result.positive_affirmation ?? "I meet this moment with clarity and self-trust." }) }); if (!response.ok) { const body = await response.json().catch(() => null) as { error?: string } | null; throw new Error(body?.error ?? "Affirmation audio is unavailable."); } const url = URL.createObjectURL(await response.blob()); const audio = new Audio(url); audio.onended = () => { URL.revokeObjectURL(url); setAudioState("idle"); }; audio.onerror = () => { URL.revokeObjectURL(url); setAudioState("idle"); setAffirmationNotice("Audio playback could not start."); }; setAudioState("playing"); await audio.play(); } catch (caught) { setAudioState("idle"); setAffirmationNotice(caught instanceof Error ? caught.message : "Affirmation audio is unavailable."); } };
  return <section className="view-enter"><div className="section-heading"><div><span className="eyebrow"><Sparkles className="size-3.5" /> DAILY REFLECTION</span><h1>Turn mental noise into<br/><span>clear next moves.</span></h1></div><p>Speak freely. Sensus finds the pattern beneath the pressure, then turns it into grounded action.</p></div>
    <div className="voice-panel">
      <div className="voice-stage"><div className={recording ? "record-aura active" : "record-aura"}><button className="record-button" aria-label={recording ? "Stop recording" : "Start recording"} onClick={toggleRecording}>{recording ? <Square className="size-7 fill-current" /> : <Mic className="size-8" />}</button></div><div className="record-copy"><b>{recording ? "Listening deeply" : loading ? "Processing reflection" : "Tap to speak"}</b><span>{recording ? formatTime(seconds) : "Your voice stays private and focused"}</span></div><Waveform active={recording} /></div>
      <div className="transcript-side"><div className="panel-label"><span>Reflection transcript</span><span>{text.length} chars · {wordCount} words</span></div><textarea value={text} onChange={(event) => { setText(event.target.value); setGuidance(""); }} placeholder="What feels tangled right now? Speak or write without editing yourself..." /><div className="preset-row">{presets.map((preset) => <button key={preset.label} onClick={() => { setText(preset.text); setGuidance(""); }}><span>{preset.icon}</span>{preset.label}</button>)}</div><div className="analyze-row">{error && <p className="error-text">{error}</p>}{text.length > 0 && !enoughContext && <p className="context-hint">Add a few more details to analyze · {Math.max(0, 15 - wordCount)} words remaining</p>}<Button size="lg" onClick={runAnalysis} disabled={loading || !enoughContext}>{loading ? <LoaderCircle className="size-4 animate-spin" /> : <BrainCircuit className="size-4" />}{loading ? "Finding the signal" : "Reveal the signal"}<ArrowRight className="size-4" /></Button></div></div>
    </div>
    {guidance ? <ListeningCard message={guidance} onPreset={(preset) => { setText(preset); setGuidance(""); }} /> : result ? <div className="results-wrap"><DailyAffirmation result={result} onPin={pinAffirmation} onPlay={playAffirmation} onRefresh={refreshAffirmation} audioState={audioState} refreshing={affirmationLoading} notice={affirmationNotice} /><div className="results-header"><div><span className="eyebrow">YOUR CLARITY MAP</span><h2>The signal beneath the noise</h2></div><SourcePill source={result.source} /></div><div className="insight-grid">
      <article className="insight-card reframe-card"><div className="card-top"><span className="icon-box violet"><BrainCircuit /></span><span className="mini-label">GROUNDED PERSPECTIVE</span></div><span className="distortion">Pattern · {result.detected_distortion}</span><blockquote>“{result.reframe}”</blockquote><Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(result.reframe)}><Copy className="size-3.5" />Copy insight</Button></article>
      <article className="insight-card"><div className="card-top"><span className="icon-box cyan"><Eye /></span><span className="mini-label">BLIND-SPOT MIRROR</span></div><h3>{result.blind_spot_insight}</h3><button className="drawer-trigger" onClick={() => setDrawer(!drawer)}>Interrogate this pattern <ChevronDown className={drawer ? "size-4 rotate-180" : "size-4"} /></button>{drawer && <div className="socratic"><button onClick={() => setQuestion("Your default protects you from short-term discomfort, but charges interest through exhaustion.")}>Why is this habit my default?</button><button onClick={() => setQuestion("An objective mentor would define done, ask for evidence, and expose the work earlier.")}>What would an objective mentor do?</button>{question && <p>{question}</p>}</div>}</article>
      <article className="insight-card actions-card"><div className="card-top"><span className="icon-box mint"><CalendarCheck /></span><span className="mini-label">ACTION EXECUTION</span></div><div className="action-list">{result.action_items.map((action) => <div className="action-item" key={action}><button aria-label={`Mark ${action} complete`} className={completed.includes(action) ? "check-box checked" : "check-box"} onClick={() => toggleAction(action)}>{completed.includes(action) && <Check className="size-3" />}</button><span className={completed.includes(action) ? "done" : ""}>{action}</span><CalendarActions title={action} compact /></div>)}</div></article>
      <article className="insight-card wellness-card"><div className="card-top"><span className="icon-box rose"><Gauge /></span><span className="mini-label">WELLNESS PULSE</span></div><div className="stress-row"><div><span>Stress load</span><strong>{result.stress_level}<small>/10</small></strong></div><div className="meter"><i style={{ width: `${result.stress_level * 10}%` }} /></div></div><div className="tag-row">{result.emotional_tags.map((tag) => <span key={tag}>{tag}</span>)}</div><div className="grounding"><Waves className="size-4" /><div><b>2-minute reset</b><p>{result.grounding_micro_habit}</p></div></div></article>
      <div className="safety-note"><ShieldCheck className="size-4" /><p><b>Responsible AI:</b> Non-clinical tool for cognitive productivity. Ephemeral local processing — no personal voice recordings stored on external servers.</p></div>
    </div></div> : <div className="empty-insights"><BrainCircuit className="size-5" /><span>Your clarity map will unfold here after your first reflection.</span></div>}
  </section>;
}

function HistoryView({ reflections, setReflections }: { reflections: Reflection[]; setReflections: (value: Reflection[]) => void }) {
  const generate = useServerFn(generateFollowUpPrompts);
  const reflectionRecorder = useRef<Awaited<ReturnType<typeof recordWav>> | null>(null);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [draft, setDraft] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [dictating, setDictating] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const normalizedSearch = search.trim().toLowerCase();
  const filtered = reflections.filter((reflection) => {
    const day = reflection.createdAt.slice(0, 10);
    if (fromDate && day < fromDate) return false;
    if (toDate && day > toDate) return false;
    if (!normalizedSearch) return true;
    const searchable = [reflection.text, reflection.guidanceMessage, reflection.result?.detected_distortion, reflection.result?.reframe, reflection.result?.blind_spot_insight, ...(reflection.result?.action_items ?? []), ...(reflection.followUpPrompts ?? [])].filter(Boolean).join(" ").toLowerCase();
    return searchable.includes(normalizedSearch);
  });
  const createPrompts = async (reflectionText: string, reflectionId?: string) => {
    if (reflectionText.trim().length < 60) { setError("Add at least a couple of sentences so Sensus can shape meaningful follow-up questions."); return; }
    const targetId = reflectionId ?? crypto.randomUUID();
    setLoadingId(targetId); setError("");
    try {
      const response = await generate({ data: { reflection: reflectionText.trim() } });
      if (!response.ok) { setError(response.error); return; }
      if (reflectionId) {
        setReflections(reflections.map((item) => item.id === reflectionId ? { ...item, followUpPrompts: response.prompts, gentleFocus: response.gentleFocus } : item));
      } else {
        setReflections([{ id: targetId, text: reflectionText.trim(), followUpPrompts: response.prompts, gentleFocus: response.gentleFocus, createdAt: new Date().toISOString() }, ...reflections].slice(0, 50));
        setDraft("");
      }
    } catch { setError("Sensus could not shape follow-up prompts right now. Your reflection is still here."); }
    finally { setLoadingId(null); }
  };
  const toggleDictation = async () => {
    setError("");
    if (!dictating) {
      try {
        reflectionRecorder.current = await recordWav();
        setDictating(true);
      } catch {
        setError("Microphone access is needed to dictate a reflection.");
      }
      return;
    }
    setDictating(false);
    try {
      const file = await reflectionRecorder.current?.stop();
      reflectionRecorder.current = null;
      if (!file) return;
      setTranscribing(true);
      const form = new FormData();
      form.append("audio", file);
      const response = await fetch("/api/transcribe", { method: "POST", body: form });
      const body = await response.json() as { text?: string; error?: string };
      if (!response.ok) throw new Error(body.error ?? "Transcription failed.");
      const spokenText = body.text?.trim();
      if (spokenText) setDraft((current) => `${current.trim()}${current.trim() ? " " : ""}${spokenText}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Transcription failed.");
    } finally {
      setTranscribing(false);
    }
  };
  const grouped = filtered.reduce<Record<string, Reflection[]>>((groups, reflection) => {
    const day = reflection.createdAt.slice(0, 10);
    groups[day] = [...(groups[day] ?? []), reflection];
    return groups;
  }, {});
  return <section className="view-enter history-view">
    <div className="vision-hero history-hero"><div><span className="eyebrow"><BookOpen className="size-3.5" /> REFLECTION HISTORY</span><h1>Notice what changes<br/><span>when you look back.</span></h1></div><p>Search the thoughts, patterns, guidance, and actions that have shaped your recent days.</p></div>
    <article className="follow-up-composer"><div className="follow-up-copy"><span className="icon-box mint"><Sparkles className="size-4" /></span><div><span className="eyebrow">CONTINUE THE REFLECTION</span><h2>Let one insight open the next.</h2><p>Paste or write a completed reflection. Sensus will shape four personalized questions for your next journaling session.</p></div></div><div className="follow-up-entry"><div className="reflection-dictation"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Today I noticed…" aria-label="Completed reflection"/><Button className={dictating ? "reflection-mic recording" : "reflection-mic"} variant="icon" size="icon" aria-label={dictating ? "Stop dictation" : transcribing ? "Transcribing reflection" : "Dictate reflection"} aria-pressed={dictating} disabled={transcribing} onClick={toggleDictation}>{transcribing ? <LoaderCircle className="size-4 animate-spin" /> : dictating ? <Square className="size-3.5 fill-current" /> : <Mic className="size-4" />}</Button></div><div><span>{dictating ? "Listening… tap the mic to finish" : transcribing ? "Adding your words…" : draft.trim() ? `${draft.trim().split(/\s+/).length} words` : "A couple of sentences is enough"}</span><Button onClick={() => createPrompts(draft)} disabled={draft.trim().length < 60 || loadingId !== null || dictating || transcribing}>{loadingId && !reflections.some((item) => item.id === loadingId) ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}Generate follow-up prompts</Button></div></div></article>
    {error && <p className="history-error" role="alert">{error}</p>}
    <div className="history-toolbar"><label className="history-search"><Search className="size-4"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search reflections, patterns, or actions" aria-label="Search reflection history"/></label><div className="date-filters"><label><span>From</span><input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)}/></label><label><span>To</span><input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)}/></label>{(search || fromDate || toDate) && <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setFromDate(""); setToDate(""); }}><X className="size-3.5"/>Clear</Button>}</div></div>
    <div className="history-summary"><span>{filtered.length} {filtered.length === 1 ? "reflection" : "reflections"}</span><span>{Object.keys(grouped).length} {Object.keys(grouped).length === 1 ? "day" : "days"}</span></div>
    {filtered.length ? <div className="history-timeline">{Object.entries(grouped).map(([day, entries]) => <section className="history-day" key={day}><div className="history-date"><CalendarDays className="size-4"/><time dateTime={day}>{new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</time></div><div className="history-entries">{entries.map((reflection) => <ReflectionHistoryCard key={reflection.id} reflection={reflection} loading={loadingId === reflection.id} onGenerate={() => createPrompts(reflection.text, reflection.id)}/>)}</div></section>)}</div> : <div className="history-empty"><BookOpen className="size-5"/><b>{reflections.length ? "No reflections match this view." : "No recorded reflections yet."}</b><span>{reflections.length ? "Try a different phrase or widen the date range." : "Speak or type above to generate your first clarity map."}</span></div>}
  </section>;
}

function ReflectionHistoryCard({ reflection, loading, onGenerate }: { reflection: Reflection; loading: boolean; onGenerate: () => void }) {
  const [open, setOpen] = useState(false);
  const result = reflection.result;
  return <article className={reflection.guidanceMessage ? "history-card guidance-entry" : "history-card"}><button className="history-card-head" onClick={() => setOpen(!open)} aria-expanded={open}><div><span className="history-kind">{reflection.guidanceMessage ? "Guidance" : result ? result.detected_distortion : "Journal entry"}</span><h3>{reflection.text}</h3><time>{new Date(reflection.createdAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}</time></div><ChevronDown className={open ? "size-4 rotate-180" : "size-4"}/></button>{open && <div className="history-detail view-enter">{reflection.guidanceMessage && <div className="history-guidance"><Waves className="size-4"/><p>{reflection.guidanceMessage}</p></div>}{result && <><div className="history-insight"><span>Grounded perspective</span><blockquote>“{result.reframe}”</blockquote></div><div className="history-insight"><span>Blind-spot mirror</span><p>{result.blind_spot_insight}</p></div><div className="history-actions"><span>Action items</span>{result.action_items.map((action) => <p key={action}><Check className="size-3.5"/>{action}</p>)}</div></>}{reflection.gentleFocus && <p className="gentle-focus"><Sparkles className="size-3.5"/>{reflection.gentleFocus}</p>}{reflection.followUpPrompts?.length ? <div className="prompt-list"><span>Follow-up journal prompts</span>{reflection.followUpPrompts.map((prompt, index) => <div key={prompt}><b>{String(index + 1).padStart(2, "0")}</b><p>{prompt}</p></div>)}</div> : !reflection.guidanceMessage && <Button variant="glass" onClick={onGenerate} disabled={loading}>{loading ? <LoaderCircle className="size-4 animate-spin"/> : <Sparkles className="size-4"/>}{loading ? "Shaping prompts" : "Generate follow-up prompts"}</Button>}</div>}</article>;
}

function ListeningCard({ message, onPreset }: { message: string; onPreset: (text: string) => void }) { return <article className="listening-card view-enter"><span className="icon-box mint"><Waves className="size-4" /></span><div><span className="eyebrow">SENSUS IS LISTENING...</span><h2>A little more context will reveal the pattern.</h2><p>{message}</p><div className="preset-row">{presets.map((preset) => <button key={preset.label} onClick={() => onPreset(preset.text)}><span>{preset.icon}</span>{preset.label}</button>)}</div></div></article>; }

function DailyAffirmation({ result, onPin, onPlay, onRefresh, audioState, refreshing, notice }: { result: ClarityResult; onPin: () => void; onPlay: () => void; onRefresh: () => void; audioState: "idle" | "loading" | "playing"; refreshing: boolean; notice: string }) { return <article className="affirmation-capsule"><div className="affirmation-inner"><div className="affirmation-heading"><span className="affirmation-category"><Sparkles className="size-3.5" />{result.affirmation_category ?? "Inner Peace"}</span><SourcePill source={result.source} /></div><blockquote>“{result.positive_affirmation ?? "I meet this moment with clarity, self-trust, and the courage to shape what comes next."}”</blockquote><div className="manifestation-line"><span>Today’s frequency</span><p>{result.manifestation_prompt ?? "Picture tonight: your essential progress is made and your energy still feels like your own."}</p></div><div className="affirmation-actions"><Button variant="glass" onClick={onPin}><Pin className="size-4" />Pin to Vision Board</Button><Button variant="glass" onClick={onPlay} disabled={audioState !== "idle"}>{audioState === "loading" ? <LoaderCircle className="size-4 animate-spin" /> : <Volume2 className={audioState === "playing" ? "size-4 audio-pulse" : "size-4"} />}{audioState === "playing" ? "Playing" : audioState === "loading" ? "Preparing" : "Listen"}</Button><Button variant="ghost" onClick={onRefresh} disabled={refreshing}>{refreshing ? <LoaderCircle className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}New Mantra</Button></div>{notice && <p className="affirmation-notice" role="status">{notice}</p>}</div></article>; }

function Waveform({ active }: { active: boolean }) { return <div className={active ? "waveform active" : "waveform"} aria-hidden="true">{Array.from({ length: 42 }, (_, i) => <i key={i} style={{ height: `${8 + ((i * 13) % 28)}px`, animationDelay: `${(i % 8) * -0.09}s` }} />)}</div>; }

function VisionView({ goals, setGoals }: { goals: GoalItem[]; setGoals: (v: GoalItem[]) => void }) {
  const analyze = useServerFn(analyzeSensusInput); const [title, setTitle] = useState(""); const [category, setCategory] = useState("Career"); const [loading, setLoading] = useState(false); const [featured, setFeatured] = useState<GoalItem | null>(goals.find((g) => g.analysis) ?? null);
  const createGoal = async () => { if (title.trim().length < 3) return; setLoading(true); try { const result = await analyze({ data: { kind: "goal", title, category } }); if ("dream" in result) { const goal: GoalItem = { id: crypto.randomUUID(), title, category, date: "12 weeks", status: "Refining", analysis: result }; setGoals([goal, ...goals]); setFeatured(goal); setTitle(""); } } finally { setLoading(false); } };
  return <section className="view-enter"><div className="vision-hero"><div><span className="eyebrow amber"><Goal className="size-3.5" /> EXECUTION ARCHITECTURE</span><h1>Deconstruct Ambition<br/><span>into daily execution.</span></h1></div><p>Dream vividly. Name the friction honestly. Install a plan that still works on ordinary days.</p></div>
    <div className="goal-builder"><div className="goal-inputs"><div className="field-grow"><label htmlFor="goal-title">What do you want to make real?</label><input id="goal-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ship my AI SaaS MVP" /></div><div><label htmlFor="category">Category</label><select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>{["Career","Fitness","Mindset","Creative"].map((item) => <option key={item}>{item}</option>)}</select></div><Button variant="primary" size="lg" onClick={createGoal} disabled={loading}>{loading ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}Generate Execution Roadmap</Button></div>
      {featured?.analysis && <div className="woop-grid"><div><span>01 · THE DREAM</span><p>{featured.analysis.dream}</p></div><div><span>02 · INTERNAL FRICTION</span><p>{featured.analysis.internal_friction}</p></div><div><span>03 · IF—THEN BRIDGE</span><p>{featured.analysis.if_then_plan}</p><CalendarActions title={featured.title} /></div></div>}
    </div>
  </section>;
}

function BoardView({ goals, setGoals, affirmations, setAffirmations }: { goals: GoalItem[]; setGoals: (v: GoalItem[]) => void; affirmations: AffirmationTile[]; setAffirmations: (v: AffirmationTile[]) => void }) {
  const [boardTab, setBoardTab] = useState<"visions" | "affirmations">("visions");
  const [affirmationDraft, setAffirmationDraft] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [newGoal, setNewGoal] = useState("");
  const [newCategory, setNewCategory] = useState("Mindset");
  const [generating, setGenerating] = useState<string | null>(null);
  const [artNotice, setArtNotice] = useState("");
  const [activeVision, setActiveVision] = useState<{ title: string; image: string } | null>(null);
  const [ambience, setAmbience] = useState(false);
  const audio = useRef<AmbientAudio | null>(null);
  const affirmationIdeas = ["I create meaningful momentum with calm, focused action.", "I am ready to receive the opportunities I have prepared for.", "My self-trust grows every time I honor one clear promise.", "I move toward my vision with courage, patience, and joyful discipline."] as const;
  useEffect(() => () => { void audio.current?.stop(); }, []);
  const toggleAmbience = async () => {
    if (ambience) { await audio.current?.stop(); audio.current = null; setAmbience(false); return; }
    try { audio.current = await startAmbientAudio(); setAmbience(true); setArtNotice(""); } catch { setArtNotice("Ambient audio is unavailable in this browser."); }
  };
  const generateArt = async (goal: GoalItem) => {
    if (generating) return;
    setGenerating(goal.id); setArtNotice("");
    try {
      const response = await fetch("/api/generate-vision-art", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject: goal.title, category: goal.category }) });
      const body = await response.json().catch(() => null) as { url?: string; prompt?: string; error?: string } | null;
      if (!response.ok || !body?.url) throw new Error(body?.error ?? "Vision Art could not be created.");
      const imageUrl = body.url;
      setGoals(goals.map((item) => item.id === goal.id ? { ...item, imageUrl, ...(body.prompt ? { imagePrompt: body.prompt } : {}) } : item));
      setArtNotice("Your new Vision Art is ready.");
    } catch (caught) { setArtNotice(caught instanceof Error ? caught.message : "Vision Art could not be created. Your curated image remains in place."); }
    finally { setGenerating(null); }
  };
  const addVision = async (withArt: boolean) => {
    if (newGoal.trim().length < 3) return;
    const goal: GoalItem = { id: crypto.randomUUID(), title: newGoal.trim(), category: newCategory, date: "12 weeks", status: "In momentum" };
    setGoals([goal, ...goals]); setNewGoal(""); setAddOpen(false);
    if (withArt) {
      setGenerating(goal.id); setArtNotice("Creating your Vision Art…");
      try {
        const response = await fetch("/api/generate-vision-art", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject: goal.title, category: goal.category }) });
        const body = await response.json().catch(() => null) as { url?: string; prompt?: string; error?: string } | null;
        if (!response.ok || !body?.url) throw new Error(body?.error ?? "Vision Art could not be created.");
        const imageUrl = body.url;
        setGoals([{ ...goal, imageUrl, ...(body.prompt ? { imagePrompt: body.prompt } : {}) }, ...goals]); setArtNotice("Your new vision and artwork are ready.");
      } catch (caught) { setArtNotice(caught instanceof Error ? caught.message : "Your vision was saved with curated artwork."); }
      finally { setGenerating(null); }
    }
  };
  return <section className="view-enter"><div className="vision-hero board-hero"><div><span className="eyebrow"><LayoutDashboard className="size-3.5" /> VISION BOARD</span><h1>Your life,<br/><span>in motion.</span></h1></div><p>Keep your intentions visible. Return to the images and words that make purposeful progress feel real.</p></div>
    <div className="board-heading board-heading-standalone"><div><span className="eyebrow">YOUR COLLECTION</span><h2>Visions & affirmations</h2></div><div className="board-controls"><Button variant="glass" size="sm" aria-pressed={ambience} onClick={toggleAmbience}><Headphones className={ambience ? "size-3.5 audio-pulse" : "size-3.5"} />{ambience ? "Ambience on" : "Ambience"}</Button><div className="board-tabs" role="tablist" aria-label="Vision board sections"><Button variant={boardTab === "visions" ? "primary" : "glass"} size="sm" role="tab" aria-selected={boardTab === "visions"} onClick={() => setBoardTab("visions")}>Active Visions</Button><Button variant={boardTab === "affirmations" ? "primary" : "glass"} size="sm" role="tab" aria-selected={boardTab === "affirmations"} onClick={() => setBoardTab("affirmations")}><Sparkles className="size-3.5" />Affirmation Wall</Button></div></div></div>
    {artNotice && <p className="art-notice" role="status">{artNotice}</p>}
    {boardTab === "visions" ? <div className="vision-board">{goals.map((goal, index) => { const image = goal.imageUrl ?? images[index % images.length] ?? runnerImage; return <VisionCard key={goal.id} goal={goal} image={image} large={index === 0} generating={generating === goal.id} onGenerate={() => generateArt(goal)} onVisualize={() => setActiveVision({ title: goal.title, image })} onStatus={() => setGoals(goals.map((g) => g.id === goal.id ? { ...g, status: g.status === "Achieved" ? "In momentum" : g.status === "In momentum" ? "Refining" : "Achieved" } : g))} />; })}<button className="add-tile" onClick={() => setAddOpen(true)}><Plus className="size-5" /><b>Add Vision Tile</b><span>Give the future a place to land.</span></button></div> : <AffirmationWall affirmations={affirmations} draft={affirmationDraft} setDraft={setAffirmationDraft} onAdd={(text) => { setAffirmations([{ id: crypto.randomUUID(), text, title: "A personal intention", imageQuery: "calm ocean", createdAt: new Date().toISOString(), palette: affirmations.length % 4, favorite: false }, ...affirmations]); setAffirmationDraft(""); }} onToggleFavorite={(id) => setAffirmations(affirmations.map((item) => item.id === id ? { ...item, favorite: !item.favorite } : item))} onRandomize={() => setAffirmationDraft(affirmationIdeas[Math.floor(Math.random() * affirmationIdeas.length)] ?? "I create meaningful momentum with calm, focused action.")} />}
    <AddVisionDialog open={addOpen} onOpenChange={setAddOpen} title={newGoal} setTitle={setNewGoal} category={newCategory} setCategory={setNewCategory} onAdd={() => addVision(false)} onGenerate={() => addVision(true)} />
    {activeVision && <FocusVisualization vision={activeVision} onClose={() => setActiveVision(null)} />}
  </section>;
}

function imageForQuery(query: string | undefined, index: number) { const value = query?.toLowerCase() ?? ""; if (/desk|studio|plant|work/.test(value)) return studioImage; if (/mountain|mist|trail|forest/.test(value)) return mountainImage; if (/ocean|water|calm|run/.test(value)) return runnerImage; return images[index % images.length] ?? mountainImage; }

function AffirmationWall({ affirmations, draft, setDraft, onAdd, onRandomize, onToggleFavorite }: { affirmations: AffirmationTile[]; draft: string; setDraft: (value: string) => void; onAdd: (value: string) => void; onRandomize: () => void; onToggleFavorite: (id: string) => void }) { return <section className="affirmation-wall" aria-label="Affirmation Wall"><div className="affirmation-composer"><div><span className="eyebrow amber"><Sparkles className="size-3.5" /> AFFIRMATION WALL</span><h3>Words your future self already believes.</h3></div><div className="affirmation-entry"><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="I am becoming…" maxLength={220} aria-label="Personal intention" /><Button variant="glass" onClick={onRandomize}><RefreshCw className="size-4" />Inspire me</Button><Button variant="primary" onClick={() => draft.trim() && onAdd(draft.trim())} disabled={!draft.trim()}><Plus className="size-4" />Add Intention</Button></div></div>{affirmations.length ? <div className="affirmation-grid">{affirmations.map((affirmation, index) => <article className={`affirmation-tile ${index % 5 === 0 ? "wide" : ""}`} key={affirmation.id}><img src={imageForQuery(affirmation.imageQuery, index)} alt="" loading="lazy" /><div className="affirmation-tile-shade" /><div className="affirmation-tile-content"><div className="tile-top"><span><Sparkles className="size-3.5" />Intention</span><Button variant="icon" size="icon" aria-label={affirmation.favorite ? "Stop meditating on this intention" : "Meditate on this intention"} aria-pressed={affirmation.favorite} className={affirmation.favorite ? "favorite active" : "favorite"} onClick={() => onToggleFavorite(affirmation.id)}><Heart className={affirmation.favorite ? "size-4 fill-current" : "size-4"} /></Button></div>{affirmation.title && <h4>{affirmation.title}</h4>}<blockquote>“{affirmation.text}”</blockquote>{affirmation.prompt && <p>{affirmation.prompt}</p>}<time>{new Date(affirmation.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</time></div></article>)}</div> : <div className="affirmation-empty"><Sparkles className="size-5" /><b>Your affirmation wall is ready.</b><span>Add a phrase that brings your next chapter into focus.</span></div>}</section>; }

function VisionCard({ goal, image, large, generating, onStatus, onGenerate, onVisualize }: { goal: GoalItem; image: string; large: boolean; generating: boolean; onStatus: () => void; onGenerate: () => void; onVisualize: () => void }) { return <article className={large ? "vision-card large" : "vision-card"}><img className={generating ? "vision-image generating" : "vision-image"} src={image} alt="" loading="lazy" width={1280} height={912} /><div className="vision-shade" /><div className="vision-content"><div className="vision-meta"><span>{goal.category}</span><div className="vision-tools"><Button variant="icon" size="icon" aria-label={`Visualize ${goal.title}`} title="Visualize" onClick={onVisualize}><Maximize2 className="size-3.5" /></Button><button onClick={onStatus}>{goal.status}</button></div></div><div><p>I am becoming someone who</p><h3>{goal.title}</h3><div className="vision-footer"><span className="milestone">Target · {goal.date}</span><Button variant="glass" size="sm" onClick={onGenerate} disabled={generating}>{generating ? <LoaderCircle className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}{generating ? "Creating art" : "Generate Vision Art"}</Button></div></div></div></article>; }

function AddVisionDialog({ open, onOpenChange, title, setTitle, category, setCategory, onAdd, onGenerate }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; setTitle: (value: string) => void; category: string; setCategory: (value: string) => void; onAdd: () => void; onGenerate: () => void }) { return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="dialog-overlay"/><Dialog.Content className="settings-dialog add-vision-dialog"><div className="dialog-head"><div><Dialog.Title>Add Vision Tile</Dialog.Title><Dialog.Description>Name an intention and choose whether to begin with curated or newly generated art.</Dialog.Description></div><Dialog.Close asChild><Button variant="icon" size="icon" aria-label="Close vision dialog"><X className="size-4"/></Button></Dialog.Close></div><div className="add-vision-fields"><label htmlFor="new-vision">Intention</label><input id="new-vision" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Live and work near the ocean"/><label htmlFor="new-vision-category">Category</label><select id="new-vision-category" value={category} onChange={(event) => setCategory(event.target.value)}>{["Career", "Fitness", "Mindset", "Creative"].map((item) => <option key={item}>{item}</option>)}</select></div><div className="dialog-actions"><Button variant="glass" onClick={onAdd} disabled={title.trim().length < 3}><Plus className="size-4"/>Add Tile</Button><Button onClick={onGenerate} disabled={title.trim().length < 3}><Sparkles className="size-4"/>Generate Vision Art</Button></div></Dialog.Content></Dialog.Portal></Dialog.Root>; }

function FocusVisualization({ vision, onClose }: { vision: { title: string; image: string }; onClose: () => void }) {
  const [seconds, setSeconds] = useState(60);
  useEffect(() => {
    const previousTitle = document.title;
    document.title = `✨ Focus: ${vision.title}`;
    const handleFullscreen = () => { if (!document.fullscreenElement) onClose(); };
    document.addEventListener("fullscreenchange", handleFullscreen);
    void document.documentElement.requestFullscreen().catch(() => undefined);
    const interval = window.setInterval(() => setSeconds((value) => value > 0 ? value - 1 : 0), 1000);
    return () => { window.clearInterval(interval); document.removeEventListener("fullscreenchange", handleFullscreen); document.title = previousTitle; };
  }, [onClose, vision.title]);
  const exit = async () => { if (document.fullscreenElement) await document.exitFullscreen().catch(() => undefined); onClose(); };
  return createPortal(<div className="focus-visualization" role="dialog" aria-modal="true" aria-label={`Visualizing ${vision.title}`}><img src={vision.image} alt=""/><div className="focus-vignette"/><Button variant="icon" size="icon" className="focus-exit" aria-label="Exit visualization" onClick={exit}><X className="size-5"/></Button><div className="focus-copy"><span>Hold the vision gently</span><blockquote>“{vision.title}”</blockquote></div><div className="focus-breath"><i/><b>{seconds}s</b><span>{seconds > 0 ? "Breathe with the circle" : "Carry this feeling forward"}</span></div></div>, document.body);
}

function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) { return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="settings-dialog"><div className="dialog-head"><div><Dialog.Title>Intelligence settings</Dialog.Title><Dialog.Description>Your private keys stay on the server and never enter browser storage.</Dialog.Description></div><Dialog.Close asChild><Button variant="icon" size="icon" aria-label="Close settings"><X className="size-4" /></Button></Dialog.Close></div><div className="connection-list"><div><span className="connection-icon cyan"><Waves /></span><div><b>ElevenLabs Scribe</b><p>Connected securely for voice transcription</p></div><span className="connected">Connected</span></div><div><span className="connection-icon violet"><BrainCircuit /></span><div><b>Nebius Token Factory</b><p>Add NEBIUS_API_KEY in project secrets for live reasoning</p></div><span className="demo">Demo ready</span></div></div><div className="privacy-note"><Settings className="size-4" /><p>For safety, API keys cannot be entered or overridden in this browser. Manage them through your project’s secure connection settings.</p></div></Dialog.Content></Dialog.Portal></Dialog.Root>; }
