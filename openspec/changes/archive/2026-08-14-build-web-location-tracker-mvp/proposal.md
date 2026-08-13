## Why

Field Track needs a native Android employee collector plus a web manager
surface. Employees do not control tracking; once a company device is enrolled,
it continuously reports location and the backend decides which points to retain.

## What Changes

- Build a React Native Android enrollment/status shell backed by a native Kotlin
  foreground location service, boot receiver, SQLite queue, and HTTPS uploader.
- Let an administrator create an employee and short-lived, single-use enrollment
  code bound to that employee's assigned phone number and retention policy.
- Let the Android installer select an active SIM, redeem the code once, and send
  current SIM presence and metadata with every authenticated location batch.
- Keep the Astro application for the live manager dashboard, employee detail,
  filters, route history, and export.
- Collect continuously after administrator enrollment; show Android's required
  persistent notification but no employee start/stop control.
- Store unsent points in native SQLite and upload batches after 4G returns.
- Apply server-managed retention windows during ingestion so ignored points are
  acknowledged without entering history or latest-location state.
- Derive Active, Stale, Offline, and Off duty independently; poll the manager
  dashboard every 15 seconds.
- Seed synthetic demo data so the manager product runs locally without credentials.

## Capabilities

### New Capabilities

- `android-continuous-tracking`: Administrator enrollment, always-on Android
  foreground tracking, boot recovery, native offline queueing, and server-side
  retention decisions.
- `manager-operations`: Live employee status, filters, current positions,
  historical routes, and CSV export over a role-ready backend API.

### Modified Capabilities

- None.

## Impact

- **Code:** An Astro/React manager app, Worker API routes and D1 migrations, plus
  an Android-only React Native app with a native Kotlin tracking service.
- **Dependencies:** Existing Astro/React/Cloudflare/MapLibre dependencies plus
  React Native and Google Play Services Location for Android GPS delivery.
- **Privacy:** Android shows a persistent foreground-service notification;
  server retention windows, history reads, and exports are auditable; synthetic
  data only is committed.
- **Authentication:** SIM identity is advisory device context. The one-time code
  bootstraps a revocable device credential, which authenticates all later uploads.
- **Deploy:** No app signing, Play distribution, Cloudflare resource creation,
  migration, or deployment is included.
- **Limitation:** Android vendors may still throttle or terminate background
  work; the app restarts on boot/task removal and surfaces device freshness.
