# Universal Tenure Lifecycle & State Management System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a robust, universal tenure lifecycle engine that centrally recognizes, synchronizes, and orchestrates tenure transitions across the entire platform (backend Firestore collections, API routes, events, council team, clubs, registrations, payments, and public pages) with zero hardcoded tenure strings and instant real-time propagation.

**Architecture:** Create a unified `tenureEngine.ts` as the single authoritative source of truth for active tenure resolution and entity scoping. Add a backend API endpoint (`/api/admin/tenure/switch`) that executes atomic Firestore batch updates across `council_tenures`, `council_team`, `hosting_committee`, `clubs`, and individual `/events/{eventId}` documents. Enhance real-time client subscribers to detect active tenure switches instantly, auto-refresh active local caches, and broadcast lifecycle events across all browser tabs without page reloads.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Firebase Cloud Firestore (batch writes & real-time snapshot listeners), Tailwind CSS v4, Lucide React.

---

### Task 1: Create Universal Tenure Engine (`src/lib/tenureEngine.ts`)

**Files:**
- Create: `src/lib/tenureEngine.ts`
- Test: `tests/tenureEngine.test.ts` (or validation runner)

**Step 1: Write the failing test / contract specification**
Create `tests/tenureEngine.test.ts` to test:
- `getActiveTenure`: returns current active tenure from a list or defaults to latest academic year without hardcoding.
- `resolveEventTenure`: assigns event to correct tenure based on `tenureId`, `date`, or falls back to active tenure.
- `filterEventsForTenure`: strictly isolates events for active, past, or all tenures, correctly preserving umbrella fests and sub-events.
- `filterRegistrationsForTenure`: filters registration records by tenure.

**Step 2: Run test / typecheck to verify failure**
Run: `npx tsx tests/tenureEngine.test.ts`
Expected: FAIL (module `src/lib/tenureEngine` not found).

**Step 3: Implement `src/lib/tenureEngine.ts`**
- Implement `getActiveTenure(tenuresList?: CouncilTenure[]): CouncilTenure`
- Implement `getTenureById(id: string, tenuresList?: CouncilTenure[]): CouncilTenure | null`
- Implement `resolveEventTenure(event: Partial<EventItem>, tenuresList?: CouncilTenure[]): CouncilTenure`
- Implement `filterEventsForTenure(events: EventItem[], tenureId: string, tenuresList: CouncilTenure[], isScopedManager?: boolean, adminAccess?: any, userId?: string, allEvents?: EventItem[]): EventItem[]`
- Implement `filterRegistrationsForTenure(records: RegistrationRecord[], tenureId: string, events: EventItem[], tenuresList: CouncilTenure[]): RegistrationRecord[]`
- Implement React hook `useActiveTenure()` providing `{ activeTenure, allTenures, isLoading, switchTenure, undoTenure }` with automatic real-time event subscription.

**Step 4: Run test to verify it passes**
Run: `npx tsx tests/tenureEngine.test.ts`
Expected: PASS.

**Step 5: Commit**
```bash
git add src/lib/tenureEngine.ts tests/tenureEngine.test.ts
git commit -m "feat(tenure): implement universal tenure engine and active tenure resolver"
```

---

### Task 2: Create Atomic Backend API Route for Tenure Switching (`/api/admin/tenure/switch`)

**Files:**
- Create: `src/app/api/admin/tenure/switch/route.ts`
- Modify: `src/lib/tenureStore.ts:685-895`

**Step 1: Write the failing API test / contract verification**
Verify that a POST to `/api/admin/tenure/switch` with `{ targetTenureId, beginDate }` verifies authorization and executes an atomic Firestore transaction/batch.

**Step 2: Verify failure before endpoint exists**
Run: `curl -s -X POST http://localhost:3000/api/admin/tenure/switch -H "Content-Type: application/json" -d '{"targetTenureId":"test"}'`
Expected: 404 Not Found.

**Step 3: Implement `/api/admin/tenure/switch/route.ts`**
- Authenticate admin request using Firebase Auth token / admin session.
- Validate `targetTenureId` exists in `council_tenures`.
- Compute snapshot of outgoing active tenure:
  - Freeze council roster into `outgoingTenure.adminCouncil`.
  - Freeze hosting committee into `outgoingTenure.hostingCommittee`.
  - Freeze clubs and leads into `outgoingTenure.clubs`.
  - Stash past events into `outgoingTenure.events`.
  - Set `outgoingTenure.isCurrent = false`, `status = "archived"`, `endDate = beginIso`.
- Activate target tenure:
  - Set `targetTenure.isCurrent = true`, `status = "active"`, `startDate = beginIso`.
- Execute Firestore batch:
  - Write updated `council_tenures` document to `site_content/council_tenures`.
  - Write new council roster to `site_content/council_team`.
  - Write new hosting committee to `site_content/hosting_committee`.
  - Write new clubs roster to `site_content/clubs`.
  - Write updated event docs into `/events/{eventId}` stamping new active events with `tenureId` & `tenureLabel`.
- Return `{ success: true, activeTenure: targetTenure }`.

**Step 4: Update `switchActiveTenure` in `src/lib/tenureStore.ts`**
- Call `/api/admin/tenure/switch` first for atomic cloud execution.
- If offline, fallback to client-side dual-write queue (`saveStoredTenures`, `saveStoredCouncilMembers`, etc.).
- Broadcast custom events: `src_tenure_changed`, `src_tenures_updated`, `src_council_team_updated`, `src_hosting_updated`, `src_clubs_updated`, `src_events_updated`.

**Step 5: Verify build & commit**
Run: `npm run build`
Commit:
```bash
git add src/app/api/admin/tenure/switch/route.ts src/lib/tenureStore.ts
git commit -m "feat(api): add atomic backend tenure switch endpoint and dual-write integration"
```

