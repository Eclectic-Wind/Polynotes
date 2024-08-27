// Constants
export const PAIRING_RULES = [
  { opener: "*", closer: "*", type: "emphasis" },
  { opener: "_", closer: "_", type: "emphasis" },
  { opener: "~", closer: "~", type: "strikethrough" },
  { opener: "`", closer: "`", type: "code" },
];

// Classes
export class AutoPairSyntaxHandler {
  constructor(editor, pairingRules) {
    this.editor = editor;
    this.pairingRules = pairingRules;
    this.specialCharTimeout = null;
  }

  handleInputRead(change) {
    const cursor = this.editor.getCursor();
    const line = this.editor.getLine(cursor.line);
    const beforeCursor = line.slice(0, cursor.ch);
    const inputChar = change.text[0];

    const rule = this.pairingRules.find((r) => r.opener === inputChar);

    if (rule) {
      this.handleSpecialChar(rule, cursor, beforeCursor);
    } else if (inputChar && inputChar !== " ") {
      this.handleRegularChar(cursor, beforeCursor, line);
    }
  }

  handleSpecialChar(rule, cursor, beforeCursor) {
    clearTimeout(this.specialCharTimeout);
    if (rule.doubleOnly) {
      this.handleTilde(cursor, beforeCursor);
    } else {
      this.handleAsteriskOrUnderscore(cursor, beforeCursor, rule.opener);
    }
  }

  handleTilde(cursor, beforeCursor) {
    if (beforeCursor.endsWith("~~")) {
      this.specialCharTimeout = setTimeout(() => {
        const currentLine = this.editor.getLine(cursor.line);
        if (!currentLine.slice(cursor.ch).startsWith("~")) {
          this.editor.replaceRange("~~", cursor);
          this.editor.setCursor(cursor);
        }
      }, 1);
    }
  }

  handleRegularChar(cursor, beforeCursor, line) {
    const matchingRule = this.pairingRules.find(
      (r) =>
        beforeCursor.endsWith(r.opener.repeat(2)) &&
        !line.slice(cursor.ch).startsWith(r.closer.repeat(2))
    );

    if (matchingRule) {
      this.editor.replaceRange(matchingRule.closer.repeat(2), cursor);
      this.editor.setCursor(cursor);
    } else if (this.isSingleSpecialChar(beforeCursor)) {
      clearTimeout(this.specialCharTimeout);
      const lastChar = beforeCursor.slice(-1);
      this.editor.replaceRange(lastChar, cursor);
      this.editor.setCursor({ line: cursor.line, ch: cursor.ch + 1 });
    }
  }

  isSingleSpecialChar(beforeCursor) {
    return this.pairingRules.some(
      (rule) =>
        beforeCursor.endsWith(rule.opener) &&
        !beforeCursor.endsWith(rule.opener.repeat(2)) &&
        !beforeCursor.endsWith(rule.opener.repeat(3))
    );
  }

  handleAsteriskOrUnderscore(cursor, beforeCursor, char) {
    const doubleChar = char.repeat(2);

    if (beforeCursor.endsWith(doubleChar)) {
      this.editor.replaceRange(char, cursor);
      this.editor.setCursor(cursor);
    } else if (beforeCursor.endsWith(char)) {
      this.delayedInsert(cursor, char);
    } else {
      this.delayedInsertConditional(cursor, char);
    }
  }

  delayedInsert(cursor, char) {
    this.specialCharTimeout = setTimeout(() => {
      if (this.editor.getLine(cursor.line).slice(cursor.ch).startsWith(char))
        return;
      this.editor.replaceRange(char, cursor);
      this.editor.setCursor(cursor);
    }, 1);
  }

  delayedInsertConditional(cursor, char) {
    this.specialCharTimeout = setTimeout(() => {
      const currentLine = this.editor.getLine(cursor.line);
      const afterChar = currentLine.slice(cursor.ch);
      if (!afterChar.startsWith(char) && !/^\s*$/.test(afterChar)) {
        this.editor.replaceRange(char, cursor);
        this.editor.setCursor(cursor);
      }
    }, 1);
  }
}
