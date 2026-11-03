# Business Model Overview — Incassi Intelligenti

Oct 8, 2026 · @Irec Marketing

## Sintesi

Il nuovo Incassi Intelligenti è un agente AI conversazionale ("Irec") dentro la chat di Allcore Mind, venduto con brand Irec: un reparto crediti che presidia le fatture, sollecita, risponde ai debitori e passa al Recupero Crediti Irec quello che non si incassa entro 45 giorni.

- **Cosa lo rende diverso.** Nessun competitor italiano unisce fatture dal cassetto fiscale, agente che conversa con i debitori, credit manager umano e recupero con studio legale interno.
- **Come si usa.** Mandante e credit manager parlano con lo stesso agente: le risposte arrivano come card, nessuna azione parte senza un clic, ogni mese arriva un report PDF.
- **A cosa serve questo documento.** È la base comune per tre pubblici: i clienti che devono capirlo, i sales che devono venderlo e il marketing che deve promuoverlo. Le schermate con le funzionalità sono nella scheda dedicata.

Prezzi, costi e ricavi sono esclusi da questa versione; il prezzo della fattura extra è in un documento a parte.

## Business model canvas

Il centro del modello è la proposta "il reparto crediti in chat". A sinistra c'è quello che Irec mette in campo, a destra a chi e come lo vende, sotto i competitor.

&#91;embedded content: business model canvas · 9 blocchi\]

Ogni blocco è approfondito nelle sezioni che seguono.

## Partner, attività e risorse chiave

L'agente fa il lavoro ripetitivo e le persone Irec intervengono in tre punti: le chiamate del flusso, le risposte da valutare e il passaggio al recupero.

### Partner chiave

| Partner | Ruolo |
| --- | --- |
| Allcore Mind | Piattaforma, chat e attivazione delle utenze (team Mind) |
| Agenzia delle Entrate | Cassetto fiscale, fonte delle fatture (un solo intermediario per partita IVA) |
| Fabrick | Collegamento al conto e riconciliazione dei pagamenti (PSD2, cioè open banking) |
| Provider di canale | Alias email sul dominio di piattaforma, PEC, WhatsApp Business |
| Stripe o bonifico | Incasso dei canoni |

### Attività chiave

1. **Acquisizione delle fatture.** Dal cassetto fiscale dell'Agenzia delle Entrate o da un file importato in chat, con controllo degli errori di import.
2. **Flusso di sollecito standard.** Promemoria a T−2, poi solleciti e chiamate fino a T+35 e passaggio al Recupero Crediti a T+45: T+3 email, T+6 WhatsApp, T+9 telefonata, T+15 email, T+19 telefonata, T+25 PEC, T+30 telefonata, T+35 PEC.
3. **Gestione delle risposte.** L'agente riconosce pagamento avvenuto, promessa con data, proroga, rateizzazione e contestazione; mette in pausa il flusso e segnala i casi da valutare.
4. **Azioni su richiesta.** Pausa, ripresa, proroga, blocco, registrazione di un incasso, invio del report: sempre tramite una card e una conferma.
5. **Lavoro del credit manager.** Telefonate previste dal flusso, valutazione delle risposte, richieste di modifica dei mandanti, azioni riservate (invio forzato, modifica del flusso, cancellazione dei dati).
6. **Reporting.** Report mensile PDF al mandante; copia per il credit manager con la pagina "Da lavorare".

### Risorse chiave

- Brand e licenza Irec: dal 1987, licenza 115 T.U.L.P.S., membro UNIREC.
- Credit manager e servizio di Recupero Crediti con studio legale interno.
- Sequenze di sollecito costruite su oltre 50.000 azioni di recupero.
- Agente AI e sistema di card (stati, toni, report) costruiti su Mind.

## Proposta di valore

