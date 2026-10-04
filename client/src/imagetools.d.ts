// Types for vite-imagetools query imports (docs/CONTENT-TOOLING-PLAN.md).
declare module "*as=srcset" {
  const srcset: string;
  export default srcset;
}

declare module "*as=picture" {
  const picture: {
    sources: Record<string, string>;
    img: { src: string; w: number; h: number };
  };
  export default picture;
}

// Single-output transforms (e.g. `hero.jpg?w=1280&format=webp`) resolve to a URL.
declare module "*format=avif" {
  const src: string;
  export default src;
}

declare module "*format=webp" {
  const src: string;
  export default src;
}

declare module "*format=jpg" {
  const src: string;
  export default src;
}

declare module "*format=png" {
  const src: string;
  export default src;
}
