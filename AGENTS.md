## Shared Fleet Standard

Also read and follow the shared fleet-level agent standard at `../AGENTS.md`. Treat this repository as owned product code: protect production stability, keep changes scoped, verify work, and record durable follow-up tasks when something remains incomplete or blocked.

## Project

- **Stack**: Kotlin Android + Room/WorkManager; Vite + React; Cloudflare Worker + D1
- **Package manager**: pnpm for TypeScript workspaces; Gradle wrapper for Android
- **Local dev**: use repository scripts once the active OpenSpec change scaffolds them
- **Deploy**: manual only; Android distribution and Cloudflare deployment remain separate release gates

## Product constraints

- Track an employee only during an explicitly active shift.
- Keep the foreground-service notification visible while Android tracking runs.
- Preserve the distinction between no signal and an ended shift in every API and UI state.
- Optimize for low-end Android hardware, intermittent 4G, and an approximately 100-employee fleet.
- Do not put credentials, employee history, production identifiers, or real employee data in the repository.
- Read `PRODUCT.md`, `DESIGN.md`, and the active OpenSpec change before feature work.

## Visual work

For meaningful visual work, use the Fleet-local `$design-workflow` skill and
the shared `../LANDING_STANDARD.md` where applicable. Classify preserve or
overhaul before code; keep `PROJECT_STATUS.md` authoritative for product
scope, `PRODUCT.md` limited to design context, and `DESIGN.md` authoritative
for visual direction. Do not claim completion until the Fleet design-review
receipt passes.
