let editor;

document.addEventListener("DOMContentLoaded", () => {
  editor = CodeMirror(document.getElementById("editor"), {
    lineNumbers: true,
    mode: "markdown",
    theme: "default",
    lineWrapping: true,
  });

  editor.on("change", (cm, change) => {
    if (change.origin === "+input" || change.origin === "+delete") {
      const lineNumber = change.from.line;
      cm.removeLineClass(lineNumber, "background", "rendered-line");
      cm.addLineClass(lineNumber, "background", "editing-line");
    }
  });

  editor.on("cursorActivity", (cm) => {
    const currentLine = cm.getCursor().line;
    cm.eachLine((line) => {
      const lineNumber = editor.getLineNumber(line);
      if (
        lineNumber !== currentLine &&
        !cm.lineInfo(lineNumber).handle.styles
      ) {
        renderLine(cm, lineNumber);
      }
    });
  });

  function renderLine(cm, lineNumber) {
    const lineContent = cm.getLine(lineNumber);
    const renderedHTML = marked.parse(lineContent);
    const lineHandle = cm.getLineHandle(lineNumber);

    cm.removeLineClass(lineNumber, "background", "editing-line");
    cm.addLineClass(lineNumber, "background", "rendered-line");

    cm.markText(
      { line: lineNumber, ch: 0 },
      { line: lineNumber, ch: lineContent.length },
      {
        replacedWith: createRenderedElement(renderedHTML),
        handleMouseEvents: true,
      }
    );
  }

  function createRenderedElement(html) {
    const el = document.createElement("div");
    el.innerHTML = html;
    el.style.display = "inline-block";
    el.style.width = "100%";
    el.classList.add("CodeMirror-linewidget");
    return el;
  }

  // Theme handling
  function setTheme(isDarkMode) {
    document.documentElement.setAttribute(
      "data-theme",
      isDarkMode ? "dark" : "light"
    );
    editor.setOption("theme", isDarkMode ? "darcula" : "default");
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
});

window.electronAPI.onFileOpened((event, content) => {
  editor.setValue(content);
  editor.eachLine((line) => {
    const lineNumber = editor.getLineNumber(line);
    renderLine(editor, lineNumber);
  });
});

window.electronAPI.onSaveFile((event, filePath) => {
  const content = editor.getValue();
  window.electronAPI.saveContent({ filePath, content });
});
