# Product

<!-- impeccable:product-schema 1 -->

## Platform

adaptive

## Users

- Field employees use an existing low-end Android phone during an eight-hour
  work shift. They need one obvious start/end control and an unmistakable view
  of whether tracking is active.
- Managers and administrators use a web dashboard to find team members, judge
  location freshness, inspect routes, export records, and manage retention or
  deletion within their authority.

## Product Purpose

Answer “Where is each employee now, and where have they been during their
shift?” at substantially lower cost than the current tower-based provider,
without tracking outside an explicitly active shift.

Success means managers can find a current employee location in under ten
seconds, at least 95% of active employees have a point less than five minutes
old, an eight-hour shift adds less than 10% battery use, and offline points
recover automatically.

## Positioning

Field Track combines employee-controlled shift boundaries with phone-native GPS,
offline-first capture, and freshness-aware manager visibility. It exposes
signal gaps honestly instead of treating “offline” and “not on shift” as the
same state.

## Operating Context

Employees may move between weak 4G coverage areas, restart low-memory phones,
or remain stationary for long periods. Managers monitor up to roughly 100
employees across teams and regions from a desktop or tablet and may inspect an
individual route by date.

## Capabilities and Constraints

- Tracking is permitted only while a shift is active and always has a visible
  Android foreground-service notification.
- Moving samples target 30–60 seconds; stationary samples target 3–5 minutes;
  poor fixes may temporarily request higher accuracy.
- Points include employee/device identity, coordinates, timestamps, accuracy,
  battery level, source, and shift identity.
- Offline points are durable on-device and upload in batches when connectivity
  returns. An active shift resumes after app or phone restart.
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

1. Consent and shift boundaries outrank location completeness.
2. Freshness and uncertainty must remain visible, never implied away.
3. The employee experience should survive weak networks and constrained phones.
4. The manager experience should be dense, direct, and operational.
5. Prefer ordinary, low-cost infrastructure over real-time novelty.

## Accessibility & Inclusion

The Android app must follow Material 3, system font scaling, 48 dp touch targets,
system Back, reduced-motion settings, and clear foreground-service state. The
web dashboard must support keyboard operation, visible focus, non-color status
cues, readable map alternatives, and responsive use at 390, 768, and 1440
pixels.
