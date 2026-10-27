// Spesa ADV mensile da Google Ads API + Meta Marketing API (sola lettura).
// Tutte le credenziali arrivano da env var su Vercel. Se una fonte non e'
// configurata o fallisce, torna null per quella fonte (non blocca la dashboard).

const G_DEV   = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const G_CID   = process.env.GOOGLE_ADS_CLIENT_ID;
const G_SEC   = process.env.GOOGLE_ADS_CLIENT_SECRET;
const G_REF   = process.env.GOOGLE_ADS_REFRESH_TOKEN;
const G_CUST  = (process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '');
const G_LOGIN = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/-/g, '');
/* Google dismette una versione all'incirca ogni anno e da quel momento risponde 400
   UNSUPPORTED_VERSION: e' gia' successo con la v17 (7 settembre) e ora con la v22.
   Le versioni vive si trovano senza credenziali, una POST a
   https://googleads.googleapis.com/vNN/customers/1/googleAds:searchStream risponde 401 se
   la versione esiste e 404 se non esiste. L'override da variabile d'ambiente serve a
   rimediare da Vercel, senza aspettare un rilascio. */
const G_APIV  = process.env.GOOGLE_ADS_API_VERSION || 'v26';

const M_TOKEN = process.env.META_ACCESS_TOKEN;
const M_ACCT  = process.env.META_AD_ACCOUNT_ID;   // formato act_XXXX
const M_APIV  = 'v20.0';

const monthIdx = (s) => parseInt(String(s || '').slice(5, 7), 10) - 1;
const round2 = (v) => Math.round(v * 100) / 100;

async function googleToken() {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: G_CID, client_secret: G_SEC, refresh_token: G_REF, grant_type: 'refresh_token' })
  });
  const j = await r.json();
  if (!r.ok) throw new Error('Google OAuth: ' + (j.error_description || j.error || r.status));
  return j.access_token;
}

/* Il corpo d'errore di Google e' un JSON annidato di tre livelli. Per la riga di stato
   serve la frase, non l'oggetto intero: si prende il messaggio piu' interno, che e'
   quello che dice cosa non va. */
function erroreGoogle(j) {
  const e = (Array.isArray(j) ? j[0] : j) || {};
  const err = e.error || {};
  const det = (err.details || [])[0] || {};
  const dentro = ((det.errors || [])[0] || {}).message;
  return dentro || err.message || JSON.stringify(j).slice(0, 200);
}
async function getGoogleAdsSpend(year) {
  if (!G_DEV || !G_CID || !G_SEC || !G_REF || !G_CUST) return null;
  const token = await googleToken();
  const gaql = `SELECT segments.month, metrics.cost_micros FROM customer WHERE segments.date BETWEEN '${year}-01-01' AND '${year}-12-31'`;
  const headers = { Authorization: 'Bearer ' + token, 'developer-token': G_DEV, 'Content-Type': 'application/json' };
  if (G_LOGIN) headers['login-customer-id'] = G_LOGIN;
  const r = await fetch(`https://googleads.googleapis.com/${G_APIV}/customers/${G_CUST}/googleAds:searchStream`, {
    method: 'POST', headers, body: JSON.stringify({ query: gaql })
  });
  const j = await r.json();
  if (!r.ok) throw new Error('Google Ads: ' + erroreGoogle(j));
  const arr = new Array(12).fill(0);
  const chunks = Array.isArray(j) ? j : [j];
  chunks.forEach((c) => (c.results || []).forEach((row) => {
    const idx = monthIdx(row.segments && row.segments.month);
    if (idx >= 0 && idx < 12) arr[idx] += Number((row.metrics && row.metrics.costMicros) || 0) / 1e6;
  }));
  return arr.map(round2);
}

// Ad set da escludere: frode di giugno rimborsata da Meta (Sales Adset 1/2/3)
const META_FRAUD_ADSETS = new Set(['Sales Adset 1', 'Sales Adset 2', 'Sales Adset 3']);
async function getMetaSpend(year) {
  if (!M_TOKEN || !M_ACCT) return null;
  const tr = encodeURIComponent(JSON.stringify({ since: `${year}-01-01`, until: `${year}-12-31` }));
  // livello ad set + adset_name, cosi' possiamo escludere gli ad set fraudolenti (rimborsati)
  let url = `https://graph.facebook.com/${M_APIV}/${M_ACCT}/insights?fields=spend,adset_name&level=adset&time_range=${tr}&time_increment=monthly&limit=500&access_token=${encodeURIComponent(M_TOKEN)}`;
  const arr = new Array(12).fill(0);
  while (url) {
    const r = await fetch(url);
    const j = await r.json();
    if (!r.ok || j.error) throw new Error('Meta: ' + ((j.error && j.error.message) || r.status));
    (j.data || []).forEach((row) => {
      if (META_FRAUD_ADSETS.has(row.adset_name)) return; // escludi frode rimborsata
      const idx = monthIdx(row.date_start);
      if (idx >= 0 && idx < 12) arr[idx] += Number(row.spend || 0);
    });
    url = j.paging && j.paging.next ? j.paging.next : null;
  }
  return arr.map(round2);
}