La promessa è avere un reparto crediti in chat: chiedi "come stanno i miei incassi?" e l'agente risponde con i numeri, sollecita al posto tuo e ti coinvolge solo quando serve una decisione. È un collaboratore in più che presidia il credito: sa come parlare ai clienti (tempi, toni e canali vengono da oltre 50.000 pratiche Irec, per più di 210 milioni di euro), sa cosa dire e come trattare, e lavora ogni giorno. Dove l'agente si ferma entra il credit manager Irec: l'AI fa il lavoro ripetitivo, le decisioni che contano le prende una persona Irec insieme al cliente.

### Proposta di valore per attore

| Attore | Lavoro da svolgere | Cosa offre il nuovo Incassi |
| --- | --- | --- |
| Mandante (PMI che affida le fatture) | Sapere chi deve pagare e farsi pagare senza scrivere solleciti a mano | "I tuoi numeri" sempre in cima alla chat, con da incassare, in sollecito e bloccato; flusso da T−2 a T+35 su email, WhatsApp, PEC e telefono; card d'azione (pausa, blocco, proroga) confermate con un clic; report mensile PDF |
| Credit manager Irec | Seguire molti mandanti senza ricostruire ogni pratica | Stesse card in terza persona; sezione "Da lavorare" nel report (risposte da valutare, notifiche, escalation entro 15 giorni); registrazione delle chiamate; richieste di modifica dei mandanti da applicare in un clic |
| Debitore (cliente del mandante) | Pagare senza attriti e senza essere sollecitato a vuoto | Conversazione con l'agente che riconosce promesse, proroghe e contestazioni; i solleciti si fermano quando arriva il pagamento |
| Irec | Far crescere il recupero crediti e i ricavi ricorrenti | Canone, commissione e un flusso continuo di pratiche verso il Recupero Crediti, con lo storico già completo |

## Relazioni e canali

Incassi Intelligenti si vende con brand Irec, in autonomia rispetto a Mind (decisione del 29 luglio 2026), con un funnel guidato dal commerciale: nessuna attivazione self-service, ogni lead riceve una chiamata entro 24–48 ore.

### Relazioni con il cliente

Entry e Value: self-service in chat, con supporto via card "Parla con il credit manager" e richieste di modifica del flusso. Premium: credit manager dedicato che opera per conto del mandante. Per tutti: report mensile automatico e notifiche quando una situazione richiede una persona.

### Funnel

1. **Lead.** Arriva da una delle fonti sotto, sulla landing di Irec con listino e "Prova gratis per 30 giorni".
2. **Richiesta di prova.** Form con pacchetto preferito e metodo di pagamento; il lead entra in Salesforce.
3. **Chiamata del Credit Advisor.** Consiglia Value o Premium e comunica l'attivazione al team Mind.
4. **Prova di 30 giorni.** Il conteggio parte quando i dati sono a sistema, non durante i 2–4 giorni tecnici dell'Agenzia delle Entrate.
5. **Abbonamento.** Attivazione automatica al 31° giorno; la disdetta si fa in piattaforma con "Annulla il rinnovo automatico" e avvisa il team Sales.
6. **Espansione.** Upgrade di pacchetto, fatture extra e passaggio delle posizioni a T+45 al Recupero Crediti.

### Fonti di lead

| Fonte | Tipo | Nota |
| --- | --- | --- |
| Lead scartati Irec | Interna | Già pagati o non in target per il recupero: hanno il problema del ciclo attivo |
| Clienti Irec attivi e utenti Radar | Interna | Cross-sell (vendita di un servizio in più a chi è già cliente) |
| Clienti Allcore | Ecosistema | Altre società del gruppo |
| Webinar ed eventi Irec | Owned | Tema Credit Advisor e ciclo attivo |
| Pubblicità verticale | Paid | Prevista e poi sospesa nel GTM; da riattivare con budget dedicato |
| Strumenti gratuiti in Mind | Prodotto | Previsione incassi, 2 analisi Radar gratuite al mese |

## Segmenti di clientela

