# Booklet — Considerazioni mensili

Ogni sezione del booklet chiude con una scheda **Considerazioni**: il commento del mese
appena concluso, confrontato con il mese precedente e con lo stesso mese dell'anno prima.
Lo storico resta: la voce più recente è aperta, quelle vecchie stanno sotto, in «Storico».

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

## Sezioni che hanno la scheda

`mkt-irec`, `ff-irec`, `tmk`, `cust-care`, `yoy-irec` (IREC) e `ff-rf`, `yoy-rf` (RF).
Per aggiungerne un'altra basta creare la chiave con il suo id: il render la prende da sé.

## Procedura, ogni mese

1. **Il mese da commentare è l'ultimo chiuso** per cui il booklet ha davvero i dati.
   Non è sempre il mese scorso: verifica sezione per sezione fin dove arriva `act`.
   Se una sezione si ferma prima, commenta il suo ultimo mese pieno e scrivilo in `base`.
2. **Usa solo i dati caricati nel booklet** (`act`, `act25`, `disdette`). Il booklet in
   pagina mostra Set–Dic dal vivo, ma quei valori non sono nel file: non si commenta
   quello che il file non porta, e non si va a prenderlo dalle API.
3. Per ogni sezione calcola il mese contro **il mese precedente** (`act[m-1]`) e contro
   **lo stesso mese dell'anno prima** (`act25[m]`). Dove uno dei due manca, dillo in `base`.
4. Scrivi da 3 a 8 voci: almeno una `pos`, almeno una `neg`, e i `trend` che si vedono solo
   guardando la serie intera, non i due mesi. Ogni voce porta il suo numero.
5. **Metti la voce nuova in testa all'array**, non in fondo. Non toccare quelle vecchie:
   sono il verbale di come si leggeva il mese allora, anche se poi il dato è cambiato.
6. Aggiorna `scritto` con la data di stesura.

## Controlli prima di committare

```bash
python3 -c "import json;d=json.load(open('booklet/dati-booklet.json'));c=d['considerazioni'];
ids={s['id'] for s in d['sezioni']};assert set(c)<=ids;
print(sum(len(v) for v in c.values()),'voci in',len(c),'sezioni')"
```

- Ogni `mese` è `AAAA-MM`, ogni `t` è uno dei quattro valori.
- Le voci di una sezione sono in ordine decrescente di `mese`.
- I numeri citati esistono nel file: se un numero non è nel booklet, non va nella scheda.
