#!/usr/bin/env python3
"""Build monsters.json for the Dragonwatch encounter generator.

Source: Open5e's open data (https://github.com/open5e/open5e-api, folder data/v1/<document>/Monster.json).
The SRD 5.1 content (document "wotc-srd") is (c) Wizards of the Coast, licensed CC-BY-4.0.

Usage:
  git clone --depth 1 https://github.com/open5e/open5e-api.git /tmp/open5e-api
  python3 tools/build-monsters.py /tmp/open5e-api/data/v1/wotc-srd/Monster.json [more Monster.json files...]

The output keeps the same field names as the Open5e API (v1), so the browser can reuse Dragonwatch's own
monsterToForm() on generated monsters. Descriptions are dropped to keep the file small.
"""
import json, sys, os

def names(raw):
    try:
        data = json.loads(raw) if raw else []
    except ValueError:
        return []
    return [{"name": str(x.get("name", ""))} for x in (data or []) if isinstance(x, dict)]

def convert(row, doc_slug):
    f = row["fields"]
    envs = json.loads(f.get("environments_json") or "[]")
    return {
        "slug": row["pk"],
        "name": f["name"],
        "cr": str(f["challenge_rating"]),
        "type": f.get("type") or "",
        "size": f.get("size") or "",
        "environments": envs,
        "hit_points": f.get("hit_points") or 1,
        "armor_class": f.get("armor_class") or 10,
        "dexterity": f.get("dexterity") or 10,
        "special_abilities": names(f.get("special_abilities_json")),
        "actions": names(f.get("actions_json")),
        "legendary_actions": names(f.get("legendary_actions_json")),
        "legendary_desc": f.get("legendary_desc") or "",
        "damage_resistances": f.get("damage_resistances") or "",
        "damage_immunities": f.get("damage_immunities") or "",
        "damage_vulnerabilities": f.get("damage_vulnerabilities") or "",
        "document": doc_slug,
    }

def main(paths):
    out, seen = [], set()
    for p in paths:
        doc = os.path.basename(os.path.dirname(os.path.abspath(p)))
        for row in json.load(open(p, encoding="utf-8")):
            m = convert(row, doc)
            key = m["name"].lower()
            if key in seen:
                continue
            seen.add(key)
            out.append(m)
    out.sort(key=lambda m: m["name"].lower())
    dest = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "monsters.json")
    with open(dest, "w", encoding="utf-8") as fh:
        fh.write("[\n" + ",\n".join(json.dumps(m, ensure_ascii=False, separators=(",", ":")) for m in out) + "\n]\n")
    print(f"wrote {len(out)} monsters to {os.path.normpath(dest)}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(sys.argv[1:])