- **Segmento principale:** PMI e micro-PMI B2B con fatturato tra 500k e 5M €, da 1 a 3 persone in amministrazione, nessun credit manager interno, incassi gestiti a mano o quasi. Decidono l'imprenditore, il responsabile amministrativo o il CFO nelle realtà più strutturate.
- **Segmenti interni** (a basso costo di acquisizione): clienti Irec attivi, lead Irec persi perché il cliente aveva già pagato o perché non in target per il recupero, clienti di altre società Allcore, lead di consulenza Irec, utenti Radar.
- **Leva per pacchetto:** Entry e Value servono chi vuole fare da sé; Premium serve chi vuole delegare, ha fino a 300 fatture al mese e vuole un credit manager dedicato.

## Competitor

Nessun concorrente italiano mappato unisce fatture dal cassetto fiscale, agente che conversa con i debitori, credit manager umano e recupero con studio legale interno. Il più vicino sul prodotto è Lia, il più forte sul brand è Intrum For You. La mappatura completa è in Mappatura competitor Italia — Incassi Intelligenti.

| Competitor | Cos'è | Dove è forte | Cosa gli manca rispetto a Incassi Intelligenti | Frase per il sales |
| --- | --- | --- | --- | --- |
| Lia (Lendit srl) | Agente AI SaaS | Risponde ai debitori su email, PEC, WhatsApp e SMS; invii dal dominio del cliente | Niente cassetto fiscale, nessun recupero né legale dietro | "E quando il cliente non paga, chi ci pensa?" |
| Intrum For You | Servicer con piattaforma per PMI | Brand, filiera legale, paghi solo sul recuperato | Le fatture le carichi tu; non presidia ogni giorno le scadenze | "Chi segue le fatture prima che scadano?" |
| JustSolve | Agenti AI per il recupero stragiudiziale | Tecnologia matura, 6 canali, negoziazione dei piani di rientro | Pensato per fintech e grandi volumi, integrazione su misura | "Parti in 15 minuti, senza progetto IT" |
| Agicap CashCollect | Tesoreria con modulo solleciti | Riconciliazione, previsioni di cassa, noto ai CFO | L'AI scrive i solleciti ma non conversa; nessun recupero | "Il tuo strumento risponde ai clienti?" |
| Fatture in Cloud | Gestionale di fatturazione | Già installato in molte PMI, solleciti automatici | Solo email, regole fisse, nessuna gestione delle risposte | "Lo usi già: noi facciamo quello che lui non fa" |
| Sollecito Facile | Servizio umano low cost | Telefonate e lettere fatte da persone | Nessuna automazione, interviene solo sull'insoluto | "Prevenire costa meno che recuperare" |

Il posizionamento che ne esce è quello già indicato nel GTM: un modello ibrido software più servizio, poco presidiato sul mercato.

## Come funziona: il flusso di sollecito

Nel flusso standard Irec ogni fattura segue 10 tappe in 45 giorni, personalizzabili con il credit manager (tempi, canali, tono); se a quel punto è ancora aperta, la posizione passa al Recupero Crediti Irec e il flusso si ferma per tutte le fatture di quel cliente.

&#91;embedded content: flusso standard di sollecito · da T−2 a T+45\]

- **Prima di partire:** le fatture arrivano dal cassetto fiscale, i pagamenti da Fabrick. Una fattura già scaduta all'avvio entra allo step della sua anzianità, senza raffica di solleciti arretrati.
- **Consolidamento:** un solo messaggio per cliente, canale e giorno. Dalla PEC in poi il sollecito riprende tutte le fatture aperte di quel cliente.
- **Risposte:** promessa, proroga o contestazione mettono in pausa il flusso e avvisano mandante o credit manager.
- **Chiamate:** nel Premium le fa il credit manager e le registra in chat. Il T+45 è il valore standard: il passaggio avviene all'ultimo step del flusso configurato.
- **Da confermare:** il PRD indica le chiamate anche per il Value e a T+18 invece di T+19.

## L'esperienza in chat e il design

