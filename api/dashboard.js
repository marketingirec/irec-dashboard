// Vercel Serverless Function — /api/dashboard
// Autentica a Salesforce (JWT Bearer, server-to-server), esegue le query SOQL
// e restituisce il JSON che alimenta la dashboard IREC. Nessuna credenziale
// nel client: tutto server-side, con le env var impostate su Vercel.
import crypto from 'crypto';
import { getAdSpend } from '../lib/adspend.js';

const LOGIN_URL  = process.env.SF_LOGIN_URL || 'https://login.salesforce.com';
const CLIENT_ID  = process.env.SF_CLIENT_ID;
const USERNAME   = process.env.SF_USERNAME;
const PRIVATE_KEY = (process.env.SF_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const YEAR = Number(process.env.SF_YEAR || 2026);
const API_V = 'v60.0';

/* ---------- WHERE clauses (identiche alla dashboard) ---------- */
const LB = "RecordType.DeveloperName='IREC' AND utm_source__c!=null AND CALENDAR_YEAR(Data_Compilazione_Questionario__c)=" + YEAR;
const OB = "RecordType.DeveloperName='IREC' AND CALENDAR_YEAR(CloseDate)=" + YEAR;
const NP = "'NON IN TARGET PER MANCANZA DOCUMENTAZIONE','NON IN TARGET PER TRADING ONLINE','NON IN TARGET - VITTIMA DI TRUFFA','NON IN TARGET CERCA CESSIONE DEL CREDITO','NON IN TARGET CERCA ASSICURAZIONE DEL CREDITO','NON IN TARGET CERCA RECUPERO CREDITI FISCALI','NON HA CREDITI DA RECUPERARE/ VUOLE SOLO INFO','HA GIÀ RISOLTO / LO HANNO PAGATO','NON GENERA INSOLUTI'";
const NT = "'VUOLE COLLABORARE CON NOI','NON IN TARGET PER MANCANZA DOCUMENTAZIONE','NON IN TARGET PER AZIONE LEGALE IN CORSO','NON IN TARGET PER TRADING ONLINE','NON IN TARGET - VITTIMA DI TRUFFA','NON IN TARGET CERCA CESSIONE DEL CREDITO','NON IN TARGET CERCA ASSICURAZIONE DEL CREDITO','NON IN TARGET CERCA RECUPERO CREDITI FISCALI','NON IN TARGET PER FALLIMENTO/LIQUIDAZIONE/CONCORDATO','NON IN TARGET CERCA FINANZIAMENTO PERSONALE','NON IN TARGET CERCA FINANZIAMENTO AZIENDA','NON HA CREDITI DA RECUPERARE/ VUOLE SOLO INFO','NON GENERA INSOLUTI','HA GIÀ RISOLTO / LO HANNO PAGATO'";
const CM = "CALENDAR_MONTH(Data_Compilazione_Questionario__c)";
const CMC = "CALENDAR_MONTH(CloseDate)";
const DD = "DAY_ONLY(Data_Compilazione_Questionario__c)";

// 8 voci del funnel: oggetto, where, extra, won(=count+sum)
const VW = [
  { o:'Lead', w:LB, extra:'' },
  { o:'Lead', w:LB, extra:" AND (Scartato_Substage__c NOT IN ("+NP+") OR Scartato_Substage__c=null) AND (Scartato_Substage_Answered__c!='NON IN TARGET - MARKETING' OR Scartato_Substage_Answered__c=null)" },
  { o:'Lead', w:LB, extra:" AND Data_Compilazione_Questionario__c!=null AND (Scartato_Substage_Answered__c!='NON IN TARGET - MARKETING' OR Scartato_Substage_Answered__c=null) AND (Scartato_Substage__c NOT IN ("+NT+") OR Scartato_Substage__c=null)" },
  { o:'Lead', w:LB, extra:" AND Data_Compilazione_Questionario__c!=null AND (Scartato_Substage_Answered__c!='NON IN TARGET - MARKETING' OR Scartato_Substage_Answered__c=null) AND (Scartato_Substage_Answered__c NOT IN ('DATI NON CORRETTI','NON HA MAI RISPOSTO') OR Scartato_Substage_Answered__c=null) AND (Scartato_Substage__c NOT IN ("+NT+") OR Scartato_Substage__c=null)" },
  { o:'Opp', w:OB, extra:" AND (LeadSource!='Reopen' OR LeadSource=null)" },                          // MQL senza Reopen
  { o:'Opp', w:OB, extra:" AND (Amount>0 OR (StageName='Chiuso - Perso' AND Amount=null))" },
  { o:'Opp', w:OB, extra:" AND Amount>0" },
  { o:'Opp', w:OB, extra:" AND StageName IN ('Chiuso - Vinto','Chiuso - Pending')", won:true }
];
const monthGrp = (i)=>{ const g = VW[i].o==='Lead'?CM:CMC; const sel = VW[i].won?'COUNT(Id) c,SUM(Amount) a':'COUNT(Id) t'; const from = VW[i].o==='Lead'?'Lead':'Opportunity'; return `SELECT ${g} m,${sel} FROM ${from} WHERE ${VW[i].w}${VW[i].extra} GROUP BY ${g}`; };
const srcGrp   = (i,m)=>{ const dcol = VW[i].o==='Lead'?'Data_Compilazione_Questionario__c':'CloseDate'; const sel = VW[i].won?'COUNT(Id) c,SUM(Amount) a':'COUNT(Id) t'; const from = VW[i].o==='Lead'?'Lead':'Opportunity'; return `SELECT LeadSource s,${sel} FROM ${from} WHERE ${VW[i].w}${VW[i].extra} AND CALENDAR_MONTH(${dcol})=${m} GROUP BY LeadSource`; };
const QD_TOT = `SELECT ${DD} d,COUNT(Id) t FROM Lead WHERE ${LB} GROUP BY ${DD} ORDER BY ${DD}`;
const QD_MQL = `SELECT CloseDate d,COUNT(Id) t FROM Opportunity WHERE ${OB} AND (LeadSource!='Reopen' OR LeadSource=null) GROUP BY CloseDate ORDER BY CloseDate`;
const QD_WON = `SELECT CloseDate d,COUNT(Id) c,SUM(Amount) a FROM Opportunity WHERE ${OB} AND StageName IN ('Chiuso - Vinto','Chiuso - Pending') GROUP BY CloseDate ORDER BY CloseDate`;

/* ---------- auth + query helpers ---------- */
const b64url = (b)=>Buffer.from(b).toString('base64').replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function getToken(){
  const head = b64url(JSON.stringify({ alg:'RS256', typ:'JWT' }));
  const pay  = b64url(JSON.stringify({ iss:CLIENT_ID, sub:USERNAME, aud:LOGIN_URL, exp:Math.floor(Date.now()/1000)+300 }));
  const input = head+'.'+pay;
  const s = crypto.createSign('RSA-SHA256'); s.update(input); s.end();
  const jwt = input+'.'+b64url(s.sign(PRIVATE_KEY));
  const r = await fetch(LOGIN_URL+'/services/oauth2/token', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({ grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion:jwt }) });
  const j = await r.json();
  if(!r.ok) throw new Error('Auth Salesforce fallita: '+(j.error_description||j.error||r.status));
  return { token:j.access_token, instance:j.instance_url };
}
async function soql(ctx, q){
  let url = ctx.instance+`/services/data/${API_V}/query?q=`+encodeURIComponent(q);
  let out = [];
  while(url){
    const r = await fetch(url, { headers:{ Authorization:'Bearer '+ctx.token } });
    const j = await r.json();
    if(!r.ok) throw new Error('SOQL: '+(Array.isArray(j)?j.map(e=>e.message).join('; '):JSON.stringify(j)));
    out = out.concat(j.records||[]);
    url = j.nextRecordsUrl ? ctx.instance+j.nextRecordsUrl : null;
  }
  return out;
}

