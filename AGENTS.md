## Shared Fleet Standard

Also read and follow the shared fleet-level agent standard at `../AGENTS.md`. Treat this repository as owned product code: protect production stability, keep changes scoped, verify work, and record durable follow-up tasks when something remains incomplete or blocked.

## Project

- **Stack**: React Native Android + native Kotlin foreground service; Astro + React islands; Cloudflare Worker + D1; MapLibre
- **Package manager**: pnpm
- **Local dev**: `pnpm dev` for the manager/API; `pnpm mobile:start` and `pnpm mobile:android` for Android
- **Deploy**: manual only; Cloudflare bindings and Access policy are a separate release gate

## Product constraints

- Enrolled Android devices track continuously and expose no employee start/stop control.
- Keep Android's foreground-service notification visible while tracking.
- Preserve the distinction between no signal and server policy ignoring points.
- Optimize for low-end Android hardware, intermittent 4G, and an approximately 100-employee fleet.
- Do not put credentials, employee history, production identifiers, or real employee data in the repository.
- Read `PRODUCT.md` and the active OpenSpec change before feature work.

## Visual work

Keep the employee surface simple enough for a low-end Android phone and the
manager surface dense, keyboard-operable, and usable without map tiles.
