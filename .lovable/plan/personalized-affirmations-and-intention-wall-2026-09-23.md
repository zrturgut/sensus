# Personalized Affirmations and Intention Wall

## Build
- Extend clarity responses with an affirmation category and a peaceful vision-tile suggestion, including complete offline demo values.
- Update the Daily Affirmation Capsule to show the category, pin both the mantra and suggested target, play soothing audio, and request a fresh mantra.
- Expand the Affirmation Wall into a calm bento gallery using the app’s existing high-resolution imagery, with manual intentions and a persistent meditation/favorite toggle.
- Persist every new field and interaction in browser storage, including compatibility with existing saved affirmations.

## Experience
- Keep the selected serene sanctuary direction: warm frosted capsule, Lora reflective typography, subtle morning-light border, relaxed fades, and clear audio/loading feedback.
- Show a gentle confirmation after pinning without interrupting the reflection.

## Verification
- Check generation fallback, pinning, manual addition, favorite persistence, audio fallback, and desktop/mobile layouts.

## Technical details
- Keep one Nebius request per clarity analysis and validate the full JSON response with Zod.
- Store image-query metadata while resolving it to bundled imagery rather than exposing external tracking or unstable image links.
