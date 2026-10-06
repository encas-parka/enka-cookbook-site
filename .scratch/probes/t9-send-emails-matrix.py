#!/usr/bin/env python3
"""T9 send-emails matrix — ownership + reconciliation (HOOK-3) + fallback bruyant (HOOK-8).

Usage: python3 t9-send-emails-matrix.py <port>
Every probe is exactly ONE curl invocation (status via -w, body via -o),
logged with status + response. Fixtures are test-scoped (prefix t9-) and
torn down at the end (links, event, users self-delete).
"""

import json
import subprocess
import sys
import urllib.parse

PORT = sys.argv[1] if len(sys.argv) > 1 else "8090"
BASE = "http://127.0.0.1:%s/api" % PORT
LOG = "/tmp/orchestrate/t9-matrix-%s.log" % PORT
BODYFILE = "/tmp/orchestrate/t9-curl-body.json"

results = []
state = {}

USERS = {
    "a": {"email": "t9-alice@test.local", "password": "T9probe-2026!", "name": "T9 Alice"},
    "b": {"email": "t9-bob@test.local", "password": "T9probe-2026!", "name": "T9 Bob"},
}


def probe(pid, label, method, path, token=None, body=None, expect_pos=None,
          expect_eq=None, extract=None):
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

    got = json.dumps(parsed)[:260] if not isinstance(parsed, str) else parsed
    results.append((pid, label, code, "OK" if ok else "FAIL"))
    with open(LOG, "a") as f:
        f.write("%-5s %-56s http=%-4s %s\n     cmd: %s\n     got: %s\n\n"
                % (pid, label, code, "OK" if ok else "FAIL", " ".join(cmd), got))
    if extract and 200 <= code < 300:
        state[extract] = parsed
    return ok


def flt(expr):
    return "?filter=" + urllib.parse.quote(expr)


