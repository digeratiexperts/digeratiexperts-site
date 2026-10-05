# Content and webmaster tooling plan

Status: **adopted by Joe, 2026-10-04.** Step 1 shipped in this PR; later steps are listed with who acts.
Scope: DE Website, The Store, The Client Portal (this repo) and the Intelligence Hub (`digeratiexperts/Intelligence-Hub`).
Audience: every agent and IDE (Claude Code, Cursor, Codex / ChatGPT, Gemini / Antigravity) and Joe.

This file decides **which outside tools DE uses for the work Claude, ChatGPT and Cursor cannot do well on their own**: real images, vector icons, video, voice, and live search data, plus the finishing tools that make AI output webmaster-grade. If a task needs one of these capabilities, use the tool chosen here; do not sign up for an alternative from the "Not using" list without Joe's decision.

Prices come from vendor-comparison pages found by search on 2026-10-03, not from the vendors' own pricing pages. **Re-check the price at sign-up.**

## Rules that still apply

- `design/IMAGERY.md` and `design/PRODUCT_MEDIA.md` decide what imagery is allowed. Generated output is ILLUSTRATIVE until reviewed. **No AI images of people** standing in for DE staff, clients or offices; real photography wins (AGENTS.md evidence order).
- Store product media stays real vendor imagery. AI is for category art and promos only.
- Keys live in the environment or the gitignored `.env`, never in a committed file, chat, PR or log. `.env.example` lists the names.
- Generated SEO claims follow the Hub evidence chain (source → KB rule → approved claim → channel). An SEO tool's suggestion is not an approved claim.
- Paid tools spend money: run them only when Joe or the task asks for that output.

## Use (cheapest first)

| # | Tool | Cost | Projects | Job | Status |
|---|---|---|---|---|---|
| 1 | Chrome DevTools MCP | Free | Website, Store, Portal | Lighthouse audits (performance, a11y, SEO, best practices), traces, network, console from inside the agent | **Configured** (`.mcp.json`, `.cursor/mcp.json`) |
| 2 | axe-core via `@axe-core/playwright` | Free | Website, Store, Portal | WCAG A/AA scan in CI (`npm run smoke:a11y`) | **In CI** |
| 3 | `vite-imagetools` | Free | Website, Store | Build-time AVIF/WebP and responsive srcsets | **In `vite.config.ts`** |
| 4 | JSON-LD via `client/src/components/JsonLd.tsx` | Free | Website, Store, Blog | Organization, WebSite, Service, Product, Article, FAQ, Breadcrumb schema. Validate with Google's Rich Results Test | **Already live**; extend when a page lacks it |
| 5 | kie.ai (existing key) | Pay per use. Veo 3.1 Fast ≈ $0.10–0.12/s; Lite ≈ $0.05/s | Website, `/scrollcraft` | Images (Nano Banana, Flux, Midjourney), video (Veo, Kling, Runway), music (Suno) through one account | **In use** for images; video when a page needs it |
| 6 | DataForSEO (official MCP server) | $50 prepaid, credits never expire; ≈ $0.0006 per standard SERP call | Website / Blog, Hub research | Live keyword volumes, SERPs, competitor pages for Claude | Joe: create account |
| 7 | Canva (Brand Kit) | Pro ≈ $12–15/mo if not already on it | Store promos, social, PDFs | Brand-locked graphics for non-developers; Canva MCP already connects to Claude | Joe: confirm plan, load DE kit |
| 8 | Recraft (Basic or Pro) | ≈ $12–20/mo. **Free plan is not licensed for commercial use** | Website, Store, Portal | Native SVG icons and illustrations with style locks | **Skill built** (`/recraft-icons`); Joe: subscribe and set `RECRAFT_API_KEY` |
| 9 | Frase (Starter) | ≈ $39–49/mo | Website / Blog | SERP-based content scoring with a read-write MCP server | Decide after 30 days of #6 |

Baseline monthly cost: about $12–35 plus pay-per-use (kie.ai, DataForSEO after the $50). With Frase: about $55–85.

### Only for a named job

- **Relume** (≈ $32–40/mo): one month for a sitemap / information-architecture rework, then cancel. React export feeds this repo.
- **ElevenLabs Starter** (≈ $6/mo, commercial licence from Starter up): narrated Portal onboarding or explainer video only.

## Not using

| Tool | Why |
|---|---|
| Framer, Webflow | Hosted builders with lock-in (Framer cannot export for self-hosting). GitHub owns website code here. |
| Lovable, Bolt | Demo-grade output; Lovable pushes Supabase, which would be a second data stack the ecosystem rules forbid. |
| v0, Figma Make | Claude Code / Cursor already produce shadcn + Tailwind React; Figma Make only helps if DE designs in Figma first. |
| Surfer | No MCP server; costs more than Frase for less AI-search tracking. |
| Clearscope (≈ $129+/mo), MarketMuse (up to ≈ $999/mo) | Sized for large content teams. |
| Separate Midjourney / Runway / Kling subscriptions | kie.ai already covers them per use. |
| Adobe Firefly Foundry | Enterprise custom-model programme. |

## By project

- **Website:** #1–6, Recraft icons, Frase later. Real team / office photography for people.
- **Store:** real vendor product media; Recraft / Canva for category art and promos; Product JSON-LD (live); imagetools for every new raster.
- **Client Portal:** finishing only: axe in CI, Lighthouse via DevTools MCP, Recraft icons. No content generation. Lifecycle-status rules unchanged.
- **Intelligence Hub:** the research end. DataForSEO (and later Frase) MCP from Claude for keyword and competitor research; output enters the Hub evidence chain before any page uses it. No design tools.

