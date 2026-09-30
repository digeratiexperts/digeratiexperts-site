#!/usr/bin/env python3
"""Fetch the result of an existing kie.ai task (for example after a poll timeout).

Usage:
  python3 get_kie_image.py <taskId> <output_file>
"""
import json
import os
import sys

sys.dont_write_bytecode = True  # keep __pycache__ out of the repository
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _kie  # noqa: E402


def run():
    if len(sys.argv) < 3:
        print("Usage: python3 get_kie_image.py <taskId> <output_file>")
        sys.exit(1)
    task_id, output_file = sys.argv[1], sys.argv[2]
    api_key = _kie.load_api_key()

    try:
        data = _kie.get_record(api_key, task_id)
    except _kie.requests.RequestException as e:
        print(f"ERROR reaching kie.ai: {e.__class__.__name__}: {e}")
        sys.exit(1)
    state = data.get("state") or data.get("status")
    if not _kie.is_success(state):
        print(f"Task incomplete: {state}")
        if _kie.is_failure(state):
            print(json.dumps(data, indent=2))
        sys.exit(1)

    urls = _kie.result_urls(data)
    if not urls:
        print("No URL found in resultJson")
        print(json.dumps(data, indent=2))
        sys.exit(1)

    print(f"Downloading image from {urls[0]}")
    _kie.download(urls[0], output_file)
    print(f"Successfully saved to {output_file}")


if __name__ == "__main__":
    run()
