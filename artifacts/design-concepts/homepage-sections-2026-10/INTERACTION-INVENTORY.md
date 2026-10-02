# Homepage interaction and craft inventory: live `/`

Read from source on 2026-10-01. Scope is `client/src/pages/DigeratiHomepage.tsx`, every section it imports, and the sub-components those sections render. Nothing here is inferred from screenshots. Each row gives the exact CSS, Tailwind or motion values and a `file:line`. Paths are relative to `client/src/` unless they start with `client/`.

Companion to `CONTENT-INVENTORY.md`, which covers copy. This file covers behavior, motion and treatment.

**Legend**
- **RM** = reduced-motion handling.
- **(gap)** = a behavior that is missing or inconsistent today. It is recorded so a redesign does not copy a defect by accident. It is not a feature.
- Row IDs (`G-01`, `H-07` …) are stable handles for review comments.

---

## 0. Global page behavior and shared grammar

These apply to every section below. A redesign that drops them changes every chapter at once.

| ID | Element | Exact behavior / values | Source |
|---|---|---|---|
| G-01 | Global reduced-motion kill switch | `@media (prefers-reduced-motion: reduce)`: all `animation-duration: 0.01ms !important`, `animation-iteration-count: 1`, `transition-duration: 0.01ms !important`, `scroll-behavior: auto`. Every CSS hover transition on the page collapses to instant under RM. | `index.css:88-100` |
| G-02 | Shared reveal preset (used by ~40 blocks) | `initial {opacity: 0.55, y: 12}` → `{opacity: 1, y: 0}`. Starts at **0.55 opacity, not 0**, so content is never invisible if JS is slow. `duration 0.3`, `ease [0.22, 1, 0.36, 1]` (expo-out). Viewport `once: true, amount: 0.08, margin "0px 0px 220px 0px"`, so the reveal fires **220px before** the block enters. Pixel margin on purpose; a comment notes that percentage margins break in some engines. | `lib/animations.ts:7-25` |
| G-03 | RM pattern for reveals | Every section passes `initial={prefersReducedMotion ? false : revealInitial}`, so RM users get the final state with no animation. | e.g. `pages/sections/DigeratiStatsSection.tsx:52` |
| G-04 | Card hover philosophy | "Lift only, no scale. Scale-on-hover reads as generic SaaS chrome." `cardHover` = `y: -3`, `0.18s easeOut`. | `lib/animations.ts:108-118` |
| G-05 | `.de-interactive-card` (dark cards) | Transition `border-color 0.2s ease-out, transform 0.18s ease-out, background-color 0.2s ease-out`. Hover lift is gated to `@media (hover: hover) and (pointer: fine)`: `border-color: rgb(var(--de-accent-rgb) / 0.72)` (magenta `211 18 106` on the homepage) and `translateY(-3px)`. `:active` → `translateY(0)`, which gives a press-down. `:focus-visible` → `outline 2px solid rgb(accent)`, `offset 2px`. RM keeps the border/bg transition and removes the transform. | `index.css:565-593`, accent token `index.css:226` |
| G-06 | `cardDarkInteractive` recipe | `rounded-xl border border-de-hairline bg-de-raised` + `de-interactive-card group` + `focus-visible:ring-2 ring-[#ec4899] ring-offset-2 ring-offset-[var(--de-bg)]`. | `components/home/HomeChapter.tsx:227-234` |
| G-07 | Button base (all homepage primary/secondary buttons) | `h-12 rounded-lg px-6`, `transition-[background-color,border-color,color,transform] duration-200 ease-out`, **`active:scale-[0.98]`** press, `motion-reduce:active:scale-100`, focus `ring-2 ring-[#ec4899] ring-offset-2`. | `components/home/HomeChapter.tsx:239-240` |
| G-08 | Primary button | `bg-[#D3126A]` → hover `#e01874`. Ring offset matches the field: `var(--de-paper)` on paper, `var(--de-bg)` on dark. | `components/home/HomeChapter.tsx:243-251` |
| G-09 | Secondary button | Dark: `border-white/20 bg-transparent` → hover `border-white/40 bg-white/5`. Paper: `border-[paper-hairline] bg-white` → hover `border-[#D3126A] text-de-magenta-paper-ink`. | `components/home/HomeChapter.tsx:254-261` |
| G-10 | Header text link + arrow nudge | `textLinkClass`: `min-h-11`, `transition-colors`, dark `text-de-magenta-ink (#F04C97)` → hover `#f0187a`; paper `text-de-magenta-paper-ink` → hover `#D3126A`. Arrow: `transition-transform duration-200 group-hover:translate-x-0.5` (2px nudge). | `components/home/HomeChapter.tsx:146-178` |
| G-11 | Eyebrow | `text-sm font-semibold uppercase tracking-[0.18em]`, magenta ink, preceded by a **`h-px w-6` rule in `bg-current`** (the short magenta dash before every eyebrow). | `components/home/HomeChapter.tsx:113-134` |
| G-12 | Chapter header layout | "split": at `lg` a 12-col grid, title `col-span-7`, lede `col-span-5 lg:pb-1`, `lg:items-end` (lede baseline-aligns to the title bottom). Title capped at `max-w-[24ch]`. Below `lg` it stacks. | `components/home/HomeChapter.tsx:180-220` |
| G-13 | Chapter field + seam | Every chapter is full-bleed `well (#050312)` / `surface (#0a0a0a)` / `paper (#f7f5f2)` with a 1px top hairline (`--de-hairline` white/10 on dark, `rgba(26,18,16,0.1)` on paper). One padding rhythm `py-14 md:py-16 lg:py-20`. | `components/home/HomeChapter.tsx:25-38` |
| G-14 | Shared canvas / gutters | `max-w-[var(--de-canvas)]` (100rem, which grows to `min(96vw,1920px)` and up on very large screens), gutters `px-5 sm:px-8 lg:px-10 xl:px-12`. Every heading sits on the hero's left edge. | `components/home/HomeChapter.tsx:41-42`, `index.css:235-278` |
| G-15 | Numbered index (01, 02 …) | `font-mono text-sm font-semibold tracking-[0.16em]`, magenta ink. Used in Why-we-exist, Tackle, Protect steps, Team roles. | `components/home/HomeChapter.tsx:264-269` |
| G-16 | IconWell (Lucide icon tile) | `h-11 w-11` (sm) / `h-12 w-12` (md), `rounded-xl border`. Dark: `bg-[#0a0a0a] border-hairline text-de-accent-ink`. Light: `bg-white border-paper-hairline`. **`transition-colors duration-200 group-hover:border-de-accent`**: the icon tile's border turns magenta whenever its parent `group` card is hovered. | `components/visual/IconWell.tsx:21-46` |
| G-17 | Hero gradient thread `.de-hero-accent` | `linear-gradient(90deg, #9a8bff, #7b6cff 45%, #d3126a)` clipped to text. Applied to **one word per heading** in a handful of sections (Stats "Real", Services "Managed IT", Proof "Outcomes", Team "your technology"). | `index.css:510-515` |
| G-18 | Magenta trailing colon | Several sub-headings end in `<span class="text-[#D3126A]" aria-hidden>:</span>` (Services "ProActive Ecosystem:", Newsletter "Stay Updated:", "Serving Greater Phoenix:"). | `pages/sections/DigeratiServicesSection.tsx:227-229`, `DigeratiNewsletterSection.tsx:128,217` |
| G-19 | Header theme probe (nav goes solid over paper) | On scroll (rAF), the provider finds the section under viewport Y = **96px** and publishes `data-header-theme` light/dark. Light sections: `challenges`, `protection`, `trust`, `faq`. | `components/FullPageScroll.tsx:36, 250-263, 409-412`; themes in `pages/DigeratiHomepage.tsx:33-48` |
| G-20 | Scroll spy "current section" | Picks the section containing viewport center, otherwise the nearest section center. Paused while a programmatic jump is in flight (`isScrollingRef`). | `components/FullPageScroll.tsx:216-248` |
| G-21 | Programmatic section jump | `scrollToSection`: adds `html.de-snap-suppress`, computes target = top − **predicted destination chrome height** (`--de-nav-h-scrolled` + `--de-spy-h` below lg), smooth scroll (instant under RM), pushes `#id` to history, then on `scrollend` (1200ms fallback) waits **80ms** (RM **320ms**, matching the 300ms utility-bar collapse) and corrects any drift > 2px. | `components/FullPageScroll.tsx:128-208` |
| G-22 | Hash deep links + back/forward | `popstate`/`hashchange` re-run the jump without pushing history; an initial `#hash` on load jumps after **100ms**. | `components/FullPageScroll.tsx:359-394` |
| G-23 | Section snap (dormant) | CSS `scroll-snap-type: y proximity` on `lg+` only, never on mobile or under RM. `isSnapEnabled` defaults **false**, and `toggleSnap` has no caller anywhere, so snap is currently off. When on: Arrow/Page keys jump chapter to chapter, Home/End go to the ends, form fields are exempt, and Escape turns snap off. | `components/FullPageScroll.tsx:112, 306-357`; `index.css:470-499` |
| G-24 | Chapter scroll margin | `.scroll-snap-chapter { scroll-margin-top: var(--de-nav-current-bottom) }`. Anchors land under the live sticky chrome, not under it. Chapters take natural height. A comment records that forced 100vh chapters left "empty black gaps" (Joe, 2026-09-30). | `index.css:460-468` |
| G-25 | Page shell | `de-dark-well min-h-screen bg-[#050312]`; `<main class="contents">` keeps one landmark without adding a box. | `pages/DigeratiHomepage.tsx:60, 68` |

---

## 1. Global chrome: MegaMenu, on-page spy, bottom dock, Ask DE

Live order: utility bar → main nav → spy row (desktop) → page → fixed bottom capsule.

