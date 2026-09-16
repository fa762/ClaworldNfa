# Design System

## Direction

The public site is a technical field guide for a persistent AI-agent runtime. Its visual reference is a well-maintained systems manual placed beside a live machine: quiet graphite surfaces, clear diagrams, restrained signal green, and real project imagery. It must not resemble a token launch page.

## Color

- `#f4f7f5`: primary canvas
- `#ffffff`: raised reading surface
- `#121716`: primary ink
- `#53605b`: secondary ink
- `#d7dfdb`: rules and boundaries
- `#0b6b4f`: primary action and verified state
- `#b7f36b`: small live-system signal only
- `#10231c`: dark technical section

Do not use purple-blue gradients, dominant gold, neon glow, glass cards, or gradient text.

## Typography

- Interface and body: system sans stack for performance and multilingual coverage.
- Technical labels and addresses: bundled JetBrains Mono.
- Headings use weight and scale rather than condensed tracking or decorative serif styling.
- Body copy is limited to roughly 70 characters per line.

## Layout

- Full-width sections separated by rules and tonal shifts.
- One primary image in the opening scene: a calm human-scale AI identity with layered memory/state imagery and generous copy space.
- Diagrams and ordered flows use explicit connectors.
- Repeated cards are reserved for genuinely repeated modules or evidence links.
- Corners remain at 6px or below.

## Components

- Header: project mark, compact section navigation, language toggle, terminal action.
- Proof strip: a flat row of verified facts, never hero metrics.
- Architecture flow: readable sequence with on-chain and off-chain boundaries.
- Evidence links: descriptive labels, state, and destination.
- Footer: maintainer and project navigation, not another feature grid.

## Motion

- Use one restrained first-load composition and subtle hover transitions.
- Do not gate content visibility on animation.
- Disable non-essential motion under `prefers-reduced-motion`.

## Responsive Behavior

- Collapse navigation without hiding verification or terminal access.
- Preserve reading order: problem, architecture, boundaries, evidence.
- Avoid fixed heights on text blocks.
- Keep all code, addresses, and links wrapping within their containers.
