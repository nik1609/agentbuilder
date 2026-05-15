# AgentHub Design System

> This file is the single source of truth for all visual decisions in this repo.
> Before touching any UI file, read the relevant section here.
> Every color, font, spacing, and component decision must trace back to this doc.

---

## Inspiration & Direction

**References:** ChatGPT (clean, white, minimal) +  (dark technical cards, editorial type)

**Vibe:** Professional SaaS tool used by engineers. Not a toy, not a portfolio. Clean like Linear, editorial like Notion, technical confidence like Vercel.

**What we are killing:**
- Neon purple everywhere (`#7c6ff0`, `#b080f8`)
- Dark navy backgrounds as the default
- Glowing box-shadows
- AI-dump feel — random colors on everything

**What we are building:**
- White-first surfaces (like ChatGPT)
- Black as the primary action color
- Dark surfaces only for canvas, code, technical elements
- One accent blue for links and interactive states
- Breathing room — generous whitespace, nothing cramped

---

## Color System

### CSS Variables (goes in `app/globals.css`)

```css
:root {
  /* ── Backgrounds ───────────────────────────────── */
  --bg:        #FFFFFF;   /* page background */
  --surface:   #F7F7F8;   /* sidebar, secondary panels */
  --surface2:  #EFEFEF;   /* hover states, input fills */
  --surface3:  #E8E8E8;   /* pressed states */

  /* ── Borders ───────────────────────────────────── */
  --border:    #E5E5E5;   /* standard border */
  --border2:   #F0F0F0;   /* subtle dividers */

  /* ── Text ──────────────────────────────────────── */
  --text:      #0D0D0D;   /* primary — near black */
  --text2:     #6B6B6B;   /* secondary */
  --text3:     #9B9B9B;   /* tertiary, placeholders */
  --text4:     #C2C2C2;   /* disabled */

  /* ── Primary Action (black) ────────────────────── */
  --primary:        #000000;
  --primary-hover:  #1A1A1A;
  --primary-fg:     #FFFFFF;   /* text on primary buttons */

  /* ── Accent Blue (links, active nav, focus rings) ─ */
  --accent:         #2563EB;
  --accent-hover:   #1D4ED8;
  --accent-light:   #EFF6FF;   /* tinted background */
  --accent-border:  #BFDBFE;   /* light blue border */

  /* ── Dark Surfaces (canvas, code blocks) ──────── */
  --dark-bg:       #0A0A0A;
  --dark-surface:  #111111;
  --dark-surface2: #1A1A1A;
  --dark-surface3: #242424;
  --dark-border:   #2A2A2A;
  --dark-border2:  #333333;
  --dark-text:     #FFFFFF;
  --dark-text2:    #A1A1AA;
  --dark-text3:    #71717A;

  /* ── Status Colors ─────────────────────────────── */
  --success:        #16A34A;
  --success-bg:     #F0FDF4;
  --success-border: #BBF7D0;
  --error:          #DC2626;
  --error-bg:       #FEF2F2;
  --error-border:   #FECACA;
  --warning:        #D97706;
  --warning-bg:     #FFFBEB;
  --warning-border: #FDE68A;
  --info:           #2563EB;
  --info-bg:        #EFF6FF;
  --info-border:    #BFDBFE;

  /* ── Node Colors (builder canvas only) ────────── */
  --node-llm:        #7C3AED;   /* purple */
  --node-tool:       #0891B2;   /* cyan */
  --node-condition:  #16A34A;   /* green */
  --node-switch:     #D97706;   /* amber */
  --node-loop:       #EA580C;   /* orange */
  --node-fork:       #9333EA;   /* violet */
  --node-join:       #9333EA;   /* violet (same as fork) */
  --node-hitl:       #DB2777;   /* pink */
  --node-clarify:    #DC2626;   /* red */
  --node-io:         #374151;   /* dark slate */
  --node-passthrough:#6B7280;   /* gray */

  /* ── Shadows ───────────────────────────────────── */
  --shadow-xs: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md: 0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04);
  --shadow-lg: 0 10px 15px rgba(0,0,0,0.08), 0 4px 6px rgba(0,0,0,0.04);
  --shadow-xl: 0 20px 25px rgba(0,0,0,0.1), 0 8px 10px rgba(0,0,0,0.04);
}
```

### Color Usage Rules

| Token | Use it for |
|---|---|
| `--bg` | Page body backgrounds |
| `--surface` | Sidebar, nav, secondary panels |
| `--surface2` | Input backgrounds, hover backgrounds |
| `--border` | Card borders, input borders, dividers |
| `--text` | Headings, labels, body copy |
| `--text2` | Subtext, descriptions, helper text |
| `--text3` | Placeholders, timestamps, metadata |
| `--primary` | Primary buttons ONLY |
| `--accent` | Links, active nav items, focus rings, badges |
| `--dark-bg` + `--dark-*` | Canvas background, code blocks, technical cards |
| Node colors | Builder canvas node headers ONLY — never in regular UI |

