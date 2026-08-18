# UI Redesign — shadcn Components & Typography

**Date:** 2026-08-18
**Status:** Approved design
**Scope:** Whole app, one pass — login, header, search, student profile (all tabs), admin pages.

## Goal

Make the app look professional, premium, and minimal using **default shadcn/ui components** and the **shadcn typography** scale. Keep the existing layout structure and behavior; this is a visual/component pass, not a rearchitecture.

## Visual Direction

- **Palette:** Keep the current `neutral` oklch tokens (light + dark). No accent color.
- **Typography:** Geist only (current `--font-sans`). Refined type scale using shadcn typography conventions:
  - Page title: `text-3xl font-semibold tracking-tight` (occasionally `text-4xl`)
  - Section head: `text-lg font-medium tracking-tight`
  - Body/lead: `text-sm` / `text-base text-muted-foreground`
  - Meta/caption: `text-sm text-muted-foreground`
  - Eyebrow: `text-xs font-medium uppercase tracking-wider text-muted-foreground`
- **Spacing:** consistent page container `mx-auto w-full max-w-5xl px-6 py-10`; `gap-6`/`gap-8` rhythm between sections.
- **Border polish:** lighten `--border` slightly in light mode (`oklch(0.922 0 0)` → `oklch(0.93 0 0)`); `ring` focus unchanged.

## Sections

### 1. Login
- Centered `Card` in `max-w-sm mx-auto` on the page background.
- Eyebrow: "UNIVERSITY INFO RETRIEVAL".
- Heading `text-3xl tracking-tight`: "Sign in".
- Muted lead line.
- Labeled `Input` fields (email, password).
- Full-width primary `Button`.
- Error as muted destructive text.

### 2. Header
- `h-16` bar, `border-b`.
- Left: wordmark "University Info Retrieval" — `font-semibold tracking-tight`.
- Right: `ThemeToggle` + `Avatar` (initials from email) with `DropdownMenu` for "Sign out".

### 3. Search
- Eyebrow + `text-3xl tracking-tight` title "Find a student" + lead line.
- Large search `Input` (relative wrapper with `lucide` search icon), `text-base`.
- Empty/loading/no-results: centered muted lead text with spacing.
- `ResultCard`: default `Card`, `hover:bg-muted/50` transition, name `font-medium`, "PNR · roll" as `text-sm text-muted-foreground`, right chevron.
- "Load more": outline `Button`.

### 4. Student profile
- Header: name `text-3xl tracking-tight`; "PNR · roll" muted `text-sm` below.
- shadcn `Tabs`/`TabsList` (already installed) with refined typography.
- Detail rows (Personal/Admission): definition list — `text-muted-foreground` labels, right-aligned values, `py-2` rows with `border-b` separators.
- Tables (Academic/Attendance/Fees/Documents): `Card`-wrapped, default shadcn `Table`, `Badge` variants (Pass/Paid=`secondary`, Fail/Unpaid=`outline`), numeric right-align for marks/amounts, INR formatting unchanged.

### 5. Admin
- Dashboard: title + lead, action grid of `Card` links (Add student / Add course / Add department / Edit student) each with icon, title, description, arrow on hover.
- Forms: `Card`-wrapped sections, `Label` + `Input`/`Select` in `sm:grid-cols-2` grid (existing structure kept), refined spacing, submit `Button` row.

## Components

- Reuse installed: `button`, `input`, `label`, `card`, `tabs`, `table`, `badge`, `separator`, `dropdown-menu`, `skeleton`, `select`, `switch`, `dialog`, `tooltip`, `breadcrumb`, `avatar` (already installed), `sheet`, `sidebar`.
- Install if needed: none required — `avatar` already present. `lucide-react` icons already used.
- No new layout blocks (no sidebar overhaul, no login-02 cover image).

## Non-Goals

- No changes to routing, data flow, API routes, or auth.
- No new pages or features.
- No rearchitecture of components; visual pass only.
- No accent/brand color.