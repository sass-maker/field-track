import { createAppHealthClient, type AppHealthClient } from '@saas-maker/app-health';
import { env } from 'cloudflare:workers';
import type { APIContext } from 'astro';
import { defineMiddleware } from 'astro:middleware';

const INGEST_ENDPOINT = 'https://ingest.sassmaker.com/v1/ingest';

let cachedClient: { key: string; environment: string; client: AppHealthClient } | undefined;

function clientFor(bindings: RuntimeEnv): AppHealthClient | null {
  const key = bindings.APP_HEALTH_INGEST_KEY;
  if (!key) return null;

  const environment = bindings.APP_HEALTH_ENVIRONMENT ?? 'production';
  if (cachedClient?.key === key && cachedClient.environment === environment) {
    return cachedClient.client;
  }

  const client = createAppHealthClient({
    key,
    environment,
    endpoint: INGEST_ENDPOINT,
    runtime: 'worker',
    disableTimer: true,
  });
  cachedClient = { key, environment, client };
  return client;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const startedAt = performance.now();
  let response: Response;

  try {
    response = await next();
  } catch (error) {
    recordRequest(context, 500, startedAt);
    throw error;
  }

  recordRequest(context, response.status, startedAt);
  return response;
});

function recordRequest(
  context: APIContext,
  status: number,
  startedAt: number,
): void {
  const bindings = env as RuntimeEnv;

  let client: AppHealthClient | null;
  try {
    client = clientFor(bindings);
  } catch {
    return;
  }
  if (!client) return;

  client.record({
    method: context.request.method,
    route: context.routePattern,
    status_code: status,
    duration_ms: Math.max(0, Math.round(performance.now() - startedAt)),
  });

  const delivery = client.flush();
  try {
    context.locals.cfContext.waitUntil(delivery);
  } catch {
    void delivery.catch(() => {});
  }
}
