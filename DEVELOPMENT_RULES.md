# SRC JDCOEM — Production-Grade Engineering & Development Rules

> **Mandatory Standard**: Every feature, UI element, and data flow in this codebase must function with the reliability, resilience, and polish of a Tier-1 production web application. Half-baked implementations, non-functional UI buttons, silent data loss, and unverified mock behavior are strictly prohibited.

---

## 1. The Core Invariant: "Every Feature Must Actually Work"

1. **No Phantom UI**:
   - Never add a button, dropdown, input, toggle, or modal that does not perform its full real-world lifecycle.
   - If a button says "Save", "Import", "Export", "Crop", "Delete", or "Switch", it **must**:
     1. Validate input cleanly with user feedback.
     2. Persist the change immediately to local cache (`localStorage`) and enqueue cloud sync (`Firestore`).
     3. Dispatch standard custom events so all open tabs and components react instantaneously.
     4. Maintain state across full page refreshes (`Ctrl+R` / `F5`).
     5. Handle errors gracefully without silent failures or crashing the component tree.

2. **The 3-Step Verification Gate (Definition of Done)**:
   Before any task is considered complete, you must verify:
   - **Step 1 — Build Gate**: Run `npm run build` to confirm 0 TypeScript, Lint, and Webpack errors.
   - **Step 2 — Refresh & Persistence Gate**: Any data saved or modified must remain intact after a hard browser refresh and across tenure/tab switches.
   - **Step 3 — Public vs. Admin Consistency Gate**: Changes made in `/admin` must reflect immediately on the corresponding public pages (`/about`, `/team`, `/clubs`, `/events`, etc.).

---

## 2. Data Architecture & Storage Invariants

1. **The 5MB Browser LocalStorage Quota Rule**:
   - Browsers enforce a strict **5MB origin quota** on `localStorage`.
   - **NEVER** write raw, uncompressed camera photos, DSLR captures, or multi-megabyte canvas exports directly into `localStorage`. This throws a fatal `QuotaExceededError` that silently aborts data saving.
   - **Mandatory Compaction**: All images saved to stores or cached locally must pass through auto-compaction (e.g., `compactCouncilDataset`, `compactPillarsDataset`, `compactClubDataset`):
     - **Avatars / Portraits (1:1 and 4:5)**: Max width/height 600–800px, WebP quality 0.85–0.90 (~25KB–45KB).
     - **Hero / Banners (16:9 and 21:9)**: Max width 1600px, WebP quality 0.88 (~70KB–120KB).
   - Always wrap `localStorage.setItem` in a `try / catch` block and provide auto-compaction recovery if a quota notice occurs.

2. **No Silent Data Stripping**:
   - The sync engine must never wipe user data without replacement.
   - The `MAX_SAFE_BASE64_LENGTH` threshold must accommodate properly compacted WebP images (minimum 350,000 bytes) so legitimate user-uploaded photos are never replaced with empty strings (`""`).

3. **Two-Tier Synchronization Pattern**:
   Whenever updating site content:
   - **Tier 1 (Instant Local Write)**: Sanitize data with `cleanUndefined()`, write to `localStorage`, and fire `window.dispatchEvent` so the UI responds in 0 milliseconds.
   - **Tier 2 (Asynchronous Cloud Sync)**: Compact the dataset, invoke direct cloud write `saveSiteContentToFirestore(collection, data)`, and enqueue to the offline-resilient `enqueueCloudWrite` queue as a guaranteed fallback.

4. **Data Integrity & Field Preservation**:
   - When updating an object in a store or admin form, **never drop optional fields**.
   - If a pillar, member, or club has `email`, `linkedin`, `quote`, `bio`, `order`, or custom properties, every mapper, form, and modal must preserve them:
     ```typescript
     avatar: editingMember.avatar || p.avatar,
     linkedin: editingMember.linkedin ?? p.linkedin ?? "",
     ```

---

## 3. Image Upload & Cropping Studio Standards

