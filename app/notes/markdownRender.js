// Constants
const MARKDOWN_PATTERNS = [
  {
    pattern: /(\*\*\*|___)(.*?)\1/g,
    replacement: "<strong><em>$2</em></strong>",
  },
  { pattern: /(\*\*|__)(.*?)\1/g, replacement: "<strong>$2</strong>" },
  { pattern: /(\*|_)(.*?)\1/g, replacement: "<em>$2</em>" },
  { pattern: /~~(.*?)~~/g, replacement: "<del>$1</del>" },
  { pattern: /`([^`\n]+)`/g, replacement: "<code>$1</code>" },
  { pattern: /\[(.*?)\]\((.*?)\)/g, replacement: '<a href="$2">$1</a>' },
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
    /(\*\*\*.*?\*\*\*|\*\*.*?\*\*|\*.*?\*|~~.*?~~|`.*?`|\[.*?\]\(.*?\)|^#{1,6}\s.*$)/gm;
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

class MarkdownRenderer {
  constructor(editor) {
    this.editor = editor;
  }

  renderSyntax(token) {
    const from = this.editor.posFromIndex(token.index);
    const to = this.editor.posFromIndex(token.index + token.length);

    const element = createRenderedElement(token.text);

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
      cursor.line === markPos.from.line &&
      cursor.ch >= markPos.from.ch &&
      cursor.ch <= markPos.to.ch
    ) {
      mark.clear();
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