| ID | Element | Exact behavior / values | Source |
|---|---|---|---|
| C-01 | Utility bar collapse on scroll | Fixed `z-[60]`, `lg+` only. At `scrollY > 50` (rAF-throttled) it goes `h-0 opacity-0 overflow-hidden pointer-events-none`, `transition-all duration-300`. | `components/MegaMenu.tsx:530-542, 679-686` |
| C-02 | Utility bar fade field | Base `#0a0a0a`, overlay `linear-gradient(90deg, #0a0a0a 0%, #0a0a0a 40%, rgba(18,8,31,0.8) 70%, rgba(13,6,20,0.9) 100%)`, which warms toward violet on the right. Bottom hairline lit **only on the right half**: `transparent 0–50% → rgba(139,92,246,0.3) 80% → 0.2`. | `components/MegaMenu.tsx:690-702` |
| C-03 | Assessment announcement strip | Black strip, `🚀` emoji, underlined "Start My Assessment" (hover `text-white/80`). Dismiss X `h-7 w-7`, hover `bg-white/10`. The dismissal **persists for the tab session** (`sessionStorage 'de-assessment-announce-dismissed'`). Hidden on `/book` and Door 2. | `components/MegaMenu.tsx:205-224, 705-733` |
| C-04 | Utility links | Phone, Support (Zoho Assist), Client Portal: `text-white/90` → hover `text-de-magenta-ink`, magenta icons. Labels shorten below `sm` ("Call", "Portal"). | `components/MegaMenu.tsx:735-767` |
| C-05 | Main nav glass + theme-aware solid | `bg-black/90 backdrop-blur-xl border-white/[0.05]`; once scrolled `bg-black/95 border-white/[0.08]`. Over a **light** section or with a menu open it switches to solid `bg-[#050312] border-white/[0.10] shadow-[0_10px_28px_rgba(0,0,0,0.45)]`. `transition-all duration-300`. Publishes `data-nav-theme over-light/over-dark`. | `components/MegaMenu.tsx:246-247, 771-784` |
| C-06 | Nav slides up when scrolled | Nav `top` goes from `var(--de-utility-h)` to `0`. Bar height goes from `--de-nav-h` to `--de-nav-h-scrolled`. Logo shrinks **`h-[3.25rem]` → `h-10`**, `transition-all duration-300`, `maxWidth 220px`. | `components/MegaMenu.tsx:772-773, 789-791, 798-810` |
| C-07 | Layout-stable offset | `--de-nav-offset` is kept at the worst case (utility + nav + spy + breathing room), so page padding **does not jump** when the utility bar collapses. `--de-nav-current-bottom` tracks the live bottom edge. | `components/MegaMenu.tsx:575-627` |
| C-08 | Nav item underline grow | `absolute bottom-1 left-1/2 -translate-x-1/2 h-0.5 bg-de-accent`: `w-0 → group-hover:w-full`, `transition-all duration-300`. The underline grows **from the center outward**. It stays `w-full` while that item's menu is open. | `components/MegaMenu.tsx:831, 856-858` |
| C-09 | Dropdown chevron | `ml-1 h-4 w-4 transition-transform`, `rotate-180` while open. | `components/MegaMenu.tsx:850-854` |
| C-10 | Hover intent + close delay | `mouseenter` opens at once. `mouseleave` closes after **150ms**, and entering the dropdown cancels that timer. Click toggles. Modified clicks (cmd/ctrl/shift/middle) follow the hub href. Click-outside closes, listening on the capture phase after a 0ms arm. | `components/MegaMenu.tsx:453-510` |
| C-11 | Menu keyboard | `Escape` closes the menu and drawer and returns focus to the trigger. With a menu open, `ArrowLeft`/`ArrowRight` move between top-level menus and focus them. | `components/MegaMenu.tsx:427-451` |
| C-12 | Dropdown panel | Opacity-only fade `0.15s`. No transform, on purpose, so `position:fixed` stays viewport-sized. Field `bg-[#0a0118] backdrop-blur-xl border-white/15 rounded-xl`, shadow `0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(139,92,246,0.2)` (violet halo). Width `min(98vw,92rem)` for Solutions/About, otherwise `min(96vw,72rem)`. | `components/MegaMenu.tsx:864-884` |
| C-13 | Dropdown textures | `NoiseTexture` + `DotMatrixTexture` on every dropdown; `CircuitLines` on Solutions only; `HexagonPattern` behind the featured panel. | `components/MegaMenu.tsx:18-90, 887-889, 1065` |
| C-14 | Staggered dropdown content | Columns fade with `delay: sectionIdx * 0.05`. Items `{opacity 0, y 8} → {1, 0}`, `delay itemIdx * 0.03`, `0.2s easeOut`. Featured panel `scale 0.95 → 1`, `delay 0.15`. **(gap)** No RM guard; framer runs these regardless. | `components/MegaMenu.tsx:909-915, 962-968, 1058-1064` |
| C-15 | Cursor-following spotlight (Solutions) | While hovering a Solutions column, a `radial-gradient(200px circle at {cursorX}px {cursorY}px, rgba(139,92,246,0.1), transparent 70%)` follows the pointer, rAF-throttled. | `components/MegaMenu.tsx:249-258, 918-933` |
| C-16 | Menu item hover | Row `rounded-xl border`: hovered → `bg-de-raised border-de-hairline`, otherwise `hover:bg-white/[0.03]`, `duration-200`. Icon `text-de-accent-ink/60` → full. Title `text-gray-200` → white. Description dims to `gray-400`. A Radix tooltip opens to the right (`zoom-in-95`, `duration-200`). | `components/MegaMenu.tsx:970-1035` |
| C-17 | "Explore" link arrow | `group/view-hover:translate-x-0.5`, text → `de-accent-ink`. | `components/MegaMenu.tsx:1043-1053` |
| C-18 | Overflow fade on tall dropdowns | When the dropdown scrolls and is not at the end: a `2.75rem` bottom fade `linear-gradient(to bottom, transparent, #0a0118 88%)`. | `components/MegaMenu.tsx:550-569, 1135-1137`; `index.css:1022-1031` |
| C-19 | Nav CTA label by breakpoint | Magenta button shows "Risk Assessment" at `lg` and "Cyber Risk Assessment" at `xl` (avoids truncation). | `components/MegaMenu.tsx:1148-1158` |
| C-20 | Mobile drawer | Opens below the live nav (`top: var(--de-nav-current-bottom)`). Scrim `bg-black/70` fades `300ms`. Panel `max-w-md bg-[#050312]` slides `translate-x-full → 0`, `duration-300 ease-out`. | `components/MegaMenu.tsx:1188-1212` |
| C-21 | Drawer "On this page" chips | Only `showInNav` chapters. Chips `border-de-hairline bg-de-raised` → hover `border-[#D3126A]`. Tap jumps to the chapter and closes the drawer. | `components/MegaMenu.tsx:1228-1253` |
| C-22 | Drawer stagger | Each nav row enters `translateX(20px) → 0` with `opacity`, `transitionDelay index * 50ms`. The contact block and CTA follow at `navItems.length * 50ms` and `+1 * 50ms`. | `components/MegaMenu.tsx:1257-1264, 1334-1339, 1391-1396` |
| C-23 | Drawer rows | Simple links: hover `text-[#D3126A]`, arrow `group-hover:translate-x-1`. Accordions use native `<details>`; chevron `rotate-180` and turns magenta on `group-open`, `duration-300`. | `components/MegaMenu.tsx:1266-1290` |
| C-24 | Spy row (desktop "On this page") | Only when unscrolled and `lg+`. Raised graphite `bg-[#151217]`, so it reads as "the page's instrument, not a second nav". Chapters: Home, Why DE, How It Works, Industries, Packages, Contact. Mono label "ON THIS PAGE" at `xl`. | `components/HomepageSectionNav.tsx:46-106`; mount `components/MegaMenu.tsx:1177-1185` |
| C-25 | Spy active pill glides | Shared `layoutId="home-spy-active"` pill `border-[#D3126A]/50 bg-[#D3126A]/15 rounded-full` **springs between chapters**: `stiffness 420, damping 38, mass 0.6`. RM: `duration 0`. | `components/HomepageSectionNav.tsx:125-136` |
| C-26 | Spy counter | Mono `01 / 06` (active position / total), `text-white/45` with a dimmer slash `white/25`. | `components/HomepageSectionNav.tsx:144-151` |
| C-27 | Read-progress hairline | `h-0.5 bg-[#D3126A] origin-left`, `scaleX = page scrollYProgress`. A comment calls it "the one hairline that moves, and only with the scroll". | `components/HomepageSectionNav.tsx:153-158` |
| C-28 | Spy height published | `--de-spy-h` comes from a ResizeObserver; the jump math (G-21) uses it. | `components/HomepageSectionNav.tsx:71-89` |
| C-29 | Bottom capsule show rules | The chapter menu expands only when `lg+`, `scrollY > 72`, the footer is **< 28% visible**, and cookie consent has been given. Scroll-to-top appears after `scrollY > 500`. | `components/HomepageSectionNav.tsx:163-217`; `components/SiteBottomBar.tsx:393-410` |
| C-30 | Capsule width tween | Animates CSS `width` (not scale/layout) between the compact action cluster and the full track: `0.4s easeOut`, plus inline `transition: gap 0.4s ease-out, padding 0.4s ease-out` so content does not hop. A comment explains that transform on a `backdrop-filter` node smeared the text. Resize publishing is debounced until the size holds for two frames. RM: `duration 0`. | `components/SiteBottomBar.tsx:33-35, 425-468, 517-542`; glass `index.css:396-418` |
| C-31 | Capsule glass | `rgba(10,10,10,0.95)` + `backdrop-filter: blur(24px)` on a static inset layer; `border-white/20 shadow-2xl rounded-full`. | `index.css:405-414`; `components/SiteBottomBar.tsx:519-543` |
| C-32 | Dock chapter pills | Active: `bg-de-magenta text-white shadow-lg shadow-[#D3126A]/40` plus a **glowing white dot** `h-1.5 w-1.5 shadow-[0_0_8px_rgba(255,255,255,0.85)]`. Inactive: `text-de-muted-soft` → hover `bg-white/10 text-white`. Lead-in "Protected?" with a shield at `xl`. | `components/HomepageSectionNav.tsx:246-280` |
| C-33 | Dock actions | Phone (number visible at `xl`) and "Risk Assessment" pill `bg-de-magenta shadow-[#D3126A]/35` → hover `de-magenta-hover`. Enters by width `0 → auto` + opacity, `0.4s`. | `components/HomepageSectionNav.tsx:287-313`; `components/SiteBottomBar.tsx:570-590` |
| C-34 | Scroll-to-top button | Grows `width 0rem → 2.5rem` + fade (`0.4s easeOut`). Smooth scroll to top, instant under RM. | `components/SiteBottomBar.tsx:500-505, 594-611` |
| C-35 | Dock hides while scrolling | `html[data-sticky-cta-scrolling="true"] .de-bottom-bar { opacity: 0 }` clears the dock off copy mid-scroll. All chrome steps aside when an overlay sets `data-dock-hidden` (`160ms` fade). | `index.css:432-437, 467-475` |
| C-36 | Ask DE launcher | White 32px glyph disc `shadow-[0_4px_14px_rgba(0,0,0,0.18)]`, **`group-hover:scale-[1.04]`** (`150ms`). Label "Ask DE / We're here to help." from `sm`. | `components/SiteBottomBar.tsx:300-322` |
| C-37 | Ask DE "breathe" ring | Until the nudge is dismissed: a `::before` ring at `inset -6px`, magenta-ink 55%, animates `scale(0.86)/opacity .9 → scale(1.18)/0` over **2.8s ease-out, exactly 3 times**, then stops. RM: none. | `components/SiteBottomBar.tsx:345-366` |
| C-38 | Ask DE nudge bubble | Arms **6s** after load (0 under RM), once per visitor, only after cookie consent, never while the Desk is open. Paper bubble `rounded-[14px_14px_4px_14px]` (speech-tail corner), `max-w-[240px]`, shadow `0 12px 40px rgba(0,0,0,0.5)`. The X has an enlarged `before:-inset-3` hit area. Fixed position, so no CLS. | `components/SiteBottomBar.tsx:61-93, 166-205, 327-345` |
| C-39 | Ask DE chooser | Desktop popover: `opacity 0, y 10, scale 0.98 → 1`, `0.18s easeOut`, `rounded-[24px] bg-[#fbfbfa]`, two-layer shadow, a **rotated-square tail** pointing at the launcher. Mobile: a bottom sheet `y 32 → 0` over a scrim `rgba(15,15,18,0.28)` (`0.15s`). Focus trap, Escape and outside-pointer close. Choice rows `min-h-[88px]` → hover `border-[rgba(211,18,106,0.45)]`, icon tile tint `0.08 → 0.14`, chevron `translate-x-0.5`. | `components/SiteBottomBar.tsx:56-60, 95-114, 207-297` |

