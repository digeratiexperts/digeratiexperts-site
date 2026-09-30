#!/usr/bin/env python3
"""Generate a Nano Banana 2 image through the kie.ai jobs API.

Usage:
  python3 generate_kie.py <prompt_json_file> <output_file> [aspect_ratio] [--dry-run]

The prompt file uses the Dense Narrative JSON format from SKILL.md. Two keys are
lifted out before the rest is stringified into `input.prompt`:
  - "image_input":    optional list of reference image URLs
  - "api_parameters": optional {aspect_ratio, resolution, output_format, google_search}

--dry-run prints the sanitized request payload and exits without any network call.
Requires KIE_AI_API_KEY (or KIE_API_KEY) in the environment or a project-root .env.
"""
import json
import os
import sys
from datetime import datetime, timezone

sys.dont_write_bytecode = True  # keep __pycache__ out of the repository
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _kie  # noqa: E402


def run():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = {a for a in sys.argv[1:] if a.startswith("--")}
    if len(args) < 2:
        print("Usage: python3 generate_kie.py <prompt_json_file> <output_file> [aspect_ratio] [--dry-run]")
        sys.exit(1)

    prompt_file, output_file = args[0], args[1]
    aspect_ratio = args[2] if len(args) > 2 else "auto"
    dry_run = "--dry-run" in flags

    with open(prompt_file, "r", encoding="utf-8") as f:
        prompt_json = json.load(f)

    image_input = prompt_json.pop("image_input", None)
    api_parameters = prompt_json.pop("api_parameters", {}) or {}
    prompt_string = json.dumps(prompt_json)

    payload = {
        "model": _kie.MODEL,
        "input": {
            "prompt": prompt_string,
            "aspect_ratio": api_parameters.get("aspect_ratio", aspect_ratio),
            "resolution": api_parameters.get("resolution", "1K"),
            "output_format": api_parameters.get("output_format", "jpg"),
        },
    }
    if "google_search" in api_parameters:
        payload["input"]["google_search"] = api_parameters["google_search"]
    if image_input:
        payload["input"]["image_input"] = image_input

    if dry_run:
        print(json.dumps({"endpoint": _kie.CREATE_URL, "payload": payload}, indent=2))
        print(f"(dry run) would save to {output_file}")
        sys.exit(0)

    api_key = _kie.load_api_key()

    print("Creating task via kie.ai API...")
    try:
        response = _kie.requests.post(_kie.CREATE_URL, headers=_kie.headers(api_key), json=payload, timeout=30)
        response.raise_for_status()
        result = response.json()
    except Exception as e:
        print(f"ERROR creating task: {e}")
        if "response" in locals() and response is not None:
            print(response.text)
        sys.exit(1)

    task_id = (result.get("data") or {}).get("taskId")
    if not task_id:
        print("ERROR: no taskId returned")
        print(json.dumps(result, indent=2))
        sys.exit(1)

    print(f"Task created. Task ID: {task_id}. Polling...")
    data = _kie.poll_until_done(api_key, task_id)
    state = data.get("state") or data.get("status")

    if _kie.is_success(state):
        urls = _kie.result_urls(data)
        if not urls:
            print("ERROR: no image URL in resultJson. Dumping data:")
            print(json.dumps(data, indent=2))
            sys.exit(1)
        print(f"Downloading image from {urls[0]}")
        try:
            _kie.download(urls[0], output_file)
        except Exception as e:
            print(f"ERROR downloading image: {e}")
            sys.exit(1)
        manifest = _kie.write_manifest(output_file, {
            "provider": "kie.ai",
            "taskId": task_id,
            "model": _kie.MODEL,
            "promptFile": os.path.abspath(prompt_file),
            "input": payload["input"],
            "resultUrls": urls,
            "creditsConsumed": data.get("creditsConsumed"),
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "classification": "ILLUSTRATIVE",
            "approvalStatus": "candidate",
        })
        print(f"Successfully saved to {output_file}")
        print(f"Manifest: {manifest}")
        sys.exit(0)

    if state == "timeout":
        print(f"ERROR: timed out waiting for task {task_id}. Retrieve later with get_kie_image.py {task_id} <output>")
        sys.exit(1)

    print("ERROR: task failed on server side.")
    print(json.dumps(data, indent=2))
    sys.exit(1)


if __name__ == "__main__":
    run()
