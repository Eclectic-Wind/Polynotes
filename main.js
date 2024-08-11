const { app, BrowserWindow } = require("electron");
const WindowManager = require("./app/windowManager");

let windowManager;

function createWindow() {
  windowManager = new WindowManager();
  windowManager.createWindow();
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
