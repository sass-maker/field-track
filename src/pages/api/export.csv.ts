import type { APIRoute } from 'astro';
import { managerIdentity } from '../../lib/server/access.ts';
import { databaseFrom, problem } from '../../lib/server/http.ts';
import { routeForDate } from '../../lib/server/roster.ts';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;
const cell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;

export const GET: APIRoute = async ({ request, locals, url }) => {
  const employeeId = url.searchParams.get('employeeId');
  const date = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  if (!employeeId || !datePattern.test(date)) return problem(400, 'employeeId and a valid YYYY-MM-DD date are required.');
  const db = databaseFrom(locals);
  const manager = await managerIdentity(request, db);
  if (!manager) return problem(401, 'Manager authentication is required.');
  const route = await routeForDate(db, manager, employeeId, date);
  if (route === 'forbidden') return problem(403, 'This employee is outside your team scope.');
  if (!route) return problem(404, 'Employee was not found.');

  if (db) {
    await db.prepare(`
      INSERT INTO audit_events (id, actor_id, action, employee_id, occurred_at, metadata_json)
      VALUES (?, ?, 'history.exported', ?, ?, ?)
    `).bind(crypto.randomUUID(), manager.id, employeeId, new Date().toISOString(), JSON.stringify({ date })).run();
  }

  const headers = ['employee_id', 'device_id', 'latitude', 'longitude', 'accuracy_meters', 'recorded_at', 'received_at', 'battery_percentage', 'source', 'policy_id'];
  const rows = route.points.map((point) => [
    point.employeeId, point.deviceId, point.latitude, point.longitude, point.accuracyMeters,
    point.recordedAt, point.receivedAt, point.batteryPercentage, point.source, point.policyId,
  ].map(cell).join(','));
  return new Response([headers.join(','), ...rows].join('\n'), {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="field-track-${employeeId}-${date}.csv"`,
      'cache-control': 'no-store',
    },
  });
};