**Never use node colors in the dashboard or any non-canvas page.**

---

## Typography

### Font Stack

```css
/* Heading / UI */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;

/* Monospace (code, IDs, tokens, timestamps) */
font-family: 'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
```

Import in `app/layout.tsx`:
```tsx
import { Inter } from 'next/font/google'
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
```

### Type Scale

| Token | Size | Weight | Line Height | Use |
|---|---|---|---|---|
| `text-display` | 48–60px | 800 | 1.05 | Landing hero only |
| `text-h1` | 28–32px | 700 | 1.15 | Page titles |
| `text-h2` | 22–24px | 700 | 1.2 | Section headings |
| `text-h3` | 18–20px | 600 | 1.3 | Card headings |
| `text-h4` | 16px | 600 | 1.4 | Sub-sections |
| `text-body-lg` | 16px | 400 | 1.6 | Landing page body copy |
| `text-body` | 14px | 400 | 1.6 | Standard body text |
| `text-sm` | 13px | 400–500 | 1.5 | Descriptions, helper text |
| `text-xs` | 12px | 400–500 | 1.4 | Labels, metadata |
| `text-2xs` | 11px | 500–700 | 1.3 | Eyebrow labels, badges, timestamps |

### Letter Spacing

| Use | Tracking |
|---|---|
| Display / H1 | `-0.03em` to `-0.04em` (tight) |
| H2–H3 | `-0.02em` |
| Body | `0` (normal) |
| UPPERCASE labels / eyebrows | `+0.08em` to `+0.1em` (wide) |
| Monospace | `0` |

### Typography Rules

- **All-caps labels** are 11px, weight 600, letter-spacing 0.08em, color `--text3`
- **Numbers in stats** are 28–36px, weight 700, letter-spacing -0.04em, font-variant-numeric: tabular-nums
- **Code/IDs** always use JetBrains Mono, never Inter
- **No font sizes below 11px**

---

## Spacing

Base unit: **4px**

| Scale | Value | Common use |
|---|---|---|
| 1 | 4px | Icon gaps, tiny nudges |
| 2 | 8px | Inline gaps, compact padding |
| 3 | 12px | Input padding, small component padding |
| 4 | 16px | Card padding (compact), gap between elements |
| 5 | 20px | Standard component padding |
| 6 | 24px | Card padding (standard) |
| 8 | 32px | Section gaps, modal padding |
| 10 | 40px | Large section padding |
| 12 | 48px | Page padding (top/sides) |
| 16 | 64px | Hero section padding |
| 20 | 80px | Large section spacing |

### Page Layout

```
Max content width:   1100px (dashboard pages)
Max content width:   900px (docs, landing)
Page padding:        48px top, 48px sides (desktop)
Section gap:         40–48px between major sections
```

---

## Border Radius

| Token | Value | Use |
|---|---|---|
| `--radius-sm` | 6px | Tags, small badges, tiny buttons |
| `--radius-md` | 8px | Inputs, small buttons, table rows |
| `--radius-lg` | 10px | Standard buttons, dropdowns |
| `--radius-xl` | 12px | Cards, modals, large buttons |
| `--radius-2xl` | 16px | Large cards, panels |
| `--radius-3xl` | 20px | Modals, hero cards |
| `--radius-full` | 9999px | Pills, avatar badges, status dots |

---

## Component Specs

### Buttons

**Primary (black)**
```
background: --primary (#000000)
color: --primary-fg (#FFFFFF)
border: none
border-radius: --radius-lg (10px)
padding: 10px 20px
font-size: 14px
font-weight: 600
hover: --primary-hover (#1A1A1A)
```

**Secondary (outlined)**
```
background: --bg (#FFFFFF)
color: --text (#0D0D0D)
border: 1px solid --border (#E5E5E5)
border-radius: --radius-lg (10px)
padding: 10px 20px
font-size: 14px
font-weight: 500
hover background: --surface2 (#EFEFEF)
```

**Ghost**
```
background: transparent
color: --text2 (#6B6B6B)
border: none
padding: 8px 14px
hover background: --surface2 (#EFEFEF)
hover color: --text (#0D0D0D)
```

**Danger**
```
background: --error-bg (#FEF2F2)
color: --error (#DC2626)
border: 1px solid --error-border (#FECACA)
hover background: #FEE2E2
```

