import { useEffect, useRef } from "react";
import { MegaMenu } from "@/components/MegaMenu";
import { SiteBottomBar } from "@/components/SiteBottomBar";
import { DigeratiEnhancedFooterSection } from "./sections/DigeratiEnhancedFooterSection";
import { useSEO } from "@/hooks/useSEO";

/**
 * Experience v1 inside the site's own chrome (Joe, 2026-09-03: "show me it
 * with the site, not all by itself"). Review only: noindex, canonical to /.
 *
 * The story itself is the static Scrollcraft build under
 * public/scrollcraft/experience-v1 (one source of truth, also served on its
 * own at that path). This page fetches that build's HTML, keeps its story
 * (the skip link, the fixed world and <main>), drops its own bar and footer
 * in favour of the site's MegaMenu and footer, rewrites the relative asset
 * paths, and loads the engine and the glue as classic scripts, exactly as
 * the static page does. Nothing here changes the homepage.
 */
const BASE = "/scrollcraft/experience-v1/";

const CHROME_CSS = `
.x-host{position:relative;min-height:60vh}
/* in flow mode (phones, reduced motion) the story starts below the fixed menu */
html:not(.x-pin) .x-host{padding-top:112px}
/* the site's fixed menu covers the top of the pinned stage; keep the copy clear of it */
html.x-pin .x-m{padding-top:clamp(120px,16vh,160px)}
`;

export default function ExperienceInSite(): JSX.Element {
  useSEO({
    title: "Your environment isn't broken. It's been drifting.",
    description:
      "Digerati Experts maps the people, devices, cloud services, vendors and risks behind your business, then gives every part an owner, a boundary and a direction. Start with a Cyber Risk Assessment.",
    canonical: "/",
    noIndex: true,
  });
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const added: Element[] = [];
    const add = <T extends Element>(el: T, parent: Element = document.head): T => { parent.appendChild(el); added.push(el); return el; };

    (async () => {
      const res = await fetch(`${BASE}index.html`, { cache: "no-cache" });
      const html = await res.text();
      if (cancelled || !host.current) return;
      const doc = new DOMParser().parseFromString(html, "text/html");
      for (const el of Array.from(doc.querySelectorAll("[src],[srcset]"))) {
        for (const attr of ["src", "srcset"]) {
          const v = el.getAttribute(attr);
          if (v && v.startsWith("assets/")) el.setAttribute(attr, BASE + v);
        }
      }
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = `${BASE}scrollcraft.css`;
      add(link);
      const style = document.createElement("style");
      style.textContent = (doc.querySelector("style")?.textContent ?? "").replace(/url\("assets\//g, `url("${BASE}assets/`);
      add(style);
      const chrome = document.createElement("style");
      chrome.textContent = CHROME_CSS;
      add(chrome);
      host.current.innerHTML = [".x-skip", "#world", "main"].map((s) => doc.querySelector(s)?.outerHTML ?? "").join("");
      for (const file of ["scrollcraft.js", "experience.js"]) {
        if (cancelled) return;
        await new Promise<void>((resolve, reject) => {
          const s = document.createElement("script");
          s.src = `${BASE}${file}`;
          s.onload = () => resolve();
          s.onerror = () => reject(new Error(`${file} failed to load`));
          add(s, document.body);
        });
      }
    })().catch((err) => console.warn("[experience] could not mount the story", err));

    return () => {
      cancelled = true;
      added.forEach((el) => el.remove());
      document.documentElement.classList.remove("x-pin", "x-flow", "sc-ready");
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#050312] text-white">
      <MegaMenu />
      <SiteBottomBar />
      <div ref={host} className="x-host" data-testid="experience-host" />
      <DigeratiEnhancedFooterSection />
    </div>
  );
}
