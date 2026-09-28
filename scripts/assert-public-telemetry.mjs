import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 4179;
const server = spawn(
  'pnpm',
  [
    'exec',
    'wrangler',
    'dev',
    '--config',
    path.join(root, 'dist/server/wrangler.json'),
    '--local',
    '--env-file',
    '/dev/null',
    '--port',
    String(port),
  ],
  { cwd: root, stdio: 'ignore' },
);

try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (server.exitCode !== null) throw new Error('Local worker exited before ready');
    try {
      await fetch(`http://127.0.0.1:${port}/`);
      ready = true;
      break;
    } catch {
      await delay(250);
    }
  }
  if (!ready) throw new Error('Local worker did not become ready');

  const publicResponse = await fetch(`http://127.0.0.1:${port}/admin`);
  const publicHtml = await publicResponse.text();
  if (!publicResponse.ok || !publicHtml.includes('https://health.sassmaker.com/tracker.js')) {
    throw new Error('Public /admin is missing the App Health tracker');
  }
  if (!/data-key="ahk_pub_[^"]+"/.test(publicHtml)) {
    throw new Error('Public /admin is missing its App Health browser key');
  }
  if (!publicHtml.includes('app-import-46ac72dfc667b9d81271234f35cc955a7b7418c3818af5cf56fab3d0b803f830')) {
    throw new Error('Public /admin is missing its configured App Health project');
  }

  const privateResponse = await fetch(`http://127.0.0.1:${port}/admin/employees/emp-001`);
  const privateHtml = await privateResponse.text();
  if (!privateResponse.ok || privateHtml.includes('https://health.sassmaker.com/tracker.js') || /data-key="ahk_pub_[^"]+"/.test(privateHtml)) {
    throw new Error('Private employee route should render without the App Health tracker');
  }

  process.stdout.write('Public /admin tracker present; private employee route tracker absent.\n');
} finally {
  server.kill('SIGTERM');
}
