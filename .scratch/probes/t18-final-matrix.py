#!/usr/bin/env python3
"""Sonde T18 — matrice finale des fixes clés (fresh DB, chaîne complète).

Usage: python3 t18-final-matrix.py <base_url> <db_path>
Exemple: python3 t18-final-matrix.py http://127.0.0.1:8091 /tmp/orchestrate/pb-fresh-t18/data.db

Couvre : ORD-1, REC-2, LOCK-1, SEC-2, REC-1, REC-5, REC-3, join-event
(contributors/expiresAt/maxUses, spot-check T8), lookup-user (T8),
teamdocs team-scopé (T10).

Asserts durs : toute étape FAIL => exit 1. Teardown best-effort en finally.
"""
import json
import subprocess
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8091"
DB = sys.argv[2] if len(sys.argv) > 2 else "/tmp/orchestrate/pb-fresh-t18/data.db"
PASSWORD = "t18-Probe!2026"

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


def sql_count(table, where):
    return int(sql("SELECT count(*) FROM %s WHERE %s;" % (table, where)))


def step(name, ok, detail=""):
    results.append((name, ok, detail))
    log(("OK  " if ok else "FAIL") + " | " + name + (" | " + detail if detail else ""))
    return ok


def register(email):
    st, r = api("POST", "/api/collections/users/records", body={
        "email": email, "password": PASSWORD, "passwordConfirm": PASSWORD, "name": email.split("@")[0],
    })
    assert st == 200, "register %s -> %s %s" % (email, st, json.dumps(r))
    st2, a = api("POST", "/api/collections/users/auth-with-password", body={
        "identity": email, "password": PASSWORD,
    })
    assert st2 == 200, "auth %s -> %s %s" % (email, st2, a)
    return a["record"]["id"], a["token"]


def crud(method, coll, path="", token=None, body=None):
    return api(method, "/api/collections/%s/records%s" % (coll, path), token, body)


created = {"users": [], "teams": [], "events": [], "other": []}


def track(kind, rid):
    created[kind].append(rid)


def teardown():
    log("--- teardown best-effort ---")
    for rid in created["events"]:
        st, _ = crud("DELETE", "events", "/" + rid, ALICE[1])
        log("del event %s -> %s" % (rid, st))
    for rid in created["teams"]:
        st, _ = crud("DELETE", "teams", "/" + rid, ALICE[1])
        log("del team %s -> %s" % (rid, st))
    for rid in created["other"]:
        for coll in ("teamdocs", "share_links", "locks", "notifications", "recipes"):
            st, _ = crud("DELETE", coll, "/" + rid, ALICE[1])
            if st == 204:
                log("del %s %s -> %s" % (coll, rid, st))
                break
    for uid, tok in created["users"]:
        st, _ = api("DELETE", "/api/collections/users/records/" + uid, tok)
        log("del user %s -> %s" % (uid, st))


