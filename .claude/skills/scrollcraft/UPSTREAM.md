# Vendored Scrollcraft skill

- Source: https://github.com/nateherkai/scroll-craft
- Upstream commit: `e95798551874854cef6dd3996ec7de1364a82bbd`
- Upstream path: `plugins/nateherk-design/skills/scrollcraft`
- Installed for: Claude Code project skill discovery
- Audited: 2026-09-01

The 22 upstream skill files are vendored byte-for-byte. `LICENSE` and this
provenance file were added by Digerati Experts.

## External-service boundary

The skill's optional `scripts/kie.mjs` sends prompts and explicitly selected
reference images to `api.kie.ai` and `kieai.redpandaai.co`, and may incur
third-party generation charges. Installing the skill does not make those calls
and does not add `KIE_AI_API_KEY`. Do not invoke that optional generator or add
its credential without explicit owner authorization for the specific build.
