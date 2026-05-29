# UI/UX Revamp Plan: "Trust, Security, & Modernity"

## 1. Design Philosophy
The core aesthetic will be **"Digital Fortress"**: a blend of high-security reliability with cutting-edge modern interface design.
-   **Trust:** Conveyed through stable, deep blues, precise typography, and high-quality iconography.
-   **Security:** Visualized through shield motifs, lock imagery, and a "contained" layout structure that feels robust.
-   **Modernity:** Achieved with glassmorphism, subtle gradients, micro-interactions, and a clean, spacious layout.
-   **State of the Art:** High-performance animations, skeleton loading states, and a "command center" feel for the dashboard.

## 2. Theme System (Tailwind Configuration)

### Color Palette
-   **Primary (Trust Blue):**
    -   `primary-900`: `#0B1120` (Deepest Navy - Backgrounds)
    -   `primary-800`: `#151F32` (Card Backgrounds)
    -   `primary-600`: `#2563EB` (Action Blue - Buttons/Links)
    -   `primary-500`: `#3B82F6` (Focus Rings/Accents)
-   **Accent (Cyber Cyan):**
    -   `accent-500`: `#06B6D4` (Glows, Highlights)
    -   `accent-400`: `#22D3EE` (Interactive Elements)
-   **Neutral (Slate):**
    -   `slate-50`: `#F8FAFC` (Light Mode Background)
    -   `slate-900`: `#0F172A` (Dark Mode Background)
-   **Status:**
    -   `success`: `#10B981` (Emerald - Verified)
    -   `warning`: `#F59E0B` (Amber - Pending)
    -   `error`: `#EF4444` (Red - Tampered/Failed)

### Typography
-   **Font Family:** `Inter` (sans-serif) with `font-feature-settings: "cv11", "ss01"` for a more technical look.
-   **Headings:** Tight tracking (`-0.02em`) for a solid, authoritative feel.
-   **Body:** Relaxed line-height (`1.6`) for readability.

### Visual Effects
-   **Glassmorphism:** `backdrop-blur-md bg-white/10` (Dark) or `bg-white/70` (Light).
-   **Borders:** Thin, subtle borders (`border-slate-200` Light / `border-slate-800` Dark).
-   **Shadows:** Soft, diffused colored shadows for depth (e.g., `shadow-blue-500/20`).

## 3. Component Revamp Plan

### Global Elements
-   **Navigation Bar:** Sticky, glassmorphism effect. Logo on left, clean links center, "Get Started" CTA right.
-   **Footer:** Multi-column, dark theme (even in light mode) to ground the page.

### UI Components (shadcn/ui + Custom)
-   **Buttons:**
    -   `default`: Solid Primary Blue, slight inner shadow for depth.
    -   `outline`: Thin border, hover fills with faint blue.
    -   `ghost`: Clean text, hover background.
-   **Cards:**
    -   Rounded-xl.
    -   Subtle gradient border on hover.
    -   "Spotlight" effect on hover (cursor tracking glow).
-   **Inputs:**
    -   Clean borders.
    -   Focus ring: Wide, semi-transparent blue glow.

## 4. Page-by-Page Implementation Strategy

### 1. Landing Page (`Index.tsx`)
-   **Hero Section:**
    -   Headline: "The Standard for Digital Trust."
    -   Visual: Abstract 3D shield or network graph (using CSS/SVG).
    -   CTA: "Start Verifying" (Primary) + "View Documentation" (Secondary).
-   **Features Grid:** Bento-box style layout highlighting key capabilities (Speed, Security, API).
-   **Trust Section:** Logos of partners/clients in monochrome opacity.
-   **How it Works:** Step-by-step vertical timeline with animated icons.

### 2. Authentication (`Login.tsx`, `Signup.tsx`)
-   **Layout:** Split screen. Left side: Form. Right side: Abstract art/Testimonial/Feature highlight.
-   **Form:** Clean, spacious inputs. Social login buttons (GitHub, Google) with consistent styling.

### 3. Dashboard (`Dashboard.tsx`)
-   **Layout:** Sidebar navigation (collapsible). Top bar with search and profile.
-   **Overview:**
    -   Stats Cards: "Total Verifications", "Success Rate", "API Usage".
    -   Recent Activity Table: Clean rows, status badges.
    -   Charts: Line chart for usage trends (using Recharts or similar).

### 4. Profile (`Profile.tsx`)
-   **Layout:** Tabs for "General", "Security", "API Keys", "Billing".
-   **Security Tab:** 2FA toggle, Password change, Session history.

## 5. Implementation Steps
1.  **Configure Theme:** Update `tailwind.config.ts` and `globals.css`.
2.  **Base Layout:** Create `MainLayout` and `AuthLayout` components.
3.  **Revamp Landing:** Rewrite `Index.tsx` with new sections.
4.  **Revamp Auth:** Update Login/Signup pages.
5.  **Revamp Dashboard:** Update Dashboard and Profile pages.
6.  **Polish:** Add animations (Framer Motion or CSS transitions) and responsive checks.
