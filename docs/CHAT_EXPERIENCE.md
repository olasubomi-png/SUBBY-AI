# SUBBY Chat Experience

SUBBY Chat is the primary workspace. Its design favors a **document-like conversation** over dashboard cards, while retaining SUBBY’s own identity, GitHub approval boundaries, Project Vault isolation, and model controls.

## Layout principles

The desktop rail is intentionally quiet and limited to conversation navigation, contextual chat creation, and the Vault safety statement. The main canvas uses a centered maximum reading width rather than viewport expansion or nested panels. Assistant responses use an unframed document flow; user responses use a compact neutral message bubble.

| Area | Design decision |
|---|---|
| Conversation | Centered reading column with generous whitespace and no assistant-card chrome |
| Messages | Neutral user bubble; assistant document flow; contained Markdown, code, images, and tables |
| Composer | One rounded surface containing add, vault, multiline input, send state, mode, and model controls |
| Loading | Stable send-control footprint with a clear preparing state; no control jump |
| Mobile | Parent-relative sizing, compact controls, safe-area padding, and no absolute-positioned composer controls |

## Audit record

The initial 1440px review found that an invalid `min()` width declaration caused the intended desktop reading column to fall back to full width and clip the left side of rendered content. The corrected `calc()` expressions restore the centered conversation canvas. Markdown blocks now explicitly occupy the assistant document column so long syntax output is contained within it.

The redesigned Chat was checked at 320px and 360px. The conversation uses the available width, code remains clipped to an internal scroll region, the Vault control intentionally yields at the narrowest size rather than compressing all controls, and the add, message, send, Agent, Plan, and model controls remain visible in one coherent composer.

At 375px and 390px, the user-facing Chat keeps its document-like assistant flow, generous mobile side margins, stable bottom composer, and contained code surface. No page-level horizontal scrolling or clipped composer controls were observed.

At 412px and 480px, the conversation retains its breathing room as the user bubble, assistant document column, wide-code region, and composer all scale naturally from the same layout model. The visual hierarchy remains focused on the conversation rather than dashboard panels.

The first tablet check exposed a legacy route-level negative margin and width rule taking precedence over the new reading column. The redesign now carries a final parent-sized geometry layer that removes that inherited expansion and keeps the header plus conversation column centered at desktop and tablet widths.

The corrected 768px and 1024px views retain a single readable conversation column alongside the existing global navigation. No dedicated conversation rail returns before the available space supports it, code remains bounded in its own scroll surface, and the composer keeps a stable bottom position.

At 1280px and 1440px, the centered canvas provides substantially more breathing room than the inherited dashboard layout. Assistant content reads as a document with no enclosing card, while the concise user bubble, inactive global navigation, and unified composer remain visually subordinate to the conversation.
