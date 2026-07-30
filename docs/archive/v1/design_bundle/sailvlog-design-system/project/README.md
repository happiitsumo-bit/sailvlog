# sailvlog Design System

> **Concept: "WIND READS YOU"** — a racing/sport-grade technical platform for sailors of dinghies and cruisers. Q&A, articles, real-time feed and learning courses, all in one. Dark-fixed, F1-meets-The-Athletic aesthetic.

This design system is derived **directly from the sailvlog codebase v2 (Racing edition)** — every token, component pattern and copy convention here is lifted from production source, not invented.

---

## Sources

- **Codebase** (read-only, mounted): `sailvlog/`
  - `sailvlog/frontend/src/app/globals.css` — full design-token + component CSS (1881 lines)
  - `sailvlog/frontend/src/app/layout.tsx`, `page.tsx`, `feed/page.tsx`, `questions/page.tsx`, `learn/page.tsx`, `sailors/page.tsx` — page composition
  - `sailvlog/frontend/src/components/{Navbar,ArticleCard,ClassFlag,LikeButton,BookmarkButton}.tsx`
  - `sailvlog/frontend/src/lib/mock.ts` — sample copy & data shapes
  - `sailvlog/docs/design-redesign-spec.md` — v1 brand brief
  - `sailvlog/docs/platform-redesign-spec.md` — v2 racing edition brief (current)
- **Uploaded reference imagery**: `uploads/{ダウンロード,OIP,OIP (1)}.webp` — 470-class logo + 470 race photos. Copied to `assets/`.

---

## Product context

**sailvlog** is a Japanese-language technical-exchange platform for competitive sailors — dinghy classes (470, ILCA/Laser, Snipe, 49er) and cruiser/offshore. It bundles four surfaces:

| Surface  | Purpose                                                         |
| -------- | --------------------------------------------------------------- |
| Articles | Long-form technique write-ups (markdown)                        |
| Q&A      | Stack-Overflow-style with votes + best-answer mark              |
| Feed     | 300-char timeline posts (Twitter-style)                         |
| Learn    | Curated courses (beginner → advanced), per boat-class           |

The product *is* the community. There is one product (the web app); no mobile-native, no marketing site separate from the app.

---

## CONTENT FUNDAMENTALS

### Language
- **Bilingual**: Japanese for body copy, **English for UI chrome / labels / nav** ("Feed", "Q&A", "Sailors", "Trending Questions"). This contrast is deliberate — it gives the product a competitive, international, sports-media feel.
- Headlines are big-English. Body, comments, articles are Japanese.

### Tone
- **Professional, peer-to-peer, no fluff.** Sailors talking to sailors. No hype, no marketing-speak, no exclamation marks in chrome.
- Treat the reader as a competitor / practitioner, not a beginner. "あなたの帆走経験を、次の世代へ。" (Your sailing experience, passed to the next generation.) — earnest, slightly formal.
- Feed copy is conversational ("ジブカニンガムを少し緩めただけでスピード乗ったの面白い。"); chrome copy is terse.

### Casing & form
- **UI chrome**: TITLE Case for buttons, UPPERCASE for labels/eyebrows ("`// CATEGORY`", "`SYSTEM // LIVE`").
- Mono-spaced "competitive sport" markers: `//`, `▲`, `→`, `●`, `⤳`. Used as bullets, arrows, status pips.
- Numbers are LARGE (Space Grotesk 700, often display-size). Counts/views in mono.

### "I vs You"
- Second-person ("あなた") in marketing copy on the hero ("あなたの帆走経験を、次の世代へ。").
- First-person ("私たち" / 自分) reserved for user-generated content.
- Imperative mood for CTAs ("Enter Feed", "Browse Courses", "+ Ask", "+ New Question").

### Emoji
- **No emoji.** The brand uses geometric unicode chars (▲ ◐ ◉ ♥ → ⤳ ●) instead, treated as iconography. See ICONOGRAPHY below.

### Sample copy (lifted verbatim from `mock.ts` + `page.tsx`)
- Hero: **WIND READS YOU.**
- Eyebrow: `SAILVLOG · KNOWLEDGE THAT SAILS`
- Corner badge: `SYSTEM // LIVE`
- Section heads: `// LATEST ARTICLES`, `// TRENDING QUESTIONS`, `// LIVE FEED`
- CTA: `▲ Enter Feed`, `⤳ Browse Courses`, `+ Ask`
- Empty state: `NO ARTICLES YET // 最初の一本を投稿しよう`
- Sub: `セーラーのための技術交流プラットフォーム。記事・Q&A・タイムライン・学習コースが一つに。`

---

## VISUAL FOUNDATIONS