Il cambio rispetto alla versione precedente è di paradigma: Incassi Intelligenti non è più un software da consultare, ma un assistente che lavora in autonomia con le regole decise all'avvio e si fa interrogare in chat. Non ci sono dashboard statiche: anche l'onboarding avviene in chat, passo per passo.

### Chi fa cosa (decisione del 21 settembre)

| Attore | Cosa fa in chat | Cosa non fa |
| --- | --- | --- |
| Mandante, su tutti i piani | Lavora le proprie posizioni: pausa, blocco, registrazione di un pagamento, presa in carico di una conversazione, recapiti, modifica della scadenza | Non configura flusso, testi, tono, risposte automatiche e soglie: apre una richiesta di modifica al credit manager con un modulo (canale, tono, descrizione) |
| Credit manager Irec | Configura il servizio al primo avvio e applica le richieste; sul Premium telefona ai debitori e riceve le escalation; vede una panoramica di tutti i suoi mandanti | Non agisce sulle posizioni al posto del mandante senza richiesta |
| Debitore | Riceve i solleciti e risponde; l'agente riconosce pagamento, promessa, proroga, rateizzazione e contestazione | Non accede alla piattaforma |

La chat a tre (mandante, agente e credit manager) è aperta a tutti, anche a chi non ha il credit manager dedicato. I problemi tecnici vanno invece al customer service tramite ticket.

### Cosa vede il mandante

- **"I tuoi numeri"** in cima alla chat: da incassare, non ancora scaduto, in sollecito, bloccato e fuori dal flusso, con la barra della composizione. Si apre e si chiude (versione 3, approvata il 5 ottobre).
- **Risposte come card**: incassi, periodo, portafoglio, tabelle, andamento mese per mese, flusso, scheda cliente, scheda fattura, conversazione con il debitore, piano attivo.
- **Azioni sempre confermate**: card d'azione, conferma centrata ed esito (eseguita, annullata, scaduta, errore). Nessuna azione parte senza un clic.
- **Tono dell'agente a scelta**: "Pane e salame", "Professionale" o "Tecnico".
- **Report PDF** il 2 di ogni mese, più il trimestrale.

Il dettaglio di ogni schermata, con chi la vede e la domanda che la fa comparire, è nella scheda Schermate e funzionalità.

### Come escono le comunicazioni ai debitori

| Canale | Mittente | Regola |
| --- | --- | --- |
| Email e PEC | Indirizzo dedicato per ogni cliente, nel formato nome.cognome@ sul dominio Incassi Intelligenti | Oggetto diverso per gravità e livello di escalation |
| WhatsApp | Un solo numero business, "Incassi Intelligenti" | Nel testo sempre ragione sociale del mandante e riferimento al rappresentante legale |
| Telefono | Credit manager Irec (Premium) | Chiamata registrata in chat; promemoria ogni 24 ore finché non è registrata |
| Firma | "Incassi Intelligenti" di default | Personalizzabile con nome e cognome solo nei piani che lo prevedono |

### Regole di lettura dei numeri

- Gli importi passati al Recupero Crediti sono esclusi dal "da incassare", con un asterisco che lo dichiara.
- Il periodo di default è l'anno solare in corso; oltre, solo su richiesta.
- Per il singolo cliente si usa il ritardo medio; il DSO resta solo come dato dell'azienda.
- All'avvio non parte nessuna raffica di solleciti arretrati: ogni fattura entra nel flusso allo step della sua anzianità.
- Se manca un recapito il flusso cambia canale invece di saltare lo step, e non ripiega sulla PEC quando c'è un'alternativa.

### Regole del design

