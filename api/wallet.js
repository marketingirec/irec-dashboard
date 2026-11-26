// Vercel Serverless Function — /api/wallet
// Il wallet di Rintraccio Facile: chi ha comprato credito, quanto ne ha consumato e quanto gliene
// resta. Quattro fonti, tutte in sola lettura:
//   1. ricariche da e-commerce  -> Shopify, i prodotti "Ricarica Wallet" a listino
//   2. ricariche da rete vendita-> Salesforce, le opportunity che la dashboard mappa come Partner
//   3. consumi                  -> Shopify, ordini con lo sconto "Sconto Credito Wallet - <id>"
//   4. saldo                    -> Credits Yard, il metafield sul cliente Shopify
// Il numero dentro il codice sconto cambia a ogni utilizzo, quindi non lega il consumo alla
// ricarica: l'unica cosa che tiene insieme le fonti e' l'indirizzo del cliente.
//
// DUE AVVERTENZE CHE CAMBIANO LA LETTURA DELLA TABELLA.
//
// a) UNA RIGA E' UN'AZIENDA, NON UN INDIRIZZO. La stessa azienda compare con indirizzi diversi
//    nei tre sistemi: Power Tech compra il credito dalla rete vendita come affarilegali@ (un
//    indirizzo che in Shopify non esiste nemmeno) e lo spende come amministratore@, che e' dove
//    sta il saldo. Tenendoli separati si vedevano due mezze verita' - 7.000 € ricaricati senza
//    consumo da una parte, niente dall'altra - e il cliente risultava fermo da un anno mentre
//    stava ordinando. Si raggruppa percio' per dominio, che per un'azienda e' l'identita' vera.
//    Non per i domini di posta gratuita: li' lo stesso dominio non vuol dire lo stesso cliente,
//    e ogni indirizzo resta una riga a se'.
//
// b) IL CONSUMO SI VEDE SOLO PER GLI ULTIMI 60 GIORNI. Shopify consegna a un'app solo gli ordini
//    degli ultimi 60 giorni se non ha lo scope `read_all_orders`, e questa app non ce l'ha: al
//    26/11/2026 nel negozio c'erano 199 ordini pagati col credito wallet e l'API ne vedeva 45.
//    Non e' aggirabile: ShopifyQL legge tutto lo storico (per questo le ricariche tornano) ma lo
//    sconto wallet non ce l'ha - `discounts` torna 0 e `discount_code` vuoto. Finche' lo scope
//    non c'e', `consumato`, `ordini`, `venduto`, `ticket` e `frequenza` guardano quella finestra
//    e basta: la risposta porta `consumoDa` perche' la pagina lo possa dire invece di far credere
//    che siano i numeri di sempre. Lo scope si aggiunge dall'admin Shopify, nella configurazione
//    API Admin dell'app custom; il giorno che c'e', qui non cambia niente e i numeri si riempiono
//    da soli.
import crypto from 'crypto';