**Size variants**
- SM: padding 6px 12px, font 12px, radius 8px
- MD: padding 10px 20px, font 14px, radius 10px (default)
- LG: padding 12px 28px, font 15px, radius 12px

**Rules:**
- Never more than one primary button per view
- Destructive actions always use danger variant, never primary
- Loading state: replace label with spinner, keep same size

---

### Inputs & Form Fields

```
background: --bg (#FFFFFF)
border: 1px solid --border (#E5E5E5)
border-radius: --radius-md (8px)
padding: 0 12px
height: 38px
font-size: 14px
color: --text

focus:
  border-color: --accent (#2563EB)
  outline: none
  box-shadow: 0 0 0 3px --accent-light (#EFF6FF)

placeholder: --text3 (#9B9B9B)
disabled: background --surface2, color --text4
error: border-color --error, focus ring --error-bg
```

**Textarea:** same styles, min-height 80px, resize: vertical

**Select:** same styles + custom chevron SVG

---

### Cards

**Standard card**
```
background: --bg (#FFFFFF)
border: 1px solid --border (#E5E5E5)
border-radius: --radius-2xl (16px)
padding: 24px
box-shadow: --shadow-sm
```

**Dark card (for technical content)**
```
background: --dark-surface (#111111)
border: 1px solid --dark-border (#2A2A2A)
border-radius: --radius-2xl (16px)
padding: 24px
color: --dark-text (#FFFFFF)
```

**Hover on clickable cards:**
```
transition: box-shadow 0.15s, border-color 0.15s
hover: box-shadow --shadow-md, border-color --border (slightly darker)
```

---

### Badges / Tags

**Default**
```
background: --surface (#F7F7F8)
color: --text2 (#6B6B6B)
border: 1px solid --border (#E5E5E5)
padding: 2px 8px
border-radius: --radius-full
font-size: 11px
font-weight: 500
```

**Accent (blue)**
```
background: --accent-light (#EFF6FF)
color: --accent (#2563EB)
border: 1px solid --accent-border (#BFDBFE)
```

**Success / Error / Warning:**
Use matching `--success-bg`, `--success`, `--success-border` pattern

---

### Table / List Rows

```
padding: 14px 24px
border-bottom: 1px solid --border2 (#F0F0F0)
background: transparent
hover background: --surface (#F7F7F8)
transition: background 0.1s
```

Header row:
```
font-size: 11px
font-weight: 600
color: --text3
text-transform: uppercase
letter-spacing: 0.08em
padding: 10px 24px
background: --surface
border-bottom: 1px solid --border
```

---

### Sidebar / Navigation

```
width: 220px (expanded), 56px (collapsed)
background: --surface (#F7F7F8)
border-right: 1px solid --border (#E5E5E5)

Nav item (default):
  color: --text2 (#6B6B6B)
  padding: 8px 12px
  border-radius: --radius-lg (10px)
  font-size: 13px
  font-weight: 500
  hover: background --surface2, color --text

Nav item (active):
  background: #000000 (primary)
  color: #FFFFFF
  font-weight: 600

Logo area:
  height: 56px
  border-bottom: 1px solid --border
  padding: 0 16px
```

---

### Modal / Dialog

```
Overlay: rgba(0,0,0,0.4) backdrop
Container:
  background: --bg (#FFFFFF)
  border: 1px solid --border (#E5E5E5)
  border-radius: --radius-3xl (20px)
  padding: 28px
  box-shadow: --shadow-xl
  max-width: 560px
  width: calc(100% - 48px)

Header: h2 at 17px/700, subtext at 12px/--text2, close button top-right
Footer: flex row, gap 10px, secondary cancel + primary confirm
```

---

### Status Indicators

**Status dot**
```
width: 8px, height: 8px, border-radius: full
running: #F59E0B (amber) + pulse animation
completed: #16A34A (green)
failed: #DC2626 (red)
waiting: #9B9B9B (gray)
```

**Status badge**
```
Same colors, pill shape, 11px text, icon + label
```

---

## Builder Canvas

The canvas is a **dark environment** — this is the one place where the dark palette lives.

```
Canvas background: --dark-bg (#0A0A0A)
Grid dots: rgba(255,255,255,0.06)
```

### Node Design

Every node follows this structure:
```
Container:
  background: --dark-surface (#111111)
  border: 1px solid --dark-border (#2A2A2A)
  border-radius: 12px
  min-width: 200px
  box-shadow: 0 4px 20px rgba(0,0,0,0.5)
  selected: border-color = node's accent color

Header:
  background: node color at 15% opacity
  border-bottom: 1px solid node color at 30% opacity
  padding: 10px 14px
  border-radius: 12px 12px 0 0
  color-dot: 8px circle, solid node color
  label: 12px/600, --dark-text

Body:
  padding: 12px 14px
  background: transparent
  text: 12px, --dark-text2

Handle (connection point):
  width: 10px, height: 10px
  border-radius: full
  background: node color
  border: 2px solid --dark-bg
```

