// Cross-device sync store backed by Vercel Blob.
//   GET      /api/sync?key=KEY  -> latest JSON state (404 if none yet)
//   PUT/POST /api/sync?key=KEY  -> store JSON state (POST also supports navigator.sendBeacon)
// Setup: connect a Vercel Blob store to this project (adds BLOB_READ_WRITE_TOKEN automatically).
// The sync key is hashed for the blob path, so keys never appear in public blob URLs.
const crypto = require('crypto');

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB is plenty for a food log

function resolveAlias(key) {
  // Optional SYNC_ALIASES env var: "alias:realkey,alias2:realkey2" (keeps a memorable
  // alias out of the public repo while the real key stays private).
  const raw = process.env.SYNC_ALIASES || '';
  for (const pair of raw.split(',')) {
    const i = pair.indexOf(':');
    if (i < 0) continue;
    const alias = pair.slice(0, i).trim(), phrase = pair.slice(i + 1).trim();
    if (alias && phrase && alias === key) return phrase;
  }
  return key;
}
function prefixFor(key) {
  const hash = crypto.createHash('sha256').update('macrotrack:' + resolveAlias(key)).digest('hex').slice(0, 32);
  return `macrotrack/${hash}/`;
}

module.exports = async (req, res) => {
  const key = req.query && req.query.key ? String(req.query.key) : '';
  if (key.length < 4 || key.length > 200) {
    res.status(400).json({ error: 'invalid key' });
    return;
  }

  let blob;
  try { blob = await import('@vercel/blob'); }
  catch (e) { res.status(503).json({ error: 'sync unavailable' }); return; }
  const { list, put, del } = blob;

  const prefix = prefixFor(key);
  const latest = async () => {
    const { blobs } = await list({ prefix });
    if (!blobs.length) return { latest: null, all: [] };
    const sorted = [...blobs].sort((a, b) => b.pathname.localeCompare(a.pathname));
    return { latest: sorted[0], all: sorted };
  };

  try {
    if (req.method === 'GET') {
      const { latest: l } = await latest();
      if (!l) { res.status(404).json({ error: 'not found' }); return; }
      const r = await fetch(l.url, { cache: 'no-store' });
      if (!r.ok) { res.status(404).json({ error: 'not found' }); return; }
      const data = await r.json();
      res.setHeader('cache-control', 'no-store');
      res.status(200).json(data);
      return;
    }

    if (req.method === 'POST' || req.method === 'PUT') {
      let body = req.body;
      body = (typeof body === 'string') ? body : JSON.stringify(body == null ? {} : body);
      if (body.length > MAX_BYTES) { res.status(413).json({ error: 'too large' }); return; }
      JSON.parse(body); // reject non-JSON

      // Each write is a new immutable version so reads never hit a stale CDN copy.
      const version = String(Date.now()).padStart(15, '0');
      await put(`${prefix}${version}.json`, body, { access: 'public', addRandomSuffix: false, contentType: 'application/json' });

      // Keep only the 3 most recent versions.
      const { all } = await latest();
      const stale = all.slice(3);
      if (stale.length) await del(stale.map((b) => b.url));

      res.status(200).json({ ok: true });
      return;
    }

    res.setHeader('Allow', 'GET, POST, PUT');
    res.status(405).json({ error: 'method not allowed' });
  } catch (e) {
    res.status(503).json({ error: 'sync unavailable' });
  }
};
