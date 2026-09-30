"""Shared helpers for the Nano Banana 2 (kie.ai) scripts.

Key lookup order:
  1. environment variables KIE_AI_API_KEY, then KIE_API_KEY
  2. a `.env` file found by walking up from the current directory, then from
     this script's directory (project-root `.env` is gitignored)

The key is never printed.
"""
import json
import os
import sys
import time

try:
    import requests
except ImportError:  # pragma: no cover
    sys.stderr.write("ERROR: the 'requests' package is required (pip install requests)\n")
    sys.exit(1)

API_BASE = "https://api.kie.ai"
CREATE_URL = f"{API_BASE}/api/v1/jobs/createTask"
RECORD_URL = f"{API_BASE}/api/v1/jobs/recordInfo"
CREDIT_URL = f"{API_BASE}/api/v1/chat/credit"
MODEL = "nano-banana-2"
KEY_NAMES = ("KIE_AI_API_KEY", "KIE_API_KEY")


def _walk_up(start, max_levels=8):
    d = os.path.abspath(start)
    for _ in range(max_levels):
        yield d
        parent = os.path.dirname(d)
        if parent == d:
            break
        d = parent


def _env_file_candidates():
    seen = []
    for start in (os.getcwd(), os.path.dirname(os.path.abspath(__file__))):
        for d in _walk_up(start):
            p = os.path.join(d, ".env")
            if p not in seen and os.path.isfile(p):
                seen.append(p)
    return seen


def _parse_env_file(path):
    values = {}
    with open(path, "r", encoding="utf-8") as f:
        for raw in f:
            line = raw.strip()
            if not line or line.startswith("#"):
                continue
            if line.startswith("export "):
                line = line[len("export "):].strip()
            if "=" not in line:
                continue
            k, v = line.split("=", 1)
            values[k.strip()] = v.strip().strip("\"'")
    return values


def load_api_key():
    for name in KEY_NAMES:
        v = os.environ.get(name, "").strip()
        if v:
            return v
    for path in _env_file_candidates():
        values = _parse_env_file(path)
        for name in KEY_NAMES:
            if values.get(name):
                return values[name]
    sys.stderr.write(
        "ERROR: no kie.ai key found. Set KIE_AI_API_KEY (or KIE_API_KEY) in the "
        "environment or in a project-root .env file.\n"
    )
    sys.exit(1)


def headers(api_key):
    return {"Content-Type": "application/json", "Authorization": f"Bearer {api_key}"}


def get_record(api_key, task_id, timeout=15):
    resp = requests.get(RECORD_URL, headers=headers(api_key), params={"taskId": task_id}, timeout=timeout)
    resp.raise_for_status()
    return resp.json().get("data") or {}


def result_urls(data):
    raw = data.get("resultJson", "{}")
    try:
        parsed = json.loads(raw) if isinstance(raw, str) else (raw or {})
    except json.JSONDecodeError:
        parsed = {}
    urls = parsed.get("resultUrls") or parsed.get("result_urls") or parsed.get("urls") or []
    return [u for u in urls if u]


def is_success(state):
    return state in ("success", "completed")


def is_failure(state):
    return state in ("fail", "failed", "error")


def download(url, output_file, timeout=60):
    out_dir = os.path.dirname(os.path.abspath(output_file))
    os.makedirs(out_dir, exist_ok=True)
    resp = requests.get(url, timeout=timeout)
    resp.raise_for_status()
    with open(output_file, "wb") as f:
        f.write(resp.content)


def write_manifest(output_file, payload):
    """Provenance sidecar next to the image (classification per design/IMAGERY.md)."""
    manifest_path = output_file + ".manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
        f.write("\n")
    return manifest_path


def poll_until_done(api_key, task_id, timeout_s=600, first_delay=4.0, max_delay=15.0):
    """Poll recordInfo until success/failure. Returns the final data dict."""
    started = time.time()
    delay = first_delay
    attempt = 0
    while time.time() - started < timeout_s:
        time.sleep(delay)
        attempt += 1
        try:
            data = get_record(api_key, task_id)
        except Exception as e:  # network hiccup: keep polling
            print(f"Poll {attempt}: error {e}")
            continue
        state = data.get("state") or data.get("status")
        print(f"Poll {attempt}: state = {state} ({int(time.time() - started)}s)")
        if is_success(state) or is_failure(state):
            return data
        delay = min(delay * 1.25, max_delay)
    return {"state": "timeout"}
