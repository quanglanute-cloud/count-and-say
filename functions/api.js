// Cloudflare Pages Function: POST /api — progress service backed by a D1 database bound as `DB`.
import { handle } from '../lib/api-core.mjs';

let ready = null;
function d1Store(db) {
  if (!ready) ready = db.prepare('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)').run();
  return {
    async get(k) { await ready; const r = await db.prepare('SELECT v FROM kv WHERE k = ?').bind(k).first(); return r ? JSON.parse(r.v) : null; },
    async setJSON(k, v) { await ready; await db.prepare('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v').bind(k, JSON.stringify(v)).run(); },
    async delete(k) { await ready; await db.prepare('DELETE FROM kv WHERE k = ?').bind(k).run(); },
  };
}

export async function onRequest({ request, env }) {
  const json = (body, status) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
  if (!env.DB) return json({ error: 'Online saving is not set up yet: the database is not connected.', setup: true }, 503);
  try { return await handle(request, d1Store(env.DB)); }
  catch (e) { ready = null; console.error(e); return json({ error: 'The server had a problem. Try again in a minute.' }, 500); }
}
