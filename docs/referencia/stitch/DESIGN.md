---
name: Atelier Stock
colors:
  surface: '#f9f9f7'
  surface-dim: '#dadad8'
  surface-bright: '#f9f9f7'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f4f2'
  surface-container: '#eeeeec'
  surface-container-high: '#e8e8e6'
  surface-container-highest: '#e2e3e1'
  on-surface: '#1a1c1b'
  on-surface-variant: '#4d4540'
  inverse-surface: '#2f3130'
  inverse-on-surface: '#f1f1ef'
  outline: '#7e7570'
  outline-variant: '#d0c4be'
  surface-tint: '#625d5b'
  primary: '#000000'
  on-primary: '#ffffff'
  primary-container: '#1e1b19'
  on-primary-container: '#888380'
  inverse-primary: '#ccc5c2'
  secondary: '#775a00'
  on-secondary: '#ffffff'
  secondary-container: '#fece57'
  on-secondary-container: '#735700'
  tertiary: '#000000'
  on-tertiary: '#ffffff'
  tertiary-container: '#002115'
  on-tertiary-container: '#339471'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e9e1dd'
  primary-fixed-dim: '#ccc5c2'
  on-primary-fixed: '#1e1b19'
  on-primary-fixed-variant: '#4a4643'
  secondary-fixed: '#ffdf98'
  secondary-fixed-dim: '#eec14b'
  on-secondary-fixed: '#251a00'
  on-secondary-fixed-variant: '#5a4300'
  tertiary-fixed: '#97f5cc'
  tertiary-fixed-dim: '#7bd8b1'
  on-tertiary-fixed: '#002115'
  on-tertiary-fixed-variant: '#00513a'
  background: '#f9f9f7'
  on-background: '#1a1c1b'
  surface-variant: '#e2e3e1'
typography:
  display-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 3rem
    fontWeight: '700'
    lineHeight: 3.5rem
    letterSpacing: -0.025em
  display-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 2.25rem
    fontWeight: '700'
    lineHeight: 2.75rem
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 2rem
    fontWeight: '600'
    lineHeight: 2.5rem
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.5rem
    fontWeight: '600'
    lineHeight: 2rem
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 1.25rem
    fontWeight: '600'
    lineHeight: 1.75rem
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 1rem
    fontWeight: '400'
    lineHeight: 1.5rem
    letterSpacing: 0em
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.875rem
    fontWeight: '400'
    lineHeight: 1.25rem
    letterSpacing: 0em
  label-numeric:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.875rem
    fontWeight: '600'
    lineHeight: 1.25rem
    letterSpacing: 0.02em
  label-caps:
    fontFamily: Plus Jakarta Sans
    fontSize: 0.6875rem
    fontWeight: '700'
    lineHeight: 1rem
    letterSpacing: 0.08em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  space-2xs: 0.25rem
  space-xs: 0.5rem
  space-sm: 0.75rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
  space-2xl: 3rem
  container-max: 80rem
  gutter-desktop: 1.5rem
  gutter-mobile: 1rem
---

## Brand & Style
The design system delivers an editorial, high-touch operational experience engineered specifically for high-end salons, hair spas, and boutique aesthetic clinics. It merges the tactile elegance of luxury beauty packaging with the rigorous precision required for fractional inventory tracking (grams of decolorant, milliliters of developer, single-dose ampoules).

### Aesthetic Direction
- **Minimalist Editorial Precision**: Sparse, intentional layouts balanced by warm architectural neutrals, hairline dividing borders, and quiet typography.
- **Utilitarian Luxury**: Operational software does not need to feel clinical or cold. Every touchpoint conveys the calm, curated atmosphere of a front-of-house salon while providing the speed and error-prevention required backstage in the color dispensary.
- **Emotional Resonance**: Confidence, clarity, prestige, and discretion. Stylists and salon managers feel like master craftspeople using refined tools rather than warehouse workers auditing logistics.

