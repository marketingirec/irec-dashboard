# Booklet — Considerazioni mensili

Ogni sezione del booklet chiude con una scheda **Considerazioni**: il commento del mese
appena concluso. La scheda è **chiusa di default** — in fondo a una tabella lunga il
commento non deve imporsi — e si apre cliccando sulla sua riga.

Il confronto è su **due assi, sempre entrambi**:

- **lo stesso mese dell'anno prima**, che dice se siamo sopra o sotto;
- **i due mesi precedenti dello stesso anno**, che dicono se stiamo migliorando o
  peggiorando. Dal solo anno su anno questa seconda cosa non si vede.

Il secondo asse ha anche una resa grafica fissa, la striscia `andamento` in cima alla
scheda: lo stesso KPI negli ultimi tre mesi disponibili, con il verdetto a destra.

Lo storico resta: la voce più recente è in cima, quelle vecchie sotto, in «Storico».

## Dove stanno i dati

In `booklet/dati-booklet.json`, chiave di primo livello `considerazioni`, per id di sezione.
Le voci di ogni sezione vanno **dalla più recente alla più vecchia** — l'ordine dell'array è
l'ordine di lettura, non si riordina a schermo.

```json
"considerazioni": {
  "ff-rf": [
    { "mese": "2026-10",
      "scritto": "2026-11-09",
      "sintesi": "una o due frasi: il fatto del mese, con il numero che lo regge",
      "andamento": {
        "kpi": "Fatturato totale",
        "verso": "su",
        "esito": "in ripresa",
        "punti": [ { "m": "Ago", "v": "8.215,76" }, { "m": "Ott", "v": "32.791,32" } ]
      },
      "voci": [ { "t": "pos", "k": "titolo breve", "v": "la frase, con i numeri" } ],
      "base": "su quali mesi è stato fatto il confronto e che cosa manca" }
  ]
}
```

`t` sceglie solo il colore del segno a sinistra:

| `t` | segno | quando |
|---|---|---|
| `pos` | `+` verde | quello che va bene |
| `neg` | `!` rosso | quello da correggere |
| `trend` | `→` blu | un andamento, né buono né cattivo di per sé |
| `nota` | `i` grigio | un'avvertenza sul dato, non sul business |

In `sintesi` e `v` si può usare HTML semplice (`<b>`, entità). Il testo arriva dal nostro
file, non da fuori.

Nella striscia `andamento`, `verso` è `su` (verde), `giu` (rosso) o `piatto` (grigio) e
colora solo il verdetto; `esito` sono le parole del verdetto; i valori in `punti` sono
**già formattati come testo** e non vengono ricalcolati a schermo — se un mese manca nel
file si scrive `"n/d"` invece di saltarlo, così il buco si vede.

## Sezioni che hanno la scheda

Tutte e otto: `mkt-irec`, `ff-irec`, `perf-sales`, `tmk`, `cust-care`, `yoy-irec` (IREC)
e `ff-rf`, `yoy-rf` (RF). Se un domani si aggiunge una sezione, basta creare la chiave con
il suo id: il render la prende da sé.

## Procedura, ogni mese

1. **Il mese da commentare è l'ultimo chiuso** per cui il booklet ha davvero i dati.
   Non è sempre il mese scorso: verifica sezione per sezione fin dove arriva `act`.
   Se una sezione si ferma prima, commenta il suo ultimo mese pieno e scrivilo in `base`.
2. **Usa solo i dati caricati nel booklet** (`act`, `act25`, `disdette`). Il booklet in
   pagina mostra Set–Dic dal vivo, ma quei valori non sono nel file: non si commenta
   quello che il file non porta, e non si va a prenderlo dalle API.
3. Per ogni sezione calcola il mese su entrambi gli assi: contro **lo stesso mese
   dell'anno prima** (`act25[m]`) e contro **i due mesi precedenti** (`act[m-1]`,
   `act[m-2]`). Dove un mese manca, dillo in `base` e scrivi `"n/d"` nella striscia.
4. Compila `andamento` scegliendo il KPI che racconta la sezione: quello su cui si
   decide, non il più grande. Il verdetto in `esito` deve poter essere smentito dai
   numeri che hai appena messo accanto.
5. Scrivi da 3 a 8 voci: almeno una `pos`, almeno una `neg`, e i `trend` che si vedono solo
   guardando la serie intera, non i due mesi. Ogni voce porta il suo numero.
6. **Metti la voce nuova in testa all'array**, non in fondo. Non toccare quelle vecchie:
   sono il verbale di come si leggeva il mese allora, anche se poi il dato è cambiato.
7. Aggiorna `scritto` con la data di stesura.

## Controlli prima di committare

```bash
python3 -c "import json;d=json.load(open('booklet/dati-booklet.json'));c=d['considerazioni'];
ids={s['id'] for s in d['sezioni']};assert set(c)<=ids;
print(sum(len(v) for v in c.values()),'voci in',len(c),'sezioni')"
```

- Ogni `mese` è `AAAA-MM`, ogni `t` è uno dei quattro valori.
- Le voci di una sezione sono in ordine decrescente di `mese`.
- I numeri citati esistono nel file: se un numero non è nel booklet, non va nella scheda.
