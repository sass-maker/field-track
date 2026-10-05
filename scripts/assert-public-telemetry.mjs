import { createHash } from 'node:crypto';
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

const footerAssets = [
  {
    path: '/footer-art/field-track.webp',
    type: 'image/webp',
    bytes: 313950,
    sha256: '86fb27d49d8b870877d5aa33b75a5bd1406c9d77c86b5787e06796408df8bf8d',
  },
  {
    path: '/fonts/fleet-footer-precise-v1/geist.woff2',
    type: 'font/woff2',
    bytes: 29400,
    sha256: '19f9c92546aa300c312235e3125af1b81394d8db9a4bc4a425cd5b641d2d54e1',
  },
  {
    path: '/fonts/fleet-footer-precise-v1/geistmono.woff2',
    type: 'font/woff2',
    bytes: 9864,
    sha256: '3f98383b122fe015a48536cd4a1cda855a201718923ffe74931a01597107b9b5',
  },
  {
    path: '/fonts/fleet-footer-precise-v1/newsreader.woff2',
    type: 'font/woff2',
    bytes: 132000,
    sha256: '6e4f2958c3a7c4a80acde4e5a679abe7e01bc1e30b92be3c7a8b696ef401d101',
  },
];

async function assertFooterAssets() {
  for (const asset of footerAssets) {
    const response = await fetch(`http://127.0.0.1:${port}${asset.path}`);
    const contentType = response.headers.get('content-type')?.split(';')[0];
    const bytes = Buffer.from(await response.arrayBuffer());
    const hash = createHash('sha256').update(bytes).digest('hex');
    if (!response.ok || contentType !== asset.type || bytes.length !== asset.bytes || hash !== asset.sha256) {
      throw new Error(`Footer asset failed exact GET verification: ${asset.path}`);
    }

    const head = await fetch(`http://127.0.0.1:${port}${asset.path}`, { method: 'HEAD' });
    const headType = head.headers.get('content-type')?.split(';')[0];
    const headLength = head.headers.get('content-length');
    if (!head.ok || headType !== asset.type || (headLength !== null && headLength !== String(asset.bytes))) {
      throw new Error(
        `Footer asset failed HEAD metadata verification: ${asset.path} ` +
          `(status=${head.status}, type=${headType}, length=${headLength})`,
      );
    }
  }
}

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
  if (publicHtml.includes('data-feedback="false"')) {
    throw new Error('Public /admin should retain its feedback launcher');
  }

  const privateResponse = await fetch(`http://127.0.0.1:${port}/admin/employees/emp-001`);
  const privateHtml = await privateResponse.text();
  if (!privateResponse.ok || privateHtml.includes('https://health.sassmaker.com/tracker.js') || /data-key="ahk_pub_[^"]+"/.test(privateHtml)) {
    throw new Error('Private employee route should render without the App Health tracker');
  }
  if (!privateHtml.includes('data-feedback="false"')) {
    throw new Error('Private employee route should not mount the shared feedback launcher');
  }

  await assertFooterAssets();

  process.stdout.write('Public /admin tracker and feedback present; private employee route tracker and feedback absent; footer assets served with exact bytes and GET/HEAD metadata.\n');
} finally {
  server.kill('SIGTERM');
}
