import { contextBridge, ipcRenderer } from "electron";
import type { DesktopNotificationEvent, PortalDestination } from "./security";

const desktopApi = Object.freeze({
  platform: process.platform,
  getVersion: (): Promise<string> => ipcRenderer.invoke("desktop:get-version"),
  navigate: (destination: PortalDestination): Promise<void> =>
    ipcRenderer.invoke("desktop:navigate", destination),
  showNotification: (event: DesktopNotificationEvent): Promise<boolean> =>
    ipcRenderer.invoke("desktop:notify", event),
});

contextBridge.exposeInMainWorld("deDesktop", desktopApi);
