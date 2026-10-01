// Vercel Serverless Function — /api/booklet-mods
// Modifiche manuali del booklet, condivise fra tutti. Vivono in un unico JSON su Vercel Blob:
// GET lo restituisce, POST lo riscrive. Il progetto non ha dipendenze e non voglio aggiungerne,
// quindi parlo con l'API REST di Blob via fetch invece di usare @vercel/blob.
// L'accesso e' gia' protetto dalla Password Protection del deployment: qui non c'e' altra authz.
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
const PATH = 'booklet/modifiche.json';
const API = 'https://blob.vercel-storage.com';

async function trovaUrl() {
  const r = await fetch(`${API}/?prefix=${encodeURIComponent(PATH)}&limit=1`, {
    headers: { Authorization: `Bearer ${TOKEN}`, 'x-api-version': '7' }
  });
  if (!r.ok) throw new Error('list ' + r.status);
  const j = await r.json();
  const b = (j.blobs || []).find((x) => x.pathname === PATH);
  return b ? b.url : null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!TOKEN) {
    res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN mancante: ricollega lo store Blob al progetto spuntando "Add a read-write token env var".' });
    return;
  }
  try {
    if (req.method === 'GET') {
      const url = await trovaUrl();
      if (!url) { res.status(200).json({ mods: {}, vuoto: true }); return; }
      // ?t= per non farsi servire una copia vecchia dalla CDN
      const r = await fetch(`${url}?t=${Date.now()}`, { cache: 'no-store' });
      if (!r.ok) throw new Error('download ' + r.status);
      res.status(200).json({ mods: await r.json() });
      return;
    }
    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') body = JSON.parse(body || '{}');
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        res.status(400).json({ error: 'attesa una mappa di modifiche' }); return;
      }
      const mods = body.mods && typeof body.mods === 'object' ? body.mods : body;
      // tetto di sicurezza: e' un file di poche decine di kB, se esplode qualcosa non va
      const payload = JSON.stringify(mods);
      if (payload.length > 400000) { res.status(413).json({ error: 'payload troppo grande' }); return; }
      const r = await fetch(`${API}/${PATH}`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'x-api-version': '7',
          'x-content-type': 'application/json',
          'x-add-random-suffix': '0',   // pathname stabile, cosi' l'URL non cambia a ogni salvataggio
          'x-allow-overwrite': '1',
          'x-cache-control-max-age': '0'
        },
        body: payload
      });
      if (!r.ok) throw new Error('upload ' + r.status + ' ' + (await r.text()).slice(0, 200));
      res.status(200).json({ ok: true, n: Object.keys(mods).length });
      return;
    }
    res.status(405).json({ error: 'metodo non supportato' });
  } catch (e) {
    res.status(502).json({ error: String((e && e.message) || e) });
  }
}
