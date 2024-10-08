import { MarkdownRenderer } from "./func/markdownRender.js";
import { AutoPairSyntaxHandler, PAIRING_RULES } from "./func/autoPairSyntax.js";

// Classes
class ThemeManager {
  constructor(editor) {
    this.editor = editor;
    this.isDarkMode = false;
  }

  setTheme(isDarkMode) {
    this.isDarkMode = isDarkMode;
    document.documentElement.setAttribute(
      "data-theme",
      isDarkMode ? "dark" : "light"
    );
    this.editor.setOption("theme", isDarkMode ? "darcula" : "default");
  }

  applyInitialTheme() {
    const isDarkMode =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    this.setTheme(isDarkMode);
  }

  toggleTheme() {
    this.setTheme(!this.isDarkMode);
  }

  setupEventListeners() {
    if (window.electronAPI && window.electronAPI.onUpdateTheme) {
      window.electronAPI.onUpdateTheme((isDarkMode) =>
        this.setTheme(isDarkMode)
      );
    }
  }
}

// Helper functions for formatting
function toggleInlineFormatting(cm, marker, endMarker = marker) {
  if (cm.somethingSelected()) {
    const selection = cm.getSelection();
    if (selection.startsWith(marker) && selection.endsWith(endMarker)) {
      cm.replaceSelection(
        selection.slice(marker.length, -endMarker.length),
        "around"
      );
    } else {
      cm.replaceSelection(marker + selection + endMarker, "around");
    }
  } else {
    const cursor = cm.getCursor();
    const line = cm.getLine(cursor.line);
    const from = {
      line: cursor.line,
      ch: Math.max(0, cursor.ch - marker.length),
    };
    const to = {
      line: cursor.line,
      ch: Math.min(line.length, cursor.ch + endMarker.length),
    };
    const markerRegex = new RegExp(`^\\${marker}.*\\${endMarker}$`);
    if (markerRegex.test(cm.getRange(from, to))) {
      cm.replaceRange(
        cm.getRange(from, to).slice(marker.length, -endMarker.length),
        from,
        to
      );
    } else {
      cm.replaceRange(marker + endMarker, cursor);
      cm.setCursor({ line: cursor.line, ch: cursor.ch + marker.length });
    }
  }
}

function toggleBlockFormatting(cm, prefix) {
  const selection = cm.listSelections()[0];
  const start =
    selection.head.line <= selection.anchor.line
      ? selection.head
      : selection.anchor;
  const end =
    selection.head.line > selection.anchor.line
      ? selection.head
      : selection.anchor;

  for (let i = start.line; i <= end.line; i++) {
    const line = cm.getLine(i);
    if (line.startsWith(prefix)) {
      cm.replaceRange("", { line: i, ch: 0 }, { line: i, ch: prefix.length });
    } else {
      cm.replaceRange(prefix, { line: i, ch: 0 });
    }
  }
}

function toggleOrderedList(cm) {
  const selection = cm.listSelections()[0];
  const start =
    selection.head.line <= selection.anchor.line
      ? selection.head
      : selection.anchor;
  const end =
    selection.head.line > selection.anchor.line
      ? selection.head
      : selection.anchor;

  for (let i = start.line; i <= end.line; i++) {
    const line = cm.getLine(i);
    const match = line.match(/^(\d+)\.\s/);
    if (match) {
      cm.replaceRange("", { line: i, ch: 0 }, { line: i, ch: match[0].length });
    } else {
      cm.replaceRange(`${i - start.line + 1}. `, { line: i, ch: 0 });
    }
  }
}

// Main function
document.addEventListener("DOMContentLoaded", function () {
  const editor = CodeMirror(document.getElementById("editor"), {
    mode: "polynotes-custom",
    lineNumbers: true,
    theme: "default",
    lineWrapping: true,
    autofocus: true,
    autoCloseBrackets: true,
    matchBrackets: true,
    indentUnit: 4,
    tabSize: 4,
    indentWithTabs: false,
    cursorStyle: "line",
    extraKeys: {
      Enter: "newlineAndIndentContinueMarkdownList",
      "Ctrl-B": (cm) => toggleInlineFormatting(cm, "**"),
      "Ctrl-I": (cm) => toggleInlineFormatting(cm, "*"),
      "Ctrl-K": (cm) => toggleInlineFormatting(cm, "[", "](url)"),
      "Ctrl-Q": (cm) => toggleBlockFormatting(cm, "> "),
      "Ctrl-L": (cm) => toggleBlockFormatting(cm, "- "),
      "Ctrl-Alt-L": toggleOrderedList,
      "Ctrl-1": (cm) => toggleBlockFormatting(cm, "# "),
      "Ctrl-2": (cm) => toggleBlockFormatting(cm, "## "),
      "Ctrl-3": (cm) => toggleBlockFormatting(cm, "### "),
      "Ctrl-4": (cm) => toggleBlockFormatting(cm, "#### "),
      "Ctrl-5": (cm) => toggleBlockFormatting(cm, "##### "),
      "Ctrl-6": (cm) => toggleBlockFormatting(cm, "###### "),
      "Ctrl-/": (cm) => cm.toggleComment(),
      "Shift-Ctrl-C": (cm) => toggleInlineFormatting(cm, "```\n", "\n```"),
      "Ctrl-Space": "autocomplete",
    },
  });

  // Add context menu setup
  editor.getWrapperElement().addEventListener("contextmenu", (e) => {
    e.preventDefault();
    if (window.electronAPI && window.electronAPI.showNoteContextMenu) {
      window.electronAPI.showNoteContextMenu();
    }
  });

  const autoPairHandler = new AutoPairSyntaxHandler(editor, PAIRING_RULES);
  editor.on("inputRead", (cm, change) =>
    autoPairHandler.handleInputRead(change)
  );

  const markdownRenderer = new MarkdownRenderer(editor);

  editor.on("change", () => markdownRenderer.updateRendering());
  editor.on("cursorActivity", () => markdownRenderer.updateRendering());
  editor.on("blur", () => markdownRenderer.updateRendering());
  editor.on("focus", () => markdownRenderer.updateRendering());

  // Initialize ThemeManager
  const themeManager = new ThemeManager(editor);
  themeManager.applyInitialTheme();
  themeManager.setupEventListeners();

  // Initial rendering
  markdownRenderer.updateRendering();
});
