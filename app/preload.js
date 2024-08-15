const { contextBridge, ipcRenderer } = require("electron");

console.log("Preload script starting");

contextBridge.exposeInMainWorld("electronAPI", {
  moveWindow: (mouseDelta) => ipcRenderer.send("move-window", mouseDelta),
  onUpdateTheme: (callback) =>
    ipcRenderer.on("update-theme", (event, isDarkMode) => callback(isDarkMode)),
  requestThemeChange: () => ipcRenderer.send("request-theme-change"),
  createNewNote: () => ipcRenderer.send("create-new-note"),
  debugIPC: (message) => ipcRenderer.send("ipc-debug", message),
  startDrag: (mousePosition) => ipcRenderer.send("start-drag", mousePosition),
  drag: (currentMousePosition) =>
    ipcRenderer.send("drag", currentMousePosition),
  endDrag: () => ipcRenderer.send("end-drag"),
  startResize: () => ipcRenderer.send("start-resize"),
  endResize: () => ipcRenderer.send("end-resize"),
});

// Debug: Log when API is exposed
console.log("electronAPI exposed to renderer");

window.addEventListener("DOMContentLoaded", () => {
  console.log("DOM content loaded in preload script");
  const replaceText = (selector, text) => {
    const element = document.getElementById(selector);
    if (element) element.innerText = text;
  };

  for (const dependency of ["chrome", "node", "electron"]) {
    replaceText(`${dependency}-version`, process.versions[dependency]);
  }
});
