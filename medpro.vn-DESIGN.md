---
version: alpha
name: Medpro
description: |
  Medpro's design system embodies a modern, trustworthy healthcare digital
  experience built on clarity and accessibility. The palette combines vibrant
  primary cyan (#00B5F1) with deep information anchors and warm accents,
  creating a system that feels professional yet approachable. The brand
  prioritizes clean typography hierarchies and generous spacing to reduce
  cognitive load—critical for medical decision-making interfaces. Rounded
  pill-shaped buttons and soft card elevations convey warmth and human-centered
  design, while the strategic use of color blocking through (#E8F4FD) creates
  visual rhythm without relying heavily on shadows. The system feels optimized
  for rapid task completion across dense healthcare information.
source:
  url: "https://medpro.vn/"
  pagesAnalyzed: 1
  extractedAt: 2026-10-11
  tokensMeasured: true
colors:
  primary: "#00B5F1"
  accent: "#003553"
  canvas: "#FFFFFF"
  surface: "#000000"
  surface-alt: "#E8F4FD"
  on-primary: "#222222"
  ink: "#000000"
  info: "#12263F"
  accent-1: "#1DA1F2"
  accent-2: "#FFB54A"
  accent-3: "#FBA342"
  accent-4: "#0352CC"
  neutral-1: "#D9D9D9"
typography:
  heading-lg:
    fontFamily: Montserrat
    fontSize: 36px
    fontWeight: 700
    letterSpacing: 0px
  heading-md:
    fontFamily: Roboto
    fontSize: 31px
    fontWeight: 700
    lineHeight: 1.17
    letterSpacing: 0px
    textTransform: uppercase
  heading-sm:
    fontFamily: Roboto
    fontSize: 28px
    fontWeight: 700
    lineHeight: 1.17
    letterSpacing: 0px
    textTransform: uppercase
  heading-xs:
    fontFamily: Roboto
    fontSize: 23.4px
    fontWeight: 500
    lineHeight: 0.98
    letterSpacing: 0px
  body-xl:
    fontFamily: Roboto
    fontSize: 20px
    fontWeight: 500
    lineHeight: 1.17
    letterSpacing: 0px
  body-lg:
    fontFamily: Roboto
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.17
    letterSpacing: 0px
  body-lg-loose:
    fontFamily: Roboto
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.57
    letterSpacing: 0px
  body-lg-strong:
    fontFamily: Roboto
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.57
    letterSpacing: 0px
  body-lg-2:
    fontFamily: Roboto
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.17
    letterSpacing: 0px
  body-md:
    fontFamily: Roboto
    fontSize: 13px
    fontWeight: 500
    lineHeight: 1.54
    letterSpacing: 0px
  button-xl:
    fontFamily: Roboto
    fontSize: 20px
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: 0px
  button-lg:
    fontFamily: Roboto
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.19
    letterSpacing: 0px
  button-lg-tight:
    fontFamily: Roboto
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.13
    letterSpacing: 0px
  button-lg-strong:
    fontFamily: Roboto
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.17
    letterSpacing: 0px
  label-xl:
    fontFamily: Roboto
    fontSize: 20px
    fontWeight: 400
    lineHeight: 1.57
    letterSpacing: 0px
  label-lg:
    fontFamily: Roboto
    fontSize: 12.53px
    fontWeight: 500
    lineHeight: 1.17
    letterSpacing: 0px
rounded:
  none: 0px
  xs: 3px
  sm: 8px
  md: 16px
  full: 9999px
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 20px
  xl: 28px
  xxl: 32px
  xxxl: 60px
  section: 96px
  band: 132px
borderWidths:
  thin: 1px
  medium: 2px
shadows:
  sm: "rgba(177, 196, 218, 0.35) 4px 8px 30px 0px"
  md: "rgba(0, 0, 0, 0.043) 0px 2px 0px 0px"
  lg: "rgba(0, 0, 0, 0.016) 0px 2px 0px 0px"
  xl: "rgba(0, 0, 0, 0.04) 0px 0px 1px 0px, rgba(0, 0, 0, 0.04) 0px 2px 6px 0px, rgba(0, 0, 0, 0.04) 0px 10px 20px 0px"
elevationStrategy: layered-micro
themes:
  derived: dark   # the other theme is the site's measured palette
  light:
    bg: "#FFFFFF"
    surface: "#000000"
    surfaceRaised: "#000000"
    text: "#000000"
    textMuted: "#595959"
    border: "#E0E0E0"
    accent: "#0096C8"
    accentFg: "#000000"
    focusRing: "#00B5F1"
    elevation: shadow
  dark:
    bg: "#091216"
    surface: "#182024"
    surfaceRaised: "#242C30"
    text: "#F5FCFE"
    textMuted: "#9BA3A6"
    border: "#30383B"
    accent: "#00B5F1"
    accentFg: "#0B0B0C"
    focusRing: "#00B5F1"
    elevation: "border+surface"
  contrastFailures:
    - "light: text on surface = 1:1 (needs 4.5:1)"
components:
  button-primary:
    textColor: "{colors.canvas}"
    height: 51px
    padding: "8px 12px 8px 12px"
    fontSize: 20px
    boxShadow: "rgba(18, 141, 254, 0.25) 4px 4px 16px 0px"
    fontFamily: Roboto
    fontWeight: 500
    lineHeight: 1.2
    rounded: 25px
    backgroundColor: "{colors.primary}"
  button-primary-sm:
    typography: "{typography.button-lg-strong}"
    textColor: "{colors.canvas}"
    border: "1px solid {colors.primary}"
    height: 40px
    padding: "8px 15px 8px 15px"
    boxShadow: "rgba(0, 0, 0, 0.016) 0px 2px 0px 0px"
    rounded: "{rounded.sm}"
    backgroundColor: "{colors.primary}"
  button-filled:
    typography: "{typography.button-lg}"
    textColor: "{colors.canvas}"
    height: 39px
    padding: "10px 15px 10px 15px"
    boxShadow: "rgba(0, 0, 0, 0.043) 0px 2px 0px 0px"
    rounded: 30px
    backgroundColor: "{colors.accent-2}"
  button-icon:
    typography: "{typography.body-lg-loose}"
    textColor: "{colors.canvas}"
    height: 60px
    padding: "6.4px 0px 6.4px 0px"
    boxShadow: "rgba(0, 0, 0, 0.1) 0px 4px 12px 0px"
    rounded: "50%"
    backgroundColor: "{colors.accent-3}"
  card:
    typography: "{typography.body-lg-loose}"
    textColor: "{colors.accent}"
  card-sm:
    textColor: "rgba(0, 0, 0, 0.85)"
    fontSize: 14px
    fontFamily: Roboto
    fontWeight: 400
    lineHeight: 1.57
    backgroundColor: "{colors.canvas}"
  badge-text:
    typography: "{typography.body-lg-2}"
    textColor: "{colors.primary}"
    height: 36.75px
    padding: "8px 16px 8px 16px"
    boxShadow: "rgba(0, 0, 0, 0.043) 0px 2px 0px 0px"
    rounded: "{rounded.sm}"
  link:
    textColor: "{colors.accent}"
    padding: "18px 17px 16px 17px"
    fontSize: 14px
    boxShadow: "rgba(177, 196, 218, 0.35) 4px 8px 30px 0px"
    fontFamily: Roboto
    fontWeight: 400
    lineHeight: 1.57
    rounded: "{rounded.md}"
    backgroundColor: "{colors.canvas}"
  link-2:
    typography: "{typography.body-lg-loose}"
    textColor: "{colors.accent-1}"
states:
  input-hover:
    target: input
    state: hover
    borderColor: "rgb(0, 165, 236)"
    backgroundColor: "rgb(248, 250, 252)"
  other-hover:
    target: other
    state: hover
    textColor: "rgb(0, 165, 236)"
  button-hover:
    target: button
    state: hover
    textColor: "{colors.canvas}"
    backgroundColor: "rgb(253, 57, 122)"
  input-focus:
    target: input
    state: focus
    boxShadow: none
  link-hover:
    target: link
    state: hover
    textColor: "{colors.primary}"
  other-disabled:
    target: other
    state: disabled
    borderColor: currentcolor
    borderWidth: medium
    backgroundColor: gray
  other-focus:
    target: other
    state: focus
    borderColor: "rgb(17, 162, 243)"
    borderWidth: 1px
  input-focus-visible:
    target: input
    state: focus-visible
    outline: "rgb(17, 162, 243) solid 1px"
    outlineColor: "rgb(17, 162, 243)"
    outlineWidth: 1px
breakpoints:
  - width: 375
    containerWidth: 343
    gridColumns: 8
    navLinksVisible: 0
    menuToggleVisible: false
    headingPx: 20
    bodyPx: 16
    sectionPaddingX: 0
  - width: 768
    containerWidth: 503
    gridColumns: 8
    navLinksVisible: 0
    menuToggleVisible: false
    headingPx: 31
    bodyPx: 16
    sectionPaddingX: 0
  - width: 1024
    containerWidth: 1024
    gridColumns: 8
    navLinksVisible: 0
    menuToggleVisible: false
    headingPx: 36
    bodyPx: 16
    sectionPaddingX: 0
  - width: 1280
    containerWidth: 1225
    gridColumns: 8
    navLinksVisible: 0
    menuToggleVisible: false
    headingPx: 36
    bodyPx: 16
    sectionPaddingX: 0
  - width: 1440
    containerWidth: 1225
    gridColumns: 8
    navLinksVisible: 0
    menuToggleVisible: false
    headingPx: 36
    bodyPx: 16
    sectionPaddingX: 0
coverage:
  statesFound: 61
  gradientsFound: 0
  rolesUnassigned: 5
  archetypesUnnamed: 0
  archetypesDetected: 0
  responsiveMeasured: true
  stylesheetsBlocked: true
  semanticRampDeclared: true
---

```yaml
tokens:
  colors:
    primary: "#00B5F1"
    accent: "#003553"
    accent-1: "#1DA1F2"
    accent-2: "#FFB54A"
    accent-3: "#FBA342"
    accent-4: "#0352CC"
    canvas: "#FFFFFF"
    surface: "#000000"
    surface-alt: "#E8F4FD"
    on-primary: "#222222"
    neutral-1: "#D9D9D9"
    info: "#12263F"
  typography:
    heading-lg:
      font: Montserrat
      size: 36px
      weight: 700
      line-height: 1
      letter-spacing: 0px
    heading-md:
      font: Roboto
      size: 31px
      weight: 700
      line-height: 1.17
      letter-spacing: 0px
      text-transform: uppercase
    heading-xs:
      font: Roboto
      size: 23.4px
      weight: 500
      line-height: 0.98
      letter-spacing: 0px
    heading-sm:
      font: Roboto
      size: 28px
      weight: 700
      line-height: 1.17
      letter-spacing: 0px
      text-transform: uppercase
    body-lg:
      font: Roboto
      size: 16px
      weight: 400
      line-height: 1.17
      letter-spacing: 0px
    body-lg-strong:
      font: Roboto
      size: 16px
      weight: 500
      line-height: 1.57
      letter-spacing: 0px
    body-lg-loose:
      font: Roboto
      size: 16px
      weight: 400
      line-height: 1.57
      letter-spacing: 0px
    body-lg-2:
      font: Roboto
      size: 16px
      weight: 500
      line-height: 1.17
      letter-spacing: 0px
    body-xl:
      font: Roboto
      size: 20px
      weight: 500
      line-height: 1.17
      letter-spacing: 0px
    body-md:
      font: Roboto
      size: 13px
      weight: 500
      line-height: 1.54
      letter-spacing: 0px
    button-lg-strong:
      font: Roboto
      size: 16px
      weight: 600
      line-height: 1.17
      letter-spacing: 0px
    button-lg:
      font: Roboto
      size: 16px
      weight: 500
      line-height: 1.19
      letter-spacing: 0px
    button-lg-tight:
      font: Roboto
      size: 16px
      weight: 500
      line-height: 1.13
      letter-spacing: 0px
    button-xl:
      font: Roboto
      size: 20px
      weight: 400
      line-height: 1.15
      letter-spacing: 0px
    label-lg:
      font: Roboto
      size: 12.53px
      weight: 500
      line-height: 1.17
      letter-spacing: 0px
    label-xl:
      font: Roboto
      size: 20px
      weight: 400
      line-height: 1.57
      letter-spacing: 0px
  spacing:
    xxs: 4px
    xs: 8px
    sm: 12px
    md: 16px
    lg: 20px
    xl: 28px
    xxl: 32px
    xxxl: 60px
    section: 96px
    band: 132px
  rounded:
    none: 0px
    xs: 3px
    sm: 8px
    md: 16px
    full: 9999px
  shadows:
    sm: "rgba(177, 196, 218, 0.35) 4px 8px 30px 0px"
    md: "rgba(0, 0, 0, 0.043) 0px 2px 0px 0px"
    lg: "rgba(0, 0, 0, 0.016) 0px 2px 0px 0px"
    xl: "rgba(0, 0, 0, 0.04) 0px 0px 1px 0px, rgba(0, 0, 0, 0.04) 0px 2px 6px 0px, rgba(0, 0, 0, 0.04) 0px 10px 20px 0px"
  borders:
    thin: 1px
    medium: 2px
  z-index:
    dropdown: 99
    sticky: 105
```

# Design System Inspired by Medpro

## 1. Visual Theme & Atmosphere

Medpro's design system embodies a modern, trustworthy healthcare digital experience built on clarity and accessibility. The palette combines vibrant primary cyan (`{colors.primary}` — `#00B5F1`) with deep information anchors and warm accents, creating a system that feels professional yet approachable. The brand prioritizes clean typography hierarchies and generous spacing to reduce cognitive load—critical for medical decision-making interfaces. Rounded pill-shaped buttons and soft card elevations convey warmth and human-centered design, while the strategic use of color blocking through `{colors.surface-alt}` (`#E8F4FD`) creates visual rhythm without relying heavily on shadows. The system feels optimized for rapid task completion across dense healthcare information.

**Key Characteristics**

- Vibrant, trustworthy cyan primary paired with deep navy accents
- Pill-shaped interactive buttons (`{rounded.full}`) for a friendly, modern feel
- Light cyan band sections (`{colors.surface-alt}`) for visual breathing room
- Generous spacing (`{spacing.section}` = 96px sections) and layered-micro shadows
- Warm secondary accents (`#FFB54A`, `#FBA342`) used for supplementary CTAs
- Responsive typography that scales with viewport size
- Emphasis on white (`{colors.canvas}`) backgrounds for clarity and focus
- Multi-color accent palette reserved for decorative and supportive elements

## 2. Color Palette & Roles

### Primary

- **Primary Brand** (`{colors.primary}` — `#00B5F1`): Primary call-to-action buttons, active states, links, brand accent. Core interaction color for appointment booking and primary navigation.

### Accent Colors

- **Deep Accent** (`{colors.accent}` — `#003553`): Secondary accent and hero band backgrounds. Creates visual hierarchy for section breaks and informational framing.
- **Decorative Accent 1** (`{colors.accent-1}` — `#1DA1F2`): Decorative element. No measured role in component styling; use cautiously for non-critical visual flourishes.
- **Warm Accent** (`{colors.accent-2}` — `#FFB54A`): Supportive call-to-action and secondary button fills. Warm, complementary energy to the cool primary.
- **Orange Accent** (`{colors.accent-3}` — `#FBA342`): Tertiary button fills and icon buttons. Warm and inviting for secondary interactions.
- **Royal Blue Accent** (`{colors.accent-4}` — `#0352CC`): Decorative element. No measured role in component styling.

### Interactive

- **On Primary** (`{colors.on-primary}` — `#222222`): Label and text color on brand surfaces and buttons. Ensures contrast and readability.

### Neutral Scale

- **Canvas** (`{colors.canvas}` — `#FFFFFF`): Default page and card background. Primary neutral surface for content.
- **Surface** (`{colors.surface}` — `#000000`): Primary text color for headings and body copy. Provides maximum contrast against light backgrounds.
- **Surface Alt** (`{colors.surface-alt}` — `#E8F4FD`): Alternating section bands and secondary panel backgrounds. Light tint of primary for visual differentiation.
- **Neutral Border** (`{colors.neutral-1}` — `#D9D9D9`): Borders and dividers. Subtle separation without visual weight.

### Semantic

- **Info** (`{colors.info}` — `#12263F`): Informational states and secondary body text. Dark, stable color for reference content.

## 3. Typography Rules

### Font Family

**Primary:** Montserrat (https://fonts.googleapis.com/) — used for large display headings.

**Secondary:** Roboto (https://fonts.googleapis.com/) — used for body, buttons, labels, and smaller headings. Fallback: system sans-serif.

### Hierarchy

| Role | Font | Size | Weight | Line Height | Letter Spacing | Notes |
|---|---|---|---|---|---|---|
| Display / Hero | Montserrat | 36px | 700 | 1.0 | 0px | Large page titles; measured on `h1` |
| Heading Large | Roboto | 31px | 700 | 1.17 | 0px | Major section heads; uppercase; measured on `h2` |
| Heading Medium | Roboto | 28px | 700 | 1.17 | 0px | Section subheadings; uppercase; measured on heading |
| Heading Small | Roboto | 23.4px | 500 | 0.98 | 0px | Card and modal titles; measured on `h3` |
| Body Large | Roboto | 16px | 400 | 1.17 | 0px | Primary body copy; measured on `body` |
| Body Large Strong | Roboto | 16px | 500 | 1.57 | 0px | Links and emphasized text; measured on `a` |
| Body Large Loose | Roboto | 16px | 400 | 1.57 | 0px | List items and spaced body; measured on list-item |
| Body Large Bold | Roboto | 16px | 500 | 1.17 | 0px | Semi-bold body; measured on `body` |
| Body XL | Roboto | 20px | 500 | 1.17 | 0px | Large body emphasis; measured on `body` |
| Body Medium | Roboto | 13px | 500 | 1.54 | 0px | Small body copy; measured on `body` |
| Label XL | Roboto | 20px | 400 | 1.57 | 0px | Form input labels; measured on `input` |
| Label Large | Roboto | 12.53px | 500 | 1.17 | 0px | Small form labels and captions; measured on `label` |
| Button XL | Roboto | 20px | 400 | 1.15 | 0px | Large button text; measured on `button` |
| Button Large Strong | Roboto | 16px | 600 | 1.17 | 0px | Standard button text, bold weight; measured on `button` |
| Button Large | Roboto | 16px | 500 | 1.19 | 0px | Standard button text; measured on `button` |
| Button Large Tight | Roboto | 16px | 500 | 1.13 | 0px | Button text with tight line spacing; measured on `button` |

### Principles

- **Size Progression:** Display headings scale from 36px (desktop) down to 20px (mobile), maintaining visual hierarchy across breakpoints.
- **Weight Hierarchy:** 700-weight for primary headings, 500 for secondary emphasis, 400 for body. Never use weight alone to distinguish hierarchy; pair with size changes.
- **Line Height Pairing:** Larger display and body text use relaxed line heights (1.57–1.17) for readability; compact headings use 0.98–1.17 to feel present.
- **All Caps Accents:** Section headings (`heading-md`, `heading-sm`) use uppercase text transformation for visual impact and brand recognition.

## 4. Component Stylings

### Buttons

#### Primary Large

- **Background:** `{colors.primary}` (`#00B5F1`)
- **Text Color:** `#FFFFFF`
- **Font:** {typography.button-xl} — Roboto, 20px, weight 400, line-height 1.15
- **Padding:** `{spacing.xs}` `{spacing.sm}` `{spacing.xs}` `{spacing.sm}` (8px 12px 8px 12px)
- **Border Radius:** `{rounded.full}` (9999px)
- **Border:** None
- **Width:** 239px
- **Height:** 51px
- **Box Shadow:** `rgba(18, 141, 254, 0.25) 4px 4px 16px 0px`
- **Hover State:** Lift and maintain cyan with increased shadow emphasis

#### Primary Small

- **Background:** `{colors.primary}` (`#00B5F1`)
- **Text Color:** `#FFFFFF`
- **Font:** {typography.button-lg-strong} — Roboto, 16px, weight 600, line-height 1.17
- **Padding:** `{spacing.xs}` (8px) `{spacing.sm}` (15px) `{spacing.xs}` (8px) `{spacing.sm}` (15px)
- **Border Radius:** `{rounded.sm}` (8px)
- **Border:** 1px solid `{colors.primary}` (`#00B5F1`)
- **Width:** 253px
- **Height:** 40px
- **Box Shadow:** {shadows.lg} — `rgba(0, 0, 0, 0.016) 0px 2px 0px 0px`

#### Filled / Warm

- **Background:** `{colors.accent-2}` (`#FFB54A`)
- **Text Color:** `#FFFFFF`
- **Font:** {typography.body-lg-strong} — Roboto, 16px, weight 500, line-height 1.57
- **Padding:** `{spacing.xs}` (10px) `{spacing.sm}` (15px) `{spacing.xs}` (10px) `{spacing.sm}` (15px)
- **Border Radius:** `{rounded.full}` (30px)
- **Border:** None
- **Width:** 147px
- **Height:** 39px
- **Box Shadow:** {shadows.md} — `rgba(0, 0, 0, 0.043) 0px 2px 0px 0px`
- **Hover State:** Transition to `#FBA342` with elevated shadow

#### Icon Button

- **Background:** `{colors.accent-3}` (`#FBA342`)
- **Text Color:** `#FFFFFF`
- **Font:** Roboto, 16px, weight 400, line-height 1.5
- **Padding:** `{spacing.xxs}` (6.4px) 0 `{spacing.xxs}` (6.4px) 0
- **Border Radius:** `{rounded.full}` (50%)
- **Border:** 1px solid transparent
- **Width:** 60px
- **Height:** 60px
- **Box Shadow:** `rgba(0, 0, 0, 0.1) 0px 4px 12px 0px`

### Cards & Containers

#### Card Default

- **Background:** Transparent / `rgba(0, 0, 0, 0)`
- **Text Color:** `{colors.accent}` (`#003553`)
- **Font:** Roboto, 16px, weight 400, line-height 1.57
- **Border Radius:** `{rounded.none}` (0px)
- **Border:** None
- **Padding:** 0
- **Box Shadow:** None
- **Width:** 1200px
- **Height:** 432.25px

#### Card Default Small

- **Background:** `{colors.canvas}` (`#FFFFFF`)
- **Text Color:** `rgba(0, 0, 0, 0.85)`
- **Font:** Roboto, 14px, weight 400, line-height 1.45
- **Border Radius:** `{rounded.none}` (0px)
- **Border:** None
- **Padding:** 0
- **Box Shadow:** None
- **Width:** 253px
- **Height:** 360.25px

#### Elevated Card (Inferred)

- **Background:** `{colors.canvas}` (`#FFFFFF`)
- **Box Shadow:** {shadows.sm} — `rgba(177, 196, 218, 0.35) 4px 8px 30px 0px`
- **Border Radius:** `{rounded.md}` (16px)
- **Hover State:** Lift with enhanced shadow and slight translate

### Inputs & Forms

#### Text Input

- **Background:** `{colors.canvas}` (`#FFFFFF`)
- **Text Color:** `{colors.surface}` (`#000000`)
- **Font:** {typography.label-xl} — Roboto, 20px, weight 400, line-height 1.57
- **Border:** `{colors.neutral-1}` (`#D9D9D9`), `{borders.medium}` (2px)
- **Border Radius:** `{rounded.xs}` (3px)
- **Padding:** Typical form spacing
- **Hover State:** Border color → `rgb(0, 165, 236)`, background → `rgb(248, 250, 252)`
- **Focus State:** Outline `rgb(17, 162, 243)` solid 1px

#### Input Placeholder

- **Text Color:** Inferred muted gray; measured state unavailable

### Navigation

- **Primary Navigation:** Horizontal bar with links in `{colors.accent}` (`#003553`)
- **Hover State:** Links transition to primary cyan (`#00B5F1`)
- **Link Font:** {typography.body-lg-strong} — Roboto, 16px, weight 500, line-height 1.57

### Badges

#### Badge Text

- **Background:** Transparent
- **Text Color:** `{colors.primary}` (`#00B5F1`)
- **Font:** {typography.body-lg-strong} — Roboto, 16px, weight 500, line-height 1.17
- **Border:** 1px solid transparent
- **Border Radius:** `{rounded.sm}` (8px)
- **Padding:** `{spacing.xs}` `{spacing.md}` `{spacing.xs}` `{spacing.md}` (8px 16px 8px 16px)
- **Box Shadow:** {shadows.md} — `rgba(0, 0, 0, 0.043) 0px 2px 0px 0px`
- **Width:** 119px
- **Height:** 36.75px

## 5. Layout Principles

### Spacing System

**Base Unit:** `{spacing.xs}` = 8px

**Complete Scale:**
- `{spacing.xxs}` = 4px — micro spacing for inline elements, icon padding
- `{spacing.xs}` = 8px — tight component spacing (button padding)
- `{spacing.sm}` = 12px — small component gaps
- `{spacing.md}` = 16px — standard component padding and margins
- `{spacing.lg}` = 20px — medium component spacing
- `{spacing.xl}` = 28px — large section breaks
- `{spacing.xxl}` = 32px — extra large section padding
- `{spacing.xxxl}` = 60px — hero spacing
- `{spacing.section}` = 96px — major section separation (e.g., between page sections)
- `{spacing.band}` = 132px — full-width band spacing (e.g., accent background sections)

**Usage Context:** Buttons use `{spacing.xs}` / `{spacing.sm}` padding; cards and containers use `{spacing.md}` to `{spacing.lg}`; major section dividers use `{spacing.section}` for breathing room.

### Grid & Container

- **Max Width:** 1225px at 1024px+ viewports; scales to 343px at 375px mobile
- **Column Strategy:** 8-column grid across all breakpoints
- **Content Column:** Viewport-dependent (343px mobile, 503px tablet, 1024px+ desktop)
- **Section Padding Horizontal:** 0px (full-width sections with internal grid)

### Whitespace Philosophy

Whitespace is treated as a primary design element. The system uses `{spacing.section}` (96px) between major sections to create visual rest and reduce cognitive overload—essential for healthcare interfaces. Color-blocked sections (using `{colors.surface-alt}`) provide secondary visual separation without relying on borders. Internal component spacing respects the 8px base unit, ensuring consistent rhythm. Large headings paired with ample surrounding space create focal points and guide user attention.

### Border Radius Scale

- `{rounded.none}` = 0px — Cards, modals, overlays; sharp, professional form
- `{rounded.xs}` = 3px — Form inputs; subtle softness
- `{rounded.sm}` = 8px — Badges, secondary buttons; moderate softness
- `{rounded.md}` = 16px — Elevated cards and containers; balanced curve
- `{rounded.full}` = 9999px — Primary buttons, icon buttons; friendly, pill-shaped; conveys warmth and approachability

### Border Widths

- `{borders.thin}` = 1px — Input borders, badge borders; delicate visual definition
- `{borders.medium}` = 2px — Form input primary borders; clear, assertive visual boundary

## 6. Depth & Elevation

| Level | Treatment | Use |
|---|---|---|
| Flat | No shadow | Card backgrounds, modal surfaces, input fields at rest |
| Micro | {shadows.lg} `rgba(0, 0, 0, 0.016) 0px 2px 0px 0px` | Small buttons, badges; barely-there lift |
| Small | {shadows.md} `rgba(0, 0, 0, 0.043) 0px 2px 0px 0px` | Standard buttons; subtle button press effect |
| Card | {shadows.sm} `rgba(177, 196, 218, 0.35) 4px 8px 30px 0px` | Elevated cards, panels; noticeable but soft |
| Prominent | {shadows.xl} `rgba(0, 0, 0, 0.04) 0px 0px 1px 0px, rgba(0, 0, 0, 0.04) 0px 2px 6px 0px, rgba(0, 0, 0, 0.04) 0px 10px 20px 0px` | Modals, dropdowns, overlays; multi-layer depth |

**Shadow Philosophy:** The system employs a **layered-micro** elevation strategy. Rather than dramatic shadows, depth emerges from many near-transparent layers stacked subtly. This conveys approachability and trust—critical for healthcare. Color blocking through `{colors.surface-alt}` provides secondary visual separation without shadow weight. Buttons use minimal shadows (`{shadows.md}`, `{shadows.lg}`) to feel lightweight and responsive; elevated cards use a single soft shadow (`{shadows.sm}`) that suggests a floating plane without dominating the layout. Hover states introduce subtle lift (`translateY(-0.2rem)` observed in extracted interaction data) and shadow enhancement to signal interactivity.

### Opacity Levels

- **Full:** 1.0 — Primary text, buttons, interactive elements
- **Muted Hover:** 0.8 — Hover state for text and secondary elements; signals presence without changing color
- **Disabled:** 0.5 (inferred from common patterns; not explicitly extracted) — Disabled inputs and buttons; subtle communication that element is inactive

### Z-index / Layering

- **Base Content:** 0–1 — Page body, standard cards
- **Dropdown:** 10, 15, 99 — Nested dropdowns and popovers (stacked layering observed)
- **Sticky Elements:** 100, 105 — Sticky headers, floating action buttons; remain above scrolling content
- **Modal / Overlay:** 105+ — Full-screen overlays and modal dialogs; topmost layer

## 7. Do's and Don'ts

### Do

- **Use the primary cyan** (`{colors.primary}` — `#00B5F1`) for all primary call-to-actions (appointment booking, confirm actions).
- **Pair large headings with ample whitespace.** Use `{spacing.section}` (96px) between major sections to reduce cognitive load.
- **Apply pill-shaped buttons** (`{rounded.full}`) for primary interactions; they signal approachability and modern design.
- **Use color blocking** via `{colors.surface-alt}` (`#E8F4FD`) instead of lines and borders to separate content sections.
- **Maintain consistent typography scale.** Scale display headings (36px desktop → 20px mobile) and body text (16px desktop) proportionally across breakpoints.
- **Apply subtle shadows** (`{shadows.sm}`, `{shadows.md}`) to cards and elevated elements for depth without visual weight.
- **Use warm accents** (`{colors.accent-2}` — `#FFB54A`, `{colors.accent-3}` — `#FBA342`) for secondary CTAs to create visual hierarchy and draw attention to alternative actions.
- **Preserve 8px spacing baseline.** All component padding, margins, and gaps should be multiples of `{spacing.xs}` (8px).
- **Test inputs and interactive elements** for focus states using `rgb(17, 162, 243)` outline; ensure 1px solid outline on focus-visible.

### Don't

- **Do not use the deep accent** (`{colors.accent}` — `#003553`) as a primary CTA. Reserve it for hero sections and information hierarchy.
- **Do not apply heavy shadows** to small components. Buttons should use {shadows.md} or {shadows.lg}, never layered card shadows.
- **Do not mix rounded styles.** If buttons use `{rounded.full}`, inputs should use `{rounded.xs}` for consistency; do not randomize radius per component.
- **Do not over-use decorative accent colors** (`{colors.accent-1}`, `{colors.accent-4}`). They have no measured role; limit to non-critical visual elements.
- **Do not collapse the spacing scale.** Maintain `{spacing.section}` (96px) between major sections; do not reduce to single-digit multiples.
- **Do not change typography weight for color contrast.** If text is hard to read, change size or color, not weight alone.
- **Do not apply border-radius > 8px** to form inputs; keep `{rounded.xs}` (3px) for sharp, professional appearance.
- **Do not forget hover states.** Links change to primary cyan; buttons lift with enhanced shadow; inputs gain border highlight—these transitions must be smooth (CSS transition: 0.2s ease).
- **Do not assume mobile navigation is visible.** At mobile (375px), menu toggle is not visible in extracted data; all navigation likely collapsible or hidden.

## 8. Responsive Behavior

### Breakpoints

| Viewport | Content Column | Grid Columns | Nav Links Visible | Key Changes |
|---|---|---|---|---|
| 375px (Mobile) | 343px | 8 | 0 (hidden) | Display heading: 20px; body: 16px; section padding-x: 0px; single-column layout |
| 768px (Tablet) | 503px | 8 | 0 (hidden) | Display heading: 31px; body: 16px; section padding-x: 0px; wider column |
| 1024px (Desktop) | 1024px | 8 | 0 (hidden) | Display heading: 36px; body: 16px; full content width enabled |
| 1280px+ (Large Desktop) | 1225px | 8 | 0 (hidden) | Display heading: 36px; body: 16px; max-width applied; heading-lg: 36px |
| 1440px+ (XL Desktop) | 1225px | 8 | 0 (hidden) | Display heading: 36px; body: 16px; no further expansion |

**Breakpoint Strategy:** The system uses four logical breakpoints. Mobile (375px) prioritizes single-column layout with minimal padding. Tablet (768px) increases content width to 503px, accommodating two-column grids for secondary content. Desktop (1024px) expands to full-width column layout and enables primary navigation visibility. Large desktop (1280px+) caps max-width at 1225px to prevent overscan and maintain reading comfort.

### Touch Targets

- **Minimum Interactive Height:** 40px (observed on primary-sm button)
- **Minimum Interactive Width:** 40px (inferred from button padding + font size)
- **Button Padding:** `{spacing.xs}` (8px) minimum padding on all sides to ensure comfortable touch targets
- **Icon Buttons:** 60px width × 60px height (observed on icon button variant)
- **Spacing Between Targets:** `{spacing.sm}` (12px) minimum gap between adjacent interactive elements to prevent accidental activation

### Collapsing Strategy

- **Mobile (375px):** Single-column layout; navigation collapses to hidden or hamburger menu (toggle not visible in extraction); heading scales to 20px; section padding removed (0px).
- **Tablet (768px):** Content column expands to 503px; grid enables two-column layouts for cards and secondary content; heading scales to 31px; section spacing maintained.
- **Desktop (1024px+):** Content column reaches 1024px; full-width multi-column layouts enabled; heading expands to 36px; sticky navigation may be visible; full interaction density enabled.

## 9. Agent Prompt Guide

### Quick Color Reference

- **Primary CTA:** Primary (`{colors.primary}` — `#00B5F1`) — all appointment booking, confirm, and primary action buttons
- **Secondary CTA:** Warm Accent (`{colors.accent-2}` — `#FFB54A`) — alternative actions, support CTAs
- **Tertiary CTA:** Orange Accent (`{colors.accent-3}` — `#FBA342`) — icon buttons, supplementary interactions
- **Background:** Canvas (`{colors.canvas}` — `#FFFFFF`) — default page and card backgrounds
- **Section Band:** Surface Alt (`{colors.surface-alt}` — `#E8F4FD`) — alternating section backgrounds for rhythm
- **Heading Text:** Surface (`{colors.surface}` — `#000000`) — primary headings and body copy
- **Body Text:** Surface (`{colors.surface}` — `#000000`) — body copy, at full opacity
- **Label Text:** Info (`{colors.info}` — `#12263F`) — form labels, secondary reference text
- **Links:** Primary (`{colors.primary}` — `#00B5F1`) — link text; on-hover transitions darker or lifts
- **Borders:** Neutral Border (`{colors.neutral-1}` — `#D9D9D9`) — input borders, subtle dividers

### Iteration Guide

1. **Button Treatment:** All primary buttons use pill-shape (`{rounded.full}` — 9999px) with cyan background (`#00B5F1`) and minimal shadow ({shadows.md}). Secondary buttons use warm accent (`#FFB54A`) with same radius. Icon buttons stay 60px × 60px with orange fill (`#FBA342`).

2. **Typography Scaling:** Display/hero headings scale from 36px (desktop) to 20px (mobile). Body text stays 16px across all breakpoints. All headings use Montserrat or Roboto; body always Roboto. Uppercase styling applied only to section headings (heading-md, heading-sm).

3. **Spacing Baseline:** Every margin, padding, and gap is a multiple of 8px (`{spacing.xs}`). Section breaks use `{spacing.section}` (96px). Component internal padding uses `{spacing.xs}` to `{spacing.lg}`. Respect the scale—do not invent intermediate values.

4. **Color Blocking Over Borders:** Replace dividers and lines with `{colors.surface-alt}` (`#E8F4FD`) background sections. This provides visual separation without shadow or border weight and maintains the light, approachable aesthetic.

5. **Elevation Strategy:** Use {shadows.sm} (`rgba(177, 196, 218, 0.35) 4px 8px 30px 0px`) for elevated cards. Use {shadows.md} or {shadows.lg} for small buttons. Reserve {shadows.xl} for modals and dropdowns only. Never stack shadows; use one per element.

6. **Responsive Breakpoints:** Handle layout changes at 375px (mobile), 768px (tablet), 1024px (desktop). Content column grows; heading size scales; section padding adjusts. Navigation visibility toggled at desktop; assumed hidden at mobile.

7. **Focus & Hover States:** On inputs, focus-visible triggers `outline: rgb(17, 162, 243) solid 1px`. On buttons, hover lifts with subtle shadow and may darken or shift color (observed: cyan hover → accent 2 or 3). On links, hover transitions to primary cyan (`#00B5F1`) or decorative accent.

8. **Interaction Delay:** Apply smooth CSS transitions (0.2s ease) to all interactive elements. Hover states should feel responsive but not jarring; use `transform: translateY(-0.2rem)` on card hover for subtle lift.

## 10. Known Gaps

- **Interaction states for disabled elements:** Button and input `:disabled` states were partially observed (e.g., `backgroundColor: gray`, `backgroundColor: rgb(204, 204, 204)`), but comprehensive disabled-state styling across all components is incomplete.
- **Light/dark mode:** Only one theme (light) was measured. The extracted data represents the primary brand appearance; inverse themes or dark-mode behaviour are not documented.
- **Gradient fills:** No gradients or decorative mesh backgrounds were detected in the extraction. All fills are solid colors.
- **Unassigned decorative accent colors:** Five colors (`{colors.accent-1}` — `#1DA1F2`, `{colors.accent-4}` — `#0352CC`, and three supplementary accents) have no measurable component role. Their intended usage is unclear; they appear decorative or context-specific.
- **Cross-origin stylesheets:** Some stylesheets were unreadable due to CORS restrictions, potentially hiding detail on third-party components or embedded widgets.
- **Surfaces behind authentication:** Only the public-facing homepage was analyzed. Authenticated user dashboards, account settings, and protected appointment flows were not captured.
- **Animation/transition timings:** CSS transitions are observed but not quantified (e.g., `transition: 0.2s ease` is inferred, not measured). Exact animation speeds and easing functions are not documented.
- **Accessibility attributes:** ARIA labels, roles, and landmark regions were not extracted. Semantic HTML structure and a11y tree are assumed but not verified.
- **Mobile hamburger menu styling:** Navigation toggle behavior is inferred to be hidden at mobile (375px), but exact menu styles, animation, and overlay treatment are not extracted.
- **Print styles:** No print-specific CSS was detected or analyzed.
- **Component state transitions:** Micro-interactions, loading states, error handling, and success confirmations are not represented in the token set.