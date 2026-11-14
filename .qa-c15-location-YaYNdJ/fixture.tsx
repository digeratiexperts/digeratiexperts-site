
      import React from "react";
      import { createRoot } from "react-dom/client";
      import { BookingProvider } from "@/contexts/BookingContext";
      import { LocationServicePage } from "@/pages/locations/LocationServicePage";
      import { locationPageData } from "@/pages/routes/locationPages";
      import "@/index.css";
      createRoot(document.getElementById("root")!).render(
        <BookingProvider><LocationServicePage {...locationPageData["chandler-az"]} /></BookingProvider>
      );
    