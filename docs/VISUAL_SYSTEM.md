# SUBBY Professional Visual System

SUBBY uses a **calm AI engineering workspace** direction: deep graphite backgrounds, neutral elevated surfaces, high-legibility typography, indigo primary actions, and restrained violet support. The interface is intentionally not a neon, gaming, crypto, or cyberpunk aesthetic.

## Semantic tokens

| Role | Token | Value |
|---|---|---|
| Application background | `--subby-background` | `#0B0D12` |
| Standard surface | `--subby-surface` | `#12161F` |
| Elevated surface | `--subby-surface-elevated` | `#181D27` |
| Hover surface | `--subby-surface-hover` | `#202633` |
| Primary text | `--subby-text-primary` | `#F3F4F6` |
| Secondary text | `--subby-text-secondary` | `#9CA3AF` |
| Primary action | `--subby-primary` | `#6366F1` |
| Accent support | `--subby-violet` | `#8B5CF6` |
| Standard border | `--subby-border` | `#252B36` |

Status colors are reserved for their meanings: green indicates healthy or completed work, amber denotes review or caution, and red is destructive or failed. Indigo is the only dominant interactive accent.

## Interaction rules

Primary controls use an indigo fill. Secondary controls use an elevated neutral surface and a subtle border. Ghost controls remain transparent until hover. Focus is visible through a restrained indigo ring, and ordinary controls do not glow. Animated emphasis is restricted to meaningful active status such as a live agent or a working indicator, and it respects reduced-motion preferences.

## Implementation

The definitions and shared overrides live in `client/src/subby-theme.css`, imported after the legacy global stylesheet from `client/src/main.tsx`. New UI should use semantic utility tokens or existing SUBBY component classes rather than adding cyan, teal, arbitrary purple, or glow-driven styling.

## Verification record

The redesigned Chat and Overview were visually reviewed at 390px. The new treatment keeps mobile controls readable, uses indigo for the active mode and primary action, retains green only for healthy status, and keeps the graphite surfaces visually quiet around content. Long code remains differentiated by a neutral surface rather than a high-saturation frame. Additional Chat checks at 360px and 412px confirm the compact composer, mode switch, model selector, message surfaces, and code panels remain readable without restoring cyan or teal framing.

Desktop checks cover Chat, GitHub, Terminal, and the standalone Not Found route. A review refinement changed the user-message treatment from a large solid indigo block to an elevated neutral surface with a restrained indigo edge, reserving filled indigo for clear primary actions.

The final Chat review confirms that both desktop and 390px mobile code blocks use a graphite surface even when the syntax renderer carries a light inline theme. Assistant and user content remain visually distinct through neutral elevation and a restrained indigo edge instead of a large competing color field.

The final 360px and 412px checks retain that hierarchy: controls are visible, Agent mode has the only selected indigo fill, inactive controls remain neutral, status remains green, and the composer plus code regions continue to fit the viewport.
