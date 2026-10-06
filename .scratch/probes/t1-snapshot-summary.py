import json, re

src = open("pocketbase/pb_migrations/1791277647_collections_snapshot.js").read()
m = re.search(r"const snapshot = \[(.*)\];\s*\n\s*return app\.importCollections", src, re.S)
arr = json.loads("[" + m.group(1) + "]")
print("collections:", len(arr))
for c in arr:
    fields = ",".join(f["name"] for f in c.get("fields", []))
    print("## " + c["name"] + " (" + c["type"] + ") system=" + str(c.get("system", False)))
    print("   fields: " + fields)
    for k in ("listRule", "viewRule", "createRule", "updateRule", "deleteRule"):
        v = c.get(k)
        rendered = "NULL" if v is None else ("EMPTY(public)" if v == "" else v)
        print("   " + k + ": " + rendered)
