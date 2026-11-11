/* Ricerca testuale sulla tabella "Clienti da sollecitare per l'affido".
   Sta in un file a parte, e non dentro dashboard.js, perche' quel file e' la copia
   identica dell'artefatto: va potuto risostituire senza perdere questa aggiunta.
   Per lo stesso motivo non si aggancia al codice che disegna la tabella (e' chiuso in
   una closure) ma guarda il tbody: a ogni ridisegno - cambio agente, Aggiorna, refresh
   automatico - il filtro si riapplica da solo. */
(function () {
  'use strict';

  // "Però" e "PERO" devono trovarsi a vicenda: via accenti e maiuscole.
  function norm(s) {
    return String(s == null ? '' : s)
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/\s+/g, ' ').trim();
  }

  function collega(opt) {
    var input = document.getElementById(opt.input);
    var esito = document.getElementById(opt.esito);
    var tb = document.querySelector(opt.tbody);
    if (!input || !tb) return;

    var mio = false; // le mie modifiche non devono rilanciare l'observer

    function filtra() {
      var q = norm(input.value);
      var righe = tb.querySelectorAll('tr');
      var tot = 0, visti = 0, i, tr, dati;
      mio = true;
      for (i = 0; i < righe.length; i++) {
        tr = righe[i];
        // la riga "Nessun cliente per questo agente." ha una sola cella in colspan:
        // non e' un cliente, la lascio gestire a chi disegna la tabella
        dati = tr.children.length > 1;
        if (dati) tot++;
        if (!q) { tr.style.removeProperty('display'); if (dati) visti++; continue; }
        if (dati && norm(tr.textContent).indexOf(q) >= 0) { tr.style.removeProperty('display'); visti++; }
        else tr.style.display = 'none';
      }
      mio = false;

      if (esito) {
        if (!q) esito.textContent = tot ? tot + (tot === 1 ? ' cliente' : ' clienti') : '';
        else if (visti) esito.textContent = visti + ' su ' + tot;
        else esito.textContent = 'Nessun cliente trovato.';
      }
    }

    input.addEventListener('input', filtra);
    new MutationObserver(function () { if (!mio) filtra(); })
      .observe(tb, { childList: true, subtree: true, characterData: true });
    filtra();
  }

  function avvia() {
    collega({ input: 'soll-cerca', esito: 'soll-cerca-esito', tbody: '#sollecitare tbody[data-draw="soll-rows"]' });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', avvia);
  else avvia();
})();
