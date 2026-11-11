(function () {
  // ---------- Loader: CSV del primo foglio (base64) → righe ----------
  dash.loader('clienti_raw', {
    description: 'Decodifica il CSV esportato da Google Drive e tiene solo le righe cliente (con data di attivazione).',
    fn: ({ answer }) => {
      if (!answer || typeof answer.content !== 'string') throw new Error('Il file non ha restituito contenuto CSV.');
      const bin = atob(answer.content);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const text = new TextDecoder('utf-8').decode(bytes);
      const rows = []; let row = [], cell = '', q = false;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (q) {
          if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
          else cell += c;
        } else if (c === '"') q = true;
        else if (c === ',') { row.push(cell); cell = ''; }
        else if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
        else if (c !== '\r') cell += c;
      }
      if (cell || row.length) { row.push(cell); rows.push(row); }
      const t = (s) => (s || '').trim();
      const out = [];
      for (const r of rows) {
        const m = t(r[3]).replace(/-/g, '/').match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
        if (!m || !t(r[1])) continue;
        let y = +m[3]; if (y < 100) y += 2000;
        const iso = `${y}-${String(+m[2]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`;
        out.push({
          agente: t(r[0]), cliente: t(r[1]), data_attivazione: iso,
          welcome_call: t(r[4]), nota_wc: t(r[5]), affidato: t(r[7]), servizio: t(r[8]),
          call_15gg: t(r[10]), note_15gg: t(r[11]), review_45gg: t(r[12]), note_45gg: t(r[13]),
          note_altre: t(r[16]), cross_selling: t(r[17]), up_selling: t(r[18])
        });
      }
      return out;
    }
  });

  // ---------- Calcoli ----------
  dash.calc('clienti', {
    inputs: ['clienti_raw'],
    title: 'Clienti classificati',
    description: 'Ogni cliente con stato della welcome call, dell\'affido, delle call 15/45 gg, giorni dall\'attivazione e valore dichiarato in WC.',
    fn: (righe) => {
      const oggi = new Date(); const oggiUTC = Date.UTC(oggi.getFullYear(), oggi.getMonth(), oggi.getDate());
      const mesi = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
      const valore = (nota) => {
        const s = (nota || '').toLowerCase(); let best = null;
        for (const m of s.matchAll(/(\d[\d.,]*)\s*(k|mila)?/g)) {
          const r = m[1].replace(/[.,]+$/, ''); let n;
          if (m[2]) n = parseFloat(r.replace(',', '.')) * 1000;
          else if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(r)) n = parseFloat(r.replace(/\./g, '').replace(',', '.'));
          else if (/^\d{1,3}(,\d{3})+(,\d{2})?$/.test(r)) { const p = r.split(','); if (p[p.length - 1].length === 2) p.pop(); n = parseFloat(p.join('')); }
          else if (/^\d+,\d{1,2}$/.test(r)) n = parseFloat(r.replace(',', '.'));
          else if (/^\d+\.\d{1,2}$/.test(r)) n = parseFloat(r);
          else n = parseFloat(r.replace(/[.,]/g, ''));
          if (n >= 300 && (best === null || n > best)) best = n;
        }
        return best;
      };
      const yn = (s) => { s = (s || '').trim().toLowerCase(); return s.startsWith('si') ? 'si' : s.startsWith('no') ? 'no' : s ? 'altro' : ''; };
      return righe.map((r) => {
        let ag = (r.agente || '').toUpperCase();
        ag = ag === 'MASSIMO' ? 'MASSIMILIANO' : ag;
        const agente = ag ? ag[0] + ag.slice(1).toLowerCase() : 'Non assegnato';
        const wc = (r.welcome_call || '').toLowerCase();
        const stato_wc = !wc ? 'Da fare' : wc.startsWith('ok') ? 'Riuscita' : 'Negativa';
        const note = [r.note_15gg, r.note_45gg, r.note_altre].filter(Boolean).join(' // ');
        const a = (r.affidato || '').toLowerCase();
        const affidatoDaNota = /(^|[\s.])affidato\b|ha affidato/.test(note.toLowerCase()) && !/non (ha )?affidato/.test(note.toLowerCase());
        let stato_affido;
        if (a.startsWith('si')) stato_affido = 'Affidato';
        else if (a.includes('radar')) stato_affido = 'Radar senza pratiche';
        else if (affidatoDaNota) stato_affido = 'Affidato';
        else if (a.includes('inviato') || a.includes('attesa')) stato_affido = 'In attesa documenti';
        else stato_affido = 'Non affidato';
        const [y, mo, d] = r.data_attivazione.split('-').map(Number);
        const giorni = Math.round((oggiUTC - Date.UTC(y, mo - 1, d)) / 86400000);
        const parti = note.split('//').map((x) => x.trim()).filter(Boolean);
        return {
          agente, cliente: r.cliente, data_attivazione: r.data_attivazione,
          mese: mesi[mo - 1], mese_ord: y * 100 + mo, giorni,
          stato_wc, stato_affido, servizio: r.servizio,
          call_15gg: yn(r.call_15gg), review_45gg: yn(r.review_45gg),
          valore_dichiarato: valore(r.nota_wc),
          ultima_nota: parti.length ? parti[parti.length - 1] : (r.nota_wc || ''),
          nr: /\bnr\b/i.test(note)
        };
      });
    }
  });

  dash.calc('kpi', {
    inputs: ['clienti'],
    title: 'Indicatori principali',
    description: 'Totali e tassi su tutti i clienti attivati.',
    fn: (clienti) => {
      const pct = (n, d) => (d ? n / d : null); 
      const conAffido = clienti.filter((c) => c.stato_affido !== 'Radar senza pratiche');
      const affidati = conAffido.filter((c) => c.stato_affido === 'Affidato').length;
      const i15 = clienti.filter((c) => c.giorni > 15 && c.stato_affido === 'Affidato');
      const i45 = clienti.filter((c) => c.giorni > 45 && c.stato_affido === 'Affidato');
      const soll = conAffido.filter((c) => c.stato_affido !== 'Affidato');
      return [{
        attivati: clienti.length,
        tasso_wc: pct(clienti.filter((c) => c.stato_wc === 'Riuscita').length, clienti.length),
        tasso_affido: pct(affidati, conAffido.length),
        copertura_15: pct(i15.filter((c) => c.call_15gg === 'si').length, i15.length),
        copertura_45: pct(i45.filter((c) => c.review_45gg === 'si').length, i45.length),
        da_sollecitare: soll.length,
        valore_da_sollecitare: d3.sum(soll, (c) => c.valore_dichiarato || 0),
        call15_mancanti: i15.filter((c) => c.call_15gg !== 'si').length
      }];
    }
  });

  dash.calc('funnel', {
    inputs: ['clienti'],
    title: 'Funnel post-vendita (clienti attivati da più di 45 giorni)',
    description: 'Quanti clienti superano ogni fase, sullo stesso gruppo di clienti.',
    fn: (clienti) => {
      const pct = (n, d) => (d ? n / d : null); 
      const g = clienti.filter((c) => c.giorni > 45 && c.stato_affido !== 'Radar senza pratiche');
      const wc = g.filter((c) => c.stato_wc === 'Riuscita');
      const aff = g.filter((c) => c.stato_affido === 'Affidato');
      const c15 = aff.filter((c) => c.call_15gg === 'si');
      const r45 = aff.filter((c) => c.review_45gg === 'si');
      const tot = g.length;
      return [
        { fase: 'Attivati', clienti: tot, quota: 1 },
        { fase: 'Welcome call riuscita', clienti: wc.length, quota: pct(wc.length, tot) },
        { fase: 'Pratiche affidate', clienti: aff.length, quota: pct(aff.length, tot) },
        { fase: 'Call 15 gg fatta', clienti: c15.length, quota: pct(c15.length, tot) },
        { fase: 'Review 45 gg fatta', clienti: r45.length, quota: pct(r45.length, tot) }
      ];
    }
  });

  dash.calc('mesi', {
    inputs: ['clienti'],
    title: 'Attivazioni e affidi per mese',
    description: 'Clienti attivati e clienti che hanno affidato, per mese di attivazione.',
    fn: (clienti) => { const pct = (n, d) => (d ? n / d : null); return d3.rollups(clienti, (v) => ({
      attivati: v.length,
      affidati: v.filter((c) => c.stato_affido === 'Affidato').length
    }), (c) => c.mese_ord).sort((a, b) => a[0] - b[0]).map(([ord, v]) => ({
      mese: ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'][(ord % 100) - 1],
      attivati: v.attivati, affidati: v.affidati, tasso_affido: pct(v.affidati, v.attivati)
    })); }
  });

  dash.calc('agenti', {
    inputs: ['clienti'],
    title: 'Indicatori per agente',
    description: 'Gli stessi indicatori principali, divisi per agente.',
    fn: (clienti) => { const pct = (n, d) => (d ? n / d : null); return d3.rollups(clienti, (v) => {
      const ca = v.filter((c) => c.stato_affido !== 'Radar senza pratiche');
      const i15 = v.filter((c) => c.giorni > 15 && c.stato_affido === 'Affidato');
      const i45 = v.filter((c) => c.giorni > 45 && c.stato_affido === 'Affidato');
      return {
        clienti: v.length,
        tasso_wc: pct(v.filter((c) => c.stato_wc === 'Riuscita').length, v.length),
        tasso_affido: pct(ca.filter((c) => c.stato_affido === 'Affidato').length, ca.length),
        copertura_15: pct(i15.filter((c) => c.call_15gg === 'si').length, i15.length),
        copertura_45: pct(i45.filter((c) => c.review_45gg === 'si').length, i45.length),
        non_affidati: ca.filter((c) => c.stato_affido !== 'Affidato').length
      };
    }, (c) => c.agente).map(([agente, v]) => ({ agente, ...v })).sort((a, b) => b.clienti - a.clienti); }
  });

  dash.calc('sollecitare', {
    inputs: ['clienti'],
    title: 'Clienti da sollecitare per l\'affido',
    description: 'Clienti che non hanno ancora affidato pratiche (esclusi i Radar senza pratiche), dal più vecchio.',
    fn: (clienti) => clienti
      .filter((c) => c.stato_affido === 'Non affidato' || c.stato_affido === 'In attesa documenti')
      .sort((a, b) => b.giorni - a.giorni)
      .map((c) => ({ agente: c.agente, cliente: c.cliente, data_attivazione: c.data_attivazione, giorni: c.giorni,
        valore_dichiarato: c.valore_dichiarato, stato: c.nr ? 'Non risponde' : c.stato_affido, ultima_nota: c.ultima_nota }))
  });

  dash.calc('followup', {
    inputs: ['clienti'],
    title: 'Call 15 giorni mancanti',
    description: 'Clienti che hanno affidato, attivati da più di 15 giorni, senza prima call registrata.',
    fn: (clienti) => clienti
      .filter((c) => c.stato_affido === 'Affidato' && c.giorni > 15 && c.call_15gg !== 'si')
      .sort((a, b) => b.giorni - a.giorni)
      .map((c) => ({ agente: c.agente, cliente: c.cliente, data_attivazione: c.data_attivazione, giorni: c.giorni,
        valore_dichiarato: c.valore_dichiarato, ultima_nota: c.ultima_nota }))
  });

  // ---------- Formati ----------
  const fPct = (v) => (v == null ? '—' : d3.format('.0%')(v));
  const fInt = (v) => (v == null ? '—' : d3.format(',')(v).replace(/,/g, '.'));
  const fEur = (v) => {
    if (v == null || v === 0) return '—';
    if (v >= 1e6) return (v / 1e6).toFixed(1).replace('.', ',') + ' mln €';
    return fInt(Math.round(v)) + ' €';
  };
  const fData = (iso) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
  window.boFmt = { fPct, fInt, fEur, fData };

  // ---------- Testi e tile ----------
  const kpiDraw = (name, field, fmt, tone) => dash.draw(name, (el) => {
    const k = dash.data('kpi');
    el.classList.toggle('dash-skeleton', k.status === 'loading');
    if (k.status !== 'ok' || !k.data || !k.data[0]) { el.textContent = '—'; return; }
    const v = k.data[0][field];
    el.textContent = fmt(v);
    if (tone) { el.classList.remove('bad', 'warn'); const t = tone(v); if (t) el.classList.add(t); }
  });
  kpiDraw('t-attivati', 'attivati', fInt);
  kpiDraw('t-tasso', 'tasso_affido', fPct);
  kpiDraw('t-rev', 'copertura_45', fPct);
  kpiDraw('t-soll', 'da_sollecitare', fInt);
  kpiDraw('k-attivati', 'attivati', fInt);
  kpiDraw('k-wc', 'tasso_wc', fPct, (v) => (v != null && v < 0.8 ? 'warn' : null));
  kpiDraw('k-affido', 'tasso_affido', fPct, (v) => (v != null && v < 0.8 ? 'warn' : null));
  kpiDraw('k-15', 'copertura_15', fPct, (v) => (v == null ? null : v < 0.5 ? 'bad' : v < 0.8 ? 'warn' : null));
  kpiDraw('k-45', 'copertura_45', fPct, (v) => (v == null ? null : v < 0.5 ? 'bad' : v < 0.8 ? 'warn' : null));
  kpiDraw('k-soll', 'da_sollecitare', fInt);
  kpiDraw('k-soll-val', 'valore_da_sollecitare', fEur);
  kpiDraw('fu-n', 'call15_mancanti', fInt);

  dash.draw('leg-aff', (el) => { el.style.background = dash.colors[0]; });

  // ---------- Tooltip ----------
  function tip(box) {
    let t = box.querySelector('.bo-tip');
    if (!t) { t = document.createElement('div'); t.className = 'bo-tip'; t.hidden = true; box.appendChild(t); }
    return {
      show(ev, text) { t.textContent = text; t.hidden = false; const r = box.getBoundingClientRect(); const x = (ev.touches ? ev.touches[0].clientX : ev.clientX) - r.left; const y = (ev.touches ? ev.touches[0].clientY : ev.clientY) - r.top; const w = t.offsetWidth; t.style.left = Math.max(0, Math.min(x + 12, box.clientWidth - w)) + 'px'; t.style.top = Math.max(0, y - 36) + 'px'; },
      hide() { t.hidden = true; }
    };
  }

  // ---------- Funnel ----------
  dash.draw('funnel-chart', (el) => {
    const s = dash.data('funnel');
    el.replaceChildren();
    if (s.status === 'error') { el.textContent = 'Caricamento non riuscito'; return; }
    if (s.status !== 'ok' || !s.data || !s.data.length) { el.textContent = '—'; el.classList.add('dash-skeleton'); return; }
    el.classList.remove('dash-skeleton');
    const data = s.data;
    const W = el.clientWidth || 360, rowH = 40, labW = Math.min(170, W * 0.42), H = data.length * rowH + 8;
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H)
      .attr('role', 'img').attr('aria-label', 'Funnel: ' + data.map((d) => `${d.fase} ${d.clienti}`).join(', '));
    const x = d3.scaleLinear().domain([0, data[0].clienti || 1]).range([0, W - labW - 90]);
    const g = svg.selectAll('g').data(data).join('g').attr('transform', (d, i) => `translate(0,${i * rowH + 4})`);
    g.append('text').attr('x', 0).attr('y', rowH / 2).attr('dy', '0.35em').text((d) => d.fase);
    g.append('rect').attr('x', labW).attr('y', 8).attr('height', rowH - 16).attr('rx', 3)
      .attr('width', (d) => Math.max(2, x(d.clienti)))
      .style('fill', (d, i) => (i === 0 ? 'var(--cds-chart-muted)' : dash.colors[0]));
    g.append('text').attr('class', 'lbl-strong').attr('x', (d) => labW + Math.max(2, x(d.clienti)) + 8)
      .attr('y', rowH / 2).attr('dy', '0.35em').text((d) => `${d.clienti} · ${fPct(d.quota)}`);
    const tt = tip(el);
    g.on('pointermove', (ev, d) => tt.show(ev, `${d.fase}: ${d.clienti} clienti (${fPct(d.quota)} degli attivati)`))
      .on('pointerleave', () => tt.hide());
  });

  // ---------- Mesi ----------
  dash.draw('mesi-chart', (el) => {
    const s = dash.data('mesi');
    el.replaceChildren();
    if (s.status === 'error') { el.textContent = 'Caricamento non riuscito'; return; }
    if (s.status !== 'ok' || !s.data || !s.data.length) { el.textContent = '—'; el.classList.add('dash-skeleton'); return; }
    el.classList.remove('dash-skeleton');
    const data = s.data;
    const W = el.clientWidth || 360, H = 220, m = { t: 22, r: 8, b: 26, l: 30 };
    const svg = d3.select(el).append('svg').attr('viewBox', `0 0 ${W} ${H}`).attr('height', H)
      .attr('role', 'img').attr('aria-label', 'Clienti attivati e affidati per mese: ' + data.map((d) => `${d.mese} ${d.attivati} attivati, ${d.affidati} affidati`).join('; '));
    const x0 = d3.scaleBand().domain(data.map((d) => d.mese)).range([m.l, W - m.r]).padding(0.25);
    const x1 = d3.scaleBand().domain(['attivati', 'affidati']).range([0, x0.bandwidth()]).padding(0.08);
    const y = d3.scaleLinear().domain([0, d3.max(data, (d) => d.attivati) || 1]).nice().range([H - m.b, m.t]);
    svg.append('g').attr('class', 'grid').attr('transform', `translate(${m.l},0)`)
      .call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.l - m.r)).tickPadding(6)).call((g) => g.select('.domain').remove());
    svg.append('g').attr('transform', `translate(0,${H - m.b})`).call(d3.axisBottom(x0).tickSize(0).tickPadding(8)).call((g) => g.select('.domain').remove());
    const tt = tip(el);
    const grp = svg.append('g').selectAll('g').data(data).join('g').attr('transform', (d) => `translate(${x0(d.mese)},0)`);
    grp.selectAll('rect').data((d) => [['attivati', d.attivati, d], ['affidati', d.affidati, d]]).join('rect')
      .attr('x', (k) => x1(k[0])).attr('width', x1.bandwidth()).attr('y', (k) => y(k[1])).attr('height', (k) => y(0) - y(k[1])).attr('rx', 2)
      .style('fill', (k) => (k[0] === 'attivati' ? 'var(--cds-chart-muted)' : dash.colors[0]))
      .on('pointermove', (ev, k) => tt.show(ev, `${k[2].mese}: ${k[2].attivati} attivati, ${k[2].affidati} affidati (${fPct(k[2].tasso_affido)})`))
      .on('pointerleave', () => tt.hide());
    grp.append('text').attr('class', 'lbl-strong').attr('x', x0.bandwidth() / 2).attr('text-anchor', 'middle')
      .attr('y', (d) => y(d.attivati) - 6).text((d) => fPct(d.tasso_affido));
  });

  // ---------- Tabelle ----------
  dash.draw('agenti-rows', (tb) => {
    const s = dash.data('agenti');
    if (s.status !== 'ok' || !s.data) { tb.replaceChildren(); return; }
    d3.select(tb).selectAll('tr').data(s.data, (d) => d.agente).join('tr').attr('data-key', (d) => encodeURIComponent(d.agente)).each(function (d) {
      const cells = [[d.agente, ''], [fInt(d.clienti), 'num'], [fPct(d.tasso_wc), 'num'], [fPct(d.tasso_affido), 'num'], [fPct(d.copertura_15), 'num'], [fPct(d.copertura_45), 'num'], [fInt(d.non_affidati), 'num']];
      d3.select(this).selectAll('td').data(cells).join('td').attr('class', (c) => c[1]).text((c) => c[0]);
    });
  });

  function makeFilterable(tabsId, drawName, sourceId, cols) {
    let agente = '';
    document.querySelectorAll(`#${tabsId} button`).forEach((b) => {
      b.addEventListener('click', () => {
        agente = b.getAttribute('data-agente') || '';
        document.querySelectorAll(`#${tabsId} button`).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        dash.draw(drawName);
      });
    });
    dash.draw(drawName, (tb) => {
      const s = dash.data(sourceId);
      if (s.status !== 'ok' || !s.data) { tb.replaceChildren(); return; }
      const rows = s.data.filter((r) => !agente || r.agente === agente);
      d3.select(tb).selectAll('tr').data(rows, (d) => d.cliente + '|' + d.data_attivazione).join('tr')
        .attr('data-key', (d) => encodeURIComponent(d.cliente) + ',' + encodeURIComponent(d.data_attivazione))
        .each(function (d) {
          d3.select(this).selectAll('td').data(cols.map((c) => c(d))).join('td').attr('class', (c) => c.cls || '')
            .each(function (c) {
              const td = d3.select(this);
              td.selectAll('*').remove();
              if (c.pill) { td.text(null); td.append('span').attr('class', 'pill ' + (c.tone || '')).text(c.text); }
              else td.text(c.text);
            });
        });
      if (!rows.length) {
        d3.select(tb).append('tr').append('td').attr('colspan', cols.length).text('Nessun cliente per questo agente.');
      }
    });
  }

  makeFilterable('tabs-soll', 'soll-rows', 'sollecitare', [
    (d) => ({ text: d.agente }),
    (d) => ({ text: d.cliente, cls: 'cli' }),
    (d) => ({ text: fData(d.data_attivazione) }),
    (d) => ({ text: fInt(d.giorni), cls: 'num' }),
    (d) => ({ text: fEur(d.valore_dichiarato), cls: 'num' }),
    (d) => ({ text: d.stato, pill: true, tone: d.stato === 'Non risponde' ? 'bad' : 'warn' }),
    (d) => ({ text: d.ultima_nota || '—', cls: 'note' })
  ]);

  makeFilterable('tabs-fu', 'fu-rows', 'followup', [
    (d) => ({ text: d.agente }),
    (d) => ({ text: d.cliente, cls: 'cli' }),
    (d) => ({ text: fData(d.data_attivazione) }),
    (d) => ({ text: fInt(d.giorni), cls: 'num' }),
    (d) => ({ text: fEur(d.valore_dichiarato), cls: 'num' }),
    (d) => ({ text: d.ultima_nota || '—', cls: 'note' })
  ]);
})();
