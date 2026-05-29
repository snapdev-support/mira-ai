---
title: Mira.AI Product Requirements Document - Evolution Tracking
app: cosmic-wombat-twirl → Mira.AI
created: 2025-09-12T15:44:39.553Z (Friday)
updated: 2025-09-16T19:47:00.000Z (Monday)
version: 3.0 (evolved from template)
---

# Mira.AI - Product Requirements Document Evolution

## 📋 **Change Tracking Summary**

**Friday (Baseline)**: Started with PRD template for "cosmic-wombat-twirl"
**Sunday**: Major product definition and core features implementation  
**Monday**: UI/UX refinement, comprehensive footer, and polish

---

## Executive Summary

~~**Product Vision:** [Describe your product vision here]~~ 
**Product Vision:** QR‑compatible, agent‑augmented trustmark that binds a signed claim to a QR‑carried token and returns a human‑readable verdict (Valid / Tampered / Expired) in under two seconds.

~~**Core Purpose:** [What problem does this solve?]~~
**Core Purpose:** Turn any QR into a human-readable verdict in <2s. Signed claims, not just links.

~~**Target Users:** [Who will use this product?]~~
**Target Users:** 
- **B2B**: AP/AR teams, procurement, CFOs approving invoices
- **B2C**: Consumers verifying packaging authenticity  
- **B2B2C**: E-commerce returns, SLA tracking, customer service

~~**Key Features:**~~
~~- [Feature 1]~~
~~- [Feature 2]~~  
~~- [Feature 3]~~
**Key Features:** *(Added Sunday)*
- **Verify**: Zero login • Sub-2s verdict • Works on any phone
- **Studio**: OpenAI-style creation with natural language + live QR preview
- **Console**: Operations dashboard with SLO tiles, revocation tracking, anomaly detection
- **API/Playground**: Developer-first with live preview, one-click cURL, SDK snippets

**Complexity Assessment:** ~~Simple~~ **Enterprise-Grade**
- **State Management:** ~~Local~~ **Global with real-time updates**
- **External Integrations:** ~~0~~ **Cryptographic signing, CRL, JWKS**
- **Business Logic:** ~~Simple~~ **Complex cryptographic verification**
- **Data Synchronization:** ~~None~~ **Real-time metrics, live events**

**MVP Success Metrics:**
- ~~Users can complete core workflow~~ **Sub-2s verification latency (P95 <2s)**
- ~~System handles expected concurrent users~~ **99.9% availability SLO**
- ~~Core features work without errors~~ **<0.1% false positive/negative rate on tamper detection**

---

## 1. USERS & PERSONAS *(Completely Rewritten Sunday)*

~~**Primary Persona:**~~
~~- **Name:** [Primary User]~~
~~- **Context:** [Their situation]~~
~~- **Goals:** [What they want to achieve]~~
~~- **Needs:** [Specific to this product]~~

**Primary Personas:**

**Sarah Chen - CFO, TechStart Inc.**
- **Context:** Approves 200+ invoices/month, needs instant verification
- **Goals:** Reduce AP processing from 3 days to 30 seconds
- **Pain Points:** Manual verification, fraud risk, cash flow delays
- **Mira Usage:** Scans invoice QR → gets "Valid — Issued by ACME Corp on Sep 10 for $4,200"

**Marcus Rodriguez - Pharmacist**  
- **Context:** Dispenses medications, must verify authenticity
- **Goals:** Prevent counterfeit drugs, ensure patient safety
- **Pain Points:** Complex batch tracking, expiry management
- **Mira Usage:** Scans batch QR → gets "Genuine — Batch #PH2024-0892, expires Aug 2026; FDA certified"

**Lisa Park - E-commerce Customer Service**
- **Context:** Handles 50+ return requests daily
- **Goals:** Automate refund processing, reduce tickets
- **Pain Points:** Manual SLA tracking, customer disputes
- **Mira Usage:** Scans return QR → gets "Active — Return window open, refund due by Sep 15"

---

## 2. FUNCTIONAL REQUIREMENTS *(Major Expansion Sunday)*

### 2.1 Core Verification Engine *(Added Sunday)*

**FR-001: Instant QR Verification**
- **Description:** Scan any Mira QR code and get human-readable verdict in <2s
- **User Benefit:** Zero-friction trust verification
- **Acceptance Criteria:**
  - [ ] Any camera/device can scan QR codes
  - [ ] Returns verdict: VALID | TAMPERED | EXPIRED | REVOKED
  - [ ] Includes two-line human explanation
  - [ ] P95 latency <2s, P99 <5s
  - [ ] Works offline with cached public keys

