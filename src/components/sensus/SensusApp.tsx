import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import * as Dialog from "@radix-ui/react-dialog";
import {
  ArrowRight, BrainCircuit, CalendarCheck, Check, ChevronDown, Copy, Eye, Gauge, Goal,
  LoaderCircle, Mic, Plus, Settings, Sparkles, Square, Target, Waves, X,
} from "lucide-react";
import runnerImage from "@/assets/vision-runner.jpg";
import studioImage from "@/assets/vision-studio.jpg";
import mountainImage from "@/assets/vision-mountain.jpg";
import { analyzeSensusInput, type ClarityResult, type GoalResult } from "@/services/nebius";
import { Button } from "./Button";
import { CalendarActions } from "./CalendarActions";
import { recordWav } from "./record-wav";

const presets = [
  { icon: "⚡", label: "Work overload & imposter loop", text: "I have three major deliverables due this week and I keep thinking everyone will realize I am not capable. I am over-preparing every detail, avoiding asking for help, and staying online late, but I still feel behind." },
  { icon: "🌅", label: "Morning burnout & routine friction", text: "I wake up already tired and then feel guilty that my morning routine falls apart. I try to fit exercise, planning, and deep work in before the day starts, but the pressure makes me avoid all of it." },
];

type Mode = "clarity" | "vision";
type GoalItem = { id: string; title: string; category: string; date: string; status: "In momentum" | "Refining" | "Achieved"; analysis?: GoalResult };
type Reflection = { id: string; text: string; result: ClarityResult; createdAt: string };
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

export function SensusApp() {
  const [mode, setMode] = useState<Mode>("clarity");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [goals, setGoals] = useStoredState<GoalItem[]>("sensus-goals", initialGoals);
  const [reflections, setReflections] = useStoredState<Reflection[]>("sensus-reflections", []);
  return <div className="min-h-screen bg-background text-foreground"><div className="ambient-grid" aria-hidden="true" />
    <header className="app-header"><div className="header-inner">
      <div className="brand"><LogoMark /><div><div className="brand-name">SENSUS</div><p>Voice-first clarity, grounded execution & vision</p></div></div>
      <div className="header-actions"><div className="status-cluster"><span className="status-badge"><i className="status-dot cyan" />Speech <b>ElevenLabs Scribe</b></span><span className="status-badge"><i className="status-dot mint" />Reasoning <b>Nebius Token Factory</b></span></div><Button variant="icon" size="icon" aria-label="Open settings" onClick={() => setSettingsOpen(true)}><Settings className="size-4" /></Button></div>
    </div></header>
    <main className="main-shell">
      <nav className="mode-dock" aria-label="Sensus modes"><button className={mode === "clarity" ? "mode-option active" : "mode-option"} onClick={() => setMode("clarity")}><Mic className="size-4" /><span>Clarity Engine</span></button><button className={mode === "vision" ? "mode-option active" : "mode-option"} onClick={() => setMode("vision")}><Target className="size-4" /><span>Vision & Grounded Manifestation</span></button></nav>
      {mode === "clarity" ? <ClarityView reflections={reflections} setReflections={setReflections} /> : <VisionView goals={goals} setGoals={setGoals} />}
    </main>
    <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
  </div>;
}

