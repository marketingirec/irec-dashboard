# Meta (Facebook) Marketing API — credenziali per la dashboard (sola lettura spesa)

Obiettivo: leggere la **spesa mensile** da Meta Ads via API (gratis). Servono 2 valori,
che poi metteremo su Vercel. ~15-20 min una tantum.

Valori finali da procurare:
- `META_ACCESS_TOKEN` (token di un **System User** con permesso `ads_read`)
- `META_AD_ACCOUNT_ID` (l'ID dell'account pubblicitario, formato `act_XXXXXXXXXX`)

## 1. App Meta
1. Vai su **developers.facebook.com** → **My Apps → Create App**.
2. Tipo **Business** → dai un nome (es. *IREC Dashboard*) → collega il tuo **Business Manager**.
3. Nel prodotto **Marketing API** → **Set up** (aggiunge l'API all'app).

## 2. System User + token (consigliato, non scade)
1. Vai su **business.facebook.com → Impostazioni aziendali (Business Settings)**.
2. **Utenti → Utenti di sistema (System Users) → Aggiungi** → crea un system user (ruolo *Employee*).
3. Assegna al system user l'**account pubblicitario** (Asset → Ad accounts → assegna, con accesso in visualizzazione/analisi).
4. Clicca **Genera nuovo token (Generate token)** → seleziona l'**App** del passo 1 → spunta lo scope **`ads_read`** → genera.
5. Copia il **token** (compare una sola volta) → è `META_ACCESS_TOKEN`.

> Il token di un system user è di lunga durata (non scade come i token utente).

## 3. Ad Account ID
1. In **Business Settings → Account → Account pubblicitari** clicca l'account.
2. Copia l'**ID** (solo numeri). In `META_AD_ACCOUNT_ID` mettilo con il prefisso: **`act_` + numeri**
   (es. `act_1234567890`).

---

### Mandami questi valori (li metto io su Vercel, restano segreti):
`META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID`.

> Se le campagne Meta sono gestite da un'agenzia, chiedi loro di creare il System User token
> con `ads_read` sull'account, oppure di aggiungerti come admin dell'ad account.
