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
    this.dragState = {
      isDragging: false,
      startPosition: { x: 0, y: 0 },
      startMouseOffset: { x: 0, y: 0 },
      lastMousePosition: { x: 0, y: 0 },
      interval: null,
    };
    this.currentSize = { width: 0, height: 0 };
    this.lastUpdateTime = 0;
    this.frameInterval = 1;
  }

  createWindow() {
    const { width: screenWidth, height: screenHeight } =
      screen.getPrimaryDisplay().workAreaSize;
    const windowWidth = 400;
    const windowHeight = 49;

    this.mainWindow = new BrowserWindow({
      width: windowWidth,
      height: windowHeight,
      x: Math.round((screenWidth - windowWidth) / 2),
      y: Math.round(screenHeight * 0.1),
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
        sandbox: false,
      },
      frame: true,
      resizable: true,
      minWidth: 300,
      maxWidth: 750,
      minHeight: 49,
      maxHeight: 49,
      transparent: false,
      titleBarStyle: "hidden",
      useContentSize: true,
      hasShadow: true,
    });

    this.currentSize = { width: windowWidth, height: windowHeight };

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

    const WINDOW_WIDTH = 700;
    const WINDOW_HEIGHT = 600;
    const INITIAL_OFFSET = 10;
    const CASCADE_OFFSET = 20;

    const { width: screenWidth, height: screenHeight } =
      screen.getPrimaryDisplay().workAreaSize;
    const mainWindowBounds = this.mainWindow.getBounds();

    let noteX, noteY;

    // Determine the position of the main window
    const isLeft = mainWindowBounds.x < screenWidth * 0.3;
    const isRight =
      mainWindowBounds.x + mainWindowBounds.width > screenWidth * 0.7;
    const isTop = mainWindowBounds.y < screenHeight * 0.3;
    const isBottom =
      mainWindowBounds.y + mainWindowBounds.height > screenHeight * 0.7;
    const isMiddleX = !isLeft && !isRight;
    const isMiddleY = !isTop && !isBottom;

    // Set initial position based on main window position
    if (isTop) {
      // Top-left and Top-right: spawn directly below
      noteX = mainWindowBounds.x + (mainWindowBounds.width - WINDOW_WIDTH) / 2;
      noteY = mainWindowBounds.y + mainWindowBounds.height + INITIAL_OFFSET;
    } else if (isBottom) {
      // Bottom-left and Bottom-right: spawn directly above
      noteX = mainWindowBounds.x + (mainWindowBounds.width - WINDOW_WIDTH) / 2;
      noteY = mainWindowBounds.y - WINDOW_HEIGHT - INITIAL_OFFSET;
    } else if (isLeft && isMiddleY) {
      // Middle-left: spawn right
      noteX = mainWindowBounds.x + mainWindowBounds.width + INITIAL_OFFSET;
      noteY =
        mainWindowBounds.y + (mainWindowBounds.height - WINDOW_HEIGHT) / 2;
    } else if (isRight && isMiddleY) {
      // Middle-right: spawn left
      noteX = mainWindowBounds.x - WINDOW_WIDTH - INITIAL_OFFSET;
      noteY =
        mainWindowBounds.y + (mainWindowBounds.height - WINDOW_HEIGHT) / 2;
    } else if (isMiddleX && isMiddleY) {
      // Middle-middle: spawn in the center and move main window above
      noteX = (screenWidth - WINDOW_WIDTH) / 2;
      noteY = (screenHeight - WINDOW_HEIGHT) / 2;

      // Move the main window above the new note
      const newMainWindowY = noteY - mainWindowBounds.height - INITIAL_OFFSET;
      this.mainWindow.setPosition(
        (screenWidth - mainWindowBounds.width) / 2,
        Math.max(0, newMainWindowY)
      );
    } else {
      // Middle-top: spawn below
      noteX = mainWindowBounds.x + (mainWindowBounds.width - WINDOW_WIDTH) / 2;
      noteY = mainWindowBounds.y + mainWindowBounds.height + INITIAL_OFFSET;
    }

    // Apply cascading effect for subsequent windows
    if (this.noteWindows.length > 0) {
      const lastNote = this.noteWindows[this.noteWindows.length - 1];
      const lastNoteBounds = lastNote.getBounds();

      if (isLeft && isTop) {
        // Top-left: cascade down-right
        noteX = lastNoteBounds.x + CASCADE_OFFSET;
        noteY = lastNoteBounds.y + CASCADE_OFFSET;
      } else if (isRight && isTop) {
        // Top-right: cascade down-left
        noteX = lastNoteBounds.x - CASCADE_OFFSET;
        noteY = lastNoteBounds.y + CASCADE_OFFSET;
      } else if (isLeft && isBottom) {
        // Bottom-left: cascade up-right
        noteX = lastNoteBounds.x + CASCADE_OFFSET;
        noteY = lastNoteBounds.y - CASCADE_OFFSET;
      } else if (isRight && isBottom) {
        // Bottom-right: cascade up-left
        noteX = lastNoteBounds.x - CASCADE_OFFSET;
        noteY = lastNoteBounds.y - CASCADE_OFFSET;
      } else if (isMiddleX && (isTop || isMiddleY)) {
        // Middle-top and Middle-middle: cascade down
        noteX = lastNoteBounds.x;
        noteY = lastNoteBounds.y + CASCADE_OFFSET;
      } else if (isMiddleX && isBottom) {
        // Middle-bottom: cascade up
        noteX = lastNoteBounds.x;
        noteY = lastNoteBounds.y - CASCADE_OFFSET;
      } else if (isLeft && isMiddleY) {
        // Middle-left: cascade right
        noteX = lastNoteBounds.x + CASCADE_OFFSET;
        noteY = lastNoteBounds.y;
      } else if (isRight && isMiddleY) {
        // Middle-right: cascade left
        noteX = lastNoteBounds.x - CASCADE_OFFSET;
        noteY = lastNoteBounds.y;
      }
    }

    // Ensure the note stays within screen bounds
    noteX = Math.max(0, Math.min(noteX, screenWidth - WINDOW_WIDTH));
    noteY = Math.max(0, Math.min(noteY, screenHeight - WINDOW_HEIGHT));

    const noteWindow = new BrowserWindow({
      width: WINDOW_WIDTH,
      height: WINDOW_HEIGHT,
      x: noteX,
      y: noteY,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, "preload.js"),
        sandbox: false,
      },
      parent: this.mainWindow,
      show: false,
      frame: true,
      hasShadow: true,
      minWidth: 300,
      minHeight: 200,
    });

    noteWindow.setMenu(null);
    noteWindow.loadFile(path.join(__dirname, "notes/note.html"));

    noteWindow.once("ready-to-show", () => {
      noteWindow.show();
      this.applyGlowEffect(noteWindow);
    });

    this.noteWindows.push(noteWindow);
    this.setupNoteWindowListeners(noteWindow);

    return noteWindow;
  }

  setupNoteWindowListeners(noteWindow) {
    noteWindow.on("closed", () => {
      const index = this.noteWindows.indexOf(noteWindow);
      if (index > -1) {
        this.noteWindows.splice(index, 1);
      }
    });

    noteWindow.on("move", () => this.applyGlowEffect(noteWindow));
    noteWindow.on("resize", () => this.applyGlowEffect(noteWindow));

    noteWindow.webContents.on("will-navigate", (event, url) => {
      event.preventDefault();
      this.handleFileOpen(url);
    });
  }

  applyGlowEffect(window) {
    window.webContents.executeJavaScript(`
      document.body.classList.add("glow");
      setTimeout(() => document.body.classList.remove("glow"), 2000);
    `);
  }

  setupContextMenu() {
    const contextMenu = Menu.buildFromTemplate([
      { label: "New Note", click: () => this.createNoteWindow() },
      { label: "Toggle Theme", click: () => this.toggleTheme() },
      { type: "separator" },
      { label: "Close Window", click: () => this.mainWindow?.close() },
    ]);

    this.mainWindow.webContents.on("context-menu", (event, params) => {
      event.preventDefault();
      contextMenu.popup({ window: this.mainWindow, x: params.x, y: params.y });
    });
  }

  setupIPC() {
    ipcMain.on("close-window", () => this.mainWindow?.close());
    ipcMain.on("create-new-note", () => this.createNoteWindow());
    ipcMain.on("request-theme-change", () => this.toggleTheme());
    ipcMain.on("window-move", (event) =>
      event.sender.send("apply-glow-effect")
    );
    ipcMain.on("ipc-debug", (event, message) =>
      console.log("IPC Debug:", message)
    );
    ipcMain.on("show-context-menu", (event) =>
      this.contextMenu.popup({
        window: BrowserWindow.fromWebContents(event.sender),
      })
    );

    this.setupDragIPC();
    this.setupNoteContextMenu();
  }

  setupDragIPC() {
    ipcMain.on("start-drag", (event, mousePosition) => {
      if (!this.dragState.isDragging) {
        this.dragState.isDragging = true;
        const [windowX, windowY] = this.mainWindow.getPosition();
        this.dragState.startPosition = { x: windowX, y: windowY };
        this.dragState.startMouseOffset = {
          x: mousePosition.x - windowX,
          y: mousePosition.y - windowY,
        };
        this.dragState.lastMousePosition = mousePosition;
        this.startDragLoop();
      }
    });

    ipcMain.on("drag", (event, currentMousePosition) => {
      if (this.dragState.isDragging) {
        this.dragState.lastMousePosition = currentMousePosition;
      }
    });

    ipcMain.on("end-drag", () => {
      this.dragState.isDragging = false;
      if (this.dragState.interval) {
        clearInterval(this.dragState.interval);
        this.dragState.interval = null;
      }
    });
  }

  setupNoteContextMenu() {
    ipcMain.on("show-note-context-menu", (event) => {
      const noteContextMenu = Menu.buildFromTemplate([
        { label: "Cut", role: "cut" },
        { label: "Copy", role: "copy" },
        { label: "Paste", role: "paste" },
        { type: "separator" },
        { label: "Toggle Theme", click: () => this.toggleTheme() },
      ]);

      noteContextMenu.popup({
        window: BrowserWindow.fromWebContents(event.sender),
      });
    });
  }

  startDragLoop() {
    this.dragState.interval = setInterval(() => {
      if (!this.dragState.isDragging) {
        clearInterval(this.dragState.interval);
        this.dragState.interval = null;
        return;
      }

      const currentTime = Date.now();
      if (currentTime - this.lastUpdateTime >= this.frameInterval) {
        const newX = Math.round(
          this.dragState.lastMousePosition.x - this.dragState.startMouseOffset.x
        );
        const newY = Math.round(
          this.dragState.lastMousePosition.y - this.dragState.startMouseOffset.y
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
      if (!this.dragState.isDragging) {
        const [width, height] = this.mainWindow.getSize();
        this.currentSize = { width, height };
      }
    });
  }

  setupTheme() {
    this.mainWindow.webContents.on("did-finish-load", () => this.updateTheme());
    nativeTheme.on("updated", () => this.updateTheme());
  }

  updateTheme() {
    const isDarkMode = nativeTheme.shouldUseDarkColors;
    this.mainWindow.webContents.send("update-theme", isDarkMode);
    this.noteWindows.forEach((window) =>
      window.webContents.send("update-theme", isDarkMode)
    );
  }

  toggleTheme() {
    nativeTheme.themeSource = nativeTheme.shouldUseDarkColors
      ? "light"
      : "dark";
    this.updateTheme();
  }
}

module.exports = WindowManager;