| Elemento | Regola |
| --- | --- |
| Colori di marca | Allcore Blue #1057A4 e Mind Teal #0ABAB5, in gradiente a 135°; il brand va sulla struttura (testate, intestazioni), mai sui dati |
| Colori degli stati | Verde incassato, blu non ancora scaduto, ambra in sollecito, viola bloccato dal mandante, grigio fuori dal flusso, rosso recupero. Modalità colorata adottata il 5 ottobre |
| Caratteri | Bricolage Grotesque per titoli e logo, Manrope per testo, numeri e card |
| Importi | All'italiana, simbolo dopo: 22.500,00 € |
| Marchio | Proposta del 28 settembre: "Incassi" con font e colore Allcore, "Intelligenti" con font e colore Mind; da verificare con chi gestisce il marchio |
| Report PDF | Teal incassato, blu non scaduto, arancio scaduto, cremisi recupero, viola bloccato; grafici al posto degli elenchi lunghi |

## Materiali per clienti, sales e marketing

Il copy della landing nel piano operativo marketing descrive ancora un software che si collega e lavora da solo. Va riscritto attorno all'agente in chat: si chiede, si conferma e si delega. La nuova versione completa è nella scheda Copy landing — nuova versione.

### Cosa cambia nel copy della landing

| Blocco | Copy attuale (piano operativo) | Cosa cambia |
| --- | --- | --- |
| Hero | "Gli incassi si perdono nei 45 giorni prima"; il sottotitolo descrive collegamenti e solleciti | Resta il problema dei 45 giorni; la promessa diventa "il tuo reparto crediti, in chat": chiedi, l'agente risponde con i numeri e lavora per te |
| Come funziona | "Tre collegamenti, poi lavora da solo" | L'onboarding si fa in chat con l'agente e il consulente; poi si interroga l'agente invece di aprire una dashboard |
| Perché è diverso | Metodo Irec e credit manager sui casi fuori dall'ordinario | Aggiungere: risponde ai tuoi clienti, nessuna azione senza il tuo ok, report mensile, chat a tre con il credit manager aperta a tutti |
| Come si parte | "Giorno 5: vedi il tuo portafoglio" | "Giorno 5: chiedi a Irec com'è il tuo portafoglio"; la configurazione la fa il credit manager con te |
| Pricing | Canali: email; WhatsApp e Voice AI "da Q4"; personalizzazione fatta dal cliente | Email e PEC su tutti i piani; WhatsApp da Value; chiamata del credit manager nel Premium; Voice AI non citata. Le modifiche passano sempre dal credit manager. Oltre le fatture incluse il servizio non si blocca: si paga la fattura extra |
| FAQ | 9 domande sul funzionamento del software | Aggiungere: "Devo imparare un software?", "Da quale indirizzo ricevono i solleciti i miei clienti?", "L'AI può scrivere ai miei clienti senza il mio ok?", "Cosa succede se supero le fatture del piano?" |
| Mail "Utenza attivata" | Credenziali e i due collegamenti | "Apri la chat con Irec su Mind: ti guida lei nei collegamenti, insieme al consulente" |

Restano validi: offerta (30 giorni senza canone, 1% sugli importi effettivamente incassati), CTA "Richiedi la prova", richiamata entro 48 ore, avviso sul provider unico del cassetto fiscale, brand "powered by Irec, disponibile anche su Mind".

### Materiali da produrre

| Pubblico | Materiale | Cosa deve far capire |
| --- | --- | --- |
| Clienti | Guida "Le prime 10 domande da fare a Irec" | Come si usa: si chiede, non si cerca. Esempi: "Come stanno i miei incassi?", "Chi mi deve di più?", "Metti in pausa la F-2026-019" |
| Clienti | Guida ai recapiti nel gestionale | Email, PEC e scadenze corrette in fattura sono la base del flusso (azione aperta dal 4 agosto) |
| Clienti | Esempio di report mensile commentato | Come leggere "da incassare", recupero e ritardo medio |
| Sales | One-pager aggiornato | Cosa fa, per chi, i tre piani, chi configura cosa, cosa non fa ancora (Voice AI) |
| Sales | Demo in chat con mandante di prova | Le 5 domande che mostrano il valore in 3 minuti |
| Sales | Gestione obiezioni | Alle quattro attuali aggiungere "Non voglio che un'AI scriva ai miei clienti" e "Non ho tempo di imparare un software" |
| Sales | Battlecard competitor | Le frasi della sezione Competitor |
| Marketing | Landing riscritta | Vedi la scheda del copy |
| Marketing | Video o GIF della chat | Una domanda, una card, una conferma: il prodotto si spiega meglio mostrato che descritto |
| Marketing | Post e webinar di ottobre | Dal "software che sollecita" al "reparto crediti in chat" |

