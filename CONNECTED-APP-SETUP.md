# Salesforce — Connected App per la Dashboard IREC (JWT Bearer)

Istruzioni per l'**amministratore Salesforce** dell'org `marketing@irec.it`.
Servono ~10 minuti. Alla fine dovrai comunicarci **una sola cosa**: il *Consumer Key*.

L'integrazione è **in sola lettura** (query SOQL su Lead/Opportunity) e usa il flusso
**JWT Bearer** (server-to-server, nessun login interattivo, nessuna password condivisa).
Il certificato pubblico da caricare è nel file **`server.crt`** (allegato). La chiave
privata resta solo sul nostro server (Vercel) e non viene mai condivisa.

## 1. Crea la Connected App
Setup → **App Manager** → **New Connected App** (in alto a destra).
- **Connected App Name**: `IREC Dashboard API`
- **API Name**: `IREC_Dashboard_API`
- **Contact Email**: la tua email

## 2. Abilita OAuth
Spunta **Enable OAuth Settings** e compila:
- **Callback URL**: `https://irec-dashboard.vercel.app/callback`
  *(non viene usata dal flusso JWT, ma il campo è obbligatorio: va bene un valore qualsiasi https)*
- Spunta **Use digital signatures** → **Choose File** → carica il file **`server.crt`** (allegato).
- **Selected OAuth Scopes** (sposta a destra):
  - **Manage user data via APIs (api)**
  - **Perform requests at any time (refresh_token, offline_access)**
- Lascia il resto come da default → **Save** (l'attivazione può richiedere ~2-10 minuti).

## 3. Pre-autorizza l'utente (fondamentale per il JWT)
App Manager → trova `IREC Dashboard API` → menu ▾ → **Manage** → **Edit Policies**:
- **Permitted Users** = **Admin approved users are pre-authorized** → **Save**.
- Poi, sempre nella pagina Manage, sezione **Profiles** o **Permission Sets** →
  aggiungi il **profilo** (o un permission set) dell'utente **`marketing@irec.it`**,
  così quell'utente è autorizzato a usare l'app.

> Se preferisci un permission set dedicato: crealo (es. `IREC Dashboard API Access`),
> assegnalo a `marketing@irec.it`, e aggiungilo alla Connected App qui sopra.

## 4. Comunicaci il Consumer Key
App Manager → `IREC Dashboard API` → **View** → sezione **API (Enable OAuth Settings)** →
**Consumer Key** (una stringa lunga). **Copiala e inviacela.**
*(Il Consumer Secret NON serve per il flusso JWT.)*

---

### Riepilogo di ciò che ci serve indietro
- ✅ **Consumer Key** della Connected App.
- ✅ Conferma che l'utente `marketing@irec.it` è **pre-autorizzato** (passo 3).

Con quello configuriamo il server (Vercel) e la dashboard va online con dati **live**.

### Note tecniche (per l'admin)
- Login URL previsto: `https://login.salesforce.com` (se l'org usa un My Domain per
  l'auth o è una sandbox, segnalacelo: cambieremo `SF_LOGIN_URL`).
- Il server invierà un JWT firmato con la chiave privata corrispondente a `server.crt`;
  Salesforce restituisce un access token in sola lettura per l'utente pre-autorizzato.