**FR-002: Cryptographic Proof System** *(Added Sunday)*
- **Description:** Ed25519 signatures with replay/expiry/revocation controls
- **User Benefit:** Mathematically provable authenticity
- **Acceptance Criteria:**
  - [ ] Ed25519 signing with HSM/KMS key storage
  - [ ] JWKS public key distribution via CDN
  - [ ] Global CRL with <60s propagation
  - [ ] Nonce-based replay protection
  - [ ] Selective disclosure support

### 2.2 Product Surfaces *(Added Sunday)*

**FR-003: Verify Interface**
- **Description:** Consumer-facing verification with camera interface
- **User Benefit:** Magic moment - scan → truth
- **Acceptance Criteria:**
  - [ ] Apple-style camera viewfinder
  - [ ] Traffic-light verdict cards (green/amber/red)
  - [ ] Scan history with timestamps
  - [ ] Proof viewer with cryptographic details
  - [ ] Zero login required

**FR-004: Studio (Creation Interface)** *(Added Sunday)*
- **Description:** OpenAI-style claim creation with agent extraction
- **User Benefit:** Natural language → signed QR codes
- **Acceptance Criteria:**
  - [ ] Chat interface for claim description
  - [ ] PDF/image upload with OCR extraction
  - [ ] Live QR preview with policy tabs
  - [ ] Demo flows (invoice, return, batch, approval)
  - [ ] Agent-powered field extraction

**FR-005: Console (Operations Dashboard)** *(Added Sunday)*
- **Description:** Real-time operations monitoring
- **User Benefit:** SLO tracking and anomaly detection
- **Acceptance Criteria:**
  - [ ] Live SLO tiles (P50/P95 latency, availability, revocation time)
  - [ ] Event stream with filtering
  - [ ] Anomaly detection (replay clusters, fraud patterns)
  - [ ] Global activity heatmap
  - [ ] Alert management

**FR-006: API/Playground** *(Added Sunday)*
- **Description:** Developer-first API with interactive testing
- **User Benefit:** Easy integration with live preview
- **Acceptance Criteria:**
  - [ ] Interactive endpoint testing
  - [ ] Live QR code generation
  - [ ] Multi-language code snippets (cURL, JS, Python, Go)
  - [ ] Copy-paste SDK examples
  - [ ] OpenAPI/Postman export

### 2.3 Business Templates *(Added Sunday)*

**FR-007: Invoice Template**
- **Fields:** issuer, invoice_no, total, currency, issued_at, due_date
- **Validation:** Amount format, date validation, issuer verification
- **Business Logic:** AP approval workflow integration

**FR-008: Batch/Packaging Template**  
- **Fields:** batch_number, product, manufacturer, mfg_date, expiry_date, certifications
- **Validation:** FDA/regulatory compliance, expiry logic
- **Business Logic:** Recall management, warranty tracking

**FR-009: Return/SLA Template**
- **Fields:** return_id, issuer, sla_hours, refund_amount, conditions, milestones
- **Validation:** SLA window calculation, milestone tracking
- **Business Logic:** Automated refund triggers

**FR-010: Approval/Certification Template**
- **Fields:** document_title, approver, approver_title, version, valid_until
- **Validation:** Approver authority, document versioning
- **Business Logic:** Compliance tracking, audit trails

---

## 3. USER WORKFLOWS *(Completely New Sunday)*

### 3.1 Primary Workflow: Invoice Verification
- **Trigger:** CFO receives invoice with Mira QR code
- **Outcome:** Instant approval or rejection decision
- **Steps:**
  1. CFO opens phone camera
  2. Scans QR code on invoice
  3. Gets verdict: "Valid — Issued by ACME Corp on Sep 10 for $4,200"
  4. Taps "View Proof" to see cryptographic details
  5. Approves payment in ERP system
  6. **Result:** 3-day process → 30 seconds

### 3.2 Studio Creation Workflow *(Added Sunday)*
- **Trigger:** Issuer needs to create signed invoice claim
- **Steps:**
  1. Upload PDF or describe in natural language
  2. AI agent extracts: issuer, amount, invoice number, dates
  3. User reviews extracted fields
  4. System generates signed claim + QR code
  5. User downloads QR for invoice attachment
  6. **Result:** Manual data entry → AI extraction

### 3.3 Anomaly Detection Workflow *(Added Sunday)*
- **Trigger:** Same QR scanned from multiple locations
- **Steps:**
  1. Console detects replay cluster (SF, NY, London in 5 minutes)
  2. System flags as suspicious activity
  3. Ops team investigates via event stream
  4. Potential fraud prevention or legitimate use confirmation
  5. **Result:** Proactive fraud detection

