# Field Track

Field Track has two product surfaces:

- an Android-only React Native app with a native Kotlin foreground location
  service, boot recovery, SQLite offline queue, and HTTPS uploader;
- an Astro/React manager dashboard and Cloudflare Worker API backed by D1.

Employees do not start, stop, or pause tracking. After one-time administrator
enrollment, the Android service continuously submits points and displays the
required ongoing notification. Server policy decides which acknowledged points
enter history and latest-location state.

## Manager dashboard and API

Requirements: Node.js 24 and pnpm 10.

```bash
pnpm install
pnpm dev
```

Open `http://localhost:4321/admin`. Local development defaults to deterministic
synthetic data and requires no credentials.

To exercise the real API against a local D1 database, apply the migration once,
seed a local manager/team, build, and run the Worker with demo mode disabled:

```bash
pnpm exec wrangler d1 migrations apply DB --local
pnpm build
pnpm exec wrangler dev --local --port 8787 --ip 0.0.0.0 \
  --var DEMO_MODE:false --show-interactive-dev-session=false
```

Local requests use Cloudflare Access's authenticated-email header. The Android
debug build defaults to `http://10.0.2.2:8787` for an emulator and exposes a
debug-only API URL field for a physical phone's LAN address. Release builds keep
the fixed HTTPS Worker URL and never show that field.

### Data transport

- The manager dashboard polls `GET /api/live` every 15 seconds. A request is
  skipped while the previous poll is still running, so slow networks do not
  create overlapping work.
- Android does not poll the server for location work. Its foreground service
  records fixes locally, then sends ordinary authenticated HTTPS batches after
  new points and when connectivity returns.
- Route history loads when the manager selects an employee or date. V1 has no
  WebSocket, socket, push channel, or always-open connection.

With a 30–60 second moving sample and a 15-second dashboard poll, a healthy
moving device normally appears about 45–75 seconds behind real time. Stationary
devices intentionally report less often to preserve battery.

```bash
pnpm test
pnpm check
pnpm build
```

## Android app

The Android project is under `apps/employee-mobile`. It requires JDK 21, the
Android SDK/API 37 toolchain, and either an emulator or an attached Android
device.

On Apple silicon with Homebrew's command-line tools, install the required SDK
components after personally reviewing and accepting the terms shown by the
Android CLI:

```bash
export JAVA_HOME=/opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home
export ANDROID_HOME=/opt/homebrew/share/android-commandlinetools
android --no-metrics sdk install platform-tools platforms/android-37.0 \
  build-tools/37.0.0 ndk/27.1.12297006
```

```bash
pnpm mobile:start
pnpm mobile:android
```

An administrator first selects **Onboard employee** in the dashboard, enters
the employee name, ID, assigned mobile number, team, and retention policy, then
gives the generated code to the employee. The plaintext code is shown once,
expires after 24 hours, and is stored by the server only as a hash.

The Android build has its Worker URL preconfigured; employees do not choose a
server. On the setup screen, the installer grants phone permission, selects the
assigned active SIM, and enters the code. Redemption burns the code and returns
the employee/device assignment plus a random device upload credential. The
native service starts after location permissions are granted. There is
intentionally no stop, pause, end-shift, or unenroll action in the employee app.

SIM presence is not authentication. Android may not expose a SIM's phone number,
so the manager-entered number remains the assignment record. Each authenticated
location batch includes the selected SIM's current presence, slot, carrier, and
number when available. The dashboard warns on a missing SIM, unavailable number,
or mismatch while uploads continue to authenticate with the device credential.

The Kotlin runtime:

- runs as a location foreground service with an ongoing notification;
- samples about every minute while moving and every four minutes while stationary;
- requests a temporary high-accuracy fix after poor accuracy;
- commits each fix to SQLite before network upload;
- uploads up to 50 ordered points at a time and only deletes acknowledged IDs;
- refreshes the selected SIM snapshot on every upload;
- caps the device queue at 20,000 points;
- asks Android to restore tracking on launch, boot, package update, and service restart.

Android/OEM battery policy can still interrupt services. The 5 → 20 → 100
device rollout must validate boot recovery and battery behavior on the actual
low-end phone models. Android 14+ also applies stricter background foreground-
service start rules; enrollment must grant background location for boot recovery.

## Backend and retention policy

The D1 contract is in `migrations/0001_initial.sql`. Valid device batches are
always acknowledged. For every point, the Worker evaluates the assigned
`tracking_policies` row in its configured time zone:

- retained points update raw history and latest retained location;
- ignored points are not written to either table;
- device `last_seen_at` still updates, so Off duty and Offline stay distinct.

Admins can assign a policy from employee detail. History reads, exports,
deletion, and policy assignments are server-authorized and audited.

Before a real deployment:

1. Replace the placeholder D1 database ID in `wrangler.jsonc`.
2. Set `DEMO_MODE` to `false` and apply the migration.
3. Put the Worker behind Cloudflare Access and seed administrators, managers,
   and teams; administrators create employees and codes in the dashboard.
4. Add an endpoint-specific enrollment-attempt protection rule before rollout;
   never use SIM existence or distribute database credentials as authentication.
5. Configure a production-suitable OSM-compatible tile provider.
6. Sign and distribute the Android app through the chosen managed channel.
7. Deploy manually with the exact Git SHA tag required by Fleet policy.

No real employee, credential, signing key, or production location data belongs
in this repository.
