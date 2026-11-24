/* Quadro mese su mese e numero di pratiche dichiarato in welcome call.
   Sta in un file a parte, come bo-cerca.js: dashboard.js e' la copia identica
   dell'artefatto e va potuto risostituire. Si aggancia solo all'API pubblica dello
   shim (dash.calc / dash.draw / dash.data), registrando calcoli e disegni nuovi
   prima che bo-fonte.js chiami dash.start().

   IL NUMERO DI PRATICHE SI MOSTRA SOLO CLIENTE PER CLIENTE. Il foglio non ha una
   colonna col numero di pratiche affidate: "AFFIDATO PRATICHE" e' un si/no, e l'unico
   numero che compare - nella nota della welcome call - e' quante pratiche il cliente
   DICE DI AVERE, non quante ne ha poi affidate. Fino al 23 novembre 2026 da quel numero
   si ricavavano "Pratiche per cliente", mediana e "Dichiarate da": medie che sembravano
   misurare il lavoro affidato e invece misuravano una dichiarazione, spesso detta a voce
   e per approssimazione. Quelle sono state tolte. Qui il numero torna accanto al valore
   dichiarato, nella riga del singolo cliente, dove si legge per quello che e': una frase
   del cliente, attribuita a lui, verificabile nella nota che sta nella stessa riga.
   Nessuna somma e nessuna media: vanno fatte su dati che il foglio misura, non dichiara. */
