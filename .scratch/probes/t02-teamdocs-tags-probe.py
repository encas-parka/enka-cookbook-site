#!/usr/bin/env python3
"""Sonde T02 (run parite-index-tags) : champ tags json sur teamdocs.
Create avec tags -> persiste en SQL (json serialise), create sans tags
-> null, PATCH tags, lecture API (shape array). Pattern T01 : asserts
durs, tokens en variables, teardown verifie (records + superuser).

Pre-requis : PB dev sur 127.0.0.1:8090 + superuser t02-probe@test.local.
"""

import json
import sqlite3
import urllib.request

BASE = "http://127.0.0.1:8090"
IDENTITY = "t02-probe@test.local"
PASSWORD = "t02-probe-Pass123"
DB = "/home/geo/Developpement/ENKA-COOKBOOK/enka-cookbook-mig/pocketbase/pb_data/data.db"


def req(method, path, body=None, token=None):
    """Retourne (status, body-parse) ; corps vide (204) -> None. Les DELETE
    PB renvoient 204 sans corps : json.loads levait sur l'absence de corps."""
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
        raw = resp.read().decode()
        return resp.status, (json.loads(raw) if raw else None)


def sql(query, params=()):
    con = sqlite3.connect(DB)
    try:
        return con.execute(query, params).fetchall()
    finally:
        con.close()


def main():
    # 1. Auth superuser (regles bypassees : on teste la couche champ, pas les rules)
    st, auth = req("POST", "/api/collections/_superusers/auth-with-password",
                   {"identity": IDENTITY, "password": PASSWORD})
    assert st == 200 and auth.get("token"), ("auth KO", st, auth)
    tok = auth["token"]
    su_id = auth["record"]["id"]
    print("PROBE auth superuser: 200")

    created_ids = []
    try:
        # 2. Create avec tags -> 200 + persiste en SQL
        st, doc = req("POST", "/api/collections/teamdocs/records",
                      {"title": "T02 probe tags", "tags": ["produit", "recette"]},
                      token=tok)
        assert st == 200, ("create avec tags KO", st, doc)
        assert doc.get("tags") == ["produit", "recette"], ("tags API", doc.get("tags"))
        created_ids.append(doc["id"])
        rows = sql("SELECT tags FROM teamdocs WHERE id=?", (doc["id"],))
        assert rows and rows[0][0] == '["produit","recette"]', ("SQL tags", rows)
        print("PROBE create avec tags: 200, id=%s, SQL=%s" % (doc["id"], rows[0][0]))

        # 3. Create sans tags -> 200 + SQL NULL
        st, doc2 = req("POST", "/api/collections/teamdocs/records",
                       {"title": "T02 probe sans tags"}, token=tok)
        assert st == 200, ("create sans tags KO", st, doc2)
        assert doc2.get("tags") is None, ("tags attendu null", doc2.get("tags"))
        created_ids.append(doc2["id"])
        rows = sql("SELECT tags FROM teamdocs WHERE id=?", (doc2["id"],))
        assert rows and rows[0][0] is None, ("SQL tags null", rows)
        print("PROBE create sans tags: 200, id=%s, SQL=NULL" % doc2["id"])

        # 4. PATCH tags (edition UI) -> persiste
        st, upd = req("PATCH", "/api/collections/teamdocs/records/%s" % doc2["id"],
                      {"tags": ["tache"]}, token=tok)
        assert st == 200 and upd.get("tags") == ["tache"], ("patch KO", st, upd)
        rows = sql("SELECT tags FROM teamdocs WHERE id=?", (doc2["id"],))
        assert rows and rows[0][0] == '["tache"]', ("SQL tags apres patch", rows)
        print("PROBE patch tags: 200, SQL=%s" % rows[0][0])

        # 5. Liste API : tags arrive en array (shape consommé par le client)
        st, lst = req("GET", "/api/collections/teamdocs/records?perPage=5&sort=-updated",
                      token=tok)
        assert st == 200, ("list KO", st, lst)
        tagged = [r for r in lst["items"] if r["id"] == created_ids[0]]
        assert tagged and isinstance(tagged[0]["tags"], list), ("shape tags API", tagged)
        print("PROBE list: 200, shape tags=array (%s)" % tagged[0]["tags"])
    finally:
        # 6. Teardown : records de sonde puis superuser, verifie en SQL
        for rid in created_ids:
            try:
                st, _ = req("DELETE", "/api/collections/teamdocs/records/%s" % rid,
                            token=tok)
                print("TEARDOWN teamdoc %s: %s" % (rid, st))
            except Exception as e:  # noqa: BLE001
                print("TEARDOWN teamdoc %s KO:" % rid, e)
        try:
            st, _ = req("DELETE", "/api/collections/_superusers/records/%s" % su_id,
                        token=tok)
            print("TEARDOWN superuser: %s" % st)
        except Exception as e:  # noqa: BLE001
            print("TEARDOWN superuser KO (a supprimer a la main):", e)

    leftovers = sql("SELECT COUNT(*) FROM teamdocs WHERE title LIKE 'T02 probe%'")
    sus = sql("SELECT COUNT(*) FROM _superusers WHERE email=?", (IDENTITY,))
    assert leftovers[0][0] == 0, ("records de sonde residuels", leftovers)
    assert sus[0][0] == 0, ("superuser de sonde residuel", sus)
    print("TEARDOWN verifie en SQL: 0 record residuel, 0 superuser residuel")
    print("ALL PROBES OK")


if __name__ == "__main__":
    main()
