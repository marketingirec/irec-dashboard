# IREC — Dashboard Budget vs Real · procedura di refresh

Questo repo contiene la dashboard (`index.html`). Un agente Claude Code schedulato
la aggiorna **due volte al giorno (08:00 e 16:00 ora italiana)** ri-estraendo i dati
**Real** da Salesforce e ripubblicando l'Artifact.

- **Artifact URL (ripubblicare qui, stesso link):** https://claude.ai/code/artifact/adfeffab-4d37-4620-b787-b4882fc66344
- **Org Salesforce:** `marketing@irec.it` — RecordType `IREC`, sola lettura.
- **Anno corrente:** 2026 (aggiornare la costante `YEAR` sotto a inizio anno).

## Cosa si aggiorna da Salesforce (Real) e cosa NO

Si rigenerano SOLO le variabili "Real" dentro `index.html`:
`REAL.general[*].data` (8 array mensili), `FATTURATO`, `CONTRATTI`,
`DTOT`, `DMQL`, `DWON`, `DFAT` (giornalieri), `SNAPSHOT`, `CUR_MONTH`.

NON toccare (sono dal forecast, statici): `FORECAST_GEN`, `SPESA_BUD`,
`VENDUTO_BUD`, `PCT_BUD`.

## Procedura per l'agente

1. Determina `YEAR=2026`, il mese corrente `CUR_MONTH` (1-12) e la data odierna `TODAY` (YYYY-MM-DD).
2. Esegui via connettore Salesforce le query qui sotto (tutte con `RecordType.DeveloperName='IREC'`).
3. Costruisci gli array mensili (indice 0 = gennaio … 11 = dicembre; `null` per i mesi futuri, `0` se il mese è iniziato ma senza record).
4. Costruisci gli array giornalieri consecutivi da `DAY0="YEAR-01-01"` fino a `TODAY` (lunghezza `DAYN`); 0 per i giorni senza record. **Verifica**: la somma per mese degli array giornalieri deve combaciare con gli array mensili (rete di sicurezza).
5. Sostituisci in `index.html` i blocchi dati (le assegnazioni `var ...`/`REAL = {...}`) e le costanti `SNAPSHOT="TODAY"`, `CUR_MONTH`, `DAY0`, `DAYN`.
6. Ripubblica l'Artifact all'URL sopra (strumento Artifact, parametro `url`).

## Query SOQL

> I lead si contano tutti, anche quelli senza `utm_source`. Il filtro `utm_source__c!=null`
> c'era fino a Novembre 2026 e teneva fuori chi non arriva da un link tracciato: invisibile
> sui canali paid, dove l'utm c'e' sempre, ma sul NO PAID cancellava quasi tutti i lead
> lasciando intatti gli MQL, tanto che la % MQL usciva sopra il 100%.

> **Incassi Intelligenti e' fuori da IREC.** Dal 18 Novembre 2026 la base IREC (`LB` e `OB`)
> porta in coda un'esclusione: chi ha la dicitura "incassi intelligenti" in `LeadSource` o in
> uno degli utm non entra nel funnel IREC, perche' ha una sezione sua (`?view=incassi`).
> L'esclusione e' scritta campo per campo, non come `NOT` sull'intera parentesi: in SOQL un
> `NOT ... LIKE` **non restituisce i record che hanno quel campo vuoto**, e un `NOT` globale
> farebbe sparire tutti i lead a cui manca anche un solo utm. Le query qui sotto mostrano la
> base **senza** questa coda, per leggibilita': aggiungila come la scrive `api/dashboard.js`.

### Mensili — voci funnel (GROUP BY CALENDAR_MONTH)

