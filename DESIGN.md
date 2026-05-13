---
version: 1.0
name: Cargo
description: A dense, courier-first design system for a self-hosted ephemeral file transfer. Dark by default on a deep ink-black canvas (not pure black) with a single Cargo orange voltage used sparingly on the hero upload progress bar, the primary CTA, the active nav state, focus rings, and the EN/FR pill border. Sans-serif body in Inter, with **mono** (Geist Mono) carrying filenames, sizes, transfer rates, ETAs, and link tokens — anything a human wants to copy or scan. There are no rainbow gradients, no decorative emojis (📦 is vendored as an SVG, never rendered as a text glyph), no marketing padding; every screen is built around a real-time upload progress card, dense in/outbox tables, written empty states, and typed-handle destructive confirmations. The shape language is small-radius (4–8px); the system caps at two surface tiers (`surface` + `elevated`) and one shadow tier on modals/popovers. The system holds a single accent, soft display weights, no decorative chrome, no progressive elevation; the loud moment is the single hero progress bar with shimmer that owns the Send page during a transfer.

stack:
  framework: Next.js 15 (App Router, React 19) + TypeScript strict
  styling: Tailwind CSS (CSS variables for theme tokens, `rgb(var(--token) / <alpha-value>)`)
  primitives: Radix UI under shadcn/ui — local components in `src/components/ui`
  icons: lucide-react
  i18n: next-intl, EN/FR, locale persisted per user (`users.locale`) and on `<html lang>`
  fonts: Inter (body) + Geist Mono (machine-readable spans)

colors:
  # Dark (default — `html.dark`)
  bg:        "#0d1014"   # deep ink, not pure black
  surface:   "#12161c"   # default panels (sidebar, table chrome, dropzone)
  elevated:  "#181d24"   # progress card, link card, modals, hovered rows
  hairline:  "#262c35"   # 1px borders, table separators
  ink:       "#ebeef3"   # primary text
  muted:     "#9ca3ae"   # secondary text, sub-labels, ETA copy
  subtle:    "#6f7782"   # placeholders, helper text
  accent:    "#f97316"   # Cargo orange — the only chromatic voltage
  accent-fg: "#1a0e06"   # text on accent surfaces
  danger:    "#ef5350"
  success:   "#3db27a"

  # Light (opt-in — `html` without `.dark`)
  bg-light:        "#fcfcfc"
  surface-light:   "#ffffff"
  elevated-light:  "#ffffff"
  hairline-light:  "#e2e4e8"
  ink-light:       "#111418"
  muted-light:     "#5a6069"
  subtle-light:    "#8c9199"
  accent-light:    "#ea580c"

typography:
  font-sans: "Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
  font-mono: "'Geist Mono', 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace"
  display-md:   { size: 20px, weight: 600, line: 1.25, tracking: -0.005em }   # page H1 ("Send", "Outbox")
  title-md:     { size: 15px, weight: 600, line: 1.3,  tracking: 0 }          # modal title, sidebar header, link-card title
  body-md:      { size: 14px, weight: 400, line: 1.45, tracking: 0 }          # default body
  body-sm:      { size: 13px, weight: 400, line: 1.4,  tracking: 0 }          # table cells, helper copy, privacy line
  caption:      { size: 12px, weight: 400, line: 1.35, tracking: 0 }          # subtitles, dropzone hint, countdown sub-label
  micro:        { size: 11px, weight: 500, line: 1.2,  tracking: 0.04em, uppercase: true }   # table headers, state tags ("ENCRYPTING")
  mono-md:      { family: mono, size: 13px, weight: 400, numeric: tabular }  # filenames, sizes, MB/s, ETA
  mono-sm:      { family: mono, size: 12px, weight: 400, numeric: tabular }  # link tokens, handles
  mono-xs:      { family: mono, size: 11px, weight: 500, uppercase: true }   # state pills ("READY" / "EXPIRED")

