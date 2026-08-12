import type { APIRoute } from 'astro';
import { managerIdentity } from '../../lib/server/access.ts';
import { databaseFrom, json, problem } from '../../lib/server/http.ts';
import type { TrackingPolicy } from '../../lib/types.ts';

export const GET: APIRoute = async ({ request, locals }) => {
  const db = databaseFrom(locals);
  const manager = await managerIdentity(request, db);
  if (!manager) return problem(401, 'Manager authentication is required.');
  if (!db) return json({ demoMode: true, policies: [
    { id: 'policy-always', name: 'Always retain', mode: 'always', timeZone: 'Asia/Kolkata', daysOfWeek: '0,1,2,3,4,5,6', startMinute: 0, endMinute: 1439 },
    { id: 'policy-day-duty', name: 'Day duty', mode: 'schedule', timeZone: 'Asia/Kolkata', daysOfWeek: '1,2,3,4,5,6', startMinute: 480, endMinute: 1080 },
  ] satisfies TrackingPolicy[] });
  const result = await db.prepare(`
    SELECT id, name, mode, time_zone AS timeZone, days_of_week AS daysOfWeek,
      start_minute AS startMinute, end_minute AS endMinute
    FROM tracking_policies ORDER BY name
  `).all<TrackingPolicy>();
  return json({ demoMode: false, policies: result.results });
};
