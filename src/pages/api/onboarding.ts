import type { APIRoute } from 'astro';
import { normalizePhoneNumber } from '../../lib/onboarding.ts';
import { hashToken, managerIdentity } from '../../lib/server/access.ts';
import { databaseFrom, json, problem, readJson } from '../../lib/server/http.ts';
import type { OnboardingOptionsResponse, OnboardingResult, TeamOption, TrackingPolicy } from '../../lib/types.ts';

type OnboardingBody = {
  employeeCode?: string;
  name?: string;
  phoneNumber?: string;
  teamId?: string;
  policyId?: string;
};

const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

function enrollmentCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const value = [...bytes].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('');
  return `FT-${value.slice(0, 4)}-${value.slice(4, 8)}-${value.slice(8)}`;
}

export const GET: APIRoute = async ({ request, locals }) => {
  const db = databaseFrom(locals);
  const manager = await managerIdentity(request, db);
  if (!manager) return problem(401, 'Manager authentication is required.');
  if (manager.role !== 'admin') return problem(403, 'Administrator access is required to onboard employees.');
  if (!db) return json({
    demoMode: true,
    teams: [
      { id: 'team-north', name: 'North Dispatch', region: 'Delhi NCR' },
      { id: 'team-east', name: 'East Service', region: 'Noida' },
      { id: 'team-west', name: 'West Service', region: 'Gurugram' },
    ],
    policies: [
      { id: 'policy-always', name: 'Always retain', mode: 'always', timeZone: 'Asia/Kolkata', daysOfWeek: '0,1,2,3,4,5,6', startMinute: 0, endMinute: 1439 },
      { id: 'policy-day-duty', name: 'Day duty', mode: 'schedule', timeZone: 'Asia/Kolkata', daysOfWeek: '1,2,3,4,5,6', startMinute: 480, endMinute: 1080 },
    ],
  } satisfies OnboardingOptionsResponse);

  const [teams, policies] = await Promise.all([
    db.prepare('SELECT id, name, region FROM teams ORDER BY name').all<TeamOption>(),
    db.prepare(`SELECT id, name, mode, time_zone AS timeZone, days_of_week AS daysOfWeek,
      start_minute AS startMinute, end_minute AS endMinute FROM tracking_policies ORDER BY name`).all<TrackingPolicy>(),
  ]);
  return json({ demoMode: false, teams: teams.results, policies: policies.results } satisfies OnboardingOptionsResponse);
};

export const POST: APIRoute = async ({ request, locals }) => {
  const db = databaseFrom(locals);
  const manager = await managerIdentity(request, db);
  if (!manager) return problem(401, 'Manager authentication is required.');
  if (manager.role !== 'admin') return problem(403, 'Administrator access is required to onboard employees.');

  const body = await readJson<OnboardingBody>(request);
  const employeeCode = body?.employeeCode?.trim().toUpperCase() ?? '';
  const name = body?.name?.trim() ?? '';
  const phoneNumber = normalizePhoneNumber(body?.phoneNumber);
  const teamId = body?.teamId?.trim() ?? '';
  const policyId = body?.policyId?.trim() ?? '';
  if (!/^[A-Z0-9-]{2,32}$/.test(employeeCode)) return problem(400, 'Enter a valid employee ID using letters, numbers, or hyphens.');
  if (name.length < 2 || name.length > 100) return problem(400, 'Employee name must be between 2 and 100 characters.');
  if (!phoneNumber) return problem(400, 'Enter a valid Indian mobile number.');
  if (!teamId || !policyId) return problem(400, 'Team and retention policy are required.');

  const code = enrollmentCode();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60_000).toISOString();
  if (!db) return json({
    demoMode: true,
    employeeId: crypto.randomUUID(), employeeName: name, employeeCode, phoneNumber,
    enrollmentCode: code, expiresAt,
  } satisfies OnboardingResult, { status: 201 });

  const [team, policy, duplicate] = await Promise.all([
    db.prepare('SELECT id FROM teams WHERE id = ?').bind(teamId).first<{ id: string }>(),
    db.prepare('SELECT id FROM tracking_policies WHERE id = ?').bind(policyId).first<{ id: string }>(),
    db.prepare(`SELECT employee_code AS employeeCode, phone_number AS phoneNumber FROM employees
      WHERE deleted_at IS NULL AND (employee_code = ? OR phone_number = ?) LIMIT 1`)
      .bind(employeeCode, phoneNumber).first<{ employeeCode: string; phoneNumber: string | null }>(),
  ]);
  if (!team || !policy) return problem(400, 'Selected team or retention policy is unavailable.');
  if (duplicate) return problem(409, duplicate.employeeCode === employeeCode ? 'That employee ID already exists.' : 'That phone number is already assigned.');

  const employeeId = crypto.randomUUID();
  const enrollmentId = crypto.randomUUID();
  const now = new Date().toISOString();
  const codeHash = await hashToken(code);
  try {
    await db.batch([
      db.prepare(`INSERT INTO employees (id, employee_code, name, phone_number, team_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(employeeId, employeeCode, name, phoneNumber, teamId, now),
      db.prepare(`INSERT INTO enrollment_codes
        (id, code_hash, employee_id, policy_id, expires_at, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(enrollmentId, codeHash, employeeId, policyId, expiresAt, manager.id, now),
      db.prepare(`INSERT INTO audit_events
        (id, actor_id, action, employee_id, occurred_at, metadata_json)
        VALUES (?, ?, 'employee.onboarded', ?, ?, ?)`)
        .bind(crypto.randomUUID(), manager.id, employeeId, now, JSON.stringify({ employeeCode, phoneNumber, teamId, policyId, enrollmentId, expiresAt })),
    ]);
  } catch {
    return problem(409, 'Employee onboarding conflicted with an existing assignment. Refresh and try again.');
  }
  return json({
    demoMode: false, employeeId, employeeName: name, employeeCode, phoneNumber,
    enrollmentCode: code, expiresAt,
  } satisfies OnboardingResult, { status: 201 });
};
