#!/usr/bin/env python3
"""T8 hooks matrix — join-event (HOOK-1, HOOK-2, SEC-3) + lookup-user (UI-1).

Usage: python3 t8-hooks-matrix.py <port>
Every probe is exactly ONE curl invocation (status via -w, body via -o),
logged with status + response. Fixtures are test-scoped (prefix t8-) and
torn down at the end (links, events, users self-delete).
"""

import json
import subprocess
import sys
import urllib.parse

PORT = sys.argv[1] if len(sys.argv) > 1 else "8090"
BASE = "http://127.0.0.1:%s/api" % PORT
LOG = "/tmp/orchestrate/t8-matrix-%s.log" % PORT
BODYFILE = "/tmp/orchestrate/t8-curl-body.json"

results = []
state = {}

USERS = {
    "o": {"email": "t8-o@test.local", "password": "T8probe-2026!", "name": "T8 Owner"},
    "j": {"email": "t8-j@test.local", "password": "T8probe-2026!", "name": "T8 Joiner"},
    "x": {"email": "t8-x@test.local", "password": "T8probe-2026!", "name": "T8 Third"},
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

    got = json.dumps(parsed)[:220] if not isinstance(parsed, str) else parsed
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
        f.write("\n===== T8 matrix run — port %s =====\n" % PORT)

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
    O, J, X = tokens["o"], tokens["j"], tokens["x"]

    # E1 : event confirmé, fixtures vides (join valide + lien expiré + lien team)
    probe("S", "event E1 (status=confirmed, createdBy=o)", "POST",
          "/collections/events/records", token=O,
          body={"name": "t8-event-1", "createdBy": uid["o"], "status": "confirmed",
                "contributors": [], "guestEmails": [], "guestUsers": [], "teams": []},
          expect_pos=True, extract="E1")
    # E2 : event annulé (refus statut)
    probe("S", "event E2 (status=canceled)", "POST",
          "/collections/events/records", token=O,
          body={"name": "t8-event-2", "createdBy": uid["o"], "status": "canceled",
                "contributors": [], "guestEmails": [], "guestUsers": [], "teams": []},
          expect_pos=True, extract="E2")
    # E3 : event pour le dédoublonnage nanoid (contributor pré-posé)
    probe("S", "event E3 (status=confirmed, contributor nanoid j)", "POST",
          "/collections/events/records", token=O,
          body={"name": "t8-event-3", "createdBy": uid["o"], "status": "confirmed",
                "contributors": [{"id": "nanoidprobe12345", "email": "t8-j@test.local",
                                  "status": "invited", "invitedAt": "2026-10-06T00:00:00.000Z"}],
                "guestEmails": [], "guestUsers": [], "teams": []},
          expect_pos=True, extract="E3")

    links = [
        ("L1", "t8-event-1 link (valide, illimité)", "E1", {}),
        ("LEXP", "t8-event-1 link expiré", "E1", {"expiresAt": "2026-10-05 00:00:00.000Z"}),
        ("LTEAM", "lien team (target E1)", "E1", {"link_type": "team"}),
        ("LMAX", "t8-event-1 link maxUses=1", "E1", {"maxUses": 1}),
        ("LCXL", "t8-event-2 link (event annulé)", "E2", {}),
        ("L3", "t8-event-3 link (dédoublonnage)", "E3", {}),
    ]
    for key, label, ev, extra in links:
        body = {"target_id": (state.get(ev) or {}).get("id", ""), "link_type": "event",
                "isActive": True, "token": "", "createdBy": uid["o"]}
        body.update(extra)
        probe("S", label, "POST", "/collections/share_links/records", token=O,
              body=body, expect_pos=True, extract=key)

    ids = {k: (state.get(k) or {}).get("id", "") for k in
           ("E1", "E2", "E3", "L1", "LEXP", "LTEAM", "LMAX", "LCXL", "L3")}
    JOINEV = "/enka/join-event"

    def ev_of(token, evid):
        probe("V", "GET event %s" % evid, "GET",
              "/collections/events/records/" + ids[evid], token=token,
              expect_pos=True, extract="E_" + evid)

    # ---------- P1 join valide : contributors + guestUsers + useCount ----------
    probe("P1", "join j L1 -> 200 eventId", "POST", JOINEV, token=J,
          body={"linkId": ids["L1"]}, expect_pos=True)
    ev_of(O, "E1")
    probe("P1b", "E1 state: guestUsers/guestEmails/contributors exacts", "GET",
          "/collections/events/records/" + ids["E1"], token=O,
          expect_eq=lambda p: (
              p.get("guestUsers") == [uid["j"]]
              and p.get("guestEmails") == ["t8-j@test.local"]
              and p.get("contributors") == [{"id": uid["j"], "email": "t8-j@test.local",
                                             "name": "T8 Joiner", "status": "accepted"}]))
    probe("P1c", "L1 useCount == 1", "GET",
          "/collections/share_links/records/" + ids["L1"], token=O,
          expect_eq=lambda p: p.get("useCount") == 1)

    # ---------- P2 re-join idempotent ----------
    probe("P2", "re-join j L1 -> 200 (idempotent)", "POST", JOINEV, token=J,
          body={"linkId": ids["L1"]}, expect_pos=True)
    probe("P2b", "L1 useCount toujours 1", "GET",
          "/collections/share_links/records/" + ids["L1"], token=O,
          expect_eq=lambda p: p.get("useCount") == 1)
    probe("P2c", "E1 contributors toujours 1 entrée", "GET",
          "/collections/events/records/" + ids["E1"], token=O,
          expect_eq=lambda p: len(p.get("contributors") or []) == 1)

    # ---------- P3 dédoublonnage nanoid -> userId (E3) ----------
    probe("P3", "join j L3 -> 200", "POST", JOINEV, token=J,
          body={"linkId": ids["L3"]}, expect_pos=True)
    probe("P3b", "E3: contributor nanoid rattache (statut invited préservé)", "GET",
          "/collections/events/records/" + ids["E3"], token=O,
          expect_eq=lambda p: (
              p.get("contributors") == [{"id": uid["j"], "email": "t8-j@test.local",
                                         "status": "invited",
                                         "invitedAt": "2026-10-06T00:00:00.000Z",
                                         "name": "T8 Joiner"}]))
    probe("P3c", "E3 guestUsers == [j]", "GET",
          "/collections/events/records/" + ids["E3"], token=O,
          expect_eq=lambda p: p.get("guestUsers") == [uid["j"]])
    probe("P3d", "L3 useCount == 1 (join réel)", "GET",
          "/collections/share_links/records/" + ids["L3"], token=O,
          expect_eq=lambda p: p.get("useCount") == 1)

    # ---------- P4 lien expiré ----------
    probe("P4", "join j LEXP -> 400 expiré", "POST", JOINEV, token=J,
          body={"linkId": ids["LEXP"]}, expect_pos=False)

    # ---------- P5 lien team sur event ----------
    probe("P5", "join j LTEAM (link_type=team) -> 400", "POST", JOINEV, token=J,
          body={"linkId": ids["LTEAM"]}, expect_pos=False)

    # ---------- P6/P7 maxUses ----------
    probe("P6", "join x LMAX (1er use) -> 200", "POST", JOINEV, token=X,
          body={"linkId": ids["LMAX"]}, expect_pos=True)
    probe("P6b", "LMAX useCount == 1", "GET",
          "/collections/share_links/records/" + ids["LMAX"], token=O,
          expect_eq=lambda p: p.get("useCount") == 1)
    probe("P7", "join o LMAX (épuisé) -> 400 limite", "POST", JOINEV, token=O,
          body={"linkId": ids["LMAX"]}, expect_pos=False)
    probe("P7b", "LMAX useCount toujours 1 (pas d'incrément au refus)", "GET",
          "/collections/share_links/records/" + ids["LMAX"], token=O,
          expect_eq=lambda p: p.get("useCount") == 1)

    # ---------- P8 event annulé ----------
    probe("P8", "join j LCXL (event canceled) -> 400", "POST", JOINEV, token=J,
          body={"linkId": ids["LCXL"]}, expect_pos=False)

    # ---------- P9 lien désactivé ----------
    probe("S", "désactive L1", "PATCH", "/collections/share_links/records/" + ids["L1"],
          token=O, body={"isActive": False}, expect_pos=True)
    probe("P9", "join j L1 désactivé -> 400", "POST", JOINEV, token=J,
          body={"linkId": ids["L1"]}, expect_pos=False)

    # ---------- P10-P13 lookup-user ----------
    probe("P10", "lookup-user pos (owner cherche j)", "GET",
          "/enka/lookup-user?email=" + urllib.parse.quote("t8-j@test.local"),
          token=O,
          expect_eq=lambda p: p.get("id") == uid["j"] and p.get("name") == "T8 Joiner")
    probe("P11", "lookup-user neg (email inconnu) -> 404", "GET",
          "/enka/lookup-user?email=" + urllib.parse.quote("inconnu@test.local"),
          token=O, expect_pos=False)
    probe("P12", "lookup-user sans auth -> 401", "GET",
          "/enka/lookup-user?email=" + urllib.parse.quote("t8-j@test.local"),
          expect_pos=False)
    probe("P13", "lookup-user sans email -> 400", "GET", "/enka/lookup-user",
          token=O, expect_pos=False)
    probe("P14", "join sans auth -> 401", "POST", JOINEV,
          body={"linkId": ids["L3"]}, expect_pos=False)

    # ---------- teardown ----------
    tdel = []
    for k in ("L1", "LEXP", "LTEAM", "LMAX", "LCXL", "L3"):
        tdel.append(("link " + k, "DELETE", "/collections/share_links/records/" + ids[k], O))
    for k in ("E1", "E2", "E3"):
        tdel.append(("event " + k, "DELETE", "/collections/events/records/" + ids[k], O))
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
