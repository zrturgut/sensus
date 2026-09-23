# Sensus: Visionary Clarity

Build a sleek, high-performance, and visually electric web application called "Sensus". 

### Aesthetic & Visual Direction (Cool, Vibrant & Futuristic)

- Theme: Deep obsidian/midnight backdrop (#0B0F19) paired with high-energy neon gradients and vibrant glassmorphism.

- Accents & Lighting:

  - Electric Violet / Indigo glow (`#8B5CF6`)

  - Cyber Cyan / Mint highlights (`#06B6D4` / `#10B981`)

  - Warm Sunset Amber & Rose for vision cards (`#F43F5E` / `#F59E0B`)

- Card & Container Styles: Frosted glass panels (`backdrop-blur-xl bg-slate-900/60 border border-white/10 shadow-2xl shadow-indigo-500/10`), rounded-3xl corners, glowing hover states, and smooth spring animations.

- Icons & UI Components: Lucide icons with subtle neon glow effects and modern shadcn/ui primitives.

---

### 1. Navigation & App Modes

- Header: Brand title "SENSUS" with an animated iridescent gradient text fill (`bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-cyan-400 to-emerald-400`) and subtitle: "Voice-First Cognitive Clarity, Grounded Execution & Vision".

- Top-Right Status Badges:

  - "Speech: ElevenLabs Scribe" (with an active cyan audio wave dot).

  - "Reasoning: Nebius Token Factory (Llama 3.3 70B & Qwen 2.5)" (with a pulsing green status light).

- Navigation Tabs (Header or floating glass dock):

  1. 🎙️ "Clarity Engine" (Daily Voice Reflection, Cognitive Reframe & Blind Spots)

  2. 🎯 "Vision & Grounded Manifestation" (Goals, Reality-Testing & Vision Board)

- Settings Modal: Simple gear icon to configure/override API keys:

  - ElevenLabs API Key (`VITE_ELEVENLABS_API_KEY`)

  - Nebius Token Factory API Key (`VITE_NEBIUS_API_KEY`)

---

### 2. View 1: Clarity Engine (Voice Input & Dynamic Dashboard)

- Interactive Voice Stage:

  - Centered glowing circular record button with breathing ambient pulse (`shadow-[0_0_50px_rgba(139,92,246,0.35)]`).

  - Active state: Pulsing audio aura, live stopwatch (00:00), and animated multi-color audio waveform visualizer.

  - Audio Pipeline: Records via browser `MediaRecorder` API $\rightarrow$ sends to ElevenLabs Speech-to-Text endpoint (`https://api.elevenlabs.io/v1/speech-to-text` with `model_id: "scribe_v1"`).

  - Stage Fallback Presets:

    1. ⚡ "Work Overload & Imposter Loop": Pre-fills a realistic stress scenario.

    2. 🌅 "Morning Burnout & Routine Friction": Pre-fills a fatigue & priority-friction scenario.

  - Editable transcription box to review or tweak text before firing analysis.

- Output Dashboard (Grid of 4 Glass Cards):

  - Card 1: Cognitive Reframe (Grounded Perspective): Shows `detected_distortion`, the reframed insight with elegant typography, and a "Copy insight" button.

  - Card 2: Blind-Spot Mirror (Socratic Habit Interrogation): Highlights `blind_spot_insight` with an eye icon, and an expandable interactive drawer to dialogue with the model ("Why is this habit my default?", "What would an objective mentor do differently?").

  - Card 3: Action Execution & Calendar Sync: Checklist of `action_items` with animated strikethrough. Each item includes an "Add to Calendar" button that triggers both a `.ics` file download and an "Add to Google Calendar" pre-filled web link.

  - Card 4: Wellness Pulse: Visual stress meter (1-10) with color shift (green $\rightarrow$ amber $\rightarrow$ electric coral), emotional tags, and a 2-minute physiological `grounding_micro_habit`.

---

### 3. View 2: Vision & Grounded Manifestation Engine

A dedicated space to turn ambitions into tangible, reality-tested milestones:

- Section A: Grounded Goal Setter & "Reality Check" Manifestor

  - An intuitive "+ New Goal" input (or voice-to-goal button) with fields:

    - Goal Title (e.g., "Run a Half-Marathon", "Ship AI SaaS MVP", "Consistent 8h Sleep").

    - Category Tag (Career, Fitness, Mindset, Creative).

  - The "Make It Realistic" Button (Mental Contrasting / WOOP Framework):

    - When clicked, calls Nebius Token Factory to stress-test the goal:

      - The Dream (Visualized Outcome): A vivid, emotionally engaging depiction of success.

      - The Internal Friction: Identifies the #1 psychological obstacle (e.g., procrastination, fear of judgment, fatigue).

      - The Implementation If-Then Plan: Generates concrete protocols (e.g., "If I feel exhausted at 6 PM, then I will put on my running shoes and walk for just 5 minutes").

    - Outputs a "Bridge to Calendar" button to immediately block the weekly habit slot.

- Section B: Dynamic Visual Vision Board

  - A responsive masonry/bento grid of aesthetic vision cards.

  - Each card represents an active goal, featuring:

    - A curated, high-vibe Unsplash background image matching the keyword (e.g., fitness $\rightarrow$ athletic morning run; tech $\rightarrow$ clean minimal desk setup; mind $\rightarrow$ mountain sunrise).

    - Bold manifestation mantra & target milestone date.

    - Progress ring or target status badge ("In Momentum", "Refining", "Achieved").

  - Users can click "+ Add Vision Tile" to add personal affirmations or custom goals with real-time card generation.

---

### 4. Backend Engine (`src/services/nebius.ts`)

- Configured to call Nebius Token Factory (`https://api.tokenfactory.nebius.com/v1/chat/completions`) using model `meta-llama/Llama-3.3-70B-Instruct`.

- Request structured JSON output (`response_format: { type: "json_object" }`).

- Robust fallback: If API keys are missing or offline, immediately return clean mock data so both the Voice Dashboard and Vision Board work seamlessly during live judge demos.

---

### 5. Persistence

- Persist reflections, vision board tiles, and active goals in `localStorage` so data survives page refreshes.

Keep the bundle lightweight, ensure zero TypeScript errors, and create a visually stunning experience that looks like a finished venture-backed consumer product!

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://sensusmind.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/5fd354bb-1b68-464a-ac68-57357e148a59).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
