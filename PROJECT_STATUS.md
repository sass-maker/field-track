# field-track — PROJECT STATUS

Last updated: 2026-08-12

## Why / What

Field Track is a private, low-cost system for continuously locating field
employees on managed Android devices and reviewing retained routes. It targets roughly
100 employees using existing low-end Android phones and intermittent 4G.

**Users:** Field employees carrying an administrator-enrolled Android device,
and team-scoped managers or administrators who monitor retained locations.

**In scope:** Native Android foreground tracking without employee controls;
offline point capture and batch upload; server retention policy; current-location and route APIs; team-scoped admin
dashboard; status freshness; CSV export; configurable retention; history-access
audit records; deletion workflows.

**Out of scope:** Attendance and payroll; task assignment; route optimization;
expense calculation; video or audio; reimbursement-grade distance; custom
cell-tower triangulation; strong anti-spoofing; one-second tracking.

## Dependencies

### External

- Android foreground service and Google Play Services Location.
- React Native for device enrollment and health UI.
- Cloudflare Workers and D1 for the API and relational storage.
- OpenStreetMap-compatible vector tiles rendered with MapLibre.

### Internal

- No runtime dependency on the private Fleet workspace.

## Timeline

- 2026-08-12 — Private repository and product planning scaffold created.
- 2026-08-12 — React Native/Kotlin Android collector and Astro manager MVP
  implemented with synthetic local demo mode and a Worker/D1 production path.
- 2026-08-12 — Added administrator employee onboarding with a phone-bound,
  single-use code, Android active-SIM selection, and manager-visible SIM health.

## Products

- **Employee Android app** — administrator enrollment, native foreground
  tracking, visible notification, adaptive sampling, offline SQLite queue, and
  lifecycle restart paths; no employee tracking controls.
- **Admin dashboard** — team-scoped live map, employee status, route history,
  retention controls, and export.
- **Location API** — authenticated continuous point ingestion, retention policy, current
  state, historical queries, deletion, retention, and access auditing.

## Features (shipped)

- Continuous native Android location service with adaptive sampling.
- Durable native SQLite point queue with bounded HTTPS batch retry.
- Live manager map and roster with freshness status, search, and filters.
- Employee route history, metrics, tracking gaps, and audited CSV export.
- D1 relational schema, one-time device enrollment, team-scoped manager queries,
  device-token verification, server retain/discard policy, policy assignment,
  history audits, deletion API, retention settings, and daily-summary storage.
- Admin-only employee creation and expiring code handoff; stable Android install
  identity; per-upload selected-SIM presence/carrier/number reporting and mismatch warnings.
- Synthetic demo mode for credential-free local development.

## Work queue

- [GitHub Issues](https://github.com/sass-maker/field-track/issues)