---

### Task 3: Universal Real-Time Reactive Listener in `tenureStore.ts`

**Files:**
- Modify: `src/lib/tenureStore.ts:1216-1257`

**Step 1: Write test case for remote tenure switch detection**
When `subscribeToTenures` receives a remote payload where `remoteActive.id !== localActive.id`:
- Verify that `src_tenure_changed` is fired.
- Verify that active council, hosting, and clubs stores are atomically refreshed from the new active tenure snapshot.

**Step 2: Implement auto-reconciliation in `subscribeToTenures`**
- Compare `currentLocalActiveId` vs `newRemoteActiveId`.
- If a remote transition occurred:
  - Update `src_council_team` in storage with `newRemoteActive.adminCouncil` and dispatch `src_council_team_updated`.
  - Update `src_hosting_committee` in storage with `newRemoteActive.hostingCommittee` and dispatch `src_hosting_updated`.
  - Update `src_clubs` in storage with `newRemoteActive.clubs` and dispatch `src_clubs_updated`.
  - Dispatch `src_tenure_changed` with detail `newRemoteActive`.
  - Notify all UI subscribers across all tabs.

**Step 3: Verify build & commit**
Run: `npm run build`
Commit:
```bash
git add src/lib/tenureStore.ts
git commit -m "feat(tenure): add reactive multi-tab tenure change reconciliation in snapshot listener"
```

---

### Task 4: Eliminate Hardcoded Fallback Tenure Strings Across the Entire Platform

**Files:**
- Modify: `src/components/registration/RegistrationWizard.tsx` (lines 891, 972, 1223)
- Modify: `src/lib/cashfree.ts` (lines 456, 514)
- Modify: `src/app/admin/payments/page.tsx` (line 172)
- Modify: `src/app/admin/events/page.tsx` (lines 102, 448, 833, 884)
- Modify: `src/app/admin/registrations/page.tsx` (line 153)
- Modify: `src/app/admin/team/page.tsx` (lines 321, 400, 435, 443, 451, 460)
- Modify: `src/app/admin/clubs/page.tsx` (line 103)

**Step 1: Audit all occurrences of hardcoded "tenure-2025-26" and "tenure-2026-27"**
Replace every static fallback string with `getActiveTenure().id` or `getActiveTenure().label`.

**Step 2: Update `RegistrationWizard.tsx` and `cashfree.ts`**
- In order creation and registration pass generation, dynamically resolve `tenureId` from `event.tenureId` or `getActiveTenure().id`.

**Step 3: Update Admin Studios (`payments`, `registrations`, `events`, `team`, `clubs`)**
- Initial state hooks `useState(() => getActiveTenure().id)` so newly activated tenures are immediately selected upon entering any admin studio.

**Step 4: Verify build & commit**
Run: `npm run build`
Commit:
```bash
git add src/components/registration/RegistrationWizard.tsx src/lib/cashfree.ts src/app/admin/payments/page.tsx src/app/admin/events/page.tsx src/app/admin/registrations/page.tsx src/app/admin/team/page.tsx src/app/admin/clubs/page.tsx
git commit -m "refactor(tenure): eliminate hardcoded tenure strings in favor of dynamic active tenure resolver"
```

---

### Task 5: Align Public Pages (`/team`, `/clubs`, `/events`, `/archive`) with Universal Tenure System

**Files:**
- Modify: `src/app/team/page.tsx`
- Modify: `src/app/clubs/page.tsx`
- Modify: `src/app/events/page.tsx`
- Modify: `src/app/archive/page.tsx`
- Modify: `src/components/home/LeadershipSpotlightSection.tsx`

**Step 1: Update `/team/page.tsx`**
- Listen for `src_tenure_changed` custom event to immediately re-render active council and hosting members without requiring a manual page refresh.
- Display current tenure badge dynamically.

**Step 2: Update `/clubs/page.tsx`**
- Dynamically reflect current tenure's chartered clubs and active club leaders.
- Update upon `src_tenure_changed` and `src_clubs_updated`.

**Step 3: Update `/events/page.tsx`**
- Use `filterEventsForTenure(eventsList, activeTenure.id, tenuresList)` to strictly display current tenure events in the main calendar.
- Add an intuitive link/toggle to view past tenure events on `/events/past` or `/archive`.

**Step 4: Update `/archive/page.tsx`**
- Verify that every archived tenure displays its preserved snapshots of council members, clubs, and events cleanly.

**Step 5: Verify build & commit**
Run: `npm run build`
Commit:
```bash
git add src/app/team/page.tsx src/app/clubs/page.tsx src/app/events/page.tsx src/app/archive/page.tsx src/components/home/LeadershipSpotlightSection.tsx
git commit -m "feat(pages): bind public team, clubs, events, and archive pages to universal tenure lifecycle"
```

---

### Task 6: System Verification & End-to-End Simulation

**Files:**
- Create: `scratch/simulate-tenure-switch.ts`

**Step 1: Run comprehensive end-to-end simulation script**
- Simulate tenure activation of a new academic year tenure.
- Verify that:
  1. Active tenure switches cleanly.
  2. Council team reflects the new tenure roster.
  3. Clubs show the new tenure's leadership.
  4. Events are partitioned into past vs active correctly.
  5. Payment and registration filters scope cleanly.
  6. Reverting / undoing the tenure restores the previous active tenure state.

**Step 2: Run production Next.js build**
Run: `npm run build`
Expected: Exit code 0, 0 type errors, all routes statically and dynamically optimized.

**Step 3: Final Git push**
Run: `/Library/Developer/CommandLineTools/usr/bin/git push origin main`
Expected: Pushed cleanly.
