import type { APIRoute } from 'astro';
import { managerIdentity } from '../../../../lib/server/access.ts';
import { databaseFrom, json, problem } from '../../../../lib/server/http.ts';
import { routeForDate } from '../../../../lib/server/roster.ts';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export const GET: APIRoute = async ({ request, locals, params, url }) => {
  const employeeId = params.id;
  const date = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  if (!employeeId || !datePattern.test(date)) return problem(400, 'A valid employee and YYYY-MM-DD date are required.');
  const db = databaseFrom(locals);
  const manager = await managerIdentity(request, db);
  if (!manager) return problem(401, 'Manager authentication is required.');
  const route = await routeForDate(db, manager, employeeId, date);
  if (route === 'forbidden') return problem(403, 'This employee is outside your team scope.');
  if (!route) return problem(404, 'Employee was not found.');
  if (db) {
    await db.prepare(`
      INSERT INTO audit_events (id, actor_id, action, employee_id, occurred_at, metadata_json)
      VALUES (?, ?, 'history.viewed', ?, ?, ?)
    `).bind(crypto.randomUUID(), manager.id, employeeId, new Date().toISOString(), JSON.stringify({ date })).run();
  }
  return json({ ...route, demoMode: !db });
};
