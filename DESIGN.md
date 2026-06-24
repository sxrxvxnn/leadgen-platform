# DESIGN.md: SonarLeads — Blended Design System

## Sources
- **steven.com** — `https://steven.com/` — dark editorial creator-economy OS
- **en.protection.gr** — `https://en.protection.gr/` — industrial B2B fabric manufacturer
- Capture date: 2026-06-18
- Evidence: branding JSON, images, markdown content from both sites

---

## Design Summary

A dark-first B2B lead intelligence platform that blends two identities:
**steven.com's** bold editorial sharpness (near-black backgrounds, electric yellow, condensed gothic type, zero border-radius) with **protection.gr's** warm professional restraint (steel gray palette, minimal density, "engineered" tone). The result is a platform that feels precision-built and serious — not a flashy SaaS tool — with moments of electric energy on CTAs and key numbers.

Dark sections dominate (dashboard, hero). Light warm-gray sections appear for data-heavy content (tables, settings, forms). Yellow is used sparingly — only for the single most important CTA or a live metric on each page.

---

## Design Tokens

### Colors

| Role | Hex | Source | Notes |
|---|---|---|---|
| **bg-dark** | `#121212` | steven.com | Primary page background |
| **bg-surface** | `#1A1A1A` | inferred | Cards, panels on dark |
| **bg-light** | `#ECEDEC` | protection.gr | Alternate sections, forms, tables |
| **bg-light-surface** | `#E3E4E3` | inferred | Cards on light sections |
| **accent-yellow** | `#FFFF00` | steven.com | Primary CTA only — use once per screen |
| **accent-blue** | `#0082F3` | steven.com | Links, secondary actions |
| **steel** | `#5B6670` | protection.gr | Muted labels, secondary text |
| **steel-mid** | `#69727D` | protection.gr | Borders, dividers, captions |
| **text-primary-dark** | `#F5F5F5` | inferred | Body text on dark bg |
| **text-primary-light** | `#000000` | protection.gr | Body text on light bg |
| **text-muted** | `#69727D` | protection.gr | Timestamps, subtitles |
| **border-dark** | `#2A2A2A` | inferred | Dividers on dark |
| **border-light** | `#C8C9C8` | inferred | Dividers on light |
| **success** | `#22C55E` | inferred | Pipeline / positive signals |
| **warning** | `#F59E0B` | inferred | Amber glow (echoes protection.gr loading animation) |

### Typography

**Heading font:** `"Field Gothic Trimmed"` (steven.com) — condensed gothic, all-caps where impactful
- Fallback: `"Zona Pro", "Barlow Condensed", sans-serif` (protection.gr secondary)
- Note: Field Gothic is a paid font; for Google Fonts equivalent use `Barlow Condensed` weight 700

**Body font:** `"Host Grotesk"` (steven.com) + `"Roboto"` (protection.gr)
- Primary body: `Host Grotesk` — use for UI labels, nav, descriptions
- Fallback stack: `"Roboto", "Arial", sans-serif`

**Scale (inferred from steven.com 71.2px h1, protection.gr 16px body):**

| Token | Size | Weight | Usage |
|---|---|---|---|
| `display-xl` | 72px / 4.5rem | 700 | Hero numbers, big stats (CountUp) |
| `display-lg` | 56px / 3.5rem | 700 | Section headlines |
| `heading-1` | 40px / 2.5rem | 700 | Page titles |
| `heading-2` | 28px / 1.75rem | 600 | Card headings, modal titles |
| `heading-3` | 20px / 1.25rem | 600 | Sub-sections |
| `body` | 14px / 0.875rem | 400 | Body copy, table rows |
| `body-sm` | 12px / 0.75rem | 400 | Captions, timestamps (steven.com uses 12px body) |
| `label` | 11px / 0.6875rem | 500 | Uppercase nav labels, tags |

**Letter-spacing:** Headings +0.02em; labels/all-caps +0.08em (protection.gr editorial style)
**Line-height:** Display 1.0–1.05; body 1.6