## Colors
The color architecture relies on high-contrast, warm-tinted foundational tones paired with restrained metallic accents and purposeful status markers.

### Palette Architecture
- **Primary (`#1C1917` - Deep Espresso Charcoal)**: Replaces harsh pure black with a warm, grounding dark stone. Used for primary text, active selection frames, high-impact actionable buttons, and focal typography.
- **Brand Accent / Secondary (`#C59B27` - Warm Champagne Ochre)**: A sophisticated, muted gold leaf that elevates key metrics, brand stamps, focus rings, and primary promotional triggers without introducing garishness.
- **Tertiary / Success (`#047857` - Refined Sage Emerald)**: Conveys balanced operational states—received batches, verified shipments, reconciled counts, and healthy shelf-life margins.
- **Neutral Canvas (`#FBFBF9` - Warm Cream Alabaster)**: A soft, paper-like background that prevents screen glare in brightly lit salon mirror environments. Complemented by elevated pure white surfaces (`#FFFFFF`) and hairline warm gray borders (`#E7E5E4`).

### Functional Status System
- **Stock Alert / Bajo Mínimo (`#D97706` / `#B45309`)**: Warm amber warning indicating safety stock depletion.
- **In Transit / Pedido Enviado (`#4F46E5` / `#3730A3`)**: Slate violet for inbound distributor consignments.
- **Shrinkage / Merma / Critical Loss (`#DC2626`)**: Crisp carmine for spilled formulations, damaged packaging, or variance spikes.

## Typography
Plus Jakarta Sans provides geometric modernity, open counters, and high legibility across dense tablet grids and mobile quick-scan sessions.

### Rules & Application
- **Tabular Figures for Inventory**: For all quantitative data (ml, g, units, price, SKU), the design system enforces `font-feature-settings: "tnum" 1` to ensure perfect column alignment during rapid stocktake audits.
- **Labels & Micro-data**: The `label-caps` style is used strictly for branch badges, categorical pill identifiers, SKU prefixes, and table headers. It must always be set in uppercase with intentional letter-spacing (`0.08em`).
- **Hierarchy Separation**: Bold weights (`600` and `700`) are reserved for structural anchors and numerical totals, keeping standard explanatory text in crisp regular weight (`400`) to prevent visual noise.

## Layout & Spacing
The layout employs an 8pt architectural rhythm aligned to an adaptive grid.

### Layout Mechanics
- **Desktop (1024px and above)**: 12-column fluid grid contained within a `80rem` (1280px) maximum wrapper with a persistent `16rem` left navigation rail for multi-branch switching and fast dispensary mode toggling. Gutters are locked at `1.5rem`.
- **Tablet / Dispensary iPad (768px - 1023px)**: 8-column layout. Left navigation collapses into an anchored top utility bar featuring active branch indicators and quick-barcode scanning affordances.
- **Mobile (below 768px)**: 4-column layout with pinned bottom navigation bar for high-frequency floor operations (Deduct, Scan, Lookup). Gutters tighten to `1rem`.

### Density Density Zones
- **High-Density (Dispensary Lab)**: Data tables and quick-consumption steppers use compact row heights (`2.5rem` / 40px) with `space-xs` and `space-sm` padding for immediate formula assembly without scrolling.
- **Low-Density (Executive Overview)**: Analytics summaries, branch comparative cards, and executive dashboards leverage `space-lg` and `space-xl` breathing room to maintain the brand's boutique editorial clarity.

## Elevation & Depth
Depth in this design system is created via layered tonal contrast and warm ambient shadowing, avoiding aggressive synthetic drop shadows.

