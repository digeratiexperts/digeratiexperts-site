#!/usr/bin/env python3
"""Print the kie.ai account credit balance. Verifies the key without spending credits.

Usage:
  python3 kie_credit.py
"""
import json
import os
import sys

sys.dont_write_bytecode = True  # keep __pycache__ out of the repository
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _kie  # noqa: E402


def run():
    api_key = _kie.load_api_key()
    try:
        resp = _kie.requests.get(_kie.CREDIT_URL, headers=_kie.headers(api_key), timeout=15)
    except _kie.requests.RequestException as e:
        print(f"ERROR reaching kie.ai: {e.__class__.__name__}: {e}")
        sys.exit(1)
    try:
        body = resp.json() if resp.content else {}
    except ValueError:
        body = {"raw": resp.text[:500]}
    print(json.dumps({"httpStatus": resp.status_code, "credit": body.get("data"), "msg": body.get("msg")}, indent=2))
    sys.exit(0 if resp.ok else 1)


if __name__ == "__main__":
    run()