/* ---------- builders ---------- */
const iso = (d)=>d.toISOString().slice(0,10);
function dayList(day0, n){ const a=[]; const base=new Date(day0+'T00:00:00Z'); for(let i=0;i<n;i++){ const d=new Date(base); d.setUTCDate(d.getUTCDate()+i); a.push(iso(d)); } return a; }
function buildMonthly(recs, key, curM){ const pr={}; recs.forEach(r=>{ pr[+r.m]= r[key]==null?0:+r[key]; }); const a=new Array(12).fill(null); for(let m=1;m<=12;m++){ a[m-1]= pr[m]!=null?pr[m]:(m<=curM?0:null); } return a; }
function buildDaily(recs, key, days){ const mp={}; recs.forEach(r=>{ mp[(r.d||'').slice(0,10)]= r[key]==null?0:+r[key]; }); return days.map(d=>mp[d]||0); }
function buildSrc(recsByVoce){ const map={}; const ens=(s)=>{ if(!map[s]) map[s]=[0,0,0,0,0,0,0,0,0]; return map[s]; }; for(let i=0;i<8;i++){ (recsByVoce[i]||[]).forEach(r=>{ const row=ens((r.s==null||r.s==='')?'sorgente non trovata':r.s); row[i]= r[VW[i].won?'c':'t']==null?0:+r[VW[i].won?'c':'t']; if(VW[i].won) row[8]= r.a==null?0:+r.a; }); } return Object.keys(map).map(s=>({ src:s, v:map[s] })); }

