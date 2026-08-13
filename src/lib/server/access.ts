import type { TrackingPolicy } from '../types.ts';

export interface ManagerIdentity {
  id: string;
  email: string;
  role: 'manager' | 'admin';
  demo: boolean;
}

export async function managerIdentity(request: Request, db?: D1Database): Promise<ManagerIdentity | null> {
  if (!db) return { id: 'manager-demo', email: 'manager.demo@fieldtrack.local', role: 'admin', demo: true };
  const email = request.headers.get('cf-access-authenticated-user-email')?.trim().toLowerCase();
  if (!email) return null;
  const manager = await db.prepare(
    'SELECT id, email, role FROM managers WHERE lower(email) = ? AND active = 1',
  ).bind(email).first<{ id: string; email: string; role: 'manager' | 'admin' }>();
  return manager ? { ...manager, demo: false } : null;
}

export async function canAccessEmployee(db: D1Database, managerId: string, employeeId: string) {
  const row = await db.prepare(`
    SELECT 1 AS allowed
    FROM employees e
    JOIN managers m ON m.id = ? AND m.active = 1
    LEFT JOIN manager_teams mt ON mt.manager_id = m.id AND mt.team_id = e.team_id
    WHERE e.id = ? AND e.deleted_at IS NULL AND (m.role = 'admin' OR mt.team_id IS NOT NULL)
  `).bind(managerId, employeeId).first<{ allowed: number }>();
  return Boolean(row?.allowed);
}

export async function hashToken(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

export interface AuthorizedDevice {
  id: string;
  employeeId: string;
  policy: TrackingPolicy;
}

export async function authorizedDevice(request: Request, db: D1Database, employeeId: string, deviceId: string): Promise<AuthorizedDevice | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const tokenHash = await hashToken(token);
  const device = await db.prepare(
    `SELECT d.id, d.employee_id AS employeeId, p.id AS policyId, p.name AS policyName,
      p.mode, p.time_zone AS timeZone, p.days_of_week AS daysOfWeek,
      p.start_minute AS startMinute, p.end_minute AS endMinute
    FROM devices d JOIN tracking_policies p ON p.id = d.policy_id
    WHERE d.id = ? AND d.employee_id = ? AND d.token_hash = ? AND d.active = 1`,
  ).bind(deviceId, employeeId, tokenHash).first<{
    id: string; employeeId: string; policyId: string; policyName: string;
    mode: TrackingPolicy['mode']; timeZone: string; daysOfWeek: string;
    startMinute: number; endMinute: number;
  }>();
  if (!device) return null;
  return {
    id: device.id,
    employeeId: device.employeeId,
    policy: {
      id: device.policyId, name: device.policyName, mode: device.mode,
      timeZone: device.timeZone, daysOfWeek: device.daysOfWeek,
      startMinute: device.startMinute, endMinute: device.endMinute,
    },
  };
}
