// Constants
const MARKDOWN_PATTERNS = [
  { pattern: /(\*\*\*)(.*?)\1/g, replacement: "<strong><em>$2</em></strong>" },
  { pattern: /(\*\*)(.*?)\1/g, replacement: "<strong>$2</strong>" },
  { pattern: /(\*)(.*?)\1/g, replacement: "<em>$2</em>" },
  { pattern: /(~~)(.*?)\1/g, replacement: "<del>$2</del>" },
  { pattern: /(__)(.*?)\1/g, replacement: "<u>$2</u>" },
  { pattern: /(___)(.*?)\1/g, replacement: "<u><em>$2</em></u>" },
  { pattern: /(`)(.*?)\1/g, replacement: "<code>$2</code>" },
  { pattern: /(\[)(.*?)\]\((.*?)\)/g, replacement: '<a href="$3">$2</a>' },
  {
    pattern: /^(#{1,6})\s(.*)$/gm,
    replacement: (_, hashes, content) =>
      `<h${hashes.length}>${content}</h${hashes.length}>`,
  },
];

class MarkdownRenderer {
  constructor(editor) {
    this.editor = editor;
  }

  renderInlineMarkdown(text) {
    return MARKDOWN_PATTERNS.reduce(
      (acc, { pattern, replacement }) => acc.replace(pattern, replacement),
      text
    );
  }

  createRenderedElement(text) {
    const el = document.createElement("span");
    el.innerHTML = this.renderInlineMarkdown(text);
    el.setAttribute("data-original", text);
    return el;
  }

  findMarkdownTokens(text) {
    const inlineRegex =
      /(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*|___.*?___|\~\~.*?\~\~|__.*?__|_.*?_|`.*?`|\[.*?\]\(.*?\)|^#{1,6}\s.*$)/gm;
    const tableRegex =
      /^\|.*\|[\s\S]*?\n\|[-:\s|]+\|[\s\S]*?(?:\n(?!\|)|\n$)/gm;
    const tokens = [];
    let match;

    while ((match = inlineRegex.exec(text)) !== null) {
      tokens.push({
        type: "inline",
        text: match[0],
        index: match.index,
        length: match[0].length,
      });
    }

    while ((match = tableRegex.exec(text)) !== null) {
      const tableContent = match[0].trim();
      if (this.isCompleteTable(tableContent)) {
        tokens.push({
          type: "table",
          text: tableContent,
          index: match.index,
          length: tableContent.length,
        });
      }
    }

    return tokens;
  }

  isCompleteTable(tableText) {
    const lines = tableText.split("\n");
    if (lines.length < 3) return false;

    const headerCells = lines[0]
      .split("|")
      .filter((cell) => cell.trim()).length;
    const separatorCells = lines[1]
      .split("|")
      .filter((cell) => cell.trim()).length;

    if (headerCells !== separatorCells) return false;

    for (let i = 2; i < lines.length; i++) {
      const dataCells = lines[i]
        .split("|")
        .filter((cell) => cell.trim()).length;
      if (dataCells !== headerCells) return false;
    }

    return true;
  }

  renderSyntax(token) {
    const from = this.editor.posFromIndex(token.index);
    const to = this.editor.posFromIndex(token.index + token.length);

    let element;
    if (token.type === "table") {
      element = this.renderTable(token.text);
    } else {
      element = this.createRenderedElement(token.text);
    }

    const mark = this.editor.markText(from, to, {
      replacedWith: element,
      handleMouseEvents: true,
      inclusiveLeft: false,
      inclusiveRight: false,
      atomic: token.type === "table",
    });

    element.addEventListener("click", (e) =>
      this.unrenderElement(mark, e, from, to)
    );

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

  renderTable(tableText) {
    const element = document.createElement("div");
    element.className = "rendered-table";
    element.innerHTML = this.parseTable(tableText);
    element.setAttribute("data-original", tableText);
    return element;
  }

  parseTable(tableText) {
    const rows = tableText.trim().split("\n");
    const headerCells = rows[0].split("|").slice(1, -1);
    const alignRow = rows[1].split("|").slice(1, -1);
    const bodyRows = rows.slice(2);

    const alignments = alignRow.map((cell) => {
      if (cell.trim().startsWith(":") && cell.trim().endsWith(":"))
        return "center";
      if (cell.trim().startsWith(":")) return "left";
      if (cell.trim().endsWith(":")) return "right";
      return "left";
    });

    let html = "<table><thead><tr>";
    headerCells.forEach((cell, index) => {
      html += `<th style="text-align:${
        alignments[index]
      }">${this.renderInlineMarkdown(cell.trim())}</th>`;
    });
    html += "</tr></thead><tbody>";

    bodyRows.forEach((row) => {
      html += "<tr>";
      row
        .split("|")
        .slice(1, -1)
        .forEach((cell, index) => {
          html += `<td style="text-align:${
            alignments[index]
          }">${this.renderInlineMarkdown(cell.trim())}</td>`;
        });
      html += "</tr>";
    });

    html += "</tbody></table>";
    return html;
  }

  unrenderElement(mark, event, from, to) {
    mark.clear();

    if (mark.type === "table") {
      // For tables, simply place the cursor at the start of the table
      this.editor.setCursor(from);
    } else {
      // For other elements, maintain the relative cursor position
      const clickX = event.clientX;
      const rect = event.target.getBoundingClientRect();
      const relativeX = clickX - rect.left;
      const totalWidth = rect.width;
      const relativePosition = relativeX / totalWidth;

      const startIndex = this.editor.indexFromPos(from);
      const endIndex = this.editor.indexFromPos(to);
      const length = endIndex - startIndex;

      const newCursorIndex = Math.round(startIndex + length * relativePosition);
      const newCursorPos = this.editor.posFromIndex(newCursorIndex);

      this.editor.setCursor(newCursorPos);
    }

    this.editor.focus();
  }

  handleCursorActivity(mark) {
    const cursor = this.editor.getCursor();
    const markPos = mark.find();

    if (markPos && this.isCursorInsideMark(cursor, markPos)) {
      if (mark.type === "table") {
        // For tables, unrender when the cursor enters
        this.unrenderElement(mark, null, markPos.from, markPos.to);
      }
      // For other elements, we don't need to do anything special
    }
  }

  isCursorInsideMark(cursor, markPos) {
    return (
      (cursor.line > markPos.from.line && cursor.line < markPos.to.line) ||
      (cursor.line === markPos.from.line && cursor.ch >= markPos.from.ch) ||
      (cursor.line === markPos.to.line && cursor.ch <= markPos.to.ch)
    );
  }
}

export { MarkdownRenderer };
