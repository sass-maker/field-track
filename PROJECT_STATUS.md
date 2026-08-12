# field-track — PROJECT STATUS

Last updated: 2026-08-12

## Why / What

Field Track is a private, low-cost system for locating field employees during
an explicitly active shift and reviewing their shift routes. It targets roughly
100 employees using existing low-end Android phones and intermittent 4G.

**Users:** Field employees who start and end tracking, and team-scoped managers
or administrators who monitor current and historical locations.

**In scope:** Native Android shift tracking; offline point capture and batch
upload; restart recovery; current-location and route APIs; team-scoped admin
dashboard; status freshness; CSV export; configurable retention; history-access
audit records; deletion workflows.

**Out of scope:** Attendance and payroll; task assignment; route optimization;
expense calculation; video or audio; reimbursement-grade distance; custom
cell-tower triangulation; strong anti-spoofing; one-second tracking.

## Dependencies

### External

- Android platform location and foreground-service APIs.
- Cloudflare Workers and D1 for the API and relational storage.
- OpenStreetMap-compatible vector tiles rendered with MapLibre.

### Internal

- No runtime dependency on the private Fleet workspace.

## Timeline

- 2026-08-12 — Private repository and product planning scaffold created.

## Products

- **Employee Android app** — shift controls, visible tracking state, offline
  queue, adaptive sampling, and reliable recovery.
- **Admin dashboard** — team-scoped live map, employee status, route history,
  retention controls, and export.
- **Location API** — authenticated point ingestion, shift lifecycle, current
  state, historical queries, deletion, retention, and access auditing.

## Features (shipped)

- (none yet)

## Work queue

- [GitHub Issues](https://github.com/sass-maker/field-track/issues)
