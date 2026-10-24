import { getStore } from '@netlify/blobs';
import { handle } from '../../lib/api-core.mjs';

export default async (req) => {
  try {
    return await handle(req, getStore({ name: 'count-and-say', consistency: 'strong' }));
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: 'The server had a problem. Try again in a minute.' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
};
export const config = { path: '/api' };
