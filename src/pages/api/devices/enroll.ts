import type { APIRoute } from 'astro';
import { hashToken } from '../../../lib/server/access.ts';
import { databaseFrom, json, problem, readJson } from '../../../lib/server/http.ts';
import { normalizePhoneNumber, type SimSnapshot } from '../../../lib/onboarding.ts';

type EnrollBody = { enrollmentCode?: string; installId?: string; selectedSim?: SimSnapshot };

function validSim(value: SimSnapshot | undefined): value is SimSnapshot {
  return Boolean(value && value.present === true && Number.isInteger(value.subscriptionId) &&
    Number.isInteger(value.slotIndex) && value.slotIndex >= 0);
}

export const POST: APIRoute = async ({ request, locals }) => {
  const body = await readJson<EnrollBody>(request);
  if (!body?.enrollmentCode?.trim() || !body.installId?.trim() || !validSim(body.selectedSim)) {
    return problem(400, 'enrollmentCode, installId, and an active selectedSim are required.');
  }
  const db = databaseFrom(locals);
  if (!db) return json({
    employeeId: 'emp-001', employeeName: 'Demo employee', deviceId: `demo-${body.installId}`,
    deviceToken: 'demo-device-token', policyId: 'policy-day-duty', expectedPhoneNumber: '+919876543210',
    simHealth: body.selectedSim.phoneNumber ? 'ok' : 'number-unavailable', demoMode: true,
  }, { status: 201 });

  const codeHash = await hashToken(body.enrollmentCode.trim());
  const enrollment = await db.prepare(`
    SELECT ec.id, ec.employee_id AS employeeId, ec.policy_id AS policyId, e.name AS employeeName,
      e.phone_number AS expectedPhoneNumber
    FROM enrollment_codes ec JOIN employees e ON e.id = ec.employee_id
    WHERE ec.code_hash = ? AND ec.used_at IS NULL AND ec.expires_at > ? AND e.deleted_at IS NULL
  `).bind(codeHash, new Date().toISOString()).first<{
    id: string; employeeId: string; policyId: string; employeeName: string; expectedPhoneNumber: string | null;
  }>();
  if (!enrollment) return problem(401, 'Enrollment code is invalid, expired, or already used.');

  const deviceId = crypto.randomUUID();
  const deviceToken = `${crypto.randomUUID()}${crypto.randomUUID().replaceAll('-', '')}`;
  const tokenHash = await hashToken(deviceToken);
  const now = new Date().toISOString();
  const reportedPhone = normalizePhoneNumber(body.selectedSim.phoneNumber);
  const simMismatch = Boolean(reportedPhone && enrollment.expectedPhoneNumber && reportedPhone !== enrollment.expectedPhoneNumber);
  try {
    await db.batch([
      db.prepare(`
        INSERT INTO devices
          (id, employee_id, token_hash, install_id, enrollment_code_id, policy_id, label, active,
           sim_subscription_id, sim_slot_index, sim_display_name, sim_carrier_name, sim_phone_number,
           sim_country_iso, sim_mcc_mnc, sim_present, sim_last_reported_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'Managed Android', 1, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
      `).bind(
        deviceId, enrollment.employeeId, tokenHash, body.installId.trim(), enrollment.id, enrollment.policyId,
        body.selectedSim.subscriptionId, body.selectedSim.slotIndex, body.selectedSim.displayName,
        body.selectedSim.carrierName, reportedPhone, body.selectedSim.countryIso,
        body.selectedSim.mccMnc, now, now,
      ),
      db.prepare('UPDATE enrollment_codes SET used_at = ? WHERE id = ? AND used_at IS NULL').bind(now, enrollment.id),
      db.prepare(`INSERT INTO audit_events
        (id, actor_id, action, employee_id, occurred_at, metadata_json)
        VALUES (?, ?, 'device.enrolled', ?, ?, ?)`)
        .bind(crypto.randomUUID(), deviceId, enrollment.employeeId, now, JSON.stringify({
          enrollmentId: enrollment.id, installId: body.installId.trim(), subscriptionId: body.selectedSim.subscriptionId,
          slotIndex: body.selectedSim.slotIndex, reportedPhone, simMismatch,
        })),
    ]);
  } catch {
    return problem(401, 'Enrollment code is invalid, expired, or already used.');
  }
  return json({
    employeeId: enrollment.employeeId,
    employeeName: enrollment.employeeName,
    deviceId,
    deviceToken,
    policyId: enrollment.policyId,
    expectedPhoneNumber: enrollment.expectedPhoneNumber,
    simHealth: simMismatch ? 'mismatch' : reportedPhone ? 'ok' : 'number-unavailable',
    demoMode: false,
  }, { status: 201 });
};
