# Reflection History and AI Follow-Up Prompts

## What will be added
- Add a fourth **History** mode beside Clarity Engine, Vision, and Vision Board.
- Show saved reflections in a calm chronological timeline, searchable across transcript, analysis, guidance, and action items.
- Add date filtering and expandable entries so each day’s original reflection, insight, wellness context, and actions remain easy to review.
- Save insufficient-context guidance entries as history too, without presenting them as completed analyses.
- Add a **Continue the reflection** composer where someone can enter a completed reflection and generate personalized follow-up journaling prompts.
- Save generated prompt sets with their source reflection so they remain available after refresh.

## Experience details
- Preserve the current Neutral Elegance sanctuary styling and responsive navigation.
- Search and date filtering happen instantly in the browser.
- Follow-up prompts appear as a focused set of grounded questions, with clear loading, empty, and error states.
- Existing reflection data remains compatible; no saved entries are discarded.

## Technical details
- Extend the local reflection record with optional guidance and follow-up prompt fields while supporting existing records.
- Add an app-internal TanStack server function for prompt generation.
- Use Lovable AI Gateway server-side with `openai/gpt-6-astra`, streamed Responses API output, strict structured JSON, and no artificial timeout.
- Keep `LOVABLE_API_KEY` server-only and surface safe Gateway errors in the History view.
- Verify history search, date filters, prompt generation, persistence, and desktop/mobile layouts.