### Spacing and Layout

| Token | Value | Notes |
|---|---|---|
| Base unit | 4px | Both sites |
| `space-1` | 4px | |
| `space-2` | 8px | |
| `space-3` | 12px | |
| `space-4` | 16px | |
| `space-6` | 24px | |
| `space-8` | 32px | |
| `space-12` | 48px | |
| `space-16` | 64px | |
| `space-24` | 96px | Section padding |
| **Border radius** | **0px** | steven.com — sharp, no rounding |
| Border radius (inputs) | 2px | Tiny concession for usability |
| Container max-width | 1200px | |
| Column gutter | 16px | |
| Section rhythm | 96–120px top/bottom | |

### Shadows

- Dark sections: no box-shadow; use borders `1px solid #2A2A2A` instead
- Light sections: `0 1px 3px rgba(0,0,0,0.08)` on cards
- Yellow glow (CTA hover): `0 0 20px rgba(255,255,0,0.25)`
- Amber glow (inspired by protection.gr loading): `radial-gradient(ellipse at center, rgba(245,158,11,0.15) 0%, transparent 70%)` — background accent for stat sections

---

## Components

### Buttons

**Primary (yellow — use once per screen):**
```css
background: #FFFF00;
color: #121212;
border: none;
border-radius: 0;
padding: 12px 28px;
font: 500 13px "Host Grotesk";
letter-spacing: 0.06em;
text-transform: uppercase;
```
Hover: `background: #E5E500; box-shadow: 0 0 20px rgba(255,255,0,0.3)`

**Secondary (steel):**
```css
background: #69727D;
color: #FFFFFF;
border: none;
border-radius: 0;
padding: 10px 24px;
font: 500 12px "Host Grotesk";
letter-spacing: 0.06em;
text-transform: uppercase;
```
Source: protection.gr exact button style

**Ghost (dark surface):**
```css
background: transparent;
color: #F5F5F5;
border: 1px solid #2A2A2A;
border-radius: 0;
padding: 10px 24px;
```
Hover: `border-color: #FFFF00; color: #FFFF00`

**Ghost (light surface):**
```css
background: transparent;
color: #000;
border: 1px solid #5B6670;
border-radius: 0;
```

### Inputs / Forms

```css
background: transparent;
border: 1px solid #69727D;
border-radius: 2px;
color: inherit;
padding: 10px 14px;
font: 14px "Host Grotesk";
```
Focus: `border-color: #FFFF00` (dark) / `border-color: #0082F3` (light)
Source: protection.gr input component, adapted for dark

### Cards (dark surface)

```css
background: #1A1A1A;
border: 1px solid #2A2A2A;
border-radius: 0;
padding: 24px;
```
No shadow. Hover: `border-color: #3A3A3A`

### Cards (light surface)

```css
background: #E3E4E3;
border: 1px solid #C8C9C8;
border-radius: 0;
padding: 24px;
box-shadow: 0 1px 3px rgba(0,0,0,0.08);
```

### Navigation

**Dark nav (fixed/floating):**
- Background: `rgba(18,18,18,0.92)` + `backdrop-filter: blur(12px)`
- Logo: left-aligned
- Links: `11px uppercase, letter-spacing 0.08em, color #69727D` → hover `#F5F5F5`
- CTA button: primary yellow, right side
- Optional: city timezones display (steven.com signature detail) for global feel

**Nav items layout:** space between logo, links in center cluster, CTA right — identical to steven.com

### Badges / Tags

```css
background: transparent;
border: 1px solid currentColor;
border-radius: 0;
padding: 2px 8px;
font: 500 10px "Host Grotesk";
letter-spacing: 0.08em;
text-transform: uppercase;
```
Colors: steel `#69727D` (default), yellow `#FFFF00` (active/hot), blue `#0082F3` (info)

### Stats / Numbers

