#!/usr/bin/env python3
"""T4 rules matrix — pos/neg curl probes for migration 1791278800.

Usage: python3 t4-rules-matrix.py <port>
Every probe is exactly ONE curl invocation (status via -w, body via -o),
logged with status + response. Users/records are test-scoped (prefix t4-)
and torn down at the end.
"""

import json
import subprocess
import sys
import urllib.parse

PORT = sys.argv[1] if len(sys.argv) > 1 else "8091"
BASE = "http://127.0.0.1:%s/api" % PORT
LOG = "/tmp/orchestrate/t4-matrix-%s.log" % PORT
BODYFILE = "/tmp/orchestrate/t4-curl-body.json"

results = []
state = {}

USERS = {
    "alice": {"email": "t4-alice@test.local", "password": "T4probe-2026!", "name": "t4-alice"},
    "bob": {"email": "t4-bob@test.local", "password": "T4probe-2026!", "name": "t4-bob"},
    "carol": {"email": "t4-carol@test.local", "password": "T4probe-2026!", "name": "t4-carol"},
}


def probe(pid, label, method, path, token=None, body=None, expect_pos=None,
          expect_eq=None, extract=None):
    """One curl per probe. expect_pos=True: 2xx wanted; False: 4xx wanted;
    expect_eq overrides both with an exact assertion on the parsed body."""
    cmd = ["curl", "-s", "-o", BODYFILE, "-w", "%{http_code}", "-X", method,
           "%s%s" % (BASE, path)]
    if token:
        cmd += ["-H", "Authorization: " + token]
    if body is not None:
        cmd += ["-H", "Content-Type: application/json", "-d", json.dumps(body)]
    r = subprocess.run(cmd, capture_output=True, text=True)
    code_s = r.stdout.strip()
    code = int(code_s) if code_s.isdigit() else 0
    try:
        with open(BODYFILE) as f:
            parsed = json.load(f)
    except Exception:
        with open(BODYFILE) as f:
            parsed = f.read()[:200]

    if expect_eq is not None:
        ok = expect_eq(parsed)
    elif expect_pos is True:
        ok = 200 <= code < 300
    else:
        ok = 400 <= code < 500

    got = json.dumps(parsed)[:160] if not isinstance(parsed, str) else parsed
    results.append((pid, label, code, "OK" if ok else "FAIL"))
    with open(LOG, "a") as f:
        f.write("%-4s %-58s http=%-4s %s\n     cmd: %s\n     got: %s\n\n"
                % (pid, label, code, "OK" if ok else "FAIL", " ".join(cmd), got))
    if extract and 200 <= code < 300:
        state[extract] = parsed
    return ok


def flt(expr):
    return "?filter=" + urllib.parse.quote(expr)