```sql
-- REAL.general[0] Totali entrati
SELECT CALENDAR_MONTH(Data_Compilazione_Questionario__c) m, COUNT(Id) t
FROM Lead WHERE RecordType.DeveloperName='IREC'
AND CALENDAR_YEAR(Data_Compilazione_Questionario__c)=YEAR
GROUP BY CALENDAR_MONTH(Data_Compilazione_Questionario__c);

-- REAL.general[1] In target da Policy
SELECT CALENDAR_MONTH(Data_Compilazione_Questionario__c) m, COUNT(Id) t
FROM Lead WHERE RecordType.DeveloperName='IREC'
AND CALENDAR_YEAR(Data_Compilazione_Questionario__c)=YEAR
AND (Scartato_Substage__c NOT IN ('NON IN TARGET PER MANCANZA DOCUMENTAZIONE','NON IN TARGET PER TRADING ONLINE','NON IN TARGET - VITTIMA DI TRUFFA','NON IN TARGET CERCA CESSIONE DEL CREDITO','NON IN TARGET CERCA ASSICURAZIONE DEL CREDITO','NON IN TARGET CERCA RECUPERO CREDITI FISCALI','NON HA CREDITI DA RECUPERARE/ VUOLE SOLO INFO','HA GIÀ RISOLTO / LO HANNO PAGATO','NON GENERA INSOLUTI') OR Scartato_Substage__c=null)
AND (Scartato_Substage_Answered__c!='NON IN TARGET - MARKETING' OR Scartato_Substage_Answered__c=null)
GROUP BY CALENDAR_MONTH(Data_Compilazione_Questionario__c);

-- REAL.general[2] In target criteri sec. TMK
SELECT CALENDAR_MONTH(Data_Compilazione_Questionario__c) m, COUNT(Id) t
FROM Lead WHERE RecordType.DeveloperName='IREC' AND Data_Compilazione_Questionario__c!=null
AND CALENDAR_YEAR(Data_Compilazione_Questionario__c)=YEAR
AND (Scartato_Substage_Answered__c!='NON IN TARGET - MARKETING' OR Scartato_Substage_Answered__c=null)
AND (Scartato_Substage__c NOT IN ('VUOLE COLLABORARE CON NOI','NON IN TARGET PER MANCANZA DOCUMENTAZIONE','NON IN TARGET PER AZIONE LEGALE IN CORSO','NON IN TARGET PER TRADING ONLINE','NON IN TARGET - VITTIMA DI TRUFFA','NON IN TARGET CERCA CESSIONE DEL CREDITO','NON IN TARGET CERCA ASSICURAZIONE DEL CREDITO','NON IN TARGET CERCA RECUPERO CREDITI FISCALI','NON IN TARGET PER FALLIMENTO/LIQUIDAZIONE/CONCORDATO','NON IN TARGET CERCA FINANZIAMENTO PERSONALE','NON IN TARGET CERCA FINANZIAMENTO AZIENDA','NON HA CREDITI DA RECUPERARE/ VUOLE SOLO INFO','NON GENERA INSOLUTI','HA GIÀ RISOLTO / LO HANNO PAGATO') OR Scartato_Substage__c=null)
GROUP BY CALENDAR_MONTH(Data_Compilazione_Questionario__c);

-- REAL.general[3] Contattabili TMK  (come [2] + esclude irrintracciabili)
SELECT CALENDAR_MONTH(Data_Compilazione_Questionario__c) m, COUNT(Id) t
FROM Lead WHERE RecordType.DeveloperName='IREC' AND Data_Compilazione_Questionario__c!=null
AND CALENDAR_YEAR(Data_Compilazione_Questionario__c)=YEAR
AND (Scartato_Substage_Answered__c!='NON IN TARGET - MARKETING' OR Scartato_Substage_Answered__c=null)
AND (Scartato_Substage_Answered__c NOT IN ('DATI NON CORRETTI','NON HA MAI RISPOSTO') OR Scartato_Substage_Answered__c=null)
AND (Scartato_Substage__c NOT IN ('VUOLE COLLABORARE CON NOI','NON IN TARGET PER MANCANZA DOCUMENTAZIONE','NON IN TARGET PER AZIONE LEGALE IN CORSO','NON IN TARGET PER TRADING ONLINE','NON IN TARGET - VITTIMA DI TRUFFA','NON IN TARGET CERCA CESSIONE DEL CREDITO','NON IN TARGET CERCA ASSICURAZIONE DEL CREDITO','NON IN TARGET CERCA RECUPERO CREDITI FISCALI','NON IN TARGET PER FALLIMENTO/LIQUIDAZIONE/CONCORDATO','NON IN TARGET CERCA FINANZIAMENTO PERSONALE','NON IN TARGET CERCA FINANZIAMENTO AZIENDA','NON HA CREDITI DA RECUPERARE/ VUOLE SOLO INFO','NON GENERA INSOLUTI','HA GIÀ RISOLTO / LO HANNO PAGATO') OR Scartato_Substage__c=null)
GROUP BY CALENDAR_MONTH(Data_Compilazione_Questionario__c);

-- REAL.general[4] MQL
SELECT CALENDAR_MONTH(CloseDate) m, COUNT(Id) t FROM Opportunity
WHERE RecordType.DeveloperName='IREC' AND CALENDAR_YEAR(CloseDate)=YEAR
GROUP BY CALENDAR_MONTH(CloseDate);

-- REAL.general[5] SQL — appuntamenti
SELECT CALENDAR_MONTH(CloseDate) m, COUNT(Id) t FROM Opportunity
WHERE RecordType.DeveloperName='IREC' AND CALENDAR_YEAR(CloseDate)=YEAR
AND (Amount>0 OR (StageName='Chiuso - Perso' AND Amount=null))
GROUP BY CALENDAR_MONTH(CloseDate);

-- REAL.general[6] Trattative
SELECT CALENDAR_MONTH(CloseDate) m, COUNT(Id) t FROM Opportunity
WHERE RecordType.DeveloperName='IREC' AND CALENDAR_YEAR(CloseDate)=YEAR AND Amount>0
GROUP BY CALENDAR_MONTH(CloseDate);

-- REAL.general[7] Chiusi vinti (+pending) = CONTRATTI ; FATTURATO = SUM(Amount)
SELECT CALENDAR_MONTH(CloseDate) m, COUNT(Id) c, SUM(Amount) a FROM Opportunity
WHERE RecordType.DeveloperName='IREC' AND CALENDAR_YEAR(CloseDate)=YEAR
AND StageName IN ('Chiuso - Vinto','Chiuso - Pending')
GROUP BY CALENDAR_MONTH(CloseDate);
```