function ClarityView({ reflections, setReflections }: { reflections: Reflection[]; setReflections: (v: Reflection[]) => void }) {
  const analyze = useServerFn(analyzeSensusInput);
  const recorder = useRef<Awaited<ReturnType<typeof recordWav>> | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recording, setRecording] = useState(false); const [seconds, setSeconds] = useState(0); const [text, setText] = useState("");
  const [result, setResult] = useState<ClarityResult | null>(reflections[0]?.result ?? null); const [loading, setLoading] = useState(false); const [error, setError] = useState(""); const [completed, setCompleted] = useStoredState<string[]>("sensus-actions", []); const [drawer, setDrawer] = useState(false); const [question, setQuestion] = useState("");
  const toggleRecording = async () => {
    setError("");
    if (!recording) { try { recorder.current = await recordWav(); setRecording(true); setSeconds(0); timer.current = setInterval(() => setSeconds((n) => n + 1), 1000); } catch { setError("Microphone access is needed to record a reflection."); } return; }
    setRecording(false); if (timer.current) clearInterval(timer.current); timer.current = null;
    try { const file = await recorder.current?.stop(); recorder.current = null; if (!file) return; setLoading(true); const form = new FormData(); form.append("audio", file); const response = await fetch("/api/transcribe", { method: "POST", body: form }); const body = await response.json() as { text?: string; error?: string }; if (!response.ok) throw new Error(body.error ?? "Transcription failed."); setText(body.text ?? ""); } catch (caught) { setError(caught instanceof Error ? caught.message : "Transcription failed."); } finally { setLoading(false); }
  };
  const runAnalysis = async () => { if (text.trim().length < 20) { setError("Add a little more context before analysis."); return; } setLoading(true); setError(""); try { const next = await analyze({ data: { kind: "clarity", text } }); if ("reframe" in next) { setResult(next); setReflections([{ id: crypto.randomUUID(), text, result: next, createdAt: new Date().toISOString() }, ...reflections].slice(0, 20)); } } catch { setError("Analysis is unavailable right now. Your reflection is still here."); } finally { setLoading(false); } };
  const toggleAction = (action: string) => setCompleted(completed.includes(action) ? completed.filter((item) => item !== action) : [...completed, action]);
  return <section className="view-enter"><div className="section-heading"><div><span className="eyebrow"><Sparkles className="size-3.5" /> DAILY REFLECTION</span><h1>Turn mental noise into<br/><span>clear next moves.</span></h1></div><p>Speak freely. Sensus finds the pattern beneath the pressure, then turns it into grounded action.</p></div>
    <div className="voice-panel">
      <div className="voice-stage"><div className={recording ? "record-aura active" : "record-aura"}><button className="record-button" aria-label={recording ? "Stop recording" : "Start recording"} onClick={toggleRecording}>{recording ? <Square className="size-7 fill-current" /> : <Mic className="size-8" />}</button></div><div className="record-copy"><b>{recording ? "Listening deeply" : loading ? "Processing reflection" : "Tap to speak"}</b><span>{recording ? formatTime(seconds) : "Your voice stays private and focused"}</span></div><Waveform active={recording} /></div>
      <div className="transcript-side"><div className="panel-label"><span>Reflection transcript</span><span>{text.length} chars</span></div><textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="What feels tangled right now? Speak or write without editing yourself..." /><div className="preset-row">{presets.map((preset) => <button key={preset.label} onClick={() => setText(preset.text)}><span>{preset.icon}</span>{preset.label}</button>)}</div><div className="analyze-row">{error && <p className="error-text">{error}</p>}<Button size="lg" onClick={runAnalysis} disabled={loading}>{loading ? <LoaderCircle className="size-4 animate-spin" /> : <BrainCircuit className="size-4" />}{loading ? "Finding the signal" : "Reveal the signal"}<ArrowRight className="size-4" /></Button></div></div>
    </div>
    {result ? <div className="results-wrap"><div className="results-header"><div><span className="eyebrow">YOUR CLARITY MAP</span><h2>The signal beneath the noise</h2></div><SourcePill source={result.source} /></div><div className="insight-grid">
      <article className="insight-card reframe-card"><div className="card-top"><span className="icon-box violet"><BrainCircuit /></span><span className="mini-label">GROUNDED PERSPECTIVE</span></div><span className="distortion">Pattern · {result.detected_distortion}</span><blockquote>“{result.reframe}”</blockquote><Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(result.reframe)}><Copy className="size-3.5" />Copy insight</Button></article>
      <article className="insight-card"><div className="card-top"><span className="icon-box cyan"><Eye /></span><span className="mini-label">BLIND-SPOT MIRROR</span></div><h3>{result.blind_spot_insight}</h3><button className="drawer-trigger" onClick={() => setDrawer(!drawer)}>Interrogate this pattern <ChevronDown className={drawer ? "size-4 rotate-180" : "size-4"} /></button>{drawer && <div className="socratic"><button onClick={() => setQuestion("Your default protects you from short-term discomfort, but charges interest through exhaustion.")}>Why is this habit my default?</button><button onClick={() => setQuestion("An objective mentor would define done, ask for evidence, and expose the work earlier.")}>What would an objective mentor do?</button>{question && <p>{question}</p>}</div>}</article>
      <article className="insight-card actions-card"><div className="card-top"><span className="icon-box mint"><CalendarCheck /></span><span className="mini-label">ACTION EXECUTION</span></div><div className="action-list">{result.action_items.map((action) => <div className="action-item" key={action}><button aria-label={`Mark ${action} complete`} className={completed.includes(action) ? "check-box checked" : "check-box"} onClick={() => toggleAction(action)}>{completed.includes(action) && <Check className="size-3" />}</button><span className={completed.includes(action) ? "done" : ""}>{action}</span><CalendarActions title={action} compact /></div>)}</div></article>
      <article className="insight-card wellness-card"><div className="card-top"><span className="icon-box rose"><Gauge /></span><span className="mini-label">WELLNESS PULSE</span></div><div className="stress-row"><div><span>Stress load</span><strong>{result.stress_level}<small>/10</small></strong></div><div className="meter"><i style={{ width: `${result.stress_level * 10}%` }} /></div></div><div className="tag-row">{result.emotional_tags.map((tag) => <span key={tag}>{tag}</span>)}</div><div className="grounding"><Waves className="size-4" /><div><b>2-minute reset</b><p>{result.grounding_micro_habit}</p></div></div></article>
    </div></div> : <div className="empty-insights"><BrainCircuit className="size-5" /><span>Your clarity map will unfold here after your first reflection.</span></div>}
  </section>;
}

