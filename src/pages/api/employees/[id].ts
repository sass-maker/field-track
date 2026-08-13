import type { APIRoute } from 'astro';
import { canAccessEmployee, managerIdentity } from '../../../lib/server/access.ts';
import { databaseFrom, json, problem, readJson } from '../../../lib/server/http.ts';

type DeleteBody = { deleteHistory?: boolean };

export const DELETE: APIRoute = async ({ request, locals, params }) => {
  const employeeId = params.id;
  if (!employeeId) return problem(400, 'Employee ID is required.');
  const db = databaseFrom(locals);
  const manager = await managerIdentity(request, db);
  if (!manager) return problem(401, 'Manager authentication is required.');
  if (!db) return problem(409, 'Deletion is disabled in synthetic demo mode.');
  if (!(await canAccessEmployee(db, manager.id, employeeId))) return problem(403, 'This employee is outside your team scope.');
  const actor = await db.prepare('SELECT role FROM managers WHERE id = ?').bind(manager.id).first<{ role: string }>();
  if (actor?.role !== 'admin') return problem(403, 'Administrator access is required for deletion.');
  const body = (await readJson<DeleteBody>(request)) ?? {};
  const now = new Date().toISOString();
  const statements = [
    db.prepare('UPDATE employees SET deleted_at = ? WHERE id = ?').bind(now, employeeId),
    db.prepare('UPDATE devices SET active = 0 WHERE employee_id = ?').bind(employeeId),
    db.prepare(`INSERT INTO audit_events (id, actor_id, action, employee_id, occurred_at, metadata_json)
      VALUES (?, ?, 'employee.deleted', ?, ?, ?)`)
      .bind(crypto.randomUUID(), manager.id, employeeId, now, JSON.stringify({ deleteHistory: Boolean(body.deleteHistory) })),
  ];
  if (body.deleteHistory) {
    statements.unshift(db.prepare('DELETE FROM location_points WHERE employee_id = ?').bind(employeeId));
    statements.unshift(db.prepare('DELETE FROM latest_locations WHERE employee_id = ?').bind(employeeId));
  }
  await db.batch(statements);
  return json({ deleted: true, historyDeleted: Boolean(body.deleteHistory) });
};
