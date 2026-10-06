#!/usr/bin/env python3
"""Sonde T10 — cascade deletes (HOOK-4/HOOK-5/C10) + teamdocs team-scopé + invite-to-team roles.

Usage: python3 t10-cascade-matrix.py <base_url> <db_path>
Exemple: python3 t10-cascade-matrix.py http://127.0.0.1:8090 pocketbase/pb_data/data.db

Asserts durs : toute étape FAIL => exit 1. Teardown best-effort en finally.
"""
import json
import subprocess
import sys
import urllib.error
import urllib.request

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8090"
DB = sys.argv[2] if len(sys.argv) > 2 else "pocketbase/pb_data/data.db"
PASSWORD = "t10-Probe!2026"

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
    if st != 200:
        log("register %s -> %s (%s) — user préexistant ?" % (email, st, json.dumps(r.get("data", {}))))
    st2, a = api("POST", "/api/collections/users/auth-with-password", body={
        "identity": email, "password": PASSWORD,
    })
    assert st2 == 200, "auth %s -> %s %s" % (email, st2, a)
    uid = a["record"]["id"] if "record" in a else r.get("id")
    return uid, a["token"]


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
        for coll in ("teamdocs", "share_links", "materiel_loan", "materiel", "notifications", "products", "purchases", "event_materiel", "event_todos"):
            st, _ = crud("DELETE", coll, "/" + rid, ALICE[1])
            if st == 204:
                log("del %s %s -> %s" % (coll, rid, st))
                break
    for uid, tok in created["users"]:
        st, _ = api("DELETE", "/api/collections/users/records/" + uid, tok)
        log("del user %s -> %s" % (uid, st))


