
      import React from "react";
      import { createRoot } from "react-dom/client";
      import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
      import PortalChat from "@/pages/portal/PortalChat";
      import { AdminLoginKnocks } from "@/pages/portal/AdminLoginKnocks";
      import PortalLearning from "@/pages/portal/PortalLearning";
      import "@/index.css";
      const screen = new URLSearchParams(location.search).get("screen");
      const Page = screen === "knocks" ? AdminLoginKnocks : screen === "learning" ? PortalLearning : PortalChat;
      const client = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
      createRoot(document.getElementById("root")!).render(
        <QueryClientProvider client={client}><Page /></QueryClientProvider>
      );
    