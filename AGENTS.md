# AI Agent Operational Directives — SRC JDCOEM Web Platform

This repository enforces strict production engineering standards. Every agent working in this codebase must adhere to the following directives without exception.

For detailed standards and implementation examples, refer to [DEVELOPMENT_RULES.md](file:///Users/harshxfr/SRC%20web/DEVELOPMENT_RULES.md).

---

## Non-Negotiable Directives

1. **Every Feature Must Actually Work**:
   - Never implement mockup or half-baked UI buttons. If a button, modal, or input exists, its entire data flow (validation, persistence, event dispatch, Firestore sync, and refresh endurance) must be fully implemented and verified.

2. **The 5MB LocalStorage Invariant**:
   - Never write raw base64 photos or uncompacted camera files directly into `localStorage`.
   - Always run dataset auto-compaction (`compactCouncilDataset`, `compactPillarsDataset`, `compactClubDataset`) before writing.
   - Always wrap `localStorage.setItem` in try/catch.

3. **Instant Cloud Synchronization Invariant**:
   - Every single store write, edit, addition, reorder, or deletion must immediately trigger direct cloud synchronization to Firestore (`saveSiteContentToFirestore(collection, data)`).
   - Never defer or lazy-sync cloud writes. Local state and cloud state must be updated in parallel.
   - Combine direct instant Firestore writes with atomic queue backup (`enqueueCloudWrite`) so connectivity dips never drop data.
   - Ensure Firestore real-time subscribers immediately broadcast cloud changes across all browser tabs via custom events.

4. **No Silent Data Stripping**:
   - Never wipe or overwrite user-saved data with empty strings or stock placeholders.
   - `MAX_SAFE_BASE64_LENGTH` in `dataSyncEngine.ts` is 350,000 bytes.
   - Always preserve all optional fields (`email`, `linkedin`, `quote`, `bio`, `order`) during object mapping.

5. **Zero-Latency Optimistic State Updates for Images**:
   - In `ImageUploadDropzone`, generate an optimized high-density WebP data URL in `< 50ms` and call `onUrlChange` immediately.
   - Do not make the form wait on Firebase Cloud Storage network requests before saving. Cloud upload runs in the background.
   - Always include `unoptimized={true}` on Next.js `<Image />` when rendering dynamic or base64 assets.

6. **Draft Isolation Invariant**:
   - Public pages (`/team`, `/about`, `/events`, `/archive`) must never display items with `isLive === false` or `status === "draft"`.
   - Draft states are strictly reserved for `/admin/*` views.

7. **Quality & Verification Gate**:
   - Before completing any task, run `npm run build`. The build must succeed with code 0 and 0 errors.
   - Test data persistence across full page refreshes.
   - Commit all changes with clean Conventional Commits.
