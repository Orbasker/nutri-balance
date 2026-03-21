# NutriBalance Design System

**Source**: [Stitch Project — Log Intake](https://stitch.withgoogle.com/projects/6185934827282531646)
**Device**: Mobile-first (390px)
**Color Mode**: Light
**Roundness**: Round 8

---

## Creative North Star: "The Clinical Sanctuary"

Medical and dietary tracking often feels punitive or cluttered. This design system rejects the "spreadsheet" aesthetic in favor of a high-end editorial experience that feels both authoritative and breathing. We use **Tonal Layering** and **Intentional Asymmetry** — expansive white space and overlapping elements to create calm and precision.

---

## Screens

| Screen            | ID                                 | Dimensions |
| ----------------- | ---------------------------------- | ---------- |
| Home Dashboard    | `3739171132f84ab080bb266bb8ccd238` | 390 x 1336 |
| Food Search       | `4287f51612d04727a83f0a30dff81787` | 390 x 1207 |
| Log Intake        | `99793c6555704f2da47a151455c9e4f3` | 390 x 1218 |
| Food Details      | `bfd47720b68649aa9f5a1c1d7d040acd` | 390 x 1460 |
| Daily Summary     | `8f2b2cb8325d45a3afa67340aefcb4b3` | 390 x 1772 |
| User Settings     | `76d761ddb7fd45c291716dfc4e00d40a` | 390 x 1695 |
| Missing Food Flow | `2022b884ef544a50b1e403d2aef351cb` | 390 x 1720 |

---

## Color Palette

### Primary

| Token                  | Hex       | Usage                                        |
| ---------------------- | --------- | -------------------------------------------- |
| `primary`              | `#004493` | Main actions, active states                  |
| `primary_container`    | `#005bc0` | Gradient endpoint, elevated primary surfaces |
| `primary_fixed`        | `#d8e2ff` | Soft callout backgrounds                     |
| `primary_fixed_dim`    | `#adc6ff` | Muted primary accents                        |
| `on_primary`           | `#ffffff` | Text/icons on primary                        |
| `on_primary_container` | `#c9d8ff` | Text on primary containers                   |
| `on_primary_fixed`     | `#001a41` | Text on fixed primary surfaces               |

### Secondary (Purple — Caution state)

| Token                 | Hex       | Usage                    |
| --------------------- | --------- | ------------------------ |
| `secondary`           | `#4c4aca` | Caution indicators       |
| `secondary_container` | `#6664e4` | Caution card backgrounds |
| `secondary_fixed`     | `#e2dfff` | Soft caution callouts    |
| `on_secondary`        | `#ffffff` | Text on secondary        |

### Tertiary (Green — Safe/Goal Met state)

| Token                | Hex       | Usage                 |
| -------------------- | --------- | --------------------- |
| `tertiary`           | `#00531c` | Safe status, goal met |
| `tertiary_container` | `#006e28` | Safe card backgrounds |
| `tertiary_fixed`     | `#72fe88` | Bright safe accents   |
| `on_tertiary`        | `#ffffff` | Text on tertiary      |

### Error (Red — Exceeded state)

| Token             | Hex       | Usage                   |
| ----------------- | --------- | ----------------------- |
| `error`           | `#ba1a1a` | Exceeded limits, errors |
| `error_container` | `#ffdad6` | Error card backgrounds  |
| `on_error`        | `#ffffff` | Text on error           |

### Surface & Neutral

| Token                       | Hex       | Usage                             |
| --------------------------- | --------- | --------------------------------- |
| `background` / `surface`    | `#faf9fe` | Base page background              |
| `surface_container_low`     | `#f4f3f8` | Secondary content areas           |
| `surface_container`         | `#eeedf3` | Section backgrounds               |
| `surface_container_high`    | `#e9e7ed` | Track backgrounds, pressed states |
| `surface_container_highest` | `#e3e2e7` | Overlays, modals                  |
| `surface_container_lowest`  | `#ffffff` | Interactive cards                 |
| `surface_dim`               | `#dad9df` | Dark mode base (avoid pure black) |
| `on_surface`                | `#1a1b1f` | Primary text                      |
| `on_surface_variant`        | `#414750` | Secondary text, labels            |
| `outline`                   | `#717782` | Supporting detail text, borders   |
| `outline_variant`           | `#c1c7d2` | Ghost borders (15% opacity only)  |
| `inverse_surface`           | `#2f3034` | Inverse containers                |
| `inverse_on_surface`        | `#f1f0f5` | Text on inverse                   |
| `inverse_primary`           | `#adc6ff` | Primary on inverse                |

---

## Typography

Dual sans-serif pairing for clinical authority + high readability.

| Role                | Font        | Usage                                                |
| ------------------- | ----------- | ---------------------------------------------------- |
| Display & Headlines | **Manrope** | High-impact data points, status labels, hero numbers |
| Body & Labels       | **Inter**   | Dietary logs, form labels, supporting text           |

### Editorial Hierarchy

| Level                         | Style        | Color Token          |
| ----------------------------- | ------------ | -------------------- |
| Primary Data (hero number)    | `display-md` | `primary`            |
| Secondary Context (unit)      | `title-sm`   | `on_surface_variant` |
| Supporting Detail (timestamp) | `body-sm`    | `outline`            |

---

## Surface Philosophy

### The "No-Line" Rule

**1px solid borders are strictly prohibited for sectioning.** Structural separation must be achieved through background color shifts:

- Card (`surface_container_lowest`) sits on `surface_container_low`
- Sections defined by transition from `surface` to `surface_container`

### Surface Nesting Stack

```
Base:               surface (#faf9fe)
Secondary content:  surface_container_low (#f4f3f8)
Interactive cards:  surface_container_lowest (#ffffff)
Overlays/Modals:    surface_container_highest (#e3e2e7)
```

### The "Glass & Gradient" Rule

- **Hero elements** (daily nutrient summaries): Linear gradient from `primary` (#004493) to `primary_container` (#005bc0) at 135deg
- **Floating nav/top bars**: `surface` at 70% opacity + `20px` backdrop-blur ("frosted glass")

---

## Elevation & Depth

- **Static cards**: No shadows. Use surface nesting (card on contrasting background).
- **Active states / FABs**: Multi-layered tinted shadow: `0px 10px 30px rgba(0, 68, 147, 0.06)`
- **Ghost Border fallback** (accessibility): `outline_variant` at **15% opacity only**. Never 100% opaque.

---

## Signature Components

### Progress Bars (Nutrient Tracks)

- **Track**: `surface_container_high`, fully rounded
- **Indicator**: `primary` (default) — transitions to:
  - `tertiary` (green) = Safe / Goal Met
  - `secondary` (purple) = Caution
  - `error` (red) = Exceeded
- **Enhancement**: Subtle inner-glow on indicator for "liquid" feel

### Status Badges & Confidence Indicators

- Small, fully rounded containers using "Fixed" tokens (e.g., `tertiary_fixed` bg + `on_tertiary_fixed` text)
- **Confidence dots**: 3-dot pulse system
  - High = 3 dots in `primary`
  - Low = 1 dot in `outline`

### Interactive Cards

- **No divider lines.** Separate content with `spacing-4` (1rem) or `spacing-6` (1.5rem) vertical gaps
- **Active state**: Scale to 98%, transition from `surface_container_lowest` to `surface_container_high`

### Input Fields

- "Bottom-line only" or "Soft Fill" — no four-sided boxes
- **Focus**: Label animates to `label-sm`, bottom border expands from `outline_variant` to `primary` (2px)

---

## Spacing Scale

Base spacing scale factor: **2**

| Token        | Value          |
| ------------ | -------------- |
| `spacing-1`  | 0.25rem (4px)  |
| `spacing-2`  | 0.5rem (8px)   |
| `spacing-3`  | 0.75rem (12px) |
| `spacing-4`  | 1rem (16px)    |
| `spacing-6`  | 1.5rem (24px)  |
| `spacing-8`  | 2rem (32px)    |
| `spacing-12` | 3rem (48px)    |

---

## Do's and Don'ts

### Do

- **Use Asymmetry**: Place "Daily Total" headline off-center for modern editorial rhythm
- **Embrace Negative Space**: If a screen feels "empty," it's working. Use `spacing-12` (3rem) between major modules
- **Tone-on-Tone**: Use `primary_container` text on `primary_fixed` backgrounds for soft callouts

### Don't

- **Don't use black**: For dark mode, use `surface_dim` + `on_surface`. Pure `#000000` kills the Sanctuary vibe
- **Don't use standard icons**: Use light-weight (100-200) stroke icons to match refined typography
- **Don't use hard corners**: Every element uses the roundedness scale. Minimum `sm` (0.25rem) even for tooltips

---

## Status-to-Color Mapping (App-Specific)

| Status   | Threshold        | Color System                |
| -------- | ---------------- | --------------------------- |
| Safe     | < 80% of limit   | `tertiary` family (green)   |
| Caution  | 80–100% of limit | `secondary` family (purple) |
| Exceeded | > 100% of limit  | `error` family (red)        |

| Confidence | Range  | Visual            |
| ---------- | ------ | ----------------- |
| High       | 90–100 | 3 dots, `primary` |
| Good       | 80–89  | 2 dots, `primary` |
| Moderate   | 60–79  | 2 dots, `outline` |
| Low        | < 60   | 1 dot, `outline`  |