// Operatori Sales (funnel MQL..Chiuso-Vinto per Owner.Name) e TMK (pool Contattabili per Owner.Name x Status) —
// stessa logica client di index.html (opGrp/buildOpRows, tmkGrpAll/buildTmkRows), per la vista senza MCP (?view=operators / ?view=tmk).
const OP_VW = [4,5,6,7];
const opGrp = (vi,m)=>{ const won=(vi===7); const sel = won?'COUNT(Id) c,SUM(Amount) a':'COUNT(Id) t'; return `SELECT Owner.Name o,${sel} FROM Opportunity WHERE ${VW[vi].w}${VW[vi].extra} AND CALENDAR_MONTH(CloseDate)=${m} GROUP BY Owner.Name`; };
function buildOpRows(recsByCol){ const map={}; const ens=(o)=>{ if(!map[o]) map[o]=[0,0,0,0,0]; return map[o]; }; OP_VW.forEach((vi,col)=>{ const won=(vi===7); (recsByCol[col]||[]).forEach(r=>{ const row=ens((r.o==null||r.o==='')?'operatore non trovato':r.o); row[col]= r[won?'c':'t']==null?0:+r[won?'c':'t']; if(won) row[4]= r.a==null?0:+r.a; }); }); return Object.keys(map).map(o=>({ op:o, v:map[o] })); }
const tmkGrpAll = (m)=>`SELECT Owner.Name o, Status s, COUNT(Id) t FROM Lead WHERE ${VW[3].w}${VW[3].extra} AND CALENDAR_MONTH(Data_Compilazione_Questionario__c)=${m} GROUP BY Owner.Name, Status`;
function buildTmkRows(recs){ const map={}; const ens=(o)=>{ if(!map[o]) map[o]=[0,0,0,0]; return map[o]; }; (recs||[]).forEach(r=>{ const op=(r.o==null||r.o==='')?'operatore non trovato':r.o; const row=ens(op), t=(r.t==null?0:+r.t), s=r.s; row[0]+=t; if(s==='Nuovo') row[1]+=t; else if(s==='Attivo - Working') row[2]+=t; else if(s==='Convertito') row[3]+=t; }); return Object.keys(map).map(o=>({ op:o, v:map[o] })); }

