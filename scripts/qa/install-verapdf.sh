#!/usr/bin/env bash
# Install the veraPDF CLI (PDF/UA validator) headlessly from Maven Central.
# Usage: scripts/qa/install-verapdf.sh <install-dir>   → prints the CLI path
# Needs Java 11+ on PATH (GitHub's ubuntu runners ship it).
set -euo pipefail
VERSION="1.30.2"
DEST="${1:?install dir required}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
curl -fsSL --retry 4 --retry-all-errors -o "$WORK/inst.zip" \
  "https://repo1.maven.org/maven2/org/verapdf/apps/installer/${VERSION}/installer-${VERSION}-installer.zip"
unzip -q "$WORK/inst.zip" -d "$WORK"
cat > "$WORK/auto.xml" <<XML
<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<AutomatedInstallation langpack="eng">
  <com.izforge.izpack.panels.htmlhello.HTMLHelloPanel id="welcome"/>
  <com.izforge.izpack.panels.target.TargetPanel id="install_dir"><installpath>${DEST}</installpath></com.izforge.izpack.panels.target.TargetPanel>
  <com.izforge.izpack.panels.packs.PacksPanel id="sdk_pack_select">
    <pack index="0" name="veraPDF GUI" selected="true"/>
    <pack index="1" name="veraPDF Mac and *nix Scripts" selected="true"/>
    <pack index="2" name="veraPDF Validation model" selected="false"/>
    <pack index="3" name="veraPDF Documentation" selected="false"/>
    <pack index="4" name="veraPDF Sample Plugins" selected="false"/>
  </com.izforge.izpack.panels.packs.PacksPanel>
  <com.izforge.izpack.panels.install.InstallPanel id="install"/>
  <com.izforge.izpack.panels.finish.FinishPanel id="finish"/>
</AutomatedInstallation>
XML
java -jar "$WORK"/verapdf-greenfield-*/verapdf-izpack-installer-*.jar "$WORK/auto.xml" >/dev/null
test -x "$DEST/verapdf"
echo "$DEST/verapdf"
