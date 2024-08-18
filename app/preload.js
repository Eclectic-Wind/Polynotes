const { contextBridge, ipcRenderer } = require("electron");

console.log("Preload script starting");

contextBridge.exposeInMainWorld("electronAPI", {
  moveWindow: (mouseDelta) => ipcRenderer.send("move-window", mouseDelta),
  onUpdateTheme: (callback) =>
    ipcRenderer.on("update-theme", (_, isDarkMode) => callback(isDarkMode)),
  onWindowMove: (callback) => ipcRenderer.on("apply-glow-effect", callback),
  requestThemeChange: () => ipcRenderer.send("request-theme-change"),
  createNewNote: () => ipcRenderer.send("create-new-note"),
  debugIPC: (message) => ipcRenderer.send("ipc-debug", message),
  startDrag: (mousePosition) => ipcRenderer.send("start-drag", mousePosition),
  drag: (currentMousePosition) =>
    ipcRenderer.send("drag", currentMousePosition),
  endDrag: () => ipcRenderer.send("end-drag"),
  startResize: () => ipcRenderer.send("start-resize"),
  endResize: () => ipcRenderer.send("end-resize"),
  getCodeMirror: () => ipcRenderer.invoke("get-codemirror"),
  getMarked: () => ipcRenderer.invoke("get-marked"),
  saveNote: (content) => ipcRenderer.invoke("save-note", content),
  showNoteContextMenu: () => ipcRenderer.send("show-note-context-menu"),
});

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
