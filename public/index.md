# Field Track

Field Track is a held MVP for small field teams that need managed Android location tracking and a freshness-aware manager dashboard.

## What the demo shows

- A clearly labeled synthetic roster, route map, employee detail view, and CSV export path
- Fresh, stale, offline, and off-duty states based on each phone's last recorded point and the server retention policy
- Administrator enrollment, offline point capture, batch upload, team-scoped history, and visible route gaps

## Managed tracking boundary

After administrator enrollment, the employee app tracks continuously and does not expose start, stop, pause, or unenroll controls. Android keeps the required foreground-service location notification visible. The dashboard does not hide weak signal, stale data, or server policy ignoring a point.

## Current state

The public dashboard uses fictional employees and routes and has no production database binding. Economics and physical-device Android testing remain unresolved. Review this as an MVP concept, not an available rollout. Reopen it only after the business case and a real-device pilot hold up.

## Public surfaces

- [Interactive synthetic demo](https://field-track.sassmaker.com/)
- [Agent catalog](https://field-track.sassmaker.com/api/ai)
- [OpenAPI description](https://field-track.sassmaker.com/openapi.json)
- [AI index](https://field-track.sassmaker.com/llms.txt)
