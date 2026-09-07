#!/usr/bin/env python3
# Aggiorna la spesa Meta reale in index.html dalla Marketing API. Token in file gitignored:
#   .meta-token     -> IREC  (act_608295893328900, adset-level, esclude la frode Sales Adset 1/2/3)
#   .meta-token-rf  -> RF     (act_3120594051452791, account-level)
# Riscrive: IREC_META_REAL (12 mesi), RF_META_REAL (6 mesi Lug..Dic, null dove non c'e' spesa),
#           RF_ADV_META (6 mesi, 0 dove non c'e' spesa).
import json, re, subprocess, sys, os
import urllib.request, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, "index.html")
YEAR = 2026
GADS_VER = "v22"   # versione Google Ads API

# ---- Google Ads (OAuth). Credenziali in .google-ads-creds.json (gitignored). Account ad accesso DIRETTO
#      (nessun login-customer-id header, altrimenti 403). Ritorna 12 mesi (None dove non c'e' spesa). ----
def _gads_token(c):
    body = urllib.parse.urlencode({"client_id": c["client_id"], "client_secret": c["client_secret"],
                                   "refresh_token": c["refresh_token"], "grant_type": "refresh_token"}).encode()
    r = urllib.request.urlopen(urllib.request.Request("https://oauth2.googleapis.com/token", data=body,
        headers={"Content-Type": "application/x-www-form-urlencoded"}), timeout=30)
    return json.load(r)["access_token"]

def google_monthly(c, at, cid):
    gaql = {"query": "SELECT segments.month, metrics.cost_micros FROM customer WHERE segments.date BETWEEN '%d-01-01' AND '%d-12-31'" % (YEAR, YEAR)}
    req = urllib.request.Request("https://googleads.googleapis.com/%s/customers/%s/googleAds:search" % (GADS_VER, cid),
        data=json.dumps(gaql).encode(),
        headers={"Authorization": "Bearer " + at, "developer-token": c["developer_token"], "Content-Type": "application/json"})
    d = json.load(urllib.request.urlopen(req, timeout=60))
    out = [None] * 12
    for row in d.get("results", []):
        mi = int(row["segments"]["month"][5:7]) - 1
        if 0 <= mi < 12:
            out[mi] = round((out[mi] or 0.0) + int(row["metrics"].get("costMicros", 0)) / 1e6, 2)
    return out

def read_token(name):
    return open(os.path.join(HERE, name)).read().strip()

def fetch(account, token, level):
    fields = "spend,adset_name" if level == "adset" else "spend"
    args = [
        "curl", "-sG", f"https://graph.facebook.com/v20.0/{account}/insights",
        "--data-urlencode", f"fields={fields}",
        "--data-urlencode", f"level={level}",
        "--data-urlencode", "time_range=" + json.dumps({"since": f"{YEAR}-01-01", "until": f"{YEAR}-12-31"}),
        "--data-urlencode", "time_increment=monthly",
        "--data-urlencode", "limit=500",
        "--data-urlencode", f"access_token={token}",
    ]
    out = subprocess.run(args, capture_output=True, text=True, timeout=60).stdout
    return json.loads(out)

def fmt(vals):
    return "[" + ",".join("null" if v is None else repr(v) for v in vals) + "]"

def replace_arr(html, varname, arr):
    pat = r"var " + re.escape(varname) + r"\s*=\s*\[[^\]]*\];"
    if not re.search(pat, html):
        print(f"ERRORE: riga {varname} non trovata"); sys.exit(1)
    return re.sub(pat, f"var {varname} = {arr};", html, count=1)  # ok anche se il valore e' invariato (idempotente)

def main():
    html = open(INDEX, encoding="utf-8").read()

    # --- IREC: adset-level, esclude la frode rimborsata ---
    FRAUD = {"Sales Adset 1", "Sales Adset 2", "Sales Adset 3"}
    d = fetch("act_608295893328900", read_token(".meta-token"), "adset")
    if "data" not in d:
        print("ERRORE Meta IREC:", json.dumps(d)[:300]); sys.exit(1)
    irec = [None] * 12
    for row in d["data"]:
        if row.get("adset_name") in FRAUD:
            continue
        mi = int(row["date_start"][5:7]) - 1
        if 0 <= mi < 12:
            irec[mi] = round((irec[mi] or 0.0) + float(row.get("spend", 0)), 2)
    html = replace_arr(html, "IREC_META_REAL", fmt(irec))

    # --- RF: account-level, 12 mesi Gen..Dic -> indici 0..11 ---
    d2 = fetch("act_3120594051452791", read_token(".meta-token-rf"), "account")
    if "data" not in d2:
        print("ERRORE Meta RF:", json.dumps(d2)[:300]); sys.exit(1)
    rf = [None] * 12
    for row in d2["data"]:
        mi = int(row["date_start"][5:7]) - 1
        if 0 <= mi < 12:
            rf[mi] = round((rf[mi] or 0.0) + float(row.get("spend", 0)), 2)
    html = replace_arr(html, "RF_META_REAL", fmt(rf))
    html = replace_arr(html, "RF_ADV_META", fmt([0 if v is None else v for v in rf]))

    # --- Google Ads: IREC (Irec-Allcore) + RF (RintraccioFacile.it) ---
    gpath = os.path.join(HERE, ".google-ads-creds.json")
    if os.path.exists(gpath):
        try:
            gc = json.load(open(gpath))
            at = _gads_token(gc)
            g_irec = google_monthly(gc, at, gc["accounts"]["IREC"])   # 12 mesi
            g_rf = google_monthly(gc, at, gc["accounts"]["RF"])         # 12 mesi Gen..Dic
            html = replace_arr(html, "IREC_GOOGLE_REAL", fmt(g_irec))
            html = replace_arr(html, "RF_GOOGLE_REAL", fmt(g_rf))
            html = replace_arr(html, "RF_ADV_GOOGLE", fmt([0 if v is None else v for v in g_rf]))
            print("IREC_GOOGLE_REAL =", fmt(g_irec))
            print("RF_GOOGLE_REAL   =", fmt(g_rf))
        except Exception as e:
            print("ATTENZIONE Google Ads non aggiornato:", str(e)[:200])
    else:
        print("Google Ads: .google-ads-creds.json assente, salto.")

    open(INDEX, "w", encoding="utf-8").write(html)
    print("IREC_META_REAL =", fmt(irec))
    print("RF_META_REAL    =", fmt(rf))

if __name__ == "__main__":
    main()