try:
    baseline = {
        "events": sql_count("events", "1=1"),
        "teams": sql_count("teams", "1=1"),
        "users": sql_count("users", "1=1"),
        "materiel": sql_count("materiel", "1=1"),
        "materiel_loan": sql_count("materiel_loan", "1=1"),
        "notifications": sql_count("notifications", "1=1"),
        "share_links": sql_count("share_links", "1=1"),
        "teamdocs": sql_count("teamdocs", "1=1"),
    }
    log("baseline SQL: " + json.dumps(baseline))

    # --- 1. Users ---
    alice_id, alice_tok = register("t10-alice@test.local")
    bob_id, bob_tok = register("t10-bob@test.local")
    carol_id, carol_tok = register("t10-carol@test.local")
    ALICE = (alice_id, alice_tok)
    created["users"] = [(alice_id, alice_tok), (bob_id, bob_tok), (carol_id, carol_tok)]
    step("register/auth 3 users", True)

    # --- 2. Teams ---
    st, ta = crud("POST", "teams", token=alice_tok, body={"name": "t10-team-a", "members": [alice_id], "createdBy": alice_id})
    step("create T10A", st == 200, str(st))
    team_a = ta["id"]; track("teams", team_a)
    st, tb = crud("POST", "teams", token=alice_tok, body={"name": "t10-team-b", "members": [alice_id, bob_id], "createdBy": alice_id})
    step("create T10B", st == 200, str(st))
    team_b = tb["id"]; track("teams", team_b)
    st, tc = crud("POST", "teams", token=alice_tok, body={"name": "t10-team-c", "members": [alice_id], "createdBy": alice_id})
    step("create T10C", st == 200, str(st))
    team_c = tc["id"]; track("teams", team_c)

    # --- 3. Events ---
    st, e1 = crud("POST", "events", token=alice_tok, body={"name": "t10-event-1", "teams": [team_a], "createdBy": alice_id, "status": "confirmed", "date": []})
    step("create E1 (teams=[A])", st == 200, str(st))
    ev1 = e1["id"]; track("events", ev1)
    st, e2 = crud("POST", "events", token=alice_tok, body={"name": "t10-event-2", "teams": [team_a, team_b], "createdBy": alice_id, "status": "confirmed", "date": []})
    step("create E2 (teams=[A,B])", st == 200, str(st))
    ev2 = e2["id"]; track("events", ev2)
    st, e3 = crud("POST", "events", token=alice_tok, body={"name": "t10-event-3", "teams": [team_b], "createdBy": alice_id, "status": "confirmed", "date": []})
    step("create E3 (teams=[B])", st == 200, str(st))
    ev3 = e3["id"]; track("events", ev3)

    # --- 4. Children of E1 ---
    st, r = crud("POST", "products", token=alice_tok, body={"eventId": ev1, "productName": "t10-product", "updatedBy": alice_id})
    step("E1 product", st == 200, str(st)); track("other", r["id"])
    st, r = crud("POST", "purchases", token=alice_tok, body={"eventId": ev1, "unit": "kg", "quantity": 1, "createdBy": alice_id})
    step("E1 purchase", st == 200, str(st)); track("other", r["id"])
    st, r = crud("POST", "event_materiel", token=alice_tok, body={"eventId": ev1, "name": "t10-em", "createdBy": alice_id})
    step("E1 event_materiel", st == 200, str(st)); track("other", r["id"])
    st, r = crud("POST", "event_todos", token=alice_tok, body={"eventId": ev1, "task": "t10-todo", "assignedTo": alice_id})
    step("E1 event_todo", st == 200, str(st)); track("other", r["id"])
    st, r = crud("POST", "teamdocs", token=alice_tok, body={"eventId": ev1, "teamId": team_a, "title": "t10-td-event", "status": "doc", "content": "x"})
    step("E1 teamdoc (event-scopé)", st == 200, str(st)); track("other", r["id"])
    st, r = crud("POST", "share_links", token=alice_tok, body={"link_type": "event", "target_id": ev1, "createdBy": alice_id, "isActive": True})
    step("E1 share_link", st == 200, str(st)); track("other", r["id"])
    st, r = crud("POST", "materiel_loan", token=alice_tok, body={"eventId": ev1, "ownerId": team_a, "responsibleId": alice_id, "borrowerUser": alice_id, "createdBy": alice_id, "startDate": "2026-10-06 00:00:00.000Z", "eventName": "t10-e1"})
    step("E1 loan (eventId+ownerId=A)", st == 200, str(st)); track("other", r["id"])
    st, r = crud("POST", "notifications", token=alice_tok, body={"userId": alice_id, "type": "t10", "title": "t10", "message": "m", "link": "/events/" + ev1, "data": {"eventId": ev1}})
    step("E1 notification (match)", st == 200, str(st)); track("other", r["id"])
    st, r = crud("POST", "notifications", token=alice_tok, body={"userId": alice_id, "type": "ctrl", "title": "ctrl", "message": "m", "link": "/recipes/xyz", "data": {"other": "1"}})
    step("notification contrôle (no match)", st == 200, str(st)); track("other", r["id"])

    # --- 5. Children of T10B ---
    st, r = crud("POST", "materiel", token=alice_tok, body={"name": "t10-mat", "teamId": team_b, "ownerUser": alice_id, "createdBy": alice_id})
    step("T10B materiel", st == 200, str(st)); track("other", r["id"])
    st, td2 = crud("POST", "teamdocs", token=bob_tok, body={"teamId": team_b, "title": "t10-td-team", "status": "doc", "content": "x"})
    step("T10B teamdoc team-scopé (bob membre) create", st == 200, str(st))
    td2_id = td2["id"]; track("other", td2_id)
    st, r = crud("POST", "share_links", token=alice_tok, body={"link_type": "team", "target_id": team_b, "createdBy": alice_id, "isActive": True})
    step("T10B share_link team", st == 200, str(st)); track("other", r["id"])
    st, r = crud("POST", "materiel_loan", token=alice_tok, body={"ownerId": team_b, "responsibleId": alice_id, "borrowerUser": alice_id, "createdBy": alice_id, "startDate": "2026-10-06 00:00:00.000Z", "eventName": "t10-team"})
    step("T10B loan (ownerId=B)", st == 200, str(st)); track("other", r["id"])

    # --- 6. teamdocs rules ---
    st, r = crud("PATCH", "teamdocs", "/" + td2_id, bob_tok, {"title": "t10-td-team-upd"})
    step("teamdocs team-scopé update (bob)", st == 200, str(st))
    st, r = crud("GET", "teamdocs", "/" + td2_id, bob_tok)
    step("teamdocs team-scopé view (bob)", st == 200, str(st))
    st, r = crud("GET", "teamdocs", token=bob_tok)
    ok = st == 200 and any(i["id"] == td2_id for i in r.get("items", []))
    step("teamdocs team-scopé list (bob voit son doc)", ok, "total=%s" % r.get("totalItems"))
    st, r = crud("POST", "teamdocs", token=carol_tok, body={"teamId": team_b, "title": "t10-td-neg", "status": "doc", "content": "x"})
    ok = st == 400 and r.get("data") == {}
    step("teamdocs team-scopé create (carol non-membre) -> 400 règle data:{}", ok, "%s %s" % (st, json.dumps(r.get("data", {}))))
    st, r = crud("GET", "teamdocs", token=carol_tok)
    ok = st == 200 and not any(i["id"] == td2_id for i in r.get("items", []))
    step("teamdocs team-scopé list (carol ne voit pas)", ok, "total=%s" % r.get("totalItems"))
    st, r = crud("GET", "teamdocs", "/" + td2_id, carol_tok)
    step("teamdocs team-scopé view (carol) -> 404", st == 404, str(st))
    st, td3 = crud("POST", "teamdocs", token=bob_tok, body={"teamId": team_b, "title": "t10-td-del", "status": "doc", "content": "x"})
    step("teamdocs TD3 create (bob)", st == 200, str(st))
    st, r = crud("DELETE", "teamdocs", "/" + td3["id"], bob_tok)
    step("teamdocs team-scopé delete (bob) -> 204", st == 204, str(st))

    # --- 7. invite-to-team roles ---
    st, r = api("POST", "/api/enka/invite-to-team", carol_tok, {"teamId": team_c, "emails": ["t10-bob@test.local"]})
    step("invite-to-team carol non-membre -> 403", st == 403, str(st))
    st, r = crud("PATCH", "teams", "/" + team_c, alice_tok, {"roles": {"t10preset": "custom"}})
    step("PATCH roles preset sur T10C", st == 200, str(st))
    st, r = api("POST", "/api/enka/invite-to-team", alice_tok, {"teamId": team_c, "emails": ["t10-bob@test.local"]})
    ok = st == 200 and r.get("results", [{}])[0].get("action") == "added"
    step("invite-to-team bob (existant) action=added", ok, "%s %s" % (st, json.dumps(r.get("results", []))))
    roles_sql = sql("SELECT roles FROM teams WHERE id = '%s';" % team_c)
    try:
        roles_obj = json.loads(roles_sql)
    except json.JSONDecodeError:
        roles_obj = None
    ok = roles_obj == {"t10preset": "custom", bob_id: "member"}
    step("roles SQL = JSON valide {preset + bob:member}", ok, roles_sql)
    st, r = api("POST", "/api/enka/invite-to-team", alice_tok, {"teamId": team_c, "emails": ["t10-bob@test.local"]})
    ok = st == 200 and r.get("results", [{}])[0].get("action") == "already_member"
    step("re-invite action=already_member", ok, "%s %s" % (st, json.dumps(r.get("results", []))))
    roles_sql2 = sql("SELECT roles FROM teams WHERE id = '%s';" % team_c)
    step("roles inchangés après re-invite", roles_sql2 == roles_sql, roles_sql2)

    # --- 8. Cascade EVENT (delete E1) ---
    pre = {
        "products": sql_count("products", "eventId = '%s'" % ev1),
        "purchases": sql_count("purchases", "eventId = '%s'" % ev1),
        "event_materiel": sql_count("event_materiel", "eventId = '%s'" % ev1),
        "event_todos": sql_count("event_todos", "eventId = '%s'" % ev1),
        "teamdocs": sql_count("teamdocs", "eventId = '%s'" % ev1),
        "share_links": sql_count("share_links", "link_type = 'event' AND target_id = '%s'" % ev1),
        "loans": sql_count("materiel_loan", "eventId = '%s'" % ev1),
        "notifs": sql_count("notifications", "link LIKE '%%%s%%' OR data LIKE '%%%s%%'" % (ev1, ev1)),
    }
    log("pre-delete E1 SQL: " + json.dumps(pre))
    expected_pre = {"products": 1, "purchases": 1, "event_materiel": 1, "event_todos": 1, "teamdocs": 1, "share_links": 1, "loans": 1, "notifs": 1}
    step("comptes pré-delete E1 = 1 partout", pre == expected_pre, json.dumps(pre))

    st, _ = crud("DELETE", "events", "/" + ev1, alice_tok)
    step("DELETE E1 (alice) -> 204", st == 204, str(st))
    track("events", [])  # ev1 consumed by cascade

    post = {
        "products": sql_count("products", "eventId = '%s'" % ev1),
        "purchases": sql_count("purchases", "eventId = '%s'" % ev1),
        "event_materiel": sql_count("event_materiel", "eventId = '%s'" % ev1),
        "event_todos": sql_count("event_todos", "eventId = '%s'" % ev1),
        "teamdocs": sql_count("teamdocs", "eventId = '%s'" % ev1),
        "share_links": sql_count("share_links", "link_type = 'event' AND target_id = '%s'" % ev1),
        "loans": sql_count("materiel_loan", "eventId = '%s'" % ev1),
        "notifs": sql_count("notifications", "link LIKE '%%%s%%' OR data LIKE '%%%s%%'" % (ev1, ev1)),
        "ctrl_notif": sql_count("notifications", "link = '/recipes/xyz'"),
        "E1_exists": sql_count("events", "id = '%s'" % ev1),
        "detached_products": sql_count("products", "eventId = '' AND productName LIKE '%%t10-%%'"),
    }
    ok = (post["products"] == 0 and post["purchases"] == 0 and post["event_materiel"] == 0
          and post["event_todos"] == 0 and post["teamdocs"] == 0 and post["share_links"] == 0
          and post["loans"] == 0 and post["notifs"] == 0 and post["ctrl_notif"] == 1
          and post["E1_exists"] == 0 and post["detached_products"] == 0)
    step("post-delete E1 : 0 orphelin + contrôle vivant", ok, json.dumps(post))

    # --- 9. Cascade TEAM (delete T10B) ---
    pre_t = {
        "materiel": sql_count("materiel", "teamId = '%s'" % team_b),
        "teamdocs": sql_count("teamdocs", "teamId = '%s'" % team_b),
        "share_links": sql_count("share_links", "link_type = 'team' AND target_id = '%s'" % team_b),
        "loans": sql_count("materiel_loan", "ownerId = '%s'" % team_b),
    }
    log("pre-delete T10B SQL: " + json.dumps(pre_t))
    step("comptes pré-delete T10B = 1 partout", pre_t == {"materiel": 1, "teamdocs": 1, "share_links": 1, "loans": 1}, json.dumps(pre_t))

    ev2_updated_before = sql("SELECT updated FROM events WHERE id = '%s';" % ev2)
    st, _ = crud("DELETE", "teams", "/" + team_b, alice_tok)
    step("DELETE T10B (alice) -> 204", st == 204, str(st))
    track("teams", [])

    ev2_teams = sql("SELECT teams FROM events WHERE id = '%s';" % ev2)
    ev3_teams = sql("SELECT teams FROM events WHERE id = '%s';" % ev3)
    ok = ev2_teams == json.dumps([team_a]) and (ev3_teams == "[]" or ev3_teams == "" or ev3_teams == "''")
    step("events.teams nettoyés (E2=[A], E3 vide)", ok, "E2=%s E3=%s" % (ev2_teams, ev3_teams))
    ev2_updated_after = sql("SELECT updated FROM events WHERE id = '%s';" % ev2)
    step("E2.updated bumpé (delta sync client)", ev2_updated_after != ev2_updated_before, "%s -> %s" % (ev2_updated_before, ev2_updated_after))
    post_t = {
        "materiel": sql_count("materiel", "teamId = '%s'" % team_b),
        "teamdocs": sql_count("teamdocs", "teamId = '%s'" % team_b),
        "share_links": sql_count("share_links", "link_type = 'team' AND target_id = '%s'" % team_b),
        "loans": sql_count("materiel_loan", "ownerId = '%s'" % team_b),
        "E2_exists": sql_count("events", "id = '%s'" % ev2),
        "E3_exists": sql_count("events", "id = '%s'" % ev3),
        "T10B_pending": sql_count("events", "teams LIKE '%%%s%%'" % team_b),
        "detached_teamdocs": sql_count("teamdocs", "teamId = '' AND eventId = '' AND title LIKE '%%t10-%%'"),
        "detached_materiel": sql_count("materiel", "teamId = '' AND name LIKE '%%t10-%%'"),
        "detached_loans": sql_count("materiel_loan", "ownerId = '' AND eventName LIKE '%%t10-%%'"),
    }
    ok = (post_t["materiel"] == 0 and post_t["teamdocs"] == 0 and post_t["share_links"] == 0
          and post_t["loans"] == 0 and post_t["E2_exists"] == 1 and post_t["E3_exists"] == 1
          and post_t["T10B_pending"] == 0 and post_t["detached_teamdocs"] == 0
          and post_t["detached_materiel"] == 0 and post_t["detached_loans"] == 0)
    step("post-delete T10B : 0 orphelin + events préservés + 0 id pendant", ok, json.dumps(post_t))

    # --- 10. Final counts ---
    created["events"] = [e for e in created["events"] if e]
    created["teams"] = [t for t in created["teams"] if t]

