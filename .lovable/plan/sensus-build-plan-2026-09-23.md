# Sensus build plan

## Experience
- Replace the blank screen with a polished two-mode Sensus workspace using the specified obsidian, neon, and glass visual language.
- Build the Clarity Engine with browser recording, live timer/waveform, scenario presets, editable transcript, analysis states, copyable reframes, blind-spot follow-ups, actionable checklist/calendar exports, and wellness pulse.
- Build the Vision engine with goal creation, category selection, realistic WOOP-style analysis, calendar bridging, persistent vision tiles, progress states, and a responsive bento board.
- Add a compact settings dialog that explains secure server-side connection status without exposing private keys in the browser.

## Intelligence and speech
- Connect ElevenLabs securely through the workspace connector and transcribe recorded audio server-side.
- Connect Nebius through a private server-side secret and request structured analysis with the specified Llama model.
- Provide immediate, high-quality local demo results whenever credentials are unavailable or a service is offline, while clearly marking demo mode.
- Preserve provider error details and avoid unsafe retries.

## Persistence and polish
- Persist reflections, goals, completed actions, and vision tiles in browser storage.
- Add downloadable calendar files and pre-filled Google Calendar links.
- Add focused motion, responsive layouts, accessible controls, and route-specific social metadata.
- Verify the primary flows on desktop and mobile, including refresh persistence.

## Technical notes
- Keep all third-party credentials server-side; browser-entered private API keys will not be stored in local storage.
- Use TanStack server functions for app-internal Nebius analysis and a server route for audio uploads.
- Use semantic Tailwind theme tokens and existing Lucide icons.
