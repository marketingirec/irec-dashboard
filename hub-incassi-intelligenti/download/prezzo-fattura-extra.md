# Prezzo della fattura extra — Incassi Intelligenti

Oct 8, 2026 · @Irec Marketing

## Situazione attuale: i prezzi di oggi non spingono all'upgrade

Con 0,40 € a fattura extra, un mandante Value non ha mai convenienza a passare al Premium: arriva a 300 fatture pagando 129 € invece di 149 €.

| Piano | Credito attuale | Fatture extra perché convenga salire | Effetto |
| --- | --- | --- | --- |
| Entry | 0,50 € | 80 (180 totali) | Spinge, ma tardi: quasi al limite del Value |
| Value | 0,40 € | 150 (350 totali) | Non spinge mai: oltre le 300 fatture del Premium |
| Premium | 0,30 € | nessun piano superiore | La fattura extra costa meno di quella inclusa (0,50 €), proprio nel piano con le telefonate del credit manager |

### Quanto paga oggi il mandante a ogni volume di fatture

Con i prezzi attuali il Premium non è mai il piano più economico, nemmeno a 350 fatture al mese: il passaggio si giustifica solo con il credit manager dedicato, non con il costo. Importi in € al mese al netto di IVA: canone più fatture extra, senza l'1% (uguale in tutti i piani).

| Fatture al mese | Entry (0,50 € extra) | Value (0,40 € extra) | Premium (0,30 € extra) | Piano più conveniente |
| --- | --- | --- | --- | --- |
| 100 | 49 | 89 | 149 | Entry |
| 140 | 69 | 89 | 149 | Entry |
| 180 | 89 | 89 | 149 | Pari |
| 200 | 99 | 89 | 149 | Value |
| 250 | 124 | 109 | 149 | Value |
| 300 | 149 | 129 | 149 | Value |
| 350 | 174 | 149 | 164 | Value |

## La regola di calcolo

Il prezzo del credito è la differenza di canone con il piano superiore divisa per il numero di fatture extra oltre cui vogliamo che salire convenga. Ho fissato questo punto a circa metà del salto di volume (100 fatture fra un piano e l'altro).

```latex
\text{Prezzo credito} = \frac{\text{Canone piano superiore} - \text{Canone piano attuale}}{\text{Fatture extra di soglia}}
```

- **Entry → Value:** (89 − 49) / 40 = 1,00 €.
- **Value → Premium:** (149 − 89) / 50 = 1,20 €. La soglia è un po' più alta perché il salto di canone è maggiore (60 €).
- **Premium:** non c'è un piano sopra. Il credito deve coprire il lavoro del credit manager su ogni fattura in più, quindi deve costare più della fattura inclusa (149 / 300 = 0,50 €): 0,80 €.

Per spostare la soglia basta cambiare il denominatore: con 30 fatture il credito Entry diventa 1,33 € (spinta più forte), con 60 diventa 0,67 € (più tolleranza).

## Proposta

La fattura extra dovrebbe costare 1,00 € su Entry, 1,20 € su Value e 0,80 € su Premium, al netto di IVA. Con questi prezzi poche fatture extra costano poco, mentre oltre 40 (Entry) o 50 (Value) conviene passare al piano superiore.

| Piano | Canone (€/mese) | Fatture incluse | Credito attuale | Credito proposto | Conviene salire oltre |
| --- | --- | --- | --- | --- | --- |
| Entry | 49 | 100 | 0,50 € | **1,00 €** | 40 fatture extra (140 totali) |
| Value | 89 | 200 | 0,40 € | **1,20 €** | 50 fatture extra (250 totali) |
| Premium | 149 | 300 | 0,30 € | **0,80 €** | nessun piano sopra: oltre 50 extra per 2 mesi, piano su misura |

Ogni fattura extra consuma un credito, addebitato a fine mese insieme al canone. L'1% sugli importi effettivamente incassati non cambia e vale per tutti i piani.

## Quanto pagherebbe il mandante con la proposta

Con i crediti proposti il piano più economico cambia a 140 e a 250 fatture al mese, che è il momento in cui il Credit Advisor propone il passaggio. Gli importi sono canone più crediti, in € al mese al netto di IVA, senza l'1% (uguale in tutti i piani).

| Fatture al mese | Entry | Value | Premium | Piano più conveniente |
| --- | --- | --- | --- | --- |
| 100 | 49 | 89 | 149 | Entry |
| 120 | 69 | 89 | 149 | Entry: 20 crediti costano meno del salto |
| 140 | 89 | 89 | 149 | Pari: proporre Value |
| 160 | 109 | 89 | 149 | Value |
| 200 | 149 | 89 | 149 | Value |
| 220 | 169 | 113 | 149 | Value: 20 crediti costano meno del salto |
| 250 | 199 | 149 | 149 | Pari: proporre Premium |
| 300 | 249 | 209 | 149 | Premium |
| 350 | 299 | 269 | 189 | Premium, valutare un piano su misura |

## Come lo vede il mandante, e domande aperte

La card del piano in chat mostra già le fatture gestite e il costo extra del mese: basta aggiungere due avvisi per rendere visibile la soglia.

1. **All'80% delle fatture incluse:** "Hai usato 80 fatture su 100: dalla 101ª ognuna costa 1,00 €."
2. **Alla soglia di convenienza:** "Con 45 fatture extra paghi 94 €; con Value pagheresti 89 € e avresti anche WhatsApp", con il bottone "Parla con il credit manager".
3. **Passaggio di piano:** vale dal mese successivo; i crediti del mese in corso restano addebitati.

## Riepilogo finale: proposta validata

Prezzi validati della fattura extra: **1,50 € su Entry, 1,20 € su Value, 0,80 € su Premium**. Rispetto all'analisi sopra cambia solo l'Entry (da 1,00 € a 1,50 €): il passaggio al Value conviene già oltre 27 fatture extra (127 al mese) invece che oltre 40. Tutti gli importi sono **IVA esclusa**.

| Voce | Entry | Value | Premium |
| --- | --- | --- | --- |
| Abbonamento mensile | 49 €/mese | 89 €/mese | 149 €/mese |
| Fatture incluse | fino a 100 al mese | fino a 200 al mese | fino a 300 al mese |
| Costo fattura aggiuntiva | 1,50 € a fattura | 1,20 € a fattura | 0,80 € a fattura |
| Fee sull'incassato | 1% sugli importi effettivamente incassati | 1% sugli importi effettivamente incassati | 1% sugli importi effettivamente incassati |
| Conviene passare al piano superiore | oltre 27 fatture extra | oltre 50 fatture extra | piano su misura oltre 50 extra per 2 mesi |

Fatture aggiuntive e fee si addebitano a fine mese insieme all'abbonamento. Importi IVA esclusa.