rounded:
  none: 0px
  xs:   4px
  sm:   6px   # default for buttons, inputs, tags
  md:   8px   # cards (progress, link), modals
  lg:   12px

spacing:
  xxs: 2px
  xs:  4px
  sm:  6px
  base: 8px
  md:  12px
  lg:  16px
  xl:  24px
  xxl: 32px

elevation:
  flat:   "none"
  ring:   "0 0 0 1px rgb(var(--hairline) / 1)"           # default panel ring
  pop:    "0 1px 2px rgb(0 0 0 / 0.4), 0 4px 16px rgb(0 0 0 / 0.4)"   # modals, dropdowns
  scrim:  "rgb(0 0 0 / 0.6) + backdrop-blur(2px)"        # modal backdrop

motion:
  duration-fast: 120ms
  duration-default: 150ms
  duration-modal: 180ms
  shimmer-cycle: 1400ms                                   # hero progress leading-edge shimmer
  easing: "cubic-bezier(0.2, 0.8, 0.2, 1)"
  policy: "Never animate position on idle hover — only color/opacity/border. Animate transforms only on intent (modal open/close, drawer slide). The progress bar's leading-edge shimmer is the single ambient motion in the entire system."

components:
  button-primary:
    background: accent
    text: accent-fg
    radius: sm
    padding: "0 16px"
    height: 36px
    font: body-sm + weight 500
    states: { hover: brightness(1.1), active: brightness(0.95), disabled: opacity 50% }

  button-secondary:
    background: elevated
    text: ink
    border: hairline
    radius: sm
    height: 36px

  button-ghost:
    background: transparent
    text: ink
    hover: elevated

  button-danger:
    background: danger
    text: white
    radius: sm
    height: 36px
    use: "Confirm-handle destructive modals only (delete account, revoke transfer) — never the entry point of a destructive flow."

  input:
    background: surface
    border: hairline
    radius: sm
    height: 36px
    padding: "0 12px"
    font: body-sm
    focus: { border: accent, outline: "2px accent / 2px offset" }

  recipient-picker:
    pattern: "Debounced (180ms) query against /api/recipients?q=. Each result row: 24px Discord avatar (rounded sm, fallback to handle initial on hairline bg) + global_name (body-sm ink) + handle (mono-sm muted). Keyboard nav: ↑/↓ to move, Enter to pick, Esc to clear. Selected state renders inline like a token (rounded sm, surface bg, X to clear)."
    empty-match: "Caption + muted: 'This user hasn't signed in to Cargo yet — ask them to sign in once.' No upsell, no invite link."

  sidebar:
    width: 240px
    background: surface
    border-right: hairline
    sections:
      - brand: { title: "Cargo" (font: title-md) + 📦 svg 14px, tagline: caption + muted ("ephemeral courier") }
      - nav: { items: Send | Outbox | Inbox | Settings, height-per-row: 36px, active: { background: elevated, text: ink }, inactive: { text: muted } }
      - footer: { user-avatar 20px + global_name + logout icon + EN/FR locale pills }
    note: "There is no 'Activity' item — the absence is the feature."

  page-header:
    padding: "24px 32px"
    border-bottom: hairline
    title: display-md
    subtitle: body-sm + muted
    layout: "title + subtitle on left, action button on right, baseline-aligned"

  table:
    container: { border: hairline, radius: md, overflow: hidden }
    header:
      background: surface
      font: micro
      color: muted
      padding: "10px 16px"
    row:
      border-top: hairline
      hover: elevated
      padding: "12px 16px"
      font: body-sm
    machine-cells: "Always render filenames, sizes, recipient handles, link tokens in mono-md or mono-sm. Sizes right-aligned. State tags in mono-xs uppercase, no colored pill — just the text in muted ('READY', 'EXPIRED', 'ENCRYPTING')."
    date-cells: "relativeTime (en/fr-aware via Intl.RelativeTimeFormat) + isoTooltip on hover ('YYYY-MM-DD HH:MM:SS UTC')."

  empty-state:
    container: "border dashed hairline, radius md, padded 64px vertical / 32px horizontal, centered text"
    title: body-sm + weight 500 + ink
    body:  body-sm + muted
    voice: "Specific. 'No active transfers. Cargo doesn't keep a history — once something ends, it's gone from here too.' — never 'Welcome!' or marketing fluff."

  modal:
    background: elevated
    border: hairline
    radius: md
    shadow: pop
    width-by-size: { sm: 384px, md: 448px, lg: 672px }
    padding: 20px
    backdrop: scrim
    close: top-right X icon, muted → ink on hover
    footer-actions: right-aligned, primary on the right of secondary

  delete-confirm:
    pattern: "Modal with warning copy + Label('Type your handle to confirm:') + mono Input + danger button disabled until input === user.username."
    targets: { account: user.username }

  hero-progress-card:
    role: "The visual centerpiece of the Send page during an active transfer. It is the one loud moment in the entire system."
    container: "elevated bg, hairline border, radius md, padded 24px, full-width within content pane"
    layout:
      - row1: "filename (mono-md, truncated middle-ellipsis, click-to-copy) + state pill (micro)"
      - row2: "thick progress bar (10px tall, radius full, hairline track, accent fill, leading-edge shimmer)"
      - row3: "loaded / total · MB/s · ETA · % (mono-md tabular, muted separators)"
      - row4: "pause | resume | cancel ghost buttons (only the relevant one enabled per state)"
    states:
      queued:     "muted bar, no shimmer, state pill 'QUEUED'"
      encrypting: "accent bar, shimmer on, state pill 'ENCRYPTING & UPLOADING'"
      finalizing: "accent bar at 100%, soft pulse, state pill 'FINALIZING'"
      ready:      "1.2s success flash (success border tint), then card morphs into link-card below"
      failed:     "danger bar tint at last-known position, state pill 'FAILED — RETRY'"
    shimmer: "A 24px-wide gradient at the leading edge, accent → accent/0, cycling 1400ms — only ambient motion in the system."

  link-card:
    role: "Appears in place of the hero progress card when the upload completes. Persists on the page until the user navigates away."
    container: "elevated bg, hairline border, radius md, padded 24px, full-width"
    layout:
      - title: "title-md ink — 'Transfer ready'"
      - recipient: "body-sm muted — 'Sent to @{recipient.username} ({recipient.global_name})'"
      - url-row:    "mono-md ink in a hairline-bordered surface input + 'Copy' button (becomes 'Copied' for 1.2s on click)"
      - countdown:  "mono-md accent — 'Expires in {HH:MM:SS}' ticking once per second"
      - privacy-line: "caption muted — 'After expiry the file is hard-deleted. Cargo does not keep a history.'"

  upload-dropzone:
    container: "2px dashed hairline, radius md, padded 64px vertical, centered caption"
    voice:     "body-sm ink: 'Drop a file or click to choose.' caption muted below: 'Up to 200 GB. Resumable.'"
    drop:      "Stays passive — no glow, no bounce. Only the file picker click handler + the drop handler. Once a file lands, the dropzone collapses into the hero progress card above it."
    resume-rehydration: "If a tus upload is in progress when the user reloads, the dropzone is replaced on mount with a small surface card: 'Resume {filename}?' + Resume button + Discard button."

  state-pill:
    pattern: "mono-xs uppercase, muted color, no background pill. ('QUEUED' / 'ENCRYPTING' / 'READY' / 'EXPIRED')."

  countdown:
    pattern: "Mono-md, tabular numerics, formatted HH:MM:SS via a single setInterval(1s) per mounted card. Hits 00:00:00 → swaps to 'Expired' in muted; the row removes itself from inbox/outbox on next data refresh."

  copy-cell:
    pattern: "Mono, truncated to a sensible width with title=full-string, click-to-copy. On copy success, the cell text becomes 'Copied' for 1.2s. Used for filenames and the share URL."

  locale-toggle:
    pattern: "Two 24px-tall mono uppercase pills, 'EN' and 'FR'. Active = accent border + accent text. Hits PATCH /api/auth/locale to persist (also writes localStorage so the public /login page can render in the right locale before auth)."

  privacy-line:
    pattern: "A single body-sm muted line that surfaces the Cargo stance in plain copy, with a link to /docs/PRIVACY.md. Appears on the Send page beneath the recipient picker AND in Settings. Voice example: 'Cargo doesn't log who sent what to whom, who downloaded, or any per-transfer activity beyond what's strictly required.' Never legalese."

