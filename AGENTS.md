# Kontrol — Agent Operational Manual, Guardrails & File Map

> **Mandatory instruction for all AI agents and models (OpenCode, Antigravity, etc.):**  
> Read this file before touching any code. Follow every guardrail strictly, do not blind-scan the repository, and make surgical edits only.

---

## 1. Token-Saving Execution & Search Rules (READ FIRST)
- **Zero Blind Scanning:** NEVER search, glob, or read `node_modules/`, `dist/`, `build/`, `.gradle/`, `app/android/app/build/`, `app/android/capacitor-cordova-android-plugins/`, or `pnpm-lock.yaml`.
- **Direct File Lookup:** Use the **File Map (Section 5)** below to open ONLY the exact files required for the current task.
- **Surgical Edits Only:** Read target files completely before modifying them. Never rewrite an entire page layout, navigation bar, or stylesheet unless explicitly instructed.
- **Model-Handoff Protocol:** If a `STATUS.md` file exists in the root, read it first to see the exact current state and remaining steps. Before ending a session or switching models, update `STATUS.md` if work is mid-flight.
- **Mandatory Build Verification:** Before finishing any task, run `pnpm build` in `app/` (and `server/` if backend files changed) and fix any TypeScript or bundler errors.

---

## 2. Hard UI, GlassyUI & Layout Guardrails (DO NOT VIOLATE)

### 2.1 Exclusive GlassyUI Design System & Registry Rule
- **Use ONLY GlassyUI (`app/src/components/glassyui/`):** Every interactive control, card, panel, input, tab, button, and surface MUST be built using Kontrol's **GlassyUI** primitives (`GlassButton`, `GlassPanel`, `GlassInput`, `GlassSurface`, `GlassTabs`, `GlassProvider`) or wrappers built strictly on top of them.
- **Fetch New UI Components from the GlassyUI Registry:** If a new UI primitive or component is needed (e.g., modal, select, switch, badge, tooltip, slider, sheet), pull/install it from the **GlassyUI registry** (matching `components.json` / GlassyUI CLI convention in `app/`) into `app/src/components/glassyui/`—NEVER install conflicting third-party UI kits (no Material UI, Ant Design, Chakra, Mantine, or plain unstyled HTML/Tailwind clones).
- **Strict Dark Glassmorphism Palette:** Preserve Kontrol's deep void (`#070707` + `ReactiveBackground.tsx`) and slate-indigo translucent glass surfaces (`bg-[#161b2e]/80` or `bg-slate-900/40`, `backdrop-blur-xl`, `1px` borders `border-white/10` to `border-white/15`). Never introduce light/bright themes, flat opaque grey backgrounds, or off-theme neon green card fills.
- **Selected Card State:** Active/selected module cards use `bg-[#1e2544]/90 border-indigo-400/80 shadow-[0_0_20px_rgba(99,102,241,0.28)]`.
- **Status Color Tokens:**
  - `ATTENDED`: Emerald (`text-emerald-400`, `bg-emerald-500/15`, `border-emerald-500/30`)
  - `SKIPPED`: Rose (`text-rose-400`, `bg-rose-500/15`, `border-rose-500/30`)
  - `GHOST`: Violet (`text-violet-400`, `bg-violet-500/15`, `border-violet-500/30`)
  - `CANCELLED`: Slate (`text-slate-400`, `bg-slate-500/15`, `border-slate-500/30`)

### 2.2 Dual-View Layout & Navigation Integrity
- **Breakpoint Split (`app/src/App.tsx`):** `useIsMobile()` (`< 768px`) renders `MobileShell.tsx`; `>= 768px` renders the desktop Bento dashboard. Keep both views cleanly separated.
- **Floating Bottom Docks:**
  - **Mobile (`MobileDock.tsx`):** Must remain a horizontal floating glass pill anchored at `bottom: calc(var(--sab) + 12px)`—never vertical, never clipped.
  - **Desktop (`GlassDock.tsx`):** Keep the floating glass navigation dock intact and centered.
- **Uniform Module Actions (`Attend` / `Skip` / `Ghost`):**
  - Every module card on both Desktop (including all grid cards below `PRIMARY TARGET`) and Mobile (`QuickActionsRow.tsx`) must expose all three GlassyUI actions (`ATTENDED`, `SKIPPED`, `GHOST`) in a clean, non-clipping layout (`grid-cols-3` on desktop cards) and log today's local date (`YYYY-MM-DD` via `app/src/lib/dates.ts`).

### 2.3 Safe-Area Insets (`--sat`, `--sab`) & Keyboard (`--kb`)
- **Native Android (`MainActivity.java`):** Edge-to-edge (`WindowCompat.setDecorFitsSystemWindows(false)`) with transparent status/nav bars and hardware layer acceleration. Injects `--sat`, `--sab`, and IME `--kb` in DP on creation and `onResume()` (with 150ms & 500ms re-sync delays). Never remove this logic.
- **CSS Fallback (`app/src/index.css`):**
  - Mobile (`< 768px`): `--sat: max(env(safe-area-inset-top, 0px), 32px);` and `--sab: max(env(safe-area-inset-bottom, 0px), 20px);`.
  - Desktop (`>= 768px`): `--sat: 0px; --sab: 0px;`.
