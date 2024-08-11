let editor, preview;

document.addEventListener("DOMContentLoaded", () => {
  initializeEditor();
  initializePreview();
});

function initializeEditor() {
  const { EditorState, EditorView, basicSetup } =
    window.electronAPI.getCodeMirror();
  const { markdown } = window.electronAPI.getMarkdown();

  let startState = EditorState.create({
    doc: "# Welcome to Polynote!\n\nStart typing your markdown here...",
    extensions: [
      basicSetup,
      markdown(),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          updatePreview(update.state.doc.toString());
        }
      }),
    ],
  });

  editor = new EditorView({
    state: startState,
    parent: document.getElementById("editor"),
  });
}

function initializePreview() {
  preview = document.getElementById("preview");
  updatePreview(editor.state.doc.toString());
}

function updatePreview(markdown) {
  preview.innerHTML = marked.parse(markdown);
}

// Theme handling
window.electronAPI.onUpdateTheme((isDarkMode) => {
  document.documentElement.setAttribute(
    "data-theme",
    isDarkMode ? "dark" : "light"
  );
  // You would need to implement theme switching for CodeMirror here
});

// Save functionality
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "s") {
    e.preventDefault();
    window.electronAPI.saveNote(editor.state.doc.toString());
  }
});