i18n:
  supported: [en, fr]
  source: "src/i18n/messages/{en,fr}.json — loaded by next-intl, server-side selected from User.locale > Accept-Language > 'en'."
  formatting: "Intl.NumberFormat / Intl.RelativeTimeFormat run with the active locale — a 1.4 GB transfer shows as `1,4 Go` in French and `1.4 GB` in English without per-locale code. ETAs and rates likewise."
---

## Overview

Cargo is a courier — you sign in, you drop a file for a specific person, you
hand them a 1-hour link, and after either the download or the expiry, the
file is gone from disk. The product optimizes for that single act: the Send
page is dominated by the upload progress bar, and the in/outbox tables are
short by design because nothing lives long.

**Discipline.** Single accent, two surface tiers, mono carries hierarchy,
no decorative chrome. The loud moment is the only thing on the Send page
during a transfer: a thick progress bar with a leading-edge shimmer in the
accent color. There is no surrounding table to compete with it. The accent
is Cargo orange (`#f97316`) — saturated enough to read as "in motion"
against the deep-ink canvas, restrained enough not to feel alarmist.

The rest — the deep-ink canvas, the 4–8px radii, the 13–14px body, the
mono-numerics-as-hierarchy discipline, the absence of pastel cards and
status pill backgrounds, the typed-name destructive confirmations — falls
out of the same rule set.