- **Spacing Rules:**
  - `MobileTopBar.tsx` must use `padding-top: calc(var(--sat) + 12px)`.
  - `MobileDock.tsx` must use `bottom: calc(var(--sab) + 12px)`.
  - Mobile scroll containers must pad bottom with `calc(var(--sab) + 84px)`.
  - Mobile sheets (`GlassSheet.tsx`) must lift above `--kb` and smoothly scroll focused inputs (`scrollIntoView({ behavior: 'smooth', block: 'center' })`) into view above the keyboard.

### 2.4 Modals, Portals & GPU Performance
- **Portal Rendering:** All modals, dialogs, and sheets (`GlassSheet.tsx`, `SettingsModal.tsx`, `AttendanceLogDrawer.tsx`) MUST render via `createPortal(..., document.body)` so parent `backdrop-filter` stacking contexts never clip fixed overlays.
- **60fps Mobile Scroll:** Do not stack heavy `backdrop-blur-xl` on dozens of rapidly scrolling list items; reserve heavy blur for docks, headers, and modal sheets.
- **Touch DnD (`useDndSensors.ts`):** Keep `touch-action: manipulation` / `touch-none` and `-webkit-user-select: none` on draggable chips/handles across Timetable and Build Vault so dragging works on mobile without triggering text selection or fighting vertical scroll.

---

## 3. Security, Auth & Biometric Guardrails

### 3.1 AuthGate (`app/src/components/AuthGate.tsx`)
- **Viewport Centering:** Lock, setup, loading, and connection-error states must always render centered in a full-viewport overlay (`fixed inset-0 z-50 w-screen h-dvh flex items-center justify-center p-4`) using GlassyUI surfaces (`GlassPanel`, `GlassButton`, `GlassInput`). Never let the auth card collapse to a screen corner.
- **Render Order:** Check `loading` -> `networkError` (with Retry button) -> `!initialized` (One-Time TOTP QR + 6-digit PIN setup) -> `!authenticated` (TOTP / PIN / Biometric unlock).
- **Bearer Token Persistence:** On successful setup/unlock, always save `localStorage.setItem('kontrol_token', token)`.
- **Android Biometric Unlock (`Capacitor.isNativePlatform()`):**
  - Uses `@capgo/capacitor-native-biometric` with `server: 'com.kontrol.app'`.
  - Save token via `NativeBiometric.setCredentials({ username: 'owner', password: token, server: 'com.kontrol.app' })` upon initial TOTP/PIN login or when enabled in `SettingsModal.tsx`.
  - On launch and `appStateChange` resume, run `NativeBiometric.verifyIdentity(...)` followed immediately by `NativeBiometric.getCredentials({ server: 'com.kontrol.app' })` to restore `kontrol_token` and unlock automatically, falling back to the 6-digit PIN if cancelled/unavailable.

### 3.2 API Client & Backend Safety (`app/src/lib/api.ts` & `server/`)
- **Base URL Rule:**
  - Web (`!Capacitor.isNativePlatform()`): MUST default `BASE` to relative `'/api'` so Vercel preview and production deployments hit their own backend origin.
  - Native (`Capacitor.isNativePlatform()`): Uses `import.meta.env.VITE_API_URL` (e.g., `https://kontrol-omega.vercel.app/api`).
- **Headers & 401 Handling:** Every `api.ts` request sends `Authorization: Bearer ${localStorage.getItem('kontrol_token')}` and `credentials: 'include'`. Any `401` response clears `kontrol_token` and dispatches `new Event('kontrol:lock')`.
- **Express Safety (`server/src/app.ts` & `server/src/routes/*.ts`):**
  - Keep `cors({ origin: true, credentials: true })` in `server/src/app.ts`.
  - Always destructure request bodies safely as `const { ... } = (req.body ?? {})` in all routes (`auth.ts`, etc.).
- **Database Integrity (`server/src/db.ts`):**
  - Live semester data is hosted on Supabase PostgreSQL. NEVER run `DROP TABLE`, `TRUNCATE`, or destructive migrations.

---

## 4. Attendance & Risk Domain Logic
- **Statuses:** `ATTENDED`, `SKIPPED`, `GHOST`, `CANCELLED`.
- **Calculation Rules:**
  - `CANCELLED` is excluded from total held classes.
  - `ATTENDED` and `GHOST` both count positively toward attendance eligibility (`(attended + ghost) / held >= requiredRatio`), while `ghostCount` is tracked separately so the user sees actual vs. ghosted attendance.
  - `SKIPPED` increments missed classes and reduces `remainingSkips`.
  - Every log (`ATTENDED`, `SKIPPED`, `GHOST`) records its local `YYYY-MM-DD` `log_date` for medical leave date exports in `AttendanceLogDrawer.tsx`.

