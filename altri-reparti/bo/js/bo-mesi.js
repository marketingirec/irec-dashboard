/* Pratiche per cliente e quadro mese su mese.
   Sta in un file a parte, come bo-cerca.js: dashboard.js e' la copia identica
   dell'artefatto e va potuto risostituire. Si aggancia solo all'API pubblica dello
   shim (dash.calc / dash.draw / dash.data), registrando calcoli e disegni nuovi
   prima che bo-fonte.js chiami dash.start().

   ATTENZIONE AL DATO. Il foglio non ha una colonna con il numero di pratiche
   affidate: la colonna "AFFIDATO PRATICHE" e' un si/no. L'unico posto dove il
   numero compare e' la nota della welcome call ("2 pratiche", "10 pratiche circa"),
   quindi quella che si misura qui e' la media delle pratiche DICHIARATE IN WC dai
   clienti che poi hanno affidato - non quelle davvero caricate, e solo per chi il
   numero l'ha detto (circa sei su dieci). Per questo accanto alla media c'e' la
   mediana: basta un "200 pratiche circa" scritto in nota per gonfiare la media di
   un mese intero. */
(function () {
  'use strict';

  var MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

  // "2 pratiche" -> 2; "pratica da 16k" -> 1; nessun cenno alle pratiche -> niente,
  // che e' diverso da zero: vuol dire che non lo sappiamo.
  function nPratiche(nota) {
    var s = String(nota == null ? '' : nota);
    var m = s.match(/(\d+)\s*pratic/i);
    if (m) return +m[1];
    return /pratic/i.test(s) ? 1 : null;
  }

  function mediana(v) {
    if (!v.length) return null;
    var a = v.slice().sort(function (x, y) { return x - y; });
    var h = a.length >> 1;
    return a.length % 2 ? a[h] : (a[h - 1] + a[h]) / 2;
  }

  // clienti (classificati) non porta con se' la nota della welcome call, che invece
  // serve per il numero di pratiche: la riprendo da clienti_raw con la stessa
  // chiave cliente+data usata dalle tabelle.
  function conNota(clienti, raw) {
    var map = {};
    raw.forEach(function (r) { map[r.cliente + '|' + r.data_attivazione] = r.nota_wc; });
    return clienti.map(function (c) {
      return { c: c, n: nPratiche(map[c.cliente + '|' + c.data_attivazione]) };
    });
  }

  function perMese(clienti, raw) {
    var righe = conNota(clienti, raw), per = {};
    righe.forEach(function (x) {
      var k = x.c.mese_ord;
      if (!per[k]) per[k] = { mese_ord: k, mese: x.c.mese, attivati: 0, con_affido: 0, affidati: 0, da_sollecitare: 0, numeri: [] };
      var p = per[k];
      p.attivati++;
      if (x.c.stato_affido === 'Radar senza pratiche') return; // non devono affidare
      p.con_affido++;
      if (x.c.stato_affido === 'Affidato') { p.affidati++; if (x.n != null) p.numeri.push(x.n); }
      else p.da_sollecitare++;
    });
    return Object.keys(per).map(Number).sort(function (a, b) { return a - b; }).map(function (k) {
      var p = per[k], n = p.numeri.length, somma = 0;
      p.numeri.forEach(function (v) { somma += v; });
      return {
        mese: p.mese, mese_ord: p.mese_ord, attivati: p.attivati, affidati: p.affidati,
        tasso_affido: p.con_affido ? p.affidati / p.con_affido : null,
        pratiche_media: n ? somma / n : null,
        pratiche_mediana: mediana(p.numeri),
        dichiarate_da: n,
        da_sollecitare: p.da_sollecitare
      };
    });
  }

  dash.calc('pratiche_mese', {
    inputs: ['clienti', 'clienti_raw'],
    title: 'Quadro mese su mese',
    description: 'Per mese di attivazione: clienti attivati, quanti hanno affidato, pratiche per cliente dichiarate in welcome call e clienti ancora da sollecitare.',
    fn: perMese
  });

  dash.calc('pratiche_kpi', {
    inputs: ['clienti', 'clienti_raw'],
    title: 'Pratiche per cliente',
    description: 'Media e mediana delle pratiche dichiarate in welcome call dai clienti che hanno affidato.',
    fn: function (clienti, raw) {
      var numeri = [], affidati = 0, somma = 0;
      conNota(clienti, raw).forEach(function (x) {
        if (x.c.stato_affido !== 'Affidato') return;
        affidati++;
        if (x.n != null) { numeri.push(x.n); somma += x.n; }
      });
      return [{
        media: numeri.length ? somma / numeri.length : null,
        mediana: mediana(numeri),
        dichiarate_da: numeri.length,
        affidati: affidati
      }];
    }
  });

  // ---------- Formati (quelli di dashboard.js sono chiusi nella sua closure) ----------
  function fInt(v) { return v == null ? '—' : String(Math.round(v)); }
  function fDec(v) { return v == null ? '—' : v.toFixed(1).replace('.', ','); }
  function fPct(v) { return v == null ? '—' : Math.round(v * 100) + '%'; }

  function uno(id) { var s = dash.data(id); return (s.status === 'ok' && s.data && s.data[0]) ? s.data[0] : null; }

  dash.draw('k-prat', function (el) {
    var k = uno('pratiche_kpi');
    el.textContent = k ? fDec(k.media) : '—';
  });

  dash.draw('k-prat-nota', function (el) {
    var k = uno('pratiche_kpi');
    el.textContent = k && k.dichiarate_da
      ? 'Mediana ' + fDec(k.mediana) + ' · dichiarate da ' + k.dichiarate_da + ' dei ' + k.affidati + ' che hanno affidato'
      : '—';
  });

  dash.draw('mesi-rows', function (tb) {
    var s = dash.data('pratiche_mese');
    if (s.status !== 'ok' || !s.data) { tb.replaceChildren(); return; }
    var celle = [
      function (d) { return [d.mese, '']; },
      function (d) { return [fInt(d.attivati), 'num']; },
      function (d) { return [fInt(d.affidati), 'num']; },
      function (d) { return [fPct(d.tasso_affido), 'num']; },
      function (d) { return [fDec(d.pratiche_media), 'num']; },
      function (d) { return [fDec(d.pratiche_mediana), 'num']; },
      function (d) { return [fInt(d.dichiarate_da), 'num']; },
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