### Giornalieri — per il filtro periodo (GROUP BY giorno)

```sql
-- DTOT (Totali entrati per giorno)
SELECT DAY_ONLY(Data_Compilazione_Questionario__c) d, COUNT(Id) t
FROM Lead WHERE RecordType.DeveloperName='IREC'
AND CALENDAR_YEAR(Data_Compilazione_Questionario__c)=YEAR
GROUP BY DAY_ONLY(Data_Compilazione_Questionario__c) ORDER BY DAY_ONLY(Data_Compilazione_Questionario__c);

-- DMQL (MQL per giorno)
SELECT CloseDate d, COUNT(Id) t FROM Opportunity
WHERE RecordType.DeveloperName='IREC' AND CALENDAR_YEAR(CloseDate)=YEAR
GROUP BY CloseDate ORDER BY CloseDate;

-- DWON (chiusi vinti per giorno) + DFAT (fatturato per giorno)
SELECT CloseDate d, COUNT(Id) c, SUM(Amount) a FROM Opportunity
WHERE RecordType.DeveloperName='IREC' AND CALENDAR_YEAR(CloseDate)=YEAR
AND StageName IN ('Chiuso - Vinto','Chiuso - Pending')
GROUP BY CloseDate ORDER BY CloseDate;
```

## Note / limiti noti
- Il connettore restituisce max 2000 record per query: usare SEMPRE query aggregate (GROUP BY), mai select raw.
- Funnel **Reopen** e esclusione reopen dal General: non implementati (la transizione sta solo in `LeadHistory`, non filtrabile). In attesa di un campo Lead dedicato (`Riaperto__c`/`Data_Riapertura__c`). Vedi commento nella dashboard.
- Se una query va in timeout, riprovare una volta.
- **Shopify consegna a quest'app solo gli ultimi 60 giorni di ordini**: manca lo scope `read_all_orders`. Accertato il 26/11/2026: nel negozio ci sono 199 ordini pagati col credito wallet dal 16/02, l'API ne vedeva 45, e il piu' vecchio era del 30/09. Tocca tutto quello che nasce da `orders`, non solo il wallet: in `/api/rf` il venduto Shopify dei mesi da gennaio ad agosto torna zero e **settembre vale 4.798 € su 23 ordini invece di ~25.200 € su 155**, perche' della finestra prende solo gli ultimi quattro giorni del mese.
  - La **dashboard e' gia' protetta**: `index.html` (`_cov`, riga ~4565) riscrive col live solo i mesi che cominciano dentro la finestra, e tiene i valori cotti sugli altri.
  - Il **booklet ora pure** (dal 26/11/2026): `serieRF` tiene nulle le tre serie che nascono dagli ordini Shopify (`online`, `gest`, `ordOnline`) sui mesi che cominciano fuori dalla finestra, `scriviLive` salta i nulli e quelle celle restano come sono. I totali misti (`fatOnOff`, `fatTot`, `ordTot`, `vendutoOperatori`) seguono la parte Shopify: se manca, non si scrive il solo offline. Le serie Salesforce e ADV passano intere, settembre compreso. L'etichetta della sezione RF dice da quando il live copre davvero. Prima di questa guardia la riga RF `> Online` di settembre mostrava **4.798,45 € e un -84,7% che non esiste**.
  - **Settembre RF resta vuoto**, non torna a un valore ufficiale: nel booklet `act[8]` delle righe RF e' `null`, il consuntivo di quel mese non c'e'. Vuoto e' il dato che abbiamo; i ~25.227 € / 155 ordini si leggono solo da ShopifyQL, che non alimenta `/api/rf`.
  - `r.fisso` **resta dov'e'**: le righe RF hanno `fisso:[9]`, cioe' ottobre, che e' dentro la finestra e verrebbe riscritto dal live. Quei valori sono accertati a mano e vanno protetti finche' ottobre non esce dalla finestra (dal 1° dicembre ci pensa la guardia).
  - Non e' aggirabile da codice: ShopifyQL legge tutto lo storico (per questo le ricariche e il fatturato per mese tornano) ma non porta lo sconto wallet ne' l'attribuzione per operatore, che serve per `gestito`/`spontaneo`. Lo scope si aggiunge dall'admin Shopify > Impostazioni > App e canali di vendita > app custom > configurazione API Admin; fatto quello, qui non si tocca niente e i numeri si riempiono da soli.
