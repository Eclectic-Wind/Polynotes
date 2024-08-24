// Constants
const MARKDOWN_PATTERNS = [
  {
    pattern: /(\*\*\*)(.*?)\1/g,
    replacement: "<strong><em>$2</em></strong>",
  },
  { pattern: /(\*\*)(.*?)\1/g, replacement: "<strong>$2</strong>" },
  { pattern: /(\*)(.*?)\1/g, replacement: "<em>$2</em>" },
  { pattern: /(~~)(.*?)\1/g, replacement: "<del>$2</del>" },
  { pattern: /(__)(.*?)\1/g, replacement: "<u>$2</u>" },
  { pattern: /(___)(.*?)\1/g, replacement: "<u><em>$2</em></u>" },
  { pattern: /(`)(.*?)\1/g, replacement: "<code>$2</code>" },
  { pattern: /(\[)(.*?)\]\((.*?)\)/g, replacement: '<a href="$3">$2</a>' },
  // Add header patterns
  {
    pattern: /^(#{1,6})\s(.*)$/gm,
    replacement: (_, hashes, content) =>
      `<h${hashes.length}>${content}</h${hashes.length}>`,
  },
];

// Helper functions
const renderInlineMarkdown = (text) =>
  MARKDOWN_PATTERNS.reduce(
    (acc, { pattern, replacement }) => acc.replace(pattern, replacement),
    text
  );

const createRenderedElement = (text) => {
  const el = document.createElement("span");
  el.innerHTML = renderInlineMarkdown(text);
  el.setAttribute("data-original", text);
  return el;
};

const findMarkdownTokens = (text) => {
  const regex =
    /(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*|___.*?___|\~\~.*?\~\~|__.*?__|_.*?_|`.*?`|\[.*?\]\(.*?\)|^#{1,6}\s.*$|\|(?:(?:[^|\n]*\|)+)\n\|(?:(?::?-+:?\|)+)\n(?:\|(?:(?:[^|\n]*\|)+)\n?)+)/gm;
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
};

const renderTable = (tableText) => {
  const rows = tableText.trim().split("\n");
  const headerRow = rows[0]
    .slice(1, -1)
    .split("|")
    .map((cell) => cell.trim());
  const alignments = rows[1]
    .slice(1, -1)
    .split("|")
    .map((cell) => {
      if (cell.trim().startsWith(":") && cell.trim().endsWith(":"))
        return "center";
      if (cell.trim().startsWith(":")) return "left";
      if (cell.trim().endsWith(":")) return "right";
      return "";
    });

  let html = "<table>\n";
  html += "  <thead>\n";
  html += "    <tr>\n";
  headerRow.forEach((cell, i) => {
    const align = alignments[i] ? ` align="${alignments[i]}"` : "";
    html += `      <th${align}>${cell}</th>\n`;
  });
  html += "    </tr>\n";
  html += "  </thead>\n";

  html += "  <tbody>\n";
  rows.slice(2).forEach((row) => {
    html += "    <tr>\n";
    row
      .slice(1, -1)
      .split("|")
      .forEach((cell, i) => {
        const align = alignments[i] ? ` align="${alignments[i]}"` : "";
        html += `      <td${align}>${cell.trim()}</td>\n`;
      });
    html += "    </tr>\n";
  });
  html += "  </tbody>\n";
  html += "</table>";

  return html;
};

class MarkdownRenderer {
  constructor(editor) {
    this.editor = editor;
  }

  renderSyntax(token) {
    const from = this.editor.posFromIndex(token.index);
    const to = this.editor.posFromIndex(token.index + token.length);

    let element;
    if (token.text.startsWith("|")) {
      const html = renderTable(token.text);
      element = document.createElement("div");
      element.innerHTML = html;
    } else {
      element = createRenderedElement(token.text);
    }
    element.setAttribute("data-original", token.text);

    const mark = this.editor.markText(from, to, {
      replacedWith: element,
      handleMouseEvents: true,
      inclusiveLeft: false,
      inclusiveRight: false,
      atomic: false,
    });

    this.editor.on("cursorActivity", () => this.handleCursorActivity(mark));
  }

  handleCursorActivity(mark) {
    const cursor = this.editor.getCursor();
    const markPos = mark.find();

    if (
      markPos &&
      cursor.line >= markPos.from.line &&
      cursor.line <= markPos.to.line
    ) {
      const line = this.editor.getLine(cursor.line);
      const cursorOffset = this.editor.indexFromPos(cursor);
      const markOffset = this.editor.indexFromPos(markPos.from);
      const relativeOffset = cursorOffset - markOffset;

      mark.clear();

      if (cursor.line === markPos.from.line) {
        this.editor.setCursor(
          this.editor.posFromIndex(markOffset + relativeOffset)
        );
      } else if (cursor.line === markPos.to.line) {
        const markLength = markPos.to.ch - markPos.from.ch;
        this.editor.setCursor(
          this.editor.posFromIndex(
            markOffset + Math.min(relativeOffset, markLength)
          )
        );
      }
    }
  }

  updateRendering() {
    const content = this.editor.getValue();
    const tokens = findMarkdownTokens(content);
    const cursor = this.editor.getCursor();

    this.editor.operation(() => {
      this.editor.getAllMarks().forEach((mark) => mark.clear());

      tokens.forEach((token) => {
        const tokenStart = this.editor.posFromIndex(token.index);
        const tokenEnd = this.editor.posFromIndex(token.index + token.length);

        if (
          cursor.line < tokenStart.line ||
          cursor.line > tokenEnd.line ||
          (cursor.line === tokenStart.line && cursor.ch < tokenStart.ch) ||
          (cursor.line === tokenEnd.line && cursor.ch > tokenEnd.ch)
        ) {
          this.renderSyntax(token);
        }
      });
    });
  }
}

export { MarkdownRenderer };
