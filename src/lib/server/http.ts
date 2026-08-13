import { env } from 'cloudflare:workers';

export function json(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export function problem(status: number, message: string) {
  return json({ error: message }, { status });
}

export async function readJson<T>(request: Request): Promise<T | null> {
  if (!request.headers.get('content-type')?.includes('application/json')) return null;
  try {
    return await request.json() as T;
  } catch {
    return null;
  }
}

export function databaseFrom(_locals: App.Locals) {
  const bindings = env as RuntimeEnv;
  return bindings.DEMO_MODE === 'true' ? undefined : bindings.DB;
}
