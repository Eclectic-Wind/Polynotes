let editor;
let renderedRanges = [];

document.addEventListener("DOMContentLoaded", () => {
  editor = CodeMirror(document.getElementById("editor"), {
    lineNumbers: true,
    mode: "markdown",
    theme: "default",
    lineWrapping: true,
    styleActiveLine: false,
  });

  editor.on("change", (cm, change) => {
    if (
      change.origin === "+input" &&
      change.text.length === 2 &&
      change.text[0] === "" &&
      change.text[1] === ""
    ) {
      // This condition checks if the change was caused by pressing Enter
      renderChangedLines(cm, change.from.line);
    }
  });

  editor.on("cursorActivity", (cm) => {
    const cursor = cm.getCursor();
    unrenderAtPosition(cm, cursor);
  });

  editor.getWrapperElement().addEventListener("click", (event) => {
    const pos = editor.coordsChar({ left: event.clientX, top: event.clientY });
    unrenderAtPosition(editor, pos);
  });

  function renderChangedLines(cm, line) {
    const blockRange = findBlockRange(cm, line);
    renderRange(cm, blockRange.from, blockRange.to);
  }

  function renderRange(cm, startLine, endLine) {
    const content = cm.getRange(
      { line: startLine, ch: 0 },
      { line: endLine, ch: cm.getLine(endLine).length }
    );
    const renderedHTML = marked.parse(content);
    if (renderedHTML.trim() !== content.trim()) {
      const element = createRenderedElement(renderedHTML);
      replaceRange(cm, startLine, endLine, element);
      renderedRanges.push({ from: startLine, to: endLine });
    }
  }

  function findBlockRange(cm, startLine) {
    const endLine = cm.lastLine();
    let currentLine = startLine;

    // Function to check if a line is empty or only contains whitespace
    const isEmptyLine = (line) => cm.getLine(line).trim() === "";

    // Function to count '>' characters at the start of a line
    const countBlockquoteMarkers = (line) => {
      const lineContent = cm.getLine(line);
      let count = 0;
      while (count < lineContent.length && lineContent[count] === ">") {
        count++;
      }
      return count;
    };

    // Check for block quote
    const startMarkers = countBlockquoteMarkers(startLine);
    if (startMarkers > 0) {
      // Look backwards
      while (currentLine > 0) {
        const prevMarkers = countBlockquoteMarkers(currentLine - 1);
        if (prevMarkers === 0 && !isEmptyLine(currentLine - 1)) {
          break;
        }
        currentLine--;
      }
      const fromLine = currentLine;

      // Look forwards
      currentLine = startLine;
      while (currentLine <= endLine) {
        const currentMarkers = countBlockquoteMarkers(currentLine);
        if (currentMarkers === 0 && !isEmptyLine(currentLine)) {
          // Check for consecutive blockquotes
          let nextNonEmptyLine = currentLine + 1;
          while (nextNonEmptyLine <= endLine && isEmptyLine(nextNonEmptyLine)) {
            nextNonEmptyLine++;
          }
          if (
            nextNonEmptyLine <= endLine &&
            countBlockquoteMarkers(nextNonEmptyLine) > 0
          ) {
            currentLine = nextNonEmptyLine;
            continue;
          }
          break;
        }
        currentLine++;
      }
      return { from: fromLine, to: currentLine - 1 };
    }

    // Check for list
    if (/^(\s*[-*+]|\s*\d+\.)/.test(cm.getLine(startLine))) {
      while (
        currentLine > 0 &&
        (/^(\s*[-*+]|\s*\d+\.)/.test(cm.getLine(currentLine - 1)) ||
          isEmptyLine(currentLine - 1))
      ) {
        currentLine--;
      }
      const fromLine = currentLine;
      currentLine = startLine;
      while (
        currentLine <= endLine &&
        (/^(\s*[-*+]|\s*\d+\.)/.test(cm.getLine(currentLine)) ||
          isEmptyLine(currentLine))
      ) {
        currentLine++;
      }
      return { from: fromLine, to: currentLine - 1 };
    }

    // Check for code block
    if (cm.getLine(startLine).trim().startsWith("```")) {
      while (
        currentLine > 0 &&
        !cm
          .getLine(currentLine - 1)
          .trim()
          .startsWith("```")
      ) {
        currentLine--;
      }
      const fromLine = currentLine;
      currentLine = startLine;
      while (currentLine <= endLine) {
        if (
          currentLine !== fromLine &&
          cm.getLine(currentLine).trim() === "```"
        ) {
          return { from: fromLine, to: currentLine };
        }
        currentLine++;
      }
    }

    // Default to single line
    return { from: startLine, to: startLine };
  }

  function replaceRange(cm, fromLine, toLine, element) {
    const fromPos = { line: fromLine, ch: 0 };
    const toPos = { line: toLine, ch: cm.getLine(toLine).length };
    cm.markText(fromPos, toPos, {
      replacedWith: element,
      handleMouseEvents: true,
    });
  }

  function createRenderedElement(html) {
    const el = document.createElement("div");
    el.innerHTML = html;
    el.style.display = "inline-block";
    el.style.width = "100%";
    return el;
  }

  // Add context menu event listener
  editor.getWrapperElement().addEventListener("contextmenu", (event) => {
    event.preventDefault();
    window.electronAPI.showNoteContextMenu();
  });

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

  // Initial render
  renderRange(editor, 0, editor.lastLine());
});
