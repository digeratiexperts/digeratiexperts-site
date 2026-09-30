import { useEffect } from "react";

/**
 * /version-2 is Version B, a static build served by Express at /v2 outside
 * the SPA. The server redirects the initial request; this component covers
 * client-side navigation (a wouter Link) with a full page load.
 */
export default function VersionTwoForward(): JSX.Element {
  useEffect(() => {
    window.location.replace("/v2");
  }, []);
  return (
    <p className="p-8 font-mono text-sm text-white/70">
      Opening Version B at <a href="/v2" className="underline">/v2</a>…
    </p>
  );
}
