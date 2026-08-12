## Purpose

Lets an enrolled company Android device continuously report location without an
employee start/stop control, while making Android's required tracking
notification visible and leaving retention decisions to server policy.

## ADDED Requirements

### Requirement: Single-use code enrollment
The backend SHALL let an administrator issue a short-lived, single-use code for
one employee, expected phone number, team, and retention policy, and SHALL issue
a revocable device credential when that code is redeemed.

#### Scenario: Assigned code is redeemed
- **GIVEN** an unused, unexpired code created for an employee
- **WHEN** the Android app redeems it with a stable install ID and selected SIM
- **THEN** the code is burned and the server returns a device credential for that employee

#### Scenario: Code is reused
- **WHEN** a used or expired enrollment code is submitted
- **THEN** enrollment is denied without revealing which code condition failed

### Requirement: Installer selects an active SIM
The Android enrollment surface SHALL request telephony permission, list active
SIM subscriptions, and require the installer to select one before redemption.
The assigned phone number SHALL remain the source of truth when Android cannot
report a subscription number.

#### Scenario: Phone number is unavailable
- **GIVEN** Android returns an active subscription without a readable number
- **WHEN** the installer selects it and submits the assigned code
- **THEN** enrollment can succeed and the manager sees that the number is unavailable

### Requirement: SIM state accompanies uploads
Every authenticated location batch SHALL include the selected subscription's
current presence, slot, carrier, and phone number when available. SIM data SHALL
be advisory and SHALL NOT replace the device credential as authentication.

#### Scenario: Selected SIM is removed or changed
- **WHEN** the uploader can no longer find the selected subscription or its reported number differs from the assignment
- **THEN** queued locations continue uploading with device authentication and the dashboard shows a SIM warning

### Requirement: Administrator-controlled tracking
The Android client SHALL start tracking after device enrollment and SHALL NOT
present an employee control that disables or pauses collection.

#### Scenario: Enrolled app launches
- **WHEN** an enrolled employee opens the app or the tracking service is absent
- **THEN** the app starts the foreground location service without asking the employee to begin a shift

### Requirement: Android foreground continuity
The client SHALL use an Android foreground location service with a persistent
notification and SHALL request restart after boot, app update, or task removal.

#### Scenario: Phone restarts
- **GIVEN** a device has completed enrollment
- **WHEN** Android broadcasts boot completion
- **THEN** the receiver starts the foreground tracking service and the visible tracking notification returns

### Requirement: Native location capture
The service SHALL collect coordinates, recorded time, accuracy, battery,
employee ID, device ID, source, and policy assignment using adaptive intervals.

#### Scenario: A location fix arrives
- **WHEN** Android supplies a valid fix to the foreground service
- **THEN** the complete point is committed to the device SQLite queue before upload is attempted

### Requirement: Offline recovery
The client SHALL retain unsent points in a bounded native SQLite queue and
retry ordered HTTPS batches after connectivity returns.

#### Scenario: Connectivity returns
- **GIVEN** queued points collected without 4G
- **WHEN** a batch upload succeeds
- **THEN** only server-acknowledged point IDs are removed from the device queue

### Requirement: Server retention decision
The ingestion API SHALL authenticate the device, acknowledge valid points, and
independently decide which points are retained according to the assigned policy.

#### Scenario: Point is outside a retained window
- **WHEN** a valid device uploads a point outside its server-managed retention window
- **THEN** the API acknowledges but does not store the raw point or replace the employee's latest retained location
