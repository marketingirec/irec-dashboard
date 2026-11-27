// Codici sconto RF: utilizzo dei codici su rintracciofacile.it, per mese e per codice.
// Fonte: ShopifyQL (shopifyqlQuery sull'Admin GraphQL), NON la lista ordini. E' una scelta,
// non un caso: la lista ordini di quest'app vede solo gli ultimi 60 giorni (manca lo scope
// read_all_orders), mentre ShopifyQL legge tutto lo storico del negozio. Qui serve l'anno
// intero, quindi ShopifyQL e' l'unica fonte che va bene.
// Richiede lo scope di lettura dei report: se manca, l'endpoint risponde 200 con
// { error } e la dashboard tiene i valori cotti. Sola lettura.
const SHOP_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;
const SHOP_TOKEN  = process.env.SHOPIFY_ADMIN_TOKEN;
const API_V       = process.env.SHOPIFY_API_VERSION || '2026-07';

/* ---------- classificazione dei codici ----------
   I nomi dei venditori sono gli stessi di lib/shopify.js: un codice "nome + numero"
   (Massimo10, Lorenzop22, Elisap10) e' un codice venditore. Partner e automazioni sono
   insiemi chiusi e vanno elencati. Tutto il resto e' una campagna: e' il caso piu' comune,
   e un codice nuovo (BLACK22, BW22...) si classifica da se' senza toccare il codice.
   In ALTRI vanno i codici che non sono ne' campagne ne' niente: sconti generici una volta. */
const VENDITORI = ['massimo', 'massimiliano', 'lorenzo', 'elisa', 'federica', 'dorella', 'rosario', 'rosita', 'jacopo', 'raffaella'];
const PARTNER   = ['cosmos20', 'startup15'];
const AUTOMAZ   = ['carrello5', 'primo5', 'profilo10'];
const ALTRI     = ['sconto10'];
const TIPI = ['Venditori', 'Promo e campagne', 'Partner e convenzioni', 'Automazioni sito', 'Altri codici'];

function tipoDi(code) {
  const c = String(code || '').toLowerCase();
  const m = c.match(/^([a-z]+)/);
  if (m && VENDITORI.some((v) => m[1].indexOf(v) === 0)) return 'Venditori';
  if (PARTNER.indexOf(c) >= 0) return 'Partner e convenzioni';
  if (AUTOMAZ.indexOf(c) >= 0) return 'Automazioni sito';
  if (ALTRI.indexOf(c) >= 0) return 'Altri codici';
  return 'Promo e campagne';
}

/* ---------- cosa NON e' un codice sconto commerciale ----------
   - niente codice: l'ordine e' arrivato a prezzo pieno;
   - "Sconto Credito Wallet - <id>" e "Credito Wallet - <id>": il wallet e' credito prepagato
     applicato come sconto, ha la sua tab e contarlo qui raddoppierebbe lo stesso incasso;
   - BLOY...: codici usa-e-getta generati dall'app fedelta', uno per premio, non campagne;
   - RFCLUB-<n>: sconto dell'abbonamento RF Club, uno per cliente.
   Restano fuori anche i codici che in tutto l'anno non hanno prodotto un euro: sono le prove
   interne (DV101, DV105TEST, TOT100, T11, TESTJOBTITLE100) e gli ordini annullati. La regola
   e' sul totale dell'anno, non sul mese, cosi' un codice vero che in un mese fa zero non
   sparisce. Verificata il 27/11/2026: nessuno dei 40 codici veri sta a zero sull'anno. */
const escluso = (code) => {
  const c = String(code || '').trim();
  if (!c) return true;
  if (/credito wallet/i.test(c)) return true;
  if (/^BLOY/i.test(c)) return true;
  if (/^RFCLUB-/i.test(c)) return true;
  return false;
};

const r2 = (v) => Math.round((v + Number.EPSILON) * 100) / 100;
const num = (v) => { const x = parseFloat(v); return isFinite(x) ? x : 0; };

