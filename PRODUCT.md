# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

- Field employees carry an administrator-enrolled low-end Android phone. The
  app shows whether managed tracking is healthy but does not expose start,
  stop, pause, or unenrollment controls.
- Managers and administrators use a web dashboard to find team members, judge
  location freshness, inspect routes, export records, and manage retention or
  deletion within their authority.

## Product Purpose

Answer “Where is each employee now, and where have they been during retained
work windows?” at substantially lower cost than the current tower-based provider.

Success means managers can find a current employee location in under ten
seconds, at least 95% of active employees have a point less than five minutes
old, an eight-hour work period adds less than 10% battery use, and offline points
recover automatically.

## Positioning

Field Track combines administrator-enrolled Android GPS, offline-first capture,
server-managed retention, and freshness-aware manager visibility. It exposes
signal gaps honestly instead of treating “offline” and “ignored by policy” as the
same state.

## Operating Context

Employees may move between weak 4G coverage areas, reboot low-memory phones,
or remain stationary for long periods. Managers monitor up to roughly 100
employees across teams and regions from a desktop or tablet and may inspect an
individual route by date.

## Capabilities and Constraints

- Tracking starts after administrator enrollment and has no employee control.
  Android always shows the required foreground-service notification.
- Administrators create an employee/number assignment and hand off a hashed,
  expiring, single-use code. Android requires an active SIM selection before
  redemption and receives a separate device credential for ongoing uploads.
- Moving samples target 30–60 seconds; stationary samples target 3–5 minutes;
  poor fixes may temporarily request higher accuracy.
- Points include employee/device identity, coordinates, timestamps, accuracy,
  battery level, source, retention-policy identity, and a current selected-SIM
  snapshot. SIM data is advisory and never authenticates a request.
- Offline points are durable in native SQLite and upload in batches when 4G
  returns. The app requests service recovery after launch, task removal, boot,
  and package update.
- The server independently retains or discards acknowledged points using the
  administrator-assigned policy. Off duty and Offline remain separate states.
- Manager access is team-scoped. History access is audited. Employee and
  historical-data deletion are supported.
- Raw points default to 90-day retention, daily summaries to one year, and the
  latest point until replacement or employee deletion. Retention is
  administrator-configurable.
- V1 uses HTTPS requests and dashboard polling rather than WebSockets.
- Distance is approximate and must not be represented as reimbursement-grade.

## Evidence on Hand

- The product brief defines roles, data fields, status thresholds, retention,
  non-goals, success metrics, and a staged 5 → 20 → 100 employee rollout.
- No real employee records, customer logos, route samples, testimonials, or
  production benchmarks are available. Demonstration content must be clearly
  labeled synthetic.

## Product Principles

1. Managed tracking must remain visible through Android's ongoing notification.
2. Freshness and uncertainty must remain visible, never implied away.
3. The employee experience should survive weak networks and constrained phones.
4. The manager experience should be dense, direct, and operational.
5. Prefer ordinary, low-cost infrastructure over real-time novelty.

## Accessibility & Inclusion

The React Native enrollment/health app must use large touch targets, system
font scaling, and explicit managed tracking state. The manager dashboard
must support keyboard operation, visible focus, non-color status cues, readable
map alternatives, and responsive use at 390, 768, and 1440 pixels.
