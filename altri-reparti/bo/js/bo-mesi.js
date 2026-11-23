/* Quadro mese su mese.
   Sta in un file a parte, come bo-cerca.js: dashboard.js e' la copia identica
   dell'artefatto e va potuto risostituire. Si aggancia solo all'API pubblica dello
   shim (dash.calc / dash.draw / dash.data), registrando calcoli e disegni nuovi
   prima che bo-fonte.js chiami dash.start().

   QUI NON SI CONTANO LE PRATICHE. Il foglio non ha una colonna col numero di pratiche
   affidate: "AFFIDATO PRATICHE" e' un si/no, e l'unico numero che compare - nella nota
   della welcome call - e' quante pratiche il cliente DICE DI AVERE, non quante ne ha poi
   affidate. Fino al 23 novembre 2026 questo file ne ricavava "Pratiche per cliente",
   mediana e "Dichiarate da": numeri che sembravano misurare il lavoro affidato e invece
   misuravano una dichiarazione, per di piu' solo di chi il numero l'aveva detto. Sono
   stati tolti. Resta l'affido come si/no, che il foglio lo dice davvero. */
(function () {
  'use strict';

  function perMese(clienti) {
    var per = {};
    clienti.forEach(function (c) {
      var k = c.mese_ord;
      if (!per[k]) per[k] = { mese_ord: k, mese: c.mese, attivati: 0, con_affido: 0, affidati: 0, da_sollecitare: 0 };
      var p = per[k];
      p.attivati++;
      if (c.stato_affido === 'Radar senza pratiche') return; // non devono affidare
      p.con_affido++;
      if (c.stato_affido === 'Affidato') p.affidati++;
      else p.da_sollecitare++;
    });
    return Object.keys(per).map(Number).sort(function (a, b) { return a - b; }).map(function (k) {
      var p = per[k];
      return {
        mese: p.mese, mese_ord: p.mese_ord, attivati: p.attivati, affidati: p.affidati,
        tasso_affido: p.con_affido ? p.affidati / p.con_affido : null,
        da_sollecitare: p.da_sollecitare
      };
    });
  }

  /* Il funnel chiamava la sua terza fase "Pratiche affidate", ma il numero sono CLIENTI
     che hanno affidato, non pratiche: il foglio le pratiche non le conta. Si riscrive qui
     invece che in dashboard.js perche' quello e' la copia identica dell'artefatto e va
     potuto risostituire; lo shim tiene l'ultima registrazione per ogni id, e questo file
     viene caricato dopo. Il resto del calcolo e' uguale all'originale. */
  dash.calc('funnel', {
    inputs: ['clienti'],
    title: 'Funnel post-vendita (clienti attivati da più di 45 giorni)',
    description: 'Quanti clienti superano ogni fase, sullo stesso gruppo di clienti.',
    fn: function (clienti) {
      var pct = function (n, d) { return d ? n / d : null; };
      var g = clienti.filter(function (c) { return c.giorni > 45 && c.stato_affido !== 'Radar senza pratiche'; });
      var wc = g.filter(function (c) { return c.stato_wc === 'Riuscita'; });
      var aff = g.filter(function (c) { return c.stato_affido === 'Affidato'; });
      var c15 = aff.filter(function (c) { return c.call_15gg === 'si'; });
      var r45 = aff.filter(function (c) { return c.review_45gg === 'si'; });
      var tot = g.length;
      return [
        { fase: 'Attivati', clienti: tot, quota: 1 },
        { fase: 'Welcome call riuscita', clienti: wc.length, quota: pct(wc.length, tot) },
        { fase: 'Hanno affidato', clienti: aff.length, quota: pct(aff.length, tot) },
        { fase: 'Call 15 gg fatta', clienti: c15.length, quota: pct(c15.length, tot) },
        { fase: 'Review 45 gg fatta', clienti: r45.length, quota: pct(r45.length, tot) }
      ];
    }
  });

  dash.calc('pratiche_mese', {
    inputs: ['clienti'],
    title: 'Quadro mese su mese',
    description: 'Per mese di attivazione: clienti attivati, quanti hanno affidato e quanti sono ancora da sollecitare.',
    fn: perMese
  });

  // ---------- Formati (quelli di dashboard.js sono chiusi nella sua closure) ----------
  function fInt(v) { return v == null ? '—' : String(Math.round(v)); }
  function fPct(v) { return v == null ? '—' : Math.round(v * 100) + '%'; }

  dash.draw('mesi-rows', function (tb) {
    var s = dash.data('pratiche_mese');
    if (s.status !== 'ok' || !s.data) { tb.replaceChildren(); return; }
    var celle = [
      function (d) { return [d.mese, '']; },
      function (d) { return [fInt(d.attivati), 'num']; },
      function (d) { return [fInt(d.affidati), 'num']; },
      function (d) { return [fPct(d.tasso_affido), 'num']; },
      function (d) { return [fInt(d.da_sollecitare), 'num']; }
    ];
    tb.replaceChildren();
    s.data.forEach(function (d) {
      var tr = document.createElement('tr');
      celle.forEach(function (f) {
        var v = f(d), td = document.createElement('td');
        if (v[1]) td.className = v[1];
        td.textContent = v[0];
        tr.appendChild(td);
      });
      tb.appendChild(tr);
    });
  });
})();
