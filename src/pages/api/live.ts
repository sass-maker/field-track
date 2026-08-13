import type { APIRoute } from 'astro';
import { managerIdentity } from '../../lib/server/access.ts';
import { databaseFrom, json, problem } from '../../lib/server/http.ts';
import { liveRoster } from '../../lib/server/roster.ts';

export const GET: APIRoute = async ({ request, locals }) => {
  const db = databaseFrom(locals);
  const manager = await managerIdentity(request, db);
  if (!manager) return problem(401, 'Manager authentication is required.');
  return json(await liveRoster(db, manager));
};