---

## 4. BUSINESS RULES *(Enhanced Sunday)*

**Cryptographic Rules:**
- **Key Rotation:** Quarterly or on incident
- **Signature Algorithm:** Ed25519 only
- **Public Key Distribution:** JWKS via CDN with versioning
- **Revocation:** Global CRL with <60s propagation target

**Claim Lifecycle:**
- **Expiry:** Configurable per template (invoices: 90 days, batches: until expiry date)
- **Revocation:** Issuer can revoke at any time with reason
- **Replay Protection:** Nonce + device fingerprinting + IP geolocation

**SLA Requirements:** *(Added Sunday)*
- **Availability:** 99.9% (MVP) → 99.99% (GA)
- **Latency:** P50 <1s, P95 <2s, P99 <5s
- **Error Rate:** <0.1% false positives/negatives
- **Revocation Propagation:** <60s globally

---

## 5. DATA REQUIREMENTS *(Expanded Sunday)*

**Core Entities:**

**Claim**
- **Attributes:** id, template, issuer_id, claims_data, nonce, signature, created_at, expires_at, revoked_at
- **Relationships:** belongs_to issuer, has_many verifications
- **Storage:** Hash + minimal metadata only (privacy by design)

**Issuer**
- **Attributes:** id, name, public_key_id, trust_level, verified, created_at
- **Relationships:** has_many claims, has_many keys
- **Trust Levels:** Enterprise, FDA Approved, Marketplace, Individual

**Verification Event** *(Added Sunday)*
- **Attributes:** id, claim_id, verdict, verify_time, ip_address, user_agent, location, created_at
- **Purpose:** Analytics, anomaly detection, audit trail
- **Retention:** 90 days for analytics, 7 years for audit

**Key Management**
- **Attributes:** key_id, public_key, algorithm, created_at, rotated_at, status
- **Distribution:** JWKS endpoint with CDN caching
- **Rotation:** Automated quarterly + manual on incident

---

## 6. INTEGRATION REQUIREMENTS *(New Sunday)*

**External Systems:**
- **HSM/KMS:** AWS KMS, Azure Key Vault for private key storage
- **CDN:** CloudFlare for JWKS and CRL distribution  
- **Analytics:** Custom metrics pipeline for SLO tracking
- **Monitoring:** Prometheus + Grafana for ops dashboards

**API Integrations:**
- **ERP Systems:** SAP, Oracle, NetSuite for invoice workflows
- **E-commerce:** Shopify, WooCommerce for return processing
- **Regulatory:** FDA databases for pharmaceutical batch verification

---

## 7. DESIGN SYSTEM *(Major Addition Monday)*

### 7.1 Apple/Figma-Level Design Quality *(Added Monday)*

