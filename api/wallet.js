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
/* Il wallet non sta dentro l'anno solare: un credito comprato a novembre si spende a marzo, e il
   residuo ha senso solo guardando tutta la vita del cliente. Niente filtro sull'anno, quindi:
   si parte da prima che il negozio aprisse e si arriva a oggi. */
const DA_SEMPRE = '2023-01-01';
/* Quanto credito da' ogni taglio, dal listino del wallet. Due avvertenze che cambiano i conti:
   la chiave e' l'imponibile (quello che leggiamo da Shopify e da Salesforce), mentre il credito
   e' IVA INCLUSA, perche' e' la cifra che il cliente puo' spendere nel carrello.
   Verificato sul saldo vero di Credits Yard: ricarica da 500 -> 732 di credito, 295 di sconti
   scalati sugli ordini (imponibile) fanno 359,90 lordi, e 732 meno 359,90 da' 372,10, cioe' il
   saldo al centesimo. Senza riportare a lordo il consumo verrebbero 437 e non tornerebbe. */
const CREDITO_TAGLIO = { 100: 122, 250: 305, 500: 732, 2000: 3050, 5000: 8133.33, 10000: 17428.57 };
const IVA = 1.22;

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
    const q = `FROM sales SHOW net_sales GROUP BY order_name, customer_email, day WHERE product_title = '${titolo.replace(/'/g, "\\'")}' SINCE ${DA_SEMPRE} UNTIL today ORDER BY day ASC LIMIT 1000`;
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
  const q = `query($after:String){orders(first:50,after:$after,query:"discount_code:'Sconto Credito Wallet*'",sortKey:CREATED_AT){edges{node{name createdAt customer{email displayName} discountCodes currentSubtotalPriceSet{shopMoney{amount}} totalDiscountsSet{shopMoney{amount}}}}pageInfo{hasNextPage endCursor}}}`;
  let after = null, giri = 0;
  do {
    const d = await gql(q, after ? { after } : {});
    const o = d && d.orders; if (!o) break;
    (o.edges || []).forEach((e) => {
      const n = e.node; if (!n) return;
      if (!(n.discountCodes || []).some((c) => RX_WALLET.test(c))) return;
      const amt = parseFloat((n.totalDiscountsSet && n.totalDiscountsSet.shopMoney && n.totalDiscountsSet.shopMoney.amount) || 0) || 0;
      if (amt <= 0) return;
      /* Il valore dell'ordine e' quello prima dello sconto: il netto incassato e' zero quando il
         credito copre tutto, e conterebbe come un ordine da zero euro. */
      const netto = parseFloat((n.currentSubtotalPriceSet && n.currentSubtotalPriceSet.shopMoney && n.currentSubtotalPriceSet.shopMoney.amount) || 0) || 0;
      out.push({ email: mail(n.customer && n.customer.email), nome: (n.customer && n.customer.displayName) || '',
                 data: giorno(n.createdAt), importo: round2(amt), valore: round2(netto + amt), rif: n.name || '' });
    });
    after = (o.pageInfo && o.pageInfo.hasNextPage) ? o.pageInfo.endCursor : null; giri++;
  } while (after && giri < 60);
  return out;
}
/* Credits Yard, il plugin che tiene il wallet dentro Shopify, scrive il saldo sul cliente come
   metafield. E' il numero vero, quindi il residuo si legge da li' invece di ricavarlo dalla
   differenza fra quanto ha caricato e quanto ha speso: quella differenza non sa niente dei
   movimenti fatti fuori dagli ordini (rettifiche, scadenze, crediti dati a mano). */
