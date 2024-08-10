document.addEventListener("DOMContentLoaded", () => {
  const noteContent = document.getElementById("noteContent");
  const preview = document.getElementById("preview");
  const editButton = document.getElementById("editButton");
  const previewButton = document.getElementById("previewButton");

  function updatePreview() {
    preview.innerHTML = marked(noteContent.value);
  }

  function showEdit() {
    noteContent.style.display = "block";
    preview.style.display = "none";
    editButton.classList.add("active");
    previewButton.classList.remove("active");
  }

  function showPreview() {
    noteContent.style.display = "none";
    preview.style.display = "block";
    editButton.classList.remove("active");
    previewButton.classList.add("active");
    updatePreview();
  }

  editButton.addEventListener("click", showEdit);
  previewButton.addEventListener("click", showPreview);

  noteContent.addEventListener("input", () => {
    if (preview.style.display === "block") {
      updatePreview();
    }
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
    window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
  );

  // Initial setup
  showEdit();
});