- Large CountUp numbers: `display-xl` (72px), Field Gothic Trimmed / Barlow Condensed
- Background accent behind stat sections: amber radial glow (protection.gr signature) on dark = `radial-gradient(ellipse at 50% 50%, rgba(245,158,11,0.08) 0%, transparent 60%)`
- Number color: `#F5F5F5` or `#FFFF00` for the hero primary stat

---

## Page Patterns

### Landing Page

```
[FloatingNavbar — dark, yellow CTA]
[Hero — full-height dark, 72px display heading, yellow CTA button, amber glow orb behind stats]
[Stats bar — 3 numbers on dark, Field Gothic Trimmed]
[Features section — alternating: dark card grid / light #ECEDEC section]
[Social proof / companies — dark, InfiniteMarquee of logos]
[Pricing — light #ECEDEC section, cards with sharp borders]
[CTA band — full-width dark, single yellow button]
[Footer — dark, uppercase nav labels]
```

### Dashboard

```
[Sidebar — #1A1A1A, uppercase nav labels at 11px]
[Hero stat row — dark bg, CountUp in Field Gothic, amber glow]
[Bento grid — sharp 0px radius cards, 1px #2A2A2A borders]
[Bottom tabs — spring underline, yellow indicator]
```

### Auth (Login / Signup)

```
[Left panel — dark #121212, dot grid accent, editorial heading]
[Right panel — light #ECEDEC, clean form, steel button]
```
Source: existing dot-grid pattern kept, colors updated to blended palette

---

## Content Style

- **Headings:** Short, declarative, often one word or two. "Engineered." "Leads." "Pipeline." (protection.gr signature)
- **Body copy:** Precise, functional. No fluff. "491 companies. Filtered by phase, building, and category."
- **CTAs:** Uppercase imperatives: "START FREE", "VIEW PIPELINE", "ADD COMPANY"
- **Tone:** Serious B2B tool — not playful. "Operating system for…" (steven.com) applied to lead gen: "Intelligence layer for B2B sales."
- **Numbers:** Always displayed prominently. Lead counts, company counts, enrich stats shown as hero metrics.

---

## Agent Build Instructions

To implement this design system in the existing React/Vite dashboard:

1. **CSS variables** — add to `index.css` `:root`:
   ```css
   --bg-dark: #121212;
   --bg-surface: #1A1A1A;
   --bg-light: #ECEDEC;
   --accent-yellow: #FFFF00;
   --accent-blue: #0082F3;
   --steel: #5B6670;
   --steel-mid: #69727D;
   --text-dark: #F5F5F5;
   --text-light: #000000;
   --border-dark: #2A2A2A;
   --border-light: #C8C9C8;
   --radius: 0px;
   --radius-sm: 2px;
   ```

2. **Fonts** — add to `index.html`:
   ```html
   <link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@700&family=Host+Grotesk:wght@400;500;600&family=Roboto:wght@400;500&display=swap" rel="stylesheet">
   ```
   Replace Field Gothic Trimmed with `Barlow Condensed` (free equivalent)

3. **Global resets** — in `index.css`:
   - `body`: `background: #121212; color: #F5F5F5; font-family: 'Host Grotesk', 'Roboto', sans-serif`
   - Remove all `border-radius` > 2px from existing components
   - Replace all existing primary button backgrounds with the yellow/steel system above

4. **Component priority order** for the rebuild:
   - Landing page (highest visual impact)
   - Dashboard hero + bento (most-used)
   - Auth pages (first impression)
   - Companies + Leads pages

5. **Keep** all existing Aceternity animation components (CanvasText, Globe, ThreeDCard, etc.) — update their colors to the new palette

6. **Amber glow** — add to Dashboard bento pipeline section as a `::before` pseudo-element radial gradient background, matching protection.gr's signature loading glow aesthetic

---

## Rerun Inputs
```
workflow: firecrawl-website-design-clone
source_url: https://steven.com/, https://en.protection.gr/
target_stack: React + Vite + Framer Motion (motion/react)
output: DESIGN.md
blend: true
```
