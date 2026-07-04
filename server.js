// Minimal zero-dependency static server for local preview.
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const PORT = 4321;
const TYPES = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml' };

// Local-only mock of the /api/sync Vercel function (stores JSON per key in a file),
// so cross-device sync can be tested locally. Production uses api/sync.js + Vercel Blob.
const SYNC_FILE = path.join(ROOT, '.sync-local.json');
const readStore = () => { try { return JSON.parse(fs.readFileSync(SYNC_FILE, 'utf8')); } catch { return {}; } };
const writeStore = (s) => fs.writeFileSync(SYNC_FILE, JSON.stringify(s));
function handleSync(req, res) {
  const key = new URL(req.url, 'http://localhost').searchParams.get('key') || '';
  const json = (code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'cache-control': 'no-store' }); res.end(JSON.stringify(obj)); };
  if (key.length < 4 || key.length > 200) return json(400, { error: 'invalid key' });
  if (req.method === 'GET') {
    const store = readStore();
    if (store[key] === undefined) return json(404, { error: 'not found' });
    res.writeHead(200, { 'Content-Type': 'application/json', 'cache-control': 'no-store' });
    return res.end(store[key]);
  }
  if (req.method === 'POST' || req.method === 'PUT') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      try { JSON.parse(body); } catch { return json(400, { error: 'bad json' }); }
      const store = readStore(); store[key] = body; writeStore(store);
      json(200, { ok: true });
    });
    return;
  }
  json(405, { error: 'method not allowed' });
}

http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/api/sync') return handleSync(req, res);
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(ROOT, urlPath);
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); return res.end('Forbidden'); }
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(PORT, () => console.log(`MacroTrack running at http://localhost:${PORT}`));
