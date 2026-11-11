/*
 * dash-shim.js — implementazione minima dell'API `dash` usata da dashboard.js,
 * così la dashboard gira in un normale browser, senza la piattaforma Claude.
 *
 * Supporta: dash.loader, dash.calc, dash.draw, dash.data, dash.onData,
 * dash.colors, dash.setLink, dash.params/setParams/resetParams, dash.refresh.
 *
 * Fonte dati: window.BO_DATASETS = { <id dataset>: <risposta del connettore> }
 * generato da scripts/aggiorna_dati.py dentro data/data.js.
 */
(function () {
  const loaders = {};
  const calcs = {};
  const draws = {};
  const listeners = [];
  const cache = {};
  let params = {};

  function compute(id) {
    if (id in cache) return cache[id];
    let res;
    try {
      if (calcs[id]) {
        const c = calcs[id];
        const inputs = c.inputs.map((i) => {
          const r = compute(i);
          if (r.status !== 'ok') throw new Error(`Input "${i}" non disponibile: ${r.message || r.status}`);
          return r.data;
        });
        res = { status: 'ok', data: c.fn(...inputs) };
      } else if (window.BO_DATASETS && id in window.BO_DATASETS) {
        const answer = window.BO_DATASETS[id];
        const data = loaders[id] ? loaders[id].fn({ answer, args: {}, call: null, read: {} }) : answer;
        res = { status: 'ok', data };
      } else {
        res = { status: 'missing', data: [], message: `Dataset "${id}" mancante` };
      }
    } catch (e) {
      console.error(`[dash] ${id}:`, e);
      res = { status: 'error', data: calcs[id] ? null : [], message: e.message };
    }
    if (Array.isArray(res.data) && res.data.length && typeof res.data[0] === 'object') {
      res.data.columns = Object.keys(res.data[0]);
    }
    res.refreshing = false;
    res.meta = [];
    cache[id] = res;
    return res;
  }

  function runDraw(name) {
    const fn = draws[name];
    if (!fn) return;
    document.querySelectorAll(`[data-draw="${name}"]`).forEach((el) => {
      try { fn(el); } catch (e) { console.error(`[dash] draw ${name}:`, e); }
    });
  }

  function runAll() {
    listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } });
    Object.keys(draws).forEach(runDraw);
  }

  const css = getComputedStyle(document.documentElement);
  const series = ['--chart-1', '--chart-2', '--chart-3', '--chart-4'];

  window.dash = {
    colors: series.map((v) => `var(${v})`),
    loader(id, opts) { loaders[id] = opts; },
    calc(id, opts) { calcs[id] = opts; },
    data(id) { return compute(id); },
    onData(fn) { listeners.push(fn); fn(); },
    draw(name, fn) {
      if (typeof fn === 'function') { draws[name] = fn; return; }
      if (fn && typeof fn === 'object' && fn.update) {
        const made = new WeakMap();
        draws[name] = (el) => {
          if (!made.has(el)) made.set(el, fn.mount ? fn.mount(el) : undefined);
          fn.update(el, made.get(el));
        };
        return;
      }
      if (started) runDraw(name);
    },
    refresh() { Object.keys(cache).forEach((k) => delete cache[k]); runAll(); },
    params() { return { ...params }; },
    setParams(p) { params = { ...params, ...p }; runAll(); },
    resetParams() { params = {}; runAll(); },
    setLink(name) { if (name) history.replaceState(null, '', '#' + name); },
    start() {
      started = true;
      runAll();
      let w = window.innerWidth, t;
      window.addEventListener('resize', () => {
        clearTimeout(t);
        t = setTimeout(() => { if (window.innerWidth !== w) { w = window.innerWidth; runAll(); } }, 150);
      });
    }
  };
  let started = false;
  void css;
})();
