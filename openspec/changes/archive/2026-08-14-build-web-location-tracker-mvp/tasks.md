## 1. Shared foundation

- [x] 1.1 Keep the Astro/React/Cloudflare project and shared location contracts on current verified dependencies.
- [x] 1.2 Update status derivation and the D1 schema for continuous devices, retention policies, points, latest locations, and audit events.
- [x] 1.3 Verify shared logic with focused tests and Astro type checking.

## 2. Policy-aware backend

- [x] 2.1 Implement device enrollment/bootstrap and authenticated continuous batch ingestion.
- [x] 2.2 Apply server-managed retain/discard policy without relying on an employee shift action.
- [x] 2.3 Keep scoped live roster, dated route history, deletion, and audited CSV export endpoints.
- [x] 2.4 Verify API contracts, access denials, policy decisions, status thresholds, and CSV output.

## 3. Android employee app

- [x] 3.1 Scaffold the Android-only React Native enrollment and health surface without employee tracking controls.
- [x] 3.2 Implement the Kotlin foreground location service, persistent notification, adaptive sampling, and battery metadata.
- [x] 3.3 Implement native SQLite queueing, authenticated HTTPS batches, bounded retry, and acknowledgement deletion.
- [x] 3.4 Add boot, app-update, task-removal, and enrolled-app restart paths.
- [x] 3.5 Verify TypeScript, Android lint/compile, and native unit checks available in the local environment. (Hosted Java 21 CI passed `lintDebug`, `testDebugUnitTest`, and `assembleDebug`; the local machine has no Java runtime.)

## 4. Manager operations surface

- [x] 4.1 Keep the live manager roster, search/filter controls, and 15-second polling.
- [x] 4.2 Keep MapLibre current-position and dated-route views with a tile-independent roster fallback.
- [x] 4.3 Update manager language and status presentation for continuous device tracking and server policy.
- [x] 4.4 Verify dashboard responsiveness, keyboard access, type checking, and a production build.

## 5. Documentation and completion

- [x] 5.1 Document Android enrollment, permissions, foreground notification, policy boundaries, local setup, and D1 commands.
- [x] 5.2 Run the full available test, typecheck, Android, and web build suite; record skipped device-only validation.

## 6. Employee onboarding

- [x] 6.1 Add employee assignment and one-time enrollment-code APIs with scoped administrator access and audit events.
- [x] 6.2 Persist expected/reported SIM metadata and expose device enrollment and SIM health in the live roster.
- [x] 6.3 Add the preserve-mode manager onboarding workflow with a one-time code handoff and device/SIM state.
- [x] 6.4 Add Android active-SIM discovery and selection, stable install identity, code redemption, and SIM metadata on every upload.
- [x] 6.5 Verify onboarding helpers, D1 schema, API/demo behavior, web/mobile type checks, production build, and responsive UI evidence.
