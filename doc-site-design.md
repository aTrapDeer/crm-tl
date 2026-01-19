# Taylor Leonard Corp - Site Design System

This document outlines the complete design system for the Taylor Leonard Corp website to enable consistent replication across the CRM version.

---

## Color Palette

### Primary Colors (Navy Theme)

| Name | Hex | Usage |
|------|-----|-------|
| **Primary Navy** | `#01224F` | Main backgrounds, nav, footer, primary buttons |
| **Deep Blue** | `#043271` | Section backgrounds, gradients (navy-light) |
| **Mid Blue** | `#0D3E8D` | Icon accents, hover states |
| **Royal Blue** | `#1F4FAA` | Borders, highlights, links, secondary buttons |

### Accent Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Accent Cyan** | `#01B7E7` | CTA accents, hover effects (use sparingly) |
| **Soft Teal** | `#7BA8B3` | Background tints, dividers, subtle UI |
| **Off-White** | `#F7F8FB` | Page backgrounds, light sections |

### UI Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Blue 500** | `#3b82f6` | Primary action buttons, links |
| **Blue 600** | `#2563eb` | Button hover states |
| **Slate 300** | `#cbd5e1` | Body text on dark backgrounds |
| **Slate 400** | `#94a3b8` | Secondary text, labels |
| **White** | `#ffffff` | Primary text on dark backgrounds |

### Tailwind Custom Colors (tailwind.config.ts)

```typescript
colors: {
  navy: {
    DEFAULT: "#01224F",
    light: "#043271",
    mid: "#0D3E8D",
    royal: "#1F4FAA",
  },
  cyan: {
    accent: "#01B7E7",
  },
  teal: {
    soft: "#7BA8B3",
  },
  offwhite: "#F7F8FB",
}
```

---

## Typography

### Font Family

**Primary Font:** Inter (Google Fonts)

```css
font-family: "Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
font-feature-settings: "cv02", "cv03", "cv04", "cv11";
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
```

### Font Weights

| Weight | Value | Usage |
|--------|-------|-------|
| Thin | 100 | Large hero headings (display) |
| Extra Light | 200 | Secondary hero text |
| Light | 300 | Body text, descriptions |
| Regular | 400 | Standard body text |
| Medium | 500 | Labels, navigation |
| Semi Bold | 600 | Subheadings |
| Bold | 700 | Headings, CTAs |

### Text Sizes (Responsive)

#### Hero Headings
- Mobile: `text-4xl` (2.25rem)
- Tablet: `text-5xl` (3rem)
- Desktop: `text-6xl` to `text-7xl` (3.75rem - 4.5rem)

#### Section Headings
- Mobile: `text-3xl` (1.875rem)
- Desktop: `text-4xl` to `text-5xl` (2.25rem - 3rem)

#### Body Text
- Mobile: `text-sm` to `text-base` (0.875rem - 1rem)
- Desktop: `text-lg` to `text-xl` (1.125rem - 1.25rem)

#### Small Text / Labels
- `text-xs` to `text-sm` (0.75rem - 0.875rem)

---

## Spacing System

### Section Padding
- Mobile: `py-16` to `py-20` (4rem - 5rem)
- Desktop: `py-24` to `py-32` (6rem - 8rem)

### Container
- Max width: `1400px` (2xl breakpoint)
- Horizontal padding: `px-4` (1rem)
- Center aligned with `container mx-auto`

### Component Spacing
- Card padding: `p-4` to `p-8` (responsive)
- Button padding: `px-6 py-3` (mobile) to `px-16 py-6` (desktop)
- Gap between items: `gap-4` to `gap-8` (responsive)

---

## Components

### Buttons

#### Primary Button
```css
bg-blue-500 hover:bg-blue-600 text-white
rounded-full font-medium shadow-2xl
hover:shadow-blue-500/25
transition-all duration-500 hover:scale-105
```

Sizes:
- Small: `px-4 py-2 text-sm`
- Medium: `px-6 py-3 text-base`
- Large: `px-12 py-5 text-lg` to `px-16 py-6 text-xl`

#### Outline Button
```css
border-white/30 text-white
hover:bg-white hover:text-navy
bg-transparent backdrop-blur-sm
rounded-full font-medium
transition-all duration-500 hover:scale-105
```

### Cards

#### Stats Card
```css
bg-gradient-to-br from-navy-light to-navy
rounded-3xl shadow-2xl
hover:shadow-cyan-accent/20
border border-navy-royal/30
transition-all duration-700
group-hover:scale-110 group-hover:-translate-y-4
```

#### Service Card
```css
bg-navy rounded-3xl
shadow-2xl hover:shadow-cyan-accent/20
border border-navy-royal/30
overflow-hidden
group-hover:scale-105
transition-all duration-700
```

### Badges
```css
bg-navy-royal/30 text-blue-200
border-navy-royal/50
backdrop-blur-sm font-medium
px-3 py-1.5 (mobile) to px-8 py-3 (desktop)
```

---

## Gradients

### Background Gradients

#### Hero/Section Dark
```css
bg-gradient-to-br from-navy via-navy-light to-navy
```

#### Section Transitions
```css
bg-gradient-to-b from-navy to-navy-light
bg-gradient-to-b from-navy-light to-navy
```

#### Card Backgrounds
```css
bg-gradient-to-br from-navy-light to-navy
bg-gradient-to-br from-navy-light/50 to-navy/50
```

