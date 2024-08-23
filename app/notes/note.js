document.addEventListener("DOMContentLoaded", () => {
  const editor = initializeCodeMirror();
  const renderManager = new RenderManager(editor);
  const inputHandler = new InputHandler(editor);
  const themeManager = new ThemeManager(editor);

  setupEventListeners(editor, renderManager, inputHandler, themeManager);
});

function initializeCodeMirror() {
  return CodeMirror(document.getElementById("editor"), {
    mode: "markdown",
    lineNumbers: true,
    lineWrapping: true,
    autoCloseBrackets: true,
    matchBrackets: true,
    indentUnit: 2,
    tabSize: 2,
    indentWithTabs: true,
    theme: "default",
  });
}

class RenderManager {
  constructor(editor) {
    this.editor = editor;
  }

  renderInlineMarkdown(text) {
    const markdownRules = [
      {
        pattern: /(\*\*\*|___)(.*?)\1/g,
        replacement: "<strong><em>$2</em></strong>",
      },
      { pattern: /(\*\*|__)(.*?)\1/g, replacement: "<strong>$2</strong>" },
      { pattern: /(\*|_)(.*?)\1/g, replacement: "<em>$2</em>" },
      { pattern: /~~(.*?)~~/g, replacement: "<del>$1</del>" },
      { pattern: /`([^`\n]+)`/g, replacement: "<code>$1</code>" },
      { pattern: /\[(.*?)\]\((.*?)\)/g, replacement: '<a href="$2">$1</a>' },
    ];

    return markdownRules.reduce(
      (result, rule) => result.replace(rule.pattern, rule.replacement),
      text
    );
  }

  createRenderedElement(text) {
    const el = document.createElement("span");
    el.className = this.getMarkdownClasses(text).join(" ");
    el.innerHTML = this.renderInlineMarkdown(text);
    el.setAttribute("data-original", text);
    return el;
  }

  getMarkdownClasses(text) {
    const classRules = [
      { pattern: /^\*\*\*.*\*\*\*$/, classes: ["cm-strong", "cm-em"] },
      { pattern: /^\*\*.*\*\*$/, classes: ["cm-strong"] },
      { pattern: /^\*.*\*$/, classes: ["cm-em"] },
      { pattern: /^~~.*~~$/, classes: ["cm-strikethrough"] },
      { pattern: /^`.*`$/, classes: ["cm-code"] },
      { pattern: /^\[.*\]\(.*\)$/, classes: ["cm-link"] },
    ];

    return classRules.reduce(
      (classes, rule) =>
        rule.pattern.test(text) ? [...classes, ...rule.classes] : classes,
      []
    );
  }

  findMarkdownTokens(text) {
    const regex =
      /(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*|~~.*?~~|`.*?`|\[.*?\]\(.*?\))/g;
    const tokens = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      tokens.push({
        text: match[0],
        index: match.index,
        length: match[0].length,
      });
    }
    return tokens;
  }

  handleCursorActivity(mark) {
    const cursor = this.editor.getCursor();
    const markPos = mark.find();

    if (
      markPos &&
      cursor.line === markPos.from.line &&
      cursor.line === markPos.to.line
    ) {
      if (cursor.ch >= markPos.from.ch && cursor.ch <= markPos.to.ch) {
        mark.clear();
      }
    }
  }

  renderSyntax(token) {
    const from = this.editor.posFromIndex(token.index);
    const to = this.editor.posFromIndex(token.index + token.length);
    const element = this.createRenderedElement(token.text);

    const mark = this.editor.markText(from, to, {
      replacedWith: element,
      handleMouseEvents: true,
      inclusiveLeft: false,
      inclusiveRight: false,
      atomic: false,
    });

    this.editor.on("cursorActivity", () => this.handleCursorActivity(mark));
  }

  updateRendering() {
    const content = this.editor.getValue();
    const tokens = this.findMarkdownTokens(content);
    const cursor = this.editor.getCursor();

    this.editor.operation(() => {
      this.editor.getAllMarks().forEach((mark) => mark.clear());

      tokens.forEach((token) => {
        const tokenStart = this.editor.posFromIndex(token.index);
        const tokenEnd = this.editor.posFromIndex(token.index + token.length);

        if (this.isCursorOutsideToken(cursor, tokenStart, tokenEnd)) {
          this.renderSyntax(token);
        }
      });
    });
  }

  isCursorOutsideToken(cursor, tokenStart, tokenEnd) {
    return (
      cursor.line < tokenStart.line ||
      cursor.line > tokenEnd.line ||
      (cursor.line === tokenStart.line && cursor.ch < tokenStart.ch) ||
      (cursor.line === tokenEnd.line && cursor.ch > tokenEnd.ch)
    );
  }
}

class InputHandler {
  constructor(editor) {
    this.editor = editor;
    this.specialCharTimeout = null;
  }

  handleInputRead(change) {
    const cursor = this.editor.getCursor();
    const line = this.editor.getLine(cursor.line);
    const beforeCursor = line.slice(0, cursor.ch);

    if (["*", "_", "~", "`"].includes(change.text[0])) {
      this.handleSpecialChar(change.text[0], cursor, beforeCursor);
    } else if (change.text[0] && change.text[0] !== " ") {
      this.handleRegularChar(cursor, beforeCursor, line);
    }
  }

  handleSpecialChar(char, cursor, beforeCursor) {
    clearTimeout(this.specialCharTimeout);

    if (char === "~") {
      this.handleTilde(cursor, beforeCursor);
    } else {
      this.handleOtherSpecialChars(char, cursor, beforeCursor);
    }
  }

  handleTilde(cursor, beforeCursor) {
    if (beforeCursor.endsWith("~~")) {
      this.specialCharTimeout = setTimeout(() => {
        const currentLine = this.editor.getLine(cursor.line);
        if (!currentLine.slice(cursor.ch).startsWith("~")) {
          this.editor.replaceRange("~~", cursor);
          this.editor.setCursor({ line: cursor.line, ch: cursor.ch });
        }
      }, 1);
    }
  }

  handleOtherSpecialChars(char, cursor, beforeCursor) {
    const doubleChar = char.repeat(2);

    if (beforeCursor.endsWith(doubleChar)) {
      this.editor.replaceRange(char, cursor);
      this.editor.setCursor({ line: cursor.line, ch: cursor.ch });
    } else if (beforeCursor.endsWith(char)) {
      this.specialCharTimeout = setTimeout(() => {
        if (this.editor.getLine(cursor.line).slice(cursor.ch).startsWith(char))
          return;
        this.editor.replaceRange(char, cursor);
        this.editor.setCursor({ line: cursor.line, ch: cursor.ch });
      }, 1);
    } else {
      this.specialCharTimeout = setTimeout(() => {
        const currentLine = this.editor.getLine(cursor.line);
        const afterChar = currentLine.slice(cursor.ch);
        if (!afterChar.startsWith(char) && !/^\s*$/.test(afterChar)) {
          this.editor.replaceRange(char, cursor);
          this.editor.setCursor({ line: cursor.line, ch: cursor.ch });
        }
      }, 1);
    }
  }

  handleRegularChar(cursor, beforeCursor, line) {
    if (
      beforeCursor.endsWith("~~") &&
      !line.slice(cursor.ch).startsWith("~~")
    ) {
      this.editor.replaceRange("~~", { line: cursor.line, ch: cursor.ch });
      this.editor.setCursor({ line: cursor.line, ch: cursor.ch });
    } else if (this.isSingleSpecialChar(beforeCursor)) {
      clearTimeout(this.specialCharTimeout);
      const lastChar = beforeCursor.slice(-1);
      this.editor.replaceRange(lastChar, cursor);
      this.editor.setCursor({ line: cursor.line, ch: cursor.ch + 1 });
    }
  }

  isSingleSpecialChar(beforeCursor) {
    return (
      (beforeCursor.endsWith("*") ||
        beforeCursor.endsWith("_") ||
        beforeCursor.endsWith("`") ||
        beforeCursor.endsWith("~")) &&
      !beforeCursor.endsWith("**") &&
      !beforeCursor.endsWith("__") &&
      !beforeCursor.endsWith("``") &&
      !beforeCursor.endsWith("~~") &&
      !beforeCursor.endsWith("***") &&
      !beforeCursor.endsWith("___")
    );
  }
}

class ThemeManager {
  constructor(editor) {
    this.editor = editor;
  }

  setTheme(isDarkMode) {
    document.documentElement.setAttribute(
      "data-theme",
      isDarkMode ? "dark" : "light"
    );
    this.editor.setOption("theme", isDarkMode ? "darcula" : "default");
  }

  applyInitialTheme() {
    this.setTheme(
      window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
    );
  }
}

function setupEventListeners(
  editor,
  renderManager,
  inputHandler,
  themeManager
) {
  editor.on("change", () => renderManager.updateRendering());
  editor.on("inputRead", (cm, change) => inputHandler.handleInputRead(change));
  editor.on("cursorActivity", () => renderManager.updateRendering());
  editor.on("blur", () => renderManager.updateRendering());
  editor.on("focus", () => renderManager.updateRendering());

  editor.getWrapperElement().addEventListener("contextmenu", (event) => {
    event.preventDefault();
    window.electronAPI.showNoteContextMenu();
  });

  window.electronAPI.onUpdateTheme((isDarkMode) =>
    themeManager.setTheme(isDarkMode)
  );

  themeManager.applyInitialTheme();
  renderManager.updateRendering();
}
