// Count and Say progress service. Pure logic; the storage object is passed in
// (Netlify Blobs in production, an in-memory map in local tests).
// store API used: get(key, {type:'json'}) -> value|null, setJSON(key, value), delete(key)
import crypto from 'node:crypto';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O/1/I/L
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });
const err = (msg, status = 400) => json({ error: msg }, status);

const newCode = () => Array.from(crypto.randomBytes(6), b => CODE_CHARS[b % CODE_CHARS.length]).join('');
const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const scrypt = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
const cleanCode = c => String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12);
const cleanName = n => String(n || '').replace(/[<>]/g, '').trim().slice(0, 30);

async function children(store) { return (await store.get('children', { type: 'json' })) || {}; }

// Merge two progress records: progress only ever goes forward.
export function mergeProgress(a = {}, b = {}) {
  const out = { ...a };
  for (const [id, p] of Object.entries(b || {})) {
    const q = out[id] || {};
    out[id] = {
      listen: !!(q.listen || p.listen),
      say: Math.max(q.say || 0, p.say || 0),
      words: !!(q.words || p.words),
      ...((q.doneAt || p.doneAt) ? { doneAt: [q.doneAt, p.doneAt].filter(Boolean).sort()[0] } : {}),
    };
  }
  return out;
}
function mergeLog(a = {}, b = {}) {
  const out = { ...a };
  for (const [d, s] of Object.entries(b || {})) if (/^\d{4}-\d\d-\d\d$/.test(d)) out[d] = Math.max(out[d] || 0, Math.min(+s || 0, 86400));
  const keys = Object.keys(out).sort(); while (keys.length > 120) delete out[keys.shift()];
  return out;
}

async function isAdmin(store, token) {
  if (!token) return false;
  const a = await store.get('admin', { type: 'json' });
  return !!(a && (a.tokens || []).includes(sha(token)));
}

export async function handle(req, store) {
  if (req.method !== 'POST') return err('Use POST', 405);
  let body; try { body = await req.json(); } catch { return err('Bad request'); }
  const action = String(body.action || '');

  // ----- child actions (the child's code is their key) -----
  if (action === 'login' || action === 'save' || action === 'reset') {
    const code = cleanCode(body.code);
    const kids = await children(store);
    const kid = kids[code];
    if (!kid) return err('That code was not found. Check it with your parent.', 404);
    const key = 'progress/' + code;
    let rec = (await store.get(key, { type: 'json' })) || { progress: {}, stars: 0, log: {} };
    if (action === 'reset') {
      if (!kid.tester) return err('Only a test account can be reset.', 403);
      rec = { progress: {}, stars: 0, log: rec.log || {}, lastSeen: new Date().toISOString(), resetAt: new Date().toISOString() };
      await store.setJSON(key, rec);
      return json({ ok: true, name: kid.name, tester: !!kid.tester, ...rec });
    }
    if (action === 'save') {
      // a reset wins over older progress still sitting on a device that has not seen the reset yet
      if (rec.resetAt && body.knownReset !== rec.resetAt)
        return json({ ok: true, stale: true, name: kid.name, tester: !!kid.tester, progress: rec.progress || {}, stars: rec.stars || 0, resetAt: rec.resetAt });
      rec = {
        progress: mergeProgress(rec.progress, body.progress),
        stars: Math.max(rec.stars || 0, Math.min(+body.stars || 0, 1e6)),
        log: mergeLog(rec.log, body.log),
        current: typeof body.current === 'string' ? body.current.slice(0, 80) : rec.current,
        lastSeen: new Date().toISOString(),
        resetAt: rec.resetAt,
      };
      await store.setJSON(key, rec);
    }
    return json({ ok: true, name: kid.name, tester: !!kid.tester, progress: rec.progress || {}, stars: rec.stars || 0, resetAt: rec.resetAt || null });
  }

  // ----- parent actions -----
  if (action === 'adminStatus') {
    const a = await store.get('admin', { type: 'json' });
    return json({ hasPassword: !!a });
  }
  if (action === 'adminSetup' || action === 'adminLogin') {
    const pw = String(body.password || '');
    if (pw.length < 6) return err('The password must be at least 6 characters.');
    let a = await store.get('admin', { type: 'json' });
    if (action === 'adminSetup') {
      if (a) return err('A parent password already exists. Log in instead.', 409);
      const salt = crypto.randomBytes(16).toString('hex');
      a = { salt, hash: scrypt(pw, salt), tokens: [] };
    } else {
      if (!a) return err('No parent password yet. Create one first.', 404);
      const h = scrypt(pw, a.salt);
      if (!crypto.timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(a.hash, 'hex'))) return err('That password is not right.', 401);
    }
    const token = crypto.randomBytes(24).toString('hex');
    a.tokens = [sha(token), ...(a.tokens || [])].slice(0, 10);
    await store.setJSON('admin', a);
    return json({ ok: true, token });
  }

  if (!(await isAdmin(store, body.token))) return err('Please log in as a parent again.', 401);

  if (action === 'list') {
    const kids = await children(store);
    const out = [];
    for (const [code, k] of Object.entries(kids)) {
      const rec = (await store.get('progress/' + code, { type: 'json' })) || {};
      out.push({ code, name: k.name, tester: !!k.tester, created: k.created, progress: rec.progress || {}, stars: rec.stars || 0,
        log: rec.log || {}, current: rec.current || '', lastSeen: rec.lastSeen || null });
    }
    out.sort((x, y) => (x.tester - y.tester) || x.name.localeCompare(y.name));
    return json({ ok: true, children: out });
  }
  if (action === 'addChild') {
    const name = cleanName(body.name);
    if (!name) return err('Type a name first.');
    const kids = await children(store);
    if (Object.keys(kids).length >= 50) return err('You can have up to 50 players.');
    let code; do { code = newCode(); } while (kids[code]);
    kids[code] = { name, tester: !!body.tester, created: new Date().toISOString() };
    await store.setJSON('children', kids);
    return json({ ok: true, code, name, tester: !!body.tester });
  }
  if (action === 'removeChild') {
    const code = cleanCode(body.code);
    const kids = await children(store);
    if (!kids[code]) return err('Not found', 404);
    delete kids[code];
    await store.setJSON('children', kids);
    await store.delete('progress/' + code);
    return json({ ok: true });
  }
  if (action === 'resetChild') {
    const code = cleanCode(body.code);
    const kids = await children(store);
    if (!kids[code]) return err('Not found', 404);
    const old = (await store.get('progress/' + code, { type: 'json' })) || {};
    await store.setJSON('progress/' + code, { progress: {}, stars: 0, log: old.log || {}, resetAt: new Date().toISOString() });
    return json({ ok: true });
  }
  return err('Unknown action');
}