### Edge Design

```
Default edge: stroke #2A2A2A, stroke-width 2
Active/hover: stroke --accent (#2563EB), stroke-width 2
Animated (running): stroke --accent, stroke-dasharray animation
Label: 10px monospace, --dark-text3, background --dark-surface2
```

---

## Iconography

Library: **Lucide React** (already installed) — keep it.

Rules:
- Standard size: 16px in nav, 14px in buttons, 15px in cards
- Color: always inherit from parent text color — never hardcode icon colors except in status indicators
- Stroke width: 1.5 (default) for UI icons, 2 for emphasis
- Never use filled icons — always stroke/outline

---

## Animations & Transitions

```
Fast (hover state changes):   150ms ease
Standard (open/close):        200ms ease
Slow (page transitions):      300ms ease

Easing: ease (default), ease-out (exits), ease-in-out (transforms)
```

**Allowed animations:**
- Button hover: background color change (150ms)
- Card hover: box-shadow + border (150ms)
- Sidebar collapse: width (200ms ease)
- Modal: opacity + scale (200ms ease-out)
- Spinner: rotate 1s linear infinite
- Status dot pulse: 2s ease-in-out infinite

**Not allowed:**
- Glows / neon box-shadows on interactive elements
- Sliding in content from sides without user interaction
- Bounces or spring physics (keep it professional)

---

## Do's and Don'ts

### Do
- Use whitespace generously — 48px page padding, 40px section gaps
- Use `--text3` for all metadata, timestamps, IDs
- Keep status colors semantic — green = good, red = bad, amber = attention
- Dark cards only inside the canvas or explicitly technical contexts (code blocks, API examples)
- One primary action per page/modal

### Don't
- Use node colors (`--node-llm`, etc.) outside the canvas
- Stack more than 2 levels of surface color (`--bg` to `--surface` and stop)
- Use gradients in the dashboard UI (landing page only)
- Show more than 4 stat cards in a row on a page
- Use `font-weight: 400` for anything smaller than 14px, use 500 minimum
- Use borders heavier than 1px anywhere
- Add `box-shadow` with color tint (no `rgba(124,111,240,0.4)` style glows)
- **Use em dashes (`—`) anywhere in UI copy** — this is a hard rule. Use a period, a colon, a comma, or `·` (middle dot) instead. Em dashes look unprofessional in technical UI and cause text rendering inconsistencies across platforms.

### Typography punctuation rules

| Instead of | Use |
|---|---|
| `Build via Chat — now live` | `Build via Chat · now live` |
| `production-grade infra — every agent` | `production-grade infra. Every agent` |
| `No lock-in — no surprises` | `No lock-in. No surprises.` |
| Any `—` in UI strings | Period, colon, comma, or `·` |

The only acceptable dash character in UI copy is the regular hyphen (`-`) inside compound words like `production-grade`, `drag-and-drop`, `built-in`.

---

## Landing Page Specifics

The landing page (`app/page.tsx`) is the **one exception** where:
- Dark background (`--dark-bg`) is used for the full page
- Gradients are allowed for hero headline text
- Glow effects on the primary CTA button are allowed (max 1)
- The rest of the site (dashboard, auth, docs) is **always light**

---

## Page-by-Page Design Notes

| Page | Key changes needed |
|---|---|
| Landing | Keep dark, add pricing section, clean typography |
| Login / Signup | White card on white bg, black primary button, clean inputs |
| Dashboard | White bg, black sidebar nav active state, real chart library |
| Agents | White bg, table/list view, search + filter bar |
| Builder | Keep dark canvas, redesign sidebar config panel to light |
| Runs | Table view with status badges, filter bar |
| Analytics | Real chart library (Recharts), white bg |
| API Keys | Clean table, monospace key display |
| Models/Tools | Form-heavy pages, clean input groups |
| Docs | Two-column layout, sticky sidebar, code blocks dark |

---

## Implementation Order

When redesigning pages, follow this order:
1. `app/globals.css` — update CSS variables to this system
2. Sidebar (`app/(dashboard)/layout.tsx`) — new nav with black active state
3. Login / Signup — auth pages
4. Dashboard — stats + recent activity
5. Agents — list page
6. Builder — canvas + config panel
7. Runs — table view
8. Analytics — charts
9. All config pages (models, tools, prompts, etc.)
10. Landing page — last (most complex, least urgent for SaaS)

