(function (mod) {
  if (typeof exports == "object" && typeof module == "object")
    // CommonJS
    mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd)
    // AMD
    define(["../../lib/codemirror"], mod);
  // Plain browser env
  else mod(CodeMirror);
})(function (CodeMirror) {
  "use strict";

  CodeMirror.defineMode("polynotes-custom", function (config) {
    return {
      startState: function () {
        return {
          italic: false,
          bold: false,
          underline: false,
          strikethrough: false,
          code: false,
          codeBlock: false,
          table: false,
          tableRow: 0,
          tableAlign: false,
          bottomRowSeen: false, // New state to track if we've seen a bottom row
        };
      },
      token: function (stream, state) {
        // Reset table state at the start of each line if it's empty or not a table row
        if (stream.sol()) {
          if (stream.eol() || !stream.match(/^\s*\|/, false)) {
            state.table = false;
            state.tableRow = 0;
            state.tableAlign = false;
            state.bottomRowSeen = false;
          }
        }

        // Check for headers at the start of the line
        if (stream.sol() && stream.match(/^#{1,6}\s+/)) {
          return "header";
        }

        // Check for blockquotes
        if (stream.sol() && stream.match(/^>\s+/)) {
          return "quote";
        }

        // Check for unordered list items
        if (stream.sol() && stream.match(/^[-*+]\s+/)) {
          return "list";
        }

        // Check for ordered list items
        if (stream.sol() && stream.match(/^\d+\.\s+/)) {
          return "list";
        }

        // Check for task list items
        if (stream.sol() && stream.match(/^- \[[x ]\]\s+/i)) {
          return "list task";
        }

        // Check for horizontal rules
        if (stream.sol() && stream.match(/^(---|\*\*\*|___)\s*$/)) {
          return "hr";
        }

        if (state.codeBlock) {
          if (stream.match("```")) {
            state.codeBlock = false;
            return "code";
          }
          stream.skipToEnd();
          return "code";
        }

        if (stream.match("```")) {
          state.codeBlock = true;
          return "code";
        }

        // Check for links
        if (stream.match(/\[.*?\]\(.*?\)/)) {
          return "link";
        }

        // Check for images
        if (stream.match(/!\[.*?\]\(.*?\)/)) {
          return "image";
        }

        if (stream.match("`")) {
          state.code = !state.code;
          return "code";
        }

        if (state.code) {
          stream.next();
          return "code";
        }

        // Table handling
        if (stream.sol() && stream.match(/^\s*\|/)) {
          if (!state.table || state.bottomRowSeen) {
            state.table = true;
            state.tableRow = 1;
            state.bottomRowSeen = false; // Reset bottom row flag
          } else {
            state.tableRow++;
          }
          return getTableClass(stream, state);
        }

        if (state.table) {
          if (stream.match(/\|/)) {
            return getTableClass(stream, state);
          }
          if (stream.match(/^[\-:]+$/)) {
            state.tableAlign = true;
            return "table-align";
          }
          stream.next();
          return getTableClass(stream, state);
        }

        if (stream.match("***") || stream.match("___")) {
          state.italic = !state.italic;
          state.bold = !state.bold;
          return state.italic && state.bold ? "italic bold" : "";
        }

        if (stream.match("**")) {
          state.bold = !state.bold;
          return "bold";
        }

        if (stream.match("__")) {
          state.underline = !state.underline;
          return "underline";
        }

        if (stream.match("*") || stream.match("_")) {
          state.italic = !state.italic;
          return "italic";
        }

        if (stream.match("~~~~")) {
          state.strikethrough = !state.strikethrough;
          return "strikethrough";
        }

        stream.next();
        return state.italic
          ? "italic"
          : state.bold
          ? "bold"
          : state.underline
          ? "underline"
          : state.strikethrough
          ? "strikethrough"
          : null;
      },
    };
  });

  function getTableClass(stream, state) {
    function hasNextTableRow(stream) {
      var nextLine = stream.lookAhead(1);
      if (nextLine === undefined || nextLine.trim() === "") {
        return false; // Next line is empty or end of document
      }
      return nextLine.trim().startsWith("|");
    }

    var nextRowExists = hasNextTableRow(stream);

    if (state.tableRow === 1) {
      if (!nextRowExists) {
        state.bottomRowSeen = true;
        return "table-single";
      } else {
        return "table-top";
      }
    } else if (!nextRowExists) {
      state.bottomRowSeen = true;
      return "table-bottom";
    } else {
      return "table-middle";
    }
  }

  CodeMirror.defineMIME("text/x-polynotes-custom", "polynotes-custom");
});
