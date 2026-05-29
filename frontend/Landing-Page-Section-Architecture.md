---
title: Mira.AI Landing Page - Cosmic Color Architecture
created: 2025-09-16T20:15:00.000Z
updated: 2025-09-16T21:00:00.000Z
version: 3.0
status: LOCKED - COSMIC THEME APPLIED
approach: Mobile-First with Cosmic Effects
---

# 🌌 Landing Page Cosmic Architecture

## 📋 **Official Section Naming Convention**

**LOCKED**: This naming convention and color scheme is now **permanent** for all future development, styling, and team communication.

### **Section Breakdown:**

| Section ID | Official Name | Content Description | Design Notes |
|------------|---------------|-------------------|--------------|
| **Header Section** | Header Section | Early Access • Patent Pending • SOC 2 In Progress | Purple starfield, gradient |
| **Top Nav Section** | Top Nav Section | Sticky header with logo, navigation, CTAs | Star glow, lighter cosmic BG |
| **Section 1** | Scan → Truth | Hero with main value prop and verdict chips | Pink pulse, violet-rose with stars |
| **Section 2** | Trusted by leading companies | Social proof with logos and testimonial | Semi-translucent card overlay |
| **Section 3** | How It Works | Three-step process explanation | Animated blue/violet fade |
| **Section 4** | See It In Action | Demo scenarios with CTA buttons | Blue-green star sparkles |
| **Section 5** | Who It's For | Target audience breakdown (B2B/B2C/B2B2C) | Rose pink on purple, warm appeal |
| **Section 6** | Four Product Surfaces | Product overview (Verify/Studio/Console/API) | Silvery purple BG, yellow flash |
| **Section 7** | Built for Developers | Code snippet and developer focus | Blue/white geometric hologram |
| **Section 8** | SOC 2 (In Progress) | Security badges and trust indicators | Deep navy, soft green data aura |
| **Footer Section** | Footer Section | Comprehensive 6-column navigation | Moving stars, soft blur |

---

## 🌌 **COSMIC COLOR SCHEME - LOCKED**

### **Complete Color & Effects Specification:**

