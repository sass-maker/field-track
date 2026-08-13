import { deriveStatus, routeMetrics } from './status.ts';
import type { EmployeeLocation, LiveRosterResponse, LocationPoint, RouteSummary } from './types.ts';

const employees = [
  ['emp-001', 'FT-1042', 'Aarav Mehta', 'North Dispatch', 'Delhi NCR', 28.6282, 77.2184, 34, 78, 0],
  ['emp-002', 'FT-1057', 'Meera Iyer', 'East Service', 'Noida', 28.5853, 77.3117, 18, 46, 4],
  ['emp-003', 'FT-1061', 'Kabir Khan', 'North Dispatch', 'Delhi NCR', 28.6129, 77.2295, 71, 23, 13],
  ['emp-004', 'FT-1074', 'Nisha Patel', 'West Service', 'Gurugram', 28.4595, 77.0266, 12, 91, -1],
  ['emp-005', 'FT-1088', 'Rohan Das', 'East Service', 'Noida', 28.5697, 77.321, 26, 62, 1],
] as const;

export function demoRoster(now = Date.now()): LiveRosterResponse {
  const roster: EmployeeLocation[] = employees.map(([employeeId, employeeCode, name, team, region, latitude, longitude, accuracyMeters, batteryPercentage, ageMinutes]) => {
    const ignoredByPolicy = ageMinutes === -1;
    const recordedAt = new Date(now - Math.max(1, ageMinutes) * 60_000).toISOString();
    return {
      employeeId, employeeCode, name, team, region, latitude, longitude,
      accuracyMeters, batteryPercentage, recordedAt,
      policyId: 'policy-day-duty', policyName: 'Day duty',
      lastSeenAt: recordedAt,
      retentionState: ignoredByPolicy ? 'ignored' : 'retaining',
      windowStartedAt: new Date(now - 5.5 * 60 * 60_000).toISOString(),
      windowEndsAt: ignoredByPolicy ? new Date(now - 35 * 60_000).toISOString() : null,
      status: deriveStatus(recordedAt, now),
      phoneNumber: `+91987654${String(3210 + Number(employeeId.slice(-1))).padStart(4, '0')}`,
      deviceId: `device-${employeeId}`,
      enrolledAt: new Date(now - 14 * 24 * 60 * 60_000).toISOString(),
      enrollmentState: 'reporting',
      simHealth: employeeId === 'emp-003' ? 'mismatch' : employeeId === 'emp-005' ? 'number-unavailable' : 'ok',
      simPresent: true,
      simPhoneNumber: employeeId === 'emp-005' ? null : `+91987654${String(employeeId === 'emp-003' ? 9999 : 3210 + Number(employeeId.slice(-1))).padStart(4, '0')}`,
      simCarrierName: employeeId === 'emp-003' ? 'Jio' : 'Airtel',
      simSlotIndex: employeeId === 'emp-005' ? 1 : 0,
      simLastReportedAt: recordedAt,
    };
  });
  return { generatedAt: new Date(now).toISOString(), demoMode: true, employees: roster };
}

export function demoRoute(employeeId: string, date: string, now = Date.now()): RouteSummary | null {
  const employee = demoRoster(now).employees.find((item) => item.employeeId === employeeId);
  if (!employee) return null;
  const center = { latitude: employee.latitude ?? 28.6139, longitude: employee.longitude ?? 77.209 };
  const start = new Date(`${date}T03:30:00.000Z`).getTime();
  const points: LocationPoint[] = Array.from({ length: 14 }, (_, index) => {
    const recordedAt = start + index * 4 * 60_000 + (index > 7 ? 12 * 60_000 : 0);
    return {
      id: `demo-${employeeId}-${index}`,
      employeeId,
      deviceId: `device-${employeeId}`,
      latitude: center.latitude + Math.sin(index / 2) * 0.006 - (13 - index) * 0.0007,
      longitude: center.longitude + Math.cos(index / 3) * 0.006 - (13 - index) * 0.0008,
      accuracyMeters: 12 + (index % 4) * 5,
      recordedAt: new Date(recordedAt).toISOString(),
      receivedAt: new Date(recordedAt + 20_000).toISOString(),
      batteryPercentage: 92 - index * 3,
      source: 'demo',
    policyId: 'policy-day-duty',
    };
  });
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
