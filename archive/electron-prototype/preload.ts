import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  // Navigation
  navigateTo: (path: string) => ipcRenderer.send("navigate-to", path),
  onNavigate: (callback: (path: string) => void) => {
    ipcRenderer.on("navigate-to", (_, path) => callback(path));
  },

  // Auth
  getAuthToken: () => ipcRenderer.invoke("get-auth-token"),
  getUserEmail: () => ipcRenderer.invoke("get-user-email"),
  saveAuthToken: (token: string) => localStorage.setItem("authToken", token),
  saveUserEmail: (email: string) => localStorage.setItem("userEmail", email),

  // Secure API calls
  fetchAPI: async (endpoint: string, options: RequestInit = {}) => {
    const token = localStorage.getItem("authToken");
    const headers = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(`http://localhost:5000${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  },

  // Notifications
  showNotification: (title: string, message: string) => {
    ipcRenderer.send("show-notification", { title, message });
  },

  // Version info
  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
});

declare global {
  interface Window {
    electron: {
      navigateTo: (path: string) => void;
      onNavigate: (callback: (path: string) => void) => void;
      getAuthToken: () => Promise<string | null>;
      getUserEmail: () => Promise<string | null>;
      saveAuthToken: (token: string) => void;
      saveUserEmail: (email: string) => void;
      fetchAPI: (endpoint: string, options?: RequestInit) => Promise<any>;
      showNotification: (title: string, message: string) => void;
      getAppVersion: () => Promise<string>;
    };
  }
}
