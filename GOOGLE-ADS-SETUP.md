# Google Ads API — credenziali per la dashboard (sola lettura spesa)

Obiettivo: leggere la **spesa mensile** da Google Ads via API (gratis). Servono 4 valori,
che poi metteremo come *Environment Variables* su Vercel. ~20-30 min una tantum.

Valori finali da procurare:
- `GOOGLE_ADS_DEVELOPER_TOKEN`
- `GOOGLE_ADS_CLIENT_ID` + `GOOGLE_ADS_CLIENT_SECRET`
- `GOOGLE_ADS_REFRESH_TOKEN`
- `GOOGLE_ADS_CUSTOMER_ID` (l'ID dell'account, senza trattini) e, se usi un MCC, `GOOGLE_ADS_LOGIN_CUSTOMER_ID`

## 1. Developer token
1. Accedi a **Google Ads** con l'account che gestisce le campagne.
2. In alto: **Strumenti e impostazioni → Configurazione → API Center** (compare se sei admin).
3. Copia il **Developer token**. Se è in stato *Test*, richiedi **Basic access** (di solito approvato in poche ore): basta per leggere i tuoi account.

## 2. Progetto Google Cloud + OAuth Client
1. Vai su **console.cloud.google.com** → crea (o scegli) un progetto.
2. **API e servizi → Libreria** → cerca **Google Ads API** → **Abilita**.
3. **API e servizi → Schermata consenso OAuth** → tipo **Esterno** → compila i campi minimi → aggiungi te stessa come *Test user*.
4. **API e servizi → Credenziali → Crea credenziali → ID client OAuth** → tipo **App desktop**.
5. Copia **Client ID** e **Client Secret**.

## 3. Refresh token (autorizzazione una tantum)
Il modo più semplice è l'**OAuth Playground**:
1. Vai su **developers.google.com/oauthplayground**.
2. In alto a dx (⚙️ *OAuth 2.0 configuration*) → spunta **Use your own OAuth credentials** → incolla **Client ID** e **Client Secret** del passo 2.
3. Nel campo *Input your own scopes* (Step 1) incolla:
   `https://www.googleapis.com/auth/adwords`
   → **Authorize APIs** → accedi con l'account Google Ads e concedi i permessi.
4. **Step 2 → Exchange authorization code for tokens**.
5. Copia il **Refresh token** che compare.

> Nota: perché il refresh token non scada, la schermata consenso può restare in *Testing*
> con te come test user (va bene per uso interno).

## 4. Customer ID
- In Google Ads, in alto a dx c'è l'**ID account** (formato `123-456-7890`).
  Come `GOOGLE_ADS_CUSTOMER_ID` usa le **10 cifre senza trattini** (es. `1234567890`).
- Se gli account stanno sotto un **MCC** (account amministratore), indica anche
  `GOOGLE_ADS_LOGIN_CUSTOMER_ID` = l'ID (10 cifre) dell'MCC.

---

### Mandami questi valori (li metto io su Vercel, restano segreti):
`GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`,
`GOOGLE_ADS_REFRESH_TOKEN`, `GOOGLE_ADS_CUSTOMER_ID` (+ `GOOGLE_ADS_LOGIN_CUSTOMER_ID` se MCC).
