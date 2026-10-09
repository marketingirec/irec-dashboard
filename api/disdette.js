// Vercel Serverless Function — /api/disdette
// Legge la scheda "Summary" del foglio Google delle disdette, pubblicata sul web in CSV, e la
// restituisce gia' interpretata. Passa da qui e non dal browser per due motivi: il CSV
// pubblicato di Google risponde con un redirect che il browser non puo' seguire fra domini, e
// cosi' il link pubblico resta in una variabile d'ambiente invece che scritto nel repo.
const CSV_URL = process.env.DISDETTE_CSV_URL || '';

const MESI = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
// le etichette come stanno nel foglio, ridotte a confronto: niente accenti, niente doppi spazi
const MOTIVI = ['% bassa recuperato','nessun recupero','nessun affido','cliente andato a recupero','problemi personali','non ha insoluti','saldo e stralcio'];

const norm = (s)=> String(s==null?'':s).replace(/[^\x00-\x7F]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
/* I conteggi sono interi piccoli. Si accetta sia "1.234" sia "1234"; una cella vuota o non
   numerica vale null, cosi' un mese non ancora arrivato non diventa zero. */
function num(x){
  const s = String(x==null?'':x).replace(/[.\s]/g,'').replace(',','.').replace(/[^\d.-]/g,'');
  if(s===''||s==='-')return null;
  const v = Number(s);
  return Number.isFinite(v) ? v : null;
}
// CSV con virgolette: basta un parser piccolo, le celle possono contenere virgole
function righeCsv(testo){
  const out=[]; let riga=[], cella='', q=false;
  for(let i=0;i<testo.length;i++){
    const c=testo[i];
    if(q){ if(c==='"'){ if(testo[i+1]==='"'){cella+='"';i++;} else q=false; } else cella+=c; }
    else if(c==='"')q=true;
    else if(c===','){ riga.push(cella); cella=''; }
    else if(c==='\n'){ riga.push(cella); out.push(riga); riga=[]; cella=''; }
    else if(c!=='\r')cella+=c;
  }
  riga.push(cella); if(riga.length>1||riga[0]!=='')out.push(riga);
  return out;
}
/* Il Summary tiene i due anni uno sotto l'altro, ciascuno aperto da "DISDETTE <anno>", con i
   mesi a sinistra e le motivazioni a destra. Si cerca per etichetta invece che per posizione:
   se domani aggiungono una colonna, continua a funzionare. */
function blocco(righe, da, a){
  const mesi = new Array(12).fill(null), mot = {};
  let totMot = null, senza = null, con = null;
  for(let r=da;r<a;r++){
    const riga = righe[r]||[];
    const i = MESI.indexOf(norm(riga[0]));
    if(i>=0) mesi[i] = num(riga[1]);
    for(let c=0;c<riga.length-1;c++){
      const et = norm(riga[c]).replace(/^>+\s*/,'').replace(/^di cui\s*/,'');
      const v  = num(riga[c+1]);
      if(v==null) continue;
      if(et==='tot disdette con motivazioni') totMot=v;
      else if(et==='senza motivazioni') senza=v;
      else if(et==='con motivazioni') con=v;
      else if(MOTIVI.indexOf(et)>=0) mot[et]=v;
    }
  }
  return { mesi, totMot, senza, con, mot };
}
export default async function handler(req, res){
  res.setHeader('Access-Control-Allow-Origin','*');
  res.setHeader('Cache-Control','s-maxage=600, stale-while-revalidate=3600');
  if(req.method==='OPTIONS'){ res.status(204).end(); return; }
  if(!CSV_URL){ res.status(503).json({ error:'DISDETTE_CSV_URL non impostata: pubblicare la scheda Summary in CSV e metterne il link nelle variabili di ambiente.' }); return; }
  try{
    const r = await fetch(CSV_URL, { redirect:'follow', headers:{ 'User-Agent':'irec-dashboard' } });
    if(!r.ok) throw new Error('HTTP '+r.status);
    const testo = await r.text();
    if(/^\s*</.test(testo)) throw new Error('il link non restituisce un CSV: controllare che la pubblicazione sia su "Summary" e in formato CSV');
    const righe = righeCsv(testo);
    const blocchi = [];
    righe.forEach((riga,i)=>{ const m = norm(riga[0]).match(/^disdette (\d{4})$/); if(m) blocchi.push({ anno:m[1], da:i }); });
    if(!blocchi.length) throw new Error('nel CSV non si trova nessuna riga "DISDETTE <anno>"');
    const dati = {};
    blocchi.forEach((b,k)=>{ dati[b.anno] = blocco(righe, b.da, k+1<blocchi.length ? blocchi[k+1].da : righe.length); });
    res.status(200).json({ letto: new Date().toISOString().slice(0,10), anni: dati });
  }catch(e){
    res.status(502).json({ error: 'foglio disdette non leggibile: '+(e && e.message || e) });
  }
}
