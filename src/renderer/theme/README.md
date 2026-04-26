# Renderer Theme Color System

Theme colors are centralized in layered CSS variable files. Edit the earliest layer that matches the kind of change you need.

## Layers

1. `theme-seeds.css`
   - Edit this file for brand, accent, background, surface, text, border source, and state seed colors.
   - Light and dark palettes live here under `:root[data-theme="light"]` and `:root[data-theme="dark"]`.
   - Raw `rgb(...)` values belong here.

2. `tokens.css`
   - Derives global semantic tokens such as `--bg`, `--surface-1`, `--text`, `--border`, `--accent`, `--success`, `--warning`, and `--danger`.
   - Keep this layer generic. It should describe shared meaning, not a specific component.

3. `component-tokens.css`
   - Derives UI-specific tokens such as `--topbar-bg`, `--sidebar-bg`, `--center-bg`, `--composer-bg`, `--chat-pane-bg`, `--button-bg`, and `--card-bg`.
   - Put component color decisions here instead of in Vue files or layout CSS.

4. `app-themes.css`
   - Thin mount layer for applying token values to global regions.
   - Avoid adding new color definitions here unless they are theme mounting rules.

## Tailwind

Use semantic Tailwind aliases from `tailwind.config.cjs` when utility classes need theme colors:

- `ui-bg`
- `ui-surface`
- `ui-surface-2`
- `ui-muted`
- `ui-border`
- `ui-accent`
- `ui-success`
- `ui-warning`
- `ui-danger`

## Raw Color Rule

Avoid raw `#hex`, `rgb(...)`, and `rgba(...)` values outside seed files. Use CSS variables, `color-mix(...)`, or `rgb(from var(...) ...)` instead.

Documented exceptions should be algorithmic, third-party-like, or test-only code. The current automated guard is `src/renderer/theme/color-system.test.ts`.
