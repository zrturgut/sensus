# Luminous Vision Art and focus mode

## What will change
- Restore a rich midnight backdrop with three slow violet, rose, and emerald ambient glows behind the existing Neutral Elegance interface.
- Deepen primary panels with translucent frosted glass, quieter dark shadows, subtle colored hover illumination, and gently glowing active controls.
- Strengthen the microphone’s radial breathing aura without moving the clickable control.
- Add **Generate Vision Art** to every vision tile and to a focused **Add Vision Tile** dialog.
- Turn goal or affirmation text into a cinematic visual prompt, request Nebius FLUX artwork server-side, and fall back instantly to the existing bundled high-resolution images when generation is unavailable.
- Cross-fade completed artwork into each card and persist generated image references with the rest of the board.
- Add a fullscreen visualization action to each vision tile with artwork, vignette, centered intention, breathing circle, exit control, and a 60-second countdown.
- Add a Vision Board ambience control using browser-generated gentle pink noise; no external audio file is required.
- Keep the browser tab title synchronized to the active fullscreen intention and restore the normal title when focus mode closes.

## Technical details
- Keep the existing Nebius reasoning model unchanged; image generation uses Nebius’s documented FLUX image endpoint and server-side secret only.
- Extend saved goal and affirmation records with optional generated artwork references while remaining compatible with existing localStorage data.
- Handle Fullscreen API exit events, Web Audio cleanup, unsupported-browser states, and localStorage quota errors gracefully.
- Verify generation fallback, tile persistence, fullscreen entry/exit, timer behavior, ambience toggle, and desktop/mobile layouts.