### Elevation Levels
- **Base (Level 0)**: Background canvas (`#FBFBF9`). Completely flat, establishing the warm tactile canvas.
- **Surface (Level 1)**: Primary cards and data tables (`#FFFFFF`). Outlined with a hairline border (`1px solid #E7E5E4`) to hold structural form under daylight salon conditions. No shadow.
- **Floating Operational (Level 2)**: Active popovers, branch selection drawers, and filter bars (`#FFFFFF`). Elevated with a soft, diffused ambient shadow: `0 4px 20px -2px rgba(28, 25, 23, 0.05), 0 2px 6px -1px rgba(28, 25, 23, 0.03)`.
- **Modal & Critical Overlays (Level 3)**: Formula calculation sheets, emergency shrinkage prompts, and stock adjustments. Employs `0 20px 40px -8px rgba(28, 25, 23, 0.12)` over a warm backdrop blur overlay (`rgba(28, 25, 23, 0.35)` with `backdrop-filter: blur(4px)`).

## Shapes
A disciplined "Soft" curvature philosophy (`roundedness: 1`) provides tailored, architectural corners that reflect upscale cosmetic containers rather than generic software bubbles.

### Geometry Guidelines
- **Core Elements (Inputs, Buttons, Cards)**: Standard corner radius of `0.375rem` (6px) to `0.5rem` (8px). Delivers a crisp, precision-machined edge.
- **Status Pills & Branch Selectors**: Rounded full (`9999px`) reserved solely for contextual chips, branch identifiers, and operational state tags to differentiate them instantly from actionable buttons and cards.
- **Interactive Steppers & Quantity Adjusters**: Segmented button groups retain crisp internal intersections (`0px` on shared borders) framed within a unified `0.375rem` perimeter.

## Components

### Buttons & Quick Actions
- **Primary CTA**: Deep espresso `#1C1917` background with pure white `#FFFFFF` text. Height `2.5rem` (40px) or `2.75rem` (44px on touch screens). Subtle transition on hover to `#292524`.
- **Secondary / Ghost**: Hairline border (`#E7E5E4`) on transparent or white fill, with dark stone typography. Focus ring: `2px solid #C59B27` with a 2px offset.
- **Champagne Highlight Action**: Muted gold `#C59B27` background with `#FFFFFF` text, reserved for critical conversion actions such as "Cerrar Inventario", "Crear Orden de Compra", and "Aceptar Fórmula".

### Fractional Formulation Steppers (ml & g Inputs)
- Designed specifically for messy backstage usage. Large, touch-friendly subtraction (`-`) and addition (`+`) flanking buttons around a high-contrast center display with tabular figures.
- Micro-presets (+5g, +10g, +30g, +60g) sit directly below the numeric input for single-tap mixing adjustments when formulating bleach, toners, and treatments.

### Branch Indicator & Persistent Location Pill
- Positioned in the persistent header: an encapsulated pill (`rounded-full`) showing a warm gold location icon, the active salon name (e.g., *Atelier Recoleta*), and a subtle dropdown chevron.
- Employs a hairline champagne border (`1px solid rgba(197, 155, 39, 0.3)`) over `#FBFBF9` to reinforce multi-location awareness and avoid accidental cross-salon deductions.

### Status Chips & Badges
- Strict uppercase micro-labels (`label-caps`) within a `rounded-full` contour with 15% opacity tint backgrounds and solid text:
  - **Bajo Mínimo**: Amber background (`#FEF3C7`), text (`#B45309`).
  - **Recibido / Óptimo**: Sage background (`#D1FAE5`), text (`#047857`).
  - **En Tránsito**: Indigo background (`#EEF2FF`), text (`#4338CA`).
  - **Merma / Rotura**: Crimson background (`#FEE2E2`), text (`#B91C1C`).

### Responsive Data Tables & Card Lists
- **Desktop Tables**: Borderless rows separated by `1px solid #F5F5F4` dividers. Headers use `label-caps` in stone gray (`#78716C`). Row hover produces an immediate subtle highlight (`#FBFBF9`). Numeric columns right-aligned with forced tabular figures.
- **Mobile Inventory Cards**: Automatically transforms tables into stacked cards on mobile viewports. Each card features the product line image thumbnail (48x48px), brand name, remaining fractional volume bar (e.g., 420ml / 500ml), and a single-tap "Descontar" drawer trigger.