def main():
    with open(LOG, "a") as f:
        f.write("\n===== T4 matrix run — port %s =====\n" % PORT)

    # ---------- setup ----------
    for u, d in USERS.items():
        probe("S", "register %s" % u, "POST", "/collections/users/records",
              body={"email": d["email"], "password": d["password"],
                    "passwordConfirm": d["password"], "name": d["name"]},
              expect_pos=True)
    for u, d in USERS.items():
        probe("S", "auth %s" % u, "POST", "/collections/users/auth-with-password",
              body={"identity": d["email"], "password": d["password"]},
              expect_pos=True, extract="tok_" + u)
    tokens = {u: (state.get("tok_" + u) or {}).get("token", "") for u in USERS}
    uid = {u: ((state.get("tok_" + u) or {}).get("record") or {}).get("id", "") for u in USERS}
    A, B, C = tokens["alice"], tokens["bob"], tokens["carol"]

    probe("S", "alice team T_A (members=[a], createdBy=a)", "POST", "/collections/teams/records",
          token=A, body={"name": "t4-team-A", "members": [uid["alice"]], "createdBy": uid["alice"]},
          expect_pos=True, extract="T_A")
    probe("S", "alice team T_B (members=[a,b], createdBy=a)", "POST", "/collections/teams/records",
          token=A, body={"name": "t4-team-B", "members": [uid["alice"], uid["bob"]], "createdBy": uid["alice"]},
          expect_pos=True, extract="T_B")
    probe("S", "bob team T_G (members=[b], createdBy absent = grand-pere)", "POST", "/collections/teams/records",
          token=B, body={"name": "t4-team-GP", "members": [uid["bob"]]},
          expect_pos=True, extract="T_G")
    probe("S", "alice event E (createdBy=a, sans team/guest)", "POST", "/collections/events/records",
          token=A, body={"name": "t4-event-probe", "createdBy": uid["alice"]},
          expect_pos=True, extract="E")
    probe("S", "alice recipe R (createdBy=a, permissionWrite=[b])", "POST", "/collections/recipes/records",
          token=A, body={"title": "t4-recipe-probe", "createdBy": uid["alice"], "permissionWrite": [uid["bob"]]},
          expect_pos=True, extract="R")
    probe("S", "alice share_link SL_A (createdBy=a)", "POST", "/collections/share_links/records",
          token=A, body={"target_id": (state.get("E") or {}).get("id", ""), "link_type": "event",
                         "isActive": True, "token": "", "createdBy": uid["alice"]},
          expect_pos=True, extract="SL_A")
    probe("S", "bob share_link SL_B (createdBy=b)", "POST", "/collections/share_links/records",
          token=B, body={"target_id": (state.get("E") or {}).get("id", ""), "link_type": "event",
                         "isActive": True, "token": "", "createdBy": uid["bob"]},
          expect_pos=True, extract="SL_B")

    ids = {k: (state.get(k) or {}).get("id", "") for k in ("T_A", "T_B", "T_G", "E", "R", "SL_A", "SL_B")}

    # ---------- REC-1 share_links ----------
    probe("P1", "REC-1 pos bob list -> uniquement SL_B", "GET", "/collections/share_links/records",
          token=B,
          expect_eq=lambda p: [i["id"] for i in p.get("items", [])] == [ids["SL_B"]])
    probe("P2", "REC-1 neg carol list -> vide", "GET", "/collections/share_links/records",
          token=C, expect_eq=lambda p: p.get("totalItems") == 0)
    probe("P3", "REC-1 neg bob view SL_A -> 404", "GET", "/collections/share_links/records/" + ids["SL_A"],
          token=B, expect_pos=False)
    probe("P4", "REC-1 neg bob create spoof createdBy=alice -> 4xx", "POST", "/collections/share_links/records",
          token=B, body={"target_id": ids["E"], "link_type": "event", "isActive": True, "createdBy": uid["alice"]},
          expect_pos=False)
    probe("P5", "REC-1 pos alice view SL_A -> 200", "GET", "/collections/share_links/records/" + ids["SL_A"],
          token=A, expect_pos=True)

    # ---------- EVENT-1 events ----------
    probe("P6", "EVENT-1 pos alice voit son event sans team", "GET",
          "/collections/events/records" + flt("id = '%s'" % ids["E"]),
          token=A, expect_eq=lambda p: p.get("totalItems") == 1)
    probe("P7", "EVENT-1 neg carol ne voit pas E (list)", "GET",
          "/collections/events/records" + flt("id = '%s'" % ids["E"]),
          token=C, expect_eq=lambda p: p.get("totalItems") == 0)
    probe("P8", "EVENT-1 neg carol view E -> 404", "GET", "/collections/events/records/" + ids["E"],
          token=C, expect_pos=False)

    # ---------- REC-3 recipes ----------
    probe("P9", "REC-3 pos bob update via permissionWrite", "PATCH",
          "/collections/recipes/records/" + ids["R"], token=B,
          body={"title": "t4-recipe-probe-bob"}, expect_pos=True)
    probe("P10", "REC-3 neg carol update -> 4xx", "PATCH",
          "/collections/recipes/records/" + ids["R"], token=C,
          body={"title": "t4-recipe-probe-carol"}, expect_pos=False)
    probe("P11", "REC-3 pos alice update via createdBy", "PATCH",
          "/collections/recipes/records/" + ids["R"], token=A,
          body={"title": "t4-recipe-probe"}, expect_pos=True)

    # ---------- REC-5 notifications ----------
    probe("P12", "REC-5 neg alice notif chez bob -> 4xx", "POST", "/collections/notifications/records",
          token=A, body={"userId": uid["bob"], "message": "t4-probe"}, expect_pos=False)
    probe("P13", "REC-5 pos alice notif chez alice -> 200", "POST", "/collections/notifications/records",
          token=A, body={"userId": uid["alice"], "message": "t4-probe"},
          expect_pos=True, extract="NOTIF")

    # ---------- REC-7 materiel ----------
    probe("P14", "REC-7 neg carol materiel sur T_A (hors team) -> 4xx", "POST", "/collections/materiel/records",
          token=C, body={"name": "t4-mat-neg", "teamId": ids["T_A"], "ownerUser": uid["alice"],
                         "createdBy": uid["carol"]}, expect_pos=False)
    probe("P15", "REC-7 pos carol materiel perso (ownerUser=self)", "POST", "/collections/materiel/records",
          token=C, body={"name": "t4-mat-perso", "ownerUser": uid["carol"], "createdBy": uid["carol"]},
          expect_pos=True, extract="M1")
    probe("P16", "REC-7 pos alice materiel de T_A (membre, ownerUser vide)", "POST", "/collections/materiel/records",
          token=A, body={"name": "t4-mat-team", "teamId": ids["T_A"], "createdBy": uid["alice"]},
          expect_pos=True, extract="M2")

    # ---------- REC-9 materiel_loan ----------
    loan = {"startDate": "2026-10-07 00:00:00.000Z", "endDate": "2026-10-08 00:00:00.000Z",
            "status": "asked", "materiels": []}
    probe("P17", "REC-9 pos carol loan (responsibleId=self)", "POST", "/collections/materiel_loan/records",
          token=C, body=dict(loan, responsibleId=uid["carol"], ownerId=ids["T_G"],
                             createdBy=uid["carol"], eventName="t4"), expect_pos=True, extract="L1")
    probe("P18", "REC-9 neg carol loan responsible=alice hors team -> 4xx", "POST", "/collections/materiel_loan/records",
          token=C, body=dict(loan, responsibleId=uid["alice"], ownerId=ids["T_G"],
                             createdBy=uid["carol"], eventName="t4"), expect_pos=False)
    probe("P19", "REC-9 pos bob loan (membre equipe proprietaire)", "POST", "/collections/materiel_loan/records",
          token=B, body=dict(loan, responsibleId=uid["alice"], ownerId=ids["T_G"],
                             createdBy=uid["bob"], eventName="t4"), expect_pos=True, extract="L2")

    # ---------- SEC-2 locks ----------
    probe("P20", "SEC-2 neg alice lock au nom de bob -> 4xx", "POST", "/collections/locks/records",
          token=A, body={"id": "doc_t4probe000001", "userId": uid["bob"], "userName": "t4-bob",
                         "expiresAt": "2026-12-31 23:59:59.000Z"}, expect_pos=False)
    probe("P21", "SEC-2 pos alice lock en son nom -> 200", "POST", "/collections/locks/records",
          token=A, body={"id": "doc_t4probe000001", "userId": uid["alice"], "userName": "t4-alice",
                         "expiresAt": "2026-12-31 23:59:59.000Z"}, expect_pos=True)

    # ---------- REC-6 teams (deletes en dernier) ----------
    probe("P22", "REC-6 neg bob delete T_B (membre non createur)", "DELETE",
          "/collections/teams/records/" + ids["T_B"], token=B, expect_pos=False)
    probe("P23", "REC-6 pos alice delete T_B (createur)", "DELETE",
          "/collections/teams/records/" + ids["T_B"], token=A, expect_pos=True)
    probe("P24", "REC-6 neg carol delete T_G", "DELETE",
          "/collections/teams/records/" + ids["T_G"], token=C, expect_pos=False)
    probe("P25", "REC-6 pos bob delete T_G (grand-pere membre)", "DELETE",
          "/collections/teams/records/" + ids["T_G"], token=B, expect_pos=True)
    probe("P26", "REC-6 pos alice delete T_A (createur)", "DELETE",
          "/collections/teams/records/" + ids["T_A"], token=A, expect_pos=True)

    # ---------- teardown ----------
    tdel = [
        ("alice lock", "DELETE", "/collections/locks/records/doc_t4probe000001", A),
        ("alice notif", "DELETE", "/collections/notifications/records/" + (state.get("NOTIF") or {}).get("id", ""), A),
        ("carol M1", "DELETE", "/collections/materiel/records/" + (state.get("M1") or {}).get("id", ""), C),
        ("alice M2", "DELETE", "/collections/materiel/records/" + (state.get("M2") or {}).get("id", ""), A),
        ("carol L1", "DELETE", "/collections/materiel_loan/records/" + (state.get("L1") or {}).get("id", ""), C),
        ("bob L2", "DELETE", "/collections/materiel_loan/records/" + (state.get("L2") or {}).get("id", ""), B),
        ("alice SL_A", "DELETE", "/collections/share_links/records/" + ids["SL_A"], A),
        ("bob SL_B", "DELETE", "/collections/share_links/records/" + ids["SL_B"], B),
        ("alice R", "DELETE", "/collections/recipes/records/" + ids["R"], A),
        ("alice E", "DELETE", "/collections/events/records/" + ids["E"], A),
    ]
    for label, m, p, tok in tdel:
        probe("T", "teardown " + label, m, p, token=tok, expect_pos=True)
    for u in USERS:
        probe("T", "teardown user %s (self-delete)" % u, "DELETE",
              "/collections/users/records/" + uid[u], token=tokens[u], expect_pos=True)

    # ---------- report ----------
    fails = [r for r in results if r[3] == "FAIL"]
    print("%-5s %-58s %-6s %s" % ("id", "probe", "http", "verdict"))
    for pid, label, code, verdict in results:
        print("%-5s %-58s %-6s %s" % (pid, label, code, verdict))
    print("")
    print("TOTAL %d probes, %d FAIL" % (len(results), len(fails)))
    with open(LOG, "a") as f:
        f.write("TOTAL %d probes, %d FAIL\n" % (len(results), len(fails)))
    sys.exit(1 if fails else 0)


if __name__ == "__main__":
    main()
