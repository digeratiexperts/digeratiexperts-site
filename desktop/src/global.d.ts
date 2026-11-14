import type { DesktopNotificationEvent, PortalDestination } from "./security";

declare global {
  interface Window {
    deDesktop?: {
      platform: NodeJS.Platform;
      getVersion: () => Promise<string>;
      navigate: (destination: PortalDestination) => Promise<void>;
      showNotification: (event: DesktopNotificationEvent) => Promise<boolean>;
    };
  }
}

export {};
