import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from "electron";
import path from "path";
import isDev from "electron-is-dev";

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
    icon: nativeImage.createFromPath(path.join(__dirname, "../public/icon.png")),
  });

  const startUrl = isDev ? "http://localhost:5173" : `file://${path.join(__dirname, "../dist/index.html")}`;
  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.on("minimize", () => {
    mainWindow?.hide();
  });

  mainWindow.on("close", (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });
};

const createTray = () => {
  const icon = nativeImage.createFromPath(path.join(__dirname, "../public/tray-icon.png"));
  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    { label: "Submit Ticket", click: () => showTicketForm() },
    { label: "Live Chat", click: () => showChat() },
    { label: "Show Dashboard", click: () => showWindow() },
    { type: "separator" },
    { label: "Settings", click: () => showSettings() },
    { type: "separator" },
    { label: "Exit", click: () => quitApp() },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("click", showWindow);
};

const showWindow = () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  } else {
    createWindow();
  }
};

const showTicketForm = () => {
  showWindow();
  mainWindow?.webContents.send("navigate-to", "/portal/tickets/create");
};

const showChat = () => {
  showWindow();
  mainWindow?.webContents.send("navigate-to", "/portal/chat");
};

const showSettings = () => {
  showWindow();
  mainWindow?.webContents.send("navigate-to", "/portal/settings");
};

const quitApp = () => {
  app.isQuitting = true;
  app.quit();
};

app.on("ready", () => {
  createWindow();
  createTray();
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    showWindow();
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

ipcMain.handle("get-auth-token", async () => {
  return localStorage.getItem("authToken");
});

ipcMain.handle("get-user-email", async () => {
  return localStorage.getItem("userEmail");
});
