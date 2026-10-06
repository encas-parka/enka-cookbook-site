#!/usr/bin/env python3
"""Sonde F2 — gardes d'identité au create (events, recipes, teams, materiel).

Usage: python3 f2-rules-matrix.py <base_url> <db_path>
Exemple: python3 f2-rules-matrix.py http://127.0.0.1:8091 /tmp/orchestrate/pb_data-bootcheck-f2/data.db

Par collection : create avec createdBy d'un tiers => 400 (rejet de règle,
data {}), avec le sien => 200. Asserts durs : toute étape FAIL => exit 1.
Teardown best-effort en finally (records + users self-delete).
"""
import json
import subprocess
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8091"
DB = sys.argv[2] if len(sys.argv) > 2 else "/tmp/orchestrate/pb_data-bootcheck-f2/data.db"
PASSWORD = "f2-Probe!2026"

results = []


def log(msg):
    print(msg, flush=True)


def api(method, path, token=None, body=None):
    req = urllib.request.Request(BASE + path, method=method)
    req.add_header("Content-Type", "application/json")
    if token:
        req.add_header("Authorization", token)
    data = json.dumps(body).encode() if body is not None else None
    try:
        with urllib.request.urlopen(req, data=data) as r:
            raw = r.read().decode()
            return r.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as e:
        raw = e.read().decode()
        try:
            return e.code, json.loads(raw)
        except json.JSONDecodeError:
            return e.code, {"raw": raw}


def sql(query):
    out = subprocess.run(
        ["sqlite3", "-readonly", DB, query],
        capture_output=True, text=True, check=True,
    )
    return out.stdout.strip()


def step(name, ok, detail=""):
    results.append((name, ok, detail))
    log(("%s OK  " if ok else "%s FAIL") % name + ((" — " + detail) if detail else ""))


def register_and_auth(email):
    body = {"email": email, "password": PASSWORD, "passwordConfirm": PASSWORD}
    api("POST", "/api/collections/users/records", body=body)
    st, auth = api("POST", "/api/collections/users/auth-with-password",
                   body={"identity": email, "password": PASSWORD})
    assert st == 200, "auth %s -> %s %s" % (email, st, auth)
    return auth["token"], auth["record"]["id"]


alice_token, alice_id = register_and_auth("f2-alice@test.local")
bob_token, bob_id = register_and_auth("f2-bob@test.local")
log("alice=%s bob=%s" % (alice_id, bob_id))

created = {"events": [], "recipes": [], "materiel": [], "teams": []}

try:
    # events -----------------------------------------------------------------
    st, resp = api("POST", "/api/collections/events/records", token=bob_token,
                   body={"name": "f2-evt-spoof", "createdBy": alice_id,
                         "date": [], "dateStart": None, "dateEnd": None})
    step("events create createdBy=tiers -> 400 data:{}", st == 400 and resp.get("data") == {},
         "%s %s" % (st, resp))

    st, resp = api("POST", "/api/collections/events/records", token=bob_token,
                   body={"name": "f2-evt-ok", "createdBy": bob_id,
                         "date": [], "dateStart": None, "dateEnd": None})
    step("events create createdBy=soi -> 200", st == 200, "%s" % st)
    if st == 200:
        created["events"].append(resp["id"])
        step("events createdBy persiste", resp.get("createdBy") == bob_id, str(resp.get("createdBy")))

    # recipes ----------------------------------------------------------------
    st, resp = api("POST", "/api/collections/recipes/records", token=bob_token,
                   body={"title": "f2-recipe-spoof", "createdBy": alice_id,
                         "status": "private"})
    step("recipes create createdBy=tiers -> 400 data:{}", st == 400 and resp.get("data") == {},
         "%s %s" % (st, resp))

    st, resp = api("POST", "/api/collections/recipes/records", token=bob_token,
                   body={"title": "f2-recipe-ok", "createdBy": bob_id,
                         "status": "private"})
    step("recipes create createdBy=soi -> 200", st == 200, "%s" % st)
    if st == 200:
        created["recipes"].append(resp["id"])
        step("recipes createdBy persiste", resp.get("createdBy") == bob_id, str(resp.get("createdBy")))

    # teams ------------------------------------------------------------------
    st, resp = api("POST", "/api/collections/teams/records", token=bob_token,
                   body={"name": "f2-team-spoof", "createdBy": alice_id,
                         "members": [bob_id]})
    step("teams create createdBy=tiers -> 400 data:{}", st == 400 and resp.get("data") == {},
         "%s %s" % (st, resp))

    st, resp = api("POST", "/api/collections/teams/records", token=bob_token,
                   body={"name": "f2-team-ok", "createdBy": bob_id,
                         "members": [bob_id]})
    step("teams create createdBy=soi -> 200", st == 200, "%s" % st)
    if st == 200:
        created["teams"].append(resp["id"])
        step("teams createdBy persiste", resp.get("createdBy") == bob_id, str(resp.get("createdBy")))

    # materiel ---------------------------------------------------------------
    st, resp = api("POST", "/api/collections/materiel/records", token=bob_token,
                   body={"name": "f2-mat-spoof", "quantity": 1, "createdBy": alice_id,
                         "ownerUser": bob_id, "deleted": False, "isStorage": False})
    step("materiel create createdBy=tiers -> 400 data:{}", st == 400 and resp.get("data") == {},
         "%s %s" % (st, resp))

    st, resp = api("POST", "/api/collections/materiel/records", token=bob_token,
                   body={"name": "f2-mat-ok", "quantity": 1, "createdBy": bob_id,
                         "ownerUser": bob_id, "deleted": False, "isStorage": False})
    step("materiel create createdBy=soi -> 200", st == 200, "%s" % st)
    if st == 200:
        created["materiel"].append(resp["id"])
        step("materiel createdBy persiste", resp.get("createdBy") == bob_id, str(resp.get("createdBy")))

    # La deleteRule du créateur s'applique désormais (F1 : le client envoie createdBy)
    for table, ids in created.items():
        for rid in ids:
            st, _ = api("DELETE", "/api/collections/%s/records/%s" % (table, rid), token=bob_token)
            step("%s delete par createur -> 204" % table, st == 204, "%s" % st)
            if st == 204:
                ids.remove(rid)
                break
        created[table] = [i for i in ids]

finally:
    for table, ids in created.items():
        for rid in ids:
            api("DELETE", "/api/collections/%s/records/%s" % (table, rid), token=bob_token)
    for token, uid, email in ((alice_token, alice_id, "f2-alice@test.local"), (bob_token, bob_id, "f2-bob@test.local")):
        st_del, resp_del = api("DELETE", "/api/collections/users/records/%s" % uid, token=token)
        log("teardown user %s -> %s" % (email, st_del))

    resid = sql("SELECT count(*) FROM events WHERE name LIKE 'f2-%'")
    resid += sql("SELECT count(*) FROM recipes WHERE title LIKE 'f2-%'")
    resid += sql("SELECT count(*) FROM materiel WHERE name LIKE 'f2-%'")
    resid += sql("SELECT count(*) FROM teams WHERE name LIKE 'f2-%'")
    users = sql("SELECT count(*) FROM users WHERE email LIKE 'f2-%'")
    log("Résidus post-teardown : records=%s users=%s" % (resid, users))

failed = [r for r in results if not r[1]]
log("\n=== %d/%d OK ===" % (len(results) - len(failed), len(results)))
sys.exit(1 if failed else 0)
