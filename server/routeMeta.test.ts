import fs from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { applyRouteMeta, routeMetaFor, type RouteMeta } from "./routeMeta";
import snapshot from "../shared/routeMeta.json";

const shell = fs.readFileSync(path.resolve(__dirname, "../client/index.html"), "utf8");
const count = (html: string, re: RegExp) => (html.match(re) || []).length;

const phoenix: RouteMeta = {
  title: "IT Support & Cybersecurity Services in Phoenix, AZ | Digerati Experts",
  description: 'Managed IT for Phoenix, with a "published" SLA <24/7>.',
  canonical: "/locations/phoenix-az",
  robots: "index, follow",
  ogImage: "https://digeratiexperts.com/og-image.png",
};

describe("applyRouteMeta", () => {
  it("replaces the shell's title, description and social tags with the route's", () => {
    const html = applyRouteMeta(shell, phoenix);
    expect(html).toContain("<title>IT Support &amp; Cybersecurity Services in Phoenix, AZ | Digerati Experts</title>");
    const desc = 'content="Managed IT for Phoenix, with a &quot;published&quot; SLA &lt;24/7&gt;."';
    expect(html).toContain(`<meta name="description" ${desc}>`);
    expect(html).toContain(`<meta property="og:description" ${desc}>`);
    expect(html).toContain(`<meta name="twitter:description" ${desc}>`);
    expect(html).toContain('<meta property="og:url" content="https://digeratiexperts.com/locations/phoenix-az">');
    expect(html).not.toContain("Managed Security Service Provider | Digerati Experts");
  });

  it("never duplicates a tag, and adds exactly one Helmet-adoptable canonical", () => {
    const html = applyRouteMeta(shell, phoenix);
    expect(count(html, /<title>/g)).toBe(1);
    expect(count(html, /<meta name="description"/g)).toBe(1);
    expect(count(html, /<meta property="og:title"/g)).toBe(1);
    expect(count(html, /<meta name="robots"/g)).toBe(1);
    expect(count(html, /rel="canonical"/g)).toBe(1);
    expect(html).toContain('<link rel="canonical" href="https://digeratiexperts.com/locations/phoenix-az" data-rh="true">');
  });

  it("makes a site-path og:image absolute", () => {
    const html = applyRouteMeta(shell, { title: "Post | Digerati Experts", ogImage: "/assets/covers/blog/x.png" });
    expect(html).toContain('<meta property="og:image" content="https://digeratiexperts.com/assets/covers/blog/x.png">');
    expect(html).toContain('<meta name="twitter:image" content="https://digeratiexperts.com/assets/covers/blog/x.png">');
  });

  it("leaves the shell untouched for a route with no snapshot", () => {
    expect(applyRouteMeta(shell, undefined)).toBe(shell);
  });

  it("does not treat $ patterns in page text as replacement syntax", () => {
    const html = applyRouteMeta(shell, { title: "Plans from $99 | $& $1", description: "Save $$ now" });
    expect(html).toContain("<title>Plans from $99 | $&amp; $1</title>");
    expect(html).toContain('<meta name="description" content="Save $$ now">');
  });
});

describe("routeMetaFor", () => {
  it("normalises case and trailing slashes like the SPA route check", () => {
    const meta = { "/pricing": { title: "Pricing" } };
    expect(routeMetaFor("/Pricing/", meta)?.title).toBe("Pricing");
    expect(routeMetaFor("/pricing?ref=x", meta)?.title).toBe("Pricing");
    expect(routeMetaFor("/nope", meta)).toBeUndefined();
  });

  it("covers every sitemap URL", () => {
    const xml = fs.readFileSync(path.resolve(__dirname, "../public/sitemap.xml"), "utf8");
    const paths = [...xml.matchAll(/<loc>https:\/\/digeratiexperts\.com([^<]*)<\/loc>/g)].map((m) => m[1].replace(/\/+$/, "") || "/");
    const titles = paths.map((p) => (snapshot as Record<string, RouteMeta>)[p]?.title);
    expect(titles.filter((t) => !t)).toEqual([]);
  });
});