const CY_NS = 'creditsyard', CY_SALDO = 'store_credit_balance', CY_AGG = 'store_credit_last_updated';
async function saldiCreditsYard(emails) {
  const out = {};
  for (let i = 0; i < emails.length; i += 25) {
    const blocco = emails.slice(i, i + 25);
    const filtro = blocco.map((e) => `email:${e}`).join(' OR ');
    const d = await gql(`query{customers(first:50,query:"${filtro.replace(/"/g, '')}"){edges{node{email displayName saldo:metafield(namespace:"${CY_NS}",key:"${CY_SALDO}"){value} agg:metafield(namespace:"${CY_NS}",key:"${CY_AGG}"){value}}}}}`);
    ((d && d.customers && d.customers.edges) || []).forEach((e) => {
      const n = e.node; if (!n) return;
      const em = mail(n.email); if (!em) return;
      const v = n.saldo && n.saldo.value != null ? parseFloat(n.saldo.value) : null;
      out[em] = { saldo: Number.isFinite(v) ? round2(v) : null, agg: (n.agg && n.agg.value) || null, nome: n.displayName || '' };
    });
  }
  return out;
}

const GIORNO_MS = 864e5;
const mesiFra = (da, a) => Math.max(0.5, (new Date(a) - new Date(da)) / (30 * GIORNO_MS));
const giorniFra = (da, a) => Math.round((new Date(a) - new Date(da)) / GIORNO_MS);
const piuMesi = (da, m) => { const d = new Date(da); d.setDate(d.getDate() + Math.round(m * 30)); return d.toISOString().slice(0, 10); };

/* Quando farsi vivi. Si stima dal ritmo con cui il cliente brucia il credito: quanto ha
   consumato diviso i mesi da quando ha ricaricato la prima volta. Il residuo diviso quel ritmo
   dice quanti mesi mancano alla fine, e conviene chiamarlo un mese prima che finisca.
   Chi ha ricaricato e non ha mai speso non ha un ritmo da misurare: li' il segnale e' il
   silenzio, cioe' da quanti giorni non ordina. */
