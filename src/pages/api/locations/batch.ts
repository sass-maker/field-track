import type { APIRoute } from 'astro';
import { authorizedDevice } from '../../../lib/server/access.ts';
import { databaseFrom, json, problem, readJson } from '../../../lib/server/http.ts';
import { shouldRetainAt } from '../../../lib/status.ts';
import type { LocationPoint } from '../../../lib/types.ts';
import { normalizePhoneNumber, type SimSnapshot } from '../../../lib/onboarding.ts';

type BatchBody = { employeeId?: string; deviceId?: string; sim?: SimSnapshot; points?: LocationPoint[] };

function validSim(value: SimSnapshot | undefined): value is SimSnapshot {
  return Boolean(value && typeof value.present === 'boolean' && Number.isInteger(value.subscriptionId) &&
    Number.isInteger(value.slotIndex) && value.slotIndex >= 0);
}

function validPoint(point: LocationPoint) {
  return Boolean(
    point.id && Number.isFinite(point.latitude) && point.latitude >= -90 && point.latitude <= 90 &&
    Number.isFinite(point.longitude) && point.longitude >= -180 && point.longitude <= 180 &&
    Number.isFinite(point.accuracyMeters) && point.accuracyMeters >= 0 &&
    (point.batteryPercentage === null || (Number.isInteger(point.batteryPercentage) && point.batteryPercentage >= 0 && point.batteryPercentage <= 100)) &&
    !Number.isNaN(Date.parse(point.recordedAt)),
  );
}

export const POST: APIRoute = async ({ request, locals }) => {
  const body = await readJson<BatchBody>(request);
  if (!body?.employeeId || !body.deviceId || !validSim(body.sim) || !Array.isArray(body.points)) {
    return problem(400, 'employeeId, deviceId, sim, and points are required.');
  }
  if (body.points.length === 0 || body.points.length > 100) return problem(400, 'Batch size must be between 1 and 100 points.');
  if (body.points.some((point) => !validPoint(point))) return problem(400, 'One or more location points are invalid.');
  if (body.points.some((point) => point.employeeId !== body.employeeId || point.deviceId !== body.deviceId)) {
    return problem(400, 'Point ownership must match the batch.');
  }

  const acceptedIds = body.points.map((point) => point.id);
  const db = databaseFrom(locals);
  if (!db) return json({ acceptedIds, retainedIds: acceptedIds, policyId: 'policy-day-duty', policyState: 'retaining', demoMode: true });
  const device = await authorizedDevice(request, db, body.employeeId, body.deviceId);
  if (!device) return problem(401, 'Device authentication failed.');

  const receivedAt = new Date().toISOString();
  const simPhoneNumber = normalizePhoneNumber(body.sim.phoneNumber);
  const retained = body.points.filter((point) => shouldRetainAt(device.policy, point.recordedAt));
  const statements: D1PreparedStatement[] = [
    db.prepare(`UPDATE devices SET last_seen_at = ?, sim_subscription_id = ?, sim_slot_index = ?,
      sim_display_name = ?, sim_carrier_name = ?, sim_phone_number = ?, sim_country_iso = ?,
      sim_mcc_mnc = ?, sim_present = ?, sim_last_reported_at = ? WHERE id = ?`)
      .bind(receivedAt, body.sim.subscriptionId, body.sim.slotIndex, body.sim.displayName,
        body.sim.carrierName, simPhoneNumber, body.sim.countryIso, body.sim.mccMnc,
        body.sim.present ? 1 : 0, receivedAt, body.deviceId),
  ];
  for (const point of retained) {
    statements.push(db.prepare(`
      INSERT OR IGNORE INTO location_points
        (id, employee_id, device_id, latitude, longitude, accuracy_meters, recorded_at,
         received_at, battery_percentage, source, policy_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      point.id, point.employeeId, point.deviceId, point.latitude, point.longitude,
      point.accuracyMeters, point.recordedAt, receivedAt, point.batteryPercentage,
      point.source, device.policy.id,
    ));
    statements.push(db.prepare(`
      INSERT INTO latest_locations
        (employee_id, point_id, device_id, latitude, longitude, accuracy_meters, recorded_at,
         received_at, battery_percentage, source, policy_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(employee_id) DO UPDATE SET
        point_id = excluded.point_id, device_id = excluded.device_id,
        latitude = excluded.latitude, longitude = excluded.longitude,
        accuracy_meters = excluded.accuracy_meters, recorded_at = excluded.recorded_at,
        received_at = excluded.received_at, battery_percentage = excluded.battery_percentage,
        source = excluded.source, policy_id = excluded.policy_id
      WHERE excluded.recorded_at > latest_locations.recorded_at
    `).bind(
      point.employeeId, point.id, point.deviceId, point.latitude, point.longitude,
      point.accuracyMeters, point.recordedAt, receivedAt, point.batteryPercentage,
      point.source, device.policy.id,
    ));
  }
  await db.batch(statements);
  return json({
    acceptedIds,
    retainedIds: retained.map((point) => point.id),
    policyId: device.policy.id,
    policyState: retained.length === body.points.length ? 'retaining' : retained.length === 0 ? 'ignored' : 'mixed',
    demoMode: false,
  });
};
