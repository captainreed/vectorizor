/**
 * Production server: the built client (dist/) plus the /api routes, on one port. Development and
 * `vite preview` mount the same API through the Vite plugin in vite.config.ts instead.
 *
 * Env: PORT (default 3000), VECTORIZOR_DB (default data/vectorizor.db), STATIC_DIR (default dist),
 * TRUST_PROXY=1 when running behind a reverse proxy / ingress.
 */
import path from 'node:path';
import express from 'express';
import { createApiApp } from './app';

const port = Number(process.env.PORT ?? 3000);
const staticDir = path.resolve(process.env.STATIC_DIR ?? 'dist');

const app = createApiApp({
  dbPath: process.env.VECTORIZOR_DB ?? 'data/vectorizor.db',
  trustProxy: process.env.TRUST_PROXY === '1',
});

// Hashed build assets never change; everything else (index.html) must be revalidated.
app.use(
  '/assets',
  express.static(path.join(staticDir, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }),
);
app.use(express.static(staticDir, { index: false, maxAge: 0 }));

// Client-side routes (/, /s/:id) all load the app shell.
app.get(/^\/(?!api\/).*/, (_req, res) => {
  res.set('Cache-Control', 'no-cache');
  res.sendFile(path.join(staticDir, 'index.html'));
});

const server = app.listen(port, () => console.log(`Vectorizor listening on :${port}`));

const shutdown = (signal: string) => {
  console.log(`${signal} received, shutting down`);
  server.close(() => {
    app.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