### Key characteristics

- **Single accent:** `accent` (`#f97316` dark, `#ea580c` light). Used on
  the hero progress fill (with shimmer), the primary CTA, the active
  sidebar item background tint, focus rings, and the active EN/FR pill
  border. One accent moment per screen — usually the hero progress card
  on Send, the action button on Outbox/Inbox, the active row on Settings.
- **Two surface tiers:** `surface` (sidebar, table headers, inputs,
  dropzone) and `elevated` (the hero progress card, the link card,
  modals, hover rows). No progressive elevation ladder.
- **One shadow tier:** modals and dropdowns. The progress card and link
  card get the `ring` (1px hairline) — they are inline content, not
  popups.
- **Mono carries hierarchy.** Filenames, sizes, MB/s, ETAs, link tokens,
  Discord handles — all `Geist Mono` with tabular numerics. The eye uses
  mono to find what to act on without reading the surrounding prose.
- **The absence of history is the feature.** There is no "Activity"
  nav item, no "Recent transfers" page. The Outbox and Inbox only ever
  show *currently active* transfers. Cargo states this plainly to the
  user via the privacy line on the Send page and in Settings.

## Colors

The palette is reduced on purpose. Five neutrals (bg, surface, elevated,
hairline, ink/muted/subtle text) and one accent. Two semantic tones
(danger, success) only appear in the typed-handle confirm flow (danger)
and the 1.2s success flash on the hero progress card after a transfer
completes (success) — never as ambient state on a row.

`bg` is `#0d1014` — about 4–5% lighter than pure black. The light theme
inverts to `#fcfcfc`, never pure white. All colors are exposed as CSS
variables (`--bg`, `--surface`, `--ink`, …) on `:root` for light and
overridden on `.dark` for dark. Tailwind reads them through
`rgb(var(--token) / <alpha-value>)` so every utility (`bg-surface`,
`text-muted`, `border-hairline`, `text-accent/40`) participates in the
theme.

