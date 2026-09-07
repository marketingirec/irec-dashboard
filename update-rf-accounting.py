#!/usr/bin/env python3
# Importa il fatturato RF dalla CONTABILITA' (file account.move .xlsx) e lo scrive in index.html.
# La contabilita' e' la fonte di verita': fatturato riconosciuto alla data di pagamento completato.
#
# Uso:  python3 update-rf-accounting.py "<file account.move .xlsx>" <mese 7..12>
#   es: python3 update-rf-accounting.py "~/Downloads/Registrazione contabile (account.move).xlsx" 8
#
# Il file .xlsx deve avere: col A "Nota interna" (online/offline), col B "Imponibile con segno",
# col C tag "partner" per gli ordini partner. Ogni file = un mese.
#
# Aggiorna: rf-accounting.json (accumulatore per mese), poi rigenera nel index.html:
#   var RF_ACC={...}  +  i seed RF_ONLINE/RF_OFFLINE/RF_ORD_OFFLINE (idx mese-7)
#   +  RF_AND12.online/offline/ordOffline (idx mese-1).
import sys, os, re, json

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, "index.html")
STORE = os.path.join(HERE, "rf-accounting.json")

def read_xlsx(path):
    try:
        import openpyxl
    except ImportError:
        os.system(sys.executable + " -m pip install --quiet openpyxl")
        import openpyxl
    wb = openpyxl.load_workbook(os.path.expanduser(path), data_only=True, read_only=True)
    ws = wb.worksheets[0]
    rows = list(ws.iter_rows(values_only=True))[1:]  # salta header
    online = offline = partner = 0.0
    n_on = n_off = n_part = 0
    for r in rows:
        nota = (str(r[0]).strip().lower() if r[0] else "")
        imp = r[1] or 0
        tag = (str(r[2]).strip().lower() if len(r) > 2 and r[2] else "")
        if imp == 0:
            continue
        if tag == "partner":
            partner += imp; n_part += 1
        elif nota == "online":
            online += imp; n_on += 1
        elif nota == "offline":
            offline += imp; n_off += 1
    rnd = lambda x: round(x, 2)
    return {"online": rnd(online), "offline": rnd(offline), "partner": rnd(partner),
            "ordOnline": n_on, "ordOffline": n_off, "ordPartner": n_part}

def num(v):
    # 3826.0 -> "3826", 585.3 -> "585.3"
    return str(int(v)) if float(v) == int(v) else str(v)

def set_array_elem(html, varname, idx, value):
    # sostituisce l'elemento idx (0-based) dell'array literal `var varname ... =[...];`
    pat = re.compile(r"(var\s+" + re.escape(varname) + r"\s*=\s*\[)([^\]]*)(\];)")
    m = pat.search(html)
    if not m:
        print("  ! array non trovato:", varname); return html
    elems = [e.strip() for e in m.group(2).split(",")]
    while len(elems) <= idx: elems.append("0")
    elems[idx] = num(value)
    return html[:m.start()] + m.group(1) + ",".join(elems) + m.group(3) + html[m.end():]

def set_and12_row(html, key, idx, value):
    # RF_AND12 riga es. `online:  [..],`  -> sostituisce elemento idx
    pat = re.compile(r"(\b" + re.escape(key) + r":\s*\[)([^\]]*)(\])")
    m = pat.search(html)
    if not m:
        print("  ! RF_AND12 riga non trovata:", key); return html
    elems = [e.strip() for e in m.group(2).split(",")]
    while len(elems) <= idx: elems.append("0")
    elems[idx] = num(value)
    return html[:m.start()] + m.group(1) + ",".join(elems) + m.group(3) + html[m.end():]

def build_rf_acc(store):
    parts = []
    for mo in sorted(store, key=int):
        i = int(mo) - 7
        if i < 0 or i > 5:
            continue
        d = store[mo]
        parts.append("{}:{{online:{},offline:{},partner:{},ordOnline:{},ordOffline:{},ordPartner:{}}}".format(
            i, num(d["online"]), num(d["offline"]), num(d["partner"]),
            d["ordOnline"], d["ordOffline"], d["ordPartner"]))
    return "var RF_ACC={ " + ", ".join(parts) + " };"

def main():
    if len(sys.argv) < 3:
        print("Uso: python3 update-rf-accounting.py <file.xlsx> <mese 7..12>"); sys.exit(1)
    xlsx, month = sys.argv[1], int(sys.argv[2])
    if not (7 <= month <= 12):
        print("Mese RF ammesso: 7..12 (Lug..Dic)"); sys.exit(1)
    vals = read_xlsx(xlsx)
    total = round(vals["online"] + vals["offline"] + vals["partner"], 2)
    print("Mese {}: online {} / offline {} / partner {}  =  TOTALE {}".format(
        month, vals["online"], vals["offline"], vals["partner"], total))

    store = json.load(open(STORE)) if os.path.exists(STORE) else {}
    store[str(month)] = vals
    json.dump(store, open(STORE, "w"), indent=2, ensure_ascii=False)

    html = open(INDEX, encoding="utf-8").read()
    # 1) rigenera var RF_ACC={...}
    html = re.sub(r"var RF_ACC=\{[^;]*\};", build_rf_acc(store), html, count=1)
    # 2) seed principali (idx = mese-7)
    i = month - 7
    html = set_array_elem(html, "RF_ONLINE", i, vals["online"])
    html = set_array_elem(html, "RF_OFFLINE", i, vals["offline"])
    html = set_array_elem(html, "RF_PARTNER", i, vals["partner"])
    html = set_array_elem(html, "RF_ORD_OFFLINE", i, vals["ordOffline"])
    html = set_array_elem(html, "RF_ORD_PARTNER", i, vals["ordPartner"])
    # 3) Andamento RF_AND12 (idx = mese-1)
    j = month - 1
    html = set_and12_row(html, "online", j, vals["online"])
    html = set_and12_row(html, "offline", j, vals["offline"])
    html = set_and12_row(html, "ordOffline", j, vals["ordOffline"])

    open(INDEX, "w", encoding="utf-8").write(html)
    print("index.html aggiornato. RF_ACC ora contiene i mesi:", ",".join(sorted(store, key=int)))
    print("Ricordati di ripubblicare l'artefatto (stesso url).")

if __name__ == "__main__":
    main()