#### Overlay Gradients
```css
bg-gradient-to-t from-navy via-navy/50 to-transparent
```

### Accent Gradients
```css
bg-gradient-to-r from-blue-500 to-blue-600
```

---

## Effects & Animations

### Shadows

#### Standard Shadow
```css
shadow-2xl
```

#### Hover Glow
```css
hover:shadow-cyan-accent/20
hover:shadow-blue-500/25
```

### Transitions
```css
transition-all duration-500    /* Standard */
transition-all duration-700    /* Cards, larger elements */
transition-all duration-1000   /* Hero elements, images */
```

### Hover Effects

#### Scale
```css
hover:scale-105    /* Buttons, cards */
hover:scale-110    /* Stats cards */
hover:scale-125    /* Icons */
```

#### Translate
```css
group-hover:-translate-y-4    /* Cards lift */
group-hover:translate-x-2     /* Arrows, links */
```

### Custom Animations

#### Bounce (Scroll Indicator)
```css
animate-bounce
```

#### Zoom on Scroll (Intersection Observer)
```javascript
// Scale from 0.8 to 1.0 based on viewport intersection
const scale = 0.8 + ratio * 0.2
const translateY = (1 - ratio) * 50
const opacity = Math.min(ratio * 2, 1)
```

---

## Layout Patterns

### Header
- Fixed position, full width
- Transparent on homepage (scrolls to navy/90 with blur)
- Solid navy/95 on other pages
- Height: `h-20` (5rem)
- Hide on scroll down, show on scroll up

```css
fixed top-0 w-full z-50
transition-all duration-500
bg-navy/90 backdrop-blur-xl
border-b border-white/10 shadow-2xl
```

### Hero Section
- Full viewport height: `h-screen`
- Centered content with `flex items-center justify-center`
- Video background with overlay
- Parallax scroll effect on content

### Content Sections
- Alternating gradients (navy ↔ navy-light)
- Centered container with max-width
- Grid layouts: 2-column or 3-column on desktop
- Stack on mobile

### Footer
- Navy background
- Multi-column grid layout
- Border dividers using `border-navy-light`

---

## Responsive Breakpoints

| Breakpoint | Size | Prefix |
|------------|------|--------|
| Mobile | < 640px | (default) |
| Small | ≥ 640px | `sm:` |
| Medium | ≥ 768px | `md:` |
| Large | ≥ 1024px | `lg:` |
| Extra Large | ≥ 1280px | `xl:` |
| 2XL | ≥ 1536px | `2xl:` |

### Mobile-First Approach
- Stack layouts vertically on mobile
- Hide non-essential elements (e.g., scroll indicator)
- Reduce padding and font sizes
- Full-width buttons on mobile

---

## Scrollbar Styling

```css
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #01224F; /* navy */
}

::-webkit-scrollbar-thumb {
  background: linear-gradient(to bottom, #1F4FAA, #043271);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(to bottom, #01B7E7, #1F4FAA);
}
```

---

## Icon System

**Library:** Lucide React

Common icons used:
- Navigation: `Menu`, `ChevronDown`, `ArrowRight`, `ArrowLeft`
- Contact: `Phone`, `Mail`, `MapPin`, `Clock`
- Features: `Award`, `Shield`, `Building`, `Users`, `Calendar`
- Actions: `CheckCircle`, `X`, `Upload`

Icon sizes (responsive):
- Small: `h-4 w-4` to `h-5 w-5`
- Medium: `h-6 w-6` to `h-8 w-8`
- Large: `h-12 w-12` to `h-16 w-16` (in circular backgrounds)

---

## Glass Morphism Effects

```css
.glass {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.glass-dark {
  background: rgba(0, 0, 0, 0.3);
  backdrop-filter: blur(20px);
  border: 1px solid rgba(255, 255, 255, 0.1);
}
```

Common usage:
```css
backdrop-blur-sm    /* Light blur */
backdrop-blur-xl    /* Heavy blur - headers, modals */
```

---

## Accessibility

### Focus States
```css
.focus-visible:focus {
  outline: none;
  ring: 2px;
  ring-color: blue-500;
  ring-offset: 2px;
  ring-offset-color: black;
}
```

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.001ms !important;
    transition-duration: 0.001ms !important;
    scroll-behavior: auto !important;
  }
}
```

### Touch Devices
- Disable heavy hover effects on touch devices
- Larger tap targets (min 44px)
- `-webkit-tap-highlight-color: transparent`

---

## Brand Assets

### Logo Files
- Full logo: `/images/Logos/JasonLeonardLogo.png`
- Icon only: `/images/Logos/NoTextLogoFIXED.png`

### Logo Sizing
- Header: `w-10 h-10` to `w-12 h-12`
- Hero: `max-w-[65%]` (mobile) to `max-w-full` (desktop)
- Footer: `w-10 h-10`

---

## Key Design Principles

1. **Navy-First Color Scheme** - Trustworthy, professional, not harsh black
2. **Generous Whitespace** - Large section padding, breathing room
3. **Smooth Animations** - 500-700ms transitions, scale/translate effects
4. **Mobile Responsive** - Stack layouts, hide non-essential elements
5. **Accessible** - Focus states, reduced motion support, semantic HTML
6. **Consistent Rounded Corners** - `rounded-full` for buttons, `rounded-3xl` for cards
7. **Gradient Depth** - Subtle gradients for visual hierarchy
8. **Glass Morphism** - Blur effects for overlays and headers
