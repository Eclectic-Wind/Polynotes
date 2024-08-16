let editor;
const {
  EditorState,
  EditorView,
  basicSetup,
  markdown,
  syntaxHighlighting,
  HighlightStyle,
  tags,
} = window.electronAPI.getCodeMirror();
const marked = window.electronAPI.getMarked();

document.addEventListener("DOMContentLoaded", () => {
  initializeEditor();
});

function initializeEditor() {
  const highlightStyle = HighlightStyle.define([
    { tag: tags.heading1, fontSize: "1.6em", fontWeight: "bold" },
    { tag: tags.heading2, fontSize: "1.4em", fontWeight: "bold" },
    { tag: tags.heading3, fontSize: "1.2em", fontWeight: "bold" },
    { tag: tags.heading4, fontSize: "1.1em", fontWeight: "bold" },
    { tag: tags.heading5, fontSize: "1.05em", fontWeight: "bold" },
    { tag: tags.heading6, fontSize: "1em", fontWeight: "bold" },
    { tag: tags.emphasis, fontStyle: "italic" },
    { tag: tags.strong, fontWeight: "bold" },
  ]);

  const startState = EditorState.create({
    doc: "# Welcome to Polynote!\n\nStart typing your markdown here...",
    extensions: [
      basicSetup,
      markdown(),
      syntaxHighlighting(highlightStyle),
      EditorView.updateListener.of((update) => {
        if (update.docChanged) {
          renderMarkdown(update.state);
        }
      }),
      EditorView.domEventHandlers({
        mousedown: (event, view) => handleLineClick(event, view),
      }),
    ],
  });

  editor = new EditorView({
    state: startState,
    parent: document.getElementById("editor"),
  });
}

function renderMarkdown(state) {
  const doc = state.doc;
  const lines = doc.toString().split("\n");
  const renderedLines = lines.map((line, index) => {
    const from = doc.line(index + 1).from;
    const to = doc.line(index + 1).to;
    return {
      original: line,
      rendered: marked.parseInline(line),
      from,
      to,
    };
  });

  editor.dispatch({
    effects: EditorView.decorations.of(
      renderedLines.flatMap((line) =>
        line.original.trim() && line.original !== line.rendered
          ? [
              EditorView.replace({
                from: line.from,
                to: line.to,
                insert: document.createTextNode(line.rendered),
              }),
            ]
          : []
      )
    ),
  });
}

function handleLineClick(event, view) {
  const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
  if (pos) {
    const line = view.state.doc.lineAt(pos);
    view.dispatch({
      changes: { from: line.from, to: line.to, insert: line.text },
      selection: { anchor: line.from, head: line.to },
    });
  }
}

// Theme handling
window.electronAPI.onUpdateTheme((isDarkMode) => {
  document.documentElement.setAttribute(
    "data-theme",
    isDarkMode ? "dark" : "light"
  );
});

// Save functionality
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.key === "s") {
    e.preventDefault();
    window.electronAPI.saveNote(editor.state.doc.toString());
  }
});