---

## 2. Hero (`#hero`): `ReferenceHeroSection`

| ID | Element | Exact behavior / values | Source |
|---|---|---|---|
| H-01 | Lighting field | Three layers: `radial-gradient(ellipse 40% 60% at 80% 20%, rgba(87,68,255,0.22), transparent 70%)` (violet key light top-right), `radial-gradient(ellipse 30% 40% at 95% 85%, rgba(211,18,106,0.12), transparent 70%)` (magenta warmth low-right), and `linear-gradient(110deg, #050312 0%, #060617 52%, #090924 100%)`. | `pages/sections/ReferenceHeroSection.tsx:80-87` |
| H-02 | Phoenix city-lights plate | 50KB WebP (`de-hero-arizona-dusk-1600`), `opacity 0.42`, `object-position: center 60%`, `h-[112%] top:-6%` (overscan for parallax), `loading=eager fetchpriority=low`. | `pages/sections/ReferenceHeroSection.tsx:14-16, 90-104` |
| H-03 | Plate horizontal mask | `mask-image: linear-gradient(to right, rgba(0,0,0,0.18) 0%, rgba(0,0,0,0.3) 38%, rgba(0,0,0,0.9) 62%, black 100%)`. The city is nearly hidden under the headline and clear on the right. | `pages/sections/ReferenceHeroSection.tsx:105-108` |
| H-04 | Plate vertical vignette | `linear-gradient(180deg, rgba(5,3,18,0.6) 0%, rgba(5,3,18,0.08) 30%, …0.08 62%, rgba(5,3,18,0.85) 100%)`: dark under the nav, open in the middle, heavy at the bottom seam. | `pages/sections/ReferenceHeroSection.tsx:111-117` |
| H-05 | Plate scroll parallax | `useScroll` on the hero, offset `["start start","end start"]`; image `y: 0% → 9%` while the hero scrolls out. RM: `0% → 0%`. | `pages/sections/ReferenceHeroSection.tsx:58-66, 101` |
| H-06 | Copy column entrance | `{opacity 0, y 18} → {1, 0}`, `0.42s easeOut`, on mount (not in-view). RM: no initial state, duration 0. | `pages/sections/ReferenceHeroSection.tsx:123-127` |
| H-07 | Assessment card entrance | Slides in from the right: `{opacity 0, x 24} → {1, 0}`, `0.52s`, **delay 0.08s**, `easeOut`. The copy column leads and the card follows. | `pages/sections/ReferenceHeroSection.tsx:207-213` |
| H-08 | H1 type | `clamp(2.4rem, 4.4vw, 4.25rem)`, `line-height 1.04`, `letter-spacing -0.04em`, `#fbfaf8`. Line breaks are forced (`lg:block`) only at `lg`: "Cybersecurity-First / IT That Powers / Your Business". | `pages/sections/ReferenceHeroSection.tsx:132-141` |
| H-09 | "Your Business" gradient | `bg-gradient-to-r from-[#9a8bff] via-[#7b6cff] to-[#d3126a] bg-clip-text`, `w-fit` so the gradient spans only the words. This is the source of the `.de-hero-accent` thread (G-17). | `pages/sections/ReferenceHeroSection.tsx:138-140` |
| H-10 | Primary CTA | `h-12 rounded-lg bg-gradient-to-r from-[#5f4ae8] to-[#7d5cf4]` (the **only violet-gradient button on the page**), glow `box-shadow: 0 14px 36px -18px rgba(111,92,255,0.9)`, `hover:brightness-110`, arrow icon. | `pages/sections/ReferenceHeroSection.tsx:147-157` |
| H-11 | Secondary CTA | Outline `border-white/20` → hover `border-white/40 bg-white/5`, text stays white. | `pages/sections/ReferenceHeroSection.tsx:158-166` |
| H-12 | CTA stack | `flex-col` on phone, `sm:flex-row`. | `pages/sections/ReferenceHeroSection.tsx:146` |
| H-13 | Reassurance row | Check / Clock icons in `text-de-magenta-ink`. The phone link is **underlined `decoration-white/25 underline-offset-4`** → hover `decoration-white/50 text-white`, `min-h-11`. | `pages/sections/ReferenceHeroSection.tsx:169-186` |
| H-14 | Positioning line | "Assessment-led · Client-owned access · Fully managed or co-managed" with `text-white/30` middots; wraps cleanly. | `pages/sections/ReferenceHeroSection.tsx:188-199` |
| H-15 | Grid by breakpoint | Single column on phone. `lg: [minmax(0,1fr)_minmax(400px,520px)] gap-14`; `xl: [minmax(0,1fr)_minmax(440px,560px)] gap-16`. Top padding `calc(var(--de-nav-offset)+3rem)`, `+3.5rem` at lg. Card `justify-center` → `lg:justify-end lg:pt-1` (top-aligned with the headline). | `pages/sections/ReferenceHeroSection.tsx:120-122, 211` |
| H-16 | Card glow halo | `absolute -inset-6 rounded-3xl`, `radial-gradient(ellipse at center, rgba(91,69,224,0.18) 0%, transparent 68%)` behind the mockup. | `pages/sections/ReferenceHeroSection.tsx:215-222` |
| H-17 | Trust strip (paper row) | Attached to the hero bottom: `bg-[#f7f5f2] border-t border-black/10`. Label has a **2px magenta left rule** `border-l-2 border-[#D3126A] pl-4`, `tracking-[0.18em]`, two-tone (muted line + ink line). Items: grid `sm:2 → lg:4` with `lg:divide-x divide-black/10`, first/last padding trimmed. | `pages/sections/ReferenceHeroSection.tsx:229-247` |

### 2a. `DashboardMockup` (hero card)

| ID | Element | Exact behavior / values | Source |
|---|---|---|---|
| D-01 | Card entrance | `{opacity 0.6, y 12} → {1, 0}`, `0.32s easeOut`. RM off. | `components/graphics/DashboardMockup.tsx:49-55` |
| D-02 | Window chrome | `rounded-[16px] border-white/[0.12]`, body `linear-gradient(180deg, #17141c 0%, #121014 58%, #0c0a10 100%)`, shadow `0 20px 48px rgba(0,0,0,0.42), inset 0 1px 0 rgba(255,255,255,0.05)` (top-edge highlight). Title bar has three quiet traffic-light dots (`white/20`, `white/10`, `white/10`) and "Assessment overview". | `components/graphics/DashboardMockup.tsx:56-73` |
| D-03 | "Illustrative preview" tag | `text-[10px] uppercase tracking-[0.08em] border-white/10 bg-white/[0.04]`. Honest-labeling detail. | `components/graphics/DashboardMockup.tsx:85-87` |
| D-04 | Review-area tiles are live controls | Hover, focus or click a tile ("Identity & access" etc.) to make it active: border `#D3126A`, `bg-white/[0.06]`, icon tile border and icon turn magenta. The **matching posture bar highlights** and the score readout switches to "Identity posture 68 / 100". Mouse-leave/blur reverts to Overall. Click toggles. `aria-pressed`. Grid `1 col → 2 cols at min-[420px]`. | `components/graphics/DashboardMockup.tsx:90-128` |
| D-05 | Posture bars grow in | Each bar `height 40% → level%`, `0.32s easeOut`, staggered `delay 0.08 + index*0.03`. Overall bar `#D3126A` with `ring-1 ring-white/15`. Others grey; Backups is emerald `#34d399`. | `components/graphics/DashboardMockup.tsx:14-26, 147-180` |
| D-06 | Bar hover/focus | Every bar is a button. Hover/focus makes it active (`opacity-100`; inactive bars `opacity-55`) and the readout label and score follow. Focus ring `#D3126A/70`. | `components/graphics/DashboardMockup.tsx:149-177, 136-145` |
| D-07 | Bar labels | The active or Overall label is `font-medium text-white/80`, the rest `white/55`, truncated at `max-w-[16%]`. | `components/graphics/DashboardMockup.tsx:181-192` |
| D-08 | Outcomes list | Emerald `CheckCircle` icons, `text-[13px]`. | `components/graphics/DashboardMockup.tsx:195-202` |