---

## Editorial Dark Mode System 

This section defines the premium editorial dark aesthetic used for:
- Landing page (full page)
- Hero sections
- Featured / showcase cards
- Technical article previews
- API reference pages
- Premium content surfaces

Inspired by: **Linear, Vercel, Notion editorial layouts**

### Dark Mode Philosophy

Dark mode is **NOT:**
- Random neon glows
- Cyberpunk / gaming UI
- Oversaturated gradients
- Shiny startup purple
- Heavy drop shadows with color tint

Dark mode **SHOULD feel:**
- Calm and cinematic
- Premium and expensive
- Editorial — like a high-end engineering publication
- Technical confidence without shouting
- Minimal — every element earns its place

Think: *Stripe's documentation at night. Linear's changelog. Vercel's homepage.*

---

### Editorial Color Palette (Dark)

These tokens apply when `data-theme="dark"` or within `.editorial-dark` sections (landing page).

```css
[data-theme="dark"], .editorial-dark {
  /* ── Backgrounds ───────────────────────────────── */
  --bg:        #0A0A0A;   /* pure near-black — NOT navy */
  --surface:   #111111;   /* cards, panels */
  --surface2:  #161616;   /* elevated surfaces */
  --surface3:  #1C1C1C;   /* hover states */

  /* ── Borders ───────────────────────────────────── */
  --border:    rgba(255,255,255,0.08);   /* subtle white-alpha */
  --border2:   rgba(255,255,255,0.05);   /* ultra-subtle dividers */
  --border-accent: rgba(255,255,255,0.15); /* hover/focus borders */

  /* ── Text ──────────────────────────────────────── */
  --text:      #FAFAFA;   /* near-white, slightly warm */
  --text2:     #A1A1AA;   /* secondary — zinc-400 */
  --text3:     #71717A;   /* tertiary — zinc-500 */
  --text4:     #3F3F46;   /* disabled — zinc-700 */

  /* ── Primary Action (white on dark) ───────────── */
  --primary:        #FFFFFF;
  --primary-hover:  #F4F4F5;
  --primary-fg:     #000000;

  /* ── Accent (stays blue, but lighter on dark) ─── */
  --accent:         #60A5FA;   /* blue-400 — lighter for dark bg */
  --accent-hover:   #93C5FD;   /* blue-300 */
  --accent-light:   rgba(96,165,250,0.1);

  /* ── Editorial Highlight ────────────────────────── */
  --highlight:      rgba(255,255,255,0.04);   /* subtle card lift on hover */
  --highlight-border: rgba(255,255,255,0.12);

  /* ── Shadows (dark mode shadows use opacity not color) */
  --shadow-sm: 0 1px 3px rgba(0,0,0,0.4);
  --shadow-md: 0 4px 12px rgba(0,0,0,0.5);
  --shadow-lg: 0 12px 32px rgba(0,0,0,0.6);
  --shadow-xl: 0 24px 64px rgba(0,0,0,0.7);
}
```

---

### Editorial Typography

#### Fonts

```css
/* Hero / editorial headlines only */
font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;

/* All UI, body, nav */
font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

/* Code, IDs, technical */
font-family: 'JetBrains Mono', 'Fira Code', monospace;
```

Import in `app/layout.tsx`:
```tsx
import { Inter, Playfair_Display } from 'next/font/google'
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  style: ['normal', 'italic'],
})
```

#### When to use Playfair Display

| Use | Don't use |
|---|---|
| Landing page hero H1 | Dashboard headings |
| Featured article title | Nav items |
| Section pull-quotes | Buttons |
| Editorial "eyebrow + big title" pairs | Any UI chrome |

The rule: **Playfair is for reading, Inter is for using.**

#### Editorial Type Scale (Dark / Landing)

| Element | Font | Size | Weight | Style | Notes |
|---|---|---|---|---|---|
| Hero headline | Playfair Display | 56–72px | 700 | Normal or Italic | Letter-spacing -0.02em |
| Hero subhead | Inter | 18–20px | 400 | Normal | Color --text2, line-height 1.7 |
| Section eyebrow | Inter | 11px | 600 | Uppercase | --text3, letter-spacing 0.1em |
| Section title | Inter | 32–40px | 700 | Normal | Letter-spacing -0.02em |
| Article card title | Playfair Display | 20–24px | 600 | Normal | --text, line-height 1.3 |
| Article card body | Inter | 14px | 400 | Normal | --text2, line-height 1.65 |
| Code / technical | JetBrains Mono | 13px | 400 | Normal | --text2 |
| Nav items | Inter | 14px | 500 | Normal | --text2 |
| CTA button | Inter | 15px | 600 | Normal | --primary-fg on --primary |