## Rischi e domande aperte

Il rischio operativo è la capacità dei credit manager; quello di comunicazione è continuare a raccontare il vecchio software invece dell'agente in chat.

| Tema | Rischio | Prossimo passo |
| --- | --- | --- |
| Capacità dei credit manager | Configurano tutti i piani e nel Premium telefonano fino a 3 volte per fattura scaduta | Misurare le ore per mandante nei primi 3 mesi; backup per ferie (proposta del 28 settembre) |
| Messaggio "prova gratis" | Il cliente può non aspettarsi l'1% sugli incassi | Usare sempre "30 giorni senza canone, paghi solo l'1% di quello che incassi" |
| Copy e sito non allineati | Landing e irec.it raccontano ancora un software con WhatsApp e voce "da Q4" | Pubblicare il nuovo copy della landing e aggiornare la pagina su irec.it |
| Diffidenza verso l'AI | Il mandante teme che l'agente scriva ai clienti senza controllo | Raccontare conferma con un clic, testi approvati da Irec, mittente e firma dedicati |
| Cassetto fiscale | Un solo intermediario per partita IVA: collegarlo scollega il gestionale o il commercialista | Dirlo a voce in consulenza, non solo scritto in landing |
| Recapiti nei gestionali | Email, PEC e scadenze sbagliate in fattura bloccano il flusso | Guida per i clienti sull'inserimento corretto dei dati |
| WhatsApp | Accesso tramite Meta ancora in sblocco al 5 ottobre | Confermare la data prima di comunicarlo come attivo |
| Marchio | Logo combinato Allcore e Mind da verificare con chi gestisce il marchio | Chiudere prima di produrre i materiali |

## Glossario e fonti

### Glossario

- **Business model canvas**
  - schema in blocchi che descrive come un'attività crea e consegna valore
- **Agente AI / agentic**
  - assistente che legge, decide e agisce da solo entro regole date
- **Card**
  - riquadro in chat con dati o con un'azione da confermare
- **Onboarding**
  - attivazione guidata del servizio
- **Cross-sell / upsell**
  - vendita di un servizio in più / passaggio a un piano superiore
- **Self-service / sales-led**
  - il cliente fa da sé / la vendita passa sempre da un commerciale
- **DSO (Days Sales Outstanding)**
  - giorni medi necessari per incassare il fatturato
- **Battlecard**
  - scheda di confronto per il commerciale contro un singolo concorrente
- **Credit manager / Credit Advisor**
  - consulente Irec che configura e segue il servizio / consulente che lo propone in fase di vendita

### Fonti

- Catalogo dell'interfaccia e design system, versione del 7 ottobre 2026 (file allegato)
- Design system di Allcore Mind, luglio 2026 (file allegato)
- Incassi Intelligenti — PRD, versione aggiornata (file allegato)
- Incassi Intelligenti — Piano operativo Marketing (file allegato)
- Modifiche chieste nelle call di collaudo del 15, 16 e 17 settembre 2026 (file allegato)
- Decisioni della call del 21 settembre 2026 (file allegato)
- Appunti delle riunioni del 4 agosto, 15, 16, 17, 21 e 28 settembre e 5 ottobre 2026 (file allegati)
- Go to Market — Incassi Intelligenti e Allineamento Marketing del 29 luglio 2026 (documenti del progetto)
- [Incassi Intelligenti su irec.it](https://www.irec.it/servizi/incassi-intelligenti/)