/* Consuntivo da fattura. Le API delle piattaforme riportano la spesa netta, mentre la fattura
   dell'agenzia aggiunge una fee del 2,5%: per i mesi gia' fatturati fa fede la fattura, che e'
   quella che consuma il budget. Indice 0 = Gennaio. Importi finali, fee inclusa. */
const FATTURE = {
  irec: { 8: { google: 1690.12, meta: 13721.69 } },   // Settembre 2026: tot. 15.411,81 su 16.220 di budget
  rf:   { 8: { google: 6029.11, meta: 2733.90 } }     // Settembre 2026: tot.  8.763,01 su  9.220 di budget
};
function applicaFatture(out, chi) {
  const f = FATTURE[chi] || {};
  Object.keys(f).forEach((k) => {
    const i = Number(k);
    ['google', 'meta'].forEach((canale) => {
      const v = f[k][canale];
      if (v == null) return;
      if (!out[canale]) out[canale] = new Array(12).fill(null);  // la fattura la sappiamo comunque
      out[canale][i] = v;
    });
  });
  return out;
}

// Ritorna { google:[12]|null, meta:[12]|null, errors:{...} } senza mai lanciare.
export async function getAdSpend(year) {
  const out = { google: null, meta: null, errors: {} };
  const [g, m] = await Promise.allSettled([getGoogleAdsSpend(year), getMetaSpend(year)]);
  if (g.status === 'fulfilled') out.google = g.value; else out.errors.google = String(g.reason && g.reason.message || g.reason);
  if (m.status === 'fulfilled') out.meta = m.value; else out.errors.meta = String(m.reason && m.reason.message || m.reason);
  return applicaFatture(out, 'irec');
}

/* ===== RF (Rintraccio Facile): account Meta + Google dedicati ===== */
const M_TOKEN_RF = process.env.META_ACCESS_TOKEN_RF;
const M_ACCT_RF  = process.env.META_AD_ACCOUNT_ID_RF;   // formato act_XXXX
const G_CUST_RF  = (process.env.GOOGLE_ADS_CUSTOMER_ID_RF || '').replace(/-/g, '');
async function getGoogleAdsSpendRF(year) {
  if (!G_DEV || !G_CID || !G_SEC || !G_REF || !G_CUST_RF) return null;
  const token = await googleToken();
  const gaql = `SELECT segments.month, metrics.cost_micros FROM customer WHERE segments.date BETWEEN '${year}-01-01' AND '${year}-12-31'`;
  const headers = { Authorization: 'Bearer ' + token, 'developer-token': G_DEV, 'Content-Type': 'application/json' };
  if (G_LOGIN) headers['login-customer-id'] = G_LOGIN;
  const r = await fetch(`https://googleads.googleapis.com/${G_APIV}/customers/${G_CUST_RF}/googleAds:searchStream`, { method: 'POST', headers, body: JSON.stringify({ query: gaql }) });
  const j = await r.json();
  if (!r.ok) throw new Error('Google Ads RF: ' + erroreGoogle(j));
  const arr = new Array(12).fill(0);
  (Array.isArray(j) ? j : [j]).forEach((c) => (c.results || []).forEach((row) => {
    const idx = monthIdx(row.segments && row.segments.month);
    if (idx >= 0 && idx < 12) arr[idx] += Number((row.metrics && row.metrics.costMicros) || 0) / 1e6;
  }));
  return arr.map(round2);
}
async function getMetaSpendRF(year) {
  if (!M_TOKEN_RF || !M_ACCT_RF) return null;
  const tr = encodeURIComponent(JSON.stringify({ since: `${year}-01-01`, until: `${year}-12-31` }));
  let url = `https://graph.facebook.com/${M_APIV}/${M_ACCT_RF}/insights?fields=spend&level=account&time_range=${tr}&time_increment=monthly&limit=500&access_token=${encodeURIComponent(M_TOKEN_RF)}`;
  const arr = new Array(12).fill(0);
  while (url) {
    const r = await fetch(url); const j = await r.json();
    if (!r.ok || j.error) throw new Error('Meta RF: ' + ((j.error && j.error.message) || r.status));
    (j.data || []).forEach((row) => { const idx = monthIdx(row.date_start); if (idx >= 0 && idx < 12) arr[idx] += Number(row.spend || 0); });
    url = j.paging && j.paging.next ? j.paging.next : null;
  }
  return arr.map(round2);
}
export async function getAdSpendRF(year) {
  const out = { google: null, meta: null, errors: {} };
  const [g, m] = await Promise.allSettled([getGoogleAdsSpendRF(year), getMetaSpendRF(year)]);
  if (g.status === 'fulfilled') out.google = g.value; else out.errors.google = String(g.reason && g.reason.message || g.reason);
  if (m.status === 'fulfilled') out.meta = m.value; else out.errors.meta = String(m.reason && m.reason.message || m.reason);
  return applicaFatture(out, 'rf');
}