---

## 5. Repository File Map

```text
d:/Code/Kontrol/
├── AGENTS.md                               # Operational guardrails & file map (this file)
├── .rgignore                               # Ignores build/cache/lockfiles for fast agent search
├── vercel.json                             # Vercel monorepo routing & serverless config
├── pnpm-workspace.yaml                     # Workspace definition (app, server)
│
├── app/                                    # React 19 + Vite 8 + Tailwind v4 + Capacitor 8
│   ├── index.html                          # viewport-fit=cover
│   ├── vite.config.ts                      # Path aliases (@/*)
│   ├── components.json                     # GlassyUI registry config (fetch new UI components here)
│   ├── capacitor.config.ts                 # com.kontrol.app, SystemBars insetsHandling: 'disable'
│   ├── android/app/src/main/
│   │   ├── AndroidManifest.xml             # adjustResize, USE_BIOMETRIC, USE_FINGERPRINT, POST_NOTIFICATIONS, SCHEDULE_EXACT_ALARM, RECEIVE_BOOT_COMPLETED
│   │   ├── java/com/kontrol/app/MainActivity.java # --sat, --sab, --kb JS injection + hardware layer
│   │   └── res/values/styles.xml           # Transparent system bar themes
│   └── src/
│       ├── main.tsx                        # Entry point & GlassProvider
│       ├── App.tsx                         # <AuthGate> wrapper + useIsMobile() desktop/mobile split
│       ├── index.css                       # Glass tokens, --sat/--sab fallbacks, animations
│       ├── components/
│       │   ├── AuthGate.tsx                # Centered GlassyUI lock/setup screen, TOTP, PIN, NativeBiometric
│       │   ├── AttendanceLogDrawer.tsx     # Date-tagged attendance/skip/ghost history & medical copy
│       │   ├── SettingsModal.tsx           # Lock now, biometric toggle, change PIN, reset TOTP
│       │   ├── mobile/
│       │   │   ├── MobileShell.tsx         # Mobile layout & active tab controller
│       │   │   ├── MobileTopBar.tsx        # Status-bar-padded top header + settings trigger
│       │   │   ├── MobileHeroMetric.tsx    # Overall attendance % hero stat
│       │   │   ├── ModuleCarousel.tsx      # Snap-scroll horizontal cards with active highlight
│       │   │   ├── QuickActionsRow.tsx     # Skip, Attended, Ghost, Timetable actions
│       │   │   ├── NextLectureBanner.tsx   # Next lecture status pill
│       │   │   ├── UpNextList.tsx          # Grouped priority preview list
│       │   │   └── MobileDock.tsx          # Floating bottom glass capsule dock
│       │   ├── navigation/
│       │   │   └── GlassDock.tsx           # Desktop floating bottom glass dock
│       │   ├── glassyui/                   # EXCLUSIVE UI PRIMITIVES (add new ones from GlassyUI registry)
│       │   │   └── glass-button.tsx, glass-panel.tsx, glass-input.tsx, glass-surface.tsx, glass-tabs.tsx, glass-provider.tsx
│       │   ├── ui/                         # GlassSheet.tsx (portal + keyboard-aware), ReactiveBackground.tsx
│       │   ├── timetable/                  # TimetableBoard.tsx, SlotCell.tsx, ModuleChip.tsx, ModulePalette.tsx
│       │   └── vault/                      # BuildVault.tsx, ProjectCard.tsx, ProjectFormModal.tsx, ActivityFormModal.tsx, ActivitiesAgenda.tsx
│       ├── hooks/                          # useCourses, useTimetable, useProjects, useActivities, useIsMobile, useDndSensors
│       └── lib/                            # api.ts, attendance-status.ts, dates.ts, notifications.ts, timetable.ts, utils.ts
│
└── server/                                 # Node 20 + Express 5 + PostgreSQL (Supabase)
    └── src/
        ├── app.ts                          # Express setup, cors({ origin: true, credentials: true }), route mounts
        ├── index.ts                        # Server entry point
        ├── auth.ts                         # JWT sign/verify, scrypt PIN hashing, otplib TOTP helpers
        ├── db.ts                           # PostgreSQL query helper
        ├── dates.ts                        # Server local date helpers
        ├── slots.ts & types.ts             # Timetable slot definitions & shared entity types
        └── routes/
            ├── auth.ts                     # /api/auth/* (status, setup, verify-totp, verify-pin, reset-totp, change-pin)
            ├── courses.ts                  # /api/courses/* (CRUD, eligibility stats incl. GHOST)
            ├── logs.ts                     # /api/courses/:id/logs (ATTENDED, SKIPPED, GHOST, CANCELLED)
            ├── timetable.ts                # /api/timetable/* (slots, swaps, today)
            ├── projects.ts                 # /api/projects/* (Build Vault projects)
            └── activities.ts               # /api/activities/* (Build Vault tasks)