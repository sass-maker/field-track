import type { APIRoute } from 'astro';
import { canAccessEmployee, managerIdentity } from '../../../../lib/server/access.ts';
import { databaseFrom, json, problem, readJson } from '../../../../lib/server/http.ts';

type PolicyBody = { policyId?: string };

export const PUT: APIRoute = async ({ request, locals, params }) => {
  const employeeId = params.id;
  const body = await readJson<PolicyBody>(request);
  if (!employeeId || !body?.policyId) return problem(400, 'Employee and policy IDs are required.');
  const db = databaseFrom(locals);
  const manager = await managerIdentity(request, db);
  if (!manager) return problem(401, 'Manager authentication is required.');
  if (!db) return problem(409, 'Policy changes are disabled in synthetic demo mode.');
  if (!(await canAccessEmployee(db, manager.id, employeeId))) return problem(403, 'This employee is outside your team scope.');
  const actor = await db.prepare('SELECT role FROM managers WHERE id = ?').bind(manager.id).first<{ role: string }>();
  if (actor?.role !== 'admin') return problem(403, 'Administrator access is required to change retention policy.');
  const policy = await db.prepare('SELECT id FROM tracking_policies WHERE id = ?').bind(body.policyId).first<{ id: string }>();
  if (!policy) return problem(404, 'Tracking policy was not found.');
  const now = new Date().toISOString();
  await db.batch([
    db.prepare('UPDATE devices SET policy_id = ? WHERE employee_id = ? AND active = 1').bind(body.policyId, employeeId),
    db.prepare(`INSERT INTO audit_events (id, actor_id, action, employee_id, occurred_at, metadata_json)
      VALUES (?, ?, 'retention_policy.assigned', ?, ?, ?)`)
      .bind(crypto.randomUUID(), manager.id, employeeId, now, JSON.stringify({ policyId: body.policyId })),
  ]);
  return json({ employeeId, policyId: body.policyId, updatedAt: now });
};