---

### Editorial Card Design

Dark editorial cards are used on the landing page for features, articles, and showcases.

**Standard dark card:**
```
background: --surface (#111111)
border: 1px solid --border (rgba(255,255,255,0.08))
border-radius: 16px
padding: 28px
transition: border-color 200ms, background 200ms

hover:
  background: --surface2 (#161616)
  border-color: --border-accent (rgba(255,255,255,0.15))
  box-shadow: --shadow-md
```

**Featured / hero card:**
```
background: --surface (#111111)
border: 1px solid --border
border-radius: 16px
overflow: hidden

Image area:
  aspect-ratio: 16/9 or 4/3
  background: --surface2
  border-bottom: 1px solid --border

Content area:
  padding: 20px 24px
  Eyebrow: 10px/600/uppercase/--text3
  Title: Playfair Display 20px/600/--text
  Body: Inter 13px/400/--text2/line-height 1.6
```

---

### Editorial Motion Design (Framer Motion)

All animations use Framer Motion. These are the approved patterns only — nothing outside this list.

#### Page entrance (staggered children)
```tsx
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 }
  }
}
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }
}
```

#### Card hover lift
```tsx
whileHover={{ y: -2, transition: { duration: 0.15 } }}
```

#### Button press
```tsx
whileTap={{ scale: 0.97 }}
```

#### Fade in (single element)
```tsx
initial={{ opacity: 0, y: 12 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
```

#### Modal entrance
```tsx
initial={{ opacity: 0, scale: 0.96 }}
animate={{ opacity: 1, scale: 1 }}
exit={{ opacity: 0, scale: 0.96 }}
transition={{ duration: 0.2, ease: 'easeOut' }}
```

**Easing reference:** `[0.16, 1, 0.3, 1]` is a custom ease-out-expo — fast start, smooth settle. Use it for entrances. Use `easeOut` for exits.

**Rules:**
- Duration cap: 400ms max for any UI animation
- Never animate `width`, `height` directly — use `scaleX`/`scaleY` or `maxHeight` + `overflow: hidden`
- No spring physics on page elements — springs are for drag interactions only
- Respect `prefers-reduced-motion` — wrap all animations:

```tsx
import { useReducedMotion } from 'framer-motion'
const reduced = useReducedMotion()
// Pass reduced ? {} : animationProps to motion components
```

---

### Editorial Layout Patterns

#### Hero section structure
```
[eyebrow label — small caps, --text3]
[H1 — Playfair Display, large, tight tracking]
[Subtext — Inter, 18–20px, --text2, max-width 560px]
[CTA buttons — row, gap 12px]
[Code snippet or screenshot — dark card, below CTA]
```

#### Section structure
```
[eyebrow — centered, small caps]
[Section title — centered, Inter 700]
[Body copy — centered, max-width 560px, --text2]
[Content grid — 40px below]
```

#### Technical strip (provider logos, stats)
```
border-top + border-bottom: 1px solid --border
background: --surface (#111111) — slightly lifted
padding: 28px 32px
content: flex row, centered, gap 24–32px
```

---

### What Lives in Dark Mode vs Light Mode

| Surface | Mode | Why |
|---|---|---|
| Landing page | Dark | Editorial, first impression |
| Builder canvas | Dark | Technical environment |
| Code blocks (everywhere) | Dark | Readability |
| Dashboard | Light | Working environment — clarity |
| Auth (login/signup) | Light | Trust, clean |
| Docs | Light (code blocks dark) | Readability |
| Modals (in dashboard) | Light | Matches parent context |
| Modals (on landing) | Dark | Matches parent context |

---

### Editorial Color Tokens (globals.css additions)

These are separate from the light mode tokens — prefix `--editorial-` keeps them isolated.

```css
:root {
  /* Editorial dark surfaces */
  --editorial-bg:       #050505;
  --editorial-surface:  #0B0B0B;
  --editorial-surface2: #111111;
  --editorial-surface3: #171717;

  /* Editorial borders (white-alpha) */
  --editorial-border:   rgba(255,255,255,0.08);
  --editorial-border2:  rgba(255,255,255,0.04);

  /* Editorial text */
  --editorial-text:     #FFFFFF;
  --editorial-text2:    #D4D4D8;   /* zinc-300 */
  --editorial-text3:    #71717A;   /* zinc-500 */

  /* Editorial accent */
  --editorial-accent:   #2563EB;

  /* Editorial glow (for hover surfaces, NOT borders) */
  --editorial-glow:     rgba(255,255,255,0.04);
}
```

---

### Premium Hover Physics

Everything should feel smooth, weighted, expensive. Never abrupt, never bouncy.

