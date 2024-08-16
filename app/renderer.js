// Event listener for creating a new note
document
  .getElementById("createNewNoteContainer")
  .addEventListener("click", (e) => {
    console.log("Create new note clicked");
    window.electronAPI.createNewNote();
  });

// Theme handling
function setTheme(isDarkMode) {
  document.documentElement.setAttribute(
    "data-theme",
    isDarkMode ? "dark" : "light"
  );
}

// Listen for theme updates from main process
window.electronAPI.onUpdateTheme((isDarkMode) => {
  setTheme(isDarkMode);
});

// Apply initial theme
setTheme(
  window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches
);

// Request theme change (can be triggered by a button if needed)
function requestThemeChange() {
  window.electronAPI.requestThemeChange();
}

// Log all available electronAPI methods
console.log("Available electronAPI methods:", Object.keys(window.electronAPI));

// Add event listener for search input
const searchInput = document.getElementById("searchNotes");
if (searchInput) {
  searchInput.addEventListener("input", (e) => {
    const searchTerm = e.target.value;
    console.log("Search term:", searchTerm);
    // Implement search functionality here
    // For example: window.electronAPI.searchNotes(searchTerm);
  });
}

document.addEventListener("DOMContentLoaded", () => {
  document.body.classList.add("glow");
  setTimeout(() => {
    document.body.classList.remove("glow");
  }, 1000);
});

// Dragging functionality
const gripDots = document.getElementById("gripDots");
let isDragging = false;

// Add cursor styles for grip dots
gripDots.addEventListener("mouseenter", () => {
  gripDots.style.cursor = "grab";
});

gripDots.addEventListener("mouseleave", () => {
  if (!isDragging) {
    gripDots.style.cursor = "default";
  }
});

gripDots.addEventListener("mousedown", (e) => {
  isDragging = true;
  gripDots.style.cursor = "grabbing";
  window.electronAPI.startDrag({ x: e.screenX, y: e.screenY });
});

document.addEventListener("mousemove", (e) => {
  if (isDragging) {
    window.electronAPI.drag({ x: e.screenX, y: e.screenY });
  }
});

document.addEventListener("mouseup", () => {
  if (isDragging) {
    isDragging = false;
    gripDots.style.cursor = "grab";
    window.electronAPI.endDrag();
  }
});

// Resizing functionality
const resizeHandle = document.createElement("div");
resizeHandle.style.position = "absolute";
resizeHandle.style.right = "0";
resizeHandle.style.bottom = "0";
resizeHandle.style.width = "10px";
resizeHandle.style.height = "10px";
resizeHandle.style.cursor = "se-resize";
document.body.appendChild(resizeHandle);

let isResizing = false;

resizeHandle.addEventListener("mousedown", (e) => {
  isResizing = true;
  window.electronAPI.startResize();
  e.preventDefault();
});

document.addEventListener("mousemove", (e) => {
  if (isResizing) {
    // The actual resizing is handled by Electron
  }
});

document.addEventListener("mouseup", () => {
  if (isResizing) {
    isResizing = false;
    window.electronAPI.endResize();
  }
});