### Color
**Dark fixed.** No light theme. Surfaces are a matte deep-sea teal (`#14222e` → `#1b2c3a` → `#243847` → `#2f4658`), foreground is bone-white (`#f4f4f1`).

Two accents drive the system:
- **`--flare` `#ff3d00`** — primary. Wind, speed, urgency, "live" pulse, primary CTA.
- **`--cyan` `#00d9ff`** — secondary. Water, data, links, hover states for navigation.
- **`--lime` `#c4ff00`** — reserved for *solved* state on Q&A and accepted answers. Never decorative.

Body has subtle radial-gradient hot spots in flare + cyan at the corners (~6% opacity) and a 180° vertical gradient `#16242f → #14222e → #11202b`. Backgrounds are never plain.

### Typography
| Role            | Family                | Use                                                 |
| --------------- | --------------------- | --------------------------------------------------- |
| Display         | **Space Grotesk** 700 | Hero, h1–h3, brand wordmark, numbers, button copy   |
| Body            | **Inter** 400/500/600 | Article body, comments, post body. JP falls back to Hiragino / Noto Sans JP |
| Mono            | **JetBrains Mono**    | Labels, eyebrows, timestamps, vote counts, tag `#`  |

- All Google-Fonts hosted, no local font files (see `colors_and_type.css`).
- **No font-file substitutions needed.**
- Hero title is **clamp(3rem, 8vw, 6.5rem)**, `line-height: 0.92`, `letter-spacing: -0.04em`. Very tight.
- Labels and eyebrows use mono uppercase with `letter-spacing: 0.12em–0.18em`.

### Spacing
- 8-pt grid. Card padding usually `1.4rem 1.6rem`. Page container `max-width: 1280px; padding: 2.5rem 1.5rem`.
- Two-column layout `1fr 300px`, three-column `240px 1fr 300px`, gap `2–2.5rem`.

### Borders & radii
- Radii intentionally **tight**: `--radius-xs: 2px`, `--radius-sm: 4px`, `--radius: 8px`. No 16px+ pillowy corners.
- Borders are `rgba(255,255,255,0.08)` (subtle hairline) or `0.16` (strong). Accent borders use `--border-flare` / `--border-cyan` at 40% alpha.
- Pills and chips use `--radius-xs` (2px) — tight, technical.

### Shadows / elevation
- Default `--shadow: 0 6px 32px rgba(0,0,0,0.50)`.
- Accent shadows: `--shadow-flare: 0 8px 40px rgba(255,61,0,0.25)`, `--shadow-cyan: 0 8px 40px rgba(0,217,255,0.20)` — only on primary-button hover.
- Inner shadows are not used. Glow comes from `box-shadow` on the live-dot pulse (`0 0 8px var(--lime)`).

### Backgrounds & motifs
- **Diagonal scanline overlay**: 115° repeating-linear-gradient at 1.8% white opacity, every 80px — present on `.hero::before`. Suggests speed.
- **Radial corner hot-spots** of flare and cyan on body bg.
- No photo backgrounds in chrome. Photography (race shots) appears only inside article cards / hero modules when imagery is present (none in current build).
- No hand-drawn illustration. No repeating patterns beyond scanlines.

### Animation
- Easings: `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)` (default), `--ease-snap: cubic-bezier(0.7, 0, 0.3, 1)` (links, underline reveals).
- Transitions 0.15–0.22s. **Snappy, never bouncy.**
- Hover on cards: `translateX(2px)` + a vertical flare bar growing from top (`scaleY(0 → 1)`).
- Buttons: `translateY(-1px)` lift + glow shadow on hover, snap-back on `:active`.
- Nav links: cyan/flare underline that reveals left → right via `transform: scaleX`.
- Stagger reveal on lists: 50ms increments, `slideUp 0.5s` from `translateY(16px)`.
- Live indicators pulse with `pulse 1.6–2s` on the lime / flare dots.

### Hover & press
- **Hover** = brighter surface (`--ink-2` → `--ink-3`) + stronger border (`--border-strong`) + small translate.
- **Buttons hover** = lighter accent (`--flare-2`, `--cyan-2`) + glow shadow.
- **Press** = `transform: translateY(0)` (cancels the lift). No depression scale.
- **Tags / chips hover** = border switches to accent color, text switches to accent color.

### Transparency & blur
- Navbar uses `backdrop-filter: blur(20px) saturate(180%)` over `rgba(20,34,46,0.92)` — frosted nav over a dark page.
- Otherwise transparency reserved for: hero gradients (radial hot-spots), like/bookmark backgrounds (`rgba(255,61,0,0.08)` when active), badge fills.