finally:
    teardown()

    final = {
        "events": sql_count("events", "1=1"),
        "teams": sql_count("teams", "1=1"),
        "users": sql_count("users", "1=1"),
        "materiel": sql_count("materiel", "1=1"),
        "materiel_loan": sql_count("materiel_loan", "1=1"),
        "notifications": sql_count("notifications", "1=1"),
        "share_links": sql_count("share_links", "1=1"),
        "teamdocs": sql_count("teamdocs", "1=1"),
    }
    residus = {}
    for coll, col in (("events", "name"), ("teams", "name"), ("teamdocs", "title"), ("materiel_loan", "eventName"), ("share_links", "target_id")):
        residus[coll] = sql_count(coll, "%s LIKE '%%t10-%%'" % col)
    residus["users"] = sql_count("users", "email LIKE '%%t10-%%'")
    residus["notifications"] = sql_count("notifications", "type LIKE '%%t10%%' OR link LIKE '%%t10%%'")
    log("final SQL: " + json.dumps(final))
    log("residus t10: " + json.dumps(residus))

    counts_ok = final == baseline
    residus_ok = all(v == 0 for v in residus.values())
    step("comptes finaux = baseline", counts_ok, json.dumps(final))
    step("0 résidu t10", residus_ok, json.dumps(residus))

failed = [r for r in results if not r[1]]
log("=== %d/%d OK ===" % (len(results) - len(failed), len(results)))
sys.exit(1 if failed else 0)
