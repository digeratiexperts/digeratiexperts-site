#!/usr/bin/env python3
"""Regenerate the sha256 pins in console/catalog/community.json from reviewed clones.

Usage:
  python3 update-community-catalog.py --clones DIR [--pin lsuclient=<commit>] [--check]

DIR holds one clone per tool named <owner>_<repo> (e.g. jantari_LSUClient). Hashes come from
`git show <commit>:<path>`, i.e. exactly the bytes raw.githubusercontent.com serves for that commit, so a
working-tree edit in the clone can never slip into a pin. --pin moves a tool to a new commit (review the diff
between the old and new commit first). --check exits 1 if any pin would change. Nothing is downloaded.
"""
import argparse, hashlib, json, os, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
CATALOG = os.path.join(HERE, '..', 'console', 'catalog', 'community.json')

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--clones', required=True)
    ap.add_argument('--pin', action='append', default=[])
    ap.add_argument('--check', action='store_true')
    a = ap.parse_args()
    pins = dict(p.split('=', 1) for p in a.pin)
    with open(CATALOG, encoding='utf-8') as f:
        doc = json.load(f)
    changed = []
    for t in doc['tools']:
        if t['id'] in pins:
            t['commit'] = pins[t['id']]
            changed.append(f"{t['id']}: pinned to {t['commit']}")
        entries = list(t.get('files') or []) + list(t.get('scripts') or [])
        if not entries:
            continue
        clone = os.path.join(a.clones, t['repo'].replace('/', '_'))
        for f in entries:
            data = subprocess.check_output(['git', '-C', clone, 'show', f"{t['commit']}:{f['path']}"])
            sha = hashlib.sha256(data).hexdigest()
            if sha != f.get('sha256') or len(data) != f.get('bytes'):
                changed.append(f"{t['id']}: {f['path']}")
                f['sha256'], f['bytes'] = sha, len(data)
    for c in changed:
        print('changed', c)
    if a.check:
        sys.exit(1 if changed else 0)
    with open(CATALOG, 'w', encoding='utf-8') as f:
        f.write(json.dumps(doc, indent=2) + '\n')
    print(f"{len(changed)} change(s) written to {os.path.relpath(CATALOG)}")

if __name__ == '__main__':
    main()