The orange accent was chosen against a deep-ink canvas because at 60%+
luminance it reads cleanly on `#0d1014` without color-mixing into the
hairline gridlines around the progress bar track. The `danger` red is
desaturated and reserved for typed-handle confirm flows, so the orange
accent never gets confused with destructive state.

## Typography

The system runs **Inter** for everything text-shaped and **Geist Mono**
for everything machine-shaped. There are eight type tokens — three for
display/title, two for body, one for caption, three mono variants.

Display weights stay at 600. The single typographically loud moment in the
whole app is the hero progress card's meta row, where the mono filename +
size + rate + ETA strip is the focal point of the screen during an upload.

## Layout

Two-pane: a fixed 240px sidebar (brand + nav + user footer) and a fluid
content pane. The content pane is `PageHeader` + `PageBody`. The header
holds a one-line title, a one-line subtitle, and an optional action button
right-aligned to the title baseline. The body is whatever the page needs:

- **Send**: privacy line, recipient picker, dropzone OR hero progress card OR
  link card (mutually exclusive — only one is mounted at a time).
- **Outbox** / **Inbox**: a single dense table of currently-active
  transfers.
- **Settings**: a column of subsections (Locale, Privacy summary, Delete
  account, Export my data).

No max-content-width cap. The hero progress card and the in/outbox tables
both expand to the full pane width.

## Components

### Buttons

Four variants — `primary`, `secondary`, `ghost`, `danger`. All at 36px
height (`md`) or 32px (`sm`). 6px radius, no rounded-full pills anywhere
in the system. The danger variant is **only used inside confirm modals**
— revoke and cancel buttons in tables are icon-only `text-muted
hover:text-danger`, because the danger variant inline would create a sea
of red on a list that's already short.

### Inputs

Single 36px-tall input, 6px radius, `surface` background with a 1px
`hairline` border. Focus thickens to `accent`. Labels sit above in
`caption + muted`. The recipient-picker input is a regular input with a
debounced async dropdown below it; the selected recipient renders inline
as a token *replacing* the input value.

### Sidebar

The single navigation surface. `📦 Cargo` wordmark + tagline at the top
(📦 is the vendored SVG, never the raw glyph). Four nav items
(`Send`, `Outbox`, `Inbox`, `Settings`). User footer (avatar + global_name
+ logout icon + EN/FR pills). Active nav item is `bg-elevated` — no
left-indicator bar, no chevron, no icon color shift.

### Tables

The workhorse for Outbox and Inbox. Dense (12px row padding). Filenames
right-truncate, sizes right-align, expiry ticks down in mono-md accent.
The table is **always short** — only currently-active transfers exist —
so we don't paginate.

### Hero progress card

See `components.hero-progress-card` in the frontmatter. The full-width
elevated card is the centerpiece of the Send page during an active
transfer. Real numbers driven by tus's `onProgress` callback — never a
spinner.

The leading-edge shimmer is **the only ambient animation in the entire
system**. Everything else is either static, or transitions only on
intent (modal open, button hover color, success flash). The shimmer
exists to signal "this is moving" at a glance from across a room, since
multi-GB uploads can run for many minutes.

### Link card

Replaces the hero progress card on completion. Shows the share URL in a
mono input with a Copy button, the recipient handle, and the live
countdown to expiry. On expiry the card replaces itself with a one-line
muted statement: "This transfer expired. The file has been removed."

### Recipient picker

The other interactive moment. Debounced (180ms) query against
`/api/recipients?q=`. The dropdown lists matching users (Discord avatar
+ global_name + `@handle` in mono). Empty match: the literal copy "This
user hasn't signed in to Cargo yet — ask them to sign in once." We do
not provide an invite flow — Discord OAuth requires the recipient to
authenticate at least once to enter Cargo's user table.

