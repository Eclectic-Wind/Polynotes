// Event listener for creating a new note
document
  .getElementById("createNewNoteContainer")
  .addEventListener("click", (e) => {
    console.log("Create new note clicked");
    window.electronAPI.createNewNote();
  });

// Event listener for closing the window
document.getElementById("closeButton").addEventListener("click", (e) => {
  console.log("Close button clicked");
  window.electronAPI.closeWindow();
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