try:
    # --- 0. Fresh DB vide ---
    empties = {c: sql_count(c, "1=1") for c in
               ("users", "teams", "events", "recipes", "products", "locks", "share_links", "notifications", "teamdocs")}
    step("fresh DB vide au départ", all(v == 0 for v in empties.values()), json.dumps(empties))

    # --- 1. Users de test ---
    alice_id, alice_tok = register("t18-alice@test.local")
    bob_id, bob_tok = register("t18-bob@test.local")
    carol_id, carol_tok = register("t18-carol@test.local")
    ALICE = (alice_id, alice_tok)
    created["users"] = [(alice_id, alice_tok), (bob_id, bob_tok), (carol_id, carol_tok)]
    step("register/auth 3 users", True)

    # --- 2. ORD-1 mort : products list (auth) -> 200 ---
    st, r = crud("GET", "products", token=alice_tok)
    ok = st == 200 and r.get("totalItems") == 0
    step("ORD-1 mort : products list (auth) -> 200 vide", ok, "%s %s" % (st, r.get("totalItems")))

    # --- 3. REC-2 : recipes list anonyme -> 200 (public read) ---
    st, r = api("GET", "/api/collections/recipes/records")
    ok = st == 200 and r.get("totalItems") == 0
    step("REC-2 : recipes list anonyme -> 200 vide", ok, "%s %s" % (st, r.get("totalItems")))

    # --- 4. Setup REC-3 : team + recipe partagée permissionWrite ---
    st, ta = crud("POST", "teams", token=alice_tok, body={"name": "t18-team-a", "members": [alice_id, bob_id], "createdBy": alice_id})
    step("create team (alice, members=[alice,bob])", st == 200, str(st))
    team_a = ta["id"]; track("teams", team_a)

    st, rec = crud("POST", "recipes", token=alice_tok, body={
        "title": "t18-recipe-shared", "status": "private",
        "createdBy": alice_id, "permissionWrite": [bob_id],
    })
    step("create recipe (createdBy=alice, permissionWrite=[bob])", st == 200, str(st))
    rec_id = rec["id"]; track("other", rec_id)

    # --- 5. REC-3 : update par collaborateur permissionWrite ---
    st, r = crud("PATCH", "recipes", "/" + rec_id, bob_tok, {"title": "t18-recipe-upd-by-bob"})
    step("REC-3 : bob update via permissionWrite -> 200", st == 200, str(st))
    st, r = crud("PATCH", "recipes", "/" + rec_id, carol_tok, {"title": "t18-recipe-upd-by-carol"})
    step("REC-3 neg : carol (ni owner ni permissionWrite) -> 404", st == 404, str(st))

    # --- 6. LOCK-1 : create id custom 17 chars ---
    lock_body = {
        "id": "doc_test123456789", "userId": alice_id, "userName": "t18-alice",
        "expiresAt": "2026-10-07 00:00:00.000Z", "collection": "recipes", "recordId": rec_id,
    }
    st, r = crud("POST", "locks", token=alice_tok, body=lock_body)
    ok = st == 200 and r.get("id") == "doc_test123456789"
    step("LOCK-1 mort : locks create id doc_test123456789 -> 200", ok, str(st))
    lock_id = r.get("id", ""); track("other", lock_id)

    # --- 7. SEC-2 : create avec userId d'un tiers -> 400 règle ---
    spoof = dict(lock_body)
    spoof["id"] = "doc_spoof12345678"
    spoof["userId"] = bob_id
    st, r = crud("POST", "locks", token=alice_tok, body=spoof)
    ok = st == 400 and r.get("data") == {}
    step("SEC-2 : locks create userId=tiers (spoof alice->bob) -> 400 data:{}", ok, "%s %s" % (st, json.dumps(r.get("data", {}))))

    # --- 8. REC-1 : share_links list (tiers) -> vide ; create createdBy tiers -> 400 ---
    st, r = crud("GET", "share_links", token=bob_tok)
    ok = st == 200 and r.get("totalItems") == 0
    step("REC-1 : bob list share_links (aucun sien) -> 200 vide", ok, "%s %s" % (st, r.get("totalItems")))
    st, r = crud("POST", "share_links", token=alice_tok, body={
        "link_type": "event", "target_id": "t18-no-event-yet", "createdBy": bob_id, "isActive": True,
    })
    ok = st == 400 and r.get("data") == {}
    step("REC-1 : share_links create createdBy=tiers -> 400 data:{}", ok, "%s %s" % (st, json.dumps(r.get("data", {}))))

    # --- 9. REC-5 : notifications create userId tiers -> 400 ; soi -> 200 ---
    st, r = crud("POST", "notifications", token=alice_tok, body={
        "userId": bob_id, "type": "t18", "title": "t18", "message": "m", "link": "/events/x", "data": {},
    })
    ok = st == 400 and r.get("data") == {}
    step("REC-5 : notifications create userId=tiers -> 400 data:{}", ok, "%s %s" % (st, json.dumps(r.get("data", {}))))
    st, r = crud("POST", "notifications", token=alice_tok, body={
        "userId": alice_id, "type": "t18", "title": "t18", "message": "m", "link": "/events/x", "data": {},
    })
    step("REC-5 pos : notifications create userId=soi -> 200", st == 200, str(st))
    track("other", r.get("id", ""))

    # --- 10. Setup join-event : 3 events + 3 liens ---
    links = {}
    for suffix, extra in (("a", {}), ("b", {"expiresAt": "2020-01-01 00:00:00.000Z"}), ("c", {"maxUses": 1})):
        st, ev = crud("POST", "events", token=alice_tok, body={
            "name": "t18-event-" + suffix, "teams": [team_a], "createdBy": alice_id,
            "status": "confirmed", "date": [],
        })
        step("create event %s" % suffix, st == 200, str(st))
        ev_id = ev["id"]; track("events", ev_id)
        st, lk = crud("POST", "share_links", token=alice_tok, body=dict(
            {"link_type": "event", "target_id": ev_id, "createdBy": alice_id, "isActive": True}, **extra))
        step("create link %s %s" % (suffix, sorted(extra.keys())), st == 200, str(st))
        links[suffix] = {"event": ev_id, "link": lk["id"]}

    # --- 11. Join-event pos : bob rejoint event a ---
    st, r = api("POST", "/api/enka/join-event", bob_tok, {"linkId": links["a"]["link"]})
    ok = st == 200 and r.get("eventId") == links["a"]["event"]
    step("join-event : bob join link a -> 200 {eventId}", ok, "%s %s" % (st, json.dumps(r)))
    st, r = crud("GET", "events", "/" + links["a"]["event"], alice_tok)
    guest_ok = bob_id in (r.get("guestUsers") or [])
    contrib = [c for c in (r.get("contributors") or []) if c.get("id") == bob_id]
    contrib_ok = len(contrib) == 1 and contrib[0].get("status") == "accepted" and contrib[0].get("email") == "t18-bob@test.local"
    step("join-event : guestUsers=[bob] + contributor accepted", guest_ok and contrib_ok,
         "guestUsers=%s contrib=%s" % (r.get("guestUsers"), json.dumps(contrib)))
    st, r = crud("GET", "share_links", "/" + links["a"]["link"], alice_tok)
    step("join-event : useCount incrémenté (1)", r.get("useCount") == 1, "useCount=%s" % r.get("useCount"))

    # --- 12. Join-event : expiresAt passé -> 400 ---
    st, r = api("POST", "/api/enka/join-event", carol_tok, {"linkId": links["b"]["link"]})
    step("join-event : lien expiré -> 400", st == 400, "%s %s" % (st, json.dumps(r)))

    # --- 13. Join-event : maxUses épuisé -> 400 ---
    st, r = api("POST", "/api/enka/join-event", alice_tok, {"linkId": links["c"]["link"]})
    step("join-event : maxUses=1 premier join -> 200", st == 200, str(st))
    st, r = api("POST", "/api/enka/join-event", bob_tok, {"linkId": links["c"]["link"]})
    ok = st == 400 and "limite" in json.dumps(r)
    step("join-event : maxUses épuisé -> 400 limite", ok, "%s %s" % (st, json.dumps(r)))

    # --- 14. lookup-user pos/neg ---
    st, r = api("GET", "/api/enka/lookup-user?email=t18-alice@test.local", bob_tok)
    ok = st == 200 and r.get("id") == alice_id
    step("lookup-user : email connu -> 200 {id,name}", ok, "%s %s" % (st, json.dumps(r)))
    st, r = api("GET", "/api/enka/lookup-user?email=inconnu@test.local", bob_tok)
    step("lookup-user : email inconnu -> 404", st == 404, str(st))
    st, r = api("GET", "/api/enka/lookup-user?email=t18-alice@test.local")
    step("lookup-user : sans auth -> 401", st == 401, str(st))

    # --- 15. teamdocs team-scopé (T10) ---
    st, r = crud("POST", "teamdocs", token=bob_tok, body={
        "teamId": team_a, "title": "t18-td-team", "status": "doc", "content": "x",
    })
    step("teamdocs team-scopé create (bob membre, sans eventId) -> 200", st == 200, str(st))
    td_id = r.get("id", ""); track("other", td_id)
    st, r = crud("GET", "teamdocs", token=bob_tok)
    ok = st == 200 and any(i["id"] == td_id for i in r.get("items", []))
    step("teamdocs team-scopé list (bob voit son doc)", ok, "total=%s" % r.get("totalItems"))
    st, r = crud("POST", "teamdocs", token=carol_tok, body={
        "teamId": team_a, "title": "t18-td-neg", "status": "doc", "content": "x",
    })
    ok = st == 400 and r.get("data") == {}
    step("teamdocs team-scopé create (carol non-membre) -> 400 data:{}", ok, "%s %s" % (st, json.dumps(r.get("data", {}))))

finally:
    teardown()

    final = {c: sql_count(c, "1=1") for c in
             ("users", "teams", "events", "recipes", "products", "locks", "share_links", "notifications", "teamdocs")}
    log("final SQL: " + json.dumps(final))
    step("comptes finaux = 0 partout (fresh DB restaurée)", all(v == 0 for v in final.values()), json.dumps(final))

failed = [r for r in results if not r[1]]
log("=== %d/%d OK ===" % (len(results) - len(failed), len(results)))
sys.exit(1 if failed else 0)