#### Card hover (the standard for all editorial cards)

```css
transition:
  transform 0.45s cubic-bezier(.16,1,.3,1),
  border-color 0.45s ease,
  box-shadow 0.45s ease;

/* On hover: */
transform: translateY(-10px) scale(1.015);
box-shadow:
  0 40px 80px rgba(0,0,0,0.45),
  0 0 0 1px rgba(255,255,255,0.04);
```

**Rules:**
- Hover must feel magnetic — slight resistance then lift
- `-10px` is the maximum Y travel — never more
- Scale never exceeds `1.02` on cards
- No bounce, no spring, no overshoot
- `cubic-bezier(.16,1,.3,1)` is the approved ease — fast start, smooth settle

#### Image zoom inside cards (on card hover)

```css
/* Image container: overflow hidden */
/* Image element: */
transition:
  transform 1s cubic-bezier(.16,1,.3,1),
  filter 0.6s ease;

/* On card hover: */
transform: scale(1.05);
filter: brightness(1.05);
```

#### Floating CTA button hover

Only on landing/marketing pages — never in dashboard.

```css
transition: transform 0.2s ease, box-shadow 0.2s ease;
box-shadow: 0 0 40px rgba(37,99,235,0.35);

/* On hover: */
transform: translateY(-4px);
```

---

### Editorial Article Card Spec (Full)

Inspired by article cards — dark, cinematic, high contrast.

```
Structure:
┌─────────────────────┐
│  Hero Image         │  aspect-ratio: 16/9 or 4/3, overflow hidden
├─────────────────────┤
│  EYEBROW LABEL      │  11px, uppercase, letter-spacing 0.1em, --editorial-text3
│  Feature Title      │  34–42px, weight 800, letter-spacing -0.04em, line-height 1.05
│  Description        │  14px, --editorial-text2, line-height 1.6
│  Metadata row       │  14px, --editorial-text3 (views · read time · date)
└─────────────────────┘
```

```css
/* Card container */
background: linear-gradient(180deg, #0E0E0E 0%, #090909 100%);
border: 1px solid rgba(255,255,255,0.08);
border-radius: 28px;
overflow: hidden;

/* Title hover state */
.card-title { transition: color 0.2s ease; }
.card:hover .card-title { color: var(--editorial-accent); }
```

---

### Glassmorphism Navbar (Landing / Editorial Pages)

```css
position: sticky;
top: 0;
z-index: 50;
background: rgba(5,5,5,0.90);
backdrop-filter: blur(20px);
-webkit-backdrop-filter: blur(20px);
border-bottom: 1px solid rgba(255,255,255,0.08);
```

- Transparent feel — content bleeds through slightly
- Never fully opaque
- Smooth on scroll — no jump
- Always sticky, never fixed (avoids layout shift)

---

### Layout Width Rules

| Context | Max Width |
|---|---|
| Landing hero | 1400px |
| Landing editorial feed | 1400px |
| Docs pages | 1100px |
| Dashboard pages | 1100px |
| Auth pages | 480px (card) |
| Modals | 560px |

### Hero Layout Grid

```css
/* Two-column hero (headline left, CTA/countdown right) */
display: grid;
grid-template-columns: 1.2fr 0.8fr;
gap: 100px;
align-items: center;
```

---

### Editorial Image Rules

Images in editorial cards and hero sections must feel:

**Use:**
- Coding setups and dev workspaces
- Architecture and system design diagrams
- Technical UI screenshots
- Engineering illustrations (dark background)
- High-contrast technical photography

**Never use:**
- Generic stock photos
- Bright corporate imagery
- Oversaturated AI art
- Cheesy startup illustrations
- Anything that looks like a Dribbble concept

---

### Approved Easings Reference

| Name | Value | Use for |
|---|---|---|
| Premium ease-out | `cubic-bezier(.16,1,.3,1)` | Cards, modals, large transforms, image zoom |
| Standard | `ease` | Color, opacity, border-color transitions |
| Linear | `linear` | Spinners, progress bars only |

**Duration rules:**
- Color/opacity changes: 150–200ms
- Position/transform (small): 200–300ms
- Position/transform (large, cards): 400–450ms
- Image zoom: 600ms–1s
- Cap: never exceed 500ms for UI, 1s for images

---

### Motion DO / DON'T

| DO | DON'T |
|---|---|
| Image zoom on card hover | Spring / bounce animations |
| Soft Y elevation (-10px) | Aggressive parallax on scroll |
| Subtle scale (1.01–1.02) | Neon glow on hover |
| Smooth border fade | Fast aggressive motion < 100ms |
| Staggered list entrances | Simultaneous bulk animations |
| `prefers-reduced-motion` check | Ignoring accessibility |