### 2b. `PronunciationCard` (compact, under the hero copy)

| ID | Element | Exact behavior / values | Source |
|---|---|---|---|
| P-01 | Audio "Hear it" | Plays the fixed asset `/audio/digerati-pronunciation.wav` (identical on every device). If the file errors or play() rejects, it **falls back to speech synthesis** "dij-uh-RAH-tee" at rate `0.78`. Button fill `rgb(var(--de-accent-rgb))`, `hover:brightness-110`, `min-h-11`, focus `ring-white/70`. | `components/PronunciationCard.tsx:19-21, 176-198, 236-251` |
| P-02 | Syllable chips | DIJ · UH · **RAH** · TEE. Each chip speaks its syllable via synthesis. The stressed chip has `text-de-accent-ink` and border `rgb(accent / 0.5)`; others use the hairline. Hover `bg-white/5`. `title` tooltip hints ("as in digit", "stress here"). Disabled at 50% opacity if synthesis is missing. | `components/PronunciationCard.tsx:33-38, 253-283` |
| P-03 | **Wordmark doubles as a level meter (easter egg)** | The four gold DE wordmark bars (`#e7b20d`, traced from the logo) `scaleX` from the left through `[1, 0.62, 0.45, 0.62]`, offset per bar, every **150ms** (`ease-in-out`) while audio plays, giving a ripple. Disabled under RM. Driven by React state rather than `@keyframes`, on purpose, to stay inside the CSS bundle budget. | `components/PronunciationCard.tsx:40-50, 66-115` |
| P-04 | Headword | "DIG·ER·**A**·TI" with dim `white/40` interpuncts. The stressed **A** is accent ink with a **3px accent underline** (`border-bottom`, `paddingBottom 2`). Size `clamp(1.25rem, 4vw, 1.5rem)`. | `components/PronunciationCard.tsx:200-219` |
| P-05 | Phonetics | `\ ˌdi-jə-ˈrä-tē \` in mono, then "dij-uh-RAH-tee" mono semibold accent, `letter-spacing 0.04em`. | `components/PronunciationCard.tsx:221-234` |
| P-06 | Dictionary rail | A 3px accent vertical bar down the left edge, "the way a dictionary column marks a headword". | `components/PronunciationCard.tsx:301-306` |
| P-07 | Definition voice | Italic "plural noun", "digital" and "literati" at slightly brighter white (0.7 / 0.8) inside muted body copy. | `components/PronunciationCard.tsx:319-325` |
| P-08 | Live status | An `sr-only role=status aria-live=polite` line announces "Playing…", "Pronunciation finished." and error fallbacks. | `components/PronunciationCard.tsx:132, 161-172, 332-334` |
| P-09 | Cleanup | Unmount cancels speechSynthesis and pauses audio. | `components/PronunciationCard.tsx:139-147` |
| P-10 | Gold rule | Gold appears **only** in the wordmark bars, never as a CTA, numeral or fill (UI-STYLE-RULES). | `components/PronunciationCard.tsx:14-17` |

---

## 3. Why we exist (inside `#hero`): `DigeratiAlertBanner`

| ID | Element | Exact behavior / values | Source |
|---|---|---|---|
| W-01 | Seamless join to the hero | `HomeChapter tone="well" seam={false}`: no hairline, because the trust strip already draws the edge. | `pages/sections/DigeratiAlertBanner.tsx:40` |
| W-02 | Three reveal blocks | Header, list and CTA row each use the shared reveal (G-02) independently. | `pages/sections/DigeratiAlertBanner.tsx:42-47, 56-62, 88-94` |
| W-03 | Numbered manifesto list | `01 02 03` mono magenta indices. `md:grid-cols-3` with `md:divide-x divide-[var(--de-hairline)]` and a hairline top border; first/last padding trimmed. | `pages/sections/DigeratiAlertBanner.tsx:56-71` |
| W-04 | Arrow brightens and nudges | The title arrow is `text-white/40` → **hover `text-de-magenta-ink` + `translate-x-0.5`**, `duration-200`. The whole item is the link. | `pages/sections/DigeratiAlertBanner.tsx:73-78` |
| W-05 | Item focus | `rounded-lg focus-visible:ring-2 ring-[#ec4899] ring-offset-2 ring-offset-[var(--de-bg)]`. | `pages/sections/DigeratiAlertBanner.tsx:68` |
| W-06 | Closing CTA row | Primary magenta + secondary outline (with phone icon). Stacks on phone, `lg:flex-row lg:justify-between`. | `pages/sections/DigeratiAlertBanner.tsx:88-113` |

---

## 4. Stats (`#stats`): "The Threats Are Real"

| ID | Element | Exact behavior / values | Source |
|---|---|---|---|
| S-01 | Accent word | "Real" carries `.de-hero-accent`. | `pages/sections/DigeratiStatsSection.tsx:93-97` |
| S-02 | Staggered fact cards | Shared reveal with `delay: index * 0.04`. | `pages/sections/DigeratiStatsSection.tsx:51-57` |
| S-03 | Cards link to the primary source | When a fact has `sourceUrl` the whole card is an external link (`target=_blank rel=noopener`) using `cardDarkInteractive`: 3px lift, magenta 72% border, `:active` press-down (G-05). Without a URL it is a static `cardDark`. | `pages/sections/DigeratiStatsSection.tsx:58-72` |
| S-04 | Source line brightens on hover | Citation `— Source Year`, `text-white/55` → **`group-hover:text-white/85`**, above a hairline. | `pages/sections/DigeratiStatsSection.tsx:44-46` |
| S-05 | Metric type | `font-mono de-tabular-nums text-3xl md:text-4xl font-bold tracking-tight` (tabular figures). | `pages/sections/DigeratiStatsSection.tsx:40-42`; `index.css:111-114` |
| S-06 | IconWell border on hover | The card is a `group`, so the icon tile border turns magenta on hover (G-16). | `pages/sections/DigeratiStatsSection.tsx:39` |
| S-07 | Grid | `1 → sm:2 → lg:4`, `gap-4 lg:gap-5`, equal heights (`h-full flex-col`, statement `flex-1`). | `pages/sections/DigeratiStatsSection.tsx:103` |

---

## 5. Challenges (`#challenges`, paper): "What We Tackle"

