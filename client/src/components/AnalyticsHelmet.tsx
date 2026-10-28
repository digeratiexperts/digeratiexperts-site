import type { ComponentProps } from "react";
import { Helmet } from "react-helmet-async";
import { useLocation } from "wouter";
import { reportPageReady } from "@/lib/analytics";

/** Helmet uses the innermost instance's callback, so readiness belongs on the
 * page's title-bearing Helmet rather than the outer canonical-only instance. */
export function AnalyticsHelmet(props: ComponentProps<typeof Helmet>) {
  const [path] = useLocation();
  return <Helmet {...props} onChangeClientState={(state, added, removed) => {
    props.onChangeClientState?.(state, added, removed);
    if (state.title) reportPageReady(path, String(state.title));
  }} />;
}