## Setup

### Step 1: free finishing tools (this PR)

**Chrome DevTools MCP**: needs Node 20.19+ and Chrome stable on the machine.
- Claude Code: declared in the root `.mcp.json`; approve the project server when prompted, or run `claude mcp add chrome-devtools npx chrome-devtools-mcp@latest` for a user-level install.
- Cursor: declared in `.cursor/mcp.json`; enable it under Settings → MCP.
- Codex / ChatGPT CLI: add to `~/.codex/config.toml`:
  ```toml
  [mcp_servers.chrome-devtools]
  command = "npx"
  args = ["chrome-devtools-mcp@latest"]
  ```
- Gemini / Antigravity: add the same `command` / `args` under `mcpServers` in its MCP settings.
- Use: start the site (`npm run dev` or a production build), then ask the agent to run `lighthouse_audit` on the URL at mobile and desktop and fix what it reports. Rendered checks at 390 / 768 / 1440 still apply.

**Accessibility CI**: `scripts/a11y-smoke.mjs` runs axe (WCAG 2.0/2.1/2.2 A + AA) on every public route in `scripts/public-routes.mjs` (the same list the public-route smoke uses) plus the Store solution flow, `/quote-wizard` and the Client Portal login, signup and password pages: 30 routes at 390 and 1440, scanned settled with reduced motion. CI fails on **critical or serious** violations and prints the rest. Local run against a running server:
```bash
A11Y_BASE=http://127.0.0.1:3300 npm run smoke:a11y   # CHROME=/path/to/chrome if Playwright has no browser
```
Baseline: 2026-10-04 reported 6 serious `color-contrast` groups. On 2026-10-05 every one traced to axe reading text mid scroll-reveal (and opacity on a `display: contents` wrapper the browser never paints); the settled pages, screenshot-checked, have none. With reduced motion the scan reports 0 violations of any impact on all 30 routes, so the gate was raised to `critical,serious`. The scan adds about 2 minutes to CI.

**Image optimization**: `vite-imagetools` is registered in `vite.config.ts` and only acts on imports with a query:
```tsx
import heroAvif from "@/assets/hero.jpg?w=640;1280;1920&format=avif&as=srcset";
import heroWebp from "@/assets/hero.jpg?w=640;1280;1920&format=webp&as=srcset";
import heroFallback from "@/assets/hero.jpg?w=1280&format=jpg";

<picture>
  <source type="image/avif" srcSet={heroAvif} sizes="100vw" />
  <source type="image/webp" srcSet={heroWebp} sizes="100vw" />
  <img src={heroFallback} width={1280} height={720} alt="…" loading="lazy" decoding="async" />
</picture>
```
Source images live next to the code that imports them; reviewed, already-optimized files may still go under `client/public/images/` per `design/IMAGERY.md`.

### Step 2: Recraft
1. **Done:** the `recraft-icons` skill (`.claude/skills/recraft-icons/`, mirrored at `.agents/skills/`). It generates with `recraftv4_1_utility_vector`, cleans each SVG into a single-colour `currentColor` glyph that sits beside Lucide in `IconWell`, and writes candidates, manifests and a `review.html` sheet to `artifacts/recraft/icons/<set>/`. Offline tests run in CI (`npm run test:recraft-icons`).
2. Joe: subscribe to Basic or Pro (commercial rights need a paid plan) and put the key in `.env` as `RECRAFT_API_KEY`.
3. First run: `node .claude/skills/recraft-icons/scripts/recraft.mjs check`, then one `generate` for a concept Lucide lacks, review the sheet against Lucide at 20px, and approve per `IMAGERY.md`. Optionally lock the set with `create-style` from 2-5 approved icons.

### Step 3: DataForSEO
1. Create an account and prepay $50.
2. Add the official DataForSEO MCP server (see their docs for the current package and env names) with the API login in the environment, not in a committed file.
3. First job: keyword research for the top service pages; results feed the Hub, not straight into page copy.

### Step 4: video through kie.ai
Use the existing key with Veo Fast or Kling through `/scrollcraft` or `/video-to-website` when a page needs a hero loop. Set a monthly credit cap in the kie.ai dashboard first.

### Step 5: 30-day review
Decide Frase (keep / skip). Relume or ElevenLabs only with a named job.

## Sources (search summaries, 2026-10-03)

Recraft: eesel.ai/blog/recraft-ai-pricing, invideo.io/blog/recraft-ai-image-generator. Veo / Kling: invideo.io/blog/kling-3-vs-veo-3-1, costbench.com/compare/google-veo-vs-kling. kie.ai: glideapps.com/integrations/kieai. Frase vs Surfer: costbench.com/compare/frase-vs-surfer-seo, theaiagentindex.com/compare/surfer-seo-vs-frase. DataForSEO: contextbolt.com/blog/dataforseo-mcp-pricing. Relume: flowstep.ai/blog/relume-pricing. ElevenLabs: happyrobot.ai/hub/elevenlabs-pricing. Canva: aumiqx.com/ai-tools/canva-pro-pricing-free-vs-pro-vs-teams. Chrome DevTools MCP: datacamp.com/tutorial/chrome-devtools-mcp. Builder limits: aiagentrank.io/blog/framer-ai-review-2026, aiagentrank.io/blog/lovable-vs-bolt-vs-v0-2026. Imagery trust: emulent.com/resources/stock-vs-real-photos.