/* ===== Previsione di fine mese =====
   PREV = la spesa vera del mese fino a oggi compreso, piu' il budget giornaliero delle
   campagne attive moltiplicato per i giorni da domani a fine mese. Risponde alla domanda
   "se teniamo questo ritmo, a fine mese dove arriviamo".
   Il giorno di oggi arriva dal consuntivo e non dal budget, cosi' non si sovrappone al Real
   della tabella, che e' anch'esso il mese fino a adesso. Il rovescio e' che oggi e' una
   giornata a meta': finche' non e' finita la previsione resta bassa della parte non ancora
   spesa, e converge sul valore pieno a fine giornata.
   Si ferma al mese in corso: per un mese chiuso la previsione e' il consuntivo, e per un mese
   futuro dipenderebbe da campagne che ancora non esistono.
   Le date sono in ora di Roma e non UTC: fra mezzanotte e le due le due non coincidono e i
   giorni da contare verrebbero sbagliati. */
const dataRoma = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const giorniNelMese = (anno, mese) => new Date(anno, mese, 0).getDate();   // mese 1..12

/* Un budget Google puo' essere condiviso fra piu' campagne: sommandolo per campagna lo si
   conterebbe piu' volte, percio' si raccoglie per id del budget e si somma una volta sola. */
async function googleDailyBudget(cust) {
  if (!G_DEV || !G_CID || !G_SEC || !G_REF || !cust) return null;
  const token = await googleToken();
  const gaql = "SELECT campaign_budget.id, campaign_budget.amount_micros FROM campaign WHERE campaign.status = 'ENABLED'";
  const headers = { Authorization: 'Bearer ' + token, 'developer-token': G_DEV, 'Content-Type': 'application/json' };
  if (G_LOGIN) headers['login-customer-id'] = G_LOGIN;
  const r = await fetch(`https://googleads.googleapis.com/${G_APIV}/customers/${cust}/googleAds:searchStream`, {
    method: 'POST', headers, body: JSON.stringify({ query: gaql })
  });
  const j = await r.json();
  if (!r.ok) throw new Error('Google Ads budget: ' + erroreGoogle(j));
  const perId = new Map();
  (Array.isArray(j) ? j : [j]).forEach((c) => (c.results || []).forEach((row) => {
    const b = row.campaignBudget || {};
    if (b.id == null) return;
    perId.set(String(b.id), Number(b.amountMicros || 0) / 1e6);
  }));
  let tot = 0; perId.forEach((v) => { tot += v; });
  return round2(tot);
}

/* Su Meta il budget giornaliero sta sulla campagna quando e' attiva l'ottimizzazione del
   budget di campagna, altrimenti sui singoli gruppi di inserzioni. Si prendono le campagne
   che ce l'hanno e, per tutte le altre, i loro gruppi attivi. Gli importi arrivano in
   centesimi della valuta del conto. Le campagne a budget totale non hanno un giornaliero:
   restano fuori e la dashboard lo dichiara. */
async function metaDailyBudget(token, acct) {
  if (!token || !acct) return null;
  const vivo = encodeURIComponent('["ACTIVE"]');
  const indirizzo = (risorsa, campi) => `https://graph.facebook.com/${M_APIV}/${acct}/${risorsa}?fields=${campi}&effective_status=${vivo}&limit=500&access_token=${encodeURIComponent(token)}`;
  const leggiTutto = async (url) => {
    const righe = [];
    while (url) {
      const r = await fetch(url); const j = await r.json();
      if (!r.ok || j.error) throw new Error((j.error && j.error.message) || ('HTTP ' + r.status));
      (j.data || []).forEach((x) => righe.push(x));
      url = j.paging && j.paging.next ? j.paging.next : null;
    }
    return righe;
  };
  let tot = 0, senzaGiornaliero = 0;
  const conBudgetDiCampagna = new Set();
  const campagne = await leggiTutto(indirizzo('campaigns', 'daily_budget,lifetime_budget'));
  campagne.forEach((c) => {
    const d = Number(c.daily_budget || 0);
    if (d > 0) { conBudgetDiCampagna.add(String(c.id)); tot += d / 100; }
    else if (Number(c.lifetime_budget || 0) > 0) { conBudgetDiCampagna.add(String(c.id)); senzaGiornaliero++; }
  });
  const gruppi = await leggiTutto(indirizzo('adsets', 'daily_budget,lifetime_budget,campaign_id'));
  gruppi.forEach((a) => {
    if (conBudgetDiCampagna.has(String(a.campaign_id))) return;
    const d = Number(a.daily_budget || 0);
    if (d > 0) tot += d / 100;
    else if (Number(a.lifetime_budget || 0) > 0) senzaGiornaliero++;
  });
  return { daily: round2(tot), senzaGiornaliero };
}