1. **Zero-Latency Optimistic State Update**:
   - When an admin selects or crops an image, **do not block form submission** on cloud storage network latency.
   - Immediately optimize the image locally to a high-density WebP data URL and fire `onUrlChange(immediateOptimizedUrl)` in `< 50ms`.
   - The admin can click "Save Changes" at any second, and their new image is guaranteed to persist.
   - In the background, upload the original asset to Firebase Storage and promote the URL to the permanent CDN URL when complete.

2. **Canvas Export Sizing**:
   - Always dimension canvas exports to the actual requirements of the component.
   - Never generate 4K/2K canvases for small avatars or card portraits.
   - Always set `crossOrigin="anonymous"` on image elements before canvas operations to avoid CORS canvas tainting (`SecurityError`).

3. **Next.js `<Image />` Display Invariant**:
   - Dynamic user-uploaded assets (Base64 data URLs, blob URLs, and external domains) must always include `unoptimized={true}` on Next.js `<Image />` components:
     ```tsx
     <Image
       src={avatarUrl}
       alt={name}
       fill
       unoptimized={true}
       className="object-cover"
     />
     ```
   - This eliminates 400 Bad Request image optimizer errors and broken image icons.

---

## 4. Draft vs. Live Security & Visibility Rules

1. **Strict Public Isolation**:
   - A tenure, event, or council marked as **Draft** (`isLive: false` or `status: "draft"`) must **NEVER** appear on public client pages.
   - Public pages (`/team`, `/about`, `/events`, `/archive`) must query only live, published datasets:
     ```typescript
     const visibleTenures = tenures.filter((t) => t.isLive && t.status === "live");
     ```
   - Draft tenures and unreleased items may only be viewed, edited, and previewed inside `/admin/*` after admin authorization.

2. **Tenure Versioning & Cloning**:
   - When copying or importing positions from past tenures into a new tenure:
     - Retain all hierarchical ordering, position titles, departments, and structure.
     - Clear past appointees' personal details (photos, contact info, names) if "Clean Appointees" mode is selected.
     - Save the new draft tenure immediately to both `localStorage` and Firestore draft collections (`src_draft_council_${tenureId}`) so refreshes do not revert the import.

---

## 5. UI/UX & Responsive Design Rules

1. **Visual Hierarchy & Layout Rhythm**:
   - Follow the established JDCOEM color palette:
     - **Primary Navy**: `#17458F`
     - **Vibrant Accent Orange**: `#E78023`
     - **Neutral Surfaces**: Slate-50, Slate-100, Slate-200, White
     - **Text Hierarchy**: `#0F172A` (Headings), `#334155` (Body), `#64748B` (Muted/Meta)
   - Every interactive element (buttons, cards, inputs) must provide explicit `:hover`, `:focus-visible`, and `:active` states.

2. **Form Validation & User Feedback**:
   - All admin forms must provide immediate visual feedback on save:
     - Button states: `Saving...`, `Saved!`, and `Upload in progress...`.
     - Toast notifications confirming success or explaining errors.
   - Never leave an admin wondering if a button click did anything.

3. **Mobile-First Responsiveness**:
   - All modals, cards, grids, and tables must be tested on mobile viewport widths (360px–420px) as well as desktop (1024px–1440px).
   - Modals must fit within mobile viewports with smooth `overflow-y-auto` scrolling and touch-accessible tap targets (minimum 44x44px).

---

## 6. Code Quality & Maintenance Protocol

1. **Zero Warnings / Zero Broken Types**:
   - No `any` type escapes when proper domain models exist in `@/types`.
   - Maintain documentation integrity: do not delete architectural comments or domain reasoning.
2. **Git Commit Discipline**:
   - Every commit must follow Conventional Commits format:
     - `feat(...)`: New user-facing capabilities
     - `fix(...)`: Bug fixes and reliability repairs
     - `refactor(...)`: Performance and architectural hardening
     - `docs(...)`: Documentation and rule updates
   - Never leave uncommitted or unstaged changes after concluding a development task.