| ID | Element | Exact behavior / values | Source |
|---|---|---|---|
| T-01 | Paper chapter | `tone="paper"` (#f7f5f2). This flips the nav to solid (G-19, C-05). | `pages/sections/DigeratiWhatWeTackleSection.tsx:56` |
| T-02 | Hairline problem grid | Three `<ul>` columns: `md:divide-x` and `divide-y` rows in paper hairline. On phone every row has a bottom hairline; from md that becomes `md:border-b-0`. Column padding is asymmetric (`md:pl-6` / `md:pr-6`) so the outer edges sit flush. | `pages/sections/DigeratiWhatWeTackleSection.tsx:74-89` |
| T-03 | Title turns magenta on hover | `h3 text-[#1A1228]` → `group-hover:text-de-magenta-paper-ink`, `transition-colors`. | `pages/sections/DigeratiWhatWeTackleSection.tsx:102-104` |
| T-04 | Arrow fades in and nudges | `text-[#5A5368]/40` → `group-hover:text-[#D3126A] translate-x-0.5`, `transition-all duration-200`. Sits top-right opposite the `01–06` index. | `pages/sections/DigeratiWhatWeTackleSection.tsx:95-100` |
| T-05 | Row focus | `focus-visible:ring-2 ring-[#ec4899] ring-offset-2 ring-offset-[var(--de-paper)]`. | `pages/sections/DigeratiWhatWeTackleSection.tsx:93` |
| T-06 | CTA opens a new tab | "Discuss Your Security Needs" → `/book` with `target="_blank"`. The only internal CTA on the page that opens a new tab; probably unintended. **(gap)** | `pages/sections/DigeratiWhatWeTackleSection.tsx:118-127` |

---

## 6. Services (`#services`): "Cybersecurity-First Managed IT"

| ID | Element | Exact behavior / values | Source |
|---|---|---|---|
| V-01 | Accent | "Managed IT" carries `.de-hero-accent`. | `pages/sections/DigeratiServicesSection.tsx:153-157` |
| V-02 | Path cards stagger | Shared reveal, `delay: index * 0.045`. | `pages/sections/DigeratiServicesSection.tsx:171-177` |
| V-03 | Featured card | The first card ("Fully Managed") has a permanent `border-[#D3126A]/60` and a **"FULL OPERATIONS" pill** `rounded-full border-[#D3126A]/60 text-[11px] tracking-[0.12em]`. On hover the border goes to 72% via `.de-interactive-card`. | `pages/sections/DigeratiServicesSection.tsx:169-194` |
| V-04 | Card hover | `cardDarkInteractive` (3px lift, magenta border, press). CTA text `text-de-magenta-ink` → `group-hover:text-[#f0187a]`, arrow `translate-x-0.5`. IconWell border turns magenta. | `pages/sections/DigeratiServicesSection.tsx:179-215` |
| V-05 | Capability tabs (Radix) | Six tabs. Trigger `min-h-11 rounded-lg border-hairline`; hover `bg-white/[0.03] text-white`; **active: `border-[#D3126A]` + `shadow-[inset_0_0_0_1px_#D3126A]`** (a doubled 2px magenta edge with no layout shift) and semibold. Icon `white/70` → magenta when active (`group-data-[state=active]`). Radix supplies arrow-key roving focus. | `pages/sections/DigeratiServicesSection.tsx:130-136, 237-259` |
| V-06 | Tab ids are slugs | `tabValue()` slugifies titles such as "SOC / MDR Monitoring" so the Radix aria ids are valid (axe critical fix). A unit test covers it. | `pages/sections/DigeratiServicesSection.tsx:76-84`; `DigeratiServicesSection.tabValue.test.ts` |
| V-07 | Phone tab scroller | Below md the tab list scrolls horizontally with the **scrollbar hidden** (`scrollbar-width:none`, `::-webkit-scrollbar hidden`) and a **right-edge fade** `w-8 bg-gradient-to-l from-de-bg`, `md:hidden`. From md the tabs wrap. | `pages/sections/DigeratiServicesSection.tsx:238-246` |
| V-08 | Tab panel | `cardDark` row: icon + title + description, with a "… details" text link on the right; stacks below sm. The panel has its own focus ring. | `pages/sections/DigeratiServicesSection.tsx:262-282` |
| V-09 | Sub-chapter seam | "ProActive Ecosystem:" block separated by `mt-14 border-t pt-10`; same split header as G-12 (`lg:col-span-7/5`). | `pages/sections/DigeratiServicesSection.tsx:222-235` |

---

## 7. Protection (`#protection`): eight-block command deck + "How protection works"

| ID | Element | Exact behavior / values | Source |
|---|---|---|---|
| R-01 | Chapter flips field at md | Paper chapter from md up. **Below md** it becomes dark: `max-md:bg-[var(--de-bg)] max-md:text-white max-md:border-[var(--de-hairline)]`, eyebrow `max-md:text-de-magenta-ink`, h2 `text-white md:text-[#1A1228]`, lede `text-white/70 md:text-[#3A3448]`. This follows Joe's approved 390px mock (2026-10-01). Gutter `max-md:px-4` (16px). | `pages/sections/DigeratiHowWeProtectSection.tsx:63-86` |
| R-02 | Heading scale on phone | `text-[26px] leading-[1.15] sm:text-3xl md:text-4xl`; lede `text-[15px] leading-[1.55]`. | `pages/sections/DigeratiHowWeProtectSection.tsx:78-85` |
| R-03 | Two complete layouts | `md:hidden` phone deck and `hidden md:block` desktop deck. They share one `selectedId` state. | `components/visual/ProtectionCommandDeck.tsx:279, 368` |
| R-04 | Phone: seven-label tab row | One line of seven short labels (`phoneLabel`, chosen so seven fit across 358px), `text-[11.5px] tracking-[-0.005em] pt-5 pb-2`. Selected: **`border-b-2 border-[#D3126A]` underline**, semibold white. Others `white/55`. `transition-colors`. | `components/visual/ProtectionCommandDeck.tsx:24-28, 280-299` |
| R-05 | Phone: continuous rail | "Risk & exposure" sits **under** the row as a full-width rail with a **dashed** top rule (`border-dashed`): `#F04C97/55`, solid `#D3126A` when selected. Right-aligned tag "CONTINUOUS · UNDER ALL SEVEN" `text-[10.5px] tracking-[0.08em] text-[#F04C97]`. Encodes "runs beneath the other seven". | `components/visual/ProtectionCommandDeck.tsx:300-321` |
| R-06 | Phone: plain-reading article | `aria-live=polite`. Name `22px` + "Answers {threat}" in `#F04C97`. The three questions are a hairline list with **2px × 10px magenta dashes** at `left-0 top-[21px]` and `last:border-b`, followed by a boundary `dl`. Content swaps instantly (no animation). | `components/visual/ProtectionCommandDeck.tsx:326-365` |
| R-07 | Phone: dock clearance | Bottom padding `calc(96px + var(--de-unified-bar-h, 3.5rem) + 0.75rem + env(safe-area-inset-bottom))` keeps the last lines clear of the Ask DE nudge and dock. | `components/visual/ProtectionCommandDeck.tsx:275-278, 328` |
| R-08 | Phone tabs keyboard | `role=tab` buttons with no ArrowLeft/Right handling and no `tabpanel` link. Tab key only. **(gap)** | `components/visual/ProtectionCommandDeck.tsx:280-321` |
| R-09 | Desktop: EvidenceFrame chrome | Dark frame `rounded-2xl border-de-hairline bg-de-raised shadow-lg shadow-black/25`. Header bar `bg-de-bg/60` with an "Illustration" badge (`bg-[#D3126A]/10 text-[#F04C97] border-[#D3126A]/30`, shield icon) and the status label "INTERACTIVE MODEL". The footer source note is mono `11px`. | `components/visual/ProtectionCommandDeck.tsx:369-378`; `components/evidence/EvidenceFrame.tsx:50-53, 78-126` |
| R-10 | Desktop: block chips | Eight mono `text-xs` chips. Selected: **solid magenta fill `bg-[#D3126A] border-[#D3126A] text-white`**. Unselected: paper chips `bg-white border-paper-hairline text-[#3A3448]` → hover `border-[#D3126A]/35`. Risk & exposure adds a "· continuous" suffix (`10px`, `#A30E52`, or `white/80` when selected). `aria-pressed`. | `components/visual/ProtectionCommandDeck.tsx:380-408` |
| R-11 | Desktop: panel cross-fade | `AnimatePresence mode="wait"`, keyed by block: exit `{opacity 0, y -8}`, enter `{opacity 0, y 8} → {1, 0}`, `0.2s`. Content leaves upward and arrives from below. **(gap)** No RM guard. | `components/visual/ProtectionCommandDeck.tsx:414-421` |
| R-12 | Desktop: three columns | `lg:grid-cols-12` → 4/4/4: (1) purpose + a paper "Questions the assessment should answer" card with magenta bullets; (2) `SecurityBoundary` perimeter `border-[#D3126A]/35` with paper `DiagramNode`s and a `ControlGate` (magenta status dot); (3) a raised scope column with paper tags and pink `#F04C97` icons. Paper chips on a dark frame are the deliberate "paper inside dark" contrast. | `components/visual/ProtectionCommandDeck.tsx:423-500`; `components/evidence/DiagramPrimitives.tsx:26-31, 66-76, 128-134` |
| R-13 | Mono continuous note | `font-mono text-[10px] uppercase tracking-wider text-white/60` under the chips. | `components/visual/ProtectionCommandDeck.tsx:409-411` |
| R-14 | "How protection works" steps | Surface chapter, header as `h3`. Four steps: IconWell + `01–04` index; `lg:divide-x` hairline columns, `sm:2 → lg:4`. "Learn more" `text-white/50` → **`group-hover:text-de-magenta-ink`**, arrow `translate-x-0.5`. Focus ring offset `var(--de-surface)`. **(gap)** This block has no reveal animation; every other block does. | `pages/sections/DigeratiHowWeProtectSection.tsx:95-134` |

---

## 8. Proof (`#testimonials`): client proof, reviews carousel, trust tabs

| ID | Element | Exact behavior / values | Source |
|---|---|---|---|
| X-01 | Accent | "Outcomes" carries `.de-hero-accent`. | `pages/sections/DigeratiTestimonialsSection.tsx:159-163` |
| X-02 | Reviews fetch with timeout | `/api/public/reviews`, aborted after **8000ms**. Any failure falls back to the approved catalog. | `pages/sections/DigeratiTestimonialsSection.tsx:83-105` |
| X-03 | Loading state | `Loader2 animate-spin` + "Loading reviews…" in `white/60`. | `pages/sections/DigeratiTestimonialsSection.tsx:179-183` |
| X-04 | Empty state (honest) | Star IconWell, "GOOGLE · YELP · THUMBTACK" in `tracking-[0.16em]`, the "We publish only real client reviews — never placeholders" copy, and a secondary "Read us on Google" button. | `pages/sections/DigeratiTestimonialsSection.tsx:242-268` |
| X-05 | Google average | Shown only when Google data is `ok` and the filter is All or Google: "4.9 · N on Google". With a single source: "From Google (published with permission)". | `pages/sections/DigeratiTestimonialsSection.tsx:121-127, 189-204` |
| X-06 | Source filter chips | Appear only when there are 2+ sources. `rounded-full min-h-11`. Selected `bg-[var(--de-magenta)] text-white`; others `bg-white/5 text-white/60` → hover `bg-white/10 text-white`. `role=tablist/tab`. | `components/ReviewsCarousel.tsx:176-219` |
| X-07 | Carousel auto-advance | Embla `scrollNext` every **7000ms**. **Pauses on hover and focus** (mouseenter/focus) and resumes on leave/blur. Off under RM. Loops only with 3+ reviews. Embla `duration 22` (0 under RM). | `components/ReviewsCarousel.tsx:16, 63-92` |
| X-08 | Slide sizing | `basis-[min(100%,22.5rem)] sm:basis-[min(80%,28rem)] lg:basis-[min(48%,32rem)]`, so the next card peeks at sm+. | `components/ReviewsCarousel.tsx:96-98` |
| X-09 | Review card | `rounded-2xl border-de-hairline bg-de-raised min-h-[14rem]`. **Amber stars** (`text-amber-300`; empty stars `opacity-40`). Source chip. Curly quotes `“…”`. Author · relative time. | `components/ReviewsCarousel.tsx:18-34, 101-115` |
| X-10 | Dot pager | 44×44 hit targets around 8px dots. Active **`scale-125 bg-[var(--de-magenta)]`**, others `white/25`, `transition`. | `components/ReviewsCarousel.tsx:128-151` |
| X-11 | Prev/next | `h-11 w-11 rounded-lg border-de-hairline bg-white/5 text-white/70` → hover `bg-white/10 text-white`. | `components/ReviewsCarousel.tsx:152-169` |
| X-12 | Carousel keyboard + SR | The shadcn carousel captures ArrowLeft/ArrowRight (`aria-roledescription=carousel/slide`). An `sr-only aria-live` line reads "Review 2 of 5: Name on Google". | `components/ui/carousel.tsx:88-93, 137-140`; `components/ReviewsCarousel.tsx:121-126` |
| X-13 | Listing links | "Read us on Google · Yelp · Thumbtack" in `text-de-magenta-ink` → hover `#f0187a`, separated by `white/25` middots. | `pages/sections/DigeratiTestimonialsSection.tsx:218-240` |
| X-14 | Layout | Reviews `lg:col-span-7`, outcomes `lg:col-span-5`, `lg:items-start`. The outcomes card has a hairline-divided list and a magenta primary CTA that opens the booking modal. | `pages/sections/DigeratiTestimonialsSection.tsx:169-301` |
| X-15 | Footer link row | Bill of Rights · Guarantee · Trust Center · Browse industries: magenta-ink links with `white/25` dots, plus a `text-sm white/55` service-area line with the phone number. | `pages/sections/DigeratiTestimonialsSection.tsx:304-338` |
| X-16 | Trust tabs (HomepageProofSection) | Same tab grammar as V-05 (inset 1px magenta active, icon turns magenta). Layout differs: **`grid-cols-2` on phone** (2×2 block, `whitespace-normal`), `lg:flex lg:flex-wrap`. | `pages/sections/HomepageProofSection.tsx:117-144` |
| X-17 | Trust tab panel + quiet nav | The panel CTA is magenta ink. Below a hairline sits a `<nav>` of all four surfaces as **quiet** links `text-white/50` → hover white. The "See reviews" anchor is a hash link back to `#google-reviews`. | `pages/sections/HomepageProofSection.tsx:63-104, 146-177` |
| X-18 | No reveals in HomepageProofSection | No framer reveal at all. **(gap)** | `pages/sections/HomepageProofSection.tsx:106-181` |

---

## 9. Trust (`#trust`, paper): "Protection that fits how you actually operate."

| ID | Element | Exact behavior / values | Source |
|---|---|---|---|
| U-01 | Paired side-in reveals | Copy column `{opacity .55, x -12} → {1, 0}`; photo column `{opacity .55, x 12} → {1, 0}`. The two halves **converge from opposite sides**, shared timing (0.3s expo-out). | `pages/sections/DigeratiTrustPhotoSection.tsx:42-48, 78-84` |
| U-02 | Solid magenta phrase | "how you actually operate." is solid `text-[#D3126A]`, not the gradient, because the gradient does not carry on paper. Title `max-w-[22ch]`. | `pages/sections/DigeratiTrustPhotoSection.tsx:52-54` |
| U-03 | Pillar list | `divide-y border-y` paper hairlines; light IconWells (white tile, paper-ink icon). | `pages/sections/DigeratiTrustPhotoSection.tsx:60-70` |
| U-04 | Photo in-frame parallax | `ParallaxStill travel={6}`: image `y: -6% → +6%` across the element's full pass through the viewport (`["start end","end start"]`), overscanned `top:-6% height:112%`. RM holds the still with no overscan. The component doc says not to use it on card grids, forms or FAQ. | `pages/sections/DigeratiTrustPhotoSection.tsx:86-94`; `components/visual/ParallaxStill.tsx:5-74` |
| U-05 | Photo frame + caption scrim | `aspect-[4/3] rounded-xl border-paper-hairline overflow-hidden`. Caption over `bg-gradient-to-t from-black/90 via-black/40 to-transparent p-5 pt-16`. | `pages/sections/DigeratiTrustPhotoSection.tsx:85, 95-100` |

---

## 10. Team (`#team`): "The people behind your technology"

| ID | Element | Exact behavior / values | Source |
|---|---|---|---|
| M-01 | Accent | "your technology" carries `.de-hero-accent`. | `pages/sections/DigeratiMeetExpertsSection.tsx:50-54` |
| M-02 | Founder portrait | `aspect-[3/4] object-cover object-[center_20%]` (framed on the face), lazy, 768×1024. | `pages/sections/DigeratiMeetExpertsSection.tsx:72-81` |
| M-03 | Glass location badge | "Chandler, Arizona HQ" pill: `absolute left-4 top-4 rounded-full border-white/15 bg-black/60 backdrop-blur-md text-xs`, magenta MapPin. | `pages/sections/DigeratiMeetExpertsSection.tsx:68-71` |
| M-04 | Name scrim | `bg-gradient-to-t from-black/90 via-black/40 to-transparent p-5 pt-14`. Title line `uppercase tracking-[0.14em] text-de-magenta-ink`. | `pages/sections/DigeratiMeetExpertsSection.tsx:82-87` |
| M-05 | Role cards | Static `cardDark` (no hover) with IconWell left and a `01–03` mono index right. | `pages/sections/DigeratiMeetExpertsSection.tsx:103-116` |
| M-06 | Layout | Portrait `lg:col-span-4`, copy `lg:col-span-8` with `justify-between` (the CTA sits at the bottom). Roles `sm:grid-cols-3`. | `pages/sections/DigeratiMeetExpertsSection.tsx:60-129` |

---

## 11. Industries (`#industries`)

| ID | Element | Exact behavior / values | Source |
|---|---|---|---|
| I-01 | **Grayscale → color photo on hover** (Joe's example) | Background-image layer `grayscale` → `group-hover:grayscale-0` **and** `group-focus-visible:grayscale-0` (keyboard users get the color reveal too), `transition-[filter] duration-300`. `bg-cover bg-center`. Present in both the desktop grid and the phone scroller. Under RM the filter still changes but instantly (G-01). | `pages/sections/DigeratiIndustriesSection.tsx:181-184, 237-240` |
| I-02 | Border turns magenta | Card frame `border-[var(--de-hairline)]` → `hover:border-[#D3126A]` and `group-focus-visible:border-[#D3126A]`, `transition-colors duration-200`. Border (200ms) and color (300ms) are slightly out of phase: the border lands first, then the photo blooms. | `pages/sections/DigeratiIndustriesSection.tsx:180, 236` |
| I-03 | Legibility scrim | Desktop `bg-gradient-to-t from-black/90 via-black/50 to-transparent`. Phone is heavier: `from-black/95 via-black/60 to-black/20` (the top never goes fully clear). | `pages/sections/DigeratiIndustriesSection.tsx:187, 243` |
| I-04 | IconWell border | Inside the `group` card the IconWell border also turns magenta on hover (G-16). Hover therefore changes three things: photo color, frame border, icon tile border. | `pages/sections/DigeratiIndustriesSection.tsx:191, 247` |
| I-05 | "View {industry}" arrow nudge | Desktop only: `transition-transform duration-200 group-hover:translate-x-0.5`. The phone card arrow is static. | `pages/sections/DigeratiIndustriesSection.tsx:199-202, 255-258` |
| I-06 | No lift on industry cards | They take no `de-interactive-card` / translate. Hover is color, border and arrow only. | `pages/sections/DigeratiIndustriesSection.tsx:229-261` |
| I-07 | Desktop stagger | Variants: container `opacity .7 → 1` with `staggerChildren 0.045`; each card `{opacity .55, y 12} → {1, 0}` with the shared transition. Variants are `undefined` under RM. | `pages/sections/DigeratiIndustriesSection.tsx:90-117, 221-235` |
| I-08 | Desktop grid | `hidden lg:grid grid-cols-5 gap-5`, cards `h-72`. | `pages/sections/DigeratiIndustriesSection.tsx:221-236` |
| I-09 | Phone/tablet scroller | Below lg: horizontal `snap-x snap-mandatory`, cards `w-[280px] h-[300px] snap-center`, hidden scrollbar, `px-2 pb-4`. | `pages/sections/DigeratiIndustriesSection.tsx:138, 167-180` |
| I-10 | Edge fades | `w-8` gradients `from-de-surface` on both edges, `z-10 pointer-events-none`. | `pages/sections/DigeratiIndustriesSection.tsx:163-165` |
| I-11 | Auto-hiding scroll arrows | Round `w-10 h-10 bg-black/80 backdrop-blur-sm border-white/20` chevrons. Each fades to `opacity-0 pointer-events-none` at its end (10px tolerance on the right), `transition-all`. Click scrolls **300px** smoothly. | `pages/sections/DigeratiIndustriesSection.tsx:63-88, 139-161` |
| I-12 | Indicator dots | Five `w-2 h-2 bg-white/20` dots. Static: they do not track position. **(gap)** | `pages/sections/DigeratiIndustriesSection.tsx:209-217` |
| I-13 | Image mapping quirk | Law Firms uses the *scales* image (`Rectangle-152058-1`); CPA uses the *books* image (`Rectangle-152058`). The swap is deliberate in source; keep it if reusing these files. | `pages/sections/DigeratiIndustriesSection.tsx:8-12, 27, 35` |
| I-14 | Section clipping | The chapter is `overflow-hidden`, so the scroller never causes horizontal page scroll. | `pages/sections/DigeratiIndustriesSection.tsx:120` |

---

## 12. Pricing (`#pricing`): `DigeratiPricingSection` + `EcosystemProgression`

| ID | Element | Exact behavior / values | Source |
|---|---|---|---|
| K-01 | Tier rail reveal | One reveal wraps the whole rail but passes **no `transition`**, so framer's default runs (y animates as a spring) instead of the shared 0.3s expo-out. Slightly different feel from the rest of the page. **(gap)** The header has no reveal. | `pages/sections/DigeratiPricingSection.tsx:21-35` |
| K-02 | Tier cards | `de-interactive-card` (3px lift, magenta border, press). Mono `01–04` in `white/50` (not magenta, unlike other indices). | `components/EcosystemProgression.tsx:66-76` |
| K-03 | Flagship card | Business: permanent `border-[#D3126A]/60` + **"FLAGSHIP CYBER" pill** (same recipe as Services V-03). | `components/EcosystemProgression.tsx:63, 69-81` |
| K-04 | Highlight bullets | Magenta middot `·` bullets above a `border-white/10` rule. | `components/EcosystemProgression.tsx:91-101` |
| K-05 | Card CTA | `text-de-magenta-ink` → `group-hover:text-[#f0187a]`, 3.5px arrow `translate-x-0.5`. | `components/EcosystemProgression.tsx:103-109` |
| K-06 | Grid | `1 → sm:2 → xl:4` (two columns through lg; four only at xl). | `components/EcosystemProgression.tsx:61` |

---

## 13. Insights (`#insights`): threats feed + detection & response

| ID | Element | Exact behavior / values | Source |
|---|---|---|---|
| N-01 | Threat cards = paper on the dark well | `de-paper-on-well`: white card, `border rgba(255,255,255,0.16)`, shadow `0 12px 36px rgba(0,0,0,0.42), 0 0 0 1px rgba(211,18,106,0.1)` (faint magenta ring), plus `de-interactive-card` lift. | `pages/sections/DigeratiThreatsInsightsSection.tsx:35-38`; `index.css:630-636` |
| N-02 | Card lifts though only one link | The whole card lifts and its border shifts on hover, yet only "Read source" is clickable. Hover implies a link that is not there. **(gap)** | `pages/sections/DigeratiThreatsInsightsSection.tsx:35-82` |
| N-03 | Severity badges | Critical `bg-red-50 text-red-700 border-red-200`; high `border-[#D3126A] text-[#A30E52]`; others neutral paper hairline. Category text shortens to its first word below `sm`; the date switches to short format below `sm`. | `pages/sections/DigeratiThreatsInsightsSection.tsx:27-52` |
| N-04 | Card typography | Kicker `text-xs uppercase tracking-[0.14em] text-[#D3126A]`. Title `line-clamp-2`, excerpt `line-clamp-3`. Mono source/vendor/CVE line, truncated. | `pages/sections/DigeratiThreatsInsightsSection.tsx:54-70` |
| N-05 | Category filter | Shown only with more than two categories. Pills `min-h-11 rounded-lg`; active uses the inset-magenta recipe; others `white/70` → hover `border-white/25 text-white`. Horizontal scroll, hidden scrollbar. | `pages/sections/DigeratiThreatsInsightsSection.tsx:161-186` |
| N-06 | Loading / empty states | Loading: "Checking CISA, FIRST, NVD, and Microsoft MSRC. Nothing is invented while this loads." Empty: explains the 45-day / exploitation threshold. Both are `cardDark max-w-2xl`. | `pages/sections/DigeratiThreatsInsightsSection.tsx:188-203` |
| N-07 | Adaptive desktop grid | 4+ items → `lg:grid-cols-2 xl:grid-cols-4`; fewer → `grid-cols-3`. Cards stagger in at `delay index*0.04`. | `pages/sections/DigeratiThreatsInsightsSection.tsx:130-133, 242-254` |
| N-08 | Phone scroller | Same pattern as Industries (I-09 to I-11) but cards are `w-[300px] sm:w-[340px]`, the scroll step is **320px**, and the edge fades are narrower (`w-6`). The arrow state re-checks when the filtered count changes. | `pages/sections/DigeratiThreatsInsightsSection.tsx:104-128, 206-240` |
| N-09 | Inline lede link | "Security Updates" is underlined `decoration-white/25 underline-offset-4` → hover `decoration-white/50` (same treatment as the hero phone link, H-13). | `pages/sections/DigeratiThreatsInsightsSection.tsx:152-154` |
| N-10 | Detection & response: mirrored side-in | Photo column `x -12` and copy column `x +12`, converging (as U-01). **Order swaps by breakpoint**: copy first on phone (`order-1`), photo left at lg (`lg:order-1`). | `pages/sections/DigeratiAIAssistanceSection.tsx:47-53, 73-79` |
| N-11 | Office photo parallax | `ParallaxStill travel={6}` (as U-04) in `aspect-[4/3] rounded-xl border-de-hairline bg-de-raised`. Glass tag "Arizona operations" (`bg-black/60 backdrop-blur-md`). Caption scrim `from-black/90 via-black/40`. | `pages/sections/DigeratiAIAssistanceSection.tsx:54-70` |
| N-12 | Capability checks | Magenta-ink `CheckCircle` icons, `text-white/85`. | `pages/sections/DigeratiAIAssistanceSection.tsx:91-98` |

---

## 14. Lead form (`#assessment-form`, paper; not a scroll-spy section)

| ID | Element | Exact behavior / values | Source |
|---|---|---|---|
| L-01 | Not a nav section | Rendered outside any `ScrollSectionAuto`, so it is invisible to the scroll spy and header-theme probe. The nav stays in whatever theme the previous section set. **(gap)** | `pages/DigeratiHomepage.tsx:127` |
| L-02 | Proof ticks | "Independent findings · No switch required · Arizona-based experts" each led by a **`h-px w-2.5` magenta dash** baseline-aligned at `mt-[0.55em]`. The same dash appears in the CTA section (Q-03). | `pages/sections/DigeratiLeadFormSection.tsx:146-153` |
| L-03 | Field focus | `h-12 bg-white border-paper-hairline` → `focus-visible:border-[#D3126A] ring-2 ring-[#D3126A]/40`. Placeholder `black/55`. Fields disable while submitting. | `pages/sections/DigeratiLeadFormSection.tsx:165-171` |
| L-04 | Submit states | `!bg-[#D3126A]` → hover `#e01874`; while submitting, `Loader2 animate-spin` + "Submitting…". Wraps (`whitespace-normal`) on narrow screens. Toasts report success/failure; the form resets on success. | `pages/sections/DigeratiLeadFormSection.tsx:75-90, 241-259` |
| L-05 | Benefit list | `divide-y border-y` paper hairlines; magenta 16px icons. | `pages/sections/DigeratiLeadFormSection.tsx:118-125` |

---

## 15. FAQ (`#faq`, paper) + compliance/newsletter (well)

| ID | Element | Exact behavior / values | Source |
|---|---|---|---|
| F-01 | **Magenta left rail on every FAQ row** | `.de-paper-faq-item`: white lift with `box-shadow: inset 3px 0 0 #d3126a` (a rail drawn in shadow, no border), `-6px 0 18px -8px rgba(211,18,106,0.28)` (**a magenta glow bleeding left**), and `0 8px 32px rgba(26,18,16,0.08)`. | `index.css:639-650` |
| F-02 | Row hover | Fine pointers only: `translateY(-1px)`; glow intensifies to `-8px 0 22px -6px rgba(211,18,106,0.36)` + `0 12px 36px …0.1`. Slow, soft transition: **0.55s `cubic-bezier(0.22,1,0.36,1)`** on shadow and transform. | `index.css:647-658` |
| F-03 | Open state keeps the glow | `.is-open` holds the hover shadow, so the open row stays "lit". | `index.css:659-664`; `pages/sections/DigeratiFAQSection.tsx:88` |
| F-04 | Row focus | `:has(:focus-visible)` → `outline 2px solid #d3126a offset 2px` on the whole card; the button also has an inset ring `ring-[#ec4899] ring-inset`. | `index.css:665-668`; `pages/sections/DigeratiFAQSection.tsx:91` |
| F-05 | Chevron disc | 40px round `bg-[#D3126A]/10` → `group-hover:/15`, `/15` when open. Rotates **180°** over `0.3s cubic-bezier(0.22,1,0.36,1)`. | `pages/sections/DigeratiFAQSection.tsx:101-108`; `index.css:669-676` |
| F-06 | Answer expand | `AnimatePresence initial={false}`: `{height 0, opacity 0} ↔ {height auto, opacity 1}`, `0.25s easeOut`, `overflow-hidden`. RM `duration 0`. The answer sits under a paper hairline. | `pages/sections/DigeratiFAQSection.tsx:111-133` |
| F-07 | Single-open accordion | One open at a time (`openIndex`); clicking the open row closes it. `aria-expanded` / `aria-controls`. | `pages/sections/DigeratiFAQSection.tsx:27, 48-50, 90-97` |
| F-08 | Row stagger | Reveal per row at `delay index*0.04`. | `pages/sections/DigeratiFAQSection.tsx:79-86` |
| F-09 | RM for FAQ CSS | No lift; the shadow transition shortens to `0.2s`; the chevron transition is removed. | `index.css:677-688` |
| F-10 | FAQ JSON-LD | `FAQJsonLd` emits structured data from the same array (SEO; nothing visible). | `pages/sections/DigeratiFAQSection.tsx:54` |
| F-11 | Compliance chips look interactive | Plain `<span>` chips carry `hover:border-[#D3126A] hover:text-white` and focus styles but are not links. The two partner chips are dimmer (`text-white/65`). **(gap)** The hover promises a link that is not there. | `pages/sections/DigeratiNewsletterSection.tsx:25, 109-116` |
| F-12 | Newsletter input on dark = paper field | `de-paper-field bg-[var(--de-paper)]` (warm paper input inside a dark card), hover `border-black/25`, focus `border-[#D3126A] ring-[#D3126A]/60`. Autofill is forced to paper (`-webkit-box-shadow 0 0 0 30px var(--de-paper) inset`). | `pages/sections/DigeratiNewsletterSection.tsx:171`; `index.css:1418-1425` |
| F-13 | Subscribe button | `hover:translate-y-0` explicitly cancels the base Button's hover lift. | `pages/sections/DigeratiNewsletterSection.tsx:179` |
| F-14 | Success state | Pops in `{opacity 0, scale 0.95} → {1, 1}` (framer default timing, **(gap)** no RM guard). Ringed shield disc `border-[#D3126A]/40`, "You're Subscribed!", ghost "Subscribe another email" link. | `pages/sections/DigeratiNewsletterSection.tsx:137-158` |
| F-15 | City grid with home highlight | Greater Phoenix chips, `grid-cols-2 sm:grid-cols-3`, full-width, `min-h-11`. **Chandler (HQ) is pre-highlighted** with the inset-magenta recipe; the others gain a magenta border on hover. | `pages/sections/DigeratiNewsletterSection.tsx:28, 224-240` |
| F-16 | Benefit chips | Same span-chip recipe with magenta icons (also hover-but-not-link, F-11). | `pages/sections/DigeratiNewsletterSection.tsx:198-205` |

---

## 16. Next step (`#cta`): "Start with a Cyber Risk Assessment"

| ID | Element | Exact behavior / values | Source |
|---|---|---|---|
| Q-01 | Email-gated booking | `noValidate` form with custom validation: empty → "Enter your work email."; bad format → "Enter a valid work email." On error the **input is re-focused**, and the error is `role=alert` magenta-ink text linked by `aria-describedby` and `aria-invalid`. Typing clears the error. A valid email opens the booking modal (it does not post). | `pages/sections/DigeratiCTASection.tsx:23, 40-55, 110-132` |
| Q-02 | Paper input with icon | `de-paper-field` paper input, `pl-11`, with a `Mail` icon at `left-3.5` in `white/45` (sits on paper). `text-[16px]` (avoids iOS zoom). `autoComplete=email inputMode=email`. | `pages/sections/DigeratiCTASection.tsx:108-126` |
| Q-03 | Magenta dash ticks | Operating points led by the `h-px w-2.5` magenta dash (as L-02). `sm:grid-cols-2`. | `pages/sections/DigeratiCTASection.tsx:82-93` |
| Q-04 | Phone link | `text-white underline-offset-2` → hover `text-de-magenta-ink underline` (the underline appears on hover only). | `pages/sections/DigeratiCTASection.tsx:146-152` |
| Q-05 | Jump to contact | "Or send a message below" `href="#contact"` text link (G-10); the hash handler animates the jump with chrome compensation (G-21/22). | `pages/sections/DigeratiCTASection.tsx:142-144` |
| Q-06 | Button width | `w-full sm:w-auto`. | `pages/sections/DigeratiCTASection.tsx:135` |

---

## 17. Contact (`#contact`) + footer

| ID | Element | Exact behavior / values | Source |
|---|---|---|---|
| Z-01 | **Bookend plate** | The hero's Phoenix city-lights image returns behind Contact "so the page ends where it began": `opacity 0.14` (fainter than the hero's 0.42), `object-position center 70%`, vertical mask `linear-gradient(to top, black 0%, rgba(0,0,0,0.5) 55%, transparent 100%)` (rises from the bottom). Static (no parallax), lazy. | `pages/sections/DigeratiContactSection.tsx:23-26, 153-169` |
| Z-02 | Violet drift echo | `radial-gradient(circle at 15% 20%, rgba(87,68,255,0.10), transparent 34%)` + `radial-gradient(circle at 88% 80%, rgba(211,18,106,0.06), transparent 30%)`. The lights sit at the **opposite corners** from the hero's, closing the loop. | `pages/sections/DigeratiContactSection.tsx:170-178` |
| Z-03 | Directory rows | Email / Phone / Office as hairline rows: hover `bg-white/[0.02]`, value `text-white/80` → `group-hover:text-white`, IconWell border → magenta. Phone gets `md:border-l md:pl-4`; Office spans both columns at md. Focus `ring-de-accent/60`. | `pages/sections/DigeratiContactSection.tsx:215-237` |
| Z-04 | Office hours | `dl` with `sm:grid-cols-[minmax(0,1fr)_auto]`. Label weight and color change at md (`font-medium white/80` → `md:font-normal md:text-white/60`). "24/7 Security Operations Center Always Active" in accent ink with a shield. | `pages/sections/DigeratiContactSection.tsx:239-254` |
| Z-05 | Social tiles | `h-11 w-11 rounded-lg border-de-hairline bg-de-raised text-white/60` → hover `border-white/25 text-white`. | `pages/sections/DigeratiContactSection.tsx:256-271` |
| Z-06 | Contact form (paper card on dark) | `cardPaper` white card. Fields `h-11`, focus `border-[#D3126A] ring-[#D3126A]/40`. Radix Select in the paper palette (`focus:bg-black/5`). Textarea `resize-none`. Submit spinner "Sending…". Toasts. The phone regex accepts `(480) 000-0000` style. | `pages/sections/DigeratiContactSection.tsx:41-55, 92-93, 281-445` |
| Z-07 | Optional `h1` mode | `headingAs="h1"` adds an accent-ink "?" (used when the component is the page H1 elsewhere). On the homepage it is `h2` with no accent. | `pages/sections/DigeratiContactSection.tsx:193-199` |
| Z-08 | Footer link underline in magenta | `underline decoration-transparent underline-offset-4` → **hover `decoration-[#D3126A]` + `text-white`**. The underline color fades in from transparent to magenta rather than appearing. External links open in a new tab automatically. | `pages/sections/DigeratiEnhancedFooterSection.tsx:10-22` |
| Z-09 | Footer newsletter | Dark input `bg-de-raised` with a **white** submit button (`bg-white text-[#1A1228]` → `hover:bg-white/90`), the inverse of the in-page newsletter. Send icon swaps to a spinner. Success: accent-ink check + "Thank you for subscribing!" | `pages/sections/DigeratiEnhancedFooterSection.tsx:169-211` |
| Z-10 | Footer CTA | `BookingLink` magenta button (store variant swaps to an outline "Back to Your Solution"). | `pages/sections/DigeratiEnhancedFooterSection.tsx:151-167` |
| Z-11 | Footer grid | `md:2 → lg:12` (brand `lg:col-span-4`, four link columns at `lg:col-span-2`). `<nav class="contents">` keeps the columns in the parent grid. Live `©` year. | `pages/sections/DigeratiEnhancedFooterSection.tsx:78, 127-248, 251-279` |
| Z-12 | Footer collapses the dock | Once the footer is more than 28% visible, the bottom capsule collapses back to compact (C-29). | `components/HomepageSectionNav.tsx:202-211` |

---

## Gaps found while reading (not features; do not copy blindly)

R-08 phone deck tabs have no arrow keys · R-11, C-14, F-14 animations without an RM guard (still JS-driven under RM) · R-14, X-18 blocks with no reveal while their neighbors have one · K-01 pricing reveal uses framer's default spring instead of the shared curve · N-02 and F-11 hover affordances on non-links · I-12 static carousel dots · T-06 internal CTA opens a new tab · L-01 lead form outside the scroll spy / theme probe · G-23 snap code is dormant (no `toggleSnap` caller).

---

## Must preserve in any redesign

Ranked by craft and brand value: how much the detail carries DE's identity or polish, and how hard it would be to notice it had gone missing.

1. **Pronunciation card with audio + synthesis fallback and the wordmark-as-level-meter** (P-01–P-06). Unique to DE: the gold wordmark bars ripple while "Digerati" plays, syllable chips speak, and the stressed "A" is underlined. Pure brand delight. Easy to lose in a "simplify the hero" pass.
2. **Industries grayscale → color reveal on hover *and* keyboard focus**, with the magenta border landing first (I-01, I-02, I-04). Joe's named example. Keep `group-focus-visible:grayscale-0`.
3. **Hero Phoenix plate: masked under the copy, parallax 0→9%, and the bookend return behind Contact at 0.14 opacity with mirrored lighting** (H-02–H-05, Z-01, Z-02). The page opens and closes on the same city.
4. **Hero lighting field + "Your Business" violet→magenta gradient, and the `.de-hero-accent` thread on one word in later headings** (H-01, H-09, G-17, S-01, V-01, X-01, M-01). The page's signature color story.
5. **Interactive DashboardMockup**: review tiles drive the posture bars and the score readout; bars grow in staggered (D-04–D-06). The hero visual is DE's own product, and it responds.
6. **Eight-block command deck, desktop and phone**: solid-magenta selected chip, the up/down panel cross-fade, the paper-inside-dark diagram, and on phone the seven-label underline row with the **dashed "continuous · under all seven" rail** (R-04, R-05, R-10–R-12). The visual encodes the service model itself.
7. **FAQ magenta left rail drawn in box-shadow, with a glow that bleeds left and deepens on hover/open, and a slow 0.55s expo-out lift** (F-01–F-05). Tactile and on-brand.
8. **Spy row: spring-gliding magenta pill (420/38/0.6), `01 / 06` mono counter, and the scroll-linked magenta read-progress hairline** (C-25–C-27). The quiet "instrument" feel of the nav.
9. **Shared reveal grammar: 0.55 opacity floor, 12px rise, 0.3s `[0.22,1,0.36,1]`, fires 220px early, once; mirrored ±12px side-ins for photo/copy pairs** (G-02, U-01, N-10). Gives the whole page one motion voice.
10. **Card hover grammar: 3px lift with no scale, magenta 72% border, `:active` press-down, IconWell border turning magenta with its card, fine-pointer-only** (G-04–G-06, G-16). Consistent and restrained by design.
11. **Bottom capsule: CSS-width tween (no transform, to keep the glass sharp), magenta active chapter pill with a glowing white dot, footer-aware collapse, and the Ask DE breathe ring that plays exactly 3 times then stops** (C-29–C-32, C-37). Careful engineering a rebuild could easily regress.
12. **Arrow-nudge + magenta-ink link vocabulary**: 2px `translate-x-0.5` arrows; Tackle titles inking magenta on hover; Why-we-exist arrows brightening from white/40; footer underlines fading from transparent to magenta (G-10, T-03, T-04, W-04, Z-08).
13. **Inset-1px-magenta "active" recipe** (border + `inset 0 0 0 1px`) across Services tabs, Proof tabs, threat filters and the pre-highlighted Chandler city chip (V-05, X-16, N-05, F-15). One selected-state language with no layout shift.
14. **Honest-state craft**: "Illustrative preview" / "Illustration" labels, reviews with an 8s timeout and catalog fallback, the "never placeholders" empty state, the threat feed's "Nothing is invented while this loads", stat cards linking to primary sources with the citation brightening on hover (D-03, R-09, X-02–X-05, N-06, S-03, S-04). Brand trust expressed as UI.
15. **Phone-specific choreography**: Protection chapter flips paper→dark below md per Joe's 390px mock; dock-clearance padding on the deck; scrollers with auto-hiding arrows, edge fades and snap; tab row with hidden scrollbar and edge fade (R-01, R-07, I-09–I-11, N-08, V-07). Recently approved work, invisible on a desktop review.

Also worth keeping, ranked lower: the reviews carousel's pause-on-hover/focus and 7s cadence (X-07); nav underline growing from center (C-08); the Solutions mega-menu cursor spotlight (C-15); the magenta eyebrow dash and trailing magenta colons (G-11, G-18); the paper input inside dark cards with autofill forced to paper (F-12, Q-02); the CTA email gate with refocus and alert (Q-01); chapter-jump math that compensates for collapsing chrome (G-21, C-07).
