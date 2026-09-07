// Spesa ADV mensile da Google Ads API + Meta Marketing API (sola lettura).
// Tutte le credenziali arrivano da env var su Vercel. Se una fonte non e'
// configurata o fallisce, torna null per quella fonte (non blocca la dashboard).

const G_DEV   = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
const G_CID   = process.env.GOOGLE_ADS_CLIENT_ID;
const G_SEC   = process.env.GOOGLE_ADS_CLIENT_SECRET;
const G_REF   = process.env.GOOGLE_ADS_REFRESH_TOKEN;
const G_CUST  = (process.env.GOOGLE_ADS_CUSTOMER_ID || '').replace(/-/g, '');
const G_LOGIN = (process.env.GOOGLE_ADS_LOGIN_CUSTOMER_ID || '').replace(/-/g, '');
const G_APIV  = 'v17';

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
  if (!r.ok) throw new Error('Google Ads: ' + JSON.stringify(j).slice(0, 300));
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

// Ritorna { google:[12]|null, meta:[12]|null, errors:{...} } senza mai lanciare.
export async function getAdSpend(year) {
  const out = { google: null, meta: null, errors: {} };
  const [g, m] = await Promise.allSettled([getGoogleAdsSpend(year), getMetaSpend(year)]);
  if (g.status === 'fulfilled') out.google = g.value; else out.errors.google = String(g.reason && g.reason.message || g.reason);
  if (m.status === 'fulfilled') out.meta = m.value; else out.errors.meta = String(m.reason && m.reason.message || m.reason);
  return out;
}
