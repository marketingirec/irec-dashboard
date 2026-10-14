// Vercel Serverless Function — /api/wallet
// Il wallet di Rintraccio Facile: chi ha comprato credito, quanto ne ha consumato e quanto gliene
// resta. Tre fonti, tutte in sola lettura:
//   1. ricariche da e-commerce  -> Shopify, prodotto "Ricarica Wallet" attivo
//   2. ricariche da rete vendita-> Salesforce, le opportunity che la dashboard mappa come Partner
//   3. consumi                  -> Shopify, ordini con lo sconto "Sconto Credito Wallet - <id>"
// Il numero dentro quel codice cambia a ogni utilizzo, quindi non lega il consumo alla ricarica:
// l'unica chiave che tiene insieme le tre fonti e' l'email del cliente.
import crypto from 'crypto';

const LOGIN_URL   = process.env.SF_LOGIN_URL || 'https://login.salesforce.com';
const CLIENT_ID   = process.env.SF_CLIENT_ID;
const USERNAME    = process.env.SF_USERNAME;
const PRIVATE_KEY = (process.env.SF_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const YEAR  = Number(process.env.SF_YEAR || 2026);
const API_V = 'v61.0';
const RF_RTID = '012Mf000000oReaIAE';

const SHOP_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOP_TOKEN  = process.env.SHOPIFY_ADMIN_TOKEN;
const SHOP_API_V  = process.env.SHOPIFY_API_VERSION || '2026-07';

/* I prodotti di ricarica da tenere: solo quelli a catalogo attivo. Gli altri tagli sono a draft
   e li hanno usati per le prove interne, quindi restano fuori per scelta esplicita.
   Il cashback non e' una riga d'ordine: il credito caricato e' l'importo piu' il regalo, e la
   percentuale la dice il prodotto. Dove non la sappiamo il credito resta pari all'importo e la
   riga lo dichiara, invece di dare per buona un'aliquota inventata. */
const PRODOTTI_RICARICA = ['Ricarica Wallet 500€ + 100€ in regalo'];
const CASHBACK = { 500: 0.20 };          // importo pagato -> quota di credito in regalo
const CASHBACK_PARTNER = null;           // da confermare: quanto regala una ricarica da rete vendita

const RX_WALLET = /sconto\s+credito\s+wallet/i;
const round2 = (v) => Math.round(v * 100) / 100;
const giorno = (iso) => String(iso || '').slice(0, 10);
const mail = (x) => String(x == null ? '' : x).trim().toLowerCase();

/* ---------- Salesforce ---------- */
const b64url = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function sfToken() {
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

/* ---------- Shopify ---------- */
async function gql(query, variables) {
  const r = await fetch(`https://${SHOP_DOMAIN}/admin/api/${SHOP_API_V}/graphql.json`, {
    method: 'POST', headers: { 'X-Shopify-Access-Token': SHOP_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: variables || {} })
  });
  const j = await r.json();
  if (j.errors) throw new Error('Shopify: ' + j.errors.map((e) => e.message).join('; '));
  return j.data;
}
/* Le ricariche non si possono cercare per prodotto negli ordini: il filtro per prodotto viene
   ignorato e scorrere tutto l'anno costerebbe decine di chiamate. ShopifyQL invece sa filtrare
   per titolo e restituisce ordine, email e giorno in una botta sola. */
async function ricaricheEcommerce() {
  const out = [];
  for (const titolo of PRODOTTI_RICARICA) {
    const q = `FROM sales SHOW net_sales GROUP BY order_name, customer_email, day WHERE product_title = '${titolo.replace(/'/g, "\\'")}' SINCE ${YEAR}-01-01 UNTIL today ORDER BY day ASC LIMIT 500`;
    const d = await gql(`query($q:String!){shopifyqlQuery(query:$q){parseErrors tableData{rows}}}`, { q });
    const res = d && d.shopifyqlQuery;
    if (!res) continue;
    if (res.parseErrors && res.parseErrors.length) throw new Error('ShopifyQL: ' + res.parseErrors.join('; '));
    ((res.tableData && res.tableData.rows) || []).forEach((r) => {
      const imp = Number(r.net_sales);
      // le righe negative sono i rimborsi e quelle a zero ordini non pagati: nessuna delle due
      // ha caricato credito, quindi non entrano
      if (!Number.isFinite(imp) || imp <= 0) return;
      out.push({ email: mail(r.customer_email), data: giorno(r.day), importo: round2(imp), tipo: 'ecommerce', rif: r.order_name || '' });
    });
  }
  return out;
}
// Consumi: un ordine puo' portare piu' codici wallet, ma lo scalato e' uno solo ed e' lo sconto
// totale dell'ordine. Sommare le singole applicazioni lo conterebbe due volte.
async function consumi() {
  const out = [];
  const q = `query($after:String){orders(first:50,after:$after,query:"discount_code:'Sconto Credito Wallet*' created_at:>=${YEAR}-01-01",sortKey:CREATED_AT){edges{node{name createdAt customer{email} discountCodes totalDiscountsSet{shopMoney{amount}}}}pageInfo{hasNextPage endCursor}}}`;
  let after = null, giri = 0;
  do {
    const d = await gql(q, after ? { after } : {});
    const o = d && d.orders; if (!o) break;
    (o.edges || []).forEach((e) => {
      const n = e.node; if (!n) return;
      if (!(n.discountCodes || []).some((c) => RX_WALLET.test(c))) return;
      const amt = parseFloat((n.totalDiscountsSet && n.totalDiscountsSet.shopMoney && n.totalDiscountsSet.shopMoney.amount) || 0) || 0;
      if (amt <= 0) return;
      out.push({ email: mail(n.customer && n.customer.email), data: giorno(n.createdAt), importo: round2(amt), rif: n.name || '' });
    });
    after = (o.pageInfo && o.pageInfo.hasNextPage) ? o.pageInfo.endCursor : null; giri++;
  } while (after && giri < 20);
  return out;
}
/* Ordini dei clienti wallet, per contare quanti ne hanno fatti dalla ricarica in poi e con che
   ticket medio. Una query sola con le email in OR invece di una per cliente. */
async function ordiniClienti(emails) {
  const out = [];
  if (!emails.length) return out;
  const filtro = emails.map((e) => `email:${e}`).join(' OR ');
  const q = `query($after:String){orders(first:50,after:$after,query:"(${filtro}) created_at:>=${YEAR}-01-01",sortKey:CREATED_AT){edges{node{name createdAt customer{email} currentSubtotalPriceSet{shopMoney{amount}} transactions{kind status}}}pageInfo{hasNextPage endCursor}}}`;
  let after = null, giri = 0;
  do {
    const d = await gql(q, after ? { after } : {});
    const o = d && d.orders; if (!o) break;
    (o.edges || []).forEach((e) => {
      const n = e.node; if (!n) return;
      const pagato = (n.transactions || []).some((t) => (t.kind === 'SALE' || t.kind === 'CAPTURE') && t.status === 'SUCCESS');
      if (!pagato) return;
      out.push({ email: mail(n.customer && n.customer.email), data: giorno(n.createdAt),
                 netto: round2(parseFloat((n.currentSubtotalPriceSet && n.currentSubtotalPriceSet.shopMoney && n.currentSubtotalPriceSet.shopMoney.amount) || 0) || 0),
                 rif: n.name || '' });
    });
    after = (o.pageInfo && o.pageInfo.hasNextPage) ? o.pageInfo.endCursor : null; giri++;
  } while (after && giri < 40);
  return out;
}

const mesiFra = (da, a) => Math.max(1, (new Date(a) - new Date(da)) / 2592e6);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1800');
  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (!CLIENT_ID || !USERNAME || !PRIVATE_KEY) { res.status(500).json({ error: 'Config Salesforce mancante su Vercel.' }); return; }
  if (!SHOP_DOMAIN || !SHOP_TOKEN) { res.status(503).json({ error: 'Shopify non configurato: il wallet si legge da li.' }); return; }
  try {
    const oggi = new Date().toISOString().slice(0, 10);

    // 1) ricariche da rete vendita: sono le opportunity che la dashboard conta come Partner
    const ctx = await sfToken();
    const vinti = await soql(ctx, `SELECT Amount, ContactEmail__c, ContactName__c, Data_Chiusa_Vinta__c FROM Opportunity WHERE RecordTypeId='${RF_RTID}' AND StageName='Chiuso - Vinto' AND Data_Chiusa_Vinta__c>=${YEAR}-01-01T00:00:00Z AND Amount>=1000`);
    const ricSf = [];
    vinti.forEach((r) => {
      const am = r.Amount == null ? 0 : +r.Amount;
      if (!(am > 0 && am % 1000 === 0)) return;   // stessa regola del Partner in /api/rf
      ricSf.push({ email: mail(r.ContactEmail__c), nome: r.ContactName__c || '', data: giorno(r.Data_Chiusa_Vinta__c), importo: round2(am), tipo: 'partner', rif: '' });
    });

    // 2) ricariche da e-commerce + 3) consumi
    const ricSh = await ricaricheEcommerce();
    const cons  = await consumi();

    // 4) anagrafica e ordini: servono tutte le email viste, anche di chi consuma senza ricarica
    const nomi = {};
    ricSf.forEach((r) => { if (r.email && r.nome) nomi[r.email] = r.nome; });
    const emails = [...new Set([...ricSf, ...ricSh, ...cons].map((r) => r.email).filter(Boolean))];
    const ordini = await ordiniClienti(emails);

    const clienti = {};
    const ens = (em) => {
      if (!clienti[em]) clienti[em] = { email: em, nome: nomi[em] || '', ricariche: [], consumato: 0, nConsumi: 0, ordini: 0, venduto: 0 };
      return clienti[em];
    };
    [...ricSf, ...ricSh].forEach((r) => { if (r.email) ens(r.email).ricariche.push(r); });
    cons.forEach((c) => { if (!c.email) return; const k = ens(c.email); k.consumato += c.importo; k.nConsumi++; });

    const righe = Object.keys(clienti).map((em) => {
      const c = clienti[em];
      c.ricariche.sort((a, b) => (a.data < b.data ? -1 : 1));
      const prima = c.ricariche.length ? c.ricariche[0].data : null;
      const ultima = c.ricariche.length ? c.ricariche[c.ricariche.length - 1].data : null;
      const importo = round2(c.ricariche.reduce((s, r) => s + r.importo, 0));
      // credito = importo + regalo, dove sappiamo quanto regala quel taglio
      let credito = 0, cashbackNoto = c.ricariche.length > 0;
      c.ricariche.forEach((r) => {
        const q = (r.tipo === 'partner') ? CASHBACK_PARTNER : (CASHBACK[r.importo] != null ? CASHBACK[r.importo] : null);
        if (q == null) cashbackNoto = false;
        credito += r.importo * (1 + (q || 0));
      });
      credito = round2(credito);
      // ordini e venduto dalla prima ricarica in poi; senza ricarica si guarda tutto l'anno
      const suoi = ordini.filter((o) => o.email === em && (!prima || o.data >= prima));
      const venduto = round2(suoi.reduce((s, o) => s + o.netto, 0));
      const consumato = round2(c.consumato);
      const mesi = mesiFra(prima || (YEAR + '-01-01'), oggi);
      const tipi = [...new Set(c.ricariche.map((r) => r.tipo))];
      return {
        email: em, nome: c.nome,
        tipo: tipi.length === 0 ? 'nessuna ricarica' : (tipi.length > 1 ? 'misto' : (tipi[0] === 'partner' ? 'partner (rete vendita)' : 'ricarica e-commerce')),
        prima, ultima, nRicariche: c.ricariche.length,
        importo, credito, cashbackNoto,
        ordini: suoi.length, venduto,
        consumato, nConsumi: c.nConsumi,
        residuo: c.ricariche.length ? round2(credito - consumato) : null,
        ticket: suoi.length ? round2(venduto / suoi.length) : null,
        frequenza: suoi.length ? Math.round((suoi.length / mesi) * 100) / 100 : null
      };
    }).sort((a, b) => (b.importo - a.importo) || (b.consumato - a.consumato));

    res.status(200).json({ anno: YEAR, oggi, prodotti: PRODOTTI_RICARICA, cashbackPartnerNoto: CASHBACK_PARTNER != null, righe });
  } catch (e) {
    res.status(502).json({ error: 'wallet non leggibile: ' + (e && e.message || e) });
  }
}
