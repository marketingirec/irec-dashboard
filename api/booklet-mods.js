// Vercel Serverless Function — /api/booklet-mods
// Modifiche manuali del booklet, condivise fra tutti: un unico JSON su Vercel Blob.
// GET lo restituisce, POST lo riscrive.
// Lo store dashboard-irec e' configurato PRIVATE, quindi ogni chiamata deve dichiarare
// access: 'private'. Scrivere a mano le richieste REST si era rivelato fragile (il nome
// dell'header di accesso non e' documentato in modo stabile), percio' qui si usa l'SDK
// ufficiale: e' l'unica dipendenza del progetto ed esiste solo per questo motivo.
// L'accesso e' gia' filtrato dalla Password Protection del deployment: qui non c'e' altra authz.
import { put, list } from '@vercel/blob';

const PATH = 'booklet/modifiche.json';
const TOKEN = process.env.BLOB_READ_WRITE_TOKEN;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!TOKEN) {
    res.status(500).json({ error: 'BLOB_READ_WRITE_TOKEN mancante: ricollega lo store Blob al progetto spuntando "Add a read-write token env var".' });
    return;
  }
  try {
    if (req.method === 'GET') {
      const { blobs } = await list({ prefix: PATH, limit: 1, token: TOKEN });
      const b = (blobs || []).find((x) => x.pathname === PATH);
      if (!b) { res.status(200).json({ mods: {}, vuoto: true }); return; }
      // Il contenuto di uno store privato non e' scaricabile in chiaro: serve il token.
      // ?t= evita che la CDN serva una copia precedente subito dopo una scrittura.
      const r = await fetch(`${b.url}?t=${Date.now()}`, {
        cache: 'no-store',
        headers: { Authorization: `Bearer ${TOKEN}` }
      });
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
      const payload = JSON.stringify(mods);
      // tetto di sicurezza: e' un file di poche decine di kB, se esplode qualcosa non va
      if (payload.length > 400000) { res.status(413).json({ error: 'payload troppo grande' }); return; }
      await put(PATH, payload, {
        access: 'private',
        token: TOKEN,
        contentType: 'application/json',
        addRandomSuffix: false,   // pathname stabile: l'URL non cambia a ogni salvataggio
        allowOverwrite: true,
        cacheControlMaxAge: 0
      });
      res.status(200).json({ ok: true, n: Object.keys(mods).length });
      return;
    }

    res.status(405).json({ error: 'metodo non supportato' });
  } catch (e) {
    res.status(502).json({ error: String((e && e.message) || e) });
  }
}
