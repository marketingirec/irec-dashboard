// Vercel Serverless Function — /api/bo-pratiche
// Legge la scheda "GESTIONE DA W.C. A C.A." del foglio Cross-Up Selling / Credit Advisor
// Review, pubblicata sul web in CSV, e la restituisce nella stessa forma in cui il
// connettore Google Drive la dava alla dashboard BO: { title, mimeType, content } col CSV
// in base64. Cosi' altri-reparti/bo/js/dashboard.js resta identico a com'e' stato generato
// e non va ritoccato.
// Si passa da qui e non dal browser per gli stessi motivi di /api/disdette: il CSV
// pubblicato di Google risponde con un redirect che il browser non puo' seguire fra domini,
// e cosi' il link del foglio resta in una variabile d'ambiente invece che scritto nel repo,
// che e' pubblico mentre il foglio contiene nomi di clienti.
//
// Da impostare su Vercel: BO_PRATICHE_CSV_URL
//   Foglio -> File -> Condividi -> Pubblica sul web -> scheda "GESTIONE DA W.C. A C.A.",
//   formato "Valori separati da virgola (.csv)".
const CSV_URL = process.env.BO_PRATICHE_CSV_URL || '';

export default async function handler(req, res) {
  // Niente Access-Control-Allow-Origin: la pagina e' sullo stesso dominio e questi dati
  // hanno dentro i clienti, non vanno resi leggibili da qualunque altro sito.
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!CSV_URL) {
    res.status(503).json({ error: 'BO_PRATICHE_CSV_URL non impostata: pubblicare in CSV la scheda "GESTIONE DA W.C. A C.A." e metterne il link nelle variabili di ambiente.' });
    return;
  }
  try {
    const r = await fetch(CSV_URL, { redirect: 'follow', headers: { 'User-Agent': 'irec-dashboard' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const testo = await r.text();
    if (/^\s*</.test(testo)) throw new Error('il link non restituisce un CSV: controllare che la pubblicazione sia in formato CSV');
    // Se pubblicano per sbaglio un'altra scheda, meglio dirlo subito che mostrare una pagina vuota.
    if (!/\bCLIENTE\b/i.test(testo.slice(0, 4000))) throw new Error('nel CSV non si trova la colonna CLIENTE: probabilmente e\' pubblicata un\'altra scheda');
    res.status(200).json({
      letto: new Date().toISOString().slice(0, 10),
      title: 'IREC- CROSS-UP SELLING - CREDIT ADVISOR REVIEW',
      mimeType: 'text/csv',
      content: Buffer.from(testo, 'utf8').toString('base64')
    });
  } catch (e) {
    res.status(502).json({ error: 'foglio pratiche non leggibile: ' + ((e && e.message) || e) });
  }
}