### Modals

Radix Dialog underneath. Three sizes (`sm` 384px, `md` 448px, `lg`
672px). Used only for: account delete confirm, locale-picker accessible
fallback, and the cancel-transfer confirm.

### Delete-confirm

Account deletion only. Modal asks the user to type their `@handle`. The
danger button stays disabled until the input matches. Server re-checks
the match.

### Privacy line

A specific design element. A single body-sm muted line that surfaces the
Cargo stance in plain copy, with a link to `/docs/PRIVACY.md`. It
appears:

- On the Send page, immediately above the dropzone, beneath the recipient
  picker.
- In Settings, as its own subsection.
- On the Inbox empty state.

The voice is plain: "Cargo doesn't keep a history. Once a transfer ends,
it's gone from here too." Never legalese.

## Internationalization

Two-locale system, EN + FR, end to end:

- **UI strings** in `src/i18n/messages/{en,fr}.json`, loaded by
  next-intl in the App Router root layout.
- **Locale selection** order: `User.locale` (DB) > `Accept-Language`
  header > `'en'` fallback.
- **Numeric and date formatting** uses native `Intl.NumberFormat` and
  `Intl.RelativeTimeFormat`, so a 1.4 GB transfer shows as `1,4 Go` in
  French and `1.4 GB` in English without per-locale code.

## What this system explicitly avoids

- Pastel cards, rainbow gradients, decorative emoji ("📦 Cargo" only
  renders via the vendored SVG, never via the text glyph), "Welcome
  back 👋" hero copy, marketing padding.
- Colored pill backgrounds on transfer status — `READY` / `EXPIRED` /
  `ENCRYPTING` are mono-xs muted text, never a colored chip.
- A "Recent transfers" or "History" page. Cargo does not have one.
- A Bot, an Activity feed, or any per-transfer metrics shown back to the
  user. The product does not collect them.
- Progressive elevation tiers (z-1, z-2, z-3…). Modals/popovers and
  everything else, nothing in between.
- Spinners on operations whose duration is known. Tus reports progress;
  the bar reports progress.
- Hover animations that move position (`scale`, `translate`, lift) — the
  table needs to stay still.

## Landing page (`/`)

The public landing is the only page that diverges from the app's tight 20px
display scale. It is allowed **one** typographic move to signal "front door,
not the app": a larger display headline at **44–52px / Inter 600 / tracking
-0.02em**, rendered as three stacked lines with the third line in `muted`. No
new tokens — same family, same weight, same accent. The rest of the page
honors the system verbatim (body at 15–16px, mono micro eyebrows, single
accent on the CTA, hairline-bordered sections, no decorative chrome).

The hero demo reuses the real `HeroProgressCard` and `LinkCard` driven by a
scripted state machine (`src/components/landing/LandingDemo.tsx`). There is
no fork. `prefers-reduced-motion: reduce` short-circuits the loop to a static
end-state with the link card visible and a non-ticking countdown.

The landing's CTA flips on session state: `Sign in with Discord` (server
action) when anonymous, `Open Cargo →` (link to `/dashboard`) when authed.

## Responsive behavior

Cargo is desktop-first. The sidebar stays a fixed 240px down to ~960px.
Below that the sidebar should collapse to icon-only or to a top sheet
(not yet implemented — listed under Known Gaps). The hero progress card
shrinks its padding from 24px to 16px on narrow viewports but keeps its
full-width behavior. Tables scroll horizontally on narrow viewports
rather than wrapping.

## Known gaps

- Mobile sidebar collapse / icon-only mode is not yet implemented.
- Light theme is supported by the token system but not yet exposed via a
  user toggle.
- The recipient-picker keyboard navigation works but does not yet wrap
  ↑ from the top result back to the bottom (and vice versa).
- The hero progress card shimmer is `prefers-reduced-motion`-aware (no
  shimmer when the user opts out); the underlying progress bar still
  updates.
