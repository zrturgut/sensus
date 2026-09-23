# Neutral Elegance navigation and visual redesign

## What will change
- Expand the top mode selector into three adjacent choices: **Clarity Engine**, **Vision & Grounded Manifestation**, and **Vision Board**.
- Keep goal creation and the WOOP realism exercise under **Vision & Grounded Manifestation**.
- Move active visions and the Affirmation Wall into the dedicated **Vision Board** view, preserving all saved goals, affirmations, favorites, and actions.
- Restyle Sensus with the uploaded Neutral Elegance palette: warm peach, soft stone, muted taupe, and deep walnut, balanced against a near-black neutral base.
- Replace colorful aurora effects with restrained warm ambient light, refined borders, quieter shadows, and editorial typography while keeping the interface calm and readable.
- Make the three-part selector fit cleanly on desktop and compact screens without overlapping or clipped labels.

## Technical details
- Update the mode state and split the existing combined vision screen into focused manifestation and board views without changing localStorage keys.
- Add semantic neutral palette tokens in the global design system and apply them to navigation, surfaces, controls, status indicators, cards, and overlays.
- Preserve existing voice, Nebius, ElevenLabs, calendar, pinning, intention, and favorite behavior.
- Verify all three views and the selector at desktop and mobile sizes, including persisted Vision Board content.