(function () {
  'use strict';

  function norm(s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }

  /* "2 pratiche" -> 2; "una pratica da 16k" -> 1; "una quindicina di pratiche" -> niente,
     che e' diverso da 1 e diverso da 0: vuol dire che un numero non l'ha detto. Meglio una
     casella vuota che un numero inventato dal parser. */
  function nPratiche(nota) {
    var s = norm(nota);
    var m = s.match(/(\d+)\s*pratic/);
    if (m) return +m[1];
    if (/\b(?:una|un'|1)\s*pratica\b/.test(s)) return 1;
    return null;
  }

  /* Il calcolo "clienti" non porta con se' la nota della welcome call: il numero
     dichiarato lo ripesco da clienti_raw con la stessa chiave cliente+data che le
     tabelle usano come data-row-key. */
  function indiceNote(raw) {
    var map = {};
    raw.forEach(function (r) { map[r.cliente + '|' + r.data_attivazione] = nPratiche(r.nota_wc); });
    return map;
  }

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

  /* Le due liste di clienti riscritte con in piu' il numero dichiarato. Stesso filtro,
     stesso ordine, stesse chiavi di riga dell'originale: cambia solo la colonna. */
  dash.calc('sollecitare', {
    inputs: ['clienti', 'clienti_raw'],
    title: 'Clienti da sollecitare per l\'affido',
    description: 'Clienti che non hanno ancora affidato pratiche (esclusi i Radar senza pratiche), dal più vecchio, con numero e valore dichiarati in welcome call.',
    fn: function (clienti, raw) {
      var note = indiceNote(raw);
      return clienti
        .filter(function (c) { return c.stato_affido === 'Non affidato' || c.stato_affido === 'In attesa documenti'; })
        .sort(function (a, b) { return b.giorni - a.giorni; })
        .map(function (c) {
          return { agente: c.agente, cliente: c.cliente, data_attivazione: c.data_attivazione, giorni: c.giorni,
            n_dichiarate: note[c.cliente + '|' + c.data_attivazione],
            valore_dichiarato: c.valore_dichiarato,
            stato: c.nr ? 'Non risponde' : c.stato_affido, ultima_nota: c.ultima_nota };
        });
    }
  });

  dash.calc('followup', {
    inputs: ['clienti', 'clienti_raw'],
    title: 'Call 15 giorni mancanti',
    description: 'Clienti che hanno affidato, attivati da più di 15 giorni, senza prima call registrata, con numero e valore dichiarati in welcome call.',
    fn: function (clienti, raw) {
      var note = indiceNote(raw);
      return clienti
        .filter(function (c) { return c.stato_affido === 'Affidato' && c.giorni > 15 && c.call_15gg !== 'si'; })
        .sort(function (a, b) { return b.giorni - a.giorni; })
        .map(function (c) {
          return { agente: c.agente, cliente: c.cliente, data_attivazione: c.data_attivazione, giorni: c.giorni,
            n_dichiarate: note[c.cliente + '|' + c.data_attivazione],
            valore_dichiarato: c.valore_dichiarato, ultima_nota: c.ultima_nota };
        });
    }
  });

  // ---------- Formati ----------
  // dashboard.js tiene i suoi chiusi nella closure, ma espone window.boFmt: li riuso da li'
  // quando c'e', cosi' le colonne nuove si formattano come quelle vecchie.
  function fmt(nome, fallback) {
    return function (v) { var f = window.boFmt && window.boFmt[nome]; return (f || fallback)(v); };
  }
  var fInt = fmt('fInt', function (v) { return v == null ? '—' : String(Math.round(v)); });
  var fPct = fmt('fPct', function (v) { return v == null ? '—' : Math.round(v * 100) + '%'; });
  var fEur = fmt('fEur', function (v) { return v == null || v === 0 ? '—' : Math.round(v) + ' €'; });
  var fData = fmt('fData', function (v) { var p = String(v).split('-'); return p[2] + '/' + p[1] + '/' + p[0]; });

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

  /* I due disegni delle liste. L'originale sta dentro una closure insieme ai suoi listener
     sui pulsanti agente: quei listener restano e continuano a funzionare, perche' mettono
     aria-pressed e poi chiamano dash.draw, che ora esegue questo disegno. Quale agente sia
     selezionato lo leggo dal DOM invece di tenerne una copia mia, cosi' non ci sono due
     stati da tenere allineati. Il MutationObserver di bo-cerca.js vede comunque il tbody
     cambiare e riapplica la ricerca. */
  function agenteScelto(tabsId) {
    var b = document.querySelector('#' + tabsId + ' button[aria-pressed="true"]');
    return b ? (b.getAttribute('data-agente') || '') : '';
  }

  function lista(tabsId, nome, fonte, colonne) {
    dash.draw(nome, function (tb) {
      var s = dash.data(fonte);
      if (s.status !== 'ok' || !s.data) { tb.replaceChildren(); return; }
      var agente = agenteScelto(tabsId);
      var righe = s.data.filter(function (r) { return !agente || r.agente === agente; });
      tb.replaceChildren();
      righe.forEach(function (d) {
        var tr = document.createElement('tr');
        tr.setAttribute('data-key', encodeURIComponent(d.cliente) + ',' + encodeURIComponent(d.data_attivazione));
        colonne.forEach(function (f) {
          var c = f(d), td = document.createElement('td');
          if (c.cls) td.className = c.cls;
          if (c.pill) {
            var sp = document.createElement('span');
            sp.className = 'pill ' + (c.tone || '');
            sp.textContent = c.text;
            td.appendChild(sp);
          } else td.textContent = c.text;
          tr.appendChild(td);
        });
        tb.appendChild(tr);
      });
      if (!righe.length) {
        var vuota = document.createElement('tr'), td = document.createElement('td');
        td.colSpan = colonne.length;
        td.textContent = 'Nessun cliente per questo agente.';
        vuota.appendChild(td);
        tb.appendChild(vuota);
      }
    });
  }

  lista('tabs-soll', 'soll-rows', 'sollecitare', [
    function (d) { return { text: d.agente }; },
    function (d) { return { text: d.cliente, cls: 'cli' }; },
    function (d) { return { text: fData(d.data_attivazione) }; },
    function (d) { return { text: fInt(d.giorni), cls: 'num' }; },
    function (d) { return { text: fInt(d.n_dichiarate), cls: 'num' }; },
    function (d) { return { text: fEur(d.valore_dichiarato), cls: 'num' }; },
    function (d) { return { text: d.stato, pill: true, tone: d.stato === 'Non risponde' ? 'bad' : 'warn' }; },
    function (d) { return { text: d.ultima_nota || '—', cls: 'note' }; }
  ]);

  lista('tabs-fu', 'fu-rows', 'followup', [
    function (d) { return { text: d.agente }; },
    function (d) { return { text: d.cliente, cls: 'cli' }; },
    function (d) { return { text: fData(d.data_attivazione) }; },
    function (d) { return { text: fInt(d.giorni), cls: 'num' }; },
    function (d) { return { text: fInt(d.n_dichiarate), cls: 'num' }; },
    function (d) { return { text: fEur(d.valore_dichiarato), cls: 'num' }; },
    function (d) { return { text: d.ultima_nota || '—', cls: 'note' }; }
  ]);
})();