---

### Final Visual Direction

The product must feel like:
- "Built by serious engineers"
- "Premium engineering publication"
- "Elite AI developer tooling"
- "A modern technical operating system"

It must NOT feel like:
- A crypto dashboard
- An AI toy / weekend project
- A neon hacker UI
- A Dribbble shot that was never shipped
- A gaming interface

---

## Logo Specification

Inspired by: **no background box, accent-colored icon, tagline below**

### Structure

```
[⚡] AgentHub
     BUILT FOR ENGINEERS WHO SHIP
```

**Icon:** `Zap` from Lucide React
- Color: `#2563EB` (accent blue — same in both light and dark mode)
- Size: 22px in navbar, 18px in footer
- Stroke width: 2.5
- No background box, no border-radius container — bare icon only

**Brand name:**
- Font: Inter 700, 16px in navbar, 14px in footer
- Color: `--text` (white on dark, `#0D0D0D` on light)
- Letter spacing: `-0.02em`

**Tagline:**
- Text: "BUILT FOR ENGINEERS WHO SHIP"
- Font: Inter 600, 9px, uppercase
- Letter spacing: `0.12em`
- Color: `--text3` (gray — muted, never dominant)
- Margin top: 3px below brand name

### Rules

- Never put the Zap icon inside a box/card/rounded-square — bare icon only
- Blue accent (`#2563EB`) is the only color on the logo across all surfaces
- The tagline is always present on marketing pages; optional in compact UI contexts
- Do not change the tagline text per page — it is a brand constant

---

## Light Mode — Landing Page

The light mode of the landing page follows the same editorial structure as dark, but flips surfaces to white..

### Design Principles

- White is the default background — not cream, not gray
- Borders are `rgba(0,0,0,0.08)` — barely visible, just enough to separate surfaces
- Text hierarchy is sharp: `#0D0D0D` / `#6B6B6B` / `#9B9B9B`
- Technical surfaces (code blocks, workflow panel, node visualizations) **stay dark** in light mode — they are editorial dark cards embedded in a light page
- The blue accent stays exactly `#2563EB` — do not lighten it for light mode
- Primary CTA button: `background: #000000`, `color: #FFFFFF` (inverted vs dark mode)

### Light Mode Tokens (landing page specific)

```css
/* Light mode overrides for landing page */
--lp-bg:          #FFFFFF;
--lp-surface:     #F7F7F8;
--lp-surface2:    #EFEFEF;
--lp-surface3:    #E5E5E5;
--lp-border:      rgba(0,0,0,0.08);
--lp-border2:     rgba(0,0,0,0.04);
--lp-border-hi:   rgba(0,0,0,0.15);
--lp-text:        #0D0D0D;
--lp-text2:       #6B6B6B;
--lp-text3:       #9B9B9B;
--lp-nav-bg:      rgba(255,255,255,0.92);
--lp-btn-bg:      #000000;
--lp-btn-text:    #FFFFFF;
```

### What stays dark even in light mode

| Element | Why |
|---|---|
| Code blocks (API section) | Code is always dark — readability + convention |
| Workflow panel (hero right) | Technical canvas environment |
| Auth modal | Always editorial dark regardless of page theme |
| Node type color dots | Node colors are semantic, not themeable |

### Nav in light mode

```
background: rgba(255,255,255,0.92)
backdrop-filter: blur(20px)
border-bottom: 1px solid rgba(0,0,0,0.08)
Logo: blue Zap + "AgentHub" in #0D0D0D + tagline in #9B9B9B
"Sign in": background rgba(0,0,0,0.04), border rgba(0,0,0,0.1), text #6B6B6B
"Get started": background #000000, text #FFFFFF
Theme toggle: background rgba(0,0,0,0.04), Moon icon
```

### Tag bar in light mode

```
background: #F7F7F8
border-bottom: 1px solid rgba(0,0,0,0.04)
Active tag: background #000000, text #FFFFFF
Inactive tag: border rgba(0,0,0,0.08), text #9B9B9B
```

### Feature cards in light mode

```
background: #F7F7F8   (surface — not white, slightly lifted)
border: 1px solid rgba(0,0,0,0.08)
hover background: #EFEFEF
hover border: rgba(0,0,0,0.15)
icon container: background #EFEFEF, border rgba(0,0,0,0.08)
```

### Philosophy section in light mode

```
background: #F7F7F8
Cards: background #EFEFEF, border rgba(0,0,0,0.08)
Center RefreshCw icon: color #9B9B9B
Arrows: color #9B9B9B
Hover: border rgba(0,0,0,0.15), background #E5E5E5
```
