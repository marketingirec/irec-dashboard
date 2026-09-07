// Shopify RF (Rintraccio Facile) per Vercel: online per DATA DI PAGAMENTO
// (ordini via Admin GraphQL, transazione SALE/CAPTURE SUCCESS) + pending + gestito
// (codici sconto venditore) + dettaglio ordini. Sola lettura.
// Si attiva solo se SHOPIFY_STORE_DOMAIN + SHOPIFY_ADMIN_TOKEN sono configurati.
const SHOP_DOMAIN = process.env.SHOPIFY_STORE_DOMAIN;   // es. vm0w4v-ji.myshopify.com
const SHOP_TOKEN  = process.env.SHOPIFY_ADMIN_TOKEN;    // shpat_...
const API_V       = process.env.SHOPIFY_API_VERSION || '2026-07';

const monthOf = (iso) => parseInt(String(iso || '').slice(5, 7), 10); // 1..12
const round2  = (v) => Math.round(v * 100) / 100;
const RF_SELLERS = ['massimo', 'massimiliano', 'lorenzo', 'elisa', 'federica', 'dorella', 'rosario', 'rosita', 'jacopo', 'raffaella'];
const RF_OP_NAMES = { massimo: 'Massimo Zaccaria', massimiliano: 'Massimiliano Casoni', lorenzo: 'Lorenzo P', elisa: 'Elisa Passeri', federica: 'Federica Sbrega', dorella: 'Dorella Chiarella', rosario: 'Rosario Cipriano', rosita: 'Rosita Stagliano', jacopo: 'Jacopo Mazzilli', raffaella: 'Raffaella' };
const isWallet = (code) => /^sconto credito wallet/i.test(String(code || ''));
function sellerKey(code) {
  const m = String(code || '').toLowerCase().match(/^([a-z]+)/);
  if (!m) return null;
  let hit = null; RF_SELLERS.forEach((s) => { if (!hit && m[1].indexOf(s) === 0) hit = s; }); return hit;
}
async function gql(query, variables) {
  const r = await fetch(`https://${SHOP_DOMAIN}/admin/api/${API_V}/graphql.json`, {
    method: 'POST', headers: { 'X-Shopify-Access-Token': SHOP_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: variables || {} })
  });
  const j = await r.json();
  if (!r.ok || j.errors) throw new Error('Shopify GraphQL: ' + JSON.stringify(j.errors || j).slice(0, 200));
  return j.data;
}
export async function getShopifyRF(year) {
  if (!SHOP_DOMAIN || !SHOP_TOKEN) return null;
  const online = new Array(12).fill(0), pending = new Array(12).fill(0), gest = new Array(12).fill(0), ordOnline = new Array(12).fill(0);
  const opByMonth = {}; // { m: { key: {ord, amt} } }
  const orders = [];
  const q = `query($after:String){orders(first:50,after:$after,query:"created_at:>=${year}-01-01 created_at:<=${year}-12-31",sortKey:CREATED_AT){edges{node{name createdAt currentSubtotalPriceSet{shopMoney{amount}} customer{displayName email} discountCodes transactions{processedAt kind status}}}pageInfo{hasNextPage endCursor}}}`;
  let after = null, guard = 0;
  do {
    const d = await gql(q, after ? { after } : {});
    const o = d.orders; if (!o) break;
    (o.edges || []).forEach((e) => {
      const n = e.node; if (!n) return;
      const net = parseFloat((n.currentSubtotalPriceSet && n.currentSubtotalPriceSet.shopMoney && n.currentSubtotalPriceSet.shopMoney.amount) || 0) || 0;
      const codes = n.discountCodes || [], wallet = codes.some(isWallet);
      const cust = n.customer || {};
      let pay = null;
      (n.transactions || []).forEach((t) => { if ((t.kind === 'SALE' || t.kind === 'CAPTURE') && t.status === 'SUCCESS') { if (!pay || String(t.processedAt) > String(pay)) pay = t.processedAt; } });
      if (pay) {
        const m = monthOf(pay); if (m < 1 || m > 12) return; if (wallet || net <= 0) return;
        online[m - 1] += net; ordOnline[m - 1]++;
        orders.push({ m, n: n.name || '', nome: cust.displayName || '', email: cust.email || '', dpag: String(pay).slice(0, 10), net, st: 'Pagato', sr: 'Shopify' });
        let key = null; codes.forEach((c) => { const k = sellerKey(c); if (k) key = k; });
        if (key) { gest[m - 1] += net; if (!opByMonth[m]) opByMonth[m] = {}; if (!opByMonth[m][key]) opByMonth[m][key] = { ord: 0, amt: 0 }; opByMonth[m][key].ord++; opByMonth[m][key].amt += net; }
      } else {
        const m = monthOf(n.createdAt); if (m < 1 || m > 12) return; if (wallet || net <= 0) return;
        pending[m - 1] += net;
        orders.push({ m, n: n.name || '', nome: cust.displayName || '', email: cust.email || '', dpag: '', net, st: 'In attesa', sr: 'Shopify' });
      }
    });
    after = (o.pageInfo && o.pageInfo.hasNextPage) ? o.pageInfo.endCursor : null; guard++;
  } while (after && guard < 80);
  const operatori = {};
  Object.keys(opByMonth).forEach((m) => { operatori[m] = Object.keys(opByMonth[m]).map((k) => ({ op: RF_OP_NAMES[k] || k, ord: opByMonth[m][k].ord, amt: round2(opByMonth[m][k].amt) })); });
  return { online: online.map(round2), pending: pending.map(round2), gest: gest.map(round2), ordOnline, operatori, orders };
}
