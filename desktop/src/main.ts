import {
  app,
  BrowserWindow,
  type IpcMainInvokeEvent,
  ipcMain,
  Menu,
  nativeImage,
  Notification,
  Tray,
} from "electron";
import path from "node:path";
import {
  DEFAULT_PORTAL_ORIGIN,
  DESKTOP_NOTIFICATION_EVENTS,
  isAllowedPortalUrl,
  isDownloadAllowed,
  isRendererPermissionAllowed,
  parseDeepLink,
  portalUrl,
  PORTAL_DESTINATIONS,
  resolvePortalOrigin,
  type PortalDestination,
  type DesktopNotificationEvent,
} from "./security";

const development = !app.isPackaged;
const portalOrigin = resolvePortalOrigin(
  process.env.DE_PORTAL_ORIGIN || (development ? "http://localhost:5000" : DEFAULT_PORTAL_ORIGIN),
  development,
);

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
let pendingDestination: PortalDestination | null = null;
let lastNotificationAt = 0;

function isPortalDestination(value: unknown): value is PortalDestination {
  return typeof value === "string" && Object.hasOwn(PORTAL_DESTINATIONS, value);
}

async function showDestination(destination: PortalDestination): Promise<void> {
  if (!mainWindow) createWindow();
  if (!mainWindow) return;

  const destinationUrl = portalUrl(portalOrigin, destination);
  if (!isAllowedPortalUrl(destinationUrl, portalOrigin)) return;
  await mainWindow.loadURL(destinationUrl);
  mainWindow.show();
  mainWindow.focus();
}

function createWindow(): void {
  if (mainWindow && !mainWindow.isDestroyed()) return;

  const icon = nativeImage.createFromPath(path.join(__dirname, "..", "assets", "de-tray.png"));
  mainWindow = new BrowserWindow({
    width: 1220,
    height: 820,
    minWidth: 390,
    minHeight: 640,
    show: false,
    title: "Digerati Experts",
    backgroundColor: "#030228",
    autoHideMenuBar: true,
    ...(icon.isEmpty() ? {} : { icon }),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      partition: "persist:de-portal",
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  const portalSession = mainWindow.webContents.session;
  // Remote Portal content receives no Chromium permissions. Native notifications
  // are available only through the catalog-backed, origin-checked IPC below.
  portalSession.setPermissionCheckHandler(() => isRendererPermissionAllowed());
  portalSession.setPermissionRequestHandler((_webContents, _permission, callback) =>
    callback(isRendererPermissionAllowed()),
  );
  portalSession.on("will-download", (event) => {
    if (!isDownloadAllowed()) event.preventDefault();
  });

  mainWindow.webContents.on("will-navigate", (event, destinationUrl) => {
    if (!isAllowedPortalUrl(destinationUrl, portalOrigin)) event.preventDefault();
  });
  mainWindow.webContents.on("will-redirect", (event, destinationUrl) => {
    if (!isAllowedPortalUrl(destinationUrl, portalOrigin)) event.preventDefault();
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedPortalUrl(url, portalOrigin)) void mainWindow?.loadURL(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-attach-webview", (event) => event.preventDefault());

  mainWindow.once("ready-to-show", () => mainWindow?.show());
  mainWindow.on("minimize", () => mainWindow?.hide());
  mainWindow.on("close", (event) => {
    if (!quitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

}

function createTray(): void {
  const trayImage = nativeImage.createFromPath(path.join(__dirname, "..", "assets", "de-tray.png"));
  if (trayImage.isEmpty()) return;

  tray = new Tray(trayImage.resize({ width: 20, height: 20 }));
  tray.setToolTip("Digerati Experts");
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open DE Portal", click: () => void showDestination("dashboard") },
      { label: "DE Desk", click: () => void showDestination("desk") },
      { label: "Knowledge Base", click: () => void showDestination("knowledge") },
      { type: "separator" },
      { label: "My Tickets", click: () => void showDestination("tickets") },
      { label: "Submit a Ticket", click: () => void showDestination("newTicket") },
      { label: "Agents & Software", click: () => void showDestination("agents") },
      { label: "Forms & Paperwork", click: () => void showDestination("paperwork") },
      { type: "separator" },
      { label: "Account & Preferences", click: () => void showDestination("account") },
      {
        label: "Quit Digerati Experts",
        click: () => {
          quitting = true;
          app.quit();
        },
      },
    ]),
  );
  tray.on("click", () => void showDestination("dashboard"));
}

function handleDeepLink(value: string): void {
  const destination = parseDeepLink(value);
  if (!destination) return;
  if (!app.isReady()) {
    pendingDestination = destination;
    return;
  }
  void showDestination(destination);
}

function assertTrustedIpcSender(event: IpcMainInvokeEvent): void {
  const trustedWindow = mainWindow && !mainWindow.isDestroyed() ? mainWindow : null;
  const senderFrame = event.senderFrame;
  const trusted =
    trustedWindow !== null &&
    event.sender === trustedWindow.webContents &&
    senderFrame === trustedWindow.webContents.mainFrame &&
    isAllowedPortalUrl(senderFrame.url, portalOrigin);

  if (!trusted) throw new Error("Untrusted desktop IPC sender");
}

ipcMain.handle("desktop:get-version", (event) => {
  assertTrustedIpcSender(event);
  return app.getVersion();
});
ipcMain.handle("desktop:navigate", (event, destination: unknown) => {
  assertTrustedIpcSender(event);
  if (!isPortalDestination(destination)) throw new Error("Unsupported desktop destination");
  return showDestination(destination);
});
ipcMain.handle(
  "desktop:notify",
  (ipcEvent, eventId: unknown) => {
    assertTrustedIpcSender(ipcEvent);
    if (!Notification.isSupported()) return false;
    if (typeof eventId !== "string" || !Object.hasOwn(DESKTOP_NOTIFICATION_EVENTS, eventId)) return false;
    const now = Date.now();
    if (now - lastNotificationAt < 10_000) return false;

    const template = DESKTOP_NOTIFICATION_EVENTS[eventId as DesktopNotificationEvent];
    lastNotificationAt = now;
    const notification = new Notification({ title: template.title, body: template.body });
    notification.on("click", () => void showDestination(template.destination));
    notification.show();
    return true;
  },
);

const singleInstanceLock = app.requestSingleInstanceLock();
if (!singleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    const deepLink = argv.find((value) => value.startsWith("digeratiexperts:"));
    if (deepLink) handleDeepLink(deepLink);
    else void showDestination("dashboard");
  });
}

app.on("open-url", (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});
app.on("before-quit", () => {
  quitting = true;
});
app.on("activate", () => void showDestination("dashboard"));

void app.whenReady().then(() => {
  if (process.platform === "win32") app.setAppUserModelId("com.digeratiexperts.desktop");
  createWindow();
  createTray();

  const startupDeepLink = process.argv.find((value) => value.startsWith("digeratiexperts:"));
  if (startupDeepLink) {
    pendingDestination = null;
    handleDeepLink(startupDeepLink);
  } else if (pendingDestination) {
    const destination = pendingDestination;
    pendingDestination = null;
    void showDestination(destination);
  } else {
    void showDestination("dashboard");
  }
});