**Color System:**
- **Primary:** Mira Blue (#3B82F6) with gradient variants
- **Verdict Colors:** Green (Valid), Amber (Tampered), Red (Expired/Revoked)
- **Neutrals:** Apple-inspired gray scale with proper contrast ratios
- **Gradients:** Subtle section bands (purple-25, orange-25, etc.)

**Typography:**
- **Font:** Inter with proper font-feature-settings
- **Hierarchy:** 5xl/6xl heroes, proper line-height (1.2 for headings, 1.5 for body)
- **Tracking:** Tight tracking (-0.025em) for large text

**Component System:**
- **Cards:** Subtle shadows, rounded corners, hover states
- **Buttons:** Gradient primaries, proper focus states, 44px touch targets
- **Badges:** Verdict-specific styling with icons
- **Forms:** Clean inputs with proper validation states

### 7.2 Responsive Design *(Added Monday)*
- **Breakpoints:** Mobile-first with sm/md/lg/xl
- **Grid:** 12-column system with proper gutters
- **Touch Targets:** Minimum 44x44px on mobile
- **Accessibility:** WCAG AA compliance, proper focus management

---

## 8. TECHNICAL ARCHITECTURE *(Enhanced Monday)*

### 8.1 Frontend Stack
- **Framework:** React 18 with TypeScript
- **Styling:** Tailwind CSS with custom design tokens
- **Components:** shadcn/ui with custom extensions
- **State:** React Query for server state, local state for UI
- **Routing:** React Router with proper SEO

### 8.2 Performance Requirements *(Added Monday)*
- **Core Web Vitals:** LCP <2.5s, FID <100ms, CLS <0.1
- **Bundle Size:** <500KB initial, code splitting for routes
- **Caching:** Aggressive CDN caching for static assets
- **Offline:** Service worker for public key caching

---

## 9. COMPREHENSIVE FOOTER *(Added Monday)*

### 9.1 Information Architecture
**Six Strategic Columns:**
- **Product:** Verify • Studio • Console • API • Downloads • Release notes
- **Solutions:** Invoices • Packaging authenticity • Returns/SLA • Certifications/Approvals
- **Developers:** Docs • API reference • SDKs • Changelog • Status • Postman/OpenAPI • Examples  
- **Resources:** Blog • Best practices • QR printing guide • Security • Evals & Benchmarks • ROI calculator
- **Company:** About • Customers • Careers • Press • Contact
- **Legal & Trust:** Privacy • Terms • DPA • Sub-processors • Responsible disclosure • System status

### 9.2 Design Specifications *(Added Monday)*
- **Background:** Deep gradient (#0B1020 → #030712) 
- **Typography:** AA contrast white text, semantic HTML structure
- **Responsive:** 6-col desktop → 3-col tablet → 2-col mobile → accordions
- **Bottom Bar:** Logo + "© 2024 Mira.AI. Proof at Scan." + language selector

---

## 10. MVP SCOPE & CONSTRAINTS *(Updated Monday)*

**MVP Success Definition:**
- ~~[Core workflow functions end-to-end]~~ **All 4 product surfaces functional**
- ~~[All entity lifecycles complete per type]~~ **Complete claim lifecycle (issue → verify → revoke)**
- ~~[Basic features work reliably]~~ **Sub-2s verification with 99.9% availability**
- ~~[Handles expected user load]~~ **10k concurrent verifications**

**Technical Constraints:**
- **Expected Load:** 10k concurrent users, 1M verifications/day
- **Latency SLOs:** P95 <2s verification, P99 <5s
- **Availability:** 99.9% uptime target
- **Security:** Ed25519 signatures, HSM key storage, global CRL

**Explicitly Excluded from MVP:**
- Multi-signature workflows
- Hardware attestation for issuers  
- Differential privacy analytics
- Advanced ML fraud detection
- Mobile SDK (web-first)

---

## 11. ASSUMPTIONS & DECISIONS *(Updated Throughout)*

**Business Model:** B2B SaaS with usage-based pricing
**Access Model:** Multi-tenant with enterprise features

**Key Architecture Decisions:** *(Added Sunday)*
- **Cryptography:** Ed25519 over RSA for performance
- **Distribution:** JWKS + CDN over direct key exchange
- **Verification:** Online-first with offline fallback
- **Privacy:** Hash storage + selective disclosure

**Design Decisions:** *(Added Monday)*
- **Apple-inspired:** Clean, confident, material honesty
- **Traffic-light verdicts:** Universal color coding (green/amber/red)
- **Zero-login verification:** Reduce friction for end users
- **Developer-first API:** Interactive playground over static docs

**From Original Product Idea:**
- **Product:** ~~cosmic-wombat-twirl~~ **Mira.AI - Proof at Scan**
- **Evolution:** Template → Full cryptographic verification platform
- **Scope:** Expanded from simple app to enterprise-grade system

---

## 12. CHANGE LOG

### Friday 2025-09-13 (Baseline)
- Started with generic PRD template
- Placeholder content for "cosmic-wombat-twirl"
- Basic CRUD assumptions

### Sunday 2025-09-15 (Major Development)
- ✅ **Complete product redefinition** as Mira.AI
- ✅ **4 product surfaces implemented** (Verify, Studio, Console, API)
- ✅ **Cryptographic architecture** with Ed25519 signatures
- ✅ **Business templates** (invoices, batches, returns, approvals)
- ✅ **Real-time features** (live metrics, event streams)
- ✅ **Demo scenarios** with realistic business contexts
- ✅ **SLO requirements** and operational monitoring

### Monday 2025-09-16 (Polish & Refinement)
- ✅ **Apple/Figma-level design system** implementation
- ✅ **Comprehensive footer** with 6-column information architecture
- ✅ **Enhanced UI components** (ProofViewer, LiveMetrics, DemoScenarios)
- ✅ **Responsive design** with proper breakpoints
- ✅ **Performance optimizations** and accessibility improvements
- ✅ **Error handling** and user experience polish

---

**Next Steps for Development:**
1. Backend API implementation (FastAPI + Ed25519 signing)
2. Database schema for claims, issuers, verifications
3. JWKS endpoint and CRL distribution
4. Integration testing with real cryptographic flows
5. Performance testing for SLO validation

---

*This PRD has evolved from a template to a comprehensive specification for an enterprise-grade cryptographic verification platform. All changes tracked and ready for development implementation.*