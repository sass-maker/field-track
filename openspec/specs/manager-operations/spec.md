# manager-operations Specification

## Purpose
Lets an authorized manager quickly inspect current employee freshness and
historical shift routes from one operational web dashboard.
## Requirements
### Requirement: Manager employee onboarding
An administrator SHALL be able to create an employee assignment with employee
code, name, phone number, team, and retention policy and receive a plaintext
single-use enrollment code exactly once.

#### Scenario: Administrator creates an assignment
- **WHEN** valid employee and assignment details are submitted
- **THEN** the employee is created, a hashed expiring code is stored, and the plaintext code is shown once for handoff

### Requirement: Enrollment and SIM health visibility
The manager surface SHALL distinguish not enrolled, enrolled but never seen,
reporting, SIM number unavailable, SIM mismatch, and selected SIM absent states.

#### Scenario: Enrolled device reports a different SIM number
- **WHEN** a device batch includes a readable number that differs from the assigned phone number
- **THEN** the roster and employee detail show a warning without treating the batch as unauthenticated

### Requirement: Live employee status
The manager surface SHALL show authorized employees with current location,
last-updated time, accuracy, battery, and Active, Stale, Offline, or Off duty
status.

#### Scenario: Status ages without a new point
- **WHEN** an open shift's latest recorded point ages past 2 and 10 minutes
- **THEN** its connectivity status changes from Active to Stale to Offline independently of duty policy

### Requirement: Duty policy visibility
The manager surface SHALL show whether each device's points are currently being
retained or ignored by server-managed policy.

#### Scenario: Retention window closes
- **WHEN** an employee's assigned retention window closes
- **THEN** the manager sees Off duty without the employee controlling or ending tracking

### Requirement: Search and filters
The dashboard SHALL filter the synchronized roster and map by name, team,
region, and status.

#### Scenario: Filters are combined
- **WHEN** a manager applies search and status or team filters
- **THEN** the roster, count, and map use the same intersected employee set

### Requirement: Route history
The manager SHALL be able to open an employee and review an ordered dated route,
shift times, point count, approximate distance, and visible tracking gaps.

#### Scenario: Route includes a gap
- **WHEN** consecutive points exceed the tracking-gap threshold
- **THEN** the route is visibly broken and the gap duration is shown

### Requirement: CSV export
The manager SHALL be able to export an authorized employee/date selection as
CSV with the raw point fields and UTC timestamps.

#### Scenario: Manager exports a date
- **WHEN** an authorized bounded export is requested
- **THEN** a CSV response is downloaded and an audit event is recorded

### Requirement: Team-ready access boundary
The backend MUST enforce manager employee scope independently of client filters.

#### Scenario: Unauthorized employee is requested directly
- **WHEN** a manager requests an employee outside their scope
- **THEN** the backend denies access without returning location data