const LOGIN_URL   = process.env.SF_LOGIN_URL || 'https://login.salesforce.com';
const CLIENT_ID   = process.env.SF_CLIENT_ID;
const USERNAME    = process.env.SF_USERNAME;
const PRIVATE_KEY = (process.env.SF_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const API_V = 'v61.0';
const RF_RTID = '012Mf000000oReaIAE';

const SHOP_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOP_TOKEN  = process.env.SHOPIFY_ADMIN_TOKEN;
const SHOP_API_V  = process.env.SHOPIFY_API_VERSION || '2026-07';

/* Tutti i tagli di ricarica a catalogo. Prima ne era contato uno solo, perche' gli altri
   sembravano bozze per le prove interne: in effetti tutti i 23 ordini degli altri tagli sono
   del 26-30 gennaio 2026 e sono di due indirizzi di casa. Ma la riga giusta da tirare non e'
   il taglio, e' chi compra: i tagli restano tutti, cosi' il giorno che un cliente vero compra
   un Gold lo vediamo, e fuori vanno gli indirizzi interni (sotto). */
const PRODOTTI_RICARICA = [
  'Ricarica Wallet 100\u20ac (no crediti in regalo)',
  'Ricarica Wallet 250\u20ac (no crediti in regalo)',
  'Ricarica Wallet 500\u20ac + 100\u20ac in regalo',
  'Ricarica Wallet Gold 2000\u20ac + 610\u20ac in regalo',
  'Ricarica Wallet Platinum 5000\u20ac + 2.033\u20ac in regalo'
];
/* Le prove interne non sono clienti: tenerle dentro faceva comparire 3.500 € di ricariche e un
   paio di righe che nessuno chiamera' mai. */
const DOMINI_INTERNI = ['irec.it', 'rintracciofacile.it'];
const EMAIL_INTERNE  = ['testrintracciofacile@gmail.com', 'test@test.it'];
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
/* Partner/wallet contro offline: stessa regola di /api/rf.js, perche' il solo importo tondo
   lasciava fuori le ricariche wallet da 500 e i partner program da 1500. In piu' la grafia
   "importo+regalo" che la rete vendita usa a mano ("ANDREA 500+100"): sono le due cifre
   attaccate al piu', che in uno scontrino di servizi non capitano - li' il piu' separa sigle
   ("RCPP+RAL") o ha uno spazio intorno ("2 x ralc + 1 rcpec"). Senza questa riga l'unica
   ricarica scritta cosi' spariva, insieme al cliente. */
const ePartner = (nome, a) => a > 0 && (/partner|wallet|ricarica|\bppg\b/i.test(String(nome || '')) || /\d\+\d/.test(String(nome || '')) || a % 1000 === 0);
const IVA = 1.22;

const RX_WALLET = /sconto\s+credito\s+wallet/i;
const round2 = (v) => Math.round(v * 100) / 100;
const giorno = (iso) => String(iso || '').slice(0, 10);
const mail = (x) => String(x == null ? '' : x).trim().toLowerCase();
const dominio = (em) => (String(em || '').split('@')[1] || '').toLowerCase();

/* I domini di posta gratuita: due clienti con la stessa casella gratuita non c'entrano niente
   l'uno con l'altro, quindi li' non si raggruppa. Per i domini aziendali invece l'indirizzo e'
   un dettaglio e l'azienda e' il cliente. */
const FREEMAIL = new Set(['gmail.com', 'gmail.it', 'googlemail.com', 'libero.it', 'yahoo.it', 'yahoo.com', 'hotmail.it',
  'hotmail.com', 'outlook.it', 'outlook.com', 'live.it', 'live.com', 'msn.com', 'aol.com', 'icloud.com', 'me.com',
  'tiscali.it', 'virgilio.it', 'alice.it', 'tin.it', 'inwind.it', 'iol.it', 'email.it', 'katamail.com', 'fastwebnet.it',
  'teletu.it', 'poste.it', 'tim.it', 'vodafone.it', 'protonmail.com', 'proton.me', 'pec.it', 'legalmail.it', 'gmx.com',
  'web.de', 'mail.com', 'yandex.com', 'zoho.com', 'inbox.lv', 'carpecool.fr']);
const azienda = (em) => { const d = dominio(em); return (!d || FREEMAIL.has(d)) ? mail(em) : d; };
const interno = (em) => EMAIL_INTERNE.indexOf(mail(em)) >= 0 || DOMINI_INTERNI.indexOf(dominio(em)) >= 0;

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
   per titolo e restituisce ordine, email e giorno in una botta sola - e, a differenza degli
   ordini, legge tutto lo storico. */
async function ricaricheEcommerce() {
  const lista = PRODOTTI_RICARICA.map((t) => `'${t.replace(/'/g, "\\'")}'`).join(', ');
  const q = `FROM sales SHOW net_sales GROUP BY order_name, customer_email, day WHERE product_title IN (${lista}) SINCE ${DA_SEMPRE} UNTIL today ORDER BY day ASC LIMIT 1000`;
  const d = await gql(`query($q:String!){shopifyqlQuery(query:$q){parseErrors tableData{rows}}}`, { q });
  const res = d && d.shopifyqlQuery;
  if (!res) return [];
  if (res.parseErrors && res.parseErrors.length) throw new Error('ShopifyQL: ' + res.parseErrors.join('; '));
  /* Un rimborso e' una riga negativa su un giorno diverso, sullo stesso ordine. Scartare le
     righe negative una per una, come si faceva, teneva per buone ricariche che erano state
     restituite: due da 500 rimborsate dopo cinque giorni restavano 1.000 € di credito mai
     esistito, e il cliente restava in tabella. Si tira la somma per ordine e si guarda quella. */
  const per = {};
  ((res.tableData && res.tableData.rows) || []).forEach((r) => {
    const imp = Number(r.net_sales);
    if (!Number.isFinite(imp)) return;
    const rif = String(r.order_name || ''), g = giorno(r.day), em = mail(r.customer_email);
    const k = rif || (em + '|' + g);
    if (!per[k]) per[k] = { email: em, data: g, importo: 0, tipo: 'ecommerce', rif };
    per[k].importo += imp;
    if (g && g < per[k].data) per[k].data = g;   // vale il giorno dell'acquisto, non del rimborso
    if (!per[k].email && em) per[k].email = em;
  });
  return Object.keys(per).map((k) => per[k])
    .filter((x) => x.importo > 0 && x.email && !interno(x.email))
    .map((x) => ({ ...x, importo: round2(x.importo) }));
}
// Consumi: un ordine puo' portare piu' codici wallet, ma lo scalato e' uno solo ed e' lo sconto
// totale dell'ordine. Sommare le singole applicazioni lo conterebbe due volte.
// ATTENZIONE: qui si vedono solo gli ultimi 60 giorni, vedi l'avvertenza (b) in cima.
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
      const em = mail(n.customer && n.customer.email);
      if (!em || interno(em)) return;
      out.push({ email: em, nome: (n.customer && n.customer.displayName) || '',
                 data: giorno(n.createdAt), importo: round2(amt), valore: round2(netto + amt), rif: n.name || '' });
    });
    after = (o.pageInfo && o.pageInfo.hasNextPage) ? o.pageInfo.endCursor : null; giri++;
  } while (after && giri < 60);
  return out;
}
/* Credits Yard, il plugin che tiene il wallet dentro Shopify, scrive il saldo sul cliente come
   metafield. E' il numero vero, quindi il residuo si legge da li' invece di ricavarlo dalla
   differenza fra quanto ha caricato e quanto ha speso: quella differenza non sa niente dei
   movimenti fatti fuori dagli ordini (rettifiche, scadenze, crediti dati a mano) ne' del consumo
   piu' vecchio di 60 giorni, che non ci viene consegnato. */
