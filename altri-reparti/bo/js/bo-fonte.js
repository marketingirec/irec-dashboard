/*
 * Sorgente dati della pagina BO.
 *
 * Nel progetto originale i dati stavano in data/data.js: il CSV del foglio in base64,
 * rigenerato a mano con scripts/aggiorna_dati.py. Qui quel file non c'e' e non ci puo'
 * stare: il repo e' pubblico e il foglio contiene nomi di clienti e referenti. La pagina
 * chiede quindi il CSV a /api/bo-pratiche, che lo legge dal foglio Google al momento.
 * Due conseguenze volute: i numeri sono sempre quelli del foglio, senza passaggi manuali,
 * e il link del foglio resta in una variabile d'ambiente su Vercel.
 *
 * Si riaggiorna da solo ogni 4 ore e col tasto Aggiorna in alto a destra. L'API sta dietro
 * la cache della CDN (5 minuti), percio' un aggiornamento forzato porta un parametro
 * sempre diverso: la cache e' per URL, cosi' si va davvero a rileggere il foglio.
 *
 * dash-shim.js legge window.BO_DATASETS, percio' basta riempirlo prima di dash.start().
 */
(function () {
  var OGNI = 4 * 60 * 60 * 1000;           // 4 ore
  var avviso = document.getElementById('bo-avviso');
  var stato = document.getElementById('bo-stato');
  var tasto = document.getElementById('bo-aggiorna');
  var avviata = false;
  var ultima = 0;
  var inCorso = false;

  function dillo(testo, errore) {
    if (!avviso) return;
    if (!testo) { avviso.hidden = true; return; }
    avviso.hidden = false;
    avviso.className = errore ? 'err' : '';
    avviso.textContent = testo;
  }

  function dataIt(iso) {
    return iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso.split('-').reverse().join('/') : iso;
  }

  function segnaOra(letto) {
    if (!stato) return;
    var ora = new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    stato.textContent = letto ? ('· foglio letto il ' + dataIt(letto) + ', alle ' + ora)
                              : ('· aggiornato alle ' + ora);
  }

  function mostra(letto) {
    dillo(null);
    segnaOra(letto);
    ultima = Date.now();
    if (!avviata) { avviata = true; dash.start(); } else { dash.refresh(); }
  }

  function carica(forzato) {
    if (inCorso) return;
    inCorso = true;
    if (tasto) { tasto.disabled = true; tasto.textContent = 'Aggiorno…'; }
    if (!avviata) dillo('Carico i dati dal foglio…', false);

    /* Si legge come testo e si prova a interpretarlo: se l'API non c'e' arriva una pagina
       HTML di errore, e un JSON.parse fallito darebbe un messaggio incomprensibile. */
    fetch('/api/bo-pratiche?t=' + Date.now(), {
      headers: { Accept: 'application/json' },
      cache: forzato ? 'no-store' : 'default'
    })
      .then(function (r) {
        return r.text().then(function (t) {
          var j = null;
          try { j = JSON.parse(t); } catch (e) { j = null; }
          return { ok: r.ok, stato: r.status, j: j };
        });
      })
      .then(function (x) {
        if (!x.j) {
          throw new Error('/api/bo-pratiche non ha risposto in JSON (HTTP ' + x.stato +
            "). Aprendo la pagina in locale è normale: l'API esiste solo sul deploy.");
        }
        if (!x.ok) throw new Error(x.j.error || ('HTTP ' + x.stato));
        window.BO_DATASETS = { clienti_raw: x.j };
        mostra(x.j.letto);
      })
      .catch(function (e) {
        /* Se un aggiornamento fallisce ma la pagina ha gia' dei dati, si tengono quelli:
           meglio numeri di qualche ora fa che una pagina svuotata. */
        dillo((avviata ? "Aggiornamento non riuscito, resta l'ultima lettura. " : 'Dati non disponibili: ')
          + ((e && e.message) || e), true);
      })
      .then(function () {
        inCorso = false;
        if (tasto) { tasto.disabled = false; tasto.textContent = 'Aggiorna'; }
      });
  }

  if (tasto) tasto.addEventListener('click', function () { carica(true); });

  /* Sviluppo in locale: se qualcuno mette un data/data.js accanto alla pagina e lo carica
     prima di questo file, quello vince e l'API non viene nemmeno chiamata. */
  if (window.BO_DATASETS && window.BO_DATASETS.clienti_raw) { mostra(null); return; }

  carica(false);
  setInterval(function () { carica(true); }, OGNI);
  /* I timer nelle schede in secondo piano vengono rallentati dal browser: se la pagina
     resta aperta e la si ritrova dopo mezza giornata, al rientro si ricontrolla. */
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && ultima && Date.now() - ultima > OGNI) carica(true);
  });
})();
