import type { APIRoute } from 'astro';

export const GET: APIRoute = ({ request }) => {
  const origin = new URL(request.url).origin;
  return Response.json({
    name: 'Field Track',
    version: '1',
    url: origin,
    description: 'A held MVP for managers to review fresh locations and retained routes from administrator-enrolled Android phones.',
    lifecycle: 'held',
    data: 'synthetic-demo-only',
    trackingBoundary: 'Administrator-enrolled devices have no employee start, stop, pause, or unenroll controls. Android keeps its ongoing location notification visible.',
    unresolved: ['Business economics', 'Physical Android device testing'],
    llms: `${origin}/llms.txt`,
    llmsFull: `${origin}/llms-full.txt`,
    sitemap: `${origin}/sitemap.xml`,
    robots: `${origin}/robots.txt`,
    openapi: `${origin}/openapi.json`,
    markdown: { homepage: `${origin}/index.md` },
    surfaces: [
      {
        id: 'home',
        url: `${origin}/`,
        md: `${origin}/index.md`,
        kind: 'interactive-synthetic-demo',
        description: 'Manager dashboard with fictional employees and routes',
      },
    ],
    auth: {
      public: true,
      notes: 'The public demo is credential-free and has no production database binding.',
    },
  });
};
