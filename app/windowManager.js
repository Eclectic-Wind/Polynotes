const {
  BrowserWindow,
  ipcMain,
  nativeTheme,
  Menu,
  screen,
} = require("electron");
const path = require("path");

class WindowManager {
  constructor() {
    this.mainWindow = null;
    this.noteWindows = [];
    this.lastNotePosition = { x: 0, y: 0 };
    this.isDragging = false;
    this.isResizing = false;
    this.dragStartPosition = { x: 0, y: 0 };
    this.dragStartMouseOffset = { x: 0, y: 0 };
    this.currentSize = { width: 0, height: 0 };
    this.lastUpdateTime = 0;
    this.frameInterval = 1;
    this.lastMousePosition = { x: 0, y: 0 };
    this.dragInterval = null;
  }

  createWindow() {
    this.mainWindow = new BrowserWindow({
      width: 400,
      height: 48,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
        sandbox: false,
      },
      frame: false,
      resizable: true,
      minWidth: 300,
      maxWidth: 750,
      minHeight: 48,
      maxHeight: 48,
      transparent: true,
      titleBarStyle: "hidden",
      vibrancy: "under-window",
      useContentSize: true,
    });

    const [width, height] = this.mainWindow.getSize();
    this.currentSize = { width, height };

    this.mainWindow.webContents.openDevTools({ mode: "detach" });

    this.mainWindow.loadFile(path.join(__dirname, "index.html"));
    this.mainWindow.setMenu(null);

    if (process.platform === "darwin") {
      this.mainWindow.setWindowButtonVisibility(false);
    }

    this.setupContextMenu();
    this.setupIPC();
    this.setupTheme();
    this.setupResizeListener();

    this.mainWindow.webContents.on("did-finish-load", () => {
      console.log("Main window loaded");
    });
  }

  createNoteWindow() {
    if (!this.mainWindow) {
      console.error("Main window is not initialized");
      return;
    }

    const mainBounds = this.mainWindow.getBounds();
    const { width: screenWidth, height: screenHeight } =
      screen.getPrimaryDisplay().workAreaSize;

    const isRight = mainBounds.x + mainBounds.width / 2 > screenWidth / 2;
    const isBottom = mainBounds.y + mainBounds.height / 2 > screenHeight / 2;

    const offsetX = isRight ? -20 : 20;
    const offsetY = isBottom ? -20 : 20;

    let x, y;

    if (this.noteWindows.length > 0) {
      const lastNote = this.noteWindows[this.noteWindows.length - 1];
      const lastNoteBounds = lastNote.getBounds();
      x = lastNoteBounds.x + offsetX;
      y = lastNoteBounds.y + offsetY;
    } else {
      x = isRight ? mainBounds.x + mainBounds.width - 1100 : mainBounds.x + 40;
      y = isBottom ? mainBounds.y - 620 : mainBounds.y + mainBounds.height + 20;
    }

    x = Math.max(0, Math.min(x, screenWidth - 700));
    y = Math.max(0, Math.min(y, screenHeight - 600));

    const noteWindow = new BrowserWindow({
      width: 700,
      height: 600,
      x: x,
      y: y,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
        sandbox: false,
      },
      parent: this.mainWindow,
      show: false,
    });

    noteWindow.loadFile(path.join(__dirname, "notes/note.html"));
    noteWindow.once("ready-to-show", () => noteWindow.show());

    this.noteWindows.push(noteWindow);

    noteWindow.on("closed", () => {
      const index = this.noteWindows.indexOf(noteWindow);
      if (index > -1) {
        this.noteWindows.splice(index, 1);
      }
    });

    this.lastNotePosition = { x, y };
  }

  setupContextMenu() {
    const contextMenu = Menu.buildFromTemplate([
      {
        label: "New Note",
        click: () => this.createNoteWindow(),
      },
      {
        label: "Toggle Theme",
        click: () => this.toggleTheme(),
      },
      { type: "separator" },
      {
        label: "Close Window",
        click: () => {
          if (this.mainWindow) {
            this.mainWindow.close();
          }
        },
      },
    ]);

    this.mainWindow.webContents.on("context-menu", (event, params) => {
      event.preventDefault();
      contextMenu.popup({ window: this.mainWindow, x: params.x, y: params.y });
    });
  }

  setupIPC() {
    ipcMain.on("close-window", () => {
      console.log("Close window event received in main process");
      if (this.mainWindow) {
        console.log("Attempting to close main window");
        this.mainWindow.close();
        console.log("Main window close method called");
      } else {
        console.log("Main window is null, cannot close");
      }
    });

    ipcMain.on("create-new-note", () => {
      console.log("Create new note event received");
      this.createNoteWindow();
    });

    ipcMain.on("request-theme-change", () => this.toggleTheme());

    ipcMain.on("ipc-debug", (event, message) => {
      console.log("IPC Debug:", message);
    });

    ipcMain.on("show-context-menu", (event) => {
      this.contextMenu.popup({
        window: BrowserWindow.fromWebContents(event.sender),
      });
    });

    ipcMain.on("start-drag", (event, mousePosition) => {
      if (!this.isDragging && !this.isResizing) {
        this.isDragging = true;
        const [windowX, windowY] = this.mainWindow.getPosition();
        this.dragStartPosition = { x: windowX, y: windowY };
        this.dragStartMouseOffset = {
          x: mousePosition.x - windowX,
          y: mousePosition.y - windowY,
        };
        const [width, height] = this.mainWindow.getSize();
        this.currentSize = { width, height };
        this.lastMousePosition = mousePosition;
        this.startDragLoop();
      }
    });

    ipcMain.on("drag", (event, currentMousePosition) => {
      if (this.isDragging) {
        this.lastMousePosition = currentMousePosition;
      }
    });

    ipcMain.on("end-drag", () => {
      this.isDragging = false;
      if (this.dragInterval) {
        clearInterval(this.dragInterval);
        this.dragInterval = null;
      }
    });
  }

  startDragLoop() {
    this.dragInterval = setInterval(() => {
      if (!this.isDragging) {
        clearInterval(this.dragInterval);
        this.dragInterval = null;
        return;
      }

      const currentTime = Date.now();
      if (currentTime - this.lastUpdateTime >= this.frameInterval) {
        const newX = Math.round(
          this.lastMousePosition.x - this.dragStartMouseOffset.x
        );
        const newY = Math.round(
          this.lastMousePosition.y - this.dragStartMouseOffset.y
        );
        this.mainWindow.setBounds({
          x: newX,
          y: newY,
          width: this.currentSize.width,
          height: this.currentSize.height,
        });
        this.lastUpdateTime = currentTime;
      }
    }, this.frameInterval);
  }

  setupResizeListener() {
    this.mainWindow.on("resize", () => {
      if (!this.isDragging) {
        const [width, height] = this.mainWindow.getSize();
        this.currentSize = { width, height };
      }
    });
  }

  setupTheme() {
    this.mainWindow.webContents.on("did-finish-load", () => {
      this.updateTheme();
    });

    nativeTheme.on("updated", () => {
      this.updateTheme();
    });
  }

  updateTheme() {
    const isDarkMode = nativeTheme.shouldUseDarkColors;
    this.mainWindow.webContents.send("update-theme", isDarkMode);
    this.noteWindows.forEach((window) => {
      window.webContents.send("update-theme", isDarkMode);
    });
  }

  toggleTheme() {
    const isDarkMode = nativeTheme.shouldUseDarkColors;
    nativeTheme.themeSource = isDarkMode ? "light" : "dark";
    this.updateTheme();
  }
}

module.exports = WindowManager;