async function googleSpesoTra(cust, da, a) {
  if (!G_DEV || !G_CID || !G_SEC || !G_REF || !cust) return null;
  if (a < da) return 0;
  const token = await googleToken();
  const gaql = `SELECT metrics.cost_micros FROM customer WHERE segments.date BETWEEN '${da}' AND '${a}'`;
  const headers = { Authorization: 'Bearer ' + token, 'developer-token': G_DEV, 'Content-Type': 'application/json' };
  if (G_LOGIN) headers['login-customer-id'] = G_LOGIN;
  const r = await fetch(`https://googleads.googleapis.com/${G_APIV}/customers/${cust}/googleAds:searchStream`, {
    method: 'POST', headers, body: JSON.stringify({ query: gaql })
  });
  const j = await r.json();
  if (!r.ok) throw new Error('Google Ads: ' + erroreGoogle(j));
  let tot = 0;
  (Array.isArray(j) ? j : [j]).forEach((c) => (c.results || []).forEach((row) => {
    tot += Number((row.metrics && row.metrics.costMicros) || 0) / 1e6;
  }));
  return round2(tot);
}

async function metaSpesoTra(token, acct, da, a) {
  if (!token || !acct) return null;
  if (a < da) return 0;
  const tr = encodeURIComponent(JSON.stringify({ since: da, until: a }));
  let url = `https://graph.facebook.com/${M_APIV}/${acct}/insights?fields=spend&level=account&time_range=${tr}&limit=500&access_token=${encodeURIComponent(token)}`;
  let tot = 0;
  while (url) {
    const r = await fetch(url); const j = await r.json();
    if (!r.ok || j.error) throw new Error('Meta: ' + ((j.error && j.error.message) || r.status));
    (j.data || []).forEach((x) => { tot += Number(x.spend || 0); });
    url = j.paging && j.paging.next ? j.paging.next : null;
  }
  return round2(tot);
}

async function previsione(cust, mToken, mAcct) {
  const oggi = dataRoma();
  const anno = +oggi.slice(0, 4), mese = +oggi.slice(5, 7), giorno = +oggi.slice(8, 10);
  const primo = oggi.slice(0, 7) + '-01';
  const giorniMese = giorniNelMese(anno, mese);
  const out = {
    anno, mese, oggi, aOggi: oggi, giorniMese,
    // oggi non si moltiplica: arriva dal consuntivo. Si parte da domani.
    giorniDaDomani: giorniMese - giorno,
    speso: { google: null, meta: null },
    daily: { google: null, meta: null },
    prev:  { google: null, meta: null },
    senzaGiornaliero: 0,
    errors: {}
  };
  const [gs, ms, gb, mb] = await Promise.allSettled([
    googleSpesoTra(cust, primo, oggi),
    metaSpesoTra(mToken, mAcct, primo, oggi),
    googleDailyBudget(cust),
    metaDailyBudget(mToken, mAcct)
  ]);
  const male = (p) => String((p.reason && p.reason.message) || p.reason);
  if (gs.status === 'fulfilled') out.speso.google = gs.value; else out.errors.googleSpesa = male(gs);
  if (ms.status === 'fulfilled') out.speso.meta = ms.value; else out.errors.metaSpesa = male(ms);
  if (gb.status === 'fulfilled') out.daily.google = gb.value; else out.errors.googleBudget = male(gb);
  if (mb.status === 'fulfilled') {
    if (mb.value) { out.daily.meta = mb.value.daily; out.senzaGiornaliero = mb.value.senzaGiornaliero; }
  } else out.errors.metaBudget = male(mb);
  ['google', 'meta'].forEach((canale) => {
    const s = out.speso[canale], d = out.daily[canale];
    if (s == null || d == null) return;
    out.prev[canale] = round2(s + d * out.giorniDaDomani);
  });
  return out;
}

export const getAdPrevisione   = () => previsione(G_CUST, M_TOKEN, M_ACCT);
export const getAdPrevisioneRF = () => previsione(G_CUST_RF, M_TOKEN_RF, M_ACCT_RF);