async function shopifyql(query) {
  const r = await fetch(`https://${SHOP_DOMAIN}/admin/api/${API_V}/graphql.json`, {
    method: 'POST',
    headers: { 'X-Shopify-Access-Token': SHOP_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: 'query($q:String!){shopifyqlQuery(query:$q){parseErrors tableData{rows}}}', variables: { q: query } })
  });
  const j = await r.json();
  if (!r.ok || j.errors) throw new Error('Shopify: ' + JSON.stringify(j.errors || j).slice(0, 240));
  const s = j.data && j.data.shopifyqlQuery;
  if (!s) throw new Error('Shopify: risposta senza shopifyqlQuery');
  if (s.parseErrors && s.parseErrors.length) throw new Error('ShopifyQL: ' + s.parseErrors.join('; '));
  return (s.tableData && s.tableData.rows) || [];
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!SHOP_DOMAIN || !SHOP_TOKEN) return res.status(200).json({ error: 'Shopify non configurato' });
  const Y = parseInt(req.query && req.query.year, 10) || new Date().getFullYear();
  const oggi = new Date().toISOString().slice(0, 10);
  const fine = (Y === new Date().getFullYear()) ? oggi : (Y + '-12-31');
  const periodo = `SINCE ${Y}-01-01 UNTIL ${fine}`;

  try {
    const [perCodice, perMese] = await Promise.all([
      shopifyql(`FROM sales SHOW net_sales, orders, discounts GROUP BY discount_code TIMESERIES month ${periodo}`),
      shopifyql(`FROM sales SHOW net_sales, orders TIMESERIES month ${periodo}`)
    ]);

    const mi = (r) => parseInt(String(r.month || '').slice(5, 7), 10) - 1;  // 0..11
    const vuoto = () => new Array(12).fill(null);
    const somma = (arr, i, v) => { arr[i] = (arr[i] || 0) + v; };

    // fatturato di TUTTI gli ordini del negozio: e' il denominatore dell'incidenza
    const tutti = vuoto(), ordTutti = vuoto();
    perMese.forEach((r) => { const i = mi(r); if (i >= 0 && i < 12) { somma(tutti, i, num(r.net_sales)); somma(ordTutti, i, num(r.orders)); } });

    const mesi = { n: vuoto(), net: vuoto(), sconto: vuoto(), tutti, ordTutti };
    const tipi = {}; TIPI.forEach((t) => { tipi[t] = vuoto(); });
    const cod = {};
    perCodice.forEach((r) => {
      const c = String(r.discount_code || '').trim(), i = mi(r);
      if (escluso(c) || i < 0 || i > 11) return;
      const net = num(r.net_sales), n = num(r.orders), sc = Math.abs(num(r.discounts));
      somma(mesi.n, i, n); somma(mesi.net, i, net); somma(mesi.sconto, i, sc);
      const t = tipoDi(c); somma(tipi[t], i, net);
      if (!cod[c]) cod[c] = { c, t, n: 0, net: 0, sc: 0, mesi: 0 };
      cod[c].n += n; cod[c].net += net; cod[c].sc += sc; cod[c].mesi++;
    });

    // i codici che in tutto l'anno non hanno fatto un euro sono prove o annullati: via,
    // e via anche il loro contributo ai mesi, che altrimenti gonfierebbe gli utilizzi
    const scartati = [];
    Object.keys(cod).forEach((c) => {
      if (r2(cod[c].net) > 0) return;
      scartati.push(c);
      delete cod[c];
    });
    if (scartati.length) {
      ['n', 'net', 'sconto'].forEach((k) => { mesi[k] = vuoto(); });
      TIPI.forEach((t) => { tipi[t] = vuoto(); });
      perCodice.forEach((r) => {
        const c = String(r.discount_code || '').trim(), i = mi(r);
        if (escluso(c) || scartati.indexOf(c) >= 0 || i < 0 || i > 11) return;
        somma(mesi.n, i, num(r.orders)); somma(mesi.net, i, num(r.net_sales)); somma(mesi.sconto, i, Math.abs(num(r.discounts)));
        somma(tipi[tipoDi(c)], i, num(r.net_sales));
      });
    }

    const arrotonda = (a) => a.map((v) => (v == null ? null : r2(v)));
    const codici = Object.keys(cod).map((c) => {
      const x = cod[c];
      return { c: x.c, t: x.t, n: x.n, net: r2(x.net), sc: r2(x.sc), mesi: x.mesi };
    }).sort((a, b) => b.net - a.net);

    res.status(200).json({
      anno: Y,
      al: oggi,
      fonte: 'ShopifyQL',
      mesi: { n: mesi.n, net: arrotonda(mesi.net), sconto: arrotonda(mesi.sconto), tutti: arrotonda(tutti), ordTutti },
      tipi: TIPI.map((t) => ({ t, net: arrotonda(tipi[t]) })),
      codici,
      scartati
    });
  } catch (e) {
    // niente 502: la tab deve poter dire "live non disponibile" e tenere i valori cotti
    res.status(200).json({ error: String((e && e.message) || e) });
  }
}