const CY_NS = 'creditsyard', CY_SALDO = 'store_credit_balance', CY_AGG = 'store_credit_last_updated';
const CAMPI_CLIENTE = `email displayName saldo:metafield(namespace:"${CY_NS}",key:"${CY_SALDO}"){value} agg:metafield(namespace:"${CY_NS}",key:"${CY_AGG}"){value}`;
const pulisci = (s) => String(s || '').replace(/["\\]/g, '');

async function cercaClienti(filtro) {
  const out = [];
  let after = null, giri = 0;
  do {
    const d = await gql(`query($after:String){customers(first:100,after:$after,query:"${pulisci(filtro)}"){edges{node{${CAMPI_CLIENTE}}}pageInfo{hasNextPage endCursor}}}`, after ? { after } : {});
    const c = d && d.customers; if (!c) break;
    (c.edges || []).forEach((e) => {
      const n = e.node; if (!n) return;
      const em = mail(n.email); if (!em) return;
      const v = n.saldo && n.saldo.value != null ? parseFloat(n.saldo.value) : null;
      out.push({ email: em, nome: n.displayName || '', saldo: Number.isFinite(v) ? round2(v) : null, agg: (n.agg && n.agg.value) || null });
    });
    after = (c.pageInfo && c.pageInfo.hasNextPage) ? c.pageInfo.endCursor : null; giri++;
  } while (after && giri < 5);
  return out;
}
const aBlocchi = (v, n) => { const o = []; for (let i = 0; i < v.length; i += n) o.push(v.slice(i, i + n)); return o; };

/* Chi ha un wallet lo sappiamo da chi ha ricaricato e da chi ha speso. Ma non basta: il saldo
   sta sul cliente Shopify, che puo' avere un altro indirizzo (Power Tech), e certi crediti sono
   arrivati dalla migrazione da WooCommerce, senza nessuna ricarica da nessuna parte - Antares
   ha 692,40 € e non compariva. Si allarga percio' la ricerca in due modi che costano poche
   chiamate: tutti i clienti sui domini che gia' conosciamo, e quelli etichettati come partner o
   affiliate, che e' come il negozio marca chi lavora col credito. Resta fuori chi ha un saldo,
   non ha mai ricaricato, non ha speso negli ultimi 60 giorni e non ha nessuna di quelle due
   etichette: per quello servirebbe scorrere i diecimila clienti del negozio a ogni apertura. */
async function scopriClienti(emailNote) {
  const visti = {}, out = [];
  const aggiungi = (c) => { if (!visti[c.email]) { visti[c.email] = 1; out.push(c); } };
  const domini = [...new Set(emailNote.map(dominio).filter((d) => d && !FREEMAIL.has(d) && DOMINI_INTERNI.indexOf(d) < 0))];
  for (const blocco of aBlocchi(domini, 10)) {
    (await cercaClienti(blocco.map((d) => 'email:' + d).join(' OR '))).forEach(aggiungi);
  }
  for (const tag of ['partner', 'Affiliate']) {
    (await cercaClienti('tag:' + tag)).forEach((c) => { if (c.saldo != null && c.saldo > 0) aggiungi(c); });
  }
  for (const blocco of aBlocchi(emailNote.filter((e) => !visti[e]), 25)) {
    (await cercaClienti(blocco.map((e) => 'email:' + e).join(' OR '))).forEach(aggiungi);
  }
  return out.filter((c) => !interno(c.email));
}

const GIORNO_MS = 864e5;
const mesiFra = (da, a) => Math.max(0.5, (new Date(a) - new Date(da)) / (30 * GIORNO_MS));
const giorniFra = (da, a) => Math.round((new Date(a) - new Date(da)) / GIORNO_MS);
const piuMesi = (da, m) => { const d = new Date(da); d.setDate(d.getDate() + Math.round(m * 30)); return d.toISOString().slice(0, 10); };

/* Quando farsi vivi. Si stima dal ritmo con cui il cliente brucia il credito: quanto ha
   consumato diviso i mesi in cui quel consumo si e' potuto vedere. Il residuo diviso quel ritmo
   dice quanti mesi mancano alla fine, e conviene chiamarlo un mese prima che finisca.
   Chi ha credito e non risulta spendere non e' detto che sia fermo: potrebbe aver speso prima
   della finestra che ci viene consegnata. Per questo il motivo lo dice - "nessun consumo da..."
   e non "fermo da...": e' quello che sappiamo, non quello che immaginiamo. */
function quandoContattare(r, oggi, consumoDa) {
  const res = (r.residuo != null) ? r.residuo : r.residuoStimato;
  if (!r.nRicariche && res == null) return { quando: null, perche: 'nessuna ricarica registrata' };
  if (res != null && res <= 0) return { quando: oggi, perche: 'credito esaurito' };
  const inizio = (consumoDa && r.prima && r.prima < consumoDa) ? consumoDa : (r.prima || r.ultimoOrdine || oggi);
  const consumoMese = r.consumato > 0 ? r.consumato / mesiFra(inizio, oggi) : 0;
  if (consumoMese <= 0) {
    /* Non si vede consumo. Se la ricarica e' dentro la finestra che ci viene consegnata, allora
       e' vero che non l'ha ancora usata: un consumo lo avremmo visto. Se invece e' piu' vecchia
       - o non c'e' nessuna ricarica, perche' il credito arriva dalla migrazione - non sappiamo
       cosa abbia fatto prima, e dirgli "fermo da 357 giorni" sarebbe inventare: ha credito e da
       quando guardiamo non lo tocca, questo e' quello che possiamo dire, e vale una telefonata. */
    if (r.ultima && (!consumoDa || r.ultima >= consumoDa)) {
      return { quando: piuMesi(r.ultima, 2), perche: 'ricarica recente, non ancora usata' };
    }
    const da = consumoDa || r.ultima || oggi;
    return { quando: oggi, perche: 'ha credito e non risulta spendere dal ' + da.split('-').reverse().join('/')
      + (consumoDa && consumoDa > (r.ultima || '') ? ', prima non lo sappiamo' : '') };
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
    const vinti = await soql(ctx, `SELECT Name, Amount, ContactEmail__c, ContactName__c, Data_Chiusa_Vinta__c FROM Opportunity WHERE RecordTypeId='${RF_RTID}' AND StageName='Chiuso - Vinto' AND ContactEmail__c!=null AND Data_Chiusa_Vinta__c!=null AND (Amount>=1000 OR Name LIKE '%partner%' OR Name LIKE '%wallet%' OR Name LIKE '%ricarica%' OR Name LIKE '%ppg%' OR Name LIKE '%+%')`);
    const ricSf = [];
    vinti.forEach((r) => {
      const am = r.Amount == null ? 0 : +r.Amount;
      // La query non ha filtro d'anno e in Salesforce restano vecchie 'CREDITO WALLET
      // GRATUITO' da 0 e ricariche da 200/570 fuori listino: le tiene fuori il vincolo
      // su email e data di pagamento, che quei record hanno entrambe vuote. Il '%+%' serve
      // a far arrivare fin qui le ricariche scritte "500+100"; le somme di servizi che hanno
      // un piu' nel nome le scarta ePartner.
      if (!ePartner(r.Name, am)) return;
      const em = mail(r.ContactEmail__c);
      if (!em || interno(em)) return;
      ricSf.push({ email: em, nome: r.ContactName__c || '', data: giorno(r.Data_Chiusa_Vinta__c), importo: round2(am), tipo: 'partner' });
    });

    // 2) ricariche da e-commerce + 3) consumi
    const ricSh = await ricaricheEcommerce();
    const cons  = await consumi();
    // il giorno piu' vecchio in cui riusciamo a vedere un consumo: e' il bordo della finestra
    const consumoDa = cons.length ? cons.map((c) => c.data).sort()[0] : null;
    /* La finestra e' troncata se il consumo piu' vecchio che ci arriva e' di ieri l'altro: con
       lo scope al suo posto il primo ordine col credito e' del 16/02/2026 e questo diventa false
       da solo, senza che nessuno debba ricordarsi di togliere l'avviso dalla pagina. */
    const consumoTroncato = !!consumoDa && giorniFra(consumoDa, oggi) < 75;

    // 4) saldi e clienti che le prime tre fonti non avrebbero mai nominato
    const emailNote = [...new Set([...ricSf, ...ricSh, ...cons].map((r) => r.email).filter(Boolean))];
    let trovati = [];
    try { trovati = await scopriClienti(emailNote); } catch (_e) { trovati = []; }
    const saldi = {}, nomi = {};
    trovati.forEach((c) => { saldi[c.email] = c; if (c.nome) nomi[c.email] = c.nome; });
    [...ricSf, ...cons].forEach((r) => { if (r.email && r.nome && !nomi[r.email]) nomi[r.email] = r.nome; });

    /* Una riga per azienda. Gli indirizzi dell'azienda restano, elencati nella riga: servono a
       capire perche' il credito e' comprato da uno e speso da un altro. */
    const gruppi = {};
    const ens = (em) => {
      const k = azienda(em);
      if (!gruppi[k]) gruppi[k] = { chiave: k, email: [], ricariche: [], consumi: [] };
      if (gruppi[k].email.indexOf(em) < 0) gruppi[k].email.push(em);
      return gruppi[k];
    };
    [...ricSf, ...ricSh].forEach((r) => { if (r.email) ens(r.email).ricariche.push(r); });
    cons.forEach((c) => { if (c.email) ens(c.email).consumi.push(c); });
    // chi ha solo un saldo entra lo stesso: un wallet con dentro dei soldi e' un wallet
    trovati.forEach((c) => { if (c.saldo != null && (c.saldo > 0 || gruppi[azienda(c.email)])) ens(c.email); });

    const righe = Object.keys(gruppi).map((k) => {
      const c = gruppi[k];
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
      /* Il residuo e' la somma dei saldi degli indirizzi dell'azienda: il credito e' uno solo
         ma il plugin lo scrive sul cliente Shopify, e di clienti l'azienda puo' averne due. */
      const conSaldo = c.email.filter((e) => saldi[e] && saldi[e].saldo != null);
      const residuo = conSaldo.length ? round2(conSaldo.reduce((s, e) => s + saldi[e].saldo, 0)) : null;
      const agg = conSaldo.map((e) => saldi[e].agg).filter(Boolean).sort();
      const principale = conSaldo[0] || c.email[0];
      const r = {
        email: principale, altreEmail: c.email.filter((e) => e !== principale),
        nome: nomi[principale] || c.email.map((e) => nomi[e]).filter(Boolean)[0] || '',
        nRicariche: c.ricariche.length, prima, ricaricato: importo,
        ultima: ult ? ult.data : null,
        ultimaTipo: ult ? (ult.tipo === 'partner' ? 'rete vendita' : 'e-commerce') : null,
        ultimaImporto: ult ? ult.importo : null,
        credito: c.ricariche.length ? credito : null, cashbackNoto,
        consumato,
        // il residuo buono e' quello del plugin; la differenza fra caricato e speso resta a
        // fianco, perche' se i due numeri divergono vuol dire che sul wallet si e' mosso
        // qualcosa che gli ordini non raccontano - a partire dal consumo che non ci arriva
        residuo,
        residuoStimato: c.ricariche.length ? round2(credito - consumato) : null,
        saldoAggiornato: agg.length ? agg[agg.length - 1] : null,
        ordini: nOrd, venduto, ultimoOrdine,
        ticket: nOrd ? round2(venduto / nOrd) : null,
        frequenza: nOrd ? Math.round((nOrd / mesiFra(base, oggi)) * 100) / 100 : null
      };
      const q = quandoContattare(r, oggi, consumoDa);
      r.contattare = q.quando; r.perche = q.perche;
      return r;
    }).sort((a, b) => (b.ricaricato - a.ricaricato) || (b.consumato - a.consumato));

    res.status(200).json({ oggi, da: DA_SEMPRE, consumoDa, consumoTroncato, prodotti: PRODOTTI_RICARICA, listino: CREDITO_TAGLIO, iva: IVA, righe });
  } catch (e) {
    res.status(502).json({ error: 'wallet non leggibile: ' + (e && e.message || e) });
  }
}
