#!/usr/bin/env bash
# Install or update signcheck on the portal server (Ubuntu/Debian).
#   sudo ./install.sh            first install into /opt/de-signcheck
#   sudo ./install.sh --update   refresh Microsoft's trusted root list (run monthly)
set -euo pipefail

PREFIX=${PREFIX:-/opt/de-signcheck}
SRC="$(cd "$(dirname "$0")" && pwd)"

if [[ "${1:-}" == "--update" ]]; then
  "$PREFIX/venv/bin/pip" install --upgrade --quiet mscerts
  echo "Trusted root list updated: $("$PREFIX/venv/bin/pip" show mscerts | grep Version)"
  exit 0
fi

command -v python3 >/dev/null || { echo "python3 is required"; exit 1; }
python3 -m venv --help >/dev/null 2>&1 || apt-get install -y python3-venv

mkdir -p "$PREFIX"
cp -r "$SRC/signcheck.py" "$SRC/signcheck.mjs" "$SRC/vendor" "$SRC/requirements.txt" "$PREFIX/"
[[ -f "$SRC/publishers.json" ]] && cp "$SRC/publishers.json" "$PREFIX/"
python3 -m venv "$PREFIX/venv"
"$PREFIX/venv/bin/pip" install --quiet --upgrade pip
"$PREFIX/venv/bin/pip" install --quiet -r "$PREFIX/requirements.txt"

# Smoke test: the scanner must import and run.
"$PREFIX/venv/bin/python" "$PREFIX/signcheck.py" --version
echo "Installed to $PREFIX"
echo "Set in the portal's .env:"
echo "  SIGNCHECK_PYTHON=$PREFIX/venv/bin/python"
echo "  SIGNCHECK_SCRIPT=$PREFIX/signcheck.py"
echo "  SIGNCHECK_PUBLISHERS=$PREFIX/publishers.json   (optional)"