export default async function handler(req, res){
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  if(req.method === 'OPTIONS'){ res.status(204).end(); return; }
  if(!CLIENT_ID || !USERNAME || !PRIVATE_KEY){ res.status(500).json({ error:'Config mancante: impostare SF_CLIENT_ID, SF_USERNAME, SF_PRIVATE_KEY su Vercel.' }); return; }
  try{
    const ctx = await getToken();
    const now = new Date();
    const curM = now.getUTCFullYear()===YEAR ? now.getUTCMonth()+1 : (now.getUTCFullYear()>YEAR?12:0);
    const day0 = YEAR+'-01-01';
    const today = iso(now);
    const n = Math.max(1, Math.round((new Date(today)-new Date(day0))/86400000)+1);
    const days = dayList(day0, n);

    // vista "sources" per un mese specifico (?view=sources&month=6)
    if((req.query.view||'')==='sources'){
      const m = Math.max(1, Math.min(12, Number(req.query.month)||curM));
      const recsByVoce = [];
      for(let i=0;i<8;i++){ recsByVoce[i] = await soql(ctx, srcGrp(i,m)); }
      res.status(200).json({ month:m, year:YEAR, rows:buildSrc(recsByVoce) });
      return;
    }

    // vista "operators" per un mese specifico (?view=operators&month=6): funnel MQL..Chiuso-Vinto per Owner.Name
    if((req.query.view||'')==='operators'){
      const m = Math.max(1, Math.min(12, Number(req.query.month)||curM));
      const recsByCol=[];
      for(let c=0;c<OP_VW.length;c++){ recsByCol[c]=await soql(ctx, opGrp(OP_VW[c],m)); }
      res.status(200).json({ month:m, year:YEAR, rows:buildOpRows(recsByCol) });
      return;
    }

    // vista "tmk" per un mese specifico (?view=tmk&month=6): pool Contattabili per Owner.Name x Status
    if((req.query.view||'')==='tmk'){
      const m = Math.max(1, Math.min(12, Number(req.query.month)||curM));
      const recs = await soql(ctx, tmkGrpAll(m));
      res.status(200).json({ month:m, year:YEAR, rows:buildTmkRows(recs) });
      return;
    }

    // dataset completo
    const real=[]; let contratti=null, fatturato=null;
    for(let i=0;i<8;i++){ const recs=await soql(ctx, monthGrp(i));
      if(VW[i].won){ contratti=buildMonthly(recs,'c',curM); fatturato=buildMonthly(recs,'a',curM); real[i]=contratti; }
      else real[i]=buildMonthly(recs,'t',curM); }
    const dtot=buildDaily(await soql(ctx,QD_TOT),'t',days);
    const dmql=buildDaily(await soql(ctx,QD_MQL),'t',days);
    const dwrec=await soql(ctx,QD_WON); const dwon=buildDaily(dwrec,'c',days), dfat=buildDaily(dwrec,'a',days);
    const recsByVoce=[]; for(let i=0;i<8;i++){ recsByVoce[i]=await soql(ctx, srcGrp(i,curM)); }

    // reopen (voci Opportunity con LeadSource='Reopen'; Lead reopen = 0)
    const rExtra=[" AND LeadSource='Reopen'"," AND LeadSource='Reopen' AND (Amount>0 OR (StageName='Chiuso - Perso' AND Amount=null))"," AND LeadSource='Reopen' AND Amount>0"," AND LeadSource='Reopen' AND StageName IN ('Chiuso - Vinto','Chiuso - Pending')"];
    const reopen=[buildMonthly([],'t',curM),buildMonthly([],'t',curM),buildMonthly([],'t',curM),buildMonthly([],'t',curM)];
    for(let j=0;j<4;j++){ const rr=await soql(ctx, `SELECT ${CMC} m,COUNT(Id) t FROM Opportunity WHERE ${OB}${rExtra[j]} GROUP BY ${CMC}`); reopen.push(buildMonthly(rr,'t',curM)); }

    // "di cui" Contattabili (Nuovi, Attivo-Working) - Contattati = Contattabili - Nuovi - AW (calcolato client)
    const cNuo = buildMonthly(await soql(ctx, `SELECT ${CM} m,COUNT(Id) t FROM Lead WHERE ${VW[3].w}${VW[3].extra} AND Status='Nuovo' GROUP BY ${CM}`), 't', curM);
    const cAw  = buildMonthly(await soql(ctx, `SELECT ${CM} m,COUNT(Id) t FROM Lead WHERE ${VW[3].w}${VW[3].extra} AND Status='Attivo - Working' GROUP BY ${CM}`), 't', curM);
    // Irraggiungibili (In target criteri con risposta DATI NON CORRETTI / NON HA MAI RISPOSTO)
    const irD = buildMonthly(await soql(ctx, `SELECT ${CM} m,COUNT(Id) t FROM Lead WHERE ${VW[2].w}${VW[2].extra} AND Scartato_Substage_Answered__c='DATI NON CORRETTI' GROUP BY ${CM}`), 't', curM);
    const irN = buildMonthly(await soql(ctx, `SELECT ${CM} m,COUNT(Id) t FROM Lead WHERE ${VW[2].w}${VW[2].extra} AND Scartato_Substage_Answered__c='NON HA MAI RISPOSTO' GROUP BY ${CM}`), 't', curM);

    // spesa ADV (Google Ads + Meta) — non blocca se non configurata o in errore
    let adspend = null;
    try { adspend = await getAdSpend(YEAR); } catch(_e) { adspend = null; }

    res.status(200).json({
      snapshot: today, curMonth: curM, year: YEAR, day0, dayN: n,
      real, fatturato, contratti, reopen,
      daily: { tot:dtot, mql:dmql, won:dwon, fat:dfat },
      sources: { month: curM, rows: buildSrc(recsByVoce) },
      contatt: { nuovi: cNuo, aw: cAw, irD, irN },
      adspend
    });
  }catch(e){
    res.status(502).json({ error: String(e && e.message || e) });
  }
}