| Section | Background | Font Color | Accent/Border | Special Effects |
|---------|------------|------------|---------------|-----------------|
| **Header** | `#18103b` | `#ffffff` | `#6366f1` (Indigo Glow) | Faint purple starfield, gradient |
| **Top Navigation** | `#251c4a` | `#ffffff` | `#818cf8` (Blue–Indigo) | Star glow, slightly lighter BG |
| **Primary Section** | `#322157` | `#fff9fa` | `#a78bfa` (Violet Glow) | Vivid, gradient to #433285 at edges |
| **Secondary Section** | `#6333ff` | `#cffafe` | `#22d3ee` (Teal Glow) | Soft blue/teal left-right gradient |
| **Call-to-Action** | `#1e70fe` | `#fff8f8` | `#38bdf8` (Sky Blue) | Animated blue shadow/glow |
| **Section 1 (Scan to Truth)** | `#251c4a` | `#e9d7fe` | `#f472b6` (Pink pulse) | Lighter violet-rose, stars in BG |
| **Section 2 (Companies)** | `#322157` | `#f1f5f9` | `#60a5fa` (Blue Accent) | Semi-translucent card overlay |
| **Section 3 (How It Works)** | `#4f46e5` | `#f9fafb` | `#fbbf24` (Gold Accent) | Animated left–right blue/violet fade |
| **Section 4 (See in Action)** | `#0ea5e9` | `#f5f5f5` | `#22d3ee` (Teal Glow) | Subtle blue-green star sparkles |
| **Section 5 (Who It's For)** | `#be185d` | `#fce7f3` | `#fff` (White) | Rose pink on purple, appealing warm |
| **Section 6 (Surfaces)** | `#18103b` | `#f0f9ff` | `#fde68a` (Yellow highlight) | Silvery purple BG, yellow flash |
| **Section 7 (Developers)** | `#3b82f6` | `#fffde3` | `#7dd3fc` (Light Aqua) | Blue/white geometric hologram |
| **Section 8 (SOC2)** | `#1e293b` | `#fffef3` | `#a3e635` (Lime glow) | Deep navy, soft green data aura |
| **Footer** | `#0f172a` | `#cbd5e1` | `#818cf8` (Indigo edge) | Moving/animated stars, soft blur |

---

## ✨ **Special Effects Implementation**

### **Cosmic Background Effects:**
```css
/* Starfield backgrounds */
.starfield-bg {
  background-image: radial-gradient(2px 2px at 20px 30px, #fff, transparent),
                    radial-gradient(2px 2px at 40px 70px, rgba(255,255,255,0.8), transparent),
                    radial-gradient(1px 1px at 90px 40px, #fff, transparent);
  background-repeat: repeat;
  background-size: 200px 100px;
}

/* Gradient overlays */
.cosmic-gradient {
  background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
}

/* Glow effects */
.indigo-glow {
  box-shadow: 0 0 20px rgba(99, 102, 241, 0.3);
}

.pink-pulse {
  animation: pulse-pink 2s ease-in-out infinite alternate;
}

@keyframes pulse-pink {
  from { box-shadow: 0 0 20px rgba(244, 114, 182, 0.4); }
  to { box-shadow: 0 0 30px rgba(244, 114, 182, 0.8); }
}
```

### **Interactive Elements:**
- **Hover states** with cosmic glow effects
- **Animated gradients** for dynamic sections
- **Pulsing accents** for call-to-action elements
- **Starfield animations** for background movement

---

## 📱 **Mobile-First Cosmic Design**

### **Responsive Breakpoints:**
- **Mobile**: `< 768px` (primary design target with cosmic effects)
- **Tablet**: `768px - 1024px` (enhanced cosmic animations)
- **Desktop**: `> 1024px` (full cosmic experience)

### **Section-Specific Cosmic Considerations:**
- **Header**: Purple starfield with language switcher glow
- **Top Nav**: Star glow navigation with cosmic hover states
- **Section 1**: Pink pulse hero with violet-rose starfield
- **Section 2**: Semi-translucent cards with blue accents
- **Section 3**: Animated blue/violet fade with gold highlights
- **Section 4**: Blue-green star sparkles with teal glow
- **Section 5**: Rose pink warmth with white accents
- **Section 6**: Silvery purple with yellow flash highlights
- **Section 7**: Geometric hologram code display
- **Section 8**: Deep navy with soft green data aura
- **Footer**: Moving stars with soft blur effects

---

## 🔧 **Development Guidelines**

### **CSS Custom Properties:**
```css
:root {
  /* Cosmic Color Palette */
  --header-bg: #18103b;
  --header-text: #ffffff;
  --header-accent: #6366f1;
  
  --nav-bg: #251c4a;
  --nav-text: #ffffff;
  --nav-accent: #818cf8;
  
  --section1-bg: #251c4a;
  --section1-text: #e9d7fe;
  --section1-accent: #f472b6;
  
  --section2-bg: #322157;
  --section2-text: #f1f5f9;
  --section2-accent: #60a5fa;
  
  --section3-bg: #4f46e5;
  --section3-text: #f9fafb;
  --section3-accent: #fbbf24;
  
  --section4-bg: #0ea5e9;
  --section4-text: #f5f5f5;
  --section4-accent: #22d3ee;
  
  --section5-bg: #be185d;
  --section5-text: #fce7f3;
  --section5-accent: #fff;
  
  --section6-bg: #18103b;
  --section6-text: #f0f9ff;
  --section6-accent: #fde68a;
  
  --section7-bg: #3b82f6;
  --section7-text: #fffde3;
  --section7-accent: #7dd3fc;
  
  --section8-bg: #1e293b;
  --section8-text: #fffef3;
  --section8-accent: #a3e635;
  
  --footer-bg: #0f172a;
  --footer-text: #cbd5e1;
  --footer-accent: #818cf8;
}
```

### **Component Organization:**
```
src/
├── components/
│   ├── sections/
│   │   ├── HeaderSection.tsx (cosmic starfield)
│   │   ├── TopNavSection.tsx (star glow nav)
│   │   ├── Section1Hero.tsx (pink pulse hero)
│   │   ├── Section2SocialProof.tsx (translucent cards)
│   │   ├── Section3HowItWorks.tsx (animated fade)
│   │   ├── Section4Demos.tsx (star sparkles)
│   │   ├── Section5Audiences.tsx (rose pink warm)
│   │   ├── Section6Products.tsx (yellow flash)
│   │   ├── Section7Developers.tsx (hologram code)
│   │   ├── Section8Trust.tsx (green data aura)
│   │   └── FooterSection.tsx (moving stars)
├── styles/
│   ├── cosmic-effects.css
│   └── animations.css
```

### **Styling Approach:**
- **Tailwind CSS** with custom cosmic utilities
- **CSS Custom Properties** for consistent theming
- **Keyframe animations** for cosmic effects
- **Backdrop filters** for translucent elements
- **Box shadows** for glow effects

---

## ✅ **Cosmic Theme Lock Confirmation**

**PERMANENTLY LOCKED**: This cosmic color scheme and effects system is now the **official standard** for:
- ✅ All development work
- ✅ Design system consistency  
- ✅ Team communication
- ✅ Future page templates
- ✅ **COSMIC EFFECTS MANAGEMENT**
- ✅ Mobile-first responsive design
- ✅ Accessibility compliance with cosmic aesthetics

**Cosmic Theme Status**: 🌌 **LOCKED & PERMANENT**

**Implementation Rules:**
1. **Exact hex values** must be maintained
2. **Special effects** are integral to the design
3. **Cosmic animations** enhance user experience
4. **Accessibility** maintained despite cosmic theme
5. **Performance** optimized for mobile devices

---

*This document serves as the foundational cosmic architecture for all Mira.AI landing page development. The cosmic color scheme and effects are now PERMANENT and locked for consistency. Any changes to this structure require team agreement and documentation updates.*

**Status**: 🌌 **COSMIC THEME LOCKED**  
**Colors**: ✨ **PERMANENT COSMIC SCHEME**  
**Effects**: 🎭 **SPECIAL EFFECTS INTEGRATED**  
**Approach**: 📱 **Mobile-First Cosmic**  
**Date**: September 16, 2025