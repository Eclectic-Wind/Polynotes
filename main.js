const { app, BrowserWindow, ipcMain } = require("electron");
const WindowManager = require("./app/windowManager");

let windowManager;

function createWindow() {
  windowManager = new WindowManager();
  windowManager.createWindow();
}

app.whenReady().then(() => {
  createWindow();
  setupIPCHandlers();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

function setupIPCHandlers() {
  ipcMain.handle("get-codemirror", () => {
    return {
      EditorState: CodeMirror.EditorState,
      EditorView: CodeMirror.EditorView,
      basicSetup: CodeMirror.basicSetup,
      markdown: markdown,
      syntaxHighlighting: syntaxHighlighting,
      HighlightStyle: HighlightStyle,
      tags: tags,
    };
  });

  ipcMain.handle("get-marked", () => {
    return marked;
  });

  ipcMain.handle("save-note", (event, content) => {
    // Implement note saving logic here
    console.log("Saving note:", content);
    return true; // Return true if save was successful
  });
}
