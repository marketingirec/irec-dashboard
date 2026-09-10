// Backend RF (Rintraccio Facile) per Vercel: Salesforce (offline/partner/pending)
// + spesa ADV (Meta+Google account RF). Shopify (online) aggiunto quando disponibile
// il token Admin API (env SHOPIFY_*). Tutto in sola lettura.
import crypto from 'crypto';
import { getAdSpendRF } from '../lib/adspend.js';
import { getShopifyRF } from '../lib/shopify.js';

const LOGIN_URL   = process.env.SF_LOGIN_URL || 'https://login.salesforce.com';
const CLIENT_ID   = process.env.SF_CLIENT_ID;
const USERNAME    = process.env.SF_USERNAME;
const PRIVATE_KEY = (process.env.SF_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const YEAR  = Number(process.env.SF_YEAR || 2026);
const API_V = 'v61.0';
const RF_RTID = '012Mf000000oReaIAE'; // RecordType Rintraccio Facile

const b64url = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function getToken() {
  const head = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const pay  = b64url(JSON.stringify({ iss: CLIENT_ID, sub: USERNAME, aud: LOGIN_URL, exp: Math.floor(Date.now() / 1000) + 300 }));
  const input = head + '.' + pay;
  const s = crypto.createSign('RSA-SHA256'); s.update(input); s.end();
  const jwt = input + '.' + b64url(s.sign(PRIVATE_KEY));
  const r = await fetch(LOGIN_URL + '/services/oauth2/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }) });
  const j = await r.json();
  if (!r.ok) throw new Error('Auth Salesforce fallita: ' + (j.error_description || j.error || r.status));
  return { token: j.access_token, instance: j.instance_url };
}
async function soql(ctx, q) {
  let url = ctx.instance + `/services/data/${API_V}/query?q=` + encodeURIComponent(q);
  let out = [];
  while (url) {
    const r = await fetch(url, { headers: { Authorization: 'Bearer ' + ctx.token } });
    const j = await r.json();
    if (!r.ok) throw new Error('SOQL: ' + (Array.isArray(j) ? j.map((e) => e.message).join('; ') : JSON.stringify(j).slice(0, 300)));
    out = out.concat(j.records || []);
    url = j.nextRecordsUrl ? ctx.instance + j.nextRecordsUrl : null;
  }
  return out;
}
const isRound = (a) => a > 0 && a % 1000 === 0;
const monthOf = (s) => parseInt(String(s || '').slice(5, 7), 10); // 1..12 da 'YYYY-MM-...'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!CLIENT_ID || !USERNAME || !PRIVATE_KEY) { res.status(500).json({ error: 'Config mancante: SF_CLIENT_ID, SF_USERNAME, SF_PRIVATE_KEY su Vercel.' }); return; }
  try {
    const ctx = await getToken();
    const Y = YEAR;
    // Chiuso-Vinto riconosciuto alla DATA DI PAGAMENTO (Data_Chiusa_Vinta__c)
    const vinti = await soql(ctx, `SELECT Name, Amount, ContactName__c, ContactEmail__c, Data_Chiusa_Vinta__c FROM Opportunity WHERE RecordTypeId='${RF_RTID}' AND StageName='Chiuso - Vinto' AND Data_Chiusa_Vinta__c>=${Y}-01-01T00:00:00Z AND Data_Chiusa_Vinta__c<=${Y}-12-31T23:59:59Z`);
    // Chiuso-Pending (in attesa) per CloseDate del mese
    const pend = await soql(ctx, `SELECT Name, Amount, ContactName__c, ContactEmail__c, CloseDate FROM Opportunity WHERE RecordTypeId='${RF_RTID}' AND StageName='Chiuso - Pending' AND CALENDAR_YEAR(CloseDate)=${Y}`);

    const offline = new Array(12).fill(0), partner = new Array(12).fill(0), ordOffline = new Array(12).fill(0), ordPartner = new Array(12).fill(0);
    const offlineP = new Array(12).fill(0), partnerP = new Array(12).fill(0);
    const orders = [];
    vinti.forEach((r) => {
      const am = r.Amount == null ? 0 : +r.Amount, m = monthOf(r.Data_Chiusa_Vinta__c);
      if (m < 1 || m > 12) return;
      if (isRound(am)) { partner[m - 1] += am; ordPartner[m - 1]++; } else { offline[m - 1] += am; ordOffline[m - 1]++; }
      orders.push({ m, n: r.Name || '(opportunity RF)', nome: r.ContactName__c || '', email: r.ContactEmail__c || '', dpag: String(r.Data_Chiusa_Vinta__c || '').slice(0, 10), net: am, st: 'Pagato', sr: 'Salesforce' });
    });
    pend.forEach((r) => {
      const am = r.Amount == null ? 0 : +r.Amount, m = monthOf(r.CloseDate);
      if (m < 1 || m > 12) return;
      if (isRound(am)) partnerP[m - 1] += am; else offlineP[m - 1] += am;
      orders.push({ m, n: r.Name || '(opportunity RF)', nome: r.ContactName__c || '', email: r.ContactEmail__c || '', dpag: '', net: am, st: 'In attesa', sr: 'Salesforce' });
    });

    // ADV RF (Meta + Google account RF) - non blocca
    let adspend = null; try { adspend = await getAdSpendRF(Y); } catch (_e) { adspend = null; }
    // Shopify RF (online per data pagamento + sorgenti + operatori) - solo se configurato; non blocca
    let shopify = null; try { shopify = await getShopifyRF(Y); } catch (e) { shopify = { error: String(e && e.message || e) }; }

    res.status(200).json({
      year: Y,
      sf: { offline, partner, ordOffline, ordPartner, offlineP, partnerP, orders },
      adspend,
      shopify
    });
  } catch (e) {
    res.status(502).json({ error: String(e && e.message || e) });
  }
}
