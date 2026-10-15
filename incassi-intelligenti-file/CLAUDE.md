# Hub Incassi Intelligenti

Pagina statica (un solo file HTML, nessuna build) che raccoglie i materiali di lancio di **Incassi Intelligenti**, l'agente AI di IREC per solleciti e incassi. Ha due schede, **Marketing** e **Sales**. Ogni card apre un artefatto Claude pubblicato: presentazione, documento, design o strumento.

## Struttura
- `index.html`: tutta la pagina. CSS in `<style>`, JS nello `<script>` in fondo, nessuna libreria.
- `materiali/`: i documenti e le presentazioni, serviti da qui. Le card ci puntano direttamente,
  cosi' si aprono senza passare da claude.ai e senza che l'artefatto sia stato condiviso.
  I nomi sono senza spazi e senza accenti, perche' finiscono in un indirizzo.
- `calcolatore/index.html`: il calcolatore dei vantaggi, pagina a se' e autosufficiente.
- `assets/Demo-Incassi-Intelligenti.mp4`: mini demo della chat nella scheda Marketing. `assets/demo-poster.png` è la sua immagine di anteprima.
- `assets/Demo-Incassi-Intelligenti.gif`: la stessa demo in GIF, per email e LinkedIn. La pagina non la usa.
- `links.json`: elenco dei materiali collegati, con `percorso` e `locale`. Si rigenera leggendo
  le card di `index.html`, quindi non va aggiornato a mano.

Restano su claude.ai due sole voci, la **Landing page** e il **One-pager**: sono design e non
hanno un file equivalente. Le loro card portano l'etichetta «Su Claude», cosi' chi apre l'hub
sa prima di cliccare che quella richiede la condivisione dell'artefatto.

## Come aprirla
Apri `index.html` nel browser, oppure servila in locale con `python3 -m http.server 8000` da questa cartella.

## Convenzioni
- Tutti i testi sono in **italiano**.
- I colori sono token CSS su `:root`. Il tema scuro sta in `prefers-color-scheme` e `[data-theme]`. Aggiungi un nuovo colore come token, mai come valore fisso.
- Font da Google Fonts: Bitter per i titoli, Manrope per il testo.
- Colori del brand:
  - viola IREC: #3B2D56 e #4E3B6B
  - corallo: #E35B4B (testo #B83A2C)
  - teal: #0ABAB5
  - blu prodotto: #1057A4
- Schede (tab): bottoni `role="tab"`; i pannelli sono `<section role="tabpanel">` mostrati o nascosti con `hidden`. Con `#mkt` e `#sales` nell'indirizzo si apre direttamente la scheda.
- Per aggiungere un materiale: metti il file in `materiali/` con un nome senza spazi ne' accenti,
  poi copia una card `<a class="item">` nel gruppo giusto e fai puntare `href` al file:
  - `.k` è il tipo;
  - `.t` è il titolo;
  - `.d` è una riga di descrizione;
  - `<span class="tag">Interno</span>` (facoltativo) segna quello che non va ai clienti.

## Regole sui contenuti (da non violare)
- Prezzi sempre **IVA esclusa**:

  | Piano | Canone | Fatture incluse | Fattura extra |
  |---|---|---|---|
  | Entry | 49 €/mese | 100 | 1,50 € |
  | Value | 89 €/mese | 200 | 1,20 € |
  | Premium | 149 €/mese | 300 | 0,80 € |

  Su tutti i piani si aggiunge l'1% sugli importi effettivamente incassati.
- Prova: 30 giorni a 0 € di canone; l'1% resta attivo.
- WhatsApp è incluso dal piano Value; le chiamate del credit manager solo nel Premium.
- Nei materiali per i clienti:
  - concorrenti anonimi;
  - mai «disponibile anche su Allcore Mind»;
  - niente testimonianze o statistiche inventate (usa segnaposto).
- Metti in evidenza il credit manager IREC e la solidità di IREC e del Gruppo Allcore.

## Pubblicazione (deploy)
Va bene qualsiasi hosting statico: Netlify, Vercel, GitHub Pages o il sito aziendale. I link portano ad artefatti su claude.ai, quindi ognuno va condiviso con chi userà l'hub.
