import { demoRoster, demoRoute } from '../demo.ts';
import { deriveStatus, routeMetrics, shouldRetainAt } from '../status.ts';
import type { EmployeeLocation, LiveRosterResponse, LocationPoint, RouteSummary, TrackingPolicy } from '../types.ts';
import { simHealth } from '../onboarding.ts';
import { canAccessEmployee, type ManagerIdentity } from './access.ts';

type RosterRow = Omit<EmployeeLocation, 'status' | 'retentionState' | 'windowStartedAt' | 'windowEndsAt' | 'enrollmentState' | 'simHealth' | 'simPresent'> & {
  simPresent: number | null;
  mode: TrackingPolicy['mode'] | null; timeZone: string | null; daysOfWeek: string | null;
  startMinute: number | null; endMinute: number | null;
};

export async function liveRoster(db: D1Database | undefined, manager: ManagerIdentity): Promise<LiveRosterResponse> {
  if (!db) return demoRoster();
  const result = await db.prepare(`
    SELECT e.id AS employeeId, e.employee_code AS employeeCode, e.name, e.phone_number AS phoneNumber,
      t.name AS team, t.region, ll.latitude, ll.longitude,
      ll.accuracy_meters AS accuracyMeters, ll.battery_percentage AS batteryPercentage,
      ll.recorded_at AS recordedAt, d.policy_id AS policyId, p.name AS policyName,
      d.id AS deviceId, d.created_at AS enrolledAt, d.last_seen_at AS lastSeenAt,
      d.sim_present AS simPresent, d.sim_phone_number AS simPhoneNumber,
      d.sim_carrier_name AS simCarrierName, d.sim_slot_index AS simSlotIndex,
      d.sim_last_reported_at AS simLastReportedAt, p.mode, p.time_zone AS timeZone,
      p.days_of_week AS daysOfWeek, p.start_minute AS startMinute, p.end_minute AS endMinute
    FROM employees e
    JOIN teams t ON t.id = e.team_id
    JOIN managers m ON m.id = ? AND m.active = 1
    LEFT JOIN manager_teams mt ON mt.manager_id = m.id AND mt.team_id = e.team_id
    LEFT JOIN devices d ON d.id = (
      SELECT id FROM devices WHERE employee_id = e.id AND active = 1 ORDER BY created_at DESC LIMIT 1
    )
    LEFT JOIN tracking_policies p ON p.id = d.policy_id
    LEFT JOIN latest_locations ll ON ll.employee_id = e.id
    WHERE e.deleted_at IS NULL AND (m.role = 'admin' OR mt.team_id IS NOT NULL)
    ORDER BY e.name
  `).bind(manager.id).all<RosterRow>();
  const now = Date.now();
  return {
    generatedAt: new Date(now).toISOString(),
    demoMode: false,
    employees: result.results.map((employee) => {
      const policy = employee.policyId && employee.policyName && employee.mode && employee.timeZone && employee.daysOfWeek && employee.startMinute !== null && employee.endMinute !== null
        ? { id: employee.policyId, name: employee.policyName, mode: employee.mode, timeZone: employee.timeZone, daysOfWeek: employee.daysOfWeek, startMinute: employee.startMinute, endMinute: employee.endMinute }
        : null;
      const { mode: _mode, timeZone: _timeZone, daysOfWeek: _days, startMinute: _start, endMinute: _end, ...location } = employee;
      return {
        ...location,
        simPresent: employee.simPresent === null ? null : employee.simPresent === 1,
        simHealth: simHealth(employee.phoneNumber, employee.simPhoneNumber, employee.simPresent === null ? null : employee.simPresent === 1),
        enrollmentState: !employee.deviceId ? 'not-enrolled' as const : employee.lastSeenAt ? 'reporting' as const : 'never-seen' as const,
        retentionState: policy && shouldRetainAt(policy, new Date(now).toISOString()) ? 'retaining' as const : 'ignored' as const,
        windowStartedAt: null,
        windowEndsAt: null,
        status: deriveStatus(employee.lastSeenAt, now),
      };
    }),
  };
}

type PointRow = {
  id: string; employeeId: string; deviceId: string; latitude: number; longitude: number;
  accuracyMeters: number; recordedAt: string; receivedAt: string;
  batteryPercentage: number | null; source: LocationPoint['source']; policyId: string;
};

export async function routeForDate(
  db: D1Database | undefined,
  manager: ManagerIdentity,
  employeeId: string,
  date: string,
): Promise<RouteSummary | null | 'forbidden'> {
  if (!db) return demoRoute(employeeId, date);
  if (!(await canAccessEmployee(db, manager.id, employeeId))) return 'forbidden';
  const employee = await db.prepare(`
    SELECT e.id AS employeeId, e.employee_code AS employeeCode, e.name, t.name AS team, t.region
    FROM employees e JOIN teams t ON t.id = e.team_id WHERE e.id = ? AND e.deleted_at IS NULL
  `).bind(employeeId).first<RouteSummary['employee']>();
  if (!employee) return null;
  const pointsResult = await db.prepare(`
    SELECT id, employee_id AS employeeId, device_id AS deviceId, latitude, longitude,
      accuracy_meters AS accuracyMeters, recorded_at AS recordedAt, received_at AS receivedAt,
      battery_percentage AS batteryPercentage, source, policy_id AS policyId
    FROM location_points
    WHERE employee_id = ? AND recorded_at >= ? AND recorded_at < ?
    ORDER BY recorded_at
  `).bind(employeeId, `${date}T00:00:00.000Z`, `${date}T23:59:59.999Z`).all<PointRow>();
  const points = pointsResult.results;
  const metrics = routeMetrics(points);
  return {
    employee, date,
    windowStartedAt: points[0]?.recordedAt ?? null,
    windowEndedAt: points.at(-1)?.recordedAt ?? null,
    pointCount: points.length,
    ...metrics,
    points,
  };
}