### Layout rules
- **Sticky** navbar (top: 0) + **sticky** sidebar (top: 88px).
- Horizontal scroll allowed only on the bottom nav-row (`navbar-row-bottom`) for class flags.
- Section-heads always have `// PREFIX` in flare-mono + a `View All →` action on the right.
- Always show metric clusters in mono with uppercase 0.1em-tracked labels under big display numbers.

### Imagery vibe
- When sailing photography appears, it's **cool-toned, high-contrast, daylight**: blue sea + white sails. Not warm/sunset, not B&W, no film grain. (See `assets/470-race-1.webp`, `470-race-2.webp`.)
- Class-flag SVGs are **flat, geometric, no shading** — see `ClassFlag.tsx`.

---

## ICONOGRAPHY

sailvlog deliberately avoids icon fonts and avoids decorative SVG icons. The project's "iconography" is built from three sources:

### 1. Unicode glyphs as functional pips/markers
The codebase uses these chars verbatim as icons inside copy and buttons:

| Glyph | Meaning                | Where                          |
| ----- | ---------------------- | ------------------------------ |
| `▲`   | system / primary CTA   | `▲ Enter Feed`, hero corner    |
| `⤳`   | "go to" / secondary    | `⤳ Browse Courses`             |
| `→`   | "see all", continuation| section-head-action `::after`  |
| `●`   | active dot / boat-type | `● {boatType}` in question meta|
| `//`  | section prefix         | `// Latest Articles`           |
| `♥`   | likes                  | post + article footer          |
| `◐`   | comments / replies     | post + article footer          |
| `◉`   | views                  | article footer                 |
| `✓`   | solved/accepted        | `.accepted-pill::before`       |
| `←`   | back link              | `.page-header-back::before`    |
| `+`   | new / ask              | `+ Ask`, `+ New Question`      |

These are styled (not text-decorated): mono family, brand-colored. **They are part of the visual identity, not placeholders.**

### 2. Inline SVG **class flags**
The only bespoke iconography is the class-flag SVG set, generated inline in `sailvlog/frontend/src/components/ClassFlag.tsx`. Six flags: `470`, `ilca`, `snipe`, `49er`, `cruiser`, `other`. Hand-drawn from the real class flag references. Always 40×26, flat color, 1.5–3px strokes, no shading.

A copy of this component is in `ui_kits/sailvlog/ClassFlag.jsx` and rendered on its own card.

### 3. No icon library, no emoji
- **No** Lucide / Heroicons / Material Symbols.
- **No** emoji anywhere in the product UI.
- If a future need arises for line icons, the closest match by stroke weight would be **Lucide** at `stroke-width: 1.5`, but this would need approval — current product does not use one.

### Logos
- Workmark: `sailvlog` set in Space Grotesk 700 + small mono `v2` badge to the right. No graphic mark — the pulsing flare dot before the wordmark is the closest thing to a logomark.
- 470-class graphic logo provided in `assets/470-logo.webp` (blue parallelogram "470" wordmark). This is a **class-association** mark, not the sailvlog brand mark.

---

## INDEX

```
sailvlog Design System/
├── README.md                ← this file
├── SKILL.md                 ← Agent-Skill manifest, drop-in for Claude Code
├── colors_and_type.css      ← all tokens + semantic type helpers
├── assets/
│   ├── 470-logo.webp        ← 470-class wordmark
│   ├── 470-race-1.webp      ← race photography (470)
│   └── 470-race-2.webp      ← race photography (470 fleet)
├── preview/                 ← Design-System tab cards (~14 cards)
│   ├── colors-surface.html
│   ├── colors-accent.html
│   ├── colors-semantic.html
│   ├── type-display.html
│   ├── type-body-mono.html
│   ├── type-scale.html
│   ├── spacing-radii.html
│   ├── elevation-shadows.html
│   ├── motion-easing.html
│   ├── buttons.html
│   ├── badges-tags.html
│   ├── form-controls.html
│   ├── article-card.html
│   ├── question-card.html
│   ├── post-card.html
│   ├── course-card.html
│   ├── sailor-card.html
│   ├── class-flags.html
│   ├── iconography.html
│   ├── logo.html
│   └── imagery.html
└── ui_kits/
    └── sailvlog/
        ├── README.md
        ├── index.html       ← interactive recreation: hero → feed → Q&A
        ├── tokens.css
        ├── Navbar.jsx
        ├── ArticleCard.jsx
        ├── QuestionCard.jsx
        ├── PostCard.jsx
        ├── CourseCard.jsx
        ├── SailorCard.jsx
        ├── ClassFlag.jsx
        ├── Hero.jsx
        ├── Sidebar.jsx
        └── Composer.jsx
```