def main():
    with open(LOG, "a") as f:
        f.write("\n===== T9 matrix run — port %s =====\n" % PORT)

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
    A, B = tokens["a"], tokens["b"]

    # Event reel avec description + dates (T3 : description existe)
    probe("S", "event E1 (nom reel, description, dates)", "POST",
          "/collections/events/records", token=A,
          body={"name": "t9-event-reel", "createdBy": uid["a"], "status": "confirmed",
                "description": "La vraie description du probe T9",
                "dateStart": "2026-10-10 00:00:00.000Z",
                "dateEnd": "2026-10-12 00:00:00.000Z",
                "contributors": [], "guestEmails": [], "guestUsers": [], "teams": []},
          expect_pos=True, extract="E1")
    E1 = (state.get("E1") or {}).get("id", "")

    links = [
        ("L1", "lien event d'alice (valide)", "event", True),
        ("LTEAM", "lien team d'alice (target E1)", "team", True),
        ("LD", "lien desactive d'alice", "event", False),
    ]
    for key, label, ltype, active in links:
        probe("S", "share_link %s" % key, "POST",
              "/collections/share_links/records", token=A,
              body={"target_id": E1, "link_type": ltype, "isActive": active,
                    "token": "", "createdBy": uid["a"]},
              expect_pos=True, extract=key)
    # lien de bob (pour le probe ownership inverse : alice vs lien de bob)
    probe("S", "share_link LB (de bob)", "POST",
          "/collections/share_links/records", token=B,
          body={"target_id": E1, "link_type": "event", "isActive": True,
                "token": "", "createdBy": uid["b"]},
          expect_pos=True, extract="LB")

    L1 = (state.get("L1") or {}).get("id", "")
    LTEAM = (state.get("LTEAM") or {}).get("id", "")
    LD = (state.get("LD") or {}).get("id", "")
    LB = (state.get("LB") or {}).get("id", "")

    def send_body(share_link_id, spoof=False):
        b = {"template": "invitation_to_event",
             "recipients": [{"email": "t9-victime@example.com", "shareLinkId": share_link_id}]}
        if spoof:
            b["eventName"] = "HACKED - contenu arbitraire"
            b["eventDescription"] = "description forgee par le client"
            b["dateStart"] = "1999-01-01"
        return b

    # ---------- sondes ----------
    probe("P1", "send-emails sans auth", "POST", "/enka/send-emails",
          body=send_body(L1), expect_pos=False)

    probe("P2", "template inconnu (alice)", "POST", "/enka/send-emails", token=A,
          body={"template": "phishing", "recipients": [{"email": "x@y.z", "shareLinkId": L1}]},
          expect_pos=False)

    probe("P3", "recipients vide (alice)", "POST", "/enka/send-emails", token=A,
          body={"template": "invitation_to_event", "recipients": []},
          expect_pos=False)

    probe("P4", "OWNERSHIP : bob avec le lien d'alice (body mensonger)",
          "POST", "/enka/send-emails", token=B,
          body=send_body(L1, spoof=True),
          expect_eq=lambda p: p.get("success") is True and p.get("results")
          and p["results"][0]["ok"] is False
          and "non autorise" in (p["results"][0].get("error") or ""))

    probe("P5", "OWNERSHIP inverse : alice avec le lien de bob",
          "POST", "/enka/send-emails", token=A, body=send_body(LB),
          expect_eq=lambda p: p.get("results") and p["results"][0]["ok"] is False
          and "non autorise" in (p["results"][0].get("error") or ""))

    probe("P6", "lien desactive (alice)", "POST", "/enka/send-emails", token=A,
          body=send_body(LD),
          expect_eq=lambda p: p.get("results") and p["results"][0]["ok"] is False
          and "introuvable ou inactif" in (p["results"][0].get("error") or ""))

    probe("P7", "link_type=team (alice)", "POST", "/enka/send-emails", token=A,
          body=send_body(LTEAM),
          expect_eq=lambda p: p.get("results") and p["results"][0]["ok"] is False
          and "invalide" in (p["results"][0].get("error") or ""))

    probe("P8", "shareLinkId inexistant (alice)", "POST", "/enka/send-emails",
          token=A, body=send_body("t9inconnu123456"),
          expect_eq=lambda p: p.get("results") and p["results"][0]["ok"] is False
          and "introuvable ou inactif" in (p["results"][0].get("error") or ""))

    # Cas positif : ownership OK, reconciliation OK. Dev : senderAddress est
    # present (default PB), pas d'host SMTP -> PB bascule sur le binaire
    # sendmail (absent) -> echec CAPTURE par destinataire (ok:false), 200
    # propre. (Si senderAddress etait vide -> 500 "SMTP non configure".)
    probe("P9", "POSITIF alice/L1 body mensonger -> echec sendmail capture",
          "POST", "/enka/send-emails", token=A, body=send_body(L1, spoof=True),
          expect_eq=lambda p: p.get("results") and p["results"][0]["ok"] is False
          and "sendmail" in (p["results"][0].get("error") or ""))

    # ---------- verdicts ----------
    print("")
    fails = 0
    for pid, label, code, verdict in results:
        if verdict == "FAIL":
            fails += 1
        print("%-5s %-56s http=%-4s %s" % (pid, label, code, verdict))
    print("")
    print("TOTAL: %d probes, %d FAIL" % (len(results), fails))

    # ---------- teardown ----------
    with open(LOG, "a") as f:
        f.write("\n----- teardown -----\n")
    for key in ["L1", "LTEAM", "LD", "LB"]:
        rid = (state.get(key) or {}).get("id", "")
        tok = A if key != "LB" else B
        if rid:
            probe("T", "delete share_link %s" % key, "DELETE",
                  "/collections/share_links/records/%s" % rid, token=tok,
                  expect_pos=True)
    if E1:
        probe("T", "delete event E1", "DELETE",
              "/collections/events/records/%s" % E1, token=A, expect_pos=True)
    for u, d in USERS.items():
        rid = uid[u]
        probe("T", "self-delete user %s" % u, "DELETE",
              "/collections/users/records/%s" % rid, token=tokens[u],
              expect_pos=True)

    print("Teardown done — log: %s" % LOG)


if __name__ == "__main__":
    main()