function quandoContattare(r, oggi) {
  // il saldo del plugin se c'e', altrimenti la stima da caricato meno speso
  const res = (r.residuo != null) ? r.residuo : r.residuoStimato;
  if (!r.nRicariche && res == null) return { quando: null, perche: 'nessuna ricarica registrata' };
  if (res != null && res <= 0) return { quando: oggi, perche: 'credito esaurito' };
  const consumoMese = r.consumato > 0 ? r.consumato / mesiFra(r.prima || r.ultimoOrdine || oggi, oggi) : 0;
  if (consumoMese <= 0) {
    const fermo = giorniFra(r.ultima || r.ultimoOrdine || oggi, oggi);
    return fermo >= 60
      ? { quando: oggi, perche: 'ha credito fermo da ' + fermo + ' giorni' }
      : { quando: piuMesi(r.ultima || oggi, 2), perche: 'ricarica recente, non ancora usata' };
  }
  const mesiResidui = res / consumoMese;
  return mesiResidui <= 1
    ? { quando: oggi, perche: 'al ritmo attuale il credito finisce entro un mese' }
    : { quando: piuMesi(oggi, mesiResidui - 1), perche: 'al ritmo attuale il credito dura ancora ' + (Math.round(mesiResidui * 10) / 10) + ' mesi' };
}

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
    const vinti = await soql(ctx, `SELECT Amount, ContactEmail__c, ContactName__c, Data_Chiusa_Vinta__c FROM Opportunity WHERE RecordTypeId='${RF_RTID}' AND StageName='Chiuso - Vinto' AND Amount>=1000`);
    const ricSf = [];
    vinti.forEach((r) => {
      const am = r.Amount == null ? 0 : +r.Amount;
      if (!(am > 0 && am % 1000 === 0)) return;   // stessa regola del Partner in /api/rf
      ricSf.push({ email: mail(r.ContactEmail__c), nome: r.ContactName__c || '', data: giorno(r.Data_Chiusa_Vinta__c), importo: round2(am), tipo: 'partner' });
    });

    // 2) ricariche da e-commerce + 3) consumi, entrambi da sempre
    const ricSh = await ricaricheEcommerce();
    const cons  = await consumi();

    const nomi = {};
    [...ricSf, ...cons].forEach((r) => { if (r.email && r.nome && !nomi[r.email]) nomi[r.email] = r.nome; });
    const tutteEmail = [...new Set([...ricSf, ...ricSh, ...cons].map((r) => r.email).filter(Boolean))];
    let saldi = {}; try { saldi = await saldiCreditsYard(tutteEmail); } catch (_e) { saldi = {}; }
    Object.keys(saldi).forEach((em) => { if (!nomi[em] && saldi[em].nome) nomi[em] = saldi[em].nome; });

    const clienti = {};
    const ens = (em) => {
      if (!clienti[em]) clienti[em] = { email: em, ricariche: [], consumi: [] };
      return clienti[em];
    };
    [...ricSf, ...ricSh].forEach((r) => { if (r.email) ens(r.email).ricariche.push(r); });
    cons.forEach((c) => { if (c.email) ens(c.email).consumi.push(c); });

    const righe = Object.keys(clienti).map((em) => {
      const c = clienti[em];
      c.ricariche.sort((a, b) => (a.data < b.data ? -1 : 1));
      c.consumi.sort((a, b) => (a.data < b.data ? -1 : 1));
      const prima = c.ricariche.length ? c.ricariche[0].data : null;
      const ult = c.ricariche.length ? c.ricariche[c.ricariche.length - 1] : null;
      const importo = round2(c.ricariche.reduce((s, r) => s + r.importo, 0));
      // credito = importo piu' il regalo, dove sappiamo quanto regala quel taglio
      let credito = 0, cashbackNoto = c.ricariche.length > 0;
      c.ricariche.forEach((r) => {
        const dato = CREDITO_TAGLIO[r.importo];
        // taglio fuori listino: si mette il solo imponibile e la riga lo dichiara, invece di
        // inventare un regalo che gonfierebbe il residuo
        if (dato == null) { cashbackNoto = false; credito += r.importo; }
        else credito += dato;
      });
      credito = round2(credito);
      // gli ordini che contano sono quelli pagati col credito, non tutti quelli del cliente
      // lo sconto wallet sugli ordini e' imponibile, il credito e' lordo: per confrontarli
      // vanno messi nella stessa valuta, e quella del wallet e' il lordo
      const consumato = round2(c.consumi.reduce((s, x) => s + x.importo, 0) * IVA);
      const venduto   = round2(c.consumi.reduce((s, x) => s + (x.valore || 0), 0));
      const nOrd = c.consumi.length;
      const ultimoOrdine = nOrd ? c.consumi[nOrd - 1].data : null;
      const base = prima || ultimoOrdine || oggi;
      const r = {
        email: em, nome: nomi[em] || '',
        nRicariche: c.ricariche.length, prima, ricaricato: importo,
        ultima: ult ? ult.data : null,
        ultimaTipo: ult ? (ult.tipo === 'partner' ? 'rete vendita' : 'e-commerce') : null,
        ultimaImporto: ult ? ult.importo : null,
        credito: c.ricariche.length ? credito : null, cashbackNoto,
        consumato,
        // il residuo buono e' quello del plugin; la differenza fra caricato e speso resta a
        // fianco, perche' se i due numeri divergono vuol dire che sul wallet si e' mosso
        // qualcosa che gli ordini non raccontano
        residuo: (saldi[em] && saldi[em].saldo != null) ? saldi[em].saldo : null,
        residuoStimato: c.ricariche.length ? round2(credito - consumato) : null,
        saldoAggiornato: (saldi[em] && saldi[em].agg) || null,
        ordini: nOrd, venduto, ultimoOrdine,
        ticket: nOrd ? round2(venduto / nOrd) : null,
        frequenza: nOrd ? Math.round((nOrd / mesiFra(base, oggi)) * 100) / 100 : null
      };
      const q = quandoContattare(r, oggi);
      r.contattare = q.quando; r.perche = q.perche;
      return r;
    }).sort((a, b) => (b.ricaricato - a.ricaricato) || (b.consumato - a.consumato));

    res.status(200).json({ oggi, da: DA_SEMPRE, prodotti: PRODOTTI_RICARICA, listino: CREDITO_TAGLIO, iva: IVA, righe });
  } catch (e) {
    res.status(502).json({ error: 'wallet non leggibile: ' + (e && e.message || e) });
  }
}