function Waveform({ active }: { active: boolean }) { return <div className={active ? "waveform active" : "waveform"} aria-hidden="true">{Array.from({ length: 42 }, (_, i) => <i key={i} style={{ height: `${8 + ((i * 13) % 28)}px`, animationDelay: `${(i % 8) * -0.09}s` }} />)}</div>; }

function VisionView({ goals, setGoals }: { goals: GoalItem[]; setGoals: (v: GoalItem[]) => void }) {
  const analyze = useServerFn(analyzeSensusInput); const [title, setTitle] = useState(""); const [category, setCategory] = useState("Career"); const [loading, setLoading] = useState(false); const [featured, setFeatured] = useState<GoalItem | null>(goals.find((g) => g.analysis) ?? null);
  const createGoal = async () => { if (title.trim().length < 3) return; setLoading(true); try { const result = await analyze({ data: { kind: "goal", title, category } }); if ("dream" in result) { const goal: GoalItem = { id: crypto.randomUUID(), title, category, date: "12 weeks", status: "Refining", analysis: result }; setGoals([goal, ...goals]); setFeatured(goal); setTitle(""); } } finally { setLoading(false); } };
  return <section className="view-enter"><div className="vision-hero"><div><span className="eyebrow amber"><Goal className="size-3.5" /> GROUNDED MANIFESTATION</span><h1>Build the bridge<br/>between <span>vision & reality.</span></h1></div><p>Dream vividly. Name the friction honestly. Install a plan that still works on ordinary days.</p></div>
    <div className="goal-builder"><div className="goal-inputs"><div className="field-grow"><label htmlFor="goal-title">What do you want to make real?</label><input id="goal-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ship my AI SaaS MVP" /></div><div><label htmlFor="category">Category</label><select id="category" value={category} onChange={(e) => setCategory(e.target.value)}>{["Career","Fitness","Mindset","Creative"].map((item) => <option key={item}>{item}</option>)}</select></div><Button variant="primary" size="lg" onClick={createGoal} disabled={loading}>{loading ? <LoaderCircle className="size-4 animate-spin" /> : <Sparkles className="size-4" />}Make it realistic</Button></div>
      {featured?.analysis && <div className="woop-grid"><div><span>01 · THE DREAM</span><p>{featured.analysis.dream}</p></div><div><span>02 · INTERNAL FRICTION</span><p>{featured.analysis.internal_friction}</p></div><div><span>03 · IF—THEN BRIDGE</span><p>{featured.analysis.if_then_plan}</p><CalendarActions title={featured.title} /></div></div>}
    </div>
    <div className="board-heading"><div><span className="eyebrow">ACTIVE VISIONS</span><h2>Your life, in motion</h2></div><Button variant="glass" onClick={() => document.getElementById("goal-title")?.focus()}><Plus className="size-4" />Add vision tile</Button></div>
    <div className="vision-board">{goals.map((goal, index) => <VisionCard key={goal.id} goal={goal} image={images[index % images.length]} large={index === 0} onStatus={() => setGoals(goals.map((g) => g.id === goal.id ? { ...g, status: g.status === "Achieved" ? "In momentum" : g.status === "In momentum" ? "Refining" : "Achieved" } : g))} />)}<button className="add-tile" onClick={() => document.getElementById("goal-title")?.focus()}><Plus className="size-5" /><b>Add a new vision</b><span>Give the future a place to land.</span></button></div>
  </section>;
}

function VisionCard({ goal, image, large, onStatus }: { goal: GoalItem; image: string; large: boolean; onStatus: () => void }) { return <article className={large ? "vision-card large" : "vision-card"}><img src={image} alt="" loading="lazy" width={1280} height={912} /><div className="vision-shade" /><div className="vision-content"><div className="vision-meta"><span>{goal.category}</span><button onClick={onStatus}>{goal.status}</button></div><div><p>I am becoming someone who</p><h3>{goal.title}</h3><span className="milestone">Target · {goal.date}</span></div></div></article>; }

function SettingsDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) { return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="settings-dialog"><div className="dialog-head"><div><Dialog.Title>Intelligence settings</Dialog.Title><Dialog.Description>Your private keys stay on the server and never enter browser storage.</Dialog.Description></div><Dialog.Close asChild><Button variant="icon" size="icon" aria-label="Close settings"><X className="size-4" /></Button></Dialog.Close></div><div className="connection-list"><div><span className="connection-icon cyan"><Waves /></span><div><b>ElevenLabs Scribe</b><p>Connected securely for voice transcription</p></div><span className="connected">Connected</span></div><div><span className="connection-icon violet"><BrainCircuit /></span><div><b>Nebius Token Factory</b><p>Add NEBIUS_API_KEY in project secrets for live reasoning</p></div><span className="demo">Demo ready</span></div></div><div className="privacy-note"><Settings className="size-4" /><p>For safety, API keys cannot be entered or overridden in this browser. Manage them through your project’s secure connection settings.</p></div></Dialog.Content></Dialog.Portal></Dialog.Root>; }
