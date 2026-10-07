#!/usr/bin/env python3
"""Sonde T01 (run parite-index-tags) : requetes delta + scopees apres pose
des index PB. Pattern T4/T18 : asserts durs, tokens en variables, teardown
best-effort (suppression du superuser de sonde).

Pre-requis : PB dev sur 127.0.0.1:8090 + superuser t01-probe@test.local.
"""

import json
import urllib.parse
import urllib.request

BASE = "http://127.0.0.1:8090"
IDENTITY = "t01-probe@test.local"
PASSWORD = "t01-probe-Pass123"
SINCE = "2000-01-01 00:00:00.000Z"  # curseur par defaut initialFetch (T13)


def req(method, path, body=None, token=None):
    r = urllib.request.Request(BASE + path, method=method)
    headers = {"Accept": "application/json"}
    if body is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = token
    for k, v in headers.items():
        r.add_header(k, v)
    data = json.dumps(body).encode() if body is not None else None
    with urllib.request.urlopen(r, data=data) as resp:
        return resp.status, json.loads(resp.read().decode())


def main():
    # 1. Auth superuser (regles bypassees : on teste la forme filter+sort SQL)
    st, auth = req("POST", "/api/collections/_superusers/auth-with-password",
                   {"identity": IDENTITY, "password": PASSWORD})
    assert st == 200 and auth.get("token"), ("auth KO", st, auth)
    tok = auth["token"]
    su_id = auth["record"]["id"]

    # 2. Sonde delta simple products : filter updated + sort updated (ASC)
    q = urllib.parse.quote("(updated >= '%s')" % SINCE)
    st, delta = req("GET", "/api/collections/products/records?filter=%s&sort=updated&perPage=5" % q,
                    token=tok)
    assert st == 200, ("delta products KO", st, delta)
    assert delta["totalItems"] >= 900, ("totalItems attendu ~982", delta["totalItems"])
    items = delta["items"]
    assert len(items) == 5, ("perPage 5", len(items))
    assert items == sorted(items, key=lambda r: r["updated"]), "tri updated ASC non respecte"
    print("PROBE delta products: 200, totalItems=%s, tri ASC ok" % delta["totalItems"])

    # 3. Sonde sync scope (eventId + updated + sort desc) sur products
    st, ev = req("GET", "/api/collections/events/records?perPage=1&sort=updated", token=tok)
    assert st == 200 and ev["items"], ("events vides ?", st, ev)
    eid = ev["items"][0]["id"]

    q = urllib.parse.quote("(eventId = '%s' && updated >= '%s')" % (eid, SINCE))
    st, scoped = req("GET", "/api/collections/products/records?filter=%s&sort=-updated&perPage=5" % q,
                     token=tok)
    assert st == 200, ("scope products KO", st, scoped)
    sitems = scoped["items"]
    assert sitems == sorted(sitems, key=lambda r: r["updated"], reverse=True), "tri -updated non respecte"
    assert all(r["eventId"] == eid for r in sitems), "records hors event dans le resultat"
    print("PROBE scope products (event %s): 200, totalItems=%s" % (eid, scoped["totalItems"]))

    # 4. Sonde scope purchases + event_materiel (memes patterns que les stores)
    st, scoped_p = req("GET", "/api/collections/purchases/records?filter=%s&sort=updated&perPage=5" % q,
                       token=tok)
    assert st == 200, ("scope purchases KO", st, scoped_p)
    st, scoped_em = req("GET", "/api/collections/event_materiel/records?filter=%s&sort=updated&perPage=5" % q,
                        token=tok)
    assert st == 200, ("scope event_materiel KO", st, scoped_em)
    print("PROBE scope purchases: 200, totalItems=%s ; event_materiel: 200, totalItems=%s"
          % (scoped_p["totalItems"], scoped_em["totalItems"]))

    # 5. Sonde share_links : filter target_id + isActive (getEventShareLinks)
    st, sl = req("GET", "/api/collections/share_links/records?perPage=1", token=tok)
    if sl.get("items"):
        tid = sl["items"][0]["target_id"]
        q2 = urllib.parse.quote("(target_id = '%s' && isActive = true)" % tid)
        st, slf = req("GET", "/api/collections/share_links/records?filter=%s&perPage=5" % q2, token=tok)
        assert st == 200, ("share_links filter KO", st, slf)
        print("PROBE share_links target_id=%s: 200, totalItems=%s" % (tid, slf["totalItems"]))
    else:
        print("PROBE share_links: table vide, sonde filter skippee")

    # 6. Teardown : suppression du superuser de sonde
    try:
        st, _ = req("DELETE", "/api/collections/_superusers/records/%s" % su_id, token=tok)
        print("TEARDOWN superuser supprime:", st)
    except Exception as e:  # noqa: BLE001
        print("TEARDOWN best-effort KO (superuser %s a supprimer a la main):" % su_id, e)

    print("ALL PROBES OK")


if __name__ == "__main__":
    main()
